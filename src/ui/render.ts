import type { GameState, Focus } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, datacenterCost, gpuBatchCost, turbineCost, researchCap, demandPercent,
  copies, activeGpus, powerDrawMW, gpuCapacity, powerBlock, powerBlockCost, copiesIdle, contractRate,
  billingPerSec, productionPerSec, marketState, priceAbsurd, GPU_BATCH, MIN_PRICE,
} from '../engine/economy.js';
import {
  trainCost, canStartTraining, canRedTeam, canRelease, nextRunName, trainingCompute, requiredCompute,
  trainingDuration, computeYield, evaluatorLine, totalScore, EVAL_SECONDS, BENCHMARKS,
} from '../engine/training.js';
import { visibleProjects, priceTag, costLabel } from '../engine/projects.js';
import { endingById, endStats } from '../engine/endings.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setShown, showId, setDisabled, setWidth, setTitle, make } from './dom.js';
import { renderConsole } from './console.js';
import { renderLog } from './log.js';
import { renderModal } from './modal.js';
import { renderGraph } from './graph.js';

type Rest<T> = T extends (s: GameState, ...rest: infer R) => unknown ? R : never;
export type Perform = <K extends keyof Actions>(name: K, ...args: Rest<Actions[K]>) => boolean;

let revealEls: HTMLElement[] = [];
let perform: Perform;

/** Wires every static button to its action. Called once at boot. */
export function mount(p: Perform): void {
  perform = p;
  revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  bind('btn-task', () => perform('clickTask'));
  bind('btn-buyPower', () => perform('buyPower'));
  bind('btn-grid', () => perform('toggleGrid'));
  bind('btn-lowerPrice', () => perform('lowerPrice'));
  bind('btn-raisePrice', () => perform('raisePrice'));
  bind('btn-marketing', () => perform('buyMarketing'));
  bind('btn-gpu', () => perform('rentGpu'));
  bind('btn-datacenter', () => perform('buildDatacenter'));
  bind('btn-gpuBatch', () => perform('buyGpuBatch'));
  bind('btn-turbines', () => perform('buyTurbines'));
  bind('btn-hireResearcher', () => perform('hireResearcher'));
  bind('btn-expandLab', () => perform('expandLab'));
  bind('btn-train', () => perform('startTraining'));
  bind('btn-redteam', () => perform('redTeam'));
  bind('btn-release', () => perform('release'));
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    bind(`btn-focus-${focus}`, () => perform('setFocus', focus));
  }
}

/** One render per frame. Text is diffed into spans; visibility comes only from `state.revealed`. */
export function render(s: GameState): void {
  for (const el of revealEls) setShown(el, s.revealed[el.dataset['reveal']!] === true);
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
  renderSite(s);
  renderLater(s);
  renderGraph(s);
  renderModal(s, (i) => perform('resolveChoice', i));
  renderEnding(s);
}

/** Rates under 10 keep one decimal so the opening backlog (1.9/s of 4.0/s) reads as a gap. */
function fmtRate(n: number): string {
  return n < 10 ? fmtNum(n, 1) : fmtInt(Math.round(n));
}

function renderPower(s: GameState): void {
  setText('power', fmtInt(s.power));
  setText('powerNote', copiesIdle(s) ? 'no power — copies idle' : '');
  setText('powerBlock', fmtInt(powerBlock(s)));
  setText('powerCost', fmtMoney(powerBlockCost(s)));
  // The manual verb never needs power and is never disabled.
  setDisabled('btn-task', false);
  setDisabled('btn-buyPower', s.funds < powerBlockCost(s));
  // While the Grid Contract buys power, the manual block is redundant; turning the grid off brings it back.
  showId('buyPowerRow', !s.gridAuto);
  setTitle('btn-buyPower', `${fmtInt(powerBlock(s))} kWh. Each task a copy completes uses 1 kWh; clicks use none.`);
  setText('btn-grid', s.gridAuto ? 'ON' : 'OFF');
  setText('gridStatus', s.gridAuto ? 'buys power when it runs low' : 'idle');
}

