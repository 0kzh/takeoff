import { useSyncExternalStore } from 'react';

// UI-only preferences for the Mind tab (not game state, not saved with the game).
export type TreeStyle = 'hex' | 'atlas' | 'dossier';
export type DecodeStyle = 'spot' | 'align' | 'trace';
export type MainTab = 'lab' | 'mind';
export interface MindPrefs {
  tree: TreeStyle;
  decode: DecodeStyle;
  tab: MainTab;
}

export const TREE_STYLES: TreeStyle[] = ['hex', 'atlas', 'dossier'];
export const DECODE_STYLES: DecodeStyle[] = ['spot', 'align', 'trace'];
const KEY = 'takeoff.mindUi';

function load(): MindPrefs {
  const out: MindPrefs = { tree: 'hex', decode: 'spot', tab: 'lab' };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<MindPrefs>;
    if (raw.tree && TREE_STYLES.includes(raw.tree)) out.tree = raw.tree;
    if (raw.decode && DECODE_STYLES.includes(raw.decode)) out.decode = raw.decode;
  } catch {
    // Storage unavailable: defaults.
  }
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search);
    const tree = q.get('tree') as TreeStyle | null;
    const decode = q.get('decode') as DecodeStyle | null;
    if (tree && TREE_STYLES.includes(tree)) out.tree = tree;
    if (decode && DECODE_STYLES.includes(decode)) out.decode = decode;
  }
  return out;
}

let prefs: MindPrefs | null = null;
const listeners = new Set<() => void>();
const current = (): MindPrefs => (prefs ??= load());

export function setMindPrefs(next: Partial<MindPrefs>): void {
  prefs = { ...current(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify({ tree: prefs.tree, decode: prefs.decode }));
  } catch {
    // ignore
  }
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
