import type { GameState, Focus, TrainingRun } from '../engine/state.js';
import { isBought, inPrologue } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, researchCap, demandPercent, copies, activeGpus, powerDrawMW, gpuCapacity, powerBlock,
  powerBlockCost, copiesIdle, contractRate, atRentQuota, billingPerSec, productionPerSec, marketState, priceAbsurd,
  humanShare, perCopyRate, rentQuota, MIN_PRICE, PRICE_STEP_FROM, powerSecondsLeft, priceCeiling,
  aiResearchRate, revenueCostOfAlloc,
} from '../engine/economy.js';
import {
  lotReasonOf, lotCostOf, lotReturn, gasCost, solarCost, nuclearCost, nextDatacenter, plantReason,
  queueLine, standingOrderOn, gpuUnitPrice, datacenterBuilding, dcBuildSeconds, freeSlots, solarSeconds,
  freePowerGpus, powerScale, KW_PER_GPU, GAS_MW, SOLAR_MW, NUCLEAR_MW,
  buildEta, buildWall, standingStall, lotSizes, roomFixS3, powerFixS3,
} from '../engine/infrastructure.js';
import { marketBreakdown, qualityMultS2 } from '../engine/market.js';
import {
  trainCost, canStartTraining, focusChange, canRedTeam, canRelease, canReleasePublic, nextRunName,
  trainGpuFigures, trainGpuFix, evaluatorLine, totalScore, trainingRun, evalRun,
  trainSlotFree, superhumanTooltips, EVAL_SECONDS, BENCHMARKS, EVALUATORS,
  labReason,
} from '../engine/training.js';
import { datacenterStatus } from '../data/projects.js';
import { govMood, govBandNote, approvalBandNote, alignBandNote, approvalTerms, sl3Cost, runRate, SECURITY_NOTES, fmtJobs } from '../engine/world.js';
import { chipsOnOrder } from '../engine/stores.js';
import { visibleProjects, priceTag } from '../engine/projects.js';
import { endScreen } from '../engine/endings.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setShown, showId, setDisabled, setWidth, setTitle, make } from './dom.js';
import { renderMeter, renderCooldown } from './meter.js';
import { renderConsole } from './console.js';
import { renderLog } from './log.js';
import { renderModal } from './modal.js';
import { renderGraph } from './graph.js';
import { mountStores, renderStores } from './stores.js';
import {
  mount3, renderResearch3, renderTraining3, renderInfrastructure3, renderAlignment, renderSecurity3, renderGeopolitics,
  renderOversight, renderPublic3, renderStats3, noteState3, setOff,
} from './render3.js';
import { mount4, renderStage4 } from './render4.js';
import { mount5, renderStage5 } from './render5.js';
import { missionNeeds } from '../engine/space.js';

type Rest<T> = T extends (s: GameState, ...rest: infer R) => unknown ? R : never;
export type Perform = <K extends keyof Actions>(name: K, ...args: Rest<Actions[K]>) => boolean;

let revealEls: HTMLElement[] = [];
let hideEls: HTMLElement[] = [];
let perform: Perform;

