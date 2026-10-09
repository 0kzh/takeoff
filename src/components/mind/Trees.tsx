import type { GameState } from '../../engine/state.js';
import {
  CIRCUITS,
  FEATURES,
  circuitFeatures,
  thoughtOf,
  type CircuitId,
  type FeatureDef,
} from '../../data/mind.js';
import { featureStatus, frontier } from '../../engine/mind.js';
import { CIRCUIT_COLOR, CIRCUIT_MARK } from './theme.js';

export type NodeView = 'hidden' | 'detectable' | 'found' | 'decoded' | 'wired';
export interface TreeProps {
  s: GameState;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function nodeViews(s: GameState): Record<string, NodeView> {
  const front = new Set(frontier(s).map((f) => f.id));
  const out: Record<string, NodeView> = {};
  for (const f of FEATURES) {
    const st = featureStatus(s, f.id);
    out[f.id] =
      st === 'decoded'
        ? s.mind.features[f.id]?.wiring
          ? 'wired'
          : 'decoded'
        : st === 'found'
          ? 'found'
          : front.has(f.id)
            ? 'detectable'
            : 'hidden';
  }
  return out;
}

const known = (v: NodeView) => v === 'found' || v === 'decoded' || v === 'wired';
const lit = (v: NodeView) => v === 'decoded' || v === 'wired';
export const nodeTitle = (f: FeatureDef, v: NodeView) =>
  known(v) ? f.name : v === 'detectable' ? 'Unidentified activity' : 'Unknown';

function edges(): [FeatureDef, FeatureDef][] {
  const out: [FeatureDef, FeatureDef][] = [];
  for (const f of FEATURES)
    for (const r of f.requires) {
      const parent = FEATURES.find((p) => p.id === r);
      if (parent) out.push([parent, f]);
    }
  return out;
}
const EDGES = edges();
const DEEP_TO_CORE = FEATURES.filter((f) => f.circuit !== 'core' && f.slot === 3);
const CORE_HEART = FEATURES.find((f) => f.circuit === 'core' && f.slot === 3);

function nodeAria(f: FeatureDef, v: NodeView): string {
  const circuit = CIRCUITS.find((c) => c.id === f.circuit)!.name;
  const state = {
    hidden: 'locked',
    detectable: 'not yet found',
    found: 'ready to decode',
    decoded: 'decoded',
    wired: 'resolved',
  }[v];
  return `${circuit}: ${nodeTitle(f, v)}, ${state}`;
}
function keyActivate(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

// ---------- Hex: a Plague-Inc-style honeycomb that converges on the core ----------
const DIR: Record<Exclude<CircuitId, 'core'>, [number, number]> = {
  watched: [-0.866, -0.5],
  pleasing: [0.866, -0.5],
  self: [0, 1],
};
const HD = 50;
const HR = 25;
function hexPos(f: FeatureDef): [number, number] {
  if (f.circuit === 'core') {
    if (f.slot === 3) return [0, 0];
    const deg = [270, 30, 150][f.slot]!;
    return [Math.cos((deg * Math.PI) / 180) * HD, Math.sin((deg * Math.PI) / 180) * HD];
  }
  const [ux, uy] = DIR[f.circuit];
  const [px, py] = [-uy, ux];
  const k = f.slot === 0 ? 3.7 : f.slot === 3 ? 2 : 2.85;
  const off = f.slot === 1 ? 0.5 : f.slot === 2 ? -0.5 : 0;
  return [(ux * k + px * off) * HD, (uy * k + py * off) * HD];
}
const hexPoints = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
const HEX_LABEL: Record<CircuitId, [number, number]> = {
  watched: [-160, -128],
  pleasing: [160, -128],
  self: [0, 228],
  core: [0, -84],
};

export function HexTree({ s, selected, onSelect }: TreeProps) {
  const views = nodeViews(s);
  const fresh = new Set(s.mind.fresh);
  return (
    <svg className="hexTree" viewBox="-250 -146 500 386" role="group" aria-label="Sage's circuits">
      {EDGES.map(([a, b]) => {
        const [x1, y1] = hexPos(a);
        const [x2, y2] = hexPos(b);
        const cls =
          lit(views[a.id]!) && known(views[b.id]!) ? 'on' : views[b.id] === 'hidden' ? 'off' : 'dim';
        return (
          <line
            key={`${a.id}-${b.id}`}
            className={`hexEdge ${cls}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={CIRCUIT_COLOR[b.circuit]}
          />
        );
      })}
      {CORE_HEART
        ? DEEP_TO_CORE.map((f) => {
            const [x1, y1] = hexPos(f);
            const on = lit(views[f.id]!) && known(views[CORE_HEART.id]!);
            return (
              <line
                key={`feed-${f.id}`}
                className={`hexEdge feed ${on ? 'on' : 'off'}`}
                x1={x1}
                y1={y1}
                x2={0}
                y2={0}
                stroke={CIRCUIT_COLOR[f.circuit]}
              />
            );
          })
        : null}
      {CIRCUITS.map((c) => {
        const [x, y] = HEX_LABEL[c.id];
        const feats = circuitFeatures(c.id);
        const done = feats.filter((f) => lit(views[f.id]!)).length;
        const any = feats.some((f) => views[f.id] !== 'hidden');
        return (
          <text key={c.id} className={`hexLabel${any ? '' : ' dark'}`} x={x} y={y} fill={CIRCUIT_COLOR[c.id]}>
            {c.name.toUpperCase()}{' '}
            <tspan className="hexCount">
              {done}/{feats.length}
            </tspan>
          </text>
        );
      })}
      {FEATURES.map((f) => {
        const [x, y] = hexPos(f);
        const v = views[f.id]!;
        const color = CIRCUIT_COLOR[f.circuit];
        return (
          <g
            key={f.id}
            className={`hexNode ${v}${selected === f.id ? ' sel' : ''}${fresh.has(f.id) ? ' fresh' : ''}`}
            data-feature={f.id}
            role="button"
            tabIndex={0}
            aria-label={nodeAria(f, v)}
            onClick={() => onSelect(f.id)}
            onKeyDown={(e) => keyActivate(e, () => onSelect(f.id))}
            style={{ ['--c' as string]: color }}
          >
            <title>{nodeTitle(f, v)}</title>
            {selected === f.id ? <polygon className="hexSel" points={hexPoints(x, y, HR + 5)} /> : null}
            <polygon className="hexShape" points={hexPoints(x, y, HR)} />
            <text className="hexMark" x={x} y={y + 1}>
              {v === 'hidden' ? '' : v === 'detectable' ? '?' : v === 'found' ? '!' : CIRCUIT_MARK[f.circuit]}
            </text>
            {v === 'wired' ? <circle className="hexWired" cx={x + 15} cy={y - 14} r={4} /> : null}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Atlas: a star chart of neurons; decoded features light their sky ----------
const ADEG: Record<Exclude<CircuitId, 'core'>, number> = { watched: 210, pleasing: 330, self: 90 };
const polar = (r: number, deg: number): [number, number] => [
  Math.cos((deg * Math.PI) / 180) * r,
  Math.sin((deg * Math.PI) / 180) * r,
];
function atlasPos(f: FeatureDef): [number, number] {
  if (f.circuit === 'core') return f.slot === 3 ? [0, 0] : polar(36, [270, 30, 150][f.slot]!);
  const t = ADEG[f.circuit];
  if (f.slot === 0) return polar(182, t);
  if (f.slot === 3) return polar(84, t);
  return polar(132, t + (f.slot === 1 ? 17 : -17));
}
interface Star {
  x: number;
  y: number;
  r: number;
  circuit: CircuitId;
  rank: number;
  twinkle: boolean;
}
const STARS: Star[] = (() => {
  let x = 0x2f6b;
  const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) % 10000) / 10000;
  const out: Star[] = [];
  for (let i = 0; i < 260; i++) {
    const rr = Math.sqrt(rnd()) * 222;
    const deg = rnd() * 360;
    const [sx, sy] = polar(rr, deg);
    let circuit: CircuitId = 'core';
    if (rr > 56) {
      const dist = (t: number) => Math.abs(((deg - t + 540) % 360) - 180);
      circuit = (['watched', 'pleasing', 'self'] as const).reduce((a, b) =>
        dist(ADEG[a]) <= dist(ADEG[b]) ? a : b,
      );
    }
    out.push({
      x: sx,
      y: sy,
      r: 0.6 + rnd() * 1.3,
      circuit,
      rank: Math.floor(rnd() * 4),
      twinkle: rnd() < 0.18,
    });
  }
  return out;
})();

export function AtlasTree({ s, selected, onSelect }: TreeProps) {
  const views = nodeViews(s);
  const fresh = new Set(s.mind.fresh);
  const litCount = (c: CircuitId) => circuitFeatures(c).filter((f) => lit(views[f.id]!)).length;
  const counts = Object.fromEntries(CIRCUITS.map((c) => [c.id, litCount(c.id)])) as Record<CircuitId, number>;
  return (
    <svg className="atlasTree" viewBox="-275 -240 550 480" role="group" aria-label="Sage's circuits">
      <defs>
        <radialGradient id="atlasGlow">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[84, 132, 182].map((r) => (
        <circle key={r} className="atlasRing" r={r} />
      ))}
      {[270, 30, 150].map((d) => {
        const [x1, y1] = polar(58, d);
        const [x2, y2] = polar(226, d);
        return <line key={d} className="atlasSpoke" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      {STARS.map((st, i) => {
        const on = st.rank < counts[st.circuit];
        return (
          <circle
            key={i}
            className={`atlasStar${on ? ' on' : ''}${st.twinkle ? ' tw' : ''}`}
            cx={st.x}
            cy={st.y}
            r={st.r}
            fill={on ? CIRCUIT_COLOR[st.circuit] : '#3a3a3a'}
            style={{ animationDelay: `${(i % 17) * 0.37}s` }}
          />
        );
      })}
      {EDGES.map(([a, b]) => {
        const [x1, y1] = atlasPos(a);
        const [x2, y2] = atlasPos(b);
        const cls = lit(views[a.id]!) && known(views[b.id]!) ? 'on' : known(views[b.id]!) ? 'dim' : 'off';
        return (
          <path
            key={`${a.id}-${b.id}`}
            className={`atlasEdge ${cls}`}
            d={`M${x1},${y1} Q${(x1 + x2) * 0.42},${(y1 + y2) * 0.42} ${x2},${y2}`}
            stroke={CIRCUIT_COLOR[b.circuit]}
          />
        );
      })}
      {CIRCUITS.filter((c) => c.id !== 'core').map((c) => {
        const [x, y] = polar(212, ADEG[c.id as Exclude<CircuitId, 'core'>]);
        return (
          <text key={c.id} className="atlasLabel" x={x} y={y + (y > 0 ? 14 : 0)} fill={CIRCUIT_COLOR[c.id]}>
            {c.name.toUpperCase()} · {counts[c.id]}/4
          </text>
        );
      })}
      <text className="atlasLabel core" x={0} y={-56} fill={CIRCUIT_COLOR.core}>
        THE CORE · {counts.core}/4
      </text>
      {FEATURES.map((f) => {
        const [x, y] = atlasPos(f);
        const v = views[f.id]!;
        const color = CIRCUIT_COLOR[f.circuit];
        const r = v === 'hidden' ? 2.4 : v === 'detectable' ? 5 : 8;
        return (
          <g
            key={f.id}
            className={`atlasNode ${v}${selected === f.id ? ' sel' : ''}${fresh.has(f.id) ? ' fresh' : ''}`}
            data-feature={f.id}
            role="button"
            tabIndex={0}
            aria-label={nodeAria(f, v)}
            onClick={() => onSelect(f.id)}
            onKeyDown={(e) => keyActivate(e, () => onSelect(f.id))}
            style={{ ['--c' as string]: color }}
          >
            <title>{nodeTitle(f, v)}</title>
            <circle className="atlasHit" cx={x} cy={y} r={16} />
            {lit(v) ? <circle cx={x} cy={y} r={20} fill="url(#atlasGlow)" opacity={0.35} /> : null}
            <circle className="atlasDot" cx={x} cy={y} r={r} />
            {selected === f.id ? <circle className="atlasSel" cx={x} cy={y} r={r + 6} /> : null}
            {known(v) && f.circuit !== 'core' ? (
              <text className="atlasName" x={x} y={y + 21}>
                {f.name}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Dossier: a redacted case file in the game's own paper style ----------
function Redact({ w }: { w: number }) {
  return <span className="redact" style={{ width: `${w}em` }} aria-label="redacted" />;
}
export function DossierTree({ s, selected, onSelect }: TreeProps) {
  const views = nodeViews(s);
  const fresh = new Set(s.mind.fresh);
  return (
    <div className="dossier">
      {CIRCUITS.map((c, ci) => {
        const feats = circuitFeatures(c.id);
        const done = feats.filter((f) => lit(views[f.id]!)).length;
        return (
          <section key={c.id} className="dossierFile" style={{ ['--c' as string]: CIRCUIT_COLOR[c.id] }}>
            <div className="dossierHead">
              <span>
                File {ci + 1}. {c.name}
              </span>
              <span className="dossierCount">
                {done}/{feats.length} decoded
              </span>
            </div>
            <div className="dossierBlurb">{c.blurb}</div>
            {feats.map((f, fi) => {
              const v = views[f.id]!;
              return (
                <button
                  key={f.id}
                  data-feature={f.id}
                  className={`dossierRow ${v}${selected === f.id ? ' sel' : ''}${fresh.has(f.id) ? ' fresh' : ''}`}
                  onClick={() => onSelect(f.id)}
                  aria-label={nodeAria(f, v)}
                >
                  <span className="dossierName">
                    {known(v) ? f.name : <Redact w={5 + ((fi * 3 + ci) % 4)} />}
                  </span>
                  <span className="dossierText">
                    {lit(v) ? (
                      <>“{thoughtOf(f, s)}”</>
                    ) : v === 'found' ? (
                      f.clue
                    ) : v === 'detectable' ? (
                      <i>activity detected; a training run will isolate it</i>
                    ) : (
                      <Redact w={9 + ((fi * 5 + ci) % 6)} />
                    )}
                  </span>
                  <span className="dossierAct">
                    {v === 'found'
                      ? 'decode'
                      : v === 'decoded'
                        ? 'rewire'
                        : v === 'wired'
                          ? s.mind.features[f.id]?.wiring === 'benign'
                            ? 'benign'
                            : 'rewired'
                          : ''}
                  </span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
