import { GameState, newGame } from './engine/state.js';
import { actions, tick, step, TICK_MS } from './engine/tick.js';
import { botStep, newBotMemory } from './sim/policy.js';
import { mount, render, Perform } from './ui/render.js';
import { loadSave, createSaver } from './ui/save.js';
import { mountDev } from './ui/dev.js';

/** Real time per frame is clamped so a backgrounded tab does not fast-forward (no offline progress). */
const MAX_FRAME_MS = 250;

const state: GameState = loadSave() ?? newGame(Date.now());
const saver = createSaver(state);

let speed = 1;
let autoplay = false;
let bot = newBotMemory();

function advance(dtMs: number): void {
  if (!autoplay) {
    tick(state, dtMs);
    return;
  }
  state.tickAccum += dtMs;
  while (state.tickAccum >= TICK_MS && !state.ending) {
    state.tickAccum -= TICK_MS;
    botStep(state, actions, bot);
    step(state);
  }
}

const perform = ((name: keyof typeof actions, ...args: unknown[]) => {
  const fn = actions[name] as (s: GameState, ...rest: unknown[]) => boolean;
  const changed = fn(state, ...args);
  if (changed) saver.markDirty();
  render(state);
  return changed;
}) as Perform;

mount(perform);
mountDev({
  state,
  saver,
  render: () => render(state),
  getSpeed: () => speed,
  setSpeed: (n) => {
    speed = n;
  },
  getAutoplay: () => autoplay,
  setAutoplay: (on) => {
    autoplay = on;
    bot = newBotMemory();
  },
  advance,
});
render(state);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - last));
  last = now;
  advance(dt * speed);
  render(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
