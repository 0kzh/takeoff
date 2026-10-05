import { GameState, projectState, counter } from './state.js';
import { PROJECTS, ProjectDef } from '../data/projects.js';
import { STAGE2_TABLE, STAGE2_ORDER, ContentRow, MECHANIC_FLAGS, inApproach, rowById } from '../data/stage2.js';
import { STAGE3_TABLE, STAGE3_ORDER, MECHANIC_FLAGS_S3, inApproach3, dateFallback3, rowById3 } from '../data/stage3.js';
import { STAGE4_TABLE, STAGE4_ORDER, MECHANIC_FLAGS_S4, inApproach4 } from '../data/stage4.js';
import { STAGE5_TABLE, STAGE5_ORDER, MECHANIC_FLAGS_S5 } from '../data/stage5.js';
import { bestCapability } from './economy.js';
import { visibleProjects } from './projects.js';

export const DRIP_SECONDS = 15;
export const STAGE1_DRIP_SECONDS = 30;
export const STAGE1_GOVERNOR_SECONDS = 140;
export const EARLY_DRIP_SECONDS = 60;
export const LATE_SECONDS = 75;
export const GOVERNOR_SECONDS = 170;
export const MECHANIC_GOVERNOR_SECONDS = 240;
export const LATE_MECHANIC_SPACING = 150;

export function maxVisible(s: GameState): number {
  return s.stage === 1 ? 4 : s.stage === 3 ? 5 : 6;
}

export const GRANTS_ON_OFFER = 3;
export const GRANT_SECONDS = 15;
export const FALLBACK_SECONDS = 90;
export const OPENING_DRIP_S3 = 30;

function dripSeconds(s: GameState): number {
  if (s.stage >= 3) return s.stats.timeInStage < 300 ? OPENING_DRIP_S3 : DRIP_SECONDS;
  if (s.stage !== 1) return DRIP_SECONDS;
  if (!s.revealed['training']) return EARLY_DRIP_SECONDS;
  return STAGE1_DRIP_SECONDS;
}

const STAGE1_GOVERNED = ['p_dogfood', 'p_batch', 'p_agents', 'p_recruiter', 'p_alignment_team', 'p_safety_framework', 'p_distributed'];

function stage1Governor(s: GameState): void {
  if (s.stage !== 1 || !s.revealed['training'] || s.activeChoice) return;
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
  if (exempt(s, def)) return true;
  if (s.stage === 2) return def.ignoresCap === true;
  return def.sideline === true || (s.stage >= 2 && def.stages.some((x) => x < s.stage));
}

export const FIRST_RUN_WAIT_S2 = 240;

export const OPENING_CARDS = ['p_prompting', 'p_grid', 'p_insight'];
export const EMPTY_PANEL_SECONDS = 10;
export const ON_SIGHT_SECONDS = 60;

function eligible(s: GameState, def: ProjectDef): boolean {
  if (!def.stages.includes(s.stage) || remainingUses(s, def) <= 0) return false;
  if (s.stage === 1 && !s.revealed['training'] && !def.rescue && !OPENING_CARDS.includes(def.id)) return false;
  if (s.stage >= 3 && def.late && !def.stages.includes(s.stage)) return false;
  if (s.stage === 2 && counter(s, 'runsS2') < 1 && s.stats.timeInStage < FIRST_RUN_WAIT_S2 && !exempt(s, def)) {
    const c = def.cost(s);
    if ((c.research ?? 0) > 0 || (c.funds ?? 0) > 0) return false;
  }
  return def.rescue === true || s.revealed['research'] === true || s.stage >= 5;
}

function show(s: GameState, def: ProjectDef): void {
  const st = projectState(s, def.id);
  const first = !st.shown && st.bought === 0 && !s.cadence.seen.includes(`p:${def.id}`);
  st.shown = true;
  delete s.flags[`sight:${def.id}`];
  const q = s.cadence.queue.indexOf(def.id);
  if (q >= 0) s.cadence.queue.splice(q, 1);
  const l = s.cadence.lateQueue.indexOf(def.id);
  if (l >= 0) s.cadence.lateQueue.splice(l, 1);
  if (first) def.onShow?.(s);
}

