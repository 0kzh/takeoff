import type { GameState, TrainingRun } from '../engine/state.js';
import { counter, isBought } from '../engine/state.js';
import {
  copies, researchRate, humanShare, RESEARCH_ALLOC_MAX_S3, MONITOR_SHARE_MAX, monitorFloor, potentialTasksPerSec,
} from '../engine/economy.js';
import {
  trainStatus, nextRunName, trainCost, researchUnit, delaySeconds, nextGainPct, EXPERIMENTS_MAX, canApprove,
  canSendBack, autoApproveOn, redteamDepth, gpusNeeded, gpusAvailable, canRedTeam, THOROUGH_SECONDS,
} from '../engine/training.js';
import {
  LOT_SIZES_S3, lotCostOf, orderReasonS3, lotReturn, lotHold, freeSlots, freePowerGpus, nextDatacenter, datacenterBuilding,
  dcBuildSeconds, needsSite2, nuclearCost, reactorQueueFull, REACTOR_MW_S3, KW_PER_GPU, standingOrderOn, inTransit,
  wallFix,
} from '../engine/infrastructure.js';
import { shipmentLine, buildoutLine, buildBudget, hallUrgent, reactorUrgent } from '../engine/stage3.js';
import {
  rogueShare, catchPerMin, monitorModel, reimageCooldown, REIMAGE_COOLDOWN, ALIGN_WORK_MEASURED, ALIGN_WORK_TRUE,
  ROGUE_WARN, ROGUE_BREAKOUT,
} from '../engine/alignment.js';
import {
  seats, baiwenWords, leadTrend, lobbyCost, lobbyGain, counterintelCost, paymentsLevel, approvalTermsS3, approvalTargetS3,
  PAYMENT_APPROVAL, PAYMENT_MAX, PAYMENT_SHARE, publicCap, nextSeatAt, sinkHold,
} from '../engine/world3.js';
import { memoLine, sessionLine, orderLine, orderThreshold } from '../engine/oversight.js';
import { theftRiskNote } from '../engine/events3.js';
import { sl3Cost, SECURITY_NOTES } from '../engine/world.js';
import { visibleProjects, priceTag } from '../engine/projects.js';
import type { ProjectDef } from '../data/projects.js';
import { fmtInt, fmtNum, fmtMoneyShort, fmtClock } from '../engine/format.js';
import { byId, setText, setDisabled, setTitle, setWidth, make } from './dom.js';
import { meter } from './meter.js';
import type { Perform } from './render.js';

/**
 * Stage 3's screen (stage3.md §6): the three-way allocation with its rates, the training loop as the
 * grants leave it, the shipments and the build-out, the Alignment panel and its grant list,
 * Geopolitics, the Oversight Committee, Payments, Re-image. Visibility stays with `revealed` flags;
 * what a grant takes away is switched off here with the `off` class.
 */

let perform: Perform;
let current: GameState | null = null;
const stateRef = (): GameState => current!;

/** The state the last render drew (the switch buttons read it to know which way to step). */
export function noteState3(s: GameState): void {
  current = s;
}

export function mount3(p: Perform): void {
  perform = p;
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  bind('btn-approve', () => perform('approve'));
  bind('btn-sendBack', () => perform('sendBack'));
  bind('btn-experiments', () => perform('runExperiments', 1));
  bind('btn-experiments5', () => perform('runExperiments', 5));
  // The standing switches are one button each that steps through its settings (arc G14: fewer controls).
  bind('btn-depth', () => perform('setRedteamDepth', redteamDepth(stateRef()) === 'quick' ? 'thorough' : 'quick'));
  bind('btn-step', () => {
    const v = (stateRef().flags['stepSize'] as string) || 'normal';
    perform('setStepSize', v === 'small' ? 'normal' : v === 'normal' ? 'large' : 'small');
  });
  bind('btn-hold', () => perform('toggleHold'));
  bind('btn-budget', () => perform('setBuildBudget', buildBudget(stateRef()) === 'lean' ? 'ahead' : 'lean'));
  bind('btn-alignWork', () => perform('alignWork', 1));
  bind('btn-alignWork5', () => perform('alignWork', 5));
  bind('btn-lobby', () => perform('lobby'));
  bind('btn-counterintel', () => perform('counterintel'));
  bind('btn-payments', () => perform('stepPayments', true));
  bind('btn-reimage', () => perform('reimage'));
  const slider = byId<HTMLInputElement>('monitorSlider');
  slider.addEventListener('input', () => perform('setMonitorShare', Number(slider.value)));
}

