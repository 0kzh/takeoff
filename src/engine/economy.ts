import { rng } from './rng.js';
import { GameState, say, canPay, pay, press, isBought, bump, counter } from './state.js';
import { busyGpus, trainCost } from './training.js';
import { visibleProjects } from './projects.js';
import { fmtMoneyShort, fmtInt } from './format.js';
import { effGpus } from './infrastructure.js';
import { sellS2 } from './market.js';

export {
  activeGpus, effGpus, gpuCapacity, powerDrawMW, KW_PER_GPU, datacenterCost, buildDatacenter, buyGpuBatch, buyTurbines,
} from './infrastructure.js';

export const TICK_SECONDS = 0.1;
export const MIN_PRICE = 0.01;
/** The smallest power block; it grows with the fleet (see `powerBlock`). */
export const POWER_BLOCK = 1000;
/** First Datacenter's grid connection: 5 MW on site when Stage 2 opens. */
export const GRID_MW = 5;

/** Word of mouth: the market starts near half size and fills out as tasks get done. */
/** The market's built full size from the first second (owner feedback 1: every task simply sells; no ramp). */
export const MARKET_START = 3;
export const MARKET_FULL = 3;
export const MARKET_GROWTH_TASKS = 1500;

/**
 * Each Custom model contract is a customer that buys at your price (critic round 2 §5): it adds
 * `15 % × 1.15^k` to demand, so price, hype, marketing and incidents act on it like on the rest of
 * the market. Stage 2 freezes what the contracts were paying into a fixed rate.
 */
export const CONTRACT_WEIGHT = 0.25;
export const CONTRACT_WEIGHT_GROWTH = 1.15;
/** Seconds an incident pauses every contract customer ("The bank pauses its pilot."). */
export const CONTRACT_PAUSE_SECONDS = 90;


// ---------- costs ----------

/**
 * The cloud provider rents OpenMind only so many Nimbus G4s: 80, and 20 more with each of the Bulk
 * GPU lease, the Second cloud region and Reserved capacity (research-priced steps from ~10 to ~24
 * minutes: renting stays a live decision until Break ground).
 */
export const RENT_QUOTA = 80;
export const QUOTA_STEP = 20;
const QUOTA_CARDS = ['p_compute_deal', 'p_region', 'p_reserved'];

export function rentQuota(s: GameState): number {
  return RENT_QUOTA + QUOTA_STEP * QUOTA_CARDS.filter((id) => (s.projects[id]?.bought ?? 0) > 0).length;
}

/** Every G4 the provider will rent is rented: owning compute (Abilene) is the way past it. */
export function atRentQuota(s: GameState): boolean {
  return s.stage < 2 && s.gpus >= rentQuota(s);
}

/** UP AutoClipper curve: `5 + 1.1^n`, so the first GPU is $6 (→ `1.08^n` after Bulk GPU lease). */
export function gpuCost(s: GameState): number {
  return Math.round((5 + Math.pow(s.gpuCostGrowth, s.gpus)) * 100) / 100;
}

export function marketingCost(s: GameState): number {
  return 100 * Math.pow(2, s.hypeLevel - 1);
}

/** The block the fleet warrants: 1,000 kWh, 10,000 at 20 GPUs, 100,000 at 200. */
export function fleetPowerBlock(s: GameState): number {
  if (s.gpus >= 200) return 100000;
  if (s.gpus >= 20) return 10000;
  return POWER_BLOCK;
}

/**
 * What Buy Power sells now: the fleet's block, or — when the money is short — the biggest smaller
 * block the lab can pay for, so growing the fleet never strands a player between block sizes.
 */
export function powerBlock(s: GameState): number {
  let block = fleetPowerBlock(s);
  while (block > POWER_BLOCK && s.funds < blockPrice(s, block)) block /= 10;
  return block;
}

function blockPrice(s: GameState, block: number): number {
  return Math.round(s.powerPrice * (block / 1000) * 100) / 100;
}

