import { GameState, say, narrate, logNews, addFunds, isBought, counter, projectState } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort } from './format.js';
import { snapToStage } from './clock.js';
import { GRID_MW, researchCap, potentialTasksPerSec, contractRateStage1, contractWeight } from './economy.js';
import { withdrawProject } from './reveal.js';
import { trainCost, atPlateau, nextRunName, runOtherwiseReady } from './training.js';
import { calibrateMarket, autoTarget } from './market.js';
import { G4_PRICE, S2_FUNDS_SCALE, SUBSTATION_MW, lotCostOf } from './infrastructure.js';
import { fireCrisis, openChoice } from './events.js';
import { buyProject, isVisible } from './projects.js';
import { researchWanted } from './tick.js';
import { PROJECTS, exitReady } from '../data/projects.js';

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

/** Stage 1 projects that make no sense once ground is broken, retired without a line. */
const QUIET_RETIRE = ['p_contractor', 'p_cooling', 'p_expedite', 'p_soundwall', 'p_desks', 'p_contract'];
/** The rented fleet's deposit comes back at the transition: $400 a GPU, at least the first lot. */
export const DEPOSIT_PER_GPU = 400;
export const MIN_DEPOSIT = 25000;
/** Flags shown only while their stage is on screen; Stage 3 hides these (stage3.md §1.1). */
const STAGE2_ONLY_FLAGS = ['marketing', 'hireResearcher', 'expandLab', 'autoPrice', 'gasButton', 'solarButton', 'alignShare', 'dataRow'];

function show(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = true;
}

function hide(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = false;
}

/** Projects on screen that the next stage cannot sell: withdrawn now, named unless they go quietly. */
function retireProjects(s: GameState, next: number, quiet: string[]): string[] {
  const leftBehind = PROJECTS.filter(
    (p) => s.projects[p.id]?.shown && (s.projects[p.id]?.bought ?? 0) < p.uses && !p.stages.includes(next),
  );
  for (const p of leftBehind) withdrawProject(s, p.id);
  s.cadence.queue = s.cadence.queue.filter((id) => PROJECTS.find((p) => p.id === id)?.stages.includes(next));
  s.cadence.lateQueue = [];
  return leftBehind.filter((p) => !p.rescue && !quiet.includes(p.id)).map((p) => p.title);
}

/**
 * Stage 1 → 2 (stage2.md §1.1–1.2; the narration contract is arc.md §7). The rented fleet goes
 * back for a deposit that pays for the first lot; 1,000 owned GPUs run from the first second on
 * 5 MW; the market is calibrated once and priced on AUTO; signed contracts keep paying a fixed
 * rate. Pre-flight leaves no wall behind: Trust +2, and room in the lab for the next run.
 */
