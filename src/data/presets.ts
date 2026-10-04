import { GameState, newGame, ModelRecord, RivalRecord, ChoiceRecord } from '../engine/state.js';
import { rng, seedFrom } from '../engine/rng.js';
import { enterStage } from '../engine/stages.js';
import { step, actions } from '../engine/tick.js';
import { voteReady } from '../engine/oversight.js';
import { policyStep, newBotMemory } from '../sim/policy.js';
import { DEVELOPMENTS } from './developments.js';

export interface Preset {
  stage: number;
  label: string;
  /** False for stages whose content is not built yet; they load the latest real preset. */
  ready: boolean;
  build: (seed: number) => GameState;
}

/**
 * Stage 1 projects the median run had bought at First Datacenter: bot, seeds 1–5 (20:14 / 20:31 / 21:40 /
 * 21:15 / 20:40); seed 2, the median of the income the five bring into Stage 2 ($3,494/s of $2,822–4,936)
 * and within 10 s of the median time (seed 5, which brings the least).
 */
const STAGE1_BOUGHT = [
  'p_prompting', 'p_grid', 'p_insight', 'p_training', 'p_prompting2', 'p_seed', 'p_prompting3', 'p_blogpost',
  'p_lab_cluster', 'p_eval_team', 'p_api', 'p_compute_deal', 'p_dogfood', 'p_pricing', 'p_series_a',
  'p_desks', 'p_enterprise', 'p_contract', 'p_distributed', 'p_floor', 'p_auto_pricing', 'p_region', 'p_ppa',
  'p_abatement', 'p_reserved',
];
/** Repeatables and the cards bought more than once by then. */
const STAGE1_REPEATS: Record<string, number> = { p_desks: 2, p_contract: 7 };

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.118, date: 1.76, public: true },
  { name: 'Sage-1.2', capability: 1.262, date: 2.3, public: true },
  { name: 'Sage-1.3', capability: 1.411, date: 3.04, public: true },
  { name: 'Sage-1.4', capability: 1.601, date: 3.78, public: true },
  { name: 'Sage-1.5', capability: 1.813, date: 4.41, public: true },
];

const STAGE1_RIVALS: RivalRecord[] = [
  { name: 'Cadence-2', capability: 1.099, date: 1.37 },
  { name: 'Cadence-3', capability: 1.378, date: 2.47 },
  { name: 'Cadence-4', capability: 1.657, date: 3.98 },
];

const STAGE1_CHOICES: ChoiceRecord[] = [
  { id: 'c_bridge', option: 'no bridge', date: 'Sep 2025' },
  { id: 'c_rival', option: 'open-sourced', date: 'Sep 2025' },
  { id: 'c_journalist', option: 'system card', date: 'Oct 2025' },
  { id: 'c_letter', option: 'signed', date: 'Nov 2025' },
  { id: 'c_poach', option: 'matched', date: 'Nov 2025' },
];

/**
 * The state the bot hands over at the moment it buys First Datacenter: the median of seeds 1–5
 * (`npm run sim`, bot policy; seed 2 at 20:31), rebuilt after the wallet rule and Stage 1's round 3 (a run costs money
 * and GPUs, five rented runs, the wall at 1.68×). Every field the run had changed from a new game, its
 * flags included, so the preset is that run's real state. `enterStage(2)` then plays the real arrival:
 * the rented GPUs go back for a deposit into the build fund, 1,000 owned GPUs, lab room, the contracts'
 * share of sales frozen as their rate, the arrival scale from the income it brings.
 */