/** A control a grant took away (or the stage does not use): off the screen, its id kept. */
export function setOff(id: string, off: boolean): void {
  const el = byId(id);
  if (el.classList.contains('off') !== off) el.classList.toggle('off', off);
}

function setOn(id: string, on: boolean): void {
  const b = byId(id);
  if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
}

/** `3.2M`, `450,000`: rates on one line with their control. */
function fmtShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `${fmtNum(n / 1e12, 1)}T`;
  if (a >= 1e9) return `${fmtNum(n / 1e9, 1)}B`;
  if (a >= 1e6) return `${fmtNum(n / 1e6, 1)}M`;
  return fmtInt(Math.round(n));
}

const signed = (n: number, d = 0) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${fmtNum(Math.abs(n), d)}`;

// ---------- Research: three-way allocation (§2.2) ----------

export function renderResearch3(s: GameState): void {
  const slider = byId<HTMLInputElement>('allocSlider');
  const max = String(RESEARCH_ALLOC_MAX_S3);
  if (slider.max !== max) {
    slider.max = max;
    slider.min = '0';
  }
  const rate = researchRate(s);
  // Before Continual learning the slider names the next run's wait; after it, the status line does.
  const need = (trainCost(s).research ?? 0) - s.research;
  const eta = need > 0 && !isBought(s, 'p_auto_train') ? ` · next run in ${fmtClock(need / Math.max(1, rate))}` : '';
  setText('allocRate', ` · ${fmtShort(rate)} research/s${eta}`);
  if (s.revealed['monitors']) {
    const pct = Math.round((s.monitorShare ?? 0) * 100);
    const m = byId<HTMLInputElement>('monitorSlider');
    if (m.max !== String(MONITOR_SHARE_MAX)) m.max = String(MONITOR_SHARE_MAX);
    if (document.activeElement !== m && m.value !== String(pct)) m.value = String(pct);
    setText('monitorPct', `${pct}%`);
    const floor = monitorFloor(s);
    setText('monitorRate', ` · catching ${fmtInt(Math.round(catchPerMin(s) * 100))}% of rogue copies a minute${floor ? ` · ${floor}% at least (conceded)` : ''}`);
    const tasks = Math.max(0, 100 - Math.round(s.researchAlloc * 100) - pct);
    setText('tasksPct', `${tasks}%`);
    setText('tasksRate', ` · ${fmtShort(potentialTasksPerSec(s))} tasks/s`);
  }
  // `Human share of research` leaves once it reads 0.0 % (stage3.md §2.4).
  setOff('humanShareLine', s.flags['humanShareGone'] === true || humanShare(s) < 0.0005);
}

// ---------- Training (§2.5, §2.6) ----------

export function renderTraining3(s: GameState): void {
  const auto = isBought(s, 'p_auto_train');
  if (auto) {
    setText('trainStatus', statusLine(s));
    // The status line carries the wait; the manual row's reason would say it twice.
    setText('trainReason', '');
  }
  // Focus: the trade under each button (G17).
  setText('focusTrade-capability', '+16–22% · alignment team likes it least');
  setText('focusTrade-efficiency', '+10% · copies ×1.2');
  setText('focusTrade-safety', '+10% · measured +6');
  setText('focusNote', '');
  setTitle('btn-focus-capability', 'Capability: +16–22% a run. Each costs some of the alignment nobody can see.');
  setTitle('btn-focus-efficiency', 'Efficiency: +10% capability, copies per GPU ×1.2, more jobs displaced.');
  setTitle('btn-focus-safety', 'Safety: +10% capability, measured alignment +6.');
  // What the grants took: Red-team, then Approve and Send back (a conceded order gives Approve back).
  setOff('btn-redteam', isBought(s, 'p_auto_redteam'));
  setOff('issuesLine', isBought(s, 'p_auto_redteam') && (s.training.run?.issues ?? 0) === 0);
  const signOff = autoApproveOn(s);
  setOff('btn-approve', signOff);
  setOff('btn-sendBack', signOff);
  setDisabled('btn-approve', !canApprove(s));
  setDisabled('btn-sendBack', !canSendBack(s));
  const run = s.training.run;
  if (run && run.phase === 'redteam') {
    setText('btn-approve', run.issues > 0 && !isBought(s, 'p_auto_redteam') ? 'Approve (issues open)' : 'Approve');
    setText('probeFlags', isBought(s, 'p_interp2') ? `Probe flags: ${run.probeFlags ?? 0}` : 'Evals: passed');
    const review = run.reviewLeft ?? 0;
    setText('releaseNote', review > 0 ? `Sage red-teams it — ${fmtClock(Math.ceil(review))}` : signOff ? 'Sage deploys it.' : '');
    setTitle('btn-approve', run.issues > 0 ? `${run.issues} open issue${run.issues === 1 ? '' : 's'} ship with ${run.name}. Expect incidents.` : `Deploy ${run.name} everywhere.`);
  }
  if (s.revealed['experiments']) {
    const unit = researchUnit(s);
    const pts = counter(s, 'expPts');
    const room = pts < EXPERIMENTS_MAX - 1e-9;
    setDisabled('btn-experiments', !room || s.research < unit);
    setDisabled('btn-experiments5', !room || s.research < 5 * unit);
    // Experiments takes twenty units a run at most: one button is enough (arc G14's thirty controls).
    setOff('btn-experiments5', true);
    const name = s.training.pending?.name ?? (s.training.run?.phase === 'training' ? s.training.run.name : nextRunName(s));
    setText('experimentsNote', room
      ? `${nextRunName(s)}: +${fmtNum(nextGainPct(s), 1)}% → +${fmtNum(nextGainPct(s, 0.25), 1)}% · delays it ${fmtClock(delaySeconds(s, unit))}`
      : `${name}: +${fmtNum(nextGainPct(s), 1)}% (the most it takes)`);
  }
  if (s.revealed['redteamDepth']) {
    const d = redteamDepth(s);
    setText('btn-depth', d);
    setOn('btn-depth', d === 'thorough');
    setText('redteamDepthNote', d === 'quick' ? 'issues ship; no wait' : `+${THOROUGH_SECONDS} s a run; nothing ships; measured +0.5`);
  }
  if (s.revealed['stepSize']) {
    const v = (s.flags['stepSize'] as string) || 'normal';
    setText('btn-step', v);
    setOn('btn-step', v !== 'normal');
    setText('stepSizeNote', v === 'small' ? 'gains ×0.6; the alignment team has time to look' : v === 'large' ? 'gains ×1.3; the run the alignment team likes least' : 'the gains as they come');
  }
  if (s.revealed['holdRuns']) {
    const held = s.flags['holdRuns'] === true;
    setText('btn-hold', held ? 'held' : 'running');
    setOn('btn-hold', held);
  }
}

/** `#trainStatus`: the next run's wait, the GPU shortfall, or the hold (stage3.md §2.5). */
function statusLine(s: GameState): string {
  return trainStatus(s);
}

