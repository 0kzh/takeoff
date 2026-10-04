import { GameState, isBought, counter } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import type { BotMemory } from './policy.js';
import { researchRate } from '../engine/economy.js';
import {
  trainCost, canStartTraining, canRedTeam, canApprove, canSendBack, runReady, startCapability, nextGainPct, researchUnit,
  trainSlotFree, EXPERIMENTS_MAX,
} from '../engine/training.js';
import {
  LOT_SIZES_S3, orderReasonS3, lotCostOf, lotHold, freeSlots, freePowerGpus, datacenterBuilding, datacenterCost,
  nuclearCost, reactorQueueFull, needsSite2, BUDGET_STEPS,
} from '../engine/infrastructure.js';
import { sl3Cost } from '../engine/world.js';
import { seats, lobbyCost, counterintelCost, approvalTargetS3, paymentsLevel, PAYMENT_APPROVAL } from '../engine/world3.js';
import { rogueShare, reimageCooldown } from '../engine/alignment.js';
import { voteReady } from '../engine/oversight.js';
import { hallUrgent, reactorUrgent } from '../engine/stage3.js';
import { visibleProjects } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import { canPay } from '../engine/state.js';

/**
 * Stage 3's policies (stage3.md §9.1–§9.2). `bot` is the reasonable bot; `racer` and `cautious` are
 * the reasonable bot with one temperament changed; `naive` is the first-timer of §9.2; `greedy`
 * presses every enabled purchase; `trainfirst` mirrors the critic harness (infrastructure by the lot
 * row's reason, then everything enabled once). Decision variants (`--variant`) change one thing.
 */

/** Per-stage bookkeeping the Stage 3 policies keep (on BotMemory). */
export interface S3Memory {
  paymentsPressed?: boolean;
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

/** Projects the racer skips: every lab after I and every project that only buys alignment. */
const ALIGNMENT_PROJECTS = [
  'p_interp2', 'p_interp3', 'p_interp4', 'p_interp5', 'p_model_organisms', 'p_honeypots', 'p_debate', 'p_monitor3',
  'p_noise', 'p_successor', 'p_lie_test', 'p_external', 'p_come_clean', 'p_honesty_evals', 'p_freeze', 'p_backups',
];

/** Never bought by a policy unless a variant asks: the exit goals (the vote decides), the Pause, the freeze, the DPA. */
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

// ---------- modals ----------

/** The reasonable bot's answer to each Stage 3 modal, by option index (first enabled one in the list). */
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
      return has(mem, 'refuse') ? [2] : [0, 1, 2];
    case 'c_vote':
      return [0];
    default:
      return [0];
  }
}

/** Untimed modals (the memo, the order, the vote) are always answered: leaving them open is a soft-lock by choice. */
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

// ---------- the reasonable bot (and racer, cautious) ----------

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
  return 1 / 7;
}

function budgetTarget(mem: BotMemory): number {
  for (const v of [0, 25, 50, 75, 100]) if (has(mem, `budget-${v}`)) return v / 100;
  return 0.5;
}

