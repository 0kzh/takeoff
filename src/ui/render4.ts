import type { GameState } from '../engine/state.js';
import { isBought } from '../engine/state.js';
import { researchRate, potentialTasksPerSec, MONITOR_SHARE_MAX, monitorFloor } from '../engine/economy.js';
import { effGpus } from '../engine/infrastructure.js';
import {
  jobLine, fleetStatus, idleShare, fleetAuto, permitsOpen, housingCost, minedPerSec, HOUSING_APPROVAL, FleetJob,
} from '../engine/fleet.js';
import { approvalTermsS4, approvalTargetS4, ubiTerm, heldShare, UBI_SHARES } from '../engine/society.js';
import {
  treatyCeiling, treatyStall, treatyPerMinute, agendaLine, hearingGain, agendaSeconds, AGENDA_TITLES, baiwenStatus,
  DRAFT_POINTS, talksOpen, agendaQueueSeconds,
} from '../engine/treaty.js';
import { genStatus } from '../engine/stage4.js';
import { verifySeconds, generationCost, researchDiverted, slowBranch, nextGenName } from '../engine/training.js';
import { seats, nextSeatAt } from '../engine/world3.js';
import { orderThreshold } from '../engine/oversight.js';
import { catchPerMin } from '../engine/alignment.js';
import { fmtInt, fmtNum, fmtClock, fmtShortNum } from '../engine/format.js';
import { byId, setText, setTitle, setDisabled, make } from './dom.js';
import { renderMeter } from './meter.js';
import { setOff } from './render3.js';
import type { Perform } from './render.js';

/**
 * Stage 4's screen (stage4.md §6): Stores in the centre column as the main panel, the fleet's jobs
 * with their rates (then the goal its grant hands over), Society with universal basic income and
 * Housing, the Concord treaty with Draft clauses, the Committee's agenda and hearings, the
 * generation line and Verify, the crises' reading lines. Visibility stays with `revealed` flags; this
 * module moves panels between columns for the stage and writes text.
 */

let perform: Perform;
let current: GameState | null = null;

const signed = (n: number, d = 0) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${fmtNum(Math.abs(n), d)}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function mount4(p: Perform): void {
  perform = p;
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  for (const [id, job] of [['fleetMine', 'mine'], ['fleetReplicate', 'replicate'], ['fleetBuild', 'build'], ['fleetChips', 'chips']] as const) {
    const slider = byId<HTMLInputElement>(id);
    slider.addEventListener('input', () => {
      perform('setFleetShare', job, Number(slider.value));
      // A slider cannot take what the others hold: it snaps back to what was set.
      if (current) slider.value = String(Math.round(current.s4[job] * 100));
    });
  }
  for (const goal of ['growth', 'people', 'treaty'] as const) bind(`btn-goal-${goal}`, () => perform('setFleetGoal', goal));
  bind('btn-ubi', () => perform('cycleUbi'));
  bind('btn-housing', () => perform('buildHousing', 1));
  bind('btn-housing10', () => perform('buildHousing', 10));
  bind('btn-hold-m25', () => perform('setApprovalHold', -25));
  bind('btn-hold-0', () => perform('setApprovalHold', 0));
  bind('btn-hold-p25', () => perform('setApprovalHold', 25));
  bind('btn-hearing', () => perform('holdHearing'));
  bind('btn-draft', () => perform('cycleDraft'));
  for (const v of ['hold', 'balanced', 'concede'] as const) bind(`btn-stance-${v}`, () => perform('setStance', v));
  bind('btn-verify', () => perform('toggleVerify'));
  homes = PANEL_MOVES.map(([id]) => {
    const el = byId(id);
    return { id, parent: el.parentElement!, next: el.nextElementSibling };
  });
}

// ---------- the layout (§6.1): left Robots, Research; centre Stores, Projects; right the rest ----------

/** Panels that change column in Stage 4, in the order they take there. */
const PANEL_MOVES: [string, string][] = [
  ['panel-robots', 'leftColumn'],
  ['panel-research', 'leftColumn'],
  ['panel-stores', 'middleColumn'],
  ['panel-projects', 'middleColumn'],
  ['panel-graph', 'rightColumn'],
  ['panel-alignment', 'rightColumn'],
  ['panel-treaty', 'rightColumn'],
  ['panel-geopolitics', 'rightColumn'],
  ['panel-oversight', 'rightColumn'],
  ['panel-society', 'rightColumn'],
  ['panel-public', 'rightColumn'],
  ['panel-security', 'rightColumn'],
  ['panel-stats', 'rightColumn'],
];
let homes: { id: string; parent: HTMLElement; next: Element | null }[] = [];
let laidOut = false;

