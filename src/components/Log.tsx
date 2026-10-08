import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from '../engine/state.js';
import { dateLabel } from '../engine/format.js';
import { useGame, useGameStore, getGame } from '../store/gameStore.js';
import { Panel } from './primitives.js';

const MONTH_NAMES: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

export const LOG_SHOWN = 5;

const logKey = (s: GameState) => {
  const last = s.log[s.log.length - 1];
  return `${s.log.length}|${last?.date ?? ''}|${last?.text ?? ''}`;
};

export function Log() {
  const key = useGame(logKey);
  const epoch = useGameStore((st) => st.epoch);
  const seen = useRef({ epoch, length: -1 });
  const s = getGame();
  const { log } = s;

  const before = seen.current.epoch === epoch ? seen.current.length : -1;
  const freshFrom = before < 0 || before > log.length ? log.length : before;
  useEffect(() => {
    seen.current = { epoch, length: log.length };
  }, [key, epoch, log.length]);

  const currentYear = dateLabel(s.date).slice(-4);
  const first = Math.max(0, log.length - LOG_SHOWN);
  const oldMonths = new Set(log.slice(first, freshFrom).map((e) => e.date));
  const rows: ReactNode[] = [];
  let month = '';
  for (let i = log.length - 1; i >= first; i--) {
    const entry = log[i]!;
    const fresh = i >= freshFrom ? ' fresh' : '';
    if (entry.date !== month) {
      month = entry.date;
      const heading = month.endsWith(currentYear) ? MONTH_NAMES[month.slice(0, 3)] ?? month : month;
      rows.push(<div key={`month-${month}`} className={`logMonth${oldMonths.has(month) ? '' : fresh}`}>{heading}</div>);
    }
    rows.push(
      <div key={i} className={`logEntry ${entry.kind}${fresh}`} data-index={i} data-date={entry.date}>{entry.text}</div>,
    );
  }

  return (
    <Panel name="log">
      <b>Developments</b>
      <hr />
      <div id="logList">{rows}</div>
    </Panel>
  );
}
