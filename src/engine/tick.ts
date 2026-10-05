import { GameState, say, printLine, counter } from './state.js';
import {
  TICK_SECONDS, autoBuyPower, produce, sell, researchTick, trustCheck, decayHype, decayEffects,
  powerPriceWalk, averages, bottleneckMessages, researchCap, payContracts, trackStuck,
  clickTask, buyPower, rentGpu, lowerPrice, raisePrice, buyMarketing, hireResearcher, expandLab,
  toggleGrid, toggleAutoPrice, setResearchAlloc, hireFadeCheck, rentQuota, setMonitorShare, powerBlockNews,
} from './economy.js';
import {
  buildDatacenter, buyGpuBatch, buyTurbines, buySolar, buyNuclear, toggleStanding, updatePowerQueue, cycleBuildShare, buyLotRow,
  runStandingOrder, infrastructureMessages,
} from './infrastructure.js';
import { updateAutoPrice, recordPrice, floodedCheck } from './market.js';
import {
  updateData, dataWallCheck, dataWall, updateWorld, buySL3, toggleJobFund, toggleShareEvals, cycleAlignShare,
} from './world.js';
import {
  updateTraining, startTraining, setFocus, redTeam, release, releaseInternal, finishTraining, trainCost, atPlateau, trainSlotFree, runFixNames, needsDatacenter, nextRunName, gpusNeeded,
  approve, sendBack, toggleHold, setStepSize, setRedteamDepth, runExperiments, cardWall,
} from './training.js';
import { stage3Tick, stage3Slow, setBuildBudget } from './stage3.js';
import { stage4Tick, stage4Slow, toggleVerify, setVerify } from './stage4.js';
import { stage5Tick, stage5Slow, buyRow, setSplitShare, cycleIndustryShare, setIndustryShare } from './space.js';
import { updateHold } from './hold.js';
import { setFleetShare, setFleetGoal, buildHousing } from './fleet.js';
import { cycleUbi, setUbiShare, setApprovalHold } from './society.js';
import { cycleDraft, setDraftShare, holdHearing, setStance } from './treaty.js';
import { alignWork, setAlignWork, reimage } from './alignment.js';
import { lobby, counterintel, stepPayments } from './world3.js';
import { buyProject, visibleProjects } from './projects.js';
import { datacenterAtWall } from '../data/projects.js';
import { updateProjects, updateStageContent, noteReveals } from './reveal.js';
import {
  updateDevelopments, updateScheduled, updateChoice, updateRival, idleGuard, resolveChoice, takeDefault, fireEvent, drainChoiceQueue,
} from './events.js';
import { updateReveals, checkStageExit, updateStage2 } from './stages.js';
import { advanceClock } from './clock.js';
import { checkEnding, forceEnding } from './endings.js';
import { fmtInt, fmtNum, fmtDuration } from './format.js';

export const TICK_MS = 100;
export const SLOW_TICK_EVERY = 10;
const MAX_TICKS_PER_CALL = 36000;

export function tick(s: GameState, dtMs: number): void {
  if (s.ending) {
    endingTick(s, dtMs);
    return;
  }
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

export const COUNTING_ENDINGS = ['concord', 'silence'];

function endingTick(s: GameState, dtMs: number): void {
  if (!COUNTING_ENDINGS.includes(s.ending)) return;
  const rate = typeof s.flags['endRate'] === 'number' ? (s.flags['endRate'] as number) : s.stats.tasksPerSec;
  s.taskFrac += (rate * dtMs) / 1000;
  const whole = Math.floor(s.taskFrac);
  if (whole > 0) {
    s.tasks += whole;
    s.taskFrac -= whole;
  }
}

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
  stage3Tick(s, dt);
  stage4Tick(s, dt);
  stage5Tick(s, dt);

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
  wallStage1(s);
  trustPace(s);
  wallWatch(s);
  hireFadeCheck(s);
  powerBlockNews(s);
  if (s.stage === 2) {
    runStandingOrder(s);
    updateWorld(s);
    dataWallCheck(s);
    infrastructureMessages(s);
    recordPrice(s);
    floodedCheck(s);
    updateStage2(s);
  }
  if (s.stage === 3) infrastructureMessages(s);
  updateHold(s);
  stage3Slow(s);
  stage4Slow(s);
  stage5Slow(s);
}

function trackPlateau(s: GameState): void {
  for (const [key, on] of [['plateauSince', atPlateau(s)], ['cardWallSince', cardWall(s)]] as const) {
    if (on) {
      if (typeof s.flags[key] !== 'number') s.flags[key] = s.stats.timePlayed;
    } else if (s.flags[key] !== undefined) {
      delete s.flags[key];
    }
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
  if (s.stage >= 2 && s.revealed['training'] && !s.training.run) {
    best = { amount: trainCost(s).research ?? 0, what: 'the next run' };
  }
  for (const p of visibleProjects(s)) {
    const r = p.cost(s).research ?? 0;
    if (r > best.amount) best = { amount: r, what: p.title };
  }
  return best;
}

function capFix(s: GameState): string {
  const cap = researchCap(s);
  const shown = (id: string) => visibleProjects(s).some((p) => p.id === id && (p.cost(s).research ?? 0) <= cap);
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

export const WALL_REPEAT_SECONDS = 120;

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
    const key = `${want.what}|${cap}|${fix}`;
    if (s.flags['wallLineKey'] === key) {
      if (counter(s, 'wallLineCount') >= 3) return;
      s.flags['wallLineCount'] = counter(s, 'wallLineCount') + 1;
    } else {
      s.flags['wallLineKey'] = key;
      s.flags['wallLineCount'] = 1;
    }
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
    s.flags[key] = true;
    s.flags['capLineAt'] = now;
    say(s, `Research at capacity: ${fmtInt(cap)}. Insight accrues.`);
  }
}

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

function wallStage1(s: GameState): void {
  datacenterAtWall(s);
  if (!needsDatacenter(s) || !trainSlotFree(s)) return;
  const now = s.stats.timePlayed;
  if (now - ((s.flags['wallLineAt'] as number) ?? -999) < 180) return;
  s.flags['wallLineAt'] = now;
  say(s, `${nextRunName(s)} needs ${fmtInt(gpusNeeded(s))} GPUs. The cloud will rent ${fmtInt(rentQuota(s))}. Build the First Datacenter.`);
}

function trustPace(s: GameState): void {
  if (s.stage !== 1 || !s.revealed['research']) return;
  const soon = Math.ceil((s.tasks + 150 * Math.max(1, s.stats.tasksPerSec)) / 100) * 100;
  if (s.nextTrust > soon) s.nextTrust = soon;
}

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
  setFocus,
  redTeam,
  release,
  releaseInternal,
  finishTraining,
  approve,
  sendBack,
  toggleHold,
  setStepSize,
  setRedteamDepth,
  runExperiments,
  alignWork,
  setAlignWork,
  reimage,
  setMonitorShare,
  lobby,
  counterintel,
  stepPayments,
  setBuildBudget,
  cycleBuildShare,
  buyLotRow,
  setFleetShare,
  setFleetGoal,
  buildHousing,
  cycleUbi,
  setUbiShare,
  setApprovalHold,
  cycleDraft,
  setDraftShare,
  holdHearing,
  setStance,
  toggleVerify,
  setVerify,
  buyRow,
  setSplitShare,
  cycleIndustryShare,
  setIndustryShare,
  buyProject,
  resolveChoice,
  takeDefault,
  fireEvent,
  forceEnding,
};

export type Actions = typeof actions;
