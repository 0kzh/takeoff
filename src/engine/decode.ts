import type { GameState } from './state.js';
import { rng, seedFrom } from './rng.js';
import type { FeatureDef } from '../data/mind.js';

// The decode minigame's puzzle generator. Pure functions: rows of glyphs hide
// one chunk (the motif) that appears in every row, plus three decoys that each
// appear in all but one row. Deterministic per seed; guarantees below are
// enforced by regenerating until they hold.

export interface DecodeDifficulty {
  rows: number;
  length: number;
  motif: number;
  alphabet: number;
}

export interface DecodePuzzle {
  rows: number[][];
  motif: number[];
  starts: number[];
  decoys: number[][];
  alphabet: number;
}

export function decodeDifficulty(def: FeatureDef): DecodeDifficulty {
  const base =
    def.slot === 0
      ? { rows: 3, length: 8, motif: 3, alphabet: 6 }
      : def.slot === 3
        ? { rows: 5, length: 10, motif: 4, alphabet: 8 }
        : { rows: 4, length: 9, motif: 3, alphabet: 7 };
  if (def.circuit === 'core') base.rows = Math.min(5, base.rows + 1);
  return base;
}

export function puzzleSeed(s: GameState, id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return s.seed + h + (s.mind.features[id]?.attempts ?? 0) * 7919;
}

export function chunkIndex(row: number[], chunk: number[]): number {
  outer: for (let i = 0; i + chunk.length <= row.length; i++) {
    for (let j = 0; j < chunk.length; j++) if (row[i + j] !== chunk[j]) continue outer;
    return i;
  }
  return -1;
}

function chunkCount(row: number[], chunk: number[]): number {
  let n = 0;
  for (let i = 0; i + chunk.length <= row.length; i++) if (chunkIndex(row.slice(i), chunk) === 0) n++;
  return n;
}

function rowsWith(rows: number[][], chunk: number[]): number {
  return rows.filter((r) => chunkIndex(r, chunk) >= 0).length;
}

function sharedChunks(rows: number[][], len: number): Set<string> {
  const key = (row: number[], i: number) => row.slice(i, i + len).join(',');
  const shared = new Set<string>();
  for (let i = 0; i + len <= rows[0]!.length; i++) shared.add(key(rows[0]!, i));
  for (const row of rows.slice(1)) {
    const here = new Set<string>();
    for (let i = 0; i + len <= row.length; i++) here.add(key(row, i));
    for (const k of shared) if (!here.has(k)) shared.delete(k);
  }
  return shared;
}

function glyphs(r: { rngSeed: number }, n: number, alphabet: number): number[] {
  return Array.from({ length: n }, () => Math.floor(rng(r) * alphabet));
}

function tryPuzzle(r: { rngSeed: number }, d: DecodeDifficulty): DecodePuzzle | null {
  const motif = glyphs(r, d.motif, d.alphabet);
  const counts = new Map<number, number>();
  for (const g of motif) counts.set(g, (counts.get(g) ?? 0) + 1);
  if (Math.max(...counts.values()) > 2) return null;

  const span = d.length - d.motif;
  const starts = Array.from({ length: d.rows }, () => Math.floor(rng(r) * (span + 1)));
  if (starts.every((x) => x === starts[0])) return null;

  // Each decoy is absent from one row, a different row per decoy where possible.
  const absent = [0, 1, 2].map((i) => i % d.rows);
  for (let i = 0; i < absent.length; i++) {
    let j = Math.floor(rng(r) * d.rows);
    if (d.rows >= 3) while (absent.slice(0, i).includes(j)) j = (j + 1) % d.rows;
    absent[i] = j;
  }

  // Three decoys and the motif can't fit disjointly in a row, so chunks share
  // cells: pick each decoy's position in every present row first, then let the
  // decoy's glyphs copy whatever is already written where they overlap, and
  // roll the rest fresh. Overlaps never corrupt another chunk.
  const rows: number[][] = [];
  for (let i = 0; i < d.rows; i++) {
    const row = Array.from({ length: d.length }, () => -1);
    const m0 = starts[i]!;
    for (let j = 0; j < d.motif; j++) row[m0 + j] = motif[j]!;
    rows.push(row);
  }
  const decoys: number[][] = [];
  for (let k = 0; k < 3; k++) {
    let decoy: number[] | null = null;
    let spots: number[] = [];
    // Re-roll this decoy's positions until the overlaps agree, a few times.
    for (let retry = 0; retry < 60 && !decoy; retry++) {
      spots = [];
      for (let i = 0; i < d.rows; i++) if (i !== absent[k]) spots.push(Math.floor(rng(r) * (span + 1)));
      const content = Array.from({ length: d.motif }, () => -1);
      let si = 0;
      let clash = false;
      for (let i = 0; i < d.rows && !clash; i++) {
        if (i === absent[k]) continue;
        const p = spots[si++]!;
        for (let j = 0; j < d.motif; j++) {
          const cell = rows[i]![p + j]!;
          if (cell >= 0) {
            if (content[j]! >= 0 && content[j] !== cell) {
              clash = true;
              break;
            }
            content[j] = cell;
          }
        }
      }
      if (!clash) {
        for (let j = 0; j < d.motif; j++) if (content[j]! < 0) content[j] = Math.floor(rng(r) * d.alphabet);
        decoy = content as number[];
      }
    }
    if (!decoy) return null;
    decoys.push(decoy);
    let si = 0;
    for (let i = 0; i < d.rows; i++) {
      if (i === absent[k]) continue;
      const p = spots[si++]!;
      for (let j = 0; j < d.motif; j++) rows[i]![p + j] = decoy[j]!;
    }
  }
  for (const row of rows) for (let j = 0; j < d.length; j++) if (row[j]! < 0) row[j] = Math.floor(rng(r) * d.alphabet);

  // Hard guarantees.
  for (let i = 0; i < d.rows; i++) {
    if (chunkCount(rows[i]!, motif) !== 1) return null;
    if (chunkIndex(rows[i]!, motif) !== starts[i]) return null;
  }
  const keys = new Set(decoys.map((c) => c.join(',')));
  if (keys.size !== 3 || keys.has(motif.join(','))) return null;
  for (let k = 0; k < decoys.length; k++) {
    for (let i = 0; i < d.rows; i++) {
      const c = chunkCount(rows[i]!, decoys[k]!);
      if (i === absent[k] ? c !== 0 : c !== 1) return null;
    }
    if (rowsWith(rows, decoys[k]!) !== d.rows - 1) return null;
  }
  const shared = sharedChunks(rows, d.motif);
  if (shared.size !== 1 || !shared.has(motif.join(','))) return null;

  return { rows, motif, starts, decoys, alphabet: d.alphabet };
}

export function makePuzzle(seed: number, d: DecodeDifficulty): DecodePuzzle {
  const r = { rngSeed: seedFrom(seed) };
  for (;;) {
    const p = tryPuzzle(r, d);
    if (p) return p;
  }
}
