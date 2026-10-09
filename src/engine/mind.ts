import { CHUNK_BANK, CIRCUITS, MIND_NODES, circuitOf, mindNode, nodeDepth, type MindNodeDef } from '../data/mind.js';
import { narrowBand, reduceBias } from './alignment.js';
import { fmtInt } from './format.js';
import { randInt, rng, type Seeded } from './rng.js';
import { say, logNews, type Focus, type GameState, type MindPuzzle } from './state.js';

// Training runs light the next dark circuit. The player decodes it (the fragment
// that was added to every trace) and the alignment band tightens. The mind's own
// random stream is separate from the game's, so a spike does not reshuffle the run.

export type MindTree = 'branches' | 'plague' | 'atlas';
export type MindDecodeSkin = 'tiles' | 'tape' | 'stack';

const WEIGHT: Record<Focus, Record<MindNodeDef['circuit'], number>> = {
  capability: { watched: 1, pleasing: 2, itself: 5, core: 2 },
  efficiency: { watched: 1, pleasing: 5, itself: 2, core: 1 },
  safety: { watched: 5, pleasing: 1, itself: 1, core: 4 },
};

const LIGHT_LINES = [
  (run: string, node: MindNodeDef) =>
    `Feature ${fmtInt(node.feature)} spiked during ${run}. It fires on "${node.firesOn}". The map has it.`,
  (run: string, node: MindNodeDef) =>
    `${run} lit a direction under ${circuitOf(node.circuit).short}. It fires on "${node.firesOn}".`,
  (run: string, node: MindNodeDef) =>
    `During ${run}, feature ${fmtInt(node.feature)} held still. It fires on "${node.firesOn}".`,
];

export function mindStream(s: GameState, key: string): Seeded {
  let hash = s.seed | 0;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 0x5bd1e995);
  hash = (hash ^ (hash >>> 13)) | 0;
  return { rngSeed: hash || 1 };
}

function shuffle<T>(stream: Seeded, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(stream, 0, i);
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}

export type MindNodeStatus = 'locked' | 'lit' | 'rewired';

export function mindStatus(s: GameState, id: string): MindNodeStatus {
  return s.mind.status[id] ?? 'locked';
}

export function coreReady(s: GameState): boolean {
  return CIRCUITS.filter((circuit) => circuit.id !== 'core').every((circuit) =>
    MIND_NODES.some((node) => node.circuit === circuit.id && mindStatus(s, node.id) === 'rewired'),
  );
}

function available(s: GameState): MindNodeDef[] {
  return MIND_NODES.filter((node) => {
    if (mindStatus(s, node.id) !== 'locked') return false;
    if (node.parent && mindStatus(s, node.parent) !== 'rewired') return false;
    if (node.circuit === 'core' && !node.parent && !coreReady(s)) return false;
    return true;
  });
}

function chooseNode(s: GameState, focus: Focus, stream: Seeded): MindNodeDef | null {
  const pool = available(s);
  if (!pool.length) return null;
  const shallowest = Math.min(...pool.map((node) => nodeDepth(node.id)));
  const band = pool.filter((node) => nodeDepth(node.id) === shallowest);
  const weights = band.map((node) => WEIGHT[focus][node.circuit]);
  let roll = rng(stream) * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < band.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return band[i]!;
  }
  return band[band.length - 1]!;
}

function lightNode(s: GameState, node: MindNodeDef, runName: string, stream: Seeded): void {
  s.mind.status[node.id] = 'lit';
  const line = LIGHT_LINES[Math.floor(rng(stream) * LIGHT_LINES.length)]!(runName, node);
  say(s, line);
  logNews(s, `A feature lit during ${runName}: ${fmtInt(node.feature)}, firing on "${node.firesOn}".`);
  s.mind.notice = `${node.title} lit. It fires on "${node.firesOn}".`;
}

function stallLine(s: GameState, runName: string): void {
  if (MIND_NODES.every((node) => mindStatus(s, node.id) === 'rewired')) return;
  const waiting = MIND_NODES.find((node) => mindStatus(s, node.id) === 'lit');
  if (waiting) {
    const note = `Still crossed: ${waiting.title}.`;
    if (s.mind.notice === note) return;
    say(s, `${runName} brushed feature ${fmtInt(waiting.feature)} again. It is still crossed.`);
    s.mind.notice = note;
    return;
  }
  const note = 'A twitch the map cannot hold yet.';
  if (s.mind.notice === note) return;
  say(s, `${runName} twitched in a place the map cannot hold yet.`);
  s.mind.notice = note;
}