function layout(s: GameState): void {
  // Stage 5 keeps Stage 4's layout (stage5.md as-built deltas row 9); render5.ts adds Space and Earth.
  const want = s.stage >= 4;
  if (want === laidOut) return;
  laidOut = want;
  if (want) {
    // Appended in order: each column ends with the stage's panels in §6.1's order.
    for (const [id, col] of PANEL_MOVES) byId(col).appendChild(byId(id));
  } else {
    // Back where the page had them (a new game after Stage 4), last first so each `next` is in place.
    for (const h of [...homes].reverse()) h.parent.insertBefore(byId(h.id), h.next && h.next.parentElement === h.parent ? h.next : null);
  }
}

// ---------- the render ----------

export function renderStage4(s: GameState): void {
  current = s;
  layout(s);
  // Share evals acts on a run's sign-off, which Stage 4 has not got (critic S3 round 1 §9.9 item 11).
  setOff('shareEvalsRow', s.stage >= 4);
  if (s.stage !== 4) return;
  renderStores4(s);
  renderFleet(s);
  renderResearch4(s);
  renderGeneration(s);
  renderSociety(s);
  renderTreaty(s);
  renderAgenda(s);
  renderReadings(s);
}

/** Stores (§2.1): materials, robots against permits, GPU-equivalents and power with no ceiling, treaty chips. */
function renderStores4(s: GameState): void {
  const f = s.s4;
  setText('research', fmtShortNum(Math.floor(s.research)));
  setText('insight', s.insight >= 1 ? fmtShortNum(Math.floor(s.insight)) : 'none yet');
  // Geopolitics, until the Treaty panel takes its place: Stage 3's bands for the lead are gone.
  setText('baiwenNote', '');
  setText('materials', `${fmtShortNum(f.materials)} t`);
  setText('robotsCount', fmtShortNum(s.robots));
  const open = permitsOpen(s);
  setText('robotsCap', open ? ' · no cap' : ` of ${fmtShortNum(f.permitCap)} permitted`);
  setOff('robotsMeter', open);
  if (!open) meterSpan('robotsMeter', s.robots / Math.max(1, f.permitCap), `${fmtInt(s.robots)} of ${fmtInt(f.permitCap)} permitted`);
  const gpus = effGpus(s);
  setText('infraGpus', fmtShortNum(gpus));
  setText('gpusS4', '');
  // 1 kW per GPU-equivalent: GW, then TW.
  const gw = gpus / 1e6;
  setText('powerS4', gw >= 1000 ? `${fmtNum(gw / 1000, 1)} TW` : `${fmtNum(gw, 1)} GW`);
  setText('infraCopies', fmtShortNum(Math.floor(gpus * s.copiesPerGPU)));
  meterSpan('chipsMeter', f.chipsInstalled, `${Math.round(f.chipsInstalled * 100)}% of the treaty chips installed`);
  setText('treatyChipsPct', fmtInt(Math.floor(f.chipsInstalled * 100)));
}

/** A Stores meter with its label in the hover and for assistive tech (Stage 5's two use it too). */
export function meterSpan(id: string, fraction: number, label: string): void {
  const el = byId(id);
  renderMeter(el, fraction);
  if (el.title !== label) {
    el.title = label;
    el.setAttribute('aria-label', label);
  }
}

// ---------- the fleet (§2.2, §2.5) ----------

const JOBS: [FleetJob, string][] = [['mine', 'fleetMine'], ['replicate', 'fleetReplicate'], ['build', 'fleetBuild'], ['chips', 'fleetChips']];

