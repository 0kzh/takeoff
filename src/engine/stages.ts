import { GameState, say, blackout, logNews } from './state.js';
import { monthOf } from './format.js';
import { snapToStage } from './clock.js';
import { GRID_MW } from './economy.js';
import { fmtInt, fmtMoneyShort } from './format.js';

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

function show(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = true;
}

function hide(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = false;
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: 'The Startup',
    startMonth: monthOf(2025, 7),
    endMonth: monthOf(2025, 12),
    secondsPerMonth: 270,
    enter: (s) => {
      // The opening is one verb. Funds, then the GPU rental, arrive from the reveal rules.
      show(s, ['console', 'task']);
      say(s, 'Welcome to OpenMind. Customers are waiting.');
    },
    exit: () => 0,
  },
  {
    id: 2,
    name: 'Scale',
    startMonth: monthOf(2026, 1),
    endMonth: monthOf(2026, 12),
    secondsPerMonth: 210,
    enter: (s) => {
      blackout(s, 2, 'Ground broken outside Abilene.');
      hide(s, ['power', 'buyPower', 'compute', 'gridContract']);
      show(s, ['infrastructure', 'pricing', 'demandPct', 'revPerSec', 'log']);
      s.gridAuto = false;
      s.datacenters = Math.max(1, s.datacenters);
      s.gpus += 1000;
      s.powerCapacityMW = Math.max(s.powerCapacityMW, GRID_MW);
      logNews(s, 'OpenMind owns its first datacenter. The rented GPUs move in with the new ones.');
    },
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
      blackout(s, 2, `${s.training.deployedName} writes better code than anyone at OpenMind.`);
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
      blackout(s, 2, 'The model runs the business now. It is better at it.');
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
      blackout(s, 2, 'The first orbital datacenter reports in.');
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

/** UP's "stuck" condition: nothing to sell, no power, no money. */
export const STUCK = (s: GameState): boolean => s.power < 1 && s.funds < s.powerPrice && s.unbilled < 1;

/** Beats 5–8 wait this long after the beat before them. */
const BEAT_SPACING = 30;

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

function beat(s: GameState): void {
  s.flags['beatAt'] = s.stats.timePlayed;
}

const spaced = (s: GameState): boolean => s.stage > 1 || sinceFlag(s, 'beatAt') < 0 || sinceFlag(s, 'beatAt') >= BEAT_SPACING;

/** Stage 1 trigger-driven reveals (stages.md "Reveal order"). Once set, flags persist. */
const REVEAL_RULES: RevealRule[] = [
  // Beat 1: a task pays. The panel is only the funds line.
  {
    id: 'business',
    stages: [1],
    when: (s) => s.tasks >= 1,
    then: (s) => say(s, `Task complete. The customer pays ${fmtMoneyShort(s.price)}.`),
  },
  // Beat 2: something to save for, greyed, before it can be bought.
  {
    id: 'compute',
    stages: [1],
    when: (s) => s.funds >= 3 || s.tasks >= 20,
    then: (s) => say(s, 'GPUs can be rented. Each one runs a copy of Sage.'),
  },
  // Beat 3: a copy completes tasks without a click. Just the count.
  {
    id: 'fleet',
    stages: [1],
    when: (s) => s.gpus >= 1,
    then: (s) => {
      s.flags['firstGpuAt'] = s.stats.timePlayed;
      say(s, 'GPU rented. A copy of Sage completes a task every second.');
    },
  },
  // Beat 4: copies burn power. The meter, not the buy button.
  {
    id: 'power',
    stages: [1],
    when: (s) => s.revealed['fleet'] === true && (s.gpus >= 3 || sinceFlag(s, 'firstGpuAt') >= 20),
    then: (s) => {
      beat(s);
      say(s, 'Each task a copy completes burns 1 kWh. The meter drains.');
    },
  },
  // Beat 5: power has to be kept on.
  {
    id: 'buyPower',
    stages: [1],
    when: (s) => s.revealed['power'] === true && (s.power <= 800 || STUCK(s)) && spaced(s),
    then: (s) => {
      beat(s);
      say(s, 'Power is draining. Copies stop when it runs out.');
    },
  },
  // Beat 6: supply can outrun demand. The price is the lever.
  {
    id: 'pricing',
    stages: [1],
    when: (s) => s.revealed['buyPower'] === true && s.unbilled >= 20 && s.unbilled > ((s.flags['unbilledSeen'] as number) ?? 0) && spaced(s),
    then: (s) => {
      beat(s);
      say(s, `Sage makes more than customers buy at ${fmtMoneyShort(s.price)}. Unbilled tasks are piling up.`);
    },
  },
  // Beat 7: more customers at every price, and revenue per second with it.
  {
    id: 'marketing',
    stages: [1, 2],
    when: (s) => s.stage > 1 || (s.revealed['pricing'] === true && spaced(s) && (sinceFlag(s, 'firstPriceMoveAt') >= 30 || sinceFlag(s, 'beatAt') >= 45)),
    then: (s) => {
      s.revealed['revPerSec'] = true;
      s.revealed['demandPct'] = true;
      if (s.stage > 1) return;
      beat(s);
      say(s, 'Marketing brings more customers at every price.');
    },
  },
  { id: 'revPerSec', stages: [2, 3], when: (s) => s.tasksSold >= 1 },
  { id: 'demandPct', stages: [2, 3], when: (s) => s.tasksSold >= 1 },
  // Copies are a training concern. The opening only counts GPUs.
  { id: 'copies', stages: [1], when: (s) => s.revealed['training'] === true },
  // The Developments column and the date, from 3:30.
  { id: 'log', stages: [1, 2, 3, 4, 5], when: (s) => s.log.length > 0 && (s.stage > 1 || s.stats.timePlayed >= 210) },
  // Beat 8: Trust hires researchers. It does not wait on a backlog that never formed.
  {
    id: 'research',
    stages: [1, 2],
    when: (s) => ((s.flags['trustMilestones'] as number) || 0) >= 1 && spaced(s) && (s.stage > 1 || !s.revealed['pricing'] || s.revealed['marketing'] === true),
    then: (s) => {
      if (s.stage === 1) beat(s);
      show(s, ['hireResearcher', 'expandLab']);
      s.flags['researchAt'] = s.stats.timePlayed;
      say(s, `Trust earned: ${fmtInt(s.trust)}. Each one hires a researcher.`);
    },
  },
  {
    id: 'projects',
    stages: [1, 2, 3, 4, 5],
    when: (s) => (s.revealed['research'] === true && sinceFlag(s, 'researchAt') >= 40) || (STUCK(s) && s.gpus > 0),
    then: (s) => {
      if (s.stage === 1 && s.revealed['research']) say(s, 'Research buys projects.');
    },
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
  if (s.stage === 1) s.flags['unbilledSeen'] = s.unbilled;
}
