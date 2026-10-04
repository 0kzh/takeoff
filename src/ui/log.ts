import type { GameState } from '../engine/state.js';
import { byId, make } from './dom.js';
import { dateLabel } from '../engine/format.js';

const MONTH_NAMES: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

/** Entries drawn in the column; older ones have faded out of view anyway (ADR). Stage 2 on: four. */
export const LOG_SHOWN = 5;
const logShown = (s: GameState): number => (s.stage >= 2 ? 4 : LOG_SHOWN);

let lastKey = '';
let lastLength = -1;

/**
 * ADR notification column, newest on top, fading out at the bottom. Entries are grouped under a
 * month heading (`Sep 2025`) instead of repeating the date on every line; each is still stored as
 * `Mon YYYY — text`. Lines that arrived since the last draw fade in.
 */
export function renderLog(s: GameState): void {
  const last = s.log[s.log.length - 1];
  const key = `${s.log.length}|${last?.date ?? ''}|${last?.text ?? ''}|${logShown(s)}`;
  if (key === lastKey) return;
  lastKey = key;
  const freshFrom = lastLength < 0 || lastLength > s.log.length ? s.log.length : lastLength;
  lastLength = s.log.length;
  const list = byId('logList');
  list.replaceChildren();
  const currentYear = dateLabel(s.date).slice(-4);
  let month = '';
  const first = Math.max(0, s.log.length - logShown(s));
  const oldMonths = new Set(s.log.slice(first, freshFrom).map((e) => e.date));
  for (let i = s.log.length - 1; i >= first; i--) {
    const entry = s.log[i]!;
    const fresh = i >= freshFrom ? ' fresh' : '';
    if (entry.date !== month) {
      month = entry.date;
      // The header shows the year; a heading in the same year needs only the month.
      const heading = month.endsWith(currentYear) ? MONTH_NAMES[month.slice(0, 3)] ?? month : month;
      list.append(make('div', { class: `logMonth${oldMonths.has(month) ? '' : fresh}` }, heading));
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
