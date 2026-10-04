import { dateLabel } from './format.js';
import { seedFrom } from './rng.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'takeoff.save.v1';
export const CONSOLE_LINES = 5;
export const LOG_LIMIT = 60;

export type Focus = 'capability' | 'efficiency' | 'safety';
export type RunPhase = 'training' | 'evaluating' | 'redteam';
export type LogKind = 'world' | 'choice';
export type FlagValue = boolean | number | string;

export interface Cost {
  research?: number;
  insight?: number;
  funds?: number;
  trust?: number;
}

export interface LogEntry {
  date: string;
  text: string;
  kind: LogKind;
}

export interface ProjectState {
  shown: boolean;
  /** Times bought. A project disappears once `bought >= uses`. */
  bought: number;
}

export interface TrainingRun {
  id: number;
  name: string;
  focus: Focus;
  phase: RunPhase;
  elapsed: number;
  duration: number;
  /** Fraction of the focus gain kept when the run had less compute than it needed. */
  computeYield: number;
  evalElapsed: number;
  flavorShown: number;
  eventAt: number;
  eventId: string;
  gambleAt: number;
  gamble: 'none' | 'offered' | 'declined' | 'success' | 'fail';
  capBefore: number;
  capAfter: number;
  gainBonus: number;
  capMult: number;
  benchBonus: number[];
  benchmarks: number[];
  scores: number[];
  issues: number;
  issuesFound: number;
  extraIssues: number;
}

export interface ModelRecord {
  name: string;
  capability: number;
  date: number;
  public: boolean;
}

export interface TrainingState {
  focus: Focus;
  runIndex: number;
  computeShare: number;
  run: TrainingRun | null;
  nextRunId: number;
  /** Seconds left on the red-team cooldown button (persisted so a reload cannot skip it). */
  redTeamRemaining: number;
  redTeamDuration: number;
  major: number;
  minor: number;
  /** Latest model name, public or internal. */
  modelName: string;
  /** Model the copies and customers are running. */
  deployedName: string;
  /** Best capability trained so far; the base for the next run. */
  internalCapability: number;
  frontierBonus: number;
  models: ModelRecord[];
}

/** A temporary multiplier on demand (incidents, rival releases). Remaining time in seconds. */
export interface TimedEffect {
  id: string;
  remaining: number;
  demandMult: number;
}

/** A crisis that fires after `delay` seconds. */
export interface ScheduledEvent {
  id: string;
  delay: number;
}

export interface ActiveChoice {
  id: string;
  /** Seconds left on the timer; 0 when the choice has no timer. */
  remaining: number;
  context: Record<string, number | string>;
}

export interface ChoiceRecord {
  id: string;
  option: string;
  date: string;
}

export interface QueuedLine {
  delay: number;
  text: string;
  /** A stage-transition line: the console stays blank, and other lines are dropped, until it prints. */
  hold?: boolean;
}

/** Bookkeeping for the idle guard (design.md §8). */
export interface IdleState {
  /** Seconds since something became newly affordable or newly revealed. */
  quiet: number;
  /** Keys that were affordable at the last check. */
  affordable: string[];
  /** Count of revealed flags + shown projects at the last check. */
  shown: number;
  /** Game seconds of the last novelty. */
  lastNoveltyAt: number;
}

export interface Stats {
  timePlayed: number;
  timeInStage: number;
  stageEnteredAt: number[];
  tasksPerSec: number;
  revPerSec: number;
  soldPerSec: number;
  taskHist: number[];
  revHist: number[];
  soldHist: number[];
  lastTasks: number;
  secRevenue: number;
  secSold: number;
  peakTasksPerSec: number;
  trainings: number;
  releases: number;
  publicReleases: number;
  incidents: number;
  crises: number;
  choices: number;
  idleRescues: number;
  nextTaskMilestone: number;
}

export interface GameState {
  version: number;
  seed: number;
  rngSeed: number;
  stage: number;
  /** Months since Jul 2025, fractional. */
  date: number;
  ending: string;

  tasks: number;
  unbilled: number;
  taskFrac: number;
  tasksSold: number;
  funds: number;
  totalRevenue: number;
  price: number;
  priceRaises: number;
  apiCustomers: number;

