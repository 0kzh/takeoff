import { GameState, inPrologue } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, demandPercent, expectedSalesPerSec, researchCap, potentialTasksPerSec, powerBlockCost,
  activeGpus, datacenterCost, gpuBatchCost, gridUpgradeCost, canExpandGrid, gridOutgrown, powerDrawPerSec,
  canBuyGpuBatch, batchSize, canUpgradeSecurity, securityCost,
} from '../engine/economy.js';
import {
  trainCost, canRedTeam, canRelease, canStartTraining, gpusShort, needsDatacenter, canPressTrain, runDelaySeconds, waitingGoalS1,
  trainSlotFree, startCapability,
} from '../engine/training.js';
import { dataShort } from '../engine/data.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import type { ProjectDef } from '../data/projects.js';
import type { ChoiceDef } from '../data/choices.js';

type Answer = number | string;

function optionIndex(def: ChoiceDef, answer: Answer): number {
  return typeof answer === 'number' ? answer : def.options.findIndex((o) => o.record === answer);
}

export type PolicyName = 'bot' | 'naive' | 'greedy' | 'trainfirst';

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
  const matches = (i: number) => wanted.some((re) => re.test(def.options[i]!.label));
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
  if (run?.phase === 'redteam' && canRelease(s)) a.release(s);
  return true;
}

function variantFocus(s: GameState, a: Actions, mem: BotMemory): boolean {
  if (mem.variant === 'focus-efficiency') return a.setFocus(s, 'efficiency') || true;
  if (mem.variant === 'focus-safety') return a.setFocus(s, 'safety') || true;
  return false;
}

// A player who races and ignores the world: the early-ending paths.
const RECKLESS_POLICY: Record<string, Answer[]> = {
  c_release: ['deployed'],
  c_data_wall: ['customer data'],
  c_hearing: ['deflected'],
  c_funding: ['growth'],
  c_theft: ['cut'],
  c_mini: ['launched'],
  c_bio: ['unrestricted'],
  c_defense: ['accepted'],
  c_protest: ['ignored'],
  c_compute_request: ['granted'],
  c_irrelevance: ['emergency round'],
  c_ultimatum: ['refused'],
  c_emergency_vote: ['did nothing'],
};
const RECKLESS_SKIPS = ['s2_commitments', 's2_spec', 's2_honesty', 's2_cot', 's2_probes', 's2_sae', 's2_redteam', 's2_evals', 's2_compute_cap', 's2_security', 's2_egress'];

const CHOICE_POLICY: Record<string, Answer[]> = {
  c_release: ['deployed'],
  c_data_wall: ['respected'],
  c_hearing: ['cooperated'],
  c_funding: ['patient'],
  c_theft: ['traced', 'cut'],
  c_mini: ['launched'],
  c_bio: ['delayed'],
  c_defense: ['declined'],
  c_protest: ['jobs programme', 'statement'],
  c_compute_request: ['watched'],
  c_irrelevance: ['emergency round'],
  c_ultimatum: ['oversight'],
  c_emergency_vote: ['conceded'],
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

export function policyStep(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  const now = s.stats.timePlayed;

  const careful = mem.policy === 'bot';
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) {
    if (mem.variant === 'reckless' && s.stage >= 2) answerChoice(s, a, { ...CHOICE_POLICY, ...RECKLESS_POLICY });
    else if (!careful) answerFirst(s, a);
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

  if (s.revealed['buyPower'] && !s.gridAuto && s.power < Math.max(50, (s.stage < 2 ? copyRate : powerDrawPerSec(s)) * 5)) a.buyPower(s);

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
  const reserve = greedy ? heldGoalPrice(s, mem) : Math.max(s.gridAuto ? 0 : powerBlockCost(s), heldGoalPrice(s, mem));
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
      // Each successful condition purchases one GPU, up to the per-step limit.
    }
  }

  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (p.id === 's2_licensing' && !dataShort(s, startCapability(s))) continue;
    if (mem.variant === 'reckless' && RECKLESS_SKIPS.includes(p.id)) continue;
    if (s.stage >= 2 && p.sideline && p.id !== 's2_licensing' && (p.cost(s).funds ?? 0) > 0.5 * s.funds) continue;
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
  if (s.stage < 2 && canExpandGrid(s) && gridOutgrown(s) && s.funds - gridUpgradeCost(s) >= reserve) a.expandGrid(s);
  if (s.stage >= 2 && s.revealed['infrastructure']) infrastructure(s, a, mem);
}

// Stage 2: keep the next run reachable (GPUs, data, money), grow the fleet for
// reach, power what is bought, and raise security once Baiwen is in the race.
function infrastructure(s: GameState, a: Actions, mem: BotMemory): void {
  const careful = mem.policy === 'bot';
  const powered = activeGpus(s) >= s.gpus;
  if (!powered && canExpandGrid(s) && s.funds >= gridUpgradeCost(s)) a.expandGrid(s);
  const trainNeedsGpus = trainSlotFree(s) && gpusShort(s) && !needsDatacenter(s);
  const runFunds = trainCost(s).funds ?? 0;
  const spare = (cost: number) => s.funds - cost >= (trainNeedsGpus ? 0 : Math.min(runFunds, 0.5 * s.funds));
  if (!canBuyGpuBatch(s) && s.revealed['infrastructure'] && s.funds >= datacenterCost(s) && (trainNeedsGpus || spare(datacenterCost(s)))) {
    a.buildDatacenter(s);
  }
  let guard = 0;
  while (canBuyGpuBatch(s) && s.funds >= gpuBatchCost(s) && guard++ < 5) {
    const grid = activeGpus(s) >= s.gpus;
    if (!grid && canExpandGrid(s)) break;
    if (trainNeedsGpus || (careful ? s.funds >= 3 * gpuBatchCost(s) + runFunds * 0.5 : s.funds >= 1.5 * gpuBatchCost(s))) {
      if (!a.buyGpuBatch(s)) break;
    } else break;
  }
  if (!powered || activeGpus(s) < s.gpus) {
    if (canExpandGrid(s) && s.funds >= gridUpgradeCost(s)) a.expandGrid(s);
  }
  if (canUpgradeSecurity(s) && s.baiwen.present && s.security < 3 && s.funds >= 4 * securityCost(s)) a.upgradeSecurity(s);
  if (s.revealed['marketing'] && s.funds >= 4 * marketingCost(s) && marketingCost(s) < 40 * Math.max(1, s.stats.revPerSec)) a.buyMarketing(s);
  if (trainSlotFree(s) && canStartTraining(s) && !dataShort(s, startCapability(s))) {
    if (s.revealed['alignment'] && s.alignmentApparent < 55 && (s.flags['runsThisStage'] as number) % 3 === 2) a.setFocus(s, 'safety');
    else a.setFocus(s, 'capability');
    a.startTraining(s);
  } else if (trainSlotFree(s) && canStartTraining(s) && dataShort(s, startCapability(s)) && s.funds < 2 * runFunds) {
    a.startTraining(s);
  }
  void batchSize;
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

function largestResearchCost(s: GameState): number {
  let best = 0;
  for (const p of visibleProjects(s)) best = Math.max(best, p.cost(s).research ?? 0);
  return best;
}

function cheapestResearchCost(s: GameState): number {
  let best = Infinity;
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

const BOT_DELAY_LIMIT = 30;
