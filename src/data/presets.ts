import { GameState, newGame, ModelRecord, RivalRecord, ChoiceRecord } from '../engine/state.js';
import { enterStage } from '../engine/stages.js';
import { DEVELOPMENTS } from './developments.js';

export interface Preset {
  stage: number;
  label: string;
  /** False for stages whose content is not built yet; they load the latest real preset. */
  ready: boolean;
  build: (seed: number) => GameState;
}

/** Stage 1 projects the median run (bot, seed 2 of 1–5, rebuilt after the round-2 fix pass) had bought at Break ground. */
const STAGE1_BOUGHT = [
  'p_prompting', 'p_insight', 'p_grid', 'p_prompting2', 'p_training', 'p_seed', 'p_blogpost', 'p_prompting3',
  'p_lab_cluster', 'p_eval_team', 'p_demo', 'p_api', 'p_compute_deal', 'p_dogfood', 'p_series_a', 'p_site',
  'p_enterprise', 'p_distributed', 'p_pricing', 'p_batch', 'p_auto_pricing', 'p_floor', 'p_alignment_team',
  'p_recruiter', 'p_workshop', 'p_interconnect', 'p_substation', 'p_expedite', 'p_contractor', 'p_datacenter',
];

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.172, date: 1.89, public: true },
  { name: 'Sage-1.2', capability: 1.365, date: 3.04, public: true },
  { name: 'Sage-1.3', capability: 1.499, date: 3.71, public: true },
  { name: 'Sage-1.4', capability: 1.586, date: 4.51, public: true },
  { name: 'Sage-1.5', capability: 1.661, date: 5.14, public: true },
];

const STAGE1_RIVALS: RivalRecord[] = [
  { name: 'Cadence-2', capability: 1.051, date: 1.1 },
  { name: 'Cadence-3', capability: 1.095, date: 2.43 },
  { name: 'Cadence-4', capability: 1.198, date: 3.3 },
  { name: 'Cadence-5', capability: 1.348, date: 4.65 },
];

const STAGE1_CHOICES: ChoiceRecord[] = [
  { id: 'c_bridge', option: 'no bridge', date: 'Sep 2025' },
  { id: 'c_rival', option: 'open-sourced', date: 'Sep 2025' },
  { id: 'c_journalist', option: 'system card', date: 'Oct 2025' },
  { id: 'c_letter', option: 'signed', date: 'Nov 2025' },
  { id: 'c_poach', option: 'matched', date: 'Nov 2025' },
];

/**
 * The state the bot hands over at the moment it buys Break ground: the median of seeds 1–5
 * (`npm run sim`, bot policy, rebuilt after the round-2 fix pass; the median run is seed 2 at
 * 27:07). Five releases (Sage-1.5 at 1.66×), seven contract customers, Dynamic pricing on, Trust
 * spent. `enterStage(2)` then plays the real arrival: the rented GPUs go back for a deposit,
 * 1,000 owned GPUs, Trust and lab room, the contracts' share of sales frozen as their rate.
 */
