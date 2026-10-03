import type { GameState } from '../engine/state.js';
import { byId, make } from './dom.js';

let lastKey = '';

/** ADR notification column: newest entry on top, fading out at the bottom. */
export function renderLog(s: GameState): void {
  const last = s.log[s.log.length - 1];
  const key = `${s.log.length}|${last?.date ?? ''}|${last?.text ?? ''}`;
  if (key === lastKey) return;
  lastKey = key;
  const list = byId('logList');
  list.replaceChildren();
  for (let i = s.log.length - 1; i >= 0; i--) {
    const entry = s.log[i]!;
    const div = make('div', { class: `logEntry ${entry.kind}`, 'data-index': String(i) });
    div.append(make('span', { class: 'logDate' }, entry.date), ` — ${entry.text}`);
    list.append(div);
  }
}

export function resetLogCache(): void {
  lastKey = '';
}
