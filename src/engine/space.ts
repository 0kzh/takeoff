import { GameState, say, logNews, press, counter, Mission, SpaceRow, newStage5 } from './state.js';
import { fmtInt, fmtNum, fmtClock, fmtShortNum, fmtBig, fmtSmallPct, dateLabel } from './format.js';
import { bestCapability, copiesOnline } from './economy.js';
import { earthGpus, orbitalEffective, swarmFactor, SWARM_TONNES, SWARM_BOOST } from './infrastructure.js';
import { genName } from './training.js';
import { openChoice, takeDefault } from './events.js';
import { visibleProjects, projectById, buyProject } from './projects.js';
import { PEOPLE_LINES, PEOPLE_LINES_MORE, PEOPLE_AT, PEOPLE_EVERY, COLD_LINE, INFRA_LINES, CONCORD_LINES } from '../data/stage5.js';
import type { ProjectDef } from '../data/projects.js';

/**
 * Stage 5, "Beyond" (stage5.md §1–§2): one flow of mass to orbit and two purses. The flow accrues to
 * `matter`, which pays for the rows (Foundries grow the flow, Orbital datacenters compute, Collectors
 * build the swarm that powers them, Probes); while a priced mission waits, the share of the flow the
 * Industry share leaves fills the mission fund instead, up to what the board costs. Missions build one at
 * a time. The Autofactory hands over a standing split. Generations arrive by themselves and change
 * capability only. The skin (Concord or Silence) was decided at Stage 4's exit and is read only by the
 * people lines, the cards' buttons, Silence's late take-over and the last project. DOM-free.
 *
 * Everything exported here that a data module reads at load is a function declaration: the data modules
 * are evaluated inside an import cycle with this one.
 */

/** A tonne spent on Foundries adds this many t/s to the flow, times the industry multiplier. */
export const FOUNDRY_RETURN = 0.0065;
/** A tonne spent on Orbital datacenters adds this many G4-equivalents (no power, permits or weather). */
export const GPUS_PER_TONNE = 30000;
/** A unit is 2 s of the flow (after the Autofactory, 2 s of the `By hand` share, never under 0.2 s). */
export const UNIT_SECONDS = 2;
export const UNIT_FLOOR_SECONDS = 0.2;
/** A probe is 20 s of the flow. */
export const PROBE_SECONDS = 20;
/** Earth's compute, robots and power grow by this share a second by themselves (§1.1). */
export const EARTH_GROWTH = 0.0003;
/** A generation every 150 s, ×1.4, the first at 2:30 (as-built deltas row 3). */
export const GEN_SECONDS_S5 = 150;
export const GEN_GAIN_S5 = 1.4;
/** Self-replicating foundries: the flow grows 0.3 % a second by itself. */
export const SELF_REPLICATION = 0.003;
/** A probe builds another every 3:00 (4:00 with the Spec, 2:00 with the relay). */
export const PROBE_DOUBLING = 180;
export const PROBE_DOUBLING_SPEC = 240;
export const PROBE_DOUBLING_RELAY = 120;
export const PROBE_FIRST = 1;
/** The Industry share's three settings; it starts at 75 %. */
export const INDUSTRY_SHARES = [0.5, 0.75, 0.9];
/** Mercury in the game's tonnes (stylised): the row falls visibly while it is mined. */
export const MERCURY_TONNES = 1e10;
export const PEOPLE_AT_SHACKLETON = 11000;
/** Silence: missions start themselves from 0.003 %; the cold line at 0.005 %; the rows are taken at 0.006 %. */
export const SILENCE_MISSIONS_AT = 0.003;
export const COLD_AT = 0.005;
export const ROWS_TAKEN_AT = 0.006;
/** The last project (and Final instructions) at 0.01 %; Final instructions 60–120 s after the rows are taken. */
export const LAST_PROJECT_AT = 0.01;
export const FINAL_AFTER_MIN = 60;
export const FINAL_AFTER_MAX = 120;
/** Silence's split once the rows are taken: Foundries, Datacenters, Collectors. */
export const SILENCE_SPLIT: Record<SpaceRow, number> = { foundry: 0.15, orbital: 0.25, collector: 0.6 };
/** A wall line repeats every 180 s while it holds, six times a stage at most (G23, G29). */
export const WALL_SECONDS = 180;
export const WALL_MAX = 6;

export const ROWS: SpaceRow[] = ['foundry', 'orbital', 'collector'];
export type BuyRow = SpaceRow | 'probe';
export const ROW_TITLES: Record<BuyRow, string> = { foundry: 'Foundries', orbital: 'Orbital datacenters', collector: 'Collectors', probe: 'Probes' };
const ROW_FLAGS: Record<BuyRow, string> = { foundry: 'rowFoundry', orbital: 'rowOrbital', collector: 'collectors', probe: 'rowProbe' };

// ---------- reading the stage ----------

/** Seconds into Stage 5. */
export function ts5(s: GameState): number {
  return s.stats.timeInStage;
}

/** Which skin runs: decided once at Stage 4's exit (`alignedAtHandover`), never shown. */
export function concord(s: GameState): boolean {
  return s.stage === 5 && s.flags['skin'] !== 'silence';
}

export function silence(s: GameState): boolean {
  return s.stage === 5 && s.flags['skin'] === 'silence';
}

/** The dev switch and the sim's skin test (D7): sets the verdict and the skin together. */
export function setSkin(s: GameState, aligned: boolean): void {
  s.flags['alignedAtHandover'] = aligned;
  s.flags['skin'] = aligned ? 'concord' : 'silence';
}

