import { GameState, TrainingRun, Focus, Cost, say, logNews, canPay, pay, bump, isBought, counter, press, inPrologue } from './state.js';
import { rng, rand, randInt, chance, pick, poisson } from './rng.js';
import { effGpus, S2_FUNDS_SCALE, poweredGpus, s2Scale, G5_COMPUTE, G6_COMPUTE, ARRIVAL_GPUS } from './infrastructure.js';
import { researchCap, researchRate, rentQuota, atRentQuota } from './economy.js';
import { openChoice, secondsToNextCalendarModal, MODAL_SPACING } from './events.js';
import { TRAINING_FLAVOR, TRAINING_EVENTS, EVALUATOR_LINES, RELEASE_LINES, REDTEAM_LINES, RELEASE_HEADLINES } from '../data/flavor.js';
import { INCIDENTS } from '../data/crises.js';
import { fmtNum, fmtInt, fmtClock } from './format.js';
import { visibleProjects } from './projects.js';
import { crawlRate, synthRate, flywheelRate, moveGov, ADVISORY_BELOW, TRUSTED_FROM } from './world.js';

export const EVAL_SECONDS = 5;
export const BENCHMARKS = ['Coding', 'Research', 'Persuasion', 'Agency', 'Bio', 'Cyber'] as const;
export const EVALUATORS = ['HumanBench', 'Tech press', 'Enterprise analyst', 'Safety Institute'] as const;
const BENCH_WEIGHT = [0.9, 0.6, 0.5, 0.55, 0.3, 0.35];
export const MAJOR_TIERS = [2, 4, 10];
export const S3_RUNGS = [10, 25];
export const NEAR_MISS = 0.97;
export const NEAR_MISS_S3 = NEAR_MISS;
export const FRONTIER_SCORE = 32;
export const RELEASE_INSIGHT = 6;
export const LEADERBOARD_SCORE = 36;
export const RED_TEAM_SECONDS = 8;
export const RED_TEAM_SECONDS_EVALS = 5;
export const RED_TEAM_SECONDS_S2 = 8;
export const RED_TEAM_SECONDS_AUTO = 4;
export const SUPERHUMAN_CODER = 4;
export const OUTSIDE_EVAL_SECONDS = 30;
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
  const t = s.training;
  if (t.pending) return t.pending;
  return t.run && t.run.phase === 'training' ? t.run : null;
}

export function runById(s: GameState, id: unknown): TrainingRun | undefined {
  const t = s.training;
  if (t.run && t.run.id === id) return t.run;
  if (t.pending && t.pending.id === id) return t.pending;
  return undefined;
}

export function startCapability(s: GameState): number {
  const waiting = evalRun(s);
  return Math.max(s.capability, s.training.internalCapability, waiting && waiting.capAfter > 0 ? waiting.capAfter : 0);
}

