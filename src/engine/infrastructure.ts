import { GameState, PowerOrder, say, logNews, addFunds, press, isBought, canPay } from './state.js';
import { fmtInt, fmtClock, fmtMoneyShort } from './format.js';
import { trainCost, trainSlotFree, computeYield, runOtherwiseReady } from './training.js';
import { visibleProjects } from './projects.js';
import { choiceById, optionCost } from './events.js';

/**
 * Stage 2 infrastructure (stage2.md §2.1): datacenters give room, plants give power, GPUs arrive
 * in lots that fit both. Owned GPUs always run: a lot is only sold when there is room and power
 * online for it, so the only idle hardware is what a crisis takes offline.
 */

/**
 * Every Stage 2 funds price is quoted at scale 1 and multiplied by this constant, measured from the
 * arrival revenue: `R0 / 650`, where R0 is task revenue (contracts excluded) 30 s after arrival from
 * the Stage 2 preset, median of seeds 1–5 (stage2.md "How to read the numbers", §9.4).
 */
export const S2_FUNDS_SCALE = 2.4;

/** A Stage 2 funds price: scale-1 dollars → dollars on screen. */
export function s2(amount: number): number {
  return Math.round(amount * S2_FUNDS_SCALE);
}

export const KW_PER_GPU = 1;
export const SUBSTATION_MW = 5;
export const GAS_MW = 20;
export const SOLAR_MW = 50;
export const NUCLEAR_MW = 500;
export const GULF_MW = 1000;
export const SOLAR_QUEUE_SECONDS = 180;
export const BTM_QUEUE_SECONDS = 30;
export const REACTOR_SECONDS = 120;
export const GULF_SECONDS = 120;
/** Solar farms in the interconnect queue at once (the one connecting and one behind it). */
export const SOLAR_QUEUE_MAX = 2;
/** A G5 does the work of one and a half G4s. */
export const G5_COMPUTE = 1.5;
export const G4_PRICE = 50;
/** stage2.md: $90; §9.5's knob when minutes 25–30 are too steep. */
export const G5_PRICE = 110;

/** Datacenters, hand-tuned (UP factory style): slots added and scale-1 price. The first is Break ground. */
const DC_TABLE: [number, number][] = [
  [10000, 0],
  // stage2.md has $250k; the second hall is the first room wall and lands by minute ten. A slot costs
  // about a sixth of a GPU (critic C2: the room wall is a short wait, not half the stage).
  [15000, 80000],
  [25000, 160000],
  [50000, 350000],
  [75000, 700000],
  [125000, 1400000],
  [200000, 2600000],
  [300000, 4800000],
  [450000, 9000000],
];

function dcRow(n: number): [number, number] {
  if (n <= DC_TABLE.length) return DC_TABLE[Math.max(1, n) - 1]!;
  const [add, cost] = DC_TABLE[DC_TABLE.length - 1]!;
  const k = n - DC_TABLE.length;
  return [Math.round(add * Math.pow(1.6, k)), Math.round(cost * Math.pow(1.9, k))];
}

/** GPU slots in the first `n` datacenters. */
export function datacenterSlots(n: number): number {
  let total = 0;
  for (let i = 1; i <= n; i++) total += dcRow(i)[0];
  return total;
}

/** Slots: the halls built, plus the part of the one under construction that is finished (a quarter at a time). */
export function gpuCapacity(s: GameState): number {
  return datacenterSlots(s.datacenters) + openedSlots(s);
}

/** A hall opens a quarter at a time as it is built, so the first lots go in before it is done. */
function openedSlots(s: GameState): number {
  const b = s.powerQueue.find((o) => o.kind === 'datacenter');
  if (!b || !b.total) return 0;
  const done = Math.max(0, Math.min(1, 1 - b.remaining / b.total));
  return Math.floor(done * 4) / 4 * dcRow(s.datacenters + 1)[0];
}

/** The next datacenter: its number, the slots it adds and its price. */
export function nextDatacenter(s: GameState): { n: number; add: number; cost: number } {
  const n = s.datacenters + 1;
  const [add, cost] = dcRow(n);
  return { n, add, cost: s2(cost) };
}

