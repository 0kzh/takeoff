import type { GameState } from '../../engine/state.js';
import { CIRCUITS, FEATURES, circuitFeatures, type CircuitId, type FeatureDef } from '../../data/mind.js';
import { featureStatus, frontier } from '../../engine/mind.js';
import { CIRCUIT_MARK } from './theme.js';

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

// ---------- Hex: a packed honeycomb. Sage (the deepest core feature) sits in the
// middle; each outer circuit is a diamond arm, the other core features fill the gaps.
type Axial = [number, number];
const R = 27;
const SQ3 = Math.sqrt(3);
const toXY = ([q, r]: Axial): [number, number] => [SQ3 * R * (q + r / 2), 1.5 * R * r];
const rot60 = ([q, r]: Axial): Axial => [q + r, -q];
const add = (a: Axial, b: Axial, k = 1): Axial => [a[0] + b[0] * k, a[1] + b[1] * k];
const ARM: Record<Exclude<CircuitId, 'core'>, Axial> = {
  watched: [0, -1],
  pleasing: [1, 0],
  self: [-1, 1],
};
const CORE_CELL: Axial[] = [rot60(ARM.watched), rot60(ARM.pleasing), rot60(ARM.self)];
function cell(f: FeatureDef): Axial {
  if (f.circuit === 'core') return f.slot === 3 ? [0, 0] : CORE_CELL[f.slot]!;
  const d = ARM[f.circuit];
  const side = rot60(d);
  if (f.slot === 3) return d;
  if (f.slot === 1) return add(d, d);
  if (f.slot === 2) return add(d, side);
  return add(add(d, d), side);
}
const OCCUPIED = new Set(FEATURES.map((f) => cell(f).join(',')));
const BACKDROP: Axial[] = [];
for (let q = -4; q <= 4; q++)
  for (let r = -4; r <= 4; r++)
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 4 && !OCCUPIED.has(`${q},${r}`))
      BACKDROP.push([q, r]);
const hexPoints = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
function shortName(name: string): string[] {
  const words = name.replace(/^The /, '').split(' ');
  if (words.length < 2) return words;
  const cut = Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}
function circuitLabel(c: Exclude<CircuitId, 'core'>): {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
} {
  const [x, y] = toXY(cell(circuitFeatures(c)[0]!));
  const [dx, dy] = toXY(ARM[c]);
  const n = Math.hypot(dx, dy);
  const ux = dx / n;
  const anchor = ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle';
  const k = anchor === 'middle' ? R * 1.5 : Math.abs(dy / n) > 0.6 ? R * 1.45 : R * 1.1;
  return { x: x + ux * k, y: y + (dy / n) * k, anchor };
}

export function HexTree({ s, selected, onSelect }: TreeProps) {
  const views = nodeViews(s);
  const fresh = new Set(s.mind.fresh);
  return (
    <svg className="hexTree" viewBox="-250 -190 500 380" role="group" aria-label="Sage's circuits">
      {BACKDROP.map((a) => {
        const [x, y] = toXY(a);
        return <polygon key={a.join(',')} className="hexBack" points={hexPoints(x, y, R - 2)} />;
      })}
      {CIRCUITS.map((c) => {
        if (c.id === 'core') return null;
        const { x, y, anchor } = circuitLabel(c.id);
        const feats = circuitFeatures(c.id);
        const done = feats.filter((f) => lit(views[f.id]!)).length;
        const any = feats.some((f) => views[f.id] !== 'hidden');
        return (
          <text key={c.id} className={`hexLabel${any ? '' : ' dark'}`} x={x} y={y} textAnchor={anchor}>
            {c.name}{' '}
            <tspan className="hexCount">
              {done}/{feats.length}
            </tspan>
          </text>
        );
      })}
      {FEATURES.map((f) => {
        const [x, y] = toXY(cell(f));
        const v = views[f.id]!;
        const hub = f.circuit === 'core' && f.slot === 3;
        const benign = s.mind.features[f.id]?.wiring === 'benign';
        const icon =
          v === 'detectable'
            ? '?'
            : v === 'found'
              ? CIRCUIT_MARK[f.circuit]
              : v === 'decoded'
                ? '⟳'
                : v === 'wired'
                  ? '✓'
                  : '';
        const lines = hub ? ['Sage'] : known(v) ? shortName(f.name) : [];
        const top = y - (lines.length > 1 ? 3 : 0) + (icon ? 6 : 0);
        return (
          <g
            key={f.id}
            className={`hexNode ${v}${hub ? ' hub' : ''}${benign ? ' benign' : ''}${selected === f.id ? ' sel' : ''}${fresh.has(f.id) ? ' fresh' : ''}`}
            data-feature={f.id}
            role="button"
            tabIndex={0}
            aria-label={nodeAria(f, v)}
            onClick={() => onSelect(f.id)}
            onKeyDown={(e) => keyActivate(e, () => onSelect(f.id))}
          >
            <title>{hub && !known(v) ? 'Sage' : nodeTitle(f, v)}</title>
            <polygon className="hexShape" points={hexPoints(x, y, R - 2)} />
            {v === 'decoded' || selected === f.id ? (
              <polygon className="hexInset" points={hexPoints(x, y, R - 7)} />
            ) : null}
            {icon && !(hub && !known(v)) ? (
              <text className="hexIcon" x={x} y={lines.length ? y - 7 - (lines.length > 1 ? 4 : 0) : y + 1}>
                {icon}
              </text>
            ) : null}
            {lines.map((line, i) => (
              <text key={i} className="hexName" x={x} y={(icon && !(hub && !known(v)) ? top : y) + i * 9}>
                {line}
              </text>
            ))}
            {fresh.has(f.id) ? <circle className="hexFresh" cx={x + 15} cy={y - 14} r={3.5} /> : null}
          </g>
        );
      })}
    </svg>
  );
}
