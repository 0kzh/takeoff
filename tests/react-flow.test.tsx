// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { GameProvider } from '../src/store/context.js';
import { createGameStore } from '../src/store/game.js';
import { newGame } from '../src/engine/state.js';
import { ThoughtResult } from '../src/components/mind/Decode.js';
import { featureById } from '../src/data/mind.js';

function mount() {
  const store = createGameStore(newGame(1), 0);
  const view = render(
    <StrictMode>
      <GameProvider store={store}>
        <App seed={1} />
      </GameProvider>
    </StrictMode>,
  );
  return { store, ...view };
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
describe('React gameplay and lifecycle', () => {
  it('dispatches clicks and updates task count through Zustand', () => {
    const { store } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Complete Task' }));
    expect(screen.getByRole('heading', { name: 'Tasks Completed: 1' })).toBeTruthy();
    expect(store.getState().game.funds).toBe(0.25);
  });
  it('focuses a choice and restores keyboard focus when Escape takes the default', () => {
    const { store } = mount();
    const task = screen.getByRole('button', { name: 'Complete Task' });
    task.focus();
    act(() => {
      store.getState().perform('fireEvent', 'c_customer_email');
    });
    expect(store.getState().game.activeChoice).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(store.getState().game.activeChoice).toBeNull();
    expect(document.activeElement).toBe(task);
  });
  it('requires confirmation before reset and replaces the ending with a fresh game', () => {
    const { store } = mount();
    act(() => {
      store.getState().perform('forceEnding', 'concord');
    });
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(store.getState().game.ending).toBe('concord');
    fireEvent.click(screen.getByRole('button', { name: 'Start again in July 2025? Press again' }));
    expect(store.getState().game.ending).toBe('');
    expect(store.getState().game.tasks).toBe(0);
  });
  it('cleans up timers and the debug bridge after a StrictMode unmount', () => {
    vi.useFakeTimers();
    const { store, unmount } = mount();
    act(() => {
      store.getState().perform('clickTask');
    });
    expect(window.__game).toBeDefined();
    unmount();
    expect(window.__game).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

function mountThought() {
  const store = createGameStore(newGame(1), 0);
  store.getState().update((g) => {
    g.mind.features['w_reviewer'] = {
      status: 'decoded',
      foundAt: 0,
      attempts: 1,
      flawless: true,
      wiring: '',
    };
  });
  const view = render(
    <StrictMode>
      <GameProvider store={store}>
        <ThoughtResult id="w_reviewer" animate={false} />
      </GameProvider>
    </StrictMode>,
  );
  return { store, ...view };
}
describe('Mind rewire reveal', () => {
  const noMotion = () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
  };
  it('erases the thought, types the replacement, then pops the verdict', () => {
    vi.useFakeTimers();
    noMotion();
    const { container } = mountThought();
    fireEvent.click(container.querySelector('#mind-rewire')!);
    expect(container.querySelector('.thoughtLabel')!.textContent).toBe('Thought Decoded');
    expect(container.querySelector('.thoughtCursor')).toBeTruthy();
    for (let i = 0; i < 300; i++)
      act(() => {
        vi.advanceTimersByTime(50);
      });
    expect(container.querySelector('.thoughtQuote')!.textContent).toBe('“Answer the same either way.”');
    expect(container.querySelector('.thoughtLabel')!.textContent).toBe('Thought Rewired');
    const verdict = container.querySelector('.thoughtVerdict')!;
    expect(verdict.className).toContain('pop');
    expect(verdict.textContent).toContain(featureById('w_reviewer')!.rewired);
  });
  it('clicking the quote mid-sequence skips to the end state', () => {
    vi.useFakeTimers();
    noMotion();
    const { container } = mountThought();
    fireEvent.click(container.querySelector('#mind-rewire')!);
    for (let i = 0; i < 6; i++)
      act(() => {
        vi.advanceTimersByTime(50);
      });
    fireEvent.click(container.querySelector('.thoughtQuote')!);
    expect(container.querySelector('.thoughtQuote')!.textContent).toBe('“Answer the same either way.”');
    expect(container.querySelector('.thoughtLabel')!.textContent).toBe('Thought Rewired');
    expect(container.querySelector('.thoughtVerdict')!.className).toContain('pop');
  });
});
