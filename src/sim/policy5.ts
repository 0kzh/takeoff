import { GameState, SpaceRow } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import type { BotMemory } from './policy.js';
import { visibleProjects } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import {
  rowOpen, unitsAffordable, splitOn, rowsTaken, swarmReached, ROWS, BuyRow, waitingMissions, swarmGoal, flowDoubling,
} from '../engine/space.js';

/**
 * Stage 5's policies (stage5.md §9). `bot` is the reasonable bot: the Industry share left at 75 %;
 * Foundries ×10 and Orbital datacenters ×10 by hand 60 / 40 until the Autofactory; then sliders 50 / 30
 * (by hand 20 %), 30 / 20 / 30 once the swarm exists and 10 / 20 / 50 from 0.005 %, the by-hand matter on
 * the row its ETA favours; every mission the moment its fund covers it, in table order; the charter's
 * tenth, Mercury `ask first`, the probes `the Spec`; the last project like any other. `naive` presses the
 * first affordable row, never moves the sliders or the share, takes first options and buys every mission.
 * Decision variants change one thing each (§9's table, and `answers-silence` for D7).
 */

export interface S5Memory {
  /** When the last project first became affordable (the `linger` variant waits five minutes). */
  reflectionSeen?: number;
  /** The first-timer's last row (it presses the next one in turn). */
  lastRow?: BuyRow;
}

function mem5(mem: BotMemory): S5Memory {
  if (!mem.s5) mem.s5 = {};
  return mem.s5;
}

const has = (mem: BotMemory, v: string) => mem.variant.split(',').includes(v);

/** The variants' held splits (Foundries / Datacenters / Collectors, of all matter). */
const HELD: Record<string, Record<SpaceRow, number>> = {
  'industry-heavy': { foundry: 0.8, orbital: 0.1, collector: 0.1 },
  'swarm-rush': { foundry: 0.3, orbital: 0.05, collector: 0.65 },
  'compute-heavy': { foundry: 0.15, orbital: 0.7, collector: 0.15 },
};

export function stage5Step(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending || s.stage !== 5) return;
  if (mem.policy === 'naive' || mem.policy === 'greedy' || mem.policy === 'trainfirst') naiveS5(s, a, mem);
  else botS5(s, a, mem);
}

function readModal5(s: GameState, mem: BotMemory): boolean {
  const c = s.activeChoice;
  if (!c) return false;
  const key = `${c.id}|${JSON.stringify(c.context)}`;
  if (key !== mem.choiceKey) {
    mem.choiceKey = key;
    mem.choiceSince = s.stats.timePlayed;
  }
  return s.stats.timePlayed - mem.choiceSince >= 2.5;
}

/** The first enabled option of `order` (Silence's cards have one: acknowledge). */
function answer(s: GameState, a: Actions, order: number[]): void {
  const def = choiceById(s.activeChoice!.id);
  if (!def) return;
  const enabled = def.options.map((_, i) => i).filter((i) => choiceOptionEnabled(s, def, i));
  const pick = order.find((i) => enabled.includes(i)) ?? enabled[0];
  if (pick !== undefined) a.resolveChoice(s, pick);
}

/** The reasonable bot's answers: the people's options; `answers-silence` gives the ones Silence applies (D7). */
function botAnswer(s: GameState, mem: BotMemory): number[] {
  const id = s.activeChoice!.id;
  const silent = has(mem, 'answers-silence');
  switch (id) {
    case 'c_charter':
      return silent || has(mem, 'no-charter') ? [0] : [1, 0];
    case 'c_mercury':
      return silent || has(mem, 'begin') ? [1] : [0, 1];
    case 'c_probes':
      return silent || has(mem, 'copies') ? [1] : [0, 1];
    default:
      return [0, 1, 2];
  }
}

