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

export const PRESETS: Preset[] = [
  { stage: 1, label: 'Stage 1 start', ready: true, build: (seed) => newGame(seed) },
  { stage: 2, label: 'Stage 2 start', ready: true, build: stage2 },
  { stage: 3, label: 'Stage 3 start', ready: false, build: stage2 },
  { stage: 4, label: 'Stage 4 start', ready: false, build: stage2 },
  { stage: 5, label: 'Stage 5 start', ready: false, build: stage2 },
];

export function presetFor(stage: number): Preset {
  return PRESETS[Math.min(PRESETS.length, Math.max(1, stage)) - 1]!;
}
