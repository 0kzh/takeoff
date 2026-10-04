import { GameState } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, demandPercent, expectedSalesPerSec, researchCap, researchRate, datacenterCost,
  gpuBatchCost, turbineCost, gpuCapacity, activeGpus, perCopyRate, GPU_BATCH,
} from '../engine/economy.js';
import { trainCost, canRedTeam, canRelease } from '../engine/training.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';

/** Order in which the bot buys visible projects. */
export const PROJECT_PRIORITY = [
  'p_beg_power', 'p_seed', 'p_series_a', 'p_training', 'p_prompting', 'p_insight', 'p_blogpost',
  'p_demo', 'p_workshop', 'p_keynote', 'p_press', 'p_eval_team', 'p_api', 'p_lab_cluster',
  'p_prompting2', 'p_grid', 'p_prompting3', 'p_compute_deal', 'p_pricing', 'p_enterprise', 'p_moe',
  'p_alignment_team', 'p_distributed', 'p_datacenter', 'p_contract',
];

export interface BotMemory {
  ticks: number;
  lastPriceTick: number;
  hireNext: 'researcher' | 'lab';
  /** Ids the bot bought this tick, for the sim's event lines. */
  bought: string[];
}

export function newBotMemory(): BotMemory {
  return { ticks: 0, lastPriceTick: -100, hireNext: 'researcher', bought: [] };
}

/** Fixed answers to every modal (sim policy). */
const CHOICE_POLICY: Record<string, number[]> = {
  c_gamble: [0, 1],
  c_sage2: [0],
  c_rival: [2],
  c_journalist: [0, 1],
  c_customer_email: [0],
};

/**
 * A "reasonable player", one decision pass per 100 ms tick, acting only through `actions`.
 * Clicks until the first GPU, keeps a one-block power reserve, prices to keep demand in a sane
 * band, alternates hiring and lab space, buys projects in priority order, trains
 * Capability/Efficiency alternately, red-teams to zero, releases.
 */
export function botStep(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;

  if (s.activeChoice) answerChoice(s, a);

  if (s.gpus === 0 && mem.ticks % 2 === 0) a.clickTask(s);

  const reserve = s.stage < 2 && s.power < 600 ? s.powerPrice : 0;
  if (s.stage < 2 && s.revealed['buyPower'] && s.power < 300 && !s.gridAuto) a.buyPower(s);

  nudgePrice(s, a, mem);
  buyProjects(s, a, mem, reserve);
  trainingLoop(s, a);
  spendTrust(s, a, mem);

  const savingForDatacenter = isVisible(s, 'p_datacenter') && s.funds < 250000;
  if (s.stage < 2 && s.revealed['compute']) {
    let guard = 0;
    while (gpuWorthIt(s, savingForDatacenter) && s.funds - gpuCost(s) >= reserve && guard++ < 5) a.rentGpu(s);
  }
  if (s.revealed['marketing'] && s.stats.publicReleases >= 1) {
    const cost = marketingCost(s);
    const sensible = !savingForDatacenter && cost <= Math.max(400, s.stats.revPerSec * 240);
    if (s.funds - cost >= reserve && (sensible || cost <= s.funds * 0.15)) a.buyMarketing(s);
  }
  if (s.stage >= 2 && s.revealed['infrastructure']) infrastructure(s, a);
}

/** A GPU is worth renting while it pays for itself within a few minutes (or it is one of the first 25). */
function gpuWorthIt(s: GameState, saving: boolean): boolean {
  const cost = gpuCost(s);
  if (s.gpus < 25 && !saving) return true;
  if (cost <= s.funds * 0.02) return true;
  const marginal = 0.6 * s.price * perCopyRate(s) * s.copiesPerGPU;
  return cost <= marginal * (saving ? 60 : 300);
}

function isVisible(s: GameState, id: string): boolean {
  return visibleProjects(s).some((p) => p.id === id);
}

function answerChoice(s: GameState, a: Actions): void {
  const active = s.activeChoice!;
  const def = choiceById(active.id);
  if (!def) return;
  for (const i of CHOICE_POLICY[active.id] ?? [0]) {
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
  if (!s.revealed['pricing'] || mem.ticks - mem.lastPriceTick < 10) return;
  mem.lastPriceTick = mem.ticks;
  const pct = demandPercent(s);
  const supply = Math.max(s.stats.tasksPerSec, s.gpus === 0 ? 4 : 0);
  const sales = expectedSalesPerSec(s);
  const backlog = s.unbilled;
  if (supply < 12) {
    if (pct > 120 && backlog < 50) a.raisePrice(s);
    else if (pct < 60 || backlog > 200) a.lowerPrice(s);
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
  for (const id of PROJECT_PRIORITY) {
    const def = projectById(id);
    if (!def || !isVisible(s, id) || !def.canAfford(s)) continue;
    const cost = def.cost(s);
    if (cost.funds && s.funds - cost.funds < reserve && id !== 'p_datacenter') continue;
    if (cost.research && savingResearch && id !== 'p_datacenter' && s.research - cost.research < trainResearch) continue;
    if (id === 'p_beg_power' && s.funds >= s.powerPrice) continue;
    if (a.buyProject(s, id)) mem.bought.push(id);
  }
}

function trainingLoop(s: GameState, a: Actions): void {
  if (!s.revealed['training']) return;
  const run = s.training.run;
  if (!run) {
    const savingForDatacenter = isVisible(s, 'p_datacenter');
    if (savingForDatacenter && s.research < (projectById('p_datacenter')!.cost(s).research ?? 0) + (trainCost(s).research ?? 0)) return;
    a.setFocus(s, s.training.runIndex % 2 === 0 ? 'capability' : 'efficiency');
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
    let pick = mem.hireNext;
    if (cap < need) pick = fillTime < 20 ? 'lab' : 'researcher';
    else if (fillTime > 90) pick = 'researcher';
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
