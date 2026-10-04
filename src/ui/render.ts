import type { GameState, Focus, TrainingRun } from '../engine/state.js';
import { counter, isBought } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, researchCap, demandPercent, copies, activeGpus, powerDrawMW, gpuCapacity, powerBlock,
  powerBlockCost, copiesIdle, contractRate, atRentQuota, billingPerSec, productionPerSec, marketState, priceAbsurd,
  humanShare, perCopyRate, rentQuota, MIN_PRICE, PRICE_STEP_FROM, powerSecondsLeft, priceCeiling,
  aiResearchRate, revenueCostOfAlloc, researchRate, insightRate,
} from '../engine/economy.js';
import {
  lotReasonOf, lotCostOf, lotReturn, gasCost, solarCost, nuclearCost, nextDatacenter, plantReason,
  queueLine, standingOrderOn, gpuUnitPrice, datacenterBuilding, dcBuildSeconds, freeSlots, solarSeconds,
  freePowerGpus, powerScale, poweredGpus, KW_PER_GPU, GAS_MW, SOLAR_MW, NUCLEAR_MW,
  buildShortLine, buildEta, buildWall, standingStall, standingLine, lotSizes, lotFits, fundsIncome,
} from '../engine/infrastructure.js';
import { marketBreakdown, qualityMultS2 } from '../engine/market.js';
import {
  trainCost, canStartTraining, focusChange, canRedTeam, canRelease, canReleasePublic, nextRunName, gpusNeeded, gpusAvailable,
  trainGpuLine, evaluatorLine, totalScore, trainWait, trainingRun, evalRun,
  trainSlotFree, superhumanTooltips, EVAL_SECONDS, BENCHMARKS, EVALUATORS, canPressTrain, runPaidInSeconds, delayNote,
  gpusShort, needsDatacenter, labReason,
} from '../engine/training.js';
import { datacenterStatus } from '../data/projects.js';
import { govMood, govBandNote, approvalBandNote, alignBandNote, approvalTerms, sl3Cost, runRate, SECURITY_NOTES, fmtJobs } from '../engine/world.js';
import { chipsOnOrder } from '../engine/stores.js';
import { visibleProjects, priceTag, costLabel } from '../engine/projects.js';
import { endScreen } from '../engine/endings.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setShown, showId, setDisabled, setWidth, setTitle, make } from './dom.js';
import { meter, MeterMode, useBlockMeter } from './meter.js';
import { renderConsole } from './console.js';
import { renderLog } from './log.js';
import { renderModal } from './modal.js';
import { renderGraph } from './graph.js';
import { mountStores, renderStores } from './stores.js';
import {
  mount3, renderResearch3, renderTraining3, renderInfrastructure3, renderAlignment, renderSecurity3, renderGeopolitics,
  renderOversight, renderPublic3, renderStats3, noteState3, setOff, folded,
} from './render3.js';
import { mount4, renderStage4 } from './render4.js';

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
  // The Pause's end screen keeps the first button: it still adds one.
  bind('btn-endingTask', () => perform('clickTask'));
  bind('btn-buyPower', () => perform('buyPower'));
  bind('btn-grid', () => perform('toggleGrid'));
  bind('btn-lowerPrice', () => perform('lowerPrice'));
  bind('btn-raisePrice', () => perform('raisePrice'));
  bind('btn-marketing', () => perform('buyMarketing'));
  bind('btn-gpu', () => perform('rentGpu'));
  bind('btn-datacenter', () => perform('buildDatacenter'));
  // Each row buys the lot it shows now (Stage 2's sizes climb with the fleet; Stage 3 has its own).
  bind('btn-gpuBatch', () => perform('buyLotRow', 0));
  bind('btn-gpuBatch5', () => perform('buyLotRow', 1));
  bind('btn-gpuBatch25', () => perform('buyLotRow', 2));
  bind('btn-turbines', () => perform('buyTurbines'));
  bind('btn-solar', () => perform('buySolar'));
  bind('btn-nuclear', () => perform('buyNuclear'));
  bind('btn-standing', () => perform('toggleStanding'));
  bind('btn-buildShare', () => perform('cycleBuildShare'));
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
  mount3(p);
  mount4(p);
}

