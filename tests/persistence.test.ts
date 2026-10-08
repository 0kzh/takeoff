// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameStore } from '../src/store/game.js';
import { newGame, SAVE_KEY } from '../src/engine/state.js';
import { exportSave, importSave, loadSave, startPersistence } from '../src/ui/save.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
describe('save compatibility and persistence lifecycle', () => {
  it('round-trips Unicode console text through the existing save format', () => {
    const game = newGame(42);
    game.console.push('Sage → 安全 ✓');
    expect(importSave(exportSave(game))).toEqual(game);
    expect(importSave('not a save')).toBeNull();
  });
  it('handles blocked or malformed storage without crashing', () => {
    expect(
      loadSave({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBeNull();
    expect(loadSave({ getItem: () => 'invalid json' })).toBeNull();
    const onSaved = vi.fn();
    const saver = startPersistence(createGameStore(newGame(1)), onSaved, {
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(saver.save()).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
    saver.dispose();
  });
  it('keeps playing when access to the localStorage property itself is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadSave()).toBeNull();
    const saver = startPersistence(createGameStore(newGame(1)), vi.fn());
    expect(saver.save()).toBe(false);
    saver.dispose();
  });
  it('coalesces actions, periodically saves ticks, and cleans up all scheduled work', () => {
    vi.useFakeTimers();
    const store = createGameStore(newGame(1));
    const onSaved = vi.fn();
    const persistence = startPersistence(store, onSaved);
    store.getState().perform('clickTask');
    store.getState().perform('clickTask');
    vi.advanceTimersByTime(250);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(loadSave()?.tasks).toBe(2);
    store.getState().advance(1000);
    vi.advanceTimersByTime(14750);
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(loadSave()?.tickCount).toBe(10);
    store.getState().perform('clickTask');
    persistence.dispose();
    vi.advanceTimersByTime(30000);
    window.dispatchEvent(new Event('beforeunload'));
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
