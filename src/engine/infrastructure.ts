import { GameState, PowerOrder, Shipment, say, logNews, press, isBought, bump, counter, buildFundOpen, payBuild } from './state.js';
import { fmtInt, fmtClock } from './format.js';

export const S2_FUNDS_SCALE = 2.4;

export const S2_REF_INCOME = 3500;
export const S2_SCALE_BELOW = 0.75;

export function arrivalScaleS2(income: number): number {
  const ratio = Math.max(1, income) / S2_REF_INCOME;
  const raw = ratio < 1 ? Math.pow(ratio, S2_SCALE_BELOW) : Math.sqrt(ratio);
  return Math.round(Math.min(1.25, Math.max(0.6, raw)) * 100) / 100;
}

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

export function s2(s: GameState, amount: number): number {
  return Math.round(amount * S2_FUNDS_SCALE * s2Scale(s));
}

export const ARRIVAL_GPUS = 1000;
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
export const SOLAR_QUEUE_MAX = 2;
export const G5_COMPUTE = 1.5;
export const G6_COMPUTE = 2.5;
export const G4_PRICE = 50;
export const G5_PRICE = 110;

const DC_TABLE: [number, number][] = [
  [10000, 0],
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

export const HALL_SECONDS_S3 = 60;
export const REACTOR_SECONDS_S3 = 75;
export const REACTOR_MW_S3 = 1000;
export const REACTOR_QUEUE_MAX = 2;

export function datacenterSlots(n: number): number {
  let total = 0;
  for (let i = 1; i <= n; i++) total += dcRow(i)[0];
  return total;
}

export function gpuCapacity(s: GameState): number {
  const extra = typeof s.flags['extraSlots'] === 'number' ? (s.flags['extraSlots'] as number) : 0;
  return datacenterSlots(s.datacenters) + openedSlots(s) + extra;
}

function openedSlots(s: GameState): number {
  const b = s.powerQueue.find((o) => o.kind === 'datacenter');
  if (!b || !b.total) return 0;
  const done = Math.max(0, Math.min(1, 1 - b.remaining / b.total));
  return Math.floor(done * 4) / 4 * dcRow(s.datacenters + 1)[0];
}

export function nextDatacenter(s: GameState): { n: number; add: number; cost: number } {
  const n = s.datacenters + 1;
  const [add, cost] = dcRow(n);
  if (s.stage >= 3 && n >= 9) return { n, add, cost: secondsOfRevenue(s, HALL_SECONDS_S3) };
  return { n, add, cost: s2(s, cost) };
}

export function secondsOfRevenue(s: GameState, seconds: number): number {
  const raw = seconds * Math.max(1, s.stats.revPerSec);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.round(raw / unit) * unit;
}

export function needsSite2(s: GameState): boolean {
  return s.stage >= 3 && s.datacenters + 1 >= 10 && s.flags['site2'] !== true;
}

export function datacenterCost(s: GameState): number {
  return nextDatacenter(s).cost;
}

export function powerScale(s: GameState): number {
  let m = 1;
  for (const e of s.effects) if (e.powerMult !== undefined) m *= e.powerMult;
  return m;
}

export function poweredGpus(s: GameState): number {
  return Math.floor((s.powerCapacityMW * powerScale(s) * 1000) / KW_PER_GPU);
}

export function activeG6(s: GameState): number {
  return Math.min(s.gpusG6 ?? 0, poweredGpus(s));
}

export function activeG5(s: GameState): number {
  return Math.min(s.gpusG5, Math.max(0, poweredGpus(s) - activeG6(s)));
}

export function activeG4(s: GameState): number {
  return Math.max(0, Math.min(s.gpus - s.gpusG5 - (s.gpusG6 ?? 0), poweredGpus(s) - activeG5(s) - activeG6(s)));
}

export function activeGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  return activeG4(s) + activeG5(s) + activeG6(s);
}

export function effGpus(s: GameState): number {
  return s.stage >= 5 ? earthGpus(s) + orbitalEffective(s) : earthGpus(s);
}

export const SWARM_TONNES = 1.5e8;
export const SWARM_BOOST = 20;

export function swarmFactor(s: GameState): number {
  return 1 + SWARM_BOOST * Math.min(1, s.s5.swarm / SWARM_TONNES);
}

