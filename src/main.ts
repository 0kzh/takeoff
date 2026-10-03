import { GameState, newGame } from './engine/state.js';
import { actions, tick, step, TICK_MS } from './engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from './sim/policy.js';
import { mount, render, Perform } from './ui/render.js';
import { loadSave, createSaver } from './ui/save.js';
import { mountDev } from './ui/dev.js';

/** Real time per frame is clamped so a backgrounded tab does not fast-forward (no offline progress). */
const MAX_FRAME_MS = 250;

/** `?seed=N` starts a reproducible new game when there is no save (playtests, the smoke test). */
const seedParam = new URLSearchParams(location.search).get('seed');
const state: GameState = loadSave() ?? newGame(seedParam !== null && Number.isFinite(Number(seedParam)) ? Number(seedParam) : Date.now());
const saver = createSaver(state);

let speed = 1;
let autoplay = false;
let policy: PolicyName = 'bot';
let bot = newBotMemory(policy);

function advance(dtMs: number): void {
  if (!autoplay) {
    tick(state, dtMs);
    return;
  }
  state.tickAccum += dtMs;
  while (state.tickAccum >= TICK_MS && !state.ending) {
    state.tickAccum -= TICK_MS;
    policyStep(state, actions, bot);
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
  setAutoplay: (on, which, holdTransition) => {
    autoplay = on;
    if (which) policy = which;
    bot = newBotMemory(policy, holdTransition === true);
  },
  advance,
});
render(state);
// Restoring a save shows everything at once; fade-ins are for reveals during play.
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('boot')));

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - last));
  last = now;
  advance(dt * speed);
  render(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
