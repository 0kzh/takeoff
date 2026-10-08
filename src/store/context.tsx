import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { GameStore, GameStoreApi } from './game.js';

const StoreContext = createContext<GameStoreApi | null>(null);
export function GameProvider({ store, children }: { store: GameStoreApi; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
export function useGameStoreApi(): GameStoreApi {
  const store = useContext(StoreContext);
  if (!store) throw new Error('GameProvider is missing');
  return store;
}
export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(useGameStoreApi(), selector);
}
export const useGame = () => useGameStore((state) => state.game);
export const usePerform = () => useGameStore((state) => state.perform);
