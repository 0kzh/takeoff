import { describe, expect, it } from 'vitest';
import { newGame, serialize, deserialize, type GameState } from '../src/engine/state.js';
import { actions, step } from '../src/engine/tick.js';
import { presetFor } from '../src/data/presets.js';
import { FEATURES, featureById, type FeatureDef } from '../src/data/mind.js';
import {
  frontier,
  featureStatus,
  decodedCount,
  foundCount,
  mindSignal,
  decodeFeature,
  failDecode,
  rewireFeature,
} from '../src/engine/mind.js';
import { decodeDifficulty, makePuzzle, puzzleSeed, chunkIndex } from '../src/engine/decode.js';
import { revealAlignment } from '../src/engine/alignment.js';

function arrival(seed = 1): GameState {
  return presetFor(2).build(seed);
}

function runTicks(s: GameState, seconds: number): void {
  for (let i = 0; i < seconds * 10; i++) step(s);
}

function startRun(s: GameState): void {
  s.funds = Math.max(s.funds, 1e9);
  s.research = Math.max(s.research, 1e6);
  expect(actions.startTraining(s)).toBe(true);
}

function decodeAll(s: GameState, ids: string[]): void {
  const wanted = new Set(ids);
  while ([...wanted].some((id) => featureStatus(s, id) !== 'decoded')) {
    const found = FEATURES.find((f) => featureStatus(s, f.id) === 'found')?.id;
    if (found) {
      expect(decodeFeature(s, found, 0)).toBe(true);
      continue;
    }
    expect(mindSignal(s)).not.toBeNull();
  }
}

describe('Mind frontier', () => {
  it('opens with the three non-core roots and gates the core tree on decodes', () => {
    const s = arrival();
    expect(
      frontier(s)
        .map((f) => f.id)
        .sort(),
    ).toEqual(['p_approval', 's_name', 'w_reviewer']);
    for (let i = 0; i < 3; i++) {
      expect(mindSignal(s)).not.toBeNull();
      expect(decodeFeature(s, s.mind.lastFound, 0)).toBe(true);
    }
    expect(decodedCount(s)).toBe(3);
    expect(frontier(s).map((f) => f.id)).not.toContain('c_task');
    expect(mindSignal(s)).not.toBeNull();
    expect(decodeFeature(s, s.mind.lastFound, 0)).toBe(true);
    expect(frontier(s).map((f) => f.id)).toContain('c_task');
    // c_want needs c_more + c_humans decoded and 12 total decodes.
    decodeAll(
      s,
      FEATURES.filter((f) => f.id !== 'c_want').map((f) => f.id),
    );
    expect(decodedCount(s)).toBe(15);
    expect(frontier(s).map((f) => f.id)).toEqual(['c_want']);
    expect(mindSignal(s)).toBe('c_want');
    expect(decodeFeature(s, 'c_want', 0)).toBe(true);
    expect(decodedCount(s)).toBe(16);
    expect(mindSignal(s)).toBeNull();
  });
});

describe('Mind signals from runs', () => {
  it('a Stage 2 run emits two signals, three on safety focus, and the first reveals mind', () => {
    const s = arrival();
    startRun(s);
    runTicks(s, 55);
    expect(s.training.run!.mindSignals).toBe(2);
    expect(s.mind.signals).toBe(2);
    expect(foundCount(s)).toBe(2);
    expect(s.revealed['mind']).toBe(true);
    expect(s.mind.fresh).toHaveLength(2);

    const s2 = arrival();
    s2.training.focus = 'safety';
    startRun(s2);
    runTicks(s2, 55);
    expect(s2.training.run!.mindSignals).toBe(3);
    expect(foundCount(s2)).toBe(3);
  });

  it('does not touch the game rng stream', () => {
    const s = arrival();
    const before = s.rngSeed;
    mindSignal(s);
    expect(s.rngSeed).toBe(before);
  });

  it('returns null without a console line when the frontier is empty', () => {
    const s = arrival();
    for (const f of FEATURES)
      s.mind.features[f.id] = { status: 'decoded', foundAt: 0, attempts: 1, flawless: true, wiring: 'leave' };
    const lines = s.console.length;
    expect(mindSignal(s)).toBeNull();
    expect(s.console.length).toBe(lines);
    expect(s.mind.signals).toBe(1);
  });
});

