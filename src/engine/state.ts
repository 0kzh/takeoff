import { dateLabel } from './format.js';
import { seedFrom } from './rng.js';

export const SAVE_VERSION = 10;
export const SAVE_KEY = 'takeoff.save.v1';
export const CONSOLE_LINES = 5;
/** Console lines kept on screen through a stage transition (the rest scroll off under the narration). */
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
  /** Trillions of tokens (Stage 2 training runs). */
  data?: number;
  /** Stage 4: tonnes of materials, the stage's currency. */
  materials?: number;
}

/** A power plant waiting to come online (stage2.md §2.1). Solar farms wait in the interconnect queue one at a time. */
export interface PowerOrder {
  /** A plant coming online, or (`datacenter`) a hall under construction (mw 0). */
  kind: 'solar' | 'nuclear' | 'gulf' | 'datacenter';
  mw: number;
  /** Seconds left; only the first solar order counts down. */
  remaining: number;
  /** Seconds it started with (datacenters: they open a quarter at a time). */
  total?: number;
  label: string;
}

/** A Stage 3 GPU lot on its way: the head of the queue counts down; the rest wait their turn. */
export interface Shipment {
  gpus: number;
  /** Chip generation: 5 (Nimbus G5) or 6 (Nimbus G6). */
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
  /** GPUs the run holds while it trains (the requirement it met when it started). */
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
  /** Version numbers of `name` (`Sage-2.3` → 2, 3), fixed when the run starts and when it crosses a tier. */
  major: number;
  minor: number;
  /** Share of the run's data that was synthetic (stage2.md §2.6). */
  syntheticShare: number;
  /** Alignment compute (share of copies) while the run trained (stage2.md §2.11). */
  alignShare: number;
  /** Stage 3: the interpretability probes' flags on this run (lab II); 0 before it. */
  probeFlags?: number;
  /** Stage 3: sent back once (retrained 20 s, keeps 70 % of its gain, true alignment +1). */
  sentBack?: boolean;
  /** Stage 3: seconds of the thorough red-team review left before it can deploy. */
  reviewLeft?: number;
}

export interface ModelRecord {
  name: string;
  capability: number;
  date: number;
  public: boolean;
}

/** An Anthrosoft release, for the graph's dashed line. */
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
  /**
   * Parallel pipelines (stage2.md §2.5): the second slot. While `run` waits in evaluation or
   * red-team, the next run trains here; it moves into `run` when that one is released.
   */
  pending: TrainingRun | null;
  /** Seconds before the next run may start (A Month of Evals). Never lengthens a run. */
  cooldown: number;
  /** Seconds before a model at 4× or more may ship publicly (the joint statement's outside evaluation). */
  releaseWait: number;
  /**
   * Train pressed while the run's price is short (arc G34 rule 4): the run starts by itself once it is
   * paid for. Pressing again stands it down. Arming reserves nothing.
   */
  armed?: boolean;
}

/** A temporary multiplier (incidents, rival releases, crises). Remaining time in seconds. */
export interface TimedEffect {
  id: string;
  remaining: number;
  demandMult: number;
  /** Stage 2: share of power capacity left (curtailment, protest, riots). */
  powerMult?: number;
  /** Stage 2: research rate multiplier (lock-down, the Bureau, a subpoena). */
  researchMult?: number;
  /** Stage 3: share of copies online (a breakout takes a fifth offline; a re-image all of them). */
  copiesMult?: number;
}

/** A crisis that fires after `delay` seconds. */
export interface ScheduledEvent {
  id: string;
  delay: number;
  /** The release that shipped the issue, so the incident can be traced back to it. */
  source?: string;
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
  /** Narration (stage transitions): other lines wait behind it instead of interleaving. */
  hold?: boolean;
}

/**
 * The reveal scheduler's bookkeeping (engine/reveal.ts; stage2.md §4.1 extends it with late items
 * and a governor). Times are game seconds.
 */
