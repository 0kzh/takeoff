/**
 * Headless simulator: `npm run sim -- --minutes 45 --seed 1 [--policy bot|naive|greedy] [--preset N]
 * [--stop-at-stage N] [--quiet] [--json]`. Plays the engine through `actions` at 100 ms steps with
 * no DOM, prints a timeline and one summary block per stage played (Stage 1, Stage 2).
 */
import { newGame, GameState, isBought } from '../engine/state.js';
import { step, actions } from '../engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from './policy.js';
import { noveltyKeys, isRescueKey, PLAYER_MODALS, enabledPurchases } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import {
  researchCap, copies, copiesIdle, researchRate, humanShare, bestCapability, marketingCost, contractRate,
} from '../engine/economy.js';
import { gpuCapacity, lotSize, lotCost, datacenterCost, gasCost, solarCost, nuclearCost, solarQueueFull } from '../engine/infrastructure.js';
import { trainCost, canStartTraining, trainingCompute, requiredCompute } from '../engine/training.js';
import { fmtInt, fmtMoney, fmtClock, dateLabel, fmtNum } from '../engine/format.js';
import { PRESETS } from '../data/presets.js';
import { MECHANIC_FLAGS } from '../data/stage2.js';

/** The only Node global the sim needs; avoids a dependency on @types/node. */
declare const process: { argv: string[]; exitCode?: number };

interface Args {
  minutes: number;
  seed: number;
  quiet: boolean;
  json: boolean;
  policy: PolicyName;
  stopAtStage: number;
  preset: number;
  variant: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { minutes: 60, seed: 1, quiet: false, json: false, policy: 'bot', stopAtStage: 0, preset: 1, variant: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--minutes' && v) args.minutes = Number(v);
    if (k === '--seed' && v) args.seed = Number(v);
    if (k === '--stop-at-stage' && v) args.stopAtStage = Number(v);
    if (k === '--preset' && v) args.preset = Number(v);
    if (k === '--variant' && v) args.variant = v;
    if (k === '--policy' && (v === 'bot' || v === 'naive' || v === 'greedy' || v === 'trainfirst')) args.policy = v;
    if (k === '--quiet') args.quiet = true;
    if (k === '--json') args.json = true;
  }
  return args;
}

/** Rescue content does not count as a reveal: it is the game noticing a stall, not new content. */
const RESCUE_PROJECTS = ['p_beg_power', 'p_press', 'p_beg_data'];
const RESCUE_CHOICES = ['c_customer_email'];

/** Stage 2 panels and mechanics (A4): a new panel, verb, toggle, slider or Stores row. */
const S2_MECHANICS = MECHANIC_FLAGS;

/** Verbs whose automation makes pressing them a chore (A12): verb → when its automation exists. */
const AUTOMATED: Record<string, (s: GameState) => boolean> = {
  gpuLot: (s) => (s.projects['p_standing_order']?.bought ?? 0) > 0,
  price: (s) => s.stage >= 2,
};

export interface Summary {
  seed: number;
  policy: PolicyName;
  /** Seconds at which Stage 2 began, or null when it did not within the run. */
  transition: number | null;
  firstGpu: number | null;
  /** Longest gap between first-time reveals from 0:00 to the transition (or the end of the run). */
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  revealGapsOver120: [number, number][];
  longestNoveltyGap: number;
  longestNoveltyGapAt: [number, number];
  powerPresses: number;
  /** Most Buy Power presses in any 5-minute window of Stage 1. */
  worstPressWindow: number;
  capabilityAtTransition: number | null;
  /** Idle rescues in Stage 1. */
  idleRescues: number;
  rescuesAtZeroTasks: number;
  /** Stretches in Stage 1 where nothing was produced, or the copies sat without power, for 60 s+. */
  softLocks: [number, number][];
  reveals: number;
  /** When each Abilene rung was bought (site, interconnect, substation, break ground). */
  ladder: (number | null)[];
  /** Training runs started in Stage 1, and the smallest share of its gain any of them kept. */
  runs: number;
  minYield: number | null;
  /** Modals opened in Stage 1 (every opening, gambles and rescues included). */
  modals: number;
  /** Smallest gap between two modals that opened on their own (player-caused confirms excluded). */
  minModalSpacing: number | null;
  research: number | null;
  projects: number | null;
  grid: number | null;
  /** Reveal → purchase per Stage 1 project bought (critic round 2 §6.2). */
  latencyMedian: number | null;
  latencyWithin10Pct: number;
  latencies: [string, number][];
  /** Most first-time reveals in any six minutes of Stage 1 (critic round 2 §6.1: ≤ 16). */
  maxReveals6min: number;
  maxReveals6minAt: number;
  /** The state on the last Stage 1 tick (the decision variants' exit state). */
  exitState1: ExitState1 | null;
  /** Stage 1 modal answers, `id:option`. */
  choices1: string[];
  /** Stage 2 block (null when the run never reached Stage 2). */
  s2: Stage2Summary | null;
}

export interface ExitState1 {
  capability: number;
  alignTrue: number;
  alignApparent: number;
  trust: number;
  researchers: number;
  labSpace: number;
  hypeLevel: number;
  contracts: number;
  contractRate: number;
  revPerSec: number;
  price: number;
  gpus: number;
  incidents: number;
  gov: number;
  lead: number;
}

export interface Mark {
  t: number;
  gpus: number;
  mw: number;
  dcs: number;
  tasksPerSec: number;
  revenue: number;
  price: number;
  capability: number;
  researchPerSec: number;
  humanShare: number;
  jobs: number;
}

export interface Stage2Summary {
  start: number;
  /** Seconds in Stage 2 until `Let Sage-3 write the code` (null: not reached). */
  duration: number | null;
  exitHow: string;
  capabilityAtExit: number;
  runs: number;
  trainStarts: number[];
  intervalMean: number | null;
  intervalMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  minYield: number | null;
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  revealGapsOver120: [number, number][];
  /** Longest reveal gap inside the last 10 minutes of the stage. */
  lastTenGap: number;
  lastTenGapAt: [number, number];
  /** Longest gap between new panels or mechanics. */
  mechanicGap: number;
  mechanicGapAt: [number, number];
  reveals: number;
  greyedGoalPct: number;
  gpuPressesBeforeStanding: number;
  gpuPresses: number;
  powerPurchases: number;
  datacenters: number;
  /** Most presses of an automated verb in any 60 s after its automation exists. */
  choreWorst: { verb: string; presses: number } | null;
  idleRescues: number;
  governor: string[];
  modals: number;
  modalIds: string[];
  minModalSpacing: number | null;
  maxVisible: number;
  maxVisibleCapped: number;
  maxQueueWait: number;
  maxQueueId: string;
  firstPower: number | null;
  firstDatacenter: number | null;
  assistantsBought: number | null;
  standingOrderAt: number | null;
  marks: Mark[];
  revenueBefore: number | null;
  revenueAfter30: number | null;
  firstChoice: number | null;
  exitShownBefore: number | null;
  logEntries: number;
  longestLogGap: number;
  pressCounts: Record<string, number>;
  incidents: number;
  mechanics: string[];
  /** Seconds of each blocker inside the longest interval between training starts. */
  longestIntervalBlockers: string;
  /** Reveal → purchase, per Stage 2 project bought (critic round 2: goals, not a conveyor belt). */
  latencyMedian: number | null;
  latencyWithin10Pct: number;
  latencies: [string, number][];
  /** The state on the last Stage 2 tick, before Stage 3's clamps (critic round 2 §5 variants). */
  exitState: ExitState | null;
  /** Stage 2 modal answers, `id:option`. */
  choices: string[];
  /** Hands and eyes (arc G24–G26): 2-s checks after minute 3 with nothing enabled / two or more things. */
  handsNonePct: number;
  handsTwoPct: number;
  /** Share of the time after minute 10 inside stretches of 30 s or more without a player action. */
  clickGapPct: number;
  /** Longest stretch between two changes of the deployed model's capability (the stage end closes the last). */
  longestRelease: number;
  longestReleaseAt: number;
}

