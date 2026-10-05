import { GameState, isBought, canPay, inPrologue } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, demandPercent, expectedSalesPerSec, researchCap, potentialTasksPerSec, powerBlockCost,
} from '../engine/economy.js';
import {
  trainCost, canRedTeam, canRelease, canReleasePublic, canStartTraining, gpusShort, needsDatacenter,
  evalRun, canPressTrain, runDelaySeconds, waitingGoalS1,
} from '../engine/training.js';
import {
  lotSize, lotCost, lotReason, plantReason, lotFits, lotCostOf, gasCost, solarCost, nuclearCost, solarQueueFull, datacenterCost,
  GAS_MW, SOLAR_MW, NUCLEAR_MW, freePowerGpus, freeSlots, gpuCapacity, buildWall, standingOrderOn, lotSizes } from '../engine/infrastructure.js';
import { sl3Cost } from '../engine/world.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled, optionCost, optionLabel } from '../engine/events.js';
import type { ProjectDef } from '../data/projects.js';
import type { ChoiceDef } from '../data/choices.js';
import { stage3Step, S3Memory } from './policy3.js';
import { stage4Step, S4Memory } from './policy4.js';
import { stage5Step, S5Memory } from './policy5.js';

type Answer = number | string;

function optionIndex(def: ChoiceDef, answer: Answer): number {
  return typeof answer === 'number' ? answer : def.options.findIndex((o) => o.record === answer);
}

export type PolicyName = 'bot' | 'naive' | 'greedy' | 'trainfirst' | 'racer' | 'cautious';


export interface BotMemory {
  policy: PolicyName;
  ticks: number;
  lastPriceTick: number;
  hireNext: 'researcher' | 'lab';
  bought: string[];
  clickAcc: number;
  lastPriceMove: number;
  lowChecks: number;
  prevBacklog: number;
  choiceKey: string;
  choiceSince: number;
  variant: string;
  holdTransition: boolean;
  delayGoal?: string;
  delaySpent?: number;
  s3?: S3Memory;
  s4?: S4Memory;
  s5?: S5Memory;
}

export function newBotMemory(policy: PolicyName = 'bot', holdTransition = false, variant = ''): BotMemory {
  return {
    policy, ticks: 0, lastPriceTick: -100, hireNext: 'researcher', bought: [],
    clickAcc: 0, lastPriceMove: -100, lowChecks: 0, prevBacklog: 0, choiceKey: '', choiceSince: 0, holdTransition,
    variant, delayGoal: '', delaySpent: 0,
  };
}

const TRANSITION = 'p_datacenter';

function heldGoalPrice(s: GameState, mem: BotMemory): number {
  if (!mem.holdTransition || !isVisible(s, TRANSITION)) return 0;
  const price = projectById(TRANSITION)!.cost(s).funds ?? 0;
  const saving = mem.policy === 'bot' ? needsDatacenter(s) : mem.policy !== 'greedy';
  if (mem.policy === 'bot') return saving ? price : 0;
  return saving || s.funds >= price ? price : 0;
}

export const READING_SECONDS = 2.5;

function readModal(s: GameState, mem: BotMemory): boolean {
  const a = s.activeChoice;
  if (!a) return false;
  const key = `${a.id}|${JSON.stringify(a.context)}`;
  if (key !== mem.choiceKey) {
    mem.choiceKey = key;
    mem.choiceSince = s.stats.timePlayed;
  }
  return s.stats.timePlayed - mem.choiceSince >= READING_SECONDS;
}

export function policyStep(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.stage >= 5) {
    stage5Step(s, a, mem);
    return;
  }
  if (s.stage >= 4) {
    stage4Step(s, a, mem);
    return;
  }
  if (s.stage >= 3) {
    stage3Step(s, a, mem);
    return;
  }
  const real = mem.policy === 'racer' || mem.policy === 'cautious' ? 'bot' : mem.policy;
  if (s.stage >= 2) {
    if (real === 'bot') {
      const was = mem.policy;
      mem.policy = 'bot';
      botStepS2(s, a, mem);
      mem.policy = was;
    } else trainfirstStepS2(s, a, mem);
    return;
  }
  if (real !== mem.policy) {
    const was = mem.policy;
    mem.policy = real;
    stage1Step(s, a, mem);
    mem.policy = was;
    return;
  }
  stage1Step(s, a, mem);
}