  power: number;
  powerPrice: number;
  powerBase: number;
  powerBought: number;
  gridAuto: boolean;

  gpus: number;
  gpuCostGrowth: number;
  copiesPerGPU: number;
  copyBoost: number;
  researchAlloc: number;

  datacenters: number;
  powerCapacityMW: number;
  turbines: number;
  chipPrice: number;
  gpuBatches: number;

  hypeLevel: number;
  hypeBoost: number;
  demandMult: number;

  trust: number;
  nextTrust: number;
  fib1: number;
  fib2: number;
  researchers: number;
  labSpace: number;
  labMult: number;
  research: number;
  insight: number;
  insightUnlocked: boolean;
  researchMult: number;
  insightMult: number;
  humanEff: number;

  capability: number;
  rivalCapability: number;
  rivalVersion: number;
  nextRivalIn: number;
  baiwenCapability: number;
  alignmentApparent: number;
  alignmentTrue: number;
  interpretability: number;
  securityLevel: number;
  govRelations: number;
  approval: number;
  jobsDisplaced: number;
  lead: number;
  data: number;
  robots: number;
  launchCapacity: number;
  orbitalCompute: number;

  training: TrainingState;
  effects: TimedEffect[];
  scheduled: ScheduledEvent[];
  projects: Record<string, ProjectState>;
  developments: Record<string, boolean>;
  revealed: Record<string, boolean>;
  flags: Record<string, FlagValue>;
  log: LogEntry[];
  console: string[];
  consoleQueue: QueuedLine[];
  activeChoice: ActiveChoice | null;
  choiceQueue: ActiveChoice[];
  choicesMade: ChoiceRecord[];
  idle: IdleState;
  stats: Stats;

  tickAccum: number;
  tickCount: number;
}

export function newTraining(): TrainingState {
  return {
    focus: 'capability',
    runIndex: 0,
    computeShare: 0.5,
    run: null,
    nextRunId: 1,
    redTeamRemaining: 0,
    redTeamDuration: 12,
    major: 1,
    minor: 0,
    modelName: 'Sage-1',
    deployedName: 'Sage-1',
    internalCapability: 1,
    frontierBonus: 0,
    models: [{ name: 'Sage-1', capability: 1, date: 0, public: true }],
  };
}

export function newStats(): Stats {
  return {
    timePlayed: 0,
    timeInStage: 0,
    stageEnteredAt: [0],
    tasksPerSec: 0,
    revPerSec: 0,
    soldPerSec: 0,
    taskHist: [],
    revHist: [],
    soldHist: [],
    lastTasks: 0,
    secRevenue: 0,
    secSold: 0,
    peakTasksPerSec: 0,
    trainings: 0,
    releases: 0,
    publicReleases: 0,
    incidents: 0,
    crises: 0,
    choices: 0,
    idleRescues: 0,
    nextTaskMilestone: 1000,
  };
}

export function newGame(seed: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    seed: Math.floor(seed),
    rngSeed: seedFrom(seed),
    stage: 1,
    date: 0,
    ending: '',

    tasks: 0,
    unbilled: 0,
    taskFrac: 0,
    tasksSold: 0,
    funds: 0,
    totalRevenue: 0,
    price: 0.25,
    priceRaises: 0,
    apiCustomers: 0,

    power: 1000,
    powerPrice: 20,
    powerBase: 20,
    powerBought: 0,
    gridAuto: false,

    gpus: 0,
    gpuCostGrowth: 1.1,
    copiesPerGPU: 1,
    copyBoost: 1,
    researchAlloc: 0,

    datacenters: 0,
    powerCapacityMW: 0,
    turbines: 0,
    chipPrice: 40,
    gpuBatches: 0,

    hypeLevel: 1,
    hypeBoost: 1,
    demandMult: 1,

    trust: 2,
    nextTrust: 2000,
    fib1: 2,
    fib2: 3,
    researchers: 1,
    labSpace: 1,
    labMult: 1,
    research: 0,
    insight: 0,
    insightUnlocked: false,
    researchMult: 1,
    insightMult: 1,
    humanEff: 1,

    capability: 1,
    rivalCapability: 1,
    rivalVersion: 1,
    nextRivalIn: 330,
    baiwenCapability: 0.7,
    alignmentApparent: 50,
    alignmentTrue: 50,
    interpretability: 0,
    securityLevel: 1,
    govRelations: 50,
    approval: 0,
    jobsDisplaced: 0,
    lead: 3,
    data: 0,
    robots: 0,
    launchCapacity: 0,
    orbitalCompute: 0,

    training: newTraining(),
    effects: [],
    scheduled: [],
    projects: {},
    developments: {},
    revealed: { console: true, task: true },
    flags: {},
    log: [],
    console: ['Welcome to OpenMind. Customers are waiting.'],
    consoleQueue: [],
    activeChoice: null,
    choiceQueue: [],
    choicesMade: [],
    idle: { quiet: 0, affordable: [], shown: 0, lastNoveltyAt: 0 },
    stats: newStats(),

    tickAccum: 0,
    tickCount: 0,
  };
}

