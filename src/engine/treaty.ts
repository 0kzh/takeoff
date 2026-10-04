import { GameState, say, logNews, press, counter, isBought } from './state.js';
import { fmtInt, fmtClock } from './format.js';
import { seats } from './world3.js';
import { moveGov } from './world.js';
import { openChoice } from './events.js';
import { generationCost } from './training.js';

/**
 * Stage 4's treaty and the Committee's agenda (stage4.md §2.8–§2.10): progress 0–100 that rises one
 * point every `TREATY_SECONDS` while the Committee has five seats with OpenMind and approval is above
 * −60, up to a ceiling that names what it waits for; `Draft clauses`, a share of research, adds to it;
 * the last fifth is treaty chips the fleet installs. Agenda items cost the Committee's time, one at a
 * time. DOM-free.
 */

/**
 * One point of progress every this many seconds (stage4.md §9.5's first knob; the as-built deltas' re-run:
 * one point in 20 s, so a lab that works the treaty signs near 30 minutes and one that does not near 36).
 */
export const TREATY_SECONDS = 27;
/** `Draft clauses`: treaty +0.2 points for each 2 % of a generation diverted (at 20 %, about half again the accrual). */
export const DRAFT_POINTS = 0.2;
export const DRAFT_SHARES = [0, 0.1, 0.2, 0.3];
/** Agenda items take 90 s of the Committee's time (60 s at eight seats or more); a hearing 60 s. */
export const AGENDA_SECONDS = 90;
export const AGENDA_SECONDS_FAST = 60;
export const HEARING_SECONDS = 60;
export const VERIFY_BAIWEN_SECONDS = 180;
export const REBUILD_SECONDS = 120;
export const TREATY_SEATS = 5;
export const TREATY_STALL_APPROVAL = -60;

export const AGENDA_TITLES: Record<string, string> = {
  talks: 'Treaty talks',
  terms: 'Treaty terms',
  proofing: 'Nationalisation-proofing',
  spec4: 'Write the Spec with the Committee',
  hearing: 'a hearing',
};

/** Seconds `Design Concord-1` takes once bought: the enforcer is written, then the chips can go in. */
export const CONCORD_DESIGN_SECONDS = 90;

/** Concord-1 is designed (its card bought and its 1:30 run out). */
export function concordDesigned(s: GameState): boolean {
  return s.flags['concord1'] === true;
}

export function talksOpen(s: GameState): boolean {
  return s.s4.talks === 'open';
}

/** Baiwen-4 checked (aligned, signed with anyway, or rebuilt), or the negotiation grant took the question away. */
export function baiwenSettled(s: GameState): boolean {
  const b = s.s4.baiwen;
  return b === 'aligned' || b === 'misaligned' || b === 'rebuilt' || s.flags['negotiateAuto'] === true;
}

/** The ceiling progress waits under, and the words for what it waits for (§2.8). */
export function treatyCeiling(s: GameState): { cap: number; wait: string } {
  if (!baiwenSettled(s)) {
    return { cap: isBought(s, 'p_inspectors') ? 50 : 40, wait: 'waiting for verification' };
  }
  if (s.flags['termsDone'] !== true) return { cap: 60, wait: 'waiting for terms' };
  if (!concordDesigned(s)) {
    const left = counter(s, 'concordLeft');
    return { cap: 80, wait: left > 0 ? `designing Concord-1 — ${fmtClock(Math.ceil(left))}` : 'waiting for a model that can write the enforcer' };
  }
  return { cap: 100, wait: 'treaty chips' };
}

/** Why the treaty does not move right now ('' when it does). */
export function treatyStall(s: GameState): string {
  if (!talksOpen(s)) return s.s4.talks === 'closed' ? 'talks closed' : 'not negotiating';
  if (s.s4.treatyFrozen > 0) return `Beijing retrains under joint monitors — ${fmtClock(s.s4.treatyFrozen)}`;
  if (seats(s) < TREATY_SEATS) return `the Committee will not table it: ${seats(s)} seats`;
  if (s.approval <= TREATY_STALL_APPROVAL) return `stalled: approval ${fmtInt(Math.round(s.approval))}`;
  return '';
}

/** Accrual a second: the base, the lead's two bands, the negotiation grant's stance, the fleet's Treaty goal. */
export function treatyRate(s: GameState): number {
  if (treatyStall(s)) return 0;
  let r = 1 / TREATY_SECONDS;
  if (s.lead < 0) r *= 1.25;
  else if (s.lead > 3) r *= 0.75;
  if (s.flags['negotiateAuto'] === true) r *= s.s4.stance === 'hold' ? 2 : s.s4.stance === 'concede' ? 4 : 3;
  if (s.flags['fleetAuto'] === true && s.s4.fleetGoal === 'treaty') r += 1 / 60;
  return r;
}

/** Points a minute, for the panel and the Draft clauses line. */
export function treatyPerMinute(s: GameState): number {
  return 60 * treatyRate(s);
}

