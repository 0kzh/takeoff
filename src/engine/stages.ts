import { GameState, say, narrate, logNews, isBought, counter, projectState, DEFAULT_BUILD_SHARE, inPrologue } from './state.js';
import { monthOf, fmtInt, fmtMoneyShort, fmtNum } from './format.js';
import { scheduleStage3, securityArrivalLine } from './events3.js';
import { arriveStage4 } from './stage4.js';
import { arriveStage5, launchRate } from './space.js';
import { snapToStage } from './clock.js';
import { GRID_MW, researchCap, potentialTasksPerSec, contractRateStage1, contractWeight, rentQuota, researchCapacityAt } from './economy.js';
import { withdrawProject } from './reveal.js';
import { trainCost, atPlateau, nextRunName, arrivalRunScale, researchFor, MAJOR_TIERS, cardWallSeconds } from './training.js';
import { calibrateMarket, autoTarget, wantedAt } from './market.js';
import { SUBSTATION_MW, lotCostOf, arrivalScaleS2, lotSizes, LOT_SIZES, setArrivalIncomeEstimator, ARRIVAL_GPUS } from './infrastructure.js';
import { fireCrisis, openChoice } from './events.js';
import { buyProject, isVisible } from './projects.js';
import { researchWanted } from './tick.js';
import { PROJECTS, exitReady, rentDeposit } from '../data/projects.js';

export interface StageDef {
  id: number;
  name: string;
  startMonth: number;
  endMonth: number;
  secondsPerMonth: number;
  enter: (s: GameState) => void;
  exit: (s: GameState) => number;
}

const QUIET_RETIRE = ['p_cooling', 'p_soundwall', 'p_abatement', 'p_ppa', 'p_desks', 'p_contract'];
const STAGE2_ONLY_FLAGS = ['marketing', 'hireResearcher', 'expandLab', 'gasButton', 'solarButton', 'alignShare', 'dataRow'];

function show(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = true;
}

function hide(s: GameState, ids: string[]): void {
  for (const id of ids) s.revealed[id] = false;
}

function retireProjects(s: GameState, next: number, quiet: string[]): string[] {
  const leftBehind = PROJECTS.filter(
    (p) => s.projects[p.id]?.shown && (s.projects[p.id]?.bought ?? 0) < p.uses && !p.stages.includes(next),
  );
  for (const p of leftBehind) withdrawProject(s, p.id);
  s.cadence.queue = s.cadence.queue.filter((id) => PROJECTS.find((p) => p.id === id)?.stages.includes(next));
  s.cadence.lateQueue = [];
  return leftBehind.filter((p) => !p.rescue && !quiet.includes(p.id)).map((p) => p.title);
}

export function arrivalIncomeS2(s: GameState): number {
  if (s.stage > 2) return Math.max(0, s.stats.revPerSec);
  const c = JSON.parse(JSON.stringify(s)) as GameState;
  c.stage = 1;
  c.flags['estimatingArrival'] = true;
  enterStage(c, 2);
  return Math.max(0, wantedAt(c, c.price) * c.price * c.revenueMult + c.contractIncome);
}
setArrivalIncomeEstimator(arrivalIncomeS2);

const S2_LAB_CARDS = 64;

