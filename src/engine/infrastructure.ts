import { GameState, PowerOrder, say, logNews, addFunds, press, isBought, canPay, bump } from './state.js';
import { fmtInt, fmtClock } from './format.js';
import { trainCost, trainSlotFree, runOtherwiseReady, gpusShort, gpusAvailable, gpusNeeded } from './training.js';
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
/** A G5 does the work of one and a half G4s; a G6 two and a half (stage3.md §2.1). */
export const G5_COMPUTE = 1.5;
export const G6_COMPUTE = 2.5;
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
/** Stage 3: from Datacenter 9 a hall costs this many seconds of revenue at the press (stage3.md §2.1). */
export const HALL_SECONDS_S3 = 60;
/** Stage 3: a reactor (1,000 MW) costs this many seconds of revenue, a quarter off at relations ≥ 60. */
export const REACTOR_SECONDS_S3 = 75;
export const REACTOR_MW_S3 = 1000;
/** Stage 3 reactor restarts queued at once. */
export const REACTOR_QUEUE_MAX = 2;

export function datacenterSlots(n: number): number {
  let total = 0;
  for (let i = 1; i <= n; i++) total += dcRow(i)[0];
  return total;
}

/** Slots: the halls built, plus the part of the one under construction that is finished (a quarter at a time). */
export function gpuCapacity(s: GameState): number {
  // The Defense Production Act brings five rival labs' halls with their chips (Stage 3).
  const extra = typeof s.flags['extraSlots'] === 'number' ? (s.flags['extraSlots'] as number) : 0;
  return datacenterSlots(s.datacenters) + openedSlots(s) + extra;
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
  // Stage 3: Datacenter 8 keeps its built price; from 9 a hall is a minute of revenue at the press.
  if (s.stage >= 3 && n >= 9) return { n, add, cost: secondsOfRevenue(s, HALL_SECONDS_S3) };
  return { n, add, cost: s2(cost) };
}

/** `seconds` of revenue at the press, to two significant figures (Stage 3's prices, amendment 9). */
export function secondsOfRevenue(s: GameState, seconds: number): number {
  const raw = seconds * Math.max(1, s.stats.revPerSec);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.round(raw / unit) * unit;
}

/** Datacenter 10 and up stand at New Carlisle: they need the second campus (stage3.md §2.1). */
export function needsSite2(s: GameState): boolean {
  return s.stage >= 3 && s.datacenters + 1 >= 10 && s.flags['site2'] !== true;
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

/** The newest chips get power first: G6, then G5, then G4. */
export function activeG6(s: GameState): number {
  return Math.min(s.gpusG6 ?? 0, poweredGpus(s));
}

export function activeG5(s: GameState): number {
  return Math.min(s.gpusG5, Math.max(0, poweredGpus(s) - activeG6(s)));
}

export function activeG4(s: GameState): number {
  return Math.max(0, Math.min(s.gpus - s.gpusG5 - (s.gpusG6 ?? 0), poweredGpus(s) - activeG5(s) - activeG6(s)));
}

/** GPUs that have power. Stage 1 buys power by the kWh, so every rented GPU is active. */
export function activeGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return activeG4(s) + activeG5(s) + activeG6(s);
}

/** Compute in G4-equivalents: a G5 counts one and a half, a G6 two and a half. */
export function effGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return activeG4(s) + G5_COMPUTE * activeG5(s) + G6_COMPUTE * activeG6(s);
}

export function powerDrawMW(s: GameState): number {
  return (activeGpus(s) * KW_PER_GPU) / 1000;
}

/** GPUs the plants online could still power (crises do not count: a lot is bought for good). */
export function freePowerGpus(s: GameState): number {
  return Math.max(0, Math.floor((s.powerCapacityMW * 1000) / KW_PER_GPU) - s.gpus - inTransit(s));
}

export function freeSlots(s: GameState): number {
  return Math.max(0, gpuCapacity(s) - s.gpus - inTransit(s));
}

/** Stage 3: GPUs on their way (ordered lots take room and power from the moment they are ordered). */
export function inTransit(s: GameState): number {
  return (s.shipments ?? []).reduce((a, o) => a + o.gpus, 0);
}

// ---------- GPU lots ----------

/**
 * The lots on the Infrastructure panel, side by side (critic C1: the growth verb stays in the player's
 * hands, each with what it returns printed beside it).
 */
export const LOT_SIZES = [1000, 5000, 25000] as const;
/** Stage 3's lots (stage3.md §2.1): 10,000 / 25,000 / 100,000 for 4 / 10 / 40 s of revenue at the press. */
export const LOT_SIZES_S3 = [10000, 25000, 100000] as const;
export const LOT_SECONDS_S3 = [4, 10, 40] as const;
/** Each Stage 3 order is one shipment of 75 s, landing one at a time, two on order at most. */
export const SHIPMENT_SECONDS = 75;
export const SHIPMENTS_MAX = 2;

