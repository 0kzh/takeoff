import { useEffect, useRef, useState } from 'react';
import { useGame, useGameStore, usePerform } from '../../store/context.js';
import { CIRCUITS, FEATURES, featureById, sageWants } from '../../data/mind.js';
import { foundCount } from '../../engine/mind.js';
import { setMindPrefs, useMindPrefs } from '../../ui/mindPrefs.js';
import { HexTree, nodeTitle, nodeViews, type NodeView } from './Trees.js';
import { DecodeModal, ThoughtResult } from './Decode.js';
import { CIRCUIT_COLOR } from './theme.js';

const STATE_LINE: Record<NodeView, string> = {
  hidden: 'Nothing has lit up here yet. Decode what leads to it first.',
  detectable: 'Something is active here. A training run will isolate it; safety-focused runs find more.',
  found: '',
  decoded: '',
  wired: '',
};

function FeatureCard({ id, view, onDecode }: { id: string; view: NodeView; onDecode: () => void }) {
  const def = featureById(id)!;
  const circuit = CIRCUITS.find((c) => c.id === def.circuit)!;
  return (
    <div className={`mindCard ${view}`} style={{ ['--c' as string]: CIRCUIT_COLOR[def.circuit] }}>
      <div className="mindCardCircuit">{circuit.name}</div>
      <div className="mindCardName">{nodeTitle(def, view)}</div>
      {view === 'found' ? (
        <>
          <p className="mindCardClue">{def.clue}</p>
          <div className="thoughtSealed">
            <span className="sealedLine" />
            <span className="sealedLine" />
            <span className="sealedLine" />
            <i>There’s a thought inside this pattern.</i>
          </div>
          <button className="dButton primary" id="mind-decode" onClick={onDecode}>
            Decode
          </button>
        </>
      ) : view === 'decoded' || view === 'wired' ? (
        <ThoughtResult id={id} />
      ) : (
        <div className="mindCardState">{STATE_LINE[view]}</div>
      )}
    </div>
  );
}

function Overview() {
  const s = useGame();
  const views = nodeViews(s);
  const heart = FEATURES.find((f) => f.circuit === 'core' && f.slot === 3);
  const heartLit = heart && (views[heart.id] === 'decoded' || views[heart.id] === 'wired');
  return (
    <div className="mindCard overview">
      <div className="mindCardName">What we know</div>
      {CIRCUITS.map((c) => {
        const feats = FEATURES.filter((f) => f.circuit === c.id);
        const n = feats.filter((f) => views[f.id] === 'decoded' || views[f.id] === 'wired').length;
        return (
          <div key={c.id} className="overviewRow" style={{ ['--c' as string]: CIRCUIT_COLOR[c.id] }}>
            <span className="overviewName">{c.name}</span>
            <span className="overviewPips">
              {feats.map((f) => (
                <span key={f.id} className={`pip ${views[f.id]}`} />
              ))}
            </span>
            <span className="overviewCount">{n}/4</span>
          </div>
        );
      })}
      <div className="mindCardState">
        {heartLit
          ? `What Sage wants: ${sageWants(s)}`
          : 'Every decode narrows the alignment band. Pick a feature to see what Sage was thinking.'}
      </div>
    </div>
  );
}

export function MindView() {
  const s = useGame();
  const perform = usePerform();
  const [selected, setSelected] = useState<string | null>(null);
  const [decoding, setDecoding] = useState<string | null>(null);
  const views = nodeViews(s);
  useEffect(() => () => void perform('markMindSeen'), [perform]);
  const select = (id: string) => {
    setSelected(id);
  };
  return (
    <div id="mindView">
      <div className="mindBody">
        <div className="mindTree">
          <HexTree s={s} selected={selected} onSelect={select} />
        </div>
        <div className="mindSide">
          {selected ? (
            <FeatureCard id={selected} view={views[selected]!} onDecode={() => setDecoding(selected)} />
          ) : (
            <Overview />
          )}
          {selected ? (
            <button className="dButton subtle" onClick={() => setSelected(null)}>
              Back to overview
            </button>
          ) : null}
        </div>
      </div>
      {decoding ? <DecodeModal key={decoding} id={decoding} onClose={() => setDecoding(null)} /> : null}
    </div>
  );
}

export function MainTabs() {
  const shown = useGameStore((st) => st.game.revealed['mind'] === true);
  const waiting = useGameStore((st) => foundCount(st.game));
  const { tab } = useMindPrefs();
  if (!shown) return null;
  return (
    <div id="mainTabs" role="tablist">
      <button
        role="tab"
        id="tab-lab"
        aria-selected={tab === 'lab'}
        className={tab === 'lab' ? 'active' : ''}
        onClick={() => setMindPrefs({ tab: 'lab' })}
      >
        Lab
      </button>
      <button
        role="tab"
        id="tab-mind"
        aria-selected={tab === 'mind'}
        className={tab === 'mind' ? 'active' : ''}
        onClick={() => setMindPrefs({ tab: 'mind' })}
      >
        Mind{waiting ? <span className="tabBadge">{waiting}</span> : null}
      </button>
    </div>
  );
}

// A small, clickable notice when a training run lights up a feature while the
// player is looking at the lab.
export function MindToast() {
  const signals = useGameStore((st) => st.game.mind.signals);
  const last = useGameStore((st) => st.game.mind.lastFound);
  const { tab } = useMindPrefs();
  const [shown, setShown] = useState<string | null>(null);
  const seen = useRef({ signals, last });
  useEffect(() => {
    const prev = seen.current;
    seen.current = { signals, last };
    if (signals === prev.signals || !last || last === prev.last) return;
    setShown(last);
    const t = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(t);
  }, [signals, last]);
  const def = shown ? featureById(shown) : undefined;
  if (!def || tab === 'mind') return null;
  const circuit = CIRCUITS.find((c) => c.id === def.circuit)!;
  return (
    <button
      id="mindToast"
      key={shown}
      style={{ ['--c' as string]: CIRCUIT_COLOR[def.circuit] }}
      onClick={() => {
        setShown(null);
        setMindPrefs({ tab: 'mind' });
      }}
    >
      <span className="mtText">
        <span className="mtTop">Feature lit up · {circuit.name}</span>
        <span className="mtName">{def.name}</span>
      </span>
      <span className="mtGo">open Mind →</span>
    </button>
  );
}
