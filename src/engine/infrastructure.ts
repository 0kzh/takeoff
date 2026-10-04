import { GameState, PowerOrder, Shipment, say, logNews, press, isBought, bump, counter, buildFundOpen, payBuild } from './state.js';
import { fmtInt, fmtClock, fmtMoneyShort } from './format.js';

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

/**
 * Stage 2's prices follow the lab that arrives (the trainfirst regression: a Stage 1 played without a
 * late card arrived with a third of the income and paid the same dollars). Every Stage 2 funds price,
 * a run's and a lot's included, is multiplied by the arrival's scale, set by the income the player
 * brings into Stage 2: the arrival played on a copy of the state (1,000 owned GPUs, the market Stage 1
 * built, the contracts' frozen rate; `arrivalIncomeS2` in engine/stages.ts) against the median exit's.
 * A weaker lab pays in proportion; a stronger one more by the square root only, keeping part of its
 * lead (Stage 3's rule for its runs); within 0.6–1.25. Frozen at the click (`flags.s2Scale`); in Stage
 * 1, live (estimated at most once a second), so the row can quote the Stage 2 price the click charges.
 * Stage 1's best revenue, the measure before, missed a first-timer's income by a quarter either way.
 */
export const S2_REF_INCOME = 3500;
/** The exponent below the median: 1 would charge a weak lab in proportion. */
export const S2_SCALE_BELOW = 0.75;

export function arrivalScaleS2(income: number): number {
  const ratio = Math.max(1, income) / S2_REF_INCOME;
  const raw = ratio < 1 ? Math.pow(ratio, S2_SCALE_BELOW) : Math.sqrt(ratio);
  return Math.round(Math.min(1.25, Math.max(0.6, raw)) * 100) / 100;
}

/** The arrival estimate, registered by engine/stages.ts (which runs the arrival); cached a second a state. */
let arrivalIncome: ((s: GameState) => number) | null = null;
const arrivalCache = new WeakMap<GameState, { at: number; scale: number }>();

export function setArrivalIncomeEstimator(f: (s: GameState) => number): void {
  arrivalIncome = f;
}

export function s2Scale(s: GameState): number {
  const v = s.flags['s2Scale'];
  if (typeof v === 'number' && v > 0) return v;
  if (s.stage >= 2 || !arrivalIncome) return 1;
  const now = Math.floor(s.stats.timePlayed);
  const hit = arrivalCache.get(s);
  if (hit && hit.at === now) return hit.scale;
  const scale = arrivalScaleS2(arrivalIncome(s));
  arrivalCache.set(s, { at: now, scale });
  return scale;
}

