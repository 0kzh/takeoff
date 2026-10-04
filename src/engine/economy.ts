import { rng } from './rng.js';
import { GameState, say, canPay, pay, addFunds } from './state.js';
import { trainingShare } from './training.js';

export const TICK_SECONDS = 0.1;
export const MIN_PRICE = 0.01;
export const POWER_BLOCK = 1000;
/** Stage 2+: kW drawn by one powered GPU (a full 10,000-GPU datacenter draws 10 MW). */
export const KW_PER_GPU = 1;
export const DATACENTER_GPUS = 10000;
export const GPU_BATCH = 1000;
export const TURBINE_MW = 100;
export const GRID_MW = 5;

// ---------- costs ----------

/** UP AutoClipper curve: `5 + 1.1^n`, so the first GPU is $6 (→ `1.08^n` after Bulk GPU lease). */
export function gpuCost(s: GameState): number {
  return Math.round((5 + Math.pow(s.gpuCostGrowth, s.gpus)) * 100) / 100;
}

export function marketingCost(s: GameState): number {
  return 100 * Math.pow(2, s.hypeLevel - 1);
}

export function datacenterCost(s: GameState): number {
  return 250000 * Math.pow(1.5, s.datacenters);
}

export function gpuBatchCost(s: GameState): number {
  return Math.round(GPU_BATCH * s.chipPrice * Math.pow(1.04, s.gpuBatches));
}

export function turbineCost(s: GameState): number {
  return Math.round(300000 * Math.pow(1.6, s.turbines));
}

// ---------- research ----------

export function researchCap(s: GameState): number {
  return s.labSpace * 1000 * s.labMult;
}

export function researchRate(s: GameState): number {
  return s.researchers * 10 * s.humanEff * s.researchMult;
}

/** Insight accrues only while research sits at its cap (UP creativity). */
export function insightRate(s: GameState): number {
  return (Math.sqrt(researchRate(s)) / 10) * s.insightMult;
}

// ---------- compute & production ----------

export function gpuCapacity(s: GameState): number {
  return s.datacenters * DATACENTER_GPUS;
}

/** GPUs that have power. Stage 1 buys power by the kWh, so every rented GPU is active. */
export function activeGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return Math.min(s.gpus, Math.floor((s.powerCapacityMW * 1000) / KW_PER_GPU));
}

export function powerDrawMW(s: GameState): number {
  return (activeGpus(s) * KW_PER_GPU) / 1000;
}

export function copies(s: GameState): number {
  return Math.floor(activeGpus(s) * (1 - trainingShare(s)) * s.copiesPerGPU);
}

/** Tasks per second per copy: `capability^0.8 × prompting boosts`. */
export function perCopyRate(s: GameState): number {
  return Math.pow(s.capability, 0.8) * s.copyBoost;
}

export function potentialTasksPerSec(s: GameState): number {
  return copies(s) * (1 - s.researchAlloc) * perCopyRate(s);
}

// ---------- demand & billing (UP §3.3) ----------

export function effectsDemandMult(s: GameState): number {
  let m = 1;
  for (const e of s.effects) m *= e.demandMult;
  return m;
}

/** Falls when a rival ships something better than the deployed model. */
export function qualityMult(s: GameState): number {
  return Math.sqrt(s.capability / s.rivalCapability);
}

export function marketingMult(s: GameState): number {
  return Math.pow(1.1, s.hypeLevel - 1);
}

/**
 * Baseline market for AI agents relative to UP's paperclip market. Part of `boosts`; it
 * compresses UP's 90-minute first stage into ~30 minutes without touching the curve's shape.
 */
export const MARKET_SIZE = 3;

/** `demand = (0.8 / price) × 1.1^(hype−1) × qualityMult × hypeBoost(t) × boosts`; shown ×10 as a percent. */
export function demand(s: GameState): number {
  return (0.8 / s.price) * marketingMult(s) * qualityMult(s) * s.hypeBoost * MARKET_SIZE * s.demandMult * effectsDemandMult(s);
}

export function demandPercent(s: GameState): number {
  return demand(s) * 10;
}

export function expectedSalesPerSec(s: GameState): number {
  const d = demand(s);
  return 10 * Math.min(1, d / 100) * Math.floor(0.7 * Math.pow(d, 1.15));
}

/** Copies complete tasks; in Stage 1 each task burns 1 kWh. */
export function produce(s: GameState, dt: number): void {
  const rate = potentialTasksPerSec(s);
  if (rate <= 0) return;
  s.taskFrac += rate * dt;
  let made = Math.floor(s.taskFrac);
  if (made <= 0) return;
  if (s.stage < 2) {
    if (s.power < made) made = Math.floor(s.power);
    if (made <= 0) {
      s.taskFrac = 0;
      if (!s.flags['powerOut']) {
        s.flags['powerOut'] = true;
        say(s, 'Power exhausted — copies idle.');
      }
      return;
    }
    s.power -= made;
  }
  s.taskFrac -= made;
  completeTasks(s, made);
}