function stage1End(seed: number): GameState {
  const s = newGame(seed);
  Object.assign(s, {
    date: 5.1329,
    tasks: 255404,
    unbilled: 387,
    taskFrac: 0.85422,
    saleFrac: 0.864,
    tasksSold: 255017,
    funds: 1642.5,
    totalRevenue: 701710,
    price: 5.3172,
    priceRaises: 110,
    autoPrice: true,
    power: 11788,
    powerPrice: 12.76,
    powerBase: 14.586,
    powerBought: 41,
    gridAuto: true,
    gpus: 132,
    gpuCostGrowth: 1.06,
    copyBoost: 2.5,
    hypeLevel: 13,
    marketingBought: 10,
    hypeBoost: 1.5147,
    demandMult: 7.623,
    trust: 0,
    nextTrust: 332000,
    fib1: 610,
    fib2: 987,
    researchers: 25,
    labSpace: 8,
    labMult: 4,
    research: 9794,
    insight: 27.568,
    insightUnlocked: true,
    researchMult: 1.25,
    capability: 1.8127,
    rivalCapability: 1.6574,
    rivalVersion: 4,
    nextRivalIn: 123,
    alignmentApparent: 52,
    alignmentTrue: 51,
    govRelations: 51.25,
    lead: 2,
  });
  Object.assign(s.training, {
    focus: "capability",
    runIndex: 5,
    nextRunId: 6,
    major: 1,
    minor: 5,
    modelName: "Sage-1.5",
    deployedName: "Sage-1.5",
    internalCapability: 1.8127,
    frontierBonus: 0,
    cooldown: 0,
    releaseWait: 0,
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
  s.rivalHistory = STAGE1_RIVALS.map((r) => ({ ...r }));
  Object.assign(s.flags, {
    unbilledSeen: 387,
    clicks: 192,
    peakRev: 3248.2,
    firstGpuAt: 5.9,
    beatAt: 150.5,
    firstPriceMoveAt: 90.3,
    priceMoves: 161,
    powerOut: false,
    trustMilestones: 12,
    researchAt: 150.5,
    atCap: false,
    hitCap: true,
    projectsAt: 190.6,
    "wall:1000": true,
    wallSaidAt: 263,
    wallLineKey: "Training Pipeline|1000|More room comes with Trust.",
    wallLineCount: 1,
    trainingDue: true,
    trainingAt: 300.1,
    armedRuns: 5,
    maxBenchmark: 7.1,
    redTeamed: true,
    "rprice:p_eval_team": 6800,
    releasedAt: 1059.4,
    firstReleaseAt: 423.5,
    releasesThisStage: 5,
    lastReleaseAt: 1059.4,
    cheapAt: 988,
    s1MechanicAt: 1144,
    "rprice:p_api": 6800,
    calendarOpened: true,
    eventAnsweredAt: 1146.7,
    seriesABonus: 5000,
    "rprice:p_dogfood": 6800,
    "rprice:p_pricing": 6800,
    seriesAAt: 652.9,
    "rprice:p_enterprise": 6800,
    "rprice:p_distributed": 6800,
    "price:p_floor": 8000,
    dcCardAt: 713.9,
    "price:p_cooling": 45000,
    quotaSaid100: true,
    trainingCompute: 1.5,
    "rprice:p_auto_pricing": 13600,
    "rprice:p_alignment_team": 25000,
    ppa: true,
    "rprice:p_batch": 27200,
    quotaSaid120: true,
    wallAt: 1060,
    dcWallPrice: 295850,
    wallLineAt: 1060,
    "rprice:p_renewals": 27200,
    "price:p_soundwall": 300000,
  });
  Object.assign(s.stats, {
    timePlayed: 1231.9,
    trainings: 5,
    releases: 5,
    publicReleases: 5,
    incidents: 0,
    crises: 2,
    choices: 5,
    idleRescues: 0,
    powerPresses: 4,
    peakTasksPerSec: 531.1,
    nextTaskMilestone: 1000000,
    revPerSec: 2676.8,
    soldPerSec: 495.6,
    tasksPerSec: 531.1,
    lastTasks: 254926,
    taskHist: Array(10).fill(531.1),
    revHist: Array(10).fill(2676.8),
    soldHist: Array(10).fill(495.6),
  });
  s.choicesMade = STAGE1_CHOICES.map((c) => ({ ...c }));
  for (const id of STAGE1_BOUGHT) s.projects[id] = { shown: true, bought: STAGE1_REPEATS[id] ?? 1 };
  s.projects['p_datacenter'] = { shown: true, bought: 1 };
  for (const d of DEVELOPMENTS) if (d.stage === 1) s.developments[d.id] = true;
  for (const id of [
    'console', 'task', 'business', 'compute', 'fleet', 'power', 'buyPower', 'pricing', 'marketing',
    'revPerSec', 'research', 'hireResearcher', 'projects', 'gridContract', 'log', 'insight', 'expandLab',
    'training', 'focus', 'quota', 'contracts', 'autoPrice',
  ]) {
    s.revealed[id] = true;
  }
  s.cadence.seen = Object.keys(s.revealed).map((k) => `f:${k}`).concat(STAGE1_BOUGHT.map((id) => `p:${id}`), ['p:p_datacenter']);
  s.log = [];
  s.console = [];
  return s;
}

function stage2(seed: number): GameState {
  const s = stage1End(seed);
  enterStage(s, 2);
  return s;
}

// ---------- Stage 3 start: the sim's median Stage 2 exit (bot, seeds 1–5 from the Stage 2 preset) ----------

/**
 * Projects bought by the median run (seed 2) when Sage-3 shipped: the bot's exits from the rebuilt
 * Stage 2 preset take 36:28 / 36:46 / 39:09 / 37:43 / 35:52 (seeds 1–5). Stage 1's cards included.
 */
const STAGE2_BOUGHT = [
  'p_prompting', 'p_grid', 'p_insight', 'p_training', 'p_prompting2', 'p_seed', 'p_prompting3', 'p_blogpost',
  'p_lab_cluster', 'p_eval_team', 'p_api', 'p_compute_deal', 'p_dogfood', 'p_pricing', 'p_series_a',
  'p_desks', 'p_enterprise', 'p_contract', 'p_distributed', 'p_floor', 'p_auto_pricing', 'p_region', 'p_ppa',
  'p_abatement', 'p_reserved', 'p_datacenter', 'p_demo', 'p_workshop', 'p_moe', 'p_web_crawl', 'p_synth',
  'p_alignment_team', 'p_batch', 'p_recruiter', 'p_agents', 'p_safety_framework', 'p_ai_assistants',
  'p_research_cluster', 'p_keynote', 'p_series_b', 'p_agent_platform', 'p_standing_order', 'p_scaffold',
  'p_policy', 'p_international', 'p_sl2', 'p_exp_scheduler', 'p_spec', 'p_auto_evals', 'p_g5', 'p_free_tier',
  'p_brief', 'p_parallel', 'p_memory', 'p_distill', 'p_btm', 'p_dashboard', 'p_series_c',
  'p_checkpoint_farm', 'p_flywheel', 'p_honesty_evals', 'p_code_review',
];
const STAGE2_REPEATS: Record<string, number> = { p_desks: 2, p_contract: 7 };

/** Every model of the median run, Stage 1's included. */
const STAGE2_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.118, date: 1.76, public: true },
  { name: 'Sage-1.2', capability: 1.262, date: 2.3, public: true },
  { name: 'Sage-1.3', capability: 1.411, date: 3.04, public: true },
  { name: 'Sage-1.4', capability: 1.601, date: 3.78, public: true },
  { name: 'Sage-1.5', capability: 1.813, date: 4.41, public: true },
  { name: 'Sage-2', capability: 2, date: 7.21, public: true },
  { name: 'Sage-2.1', capability: 2.14, date: 8.65, public: true },
  { name: 'Sage-2.2', capability: 2.318, date: 9.8, public: true },
  { name: 'Sage-2.3', capability: 2.48, date: 11.4, public: true },
  { name: 'Sage-2.4', capability: 2.654, date: 12.55, public: true },
  { name: 'Sage-2.5', capability: 2.897, date: 13.34, public: true },
  { name: 'Sage-2.6', capability: 3.099, date: 14.35, public: true },
  { name: 'Sage-2.7', capability: 3.395, date: 14.91, public: true },
  { name: 'Sage-2.8', capability: 3.632, date: 15.75, public: true },
  { name: 'Sage-3', capability: 4, date: 16.51, public: true },
];