/** One render per frame. Text is diffed into spans; visibility comes only from `state.revealed`. */
export function render(s: GameState): void {
  noteState3(s);
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
  renderStage4(s);
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
  // A store that drains: the scale is the block Buy Power sells right now (critic round 3 §10.2: it
  // was the block the fleet warrants, which the button did not sell yet). Red only when it is close
  // to empty in time: under 20 s at the copies' draw, and no Grid Contract topping it up. After the
  // opening the row prints the amount against that scale (`968 of 1,000 kWh`, stage2-round2-fixes.md
  // item 6); above a block the meter is full and the amount stands alone.
  const block = powerBlock(s);
  setText('powerScale', fmtInt(block));
  setOff('powerOf', s.power > block);
  const left = powerSecondsLeft(s);
  const low = left < 20 && !(s.gridAuto && isBought(s, 'p_grid'));
  setMeter('powerMeter', Math.min(1, s.power / block), 'drain', `${fmtInt(s.power)} kWh · a ${fmtInt(block)} kWh block${Number.isFinite(left) ? ` · ${fmtClock(left)} at this draw` : ''}`, low);
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
    setText('demand', fmtInt(demandPercent(s)));
    setDisabled('btn-lowerPrice', s.price <= MIN_PRICE + 1e-9);
    const ceiling = s.price >= priceCeiling(s);
    setDisabled('btn-raisePrice', ceiling);
    const step = s.price < PRICE_STEP_FROM - 1e-9 ? 'one cent' : '5%';
    setTitle(
      'btn-raisePrice',
      ceiling || priceAbsurd(s) ? 'nobody pays this' : `Raise the price by ${step}. Fewer tasks bill; each earns more.`,
    );
    setText('priceHint', ceiling ? 'raise: nobody pays this' : 'lower: more tasks sell, each earns less');
    showId('priceHint', counter(s, 'priceMoves') === 0 || ceiling);
    setTitle('btn-lowerPrice', `Lower the price by ${s.price <= PRICE_STEP_FROM + 1e-9 ? 'one cent' : '5%'}. More tasks bill; each earns less.`);
  }
  showId('hypeLine', s.hypeBoost > 1.05);
  setText('hype', s.hypeBoost > 1.5 ? 'strong' : 'fading');
  setText('apiCustomers', fmtInt(s.apiCustomers));
  setText('hypeLevel', fmtInt(s.hypeLevel));
  setText('marketingCost', fmtMoney(marketingCost(s)));
  // Lit while a run (or, at the wall, First Datacenter) waits for money: what it costs that wait (arc G34).
  setText('marketingDelay', s.stage < 2 && s.funds >= marketingCost(s) ? delayNote(s, { funds: marketingCost(s) }) : '');
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
  // What a GPU costs the waiting run (arc G34); none while the run is short of the GPUs it needs.
  const needed = gpusShort(s) && !needsDatacenter(s);
  setText('gpuDelay', !quota && !needed && s.funds >= gpuCost(s) ? delayNote(s, { funds: gpuCost(s) }) : '');
  setText('gpus', fmtInt(s.gpus));
  setText('gpuQuota', fmtInt(rentQuota(s)));
  // The quota as a meter from 60 rented (owner feedback 1), with the amount and the capacity beside it.
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
  setText('gpuFull', s.gpus >= cap ? (s.stage >= 3 && s.flags['buildout'] === true ? 'the halls are full · the build-out orders one' : 'the halls are full · Build Datacenter') : '');
  const draw = powerDrawMW(s);
  setMeter('powerMeterS', draw / Math.max(1e-9, s.powerCapacityMW), 'use', `${fmtNum(draw, 1)} of ${fmtInt(s.powerCapacityMW)} MW in use`);
  const dark = Math.max(0, s.gpus - activeGpus(s));
  const powerFull = freePowerGpus(s) < 100;
  setText('powerFull', dark > 0
    ? `${fmtInt(dark)} GPUs dark${powerScale(s) < 1 ? ': a crisis holds power back' : ': add power'}`
    : powerFull ? `full · ${s.stage >= 3 ? (s.flags['buildout'] === true ? 'the build-out orders a reactor' : 'a reactor adds 1,000 MW') : cheapestPlantFix(s)}` : s.stage >= 3 ? '' : `runs ${fmtInt(poweredGpus(s))} GPUs`);
  setText('infraCopies', fmtInt(copies(s)));
  setText('datacenters', fmtInt(s.datacenters));
  setText('chipPrice', fmtMoney(gpuUnitPrice(s)));
  setText('activeGpus', fmtInt(activeGpus(s)));
  setText('infraTasksPerSec', fmtInt(s.stats.tasksPerSec));
  setText('data', fmtNum(s.data, 1));
  renderBuildShare(s);
  if (s.stage >= 3) {
    renderInfrastructure3(s);
    return;
  }
  setText('chipsOnOrder', chipsOnOrder(s) > 0 ? fmtInt(chipsOnOrder(s)) : 'none yet');

  // GPU lots, side by side, whole lots from the build fund (arc G34): lit with what each adds, grey
  // only for the fund's shortfall (`$12,400 short — 0:09`), power or room. A grey row more than three
  // minutes from the fund's income is not drawn, and at most one grey lot row is (stage2-round2 item 7).
  let freeSaid = false;
  let greyShown = false;
  const window = lotSizes(s);
  for (const [row, suffix] of [[0, ''], [1, '5'], [2, '25']] as const) {
    const n = window[row]!;
    const id = `btn-gpuBatch${suffix}`;
    const cost = lotCostOf(s, n);
    setText(row === 0 ? 'gpuLotSize' : `gpuLot${suffix}Size`, fmtInt(n));
    setText(row === 0 ? 'gpuBatchCost' : `gpuBatch${suffix}Cost`, fmtMoneyShort(cost));
    const wallWhy = lotReasonOf(s, n);
    const short = wallWhy ? '' : buildShortLine(s, cost);
    const reason = wallWhy === 'no power'
      ? `No power for them${freeSaid ? '.' : `: ${fmtInt(Math.floor(freePowerGpus(s) / 1000))} MW free.`} ${cheapestPlantFix(s)}.`
      : wallWhy === 'no room'
        ? `No room for them: ${freeSlots(s) > 0 ? `${fmtInt(freeSlots(s))} slots left` : 'the halls are full'}. Build Datacenter.`
        : short;
    setText(`gpuReason${suffix}`, reason);
    const lit = !wallWhy && !short;
    const mw = Math.max(1, Math.round((n * KW_PER_GPU) / 1000));
    const uses = `uses ${fmtInt(mw)} MW${freeSaid ? '' : ` of ${fmtInt(Math.floor(freePowerGpus(s) / 1000))} free`}`;
    if (lit) freeSaid = true;
    setText(`gpuReturn${suffix}`, lit ? `${uses} · +${fmtMoneyShort(Math.round(lotReturn(s, n)))}/s` : '');
    setDisabled(id, !lit);
    // Grey is for goals: a wall the row names, or a shortfall the share fills within three minutes.
    const near = !!wallWhy || buildEta(s, cost) <= 180;
    const drawn = lit || (near && !greyShown);
    if (!lit && drawn) greyShown = true;
    setOff(row === 0 ? 'lotRow' : `lot${suffix}Row`, !drawn);
  }
  setTitle(
    'btn-gpuBatch',
    `${s.g5 ? 'Nimbus G5s, each the work of 1.5 G4s' : 'Nimbus G4s'}, ${fmtMoneyShort(gpuUnitPrice(s))} each, from the build fund. The return is the task revenue the lot adds at today's market; the cluster also trains on it.`,
  );
  renderStanding(s);

  const wall = buildWall(s);
  const dc = nextDatacenter(s);
  setText('dcNumber', String(dc.n));
  setText('dcSlots', fmtInt(dc.add));
  setText('datacenterCost', fmtMoneyShort(dc.cost));
  const building = datacenterBuilding(s);
  const dcShort = building ? '' : buildShortLine(s, dc.cost);
  setText('dcReason', building ? `building — ${fmtClock(Math.ceil(building.remaining))}` : dcShort);
  // `1:30 to build · 7,000 slots free`: building ahead prints the idle room it adds to (round 2 §1).
  setText('dcNote', building || dcShort ? '' : `${fmtClock(dcBuildSeconds(s))} to build · ${fmtInt(freeSlots(s))} slots free${wall === 'room' ? ' · room is the wall' : ''}`);
  setDisabled('btn-datacenter', !!building || !!dcShort);
  setTitle('btn-datacenter', `Room for ${fmtInt(dc.add)} more GPUs once it is built (${fmtClock(dcBuildSeconds(s))}). Paid from the build fund.`);
  // The build fund's rows share one grey place (round 2 item 7, `grey is for goals`): a lit row is always
  // drawn, the wall's named fix always, and one grey row within three minutes of the share's income.
  const dcLit = !building && !dcShort;
  const dcDrawn = !!building || dcLit || wall === 'room' || (!greyShown && buildEta(s, dc.cost) <= 180);
  if (!dcLit && !building && wall !== 'room' && dcDrawn) greyShown = true;
  setOff('dcRow', !dcDrawn);
  byId('btn-datacenter').classList.toggle('urgent', wall === 'room' && standingStall(s) === 'room');

  const idleMw = Math.max(0, s.powerCapacityMW - powerDrawMW(s));
  // The idle power is printed once, on the first plant row that is lit (round 2 §1: building ahead
  // prints its idle capacity); the rows below it carry their own capacity only.
  let idleSaid = false;
  // One grey plant row at most, as with the lots (round 2 item 7): the one a power wall names first.
  const plant = (id: string, rowId: string, costId: string, noteId: string, reasonId: string, kind: 'gas' | 'solar' | 'nuclear', cost: number) => {
    setText(costId, fmtMoneyShort(cost));
    const why = plantReason(s, kind);
    const short = why ? '' : buildShortLine(s, cost);
    setText(reasonId, why || short);
    const when = kind === 'gas' ? 'now' : kind === 'solar' ? `in ${spokenWait(solarSeconds(s))}` : 'in two minutes';
    const extra = kind === 'nuclear' && s.govRelations >= 60 ? ' · cheaper: good relations' : '';
    const mw = kind === 'gas' ? GAS_MW : kind === 'solar' ? SOLAR_MW : NUCLEAR_MW;
    const idle = !why && !short && !idleSaid && s.revealed[kind === 'gas' ? 'gasButton' : kind === 'solar' ? 'solarButton' : 'nuclearButton'] === true;
    if (idle) idleSaid = true;
    setText(noteId, why || short ? '' : `runs ${fmtInt((mw * 1000) / KW_PER_GPU)} GPUs · ${when}${idle ? ` · ${fmtNum(idleMw, idleMw < 10 ? 1 : 0)} MW idle` : ''}${wall === 'power' ? ' · power is the wall' : ''}${extra}`);
    setDisabled(id, !!why || !!short);
    // The plant a power wall names stays drawn; any other grey plant only within three minutes.
    const named = wall === 'power' && kind === (s.revealed['gasButton'] ? 'gas' : 'solar');
    const lit = !why && !short;
    const drawn = lit || named || (!greyShown && buildEta(s, cost) <= 180);
    if (!lit && !named && drawn) greyShown = true;
    setOff(rowId, !drawn);
    byId(id).classList.toggle('urgent', named && standingStall(s) === 'power');
  };
  plant('btn-turbines', 'gasRow', 'turbineCost', 'gasNote', 'gasReason', 'gas', gasCost(s));
  plant('btn-solar', 'solarRow', 'solarCost', 'solarNote', 'solarReason', 'solar', solarCost(s));
  plant('btn-nuclear', 'nuclearRow', 'nuclearCost', 'nuclearNote', 'nuclearReason', 'nuclear', nuclearCost(s));

  const q = queueLine(s);
  setText('interconnectLine', q);
  showId('interconnectLine', q.length > 0);
}