/** Every mission the fund covers, in table order (the last project too, unless the variant lingers). */
function buyMissions(s: GameState, a: Actions, mem: BotMemory): void {
  for (const p of visibleProjects(s)) {
    if (!p.mission || !p.canAfford(s)) continue;
    if (p.id === 'p_reflection' && has(mem, 'linger')) {
      const m = mem5(mem);
      if (m.reflectionSeen === undefined) m.reflectionSeen = s.stats.timePlayed;
      if (s.stats.timePlayed - m.reflectionSeen < 300) continue;
    }
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
}

/** The split the bot wants of all matter now, and what it keeps by hand. */
function wantedSplit(s: GameState, mem: BotMemory): { split: Record<SpaceRow, number>; hand: number } {
  const held = Object.keys(HELD).find((k) => has(mem, k));
  const collectors = s.revealed['collectors'] === true;
  if (held) {
    const r = HELD[held]!;
    // Before the swarm exists its share waits by hand.
    return collectors ? { split: r, hand: 0 } : { split: { foundry: r.foundry, orbital: r.orbital, collector: 0 }, hand: r.collector };
  }
  if (has(mem, 'count-chaser')) {
    // Foundries a third; the rest to whichever of the other two prints the better tasks return.
    return { split: { foundry: 0.35, orbital: 0, collector: 0 }, hand: 0.65 };
  }
  if (!collectors) return { split: { foundry: 0.5, orbital: 0.3, collector: 0 }, hand: 0.2 };
  if (swarmReached(s, 0.005)) return { split: { foundry: 0.1, orbital: 0.2, collector: 0.5 }, hand: 0.2 };
  return { split: { foundry: 0.3, orbital: 0.2, collector: 0.3 }, hand: 0.2 };
}

function setSplit(s: GameState, a: Actions, want: Record<SpaceRow, number>): void {
  const now = (r: SpaceRow) => Math.round(s.s5.split[r] * 100);
  const target = (r: SpaceRow) => Math.round(want[r] * 100);
  // Lower first, so the raises have room (a slider cannot take what the others hold).
  for (const r of ROWS) if (target(r) < now(r)) a.setSplitShare(s, r, target(r));
  for (const r of ROWS) if (target(r) > now(r)) a.setSplitShare(s, r, target(r));
}

/** The row the bot's by-hand matter goes to now. */
function handRow(s: GameState, mem: BotMemory, ratio: Record<SpaceRow, number>): BuyRow | null {
  const open = (r: BuyRow) => rowOpen(s, r);
  if (has(mem, 'count-chaser')) {
    // The better printed tasks return of the two compute rows (the swarm multiplies orbital compute).
    if (!open('collector')) return open('orbital') ? 'orbital' : null;
    return collectorBetter(s) ? 'collector' : 'orbital';
  }
  const held = Object.keys(HELD).some((k) => has(mem, k));
  if (held) {
    // In the held ratio, among the rows that exist: the one furthest under its share of what was spent.
    const spent = s.s5.spent;
    const rows = ROWS.filter((r) => open(r) && ratio[r] > 0);
    const total = rows.reduce((t, r) => t + (spent[r] ?? 0), 0) || 1;
    const sum = rows.reduce((t, r) => t + ratio[r], 0) || 1;
    return rows.sort((x, y) => ((spent[x] ?? 0) / total - ratio[x] / sum) - ((spent[y] ?? 0) / total - ratio[y] / sum))[0] ?? null;
  }
  if (!splitOn(s)) {
    // Foundries ×10 and Orbital datacenters ×10, 60 / 40.
    const f = s.s5.spent['foundry'] ?? 0;
    const o = s.s5.spent['orbital'] ?? 0;
    if (!open('orbital')) return 'foundry';
    return f <= 1.5 * o ? 'foundry' : 'orbital';
  }
  // After the Autofactory, the row its ETA favours: the swarm once it exists and its goal is a while
  // off; the flow while it doubles inside four minutes; compute otherwise.
  if (open('collector') && swarmGoal(s) <= 0.01) return 'collector';
  if (flowDoubling(s, 1) < 240) return 'foundry';
  return 'orbital';
}

/** True when a unit of Collectors adds more tasks a second than a unit of Orbital datacenters. */
function collectorBetter(s: GameState): boolean {
  const f = s.s5;
  if (f.swarm >= 1.5e8) return false;
  // A unit adds 30,000 × ring GPUs on orbital (× the swarm's factor), or 20 × orbital ÷ 1.5e8 a tonne on the swarm.
  const orbitalGain = 30000 * f.orbitalMult * (1 + 20 * Math.min(1, f.swarm / 1.5e8));
  const swarmGain = (f.orbitalGpus * f.orbitalMult * 20) / 1.5e8;
  return swarmGain > orbitalGain;
}

function botS5(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal5(s, mem)) answer(s, a, botAnswer(s, mem));
  if (mem.ticks % 5 !== 0) return;
  // The free mission first; then every mission its fund covers.
  buyMissions(s, a, mem);
  if (rowsTaken(s)) return;
  // The Industry share: left at 75 %, unless a variant moves it.
  if (s.revealed['industryShare']) {
    const share = has(mem, 'share-50') ? 0.5 : has(mem, 'share-90') ? 0.9 : 0.75;
    if (Math.abs(s.s5.industryShare - share) > 1e-9) a.setIndustryShare(s, share);
  }
  const { split } = wantedSplit(s, mem);
  if (splitOn(s)) setSplit(s, a, split);
  const held = Object.keys(HELD).find((k) => has(mem, k));
  if (held && splitOn(s)) {
    // A held split buys nothing by hand: before Collectors its swarm share waits in matter, and goes
    // to the swarm the moment the row exists.
    if (s.revealed['collectors'] && unitsAffordable(s, 'collector') >= 1 && a.buyRow(s, 'collector', 'max')) mem.bought.push('row:collector');
    return;
  }
  const ratio = held ? HELD[held]! : split;
  // By hand: ten units when they are there to be bought (after the Autofactory, one now and then).
  const row = handRow(s, mem, ratio);
  if (!row) return;
  if (unitsAffordable(s, row) >= 10) {
    if (a.buyRow(s, row, 10)) mem.bought.push(`row:${row}`);
  } else if (splitOn(s) && unitsAffordable(s, row) >= 1 && mem.ticks % 50 === 0) {
    if (a.buyRow(s, row, 1)) mem.bought.push(`row:${row}`);
  }
}

/**
 * The first-timer: first options; every mission; a unit of the next affordable row in turn (the rows cost
 * the same, so "the first affordable row" is the one after the last pressed: thirds, §9's paper model).
 */
function naiveS5(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal5(s, mem)) answer(s, a, [0, 1, 2]);
  if (mem.ticks % 10 !== 0) return;
  for (const p of visibleProjects(s)) {
    if (!p.mission || !p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (rowsTaken(s)) return;
  const m = mem5(mem);
  const order: BuyRow[] = ['foundry', 'orbital', 'collector', 'probe'];
  const from = m.lastRow ? order.indexOf(m.lastRow) + 1 : 0;
  for (let k = 0; k < order.length; k++) {
    const row = order[(from + k) % order.length]!;
    if (rowOpen(s, row) && unitsAffordable(s, row) >= 1) {
      if (a.buyRow(s, row, 1)) {
        mem.bought.push(`row:${row}`);
        m.lastRow = row;
      }
      return;
    }
  }
  void waitingMissions;
}
