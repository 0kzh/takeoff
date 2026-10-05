import { rng } from './rng.js';
import { GameState, say, canPay, pay, isBought, bump, counter, addFunds, inPrologue } from './state.js';
import { busyGpus } from './training.js';
import { fmtMoneyShort, fmtInt } from './format.js';
import { mechanicClear } from './stages.js';

export const TICK_SECONDS = 0.1;
export const MIN_PRICE = 0.01;
export const POWER_BLOCK = 1000;
export const KW_PER_GPU = 1;
export const DATACENTER_GPUS = 10000;
export const ARRIVAL_GPUS = 1000;
export const GPU_BATCH = 1000;
export const CHIP_PRICE = 40;
export const TURBINE_MW = 100;
export const GRID_MW = 5;

export const MARKET_START = 3;
export const MARKET_FULL = 3;
export const MARKET_GROWTH_TASKS = 1500;

export const CONTRACT_WEIGHT = 0.25;
export const CONTRACT_WEIGHT_GROWTH = 1.15;
export const CONTRACT_PAUSE_SECONDS = 90;

export const RENT_QUOTA = 80;
export const QUOTA_STEP = 20;
const QUOTA_CARDS = ['p_compute_deal', 'p_region', 'p_reserved'];

export function rentQuota(s: GameState): number {
  return RENT_QUOTA + QUOTA_STEP * QUOTA_CARDS.filter((id) => (s.projects[id]?.bought ?? 0) > 0).length;
}

export function atRentQuota(s: GameState): boolean {
  return s.stage < 2 && s.gpus >= rentQuota(s);
}

export function gpuCost(s: GameState): number {
  return Math.round((5 + Math.pow(s.gpuCostGrowth, s.gpus)) * 100) / 100;
}

export function marketingCost(s: GameState): number {
  return 100 * Math.pow(2, s.marketingBought ?? 0);
}

export function datacenterCost(s: GameState): number {
  return 250000 * Math.pow(1.5, s.datacenters);
}

export function gpuBatchCost(s: GameState): number {
  return Math.round(GPU_BATCH * CHIP_PRICE * Math.pow(1.04, s.gpuBatches));
}

export function turbineCost(s: GameState): number {
  return Math.round(300000 * Math.pow(1.6, s.turbines));
}

export function fleetPowerBlock(s: GameState): number {
  if (s.gpus >= 200) return 100000;
  if (s.gpus >= 20) return 10000;
  return POWER_BLOCK;
}

export function powerBlock(s: GameState): number {
  let block = fleetPowerBlock(s);
  while (block > POWER_BLOCK && s.funds < blockPrice(s, block)) block /= 10;
  return block;
}

function blockPrice(s: GameState, block: number): number {
  return Math.round(s.powerPrice * (block / 1000) * 100) / 100;
}

export function powerBlockCost(s: GameState): number {
  return blockPrice(s, powerBlock(s));
}

export function powerBlockNews(s: GameState): void {
  if (s.stage !== 1 || !s.revealed['buyPower'] || (s.gridAuto && isBought(s, 'p_grid'))) return;
  const block = powerBlock(s);
  if (block <= POWER_BLOCK || s.flags[`blockSaid${block}`]) return;
  s.flags[`blockSaid${block}`] = true;
  say(s, `Power can now be bought ${fmtInt(block)} kWh at a time.`);
}

export function powerSecondsLeft(s: GameState): number {
  const draw = copiesIdle(s) ? 0 : potentialTasksPerSec(s);
  return draw > 0 ? s.power / draw : Infinity;
}

export const PRICE_CEILING_MULT = 20;

export function priceCeiling(s: GameState): number {
  return Math.max(1, PRICE_CEILING_MULT * autoTarget(s));
}

export function researchCap(s: GameState): number {
  return s.labSpace * 1000 * s.labMult;
}

export function bestCapability(s: GameState): number {
  return Math.max(s.capability, s.training.internalCapability);
}

export function humanEfficiency(s: GameState): number {
  return Math.min(1, 3 / Math.max(1, bestCapability(s)));
}

