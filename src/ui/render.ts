import type { GameState, Focus, TrainingRun } from '../engine/state.js';
import { inPrologue } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, datacenterCost, gpuBatchCost, gridUpgradeCost, nextGridCapacity, canExpandGrid, researchCap, demandPercent,
  copies, activeGpus, gpuCapacity, powerBlock, powerBlockCost, copiesIdle, contractRate, atRentQuota, billingPerSec, productionPerSec,
  marketState, priceAbsurd, rentQuota, MIN_PRICE, PRICE_STEP_FROM, GPU_BATCH, DATACENTER_GPUS, GRID_KW_PER_GPU, powerSecondsLeft, powerBillPerSec, priceCeiling,
} from '../engine/economy.js';
import {
  trainCost, canStartTraining, canRedTeam, canRelease, releaseProgress, nextRunName,
  trainGpuFigures, trainGpuFix, evaluatorLine, totalScore, trainingRun, evalRun,
  EVAL_SECONDS, BENCHMARKS, labReason, needsDatacenter,
} from '../engine/training.js';
import { datacenterStatus } from '../data/projects.js';
import { visibleProjects, priceTag } from '../engine/projects.js';
import { endingById, endStats } from '../engine/endings.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort, fmtMw, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setShown, showId, setOff, setDisabled, setWidth, setTitle, make } from './dom.js';
import { renderMeter, renderCooldown } from './meter.js';
import { renderConsole } from './console.js';
import { renderLog } from './log.js';
import { renderModal } from './modal.js';

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
  bind('btn-buyPower', () => perform('buyPower'));
  bind('btn-lowerPrice', () => perform('lowerPrice'));
  bind('btn-raisePrice', () => perform('raisePrice'));
  bind('btn-marketing', () => perform('buyMarketing'));
  bind('btn-gpu', () => perform('rentGpu'));
  bind('btn-datacenter', () => perform('buildDatacenter'));
  bind('btn-gpuBatch', () => perform('buyGpuBatch'));
  bind('btn-expandGrid', () => perform('expandGrid'));
  bind('btn-hireResearcher', () => perform('hireResearcher'));
  bind('btn-expandLab', () => perform('expandLab'));
  bind('btn-train', () => perform('startTraining'));
  bind('btn-redteam', () => perform('redTeam'));
  bind('btn-release', () => perform('release'));
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    bind(`btn-focus-${focus}`, () => perform('setFocus', focus));
  }
}

export function render(s: GameState): void {
  for (const el of revealEls) setShown(el, s.revealed[el.dataset['reveal']!] === true);
  for (const el of hideEls) {
    const hide = s.revealed[el.dataset['hide']!] === true;
    if (el.classList.contains('hideFlag') !== hide) el.classList.toggle('hideFlag', hide);
  }
  renderConsole(s);
  renderLog(s);
  setText('tasks', fmtInt(s.tasks));
  setText('gameDate', dateLabel(s.date));
  renderBusiness(s);
  renderInfrastructure(s);
  renderPower(s);
  renderResearch(s);
  renderProjects(s);
  renderTraining(s);
  renderLater(s);
  renderModal(s, (i) => perform('resolveChoice', i), () => perform('takeDefault'));
  renderEnding(s);
}

