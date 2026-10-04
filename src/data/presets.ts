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

/** Stage 1 projects the bot has bought in every seed by the time ground is broken at Abilene. */
const STAGE1_BOUGHT = [
  'p_prompting', 'p_prompting2', 'p_insight', 'p_grid', 'p_lab_cluster', 'p_training', 'p_prompting3', 'p_seed',
  'p_compute_deal', 'p_eval_team', 'p_api', 'p_pricing', 'p_distributed', 'p_dogfood', 'p_series_a', 'p_site',
  'p_enterprise', 'p_alignment_team', 'p_batch', 'p_floor', 'p_recruiter', 'p_interconnect', 'p_cooling', 'p_agents',
  'p_safety_framework', 'p_substation', 'p_expedite', 'p_ppa', 'p_renewals', 'p_abatement', 'p_contractor',
  'p_soundwall', 'p_datacenter',
];

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.14, date: 1.83, public: true },
  { name: 'Sage-1.2', capability: 1.3, date: 2.58, public: true },
  { name: 'Sage-1.3', capability: 1.44, date: 3.37, public: true },
  { name: 'Sage-1.4', capability: 1.53, date: 4.33, public: true },
  { name: 'Sage-1.5', capability: 1.635, date: 5.44, public: true },
];

const STAGE1_RIVALS: RivalRecord[] = [
  { name: 'Cadence-2', capability: 1.05, date: 1.1 },
  { name: 'Cadence-3', capability: 1.2, date: 2.45 },
  { name: 'Cadence-4', capability: 1.33, date: 3.35 },
  { name: 'Cadence-5', capability: 1.43, date: 4.34 },
  { name: 'Cadence-6', capability: 1.57, date: 5.23 },
];

const STAGE1_CHOICES: ChoiceRecord[] = [
  { id: 'c_gamble', option: 'gamble', date: 'Sep 2025' },
  { id: 'c_bridge', option: 'no bridge', date: 'Sep 2025' },
  { id: 'c_rival', option: 'silence', date: 'Oct 2025' },
  { id: 'c_journalist', option: 'no comment', date: 'Oct 2025' },
  { id: 'c_letter', option: 'silence', date: 'Nov 2025' },
  { id: 'c_poach', option: 'let go', date: 'Nov 2025' },
  { id: 'c_leaderboard', option: 'submitted', date: 'Dec 2025' },
];

/**
 * The state the bot hands over at the moment it buys Break ground: the median of seeds 1–5
 * (`npm run sim`, bot policy, rebuilt after the Stage 1 polish pass). Five releases (Sage-1.5 at
 * 1.635×), seven custom contracts at the renewal rate, Trust spent. `enterStage(2)` then plays the
 * real arrival: the rented GPUs go back for a deposit, 1,000 owned GPUs, Trust and lab room.
 */
