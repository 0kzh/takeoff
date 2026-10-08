import { flushSync } from 'react-dom';
import { SAVE_VERSION, newGame, replaceState } from '../engine/state.js';
import { actions, tick } from '../engine/tick.js';
import { fireableEvents } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { PROJECTS } from '../data/projects.js';
import { PRESETS } from '../data/presets.js';
import { gameFromPreset } from '../store/presets.js';
import type { GameStoreApi } from '../store/game.js';
import type { Persistence } from './save.js';

// Existing playtest scripts intentionally mutate __game.state. Keep their sandbox
// separate from immutable application snapshots, committing at explicit boundaries.
function createDebugApi(store: GameStoreApi, persistence: Persistence, seed: number) {
  const sandbox = structuredClone(store.getState().game);
  const unsubscribe = store.subscribe((current, previous) => {
    if (current.game !== previous.game) replaceState(sandbox, structuredClone(current.game));
  });
  const commit = () => store.getState().update((game) => replaceState(game, structuredClone(sandbox)));
  const render = () => flushSync(commit);
  const api = {
    state: sandbox,
    actions,
    tick: (dtMs: number) => {
      flushSync(() => {
        commit();
        store.getState().advance(dtMs);
      });
      return sandbox;
    },
    rawTick: (dtMs: number) => {
      tick(sandbox, dtMs);
      render();
    },
    projects: {
      all: PROJECTS,
      byId: projectById,
      visible: () => visibleProjects(sandbox).map((project) => project.id),
    },
    events: {
      fireable: fireableEvents(),
      fire: (id: string) => {
        const changed = actions.fireEvent(sandbox, id);
        render();
        return changed;
      },
    },
    presets: PRESETS,
    loadPreset: (stage: number) => {
      flushSync(() => store.getState().replace(gameFromPreset(stage, seed)));
      persistence.save();
      return sandbox;
    },
    newGame,
    setSpeed: (speed: number) => store.getState().setSpeed(speed),
    setAutoplay: store.getState().setAutoplay,
    save: () => {
      render();
      return persistence.save();
    },
    render,
    version: SAVE_VERSION,
  };
  return { api, dispose: unsubscribe };
}
export function installDebugApi(store: GameStoreApi, persistence: Persistence, seed: number) {
  const { api, dispose } = createDebugApi(store, persistence, seed);
  window.__game = api;
  return () => {
    dispose();
    if (window.__game === api) delete window.__game;
  };
}
export type DebugApi = ReturnType<typeof createDebugApi>['api'];
declare global {
  interface Window {
    __game?: DebugApi;
  }
}