/**
 * `Build share: 50% · next 5,000 lot in 0:31 · Sage-2.5 in 0:52` (arc G34): the share moves two
 * printed clocks, the build fund's next lot and the run's price.
 */
function renderBuildShare(s: GameState): void {
  if (!s.revealed['buildShare']) return;
  setText('btn-buildShare', `${Math.round(s.buildShare * 100)}%`);
  setText('buildFund', fmtMoneyShort(Math.floor(s.buildFund)));
  const parts: string[] = [];
  const sizes = lotSizes(s).filter((n) => lotFits(s, n) && lotCostOf(s, n) > s.buildFund);
  // Stage 3 draws one grey lot row with its own clock: the share does not say it twice.
  if (sizes.length && s.stage === 2) {
    const n = sizes[0]!;
    const eta = buildEta(s, lotCostOf(s, n));
    if (Number.isFinite(eta) && eta < 3600) parts.push(`next ${fmtInt(n)} lot in ${fmtClock(Math.max(1, eta))}`);
  }
  // Stage 3's runs are paid in research, not from either purse: the share's one clock is the lot's.
  if (s.stage === 2 && s.revealed['training'] && trainSlotFree(s) && s.training.cooldown <= 0) {
    const eta = runPaidInSeconds(s);
    if (eta >= 1 && Number.isFinite(eta) && eta < 3600) parts.push(`${nextRunName(s)} in ${fmtClock(eta)}`);
  }
  setText('buildShareNote', parts.length ? `· ${parts.join(' · ')}` : '');
}