/** `powerPrice` is per 1,000 kWh, so a block's price is proportional to its size. */
export function powerBlockCost(s: GameState): number {
  return blockPrice(s, powerBlock(s));
}

// ---------- research ----------

/** Lab space × 1,000 × the lab multipliers. Stage 3 retires the cap (stage3.md §1.1). */
export function researchCap(s: GameState): number {
  if (s.stage >= 3) return Infinity;
  return s.labSpace * 1000 * s.labMult;
}

/** The best model OpenMind has, deployed or internal: what research and the jobs model use. */
export function bestCapability(s: GameState): number {
  return Math.max(s.capability, s.training.internalCapability);
}

/** `min(1, 3 / best)`: the model starts to out-think the people who train it (1 through Stage 1). */
export function humanEfficiency(s: GameState): number {
  return Math.min(1, 3 / Math.max(1, bestCapability(s)));
}

/** Research multiplier from crises (a lock-down, the Bureau, a subpoena). */
export function researchEffects(s: GameState): number {
  let m = 1;
  for (const e of s.effects) if (e.researchMult !== undefined) m *= e.researchMult;
  return m;
}

export function humanResearchRate(s: GameState): number {
  return s.researchers * 10 * humanEfficiency(s) * s.researchMult * researchEffects(s);
}

/**
 * Copies on research: `10 × √(copies × allocation) × best^1.5` once AI research assistants exist
 * (stage2.md §2.4 has 8; §9.5's knob for research that binds too long in minutes 12–24).
 */
export const AI_RESEARCH_COEFF = 10;

export function aiResearchRate(s: GameState): number {
  if (s.stage < 2 || !isBought(s, 'p_ai_assistants')) return 0;
  const onResearch = copies(s) * s.researchAlloc;
  return AI_RESEARCH_COEFF * Math.sqrt(onResearch) * Math.pow(bestCapability(s), 1.5) * s.aiResearchMult * researchEffects(s);
}

export function researchRate(s: GameState): number {
  return humanResearchRate(s) + aiResearchRate(s);
}

/** `Human share of research: 17%`. */
export function humanShare(s: GameState): number {
  const total = researchRate(s);
  return total > 0 ? humanResearchRate(s) / total : 1;
}

/** Insight accrues while research sits at its cap (UP creativity); from Stage 3, always, at a sixth of that. */
export function insightRate(s: GameState): number {
  if (s.stage >= 3) return (Math.sqrt(researchRate(s)) / 60) * s.insightMult;
  return (Math.sqrt(researchRate(s)) / 10) * s.insightMult;
}

/** Below the cap, insight trickles in at a tenth of the rate once the Research cluster exists. */
export function insightTrickle(s: GameState): number {
  return isBought(s, 'p_research_cluster') ? 0.1 * insightRate(s) : 0;
}

// ---------- compute & production ----------

/** Copies running: compute × copies per GPU, less what a training run diverts. */
export function copies(s: GameState): number {
  // GPUs a run holds while it trains serve no tasks; the rest keep serving (owner feedback U1).
  return Math.floor(Math.max(0, effGpus(s) - busyGpus(s)) * s.copiesPerGPU);
}

/** Tasks per second per copy: `capability^0.8 × prompting boosts`. */
export function perCopyRate(s: GameState): number {
  return Math.pow(s.capability, 0.8) * s.copyBoost;
}

/** Alignment compute above the 1 % baseline comes out of the copies on tasks (stage2.md §2.11). */
export function alignExtra(s: GameState): number {
  return Math.max(0, s.alignShare - 0.01);
}

/** Share of copies on tasks: what the research slider and alignment compute leave. */
export function taskShare(s: GameState): number {
  return Math.max(0, 1 - s.researchAlloc - alignExtra(s));
}

export function potentialTasksPerSec(s: GameState): number {
  return copies(s) * taskShare(s) * perCopyRate(s);
}

/** Stage 1: copies stop when the power runs out. */
export function copiesIdle(s: GameState): boolean {
  return s.stage < 2 && s.power < 1 && copies(s) > 0;
}