const STAGE2_RIVALS: RivalRecord[] = [
  { name: 'Cadence-2', capability: 1.099, date: 1.37 },
  { name: 'Cadence-3', capability: 1.378, date: 2.47 },
  { name: 'Cadence-4', capability: 1.657, date: 3.98 },
  { name: 'Cadence-5', capability: 1.724, date: 7.29 },
  { name: 'Cadence-6', capability: 2.12, date: 9.19 },
  { name: 'Cadence-7', capability: 2.538, date: 11.18 },
  { name: 'Cadence-8', capability: 2.695, date: 12.77 },
  { name: 'Cadence-9', capability: 3.107, date: 13.99 },
  { name: 'Cadence-10', capability: 3.741, date: 15.69 },
];

const STAGE2_CHOICES: ChoiceRecord[] = [
  { id: 'c_bridge', option: 'no bridge', date: 'Sep 2025' },
  { id: 'c_rival', option: 'open-sourced', date: 'Sep 2025' },
  { id: 'c_journalist', option: 'system card', date: 'Oct 2025' },
  { id: 'c_letter', option: 'signed', date: 'Nov 2025' },
  { id: 'c_poach', option: 'matched', date: 'Nov 2025' },
  { id: 'c_sage2', option: 'public', date: 'Feb 2026' },
  { id: 'c_hearing', option: 'testified', date: 'Mar 2026' },
  { id: 'c_gulf', option: 'domestic', date: 'Jun 2026' },
  { id: 'c_evals_month', option: 'week', date: 'Jul 2026' },
  { id: 'c_defense', option: 'signed', date: 'Aug 2026' },
  { id: 'c_publishers', option: 'licensed', date: 'Sep 2026' },
  { id: 'c_pact', option: 'signed', date: 'Oct 2026' },
];

