import { GameState, say, counter } from './state.js';
import {
  TICK_SECONDS, produce, updateAutoPrice, sell, researchTick, trustCheck, decayHype, decayEffects,
  powerPriceWalk, averages, bottleneckMessages, researchCap, trackStuck,
  clickTask, buyPower, rentGpu, lowerPrice, raisePrice, buyMarketing, hireResearcher, expandLab,
  buildDatacenter, buyGpuBatch, expandGrid, rentQuota, upgradeSecurity, canExpandLab } from './economy.js';
import { updateBaiwen, updateTempo, sampleHistory, updateTheft, updateIrrelevance } from './rivals.js';
import { updateWorld } from './world.js';
import {
  updateTraining, startTraining, setFocus, release, finishTraining, trainSlotFree, needsDatacenter, nextRunName, gpusNeeded, cardWall,
} from './training.js';
import { buyProject, visibleProjects } from './projects.js';
import { datacenterAtWall } from '../data/projects.js';
import { updateProjects, noteReveals } from './reveal.js';
import {
  updateDevelopments, updateScheduled, updateChoice, updateRival, idleGuard, resolveChoice, takeDefault, fireEvent, drainChoiceQueue,
} from './events.js';
import { updateReveals, checkStageExit } from './stages.js';
import { advanceClock } from './clock.js';
import { checkEnding, forceEnding } from './endings.js';
import { decodeFeature, failDecode, rewireFeature, markMindSeen, devMindSignal } from './mind.js';
import { fmtInt, fmtDuration } from './format.js';

export const TICK_MS = 100;
export const SLOW_TICK_EVERY = 10;
const MAX_TICKS_PER_CALL = 36000;

export function tick(s: GameState, dtMs: number): void {
  if (s.ending) return;
  s.tickAccum += dtMs;
  let n = 0;
  while (s.tickAccum >= TICK_MS && n < MAX_TICKS_PER_CALL) {
    s.tickAccum -= TICK_MS;
    step(s);
    n++;
    if (s.ending) break;
  }
  if (n >= MAX_TICKS_PER_CALL) s.tickAccum = 0;
}

export function step(s: GameState): void {
  const dt = TICK_SECONDS;
  const slow = (s.tickCount + 1) % SLOW_TICK_EVERY === 0;
  s.tickCount += 1;

  produce(s, dt);

  trackStuck(s, dt);
  if (slow) powerPriceWalk(s);

  updateAutoPrice(s, dt);
  sell(s);
  decayHype(s, dt);
  decayEffects(s, dt);

  researchTick(s, dt);
  trustCheck(s);

  updateTraining(s, dt);

  updateReveals(s);
  updateProjects(s);

  updateScheduled(s, dt);
  updateChoice(s, dt);
  updateDevelopments(s);
  if (slow) {
    updateRival(s);
    updateBaiwen(s);
    updateTempo(s);
    updateWorld(s);
    updateTheft(s);
    updateIrrelevance(s);
    sampleHistory(s);
  }
  drainChoiceQueue(s);
  idleGuard(s, dt);
  noteReveals(s);
  drainConsoleQueue(s, dt);

  advanceClock(s, dt);

  checkStageExit(s);
  checkEnding(s);

  s.stats.timePlayed += dt;
  s.stats.timeInStage += dt;
  if (slow) slowStats(s);
}

function drainConsoleQueue(s: GameState, dt: number): void {
  if (s.consoleQueue.length === 0) return;
  const head = s.consoleQueue[0]!;
  head.delay -= dt;
  if (head.delay <= 0) {
    s.consoleQueue.shift();
    if (head.text) say(s, head.text);
  }
}

function slowStats(s: GameState): void {
  trackCardWall(s);
  averages(s);
  taskMilestones(s);
  bottleneckMessages(s);
  researchWall(s);
  wallStage1(s);
  trustPace(s);
}

function trackCardWall(s: GameState): void {
  if (cardWall(s)) {
    if (typeof s.flags['cardWallSince'] !== 'number') s.flags['cardWallSince'] = s.stats.timePlayed;
  } else if (s.flags['cardWallSince'] !== undefined) {
    delete s.flags['cardWallSince'];
  }
}

