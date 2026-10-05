import { GameState, isBought, counter } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import type { BotMemory } from './policy.js';
import {
  trainCost, canPressTrain, canRedTeam, canApprove, canSendBack, runReady, startCapability, nextGainPct, runDelaySeconds,
  trainSlotFree, EXPERIMENTS_MAX, gpusShort,
} from '../engine/training.js';
import {
  LOT_SIZES_S3, orderReasonS3, lotCostOf, freeSlots, freePowerGpus, datacenterBuilding, datacenterCost,
  nuclearCost, reactorQueueFull, needsSite2, standingOrderOn,
} from '../engine/infrastructure.js';
import { sl3Cost } from '../engine/world.js';
import { seats, lobbyCost, counterintelCost, approvalTargetS3, paymentsLevel, PAYMENT_APPROVAL } from '../engine/world3.js';
import { rogueShare, reimageCooldown } from '../engine/alignment.js';
import { voteReady } from '../engine/oversight.js';
import { hallUrgent, reactorUrgent } from '../engine/stage3.js';
import { visibleProjects } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import { canPay } from '../engine/state.js';

const ORDER_REFUSE = 3;

export interface S3Memory {
  paymentsPressed?: boolean;
  standingOn?: boolean;
  warnSeen?: number;
  trainings0: number;
  alignBudget: number;
  readyRun: number;
  readyAt: number;
  lastPass: number;
}

function mem3(s: GameState, mem: BotMemory): S3Memory {
  if (!mem.s3) mem.s3 = { trainings0: s.stats.trainings, alignBudget: 0, readyRun: -1, readyAt: 0, lastPass: -1 };
  return mem.s3;
}

const has = (mem: BotMemory, v: string) => mem.variant.split(',').includes(v);

const ALIGNMENT_PROJECTS = [
  'p_interp2', 'p_interp3', 'p_interp4', 'p_interp5', 'p_model_organisms', 'p_honeypots', 'p_debate', 'p_monitor3',
  'p_noise', 'p_successor', 'p_lie_test', 'p_external', 'p_come_clean', 'p_honesty_evals', 'p_freeze', 'p_backups',
];

const NEVER = ['p_steward', 'p_race', 'p_pause', 'p_freeze', 'p_dpa'];

const FOCUS = {
  bot: ['capability', 'efficiency', 'capability', 'safety'],
  racer: ['capability', 'capability', 'capability', 'efficiency'],
} as const;

export function stage3Step(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending || s.stage !== 3) return;
  if (mem.policy === 'naive' || mem.policy === 'greedy' || mem.policy === 'trainfirst') firstTimerS3(s, a, mem);
  else botS3(s, a, mem);
}

function botAnswer(s: GameState, mem: BotMemory): number[] {
  const id = s.activeChoice!.id;
  const racer = mem.policy === 'racer';
  switch (id) {
    case 'c_neuralese':
    case 'c_neuralese2':
      return racer || has(mem, 'neuralese') ? [0] : [1];
    case 'c_committee':
      return has(mem, 'committee-open') ? [0] : has(mem, 'committee-counsel') ? [2] : [1];
    case 'c_hormuz':
      return [0, 1];
    case 'c_mini':
      return has(mem, 'mini-everyone') ? [0] : has(mem, 'mini-inside') ? [2] : [1];
    case 'c_blockade': {
      if (has(mem, 'blockade-escort')) return [0];
      if (has(mem, 'blockade-channel')) return [2, 1];
      const covered = s.flags['stockpile'] === true || s.flags['secondSource'] === true;
      return covered ? [1] : [2, 1];
    }
    case 'c_memo':
      return racer || has(mem, 'memo-bury') ? [1] : [0];
    case 'c_order':
      return has(mem, 'refuse') ? [ORDER_REFUSE] : [0, 1, 2];
    case 'c_vote':
      return [0];
    default:
      return [0];
  }
}

const UNTIMED = ['c_memo', 'c_order', 'c_vote'];