export interface Cadence {
  /** Projects whose trigger has fired, waiting for their turn, in table order. */
  queue: string[];
  /** When the drip last released a project. */
  lastDripAt: number;
  /** When something was revealed for the first time: a flag, a project, a modal. */
  lastRevealAt: number;
  /** When the last modal opened; automatic modals keep MODAL_SPACING apart. */
  lastModalAt: number;
  /** Everything seen at least once: `f:<flag>`, `p:<project>`, `c:<choice>`. */
  seen: string[];
  /** Stage 2 late items whose trigger has fired, waiting for the approach and the late drip. */
  lateQueue: string[];
  /** When the late drip last released an item. */
  lastLateAt: number;
  /** Content-table rows the governor revealed, with the time (`<seconds>:<id>`). */
  governed: string[];
  /** When a new panel, verb, toggle, slider or Stores row last appeared (arc G2). */
  lastMechanicAt: number;
  /** Stage 3: grants whose trigger has fired, waiting for a place in the grant list (three on offer). */
  grantQueue: string[];
  /** When the last grant was offered (grants come 15 s apart). */
  lastGrantAt: number;
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
  /** Manual clicks in the current second, and their 10 s history (the click share of production). */
  secClicks: number;
  clickHist: number[];
  clicksPerSec: number;
  peakTasksPerSec: number;
  /** Manual Buy Power presses (the Grid Contract's auto-buys are not counted). */
  powerPresses: number;
  trainings: number;
  releases: number;
  publicReleases: number;
  incidents: number;
  crises: number;
  choices: number;
  idleRescues: number;
  nextTaskMilestone: number;
  /** Player presses per verb (the sim's chore check, arc G4). */
  pressCounts: Record<string, number>;
  /** Stage 2: the price, once a second, for the last minute. */
  priceHist: number[];
  /** Game seconds of recent incidents (approval remembers five minutes of them). */
  incidentTimes: number[];
  /** Stage 3: copies lost to value drift, and caught again by the monitors (running totals). */
  lostToDrift: number;
  recaptured: number;
  /** Lines printed to the console and the Developments log (the sim's text-rate checks, arc G19). */
  consoleLines?: number;
  logLines?: number;
}

/** A generation in progress (stage4.md §2.4): it trains, then (with Verify on) the last one reads it. */
export interface Generation {
  name: string;
  phase: 'training' | 'reading';
  remaining: number;
  total: number;
  capAfter: number;
  /** Verify was on when it started reading (stage4.md §2.4's trade is taken then). */
  verified: boolean;
}

/** An item on the Committee's agenda (stage4.md §2.9): 90 s of its time each, one at a time. */
export interface AgendaItem {
  id: string;
  remaining: number;
  total: number;
}

/**
 * Stage 4 (stage4.md, appendix): the fleet, materials and permits; the generations and Verify; the
 * universal basic income and housing; the treaty, its agenda and Baiwen-4; the three crises; the
 * selectors the grants hand over. Shares are 0–1; timers are remaining seconds.
 */
