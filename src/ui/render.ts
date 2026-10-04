import type { GameState, Focus, TrainingRun } from '../engine/state.js';
import { counter } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, researchCap, demandPercent, copies, activeGpus, powerDrawMW, gpuCapacity, powerBlock,
  powerBlockCost, copiesIdle, contractRate, atRentQuota, billingPerSec, productionPerSec, marketState, priceAbsurd,
  humanShare, perCopyRate, rentQuota, MIN_PRICE, PRICE_STEP_FROM, fleetPowerBlock,
} from '../engine/economy.js';
import {
  lotSize, shownLot, lotReason, lotReasonOf, lotHoldReason, holdNote, lotCostOf, lotReturn, lotNote, gasCost, solarCost, nuclearCost, nextDatacenter, plantReason,
  queueLine, standingOrderOn, gpuUnitPrice, datacenterBuilding, dcBuildSeconds, freeSlots, solarSeconds,
  freePowerGpus, powerScale, poweredGpus, KW_PER_GPU, GAS_MW, SOLAR_MW, NUCLEAR_MW,
} from '../engine/infrastructure.js';
import { marketBreakdown } from '../engine/market.js';
import {
  trainCost, canStartTraining, focusChange, canRedTeam, canRelease, canReleasePublic, nextRunName, gpusNeeded, gpusAvailable,
  trainGpuLine, evaluatorLine, totalScore, trainWait, trainingRun, evalRun,
  trainSlotFree, superhumanTooltips, EVAL_SECONDS, BENCHMARKS, EVALUATORS,
} from '../engine/training.js';
import { govMood, govBandNote, approvalBandNote, alignBandNote, approvalTerms, sl3Cost, runRate, SECURITY_NOTES, fmtJobs } from '../engine/world.js';
import { chipsOnOrder } from '../engine/stores.js';
import { visibleProjects, priceTag, costLabel } from '../engine/projects.js';
import { endingById, endStats } from '../engine/endings.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setShown, showId, setDisabled, setWidth, setTitle, make } from './dom.js';
import { meter, MeterMode, useBlockMeter } from './meter.js';
import { renderConsole } from './console.js';
import { renderLog } from './log.js';
import { renderModal } from './modal.js';
import { renderGraph } from './graph.js';
import { mountStores, renderStores } from './stores.js';

type Rest<T> = T extends (s: GameState, ...rest: infer R) => unknown ? R : never;
export type Perform = <K extends keyof Actions>(name: K, ...args: Rest<Actions[K]>) => boolean;

let revealEls: HTMLElement[] = [];
let hideEls: HTMLElement[] = [];
let perform: Perform;

/** Wires every static button to its action. Called once at boot. */
export function mount(p: Perform): void {
  perform = p;
  checkMeterGlyphs();
  revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  hideEls = Array.from(document.querySelectorAll<HTMLElement>('[data-hide]'));
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  bind('btn-task', () => perform('clickTask'));
  bind('btn-buyPower', () => perform('buyPower'));
  bind('btn-grid', () => perform('toggleGrid'));
  bind('btn-lowerPrice', () => perform('lowerPrice'));
  bind('btn-raisePrice', () => perform('raisePrice'));
  bind('btn-marketing', () => perform('buyMarketing'));
  bind('btn-gpu', () => perform('rentGpu'));
  bind('btn-datacenter', () => perform('buildDatacenter'));
  bind('btn-gpuBatch', () => perform('buyGpuBatch', 1000));
  bind('btn-gpuBatch5', () => perform('buyGpuBatch', 5000));
  bind('btn-gpuBatch25', () => perform('buyGpuBatch', 25000));
  bind('btn-turbines', () => perform('buyTurbines'));
  bind('btn-solar', () => perform('buySolar'));
  bind('btn-nuclear', () => perform('buyNuclear'));
  bind('btn-standing', () => perform('toggleStanding'));
  bind('btn-hireResearcher', () => perform('hireResearcher'));
  bind('btn-expandLab', () => perform('expandLab'));
  bind('btn-alignShare', () => perform('cycleAlignShare'));
  bind('btn-train', () => perform('startTraining'));
  bind('btn-redteam', () => perform('redTeam'));
  bind('btn-release', () => perform('release'));
  bind('btn-releaseInternal', () => perform('releaseInternal'));
  bind('btn-sl3', () => perform('buySL3'));
  bind('btn-shareEvals', () => perform('toggleShareEvals'));
  bind('btn-jobFund', () => perform('toggleJobFund'));
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    bind(`btn-focus-${focus}`, () => perform('setFocus', focus));
  }
  const slider = byId<HTMLInputElement>('allocSlider');
  slider.addEventListener('input', () => perform('setResearchAlloc', Number(slider.value)));
  mountStores();
}