export function datacenterCost(s: GameState): number {
  return nextDatacenter(s).cost;
}

// ---------- power ----------

/** Share of capacity a crisis leaves online (curtailment, protest, riots). */
export function powerScale(s: GameState): number {
  let m = 1;
  for (const e of s.effects) if (e.powerMult !== undefined) m *= e.powerMult;
  return m;
}

/** GPUs the plants online can run right now. */
export function poweredGpus(s: GameState): number {
  return Math.floor((s.powerCapacityMW * powerScale(s) * 1000) / KW_PER_GPU);
}

export function activeG5(s: GameState): number {
  return Math.min(s.gpusG5, poweredGpus(s));
}

export function activeG4(s: GameState): number {
  return Math.max(0, Math.min(s.gpus - s.gpusG5, poweredGpus(s) - activeG5(s)));
}

/** GPUs that have power. Stage 1 buys power by the kWh, so every rented GPU is active. */
export function activeGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return activeG4(s) + activeG5(s);
}

/** Compute in G4-equivalents: G5 lots get power first and count one and a half. */
export function effGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return activeG4(s) + G5_COMPUTE * activeG5(s);
}

export function powerDrawMW(s: GameState): number {
  return (activeGpus(s) * KW_PER_GPU) / 1000;
}

/** GPUs the plants online could still power (crises do not count: a lot is bought for good). */
export function freePowerGpus(s: GameState): number {
  return Math.max(0, Math.floor((s.powerCapacityMW * 1000) / KW_PER_GPU) - s.gpus);
}

export function freeSlots(s: GameState): number {
  return Math.max(0, gpuCapacity(s) - s.gpus);
}

// ---------- GPU lots ----------

/**
 * The lots on the Infrastructure panel, side by side (critic C1: the growth verb stays in the player's
 * hands, each with what it returns printed beside it).
 */
export const LOT_SIZES = [1000, 5000, 25000] as const;

/** The smallest lot (the main button, `btn-gpuBatch`). */
export function nominalLot(_s: GameState): number {
  return LOT_SIZES[0];
}

/** A lot of `n` GPUs fits the room and the power there is. */
export function lotFits(s: GameState, n: number): boolean {
  return freeSlots(s) >= n && freePowerGpus(s) >= n;
}

/**
 * What the lot buttons keep in hand: the next run's price when only money is missing (a free slot,
 * its research and data, most of its compute), and an open offer the lab cannot pay yet. The row
 * says so ("the run first — 0:40"); Train now is the other way through (critic C1/C3).
 */
export function lotHold(s: GameState): number {
  return Math.max(runHold(s), offerOnTable(s), wallFix(s)?.price ?? 0, urgentCard(s)?.price ?? 0);
}

/** The run's compute yield from which the lots save for it rather than grow the cluster toward it. */
export const RUN_HOLD_YIELD = 0.7;

function runHold(s: GameState): number {
  return runOtherwiseReady(s) && computeYield(s) >= RUN_HOLD_YIELD ? trainCost(s).funds ?? 0 : 0;
}

/**
 * The cheapest urgent card on screen (a wall's named fix: the research cap, the data wall) whose other
 * costs are in hand: the lots keep its price, or a player who buys GPUs first never reaches it (critic C9).
 */
export function urgentCard(s: GameState): { price: number; title: string } | null {
  let best: { price: number; title: string } | null = null;
  for (const p of visibleProjects(s)) {
    if (p.rescue || p.urgent?.(s) !== true) continue;
    const c = p.cost(s);
    const price = c.funds ?? 0;
    if (price <= 0 || !canPay(s, { ...c, funds: 0 })) continue;
    if (!best || price < best.price) best = { price, title: p.title };
  }
  if (best && best.price > 90 * Math.max(1, s.stats.revPerSec)) return null;
  return best;
}

/**
 * The fix for the wall the lots reach first, while that wall is less than a minute of income away:
 * the cheapest plant for power, the next hall for room. The lots keep its price in hand, so the fix
 * is affordable when the wall arrives and the lots never wait on it (critic C1/C2). A plant already
 * in the queue counts as power to come; a hall being built, as room to come.
 */
