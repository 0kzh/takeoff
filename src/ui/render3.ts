import type { GameState, TrainingRun } from '../engine/state.js';
import { counter, isBought } from '../engine/state.js';
import {
  copies, researchRate, humanShare, RESEARCH_ALLOC_MAX_S3, MONITOR_SHARE_MAX, monitorFloor, potentialTasksPerSec,
} from '../engine/economy.js';
import {
  trainStatus, nextRunName, trainCost, researchUnit, nextGainPct, EXPERIMENTS_MAX, canApprove,
  canSendBack, autoApproveOn, redteamDepth, gpusNeeded, gpusAvailable, canRedTeam, THOROUGH_SECONDS, researchStopped,
} from '../engine/training.js';
import {
  LOT_SIZES_S3, lotCostOf, orderReasonS3, lotReturn, freeSlots, freePowerGpus, nextDatacenter, datacenterBuilding,
  dcBuildSeconds, needsSite2, nuclearCost, reactorQueueFull, REACTOR_MW_S3, KW_PER_GPU, standingOrderOn, inTransit,
  buildEta, roomFixS3, powerFixS3,
} from '../engine/infrastructure.js';
import { shipmentLine, buildoutLine, buildBudget, hallUrgent, reactorUrgent } from '../engine/stage3.js';
import {
  rogueShare, catchPerMin, monitorModel, reimageCooldown, REIMAGE_COOLDOWN, ALIGN_WORK_MEASURED, ALIGN_WORK_TRUE,
  ROGUE_WARN, ROGUE_BREAKOUT,
  alignWorkShare,
} from '../engine/alignment.js';
import {
  seats, baiwenWords, leadTrend, lobbyCost, lobbyGain, counterintelCost, paymentsLevel, approvalTermsS3, approvalTargetS3,
  PAYMENT_APPROVAL, PAYMENT_MAX, PAYMENT_SHARE, publicCap, nextSeatAt,
} from '../engine/world3.js';
import { memoLine, sessionLine, orderLine, orderThreshold } from '../engine/oversight.js';
import { theftRiskNote } from '../engine/events3.js';
import { sl3Cost, SECURITY_NOTES } from '../engine/world.js';
import { visibleProjects, priceTag } from '../engine/projects.js';
import type { ProjectDef } from '../data/projects.js';
import { fmtInt, fmtNum, fmtMoneyShort, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setDisabled, setTitle, make, showId } from './dom.js';
import { renderMeter, renderCooldown } from './meter.js';
import type { Perform } from './render.js';

let perform: Perform;
let current: GameState | null = null;
const stateRef = (): GameState => current!;

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
  bind('btn-depth', () => perform('setRedteamDepth', redteamDepth(stateRef()) === 'quick' ? 'thorough' : 'quick'));
  bind('btn-step', () => {
    const v = (stateRef().flags['stepSize'] as string) || 'normal';
    perform('setStepSize', v === 'small' ? 'normal' : v === 'normal' ? 'large' : 'small');
  });
  bind('btn-hold', () => perform('toggleHold'));
  bind('btn-budget', () => perform('setBuildBudget', buildBudget(stateRef()) === 'lean' ? 'ahead' : 'lean'));
  bind('btn-alignWork', () => perform('alignWork'));
  bind('btn-lobby', () => perform('lobby'));
  bind('btn-counterintel', () => perform('counterintel'));
  bind('btn-payments', () => perform('stepPayments', true));
  bind('btn-reimage', () => perform('reimage'));
  const slider = byId<HTMLInputElement>('monitorSlider');
  slider.addEventListener('input', () => perform('setMonitorShare', Number(slider.value)));
}

export function setOff(id: string, off: boolean): void {
  const el = byId(id);
  if (el.classList.contains('off') !== off) el.classList.toggle('off', off);
}

function setOn(id: string, on: boolean): void {
  const b = byId(id);
  if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
}

export const FOLD_SECONDS = 45;
const firstSeen = new Map<string, number>();

export function folded(s: GameState, key: string): boolean {
  const now = s.stats.timePlayed;
  let at = firstSeen.get(key);
  if (at === undefined) {
    at = document.body.classList.contains('boot') ? now - FOLD_SECONDS : now;
    firstSeen.set(key, at);
  }
  return now - at >= FOLD_SECONDS;
}