/** What the copies are making right now (zero without power), plus the player's recent clicks. */
export function productionPerSec(s: GameState): number {
  const fromCopies = copiesIdle(s) ? 0 : potentialTasksPerSec(s);
  return fromCopies + s.stats.clicksPerSec;
}

// ---------- demand & billing (UP §3.3) ----------

export function effectsDemandMult(s: GameState): number {
  let m = 1;
  for (const e of s.effects) m *= e.demandMult;
  return m;
}

/** Falls when a rival ships something better than the deployed model (Stage 2: linear, clamped). */
export function qualityMult(s: GameState): number {
  if (s.stage >= 2) return Math.min(1.25, Math.max(0.8, s.capability / Math.max(0.01, s.rivalCapability)));
  return Math.sqrt(s.capability / s.rivalCapability);
}

export function marketingMult(s: GameState): number {
  return Math.pow(1.1, s.hypeLevel - 1);
}

/**
 * Baseline market for AI agents relative to UP's paperclip market. It starts near UP's size, so
 * a player clicking at the opening price sees a backlog build within seconds, and grows with
 * tasks completed until it compresses UP's 90-minute first stage into ~30 minutes.
 */
export function marketSize(s: GameState): number {
  const grown = Math.min(1, s.tasks / MARKET_GROWTH_TASKS);
  return MARKET_START + (MARKET_FULL - MARKET_START) * grown;
}

/** `demand = (0.8 / price) × 1.1^(hype−1) × qualityMult × hypeBoost(t) × boosts × contracts`; shown ×10 as a percent. */
export function demand(s: GameState): number {
  return demandAt(s, s.price);
}

/** Demand at price `p`, everything else as it is now. */
export function demandAt(s: GameState, p: number): number {
  return (0.8 / p) * marketingMult(s) * qualityMult(s) * s.hypeBoost * marketSize(s) * s.demandMult * effectsDemandMult(s) * (1 + contractDemand(s));
}

export function demandPercent(s: GameState): number {
  return demand(s) * 10;
}

/** Tasks per second the market bills at the current price, on average (the billing ceiling). */
export function expectedSalesPerSec(s: GameState): number {
  const d = demand(s);
  return 10 * Math.min(1, d / 100) * Math.floor(0.7 * Math.pow(d, 1.15));
}

/** Expected sales at price `p` (no floor: smooth, for AUTO's search). */
function smoothSalesAt(s: GameState, p: number): number {
  const d = demandAt(s, p);
  return 10 * Math.min(1, d / 100) * 0.7 * Math.pow(d, 1.15);
}

/**
 * Stage 1 AUTO (Dynamic pricing): the price at which the market takes what the copies make plus a
 * thirtieth of the backlog. Sales fall with price, so a bisection on log-price finds it.
 */