export function researchRate(s: GameState): number {
  return s.researchers * 10 * humanEfficiency(s) * s.researchMult;
}

export function insightRate(s: GameState): number {
  return (Math.sqrt(researchRate(s)) / 10) * s.insightMult;
}

export function gpuCapacity(s: GameState): number {
  return s.datacenters * DATACENTER_GPUS;
}

export function activeGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return Math.min(s.gpus, Math.floor((s.powerCapacityMW * 1000) / KW_PER_GPU));
}

export function powerDrawMW(s: GameState): number {
  return (activeGpus(s) * KW_PER_GPU) / 1000;
}

export function copies(s: GameState): number {
  if (inPrologue(s)) return 0;
  return Math.floor(Math.max(0, activeGpus(s) - busyGpus(s)) * s.copiesPerGPU);
}

export function perCopyRate(s: GameState): number {
  return Math.pow(s.capability, 0.8) * s.copyBoost;
}

export function potentialTasksPerSec(s: GameState): number {
  return copies(s) * perCopyRate(s);
}

export function copiesIdle(s: GameState): boolean {
  return s.stage < 2 && s.power < 1 && copies(s) > 0;
}

export function productionPerSec(s: GameState): number {
  const fromCopies = copiesIdle(s) ? 0 : potentialTasksPerSec(s);
  return fromCopies + s.stats.clicksPerSec;
}

export function effectsDemandMult(s: GameState): number {
  let m = 1;
  for (const e of s.effects) m *= e.demandMult;
  return m;
}

export function qualityMult(s: GameState): number {
  return Math.sqrt(s.capability / s.rivalCapability);
}

export function marketingMult(s: GameState): number {
  return Math.pow(1.1, s.hypeLevel - 1);
}

export function marketSize(s: GameState): number {
  const grown = Math.min(1, s.tasks / MARKET_GROWTH_TASKS);
  return MARKET_START + (MARKET_FULL - MARKET_START) * grown;
}

export function demand(s: GameState): number {
  return demandAt(s, s.price);
}

export function demandAt(s: GameState, p: number): number {
  return (0.8 / p) * marketingMult(s) * qualityMult(s) * s.hypeBoost * marketSize(s) * s.demandMult * effectsDemandMult(s) * (1 + contractDemand(s));
}

export function demandPercent(s: GameState): number {
  return demand(s) * 10;
}

export function expectedSalesPerSec(s: GameState): number {
  const d = demand(s);
  return 10 * Math.min(1, d / 100) * Math.floor(0.7 * Math.pow(d, 1.15));
}

function smoothSalesAt(s: GameState, p: number): number {
  const d = demandAt(s, p);
  return 10 * Math.min(1, d / 100) * 0.7 * Math.pow(d, 1.15);
}

export function autoTarget(s: GameState): number {
  const want = Math.max(0.5, productionPerSec(s) + s.unbilled / 30);
  let lo = Math.log(MIN_PRICE);
  let hi = Math.log(50);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (smoothSalesAt(s, Math.exp(mid)) > want) lo = mid;
    else hi = mid;
  }
  return Math.max(MIN_PRICE, Math.exp((lo + hi) / 2));
}

export function priceAbsurd(s: GameState): boolean {
  return expectedSalesPerSec(s) < Math.max(0.5, 0.02 * productionPerSec(s));
}

export function billingPerSec(s: GameState): number {
  const ceiling = expectedSalesPerSec(s);
  const made = productionPerSec(s);
  return s.unbilled >= Math.max(5, made) ? ceiling : Math.min(ceiling, made);
}

export type MarketState = 'idle' | 'selling out' | 'backlog growing' | 'backlog shrinking' | 'nobody buys';

export function marketState(s: GameState): MarketState {
  const ceiling = expectedSalesPerSec(s);
  const made = productionPerSec(s);
  if (made <= 0 && s.unbilled < 1) return 'idle';
  if (priceAbsurd(s)) return 'nobody buys';
  if (ceiling < made * 0.97) return 'backlog growing';
  if (s.unbilled > Math.max(20, made * 3)) return 'backlog shrinking';
  return 'selling out';
}

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
        say(s, 'Power is out. The copies have stopped. Buy Power starts them.');
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

