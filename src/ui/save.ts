import { SAVE_KEY, serialize, deserialize, type GameState } from '../engine/state.js';
import type { GameStoreApi } from '../store/game.js';

const AUTOSAVE_MS = 15000;
const ACTION_SAVE_DELAY_MS = 250;
export function loadSave(storage?: Pick<Storage, 'getItem'>): GameState | null {
  try {
    const text = (storage ?? localStorage).getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}
export function stageStartKey(stage: number): string {
  return `${SAVE_KEY}.stage${stage}-start`;
}
export function loadStageStart(stage: number, storage?: Pick<Storage, 'getItem'>): GameState | null {
  try {
    const text = (storage ?? localStorage).getItem(stageStartKey(stage));
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}
export function exportSave(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}
export function importSave(text: string): GameState | null {
  try {
    return deserialize(
      new TextDecoder().decode(Uint8Array.from(atob(text.trim()), (char) => char.charCodeAt(0))),
    );
  } catch {
    return null;
  }
}
export interface Persistence {
  save: () => boolean;
  dispose: () => void;
}

// Own every timer/listener here so React remounts and Vite reloads can clean up.
export function startPersistence(
  store: GameStoreApi,
  onSaved: () => void,
  storage?: Pick<Storage, 'setItem'>,
): Persistence {
  let pending: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(pending);
    pending = undefined;
    try {
      (storage ?? localStorage).setItem(SAVE_KEY, serialize(store.getState().game));
      onSaved();
      return true;
    } catch {
      return false;
    }
  };
  // Save player actions promptly; ordinary simulation ticks use the periodic
  // autosave so the browser does not write to disk every frame.
  const unsubscribe = store.subscribe((current, previous) => {
    if (current.saveRevision !== previous.saveRevision && pending === undefined)
      pending = setTimeout(save, ACTION_SAVE_DELAY_MS);
    // A stage's opening state is kept so an early ending can rewind to it.
    if (current.game.stage !== previous.game.stage && current.game.stage >= 2 && !current.game.ending) {
      try {
        (storage ?? localStorage).setItem(stageStartKey(current.game.stage), serialize(current.game));
      } catch {
        // Storage failures never stop play.
      }
    }
  });
  const interval = setInterval(save, AUTOSAVE_MS);
  const hidden = () => {
    if (document.visibilityState === 'hidden') save();
  };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('beforeunload', save);
  return {
    save,
    dispose: () => {
      clearTimeout(pending);
      clearInterval(interval);
      unsubscribe();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('beforeunload', save);
    },
  };
}