/** The meter on the Train row when the next run is short of GPUs (owner feedback 1, B1). */
export function gpuShort3(s: GameState): { have: number; need: number } | null {
  const need = gpusNeeded(s);
  const have = gpusAvailable(s);
  return need > 0 && have < need ? { have, need } : null;
}

// ---------- Infrastructure (§2.1) ----------

export function renderInfrastructure3(s: GameState): void {
  const sizes: [number, string, string][] = [[LOT_SIZES_S3[0], '', 'gpuLotSize'], [LOT_SIZES_S3[1], '5', 'gpuLot5Size'], [LOT_SIZES_S3[2], '25', 'gpuLot25Size']];
  let freeSaid = false;
  const hold = lotHold(s);
  for (const [n, suffix, sizeId] of sizes) {
    setText(sizeId, fmtInt(n));
    const cost = lotCostOf(s, n);
    setText(suffix ? `gpuBatch${suffix}Cost` : 'gpuBatchCost', fmtMoneyShort(cost));
    const why = orderReasonS3(s, n);
    const held = !why && hold > 0 && s.funds - cost < hold;
    const reason = why === 'no room'
      ? `No room: ${needsSite2(s) ? 'Datacenter 10 needs New Carlisle' : s.flags['buildout'] === true ? 'the build-out orders a hall' : 'build the next datacenter'}.`
      : why === 'no power'
        ? `No power: ${s.flags['buildout'] === true ? 'the build-out orders a reactor' : 'a reactor adds 1,000 MW'}.`
        : why === '2 / 2 on order'
          ? 'queue full'
          : why
            ? why
            : held ? `keeps ${wallFix(s)?.what === 'hall' ? 'the hall\'s' : 'the reactor\'s'} price` : '';
    setText(suffix ? `gpuReason${suffix}` : 'gpuReason', reason);
    const g6 = s.flags['g6'] === true;
    const mw = Math.max(1, Math.round((n * KW_PER_GPU) / 1000));
    const uses = `uses ${fmtInt(mw)} MW${freeSaid ? '' : ` of ${fmtInt(Math.floor(freePowerGpus(s) / 1000))} free`}`;
    if (!why) freeSaid = true;
    setText(suffix ? `gpuReturn${suffix}` : 'gpuReturn', why || held ? '' : `${uses} · +${fmtMoneyShort(Math.round(lotReturn(s, n)))}/s`);
    setDisabled(suffix ? `btn-gpuBatch${suffix}` : 'btn-gpuBatch', !!why || held || s.funds < cost);
    if (!suffix) setTitle('btn-gpuBatch', `${g6 ? 'Nimbus G6s, each the work of 2.5 G4s' : 'Nimbus G5s, each the work of 1.5 G4s'}. Every order is a shipment of 75 s, landing one at a time, two on order; a small lot rides in the shipment that waits.`);
  }
  setText('btn-standing', standingOrderOn(s) ? `${Math.round(s.standingBudget * 100)}%` : 'off');
  setText('standingNote', standingOrderOn(s) ? 'saves for the largest lot it can reach' : '');

  // Halls and the reactor, until the build-out takes them.
  const dc = nextDatacenter(s);
  setText('dcNumber', String(dc.n));
  setText('dcSlots', fmtInt(dc.add));
  setText('datacenterCost', fmtMoneyShort(dc.cost));
  const building = datacenterBuilding(s);
  const site = needsSite2(s);
  setText('dcReason', building ? `building — ${fmtClock(Math.ceil(building.remaining))}` : site ? 'needs the New Carlisle campus' : '');
  setText('dcNote', building || site ? '' : `room for ${fmtInt(Math.floor(dc.add / LOT_SIZES_S3[2]))} more lots · ${fmtClock(dcBuildSeconds(s))}`);
  setDisabled('btn-datacenter', !!building || site || s.funds < dc.cost);
  const hall = hallUrgent(s);
  if (byId('btn-datacenter').classList.contains('urgent') !== hall) byId('btn-datacenter').classList.toggle('urgent', hall);
  setText('nuclearLabel', `Reactor (+${fmtInt(REACTOR_MW_S3)} MW)`);
  const rCost = nuclearCost(s);
  setText('nuclearCost', fmtMoneyShort(rCost));
  const full = reactorQueueFull(s);
  setText('nuclearReason', full ? 'two restarting' : '');
  setText('nuclearNote', full ? '' : `runs ${fmtInt((REACTOR_MW_S3 * 1000) / KW_PER_GPU)} GPUs · in two minutes`);
  setDisabled('btn-nuclear', full || s.funds < rCost);
  setTitle('btn-nuclear', 'A shuttered reactor, restarted for OpenMind: +1,000 MW after a two-minute restart.');
  const reactor = reactorUrgent(s);
  if (byId('btn-nuclear').classList.contains('urgent') !== reactor) byId('btn-nuclear').classList.toggle('urgent', reactor);

  setText('shipmentLine', shipmentLine(s) || 'Shipment: none on order');
  if (s.revealed['buildout']) setText('buildoutLine', buildoutLine(s));
  if (s.revealed['buildBudget']) {
    const b = buildBudget(s);
    setText('btn-budget', b);
    setOn('btn-budget', b === 'ahead');
    setText('buildBudgetNote', b === 'lean' ? 'orders a hall or reactor when the next lot would not fit' : 'keeps one of each building; never stalls; about a tenth more of revenue');
  }
  // Chips on order: what is on its way (Stores).
  const transit = inTransit(s);
  setText('chipsOnOrder', transit > 0 ? fmtInt(transit) : 'none');
}

