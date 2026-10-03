import { GameState, say } from './state.js';
import {
  TICK_SECONDS, autoBuyPower, produce, sell, researchTick, trustCheck, decayHype, decayEffects,
  powerPriceWalk, averages, bottleneckMessages, researchCap, marketingMult,
  clickTask, buyPower, rentGpu, lowerPrice, raisePrice, buyMarketing, hireResearcher, expandLab,
  toggleGrid, buildDatacenter, buyGpuBatch, buyTurbines,
} from './economy.js';
import { updateTraining, startTraining, setFocus, redTeam, release, finishTraining, trainCost } from './training.js';
import { updateProjects, buyProject } from './projects.js';
import {
  updateDevelopments, updateScheduled, updateChoice, updateRival, idleGuard, resolveChoice, fireEvent,
} from './events.js';
import { updateReveals, checkStageExit } from './stages.js';
import { advanceClock } from './clock.js';
import { checkEnding, forceEnding } from './endings.js';
import { fmtInt, fmtDuration } from './format.js';

export const TICK_MS = 100;
export const SLOW_TICK_EVERY = 10;
const MAX_TICKS_PER_CALL = 36000;

/** Advances the simulation by `dtMs` of game time in fixed 100 ms steps. Pure state, no DOM. */
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

/**
 * One 100 ms logic step. Order of operations:
 *   1. production   — copies complete tasks (Stage 1: each burns 1 kWh)
 *   2. power        — Grid Contract auto-buy; slow tick: power price random walk
 *   3. billing      — demand roll sells unbilled tasks; hype and timed effects decay
 *   4. research     — research fills toward the cap; insight accrues only at the cap; trust milestones
 *   5. training     — the run state machine and the red-team cooldown
 *   6. projects     — panel reveals, then project triggers
 *   7. events       — scheduled incidents, choice timers, developments, rival releases, idle guard
 *   8. clock        — game date
 *   9. stage checks — stage exit conditions, endings
 *  10. stats        — time played, slow tick: 10 s averages, milestones, bottleneck lines
 */
export function step(s: GameState): void {
  const dt = TICK_SECONDS;
  const slow = (s.tickCount + 1) % SLOW_TICK_EVERY === 0;
  s.tickCount += 1;

  produce(s, dt);

  autoBuyPower(s);
  if (slow) powerPriceWalk(s);

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
  if (slow) updateRival(s);
  idleGuard(s, dt);
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
    say(s, head.text);
  }
}

function slowStats(s: GameState): void {
  averages(s);
  taskMilestones(s);
  bottleneckMessages(s);
  plateauMessage(s);
  if (s.revealed['apiCustomers']) {
    s.apiCustomers = Math.max(s.apiCustomers, Math.floor(40 * Math.sqrt(s.capability) * marketingMult(s) * s.hypeBoost));
  }
}

/** UP-style report: `10,000 tasks completed in 7 minutes 12 seconds`. */
function taskMilestones(s: GameState): void {
  while (s.tasks >= s.stats.nextTaskMilestone) {
    say(s, `${fmtInt(s.stats.nextTaskMilestone)} tasks completed in ${fmtDuration(s.stats.timePlayed)}.`);
    s.stats.nextTaskMilestone *= 10;
  }
}

/** Named plateau: the lab cannot hold enough research for the next run. */
function plateauMessage(s: GameState): void {
  if (!s.revealed['training'] || s.training.run) return;
  const need = trainCost(s).research ?? 0;
  const cap = researchCap(s);
  const key = `plateau${s.training.runIndex}`;
  if (s.research >= cap && cap < need && !s.flags[key]) {
    s.flags[key] = true;
    say(s, `The Research Plateau — the next run needs ${fmtInt(need)} research. The lab holds ${fmtInt(cap)}.`);
  }
}

/** Every player verb. Each returns true when it changed state. */
export const actions = {
  clickTask,
  buyPower,
  rentGpu,
  lowerPrice,
  raisePrice,
  buyMarketing,
  hireResearcher,
  expandLab,
  toggleGrid,
  buildDatacenter,
  buyGpuBatch,
  buyTurbines,
  startTraining,
  setFocus,
  redTeam,
  release,
  finishTraining,
  buyProject,
  resolveChoice,
  fireEvent,
  forceEnding,
};

export type Actions = typeof actions;