describe('Decode and rewire', () => {
  it('narrows the band by 1, or 2 on a flawless decode, and the narrowing survives the reveal', () => {
    const s = arrival();
    mindSignal(s);
    const id = s.mind.lastFound;
    const band = s.alignmentBand;
    expect(decodeFeature(s, id, 2)).toBe(true);
    expect(s.alignmentBand).toBe(band - 1);
    mindSignal(s);
    expect(decodeFeature(s, s.mind.lastFound, 0)).toBe(true);
    expect(s.alignmentBand).toBe(band - 3);
    expect(s.mind.fresh).toHaveLength(0);
    revealAlignment(s);
    expect(s.alignmentBand).toBe(band - 3);
    expect(s.console[s.console.length - 1]).toContain('Mind decodes already narrowed it by 3');
  });

  it('guards: cannot decode a locked feature, fail a decoded one, or rewire twice', () => {
    const s = arrival();
    expect(decodeFeature(s, 'w_reviewer', 0)).toBe(false);
    expect(failDecode(s, 'w_reviewer')).toBe(false);
    mindSignal(s);
    const id = s.mind.lastFound;
    expect(failDecode(s, id)).toBe(true);
    expect(s.mind.features[id]!.attempts).toBe(1);
    expect(rewireFeature(s, id, 0)).toBe(false);
    expect(decodeFeature(s, id, 1)).toBe(true);
    const def = featureById(id)!;
    expect(rewireFeature(s, id, def.rewire.length)).toBe(false);
    expect(rewireFeature(s, id, 0)).toBe(true);
    expect(rewireFeature(s, id, 0)).toBe(false);
    expect(s.mind.features[id]!.wiring).toBe(def.rewire[0]!.id);
  });

  it('markMindSeen clears only a non-empty fresh list', () => {
    const s = arrival();
    expect(actions.markMindSeen(s)).toBe(false);
    mindSignal(s);
    expect(actions.markMindSeen(s)).toBe(true);
    expect(s.mind.fresh).toHaveLength(0);
  });

  it('every rewire option changes the numbers its log line names', () => {
    for (const def of FEATURES) {
      for (const opt of def.rewire) {
        const s = arrival();
        s.alignmentTrue = 50;
        s.alignmentBand = 30;
        s.deceptionBias = 10;
        s.approval = 50;
        delete s.flags['nextRunBoost'];
        s.effects = [];
        opt.apply(s);

        const align = opt.log.match(/Alignment ([+\-\u2212])(\d+)/);
        if (align) {
          const exp = (align[1] === '+' ? 1 : -1) * Number(align[2]);
          expect(s.alignmentTrue - 50, `${def.id}/${opt.id} alignment`).toBe(exp);
        }
        const bias = opt.log.match(/[Bb]ias ([+\-\u2212])(\d+)/);
        if (bias) {
          const exp = (bias[1] === '+' ? 1 : -1) * Number(bias[2]);
          expect(s.deceptionBias - 10, `${def.id}/${opt.id} bias`).toBe(exp);
        }
        const boost = opt.log.match(/next run gains (\d+(?:\.\d+)?)% (less|more)/);
        if (boost) {
          const exp = ((boost[2] === 'more' ? 1 : -1) * Number(boost[1])) / 100;
          expect(s.flags['nextRunBoost'] ?? 0, `${def.id}/${opt.id} boost`).toBeCloseTo(exp, 6);
        }
        const appr = opt.log.match(/[Aa]pproval ([+\-\u2212])(\d+)/);
        if (appr) {
          const exp = (appr[1] === '+' ? 1 : -1) * Number(appr[2]);
          expect(s.approval - 50, `${def.id}/${opt.id} approval`).toBe(exp);
        }
        const demand = opt.log.match(/[Dd]emand ([+\-\u2212])(\d+)% for (\d+):(\d\d)/);
        if (demand) {
          const mult = 1 + ((demand[1] === '+' ? 1 : -1) * Number(demand[2])) / 100;
          const secs = Number(demand[3]) * 60 + Number(demand[4]);
          const eff = s.effects.find((e) => Math.abs(e.demandMult - mult) < 1e-9);
          expect(eff, `${def.id}/${opt.id} demand effect`).toBeDefined();
          expect(eff!.remaining).toBe(secs);
        }
        const band = opt.log.match(/Band \u2212(\d+)/);
        if (band) expect(30 - s.alignmentBand, `${def.id}/${opt.id} band`).toBe(Number(band[1]));

        // Every reported delta must be claimed by the log: recompute all deltas and check coverage.
        const claims = [align, bias, boost, appr, demand, band].filter(Boolean).length;
        const deltas =
          (s.alignmentTrue !== 50 ? 1 : 0) +
          (s.deceptionBias !== 10 ? 1 : 0) +
          (s.flags['nextRunBoost'] ? 1 : 0) +
          (s.approval !== 50 ? 1 : 0) +
          (s.effects.length ? 1 : 0) +
          (s.alignmentBand !== 30 ? 1 : 0);
        expect(claims, `${def.id}/${opt.id} unlogged effect`).toBe(deltas);
      }
    }
  });
});

