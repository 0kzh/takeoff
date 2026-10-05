import { GameState, newGame, replaceState } from './engine/state.js';
import { confirmPress } from './ui/confirm.js';
import { resetLogCache } from './ui/log.js';
import { actions, tick, step, TICK_MS } from './engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from './sim/policy.js';
import { mount, render, Perform } from './ui/render.js';
import { loadSave, createSaver } from './ui/save.js';
import { mountDev } from './ui/dev.js';

const MAX_FRAME_MS = 250;

const seedParam = new URLSearchParams(location.search).get('seed');
const state: GameState = loadSave() ?? newGame(seedParam !== null && Number.isFinite(Number(seedParam)) ? Number(seedParam) : Date.now());
const saver = createSaver(state);

let speed = new URLSearchParams(location.search).get('speed') === '0' ? 0 : 1;
let autoplay = false;
let policy: PolicyName = 'bot';
let bot = newBotMemory(policy);

function advance(dtMs: number): void {
  if (!autoplay || state.ending) {
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
const newGameButton = document.getElementById('btn-newGame');
if (newGameButton) confirmPress(newGameButton, 'Start again in July 2025? Press again', () => {
  saver.clear();
  replaceState(state, newGame(Date.now()));
  resetLogCache();
  bot = newBotMemory(policy);
  autoplay = false;
  saver.saveNow();
  render(state);
});
mountDev({
  state,
  saver,
  render: () => render(state),
  getSpeed: () => speed,
  setSpeed: (n) => {
    speed = n;
  },
  getAutoplay: () => autoplay,
  setAutoplay: (on, which, holdTransition, variant) => {
    autoplay = on;
    if (which) policy = which;
    bot = newBotMemory(policy, holdTransition === true, variant ?? '');
  },
  advance,
});
render(state);
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
