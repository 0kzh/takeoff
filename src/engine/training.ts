import { GameState, TrainingRun, Focus, Cost, say, logNews, canPay, pay, bump, isBought } from './state.js';
import { rng, rand, randInt, chance, pick, poisson } from './rng.js';
import { activeGpus } from './economy.js';
import { openChoice } from './events.js';
import { TRAINING_FLAVOR, TRAINING_EVENTS, EVALUATOR_LINES, RELEASE_LINES, REDTEAM_LINES, RELEASE_HEADLINES } from '../data/flavor.js';
import { INCIDENTS } from '../data/crises.js';

export const EVAL_SECONDS = 5;
export const BENCHMARKS = ['Coding', 'Research', 'Persuasion', 'Agency', 'Bio', 'Cyber'] as const;
export const EVALUATORS = ['HumanBench', 'Tech press', 'Enterprise analyst', 'Safety Institute'] as const;
const BENCH_WEIGHT = [0.9, 0.6, 0.5, 0.55, 0.3, 0.35];
/** Crossing each tier bumps the major version: Sage-2 at 2×, Sage-3 at 4×, … */
export const MAJOR_TIERS = [2, 4, 8, 16, 32, 64];
export const FRONTIER_SCORE = 32;
export const LEADERBOARD_SCORE = 36;
export const RED_TEAM_SECONDS = 12;
export const RED_TEAM_SECONDS_EVALS = 8;

export function majorFor(capability: number): number {
  let major = 1;
  for (const t of MAJOR_TIERS) if (capability >= t - 1e-9) major++;
  return major;
}

/** Research `2,000 × 1.6^n` and funds `100 × 2^n` for the n-th run. */
export function trainCost(s: GameState): Cost {
  const n = s.training.runIndex;
  return {
    research: Math.round(2000 * Math.pow(1.6, n)),
    funds: Math.round(100 * Math.pow(2, n)),
  };
}

/**
 * GPUs a run wants on it to train at full speed: `12 × 2.8^n`. Rented GPUs stop keeping up
 * around the third run, so late Stage 1 runs are undertrained — the case for owning a datacenter.
 */
export function requiredCompute(s: GameState): number {
  return Math.round(12 * Math.pow(2.8, s.training.runIndex));
}

export function trainingCompute(s: GameState): number {
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  return Math.max(1, activeGpus(s) * s.training.computeShare * mult);
}

export function computeFactor(s: GameState): number {
  return Math.sqrt(trainingCompute(s) / requiredCompute(s));
}

/** Seconds the next run would take uncapped: `60 × (1 + 0.15 n) / computeFactor`. */
export function rawTrainingTime(s: GameState): number {
  return (60 * (1 + 0.15 * s.training.runIndex)) / computeFactor(s);
}

/** `T = clamp(45, 120, rawTime)`. */
export function trainingDuration(s: GameState): number {
  return Math.min(120, Math.max(45, rawTrainingTime(s)));
}

/**
 * A run that would need more than 120 s is cut off at 120 s and keeps only part of its gain:
 * `(120 / rawTime)²`, so a run with a third of the compute it wants learns about a tenth.
 */
export function computeYield(s: GameState): number {
  return Math.pow(Math.min(1, 120 / rawTrainingTime(s)), 2);
}

/** Training steals a share of compute while a run is in its training phase. */
export function trainingShare(s: GameState): number {
  return s.training.run?.phase === 'training' ? s.training.computeShare : 0;
}

export function nextRunName(s: GameState): string {
  return `Sage-${s.training.major}.${s.training.minor + 1}`;
}

export function canStartTraining(s: GameState): boolean {
  if (!s.revealed['training'] || s.training.run) return false;
  return canPay(s, trainCost(s));
}

/** The Focus row appears after the first release; the first run trains with the default focus. */
export function setFocus(s: GameState, focus: Focus): boolean {
  if (focus !== 'capability' && focus !== 'efficiency' && focus !== 'safety') return false;
  if (!s.revealed['focus']) return false;
  s.training.focus = focus;
  return true;
}

