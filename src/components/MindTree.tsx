import { CIRCUITS, MIND_NODES, circuitOf, nodeDepth, type MindNodeDef } from '../data/mind.js';
import { atlasVisible, mindStatus, type MindTree } from '../engine/mind.js';
import type { GameState } from '../engine/state.js';

interface Place {
  node: MindNodeDef;
  x: number;
  y: number;
}

function siblings(node: MindNodeDef, visible: (node: MindNodeDef) => boolean): MindNodeDef[] {
  return MIND_NODES.filter(
    (other) => other.parent === node.parent && other.circuit === node.circuit && visible(other),
  ).sort((a, b) => a.slot - b.slot);
}

function branchPlaces(): { w: number; h: number; places: Place[] } {
  const laneY = [64, 172, 280, 400];
  const places = MIND_NODES.map((node) => {
    const lane = CIRCUITS.findIndex((circuit) => circuit.id === node.circuit);
    const group = siblings(node, () => true);
    const index = Math.max(
      0,
      group.findIndex((other) => other.id === node.id),
    );
    const offset = group.length <= 1 ? 0 : index === 0 ? -28 : 28;
    return { node, x: 214 + nodeDepth(node.id) * 145, y: laneY[lane]! + offset };
  });
  return { w: 800, h: 456, places };
}

function atlasPlaces(s: GameState): { w: number; h: number; places: Place[] } {
  const cx = 340;
  const cy = 268;
  const angles = { watched: -2.35, pleasing: -0.75, itself: 2.35, core: 0.78 } as const;
  const places: Place[] = [];
  for (const node of MIND_NODES) {
    if (!atlasVisible(s, node)) continue;
    const group = siblings(node, (other) => atlasVisible(s, other));
    const index = Math.max(
      0,
      group.findIndex((other) => other.id === node.id),
    );
    const angle = angles[node.circuit] + (index - (group.length - 1) / 2) * 0.52;
    const radius = 78 + nodeDepth(node.id) * 70;
    places.push({
      node,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return { w: 680, h: 540, places };
}

function Wires({
  places,
  w,
  h,
  game,
  orbits = false,
}: {
  places: Place[];
  w: number;
  h: number;
  game: GameState;
  orbits?: boolean;
}) {
  const at = new Map(places.map((place) => [place.node.id, place]));
  return (
    <svg className="mindWires" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      {orbits
        ? [78, 148, 218].map((radius) => (
            <circle key={radius} cx={340} cy={268} r={radius} className="mindOrbit" />
          ))
        : null}
      {places.map((place) => {
        if (!place.node.parent) return null;
        const parent = at.get(place.node.parent);
        if (!parent) return null;
        const mid = (parent.x + place.x) / 2;
        const hot = mindStatus(game, place.node.id) !== 'locked';
        return (
          <path
            key={place.node.id}
            d={`M ${parent.x} ${parent.y} C ${mid} ${parent.y}, ${mid} ${place.y}, ${place.x} ${place.y}`}
            className={hot ? 'mindWire hot' : 'mindWire'}
          />
        );
      })}
    </svg>
  );
}

export function MindTreeView({
  skin,
  game,
  selected,
  onPick,
}: {
  skin: MindTree;
  game: GameState;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  if (skin === 'plague') return <PlagueBoard game={game} selected={selected} onPick={onPick} />;
  const layout = skin === 'atlas' ? atlasPlaces(game) : branchPlaces();
  return (
    <div className={`mindCanvas skin-${skin}`} style={{ width: layout.w, height: layout.h }}>
      <Wires places={layout.places} w={layout.w} h={layout.h} game={game} orbits={skin === 'atlas'} />
      {skin === 'branches' ? (
        CIRCUITS.map((circuit, index) => (
          <div
            key={circuit.id}
            className="mindLane"
            style={{ top: [48, 156, 264, 384][index] }}
            title={circuit.line}
          >
            <b>{circuit.title}</b>
          </div>
        ))
      ) : (
        <>
          <div className="mindCore" style={{ left: 340, top: 268 }}>
            Sage
          </div>
          {CIRCUITS.map((circuit) => {
            const angles = { watched: -2.35, pleasing: -0.75, itself: 2.35, core: 0.78 } as const;
            const angle = angles[circuit.id];
            return (
              <div
                key={circuit.id}
                className="mindQuad"
                style={{ left: 340 + Math.cos(angle) * 312, top: 268 + Math.sin(angle) * 312 }}
              >
                {circuit.title}
              </div>
            );
          })}
        </>
      )}
      {layout.places.map((place) => (
        <NodeButton
          key={place.node.id}
          node={place.node}
          game={game}
          skin={skin}
          selected={selected === place.node.id}
          style={{ left: place.x, top: place.y }}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function PlagueBoard({
  game,
  selected,
  onPick,
}: {
  game: GameState;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="mindPlague">
      {CIRCUITS.map((circuit) => {
        const nodes = MIND_NODES.filter((node) => node.circuit === circuit.id);
        const maxDepth = Math.max(...nodes.map((node) => nodeDepth(node.id)));
        const rows = [];
        for (let depth = 0; depth <= maxDepth; depth++) {
          rows.push(nodes.filter((node) => nodeDepth(node.id) === depth).sort((a, b) => a.slot - b.slot));
        }
        return (
          <section key={circuit.id} className={`mindCol ${circuit.id}`}>
            <h3>{circuit.title}</h3>
            <p className="note">{circuit.line}</p>
            <div className="mindColNodes">
              {rows.map((row) => (
                <div key={row[0]?.id ?? circuit.id} className="mindFork">
                  {row.map((node) => (
                    <NodeButton
                      key={node.id}
                      node={node}
                      game={game}
                      skin="plague"
                      selected={selected === node.id}
                      onPick={onPick}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function NodeButton({
  node,
  game,
  skin,
  selected,
  style,
  onPick,
}: {
  node: MindNodeDef;
  game: GameState;
  skin: MindTree;
  selected: boolean;
  style?: { left: number; top: number };
  onPick: (id: string) => void;
}) {
  const status = mindStatus(game, node.id);
  const named = skin === 'plague' || status !== 'locked';
  const label = named ? node.title : skin === 'atlas' ? '' : '· · ·';
  return (
    <button
      type="button"
      id={`mind-node-${node.id}`}
      className={`mindNode ${status}${selected ? ' selected' : ''}`}
      data-status={status}
      data-circuit={node.circuit}
      style={style}
      aria-label={named ? `${node.title}, ${status}` : `Locked circuit in ${circuitOf(node.circuit).title}`}
      title={
        status === 'rewired'
          ? node.insight
          : status === 'lit'
            ? 'Decode this circuit'
            : skin === 'plague'
              ? node.teaser
              : 'Still dark'
      }
      onClick={() => onPick(node.id)}
    >
      {skin === 'atlas' && status === 'locked' ? <span className="mindDot" /> : label}
    </button>
  );
}
