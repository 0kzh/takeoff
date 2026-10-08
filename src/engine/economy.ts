import { rng } from './rng.js';
import { GameState, Cost, say, canPay, pay, bump, counter, addFunds, inPrologue, isBought } from './state.js';
import { fmtMoneyShort, fmtInt, fmtMw } from './format.js';
import { mechanicClear } from './stages.js';

export const TICK_SECONDS = 0.1;
export const MIN_PRICE = 0.01;
export const POWER_BLOCK = 1000;
export const GRID_KW_PER_GPU = 1;
export const GRID_STEP = 10;
export const GRID_FIRST_TIER = 10000;
export const GRID_FIRST_COST = 200;
export const GRID_COST_PER_KW = 3;
export const POWER_INFLATION = 1.001;
export const GRID_OFFER_GPUS = 20;
export const GRID_OFFER_SECONDS = 15;
export const DATACENTER_GPUS = 10000;
export const ARRIVAL_GPUS = 1000;
export const GPU_BATCH = 1000;
export const CHIP_PRICE = 100;
export const GPU_BATCH_GROWTH = 1.05;
export const CHIP_MULT = [0, 1, 4, 16];
export const CHIP_PRICE_MULT = [0, 1, 3, 10];
export const CHIP_NAMES = ['', 'Nimbus G4', 'Nimbus G5', 'Nimbus G6'];
export const DATACENTER_GROWTH_S2 = 2.2;
export const GRID_COST_PER_KW_S2 = 100;
export const SECURITY_BASE_COST = 5000000;
export const SECURITY_COST_GROWTH = 8;
export const SECURITY_RESEARCH_TAX = 0.03;
export const SECURITY_MAX = 4;
export const ADOPTION_EXPONENT = 0.35;
export const AI_RESEARCH_BASE = 2;
export const AI_INSIGHT_SHARE = 0.01;

export function chipMult(s: GameState): number {
  return CHIP_MULT[s.chipGen] ?? 1;
}

export function chipName(s: GameState): string {
  return CHIP_NAMES[s.chipGen] ?? CHIP_NAMES[1]!;
}

export function dcRoom(s: GameState): number {
  return DATACENTER_GPUS * Math.pow(10, Math.max(0, s.dcTier - 1));
}

export function batchSize(s: GameState): number {
  return GPU_BATCH * Math.pow(10, Math.max(0, s.dcTier - 1));
}

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
  return Math.round(250000 * Math.pow(s.stage >= 2 ? DATACENTER_GROWTH_S2 : 1.5, s.datacenters));
}

export const GPU_BLOCK_MIN = 100;

export function gpuUnitPrice(s: GameState): number {
  return CHIP_PRICE * (CHIP_PRICE_MULT[s.chipGen] ?? 1) * Math.pow(GPU_BATCH_GROWTH, s.gpuBatches);
}

// Like Stage 1's power block: when the full batch is out of reach, a tenth of it
// is offered at the same price per GPU, so there is nearly always a buy on screen.
export function poweredRoom(s: GameState): number {
  return Math.max(0, Math.min(gpuCapacity(s), Math.floor(s.gridCapacity / GRID_KW_PER_GPU)) - s.gpus);
}

export function gpuBlock(s: GameState): number {
  let block = batchSize(s);
  const room = poweredRoom(s);
  while (block > GPU_BLOCK_MIN && (s.funds < block * gpuUnitPrice(s) || block > room)) block /= 10;
  return block;
}

export function gpuBatchCost(s: GameState): number {
  return Math.round(gpuBlock(s) * gpuUnitPrice(s));
}

export function securityCost(s: GameState): number {
  return SECURITY_BASE_COST * Math.pow(SECURITY_COST_GROWTH, Math.max(0, s.security - 1));
}

export function securityTax(s: GameState): number {
  return 1 - SECURITY_RESEARCH_TAX * Math.max(0, s.security - 1);
}

export function theftOdds(s: GameState): number {
  return [0.9, 0.9, 0.5, 0.25, 0.1][Math.min(SECURITY_MAX, Math.max(1, s.security))] ?? 0.1;
}

export const GRID_STEP_MIN_S2 = 10000;
export const GRID_STEP_SHARE_S2 = 0.25;