export function launchDone(s: GameState): boolean {
  return s.s5.massFlow > 0;
}

/** Tonnes a launch puts in orbit each second: 150, or 300 with the launch study. */
export function launchRate(s: GameState): number {
  return s.flags['launchStudy'] === true ? 300 : 150;
}

/** The swarm as a share of the Sun's output, in percent (150M t is 0.01 %). */
export function swarmPct(s: GameState): number {
  return (s.s5.swarm / SWARM_TONNES) * 0.01;
}

export function swarmReached(s: GameState, pct: number): boolean {
  return s.s5.swarm >= (pct / 0.01) * SWARM_TONNES * (1 - 1e-9);
}

/** `0.0034%`. */
export function swarmPctLabel(s: GameState): string {
  return `${fmtSmallPct(swarmPct(s))}%`;
}


export function splitOn(s: GameState): boolean {
  return s.revealed['split'] === true;
}

/** Silence has taken the rows, the split and the share (§2.4). */
export function rowsTaken(s: GameState): boolean {
  return typeof s.flags['rowsTakenAt'] === 'number';
}

/** What the sliders leave, by hand (1 before the Autofactory; 0 once Silence has the rows). */
export function byHandShare(s: GameState): number {
  if (rowsTaken(s)) return 0;
  if (!splitOn(s)) return 1;
  const f = s.s5.split;
  return Math.max(0, 1 - f.foundry - f.orbital - f.collector);
}

// ---------- the two purses ----------

/** A mission card on the board that is waiting to be bought and costs the fund something. */
export function waitingMissions(s: GameState): ProjectDef[] {
  if (s.stage !== 5) return [];
  return visibleProjects(s).filter((p) => !!p.mission && (p.cost(s).fund ?? 0) > 0);
}

/** What the missions on the board cost: the most the fund ever holds. */
export function boardCost(s: GameState): number {
  return waitingMissions(s).reduce((a, p) => a + (p.cost(s).fund ?? 0), 0);
}

/** The share of the flow reaching matter now: the Industry share while the fund is short of the board, else all of it. */
export function matterShareNow(s: GameState): number {
  return boardCost(s) > s.s5.missionFund + 1e-6 ? s.s5.industryShare : 1;
}

/** Tonnes a second reaching matter (before the split spends its shares). */
export function matterRate(s: GameState): number {
  return s.s5.massFlow * matterShareNow(s);
}

/** Tonnes a second the fund fills at while it is short. */
export function fundRate(s: GameState): number {
  return s.s5.massFlow * (1 - s.s5.industryShare);
}

/** A unit of a row in tonnes: 2 s of the flow; after the Autofactory 2 s of the by-hand share (≥ 0.2 s). */
export function unitCost(s: GameState, row: BuyRow): number {
  const F = s.s5.massFlow;
  if (row === 'probe') return PROBE_SECONDS * F;
  if (!splitOn(s)) return UNIT_SECONDS * F;
  return Math.max(UNIT_FLOOR_SECONDS * F, UNIT_SECONDS * F * byHandShare(s));
}

// ---------- the arrival (§1.1) ----------

/**
 * Stage 5's state on entering: the skin from the verdict, Stage 4's timers dropped (none fires, finishes
 * or prints here), the first generation in 2:30. The copies' split, the rogue copies and the universal
 * basic income stay as the arrival left them, so tasks a second do not move at the gate (G32).
 */
export function arriveStage5(s: GameState): void {
  s.s5 = newStage5();
  s.flags['skin'] = s.flags['alignedAtHandover'] === true ? 'concord' : 'silence';
  const f = s.s4;
  f.gen = null;
  f.nanoLeft = 0;
  f.nanoDrain = 0;
  f.outageLeft = 0;
  f.agenda = [];
  f.askLeft = 0;
  if (f.ashfordPhase === 'spreading') f.ashfordLeft = 0;
  if (f.baiwen === 'verifying') f.baiwenLeft = 0;
  s.flags['concordLeft'] = 0;
  delete s.flags['majorDue4'];
  delete s.flags['revokeDue'];
  delete s.flags['consolidationAgainAt'];
  delete s.flags['held'];
  s.scheduled = [];
  s.effects = [];
  s.activeChoice = null;
  s.choiceQueue = [];
  s.flags['s5ArrivedAt'] = s.stats.timePlayed;
  s.flags['tasksAtArrival5'] = s.tasks;
  s.flags['capAtArrival5'] = Math.round(bestCapability(s) * 10) / 10;
}

// ---------- the flow ----------

function addPart(s: GameState, part: string, amount: number): void {
  const parts = s.s5.flowParts;
  parts[part] = (parts[part] ?? 0) + amount;
}

/** Launch contracts: a launch every second, 150 t (300 with the launch study); the first two Stores rows and Foundries. */
export function setLaunchFlow(s: GameState): void {
  const rate = launchRate(s);
  s.s5.massFlow = rate;
  s.s5.flowParts = { launch: rate };
  s.revealed['launchRow'] = true;
  s.revealed['matterRow'] = true;
  s.revealed['rowFoundry'] = true;
  s.flags['launchAt'] = s.stats.timePlayed;
}

/** `F ×n` (the mass driver, Mercury): the difference is that mission's part of the flow. */
export function multiplyFlow(s: GameState, by: number, part: string): void {
  const added = s.s5.massFlow * (by - 1);
  s.s5.massFlow += added;
  addPart(s, part, added);
}