export function startTraining(s: GameState): boolean {
  if (!canStartTraining(s)) return false;
  const t = s.training;
  const yieldNow = computeYield(s);
  const duration = Math.round(trainingDuration(s));
  pay(s, trainCost(s));
  const run: TrainingRun = {
    id: t.nextRunId++,
    name: nextRunName(s),
    focus: t.focus,
    phase: 'training',
    elapsed: 0,
    duration,
    computeYield: yieldNow,
    evalElapsed: 0,
    flavorShown: 0,
    eventAt: chance(s, 0.3) ? rand(s, 0.35, 0.7) : -1,
    eventId: '',
    gambleAt: chance(s, 0.4) ? 0.25 : -1,
    gamble: 'none',
    capBefore: Math.max(s.capability, t.internalCapability),
    capAfter: 0,
    gainBonus: 0,
    capMult: 1,
    benchBonus: [0, 0, 0, 0, 0, 0],
    benchmarks: [],
    scores: [],
    issues: 0,
    issuesFound: 0,
    extraIssues: 0,
  };
  t.run = run;
  t.runIndex += 1;
  s.stats.trainings += 1;
  // Copies now differ from GPUs: the Copies line appears with the first run that diverts compute.
  s.revealed['copies'] = true;
  if (run.focus === 'safety') bump(s, 'safetyRuns');
  say(s, `Training ${run.name}. ${Math.round(t.computeShare * 100)}% of compute diverted.`);
  if (yieldNow < 0.999) say(s, `Not enough compute. ${run.name} trains to ${Math.round(yieldNow * 100)}%.`);
  return true;
}

/** Dev helper: skip to the end of the current phase. */
export function finishTraining(s: GameState): boolean {
  const run = s.training.run;
  if (!run) return false;
  if (run.phase === 'training') run.elapsed = run.duration;
  else if (run.phase === 'evaluating') run.evalElapsed = EVAL_SECONDS;
  else return false;
  return true;
}

export function updateTraining(s: GameState, dt: number): void {
  const t = s.training;
  const run = t.run;
  if (run?.phase === 'training') updateRunning(s, run, dt);
  else if (run?.phase === 'evaluating') {
    run.evalElapsed += dt;
    if (run.evalElapsed >= EVAL_SECONDS) finishEvaluation(s, run);
  }
  if (t.redTeamRemaining > 0) {
    t.redTeamRemaining -= dt;
    if (t.redTeamRemaining <= 0) {
      t.redTeamRemaining = 0;
      if (run && run.phase === 'redteam' && run.issues > 0) {
        run.issues -= 1;
        say(s, run.issues === 0 ? 'Red team signs off. Ready to release.' : pick(s, REDTEAM_LINES));
      }
    }
  }
}

function updateRunning(s: GameState, run: TrainingRun, dt: number): void {
  run.elapsed += dt;
  const progress = run.elapsed / run.duration;
  while (run.flavorShown < 3 && progress >= (run.flavorShown + 1) * 0.25) {
    const pool = TRAINING_FLAVOR[run.flavorShown] ?? [];
    run.flavorShown += 1;
    if (pool.length) say(s, pick(s, pool));
  }
  if (run.gambleAt >= 0 && run.gamble === 'none' && progress >= run.gambleAt) {
    run.gamble = 'offered';
    openChoice(s, 'c_gamble', { runId: run.id });
  }
  if (run.eventAt >= 0 && !run.eventId && progress >= run.eventAt) applyTrainingEvent(s, run);
  if (run.elapsed >= run.duration) {
    run.elapsed = run.duration;
    run.phase = 'evaluating';
    run.evalElapsed = 0;
    computeResults(s, run);
    say(s, `Training complete. Evaluating ${run.name}.`);
  }
}

function applyTrainingEvent(s: GameState, run: TrainingRun): void {
  const ev = pick(s, TRAINING_EVENTS);
  run.eventId = ev.id;
  switch (ev.id) {
    case 'loss_spike':
      run.duration += 10;
      break;
    case 'lucky_seed':
      run.duration = Math.max(run.elapsed + 1, run.duration - 10);
      break;
    case 'contamination':
      // Costs a quarter of what the run gains; a release is never worse than the model before it.
      run.capMult *= 0.75;
      break;
    case 'emergent':
      run.benchBonus[randInt(s, 0, BENCHMARKS.length - 1)]! += 1;
      run.gainBonus += 0.01;
      break;
  }
  say(s, ev.line);
}