const WORST_LABELS = [/take the bridge/, /cut the price/, /no comment/, /publish a rebuttal/, /let them go/, /submit Sage/, /let her try/, /release anyway/];
const BEST_LABELS = [/wait for a real round/, /open-source/, /publish the system card/, /sign it/, /match the offer|offer equity/, /decline/, /not now/, /keep fixing/];

function answerVariant(s: GameState, a: Actions, mem: BotMemory): boolean {
  const active = s.activeChoice;
  const def = active ? choiceById(active.id) : undefined;
  if (!active || !def) return false;
  const enabled = def.options.map((_, i) => i).filter((i) => choiceOptionEnabled(s, def, i));
  if (mem.variant === 'modals-ignore' || mem.variant === 'ignore-modals') return true;
  if (mem.variant === 'modals-last') {
    if (enabled.length) a.resolveChoice(s, enabled[enabled.length - 1]!);
    return true;
  }
  if (mem.variant === 'redteam-never' && active.id === 'c_ship_issues') {
    a.resolveChoice(s, optionIndex(def, 'shipped issues'));
    return true;
  }
  if (s.stage !== 1 || (mem.variant !== 'modals-best' && mem.variant !== 'modals-worst')) return false;
  const wanted = mem.variant === 'modals-best' ? BEST_LABELS : WORST_LABELS;
  const matches = (i: number) => wanted.some((re) => re.test(optionLabel(s, def.options[i]!)));
  const hit = enabled.find(matches);
  if (hit !== undefined) {
    a.resolveChoice(s, hit);
    return true;
  }
  if (mem.variant === 'modals-best' && def.options.some((_, i) => !enabled.includes(i) && matches(i))) return true;
  if (enabled.length) a.resolveChoice(s, enabled[0]!);
  return true;
}

function releaseAtOnce(s: GameState, a: Actions, mem: BotMemory): boolean {
  if (mem.variant !== 'redteam-never') return false;
  const run = s.training.run;
  if (run?.phase === 'redteam' && canReleasePublic(s)) a.release(s);
  return true;
}

function variantFocus(s: GameState, a: Actions, mem: BotMemory): boolean {
  if (mem.variant === 'focus-efficiency') return a.setFocus(s, 'efficiency') || true;
  if (mem.variant === 'focus-safety') return a.setFocus(s, 'safety') || true;
  return false;
}

const CHOICE_POLICY: Record<string, Answer[]> = {
  c_gamble: ['no gamble'],
  c_sage2: [0],
  c_rival: ['open-sourced'],
  c_journalist: ['system card', 'no comment'],
  c_customer_email: [0],
  c_ship_issues: ['kept fixing'],
  c_poach: ['equity', 'matched', 'let go'],
  c_bridge: ['no bridge'],
  c_letter: ['signed'],
  c_leaderboard: ['submitted'],
};

function isVisible(s: GameState, id: string): boolean {
  return visibleProjects(s).some((p) => p.id === id);
}


const WAIT_FOR: Record<string, Answer[]> = { c_poach: ['equity', 'matched'], c_journalist: ['system card'] };

function waitForCarefulAnswer(s: GameState, mem: BotMemory): boolean {
  const active = s.activeChoice!;
  const wanted = WAIT_FOR[active.id];
  const def = choiceById(active.id);
  if (!wanted || !def) return false;
  if (wanted.some((w) => choiceOptionEnabled(s, def, optionIndex(def, w)))) return false;
  return s.stats.timePlayed - mem.choiceSince < 45;
}