export function researchFor(c: number, stage = 1): number {
  const raw = 21000 * Math.pow(c / COST_KNEE, 5);
  if (stage >= 3 || raw < 100) return Math.round(raw);
  const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

export const S1_RUN_BASE = 75;
export const S1_RUN_EXPONENT = 11;

export function fundsFor(c: number): number {
  return twoSig(S1_RUN_BASE * Math.pow(Math.max(1, c), S1_RUN_EXPONENT));
}

export function stage2RunFunds(s: GameState, c: number): number {
  return Math.round(fundsForS2(c) * S2_FUNDS_SCALE * s2Scale(s));
}

export const S2_FUNDS_EXPONENT = 7;

export const S2_RUN_BASE = 52000;

export function fundsForS2(c: number): number {
  return Math.round(S2_RUN_BASE * Math.pow(c / COST_KNEE, S2_FUNDS_EXPONENT));
}

export const DATA_BASE = 1.5;

export function dataFor(c: number): number {
  return Math.round(10 * DATA_BASE * Math.pow(c / COST_KNEE, 3)) / 10;
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

export function gpusForS3(c: number): number {
  return twoSig(300000 * Math.pow(Math.max(1, c) / 4, 1.3));
}

export const S3_RUN_BASE = 14000000;
export const S3_RUN_EXPONENT = 3.15;

export const S3_RUN_REF_RATE = 167000;

export function arrivalRunScale(potential: number): number {
  const ratio = Math.max(1, potential) / S3_RUN_REF_RATE;
  const raw = ratio < 1 ? ratio : Math.sqrt(ratio);
  return Math.round(Math.min(1.5, Math.max(0.5, raw)) * 100) / 100;
}

export function runScaleS3(s: GameState): number {
  const v = s.flags['runScaleS3'];
  return typeof v === 'number' && v > 0 ? v : 1;
}

export function researchForS3(c: number, scale = 1): number {
  const raw = S3_RUN_BASE * scale * Math.pow(Math.max(1, c) / 4, S3_RUN_EXPONENT);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / unit) * unit;
}

function twoSig(raw: number): number {
  if (raw < 100) return Math.max(GPU_NEED_BASE, Math.round(raw / 5) * 5);
  const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

export function researchDiverted(s: GameState): number {
  const align = typeof s.flags['alignWorkShare'] === 'number' ? (s.flags['alignWorkShare'] as number) : 0;
  return Math.min(0.9, align + (s.stage === 4 ? s.s4.draftShare : 0));
}

export const GEN_SECONDS = 50;
export const VERIFY_SECONDS = 40;
export const VERIFY_SECONDS_TRUSTED = 20;
export const VERIFY_SECONDS_LAST = 10;
export const GEN_EXPONENT = 2.5;
export const GEN_BASE_SECONDS = 95;
export const S4_RUNGS = [100, 250, 1000];

export function slowBranch(s: GameState): boolean {
  return s.flags['committeeChoice'] === 'slow';
}

export function generationCost(s: GameState): number {
  return generationCostAt(s, s.capability);
}

export function generationCostAt(s: GameState, cap: number): number {
  const c = Math.max(1, cap);
  const raw = Math.max(1, s.s4.genBase) * Math.pow(c / Math.max(1, s.s4.genCap0), GEN_EXPONENT);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / unit) * unit;
}

export function generationGain(s: GameState): number {
  return slowBranch(s) ? 0.44 : 0.42;
}

export function nextGenCap(s: GameState): number {
  const raw = s.capability * (1 + generationGain(s));
  const rung = S4_RUNGS.find((x) => raw < x && raw >= NEAR_MISS * x && s.capability < x);
  return rung ?? raw;
}

export function nextGenVersion(s: GameState): { line: string; major: number; minor: number } {
  const line = typeof s.flags['genLine'] === 'string' ? (s.flags['genLine'] as string) : 'Sage';
  const after = nextGenCap(s);
  const crosses = S4_RUNGS.some((x) => s.capability < x - 1e-9 && after >= x - 1e-9);
  if (line === 'Sage' && s.s4.generations === 0) return { line, major: 5, minor: 0 };
  if (crosses) return { line, major: s.training.major + 1, minor: 0 };
  return { line, major: s.training.major, minor: s.training.minor + 1 };
}

export function genName(v: { line: string; major: number; minor: number }): string {
  return v.minor === 0 ? `${v.line}-${v.major}` : `${v.line}-${v.major}.${v.minor}`;
}

export function nextGenName(s: GameState): string {
  return s.s4.gen ? s.s4.gen.name : genName(nextGenVersion(s));
}

export function verifySeconds(s: GameState): number {
  if (s.flags['lastSignoff'] === true) return VERIFY_SECONDS_LAST;
  return s.alignmentApparent >= 80 ? VERIFY_SECONDS_TRUSTED : VERIFY_SECONDS;
}

export function trainCost(s: GameState): Cost {
  if (s.stage >= 4) return { research: generationCost(s) };
  if (inPrologue(s)) return { funds: PROLOGUE_FUNDS, power: PROLOGUE_POWER };
  const c = startCapability(s);
  if (s.stage < 2) return c < S1_WALL ? { funds: fundsFor(c) } : {};
  if (s.stage >= 3) return { research: researchForS3(c, runScaleS3(s)) };
  if (firstOwnedRun(s)) return { research: researchFor(c) };
  const cost: Cost = { research: researchFor(c), funds: stage2RunFunds(s, c) };
  if (s.flags['dataEra'] === true) cost.data = dataFor(c);
  return cost;
}

export function firstOwnedRun(s: GameState): boolean {
  return s.stage === 2 && counter(s, 'runsS2') < 1;
}

export function gpusNeeded(s: GameState): number {
  if (s.stage >= 4) return 0;
  if (inPrologue(s)) return PROLOGUE_GPUS;
  if (s.stage === 3) return gpusForS3(startCapability(s));
  const c = startCapability(s);
  const n = s.stage === 1 ? gpusForS1(c) : gpusFor(c);
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  const need = mult > 1 ? twoSig(n / mult) : n;
  const built = s.stage === 1 ? c >= S1_WALL : firstOwnedRun(s);
  return built ? Math.min(need, ARRIVAL_GPUS) : need;
}

export function gpusAvailable(s: GameState): number {
  const all = s.stage >= 2 ? Math.floor(effGpus(s)) : s.gpus;
  return Math.max(0, all - busyGpus(s));
}

export function busyGpus(s: GameState): number {
  const r = trainingRun(s);
  return r && r.elapsed < r.duration ? r.gpus ?? 0 : 0;
}

export function gpusShort(s: GameState): boolean {
  return gpusAvailable(s) < gpusNeeded(s);
}

export function trainingDuration(s: GameState): number {
  if (inPrologue(s)) return PROLOGUE_SECONDS;
  const n = Math.max(1, gpusNeeded(s));
  if (s.stage < 2) return Math.min(80, Math.max(45, 45 + 10 * Math.log2(n / 10)));
  if (s.stage >= 3) return Math.min(60, Math.max(30, 30 + 6 * Math.log2(n / 300000)));
  return Math.min(120, Math.max(90, 90 + 8 * Math.log2(n / 1000)));
}

export function atPlateau(s: GameState): boolean {
  if (s.stage < 2) return false;
  return s.revealed['training'] === true && trainSlotFree(s) && (trainCost(s).research ?? 0) > researchCap(s);
}

export function cardWall(s: GameState): boolean {
  if (s.stage !== 1 || !s.revealed['projects']) return false;
  const cap = researchCap(s);
  return visibleProjects(s).some((p) => !p.rescue && (p.cost(s).research ?? 0) > cap);
}

export function cardWallSeconds(s: GameState): number {
  const at = s.flags['cardWallSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

const LAB_CARDS = ['p_lab_cluster', 'p_floor', 'p_desks'];

export function labReason(s: GameState, research: number): string {
  if (s.stage !== 1 || research <= researchCap(s)) return '';
  const cap = researchCap(s);
  const card = visibleProjects(s).find((p) => LAB_CARDS.includes(p.id) && (p.cost(s).research ?? 0) <= cap);
  const fix = s.revealed['expandLab'] ? 'Expand Lab' : card?.title ?? '';
  return `needs a lab that holds ${fmtInt(research)}${fix ? ` — ${fix}` : ''}`;
}

export function plateauSeconds(s: GameState): number {
  const at = s.flags['plateauSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

export function needsDatacenter(s: GameState): boolean {
  return s.stage < 2 && gpusNeeded(s) > MAX_RENT_QUOTA;
}

export function nextRunName(s: GameState): string {
  if (s.stage >= 4) return nextGenName(s);
  if (inPrologue(s)) return PROLOGUE_NAME;
  const v = nextVersion(s);
  return `Sage-${v.major}.${v.minor}`;
}

function nextVersion(s: GameState): { major: number; minor: number } {
  const waiting = evalRun(s);
  if (waiting) return { major: waiting.major, minor: waiting.minor + 1 };
  return { major: s.training.major, minor: s.training.minor + 1 };
}

export function trainBlocker(s: GameState): string {
  const t = s.training;
  if (t.cooldown > 0) return `evaluation month — ${Math.ceil(t.cooldown)} s`;
  const cost = trainCost(s);
  if ((cost.research ?? 0) > researchCap(s)) return `lab holds ${fmtNum(researchCap(s), 0)}`;
  if (cost.data && s.data + 1e-9 < cost.data) return `needs ${fmtNum(cost.data, 1)} T data`;
  return '';
}

export function trainGpuLine(s: GameState): string {
  const need = gpusNeeded(s);
  if (need <= 0) return '';
  const have = gpusAvailable(s);
  if (have >= need) {
    const n = s.stage >= 2 ? twoSig(need / computePerGpu(s)) : need;
    return `Needs ${fmtInt(n)} ${n === 1 ? 'GPU' : 'GPUs'} for ${fmtClock(trainingDuration(s))}`;
  }
  if (s.stage < 2) {
    if (needsDatacenter(s)) return `Needs ${fmtInt(need)} GPUs. The cloud will rent ${fmtInt(rentQuota(s))}. Build the First Datacenter.`;
    if (atRentQuota(s) || need > rentQuota(s)) {
      const card = visibleProjects(s).find((p) => QUOTA_CARD_IDS.includes(p.id));
      return `Needs ${fmtInt(need)} GPUs. The cloud rents ${fmtInt(rentQuota(s))}.${card ? ` ${card.title} adds 20.` : ''}`;
    }
    return `Needs ${fmtInt(need)} GPUs. ${fmtInt(have)} rented. Rent ${fmtInt(need - have)} more.`;
  }
  const dark = Math.max(0, s.gpus - poweredGpus(s));
  const k = computePerGpu(s);
  const needN = twoSig(need / k);
  if (dark > 0 && have / k + dark >= need / k) return `Needs ${fmtInt(needN)} powered GPUs. ${fmtInt(dark)} are dark: add power.`;
  return `Needs ${fmtInt(needN)} GPUs. ${fmtInt(Math.floor(have / k))} free.`;
}

export function trainGpuFigures(s: GameState): { need: number; have: number } {
  const need = gpusNeeded(s);
  if (need <= 0) return { need: 0, have: 0 };
  const have = gpusAvailable(s);
  if (s.stage < 2) return { need, have };
  const k = computePerGpu(s);
  return { need: twoSig(need / k), have: Math.floor(have / k) };
}

export function trainGpuFix(s: GameState): string {
  const need = gpusNeeded(s);
  if (need <= 0 || gpusAvailable(s) >= need) return '';
  if (s.stage < 2) {
    if (needsDatacenter(s)) return `The cloud will rent ${fmtInt(rentQuota(s))}. Build the First Datacenter.`;
    if (atRentQuota(s) || need > rentQuota(s)) {
      const card = visibleProjects(s).find((p) => QUOTA_CARD_IDS.includes(p.id));
      return `The cloud rents ${fmtInt(rentQuota(s))}.${card ? ` ${card.title} adds 20.` : ''}`;
    }
    return '';
  }
  if (s.stage >= 3) return trainGpuLine(s);
  const dark = Math.max(0, s.gpus - poweredGpus(s));
  const k = computePerGpu(s);
  return dark > 0 && gpusAvailable(s) / k + dark >= need / k ? `${fmtInt(dark)} GPUs are dark: add power.` : '';
}

export function computePerGpu(s: GameState): number {
  if (s.stage < 2 || s.gpus <= 0) return 1;
  const g6 = s.gpusG6 ?? 0;
  const g5 = s.gpusG5 ?? 0;
  const g4 = Math.max(0, s.gpus - g5 - g6);
  return (g4 + G5_COMPUTE * g5 + G6_COMPUTE * g6) / s.gpus;
}

export const MAX_RENT_QUOTA = 140;

const QUOTA_CARD_IDS = ['p_compute_deal', 'p_region', 'p_reserved'];

const RUN_FIXES = ['p_research_cluster', 'p_exp_scheduler', 'p_checkpoint_farm', 'p_lab_cluster', 'p_floor', 'p_desks', 'p_ai_assistants', 'p_synth', 'p_license_code', 'p_license_archive', 'p_beg_data'];

export function runFixNames(s: GameState): string {
  const names = visibleProjects(s)
    .filter((p) => RUN_FIXES.includes(p.id) && (p.rescue || p.urgent?.(s) === true))
    .map((p) => p.title);
  if (atPlateau(s) && s.revealed['expandLab'] && s.trust >= 1) names.push('Expand Lab');
  return names.join(', ');
}

export function trainSlotFree(s: GameState): boolean {
  const t = s.training;
  if (t.pending) return false;
  if (!t.run) return true;
  return t.run.phase !== 'training' && isBought(s, 'p_parallel');
}

export function runOtherwiseReady(s: GameState): boolean {
  if (!s.revealed['training'] || !trainSlotFree(s) || s.training.cooldown > 0 || gpusShort(s)) return false;
  const cost = trainCost(s);
  return s.research >= (cost.research ?? 0) && s.data + 1e-9 >= (cost.data ?? 0);
}

export function trainRequirementsMet(s: GameState): boolean {
  if (!s.revealed['training'] || !trainSlotFree(s) || s.training.cooldown > 0 || gpusShort(s)) return false;
  if (s.stage >= 3 && s.flags['holdRuns'] === true) return false;
  if (s.stage < 3 && (trainCost(s).research ?? 0) > researchCap(s)) return false;
  return true;
}

export function canStartTraining(s: GameState): boolean {
  return trainRequirementsMet(s) && canPay(s, trainCost(s));
}

export function canPressTrain(s: GameState): boolean {
  if (s.stage >= 3 && isBought(s, 'p_auto_train')) return false;
  return trainRequirementsMet(s);
}

export function setFocus(s: GameState, focus: Focus): boolean {
  if (focus !== 'capability' && focus !== 'efficiency' && focus !== 'safety') return false;
  if (!s.revealed['focus']) return false;
  s.training.focus = focus;
  return true;
}

export function startTraining(s: GameState): boolean {
  if (!canStartTraining(s)) return false;
  if (s.stage >= 3 && !isBought(s, 'p_auto_train')) press(s, 'train');
  return startRun(s, trainCost(s));
}

function runIncome(s: GameState): { funds: number; research: number; data: number } {
  const share = (s.stage === 2 || s.stage === 3) && s.revealed['infrastructure'] ? s.buildShare : 0;
  return {
    funds: Math.max(0, s.stats.revPerSec) * (1 - share),
    research: researchRate(s),
    data: s.stage === 2 ? crawlRate(s) + synthRate(s) + flywheelRate(s) : 0,
  };
}

function etaOf(short: number, rate: number): number {
  if (short <= 1e-9) return 0;
  return rate > 0 ? short / rate : Infinity;
}

function runPaidIn(s: GameState, spent: Cost = {}): number {
  const cost = trainCost(s);
  const r = runIncome(s);
  return Math.max(
    etaOf((cost.funds ?? 0) - (s.funds - (spent.funds ?? 0)), r.funds),
    etaOf((cost.research ?? 0) - (s.research - (spent.research ?? 0)), r.research),
    etaOf((cost.data ?? 0) - (s.data - (spent.data ?? 0)), r.data),
    etaOf((cost.power ?? 0) - (s.power - (spent.power ?? 0)), 0),
  );
}

export function waitingGoalS1(s: GameState): { name: string; funds: number } | null {
  if (s.stage !== 1 || !s.revealed['training']) return null;
  if (needsDatacenter(s)) {
    const dc = visibleProjects(s).find((p) => p.id === 'p_datacenter');
    return dc ? { name: 'First Datacenter', funds: dc.cost(s).funds ?? 0 } : null;
  }
  if (!trainSlotFree(s) || s.training.cooldown > 0) return null;
  return { name: nextRunName(s), funds: trainCost(s).funds ?? 0 };
}

export function runDelaySeconds(s: GameState, cost: Cost): number {
  if (s.stage === 1) {
    const goal = waitingGoalS1(s);
    if (!goal || !cost.funds) return 0;
    const rate = Math.max(0, s.stats.revPerSec);
    const before = etaOf(goal.funds - s.funds, rate);
    const after = etaOf(goal.funds - (s.funds - cost.funds), rate);
    if (!Number.isFinite(after)) return Number.isFinite(before) ? Infinity : 0;
    return Math.max(0, after - before);
  }
  if (s.stage === 4) {
    if (!cost.research) return 0;
    const rate = Math.max(1, researchRate(s) * (1 - researchDiverted(s)));
    const g = s.s4.gen;
    const need = g ? generationCostAt(s, g.capAfter) : generationCost(s);
    const wait = g ? g.remaining + (g.phase === 'training' && s.s4.verifyOn ? verifySeconds(s) : 0) : 0;
    const have = s.research + rate * wait;
    const before = Math.max(0, need - have) / rate;
    const after = Math.max(0, need - (have - cost.research)) / rate;
    return Math.max(0, after - before);
  }
  if (!s.revealed['training'] || s.stage >= 4 || !trainSlotFree(s) || s.training.cooldown > 0) return 0;
  if (s.stage >= 3 && s.flags['holdRuns'] === true) return 0;
  const before = runPaidIn(s);
  const after = runPaidIn(s, cost);
  if (!Number.isFinite(after)) return Infinity;
  return Math.max(0, after - before);
}

export function delayNote(s: GameState, cost: Cost): string {
  if (cost.research && researchStopped(s)) return '';
  const d = runDelaySeconds(s, cost);
  if (d < 10) return '';
  if (s.stage === 4) return ` · delays ${nextGenName(s)} by ${Number.isFinite(d) && d < 3600 ? fmtClock(d) : 'much'}`;
  const name = s.stage === 1 ? waitingGoalS1(s)?.name ?? nextRunName(s) : s.stage >= 3 ? 'next run' : nextRunName(s);
  return ` · ${name} ${Number.isFinite(d) && d < 3600 ? fmtClock(d) : 'much'} later`;
}

function startRun(s: GameState, cost: Cost): boolean {
  if (inPrologue(s)) return startPrologueRun(s, cost);
  const t = s.training;
  const gpus = gpusNeeded(s);
  const serving = Math.max(0, gpusAvailable(s) - gpus);
  const duration = Math.round(trainingDuration(s));
  const capBefore = startCapability(s);
  const version = nextVersion(s);
  const synthetic = cost.data && s.data > 0 ? Math.min(1, s.dataSynthetic / s.data) : 0;
  pay(s, cost);
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
    gainBonus: 0,
    capMult: 1,
    benchBonus: [0, 0, 0, 0, 0, 0],
    benchmarks: [],
    scores: [],
    issues: 0,
    issuesFound: 0,
    extraIssues: 0,
    major: version.major,
    minor: version.minor,
    syntheticShare: synthetic,
    alignShare: s.alignShare,
  };
  if (s.stage >= 3) {
    run.gainBonus += Math.min(EXPERIMENTS_MAX, counter(s, 'expPts')) / 100;
    s.flags['expPts'] = 0;
    run.probeFlags = 0;
  }
  if (t.run) t.pending = run;
  else t.run = run;
  t.runIndex += 1;
  s.stats.trainings += 1;
  if (s.stage >= 2) s.revealed['copies'] = true;
  if (run.focus === 'safety') bump(s, 'safetyRuns');
  if (!(s.stage >= 3 && isBought(s, 'p_auto_train'))) say(s, `Training ${run.name} on ${fmtInt(gpus)} GPUs; ${fmtInt(serving)} keep serving.`);
  if (s.stage === 2) startedInStage2(s, run);
  return true;
}

function startPrologueRun(s: GameState, cost: Cost): boolean {
  const t = s.training;
  if (t.run || t.pending) return false;
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
    syntheticShare: 0,
    alignShare: s.alignShare,
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
  t.releaseWait = 0;
  delete s.flags['prologue'];
  s.flags['sageLiveAt'] = s.stats.timePlayed;
  say(s, `${PROLOGUE_NAME} is live. Each GPU runs a copy; each copy completes a task a second.`);
  return true;
}

function startedInStage2(s: GameState, run: TrainingRun): void {
  bump(s, 'runsS2');
  if (s.flags['dataEra'] !== true) {
    s.flags['dataEra'] = true;
    say(s, 'The run after this one will want data. The lab has none it has not used.');
  }
  if (run.focus === 'capability' && run.capBefore >= 2.5 && s.flags['evalsMonthDue'] === undefined) {
    s.flags['evalsMonthDue'] = true;
  }
}

export function finishTraining(s: GameState): boolean {
  const run = trainingRun(s) ?? s.training.run;
  if (!run) return false;
  if (run.phase === 'training') run.elapsed = run.duration;
  else if (run.phase === 'evaluating') run.evalElapsed = EVAL_SECONDS;
  else if (s.training.releasing) s.training.releasing.remaining = 0;
  else return false;
  return true;
}

export function updateTraining(s: GameState, dt: number): void {
  const t = s.training;
  if (t.cooldown > 0) {
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.cooldown <= 0) say(s, 'The evaluation month is over. Training can resume.');
  }
  if (t.releaseWait > 0) {
    t.releaseWait = Math.max(0, t.releaseWait - dt);
    if (t.releaseWait <= 0 && t.run?.phase === 'redteam') say(s, `The outside evaluators sign off. ${t.run.name} can ship.`);
  }
  if (t.releasing) {
    t.releasing.remaining -= dt;
    if (t.releasing.remaining <= 0) {
      if (t.run) finishRelease(s, t.run, t.releasing.isPublic);
      else t.releasing = null;
    }
  }
  const run = t.run;
  if (run?.phase === 'training') updateRunning(s, run, dt, true);
  else if (run?.phase === 'evaluating') {
    run.evalElapsed += dt;
    if (run.evalElapsed >= EVAL_SECONDS) finishEvaluation(s, run);
  }
  if (t.pending) updateRunning(s, t.pending, dt, false);
  if (t.redTeamRemaining > 0) {
    t.redTeamRemaining -= dt;
    if (t.redTeamRemaining <= 0) {
      t.redTeamRemaining = 0;
      const r = t.run;
      if (r && r.phase === 'redteam' && r.issues > 0) {
        r.issues -= 1;
        if (r.issues === 0) {
          if (s.stage === 1) logNews(s, pick(s, REDTEAM_LINES));
          say(s, `Red team signs off. Ready to ${s.stage >= 3 ? 'approve' : 'release'}.`);
        } else if (s.stage === 2) say(s, `${pick(s, REDTEAM_LINES)} ${r.issues} open.`);
      }
    }
  }
}

function updateRunning(s: GameState, run: TrainingRun, dt: number, slotFree: boolean): void {
  if (run.elapsed < run.duration) {
    run.elapsed += dt;
    const progress = run.elapsed / run.duration;
    if (run.flavorShown < 1 && progress >= 0.5 && s.stage < 3) {
      const pool = TRAINING_FLAVOR[1] ?? [];
      run.flavorShown = 1;
      if (pool.length) say(s, pick(s, pool));
    }
    if (run.gambleAt >= 0 && run.gamble === 'none' && progress >= run.gambleAt) offerGamble(s, run);
    if (run.eventAt >= 0 && !run.eventId && progress >= run.eventAt) applyTrainingEvent(s, run);
  }
  if (run.elapsed >= run.duration) {
    run.elapsed = run.duration;
    if (!slotFree) {
      const key = `waitSaid:${run.id}`;
      if (!s.flags[key]) {
        s.flags[key] = true;
        say(s, `${run.name} is trained. It waits until ${s.training.run?.name ?? 'the last model'} ships.`);
      }
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
    if (!(run.sentBack && run.capAfter > 0)) computeResults(s, run);
    if (s.stage === 2) say(s, `Training complete. Evaluating ${run.name}.`);
  }
}

export const GAMBLES_PER_STAGE = 3;

function offerGamble(s: GameState, run: TrainingRun): void {
  if (s.stage >= 3) {
    run.gamble = 'declined';
    return;
  }
  const last = s.flags['lastGambleRun'];
  const count = (s.flags['gamblesThisStage'] as number) || 0;
  let rested = s.stage === 1 && run.id <= 1 ? false : typeof last !== 'number' || run.id - last >= 2;
  let allowed = count < GAMBLES_PER_STAGE;
  if (s.stage >= 2) {
    rested = true;
    allowed = count < 1 && run.focus === 'capability' && run.capBefore >= 2.2;
  }
  const clear = secondsToNextCalendarModal(s) >= MODAL_SPACING;
  if (allowed && rested && clear && openChoice(s, 'c_gamble', { runId: run.id }, { onlyIfFree: true })) {
    run.gamble = 'offered';
    s.flags['gamblesThisStage'] = count + 1;
    s.flags['lastGambleRun'] = run.id;
  } else {
    run.gamble = 'declined';
    if (s.stage >= 2 && allowed) s.flags['gamblesThisStage'] = 1;
  }
}

function applyTrainingEvent(s: GameState, run: TrainingRun): void {
  const ev = pick(s, TRAINING_EVENTS);
  run.eventId = ev.id;
  let bench = -1;
  switch (ev.id) {
    case 'loss_spike':
      run.duration = s.stage >= 2 ? Math.min(120, run.duration + 10) : run.duration + 10;
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
  if (s.stage === 1) logNews(s, numbered[ev.id] ?? ev.line);
  else say(s, numbered[ev.id] ?? ev.line);
}

export function focusBase(s: GameState, run: TrainingRun): number {
  if (s.stage >= 3) return (run.focus === 'capability' ? 0.16 + 0.03 * (rng(s) + rng(s)) : 0.1) * thoughtsGain(s) * stepFactors(s).gain;
  if (s.stage >= 2) return run.focus === 'capability' ? 0.07 + 0.015 * (rng(s) + rng(s)) : 0.07;
  return run.focus === 'capability' ? 0.10 + 0.02 * (rng(s) + rng(s)) : 0.05;
}

function computeResults(s: GameState, run: TrainingRun): void {
  const gain = (focusBase(s, run) + run.gainBonus + s.training.frontierBonus) * run.capMult;
  run.capAfter = run.capBefore * (1 + gain);
  if (s.stage === 2) {
    const tier = MAJOR_TIERS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS * x && run.capBefore < x);
    if (tier) run.capAfter = tier;
  }
  if (s.stage >= 3) {
    const rung = S3_RUNGS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS_S3 * x && run.capBefore < x);
    if (rung) run.capAfter = rung;
  }
  run.benchmarks = BENCHMARKS.map((_, i) => {
    const base = 10 * (1 - Math.exp(-run.capAfter * BENCH_WEIGHT[i]! * 0.8));
    const noisy = base + rand(s, -0.4, 0.4) + run.benchBonus[i]!;
    return Math.round(Math.min(10, Math.max(0, noisy)) * 10) / 10;
  });
  const lambda = s.stage >= 3
    ? Math.min(4, Math.max(0.3, 1 + 0.5 * Math.log2(run.capAfter / 4) + (s.flags['neuralese'] === 'neuralese' ? 1 : 0) - (run.focus === 'safety' ? 1 : 0)))
    : Math.max(0.3, 2 + run.capAfter / 3 - safetyInvestment(s, run));
  run.issuesFound = poisson(s, lambda) + run.extraIssues;
  run.issues = run.issuesFound;
  if (s.stage >= 3 && isBought(s, 'p_interp2')) {
    run.probeFlags = Math.min(5, Math.max(0, Math.round((70 - s.alignmentTrue) / 15 + rand(s, -1, 1))));
  }
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
  let v = (run.focus === 'safety' ? 1.5 : 0) + (isBought(s, 'p_eval_team') ? 0.5 : 0) + (isBought(s, 'p_alignment_team') ? 1 : 0);
  v += 0.5 * counter(s, 'safetyReleases');
  if (s.stage >= 2 && isBought(s, 'p_auto_evals')) v += 0.5;
  return v;
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
  const renamed = s.flags[`renamedFrom:${run.id}`];
  if (typeof renamed === 'string') {
    delete s.flags[`renamedFrom:${run.id}`];
    say(s, `${renamed} is good enough to be called ${run.name}.`);
  }
  const frontier = total >= FRONTIER_SCORE ? ' Frontier model.' : '';
  if (s.stage < 3) say(s, `Evaluation done.${frontier} ${issueWords(run.issuesFound)}`);
  s.training.frontierBonus = total >= FRONTIER_SCORE ? 0.01 : 0;
  if (total >= LEADERBOARD_SCORE) s.flags['leaderboardEligible'] = true;
  const maxBench = Math.max(...run.benchmarks);
  if (maxBench > ((s.flags['maxBenchmark'] as number) || 0)) s.flags['maxBenchmark'] = maxBench;
  if (s.stage >= 3) {
    readyInStage3(s, run);
    return;
  }
  if (s.stage === 2 && run.capAfter >= SUPERHUMAN_CODER) {
    if (!s.flags['sage3Said']) {
      s.flags['sage3Said'] = true;
      say(s, `${run.name} writes better code than anyone at OpenMind. The evals team ran the test twice.`);
    }
    if (s.flags['pactSigned'] === true) {
      s.training.releaseWait = OUTSIDE_EVAL_SECONDS;
      say(s, `Outside evaluation — 0:30 until ${run.name} can ship.`);
    }
  }
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function issueWords(n: number): string {
  const count = n < WORDS.length ? WORDS[n]! : String(n);
  return n === 0 ? 'No issues for the red team.' : `${count} issue${n === 1 ? '' : 's'} for the red team.`;
}

export function canRedTeam(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && run.issues > 0 && s.training.redTeamRemaining <= 0 && !s.training.releasing;
}

export function redTeamSeconds(s: GameState): number {
  if (s.stage >= 3) return RED_TEAM_SECONDS_AUTO;
  if (s.stage >= 2) return isBought(s, 'p_auto_evals') ? RED_TEAM_SECONDS_AUTO : RED_TEAM_SECONDS_S2;
  return isBought(s, 'p_eval_team') ? RED_TEAM_SECONDS_EVALS : RED_TEAM_SECONDS;
}

export function redTeam(s: GameState): boolean {
  if (!canRedTeam(s)) return false;
  if (s.stage >= 3) press(s, 'redteam');
  const t = s.training;
  t.redTeamDuration = redTeamSeconds(s);
  t.redTeamRemaining = t.redTeamDuration;
  s.flags['redTeamed'] = true;
  return true;
}

const RELEASE_CHOICES = ['c_sage2', 'c_ship_issues'];

export function canRelease(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && !s.training.releasing && !(s.activeChoice && RELEASE_CHOICES.includes(s.activeChoice.id));
}

export function canReleasePublic(s: GameState): boolean {
  return canRelease(s) && s.training.releaseWait <= 0;
}

export function release(s: GameState): boolean {
  if (s.stage >= 3) return approve(s);
  const run = s.training.run;
  if (!run || run.phase !== 'redteam' || !canReleasePublic(s)) return false;
  if (run.prologue) return doRelease(s, run, true);
  if (run.issues > 0 && !s.flags['shipIssuesAsked']) {
    openChoice(s, 'c_ship_issues', { runId: run.id, issues: run.issues });
    return true;
  }
  return releaseChecked(s, run);
}

export function releaseInternal(s: GameState): boolean {
  const run = s.training.run;
  if (s.stage !== 2 || !s.revealed['releaseInternal'] || !run || run.prologue || !canRelease(s)) return false;
  return doRelease(s, run, false);
}

export function releaseChecked(s: GameState, run: TrainingRun): boolean {
  if (!s.flags['sage2Decided'] && majorFor(run.capAfter) >= 2) {
    openChoice(s, 'c_sage2', { runId: run.id });
    return true;
  }
  return doRelease(s, run, true);
}

export function doRelease(s: GameState, run: TrainingRun, isPublic: boolean): boolean {
  const t = s.training;
  if (t.run !== run || t.releasing) return false;
  if (s.stage >= 3 || run.prologue) return finishRelease(s, run, isPublic);
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
  t.releaseWait = 0;
  t.major = run.major;
  t.minor = run.minor;
  t.modelName = run.name;
  applyFocusRewards(s, run);
  s.stats.releases += 1;
  s.flags['releasedAt'] = s.stats.timePlayed;
  t.models.push({ name: run.name, capability: run.capAfter, date: s.date, public: isPublic });
  t.internalCapability = Math.max(t.internalCapability, run.capAfter);
  if (s.stage >= 2) s.revealed['focus'] = true;
  if (s.stage === 2) releasedInStage2(s, run, isPublic);
  if (run.focus === 'safety' && s.stage < 3) bump(s, 'safetyReleases');
  if (s.stage >= 3) {
    approvedInStage3(s, run);
  } else if (isPublic) {
    t.deployedName = run.name;
    s.capability = run.capAfter;
    s.hypeBoost = Math.max(s.hypeBoost, 2.0);
    s.stats.publicReleases += 1;
    if (s.flags['firstReleaseAt'] === undefined) s.flags['firstReleaseAt'] = s.stats.timePlayed;
    const line = pick(s, RELEASE_LINES).replace('{name}', run.name);
    if (run.issues === 0) {
      s.trust += 1;
      say(s, `${line} +1 Trust.`);
    } else {
      say(s, `${line} No Trust: ${run.issues} open issue${run.issues === 1 ? '' : 's'} shipped.`);
    }
    if (s.stage < 3 && s.insightUnlocked) s.insight += RELEASE_INSIGHT;
    logNews(s, `OpenMind releases ${run.name}. ${pick(s, RELEASE_HEADLINES)}`);
    if (run.issues > 0) scheduleIncidents(s, run.issues, run.name);
  } else if (s.stage >= 2) {
    const first = counter(s, 'internalReleases') === 1;
    if (first) s.researchMult *= 1.25;
    say(s, first
      ? `${run.name} stays internal. Research runs 25% faster; customers keep ${t.deployedName}.`
      : `${run.name} stays internal. The research copies run it; customers keep ${t.deployedName}.`);
  } else {
    s.researchMult *= 1.25;
    s.lead += 1;
    say(s, `${run.name} stays internal. Research runs 25% faster.`);
  }
  bump(s, 'releasesThisStage');
  s.flags['lastReleaseAt'] = s.stats.timePlayed;
  if (t.pending) {
    t.run = t.pending;
    t.pending = null;
  }
  return true;
}

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

function releasedInStage2(s: GameState, run: TrainingRun, isPublic: boolean): void {
  const superhuman = run.capAfter >= SUPERHUMAN_CODER;
  if (run.focus === 'capability' && run.capBefore >= 2) s.alignmentTrue = clamp100(s.alignmentTrue - 2);
  if (run.focus === 'efficiency') s.alignmentTrue = clamp100(s.alignmentTrue - 0.5);
  if (run.focus === 'safety') bump(s, 'safetyReleasesS2');
  if (run.issuesFound > 0 && run.issues === 0) s.alignmentApparent = clamp100(s.alignmentApparent + 1);
  if (run.syntheticShare > 0.5) s.alignmentTrue = clamp100(s.alignmentTrue - 2);
  if (run.alignShare >= 0.1 - 1e-9) {
    s.alignmentApparent = clamp100(s.alignmentApparent + 1);
    s.alignmentTrue = clamp100(s.alignmentTrue + 2);
  } else if (run.alignShare >= 0.05 - 1e-9) {
    s.alignmentApparent = clamp100(s.alignmentApparent + 0.5);
    s.alignmentTrue = clamp100(s.alignmentTrue + 1);
  }
  if (isPublic) {
    s.lead -= 0.15;
    if (run.issues > 0) s.alignmentTrue = clamp100(s.alignmentTrue - run.issues);
    if (s.shareEvals) {
      moveGov(s, 1);
      s.alignmentApparent = clamp100(s.alignmentApparent + 1);
      s.lead -= 0.1;
    }
    if (superhuman && !s.flags['sage3Released']) {
      s.flags['sage3Released'] = 'public';
      s.lead -= 0.5;
    }
    if (run.capAfter >= 3 && s.alignmentApparent < ADVISORY_BELOW) s.scheduled.push({ id: 'inc_advisory', delay: 20, source: run.name });
    if (s.alignmentApparent >= TRUSTED_FROM) moveGov(s, 1);
  } else {
    bump(s, 'internalReleases');
    s.lead += superhuman ? 1 : 0.5;
    if (superhuman && !s.flags['sage3Released']) s.flags['sage3Released'] = 'internal';
  }
  if (superhuman) s.flags['superhumanReleased'] = true;
}

export function efficiencyStep(s: GameState): number {
  if (s.stage >= 3) return 1.2;
  return s.stage >= 2 ? 1.15 : 1.25;
}

export function focusChange(s: GameState, run: TrainingRun): string {
  if (run.focus === 'efficiency') return `copies per GPU ${fmtNum(s.copiesPerGPU, 2)} → ${fmtNum(s.copiesPerGPU * efficiencyStep(s), 2)}`;
  if (run.focus === 'safety') return `measured alignment ${Math.round(s.alignmentApparent)} → ${Math.round(Math.min(100, s.alignmentApparent + safetyMeasured(s)))}`;
  return `capability ${fmtNum(run.capBefore, 2)}× → ${fmtNum(run.capAfter, 2)}×`;
}

function safetyMeasured(s: GameState): number {
  return s.stage >= 3 ? 6 : 8;
}

function applyFocusRewards(s: GameState, run: TrainingRun): void {
  if (run.focus === 'efficiency') s.copiesPerGPU *= efficiencyStep(s);
  if (run.focus === 'safety') {
    s.alignmentApparent = Math.min(100, s.alignmentApparent + safetyMeasured(s));
    if (!run.sentBack) s.alignmentTrue = Math.min(100, s.alignmentTrue + (s.stage >= 3 ? 4 : 5));
  }
}

function scheduleIncidents(s: GameState, issues: number, source: string): void {
  const count = Math.min(3, 1 + Math.floor((issues - 1) / 2));
  for (let i = 0; i < count; i++) {
    const inc = pick(s, INCIDENTS);
    s.scheduled.push({ id: inc.id, delay: rand(s, 120, 240), source });
  }
}

export function superhumanTooltips(s: GameState): { release: string; internal: string } | null {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam' || run.capAfter < SUPERHUMAN_CODER) return null;
  return {
    release: 'Every engineer on Earth gets a colleague who does not sleep. Market grows; approval −6; lead −0.5 months.',
    internal: `OpenMind keeps the only one. Research takes it at once; lead +1 month; the public keeps ${s.training.deployedName}.`,
  };
}

export function thoughtsGain(s: GameState): number {
  const n = s.flags['neuralese'];
  return n === 'neuralese' ? 1.3 : n === 'transparent' ? 0.9 : 1;
}

export type StepSize = 'small' | 'normal' | 'large';

export function stepFactors(s: GameState): { gain: number; loss: number } {
  const v = s.flags['stepSize'];
  if (v === 'small') return { gain: 0.6, loss: 0.3 };
  if (v === 'large') return { gain: 1.3, loss: 1.5 };
  return { gain: 1, loss: 1 };
}

export type RedteamDepth = 'quick' | 'thorough';

export function redteamDepth(s: GameState): RedteamDepth {
  return s.flags['redteamDepth'] === 'thorough' ? 'thorough' : 'quick';
}

export const THOROUGH_SECONDS = 15;
export const SEND_BACK_SECONDS = 20;
export const EXPERIMENTS_MAX = 5;
export const RESEARCH_UNIT_SHARE = 0.02;

export function autoApproveOn(s: GameState): boolean {
  return s.stage >= 3 && isBought(s, 'p_auto_approve') && s.flags['conceded'] !== true;
}

export function runReady(s: GameState): boolean {
  const run = s.training.run;
  return s.stage >= 3 && !!run && run.phase === 'redteam' && !((run.reviewLeft ?? 0) > 0);
}

export function canApprove(s: GameState): boolean {
  return runReady(s) && !autoApproveOn(s);
}

export function approve(s: GameState): boolean {
  if (!canApprove(s)) return false;
  press(s, 'approve');
  return doRelease(s, s.training.run!, true);
}

export function canSendBack(s: GameState): boolean {
  const run = s.training.run;
  return canApprove(s) && !!run && isBought(s, 'p_interp2') && (run.probeFlags ?? 0) > 0 && !run.sentBack;
}

export function sendBack(s: GameState): boolean {
  if (!canSendBack(s)) return false;
  const run = s.training.run!;
  const gain = run.capAfter / run.capBefore - 1;
  run.capAfter = run.capBefore * (1 + 0.7 * gain);
  const rung = S3_RUNGS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS_S3 * x && run.capBefore < x);
  if (rung) run.capAfter = rung;
  const m = majorFor(run.capAfter);
  if (m < run.major) {
    run.major = m;
    run.minor = (s.training.major === m ? s.training.minor : 0) + 1;
    run.name = `Sage-${m}.${run.minor}`;
  }
  run.sentBack = true;
  run.probeFlags = 0;
  run.phase = 'training';
  run.elapsed = 0;
  run.duration = SEND_BACK_SECONDS;
  run.evalElapsed = 0;
  s.training.redTeamRemaining = 0;
  s.lead = Math.max(-2, s.lead - 0.1);
  press(s, 'sendBack');
  say(s, `${run.name} sent back — 0:20 of retraining. It keeps 70% of its gain.`);
  return true;
}

export function toggleHold(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['holdRuns']) return false;
  const held = s.flags['holdRuns'] !== true;
  s.flags['holdRuns'] = held;
  s.flags['holdSaidAt'] = s.stats.timePlayed;
  press(s, 'hold');
  say(s, held ? 'Training held. No run starts until it is released.' : 'Training running. The next run starts when it is ready.');
  return true;
}

export function setStepSize(s: GameState, v: StepSize): boolean {
  if (s.stage < 3 || !s.revealed['stepSize'] || !autoApproveOn(s)) return false;
  if (v !== 'small' && v !== 'normal' && v !== 'large') return false;
  if (s.flags['stepSize'] === v || (v === 'normal' && s.flags['stepSize'] === undefined)) return false;
  s.flags['stepSize'] = v;
  press(s, 'stepSize');
  return true;
}

export function setRedteamDepth(s: GameState, v: RedteamDepth): boolean {
  if (s.stage < 3 || !s.revealed['redteamDepth']) return false;
  if (v !== 'quick' && v !== 'thorough') return false;
  if (redteamDepth(s) === v) return false;
  s.flags['redteamDepth'] = v;
  press(s, 'redteamDepth');
  return true;
}

export function researchUnit(s: GameState): number {
  return Math.max(1, Math.round(RESEARCH_UNIT_SHARE * (trainCost(s).research ?? 0)));
}

export function delaySeconds(s: GameState, research: number): number {
  const need = trainCost(s).research ?? 0;
  const short = Math.max(0, need - s.research);
  const after = Math.max(0, need - (s.research - research));
  return Math.max(0, (after - short) / Math.max(1, researchRate(s)));
}

export function runExperiments(s: GameState, units = 1): boolean {
  if (s.stage < 3 || !s.revealed['experiments']) return false;
  const room = EXPERIMENTS_MAX - counter(s, 'expPts');
  const n = Math.min(units, Math.floor(room / 0.25 + 1e-9));
  if (n <= 0) return false;
  const cost = n * researchUnit(s);
  if (s.research < cost) return false;
  s.research -= cost;
  s.flags['expPts'] = counter(s, 'expPts') + 0.25 * n;
  press(s, 'experiments');
  return true;
}

export function nextGainPct(s: GameState, extraPts = 0): number {
  const base = (s.training.focus === 'capability' ? 0.19 : 0.1) * thoughtsGain(s) * stepFactors(s).gain;
  return 100 * base + Math.min(EXPERIMENTS_MAX, counter(s, 'expPts') + extraPts);
}

function readyInStage3(s: GameState, run: TrainingRun): void {
  if (isBought(s, 'p_auto_redteam') && redteamDepth(s) === 'thorough') run.reviewLeft = THOROUGH_SECONDS;
  const flags = isBought(s, 'p_interp2') ? ` · probe flags: ${run.probeFlags ?? 0}` : '';
  const issues = run.issues === 0 ? 'no issues open' : `${run.issues} issue${run.issues === 1 ? '' : 's'} open`;
  if (!autoApproveOn(s)) say(s, `${run.name} ready — ${fmtNum(run.capAfter, 2)}× · ${issues}${flags}`);
}

const clampTrue = (v: number) => Math.min(100, Math.max(0, v));

function approvedInStage3(s: GameState, run: TrainingRun): void {
  const t = s.training;
  const auto = autoApproveOn(s);
  const before = s.capability;
  t.deployedName = run.name;
  s.capability = run.capAfter;
  s.hypeBoost = Math.max(s.hypeBoost, 1.5);
  s.stats.publicReleases += 1;
  const neuralese = s.flags['neuralese'] === 'neuralese';
  let change = 0;
  if (run.sentBack) change = 1;
  else if (run.focus === 'capability') change = -(neuralese ? 3 : 2) * stepFactors(s).loss;
  else if (run.focus === 'efficiency') change = -0.5;
  if (s.monitorShare >= 0.15 - 1e-9) change += 1;
  if (auto) change -= 1;
  change -= 0.5 * run.issues;
  s.alignmentTrue = clampTrue(s.alignmentTrue + change);
  if (s.shareEvals) {
    s.alignmentApparent = clampTrue(s.alignmentApparent + 1);
    moveGov(s, 1);
  }
  if (s.alignmentApparent >= 80) moveGov(s, 1);
  else if (s.alignmentApparent < 55) s.scheduled.push({ id: 'inc_advisory', delay: 20, source: run.name });
  bump(s, 'approvalsS3');
  logNews(s, `${run.name} deployed. ${fmtNum(run.capAfter, 1)}×.`);
  if (run.issues > 0) {
    say(s, `${run.name} deployed with ${run.issues} open issue${run.issues === 1 ? '' : 's'}.`);
    scheduleIncidents(s, run.issues, run.name);
  }
  if (before < 10 && run.capAfter >= 10) {
    say(s, 'Sage-4. A year of progress every month.');
    s.flags['crossed10At'] = s.stats.timePlayed;
  }
  if (before < 25 && run.capAfter >= 25) {
    say(s, `${run.name} is a better AI researcher than anyone alive. It has started on its successor's design.`);
    s.flags['crossed25At'] = s.stats.timePlayed;
  }
  s.flags['graphDirty'] = true;
}

export function updateTakeoffTraining(s: GameState, dt: number): void {
  if (s.stage < 3) return;
  const run = s.training.run;
  if (run && run.phase === 'redteam' && (run.reviewLeft ?? 0) > 0) {
    run.reviewLeft = Math.max(0, (run.reviewLeft ?? 0) - dt);
    if (run.reviewLeft <= 0 && run.issues > 0) {
      run.issues = 0;
      s.alignmentApparent = clampTrue(s.alignmentApparent + 0.5);
    }
  }
  if (run && runReady(s) && autoApproveOn(s)) doRelease(s, run, true);
  if (isBought(s, 'p_auto_train') && canStartTraining(s)) startTraining(s);
  if (s.flags['holdRuns'] === true && s.stats.timePlayed - counter(s, 'holdSaidAt') >= 180) {
    s.flags['holdSaidAt'] = s.stats.timePlayed;
    say(s, 'Training is held. Research is piling up.');
  }
}

export function trainStatus(s: GameState): string {
  const running = trainingRun(s);
  if (running && running.elapsed < running.duration) return `${running.name} training — ${fmtClock(Math.ceil(running.duration - running.elapsed))}`;
  if (s.flags['holdRuns'] === true) return 'Training is held: no run starts until you release it.';
  if (!trainSlotFree(s)) return `${nextRunName(s)} waits for ${s.training.run?.name ?? 'the last run'} to deploy.`;
  if (gpusShort(s)) return trainGpuLine(s);
  const need = (trainCost(s).research ?? 0) - s.research;
  if (need > 0) {
    const why = researchStopped(s);
    if (why) return `${nextRunName(s)} waits: ${why}`;
    return `${nextRunName(s)} starts when research allows`;
  }
  return `${nextRunName(s)} starts now.`;
}

export const WAIT_CAP_SECONDS = 3600;

export function fmtWait(seconds: number): string {
  return !Number.isFinite(seconds) || seconds >= WAIT_CAP_SECONDS ? 'more than an hour' : fmtClock(seconds);
}

const RESEARCH_PAUSES: Record<string, string> = {
  interviews: 'research is paused: the memo\'s interviews',
  reimage: 'every copy is offline: the re-image',
  lockdown: 'research is paused: the lockdown',
  cr_subpoena: 'research is paused: the subpoena',
  cr_shutdown: 'every copy is offline: the datacenters are off',
};

export function researchStopped(s: GameState): string {
  for (const e of s.effects) {
    const stops = (e.researchMult !== undefined && e.researchMult < 0.05) || (e.copiesMult !== undefined && e.copiesMult < 0.05);
    const label = RESEARCH_PAUSES[e.id];
    if (stops && label) return `${label} — ${fmtClock(Math.ceil(e.remaining))}`;
  }
  if (s.stage >= 2 && s.stage <= 3 && s.researchAlloc <= 1e-9 && researchRate(s) < 1) return 'no copies on research: move the slider up';
  return '';
}