function stage1End(seed: number): GameState {
  const s = newGame(seed);
  Object.assign(s, {
    date: 5.42,
    tasks: 255000,
    unbilled: 290,
    tasksSold: 254300,
    funds: 900,
    totalRevenue: 720000,
    price: 5.6,
    autoPrice: true,
    priceRaises: 107,
    power: 11000,
    powerBought: 47,
    powerBase: 20.96,
    powerPrice: 20.7,
    gridAuto: true,
    gpus: 89,
    gpuCostGrowth: 1.08,
    copiesPerGPU: 1.25,
    copyBoost: 2.5,
    hypeLevel: 9,
    hypeBoost: 1.72,
    demandMult: 7.62,
    trust: 0,
    nextTrust: 377000,
    fib1: 377,
    fib2: 610,
    researchers: 30,
    labSpace: 8,
    labMult: 4,
    research: 20270,
    insight: 96,
    insightUnlocked: true,
    researchMult: 1.25,
    capability: 1.661,
    rivalCapability: 1.516,
    rivalVersion: 5,
    nextRivalIn: 173,
    rivalHistory: STAGE1_RIVALS.map((r) => ({ ...r })),
    alignmentApparent: 57,
    alignmentTrue: 54,
    govRelations: 52,
    approval: 0,
    lead: 2,
  });
  Object.assign(s.training, {
    focus: 'capability',
    runIndex: 5,
    nextRunId: 6,
    major: 1,
    minor: 5,
    modelName: 'Sage-1.5',
    deployedName: 'Sage-1.5',
    internalCapability: 1.661,
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
  Object.assign(s.flags, {
    trustMilestones: 11,
    redTeamed: true,
    hitCap: true,
    maxBenchmark: 7.2,
    trainingCompute: 1.5,
    interconnectDone: true,
    firstReleaseAt: 567,
    priceMoves: 171,
    seriesABonus: 10000,
    leaderboardEligible: false,
  });
  Object.assign(s.stats, {
    timePlayed: 1627,
    trainings: 5,
    releases: 5,
    publicReleases: 5,
    crises: 2,
    choices: 5,
    peakTasksPerSec: 411,
    nextTaskMilestone: 1000000,
    revPerSec: 2240,
    soldPerSec: 400,
    tasksPerSec: 405,
    lastTasks: 255000,
    taskHist: Array(10).fill(405),
    revHist: Array(10).fill(2240),
    soldHist: Array(10).fill(400),
  });
  s.choicesMade = STAGE1_CHOICES.map((c) => ({ ...c }));
  for (const id of STAGE1_BOUGHT) s.projects[id] = { shown: true, bought: 1 };
  s.projects['p_contract'] = { shown: true, bought: 7 };
  for (const d of DEVELOPMENTS) if (d.stage === 1) s.developments[d.id] = true;
  for (const id of [
    'business', 'revPerSec', 'log', 'marketing', 'research', 'hireResearcher', 'expandLab', 'projects', 'insight',
    'training', 'focus', 'contracts', 'compute', 'buyPower', 'gridContract', 'autoPrice', 'site', 'interconnect', 'powerMW',
  ]) {
    s.revealed[id] = true;
  }
  s.cadence.seen = Object.keys(s.revealed).map((k) => `f:${k}`).concat(STAGE1_BOUGHT.map((id) => `p:${id}`), ['p:p_contract']);
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

/** Stage 2 projects bought by the median run (seed 4, 39:46) when Sage-3 shipped. */
const STAGE2_BOUGHT = [
  'p_agents', 'p_web_crawl', 'p_safety_framework', 'p_keynote', 'p_moe', 'p_research_cluster', 'p_ai_assistants',
  'p_series_b', 'p_standing_order', 'p_agent_platform', 'p_scaffold', 'p_spec', 'p_auto_evals', 'p_international',
  'p_policy', 'p_sl2', 'p_parallel', 'p_brief', 'p_synth', 'p_license_code', 'p_memory', 'p_exp_scheduler', 'p_g5',
  'p_free_tier', 'p_dashboard', 'p_flywheel', 'p_btm', 'p_series_c', 'p_license_archive', 'p_superhuman_coder',
];

const STAGE2_MODELS: ModelRecord[] = [
  { name: 'Sage-1.6', capability: 1.821, date: 6.66, public: true },
  { name: 'Sage-1.7', capability: 1.948, date: 7.55, public: true },
  { name: 'Sage-2', capability: 2.21, date: 8.12, public: true },
  { name: 'Sage-2.1', capability: 2.348, date: 9.03, public: true },
  { name: 'Sage-2.2', capability: 2.489, date: 9.99, public: true },
  { name: 'Sage-2.3', capability: 2.845, date: 10.78, public: true },
  { name: 'Sage-2.4', capability: 3.008, date: 12.1, public: true },
  { name: 'Sage-2.5', capability: 3.288, date: 13.39, public: true },
  { name: 'Sage-2.6', capability: 3.501, date: 14.92, public: true },
  { name: 'Sage-2.7', capability: 3.724, date: 15.87, public: true },
  { name: 'Sage-3', capability: 4.08, date: 16.69, public: true },
];

const STAGE2_RIVALS: RivalRecord[] = [
  { name: 'Cadence-6', capability: 1.67, date: 7.29 },
  { name: 'Cadence-7', capability: 1.981, date: 9.01 },
  { name: 'Cadence-8', capability: 2.24, date: 10.53 },
  { name: 'Cadence-9', capability: 2.474, date: 11.78 },
  { name: 'Cadence-10', capability: 2.953, date: 13.54 },
  { name: 'Cadence-11', capability: 3.517, date: 15.16 },
];

const STAGE2_CHOICES: ChoiceRecord[] = [
  { id: 'c_sage2', option: 'public', date: 'Mar 2026' },
  { id: 'c_hearing', option: 'testified', date: 'Mar 2026' },
  { id: 'c_publishers', option: 'licensed', date: 'Apr 2026' },
  { id: 'c_gamble', option: 'gamble', date: 'May 2026' },
  { id: 'c_defense', option: 'signed', date: 'Jun 2026' },
  { id: 'c_gulf', option: 'domestic', date: 'Jul 2026' },
  { id: 'c_theft_warning', option: 'locked down', date: 'Jul 2026' },
  { id: 'c_evals_month', option: 'week', date: 'Aug 2026' },
  { id: 'c_pact', option: 'signed', date: 'Sep 2026' },
];

const STAGE2_REVEALED = [
  'infrastructure', 'stores', 'autoPrice', 'dataRow', 'graph', 'gasButton', 'dcButton', 'solarButton', 'allocation',
  'standingOrder', 'releaseInternal', 'government', 'public', 'security', 'evalLine', 'nuclearButton', 'queue',
  'secondPipeline', 'jobFund', 'sl3Button', 'alignShare', 'stats', 'shareEvals', 'chipsRow',
];

/**
 * The state on the last tick of Stage 2, with Sage-3 just shipped: the median of the bot's five
 * exits for every number (stage3.md §1.1's fields), the median run's records for the rest.
 */
function stage2End(seed: number): GameState {
  const s = stage2(seed);
  Object.assign(s, {
    date: 16.69,
    tasks: 1.08e10,
    tasksSold: 1.076e10,
    unbilled: 0,
    funds: 5060000,
    totalRevenue: 3.25e8,
    price: 0.0139,
    autoPrice: true,
    marketBase: 54,
    gpus: 395000,
    gpusG5: 320000,
    g5: true,
    gpuBatches: 8,
    standingOrder: true,
    btm: true,
    datacenters: 7,
    powerCapacityMW: 395,
    gasPlants: 7,
    solarFarms: 5,
    reactors: 0,
    gulfSites: 0,
    powerQueue: [],
    copiesPerGPU: 9.16,
    copyBoost: 4.69,
    researchAlloc: 0.1,
    capability: 4.08,
    rivalCapability: 3.74,
    rivalVersion: 11,
    research: 2880000,
    insight: 9312,
    aiResearchMult: 1,
    researchMult: 1.25,
    researchers: 30,
    labSpace: 45,
    labMult: 64,
    trust: 3,
    nextTrust: 1.49e10,
    demandMult: 30.43,
    hypeLevel: 18,
    hypeBoost: 1.51,
    revenueMult: 1.12,
    data: 61.2,
    dataSynthetic: 24.8,
    crawlLeft: 0,
    alignmentApparent: 86,
    alignmentTrue: 60,
    autonomy: 0,
    securityLevel: 2,
    govRelations: 72.9,
    approval: -9.9,
    jobsDisplaced: 1.86,
    lead: 1.43,
    gulfExposure: 0,
    alignShare: 0.05,
    jobFund: true,
    shareEvals: true,
  });
  Object.assign(s.training, {
    run: null,
    pending: null,
    focus: 'capability',
    runIndex: 16,
    nextRunId: 17,
    major: 3,
    minor: 0,
    modelName: 'Sage-3',
    deployedName: 'Sage-3',
    internalCapability: 4.08,
    cooldown: 0,
    releaseWait: 0,
    models: [...s.training.models, ...STAGE2_MODELS.map((m) => ({ ...m }))],
  });
  s.rivalHistory = [...s.rivalHistory, ...STAGE2_RIVALS.map((r) => ({ ...r }))];
  Object.assign(s.flags, {
    dataEra: true,
    runsS2: 11,
    releasesThisStage: 11,
    gamblesThisStage: 1,
    sage2Decided: true,
    hearingDone: true,
    candid: true,
    publishersDone: true,
    licensedPublishers: true,
    gulfDeclined: true,
    defenseContract: true,
    pactSigned: true,
    safetyRuns: 2,
    safetyReleasesS2: 2,
    superhumanReleased: true,
  });
  Object.assign(s.stats, {
    timePlayed: 3872,
    trainings: 16,
    releases: 16,
    publicReleases: 16,
    crises: 3,
    choices: 14,
    revPerSec: 9.04e5,
    soldPerSec: 5.59e7,
    tasksPerSec: 5.59e7,
    peakTasksPerSec: 5.59e7,
    lastTasks: 1.08e10,
    taskHist: Array(10).fill(5.59e7),
    revHist: Array(10).fill(9.04e5),
    soldHist: Array(10).fill(5.59e7),
    priceHist: [],
  });
  s.choicesMade = [...s.choicesMade, ...STAGE2_CHOICES.map((c) => ({ ...c }))];
  for (const id of STAGE2_BOUGHT) s.projects[id] = { shown: true, bought: 1 };
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

export const PRESETS: Preset[] = [
  { stage: 1, label: 'Stage 1 start', ready: true, build: (seed) => newGame(seed) },
  { stage: 2, label: 'Stage 2 start', ready: true, build: stage2 },
  { stage: 3, label: 'Stage 3 start', ready: true, build: stage3 },
  { stage: 4, label: 'Stage 4 start', ready: false, build: stage3 },
  { stage: 5, label: 'Stage 5 start', ready: false, build: stage3 },
];

export function presetFor(stage: number): Preset {
  return PRESETS[Math.min(PRESETS.length, Math.max(1, stage)) - 1]!;
}