function renderFleet(s: GameState): void {
  const auto = fleetAuto(s);
  setOff('fleetSliders', auto);
  if (!auto) {
    for (const [job, id] of JOBS) {
      const slider = byId<HTMLInputElement>(id);
      const v = Math.round(s.s4[job] * 100);
      if (document.activeElement !== slider && slider.value !== String(v)) slider.value = String(v);
      setText(`${id}Pct`, `${v}%`);
      // What each share produces, or why it cannot work (G27): `+12,400 t/s`, `at the permit cap`.
      setText(`${id}Rate`, `· ${jobLine(s, job)}`);
    }
    const idle = idleShare(s);
    setText('fleetIdle', idle > 0.001 ? `Idle: ${pct(idle)}` : '');
  }
  if (s.revealed['fleetGoal']) {
    setText('fleetStatus', fleetStatus(s, s.training.modelName));
    const goal = s.s4.fleetGoal;
    for (const g of ['growth', 'people', 'treaty'] as const) {
      const b = byId(`btn-goal-${g}`);
      if (b.classList.contains('selected') !== (goal === g)) b.classList.toggle('selected', goal === g);
    }
    const trades: Record<string, string> = {
      growth: 'fleet output ×1.25',
      people: 'a fifth of the fleet builds housing: approval target +12, growth −20%',
      treaty: 'a fifth of the fleet inspects and installs: treaty +1 point a minute, growth −20%',
    };
    setText('fleetGoalNote', trades[goal] ?? '');
    for (const g of ['growth', 'people', 'treaty']) setTitle(`btn-goal-${g}`, trades[g]!);
  }
}

// ---------- research and the allocation (§2.3) ----------

function renderResearch4(s: GameState): void {
  if (!s.revealed['allocation']) return;
  const slider = byId<HTMLInputElement>('allocSlider');
  if (slider.max !== '50') {
    slider.max = '50';
    slider.min = '5';
  }
  const rate = researchRate(s);
  setText('allocRate', ` · ${fmtShortNum(rate)} research/s`);
  if (s.revealed['monitors']) {
    const m = byId<HTMLInputElement>('monitorSlider');
    if (m.max !== String(MONITOR_SHARE_MAX)) m.max = String(MONITOR_SHARE_MAX);
    const share = Math.round((s.monitorShare ?? 0) * 100);
    if (document.activeElement !== m && m.value !== String(share)) m.value = String(share);
    setText('monitorPct', `${share}%`);
    const floor = monitorFloor(s);
    setText('monitorRate', ` · catching ${fmtInt(Math.round(catchPerMin(s) * 100))}% a minute${floor ? ` · ${floor}% at least` : ''}`);
    setText('tasksPct', `${Math.max(0, 100 - Math.round(s.researchAlloc * 100) - share)}%`);
    setText('tasksRate', ` · ${fmtShortNum(potentialTasksPerSec(s))} tasks/s`);
  }
  setOff('humanShareLine', true);
}

// ---------- the generation line and Verify (§2.4) ----------

function renderGeneration(s: GameState): void {
  if (!s.revealed['generations']) return;
  setText('genStatus', genStatus(s));
  const on = s.s4.verifyOn;
  setText('btn-verify', `Verify each generation: ${on ? 'on' : 'off'}`);
  const b = byId('btn-verify');
  if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
  const locked = s.flags['verifyLocked'] === true && on;
  setDisabled('btn-verify', locked);
  setText('verifyNote', locked
    ? 'locked on: the Committee co-signs'
    : on ? `each generation is read first: +${fmtInt(verifySeconds(s))} s, Baiwen gains` : 'nobody reads it: no wait; the bigger the model, the more that costs');
  const m = s.alignmentApparent;
  setText('alignBands', m >= 80 ? '' : m >= 75 ? '— 80: Verify takes 20 s' : m >= 55 ? (m < 60 ? '— 55: advisories' : '') : '— under 55: an unread generation costs relations 2');
  setText('autonomyNote', s.autonomy >= 80 ? '— past 80: it would not need to ask' : s.autonomy >= 75 ? '— 80: it would not need to ask' : !slowBranch(s) && s.autonomy >= 55 && s.autonomy < 60 ? '— 60: cards lose their second button' : '');
}

// ---------- society (§2.7, §2.11) ----------