export function say(s: GameState, text: string): void {
  if (s.consoleQueue.some((q) => q.hold)) return;
  s.console.push(text);
  if (s.console.length > CONSOLE_LINES) s.console.splice(0, s.console.length - CONSOLE_LINES);
}

/** Blank the console, then print `text` after `delay` seconds (stage transitions). */
export function blackout(s: GameState, delay: number, text: string): void {
  s.console = [];
  s.consoleQueue = [{ delay, text, hold: true }];
}

export function logNews(s: GameState, text: string, kind: LogKind = 'world'): void {
  s.log.push({ date: dateLabel(s.date), text, kind });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
  s.revealed['log'] = true;
}

export function counter(s: GameState, name: string): number {
  const v = s.flags[name];
  return typeof v === 'number' ? v : 0;
}

export function bump(s: GameState, name: string, by = 1): number {
  const v = counter(s, name) + by;
  s.flags[name] = v;
  return v;
}

export function projectState(s: GameState, id: string): ProjectState {
  let p = s.projects[id];
  if (!p) {
    p = { shown: false, bought: 0 };
    s.projects[id] = p;
  }
  return p;
}

export function isBought(s: GameState, id: string): boolean {
  return (s.projects[id]?.bought ?? 0) > 0;
}

export function canPay(s: GameState, c: Cost): boolean {
  return (
    s.research >= (c.research ?? 0) &&
    s.insight >= (c.insight ?? 0) &&
    s.funds >= (c.funds ?? 0) &&
    s.trust >= (c.trust ?? 0)
  );
}

export function pay(s: GameState, c: Cost): boolean {
  if (!canPay(s, c)) return false;
  s.research -= c.research ?? 0;
  s.insight -= c.insight ?? 0;
  s.funds = Math.round((s.funds - (c.funds ?? 0)) * 100) / 100;
  s.trust -= c.trust ?? 0;
  return true;
}

export function addFunds(s: GameState, amount: number): void {
  s.funds = Math.round((s.funds + amount) * 100) / 100;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Index i upgrades a save from version i to i + 1. Version 0 = pre-release saves. */
const MIGRATIONS: Migration[] = [(raw) => raw];

/** Runs migrations, then fills fields missing from older saves with new-game defaults. */
export function migrate(raw: Record<string, unknown>): GameState {
  let data = raw;
  let version = typeof data['version'] === 'number' ? (data['version'] as number) : 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (step) data = step(data);
    version++;
    data['version'] = version;
  }
  const base = newGame(typeof data['seed'] === 'number' ? (data['seed'] as number) : 0) as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base, ...data };
  for (const key of ['training', 'stats', 'idle'] as const) {
    merged[key] = { ...(base[key] as object), ...((data[key] as object) ?? {}) };
  }
  return merged as unknown as GameState;
}

export function deserialize(text: string): GameState | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>)['tasks'] !== 'number') return null;
    return migrate(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Replaces the contents of `target` in place so external references (window.__game.state) stay valid. */
export function replaceState(target: GameState, source: GameState): void {
  const t = target as unknown as Record<string, unknown>;
  for (const key of Object.keys(t)) delete t[key];
  Object.assign(t, JSON.parse(JSON.stringify(source)));
}