function addProgress(s: GameState, points: number): void {
  const { cap } = treatyCeiling(s);
  const top = Math.min(cap, 80);
  if (s.s4.treaty >= top) return;
  s.s4.treaty = Math.min(top, s.s4.treaty + points);
}

/** Research diverted to `Draft clauses` turns into progress (up to the ceiling; at it, nothing). */
export function draftTick(s: GameState, research: number): void {
  if (research <= 0 || !talksOpen(s) || treatyStall(s)) return;
  const unit = 0.02 * Math.max(1, generationCost(s));
  addProgress(s, (DRAFT_POINTS * research) / unit);
}

/** `Draft clauses: 20%`: the share's next step, 0 → 10 → 20 → 30 % → 0. */
export function cycleDraft(s: GameState): boolean {
  if (s.stage !== 4 || !s.revealed['draft']) return false;
  const i = DRAFT_SHARES.findIndex((x) => Math.abs(x - s.s4.draftShare) < 1e-9);
  s.s4.draftShare = DRAFT_SHARES[(i + 1) % DRAFT_SHARES.length]!;
  press(s, 'draft');
  return true;
}

export function setDraftShare(s: GameState, share: number): boolean {
  if (s.stage !== 4 || !s.revealed['draft'] || !DRAFT_SHARES.some((x) => Math.abs(x - share) < 1e-9)) return false;
  if (Math.abs(s.s4.draftShare - share) < 1e-9) return false;
  s.s4.draftShare = share;
  press(s, 'draft');
  return true;
}

// ---------- the agenda (§2.9) ----------

export function agendaSeconds(s: GameState, id: string): number {
  if (id === 'hearing') return HEARING_SECONDS;
  return seats(s) >= 8 ? AGENDA_SECONDS_FAST : AGENDA_SECONDS;
}

/** Puts an item before the Committee; behind whatever is running, it waits and shows `(next)`. */
export function startAgenda(s: GameState, id: string): void {
  const total = agendaSeconds(s, id);
  s.s4.agenda.push({ id, remaining: total, total });
  s.revealed['agenda'] = true;
}

/** Seconds until an item now added would be done. */
export function agendaQueueSeconds(s: GameState): number {
  return s.s4.agenda.reduce((a, x) => a + x.remaining, 0);
}

/** `Agenda: Treaty terms — 1:12 · next: a hearing`. */
export function agendaLine(s: GameState): string {
  const [head, next] = s.s4.agenda;
  if (!head) return 'Agenda: —';
  return `Agenda: ${AGENDA_TITLES[head.id] ?? head.id} — ${fmtClock(Math.ceil(head.remaining))}${next ? ` · next: ${AGENDA_TITLES[next.id] ?? next.id}` : ''}`;
}

/** `Hold a hearing` (§2.11): from the arrival below five seats, with the agenda otherwise; 60 s each, queued. */
export function holdHearing(s: GameState): boolean {
  if (s.stage !== 4 || !s.revealed['hearing']) return false;
  if (s.s4.agenda.filter((x) => x.id === 'hearing').length >= 3) return false;
  startAgenda(s, 'hearing');
  press(s, 'hearing');
  return true;
}

/** What a hearing returns: relations +2, +4 at approval 0 or more. */
export function hearingGain(s: GameState): number {
  return s.approval >= 0 ? 4 : 2;
}

function finishAgenda(s: GameState, id: string): void {
  if (id === 'talks') {
    s.s4.talks = 'open';
    s.s4.treaty = Math.max(s.s4.treaty, s.s4.treatyOpening);
    s.revealed['treaty'] = true;
    s.revealed['draft'] = true;
    // The Treaty panel takes Geopolitics' place, the lead line with it (§2.8).
    s.revealed['geopolitics'] = false;
    say(s, `Treaty talks open. Progress: ${fmtInt(Math.round(s.s4.treaty))}%. It will not pass 40% unverified.`);
    logNews(s, 'OpenMind\'s Committee and Beijing agree to talk. The agenda is one line.');
  } else if (id === 'terms') {
    s.flags['termsDone'] = true;
    say(s, 'Terms tabled: a line no model may cross, and who checks.');
  } else if (id === 'proofing') {
    s.flags['proofing'] = true;
    moveGov(s, 10);
    say(s, 'The Committee writes down what it cannot take. It signs.');
  } else if (id === 'spec4') {
    s.alignmentTrue = Math.min(100, s.alignmentTrue + 3);
    moveGov(s, 5);
    say(s, 'The Spec, rewritten in a room with ten chairs. It is longer.');
  } else if (id === 'hearing') {
    const before = Math.round(s.govRelations);
    moveGov(s, hearingGain(s));
    // The first hearing is said; after that the seats meter and the button's return line carry it.
    if (s.flags['hearingSaid'] !== true) {
      s.flags['hearingSaid'] = true;
      say(s, `A hearing. Relations ${before} → ${Math.round(s.govRelations)}.`);
    }
  }
}

