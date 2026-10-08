import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { GameState, newGame, replaceState } from '../engine/state.js';
import { actions, tick, step, TICK_MS, Actions } from '../engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from '../sim/policy.js';
import { loadSave, createSaver, Saver } from './save.js';

type Rest<T> = T extends (s: GameState, ...rest: infer R) => unknown ? R : never;
export type Perform = <K extends keyof Actions>(name: K, ...args: Rest<Actions[K]>) => boolean;

export interface GameStore {
  game: GameState;
  frame: number;
  epoch: number;
  toasts: number;
  speed: number;
  autoplay: boolean;
  saver: Saver;
  perform: Perform;
  advance: (dtMs: number) => void;
  touch: () => void;
  load: (next: GameState) => void;
  restart: () => void;
  setSpeed: (n: number) => void;
  setAutoplay: (on: boolean, which?: PolicyName, holdTransition?: boolean, variant?: string) => void;
}

export function seedParam(): number | null {
  const param = new URLSearchParams(location.search).get('seed');
  return param !== null && Number.isFinite(Number(param)) ? Number(param) : null;
}

export const useGameStore = create<GameStore>()((set, get) => {
  const game: GameState = loadSave() ?? newGame(seedParam() ?? Date.now());
  const saver = createSaver(game, () => set((st) => ({ toasts: st.toasts + 1 })));
  let policy: PolicyName = 'bot';
  let bot = newBotMemory(policy);

  const touch = () => set((st) => ({ frame: st.frame + 1 }));

  return {
    game,
    frame: 0,
    epoch: 0,
    toasts: 0,
    speed: new URLSearchParams(location.search).get('speed') === '0' ? 0 : 1,
    autoplay: false,
    saver,
    perform: ((name: keyof Actions, ...args: unknown[]) => {
      const fn = actions[name] as (s: GameState, ...rest: unknown[]) => boolean;
      const changed = fn(game, ...args);
      if (changed) saver.markDirty();
      flushSync(touch);
      return changed;
    }) as Perform,
    advance: (dtMs) => {
      if (!get().autoplay || game.ending) {
        tick(game, dtMs);
        return;
      }
      game.tickAccum += dtMs;
      while (game.tickAccum >= TICK_MS && !game.ending) {
        game.tickAccum -= TICK_MS;
        policyStep(game, actions, bot);
        step(game);
      }
    },
    touch,
    load: (next) => {
      replaceState(game, next);
      saver.saveNow();
      set((st) => ({ epoch: st.epoch + 1, frame: st.frame + 1 }));
    },
    restart: () => {
      saver.clear();
      bot = newBotMemory(policy);
      set({ autoplay: false });
      get().load(newGame(Date.now()));
    },
    setSpeed: (n) => set({ speed: n }),
    setAutoplay: (on, which, holdTransition, variant) => {
      if (which) policy = which;
      bot = newBotMemory(policy, holdTransition === true, variant ?? '');
      set({ autoplay: on });
    },
  };
});

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    if (!same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export function useGame<T>(view: (s: GameState) => T): T {
  const last = useRef<{ value: T } | null>(null);
  return useGameStore((st) => {
    const next = view(st.game);
    if (last.current && same(last.current.value, next)) return last.current.value;
    last.current = { value: next };
    return next;
  });
}

export const getGame = (): GameState => useGameStore.getState().game;
export const perform: Perform = (name, ...args) => useGameStore.getState().perform(name, ...args);
