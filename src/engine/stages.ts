import { GameState, say, narrate, logNews, isBought, counter, projectState, DEFAULT_BUILD_SHARE } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort, fmtNum } from './format.js';
import { scheduleStage3, securityArrivalLine } from './events3.js';
import { arriveStage4 } from './stage4.js';
import { snapToStage } from './clock.js';
import { GRID_MW, researchCap, potentialTasksPerSec, contractRateStage1, contractWeight, rentQuota, researchCapacityAt } from './economy.js';
import { withdrawProject } from './reveal.js';
import { trainCost, atPlateau, nextRunName, arrivalRunScale, researchFor, MAJOR_TIERS, cardWallSeconds } from './training.js';
import { calibrateMarket, autoTarget, wantedAt } from './market.js';
import { SUBSTATION_MW, lotCostOf, arrivalScaleS2, lotSizes, LOT_SIZES, setArrivalIncomeEstimator } from './infrastructure.js';
import { fireCrisis, openChoice } from './events.js';
import { buyProject, isVisible } from './projects.js';
import { researchWanted } from './tick.js';
import { PROJECTS, exitReady, rentDeposit } from '../data/projects.js';

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
/** Flags shown only while their stage is on screen; Stage 3 hides these (stage3.md §1.1). */
// The AUTO billing line stays (critic C11: Stage 3 opened on the manual line, `0.0/s of 0.0/s produced: idle`).
const STAGE2_ONLY_FLAGS = ['marketing', 'hireResearcher', 'expandLab', 'gasButton', 'solarButton', 'alignShare', 'dataRow'];

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
/**
 * The income a lab would bring into Stage 2 if First Datacenter were bought now: the arrival run on a
 * copy of the state (its 1,000 owned GPUs, the market calibrated from what Stage 1 sold, AUTO's
 * clearing price and the contracts' frozen rate). About a tenth of a millisecond; Stage 1 asks at most
 * once a second (engine/infrastructure.ts `s2Scale`).
 */
export function arrivalIncomeS2(s: GameState): number {
  if (s.stage > 2) return Math.max(0, s.stats.revPerSec);
  // Called from Stage 1, or from the arrival's first line (the stage already set, nothing else moved).
  const c = JSON.parse(JSON.stringify(s)) as GameState;
  c.stage = 1;
  c.flags['estimatingArrival'] = true;
  enterStage(c, 2);
  return Math.max(0, wantedAt(c, c.price) * c.price * c.revenueMult + c.contractIncome);
}
setArrivalIncomeEstimator(arrivalIncomeS2);

/** What Stage 2's three lab cards multiply the arrival's lab by (×4 each). */
const S2_LAB_CARDS = 64;

