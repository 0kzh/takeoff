import { GameState, isBought, canPay } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import {
  gpuCost, marketingCost, demandPercent, expectedSalesPerSec, researchCap, potentialTasksPerSec, powerBlockCost,
} from '../engine/economy.js';
import {
  trainCost, canRedTeam, canRelease, canReleasePublic, canStartTraining, gpusShort, needsDatacenter,
  evalRun, gpusAvailable, gpusNeeded, canPressTrain, runDelaySeconds,
} from '../engine/training.js';
import {
  lotSize, lotCost, lotReason, plantReason, lotFits, lotCostOf, gasCost, solarCost, nuclearCost, solarQueueFull, datacenterCost,
  GAS_MW, SOLAR_MW, NUCLEAR_MW, freePowerGpus, freeSlots, gpuCapacity, buildWall, standingOrderOn } from '../engine/infrastructure.js';
import { sl3Cost } from '../engine/world.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled, optionCost } from '../engine/events.js';
import type { ProjectDef } from '../data/projects.js';
import { stage3Step, S3Memory } from './policy3.js';

/**
 * `trainfirst` mirrors the critic harness's first-timer (tools/critic/games/takeoff*.mjs): it trains
 * whenever Train is enabled, holds the GPU/marketing drip while a big funds goal is on screen, buys
 * every other affordable thing, and in Stage 2 buys infrastructure by the lot row's reason.
 */
export type PolicyName = 'bot' | 'naive' | 'greedy' | 'trainfirst' | 'racer' | 'cautious';


export interface BotMemory {
  policy: PolicyName;
  ticks: number;
  lastPriceTick: number;
  hireNext: 'researcher' | 'lab';
  /** Ids the bot bought this tick, for the sim's event lines. */
  bought: string[];
  /** Naive policy: fractional clicks, price-check bookkeeping. */
  clickAcc: number;
  lastPriceMove: number;
  lowChecks: number;
  prevBacklog: number;
  /** The open modal and when it opened: players read before they click. */
  choiceKey: string;
  choiceSince: number;
  /**
   * Decision variants (critic round 2 §5). Both stages: `modals-best`, `modals-worst`, `modals-last`,
   * `modals-ignore`, `redteam-never`. Stage 1: `price-never`, `focus-efficiency`, `focus-safety`.
   * Stage 2: `slider-N`, `safety-0|2`, `gulf-sign`, `gulf-domestic`. Empty: the plain policy.
   */
  variant: string;
  /** Leave the stage-ending purchase (Break ground) to the player (the browser smoke test clicks it). */
  holdTransition: boolean;
  /** Stage 3 bookkeeping (sim/policy3.ts). */
  s3?: S3Memory;
}

export function newBotMemory(policy: PolicyName = 'bot', holdTransition = false, variant = ''): BotMemory {
  return {
    policy, ticks: 0, lastPriceTick: -100, hireNext: 'researcher', bought: [],
    clickAcc: 0, lastPriceMove: -100, lowChecks: 0, prevBacklog: 0, choiceKey: '', choiceSince: 0, holdTransition,
    variant,
  };
}

/** The purchase that ends Stage 1. */
const TRANSITION = 'p_datacenter';

/**
 * With `holdTransition`, First Datacenter's price is kept in hand when the policy would be saving for
 * it (the bot from the wall, the naive and the first-timer from the card), and once the money is
 * there: the same moment the policy would buy it, left for the player to click.
 */
function heldGoalPrice(s: GameState, mem: BotMemory): number {
  if (!mem.holdTransition || !isVisible(s, TRANSITION)) return 0;
  const price = projectById(TRANSITION)!.cost(s).funds ?? 0;
  const saving = mem.policy === 'bot' ? needsDatacenter(s) : mem.policy !== 'greedy';
  // The bot holds the price from the wall only (it buys there); the others once they can pay it.
  if (mem.policy === 'bot') return saving ? price : 0;
  return saving || s.funds >= price ? price : 0;
}

/** Seconds a policy reads a modal before answering it (a 2-s snapshot sees every modal). */
export const READING_SECONDS = 2.5;

/** True once the open modal has been on screen for the reading time. */
function readModal(s: GameState, mem: BotMemory): boolean {
  const a = s.activeChoice;
  if (!a) return false;
  const key = `${a.id}|${JSON.stringify(a.context)}`;
  if (key !== mem.choiceKey) {
    mem.choiceKey = key;
    mem.choiceSince = s.stats.timePlayed;
  }
  return s.stats.timePlayed - mem.choiceSince >= READING_SECONDS;
}