export interface ExitState {
  capability: number;
  alignTrue: number;
  alignApparent: number;
  gov: number;
  approval: number;
  lead: number;
  funds: number;
  securityLevel: number;
  data: number;
  incidents: number;
}

export interface SimResult {
  state: GameState;
  milestones: Record<string, number>;
  idleGaps: [number, number][];
  lines: string[];
  summary: Summary;
}

/** Share (%) of [from, to] inside gaps of 30 s or more between consecutive actions (the edges count). */
function clickGapShare(times: number[], from: number, to: number): number {
  if (to <= from) return 0;
  const pts = [from, ...times.filter((x) => x > from && x < to).sort((a, b) => a - b), to];
  let inGap = 0;
  for (let k = 1; k < pts.length; k++) {
    const g = pts[k]! - pts[k - 1]!;
    if (g >= 30) inGap += g;
  }
  return Math.round((100 * inGap) / (to - from));
}

function median(xs: number[]): number {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : Math.round((v[m - 1]! + v[m]!) / 2);
}

function longestGap(times: number[], start: number, end: number): { gap: number; at: [number, number]; over: [number, number][] } {
  const sorted = [...times].filter((t) => t >= start && t <= end).sort((x, y) => x - y);
  let gap = 0;
  let at: [number, number] = [start, start];
  const over: [number, number][] = [];
  let prev = start;
  for (const t of [...sorted, end]) {
    const g = t - prev;
    if (g > gap) {
      gap = g;
      at = [prev, t];
    }
    if (g > 120) over.push([prev, t]);
    prev = t;
  }
  return { gap, at, over };
}

/** Anything on screen the player cannot buy yet, or a `+1 Trust at` / `Next:` line (arc G3). */
function greyedGoal(s: GameState): boolean {
  if (s.revealed['research'] && s.stage < 3) return true;
  if (s.revealed['graph']) return true;
  if (visibleProjects(s).some((p) => !p.canAfford(s))) return true;
  if (s.revealed['infrastructure']) {
    if (lotSize(s) >= 100 && s.funds < lotCost(s)) return true;
    if (s.revealed['dcButton'] && s.funds < datacenterCost(s)) return true;
    if (s.revealed['gasButton'] && s.funds < gasCost(s)) return true;
  }
  return s.revealed['marketing'] === true && s.funds < marketingCost(s);
}

/** ≥ 2 affordable purchases competing for the same money, or a modal (arc G10). */
function meaningfulChoice(s: GameState): boolean {
  if (s.activeChoice) return true;
  const prices: number[] = [];
  for (const p of visibleProjects(s)) {
    const f = p.cost(s).funds ?? 0;
    if (f > 0 && p.canAfford(s)) prices.push(f);
  }
  if (s.revealed['infrastructure'] && lotSize(s) >= 100 && s.funds >= lotCost(s)) prices.push(lotCost(s));
  if (s.revealed['dcButton'] && s.funds >= datacenterCost(s)) prices.push(datacenterCost(s));
  if (s.revealed['gasButton'] && s.funds >= gasCost(s)) prices.push(gasCost(s));
  if (s.revealed['solarButton'] && !solarQueueFull(s) && s.funds >= solarCost(s)) prices.push(solarCost(s));
  if (s.revealed['nuclearButton'] && s.funds >= nuclearCost(s)) prices.push(nuclearCost(s));
  if (canStartTraining(s)) prices.push(trainCost(s).funds ?? 0);
  if (s.revealed['marketing'] && s.funds >= marketingCost(s)) prices.push(marketingCost(s));
  if (prices.length < 2) return false;
  return prices.reduce((x, y) => x + y, 0) > s.funds;
}

/** What keeps the next run from starting right now ('' never: 'ready' when nothing does). */
function runBlocker(s: GameState): string {
  const t = s.training;
  if (t.pending || (t.run && t.run.phase === 'training')) return 'training';
  if (t.run && !isBought(s, 'p_parallel')) return 'release slot';
  if (t.cooldown > 0) return 'cooldown';
  const c = trainCost(s);
  if ((c.research ?? 0) > researchCap(s)) return 'research cap';
  if ((c.research ?? 0) > s.research) return 'research';
  if ((c.data ?? 0) > s.data + 1e-9) return 'data';
  if ((c.funds ?? 0) > s.funds) return 'funds';
  if (trainingCompute(s) / Math.max(1, requiredCompute(s)) < 0.72) return 'compute';
  return 'ready';
}

function markOf(s: GameState, t: number): Mark {
  return {
    t,
    gpus: s.gpus,
    mw: s.powerCapacityMW,
    dcs: s.datacenters,
    tasksPerSec: Math.round(s.stats.tasksPerSec),
    revenue: Math.round(s.stats.revPerSec),
    price: Math.round(s.price * 10000) / 10000,
    capability: Math.round(bestCapability(s) * 100) / 100,
    researchPerSec: Math.round(researchRate(s)),
    humanShare: Math.round(humanShare(s) * 1000) / 10,
    jobs: Math.round(s.jobsDisplaced * 100) / 100,
  };
}