function enterScale(s: GameState): void {
  const now = s.stats.timePlayed;
  const before = Math.max(1, s.stats.tasksPerSec);
  const contracts = s.projects['p_contract']?.bought ?? 0;
  // Frozen before anything else changes: what Stage 1 was selling sets the market, contracts their
  // rate. The contract customers' share of Stage 1's sales becomes that fixed rate.
  s.contractIncome = contractRateStage1(s);
  const weight = contractWeight(s);
  calibrateMarket(s, weight / (1 + weight));

  const retired = retireProjects(s, 2, QUIET_RETIRE);
  // Stage 1's queued calendar modals are dropped; the one on screen (if any) is answered as usual.
  s.choiceQueue = [];

  // Power, its price and the grid toggle stay frozen as they were; the engine stops using them.
  hide(s, ['power', 'buyPower', 'compute', 'gridContract', 'site', 'contracts', 'interconnect', 'powerMW']);
  show(s, ['infrastructure', 'stores', 'autoPrice']);
  s.autoPrice = true;
  s.datacenters = Math.max(1, s.datacenters);
  s.powerCapacityMW = Math.max(s.powerCapacityMW, GRID_MW);
  s.trust = Math.max(2, s.trust + 2);
  s.lead = Math.min(7, Math.max(3, s.lead + 2));
  s.nextRivalIn = 270;
  s.flags['dataEra'] = false;
  // Ship With Open Issues? was asked once in Stage 1 and does not return (stage2.md §2.5).
  s.flags['shipIssuesAsked'] = true;

  let roomAdded = false;
  while (researchCap(s) < 1.25 * (trainCost(s).research ?? 0)) {
    s.labSpace += 1;
    roomAdded = true;
  }

  const rented = s.gpus;
  const firstLot = Math.round(1000 * G4_PRICE * S2_FUNDS_SCALE);
  const deposit = Math.max(firstLot, DEPOSIT_PER_GPU * rented, MIN_DEPOSIT);
  addFunds(s, deposit);
  s.gpus = 1000;
  s.gpusG5 = 0;
  const jump = Math.max(1, Math.round(potentialTasksPerSec(s) / before));
  s.cadence.lastRevealAt = now;
  s.cadence.lastMechanicAt = now;
  // AUTO starts at the price that clears the new output, so the first number that moves is
  // revenue (up), not a backlog: no Stage 1 price is left standing for a minute of ×10 supply.
  s.price = autoTarget(s);
  s.stats.priceHist = [];

  // Five lines, the console's height; they stay whole for 10 s before routine lines follow.
  const lines: [number, string][] = [
    [0.1, 'Ground broken outside Abilene.'],
    [2, `The ${fmtInt(rented)} rented GPUs go back. Deposit returned: ${fmtMoneyShort(deposit)}.`],
    [2, `1,000 Nimbus G4s on ${SUBSTATION_MW} MW at Abilene. Power is bought in megawatts now.`],
    [2, `Tasks per second ×${jump}: the copies run on hardware OpenMind owns.`],
    [2, 'Prices set themselves from here. Marketing ends; the market cards widen the market now.'],
  ];
  narrate(s, lines, 10);
  logNews(s, 'OpenMind owns its first datacenter. The rented GPUs go back to the cloud.');
  if (contracts > 0) {
    logNews(s, `No new custom contracts. The ${fmtInt(contracts)} signed keep paying ${fmtMoneyShort(Math.round(s.contractIncome))} a second.`);
  }
  if (retired.length) logNews(s, `Retired with the rented fleet: ${retired.join(', ')}.`);
  if (roomAdded) logNews(s, 'The new site has room for a bigger lab.');
}

/** Projects Stage 3 grants for free when a player arrives without them (stage3.md §1.1). */
const STAGE3_GRANTS = ['p_ai_assistants', 'p_parallel', 'p_auto_evals', 'p_standing_order'];

/**
 * Stage 2 → 3 (stage3.md §1, as far as the Stage 3 shell goes; its systems are the Stage 3
 * build's). The arc clamps, Trust and the research cap retire, data and hiring and marketing and
 * the price buttons leave, the Alignment panel arrives; narrated, the last four lines kept.
 */