export const AUTO_RATE = 0.5;
export const AUTO_MIN_PRICE = 0.001;

export function updateAutoPrice(s: GameState, dt: number): void {
  if (!s.autoPrice) return;
  s.price += (autoTarget(s) - s.price) * Math.min(1, AUTO_RATE * dt);
  s.price = Math.max(AUTO_MIN_PRICE, s.price);
}

export function sell(s: GameState): void {
  const d = demand(s);
  s.saleFrac += Math.min(1, d / 100) * Math.floor(0.7 * Math.pow(d, 1.15));
  const due = Math.min(s.unbilled, Math.floor(s.saleFrac));
  if (s.unbilled <= 0) s.saleFrac = Math.min(s.saleFrac, 1);
  if (due <= 0) return;
  s.saleFrac -= due;
  bill(s, due);
}

function bill(s: GameState, n: number): void {
  const revenue = n * s.price;
  s.unbilled -= n;
  s.tasksSold += n;
  s.funds += revenue;
  s.totalRevenue += revenue;
  s.stats.secRevenue += revenue;
  s.stats.secSold += n;
}

export function contractWeight(s: GameState): number {
  const n = s.projects['p_contract']?.bought ?? 0;
  let w = 0;
  for (let k = 0; k < n; k++) w += CONTRACT_WEIGHT * Math.pow(CONTRACT_WEIGHT_GROWTH, k);
  return w * contractTerms(s);
}

export function contractTerms(s: GameState): number {
  const num = (k: string) => (typeof s.flags[k] === 'number' ? (s.flags[k] as number) : 1);
  return num('contractMult') * num('contractTermsMult');
}

export function contractsPaused(s: GameState): boolean {
  const until = s.flags['contractsPausedUntil'];
  return typeof until === 'number' && s.stats.timePlayed < until;
}

export function contractDemand(s: GameState): number {
  if (contractsPaused(s)) return 0;
  return contractWeight(s);
}

export function nextContractWeight(s: GameState): number {
  return CONTRACT_WEIGHT * Math.pow(CONTRACT_WEIGHT_GROWTH, s.projects['p_contract']?.bought ?? 0) * contractTerms(s);
}

export function contractRate(s: GameState): number {
  const c = contractDemand(s);
  return c > 0 ? (s.stats.revPerSec * c) / (1 + c) : 0;
}

export const GRID_TOP_UP = 0.6;

export function autoBuyPower(s: GameState): void {
  if (!s.gridAuto || s.stage >= 2) return;
  const floor = Math.max(1, GRID_TOP_UP * fleetPowerBlock(s), potentialTasksPerSec(s) * TICK_SECONDS * 2);
  let guard = 0;
  while (s.power < floor && s.funds >= powerBlockCost(s) && guard++ < 20) purchasePower(s);
}

export function powerPriceWalk(s: GameState): void {
  if (s.stage >= 2) return;
  s.powerPrice += (rng(s) * 2 - 1) * 0.5;
  s.powerPrice += (s.powerBase - s.powerPrice) * 0.02;
  s.powerPrice = Math.min(1.6 * s.powerBase, Math.max(0.7 * s.powerBase, s.powerPrice));
  s.powerPrice = Math.round(s.powerPrice * 100) / 100;
}

function purchasePower(s: GameState): void {
  const block = powerBlock(s);
  s.funds = Math.round((s.funds - powerBlockCost(s)) * 100) / 100;
  s.power += block;
  s.powerBought += 1;
  s.powerBase *= 1.001;
  s.flags['powerOut'] = false;
}

export function trackStuck(s: GameState, dt: number): void {
  const stuck = s.stage < 2 && s.power < 1 && s.funds < powerBlockCost(s);
  s.stuckFor = stuck ? s.stuckFor + dt : 0;
}