/** Wires every static button to its action. Called once at boot. */
export function mount(p: Perform): void {
  perform = p;
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
  mount5(p);
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
  renderStage5(s);
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

/** A bordered meter: the exact values remain in its label and hover. */
function setMeter(id: string, fraction: number, label: string, warn = false): void {
  const el = byId(id);
  renderMeter(el, fraction);
  if (el.getAttribute('aria-label') !== label) {
    el.setAttribute('aria-label', label);
    el.title = label;
  }
  if (el.classList.contains('warn') !== warn) el.classList.toggle('warn', warn);
}

function setToggle(id: string, on: boolean, text: string): void {
  setText(id, text);
  const b = byId(id);
  if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
}

function renderPower(s: GameState): void {
  if (s.stage >= 2) return;
  setText('power', fmtInt(s.power));
  // A store that drains: the bar's scale is the block Buy Power sells right now; the row prints the
  // amount alone, as it did before the bar (the scale is in the bar's hover). Red only when it is
  // close to empty in time: under 20 s at the copies' draw, and no Grid Contract topping it up.
  const block = powerBlock(s);
  const left = powerSecondsLeft(s);
  const low = left < 20 && !(s.gridAuto && isBought(s, 'p_grid'));
  setMeter('powerMeter', Math.min(1, s.power / block), `${fmtInt(s.power)} kWh · a ${fmtInt(block)} kWh block${Number.isFinite(left) ? ` · ${fmtClock(left)} at this draw` : ''}`, low);
  setText('powerNote', copiesIdle(s) ? 'no power — copies idle' : '');
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
    // Unbilled tasks: hidden while there are none (owner feedback 1, beat 6), and while every task sells
    // (what is left is under three seconds of work, and the line beside it says so).
    const showUnbilled = s.unbilled >= 1 && state !== 'selling out';
    if (unbilledLine.classList.contains('off') === showUnbilled) unbilledLine.classList.toggle('off', !showUnbilled);
    setText('soldPerSec', fmtRate(billed));
    setText('tasksPerSec', fmtRate(made));
    // "Billing all 106/s produced" when nothing is left over: one number instead of two equal ones.
    const all = billed >= 0.99 * made && made > 0;
    setText('billingOf', all ? 'Billing all ' : 'Billing ');
    showId('billingOfPart', !all);
    setText('marketState', state === 'nobody buys' ? `nobody buys at ${fmtMoneyShort(s.price)}` : state);
    setText('demand', fmtInt(demandPercent(s)));
    setDisabled('btn-lowerPrice', s.price <= MIN_PRICE + 1e-9);
    const ceiling = s.price >= priceCeiling(s);
    setDisabled('btn-raisePrice', ceiling);
    const step = s.price < PRICE_STEP_FROM - 1e-9 ? 'one cent' : '5%';
    setTitle(
      'btn-raisePrice',
      ceiling || priceAbsurd(s) ? 'nobody pays this' : `Raise the price by ${step}. Fewer tasks bill; each earns more.`,
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
  setText('gpuNote', quota ? 'quota reached — the provider has no more to rent' : '');
  setText('gpus', fmtInt(s.gpus));
  setText('gpuQuota', fmtInt(rentQuota(s)));
  // The quota as a bar from 60 rented (owner feedback 1), with `rented / quota` beside it as before.
  if (s.revealed['quota']) setMeter('quotaMeter', s.gpus / rentQuota(s), `${fmtInt(s.gpus)} of the ${fmtInt(rentQuota(s))} the cloud rents`);
  setText('copies', fmtInt(copies(s)));
  const run = trainingRun(s);
  const note = copiesIdle(s) ? '(idle: no power)' : run ? `(${fmtInt(run.gpus ?? 0)} GPUs are training)` : '';
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
  // Stores rows are one line each: `GPUs 11,000 / 25,000`, and power's capacity alone (the draw is the
  // GPU count again), with a word in front when all of it is in use or some GPUs have none.
  const cap = gpuCapacity(s);
  const dark = Math.max(0, s.gpus - activeGpus(s));
  const powerFull = freePowerGpus(s) < 100;
  setText('powerAll', s.stage >= 3 ? '' : dark > 0 ? `${fmtInt(dark)} GPUs dark: ` : powerFull ? 'all in use: ' : '');
  // Stage 3 names what answers a wall under the figure (the build-out moves the fix around).
  setText('gpuFull', s.stage >= 3 && s.gpus >= cap ? `the halls are full · ${roomFixS3(s)}` : '');
  setText('powerFull', s.stage < 3 ? '' : dark > 0
    ? `${fmtInt(dark)} GPUs dark${powerScale(s) < 1 ? ': a crisis holds power back' : ': add power'}`
    : powerFull ? `full · ${powerFixS3(s)}` : '');
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

  // GPU lots, whole lots from the build fund: `Buy GPUs (1,000) $120,000`, and beside a greyed button
  // the wall that greys it (`no room`, `no power`); short of money the button is grey and says nothing
  // (the fund is in Stores). A grey row more than three minutes from the fund's income is not drawn,
  // and at most one grey lot row is.
  let greyShown = false;
  const window = lotSizes(s);
  for (const [row, suffix] of [[0, ''], [1, '5'], [2, '25']] as const) {
    const n = window[row]!;
    const id = `btn-gpuBatch${suffix}`;
    const cost = lotCostOf(s, n);
    setText(row === 0 ? 'gpuLotSize' : `gpuLot${suffix}Size`, fmtInt(n));
    setText(row === 0 ? 'gpuBatchCost' : `gpuBatch${suffix}Cost`, fmtMoneyShort(cost));
    const wallWhy = lotReasonOf(s, n);
    setText(`gpuReason${suffix}`, wallWhy);
    const lit = !wallWhy && s.buildFund >= cost;
    const mw = Math.max(1, Math.round((n * KW_PER_GPU) / 1000));
    setDisabled(id, !lit);
    // What the lot uses and adds is in its hover.
    setTitle(id, `${s.g5 ? 'Nimbus G5s, each the work of 1.5 G4s' : 'Nimbus G4s'}, ${fmtMoneyShort(gpuUnitPrice(s))} each, from the build fund. The lot uses ${fmtInt(mw)} MW (${fmtInt(Math.floor(freePowerGpus(s) / 1000))} free) and adds about ${fmtMoneyShort(Math.round(lotReturn(s, n)))} a second at today's market.`);
    // Grey is for goals: a wall the row names, or a shortfall the share fills within three minutes.
    const near = !!wallWhy || buildEta(s, cost) <= 180;
    const drawn = lit || (near && !greyShown);
    if (!lit && drawn) greyShown = true;
    setOff(row === 0 ? 'lotRow' : `lot${suffix}Row`, !drawn);
  }
  renderStanding(s);

  const wall = buildWall(s);
  const dc = nextDatacenter(s);
  setText('dcNumber', String(dc.n));
  setText('dcSlots', fmtInt(dc.add));
  setText('datacenterCost', fmtMoneyShort(dc.cost));
  const building = datacenterBuilding(s);
  const dcShort = !building && s.buildFund < dc.cost;
  // A hall going up is a named wait; short of money the button is grey and says nothing.
  setText('dcReason', building ? `building — ${fmtClock(Math.ceil(building.remaining))}` : '');
  setDisabled('btn-datacenter', !!building || dcShort);
  setTitle('btn-datacenter', `Room for ${fmtInt(dc.add)} more GPUs once it is built (${fmtClock(dcBuildSeconds(s))}); ${fmtInt(freeSlots(s))} slots are free now. Paid from the build fund.`);
  // The build fund's rows share one grey place (round 2 item 7, `grey is for goals`): a lit row is always
  // drawn, the wall's named fix always, and one grey row within three minutes of the share's income.
  const dcLit = !building && !dcShort;
  const dcDrawn = !!building || dcLit || wall === 'room' || (!greyShown && buildEta(s, dc.cost) <= 180);
  if (!dcLit && !building && wall !== 'room' && dcDrawn) greyShown = true;
  setOff('dcRow', !dcDrawn);
  byId('btn-datacenter').classList.toggle('urgent', wall === 'room' && standingStall(s) === 'room');

  // One grey plant row at most, as with the lots: the one a power wall names first.
  const plant = (id: string, rowId: string, costId: string, reasonId: string, kind: 'gas' | 'solar' | 'nuclear', cost: number) => {
    setText(costId, fmtMoneyShort(cost));
    const why = plantReason(s, kind);
    setText(reasonId, why || (kind === 'solar' ? 'joins the queue' : kind === 'nuclear' && s.govRelations >= 60 ? 'cheaper: good relations' : ''));
    const lit = !why && s.buildFund >= cost;
    setDisabled(id, !lit);
    // The plant a power wall names stays drawn; any other grey plant only within three minutes.
    const named = wall === 'power' && kind === (s.revealed['gasButton'] ? 'gas' : 'solar');
    const drawn = lit || named || (!greyShown && buildEta(s, cost) <= 180);
    if (!lit && !named && drawn) greyShown = true;
    setOff(rowId, !drawn);
    byId(id).classList.toggle('urgent', named && standingStall(s) === 'power');
  };
  plant('btn-turbines', 'gasRow', 'turbineCost', 'gasReason', 'gas', gasCost(s));
  plant('btn-solar', 'solarRow', 'solarCost', 'solarReason', 'solar', solarCost(s));
  plant('btn-nuclear', 'nuclearRow', 'nuclearCost', 'nuclearReason', 'nuclear', nuclearCost(s));
  // A plant's size is on its button until the first one is built (then in its tooltip and the Stores).
  setText('nuclearLabel', 'Nuclear PPA');
  setText('nuclearMW', ` (+${fmtInt(NUCLEAR_MW)} MW)`);
  showId('gasMW', s.gasPlants === 0);
  showId('solarMW', s.solarFarms + s.powerQueue.filter((o) => o.kind === 'solar').length === 0);
  showId('nuclearMW', s.reactors + s.powerQueue.filter((o) => o.kind === 'nuclear').length === 0);
  setTitle('btn-turbines', `Gas turbines: +${GAS_MW} MW at once, enough for ${fmtInt((GAS_MW * 1000) / KW_PER_GPU)} GPUs. The county notices each one.`);
  setTitle('btn-solar', `Solar + storage: +${SOLAR_MW} MW, enough for ${fmtInt((SOLAR_MW * 1000) / KW_PER_GPU)} GPUs, after ${fmtClock(solarSeconds(s))} in the interconnect queue. Rides through curtailment.`);
  setTitle('btn-nuclear', `A shuttered reactor, restarted for OpenMind: +${fmtInt(NUCLEAR_MW)} MW after a two-minute restart, enough for ${fmtInt((NUCLEAR_MW * 1000) / KW_PER_GPU)} GPUs.`);

  const q = queueLine(s);
  setText('interconnectLine', q);
  showId('interconnectLine', q.length > 0);
}

/** `Build share: 50%`: the share of income that fills the build fund (its row is in Stores). */
function renderBuildShare(s: GameState): void {
  if (!s.revealed['buildShare']) return;
  setText('btn-buildShare', `${Math.round(s.buildShare * 100)}%`);
  setText('buildFund', fmtMoneyShort(Math.floor(s.buildFund)));
}

/** `Standing order: ON`, the toggle as it was before the build fund. */
function renderStanding(s: GameState): void {
  if (!s.revealed['standingOrder']) return;
  const on = standingOrderOn(s);
  setToggle('btn-standing', on, on ? 'ON' : 'OFF');
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
  // From Stage 2 Trust buys only what names it: the Hire and Expand row goes with its buttons.
  const hire = s.revealed['hireResearcher'] === true && s.revealed['hireFaded'] !== true;
  setOff('hireRow', s.stage >= 2 && !hire && s.revealed['expandLab'] !== true);
  setOff('trustCostNote', s.stage >= 2);
  setDisabled('btn-expandLab', s.trust < 1);
  setTitle('btn-expandLab', `1 Trust: room for ${fmtInt(1000 * s.labMult)} more research.`);
  setText('researchers', fmtInt(s.researchers));
  setText('labSpace', fmtInt(s.labSpace));
  const cap = researchCap(s);
  setText('research', fmtInt(Math.floor(s.research)));
  setText('researchCap', fmtInt(Number.isFinite(cap) ? cap : 0));
  // Stage 1's research line carries the bar; in Stores the row is `research 320,592 / 416,000`.
  if (Number.isFinite(cap) && cap > 0 && !s.revealed['stores']) {
    setMeter('researchMeter', s.research / cap, `${fmtInt(Math.floor(s.research))} of ${fmtInt(cap)} the lab holds`);
  }
  // Lab Space is folded into the cap it produces; Insight reads "none yet" until there is some.
  setText('insight', s.insight >= 1 ? fmtInt(Math.floor(s.insight)) : 'none yet');
  setText('insightNote', s.research >= cap ? '(accruing)' : '(accrues at capacity)');
  if (s.revealed['allocation']) {
    const pct = Math.round(s.researchAlloc * 100);
    const slider = byId<HTMLInputElement>('allocSlider');
    if (document.activeElement !== slider && slider.value !== String(pct)) slider.value = String(pct);
    setText('allocPct', `${pct}%`);
    // The slider and its share, as before; what the share does is in the slider's hover.
    if (s.stage === 2) setText('allocRate', '');
    setTitle('allocSlider', s.stage === 2 ? `Research +${fmtInt(Math.round(aiResearchRate(s)))} a second; revenue −${fmtInt(Math.round(revenueCostOfAlloc(s) * 100))}%.` : '');
    const share = humanShare(s) * 100;
    setText('humanShare', `${share >= 10 ? fmtInt(share) : fmtNum(share, share >= 1 ? 1 : 2)}%`);
  }
  if (s.revealed['alignShare']) setText('btn-alignShare', `Alignment compute: ${Math.round(s.alignShare * 100)}%`);
  if (s.stage === 3) renderResearch3(s);
}

const projectButtons = new Map<string, HTMLButtonElement>();

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
      const id = def.id;
      b.addEventListener('click', () => perform('buyProject', id));
      projectButtons.set(def.id, b);
    }
    if (list.children[i] !== b) list.insertBefore(b, list.children[i] ?? null);
    const title = b.firstElementChild as HTMLElement;
    const needs = s.stage >= 3 && def.prereq && def.needs && !def.prereq(s) ? ` (${def.needs(s)})` : '';
    // A card is its title, its price and its sentence, in every stage and for as long as it is on screen.
    const label = `${def.title} ${priceTag(s, def)}${needs}`;
    if (title.textContent !== label) title.textContent = label;
    // What a greyed card is waiting on lives in its hover: the lab it needs, or (First Datacenter) the
    // GPUs the next model needs against what the cloud rents.
    const tip = def.id === 'p_datacenter' && s.stage === 1 ? datacenterTip(s) : labReason(s, def.cost(s).research ?? 0);
    if (b.title !== tip) b.title = tip;
    // Stage 5: a mission is grey only while its fund is short, and says by how much and when (§2.2).
    const reason = b.querySelector<HTMLElement>('.projectReason');
    const why = def.mission ? missionNeeds(s, def) : '';
    if (reason && reason.textContent !== why) reason.textContent = why;
    const disabled = !def.canAfford(s);
    if (b.disabled !== disabled) b.disabled = disabled;
    // The card that answers a standing wall, or that the stage cannot go on without (arc G31).
    const urgent = def.urgent?.(s) === true;
    if (b.classList.contains('urgent') !== urgent) b.classList.toggle('urgent', urgent);
  });
}