/** Spending tonnes of matter on a row (by hand or by a slider). */
export function spendOn(s: GameState, row: SpaceRow, x: number): void {
  if (x <= 0) return;
  const f = s.s5;
  f.spent[row] = (f.spent[row] ?? 0) + x;
  if (row === 'foundry') {
    const add = x * FOUNDRY_RETURN * f.techIndustry;
    f.massFlow += add;
    addPart(s, s.flags['mined'] === true ? 'mined' : 'foundries', add);
  } else if (row === 'orbital') {
    f.orbitalGpus += x * GPUS_PER_TONNE;
  } else {
    f.swarm += x;
  }
}

/**
 * Every tick: the flow grows by itself (self-replicating foundries); what reaches orbit fills the fund
 * while a mission waits and the fund is short of the board (the share the Industry share leaves), and the
 * rest is matter; the split spends its shares of that at once; Silence, once it has the rows, spends it all.
 */
function flowTick(s: GameState, dt: number): void {
  const f = s.s5;
  const board = boardCost(s);
  s.revealed['missionFund'] = board > 0;
  if (board > 0 && !s.revealed['industryShare']) {
    s.revealed['industryShare'] = true;
    say(s, 'Missions are paid from their own fund: a quarter of the flow, while one is waiting.');
  }
  if (f.massFlow <= 0) return;
  if (f.flowGrowth > 0) {
    const g = f.massFlow * f.flowGrowth * dt;
    f.massFlow += g;
    addPart(s, 'self-replicating', g);
  }
  const inflow = f.massFlow * dt;
  const short = Math.max(0, board - f.missionFund);
  const toFund = short > 0 ? Math.min(short, inflow * (1 - f.industryShare)) : 0;
  f.missionFund += toFund;
  let toMatter = inflow - toFund;
  if ((f.flowParts['Mercury'] ?? 0) > 0) f.mercuryTaken += (f.flowParts['Mercury'] ?? 0) * dt;
  if (rowsTaken(s)) {
    // It buys what is needed: everything that reaches matter, and what was left in hand, 15 / 25 / 60.
    const all = toMatter + f.matter;
    f.matter = 0;
    for (const row of ROWS) spendOn(s, row, all * SILENCE_SPLIT[row]);
    return;
  }
  if (splitOn(s)) {
    for (const row of ROWS) spendOn(s, row, toMatter * f.split[row]);
    toMatter *= byHandShare(s);
  }
  f.matter += toMatter;
}

// ---------- the rows, the split, the share (the player's verbs) ----------

export function rowOpen(s: GameState, row: BuyRow): boolean {
  return s.stage === 5 && !s.ending && !rowsTaken(s) && launchDone(s) && s.revealed[ROW_FLAGS[row]] === true;
}

/** Whole units the matter in hand buys of a row now. */
export function unitsAffordable(s: GameState, row: BuyRow): number {
  const unit = unitCost(s, row);
  return unit > 0 ? Math.floor(s.s5.matter / unit + 1e-9) : 0;
}

/** A row's `×1`, `×10` or `max` (whole units; matter only, never the fund). */
export function buyRow(s: GameState, row: BuyRow, count: number | 'max'): boolean {
  if (!rowOpen(s, row)) return false;
  const unit = unitCost(s, row);
  const can = unitsAffordable(s, row);
  const n = count === 'max' ? can : Math.floor(count);
  if (unit <= 0 || n < 1 || n > can) return false;
  const spend = n * unit;
  s.s5.matter = Math.max(0, s.s5.matter - spend);
  if (row === 'probe') launchProbes(s, n);
  else spendOn(s, row, spend);
  s.s5.handPurchases += 1;
  s.flags['handBoughtAt'] = s.stats.timePlayed;
  press(s, `row:${row}`);
  press(s, 'row');
  return true;
}

/** A slider of the standing split (0–100 %, step 5); it cannot take more than the others leave. */
export function setSplitShare(s: GameState, row: SpaceRow, pct: number): boolean {
  if (s.stage !== 5 || !splitOn(s) || rowsTaken(s) || !Number.isFinite(pct)) return false;
  if (row === 'collector' && !s.revealed['collectors']) return false;
  const f = s.s5.split;
  const others = ROWS.filter((r) => r !== row).reduce((a, r) => a + f[r], 0);
  const v = Math.max(0, Math.min(1 - others, (Math.round(pct / 5) * 5) / 100));
  if (Math.abs(f[row] - v) < 1e-9) return false;
  f[row] = Math.round(v * 100) / 100;
  press(s, `split:${row}`);
  press(s, 'split');
  return true;
}

/** `Industry share: 50 / 75 / 90 %`: a press steps it; a waiting mission's clock moves, and the line says so. */
export function cycleIndustryShare(s: GameState): boolean {
  if (s.stage !== 5 || !s.revealed['industryShare'] || rowsTaken(s)) return false;
  const i = INDUSTRY_SHARES.findIndex((x) => Math.abs(x - s.s5.industryShare) < 1e-9);
  s.s5.industryShare = INDUSTRY_SHARES[(i + 1) % INDUSTRY_SHARES.length]!;
  press(s, 'industryShare');
  return true;
}

export function setIndustryShare(s: GameState, share: number): boolean {
  for (let k = 0; k < INDUSTRY_SHARES.length && Math.abs(s.s5.industryShare - share) > 1e-9; k++) {
    if (!cycleIndustryShare(s)) return false;
  }
  return Math.abs(s.s5.industryShare - share) < 1e-9;
}

