import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useGameStoreApi, usePerform } from '../../store/context.js';
import { CIRCUITS, featureById, thoughtOf } from '../../data/mind.js';
import { decodeDifficulty, makePuzzle, puzzleSeed, type DecodePuzzle } from '../../engine/decode.js';
import { featureStatus } from '../../engine/mind.js';
import { interpretabilityPercent } from '../../engine/alignment.js';
import { Glyph } from './Glyph.js';
import { CIRCUIT_COLOR } from './theme.js';

interface GameProps {
  p: DecodePuzzle;
  done: boolean;
  onSolve: (mistakes: number) => void;
}

function Tile({
  g,
  cls,
  onDown,
  onEnter,
}: {
  g: number;
  cls: string;
  onDown?: () => void;
  onEnter?: () => void;
}) {
  return (
    <span className={`dTile ${cls}`} onPointerDown={onDown} onPointerEnter={onEnter}>
      <Glyph id={g} />
    </span>
  );
}

// Align: slide each sample until the lens holds the same chunk in every row.
// Must match .dTile, .dTrack, .dRow and .dLens in styles.css.
const TILE_GAP = 2;
const TILE = 24 + TILE_GAP;
const ROW_GAP = 4;
const ROW_PITCH = 26 + ROW_GAP;
const ROW_LABEL = 20 + 8;
const LENS_PAD = 3;
function Align({ p, done, onSolve }: GameProps) {
  const m = p.motif.length;
  const width = p.rows[0]!.length;
  const lens = Math.floor((width - m) / 2);
  const lo = lens + m - width;
  const lane = width + lens - lo;
  const [shift, setShift] = useState<number[]>(() => p.rows.map(() => 0));
  const [moves, setMoves] = useState(0);
  const [cursor, setCursor] = useState(0);
  const at = (r: number, c: number) => p.rows[r]![c - shift[r]!];
  const agree = Array.from({ length: m }, (_, k) => {
    const g = at(0, lens + k);
    return g !== undefined && p.rows.every((_, r) => at(r, lens + k) === g);
  });
  const solved = agree.every(Boolean);
  const par = p.rows.length + 1;
  useEffect(() => {
    if (solved && !done) onSolve(Math.max(0, moves - par));
  }, [solved, done, moves, par, onSolve]);
  const move = (r: number, next: number) => {
    if (done) return;
    const clamped = Math.max(lens + m - width, Math.min(lens, next));
    setShift((s) => s.map((v, i) => (i === r ? clamped : v)));
    setMoves((n) => n + 1);
    setCursor(r);
  };
  const moveRef = useRef({ move, shift, cursor });
  useEffect(() => {
    moveRef.current = { move, shift, cursor };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { move: mv, shift: sh, cursor: cur } = moveRef.current;
      if (e.key === 'ArrowUp') setCursor((c) => Math.max(0, c - 1));
      else if (e.key === 'ArrowDown') setCursor((c) => Math.min(p.rows.length - 1, c + 1));
      else if (e.key === 'ArrowLeft') mv(cur, sh[cur]! - 1);
      else if (e.key === 'ArrowRight') mv(cur, sh[cur]! + 1);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [p]);
  return (
    <>
      <div className="dAlign" style={{ width: lane * TILE + ROW_LABEL }}>
        <div
          className="dLens"
          style={{
            left: ROW_LABEL + (lens - lo) * TILE - LENS_PAD,
            width: m * TILE - TILE_GAP + 2 * LENS_PAD,
            height: p.rows.length * ROW_PITCH - ROW_GAP + 2 * LENS_PAD,
          }}
        >
          {agree.map((ok, k) => (
            <span key={k} className={`dLensCol${ok ? ' agree' : ''}`} />
          ))}
        </div>
        {p.rows.map((row, r) => (
          <div key={r} className={`dRow alignRow${cursor === r && !done ? ' cursor' : ''}`}>
            <span className="dRowLabel">{r + 1}</span>
            <span className="dWindow" style={{ width: lane * TILE }}>
              <span className="dTrack" style={{ transform: `translateX(${(shift[r]! - lo) * TILE}px)` }}>
                {row.map((g, i) => {
                  const inLens = i + shift[r]! >= lens && i + shift[r]! < lens + m;
                  return (
                    <Tile
                      key={i}
                      g={g}
                      cls={done && inLens ? 'hit' : inLens ? 'lensed' : ''}
                      onDown={() => move(r, lens - i)}
                    />
                  );
                })}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="dPrompt">
        Click a glyph to slide its sample into the lens.
        <br />
        Line up a chunk that every sample shares.
      </div>
      <div className="dFeedback">
        {!done && agree.some(Boolean) ? `${agree.filter(Boolean).length}/${m} columns agree` : ''}
      </div>
    </>
  );
}

function Runner({
  p,
  seconds,
  done,
  onSolve,
  onFail,
}: {
  p: DecodePuzzle;
  seconds: number;
  done: boolean;
  onSolve: (mistakes: number) => void;
  onFail: () => void;
}) {
  const deadline = useRef(0);
  const [left, setLeft] = useState(seconds);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });
  useEffect(() => {
    deadline.current = performance.now() + seconds * 1000;
  }, [seconds]);
  useEffect(() => {
    if (done) return;
    let id = 0;
    const frame = () => {
      const l = Math.max(0, (deadline.current - performance.now()) / 1000);
      setLeft(l);
      if (l <= 0) failRef.current();
      else id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [done]);
  const leftRef = useRef(left);
  useEffect(() => {
    leftRef.current = left;
  });
  const props: GameProps = {
    p,
    done,
    onSolve,
  };
  const frac = left / seconds;
  return (
    <>
      <div className="dTimer" aria-hidden="true">
        <span className={`dTimerFill${frac < 0.25 ? ' low' : ''}`} style={{ width: `${frac * 100}%` }} />
      </div>
      <div className="dGame">
        <Align {...props} />
      </div>
    </>
  );
}

// Matches the .thoughtCursor.blink period in styles.css.
const BLINK_MS = 530;
const CURSOR_MS = 3 * BLINK_MS;
const CHAR_MS = 32;
const ERASE_MS = 16;
const REWIRE_PAUSE_MS = 2 * BLINK_MS;
const REVEAL_HOLD_MS = 900;
// Console-style reveal: a blinking cursor, then the text types itself out.
function useTypewriter(text: string, enabled: boolean): [string, boolean, () => void] {
  const [count, setCount] = useState(enabled ? -1 : text.length);
  useEffect(() => {
    if (!enabled) return;
    let n = -1;
    let timer = window.setTimeout(function tick() {
      n += 1;
      setCount(n);
      if (n < text.length) timer = window.setTimeout(tick, CHAR_MS);
    }, CURSOR_MS);
    return () => window.clearTimeout(timer);
  }, [text, enabled]);
  const done = count >= text.length;
  return [text.slice(0, Math.max(0, count)), done, () => setCount(text.length)];
}

export function ThoughtResult({
  id,
  animate = false,
  onClose,
  interpGain = 0,
}: {
  id: string;
  animate?: boolean;
  onClose?: () => void;
  interpGain?: number;
}) {
  const s = useGame();
  const perform = usePerform();
  const api = useGameStoreApi();
  const [alignGain, setAlignGain] = useState(0);
  const def = featureById(id);
  const wiring = s.mind.features[id]?.wiring ?? '';
  const quote = def ? `“${wiring === 'rewired' ? def.rewiredThought : thoughtOf(def, s)}”` : '';
  const [firstQuote] = useState(() => quote);
  const [typed, done, skip] = useTypewriter(firstQuote, animate);
  const [rw, setRw] = useState<{ from: string; step: 'erase' | 'pause' | 'type'; n: number } | null>(null);
  const [popped, setPopped] = useState(false);
  useEffect(() => {
    if (!rw) return;
    const ms = rw.step === 'erase' ? ERASE_MS : rw.step === 'pause' ? REWIRE_PAUSE_MS : CHAR_MS;
    const t = window.setTimeout(() => {
      if (rw.step === 'erase') {
        if (rw.n > 0) setRw({ ...rw, n: rw.n - 1 });
        else setRw({ ...rw, step: 'pause' });
      } else if (rw.step === 'pause') setRw({ ...rw, step: 'type', n: 0 });
      else if (rw.n < quote.length) setRw({ ...rw, n: rw.n + 1 });
      else {
        setRw(null);
        setPopped(true);
      }
    }, ms);
    return () => window.clearTimeout(t);
  }, [rw, quote.length]);
  if (!def) return null;
  const benign = wiring === 'benign';
  const shown = rw
    ? rw.step === 'erase'
      ? rw.from.slice(0, rw.n)
      : rw.step === 'pause'
        ? ''
        : quote.slice(0, rw.n)
    : done
      ? quote
      : typed;
  const rewire = () => {
    const from = quote;
    const before = api.getState().game.alignmentTrue;
    perform('rewireFeature', id);
    setAlignGain(Math.round(api.getState().game.alignmentTrue - before));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPopped(true);
      return;
    }
    setRw({ from, step: 'erase', n: from.length });
  };
  return (
    <div className="thought">
      <div className="thoughtLabel">
        {wiring === 'rewired' && rw?.step !== 'erase' ? 'Thought Rewired' : 'Thought Decoded'}
      </div>
      <div
        className="thoughtQuote"
        onClick={
          rw
            ? () => {
                setRw(null);
                setPopped(true);
              }
            : done
              ? undefined
              : skip
        }
      >
        {shown}
        {!done || rw ? (
          <span className={`thoughtCursor${shown ? '' : ' blink'}`} aria-hidden>
            |
          </span>
        ) : null}
      </div>
      <div className={done ? (animate ? 'thoughtReveal' : '') : 'thoughtPending'} aria-hidden={!done}>
        <p className="thoughtMeaning">{benign ? def.benign : def.finding}</p>
        {benign ? (
          <p className="thoughtVerdict">
            <b>Benign:</b> This thought is not a cause for concern.
          </p>
        ) : wiring ? (
          <p className={`thoughtVerdict${rw ? ' thoughtPending' : popped ? ' pop' : ''}`}>
            <b>Rewired:</b> {def.rewired}
          </p>
        ) : (
          <button className="dButton primary" id="mind-rewire" disabled={!done} onClick={rewire}>
            Rewire
          </button>
        )}
        {onClose && wiring ? (
          <div className={`thoughtActions${rw ? ' thoughtPending' : popped ? ' pop' : ''}`}>
            <button className="dButton" onClick={onClose} autoFocus>
              Close
            </button>
            {alignGain > 0 ? (
              <span className="thoughtGain">
                <b>+{alignGain}</b> Alignment
              </span>
            ) : null}
            {interpGain > 0 ? (
              <span className="thoughtGain">
                <b>+{interpGain}%</b> Interpretability
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Phase = 'play' | 'solved' | 'failed';

export function DecodeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useGame();
  const api = useGameStoreApi();
  const perform = usePerform();
  const def = featureById(id)!;
  const circuit = CIRCUITS.find((c) => c.id === def.circuit)!;
  const color = CIRCUIT_COLOR[def.circuit];
  const status = featureStatus(s, id);
  const [phase, setPhase] = useState<Phase>(() =>
    featureStatus(api.getState().game, id) === 'decoded' ? 'solved' : 'play',
  );
  const [seed, setSeed] = useState(() => puzzleSeed(api.getState().game, id));
  const [flawless, setFlawless] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(phase === 'solved');
  const [interpGain, setInterpGain] = useState(0);
  const difficulty = useMemo(() => decodeDifficulty(def), [def]);
  const puzzle = useMemo(() => makePuzzle(seed, difficulty), [seed, difficulty]);
  const seconds = 40 + difficulty.rows * 10;

  useEffect(() => {
    const prev = api.getState().speed;
    api.getState().setSpeed(0);
    return () => api.getState().setSpeed(prev);
  }, [api]);

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (phaseRef.current === 'play') perform('failDecode', id);
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id, onClose, perform]);

  const onSolve = useMemo(
    () => (mistakes: number) => {
      if (phaseRef.current !== 'play') return;
      phaseRef.current = 'solved';
      const interpBefore = interpretabilityPercent(api.getState().game);
      perform('decodeFeature', id, mistakes);
      setInterpGain(interpretabilityPercent(api.getState().game) - interpBefore);
      setFlawless(mistakes === 0);
      setPhase('solved');
    },
    [id, perform, api],
  );
  const onFail = () => {
    if (phaseRef.current !== 'play') return;
    phaseRef.current = 'failed';
    perform('failDecode', id);
    setPhase('failed');
  };
  const retry = () => {
    setSeed(puzzleSeed(api.getState().game, id));
    setPhase('play');
  };
  useEffect(() => {
    if (phase !== 'solved' || revealed) return;
    const t = window.setTimeout(() => setRevealed(true), REVEAL_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, revealed]);
  const showPuzzle = phase !== 'failed' && !(phase === 'solved' && flawless === null);

  return (
    <div
      id="decodeOverlay"
      onPointerDown={(e) => e.target === e.currentTarget && phase !== 'play' && onClose()}
    >
      <div
        id="decodeModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decodeTitle"
        className={`phase-${phase}`}
        style={{ ['--c' as string]: color }}
      >
        <div className="dHead">
          <span className="dCircuit">{circuit.name}</span>
          <span className="dStatus">
            {phase === 'play'
              ? `decode · ${difficulty.rows} samples`
              : phase === 'failed'
                ? 'signal lost'
                : flawless
                  ? 'clean decode'
                  : 'decoded'}
          </span>
        </div>
        <div id="decodeTitle" className="dTitle">
          {def.name}
        </div>
        {phase === 'play' || showPuzzle ? (
          <Runner
            key={seed}
            p={puzzle}
            seconds={seconds}
            done={phase !== 'play'}
            onSolve={onSolve}
            onFail={onFail}
          />
        ) : null}
        {phase === 'failed' ? (
          <div className="dResult">
            <p>
              The activation faded before you found it. It is still there; another look will show different
              samples.
            </p>
            <button className="dButton primary" onClick={retry} autoFocus>
              Look again
            </button>
            <button className="dButton" onClick={onClose}>
              Later
            </button>
          </div>
        ) : null}
        {phase === 'solved' && status === 'decoded' && revealed ? (
          <div className={`dResult${flawless === null ? '' : ' enter'}`}>
            <ThoughtResult id={id} animate onClose={onClose} interpGain={interpGain} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