export function orbitalEffective(s: GameState): number {
  if (s.stage < 5) return 0;
  return s.s5.orbitalGpus * s.s5.orbitalMult * swarmFactor(s);
}

export function earthGpus(s: GameState): number {
  if (s.stage < 2) return s.gpus;
  const owned = activeG4(s) + G5_COMPUTE * activeG5(s) + G6_COMPUTE * activeG6(s);
  return s.stage >= 4 ? owned + Math.max(0, s.s4.builtCompute) : owned;
}

export function powerDrawMW(s: GameState): number {
  return (activeGpus(s) * KW_PER_GPU) / 1000;
}

export function freePowerGpus(s: GameState): number {
  return Math.max(0, Math.floor((s.powerCapacityMW * 1000) / KW_PER_GPU) - s.gpus - inTransit(s));
}

export function freeSlots(s: GameState): number {
  return Math.max(0, gpuCapacity(s) - s.gpus - inTransit(s));
}

export function inTransit(s: GameState): number {
  return (s.shipments ?? []).reduce((a, o) => a + o.gpus, 0);
}

export const LOT_SIZES = [1000, 5000, 25000] as const;
export const LOT_SIZES_S3 = [10000, 25000, 100000] as const;
export const LOT_SECONDS_S3 = [4, 10, 40] as const;
export const SHIPMENT_SECONDS = 75;
export const SHIPMENTS_MAX = 2;

export function lotSizeS3(size: number): number {
  const i = (LOT_SIZES as readonly number[]).indexOf(size);
  if (i >= 0) return LOT_SIZES_S3[i]!;
  return (LOT_SIZES_S3 as readonly number[]).includes(size) ? size : 0;
}

export function lotPriceS3(s: GameState, n: number): number {
  const i = (LOT_SIZES_S3 as readonly number[]).indexOf(n);
  const secs = i >= 0 ? LOT_SECONDS_S3[i]! : (40 * n) / 100000;
  return Math.round(secondsOfRevenue(s, secs) * (s.flags['chipsDear'] === true ? 1.5 : 1));
}

export function shipmentSeconds(s: GameState): number {
  if (s.revealed['oversight'] === true) {
    const seats = Math.floor(s.govRelations / 10);
    if (seats >= 8) return 60;
    if (seats <= 5 && seats >= 4) return 90;
  }
  return SHIPMENT_SECONDS;
}

export const SHIPMENT_CAPACITY = 100000;

function joinable(s: GameState, n: number): Shipment | undefined {
  const q = s.shipments ?? [];
  if (q.length < 2) return undefined;
  const last = q[q.length - 1]!;
  const gen = s.flags['g6'] === true ? 6 : 5;
  return last.gen === gen && last.gpus + n <= SHIPMENT_CAPACITY ? last : undefined;
}

export function orderReasonS3(s: GameState, n: number): string {
  if ((s.shipments ?? []).length >= SHIPMENTS_MAX && !joinable(s, n)) return '2 / 2 on order';
  if (s.flags['blockade'] === true && s.flags['secondSource'] !== true) return 'the strait is closed';
  if (freeSlots(s) < n) return 'no room';
  if (freePowerGpus(s) < n) return 'no power';
  return '';
}

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
  if (s.shipments.length === 1 && s.flags['shipmentSaid'] !== true) {
    s.flags['shipmentSaid'] = true;
    say(s, `Shipment — ${fmtClock(secs)} until ${fmtInt(n)} Nimbus ${s.flags['g6'] === true ? 'G6' : 'G5'} arrive.`);
  }
}

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

export function nominalLot(_s: GameState): number {
  return LOT_SIZES[0];
}

export function lotFits(s: GameState, n: number): boolean {
  return freeSlots(s) >= n && freePowerGpus(s) >= n;
}

export function buildIncome(s: GameState): number {
  return buildFundOpen(s) ? Math.max(0, s.stats.revPerSec) * s.buildShare : 0;
}

export function fundsIncome(s: GameState): number {
  return Math.max(0, s.stats.revPerSec) * (buildFundOpen(s) ? 1 - s.buildShare : 1);
}