export function wallFix(s: GameState): { price: number; what: 'plant' | 'hall' } | null {
  if (s.stage !== 2 || !s.revealed['infrastructure']) return null;
  const reach = (60 * Math.max(0, s.stats.revPerSec)) / gpuUnitPrice(s);
  const power = freePowerGpus(s) + Math.floor((queuedMW(s) * 1000) / KW_PER_GPU);
  const room = datacenterBuilding(s) ? Infinity : freeSlots(s);
  if (Math.min(power, room) >= reach) return null;
  let fix: { price: number; what: 'plant' | 'hall' } | null = null;
  if (room <= power) {
    if (s.revealed['dcButton']) fix = { price: datacenterCost(s), what: 'hall' };
  } else {
    const prices: number[] = [];
    if (s.revealed['gasButton']) prices.push(gasCost(s));
    if (s.revealed['solarButton'] && !solarQueueFull(s)) prices.push(solarCost(s));
    if (prices.length) fix = { price: Math.min(...prices), what: 'plant' };
  }
  // A fix more than two minutes of income away is the player's to save for, not the lots'.
  if (fix && fix.price > 120 * Math.max(1, s.stats.revPerSec)) return null;
  return fix;
}

/** The reason a lot of `n` waits on the hold ('' when it does not; the main lot needs 100 GPUs' worth). */
export function lotHoldReason(s: GameState, n: number): string {
  const hold = lotHold(s);
  const need = n === LOT_SIZES[0] ? lotCostOf(s, 100) : lotCostOf(s, n);
  if (hold <= 0 || s.funds - need >= hold) return '';
  const eta = (hold + need - s.funds) / Math.max(1, s.stats.revPerSec);
  const what = holdName(s, hold);
  return eta < 600 ? `${what} — ${fmtClock(eta)}` : what;
}

function holdName(s: GameState, hold: number): string {
  if (runHold(s) >= hold) return 'the run first';
  if (offerOnTable(s) >= hold) return 'the offer first';
  const card = urgentCard(s);
  if (card && card.price >= hold) return `${card.title} first`;
  return wallFix(s)?.what === 'hall' ? 'the hall first' : 'the plant first';
}

/** The main lot's note while something is held: `$840k kept for the next hall`. */
export function holdNote(s: GameState): string {
  const hold = lotHold(s);
  if (hold <= 0) return '';
  const name = holdName(s, hold);
  const what = name === 'the run first' ? 'the run' : name === 'the offer first' ? 'the offer' : name === 'the hall first' ? 'the next hall' : name === 'the plant first' ? 'the next plant' : name.replace(/ first$/, '');
  return `${fmtMoneyShort(hold)} kept for ${what}`;
}

/**
 * What the main lot button sells now: up to 1,000 — as many as fit, the money above the hold can pay
 * for, in hundreds (at least 100; 0 when not even that). The first lot is always within reach of the
 * next few seconds of income, so the growth verb is never a goal the player waits on (critic C1).
 */
export function lotSize(s: GameState): number {
  const room = Math.min(LOT_SIZES[0], freeSlots(s), freePowerGpus(s));
  const money = (s.funds - lotHold(s)) / gpuUnitPrice(s);
  const n = Math.floor(Math.min(room, money) / 100) * 100;
  return n >= 100 ? n : 0;
}

/** The main lot when it is not affordable: what it would buy with room and power alone (for its label). */
function lotRoom(s: GameState): number {
  return Math.max(100, Math.floor(Math.min(LOT_SIZES[0], freeSlots(s), freePowerGpus(s)) / 100) * 100);
}

export function gpuUnitPrice(s: GameState): number {
  return (s.g5 ? G5_PRICE : G4_PRICE) * S2_FUNDS_SCALE;
}

/** The lot the main button names: what it would buy now, or what room and power allow. */
export function shownLot(s: GameState): number {
  return lotSize(s) || lotRoom(s);
}

export function lotCostOf(s: GameState, n: number): number {
  return Math.round(n * gpuUnitPrice(s));
}

export function lotCost(s: GameState): number {
  return lotCostOf(s, shownLot(s));
}