function foldNote(s: GameState, id: string, text: string, hostId: string): void {
  const fold = text !== '' && folded(s, `${id}|${text.replace(/[\d.,:%×−+]+/g, '#')}`);
  setText(id, fold ? '' : text);
  if (text) setTitle(hostId, text);
}

function fmtShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `${fmtNum(n / 1e12, 1)}T`;
  if (a >= 1e9) return `${fmtNum(n / 1e9, 1)}B`;
  if (a >= 1e6) return `${fmtNum(n / 1e6, 1)}M`;
  return fmtInt(Math.round(n));
}

const signed = (n: number, d = 0) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${fmtNum(Math.abs(n), d)}`;

export function renderResearch3(s: GameState): void {
  const slider = byId<HTMLInputElement>('allocSlider');
  const max = String(RESEARCH_ALLOC_MAX_S3);
  if (slider.max !== max) {
    slider.max = max;
    slider.min = '5';
  }
  const rate = researchRate(s);
  const need = (trainCost(s).research ?? 0) - s.research;
  const stopped = researchStopped(s);
  const eta = need > 0 && !isBought(s, 'p_auto_train') && stopped ? ` · ${stopped}` : '';
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
  setOff('humanShareLine', s.flags['humanShareGone'] === true || humanShare(s) < 0.0005);
}

export function renderTraining3(s: GameState): void {
  const auto = isBought(s, 'p_auto_train');
  if (auto) {
    setText('trainStatus', statusLine(s));
  }
  setOff('rivalLine', true);
  const need = gpusNeeded(s);
  if (need > 0) showId('trainGpuLine', gpusAvailable(s) < 1.15 * need);
  const focus = s.training.focus;
  setText('focusNote', focus === 'capability' ? 'The most capable next model (+16–22%).'
    : focus === 'efficiency' ? 'Copies per GPU ×1.2; a smaller capability gain (+10%).'
      : 'Measured alignment +6; a smaller capability gain (+10%).');
  setTitle('btn-focus-capability', 'Capability: +16–22% a run. Each costs some of the alignment nobody can see.');
  setTitle('btn-focus-efficiency', 'Efficiency: +10% capability, copies per GPU ×1.2, more jobs displaced.');
  setTitle('btn-focus-safety', 'Safety: +10% capability, measured alignment +6.');
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
    setOff('btn-experiments5', true);
    const name = s.training.pending?.name ?? (s.training.run?.phase === 'training' ? s.training.run.name : nextRunName(s));
    const gain = nextGainPct(s, 0.25) - nextGainPct(s);
    setText('experimentsNote', room
      ? `+${fmtNum(gain, 2)} points · ${fmtShort(unit)} research`
      : `${name} takes no more`);
  }
  if (s.revealed['redteamDepth']) {
    const d = redteamDepth(s);
    setText('btn-depth', d);
    setOn('btn-depth', d === 'thorough');
    setText('redteamDepthNote', d === 'quick' ? 'issues ship · no wait' : `+${THOROUGH_SECONDS} s a run · measured +0.5`);
  }
  if (s.revealed['stepSize']) {
    const v = (s.flags['stepSize'] as string) || 'normal';
    setText('btn-step', v);
    setOn('btn-step', v !== 'normal');
    setText('stepSizeNote', v === 'small' ? 'gains ×0.6 · the team can look' : v === 'large' ? 'gains ×1.3 · the team likes it least' : 'gains as they come');
  }
  if (s.revealed['holdRuns']) {
    const held = s.flags['holdRuns'] === true;
    setText('btn-hold', held ? 'held — release' : 'running');
    setOn('btn-hold', held);
    setText('holdNote', held ? 'no run starts while it is held' : '');
    setTitle('btn-hold', held ? 'Held: no run starts. Click to release it.' : 'Click to hold: no run starts until you release it. Research keeps coming.');
  }
}

function statusLine(s: GameState): string {
  return trainStatus(s);
}

export function gpuShort3(s: GameState): { have: number; need: number } | null {
  const need = gpusNeeded(s);
  const have = gpusAvailable(s);
  return need > 0 && have < need ? { have, need } : null;
}

export function renderInfrastructure3(s: GameState): void {
  const sizes: [number, string, string][] = [[LOT_SIZES_S3[0], '', 'gpuLotSize'], [LOT_SIZES_S3[1], '5', 'gpuLot5Size'], [LOT_SIZES_S3[2], '25', 'gpuLot25Size']];
  let greyShown = false;
  for (const [n, suffix, sizeId] of sizes) {
    setText(sizeId, fmtInt(n));
    const cost = lotCostOf(s, n);
    setText(suffix ? `gpuBatch${suffix}Cost` : 'gpuBatchCost', fmtMoneyShort(cost));
    const why = orderReasonS3(s, n);
    const short = !why && s.buildFund < cost;
    const reason = why === 'no room'
      ? `No room: ${roomFixS3(s)}.`
      : why === 'no power'
        ? `No power: ${powerFixS3(s)}.`
        : why === '2 / 2 on order'
          ? 'queue full'
          : why;
    setText(suffix ? `gpuReason${suffix}` : 'gpuReason', reason);
    const g6 = s.flags['g6'] === true;
    const mw = Math.max(1, Math.round((n * KW_PER_GPU) / 1000));
    const id = suffix ? `btn-gpuBatch${suffix}` : 'btn-gpuBatch';
    setDisabled(id, !!why || short);
    const lit = !why && !short;
    const drawn = lit || (!greyShown && (!!why || buildEta(s, cost) <= 180));
    if (!lit && drawn) greyShown = true;
    setOff(suffix ? `lot${suffix}Row` : 'lotRow', !drawn);
    setTitle(id, `${g6 ? 'Nimbus G6s, each the work of 2.5 G4s' : 'Nimbus G5s, each the work of 1.5 G4s'}. Every order is a shipment of 75 s, landing one at a time, two on order; a small lot rides in the shipment that waits. The lot uses ${fmtInt(mw)} MW (${fmtInt(Math.floor(freePowerGpus(s) / 1000))} free) and adds about ${fmtMoneyShort(Math.round(lotReturn(s, n)))} a second.`);
  }
  setText('btn-standing', standingOrderOn(s) ? 'ON' : 'OFF');
  setOn('btn-standing', standingOrderOn(s));

  const dc = nextDatacenter(s);
  setText('dcNumber', String(dc.n));
  setText('dcSlots', fmtInt(dc.add));
  const building = datacenterBuilding(s);
  setText('datacenterCost', building ? '' : fmtMoneyShort(dc.cost));
  const site = needsSite2(s);
  const dcShort = !building && !site && s.buildFund < dc.cost;
  setText('dcReason', building ? `building — ${fmtClock(Math.ceil(building.remaining))}` : site ? 'needs the New Carlisle campus' : '');
  setTitle('btn-datacenter', `Room for ${fmtInt(Math.floor(dc.add / LOT_SIZES_S3[2]))} more lots once it is built (${fmtClock(dcBuildSeconds(s))}). Paid from the build fund.`);
  setDisabled('btn-datacenter', !!building || site || dcShort);
  const hall = hallUrgent(s);
  if (byId('btn-datacenter').classList.contains('urgent') !== hall) byId('btn-datacenter').classList.toggle('urgent', hall);
  setText('nuclearLabel', 'Reactor');
  setText('nuclearMW', ` (+${fmtInt(REACTOR_MW_S3)} MW)`);
  showId('nuclearMW', true);
  const rCost = nuclearCost(s);
  setText('nuclearCost', fmtMoneyShort(rCost));
  const full = reactorQueueFull(s);
  setText('nuclearReason', full ? 'two restarting' : '');
  setDisabled('btn-nuclear', full || s.buildFund < rCost);
  setTitle('btn-nuclear', `A shuttered reactor, restarted for OpenMind: +1,000 MW after a two-minute restart, enough for ${fmtInt((REACTOR_MW_S3 * 1000) / KW_PER_GPU)} GPUs.`);
  const reactor = reactorUrgent(s);
  if (byId('btn-nuclear').classList.contains('urgent') !== reactor) byId('btn-nuclear').classList.toggle('urgent', reactor);

  setText('shipmentLine', shipmentLine(s) || 'Shipment: none on order');
  if (s.revealed['buildout']) setText('buildoutLine', buildoutLine(s));
  if (s.revealed['buildBudget']) {
    const b = buildBudget(s);
    setText('btn-budget', b);
    setOn('btn-budget', b === 'ahead');
    foldNote(s, 'buildBudgetNote', b === 'lean' ? 'orders a hall or reactor when the next lot would not fit' : 'keeps one of each building; never stalls; about a tenth more of revenue', 'btn-budget');
  }
  const transit = inTransit(s);
  setText('chipsOnOrder', transit > 0 ? fmtInt(transit) : 'none');
}

const grantButtons = new Map<string, HTMLButtonElement>();

export function renderAlignment(s: GameState): void {
  const measured = s.alignmentApparent;
  setText('alignmentApparent', fmtNum(measured, 1));
  setText('alignBands', measured >= 80 ? '— reassured' : measured >= 75 ? '— 80: reassured' : measured >= 55 ? (measured < 60 ? '— 55: advisories' : '') : '— advisories at every run');
  setText('alignTrue', fmtNum(s.alignmentTrue, 1));
  setText('interpretability', fmtInt(s.interpretability));
  const words = ['the weights are numbers', 'probes on the residual stream', 'probes flag single runs', 'alignment read from the weights', 'drift stops with monitors at 15%', 'neuralese is readable'];
  foldNote(s, 'interpWords', words[Math.min(5, s.interpretability)]!, 'interpLine');
  setOff('interpDash', byId('interpWords').textContent === '');
  setText('autonomy', fmtInt(s.autonomy));
  setText('autonomyNote', s.autonomy >= 70 ? '— 80: it would not need to ask' : '');
  const marks = typeof s.flags['grantMarks'] === 'string' ? (s.flags['grantMarks'] as string).split('|').map((x) => x.split(':').slice(1).join(':')) : [];
  setTitle('autonomyLine', marks.length ? `Handed over:\n${marks.join('\n')}${s.flags['neuralese'] === 'neuralese' ? '\nNeuralese' : ''}\nWARNING: risk of value drift increased.` : 'Nothing handed over yet.');
  setText('driftLost', fmtInt(Math.floor(s.stats.lostToDrift ?? 0)));
  setText('driftCaught', fmtInt(Math.floor(s.stats.recaptured ?? 0)));
  setOff('driftCaughtPart', true);
  setTitle('driftLine', `Lost to value drift: ${fmtInt(Math.floor(s.stats.lostToDrift ?? 0))} · recaptured by the monitors: ${fmtInt(Math.floor(s.stats.recaptured ?? 0))}`);
  const share = rogueShare(s);
  const rm = byId('rogueMeter');
  renderMeter(rm, share / ROGUE_BREAKOUT);
  const label = `${fmtNum(share * 100, 1)}% of the fleet against the 5% line`;
  if (rm.title !== label) {
    rm.title = label;
    rm.setAttribute('aria-label', label);
  }
  if (rm.classList.contains('warn') !== share >= ROGUE_WARN) rm.classList.toggle('warn', share >= ROGUE_WARN);
  setText('roguePct', share >= 0.0005 ? `${fmtNum(share * 100, 1)}% of the fleet` : 'none');
  setText('rogueNote', share >= ROGUE_WARN ? `— ${fmtInt(ROGUE_BREAKOUT * 100)}: one will try to leave` : share >= 0.01 ? `— ${fmtNum(ROGUE_WARN * 100, 1)}: warning` : '');
  setText('monitorGen', `Monitor: Sage-${monitorModel(s)}, two generations behind. Efficacy halved.`);
  const when = (key: string) => (typeof s.flags[`${key}At`] === 'number' ? ` (${dateLabel(s.flags[`${key}At`] as number).split(' ')[0]})` : '');
  setText('honeypotLine', `Honeypot${when('honeypot')}: ${s.flags['honeypot'] === 'clean' ? 'behaviour unchanged' : 'it behaves differently unwatched'}`);
  setText('noiseLine', `Noise test${when('noise')}: ${s.flags['noise'] === 'holding' ? 'holding back' : 'not holding back'}`);
  setText('successorLine', `Successor${when('successor')}: ${s.flags['successor'] === 'spec' ? 'aligned to the Spec' : 'aligned to Sage-4'}`);
  setText('lieLine', `Checkpoints${when('lie')}: alignment about ${fmtInt(counter(s, 'lieReading'))}`);
  if (s.revealed['alignWork']) {
    const share = alignWorkShare(s);
    setOff('btn-alignWork5', true);
    setText('btn-alignWork', `Alignment work: ${Math.round(share * 100)}%`);
    const perMin = (60 * researchRate(s) * share) / Math.max(1, researchUnit(s));
    const ret = s.interpretability >= 3
      ? `read from the weights +${fmtNum(ALIGN_WORK_TRUE * perMin, 1)} a minute`
      : `measured +${fmtNum(ALIGN_WORK_MEASURED * perMin, 1)} a minute`;
    const what = s.stage >= 4 ? 'generations' : 'runs';
    setText('alignWorkNote', share > 0 ? `${ret} · ${what} ${fmtInt(Math.round((100 * share) / (1 - share)))}% later` : `10%: measured +${fmtNum(ALIGN_WORK_MEASURED * (60 * researchRate(s) * 0.1) / Math.max(1, researchUnit(s)), 1)} a minute · ${what} 11% later`);
  }
  renderGrants(s);
}

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
    const fold = folded(s, `card:${def.id}`);
    if (b.classList.contains('folded') !== fold) b.classList.toggle('folded', fold);
    const tip = fold ? def.description : '';
    if (b.title !== tip) b.title = tip;
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

export function renderSecurity3(s: GameState): void {
  setText('securityNote', SECURITY_NOTES3[s.securityLevel] ?? SECURITY_NOTES[s.securityLevel] ?? `SL${s.securityLevel}`);
  const c = sl3Cost(s);
  setText('sl3Cost', fmtMoneyShort(c.funds));
  setDisabled('btn-sl3', s.securityLevel >= 3 || s.funds < c.funds);
  setOff('sl3Row', s.securityLevel >= 3);
  const urgent = s.securityLevel < 3;
  if (byId('btn-sl3').classList.contains('urgent') !== urgent) byId('btn-sl3').classList.toggle('urgent', urgent);
  setText('theftNote', theftRiskNote(s));
  if (s.revealed['reimage']) {
    setOff('btn-reimage', rogueShare(s) < 0.005 && reimageCooldown(s) <= 0);
    const cd = reimageCooldown(s);
    setDisabled('btn-reimage', cd > 0);
    renderCooldown(byId('btn-reimage'), byId('reimageBar'), cd / REIMAGE_COOLDOWN);
    setText('reimageNote', cd > 0 ? `ready in ${fmtClock(Math.ceil(cd))}` : '');
  }
}

const SECURITY_NOTES3: Record<number, string> = {
  4: 'SL4 — clearances, a SCIF, nobody alone with the weights',
  5: 'SL5 — the government is in the building',
};

export function renderGeopolitics(s: GameState): void {
  setText('baiwenLine', `${baiwenWords(s)} (${leadTrend(s)})`);
  const l = s.lead;
  setText('baiwenNote', l >= 4 ? '— Washington relaxes' : l >= 3.5 ? '— 4: Washington relaxes' : l >= 1.5 ? '' : l >= 1 ? '— 1: no halt' : l >= 0.5 ? '— no halt · 0.5: Washington panics' : '— Washington panics');
  setText('rivalLine3', `Anthrosoft: ${fmtNum(s.rivalCapability, 1)}×`);
  setTitle('rivalLine3', `Anthrosoft's latest: Cadence-${s.rivalVersion}, ${fmtNum(s.rivalCapability, 2)}×.`);
  const blockade = s.flags['blockade'] === true;
  setText('formosaLine', blockade
    ? `Formosa Fab: blockaded ${fmtClock(counter(s, 'blockadeLeft'))}${s.flags['stockpile'] === true ? ' · the stockpile ships' : ''}`
    : s.flags['chipsDear'] === true ? 'Formosa Fab: shipping, prices up' : 'Formosa Fab: shipping');
  setText('marsaLine', s.flags['marsaStruck'] === true ? 'Al-Marsa: struck' : `Al-Marsa: ${fmtInt(1000 * (s.gulfSites || 1))} MW${s.flags['marsaHardened'] === true ? ' · hardened' : ''}`);
  if (s.revealed['counterintel']) {
    const cost = counterintelCost(s);
    setText('counterintelCost', fmtMoneyShort(cost));
    setDisabled('btn-counterintel', s.funds < cost);
    setText('counterintelNote', 'Baiwen +0.1 month behind');
  }
}

