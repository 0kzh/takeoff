import { describe, expect, it } from 'vitest';
import { MIND_NODES, mindNode } from '../src/data/mind.js';
import { actions, step } from '../src/engine/tick.js';
import {
  coreReady,
  forceLight,
  lightMind,
  makePuzzle,
  mindStatus,
  pingMindDuringRun,
  puzzleIsFair,
} from '../src/engine/mind.js';
import { deserialize, newGame, SAVE_VERSION, serialize } from '../src/engine/state.js';
import { presetFor } from '../src/data/presets.js';

function arrival(seed = 1) {
  return presetFor(2).build(seed);
}

describe('Sage mind', () => {
  it('opens the map on entering Stage 2 and keeps it on older saves', () => {
    const s = arrival();
    expect(s.revealed['mind']).toBe(true);
    expect(s.mind.notice).toBe('');
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    raw['version'] = 15;
    delete raw['mind'];
    const revealed = raw['revealed'] as Record<string, boolean>;
    delete revealed['mind'];
    const migrated = deserialize(JSON.stringify(raw));
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect(migrated!.revealed['mind']).toBe(true);
    expect(migrated!.mind.pinged).toEqual([]);
  });

  it('lights one root during a run and keeps that roll off the game random stream', () => {
    const quiet = arrival(4);
    const rngBefore = quiet.rngSeed;
    pingMindDuringRun(quiet, { id: 3, name: 'Sage-2.0', focus: 'safety' });
    expect(quiet.rngSeed).toBe(rngBefore);
    expect(MIND_NODES.filter((node) => mindStatus(quiet, node.id) === 'lit')).toHaveLength(1);

    const s = arrival();
    s.funds = 1e9;
    s.research = 1e6;
    expect(actions.startTraining(s)).toBe(true);
    const run = s.training.run!;
    run.duration = 100;
    run.elapsed = 80;
    step(s);
    const lit = MIND_NODES.filter((node) => mindStatus(s, node.id) === 'lit');
    expect(lit).toHaveLength(1);
    expect(lit[0]!.parent).toBeNull();
    expect(lit[0]!.circuit).not.toBe('core');
    expect(s.mind.pinged).toContain(run.id);
    run.elapsed = 100;
    step(s);
    expect(MIND_NODES.filter((node) => mindStatus(s, node.id) === 'lit')).toHaveLength(1);
  });

  it('will not light a child or the core until the parent circuit is rewired', () => {
    const s = arrival();
    expect(lightMind(s)).toBe(true);
    expect(lightMind(s)).toBe(true);
    expect(lightMind(s)).toBe(true);
    expect(lightMind(s)).toBe(false);
    expect(coreReady(s)).toBe(false);
    for (const node of MIND_NODES) {
      if (mindStatus(s, node.id) === 'lit') expect(node.parent).toBeNull();
    }
    const before = s.alignmentBand;
    expect(actions.solveMind(s)).toBe(true);
    expect(s.alignmentBand).toBe(before - 1);
    expect(s.mind.narrowed).toBe(1);
    expect(s.revealed['interpretability']).toBe(true);
    expect(lightMind(s)).toBe(true);
    const child = MIND_NODES.find((node) => mindStatus(s, node.id) === 'lit');
    expect(child?.parent).not.toBeNull();
  });

  it('decodes the fragment that was added to every trace and not the before-trace', () => {
    const s = arrival();
    lightMind(s);
    const id = MIND_NODES.find((node) => mindStatus(s, node.id) === 'lit')!.id;
    expect(actions.openMindNode(s, id)).toBe(true);
    const puzzle = s.mind.puzzles[id]!;
    expect(puzzleIsFair(puzzle)).toBe(true);
    const wrong = puzzle.chunks.find((chunk) => chunk.id !== puzzle.answer)!.id;
    expect(actions.guessMind(s, wrong)).toBe(false);
    expect(mindStatus(s, id)).toBe('lit');
    expect(puzzle.struck).toContain(wrong);
    expect(actions.guessMind(s, puzzle.answer)).toBe(true);
    expect(mindStatus(s, id)).toBe('rewired');
    expect(puzzle.solved).toBe(true);
    expect(s.console.some((line) => line.includes(mindNode(id)!.insight.slice(0, 24)))).toBe(true);
  });

  it('builds a fair puzzle for every circuit and does not advance the game rng', () => {
    for (const node of MIND_NODES) {
      for (let seed = 1; seed <= 6; seed++) {
        const s = newGame(seed);
        const rngBefore = s.rngSeed;
        const puzzle = makePuzzle(s, node);
        expect(puzzleIsFair(puzzle)).toBe(true);
        expect(s.rngSeed).toBe(rngBefore);
        expect(puzzle.rows.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('lets the sparse autoencoder name The Glance', () => {
    const s = arrival();
    expect(forceLight(s, 'glance')).toBe(true);
    expect(mindStatus(s, 'glance')).toBe('lit');
    expect(s.mind.notice).toContain('being watched');
    expect(forceLight(s, 'glance')).toBe(false);
  });

  it('keeps the core dark until each other circuit has been rewired', () => {
    const s = arrival();
    const roots = ['glance', 'nod', 'name'];
    for (const id of roots) {
      s.mind.status[id] = 'lit';
      s.mind.active = id;
      expect(actions.solveMind(s)).toBe(true);
    }
    expect(coreReady(s)).toBe(true);
    expect(lightMind(s)).toBe(true);
    expect(mindStatus(s, 'gap')).toBe('lit');
  });
});