function completeTasks(s: GameState, n: number): void {
  s.tasks += n;
  s.unbilled += n;
}

function bill(s: GameState, n: number): void {
  if (n <= 0) return;
  const revenue = Math.floor(n * s.price * 1000) / 1000;
  s.unbilled -= n;
  s.tasksSold += n;
  s.funds = Math.floor((s.funds + revenue) * 100) / 100;
  s.totalRevenue += revenue;
  s.stats.secRevenue += revenue;
  s.stats.secSold += n;
}

/** Every 100 ms: `if rand < demand/100, bill floor(0.7 × demand^1.15)` tasks, capped by unbilled. */
export function sell(s: GameState): void {
  const d = demand(s);
  if (rng(s) >= d / 100) return;
  if (s.unbilled <= 0) return;
  const n = Math.min(s.unbilled, Math.floor(0.7 * Math.pow(d, 1.15)));
  bill(s, n);
}

// ---------- power (Stage 1, UP wire) ----------

export function autoBuyPower(s: GameState): void {
  if (!s.gridAuto || s.stage >= 2) return;
  const need = Math.max(1, potentialTasksPerSec(s) * TICK_SECONDS * 2);
  let guard = 0;
  while (s.power < need && s.funds >= s.powerPrice && guard++ < 20) purchasePower(s);
}

/** Random walk every second, drifting 2% toward a base that rises 0.1% per purchase; clamp [14, 32]. */
export function powerPriceWalk(s: GameState): void {
  s.powerPrice += (rng(s) * 2 - 1) * 0.5;
  s.powerPrice += (s.powerBase - s.powerPrice) * 0.02;
  s.powerPrice = Math.min(32, Math.max(14, s.powerPrice));
  s.powerPrice = Math.round(s.powerPrice * 100) / 100;
}

function purchasePower(s: GameState): void {
  s.funds = Math.round((s.funds - s.powerPrice) * 100) / 100;
  s.power += POWER_BLOCK;
  s.powerBought += 1;
  s.powerBase *= 1.001;
  s.flags['powerOut'] = false;
}

// ---------- trust & research ----------

/** Fibonacci milestones on Tasks: 3,000, 5,000, 8,000, 13,000 … */
export function trustCheck(s: GameState): void {
  while (s.tasks >= s.nextTrust) {
    s.trust += 1;
    s.nextTrust = s.fib2 * 1000;
    const next = s.fib1 + s.fib2;
    s.fib1 = s.fib2;
    s.fib2 = next;
    s.flags['trustMilestones'] = ((s.flags['trustMilestones'] as number) || 0) + 1;
    say(s, 'Milestone reached: TRUST INCREASED');
  }
}

export function researchTick(s: GameState, dt: number): void {
  if (!s.revealed['research']) return;
  const cap = researchCap(s);
  if (s.research < cap) {
    s.research = Math.min(cap, s.research + researchRate(s) * dt);
  }
  if (s.research >= cap) {
    s.flags['hitCap'] = true;
    if (s.insightUnlocked) s.insight += insightRate(s) * dt;
    if (!s.flags['atCap']) {
      s.flags['atCap'] = true;
      if (s.insightUnlocked) say(s, 'Research at capacity — insight accrues.');
    }
  } else {
    s.flags['atCap'] = false;
  }
}

// ---------- player verbs ----------

/** Always works. With nothing unsold, the customer pays for the click at once. */
export function clickTask(s: GameState): boolean {
  const payNow = s.stage === 1 && s.unbilled <= 0;
  completeTasks(s, 1);
  if (payNow) bill(s, 1);
  s.flags['clicks'] = ((s.flags['clicks'] as number) || 0) + 1;
  return true;
}

export function buyPower(s: GameState): boolean {
  if (s.stage >= 2 || !s.revealed['buyPower'] || s.funds < s.powerPrice) return false;
  purchasePower(s);
  return true;
}

export function rentGpu(s: GameState): boolean {
  if (s.stage >= 2 || !s.revealed['compute']) return false;
  const cost = gpuCost(s);
  if (s.funds < cost) return false;
  s.funds = Math.round((s.funds - cost) * 100) / 100;
  s.gpus += 1;
  return true;
}

export function lowerPrice(s: GameState): boolean {
  if (!s.revealed['pricing'] || s.price <= MIN_PRICE + 1e-9) return false;
  s.price = Math.max(MIN_PRICE, Math.round((s.price - 0.01) * 100) / 100);
  return true;
}

export function raisePrice(s: GameState): boolean {
  if (!s.revealed['pricing']) return false;
  s.price = Math.round((s.price + 0.01) * 100) / 100;
  s.priceRaises += 1;
  return true;
}

