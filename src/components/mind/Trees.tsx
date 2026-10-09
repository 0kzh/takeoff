import type { GameState } from '../../engine/state.js';
import { CIRCUITS, FEATURES, circuitFeatures, type CircuitId, type FeatureDef } from '../../data/mind.js';
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