/** One decision pass per 100 ms tick for the chosen policy. */
export function policyStep(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.stage >= 3) {
    stage3Step(s, a, mem);
    return;
  }
  // `racer` and `cautious` are Stage 3 temperaments: before it they play the reasonable bot.
  const real = mem.policy === 'racer' || mem.policy === 'cautious' ? 'bot' : mem.policy;
  if (s.stage >= 2) {
    // The first-timers follow the critic harness's Stage 2 rules (infrastructure by the lot row's
    // reason; every other enabled purchase); greedy presses the lots five times a pass.
    if (real === 'bot') {
      const was = mem.policy;
      mem.policy = 'bot';
      botStepS2(s, a, mem);
      mem.policy = was;
    } else trainfirstStepS2(s, a, mem);
    return;
  }
  if (real !== mem.policy) {
    const was = mem.policy;
    mem.policy = real;
    stage1Step(s, a, mem);
    mem.policy = was;
    return;
  }
  stage1Step(s, a, mem);
}

// ---------- Stage 1 decision variants (the critic's explorer, tools/critic/explore.mjs) ----------

/** The critic's "worst-looking" answers: lose Trust, lose researchers, cut the price, gamble, ship. */
const WORST_LABELS = [/take the bridge/, /cut the price/, /no comment/, /publish a rebuttal/, /let them go/, /submit Sage/, /let her try/, /release anyway/];
/** The critic's "best-looking" answers; a greyed one is waited for (the timer decides). */
const BEST_LABELS = [/wait for a real round/, /open-source/, /publish the system card/, /sign it/, /match the offer|offer equity/, /decline/, /not now/, /keep red-teaming/];

/**
 * A variant's answer to the open modal: true when the variant decided (answered, or chose to wait).
 * Stage 2's best/worst tables are answerChoiceS2's; this is Stage 1's (and both stages' last/ignore).
 */
function answerVariant(s: GameState, a: Actions, mem: BotMemory): boolean {
  const active = s.activeChoice;
  const def = active ? choiceById(active.id) : undefined;
  if (!active || !def) return false;
  const enabled = def.options.map((_, i) => i).filter((i) => choiceOptionEnabled(s, def, i));
  if (mem.variant === 'modals-ignore' || mem.variant === 'ignore-modals') return true;
  if (mem.variant === 'modals-last') {
    if (enabled.length) a.resolveChoice(s, enabled[enabled.length - 1]!);
    return true;
  }
  if (mem.variant === 'redteam-never' && active.id === 'c_ship_issues') {
    a.resolveChoice(s, 0);
    return true;
  }
  if (s.stage !== 1 || (mem.variant !== 'modals-best' && mem.variant !== 'modals-worst')) return false;
  // As the explorer's byLabel: the first enabled option whose label matches; the best-looking player
  // waits while a matching option is greyed (the timer decides); otherwise the first enabled one.
  const wanted = mem.variant === 'modals-best' ? BEST_LABELS : WORST_LABELS;
  const matches = (i: number) => wanted.some((re) => re.test(def.options[i]!.label));
  const hit = enabled.find(matches);
  if (hit !== undefined) {
    a.resolveChoice(s, hit);
    return true;
  }
  if (mem.variant === 'modals-best' && def.options.some((_, i) => !enabled.includes(i) && matches(i))) return true;
  if (enabled.length) a.resolveChoice(s, enabled[0]!);
  return true;
}

/** Variant `redteam-never`: release the moment Release works, open issues or not. */
function releaseAtOnce(s: GameState, a: Actions, mem: BotMemory): boolean {
  if (mem.variant !== 'redteam-never') return false;
  const run = s.training.run;
  if (run?.phase === 'redteam' && canReleasePublic(s)) a.release(s);
  return true;
}

/** Variants `focus-efficiency` / `focus-safety`: every run trains with that Focus. */
function variantFocus(s: GameState, a: Actions, mem: BotMemory): boolean {
  if (mem.variant === 'focus-efficiency') return a.setFocus(s, 'efficiency') || true;
  if (mem.variant === 'focus-safety') return a.setFocus(s, 'safety') || true;
  return false;
}

/** Fixed answers to every modal (bot policy): the careful answer, paid for when it can be. */
const CHOICE_POLICY: Record<string, number[]> = {
  c_gamble: [1],
  c_sage2: [0],
  c_rival: [0],
  c_journalist: [0, 1],
  c_customer_email: [0],
  c_ship_issues: [1],
  c_poach: [1, 0, 2],
  c_bridge: [1],
  c_letter: [0],
  c_leaderboard: [0],
};

function isVisible(s: GameState, id: string): boolean {
  return visibleProjects(s).some((p) => p.id === id);
}


/**
 * Stage 1 modals whose careful answer costs research, money or Trust: hold the modal open for up
 * to 45 s while that resource comes in (Trust is held back for it meanwhile, see spendTrust).
 */
const WAIT_FOR: Record<string, number[]> = { c_poach: [1, 0], c_journalist: [0] };

function waitForCarefulAnswer(s: GameState, mem: BotMemory): boolean {
  const active = s.activeChoice!;
  const wanted = WAIT_FOR[active.id];
  const def = choiceById(active.id);
  if (!wanted || !def) return false;
  if (wanted.some((i) => choiceOptionEnabled(s, def, i))) return false;
  return s.stats.timePlayed - mem.choiceSince < 45;
}