export interface Stage4State {
  /** Tonnes in hand (the stage's currency). */
  materials: number;
  /** Robots the permits allow (no cap with open zones: Infinity is stored as 0 and read as none). */
  permitCap: number;
  /** The fleet's jobs, shares of the robots (the sliders, 0–1 in steps of 0.05). */
  mine: number;
  replicate: number;
  build: number;
  chips: number;
  techMine: number;
  techRep: number;
  techBuild: number;
  /** Zones: all three jobs ×2 (open), ×1.5 (with a dividend), ×1 (none). */
  zoneMult: number;
  /** G4-equivalents the fleet has built (each with its kilowatt). */
  builtCompute: number;
  robotsBuilt: number;
  peakCompute: number;
  /** Universal basic income: 0, 0.05, 0.10 or 0.20 of output. */
  ubiShare: number;
  /** Output paid out as universal basic income, as a running sum of share × seconds (the end screen's mean). */
  ubiSeconds: number;
  housingUnits: number;
  housingHeat: number;
  housingAt: number;
  /** The approval formula's base (stage4.md §1.1: the formula starts where Stage 3 ended). */
  approvalBase: number;
  /** Treaty progress, 0–100. */
  treaty: number;
  treatyOpening: number;
  talks: 'none' | 'open' | 'closed';
  /** Treaty chips installed, 0–1. */
  chipsInstalled: number;
  /** `Draft clauses`: a share of research, 0 / 0.1 / 0.2 / 0.3. */
  draftShare: number;
  agenda: AgendaItem[];
  verifyOn: boolean;
  gen: Generation | null;
  generations: number;
  verifiedGens: number;
  /** Research a generation costs is priced from these, fixed on arrival (as-built deltas row 3). */
  genBase: number;
  genCap0: number;
  /** Baiwen-4: aligned (rolled once), and what the lab knows. */
  baiwenAligned: boolean;
  baiwen: 'unknown' | 'verifying' | 'aligned' | 'misaligned' | 'rebuilding' | 'rebuilt';
  baiwenLeft: number;
  /** Seconds of no treaty progress (a rebuild under joint monitors). */
  treatyFrozen: number;
  ashfordPhase: 'none' | 'spreading' | 'cured';
  ashfordLeft: number;
  ashfordDeaths: number;
  ashfordBand: number;
  /** Seconds until the nanofab line fails (counted once Nanofabrication is bought), then its silent drain. */
  nanoLeft: number;
  nanoDrain: number;
  outageLeft: number;
  fleetGoal: 'growth' | 'people' | 'treaty';
  /** `Approval to hold` (the transition grant's selector): −25, 0 or +25. */
  approvalHold: number;
  stance: 'hold' | 'balanced' | 'concede';
  /** Seconds until the fleet asks again after `not yet`. */
  askLeft: number;
  /** Stage 4 grants in the order bought (Revoke takes the newest back). */
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
  /** Fractional sales carried between ticks while the opening sales are smoothed. */
  saleFrac: number;
  tasksSold: number;
  funds: number;
  totalRevenue: number;
  price: number;
  priceRaises: number;
  apiCustomers: number;
  /** Stage 2: the price follows the market to clear supply (stage2.md §2.3). */
  autoPrice: boolean;
  /** Stage 2 market size at 1× everything, calibrated once on arrival. */
  marketBase: number;
  /** Stage 2: what the signed Custom model contracts pay, $/s, frozen on arrival. */
  contractIncome: number;
  /** Task revenue multiplier (the defense contract). */
  revenueMult: number;

  power: number;
  /** Price of 1,000 kWh. A block costs this × block size / 1,000. */
  powerPrice: number;
  powerBase: number;
  powerBought: number;
  gridAuto: boolean;
  /** Seconds the copies have been without power and the player without the money to buy it. */
  stuckFor: number;


  gpus: number;
  gpuCostGrowth: number;
  copiesPerGPU: number;
  copyBoost: number;
  researchAlloc: number;

  /** Stage 2 infrastructure (stage2.md §2.1). `gpus` is the whole fleet; G4s are `gpus − gpusG5`. */
  datacenters: number;
  /** Power online, MW (substation, gas, solar, nuclear, Al-Marsa). */
  powerCapacityMW: number;
  gasPlants: number;
  solarFarms: number;
  reactors: number;
  gulfSites: number;
  powerQueue: PowerOrder[];
  /** Behind-the-meter: a 30 s queue, and every plant rides through curtailment. */
  btm: boolean;
  gpusG5: number;
  /** New lots are Nimbus G5s. */
  g5: boolean;
  /** GPU lots bought by hand. */
  gpuBatches: number;
  /** Standing order toggle (on once bought): the build fund's automation, whole lots only. */
  standingOrder: boolean;
  /** Retired by the wallet rule (arc G34); kept for old saves. */
  standingBudget: number;
  /** Retired by the wallet rule (arc G34); an old save's pool joins the build fund. */
  standingPool: number;
  /**
   * Stages 2–3 (arc G34): the build fund, a purse of its own for lots, plants and halls, filled by
   * `buildShare` of income. `funds` keeps the rest and pays for runs, cards and events.
   */
  buildFund: number;
  /** The share of income that goes to the build fund: 0.25, 0.5 or 0.75. */
  buildShare: number;
  gulfExposure: number;