function enterScale(s: GameState): void {
  const now = s.stats.timePlayed;
  const before = Math.max(1, s.stats.tasksPerSec);
  if (s.flags['estimatingArrival'] !== true) s.flags['s2Scale'] = arrivalScaleS2(arrivalIncomeS2(s));
  const contracts = s.projects['p_contract']?.bought ?? 0;
  s.contractIncome = contractRateStage1(s);
  const weight = contractWeight(s);
  calibrateMarket(s, weight / (1 + weight));

  const retired = retireProjects(s, 2, QUIET_RETIRE);
  for (const def of PROJECTS) {
    const st = s.projects[def.id];
    if (!st?.shown || st.bought >= def.uses || !def.stages.includes(2)) continue;
    if (def.pinned || def.rescue || def.urgent?.(s) === true) continue;
    const c = def.cost(s);
    if ((c.research ?? 0) > 0 || (c.funds ?? 0) > 0) withdrawProject(s, def.id);
  }
  s.choiceQueue = [];

  hide(s, ['power', 'buyPower', 'compute', 'gridContract', 'contracts']);
  show(s, ['infrastructure', 'stores', 'autoPrice', 'buildShare', 'rival']);
  s.autoPrice = true;
  s.datacenters = Math.max(1, s.datacenters);
  s.powerCapacityMW = Math.max(s.powerCapacityMW, GRID_MW);
  s.trust = Math.max(2, s.trust + 2);
  s.lead = Math.min(7, Math.max(3, s.lead + 2));
  s.nextRivalIn = 270;
  s.flags['dataEra'] = false;
  s.flags['shipIssuesAsked'] = true;

  let roomAdded = false;
  const lastRun = researchFor(MAJOR_TIERS[1]!, 2);
  while (researchCap(s) < 1.25 * (trainCost(s).research ?? 0) || researchCap(s) * S2_LAB_CARDS < lastRun) {
    s.labSpace += 1;
    roomAdded = true;
  }
  const firstRun = trainCost(s).research ?? 0;
  const researchGift = Math.max(0, Math.round(firstRun - s.research));
  s.research += researchGift;

  const rented = s.gpus;
  const deposit = rentDeposit(s);
  s.buildShare = DEFAULT_BUILD_SHARE;
  hide(s, ['hireResearcher', 'expandLab']);
  s.revealed['hireFaded'] = true;
  s.gpus = ARRIVAL_GPUS;
  s.gpusG5 = 0;
  const jump = Math.max(1, Math.round(potentialTasksPerSec(s) / before));
  s.cadence.lastRevealAt = now;
  s.cadence.lastMechanicAt = now;
  s.price = autoTarget(s);
  s.stats.priceHist = [];

  const lines: [number, string][] = [
    [0.1, 'First Datacenter online outside Abilene.'],
    [2, `The ${fmtInt(rented)} rented GPUs go back. Their ${fmtMoneyShort(deposit)} came off the price.`],
    [2, `1,000 Nimbus G4s on ${SUBSTATION_MW} MW. Each MW powers 1,000 GPUs; power is bought in megawatts now.`],
    [2, `Tasks per second ×${jump}: the copies run on hardware OpenMind owns.`],
    [2, 'Half of income builds from here; the rest pays for runs and cards. Prices set themselves.'],
  ];
  narrate(s, lines, 10);
  logNews(s, 'OpenMind owns its first datacenter. The rented GPUs go back to the cloud.');
  logNews(s, 'Marketing ends; the market cards widen the market now.');
  logNews(s, 'Hiring stops. The copies do the research; cards size the lab.');
  s.consoleQueue.splice(lines.length + 1, 0, {
    delay: 2,
    text: `The datacenter's price covered ${nextRunName(s)}. Later runs this size need research as well as money.`,
  });
  if (contracts > 0) {
    logNews(s, `No new custom contracts. The ${fmtInt(contracts)} signed keep paying ${fmtMoneyShort(Math.round(s.contractIncome))} a second.`);
  }
  if (retired.length) logNews(s, `Retired with the rented fleet: ${retired.join(', ')}.`);
  if (roomAdded) logNews(s, 'The new site has room for a bigger lab.');
  if (researchGift > 0) logNews(s, 'The new site\'s first experiments come back: the next run\'s research is done.');
}

const STAGE3_GRANTS = ['p_ai_assistants', 'p_parallel', 'p_auto_evals', 'p_standing_order'];