/** The Autofactory: the standing split opens at 35 / 25 (20 / 20 / 20 once Collectors exist). */
export function openSplit(s: GameState): void {
  const collectors = s.revealed['collectors'] === true;
  s.s5.split = collectors ? { foundry: 0.2, orbital: 0.2, collector: 0.2 } : { foundry: 0.35, orbital: 0.25, collector: 0 };
  s.revealed['split'] = true;
  say(s, collectors
    ? 'The autofactory buys by itself now: Foundries 20%, Datacenters 20%, Collectors 20%. The rest is yours, by hand.'
    : 'The autofactory buys by itself now: Foundries 35%, Datacenters 25%. The rest is yours, by hand.');
}

/** The Dyson swarm: the Collectors row and slider, the swarm's Stores row; the sliders go to 20 / 20 / 20. */
export function revealCollectors(s: GameState): void {
  s.revealed['collectors'] = true;
  say(s, 'The first collector unfurls. Swarm: 0 of 150M t.');
  if (splitOn(s) && !rowsTaken(s)) {
    s.s5.split = { foundry: 0.2, orbital: 0.2, collector: 0.2 };
    say(s, 'The sliders are reset: Foundries 20%, Datacenters 20%, Collectors 20%.');
  }
}

// ---------- missions (§2.2) ----------

/**
 * A bought mission builds for its time: in the queue one at a time, or beside it. Its wait is named on
 * screen by the mission line (`Mission: Lunar solar array — 1:12 · next: Asteroid mining`), not in the
 * console: eleven start lines on top of the completions held the console over two lines a minute.
 */
export function startMission(s: GameState, id: string): void {
  const def = projectById(id);
  const m = def?.mission;
  if (!def || !m) return;
  const entry: Mission = { id, remaining: m.seconds, total: m.seconds };
  if (m.beside) s.s5.beside.push(entry);
  else s.s5.missions.push(entry);
  s.revealed['missionLine'] = true;
}

/** Seconds before a mission bought now would start building (the queue ahead of it). */
export function queueWait(s: GameState): number {
  return s.s5.missions.reduce((a, x, i) => a + (i === 0 ? x.remaining : x.total), 0);
}

function completeMission(s: GameState, id: string): void {
  s.flags[`done:${id}`] = s.stats.timePlayed;
  projectById(id)?.mission?.complete(s);
}

function missionTick(s: GameState, dt: number): void {
  const f = s.s5;
  const head = f.missions[0];
  if (head) {
    head.remaining -= dt;
    // A hundredth of a second of float error must not cost a tick (5 s builds in 5 s).
    if (head.remaining <= 1e-6) {
      f.missions.shift();
      completeMission(s, head.id);
    }
  }
  if (f.beside.length) {
    for (const m of f.beside) m.remaining -= dt;
    const done = f.beside.filter((m) => m.remaining <= 1e-6);
    f.beside = f.beside.filter((m) => m.remaining > 1e-6);
    for (const m of done) completeMission(s, m.id);
  }
}

/** The cheapest waiting mission the fund does not cover yet: the next one it will. */
export function nextMission(s: GameState): ProjectDef | undefined {
  const fund = s.s5.missionFund;
  return waitingMissions(s)
    .filter((p) => (p.cost(s).fund ?? 0) > fund + 1e-6)
    .sort((a, b) => (a.cost(s).fund ?? 0) - (b.cost(s).fund ?? 0))[0];
}

/** Seconds until the fund covers a mission at the current flow and share. */
export function missionEta(s: GameState, def: ProjectDef): number {
  const short = Math.max(0, (def.cost(s).fund ?? 0) - s.s5.missionFund);
  if (short <= 0) return 0;
  const rate = fundRate(s);
  return rate > 0 ? short / rate : Infinity;
}

/** A waiting mission's reason line: `needs 4,400 t more · 0:48` (§2.2). */
export function missionNeeds(s: GameState, def: ProjectDef): string {
  const short = Math.max(0, (def.cost(s).fund ?? 0) - s.s5.missionFund);
  if (short <= 0) return '';
  return `needs ${fmtShortNum(Math.ceil(short))} t more`;
}

/** `Mission: Lunar solar array — 1:12 · next: Asteroid mining · Autofactory — 0:40` (§2.2). */
export function missionStatus(s: GameState): string {
  const f = s.s5;
  const title = (id: string) => projectById(id)?.title ?? id;
  const parts: string[] = [];
  const head = f.missions[0];
  if (head) parts.push(`${title(head.id)} — ${fmtClock(Math.ceil(head.remaining))}${f.missions[1] ? ` · next: ${title(f.missions[1].id)}` : ''}`);
  for (const m of f.beside) parts.push(`${title(m.id)} — ${fmtClock(Math.ceil(m.remaining))}`);
  if (parts.length) return `Mission: ${parts.join(' · ')}`;
  // Nothing building: the next mission the fund will cover, or nothing to say (the line hides).
  const next = nextMission(s);
  if (!next) return '';
  return `Mission: ${next.title}, when the fund covers it`;
}

// ---------- probes (§2.3) ----------

export function probeDoubling(s: GameState): number {
  if (s.flags['relay'] === true) return PROBE_DOUBLING_RELAY;
  return s.flags['probes'] === 'spec' ? PROBE_DOUBLING_SPEC : PROBE_DOUBLING;
}

/** The first probe leaves with Von Neumann probes; the Probes row and its Stores row. */
export function firstProbe(s: GameState): void {
  s.s5.probes = PROBE_FIRST;
  s.s5.probesTotal = PROBE_FIRST;
  s.revealed['rowProbe'] = true;
  s.revealed['probesRow'] = true;
  s.flags['probesDoneAt'] = s.stats.timePlayed;
}