function fmtRate(n: number): string {
  return n < 10 ? fmtNum(n, 1) : fmtInt(Math.round(n));
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

function renderPower(s: GameState): void {
  setText('power', fmtInt(s.power));
  const cap = s.gridCapacity;
  const left = powerSecondsLeft(s);
  setMeter('powerMeter', Math.min(1, s.power / cap), `${fmtInt(s.power)} kWh · a full bar is ${fmtInt(cap)} kWh${Number.isFinite(left) ? ` · ${fmtClock(left)} at this draw` : ''}`, left < 20);
  setText('powerNote', copiesIdle(s) ? 'copies idle' : '');
  setText('powerBlock', fmtInt(powerBlock(s)));
  setText('powerCost', s.revealed['infrastructure'] ? fmtMoneyShort(powerBlockCost(s)) : fmtMoney(powerBlockCost(s)));
  setDisabled('btn-task', false);
  setDisabled('btn-buyPower', s.funds < powerBlockCost(s));
  showId('buyPowerRow', true);
  const draw = s.stage < 2 ? 'Each task a copy completes uses 1 kWh; clicks use none.' : `Each powered GPU draws ${fmtInt(GRID_KW_PER_GPU)} kWh a second.`;
  setTitle('btn-buyPower', `Buy ${fmtInt(powerBlock(s))} kWh. ${draw}`);
  setText('powerBill', fmtMoney(powerBillPerSec(s)));
  setTitle('powerBill', `${draw} Billed at ${fmtMoneyShort(s.powerPrice)} per 1,000 kWh.`);
  renderGrid(s);
}

function renderGrid(s: GameState): void {
  const owned = s.revealed['infrastructure'] === true;
  const shown = canExpandGrid(s);
  showId('gridRows', shown);
  showId('billGap', shown);
  if (!shown) return;
  const cap = s.gridCapacity;
  const need = s.gpus * GRID_KW_PER_GPU;
  const short = owned && need > cap;
  setText('gridCapacity', fmtMw(cap));
  setText('gridLoad', fmtMw(Math.min(need, cap)));
  setMeter(
    'gridMeter',
    need / cap,
    short ? `${fmtInt(activeGpus(s))} of ${fmtInt(s.gpus)} GPUs powered: the grid is full. Expand Grid powers the rest.` : `Each GPU draws ${fmtInt(GRID_KW_PER_GPU)} kW · ${fmtInt(s.gpus)} GPUs draw ${fmtMw(need)} of the grid's ${fmtMw(cap)} MW`,
    short,
  );
  setText('gridNote', short ? `${fmtInt(s.gpus)} GPUs need ${fmtMw(need)} MW. ${fmtInt(s.gpus - activeGpus(s))} sit dark.` : '');
  showId('gridNoteRow', short);
  const next = nextGridCapacity(s);
  setText('gridNext', fmtMw(next));
  setText('gridCost', fmtMoneyShort(gridUpgradeCost(s)));
  setDisabled('btn-expandGrid', s.funds < gridUpgradeCost(s));
  const blocks = s.gridAuto ? '' : ` Power is bought ${fmtInt(next)} kWh at a time.`;
  const room = owned ? ` Enough for ${fmtInt(next / GRID_KW_PER_GPU)} GPUs.` : '';
  setTitle('btn-expandGrid', `Raise the grid connection to ${fmtMw(next)} MW.${room}${blocks}`);
}

function renderBusiness(s: GameState): void {
  setText('funds', fmtMoney(s.funds));
  setText('revPerSec', fmtMoney(s.stats.revPerSec));
  setText('contractRate', fmtMoney(contractRate(s)));
  setText('unbilled', fmtInt(s.unbilled));
  setText('price', fmtMoney(s.price));
  if (s.autoPrice) {
    setText('billRate', fmtInt(s.stats.soldPerSec));
    setText('billPrice', fmtMoney(s.price));
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

function renderInfrastructure(s: GameState): void {
  const owned = s.revealed['infrastructure'] === true;
  setText('infraTitle', owned ? 'Infrastructure' : 'Compute');
  if (owned) renderOwned(s);
  else renderRented(s);
}

function renderRented(s: GameState): void {
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

function renderOwned(s: GameState): void {
  const room = gpuCapacity(s);
  const full = s.gpus + GPU_BATCH > room;
  setText('infraGpus', fmtInt(s.gpus));
  setText('gpuCapacity', fmtInt(room));
  setMeter('roomMeter', s.gpus / room, `${fmtInt(s.gpus)} GPUs in ${fmtInt(s.datacenters)} datacenter${s.datacenters === 1 ? '' : 's'} with room for ${fmtInt(room)} · ${fmtInt(copies(s))} copies running`);
  setText('gpuBatchCost', fmtMoneyShort(gpuBatchCost(s)));
  setDisabled('btn-gpuBatch', s.funds < gpuBatchCost(s) || full);
  setText('gpuBatchDraw', fmtMw(GPU_BATCH * GRID_KW_PER_GPU));
  setTitle('btn-gpuBatch', full ? 'The datacenters are full. Build another first.' : `Rack ${fmtInt(GPU_BATCH)} more GPUs. Each draws ${fmtInt(GRID_KW_PER_GPU)} kW from the grid.`);
  setText('datacenterCost', fmtMoneyShort(datacenterCost(s)));
  setDisabled('btn-datacenter', s.funds < datacenterCost(s));
  setTitle('btn-datacenter', `Datacenter ${fmtInt(s.datacenters + 1)}: room for ${fmtInt(DATACENTER_GPUS)} more GPUs.`);
}

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
  setText('researchCap', fmtInt(cap));
  setMeter('researchMeter', s.research / cap, `${fmtInt(Math.floor(s.research))} of ${fmtInt(cap)} the lab holds`);
  setText('insight', s.insight >= 1 ? fmtInt(Math.floor(s.insight)) : 'none yet');
  setText('insightNote', s.research >= cap ? '(accruing)' : '(accrues at capacity)');
}

const projectButtons = new Map<string, HTMLButtonElement>();

function renderProjects(s: GameState): void {
  const list = byId('projectList');
  const visible = s.revealed['projects'] ? visibleProjects(s) : [];
  setOff('panel-projects', visible.length === 0);
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
    const tip = def.id === 'p_datacenter' ? datacenterTip(s) : labReason(s, def.cost(s).research ?? 0);
    if (b.title !== tip) b.title = tip;
    const disabled = !def.canAfford(s);
    if (b.disabled !== disabled) b.disabled = disabled;
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
  setText('rivalStanding', lead > 1.02 ? 'Ahead of Anthrosoft' : lead < 0.98 ? 'Anthrosoft is ahead' : 'Level with Anthrosoft');
  setTitle('rivalLine', `Anthrosoft's latest Cadence model: ${fmtNum(s.rivalCapability, 2)}×.`);
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    const b = byId(`btn-focus-${focus}`);
    if (b.classList.contains('selected') !== (t.focus === focus)) b.classList.toggle('selected', t.focus === focus);
  }
  setTitle('btn-focus-capability', 'Capability: the next model is 10–14% more capable. Customers notice.');
  setTitle('btn-focus-efficiency', 'Efficiency: +5% capability, and 25% more copies on every GPU.');
  setTitle('btn-focus-safety', 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.');
  setText('focusNote', focusNote(t.focus));

  const slotRun = evalRun(s);
  const running = trainingRun(s);
  const idle = !t.run;
  showId('train-idle', idle);
  showId('train-running', !!running);
  showId('train-eval', !!slotRun && !slotRun.prologue);
  showId('train-redteam', slotRun?.phase === 'redteam');

  if (idle) renderIdle(s);
  if (running) renderRunning(running);
  if (slotRun) renderEval(s, slotRun);
}

function focusNote(focus: Focus): string {
  if (focus === 'capability') return 'The most capable next model (about +12%).';
  if (focus === 'efficiency') return 'Copies per GPU ×1.25; a smaller capability gain.';
  return 'Fewer issues, now and on every later run.';
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

function renderRunning(run: TrainingRun): void {
  const p = run.elapsed / run.duration;
  setText('runName', run.name);
  setText('runFocus', run.focus);
  setText('runPct', fmtInt(Math.floor(p * 100)));
  setWidth(byId('runBar'), p);
  const left = Math.max(0, Math.ceil(run.duration - run.elapsed));
  setText('runRemaining', `${left} s`);
  setText('runLine', `${left} s remaining`);
  setTitle('runLine', `Training on ${fmtInt(run.gpus ?? 0)} GPUs. They serve no customers until it is done.`);
}

function renderEval(s: GameState, run: TrainingRun): void {
  const t = s.training;
  const evalP = run.phase === 'evaluating' ? Math.min(1, run.evalElapsed / EVAL_SECONDS) : 1;
  const evalEl = byId('train-eval');
  const collapsed = run.phase === 'redteam';
  if (evalEl.classList.contains('collapsed') !== collapsed) evalEl.classList.toggle('collapsed', collapsed);
  setText('evalName', run.name);
  if (!collapsed) {
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
  setTitle('evalTotal', evalP >= 1 ? `Reviewers' score: ${totalScore(run)}/40.` : '');

  if (run.phase === 'redteam') {
    setOff('issuesLine', !!run.prologue);
    setOff('btn-redteam', !!run.prologue);
    setText('issuesFound', fmtInt(run.issuesFound));
    setText('issuesOpen', fmtInt(run.issues));
    setDisabled('btn-redteam', !canRedTeam(s));
    const cooling = t.redTeamRemaining > 0 ? t.redTeamRemaining / t.redTeamDuration : 0;
    renderCooldown(byId('btn-redteam'), byId('redteamBar'), cooling);
    setTitle('btn-redteam', `Close one open issue every ${t.redTeamDuration} s.`);
    setDisabled('btn-release', !canRelease(s));
    setText('releaseLabel', run.prologue ? `Deploy ${run.name}` : run.issues > 0 ? `Release (${run.issues} open)` : 'Release');
    const rollout = releaseProgress(s);
    renderCooldown(byId('btn-release'), byId('releaseBar'), rollout ? Math.max(0.01, rollout.p) : 0);
    setTitle(
      'btn-release',
      run.prologue ? `Deploy ${run.name}: each GPU runs a copy that completes tasks on its own, using power.`
        : run.issues > 0
          ? `${run.issues} open issue${run.issues === 1 ? '' : 's'} will ship with ${run.name}. Expect incidents.`
          : `Release ${run.name} to customers. Demand and hype go up; +1 Trust.`,
    );
  }
}

function renderLater(s: GameState): void {
  setText('govRelations', fmtInt(s.govRelations));
  setText('approval', fmtInt(s.approval));
  setText('societyApproval', fmtInt(s.approval));
  setText('alignmentApparent', fmtInt(s.alignmentApparent));
  setText('lead', fmtInt(s.lead));
  setText('oversightStatus', typeof s.flags['committeeChoice'] === 'string' ? (s.flags['committeeChoice'] as string) : 'not convened');
  setText('treatyStatus', s.flags['treatySigned'] ? 'signed' : 'not negotiating');
}

let endingShown = '';

function renderEnding(s: GameState): void {
  setShown(byId('endingScreen'), !!s.ending);
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
