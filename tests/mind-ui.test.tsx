// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import { presetFor } from '../src/data/presets.js';
import { GameProvider } from '../src/store/context.js';
import { createGameStore } from '../src/store/game.js';

function mount() {
  const store = createGameStore(presetFor(2).build(2), 0);
  const view = render(
    <StrictMode>
      <GameProvider store={store}>
        <App seed={2} />
      </GameProvider>
    </StrictMode>,
  );
  return { store, ...view };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Mind map and decode', () => {
  it('decodes a lit circuit and switches tree and puzzle skins', () => {
    const { store } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }));
    const map = document.getElementById('mindMap');
    expect(map?.dataset['skin']).toBe('branches');
    expect(map?.querySelectorAll('.mindNode.locked').length).toBe(16);

    act(() => {
      store.getState().setMindChrome('atlas');
    });
    expect(document.getElementById('mindMap')?.dataset['skin']).toBe('atlas');
    expect(document.querySelectorAll('#mindMap .mindNode').length).toBe(3);

    act(() => {
      store.getState().setMindChrome('plague', 'tape');
    });
    expect(document.getElementById('mindMap')?.dataset['skin']).toBe('plague');
    expect(screen.getByRole('button', { name: 'The Gap, locked' })).toBeTruthy();

    act(() => {
      store.getState().setMindChrome('branches', 'tiles');
      store.getState().perform('lightMind');
    });
    const lit = document.querySelector('#mindMap .mindNode.lit');
    expect(lit).toBeTruthy();
    fireEvent.click(lit!);
    const decode = document.getElementById('mindDecode');
    expect(decode?.dataset['skin']).toBe('tiles');
    const active = store.getState().game.mind.active;
    const puzzle = store.getState().game.mind.puzzles[active]!;
    const wrong = puzzle.chunks.find((chunk) => chunk.id !== puzzle.answer)!;
    fireEvent.click(screen.getAllByRole('button', { name: `fragment ${wrong.token}` })[0]!);
    expect(screen.getByText(/does not have it|already in the before-trace/)).toBeTruthy();
    const answer = puzzle.chunks.find((chunk) => chunk.id === puzzle.answer)!;
    fireEvent.click(screen.getAllByRole('button', { name: `fragment ${answer.token}` })[0]!);
    expect(screen.getByText(/The band is now/)).toBeTruthy();
    expect(store.getState().game.mind.narrowed).toBeGreaterThan(0);

    act(() => {
      store.getState().setMindChrome('branches', 'stack');
    });
    expect(document.getElementById('mindDecode')?.dataset['skin']).toBe('stack');
    fireEvent.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(document.getElementById('mindDecode')).toBeNull();
    expect(document.querySelector('#mindMap .mindNode.rewired')).toBeTruthy();
  });
});