/** First Datacenter's hover: the GPUs the next model needs against what the cloud rents. */
function datacenterTip(s: GameState): string {
  const st = datacenterStatus(s);
  return `The next model needs ${fmtInt(st.need)} GPUs; the cloud rents ${fmtInt(st.rent)}.${st.afterTooBig && !st.needed ? ' The one after will not fit.' : ''}`;
}

function renderTraining(s: GameState): void {
  if (!s.revealed['training']) return;
  const t = s.training;
  // The prologue (docs/specs/early-train.md): before Sage-1 is deployed the panel is the Train row only.
  setOff('modelLines', inPrologue(s));
  setText('modelName', t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`);
  setText('capability', fmtNum(s.capability, 2));
  // The multiplier appears once it has moved (1.00× before the first release says nothing yet).
  showId('capabilityPart', s.capability > 1.0001 || s.stats.trainings > 0);
  setText('rivalCap', fmtNum(s.rivalCapability, 2));
  // The rival's number waits for the Stage 2 graph; until then, words (its value is in the tooltip).
  const lead = s.capability / s.rivalCapability;
  // Stage 2: when Anthrosoft leads, what it costs the market is in the line's hover.
  const marketCut = s.stage === 2 ? Math.round((1 - qualityMultS2(s)) * 100) : 0;
  setText('rivalStanding', lead > 1.02 ? 'Ahead of Anthrosoft' : lead < 0.98 ? 'Anthrosoft is ahead' : 'Level with Anthrosoft');
  setTitle('rivalLine', `Anthrosoft's latest Cadence model: ${fmtNum(s.rivalCapability, 2)}×.${lead < 0.98 && marketCut >= 1 ? ` While it leads, the market is ${marketCut}% smaller.` : ''}`);
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    const b = byId(`btn-focus-${focus}`);
    if (b.classList.contains('selected') !== (t.focus === focus)) b.classList.toggle('selected', t.focus === focus);
  }
  // Each button's own figures (`focusBase` in engine/training.ts): they are nowhere else on screen.
  if (s.stage >= 2) {
    setTitle('btn-focus-capability', 'Capability: the next model is 7–10% more capable. Customers notice.');
    setTitle('btn-focus-efficiency', 'Efficiency: +7% capability, and copies per GPU ×1.15.');
    setTitle('btn-focus-safety', 'Safety: +7% capability, measured alignment +8, and fewer issues on every later run.');
  } else {
    setTitle('btn-focus-capability', 'Capability: the next model is 10–14% more capable. Customers notice.');
    setTitle('btn-focus-efficiency', 'Efficiency: +5% capability, and 25% more copies on every GPU.');
    setTitle('btn-focus-safety', 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.');
  }
  // Three plain buttons and the selected Focus's trade in one line under them; each button's own
  // figures are in its tooltip.
  setText('focusNote', focusNote(s, t.focus));

  const slotRun = evalRun(s);
  const running = trainingRun(s);
  // Idle: no run at all, or (two pipelines) one waiting in evaluation and none training.
  const idle = !running && (!t.run || trainSlotFree(s));
  showId('train-idle', idle);
  showId('train-running', !!running);
  showId('train-eval', !!slotRun && !slotRun.prologue);
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
  if (focus === 'capability') return s2 ? 'The most capable next model.' : 'The most capable next model (about +12%).';
  if (focus === 'efficiency') return s2 ? 'More copies on every GPU; a smaller capability gain.' : 'Copies per GPU ×1.25; a smaller capability gain.';
  return s2 ? 'Fewer issues on every later run; measured alignment up.' : 'Fewer red-team issues, now and on every later run.';
}

function renderIdle(s: GameState): void {
  setText('nextRunName', nextRunName(s));
  const cost = trainCost(s);
  setDisabled('btn-train', !canStartTraining(s));
  setTitle('btn-train', canStartTraining(s) ? 'Start the run.' : 'Not yet: it needs its price and its GPUs.');
  // Cost: one line a price, named by its unit, with a bar of what the lab holds against it; the GPUs are a price too.
  const gpus = trainGpuFigures(s);
  const rows: [string, (n: number) => string, number, number][] = [
    ['funds', fmtMoneyShort, s.funds, cost.funds ?? 0],
    ['research', (n) => `${fmtInt(n)} research`, s.research, cost.research ?? 0],
    ['data', (n) => `${fmtNum(n, 1)} T`, s.data, cost.data ?? 0],
    ['power', (n) => `${fmtInt(n)} kWh`, s.power, cost.power ?? 0],
    ['gpus', (n) => `${fmtInt(n)} GPUs`, gpus.have, gpus.need],
  ];
  for (const [key, fmt, have, need] of rows) {
    showId(`costRow-${key}`, need > 0);
    if (need <= 0) continue;
    setText(`costText-${key}`, fmt(need));
    // What the lab holds is on its own panel; the hover keeps the exact pair.
    setTitle(`costRow-${key}`, `${fmt(have)} of ${fmt(need)}`);
    setWidth(byId(`costBar-${key}`), have / need);
  }
  // At a wall the bar cannot say what lifts it; one line does.
  setText('trainGpus', trainGpuFix(s));
  showId('trainGpuLine', trainGpuFix(s) !== '');
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
  // Stages 1–2: `34 s remaining` under the bar, as before; the GPUs the run holds are in the bar's hover
  // (and, in Stage 1, beside Copies running). Stage 3 keeps its own line.
  const gpus = run.gpus ?? 0;
  setText('runLine', waiting
    ? `${run.name} is trained; it waits for the release slot.`
    : s.stage >= 3 ? `Training on ${fmtInt(gpus)} GPUs — ${fmtClock(left)} left.` : `${left} s remaining`);
  setTitle('runLine', s.stage >= 3 || waiting ? '' : `Training on ${fmtInt(gpus)} GPUs. They serve no customers until it is done.`);
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
  setText('evalCap', evalP >= 1 ? fmtNum(run.capAfter, 2) : '…');
  // What the run changes when it ships (`copies per GPU 1.88 → 2.35`) is in the total's hover.
  setTitle('evalTotal', evalP >= 1 ? `Reviewers' score: ${totalScore(run)}/40.${s.stage === 2 && run.focus !== 'capability' ? ` ${focusChange(s, run)}` : ''}` : '');
  if (condensed) {
    const done = evalP >= 1;
    const issues = run.phase === 'redteam' ? run.issues : run.issuesFound;
    setText(
      'evalLine',
      done
        // Stage 3 says the count once (`Open issues: 1` is the line below) and drops the score.
        ? s.stage >= 3
          ? `${run.name} … ${fmtNum(run.capAfter, 2)}×${run.phase === 'redteam' ? '' : ` · ${issues === 0 ? 'no issues open' : `${issues} issue${issues === 1 ? '' : 's'} open`}`}`
          : `${run.name} … ${totalScore(run)}/40 · ${fmtNum(run.capAfter, 2)}× · ${issues === 0 ? 'no issues open' : `${issues} issue${issues === 1 ? '' : 's'} open`}`
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
    // The prologue's Sage-1 skips the red team: Deploy is its only control (Stage 3 sets its own).
    if (s.stage < 3) {
      setOff('issuesLine', !!run.prologue);
      setOff('btn-redteam', !!run.prologue);
    }
    setText('issuesFound', fmtInt(run.issuesFound));
    setText('issuesOpen', fmtInt(run.issues));
    setDisabled('btn-redteam', !canRedTeam(s));
    const cooling = t.redTeamRemaining > 0 ? t.redTeamRemaining / t.redTeamDuration : 0;
    renderCooldown(byId('btn-redteam'), byId('redteamBar'), cooling);
    setTitle('btn-redteam', `Close one open issue every ${t.redTeamDuration} s.`);
    setDisabled('btn-release', !canReleasePublic(s));
    setDisabled('btn-releaseInternal', !canRelease(s));
    setText('btn-release', run.prologue ? `Deploy ${run.name}` : run.issues > 0 ? `Release (${run.issues} open)` : 'Release');
    const sh = superhumanTooltips(s);
    setTitle(
      'btn-release',
      run.prologue ? `Deploy ${run.name}: each GPU runs a copy that completes tasks on its own, using power.`
      : sh ? sh.release
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
    setText('sl3Cost', c.trust ? `${fmtMoneyShort(c.funds)}, ${c.trust} Trust` : fmtMoneyShort(c.funds));
    setDisabled('btn-sl3', s.securityLevel >= 3 || s.funds < c.funds || s.trust < c.trust);
    // Bought, the row goes (critic S2 round 2 §8.8.7: it stayed, greyed, into Stage 3).
    setOff('sl3Row', s.securityLevel >= 3);
  }
  setText('govRelations', fmtInt(Math.round(s.govRelations)));
  setText('govMood', govMood(s));
  // What each band of relations, approval and measured alignment does is in its line's hover.
  setText('govNote', '');
  setText('approvalNote', '');
  setText('alignNote', '');
  setTitle('govLine', govBandNote(s));
  setTitle('alignLine', alignBandNote(s));
  setToggle('btn-shareEvals', s.shareEvals, s.shareEvals ? 'ON' : 'OFF');
  const a = Math.round(s.approval);
  setText('approval', `${a < 0 ? '−' : a > 0 ? '+' : ''}${fmtInt(Math.abs(a))}`);
  const band = approvalBandNote(s);
  setTitle('approvalLine', `${approvalTerms(s).map(([k, v]) => `${k} ${v > 0 ? '+' : '−'}${fmtNum(Math.abs(v), 1)}`).join('\n') || 'Nothing moves it yet.'}${band ? `\n${band}` : ''}`);
  setText('jobsDisplaced', fmtJobs(s.jobsDisplaced));
  setToggle('btn-jobFund', s.jobFund, s.jobFund ? 'ON' : 'OFF');
  if (s.revealed['stats']) {
    setText('statCopies', fmtInt(copies(s)));
    setText('statSpeed', fmtNum(perCopyRate(s), 0));
    setText('statRunRate', fmtMoney(runRate(s)));
    renderStatLead(s);
    setText('statAlignment', fmtInt(Math.round(s.alignmentApparent)));
  }
}

/** Stage 3's world: Security, Government then Oversight, Public, Alignment, Geopolitics, Stats. */
function renderWorld3(s: GameState): void {
  renderSecurity3(s);
  setText('govRelations', fmtInt(Math.round(s.govRelations)));
  setText('govMood', govMood(s));
  setText('govNote', '');
  setTitle('govLine', '');
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
    renderStatLead(s);
    setText('statAlignment', fmtInt(Math.round(s.alignmentApparent)));
  }
  renderStats3(s);
}

/**
 * The lead in words: `Lead over Baiwen: 1.5 months`, or `Baiwen ahead by: 2.0 months` (critic S3 round 1
 * §9.9 item 10: a negative lead with an ASCII hyphen under `Baiwen is 2.0 months ahead.`).
 */
function renderStatLead(s: GameState): void {
  const half = Math.round(Math.abs(s.lead) * 2) / 2;
  setText('statLeadLabel', s.lead < -0.05 ? 'Baiwen ahead by:' : 'Lead over Baiwen:');
  setText('statLead', fmtNum(half, 1));
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