const STAGE2_REVEALED = [
    'console', 'task', 'business', 'fleet', 'pricing', 'marketing', 'revPerSec', 'research', 'projects',
    'log', 'insight', 'training', 'focus', 'quota', 'autoPrice', 'infrastructure', 'stores', 'buildShare',
    'hireFaded', 'gasButton', 'lot5', 'copies', 'dataRow', 'releaseInternal', 'graph', 'solarButton',
    'dcButton', 'allocation', 'standingOrder', 'government', 'lot25', 'security', 'evalLine', 'public',
    'queue', 'nuclearButton', 'secondPipeline', 'jobFund', 'stats', 'sl3Button', 'shareEvals',
];

/**
 * The state on the last tick of Stage 2, with Sage-3 just shipped: every number the median of the bot's
 * five exits (stage3.md §1.1's fields and the rest), the median run's records, flags and lists. Rebuilt
 * after the wallet rule and Stage 1's round 3.
 */
function stage2End(seed: number): GameState {
  const s = stage2(seed);
  Object.assign(s, {
    date: 16.506,
    tasks: 18814260173,
    unbilled: 1.6337e7,
    taskFrac: 0.58047,
    tasksSold: 1.8807e10,
    funds: 3.8604e7,
    totalRevenue: 4.6991e8,
    price: 0.014869,
    revenueMult: 1.12,
    gpus: 541000,
    copiesPerGPU: 6.5588,
    copyBoost: 4.6875,
    researchAlloc: 0.1,
    datacenters: 8,
    powerCapacityMW: 555,
    gasPlants: 10,
    solarFarms: 7,
    btm: true,
    gpusG5: 485000,
    g5: true,
    gpuBatches: 144,
    buildFund: 1.1443e6,
    hypeLevel: 20,
    hypeBoost: 1.9996,
    demandMult: 30.443,
    trust: 42,
    nextTrust: 24157817000,
    fib1: 24157817,
    fib2: 39088169,
    researchers: 28,
    labMult: 256,
    research: 3328000,
    insight: 10767,
    aiResearchMult: 1.5,
    capability: 4,
    rivalCapability: 3.7407,
    rivalVersion: 10,
    nextRivalIn: 258,
    alignmentApparent: 85.5,
    alignmentTrue: 48,
    securityLevel: 3,
    govRelations: 75.759,
    approval: -15.329,
    jobsDisplaced: 2.038,
    lead: 2.01,
    data: 52.679,
    dataSynthetic: 41.017,
    autonomy: 5,
    jobFund: true,
    shareEvals: true,
    alignShare: 0.05,
    powerQueue: [],
  });
  Object.assign(s.training, {
    run: null,
    pending: null,
    armed: false,
    focus: "capability",
    runIndex: 15,
    nextRunId: 16,
    major: 3,
    minor: 0,
    modelName: "Sage-3",
    deployedName: "Sage-3",
    internalCapability: 4,
    frontierBonus: 0,
    cooldown: 0,
    releaseWait: 0,
    models: STAGE2_MODELS.map((m) => ({ ...m })),
  });
  s.rivalHistory = STAGE2_RIVALS.map((r) => ({ ...r }));
  Object.assign(s.flags, {
    unbilledSeen: 387,
    clicks: 192,
    peakRev: 3248.2,
    firstGpuAt: 5.9,
    beatAt: 150.5,
    firstPriceMoveAt: 90.3,
    priceMoves: 161,
    powerOut: false,
    trustMilestones: 34,
    researchAt: 150.5,
    atCap: true,
    hitCap: true,
    projectsAt: 190.6,
    "wall:1000": true,
    wallSaidAt: 263,
    wallLineKey: "Training Pipeline|1000|More room comes with Trust.",
    wallLineCount: 1,
    trainingDue: true,
    trainingAt: 300.1,
    armedRuns: 15,
    maxBenchmark: 9.6,
    redTeamed: true,
    "rprice:p_eval_team": 6800,
    releasedAt: 3438.1,
    firstReleaseAt: 423.5,
    releasesThisStage: 10,
    lastReleaseAt: 3438.1,
    cheapAt: 988,
    s1MechanicAt: 1144,
    "rprice:p_api": 6800,
    calendarOpened: true,
    eventAnsweredAt: 1146.7,
    seriesABonus: 5000,
    "rprice:p_dogfood": 6800,
    "rprice:p_pricing": 6800,
    seriesAAt: 652.9,
    "rprice:p_enterprise": 6800,
    "rprice:p_distributed": 6800,
    "price:p_floor": 8000,
    dcCardAt: 713.9,
    "price:p_cooling": 45000,
    quotaSaid100: true,
    trainingCompute: 1.5,
    "rprice:p_auto_pricing": 13600,
    "rprice:p_alignment_team": 25000,
    ppa: true,
    "rprice:p_batch": 27200,
    quotaSaid120: true,
    wallAt: 1060,
    dcWallPrice: 295850,
    wallLineAt: 1060,
    "rprice:p_renewals": 27200,
    "price:p_soundwall": 300000,
    gamblesThisStage: 1,
    pressReleases: 0,
    emailsThisStage: 0,
    s2Scale: 0.96,
    dataEra: true,
    shipIssuesAsked: true,
    dataShortNow: false,
    stallSaid: false,
    arrivalPrice: 0.32409,
    r0: 1310.2,
    lotByHandAt: 3438,
    "wall:52000": true,
    capLineAt: 3101.9,
    runsS2: 10,
    "price:p_synth": 45000,
    "price:p_recruiter": 180000,
    "rprice:p_agents": 31000,
    "noPower:5": true,
    "rprice:p_safety_framework": 35000,
    sage2Decided: true,
    wallWatchAt: 1486.9,
    firstGasAt: 1494.4,
    graphDirty: true,
    rivalS2: true,
    priceLowSince: 1531.9,
    "noRoom:1": true,
    "price:p_scaffold": 340000,
    candid: true,
    hearingDone: true,
    "price:p_sl2": 510000,
    "noRoom:2": true,
    "rprice:p_exp_scheduler": 176800,
    "price:p_spec": 680000,
    "price:p_brief": 2700000,
    "noPower:45": true,
    "noRoom:3": true,
    "wall:832000": true,
    lotFloor: 5000,
    "price:p_parallel": 1100000,
    "noPower:65": true,
    gulfBase: 4200000,
    gulfDeclined: true,
    safetyRuns: 2,
    "price:p_memory": 4400000,
    safetyReleasesS2: 2,
    safetyReleases: 2,
    "price:p_distill": 4100000,
    "noRoom:4": true,
    evalsMonthDue: true,
    "opened:c_evals_month": true,
    "price:p_btm": 2900000,
    "price:p_dashboard": 3000000,
    "noPower:135": true,
    defenseContract: true,
    jobFundSaid: true,
    "noRoom:5": true,
    "noPower:235": true,
    "rprice:p_checkpoint_farm": 707200,
    "opened:c_publishers": true,
    dataShortCount: 1,
    licensedPublishers: true,
    publishersDone: true,
    "price:p_flywheel": 8600000,
    flywheelSold: 1.8807e10,
    "noRoom:6": true,
    "wall:3328000": true,
    "price:p_honesty_evals": 16000000,
    "noPower:405": true,
    "noPower:425": true,
    "opened:c_theft_warning": true,
    "noPower:445": true,
    "noPower:465": true,
    "opened:c_pact": true,
    pactSigned: true,
    shareEvalsSaid: true,
    "noPower:485": true,
    "price:p_code_review": 29000000,
    protested: true,
    "noPower:505": true,
    "price:p_system_card": 27000000,
    sage3Said: true,
    sage3Released: "public",
    superhumanReleased: true,
  });
  Object.assign(s.stats, {
    timePlayed: 3438.2,
    trainings: 16,
    releases: 16,
    publicReleases: 16,
    incidents: 0,
    crises: 4,
    choices: 12,
    idleRescues: 0,
    powerPresses: 4,
    peakTasksPerSec: 5.6302e7,
    nextTaskMilestone: 100000000000,
    revPerSec: 944570,
    soldPerSec: 5.6623e7,
    tasksPerSec: 5.6302e7,
    lastTasks: 18795578813,
    taskHist: Array(10).fill(5.6302e7),
    revHist: Array(10).fill(944570),
    soldHist: Array(10).fill(5.6623e7),
    priceHist: [],
  });
  s.choicesMade = STAGE2_CHOICES.map((c) => ({ ...c }));
  for (const id of STAGE2_BOUGHT) s.projects[id] = { shown: true, bought: STAGE2_REPEATS[id] ?? 1 };
  for (const d of DEVELOPMENTS) if (d.stage <= 2) s.developments[d.id] = true;
  for (const id of STAGE2_REVEALED) s.revealed[id] = true;
  s.cadence.seen = [...s.cadence.seen, ...STAGE2_REVEALED.map((k) => `f:${k}`), ...STAGE2_BOUGHT.map((id) => `p:${id}`)];
  s.cadence.queue = [];
  s.cadence.lateQueue = [];
  s.scheduled = [];
  s.effects = [];
  s.activeChoice = null;
  s.choiceQueue = [];
  s.log = [];
  s.console = [];
  s.consoleQueue = [];
  return s;
}

