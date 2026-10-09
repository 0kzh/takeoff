import { GameState, newGame, ModelRecord, ChoiceRecord } from '../engine/state.js';
import { enterStage } from '../engine/stages.js';
import { actions, step } from '../engine/tick.js';
import { newBotMemory, policyStep } from '../sim/policy.js';
import { DEVELOPMENTS } from './developments.js';

export interface Preset {
  stage: number;
  label: string;
  ready: boolean;
  build: (seed: number) => GameState;
}

const STAGE1_BOUGHT = [
  'p_prompting', 'p_grid', 'p_insight', 'p_prompting2', 'p_seed', 'p_prompting3', 'p_blogpost',
  'p_lab_cluster', 'p_api', 'p_compute_deal', 'p_dogfood', 'p_pricing', 'p_series_a',
  'p_enterprise', 'p_contract', 'p_distributed', 'p_floor', 'p_auto_pricing', 'p_region', 'p_ppa',
  'p_abatement', 'p_reserved',
];
const STAGE1_REPEATS: Record<string, number> = { p_contract: 7 };

const STAGE1_MODELS: ModelRecord[] = [
  { name: 'Sage-1', capability: 1, date: 0, public: true },
  { name: 'Sage-1.1', capability: 1.118, date: 1.76, public: true },
  { name: 'Sage-1.2', capability: 1.262, date: 2.3, public: true },
  { name: 'Sage-1.3', capability: 1.411, date: 3.04, public: true },
  { name: 'Sage-1.4', capability: 1.601, date: 3.78, public: true },
  { name: 'Sage-1.5', capability: 1.813, date: 4.41, public: true },
];

const STAGE1_CHOICES: ChoiceRecord[] = [
  { id: 'c_bridge', option: 'no bridge', date: 'Sep 2025' },
  { id: 'c_rival', option: 'open-sourced', date: 'Sep 2025' },
  { id: 'c_journalist', option: 'system card', date: 'Oct 2025' },
  { id: 'c_letter', option: 'signed', date: 'Nov 2025' },
  { id: 'c_poach', option: 'matched', date: 'Nov 2025' },
];

function stage1End(seed: number): GameState {
  const s = newGame(seed);
  delete s.flags['prologue'];
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
    gridCapacity: 10000,
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
    labSpace: 10,
    labMult: 1,
    research: 7800,
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
    models: STAGE1_MODELS.map((m) => ({ ...m })),
  });
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
    trainingAt: 300.1,
    armedRuns: 5,
    maxBenchmark: 7.1,
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
    'revPerSec', 'research', 'hireResearcher', 'projects', 'gridContract', 'gridCapacity', 'log', 'insight', 'expandLab',
    'training', 'focus', 'rival', 'quota', 'contracts', 'autoPrice',
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

export interface Stage2Checkpoint {
  id: string;
  label: string;
  title: string;
  /** The bot plays from the arrival until this holds (plus a short grace), or 40 minutes pass. */
  reached: (s: GameState) => boolean;
  graceSeconds: number;
}

// Checkpoints are produced by letting the bot play from the Stage 2 arrival
// until a game condition holds, so they stay honest as the balance changes.
// They are cheats for review, not balance evidence.
export const STAGE2_CHECKPOINTS: Stage2Checkpoint[] = [
  { id: 'arrival', label: 'arrival', title: 'Stage 2 arrival: the first datacenter', reached: () => true, graceSeconds: 0 },
  { id: 'datawall', label: 'data', title: 'The data wall: the public web is running out', reached: (s) => s.flags['webExhausted'] === true || s.capability >= 3, graceSeconds: 30 },
  { id: 'baiwen', label: 'baiwen', title: 'Baiwen joins the race; the Security Office is on screen', reached: (s) => s.baiwen.present, graceSeconds: 45 },
  { id: 'alignment', label: 'align', title: 'The alignment strip has just appeared', reached: (s) => s.revealed['alignment'] === true, graceSeconds: 20 },
  { id: 'final', label: 'final', title: 'Automate the Lab is on screen, greyed until 10×', reached: (s) => s.projects['s2_automate']?.shown === true, graceSeconds: 60 },
];

export const CHECKPOINT_MAX_SECONDS = 40 * 60;

export function stage2Checkpoint(id: string, seed: number): GameState {
  const cp = STAGE2_CHECKPOINTS.find((c) => c.id === id) ?? STAGE2_CHECKPOINTS[0]!;
  const s = stage2(seed);
  const mem = newBotMemory('bot');
  let reachedAt = cp.reached(s) ? 0 : -1;
  for (let i = 0; i < CHECKPOINT_MAX_SECONDS * 10 && s.stage === 2 && !s.ending; i++) {
    if (reachedAt < 0 && cp.reached(s)) reachedAt = i;
    if (reachedAt >= 0 && i - reachedAt >= cp.graceSeconds * 10) break;
    policyStep(s, actions, mem);
    step(s);
  }
  s.activeChoice = null;
  s.choiceQueue = [];
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
