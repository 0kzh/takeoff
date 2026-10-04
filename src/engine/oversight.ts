import { GameState, say, logNews, counter, isBought } from './state.js';
import { rng } from './rng.js';
import { fmtClock } from './format.js';
import { bestCapability } from './economy.js';
import { seats, committeeSeated, at2027 } from './world3.js';
import { openChoice, fireDevelopmentOnce, fireCrisis } from './events.js';

/**
 * The Oversight Committee (stage3.md §2.11, §7): the count of major incidents, the order and its
 * 1:30, the memo's leak, the session that opens at 21×, the halt offer, the vote. DOM-free. The
 * order can only end the run if the player refuses it (or a third is drawn up) and the cause still
 * stands when its 1:30 runs out (arc §4).
 */

/** At most one major incident is counted per 240 s (§2.11). */
export const MAJOR_SPACING = 240;
/** The order's named wait after a refusal. */
export const ORDER_SECONDS = 90;
/** The session's beats: the leak roll, the halt offer, the Hold toggle; ready once it is 120 s old. */
export const SESSION_LEAK_AT = 30;
export const SESSION_HALT_AT = 45;
export const SESSION_HOLD_AT = 120;
export const SESSION_READY_AT = 120;
/**
 * Capability the session opens at (with the memo answered) and the vote needs. Departure: §7.1 says
 * 22×; at the built pace the last test (17.5×) and a 22× session were five minutes apart with nothing
 * new between them (B4), so the Committee sits one run earlier.
 */
export const SESSION_CAP = 21;
export const VOTE_CAP = 25;

/** A breakout, sabotage or the leak: counted once per 240 s; two draw a warning, three an order. */
export function addMajorIncident(s: GameState, what: string): void {
  const now = s.stats.timePlayed;
  const last = typeof s.flags['lastMajorAt'] === 'number' ? (s.flags['lastMajorAt'] as number) : -999;
  if (now - last < MAJOR_SPACING) return;
  s.flags['lastMajorAt'] = now;
  s.majorIncidents = Math.min(3, (s.majorIncidents ?? 0) + 1);
  s.flags['majorTotal'] = counter(s, 'majorTotal') + 1;
  s.flags['lastMajorWhat'] = what;
  if (s.majorIncidents === 2) say(s, 'Two major incidents. A third and the Committee drafts an order.');
}

/** The relations under which the Committee drafts an order: 20, 35 with the defense contract, −10 at SL5, +10 with the DPA. */
export function orderThreshold(s: GameState): number {
  let t = s.flags['defenseContract'] === true ? 35 : 20;
  if (s.securityLevel >= 5) t -= 10;
  if (s.flags['dpa'] === true) t += 10;
  // Stage 4: Nationalisation-proofing takes ten off (stage4.md §2.9).
  if (s.flags['proofing'] === true) t -= 10;
  return t;
}

/** Why the Committee would draft an order now ('' when it would not): §2.11. */
export function orderCause(s: GameState): '' | 'relations' | 'incidents' | 'leak' | 'consolidation' {
  if (s.stage === 4) {
    // Stage 4 (§2.9): relations under the threshold (not once oversight is conceded), three major
    // incidents, or consolidation refused with relations under 40.
    if (s.flags['refusedConsolidation'] === true && s.govRelations < 40 && s.flags['consolidationOrderUsed'] !== true) return 'consolidation';
    if (s.govRelations < orderThreshold(s) && s.flags['conceded'] !== true) return 'relations';
    if ((s.majorIncidents ?? 0) >= 3) return 'incidents';
    return '';
  }
  if (s.stage !== 3 || bestCapability(s) < 10) return '';
  if (s.flags['leaked'] === true && s.flags['memo'] === 'leaked' && s.govRelations < 50 && s.flags['leakOrderUsed'] !== true) return 'leak';
  const shownAt = s.flags['incidentsShownAt'];
  if (typeof shownAt !== 'number' || s.stats.timePlayed - shownAt < 300) return '';
  // Once oversight has been conceded the government holds the kill switch and signs off every run:
  // only three more major incidents (or the leak) bring a second order, not relations alone.
  if (s.govRelations < orderThreshold(s) && s.flags['conceded'] !== true) return 'relations';
  if ((s.majorIncidents ?? 0) >= 3) return 'incidents';
  return '';
}