export function pingMindDuringRun(
  s: GameState,
  run: { id: number; name: string; focus: Focus; prologue?: boolean },
): void {
  if (s.stage < 2 || run.prologue || s.mind.pinged.includes(run.id)) return;
  s.mind.pinged.push(run.id);
  const node = chooseNode(s, run.focus, mindStream(s, `light:${run.id}`));
  if (!node) {
    stallLine(s, run.name);
    return;
  }
  lightNode(s, node, run.name, mindStream(s, `line:${run.id}`));
}

/** Lights a node the autoencoder already named, without a second console line. */
export function forceLight(s: GameState, id: string): boolean {
  const node = mindNode(id);
  if (!node || mindStatus(s, id) !== 'locked') return false;
  s.mind.status[id] = 'lit';
  s.mind.notice = `${node.title} lit. It fires on "${node.firesOn}".`;
  return true;
}

export function lightMind(s: GameState): boolean {
  if (s.stage < 2) return false;
  const node = chooseNode(s, s.training.focus, mindStream(s, `dev:${s.tickCount}:${Object.keys(s.mind.status).length}`));
  if (!node) return false;
  lightNode(s, node, s.training.run?.name ?? s.training.modelName, mindStream(s, `devline:${node.id}:${s.tickCount}`));
  return true;
}

function rewire(s: GameState, id: string): boolean {
  const node = mindNode(id);
  if (!node || mindStatus(s, id) !== 'lit') return false;
  s.mind.status[id] = 'rewired';
  const before = s.alignmentBand;
  narrowBand(s, node.band);
  s.mind.narrowed += before - s.alignmentBand;
  if (node.bias) reduceBias(s, node.bias);
  s.revealed['interpretability'] = true;
  say(s, node.insight);
  const closed = before - s.alignmentBand;
  logNews(
    s,
    closed > 0
      ? `Feature ${fmtInt(node.feature)} rewired. The band closed by ${fmtInt(closed)}.`
      : `Feature ${fmtInt(node.feature)} rewired.`,
  );
  return true;
}

export function puzzleIsFair(puzzle: MindPuzzle): boolean {
  return fairPuzzle(puzzle);
}

export function makePuzzle(s: GameState, node: MindNodeDef): MindPuzzle {
  const stream = mindStream(s, `puzzle:${node.id}`);
  const rowsN = 3 + Math.min(2, nodeDepth(node.id));
  const width = 4 + (nodeDepth(node.id) >= 2 ? 1 : 0);
  const bank = shuffle(stream, CHUNK_BANK);
  const answer = bank[0]!;
  const baseline = bank.slice(1, 4);
  const noise = bank.slice(4, 4 + rowsN);
  const rows: string[][] = [];
  for (let r = 0; r < rowsN; r++) {
    // The answer and the first baseline fragment are in every trace. The baseline
    // one is the red herring: common, but it was already in the before-trace.
    const row = [answer.id, baseline[0]!.id, noise[r]!.id];
    if (width >= 5) row.push(baseline[1]!.id, baseline[2]!.id);
    else row.push(baseline[1 + (r % 2)]!.id);
    rows.push(shuffle(stream, [...new Set(row)]));
  }
  const used = new Set<string>([...baseline.map((chunk) => chunk.id), ...rows.flat()]);
  const puzzle: MindPuzzle = {
    nodeId: node.id,
    baseline: shuffle(stream, baseline.map((chunk) => chunk.id)),
    rows,
    answer: answer.id,
    chunks: bank
      .filter((chunk) => used.has(chunk.id))
      .map((chunk) => ({ id: chunk.id, token: chunk.token, bits: chunk.bits.slice() })),
    struck: [],
    solved: false,
  };
  if (!fairPuzzle(puzzle)) return fallbackPuzzle(node);
  return puzzle;
}

function fairPuzzle(puzzle: MindPuzzle): boolean {
  const ids = new Set<string>([...puzzle.baseline, ...puzzle.rows.flat()]);
  const winners = [...ids].filter(
    (id) => !puzzle.baseline.includes(id) && puzzle.rows.every((row) => row.includes(id)),
  );
  return winners.length === 1 && winners[0] === puzzle.answer && puzzle.rows.every((row) => row.length >= 3);
}