function answerChoice(s: GameState, a: Actions, table: Record<string, number[]>): void {
  const active = s.activeChoice!;
  const def = choiceById(active.id);
  if (!def) return;
  for (const i of table[active.id] ?? [0]) {
    if (choiceOptionEnabled(s, def, i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
}

/**
 * Demand between 60% and 120% while supply is small. Once the copies make more than 120%
 * demand can bill, the bot prices to clear production instead (as UP players do).
 */
function nudgePrice(s: GameState, a: Actions, mem: BotMemory): void {
  if (!s.revealed['business'] || mem.ticks - mem.lastPriceTick < 10) return;
  mem.lastPriceTick = mem.ticks;
  const pct = demandPercent(s);
  const supply = Math.max(s.stats.tasksPerSec, s.gpus === 0 ? 4 : 0);
  const sales = expectedSalesPerSec(s);
  const backlog = s.unbilled;
  if (supply < 12) {
    if (pct > 120 && backlog < 50) a.raisePrice(s);
    else if (sales < supply * 1.02 || backlog > 200) a.lowerPrice(s);
    return;
  }
  if (sales < supply * 1.02 + backlog / 40) a.lowerPrice(s);
  else if (sales > supply * 1.25 + backlog / 10 && backlog < supply * 3) a.raisePrice(s);
}

// ---------- Stage 1: the first-timer, the greedy player, the bot ----------

/** Seconds between the naive player's purchase passes and price checks (the critic's 2-s snapshots). */
const NAIVE_BUY_EVERY = 10;
const NAIVE_PRICE_EVERY = 20;
const NAIVE_PRICE_COOLDOWN = 8;

/**
 * Stage 1, all three policies on one purchase loop (in this economy the first-timer's greed is the
 * efficient way to spend; what separates the players is judgement).
 *
 * `naive` plays like the critic's scripted first-timer (critic report §1 "Policy"):
 *   - mashes Complete Task at 4 clicks/s until the copies out-produce the hand (≥ 8 tasks/s);
 *   - buys any affordable upgrade, project or automation while keeping one power block in reserve;
 *   - prices only by watching the backlog: lower when it exceeds 30 s of production and is growing,
 *     raise after 4 consecutive checks of near-zero backlog, 8 s cool-down;
 *   - answers every modal with its first enabled option; never touches the Focus buttons;
 *   - red-teams to zero open issues, then releases;
 *   - once a big-ticket goal (an Abilene rung) is on screen, stops the GPU and marketing drip and saves.
 * `greedy` is the same player without restraint: it rents a GPU whenever one is affordable and never
 * saves. `bot`, the reasonable player, buys the same way but prices to clear production every second
 * and answers each modal with the careful option, holding it open up to 45 s while its price comes in.
 */
function stage1Step(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  const now = s.stats.timePlayed;

  const careful = mem.policy === 'bot';
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) {
    if (!careful) answerFirst(s, a);
    else if (s.activeChoice.id === 'c_leaderboard') a.resolveChoice(s, s.capability >= s.rivalCapability ? 0 : 1);
    else if (!waitForCarefulAnswer(s, mem)) answerChoice(s, a, CHOICE_POLICY);
  }

  const copyRate = potentialTasksPerSec(s);
  if (copyRate < 8) {
    mem.clickAcc += 0.4;
    while (mem.clickAcc >= 1) {
      mem.clickAcc -= 1;
      a.clickTask(s);
    }
  }

  // The first automation is bought the moment it is affordable, reserve or not.
  if (s.gpus === 0 && s.revealed['compute'] && s.funds >= gpuCost(s)) a.rentGpu(s);

  // The consumable: buy power when it is about to run out (or has), unless the grid does it.
  if (s.stage < 2 && s.revealed['buyPower'] && !s.gridAuto && s.power < Math.max(50, copyRate * 5)) a.buyPower(s);

  if (careful) {
    if (mem.variant !== 'price-never') nudgePrice(s, a, mem);
  } else if (mem.ticks % NAIVE_PRICE_EVERY === 0 && mem.variant !== 'price-never') naivePrice(s, a, mem, now);

  const run = s.training.run;
  if (run?.phase === 'redteam' && !releaseAtOnce(s, a, mem)) {
    if (canRedTeam(s)) a.redTeam(s);
    if (run.issues === 0 && canRelease(s)) a.release(s);
  }

  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  // The harness's first-timer: Train whenever it is enabled, before anything else is bought.
  const trainFirst = mem.policy === 'trainfirst';
  if (trainFirst && !s.training.run && canStartTraining(s)) a.startTraining(s);
  // The greedy variant never saves: no reserve, and GPUs first whenever one is affordable.
  const greedy = mem.policy === 'greedy';
  const reserve = greedy ? heldGoalPrice(s, mem) : Math.max(s.stage < 2 ? powerBlockCost(s) : 0, heldGoalPrice(s, mem));
  const keepsReserve = (funds: number | undefined) => !funds || s.funds - funds >= reserve;
  if (greedy && s.stage < 2 && s.revealed['compute']) {
    let guard = 0;
    while (s.funds - gpuCost(s) >= reserve && guard++ < 5 && a.rentGpu(s)) {
      /* rent whenever one is affordable */
    }
  }

  // Projects, top to bottom as they appear on screen.
  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (p.id !== 'p_beg_power' && !keepsReserve(p.cost(s).funds)) continue;
    if (p.id === TRANSITION && mem.holdTransition) continue;
    // The reasonable player breaks ground when the next run needs more GPUs than any cloud rents
    // (the price is three minutes of income for everyone now, so it is affordable sooner).
    if (p.id === TRANSITION && careful && !needsDatacenter(s)) continue;
    if (careful && patient(s, p)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  // Training is an upgrade like any other.
  if (!s.training.run && canStartTraining(s) && keepsReserve(trainCost(s).funds)) {
    variantFocus(s, a, mem);
    a.startTraining(s);
  }
  // Trust: lab space when the research on screen does not fit in the lab (the cheapest price, or
  // anything while research sits full), else researchers. The bot keeps one for an open Better Offer.
  if (s.revealed['research'] && !(careful && s.activeChoice?.id === 'c_poach')) {
    let guard = 0;
    while (s.trust >= 1 && guard++ < 10) {
      const cap = researchCap(s);
      const walled = cheapestResearchCost(s) > cap || (s.research >= cap && largestResearchCost(s) > cap);
      const ok = walled && s.revealed['expandLab'] ? a.expandLab(s) : a.hireResearcher(s);
      if (!ok) break;
    }
  }
  // The harness's goal rule: any project on screen priced at $10,000 and a minute of revenue or more
  // (and First Datacenter, its static goal). The naive player saves once First Datacenter shows;
  // the bot once the next run needs more GPUs than any cloud rents. A run short of GPUs that Rent
  // GPU can fix is fixed (Train names the fix: owner feedback U1).
  const bigTicket = trainFirst ? harnessGoal(s) || isVisible(s, TRANSITION) : greedy ? false : careful ? needsDatacenter(s) : isVisible(s, TRANSITION);
  const rentable = s.stage < 2 && s.revealed['compute'];
  if (rentable && (!bigTicket || (gpusShort(s) && !needsDatacenter(s)))) {
    let guard = 0;
    while (s.funds - gpuCost(s) >= reserve && guard++ < 5 && (!bigTicket || gpusShort(s)) && a.rentGpu(s)) {
      /* buy while affordable */
    }
  }
  if (!bigTicket && s.revealed['marketing'] && s.funds - marketingCost(s) >= reserve) a.buyMarketing(s);
}

/** The critic harness's `goalRule`: a visible project priced in funds at ≥ max($10,000, 60 s of revenue). */
function harnessGoal(s: GameState): boolean {
  const floor = Math.max(10000, 60 * s.stats.revPerSec);
  return visibleProjects(s).some((p) => (p.cost(s).funds ?? 0) >= floor);
}

/**
 * The bot's patience: a side offer waits until there is twice its price in the bank, and a research
 * card waits while the next training run has its money and more than half its research (the run
 * comes first).
 */
function patient(s: GameState, p: ProjectDef): boolean {
  if (p.pinned || p.rescue) return false;
  const c = p.cost(s);
  if (p.sideline && (c.funds ?? 0) > 0 && s.funds < 2 * (c.funds ?? 0)) return true;
  if (c.research && s.revealed['training'] && !s.training.run) {
    const cost = trainCost(s);
    const run = cost.research ?? 0;
    // Only for a run whose money is already there (else the card would wait on nothing).
    if (s.funds >= (cost.funds ?? 0) && run <= researchCap(s) && s.research >= 0.5 * run && s.research - c.research < run) return true;
  }
  return false;
}

function answerFirst(s: GameState, a: Actions): void {
  const active = s.activeChoice!;
  const def = choiceById(active.id);
  if (!def) return;
  for (let i = 0; i < def.options.length; i++) {
    if (choiceOptionEnabled(s, def, i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
}

function largestResearchCost(s: GameState): number {
  let best = s.revealed['training'] && !s.training.run ? (trainCost(s).research ?? 0) : 0;
  for (const p of visibleProjects(s)) best = Math.max(best, p.cost(s).research ?? 0);
  return best;
}

function cheapestResearchCost(s: GameState): number {
  let best = Infinity;
  if (s.revealed['training'] && !s.training.run) best = trainCost(s).research ?? Infinity;
  for (const p of visibleProjects(s)) {
    const r = p.cost(s).research;
    if (r && r < best) best = r;
  }
  return best === Infinity ? 0 : best;
}

function naivePrice(s: GameState, a: Actions, mem: BotMemory, now: number): void {
  if (!s.revealed['business']) return;
  const production = Math.max(1, s.stats.tasksPerSec);
  const backlog = s.unbilled;
  const growing = backlog > mem.prevBacklog;
  mem.prevBacklog = backlog;
  const nearZero = backlog <= Math.max(3, production * 0.5);
  mem.lowChecks = nearZero ? mem.lowChecks + 1 : 0;
  if (now - mem.lastPriceMove < NAIVE_PRICE_COOLDOWN) return;
  if (backlog > 30 * production && growing) {
    if (a.lowerPrice(s)) mem.lastPriceMove = now;
  } else if (mem.lowChecks >= 4) {
    if (a.raisePrice(s)) {
      mem.lastPriceMove = now;
      mem.lowChecks = 0;
    }
  }
}

// ---------- Stage 2 (stage2.md §9.1–§9.2) ----------

/** The reasonable bot's answers in Stage 2: the first enabled option in each list. */
const CHOICE_POLICY_S2: Record<string, number[]> = {
  c_sage2: [0],
  c_hearing: [0, 1],
  c_publishers: [0, 1],
  c_gulf: [1],
  c_evals_month: [1],
  c_defense: [0, 1],
  c_theft_warning: [0, 1],
  c_pact: [0],
  c_gamble: [0, 1],
  c_customer_email: [0],
  c_ship_issues: [1],
};

/** Capability, Efficiency, Capability, Efficiency, Safety (§9.1 step 4). */
const FOCUS_CYCLE = ['capability', 'efficiency', 'capability', 'efficiency', 'safety'] as const;


function runsS2(s: GameState): number {
  return typeof s.flags['runsS2'] === 'number' ? (s.flags['runsS2'] as number) : 0;
}

/** The publishers' licence, while the bot holds the offer open for the money (≤ 60 s of its 90). */
function publishersWait(s: GameState, mem: BotMemory): number {
  const a = s.activeChoice;
  if (!a || a.id !== 'c_publishers') return 0;
  const def = choiceById('c_publishers');
  if (!def || choiceOptionEnabled(s, def, 0)) return 0;
  const price = optionCost(s, def.options[0]!)?.funds ?? 0;
  return s.stats.timePlayed - mem.choiceSince < 60 ? price : 0;
}

/**
 * Decision variants. `best`: the answer that looks most careful (candid, licensed, domestic, the
 * month, no Pentagon, lockdown, the pledge, public, no gamble). `worst`: the one that looks most
 * reckless (lawyers, fight, Al-Marsa, not now, the Pentagon, quietly, no pledge, internal, gamble).
 * An option that cannot be paid for falls through to the next.
 */
const CHOICES_BEST: Record<string, number[]> = {
  c_sage2: [0], c_hearing: [0], c_publishers: [0, 2], c_gulf: [1], c_evals_month: [0], c_defense: [1],
  c_theft_warning: [0], c_pact: [0], c_gamble: [1], c_customer_email: [0], c_ship_issues: [1],
};
const CHOICES_WORST: Record<string, number[]> = {
  c_sage2: [1], c_hearing: [1], c_publishers: [1], c_gulf: [0, 2, 1], c_evals_month: [2], c_defense: [0],
  c_theft_warning: [2], c_pact: [1], c_gamble: [0, 1], c_customer_email: [0], c_ship_issues: [0],
};


function answerChoiceS2(s: GameState, a: Actions, mem: BotMemory): void {
  const id = s.activeChoice!.id;
  // Ignore / last: the same handling as Stage 1 (ignored events run out their timers to the default).
  if (mem.variant === 'modals-ignore' || mem.variant === 'ignore-modals' || mem.variant === 'modals-last') {
    answerVariant(s, a, mem);
    return;
  }
  if (mem.variant === 'modals-best' || mem.variant === 'modals-worst') {
    if (mem.variant === 'modals-best' && publishersWait(s, mem) > 0) return;
    answerChoice(s, a, mem.variant === 'modals-best' ? CHOICES_BEST : CHOICES_WORST);
    return;
  }
  if (id === 'c_gulf' && (mem.variant === 'gulf-sign' || mem.variant === 'gulf-domestic')) {
    // Signing waits for the money while the timer runs (the timer's default is domestic).
    if (mem.variant === 'gulf-sign') {
      if (choiceOptionEnabled(s, choiceById('c_gulf')!, 0)) a.resolveChoice(s, 0);
      return;
    }
    answerChoice(s, a, { c_gulf: [1] });
    return;
  }
  if (id === 'c_defense') {
    a.resolveChoice(s, s.approval > -15 ? 0 : 1);
    return;
  }
  // The publishers' modal: hold it (60 s of its 90) while the licence money comes in.
  if (publishersWait(s, mem) > 0) return;
  answerChoice(s, a, CHOICE_POLICY_S2);
}

/** Data in hand for the next run (or none needed). */
function dataReady(s: GameState): boolean {
  const need = trainCost(s).data ?? 0;
  return s.data + 1e-9 >= need;
}


/** Every enabled release-slot action: red-team to zero, then release (publicly). */
function redTeamAndRelease(s: GameState, a: Actions, mem?: BotMemory): void {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam') return;
  // Variant: never red-team; every model ships with what the evaluation found.
  if (mem?.variant === 'redteam-never' && s.stage === 2) {
    if (canReleasePublic(s)) a.release(s);
    return;
  }
  if (canRedTeam(s)) a.redTeam(s);
  if (run.issues === 0 && canReleasePublic(s)) a.release(s);
}

/** The Focus for the next Stage 2 run: the cycle, with the variants' Safety count. */
function focusFor(s: GameState, mem: BotMemory): (typeof FOCUS_CYCLE)[number] {
  // Variants `focus-efficiency` / `focus-safety`: every Stage 2 run trains with that Focus.
  if (mem.variant === 'focus-efficiency') return 'efficiency';
  if (mem.variant === 'focus-safety') return 'safety';
  const focus = FOCUS_CYCLE[runsS2(s) % FOCUS_CYCLE.length]!;
  if (mem.variant === 'safety-0' && focus === 'safety') return 'capability';
  if (mem.variant === 'safety-2') {
    // Two Safety runs, the third and the sixth; the cycle's own Safety turns become Capability.
    const n = runsS2(s);
    return n === 2 || n === 5 ? 'safety' : focus === 'safety' ? 'capability' : focus;
  }
  return focus;
}

/** Power per dollar: the cheapest MW on screen (gas, solar if the queue has room, nuclear). */
function cheapestPower(s: GameState): 'gas' | 'solar' | 'nuclear' | '' {
  const options: ['gas' | 'solar' | 'nuclear', number][] = [];
  if (s.revealed['gasButton']) options.push(['gas', gasCost(s) / GAS_MW]);
  if (s.revealed['solarButton'] && !solarQueueFull(s)) options.push(['solar', solarCost(s) / SOLAR_MW]);
  if (s.revealed['nuclearButton']) options.push(['nuclear', nuclearCost(s) / NUCLEAR_MW]);
  options.sort((x, y) => x[1] - y[1]);
  return options[0]?.[0] ?? '';
}

/** Power that does not wait in the interconnect queue: gas, or a reactor when it is cheaper per MW. */
function cheapestInstantPower(s: GameState): 'gas' | 'nuclear' | '' {
  const gas = s.revealed['gasButton'] ? gasCost(s) / GAS_MW : Infinity;
  const nuclear = s.revealed['nuclearButton'] ? nuclearCost(s) / NUCLEAR_MW : Infinity;
  if (gas === Infinity && nuclear === Infinity) return '';
  return nuclear < gas ? 'nuclear' : 'gas';
}

function buyPowerKind(s: GameState, a: Actions, kind: 'gas' | 'solar' | 'nuclear'): boolean {
  if (kind === 'gas') return a.buyTurbines(s);
  if (kind === 'solar') return a.buySolar(s);
  return a.buyNuclear(s);
}

function powerCostOf(s: GameState, kind: 'gas' | 'solar' | 'nuclear'): number {
  return kind === 'gas' ? gasCost(s) : kind === 'solar' ? solarCost(s) : nuclearCost(s);
}

/**
 * The reasonable bot in Stage 2 (stage2.md §9.1) under the wallet rule (arc G34): modals; Train,
 * pressed (armed when short) once the run's GPUs are there; cards that print no delay of 0:30 or more
 * for the waiting run (a named fix or a market card regardless); the build fund on the binding wall
 * (power, then room) and whole lots; the build share by what binds; Trust; the slider and toggles.
 */
export function botStepS2(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  if (s.activeChoice && readModal(s, mem)) answerChoiceS2(s, a, mem);
  redTeamAndRelease(s, a, mem);
  if (mem.ticks % 2 !== 0) return;

  const cost = trainCost(s);
  const runResearch = cost.research ?? 0;
  const rev = Math.max(1, s.stats.revPerSec);
  const buy = (p: ProjectDef) => {
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  };

  // 1. Train once the run's GPUs are there: it starts, or waits armed for its price.
  if (!s.training.armed && canPressTrain(s) && dataReady(s)) {
    a.setFocus(s, focusFor(s, mem));
    a.startTraining(s);
  }

  // 2. Cards, Stage 2's own first, a named fix first: bought unless the waiting run prints a delay of
  //    0:30 or more on them (a market card that pays back in a minute, or a named fix, regardless).
  const ordered = stage2First(visibleProjects(s));
  ordered.sort((x, y) => Number(y.urgent?.(s) === true) - Number(x.urgent?.(s) === true));
  const insightHeld = ordered
    .filter((p) => !p.stages.includes(1))
    .reduce((m, p) => Math.max(m, p.cost(s).insight ?? 0), 0);
  for (const p of ordered) {
    if (!p.canAfford(s)) continue;
    const c = p.cost(s);
    if (c.insight && p.stages.includes(1) && s.insight - c.insight < insightHeld) continue;
    if (c.trust && !trustSpare(s, c.trust, p.id)) continue;
    const named = p.urgent?.(s) === true;
    const payback = MARKET_CARDS.includes(p.id) && (c.funds ?? 0) <= 60 * rev;
    if (!named && !payback && runDelaySeconds(s, c) >= BOT_DELAY_LIMIT) continue;
    buy(p);
  }

  // 3. The build fund: the binding wall's fix (power, the cheapest MW that comes now; then room), then
  //    the largest whole lot that fits. A hall goes up early, as the last one fills.
  const wall = buildWall(s);
  const powerShort = wall === 'power' || (freePowerGpus(s) < 2000 && freePowerGpus(s) <= freeSlots(s));
  if (powerShort) {
    let kind = cheapestPower(s);
    if (kind === 'solar' && s.powerQueue.some((o) => o.kind === 'solar')) kind = cheapestInstantPower(s);
    if (kind === 'nuclear' && s.buildFund < nuclearCost(s) && s.revealed['gasButton'] && gasCost(s) <= 30 * rev) kind = 'gas';
    if (kind && s.buildFund >= powerCostOf(s, kind)) buyPowerKind(s, a, kind);
  } else if (
    s.revealed['solarButton'] && !s.powerQueue.some((o) => o.kind === 'solar') &&
    s.gpus >= 0.8 * s.powerCapacityMW * 1000 && s.buildFund >= solarCost(s) + lotCostOf(s, 1000)
  ) {
    a.buySolar(s);
  }
  if ((wall === 'room' || freeSlots(s) < 2000 || freeSlots(s) < 0.3 * gpuCapacity(s)) && s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) {
    a.buildDatacenter(s);
  }
  if (!standingOrderOn(s)) {
    let guard = 0;
    while (guard++ < 4) {
      const size = [25000, 5000, 1000].find((n) => lotFits(s, n) && s.buildFund >= lotCostOf(s, n));
      if (!size || !a.buyGpuBatch(s, size)) break;
    }
  }
  if (isBought(s, 'p_standing_order') && !s.standingOrder) a.toggleStanding(s);

  // 4. The build share by what binds: 75 % while the run waits for GPUs, 25 % while it waits only
  //    for money with GPUs to spare, 50 % otherwise (a variant pins it).
  const pinned = /^share-(\d+)$/.exec(mem.variant);
  const fleetReady = gpusAvailable(s) >= 1.5 * gpusNeeded(s);
  const want = pinned ? Number(pinned[1]) / 100
    : gpusShort(s) ? 0.75
      : fleetReady && s.research >= 0.8 * runResearch && s.funds < (cost.funds ?? 0) ? 0.25
        : 0.5;
  let turns = 0;
  while (Math.abs(s.buildShare - want) > 1e-9 && turns++ < 3) a.cycleBuildShare(s);

  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s)) && runDelaySeconds(s, sl3Cost(s)) < BOT_DELAY_LIMIT) a.buySL3(s);

  // 5. The slider, the toggles, alignment compute.
  if (s.revealed['allocation']) {
    const fixed = /^slider-(\d+)$/.exec(mem.variant);
    const want = fixed ? Number(fixed[1]) : s.research >= researchCap(s) - 1 ? 10 : 20;
    if (Math.round(s.researchAlloc * 100) !== want) a.setResearchAlloc(s, want);
  }
  if (s.revealed['jobFund'] && !s.jobFund && s.approval <= -10) a.toggleJobFund(s);
  if (s.revealed['shareEvals'] && !s.shareEvals) a.toggleShareEvals(s);
  if (s.revealed['alignShare'] && s.alignShare < 0.05 - 1e-9) a.cycleAlignShare(s);
}

/** The bot declines a purchase that prints this much delay or more for the waiting run (arc G34). */
const BOT_DELAY_LIMIT = 30;



/** Stage 2 cards that widen the market (a reasonable player buys them as soon as they pay back fast). */
const MARKET_CARDS = ['p_agent_platform', 'p_international', 'p_free_tier'];

/** Stage 2 projects in table order, then the carried Stage 1 ones. */
function stage2First(list: ProjectDef[]): ProjectDef[] {
  return [...list.filter((p) => !p.stages.includes(1)), ...list.filter((p) => p.stages.includes(1))];
}

/** Trust the bot may spend: it holds 3 for SL3 and 2 for the Policy team while either is on screen. */
function trustSpare(s: GameState, amount: number, forId = ''): boolean {
  let hold = 0;
  if (s.revealed['sl3Button'] && s.securityLevel < 3) hold += 3;
  if (forId !== 'p_policy' && visibleProjects(s).some((p) => p.id === 'p_policy') && !isBought(s, 'p_policy')) hold += 2;
  return s.trust - amount >= hold;
}

/**
 * The critic's first-timer in Stage 2 (stage2.md §9.2): every affordable project in screen order,
 * every enabled Infrastructure button top to bottom, Train whenever it is enabled (focus as it was),
 * red-team to zero and release, the first enabled modal option, Marketing when affordable, Hire and
 * Expand alternately; never the slider or a toggle. `greedy` presses the infrastructure first and
 * as often as it can.
 */
/**
 * The harness first-timer in Stage 2 (tools/critic/games/takeoff-late.mjs): Train first; red-team to
 * zero and release; infrastructure from the GPU lot row's reason (a lot when it is enabled, the
 * cheapest MW at "no power", a datacenter at "no room"), up to three a check; then every other
 * enabled purchase once (cards, Trust, the bigger lots, a short run, Security level 3).
 */
export function trainfirstStepS2(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) answerFirst(s, a);
  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
  redTeamAndRelease(s, a, mem);
  const presses = mem.policy === 'greedy' ? 15 : 3;
  for (let i = 0; i < presses; i++) {
    const reason = lotReason(s);
    let done = false;
    if (!reason && lotSize(s) > 0 && s.buildFund >= lotCost(s)) done = a.buyGpuBatch(s);
    else if (reason === 'no power') {
      const kinds = (['gas', 'solar', 'nuclear'] as const).filter((k) => plantEnabled(s, k));
      const best = kinds.sort((x, y) => powerCostOf(s, x) / mwOf(x) - powerCostOf(s, y) / mwOf(y))[0];
      if (best) done = buyPowerKind(s, a, best);
    } else if (reason === 'no room' && s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) done = a.buildDatacenter(s);
    if (!done) break;
  }
  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (s.trust >= 1 && s.revealed['hireResearcher']) a.hireResearcher(s);
  if (s.trust >= 1 && s.revealed['expandLab']) a.expandLab(s);
  sweepExtras(s, a);
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) a.buySL3(s);
}

/** What the harness's sweep also presses in Stage 2 when it is enabled: the bigger lots. */
function sweepExtras(s: GameState, a: Actions): void {
  if (s.revealed['lot5']) a.buyGpuBatch(s, 5000);
  if (s.revealed['lot25']) a.buyGpuBatch(s, 25000);
}

function plantEnabled(s: GameState, kind: 'gas' | 'solar' | 'nuclear'): boolean {
  const shown = kind === 'gas' ? s.revealed['gasButton'] : kind === 'solar' ? s.revealed['solarButton'] : s.revealed['nuclearButton'];
  return shown === true && !plantReason(s, kind) && s.buildFund >= powerCostOf(s, kind);
}

function mwOf(kind: 'gas' | 'solar' | 'nuclear'): number {
  return kind === 'gas' ? GAS_MW : kind === 'solar' ? SOLAR_MW : NUCLEAR_MW;
}

export function naiveStepS2(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending) return;
  if (s.activeChoice && readModal(s, mem) && !answerVariant(s, a, mem)) answerFirst(s, a);
  redTeamAndRelease(s, a, mem);
  if (mem.ticks % NAIVE_BUY_EVERY !== 0) return;
  const greedy = mem.policy === 'greedy';

  const infra = () => {
    const presses = greedy ? 5 : 1;
    for (let i = 0; i < presses; i++) {
      let any = false;
      if (s.revealed['infrastructure'] && lotSize(s) > 0 && s.buildFund >= lotCost(s)) any = a.buyGpuBatch(s) || any;
      if (s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) any = a.buildDatacenter(s) || any;
      if (s.revealed['gasButton'] && s.buildFund >= gasCost(s)) any = a.buyTurbines(s) || any;
      if (s.revealed['solarButton'] && s.buildFund >= solarCost(s)) any = a.buySolar(s) || any;
      if (s.revealed['nuclearButton'] && s.buildFund >= nuclearCost(s)) any = a.buyNuclear(s) || any;
      if (!any) break;
    }
  };

  for (const p of visibleProjects(s)) {
    if (!p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  if (greedy) infra();
  if (canPressTrain(s) && !s.training.armed) a.startTraining(s);
  let guard = 0;
  while (s.trust >= 1 && guard++ < 10) {
    const pick = s.revealed['expandLab'] ? mem.hireNext : 'researcher';
    const ok = pick === 'lab' ? a.expandLab(s) : a.hireResearcher(s);
    if (!ok) break;
    mem.hireNext = pick === 'lab' ? 'researcher' : 'lab';
  }
  if (!greedy) infra();
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) a.buySL3(s);
  if (s.revealed['marketing'] && s.funds >= marketingCost(s)) a.buyMarketing(s);
}

/** For the sim's summary: does the next run have the GPUs it needs? */
export function computeGateOpen(s: GameState): boolean {
  return !gpusShort(s);
}

/** The run in the release slot, for the sim (re-exported so the runner needs one import). */
export function releaseSlot(s: GameState) {
  return evalRun(s);
}

/** Room for the next lot as the bot sees it (sim diagnostics). */
export function roomLeft(s: GameState): number {
  return gpuCapacity(s) - s.gpus;
}

/** Used by the dev overlay's Autoplay too; `canRelease` ignores the outside-evaluation wait. */
export function releasable(s: GameState): boolean {
  return canRelease(s);
}
