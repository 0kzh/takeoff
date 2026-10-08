import { GameState, TrainingRun, Focus, Cost, say, logNews, canPay, pay, bump, isBought, counter, inPrologue } from './state.js';
import { rng, rand, randInt, chance, pick, poisson } from './rng.js';
import { researchCap, rentQuota, atRentQuota, activeGpus, ARRIVAL_GPUS, chipMult } from './economy.js';
import { dataFactor, dataShort } from './data.js';
import { applyDrift } from './alignment.js';
import { moveTempo, distill } from './rivals.js';
import { moveApproval, DEPLOY_APPROVAL } from './world.js';
import { openChoice, secondsToNextCalendarModal, MODAL_SPACING } from './events.js';
import { TRAINING_FLAVOR, TRAINING_EVENTS, EVALUATOR_LINES, RELEASE_LINES, REDTEAM_LINES, RELEASE_HEADLINES } from '../data/flavor.js';
import { INCIDENTS } from '../data/crises.js';
import { fmtInt } from './format.js';
import { visibleProjects } from './projects.js';

export const EVAL_SECONDS = 5;
export const BENCHMARKS = ['Coding', 'Research', 'Persuasion', 'Agency', 'Bio', 'Cyber'] as const;
const BENCH_WEIGHT = [0.9, 0.6, 0.5, 0.55, 0.3, 0.35];
export const MAJOR_TIERS = [2, 4, 10];
export const FRONTIER_SCORE = 32;
export const RELEASE_INSIGHT = 6;
export const RELEASE_INSIGHT_S2 = 12;
export const LEADERBOARD_SCORE = 36;
export const RED_TEAM_SECONDS = 8;
export const RED_TEAM_SECONDS_EVALS = 5;
export const RELEASE_SECONDS = 5;

export const PROLOGUE_FUNDS = 4;
export const PROLOGUE_GPUS = 1;
export const PROLOGUE_POWER = 100;
export const PROLOGUE_SECONDS = 15;
export const PROLOGUE_NAME = 'Sage-1';

export function majorFor(capability: number): number {
  let major = 1;
  for (const t of MAJOR_TIERS) if (capability >= t - 1e-9) major++;
  return major;
}

export const COST_KNEE = 1.6;

export function evalRun(s: GameState): TrainingRun | null {
  const r = s.training.run;
  return r && r.phase !== 'training' ? r : null;
}

export function trainingRun(s: GameState): TrainingRun | null {
  const r = s.training.run;
  return r && r.phase === 'training' ? r : null;
}

export function pipelineRun(s: GameState): TrainingRun | null {
  return s.training.next;
}

export function runById(s: GameState, id: unknown): TrainingRun | undefined {
  const r = s.training.run;
  if (r && r.id === id) return r;
  const n = s.training.next;
  return n && n.id === id ? n : undefined;
}

export function startCapability(s: GameState): number {
  const waiting = evalRun(s);
  const queued = s.training.next;
  return Math.max(
    s.capability,
    s.training.internalCapability,
    waiting && waiting.capAfter > 0 ? waiting.capAfter : 0,
    queued && queued.capAfter > 0 ? queued.capAfter : 0,
  );
}

export const S2_CAP_REF = 1.8;
export const S2_GPU_BASE = 1000;
export const S2_GPU_EXPONENT = 4;
export const S2_FUNDS_BASE = 200000;
export const S2_FUNDS_EXPONENT = 3.2;
export const S2_RUN_MIN = 50;
export const S2_RUN_STEP = 12;
export const S2_RUN_MAX = 110;

export function effectiveGpusFor(c: number): number {
  return S2_GPU_BASE * Math.pow(Math.max(S2_CAP_REF, c) / S2_CAP_REF, S2_GPU_EXPONENT);
}

export function fundsForS2(c: number): number {
  return twoSig(S2_FUNDS_BASE * Math.pow(Math.max(S2_CAP_REF, c) / S2_CAP_REF, S2_FUNDS_EXPONENT));
}

export const S1_RUN_BASE = 75;
export const S1_RUN_EXPONENT = 11;

export function fundsFor(c: number): number {
  return twoSig(S1_RUN_BASE * Math.pow(Math.max(1, c), S1_RUN_EXPONENT));
}

