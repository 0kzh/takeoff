import type { GameState, Focus, TrainingRun } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, researchCap, demandPercent, copies, activeGpus, powerDrawMW, gpuCapacity, powerBlock,
  powerBlockCost, copiesIdle, contractRate, atRentQuota, billingPerSec, productionPerSec, marketState, priceAbsurd,
  humanShare, perCopyRate, MIN_PRICE,
} from '../engine/economy.js';
import {
  lotSize, lotCost, shownLot, lotReason, gasCost, solarCost, nuclearCost, nextDatacenter, datacenterReason, plantReason,
  queueLine, standingOrderOn, gpuUnitPrice,
} from '../engine/infrastructure.js';
import { marketBreakdown, autoTarget } from '../engine/market.js';
import {
  trainCost, canStartTraining, canRedTeam, canRelease, canReleasePublic, nextRunName, trainingCompute, requiredCompute,
  trainingDuration, computeYield, needsOwnedCompute, evaluatorLine, totalScore, trainBlocker, trainingRun, evalRun,
  trainSlotFree, superhumanTooltips, EVAL_SECONDS, BENCHMARKS, EVALUATORS,
} from '../engine/training.js';
import { govMood, approvalTerms, sl3Cost, runRate, SECURITY_NOTES, fmtJobs } from '../engine/world.js';
import { chipsOnOrder } from '../engine/stores.js';
import { visibleProjects, priceTag, costLabel } from '../engine/projects.js';
import { endingById, endStats } from '../engine/endings.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort, fmtClock, dateLabel } from '../engine/format.js';
import { byId, setText, setShown, showId, setDisabled, setWidth, setTitle, make } from './dom.js';
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
  revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  hideEls = Array.from(document.querySelectorAll<HTMLElement>('[data-hide]'));
  const bind = (id: string, fn: () => void) => byId(id).addEventListener('click', fn);
  bind('btn-task', () => perform('clickTask'));
  bind('btn-buyPower', () => perform('buyPower'));
  bind('btn-grid', () => perform('toggleGrid'));
  bind('btn-lowerPrice', () => perform('lowerPrice'));
  bind('btn-raisePrice', () => perform('raisePrice'));
  bind('btn-autoPrice', () => perform('toggleAutoPrice'));
  bind('btn-marketing', () => perform('buyMarketing'));
  bind('btn-gpu', () => perform('rentGpu'));
  bind('btn-datacenter', () => perform('buildDatacenter'));
  bind('btn-gpuBatch', () => perform('buyGpuBatch'));
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
  renderSite(s);
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

function setToggle(id: string, on: boolean, text: string): void {
  setText(id, text);
  const b = byId(id);
  if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
}

function renderPower(s: GameState): void {
  if (s.stage >= 2) return;
  setText('power', fmtInt(s.power));
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
  setText('gridStatus', s.gridAuto ? 'buys power when it runs low' : 'idle');
}

function renderBusiness(s: GameState): void {
  setText('funds', fmtMoney(s.funds));
  setText('revPerSec', fmtMoney(s.stats.revPerSec));
  setText('contractRate', fmtMoney(contractRate(s)));
  setText('unbilled', fmtInt(s.unbilled));
  setText('price', fmtMoney(s.price));
  const unbilledLine = byId('unbilledLine');
  if (s.stage >= 2) {
    const made = Math.max(1, productionPerSec(s));
    // Unbilled tasks only matter when AUTO is off or the backlog is over 30 s of production.
    const showUnbilled = !s.autoPrice || s.unbilled > 30 * made;
    if (unbilledLine.classList.contains('off') === showUnbilled) unbilledLine.classList.toggle('off', !showUnbilled);
    setText('billRate', fmtInt(s.stats.soldPerSec));
    setText('billPrice', fmtTaskPrice(s.price));
    setTitle('billPrice', marketBreakdown(s).map(([k, v]) => `${k} ×${fmtNum(v, v < 10 ? 2 : 1)}`).join(' · '));
    setToggle('btn-autoPrice', s.autoPrice, s.autoPrice ? 'AUTO' : 'AUTO: off');
    setDisabled('btn-lowerPrice', s.autoPrice);
    setDisabled('btn-raisePrice', s.autoPrice);
    const absurd = !s.autoPrice && s.price > 4 * autoTarget(s);
    setTitle('btn-raisePrice', s.autoPrice ? 'Pricing is on AUTO.' : absurd ? 'nobody pays this' : 'Raise the price by 5%.');
    setTitle('btn-lowerPrice', s.autoPrice ? 'Pricing is on AUTO.' : 'Lower the price by 5%.');
  } else {
    if (unbilledLine.classList.contains('off')) unbilledLine.classList.remove('off');
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
    setDisabled('btn-raisePrice', false);
    setTitle(
      'btn-raisePrice',
      priceAbsurd(s) ? 'nobody pays this' : 'Raise the price by one cent. Fewer tasks bill; each earns more.',
    );
  }
  showId('hypeLine', s.hypeBoost > 1.05);
  setText('hype', s.hypeBoost > 1.5 ? 'strong' : 'fading');
  setText('apiCustomers', fmtInt(s.apiCustomers));
  setText('hypeLevel', fmtInt(s.hypeLevel));
  setText('marketingCost', fmtMoney(marketingCost(s)));
  setDisabled('btn-marketing', s.funds < marketingCost(s));
  setTitle('btn-marketing', `Marketing level ${fmtInt(s.hypeLevel)}. More demand at every price: ×1.1 per level.`);
}

