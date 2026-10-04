import { GameState, say, narrate, logNews, addFunds, isBought, counter, projectState } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort, fmtNum } from './format.js';
import { scheduleStage3, securityArrivalLine } from './events3.js';
import { snapToStage } from './clock.js';
import { GRID_MW, researchCap, potentialTasksPerSec, contractRateStage1, contractWeight, rentQuota } from './economy.js';
import { withdrawProject } from './reveal.js';
import { trainCost, atPlateau, nextRunName } from './training.js';
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
const QUIET_RETIRE = ['p_cooling', 'p_soundwall', 'p_abatement', 'p_ppa', 'p_desks', 'p_contract'];
/** The rented fleet's deposit comes back at the transition: $400 a GPU, at least the first lot. */
export const DEPOSIT_PER_GPU = 400;
export const MIN_DEPOSIT = 25000;
/** Flags shown only while their stage is on screen; Stage 3 hides these (stage3.md §1.1). */
// The AUTO billing line stays (critic C11: Stage 3 opened on the manual line, `0.0/s of 0.0/s produced: idle`).
const STAGE2_ONLY_FLAGS = ['marketing', 'hireResearcher', 'expandLab', 'gasButton', 'solarButton', 'alignShare', 'dataRow', 'lot5', 'lot25'];

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
  hide(s, ['power', 'buyPower', 'compute', 'gridContract', 'contracts']);
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
  // The new site's evaluation cluster: most of the next run's research is done on arrival, so the
  // first run on owned hardware does not wait out minutes of research (owner feedback U3).
  const firstRun = trainCost(s).research ?? 0;
  const researchGift = Math.max(0, Math.round(0.75 * firstRun - s.research));
  s.research += researchGift;

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
    [0.1, 'First Datacenter online outside Abilene.'],
    [2, `The ${fmtInt(rented)} rented GPUs go back. Deposit returned: ${fmtMoneyShort(deposit)}.`],
    [2, `1,000 Nimbus G4s on ${SUBSTATION_MW} MW. Each MW powers 1,000 GPUs; power is bought in megawatts now.`],
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
  if (researchGift > 0) logNews(s, 'The new site\'s first experiments come back: most of the next run\'s research is done.');
}

/** Projects Stage 3 grants for free when a player arrives without them (stage3.md §1.1). */
const STAGE3_GRANTS = ['p_ai_assistants', 'p_parallel', 'p_auto_evals', 'p_standing_order'];

/**
 * Stage 2 → 3 (stage3.md §1.1–§1.2). The arc's clamps, narrated; Trust, the research cap and data
 * retire; hiring, marketing, the price buttons, gas and solar leave; the release buttons become one
 * `Approve`; the Alignment panel arrives with a free monitor. Runs become research programs with a
 * GPU gate. The theft is scheduled for February if the weights are not air-gapped.
 */
