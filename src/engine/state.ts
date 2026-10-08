import { dateLabel } from './format.js';
import { seedFrom } from './rng.js';

export const SAVE_VERSION = 15;
export const SAVE_KEY = 'takeoff.save.v1';
export const CONSOLE_LINES = 5;
export const LOG_LIMIT = 60;

export type Focus = 'capability' | 'efficiency' | 'safety';
export type RunPhase = 'training' | 'waiting' | 'evaluating' | 'redteam';
export type LogKind = 'world' | 'choice';
export type FlagValue = boolean | number | string;

export interface Cost {
  research?: number;
  insight?: number;
  funds?: number;
  trust?: number;
  power?: number;
}

export interface LogEntry {
  date: string;
  text: string;
  kind: LogKind;
}

export interface ProjectState {
  shown: boolean;
  bought: number;
}

export interface TrainingRun {
  id: number;
  name: string;
  focus: Focus;
  phase: RunPhase;
  elapsed: number;
  duration: number;
  gpus: number;
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
  major: number;
  minor: number;
  prologue?: boolean;
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
  run: TrainingRun | null;
  next: TrainingRun | null;
  nextRunId: number;
  redTeamRemaining: number;
  redTeamDuration: number;
  major: number;
  minor: number;
  modelName: string;
  deployedName: string;
  internalCapability: number;
  frontierBonus: number;
  models: ModelRecord[];
  releasing: { remaining: number; isPublic: boolean } | null;
  armed?: boolean;
}

export interface DataState {
  stock: number;
  webRemaining: number;
  synthetic: number;
  licensed: number;
}

export interface BaiwenState {
  present: boolean;
  capability: number;
  version: number;
  nextIn: number;
}

export interface TimedEffect {
  id: string;
  remaining: number;
  demandMult: number;
}

export interface ScheduledEvent {
  id: string;
  delay: number;
  source?: string;
}

export interface ActiveChoice {
  id: string;
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
}

export interface Cadence {
  queue: string[];
  lastDripAt: number;
  lastRevealAt: number;
  lastModalAt: number;
  seen: string[];
  governed: string[];
}

export interface IdleState {
  quiet: number;
  affordable: string[];
  shown: number;
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
  secClicks: number;
  clickHist: number[];
  clicksPerSec: number;
  peakTasksPerSec: number;
  powerPresses: number;
  trainings: number;
  releases: number;
  publicReleases: number;
  incidents: number;
  crises: number;
  choices: number;
  idleRescues: number;
  nextTaskMilestone: number;
  consoleLines: number;
  logLines: number;
}

export interface GameState {
  version: number;
  seed: number;
  rngSeed: number;
  stage: number;
  date: number;
  ending: string;

  tasks: number;
  unbilled: number;
  taskFrac: number;
  saleFrac: number;
  tasksSold: number;
  funds: number;
  totalRevenue: number;
  price: number;
  priceRaises: number;
  apiCustomers: number;
  autoPrice: boolean;

  power: number;
  powerPrice: number;
  powerBase: number;
  powerBought: number;
  gridAuto: boolean;
  gridCapacity: number;
  stuckFor: number;

  gpus: number;
  gpuCostGrowth: number;
  copiesPerGPU: number;
  copyBoost: number;

  datacenters: number;
  gpuBatches: number;

  hypeLevel: number;
  marketingBought: number;
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

  capability: number;
  rivalCapability: number;
  rivalVersion: number;
  nextRivalIn: number;
  alignmentApparent: number;
  alignmentTrue: number;
  govRelations: number;
  approval: number;
  lead: number;

  chipGen: number;
  dcTier: number;
  data: DataState;
  baiwen: BaiwenState;
  tempo: number;
  security: number;
  alignmentBand: number;
  deceptionBias: number;
  jobsDisplaced: number;
  history: number[][];

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
  cadence: Cadence;
  stats: Stats;

  tickAccum: number;
  tickCount: number;
}