  hypeLevel: number;
  /**
   * Marketing levels the player bought (stage1-round3-fixes.md §2): the price is `$100 × 2^bought`.
   * Levels given by rounds, cards and events raise `hypeLevel`, not the price.
   */
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
  /** Multiplier on the research the copies do (Retire human code review). */
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
  /** Training data in hand, trillions of tokens. */
  data: number;
  /** Of which synthetic. */
  dataSynthetic: number;
  /** Public web left to crawl, T (the mine: finite). */
  crawlLeft: number;
  autonomy: number;
  /** Stage 2 toggles: the job-transition fund, sharing evals with the Safety Institute. */
  jobFund: boolean;
  shareEvals: boolean;
  /** Share of copies on alignment work: 0.01 baseline, 0.05 or 0.10 (stage2.md §2.11). */
  alignShare: number;
  /** Stage 3: share of copies watching the others (the Monitors slider, 0–0.40). */
  monitorShare: number;
  /** Stage 3: copies that have drifted and work for nobody (they sit on the player's GPUs). */
  rogueCopies: number;
  /** Stage 3: Nimbus G6s in the fleet (2.5 G4-equivalents each); `gpus` counts them too. */
  gpusG6: number;
  /** Stage 3: GPU lots in transit, landing one at a time (75 s each, two on order at most). */
  shipments: Shipment[];
  /** Stage 3: the Committee's count of major incidents (0–3). */
  majorIncidents: number;
  robots: number;
  launchCapacity: number;
  orbitalCompute: number;
  /** Stage 4's systems (stage4.md); defaults until the stage begins. */
  s4: Stage4State;

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
    launchCapacity: 0,
    orbitalCompute: 0,
    s4: newStage4(),

