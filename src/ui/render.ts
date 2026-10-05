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
  trainCost, canStartTraining, focusChange, canRedTeam, canRelease, canReleasePublic, releaseProgress, nextRunName,
  trainGpuFigures, trainGpuFix, evaluatorLine, totalScore, trainingRun, evalRun,
  trainSlotFree, superhumanTooltips, EVAL_SECONDS, BENCHMARKS, EVALUATORS,
  labReason, needsDatacenter,
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

export function mount(p: Perform): void {
  perform = p;
  revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  hideEls = Array.from(document.querySelectorAll<HTMLElement>('[data-hide]'));
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  bind('btn-task', () => perform('clickTask'));
  bind('btn-endingTask', () => perform('clickTask'));
  bind('btn-buyPower', () => perform('buyPower'));
  bind('btn-grid', () => perform('toggleGrid'));
  bind('btn-lowerPrice', () => perform('lowerPrice'));
  bind('btn-raisePrice', () => perform('raisePrice'));
  bind('btn-marketing', () => perform('buyMarketing'));
  bind('btn-gpu', () => perform('rentGpu'));
  bind('btn-datacenter', () => perform('buildDatacenter'));
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

export function render(s: GameState): void {
  noteState3(s);
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

function fmtRate(n: number): string {
  return n < 10 ? fmtNum(n, 1) : fmtInt(Math.round(n));
}

function fmtTaskPrice(p: number): string {
  return (p < 0.1 ? `$ ${p.toFixed(3)}` : fmtMoney(p)).replace(' ', '\u00a0');
}

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
  const block = powerBlock(s);
  const left = powerSecondsLeft(s);
  const low = left < 20 && !(s.gridAuto && isBought(s, 'p_grid'));
  setMeter('powerMeter', Math.min(1, s.power / block), `${fmtInt(s.power)} kWh · a ${fmtInt(block)} kWh block${Number.isFinite(left) ? ` · ${fmtClock(left)} at this draw` : ''}`, low);
  setText('powerNote', copiesIdle(s) ? 'copies idle' : '');
  setText('powerBlock', fmtInt(powerBlock(s)));
  setText('powerCost', fmtMoney(powerBlockCost(s)));
  setDisabled('btn-task', false);
  setDisabled('btn-buyPower', s.funds < powerBlockCost(s));
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
  if (s.autoPrice) {
    setText('billRate', fmtInt(s.stats.soldPerSec));
    setText('billPrice', s.stage >= 2 ? fmtTaskPrice(s.price) : fmtMoney(s.price));
    if (s.stage >= 2) setTitle('billPrice', marketBreakdown(s).map(([k, v]) => `${k} ×${fmtNum(v, v < 10 ? 2 : 1)}`).join(' · '));
    setDisabled('btn-lowerPrice', true);
    setDisabled('btn-raisePrice', true);
  } else {
    const billed = billingPerSec(s);
    const made = productionPerSec(s);
    const state = marketState(s);
    setText('soldPerSec', fmtRate(billed));
    setText('tasksPerSec', fmtRate(made));
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
  if (s.revealed['quota']) setMeter('quotaMeter', s.gpus / rentQuota(s), `${fmtInt(s.gpus)} of the ${fmtInt(rentQuota(s))} the cloud rents`);
  setText('copies', fmtInt(copies(s)));
  const run = trainingRun(s);
  const note = copiesIdle(s) ? '(idle: no power)' : run ? `(${fmtInt(run.gpus ?? 0)} GPUs are training)` : '';
  setText('copiesNote', note);
  showId('copiesRow', copies(s) !== s.gpus);
}

function renderInfrastructure(s: GameState): void {
  if (!s.revealed['infrastructure']) return;
  setText('infraGpus', fmtInt(s.gpus));
  setText('gpuCapacity', fmtInt(gpuCapacity(s)));
  setText('powerMW', fmtNum(powerDrawMW(s), 1));
  setText('powerCapMW', fmtInt(s.powerCapacityMW));
  const cap = gpuCapacity(s);
  const dark = Math.max(0, s.gpus - activeGpus(s));
  const powerFull = freePowerGpus(s) < 100;
  setText('powerAll', s.stage >= 3 ? '' : dark > 0 ? `${fmtInt(dark)} GPUs dark: ` : powerFull ? 'all in use: ' : '');
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
    setTitle(id, `${s.g5 ? 'Nimbus G5s, each the work of 1.5 G4s' : 'Nimbus G4s'}, ${fmtMoneyShort(gpuUnitPrice(s))} each, from the build fund. The lot uses ${fmtInt(mw)} MW (${fmtInt(Math.floor(freePowerGpus(s) / 1000))} free) and adds about ${fmtMoneyShort(Math.round(lotReturn(s, n)))} a second at today's market.`);
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
  setText('dcReason', building ? `building — ${fmtClock(Math.ceil(building.remaining))}` : '');
  setDisabled('btn-datacenter', !!building || dcShort);
  setTitle('btn-datacenter', `Room for ${fmtInt(dc.add)} more GPUs once it is built (${fmtClock(dcBuildSeconds(s))}); ${fmtInt(freeSlots(s))} slots are free now. Paid from the build fund.`);
  const dcLit = !building && !dcShort;
  const dcDrawn = !!building || dcLit || wall === 'room' || (!greyShown && buildEta(s, dc.cost) <= 180);
  if (!dcLit && !building && wall !== 'room' && dcDrawn) greyShown = true;
  setOff('dcRow', !dcDrawn);
  byId('btn-datacenter').classList.toggle('urgent', wall === 'room' && standingStall(s) === 'room');

  const plant = (id: string, rowId: string, costId: string, reasonId: string, kind: 'gas' | 'solar' | 'nuclear', cost: number) => {
    setText(costId, fmtMoneyShort(cost));
    const why = plantReason(s, kind);
    setText(reasonId, why || (kind === 'solar' ? 'joins the queue' : kind === 'nuclear' && s.govRelations >= 60 ? 'cheaper: good relations' : ''));
    const lit = !why && s.buildFund >= cost;
    setDisabled(id, !lit);
    const named = wall === 'power' && kind === (s.revealed['gasButton'] ? 'gas' : 'solar');
    const drawn = lit || named || (!greyShown && buildEta(s, cost) <= 180);
    if (!lit && !named && drawn) greyShown = true;
    setOff(rowId, !drawn);
    byId(id).classList.toggle('urgent', named && standingStall(s) === 'power');
  };
  plant('btn-turbines', 'gasRow', 'turbineCost', 'gasReason', 'gas', gasCost(s));
  plant('btn-solar', 'solarRow', 'solarCost', 'solarReason', 'solar', solarCost(s));
  plant('btn-nuclear', 'nuclearRow', 'nuclearCost', 'nuclearReason', 'nuclear', nuclearCost(s));
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

function renderBuildShare(s: GameState): void {
  if (!s.revealed['buildShare']) return;
  setText('btn-buildShare', `${Math.round(s.buildShare * 100)}%`);
  setText('buildFund', fmtMoneyShort(Math.floor(s.buildFund)));
}

function renderStanding(s: GameState): void {
  if (!s.revealed['standingOrder']) return;
  const on = standingOrderOn(s);
  setToggle('btn-standing', on, on ? 'ON' : 'OFF');
}

function fmtTrust(trust: number): string {
  return trust >= 0 ? fmtInt(trust) : `0 (${fmtInt(-trust)} owed)`;
}

function renderResearch(s: GameState): void {
  if (!s.revealed['research']) return;
  setText('trust', fmtTrust(s.trust));
  setText('nextTrust', fmtInt(s.nextTrust));
  setDisabled('btn-hireResearcher', s.trust < 1);
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
  if (Number.isFinite(cap) && cap > 0 && !s.revealed['stores']) {
    setMeter('researchMeter', s.research / cap, `${fmtInt(Math.floor(s.research))} of ${fmtInt(cap)} the lab holds`);
  }
  setText('insight', s.insight >= 1 ? fmtInt(Math.floor(s.insight)) : 'none yet');
  setText('insightNote', s.research >= cap ? '(accruing)' : '(accrues at capacity)');
  if (s.revealed['allocation']) {
    const pct = Math.round(s.researchAlloc * 100);
    const slider = byId<HTMLInputElement>('allocSlider');
    if (document.activeElement !== slider && slider.value !== String(pct)) slider.value = String(pct);
    setText('allocPct', `${pct}%`);
    if (s.stage === 2) setText('allocRate', '');
    setTitle('allocSlider', s.stage === 2 ? `Research +${fmtInt(Math.round(aiResearchRate(s)))} a second; revenue −${fmtInt(Math.round(revenueCostOfAlloc(s) * 100))}%.` : '');
    const share = humanShare(s) * 100;
    setText('humanShare', `${share >= 10 ? fmtInt(share) : fmtNum(share, share >= 1 ? 1 : 2)}%`);
  }
  if (s.revealed['alignShare']) setText('btn-alignShare', `Alignment compute: ${Math.round(s.alignShare * 100)}%`);
  if (s.stage === 3) renderResearch3(s);
}

const projectButtons = new Map<string, HTMLButtonElement>();

function renderProjects(s: GameState): void {
  const list = byId('projectList');
  const visible = s.revealed['projects'] ? visibleProjects(s).filter((p) => !(p.grant && s.stage >= 3)) : [];
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
    const label = `${def.title} ${priceTag(s, def)}${needs}`;
    if (title.textContent !== label) title.textContent = label;
    const tip = def.id === 'p_datacenter' && s.stage === 1 ? datacenterTip(s) : labReason(s, def.cost(s).research ?? 0);
    if (b.title !== tip) b.title = tip;
    const reason = b.querySelector<HTMLElement>('.projectReason');
    const why = def.mission ? missionNeeds(s, def) : '';
    if (reason && reason.textContent !== why) reason.textContent = why;
    const disabled = !def.canAfford(s);
    if (b.disabled !== disabled) b.disabled = disabled;
    const urgent = def.urgent?.(s) === true;
    if (b.classList.contains('urgent') !== urgent) b.classList.toggle('urgent', urgent);
  });
}

function datacenterTip(s: GameState): string {
  const st = datacenterStatus(s);
  return `The next model needs ${fmtInt(st.need)} GPUs; the cloud rents ${fmtInt(st.rent)}.${st.afterTooBig && !st.needed ? ' The one after will not fit.' : ''}`;
}

function renderTraining(s: GameState): void {
  if (!s.revealed['training']) return;
  const t = s.training;
  setOff('modelLines', inPrologue(s));
  setText('modelName', t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`);
  setText('capability', fmtNum(s.capability, 2));
  showId('capabilityPart', s.capability > 1.0001 || s.stats.trainings > 0);
  setText('rivalCap', fmtNum(s.rivalCapability, 2));
  const lead = s.capability / s.rivalCapability;
  const marketCut = s.stage === 2 ? Math.round((1 - qualityMultS2(s)) * 100) : 0;
  setText('rivalStanding', lead > 1.02 ? 'Ahead of Anthrosoft' : lead < 0.98 ? 'Anthrosoft is ahead' : 'Level with Anthrosoft');
  setTitle('rivalLine', `Anthrosoft's latest Cadence model: ${fmtNum(s.rivalCapability, 2)}×.${lead < 0.98 && marketCut >= 1 ? ` While it leads, the market is ${marketCut}% smaller.` : ''}`);
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    const b = byId(`btn-focus-${focus}`);
    if (b.classList.contains('selected') !== (t.focus === focus)) b.classList.toggle('selected', t.focus === focus);
  }
  if (s.stage >= 2) {
    setTitle('btn-focus-capability', 'Capability: the next model is 7–10% more capable. Customers notice.');
    setTitle('btn-focus-efficiency', 'Efficiency: +7% capability, and copies per GPU ×1.15.');
    setTitle('btn-focus-safety', 'Safety: +7% capability, measured alignment +8, and fewer issues on every later run.');
  } else {
    setTitle('btn-focus-capability', 'Capability: the next model is 10–14% more capable. Customers notice.');
    setTitle('btn-focus-efficiency', 'Efficiency: +5% capability, and 25% more copies on every GPU.');
    setTitle('btn-focus-safety', 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.');
  }
  setText('focusNote', focusNote(s, t.focus));

  const slotRun = evalRun(s);
  const running = trainingRun(s);
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

function focusNote(s: GameState, focus: Focus): string {
  const s2 = s.stage >= 2;
  if (focus === 'capability') return s2 ? 'The most capable next model.' : 'The most capable next model (about +12%).';
  if (focus === 'efficiency') return s2 ? 'More copies on every GPU; a smaller capability gain.' : 'Copies per GPU ×1.25; a smaller capability gain.';
  return s2 ? 'Fewer issues on every later run; measured alignment up.' : 'Fewer issues, now and on every later run.';
}

function renderIdle(s: GameState): void {
  setText('nextRunName', nextRunName(s));
  const cost = trainCost(s);
  setDisabled('btn-train', !canStartTraining(s));
  const wall = needsDatacenter(s);
  setTitle('btn-train', canStartTraining(s) ? 'Start the run.' : wall ? 'Not yet: it needs the First Datacenter.' : 'Not yet: it needs its price and its GPUs.');
  showId('costRow-datacenter', wall);
  const gpus = trainGpuFigures(s);
  const rows: [string, (n: number) => string, number, number][] = [
    ['funds', fmtMoneyShort, s.funds, cost.funds ?? 0],
    ['research', (n) => `${fmtInt(n)} research`, s.research, cost.research ?? 0],
    ['data', (n) => `${fmtNum(n, 1)} T`, s.data, cost.data ?? 0],
    ['power', (n) => `${fmtInt(n)} kWh`, s.power, cost.power ?? 0],
    ['gpus', (n) => `${fmtInt(n)} GPUs`, gpus.have, gpus.need],
  ];
  for (const [key, fmt, have, need] of rows) {
    showId(`costRow-${key}`, need > 0 && !wall);
    if (need <= 0 || wall) continue;
    setText(`costText-${key}`, fmt(need));
    setTitle(`costRow-${key}`, `${fmt(have)} of ${fmt(need)}`);
    setWidth(byId(`costBar-${key}`), have / need);
  }
  const fix = wall ? '' : trainGpuFix(s);
  setText('trainGpus', fix);
  showId('trainGpuLine', fix !== '');
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
  const gpus = run.gpus ?? 0;
  setText('runLine', waiting
    ? `${run.name} is trained; it waits for the release slot.`
    : s.stage >= 3 ? `Training on ${fmtInt(gpus)} GPUs — ${fmtClock(left)} left.` : `${left} s remaining`);
  setTitle('runLine', s.stage >= 3 || waiting ? '' : `Training on ${fmtInt(gpus)} GPUs. They serve no customers until it is done.`);
}

function renderEval(s: GameState, run: TrainingRun): void {
  const t = s.training;
  const evalP = run.phase === 'evaluating' ? Math.min(1, run.evalElapsed / EVAL_SECONDS) : 1;
  const evalEl = byId('train-eval');
  const collapsed = run.phase === 'redteam';
  if (evalEl.classList.contains('collapsed') !== collapsed) evalEl.classList.toggle('collapsed', collapsed);
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
  setTitle('evalTotal', evalP >= 1 ? `Reviewers' score: ${totalScore(run)}/40.${s.stage === 2 && run.focus !== 'capability' ? ` ${focusChange(s, run)}` : ''}` : '');
  if (condensed) {
    const done = evalP >= 1;
    const issues = run.phase === 'redteam' ? run.issues : run.issuesFound;
    setText(
      'evalLine',
      done
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
    setText('releaseLabel', run.prologue ? `Deploy ${run.name}` : run.issues > 0 ? `Release (${run.issues} open)` : 'Release');
    const rollout = releaseProgress(s);
    const filling = rollout ? Math.max(0.01, rollout.p) : 0;
    renderCooldown(byId('btn-release'), byId('releaseBar'), rollout?.isPublic ? filling : 0);
    renderCooldown(byId('btn-releaseInternal'), byId('releaseInternalBar'), rollout && !rollout.isPublic ? filling : 0);
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
    setOff('sl3Row', s.securityLevel >= 3);
  }
  setText('govRelations', fmtInt(Math.round(s.govRelations)));
  setText('govMood', govMood(s));
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

function renderStatLead(s: GameState): void {
  const half = Math.round(Math.abs(s.lead) * 2) / 2;
  setText('statLeadLabel', s.lead < -0.05 ? 'Baiwen ahead by:' : 'Lead over Baiwen:');
  setText('statLead', fmtNum(half, 1));
}

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