/** The Stage 3 lot the button at `index` sells (0, 1, 2). Stage 2 sizes map onto them by position. */
export function lotSizeS3(size: number): number {
  const i = (LOT_SIZES as readonly number[]).indexOf(size);
  if (i >= 0) return LOT_SIZES_S3[i]!;
  return (LOT_SIZES_S3 as readonly number[]).includes(size) ? size : 0;
}

/** A Stage 3 lot's price: its seconds of revenue at the press (× 1.5 once the strait has been closed). */
export function lotPriceS3(s: GameState, n: number): number {
  const i = (LOT_SIZES_S3 as readonly number[]).indexOf(n);
  const secs = i >= 0 ? LOT_SECONDS_S3[i]! : (40 * n) / 100000;
  return Math.round(secondsOfRevenue(s, secs) * (s.flags['chipsDear'] === true ? 1.5 : 1));
}

/** Seconds a Stage 3 shipment takes: 75, 60 with eight seats on the Committee, 90 with four or five. */
export function shipmentSeconds(s: GameState): number {
  if (s.revealed['oversight'] === true) {
    const seats = Math.floor(s.govRelations / 10);
    if (seats >= 8) return 60;
    if (seats <= 5 && seats >= 4) return 90;
  }
  return SHIPMENT_SECONDS;
}

/** Why a Stage 3 lot of `n` cannot be ordered now ('' when it can): the queue, the strait, room or power. */
export function orderReasonS3(s: GameState, n: number): string {
  if ((s.shipments ?? []).length >= SHIPMENTS_MAX) return '2 / 2 on order';
  if (s.flags['blockade'] === true && s.flags['secondSource'] !== true) return 'the strait is closed';
  if (freeSlots(s) < n) return 'no room';
  if (freePowerGpus(s) < n) return 'no power';
  return '';
}

/** Stage 3: order a lot of `n` — it ships in 75 s, behind the one on its way. */
export function orderLot(s: GameState, n: number, cost: number): void {
  addFunds(s, -cost);
  const half = s.flags['blockade'] === true;
  const secs = shipmentSeconds(s) * (half ? 2 : 1);
  s.shipments.push({ gpus: n, gen: s.flags['g6'] === true ? 6 : 5, remaining: secs });
  // The first order names the wait; after it the Infrastructure panel's shipment line carries it.
  if (s.shipments.length === 1 && s.flags['shipmentSaid'] !== true) {
    s.flags['shipmentSaid'] = true;
    say(s, `Shipment — ${fmtClock(secs)} until ${fmtInt(n)} Nimbus ${s.flags['g6'] === true ? 'G6' : 'G5'} arrive.`);
  }
}

/** Every tick in Stage 3: the shipment at the head of the queue counts down and lands. */
export function updateShipments(s: GameState, dt: number): void {
  const q = s.shipments;
  if (!q || q.length === 0) return;
  const head = q[0]!;
  head.remaining -= dt;
  if (head.remaining > 0) return;
  q.shift();
  s.gpus += head.gpus;
  if (head.gen === 6) s.gpusG6 = (s.gpusG6 ?? 0) + head.gpus;
  else s.gpusG5 += head.gpus;
  s.flags['lastShipmentAt'] = s.stats.timePlayed;
}

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
 * says so ("the run first"; the Train row carries the wait) (critic C1/C3).
 */
export function lotHold(s: GameState): number {
  return Math.max(runHold(s), offerOnTable(s), wallFix(s)?.price ?? 0, urgentCard(s)?.price ?? 0);
}

/**
 * Once the run has its research and data and the fleet is half again what it needs (so a third keeps
 * serving while it trains), the lots save its price; short of that, they buy GPUs.
 */
export const RUN_HOLD_FLEET = 1.5;

