import { presetFor } from '../data/presets.js';

export function gameFromPreset(stage: number, seed: number) {
  const preset = presetFor(stage);
  const game = preset.build(seed);
  if (!preset.ready || preset.stage !== stage) {
    game.consoleQueue.push({ delay: 0.1, text: `Stage ${stage} preset pending. Loaded the Stage 2 preset.` });
  }
  return game;
}
