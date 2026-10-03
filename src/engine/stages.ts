import { GameState, say, narrate, logNews, addFunds } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort } from './format.js';
import { snapToStage } from './clock.js';
import { GRID_MW, researchCap, potentialTasksPerSec } from './economy.js';
import { withdrawProject } from './reveal.js';
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
const QUIET_RETIRE = ['p_contractor', 'p_cooling', 'p_expedite', 'p_soundwall', 'p_desks'];
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
 * Stage 1 → 2 (stage2.md §1.1–1.3; the narration contract is arc.md §7). Destructive, so it is
 * narrated: the console keeps its last lines and prints, two seconds apart, what was lost, what
 * replaced it and why the task rate jumps. Pre-flight leaves no wall behind: Trust at least 2, and
 * room in the lab for 1.25 × the next run. Projects that only make sense with a rented fleet are
 * retired by name; the rest carry over.
 */
function enterScale(s: GameState): void {
  const leftBehind = PROJECTS.filter(
    (p) => s.projects[p.id]?.shown && (s.projects[p.id]?.bought ?? 0) < p.uses && !p.stages.includes(2),
  );
  for (const p of leftBehind) withdrawProject(s, p.id);
  // Rescues and the ladder's own extras go quietly; anything else is named.
  const retired = leftBehind.filter((p) => !p.rescue && !QUIET_RETIRE.includes(p.id));

  // Power, its price and the grid toggle stay frozen as they were; the engine stops using them.
  hide(s, ['power', 'buyPower', 'compute', 'gridContract', 'site']);
  show(s, ['infrastructure']);
  s.datacenters = Math.max(1, s.datacenters);
  s.powerCapacityMW = Math.max(s.powerCapacityMW, GRID_MW);

  s.trust = Math.max(s.trust, 2);
  let roomAdded = false;
  while (researchCap(s) < 1.25 * (trainCost(s).research ?? 0)) {
    s.labSpace += 1;
    roomAdded = true;
  }

  const shipment = rackFirstShipment(s);
  narrate(s, [
    [0.1, 'Ground broken outside Abilene. 2026 begins.'],
    [2, shipment.returned],
    [2, 'Power is capacity now, not a bill: 5 MW on site, 1 MW per 1,000 GPUs.'],
    [2, shipment.racked],
  ]);
  if (roomAdded) say(s, 'The new site has room for a bigger lab.');
  if (retired.length) say(s, `Left in the cloud: ${retired.map((p) => p.title).join(', ')}.`);
  logNews(s, 'OpenMind owns a datacenter outside Abilene. It is mostly empty.');
}

/**
 * The first shipment: the rented fleet goes back (its deposit returned) and 1,000 owned Nimbus G4s
 * are racked, so the arrival has an affordable action and the task rate jumps at once. The Stage 2
 * build moves exactly this step into the free `Unpack the first shipment` project (stage2.md §1.3)
 * and calls it from there, so the rented GPUs keep running until the player unpacks.
 */
export function rackFirstShipment(s: GameState): { returned: string; racked: string } {
  const rented = s.gpus;
  const before = Math.max(1, potentialTasksPerSec(s));
  const deposit = Math.max(MIN_DEPOSIT, DEPOSIT_PER_GPU * rented);
  addFunds(s, deposit);
  s.gpus = 1000;
  const jump = Math.max(1, Math.round(potentialTasksPerSec(s) / before));
  return {
    returned: `The ${fmtInt(rented)} rented GPUs go back. Deposit returned: ${fmtMoneyShort(deposit)}.`,
    racked: `1,000 Nimbus G4s racked. Tasks per second ×${jump}: the copies run on hardware OpenMind owns.`,
  };
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
  s.flags['gamblesThisStage'] = 0;
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
    then: (s) => say(s, 'GPUs can be rented. Each one runs a copy of the model.'),
  },
  { id: 'revPerSec', stages: [1, 2, 3], when: (s) => s.tasksSold >= 300 },
  // Greyed at $100 from the first sale (Paperclips shows it from second 0): always a goal in sight.
  { id: 'marketing', stages: [1, 2], when: (s) => s.tasksSold >= 1 },
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