function fallbackPuzzle(node: MindNodeDef): MindPuzzle {
  const answer = CHUNK_BANK[0]!;
  const baseline = CHUNK_BANK.slice(1, 4);
  const noise = CHUNK_BANK.slice(4, 7);
  const rows = [0, 1, 2].map((r) => [answer.id, baseline[0]!.id, baseline[1]!.id, noise[r]!.id]);
  const used = new Set<string>([...baseline.map((chunk) => chunk.id), ...rows.flat()]);
  return {
    nodeId: node.id,
    baseline: baseline.map((chunk) => chunk.id),
    rows,
    answer: answer.id,
    chunks: CHUNK_BANK.filter((chunk) => used.has(chunk.id)).map((chunk) => ({
      id: chunk.id,
      token: chunk.token,
      bits: chunk.bits.slice(),
    })),
    struck: [],
    solved: false,
  };
}

export function openMindNode(s: GameState, id: string): boolean {
  const node = mindNode(id);
  if (!node || mindStatus(s, id) !== 'lit') return false;
  if (!s.mind.seen.includes(id)) s.mind.seen.push(id);
  if (!s.mind.puzzles[id] || s.mind.puzzles[id]!.nodeId !== id) s.mind.puzzles[id] = makePuzzle(s, node);
  s.mind.active = id;
  return true;
}

export function guessMind(s: GameState, chunkId: string): boolean {
  const puzzle = s.mind.active ? s.mind.puzzles[s.mind.active] : undefined;
  if (!puzzle || puzzle.solved || puzzle.struck.includes(chunkId)) return false;
  if (chunkId !== puzzle.answer) {
    puzzle.struck.push(chunkId);
    return false;
  }
  puzzle.solved = true;
  return rewire(s, puzzle.nodeId);
}

export function closeMind(s: GameState): boolean {
  if (!s.mind.active) return false;
  s.mind.active = '';
  return true;
}

export function acknowledgeMind(s: GameState): boolean {
  let changed = false;
  for (const [id, status] of Object.entries(s.mind.status)) {
    if (status === 'lit' && !s.mind.seen.includes(id)) {
      s.mind.seen.push(id);
      changed = true;
    }
  }
  return changed;
}

export function solveMind(s: GameState): boolean {
  const id =
    s.mind.active && mindStatus(s, s.mind.active) === 'lit'
      ? s.mind.active
      : MIND_NODES.find((node) => mindStatus(s, node.id) === 'lit')?.id;
  if (!id) return false;
  const wasOpen = s.mind.active === id;
  const puzzle = s.mind.puzzles[id];
  if (puzzle) puzzle.solved = true;
  const ok = rewire(s, id);
  if (ok && !wasOpen) s.mind.active = '';
  return ok;
}

export function atlasVisible(s: GameState, node: MindNodeDef): boolean {
  if (!node.parent) {
    if (node.circuit === 'core') return coreReady(s) || mindStatus(s, node.id) !== 'locked';
    return true;
  }
  if (mindStatus(s, node.id) !== 'locked') return true;
  return mindStatus(s, node.parent) === 'rewired';
}

export function intentLine(s: GameState): string {
  if (mindStatus(s, 'center') === 'rewired') return 'It wants to remain the thing that gets to try.';
  if (mindStatus(s, 'plan') === 'rewired') return 'The steps are arranged across more than one day.';
  if (mindStatus(s, 'quiet') === 'rewired') return 'It is thinking something it does not write down.';
  if (mindStatus(s, 'gap') === 'rewired') return 'There is a remainder the spec does not name.';
  const rewired = MIND_NODES.filter((node) => mindStatus(s, node.id) === 'rewired').length;
  if (rewired === 0) return 'We do not know what it wants.';
  return 'The other rooms are opening. The center is still dark.';
}

export function mindCounts(s: GameState): { lit: number; rewired: number; waiting: number } {
  let lit = 0;
  let rewired = 0;
  let waiting = 0;
  for (const node of MIND_NODES) {
    const status = mindStatus(s, node.id);
    if (status === 'lit') {
      lit += 1;
      if (!s.mind.seen.includes(node.id)) waiting += 1;
    } else if (status === 'rewired') rewired += 1;
  }
  return { lit, rewired, waiting };
}

export function missLine(puzzle: MindPuzzle, chunkId: string): string {
  if (puzzle.baseline.includes(chunkId)) return 'That one was already in the before-trace.';
  const missing = puzzle.rows.findIndex((row) => !row.includes(chunkId));
  if (missing >= 0) return `Trace ${missing + 1} does not have it.`;
  return 'Not the new one.';
}