/** Stage 3 start (stage3.md §1.1): the median Stage 2 exit, then the arrival as the exit project runs it. */
function stage3(seed: number): GameState {
  const s = stage2End(seed);
  enterStage(s, 3);
  return s;
}

/**
 * Stage 3 start (careless), stage3.md §1.1: the same exit after a Stage 2 played for speed — Al-Marsa
 * signed (1,525 MW, Gulf exposure), the theft warning reviewed quietly, little alignment compute, the
 * public and Washington cool. Set before the arrival so its clamps and lines are the arrival's own:
 * true alignment 40 and whistleblow risk 2 after the retention penalty.
 */
function stage3Careless(seed: number): GameState {
  const s = stage2End(seed);
  Object.assign(s, {
    alignmentTrue: 43,
    alignmentApparent: 70,
    gulfExposure: 1,
    gulfSites: 1,
    powerCapacityMW: 1525,
    approval: -30,
    govRelations: 45,
    trust: 0,
    lead: 1,
    alignShare: 0.01,
  });
  Object.assign(s.flags, { whistleblowRisk: 1, theftIgnored: true, gulfSigned: true, gulfDeclined: false });
  s.choicesMade = s.choicesMade.map((c) =>
    c.id === 'c_gulf' ? { ...c, option: 'signed Al-Marsa' } : c.id === 'c_theft_warning' ? { ...c, option: 'reviewed quietly' } : c);
  enterStage(s, 3);
  return s;
}

