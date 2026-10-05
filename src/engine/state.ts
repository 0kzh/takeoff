import { dateLabel } from './format.js';
import { seedFrom } from './rng.js';

export const SAVE_VERSION = 13;
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

export interface RivalRecord {
  name: string;
  capability: number;
  date: number;
}

export interface TrainingState {
  focus: Focus;
  runIndex: number;
  run: TrainingRun | null;
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
  pending: TrainingRun | null;
  releasing?: { remaining: number; isPublic: boolean } | null;
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
  consoleLines?: number;
}

export interface GameState {
  version: number;
  seed: number;
  rngSeed: number;
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
  autoPrice: boolean;

  power: number;
  powerPrice: number;
  powerBase: number;
  powerBought: number;
  gridAuto: boolean;
  stuckFor: number;

  gpus: number;
  gpuCostGrowth: number;
  copiesPerGPU: number;
  copyBoost: number;

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

  capability: number;
  rivalCapability: number;
  rivalVersion: number;
  nextRivalIn: number;
  rivalHistory: RivalRecord[];
  alignmentApparent: number;
  alignmentTrue: number;

  training: TrainingState;
  effects: TimedEffect[];
  scheduled: ScheduledEvent[];
  projects: Record<string, ProjectState>;
  developments: Record<string, boolean>;
  revealed: Record<string, boolean>;
  flags: Record<string, FlagValue>;
  log: LogEntry[];
  console: string[];
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
    pending: null,
  };
}

export function newStats(): Stats {
  return {
    timePlayed: 0,
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
  };
}

export function newGame(seed: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    seed: Math.floor(seed),
    rngSeed: seedFrom(seed),
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
    autoPrice: false,

    power: 1000,
    powerPrice: 20,
    powerBase: 20,
    powerBought: 0,
    gridAuto: false,
    stuckFor: 0,

    gpus: 0,
    gpuCostGrowth: 1.1,
    copiesPerGPU: 1,
    copyBoost: 1,

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

    capability: 1,
    rivalCapability: 1,
    rivalVersion: 1,
    nextRivalIn: 330,
    rivalHistory: [],
    alignmentApparent: 50,
    alignmentTrue: 50,

    training: newTraining(),
    effects: [],
    scheduled: [],
    projects: {},
    developments: {},
    revealed: { console: true, task: true },
    flags: { prologue: true },
    log: [],
    console: ['Welcome to OpenMind. Customers are waiting.'],
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
  printLine(s, text);
}

export function printLine(s: GameState, text: string): void {
  s.stats.consoleLines = (s.stats.consoleLines ?? 0) + 1;
  s.console.push(text);
  if (s.console.length > CONSOLE_LINES) s.console.splice(0, s.console.length - CONSOLE_LINES);
}

export function logNews(s: GameState, text: string, kind: LogKind = 'world'): void {
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
  return s.flags['prologue'] === true;
}

export function addFunds(s: GameState, amount: number): void {
  s.funds = Math.round((s.funds + amount) * 100) / 100;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  const projects = { ...((raw['projects'] as Record<string, ProjectState>) ?? {}) };
  const training = (raw['training'] as Partial<TrainingState>) ?? {};
  revealed['buyPower'] = true;
  if (!projects['p_datacenter']?.bought) delete projects['p_datacenter'];
  if (revealed['training'] && (training.runIndex ?? 0) >= 1) revealed['focus'] = true;
  if (revealed['training']) revealed['copies'] = true;
  delete revealed['apiCustomers'];
  return { ...raw, revealed, projects };
}

function migrateV2(raw: Record<string, unknown>): Record<string, unknown> {
  const revealed = (raw['revealed'] as Record<string, boolean>) ?? {};
  const projects = (raw['projects'] as Record<string, ProjectState>) ?? {};
  const made = (raw['choicesMade'] as ChoiceRecord[]) ?? [];
  const stats = (raw['stats'] as Partial<Stats>) ?? {};
  const seen = [
    ...Object.keys(revealed).filter((k) => revealed[k]).map((k) => `f:${k}`),
    ...Object.keys(projects).filter((k) => projects[k]!.shown || projects[k]!.bought > 0).map((k) => `p:${k}`),
    ...made.map((c) => `c:${c.id}`),
  ];
  const now = typeof stats.timePlayed === 'number' ? stats.timePlayed : 0;
  return { ...raw, cadence: { queue: [], lastDripAt: now, lastRevealAt: now, lastModalAt: now, seen: [...new Set(seen)] } };
}