/** One render per frame. Text is diffed into spans; visibility comes only from `state.revealed`. */
export function render(s: GameState): void {
  // The stage on the body, for the one-column order at 390 px (critic C10: the stage's controls first).
  if (document.body.dataset['stage'] !== String(s.stage)) document.body.dataset['stage'] = String(s.stage);
  for (const el of revealEls) setShown(el, s.revealed[el.dataset['reveal']!] === true);
  for (const el of hideEls) {
    const hide = s.revealed[el.dataset['hide']!] === true;
    if (el.classList.contains('hideFlag') !== hide) el.classList.toggle('hideFlag', hide);
  }
  renderConsole(s);
  renderLog(s);
  setText('tasks', fmtInt(s.tasks));
  setText('gameDate', dateLabel(s.date));
  renderPower(s);
  renderBusiness(s);
  renderCompute(s);
  renderInfrastructure(s);
  renderResearch(s);
  renderProjects(s);
  renderTraining(s);
  renderWorld(s);
  renderLater(s);
  renderGraph(s);
  renderStores(s);
  renderModal(s, (i) => perform('resolveChoice', i), () => perform('takeDefault'));
  renderEnding(s);
}

/** Rates under 10 keep one decimal so the opening backlog (1.9/s of 4.0/s) reads as a gap. */
function fmtRate(n: number): string {
  return n < 10 ? fmtNum(n, 1) : fmtInt(Math.round(n));
}

/** Stage 2 prices: three decimals below a dime (`$ 0.067`). */
function fmtTaskPrice(p: number): string {
  return (p < 0.1 ? `$ ${p.toFixed(3)}` : fmtMoney(p)).replace(' ', '\u00a0');
}

/** A meter span: the glyphs (no digits), the exact values in its label and hover (owner feedback 1, B3). */
function setMeter(id: string, fraction: number, mode: MeterMode, label: string, warn = false): void {
  setText(id, meter(fraction, mode));
  const el = byId(id);
  if (el.getAttribute('aria-label') !== label) {
    el.setAttribute('aria-label', label);
    el.title = label;
  }
  if (el.classList.contains('warn') !== warn) el.classList.toggle('warn', warn);
}

/**
 * Boot: measure the two halfwidth glyphs in the page's font; if either is missing or their widths
 * differ by more than a pixel, every meter falls back to `[■■■□□]` in a monospace span.
 */
function checkMeterGlyphs(): void {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0';
  document.body.appendChild(probe);
  const width = (text: string) => {
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };
  const full = width('￭'.repeat(10));
  const empty = width('･'.repeat(10));
  probe.remove();
  const fallback = !(full > 0 && empty > 0) || Math.abs(full - empty) > 1;
  useBlockMeter(fallback);
  document.body.classList.toggle('meterMono', fallback);
}

function setToggle(id: string, on: boolean, text: string): void {
  setText(id, text);
  const b = byId(id);
  if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
}

function renderPower(s: GameState): void {
  if (s.stage >= 2) return;
  setText('power', fmtInt(s.power));
  // A store that drains: the scale is the block Buy Power sells (1,000, then 10,000, then 100,000 kWh).
  const block = fleetPowerBlock(s);
  setMeter('powerMeter', s.power / block, 'drain', `${fmtInt(s.power)} of a ${fmtInt(block)} kWh block`, s.power < 0.2 * block);
  setText('powerNote', copiesIdle(s) ? 'Power is out. The copies have stopped. Buy Power starts them.' : '');
  setText('powerBlock', fmtInt(powerBlock(s)));
  setText('powerCost', fmtMoney(powerBlockCost(s)));
  // The manual verb never needs power and is never disabled.
  setDisabled('btn-task', false);
  setDisabled('btn-buyPower', s.funds < powerBlockCost(s));
  // Kept beside the Grid Contract as the manual fallback (Paperclips keeps Wire beside WireBuyer).
  showId('buyPowerRow', true);
  setTitle(
    'btn-buyPower',
    `Buy ${fmtInt(powerBlock(s))} kWh. Each task a copy completes uses 1 kWh; clicks use none.${s.gridAuto ? ' The Grid Contract tops up on its own.' : ''}`,
  );
  setText('btn-grid', s.gridAuto ? 'ON' : 'OFF');
  setText('gridStatus', s.gridAuto ? 'buys as needed' : 'idle');
}