export function newTraining(): TrainingState {
  return {
    focus: 'capability',
    runIndex: 0,
    run: null,
    next: null,
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
    releasing: null,
    armed: false,
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
    secClicks: 0,
    clickHist: [],
    clicksPerSec: 0,
    peakTasksPerSec: 0,
    powerPresses: 0,
    trainings: 0,
    releases: 0,
    publicReleases: 0,
    incidents: 0,
    crises: 0,
    choices: 0,
    idleRescues: 0,
    nextTaskMilestone: 1000,
    consoleLines: 0,
    logLines: 0,
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
    saleFrac: 0,
    tasksSold: 0,
    funds: 0,
    totalRevenue: 0,
    price: 0.25,
    priceRaises: 0,
    apiCustomers: 0,
    autoPrice: false,

    power: 1000,
    powerPrice: 20,
    powerBase: 20,
    powerBought: 0,
    gridAuto: false,
    gridCapacity: 1000,
    stuckFor: 0,

    gpus: 0,
    gpuCostGrowth: 1.1,
    copiesPerGPU: 1,
    copyBoost: 1,

    datacenters: 0,
    gpuBatches: 0,

    hypeLevel: 1,
    marketingBought: 0,
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

    capability: 1,
    rivalCapability: 1,
    rivalVersion: 1,
    nextRivalIn: 330,
    alignmentApparent: 50,
    alignmentTrue: 50,
    govRelations: 50,
    approval: 0,
    lead: 3,

    chipGen: 1,
    dcTier: 1,
    // 20T of public web to scrape (WEB_TOTAL in data.ts), from the first day.
    data: { stock: 0, webRemaining: 20, synthetic: 0, licensed: 0 },
    baiwen: { present: false, capability: 0, version: 0, nextIn: 0 },
    tempo: 50,
    security: 1,
    alignmentBand: 30,
    deceptionBias: 0,
    jobsDisplaced: 0,
    history: [],

    training: newTraining(),
    effects: [],
    scheduled: [],
    projects: {},
    developments: {},
    revealed: { console: true, task: true },
    flags: { prologue: true },
    log: [],
    console: ['Welcome to OpenMind. Customers are waiting.'],
    consoleQueue: [],
    activeChoice: null,
    choiceQueue: [],
    choicesMade: [],
    idle: { quiet: 0, affordable: [], shown: 0, lastNoveltyAt: 0 },
    cadence: { queue: [], lastDripAt: -999, lastRevealAt: 0, lastModalAt: -999, seen: [], governed: [] },
    stats: newStats(),

    tickAccum: 0,
    tickCount: 0,
  };
}

export function say(s: GameState, text: string): void {
  s.stats.consoleLines += 1;
  s.console.push(text);
  if (s.console.length > CONSOLE_LINES) s.console.splice(0, s.console.length - CONSOLE_LINES);
}

export function logNews(s: GameState, text: string, kind: LogKind = 'world'): void {
  s.stats.logLines += 1;
  s.log.push({ date: dateLabel(s.date), text, kind });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
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
    (!c.research || s.research >= c.research) &&
    (!c.insight || s.insight >= c.insight) &&
    (!c.funds || s.funds >= c.funds) &&
    (!c.trust || s.trust >= c.trust) &&
    (!c.power || s.power >= c.power)
  );
}

export function pay(s: GameState, c: Cost): boolean {
  if (!canPay(s, c)) return false;
  s.research -= c.research ?? 0;
  s.insight -= c.insight ?? 0;
  s.funds = Math.round((s.funds - (c.funds ?? 0)) * 100) / 100;
  s.trust -= c.trust ?? 0;
  if (c.power) s.power = Math.max(0, s.power - c.power);
  return true;
}

export function inPrologue(s: GameState): boolean {
  return s.stage === 1 && s.flags['prologue'] === true;
}

export function addFunds(s: GameState, amount: number): void {
  s.funds = Math.round((s.funds + amount) * 100) / 100;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

function keep(base: object, data: unknown): Record<string, unknown> {
  const from = (data ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(out)) if (key in from) out[key] = from[key];
  return out;
}

export function migrate(raw: Record<string, unknown>): GameState | null {
  const version = raw['version'];
  const legacy = (version === 14 || version === 13) && raw['stage'] === 1;
  if (version !== SAVE_VERSION && !legacy) return null;
  const base = newGame(typeof raw['seed'] === 'number' ? (raw['seed'] as number) : 0) as unknown as Record<string, unknown>;
  const merged = keep(base, raw);
  for (const key of ['training', 'stats', 'idle', 'cadence', 'data', 'baiwen'] as const) merged[key] = keep(base[key] as object, raw[key]);
  const run = (merged['training'] as { run: Record<string, unknown> | null }).run;
  if (run) for (const key of ['syntheticShare', 'alignShare', 'probeFlags']) delete run[key];
  if (typeof raw['gridCapacity'] !== 'number') merged['gridCapacity'] = (merged['gpus'] as number) >= 20 ? 10000 : 1000;
  if ((merged['revealed'] as Record<string, boolean>)['gridContract']) merged['gridAuto'] = true;
  merged['version'] = SAVE_VERSION;
  const out = merged as unknown as GameState;
  // Saves from before the web could be scraped in Stage 1 start with nothing left to scrape.
  if (out.stage === 1 && out.data.webRemaining === 0 && !(out.projects['s2_scrape']?.bought ?? 0)) out.data.webRemaining = 20;
  return out;
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

export function replaceState(target: GameState, source: GameState): void {
  const t = target as unknown as Record<string, unknown>;
  for (const key of Object.keys(t)) delete t[key];
  Object.assign(t, JSON.parse(JSON.stringify(source)));
}