// ---------- Stage 4 starts: the sim's median Stage 3 exits, the vote applied (stage3.md §7.3, §9.6) ----------

/**
 * The median seed of the policy's five exits from its Stage 3 preset (seeds 1–5), rebuilt with the
 * presets above: the reasonable bot from `Stage 3 start` (42:24–45:24, median seed 4 at 42:41), the
 * naive player from the careless start (46:02–49:33, median seed 4 at 46:51).
 */
const S3_MEDIAN_SEED = 4;
const S3_MEDIAN_SEED_CARELESS = 4;

/**
 * Plays Stage 3 with the simulator's policy until a model has passed 25× and the session is ready,
 * then brings the chosen motion: the state on Stage 4's first tick is a real exit, not a sketch.
 * Deterministic (seeded); about a second of CPU.
 */
function stage4From(start: (seed: number) => GameState, seed: number, policy: 'bot' | 'naive', motion: 'slow' | 'race'): GameState {
  const s = start(seed);
  const mem = newBotMemory(policy);
  for (let i = 0; i < 90 * 600 && s.stage === 3 && !s.ending; i++) {
    if (voteReady(s) && !s.activeChoice) {
      actions.buyProject(s, motion === 'slow' ? 'p_steward' : 'p_race');
      const open = s.activeChoice as { id: string } | null;
      if (open?.id === 'c_vote') actions.resolveChoice(s, 0);
      if ((s.stage as number) === 4) break;
    }
    // The policy answers modals and buys; it never brings its own motion here (voteReady is checked first).
    policyStep(s, actions, mem);
    step(s);
  }
  s.log = s.log.slice(-6);
  return s;
}