// Stage 2 grows the grid in steps (10 MW, later a quarter of capacity) priced per
// kW added, so the grid is a steady repeatable buy rather than a ×10 cliff.
export function gridStep(s: GameState): number {
  if (s.stage < 2) return s.gridCapacity * (GRID_STEP - 1);
  const share = s.gridCapacity * GRID_STEP_SHARE_S2;
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, share))) - 1));
  return Math.max(GRID_STEP_MIN_S2, Math.round(share / unit) * unit);
}

export function nextGridCapacity(s: GameState): number {
  return s.gridCapacity + gridStep(s);
}

export function gridUpgradeCost(s: GameState): number {
  const next = nextGridCapacity(s);
  if (s.stage >= 2) return Math.round(GRID_COST_PER_KW_S2 * gridStep(s) * (s.flags['ppa'] ? 0.7 : 1));
  return next <= GRID_FIRST_TIER ? GRID_FIRST_COST : GRID_COST_PER_KW * next;
}

export function gridOutgrown(s: GameState): boolean {
  return s.gpus >= GRID_OFFER_GPUS && powerDrawPerSec(s) * GRID_OFFER_SECONDS >= s.gridCapacity;
}

export function canExpandGrid(s: GameState): boolean {
  return s.revealed['gridCapacity'] === true && (s.stage >= 2 || !s.gridAuto);
}