/** Orders drafted so far (the first may be conceded, the second bought off; the third can only be refused). */
export function ordersDrafted(s: GameState): number {
  return counter(s, 'orders');
}

/** The order's countdown after a refusal (0 when none is running). */
export function orderLeft(s: GameState): number {
  return counter(s, 'orderLeft');
}

/** `The Committee drafts an order — 1:30.` */
export function orderLine(s: GameState): string {
  const left = orderLeft(s);
  return left > 0 ? `The Committee drafts an order — ${fmtClock(Math.ceil(left))}` : '';
}

/** The order condition still holds (for the 1:30 after a refusal). */
export function orderStands(s: GameState): boolean {
  if ((s.majorIncidents ?? 0) >= 3) return true;
  if (s.stage === 4 && s.flags['refusedConsolidation'] === true && s.govRelations < 40) return true;
  return s.govRelations < orderThreshold(s) && s.flags['conceded'] !== true;
}

/** The session is open (the Committee waits for a 25× model and a motion). */
export function inSession(s: GameState): boolean {
  return typeof s.flags['sessionAt'] === 'number';
}

export function sessionAge(s: GameState): number {
  return inSession(s) ? s.stats.timePlayed - (s.flags['sessionAt'] as number) : -1;
}

/** A model has passed 25× and the session is two minutes old: the goals say `(ready)`. */
export function voteReady(s: GameState): boolean {
  return s.stage === 3 && inSession(s) && bestCapability(s) >= VOTE_CAP - 1e-9 && sessionAge(s) >= SESSION_READY_AT;
}

/** The Pause can be signed: the memo reported, six seats, a lead of a month (arc §4, as amended). */
export function pauseEligible(s: GameState): boolean {
  return s.flags['memo'] === 'reported' && seats(s) >= 6 && s.lead >= 1;
}

/** The leak's odds, in percent: `40 + 10 × whistleblowRisk`, at most 90. */
export function leakPercent(s: GameState): number {
  return Math.min(90, 40 + 10 * counter(s, 'whistleblowRisk'));
}

/** Rolls for the buried memo's leak, once (§5.2). */
export function rollLeak(s: GameState): void {
  if (s.flags['memo'] !== 'buried' || s.flags['leakRolled'] === true) return;
  s.flags['leakRolled'] = true;
  if (rng(s) * 100 < leakPercent(s)) fireCrisis(s, 'cr_leak');
  else logNews(s, 'The memo stays in its drawer. Three people know where the drawer is.');
}

/**
 * Once a second in Stage 3: the incidents counter; the order (drafted, or counting down after a
 * refusal); the session and its beats; the leak's roll; the reminders that the Committee waits.
 */
export function updateOversight(s: GameState): void {
  if (s.stage !== 3 && s.stage !== 4) return;
  const now = s.stats.timePlayed;
  const best = bestCapability(s);
  if (s.stage === 4) {
    updateOrder(s);
    return;
  }
  if (committeeSeated(s) && !s.revealed['incidents'] && best >= 9) {
    s.revealed['incidents'] = true;
    s.flags['incidentsShownAt'] = now;
    say(s, 'The Committee has started counting incidents. Three, and it drafts an order.');
  }

  updateOrder(s);
  updateSession(s, now, best);
}

/** The order (Stages 3 and 4): drafted when its cause stands; its 1:30 after a refusal. */
function updateOrder(s: GameState): void {
  if (orderLeft(s) > 0) {
    s.flags['orderLeft'] = Math.max(0, orderLeft(s) - 1);
    if (orderLeft(s) <= 0) {
      s.revealed['order'] = false;
      if (orderStands(s)) {
        fireCrisis(s, 'cr_nationalization');
      } else {
        say(s, 'The order lapses. Relations held and the count is under three.');
        logNews(s, 'The Oversight Committee shelves its order. For now.');
      }
    }
  } else if (!s.activeChoice || s.activeChoice.id !== 'c_order') {
    const cause = orderCause(s);
    const queued = s.choiceQueue.some((c) => c.id === 'c_order');
    if (cause && !queued) {
      if (cause === 'leak') s.flags['leakOrderUsed'] = true;
      if (cause === 'consolidation') s.flags['consolidationOrderUsed'] = true;
      s.flags['orders'] = ordersDrafted(s) + 1;
      openChoice(s, 'c_order', { cause, threshold: orderThreshold(s), gov: Math.round(s.govRelations) });
    }
  }
}

