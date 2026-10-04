import { GameState, newGame, ModelRecord, RivalRecord, ChoiceRecord } from '../engine/state.js';
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

/** Stage 1 projects the median run (bot, seed 3 of 1–5, after owner feedback 1) had bought at First Datacenter. */
const STAGE1_BOUGHT = [
  'p_prompting', 'p_insight', 'p_grid', 'p_prompting2', 'p_training', 'p_seed', 'p_blogpost', 'p_prompting3',
  'p_lab_cluster', 'p_api', 'p_demo', 'p_compute_deal', 'p_dogfood', 'p_batch', 'p_eval_team', 'p_pricing',
  'p_series_a', 'p_region', 'p_cooling', 'p_auto_pricing', 'p_desks', 'p_enterprise', 'p_abatement', 'p_distributed',
  'p_reserved', 'p_soundwall', 'p_floor', 'p_datacenter',
];

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.118, date: 2.08, public: true },
  { name: 'Sage-1.2', capability: 1.264, date: 3.19, public: true },
  { name: 'Sage-1.3', capability: 1.409, date: 3.74, public: true },
  { name: 'Sage-1.4', capability: 1.584, date: 4.43, public: true },
  { name: 'Sage-1.5', capability: 1.768, date: 5.82, public: true },
];

const STAGE1_RIVALS: RivalRecord[] = [
  { name: 'Cadence-2', capability: 1.039, date: 1.37 },
  { name: 'Cadence-3', capability: 1.075, date: 2.96 },
  { name: 'Cadence-4', capability: 1.198, date: 4.24 },
  { name: 'Cadence-5', capability: 1.641, date: 5.52 },
];

const STAGE1_CHOICES: ChoiceRecord[] = [
  { id: 'c_bridge', option: 'no bridge', date: 'Sep 2025' },
  { id: 'c_rival', option: 'open-sourced', date: 'Sep 2025' },
  { id: 'c_journalist', option: 'system card', date: 'Oct 2025' },
  { id: 'c_letter', option: 'signed', date: 'Nov 2025' },
  { id: 'c_poach', option: 'let go', date: 'Nov 2025' },
  { id: 'c_leaderboard', option: 'submitted', date: 'Dec 2025' },
];

/**
 * The state the bot hands over at the moment it buys First Datacenter: the median of seeds 1–5
 * (`npm run sim`, bot policy, rebuilt after owner feedback 1: 240-s months, the hard GPU gate, one
 * datacenter; the median run is seed 3 at 24:32). Five releases (Sage-1.5 at 1.77×), 140 rented
 * GPUs (all three lease cards), six contract customers, Dynamic pricing on, Trust spent. `enterStage(2)`
 * then plays the real arrival: the rented GPUs go back for a deposit, 1,000 owned GPUs, Trust and
 * lab room, the contracts' share of sales frozen as their rate.
 */