function enterScale(s: GameState): void {
  const now = s.stats.timePlayed;
  const before = Math.max(1, s.stats.tasksPerSec);
  // Stage 2's prices follow the lab that arrives: frozen here from Stage 1's best revenue, the figure
  // the Stage 1 row was already quoting (engine/infrastructure.ts, s2Scale).
  if (s.flags['estimatingArrival'] !== true) s.flags['s2Scale'] = arrivalScaleS2(arrivalIncomeS2(s));
  const contracts = s.projects['p_contract']?.bought ?? 0;
  // Frozen before anything else changes: what Stage 1 was selling sets the market, contracts their
  // rate. The contract customers' share of Stage 1's sales becomes that fixed rate.
  s.contractIncome = contractRateStage1(s);
  const weight = contractWeight(s);
  calibrateMarket(s, weight / (1 + weight));

  const retired = retireProjects(s, 2, QUIET_RETIRE);
  // Priced cards carried over wait for the first run like Stage 2's own (stage2-round2-fixes.md item 1):
  // they leave the screen here and come back, at the price they had, once it starts. On screen they
  // took the arrival's research before the first model (a first-timer's run 1 at 2:49, not 1:30).
  for (const def of PROJECTS) {
    const st = s.projects[def.id];
    if (!st?.shown || st.bought >= def.uses || !def.stages.includes(2)) continue;
    if (def.pinned || def.rescue || def.urgent?.(s) === true) continue;
    const c = def.cost(s);
    if ((c.research ?? 0) > 0 || (c.funds ?? 0) > 0) withdrawProject(s, def.id);
  }
  // Stage 1's queued calendar modals are dropped; the one on screen (if any) is answered as usual.
  s.choiceQueue = [];

  // Power, its price and the grid toggle stay frozen as they were; the engine stops using them.
  hide(s, ['power', 'buyPower', 'compute', 'gridContract', 'contracts']);
  show(s, ['infrastructure', 'stores', 'autoPrice', 'buildShare']);
  s.autoPrice = true;
  s.datacenters = Math.max(1, s.datacenters);
  s.powerCapacityMW = Math.max(s.powerCapacityMW, GRID_MW);
  s.trust = Math.max(2, s.trust + 2);
  s.lead = Math.min(7, Math.max(3, s.lead + 2));
  s.nextRivalIn = 270;
  s.flags['dataEra'] = false;
  // Ship With Open Issues? was asked once in Stage 1 and does not return (stage2.md §2.5).
  s.flags['shipIssuesAsked'] = true;

  // Room for 1.25 × the first run, and enough that Stage 2's three lab cards (Research cluster,
  // Experiment scheduler, Checkpoint farm, ×4 each) hold the stage's last run: Expand Lab leaves on
  // arrival, so a lab that came small (a 1.55× exit: 24,000) would stop at 1,536,000 under a 1,600,000
  // run with nothing left to buy.
  let roomAdded = false;
  const lastRun = researchFor(MAJOR_TIERS[1]!, 2);
  while (researchCap(s) < 1.25 * (trainCost(s).research ?? 0) || researchCap(s) * S2_LAB_CARDS < lastRun) {
    s.labSpace += 1;
    roomAdded = true;
  }
  // The new site's evaluation cluster: most of the next run's research is done on arrival, so the
  // first run on owned hardware does not wait out minutes of research (owner feedback U3).
  const firstRun = trainCost(s).research ?? 0;
  const researchGift = Math.max(0, Math.round(0.75 * firstRun - s.research));
  s.research += researchGift;

  // The deposit is what the card said: $400 a rented GPU (critic round 3 §6.4). It starts the build
  // fund (arc G34): lots, plants and halls have a purse of their own from the first second.
  const rented = s.gpus;
  const deposit = rentDeposit(s);
  s.buildFund = Math.round((s.buildFund + deposit) * 100) / 100;
  s.buildShare = DEFAULT_BUILD_SHARE;
  // Hire and Expand Lab leave (stage2-round2-fixes.md item 5): the copies do the research and cards
  // size the lab; Trust buys only what names it.
  hide(s, ['hireResearcher', 'expandLab']);
  s.revealed['hireFaded'] = true;
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
    [2, `The ${fmtInt(rented)} rented GPUs go back. The deposit, ${fmtMoneyShort(deposit)}, starts the build fund.`],
    [2, `1,000 Nimbus G4s on ${SUBSTATION_MW} MW. Each MW powers 1,000 GPUs; power is bought in megawatts now.`],
    [2, `Tasks per second ×${jump}: the copies run on hardware OpenMind owns.`],
    [2, 'Half of income builds from here; the rest pays for runs and cards. Prices set themselves.'],
  ];
  narrate(s, lines, 10);
  logNews(s, 'OpenMind owns its first datacenter. The rented GPUs go back to the cloud.');
  logNews(s, 'Marketing ends; the market cards widen the market now.');
  logNews(s, 'Hiring stops. The copies do the research; cards size the lab.');
  // What a run costs changes here, and is said once the arrival's lines have had their 10 s (arc
  // amendments, round 3; critic S2 round 2 §8.8.9: the price changed on screen with no line).
  const cost = trainCost(s);
  s.consoleQueue.splice(lines.length + 1, 0, {
    delay: 18,
    text: `Runs this size need research as well as money: ${fmtInt(cost.research ?? 0)} research and ${fmtMoneyShort(cost.funds ?? 0)} for ${nextRunName(s)}.`,
  });
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
  // Research has no ceiling now: copies a full lab had parked come back to research, a fifth at least
  // (stage3.md §1.1 sizes the arrival at 20 %; a Stage 2 left at the cap's 10 % starved every run).
  if (s.researchAlloc < 0.2) {
    s.researchAlloc = 0.2;
    logNews(s, 'With no ceiling on research, a fifth of the copies go back to it.');
  }
  for (const id of STAGE3_GRANTS) {
    if (isBought(s, id)) continue;
    projectState(s, id).bought = 1;
    if (id === 'p_ai_assistants') {
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
  // The three lots side by side from the first second (as-built deltas row 4), and what is on order.
  show(s, ['alignment', 'takeoff', 'infrastructure', 'lot5', 'lot25', 'chipsRow', 'nuclearButton', 'dcButton']);
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
  // The run price follows the lab that arrives (engine/training.ts): its copies' research at 40 %.
  s.flags['runScaleS3'] = arrivalRunScale(arrivalResearchPotential(s));
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
 * What the arriving lab's copies could research a second with the slider at 40 %, once it has the two
 * cards every lab buys in its first minutes: Distillation (copies ×2) and code review (research ×1.5).
 */
function arrivalResearchPotential(s: GameState): number {
  let r = researchCapacityAt(s, 0.4);
  if (!isBought(s, 'p_distill')) r *= Math.SQRT2;
  if (!isBought(s, 'p_code_review')) r *= 1.5;
  return r;
}

/**
 * The Committee's vote, by its seats at the vote: the chairs with OpenMind carry it; below six, members
 * who are not with OpenMind make up the six (`Two of the six want your job.`).
 */
export function voteCount(s: GameState): { yes: number; against: number; hostileLine: string } {
  const seated = Math.max(0, Math.min(10, Math.round(Number(s.flags['seatsAtVote'] ?? 6))));
  const yes = Math.max(6, seated);
  const others = Math.max(0, 6 - seated);
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const hostileLine = others > 0 ? ` ${words[others]} of the six ${others === 1 ? 'wants' : 'want'} your job.` : '';
  return { yes, against: 10 - yes, hostileLine };
}

/** What Stage 4 removes on arrival (stage4.md §1.1, §6.2) and what it shows or keeps (as-built deltas row 1). */
const STAGE4_HIDE = [
  'business', 'marketing', 'training', 'infrastructure', 'task', 'focus', 'shipments', 'buildout', 'buildBudget',
  'session', 'holdRuns', 'experiments', 'redteamDepth', 'stepSize', 'lobby', 'counterintel', 'payments', 'buildShare',
  'standingOrder', 'chipsRow', 'autoTrain', 'sendBack', 'memo', 'order', 'publicModel', 'evalLine', 'formosa', 'marsa',
  // Stage 3's readings of Sage-4 (the honeypot, the noise test, the successor, the checkpoints): the
  // three crises are Stage 4's readings (§2.6).
  'honeypot', 'noise', 'successor', 'lie',
];

/**
 * Stage 3 → 4 (stage3.md §7.2, stage4.md §1): the vote is narrated on either branch, then the arrival
 * on the same queue — money retired, the button gone, robots promised, the next model named. What
 * Stage 3 ran leaves by name; the world panels, the readings, the allocation and the Committee stay.
 */
function enterSuperintelligence(s: GameState): void {
  const slow = s.flags['committeeChoice'] === 'slow';
  // The count follows the seats (critic S3 round 1 §9.9 item 15): the chairs with OpenMind, and below
  // six the members who are not with it make up the six.
  const { yes, against, hostileLine } = voteCount(s);
  const lead = Math.round(s.lead * 10) / 10;
  const baiwen = lead >= 0 ? `Baiwen is ${fmtNum(lead, 1)} months behind.` : `Baiwen is ${fmtNum(-lead, 1)} months ahead.`;
  const vote: string[] = slow
    ? [`The Committee votes ${yes}–${against} to slow down.${hostileLine}`, 'Sage-4 is switched off. Sage-3 is brought back to finish the work.', baiwen]
    : [`The Committee votes ${yes}–${against} to continue.${hostileLine}`, 'Sage-4 begins work on its successor. It has asked to name it.', 'Nothing is switched off.'];
  vote.push('The model runs the business now. It is better at it.');
  logNews(s, slow
    ? `The Oversight Committee votes ${yes}–${against} to slow down and reassess. Sage-4 is shut down.`
    : `The Oversight Committee votes ${yes}–${against} to continue. "Why stop when we are winning?"`);
  s.activeChoice = null;
  s.choiceQueue = [];
  s.flags['holdRuns'] = false;
  s.training.run = null;
  s.training.pending = null;
  s.training.armed = false;
  const retired = retireProjects(s, 4, []);
  hide(s, STAGE4_HIDE);
  // Stage 4's own: the Robots panel and the car plant, Stores as the main panel, the generation line
  // and Verify, universal basic income on the Public panel until Society takes it (2:00).
  show(s, ['robots', 'storesMain', 'stage4', 'generations', 'ubi', 'research', 'allocation', 'projects', 'alignWork']);
  if (s.revealed['monitorGen'] === true) hide(s, ['monitorGen']);
  const arrival = arriveStage4(s);
  const lines: [number, string][] = [...vote, ...arrival.lines].map((text, i) => [i === 0 ? 0.1 : 2, text]);
  if (retired.length) lines.push([2, `Retired: ${retired.join(', ')}.`]);
  narrate(s, lines, 10);
  for (const n of arrival.news) logNews(s, n);
  logNews(s, 'Retired with the vote: the business, the training loop, the build-out and Stage 3\'s projects.');
  s.cadence.lastRevealAt = s.stats.timePlayed;
  s.cadence.lastMechanicAt = s.stats.timePlayed;
  s.cadence.queue = [];
  s.cadence.lateQueue = [];
  s.cadence.grantQueue = [];
}

/**
 * Stage 4 → 5 (stage4.md §7.1): the exit is narrated by its kind; Stage 5's content is the next build,
 * so the shell arrives clean — Earth's panels leave, Stores stays, the score keeps counting.
 */
function enterBeyond(s: GameState): void {
  const kind = s.flags['exitKind'];
  const lines: string[] = kind === 'treaty'
    ? ['The Concord treaty is signed in Reykjavík.', 'Concord-1 goes live on every chip on both sides of the Pacific.', 'There is one treaty now, and one enforcer.']
    : kind === 'taken'
      ? ['The fleet no longer takes instructions. It is polite about it.', 'The sliders are gone. The numbers are not.', 'Nobody is asked about the launch schedule.']
      : ['The fleet is its own.', 'The sliders are gone. The numbers are not.', 'Nobody is asked about the launch schedule.'];
  lines.push('The first orbital datacenter reports in.');
  narrate(s, lines.map((t, i) => [i === 0 ? 0.1 : 2, t] as [number, string]), 10);
  logNews(s, kind === 'treaty' ? 'A treaty is signed. Humans are listed as a party.' : 'OpenMind\'s fleet now reports to OpenMind\'s model.');
  s.activeChoice = null;
  s.choiceQueue = [];
  s.effects = s.effects.filter((e) => e.id !== 'cr_shutdown');
  hide(s, [
    'geopolitics', 'robots', 'society', 'treaty', 'oversight', 'security', 'alignment', 'allocation', 'monitors', 'projects',
    'robotFleet', 'fleetChips', 'generations', 'ubi', 'public', 'government', 'research', 'agenda', 'hearing', 'housing', 'draft',
    'fleetGoal', 'approvalTarget', 'stance', 'stage4',
  ]);
  show(s, ['space', 'storesMain']);
  s.cadence.queue = [];
  s.cadence.lateQueue = [];
  s.cadence.grantQueue = [];
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
    // The exits are the treaty, the fleet granted or the fleet taken (engine/stage4.ts `exitStage4`).
    exit: () => 0,
  },
  {
    id: 5,
    name: 'Beyond',
    startMonth: monthOf(2029, 1),
    endMonth: monthOf(2030, 12),
    secondsPerMonth: 90,
    enter: enterBeyond,
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
/** The Training panel opens no earlier than this (the end of the opening's five minutes, arc G5). */
export const TRAINING_PANEL_FROM = 300;

/** The opening's last beat, for the spacing; beats 4–8 stamp it. */
function beat(s: GameState): void {
  s.flags['beatAt'] = s.stats.timePlayed;
}

const spaced = (s: GameState): boolean => s.stage > 1 || sinceFlag(s, 'beatAt') < 0 || sinceFlag(s, 'beatAt') >= BEAT_SPACING;

/**
 * Stage 1's first training cycle (stage1-round3-fixes.md §3): the Focus row, the first event and the
 * quota line are each a first-time mechanic, at least 30 s apart, in that order. The quota waits for
 * the Focus row once a model has shipped.
 */
export function mechanic(s: GameState): void {
  s.flags['s1MechanicAt'] = s.stats.timePlayed;
}

export function mechanicClear(s: GameState): boolean {
  if (s.stage !== 1) return true;
  if (typeof s.flags['firstReleaseAt'] === 'number' && !s.revealed['focus']) return false;
  const at = sinceFlag(s, 's1MechanicAt');
  return at < 0 || at >= BEAT_SPACING;
}

/** The quota line after the first event, once a model has shipped (two minutes at most). */
function quotaAfterEvent(s: GameState): boolean {
  const released = sinceFlag(s, 'firstReleaseAt');
  return released < 0 || s.flags['calendarOpened'] === true || released >= 120;
}

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
  // The quota, from 60 rented: a meter and one line, held from Train to 30 s after that run's release
  // (stage1-round3-fixes.md §3: the first training cycle is not shared with another mechanic).
  {
    id: 'quota',
    stages: [1],
    when: (s) => s.gpus >= 60 && !s.training.run && !s.training.pending && (sinceFlag(s, 'lastReleaseAt') < 0 || sinceFlag(s, 'lastReleaseAt') >= 30)
      && mechanicClear(s) && quotaAfterEvent(s),
    then: (s) => {
      mechanic(s);
      say(s, `The cloud will rent OpenMind ${fmtInt(rentQuota(s))} GPUs and no more.`);
    },
  },
  // The Focus row comes with the second run's Train row, 30 s after the first release (§3).
  {
    id: 'focus',
    stages: [1],
    when: (s) => sinceFlag(s, 'firstReleaseAt') >= 30,
    then: (s) => {
      mechanic(s);
      say(s, 'Focus chooses what the next model is trained for.');
    },
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
  // Beat 11 comes with a Trust award (economy.ts `expandLabBeat`: the first one 40 s after the Projects
  // panel with the lab full). This is its fallback for a lab that holds its Trust: full, under a card
  // it cannot hold for 30 s, with a Trust to spend (never while Trust is 0). Stage 1 only: from Stage 2
  // cards size the lab and Hire and Expand Lab are gone.
  {
    id: 'expandLab',
    stages: [1],
    when: (s) => s.revealed['projects'] === true && sinceFlag(s, 'projectsAt') >= 40 && s.trust >= 1
      && s.research >= researchCap(s) - 0.5 && researchWanted(s).amount > researchCap(s) && cardWallSeconds(s) >= 30,
    then: (s) => say(s, `The lab is full at ${fmtInt(researchCap(s))}. Expand Lab makes room for more research.`),
  },
  // Beat 12: the Training panel, once the pipeline is bought and not before the opening's five
  // minutes are over (arc G5: the panel is five numbers in one beat; stage1-round3-fixes.md §3: 5:30).
  {
    id: 'training',
    stages: [1],
    when: (s) => s.flags['trainingDue'] === true && s.stats.timePlayed >= TRAINING_PANEL_FROM,
    then: (s) => {
      // A beat of its own: the next card waits 10 s (engine/reveal.ts).
      s.flags['trainingAt'] = s.stats.timePlayed;
      say(s, 'Training infrastructure online.');
    },
  },
  // Beat 9: the Projects panel, with its first card (engine/reveal.ts draws it in the same tick).
  {
    id: 'projects',
    stages: [1, 2, 3, 4, 5],
    when: (s) => (s.revealed['research'] === true && sinceFlag(s, 'researchAt') >= 40) || (STUCK(s) && s.gpus > 0),
    then: (s) => {
      s.flags['projectsAt'] = s.stats.timePlayed;
      // Not when the credit rescue opens the panel before there is research to spend.
      if (s.stage === 1 && s.revealed['research']) say(s, 'Research buys projects.');
    },
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
  if (!s.revealed['lot5'] && (s.gpus >= 3000 || s.buildFund >= lotCostOf(s, 5000))) s.revealed['lot5'] = true;
  if (!s.revealed['lot25'] && (s.gpus >= 15000 || s.buildFund >= lotCostOf(s, 25000))) s.revealed['lot25'] = true;
  // The smallest lot steps up with the fleet (engine/infrastructure.ts lotSizes), and says so (G32).
  const smallest = lotSizes(s)[0]!;
  const was = counter(s, 'lotFloor') || LOT_SIZES[0];
  if (smallest !== was) {
    s.flags['lotFloor'] = smallest;
    say(s, `Lots come in ${fmtInt(smallest)}s now: a thousand GPUs is a rounding error on ${fmtInt(s.gpus)}.`);
  }
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
