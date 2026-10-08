import { describe, expect, it } from 'vitest';
import { createGameStore } from '../src/store/game.js';
import { newGame, serialize, deserialize } from '../src/engine/state.js';
import { actions, step, tick } from '../src/engine/tick.js';
import { newBotMemory, policyStep } from '../src/sim/policy.js';
import { presetFor } from '../src/data/presets.js';

describe('game store and deterministic engine', () => {
  it('publishes immutable snapshots without changing the caller-owned initial game', () => {
    const initial = newGame(7);
    const store = createGameStore(initial);
    const before = store.getState().game;
    expect(store.getState().perform('clickTask')).toBe(true);
    expect(store.getState().game.tasks).toBe(1);
    expect(before.tasks).toBe(0);
    expect(initial.tasks).toBe(0);
    expect(Object.isFrozen(before.training)).toBe(true);
    expect(store.getState().game.training).toBe(before.training);
  });

  it('matches direct engine actions and fractional ticks', () => {
    const expected = newGame(11);
    const store = createGameStore(expected);
    for (let i = 0; i < 100; i++) {
      actions.clickTask(expected);
      store.getState().perform('clickTask');
      tick(expected, 63);
      store.getState().advance(63);
    }
    expect(store.getState().perform('rentGpu')).toBe(actions.rentGpu(expected));
    expect(store.getState().perform('startTraining')).toBe(actions.startTraining(expected));
    tick(expected, 10000);
    store.getState().advance(10000);
    expect(serialize(store.getState().game)).toBe(serialize(expected));
  });

  it.each(['bot', 'naive', 'greedy', 'trainfirst'] as const)(
    'matches %s autoplay using the same seed and policy',
    (policy) => {
      const expected = newGame(3);
      const bot = newBotMemory(policy);
      const store = createGameStore(expected);
      store.getState().setAutoplay(true, policy);
      for (let i = 0; i < 1200; i++) {
        policyStep(expected, actions, bot);
        step(expected);
      }
      store.getState().advance(120000);
      expect(serialize(store.getState().game)).toBe(serialize(expected));
    },
  );

  it('keeps simulation ticks separate from action-save notifications', () => {
    const store = createGameStore(newGame(1));
    store.getState().advance(1000);
    expect(store.getState().saveRevision).toBe(0);
    store.getState().perform('clickTask');
    expect(store.getState().saveRevision).toBe(1);
  });

  it('resets autoplay memory when replacing a game', () => {
    const store = createGameStore(newGame(1));
    store.getState().setAutoplay(true, 'bot');
    store.getState().advance(10000);
    store.getState().reset(2);
    expect(store.getState().autoplay).toBe(false);
    const clean = createGameStore(newGame(2));
    store.getState().setAutoplay(true);
    clean.getState().setAutoplay(true);
    store.getState().advance(20000);
    clean.getState().advance(20000);
    expect(serialize(store.getState().game)).toBe(serialize(clean.getState().game));
  });

  it('ignores invalid elapsed time and freezes progression at an ending', () => {
    const store = createGameStore(newGame(4));
    const before = store.getState().game;
    for (const value of [NaN, Infinity, -10, 0]) store.getState().advance(value);
    expect(store.getState().game).toBe(before);
    store.getState().perform('forceEnding', 'concord');
    const ended = store.getState().game;
    store.getState().advance(10000);
    expect(store.getState().game).toBe(ended);
  });

  it('resumes a saved later-stage game identically', () => {
    const original = presetFor(2).build(5);
    tick(original, 1300);
    const saved = deserialize(serialize(original));
    expect(saved).not.toBeNull();
    const restored = createGameStore(saved!);
    tick(original, 2700);
    restored.getState().advance(2700);
    expect(serialize(restored.getState().game)).toBe(serialize(original));
  });
});