export const GPU_NEED_BASE = 10;
export const GPU_NEED_EXPONENT_S1 = 4.55;
export const GPU_NEED_DC = 600;
export const GPU_NEED_EXPONENT = 7;

export function gpusFor(c: number): number {
  const raw = c < COST_KNEE ? GPU_NEED_BASE * Math.pow(Math.max(1, c), GPU_NEED_EXPONENT_S1) : GPU_NEED_DC * Math.pow(c / COST_KNEE, GPU_NEED_EXPONENT);
  return twoSig(raw);
}

export const S1_WALL = 1.68;

export function gpusForS1(c: number): number {
  return c < S1_WALL ? twoSig(GPU_NEED_BASE * Math.pow(Math.max(1, c), GPU_NEED_EXPONENT_S1)) : gpusFor(c);
}

function twoSig(raw: number): number {
  if (raw < 100) return Math.max(GPU_NEED_BASE, Math.round(raw / 5) * 5);
  const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

export function trainCost(s: GameState): Cost {
  if (inPrologue(s)) return { funds: PROLOGUE_FUNDS, power: PROLOGUE_POWER };
  const c = startCapability(s);
  if (s.stage >= 2) return { funds: fundsForS2(c) };
  return c < S1_WALL ? { funds: fundsFor(c) } : {};
}

export function gpusNeeded(s: GameState): number {
  if (inPrologue(s)) return PROLOGUE_GPUS;
  const c = startCapability(s);
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  if (s.stage >= 2) {
    const raw = effectiveGpusFor(c) / chipMult(s) / mult;
    return Math.max(100, twoSig(raw));
  }
  const n = gpusForS1(c);
  const need = mult > 1 ? twoSig(n / mult) : n;
  return c >= S1_WALL ? Math.min(need, ARRIVAL_GPUS) : need;
}

export function gpusAvailable(s: GameState): number {
  return Math.max(0, activeGpus(s) - busyGpus(s));
}

export function busyGpus(s: GameState): number {
  const r = trainingRun(s);
  let busy = r && r.elapsed < r.duration ? r.gpus ?? 0 : 0;
  const n = s.training.next;
  if (n && n.phase === 'training' && n.elapsed < n.duration) busy += n.gpus ?? 0;
  return busy;
}

export function gpusShort(s: GameState): boolean {
  return gpusAvailable(s) < gpusNeeded(s);
}

export function trainingDuration(s: GameState): number {
  if (inPrologue(s)) return PROLOGUE_SECONDS;
  if (s.stage >= 2) return Math.min(S2_RUN_MAX, Math.max(S2_RUN_MIN, S2_RUN_MIN + S2_RUN_STEP * counter(s, 'runsThisStage')));
  const n = Math.max(1, gpusNeeded(s));
  return Math.min(80, Math.max(45, 45 + 10 * Math.log2(n / 10)));
}

export function cardWall(s: GameState): boolean {
  if (!s.revealed['projects']) return false;
  const cap = researchCap(s);
  return visibleProjects(s).some((p) => !p.rescue && (p.cost(s).research ?? 0) > cap);
}

export function cardWallSeconds(s: GameState): number {
  const at = s.flags['cardWallSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

const LAB_CARDS = ['p_lab_cluster', 'p_floor', 'p_desks'];

export function labReason(s: GameState, research: number): string {
  if (research <= researchCap(s)) return '';
  const cap = researchCap(s);
  const card = visibleProjects(s).find((p) => LAB_CARDS.includes(p.id) && (p.cost(s).research ?? 0) <= cap);
  const fix = s.revealed['expandLab'] ? 'Expand Lab' : card?.title ?? '';
  return `needs a lab that holds ${fmtInt(research)}${fix ? ` — ${fix}` : ''}`;
}

export function needsDatacenter(s: GameState): boolean {
  return s.stage < 2 && gpusNeeded(s) > MAX_RENT_QUOTA;
}

export function nextRunName(s: GameState): string {
  if (inPrologue(s)) return PROLOGUE_NAME;
  const v = nextVersion(s);
  return `Sage-${v.major}.${v.minor}`;
}

function nextVersion(s: GameState): { major: number; minor: number } {
  const queued = s.training.next;
  if (queued) return { major: queued.major, minor: queued.minor + 1 };
  const waiting = evalRun(s);
  if (waiting) return { major: waiting.major, minor: waiting.minor + 1 };
  return { major: s.training.major, minor: s.training.minor + 1 };
}

export function trainGpuFigures(s: GameState): { need: number; have: number } {
  const need = gpusNeeded(s);
  if (need <= 0) return { need: 0, have: 0 };
  return { need, have: gpusAvailable(s) };
}

export function trainGpuFix(s: GameState): string {
  const need = gpusNeeded(s);
  if (s.stage >= 2 || need <= 0 || gpusAvailable(s) >= need) return '';
  if (needsDatacenter(s)) return `The cloud will rent ${fmtInt(rentQuota(s))}. Build the First Datacenter.`;
  if (atRentQuota(s) || need > rentQuota(s)) {
    const card = visibleProjects(s).find((p) => QUOTA_CARD_IDS.includes(p.id));
    return `The cloud rents ${fmtInt(rentQuota(s))}.${card ? ` ${card.title} adds 20.` : ''}`;
  }
  return '';
}

export const MAX_RENT_QUOTA = 140;

const QUOTA_CARD_IDS = ['p_compute_deal', 'p_region', 'p_reserved'];

export function pipelineOpen(s: GameState): boolean {
  return s.stage >= 2 && isBought(s, 's2_pipeline');
}

export function trainSlotFree(s: GameState): boolean {
  const t = s.training;
  if (!t.run) return true;
  return pipelineOpen(s) && !t.next && t.run.phase !== 'training';
}

export function canPressTrain(s: GameState): boolean {
  return s.revealed['training'] === true && trainSlotFree(s) && !gpusShort(s);
}

export function canStartTraining(s: GameState): boolean {
  return canPressTrain(s) && canPay(s, trainCost(s));
}

export function setFocus(s: GameState, focus: Focus): boolean {
  if (focus !== 'capability' && focus !== 'efficiency' && focus !== 'safety') return false;
  if (!s.revealed['focus']) return false;
  s.training.focus = focus;
  return true;
}

export function startTraining(s: GameState): boolean {
  if (!canStartTraining(s)) return false;
  return startRun(s, trainCost(s));
}

function etaOf(short: number, rate: number): number {
  if (short <= 1e-9) return 0;
  return rate > 0 ? short / rate : Infinity;
}

export function waitingGoalS1(s: GameState): { name: string; funds: number } | null {
  if (s.stage !== 1 || !s.revealed['training']) return null;
  if (needsDatacenter(s)) {
    const dc = visibleProjects(s).find((p) => p.id === 'p_datacenter');
    return dc ? { name: 'First Datacenter', funds: dc.cost(s).funds ?? 0 } : null;
  }
  if (!trainSlotFree(s)) return null;
  return { name: nextRunName(s), funds: trainCost(s).funds ?? 0 };
}

export function runDelaySeconds(s: GameState, cost: Cost): number {
  const goal = waitingGoalS1(s);
  if (!goal || !cost.funds) return 0;
  const rate = Math.max(0, s.stats.revPerSec);
  const before = etaOf(goal.funds - s.funds, rate);
  const after = etaOf(goal.funds - (s.funds - cost.funds), rate);
  if (!Number.isFinite(after)) return Number.isFinite(before) ? Infinity : 0;
  return Math.max(0, after - before);
}

function startRun(s: GameState, cost: Cost): boolean {
  if (inPrologue(s)) return startPrologueRun(s, cost);
  const t = s.training;
  const gpus = gpusNeeded(s);
  const serving = Math.max(0, gpusAvailable(s) - gpus);
  const duration = Math.round(trainingDuration(s));
  const capBefore = startCapability(s);
  const version = nextVersion(s);
  pay(s, cost);
  const boost = typeof s.flags['nextRunBoost'] === 'number' ? (s.flags['nextRunBoost'] as number) : 0;
  delete s.flags['nextRunBoost'];
  const bonus = s.stage >= 2 ? boost + (isBought(s, 's2_rl_envs') ? 0.03 : 0) + (isBought(s, 's2_continuous') ? 0.04 : 0) : 0;
  const factor = s.stage >= 2 ? dataFactor(s, capBefore) : 1;
  const run: TrainingRun = {
    id: t.nextRunId++,
    name: `Sage-${version.major}.${version.minor}`,
    focus: t.focus,
    phase: 'training',
    elapsed: 0,
    duration,
    gpus,
    evalElapsed: 0,
    flavorShown: 0,
    eventAt: chance(s, 0.3) ? rand(s, 0.35, 0.7) : -1,
    eventId: '',
    gambleAt: 0.25,
    gamble: 'none',
    capBefore,
    capAfter: 0,
    gainBonus: bonus,
    capMult: factor,
    benchBonus: [0, 0, 0, 0, 0, 0],
    benchmarks: [],
    scores: [],
    issues: 0,
    issuesFound: 0,
    extraIssues: 0,
    major: version.major,
    minor: version.minor,
  };
  if (t.run) t.next = run;
  else t.run = run;
  t.runIndex += 1;
  s.stats.trainings += 1;
  if (s.stage >= 2) bump(s, 'runsThisStage');
  if (run.focus === 'safety') bump(s, 'safetyRuns');
  const short = s.stage >= 2 && dataShort(s, capBefore) ? ' Data is short: the gain shrinks.' : '';
  say(s, `Training ${run.name} on ${fmtInt(gpus)} GPUs; ${fmtInt(serving)} keep serving.${short}`);
  return true;
}

function startPrologueRun(s: GameState, cost: Cost): boolean {
  const t = s.training;
  if (t.run) return false;
  const gpus = gpusNeeded(s);
  pay(s, cost);
  t.run = {
    id: 0,
    name: PROLOGUE_NAME,
    focus: t.focus,
    phase: 'training',
    elapsed: 0,
    duration: Math.round(trainingDuration(s)),
    gpus,
    evalElapsed: 0,
    flavorShown: 0,
    eventAt: -1,
    eventId: '',
    gambleAt: -1,
    gamble: 'none',
    capBefore: s.capability,
    capAfter: 0,
    gainBonus: 0,
    capMult: 1,
    benchBonus: [0, 0, 0, 0, 0, 0],
    benchmarks: [],
    scores: [],
    issues: 0,
    issuesFound: 0,
    extraIssues: 0,
    major: 1,
    minor: 0,
    prologue: true,
  };
  say(s, `Training ${PROLOGUE_NAME} on ${fmtInt(gpus)} ${gpus === 1 ? 'GPU' : 'GPUs'}.`);
  return true;
}

export function prologueRun(s: GameState): TrainingRun | null {
  const r = s.training.run;
  return r && r.prologue === true ? r : null;
}

export function deployFirstModel(s: GameState): boolean {
  const t = s.training;
  const run = prologueRun(s);
  if (!run || run.phase !== 'redteam') return false;
  t.run = null;
  t.releasing = null;
  t.redTeamRemaining = 0;
  delete s.flags['prologue'];
  s.flags['sageLiveAt'] = s.stats.timePlayed;
  say(s, `${PROLOGUE_NAME} is live. Each GPU runs a copy; each copy completes a task a second.`);
  return true;
}

export function finishTraining(s: GameState): boolean {
  const run = s.training.run;
  const queued = s.training.next;
  if (queued?.phase === 'training') {
    queued.elapsed = queued.duration;
    return true;
  }
  if (!run) return false;
  if (run.phase === 'training') run.elapsed = run.duration;
  else if (run.phase === 'evaluating') run.evalElapsed = EVAL_SECONDS;
  else if (s.training.releasing) s.training.releasing.remaining = 0;
  else return false;
  return true;
}

function promoteQueued(s: GameState): void {
  const t = s.training;
  if (t.run || !t.next) return;
  const n = t.next;
  t.next = null;
  t.run = n;
  if (n.phase === 'waiting') {
    n.phase = 'evaluating';
    n.evalElapsed = 0;
  }
}

export function updateTraining(s: GameState, dt: number): void {
  const t = s.training;
  if (t.releasing) {
    t.releasing.remaining -= dt;
    if (t.releasing.remaining <= 0) {
      if (t.run) finishRelease(s, t.run, t.releasing.isPublic);
      else t.releasing = null;
    }
  }
  promoteQueued(s);
  const run = t.run;
  if (run?.phase === 'training') updateRunning(s, run, dt, false);
  else if (run?.phase === 'evaluating') {
    run.evalElapsed += dt;
    if (run.evalElapsed >= EVAL_SECONDS) finishEvaluation(s, run);
  }
  const queued = t.next;
  if (queued?.phase === 'training') updateRunning(s, queued, dt, true);
  if (t.redTeamRemaining > 0) {
    t.redTeamRemaining -= dt;
    if (t.redTeamRemaining <= 0) {
      t.redTeamRemaining = 0;
      const r = t.run;
      if (r && r.phase === 'redteam' && r.issues > 0) {
        r.issues -= 1;
        if (r.issues === 0) {
          logNews(s, pick(s, REDTEAM_LINES));
          say(s, 'All issues fixed. Ready to release.');
        }
      }
    }
  }
}

function updateRunning(s: GameState, run: TrainingRun, dt: number, queued: boolean): void {
  if (run.elapsed < run.duration) {
    run.elapsed += dt;
    const progress = run.elapsed / run.duration;
    if (run.flavorShown < 1 && progress >= 0.5) {
      const pool = TRAINING_FLAVOR[1] ?? [];
      run.flavorShown = 1;
      if (pool.length) say(s, pick(s, pool));
    }
    if (!queued && run.gambleAt >= 0 && run.gamble === 'none' && progress >= run.gambleAt) offerGamble(s, run);
    if (run.eventAt >= 0 && !run.eventId && progress >= run.eventAt) applyTrainingEvent(s, run);
  }
  if (run.elapsed >= run.duration) {
    run.elapsed = run.duration;
    if (queued) {
      computeResults(s, run);
      run.phase = 'waiting';
      say(s, `${run.name} is trained. It waits for ${s.training.run?.name ?? 'the current model'} to ship.`);
      return;
    }
    if (run.prologue) {
      run.phase = 'redteam';
      run.issues = 0;
      run.issuesFound = 0;
      run.capAfter = run.capBefore;
      run.benchmarks = [];
      run.scores = [];
      say(s, `${run.name} is trained.`);
      return;
    }
    run.phase = 'evaluating';
    run.evalElapsed = 0;
    computeResults(s, run);
  }
}

export const GAMBLES_PER_STAGE = 3;

function offerGamble(s: GameState, run: TrainingRun): void {
  const last = s.flags['lastGambleRun'];
  const count = (s.flags['gamblesThisStage'] as number) || 0;
  const rested = run.id <= 1 ? false : typeof last !== 'number' || run.id - last >= 2;
  const allowed = count < GAMBLES_PER_STAGE;
  const clear = secondsToNextCalendarModal(s) >= MODAL_SPACING;
  if (allowed && rested && clear && openChoice(s, 'c_gamble', { runId: run.id }, { onlyIfFree: true })) {
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
  let bench = -1;
  switch (ev.id) {
    case 'loss_spike':
      run.duration = run.duration + 10;
      break;
    case 'lucky_seed':
      run.duration = Math.max(run.elapsed + 1, run.duration - 10);
      break;
    case 'contamination':
      run.capMult *= 0.75;
      break;
    case 'emergent':
      bench = randInt(s, 0, BENCHMARKS.length - 1);
      run.benchBonus[bench]! += 1;
      run.gainBonus += 0.01;
      break;
  }
  const numbered: Record<string, string> = {
    contamination: 'Data contamination found in the eval set. The run gains a quarter less.',
    emergent: `Emergent ability: ${BENCHMARKS[bench] ?? 'a benchmark'} up a tier.`,
  };
  logNews(s, numbered[ev.id] ?? ev.line);
}

export const S2_FOCUS_BASE = { capability: 0.14, efficiency: 0.1, safety: 0.1 };

function focusBase(s: GameState, run: TrainingRun): number {
  if (s.stage >= 2) return run.focus === 'capability' ? S2_FOCUS_BASE.capability + 0.03 * (rng(s) + rng(s)) : S2_FOCUS_BASE[run.focus];
  return run.focus === 'capability' ? 0.10 + 0.02 * (rng(s) + rng(s)) : 0.05;
}

function computeResults(s: GameState, run: TrainingRun): void {
  const gain = (focusBase(s, run) + run.gainBonus + s.training.frontierBonus) * run.capMult;
  run.capAfter = run.capBefore * (1 + gain);
  run.benchmarks = BENCHMARKS.map((_, i) => {
    const base = 10 * (1 - Math.exp(-run.capAfter * BENCH_WEIGHT[i]! * 0.8));
    const noisy = base + rand(s, -0.4, 0.4) + run.benchBonus[i]!;
    return Math.round(Math.min(10, Math.max(0, noisy)) * 10) / 10;
  });
  const lambda = Math.max(0.3, Math.min(s.stage >= 2 ? 4 : 99, 2 + run.capAfter / 3 - safetyInvestment(s, run)));
  run.issuesFound = poisson(s, lambda) + run.extraIssues;
  run.issues = run.issuesFound;
  run.scores = scoreCards(s, run);
  const newMajor = majorFor(run.capAfter);
  if (newMajor > run.major) {
    s.flags[`renamedFrom:${run.id}`] = run.name;
    run.major = newMajor;
    run.minor = 0;
    run.name = `Sage-${newMajor}`;
  }
}

function safetyInvestment(s: GameState, run: TrainingRun): number {
  const v = (run.focus === 'safety' ? 1.5 : 0) + (isBought(s, 'p_eval_team') ? 0.5 : 0) + (isBought(s, 'p_alignment_team') ? 1 : 0);
  return v + 0.5 * counter(s, 'safetyReleases');
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

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function riskTier(score: number): RiskTier {
  return score < 3 ? 'LOW' : score < 5 ? 'MEDIUM' : score < 7.5 ? 'HIGH' : 'CRITICAL';
}

export function knowsTested(s: GameState, run: TrainingRun): number | null {
  if (s.stage < 2 || run.capAfter < 6) return null;
  return Math.min(97, Math.round(55 + 4 * run.capAfter));
}

export function honestyProbe(s: GameState): number {
  return Math.max(0, Math.round(100 - 4 * s.deceptionBias));
}

export function releasesOwed(s: GameState): number {
  return counter(s, 'publicReleasesOwed');
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
  const renamed = s.flags[`renamedFrom:${run.id}`];
  if (typeof renamed === 'string') {
    delete s.flags[`renamedFrom:${run.id}`];
    say(s, `${renamed} is good enough to be called ${run.name}.`);
  }
  const frontier = total >= FRONTIER_SCORE ? ' Frontier model.' : '';
  say(s, `Evaluation done.${frontier} ${issueWords(run.issuesFound)}`);
  s.training.frontierBonus = total >= FRONTIER_SCORE ? 0.01 : 0;
  if (total >= LEADERBOARD_SCORE) s.flags['leaderboardEligible'] = true;
  const maxBench = Math.max(...run.benchmarks);
  if (maxBench > ((s.flags['maxBenchmark'] as number) || 0)) s.flags['maxBenchmark'] = maxBench;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function issueWords(n: number): string {
  const count = n < WORDS.length ? WORDS[n]! : String(n);
  return n === 0 ? 'No issues found.' : `${count} issue${n === 1 ? '' : 's'} found.`;
}

export function canRedTeam(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && run.issues > 0 && s.training.redTeamRemaining <= 0 && !s.training.releasing;
}

export function redTeamSeconds(s: GameState): number {
  return isBought(s, 'p_eval_team') ? RED_TEAM_SECONDS_EVALS : RED_TEAM_SECONDS;
}

export function redTeam(s: GameState): boolean {
  if (!canRedTeam(s)) return false;
  const t = s.training;
  t.redTeamDuration = redTeamSeconds(s);
  t.redTeamRemaining = t.redTeamDuration;
  s.flags['redTeamed'] = true;
  return true;
}

const RELEASE_CHOICES = ['c_sage2', 'c_ship_issues', 'c_release'];

export function canRelease(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && !s.training.releasing && !(s.activeChoice && RELEASE_CHOICES.includes(s.activeChoice.id));
}

export function release(s: GameState): boolean {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam' || !canRelease(s)) return false;
  if (run.prologue) return doRelease(s, run, true);
  if (run.issues > 0 && !s.flags['shipIssuesAsked']) {
    openChoice(s, 'c_ship_issues', { runId: run.id, issues: run.issues });
    return true;
  }
  return releaseChecked(s, run);
}

export function releaseChecked(s: GameState, run: TrainingRun): boolean {
  if (s.stage >= 2 && isBought(s, 's2_release_policy')) {
    openChoice(s, 'c_release', { runId: run.id });
    return true;
  }
  if (!s.flags['sage2Decided'] && majorFor(run.capAfter) >= 2) {
    openChoice(s, 'c_sage2', { runId: run.id });
    return true;
  }
  return doRelease(s, run, true);
}

export function doRelease(s: GameState, run: TrainingRun, isPublic: boolean): boolean {
  const t = s.training;
  if (t.run !== run || t.releasing) return false;
  if (run.prologue) return finishRelease(s, run, isPublic);
  t.releasing = { remaining: RELEASE_SECONDS, isPublic };
  t.redTeamRemaining = 0;
  return true;
}

export function releaseProgress(s: GameState): { run: TrainingRun; p: number; left: number; isPublic: boolean } | null {
  const t = s.training;
  if (!t.releasing || !t.run) return null;
  const left = Math.max(0, t.releasing.remaining);
  return { run: t.run, p: 1 - left / RELEASE_SECONDS, left, isPublic: t.releasing.isPublic };
}

function finishRelease(s: GameState, run: TrainingRun, isPublic: boolean): boolean {
  const t = s.training;
  t.releasing = null;
  if (t.run !== run) return false;
  if (run.prologue) return deployFirstModel(s);
  t.run = null;
  t.redTeamRemaining = 0;
  t.major = run.major;
  t.minor = run.minor;
  t.modelName = run.name;
  applyFocusRewards(s, run);
  s.stats.releases += 1;
  s.flags['releasedAt'] = s.stats.timePlayed;
  t.models.push({ name: run.name, capability: run.capAfter, date: s.date, public: isPublic });
  const frontierBefore = Math.max(s.capability, t.internalCapability);
  t.internalCapability = Math.max(t.internalCapability, run.capAfter);
  if (run.capAfter > frontierBefore) applyDrift(s, frontierBefore, run.capAfter, run.focus);
  if (run.focus === 'safety') bump(s, 'safetyReleases');
  if (isPublic) {
    t.deployedName = run.name;
    s.capability = run.capAfter;
    s.hypeBoost = Math.max(s.hypeBoost, 2.0);
    s.stats.publicReleases += 1;
    if (s.stage >= 2) {
      moveTempo(s, 3);
      distill(s);
      if (s.revealed['public']) moveApproval(s, DEPLOY_APPROVAL);
      if (releasesOwed(s) > 0) s.flags['publicReleasesOwed'] = releasesOwed(s) - 1;
    }
    if (s.flags['firstReleaseAt'] === undefined) s.flags['firstReleaseAt'] = s.stats.timePlayed;
    const line = pick(s, RELEASE_LINES).replace('{name}', run.name);
    if (run.issues === 0) {
      s.trust += 1;
      say(s, `${line} +1 Trust.`);
    } else {
      say(s, `${line} No Trust: ${run.issues} open issue${run.issues === 1 ? '' : 's'} shipped.`);
    }
    if (s.insightUnlocked) s.insight += s.stage >= 2 ? RELEASE_INSIGHT_S2 : RELEASE_INSIGHT;
    logNews(s, `OpenMind releases ${run.name}. ${pick(s, RELEASE_HEADLINES)}`);
    if (run.issues > 0) scheduleIncidents(s, run.issues, run.name);
  } else {
    s.researchMult *= 1.25;
    s.lead += 1;
    if (s.stage >= 2) bump(s, 'internalReleases');
    say(s, `${run.name} stays internal. Research runs 25% faster.`);
  }
  bump(s, 'releasesThisStage');
  s.flags['lastReleaseAt'] = s.stats.timePlayed;
  promoteQueued(s);
  return true;
}

function applyFocusRewards(s: GameState, run: TrainingRun): void {
  if (run.focus === 'efficiency') s.copiesPerGPU *= 1.25;
  if (run.focus === 'safety') {
    s.alignmentApparent = Math.min(100, s.alignmentApparent + 8);
    s.alignmentTrue = Math.min(100, s.alignmentTrue + 5);
  }
}

function scheduleIncidents(s: GameState, issues: number, source: string): void {
  const count = Math.min(3, 1 + Math.floor((issues - 1) / 2));
  for (let i = 0; i < count; i++) {
    const inc = pick(s, INCIDENTS);
    s.scheduled.push({ id: inc.id, delay: rand(s, 120, 240), source });
  }
}