export function simulate(args: Args): SimResult {
  const preset = PRESETS[Math.max(1, args.preset) - 1];
  const s = args.preset > 1 && preset ? preset.build(args.seed) : newGame(args.seed);
  const mem = newBotMemory(args.policy, false, args.variant);
  const lines: string[] = [];
  const milestones: Record<string, number> = {};
  const idleGaps: [number, number][] = [];
  const t0 = s.stats.timePlayed;
  const out = (t: number, text: string) => lines.push(`${fmtClock(t - t0)}  ${text}`);
  const mark = (key: string, t: number) => {
    if (milestones[key] === undefined) milestones[key] = t;
  };

  const seenFlags = new Set<string>();
  const seenProjects = new Set<string>();
  const seenChoices = new Set<string>();
  const revealTimes: number[] = [];
  const noveltyTimes: number[] = [];
  const pressTimes: number[] = [];
  const softLocks: [number, number][] = [];
  let rescuesAtZero = 0;
  let stage1Rescues = 0;
  let prevChoice: unknown = null;
  const countedChoices = new WeakSet<object>();
  let modals = 0;
  const autoModalTimes: number[] = [];
  let runs = 0;
  let minYield: number | null = null;
  let prevRunIds = new Set<number>();
  let transition: number | null = null;
  let capAtTransition: number | null = null;

  // Stage 1 bookkeeping: reveal → purchase, the exit state, the modal answers.
  const s1ShownAt = new Map<string, number>();
  const s1BoughtSeen = new Set<string>();
  const s1Latency: [string, number][] = [];
  let s1Snap: ExitState1 | null = null;
  const s1Choices: string[] = [];

  // Stage 2 bookkeeping.
  let s2Start: number | null = s.stage === 2 ? t0 : null;
  let s2End: number | null = null;
  let s2Exit = '';
  let s2Cap = 0;
  const s2Reveals: number[] = [];
  const s2ShownAt = new Map<string, number>();
  const s2BoughtSeen = new Set<string>();
  const s2Latency: [string, number][] = [];
  let exitSnap: ExitState | null = null;
  const s2Choices: string[] = [];
  const s2Mechanics: number[] = [];
  const s2MechNames: [number, string][] = [];
  const s2TrainStarts: number[] = [];
  const s2Durations: number[] = [];
  const s2Yields: number[] = [];
  let s2Modals = 0;
  const s2ModalIds: string[] = [];
  const s2AutoModals: number[] = [];
  let s2Rescues = 0;
  let s2GreyTicks = 0;
  let s2Ticks = 0;
  let maxVisible = 0;
  let maxVisibleCapped = 0;
  const queueSince = new Map<string, number>();
  let maxQueueWait = 0;
  let maxQueueId = '';
  const pressLog: Record<string, number[]> = {};
  let prevPresses: Record<string, number> = { ...s.stats.pressCounts };
  const pressesAtStart: Record<string, number> = { ...s.stats.pressCounts };
  let gpuPressesBeforeStanding = 0;
  let standingAt: number | null = null;
  const marks: Mark[] = [];
  let nextMark = 0;
  // Hands and eyes: the player's actions (all but the task button), and the 2-s purchase checks.
  const actionTimes: number[] = [];
  let handsChecks = 0;
  let handsNone = 0;
  let handsTwo = 0;
  let lastCap = s.capability;
  let lastCapAt = s.stats.timePlayed;
  let longestRelease = 0;
  let longestReleaseAt = 0;
  const tracked = new Proxy(actions, {
    get(target, prop: string) {
      const fn = (target as unknown as Record<string, (...args: unknown[]) => unknown>)[prop];
      if (typeof fn !== 'function') return fn;
      return (...args: unknown[]) => {
        const r = fn(...args);
        if (r && prop !== 'clickTask') actionTimes.push(s.stats.timePlayed);
        return r;
      };
    },
  }) as typeof actions;
  /** Per second in Stage 2: what kept the next run from starting (for the longest interval). */
  const blockLog: [number, string][] = [];
  const revHistory: [number, number][] = [];
  let revenueBefore: number | null = null;
  let revenueAfter30: number | null = null;
  let firstChoice: number | null = null;
  let exitShownAt: number | null = null;
  let s2LogStart = 0;
  const logTimes: number[] = [];
  let incidentsAtStart = 0;
  let govSeen = s.cadence.governed.length;
  let releasesSeen = s.stats.releases;

  let prevKeys = new Set<string>();
  let lastNovelty = t0;
  let prevPhase = '';
  let prevStage = s.stage;
  let prevLog = s.log.length;
  let prevChoices = s.stats.choices;
  let prevRescues = s.stats.idleRescues;
  let prevPowerPresses = s.stats.powerPresses;
  let prevShown = new Set<string>(visibleProjects(s).map((p) => p.id));
  let stallFrom = -1;
  let lastTasks = 0;
  let lastTaskGain = 0;
  const totalTicks = Math.round(args.minutes * 600);

  const reveal = (t: number, text: string) => {
    out(t, text);
    revealTimes.push(t);
    noveltyTimes.push(t);
    if (s.stage === 2) s2Reveals.push(t);
  };
  for (const [id, on] of Object.entries(s.revealed)) {
    if (on) {
      seenFlags.add(id);
      revealTimes.push(t0);
      if (s.stage === 2) {
        s2Reveals.push(t0);
        if (S2_MECHANICS.includes(id)) s2Mechanics.push(t0);
      }
    }
  }
  // Projects seen before the run starts (a preset) are carried over, not new.
  for (const [id, st] of Object.entries(s.projects)) if (st.shown || st.bought) seenProjects.add(id);
  if (s.stage === 2) {
    s2LogStart = s.log.length;
    incidentsAtStart = s.stats.incidents;
    revenueBefore = s.stats.revPerSec;
  }

  const beginStage2 = (t: number) => {
    s2Start = t;
    // Release intervals count from the arrival, not from the start of the game.
    lastCap = s.capability;
    lastCapAt = t;
    s2LogStart = s.log.length;
    incidentsAtStart = s.stats.incidents;
    prevPresses = { ...s.stats.pressCounts };
    Object.assign(pressesAtStart, s.stats.pressCounts);
    const before = revHistory.filter(([tt]) => tt <= t - 10).pop();
    revenueBefore = before ? before[1] : null;
    govSeen = s.cadence.governed.length;
  };

  for (let i = 0; i < totalTicks; i++) {
    if (s.stage === 2 && i % 20 === 0 && s2Start !== null && s.stats.timePlayed - s2Start >= 180) {
      const n = enabledPurchases(s).length;
      handsChecks++;
      if (n === 0) handsNone++;
      if (n >= 2) handsTwo++;
    }
    policyStep(s, tracked, mem);
    step(s);
    const t = s.stats.timePlayed;
    if (s.stage === 2 && s2Start !== null && s.capability > lastCap + 1e-9) {
      if (t - lastCapAt > longestRelease) {
        longestRelease = t - lastCapAt;
        longestReleaseAt = lastCapAt;
      }
      lastCap = s.capability;
      lastCapAt = t;
    }

    for (const id of mem.bought) {
      out(t, `BUY ${projectById(id)?.title ?? id}`);
      mark(`buy:${id}`, t);
      noveltyTimes.push(t);
      if (id === 'p_standing_order' && standingAt === null) standingAt = t;
      if (id === 'p_ai_assistants') mark('s2:assistants', t);

    }
    // Purchases the policy made through the engine's verbs (and their count), for the press log.
    for (const [verb, n] of Object.entries(s.stats.pressCounts)) {
      const before = prevPresses[verb] ?? 0;
      for (let k = before; k < n; k++) {
        (pressLog[verb] ??= []).push(t);
        if (verb !== 'slider' && verb !== 'price') out(t, `PRESS ${verb}`);
        if (verb === 'gpuLot' && standingAt === null && s.stage === 2) gpuPressesBeforeStanding++;
        if ((verb === 'gas' || verb === 'solar' || verb === 'nuclear') && s.stage === 2) mark('s2:firstPower', t);
        if (verb === 'datacenter' && s.stage === 2) mark('s2:firstDatacenter', t);

      }
    }
    prevPresses = { ...s.stats.pressCounts };

    for (const [id, on] of Object.entries(s.revealed)) {
      if (on && !seenFlags.has(id)) {
        seenFlags.add(id);
        reveal(t, `REVEAL ${id}`);
        mark(`reveal:${id}`, t);
        if (s.stage === 2 && S2_MECHANICS.includes(id)) {
          s2Mechanics.push(t);
          s2MechNames.push([t, id]);
        }
      }
    }
    const visible = visibleProjects(s);
    for (const p of visible) {
      if (!prevShown.has(p.id)) {
        out(t, `PROJECT shown: ${p.title}`);
        mark(`shown:${p.id}`, t);
        if (p.id === 'p_superhuman_coder' && exitShownAt === null) exitShownAt = t;
        if (!seenProjects.has(p.id) && !RESCUE_PROJECTS.includes(p.id)) {
          seenProjects.add(p.id);
          revealTimes.push(t);
          noveltyTimes.push(t);
          // Carried Stage 1 projects first shown in Stage 2 are not Stage 2 content.
          if (s.stage === 2 && !p.stages.includes(1)) s2Reveals.push(t);
        }
      }
    }
    prevShown = new Set(visible.map((p) => p.id));
    if (s.activeChoice && s.activeChoice !== prevChoice && !countedChoices.has(s.activeChoice)) {
      // A modal pushed back by a player's own (Sage-2) modal reopens as the same entry: count it once.
      countedChoices.add(s.activeChoice);
      if (s.stage === 1) {
        modals++;
        if (!PLAYER_MODALS.includes(s.activeChoice.id)) autoModalTimes.push(t);
      } else if (s.stage === 2) {
        s2Modals++;
        s2ModalIds.push(s.activeChoice.id);
        if (!PLAYER_MODALS.includes(s.activeChoice.id) && !RESCUE_CHOICES.includes(s.activeChoice.id)) s2AutoModals.push(t);
      }
    }
    prevChoice = s.activeChoice;
    // Training runs (either pipeline slot).
    for (const r of [s.training.run, s.training.pending]) {
      if (!r || prevRunIds.has(r.id)) continue;
      prevRunIds.add(r.id);
      if (s.stage === 1) {
        runs++;
        minYield = minYield === null ? r.computeYield : Math.min(minYield, r.computeYield);
      } else if (s.stage === 2) {
        s2TrainStarts.push(t);
        s2Durations.push(r.duration);
        s2Yields.push(r.computeYield);
      }
    }
    if (prevRunIds.size > 50) prevRunIds = new Set([...prevRunIds].slice(-10));
    const choice = s.activeChoice?.id;
    if (choice && !seenChoices.has(choice)) {
      seenChoices.add(choice);
      if (!RESCUE_CHOICES.includes(choice)) reveal(t, `MODAL ${choice}`);
      else out(t, `MODAL ${choice}`);
    }
    if (s.gpus >= 1) mark('firstGpu', t);
    if (s.stats.powerPresses > prevPowerPresses) {
      for (let k = prevPowerPresses; k < s.stats.powerPresses; k++) pressTimes.push(t);
      prevPowerPresses = s.stats.powerPresses;
    }

    const run = s.training.pending ?? s.training.run;
    const phase = [s.training.run, s.training.pending].map((r) => (r ? `${r.name}:${r.phase}` : '')).join('|');
    if (phase !== prevPhase) {
      for (const r of [s.training.run, s.training.pending]) {
        if (!r || prevPhase.includes(`${r.name}:${r.phase}`)) continue;
        const extra = r.phase === 'training' ? ` (${r.focus}, ${r.duration}s, yield ${r.computeYield.toFixed(2)})`
          : r.phase === 'redteam' ? ` (cap ${r.capAfter.toFixed(2)}, score ${r.scores.reduce((x, y) => x + y, 0)}/40, issues ${r.issuesFound})` : '';
        out(t, `TRAIN ${r.name} → ${r.phase}${extra}`);
        if (r.phase === 'training') mark('firstTrainingStart', t);
      }
      if (s.stats.releases > releasesSeen) {
        const m = s.training.models[s.training.models.length - 1]!;
        out(t, `RELEASE ${m.name} (${m.public ? 'public' : 'internal'}, capability ${m.capability.toFixed(2)})`);
        mark('firstRelease', t);
        releasesSeen = s.stats.releases;
      }
      noveltyTimes.push(t);
      prevPhase = phase;
    }
    void run;
    if (s.stage !== prevStage) {
      out(t, `STAGE ${prevStage} → ${s.stage} (${dateLabel(s.date)})`);
      mark(`stage${s.stage}`, t);
      if (s.stage === 2) {
        transition = t;
        capAtTransition = s.capability;
        beginStage2(t);
        for (const [id, on] of Object.entries(s.revealed)) if (on && S2_MECHANICS.includes(id)) s2Mechanics.push(t);
        s2Reveals.push(t);
      }
      if (s.stage === 3 && s2Start !== null) {
        s2End = t;
        s2Exit = s.flags['exitReadySince'] === undefined ? 'bought' : 'bought';
        s2Cap = bestCapability(s);
      }
      prevStage = s.stage;
      if (args.stopAtStage && s.stage >= args.stopAtStage) break;
    }
    while (prevLog < s.log.length) {
      const e = s.log[prevLog++]!;
      out(t, `LOG ${e.date} — ${e.text}`);
      if (s.stage === 2) logTimes.push(t);
    }
    if (s.log.length < prevLog) prevLog = s.log.length;
    if (s.stats.choices > prevChoices) {
      const c = s.choicesMade[s.choicesMade.length - 1]!;
      if (s.stage === 2) s2Choices.push(`${c.id}:${c.option}`);
      if (s.stage === 1) s1Choices.push(`${c.id}:${c.option}`);
      out(t, `CHOICE ${c.id} → ${c.option}`);
      prevChoices = s.stats.choices;
    }
    if (s.stats.idleRescues > prevRescues) {
      out(t, `IDLE RESCUE #${s.stats.idleRescues} (tasks ${fmtInt(s.tasks)})`);
      if (s.tasks <= 0) rescuesAtZero++;
      if (s.stage === 1) stage1Rescues++;
      if (s.stage === 2) s2Rescues++;
      prevRescues = s.stats.idleRescues;
    }
    while (govSeen < s.cadence.governed.length) {
      const g = s.cadence.governed[govSeen++]!;
      out(t, `GOVERNOR ${g.split(':').slice(1).join(':')}`);
    }

    // Soft-lock watch (Stage 1, after the first GPU): no tasks for 60 s, or idle copies for 60 s.
    if (s.stage === 1 && s.gpus > 0) {
      if (s.tasks > lastTasks) lastTaskGain = t;
      lastTasks = s.tasks;
      const stalled = t - lastTaskGain >= 1 || copiesIdle(s);
      if (stalled && stallFrom < 0) stallFrom = t;
      if (!stalled && stallFrom >= 0) {
        if (t - stallFrom >= 60) softLocks.push([stallFrom, t]);
        stallFrom = -1;
      }
    }

    if (s.stage === 1) {
      for (const p of visible) if (!s1ShownAt.has(p.id)) s1ShownAt.set(p.id, t);
      for (const [id, at] of s1ShownAt) {
        if (s1BoughtSeen.has(id) || !s.projects[id]?.bought) continue;
        s1BoughtSeen.add(id);
        const def = projectById(id);
        if (def && !def.rescue) s1Latency.push([id, Math.round(t - at)]);
      }
      if (i % 10 === 0) {
        s1Snap = {
          capability: Math.round(s.capability * 1000) / 1000,
          alignTrue: Math.round(s.alignmentTrue * 10) / 10,
          alignApparent: Math.round(s.alignmentApparent * 10) / 10,
          trust: s.trust,
          researchers: s.researchers,
          labSpace: s.labSpace,
          hypeLevel: s.hypeLevel,
          contracts: s.projects['p_contract']?.bought ?? 0,
          contractRate: Math.round(contractRate(s)),
          revPerSec: Math.round(s.stats.revPerSec),
          price: Math.round(s.price * 100) / 100,
          gpus: s.gpus,
          incidents: s.stats.incidents,
          gov: Math.round(s.govRelations),
          lead: Math.round(s.lead * 100) / 100,
        };
      }
    }
    if (s.stage === 2) {
      for (const p of visible) if (!s2ShownAt.has(p.id)) s2ShownAt.set(p.id, t);
      for (const [id, at] of s2ShownAt) {
        if (s2BoughtSeen.has(id) || !s.projects[id]?.bought) continue;
        s2BoughtSeen.add(id);
        const def = projectById(id);
        if (def && !def.rescue && !def.stages.includes(1)) s2Latency.push([id, Math.round(t - at)]);
      }
      exitSnap = {
        capability: Math.round(bestCapability(s) * 1000) / 1000,
        alignTrue: Math.round(s.alignmentTrue * 10) / 10,
        alignApparent: Math.round(s.alignmentApparent * 10) / 10,
        gov: Math.round(s.govRelations * 10) / 10,
        approval: Math.round(s.approval * 10) / 10,
        lead: Math.round(s.lead * 100) / 100,
        funds: Math.round(s.funds),
        securityLevel: s.securityLevel,
        data: Math.round(s.data * 10) / 10,
        incidents: s.stats.incidents - incidentsAtStart,
      };
      s2Ticks++;
      if (greyedGoal(s)) s2GreyTicks++;
      const vis = visible.filter((p) => !p.pinned && !p.rescue);
      maxVisible = Math.max(maxVisible, vis.length);
      maxVisibleCapped = Math.max(maxVisibleCapped, vis.filter((p) => !p.sideline && !(p.urgent?.(s) ?? false) && !p.stages.includes(1)).length);
      for (const id of s.cadence.queue) if (!queueSince.has(id)) queueSince.set(id, t);
      for (const [id, since] of [...queueSince]) {
        if (!s.cadence.queue.includes(id)) {
          if (s.projects[id]?.shown && t - since > maxQueueWait) {
            maxQueueWait = t - since;
            maxQueueId = `${id}@${fmtClock(since - (s2Start ?? since))}`;
          }
          queueSince.delete(id);
        }
      }
      const ts = t - (s2Start ?? t);
      if (i % 10 === 0) blockLog.push([t, runBlocker(s)]);
      if (firstChoice === null && meaningfulChoice(s)) firstChoice = ts;
      if (revenueAfter30 === null && ts >= 30) revenueAfter30 = s.stats.revPerSec;
      if (ts >= nextMark) {
        marks.push(markOf(s, Math.round(ts)));
        nextMark += 300;
      }
    }
    if (i % 10 === 0) {
      revHistory.push([t, s.stats.revPerSec]);
      if (revHistory.length > 40) revHistory.shift();
    }

    const keys = noveltyKeys(s).filter((k) => !isRescueKey(k));
    if (keys.some((k) => !prevKeys.has(k))) {
      if (t - lastNovelty > 60) {
        idleGaps.push([lastNovelty, t]);
        out(t, `IDLE GAP ${fmtClock(lastNovelty - t0)}–${fmtClock(t - t0)}`);
      }
      lastNovelty = t;
    }
    prevKeys = new Set(keys);

    if ((i + 1) % 600 === 0) lines.push(minuteLine(s, (i + 1) / 600));
  }
  const end = s.stats.timePlayed;
  if (end - lastNovelty > 60) idleGaps.push([lastNovelty, end]);
  if (stallFrom >= 0 && end - stallFrom >= 60) softLocks.push([stallFrom, end]);

  const horizon = transition ?? end;
  const rg = longestGap(revealTimes, t0, horizon);
  const ng = longestGap(noveltyTimes, t0, horizon);
  const stage1Presses = pressTimes.filter((t) => t <= horizon);
  let worstWindow = 0;
  for (let k = 0; k < stage1Presses.length; k++) {
    let n = 0;
    while (k + n < stage1Presses.length && stage1Presses[k + n]! - stage1Presses[k]! < 300) n++;
    worstWindow = Math.max(worstWindow, n);
  }

  let s2: Stage2Summary | null = null;
  if (s2Start !== null) {
    const startT = s2Start;
    const stop = s2End ?? end;
    const rel = (t: number) => Math.round(t - startT);
    const g = longestGap(s2Reveals, startT, stop);
    const last10 = longestGap(s2Reveals, Math.max(startT, stop - 600), stop);
    const mg = longestGap(s2Mechanics, startT, stop);
    const intervals = s2TrainStarts.slice(1).map((x, k) => x - s2TrainStarts[k]!);
    let chore: { verb: string; presses: number } | null = null;
    for (const [verb, times] of Object.entries(pressLog)) {
      const auto = AUTOMATED[verb];
      if (!auto) continue;
      const since = verb === 'gpuLot' ? standingAt : startT;
      if (since === null) continue;
      const after = times.filter((x) => x >= since && x >= startT && x <= stop);
      for (let k = 0; k < after.length; k++) {
        let n = 0;
        while (k + n < after.length && after[k + n]! - after[k]! < 60) n++;
        if (!chore || n > chore.presses) chore = { verb, presses: n };
      }
    }
    const presses: Record<string, number> = {};
    for (const [verb, n] of Object.entries(s.stats.pressCounts)) presses[verb] = n - (pressesAtStart[verb] ?? 0);
    const govLines = s.cadence.governed.filter((x) => Number(x.split(':')[0]) >= startT - 1).map((x) => {
      const [tt, ...rest] = x.split(':');
      return `${fmtClock(Number(tt) - startT)} ${rest.join(':')}`;
    });
    const logGaps = longestGap(logTimes, startT, stop);
    let longest: [number, number] = [0, 0];
    for (let k = 1; k < s2TrainStarts.length; k++) {
      const g = s2TrainStarts[k]! - s2TrainStarts[k - 1]!;
      if (g > longest[1] - longest[0]) longest = [s2TrainStarts[k - 1]!, s2TrainStarts[k]!];
    }
    const tally: Record<string, number> = {};
    for (const [bt, why] of blockLog) if (bt >= longest[0] && bt < longest[1]) tally[why] = (tally[why] ?? 0) + 1;
    s2 = {
      start: Math.round(startT),
      duration: s2End === null ? null : rel(s2End),
      exitHow: s2Exit,
      capabilityAtExit: Math.round((s2End === null ? bestCapability(s) : s2Cap) * 1000) / 1000,
      runs: s2TrainStarts.length,
      trainStarts: s2TrainStarts.map(rel),
      intervalMean: intervals.length ? Math.round(intervals.reduce((x, y) => x + y, 0) / intervals.length) : null,
      intervalMax: intervals.length ? Math.round(Math.max(...intervals)) : null,
      durationMin: s2Durations.length ? Math.min(...s2Durations) : null,
      durationMax: s2Durations.length ? Math.max(...s2Durations) : null,
      minYield: s2Yields.length ? Math.round(Math.min(...s2Yields) * 100) / 100 : null,
      longestRevealGap: Math.round(g.gap),
      longestRevealGapAt: [rel(g.at[0]), rel(g.at[1])],
      revealGapsOver120: g.over.map(([x, y]) => [rel(x), rel(y)]),
      lastTenGap: Math.round(last10.gap),
      lastTenGapAt: [rel(last10.at[0]), rel(last10.at[1])],
      mechanicGap: Math.round(mg.gap),
      mechanicGapAt: [rel(mg.at[0]), rel(mg.at[1])],
      reveals: s2Reveals.filter((x) => x <= stop).length,
      greyedGoalPct: s2Ticks ? Math.round((1000 * s2GreyTicks) / s2Ticks) / 10 : 0,
      gpuPressesBeforeStanding,
      gpuPresses: presses['gpuLot'] ?? 0,
      powerPurchases: (presses['gas'] ?? 0) + (presses['solar'] ?? 0) + (presses['nuclear'] ?? 0) + (s.flags['gulfSigned'] === true ? 1 : 0),
      datacenters: presses['datacenter'] ?? 0,
      choreWorst: chore,
      idleRescues: s2Rescues,
      governor: govLines,
      modals: s2Modals,
      modalIds: s2ModalIds,
      minModalSpacing: s2AutoModals.length < 2 ? null : Math.round(Math.min(...s2AutoModals.slice(1).map((x, k) => x - s2AutoModals[k]!))),
      maxVisible,
      maxVisibleCapped,
      maxQueueWait: Math.round(maxQueueWait),
      maxQueueId,
      firstPower: milestones['s2:firstPower'] !== undefined ? rel(milestones['s2:firstPower']!) : null,
      firstDatacenter: milestones['s2:firstDatacenter'] !== undefined ? rel(milestones['s2:firstDatacenter']!) : null,
      assistantsBought: milestones['s2:assistants'] !== undefined ? rel(milestones['s2:assistants']!) : null,
      standingOrderAt: standingAt === null ? null : rel(standingAt),
      marks,
      revenueBefore: revenueBefore === null ? null : Math.round(revenueBefore),
      revenueAfter30: revenueAfter30 === null ? null : Math.round(revenueAfter30),
      firstChoice: firstChoice === null ? null : Math.round(firstChoice),
      exitShownBefore: exitShownAt === null || s2End === null ? null : Math.round(s2End - exitShownAt),
      logEntries: logTimes.length,
      longestLogGap: Math.round(logGaps.gap),
      pressCounts: presses,
      incidents: s.stats.incidents - incidentsAtStart,
      mechanics: s2MechNames.map(([t, n]) => `${fmtClock(t - startT)} ${n}`),
      longestIntervalBlockers: Object.entries(tally).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}s`).join(', '),
      latencyMedian: s2Latency.length ? median(s2Latency.map(([, v]) => v)) : null,
      latencyWithin10Pct: s2Latency.length ? Math.round((100 * s2Latency.filter(([, v]) => v <= 10).length) / s2Latency.length) : 0,
      latencies: s2Latency,
      exitState: exitSnap,
      choices: s2Choices,
      handsNonePct: handsChecks ? Math.round((100 * handsNone) / handsChecks) : 0,
      handsTwoPct: handsChecks ? Math.round((100 * handsTwo) / handsChecks) : 0,
      clickGapPct: clickGapShare(actionTimes, startT + 600, stop),
      longestRelease: Math.round(Math.max(longestRelease, stop - lastCapAt)),
      longestReleaseAt: rel(longestRelease >= stop - lastCapAt ? longestReleaseAt : lastCapAt),
    };
    void s2LogStart;
  }

  // The densest six minutes of first-time reveals in Stage 1 (what is on screen at second 0 is the
  // opening screen, not a reveal).
  const s1Reveals = revealTimes.filter((x) => x > t0 && x <= horizon).sort((x, y) => x - y);
  let maxReveals6min = 0;
  let maxReveals6minAt = 0;
  for (let a = 0, b = 0; b < s1Reveals.length; b++) {
    while (s1Reveals[b]! - s1Reveals[a]! > 360) a++;
    if (b - a + 1 > maxReveals6min) {
      maxReveals6min = b - a + 1;
      maxReveals6minAt = Math.round(s1Reveals[a]! - t0);
    }
  }
  const summary: Summary = {
    seed: args.seed,
    policy: args.policy,
    transition,
    firstGpu: milestones['firstGpu'] ?? null,
    longestRevealGap: Math.round(rg.gap),
    longestRevealGapAt: [Math.round(rg.at[0]), Math.round(rg.at[1])],
    revealGapsOver120: rg.over.map(([a, b]) => [Math.round(a), Math.round(b)]),
    longestNoveltyGap: Math.round(ng.gap),
    longestNoveltyGapAt: [Math.round(ng.at[0]), Math.round(ng.at[1])],
    powerPresses: stage1Presses.length,
    worstPressWindow: worstWindow,
    capabilityAtTransition: capAtTransition === null ? null : Math.round(capAtTransition * 1000) / 1000,
    idleRescues: stage1Rescues,
    rescuesAtZeroTasks: rescuesAtZero,
    softLocks: softLocks.map(([a, b]) => [Math.round(a), Math.round(b)]),
    reveals: revealTimes.filter((t) => t <= horizon).length,
    runs,
    minYield: minYield === null ? null : Math.round(minYield * 1000) / 1000,
    modals,
    minModalSpacing: autoModalTimes.length < 2 ? null
      : Math.round(Math.min(...autoModalTimes.slice(1).map((x, i) => x - autoModalTimes[i]!))),
    research: milestones['reveal:research'] ?? null,
    projects: milestones['reveal:projects'] ?? null,
    grid: milestones['buy:p_grid'] ?? null,
    ladder: ['p_site', 'p_interconnect', 'p_substation', 'p_datacenter'].map((id) => {
      const at = milestones[`buy:${id}`];
      return at === undefined ? null : Math.round(at);
    }),
    latencyMedian: s1Latency.length ? median(s1Latency.map(([, v]) => v)) : null,
    latencyWithin10Pct: s1Latency.length ? Math.round((100 * s1Latency.filter(([, v]) => v <= 10).length) / s1Latency.length) : 0,
    latencies: s1Latency,
    maxReveals6min,
    maxReveals6minAt,
    exitState1: s1Snap,
    choices1: s1Choices,
    s2,
  };
  return { state: s, milestones, idleGaps, lines, summary };
}

function minuteLine(s: GameState, minute: number): string {
  const vis = visibleProjects(s)
    .map((p) => `${p.title}${p.canAfford(s) ? '*' : ''}`)
    .join(', ');
  const run = s.training.run;
  const training = run ? ` | ${run.name} ${run.phase}` : '';
  const second = s.training.pending ? ` + ${s.training.pending.name}` : '';
  const s2 = s.stage >= 2
    ? ` | dc ${s.datacenters} (${fmtInt(gpuCapacity(s))}) | MW ${fmtInt(s.powerCapacityMW)}${s.powerQueue.length ? `+${s.powerQueue.length}q` : ''}` +
      ` | data ${fmtNum(s.data, 1)}T | r/s ${fmtInt(researchRate(s))} (human ${Math.round(humanShare(s) * 100)}%) | alloc ${Math.round(s.researchAlloc * 100)}%` +
      ` | gov ${Math.round(s.govRelations)} appr ${Math.round(s.approval)} jobs ${fmtNum(s.jobsDisplaced, 2)} lead ${fmtNum(s.lead, 1)}`
    : '';
  return (
    `m${minute} | S${s.stage} ${dateLabel(s.date)} | tasks ${fmtInt(s.tasks)} | ${fmtMoney(s.funds)} | rev/s ${fmtInt(s.stats.revPerSec)}` +
    ` | price ${s.price < 0.1 ? s.price.toFixed(4) : s.price.toFixed(2)} | gpus ${fmtInt(s.gpus)} | copies ${fmtInt(copies(s))} | tps ${fmtInt(s.stats.tasksPerSec)}` +
    ` | research ${fmtInt(s.research)}/${fmtInt(researchCap(s))} | insight ${Math.floor(s.insight)} | trust ${s.trust}` +
    ` | res ${s.researchers} lab ${s.labSpace} | mkt ${s.hypeLevel} | cap ${s.capability.toFixed(2)}/${bestCapability(s).toFixed(2)}${training}${second}${s2}` +
    ` | visible: ${vis || '—'}`
  );
}

const clock = (t: number | null) => (t === null ? '—' : fmtClock(t));
const span = ([a, b]: [number, number]) => `${fmtClock(a)}–${fmtClock(b)}`;

function printStage2(sum: Stage2Summary): void {
  const ok = (v: boolean) => (v ? '' : '  <-- MISS');
  console.log(`\n== Stage 2 (from ${clock(sum.start)} of play) ==`);
  console.log(`A1 duration               ${clock(sum.duration)}   (bot 35:00–45:00, naive 30:00–50:00)${ok(sum.duration !== null && sum.duration >= 1800 && sum.duration <= 3000)}`);
  console.log(`   capability at exit     ${sum.capabilityAtExit}   (A8 4.0–4.7)${ok(sum.capabilityAtExit >= 4 && sum.capabilityAtExit <= 4.7)}`);
  console.log(`A2 LONGEST REVEAL GAP     ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)}), ${sum.reveals} reveals   (≤ 180)${ok(sum.longestRevealGap <= 180)}`);
  console.log(`   reveal gaps > 120 s    ${sum.revealGapsOver120.length ? sum.revealGapsOver120.map(span).join(', ') : 'none'}`);
  console.log(`A3 last 10 minutes        ${sum.lastTenGap} s (${span(sum.lastTenGapAt)})   (≤ 180)${ok(sum.lastTenGap <= 180)}`);
  console.log(`A4 panels/mechanics gap   ${sum.mechanicGap} s (${span(sum.mechanicGapAt)})   (≤ 270)${ok(sum.mechanicGap <= 270)}`);
  console.log(`G24 nothing enabled       ${sum.handsNonePct}% of 2-s checks after 3:00   (≤ 50%)${ok(sum.handsNonePct <= 50)}`);
  console.log(`G25 two or more things    ${sum.handsTwoPct}% of checks   (≥ 25%)${ok(sum.handsTwoPct >= 25)}`);
  console.log(`G26 hands idle ≥ 30 s     ${sum.clickGapPct}% of the time after 10:00   (≤ 35%)${ok(sum.clickGapPct <= 35)}`);
  console.log(`G26 longest release gap   ${clock(sum.longestRelease)} from ${clock(sum.longestReleaseAt)}   (≤ 5:30)${ok(sum.longestRelease <= 330)}`);
  console.log(`   mechanics              ${sum.mechanics.join(' · ')}`);
  console.log(`A5 training runs          ${sum.runs}   (bot 9–12, naive 7–10)`);
  console.log(`A6 interval between starts mean ${sum.intervalMean ?? '—'} s, max ${sum.intervalMax ?? '—'} s   (bot mean 170–260, max ≤ 360; naive max ≤ 540)`);
  console.log(`   training starts        ${sum.trainStarts.map((x) => fmtClock(x)).join(' ')}`);
  console.log(`   longest interval held by ${sum.longestIntervalBlockers || '—'}`);
  console.log(`A7 run durations          ${sum.durationMin ?? '—'}–${sum.durationMax ?? '—'} s (min yield ${sum.minYield ?? '—'})   (45–120)`);
  console.log(`A9 greyed goal on screen  ${sum.greyedGoalPct}% of ticks   (≥ 99)${ok(sum.greyedGoalPct >= 99)}`);
  console.log(`A10 Buy GPUs presses      ${sum.gpuPressesBeforeStanding} before Standing order (${clock(sum.standingOrderAt)}), ${sum.gpuPresses} total   (≤ 12, ≤ 40; naive ≤ 60)`);
  console.log(`A11 power / datacenters   ${sum.powerPurchases} / ${sum.datacenters}   (≤ 20 / ≤ 9)`);
  console.log(`A12 chore check           ${sum.choreWorst ? `${sum.choreWorst.verb} ×${sum.choreWorst.presses} in 60 s` : 'none'}   (never > 2)`);
  console.log(`A13 idle rescues ${sum.idleRescues}; governor pulls ${sum.governor.length}${sum.governor.length ? ` (${sum.governor.join(', ')})` : ''}; modals ${sum.modals} (min spacing ${sum.minModalSpacing ?? '—'} s)`);
  console.log(`   modals                 ${sum.modalIds.join(', ')}`);
  console.log(`   reveal → purchase      median ${sum.latencyMedian ?? '—'} s, ${sum.latencyWithin10Pct}% within 10 s (${sum.latencies.length} projects)`);
  const x = sum.exitState;
  if (x) console.log(`   exit state             capability ${x.capability}, alignment ${x.alignTrue} true / ${x.alignApparent} apparent, gov ${x.gov}, approval ${x.approval}, lead ${x.lead} mo, funds ${fmtMoney(x.funds)}, SL${x.securityLevel}, incidents ${x.incidents}`);
  console.log(`A14 visible projects max  ${sum.maxVisible} (cap-counted ${sum.maxVisibleCapped}); longest queue wait ${sum.maxQueueWait} s ${sum.maxQueueId}   (≤ 6; ≤ 60)`);
  console.log(`A15 first power ${clock(sum.firstPower)}; first datacenter ${clock(sum.firstDatacenter)}; AI assistants ${clock(sum.assistantsBought)}   (≤ 5:30; ≤ 10:00; ≤ 8:00)`);
  console.log(`A16 revenue 10 s before Break ground ${sum.revenueBefore ?? '—'}/s; 30 s after arrival ${sum.revenueAfter30 ?? '—'}/s`);
  console.log(`A17 first meaningful choice ${clock(sum.firstChoice)}   (≤ 1:30)`);
  console.log(`A18 exit shown before exit ${sum.exitShownBefore === null ? '—' : fmtClock(sum.exitShownBefore)}   (≥ 8:00)`);
  console.log(`   log entries ${sum.logEntries} (longest gap ${sum.longestLogGap} s); incidents ${sum.incidents}; presses ${JSON.stringify(sum.pressCounts)}`);
  console.log('   5-min marks   ts    GPUs      MW    DCs  tasks/s        rev/s     price   cap   research/s  human%  jobs(M)');
  for (const m of sum.marks) {
    console.log(
      `                 ${fmtClock(m.t).padStart(5)} ${fmtInt(m.gpus).padStart(9)} ${fmtInt(m.mw).padStart(6)} ${String(m.dcs).padStart(4)} ${fmtInt(m.tasksPerSec).padStart(12)} ${fmtMoney(m.revenue).padStart(12)} ${m.price.toFixed(4).padStart(8)} ${m.capability.toFixed(2).padStart(5)} ${fmtInt(m.researchPerSec).padStart(12)} ${m.humanShare.toFixed(1).padStart(6)} ${m.jobs.toFixed(2).padStart(7)}`,
    );
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const result = simulate(args);
  const sum = result.summary;
  if (args.json) {
    console.log(JSON.stringify(sum));
    return;
  }
  for (const line of result.lines) {
    if (args.quiet && !line.startsWith('m')) continue;
    console.log(line);
  }
  const m = result.milestones;
  const fmt = (k: string) => (m[k] !== undefined ? fmtClock(m[k]!) : '—');
  if (args.preset <= 1) {
    console.log(`\n== Stage 1 milestones (policy ${args.policy}, seed ${args.seed}) ==`);
    console.log(`first GPU                ${fmt('firstGpu')}   (target ≤ 0:20)`);
    console.log(`Research panel           ${fmt('reveal:research')}`);
    console.log(`Projects panel           ${fmt('reveal:projects')}`);
    console.log(`Grid Contract bought     ${fmt('buy:p_grid')}   (target ≤ 6:00)`);
    console.log(`Training Pipeline bought ${fmt('buy:p_training')}`);
    console.log(`first training start     ${fmt('firstTrainingStart')}`);
    console.log(`first release            ${fmt('firstRelease')}`);
    console.log(`Series A bought          ${fmt('buy:p_series_a')}`);
    console.log(`Abilene site reserved    ${fmt('buy:p_site')}`);
    console.log(`Interconnect queue       ${fmt('buy:p_interconnect')}`);
    console.log(`Substation               ${fmt('buy:p_substation')}`);
    console.log(`TRANSITION (Break ground) ${clock(sum.transition)}   (target bot 25:00–35:00, naive 26:00–40:00, greedy ≤ 40:00)`);
    console.log(`capability at transition ${sum.capabilityAtTransition ?? '—'}   (target 1.5–1.8)`);
    console.log(`LONGEST REVEAL GAP       ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)})   (target ≤ 180 s)`);
    console.log(`reveal gaps > 120 s      ${sum.revealGapsOver120.length ? sum.revealGapsOver120.map(span).join(', ') : 'none'}`);
    console.log(`LONGEST NOVELTY GAP      ${sum.longestNoveltyGap} s (${span(sum.longestNoveltyGapAt)})`);
    console.log(`Buy Power presses        ${sum.powerPresses} (worst 5-min window ${sum.worstPressWindow})   (target ≤ 60, ≤ 10)`);
    console.log(`idle rescues             ${sum.idleRescues} (at 0 tasks: ${sum.rescuesAtZeroTasks})   (target ≤ 2, none at 0)`);
    console.log(`soft-locks               ${sum.softLocks.length ? sum.softLocks.map(span).join(', ') : 'none'}`);
    console.log(`Abilene ladder           ${sum.ladder.map(clock).join(' → ')}   (Substation → Break ground target 2–4 min)`);
    console.log(`training runs            ${sum.runs} (min yield ${sum.minYield ?? '—'})   (target: no run under 0.3)`);
    console.log(`modals                   ${sum.modals} (min spacing ${sum.minModalSpacing ?? '—'} s)   (target 7–9, ≥ 150 s apart)`);
    console.log(`reveal → purchase        median ${sum.latencyMedian ?? '—'} s, ${sum.latencyWithin10Pct}% within 10 s (${sum.latencies.length} projects)   (target bot ≥ 90, naive ≥ 60; ≤ 10 %)`);
    console.log(`densest six minutes      ${sum.maxReveals6min} first-time reveals from ${fmtClock(sum.maxReveals6minAt)}   (target ≤ 16)`);
    const x = sum.exitState1;
    if (x) console.log(`exit state               capability ${x.capability}, alignment ${x.alignTrue} true / ${x.alignApparent} apparent, Trust ${x.trust}, ${x.researchers} researchers, lab ${x.labSpace}, marketing ${x.hypeLevel}, ${x.contracts} contracts ($${x.contractRate}/s of $${x.revPerSec}/s), price $${x.price}, ${x.gpus} GPUs, ${x.incidents} incidents`);
    if (sum.choices1.length) console.log(`modal answers            ${sum.choices1.join(', ')}`);
  }
  if (sum.s2) printStage2(sum.s2);
  console.log(`IDLE GAPs > 60 s         ${result.idleGaps.length ? result.idleGaps.map(span).join(', ') : 'none'}`);
}

if (process.argv[1] && /bot\.js$/.test(process.argv[1])) main();