/** The Standing order's row: `Standing order: on · next lot in 0:31`, or the wall it waits on. */
function renderStanding(s: GameState): void {
  if (!s.revealed['standingOrder']) return;
  const line = standingLine(s);
  const on = standingOrderOn(s);
  setText('btn-standing', on ? 'Standing order: on' : 'Standing order: off');
  setText('standingNote', line.replace(/^Standing order: (on|off) ?·? ?/, '').replace(/^Standing order: /, ''));
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
  // From Stage 2 Trust buys only what names it: the Hire/Expand note goes with them.
  setOff('trustCostNote', s.stage >= 2);
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
    // Its two rates beside it (round 2 item 5): `· research +3,495/s · revenue −24%`.
    if (s.stage === 2) setText('allocRate', ` · research +${fmtInt(Math.round(aiResearchRate(s)))}/s · revenue −${fmtInt(Math.round(revenueCostOfAlloc(s) * 100))}%`);
    const share = humanShare(s) * 100;
    setText('humanShare', `${share >= 10 ? fmtInt(share) : fmtNum(share, share >= 1 ? 1 : 2)}%`);
  }
  if (s.revealed['alignShare']) setText('btn-alignShare', `Alignment compute: ${Math.round(s.alignShare * 100)}%`);
  if (s.stage === 3) renderResearch3(s);
}