export function fleetPowerBlock(s: GameState): number {
  return s.gridCapacity;
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

export function powerDrawPerSec(s: GameState): number {
  return s.stage < 2 ? potentialTasksPerSec(s) : activeGpus(s) * GRID_KW_PER_GPU;
}

export function powerBillPerSec(s: GameState): number {
  return (powerDrawPerSec(s) * s.powerPrice) / 1000;
}

export function powerSecondsLeft(s: GameState): number {
  const draw = copiesIdle(s) ? 0 : powerDrawPerSec(s);
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

export function humanResearchRate(s: GameState): number {
  return s.researchers * 10 * humanEfficiency(s) * s.researchMult * securityTax(s);
}

export function aiResearchRate(s: GameState): number {
  if (s.stage < 2 || !isBought(s, 's2_ai_rd')) return 0;
  const c = bestCapability(s);
  return AI_RESEARCH_BASE * Math.pow(c, 1.5) * (1 + Math.log10(Math.max(1, copies(s) / 1000))) * s.researchMult;
}

export function researchRate(s: GameState): number {
  return humanResearchRate(s) + aiResearchRate(s);
}

export function humanResearchShare(s: GameState): number {
  const total = researchRate(s);
  return total > 0 ? humanResearchRate(s) / total : 1;
}

export function insightRate(s: GameState): number {
  return (Math.sqrt(humanResearchRate(s)) / 10) * s.insightMult;
}

export function aiInsightRate(s: GameState): number {
  return aiResearchRate(s) * AI_INSIGHT_SHARE * s.insightMult;
}

export function gpuCapacity(s: GameState): number {
  return s.datacenters * dcRoom(s);
}

export function activeGpus(s: GameState): number {
  return Math.min(s.gpus, Math.floor(s.gridCapacity / GRID_KW_PER_GPU));
}

// A training run needs the fleet to be big enough, but it does not take GPUs
// away from customers: every powered GPU keeps serving while a run trains.
export function servingGpus(s: GameState): number {
  return activeGpus(s);
}

export function servingCompute(s: GameState): number {
  return servingGpus(s) * chipMult(s);
}

export function copies(s: GameState): number {
  if (inPrologue(s)) return 0;
  return Math.floor(servingCompute(s) * s.copiesPerGPU);
}

export function adoption(s: GameState): number {
  if (s.stage < 2) return 1;
  return Math.max(1, Math.pow(servingCompute(s) / 1000, ADOPTION_EXPONENT));
}

export function idleCopies(s: GameState): number {
  const all = copies(s);
  if (all <= 0) return 0;
  const rate = perCopyRate(s);
  const needed = rate > 0 ? expectedSalesPerSec(s) / rate : all;
  return Math.max(0, Math.floor(all - needed));
}

export function perCopyRate(s: GameState): number {
  return Math.pow(s.capability, 0.8) * s.copyBoost;
}

export function potentialTasksPerSec(s: GameState): number {
  return copies(s) * perCopyRate(s);
}

export function copiesIdle(s: GameState): boolean {
  if (copies(s) <= 0 || s.gridAuto) return false;
  return s.stage < 2 ? s.power < 1 : s.power < powerDrawPerSec(s) * TICK_SECONDS;
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
  return (0.8 / p) * marketingMult(s) * qualityMult(s) * s.hypeBoost * marketSize(s) * s.demandMult * effectsDemandMult(s) * (1 + contractDemand(s)) * adoption(s);
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
  if (s.stage >= 2) {
    const draw = powerDrawPerSec(s) * dt;
    if (s.gridAuto) billPower(s, draw);
    else if (s.power < draw) return powerOut(s);
    else s.power -= draw;
  }
  s.taskFrac += rate * dt;
  let made = Math.floor(s.taskFrac);
  if (made <= 0) return;
  if (s.stage < 2) {
    if (s.gridAuto) billPower(s, made);
    else {
      if (s.power < made) made = Math.floor(s.power);
      if (made <= 0) return powerOut(s);
      s.power -= made;
    }
  }
  s.taskFrac -= made;
  completeTasks(s, made);
}

function billPower(s: GameState, kwh: number): void {
  const stored = Math.min(s.power, kwh);
  s.power -= stored;
  const billed = kwh - stored;
  s.funds = Math.max(0, s.funds - (billed * s.powerPrice) / 1000);
  if (s.stage < 2) s.powerBase *= Math.pow(POWER_INFLATION, billed / GRID_FIRST_TIER);
}

function powerOut(s: GameState): void {
  s.taskFrac = 0;
  if (s.flags['powerOut']) return;
  s.flags['powerOut'] = true;
  say(s, 'Power is out. The copies have stopped. Buy Power starts them.');
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

export function revenueShareActive(s: GameState): boolean {
  const until = s.flags['revenueShareUntil'];
  return typeof until === 'number' && s.stats.timePlayed < until;
}

function bill(s: GameState, n: number): void {
  const gross = n * s.price;
  const revenue = revenueShareActive(s) ? gross * 0.8 : gross;
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

export function powerPriceWalk(s: GameState): void {
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
  if (s.stage < 2) s.powerBase *= POWER_INFLATION;
  s.flags['powerOut'] = false;
}

export function trackStuck(s: GameState, dt: number): void {
  const stuck = s.stage < 2 && !s.gridAuto && s.power < 1 && s.funds < powerBlockCost(s);
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
    // From Stage 2 the milestone line only prints when Trust was spent down or every third time,
    // so an unspent balance does not repeat the same sentence.
    if (s.stage >= 2 && s.trust > 1 && ((s.flags['trustMilestones'] as number) || 0) % 3 !== 0) continue;
    const line = s.revealed['research'] ? (s.stage >= 2 && s.trust > 1 ? `Trust ${fmtInt(s.trust)} unspent. Hire a researcher or expand the lab.` : trustRewardLine(s)) : '';
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
  return 'Trust +1. It pays for the next researcher or lab space.';
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
  if (s.insightUnlocked && s.stage >= 2) s.insight += aiInsightRate(s) * dt;
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
  if (!s.revealed['buyPower'] || s.gridAuto || s.funds < powerBlockCost(s)) return false;
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

export const HIRE_BASE = 40;
export const HIRE_GROWTH = 1.5;
export const LAB_BASE = 50;
export const LAB_GROWTH = 1.6;
const STARTING_RESEARCHERS = 1;

/** A researcher costs money from the start; a Trust, when the lab holds one, pays instead. */
export function hireCost(s: GameState): Cost {
  if (s.trust >= 1) return { trust: 1 };
  return { funds: Math.round(HIRE_BASE * Math.pow(HIRE_GROWTH, Math.max(0, s.researchers - STARTING_RESEARCHERS))) };
}

export function labCost(s: GameState): Cost {
  if (s.trust >= 1) return { trust: 1 };
  return { funds: Math.round(LAB_BASE * Math.pow(LAB_GROWTH, Math.max(0, s.labSpace - 1))) };
}

export function canHireResearcher(s: GameState): boolean {
  return s.revealed['research'] === true && s.revealed['hireResearcher'] === true && canPay(s, hireCost(s));
}

export function canExpandLab(s: GameState): boolean {
  return s.revealed['research'] === true && s.revealed['expandLab'] === true && canPay(s, labCost(s));
}

export function hireResearcher(s: GameState): boolean {
  if (!canHireResearcher(s)) return false;
  pay(s, hireCost(s));
  s.researchers += 1;
  return true;
}

export function expandLab(s: GameState): boolean {
  if (!canExpandLab(s)) return false;
  pay(s, labCost(s));
  s.labSpace += 1;
  return true;
}

export function buildDatacenter(s: GameState): boolean {
  if (!s.revealed['infrastructure']) return false;
  const cost = datacenterCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.datacenters += 1;
  bump(s, 'datacentersBuilt');
  say(s, `Datacenter ${s.datacenters} complete. Room for ${fmtInt(gpuCapacity(s))} GPUs.`);
  return true;
}

export function canBuyGpuBatch(s: GameState): boolean {
  return s.revealed['infrastructure'] === true && gpuBlock(s) <= poweredRoom(s);
}

export function gpuBlockReason(s: GameState): string {
  if (s.gpus >= gpuCapacity(s)) return 'The datacenters are full. Build another first.';
  if (s.gpus >= Math.floor(s.gridCapacity / GRID_KW_PER_GPU)) return 'The grid is full. Expand Grid first, or the new GPUs sit dark.';
  return '';
}

export function buyGpuBatch(s: GameState): boolean {
  if (!canBuyGpuBatch(s)) return false;
  // Size the block before paying: gpuBlock reads funds, and paying would shrink it tenfold.
  const batch = gpuBlock(s);
  const cost = gpuBatchCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.gpus += batch;
  s.gpuBatches += batch / batchSize(s);
  if (s.gpuBatches === 1) say(s, `${fmtInt(batch)} ${chipName(s)}s racked. The hall is ${Math.round((100 * s.gpus) / gpuCapacity(s))}% full.`);
  if (!s.revealed['reach'] && s.stage >= 2) {
    s.revealed['reach'] = true;
    say(s, 'More copies in the world: more customers find Sage. Reach grows with the fleet.');
  }
  return true;
}

export function canUpgradeSecurity(s: GameState): boolean {
  return s.revealed['security'] === true && s.security < SECURITY_MAX;
}

export function upgradeSecurity(s: GameState): boolean {
  if (!canUpgradeSecurity(s)) return false;
  const cost = securityCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.security += 1;
  const lines = ['', '', 'Badges, logs, and a locked server room. SL2.', 'Air-gapped training clusters and two-person rules. SL3.', 'Weights never leave the enclave. Mo sleeps at the office. SL4.'];
  say(s, lines[s.security] ?? `Security level ${s.security}.`);
  return true;
}

export function expandGrid(s: GameState): boolean {
  if (!canExpandGrid(s)) return false;
  const cost = gridUpgradeCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.gridCapacity = nextGridCapacity(s);
  say(s, `Grid connection expanded. Capacity ${fmtMw(s.gridCapacity)} MW.`);
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
  if (s.stage < 2 && !s.gridAuto && s.gpus > 0 && s.power < 1 && s.funds < powerBlockCost(s) && ready('brokeAt')) {
    s.flags['brokeAt'] = now;
    say(s, 'No power, and no money for more. The cloud provider may extend credit.');
  }
  if (s.gpus > activeGpus(s) && ready('gridAt')) {
    s.flags['gridAt'] = now;
    say(s, `The grid powers ${Math.round((100 * activeGpus(s)) / s.gpus)}% of the GPUs. Expand Grid powers the rest.`);
  }
  if (s.stage >= 2 && s.revealed['infrastructure'] && s.gpus + GPU_BLOCK_MIN > gpuCapacity(s) && s.funds >= gpuBatchCost(s) && ready('fullAt')) {
    s.flags['fullAt'] = now;
    say(s, 'The datacenters are full. Build another before buying more GPUs.');
  }
}

export function labHolds(s: GameState): string {
  return `lab holds ${fmtInt(researchCap(s))}`;
}
