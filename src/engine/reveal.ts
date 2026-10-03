import { GameState, projectState } from './state.js';
import { PROJECTS, ProjectDef } from '../data/projects.js';
import { visibleProjects } from './projects.js';

/**
 * The reveal scheduler (stage2.md §4.1, the part Stage 1 needs). A project whose trigger fires
 * joins a queue; the queue releases one project every `DRIP_SECONDS`, in table order, while fewer
 * than `maxVisible` are on screen, so a burst of triggers reads as one idea at a time.
 *
 * Skip the wait: rescues and urgent fixes (a wall's named remedy) appear at once and ignore the
 * cap; the stage goal (`pinned`) appears at once; the direct consequence of a purchase (`chain`)
 * appears at once when there is room. Stage 2 adds late items and a governor here; both read
 * `cadence.lastRevealAt`, which `noteReveals` keeps current.
 */
export const DRIP_SECONDS = 15;

/** Projects on screen at once (rescues, urgent fixes and the stage goal not counted). */
export function maxVisible(s: GameState): number {
  return s.stage === 1 ? 4 : 6;
}

function remainingUses(s: GameState, def: ProjectDef): number {
  return def.uses - (s.projects[def.id]?.bought ?? 0);
}

/** Ignores the cap and the queue. */
function exempt(s: GameState, def: ProjectDef): boolean {
  return def.rescue === true || def.pinned === true || def.urgent?.(s) === true;
}

/** Not counted against the cap (and never blocked by it). */
function uncapped(s: GameState, def: ProjectDef): boolean {
  return exempt(s, def) || def.sideline === true;
}

function eligible(s: GameState, def: ProjectDef): boolean {
  if (!def.stages.includes(s.stage) || remainingUses(s, def) <= 0) return false;
  // Before the Research panel, only rescues can appear (their prices are not in research).
  return def.rescue === true || s.revealed['research'] === true;
}

function show(s: GameState, def: ProjectDef): void {
  projectState(s, def.id).shown = true;
  const q = s.cadence.queue.indexOf(def.id);
  if (q >= 0) s.cadence.queue.splice(q, 1);
}

/** Position in the project table (built on first use: the data module imports this one). */
let tableOrder: Map<string, number> | null = null;
function order(id: string): number {
  if (!tableOrder) tableOrder = new Map(PROJECTS.map((p, i) => [p.id, i]));
  return tableOrder.get(id) ?? 0;
}

function enqueue(s: GameState, id: string): void {
  const q = s.cadence.queue;
  if (q.includes(id)) return;
  const at = q.findIndex((other) => order(other) > order(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

/** Every tick: triggers feed the queue; the drip releases from it. */
export function updateProjects(s: GameState): void {
  if (!s.revealed['projects']) return;
  const now = s.stats.timePlayed;
  let room = maxVisible(s) - visibleProjects(s).filter((p) => !uncapped(s, p)).length;

  for (const def of PROJECTS) {
    if (s.projects[def.id]?.shown || !eligible(s, def) || def.expires?.(s) || !def.trigger(s)) continue;
    if (exempt(s, def)) show(s, def);
    else if (def.chain && room > 0 && !s.cadence.queue.includes(def.id)) {
      show(s, def);
      room--;
    } else enqueue(s, def.id);
  }

  // Lapsed offers leave the screen; queued entries that can no longer appear leave quietly.
  for (const def of PROJECTS) {
    if (def.expires && s.projects[def.id]?.shown && def.expires(s)) withdrawProject(s, def.id);
  }
  s.cadence.queue = s.cadence.queue.filter((id) => {
    const def = PROJECTS.find((p) => p.id === id);
    return !!def && !s.projects[id]?.shown && eligible(s, def);
  });

  if (s.cadence.queue.length && now - s.cadence.lastDripAt >= DRIP_SECONDS) {
    // The first queued project that fits: side-offers never wait for room.
    const id = s.cadence.queue.find((q) => {
      const def = PROJECTS.find((p) => p.id === q);
      return !!def && (room > 0 || uncapped(s, def));
    });
    const def = id ? PROJECTS.find((p) => p.id === id) : undefined;
    if (def) {
      show(s, def);
      s.cadence.lastDripAt = now;
    }
  }
}

/** Takes a project off the screen and out of the queue (it stopped making sense). */
export function withdrawProject(s: GameState, id: string): void {
  const st = s.projects[id];
  if (st) st.shown = false;
  s.cadence.queue = s.cadence.queue.filter((q) => q !== id);
}

/** Lookup sets for `cadence.seen`, keyed by the array itself (a load replaces the array). */
const seenSets = new WeakMap<string[], Set<string>>();

/**
 * First-time reveals since the last tick: a `revealed` flag turning true, a project shown, a modal
 * opened. Keeps `cadence.lastRevealAt` (the governor's clock in later stages) and `cadence.seen`.
 */
export function noteReveals(s: GameState): void {
  const seen = s.cadence.seen;
  let known = seenSets.get(seen);
  if (!known) {
    known = new Set(seen);
    seenSets.set(seen, known);
  }
  const set = known;
  const mark = (key: string) => {
    if (set.has(key)) return;
    set.add(key);
    seen.push(key);
    s.cadence.lastRevealAt = s.stats.timePlayed;
  };
  for (const [id, on] of Object.entries(s.revealed)) if (on) mark(`f:${id}`);
  for (const [id, st] of Object.entries(s.projects)) if (st.shown) mark(`p:${id}`);
  if (s.activeChoice) mark(`c:${s.activeChoice.id}`);
}
