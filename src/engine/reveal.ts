import { GameState, projectState } from './state.js';
import { PROJECTS, ProjectDef } from '../data/projects.js';
import { STAGE2_TABLE, STAGE2_ORDER, ContentRow, MECHANIC_FLAGS, inApproach, rowById } from '../data/stage2.js';
import { STAGE3_TABLE, STAGE3_ORDER, MECHANIC_FLAGS_S3, inApproach3, dateFallback3, rowById3 } from '../data/stage3.js';
import { bestCapability } from './economy.js';
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
/** The late drip's spacing between two mechanics of the approach. */
export const LATE_MECHANIC_SPACING = 150;

/** Projects on screen at once (Stage 1: rescues, urgent fixes, the stage goal and side-offers not counted; Stage 2: only rescues and G6). */
export function maxVisible(s: GameState): number {
  return s.stage === 1 ? 4 : 6;
}

/** Stage 3: grants on offer at once, and their spacing (stage3.md §4.1 item 1). */
export const GRANTS_ON_OFFER = 3;
export const GRANT_SECONDS = 15;
/** Stage 3's late rows released on the date fallback, 90 s apart (§4.1 item 9). */
export const FALLBACK_SECONDS = 90;
/** Stage 3's drip for its first five minutes (§4.1 item 8). */
export const OPENING_DRIP_S3 = 30;

/**
 * Stage 1 slows the drip while the early systems arrive: one card a minute until the Training panel,
 * then one every 30 s (critic round 2 §6.1: no more than 16 new things in any six minutes); Stage 2, 15 s.
 */