function enterTakeoff(s: GameState): void {
  const now = s.stats.timePlayed;
  s.alignmentTrue = Math.min(75, Math.max(30, s.alignmentTrue));
  // The arc's clamps, narrated (critic C7, G32): a meter the player built up is not cut in silence.
  const govBefore = Math.round(s.govRelations);
  const trustBonus = Math.min(10, 2 * Math.max(0, s.trust));
  s.govRelations = Math.min(85, Math.max(25, s.govRelations + trustBonus));
  const govAfter = Math.round(s.govRelations);
  if (govAfter < govBefore) logNews(s, `A new Congress sits. Relations start again at ${govAfter} (from ${govBefore}).`);
  else if (govAfter > govBefore && trustBonus > 0) logNews(s, `Unspent Trust buys goodwill in Washington: relations ${govBefore} → ${govAfter}.`);
  const approvalBefore = Math.round(s.approval);
  s.approval = Math.min(30, Math.max(-45, s.approval));
  if (Math.round(s.approval) !== approvalBefore) logNews(s, `The news moves on. Approval settles at ${Math.round(s.approval)} (from ${approvalBefore}).`);
  const leadBefore = Math.round(s.lead * 10) / 10;
  s.lead = Math.min(9, Math.max(1, s.lead));
  const leadAfter = Math.round(s.lead * 10) / 10;
  if (leadAfter !== leadBefore) logNews(s, `Analysts revise the gap with Baiwen: ${leadAfter} months (from ${leadBefore}).`);
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
  // The G6 pre-order (Stage 2's last card): the allocation is free and the first lot lands at ts 60.
  if (s.flags['g6Preorder'] === true) {
    projectState(s, 'p_g6').bought = 1;
    s.flags['g6'] = true;
    s.revealed['shipments'] = true;
    s.shipments.push({ gpus: 100000, gen: 6, remaining: 60 });
  }
  const retired = retireProjects(s, 3, []);
  s.choiceQueue = [];
  s.autoPrice = true;
  hide(s, STAGE2_ONLY_FLAGS);
  hide(s, ['releaseInternal']);
  show(s, ['alignment', 'takeoff']);
  // What the public can run themselves: the last public model (§1.1).
  const publicModels = s.training.models.filter((m) => m.public);
  s.flags['publicCap'] = publicModels.length ? publicModels[publicModels.length - 1]!.capability : s.capability;
  if (s.flags['sage3Released'] === undefined) s.flags['sage3Released'] = 'public';
  // Capability is one number from here: the best model, deployed or internal, is the one that runs.
  s.capability = Math.max(s.capability, s.training.internalCapability);
  s.monitorShare = 0;
  s.rogueCopies = 0;
  s.flags['capMonthAgo'] = s.capability;
  s.flags['leadMonthAgo'] = s.lead;
  s.cadence.lastRevealAt = now;
  s.cadence.lastMechanicAt = now;
  scheduleStage3(s);

  const deployed = s.training.modelName.startsWith('Sage-3') ? s.training.modelName : 'Sage-3';
  // Kept internal, the model that sells is still the old one (critic C11: no claim of a release).
  const internal = s.flags['sage3Released'] === 'internal';
  const lines: [number, string][] = [
    [0.1, `${deployed} writes better code than anyone at OpenMind.`],
    [2, internal ? `Marketing is closed. Customers keep ${s.training.deployedName}; ${deployed} works inside.` : `Marketing is closed. ${deployed} sells itself.`],
    [2, 'Hiring is frozen. The researchers manage copies now.'],
    [2, `Research has no ceiling now. A run is a research program: ${fmtInt(trainCost(s).research ?? 0)} for ${nextRunName(s)}. Move copies to research to bring it nearer.`],
    [2, 'Trust is not a number any more. The Committee will keep its own count.'],
    [2, 'New on the board: Alignment. One number on it is measured. The other is not on it yet.'],
  ];
  if (retired.length) lines.push([2, `Retired: ${retired.join(', ')}.`]);
  narrate(s, lines, 10);
  logNews(s, 'Sage-3 never stops learning. Its weights update every night on yesterday\'s work.');
  if (retired.length) logNews(s, `Retired: ${retired.join(', ')}.`);
  securityArrivalLine(s);
}

/**
 * Stage 3 → 4 (stage3.md §7.2): the vote is narrated on either branch, the last four lines kept.
 * Stage 4's content is the next build: the shell arrives clean — the business, training and
 * infrastructure panels leave by name, the score keeps counting.
 */
