import { GameState, say, printLine } from './state.js';
import {
  TICK_SECONDS, autoBuyPower, produce, sell, researchTick, trustCheck, decayHype, decayEffects,
  powerPriceWalk, averages, bottleneckMessages, researchCap, payContracts, trackStuck, updateInterconnect,
  clickTask, buyPower, rentGpu, lowerPrice, raisePrice, buyMarketing, hireResearcher, expandLab,
  toggleGrid, toggleAutoPrice, setResearchAlloc, hireFadeCheck,
} from './economy.js';
import {
  buildDatacenter, buyGpuBatch, buyTurbines, buySolar, buyNuclear, toggleStanding, updatePowerQueue,
  runStandingOrder, infrastructureMessages,
} from './infrastructure.js';
import { updateAutoPrice, recordPrice, floodedCheck } from './market.js';
import {
  updateData, dataWallCheck, dataWall, updateWorld, buySL3, toggleJobFund, toggleShareEvals, cycleAlignShare,
} from './world.js';
import {
  updateTraining, startTraining, trainNow, setFocus, redTeam, release, releaseInternal, finishTraining, trainCost, atPlateau, trainSlotFree, runFixNames,
} from './training.js';
import { buyProject, visibleProjects, projectById } from './projects.js';
import { farRung, rungHelper, rungRelief } from '../data/projects.js';
import { updateProjects, updateStageContent, noteReveals } from './reveal.js';
import {
  updateDevelopments, updateScheduled, updateChoice, updateRival, idleGuard, resolveChoice, takeDefault, fireEvent, drainChoiceQueue,
} from './events.js';
import { updateReveals, checkStageExit, updateStage2 } from './stages.js';
import { advanceClock } from './clock.js';
import { checkEnding, forceEnding } from './endings.js';
import { fmtInt, fmtNum, fmtDuration, fmtMoneyShort } from './format.js';

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
 *   2. power        — Stage 1: Grid Contract auto-buy, the stuck timer, the price walk (slow);
 *                     Stage 2: plants in the queue come online
 *   3. billing      — AUTO moves the price; the market bills; contracts pay; hype and effects decay
 *   4. data and research — the crawl and the synthetic writers; research toward the cap; insight; Trust
 *   5. training     — both pipeline slots and the red-team cooldown; the Abilene interconnect
 *   6. projects     — panel reveals, project triggers and the drip, Stage 2 rows, the late drip, the governor
 *   7. events       — scheduled crises, choice timers, developments, rival releases, idle guard
 *   8. clock        — game date
 *   9. stage checks — stage exits, endings
 *  10. stats        — time played; slow tick: averages, milestones, bottleneck lines, the standing
 *                     order, jobs/approval/relations, the data wall, Stage 2 rescues
 */
export function step(s: GameState): void {
  const dt = TICK_SECONDS;
  const slow = (s.tickCount + 1) % SLOW_TICK_EVERY === 0;
  s.tickCount += 1;

  produce(s, dt);

  updatePowerQueue(s, dt);
  autoBuyPower(s);
  trackStuck(s, dt);
  if (slow) powerPriceWalk(s);

  updateAutoPrice(s, dt);
  sell(s, dt);
  payContracts(s, dt);
  decayHype(s, dt);
  decayEffects(s, dt);

  updateData(s, dt);
  researchTick(s, dt);
  trustCheck(s);

  updateTraining(s, dt);
  updateInterconnect(s, dt);

  updateReveals(s);
  updateProjects(s);
  updateStageContent(s);

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
    if (head.text) printLine(s, head.text);
  }
}

function slowStats(s: GameState): void {
  trackPlateau(s);
  averages(s);
  taskMilestones(s);
  bottleneckMessages(s);
  researchWall(s);
  rungWatch(s);
  rungRelief(s);
  trustPace(s);
  wallWatch(s);
  hireFadeCheck(s);
  if (s.stage === 2) {
    runStandingOrder(s);
    updateWorld(s);
    dataWallCheck(s);
    infrastructureMessages(s);
    recordPrice(s);
    floodedCheck(s);
    updateStage2(s);
  }
}

/** When the plateau began (the desks offer waits 45 s for Trust or another fix first). */
function trackPlateau(s: GameState): void {
  if (atPlateau(s)) {
    if (typeof s.flags['plateauSince'] !== 'number') s.flags['plateauSince'] = s.stats.timePlayed;
  } else if (s.flags['plateauSince'] !== undefined) {
    delete s.flags['plateauSince'];
  }
}