const projectButtons = new Map<string, HTMLButtonElement>();

/** Seconds until a card is paid for from what comes in (funds after the build share, research, insight). */
function cardEta(s: GameState, c: { funds?: number; research?: number; insight?: number; trust?: number; data?: number }): number {
  const eta = (need: number | undefined, have: number, rate: number) => {
    const short = (need ?? 0) - have;
    if (short <= 0) return 0;
    return rate > 0 ? short / rate : Infinity;
  };
  if ((c.trust ?? 0) > s.trust) return Infinity;
  return Math.max(
    eta(c.funds, s.funds, fundsIncome(s)),
    eta(c.research, s.research, researchRate(s)),
    eta(c.insight, s.insight, insightRate(s)),
  );
}

/** Buttons are kept and updated in place so a hover or a half-finished click survives a re-render. */
function renderProjects(s: GameState): void {
  const list = byId('projectList');
  const visible = s.revealed['projects'] ? visibleProjects(s).filter((p) => !(p.grant && s.stage >= 3)) : [];
  // Stage 1: the heading is not drawn without a card (stage1-round3-fixes.md §3 (a)).
  setOff('panel-projects', s.stage === 1 && visible.length === 0);
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
      b.append(title, make('br'), make('span', { class: 'projectDesc' }, def.description), make('span', { class: 'projectReason reason' }));
      // First Datacenter's two status lines (§2): the cloud's GPUs against the next model, and the price.
      if (def.id === 'p_datacenter') {
        for (const part of ['Need', 'Money']) {
          const line = make('span', { class: 'projectStatus', id: `dc${part}Line` });
          if (part === 'Need') line.append(make('span', {}, 'Cloud GPUs the next model needs '));
          line.append(make('span', { class: 'meter', id: `dc${part}Meter`, role: 'img' }), make('span', { id: `dc${part}Text` }));
          b.append(line);
        }
      }
      const id = def.id;
      b.addEventListener('click', () => perform('buyProject', id));
      projectButtons.set(def.id, b);
    }
    if (list.children[i] !== b) list.insertBefore(b, list.children[i] ?? null);
    const title = b.firstElementChild as HTMLElement;
    const needs = s.stage >= 3 && def.prereq && def.needs && !def.prereq(s) ? ` (${def.needs(s)})` : '';
    // A purchase that delays the waiting run prints the delay (arc G34 rule 3): `· Sage-2.5 0:41 later`.
    const delay = def.canAfford(s) ? delayNote(s, def.cost(s)) : '';
    const label = `${def.title} ${priceTag(s, def)}${needs}${delay}`;
    if (title.textContent !== label) title.textContent = label;
    // Grey is for goals (stage2-round2-fixes.md item 7): in Stage 2 a card more than three minutes
    // from its purses' income is not drawn; the stage goal and a wall's fix are excepted.
    const far = s.stage === 2 && !def.pinned && !def.rescue && def.urgent?.(s) !== true && cardEta(s, def.cost(s)) > 180;
    if (b.classList.contains('off') !== far) b.classList.toggle('off', far);
    // From Stage 2 a card's description is read in its first 45 s on screen, then lives in its hover.
    const fold = s.stage >= 2 && folded(s, `card:${def.id}`);
    if (b.classList.contains('folded') !== fold) b.classList.toggle('folded', fold);
    const tip = fold ? def.description : '';
    if (b.title !== tip) b.title = tip;
    // A card the lab cannot hold says so, with the fix on screen (§3): `needs a lab that holds 2,000 — Expand Lab`.
    const reason = b.querySelector<HTMLElement>('.projectReason');
    const why = labReason(s, def.cost(s).research ?? 0);
    if (reason && reason.textContent !== why) reason.textContent = why;
    if (def.id === 'p_datacenter' && s.stage === 1) renderDatacenterCard(s);
    const disabled = !def.canAfford(s);
    if (b.disabled !== disabled) b.disabled = disabled;
    // The card that answers a standing wall, or that the stage cannot go on without (arc G31).
    const urgent = def.urgent?.(s) === true;
    if (b.classList.contains('urgent') !== urgent) b.classList.toggle('urgent', urgent);
  });
}

