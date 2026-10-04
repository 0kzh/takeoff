import { GameState, newGame, replaceState, SAVE_VERSION } from '../engine/state.js';
import { actions, tick } from '../engine/tick.js';
import { researchCap } from '../engine/economy.js';
import { GAS_MW } from '../engine/infrastructure.js';
import { fireableEvents, pendingDevelopments } from '../engine/events.js';
import { setSkin } from '../engine/space.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { fmtDuration, fmtNum, dateLabel } from '../engine/format.js';
import { PROJECTS } from '../data/projects.js';
import { PRESETS, presetFor, EXTRA_PRESETS, presetByKey } from '../data/presets.js';
import { byId, make } from './dom.js';
import { resetGraph } from './graph.js';
import { resetLogCache } from './log.js';
import type { Saver } from './save.js';
import type { PolicyName } from '../sim/policy.js';

export interface DevHost {
  state: GameState;
  saver: Saver;
  render: () => void;
  getSpeed: () => number;
  setSpeed: (n: number) => void;
  getAutoplay: () => boolean;
  /**
   * `which` picks the simulator policy that plays: 'bot' (default) or 'naive' (the critic's
   * first-timer). `holdTransition` leaves Break ground for the player to click.
   */
  setAutoplay: (on: boolean, which?: PolicyName, holdTransition?: boolean, variant?: string) => void;
  /** Game advance used by the main loop (honours autoplay). */
  advance: (dtMs: number) => void;
}

const SPEEDS = [1, 5, 20];

/** Replaces the live state in place, then saves. The reference held by window.__game stays valid. */
function load(host: DevHost, next: GameState): void {
  replaceState(host.state, next);
  resetGraph();
  resetLogCache();
  host.saver.saveNow();
  host.render();
}

export function loadPreset(host: DevHost, key: number | string): GameState {
  // `3c`, `4s`…: a named variant of a stage's start (EXTRA_PRESETS); a number: the stage's start.
  if (typeof key === 'string' && EXTRA_PRESETS[key]) {
    const extra = presetByKey(key)!;
    const param = new URLSearchParams(location.search).get('seed');
    load(host, extra.build(param !== null && Number.isFinite(Number(param)) ? Number(param) : Date.now() % 100000));
    return host.state;
  }
  const n = Number(key);
  const preset = presetFor(n);
  // `?seed=N` makes a preset reproducible too (the smoke tests); otherwise a fresh seed each time.
  const param = new URLSearchParams(location.search).get('seed');
  load(host, preset.build(param !== null && Number.isFinite(Number(param)) ? Number(param) : Date.now() % 100000));
  if (!preset.ready || preset.stage !== n) {
    const latest = [...PRESETS].reverse().find((p) => p.ready && p.stage < n);
    host.state.consoleQueue.push({ delay: 0.1, text: `Stage ${n} preset pending. Loaded the Stage ${latest?.stage ?? 2} preset.` });
  }
  host.render();
  return host.state;
}

function grant(host: DevHost, what: string): void {
  const s = host.state;
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
      if (s.stage < 2) s.power += 10000;
      else s.powerCapacityMW += GAS_MW * 5;
      break;
    case 'trust':
      s.trust += 5;
      break;
  }
  host.saver.markDirty();
  host.render();
}

function hiddenReadout(s: GameState): string {
  const next = pendingDevelopments(s)
    .slice(0, 3)
    .map((d) => `${d.id}${d.month !== undefined ? ` @${dateLabel(d.month)}` : ''}`)
    .join(', ');
  return [
    `approval ${fmtNum(s.approval, 1)} · gov ${fmtNum(s.govRelations, 1)} · lead ${fmtNum(s.lead, 2)} · SL${s.securityLevel}`,
    `data ${fmtNum(s.data, 1)} T (synthetic ${fmtNum(s.dataSynthetic, 1)}) · crawl left ${fmtNum(s.crawlLeft, 1)} · autonomy ${s.autonomy}`,
    `late queue ${s.cadence.lateQueue.join(', ') || '—'} · governed ${s.cadence.governed.length}`,
    `alignment apparent ${fmtNum(s.alignmentApparent, 1)} · true ${fmtNum(s.alignmentTrue, 1)}`,
    `idle rescues ${s.stats.idleRescues} · quiet ${fmtNum(s.idle.quiet, 0)} s`,
    `time in stage ${fmtDuration(s.stats.timeInStage)} · played ${fmtDuration(s.stats.timePlayed)}`,
    `rival ${fmtNum(s.rivalCapability, 2)}× next in ${fmtNum(s.nextRivalIn, 0)} s`,
    `next developments: ${next || 'none'}`,
  ].join('\n');
}