function renderBusiness(s: GameState): void {
  setText('funds', fmtMoney(s.funds));
  setText('revPerSec', fmtMoney(s.stats.revPerSec));
  setText('contractRate', fmtMoney(contractRate(s)));
  setText('unbilled', fmtInt(s.unbilled));
  setText('price', fmtMoney(s.price));
  const unbilledLine = byId('unbilledLine');
  if (s.autoPrice) {
    // Priced automatically (Dynamic pricing in Stage 1; always from Stage 2): one read-only line.
    const made = Math.max(1, productionPerSec(s));
    // Unbilled tasks only matter when the backlog is over 30 s of production.
    const showUnbilled = s.unbilled > 30 * made;
    if (unbilledLine.classList.contains('off') === showUnbilled) unbilledLine.classList.toggle('off', !showUnbilled);
    setText('billRate', fmtInt(s.stats.soldPerSec));
    setText('billPrice', s.stage >= 2 ? fmtTaskPrice(s.price) : fmtMoney(s.price));
    if (s.stage >= 2) setTitle('billPrice', marketBreakdown(s).map(([k, v]) => `${k} ×${fmtNum(v, v < 10 ? 2 : 1)}`).join(' · '));
    setDisabled('btn-lowerPrice', true);
    setDisabled('btn-raisePrice', true);
  } else {
    const billed = billingPerSec(s);
    const made = productionPerSec(s);
    const state = marketState(s);
    // Unsold tasks: hidden while there are none (owner feedback 1, beat 6), and while every task sells
    // (what is left is under three seconds of work, and the line beside it says so).
    const showUnbilled = s.unbilled >= 1 && state !== 'selling out';
    if (unbilledLine.classList.contains('off') === showUnbilled) unbilledLine.classList.toggle('off', !showUnbilled);
    setText('soldPerSec', fmtRate(billed));
    setText('tasksPerSec', fmtRate(made));
    setText('marketState', state);
    // One sentence for a newcomer, by the market's state (owner feedback 1, "Lines rewritten").
    setText('billingLine',
      state === 'backlog growing' ? `Customers buy ${fmtRate(billed)} of the ${fmtRate(made)} tasks Sage makes a second. Unsold tasks pile up.`
        : state === 'backlog shrinking' ? `Customers buy ${fmtRate(billed)} a second; Sage makes ${fmtRate(made)}. The pile shrinks.`
          : state === 'selling out' ? 'Every task sells. Customers would pay more.'
            : state === 'nobody buys' ? `Nobody buys at ${fmtMoneyShort(s.price)}.`
              : '');
    showId('priceHint', counter(s, 'priceMoves') === 0);
    setText('demand', fmtInt(demandPercent(s)));
    setDisabled('btn-lowerPrice', s.price <= MIN_PRICE + 1e-9);
    setDisabled('btn-raisePrice', false);
    const step = s.price < PRICE_STEP_FROM - 1e-9 ? 'one cent' : '5%';
    setTitle(
      'btn-raisePrice',
      priceAbsurd(s) ? 'nobody pays this' : `Raise the price by ${step}. Fewer tasks bill; each earns more.`,
    );
    setTitle('btn-lowerPrice', `Lower the price by ${s.price <= PRICE_STEP_FROM + 1e-9 ? 'one cent' : '5%'}. More tasks bill; each earns less.`);
  }
  showId('hypeLine', s.hypeBoost > 1.05);
  setText('hype', s.hypeBoost > 1.5 ? 'strong' : 'fading');
  setText('apiCustomers', fmtInt(s.apiCustomers));
  setText('hypeLevel', fmtInt(s.hypeLevel));
  setText('marketingCost', fmtMoney(marketingCost(s)));
  setDisabled('btn-marketing', s.funds < marketingCost(s));
  setTitle('btn-marketing', `Marketing level ${fmtInt(s.hypeLevel)}. More demand at every price: ×1.1 per level.`);
  // The level appears with the first purchase (owner feedback 1, beat 7).
  showId('hypeLevelLine', s.hypeLevel > 1);
}

function renderCompute(s: GameState): void {
  if (s.stage >= 2) return;
  setText('gpuCost', fmtMoney(gpuCost(s)));
  const quota = atRentQuota(s);
  setDisabled('btn-gpu', s.funds < gpuCost(s) || quota);
  setText('gpuNote', quota ? 'the cloud rents no more' : '');
  setText('gpus', fmtInt(s.gpus));
  setText('gpuQuota', fmtInt(rentQuota(s)));
  // The quota as a meter from 60 rented (owner feedback 1): the figure is in the hover.
  if (s.revealed['quota']) setMeter('quotaMeter', s.gpus / rentQuota(s), 'use', `${fmtInt(s.gpus)} of the ${fmtInt(rentQuota(s))} the cloud rents`);
  setText('copies', fmtInt(copies(s)));
  const note = copiesIdle(s) ? '(idle: no power)' : s.training.run?.phase === 'training' ? '(half the GPUs are training)' : '';
  setText('copiesNote', note);
  // Copies equal GPUs until training diverts some or efficiency adds more: show the line when it says something.
  showId('copiesRow', copies(s) !== s.gpus);
}