/** What stops a lot of `n`: room or power ('' when it fits; the standing order never locks a button). */
export function lotReasonOf(s: GameState, n: number): '' | 'no room' | 'no power' {
  if (lotFits(s, n === LOT_SIZES[0] ? 100 : n)) return '';
  if (freeSlots(s) < n && freeSlots(s) <= freePowerGpus(s)) return 'no room';
  return 'no power';
}

export function lotReason(s: GameState): '' | 'no room' | 'no power' {
  return lotReasonOf(s, LOT_SIZES[0]);
}

/**
 * Task revenue a lot of `n` adds at today's market, per second: AUTO prices to clear, so task revenue
 * grows with the square root of output (contracts pay a fixed rate and do not move).
 */
export function lotReturn(s: GameState, n: number): number {
  const eff = Math.max(1, effGpus(s));
  const add = n * (s.g5 ? G5_COMPUTE : 1);
  const taskRevenue = Math.max(0, s.stats.revPerSec - Math.max(0, s.contractIncome || 0));
  return taskRevenue * (Math.sqrt(1 + add / eff) - 1);
}

/** The standing order's note beside the main lot: its share of income and when it buys next. */
export function lotNote(s: GameState): string {
  if (!standingOrderOn(s)) return '';
  const share = `standing order: ${Math.round(s.standingBudget * 100)}% of income`;
  if (lotReason(s)) return share;
  const size = LOT_SIZES.slice().reverse().find((n) => lotFits(s, n)) ?? LOT_SIZES[0];
  const cost = Math.min(lotCostOf(s, size), lotCostOf(s, LOT_SIZES[0]) * 5);
  const rate = Math.max(1, s.standingBudget * s.stats.revPerSec);
  const eta = Math.max(0, cost - s.standingPool) / rate;
  return eta >= 1 && eta < 600 ? `${share} · next lot in ${fmtClock(eta)}` : share;
}

export function standingOrderOn(s: GameState): boolean {
  return s.standingOrder && s.standingBudget > 0 && isBought(s, 'p_standing_order');
}

function addLot(s: GameState, lot: number, cost: number): void {
  addFunds(s, -cost);
  s.gpus += lot;
  if (s.g5) s.gpusG5 += lot;
}

/** Buy a lot of `n` by hand (also with the standing order on: the order never takes the buttons away). */
export function buyGpuBatch(s: GameState, size: number = LOT_SIZES[0]): boolean {
  if (s.stage < 2 || !s.revealed['infrastructure'] || !(LOT_SIZES as readonly number[]).includes(size)) return false;
  // The main lot buys what fits and what the money above the hold pays for; the others are whole.
  const n = size === LOT_SIZES[0] ? lotSize(s) : size;
  if (n < 100 || !lotFits(s, n) || (size !== LOT_SIZES[0] && lotHoldReason(s, n))) return false;
  const cost = lotCostOf(s, n);
  if (s.funds < cost) return false;
  addLot(s, n, cost);
  s.gpuBatches += 1;
  s.flags['lotByHandAt'] = s.stats.timePlayed;
  press(s, 'gpuLot');
  return true;
}

/**
 * What the standing order keeps in hand when it buys: the next run's price when its research is most
 * of the way there and the cluster is near what it wants, the wall's named fix on screen, and an open
 * offer the lab cannot pay yet.
 */
export function standingReserve(s: GameState): number {
  let run = 0;
  if (s.revealed['training'] && trainSlotFree(s) && computeYield(s) >= RUN_HOLD_YIELD) {
    const cost = trainCost(s);
    if (s.research >= 0.6 * (cost.research ?? 0)) run = cost.funds ?? 0;
  }
  let fix = 0;
  for (const p of visibleProjects(s)) {
    if (p.rescue || p.urgent?.(s) !== true) continue;
    const f = p.cost(s).funds ?? 0;
    if (f > 0 && (fix === 0 || f < fix)) fix = f;
  }
  return Math.max(run, fix, offerOnTable(s), wallFix(s)?.price ?? 0);
}

/**
 * An open event with a priced answer the lab cannot pay yet (the publishers' licence): the order
 * leaves that much in hand while the event waits, so a lot is not what decides it.
 */
