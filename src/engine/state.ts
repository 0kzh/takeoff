import { dateLabel } from './format.js';
import { seedFrom } from './rng.js';

export const SAVE_VERSION = 12;
export const SAVE_KEY = 'takeoff.save.v1';
export const CONSOLE_LINES = 5;
export const CONSOLE_KEEP_ON_TRANSITION = 4;
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
  data?: number;
  materials?: number;
  build?: number;
  fund?: number;
  power?: number;
}

export interface PowerOrder {
  kind: 'solar' | 'nuclear' | 'gulf' | 'datacenter';
  mw: number;
  remaining: number;
  total?: number;
  label: string;
}

export interface Shipment {
  gpus: number;
  gen: number;
  remaining: number;
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
  syntheticShare: number;
  alignShare: number;
  probeFlags?: number;
  sentBack?: boolean;
  reviewLeft?: number;
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
  cooldown: number;
  releaseWait: number;
  releasing?: { remaining: number; isPublic: boolean } | null;
  armed?: boolean;
}

export interface TimedEffect {
  id: string;
  remaining: number;
  demandMult: number;
  powerMult?: number;
  researchMult?: number;
  copiesMult?: number;
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
  hold?: boolean;
}

export interface Cadence {
  queue: string[];
  lastDripAt: number;
  lastRevealAt: number;
  lastModalAt: number;
  seen: string[];
  lateQueue: string[];
  lastLateAt: number;
  governed: string[];
  lastMechanicAt: number;
  grantQueue: string[];
  lastGrantAt: number;
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
  pressCounts: Record<string, number>;
  priceHist: number[];
  incidentTimes: number[];
  lostToDrift: number;
  recaptured: number;
  consoleLines?: number;
  logLines?: number;
}

export interface Generation {
  name: string;
  phase: 'training' | 'reading';
  remaining: number;
  total: number;
  capAfter: number;
  verified: boolean;
}

export interface AgendaItem {
  id: string;
  remaining: number;
  total: number;
}

export interface Stage4State {
  materials: number;
  permitCap: number;
  mine: number;
  replicate: number;
  build: number;
  chips: number;
  techMine: number;
  techRep: number;
  techBuild: number;
  zoneMult: number;
  builtCompute: number;
  robotsBuilt: number;
  peakCompute: number;
  ubiShare: number;
  ubiSeconds: number;
  housingUnits: number;
  housingHeat: number;
  housingAt: number;
  approvalBase: number;
  treaty: number;
  treatyOpening: number;
  talks: 'none' | 'open' | 'closed';
  chipsInstalled: number;
  draftShare: number;
  agenda: AgendaItem[];
  verifyOn: boolean;
  gen: Generation | null;
  generations: number;
  verifiedGens: number;
  genBase: number;
  genCap0: number;
  baiwenAligned: boolean;
  baiwen: 'unknown' | 'verifying' | 'read' | 'aligned' | 'misaligned' | 'rebuilding' | 'rebuilt';
  baiwenLeft: number;
  treatyFrozen: number;
  ashfordPhase: 'none' | 'spreading' | 'cured';
  ashfordLeft: number;
  ashfordDeaths: number;
  ashfordBand: number;
  nanoLeft: number;
  nanoDrain: number;
  outageLeft: number;
  fleetGoal: 'growth' | 'people' | 'treaty';
  approvalHold: number;
  stance: 'hold' | 'balanced' | 'concede';
  askLeft: number;
  grants: string[];
}

export function newStage4(): Stage4State {
  return {
    materials: 0,
    permitCap: 400000,
    mine: 0.35,
    replicate: 0.4,
    build: 0.25,
    chips: 0,
    techMine: 1,
    techRep: 1,
    techBuild: 1,
    zoneMult: 1,
    builtCompute: 0,
    robotsBuilt: 0,
    peakCompute: 0,
    ubiShare: 0,
    ubiSeconds: 0,
    housingUnits: 0,
    housingHeat: 0,
    housingAt: 0,
    approvalBase: 0,
    treaty: 0,
    treatyOpening: 0,
    talks: 'none',
    chipsInstalled: 0,
    draftShare: 0,
    agenda: [],
    verifyOn: true,
    gen: null,
    generations: 0,
    verifiedGens: 0,
    genBase: 0,
    genCap0: 1,
    baiwenAligned: false,
    baiwen: 'unknown',
    baiwenLeft: 0,
    treatyFrozen: 0,
    ashfordPhase: 'none',
    ashfordLeft: 0,
    ashfordDeaths: 0,
    ashfordBand: 0,
    nanoLeft: 0,
    nanoDrain: 0,
    outageLeft: 0,
    fleetGoal: 'growth',
    approvalHold: 0,
    stance: 'balanced',
    askLeft: 0,
    grants: [],
  };
}

