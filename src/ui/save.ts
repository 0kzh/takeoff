import { GameState, SAVE_KEY, serialize, deserialize } from '../engine/state.js';
import { byId } from './dom.js';

const AUTOSAVE_MS = 15000;
const TOAST_EVERY_MS = 30000;
const ACTION_SAVE_DELAY_MS = 250;

export interface Saver {
  markDirty(): void;
  saveNow(): void;
  clear(): void;
  exportString(): string;
  importString(text: string): GameState | null;
}

export function loadSave(): GameState | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

function toBase64(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function createSaver(state: GameState): Saver {
  let lastToast = -Infinity;
  let pending: number | undefined;
  let disabled = false;

  const toast = () => {
    const now = performance.now();
    if (now - lastToast < TOAST_EVERY_MS) return;
    lastToast = now;
    const el = byId('toast');
    el.classList.add('visible');
    window.setTimeout(() => el.classList.remove('visible'), 1500);
  };

  const saveNow = () => {
    if (disabled) return;
    if (pending !== undefined) {
      window.clearTimeout(pending);
      pending = undefined;
    }
    try {
      localStorage.setItem(SAVE_KEY, serialize(state));
      toast();
    } catch {
    }
  };

  window.setInterval(saveNow, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('beforeunload', saveNow);

  return {
    markDirty() {
      if (pending === undefined) pending = window.setTimeout(saveNow, ACTION_SAVE_DELAY_MS);
    },
    saveNow,
    clear() {
      disabled = true;
      if (pending !== undefined) window.clearTimeout(pending);
      pending = undefined;
      localStorage.removeItem(SAVE_KEY);
      disabled = false;
    },
    exportString: () => toBase64(serialize(state)),
    importString(text: string) {
      try {
        return deserialize(fromBase64(text));
      } catch {
        return null;
      }
    },
  };
}