function offerOnTable(s: GameState): number {
  const def = s.activeChoice ? choiceById(s.activeChoice.id) : undefined;
  if (!def) return 0;
  let price = 0;
  for (const opt of def.options) {
    const f = optionCost(s, opt)?.funds ?? 0;
    if (f > s.funds && (price === 0 || f < price)) price = f;
  }
  return price;
}

/**
 * The standing order, once a second: its share of income goes into a pool (at most two minutes of
 * that share), and the largest lot that fits and that the pool covers is bought, the reserve kept —
 * unless the player has ordered by hand in the last 20 s.
 */
export function runStandingOrder(s: GameState): void {
  if (s.stage < 2 || !standingOrderOn(s)) {
    s.standingPool = 0;
    return;
  }
  // The order fills in for a player who is not ordering: a lot bought by hand in the last 20 s
  // means the player is steering, and the order keeps its share in the pool (critic C1).
  const byHand = s.flags['lotByHandAt'];
  if (typeof byHand === 'number' && s.stats.timePlayed - byHand < 20) return;
  const share = s.standingBudget * Math.max(0, s.stats.revPerSec);
  s.standingPool = Math.min(s.standingPool + share, Math.max(120 * share, lotCostOf(s, LOT_SIZES[0])));
  const reserve = standingReserve(s);
  let guard = 0;
  while (guard++ < 3) {
    const size = LOT_SIZES.slice().reverse().find((n) => lotFits(s, n) && s.standingPool >= lotCostOf(s, n) && s.funds - lotCostOf(s, n) >= reserve);
    if (!size) return;
    const cost = lotCostOf(s, size);
    addLot(s, size, cost);
    s.standingPool -= cost;
    s.flags['standingLots'] = ((s.flags['standingLots'] as number) || 0) + 1;
  }
}

/** The standing order's share of income, cycled by its button: 25 → 50 → 75 → 100 % → off → 25 %. */
export const BUDGET_STEPS = [0.25, 0.5, 0.75, 1, 0];

export function toggleStanding(s: GameState): boolean {
  if (!isBought(s, 'p_standing_order') || !s.revealed['standingOrder']) return false;
  const i = BUDGET_STEPS.findIndex((b) => Math.abs(b - s.standingBudget) < 1e-9);
  s.standingBudget = BUDGET_STEPS[(i + 1) % BUDGET_STEPS.length]!;
  s.standingOrder = true;
  press(s, 'toggleStanding');
  return true;
}

// ---------- datacenters ----------

/** A hall takes time to build (critic C2: building ahead is the skill), opening a quarter at a time; longer when approval is low. */
export const DC_BUILD_SECONDS = 90;
export const DC_PERMIT_SECONDS = 60;

export function dcBuildSeconds(s: GameState): number {
  return DC_BUILD_SECONDS + (s.approval < -30 ? DC_PERMIT_SECONDS : 0);
}

/** The hall under construction (one crew at a time). */
export function datacenterBuilding(s: GameState): PowerOrder | undefined {
  return s.powerQueue.find((o) => o.kind === 'datacenter');
}

export function datacenterReason(s: GameState): '' | 'building' {
  return datacenterBuilding(s) ? 'building' : '';
}

/** Why a plant button is greyed for a reason other than money ('' when it is not): only a full queue. */
export function plantReason(s: GameState, kind: 'gas' | 'solar' | 'nuclear'): '' | 'queue full' {
  if (kind === 'solar' && solarQueueFull(s)) return 'queue full';
  return '';
}

export function buildDatacenter(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['dcButton'] || datacenterBuilding(s)) return false;
  const next = nextDatacenter(s);
  if (s.funds < next.cost) return false;
  addFunds(s, -next.cost);
  const seconds = dcBuildSeconds(s);
  s.powerQueue.push({ kind: 'datacenter', mw: 0, remaining: seconds, total: seconds, label: `Datacenter ${next.n}` });
  press(s, 'datacenter');
  say(s, `Datacenter ${next.n} — ${fmtClock(seconds)} until the halls are ready${seconds > DC_BUILD_SECONDS ? ' (the permit took a minute longer)' : ''}.`);
  return true;
}

// ---------- plants ----------