export interface Mission {
  id: string;
  remaining: number;
  total: number;
}

export type SpaceRow = 'foundry' | 'orbital' | 'collector';

export interface Stage5State {
  massFlow: number;
  flowParts: Record<string, number>;
  matter: number;
  missionFund: number;
  industryShare: number;
  orbitalGpus: number;
  orbitalMult: number;
  swarm: number;
  probes: number;
  probesTotal: number;
  probesLost: number;
  split: Record<SpaceRow, number>;
  handPurchases: number;
  techIndustry: number;
  flowGrowth: number;
  missions: Mission[];
  beside: Mission[];
  peopleLineIndex: number;
  genTimer: number;
  mercuryTaken: number;
  peopleOffEarth: number;
  spent: Record<string, number>;
  news: { at: number; text: string }[];
}

export function newStage5(): Stage5State {
  return {
    massFlow: 0,
    flowParts: {},
    matter: 0,
    missionFund: 0,
    industryShare: 0.75,
    orbitalGpus: 0,
    orbitalMult: 1,
    swarm: 0,
    probes: 0,
    probesTotal: 0,
    probesLost: 0,
    split: { foundry: 0, orbital: 0, collector: 0 },
    handPurchases: 0,
    techIndustry: 1,
    flowGrowth: 0,
    missions: [],
    beside: [],
    peopleLineIndex: 0,
    genTimer: 150,
    mercuryTaken: 0,
    peopleOffEarth: 0,
    spent: {},
    news: [],
  };
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
  marketBase: number;
  contractIncome: number;
  revenueMult: number;

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
  researchAlloc: number;

  datacenters: number;
  powerCapacityMW: number;
  gasPlants: number;
  solarFarms: number;
  reactors: number;
  gulfSites: number;
  powerQueue: PowerOrder[];
  btm: boolean;
  gpusG5: number;
  g5: boolean;
  gpuBatches: number;
  standingOrder: boolean;
  standingBudget: number;
  standingPool: number;
  buildFund: number;
  buildShare: number;
  gulfExposure: number;

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
  humanEff: number;
  aiResearchMult: number;

  capability: number;
  rivalCapability: number;
  rivalVersion: number;
  nextRivalIn: number;
  rivalHistory: RivalRecord[];
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
  dataSynthetic: number;
  crawlLeft: number;
  autonomy: number;
  jobFund: boolean;
  shareEvals: boolean;
  alignShare: number;
  monitorShare: number;
  rogueCopies: number;
  gpusG6: number;
  shipments: Shipment[];
  majorIncidents: number;
  robots: number;
  s4: Stage4State;
  s5: Stage5State;

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
    cooldown: 0,
    releaseWait: 0,
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
    pressCounts: {},
    priceHist: [],
    incidentTimes: [],
    lostToDrift: 0,
    recaptured: 0,
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
    marketBase: 0,
    contractIncome: 0,
    revenueMult: 1,

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
    researchAlloc: 0,

    datacenters: 0,
    powerCapacityMW: 0,
    gasPlants: 0,
    solarFarms: 0,
    reactors: 0,
    gulfSites: 0,
    powerQueue: [],
    btm: false,
    gpusG5: 0,
    g5: false,
    gpuBatches: 0,
    standingOrder: false,
    standingBudget: 0.5,
    standingPool: 0,
    buildFund: 0,
    buildShare: DEFAULT_BUILD_SHARE,
    gulfExposure: 0,

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
    humanEff: 1,
    aiResearchMult: 1,

    capability: 1,
    rivalCapability: 1,
    rivalVersion: 1,
    nextRivalIn: 330,
    rivalHistory: [],
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
    dataSynthetic: 0,
    crawlLeft: 0,
    autonomy: 0,
    jobFund: false,
    shareEvals: false,
    alignShare: 0.01,
    monitorShare: 0,
    rogueCopies: 0,
    gpusG6: 0,
    shipments: [],
    majorIncidents: 0,
    robots: 0,
    s4: newStage4(),
    s5: newStage5(),

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
    cadence: { queue: [], lastDripAt: -999, lastRevealAt: 0, lastModalAt: -999, seen: [], lateQueue: [], lastLateAt: -999, governed: [], lastMechanicAt: 0, grantQueue: [], lastGrantAt: -999 },
    stats: newStats(),

    tickAccum: 0,
    tickCount: 0,
  };
}

const QUEUE_LIMIT = 10;

