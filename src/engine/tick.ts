import { GameState, say, printLine } from './state.js';
import {
  TICK_SECONDS, autoBuyPower, produce, sell, researchTick, trustCheck, decayHype, decayEffects,
  powerPriceWalk, averages, bottleneckMessages, researchCap, contractIncome, trackStuck, updateInterconnect,
  clickTask, buyPower, rentGpu, lowerPrice, raisePrice, buyMarketing, hireResearcher, expandLab,
  toggleGrid, buildDatacenter, buyGpuBatch, buyTurbines,
} from './economy.js';
import { updateTraining, startTraining, setFocus, redTeam, release, finishTraining, trainCost, atPlateau } from './training.js';
import { buyProject, visibleProjects } from './projects.js';
import { updateProjects, noteReveals } from './reveal.js';
import {
  updateDevelopments, updateScheduled, updateChoice, updateRival, idleGuard, resolveChoice, fireEvent, drainChoiceQueue,
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
 *   2. power        — Grid Contract auto-buy; the stuck timer; slow tick: power price random walk
 *   3. billing      — demand roll sells unbilled tasks; contracts pay; hype and timed effects decay
 *   4. research     — research fills toward the cap; insight accrues only at the cap; trust milestones
 *   5. training     — the run state machine and the red-team cooldown; the interconnect queue
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
  trackStuck(s, dt);
  if (slow) powerPriceWalk(s);

  sell(s);
  contractIncome(s, dt);
  decayHype(s, dt);
  decayEffects(s, dt);

  researchTick(s, dt);
  trustCheck(s);

  updateTraining(s, dt);
  updateInterconnect(s, dt);

  updateReveals(s);
  updateProjects(s);

  updateScheduled(s, dt);
  updateChoice(s, dt);
  updateDevelopments(s);
  if (slow) updateRival(s);
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
    printLine(s, head.text);
  }
}

function slowStats(s: GameState): void {
  trackPlateau(s);
  averages(s);
  taskMilestones(s);
  bottleneckMessages(s);
  researchWall(s);
}

/** When the plateau began (the desks offer waits 45 s for Trust or another fix first). */
function trackPlateau(s: GameState): void {
  if (atPlateau(s)) {
    if (typeof s.flags['plateauSince'] !== 'number') s.flags['plateauSince'] = s.stats.timePlayed;
  } else if (s.flags['plateauSince'] !== undefined) {
    delete s.flags['plateauSince'];
  }
}

/** UP-style report: `10,000 tasks completed in 7 minutes 12 seconds`. */
function taskMilestones(s: GameState): void {
  while (s.tasks >= s.stats.nextTaskMilestone) {
    say(s, `${fmtInt(s.stats.nextTaskMilestone)} tasks completed in ${fmtDuration(s.stats.timePlayed)}.`);
    s.stats.nextTaskMilestone *= 10;
  }
}

/** The most research anything on screen asks for: the next run, or a visible project. */
export function researchWanted(s: GameState): { amount: number; what: string } {
  let best = { amount: 0, what: '' };
  if (s.revealed['training'] && !s.training.run) {
    best = { amount: trainCost(s).research ?? 0, what: 'the next run' };
  }
  for (const p of visibleProjects(s)) {
    const r = p.cost(s).research ?? 0;
    if (r > best.amount) best = { amount: r, what: p.title };
  }
  return best;
}

/** The fix for a full lab that is on screen right now, named in the wall's console line. */
function capFix(s: GameState): string {
  const shown = (id: string) => visibleProjects(s).some((p) => p.id === id);
  if (s.revealed['expandLab'] && s.trust >= 1) return 'Expand Lab to hold more.';
  if (shown('p_lab_cluster')) return 'The Experiment tracker doubles it.';
  if (shown('p_floor')) return 'Lease the floor upstairs.';
  if (shown('p_desks')) return 'Rent desks across the street.';
  return s.revealed['expandLab'] ? 'Expand Lab with the next Trust.' : 'More room comes with Trust.';
}

/**
 * Research at its cap, once per cap value: name the wall and the fix when something on screen
 * needs more than the lab holds (the Research Plateau when it is the next training run).
 */
function researchWall(s: GameState): void {
  if (!s.revealed['research']) return;
  const cap = researchCap(s);
  if (s.research < cap) return;
  const key = `wall:${cap}`;
  if (s.flags[key]) return;
  s.flags[key] = true;
  const want = researchWanted(s);
  const fix = capFix(s);
  if (want.amount > cap) {
    if (want.what === 'the next run') {
      say(s, `The Research Plateau — the next run needs ${fmtInt(want.amount)} research. The lab holds ${fmtInt(cap)}. ${fix}`);
    } else {
      say(s, `Research at capacity. ${want.what} needs ${fmtInt(want.amount)}. ${fix}`);
    }
  } else if (s.insightUnlocked) {
    say(s, 'Research at capacity — insight accrues.');
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
