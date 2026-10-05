import { GameState, say, press, counter } from './state.js';
import { fmtInt, fmtClock, fmtShortNum, fmtTonnes } from './format.js';

export const MINE_RATE = 0.5;
export const REPLICATE_RATE = 0.0065;
export const BUILD_RATE = 0.5;
export const ROBOT_TONNES = 40;
export const GPU_TONNES = 0.02;
export const CHIPS_SECONDS = 150;
export const CAR_PLANT_ROBOTS = 10000;
export const PERMITS = { start: 400000, none: 1200000, dividend: 4800000 };
export function chipsRate(s: GameState): number {
  return (s.s4.chips / CHIPS_SECONDS) * (s.flags['chipLines'] === true ? CHIP_LINES : 1);
}

export const CHIP_LINES = 1.25;

export const GOAL_SHARE = 0.2;

export type FleetJob = 'mine' | 'replicate' | 'build' | 'chips';

export function permitsOpen(s: GameState): boolean {
  return s.flags['zones'] === 'open';
}

export function permitCap(s: GameState): number {
  return permitsOpen(s) ? Infinity : s.s4.permitCap;
}

export function atPermitCap(s: GameState): boolean {
  return !permitsOpen(s) && s.robots >= s.s4.permitCap - 0.5;
}

export function fleetAuto(s: GameState): boolean {
  return s.flags['fleetAuto'] === true;
}

function goalOutput(s: GameState): number {
  if (!fleetAuto(s)) return 1;
  return s.s4.fleetGoal === 'growth' ? 1.25 : 1 - GOAL_SHARE;
}

function goalGrowth(s: GameState): number {
  if (!fleetAuto(s)) return 1;
  return s.s4.fleetGoal === 'growth' ? 1 : 1 - GOAL_SHARE;
}

export function minedPerSec(s: GameState): number {
  return s.robots * s.s4.mine * MINE_RATE * s.s4.techMine * s.s4.zoneMult * goalOutput(s);
}

export const OPEN_ZONES_CEILING = 30e6;

export function replicateWant(s: GameState): number {
  const crowding = permitsOpen(s) ? Math.max(0, 1 - s.robots / OPEN_ZONES_CEILING) : 1;
  return s.robots * s.s4.replicate * REPLICATE_RATE * s.s4.techRep * goalGrowth(s) * crowding;
}

export function buildWant(s: GameState): number {
  return s.robots * s.s4.build * BUILD_RATE * s.s4.techBuild * s.s4.zoneMult * goalOutput(s);
}

export function jobBlock(s: GameState, job: FleetJob): '' | 'out of materials' | 'at the permit cap' {
  if (job === 'replicate') {
    if (s.s4.replicate > 0 && atPermitCap(s)) return 'at the permit cap';
    if (s.s4.replicate > 0 && s.s4.materials < ROBOT_TONNES && minedPerSec(s) < replicateWant(s) * ROBOT_TONNES) return 'out of materials';
  }
  if (job === 'build' && s.s4.build > 0 && s.s4.materials < 1 && minedPerSec(s) <= 0) return 'out of materials';
  return '';
}

export function replicatedPerSec(s: GameState): number {
  const room = permitsOpen(s) ? Infinity : Math.max(0, s.s4.permitCap - s.robots);
  const want = replicateWant(s);
  const byMaterials = (minedPerSec(s) + s.s4.materials / 10) / ROBOT_TONNES;
  return Math.max(0, Math.min(want, room, byMaterials));
}

export function builtPerSec(s: GameState): number {
  const left = Math.max(0, minedPerSec(s) - replicatedPerSec(s) * ROBOT_TONNES) + s.s4.materials / 10;
  return Math.max(0, Math.min(buildWant(s), left / GPU_TONNES));
}

export function doublingSeconds(s: GameState): number {
  const r = replicatedPerSec(s);
  return r > 0 ? (s.robots * Math.LN2) / r : Infinity;
}

export function updateFleet(s: GameState, dt: number): void {
  const f = s.s4;
  if (s.robots <= 0) return;
  if (fleetAuto(s)) autoAssign(s);
  const mined = minedPerSec(s) * dt;
  f.materials += mined;
  const room = permitsOpen(s) ? Infinity : Math.max(0, f.permitCap - s.robots);
  const reps = Math.max(0, Math.min(replicateWant(s) * dt, f.materials / ROBOT_TONNES, room));
  f.materials -= reps * ROBOT_TONNES;
  s.robots += reps;
  f.robotsBuilt += reps;
  const built = Math.max(0, Math.min(buildWant(s) * dt, f.materials / GPU_TONNES));
  f.materials -= built * GPU_TONNES;
  f.builtCompute += built;
  if (f.chips > 0 && f.chipsInstalled < 1) f.chipsInstalled = Math.min(1, f.chipsInstalled + chipsRate(s) * dt);
  if (f.nanoDrain > 0) f.materials = Math.max(0, f.materials - NANO_DRAIN * dt);
  f.materials = Math.max(0, f.materials);
}

export const NANO_DRAIN = 4100;

export function autoAssign(s: GameState): void {
  const f = s.s4;
  const capped = atPermitCap(s) || (!permitsOpen(s) && s.robots >= 0.97 * f.permitCap);
  const chipsOpen = s.revealed['fleetChips'] === true && f.chipsInstalled < 1;
  const chips = chipsOpen && f.fleetGoal === 'treaty' ? 0.5 : chipsOpen ? 0.25 : 0;
  const rest = 1 - chips;
  let mine = capped ? 0.3 : 0.35;
  if (f.materials < 1000) mine = Math.min(0.6, mine + 0.15);
  const replicate = capped ? 0 : 0.4;
  setShares(s, mine * rest, replicate * rest, Math.max(0, rest - mine * rest - replicate * rest), chips);
}