/** Gas: $60,000 × 1.7^n at scale 1 (stage2.md has $90,000; §9.5's knob for the early power wall). */
export const GAS_BASE = 60000;

export function gasCost(s: GameState): number {
  return threeFigures(s2(GAS_BASE * Math.pow(1.7, s.gasPlants)));
}

/** A price to three significant figures: `$560,000`, not `$560,082`. */
function threeFigures(x: number): number {
  if (x <= 0) return 0;
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 2));
  return Math.round(x / unit) * unit;
}

function queued(s: GameState, kind: PowerOrder['kind']): PowerOrder[] {
  return s.powerQueue.filter((o) => o.kind === kind);
}

export function solarCost(s: GameState): number {
  return s2(300000 * Math.pow(1.3, s.solarFarms + queued(s, 'solar').length));
}

export function nuclearCost(s: GameState): number {
  const n = s.reactors + queued(s, 'nuclear').length;
  return s2(15000000 * Math.pow(2, n) * (s.govRelations >= 60 ? 0.75 : 1));
}

export function solarQueueFull(s: GameState): boolean {
  return queued(s, 'solar').length >= SOLAR_QUEUE_MAX;
}

function solarSeconds(s: GameState): number {
  return s.btm ? BTM_QUEUE_SECONDS : SOLAR_QUEUE_SECONDS;
}

/** Gas turbines: instant, cheap at first, and the county notices (approval −1.5 each, in the target). */
export function buyTurbines(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['gasButton'] || plantReason(s, 'gas')) return false;
  const cost = gasCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  s.gasPlants += 1;
  s.powerCapacityMW += GAS_MW;
  press(s, 'gas');
  if (s.gasPlants === 1) {
    say(s, 'Gas turbines online. +20 MW. The county has questions.');
    logNews(s, 'Gas turbines arrive at Abilene on forty trucks. The county schedules a hearing.');
    s.flags['firstGasAt'] = s.stats.timePlayed;
  } else {
    say(s, 'Gas turbines online. +20 MW.');
  }
  return true;
}

/** Seconds until the solar order at `index` (among solar orders) is connected. */
function solarEta(s: GameState, index: number): number {
  const solar = queued(s, 'solar');
  let t = 0;
  for (let i = 0; i <= index && i < solar.length; i++) t += solar[i]!.remaining;
  return t;
}

/** Solar + storage: cheap power that waits in the interconnect queue, one farm at a time. */
export function buySolar(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['solarButton'] || plantReason(s, 'solar')) return false;
  const cost = solarCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  const n = s.solarFarms + queued(s, 'solar').length + 1;
  s.powerQueue.push({ kind: 'solar', mw: SOLAR_MW, remaining: solarSeconds(s), label: 'Solar farm' });
  s.revealed['queue'] = true;
  press(s, 'solar');
  const eta = solarEta(s, queued(s, 'solar').length - 1);
  say(s, `The Interconnect Queue — ${fmtClock(eta)} until the farm is connected.`);
  if (n === 1) logNews(s, 'The grid interconnect queue in Texas is 36 months. OpenMind\'s lawyers find a shorter line.');
  return true;
}

export function buyNuclear(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['nuclearButton'] || plantReason(s, 'nuclear')) return false;
  const cost = nuclearCost(s);
  if (s.funds < cost) return false;
  addFunds(s, -cost);
  queueNuclear(s);
  press(s, 'nuclear');
  return true;
}

/** A reactor restart (the Nuclear PPA): 500 MW after a named two-minute wait. */
export function queueNuclear(s: GameState): void {
  const first = s.reactors + queued(s, 'nuclear').length === 0;
  s.powerQueue.push({ kind: 'nuclear', mw: NUCLEAR_MW, remaining: REACTOR_SECONDS, label: 'the Nuclear PPA' });
  say(s, `Reactor restart — ${fmtClock(REACTOR_SECONDS)} until the Nuclear PPA delivers.`);
  if (first) logNews(s, 'A shuttered reactor in the Midwest is restarting. Its only customer is OpenMind.');
}