// ---------- Alignment (§2.6–§2.8, §2.14) ----------

const grantButtons = new Map<string, HTMLButtonElement>();

export function renderAlignment(s: GameState): void {
  const measured = s.alignmentApparent;
  setText('alignmentApparent', fmtNum(measured, 1));
  setText('alignBands', measured >= 80 ? '— the Committee is reassured' : measured >= 55 ? '— 80: reassured · 55: advisories' : '— advisories at every run');
  setText('alignTrue', fmtNum(s.alignmentTrue, 1));
  setText('interpretability', fmtInt(s.interpretability));
  const words = ['the weights are numbers', 'probes on the residual stream', 'probes flag single runs', 'alignment read from the weights', 'drift stops with monitors at 15%', 'neuralese is readable'];
  setText('interpWords', words[Math.min(5, s.interpretability)]!);
  setText('autonomy', fmtInt(s.autonomy));
  setText('autonomyNote', s.autonomy >= 50 ? '— 80: it would not need to ask' : '');
  const marks = typeof s.flags['grantMarks'] === 'string' ? (s.flags['grantMarks'] as string).split('|').map((x) => x.split(':').slice(1).join(':')) : [];
  setTitle('autonomyLine', marks.length ? `Handed over:\n${marks.join('\n')}${s.flags['neuralese'] === 'neuralese' ? '\nNeuralese' : ''}\nWARNING: risk of value drift increased.` : 'Nothing handed over yet.');
  setText('driftLost', fmtInt(Math.floor(s.stats.lostToDrift ?? 0)));
  setText('driftCaught', fmtInt(Math.floor(s.stats.recaptured ?? 0)));
  const share = rogueShare(s);
  setText('rogueMeter', meter(share / ROGUE_BREAKOUT, 'use'));
  const rm = byId('rogueMeter');
  const label = `${fmtNum(share * 100, 1)}% of the fleet against the 5% line`;
  if (rm.title !== label) {
    rm.title = label;
    rm.setAttribute('aria-label', label);
  }
  if (rm.classList.contains('warn') !== share >= ROGUE_WARN) rm.classList.toggle('warn', share >= ROGUE_WARN);
  setText('roguePct', `${fmtNum(share * 100, 1)}%`);
  setText('rogueNote', share >= 0.01 ? `— ${fmtNum(ROGUE_WARN * 100, 1)}: warning · ${fmtInt(ROGUE_BREAKOUT * 100)}: one will try to leave` : '— 5: one will try to leave');
  setText('monitorGen', `Monitor: Sage-${monitorModel(s)}, two generations behind. Efficacy halved.`);
  setText('honeypotLine', s.flags['honeypot'] === 'clean' ? 'Honeypot: behaviour unchanged' : 'Honeypot: it behaves differently unwatched');
  setText('noiseLine', s.flags['noise'] === 'holding' ? 'Noise test: holding back' : 'Noise test: not holding back');
  setText('successorLine', s.flags['successor'] === 'spec' ? 'Successor: aligned to the Spec' : 'Successor: aligned to Sage-4');
  setText('lieLine', `Checkpoints: alignment about ${fmtInt(counter(s, 'lieReading'))}`);
  if (s.revealed['alignWork']) {
    const unit = researchUnit(s);
    setDisabled('btn-alignWork', s.research < unit);
    setDisabled('btn-alignWork5', s.research < 5 * unit);
    // One button, as with Experiments: the approach's shelf needs the place (arc G14's thirty controls).
    setOff('btn-alignWork5', true);
    const after = Math.min(100, measured + ALIGN_WORK_MEASURED);
    // Once the weights can be read, the unit's return is the number that matters (the measured one moves too).
    const ret = s.interpretability >= 3
      ? `read ${fmtNum(s.alignmentTrue, 1)} → ${fmtNum(Math.min(100, s.alignmentTrue + ALIGN_WORK_TRUE), 1)}`
      : `measured ${fmtNum(measured, 1)} → ${fmtNum(after, 1)}`;
    setText('alignWorkNote', `${ret} · delays ${nextRunName(s)} ${fmtClock(delaySeconds(s, unit))}`);
  }
  renderGrants(s);
}

