import { useEffect, useRef, useState } from 'react';
import { newGame } from '../engine/state.js';
import { fireableEvents } from '../engine/events.js';
import { PRESETS } from '../data/presets.js';
import { useGame, useGameStore, perform } from '../store/gameStore.js';
import { loadPreset, grant, hiddenReadout, Grant } from '../store/dev.js';
import { cx, useConfirm } from './primitives.js';

const SPEEDS = [1, 5, 20];
const GRANTS: [Grant, string][] = [
  ['funds', '+$'],
  ['research', '+Research'],
  ['insight', '+Insight'],
  ['compute', '+Compute'],
  ['power', '+Power'],
  ['trust', '+Trust'],
];
const ENDINGS = ['concord', 'silence', 'pause', 'project'];
const EVENTS = fireableEvents();

function HiddenReadout() {
  return <>{useGame(hiddenReadout)}</>;
}

export function DevPanel() {
  const speed = useGameStore((st) => st.speed);
  const autoplay = useGameStore((st) => st.autoplay);
  const { saver, load, setSpeed, setAutoplay } = useGameStore.getState();
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('dev') === '1');
  const [showHidden, setShowHidden] = useState(false);
  const [event, setEvent] = useState(EVENTS[0]?.id ?? '');
  const text = useRef<HTMLTextAreaElement>(null);
  const [resetArmed, pressReset] = useConfirm(() => {
    saver.clear();
    load(newGame(Date.now()));
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`' && !(e.target instanceof HTMLTextAreaElement)) setOpen((on) => !on);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div id="dev" data-panel="dev" className={cx(open && 'open')}>
      <b>dev</b>
      <div className="devRow">
        Stage{' '}
        {PRESETS.map((p) => (
          <button key={p.stage} id={`dev-stage-${p.stage}`} type="button" onClick={() => loadPreset(p.stage)}>{p.stage}</button>
        ))}
      </div>
      <div className="devRow">
        Speed{' '}
        {SPEEDS.map((n) => (
          <button key={n} id={`dev-speed-${n}`} type="button" className={cx(speed === n && 'devActive')} onClick={() => setSpeed(n)}>{`×${n}`}</button>
        ))}
        {' '}
        <button id="dev-autoplay" type="button" className={cx(autoplay && 'devActive')} onClick={() => setAutoplay(!autoplay)}>Autoplay</button>
      </div>
      <div className="devRow">
        {GRANTS.map(([what, label]) => (
          <button key={what} id={`dev-${what}`} type="button" onClick={() => grant(what)}>{label}</button>
        ))}
      </div>
      <div className="devRow">
        <button id="dev-finish" type="button" onClick={() => perform('finishTraining')}>Finish training</button>
        {' '}
        <select id="dev-event-select" value={event} onChange={(e) => setEvent(e.target.value)}>
          {EVENTS.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
        </select>
        <button id="dev-fire" type="button" onClick={() => perform('fireEvent', event)}>Fire event ▾</button>
      </div>
      <div className="devRow">
        End{' '}
        {ENDINGS.map((id) => (
          <button
            key={id}
            id={`dev-end-${id}`}
            type="button"
            onClick={() => {
              perform('forceEnding', id);
              saver.saveNow();
            }}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="devRow">
        <button id="dev-show-hidden" type="button" onClick={() => setShowHidden((on) => !on)}>Show hidden</button>
        <button
          id="dev-export"
          type="button"
          onClick={() => {
            if (!text.current) return;
            text.current.value = saver.exportString();
            text.current.select();
          }}
        >
          Export
        </button>
        <button
          id="dev-import"
          type="button"
          onClick={() => {
            if (!text.current) return;
            const next = saver.importString(text.current.value);
            if (next) load(next);
            else text.current.value = 'Import failed: not a Takeoff save.';
          }}
        >
          Import
        </button>
        <button id="dev-reset" type="button" onClick={pressReset}>{resetArmed ? 'Delete the save? Press again' : 'Reset'}</button>
      </div>
      <textarea id="dev-save-text" placeholder="base64 save" ref={text} />
      <div id="devHidden" style={{ display: showHidden ? 'block' : 'none' }}>{open && showHidden && <HiddenReadout />}</div>
    </div>
  );
}