function stage1End(seed: number): GameState {
  const s = newGame(seed);
  Object.assign(s, {
    date: 5.96,
    tasks: 345000,
    unbilled: 150,
    tasksSold: 344850,
    funds: 500,
    totalRevenue: 497000,
    price: 0.99,
    priceRaises: 240,
    power: 11700,
    powerBought: 40,
    powerBase: 14.57,
    powerPrice: 14.2,
    gridAuto: true,
    gpus: 93,
    gpuCostGrowth: 1.08,
    copiesPerGPU: 1.25,
    copyBoost: 3,
    hypeLevel: 11,
    hypeBoost: 1.7,
    demandMult: 6,
    trust: 0,
    nextTrust: 377000,
    fib1: 377,
    fib2: 610,
    researchers: 20,
    labSpace: 9,
    labMult: 4,
    research: 33000,
    insight: 4,
    insightUnlocked: true,
    researchMult: 1.25,
    capability: 1.635,
    rivalCapability: 1.57,
    rivalVersion: 6,
    nextRivalIn: 200,
    rivalHistory: STAGE1_RIVALS.map((r) => ({ ...r })),
    alignmentApparent: 58,
    alignmentTrue: 55,
    govRelations: 50,
    approval: 0,
  });
  Object.assign(s.training, {
    focus: 'capability',
    runIndex: 5,
    nextRunId: 6,
    major: 1,
    minor: 5,
    modelName: 'Sage-1.5',
    deployedName: 'Sage-1.5',
    internalCapability: 1.635,
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
  Object.assign(s.flags, {
    trustMilestones: 11,
    redTeamed: true,
    hitCap: true,
    maxBenchmark: 7,
    trainingCompute: 1.5,
    ppa: true,
    interconnectDone: true,
    abatement: true,
    firstReleaseAt: 545,
    contractMult: 1.25,
    leaderboardEligible: false,
  });
  Object.assign(s.stats, {
    timePlayed: 1788,
    trainings: 5,
    releases: 5,
    publicReleases: 5,
    crises: 2,
    choices: 7,
    peakTasksPerSec: 517,
    nextTaskMilestone: 1000000,
    revPerSec: 1044,
    soldPerSec: 506,
    tasksPerSec: 516,
    lastTasks: 345000,
    taskHist: Array(10).fill(516),
    revHist: Array(10).fill(1044),
    soldHist: Array(10).fill(506),
  });
  s.choicesMade = STAGE1_CHOICES.map((c) => ({ ...c }));
  for (const id of STAGE1_BOUGHT) s.projects[id] = { shown: true, bought: 1 };
  s.projects['p_contract'] = { shown: true, bought: 7 };
  for (const d of DEVELOPMENTS) if (d.stage === 1) s.developments[d.id] = true;
  for (const id of [
    'business', 'revPerSec', 'log', 'marketing', 'research', 'hireResearcher', 'expandLab', 'projects', 'insight',
    'training', 'copies', 'focus', 'contracts', 'compute', 'buyPower', 'gridContract', 'site', 'interconnect', 'powerMW',
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
  'p_blogpost', 'p_web_crawl', 'p_research_cluster', 'p_demo', 'p_ai_assistants', 'p_series_b', 'p_agent_platform',
  'p_standing_order', 'p_workshop', 'p_scaffold', 'p_spec', 'p_keynote', 'p_auto_evals', 'p_exp_scheduler', 'p_policy',
  'p_parallel', 'p_sl2', 'p_moe', 'p_synth', 'p_license_code', 'p_memory', 'p_international', 'p_free_tier', 'p_brief',
  'p_g5', 'p_distill', 'p_flywheel', 'p_dashboard', 'p_btm', 'p_series_c', 'p_license_archive', 'p_superhuman_coder',
];

const STAGE2_MODELS: ModelRecord[] = [
  { name: 'Sage-1.6', capability: 1.81, date: 6.55, public: true },
  { name: 'Sage-1.7', capability: 1.936, date: 7.4, public: true },
  { name: 'Sage-2', capability: 2.195, date: 8, public: true },
  { name: 'Sage-2.1', capability: 2.295, date: 8.91, public: true },
  { name: 'Sage-2.2', capability: 2.407, date: 9.73, public: true },
  { name: 'Sage-2.3', capability: 2.71, date: 10.57, public: true },
  { name: 'Sage-2.4', capability: 2.9, date: 12.15, public: true },
  { name: 'Sage-2.5', capability: 3.172, date: 13.47, public: true },
  { name: 'Sage-2.6', capability: 3.372, date: 14.84, public: true },
  { name: 'Sage-2.7', capability: 3.582, date: 15.75, public: true },
  { name: 'Sage-2.8', capability: 3.939, date: 16.42, public: true },
  { name: 'Sage-3', capability: 4.174, date: 17.36, public: true },
];

const STAGE2_RIVALS: RivalRecord[] = [
  { name: 'Cadence-7', capability: 1.858, date: 7.29 },
  { name: 'Cadence-8', capability: 2.077, date: 9.02 },
  { name: 'Cadence-9', capability: 2.317, date: 10.79 },
  { name: 'Cadence-10', capability: 2.792, date: 12.41 },
  { name: 'Cadence-11', capability: 3.101, date: 14.33 },
  { name: 'Cadence-12', capability: 3.617, date: 15.49 },
  { name: 'Cadence-13', capability: 4.254, date: 16.76 },
];

const STAGE2_CHOICES: ChoiceRecord[] = [
  { id: 'c_sage2', option: 'public', date: 'Mar 2026' },
  { id: 'c_hearing', option: 'testified', date: 'Mar 2026' },
  { id: 'c_publishers', option: 'licensed', date: 'Apr 2026' },
  { id: 'c_gulf', option: 'domestic', date: 'Jul 2026' },
  { id: 'c_defense', option: 'signed', date: 'Jul 2026' },
  { id: 'c_evals_month', option: 'week', date: 'Aug 2026' },
  { id: 'c_theft_warning', option: 'locked down', date: 'Sep 2026' },
  { id: 'c_pact', option: 'signed', date: 'Oct 2026' },
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
    date: 17.36,
    tasks: 2.0e10,
    tasksSold: 2.0e10,
    unbilled: 0,
    funds: 10200000,
    totalRevenue: 4.14e8,
    price: 0.0093,
    autoPrice: true,
    marketBase: 54,
    gpus: 675000,
    gpusG5: 575000,
    g5: true,
    gpuBatches: 5,
    standingOrder: true,
    btm: true,
    datacenters: 8,
    powerCapacityMW: 825,
    gasPlants: 6,
    solarFarms: 4,
    reactors: 1,
    gulfSites: 0,
    powerQueue: [],
    copiesPerGPU: 9.16,
    copyBoost: 4.69,
    researchAlloc: 0.1,
    capability: 4.174,
    rivalCapability: 4.254,
    rivalVersion: 13,
    research: 3136000,
    insight: 11415,
    aiResearchMult: 1,
    researchMult: 1.25,
    researchers: 20,
    labSpace: 49,
    labMult: 64,
    trust: 3,
    nextTrust: 2.4e10,
    demandMult: 23.96,
    hypeLevel: 18,
    hypeBoost: 1.45,
    revenueMult: 1.12,
    data: 80.1,
    dataSynthetic: 41.9,
    crawlLeft: 0,
    alignmentApparent: 90.5,
    alignmentTrue: 57,
    autonomy: 0,
    securityLevel: 2,
    govRelations: 100,
    approval: -11.1,
    jobsDisplaced: 2.8,
    lead: 2.11,
    gulfExposure: 0,
    alignShare: 0.05,
    jobFund: true,
    shareEvals: true,
  });
  Object.assign(s.training, {
    run: null,
    pending: null,
    focus: 'efficiency',
    runIndex: 18,
    nextRunId: 19,
    major: 3,
    minor: 0,
    modelName: 'Sage-3',
    deployedName: 'Sage-3',
    internalCapability: 4.174,
    cooldown: 0,
    releaseWait: 0,
    models: [...s.training.models, ...STAGE2_MODELS.map((m) => ({ ...m }))],
  });
  s.rivalHistory = [...s.rivalHistory, ...STAGE2_RIVALS.map((r) => ({ ...r }))];
  Object.assign(s.flags, {
    dataEra: true,
    runsS2: 12,
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
    timePlayed: 4174,
    trainings: 18,
    releases: 17,
    publicReleases: 17,
    crises: 4,
    choices: 15,
    revPerSec: 1.09e6,
    soldPerSec: 1.09e8,
    tasksPerSec: 1.06e8,
    peakTasksPerSec: 1.06e8,
    lastTasks: 2.0e10,
    taskHist: Array(10).fill(1.06e8),
    revHist: Array(10).fill(1.09e6),
    soldHist: Array(10).fill(1.09e8),
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