function answer(s: GameState, a: Actions, mem: BotMemory, order: number[]): void {
  const def = choiceById(s.activeChoice!.id);
  if (!def) return;
  const enabled = def.options.map((_, i) => i).filter((i) => choiceOptionEnabled(s, def, i));
  if (has(mem, 'modals-never') && !UNTIMED.includes(def.id)) return;
  if (has(mem, 'modals-first') && enabled.length && !UNTIMED.includes(def.id)) {
    a.resolveChoice(s, enabled[0]!);
    return;
  }
  if (has(mem, 'modals-last') && enabled.length && !UNTIMED.includes(def.id)) {
    a.resolveChoice(s, enabled[enabled.length - 1]!);
    return;
  }
  for (const i of order) {
    if (enabled.includes(i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
  if (enabled.length && UNTIMED.includes(def.id)) a.resolveChoice(s, enabled[0]!);
}

function readModal3(s: GameState, mem: BotMemory): boolean {
  const c = s.activeChoice;
  if (!c) return false;
  const key = `${c.id}|${JSON.stringify(c.context)}`;
  if (key !== mem.choiceKey) {
    mem.choiceKey = key;
    mem.choiceSince = s.stats.timePlayed;
  }
  return s.stats.timePlayed - mem.choiceSince >= 2.5;
}

function focusCycle(mem: BotMemory): readonly string[] {
  if (has(mem, 'focus-capability')) return ['capability'];
  if (has(mem, 'focus-safety')) return ['safety'];
  if (has(mem, 'focus-efficiency')) return ['efficiency'];
  return mem.policy === 'racer' ? FOCUS.racer : FOCUS.bot;
}

function researchAllocTarget(mem: BotMemory): number {
  for (const v of ['20', '30', '50', '60', '70']) if (has(mem, `research-${v}`)) return Number(v);
  return mem.policy === 'racer' ? 50 : 40;
}

function monitorTarget(s: GameState, mem: BotMemory): number {
  if (has(mem, 'monitors-0')) return 0;
  if (mem.policy === 'racer') return 5;
  let t = s.autonomy >= 40 ? 15 : 10;
  if (rogueShare(s) > 0.02) t += 5;
  return t;
}

function alignShareOfResearch(mem: BotMemory): number {
  if (mem.policy === 'racer' || has(mem, 'alignwork-0')) return 0;
  if (has(mem, 'alignwork-30')) return 0.3;
  if (has(mem, 'alignwork-20')) return 0.2;
  return 0.1;
}

function budgetTarget(mem: BotMemory): number {
  if (has(mem, 'budget-0') || has(mem, 'budget-25')) return 0.25;
  if (has(mem, 'budget-100') || has(mem, 'budget-75')) return 0.75;
  return 0.5;
}

function researchOk(s: GameState, research: number, exempt = false): boolean {
  if (research <= 0) return true;
  const run = trainCost(s).research ?? 0;
  if (research > run) return false;
  if (!exempt && runDelaySeconds(s, { research }) >= 30) return false;
  return !(s.research >= 0.6 * run && research > 0.2 * run);
}

function wanted(s: GameState, mem: BotMemory, id: string): boolean {
  if (NEVER.includes(id)) return id === 'p_pause' && has(mem, 'pause');
  if (id === 'p_spec2') return false;
  const p = visibleProjects(s).find((x) => x.id === id);
  if (!p) return false;
  const grant = p.grant === true;
  if (grant && (mem.policy === 'cautious' || has(mem, 'grants-none'))) return false;
  if (mem.policy === 'racer' && ALIGNMENT_PROJECTS.includes(id)) return false;
  return true;
}

function botS3(s: GameState, a: Actions, mem: BotMemory): void {
  const m = mem3(s, mem);
  const now = s.stats.timePlayed;
  if (s.activeChoice && readModal3(s, mem)) answer(s, a, mem, botAnswer(s, mem));

  const cycle = focusCycle(mem);
  const want = cycle[(s.stats.trainings - m.trainings0) % cycle.length]!;
  if (trainSlotFree(s) && s.training.focus !== want) a.setFocus(s, want as 'capability' | 'efficiency' | 'safety');
  if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
  const run = s.training.run;
  if (run && run.phase === 'redteam') {
    if (has(mem, 'sendback-always') && canSendBack(s)) a.sendBack(s);
    else if (canRedTeam(s) && !isBought(s, 'p_auto_redteam')) a.redTeam(s);
    if (runReady(s) && m.readyRun !== run.id) {
      m.readyRun = run.id;
      m.readyAt = now;
    }
    const issuesOpen = run.issues > 0 && !isBought(s, 'p_auto_redteam');
    if (canApprove(s) && !issuesOpen && now - m.readyAt >= 6 && s.training.redTeamRemaining <= 0) a.approve(s);
  }

  if (mem.ticks % 5 !== 0) return;
  m.lastPass = now;

  a.setResearchAlloc(s, researchAllocTarget(mem));
  if (s.revealed['monitors']) a.setMonitorShare(s, monitorTarget(s, mem));
  if (s.revealed['redteamDepth']) a.setRedteamDepth(s, 'thorough');
  if (s.revealed['stepSize']) a.setStepSize(s, has(mem, 'step-small') ? 'small' : has(mem, 'step-large') ? 'large' : 'normal');

  if (visibleProjects(s).some((p) => p.id === 'p_monitor2') && a.buyProject(s, 'p_monitor2')) mem.bought.push('p_monitor2');

  if (s.revealed['reimage'] && rogueShare(s) >= 0.04 && reimageCooldown(s) <= 0 && !has(mem, 'monitors-0')) a.reimage(s);

  const buildout = isBought(s, 'p_buildout');
  const big = LOT_SIZES_S3[LOT_SIZES_S3.length - 1];
  if (!buildout && !datacenterBuilding(s) && freeSlots(s) < 2 * big) {
    if (needsSite2(s)) {
      const site = visibleProjects(s).find((x) => x.id === 'p_site2');
      if (site && site.canAfford(s) && a.buyProject(s, 'p_site2')) mem.bought.push('p_site2');
    } else if (s.buildFund >= datacenterCost(s)) a.buildDatacenter(s);
  }
  if (!buildout) {
    const reactorQueued = s.powerQueue.some((o) => o.kind === 'nuclear');
    if (!reactorQueued && !reactorQueueFull(s) && freePowerGpus(s) < 2 * big && s.buildFund >= nuclearCost(s)) a.buyNuclear(s);
  }
  if (isBought(s, 'p_standing_order') && s.standingOrder) a.toggleStanding(s);
  if (s.revealed['infrastructure']) {
    const fit = LOT_SIZES_S3.filter((n) => !orderReasonS3(s, n) && lotCostOf(s, n) <= s.buildFund);
    if (fit.length) a.buyGpuBatch(s, fit[fit.length - 1]!);
  }
  setShare(s, a, budgetTarget(mem));

  let saving = false;
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && !a.buySL3(s)) saving = true;
  for (const id of ['p_distill', 'p_code_review', 'p_g6']) {
    if (saving) break;
    const p = visibleProjects(s).find((x) => x.id === id);
    if (!p || isBought(s, id)) continue;
    if (p.canAfford(s) && researchOk(s, p.cost(s).research ?? 0) && a.buyProject(s, id)) mem.bought.push(id);
    else saving = (p.cost(s).funds ?? 0) > 0;
  }
  for (const p of visibleProjects(s)) {
    if (p.id === 'p_pause' || !wanted(s, mem, p.id) || !p.canAfford(s)) continue;
    const cost = p.cost(s);
    if (!researchOk(s, cost.research ?? 0, p.instrument === true || p.urgent?.(s) === true) || (saving && (cost.funds ?? 0) > 0)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (saving) return;

  if (s.revealed['alignWork']) a.setAlignWork(s, alignShareOfResearch(mem));
  if (s.revealed['experiments']) experiments(s, a);
  if (s.revealed['lobby'] && !has(mem, 'lobby-never') && seats(s) < 7 && counter(s, 'lobbyHeat') === 0 && s.funds >= lobbyCost(s)) a.lobby(s);
  if (s.revealed['counterintel'] && s.lead < 2 && counter(s, 'ciHeat') === 0 && s.funds >= counterintelCost(s)) a.counterintel(s);
  if (s.revealed['payments']) payments(s, a, mem);

  if (has(mem, 'pause') && visibleProjects(s).some((p) => p.id === 'p_pause' && p.canAfford(s)) && !s.activeChoice) a.buyProject(s, 'p_pause');
  if (voteReady(s) && !s.activeChoice && !mem.holdTransition) a.buyProject(s, slowByReading(s) ? 'p_steward' : 'p_race');
}

function setShare(s: GameState, a: Actions, target: number): void {
  let guard = 0;
  while (Math.abs(s.buildShare - target) > 1e-9 && guard++ < 3) a.cycleBuildShare(s);
}

function experiments(s: GameState, a: Actions): void {
  if (s.training.pending || s.training.run?.phase === 'training') return;
  const c0 = startCapability(s);
  for (const rung of [10, 25]) {
    if (c0 >= rung) continue;
    const land = c0 * (1 + nextGainPct(s) / 100);
    if (land >= 0.97 * rung || land < 0.9 * rung) return;
    if (counter(s, 'expPts') >= EXPERIMENTS_MAX) return;
    a.runExperiments(s, 1);
    return;
  }
}

function payments(s: GameState, a: Actions, mem: BotMemory): void {
  const level = paymentsLevel(s);
  let want = level;
  if (has(mem, 'payments-0')) want = 0;
  else if (has(mem, 'payments-5')) want = 5;
  else {
    const base = approvalTargetS3(s) - PAYMENT_APPROVAL * level;
    want = 0;
    while (want < 5 && base + PAYMENT_APPROVAL * want <= -30) want++;
  }
  if (want > level) a.stepPayments(s, true);
  else if (want < level) a.stepPayments(s, false);
}

function slowByReading(s: GameState): boolean {
  const t = s.alignmentTrue;
  if (s.interpretability >= 3) return t < 60;
  if (isBought(s, 'p_lie_test')) return Math.round(t / 10) * 10 < 60;
  if (isBought(s, 'p_successor')) return t < 60;
  if (isBought(s, 'p_noise')) return t < 50;
  if (isBought(s, 'p_honeypots')) return t < 55;
  return true;
}

function firstTimerS3(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal3(s, mem)) {
    const def = choiceById(s.activeChoice.id);
    if (def) {
      if (has(mem, 'refuse') && def.id === 'c_order') a.resolveChoice(s, ORDER_REFUSE);
      else {
        const first = def.options.map((_, i) => i).find((i) => choiceOptionEnabled(s, def, i));
        if (first !== undefined) a.resolveChoice(s, first);
      }
    }
  }
  if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
  if (canApprove(s)) a.approve(s);
  if (mem.ticks % 10 !== 0) return;
  const greedy = mem.policy === 'greedy';
  const trainfirst = mem.policy === 'trainfirst';
  if (trainfirst) infraByReason(s, a);
  for (const p of visibleProjects(s)) {
    if (p.id === 'p_pause' || p.id === 'p_race' || !p.canAfford(s)) continue;
    if (p.id === 'p_steward' && mem.holdTransition) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) a.buySL3(s);
  if (hallUrgent(s) && s.buildFund >= datacenterCost(s)) a.buildDatacenter(s);
  if (reactorUrgent(s) && s.buildFund >= nuclearCost(s)) a.buyNuclear(s);
  if (!greedy && !trainfirst && isBought(s, 'p_standing_order') && !standingOrderOn(s) && mem3(s, mem).standingOn !== true) {
    mem3(s, mem).standingOn = true;
    a.toggleStanding(s);
  }
  if (!greedy && !trainfirst && trainSlotFree(s) && gpusShort(s)) {
    const n = [...LOT_SIZES_S3].reverse().find((k) => !orderReasonS3(s, k) && s.buildFund >= lotCostOf(s, k));
    if (n) a.buyGpuBatch(s, n);
  }
  const m3 = mem3(s, mem);
  if (s.revealed['payments'] && m3.paymentsPressed !== true) {
    m3.paymentsPressed = true;
    a.stepPayments(s, true);
  }
  const warned = Math.max(counter(s, 'riotWarnAt'), counter(s, 'sabotageWarnAt'));
  if (s.revealed['payments'] && warned > (m3.warnSeen ?? 0)) {
    m3.warnSeen = warned;
    if (paymentsLevel(s) < 3) a.stepPayments(s, true);
  }
  if (greedy || trainfirst) {
    for (const n of [...LOT_SIZES_S3].reverse()) a.buyGpuBatch(s, n);
    if (s.revealed['lobby'] && s.funds >= lobbyCost(s)) a.lobby(s);
    if (s.revealed['counterintel'] && s.funds >= counterintelCost(s)) a.counterintel(s);
    if (s.revealed['experiments'] && trainfirst) a.runExperiments(s, 1);
  }
}

function infraByReason(s: GameState, a: Actions): void {
  const small = LOT_SIZES_S3[0];
  const why = orderReasonS3(s, small);
  if (why === 'no room' && !datacenterBuilding(s) && s.buildFund >= datacenterCost(s)) a.buildDatacenter(s);
  else if (why === 'no power' && !reactorQueueFull(s) && s.buildFund >= nuclearCost(s)) a.buyNuclear(s);
}