export function autoTarget1(s: GameState): number {
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

/** The price is absurd when practically nobody buys: under half a task a second, or 2% of output. */
export function priceAbsurd(s: GameState): boolean {
  return expectedSalesPerSec(s) < Math.max(0.5, 0.02 * productionPerSec(s));
}

/** What the billing line shows: the ceiling while there is a backlog, else what actually sells. */
export function billingPerSec(s: GameState): number {
  const ceiling = expectedSalesPerSec(s);
  const made = productionPerSec(s);
  return s.unbilled >= Math.max(5, made) ? ceiling : Math.min(ceiling, made);
}

export type MarketState = 'idle' | 'selling out' | 'backlog growing' | 'backlog shrinking' | 'nobody buys';

/** One phrase next to the price buttons: what the price is doing to the backlog. */
export function marketState(s: GameState): MarketState {
  const ceiling = expectedSalesPerSec(s);
  const made = productionPerSec(s);
  if (made <= 0 && s.unbilled < 1) return 'idle';
  if (priceAbsurd(s)) return 'nobody buys';
  if (ceiling < made * 0.97) return 'backlog growing';
  if (s.unbilled > Math.max(20, made * 3)) return 'backlog shrinking';
  return 'selling out';
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

/**
 * The first tasks bill at the expected rate, carried as a fraction, so the opening minute (and the
 * first GPU) does not depend on the luck of the roll; after that, UP's lumpy sale roll.
 */
export const SMOOTH_SALES = 200;

/**
 * Every 100 ms. Stage 1: `if rand < demand/100, bill floor(0.7 × demand^1.15)` tasks, capped by
 * unbilled (UP). Stage 2+: the deterministic market (engine/market.ts).
 */
export function sell(s: GameState, dt: number = TICK_SECONDS): void {
  if (s.stage >= 2) {
    sellS2(s, dt);
    return;
  }
  const d = demand(s);
  if (s.tasksSold < SMOOTH_SALES) {
    s.saleFrac += Math.min(1, d / 100) * Math.floor(0.7 * Math.pow(d, 1.15));
    const due = Math.min(s.unbilled, Math.floor(s.saleFrac));
    if (s.unbilled <= 0) s.saleFrac = Math.min(s.saleFrac, 1);
    if (due <= 0) return;
    s.saleFrac -= due;
    bill(s, due);
    return;
  }
  if (rng(s) >= d / 100) return;
  if (s.unbilled <= 0) return;
  const n = Math.min(s.unbilled, Math.floor(0.7 * Math.pow(d, 1.15)));
  if (n <= 0) return;
  bill(s, n);
}

/** Every cent is kept: fractions of a cent accumulate (UP floors per sale; 485 tasks at $0.01 paid $0.38). */
function bill(s: GameState, n: number): void {
  const revenue = n * s.price;
  s.unbilled -= n;
  s.tasksSold += n;
  s.funds += revenue;
  s.totalRevenue += revenue;
  s.stats.secRevenue += revenue;
  s.stats.secSold += n;
}

// ---------- contracts (customers who buy at your price) ----------

/** The contract customers' weight before pauses: Σ `15 % × 1.15^k`, × renewals and the lasting modal terms. */
export function contractWeight(s: GameState): number {
  const n = s.projects['p_contract']?.bought ?? 0;
  let w = 0;
  for (let k = 0; k < n; k++) w += CONTRACT_WEIGHT * Math.pow(CONTRACT_WEIGHT_GROWTH, k);
  return w * contractTerms(s);
}

/** Renewal season ×1.25; a bridge observer ×0.9; a price cut ×0.8 (flags set by projects and choices). */
export function contractTerms(s: GameState): number {
  const num = (k: string) => (typeof s.flags[k] === 'number' ? (s.flags[k] as number) : 1);
  return num('contractMult') * num('contractTermsMult');
}

/** An incident pauses the contract customers for a minute. */
export function contractsPaused(s: GameState): boolean {
  const until = s.flags['contractsPausedUntil'];
  return typeof until === 'number' && s.stats.timePlayed < until;
}

/** Stage 1: the contract customers' share of demand (0 while paused; Stage 2 pays a frozen rate instead). */
export function contractDemand(s: GameState): number {
  if (s.stage >= 2 || contractsPaused(s)) return 0;
  return contractWeight(s);
}

/** What one more contract would add to demand. */
export function nextContractWeight(s: GameState): number {
  return CONTRACT_WEIGHT * Math.pow(CONTRACT_WEIGHT_GROWTH, s.projects['p_contract']?.bought ?? 0) * contractTerms(s);
}

/** Dollars per second from contracts: Stage 1's share of billing, frozen at the Stage 2 arrival. */
export function contractRate(s: GameState): number {
  return s.stage >= 2 ? s.contractIncome : contractRateStage1(s);
}

/** Stage 1: the part of billed revenue the contract customers pay (their share of demand). */
export function contractRateStage1(s: GameState): number {
  const c = s.stage >= 2 ? contractWeight(s) : contractDemand(s);
  return c > 0 ? (s.stats.revPerSec * c) / (1 + c) : 0;
}

/** Stage 2: the job-transition fund's share of revenue while it is on. */
export const JOB_FUND_SHARE = 0.02;

/** Recurring income every tick: Stage 2's frozen contracts, less the job fund (Stage 1's contracts bill as tasks). */
export function payContracts(s: GameState, dt: number): void {
  const rate = s.stage >= 2 ? s.contractIncome : 0;
  if (rate > 0) {
    const amount = rate * dt;
    s.funds = Math.round((s.funds + amount) * 100) / 100;
    s.totalRevenue += amount;
    s.stats.secRevenue += amount;
  }
  if (s.stage >= 2 && s.jobFund) {
    // Two percent of the revenue booked over the last ten seconds, never a fixed fee.
    const fee = JOB_FUND_SHARE * s.stats.revPerSec * dt;
    s.funds = Math.max(0, Math.round((s.funds - fee) * 100) / 100);
  }
}

// ---------- power (Stage 1, UP wire) ----------

/** The Grid Contract tops power up whenever it falls below 60 % of the fleet's block. */
export const GRID_TOP_UP = 0.6;

export function autoBuyPower(s: GameState): void {
  if (!s.gridAuto || s.stage >= 2) return;
  const floor = Math.max(1, GRID_TOP_UP * fleetPowerBlock(s), potentialTasksPerSec(s) * TICK_SECONDS * 2);
  let guard = 0;
  while (s.power < floor && s.funds >= powerBlockCost(s) && guard++ < 20) purchasePower(s);
}

/** Random walk every second, drifting 2% toward a base that rises 0.1% per purchase; clamp [0.7, 1.6] × base ($14–32 at the start). */
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

/** Seconds the copies have had no power and the lab no money to buy more (the credit rescue waits ~3 s). */
export function trackStuck(s: GameState, dt: number): void {
  const stuck = s.stage < 2 && s.power < 1 && s.funds < powerBlockCost(s);
  s.stuckFor = stuck ? s.stuckFor + dt : 0;
}

// ---------- the Abilene site ----------

// ---------- trust & research ----------

/** Fibonacci milestones on Tasks: 2,000, 3,000, 5,000, 8,000, 13,000 … (Trust retires in Stage 3). */
export function trustCheck(s: GameState): void {
  if (s.stage >= 3) return;
  while (s.tasks >= s.nextTrust) {
    s.trust += 1;
    s.nextTrust = s.fib2 * 1000;
    const next = s.fib1 + s.fib2;
    s.fib1 = s.fib2;
    s.fib2 = next;
    s.flags['trustMilestones'] = ((s.flags['trustMilestones'] as number) || 0) + 1;
    // The first milestone opens the Research panel, which prints its own line. From Stage 2 the line
    // prints only when the Trust reaches something new (critic C6).
    const line = s.revealed['research'] ? trustRewardLine(s) : '';
    if (line) say(s, line);
  }
}

/** Milestone lines say what the Trust is for (or that it only paid back what the lab owed). */
export function trustRewardLine(s: GameState): string {
  if (s.stage >= 2) {
    const reach = trustReach(s);
    return reach.length ? `Trust ${s.trust}: ${reach.join(', ')} within reach.` : '';
  }
  if (s.trust < 1) return `Trust +1, back to ${s.trust}. Nothing to spend yet.`;
  return s.revealed['expandLab'] ? 'Trust +1. Hire a researcher or expand the lab.' : 'Trust +1. Hire a researcher.';
}

export function researchTick(s: GameState, dt: number): void {
  if (!s.revealed['research']) return;
  const cap = researchCap(s);
  if (s.research < cap) {
    s.research = Math.min(cap, s.research + researchRate(s) * dt);
  }
  if (s.stage >= 3) {
    s.insight += insightRate(s) * dt;
  } else if (s.research >= cap) {
    s.flags['hitCap'] = true;
    if (s.insightUnlocked) s.insight += insightRate(s) * dt;
    s.flags['atCap'] = true;
  } else {
    if (s.insightUnlocked) s.insight += insightTrickle(s) * dt;
    s.flags['atCap'] = false;
  }
}

// ---------- player verbs ----------

/** The one verb that always works: no power needed, never disabled. */
export function clickTask(s: GameState): boolean {
  // Stage 1 with nothing unsold: the customer pays for the click at once (owner feedback 1, beat 1).
  const payNow = s.stage === 1 && s.unbilled <= 0;
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
  if (s.gpus === 20) say(s, 'Power can now be bought 10,000 kWh at a time.');
  if (atRentQuota(s) && !s.flags[`quotaSaid${s.gpus}`]) {
    s.flags[`quotaSaid${s.gpus}`] = true;
    say(s, 'The provider has no more GPUs to rent. Owning compute is the way past this.');
  }
  return true;
}

/** Below $0.20 the price moves a cent at a time; above, 5 % (critic round 2 §6.4). */
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

/** Stage 1 only, and only by hand (Dynamic pricing hands the price to finance; Stage 2 prices itself). */
/** The price buttons arrive with beat 6 (owner feedback 1): before it, every task sells at $0.25. */
function priceMove(s: GameState): void {
  if (counter(s, 'priceMoves') === 0) s.flags['firstPriceMoveAt'] = s.stats.timePlayed;
  bump(s, 'priceMoves');
}

export function lowerPrice(s: GameState): boolean {
  if (!s.revealed['pricing'] || s.stage >= 2 || s.autoPrice) return false;
  if (s.price <= MIN_PRICE + 1e-9) return false;
  s.price = priceDown(s.price);
  priceMove(s);
  return true;
}

export function raisePrice(s: GameState): boolean {
  if (!s.revealed['pricing'] || s.stage >= 2 || s.autoPrice) return false;
  s.price = priceUp(s.price);
  s.priceRaises += 1;
  priceMove(s);
  return true;
}

/** Kept for old saves and scripts: pricing is never toggled by hand any more (AUTO is a project, then the stage). */
export function toggleAutoPrice(_s: GameState): boolean {
  return false;
}

export function buyMarketing(s: GameState): boolean {
  // Stage 1's money verb; from Stage 2 the market cards widen the market (critic C4: no dead grey box).
  if (!s.revealed['marketing'] || s.stage >= 2) return false;
  const cost = marketingCost(s);
  if (s.funds < cost) return false;
  s.funds = Math.round((s.funds - cost) * 100) / 100;
  s.hypeLevel += 1;
  if (s.stage >= 2) press(s, 'marketing');
  return true;
}

/**
 * What Trust reaches at exactly this count (Stage 2): a Trust-priced card or Security level 3 that
 * costs this much, and Expand Lab while the next run needs more than the lab holds.
 */
export function trustReach(s: GameState): string[] {
  const out: string[] = [];
  if (s.trust >= 1 && s.revealed['expandLab'] && s.trust === 1 && researchWantedOverCap(s)) out.push('Expand Lab');
  for (const p of visibleProjects(s)) {
    const tr = p.cost(s).trust ?? 0;
    if (tr > 0 && tr === s.trust) out.push(p.title);
  }
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && s.trust === 3) out.push('Security level 3');
  return out;
}

function researchWantedOverCap(s: GameState): boolean {
  const want = trainCost(s).research ?? 0;
  return want > researchCap(s);
}

/** Stage 2: once the copies do nine-tenths of the research, a hire is not worth a Trust (critic C6). */
export const HIRE_FADE_SHARE = 0.1;

export function hireFadeCheck(s: GameState): void {
  if (s.stage !== 2 || s.revealed['hireFaded'] || !s.revealed['hireResearcher'] || !isBought(s, 'p_ai_assistants')) return;
  if (humanShare(s) >= HIRE_FADE_SHARE) return;
  s.revealed['hireFaded'] = true;
  say(s, `Human share of research: ${Math.max(1, Math.round(humanShare(s) * 100))}%. Hiring stops; Trust goes to the lab and the capitol.`);
}

export function hireResearcher(s: GameState): boolean {
  if (!s.revealed['research'] || !s.revealed['hireResearcher'] || s.revealed['hireFaded'] || !canPay(s, { trust: 1 })) return false;
  pay(s, { trust: 1 });
  s.researchers += 1;
  if (s.stage >= 2) press(s, 'hire');
  return true;
}

export function expandLab(s: GameState): boolean {
  if (!s.revealed['research'] || !s.revealed['expandLab'] || !canPay(s, { trust: 1 })) return false;
  pay(s, { trust: 1 });
  s.labSpace += 1;
  if (s.stage >= 2) press(s, 'expand');
  return true;
}

export function toggleGrid(s: GameState): boolean {
  if (!s.revealed['gridContract'] || s.stage >= 2) return false;
  s.gridAuto = !s.gridAuto;
  return true;
}

/** The allocation slider: 0–50 % of copies on research, in steps of 5 (stage2.md §2.4). */
/** The slider's floor, in percent. */
export const RESEARCH_ALLOC_MIN = 5;

export function setResearchAlloc(s: GameState, pct: number): boolean {
  if (s.stage < 2 || !s.revealed['allocation'] || !Number.isFinite(pct)) return false;
  // 5–50 %: some copies always help the researchers (at 0 % a lab past its human ceiling stalls).
  const v = Math.min(50, Math.max(RESEARCH_ALLOC_MIN, Math.round(pct / 5) * 5)) / 100;
  if (Math.abs(v - s.researchAlloc) < 1e-9) return false;
  s.researchAlloc = v;
  press(s, 'slider');
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

/**
 * The console names the bottleneck when it bites (each at most once per 90 s), and names the
 * fix: an absurd price is called out with what it costs; a backlog points at the price or marketing.
 * Stage 2 prices itself, so nothing here speaks there.
 */
export function bottleneckMessages(s: GameState): void {
  const now = s.stats.timePlayed;
  const ready = (key: string) => now - ((s.flags[key] as number) ?? -999) > 90;
  if (s.stage >= 2) return;
  // The price advice waits for the price to be on screen (owner feedback 1, beat 6).
  if (s.revealed['pricing'] && s.unbilled > 20 && !s.autoPrice) {
    const made = Math.max(1, productionPerSec(s));
    if (priceAbsurd(s)) {
      if (ready('absurdAt')) {
        s.flags['absurdAt'] = now;
        // True when it prints: the line states the gap it measured (critic round 2 §4.4).
        const sales = expectedSalesPerSec(s);
        say(s, sales < 0.1
          ? `Nobody buys at ${fmtMoneyShort(s.price)}: the copies make ${fmtInt(made)} a second. Lower the price.`
          : `The copies make ${fmtInt(Math.round(made / sales))} times what the market takes at ${fmtMoneyShort(s.price)}. Lower the price.`);
      }
    } else if (s.unbilled < Math.max(5, made) && expectedSalesPerSec(s) > 2 * made && made >= 20 && ready('cheapAt')) {
      // Selling out with the market wanting twice as much: say so, with the number.
      s.flags['cheapAt'] = now;
      say(s, `Everything sells at ${fmtMoneyShort(s.price)}; the market would take ${fmtInt(Math.round(expectedSalesPerSec(s) / made))} times as much. Raise the price.`);
    } else if (s.unbilled > 200 && s.unbilled > 30 * made && marketState(s) === 'backlog growing' && ready('saturatedAt')) {
      s.flags['saturatedAt'] = now;
      say(s, `Sage makes more than customers buy at ${fmtMoneyShort(s.price)}. Lower the price${s.revealed['marketing'] ? ' or buy Marketing' : ''}.`);
    }
  }
  if (s.gpus > 0 && s.power < 1 && s.funds < powerBlockCost(s) && ready('brokeAt')) {
    s.flags['brokeAt'] = now;
    say(s, 'No power, and no money for more. The cloud provider may extend credit.');
  }
}

/** `lab holds 216,000` — the reason line under a greyed Train. */
export function labHolds(s: GameState): string {
  return `lab holds ${fmtInt(researchCap(s))}`;
}
