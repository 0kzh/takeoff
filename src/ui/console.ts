import type { GameState } from '../engine/state.js';
import { CONSOLE_LINES } from '../engine/state.js';
import { setText } from './dom.js';

export function renderConsole(s: GameState): void {
  const lines = s.console;
  for (let i = 0; i < CONSOLE_LINES; i++) {
    setText(`readout${i + 1}`, lines[lines.length - 1 - i] ?? '');
  }
}