export function mountDev(host: DevHost): void {
  const root = byId('dev');
  const btn = (id: string, label: string, fn: () => void) => {
    const b = make('button', { id, type: 'button' }, label);
    b.addEventListener('click', fn);
    return b;
  };
  const row = (...children: (HTMLElement | string)[]) => {
    const div = make('div', { class: 'devRow' });
    div.append(...children);
    return div;
  };

  const stageRow = row(
    'Stage ',
    ...PRESETS.map((p) => btn(`dev-stage-${p.stage}`, String(p.stage), () => loadPreset(host, p.stage))),
    ' ',
    ...Object.entries(EXTRA_PRESETS).map(([key, p]) => {
      const b = btn(`dev-stage-${key}`, key, () => loadPreset(host, key));
      b.title = p.label;
      return b;
    }),
  );
  const speedButtons = SPEEDS.map((n) => btn(`dev-speed-${n}`, `×${n}`, () => host.setSpeed(n)));
  const autoplay = btn('dev-autoplay', 'Autoplay', () => host.setAutoplay(!host.getAutoplay()));
  const speedRow = row('Speed ', ...speedButtons, ' ', autoplay);

  const grants = row(
    btn('dev-funds', '+$', () => grant(host, 'funds')),
    btn('dev-research', '+Research', () => grant(host, 'research')),
    btn('dev-insight', '+Insight', () => grant(host, 'insight')),
    btn('dev-compute', '+Compute', () => grant(host, 'compute')),
    btn('dev-power', '+Power', () => grant(host, 'power')),
    btn('dev-trust', '+Trust', () => grant(host, 'trust')),
  );

  const select = make('select', { id: 'dev-event-select' });
  for (const ev of fireableEvents()) select.append(make('option', { value: ev.id }, ev.label));
  const eventRow = row(
    btn('dev-finish', 'Finish training', () => {
      actions.finishTraining(host.state);
      host.render();
    }),
    ' ',
    select,
    btn('dev-fire', 'Fire event ▾', () => {
      actions.fireEvent(host.state, select.value);
      host.render();
    }),
  );

  // Stage 5 (stage5.md §9): flip the verdict Stage 4 left (the skin follows it), and open each end screen.
  const endRow = row(
    btn('dev-skin', 'Flip skin', () => {
      setSkin(host.state, host.state.flags['alignedAtHandover'] !== true);
      host.saver.markDirty();
      host.render();
    }),
    ' End ',
    ...['concord', 'silence', 'pause', 'project'].map((id) => btn(`dev-end-${id}`, id, () => {
      actions.forceEnding(host.state, id);
      host.saver.saveNow();
      host.render();
    })),
  );

  const hidden = make('div', { id: 'devHidden' });
  hidden.style.display = 'none';
  const hiddenToggle = btn('dev-show-hidden', 'Show hidden', () => {
    hidden.style.display = hidden.style.display === 'none' ? 'block' : 'none';
  });

  const text = make('textarea', { id: 'dev-save-text', placeholder: 'base64 save' });
  const saveRow = row(
    hiddenToggle,
    btn('dev-export', 'Export', () => {
      text.value = host.saver.exportString();
      text.select();
    }),
    btn('dev-import', 'Import', () => {
      const next = host.saver.importString(text.value);
      if (next) load(host, next);
      else text.value = 'Import failed: not a Takeoff save.';
    }),
    btn('dev-reset', 'Reset', () => {
      if (!confirm('Reset the game? This deletes the save.')) return;
      host.saver.clear();
      replaceState(host.state, newGame(Date.now()));
      host.saver.saveNow();
      host.render();
    }),
  );

  root.append(make('b', {}, 'dev'), stageRow, speedRow, grants, eventRow, endRow, saveRow, text, hidden);

  const refresh = () => {
    speedButtons.forEach((b, i) => b.classList.toggle('devActive', SPEEDS[i] === host.getSpeed()));
    autoplay.classList.toggle('devActive', host.getAutoplay());
    if (hidden.style.display !== 'none') hidden.textContent = hiddenReadout(host.state);
  };
  window.setInterval(refresh, 250);

  const open = (on: boolean) => {
    root.classList.toggle('open', on);
    refresh();
  };
  if (new URLSearchParams(location.search).get('dev') === '1') open(true);
  document.addEventListener('keydown', (e) => {
    if (e.key === '`' && !(e.target instanceof HTMLTextAreaElement)) open(!root.classList.contains('open'));
  });

  (window as unknown as { __game: unknown }).__game = {
    state: host.state,
    actions,
    tick: (dtMs: number) => {
      host.advance(dtMs);
      host.render();
      return host.state;
    },
    rawTick: (dtMs: number) => tick(host.state, dtMs),
    projects: {
      all: PROJECTS,
      byId: projectById,
      visible: () => visibleProjects(host.state).map((p) => p.id),
    },
    events: {
      fireable: fireableEvents(),
      fire: (id: string) => actions.fireEvent(host.state, id),
    },
    presets: PRESETS,
    loadPreset: (n: number | string) => loadPreset(host, n),
    setSpeed: host.setSpeed,
    setAutoplay: host.setAutoplay,
    save: () => host.saver.saveNow(),
    render: host.render,
    version: SAVE_VERSION,
  };
}