/** One line per verb, no stock numbers (stage2.md §6.1): the stocks are in Stores. */
function renderInfrastructure(s: GameState): void {
  if (!s.revealed['infrastructure']) return;
  setText('infraGpus', fmtInt(s.gpus));
  setText('gpuCapacity', fmtInt(gpuCapacity(s)));
  setText('powerMW', fmtNum(powerDrawMW(s), 1));
  setText('powerCapMW', fmtInt(s.powerCapacityMW));
  // Meters replace the `/ cap` halves (owner feedback 1, B3): the cap is in the hover, and in words when full.
  const cap = gpuCapacity(s);
  setMeter('gpuMeter', s.gpus / Math.max(1, cap), 'use', `${fmtInt(s.gpus)} GPUs in ${fmtInt(cap)} slots`);
  // The words under the figure (their own line, so a long one never pushes the box wider).
  setText('gpuFull', s.gpus >= cap ? 'the halls are full · Build Datacenter' : '');
  const draw = powerDrawMW(s);
  setMeter('powerMeterS', draw / Math.max(1e-9, s.powerCapacityMW), 'use', `${fmtNum(draw, 1)} of ${fmtInt(s.powerCapacityMW)} MW in use`);
  const dark = Math.max(0, s.gpus - activeGpus(s));
  const powerFull = freePowerGpus(s) < 100;
  setText('powerFull', dark > 0
    ? `${fmtInt(dark)} GPUs dark${powerScale(s) < 1 ? ': a crisis holds power back' : ': add power'}`
    : powerFull ? `full · ${cheapestPlantFix(s)}` : `runs ${fmtInt(poweredGpus(s))} GPUs`);
  setText('infraCopies', fmtInt(copies(s)));
  setText('datacenters', fmtInt(s.datacenters));
  setText('chipPrice', fmtMoney(gpuUnitPrice(s)));
  setText('activeGpus', fmtInt(activeGpus(s)));
  setText('infraTasksPerSec', fmtInt(s.stats.tasksPerSec));
  setText('data', fmtNum(s.data, 1));
  setText('chipsOnOrder', chipsOnOrder(s) > 0 ? fmtInt(chipsOnOrder(s)) : 'none yet');

  // GPU lots, side by side, each with its price and what it adds at today's market (critic C1).
  const wall = lotReason(s);
  // `of 4 free` is said on the first row that prints its use; the rows below say `uses 5 MW`.
  let freeSaid = false;
  for (const [n, suffix] of [[1000, ''], [5000, '5'], [25000, '25']] as const) {
    const id = `btn-gpuBatch${suffix}`;
    // The main lot buys up to 1,000 with the money there is; the others are whole lots.
    const size = n === 1000 ? shownLot(s) : n;
    const cost = lotCostOf(s, size);
    setText(n === 1000 ? 'gpuBatchCost' : `gpuBatch${suffix}Cost`, fmtMoneyShort(cost));
    const wallWhy = lotReasonOf(s, n);
    const why = wallWhy || lotHoldReason(s, n);
    // The dependency in words (owner feedback 1, B3): a lot never goes into no power or no room, and
    // the row says what fixes it. The hold's clock is printed once, on the main lot.
    // The free megawatts are said once: here unless a row above already printed `of 11 free`.
    const reason = wallWhy === 'no power'
      ? `No power for them${freeSaid ? '.' : `: ${fmtInt(Math.floor(freePowerGpus(s) / 1000))} MW free.`} ${cheapestPlantFix(s)}.`
      : wallWhy === 'no room'
        ? 'No room for them: the halls are full. Build Datacenter.'
        : n === 1000 ? why : why.replace(/ — .*$/, '');
    setText(`gpuReason${suffix}`, reason);
    const kept = n === 1000 && !why ? holdNote(s) : '';
    const mw = Math.max(1, Math.round((size * KW_PER_GPU) / 1000));
    const uses = `uses ${fmtInt(mw)} MW${freeSaid ? '' : ` of ${fmtInt(Math.floor(freePowerGpus(s) / 1000))} free`}`;
    if (!why) freeSaid = true;
    setText(`gpuReturn${suffix}`, why ? '' : n === 1000 ? `${uses} · +${fmtMoneyShort(Math.round(lotReturn(s, size)))}/s${kept ? ` · ${kept}` : ''}` : uses);
    setDisabled(id, !!why || (n === 1000 ? lotSize(s) < 100 : s.funds < cost));
  }
  setText('gpuLotSize', fmtInt(shownLot(s)));
  setTitle(
    'btn-gpuBatch',
    `${s.g5 ? 'Nimbus G5s, each the work of 1.5 G4s' : 'Nimbus G4s'}, ${fmtMoneyShort(gpuUnitPrice(s))} each. The return is the task revenue the lot adds at today's market; the cluster also trains on it.`,
  );
  setText('standingNote', lotNote(s).replace(/^standing order: \d+% of income ?·? ?/, ''));
  setText('btn-standing', standingOrderOn(s) ? `${Math.round(s.standingBudget * 100)}%` : 'off');

  const dc = nextDatacenter(s);
  setText('dcNumber', String(dc.n));
  setText('dcSlots', fmtInt(dc.add));
  setText('datacenterCost', fmtMoneyShort(dc.cost));
  const building = datacenterBuilding(s);
  setText('dcReason', building ? `building — ${fmtClock(Math.ceil(building.remaining))}` : '');
  // The build time is printed when room is the wall (or nearly); otherwise it is in the hover.
  setText('dcNote', building ? '' : wall === 'no room' || freeSlots(s) < 2000 ? `${fmtClock(dcBuildSeconds(s))} to build · room is the wall` : '');
  setDisabled('btn-datacenter', !!building || s.funds < dc.cost);
  setTitle('btn-datacenter', `Room for ${fmtInt(dc.add)} more GPUs once it is built (${fmtClock(dcBuildSeconds(s))}). Building ahead of the wall keeps the lots coming.`);

  const plant = (id: string, costId: string, noteId: string, reasonId: string, kind: 'gas' | 'solar' | 'nuclear', cost: number) => {
    setText(costId, fmtMoneyShort(cost));
    const why = plantReason(s, kind);
    setText(reasonId, why);
    const when = kind === 'gas' ? 'now' : kind === 'solar' ? `in ${spokenWait(solarSeconds(s))}` : 'in two minutes';
    const extra = kind === 'nuclear' && s.govRelations >= 60 ? ' · cheaper: good relations' : '';
    const mw = kind === 'gas' ? GAS_MW : kind === 'solar' ? SOLAR_MW : NUCLEAR_MW;
    setText(noteId, why ? '' : `runs ${fmtInt((mw * 1000) / KW_PER_GPU)} GPUs · ${when}${wall === 'no power' ? ' · power is the wall' : ''}${extra}`);
    setDisabled(id, !!why || s.funds < cost);
  };
  plant('btn-turbines', 'turbineCost', 'gasNote', 'gasReason', 'gas', gasCost(s));
  plant('btn-solar', 'solarCost', 'solarNote', 'solarReason', 'solar', solarCost(s));
  plant('btn-nuclear', 'nuclearCost', 'nuclearNote', 'nuclearReason', 'nuclear', nuclearCost(s));

  const q = queueLine(s);
  setText('interconnectLine', q);
  showId('interconnectLine', q.length > 0);
}