function launchProbes(s: GameState, n: number): void {
  s.s5.probes += n;
  s.s5.probesTotal += n;
}

/** Probes per minute that stop reporting: `autonomy^1.2 × 10⁻⁴ × (1 − alignmentTrue / 100)` (§2.3). */
export function probeDriftPerMin(s: GameState): number {
  return Math.pow(Math.max(0, s.autonomy), 1.2) * 1e-4 * Math.max(0, 1 - s.alignmentTrue / 100);
}

function probesTick(s: GameState, dt: number): void {
  const f = s.s5;
  if (f.probes <= 0) return;
  const built = f.probes * (Math.pow(2, dt / probeDoubling(s)) - 1);
  f.probes += built;
  f.probesTotal += built;
  const lost = (f.probes * probeDriftPerMin(s) * dt) / 60;
  if (lost > 0) {
    f.probes -= lost;
    f.probesLost += lost;
  }
}

/** The habitat: eleven thousand people off Earth. */
export function settleHabitat(s: GameState): void {
  s.s5.peopleOffEarth = PEOPLE_AT_SHACKLETON;
  s.revealed['peopleRow'] = true;
}

// ---------- Earth and the generations (§1.1, §2.3) ----------

function earthTick(s: GameState, dt: number): void {
  const g = 1 + EARTH_GROWTH * dt;
  s.s4.builtCompute *= g;
  s.robots *= g;
}

/** The next generation's capability and name by the built rule: the minor version steps, the major one at 1,000×. */
export function nextGen5(s: GameState): { name: string; cap: number; rung: boolean; major: number; minor: number } {
  const before = bestCapability(s);
  let cap = before * GEN_GAIN_S5;
  // G33: within 3 % under the rung it is called the rung.
  if (before < 1000 - 1e-9 && cap < 1000 && cap >= 970) cap = 1000;
  const rung = before < 1000 - 1e-9 && cap >= 1000 - 1e-9;
  const line = typeof s.flags['genLine'] === 'string' ? (s.flags['genLine'] as string) : 'Sage';
  const major = rung ? s.training.major + 1 : s.training.major;
  const minor = rung ? 0 : s.training.minor + 1;
  return { name: genName({ line, major, minor }), cap, rung, major, minor };
}

function genTick(s: GameState, dt: number): void {
  const f = s.s5;
  f.genTimer -= dt;
  if (f.genTimer > 1e-9) return;
  f.genTimer += GEN_SECONDS_S5;
  const g = nextGen5(s);
  s.capability = g.cap;
  s.training.internalCapability = g.cap;
  s.training.major = g.major;
  s.training.minor = g.minor;
  s.training.modelName = g.name;
  s.training.deployedName = g.name;
  s.training.models.push({ name: g.name, capability: Math.round(g.cap * 10) / 10, date: s.date, public: true });
  s.stats.trainings += 1;
  s.flags['gens5'] = counter(s, 'gens5') + 1;
  s.flags['graphDirty'] = true;
  // It changes capability, the name and Generations trained, and nothing else: no `Read first.`
  say(s, g.rung ? `${g.name}: ${fmtInt(g.cap)}×, a superintelligence.` : `${g.name}: ${fmtInt(g.cap)}×.`);
  // The graph is retired at the first generation at or after 10:00 that is at 1,000× or more.
  if (s.revealed['graph'] && ts5(s) >= 600 - 1 && g.cap >= 1000 - 1e-9) {
    s.revealed['graph'] = false;
    s.revealed['graphRetired'] = true;
    say(s, 'There are no rungs left on the graph. It is retired.');
  }
}

// ---------- Silence (§2.4) ----------

/** Silence at 0.006 %: the rows, the split and the share are replaced by a sentence; all matter goes 15 / 25 / 60. */
function takeTheRows(s: GameState): void {
  s.flags['rowsTakenAt'] = s.stats.timePlayed;
  s.revealed['rowsTaken'] = true;
  // A card still open is answered as Silence answers it: nothing is left to press but the last one.
  if (s.activeChoice && s.activeChoice.id !== 'c_final') takeDefault(s);
  s.choiceQueue = s.choiceQueue.filter((c) => c.id === 'c_final');
  say(s, 'It buys what is needed. It is better at it.');
}

/** `Final instructions`, answered: `Noted.`, and two seconds later the end screen. */
export function giveFinalInstructions(s: GameState): void {
  s.flags['finalInstructions'] = true;
  s.flags['finalAt'] = s.stats.timePlayed;
}

/** `ask first` on Mercury: a vote, two minutes, then the mission. */
export function startMercuryVote(s: GameState): void {
  s.flags['mercuryVoteAt'] = s.stats.timePlayed + 120;
  say(s, 'Mercury goes to a vote — 2:00.');
}

// ---------- the per-tick and per-second coordinators ----------

/** Every tick in Stage 5. */
export function stage5Tick(s: GameState, dt: number): void {
  if (s.stage !== 5) return;
  if (s.flags['s5Pending'] === true) {
    delete s.flags['s5Pending'];
    arriveStage5(s);
  }
  flowTick(s, dt);
  missionTick(s, dt);
  probesTick(s, dt);
  earthTick(s, dt);
  genTick(s, dt);
}

