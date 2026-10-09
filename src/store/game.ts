import { createStore } from 'zustand/vanilla';
import { Immer } from 'immer';
import type { MindDecodeSkin, MindTree } from '../engine/mind.js';
import { newGame, type GameState } from '../engine/state.js';
import { actions, step, tick, TICK_MS, type Actions } from '../engine/tick.js';
import { newBotMemory, policyStep, type PolicyName } from '../sim/policy.js';

const TREES: MindTree[] = ['branches', 'plague', 'atlas'];
const DECODES: MindDecodeSkin[] = ['tiles', 'tape', 'stack'];
const CHROME_KEY = 'takeoff.mindChrome';

function loadChrome(): { mindTree: MindTree; mindDecode: MindDecodeSkin } {
  const fallback = { mindTree: 'branches' as MindTree, mindDecode: 'tiles' as MindDecodeSkin };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(CHROME_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { tree?: unknown; decode?: unknown };
    return {
      mindTree: TREES.includes(parsed.tree as MindTree) ? (parsed.tree as MindTree) : fallback.mindTree,
      mindDecode: DECODES.includes(parsed.decode as MindDecodeSkin)
        ? (parsed.decode as MindDecodeSkin)
        : fallback.mindDecode,
    };
  } catch {
    return fallback;
  }
}

type ActionArgs<K extends keyof Actions> = Actions[K] extends (state: GameState, ...args: infer A) => boolean
  ? A
  : never;
export type Perform = <K extends keyof Actions>(name: K, ...args: ActionArgs<K>) => boolean;

export interface GameStore {
  game: GameState;
  saveRevision: number;
  speed: number;
  autoplay: boolean;
  perform: Perform;
  advance: (milliseconds: number) => void;
  update: (recipe: (game: GameState) => void) => void;
  replace: (game: GameState) => void;
  reset: (seed?: number) => void;
  setSpeed: (speed: number) => void;
  setAutoplay: (on: boolean, policy?: PolicyName, holdTransition?: boolean, variant?: string) => void;
  mindTree: MindTree;
  mindDecode: MindDecodeSkin;
  setMindChrome: (tree?: MindTree, decode?: MindDecodeSkin) => void;
}

// Keep the deterministic engine independent of React. Immer copies only changed
// branches; published snapshots are frozen so consumers cannot mutate past frames.
const immutable = new Immer();
export function createGameStore(initial = newGame(), speed = 1) {
  let policy: PolicyName = 'bot';
  let bot = newBotMemory(policy);
  const chrome = loadChrome();
  return createStore<GameStore>((set, get) => {
    const mutate = (recipe: (game: GameState) => void, save = true) => {
      const previous = get().game;
      const game = immutable.produce(previous, recipe);
      if (game !== previous) set({ game, saveRevision: get().saveRevision + (save ? 1 : 0) });
    };
    const perform: Perform = (name, ...args) => {
      let changed = false;
      mutate((game) => {
        // The public generic signature enforces the argument tuple for each action.
        const action = actions[name] as unknown as (state: GameState, ...values: typeof args) => boolean;
        changed = action(game, ...args);
      });
      return changed;
    };
    const update = (recipe: (game: GameState) => void) => mutate(recipe);
    const replace = (game: GameState) => {
      bot = newBotMemory(policy);
      set({
        game: immutable.produce(structuredClone(game), () => {}),
        autoplay: false,
        saveRevision: get().saveRevision + 1,
      });
    };
    return {
      game: immutable.produce(structuredClone(initial), () => {}),
      speed,
      autoplay: false,
      saveRevision: 0,
      perform,
      update,
      replace,
      reset: (seed = Date.now()) => replace(newGame(seed)),
      setSpeed: (value) => {
        if (Number.isFinite(value) && value >= 0) set({ speed: value });
      },
      setAutoplay: (on, which = policy, holdTransition = false, variant = '') => {
        policy = which;
        bot = newBotMemory(policy, holdTransition, variant);
        set({ autoplay: on });
      },
      mindTree: chrome.mindTree,
      mindDecode: chrome.mindDecode,
      setMindChrome: (tree, decode) => {
        const next = {
          mindTree: tree ?? get().mindTree,
          mindDecode: decode ?? get().mindDecode,
        };
        try {
          localStorage.setItem(CHROME_KEY, JSON.stringify({ tree: next.mindTree, decode: next.mindDecode }));
        } catch {
          // Private mode and the test runner can refuse storage. The toggle still applies.
        }
        set(next);
      },
      advance: (milliseconds) => {
        if (!Number.isFinite(milliseconds) || milliseconds <= 0 || get().game.ending) return;
        mutate((game) => {
          if (!get().autoplay) {
            tick(game, milliseconds);
            return;
          }
          game.tickAccum += milliseconds;
          let count = 0;
          while (game.tickAccum >= TICK_MS && !game.ending && count < 36000) {
            game.tickAccum -= TICK_MS;
            policyStep(game, actions, bot);
            step(game);
            count++;
          }
          if (count >= 36000) game.tickAccum = 0;
        }, false);
      },
    };
  });
}
export type GameStoreApi = ReturnType<typeof createGameStore>;