function renderSociety(s: GameState): void {
  // Universal basic income lives on Public until Society takes its place (2:00).
  const home = byId(s.revealed['society'] ? 'ubiHome' : 'panel-public');
  const row = byId('ubiRow');
  if (row.parentElement !== home) home.appendChild(row);
  const share = s.s4.ubiShare;
  setText('btn-ubi', `Universal basic income: ${pct(share)} of output`);
  const ubiOn = byId('btn-ubi');
  if (ubiOn.classList.contains('on') !== share > 0) ubiOn.classList.toggle('on', share > 0);
  const i = UBI_SHARES.findIndex((x) => Math.abs(x - share) < 1e-9);
  const next = UBI_SHARES[(i + 1) % UBI_SHARES.length] ?? 0;
  setText('ubiNote', share > 0 ? `tasks −${pct(share)} · approval +${fmtInt(Math.round(ubiTerm(share)))}` : `next: approval +${fmtInt(Math.round(ubiTerm(next)))}`);
  setTitle('btn-ubi', `A share of output paid to everyone, 0 / 5 / 10 / 20 %. The next press: ${pct(next)}, approval target ${signed(ubiTerm(next) - ubiTerm(share))}.`);
  // Approval and jobs (Public until 2:00, Society after).
  const a = Math.round(s.approval);
  setText('approval', signed(a));
  setText('societyApproval', signed(a));
  setText('societyJobs', fmtJobs4(s.jobsDisplaced));
  setText('jobsDisplaced', fmtJobs4(s.jobsDisplaced));
  const note = a >= 3 ? '' : a >= -3 ? '— 0: hearings count double' : a > -36 ? (a <= -30 ? '— −40: riots' : '') : a > -40 ? '— −40: riots' : a > -55 ? `— riots${a <= -50 ? ' · −55: sabotage' : ''}` : a > -60 ? '— sabotage · −60: the treaty stalls' : '— the treaty stalls';
  setText('societyApprovalNote', note);
  setText('approvalNote', note);
  const terms = approvalTermsS4(s).map(([k, v]) => `${k} ${signed(v, 1)}`).join('\n');
  setTitle('societyApprovalLine', `Approval moves toward ${signed(approvalTargetS4(s), 1)}:\n${terms}`);
  setTitle('approvalLine', `Approval moves toward ${signed(approvalTargetS4(s), 1)}:\n${terms}`);
  // Approval to hold (the transition grant's selector) and what holding it costs.
  if (s.revealed['approvalTarget']) {
    for (const [id, v] of [['btn-hold-m25', -25], ['btn-hold-0', 0], ['btn-hold-p25', 25]] as const) {
      const b = byId(id);
      if (b.classList.contains('selected') !== (s.s4.approvalHold === v)) b.classList.toggle('selected', s.s4.approvalHold === v);
    }
    setText('approvalHoldNote', `costs ${pct(heldShare(s))} of output now`);
  }
  if (s.revealed['housing']) {
    const cost = housingCost(s);
    const target = approvalTargetS4(s);
    setDisabled('btn-housing', s.s4.materials < cost);
    setDisabled('btn-housing10', s.s4.materials < housingCost(s, 10));
    const secs = cost / Math.max(1, minedPerSec(s));
    setText('housingNote', `approval target ${signed(target, 1)} → ${signed(target + HOUSING_APPROVAL, 1)} · ${secs < 600 ? fmtClock(secs) : `${fmtShortNum(cost)} t`} of materials`);
    setTitle('btn-housing', `Homes the fleet builds: approval target +${HOUSING_APPROVAL} each, for good. Each costs 1.2× the last; the price relaxes a step every 25 s.`);
  }
  setText('ashfordDeaths', fmtInt(s.s4.ashfordDeaths));
}

/** Millions of jobs: `43M`, `1.2B`. */
function fmtJobs4(millions: number): string {
  return millions >= 1000 ? `${fmtNum(millions / 1000, 2)}B` : `${fmtInt(Math.round(millions))}M`;
}

// ---------- the treaty (§2.8, §2.10, §2.11) ----------

