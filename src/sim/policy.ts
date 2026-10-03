import { GameState } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, demandPercent, expectedSalesPerSec, researchCap, researchRate, datacenterCost,
  gpuBatchCost, turbineCost, gpuCapacity, activeGpus, perCopyRate, potentialTasksPerSec, powerBlockCost,
  GPU_BATCH,
} from '../engine/economy.js';
import { trainCost, canRedTeam, canRelease, canStartTraining, computeYield } from '../engine/training.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import type { ProjectDef } from '../data/projects.js';

export type PolicyName = 'bot' | 'naive';

/** Order in which the bot buys visible projects. The Abilene ladder sits after the revenue boosts. */
export const PROJECT_PRIORITY = [
  'p_beg_power', 'p_seed', 'p_series_a', 'p_training', 'p_grid', 'p_prompting', 'p_insight', 'p_blogpost',
  'p_demo', 'p_workshop', 'p_keynote', 'p_press', 'p_api', 'p_lab_cluster', 'p_prompting2', 'p_prompting3',
  'p_eval_team', 'p_compute_deal', 'p_pricing', 'p_enterprise', 'p_distributed', 'p_batch', 'p_moe', 'p_agents', 'p_floor',
  'p_dogfood', 'p_site', 'p_interconnect', 'p_substation', 'p_contractor', 'p_datacenter', 'p_ppa', 'p_recruiter',
  'p_alignment_team', 'p_safety_framework', 'p_contract',
];

/** The stage goal: the Abilene site ladder, rung by rung. */
export const LADDER = ['p_site', 'p_interconnect', 'p_substation', 'p_datacenter'];

export interface BotMemory {
  policy: PolicyName;
  ticks: number;
  lastPriceTick: number;
  hireNext: 'researcher' | 'lab';
  /** Ids the bot bought this tick, for the sim's event lines. */
  bought: string[];
  /** Naive policy: fractional clicks, price-check bookkeeping. */
  clickAcc: number;
  lastPriceMove: number;
  lowChecks: number;
  prevBacklog: number;
  /** The open modal and when it opened: players read before they click. */
  choiceKey: string;
  choiceSince: number;
  /** Leave the stage-ending purchase (Break ground) to the player (the browser smoke test clicks it). */
  holdTransition: boolean;
}

export function newBotMemory(policy: PolicyName = 'bot', holdTransition = false): BotMemory {
  return {
    policy, ticks: 0, lastPriceTick: -100, hireNext: 'researcher', bought: [],
    clickAcc: 0, lastPriceMove: -100, lowChecks: 0, prevBacklog: 0, choiceKey: '', choiceSince: 0, holdTransition,
  };
}

/** The purchase that ends Stage 1. */
const TRANSITION = 'p_datacenter';

/** With `holdTransition`, Break ground's price is kept in hand once it is on screen. */
function heldGoalPrice(s: GameState, mem: BotMemory): number {
  if (!mem.holdTransition || !isVisible(s, TRANSITION)) return 0;
  return projectById(TRANSITION)!.cost(s).funds ?? 0;
}

/** Seconds a policy reads a modal before answering it (a 2-s snapshot sees every modal). */
export const READING_SECONDS = 2.5;

/** True once the open modal has been on screen for the reading time. */
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

/** One decision pass per 100 ms tick for the chosen policy. */
export function policyStep(s: GameState, a: Actions, mem: BotMemory): void {
  if (mem.policy === 'naive') naiveStep(s, a, mem);
  else botStep(s, a, mem);
}

/** Fixed answers to every modal (bot policy). */
const CHOICE_POLICY: Record<string, number[]> = {
  c_gamble: [0, 1],
  c_sage2: [0],
  c_rival: [2],
  c_journalist: [0, 1],
  c_customer_email: [0],
  c_ship_issues: [1],
  c_water: [1],
  c_utility: [1],
  c_poach: [1, 0, 2],
  c_abatement: [0],
  c_bridge: [1],
  c_letter: [2],
  c_neighbour: [1, 2],
  c_outage: [0, 1],
};

function isVisible(s: GameState, id: string): boolean {
  return visibleProjects(s).some((p) => p.id === id);
}

