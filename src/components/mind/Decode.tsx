import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useGameStoreApi, usePerform } from '../../store/context.js';
import { CIRCUITS, featureById, thoughtOf } from '../../data/mind.js';
import {
  chunkIndex,
  decodeDifficulty,
  makePuzzle,
  puzzleSeed,
  type DecodePuzzle,
} from '../../engine/decode.js';
import { featureStatus } from '../../engine/mind.js';
import { useMindPrefs } from '../../ui/mindPrefs.js';
import { Glyph } from './Glyph.js';
import { CIRCUIT_COLOR } from './theme.js';

type Mark = { start: number; len: number; cls: string };
interface GameProps {
  p: DecodePuzzle;
  done: boolean;
  onSolve: (mistakes: number) => void;
  penalize: (seconds: number) => void;
  timeLeft: () => number;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

function occurrences(row: number[], chunk: number[]): number[] {
  const out: number[] = [];
  if (chunk.length === 0) return out;
  for (let i = 0; i + chunk.length <= row.length; i++)
    if (chunk.every((g, j) => row[i + j] === g)) out.push(i);
  return out;
}

function motifMarks(p: DecodePuzzle): Mark[][] {
  return p.starts.map((start) => [{ start, len: p.motif.length, cls: 'hit' }]);
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

function Rows({
  rows,
  marks,
  rowCls = [],
  onDown,
  onEnter,
}: {
  rows: number[][];
  marks: Mark[][];
  rowCls?: string[];
  onDown?: (r: number, i: number) => void;
  onEnter?: (r: number, i: number) => void;
}) {
  return (
    <div className="dRows">
      {rows.map((row, r) => (
        <div key={r} className={`dRow ${rowCls[r] ?? ''}`}>
          <span className="dRowLabel">{r + 1}</span>
          <span className="dStrip">
            {row.map((g, i) => {
              const m = (marks[r] ?? []).find((mk) => i >= mk.start && i < mk.start + mk.len);
              const edge = m
                ? `${i === m.start ? ' first' : ''}${i === m.start + m.len - 1 ? ' last' : ''}`
                : '';
              return (
                <Tile
                  key={i}
                  g={g}
                  cls={m ? `${m.cls}${edge}` : ''}
                  onDown={onDown ? () => onDown(r, i) : undefined}
                  onEnter={onEnter ? () => onEnter(r, i) : undefined}
                />
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let x = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// Spot: four candidate chunks, one is in every sample. A wrong pick shows the
// sample it was missing from, so every mistake teaches.
function Spot({ p, done, onSolve, penalize }: GameProps) {
  const candidates = useMemo(
    () =>
      shuffled(
        [p.motif, ...p.decoys],
        p.rows.flat().reduce((a, g) => a * 31 + g, 7),
      ),
    [p],
  );
  const [wrong, setWrong] = useState<number[]>([]);
  const [miss, setMiss] = useState<{ row: number; chunk: number[]; n: number } | null>(null);
  const choose = (i: number) => {
    const c = candidates[i];
    if (done || !c || wrong.includes(i)) return;
    if (same(c, p.motif)) return onSolve(wrong.length);
    setWrong((w) => [...w, i]);
    penalize(4);
    setMiss((m) => ({
      row: p.rows.findIndex((row) => chunkIndex(row, c) < 0),
      chunk: c,
      n: (m?.n ?? 0) + 1,
    }));
  };
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) chooseRef.current(n - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const marks = done
    ? motifMarks(p)
    : miss
      ? p.rows.map((row) =>
          occurrences(row, miss.chunk).map((start) => ({ start, len: miss.chunk.length, cls: 'ghost' })),
        )
      : [];
  return (
    <>
      <Rows
        rows={p.rows}
        marks={marks}
        rowCls={p.rows.map((_, r) => (!done && miss && miss.row === r ? `missing m${miss.n % 2}` : ''))}
      />
      <div className="dPrompt">Which chunk shows up in every sample?</div>
      <div className="dChoices">
        {candidates.map((c, i) => (
          <button
            key={i}
            className={`dChoice${wrong.includes(i) ? ' wrong' : ''}${done && same(c, p.motif) ? ' right' : ''}`}
            disabled={done || wrong.includes(i)}
            onClick={() => choose(i)}
            aria-label={`Candidate ${i + 1}`}
          >
            <span className="dKey">{i + 1}</span>
            {c.map((g, j) => (
              <Glyph key={j} id={g} />
            ))}
          </button>
        ))}
      </div>
      <div className="dFeedback" aria-live="polite">
        {!done && miss ? (miss.row >= 0 ? `Not in sample ${miss.row + 1}. −4 s` : 'No. −4 s') : ''}
      </div>
    </>
  );
}

// Align: slide each sample until the lens holds the same chunk in every row.
const TILE = 26;
function Align({ p, done, onSolve }: GameProps) {
  const m = p.motif.length;
  const width = p.rows[0]!.length;
  const lens = Math.floor((width - m) / 2);
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
      <div className="dAlign" style={{ width: width * TILE + 28 }}>
        <div className="dLens" style={{ left: 28 + lens * TILE, width: m * TILE }}>
          {agree.map((ok, k) => (
            <span key={k} className={`dLensCol${ok ? ' agree' : ''}`} style={{ width: TILE }} />
          ))}
        </div>
        {p.rows.map((row, r) => (
          <div key={r} className={`dRow alignRow${cursor === r && !done ? ' cursor' : ''}`}>
            <span className="dRowLabel">{r + 1}</span>
            <span className="dWindow" style={{ width: width * TILE }}>
              <span className="dTrack" style={{ transform: `translateX(${shift[r]! * TILE}px)` }}>
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
        Click a glyph to slide its sample into the lens. Line up a chunk that every sample shares.
      </div>
      <div className="dFeedback">
        moves {moves} · par {par}
        {!done && agree.some(Boolean) ? ` · ${agree.filter(Boolean).length}/${m} columns agree` : ''}
      </div>
    </>
  );
}

// Trace: drag across sample 1 and watch the selection light up wherever it
// recurs. Find a chunk of the right length that lights every sample.
function Trace({ p, done, onSolve, timeLeft }: GameProps) {
  const m = p.motif.length;
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const dragging = useRef(false);
  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);
  const lo = sel ? Math.min(sel.a, sel.b) : 0;
  const chunk = sel ? p.rows[0]!.slice(lo, Math.max(sel.a, sel.b) + 1) : [];
  const hits = p.rows.map((row) => occurrences(row, chunk));
  const count = hits.filter((h) => h.length > 0).length;
  const solved = chunk.length === m && count === p.rows.length;
  useEffect(() => {
    if (solved && !done) onSolve(timeLeft() >= 0.5 ? 0 : 1);
  }, [solved, done, onSolve, timeLeft]);
  const clamp = (a: number, b: number) => (Math.abs(b - a) >= m ? a + Math.sign(b - a) * (m - 1) : b);
  const marks: Mark[][] = done
    ? motifMarks(p)
    : hits.map((h, r) =>
        r === 0
          ? sel
            ? [{ start: lo, len: chunk.length, cls: 'picked' }]
            : []
          : h.map((start) => ({ start, len: chunk.length, cls: 'echo' })),
      );
  return (
    <>
      <Rows
        rows={p.rows}
        marks={marks}
        rowCls={p.rows.map((_, r) => (r === 0 ? 'source' : sel && hits[r]!.length ? 'lit' : ''))}
        onDown={(r, i) => {
          if (r !== 0 || done) return;
          dragging.current = true;
          setSel({ a: i, b: i });
        }}
        onEnter={(r, i) => {
          if (r !== 0 || !dragging.current || done) return;
          setSel((s) => (s ? { a: s.a, b: clamp(s.a, i) } : s));
        }}
      />
      <div className="dPrompt">
        Drag across sample 1. The signal is {m} glyphs long and lights up every sample.
      </div>
      <div className="dFeedback" aria-live="polite">
        {sel && !done
          ? `${chunk.length}/${m} long · in ${count} of ${p.rows.length} samples${
              count === p.rows.length && chunk.length < m ? ' · keep going' : ''
            }`
          : ''}
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
  const { decode } = useMindPrefs();
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
    penalize: (sec) => (deadline.current -= sec * 1000),
    timeLeft: () => leftRef.current / seconds,
  };
  const frac = left / seconds;
  return (
    <>
      <div className="dTimer" aria-hidden="true">
        <span className={`dTimerFill${frac < 0.25 ? ' low' : ''}`} style={{ width: `${frac * 100}%` }} />
      </div>
      <div className={`dGame variant-${decode}`}>
        {decode === 'align' ? (
          <Align {...props} />
        ) : decode === 'trace' ? (
          <Trace {...props} />
        ) : (
          <Spot {...props} />
        )}
      </div>
    </>
  );
}

const CURSOR_MS = 700;
const CHAR_MS = 32;
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

export function ThoughtResult({ id, animate = false }: { id: string; animate?: boolean }) {
  const s = useGame();
  const perform = usePerform();
  const def = featureById(id);
  const quote = def ? `“${thoughtOf(def, s)}”` : '';
  const [typed, done, skip] = useTypewriter(quote, animate);
  if (!def) return null;
  const wiring = s.mind.features[id]?.wiring ?? '';
  const benign = wiring === 'benign';
  return (
    <div className="thought">
      <div className="thoughtLabel">Thought Decoded</div>
      <div className="thoughtQuote" onClick={done ? undefined : skip}>
        {typed}
        {done ? null : (
          <span className="pulsate" aria-hidden>
            |
          </span>
        )}
      </div>
      <div className={done ? '' : 'thoughtPending'} aria-hidden={!done}>
        <p className="thoughtMeaning">{benign ? def.benign : def.finding}</p>
        {benign ? (
          <p className="thoughtVerdict">
            <b>Benign:</b> This thought is not a cause for concern.
          </p>
        ) : wiring ? (
          <p className="thoughtVerdict">
            <b>Rewired:</b> {def.rewired}
          </p>
        ) : (
          <button
            className="dButton primary"
            id="mind-rewire"
            disabled={!done}
            onClick={() => perform('rewireFeature', id)}
          >
            Rewire
          </button>
        )}
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
  const difficulty = useMemo(() => decodeDifficulty(def), [def]);
  const puzzle = useMemo(() => makePuzzle(seed, difficulty), [seed, difficulty]);
  const seconds = 20 + difficulty.rows * 6;
  const { decode } = useMindPrefs();

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
      perform('decodeFeature', id, mistakes);
      setFlawless(mistakes === 0);
      setPhase('solved');
    },
    [id, perform],
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
  const wired = s.mind.features[id]?.wiring ?? '';
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
            key={`${seed}-${decode}`}
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
        {phase === 'solved' && status === 'decoded' ? (
          <div className="dResult">
            <ThoughtResult id={id} animate />
            {wired ? (
              <button className="dButton" onClick={onClose} autoFocus>
                Close
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