let tableOrder: Map<string, number> | null = null;
function order(id: string): number {
  if (!tableOrder) tableOrder = new Map(PROJECTS.map((p, i) => [p.id, i]));
  const s4 = STAGE4_ORDER.get(id);
  if (s4 !== undefined) return 100000 + s4;
  const s5 = STAGE5_ORDER.get(id);
  if (s5 !== undefined) return 200000 + s5;
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

function enqueueLate(s: GameState, id: string): void {
  const q = s.cadence.lateQueue;
  if (q.includes(id)) return;
  const rank = (x: string) => STAGE2_ORDER.get(x) ?? 999;
  const at = q.findIndex((other) => rank(other) > rank(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

const OVERFLOW = 2;
function overdue(s: GameState): boolean {
  return s.stage === 2 && s.stats.timePlayed - s.cadence.lastRevealAt >= GOVERNOR_SECONDS - 10;
}

function room(s: GameState): number {
  const counted = s.stage === 2
    ? visibleProjects(s).filter((p) => !p.rescue)
    : visibleProjects(s).filter((p) => !uncapped(s, p) && !p.grant);
  return maxVisible(s) - counted.length;
}

export const BEAT_GAP_SECONDS = 4;

function heldOnSight(s: GameState, def: ProjectDef, now: number, empty: boolean): boolean {
  if (s.stage !== 1 || exempt(s, def) || OPENING_CARDS.includes(def.id)) return false;
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
  const approach = inApproach(s);
  const modalBeat = now - s.cadence.lastModalAt < BEAT_GAP_SECONDS;
  const stage1 = s.stage === 1;
  if (stage1) {
    const onScreen = visibleProjects(s).some((p) => !p.rescue);
    if (onScreen) delete s.flags['panelEmptyAt'];
    else if (typeof s.flags['panelEmptyAt'] !== 'number') s.flags['panelEmptyAt'] = now;
  }
  const emptyAt = s.flags['panelEmptyAt'];
  const empty = stage1 && typeof emptyAt === 'number';
  const trainingAt = s.flags['trainingAt'];
  const trainingBeat = stage1 && typeof trainingAt === 'number' && now - trainingAt < EMPTY_PANEL_SECONDS;

  const approach3 = inApproach3(s);
  for (const def of PROJECTS) {
    if (s.projects[def.id]?.shown || !eligible(s, def) || def.expires?.(s) || !def.trigger(s)) continue;
    if (def.late && s.stage === 2) {
      if (approach) enqueueLate(s, def.id);
      continue;
    }
    if ((s.stage === 3 || s.stage === 4) && def.grant) {
      enqueueGrant(s, def.id);
      continue;
    }
    if (s.stage === 3 && def.lateAt !== undefined) {
      if (approach3) enqueueLate3(s, def.id);
      continue;
    }
    const early = s.stage === 1 && !s.revealed['training'];
    if (exempt(s, def)) show(s, def);
    else if (def.chain && !early && !trainingBeat && free > 0 && !modalBeat && !s.cadence.queue.includes(def.id) && !heldOnSight(s, def, now, empty)) {
      show(s, def);
      free--;
    } else enqueue(s, def.id);
  }

  for (const def of PROJECTS) {
    if (def.expires && s.projects[def.id]?.shown && def.expires(s)) withdrawProject(s, def.id);
  }
  s.cadence.queue = s.cadence.queue.filter((id) => {
    const def = projectDef(id);
    return !!def && !s.projects[id]?.shown && eligible(s, def);
  });

  const released = s.flags['releasedAt'];
  const releaseBeat = typeof released === 'number' && now - released < 4;
  const dripDue = now - s.cadence.lastDripAt >= dripSeconds(s) || (empty && now - (emptyAt as number) >= EMPTY_PANEL_SECONDS);
  if (s.cadence.queue.length && !releaseBeat && !modalBeat && !trainingBeat && dripDue) {
    const quiet = s.stage === 1
      ? s.revealed['training'] === true && now - s.cadence.lastRevealAt >= STAGE1_GOVERNOR_SECONDS && free >= 0
      : overdue(s) && free > -OVERFLOW;
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

function enqueueGrant(s: GameState, id: string): void {
  const q = (s.cadence.grantQueue ??= []);
  if (q.includes(id)) return;
  const at = q.findIndex((other) => order(other) > order(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

function enqueueLate3(s: GameState, id: string): void {
  const q = s.cadence.lateQueue;
  if (q.includes(id)) return;
  const rank = (x: string) => STAGE3_ORDER.get(x) ?? 999;
  const at = q.findIndex((other) => rank(other) > rank(id));
  if (at < 0) q.push(id);
  else q.splice(at, 0, id);
}

export function withdrawProject(s: GameState, id: string): void {
  const st = s.projects[id];
  if (st) st.shown = false;
  s.cadence.queue = s.cadence.queue.filter((q) => q !== id);
  s.cadence.lateQueue = s.cadence.lateQueue.filter((q) => q !== id);
}

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

export function updateStageContent(s: GameState): void {
  if (s.stage === 3) {
    updateStage3Content(s);
    return;
  }
  if (s.stage === 4) {
    updateStage4Content(s);
    return;
  }
  if (s.stage === 5) {
    updateStage5Content(s);
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
  const pinnedFirst = [...c.lateQueue].sort((x, y) => Number(projectDef(y)?.pinned === true) - Number(projectDef(x)?.pinned === true));
  const over = overdue(s) ? OVERFLOW : 0;
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

function governor(s: GameState, approach: boolean): void {
  const c = s.cadence;
  const now = s.stats.timePlayed;
  if (s.activeChoice) return;
  const reveals = now - c.lastRevealAt >= GOVERNOR_SECONDS;
  const mechanics = now - c.lastMechanicAt >= MECHANIC_GOVERNOR_SECONDS;
  if (!reveals && !mechanics) return;
  for (const row of STAGE2_TABLE) {
    if (row.governed === false || rowDone(s, row)) continue;
    if (!reveals && row.mechanic !== true) continue;
    const late = rowLate(row);
    if (late && !approach) continue;
    if (!rowPrereq(s, row)) continue;
    if (!revealRow(s, row, OVERFLOW)) continue;
    c.governed.push(`${Math.round(now)}:${row.id}`);
    c.lastRevealAt = now;
    if (row.mechanic) c.lastMechanicAt = now;
    if (late) {
      c.lastLateAt = now;
      c.lateQueue = c.lateQueue.filter((q) => q !== row.id);
    }
    return;
  }
}

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

function lateAtOf(id: string): number {
  return projectDef(id)?.lateAt ?? 14;
}

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
    if (!due && !(fallback && since >= FALLBACK_SECONDS)) continue;
    const quiet = now - c.lastRevealAt >= GOVERNOR_SECONDS - 20
      || (projectDef(id)?.instrument === true && now - c.lastMechanicAt >= LATE_MECHANIC_SPACING);
    if (revealRow(s, row, quiet ? OVERFLOW + 1 : 1)) {
      c.lastLateAt = now;
      c.lateQueue = c.lateQueue.filter((q) => q !== id);
      return;
    }
  }
}

const LATE_REACH = 0.85;

function governor3(s: GameState): void {
  const c = s.cadence;
  const now = s.stats.timePlayed;
  if (s.activeChoice) return;
  const reveals = now - c.lastRevealAt >= GOVERNOR_SECONDS;
  const mechanics = now - c.lastMechanicAt >= MECHANIC_GOVERNOR_SECONDS;
  if (!reveals && !mechanics) return;
  const best = bestCapability(s);
  for (const lastResort of [false, true]) {
    for (const row of STAGE3_TABLE) {
      if (row.governed === false || rowDone3(s, row) || rowLate3(row) !== lastResort) continue;
      if (lastResort && best < LATE_REACH * lateAtOf(row.id)) continue;
      if (!reveals && row.mechanic !== true) continue;
      if (row.kind === 'project' && projectDef(row.id)?.grant) {
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
      if (lastResort) {
        c.lastLateAt = now;
        c.lateQueue = c.lateQueue.filter((q) => q !== row.id);
      }
      return;
    }
  }
}

function rowLate4(row: ContentRow): boolean {
  return row.kind !== 'project' && row.late === true;
}

function updateStage4Content(s: GameState): void {
  const approach = inApproach4(s);
  for (const row of STAGE4_TABLE) {
    if (row.kind === 'project' || rowDone3(s, row) || !row.trigger || !row.trigger(s)) continue;
    if (rowLate4(row) && !approach) continue;
    if (rowPrereq(s, row)) revealRow(s, row);
  }
  grantDrip(s);
  governor4(s, approach);
}

function governor4(s: GameState, approach: boolean): void {
  const c = s.cadence;
  const now = s.stats.timePlayed;
  if (s.activeChoice) return;
  const reveals = now - c.lastRevealAt >= GOVERNOR_SECONDS;
  const mechanics = now - c.lastMechanicAt >= MECHANIC_GOVERNOR_SECONDS;
  if (!reveals && !mechanics) return;
  for (const row of STAGE4_TABLE) {
    if (row.governed === false || rowDone3(s, row)) continue;
    if (!reveals && row.mechanic !== true) continue;
    if (rowLate4(row) && !approach) continue;
    if (row.kind === 'project' && projectDef(row.id)?.grant) {
      const def = projectDef(row.id);
      if (!def || !eligible(s, def) || (def.prereq && !def.prereq(s)) || visibleProjects(s).filter((p) => p.grant).length >= GRANTS_ON_OFFER) continue;
      show(s, def);
      c.lastGrantAt = now;
    } else {
      if (!rowPrereq(s, row)) continue;
      if (row.kind !== 'project' && row.trigger && !row.trigger(s) && row.late) continue;
      if (!revealRow(s, row, OVERFLOW)) continue;
    }
    c.governed.push(`${Math.round(now)}:${row.id}`);
    c.lastRevealAt = now;
    if (row.mechanic) c.lastMechanicAt = now;
    return;
  }
}

function updateStage5Content(s: GameState): void {
  for (const row of STAGE5_TABLE) {
    if (row.kind === 'project' || rowDone3(s, row) || !row.trigger || !row.trigger(s)) continue;
    if (rowPrereq(s, row)) revealRow(s, row);
  }
  const c = s.cadence;
  const now = s.stats.timePlayed;
  if (s.activeChoice || now - c.lastRevealAt < GOVERNOR_SECONDS) return;
  for (const row of STAGE5_TABLE) {
    if (row.governed === false || rowDone3(s, row)) continue;
    if (row.id === 'p_reflection' || row.id === 'p_relay' || row.id === 'p_jupiter') continue;
    if (!rowPrereq(s, row)) continue;
    if (!revealRow(s, row, OVERFLOW)) continue;
    c.governed.push(`${Math.round(now)}:${row.id}`);
    c.lastRevealAt = now;
    return;
  }
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
  const mark = (key: string, counts = true): boolean => {
    if (set.has(key)) return false;
    set.add(key);
    seen.push(key);
    if (counts) s.cadence.lastRevealAt = s.stats.timePlayed;
    return true;
  };
  for (const [id, on] of Object.entries(s.revealed)) {
    if (on && mark(`f:${id}`) && (MECHANIC_FLAGS.includes(id) || MECHANIC_FLAGS_S3.includes(id) || MECHANIC_FLAGS_S4.includes(id) || MECHANIC_FLAGS_S5.includes(id))) s.cadence.lastMechanicAt = s.stats.timePlayed;
  }
  for (const [id, st] of Object.entries(s.projects)) {
    if (!st.shown) continue;
    const def = projectDef(id);
    const carried = !!def && s.stage >= 2 && def.stages.some((x) => x < s.stage);
    mark(`p:${id}`, !!def && !def.rescue && !carried);
  }
  if (s.activeChoice) mark(`c:${s.activeChoice.id}`, s.activeChoice.id !== 'c_customer_email');
}