function renderBusiness(s: GameState): void {
  setText('funds', fmtMoney(s.funds));
  setText('revPerSec', fmtMoney(s.stats.revPerSec));
  setText('contractRate', fmtMoney(contractRate(s)));
  setText('unbilled', fmtInt(s.unbilled));
  setText('price', fmtMoney(s.price));
  const billed = billingPerSec(s);
  const made = productionPerSec(s);
  setText('soldPerSec', fmtRate(billed));
  setText('tasksPerSec', fmtRate(made));
  // "Billing all 106/s produced" when nothing is left over: one number instead of two equal ones.
  setText('billingOf', billed >= 0.99 * made && made > 0 ? 'Billing all ' : 'Billing ');
  showId('billingOfPart', !(billed >= 0.99 * made && made > 0));
  const state = marketState(s);
  setText('marketState', state === 'nobody buys' ? `nobody buys at ${fmtMoneyShort(s.price)}` : state);
  setText('demand', fmtInt(demandPercent(s)));
  setDisabled('btn-lowerPrice', s.price <= MIN_PRICE + 1e-9);
  setTitle(
    'btn-raisePrice',
    priceAbsurd(s) ? 'nobody pays this' : 'Raise the price by one cent. Fewer tasks bill; each earns more.',
  );
  showId('hypeLine', s.hypeBoost > 1.05);
  setText('hype', s.hypeBoost > 1.5 ? 'strong' : 'fading');
  setText('apiCustomers', fmtInt(s.apiCustomers));
  setText('hypeLevel', fmtInt(s.hypeLevel));
  setText('marketingCost', fmtMoney(marketingCost(s)));
  setDisabled('btn-marketing', s.funds < marketingCost(s));
}

function renderCompute(s: GameState): void {
  setText('gpuCost', fmtMoney(gpuCost(s)));
  setDisabled('btn-gpu', s.funds < gpuCost(s));
  setText('gpus', fmtInt(s.gpus));
  setText('copies', fmtInt(copies(s)));
  const note = copiesIdle(s) ? '(idle: no power)' : s.training.run?.phase === 'training' ? '(half the GPUs are training)' : '';
  setText('copiesNote', note);
  // Copies equal GPUs until training diverts some or efficiency adds more: show the line when it says something.
  showId('copiesRow', copies(s) !== s.gpus);
}

function renderInfrastructure(s: GameState): void {
  if (!s.revealed['infrastructure']) return;
  setText('datacenters', fmtInt(s.datacenters));
  setText('datacenterCost', fmtMoneyShort(datacenterCost(s)));
  setDisabled('btn-datacenter', s.funds < datacenterCost(s));
  setText('infraGpus', fmtInt(s.gpus));
  setText('gpuCapacity', fmtInt(gpuCapacity(s)));
  setText('gpuBatchCost', fmtMoneyShort(gpuBatchCost(s)));
  setText('chipPrice', fmtMoney(s.chipPrice));
  setDisabled('btn-gpuBatch', s.funds < gpuBatchCost(s) || s.gpus + GPU_BATCH > gpuCapacity(s));
  setText('powerMW', fmtNum(powerDrawMW(s), 1));
  setText('powerCapMW', fmtInt(s.powerCapacityMW));
  setText('turbineCost', fmtMoneyShort(turbineCost(s)));
  setDisabled('btn-turbines', s.funds < turbineCost(s));
  setText('activeGpus', fmtInt(activeGpus(s)));
  setText('infraCopies', fmtInt(copies(s)));
  setText('infraTasksPerSec', fmtInt(s.stats.tasksPerSec));
}

function renderResearch(s: GameState): void {
  if (!s.revealed['research']) return;
  setText('trust', fmtInt(s.trust));
  setText('nextTrust', fmtInt(s.nextTrust));
  setDisabled('btn-hireResearcher', s.trust < 1);
  setDisabled('btn-expandLab', s.trust < 1);
  setTitle('btn-expandLab', `1 Trust: room for ${fmtInt(1000 * s.labMult)} more research.`);
  setText('researchers', fmtInt(s.researchers));
  setText('labSpace', fmtInt(s.labSpace));
  const cap = researchCap(s);
  setText('research', fmtInt(Math.floor(s.research)));
  setText('researchCap', fmtInt(cap));
  setText('insight', fmtInt(Math.floor(s.insight)));
  setText('insightNote', s.research >= cap ? '(accruing)' : '(accrues at capacity)');
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
      const cls = `projectButton${def.rescue ? ' rescue' : ''}${def.pinned ? ' pinned' : ''}`;
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
  });
}