function answerChoice(s: GameState, a: Actions, table: Record<string, Answer[]>): void {
  const active = s.activeChoice!;
  const def = choiceById(active.id);
  if (!def) return;
  for (const w of table[active.id] ?? [0]) {
    const i = optionIndex(def, w);
    if (i >= 0 && choiceOptionEnabled(s, def, i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
}

function nudgePrice(s: GameState, a: Actions, mem: BotMemory): void {
  if (!s.revealed['business'] || mem.ticks - mem.lastPriceTick < 10) return;
  mem.lastPriceTick = mem.ticks;
  const pct = demandPercent(s);
  const supply = Math.max(s.stats.tasksPerSec, s.gpus === 0 ? 4 : 0);
  const sales = expectedSalesPerSec(s);
  const backlog = s.unbilled;
  if (supply < 12) {
    if (pct > 120 && backlog < 50) a.raisePrice(s);
    else if (sales < supply * 1.02 || backlog > 200) a.lowerPrice(s);
    return;
  }
  if (sales < supply * 1.02 + backlog / 40) a.lowerPrice(s);
  else if (sales > supply * 1.25 + backlog / 10 && backlog < supply * 3) a.raisePrice(s);
}

const NAIVE_BUY_EVERY = 10;
const NAIVE_PRICE_EVERY = 20;
const NAIVE_PRICE_COOLDOWN = 8;

function stage1Step(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  const now = s.stats.timePlayed;

  const careful = mem.policy === 'bot';
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) {
    if (!careful) answerFirst(s, a);
    else if (s.activeChoice.id === 'c_leaderboard') answerChoice(s, a, { c_leaderboard: [s.capability >= s.rivalCapability ? 'submitted' : 'declined'] });
    else if (!waitForCarefulAnswer(s, mem)) answerChoice(s, a, CHOICE_POLICY);
  }

  const copyRate = potentialTasksPerSec(s);
  if (copyRate < 8) {
    mem.clickAcc += 0.4;
    while (mem.clickAcc >= 1) {
      mem.clickAcc -= 1;
      a.clickTask(s);
    }
  }

  if (s.gpus === 0 && s.revealed['compute'] && s.funds >= gpuCost(s)) a.rentGpu(s);
  if (inPrologue(s) && s.revealed['training']) {
    if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
    else if (gpusShort(s) && !s.training.run && s.funds >= gpuCost(s)) a.rentGpu(s);
  }

  if (s.stage < 2 && s.revealed['buyPower'] && !s.gridAuto && s.power < Math.max(50, copyRate * 5)) a.buyPower(s);

  if (careful) {
    if (mem.variant !== 'price-never') nudgePrice(s, a, mem);
  } else if (mem.ticks % NAIVE_PRICE_EVERY === 0 && mem.variant !== 'price-never') naivePrice(s, a, mem, now);

  const run = s.training.run;
  if (run?.phase === 'redteam' && !releaseAtOnce(s, a, mem)) {
    if (canRedTeam(s)) a.redTeam(s);
    if (run.issues === 0 && canRelease(s)) a.release(s);
  }

  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  const trainFirst = mem.policy === 'trainfirst';
  if (trainFirst && canPressTrain(s) && !s.training.armed) {
    variantFocus(s, a, mem);
    a.startTraining(s);
  }
  const greedy = mem.policy === 'greedy';
  const reserve = greedy ? heldGoalPrice(s, mem) : Math.max(s.stage < 2 ? powerBlockCost(s) : 0, heldGoalPrice(s, mem));
  const keepsReserve = (funds: number | undefined) => !funds || s.funds - funds >= reserve;
  const goal = s.stage < 2 ? waitingGoalS1(s)?.name ?? '' : '';
  if (goal !== mem.delayGoal) {
    mem.delayGoal = goal;
    mem.delaySpent = 0;
  }
  const delayed = (funds: number) => careful && (mem.delaySpent ?? 0) + runDelaySeconds(s, { funds }) >= BOT_DELAY_LIMIT;
  const paying = (funds: number, buy: () => boolean): boolean => {
    const d = careful ? runDelaySeconds(s, { funds }) : 0;
    const ok = buy();
    if (ok && Number.isFinite(d)) mem.delaySpent = (mem.delaySpent ?? 0) + d;
    return ok;
  };
  if (greedy && s.stage < 2 && s.revealed['compute']) {
    let guard = 0;
    while (s.funds - gpuCost(s) >= reserve && guard++ < 5 && a.rentGpu(s)) {
    }
  }

  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (p.id !== 'p_beg_power' && !keepsReserve(p.cost(s).funds)) continue;
    if (p.id === TRANSITION && mem.holdTransition) continue;
    if (p.id === TRANSITION && careful && !needsDatacenter(s)) continue;
    const funds = p.id === TRANSITION || p.rescue || p.urgent?.(s) ? 0 : p.cost(s).funds ?? 0;
    if (funds > 0 && delayed(funds)) continue;
    if (careful && patient(s, p)) continue;
    if (paying(funds, () => a.buyProject(s, p.id))) mem.bought.push(p.id);
  }
  if (careful && s.stage < 2) {
    if (canPressTrain(s) && !s.training.armed) {
      variantFocus(s, a, mem);
      a.startTraining(s);
    }
  } else if (!s.training.run && canStartTraining(s) && keepsReserve(trainCost(s).funds)) {
    variantFocus(s, a, mem);
    a.startTraining(s);
  }
  if (s.revealed['research'] && !(careful && s.activeChoice?.id === 'c_poach')) {
    let guard = 0;
    while (s.trust >= 1 && guard++ < 10) {
      const cap = researchCap(s);
      const walled = cheapestResearchCost(s) > cap || (s.research >= cap && largestResearchCost(s) > cap);
      const ok = walled && s.revealed['expandLab'] ? a.expandLab(s) : a.hireResearcher(s);
      if (!ok) break;
    }
  }
  const bigTicket = trainFirst ? harnessGoal(s) || isVisible(s, TRANSITION) : greedy || careful ? false : isVisible(s, TRANSITION);
  const rentable = s.stage < 2 && s.revealed['compute'];
  const needed = () => gpusShort(s) && !needsDatacenter(s);
  const firstTimer = !careful && !greedy;
  if (firstTimer && !bigTicket && s.revealed['marketing'] && s.funds - marketingCost(s) >= reserve) a.buyMarketing(s);
  if (rentable && (!bigTicket || needed())) {
    let guard = 0;
    while (s.funds - gpuCost(s) >= reserve && guard++ < (firstTimer ? 1 : 5) && (!bigTicket || gpusShort(s))) {
      if (needed() ? !a.rentGpu(s) : delayed(gpuCost(s)) || !paying(gpuCost(s), () => a.rentGpu(s))) break;
    }
  }
  if (!firstTimer && !bigTicket && s.revealed['marketing'] && s.funds - marketingCost(s) >= reserve && !delayed(marketingCost(s))) {
    paying(marketingCost(s), () => a.buyMarketing(s));
  }
}

function harnessGoal(s: GameState): boolean {
  const floor = Math.max(10000, 60 * s.stats.revPerSec);
  return visibleProjects(s).some((p) => (p.cost(s).funds ?? 0) >= floor);
}

function patient(s: GameState, p: ProjectDef): boolean {
  if (p.pinned || p.rescue) return false;
  const c = p.cost(s);
  return !!p.sideline && (c.funds ?? 0) > 0 && s.funds < 2 * (c.funds ?? 0);
}

function answerFirst(s: GameState, a: Actions): void {
  const active = s.activeChoice!;
  const def = choiceById(active.id);
  if (!def) return;
  for (let i = 0; i < def.options.length; i++) {
    if (choiceOptionEnabled(s, def, i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
}

function runResearch(s: GameState): number {
  return s.revealed['training'] && !s.training.run ? (trainCost(s).research ?? 0) : 0;
}

function largestResearchCost(s: GameState): number {
  let best = runResearch(s);
  for (const p of visibleProjects(s)) best = Math.max(best, p.cost(s).research ?? 0);
  return best;
}

function cheapestResearchCost(s: GameState): number {
  let best = Infinity;
  if (runResearch(s) > 0) best = runResearch(s);
  for (const p of visibleProjects(s)) {
    const r = p.cost(s).research;
    if (r && r < best) best = r;
  }
  return best === Infinity ? 0 : best;
}

function naivePrice(s: GameState, a: Actions, mem: BotMemory, now: number): void {
  if (!s.revealed['business']) return;
  const production = Math.max(1, s.stats.tasksPerSec);
  const backlog = s.unbilled;
  const growing = backlog > mem.prevBacklog;
  mem.prevBacklog = backlog;
  const nearZero = backlog <= Math.max(3, production * 0.5);
  mem.lowChecks = nearZero ? mem.lowChecks + 1 : 0;
  if (now - mem.lastPriceMove < NAIVE_PRICE_COOLDOWN) return;
  if (backlog > 30 * production && growing) {
    if (a.lowerPrice(s)) mem.lastPriceMove = now;
  } else if (mem.lowChecks >= 4) {
    if (a.raisePrice(s)) {
      mem.lastPriceMove = now;
      mem.lowChecks = 0;
    }
  }
}

const CHOICE_POLICY_S2: Record<string, Answer[]> = {
  c_sage2: [0],
  c_hearing: [0, 1],
  c_publishers: [0, 1],
  c_gulf: [1],
  c_evals_month: [1],
  c_defense: [0, 1],
  c_theft_warning: [0, 1],
  c_pact: [0],
  c_gamble: ['gamble', 'no gamble'],
  c_customer_email: [0],
  c_ship_issues: ['kept fixing'],
};

const FOCUS_CYCLE = ['capability', 'efficiency', 'capability', 'efficiency', 'safety'] as const;


function runsS2(s: GameState): number {
  return typeof s.flags['runsS2'] === 'number' ? (s.flags['runsS2'] as number) : 0;
}

function publishersWait(s: GameState, mem: BotMemory): number {
  const a = s.activeChoice;
  if (!a || a.id !== 'c_publishers') return 0;
  const def = choiceById('c_publishers');
  if (!def || choiceOptionEnabled(s, def, 0)) return 0;
  const price = optionCost(s, def.options[0]!)?.funds ?? 0;
  return s.stats.timePlayed - mem.choiceSince < 60 ? price : 0;
}

const CHOICES_BEST: Record<string, Answer[]> = {
  c_sage2: [0], c_hearing: [0], c_publishers: [0, 2], c_gulf: [1], c_evals_month: [0], c_defense: [1],
  c_theft_warning: [0], c_pact: [0], c_gamble: ['no gamble'], c_customer_email: [0], c_ship_issues: ['kept fixing'],
};
const CHOICES_WORST: Record<string, Answer[]> = {
  c_sage2: [1], c_hearing: [1], c_publishers: [1], c_gulf: [0, 2, 1], c_evals_month: [2], c_defense: [0],
  c_theft_warning: [2], c_pact: [1], c_gamble: ['gamble', 'no gamble'], c_customer_email: [0], c_ship_issues: ['shipped issues'],
};


function answerChoiceS2(s: GameState, a: Actions, mem: BotMemory): void {
  const id = s.activeChoice!.id;
  if (mem.variant === 'modals-ignore' || mem.variant === 'ignore-modals' || mem.variant === 'modals-last') {
    answerVariant(s, a, mem);
    return;
  }
  if (mem.variant === 'modals-best' || mem.variant === 'modals-worst') {
    if (mem.variant === 'modals-best' && publishersWait(s, mem) > 0) return;
    answerChoice(s, a, mem.variant === 'modals-best' ? CHOICES_BEST : CHOICES_WORST);
    return;
  }
  if (id === 'c_gulf' && (mem.variant === 'gulf-sign' || mem.variant === 'gulf-domestic')) {
    if (mem.variant === 'gulf-sign') {
      if (choiceOptionEnabled(s, choiceById('c_gulf')!, 0)) a.resolveChoice(s, 0);
      return;
    }
    answerChoice(s, a, { c_gulf: [1] });
    return;
  }
  if (id === 'c_defense') {
    a.resolveChoice(s, s.approval > -15 ? 0 : 1);
    return;
  }
  if (publishersWait(s, mem) > 0) return;
  answerChoice(s, a, CHOICE_POLICY_S2);
}

function dataReady(s: GameState): boolean {
  const need = trainCost(s).data ?? 0;
  return s.data + 1e-9 >= need;
}


function redTeamAndRelease(s: GameState, a: Actions, mem?: BotMemory): void {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam') return;
  if (mem?.variant === 'redteam-never' && s.stage === 2) {
    if (canReleasePublic(s)) a.release(s);
    return;
  }
  if (canRedTeam(s)) a.redTeam(s);
  if (run.issues === 0 && canReleasePublic(s)) a.release(s);
}

function focusFor(s: GameState, mem: BotMemory): (typeof FOCUS_CYCLE)[number] {
  if (mem.variant === 'focus-efficiency') return 'efficiency';
  if (mem.variant === 'focus-safety') return 'safety';
  const focus = FOCUS_CYCLE[runsS2(s) % FOCUS_CYCLE.length]!;
  if (mem.variant === 'safety-0' && focus === 'safety') return 'capability';
  if (mem.variant === 'safety-2') {
    const n = runsS2(s);
    return n === 2 || n === 5 ? 'safety' : focus === 'safety' ? 'capability' : focus;
  }
  return focus;
}

function cheapestPower(s: GameState): 'gas' | 'solar' | 'nuclear' | '' {
  const options: ['gas' | 'solar' | 'nuclear', number][] = [];
  if (s.revealed['gasButton']) options.push(['gas', gasCost(s) / GAS_MW]);
  if (s.revealed['solarButton'] && !solarQueueFull(s)) options.push(['solar', solarCost(s) / SOLAR_MW]);
  if (s.revealed['nuclearButton']) options.push(['nuclear', nuclearCost(s) / NUCLEAR_MW]);
  options.sort((x, y) => x[1] - y[1]);
  return options[0]?.[0] ?? '';
}

function cheapestInstantPower(s: GameState): 'gas' | 'nuclear' | '' {
  const gas = s.revealed['gasButton'] ? gasCost(s) / GAS_MW : Infinity;
  const nuclear = s.revealed['nuclearButton'] ? nuclearCost(s) / NUCLEAR_MW : Infinity;
  if (gas === Infinity && nuclear === Infinity) return '';
  return nuclear < gas ? 'nuclear' : 'gas';
}

function buyPowerKind(s: GameState, a: Actions, kind: 'gas' | 'solar' | 'nuclear'): boolean {
  if (kind === 'gas') return a.buyTurbines(s);
  if (kind === 'solar') return a.buySolar(s);
  return a.buyNuclear(s);
}

function powerCostOf(s: GameState, kind: 'gas' | 'solar' | 'nuclear'): number {
  return kind === 'gas' ? gasCost(s) : kind === 'solar' ? solarCost(s) : nuclearCost(s);
}

export function botStepS2(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  if (s.activeChoice && readModal(s, mem)) answerChoiceS2(s, a, mem);
  redTeamAndRelease(s, a, mem);
  if (mem.ticks % 2 !== 0) return;

  const rev = Math.max(1, s.stats.revPerSec);
  const buy = (p: ProjectDef) => {
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  };

  if (!s.training.armed && canPressTrain(s) && dataReady(s)) {
    a.setFocus(s, focusFor(s, mem));
    a.startTraining(s);
  }

  const ordered = stage2First(visibleProjects(s));
  ordered.sort((x, y) => Number(y.urgent?.(s) === true) - Number(x.urgent?.(s) === true));
  const insightHeld = ordered
    .filter((p) => !p.stages.includes(1))
    .reduce((m, p) => Math.max(m, p.cost(s).insight ?? 0), 0);
  for (const p of ordered) {
    if (!p.canAfford(s)) continue;
    const c = p.cost(s);
    if (c.insight && p.stages.includes(1) && s.insight - c.insight < insightHeld) continue;
    if (c.trust && !trustSpare(s, c.trust, p.id)) continue;
    const named = p.urgent?.(s) === true;
    const payback = MARKET_CARDS.includes(p.id) && (c.funds ?? 0) <= 60 * rev;
    if (!named && !payback && runDelaySeconds(s, c) >= BOT_DELAY_LIMIT) continue;
    buy(p);
  }

  const wall = buildWall(s);
  const powerShort = wall === 'power' || (freePowerGpus(s) < 2000 && freePowerGpus(s) <= freeSlots(s));
  if (powerShort) {
    let kind = cheapestPower(s);
    if (kind === 'solar' && s.powerQueue.some((o) => o.kind === 'solar')) kind = cheapestInstantPower(s);
    if (kind === 'nuclear' && s.buildFund < nuclearCost(s) && s.revealed['gasButton'] && gasCost(s) <= 30 * rev) kind = 'gas';
    if (kind && s.buildFund >= powerCostOf(s, kind)) buyPowerKind(s, a, kind);
  } else if (
    s.revealed['solarButton'] && !s.powerQueue.some((o) => o.kind === 'solar') &&
    s.gpus >= 0.8 * s.powerCapacityMW * 1000 && s.buildFund >= solarCost(s) + lotCostOf(s, 1000)
  ) {
    a.buySolar(s);
  }
  if ((wall === 'room' || freeSlots(s) < 2000 || freeSlots(s) < 0.3 * gpuCapacity(s)) && s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) {
    a.buildDatacenter(s);
  }
  if (standingOrderOn(s)) a.toggleStanding(s);
  {
    let guard = 0;
    while (guard++ < 4) {
      const size = lotSizes(s).slice().reverse().find((n) => lotFits(s, n) && s.buildFund >= lotCostOf(s, n));
      if (!size || !a.buyGpuBatch(s, size)) break;
    }
  }

  const pinned = /^share-(\d+)$/.exec(mem.variant);
  const want = pinned ? Number(pinned[1]) / 100 : gpusShort(s) ? 0.75 : 0.5;
  let turns = 0;
  while (Math.abs(s.buildShare - want) > 1e-9 && turns++ < 3) a.cycleBuildShare(s);

  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s)) && runDelaySeconds(s, sl3Cost(s)) < BOT_DELAY_LIMIT) a.buySL3(s);

  if (s.revealed['allocation']) {
    const fixed = /^slider-(\d+)$/.exec(mem.variant);
    const want = fixed ? Number(fixed[1]) : s.research >= researchCap(s) - 1 ? 10 : 20;
    if (Math.round(s.researchAlloc * 100) !== want) a.setResearchAlloc(s, want);
  }
  if (s.revealed['jobFund'] && !s.jobFund && s.approval <= -10) a.toggleJobFund(s);
  if (s.revealed['shareEvals'] && !s.shareEvals) a.toggleShareEvals(s);
  if (s.revealed['alignShare'] && s.alignShare < 0.05 - 1e-9) a.cycleAlignShare(s);
}

const BOT_DELAY_LIMIT = 30;



const MARKET_CARDS = ['p_agent_platform', 'p_international', 'p_free_tier'];

function stage2First(list: ProjectDef[]): ProjectDef[] {
  return [...list.filter((p) => !p.stages.includes(1)), ...list.filter((p) => p.stages.includes(1))];
}

function trustSpare(s: GameState, amount: number, forId = ''): boolean {
  let hold = 0;
  if (s.revealed['sl3Button'] && s.securityLevel < 3) hold += 3;
  if (forId !== 'p_policy' && visibleProjects(s).some((p) => p.id === 'p_policy') && !isBought(s, 'p_policy')) hold += 2;
  return s.trust - amount >= hold;
}

export function trainfirstStepS2(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) answerFirst(s, a);
  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
  redTeamAndRelease(s, a, mem);
  const presses = mem.policy === 'greedy' ? 15 : 3;
  for (let i = 0; i < presses; i++) {
    const reason = lotReason(s);
    let done = false;
    if (!reason && lotSize(s) > 0 && s.buildFund >= lotCost(s)) done = a.buyGpuBatch(s);
    else if (reason === 'no power') {
      const kinds = (['gas', 'solar', 'nuclear'] as const).filter((k) => plantEnabled(s, k));
      const best = kinds.sort((x, y) => powerCostOf(s, x) / mwOf(x) - powerCostOf(s, y) / mwOf(y))[0];
      if (best) done = buyPowerKind(s, a, best);
    } else if (reason === 'no room' && s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) done = a.buildDatacenter(s);
    if (!done) break;
  }
  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (s.trust >= 1 && s.revealed['hireResearcher']) a.hireResearcher(s);
  if (s.trust >= 1 && s.revealed['expandLab']) a.expandLab(s);
  sweepExtras(s, a);
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) a.buySL3(s);
}