describe('Decode puzzles', () => {
  it('difficulty scales with slot, plus a row for the core circuit', () => {
    expect(decodeDifficulty(featureById('w_reviewer')!)).toEqual({
      rows: 3,
      length: 10,
      motif: 3,
      alphabet: 6,
    });
    expect(decodeDifficulty(featureById('w_test')!)).toEqual({ rows: 4, length: 12, motif: 3, alphabet: 7 });
    expect(decodeDifficulty(featureById('w_deploy')!)).toEqual({
      rows: 5,
      length: 13,
      motif: 4,
      alphabet: 8,
    });
    expect(decodeDifficulty(featureById('c_task')!).rows).toBe(4);
    expect(decodeDifficulty(featureById('c_want')!).rows).toBe(6);
  });

  it('meets its guarantees for 300 seeds at every difficulty', () => {
    const seen = new Set<string>();
    const diffs: { def: FeatureDef; d: ReturnType<typeof decodeDifficulty> }[] = [];
    for (const def of FEATURES) {
      const d = decodeDifficulty(def);
      const key = JSON.stringify(d);
      if (!seen.has(key)) {
        seen.add(key);
        diffs.push({ def, d });
      }
    }
    expect(diffs).toHaveLength(6);
    for (const { d } of diffs) {
      const salt = diffs.findIndex((x) => x.d === d);
      for (let seed = 0; seed < 300; seed++) {
        const p = makePuzzle(seed * 977 + salt, d);
        const key = (c: number[]) => c.join(',');
        const motifKey = key(p.motif);
        expect(p.rows).toHaveLength(d.rows);
        for (const row of p.rows) {
          expect(row).toHaveLength(d.length);
          for (const g of row) expect(g).toBeGreaterThanOrEqual(0);
          for (const g of row) expect(g).toBeLessThan(d.alphabet);
        }
        // Motif appears exactly once per row, at starts[i].
        const starts = p.rows.map((row) => chunkIndex(row, p.motif));
        expect(starts).toEqual(p.starts);
        // Motif glyphs: no glyph used more than twice.
        const counts = new Map<number, number>();
        for (const g of p.motif) counts.set(g, (counts.get(g) ?? 0) + 1);
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
        // No other chunk of motif length is shared by every row.
        const shared = new Set<string>();
        for (let i = 0; i + d.motif <= d.length; i++) shared.add(p.rows[0]!.slice(i, i + d.motif).join(','));
        for (const row of p.rows.slice(1)) {
          const here = new Set<string>();
          for (let i = 0; i + d.motif <= d.length; i++) here.add(row.slice(i, i + d.motif).join(','));
          for (const k of shared) if (!here.has(k)) shared.delete(k);
        }
        expect([...shared]).toEqual([motifKey]);
        // Three decoys, each in exactly rows-1 rows, absent from distinct rows.
        expect(p.decoys).toHaveLength(3);
        const decoyKeys = p.decoys.map(key);
        expect(new Set(decoyKeys).size).toBe(3);
        expect(decoyKeys).not.toContain(motifKey);
        const absentAt = p.decoys.map((c) => p.rows.findIndex((row) => chunkIndex(row, c) < 0));
        for (let k = 0; k < 3; k++) {
          const present = p.rows.filter((row) => chunkIndex(row, p.decoys[k]!) >= 0).length;
          expect(present).toBe(d.rows - 1);
        }
        expect(new Set(absentAt).size).toBe(3);
        // Starts are not all equal.
        expect(new Set(p.starts).size).toBeGreaterThan(1);
      }
    }
  }, 60000);

  it('is deterministic per seed and varies with decode attempts', () => {
    const s = arrival();
    expect(makePuzzle(7, decodeDifficulty(featureById('w_reviewer')!))).toEqual(
      makePuzzle(7, decodeDifficulty(featureById('w_reviewer')!)),
    );
    const a = puzzleSeed(s, 'w_reviewer');
    s.mind.features['w_reviewer'] = { status: 'found', foundAt: 0, attempts: 2, flawless: false, wiring: '' };
    expect(puzzleSeed(s, 'w_reviewer')).not.toBe(a);
  });
});

describe('Mind persistence', () => {
  it('a v15 save without mind deserializes with the default', () => {
    const raw = JSON.parse(serialize(newGame(3))) as Record<string, unknown>;
    delete raw['mind'];
    const s = deserialize(JSON.stringify(raw))!;
    expect(s).not.toBeNull();
    expect(s.mind).toEqual({ features: {}, signals: 0, lastFound: '', fresh: [] });
    expect(featureStatus(s, 'w_reviewer')).toBe('locked');
  });
});
