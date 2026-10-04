import { GameState, projectState } from './state.js';
import { PROJECTS, ProjectDef, RUNGS } from '../data/projects.js';
import { STAGE2_TABLE, STAGE2_ORDER, ContentRow, MECHANIC_FLAGS, inApproach, rowById } from '../data/stage2.js';
import { visibleProjects } from './projects.js';

/**
 * The reveal scheduler (stage2.md §4.1). A project whose trigger fires joins a queue; the queue
 * releases one project every `DRIP_SECONDS`, in table order, while fewer than `maxVisible` are on
 * screen, so a burst of triggers reads as one idea at a time.
 *
 * Skip the wait: rescues and urgent fixes (a wall's named remedy) appear at once and ignore the
 * cap; the stage goal (`pinned`) appears at once; the direct consequence of a purchase (`chain`)
 * appears at once when there is room.
 *
 * Stage 2 adds (stage2.md §4.1): buttons, panels and modals are rows of the same content table
 * (data/stage2.ts) and appear when their trigger fires, without the drip; *late* rows cannot
 * appear before the approach (best model ≥ 3×) and are released one per `LATE_SECONDS`; and the
 * governor reveals the next row whose prerequisite holds when nothing new has appeared for
 * `GOVERNOR_SECONDS`.
 */
export const DRIP_SECONDS = 15;
/** Stage 1 once the Training panel is up. */
export const STAGE1_DRIP_SECONDS = 30;
/** Stage 1 until the Training panel is on screen: one card per 60 s (critic round 2 §6.1: minutes 3–10). */
/** Stage 1: a card waits for room at most this long after the last first-time reveal (no long holes while saving). */
export const STAGE1_GOVERNOR_SECONDS = 140;
export const EARLY_DRIP_SECONDS = 60;
export const LATE_SECONDS = 75;
/** A hole in first-time reveals the governor fills (A2 allows 180 s; natural triggers get the first 170). */
export const GOVERNOR_SECONDS = 170;
/** No new panel or mechanic for this long: the governor pulls the next mechanic row (arc G2). */
export const MECHANIC_GOVERNOR_SECONDS = 240;

/** Projects on screen at once (Stage 1: rescues, urgent fixes, the stage goal and side-offers not counted; Stage 2: only rescues and G6). */
export function maxVisible(s: GameState): number {
  return s.stage === 1 ? 4 : 6;
}

/**
 * Stage 1 slows the drip while the early systems arrive: one card a minute until the Training panel,
 * then one every 30 s (critic round 2 §6.1: no more than 16 new things in any six minutes); Stage 2, 15 s.
 */
function dripSeconds(s: GameState): number {
  if (s.stage !== 1) return DRIP_SECONDS;
  if (!s.revealed['training']) return EARLY_DRIP_SECONDS;
  return STAGE1_DRIP_SECONDS;
}

/**
 * Stage 1's governor, for an empty queue: after 140 s with nothing new, the first of these
 * standalone cards that is not out yet comes out, its trigger aside (arc G1; Stage 2 has its own).
 */
const STAGE1_GOVERNED = ['p_dogfood', 'p_batch', 'p_agents', 'p_recruiter', 'p_alignment_team', 'p_safety_framework', 'p_distributed'];

