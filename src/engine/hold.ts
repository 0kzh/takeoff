import { GameState, say, heldForPlayer } from './state.js';
import { fmtClock, fmtInt } from './format.js';
import { choiceById } from './events.js';
import { canApprove } from './training.js';

/**
 * The idle hold (critic S3 round 1 §9 item 7, the minimal safe answer before the design one): while an
 * untimed event or a run's sign-off has waited on the player for more than two minutes, the Committee's
 * count and the incident clocks hold (scheduled incidents, riots and sabotage, breakouts, the calendar's
 * crises, the order). When the wait ends, a line says what was held and for how long. DOM-free.
 */

export const HOLD_AFTER_SECONDS = 120;

/** What is waiting on the player now ('' when nothing): an event with no timer, or a run's sign-off. */
export function waitingOnPlayer(s: GameState): string {
  // Stage 5 has nothing to hold: Final instructions waits for as long as it likes.
  if (s.stage < 3 || s.stage >= 5 || s.ending) return '';
  const c = s.activeChoice;
  if (c) {
    const def = choiceById(c.id);
    if (def && !def.timer) return def.title;
  }
  if (s.stage === 3 && canApprove(s)) return `${s.training.run?.name ?? 'the run'}'s sign-off`;
  return '';
}

/** Once a second: how long the player has been waited on; the hold starts after two minutes. */
export function updateHold(s: GameState): void {
  const what = waitingOnPlayer(s);
  const now = s.stats.timePlayed;
  if (what) {
    if (typeof s.flags['waitSince'] !== 'number' || s.flags['waitWhat'] !== what) {
      endHold(s, now);
      s.flags['waitSince'] = now;
      s.flags['waitWhat'] = what;
    }
    if (!heldForPlayer(s) && now - (s.flags['waitSince'] as number) >= HOLD_AFTER_SECONDS) {
      s.flags['held'] = true;
      s.flags['heldAt'] = now;
    }
    return;
  }
  endHold(s, now);
}

function endHold(s: GameState, now: number): void {
  if (heldForPlayer(s)) {
    const held = now - (typeof s.flags['heldAt'] === 'number' ? (s.flags['heldAt'] as number) : now);
    const count = s.revealed['incidents'] === true ? ` (${fmtInt(s.majorIncidents ?? 0)} of 3)` : '';
    say(s, `While ${String(s.flags['waitWhat'] ?? 'the event')} waited, the Committee's count${count} and the incident clocks held for ${fmtClock(held)}.`);
  }
  delete s.flags['held'];
  delete s.flags['heldAt'];
  delete s.flags['waitSince'];
  delete s.flags['waitWhat'];
}