/** The visible, unbought rung of the Abilene ladder, if any. */
export function currentRung(s: GameState): ProjectDef | undefined {
  return visibleProjects(s).find((p) => LADDER.includes(p.id));
}

/**
 * A "reasonable player", one decision pass per 100 ms tick, acting only through `actions`.
 * Clicks until the first GPU, keeps a power reserve, prices to keep demand in a sane band,
 * spends Trust on researchers and lab space, buys projects in priority order, trains
 * Capability first and then alternates with Efficiency, red-teams to zero, releases, and
 * saves for the Abilene ladder once it is on screen.
 */
export function botStep(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;

  if (s.activeChoice && readModal(s, mem)) answerChoice(s, a, CHOICE_POLICY);

  if (s.gpus === 0 && mem.ticks % 2 === 0) a.clickTask(s);

  const drawPerSec = potentialTasksPerSec(s);
  const powerLow = s.stage < 2 && !s.gridAuto && s.power < Math.max(300, drawPerSec * 20);
  // Keep a block's price in hand when power is getting low (the Grid Contract buys with it too),
  // and, when the player will click Break ground, its price.
  const reserve = Math.max(
    s.stage < 2 && s.power < Math.max(600, drawPerSec * 60) ? powerBlockCost(s) : 0,
    heldGoalPrice(s, mem),
  );
  if (powerLow && s.revealed['buyPower']) a.buyPower(s);

  nudgePrice(s, a, mem);
  buyProjects(s, a, mem, reserve);
  trainingLoop(s, a);
  spendTrust(s, a, mem);

  const rung = currentRung(s);
  const saving = !!rung && (!rung.canAfford(s) || heldGoalPrice(s, mem) > 0);
  const rungFunds = rung?.cost(s).funds ?? 0;
  if (s.stage < 2 && s.revealed['compute']) {
    let guard = 0;
    while (gpuWorthIt(s, saving, rungFunds) && s.funds - gpuCost(s) >= reserve && guard++ < 5) a.rentGpu(s);
  }
  if (s.revealed['marketing'] && s.stats.publicReleases >= 1) {
    const cost = marketingCost(s);
    const sensible = cost <= Math.max(400, s.stats.revPerSec * 240) && (!saving || cost <= rungFunds * 0.1);
    if (s.funds - cost >= reserve && (sensible || cost <= s.funds * 0.15)) a.buyMarketing(s);
  }
  if (s.stage >= 2 && s.revealed['infrastructure']) infrastructure(s, a);
}

/** A GPU is worth renting while it pays for itself within a few minutes (or it is one of the first 25). */
function gpuWorthIt(s: GameState, saving: boolean, rungFunds: number): boolean {
  const cost = gpuCost(s);
  if (s.gpus < 25) return true;
  if (cost <= s.funds * 0.02 && (!saving || cost <= rungFunds * 0.01)) return true;
  const marginal = 0.6 * s.price * perCopyRate(s) * s.copiesPerGPU;
  return cost <= marginal * (saving ? 60 : 300);
}