/** UP-style report: `10,000 tasks completed in 7 minutes 12 seconds` (whole minutes from ten minutes on). */
function taskMilestones(s: GameState): void {
  while (s.tasks >= s.stats.nextTaskMilestone) {
    const t = s.stats.timePlayed;
    say(s, `${fmtInt(s.stats.nextTaskMilestone)} tasks completed in ${fmtDuration(t >= 600 ? Math.floor(t / 60) * 60 : t)}.`);
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
  if (s.stage >= 2) {
    if (shown('p_research_cluster')) return 'The Research cluster holds four times as much.';
    if (shown('p_exp_scheduler')) return 'The Experiment scheduler holds four times as much.';
    if (shown('p_checkpoint_farm')) return 'The Checkpoint farm holds four times as much.';
  }
  if (s.revealed['expandLab'] && s.trust >= 1) return 'Expand Lab to hold more.';
  if (shown('p_lab_cluster')) return 'The Experiment tracker doubles it.';
  if (shown('p_floor')) return 'Lease the floor upstairs.';
  if (shown('p_desks')) return 'Rent desks across the street.';
  return s.revealed['expandLab'] ? 'Expand Lab with the next Trust.' : 'More room comes with Trust.';
}

/** Seconds between two wall lines while research stays pinned under something it cannot hold. */
export const WALL_REPEAT_SECONDS = 120;

/**
 * Research at its cap: name the wall and the fix when something on screen needs more than the lab
 * holds (the Research Plateau when it is the next training run), and say it again every 2 minutes
 * while it lasts. A wall is only marked as told when a line prints (critic round 2 §4.1: a cap reached
 * before the Projects panel had nothing to say, was marked, and never spoke again).
 */
function researchWall(s: GameState): void {
  if (!s.revealed['research'] || s.stage >= 3) return;
  const cap = researchCap(s);
  if (s.research < cap) return;
  const now = s.stats.timePlayed;
  const want = researchWanted(s);
  if (want.amount > cap) {
    if (now - ((s.flags['wallSaidAt'] as number) ?? -999) < WALL_REPEAT_SECONDS) return;
    s.flags['wallSaidAt'] = now;
    const fix = capFix(s);
    if (want.what === 'the next run') {
      say(s, `The Research Plateau — the next run needs ${fmtInt(want.amount)} research. The lab holds ${fmtInt(cap)}. ${fix}`);
    } else {
      say(s, `Research at capacity. ${want.what} needs ${fmtInt(want.amount)}. ${fix}`);
    }
    return;
  }
  if (!s.insightUnlocked) return;
  const key = `wall:${cap}`;
  if (s.flags[key]) return;
  if (s.stage < 2) {
    s.flags[key] = true;
    say(s, `Research at capacity: ${fmtInt(cap)}. Insight accrues.`);
  } else if (now - ((s.flags['capLineAt'] as number) ?? -999) >= 120) {
    // Stage 2: the cap moves with every room; the line carries its number, at most every 2 minutes.
    s.flags[key] = true;
    s.flags['capLineAt'] = now;
    say(s, `Research at capacity: ${fmtInt(cap)}. Insight accrues.`);
  }
}

/**
 * Stage 1: a pinned rung more than four minutes away at the current income names the card that
 * shortens it (drawn urgent), again every three minutes while that holds (critic C13, arc G31).
 */
function rungWatch(s: GameState): void {
  const far = farRung(s);
  const helper = far ? rungHelper(s) : '';
  if (!far || !helper) return;
  const now = s.stats.timePlayed;
  if (now - ((s.flags['rungWatchAt'] as number) ?? -999) < 180) return;
  s.flags['rungWatchAt'] = now;
  const rung = projectById(far.id)?.title ?? 'The next rung';
  const card = projectById(helper)?.title ?? 'A revenue card';
  say(s, `${rung} is ${Math.ceil(far.seconds / 60)} minutes away at ${fmtMoneyShort(Math.round(s.stats.revPerSec))}/s. ${card} shortens it.`);
}

/**
 * Stage 2: a wall in front of the next run (the lab's research cap, the data wall) that has stood for
 * three minutes is named again with the cards that answer it, every three minutes (critic C9, G31).
 */
function wallWatch(s: GameState): void {
  if (s.stage !== 2 || !s.revealed['training'] || !trainSlotFree(s)) return;
  const cost = trainCost(s);
  const plateau = atPlateau(s);
  const data = !plateau && dataWall(s);
  const now = s.stats.timePlayed;
  if (!plateau && !data) {
    delete s.flags['wallWatchSince'];
    return;
  }
  const since = s.flags['wallWatchSince'];
  if (typeof since !== 'number') {
    s.flags['wallWatchSince'] = now;
    s.flags['wallWatchAt'] = now;
    return;
  }
  if (now - ((s.flags['wallWatchAt'] as number) ?? now) < 180) return;
  s.flags['wallWatchAt'] = now;
  const fixes = runFixNames(s);
  const minutes = Math.max(1, Math.round((now - since) / 60));
  if (plateau) {
    const fix = fixes ? ` ${fixes} make${fixes.includes(',') ? '' : 's'} room.` : ' Expand Lab with the next Trust.';
    say(s, `The lab has held ${fmtInt(researchCap(s))} research for ${minutes} minutes; the next run needs ${fmtInt(cost.research ?? 0)}.${fix}`);
  } else {
    const fix = fixes ? ` ${fixes} close${fixes.includes(',') ? '' : 's'} it.` : '';
    say(s, `The Data Wall, ${minutes} minutes on — the next run needs ${fmtNum((cost.data ?? 0) - s.data, 1)} T more.${fix}`);
  }
}

/**
 * Stage 1: the next Trust milestone is never more than 2½ minutes away at the current task rate
 * (critic C13: a slow player went sixteen minutes without one, Hire and Expand grey throughout).
 */
function trustPace(s: GameState): void {
  if (s.stage !== 1 || !s.revealed['research']) return;
  const soon = Math.ceil((s.tasks + 150 * Math.max(1, s.stats.tasksPerSec)) / 100) * 100;
  if (s.nextTrust > soon) s.nextTrust = soon;
}

/** Every player verb. Each returns true when it changed state. */
export const actions = {
  clickTask,
  buyPower,
  rentGpu,
  lowerPrice,
  raisePrice,
  toggleAutoPrice,
  buyMarketing,
  hireResearcher,
  expandLab,
  setResearchAlloc,
  toggleGrid,
  buildDatacenter,
  buyGpuBatch,
  buyTurbines,
  buySolar,
  buyNuclear,
  toggleStanding,
  buySL3,
  toggleJobFund,
  toggleShareEvals,
  cycleAlignShare,
  startTraining,
  trainNow,
  setFocus,
  redTeam,
  release,
  releaseInternal,
  finishTraining,
  buyProject,
  resolveChoice,
  takeDefault,
  fireEvent,
  forceEnding,
};

export type Actions = typeof actions;