function renderCompute(s: GameState): void {
  if (s.stage >= 2) return;
  setText('gpuCost', fmtMoney(gpuCost(s)));
  const quota = atRentQuota(s);
  setDisabled('btn-gpu', s.funds < gpuCost(s) || quota);
  setText('gpuNote', quota ? 'quota reached — the provider has no more to rent' : '');
  setText('gpus', fmtInt(s.gpus));
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
  setText('infraCopies', fmtInt(copies(s)));
  setText('datacenters', fmtInt(s.datacenters));
  setText('chipPrice', fmtMoney(gpuUnitPrice(s)));
  setText('activeGpus', fmtInt(activeGpus(s)));
  setText('infraTasksPerSec', fmtInt(s.stats.tasksPerSec));
  setText('data', fmtNum(s.data, 1));
  setText('chipsOnOrder', fmtInt(chipsOnOrder(s)));

  setText('gpuLotSize', fmtInt(shownLot(s)));
  setText('gpuBatchCost', fmtMoneyShort(lotCost(s)));
  const reason = lotReason(s);
  setText('gpuReason', reason);
  setDisabled('btn-gpuBatch', !!reason || s.funds < lotCost(s) || lotSize(s) < 1000);
  setTitle(
    'btn-gpuBatch',
    standingOrderOn(s)
      ? 'The standing order buys GPU lots. Turn it off to buy by hand.'
      : `${s.g5 ? 'Nimbus G5s, each the work of 1.5 G4s' : 'Nimbus G4s'}, ${fmtMoneyShort(gpuUnitPrice(s))} each. A lot fits the room and power there is.`,
  );

  const dc = nextDatacenter(s);
  setText('dcNumber', String(dc.n));
  setText('dcSlots', fmtInt(dc.add));
  setText('datacenterCost', fmtMoneyShort(dc.cost));
  const dcWhy = datacenterReason(s);
  setText('dcReason', dcWhy);
  setDisabled('btn-datacenter', !!dcWhy || s.funds < dc.cost);
  setTitle('btn-datacenter', `Room for ${fmtInt(dc.add)} more GPUs, at once.`);

  const plant = (id: string, costId: string, reasonId: string, kind: 'gas' | 'solar' | 'nuclear', cost: number) => {
    setText(costId, fmtMoneyShort(cost));
    const why = plantReason(s, kind);
    const note = why || (kind === 'solar' ? 'joins the queue' : kind === 'nuclear' && s.govRelations >= 60 ? '25% off: relations' : '');
    setText(reasonId, note);
    setDisabled(id, !!why || s.funds < cost);
  };
  plant('btn-turbines', 'turbineCost', 'gasReason', 'gas', gasCost(s));
  plant('btn-solar', 'solarCost', 'solarReason', 'solar', solarCost(s));
  plant('btn-nuclear', 'nuclearCost', 'nuclearReason', 'nuclear', nuclearCost(s));

  const q = queueLine(s);
  setText('interconnectLine', q);
  showId('interconnectLine', q.length > 0);
  setToggle('btn-standing', s.standingOrder, s.standingOrder ? 'ON' : 'OFF');
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
  setText('researchCap', fmtInt(Number.isFinite(cap) ? cap : 0));
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
  setText('modelName', t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`);
  setText('capability', fmtNum(s.capability, 2));
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
  }

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

function renderIdle(s: GameState): void {
  setText('nextRunName', nextRunName(s));
  const cost = trainCost(s);
  setText('trainCost', costLabel({ research: cost.research, funds: cost.funds }));
  setText('trainData', cost.data ? `, ${fmtNum(cost.data, 1)} T data` : '');
  setDisabled('btn-train', !canStartTraining(s));
  const have = trainingCompute(s);
  const want = requiredCompute(s);
  setText('trainCompute', fmtInt(have));
  setText('trainRequired', fmtInt(Math.max(1, Math.round(want))));
  const y = computeYield(s);
  const full = y >= 0.999;
  // Fully trained: "Compute: enough · est. 64 s" (the counts are in the tooltip); short: the counts.
  showId('trainComputeOf', !full);
  showId('trainEnough', full);
  setText('trainEta', full ? `est. ${Math.round(trainingDuration(s))} s` : `undertrained (${Math.round(y * 100)}%)`);
  setTitle(
    'trainComputeLine',
    full
      ? `${fmtInt(have)} GPUs of the ${fmtInt(Math.max(1, Math.round(want)))} it wants: the run keeps its whole gain and takes ${Math.round(trainingDuration(s))} s.`
      : `More GPUs train a better model. This run would keep ${Math.round(y * 100)}% of its gain and take ${Math.round(trainingDuration(s))} s.`,
  );
  setText('trainReason', s.stage >= 2 ? trainBlocker(s) : '');
  // Once the run wants far more than any rented fleet, say what fixes it: owning compute.
  const owned = needsOwnedCompute(s);
  showId('trainShort', owned);
  if (owned) setText('trainShort', s.revealed['site'] ? 'Rented GPUs can\'t keep up. Abilene will.' : 'Rented GPUs can\'t keep up. A datacenter of your own would.');
}

function renderRunning(s: GameState, run: TrainingRun): void {
  const p = run.elapsed / run.duration;
  setText('runName', run.name);
  setText('runFocus', run.focus);
  setText('runPct', fmtInt(Math.floor(p * 100)));
  setWidth(byId('runBar'), p);
  const waiting = run.elapsed >= run.duration && s.training.run !== run;
  setText('runRemaining', waiting ? 'trained; waits for the release slot —' : `${Math.ceil(run.duration - run.elapsed)} s`);
  setText('runShare', fmtInt(s.training.computeShare * 100));
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
  setTitle('evalTotal', evalP >= 1 ? `Reviewers' score: ${totalScore(run)}/40.` : '');
  if (condensed) {
    const done = evalP >= 1;
    const issues = run.phase === 'redteam' ? run.issues : run.issuesFound;
    setText(
      'evalLine',
      done
        ? `${run.name} … ${totalScore(run)}/40 · ${fmtNum(run.capAfter, 2)}× · ${issues === 0 ? 'no issues open' : `${issues} issue${issues === 1 ? '' : 's'} open`}`
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
    setText('btn-release', run.issues > 0 ? `Release (${run.issues} open)` : 'Release');
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

/** Stage 2's world panels: Security, Government, Public, Stats. */
function renderWorld(s: GameState): void {
  if (s.stage < 2) return;
  setText('securityLevel', fmtInt(s.securityLevel));
  if (s.revealed['security']) {
    setText('securityNote', SECURITY_NOTES[s.securityLevel] ?? `SL${s.securityLevel}`);
    const c = sl3Cost(s);
    setText('sl3Cost', `${fmtMoneyShort(c.funds)}, ${c.trust} Trust`);
    setDisabled('btn-sl3', s.securityLevel >= 3 || s.funds < c.funds || s.trust < c.trust);
    showId('btn-sl3', s.securityLevel < 3);
    showId('sl3Cost', s.securityLevel < 3);
  }
  setText('govRelations', fmtInt(Math.round(s.govRelations)));
  setText('govMood', govMood(s));
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