/** Grants render in their own list (stage3.md §2.6): a title, a price, at most eight words. */
function renderGrants(s: GameState): void {
  const list = byId('grantList');
  const grants = visibleProjects(s).filter((p) => p.grant === true);
  const ids = new Set(grants.map((p) => p.id));
  for (const [id, b] of grantButtons) {
    if (!ids.has(id)) {
      b.remove();
      grantButtons.delete(id);
    }
  }
  grants.forEach((def, i) => {
    let b = grantButtons.get(def.id);
    if (!b) {
      b = make('button', { class: 'projectButton grant', id: `proj-${def.id}`, 'data-project': def.id });
      b.append(make('b', { class: 'projectTitle' }), make('br'), make('span', { class: 'projectDesc' }, def.description));
      const id = def.id;
      b.addEventListener('click', () => perform('buyProject', id));
      grantButtons.set(def.id, b);
    }
    if (list.children[i] !== b) list.insertBefore(b, list.children[i] ?? null);
    grantLabel(s, def, b);
  });
}

function grantLabel(s: GameState, def: ProjectDef, b: HTMLButtonElement): void {
  const title = b.firstElementChild as HTMLElement;
  const gated = def.prereq && !def.prereq(s) && def.needs ? ` (${def.needs(s)})` : '';
  const label = `${def.title} ${priceTag(s, def)}${gated}`;
  if (title.textContent !== label) title.textContent = label;
  const disabled = !def.canAfford(s);
  if (b.disabled !== disabled) b.disabled = disabled;
}