function runHold(s: GameState): number {
  if (!runOtherwiseReady(s) || gpusAvailable(s) < RUN_HOLD_FLEET * gpusNeeded(s)) return 0;
  return trainCost(s).funds ?? 0;
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
  if (s.stage >= 3) return wallFixS3(s);
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

/**
 * Stage 3: the fix for the wall the lots reach first (stage3.md as-built deltas row 4): the next hall
 * when room runs out, a reactor when power does, while it is within two minutes of income. The
 * build-out grant takes both over.
 */
function wallFixS3(s: GameState): { price: number; what: 'plant' | 'hall' } | null {
  if (!s.revealed['infrastructure'] || s.flags['buildout'] === true) return null;
  const smallest = LOT_SIZES_S3[0];
  const power = freePowerGpus(s) + Math.floor((queuedMW(s) * 1000) / KW_PER_GPU);
  const room = datacenterBuilding(s) ? Infinity : freeSlots(s);
  if (Math.min(power, room) >= 2 * smallest) return null;
  const fix = room <= power
    ? (needsSite2(s) ? null : { price: datacenterCost(s), what: 'hall' as const })
    : (reactorQueueFull(s) ? null : { price: nuclearCost(s), what: 'plant' as const });
  if (fix && fix.price > 120 * Math.max(1, s.stats.revPerSec)) return null;
  return fix;
}

/** The reason a lot of `n` waits on the hold ('' when it does not; the main lot needs 100 GPUs' worth). */
export function lotHoldReason(s: GameState, n: number): string {
  const hold = lotHold(s);
  const need = n === LOT_SIZES[0] ? lotCostOf(s, 100) : lotCostOf(s, n);
  if (hold <= 0 || s.funds - need >= hold) return '';
  // The row names what it keeps the money for; the wait is on that thing's own row (the Train row's
  // `short $181,000 — about 0:28`, the hall's or the plant's price).
  return holdName(s, hold);
}

function holdName(s: GameState, hold: number): string {
  if (runHold(s) >= hold) return 'the run first';
  if (offerOnTable(s) >= hold) return 'the offer first';
  const card = urgentCard(s);
  if (card && card.price >= hold) return `${card.title} first`;
  return wallFix(s)?.what === 'hall' ? 'the hall first' : 'the plant first';
}

/** The main lot's note while something is held: `keeps the next hall's price` (its price is on its own row). */
export function holdNote(s: GameState): string {
  const hold = lotHold(s);
  if (hold <= 0) return '';
  const name = holdName(s, hold);
  const what = name === 'the run first' ? 'the run\'s' : name === 'the offer first' ? 'the offer\'s' : name === 'the hall first' ? 'the next hall\'s' : name === 'the plant first' ? 'the next plant\'s' : `${name.replace(/ first$/, '')}'s`;
  return `keeps ${what} price`;
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
  if (s.stage >= 3) return lotPriceS3(s, lotSizeS3(n) || n);
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
  const add = n * (s.stage >= 3 && s.flags['g6'] === true ? G6_COMPUTE : s.g5 ? G5_COMPUTE : 1);
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
  if (s.stage >= 3) return buyLotS3(s, size);
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

/** Stage 3: a lot by hand (the three buttons; Stage 2's sizes map onto Stage 3's by position). */
export function buyLotS3(s: GameState, size: number): boolean {
  if (!s.revealed['infrastructure']) return false;
  const n = lotSizeS3(size);
  if (!n || orderReasonS3(s, n)) return false;
  const cost = lotCostOf(s, n);
  if (s.funds < cost || s.funds - cost < lotHold(s)) return false;
  orderLot(s, n, cost);
  s.gpuBatches += 1;
  s.flags['lotByHandAt'] = s.stats.timePlayed;
  press(s, 'gpuLot');
  bump(s, 'infraPressesS3');
  return true;
}

/**
 * What the standing order keeps in hand when it buys: the next run's price when its research is most
 * of the way there and the cluster is near what it wants, the wall's named fix on screen, and an open
 * offer the lab cannot pay yet.
 */
export function standingReserve(s: GameState): number {
  let run = 0;
  if (s.revealed['training'] && trainSlotFree(s) && !gpusShort(s)) {
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
  // Stage 3's pool holds 150 s of the share, so at 50 % it reaches the big lot even while a run
  // trains and revenue dips by a third.
  const poolSeconds = s.stage >= 3 ? STANDING_POOL_SECONDS_S3 : 120;
  s.standingPool = Math.min(s.standingPool + share, Math.max(poolSeconds * share, lotCostOf(s, LOT_SIZES[0])));
  const reserve = standingReserve(s);
  if (s.stage >= 3) {
    // Stage 3 (stage3.md §2.1): the share saves for the largest lot its pool can reach and orders it
    // when the queue has room. A small lot would hold a 75 s shipment slot for a tenth of the GPUs.
    const fitting = LOT_SIZES_S3.filter((n) => !orderReasonS3(s, n));
    if (!fitting.length) return;
    const reachable = fitting.filter((n) => lotCostOf(s, n) <= poolSeconds * share);
    const size = reachable.length ? reachable[reachable.length - 1]! : fitting[0]!;
    const cost = lotCostOf(s, size);
    if (s.standingPool < cost || s.funds - cost < reserve) return;
    orderLot(s, size, cost);
    s.standingPool -= cost;
    s.flags['standingLots'] = ((s.flags['standingLots'] as number) || 0) + 1;
    return;
  }
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

/** Seconds of its share the Stage 3 standing order's pool holds. */
export const STANDING_POOL_SECONDS_S3 = 150;

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
  if (kind === 'nuclear' && reactorQueueFull(s)) return 'queue full';
  return '';
}

export function buildDatacenter(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['dcButton'] || datacenterBuilding(s) || needsSite2(s)) return false;
  const next = nextDatacenter(s);
  if (s.funds < next.cost) return false;
  addFunds(s, -next.cost);
  const seconds = dcBuildSeconds(s);
  s.powerQueue.push({ kind: 'datacenter', mw: 0, remaining: seconds, total: seconds, label: `Datacenter ${next.n}` });
  press(s, 'datacenter');
  if (s.stage >= 3) bump(s, 'infraPressesS3');
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
  // Stage 3: a 1,000 MW reactor for 75 s of revenue at the press, a quarter off at relations ≥ 60.
  if (s.stage >= 3) return Math.round(secondsOfRevenue(s, REACTOR_SECONDS_S3) * (s.govRelations >= 60 ? 0.75 : 1));
  const n = s.reactors + queued(s, 'nuclear').length;
  return s2(15000000 * Math.pow(2, n) * (s.govRelations >= 60 ? 0.75 : 1));
}

/** Stage 3: two reactor restarts at most in the queue. */
export function reactorQueueFull(s: GameState): boolean {
  return s.stage >= 3 && queued(s, 'nuclear').length >= REACTOR_QUEUE_MAX;
}

export function solarQueueFull(s: GameState): boolean {
  return queued(s, 'solar').length >= SOLAR_QUEUE_MAX;
}

/** Relations from which the utility puts OpenMind's farms at the front of the queue (critic C7). */
export const GOV_QUEUE_BAND = 80;

/** Seconds a new solar farm waits in the interconnect queue: behind-the-meter 0:30; halved at relations 80+. */
export function solarSeconds(s: GameState): number {
  const base = s.btm ? BTM_QUEUE_SECONDS : SOLAR_QUEUE_SECONDS;
  return s.govRelations >= GOV_QUEUE_BAND ? Math.round(base / 2) : base;
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
  if (s.stage >= 3) bump(s, 'infraPressesS3');
  return true;
}

/** A reactor restart (the Nuclear PPA): 500 MW after a named two-minute wait. */
export function queueNuclear(s: GameState): void {
  const first = s.reactors + queued(s, 'nuclear').length === 0;
  const mw = s.stage >= 3 ? REACTOR_MW_S3 : NUCLEAR_MW;
  const seconds = REACTOR_SECONDS + (s.stage >= 3 && s.approval <= -30 ? DC_PERMIT_SECONDS : 0);
  s.powerQueue.push({ kind: 'nuclear', mw, remaining: seconds, label: s.stage >= 3 ? 'the reactor' : 'the Nuclear PPA' });
  // Once Sage plans the build-out, its own line on the Infrastructure panel carries the wait.
  if (!handedOver(s)) say(s, `Reactor restart — ${fmtClock(seconds)} until ${s.stage >= 3 ? `${fmtInt(mw)} MW come online` : 'the Nuclear PPA delivers'}.`);
  if (first) logNews(s, 'A shuttered reactor in the Midwest is restarting. Its only customer is OpenMind.');
}

/** Stage 3 after `Let Sage plan the build-out`: halls and reactors are Sage's, and so are their lines. */
function handedOver(s: GameState): boolean {
  return s.stage >= 3 && s.flags['buildout'] === true;
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
      if (!handedOver(s)) say(s, `${o.label} complete. Room for ${fmtInt(gpuCapacity(s))} GPUs.`);
      continue;
    }
    s.powerCapacityMW += o.mw;
    if (o.kind === 'solar') {
      s.solarFarms += 1;
      say(s, `Solar farm connected. +${o.mw} MW.`);
    } else if (o.kind === 'nuclear') {
      s.reactors += 1;
      if (!handedOver(s)) say(s, s.stage >= 3 ? `Reactor online. +${fmtInt(o.mw)} MW.` : `The Nuclear PPA delivers. +${fmtInt(o.mw)} MW.`);
    } else {
      s.gulfSites += 1;
      say(s, 'Al-Marsa energised. +1,000 MW.');
      logNews(s, 'The Al-Marsa Compute Park comes online. Its fibre runs under the Gulf.');
    }
  }
}

/** The panel's queue line: `Interconnect queue: solar farm — 2:41 · 1 waiting`; '' when empty (a hall's build is on its own row). */
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