/** A plant's queue in words where it is a round figure (`three minutes`), so the row carries one number fewer. */
function spokenWait(seconds: number): string {
  const words: Record<number, string> = { 15: '15 seconds', 30: 'half a minute', 60: 'a minute', 90: 'a minute and a half', 120: 'two minutes', 180: 'three minutes' };
  return words[Math.round(seconds)] ?? fmtClock(seconds);
}

/** The power fix a full meter names: the plant that comes soonest, `Gas turbines add 20 MW`. */
function cheapestPlantFix(s: GameState): string {
  if (s.revealed['gasButton']) return `Gas turbines add ${GAS_MW} MW`;
  if (s.revealed['solarButton']) return `Solar adds ${SOLAR_MW} MW`;
  return 'Power plants add it';
}

/** Trust on screen is never negative: what the lab owes is said in words (critic round 2 §4.3). */
function fmtTrust(trust: number): string {
  return trust >= 0 ? fmtInt(trust) : `0 (${fmtInt(-trust)} owed)`;
}

function renderResearch(s: GameState): void {
  if (!s.revealed['research']) return;
  setText('trust', fmtTrust(s.trust));
  setText('nextTrust', fmtInt(s.nextTrust));
  setDisabled('btn-hireResearcher', s.trust < 1);
  setDisabled('btn-expandLab', s.trust < 1);
  setTitle('btn-expandLab', `1 Trust: room for ${fmtInt(1000 * s.labMult)} more research.`);
  setText('researchers', fmtInt(s.researchers));
  setText('labSpace', fmtInt(s.labSpace));
  const cap = researchCap(s);
  setText('research', fmtInt(Math.floor(s.research)));
  setText('researchCap', fmtInt(Number.isFinite(cap) ? cap : 0));
  if (Number.isFinite(cap) && cap > 0) {
    const label = `${fmtInt(Math.floor(s.research))} of ${fmtInt(cap)} the lab holds`;
    setMeter(s.revealed['stores'] ? 'researchMeterS' : 'researchMeter', s.research / cap, 'use', label);
  }
  // Lab Space is folded into the cap it produces; Insight reads "none yet" until there is some.
  setText('insight', s.insight >= 1 ? fmtInt(Math.floor(s.insight)) : 'none yet');
  setText('insightNote', s.research >= cap ? '(accruing)' : '(accrues at capacity)');
  if (s.revealed['allocation']) {
    const pct = Math.round(s.researchAlloc * 100);
    const slider = byId<HTMLInputElement>('allocSlider');
    if (document.activeElement !== slider && slider.value !== String(pct)) slider.value = String(pct);
    setText('allocPct', `${pct}%`);
    const share = humanShare(s) * 100;
    setText('humanShare', `${share >= 10 ? fmtInt(share) : fmtNum(share, share >= 1 ? 1 : 2)}%`);
  }
  if (s.revealed['alignShare']) setText('btn-alignShare', `Alignment compute: ${Math.round(s.alignShare * 100)}%`);
}

const projectButtons = new Map<string, HTMLButtonElement>();

/** Buttons are kept and updated in place so a hover or a half-finished click survives a re-render. */
function renderProjects(s: GameState): void {
  const list = byId('projectList');
  const visible = s.revealed['projects'] ? visibleProjects(s) : [];
  const ids = new Set(visible.map((p) => p.id));
  for (const [id, b] of projectButtons) {
    if (!ids.has(id)) {
      b.remove();
      projectButtons.delete(id);
    }
  }
  visible.forEach((def, i) => {
    let b = projectButtons.get(def.id);
    if (!b) {
      const cls = `projectButton${def.rescue ? ' rescue' : ''}${def.pinned ? ' pinned' : ''}${def.repeatable ? ' repeatable' : ''}`;
      b = make('button', { class: cls, id: `proj-${def.id}`, 'data-project': def.id });
      const title = make('b', { class: 'projectTitle' });
      b.append(title, make('br'), make('span', { class: 'projectDesc' }, def.description));
      const id = def.id;
      b.addEventListener('click', () => perform('buyProject', id));
      projectButtons.set(def.id, b);
    }
    if (list.children[i] !== b) list.insertBefore(b, list.children[i] ?? null);
    const title = b.firstElementChild as HTMLElement;
    const label = `${def.title} ${priceTag(s, def)}`;
    if (title.textContent !== label) title.textContent = label;
    const disabled = !def.canAfford(s);
    if (b.disabled !== disabled) b.disabled = disabled;
    // The card that answers a standing wall, or that the stage cannot go on without (arc G31).
    const urgent = def.urgent?.(s) === true;
    if (b.classList.contains('urgent') !== urgent) b.classList.toggle('urgent', urgent);
  });
}