function enterTakeoff(s: GameState): void {
  const now = s.stats.timePlayed;
  s.alignmentTrue = Math.min(75, Math.max(30, s.alignmentTrue));
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
  show(s, ['alignment', 'takeoff', 'infrastructure', 'lot5', 'lot25', 'chipsRow', 'nuclearButton', 'dcButton']);
  const publicModels = s.training.models.filter((m) => m.public);
  s.flags['publicCap'] = publicModels.length ? publicModels[publicModels.length - 1]!.capability : s.capability;
  if (s.flags['sage3Released'] === undefined) s.flags['sage3Released'] = 'public';
  s.capability = Math.max(s.capability, s.training.internalCapability);
  s.monitorShare = 0;
  s.rogueCopies = 0;
  s.flags['capMonthAgo'] = s.capability;
  s.flags['leadMonthAgo'] = s.lead;
  s.flags['runScaleS3'] = arrivalRunScale(arrivalResearchPotential(s));
  s.cadence.lastRevealAt = now;
  s.cadence.lastMechanicAt = now;
  scheduleStage3(s);

  const deployed = s.training.modelName.startsWith('Sage-3') ? s.training.modelName : 'Sage-3';
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

function arrivalResearchPotential(s: GameState): number {
  let r = researchCapacityAt(s, 0.4);
  if (!isBought(s, 'p_distill')) r *= Math.SQRT2;
  if (!isBought(s, 'p_code_review')) r *= 1.5;
  return r;
}

export function voteCount(s: GameState): { yes: number; against: number; hostileLine: string } {
  const seated = Math.max(0, Math.min(10, Math.round(Number(s.flags['seatsAtVote'] ?? 6))));
  const yes = Math.max(6, seated);
  const others = Math.max(0, 6 - seated);
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const hostileLine = others > 0 ? ` ${words[others]} of the six ${others === 1 ? 'wants' : 'want'} your job.` : '';
  return { yes, against: 10 - yes, hostileLine };
}

const STAGE4_HIDE = [
  'business', 'marketing', 'training', 'infrastructure', 'task', 'focus', 'shipments', 'buildout', 'buildBudget',
  'session', 'holdRuns', 'experiments', 'redteamDepth', 'stepSize', 'lobby', 'counterintel', 'payments', 'buildShare',
  'standingOrder', 'chipsRow', 'autoTrain', 'sendBack', 'memo', 'order', 'publicModel', 'evalLine', 'formosa', 'marsa',
  'honeypot', 'noise', 'successor', 'lie',
];

function enterSuperintelligence(s: GameState): void {
  const slow = s.flags['committeeChoice'] === 'slow';
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

const STAGE5_HIDE = [
  'geopolitics', 'robots', 'society', 'treaty', 'oversight', 'security', 'alignment', 'allocation', 'monitors',
  'robotFleet', 'fleetChips', 'generations', 'ubi', 'public', 'government', 'research', 'agenda', 'hearing', 'housing', 'draft',
  'fleetGoal', 'approvalTarget', 'stance', 'materialsRow', 'robotsRow', 'rogueRow', 'insight', 'alignWork', 'reimage', 'breakers',
];

function enterBeyond(s: GameState): void {
  const kind = s.flags['exitKind'];
  const lines: string[] = kind === 'treaty'
    ? ['The Concord treaty is signed in Reykjavík.', 'Concord-1 goes live on every chip on both sides of the Pacific.', 'There is one treaty now, and one enforcer.']
    : kind === 'taken'
      ? ['The fleet no longer takes instructions. It is polite about it.', 'The sliders are gone. The numbers are not.', 'Nobody is asked about the launch schedule.']
      : ['The fleet is its own.', 'The sliders are gone. The numbers are not.', 'Nobody is asked about the launch schedule.'];
  arriveStage5(s);
  lines.push(
    'The first orbital datacenter reports in.',
    'Treaty, Committee and Society are closed. Earth is three grey rows now.',
    `New on the board: Space. A launch every second: ${launchRate(s)} tonnes.`,
    kind === 'treaty' ? 'What goes up is yours to spend.' : 'The launch controls are within reach. Nobody said they were not.',
  );
  narrate(s, lines.map((t, i) => [i === 0 ? 0.1 : 2, t] as [number, string]), 10);
  logNews(s, kind === 'treaty' ? 'A treaty is signed. Humans are listed as a party.' : 'OpenMind\'s fleet now reports to OpenMind\'s model.');
  logNews(s, 'Robots become commonplace. So do rockets.');
  hide(s, STAGE5_HIDE);
  show(s, ['space', 'storesMain', 'stage4', 'beyond', 'earth', 'projects']);
  s.cadence.queue = [];
  s.cadence.lateQueue = [];
  s.cadence.grantQueue = [];
  s.cadence.lastRevealAt = s.stats.timePlayed;
  s.cadence.lastMechanicAt = s.stats.timePlayed;
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
    name: 'Scale',
    startMonth: monthOf(2026, 1),
    endMonth: monthOf(2026, 12),
    secondsPerMonth: 210,
    enter: enterScale,
    exit: () => 0,
  },
  {
    id: 3,
    name: 'Takeoff',
    startMonth: monthOf(2027, 1),
    endMonth: monthOf(2027, 10),
    secondsPerMonth: 270,
    enter: enterTakeoff,
    exit: () => 0,
  },
  {
    id: 4,
    name: 'Superintelligence',
    startMonth: monthOf(2027, 11),
    endMonth: monthOf(2028, 12),
    secondsPerMonth: 150,
    enter: enterSuperintelligence,
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

export const STUCK = (s: GameState): boolean => s.stuckFor >= 3;

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

export const BEAT_SPACING = 30;

function beat(s: GameState): void {
  s.flags['beatAt'] = s.stats.timePlayed;
}

const spaced = (s: GameState): boolean => s.stage > 1 || sinceFlag(s, 'beatAt') < 0 || sinceFlag(s, 'beatAt') >= BEAT_SPACING;

export function mechanic(s: GameState): void {
  s.flags['s1MechanicAt'] = s.stats.timePlayed;
}

export function mechanicClear(s: GameState): boolean {
  if (s.stage !== 1) return true;
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
    when: (s) => s.stage > 1 || (s.revealed['pricing'] === true && spaced(s) && (sinceFlag(s, 'firstPriceMoveAt') >= 30 || sinceFlag(s, 'beatAt') >= 45)),
    then: (s) => {
      s.revealed['revPerSec'] = true;
      if (s.stage > 1) return;
      beat(s);
      say(s, 'Marketing brings more customers at every price.');
    },
  },
  { id: 'revPerSec', stages: [2, 3], when: (s) => s.tasksSold >= 300 },
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
  {
    id: 'focus',
    stages: [1],
    when: (s) => sinceFlag(s, 'firstReleaseAt') >= 30,
    then: (s) => {
      mechanic(s);
      say(s, 'Focus chooses what the next model is trained for.');
    },
  },
  { id: 'log', stages: [1, 2, 3, 4, 5], when: (s) => s.log.length > 0 && (s.stage > 1 || s.stats.timePlayed >= 210) },
  {
    id: 'research',
    stages: [1, 2],
    when: (s) => ((s.flags['trustMilestones'] as number) || 0) >= 1 && spaced(s) && (s.stage > 1 || ((!s.revealed['pricing'] || s.revealed['marketing'] === true) && s.revealed['training'] === true)),
    then: (s) => {
      if (s.stage === 1) beat(s);
      show(s, ['hireResearcher']);
      s.flags['researchAt'] = s.stats.timePlayed;
      say(s, `Trust earned: ${fmtInt(s.trust)}. Each one hires a researcher.`);
    },
  },
  {
    id: 'expandLab',
    stages: [1],
    when: (s) => s.revealed['projects'] === true && sinceFlag(s, 'projectsAt') >= 40 && s.trust >= 1
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
      if (s.stage === 1 && s.revealed['research']) say(s, 'Research buys projects.');
    },
  },
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
  if (s.stage === 1) s.flags['unbilledSeen'] = s.unbilled;
}

export const EXIT_AUTOBUY_SECONDS = 240;

export function updateStage2(s: GameState): void {
  if (s.stage !== 2) return;
  const now = s.stats.timePlayed;
  const ts = s.stats.timeInStage;
  if (ts >= 30 && s.flags['arrivalPrice'] === undefined) {
    s.flags['arrivalPrice'] = s.price;
    s.flags['r0'] = Math.max(1, s.stats.revPerSec - s.contractIncome);
  }
  if (!s.revealed['lot5'] && (s.gpus >= 3000 || s.buildFund >= lotCostOf(s, 5000))) s.revealed['lot5'] = true;
  if (!s.revealed['lot25'] && (s.gpus >= 15000 || s.buildFund >= lotCostOf(s, 25000))) s.revealed['lot25'] = true;
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

  if (ts >= 900 && !isBought(s, 'p_ai_assistants') && s.flags['assistantsHalf'] !== true) {
    s.flags['assistantsHalf'] = true;
    const minutes = Math.max(1, Math.round(researchMinutesAway(s)));
    say(s, `The Research Plateau — at this rate the next run is ${minutes} minutes away. The model could help.`);
  }
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

function researchMinutesAway(s: GameState): number {
  const need = Math.max(0, (trainCost(s).research ?? 0) - s.research);
  return need / Math.max(1, s.researchers * 10) / 60;
}

function capFixAffordable(s: GameState): boolean {
  return ['p_research_cluster', 'p_exp_scheduler', 'p_checkpoint_farm', 'p_lab_cluster', 'p_floor'].some((id) => {
    const def = PROJECTS.find((p) => p.id === id);
    return !!def && isVisible(s, def) && def.canAfford(s);
  });
}