/**
 * First Datacenter's status (stage1-round3-fixes.md §2). Until the wall: `Cloud GPUs the next model
 * needs ｢￭￭￭￭￭￭････｣ 45 of 80` (and `The one after will not fit.` when the run after next is too
 * big for any cloud) and `Price: 71 minutes of income.`; once it is needed, the money meter:
 * `｢￭￭￭･･･････｣ $87,000 short — about 2:25`.
 */
function renderDatacenterCard(s: GameState): void {
  const st = datacenterStatus(s);
  const rent = Math.max(1, st.rent);
  setMeter('dcNeedMeter', st.need / rent, 'use', `${fmtInt(st.need)} GPUs for the next model; the cloud rents ${fmtInt(st.rent)}`);
  setText('dcNeedText', ` ${fmtInt(st.need)} of ${fmtInt(st.rent)}${st.afterTooBig && !st.needed ? '. The one after will not fit.' : ''}`);
  const meterEl = byId('dcMoneyMeter');
  if (st.needed) {
    if (meterEl.classList.contains('off')) meterEl.classList.remove('off');
    setMeter('dcMoneyMeter', st.price > 0 ? s.funds / st.price : 1, 'use', `${fmtMoneyShort(Math.floor(s.funds))} of ${fmtMoneyShort(st.price)}`);
    const eta = Number.isFinite(st.eta) && st.eta < 36000 ? ` — about ${fmtClock(Math.max(1, st.eta))}` : '';
    setText('dcMoneyText', st.short > 0 ? ` ${fmtMoneyShort(Math.ceil(st.short))} short${eta}` : ' in hand');
  } else {
    if (!meterEl.classList.contains('off')) meterEl.classList.add('off');
    const secs = st.incomeSeconds;
    const words = !Number.isFinite(secs) ? 'more than any income yet' : secs >= 600 ? `${fmtInt(Math.round(secs / 60))} minutes of income` : `${fmtClock(secs)} of income`;
    setText('dcMoneyText', `Price: ${words}.`);
  }
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
  // Stage 2: when Anthrosoft leads, the cost is on the line (round 2 item 5): `Anthrosoft leads: market −12%`.
  const marketCut = s.stage === 2 ? Math.round((1 - qualityMultS2(s)) * 100) : 0;
  setText('rivalStanding', lead > 1.02 ? 'Ahead of Anthrosoft' : lead < 0.98 ? (marketCut >= 1 ? `Anthrosoft leads: market −${marketCut}%` : 'Anthrosoft is ahead') : 'Level with Anthrosoft');
  setTitle('rivalLine', `Anthrosoft's latest Cadence model: ${fmtNum(s.rivalCapability, 2)}×.`);
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    const b = byId(`btn-focus-${focus}`);
    if (b.classList.contains('selected') !== (t.focus === focus)) b.classList.toggle('selected', t.focus === focus);
  }
  if (s.stage >= 2) {
    setTitle('btn-focus-capability', 'Capability: the next model is 10–14% more capable. Customers notice.');
    setTitle('btn-focus-efficiency', 'Efficiency: +7% capability, and copies per GPU ×1.15.');
    setTitle('btn-focus-safety', 'Safety: +7% capability, measured alignment +8, and fewer issues on every later run.');
  } else {
    setTitle('btn-focus-safety', 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.');
  }
  // All three trades under the buttons, not in tooltips (critic C5; stage1-round3-fixes.md §4 for Stage 1).
  const s1 = s.stage === 1;
  const s2 = s.stage === 2;
  setText('focusTrade-capability', s2 ? '+12% capability' : s1 ? '+10–14% capability' : '');
  setText('focusTrade-efficiency', s2 ? 'copies ×1.15' : s1 ? '+5%, copies per GPU ×1.25' : '');
  setText('focusTrade-safety', s2 ? 'alignment +8' : s1 ? '+5%, fewer issues for good' : '');
  setText('focusNote', s1 ? '' : focusNote(s, t.focus));

  const slotRun = evalRun(s);
  const running = trainingRun(s);
  // During a run a click changes the next run only, and the row says so (§4).
  setText('focusHead', s1 && (running || slotRun) ? 'Next run:' : 'Focus:');
  // Idle: no run at all, or (two pipelines) one waiting in evaluation and none training.
  const idle = !running && (!t.run || trainSlotFree(s));
  showId('train-idle', idle);
  showId('train-running', !!running);
  showId('train-eval', !!slotRun);
  showId('train-redteam', slotRun?.phase === 'redteam');

  if (idle) renderIdle(s);
  if (running) renderRunning(s, running);
  if (slotRun) renderEval(s, slotRun);
  if (s.stage === 3) renderTraining3(s);
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
  return s2 ? 'Fewer issues on every later run, and measured alignment up.' : 'Fewer red-team issues, now and on every later run.';
}