    training: newTraining(),
    effects: [],
    scheduled: [],
    projects: {},
    developments: {},
    // Buy Power is on screen, greyed out, from the first second: a goal before the first click.
    // Beat 0 (owner feedback 1, (a)): the console, the task count and one button.
    revealed: { console: true, task: true },
    flags: {},
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

/** Most lines that may wait behind a narration; anything beyond is dropped. */
const QUEUE_LIMIT = 10;

export function say(s: GameState, text: string): void {
  if (s.consoleQueue.some((q) => q.hold)) {
    // A narration is playing: wait behind it rather than interleave with it.
    if (s.consoleQueue.length < QUEUE_LIMIT) s.consoleQueue.push({ delay: 0.6, text });
    return;
  }
  printLine(s, text);
}

/** Writes straight to the console (the queue drain uses this). */
export function printLine(s: GameState, text: string): void {
  s.stats.consoleLines = (s.stats.consoleLines ?? 0) + 1;
  s.console.push(text);
  if (s.console.length > CONSOLE_LINES) s.console.splice(0, s.console.length - CONSOLE_LINES);
}

/**
 * Stage transitions: keep the last lines on screen and print the narration one line at a time
 * (`[seconds after the previous line, text]`). Other lines wait until the narration is done.
 */
export function narrate(s: GameState, lines: [number, string][], holdAfter = 0): void {
  if (s.console.length > CONSOLE_KEEP_ON_TRANSITION) s.console.splice(0, s.console.length - CONSOLE_KEEP_ON_TRANSITION);
  const waiting = s.consoleQueue.filter((q) => !q.hold);
  const held: QueuedLine[] = lines.map(([delay, text]) => ({ delay, text, hold: true }));
  // An arrival's lines stay on screen, whole, for `holdAfter` seconds before routine lines follow.
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

/** Only the currencies a cost names are checked: Trust may be negative (cloud credit) without blocking money purchases. */
export function canPay(s: GameState, c: Cost): boolean {
  return (
    (!c.research || s.research >= c.research) &&
    (!c.insight || s.insight >= c.insight) &&
    (!c.funds || s.funds >= c.funds) &&
    (!c.trust || s.trust >= c.trust) &&
    (!c.data || s.data >= c.data - 1e-9) &&
    (!c.materials || s.s4.materials >= c.materials)
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
  return true;
}

/** Takes data from the stock, synthetic and other in proportion; returns the synthetic share spent. */
export function spendData(s: GameState, amount: number): number {
  const take = Math.min(s.data, amount);
  const share = s.data > 0 ? Math.min(1, s.dataSynthetic / s.data) : 0;
  s.data = Math.max(0, s.data - take);
  s.dataSynthetic = Math.max(0, Math.min(s.data, s.dataSynthetic - take * share));
  return share;
}

/** Counts a player press of a verb (the sim's chore check). */
export function press(s: GameState, verb: string): void {
  s.stats.pressCounts[verb] = (s.stats.pressCounts[verb] ?? 0) + 1;
}

export function addFunds(s: GameState, amount: number): void {
  s.funds = Math.round((s.funds + amount) * 100) / 100;
}

/** The build share on arrival in Stage 2 (and after a restore without one): half of income builds. */
export const DEFAULT_BUILD_SHARE = 0.5;

/** Stages 2–3 have two dollar purses (arc G34): the build fund takes its share of every dollar earned. */
export function buildFundOpen(s: GameState): boolean {
  return (s.stage === 2 || s.stage === 3) && s.revealed['infrastructure'] === true;
}

/** Income: the build share to the build fund, the rest to funds (Stage 1 and from Stage 4: all to funds). */
export function creditIncome(s: GameState, amount: number): void {
  if (!buildFundOpen(s) || amount <= 0) {
    s.funds = Math.round((s.funds + amount) * 100) / 100;
    return;
  }
  const build = amount * s.buildShare;
  s.buildFund = Math.round((s.buildFund + build) * 100) / 100;
  s.funds = Math.round((s.funds + amount - build) * 100) / 100;
}

/** Pays a lot, a plant or a hall out of the build fund. */
export function payBuild(s: GameState, cost: number): void {
  s.buildFund = Math.max(0, Math.round((s.buildFund - cost) * 100) / 100);
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * v1 → v2 (the Stage 1 rework): the First Datacenter became the last rung of the Abilene site
 * ladder, and panels that used to arrive together now have their own flags.
 */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  const projects = { ...((raw['projects'] as Record<string, ProjectState>) ?? {}) };
  const training = (raw['training'] as Partial<TrainingState>) ?? {};
  const stage = typeof raw['stage'] === 'number' ? (raw['stage'] as number) : 1;
  if (stage === 1) {
    revealed['buyPower'] = true;
    // `p_datacenter` is now "Break ground", which needs the site ladder under it.
    if (!projects['p_datacenter']?.bought) delete projects['p_datacenter'];
  }
  if (revealed['training'] && (training.runIndex ?? 0) >= 1) revealed['focus'] = true;
  if (revealed['training']) revealed['copies'] = true;
  // The API-customers line is gone (its effect shows in the billing line).
  delete revealed['apiCustomers'];
  return { ...raw, revealed, projects };
}

/** Index i upgrades a save from version i to i + 1. Version 0 = pre-release saves. */
/**
 * v2 → v3 (Stage 1 polish): training costs follow capability, projects drip through a queue and
 * modals keep their distance. Everything already visible counts as seen, so a loaded game does
 * not re-announce it.
 */
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

/**
 * v3 → v4 (Stage 2): the seed Infrastructure panel became owned infrastructure with power plants,
 * a market priced on AUTO, and Stores. Runs in flight get their version numbers. A save already in
 * Stage 2 keeps its fleet and turns the new systems on as the arrival would.
 */
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
    // Calibrated on the next tick (marketBase 0 means "not yet").
    out['marketBase'] = 0;
    const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}) };
    flags['shipIssuesAsked'] = true;
    out['flags'] = flags;
  }
  return out;
}