export function say(s: GameState, text: string): void {
  if (s.consoleQueue.some((q) => q.hold)) {
    if (s.consoleQueue.length < QUEUE_LIMIT) s.consoleQueue.push({ delay: 0.6, text });
    return;
  }
  printLine(s, text);
}

export function printLine(s: GameState, text: string): void {
  s.stats.consoleLines = (s.stats.consoleLines ?? 0) + 1;
  s.console.push(text);
  if (s.console.length > CONSOLE_LINES) s.console.splice(0, s.console.length - CONSOLE_LINES);
}

export function narrate(s: GameState, lines: [number, string][], holdAfter = 0): void {
  if (s.console.length > CONSOLE_KEEP_ON_TRANSITION) s.console.splice(0, s.console.length - CONSOLE_KEEP_ON_TRANSITION);
  const waiting = s.consoleQueue.filter((q) => !q.hold);
  const held: QueuedLine[] = lines.map(([delay, text]) => ({ delay, text, hold: true }));
  if (holdAfter > 0) held.push({ delay: holdAfter, text: '', hold: true });
  s.consoleQueue = [...held, ...waiting];
}

export function logNews(s: GameState, text: string, kind: LogKind = 'world'): void {
  s.stats.logLines = (s.stats.logLines ?? 0) + 1;
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
    (!c.data || s.data >= c.data - 1e-9) &&
    (!c.materials || s.s4.materials >= c.materials) &&
    (!c.build || s.buildFund >= c.build || s.funds >= c.build) &&
    (!c.fund || s.s5.missionFund >= c.fund - 1e-6) &&
    (!c.power || s.power >= c.power)
  );
}

export function pay(s: GameState, c: Cost): boolean {
  if (!canPay(s, c)) return false;
  s.research -= c.research ?? 0;
  s.insight -= c.insight ?? 0;
  s.funds = Math.round((s.funds - (c.funds ?? 0)) * 100) / 100;
  s.trust -= c.trust ?? 0;
  if (c.data) spendData(s, c.data);
  if (c.materials) s.s4.materials = Math.max(0, s.s4.materials - c.materials);
  if (c.build) {
    if (s.buildFund >= c.build) payBuild(s, c.build);
    else s.funds = Math.round((s.funds - c.build) * 100) / 100;
  }
  if (c.fund) s.s5.missionFund = Math.max(0, s.s5.missionFund - c.fund);
  if (c.power) s.power = Math.max(0, s.power - c.power);
  return true;
}

export function spendData(s: GameState, amount: number): number {
  const take = Math.min(s.data, amount);
  const share = s.data > 0 ? Math.min(1, s.dataSynthetic / s.data) : 0;
  s.data = Math.max(0, s.data - take);
  s.dataSynthetic = Math.max(0, Math.min(s.data, s.dataSynthetic - take * share));
  return share;
}

export function inPrologue(s: GameState): boolean {
  return s.stage === 1 && s.flags['prologue'] === true;
}

export function heldForPlayer(s: GameState): boolean {
  return s.flags['held'] === true;
}

export function press(s: GameState, verb: string): void {
  s.stats.pressCounts[verb] = (s.stats.pressCounts[verb] ?? 0) + 1;
}

export function addFunds(s: GameState, amount: number): void {
  s.funds = Math.round((s.funds + amount) * 100) / 100;
}

export const DEFAULT_BUILD_SHARE = 0.5;

export function buildFundOpen(s: GameState): boolean {
  return (s.stage === 2 || s.stage === 3) && s.revealed['infrastructure'] === true;
}

export function creditIncome(s: GameState, amount: number): void {
  if (!buildFundOpen(s) || amount <= 0) {
    s.funds = Math.round((s.funds + amount) * 100) / 100;
    return;
  }
  const build = amount * s.buildShare;
  s.buildFund = Math.round((s.buildFund + build) * 100) / 100;
  s.funds = Math.round((s.funds + amount - build) * 100) / 100;
}

export function payBuild(s: GameState, cost: number): void {
  s.buildFund = Math.max(0, Math.round((s.buildFund - cost) * 100) / 100);
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  const projects = { ...((raw['projects'] as Record<string, ProjectState>) ?? {}) };
  const training = (raw['training'] as Partial<TrainingState>) ?? {};
  const stage = typeof raw['stage'] === 'number' ? (raw['stage'] as number) : 1;
  if (stage === 1) {
    revealed['buyPower'] = true;
    if (!projects['p_datacenter']?.bought) delete projects['p_datacenter'];
  }
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
  if (run) training['run'] = { major, minor: minor + 1, syntheticShare: 0, alignShare: 0.01, ...run };
  out['training'] = training;
  if (typeof raw['turbines'] === 'number') out['gasPlants'] = raw['turbines'];
  delete out['turbines'];
  delete out['chipPrice'];
  const stage = typeof raw['stage'] === 'number' ? (raw['stage'] as number) : 1;
  if (stage >= 2) {
    const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
    revealed['stores'] = true;
    revealed['autoPrice'] = true;
    revealed['contracts'] = false;
    out['revealed'] = revealed;
    out['autoPrice'] = true;
    out['marketBase'] = 0;
    const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}) };
    flags['shipIssuesAsked'] = true;
    out['flags'] = flags;
  }
  return out;
}

