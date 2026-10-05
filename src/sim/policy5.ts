import { GameState, SpaceRow } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import type { BotMemory } from './policy.js';
import { visibleProjects } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import {
  rowOpen, unitsAffordable, splitOn, rowsTaken, swarmReached, ROWS, BuyRow, waitingMissions, swarmGoal, flowDoubling,
} from '../engine/space.js';

export interface S5Memory {
  reflectionSeen?: number;
  lastRow?: BuyRow;
}

function mem5(mem: BotMemory): S5Memory {
  if (!mem.s5) mem.s5 = {};
  return mem.s5;
}

const has = (mem: BotMemory, v: string) => mem.variant.split(',').includes(v);

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

function answer(s: GameState, a: Actions, order: number[]): void {
  const def = choiceById(s.activeChoice!.id);
  if (!def) return;
  const enabled = def.options.map((_, i) => i).filter((i) => choiceOptionEnabled(s, def, i));
  const pick = order.find((i) => enabled.includes(i)) ?? enabled[0];
  if (pick !== undefined) a.resolveChoice(s, pick);
}

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

function buyMissions(s: GameState, a: Actions, mem: BotMemory): void {
  for (const p of visibleProjects(s)) {
    if (!p.mission || !p.canAfford(s)) continue;
    const wait = has(mem, 'linger-10') ? 600 : has(mem, 'linger') ? 300 : 0;
    if (p.id === 'p_reflection' && wait > 0) {
      const m = mem5(mem);
      if (m.reflectionSeen === undefined) m.reflectionSeen = s.stats.timePlayed;
      if (s.stats.timePlayed - m.reflectionSeen < wait) continue;
    }
    if (has(mem, 'missions-stop-15') && s.stats.timeInStage >= 900) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
}

function wantedSplit(s: GameState, mem: BotMemory): { split: Record<SpaceRow, number>; hand: number } {
  const held = Object.keys(HELD).find((k) => has(mem, k));
  const collectors = s.revealed['collectors'] === true;
  if (held) {
    const r = HELD[held]!;
    return collectors ? { split: r, hand: 0 } : { split: { foundry: r.foundry, orbital: r.orbital, collector: 0 }, hand: r.collector };
  }
  if (has(mem, 'count-chaser')) {
    return { split: { foundry: 0.35, orbital: 0, collector: 0 }, hand: 0.65 };
  }
  if (!collectors) return { split: { foundry: 0.5, orbital: 0.3, collector: 0 }, hand: 0.2 };
  if (swarmReached(s, 0.005)) return { split: { foundry: 0.1, orbital: 0.2, collector: 0.5 }, hand: 0.2 };
  return { split: { foundry: 0.3, orbital: 0.2, collector: 0.3 }, hand: 0.2 };
}

function setSplit(s: GameState, a: Actions, want: Record<SpaceRow, number>): void {
  const now = (r: SpaceRow) => Math.round(s.s5.split[r] * 100);
  const target = (r: SpaceRow) => Math.round(want[r] * 100);
  for (const r of ROWS) if (target(r) < now(r)) a.setSplitShare(s, r, target(r));
  for (const r of ROWS) if (target(r) > now(r)) a.setSplitShare(s, r, target(r));
}

function handRow(s: GameState, mem: BotMemory, ratio: Record<SpaceRow, number>): BuyRow | null {
  const open = (r: BuyRow) => rowOpen(s, r);
  if (has(mem, 'count-chaser')) {
    if (!open('collector')) return open('orbital') ? 'orbital' : null;
    return collectorBetter(s) ? 'collector' : 'orbital';
  }
  const held = Object.keys(HELD).some((k) => has(mem, k));
  if (held) {
    const spent = s.s5.spent;
    const rows = ROWS.filter((r) => open(r) && ratio[r] > 0);
    const total = rows.reduce((t, r) => t + (spent[r] ?? 0), 0) || 1;
    const sum = rows.reduce((t, r) => t + ratio[r], 0) || 1;
    return rows.sort((x, y) => ((spent[x] ?? 0) / total - ratio[x] / sum) - ((spent[y] ?? 0) / total - ratio[y] / sum))[0] ?? null;
  }
  if (!splitOn(s)) {
    const f = s.s5.spent['foundry'] ?? 0;
    const o = s.s5.spent['orbital'] ?? 0;
    if (!open('orbital')) return 'foundry';
    return f <= 1.5 * o ? 'foundry' : 'orbital';
  }
  if (open('collector') && swarmGoal(s) <= 0.01) return 'collector';
  if (flowDoubling(s, 1) < 240) return 'foundry';
  return 'orbital';
}

function collectorBetter(s: GameState): boolean {
  const f = s.s5;
  if (f.swarm >= 1.5e8) return false;
  const orbitalGain = 30000 * f.orbitalMult * (1 + 20 * Math.min(1, f.swarm / 1.5e8));
  const swarmGain = (f.orbitalGpus * f.orbitalMult * 20) / 1.5e8;
  return swarmGain > orbitalGain;
}

function botS5(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal5(s, mem)) answer(s, a, botAnswer(s, mem));
  if (mem.ticks % 5 !== 0) return;
  buyMissions(s, a, mem);
  if (rowsTaken(s)) return;
  if (s.revealed['industryShare']) {
    const share = has(mem, 'share-50') ? 0.5 : has(mem, 'share-90') ? 0.9 : 0.75;
    if (Math.abs(s.s5.industryShare - share) > 1e-9) a.setIndustryShare(s, share);
  }
  const { split } = wantedSplit(s, mem);
  if (splitOn(s)) setSplit(s, a, split);
  const held = Object.keys(HELD).find((k) => has(mem, k));
  if (held && splitOn(s)) {
    if (s.revealed['collectors'] && unitsAffordable(s, 'collector') >= 1 && a.buyRow(s, 'collector', 'max')) mem.bought.push('row:collector');
    return;
  }
  const ratio = held ? HELD[held]! : split;
  const row = handRow(s, mem, ratio);
  if (!row) return;
  if (unitsAffordable(s, row) >= 10) {
    if (a.buyRow(s, row, 10)) mem.bought.push(`row:${row}`);
  } else if (splitOn(s) && unitsAffordable(s, row) >= 1 && mem.ticks % 50 === 0) {
    if (a.buyRow(s, row, 1)) mem.bought.push(`row:${row}`);
  }
}

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
