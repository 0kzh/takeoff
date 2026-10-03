import { GameState, say, narrate, logNews, addFunds } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort } from './format.js';
import { snapToStage } from './clock.js';
import { GRID_MW, researchCap, potentialTasksPerSec, gpuBatchCost } from './economy.js';
import { trainCost } from './training.js';
import { PROJECTS } from '../data/projects.js';

/**
 * Stages own the UI layout: `enter(state)` flips `state.revealed[...]` flags, and the renderer
 * derives every panel's visibility from those flags, so a save restores the screen for free.
 */
export interface StageDef {
  id: number;
  name: string;
  startMonth: number;
  endMonth: number;
  /** Wall-clock seconds per in-game month (design.md §8). */
  secondsPerMonth: number;
  enter: (s: GameState) => void;
  /** Returns the next stage id when this stage's exit condition holds, else 0. */
  exit: (s: GameState) => number;
}

export const STAGE2_MIN_SECONDS = 25 * 60;
/** Stage 1 projects that make no sense once ground is broken, retired without a line. */
const QUIET_RETIRE = ['p_contractor'];
/** The rented fleet's deposit comes back at the transition: $400 a GPU, at least $25,000. */
export const DEPOSIT_PER_GPU = 400;
export const MIN_DEPOSIT = 25000;

function show(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = true;
}

function hide(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = false;
}

/**
 * Stage 1 → 2. Destructive, so it is narrated: the console keeps its last lines and prints what
 * was lost, what replaced it, and why the task rate jumps. Projects that only make sense with a
 * rented fleet are retired by name; the rest carry over. The research and Trust walls are cleared
 * so the training loop is alive on arrival, and the returned deposit buys the first GPU batch.
 */
function enterScale(s: GameState): void {
  const rentedGpus = s.gpus;
  const tpsBefore = Math.max(1, s.stats.tasksPerSec);

  const leftBehind = PROJECTS.filter(
    (p) => s.projects[p.id]?.shown && (s.projects[p.id]?.bought ?? 0) < p.uses && !p.stages.includes(2),
  );
  for (const p of leftBehind) s.projects[p.id]!.shown = false;
  // Rescues and the ladder's own extras go quietly; anything else is named.
  const retired = leftBehind.filter((p) => !p.rescue && !QUIET_RETIRE.includes(p.id));

  hide(s, ['power', 'buyPower', 'compute', 'gridContract', 'site']);
  show(s, ['infrastructure']);
  s.gridAuto = false;
  s.datacenters = Math.max(1, s.datacenters);
  // The rented fleet goes back to the cloud; Abilene opens with 1,000 owned GPUs.
  s.gpus = Math.max(1000, s.gpus - rentedGpus + 1000);
  s.powerCapacityMW = Math.max(s.powerCapacityMW, GRID_MW);

  const deposit = Math.max(MIN_DEPOSIT, DEPOSIT_PER_GPU * rentedGpus);
  addFunds(s, deposit);
  s.trust = Math.max(2, s.trust + 2);
  // The new building has room for the next run: the cap never starts below its research cost.
  const need = trainCost(s).research ?? 0;
  while (researchCap(s) < need) s.labSpace += 1;

  const jump = Math.max(1, Math.round(potentialTasksPerSec(s) / tpsBefore));
  narrate(s, [
    [1.6, `The ${fmtInt(rentedGpus)} rented GPUs go back. Deposit returned: ${fmtMoneyShort(deposit)}.`],
    [2.2, `1,000 Nimbus G4s on 5 MW at Abilene. Power is bought in megawatts now.`],
    [2.2, `Tasks per second ×${jump}: the copies run on hardware OpenMind owns.`],
  ]);
  if (retired.length) say(s, `Retired with the rented fleet: ${retired.map((p) => p.title).join(', ')}.`);
  logNews(s, 'OpenMind owns its first datacenter. The rented GPUs go back to the cloud.');
  if (gpuBatchCost(s) > s.funds) addFunds(s, gpuBatchCost(s) - s.funds);
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: 'The Startup',
    startMonth: monthOf(2025, 7),
    endMonth: monthOf(2025, 12),
    secondsPerMonth: 300,
    enter: (s) => {
      show(s, ['console', 'task', 'power', 'buyPower']);
      say(s, 'Welcome to OpenMind.');
    },
    exit: () => 0,
  },
  {
    id: 2,
    name: 'Scale',
    startMonth: monthOf(2026, 1),
    endMonth: monthOf(2026, 12),
    secondsPerMonth: 210,
    enter: enterScale,
    // Phase 1 seed: the minimum stay keeps Stage 2 from collapsing until its systems exist.
    exit: (s) =>
      s.capability >= 4 && ((s.flags['releasesThisStage'] as number) || 0) > 0 && s.stats.timeInStage >= STAGE2_MIN_SECONDS ? 3 : 0,
  },
  {
    id: 3,
    name: 'Takeoff',
    startMonth: monthOf(2027, 1),
    endMonth: monthOf(2027, 10),
    secondsPerMonth: 270,
    enter: (s) => {
      narrate(s, [[2, `${s.training.deployedName} writes better code than anyone at OpenMind.`]]);
      hide(s, ['marketing', 'hireResearcher', 'expandLab']);
      show(s, ['alignment', 'security', 'geopolitics', 'oversight']);
      s.humanEff = Math.min(1, 3 / Math.max(1, s.capability));
    },
    exit: (s) => (s.capability >= 25 && s.flags['committeeChoice'] ? 4 : 0),
  },
  {
    id: 4,
    name: 'Superintelligence',
    startMonth: monthOf(2027, 11),
    endMonth: monthOf(2028, 12),
    secondsPerMonth: 150,
    enter: (s) => {
      narrate(s, [[2, 'The model runs the business now. It is better at it.']]);
      hide(s, ['business', 'marketing', 'training']);
      show(s, ['robots', 'society', 'treaty', 'monitors']);
    },
    exit: (s) => (s.flags['treatySigned'] || s.flags['autonomyGranted'] ? 5 : 0),
  },
  {
    id: 5,
    name: 'Beyond',
    startMonth: monthOf(2029, 1),
    endMonth: monthOf(2030, 12),
    secondsPerMonth: 90,
    enter: (s) => {
      narrate(s, [[2, 'The first orbital datacenter reports in.']]);
      hide(s, ['geopolitics', 'robots', 'society']);
      show(s, ['space']);
    },
    exit: () => 0,
  },
];

