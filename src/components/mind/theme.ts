import type { CircuitId } from '../../data/mind.js';

// The game is ink on paper; circuits are not told apart by hue.
export const CIRCUIT_COLOR: Record<CircuitId, string> = {
  watched: '#000',
  pleasing: '#000',
  self: '#000',
  core: '#000',
};
