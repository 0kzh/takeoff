import { trainCost } from '../engine/training.js';
import { useEffect, useRef, useState } from 'react';
import { useGame, useGameStore, useGameStoreApi, usePerform } from '../store/context.js';
import { ConfirmButton } from './primitives.js';
import { PRESETS, STAGE2_CHECKPOINTS, stage2Checkpoint } from '../data/presets.js';
import { gameFromPreset } from '../store/presets.js';
import { researchCap, batchSize } from '../engine/economy.js';
import { fireableEvents, pendingDevelopments } from '../engine/events.js';
import { dateLabel, fmtDuration, fmtNum } from '../engine/format.js';
import { exportSave, importSave } from '../ui/save.js';
import { setMindPrefs } from '../ui/mindPrefs.js';

const EVENTS = fireableEvents();
export function DevPanel({ seed }: { seed: number }) {
  const store = useGameStoreApi();
  const s = useGame();
  const perform = usePerform();
  const speed = useGameStore((state) => state.speed);
  const autoplay = useGameStore((state) => state.autoplay);
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('dev') === '1');
  const [showHidden, setShowHidden] = useState(false);
  const [event, setEvent] = useState(EVENTS[0]?.id ?? '');
  const [text, setText] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === '`' &&
        !(
          event.target instanceof HTMLElement &&
          (event.target.matches('input, textarea, select') || event.target.isContentEditable)
        )
      )
        setOpen((value) => !value);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const grant = (what: string) =>
    store.getState().update((game) => {
      switch (what) {
        case 'funds':
          game.funds = Math.round((game.funds + Math.max(1000, game.funds)) * 100) / 100;
          break;
        case 'research':
          game.revealed['research'] = true;
          game.research = Math.max(game.research, researchCap(game), trainCost(game).research ?? 0);
          break;
        case 'insight':
          game.insightUnlocked = true;
          game.revealed['insight'] = true;
          game.insight += 50;
          break;
        case 'compute':
          if (game.stage < 2) game.gpus += 10;
          else {
            game.gpus += batchSize(game);
            if (game.gpus > game.datacenters * 10000 * Math.pow(10, game.dcTier - 1)) game.datacenters += 1;
            if (game.gridCapacity < game.gpus) game.gridCapacity *= 10;
          }
          break;
        case 'power':
          game.power += 10 * game.gridCapacity;
          break;
        case 'trust':
          game.trust += 5;
          break;
        case 'data':
          game.data.stock += 50;
          break;
        case 'approval':
          game.approval = Math.min(100, game.approval + 10);
          break;
      }
    });
  return (
    <div id="dev" data-panel="dev" className={open ? 'open' : ''}>
      <b>dev</b>
      <div className="devRow">
        Stage{' '}
        {PRESETS.map((preset) => (
          <button
            key={preset.stage}
            id={`dev-stage-${preset.stage}`}
            onClick={() => store.getState().replace(gameFromPreset(preset.stage, seed))}
          >
            {preset.stage}
          </button>
        ))}
      </div>
      <div className="devRow">
        Speed{' '}
        {[1, 5, 20].map((value) => (
          <button
            key={value}
            id={`dev-speed-${value}`}
            className={value === speed ? 'devActive' : ''}
            onClick={() => store.getState().setSpeed(value)}
          >
            ×{value}
          </button>
        ))}{' '}
        <button
          id="dev-autoplay"
          className={autoplay ? 'devActive' : ''}
          onClick={() => store.getState().setAutoplay(!autoplay)}
        >
          Autoplay
        </button>
      </div>
      <div className="devRow">
        S2{' '}
        {STAGE2_CHECKPOINTS.map((cp) => (
          <button
            key={cp.id}
            id={`dev-s2-${cp.id}`}
            title={cp.title}
            onClick={() => store.getState().replace(stage2Checkpoint(cp.id, seed))}
          >
            {cp.label}
          </button>
        ))}
      </div>
      <div className="devRow">
        <button id="dev-mind-signal" onClick={() => perform('devMindSignal')}>
          +Signal
        </button>{' '}
        <button
          id="dev-mind-signals"
          onClick={() => {
            for (let i = 0; i < 5; i++) perform('devMindSignal');
          }}
        >
          +5 signals
        </button>{' '}
        <button
          id="dev-mind-open"
          onClick={() => {
            if (!store.getState().game.revealed['mind']) perform('devMindSignal');
            setMindPrefs({ tab: 'mind' });
          }}
        >
          Open Mind
        </button>
      </div>
      <div className="devRow">
        {['funds', 'research', 'insight', 'compute', 'power', 'trust', 'data', 'approval'].map((what) => (
          <button key={what} id={`dev-${what}`} onClick={() => grant(what)}>
            +{what === 'funds' ? '$' : what[0].toUpperCase() + what.slice(1)}
          </button>
        ))}
      </div>
      <div className="devRow">
        <button id="dev-finish" onClick={() => perform('finishTraining')}>
          Finish training
        </button>{' '}
        <select
          id="dev-event-select"
          aria-label="Event"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        >
          {EVENTS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button id="dev-fire" onClick={() => perform('fireEvent', event)}>
          Fire event ▾
        </button>
      </div>
      <div className="devRow">
        End{' '}
        {['concord', 'silence', 'pause', 'project', 'secondPlace', 'shutdown'].map((id) => (
          <button key={id} id={`dev-end-${id}`} onClick={() => perform('forceEnding', id)}>
            {id}
          </button>
        ))}
      </div>
      <div className="devRow">
        <button id="dev-show-hidden" onClick={() => setShowHidden((value) => !value)}>
          Show hidden
        </button>
        <button
          id="dev-export"
          onClick={() => {
            setText(exportSave(store.getState().game));
            requestAnimationFrame(() => textarea.current?.select());
          }}
        >
          Export
        </button>
        <button
          id="dev-import"
          onClick={() => {
            const next = importSave(text);
            if (next) store.getState().replace(next);
            else setText('Import failed: not a Takeoff save.');
          }}
        >
          Import
        </button>
        <ConfirmButton
          id="dev-reset"
          prompt="Delete the save? Press again"
          onConfirm={() => store.getState().reset()}
        >
          Reset
        </ConfirmButton>
      </div>
      <textarea
        ref={textarea}
        id="dev-save-text"
        aria-label="Save data"
        placeholder="base64 save"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div id="devHidden" style={{ display: showHidden ? 'block' : 'none' }}>
        {showHidden
          ? [
              `approval ${fmtNum(s.approval, 1)} · gov ${fmtNum(s.govRelations, 1)} · lead ${fmtNum(s.lead, 2)}`,
              `alignment apparent ${fmtNum(s.alignmentApparent, 1)} · true ${fmtNum(s.alignmentTrue, 1)} · band ${fmtNum(s.alignmentBand, 0)} · bias ${fmtNum(s.deceptionBias, 0)}`,
              `tempo ${fmtNum(s.tempo, 0)} · baiwen ${s.baiwen.present ? fmtNum(s.baiwen.capability, 2) : 'absent'} · security SL${s.security} · data ${fmtNum(s.data.stock + s.data.synthetic, 1)}T · chip G${3 + s.chipGen} · tier ${s.dcTier}`,
              `idle rescues ${s.stats.idleRescues} · quiet ${fmtNum(s.idle.quiet, 0)} s`,
              `time in stage ${fmtDuration(s.stats.timeInStage)} · played ${fmtDuration(s.stats.timePlayed)}`,
              `rival ${fmtNum(s.rivalCapability, 2)}× next in ${fmtNum(s.nextRivalIn, 0)} s`,
              `next developments: ${
                pendingDevelopments(s)
                  .slice(0, 3)
                  .map((d) => `${d.id}${d.month !== undefined ? ` @${dateLabel(d.month)}` : ''}`)
                  .join(', ') || 'none'
              }`,
            ].join('\n')
          : null}
      </div>
    </div>
  );
}