export function renderOversight(s: GameState): void {
  const seated = s.revealed['oversight'] === true;
  const home = byId(seated ? 'oversightControls' : 'governmentControls');
  for (const id of ['shareEvalsRow', 'lobbyRow']) {
    const row = byId(id);
    if (row.parentElement !== home) home.appendChild(row);
  }
  setText('shareEvalsWho', seated ? 'Committee' : 'Safety Institute');
  if (s.revealed['lobby']) {
    const cost = lobbyCost(s);
    setText('lobbyCost', fmtMoneyShort(cost));
    setDisabled('btn-lobby', s.funds < cost);
    const g = s.govRelations;
    const next = nextSeatAt(s);
    const gain = Math.min(100, g + lobbyGain(s)) - g;
    setText('lobbyNote', `relations +${fmtNum(gain, 1)}${next <= 100 && next - g <= 3 ? ` · seat ${next / 10} at ${next}` : ''}`);
    setTitle('btn-lobby', `Forty meetings on the Hill: relations ${fmtNum(g, 1)} → ${fmtNum(g + gain, 1)}${next <= 100 ? `; seat ${next / 10} at ${next}` : ''}. Each unit costs 1.3× the last; the price relaxes a step every 90 s.`);
  }
  if (!seated) return;
  const n = seats(s);
  renderMeter(byId('seatsMeter'), n / 10);
  setTitle('seatsMeter', `${n} of 10 Committee seats`);
  byId('seatsMeter').setAttribute('aria-label', `${n} of 10 Committee seats`);
  setText('committeeSeats', fmtInt(n));
  const order = Math.max(0, Math.floor(orderThreshold(s) / 10));
  setText('seatsNote', n >= 8 ? '— escorts the chips' : n >= 6 ? (n === 6 ? '— will hear a halt · 5: no halt' : '— will hear a halt') : n > order ? (n === order + 1 ? `— shipments slow · ${order}: an order` : '— shipments slow') : '— drafts an order');
  setText('majorIncidents', `${fmtInt(s.majorIncidents ?? 0)} of 3`);
  setOff('incidentsRow', (s.majorIncidents ?? 0) === 0 && counter(s, 'majorTotal') === 0);
  setText('memoLine', memoLine(s));
  setText('sessionLine', sessionLine(s));
  setText('orderLine', orderLine(s));
}