// ---------- Security (§2.9) ----------

export function renderSecurity3(s: GameState): void {
  setText('securityNote', SECURITY_NOTES3[s.securityLevel] ?? SECURITY_NOTES[s.securityLevel] ?? `SL${s.securityLevel}`);
  const c = sl3Cost(s);
  setText('sl3Cost', fmtMoneyShort(c.funds));
  setDisabled('btn-sl3', s.securityLevel >= 3 || s.funds < c.funds);
  setOff('btn-sl3', s.securityLevel >= 3);
  setOff('sl3Cost', s.securityLevel >= 3);
  const urgent = s.securityLevel < 3;
  if (byId('btn-sl3').classList.contains('urgent') !== urgent) byId('btn-sl3').classList.toggle('urgent', urgent);
  setText('theftNote', theftRiskNote(s));
  if (s.revealed['reimage']) {
    // The manual answer to a climbing rogue share: on screen while there is a share to answer (or a recharge to watch).
    setOff('btn-reimage', rogueShare(s) < 0.005 && reimageCooldown(s) <= 0);
    const cd = reimageCooldown(s);
    setDisabled('btn-reimage', cd > 0);
    setWidth(byId('reimageBar'), cd / REIMAGE_COOLDOWN);
    setText('reimageNote', cd > 0 ? `ready in ${fmtClock(Math.ceil(cd))}` : `${fmtInt(Math.floor(s.rogueCopies ?? 0))} rogue copies`);
  }
}

const SECURITY_NOTES3: Record<number, string> = {
  4: 'SL4 — clearances, a SCIF, nobody alone with the weights',
  5: 'SL5 — the government is in the building',
};

// ---------- Geopolitics (§2.10) ----------

export function renderGeopolitics(s: GameState): void {
  setText('baiwenLine', `${baiwenWords(s)} (${leadTrend(s)})`);
  const l = s.lead;
  setText('baiwenNote', l >= 4 ? '— Washington relaxes' : l >= 2.5 ? '— 4: Washington relaxes' : l >= 1 ? '— 1: no halt' : l >= 0.5 ? '— no halt · 0.5: Washington panics' : '— Washington panics');
  setText('rivalLine3', `Anthrosoft Cadence-${s.rivalVersion}: ${fmtNum(s.rivalCapability, 1)}×`);
  const blockade = s.flags['blockade'] === true;
  setText('formosaLine', blockade
    ? `Formosa Fab: blockaded ${fmtClock(counter(s, 'blockadeLeft'))}${s.flags['stockpile'] === true ? ' · the stockpile ships' : ''}`
    : s.flags['chipsDear'] === true ? 'Formosa Fab: shipping, prices up' : 'Formosa Fab: shipping');
  setText('marsaLine', s.flags['marsaStruck'] === true ? 'Al-Marsa: struck' : `Al-Marsa: ${fmtInt(1000 * (s.gulfSites || 1))} MW${s.flags['marsaHardened'] === true ? ' · hardened' : ''}`);
  if (s.revealed['counterintel']) {
    const cost = counterintelCost(s);
    setText('counterintelCost', fmtMoneyShort(cost));
    const blocked = s.funds - cost < sinkHold(s);
    setDisabled('btn-counterintel', s.funds < cost || blocked);
    const m = Math.round(Math.abs(s.lead) * 10) / 10;
    setText('counterintelNote', blocked && s.funds >= cost ? 'keeps the wall\'s fix' : `Baiwen: ${fmtNum(m, 1)} → ${fmtNum(Math.round((s.lead + 0.1) * 10) / 10, 1)} months behind`);
  }
}

