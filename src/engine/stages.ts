import { GameState, say, logNews, inPrologue } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort } from './format.js';
import { snapToStage } from './clock.js';
import { ARRIVAL_GPUS, GRID_FIRST_TIER, gridOutgrown, researchCap, rentQuota } from './economy.js';
import { cardWallSeconds } from './training.js';
import { researchWanted } from './tick.js';
import { APPROVAL_START } from './world.js';

export interface StageDef {
  id: number;
  name: string;
  startMonth: number;
  endMonth: number;
  secondsPerMonth: number;
  enter: (s: GameState) => void;
  exit: (s: GameState) => number;
}


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
    secondsPerMonth: 240,
    enter: (s) => {
      show(s, ['console', 'task']);
      say(s, 'Welcome to OpenMind. Customers are waiting.');
    },
    exit: () => 0,
  },
  {
    id: 2,
    name: 'The Race',
    startMonth: monthOf(2026, 1),
    endMonth: monthOf(2026, 12),
    secondsPerMonth: 210,
    enter: (s) => {
      say(s, 'First Datacenter online outside Abilene. Nobody at OpenMind completes tasks by hand anymore.');
      hide(s, ['task', 'buyPower']);
      show(s, ['infrastructure', 'power', 'gridCapacity', 'gridContract', 'capabilityHeader', 'revPerSec', 'data', 'mind']);
      s.gridAuto = true;
      s.flags['powerOut'] = false;
      s.datacenters = Math.max(1, s.datacenters);
      s.gridCapacity = Math.max(GRID_FIRST_TIER, s.gridCapacity);
      s.gpus = ARRIVAL_GPUS;
      s.chipGen = Math.max(1, s.chipGen);
      s.dcTier = Math.max(1, s.dcTier);
      s.approval = Math.min(100, Math.max(0, APPROVAL_START + s.approval));
      s.tempo = 50;
      s.history = s.training.models.map((m) => [0, Math.round(m.date * 1000) / 1000, m.capability, Math.round(m.capability * 0.92 * 1000) / 1000, 0]);
      s.flags['stage2At'] = s.stats.timePlayed;
      s.flags['runsThisStage'] = 0;
      logNews(s, 'OpenMind owns its first datacenter. The rented GPUs go back to the cloud. These are ours.');
      s.consoleQueue.push({ delay: 20, text: 'Each GPU here runs a copy. Buy GPUs fills the hall; Build Datacenter adds another.' });
      s.consoleQueue.push({
        delay: 14,
        text: 'Something in the loss keeps a shape. There is a map of it under Training.',
      });
    },
    exit: () => 0,
  },
  {
    id: 3,
    name: 'Takeoff',
    startMonth: monthOf(2027, 1),
    endMonth: monthOf(2027, 10),
    secondsPerMonth: 270,
    enter: (s) => {
      say(s, `${s.training.deployedName} writes better code than anyone at OpenMind.`);
      hide(s, ['marketing', 'hireResearcher', 'expandLab']);
      show(s, ['alignment', 'security', 'geopolitics', 'oversight']);
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
      say(s, 'The model runs the business now. It is better at it.');
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
      say(s, 'The first orbital datacenter reports in.');
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
  s.flags['pressReleases'] = 0;
  s.flags['emailsThisStage'] = 0;
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

export const STUCK = (s: GameState): boolean => s.stuckFor >= 3;

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

export const BEAT_SPACING = 30;

function beat(s: GameState): void {
  s.flags['beatAt'] = s.stats.timePlayed;
}

const spaced = (s: GameState): boolean => sinceFlag(s, 'beatAt') < 0 || sinceFlag(s, 'beatAt') >= BEAT_SPACING;

export function mechanic(s: GameState): void {
  s.flags['s1MechanicAt'] = s.stats.timePlayed;
}

export function mechanicClear(s: GameState): boolean {
  if (typeof s.flags['firstReleaseAt'] === 'number' && !s.revealed['focus']) return false;
  const at = sinceFlag(s, 's1MechanicAt');
  return at < 0 || at >= BEAT_SPACING;
}

function quotaAfterEvent(s: GameState): boolean {
  const released = sinceFlag(s, 'firstReleaseAt');
  return released < 0 || s.flags['calendarOpened'] === true || released >= 120;
}

const REVEAL_RULES: RevealRule[] = [
  {
    id: 'business',
    stages: [1],
    when: (s) => s.tasks >= 1,
    then: (s) => say(s, `Task complete. The customer pays ${fmtMoneyShort(s.price)}.`),
  },
  {
    id: 'compute',
    stages: [1],
    when: (s) => s.funds >= 3 || s.tasks >= 20,
    then: (s) => say(s, 'GPUs can be rented. They train Sage, and later run it.'),
  },
  {
    id: 'fleet',
    stages: [1],
    when: (s) => s.gpus >= 1,
    then: (s) => {
      s.flags['firstGpuAt'] = s.stats.timePlayed;
    },
  },
  {
    id: 'power',
    stages: [1],
    when: (s) => s.revealed['fleet'] === true,
  },
  {
    id: 'buyPower',
    stages: [1],
    when: (s) => s.revealed['power'] === true && (s.power <= 800 || STUCK(s)) && spaced(s),
    then: (s) => {
      beat(s);
      say(s, 'Power is draining. Everything stops when it runs out.');
    },
  },
  {
    id: 'gridCapacity',
    stages: [1],
    when: (s) => s.revealed['buyPower'] === true && !s.gridAuto && gridOutgrown(s) && spaced(s),
    then: (s) => {
      beat(s);
      say(s, 'The fleet has outgrown the grid connection. Expand Grid buys power in bigger blocks.');
    },
  },
  {
    id: 'pricing',
    stages: [1],
    when: (s) => !inPrologue(s) && sinceFlag(s, 'sageLiveAt') >= 8 && spaced(s),
    then: (s) => {
      beat(s);
      say(s, `Customers buy what Sage makes at ${fmtMoneyShort(s.price)}. More tasks sell at a lower price and each earns less.`);
    },
  },
  {
    id: 'marketing',
    stages: [1, 2],
    when: (s) => s.revealed['pricing'] === true && spaced(s) && (sinceFlag(s, 'firstPriceMoveAt') >= 30 || sinceFlag(s, 'beatAt') >= 45),
    then: (s) => {
      s.revealed['revPerSec'] = true;
      beat(s);
      say(s, 'Marketing brings more customers at every price.');
    },
  },
  {
    id: 'quota',
    stages: [1],
    when: (s) => s.gpus >= 60 && !s.training.run && (sinceFlag(s, 'lastReleaseAt') < 0 || sinceFlag(s, 'lastReleaseAt') >= 30)
      && mechanicClear(s) && quotaAfterEvent(s),
    then: (s) => {
      mechanic(s);
      say(s, `The cloud will rent OpenMind ${fmtInt(rentQuota(s))} GPUs and no more.`);
    },
  },
  {
    id: 'focus',
    stages: [1],
    when: (s) => sinceFlag(s, 'firstReleaseAt') >= 30,
    then: (s) => {
      mechanic(s);
      say(s, 'Focus chooses what the next model is trained for.');
    },
  },
  { id: 'log', stages: [1, 2, 3, 4, 5], when: (s) => s.log.length > 0 && s.stats.timePlayed >= 210 },
  {
    id: 'research',
    stages: [1, 2],
    when: (s) => ((s.flags['trustMilestones'] as number) || 0) >= 1 && spaced(s) && (!s.revealed['pricing'] || s.revealed['marketing'] === true) && s.revealed['training'] === true,
    then: (s) => {
      beat(s);
      show(s, ['hireResearcher', 'expandLab']);
      s.flags['researchAt'] = s.stats.timePlayed;
      say(s, 'Trust pays for a researcher or a lab space. Task milestones earn more.');
    },
  },
  {
    id: 'expandLab',
    stages: [1],
    when: (s) => s.revealed['projects'] === true && sinceFlag(s, 'projectsAt') >= 40
      && s.research >= researchCap(s) - 0.5 && researchWanted(s).amount > researchCap(s) && cardWallSeconds(s) >= 30 && mechanicClear(s),
    then: (s) => say(s, `The lab is full at ${fmtInt(researchCap(s))}. Expand Lab makes room for more research.`),
  },
  {
    id: 'training',
    stages: [1],
    when: (s) => s.revealed['fleet'] === true && s.gpus >= 1,
    then: (s) => {
      beat(s);
      s.flags['trainingAt'] = s.stats.timePlayed;
      say(s, 'GPU rented. Sage can be trained on it: training takes money, GPUs and power.');
    },
  },
  {
    id: 'projects',
    stages: [1, 2, 3, 4, 5],
    when: (s) => (s.revealed['research'] === true && sinceFlag(s, 'researchAt') >= 40) || (STUCK(s) && s.gpus > 0),
    then: (s) => {
      s.flags['projectsAt'] = s.stats.timePlayed;
      if (s.revealed['research']) say(s, 'Research buys projects.');
    },
  },
  {
    id: 'data',
    stages: [1],
    when: (s) => s.revealed['research'] === true && sinceFlag(s, 'researchAt') >= 20 && spaced(s),
    then: (s) => say(s, 'Training data: every task completed teaches the next model a little. The public web can be scraped for more.'),
  },
  { id: 'insight', stages: [1, 2], when: (s) => s.insightUnlocked && s.insight >= 1 },
  {
    id: 'race',
    stages: [2],
    when: (s) => sinceFlag(s, 'stage2At') >= 100 && spaced(s),
    then: (s) => {
      beat(s);
      say(s, 'Anthrosoft publishes a capability chart. Everyone has one now. The Race panel keeps ours.');
      logNews(s, 'Every frontier lab now publishes a capability chart. The y axes do not agree.');
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