/** A research price the bot will pay now (§9.1 item 3). */
function researchOk(s: GameState, research: number): boolean {
  if (research <= 0) return true;
  const run = trainCost(s).research ?? 0;
  if (research > run) return false;
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

  // Training: the focus for the next run, Train by hand until Continual learning, red-team, approve.
  const cycle = focusCycle(mem);
  const want = cycle[(s.stats.trainings - m.trainings0) % cycle.length]!;
  if (trainSlotFree(s) && s.training.focus !== want) a.setFocus(s, want as 'capability' | 'efficiency' | 'safety');
  if (canStartTraining(s) && !isBought(s, 'p_auto_train')) a.startTraining(s);
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

  // The rest twice a second.
  if (mem.ticks % 5 !== 0) return;
  const dt = m.lastPass < 0 ? 0 : now - m.lastPass;
  m.lastPass = now;

  // Sliders.
  a.setResearchAlloc(s, researchAllocTarget(mem));
  if (s.revealed['monitors']) a.setMonitorShare(s, monitorTarget(s, mem));
  // Standing switches.
  if (s.revealed['redteamDepth']) a.setRedteamDepth(s, 'thorough');
  if (s.revealed['stepSize']) a.setStepSize(s, has(mem, 'step-small') ? 'small' : has(mem, 'step-large') ? 'large' : 'normal');

  // The free monitor first.
  if (visibleProjects(s).some((p) => p.id === 'p_monitor2') && a.buyProject(s, 'p_monitor2')) mem.bought.push('p_monitor2');

  // Re-image at a rogue share of 4 %.
  if (s.revealed['reimage'] && rogueShare(s) >= 0.04 && reimageCooldown(s) <= 0 && !has(mem, 'monitors-0')) a.reimage(s);

  // Money, in priority order: halls and reactors by hand until the build-out; SL3; then the cards.
  // While Security level 3 is short, money is held for it (the theft is in February).
  const buildout = isBought(s, 'p_buildout');
  const big = LOT_SIZES_S3[LOT_SIZES_S3.length - 1];
  if (!buildout && !datacenterBuilding(s) && !needsSite2(s) && freeSlots(s) < 2 * big && s.funds >= datacenterCost(s)) a.buildDatacenter(s);
  let hold = 0;
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && !a.buySL3(s)) hold = sl3Cost(s).funds;
  const spare = (price: number) => price <= 0 || s.funds - price >= hold;
  if (!buildout && hold === 0) {
    const reactorQueued = s.powerQueue.some((o) => o.kind === 'nuclear');
    if (!reactorQueued && !reactorQueueFull(s) && freePowerGpus(s) < 2 * big && s.funds >= nuclearCost(s)) a.buyNuclear(s);
  }

  // Then Distillation and the G6 allocation, before more chips (§9.1 item 5): each held for in turn.
  for (const id of ['p_distill', 'p_code_review', 'p_g6']) {
    if (hold > 0) break;
    const p = visibleProjects(s).find((x) => x.id === id);
    if (!p || isBought(s, id)) continue;
    if (p.canAfford(s) && researchOk(s, p.cost(s).research ?? 0) && a.buyProject(s, id)) mem.bought.push(id);
    else hold = p.cost(s).funds ?? 0;
  }
  // The standing budget: off while something is held for, else the policy's share.
  const saving = hold > 0;
  setBudget(s, a, saving ? 0 : budgetTarget(mem));
  // Room and power come before the cards: the next hall (or the second campus it needs) and the next
  // reactor are held for while they are short, so the fleet never stalls for a card. After the
  // build-out grant the bot only keeps the money; Sage places the order.
  if (hold === 0) {
    if (!datacenterBuilding(s) && freeSlots(s) < 2 * big) {
      if (needsSite2(s)) {
        const site = visibleProjects(s).find((x) => x.id === 'p_site2');
        if (site && site.canAfford(s) && a.buyProject(s, 'p_site2')) mem.bought.push('p_site2');
        else if (site) hold += site.cost(s).funds ?? 0;
      } else hold += datacenterCost(s);
    }
    const reactorQueued = s.powerQueue.some((o) => o.kind === 'nuclear');
    if (!reactorQueued && !reactorQueueFull(s) && freePowerGpus(s) < 2 * big) hold += nuclearCost(s);
    if (hold > s.funds * 4) hold = 0;
  }

  // The budget's share is the lots' (half of income keeps the queue full): the cards spend the rest.
  if (!saving && !orderReasonS3(s, big) && s.standingBudget > 0) hold += Math.min(s.standingPool, lotCostOf(s, big));
  // Projects: grants (not the Spec revision), then table order; research under the run rule.
  for (const p of visibleProjects(s)) {
    if (!wanted(s, mem, p.id) || !p.canAfford(s)) continue;
    const cost = p.cost(s);
    if (!researchOk(s, cost.research ?? 0) || !spare(cost.funds ?? 0)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (saving) return;

  // Repeatables (§9.1 item 6).
  if (s.revealed['alignWork'] && dt > 0) {
    m.alignBudget += (researchRate(s) * dt * alignShareOfResearch(mem));
    const unit = researchUnit(s);
    if (m.alignBudget >= unit && s.research >= unit) {
      if (a.alignWork(s, 1)) m.alignBudget -= unit;
    }
    m.alignBudget = Math.min(m.alignBudget, 10 * unit);
  }
  if (s.revealed['experiments']) experiments(s, a);
  if (s.revealed['lobby'] && !has(mem, 'lobby-never') && seats(s) < 7 && counter(s, 'lobbyHeat') === 0 && s.funds >= lobbyCost(s)) a.lobby(s);
  if (s.revealed['counterintel'] && s.lead < 2 && counter(s, 'ciHeat') === 0 && s.funds >= counterintelCost(s)) a.counterintel(s);
  if (s.revealed['payments']) payments(s, a, mem);
  // The big lot by hand when money piles up and the queue has room (the budget fills the rest).
  if (s.revealed['infrastructure'] && !saving && !orderReasonS3(s, big)) {
    const cost = lotCostOf(s, big);
    if (s.funds - cost >= Math.max(cost, lotHold(s))) a.buyGpuBatch(s, big);
  }

  // The vote (§9.1 item 1), or the Pause when the variant signs it.
  if (has(mem, 'pause') && visibleProjects(s).some((p) => p.id === 'p_pause' && p.canAfford(s)) && !s.activeChoice) a.buyProject(s, 'p_pause');
  if (voteReady(s) && !s.activeChoice) a.buyProject(s, slowByReading(s) ? 'p_steward' : 'p_race');
}

function setBudget(s: GameState, a: Actions, target: number): void {
  if (!s.revealed['standingOrder'] || !isBought(s, 'p_standing_order')) return;
  let guard = 0;
  while (Math.abs(s.standingBudget - target) > 1e-9 && guard++ < BUDGET_STEPS.length) a.toggleStanding(s);
}

/** Experiments only when the next run would land within 10 % under a rung (§9.1 item 6). */
function experiments(s: GameState, a: Actions): void {
  // Points go into the next run to start: none while one is training (they would wait a run).
  if (s.training.pending || s.training.run?.phase === 'training') return;
  const c0 = startCapability(s);
  for (const rung of [10, 25]) {
    if (c0 >= rung) continue;
    const land = c0 * (1 + nextGainPct(s) / 100);
    if (land >= 0.98 * rung || land < 0.9 * rung) return;
    if (counter(s, 'expPts') >= EXPERIMENTS_MAX) return;
    a.runExperiments(s, 1);
    return;
  }
}

/** Payments at the lowest level that keeps the approval target above −30 (variants pin 0 or 5). */
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

/** §9.1: Slow down if the best reading says true alignment is under 60, or there is none; else Race. */
function slowByReading(s: GameState): boolean {
  const t = s.alignmentTrue;
  if (s.interpretability >= 3) return t < 60;
  if (isBought(s, 'p_lie_test')) return Math.round(t / 10) * 10 < 60;
  if (isBought(s, 'p_successor')) return t < 60;
  if (isBought(s, 'p_noise')) return t < 50;
  if (isBought(s, 'p_honeypots')) return t < 55;
  return true;
}

// ---------- the first-timers ----------

/**
 * `naive` (§9.2): every affordable project and grant in screen order; Train when it is enabled;
 * approves at once; never a slider, Hold or Re-image; Capability focus; the first enabled modal
 * option; the urgent hall and reactor; brings Slow down. `greedy` also presses every lot it can.
 * `trainfirst` buys infrastructure by the lot row's reason first (the critic harness).
 */
function firstTimerS3(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal3(s, mem)) {
    const def = choiceById(s.activeChoice.id);
    if (def) {
      if (has(mem, 'refuse') && def.id === 'c_order') a.resolveChoice(s, 2);
      else {
        const first = def.options.map((_, i) => i).find((i) => choiceOptionEnabled(s, def, i));
        if (first !== undefined) a.resolveChoice(s, first);
      }
    }
  }
  if (canStartTraining(s)) a.startTraining(s);
  if (canApprove(s)) a.approve(s);
  if (mem.ticks % 10 !== 0) return;
  const greedy = mem.policy === 'greedy';
  const trainfirst = mem.policy === 'trainfirst';
  if (trainfirst) infraByReason(s, a);
  for (const p of visibleProjects(s)) {
    if (p.id === 'p_pause' || p.id === 'p_race' || !p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) a.buySL3(s);
  if (hallUrgent(s) && s.funds >= datacenterCost(s)) a.buildDatacenter(s);
  if (reactorUrgent(s) && s.funds >= nuclearCost(s)) a.buyNuclear(s);
  // A new button is pressed once, as a new card is bought: Payments goes up a level when it appears.
  if (s.revealed['payments'] && mem3(s, mem).paymentsPressed !== true) {
    mem3(s, mem).paymentsPressed = true;
    a.stepPayments(s, true);
  }
  if (greedy || trainfirst) {
    for (const n of [...LOT_SIZES_S3].reverse()) a.buyGpuBatch(s, n);
    if (s.revealed['lobby'] && s.funds >= lobbyCost(s)) a.lobby(s);
    if (s.revealed['counterintel'] && s.funds >= counterintelCost(s)) a.counterintel(s);
    // The harness presses Experiments (capped per run); research is never pressed to nothing.
    if (s.revealed['experiments'] && trainfirst) a.runExperiments(s, 1);
  }
}

function infraByReason(s: GameState, a: Actions): void {
  const small = LOT_SIZES_S3[0];
  const why = orderReasonS3(s, small);
  if (why === 'no room' && !datacenterBuilding(s) && s.funds >= datacenterCost(s)) a.buildDatacenter(s);
  else if (why === 'no power' && !reactorQueueFull(s) && s.funds >= nuclearCost(s)) a.buyNuclear(s);
}