function enterTakeoff(s: GameState): void {
  const now = s.stats.timePlayed;
  s.alignmentTrue = Math.min(75, Math.max(30, s.alignmentTrue));
  s.govRelations = Math.min(85, Math.max(25, s.govRelations + Math.min(10, 2 * Math.max(0, s.trust))));
  s.approval = Math.min(30, Math.max(-45, s.approval));
  s.lead = Math.min(9, Math.max(1, s.lead));
  s.trust = 0;
  if (!isBought(s, 'p_retention')) {
    s.alignmentTrue = Math.max(0, s.alignmentTrue - 3);
    s.flags['whistleblowRisk'] = counter(s, 'whistleblowRisk') + 1;
  }
  for (const id of STAGE3_GRANTS) {
    if (isBought(s, id)) continue;
    projectState(s, id).bought = 1;
    if (id === 'p_ai_assistants') {
      s.researchAlloc = Math.max(s.researchAlloc, 0.15);
      s.revealed['allocation'] = true;
    }
    if (id === 'p_auto_evals') s.revealed['evalLine'] = true;
    if (id === 'p_standing_order') {
      s.standingOrder = true;
      s.revealed['standingOrder'] = true;
    }
  }
  const retired = retireProjects(s, 3, []);
  // Stage 2's approach cards leave quietly with the stage (they are Stage 2's beats, not Stage 3's).
  for (const p of PROJECTS) if (p.late && s.projects[p.id]?.shown && !(s.projects[p.id]?.bought ?? 0)) withdrawProject(s, p.id);
  s.choiceQueue = [];
  s.autoPrice = true;
  hide(s, STAGE2_ONLY_FLAGS);
  show(s, ['alignment', 'takeoff']);
  s.cadence.lastRevealAt = now;

  const deployed = s.training.modelName.startsWith('Sage-3') ? s.training.modelName : 'Sage-3';
  const lines: [number, string][] = [
    [0.1, `${deployed} writes better code than anyone at OpenMind.`],
    [2, `Marketing is closed. ${deployed} sells itself.`],
    [2, 'Hiring is frozen. The researchers manage copies now.'],
    [2, `Runs are research programs now: ${fmtInt(trainCost(s).research ?? 0)} research for ${nextRunName(s)}. No data, no invoice.`],
    [2, 'Trust is not a number any more. The Committee will keep its own count.'],
    [2, 'New on the board: Alignment. One number on it is measured. The other is not on it yet.'],
  ];
  narrate(s, lines, 10);
  logNews(s, 'Sage-3 never stops learning. Its weights update every night on yesterday\'s work.');
  if (retired.length) logNews(s, `Retired: ${retired.join(', ')}.`);
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
    // The exit is a project (`Let Sage-3 write the code`); there is no other way out.
    exit: () => 0,
  },
  {
    id: 3,
    name: 'Takeoff',
    startMonth: monthOf(2027, 1),
    endMonth: monthOf(2027, 10),
    secondsPerMonth: 270,
    enter: enterTakeoff,
    // The Committee's vote is the only way out (stage3.md §7); the Stage 3 build adds it.
    exit: () => 0,
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

/** UP's "stuck" condition, debounced ~3 s: no power, no money for a block (the credit rescue). */
export const STUCK = (s: GameState): boolean => s.stuckFor >= 3;

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

/**
 * Stage 1 trigger-driven reveals (stages.md "Reveal order"). Once set, flags persist. The Research
 * panel arrives with Trust and Hire Researcher only; Expand Lab when research first nears its cap;
 * Projects about 40 s later with the first project — one idea at a time. Stage 2's buttons and
 * panels are rows of its content table (data/stage2.ts, engine/reveal.ts).
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
    // When the lab is full and something on screen (or the next run) needs more than it holds.
    when: (s) => s.revealed['research'] === true && s.research >= researchCap(s) - 0.5 && researchWanted(s).amount > researchCap(s),
    then: (s) => say(s, `The lab is full at ${fmtInt(researchCap(s))}. Expand Lab makes room for more research.`),
  },
  {
    id: 'projects',
    stages: [1, 2, 3, 4, 5],
    when: (s) => (s.revealed['research'] === true && sinceFlag(s, 'researchAt') >= 40) || (STUCK(s) && s.gpus > 0),
  },
  // The Insight line arrives with the first insight, not with the card that unlocks it (critic round 2 §6.7).
  { id: 'insight', stages: [1, 2], when: (s) => s.insightUnlocked && s.insight >= 1 },
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

// ---------- Stage 2 housekeeping (slow tick) ----------

/** The exit buys itself after sitting ready this long (arc §7). */
export const EXIT_AUTOBUY_SECONDS = 240;

/**
 * Once a second in Stage 2: the arrival measurements (the settled price, R0), the market triggers,
 * the soft-lock rescues of stage2.md §8, crises that wait on a condition, Al-Marsa's second offer,
 * and the exit that presses itself.
 */
export function updateStage2(s: GameState): void {
  if (s.stage !== 2) return;
  const now = s.stats.timePlayed;
  const ts = s.stats.timeInStage;
  if (ts >= 30 && s.flags['arrivalPrice'] === undefined) {
    s.flags['arrivalPrice'] = s.price;
    s.flags['r0'] = Math.max(1, s.stats.revPerSec - s.contractIncome);
  }
  // The short run arrives the first time a run waits for money and nothing else (critic C3).
  if (!s.revealed['trainNow'] && runOtherwiseReady(s) && s.funds < (trainCost(s).funds ?? 0)) {
    s.revealed['trainNow'] = true;
    say(s, 'Train now: a run can start on the money there is and keep that share of its gain.');
  }
  // The bigger GPU lots join the row as the fleet grows into them (critic C1: sizes side by side).
  if (!s.revealed['lot5'] && (s.gpus >= 3000 || s.funds >= lotCostOf(s, 5000))) s.revealed['lot5'] = true;
  if (!s.revealed['lot25'] && (s.gpus >= 15000 || s.funds >= lotCostOf(s, 25000))) s.revealed['lot25'] = true;
  const arrival = s.flags['arrivalPrice'];
  if (typeof arrival === 'number' && s.price < 0.6 * arrival) {
    if (typeof s.flags['priceLowSince'] !== 'number') s.flags['priceLowSince'] = now;
  } else {
    delete s.flags['priceLowSince'];
  }

  // §8 Research rate: a lab still without AI research assistants at ts 900 gets them at half price.
  if (ts >= 900 && !isBought(s, 'p_ai_assistants') && s.flags['assistantsHalf'] !== true) {
    s.flags['assistantsHalf'] = true;
    const minutes = Math.max(1, Math.round(researchMinutesAway(s)));
    say(s, `The Research Plateau — at this rate the next run is ${minutes} minutes away. The model could help.`);
  }
  // §8 Research cap: nothing affordable raises the cap for 120 s → the lab borrows the cafeteria.
  if (atPlateau(s) && s.trust < 1 && !capFixAffordable(s)) {
    if (typeof s.flags['capStuckSince'] !== 'number') s.flags['capStuckSince'] = now;
    else if (now - (s.flags['capStuckSince'] as number) >= 120) {
      s.labSpace += 1;
      delete s.flags['capStuckSince'];
      say(s, 'The lab borrows the cafeteria.');
    }
  } else {
    delete s.flags['capStuckSince'];
  }

  if (s.flags['subpoenaDue'] === true) {
    delete s.flags['subpoenaDue'];
    fireCrisis(s, 'cr_subpoena');
  }
  if (s.flags['riotsDue'] === true) {
    delete s.flags['riotsDue'];
    fireCrisis(s, 'cr_riots');
  }
  const back = s.flags['gulfReturnAt'];
  if (typeof back === 'number' && now >= back) {
    delete s.flags['gulfReturnAt'];
    openChoice(s, 'c_gulf', {});
  }

  // The exit presses itself when it has been ready for four minutes.
  const ready = exitReady(s) && isVisible(s, PROJECTS.find((p) => p.id === 'p_superhuman_coder')!);
  if (ready) {
    if (typeof s.flags['exitReadySince'] !== 'number') s.flags['exitReadySince'] = now;
    else if (now - (s.flags['exitReadySince'] as number) >= EXIT_AUTOBUY_SECONDS) {
      say(s, 'Sage-3 has started without waiting to be asked.');
      buyProject(s, 'p_superhuman_coder');
    }
  } else {
    delete s.flags['exitReadySince'];
  }
}

/** Minutes of human research until the next run (the Research Plateau line). */
function researchMinutesAway(s: GameState): number {
  const need = Math.max(0, (trainCost(s).research ?? 0) - s.research);
  return need / Math.max(1, s.researchers * 10) / 60;
}

/** A visible project that raises the research cap and that the lab can pay for. */
function capFixAffordable(s: GameState): boolean {
  return ['p_research_cluster', 'p_exp_scheduler', 'p_checkpoint_farm', 'p_lab_cluster', 'p_floor'].some((id) => {
    const def = PROJECTS.find((p) => p.id === id);
    return !!def && isVisible(s, def) && def.canAfford(s);
  });
}