function stage1End(seed: number): GameState {
  const s = newGame(seed);
  Object.assign(s, {
    date: 6.13,
    tasks: 358000,
    unbilled: 260,
    tasksSold: 357800,
    funds: 1000,
    totalRevenue: 550000,
    price: 4.42,
    autoPrice: true,
    priceRaises: 74,
    power: 12500,
    powerBought: 58,
    powerBase: 14.9,
    powerPrice: 17.07,
    gridAuto: true,
    gpus: 140,
    gpuCostGrowth: 1.06,
    copiesPerGPU: 1.25,
    copyBoost: 2.5,
    hypeLevel: 13,
    hypeBoost: 1.75,
    demandMult: 7.62,
    trust: 0,
    nextTrust: 402500,
    fib1: 987,
    fib2: 1597,
    researchers: 26,
    labSpace: 12,
    labMult: 4,
    research: 12600,
    insight: 31,
    insightUnlocked: true,
    researchMult: 1.25,
    capability: 1.768,
    rivalCapability: 1.641,
    rivalVersion: 5,
    nextRivalIn: 147,
    rivalHistory: STAGE1_RIVALS.map((r) => ({ ...r })),
    alignmentApparent: 52,
    alignmentTrue: 51,
    govRelations: 51,
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
    internalCapability: 1.768,
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
  Object.assign(s.flags, {
    trustMilestones: 13,
    redTeamed: true,
    hitCap: true,
    maxBenchmark: 7.1,
    trainingCompute: 1.5,
    firstReleaseAt: 498,
    priceMoves: 122,
    seriesABonus: 15000,
    leaderboardWon: true,
  });
  Object.assign(s.stats, {
    timePlayed: 1472,
    trainings: 5,
    releases: 5,
    publicReleases: 5,
    crises: 2,
    choices: 6,
    peakTasksPerSec: 689,
    nextTaskMilestone: 1000000,
    revPerSec: 2786,
    soldPerSec: 661,
    tasksPerSec: 689,
    lastTasks: 358000,
    taskHist: Array(10).fill(689),
    revHist: Array(10).fill(2786),
    soldHist: Array(10).fill(661),
  });
  s.choicesMade = STAGE1_CHOICES.map((c) => ({ ...c }));
  for (const id of STAGE1_BOUGHT) s.projects[id] = { shown: true, bought: 1 };
  s.projects['p_contract'] = { shown: true, bought: 6 };
  for (const d of DEVELOPMENTS) if (d.stage === 1) s.developments[d.id] = true;
  for (const id of [
    'business', 'compute', 'fleet', 'power', 'buyPower', 'pricing', 'marketing', 'revPerSec', 'research',
    'hireResearcher', 'projects', 'log', 'insight', 'expandLab', 'gridContract', 'training', 'quota', 'focus',
    'autoPrice', 'contracts',
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

/** Stage 2 projects bought by the median run (seed 2, 34:59, after owner feedback 1) when Sage-3 shipped. */
const STAGE2_BOUGHT = [
  'p_alignment_team', 'p_recruiter', 'p_agents', 'p_safety_framework', 'p_workshop', 'p_research_cluster',
  'p_standing_order', 'p_web_crawl', 'p_ai_assistants', 'p_series_b', 'p_moe', 'p_keynote', 'p_scaffold', 'p_spec',
  'p_auto_evals', 'p_policy', 'p_sl2', 'p_parallel', 'p_agent_platform', 'p_synth', 'p_brief', 'p_free_tier',
  'p_international', 'p_g5', 'p_memory', 'p_license_code', 'p_exp_scheduler', 'p_dashboard', 'p_license_archive',
  'p_series_c', 'p_superhuman_coder',
];

const STAGE2_MODELS: ModelRecord[] = [
  { name: 'Sage-1.6', capability: 1.937, date: 7.09, public: true },
  { name: 'Sage-2', capability: 2.073, date: 8, public: true },
  { name: 'Sage-2.1', capability: 2.253, date: 8.64, public: true },
  { name: 'Sage-2.2', capability: 2.411, date: 9.45, public: true },
  { name: 'Sage-2.3', capability: 2.579, date: 11.12, public: true },
  { name: 'Sage-2.4', capability: 2.765, date: 11.99, public: true },
  { name: 'Sage-2.5', capability: 2.91, date: 12.76, public: true },
  { name: 'Sage-2.6', capability: 3.17, date: 13.54, public: true },
  { name: 'Sage-2.7', capability: 3.392, date: 14.34, public: true },
  { name: 'Sage-2.8', capability: 3.629, date: 15.18, public: true },
  { name: 'Sage-3', capability: 4, date: 16.13, public: true },
];

const STAGE2_RIVALS: RivalRecord[] = [
  { name: 'Cadence-6', capability: 1.724, date: 7.42 },
  { name: 'Cadence-7', capability: 1.987, date: 9.32 },
  { name: 'Cadence-8', capability: 2.431, date: 11.22 },
  { name: 'Cadence-9', capability: 2.74, date: 12.68 },
  { name: 'Cadence-10', capability: 3.347, date: 14.38 },
];

const STAGE2_CHOICES: ChoiceRecord[] = [
  { id: 'c_sage2', option: 'public', date: 'Feb 2026' },
  { id: 'c_hearing', option: 'testified', date: 'Mar 2026' },
  { id: 'c_publishers', option: 'licensed', date: 'Apr 2026' },
  { id: 'c_evals_month', option: 'week', date: 'Jun 2026' },
  { id: 'c_gulf', option: 'domestic', date: 'Jul 2026' },
  { id: 'c_defense', option: 'signed', date: 'Jul 2026' },
  { id: 'c_theft_warning', option: 'locked down', date: 'Sep 2026' },
  { id: 'c_pact', option: 'signed', date: 'Oct 2026' },
];

const STAGE2_REVEALED = [
  'infrastructure', 'stores', 'autoPrice', 'gasButton', 'lot5', 'copies', 'dataRow', 'solarButton', 'graph',
  'allocation', 'dcButton', 'standingOrder', 'releaseInternal', 'government', 'evalLine', 'lot25', 'hireFaded', 'public',
  'secondPipeline', 'security', 'queue', 'nuclearButton', 'jobFund', 'stats', 'sl3Button', 'shareEvals', 'chipsRow',
];

/**
 * The state on the last tick of Stage 2, with Sage-3 just shipped: the median of the bot's five
 * exits for every number (stage3.md §1.1's fields), the median run's records for the rest. Rebuilt
 * after owner feedback 1 (exits 34:23–36:24 from the Stage 2 preset; median seed 2, 34:59).
 */
function stage2End(seed: number): GameState {
  const s = stage2(seed);
  Object.assign(s, {
    date: 16.13,
    tasks: 9.79e9,
    tasksSold: 9.786e9,
    unbilled: 0,
    funds: 22300000,
    totalRevenue: 2.96e8,
    price: 0.015,
    autoPrice: true,
    marketBase: 54,
    gpus: 505000,
    gpusG5: 464700,
    g5: true,
    gpuBatches: 194,
    standingOrder: true,
    btm: false,
    datacenters: 7,
    powerCapacityMW: 525,
    gasPlants: 8,
    solarFarms: 8,
    reactors: 0,
    gulfSites: 0,
    powerQueue: [],
    copiesPerGPU: 6.56,
    copyBoost: 4.69,
    researchAlloc: 0.2,
    capability: 4,
    rivalCapability: 3.555,
    rivalVersion: 10,
    research: 2906000,
    insight: 4875,
    aiResearchMult: 1,
    researchMult: 1.25,
    researchers: 29,
    labSpace: 48,
    labMult: 256,
    trust: 3,
    nextTrust: 1.493e10,
    demandMult: 30.43,
    hypeLevel: 18,
    hypeBoost: 1.52,
    revenueMult: 1.12,
    data: 72.7,
    dataSynthetic: 31.9,
    crawlLeft: 0,
    alignmentApparent: 86,
    alignmentTrue: 59,
    autonomy: 0,
    securityLevel: 2,
    govRelations: 72.3,
    approval: -7.5,
    jobsDisplaced: 1.86,
    lead: 1.5,
    gulfExposure: 0,
    alignShare: 0.05,
    jobFund: true,
    shareEvals: true,
  });
  Object.assign(s.training, {
    run: null,
    pending: null,
    focus: 'capability',
    runIndex: 17,
    nextRunId: 18,
    major: 3,
    minor: 0,
    modelName: 'Sage-3',
    deployedName: 'Sage-3',
    internalCapability: 4,
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
    // Sage-3 shipped publicly at the exit (stage3.md as-built deltas row 8): the shell's first
    // release must not pay Stage 2's −0.5 again.
    sage3Released: 'public',
    internalReleases: 0,
    g6Preorder: false,
    site2: false,
    theftIgnored: false,
  });
  Object.assign(s.stats, {
    timePlayed: 3571,
    trainings: 17,
    releases: 16,
    publicReleases: 16,
    crises: 4,
    choices: 14,
    revPerSec: 8.14e5,
    soldPerSec: 4.96e7,
    tasksPerSec: 4.89e7,
    peakTasksPerSec: 4.96e7,
    lastTasks: 9.79e9,
    nextTaskMilestone: 1e10,
    taskHist: Array(10).fill(4.89e7),
    revHist: Array(10).fill(8.14e5),
    soldHist: Array(10).fill(4.96e7),
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
 * The median seed of the policy's five exits from its Stage 3 preset (seeds 1–5): the reasonable bot
 * from `Stage 3 start` (41:37–46:57, median seed 1), the naive player from the careless start.
 */
const S3_MEDIAN_SEED = 1;
const S3_MEDIAN_SEED_CARELESS = 2;

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

export const PRESETS: Preset[] = [
  { stage: 1, label: 'Stage 1 start', ready: true, build: (seed) => newGame(seed) },
  { stage: 2, label: 'Stage 2 start', ready: true, build: stage2 },
  { stage: 3, label: 'Stage 3 start', ready: true, build: stage3 },
  { stage: 4, label: 'Stage 4 start (slow)', ready: true, build: () => stage4From(stage3, S3_MEDIAN_SEED, 'bot', 'slow') },
  { stage: 5, label: 'Stage 5 start', ready: false, build: () => stage4From(stage3, S3_MEDIAN_SEED, 'bot', 'slow') },
];

/** Presets that are variants of a stage's start (`--preset 3c`, the dev overlay's second row). */
export const EXTRA_PRESETS: Record<string, Preset> = {
  '3c': { stage: 3, label: 'Stage 3 start (careless)', ready: true, build: stage3Careless },
  '4s': { stage: 4, label: 'Stage 4 start (slow)', ready: true, build: () => stage4From(stage3, S3_MEDIAN_SEED, 'bot', 'slow') },
  '4r': { stage: 4, label: 'Stage 4 start (race)', ready: true, build: () => stage4From(stage3, S3_MEDIAN_SEED, 'bot', 'race') },
  '4cs': { stage: 4, label: 'Stage 4 start (careless, slow)', ready: true, build: () => stage4From(stage3Careless, S3_MEDIAN_SEED_CARELESS, 'naive', 'slow') },
  '4cr': { stage: 4, label: 'Stage 4 start (careless, race)', ready: true, build: () => stage4From(stage3Careless, S3_MEDIAN_SEED_CARELESS, 'naive', 'race') },
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