export function buildEta(s: GameState, cost: number): number {
  const short = cost - s.buildFund;
  if (short <= 0) return 0;
  const r = buildIncome(s);
  return r > 0 ? short / r : Infinity;
}

export const BUILD_SHARES = [0.25, 0.5, 0.75];

export function cycleBuildShare(s: GameState): boolean {
  if (!buildFundOpen(s)) return false;
  const i = BUILD_SHARES.findIndex((b) => Math.abs(b - s.buildShare) < 1e-9);
  s.buildShare = BUILD_SHARES[(i + 1) % BUILD_SHARES.length]!;
  press(s, 'buildShare');
  return true;
}

export const LOT_LADDER_S2 = [1000, 5000, 25000, 125000] as const;
export const LOT_FLEET_SHARE = 0.02;

export function lotSizes(s: GameState): readonly number[] {
  if (s.stage >= 3) return LOT_SIZES_S3;
  const min = LOT_FLEET_SHARE * s.gpus;
  let i = LOT_LADDER_S2.findIndex((n) => n >= min);
  if (i < 0 || i > LOT_LADDER_S2.length - 3) i = LOT_LADDER_S2.length - 3;
  return LOT_LADDER_S2.slice(i, i + 3);
}

export function buyLotRow(s: GameState, row: number): boolean {
  const n = lotSizes(s)[row];
  return n ? buyGpuBatch(s, n) : false;
}

export function buildWall(s: GameState): '' | 'power' | 'room' {
  const n = lotSizes(s)[0]!;
  if (lotFits(s, n)) return '';
  return freeSlots(s) < n && freeSlots(s) <= freePowerGpus(s) ? 'room' : 'power';
}

export function standingStall(s: GameState): '' | 'power' | 'room' {
  if (!standingOrderOn(s)) return '';
  if (s.buildFund < 120 * buildIncome(s) || s.buildFund < lotCostOf(s, lotSizes(s)[0]!)) return '';
  return buildWall(s);
}

export function lotSize(s: GameState): number {
  const n = lotSizes(s)[0]!;
  return lotFits(s, n) ? n : 0;
}

export function gpuUnitPrice(s: GameState): number {
  const exports = s.stage === 2 && s.lead < 1 ? 1.1 : 1;
  return (s.g5 ? G5_PRICE : G4_PRICE) * S2_FUNDS_SCALE * s2Scale(s) * exports;
}

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

export function lotReasonOf(s: GameState, n: number): '' | 'no room' | 'no power' {
  if (lotFits(s, n)) return '';
  if (freeSlots(s) < n && freeSlots(s) <= freePowerGpus(s)) return 'no room';
  return 'no power';
}

export function lotReason(s: GameState): '' | 'no room' | 'no power' {
  return lotReasonOf(s, lotSizes(s)[0]!);
}

export function lotReturn(s: GameState, n: number): number {
  const eff = Math.max(1, effGpus(s));
  const add = n * (s.stage >= 3 && s.flags['g6'] === true ? G6_COMPUTE : s.g5 ? G5_COMPUTE : 1);
  const taskRevenue = Math.max(0, s.stats.revPerSec - Math.max(0, s.contractIncome || 0));
  return taskRevenue * (Math.sqrt(1 + add / eff) - 1);
}

export function standingOrderOn(s: GameState): boolean {
  return s.standingOrder && isBought(s, 'p_standing_order');
}

function addLot(s: GameState, lot: number, cost: number): void {
  payBuild(s, cost);
  s.gpus += lot;
  if (s.g5) s.gpusG5 += lot;
}

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

export function toggleStanding(s: GameState): boolean {
  if (!isBought(s, 'p_standing_order') || !s.revealed['standingOrder']) return false;
  s.standingOrder = !s.standingOrder;
  press(s, 'toggleStanding');
  return true;
}

export const DC_BUILD_SECONDS = 90;
export const DC_PERMIT_SECONDS = 60;

export function dcBuildSeconds(s: GameState): number {
  return DC_BUILD_SECONDS + (s.approval < -30 ? DC_PERMIT_SECONDS : 0);
}

export function datacenterBuilding(s: GameState): PowerOrder | undefined {
  return s.powerQueue.find((o) => o.kind === 'datacenter');
}

