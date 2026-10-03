import type { GameState } from '../engine/state.js';
import { byId, make } from './dom.js';

/** Entries drawn in the column; older ones have faded out of view anyway (ADR). */
export const LOG_SHOWN = 8;

let lastKey = '';
let lastLength = -1;

/**
 * ADR notification column, newest on top, fading out at the bottom. Entries are grouped under a
 * month heading (`Sep 2025`) instead of repeating the date on every line; each is still stored as
 * `Mon YYYY — text`. Lines that arrived since the last draw fade in.
 */
export function renderLog(s: GameState): void {
  const last = s.log[s.log.length - 1];
  const key = `${s.log.length}|${last?.date ?? ''}|${last?.text ?? ''}`;
  if (key === lastKey) return;
  lastKey = key;
  const freshFrom = lastLength < 0 || lastLength > s.log.length ? s.log.length : lastLength;
  lastLength = s.log.length;
  const list = byId('logList');
  list.replaceChildren();
  let month = '';
  const first = Math.max(0, s.log.length - LOG_SHOWN);
  const oldMonths = new Set(s.log.slice(first, freshFrom).map((e) => e.date));
  for (let i = s.log.length - 1; i >= first; i--) {
    const entry = s.log[i]!;
    const fresh = i >= freshFrom ? ' fresh' : '';
    if (entry.date !== month) {
      month = entry.date;
      list.append(make('div', { class: `logMonth${oldMonths.has(month) ? '' : fresh}` }, month));
    }
    const div = make('div', { class: `logEntry ${entry.kind}${fresh}`, 'data-index': String(i), 'data-date': entry.date });
    div.textContent = entry.text;
    list.append(div);
  }
}

export function resetLogCache(): void {
  lastKey = '';
  lastLength = -1;
}