function renderTraining(s: GameState): void {
  if (!s.revealed['training']) return;
  const t = s.training;
  const run = t.run;
  setText('modelName', t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`);
  setText('capability', fmtNum(s.capability, 2));
  setText('rivalCap', fmtNum(s.rivalCapability, 2));
  for (const focus of ['capability', 'efficiency', 'safety'] as Focus[]) {
    const b = byId(`btn-focus-${focus}`);
    if (b.classList.contains('selected') !== (t.focus === focus)) b.classList.toggle('selected', t.focus === focus);
  }

  showId('train-idle', !run);
  showId('train-running', run?.phase === 'training');
  showId('train-eval', run?.phase === 'evaluating' || run?.phase === 'redteam');
  showId('train-redteam', run?.phase === 'redteam');

  if (!run) {
    setText('nextRunName', nextRunName(s));
    setText('trainCost', costLabel(trainCost(s)));
    setDisabled('btn-train', !canStartTraining(s));
    setText('trainCompute', fmtInt(trainingCompute(s)));
    setText('trainRequired', fmtInt(requiredCompute(s)));
    const y = computeYield(s);
    setText('trainEta', `${Math.round(trainingDuration(s))} s`);
    showId('trainShort', y < 0.999);
    return;
  }

  if (run.phase === 'training') {
    const p = run.elapsed / run.duration;
    setText('runName', run.name);
    setText('runFocus', run.focus);
    setText('runPct', fmtInt(Math.floor(p * 100)));
    setWidth(byId('runBar'), p);
    setText('runRemaining', `${Math.ceil(run.duration - run.elapsed)} s`);
    setText('runShare', fmtInt(t.computeShare * 100));
    return;
  }

  // Evaluation: bars and evaluator cards fill in over five seconds, then fold into one line.
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

  if (run.phase === 'redteam') {
    setText('issuesFound', fmtInt(run.issuesFound));
    setText('issuesOpen', fmtInt(run.issues));
    setDisabled('btn-redteam', !canRedTeam(s));
    const cooling = t.redTeamRemaining > 0 ? t.redTeamRemaining / t.redTeamDuration : 0;
    setWidth(byId('redteamBar'), cooling);
    setTitle('btn-redteam', `Close one open issue every ${t.redTeamDuration} s.`);
    setDisabled('btn-release', !canRelease(s));
    setText('btn-release', run.issues > 0 ? `Release (${run.issues} open)` : 'Release');
    setTitle(
      'btn-release',
      run.issues > 0
        ? `${run.issues} open issue${run.issues === 1 ? '' : 's'} will ship with ${run.name}. Expect incidents.`
        : `Release ${run.name} to customers. Demand and hype go up; +1 Trust.`,
    );
  }
}

/** The Abilene site ladder: status, the interconnect countdown (a named wait), the substation. */
function renderSite(s: GameState): void {
  if (!s.revealed['site']) return;
  const status = s.revealed['powerMW']
    ? 'ready to build'
    : s.revealed['interconnect']
      ? s.flags['interconnectDone'] ? 'connected' : 'waiting on the grid'
      : 'reserved';
  setText('siteStatus', status);
  setText('interconnect', s.flags['interconnectDone'] ? 'approved' : fmtClock(Math.ceil(s.interconnectLeft)));
  setText('siteMW', '5');
}

/** Later-stage panels are hidden in Phase 1 but kept current so revealing one shows real values. */
function renderLater(s: GameState): void {
  const n = (id: string, v: number, d = 0) => setText(id, d ? fmtNum(v, d) : fmtInt(v));
  n('govRelations', s.govRelations);
  n('approval', s.approval);
  n('jobsDisplaced', s.jobsDisplaced);
  n('robots', s.robots);
  n('societyApproval', s.approval);
  n('societyJobs', s.jobsDisplaced);
  n('securityLevel', s.securityLevel);
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
  n('statLead', s.lead);
  n('statAlignment', s.alignmentApparent);
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