function setShares(s: GameState, mine: number, replicate: number, build: number, chips: number): void {
  const r = (x: number) => Math.round(x * 20) / 20;
  s.s4.mine = r(mine);
  s.s4.replicate = r(replicate);
  s.s4.chips = r(chips);
  s.s4.build = Math.max(0, r(Math.min(build, 1 - s.s4.mine - s.s4.replicate - s.s4.chips)));
}

export function idleShare(s: GameState): number {
  return Math.max(0, 1 - s.s4.mine - s.s4.replicate - s.s4.build - s.s4.chips);
}

export function setFleetShare(s: GameState, job: FleetJob, pct: number): boolean {
  if (s.stage !== 4 || !s.revealed['robotFleet'] || fleetAuto(s) || !Number.isFinite(pct)) return false;
  if (job === 'chips' && !s.revealed['fleetChips']) return false;
  const f = s.s4;
  const others = (['mine', 'replicate', 'build', 'chips'] as const).filter((j) => j !== job).reduce((a, j) => a + f[j], 0);
  const v = Math.max(0, Math.min(1 - others, Math.round(pct / 5) * 5 / 100));
  if (Math.abs(f[job] - v) < 1e-9) return false;
  f[job] = Math.round(v * 100) / 100;
  press(s, `fleet:${job}`);
  press(s, 'fleet');
  return true;
}

export function setFleetGoal(s: GameState, goal: 'growth' | 'people' | 'treaty'): boolean {
  if (s.stage !== 4 || !fleetAuto(s) || s.s4.fleetGoal === goal) return false;
  s.s4.fleetGoal = goal;
  press(s, 'fleetGoal');
  return true;
}

export function jobLine(s: GameState, job: FleetJob): string {
  const block = jobBlock(s, job);
  if (block) return block;
  if (job === 'mine') return `+${fmtShortNum(minedPerSec(s))} t/s`;
  if (job === 'replicate') {
    const r = replicatedPerSec(s);
    const dbl = doublingSeconds(s);
    return `+${fmtShortNum(r)} robots/s${Number.isFinite(dbl) && dbl < 3600 ? `, doubling in ${fmtClock(dbl)}` : ''}`;
  }
  if (job === 'build') return `+${fmtShortNum(builtPerSec(s))} GPUs/s`;
  const rate = chipsRate(s);
  const left = rate > 0 ? (1 - s.s4.chipsInstalled) / rate : Infinity;
  return Number.isFinite(left) ? `done in ${fmtClock(left)}` : 'nothing installing';
}

export function fleetStatus(s: GameState, model: string): string {
  const p = (x: number) => Math.round(x * 100);
  const chips = s.s4.chips > 0 ? ` / ${p(s.s4.chips)} chips` : '';
  return `Fleet: ${p(s.s4.mine)} / ${p(s.s4.replicate)} / ${p(s.s4.build)}${chips}, set by ${model}`;
}

export function materialsTerms(s: GameState): [string, number][] {
  const out: [string, number][] = [['mines', minedPerSec(s)]];
  out.push(['robots', -replicatedPerSec(s) * ROBOT_TONNES]);
  out.push(['datacenters', -builtPerSec(s) * GPU_TONNES]);
  if (s.s4.nanoDrain > 0) out.push(['unaccounted', -NANO_DRAIN]);
  return out;
}

export function fleetWalls(s: GameState): void {
  const now = s.stats.timePlayed;
  if (atPermitCap(s) && s.s4.replicate > 0 && !fleetAuto(s)) {
    if (now - counter(s, 'permitSaidAt') >= 180) {
      s.flags['permitSaidAt'] = now;
      const fix = s.flags['zones'] === undefined ? 'The fleet cannot grow without zones: see Special Economic Zones.' : 'Move replication to building.';
      say(s, `Robots: ${fmtInt(s.robots)} of ${fmtInt(s.s4.permitCap)} permitted. ${fix}`);
    }
  }
  if (s.s4.materials < 1 && minedPerSec(s) <= 0 && (s.s4.replicate > 0 || s.s4.build > 0) && !fleetAuto(s)) {
    if (now - counter(s, 'materialsSaidAt') >= 180) {
      s.flags['materialsSaidAt'] = now;
      say(s, `The fleet has nothing to build with. Robots on mines: ${Math.round(s.s4.mine * 100)}%.`);
    }
  }
}

export const HOUSING_SECONDS = 3;
export const HOUSING_HEAT = 1.2;
export const HOUSING_APPROVAL = 0.3;

export function housingCost(s: GameState, units = 1): number {
  const base = Math.max(100, HOUSING_SECONDS * minedPerSec(s));
  let total = 0;
  for (let k = 0; k < units; k++) total += base * Math.pow(HOUSING_HEAT, s.s4.housingHeat + k);
  return Math.round(total);
}

export function buildHousing(s: GameState, units = 1): boolean {
  if (s.stage !== 4 || !s.revealed['housing']) return false;
  const n = Math.max(1, Math.floor(units));
  const cost = housingCost(s, n);
  if (s.s4.materials < cost) return false;
  s.s4.materials -= cost;
  s.s4.housingUnits += n;
  s.s4.housingHeat += n;
  s.s4.housingAt = s.stats.timePlayed;
  press(s, 'housing');
  return true;
}

export const HOUSING_RELAX_SECONDS = 25;

export function relaxHousing(s: GameState): void {
  if (s.s4.housingHeat > 0 && s.stats.timePlayed - s.s4.housingAt >= HOUSING_RELAX_SECONDS) {
    s.s4.housingHeat -= 1;
    s.s4.housingAt = s.stats.timePlayed;
  }
}

export function housingLine(s: GameState): string {
  return `${fmtTonnes(housingCost(s))}`;
}
