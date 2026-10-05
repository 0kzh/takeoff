import { GameState, say, heldForPlayer } from './state.js';
import { fmtClock, fmtInt } from './format.js';
import { choiceById } from './events.js';
import { canApprove } from './training.js';

export const HOLD_AFTER_SECONDS = 120;

export function waitingOnPlayer(s: GameState): string {
  if (s.stage < 3 || s.stage >= 5 || s.ending) return '';
  const c = s.activeChoice;
  if (c) {
    const def = choiceById(c.id);
    if (def && !def.timer) return def.title;
  }
  if (s.stage === 3 && canApprove(s)) return `${s.training.run?.name ?? 'the run'}'s sign-off`;
  return '';
}

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
