import { Fragment, useEffect, useRef } from 'react';
import { useGame, usePerform, useGameStore } from '../store/context.js';
import { Panel, ConfirmButton } from './primitives.js';
import { dateLabel } from '../engine/format.js';
import {
  choiceById,
  choiceOptionEnabled,
  optionCost,
  optionTooltip,
  optionLine,
  optionNeeds,
  defaultIndex,
} from '../engine/events.js';
import { costLabel } from '../engine/projects.js';
import { endingById, endStats } from '../engine/endings.js';

const MONTHS: Record<string, string> = {
  Jan: 'January',
  Feb: 'February',
  Mar: 'March',
  Apr: 'April',
  May: 'May',
  Jun: 'June',
  Jul: 'July',
  Aug: 'August',
  Sep: 'September',
  Oct: 'October',
  Nov: 'November',
  Dec: 'December',
};
export function Console() {
  const lines = useGameStore((store) => store.game.console);
  const shown = useGameStore((store) => store.game.revealed['console']);
  const line = (n: number) => lines[lines.length - n] ?? '';
  return (
    <div id="consoleDiv" data-panel="console" data-reveal="console" className={shown ? 'shown' : ''}>
      <p className="consoleOld" id="consoleOld">
        {[5, 4, 3, 2].map((n) => (
          <Fragment key={n}>
            <span className="consoleLine">
              <span>&nbsp;.&nbsp;</span>
              <span id={`readout${n}`}>{line(n)}</span>
            </span>
            {n !== 2 ? <br /> : null}
          </Fragment>
        ))}
      </p>
      <p className="console">
        <span>&nbsp;&gt;&nbsp;</span>
        <span id="readout1">{line(1)}</span>
        <span id="cursor" className="pulsate">
          |
        </span>
      </p>
    </div>
  );
}
export function Developments() {
  const log = useGameStore((store) => store.game.log);
  const year = useGameStore((store) => dateLabel(store.game.date).slice(-4));
  const first = Math.max(0, log.length - 5);
  return (
    <Panel name="log" title="Developments">
      <div id="logList">
        {log
          .slice(first)
          .map((entry, offset) => {
            const index = first + offset;
            const heading = entry.date.endsWith(year)
              ? (MONTHS[entry.date.slice(0, 3)] ?? entry.date)
              : entry.date;
            return (
              <Fragment key={`${index}-${entry.date}-${entry.text}`}>
                {log[index + 1]?.date !== entry.date ? <div className="logMonth fresh">{heading}</div> : null}
                <div className={`logEntry ${entry.kind} fresh`} data-index={index} data-date={entry.date}>
                  {entry.text}
                </div>
              </Fragment>
            );
          })
          .reverse()}
      </div>
    </Panel>
  );
}
export function ChoiceDialog() {
  const s = useGame();
  const perform = usePerform();
  const ref = useRef<HTMLDivElement>(null);
  const active = s.activeChoice;
  const def = active ? choiceById(active.id) : undefined;
  const open = !!def && !s.ending;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const panel = ref.current;
    panel?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') perform('takeDefault');
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (
        (panel?.contains(document.activeElement) || document.activeElement === document.body) &&
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.matches(':disabled')
      )
        previous.focus({ preventScroll: true });
    };
  }, [open, perform]);
  const lines = def?.options.some((option) => option.line !== undefined);
  const fallback = def?.options[defaultIndex(def)];
  return (
    <div id="modalOverlay" data-panel="modal" className={open ? 'shown' : ''}>
      <div ref={ref} id="modal" role="dialog" aria-modal="false" aria-labelledby="modalTitle" tabIndex={-1}>
        <div id="modalTitle">{def?.title}</div>
        <div id="modalText">
          {def && active
            ? def.text(s, active.context).map((line, i) => <p key={`${active.id}-${i}`}>{line}</p>)
            : null}
        </div>
        <div id="modalTimer">
          {def?.timer && active && fallback
            ? `${Math.ceil(active.remaining)} s — then: ${fallback.label}`
            : ''}
        </div>
        <div id="modalButtons">
          {def?.options.map((option, i) => {
            const cost = optionCost(s, option);
            const tip = optionTooltip(s, option);
            const disabled = !choiceOptionEnabled(s, def, i);
            return (
              <button
                key={`${def.id}-${i}`}
                id={`choice-${def.id}-${i}`}
                data-option={i}
                className={`modalButton${lines ? ' twoLine' : ''}`}
                disabled={disabled}
                title={[tip, cost && !tip.startsWith('$') ? `Costs ${costLabel(cost)}.` : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => perform('resolveChoice', i)}
              >
                {lines ? (
                  <>
                    <span className="optLabel">{option.label}</span>
                    <span className="optLine">
                      {disabled ? optionNeeds(s, option) : optionLine(s, option)}
                    </span>
                  </>
                ) : (
                  option.label
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export function Ending() {
  const s = useGame();
  const reset = useGameStore((store) => store.reset);
  const def = s.ending ? endingById(s.ending) : undefined;
  return (
    <div id="endingScreen" data-panel="ending" className={s.ending ? 'shown' : ''}>
      <div id="endingBox">
        <h2 id="endingTitle">{def?.title ?? s.ending}</h2>
        <div id="endingText">{def?.epilogue}</div>
        <table id="endingStats">
          <tbody>
            {s.ending
              ? endStats(s).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{value}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        <p>
          <ConfirmButton
            className="button2"
            id="btn-newGame"
            prompt="Start again in July 2025? Press again"
            onConfirm={() => reset()}
          >
            New game
          </ConfirmButton>
        </p>
      </div>
    </div>
  );
}