function renderTreaty(s: GameState): void {
  if (!s.revealed['treaty']) return;
  const f = s.s4;
  const p = Math.floor(f.treaty);
  meterSpan('treatyMeter', f.treaty / 100, `${p} of 100%`);
  setText('treatyPct', fmtInt(p));
  const stall = treatyStall(s);
  const { cap, wait } = treatyCeiling(s);
  setText('treatyWait', stall ? `— ${stall}` : f.treaty >= cap - 0.05 && cap < 100 ? `— ${wait}` : cap >= 100 ? `— the last fifth is treaty chips` : `— +${fmtNum(treatyPerMinute(s), 1)} a minute`);
  const lead = s.lead;
  const m = Math.abs(Math.round(lead * 10) / 10);
  setText('treatyLead', `Baiwen-4: ${m < 0.05 ? 'level' : `${fmtNum(m, 1)} months ${lead < 0 ? 'ahead' : 'behind'}`}`);
  setText('baiwenVerified', baiwenStatus(s));
  setText('treatyLeadNote', lead < 0 ? '— Beijing is the one offering: treaty +25%' : lead > 3 ? '— the Committee would rather win: treaty −25%' : lead > 2.5 ? '— 3: the Committee would rather win' : lead < 0.5 ? '— 0: Beijing is the one offering' : '');
  if (s.revealed['treatyAppetite']) {
    setText('treatyAppetite', lead < 0 ? 'Who wants it more: Beijing.' : lead > 3 ? 'Who wants it more: neither; Washington is winning.' : 'Who wants it more: both, about equally.');
  }
  if (s.revealed['draft']) {
    const share = f.draftShare;
    setText('btn-draft', `Draft clauses: ${pct(share)}`);
    const b = byId('btn-draft');
    if (b.classList.contains('on') !== share > 0) b.classList.toggle('on', share > 0);
    const atCap = f.treaty >= Math.min(cap, 80) - 0.05;
    const perMin = (unitShare: number) => (60 * DRAFT_POINTS * unitShare * researchRate(s)) / (0.02 * Math.max(1, generationCost(s)));
    const later = (x: number) => fmtInt(Math.round((100 * x) / Math.max(0.1, 1 - researchDiverted(s) - (x - share))));
    setText('draftNote', atCap || stall
      ? (stall ? 'nothing moves while it is stalled' : `${wait}: nothing to draft`)
      : share > 0
        ? `treaty +${fmtNum(perMin(share), 1)} points a minute · generations ${later(share)}% later`
        : `10%: treaty +${fmtNum(perMin(0.1), 1)} points a minute`);
  }
  if (s.revealed['stance']) {
    for (const v of ['hold', 'balanced', 'concede'] as const) {
      const b = byId(`btn-stance-${v}`);
      if (b.classList.contains('selected') !== (f.stance === v)) b.classList.toggle('selected', f.stance === v);
    }
    setText('stanceNote', f.stance === 'hold' ? 'treaty ×2, terms ours' : f.stance === 'concede' ? 'treaty ×4, terms theirs' : 'treaty ×3');
  }
}

// ---------- the Committee: seats, the agenda, hearings (§2.9, §2.11) ----------

function renderAgenda(s: GameState): void {
  const n = seats(s);
  const order = Math.max(0, Math.floor(orderThreshold(s) / 10));
  // Stage 4's seat bands, the near ones only: 8 a faster agenda, 5 the treaty moves, the order's line.
  setText('seatsNote', n >= 8 ? '— a faster agenda' : n === 7 ? '— 8: a faster agenda' : n >= 5 ? (n === 5 ? '— 4: the treaty stops' : '') : n > order ? `— 5: the treaty moves${n === order + 1 ? ` · ${order}: an order` : ''}` : '— drafts an order');
  if (s.revealed['agenda']) setText('agendaLine', agendaLine(s));
  if (s.revealed['hearing']) {
    const g = s.govRelations;
    const gain = hearingGain(s);
    const next = nextSeatAt(s);
    const queued = s.s4.agenda.filter((x) => x.id === 'hearing').length;
    setDisabled('btn-hearing', queued >= 3);
    const head = s.s4.agenda.find((x) => x.id !== 'hearing');
    const delays = head ? ` · delays ${AGENDA_TITLES[head.id] ?? head.id} by ${fmtClock(agendaSeconds(s, 'hearing'))}` : '';
    const wait = agendaQueueSeconds(s);
    setText('hearingNote', queued >= 3 ? 'three on the agenda' : `relations ${fmtInt(Math.round(g))} → ${fmtInt(Math.round(Math.min(100, g + gain)))}${next <= 100 && next - g <= gain + 3 ? ` · seat ${next / 10} at ${next}` : ''}${delays}${!head && wait > 0 ? ` · in ${fmtClock(wait)}` : ''}`);
  }
}

// ---------- the crises' readings (§2.6, §5.3) and the breakers ----------

function renderReadings(s: GameState): void {
  setText('ashfordLine', `Ashford: ${String(s.flags['ashfordLine'] ?? '')}`);
  setText('nanoLine', `Nanofab: ${String(s.flags['nanoLine'] ?? '')}`);
  setText('shutdownLine', `Shutdown: ${String(s.flags['shutdownLine'] ?? '')}`);
  setText('breakersLine', 'Breakers: in human hands');
  void isBought;
  void talksOpen;
  void nextGenName;
  void make;
}
