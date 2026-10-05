import type { GameState, SpaceRow } from '../engine/state.js';
import {
  BuyRow, rowOpen, unitsAffordable, rowLine, sliderLine, handLine, shareLine, missionStatus, swarmLine, swarmMeter, fundMeter,
  mercuryLeft, orbitalEffective, splitOn,
} from '../engine/space.js';
import { earthGpus } from '../engine/infrastructure.js';
import { copies, bestCapability } from '../engine/economy.js';
import { fmtInt, fmtNum, fmtShortNum, fmtBig } from '../engine/format.js';
import { byId, setText, setDisabled } from './dom.js';
import { meterSpan } from './render4.js';
import type { Perform } from './render.js';

/**
 * Stage 5's screen (stage5.md §6): `panel-space` at the top of the left column (the four rows with their
 * returns, the standing split, the Industry share with both clocks, the mission line, the swarm); Stores
 * as the main panel with the flow, the two purses and what they built, Earth below in its own grey box;
 * Stats trimmed to the model, the copies and value drift. Visibility stays with `revealed` flags; this
 * module writes text and moves two panels for the stage.
 */

let perform: Perform;
let current: GameState | null = null;

const ROW_IDS: [BuyRow, string][] = [['foundry', 'foundry'], ['orbital', 'orbital'], ['collector', 'collector'], ['probe', 'probe']];
const SLIDERS: [SpaceRow, string][] = [['foundry', 'sliderFoundry'], ['orbital', 'sliderOrbital'], ['collector', 'sliderCollector']];

export function mount5(p: Perform): void {
  perform = p;
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  for (const [row, id] of ROW_IDS) {
    bind(`btn-${id}`, () => perform('buyRow', row, 1));
    bind(`btn-${id}10`, () => perform('buyRow', row, 10));
    bind(`btn-${id}Max`, () => perform('buyRow', row, 'max'));
  }
  for (const [row, id] of SLIDERS) {
    const slider = byId<HTMLInputElement>(id);
    slider.addEventListener('input', () => {
      perform('setSplitShare', row, Number(slider.value));
      // A slider cannot take what the others hold: it snaps back to what was set.
      if (current) slider.value = String(Math.round(current.s5.split[row] * 100));
    });
  }
  bind('btn-industryShare', () => perform('cycleIndustryShare'));
  home = {
    space: { parent: byId('panel-space').parentElement!, next: byId('panel-space').nextElementSibling },
    earth: { parent: byId('panel-earth').parentElement!, next: byId('panel-earth').nextElementSibling },
  };
}

// ---------- the layout: Space at the top of the left column, Earth under Stores ----------

let home: Record<'space' | 'earth', { parent: HTMLElement; next: Element | null }> | null = null;
let laidOut = false;

function layout5(s: GameState): void {
  const want = s.stage >= 5;
  if (want === laidOut || !home) return;
  laidOut = want;
  const space = byId('panel-space');
  const earth = byId('panel-earth');
  if (want) {
    byId('leftColumn').prepend(space);
    byId('panel-stores').after(earth);
  } else {
    for (const [el, h] of [[space, home.space], [earth, home.earth]] as const) {
      h.parent.insertBefore(el, h.next && h.next.parentElement === h.parent ? h.next : null);
    }
  }
}

export function renderStage5(s: GameState): void {
  current = s;
  layout5(s);
  if (s.stage !== 5) return;
  renderSpace(s);
  renderStores5(s);
  renderStats5(s);
}

// ---------- the Space panel (§2.1, §2.2) ----------

function renderSpace(s: GameState): void {
  for (const [row, id] of ROW_IDS) {
    if (!rowOpen(s, row)) continue;
    const n = unitsAffordable(s, row);
    setDisabled(`btn-${id}`, n < 1);
    setDisabled(`btn-${id}10`, n < 10);
    setDisabled(`btn-${id}Max`, n < 1);
    setText(`${id}Line`, rowLine(s, row));
  }
  if (splitOn(s)) {
    for (const [row, id] of SLIDERS) {
      const slider = byId<HTMLInputElement>(id);
      const v = Math.round(s.s5.split[row] * 100);
      if (document.activeElement !== slider && slider.value !== String(v)) slider.value = String(v);
      setText(`${id}Pct`, `${v}%`);
      setText(`${id}Rate`, `· ${sliderLine(s, row)}`);
    }
    setText('byHand', handLine(s));
  }
  if (s.revealed['industryShare']) {
    const share = Math.round(s.s5.industryShare * 100);
    setText('btn-industryShare', `${share}%`);
    setText('shareLine', shareLine(s));
  }
  const mission = missionStatus(s);
  setText('missionLine', mission);
  byId('missionRow').classList.toggle('off', mission === '');
  if (s.revealed['collectors']) {
    const sw = swarmLine(s);
    setText('swarmPct', sw.pct);
    setText('swarmNext', sw.next);
  }
}

// ---------- Stores (§2.5) ----------

function renderStores5(s: GameState): void {
  const f = s.s5;
  setText('launchMass', `${fmtShortNum(f.massFlow)} t/s`);
  setText('matter', `${fmtShortNum(Math.floor(f.matter))} t`);
  if (s.revealed['missionFund']) {
    const m = fundMeter(s);
    meterSpan('fundMeter', m.fraction, `the mission fund: ${m.text}`);
    setText('fundText', m.text);
  }
  setText('orbitalGpus', fmtBig(orbitalEffective(s)));
  if (s.revealed['collectors']) {
    const m = swarmMeter(s);
    meterSpan('swarmMeter', m.fraction, `the swarm: ${m.text}`);
    setText('swarmText', m.text);
  }
  setText('mercuryLeft', mercuryLeft(s));
  setText('peopleOff', fmtInt(f.peopleOffEarth));
  setText('probesCount', fmtBig(Math.floor(f.probes)));
  setText('earthRobots', fmtShortNum(s.robots));
  const gpus = earthGpus(s);
  setText('earthGpus', fmtShortNum(gpus));
  // 1 kW per GPU-equivalent: GW, then TW.
  const gw = gpus / 1e6;
  setText('earthPower', gw >= 1000 ? `${fmtNum(gw / 1000, 1)} TW` : `${fmtNum(gw, 1)} GW`);
  const grey = byId('panel-earth');
  const quiet = s.revealed['earthGrey'] === true;
  if (grey.classList.contains('quiet') !== quiet) grey.classList.toggle('quiet', quiet);
}

// ---------- Stats (§2.5): the model, the copies, value drift ----------

function renderStats5(s: GameState): void {
  setText('statModel', `${s.training.modelName} · ${fmtInt(bestCapability(s))}×`);
  setText('statCopiesThinking', fmtBig(copies(s)));
  // After Von Neumann probes the counter counts probes; before, it is what Stage 4 left.
  const f = s.s5;
  // Nothing explains it (§2.3): no hover.
  setText('statDrift5', f.probesTotal > 0 ? `${fmtInt(Math.floor(f.probesLost))} probes` : fmtBig(Math.floor(s.stats.lostToDrift ?? 0)));
}