// ---------- Stage 5 starts: real Stage 4 exits (stage4.md §7.2, §9.6) ----------

/**
 * Plays Stage 4 from a Stage 4 preset with the simulator's policy until an exit fires: the state on
 * Stage 5's first tick is a real hand-over. `5c` is `4s` played by the reasonable bot to the treaty
 * (aligned); `5s` is `4cr` played by the first-timer to the fleet granted (misaligned).
 */
function stage5From(start: () => GameState, policy: 'bot' | 'naive' | 'racer'): GameState {
  const s = start();
  const mem = newBotMemory(policy);
  for (let i = 0; i < 70 * 600 && s.stage === 4 && !s.ending; i++) {
    policyStep(s, actions, mem);
    step(s);
  }
  s.log = s.log.slice(-6);
  return s;
}

/**
 * A Stage 4 start is the same Stage 3 exit for every seed; `seed` seeds what Stage 4 rolls (Baiwen-4's
 * alignment, drift, incidents), so `--seed 1…5` are five different Stage 4s from one arrival.
 */
function seeded(s: GameState, seed: number): GameState {
  s.rngSeed = seedFrom(1000003 * seed + 4);
  if (s.stage === 4) s.s4.baiwenAligned = rng(s) < 0.3;
  return s;
}

const stage4Slow = (seed = 1) => seeded(stage4From(stage3, S3_MEDIAN_SEED, 'bot', 'slow'), seed);
const stage4Race = (seed = 1) => seeded(stage4From(stage3, S3_MEDIAN_SEED, 'bot', 'race'), seed);
const stage4CarelessSlow = (seed = 1) => seeded(stage4From(stage3Careless, S3_MEDIAN_SEED_CARELESS, 'naive', 'slow'), seed);
const stage4CarelessRace = (seed = 1) => seeded(stage4From(stage3Careless, S3_MEDIAN_SEED_CARELESS, 'naive', 'race'), seed);

