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

/** Stage 1 projects a typical player has bought by the time the First Datacenter lands. */
const STAGE1_BOUGHT = [
  'p_prompting', 'p_insight', 'p_blogpost', 'p_training', 'p_seed', 'p_prompting2', 'p_demo', 'p_eval_team',
  'p_lab_cluster', 'p_api', 'p_workshop', 'p_grid', 'p_prompting3', 'p_compute_deal', 'p_pricing',
  'p_series_a', 'p_enterprise', 'p_alignment_team', 'p_distributed', 'p_datacenter',
];

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.48, date: 1.7, public: true },
  { name: 'Sage-1.2', capability: 1.72, date: 2.2, public: true },
  { name: 'Sage-2', capability: 2.5, date: 2.7, public: true },
  { name: 'Sage-2.1', capability: 2.95, date: 3.6, public: true },
  { name: 'Sage-2.2', capability: 3.6, date: 4.4, public: true },
];

/**
 * Hand-tuned from the headless sim at the First Datacenter purchase (~27 min, seed 1), rounded:
 * the cash went into the datacenter, research is nearly spent, five releases are out.
 */
function stage2(seed: number): GameState {
  const s = newGame(seed);
  Object.assign(s, {
    date: 5.9,
    tasks: 850000,
    unbilled: 1000,
    tasksSold: 849000,
    funds: 25000,
    totalRevenue: 320000,
    price: 0.45,
    priceRaises: 120,
    apiCustomers: 400,
    power: 4000,
    powerBought: 850,
    gpus: 112,
    gpuCostGrowth: 1.08,
    copiesPerGPU: 1.5625,
    copyBoost: 2.5,
    hypeLevel: 15,
    hypeBoost: 1.2,
    demandMult: 2.925,
    trust: 0,
    nextTrust: 987000,
    fib1: 987,
    fib2: 1597,
    researchers: 17,
    labSpace: 9,
    labMult: 2,
    research: 500,
    insight: 10,
    insightUnlocked: true,
    capability: 3.6,
    rivalCapability: 1.9,
    rivalVersion: 5,
    nextRivalIn: 120,
    alignmentApparent: 57,
    alignmentTrue: 53,
  });
  Object.assign(s.training, {
    focus: 'efficiency',
    runIndex: 5,
    nextRunId: 6,
    major: 2,
    minor: 2,
    modelName: 'Sage-2.2',
    deployedName: 'Sage-2.2',
    internalCapability: 3.6,
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
  Object.assign(s.flags, {
    trustMilestones: 13,
    redTeamed: true,
    sage2Decided: true,
    trainingCompute: 2,
    hitCap: true,
    maxBenchmark: 9.2,
  });
  Object.assign(s.stats, {
    timePlayed: 1620,
    trainings: 5,
    releases: 5,
    publicReleases: 5,
    crises: 1,
    choices: 6,
    peakTasksPerSec: 1250,
    nextTaskMilestone: 1000000,
    revPerSec: 900,
    soldPerSec: 1100,
    tasksPerSec: 1100,
  });
  for (const id of STAGE1_BOUGHT) s.projects[id] = { shown: true, bought: 1 };
  for (const d of DEVELOPMENTS) if (d.stage === 1) s.developments[d.id] = true;
  for (const id of ['business', 'pricing', 'demandPct', 'revPerSec', 'log', 'marketing', 'research', 'hireResearcher', 'expandLab', 'projects', 'insight', 'training', 'copies', 'apiCustomers', 'compute', 'fleet', 'buyPower']) {
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