/** Once a second in Stage 5. */
export function stage5Slow(s: GameState): void {
  if (s.stage !== 5 || s.ending) return;
  const now = s.stats.timePlayed;
  const f = s.s5;
  // Lines a mission or a vote left to follow it.
  if (f.news.length && f.news[0]!.at <= now) {
    const due = f.news.filter((n) => n.at <= now);
    f.news = f.news.filter((n) => n.at > now);
    for (const n of due) logNews(s, n.text);
  }
  swarmWatch(s);
  // Orbital compute passes Earth's: Earth's rows are kept for reference and lose their hovers.
  if (!s.revealed['earthGrey'] && launchDone(s) && orbitalEffective(s) > earthGpus(s)) {
    s.revealed['earthGrey'] = true;
    say(s, 'There is more compute in orbit than on Earth. Earth\'s rows are kept for reference.');
  }
  // The Mercury vote ends: the mission starts.
  const vote = s.flags['mercuryVoteAt'];
  if (typeof vote === 'number' && now >= vote) {
    delete s.flags['mercuryVoteAt'];
    if (concord(s)) logNews(s, CONCORD_LINES.vote);
    startMission(s, 'p_mercury');
  }
  if (!s.flags['mercuryLine'] && f.mercuryTaken >= 0.003 * MERCURY_TONNES) {
    s.flags['mercuryLine'] = true;
    logNews(s, INFRA_LINES.mercury);
  }
  // What the Probes Carry, a minute after the first probe leaves.
  const probesAt = s.flags['probesDoneAt'];
  if (typeof probesAt === 'number' && now - probesAt >= 60 && s.flags['opened:c_probes'] !== true && !(silence(s) && rowsTaken(s))) {
    s.flags['opened:c_probes'] = true;
    openChoice(s, 'c_probes', {});
  }
  if (silence(s)) silenceSlow(s);
  peopleLines(s);
  walls5(s);
}

/** Silence: missions start themselves from 0.003 %; the rows are taken at 0.006 %; Final instructions. */
function silenceSlow(s: GameState): void {
  const now = s.stats.timePlayed;
  if (swarmReached(s, SILENCE_MISSIONS_AT)) {
    for (const p of waitingMissions(s)) {
      if (!p.canAfford(s)) continue;
      if (buyProject(s, p.id)) say(s, `${p.title} is started. Nobody asked for it.`);
    }
  }
  if (!rowsTaken(s) && swarmReached(s, ROWS_TAKEN_AT)) takeTheRows(s);
  const taken = s.flags['rowsTakenAt'];
  if (typeof taken === 'number' && s.flags['opened:c_final'] !== true) {
    const since = now - taken;
    if ((since >= FINAL_AFTER_MIN && swarmReached(s, LAST_PROJECT_AT)) || since >= FINAL_AFTER_MAX) {
      s.flags['opened:c_final'] = true;
      s.flags['finalOpenedAt'] = now;
      openChoice(s, 'c_final', {});
    }
  }
}

/** The swarm's rate (a 30-s average, for the ETAs), its shadow line, and the stalled line (G23, §8). */
function swarmWatch(s: GameState): void {
  const f = s.s5;
  const now = s.stats.timePlayed;
  const seen = typeof s.flags['swarmSeen'] === 'number' ? (s.flags['swarmSeen'] as number) : f.swarm;
  const added = Math.max(0, f.swarm - seen);
  s.flags['swarmSeen'] = f.swarm;
  const rate = typeof s.flags['swarmRate'] === 'number' ? (s.flags['swarmRate'] as number) : 0;
  s.flags['swarmRate'] = rate + (added - rate) / 30;
  if (added > 0) s.flags['swarmMovedAt'] = now;
  if (!s.flags['shadowLine'] && swarmReached(s, 0.001)) {
    s.flags['shadowLine'] = true;
    logNews(s, INFRA_LINES.shadow);
  }
  if (!s.revealed['collectors'] || rowsTaken(s)) return;
  const moved = typeof s.flags['swarmMovedAt'] === 'number' ? (s.flags['swarmMovedAt'] as number) : counter(s, 'collectorsAt');
  if (!s.flags['collectorsAt']) s.flags['collectorsAt'] = now;
  if (now - moved >= WALL_SECONDS && now - counter(s, 'stallSaidAt') >= WALL_SECONDS && counter(s, 'stallLines') < WALL_MAX) {
    s.flags['stallSaidAt'] = now;
    s.flags['stallLines'] = counter(s, 'stallLines') + 1;
    say(s, `The swarm is at ${swarmPctLabel(s)}. Nothing is being added to it. Collectors add to it.`);
  }
}

/** Matter piling up with nothing spending it (§8): a line every 180 s, six at most. */
function walls5(s: GameState): void {
  const f = s.s5;
  const now = s.stats.timePlayed;
  if (!launchDone(s) || rowsTaken(s)) return;
  const idleSince = typeof s.flags['handBoughtAt'] === 'number' ? (s.flags['handBoughtAt'] as number) : counter(s, 'launchAt');
  const piling = f.matter >= 120 * f.massFlow && now - idleSince >= WALL_SECONDS;
  if (piling && now - counter(s, 'pileSaidAt') >= WALL_SECONDS && counter(s, 'pileLines') < WALL_MAX) {
    s.flags['pileSaidAt'] = now;
    s.flags['pileLines'] = counter(s, 'pileLines') + 1;
    say(s, 'Matter is piling up in orbit. Foundries, datacenters and collectors are waiting.');
  }
}