function renderIdle(s: GameState): void {
  setText('nextRunName', nextRunName(s));
  const cost = trainCost(s);
  setText('trainCost', costLabel({ research: cost.research, funds: cost.funds }));
  setText('trainData', cost.data ? `, ${fmtNum(cost.data, 1)} T data` : '');
  // A price never disables Train (arc G34): with its requirements met it is pressed, and waits armed.
  const armed = s.training.armed === true;
  setDisabled('btn-train', !canPressTrain(s));
  if (byId('btn-train').classList.contains('armed') !== armed) byId('btn-train').classList.toggle('armed', armed);
  setTitle('btn-train', armed ? 'Armed: it starts by itself when paid for. Press again to stand down.' : canStartTraining(s) ? 'Start the run.' : 'Short of its price: press to arm it; it starts by itself when paid for.');
  // The GPUs the run needs (owner feedback 1, B1): `Needs 35 GPUs for 1:03`, or, short, what fixes it,
  // with a meter of the GPUs it has against the GPUs it needs.
  const need = gpusNeeded(s);
  const have = gpusAvailable(s);
  const short = need > 0 && have < need;
  setText('trainGpus', trainGpuLine(s));
  showId('trainGpuLine', need > 0);
  showId('trainGpuMeter', short);
  if (short) setMeter('trainGpuMeter', have / need, 'use', `${fmtInt(have)} of the ${fmtInt(need)} GPUs ${nextRunName(s)} needs`);
  // At the wall the GPU line names the only fix (First Datacenter); the run's money is beside the point.
  setText('trainReason', canStartTraining(s) || needsDatacenter(s) ? '' : trainWait(s));
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
    : `Training on ${fmtInt(gpus)} GPUs — ${fmtClock(left)} left.${s.stage >= 3 ? '' : ` ${all ? `All ${fmtInt(gpus)} GPUs are training.` : 'They serve no customers until it is done.'}`}`);
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
        ? `${run.name} … ${s.stage >= 3 ? '' : `${totalScore(run)}/40 · `}${fmtNum(run.capAfter, 2)}×${run.phase === 'redteam' ? '' : ` · ${issues === 0 ? 'no issues open' : `${issues} issue${issues === 1 ? '' : 's'} open`}`}`
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
    if (s.stage < 3) setText('releaseNote', t.releaseWait > 0 ? `outside evaluation ${fmtClock(Math.ceil(t.releaseWait))}` : '');
  }
}

