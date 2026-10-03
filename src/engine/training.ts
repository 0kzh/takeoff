import { GameState, TrainingRun, Focus, Cost, say, logNews, canPay, pay, bump, isBought } from './state.js';
import { rng, rand, randInt, chance, pick, poisson } from './rng.js';
import { activeGpus, researchCap } from './economy.js';
import { openChoice, secondsToNextCalendarModal, MODAL_SPACING } from './events.js';
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

/**
 * Training costs depend on the capability the run starts from, not on how many runs came before,
 * so every mix of focuses pays the same to reach a capability and nothing jumps at a stage
 * boundary (stage2.md §2.5). One continuous function of `c` per cost, for the whole game: the
 * Stage 2 spec's constants hold from `COST_KNEE` (1.6×) up; below it the compute and funds curves
 * are steeper, so a first run at 1.0× trains fully on the fleet a player has at minute six.
 */
export const COST_KNEE = 1.6;
/** Every run keeps at least this share of its nominal gain, however little compute it had. */
export const MIN_YIELD = 0.3;

/** The capability the next run starts from: the best model so far, deployed or internal. */
export function startCapability(s: GameState): number {
  return Math.max(s.capability, s.training.internalCapability);
}

/** Research `21,000 × (c/1.6)^5`: ≈ 2,000 at 1.0×, 15,200 at 1.5×, 24,500 at 1.65×. */
export function researchFor(c: number): number {
  return Math.round(21000 * Math.pow(c / COST_KNEE, 5));
}

/** Funds `$25,000 × (c/1.6)^8` from the knee up; exponent 9.5 below it: ≈ $290 at 1.0×, $13,500 at 1.5×. */
export function fundsFor(c: number): number {
  return Math.round(25000 * Math.pow(c / COST_KNEE, c >= COST_KNEE ? 8 : 9.5));
}

/**
 * GPUs of training compute a run wants: `1,000 × (c/1.6)^7.5` from the knee up (≈ 1,260 at
 * 1.65×); exponent 10 below it (≈ 9 at 1.0×, 125 at 1.3×, 520 at 1.5×). Rented fleets top out
 * near a hundred GPUs, so late Stage 1 runs are undertrained — the case for owning compute.
 */
export function computeFor(c: number): number {
  return 1000 * Math.pow(c / COST_KNEE, c >= COST_KNEE ? 7.5 : 10);
}

export function trainCost(s: GameState): Cost {
  const c = startCapability(s);
  return { research: researchFor(c), funds: fundsFor(c) };
}

/** GPUs of training compute the next run wants. */
export function requiredCompute(s: GameState): number {
  return computeFor(startCapability(s));
}

/** GPUs the next run would get: the training share of the active fleet, × Distributed training. */
export function trainingCompute(s: GameState): number {
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  return Math.max(1, activeGpus(s) * s.training.computeShare * mult);
}

/** Share of the nominal gain the run keeps: `clamp(√(have / wanted), 0.3, 1)`. */
export function computeYield(s: GameState): number {
  return Math.min(1, Math.max(MIN_YIELD, Math.sqrt(trainingCompute(s) / requiredCompute(s))));
}

/** `clamp(120 × √(wanted / have), 45, 120)` seconds: a run with four times the compute it wants takes a minute. */
export function trainingDuration(s: GameState): number {
  return Math.min(120, Math.max(45, 120 * Math.sqrt(requiredCompute(s) / trainingCompute(s))));
}

/** The Research Plateau: the next run costs more research than the lab can hold. */
export function atPlateau(s: GameState): boolean {
  return s.revealed['training'] === true && !s.training.run && (trainCost(s).research ?? 0) > researchCap(s);
}

/** Seconds the plateau has lasted (0 when there is none). */
export function plateauSeconds(s: GameState): number {
  const at = s.flags['plateauSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

/** "Far beyond anything rentable": the run wants three times the compute it can get. */
export function needsOwnedCompute(s: GameState): boolean {
  return requiredCompute(s) >= 3 * trainingCompute(s);
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
    gambleAt: 0.25,
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
  say(s, `Training ${run.name}. Half the compute is diverted.`);
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
  if (run.gambleAt >= 0 && run.gamble === 'none' && progress >= run.gambleAt) offerGamble(s, run);
  if (run.eventAt >= 0 && !run.eventId && progress >= run.eventAt) applyTrainingEvent(s, run);
  if (run.elapsed >= run.duration) {
    run.elapsed = run.duration;
    run.phase = 'evaluating';
    run.evalElapsed = 0;
    computeResults(s, run);
    say(s, `Training complete. Evaluating ${run.name}.`);
  }
}

/** "Can I try something?" — at most every other run, three times a stage, and only when a modal may open. */
export const GAMBLES_PER_STAGE = 3;

function offerGamble(s: GameState, run: TrainingRun): void {
  const last = s.flags['lastGambleRun'];
  const count = (s.flags['gamblesThisStage'] as number) || 0;
  const rested = typeof last !== 'number' || run.id - last >= 2;
  // A passing offer: it never delays a modal on the calendar.
  const clear = secondsToNextCalendarModal(s) >= MODAL_SPACING;
  if (count < GAMBLES_PER_STAGE && rested && clear && openChoice(s, 'c_gamble', { runId: run.id }, { onlyIfFree: true })) {
    run.gamble = 'offered';
    s.flags['gamblesThisStage'] = count + 1;
    s.flags['lastGambleRun'] = run.id;
  } else {
    run.gamble = 'declined';
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
  say(s, `Evaluation done.${frontier} ${issueWords(run.issuesFound)}`);
  s.training.frontierBonus = total >= FRONTIER_SCORE ? 0.01 : 0;
  if (total >= LEADERBOARD_SCORE) s.flags['leaderboardEligible'] = true;
  const maxBench = Math.max(...run.benchmarks);
  if (maxBench > ((s.flags['maxBenchmark'] as number) || 0)) s.flags['maxBenchmark'] = maxBench;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** `No issues for the red team.` / `Three issues for the red team.` */
function issueWords(n: number): string {
  const count = n < WORDS.length ? WORDS[n]! : String(n);
  return n === 0 ? 'No issues for the red team.' : `${count} issue${n === 1 ? '' : 's'} for the red team.`;
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
