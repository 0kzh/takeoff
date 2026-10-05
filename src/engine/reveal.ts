import { GameState, projectState } from './state.js';
import { PROJECTS, ProjectDef } from '../data/projects.js';
import { visibleProjects } from './projects.js';

export const STAGE1_DRIP_SECONDS = 30;
export const STAGE1_GOVERNOR_SECONDS = 140;
export const EARLY_DRIP_SECONDS = 60;
export const MAX_VISIBLE = 4;

function dripSeconds(s: GameState): number {
  if (!s.revealed['training']) return EARLY_DRIP_SECONDS;
  return STAGE1_DRIP_SECONDS;
}

const STAGE1_GOVERNED = ['p_dogfood', 'p_batch', 'p_agents', 'p_recruiter', 'p_alignment_team', 'p_safety_framework', 'p_distributed'];

function stage1Governor(s: GameState): void {
  if (!s.revealed['training'] || s.activeChoice) return;
  if (s.stats.timePlayed - s.cadence.lastRevealAt < STAGE1_GOVERNOR_SECONDS) return;
  if (room(s) < 0) return;
  for (const id of STAGE1_GOVERNED) {
    const def = projectDef(id);
    const st = s.projects[id];
    if (!def || st?.shown || (st?.bought ?? 0) > 0 || !eligible(s, def)) continue;
    show(s, def);
    s.cadence.governed.push(`${Math.round(s.stats.timePlayed)}:${id}`);
    return;
  }
}

function remainingUses(s: GameState, def: ProjectDef): number {
  return def.uses - (s.projects[def.id]?.bought ?? 0);
}

function exempt(s: GameState, def: ProjectDef): boolean {
  return def.rescue === true || def.pinned === true || def.urgent?.(s) === true;
}

function uncapped(s: GameState, def: ProjectDef): boolean {
  return exempt(s, def) || def.sideline === true;
}

export const OPENING_CARDS = ['p_prompting', 'p_grid', 'p_insight'];
export const EMPTY_PANEL_SECONDS = 10;
export const ON_SIGHT_SECONDS = 60;

function eligible(s: GameState, def: ProjectDef): boolean {
  if (!def.stages.includes(s.stage) || remainingUses(s, def) <= 0) return false;
  if (!s.revealed['training'] && !def.rescue && !OPENING_CARDS.includes(def.id)) return false;
  return def.rescue === true || s.revealed['research'] === true;
}

function show(s: GameState, def: ProjectDef): void {
  const st = projectState(s, def.id);
  const first = !st.shown && st.bought === 0 && !s.cadence.seen.includes(`p:${def.id}`);
  st.shown = true;
  delete s.flags[`sight:${def.id}`];
  const q = s.cadence.queue.indexOf(def.id);
  if (q >= 0) s.cadence.queue.splice(q, 1);
  if (first) def.onShow?.(s);
}

let tableOrder: Map<string, number> | null = null;
function order(id: string): number {
  if (!tableOrder) tableOrder = new Map(PROJECTS.map((p, i) => [p.id, i]));
  return tableOrder.get(id) ?? 0;
}

let defById: Map<string, ProjectDef> | null = null;
function projectDef(id: string): ProjectDef | undefined {
  if (!defById) defById = new Map(PROJECTS.map((p) => [p.id, p]));
  return defById.get(id);
}

function enqueue(s: GameState, id: string): void {
  const q = s.cadence.queue;
  if (q.includes(id)) return;
  const at = q.findIndex((other) => order(other) > order(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

function room(s: GameState): number {
  return MAX_VISIBLE - visibleProjects(s).filter((p) => !uncapped(s, p)).length;
}

export const BEAT_GAP_SECONDS = 4;

function heldOnSight(s: GameState, def: ProjectDef, now: number, empty: boolean): boolean {
  if (exempt(s, def) || OPENING_CARDS.includes(def.id)) return false;
  const key = `sight:${def.id}`;
  const c = def.cost(s);
  const priced = !!(c.funds || c.research || c.insight || c.trust);
  if (!priced || !def.canAfford(s)) {
    delete s.flags[key];
    return false;
  }
  const at = s.flags[key];
  if (typeof at !== 'number') {
    s.flags[key] = now;
    return true;
  }
  return now - at < (empty ? EMPTY_PANEL_SECONDS : ON_SIGHT_SECONDS);
}

export function updateProjects(s: GameState): void {
  if (!s.revealed['projects']) return;
  const now = s.stats.timePlayed;
  let free = room(s);
  const modalBeat = now - s.cadence.lastModalAt < BEAT_GAP_SECONDS;
  const onScreen = visibleProjects(s).some((p) => !p.rescue);
  if (onScreen) delete s.flags['panelEmptyAt'];
  else if (typeof s.flags['panelEmptyAt'] !== 'number') s.flags['panelEmptyAt'] = now;
  const emptyAt = s.flags['panelEmptyAt'];
  const empty = typeof emptyAt === 'number';
  const trainingAt = s.flags['trainingAt'];
  const trainingBeat = typeof trainingAt === 'number' && now - trainingAt < EMPTY_PANEL_SECONDS;

  for (const def of PROJECTS) {
    if (s.projects[def.id]?.shown || !eligible(s, def) || !def.trigger(s)) continue;
    const early = !s.revealed['training'];
    if (exempt(s, def)) show(s, def);
    else if (def.chain && !early && !trainingBeat && free > 0 && !modalBeat && !s.cadence.queue.includes(def.id) && !heldOnSight(s, def, now, empty)) {
      show(s, def);
      free--;
    } else enqueue(s, def.id);
  }

  s.cadence.queue = s.cadence.queue.filter((id) => {
    const def = projectDef(id);
    return !!def && !s.projects[id]?.shown && eligible(s, def);
  });

  const released = s.flags['releasedAt'];
  const releaseBeat = typeof released === 'number' && now - released < 4;
  const dripDue = now - s.cadence.lastDripAt >= dripSeconds(s) || (empty && now - (emptyAt as number) >= EMPTY_PANEL_SECONDS);
  if (s.cadence.queue.length && !releaseBeat && !modalBeat && !trainingBeat && dripDue) {
    const quiet = s.revealed['training'] === true && now - s.cadence.lastRevealAt >= STAGE1_GOVERNOR_SECONDS && free >= 0;
    const id = s.cadence.queue.find((q) => {
      const def = projectDef(q);
      return !!def && (free > 0 || uncapped(s, def) || quiet) && !heldOnSight(s, def, now, empty);
    });
    const def = id ? projectDef(id) : undefined;
    if (def) {
      show(s, def);
      s.cadence.lastDripAt = now;
    }
  }
  if (s.cadence.queue.length === 0) stage1Governor(s);
}

const seenSets = new WeakMap<string[], Set<string>>();

export function noteReveals(s: GameState): void {
  const seen = s.cadence.seen;
  let known = seenSets.get(seen);
  if (!known) {
    known = new Set(seen);
    seenSets.set(seen, known);
  }
  const set = known;
  const mark = (key: string, counts = true): void => {
    if (set.has(key)) return;
    set.add(key);
    seen.push(key);
    if (counts) s.cadence.lastRevealAt = s.stats.timePlayed;
  };
  for (const [id, on] of Object.entries(s.revealed)) if (on) mark(`f:${id}`);
  for (const [id, st] of Object.entries(s.projects)) {
    if (!st.shown) continue;
    const def = projectDef(id);
    mark(`p:${id}`, !!def && !def.rescue);
  }
  if (s.activeChoice) mark(`c:${s.activeChoice.id}`, s.activeChoice.id !== 'c_customer_email');
}