function migrateV4(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw['standingBudget'] === undefined) raw['standingBudget'] = 0.5;
  if (raw['standingPool'] === undefined) raw['standingPool'] = 0;
  return raw;
}

function migrateV5(raw: Record<string, unknown>): Record<string, unknown> {
  const projects = { ...((raw['projects'] as Record<string, ProjectState>) ?? {}) };
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}) };
  const stage = typeof raw['stage'] === 'number' ? (raw['stage'] as number) : 1;
  let refund = 0;
  if (stage === 1) {
    for (const [id, price] of [['p_site', 50000], ['p_interconnect', 100000], ['p_substation', 150000], ['p_contractor', 25000]] as const) {
      if ((projects[id]?.bought ?? 0) > 0) refund += price;
    }
    if (!(projects['p_datacenter']?.bought ?? 0)) delete projects['p_datacenter'];
    delete flags['price:p_datacenter'];
    for (const id of ['p_cooling', 'p_soundwall', 'p_abatement', 'p_ppa']) if (!(projects[id]?.bought ?? 0)) delete projects[id];
  }
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

function migrateV6(raw: Record<string, unknown>): Record<string, unknown> {
  const training = { ...((raw['training'] as Record<string, unknown>) ?? {}) };
  for (const key of ['run', 'pending']) {
    const run = training[key] as Record<string, unknown> | null | undefined;
    if (run && typeof run === 'object') {
      if (typeof run['probeFlags'] !== 'number') run['probeFlags'] = 0;
    }
  }
  const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}) };
  const stage = typeof raw['stage'] === 'number' ? (raw['stage'] as number) : 1;
  if (stage >= 3 && flags['sage3Released'] === undefined) flags['sage3Released'] = 'public';
  return { ...raw, training, flags };
}

function migrateV7(raw: Record<string, unknown>): Record<string, unknown> {
  const pool = typeof raw['standingPool'] === 'number' ? (raw['standingPool'] as number) : 0;
  const funds = typeof raw['funds'] === 'number' ? (raw['funds'] as number) : 0;
  const moved = Math.max(0, Math.min(pool, funds));
  const training = { ...((raw['training'] as Record<string, unknown>) ?? {}), armed: false };
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  if (revealed['infrastructure'] === true) revealed['buildShare'] = true;
  return { ...raw, training, revealed, funds: funds - moved, buildFund: moved, buildShare: DEFAULT_BUILD_SHARE, standingPool: 0 };
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

function migrateV9(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw['stage'] !== 4 || raw['s4'] !== undefined) return raw;
  const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}), s4Pending: true };
  return { ...raw, flags };
}

function migrateV10(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  delete out['launchCapacity'];
  delete out['orbitalCompute'];
  if (raw['stage'] === 5 && raw['s5'] === undefined) {
    out['flags'] = { ...((raw['flags'] as Record<string, unknown>) ?? {}), s5Pending: true };
  }
  return out;
}

function migrateV11(raw: Record<string, unknown>): Record<string, unknown> {
  const stage = typeof raw['stage'] === 'number' ? (raw['stage'] as number) : 1;
  const version = typeof raw['rivalVersion'] === 'number' ? (raw['rivalVersion'] as number) : 1;
  if (stage < 2 && version <= 1) return raw;
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}), rival: true };
  const developments = { ...((raw['developments'] as Record<string, boolean>) ?? {}), d_anthrosoft: true };
  return { ...raw, revealed, developments };
}

const MIGRATIONS: Migration[] = [(raw) => raw, migrateV1, migrateV2, migrateV3, migrateV4, migrateV5, migrateV6, migrateV7, migrateV8, migrateV9, migrateV10, migrateV11];

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
  for (const key of ['training', 'stats', 'idle', 'cadence', 's4', 's5'] as const) {
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

export function replaceState(target: GameState, source: GameState): void {
  const t = target as unknown as Record<string, unknown>;
  for (const key of Object.keys(t)) delete t[key];
  Object.assign(t, JSON.parse(JSON.stringify(source)));
}