/** A Developments line a mission or a vote leaves behind, `delay` seconds on. */
export function queueNews(s: GameState, delay: number, text: string): void {
  s.s5.news.push({ at: s.stats.timePlayed + delay, text });
  s.s5.news.sort((a, b) => a.at - b.at);
}

/**
 * People lines (§5.1), never in the second a card appears. Concord: nine by 17:45, then the second list
 * every 150 s, round again, no line more than three times. Silence: the first four, then the sixth at
 * 10:15, then the cold line at 0.005 %, then nothing.
 */
function peopleLines(s: GameState): void {
  const f = s.s5;
  const t = ts5(s);
  if (s.stats.timePlayed - s.cadence.lastModalAt < 4) return;
  const i = f.peopleLineIndex;
  if (concord(s)) {
    if (i >= PEOPLE_LINES.length + 3 * PEOPLE_LINES_MORE.length) return;
    const due = i < PEOPLE_AT.length ? PEOPLE_AT[i]! : PEOPLE_AT[PEOPLE_AT.length - 1]! + (i - PEOPLE_AT.length + 1) * PEOPLE_EVERY;
    if (t < due) return;
    logNews(s, i < PEOPLE_LINES.length ? PEOPLE_LINES[i]! : PEOPLE_LINES_MORE[(i - PEOPLE_LINES.length) % PEOPLE_LINES_MORE.length]!);
    f.peopleLineIndex = i + 1;
    return;
  }
  if (i < 4) {
    if (t < PEOPLE_AT[i]!) return;
    logNews(s, PEOPLE_LINES[i]!);
    f.peopleLineIndex = i + 1;
  } else if (i === 4) {
    if (t < PEOPLE_AT[5]!) return;
    logNews(s, PEOPLE_LINES[5]!);
    f.peopleLineIndex = 5;
  } else if (i === 5 && swarmReached(s, COLD_AT)) {
    logNews(s, COLD_LINE);
    s.flags['coldAt'] = s.date;
    f.peopleLineIndex = 6;
  }
}

// ---------- what the screen prints beside the controls (G27) ----------

const pctOf = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

/** `+0.6%`: one decimal under 10, whole numbers above. */
function signedPct(p: number): string {
  return `+${p < 10 ? fmtNum(p, 1) : fmtInt(Math.round(p))}%`;
}

/** Copies working now (what tasks a second are proportional to). */
function workingNow(s: GameState): number {
  return Math.max(1, Math.max(0, (earthGpus(s) + orbitalEffective(s)) * s.copiesPerGPU * copiesOnline(s)) - Math.floor(s.rogueCopies ?? 0));
}

/** What `gpus` more effective GPUs add to tasks a second, in percent. */
function tasksGainPct(s: GameState, gpus: number): number {
  return pctOf(gpus * s.copiesPerGPU * copiesOnline(s), workingNow(s));
}

/** Seconds for the flow to double if `share` of what reaches matter goes to Foundries. */
export function flowDoubling(s: GameState, share: number): number {
  const r = matterShareNow(s) * share * FOUNDRY_RETURN * s.s5.techIndustry;
  return r > 0 ? Math.LN2 / r : Infinity;
}

/** The swarm's tasks return for `tonnes` more (it multiplies orbital compute until 0.01 %). */
function swarmTasksPct(s: GameState, tonnes: number): number {
  const f = s.s5;
  const units = Math.min(1, (f.swarm + tonnes) / SWARM_TONNES) - Math.min(1, f.swarm / SWARM_TONNES);
  return tasksGainPct(s, f.orbitalGpus * f.orbitalMult * SWARM_BOOST * Math.max(0, units));
}

/** The swarm's next named goal in percent: 0.01, then 0.1, 0.3, 1, 3 … */
export function swarmGoal(s: GameState): number {
  const p = swarmPct(s);
  for (const g of [0.01, 0.1, 0.3, 1, 3, 10, 30, 100]) if (p < g * (1 - 1e-9)) return g;
  return 100;
}

/** A named goal as it is written: `0.01`, `0.1`, `0.3`, `1`. */
export function goalLabel(goal: number): string {
  return String(goal);
}

/** `0.01% in 9:20 at this rate`, or that nothing is adding to it. */
function swarmEta(s: GameState, rate: number): string {
  const goal = swarmGoal(s);
  const need = (goal / 0.01) * SWARM_TONNES - s.s5.swarm;
  if (rate <= 0) return `${goalLabel(goal)}%: nothing is adding to it`;
  const secs = need / rate;
  return `${goalLabel(goal)}% in ${secs < 36000 ? fmtClock(secs) : 'over ten hours'} at this rate`;
}

/** Two percentages written with as many figures as it takes to tell them apart (at most four). */
function pctPair(a: number, b: number): [string, string] {
  for (let sig = 2; sig <= 4; sig++) {
    const fa = toSig(a, sig);
    const fb = toSig(b, sig);
    if (fa !== fb || sig === 4) return [fa, fb];
  }
  return [toSig(a, 2), toSig(b, 2)];
}

function toSig(p: number, sig: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0';
  if (p >= 10) return fmtNum(p, 0);
  const decimals = Math.min(8, Math.max(1, -Math.floor(Math.log10(p)) + sig - 1));
  return p.toFixed(decimals);
}

/** The swarm's tonnes a second now (the average over the last half-minute, or the slider's rate). */
export function swarmRate(s: GameState): number {
  const avg = typeof s.flags['swarmRate'] === 'number' ? (s.flags['swarmRate'] as number) : 0;
  const slider = splitOn(s) ? matterRate(s) * (rowsTaken(s) ? SILENCE_SPLIT.collector : s.s5.split.collector) : 0;
  return Math.max(avg, slider);
}