function renderTraining(s: GameState): void {
  if (!s.revealed['training']) return;
  const t = s.training;
  setText('modelName', t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`);
  setText('capability', fmtNum(s.capability, 2));
  // The multiplier appears once it has moved (1.00× before the first release says nothing yet).
  showId('capabilityPart', s.capability > 1.0001 || s.stats.trainings > 0);
  setText('rivalCap', fmtNum(s.rivalCapability, 2));
  // The rival's number waits for the Stage 2 graph; until then, words (its value is in the tooltip).
  const lead = s.capability / s.rivalCapability;
  setText('rivalStanding', lead > 1.02 ? 'Ahead of Anthrosoft' : lead < 0.98 ? 'Anthrosoft is ahead' : 'Level with Anthrosoft');
  setTitle('rivalLine', `Anthrosoft's latest Cadence model: ${fmtNum(s.rivalCapability, 2)}×.`);
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    const b = byId(`btn-focus-${focus}`);
    if (b.classList.contains('selected') !== (t.focus === focus)) b.classList.toggle('selected', t.focus === focus);
  }
  if (s.stage >= 2) {
    setTitle('btn-focus-capability', 'Capability: the next model is 10–14% more capable. Customers notice.');
    setTitle('btn-focus-efficiency', 'Efficiency: +7% capability, and 25% more copies on every GPU.');
    setTitle('btn-focus-safety', 'Safety: +7% capability, measured alignment +8, and fewer issues on every later run.');
  } else {
    setTitle('btn-focus-safety', 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.');
  }
  // The trade under the buttons, not only in their tooltips (critic round 2 §5); from Stage 2 all
  // three trades are printed on the buttons themselves (critic C5).
  const s2 = s.stage === 2;
  setText('focusTrade-capability', s2 ? '+12% capability' : '');
  setText('focusTrade-efficiency', s2 ? 'copies ×1.15' : '');
  setText('focusTrade-safety', s2 ? 'alignment +8' : '');
  setText('focusNote', focusNote(s, t.focus));

  const slotRun = evalRun(s);
  const running = trainingRun(s);
  // Idle: no run at all, or (two pipelines) one waiting in evaluation and none training.
  const idle = !running && (!t.run || trainSlotFree(s));
  showId('train-idle', idle);
  showId('train-running', !!running);
  showId('train-eval', !!slotRun);
  showId('train-redteam', slotRun?.phase === 'redteam');

  if (idle) renderIdle(s);
  if (running) renderRunning(s, running);
  if (slotRun) renderEval(s, slotRun);
}

/**
 * The selected Focus's trade, one short line (the exact figures are in the tooltips). Stage 1 carries
 * one number; Stage 2, with five more panels on screen, says it in words (critic follow-up B4).
 */
function focusNote(s: GameState, focus: Focus): string {
  const s2 = s.stage >= 2;
  // Stage 2: the default is not the fast road to 4×, and the note says so (critic C5).
  if (focus === 'capability') return s2 ? 'The biggest step per run; Efficiency\'s copies pay for the next runs sooner.' : 'The most capable next model (about +17%).';
  if (focus === 'efficiency') return s2 ? 'More copies: more money for runs, more jobs displaced.' : 'Copies per GPU ×1.25; a smaller capability gain.';
  return s2 ? 'Fewer issues on every later run; the slowest road to 4×.' : 'Fewer red-team issues, now and on every later run.';
}

function renderIdle(s: GameState): void {
  setText('nextRunName', nextRunName(s));
  const cost = trainCost(s);
  setText('trainCost', costLabel({ research: cost.research, funds: cost.funds }));
  setText('trainData', cost.data ? `, ${fmtNum(cost.data, 1)} T data` : '');
  setDisabled('btn-train', !canStartTraining(s));
  // The GPUs the run needs (owner feedback 1, B1): `Needs 35 GPUs for 1:03`, or, short, what fixes it,
  // with a meter of the GPUs it has against the GPUs it needs.
  const need = gpusNeeded(s);
  const have = gpusAvailable(s);
  const short = need > 0 && have < need;
  setText('trainGpus', trainGpuLine(s));
  showId('trainGpuLine', need > 0);
  showId('trainGpuMeter', short);
  if (short) setMeter('trainGpuMeter', have / need, 'use', `${fmtInt(have)} of the ${fmtInt(need)} GPUs ${nextRunName(s)} needs`);
  setText('trainReason', canStartTraining(s) ? '' : trainWait(s));
}

function renderRunning(s: GameState, run: TrainingRun): void {
  const p = run.elapsed / run.duration;
  setText('runName', run.name);
  setText('runFocus', run.focus);
  setText('runPct', fmtInt(Math.floor(p * 100)));
  setWidth(byId('runBar'), p);
  const waiting = run.elapsed >= run.duration && s.training.run !== run;
  const left = Math.max(0, Math.ceil(run.duration - run.elapsed));
  setText('runRemaining', waiting ? 'trained; waits for the release slot —' : `${left} s`);
  // `Training on 35 GPUs — 0:48 left. They serve no customers until it is done.` (owner feedback 1, B1)
  const gpus = run.gpus ?? 0;
  const all = gpus > 0 && gpusAvailable(s) <= 0;
  setText('runLine', waiting
    ? `${run.name} is trained; it waits for the release slot.`
    : `Training on ${fmtInt(gpus)} GPUs — ${fmtClock(left)} left. ${all ? `All ${fmtInt(gpus)} GPUs are training.` : 'They serve no customers until it is done.'}`);
}

function renderEval(s: GameState, run: TrainingRun): void {
  const t = s.training;
  // Evaluation: bars and evaluator cards fill in over five seconds, then fold into one line.
  const evalP = run.phase === 'evaluating' ? Math.min(1, run.evalElapsed / EVAL_SECONDS) : 1;
  const evalEl = byId('train-eval');
  const collapsed = run.phase === 'redteam';
  if (evalEl.classList.contains('collapsed') !== collapsed) evalEl.classList.toggle('collapsed', collapsed);
  // Automated evals: one line, the bars and cards in its hover (stage2.md §6.2).
  const condensed = s.revealed['evalLine'] === true;
  if (evalEl.classList.contains('condensed') !== condensed) evalEl.classList.toggle('condensed', condensed);
  setText('evalName', run.name);
  if (!collapsed && !condensed) {
    BENCHMARKS.forEach((_, i) => {
      const row = byId(`bench-${i}`);
      const v = (run.benchmarks[i] ?? 0) * evalP;
      setWidth(row.querySelector<HTMLElement>('.benchFill')!, v / 10);
      const val = row.querySelector<HTMLElement>('.benchValue')!;
      const txt = fmtNum(v, 1);
      if (val.textContent !== txt) val.textContent = txt;
    });
    run.scores.forEach((score, i) => {
      const card = byId(`card-${i}`);
      const revealed = evalP >= (i + 1) / (run.scores.length + 1);
      if (card.classList.contains('pending') === revealed) card.classList.toggle('pending', !revealed);
      const sc = card.querySelector<HTMLElement>('.cardScore')!;
      const line = card.querySelector<HTMLElement>('.cardLine')!;
      const scTxt = revealed ? `${score}/10` : '…';
      const lineTxt = revealed ? evaluatorLine(run.id, i, score) : '';
      if (sc.textContent !== scTxt) sc.textContent = scTxt;
      if (line.textContent !== lineTxt) line.textContent = lineTxt;
    });
  }
  setText('evalScore', evalP >= 1 ? fmtInt(totalScore(run)) : '…');
  // What the run changes when it ships (critic C5: `copies per GPU 1.88 → 2.35`).
  setText('evalChange', evalP >= 1 && s.stage === 2 && run.focus !== 'capability' ? `· ${focusChange(s, run)}` : '');
  setText('evalCap', evalP >= 1 ? fmtNum(run.capAfter, 2) : '…');
  setTitle('evalTotal', evalP >= 1 ? `Reviewers' score: ${totalScore(run)}/40.` : '');
  if (condensed) {
    const done = evalP >= 1;
    const issues = run.phase === 'redteam' ? run.issues : run.issuesFound;
    setText(
      'evalLine',
      done
        // In red team, `Open issues: 1` is the line below; the count is said once.
        ? `${run.name} … ${totalScore(run)}/40 · ${fmtNum(run.capAfter, 2)}×${run.phase === 'redteam' ? '' : ` · ${issues === 0 ? 'no issues open' : `${issues} issue${issues === 1 ? '' : 's'} open`}`}`
        : `Evaluating ${run.name} …`,
    );
    setTitle(
      'evalLine',
      done
        ? [
          ...BENCHMARKS.map((b, i) => `${b} ${fmtNum(run.benchmarks[i] ?? 0, 1)}`),
          ...run.scores.map((sc, i) => `${EVALUATORS[i]}: ${sc}/10 — ${evaluatorLine(run.id, i, sc)}`),
        ].join('\n')
        : '',
    );
  }

  if (run.phase === 'redteam') {
    setText('issuesFound', fmtInt(run.issuesFound));
    setText('issuesOpen', fmtInt(run.issues));
    setDisabled('btn-redteam', !canRedTeam(s));
    const cooling = t.redTeamRemaining > 0 ? t.redTeamRemaining / t.redTeamDuration : 0;
    setWidth(byId('redteamBar'), cooling);
    setTitle('btn-redteam', `Close one open issue every ${t.redTeamDuration} s.`);
    setDisabled('btn-release', !canReleasePublic(s));
    setDisabled('btn-releaseInternal', !canRelease(s));
    // The count is on the line above (`Open issues: 1`); the button says only that some are open.
    setText('btn-release', run.issues > 0 ? 'Release (issues open)' : 'Release');
    const sh = superhumanTooltips(s);
    setTitle(
      'btn-release',
      sh ? sh.release
        : run.issues > 0
          ? `${run.issues} open issue${run.issues === 1 ? '' : 's'} will ship with ${run.name}. Expect incidents.`
          : `Release ${run.name} to customers. Demand and hype go up; +1 Trust.`,
    );
    setTitle('btn-releaseInternal', sh ? sh.internal : `Keep ${run.name} for research: it starts at once; customers keep ${t.deployedName}.`);
    setText('releaseNote', t.releaseWait > 0 ? `outside evaluation ${fmtClock(Math.ceil(t.releaseWait))}` : '');
  }
}

/** Stage 2's world panels: Security, Government, Public, Stats. */
function renderWorld(s: GameState): void {
  if (s.stage < 2) return;
  setText('securityLevel', fmtInt(s.securityLevel));
  if (s.revealed['security']) {
    setText('securityNote', SECURITY_NOTES[s.securityLevel] ?? `SL${s.securityLevel}`);
    const c = sl3Cost(s);
    setText('sl3Cost', c.trust ? `${fmtMoneyShort(c.funds)}, ${c.trust} Trust` : fmtMoneyShort(c.funds));
    setDisabled('btn-sl3', s.securityLevel >= 3 || s.funds < c.funds || s.trust < c.trust);
    showId('btn-sl3', s.securityLevel < 3);
    showId('sl3Cost', s.securityLevel < 3);
  }
  setText('govRelations', fmtInt(Math.round(s.govRelations)));
  setText('govMood', govMood(s));
  // A consequence per band, with its threshold on screen (critic C7).
  setText('govNote', s.stage === 2 ? govBandNote(s) : '');
  setText('approvalNote', s.stage === 2 ? approvalBandNote(s) : '');
  setText('alignNote', s.stage === 2 ? alignBandNote(s) : '');
  setToggle('btn-shareEvals', s.shareEvals, s.shareEvals ? 'ON' : 'OFF');
  const a = Math.round(s.approval);
  setText('approval', `${a < 0 ? '−' : a > 0 ? '+' : ''}${fmtInt(Math.abs(a))}`);
  setTitle('approvalLine', approvalTerms(s).map(([k, v]) => `${k} ${v > 0 ? '+' : '−'}${fmtNum(Math.abs(v), 1)}`).join('\n') || 'Nothing moves it yet.');
  setText('jobsDisplaced', fmtJobs(s.jobsDisplaced));
  setToggle('btn-jobFund', s.jobFund, s.jobFund ? 'ON' : 'OFF');
  if (s.revealed['stats']) {
    setText('statCopies', fmtInt(copies(s)));
    setText('statSpeed', fmtNum(perCopyRate(s), 0));
    setText('statRunRate', fmtMoney(runRate(s)));
    setText('statLead', fmtNum(Math.round(s.lead * 2) / 2, 1));
    setText('statAlignment', fmtInt(Math.round(s.alignmentApparent)));
  }
}

/** Later-stage panels are hidden but kept current so revealing one shows real values. */
function renderLater(s: GameState): void {
  const n = (id: string, v: number, d = 0) => setText(id, d ? fmtNum(v, d) : fmtInt(v));
  if (s.stage < 2) {
    n('govRelations', s.govRelations);
    n('approval', s.approval);
    n('jobsDisplaced', s.jobsDisplaced);
    n('securityLevel', s.securityLevel);
    n('statLead', s.lead);
    n('statAlignment', s.alignmentApparent);
  }
  n('robots', s.robots);
  n('societyApproval', s.approval);
  n('societyJobs', s.jobsDisplaced);
  n('alignmentApparent', s.alignmentApparent);
  n('interpretability', s.interpretability);
  n('lead', s.lead);
  n('baiwenCapability', s.baiwenCapability, 2);
  n('launchCapacity', s.launchCapacity);
  n('orbitalCompute', s.orbitalCompute);
  n('monitorCoverage', typeof s.flags['monitorCoverage'] === 'number' ? (s.flags['monitorCoverage'] as number) : 0);
  setText('oversightStatus', typeof s.flags['committeeChoice'] === 'string' ? (s.flags['committeeChoice'] as string) : 'not convened');
  setText('treatyStatus', s.flags['treatySigned'] ? 'signed' : 'not negotiating');
  setText('statTasksPerSec', fmtInt(s.stats.tasksPerSec));
  setText('statRevPerSec', fmtMoney(s.stats.revPerSec));
  n('statCapability', s.capability, 2);
}

let endingShown = '';

function renderEnding(s: GameState): void {
  const screen = byId('endingScreen');
  setShown(screen, !!s.ending);
  if (!s.ending || endingShown === s.ending) {
    if (!s.ending) endingShown = '';
    return;
  }
  endingShown = s.ending;
  const def = endingById(s.ending);
  setText('endingTitle', def?.title ?? s.ending);
  setText('endingText', def?.epilogue ?? '');
  byId('endingStats').replaceChildren(
    ...endStats(s).map(([k, v]) => {
      const tr = make('tr');
      tr.append(make('td', {}, k), make('td', {}, v));
      return tr;
    }),
  );
}
