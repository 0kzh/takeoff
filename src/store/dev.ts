import { flushSync } from 'react-dom';
import { GameState, newGame, SAVE_VERSION } from '../engine/state.js';
import { actions, tick } from '../engine/tick.js';
import { researchCap } from '../engine/economy.js';
import { fireableEvents, pendingDevelopments } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { fmtDuration, fmtNum, dateLabel } from '../engine/format.js';
import { PROJECTS } from '../data/projects.js';
import { PRESETS, presetFor } from '../data/presets.js';
import { useGameStore, seedParam } from './gameStore.js';

export type Grant = 'funds' | 'research' | 'insight' | 'compute' | 'power' | 'trust';

export function loadPreset(n: number): GameState {
  const { game, load, touch } = useGameStore.getState();
  const preset = presetFor(n);
  load(preset.build(seedParam() ?? Date.now() % 100000));
  if (!preset.ready || preset.stage !== n) {
    game.consoleQueue.push({ delay: 0.1, text: `Stage ${n} preset pending. Loaded the Stage 2 preset.` });
  }
  touch();
  return game;
}

export function grant(what: Grant): void {
  const { game: s, saver, touch } = useGameStore.getState();
  switch (what) {
    case 'funds':
      s.funds = Math.round((s.funds + Math.max(1000, s.funds)) * 100) / 100;
      break;
    case 'research':
      s.revealed['research'] = true;
      s.research = Math.max(s.research, researchCap(s));
      break;
    case 'insight':
      s.insightUnlocked = true;
      s.revealed['insight'] = true;
      s.insight += 50;
      break;
    case 'compute':
      s.gpus += s.stage < 2 ? 10 : 1000;
      break;
    case 'power':
      s.power += 10 * s.gridCapacity;
      break;
    case 'trust':
      s.trust += 5;
      break;
  }
  saver.markDirty();
  touch();
}

export function hiddenReadout(s: GameState): string {
  const next = pendingDevelopments(s)
    .slice(0, 3)
    .map((d) => `${d.id}${d.month !== undefined ? ` @${dateLabel(d.month)}` : ''}`)
    .join(', ');
  return [
    `approval ${fmtNum(s.approval, 1)} · gov ${fmtNum(s.govRelations, 1)} · lead ${fmtNum(s.lead, 2)}`,
    `alignment apparent ${fmtNum(s.alignmentApparent, 1)} · true ${fmtNum(s.alignmentTrue, 1)}`,
    `idle rescues ${s.stats.idleRescues} · quiet ${fmtNum(s.idle.quiet, 0)} s`,
    `time in stage ${fmtDuration(s.stats.timeInStage)} · played ${fmtDuration(s.stats.timePlayed)}`,
    `rival ${fmtNum(s.rivalCapability, 2)}× next in ${fmtNum(s.nextRivalIn, 0)} s`,
    `next developments: ${next || 'none'}`,
  ].join('\n');
}

export function installDevApi(): void {
  const store = useGameStore.getState();
  const { game } = store;
  const render = () => flushSync(() => store.touch());

  (window as unknown as { __game: unknown }).__game = {
    state: game,
    actions,
    tick: (dtMs: number) => {
      store.advance(dtMs);
      render();
      return game;
    },
    rawTick: (dtMs: number) => tick(game, dtMs),
    projects: {
      all: PROJECTS,
      byId: projectById,
      visible: () => visibleProjects(game).map((p) => p.id),
    },
    events: {
      fireable: fireableEvents(),
      fire: (id: string) => actions.fireEvent(game, id),
    },
    presets: PRESETS,
    loadPreset: (n: number) => {
      loadPreset(n);
      render();
      return game;
    },
    newGame: (seed: number) => {
      store.load(newGame(seed));
      render();
      return game;
    },
    setSpeed: store.setSpeed,
    setAutoplay: store.setAutoplay,
    save: () => store.saver.saveNow(),
    render,
    version: SAVE_VERSION,
  };
}