function migrateV3(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  const training = { ...((raw['training'] as Record<string, unknown>) ?? {}) };
  const major = typeof training['major'] === 'number' ? (training['major'] as number) : 1;
  const minor = typeof training['minor'] === 'number' ? (training['minor'] as number) : 0;
  const run = training['run'] as Record<string, unknown> | null | undefined;
  if (run) training['run'] = { major, minor: minor + 1, ...run };
  out['training'] = training;
  delete out['turbines'];
  delete out['chipPrice'];
  return out;
}

function migrateV5(raw: Record<string, unknown>): Record<string, unknown> {
  const projects = { ...((raw['projects'] as Record<string, ProjectState>) ?? {}) };
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}) };
  let refund = 0;
  for (const [id, price] of [['p_site', 50000], ['p_interconnect', 100000], ['p_substation', 150000], ['p_contractor', 25000]] as const) {
    if ((projects[id]?.bought ?? 0) > 0) refund += price;
  }
  if (!(projects['p_datacenter']?.bought ?? 0)) delete projects['p_datacenter'];
  delete flags['price:p_datacenter'];
  for (const id of ['p_cooling', 'p_soundwall', 'p_abatement', 'p_ppa']) if (!(projects[id]?.bought ?? 0)) delete projects[id];
  for (const id of ['p_site', 'p_interconnect', 'p_substation', 'p_expedite', 'p_contractor']) {
    delete projects[id];
  }
  for (const id of ['site', 'interconnect', 'powerMW', 'trainNow']) delete revealed[id];
  for (const id of ['fleet', 'pricing', 'quota']) revealed[id] = true;
  const training = { ...((raw['training'] as Record<string, unknown>) ?? {}) };
  delete training['computeShare'];
  for (const key of ['run', 'pending']) {
    const run = training[key] as Record<string, unknown> | null | undefined;
    if (run && typeof run === 'object') {
      if (typeof run['gpus'] !== 'number') run['gpus'] = 0;
      delete run['computeYield'];
      delete run['moneyYield'];
    }
  }
  const out: Record<string, unknown> = { ...raw, projects, revealed, flags, training };
  delete out['interconnectLeft'];
  if (refund > 0) out['funds'] = Math.round(((raw['funds'] as number) ?? 0) + refund);
  return out;
}

function migrateV8(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw['marketingBought'] === 'number') return raw;
  const projects = (raw['projects'] as Record<string, ProjectState>) ?? {};
  const made = (raw['choicesMade'] as ChoiceRecord[]) ?? [];
  const flags = (raw['flags'] as Record<string, unknown>) ?? {};
  const level = typeof raw['hypeLevel'] === 'number' ? (raw['hypeLevel'] as number) : 1;
  const times = (id: string) => projects[id]?.bought ?? 0;
  let given = 2 * times('p_series_a') + 2 * times('p_demo') + 3 * times('p_keynote') + times('p_press');
  for (const c of made) {
    if ((c.id === 'c_letter' && c.option === 'rebuttal') || (c.id === 'c_customer_email' && c.option === 'case study')) given += 1;
    if (c.id === 'c_leaderboard' && c.option === 'submitted') given += flags['leaderboardWon'] === false ? -2 : 2;
  }
  return { ...raw, marketingBought: Math.max(0, Math.round(level - 1 - given)) };
}

function migrateV11(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw['rivalVersion'] === 'number' ? (raw['rivalVersion'] as number) : 1;
  if (version <= 1) return raw;
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}), rival: true };
  const developments = { ...((raw['developments'] as Record<string, boolean>) ?? {}), d_anthrosoft: true };
  return { ...raw, revealed, developments };
}

const MIGRATIONS: Migration[] = [(raw) => raw, migrateV1, migrateV2, migrateV3, (raw) => raw, migrateV5, (raw) => raw, (raw) => raw, migrateV8, (raw) => raw, (raw) => raw, migrateV11, (raw) => raw];

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
  for (const key of Object.keys(merged)) if (!(key in base)) delete merged[key];
  for (const key of ['training', 'stats', 'idle', 'cadence'] as const) {
    merged[key] = { ...(base[key] as object), ...((data[key] as object) ?? {}) };
  }
  return merged as unknown as GameState;
}

export function deserialize(text: string): GameState | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>)['tasks'] !== 'number') return null;
    if (Number((raw as Record<string, unknown>)['stage'] ?? 1) > 1) return null;
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