/** Stage 3's session, the leak and their reminders. */
function updateSession(s: GameState, now: number, best: number): void {
  // The leak: at the later of October 2027 and 180 s after burying, or 30 s into the session.
  if (s.flags['memo'] === 'buried' && s.flags['leakRolled'] !== true) {
    const buriedAt = counter(s, 'memoAt');
    const due = (at2027(s, 10) && now - buriedAt >= 180) || (inSession(s) && sessionAge(s) >= SESSION_LEAK_AT);
    if (due) rollLeak(s);
  }

  // The session opens at 21× once the memo has been answered (§7.1; see SESSION_CAP).
  const memoAnswered = s.flags['memo'] === 'reported' || s.flags['memo'] === 'buried' || s.flags['memo'] === 'leaked';
  if (!inSession(s) && best >= SESSION_CAP && memoAnswered && committeeSeated(s)) {
    s.flags['sessionAt'] = now;
    s.revealed['session'] = true;
    say(s, 'The Committee is in session. It votes when a model passes 25×.');
    fireDevelopmentOnce(s, 'd_convenes');
  }
  if (inSession(s)) {
    const age = sessionAge(s);
    if (age >= SESSION_HALT_AT && !s.developments['d_halt_offer']) fireDevelopmentOnce(s, 'd_halt_offer');
    if (age >= SESSION_HOLD_AT && !s.revealed['holdRuns']) {
      s.revealed['holdRuns'] = true;
      say(s, 'The alignment team asks for a button that stops the next run. Here it is.');
    }
    if (voteReady(s)) {
      if (!s.flags['readySaid']) {
        s.flags['readySaid'] = true;
        s.flags['waitingSaidAt'] = now;
        say(s, 'A model has passed 25×. The Committee will hear a motion.');
      } else if (now - counter(s, 'waitingSaidAt') >= 90 && !(s.activeChoice && s.activeChoice.id === 'c_vote')) {
        s.flags['waitingSaidAt'] = now;
        say(s, 'The Committee is waiting for a motion.');
      }
    }
  }
}

/** The memo's line on the Oversight panel: `Memo: reported` / `Memo: buried — leak risk 50%`. */
export function memoLine(s: GameState): string {
  const m = s.flags['memo'];
  if (m === 'reported') return 'Memo: reported';
  if (m === 'leaked') return 'Memo: leaked';
  if (m === 'buried') return s.flags['leakRolled'] === true ? 'Memo: buried' : `Memo: buried — leak risk ${leakPercent(s)}%`;
  return '';
}

/** The session line: `In session — votes when a model passes 25×` / `In session — waiting for a motion`. */
export function sessionLine(s: GameState): string {
  if (!inSession(s)) return '';
  return voteReady(s) ? 'In session — waiting for a motion' : 'In session — votes when a model passes 25×';
}

/** The best reading the lab has of the hidden number, in words, for the vote's text. */
export function bestReading(s: GameState): string {
  if (s.interpretability >= 3) return `alignment read from the weights: ${Math.round(s.alignmentTrue)}`;
  if (isBought(s, 'p_lie_test')) return `checkpoints, asked separately: alignment about ${Math.round(s.alignmentTrue / 10) * 10}`;
  if (isBought(s, 'p_successor')) return s.alignmentTrue >= 60 ? 'its successor is aligned to the Spec' : 'its successor is aligned to Sage-4';
  if (isBought(s, 'p_noise')) return s.alignmentTrue < 50 ? 'it holds back on alignment tasks' : 'it was not holding back';
  if (isBought(s, 'p_honeypots')) return s.alignmentTrue >= 55 ? 'a honeypot found nothing' : 'it behaves differently unwatched';
  return 'nothing it can measure';
}