function stage1Governor(s: GameState): void {
  if (s.stage !== 1 || !s.revealed['training'] || s.activeChoice) return;
  if (s.stats.timePlayed - s.cadence.lastRevealAt < STAGE1_GOVERNOR_SECONDS) return;
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

/** Ignores the cap and the queue. */
function exempt(s: GameState, def: ProjectDef): boolean {
  return def.rescue === true || def.pinned === true || def.urgent?.(s) === true;
}

/**
 * Never blocked by the cap: rescues, urgent fixes and the stage goal; in Stage 1 also side-offers.
 * Stage 2 holds every other card to six on screen, side-offers and Stage 1 leftovers included
 * (critic B4) except the G6 pre-order (`ignoresCap`); after a quiet spell one or two more may join them
 * (`overdue`). Stage 3 still lets old offers ride along.
 */
function uncapped(s: GameState, def: ProjectDef): boolean {
  if (exempt(s, def)) return true;
  if (s.stage === 2) return def.ignoresCap === true;
  return def.sideline === true || (s.stage >= 2 && def.stages.some((x) => x < s.stage));
}

/** Side offers that shorten the rung they sit beside (they may appear while it waits). */
const RUNG_SHORTCUTS = ['p_expedite', 'p_contractor', 'p_abatement'];

/**
 * Stage 1: while a pinned Abilene rung waits for money, a new side offer priced in money waits too
 * (critic C13: a first-timer bought every cheaper offer first and the rung sat for eight minutes).
 * Offers that shorten the rung, urgent cards and rescues are not held; cards already shown stay.
 */
function heldForRung(s: GameState, def: ProjectDef): boolean {
  if (s.stage !== 1 || def.pinned || def.rescue || RUNG_SHORTCUTS.includes(def.id) || def.urgent?.(s) === true) return false;
  if (!def.revealFunds && !(def.cost(s).funds ?? 0)) return false;
  // The next rung up: the first unbought one whose trigger holds (shown or about to be). The hold
  // lasts until it has been affordable for 15 s, so an offer cannot slip in ahead of the click.
  for (const id of RUNGS) {
    if ((s.projects[id]?.bought ?? 0) > 0) continue;
    const rung = projectDef(id);
    if (!rung || !(s.projects[id]?.shown || rung.trigger(s))) return false;
    if (!rung.canAfford(s)) return true;
    const since = s.flags[`rungAffordable:${id}`];
    return typeof since !== 'number' || s.stats.timePlayed - since < 15;
  }
  return false;
}

/** Stage 1: when the next rung first became affordable (for the side-offer hold above). */
function trackRungAffordable(s: GameState): void {
  if (s.stage !== 1) return;
  for (const id of RUNGS) {
    if ((s.projects[id]?.bought ?? 0) > 0) continue;
    const rung = projectDef(id);
    const key = `rungAffordable:${id}`;
    if (rung && s.projects[id]?.shown && rung.canAfford(s)) {
      if (typeof s.flags[key] !== 'number') s.flags[key] = s.stats.timePlayed;
    } else if (s.flags[key] !== undefined) delete s.flags[key];
    return;
  }
}

function eligible(s: GameState, def: ProjectDef): boolean {
  if (!def.stages.includes(s.stage) || remainingUses(s, def) <= 0) return false;
  // Stage 2's approach items belong to Stage 2: none appears after the Stage 3 arrival (B6).
  if (s.stage >= 3 && def.late) return false;
  if (!s.projects[def.id]?.shown && heldForRung(s, def)) return false;
  // Before the Research panel, only rescues can appear (their prices are not in research).
  return def.rescue === true || s.revealed['research'] === true;
}

function show(s: GameState, def: ProjectDef): void {
  const st = projectState(s, def.id);
  const first = !st.shown && st.bought === 0 && !s.cadence.seen.includes(`p:${def.id}`);
  st.shown = true;
  const q = s.cadence.queue.indexOf(def.id);
  if (q >= 0) s.cadence.queue.splice(q, 1);
  const l = s.cadence.lateQueue.indexOf(def.id);
  if (l >= 0) s.cadence.lateQueue.splice(l, 1);
  if (first) def.onShow?.(s);
}

/** Position in the project table (built on first use: the data module imports this one). */
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

/** Late rows wait in content-table order. */
function enqueueLate(s: GameState, id: string): void {
  const q = s.cadence.lateQueue;
  if (q.includes(id)) return;
  const rank = (x: string) => STAGE2_ORDER.get(x) ?? 999;
  const at = q.findIndex((other) => rank(other) > rank(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

/**
 * Stage 2: nothing new for 160 s, so a triggered card may come out over the cap (before the governor's
 * 170 s), up to `OVERFLOW` cards past it: a shelf of offers nobody can afford yet never stalls the stage.
 */
const OVERFLOW = 2;
function overdue(s: GameState): boolean {
  return s.stage === 2 && s.stats.timePlayed - s.cadence.lastRevealAt >= GOVERNOR_SECONDS - 10;
}

/** Free places under the cap. Stage 2 counts the stage goal and urgent fixes too (only rescues ride free). */
function room(s: GameState): number {
  const counted = s.stage === 2 ? visibleProjects(s).filter((p) => !p.rescue) : visibleProjects(s).filter((p) => !uncapped(s, p));
  return maxVisible(s) - counted.length;
}

/** Every tick: triggers feed the queue; the drip releases from it. */
export function updateProjects(s: GameState): void {
  if (!s.revealed['projects']) return;
  trackRungAffordable(s);
  const now = s.stats.timePlayed;
  let free = room(s);
  const approach = inApproach(s);

  for (const def of PROJECTS) {
    if (s.projects[def.id]?.shown || !eligible(s, def) || def.expires?.(s) || !def.trigger(s)) continue;
    if (def.late && s.stage === 2) {
      if (approach) enqueueLate(s, def.id);
      continue;
    }
    // Until the Training panel is up, a chained card waits for the drip like any other (critic round 2 §6.1).
    const early = s.stage === 1 && !s.revealed['training'];
    if (exempt(s, def)) show(s, def);
    else if (def.chain && !early && free > 0 && !s.cadence.queue.includes(def.id)) {
      show(s, def);
      free--;
    } else enqueue(s, def.id);
  }

  // Lapsed offers leave the screen; queued entries that can no longer appear leave quietly.
  for (const def of PROJECTS) {
    if (def.expires && s.projects[def.id]?.shown && def.expires(s)) withdrawProject(s, def.id);
  }
  s.cadence.queue = s.cadence.queue.filter((id) => {
    const def = projectDef(id);
    return !!def && !s.projects[id]?.shown && eligible(s, def);
  });

  if (s.cadence.queue.length && now - s.cadence.lastDripAt >= dripSeconds(s)) {
    // The first queued project that fits: side-offers never wait for room. After a quiet spell
    // (Stage 1: 140 s; Stage 2: 160 s) the next one comes out over the cap (Stage 2: eight cards at most).
    const quiet = s.stage === 1
      ? s.revealed['training'] === true && now - s.cadence.lastRevealAt >= STAGE1_GOVERNOR_SECONDS
      : overdue(s) && free > -OVERFLOW;
    const id = s.cadence.queue.find((q) => {
      const def = projectDef(q);
      return !!def && (free > 0 || uncapped(s, def) || quiet);
    });
    const def = id ? projectDef(id) : undefined;
    if (def) {
      show(s, def);
      s.cadence.lastDripAt = now;
    }
  }
  if (s.cadence.queue.length === 0) stage1Governor(s);
}

/** Takes a project off the screen and out of the queue (it stopped making sense). */
export function withdrawProject(s: GameState, id: string): void {
  const st = s.projects[id];
  if (st) st.shown = false;
  s.cadence.queue = s.cadence.queue.filter((q) => q !== id);
  s.cadence.lateQueue = s.cadence.lateQueue.filter((q) => q !== id);
}

// ---------- Stage 2: buttons, panels and modals; the late drip; the governor ----------

function rowDone(s: GameState, row: ContentRow): boolean {
  if (row.kind === 'project') {
    const st = s.projects[row.id];
    return !!st && (st.shown || st.bought > 0);
  }
  return row.done?.(s) === true;
}

function rowPrereq(s: GameState, row: ContentRow): boolean {
  if (row.kind === 'project') {
    const def = projectDef(row.id);
    return !!def && eligible(s, def) && (def.prereq ? def.prereq(s) : true) && !def.expires?.(s);
  }
  return row.prereq ? row.prereq(s) : true;
}

function rowLate(row: ContentRow): boolean {
  if (row.kind === 'project') return projectDef(row.id)?.late === true;
  return row.late === true;
}

/** Reveals a row now if it can appear now (a project needs room unless it skips the cap, or `overCap` past it). */
function revealRow(s: GameState, row: ContentRow, overCap = 0): boolean {
  if (row.kind === 'project') {
    const def = projectDef(row.id);
    if (!def || !eligible(s, def)) return false;
    if (!uncapped(s, def) && room(s) <= -overCap) return false;
    show(s, def);
    return true;
  }
  return row.reveal?.(s) === true;
}

/**
 * Every tick in Stage 2: rows other than projects appear when their trigger fires (late ones go to
 * the late queue); the late drip releases one late row per 75 s from the approach on; the
 * governor fills any 150 s hole in first-time reveals.
 */
export function updateStageContent(s: GameState): void {
  if (s.stage !== 2) return;
  const approach = inApproach(s);
  for (const row of STAGE2_TABLE) {
    if (row.kind === 'project' || rowDone(s, row) || !row.trigger || !row.trigger(s)) continue;
    if (row.late) {
      if (approach) enqueueLate(s, row.id);
      continue;
    }
    if (rowPrereq(s, row)) revealRow(s, row);
  }
  lateDrip(s, approach);
  governor(s, approach);
}

function lateDrip(s: GameState, approach: boolean): void {
  const c = s.cadence;
  c.lateQueue = c.lateQueue.filter((id) => {
    const row = rowById(id);
    return !!row && !rowDone(s, row);
  });
  if (!approach || c.lateQueue.length === 0) return;
  if (s.stats.timePlayed - c.lastLateAt < LATE_SECONDS) return;
  // The stage goal (pinned) leads the approach: it is the carrot for the rest of the stage.
  const pinnedFirst = [...c.lateQueue].sort((x, y) => Number(projectDef(y)?.pinned === true) - Number(projectDef(x)?.pinned === true));
  // A full shelf holds the approach back until the stage has been quiet for a while.
  const over = overdue(s) ? OVERFLOW : 0;
  for (const id of pinnedFirst) {
    const row = rowById(id);
    if (!row || !rowPrereq(s, row)) continue;
    if (revealRow(s, row, over)) {
      c.lastLateAt = s.stats.timePlayed;
      c.lateQueue = c.lateQueue.filter((q) => q !== id);
      return;
    }
  }
}

/**
 * The cadence governor (arc G1): 150 s without a first-time reveal and no modal open → reveal the
 * first row of the table that is not out yet and whose prerequisite holds, ignoring its trigger.
 * Late rows still wait for the approach. Logged in `cadence.governed` (the sim prints GOVERNOR).
 */
function governor(s: GameState, approach: boolean): void {
  const c = s.cadence;
  const now = s.stats.timePlayed;
  if (s.activeChoice) return;
  const reveals = now - c.lastRevealAt >= GOVERNOR_SECONDS;
  const mechanics = now - c.lastMechanicAt >= MECHANIC_GOVERNOR_SECONDS;
  if (!reveals && !mechanics) return;
  for (const row of STAGE2_TABLE) {
    if (row.governed === false || rowDone(s, row)) continue;
    // A mechanic hole is filled with a mechanic; a reveal hole with any row.
    if (!reveals && row.mechanic !== true) continue;
    const late = rowLate(row);
    if (late && !approach) continue;
    if (!rowPrereq(s, row)) continue;
    if (!revealRow(s, row, OVERFLOW)) continue;
    c.governed.push(`${Math.round(now)}:${row.id}`);
    c.lastRevealAt = now;
    // A mechanic row (a modal that opens a panel) counts as the mechanic now, not when it resolves.
    if (row.mechanic) c.lastMechanicAt = now;
    if (late) {
      c.lastLateAt = now;
      c.lateQueue = c.lateQueue.filter((q) => q !== row.id);
    }
    return;
  }
}

/** Lookup sets for `cadence.seen`, keyed by the array itself (a load replaces the array). */
const seenSets = new WeakMap<string[], Set<string>>();

/**
 * First-time reveals since the last tick: a `revealed` flag turning true, a project shown, a modal
 * opened. Keeps `cadence.lastRevealAt` (the governor's clock) and `cadence.seen`.
 */
export function noteReveals(s: GameState): void {
  const seen = s.cadence.seen;
  let known = seenSets.get(seen);
  if (!known) {
    known = new Set(seen);
    seenSets.set(seen, known);
  }
  const set = known;
  const mark = (key: string, counts = true): boolean => {
    if (set.has(key)) return false;
    set.add(key);
    seen.push(key);
    if (counts) s.cadence.lastRevealAt = s.stats.timePlayed;
    return true;
  };
  for (const [id, on] of Object.entries(s.revealed)) {
    if (on && mark(`f:${id}`) && MECHANIC_FLAGS.includes(id)) s.cadence.lastMechanicAt = s.stats.timePlayed;
  }
  for (const [id, st] of Object.entries(s.projects)) {
    if (!st.shown) continue;
    // Rescues are the game noticing a stall, and carried-over projects are not new (arc §6).
    const def = projectDef(id);
    const carried = !!def && s.stage >= 2 && def.stages.some((x) => x < s.stage);
    mark(`p:${id}`, !!def && !def.rescue && !carried);
  }
  if (s.activeChoice) mark(`c:${s.activeChoice.id}`, s.activeChoice.id !== 'c_customer_email');
}