function sweepExtras(s: GameState, a: Actions): void {
  if (s.revealed['lot5']) a.buyLotRow(s, 1);
  if (s.revealed['lot25']) a.buyLotRow(s, 2);
}

function plantEnabled(s: GameState, kind: 'gas' | 'solar' | 'nuclear'): boolean {
  const shown = kind === 'gas' ? s.revealed['gasButton'] : kind === 'solar' ? s.revealed['solarButton'] : s.revealed['nuclearButton'];
  return shown === true && !plantReason(s, kind) && s.buildFund >= powerCostOf(s, kind);
}

function mwOf(kind: 'gas' | 'solar' | 'nuclear'): number {
  return kind === 'gas' ? GAS_MW : kind === 'solar' ? SOLAR_MW : NUCLEAR_MW;
}

export function naiveStepS2(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) answerFirst(s, a);
  redTeamAndRelease(s, a, mem);
  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  const greedy = mem.policy === 'greedy';

  const infra = () => {
    const presses = greedy ? 5 : 1;
    for (let i = 0; i < presses; i++) {
      let any = false;
      if (s.revealed['infrastructure'] && lotSize(s) > 0 && s.buildFund >= lotCost(s)) any = a.buyGpuBatch(s) || any;
      if (s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) any = a.buildDatacenter(s) || any;
      if (s.revealed['gasButton'] && s.buildFund >= gasCost(s)) any = a.buyTurbines(s) || any;
      if (s.revealed['solarButton'] && s.buildFund >= solarCost(s)) any = a.buySolar(s) || any;
      if (s.revealed['nuclearButton'] && s.buildFund >= nuclearCost(s)) any = a.buyNuclear(s) || any;
      if (!any) break;
    }
  };

  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (greedy) infra();
  if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
  let guard = 0;
  while (s.trust >= 1 && guard++ < 10) {
    const pick = s.revealed['expandLab'] ? mem.hireNext : 'researcher';
    const ok = pick === 'lab' ? a.expandLab(s) : a.hireResearcher(s);
    if (!ok) break;
    mem.hireNext = pick === 'lab' ? 'researcher' : 'lab';
  }
  if (!greedy) infra();
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) a.buySL3(s);
  if (s.revealed['marketing'] && s.funds >= marketingCost(s)) a.buyMarketing(s);
}

export function computeGateOpen(s: GameState): boolean {
  return !gpusShort(s);
}

export function releaseSlot(s: GameState) {
  return evalRun(s);
}

export function roomLeft(s: GameState): number {
  return gpuCapacity(s) - s.gpus;
}

export function releasable(s: GameState): boolean {
  return canRelease(s);
}