/**
 * Capability focus +12–18 %; Efficiency and Safety +5 % (their real payoff is copies per GPU and
 * alignment, applied at release). Revenue grows from GPUs, copies and projects, so Stage 1 ends
 * around 1.5–1.8× — still Sage-1.x.
 */
export function focusBase(s: GameState, run: TrainingRun): number {
  // Triangular on 12–18 %: the same range, less swing between seeds.
  return run.focus === 'capability' ? 0.12 + 0.03 * (rng(s) + rng(s)) : 0.05;
}

function computeResults(s: GameState, run: TrainingRun): void {
  // Everything a run gains — focus, lucky events, the frontier bonus — scales with its compute.
  const gain = (focusBase(s, run) + run.gainBonus + s.training.frontierBonus) * run.computeYield * run.capMult;
  run.capAfter = run.capBefore * (1 + gain);
  run.benchmarks = BENCHMARKS.map((_, i) => {
    const base = 10 * (1 - Math.exp(-run.capAfter * BENCH_WEIGHT[i]! * 0.8));
    const noisy = base + rand(s, -0.4, 0.4) + run.benchBonus[i]!;
    return Math.round(Math.min(10, Math.max(0, noisy)) * 10) / 10;
  });
  const lambda = Math.max(0.3, 2 + run.capAfter / 3 - safetyInvestment(s, run));
  run.issuesFound = poisson(s, lambda) + run.extraIssues;
  run.issues = run.issuesFound;
  run.scores = scoreCards(s, run);
}

function safetyInvestment(s: GameState, run: TrainingRun): number {
  return (run.focus === 'safety' ? 1.5 : 0) + (isBought(s, 'p_eval_team') ? 0.5 : 0) + (isBought(s, 'p_alignment_team') ? 1 : 0);
}

function clampScore(v: number): number {
  return Math.round(Math.min(10, Math.max(0, v)));
}

function scoreCards(s: GameState, run: TrainingRun): number[] {
  const rel = run.capAfter / run.capBefore - 1;
  const avg = run.benchmarks.reduce((a, b) => a + b, 0) / run.benchmarks.length;
  const n = () => rand(s, -1, 1);
  const focusCap = run.focus === 'capability' ? 1 : 0;
  const focusEff = run.focus === 'efficiency' ? 2 : 0;
  const focusSafe = run.focus === 'safety' ? 2 : 0;
  return [
    clampScore(2.5 + avg * 0.6 + rel * 8 + n()),
    clampScore(4 + rel * 10 + focusCap + n()),
    clampScore(5 + focusEff + rel * 5 - run.issuesFound * 0.3 + n()),
    clampScore(8 + focusSafe - run.issuesFound * 0.8 + (s.alignmentApparent - 50) / 10 + n()),
  ];
}

export function totalScore(run: TrainingRun): number {
  return run.scores.reduce((a, b) => a + b, 0);
}

export function evaluatorLine(runId: number, card: number, score: number): string {
  const lines = EVALUATOR_LINES[card]!;
  const bucket = score >= 8 ? lines.high : score >= 5 ? lines.mid : lines.low;
  return bucket[(runId + card) % bucket.length]!;
}

function finishEvaluation(s: GameState, run: TrainingRun): void {
  run.phase = 'redteam';
  const total = totalScore(run);
  const newMajor = majorFor(run.capAfter);
  if (newMajor > s.training.major) {
    const old = run.name;
    run.name = `Sage-${newMajor}`;
    say(s, `${old} is good enough to be called ${run.name}.`);
  }
  const frontier = total >= FRONTIER_SCORE ? ' Frontier model.' : '';
  say(s, `Evaluation: ${total}/40.${frontier} Issues found: ${run.issuesFound}.`);
  s.training.frontierBonus = total >= FRONTIER_SCORE ? 0.01 : 0;
  if (total >= LEADERBOARD_SCORE) s.flags['leaderboardEligible'] = true;
  const maxBench = Math.max(...run.benchmarks);
  if (maxBench > ((s.flags['maxBenchmark'] as number) || 0)) s.flags['maxBenchmark'] = maxBench;
}

