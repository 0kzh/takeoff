import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { newGame } from './engine/state.js';
import { createGameStore } from './store/game.js';
import { GameProvider } from './store/context.js';
import { loadSave } from './ui/save.js';
import '../styles.css';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam !== null && Number.isFinite(Number(seedParam)) ? Number(seedParam) : Date.now();
const store = createGameStore(loadSave() ?? newGame(seed), params.get('speed') === '0' ? 0 : 1);
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <GameProvider store={store}>
      <App seed={seed} />
    </GameProvider>
  </StrictMode>,
);
