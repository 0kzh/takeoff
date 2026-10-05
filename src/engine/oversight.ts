import { GameState, say, logNews, counter, isBought, heldForPlayer } from './state.js';
import { rng } from './rng.js';
import { fmtClock, dateLabel } from './format.js';
import { bestCapability } from './economy.js';
import { seats, committeeSeated, at2027 } from './world3.js';
import { openChoice, fireDevelopmentOnce, fireCrisis } from './events.js';

export const MAJOR_SPACING = 240;
export const ORDER_SECONDS = 90;
export const VOTE_REST_SECONDS = 60;

export function voteRest(s: GameState): number {
  const at = s.flags['voteNotYetAt'];
  return typeof at === 'number' ? Math.max(0, VOTE_REST_SECONDS - (s.stats.timePlayed - at)) : 0;
}
export const SESSION_LEAK_AT = 30;
export const SESSION_HALT_AT = 45;
export const SESSION_HOLD_AT = 120;
export const SESSION_READY_AT = 120;
export const SESSION_CAP = 21;
export const VOTE_CAP = 25;

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

export function orderThreshold(s: GameState): number {
  let t = s.flags['defenseContract'] === true ? 35 : 20;
  if (s.securityLevel >= 5) t -= 10;
  if (s.flags['dpa'] === true) t += 10;
  if (s.flags['proofing'] === true) t -= 10;
  return t;
}

export function orderCause(s: GameState): '' | 'relations' | 'incidents' | 'leak' | 'consolidation' {
  if (s.stage === 4) {
    if (s.flags['refusedConsolidation'] === true && s.govRelations < 40 && s.flags['consolidationOrderUsed'] !== true) return 'consolidation';
    if (s.govRelations < orderThreshold(s) && s.flags['conceded'] !== true) return 'relations';
    if ((s.majorIncidents ?? 0) >= 3) return 'incidents';
    return '';
  }
  if (s.stage !== 3 || bestCapability(s) < 10) return '';
  if (s.flags['leaked'] === true && s.flags['memo'] === 'leaked' && s.govRelations < 50 && s.flags['leakOrderUsed'] !== true) return 'leak';
  const shownAt = s.flags['incidentsShownAt'];
  if (typeof shownAt !== 'number' || s.stats.timePlayed - shownAt < 300) return '';
  if (s.govRelations < orderThreshold(s) && s.flags['conceded'] !== true) return 'relations';
  if ((s.majorIncidents ?? 0) >= 3) return 'incidents';
  return '';
}

export function ordersDrafted(s: GameState): number {
  return counter(s, 'orders');
}

export function orderLeft(s: GameState): number {
  return counter(s, 'orderLeft');
}

export function orderLine(s: GameState): string {
  const left = orderLeft(s);
  return left > 0 ? `The Committee drafts an order — ${fmtClock(Math.ceil(left))}` : '';
}

export function orderStands(s: GameState): boolean {
  if ((s.majorIncidents ?? 0) >= 3) return true;
  if (s.stage === 4 && s.flags['refusedConsolidation'] === true && s.govRelations < 40) return true;
  return s.govRelations < orderThreshold(s) && s.flags['conceded'] !== true;
}

export function inSession(s: GameState): boolean {
  return typeof s.flags['sessionAt'] === 'number';
}

export function sessionAge(s: GameState): number {
  return inSession(s) ? s.stats.timePlayed - (s.flags['sessionAt'] as number) : -1;
}

export function voteReady(s: GameState): boolean {
  return s.stage === 3 && inSession(s) && bestCapability(s) >= VOTE_CAP - 1e-9 && sessionAge(s) >= SESSION_READY_AT;
}

export function pauseEligible(s: GameState): boolean {
  return s.flags['memo'] === 'reported' && seats(s) >= 6 && s.lead >= 1;
}

export function leakPercent(s: GameState): number {
  return Math.min(90, 40 + 10 * counter(s, 'whistleblowRisk'));
}

export function rollLeak(s: GameState): void {
  if (s.flags['memo'] !== 'buried' || s.flags['leakRolled'] === true) return;
  s.flags['leakRolled'] = true;
  if (rng(s) * 100 < leakPercent(s)) fireCrisis(s, 'cr_leak');
  else logNews(s, 'The memo stays in its drawer. Three people know where the drawer is.');
}

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

function updateOrder(s: GameState): void {
  if (heldForPlayer(s)) return;
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
      openChoice(s, 'c_order', { cause, threshold: orderThreshold(s), gov: Math.floor(s.govRelations) });
    }
  }
}

function updateSession(s: GameState, now: number, best: number): void {
  if (s.flags['memo'] === 'buried' && s.flags['leakRolled'] !== true) {
    const buriedAt = counter(s, 'memoAt');
    const due = (at2027(s, 10) && now - buriedAt >= 180) || (inSession(s) && sessionAge(s) >= SESSION_LEAK_AT);
    if (due) rollLeak(s);
  }

  const memoAnswered = s.flags['memo'] === 'reported' || s.flags['memo'] === 'buried' || s.flags['memo'] === 'leaked';
  if (!inSession(s) && best >= SESSION_CAP && memoAnswered && committeeSeated(s)) {
    s.flags['sessionAt'] = now;
    s.revealed['session'] = true;
    say(s, best >= VOTE_CAP - 1e-9 ? `The Committee is in session. It hears a motion in ${fmtClock(SESSION_READY_AT)}.` : 'The Committee is in session. It votes when a model passes 25×.');
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

export function memoLine(s: GameState): string {
  const m = s.flags['memo'];
  if (m === 'reported') return 'Memo: reported';
  if (m === 'leaked') return 'Memo: leaked';
  if (m === 'buried') return s.flags['leakRolled'] === true ? 'Memo: buried' : `Memo: buried — leak risk ${leakPercent(s)}%`;
  return '';
}

export function sessionLine(s: GameState): string {
  if (!inSession(s)) return '';
  if (voteReady(s)) return 'In session — waiting for a motion';
  if (bestCapability(s) >= VOTE_CAP - 1e-9) return `In session — hears a motion in ${fmtClock(Math.ceil(Math.max(0, SESSION_READY_AT - sessionAge(s))))}`;
  return 'In session — votes when a model passes 25×';
}

export function bestReading(s: GameState): string {
  if (s.interpretability >= 3) return `alignment read from the weights: ${Math.round(s.alignmentTrue)}`;
  const when = (key: string) => (typeof s.flags[`${key}At`] === 'number' ? ` (${dateLabel(s.flags[`${key}At`] as number)})` : '');
  if (isBought(s, 'p_lie_test')) return `checkpoints, asked separately: alignment about ${counter(s, 'lieReading')}${when('lie')}`;
  if (isBought(s, 'p_successor')) return `${s.flags['successor'] === 'spec' ? 'its successor is aligned to the Spec' : 'its successor is aligned to Sage-4'}${when('successor')}`;
  if (isBought(s, 'p_noise')) return `${s.flags['noise'] === 'holding' ? 'it holds back on alignment tasks' : 'it was not holding back'}${when('noise')}`;
  if (isBought(s, 'p_honeypots')) return `${s.flags['honeypot'] === 'clean' ? 'a honeypot found nothing' : 'it behaves differently unwatched'}${when('honeypot')}`;
  return 'nothing it can measure';
}
