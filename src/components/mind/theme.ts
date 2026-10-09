import type { CircuitId } from '../../data/mind.js';

// The game is ink on paper; circuits are told apart by their marks, not hue.
export const CIRCUIT_COLOR: Record<CircuitId, string> = {
  watched: '#000',
  pleasing: '#000',
  self: '#000',
  core: '#000',
};
export const CIRCUIT_MARK: Record<CircuitId, string> = {
  watched: '◉',
  pleasing: '♡',
  self: '◐',
  core: '✦',
};