export function trustCheck(s: GameState): void {
  while (s.tasks >= s.nextTrust) {
    s.trust += 1;
    s.nextTrust = s.fib2 * 1000;
    const next = s.fib1 + s.fib2;
    s.fib1 = s.fib2;
    s.fib2 = next;
    s.flags['trustMilestones'] = ((s.flags['trustMilestones'] as number) || 0) + 1;
    if (expandLabBeat(s)) {
      say(s, `Trust +1. Hire a researcher, or expand the lab: it is full at ${fmtInt(researchCap(s))}.`);
      continue;
    }
    const line = s.revealed['research'] ? trustRewardLine(s) : '';
    if (line) say(s, line);
  }
}

export const EXPAND_LAB_AFTER_PROJECTS = 40;

function expandLabBeat(s: GameState): boolean {
  if (s.revealed['expandLab'] || !s.revealed['projects'] || s.trust < 1) return false;
  const at = s.flags['projectsAt'];
  if (typeof at !== 'number' || s.stats.timePlayed - at < EXPAND_LAB_AFTER_PROJECTS) return false;
  if (s.research < researchCap(s) - 0.5) return false;
  if (!mechanicClear(s)) return false;
  s.revealed['expandLab'] = true;
  return true;
}

export function trustRewardLine(s: GameState): string {
  if (s.trust < 1) return `Trust +1, back to ${s.trust}. Nothing to spend yet.`;
  return s.revealed['expandLab'] ? 'Trust +1. Hire a researcher or expand the lab.' : 'Trust +1. Hire a researcher.';
}

export function researchTick(s: GameState, dt: number): void {
  if (!s.revealed['research']) return;
  const cap = researchCap(s);
  if (s.research < cap) s.research = Math.min(cap, s.research + researchRate(s) * dt);
  if (s.research >= cap) {
    s.flags['hitCap'] = true;
    if (s.insightUnlocked) s.insight += insightRate(s) * dt;
    s.flags['atCap'] = true;
  } else {
    s.flags['atCap'] = false;
  }
}

export function clickTask(s: GameState): boolean {
  const payNow = s.unbilled <= 0;
  completeTasks(s, 1);
  if (payNow) bill(s, 1);
  s.stats.secClicks += 1;
  s.flags['clicks'] = ((s.flags['clicks'] as number) || 0) + 1;
  return true;
}

export function buyPower(s: GameState): boolean {
  if (s.stage >= 2 || !s.revealed['buyPower'] || s.funds < powerBlockCost(s)) return false;
  purchasePower(s);
  s.stats.powerPresses += 1;
  return true;
}

export function rentGpu(s: GameState): boolean {
  if (s.stage >= 2 || !s.revealed['compute'] || atRentQuota(s)) return false;
  const cost = gpuCost(s);
  if (s.funds < cost) return false;
  s.funds = Math.round((s.funds - cost) * 100) / 100;
  s.gpus += 1;
  if (atRentQuota(s) && !s.flags[`quotaSaid${s.gpus}`]) {
    s.flags[`quotaSaid${s.gpus}`] = true;
    say(s, 'The provider has no more GPUs to rent. Owning compute is the way past this.');
  }
  return true;
}

export const PRICE_STEP_FROM = 0.2;
export const PRICE_STEP = 0.05;

export function priceUp(p: number): number {
  if (p < PRICE_STEP_FROM - 1e-9) return Math.round((p + 0.01) * 100) / 100;
  return Math.max(Math.round((p + 0.01) * 100) / 100, Math.round(p * (1 + PRICE_STEP) * 100) / 100);
}

export function priceDown(p: number): number {
  if (p <= PRICE_STEP_FROM + 1e-9) return Math.max(MIN_PRICE, Math.round((p - 0.01) * 100) / 100);
  return Math.max(PRICE_STEP_FROM, Math.min(Math.round((p - 0.01) * 100) / 100, Math.round((p / (1 + PRICE_STEP)) * 100) / 100));
}

function priceMove(s: GameState): void {
  if (counter(s, 'priceMoves') === 0) s.flags['firstPriceMoveAt'] = s.stats.timePlayed;
  bump(s, 'priceMoves');
}