// ---------- Government, then the Oversight Committee (§2.11) ----------

export function renderOversight(s: GameState): void {
  const seated = s.revealed['oversight'] === true;
  // The Committee takes the government's controls with it (Share evals, Lobby).
  const home = byId(seated ? 'oversightControls' : 'governmentControls');
  for (const id of ['shareEvalsRow', 'lobbyRow']) {
    const row = byId(id);
    if (row.parentElement !== home) home.appendChild(row);
  }
  setText('shareEvalsWho', seated ? 'Committee' : 'Safety Institute');
  if (s.revealed['lobby']) {
    const cost = lobbyCost(s);
    setText('lobbyCost', fmtMoneyShort(cost));
    const blocked = s.funds - cost < sinkHold(s);
    setDisabled('btn-lobby', s.funds < cost || blocked);
    const g = s.govRelations;
    const next = nextSeatAt(s);
    setText('lobbyNote', blocked && s.funds >= cost ? 'keeps the wall\'s fix' : `relations ${fmtNum(g, 1)} → ${fmtNum(Math.min(100, g + lobbyGain(s)), 1)}${next <= 100 ? ` · seat ${next / 10} at ${next}` : ''}`);
  }
  if (!seated) return;
  const n = seats(s);
  setText('seatsMeter', meter(n / 10, 'use'));
  setText('committeeSeats', fmtInt(n));
  const order = Math.max(0, Math.floor(orderThreshold(s) / 10));
  setText('seatsNote', n >= 8 ? '— escorts the chips · 6: hears a halt' : n >= 6 ? '— will hear a halt · 4: slows shipments' : n > order ? `— shipments slow · ${order}: an order` : '— drafts an order');
  setText('majorIncidents', `${fmtInt(s.majorIncidents ?? 0)} of 3`);
  setText('memoLine', memoLine(s));
  setText('sessionLine', sessionLine(s));
  setText('orderLine', orderLine(s));
}

// ---------- Public (§2.12, §2.14) ----------

export function renderPublic3(s: GameState): void {
  const a = Math.round(s.approval);
  setText('approval', `${a < 0 ? '−' : a > 0 ? '+' : ''}${fmtInt(Math.abs(a))}`);
  setText('approvalNote', a >= -15 ? '— −15: lobbying is cheaper · −30: permits slow' : a > -30 ? '— −30: permits slow' : a > -40 ? '— permits slow · −40: riots' : a > -55 ? '— riots · −55: sabotage' : '— sabotage');
  setTitle('approvalLine', approvalTermsS3(s).map(([k, v]) => `${k} ${signed(v, 1)}`).join('\n') || 'Nothing moves it yet.');
  if (s.revealed['payments']) {
    const level = paymentsLevel(s);
    setText('btn-payments', level >= PAYMENT_MAX ? 'level 5 (back to 0)' : `level ${level}`);
    const target = approvalTargetS3(s);
    const up = level >= PAYMENT_MAX ? -PAYMENT_MAX * PAYMENT_APPROVAL : PAYMENT_APPROVAL;
    setText('paymentsNote', `${fmtInt(level * PAYMENT_SHARE * 100)}% of revenue · approval target ${signed(target)} → ${signed(target + up)}`);
  }
  setText('publicModel', `Public model: Sage-4-mini (${fmtNum(publicCap(s), 1)}×)`);
}

// ---------- Stats and Stores (§2.13) ----------

export function renderStats3(s: GameState): void {
  setText('statDrift', fmtInt(Math.floor(s.stats.lostToDrift ?? 0)));
  const all = copies(s);
  setText('monitorCopies', fmtInt(Math.floor(all * (s.monitorShare ?? 0))));
  setText('rogueCopies', fmtInt(Math.floor(s.rogueCopies ?? 0)));
  void freeSlots;
  void canRedTeam;
}

export type { TrainingRun };
