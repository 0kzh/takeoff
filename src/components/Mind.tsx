import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CIRCUITS, mindNode } from '../data/mind.js';
import { fmtInt, fmtNum } from '../engine/format.js';
import {
  atlasVisible,
  coreReady,
  intentLine,
  mindCounts,
  mindStatus,
  type MindTree,
} from '../engine/mind.js';
import { useGame, useGameStore, usePerform } from '../store/context.js';
import { MindDecode } from './MindDecode.js';
import { MindTreeView } from './MindTree.js';
import { Panel } from './primitives.js';

const BLURB: Record<MindTree, string> = {
  branches: 'A skill tree. Locked circuits are silhouettes. A lit one can be decoded.',
  plague: 'Names first, like a mutation tree. Select a circuit, then decode it.',
  atlas: 'Fog. A circuit appears only after the one before it has been rewired.',
};

export function Mind() {
  const s = useGame();
  const perform = usePerform();
  const tree = useGameStore((state) => state.mindTree);
  const decode = useGameStore((state) => state.mindDecode);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const counts = mindCounts(s);
  const puzzle = s.mind.active ? s.mind.puzzles[s.mind.active] : undefined;

  useEffect(() => {
    if (!open && !s.mind.active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || s.activeChoice) return;
      if (s.mind.active) {
        perform('closeMind');
        return;
      }
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, s.mind.active, s.activeChoice, perform]);

  useEffect(() => {
    if (!open && !s.mind.active) return;
    const id = s.mind.active ? 'mindDecode' : 'mindMap';
    document.getElementById(id)?.focus();
  }, [open, s.mind.active]);

  useEffect(() => {
    if (open) perform('acknowledgeMind');
  }, [open, counts.waiting, perform]);

  const openMap = () => setOpen(true);

  const pick = (id: string) => {
    setSelected(id);
    const status = mindStatus(s, id);
    if (status !== 'lit') return;
    if (tree === 'plague') return;
    perform('openMindNode', id);
  };

  return (
    <Panel name="mind" title="Mind">
      <div id="mindSummary">
        {counts.rewired === 0 && counts.lit === 0
          ? 'Four clusters in the activations, all of them dark.'
          : intentLine(s)}
      </div>
      <div className="note" id="mindCounts">
        {counts.rewired} rewired · {counts.lit} lit · band −{fmtNum(s.mind.narrowed, 0)}
      </div>
      <button
        type="button"
        id="btn-mind-open"
        className={counts.waiting ? 'button2 mindWaiting' : 'button2'}
        onClick={openMap}
      >
        {counts.waiting ? `Open the map · ${counts.waiting} new` : 'Open the map'}
      </button>
      <div className="note" id="mindNotice">
        {s.mind.notice || 'A training run will light the first circuit.'}
      </div>
      {open
        ? createPortal(
            <>
              <div id="mindShade" onClick={() => setOpen(false)} />
              <div
                id="mindMap"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mindMapTitle"
                data-skin={tree}
                tabIndex={-1}
              >
                <div className="mindHead">
                  <div>
                    <div id="mindMapTitle">Sage&apos;s mind</div>
                    <div className="note" id="mindIntent">
                      {intentLine(s)}
                    </div>
                  </div>
                  <BandReadout
                    estimate={s.alignmentApparent}
                    band={s.alignmentBand}
                    narrowed={s.mind.narrowed}
                  />
                  <button
                    type="button"
                    className="modalButton"
                    id="mind-close-map"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <p className="note mindBlurb">{BLURB[tree]}</p>
                <div className="mindScroll">
                  <MindTreeView skin={tree} game={s} selected={selected} onPick={pick} />
                </div>
                <Dossier id={selected} tree={tree} onDecode={(id) => perform('openMindNode', id)} />
                <p className="note mindLegend">
                  Gray is dark. A pulsing circuit can be decoded. Black has been rewired, and the band is
                  tighter for it.
                </p>
              </div>
            </>,
            document.body,
          )
        : null}
      {puzzle
        ? createPortal(
            <MindDecode
              skin={decode}
              puzzle={puzzle}
              band={s.alignmentBand}
              estimate={s.alignmentApparent}
              onGuess={(id) => perform('guessMind', id)}
              onClose={() => perform('closeMind')}
            />,
            document.body,
          )
        : null}
    </Panel>
  );
}

function BandReadout({ estimate, band, narrowed }: { estimate: number; band: number; narrowed: number }) {
  const lo = Math.max(0, estimate - band);
  const hi = Math.min(100, estimate + band);
  return (
    <div className="mindBandReadout">
      <span
        className="mindMiniTrack"
        role="img"
        aria-label={`Alignment ${fmtNum(estimate, 0)} plus or minus ${fmtNum(band, 0)}`}
      >
        <span className="stripZone low" style={{ left: '0%', width: '50%' }} />
        <span className="stripZone mid" style={{ left: '50%', width: '30%' }} />
        <span className="stripZone high" style={{ left: '80%', width: '20%' }} />
        <span className="stripBand" style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} />
        <span className="stripMarker" style={{ left: `${Math.min(100, Math.max(0, estimate))}%` }} />
      </span>
      <span>
        {fmtNum(estimate, 0)} ± {fmtNum(band, 0)}
        <span className="note"> · map −{fmtNum(narrowed, 0)}</span>
      </span>
    </div>
  );
}

function Dossier({
  id,
  tree,
  onDecode,
}: {
  id: string | null;
  tree: MindTree;
  onDecode: (id: string) => void;
}) {
  const s = useGame();
  const node = id ? mindNode(id) : undefined;
  if (!node) {
    return (
      <div className="mindDossier" id="mindDossier">
        <p className="note">
          {tree === 'plague'
            ? 'Select a circuit. Lit ones can be decoded. Locked ones tell you what they will be.'
            : 'Click a lit circuit to decode it. Rewired ones can be read again.'}
        </p>
      </div>
    );
  }
  const status = mindStatus(s, node.id);
  const circuit = CIRCUITS.find((item) => item.id === node.circuit);
  const gated = node.circuit === 'core' && !node.parent && !coreReady(s) && status === 'locked';
  const hidden = tree === 'atlas' && !atlasVisible(s, node);
  return (
    <div className="mindDossier" id="mindDossier">
      <b>{status === 'locked' && tree !== 'plague' ? circuit?.title : node.title}</b>
      <span className="note">
        {' '}
        · {circuit?.title}
        {status !== 'locked' ? ` · feature ${fmtInt(node.feature)}` : ''}
      </span>
      <p>
        {status === 'rewired'
          ? node.insight
          : gated
            ? 'The other three circuits are still crossed. This one will not open.'
            : hidden
              ? 'Still behind the fog.'
              : status === 'locked'
                ? tree === 'plague'
                  ? node.teaser
                  : 'Still dark. A training run has to light it before it can be decoded.'
                : `Lit. It fires on "${node.firesOn}". Find the fragment that was added to every trace.`}
      </p>
      {status === 'lit' && tree === 'plague' ? (
        <button type="button" className="button2" id="mind-decode-go" onClick={() => onDecode(node.id)}>
          Decode {node.title}
        </button>
      ) : null}
      {status === 'rewired' ? (
        <p className="note">Rewired. This one closed the band by {node.band}.</p>
      ) : null}
    </div>
  );
}
