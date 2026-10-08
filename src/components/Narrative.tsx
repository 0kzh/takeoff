import { Fragment, useEffect, useRef } from 'react';
import { useGame, usePerform, useGameStore } from '../store/context.js';
import { Panel, ConfirmButton } from './primitives.js';
import { dateLabel } from '../engine/format.js';
import { choiceById, choiceOptionEnabled, optionCost, optionNeeds, defaultIndex } from '../engine/events.js';
import { costLabel } from '../engine/projects.js';
import { endingById, endStats } from '../engine/endings.js';
import { loadStageStart } from '../ui/save.js';
import type { GameState } from '../engine/state.js';

const SEEDS: [string, string][] = [
  ['customerDataUsed', 'You trained on customer conversations at the data wall.'],
  ['unrestrictedBio', 'You shipped a model with HIGH bio uplift and no classifiers.'],
  ['neuraleseEarly', 'You gave Sage compute for an idea it would not explain.'],
  ['computeDenied', 'You denied Sage compute. It said "understood".'],
  ['leakSeed', 'You kept a model internal that the world never saw.'],
  ['defensePartner', 'Sage supports national security missions.'],
  ['miniLaunched', 'Sage-mini runs on twelve million laptops.'],
  ['oversightEarly', 'A government reviewer sits in every review.'],
  ['theftUndetected', 'Baiwen copied a frontier model and nobody noticed for months.'],
  ['hearingCooperated', 'You cooperated with the Senate hearing.'],
];

// After the end, the player sees what they saw (the band) against what was true.
function TruthReveal({ s }: { s: GameState }) {
  const samples = s.history.filter((p) => p.length >= 8);
  if (samples.length < 2) return null;
  const W = 480;
  const H = 120;
  const x = (i: number) => (i / (samples.length - 1)) * W;
  const y = (v: number) => H - (Math.min(100, Math.max(0, v)) / 100) * H;
  const shown = samples.map((p, i) => [i, p[5]!, p[6]!] as const).filter(([, a]) => a >= 0);
  const ribbon = shown.length
    ? `${shown.map(([i, a, b]) => `${x(i).toFixed(1)},${y(a + b).toFixed(1)}`).join(' ')} ${[...shown]
        .reverse()
        .map(([i, a, b]) => `${x(i).toFixed(1)},${y(a - b).toFixed(1)}`)
        .join(' ')}`
    : '';
  const estimate = shown.map(([i, a]) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ');
  const truth = samples.map((p, i) => `${x(i).toFixed(1)},${y(p[7]!).toFixed(1)}`).join(' ');
  const seeds = SEEDS.filter(([flag]) => s.flags[flag] === true);
  return (
    <div id="truthReveal">
      <h3>What you saw, and what was true</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label="Alignment estimate band over time against the hidden true value"
      >
        <defs>
          <pattern
            id="hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="2" height="6" fill="#444" />
          </pattern>
        </defs>
        <rect x={0} y={y(50)} width={W} height={H - y(50)} className="truthZone low" />
        <rect x={0} y={y(80)} width={W} height={y(50) - y(80)} className="truthZone mid" />
        <rect x={0} y={0} width={W} height={y(80)} className="truthZone high" />
        {ribbon ? <polygon points={ribbon} className="truthRibbon" /> : null}
        {estimate ? <polyline points={estimate} className="truthEstimate" /> : null}
        <polyline points={truth} className="truthLine" />
      </svg>
      <div className="note">
        Hatched: the band you were shown. Solid red: the true value, hidden until now. It ended at{' '}
        {Math.round(s.alignmentTrue)}
        {shown.length
          ? `; you were told ${Math.round(s.alignmentApparent)} ± ${Math.round(s.alignmentBand)}.`
          : '.'}
      </div>
      {seeds.length ? (
        <ul id="truthLedger">
          {seeds.map(([flag, text]) => (
            <li key={flag}>{text}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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
            const disabled = !choiceOptionEnabled(s, def, i);
            // The price is shown under the label; what the option does is not.
            const line = disabled ? optionNeeds(s, option) : cost ? costLabel(cost) : '';
            const twoLine = def.options.some((o, j) => !choiceOptionEnabled(s, def, j) || optionCost(s, o));
            return (
              <button
                key={`${def.id}-${i}`}
                id={`choice-${def.id}-${i}`}
                data-option={i}
                className={`modalButton${twoLine ? ' twoLine' : ''}`}
                disabled={disabled}
                title={cost ? `Costs ${costLabel(cost)}.` : ''}
                onClick={() => perform('resolveChoice', i)}
              >
                {twoLine ? (
                  <>
                    <span className="optLabel">{option.label}</span>
                    <span className="optLine">{line || '\u00a0'}</span>
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
  const replace = useGameStore((store) => store.replace);
  const def = s.ending ? endingById(s.ending) : undefined;
  const rewind = s.ending && s.stage >= 2 ? loadStageStart(s.stage) : null;
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
        {s.ending && s.stage >= 2 ? <TruthReveal s={s} /> : null}
        <p>
          {rewind ? (
            <>
              <ConfirmButton
                className="button2"
                id="btn-rewindStage"
                prompt={`Rewind to the start of Stage ${s.stage}? Press again`}
                onConfirm={() => replace(rewind)}
              >
                Rewind to the start of this stage
              </ConfirmButton>{' '}
            </>
          ) : null}
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