export function stageDef(id: number): StageDef {
  return STAGES[Math.min(STAGES.length, Math.max(1, id)) - 1]!;
}

export function enterStage(s: GameState, next: number): boolean {
  if (next <= s.stage || next > STAGES.length) return false;
  s.stage = next;
  snapToStage(s, next);
  s.stats.timeInStage = 0;
  s.stats.stageEnteredAt.push(s.stats.timePlayed);
  s.flags['releasesThisStage'] = 0;
  stageDef(next).enter(s);
  return true;
}

export function checkStageExit(s: GameState): void {
  const next = stageDef(s.stage).exit(s);
  if (next) enterStage(s, next);
}

interface RevealRule {
  id: string;
  stages: number[];
  when: (s: GameState) => boolean;
  then?: (s: GameState) => void;
}

/** UP's "stuck" condition, debounced ~3 s: no power, no money for a block (the credit rescue). */
export const STUCK = (s: GameState): boolean => s.stuckFor >= 3;

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

/**
 * Stage 1 trigger-driven reveals (stages.md "Reveal order"). Once set, flags persist. The Research
 * panel arrives with Trust and Hire Researcher only; Expand Lab when research first nears its cap;
 * Projects about 40 s later with the first project — one idea at a time.
 */
const REVEAL_RULES: RevealRule[] = [
  { id: 'business', stages: [1], when: (s) => s.tasks >= 1 },
  {
    id: 'compute',
    stages: [1],
    when: (s) => s.funds >= 3 || s.tasks >= 20,
    then: (s) => say(s, 'GPUs can be rented. Each one runs a copy of Sage-1.'),
  },
  { id: 'revPerSec', stages: [1, 2, 3], when: (s) => s.tasksSold >= 1 },
  { id: 'marketing', stages: [1, 2], when: (s) => s.funds >= 40 || s.gpus >= 12 },
  {
    id: 'research',
    stages: [1, 2],
    when: (s) => ((s.flags['trustMilestones'] as number) || 0) >= 1,
    then: (s) => {
      show(s, ['hireResearcher']);
      s.flags['researchAt'] = s.stats.timePlayed;
      say(s, `Trust earned: ${fmtInt(s.trust)}. Each one hires a researcher.`);
    },
  },
  {
    id: 'expandLab',
    stages: [1, 2],
    when: (s) => s.revealed['research'] === true && s.research >= 0.9 * researchCap(s),
    then: (s) => say(s, 'The lab is nearly full. Expand Lab makes room for more research.'),
  },
  {
    id: 'projects',
    stages: [1, 2, 3, 4, 5],
    when: (s) => (s.revealed['research'] === true && sinceFlag(s, 'researchAt') >= 40) || (STUCK(s) && s.gpus > 0),
  },
];

export function updateReveals(s: GameState): void {
  for (const rule of REVEAL_RULES) {
    if (s.revealed[rule.id] || !rule.stages.includes(s.stage)) continue;
    if (rule.when(s)) {
      s.revealed[rule.id] = true;
      rule.then?.(s);
    }
  }
}