function taskMilestones(s: GameState): void {
  while (s.tasks >= s.stats.nextTaskMilestone) {
    const t = s.stats.timePlayed;
    say(s, `${fmtInt(s.stats.nextTaskMilestone)} tasks completed in ${fmtDuration(t >= 600 ? Math.floor(t / 60) * 60 : t)}.`);
    s.stats.nextTaskMilestone *= 10;
  }
}

export function researchWanted(s: GameState): { amount: number; what: string } {
  let best = { amount: 0, what: '' };
  for (const p of visibleProjects(s)) {
    const r = p.cost(s).research ?? 0;
    if (r > best.amount) best = { amount: r, what: p.title };
  }
  return best;
}

function capFix(s: GameState): string {
  const cap = researchCap(s);
  const shown = (id: string) => visibleProjects(s).some((p) => p.id === id && (p.cost(s).research ?? 0) <= cap);
  if (canExpandLab(s)) return 'Expand Lab to hold more.';
  if (shown('s2_building')) return 'A New building doubles it.';
  if (shown('p_lab_cluster')) return 'The Experiment tracker doubles it.';
  if (shown('p_floor')) return 'Lease the floor upstairs.';
  return 'Expand Lab with the next Trust.';
}

export const WALL_REPEAT_SECONDS = 120;

function researchWall(s: GameState): void {
  if (!s.revealed['research']) return;
  const cap = researchCap(s);
  if (s.research < cap) return;
  const now = s.stats.timePlayed;
  const want = researchWanted(s);
  if (want.amount > cap) {
    if (now - ((s.flags['wallSaidAt'] as number) ?? -999) < WALL_REPEAT_SECONDS) return;
    s.flags['wallSaidAt'] = now;
    const fix = capFix(s);
    const key = `${want.what}|${cap}|${fix}`;
    if (s.flags['wallLineKey'] === key) {
      if (counter(s, 'wallLineCount') >= 3) return;
      s.flags['wallLineCount'] = counter(s, 'wallLineCount') + 1;
    } else {
      s.flags['wallLineKey'] = key;
      s.flags['wallLineCount'] = 1;
    }
    say(s, `Research at capacity. ${want.what} needs ${fmtInt(want.amount)}. ${fix}`);
    return;
  }
  if (!s.insightUnlocked) return;
  const key = `wall:${cap}`;
  if (s.flags[key]) return;
  s.flags[key] = true;
  say(s, `Research at capacity: ${fmtInt(cap)}. Insight accrues.`);
}

function wallStage1(s: GameState): void {
  datacenterAtWall(s);
  if (!needsDatacenter(s) || !trainSlotFree(s)) return;
  const now = s.stats.timePlayed;
  if (now - ((s.flags['wallLineAt'] as number) ?? -999) < 180) return;
  s.flags['wallLineAt'] = now;
  say(s, `${nextRunName(s)} needs ${fmtInt(gpusNeeded(s))} GPUs. The cloud will rent ${fmtInt(rentQuota(s))}. Build the First Datacenter.`);
}

function trustPace(s: GameState): void {
  if (!s.revealed['research']) return;
  const soon = Math.ceil((s.tasks + 150 * Math.max(1, s.stats.tasksPerSec)) / 100) * 100;
  if (s.nextTrust > soon) s.nextTrust = soon;
}

export const actions = {
  clickTask,
  buyPower,
  rentGpu,
  lowerPrice,
  raisePrice,
  buyMarketing,
  hireResearcher,
  expandLab,
  buildDatacenter,
  buyGpuBatch,
  expandGrid,
  upgradeSecurity,
  startTraining,
  setFocus,
  release,
  finishTraining,
  buyProject,
  resolveChoice,
  takeDefault,
  fireEvent,
  forceEnding,
  decodeFeature,
  failDecode,
  rewireFeature,
  markMindSeen,
  devMindSignal,
};

export type Actions = typeof actions;