/** Al-Marsa (the Gulf offer): a gigawatt in two minutes. */
export function queueGulf(s: GameState): void {
  s.powerQueue.push({ kind: 'gulf', mw: GULF_MW, remaining: GULF_SECONDS, label: 'Al-Marsa' });
  s.gulfExposure = 1;
  say(s, `Al-Marsa — ${fmtClock(GULF_SECONDS)} until the Gulf site is energised.`);
}

/** Behind-the-meter: the interconnect queue shrinks to 30 s for orders already waiting too. */
export function applyBehindTheMeter(s: GameState): void {
  s.btm = true;
  for (const o of s.powerQueue) if (o.kind === 'solar') o.remaining = Math.min(o.remaining, BTM_QUEUE_SECONDS);
}

/** Power orders count down in game time: the first solar farm in the queue, every reactor and Al-Marsa. */
export function updatePowerQueue(s: GameState, dt: number): void {
  if (s.powerQueue.length === 0) return;
  let firstSolar = true;
  const done: PowerOrder[] = [];
  for (const o of s.powerQueue) {
    if (o.kind === 'solar') {
      if (!firstSolar) continue;
      firstSolar = false;
    }
    o.remaining -= dt;
    if (o.remaining <= 0) done.push(o);
  }
  if (done.length === 0) return;
  s.powerQueue = s.powerQueue.filter((o) => !done.includes(o));
  for (const o of done) {
    if (o.kind === 'datacenter') {
      s.datacenters += 1;
      say(s, `${o.label} complete. Room for ${fmtInt(gpuCapacity(s))} GPUs.`);
      continue;
    }
    s.powerCapacityMW += o.mw;
    if (o.kind === 'solar') {
      s.solarFarms += 1;
      say(s, `Solar farm connected. +${o.mw} MW.`);
    } else if (o.kind === 'nuclear') {
      s.reactors += 1;
      say(s, `The Nuclear PPA delivers. +${fmtInt(o.mw)} MW.`);
    } else {
      s.gulfSites += 1;
      say(s, 'Al-Marsa energised. +1,000 MW.');
      logNews(s, 'The Al-Marsa Compute Park comes online. Its fibre runs under the Gulf.');
    }
  }
}

/** The panel's queue line: `Interconnect queue: solar farm — 2:41 · 1 waiting`; '' when empty. */
export function queueLine(s: GameState): string {
  const parts: string[] = [];
  const solar = queued(s, 'solar');
  if (solar.length) {
    const waiting = solar.length - 1;
    parts.push(`Interconnect queue: solar farm — ${fmtClock(Math.ceil(solar[0]!.remaining))}${waiting ? ` · ${waiting} waiting` : ''}`);
  }
  for (const o of s.powerQueue) {
    if (o.kind === 'nuclear') parts.push(`Reactor restart — ${fmtClock(Math.ceil(o.remaining))}`);
    if (o.kind === 'gulf') parts.push(`Al-Marsa — ${fmtClock(Math.ceil(o.remaining))}`);
    if (o.kind === 'datacenter') parts.push(`${o.label} — ${fmtClock(Math.ceil(o.remaining))}`);
  }
  return parts.join(' · ');
}

/** MW still to come from the queue. */
export function queuedMW(s: GameState): number {
  return s.powerQueue.reduce((a, o) => a + o.mw, 0);
}

/**
 * Bottleneck lines (slow tick), each once per capacity value: the fix is on screen when they print
 * (gas and solar for power, the next datacenter for room).
 */
export function infrastructureMessages(s: GameState): void {
  if (s.stage !== 2 || !s.revealed['infrastructure']) return;
  const reason = lotReason(s);
  if (reason === 'no power') {
    const key = `noPower:${s.powerCapacityMW}`;
    if (!s.flags[key]) {
      s.flags[key] = true;
      const fix = s.revealed['solarButton'] ? 'Gas is fast; solar is cheap.' : 'Gas turbines are fast.';
      say(s, `No power for more GPUs — all ${fmtInt(s.powerCapacityMW)} MW in use. ${fix}`);
    }
  } else if (reason === 'no room') {
    const key = `noRoom:${s.datacenters}`;
    if (!s.flags[key]) {
      s.flags[key] = true;
      say(s, `No room for more GPUs — all ${fmtInt(gpuCapacity(s))} slots full. Build another datacenter.`);
    }
  }
}