/** A Stage 2 funds price: scale-1 dollars → dollars on screen. */
export function s2(s: GameState, amount: number): number {
  return Math.round(amount * S2_FUNDS_SCALE * s2Scale(s));
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
  return { n, add, cost: s2(s, cost) };
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
  const owned = activeG4(s) + G5_COMPUTE * activeG5(s) + G6_COMPUTE * activeG6(s);
  // Stage 4: the fleet builds GPU-equivalents with their power (stage4.md §2.2).
  return s.stage >= 4 ? owned + Math.max(0, s.s4.builtCompute) : owned;
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

/**
 * A shipment holds up to the largest lot. An order joins the shipment waiting behind the one on its
 * way when it fits (same chips), so three small lots fill one slot, not three: the queue caps what
 * arrives (two shipments, 75 s each), not how the player happens to buy it.
 */
export const SHIPMENT_CAPACITY = 100000;

function joinable(s: GameState, n: number): Shipment | undefined {
  const q = s.shipments ?? [];
  if (q.length < 2) return undefined;
  const last = q[q.length - 1]!;
  const gen = s.flags['g6'] === true ? 6 : 5;
  return last.gen === gen && last.gpus + n <= SHIPMENT_CAPACITY ? last : undefined;
}

/** Why a Stage 3 lot of `n` cannot be ordered now ('' when it can): the queue, the strait, room or power. */
export function orderReasonS3(s: GameState, n: number): string {
  if ((s.shipments ?? []).length >= SHIPMENTS_MAX && !joinable(s, n)) return '2 / 2 on order';
  if (s.flags['blockade'] === true && s.flags['secondSource'] !== true) return 'the strait is closed';
  if (freeSlots(s) < n) return 'no room';
  if (freePowerGpus(s) < n) return 'no power';
  return '';
}

/** Stage 3: order a lot of `n` — it ships in 75 s, behind the one on its way. */
export function orderLot(s: GameState, n: number, cost: number): void {
  payBuild(s, cost);
  const half = s.flags['blockade'] === true;
  const secs = shipmentSeconds(s) * (half ? 2 : 1);
  const into = joinable(s, n);
  if (into) {
    into.gpus += n;
    return;
  }
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

// ---------- the build fund (arc G34, the wallet rule) ----------
// Lots, plants and halls are paid from a purse of their own, filled by the build share of income; funds
// keep the rest for runs, cards and events. Nothing is held back from either purse for the other: a
// row is grey only because its purse cannot pay (it prints the shortfall and a clock) or because a
// stated requirement (power, room, the queue) is unmet.

/** The build fund's income a second. */
export function buildIncome(s: GameState): number {
  return buildFundOpen(s) ? Math.max(0, s.stats.revPerSec) * s.buildShare : 0;
}

/** Funds' income a second: what the build share leaves. */
export function fundsIncome(s: GameState): number {
  return Math.max(0, s.stats.revPerSec) * (buildFundOpen(s) ? 1 - s.buildShare : 1);
}

/** Seconds until the build fund covers `cost`: 0 when it does, Infinity with no income. */
export function buildEta(s: GameState, cost: number): number {
  const short = cost - s.buildFund;
  if (short <= 0) return 0;
  const r = buildIncome(s);
  return r > 0 ? short / r : Infinity;
}

/** `$12,400 short — 0:09`: what a build row is missing and when the share brings it ('' when paid). */
export function buildShortLine(s: GameState, cost: number): string {
  const short = cost - s.buildFund;
  if (short <= 0) return '';
  const eta = buildEta(s, cost);
  return `${fmtMoneyShort(Math.ceil(short))} short${Number.isFinite(eta) && eta < 3600 ? ` — ${fmtClock(Math.max(1, eta))}` : ''}`;
}

/** The build share, cycled by its button: 25 → 50 → 75 % → 25 %. */
export const BUILD_SHARES = [0.25, 0.5, 0.75];

export function cycleBuildShare(s: GameState): boolean {
  if (!buildFundOpen(s)) return false;
  const i = BUILD_SHARES.findIndex((b) => Math.abs(b - s.buildShare) < 1e-9);
  s.buildShare = BUILD_SHARES[(i + 1) % BUILD_SHARES.length]!;
  press(s, 'buildShare');
  return true;
}

/**
 * Stage 2's lots climb with the fleet: the three smallest of the ladder that are at least 2 % of
 * the GPUs owned (1,000 / 5,000 / 25,000 until the fleet passes 50,000, then 5,000 / 25,000 /
 * 125,000). Whole lots only, so a thousand-GPU lot is not pressed four hundred times (round 2 §1:
 * at most 250 lot presses a stage).
 */
export const LOT_LADDER_S2 = [1000, 5000, 25000, 125000] as const;
export const LOT_FLEET_SHARE = 0.02;

/** The lot sizes of the stage's three rows (Stage 2: the ladder's window; Stage 3: 10,000 / 25,000 / 100,000). */
export function lotSizes(s: GameState): readonly number[] {
  if (s.stage >= 3) return LOT_SIZES_S3;
  const min = LOT_FLEET_SHARE * s.gpus;
  let i = LOT_LADDER_S2.findIndex((n) => n >= min);
  if (i < 0 || i > LOT_LADDER_S2.length - 3) i = LOT_LADDER_S2.length - 3;
  return LOT_LADDER_S2.slice(i, i + 3);
}

/** Buys the lot a row sells now (the buttons: row 0, 1, 2). */
export function buyLotRow(s: GameState, row: number): boolean {
  const n = lotSizes(s)[row];
  return n ? buyGpuBatch(s, n) : false;
}

/** The wall in front of the lots: what keeps the smallest whole lot from fitting ('' when it fits). */
export function buildWall(s: GameState): '' | 'power' | 'room' {
  const n = lotSizes(s)[0]!;
  if (lotFits(s, n)) return '';
  return freeSlots(s) < n && freeSlots(s) <= freePowerGpus(s) ? 'room' : 'power';
}

/**
 * The Standing order stalled (stage2-round2-fixes.md item 3): on, its fund holding more than two
 * minutes of its income, and no whole lot fits. The row names the wall, the fix is drawn urgent.
 */
export function standingStall(s: GameState): '' | 'power' | 'room' {
  if (!standingOrderOn(s)) return '';
  if (s.buildFund < 120 * buildIncome(s) || s.buildFund < lotCostOf(s, lotSizes(s)[0]!)) return '';
  return buildWall(s);
}

/** What the main lot button sells: its whole lot when it fits, else nothing (Stage 2). */
export function lotSize(s: GameState): number {
  const n = lotSizes(s)[0]!;
  return lotFits(s, n) ? n : 0;
}

export function gpuUnitPrice(s: GameState): number {
  // Under a month's lead Washington tightens exports: chips cost a tenth more (round 2 item 5).
  const exports = s.stage === 2 && s.lead < 1 ? 1.1 : 1;
  return (s.g5 ? G5_PRICE : G4_PRICE) * S2_FUNDS_SCALE * s2Scale(s) * exports;
}

/** The lot the main button names: always a whole lot. */
export function shownLot(s: GameState): number {
  return lotSizes(s)[0]!;
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
  if (lotFits(s, n)) return '';
  if (freeSlots(s) < n && freeSlots(s) <= freePowerGpus(s)) return 'no room';
  return 'no power';
}

export function lotReason(s: GameState): '' | 'no room' | 'no power' {
  return lotReasonOf(s, lotSizes(s)[0]!);
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

export function standingOrderOn(s: GameState): boolean {
  return s.standingOrder && isBought(s, 'p_standing_order');
}

/** The Standing order's row: `Standing order: on · next lot in 0:31`, or the wall it waits on. */
export function standingLine(s: GameState): string {
  if (!isBought(s, 'p_standing_order')) return '';
  if (!s.standingOrder) return 'Standing order: off';
  const stall = standingStall(s);
  if (stall === 'power') return `Standing order: waiting for power: ${fmtInt(freePowerGpus(s) / 1000)} MW free`;
  if (stall === 'room') return `Standing order: waiting for room: ${fmtInt(freeSlots(s))} slots left`;
  const fitting = lotSizes(s).filter((n) => lotFits(s, n));
  if (!fitting.length) return 'Standing order: on';
  const eta = buildEta(s, lotCostOf(s, fitting[0]!));
  return eta >= 1 && eta < 3600 ? `Standing order: on · next lot in ${fmtClock(eta)}` : 'Standing order: on';
}

function addLot(s: GameState, lot: number, cost: number): void {
  payBuild(s, cost);
  s.gpus += lot;
  if (s.g5) s.gpusG5 += lot;
}

/** Buy a whole lot of `n` by hand, from the build fund (the Standing order never takes the buttons away). */
export function buyGpuBatch(s: GameState, size?: number): boolean {
  if (s.stage >= 3) return buyLotS3(s, size ?? LOT_SIZES_S3[0]);
  size ??= lotSizes(s)[0]!;
  if (s.stage < 2 || !s.revealed['infrastructure'] || !lotSizes(s).includes(size)) return false;
  if (!lotFits(s, size)) return false;
  const cost = lotCostOf(s, size);
  if (s.buildFund < cost) return false;
  addLot(s, size, cost);
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
  if (s.buildFund < cost) return false;
  orderLot(s, n, cost);
  s.gpuBatches += 1;
  s.flags['lotByHandAt'] = s.stats.timePlayed;
  press(s, 'gpuLot');
  bump(s, 'infraPressesS3');
  return true;
}

/**
 * The Standing order, once a second (stage2-round2-fixes.md item 3): the build fund's automation and
 * nothing else. On, it buys the largest whole lot that fits whenever the fund covers one (never a
 * plant or a hall), unless the player has bought a lot by hand in the last 20 s.
 */
export function runStandingOrder(s: GameState): void {
  if (s.stage < 2 || !standingOrderOn(s) || !buildFundOpen(s)) return;
  const byHand = s.flags['lotByHandAt'];
  if (typeof byHand === 'number' && s.stats.timePlayed - byHand < 20) return;
  if (s.stage >= 3) {
    const fitting = LOT_SIZES_S3.filter((n) => !orderReasonS3(s, n) && lotCostOf(s, n) <= s.buildFund);
    if (!fitting.length) return;
    const size = fitting[fitting.length - 1]!;
    orderLot(s, size, lotCostOf(s, size));
    s.flags['standingLots'] = ((s.flags['standingLots'] as number) || 0) + 1;
    return;
  }
  let guard = 0;
  while (guard++ < 3) {
    const size = lotSizes(s).slice().reverse().find((n) => lotFits(s, n) && s.buildFund >= lotCostOf(s, n));
    if (!size) return;
    addLot(s, size, lotCostOf(s, size));
    s.flags['standingLots'] = ((s.flags['standingLots'] as number) || 0) + 1;
  }
}

/** The Standing order's button: on or off. */
export function toggleStanding(s: GameState): boolean {
  if (!isBought(s, 'p_standing_order') || !s.revealed['standingOrder']) return false;
  s.standingOrder = !s.standingOrder;
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
  if (s.buildFund < next.cost) return false;
  payBuild(s, next.cost);
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
  return threeFigures(s2(s, GAS_BASE * Math.pow(1.7, s.gasPlants)));
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
  return s2(s, 300000 * Math.pow(1.3, s.solarFarms + queued(s, 'solar').length));
}

export function nuclearCost(s: GameState): number {
  // Stage 3: a 1,000 MW reactor for 75 s of revenue at the press, a quarter off at relations ≥ 60.
  if (s.stage >= 3) return Math.round(secondsOfRevenue(s, REACTOR_SECONDS_S3) * (s.govRelations >= 60 ? 0.75 : 1));
  const n = s.reactors + queued(s, 'nuclear').length;
  return s2(s, 15000000 * Math.pow(2, n) * (s.govRelations >= 60 ? 0.75 : 1));
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
  if (s.buildFund < cost) return false;
  payBuild(s, cost);
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
  if (s.buildFund < cost) return false;
  payBuild(s, cost);
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
  if (s.buildFund < cost) return false;
  payBuild(s, cost);
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

/**
 * What answers Stage 3's room wall, as the screen has it now (critic S3 round 1 §9.9: no advice to press
 * a button the build-out took away): the campus, a hall going up, the build-out, or Build Datacenter.
 */
export function roomFixS3(s: GameState): string {
  if (needsSite2(s)) return 'Datacenter 10 needs the New Carlisle campus (from the build fund)';
  const hall = s.powerQueue.find((o) => o.kind === 'datacenter');
  if (hall) return `${hall.label ?? 'a hall'} is going up — ${fmtClock(Math.ceil(hall.remaining))}`;
  return s.flags['buildout'] === true ? 'the build-out orders the next hall' : `Build Datacenter ${nextDatacenter(s).n}`;
}

/** What answers Stage 3's power wall: a reactor restarting, the build-out, or a reactor to buy. */
export function powerFixS3(s: GameState): string {
  const reactor = s.powerQueue.find((o) => o.kind === 'nuclear');
  if (reactor) return `a reactor is restarting — ${fmtClock(Math.ceil(reactor.remaining))}`;
  return s.flags['buildout'] === true ? 'the build-out orders a reactor' : 'a reactor adds 1,000 MW';
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
  if ((s.stage !== 2 && s.stage !== 3) || !s.revealed['infrastructure']) return;
  // The Standing order stalled with its fund full (round 2 item 3): the line names the wall and the
  // fix on screen, and repeats every 180 s while it holds.
  const stall = standingStall(s);
  if (stall) {
    const last = counter(s, 'stallSaidAt');
    if (s.flags['stallSaid'] !== true || s.stats.timePlayed - last >= 180) {
      s.flags['stallSaid'] = true;
      s.flags['stallSaidAt'] = s.stats.timePlayed;
      const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
      say(s, stall === 'power'
        ? `The Standing order waits for power: ${fmtInt(Math.floor(freePowerGpus(s) / 1000))} MW free. ${s.stage >= 3 ? `${cap(powerFixS3(s))}.` : 'Gas turbines add 20 MW.'}`
        : `The Standing order waits for room: ${fmtInt(freeSlots(s))} slots left. ${s.stage >= 3 ? `${cap(roomFixS3(s))}.` : 'Build Datacenter.'}`);
    }
  } else s.flags['stallSaid'] = false;
  if (s.stage !== 2) return;
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