/** Stage 2's world panels: Security, Government, Public, Stats. */
function renderWorld(s: GameState): void {
  if (s.stage < 2) return;
  setText('securityLevel', fmtInt(s.securityLevel));
  if (s.stage >= 3) {
    renderWorld3(s);
    return;
  }
  if (s.revealed['security']) {
    setText('securityNote', SECURITY_NOTES[s.securityLevel] ?? `SL${s.securityLevel}`);
    const c = sl3Cost(s);
    const delay = s.securityLevel < 3 && s.funds >= c.funds && s.trust >= c.trust ? delayNote(s, { funds: c.funds }) : '';
    setText('sl3Cost', `${c.trust ? `${fmtMoneyShort(c.funds)}, ${c.trust} Trust` : fmtMoneyShort(c.funds)}${delay}`);
    setDisabled('btn-sl3', s.securityLevel >= 3 || s.funds < c.funds || s.trust < c.trust);
    // Bought, the row goes (critic S2 round 2 §8.8.7: it stayed, greyed, into Stage 3).
    setOff('sl3Row', s.securityLevel >= 3);
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

/** Stage 3's world: Security, Government then Oversight, Public, Alignment, Geopolitics, Stats. */
function renderWorld3(s: GameState): void {
  renderSecurity3(s);
  setText('govRelations', fmtInt(Math.round(s.govRelations)));
  setText('govMood', govMood(s));
  setText('govNote', '');
  setToggle('btn-shareEvals', s.shareEvals, s.shareEvals ? 'ON' : 'OFF');
  setDisabled('btn-shareEvals', s.flags['evalsLocked'] === true);
  renderOversight(s);
  renderPublic3(s);
  setText('jobsDisplaced', fmtJobs(s.jobsDisplaced));
  setToggle('btn-jobFund', s.jobFund, s.jobFund ? 'ON' : 'OFF');
  renderAlignment(s);
  renderGeopolitics(s);
  if (s.revealed['stats']) {
    setText('statCopies', fmtInt(copies(s)));
    setText('statSpeed', fmtNum(perCopyRate(s), 0));
    setText('statRunRate', fmtMoney(runRate(s)));
    setText('statLead', fmtNum(Math.round(s.lead * 2) / 2, 1));
    setText('statAlignment', fmtInt(Math.round(s.alignmentApparent)));
  }
  renderStats3(s);
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
  if (s.stage < 3) {
    n('alignmentApparent', s.alignmentApparent);
    n('interpretability', s.interpretability);
  }
  n('lead', s.lead);
  n('baiwenCapability', s.baiwenCapability, 2);
  n('launchCapacity', s.launchCapacity);
  n('orbitalCompute', s.orbitalCompute);
  setText('treatyStatus', s.flags['treatySigned'] ? 'signed' : 'not negotiating');
  setText('statTasksPerSec', fmtInt(s.stats.tasksPerSec));
  setText('statRevPerSec', fmtMoney(s.stats.revPerSec));
  n('statCapability', s.capability, 2);
}

let endingShown = '';

/**
 * The end screen (stage5.md §7.2): the title; Tasks Completed alone and its sentence (the Pause
 * leaves Complete Task under it, which still adds one); the epilogue; the table; every choice and
 * grant; New game.
 */
function renderEnding(s: GameState): void {
  const screen = byId('endingScreen');
  setShown(screen, !!s.ending);
  if (document.body.classList.contains('ended') !== !!s.ending) {
    document.body.classList.toggle('ended', !!s.ending);
    if (s.ending) window.scrollTo(0, 0);
  }
  if (!s.ending) {
    endingShown = '';
    return;
  }
  setText('endingTasks', fmtInt(s.tasks));
  if (endingShown === s.ending) return;
  endingShown = s.ending;
  const end = endScreen(s);
  setText('endingTitle', end.title);
  byId('endingCounter').classList.toggle('classified', end.counter === 'classified');
  setText('endingSentence', end.sentence);
  showId('endingTask', end.completeTask);
  byId('endingText').replaceChildren(...end.epilogue.map((line) => make('p', {}, line)));
  byId('endingStats').replaceChildren(
    ...end.rows.map(([k, v]) => {
      const tr = make('tr');
      tr.append(make('td', {}, k), make('td', {}, v));
      return tr;
    }),
  );
  byId('endingChoices').replaceChildren(make('b', {}, 'Choices'), ...end.choices.map((c) => make('div', {}, c)));
}