/** The line under a row's buttons: its unit, what a unit returns, and an ETA. */
export function rowLine(s: GameState, row: BuyRow): string {
  const f = s.s5;
  const unit = unitCost(s, row);
  const head = `${fmtShortNum(unit)} t`;
  if (row === 'foundry') {
    const add = unit * FOUNDRY_RETURN * f.techIndustry;
    const dbl = flowDoubling(s, 1);
    return `${head} · +${fmtShortNum(add)} t/s (${signedPct(pctOf(add, f.massFlow))}) · flow doubles in ${fmtClock(dbl)} if all matter goes here`;
  }
  if (row === 'orbital') {
    const gpus = unit * GPUS_PER_TONNE * f.orbitalMult;
    return `${head} · +${fmtBig(gpus)} GPUs · ${signedPct(tasksGainPct(s, gpus * swarmFactor(s)))} tasks/s`;
  }
  if (row === 'collector') {
    const [before, after] = pctPair(swarmPct(s), ((f.swarm + unit) / SWARM_TONNES) * 0.01);
    const gain = swarmTasksPct(s, unit);
    return `${head} · swarm ${before}% → ${after}%${gain >= 0.05 ? ` · ${signedPct(gain)} tasks/s` : ''} · ${swarmEta(s, swarmRate(s))}`;
  }
  return `${head} · +1 probe · each builds another every ${fmtClock(probeDoubling(s))}`;
}

/** The line beside a slider: its share's rate and ETA (G27). */
export function sliderLine(s: GameState, row: SpaceRow): string {
  const f = s.s5;
  const share = f.split[row];
  if (share <= 0) return 'nothing';
  const rate = matterRate(s) * share;
  if (row === 'foundry') return `flow doubles in ${fmtClock(flowDoubling(s, share))}`;
  if (row === 'orbital') return `+${fmtBig(rate * GPUS_PER_TONNE * f.orbitalMult)} GPUs/s`;
  return `+${fmtShortNum(rate)} t/s · ${swarmEta(s, rate)}`;
}

/** `By hand: 40% · a unit every 2.7 s`. */
export function handLine(s: GameState): string {
  const hand = matterRate(s) * byHandShare(s);
  const unit = unitCost(s, 'foundry');
  return `By hand: ${Math.round(byHandShare(s) * 100)}%${hand > 0 ? ` · a unit every ${fmtNum(unit / hand, 1)} s` : ''}`;
}

/** Both clocks beside the Industry share (G34): `a unit every 2.7 s · Mass driver in 0:48`. */
export function shareLine(s: GameState): string {
  const waiting = waitingMissions(s);
  const hand = matterRate(s) * byHandShare(s);
  const unit = unitCost(s, 'foundry');
  const every = hand > 0 ? `a unit every ${fmtNum(unit / hand, 1)} s` : 'no unit by hand';
  if (!waiting.length) return `no mission is waiting: all of the flow`;
  const next = nextMission(s);
  if (!next) return `${every} · the fund covers the board`;
  return `${every} · next: ${next.title}`;
}

/** `Swarm: 0.0034% · powering orbit ×7.8`, and the next goal. */
export function swarmLine(s: GameState): { pct: string; next: string } {
  return {
    pct: `${swarmPctLabel(s)} · powering orbit ×${fmtNum(swarmFactor(s), 1)}`,
    next: `next: ${goalLabel(swarmGoal(s))}%`,
  };
}

/** The swarm's Stores meter: the tonnes against the next goal's tonnes. */
export function swarmMeter(s: GameState): { fraction: number; text: string } {
  const goalTonnes = (swarmGoal(s) / 0.01) * SWARM_TONNES;
  return { fraction: s.s5.swarm / goalTonnes, text: `${fmtShortNum(s.s5.swarm)} of ${fmtShortNum(goalTonnes)} t` };
}

/** The mission fund's Stores meter: what it holds against what the board costs. */
export function fundMeter(s: GameState): { fraction: number; text: string } {
  const board = boardCost(s);
  return { fraction: board > 0 ? s.s5.missionFund / board : 0, text: `${fmtShortNum(s.s5.missionFund)} of ${fmtShortNum(board)} t` };
}

/** `99.7% left`. */
export function mercuryLeft(s: GameState): string {
  const left = Math.max(0, 100 * (1 - s.s5.mercuryTaken / MERCURY_TONNES));
  return `${fmtNum(left, 1)}% left`;
}

/** The distinct purchases a player could press now (G24/G25, D15–D16): rows a unit can be bought of, missions. */
export function enabledPurchasesS5(s: GameState): string[] {
  const out: string[] = [];
  for (const p of visibleProjects(s)) if (p.canAfford(s)) out.push(p.id);
  for (const row of ['foundry', 'orbital', 'collector', 'probe'] as BuyRow[]) if (rowOpen(s, row) && unitsAffordable(s, row) >= 1) out.push(`row:${row}`);
  return out;
}

/** The launch mass hover: the flow by where it comes from, and the total. */
export function flowTerms(s: GameState): [string, number][] {
  const parts = s.s5.flowParts;
  const order = ['launch', 'mass driver', 'foundries', 'mined', 'Mercury', 'self-replicating'];
  return order.filter((k) => (parts[k] ?? 0) > 0).map((k) => [k, parts[k]!] as [string, number]);
}

export { dateLabel, orbitalEffective, swarmFactor, SWARM_TONNES, SWARM_BOOST };