function answerChoice(s: GameState, a: Actions, table: Record<string, number[]>): void {
  const active = s.activeChoice!;
  const def = choiceById(active.id);
  if (!def) return;
  for (const i of table[active.id] ?? [0]) {
    if (choiceOptionEnabled(s, def, i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
}

/**
 * Demand between 60% and 120% while supply is small. Once the copies make more than 120%
 * demand can bill, the bot prices to clear production instead (as UP players do).
 */
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

function researchNeeded(s: GameState): number {
  let need = s.revealed['training'] ? (trainCost(s).research ?? 0) : 0;
  for (const p of visibleProjects(s)) need = Math.max(need, p.cost(s).research ?? 0);
  return need;
}

function buyProjects(s: GameState, a: Actions, mem: BotMemory, reserve: number): void {
  const trainingIdle = s.revealed['training'] && !s.training.run;
  const trainResearch = trainCost(s).research ?? 0;
  const savingResearch = trainingIdle && trainResearch <= researchCap(s);
  const rung = currentRung(s);
  const rungFunds = rung && !rung.canAfford(s) ? (rung.cost(s).funds ?? 0) : 0;
  const holdResearch = revenueResearchWaiting(s);
  for (const id of PROJECT_PRIORITY) {
    const def = projectById(id);
    if (!def || !isVisible(s, id) || !def.canAfford(s)) continue;
    const cost = def.cost(s);
    const ladder = LADDER.includes(id);
    if (cost.funds && s.funds - cost.funds < reserve && !ladder) continue;
    // While saving for a rung, only cheap or revenue-raising purchases go ahead.
    if (cost.funds && rungFunds && !ladder && cost.funds > 0.25 * rungFunds && !REVENUE.includes(id)) continue;
    const revenue = REVENUE.includes(id);
    if (cost.research && savingResearch && !ladder && !revenue && s.research - cost.research < trainResearch) continue;
    if (cost.research && holdResearch && !revenue && !ladder) continue;
    if (id === 'p_beg_power' && s.funds >= powerBlockCost(s)) continue;
    if (id === TRANSITION && mem.holdTransition) continue;
    if (a.buyProject(s, id)) mem.bought.push(id);
  }
}

/** Projects that pay for themselves within minutes; the bot buys them even while saving. */
const REVENUE = [
  'p_enterprise', 'p_batch', 'p_pricing', 'p_api', 'p_floor', 'p_agents', 'p_prompting', 'p_prompting2',
  'p_prompting3', 'p_training', 'p_grid', 'p_distributed',
];

/**
 * A revenue project on screen that only lacks research and will have it within ~45 s:
 * training (and research-for-revenue swaps like contracts) wait for it.
 */
function revenueResearchWaiting(s: GameState): boolean {
  return visibleProjects(s).some((p) => {
    if (!REVENUE.includes(p.id) || p.canAfford(s)) return false;
    const r = p.cost(s).research ?? 0;
    const soon = (r - s.research) / Math.max(1, researchRate(s)) <= 45;
    return r > s.research && r <= researchCap(s) && soon && s.funds >= (p.cost(s).funds ?? 0);
  });
}

function trainingLoop(s: GameState, a: Actions): void {
  if (!s.revealed['training']) return;
  const run = s.training.run;
  if (!run) {
    // Capability while the rented fleet can still teach the model something, then Efficiency.
    a.setFocus(s, computeYield(s) >= 0.15 ? 'capability' : 'efficiency');
    if (revenueResearchWaiting(s)) return;
    const rung = currentRung(s);
    const rungResearch = rung?.cost(s).research ?? 0;
    if (rungResearch && s.research - (trainCost(s).research ?? 0) < rungResearch && rung!.canAfford(s)) return;
    a.startTraining(s);
    return;
  }
  if (run.phase !== 'redteam') return;
  if (canRedTeam(s)) a.redTeam(s);
  if (run.issues === 0 && canRelease(s)) a.release(s);
}

function spendTrust(s: GameState, a: Actions, mem: BotMemory): void {
  if (!s.revealed['research'] || !s.revealed['hireResearcher']) return;
  let guard = 0;
  while (s.trust >= 1 && guard++ < 10) {
    // Let research reach the cap (insight accrues there) before adding lab space.
    const need = researchNeeded(s);
    const cap = researchCap(s);
    const fillTime = (cap - s.research) / Math.max(1, researchRate(s));
    let pick = s.revealed['expandLab'] ? mem.hireNext : 'researcher';
    if (s.revealed['expandLab']) {
      if (cap < need) pick = fillTime < 20 ? 'lab' : 'researcher';
      else if (fillTime > 90) pick = 'researcher';
    }
    const ok = pick === 'lab' ? a.expandLab(s) : a.hireResearcher(s);
    if (!ok) break;
    mem.hireNext = pick === 'lab' ? 'researcher' : 'lab';
  }
}

function infrastructure(s: GameState, a: Actions): void {
  const powered = activeGpus(s) >= s.gpus;
  if (!powered && s.funds >= turbineCost(s)) a.buyTurbines(s);
  if (s.gpus + GPU_BATCH > gpuCapacity(s) && s.funds >= datacenterCost(s)) a.buildDatacenter(s);
  if (powered && s.funds >= gpuBatchCost(s) * 1.2) a.buyGpuBatch(s);
}

// ---------- the naive first-timer (the critic's scripted player) ----------

/** Seconds between the naive player's purchase passes and price checks (the critic's 2-s snapshots). */
const NAIVE_BUY_EVERY = 10;
const NAIVE_PRICE_EVERY = 20;
const NAIVE_PRICE_COOLDOWN = 8;

/**
 * Plays like the critic's scripted first-timer (critic report §1 "Policy"):
 *   - mashes Complete Task at 4 clicks/s until the copies out-produce the hand (≥ 8 tasks/s);
 *   - buys any affordable upgrade, project or automation while keeping one power block in reserve;
 *   - prices only by watching the backlog: lower when it exceeds 30 s of production and is growing,
 *     raise after 4 consecutive checks of near-zero backlog, 8 s cool-down;
 *   - answers every modal with its first enabled option; never touches the Focus buttons;
 *   - red-teams to zero open issues, then releases;
 *   - once a big-ticket goal (an Abilene rung) is on screen, stops the GPU and marketing drip and saves.
 */
export function naiveStep(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  const now = s.stats.timePlayed;

  if (s.activeChoice && readModal(s, mem)) answerFirst(s, a);

  const copyRate = potentialTasksPerSec(s);
  if (copyRate < 8) {
    mem.clickAcc += 0.4;
    while (mem.clickAcc >= 1) {
      mem.clickAcc -= 1;
      a.clickTask(s);
    }
  }

  // The first automation is bought the moment it is affordable, reserve or not.
  if (s.gpus === 0 && s.revealed['compute'] && s.funds >= gpuCost(s)) a.rentGpu(s);

  // The consumable: buy power when it is about to run out (or has), unless the grid does it.
  if (s.stage < 2 && s.revealed['buyPower'] && !s.gridAuto && s.power < Math.max(50, copyRate * 5)) a.buyPower(s);

  if (mem.ticks % NAIVE_PRICE_EVERY === 0) naivePrice(s, a, mem, now);

  const run = s.training.run;
  if (run?.phase === 'redteam') {
    if (canRedTeam(s)) a.redTeam(s);
    if (run.issues === 0 && canRelease(s)) a.release(s);
  }

  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  const reserve = Math.max(s.stage < 2 ? powerBlockCost(s) : 0, heldGoalPrice(s, mem));
  const keepsReserve = (funds: number | undefined) => !funds || s.funds - funds >= reserve;

  // Projects, top to bottom as they appear on screen.
  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (p.id !== 'p_beg_power' && !keepsReserve(p.cost(s).funds)) continue;
    if (p.id === TRANSITION && mem.holdTransition) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  // Training is an upgrade like any other.
  if (!s.training.run && canStartTraining(s) && keepsReserve(trainCost(s).funds)) a.startTraining(s);
  // Trust: lab space when the research on screen does not fit in the lab (the cheapest price, or
  // anything while research sits full), else researchers.
  if (s.revealed['research']) {
    let guard = 0;
    while (s.trust >= 1 && guard++ < 10) {
      const cap = researchCap(s);
      const walled = cheapestResearchCost(s) > cap || (s.research >= cap && largestResearchCost(s) > cap);
      const ok = walled && s.revealed['expandLab'] ? a.expandLab(s) : a.hireResearcher(s);
      if (!ok) break;
    }
  }
  const bigTicket = !!currentRung(s);
  if (!bigTicket && s.stage < 2 && s.revealed['compute']) {
    let guard = 0;
    while (s.funds - gpuCost(s) >= reserve && guard++ < 5 && a.rentGpu(s)) {
      /* buy while affordable */
    }
  }
  if (!bigTicket && s.revealed['marketing'] && s.funds - marketingCost(s) >= reserve) a.buyMarketing(s);
  if (s.stage >= 2 && s.revealed['infrastructure']) infrastructure(s, a);
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
  let best = s.revealed['training'] && !s.training.run ? (trainCost(s).research ?? 0) : 0;
  for (const p of visibleProjects(s)) best = Math.max(best, p.cost(s).research ?? 0);
  return best;
}

function cheapestResearchCost(s: GameState): number {
  let best = Infinity;
  if (s.revealed['training'] && !s.training.run) best = trainCost(s).research ?? Infinity;
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
