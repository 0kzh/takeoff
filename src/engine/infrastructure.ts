import { GameState, PowerOrder, say, logNews, addFunds, press, isBought } from './state.js';
import { fmtInt, fmtNum, fmtClock } from './format.js';
import { trainCost, runOtherwiseReady } from './training.js';

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
export const S2_FUNDS_SCALE = 2.0;

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
export const G5_PRICE = 90;

/** Datacenters, hand-tuned (UP factory style): slots added and scale-1 price. The first is Break ground. */
const DC_TABLE: [number, number][] = [
  [10000, 0],
  [15000, 250000],
  [25000, 800000],
  [50000, 2000000],
  [75000, 4000000],
  [125000, 8000000],
  [200000, 15000000],
  [300000, 27000000],
  [450000, 50000000],
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

export function gpuCapacity(s: GameState): number {
  return datacenterSlots(s.datacenters);
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

/** 1,000 while the fleet is under 25,000; 5,000 under 100,000; 25,000 after. */
export function nominalLot(s: GameState): number {
  if (s.gpus < 25000) return 1000;
  if (s.gpus < 100000) return 5000;
  return 25000;
}

/** What the lot button sells now: the nominal lot, cut to the room and power there is, in thousands. */
export function lotSize(s: GameState): number {
  return Math.floor(Math.min(nominalLot(s), freeSlots(s), freePowerGpus(s)) / 1000) * 1000;
}

export function gpuUnitPrice(s: GameState): number {
  return (s.g5 ? G5_PRICE : G4_PRICE) * S2_FUNDS_SCALE;
}

/** The lot the button names: the actual lot, or the nominal one while it is blocked. */
export function shownLot(s: GameState): number {
  const lot = lotSize(s);
  return lot >= 1000 ? lot : nominalLot(s);
}

export function lotCost(s: GameState): number {
  return Math.round(shownLot(s) * gpuUnitPrice(s));
}

/** Why the lot button is greyed for a reason other than money ('' when it is not). */
export function lotReason(s: GameState): '' | 'no room' | 'no power' | 'standing order' {
  if (standingOrderOn(s)) return 'standing order';
  if (lotSize(s) >= 1000) return '';
  if (freeSlots(s) < 1000 && freeSlots(s) <= freePowerGpus(s)) return 'no room';
  return 'no power';
}

export function standingOrderOn(s: GameState): boolean {
  return s.standingOrder && isBought(s, 'p_standing_order');
}

function addLot(s: GameState, lot: number, cost: number): void {
  addFunds(s, -cost);
  s.gpus += lot;
  if (s.g5) s.gpusG5 += lot;
}

/**
 * The player's Buy GPUs. While the standing order is on, it buys the lots (keeping the next run's
 * money in reserve) and the button waits on it: no verb is pressed by hand once it is automated.
 */
export function buyGpuBatch(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['infrastructure'] || standingOrderOn(s)) return false;
  const lot = lotSize(s);
  if (lot < 1000) return false;
  const cost = Math.round(lot * gpuUnitPrice(s));
  if (s.funds < cost) return false;
  addLot(s, lot, cost);
  s.gpuBatches += 1;
  press(s, 'gpuLot');
  return true;
}

/**
 * Standing order, once a second: a lot that fits, keeping the next run's money in hand whenever that
 * run is otherwise ready to start (its research and data are there and a pipeline is free).
 */
export function runStandingOrder(s: GameState): void {
  if (s.stage < 2 || !standingOrderOn(s)) return;
  const reserve = runOtherwiseReady(s) ? (trainCost(s).funds ?? 0) : 0;
  let guard = 0;
  while (guard++ < 3) {
    const lot = lotSize(s);
    if (lot < 1000) return;
    const cost = Math.round(lot * gpuUnitPrice(s));
    if (s.funds < cost + reserve) return;
    addLot(s, lot, cost);
    s.flags['standingLots'] = ((s.flags['standingLots'] as number) || 0) + 1;
  }
}

export function toggleStanding(s: GameState): boolean {
  if (!isBought(s, 'p_standing_order') || !s.revealed['standingOrder']) return false;
  s.standingOrder = !s.standingOrder;
  press(s, 'toggleStanding');
  return true;
}

/**
 * Room to spare: free slots already exceed the fleet, so another hall would stand empty. (An
 * addition to stage2.md §2.1, like `no power` on the lot button: building ahead is allowed up to
 * twice the fleet; past that the button says why it waits.)
 */
export function roomToSpare(s: GameState): boolean {
  return freeSlots(s) > Math.max(5000, s.gpus);
}

/** Power to spare: the plants online and queued already cover every GPU slot. */
export function powerToSpare(s: GameState): boolean {
  return s.powerCapacityMW + queuedMW(s) >= gpuCapacity(s) / 1000;
}

export function datacenterReason(s: GameState): '' | 'room to spare' {
  return roomToSpare(s) ? 'room to spare' : '';
}

/** Why a plant button is greyed for a reason other than money ('' when it is not). */
export function plantReason(s: GameState, kind: 'gas' | 'solar' | 'nuclear'): '' | 'power to spare' | 'queue full' {
  if (kind === 'solar' && solarQueueFull(s)) return 'queue full';
  if (powerToSpare(s)) return 'power to spare';
  return '';
}

export function buildDatacenter(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['dcButton'] || roomToSpare(s)) return false;
  const next = nextDatacenter(s);
  if (s.funds < next.cost) return false;
  addFunds(s, -next.cost);
  s.datacenters = next.n;
  press(s, 'datacenter');
  say(s, `Datacenter ${next.n} complete. Room for ${fmtInt(gpuCapacity(s))} GPUs.`);
  return true;
}

// ---------- plants ----------

export function gasCost(s: GameState): number {
  return s2(90000 * Math.pow(1.7, s.gasPlants));
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
    say(s, `Gas turbines online. +20 MW, ${fmtInt(s.powerCapacityMW)} MW in all.`);
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
  s.powerQueue.push({ kind: 'solar', mw: SOLAR_MW, remaining: solarSeconds(s), label: `Solar farm ${n}` });
  press(s, 'solar');
  const eta = solarEta(s, queued(s, 'solar').length - 1);
  say(s, `The Interconnect Queue — ${fmtClock(eta)} until Solar farm ${n} is connected.`);
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
    s.powerCapacityMW += o.mw;
    if (o.kind === 'solar') {
      s.solarFarms += 1;
      say(s, `${o.label} connected. +${o.mw} MW.`);
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

/** The panel's queue line: `Interconnect queue: Solar farm 2 — 2:41 · 1 waiting`; '' when empty. */
export function queueLine(s: GameState): string {
  const parts: string[] = [];
  const solar = queued(s, 'solar');
  if (solar.length) {
    const waiting = solar.length - 1;
    parts.push(`Interconnect queue: ${solar[0]!.label} — ${fmtClock(Math.ceil(solar[0]!.remaining))}${waiting ? ` · ${waiting} waiting` : ''}`);
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
      say(s, `No power for more GPUs — ${fmtNum(powerDrawMW(s), 1)} of ${fmtInt(s.powerCapacityMW)} MW in use. ${fix}`);
    }
  } else if (reason === 'no room') {
    const key = `noRoom:${s.datacenters}`;
    if (!s.flags[key]) {
      s.flags[key] = true;
      say(s, `No room for more GPUs — ${fmtInt(gpuCapacity(s))} slots, all full. Build Datacenter ${s.datacenters + 1}.`);
    }
  }
}