/** Once a second: the agenda's head counts down; the treaty accrues; Baiwen-4's verification and rebuild run. */
export function updateTreaty(s: GameState): void {
  const f = s.s4;
  const head = f.agenda[0];
  if (head) {
    head.remaining -= 1;
    if (head.remaining <= 0) {
      f.agenda.shift();
      finishAgenda(s, head.id);
    }
  }
  if (f.treatyFrozen > 0) {
    f.treatyFrozen = Math.max(0, f.treatyFrozen - 1);
    if (f.treatyFrozen <= 0 && f.baiwen === 'rebuilding') {
      f.baiwen = 'rebuilt';
      say(s, 'Baiwen-5 is verified under joint monitors. The treaty moves again.');
    }
  }
  // Concord-1's design, a named wait (1:30) once a model can write it.
  const designing = counter(s, 'concordLeft');
  if (designing > 0) {
    s.flags['concordLeft'] = Math.max(0, designing - 1);
    if (designing - 1 <= 0) {
      s.flags['concord1'] = true;
      say(s, 'Concord-1 is designed: one model, on sealed chips, that only enforces.');
      logNews(s, 'A treaty is proposed. Humans are listed as a party.');
    }
  }
  if (f.baiwen === 'verifying') {
    f.baiwenLeft = Math.max(0, f.baiwenLeft - 1);
    if (f.baiwenLeft <= 0) {
      // Read: the answer waits on its card (`What Baiwen-4 Wants`), which sets what the lab knows.
      f.baiwen = 'read';
      openChoice(s, 'c_verify', { aligned: f.baiwenAligned ? 1 : 0 });
    }
  }
  if (talksOpen(s)) {
    const rate = treatyRate(s);
    if (rate > 0) addProgress(s, rate);
    // The last fifth is the chips (§2.8): installed, the treaty follows them to 100.
    if (concordDesigned(s) && f.treaty >= 80 - 1e-9) f.treaty = Math.max(f.treaty, 80 + 20 * f.chipsInstalled);
  }
  treatyWalls(s);
}

/** The stall lines (§2.7, §8): every 180 s, each naming its answer. */
function treatyWalls(s: GameState): void {
  if (!talksOpen(s)) return;
  const now = s.stats.timePlayed;
  if (now - counter(s, 'treatyStallAt') < 180) return;
  if (s.approval <= TREATY_STALL_APPROVAL) {
    s.flags['treatyStallAt'] = now;
    say(s, `The treaty is stalled: approval ${fmtInt(Math.round(s.approval))}. Nobody signs with a company the street wants closed.`);
  } else if (seats(s) < TREATY_SEATS) {
    s.flags['treatyStallAt'] = now;
    say(s, `The Committee will not table it: ${seats(s)} seats. Hearings, proofing and the Spec win seats.`);
  }
}

/** The opening value stored for `Treaty talks` (§1.1): 10, +10 the pact, +5 the memo, +10 the back channel, −15 escalated. */
export function treatyOpening(s: GameState): number {
  let v = 10;
  if (s.flags['pactSigned'] === true) v += 10;
  if (s.flags['memo'] === 'reported') v += 5;
  if (s.flags['backChannel'] === true) v += 10;
  if (s.flags['escalated'] === true) v -= 15;
  return Math.max(0, v);
}

/** `Negotiator's stance` (the negotiation grant's selector): treaty ×2 holding the line, ×3, ×4 conceding. */
export function setStance(s: GameState, v: 'hold' | 'balanced' | 'concede'): boolean {
  if (s.stage !== 4 || s.flags['negotiateAuto'] !== true || s.s4.stance === v) return false;
  s.s4.stance = v;
  press(s, 'stance');
  return true;
}

/** `Baiwen-4: not verified` / `verifying — 1:12` / `verified` / `verified, not aligned` / `rebuilt and verified`. */
export function baiwenStatus(s: GameState): string {
  const b = s.s4.baiwen;
  if (b === 'verifying') return `verifying — ${fmtClock(s.s4.baiwenLeft)}`;
  if (b === 'read') return 'read, the team reports';
  if (b === 'aligned') return 'verified';
  if (b === 'misaligned') return 'verified, not aligned';
  if (b === 'rebuilding') return 'rebuilding under joint monitors';
  if (b === 'rebuilt') return 'rebuilt and verified';
  return s.flags['negotiateAuto'] === true ? 'its model talks to ours' : 'not verified';
}

/** What the lab knows about Baiwen's model, for the treaty card and the end screen. */
export function baiwenKnown(s: GameState): string {
  const b = s.s4.baiwen;
  if (b === 'aligned') return 'verified';
  if (b === 'misaligned') return 'verified, not aligned';
  if (b === 'rebuilt') return 'rebuilt and verified';
  return 'not verified';
}