export function datacenterReason(s: GameState): '' | 'building' {
  return datacenterBuilding(s) ? 'building' : '';
}

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

export const GAS_BASE = 60000;

export function gasCost(s: GameState): number {
  return threeFigures(s2(s, GAS_BASE * Math.pow(1.7, s.gasPlants)));
}

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
  if (s.stage >= 3) return Math.round(secondsOfRevenue(s, REACTOR_SECONDS_S3) * (s.govRelations >= 60 ? 0.75 : 1));
  const n = s.reactors + queued(s, 'nuclear').length;
  return s2(s, 15000000 * Math.pow(2, n) * (s.govRelations >= 60 ? 0.75 : 1));
}

export function reactorQueueFull(s: GameState): boolean {
  return s.stage >= 3 && queued(s, 'nuclear').length >= REACTOR_QUEUE_MAX;
}

export function solarQueueFull(s: GameState): boolean {
  return queued(s, 'solar').length >= SOLAR_QUEUE_MAX;
}

export const GOV_QUEUE_BAND = 80;

export function solarSeconds(s: GameState): number {
  const base = s.btm ? BTM_QUEUE_SECONDS : SOLAR_QUEUE_SECONDS;
  return s.govRelations >= GOV_QUEUE_BAND ? Math.round(base / 2) : base;
}

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

function solarEta(s: GameState, index: number): number {
  const solar = queued(s, 'solar');
  let t = 0;
  for (let i = 0; i <= index && i < solar.length; i++) t += solar[i]!.remaining;
  return t;
}

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

export function queueNuclear(s: GameState): void {
  const first = s.reactors + queued(s, 'nuclear').length === 0;
  const mw = s.stage >= 3 ? REACTOR_MW_S3 : NUCLEAR_MW;
  const seconds = REACTOR_SECONDS + (s.stage >= 3 && s.approval <= -30 ? DC_PERMIT_SECONDS : 0);
  s.powerQueue.push({ kind: 'nuclear', mw, remaining: seconds, label: s.stage >= 3 ? 'the reactor' : 'the Nuclear PPA' });
  if (!handedOver(s)) say(s, `Reactor restart — ${fmtClock(seconds)} until ${s.stage >= 3 ? `${fmtInt(mw)} MW come online` : 'the Nuclear PPA delivers'}.`);
  if (first) logNews(s, 'A shuttered reactor in the Midwest is restarting. Its only customer is OpenMind.');
}

function handedOver(s: GameState): boolean {
  return s.stage >= 3 && s.flags['buildout'] === true;
}

export function queueGulf(s: GameState): void {
  s.powerQueue.push({ kind: 'gulf', mw: GULF_MW, remaining: GULF_SECONDS, label: 'Al-Marsa' });
  s.gulfExposure = 1;
  say(s, `Al-Marsa — ${fmtClock(GULF_SECONDS)} until the Gulf site is energised.`);
}

export function applyBehindTheMeter(s: GameState): void {
  s.btm = true;
  for (const o of s.powerQueue) if (o.kind === 'solar') o.remaining = Math.min(o.remaining, BTM_QUEUE_SECONDS);
}

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

export function roomFixS3(s: GameState): string {
  if (needsSite2(s)) return 'Datacenter 10 needs the New Carlisle campus (build fund or funds)';
  const hall = s.powerQueue.find((o) => o.kind === 'datacenter');
  if (hall) return `${hall.label ?? 'a hall'} is going up — ${fmtClock(Math.ceil(hall.remaining))}`;
  return s.flags['buildout'] === true ? 'the build-out orders the next hall' : `Build Datacenter ${nextDatacenter(s).n}`;
}

export function powerFixS3(s: GameState): string {
  const reactor = s.powerQueue.find((o) => o.kind === 'nuclear');
  if (reactor) return `a reactor is restarting — ${fmtClock(Math.ceil(reactor.remaining))}`;
  return s.flags['buildout'] === true ? 'the build-out orders a reactor' : 'a reactor adds 1,000 MW';
}

export function queuedMW(s: GameState): number {
  return s.powerQueue.reduce((a, o) => a + o.mw, 0);
}

export function infrastructureMessages(s: GameState): void {
  if ((s.stage !== 2 && s.stage !== 3) || !s.revealed['infrastructure']) return;
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