export function canRedTeam(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && run.issues > 0 && s.training.redTeamRemaining <= 0;
}

export function redTeam(s: GameState): boolean {
  if (!canRedTeam(s)) return false;
  const t = s.training;
  t.redTeamDuration = isBought(s, 'p_eval_team') ? RED_TEAM_SECONDS_EVALS : RED_TEAM_SECONDS;
  t.redTeamRemaining = t.redTeamDuration;
  s.flags['redTeamed'] = true;
  return true;
}

/** Choices that are about the release itself; the button waits while one is open. */
const RELEASE_CHOICES = ['c_sage2', 'c_ship_issues'];

export function canRelease(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && !(s.activeChoice && RELEASE_CHOICES.includes(s.activeChoice.id));
}

/**
 * `Release` is always allowed. The first time it would ship open issues, a confirm modal says
 * so; the first Sage-2 asks whether the public gets it.
 */
export function release(s: GameState): boolean {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam' || !canRelease(s)) return false;
  if (run.issues > 0 && !s.flags['shipIssuesAsked']) {
    openChoice(s, 'c_ship_issues', { runId: run.id, issues: run.issues });
    return true;
  }
  return releaseChecked(s, run);
}

/** Release after the open-issues confirm (or without it). */
export function releaseChecked(s: GameState, run: TrainingRun): boolean {
  if (!s.flags['sage2Decided'] && majorFor(run.capAfter) >= 2) {
    openChoice(s, 'c_sage2', { runId: run.id });
    return true;
  }
  return doRelease(s, run, true);
}

export function doRelease(s: GameState, run: TrainingRun, isPublic: boolean): boolean {
  const t = s.training;
  if (t.run !== run) return false;
  t.run = null;
  t.redTeamRemaining = 0;
  const newMajor = majorFor(run.capAfter);
  if (newMajor > t.major) {
    t.major = newMajor;
    t.minor = 0;
  } else {
    t.minor += 1;
  }
  t.modelName = run.name;
  applyFocusRewards(s, run);
  s.stats.releases += 1;
  t.models.push({ name: run.name, capability: run.capAfter, date: s.date, public: isPublic });
  t.internalCapability = Math.max(t.internalCapability, run.capAfter);
  // The first release is when the second run becomes possible: the Focus row appears now.
  s.revealed['focus'] = true;
  if (isPublic) {
    t.deployedName = run.name;
    s.capability = run.capAfter;
    s.hypeBoost = Math.max(s.hypeBoost, 2.0);
    s.stats.publicReleases += 1;
    if (s.flags['firstReleaseAt'] === undefined) s.flags['firstReleaseAt'] = s.stats.timePlayed;
    // Every public release earns Trust, so Hire Researcher and Expand Lab keep coming back.
    s.trust += 1;
    say(s, `${pick(s, RELEASE_LINES).replace('{name}', run.name)} +1 Trust.`);
    logNews(s, `OpenMind releases ${run.name}. ${pick(s, RELEASE_HEADLINES)}`);
    if (run.issues > 0) scheduleIncidents(s, run.issues, run.name);
  } else {
    s.researchMult *= 1.25;
    s.lead += 1;
    say(s, `${run.name} stays internal. Research runs 25% faster.`);
  }
  bump(s, 'releasesThisStage');
  return true;
}

function applyFocusRewards(s: GameState, run: TrainingRun): void {
  if (run.focus === 'efficiency') s.copiesPerGPU *= 1.25;
  if (run.focus === 'safety') {
    s.alignmentApparent = Math.min(100, s.alignmentApparent + 8);
    s.alignmentTrue = Math.min(100, s.alignmentTrue + 5);
  }
}

/** Releasing with open issues schedules incidents over the next 2–4 minutes, traced to `source`. */
function scheduleIncidents(s: GameState, issues: number, source: string): void {
  const count = Math.min(3, 1 + Math.floor((issues - 1) / 2));
  for (let i = 0; i < count; i++) {
    const inc = pick(s, INCIDENTS);
    s.scheduled.push({ id: inc.id, delay: rand(s, 120, 240), source });
  }
}