export function renderPublic3(s: GameState): void {
  const a = Math.round(s.approval);
  setText('approval', `${a < 0 ? '−' : a > 0 ? '+' : ''}${fmtInt(Math.abs(a))}`);
  setText('approvalNote', a >= -5 ? '' : a >= -15 ? '— −15: lobbying is cheaper' : a > -30 ? (a <= -20 ? '— −30: permits slow' : '') : a > -40 ? '— permits slow · −40: riots' : a > -55 ? '— riots · −55: sabotage' : '— sabotage');
  setTitle('approvalLine', approvalTermsS3(s).map(([k, v]) => `${k} ${signed(v, 1)}`).join('\n') || 'Nothing moves it yet.');
  if (s.revealed['payments']) {
    const level = paymentsLevel(s);
    setText('btn-payments', level >= PAYMENT_MAX ? 'level 5 (back to 0)' : `level ${level}`);
    const target = approvalTargetS3(s);
    const up = level >= PAYMENT_MAX ? -PAYMENT_MAX * PAYMENT_APPROVAL : PAYMENT_APPROVAL;
    setText('paymentsNote', `${fmtInt(level * PAYMENT_SHARE * 100)}% of revenue · next: approval ${signed(up)}`);
    setTitle('btn-payments', `Impact payments to displaced workers: 3% of revenue a level, approval target +7 a level, 0 to 5. The target is ${signed(target)} now; the next press makes it ${signed(target + up)}.`);
  }
  if (s.revealed['publicModel'] === true) foldNote(s, 'publicModel', `Public model: Sage-4-mini (${fmtNum(publicCap(s), 1)}×)`, 'panel-public');
  else setTitle('panel-public', '');
}

export function renderStats3(s: GameState): void {
  setText('statDrift', fmtInt(Math.floor(s.stats.lostToDrift ?? 0)));
  const all = copies(s);
  setText('monitorCopies', fmtInt(Math.floor(all * (s.monitorShare ?? 0))));
  setText('rogueCopies', fmtInt(Math.floor(s.rogueCopies ?? 0)));
  void freeSlots;
  void canRedTeam;
}

export type { TrainingRun };