export function lowerPrice(s: GameState): boolean {
  if (!s.revealed['pricing'] || s.autoPrice) return false;
  if (s.price <= MIN_PRICE + 1e-9) return false;
  s.price = priceDown(s.price);
  priceMove(s);
  return true;
}

export function raisePrice(s: GameState): boolean {
  if (!s.revealed['pricing'] || s.autoPrice) return false;
  if (s.price >= priceCeiling(s)) return false;
  s.price = priceUp(s.price);
  s.priceRaises += 1;
  priceMove(s);
  return true;
}

export function buyMarketing(s: GameState): boolean {
  if (!s.revealed['marketing']) return false;
  const cost = marketingCost(s);
  if (s.funds < cost) return false;
  s.funds = Math.round((s.funds - cost) * 100) / 100;
  s.hypeLevel += 1;
  s.marketingBought = (s.marketingBought ?? 0) + 1;
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
  say(s, `Datacenter ${s.datacenters} complete. Room for ${fmtInt(gpuCapacity(s))} GPUs.`);
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

export function averages(s: GameState): void {
  const st = s.stats;
  const made = s.tasks - st.lastTasks;
  st.lastTasks = s.tasks;
  push10(st.taskHist, made);
  push10(st.revHist, st.secRevenue);
  push10(st.soldHist, st.secSold);
  push10(st.clickHist, st.secClicks);
  st.secRevenue = 0;
  st.secSold = 0;
  st.secClicks = 0;
  st.tasksPerSec = mean(st.taskHist);
  st.revPerSec = mean(st.revHist);
  st.soldPerSec = mean(st.soldHist);
  st.clicksPerSec = mean(st.clickHist);
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

export function bottleneckMessages(s: GameState): void {
  const now = s.stats.timePlayed;
  const ready = (key: string) => now - ((s.flags[key] as number) ?? -999) > 90;
  if (s.revealed['pricing'] && s.unbilled > 20 && !s.autoPrice) {
    const made = Math.max(1, productionPerSec(s));
    if (priceAbsurd(s)) {
      if (ready('absurdAt')) {
        s.flags['absurdAt'] = now;
        const sales = expectedSalesPerSec(s);
        say(s, sales < 0.1
          ? `Nobody buys at ${fmtMoneyShort(s.price)}: the copies make ${fmtInt(made)} a second. Lower the price.`
          : `The copies make ${fmtInt(Math.round(made / sales))} times what the market takes at ${fmtMoneyShort(s.price)}. Lower the price.`);
      }
    } else if (s.unbilled < Math.max(5, made) && expectedSalesPerSec(s) > 2 * made && made >= 20 && ready('cheapAt')) {
      s.flags['cheapAt'] = now;
      say(s, `Everything sells at ${fmtMoneyShort(s.price)}; the market would take ${fmtInt(Math.round(expectedSalesPerSec(s) / made))} times as much. Raise the price.`);
    } else if (s.unbilled > 200 && s.unbilled > 30 * made && marketState(s) === 'backlog growing' && ready('saturatedAt')) {
      s.flags['saturatedAt'] = now;
      say(s, `Sage makes more than customers buy at ${fmtMoneyShort(s.price)}. Lower the price${s.revealed['marketing'] ? ' or buy Marketing' : ''}.`);
    }
  }
  if (s.stage < 2 && s.gpus > 0 && s.power < 1 && s.funds < powerBlockCost(s) && ready('brokeAt')) {
    s.flags['brokeAt'] = now;
    say(s, 'No power, and no money for more. The cloud provider may extend credit.');
  }
  if (s.stage >= 2 && s.gpus > activeGpus(s) && ready('mwAt')) {
    s.flags['mwAt'] = now;
    say(s, `Power-limited — ${Math.round((100 * activeGpus(s)) / s.gpus)}% of GPUs active.`);
  }
}

export function labHolds(s: GameState): string {
  return `lab holds ${fmtInt(researchCap(s))}`;
}
