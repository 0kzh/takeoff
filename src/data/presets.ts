import { GameState, newGame, ModelRecord } from '../engine/state.js';
import { enterStage } from '../engine/stages.js';
import { DEVELOPMENTS } from './developments.js';

export interface Preset {
  stage: number;
  label: string;
  /** False for stages whose content is not built yet; they load the latest real preset. */
  ready: boolean;
  build: (seed: number) => GameState;
}

/** Stage 1 projects a typical player has bought by the time ground is broken at Abilene. */
const STAGE1_BOUGHT = [
  'p_prompting', 'p_insight', 'p_grid', 'p_prompting2', 'p_training', 'p_lab_cluster', 'p_seed', 'p_compute_deal',
  'p_prompting3', 'p_eval_team', 'p_api', 'p_pricing', 'p_dogfood', 'p_distributed', 'p_alignment_team',
  'p_series_a', 'p_site', 'p_enterprise', 'p_batch', 'p_recruiter', 'p_interconnect', 'p_floor', 'p_agents',
  'p_safety_framework', 'p_substation', 'p_ppa', 'p_contractor', 'p_datacenter',
];

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.16, date: 1.8, public: true },
  { name: 'Sage-1.2', capability: 1.34, date: 2.6, public: true },
  { name: 'Sage-1.3', capability: 1.53, date: 3.3, public: true },
  { name: 'Sage-1.4', capability: 1.64, date: 4.1, public: true },
  { name: 'Sage-1.5', capability: 1.65, date: 4.8, public: true },
  { name: 'Sage-1.6', capability: 1.65, date: 5.4, public: true },
];

/**
 * Hand-tuned from the headless sim at the moment Break ground is bought (~30 min, bot policy,
 * seed 1), rounded: the money went into the Abilene ladder, six releases are out (Sage-1.6 at
 * 1.65×), and the later runs were undertrained on rented GPUs. `enterStage(2)` then plays the
 * real arrival: the rented GPUs go back for a deposit, 1,000 owned GPUs, Trust and lab room.
 */
function stage2(seed: number): GameState {
  const s = newGame(seed);
  Object.assign(s, {
    date: 5.95,
    tasks: 432000,
    unbilled: 1000,
    tasksSold: 431000,
    funds: 2000,
    totalRevenue: 487000,
    price: 0.76,
    priceRaises: 240,
    power: 6000,
    powerBought: 49,
    powerBase: 14.7,
    powerPrice: 14,
    gridAuto: true,
    gpus: 95,
    gpuCostGrowth: 1.08,
    copiesPerGPU: 1.953125,
    copyBoost: 3,
    hypeLevel: 10,
    hypeBoost: 1.4,
    demandMult: 6,
    trust: 0,
    nextTrust: 610000,
    fib1: 610,
    fib2: 987,
    researchers: 22,
    labSpace: 9,
    labMult: 4,
    research: 17000,
    insight: 9,
    insightUnlocked: true,
    researchMult: 1.25,
    capability: 1.65,
    rivalCapability: 1.77,
    rivalVersion: 6,
    nextRivalIn: 120,
    alignmentApparent: 60,
    alignmentTrue: 55,
    approval: -2,
  });
  Object.assign(s.training, {
    focus: 'efficiency',
    runIndex: 7,
    nextRunId: 8,
    major: 1,
    minor: 6,
    modelName: 'Sage-1.6',
    deployedName: 'Sage-1.6',
    internalCapability: 1.65,
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
  Object.assign(s.flags, {
    trustMilestones: 12,
    redTeamed: true,
    hitCap: true,
    maxBenchmark: 7.6,
    trainingCompute: 1.5,
    ppa: true,
    interconnectDone: true,
    abatement: true,
    firstReleaseAt: 480,
  });
  Object.assign(s.stats, {
    timePlayed: 1850,
    trainings: 7,
    releases: 6,
    publicReleases: 6,
    crises: 1,
    choices: 13,
    peakTasksPerSec: 830,
    nextTaskMilestone: 1000000,
    revPerSec: 660,
    soldPerSec: 430,
    tasksPerSec: 575,
  });
  for (const id of STAGE1_BOUGHT) s.projects[id] = { shown: true, bought: 1 };
  s.projects['p_contract'] = { shown: true, bought: 6 };
  for (const d of DEVELOPMENTS) if (d.stage === 1) s.developments[d.id] = true;
  for (const id of [
    'business', 'revPerSec', 'log', 'marketing', 'research', 'hireResearcher', 'expandLab', 'projects', 'insight',
    'training', 'copies', 'focus', 'contracts', 'compute', 'buyPower', 'gridContract', 'site', 'interconnect', 'powerMW',
  ]) {
    s.revealed[id] = true;
  }
  s.log = [];
  s.console = [];
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