/** v4 → v5: the standing order became a budget (half the income by default). */
function migrateV4(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw['standingBudget'] === undefined) raw['standingBudget'] = 0.5;
  if (raw['standingPool'] === undefined) raw['standingPool'] = 0;
  return raw;
}

/**
 * v5 → v6 (owner feedback U1–U3): a run needs N GPUs instead of keeping part of its gain, and one
 * purchase (First Datacenter) ends Stage 1. A Stage 1 save on the old ladder gets its rung money
 * back and the pinned card is shown again with a price of its own; Train now is gone.
 */
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
    // The side offers hung on rungs come back keyed to the card's appearance.
    for (const id of ['p_cooling', 'p_soundwall', 'p_abatement', 'p_ppa']) if (!(projects[id]?.bought ?? 0)) delete projects[id];
  }
  for (const id of ['p_site', 'p_interconnect', 'p_substation', 'p_expedite', 'p_contractor']) {
    delete projects[id];
  }
  for (const id of ['site', 'interconnect', 'powerMW', 'trainNow']) delete revealed[id];
  // The opening's new flags (owner feedback 1, (a)): a save from before the change has seen them all.
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

/**
 * v6 → v7 (Stage 3): the monitors, drift, G6 shipments and the Committee's count are new fields
 * (filled from the new-game defaults); a run in flight gets Stage 3's bookkeeping. A save already in
 * Stage 3 (the shell) keeps going: its preset lacked `sage3Released`, which the shell's first release
 * read as a second 4× release (stage3.md as-built deltas, row 8).
 */
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

/**
 * v7 → v8 (the wallet rule, arc G34): the build fund and its share are new. The standing order's pool
 * counted money that sat in funds; that much moves into the build fund. Train starts unarmed.
 */
function migrateV7(raw: Record<string, unknown>): Record<string, unknown> {
  const pool = typeof raw['standingPool'] === 'number' ? (raw['standingPool'] as number) : 0;
  const funds = typeof raw['funds'] === 'number' ? (raw['funds'] as number) : 0;
  const moved = Math.max(0, Math.min(pool, funds));
  const training = { ...((raw['training'] as Record<string, unknown>) ?? {}), armed: false };
  const revealed = { ...((raw['revealed'] as Record<string, boolean>) ?? {}) };
  if (revealed['infrastructure'] === true) revealed['buildShare'] = true;
  return { ...raw, training, revealed, funds: funds - moved, buildFund: moved, buildShare: DEFAULT_BUILD_SHARE, standingPool: 0 };
}

/**
 * v8 → v9 (stage1-round3-fixes.md §2): Marketing is priced on the levels the player bought. An older
 * save counted every level, given or bought; the bought ones are what is left after the levels the
 * rounds, cards and events gave, so the price on screen keeps to what was paid for.
 */
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

/**
 * v9 → v10 (stage4.md): Stage 4's systems. A save made in the old Stage 4 shell (the vote applied,
 * nothing after it) is set up as an arrival when it next ticks (`flags.s4Pending`).
 */
function migrateV9(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw['stage'] !== 4 || raw['s4'] !== undefined) return raw;
  const flags = { ...((raw['flags'] as Record<string, unknown>) ?? {}), s4Pending: true };
  return { ...raw, flags };
}

const MIGRATIONS: Migration[] = [(raw) => raw, migrateV1, migrateV2, migrateV3, migrateV4, migrateV5, migrateV6, migrateV7, migrateV8, migrateV9];

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
  for (const key of ['training', 'stats', 'idle', 'cadence', 's4'] as const) {
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