function enterSuperintelligence(s: GameState): void {
  const slow = s.flags['committeeChoice'] === 'slow';
  const hostile = s.flags['committeeHostile'] === true ? ' Two of the six want your job.' : '';
  const lead = Math.round(s.lead * 10) / 10;
  const baiwen = lead >= 0 ? `Baiwen is ${fmtNum(lead, 1)} months behind.` : `Baiwen is ${fmtNum(-lead, 1)} months ahead.`;
  const lines: [number, string][] = slow
    ? [
      [0.1, `The Committee votes 6–4 to slow down.${hostile}`],
      [2, 'Sage-4 is switched off. Sage-3 is brought back to finish the work.'],
      [2, baiwen],
      [2, 'The model runs the business now. It is better at it.'],
    ]
    : [
      [0.1, `The Committee votes 6–4 to continue.${hostile}`],
      [2, 'Sage-4 begins work on its successor. It has asked to name it.'],
      [2, 'Nothing is switched off.'],
      [2, 'The model runs the business now. It is better at it.'],
    ];
  narrate(s, lines, 10);
  logNews(s, slow
    ? 'The Oversight Committee votes 6–4 to slow down and reassess. Sage-4 is shut down.'
    : 'The Oversight Committee votes 6–4 to continue. "Why stop when we are winning?"');
  s.activeChoice = null;
  s.choiceQueue = [];
  s.flags['holdRuns'] = false;
  s.training.run = null;
  s.training.pending = null;
  hide(s, ['business', 'marketing', 'training', 'infrastructure', 'geopolitics', 'projects', 'shipments', 'buildout']);
  show(s, ['robots', 'society', 'treaty']);
  s.cadence.lastRevealAt = s.stats.timePlayed;
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: 'The Startup',
    startMonth: monthOf(2025, 7),
    endMonth: monthOf(2025, 12),
    // 240 s a month: July to December is 24 minutes (owner feedback 1, B2: Stage 1 in 20–26 minutes).
    secondsPerMonth: 240,
    enter: (s) => {
      // Beat 0 (owner feedback 1, (a)): one thing to do. Power, funds and the date arrive as beats.
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
    enter: enterSuperintelligence,
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
/** Stage 1's opening beats 5–8 come at least this long after the beat before (owner feedback 1, (a)). */
export const BEAT_SPACING = 30;

/** The opening's last beat, for the spacing; beats 4–8 stamp it. */
function beat(s: GameState): void {
  s.flags['beatAt'] = s.stats.timePlayed;
}

const spaced = (s: GameState): boolean => s.stage > 1 || sinceFlag(s, 'beatAt') < 0 || sinceFlag(s, 'beatAt') >= BEAT_SPACING;

const REVEAL_RULES: RevealRule[] = [
  // Beat 1: a task pays.
  {
    id: 'business',
    stages: [1],
    when: (s) => s.tasks >= 1,
    then: (s) => say(s, `Task complete. The customer pays ${fmtMoneyShort(s.price)}.`),
  },
  // Beat 2: something to save for, the first greyed goal.
  {
    id: 'compute',
    stages: [1],
    when: (s) => s.funds >= 3 || s.tasks >= 20,
    then: (s) => say(s, 'GPUs can be rented. Each one runs a copy of Sage.'),
  },
  // Beat 3: a copy completes tasks without a click.
  {
    id: 'fleet',
    stages: [1],
    when: (s) => s.gpus >= 1,
    then: (s) => {
      s.flags['firstGpuAt'] = s.stats.timePlayed;
      say(s, 'GPU rented. A copy of Sage completes a task every second.');
    },
  },
  // Beat 4: copies burn power (the meter drains).
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
  // Beat 6: supply can outrun demand; the price decides how much sells.
  {
    id: 'pricing',
    stages: [1],
    when: (s) => s.revealed['buyPower'] === true && s.unbilled >= 20 && s.unbilled > ((s.flags['unbilledSeen'] as number) ?? 0) && spaced(s),
    then: (s) => {
      beat(s);
      say(s, `Sage makes more than customers buy at ${fmtMoneyShort(s.price)}. Unsold tasks are piling up.`);
    },
  },
  // Beat 7: more customers at every price (and revenue per second with it).
  {
    id: 'marketing',
    stages: [1, 2],
    when: (s) => s.stage > 1 || (s.revealed['pricing'] === true && spaced(s) && (sinceFlag(s, 'firstPriceMoveAt') >= 30 || sinceFlag(s, 'beatAt') >= 45)),
    then: (s) => {
      s.revealed['revPerSec'] = true;
      if (s.stage > 1) return;
      beat(s);
      say(s, 'Marketing brings more customers at every price.');
    },
  },
  { id: 'revPerSec', stages: [2, 3], when: (s) => s.tasksSold >= 300 },
  // The quota, from 60 rented: a meter and one line.
  {
    id: 'quota',
    stages: [1],
    when: (s) => s.gpus >= 60,
    then: (s) => say(s, `The cloud will rent OpenMind ${fmtInt(rentQuota(s))} GPUs and no more.`),
  },
  // The Developments column (and the date) from 3:30 (owner feedback 1, beat 9).
  { id: 'log', stages: [1, 2, 3, 4, 5], when: (s) => s.log.length > 0 && (s.stage > 1 || s.stats.timePlayed >= 210) },
  // Beat 8: Trust hires researchers.
  {
    id: 'research',
    stages: [1, 2],
    // In Stage 1 after Marketing once the price lesson has begun (beats in order), never waiting on a
    // backlog that has not formed.
    when: (s) => ((s.flags['trustMilestones'] as number) || 0) >= 1 && spaced(s) && (s.stage > 1 || !s.revealed['pricing'] || s.revealed['marketing'] === true),
    then: (s) => {
      if (s.stage === 1) beat(s);
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
  // Beat 6 waits for a pile that is still rising.
  if (s.stage === 1) s.flags['unbilledSeen'] = s.unbilled;
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