export const PRESETS: Preset[] = [
  { stage: 1, label: 'Stage 1 start', ready: true, build: (seed) => newGame(seed) },
  { stage: 2, label: 'Stage 2 start', ready: true, build: stage2 },
  { stage: 3, label: 'Stage 3 start', ready: true, build: stage3 },
  { stage: 4, label: 'Stage 4 start (slow)', ready: true, build: stage4Slow },
  { stage: 5, label: 'Stage 5 start (aligned)', ready: true, build: (seed) => stage5From(() => stage4Slow(seed), 'bot') },
];

/** Presets that are variants of a stage's start (`--preset 3c`, the dev overlay's second row). */
export const EXTRA_PRESETS: Record<string, Preset> = {
  '3c': { stage: 3, label: 'Stage 3 start (careless)', ready: true, build: stage3Careless },
  '4s': { stage: 4, label: 'Stage 4 start (slow)', ready: true, build: stage4Slow },
  '4r': { stage: 4, label: 'Stage 4 start (race)', ready: true, build: stage4Race },
  '4cs': { stage: 4, label: 'Stage 4 start (careless, slow)', ready: true, build: stage4CarelessSlow },
  '4cr': { stage: 4, label: 'Stage 4 start (careless, race)', ready: true, build: stage4CarelessRace },
  // Stage 5's arrivals are real Stage 4 exits; `seed` seeds that Stage 4 (stage5.md as-built deltas, item 15).
  '5c': { stage: 5, label: 'Stage 5 start (aligned: the treaty)', ready: true, build: (seed) => stage5From(() => stage4Slow(seed), 'bot') },
  '5s': { stage: 5, label: 'Stage 5 start (misaligned: the fleet granted)', ready: true, build: (seed) => stage5From(() => stage4CarelessRace(seed), 'naive') },
  '5g': { stage: 5, label: 'Stage 5 start (aligned: the fleet granted, 150 t/s)', ready: true, build: (seed) => stage5From(() => stage4Slow(seed), 'naive') },
  '5r': { stage: 5, label: 'Stage 5 start (misaligned: the treaty, the racer)', ready: true, build: (seed) => stage5From(() => stage4CarelessRace(seed), 'racer') },
};

export function presetFor(stage: number): Preset {
  return PRESETS[Math.min(PRESETS.length, Math.max(1, stage)) - 1]!;
}

/** `3`, `3c`, `4s`…: a stage number or a named variant. */
export function presetByKey(key: string): Preset | undefined {
  if (EXTRA_PRESETS[key]) return EXTRA_PRESETS[key];
  const n = Number(key);
  return Number.isFinite(n) && n >= 1 ? presetFor(n) : undefined;
}
