import { useSyncExternalStore } from 'react';

// UI-only preferences for the Mind tab (not game state, not saved with the game).
export type MainTab = 'lab' | 'mind';
export interface MindPrefs {
  tab: MainTab;
}

function load(): MindPrefs {
  return { tab: 'lab' };
}

let prefs: MindPrefs | null = null;
const listeners = new Set<() => void>();
const current = (): MindPrefs => (prefs ??= load());

export function setMindPrefs(next: Partial<MindPrefs>): void {
  prefs = { ...current(), ...next };
  for (const l of listeners) l();
}

export function useMindPrefs(): MindPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    current,
  );
}