function dripSeconds(s: GameState): number {
  if (s.stage === 3) return s.stats.timeInStage < 300 ? OPENING_DRIP_S3 : DRIP_SECONDS;
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

function eligible(s: GameState, def: ProjectDef): boolean {
  if (!def.stages.includes(s.stage) || remainingUses(s, def) <= 0) return false;
  // Stage 2's approach items belong to Stage 2: none appears after the Stage 3 arrival (B6), except
  // the carried cards (their `stages` name Stage 3: code review, honesty evals, the second campus).
  if (s.stage >= 3 && def.late && !def.stages.includes(s.stage)) return false;
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
  // Stage 3: grants have their own list; the stage goals ride free as before.
  const counted = s.stage === 2
    ? visibleProjects(s).filter((p) => !p.rescue)
    : visibleProjects(s).filter((p) => !uncapped(s, p) && !p.grant);
  return maxVisible(s) - counted.length;
}

/**
 * A modal and a new card are separate beats: a card waits this long after a modal opens, and an
 * unprompted modal this long after a first-time reveal (engine/events.ts).
 */
export const BEAT_GAP_SECONDS = 4;

/** Every tick: triggers feed the queue; the drip releases from it. */
export function updateProjects(s: GameState): void {
  if (!s.revealed['projects']) return;
  const now = s.stats.timePlayed;
  let free = room(s);
  const approach = inApproach(s);
  const modalBeat = now - s.cadence.lastModalAt < BEAT_GAP_SECONDS;

  const approach3 = inApproach3(s);
  for (const def of PROJECTS) {
    if (s.projects[def.id]?.shown || !eligible(s, def) || def.expires?.(s) || !def.trigger(s)) continue;
    if (def.late && s.stage === 2) {
      if (approach) enqueueLate(s, def.id);
      continue;
    }
    // Stage 3: grants wait for a place in their own list; late rows for the approach.
    if (s.stage === 3 && def.grant) {
      enqueueGrant(s, def.id);
      continue;
    }
    if (s.stage === 3 && def.lateAt !== undefined) {
      if (approach3) enqueueLate3(s, def.id);
      continue;
    }
    // Until the Training panel is up, a chained card waits for the drip like any other (critic round 2 §6.1).
    const early = s.stage === 1 && !s.revealed['training'];
    if (exempt(s, def)) show(s, def);
    else if (def.chain && !early && free > 0 && !modalBeat && !s.cadence.queue.includes(def.id)) {
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

  // A release redraws the Training panel and prints its lines: the next card waits 4 s so the two
  // are separate beats (no beat adds more than ~8 numbers).
  const released = s.flags['releasedAt'];
  const releaseBeat = typeof released === 'number' && now - released < 4;
  if (s.cadence.queue.length && !releaseBeat && !modalBeat && now - s.cadence.lastDripAt >= dripSeconds(s)) {
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

/** Stage 3: a grant whose trigger fired waits in table order for a place in the list. */
function enqueueGrant(s: GameState, id: string): void {
  const q = (s.cadence.grantQueue ??= []);
  if (q.includes(id)) return;
  const at = q.findIndex((other) => order(other) > order(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

/** Stage 3's late rows wait in content-table order (projects and the memo alike). */
function enqueueLate3(s: GameState, id: string): void {
  const q = s.cadence.lateQueue;
  if (q.includes(id)) return;
  const rank = (x: string) => STAGE3_ORDER.get(x) ?? 999;
  const at = q.findIndex((other) => rank(other) > rank(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
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
  if (s.stage === 3) {
    updateStage3Content(s);
    return;
  }
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
  // The approach's mechanics are spaced (critic C8: a late stretch with nothing new after a bunch of
  // three): a mechanic row waits until the last mechanic is 150 s old.
  const mechanicSpaced = s.stats.timePlayed - c.lastMechanicAt >= LATE_MECHANIC_SPACING;
  for (const id of pinnedFirst) {
    const row = rowById(id);
    if (!row || !rowPrereq(s, row)) continue;
    if (row.mechanic && !mechanicSpaced) continue;
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

// ---------- Stage 3: the grant list, the approach, the governor (stage3.md §4.1) ----------

function rowDone3(s: GameState, row: ContentRow): boolean {
  if (row.kind === 'project') {
    const st = s.projects[row.id];
    return !!st && (st.shown || st.bought > 0);
  }
  return row.done?.(s) === true;
}

function rowLate3(row: ContentRow): boolean {
  if (row.kind === 'project') return projectDef(row.id)?.lateAt !== undefined;
  return row.late === true;
}

/** A late row's capability threshold (the memo: 14×). */
function lateAtOf(id: string): number {
  return projectDef(id)?.lateAt ?? 14;
}

/**
 * Every tick in Stage 3: rows other than projects appear when their trigger fires (the late ones go
 * to the late queue); grants enter their list three at most, 15 s apart; the approach releases one
 * late row per 75 s once the best model passes its threshold (from September 2027 regardless, 90 s
 * apart); the governor fills a 170 s hole with the next non-late row whose prerequisite holds.
 */
function updateStage3Content(s: GameState): void {
  const approach = inApproach3(s);
  for (const row of STAGE3_TABLE) {
    if (row.kind === 'project' || rowDone3(s, row) || !row.trigger || !row.trigger(s)) continue;
    if (row.late) {
      if (approach) enqueueLate3(s, row.id);
      continue;
    }
    if (rowPrereq(s, row)) revealRow(s, row);
  }
  grantDrip(s);
  lateDrip3(s, approach);
  governor3(s);
}

function grantDrip(s: GameState): void {
  const c = s.cadence;
  const q = (c.grantQueue ??= []);
  c.grantQueue = q.filter((id) => {
    const def = projectDef(id);
    return !!def && !s.projects[id]?.shown && eligible(s, def);
  });
  if (c.grantQueue.length === 0) return;
  const onOffer = visibleProjects(s).filter((p) => p.grant).length;
  if (onOffer >= GRANTS_ON_OFFER) return;
  if (s.stats.timePlayed - (c.lastGrantAt ?? -999) < GRANT_SECONDS) return;
  const def = projectDef(c.grantQueue[0]!);
  if (!def) return;
  show(s, def);
  c.lastGrantAt = s.stats.timePlayed;
}

function lateDrip3(s: GameState, approach: boolean): void {
  const c = s.cadence;
  c.lateQueue = c.lateQueue.filter((id) => {
    const row = rowById3(id);
    return !!row && !rowDone3(s, row) && !(projectDef(id)?.expires?.(s) ?? false);
  });
  if (!approach || c.lateQueue.length === 0) return;
  const now = s.stats.timePlayed;
  const fallback = dateFallback3(s);
  const since = now - c.lastLateAt;
  if (since < LATE_SECONDS) return;
  const best = bestCapability(s);
  for (const id of c.lateQueue) {
    const row = rowById3(id);
    if (!row || !rowPrereq(s, row)) continue;
    const due = best >= lateAtOf(id) - 1e-9;
    // The date fallback releases rows whose threshold has not come, in table order, 90 s apart.
    if (!due && !(fallback && since >= FALLBACK_SECONDS)) continue;
    if (revealRow(s, row, OVERFLOW)) {
      c.lastLateAt = now;
      c.lateQueue = c.lateQueue.filter((q) => q !== id);
      return;
    }
  }
}

function governor3(s: GameState): void {
  const c = s.cadence;
  const now = s.stats.timePlayed;
  if (s.activeChoice) return;
  const reveals = now - c.lastRevealAt >= GOVERNOR_SECONDS;
  const mechanics = now - c.lastMechanicAt >= MECHANIC_GOVERNOR_SECONDS;
  if (!reveals && !mechanics) return;
  for (const row of STAGE3_TABLE) {
    if (row.governed === false || rowDone3(s, row) || rowLate3(row)) continue;
    if (!reveals && row.mechanic !== true) continue;
    if (row.kind === 'project' && projectDef(row.id)?.grant) {
      // A grant the governor pulls joins the list (it is still a grant).
      const def = projectDef(row.id);
      if (!def || !eligible(s, def) || visibleProjects(s).filter((p) => p.grant).length >= GRANTS_ON_OFFER) continue;
      show(s, def);
      c.lastGrantAt = now;
    } else {
      if (!rowPrereq(s, row)) continue;
      if (!revealRow(s, row, OVERFLOW)) continue;
    }
    c.governed.push(`${Math.round(now)}:${row.id}`);
    c.lastRevealAt = now;
    if (row.mechanic) c.lastMechanicAt = now;
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
    if (on && mark(`f:${id}`) && (MECHANIC_FLAGS.includes(id) || MECHANIC_FLAGS_S3.includes(id))) s.cadence.lastMechanicAt = s.stats.timePlayed;
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