export function buyMarketing(s: GameState): boolean {
  if (!s.revealed['marketing']) return false;
  const cost = marketingCost(s);
  if (s.funds < cost) return false;
  s.funds = Math.round((s.funds - cost) * 100) / 100;
  s.hypeLevel += 1;
  return true;
}

export function hireResearcher(s: GameState): boolean {
  if (!s.revealed['research'] || !s.revealed['hireResearcher'] || !canPay(s, { trust: 1 })) return false;
  pay(s, { trust: 1 });
  s.researchers += 1;
  return true;
}

export function expandLab(s: GameState): boolean {
  if (!s.revealed['research'] || !s.revealed['expandLab'] || !canPay(s, { trust: 1 })) return false;
  pay(s, { trust: 1 });
  s.labSpace += 1;
  return true;
}

export function toggleGrid(s: GameState): boolean {
  if (!s.revealed['gridContract'] || s.stage >= 2) return false;
  s.gridAuto = !s.gridAuto;
  return true;
}

export function buildDatacenter(s: GameState): boolean {
  if (!s.revealed['infrastructure']) return false;
  const cost = datacenterCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.datacenters += 1;
  say(s, `Datacenter ${s.datacenters} complete. Room for ${(gpuCapacity(s)).toLocaleString('en-US')} GPUs.`);
  return true;
}

export function buyGpuBatch(s: GameState): boolean {
  if (!s.revealed['infrastructure']) return false;
  const cost = gpuBatchCost(s);
  if (s.funds < cost || s.gpus + GPU_BATCH > gpuCapacity(s)) return false;
  addFunds(s, -cost);
  s.gpus += GPU_BATCH;
  s.gpuBatches += 1;
  if (s.gpuBatches === 1) say(s, '1,000 Nimbus G4s racked.');
  return true;
}

export function buyTurbines(s: GameState): boolean {
  if (!s.revealed['infrastructure']) return false;
  const cost = turbineCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.turbines += 1;
  s.powerCapacityMW += TURBINE_MW;
  say(s, `Gas turbines online. +${TURBINE_MW} MW.`);
  return true;
}

// ---------- bookkeeping ----------

/** One-second bookkeeping: 10 s moving averages for the readouts. */
export function averages(s: GameState): void {
  const st = s.stats;
  const made = s.tasks - st.lastTasks;
  st.lastTasks = s.tasks;
  push10(st.taskHist, made);
  push10(st.revHist, st.secRevenue);
  push10(st.soldHist, st.secSold);
  st.secRevenue = 0;
  st.secSold = 0;
  st.tasksPerSec = mean(st.taskHist);
  st.revPerSec = mean(st.revHist);
  st.soldPerSec = mean(st.soldHist);
  if (st.tasksPerSec > st.peakTasksPerSec) st.peakTasksPerSec = st.tasksPerSec;
}

function push10(arr: number[], v: number): void {
  arr.push(v);
  if (arr.length > 10) arr.shift();
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let t = 0;
  for (const v of arr) t += v;
  return t / arr.length;
}

/** After a release `hypeBoost` starts at 2.0 and decays toward 1 with a 180 s half-life. */
export function decayHype(s: GameState, dt: number): void {
  if (s.hypeBoost > 1) {
    s.hypeBoost = 1 + (s.hypeBoost - 1) * Math.pow(0.5, dt / 180);
    if (s.hypeBoost < 1.001) s.hypeBoost = 1;
  }
}

export function decayEffects(s: GameState, dt: number): void {
  if (s.effects.length === 0) return;
  for (const e of s.effects) e.remaining -= dt;
  s.effects = s.effects.filter((e) => e.remaining > 0);
}

/** The console names the bottleneck when it bites (at most once per 90 s each). */
export function bottleneckMessages(s: GameState): void {
  const now = s.stats.timePlayed;
  const ready = (key: string) => now - ((s.flags[key] as number) ?? -999) > 90;
  const tps = s.stats.tasksPerSec;
  const sold = Math.max(0.5, s.stats.soldPerSec);
  if (s.revealed['business'] && s.unbilled > 500 && s.unbilled > 30 * sold && tps > sold * 1.5 && ready('saturatedAt')) {
    s.flags['saturatedAt'] = now;
    say(s, 'Demand saturated — lower the price or market.');
  }
  if (s.stage < 2 && s.gpus > 0 && s.power < 1 && s.funds < s.powerPrice && ready('brokeAt')) {
    s.flags['brokeAt'] = now;
    say(s, 'Funds exhausted — power cannot be bought.');
  }
  if (s.revealed['research'] && !s.insightUnlocked && s.research >= researchCap(s) && ready('capAt')) {
    s.flags['capAt'] = now;
    say(s, 'Research at capacity. Lab space is full.');
  }
  if (s.stage >= 2 && s.gpus > activeGpus(s) && ready('mwAt')) {
    s.flags['mwAt'] = now;
    say(s, `Power-limited — ${Math.round((100 * activeGpus(s)) / s.gpus)}% of GPUs active.`);
  }
}
