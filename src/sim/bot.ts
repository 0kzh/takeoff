import { newGame, GameState, isBought } from '../engine/state.js';
import { step, actions } from '../engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from './policy.js';
import { noveltyKeys, isRescueKey, PLAYER_MODALS, enabledPurchases, choiceById, optionCost } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { GRID_CONTRACT_PRESSES } from '../data/projects.js';
import {
  researchCap, copies, copiesIdle, researchRate, humanShare, bestCapability, marketingCost, contractRate,
  powerBlockCost, gpuCost, rentQuota, atRentQuota,
} from '../engine/economy.js';
import { gpuCapacity, lotSize, lotCost, datacenterCost, gasCost, solarCost, nuclearCost, solarQueueFull, lotSizes, lotFits, lotCostOf } from '../engine/infrastructure.js';
import {
  trainCost, canStartTraining, gpusShort, trainSlotFree, trainingRun, canPressTrain, needsDatacenter, gpusNeeded, runDelaySeconds,
} from '../engine/training.js';
import { fmtInt, fmtMoney, fmtClock, dateLabel, fmtNum } from '../engine/format.js';
import { presetByKey } from '../data/presets.js';
import { MECHANIC_FLAGS } from '../data/stage2.js';
import { Stage3Tracker, Stage3Summary, printStage3 } from './stage3sim.js';
import { Stage4Tracker, Stage4Summary, printStage4 } from './stage4sim.js';
import { Stage5Tracker, Stage5Summary, printStage5, printWholeGame, screenValues } from './stage5sim.js';
import { setSkin, swarmReached, ROWS_TAKEN_AT } from '../engine/space.js';

declare const process: { argv: string[]; exitCode?: number };

interface Args {
  skinTest?: boolean;
  minutes: number;
  seed: number;
  quiet: boolean;
  json: boolean;
  policy: PolicyName;
  stopAtStage: number;
  preset: string;
  variant: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { minutes: 60, seed: 1, quiet: false, json: false, policy: 'bot', stopAtStage: 0, preset: '1', variant: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--minutes' && v) args.minutes = Number(v);
    if (k === '--seed' && v) args.seed = Number(v);
    if (k === '--stop-at-stage' && v) args.stopAtStage = Number(v);
    if (k === '--preset' && v) args.preset = v;
    if (k === '--variant' && v) args.variant = v;
    if (k === '--policy' && (v === 'bot' || v === 'naive' || v === 'greedy' || v === 'trainfirst' || v === 'racer' || v === 'cautious')) args.policy = v;
    if (k === '--quiet') args.quiet = true;
    if (k === '--skin-test') args.skinTest = true;
    if (k === '--json') args.json = true;
  }
  return args;
}

const RESCUE_PROJECTS = ['p_beg_power', 'p_press', 'p_beg_data'];
const RESCUE_CHOICES = ['c_customer_email'];

const S2_MECHANICS = MECHANIC_FLAGS;

const AUTOMATED: Record<string, (s: GameState) => boolean> = {
  gpuLot: (s) => (s.projects['p_standing_order']?.bought ?? 0) > 0,
  price: (s) => s.stage >= 2,
};

export interface Summary {
  seed: number;
  policy: PolicyName;
  transition: number | null;
  firstGpu: number | null;
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  revealGapsOver120: [number, number][];
  longestNoveltyGap: number;
  longestNoveltyGapAt: [number, number];
  powerPresses: number;
  worstPressWindow: number;
  capabilityAtTransition: number | null;
  idleRescues: number;
  rescuesAtZeroTasks: number;
  softLocks: [number, number][];
  reveals: number;
  datacenterShown: number | null;
  wallToDc: number | null;
  runs: number;
  runGpus: number[];
  gpuBlockedMax: number;
  gpuBlockedAt: number;
  modals: number;
  minModalSpacing: number | null;
  research: number | null;
  projects: number | null;
  grid: number | null;
  latencyMedian: number | null;
  latencyWithin10Pct: number;
  latencies: [string, number][];
  maxReveals6min: number;
  maxReveals6minAt: number;
  exitState1: ExitState1 | null;
  choices1: string[];
  s1x: Stage1Extra;
  s2: Stage2Summary | null;
  s3: Stage3Summary | null;
  s4: Stage4Summary | null;
  s5: Stage5Summary | null;
}

export interface Stage1Extra {
  trainStarts: number[];
  maxStartGap: number | null;
  firstRun: number | null;
  blocked: Record<string, number>;
  disabledIdle: number;
  dcOnScreen: number | null;
  dcShare: number | null;
  delayed: number;
  unprinted: number;
  capBeforeTraining: number;
  emptyPanelMax: number;
  marketingGreyMax: number;
  dollarGapMax: number | null;
  linesIn26: number;
  linesIn26All: number;
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
  duration: number | null;
  exitHow: string;
  capabilityAtExit: number;
  runs: number;
  trainStarts: number[];
  intervalMean: number | null;
  intervalMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  runGpus: number[];
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  revealGapsOver120: [number, number][];
  lastTenGap: number;
  lastTenGapAt: [number, number];
  mechanicGap: number;
  mechanicGapAt: [number, number];
  reveals: number;
  greyedGoalPct: number;
  gpuBlockedPct: number;
  gpuPressesBeforeStanding: number;
  gpuPresses: number;
  powerPurchases: number;
  datacenters: number;
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
  longestIntervalBlockers: string;
  latencyMedian: number | null;
  latencyWithin10Pct: number;
  latencies: [string, number][];
  exitState: ExitState | null;
  choices: string[];
  handsNonePct: number;
  handsTwoPct: number;
  clickGapPct: number;
  lotLitPct: number;
  trainReadyPct: number;
  lotPresses: number;
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

function trainBlockedBy(s: GameState): string {
  if (!s.revealed['training'] || s.training.run || s.training.pending || canStartTraining(s)) return '';
  if (s.training.cooldown > 0) return 'cooldown';
  if (needsDatacenter(s)) return 'wall';
  if (gpusShort(s)) return gpusNeeded(s) > rentQuota(s) || atRentQuota(s) ? 'quota' : 'gpus';
  const c = trainCost(s);
  if ((c.research ?? 0) > researchCap(s)) return 'lab';
  if ((c.research ?? 0) > s.research) return 'research';
  if ((c.funds ?? 0) > s.funds) return 'money';
  return 'other';
}

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
  if (gpusShort(s)) return 'gpus';
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
  const preset = presetByKey(args.preset);
  const s = args.preset !== '1' && preset ? preset.build(args.seed) : newGame(args.seed);
  const mem = newBotMemory(args.policy, false, args.variant);
  const flip = args.variant.split(',').includes('flip');
  let flipped = false;
  const flipNow = () => {
    if (!flip || flipped || s.stage !== 5) return;
    flipped = true;
    setSkin(s, s.flags['alignedAtHandover'] !== true);
  };
  flipNow();
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
  const runGpus1: number[] = [];
  let gpuBlockedSince: number | null = null;
  let gpuBlockedMax = 0;
  let gpuBlockedAt = 0;
  let prevRunIds = new Set<number>();
  let transition: number | null = null;
  let capAtTransition: number | null = null;

  const s1ShownAt = new Map<string, number>();
  const s1BoughtSeen = new Set<string>();
  const s1Latency: [string, number][] = [];
  let s1Snap: ExitState1 | null = null;
  const s1Choices: string[] = [];

  let s2Start: number | null = s.stage === 2 ? t0 : null;
  let s2End: number | null = null;
  let s2LotPresses: number | null = null;
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
  const s2RunGpus: number[] = [];
  let s2Modals = 0;
  const s2ModalIds: string[] = [];
  const s2AutoModals: number[] = [];
  let s2Rescues = 0;
  let s2GreyTicks = 0;
  let s2Ticks = 0;
  let s2GpuBlockedTicks = 0;
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
  const actionTimes: number[] = [];
  let handsChecks = 0;
  let handsNone = 0;
  let lotLit = 0;
  let lotLitWindow = false;
  const windowEnabled = new Set<string>();
  let batchesAtCheck = s.gpuBatches;
  const lotLitNow = () =>
    lotSizes(s).some((k, row) => (row === 0 || s.revealed[row === 1 ? 'lot5' : 'lot25']) && lotFits(s, k) && s.buildFund >= lotCostOf(s, k));
  let trainIdleChecks = 0;
  let trainReady = 0;
  let handsTwo = 0;
  let lastCap = s.capability;
  let lastCapAt = s.stats.timePlayed;
  let longestRelease = 0;
  let longestReleaseAt = 0;
  const t3 = new Stage3Tracker();
  const t4 = new Stage4Tracker();
  const t5 = new Stage5Tracker();
  let delayedBuys = 0;
  let unprintedBuys = 0;
  const dollarBuys: number[] = [];
  const dollarOf = (prop: string, args: unknown[]): { funds: number; printed: boolean } | null => {
    if (s.stage !== 1) return null;
    if (prop === 'buyPower') return { funds: powerBlockCost(s), printed: false };
    if (prop === 'buyMarketing') return { funds: marketingCost(s), printed: true };
    if (prop === 'rentGpu') return gpusShort(s) && !needsDatacenter(s) ? null : { funds: gpuCost(s), printed: true };
    if (prop === 'buyProject') {
      const def = projectById(String(args[1]));
      const funds = def && def.id !== 'p_datacenter' ? def.cost(s).funds ?? 0 : 0;
      return funds > 0 ? { funds, printed: true } : null;
    }
    if (prop === 'resolveChoice' && s.activeChoice) {
      const def = choiceById(s.activeChoice.id);
      const opt = def?.options[Number(args[1])];
      const funds = opt ? optionCost(s, opt)?.funds ?? 0 : 0;
      return funds > 0 ? { funds, printed: true } : null;
    }
    return null;
  };
  const tracked = new Proxy(actions, {
    get(target, prop: string) {
      const fn = (target as unknown as Record<string, (...args: unknown[]) => unknown>)[prop];
      if (typeof fn !== 'function') return fn;
      return (...args: unknown[]) => {
        const buy = dollarOf(prop, args);
        const delay = buy ? runDelaySeconds(s, { funds: buy.funds }) : 0;
        const r = fn(...args);
        if (r && prop !== 'clickTask') actionTimes.push(s.stats.timePlayed);
        if (r && buy) {
          if (prop !== 'buyPower') dollarBuys.push(s.stats.timePlayed);
          if (delay >= 10) {
            delayedBuys++;
            if (!buy.printed) unprintedBuys++;
          }
        }
        return r;
      };
    },
  }) as typeof actions;
  const blocked: Record<string, number> = {};
  let disabledIdle = 0;
  let capBeforeTraining = 0;
  let emptySince: number | null = null;
  let emptyPanelMax = 0;
  let greySince: number | null = null;
  let marketingGreyMax = 0;
  const lineTimes: number[] = [];
  const allLineTimes: number[] = [];
  let replyLines = 0;
  let linesSeen = s.stats.consoleLines ?? 0;
  const s1Starts: number[] = [];
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
  for (const [id, st] of Object.entries(s.projects)) if (st.shown || st.bought) seenProjects.add(id);
  if (s.stage === 2) {
    s2LogStart = s.log.length;
    incidentsAtStart = s.stats.incidents;
    revenueBefore = s.stats.revPerSec;
  }

  const beginStage2 = (t: number) => {
    s2Start = t;
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
    if (s.stage === 2 && s2Start !== null && s.stats.timePlayed - s2Start >= 178) {
      for (const k of enabledPurchases(s)) windowEnabled.add(k);
      if (!lotLitWindow && s.revealed['infrastructure'] && lotLitNow()) lotLitWindow = true;
    }
    if (s.stage === 2 && i % 20 === 0 && s2Start !== null && s.stats.timePlayed - s2Start >= 180) {
      const n = windowEnabled.size;
      windowEnabled.clear();
      handsChecks++;
      if (n === 0) handsNone++;
      if (lotLitWindow || s.gpuBatches > batchesAtCheck) lotLit++;
      lotLitWindow = false;
      batchesAtCheck = s.gpuBatches;
      if (s.revealed['training'] && trainSlotFree(s) && !trainingRun(s)) {
        trainIdleChecks++;
        if (canPressTrain(s) || s.training.armed) trainReady++;
      }
      if (n >= 2) handsTwo++;
    }
    const linesBefore = s.stats.consoleLines ?? 0;
    policyStep(s, tracked, mem);
    replyLines += (s.stats.consoleLines ?? 0) - linesBefore;
    step(s);
    t3.tick(s, actionTimes);
    t4.tick(s, actionTimes);
    flipNow();
    t5.tick(s, actionTimes);
    if (s.ending) break;
    const t = s.stats.timePlayed;
    if (s.stage === 1) {
      const why = trainBlockedBy(s);
      if (why) blocked[why] = Math.round(((blocked[why] ?? 0) + 0.1) * 10) / 10;
      if (why && why !== 'money' && why !== 'wall' && s.flags['wallAt'] === undefined && !canPressTrain(s)) disabledIdle += 0.1;
      if (s.revealed['projects'] && !s.revealed['training'] && Object.entries(s.projects).some(([id, st]) => (st.shown || st.bought > 0) && !RESCUE_PROJECTS.includes(id))) {
        if (s.research >= researchCap(s) - 0.5) capBeforeTraining += 0.1;
        const empty = !visibleProjects(s).some((p) => !p.rescue) && s.cadence.queue.length > 0;
        if (empty && emptySince === null) emptySince = t;
        if (!empty && emptySince !== null) {
          emptyPanelMax = Math.max(emptyPanelMax, t - emptySince);
          emptySince = null;
        }
      }
      const grey = t - t0 >= 300 && s.revealed['marketing'] === true && s.funds < marketingCost(s);
      if (grey && greySince === null) greySince = t;
      if (!grey && greySince !== null) {
        marketingGreyMax = Math.max(marketingGreyMax, t - greySince);
        greySince = null;
      }
      const lines = s.stats.consoleLines ?? 0;
      for (; linesSeen < lines; linesSeen++) {
        allLineTimes.push(t);
        if (replyLines > 0) replyLines--;
        else lineTimes.push(t);
      }
      const blockedGpu = s.revealed['training'] === true && trainSlotFree(s) && s.training.cooldown <= 0 && gpusShort(s);
      if (blockedGpu && gpuBlockedSince === null) gpuBlockedSince = t;
      if (!blockedGpu && gpuBlockedSince !== null) {
        if (t - gpuBlockedSince > gpuBlockedMax) {
          gpuBlockedMax = t - gpuBlockedSince;
          gpuBlockedAt = gpuBlockedSince - t0;
        }
        gpuBlockedSince = null;
      }
    } else if (gpuBlockedSince !== null) {
      if (t - gpuBlockedSince > gpuBlockedMax) {
        gpuBlockedMax = t - gpuBlockedSince;
        gpuBlockedAt = gpuBlockedSince - t0;
      }
      gpuBlockedSince = null;
    }
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
          if (s.stage === 2 && !p.stages.includes(1)) s2Reveals.push(t);
        }
      }
    }
    prevShown = new Set(visible.map((p) => p.id));
    if (s.activeChoice && s.activeChoice !== prevChoice && !countedChoices.has(s.activeChoice)) {
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
    for (const r of [s.training.run, s.training.pending]) {
      if (!r || prevRunIds.has(r.id)) continue;
      prevRunIds.add(r.id);
      if (r.prologue) {
        mark('prologueStart', t);
        continue;
      }
      if (s.stage === 1) {
        runs++;
        runGpus1.push(r.gpus);
        s1Starts.push(t);
        dollarBuys.push(t);
      } else if (s.stage === 2) {
        s2TrainStarts.push(t);
        s2Durations.push(r.duration);
        s2RunGpus.push(r.gpus);
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
    if (typeof s.flags['sageLiveAt'] === 'number') mark('sageLive', t);
    if (s.stats.powerPresses > prevPowerPresses) {
      for (let k = prevPowerPresses; k < s.stats.powerPresses; k++) pressTimes.push(t);
      prevPowerPresses = s.stats.powerPresses;
    }

    const run = s.training.pending ?? s.training.run;
    const phase = [s.training.run, s.training.pending].map((r) => (r ? `${r.name}:${r.phase}` : '')).join('|');
    if (phase !== prevPhase) {
      for (const r of [s.training.run, s.training.pending]) {
        if (!r || prevPhase.includes(`${r.name}:${r.phase}`)) continue;
        const extra = r.phase === 'training' ? ` (${r.focus}, ${r.duration}s, ${r.gpus} GPUs)`
          : r.phase === 'redteam' ? ` (cap ${r.capAfter.toFixed(2)}, score ${r.scores.reduce((x, y) => x + y, 0)}/40, issues ${r.issuesFound})` : '';
        out(t, `TRAIN ${r.name} → ${r.phase}${extra}`);
        if (r.phase === 'training' && !r.prologue) mark('firstTrainingStart', t);
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
        s2LotPresses = (s.stats.pressCounts['gpuLot'] ?? 0) - (pressesAtStart['gpuLot'] ?? 0);
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
      if (s.revealed['training'] === true && trainSlotFree(s) && s.training.cooldown <= 0 && gpusShort(s)) s2GpuBlockedTicks++;
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
      runGpus: s2RunGpus,
      longestRevealGap: Math.round(g.gap),
      longestRevealGapAt: [rel(g.at[0]), rel(g.at[1])],
      revealGapsOver120: g.over.map(([x, y]) => [rel(x), rel(y)]),
      lastTenGap: Math.round(last10.gap),
      lastTenGapAt: [rel(last10.at[0]), rel(last10.at[1])],
      mechanicGap: Math.round(mg.gap),
      mechanicGapAt: [rel(mg.at[0]), rel(mg.at[1])],
      reveals: s2Reveals.filter((x) => x <= stop).length,
      greyedGoalPct: s2Ticks ? Math.round((1000 * s2GreyTicks) / s2Ticks) / 10 : 0,
      gpuBlockedPct: s2Ticks ? Math.round((1000 * s2GpuBlockedTicks) / s2Ticks) / 10 : 0,
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
      lotLitPct: handsChecks ? Math.round((100 * lotLit) / handsChecks) : 0,
      trainReadyPct: trainIdleChecks ? Math.round((100 * trainReady) / trainIdleChecks) : 100,
      lotPresses: s2LotPresses ?? (s.stats.pressCounts['gpuLot'] ?? 0) - (pressesAtStart['gpuLot'] ?? 0),
      longestRelease: Math.round(Math.max(longestRelease, stop - lastCapAt)),
      longestReleaseAt: rel(longestRelease >= stop - lastCapAt ? longestReleaseAt : lastCapAt),
    };
    void s2LogStart;
  }

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
  if (emptySince !== null) emptyPanelMax = Math.max(emptyPanelMax, Math.min(end, milestones['reveal:training'] ?? end) - emptySince);
  if (greySince !== null) marketingGreyMax = Math.max(marketingGreyMax, horizon - greySince);
  const dcShownAt = milestones['shown:p_datacenter'];
  const wallAt = typeof s.flags['wallAt'] === 'number' ? (s.flags['wallAt'] as number) : null;
  const startGaps = s1Starts.slice(1).map((x, k) => x - s1Starts[k]!);
  const firstTrain = milestones['firstTrainingStart'];
  const densest = (times: number[]): number => {
    if (firstTrain === undefined) return 0;
    const to = (milestones['firstRelease'] ?? end) + 60;
    const ts = times.filter((x) => x >= firstTrain && x <= to);
    let most = 0;
    for (let a = 0, b = 0; b < ts.length; b++) {
      while (ts[b]! - ts[a]! > 26) a++;
      most = Math.max(most, b - a + 1);
    }
    return most;
  };
  const linesIn26 = densest(lineTimes);
  const linesIn26All = densest(allLineTimes);
  const s1x: Stage1Extra = {
    trainStarts: s1Starts.map((x) => Math.round(x - t0)),
    maxStartGap: startGaps.length ? Math.round(Math.max(...startGaps)) : null,
    firstRun: s1Starts.length ? Math.round(s1Starts[0]! - t0) : null,
    blocked: Object.fromEntries(Object.entries(blocked).map(([k, v]) => [k, Math.round(v)])),
    disabledIdle: Math.round(disabledIdle),
    dcOnScreen: dcShownAt !== undefined && transition !== null ? Math.round(transition - dcShownAt) : null,
    dcShare: dcShownAt !== undefined && transition !== null ? Math.round((100 * (transition - dcShownAt)) / Math.max(1, transition - t0)) : null,
    delayed: delayedBuys,
    unprinted: unprintedBuys,
    capBeforeTraining: Math.round(capBeforeTraining),
    emptyPanelMax: Math.round(emptyPanelMax),
    marketingGreyMax: Math.round(marketingGreyMax),
    dollarGapMax: dcShownAt !== undefined ? Math.round(longestGap(dollarBuys, dcShownAt, wallAt ?? horizon).gap) : null,
    linesIn26,
    linesIn26All,
  };
  const summary: Summary = {
    seed: args.seed,
    policy: args.policy,
    s1x,
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
    runGpus: runGpus1,
    gpuBlockedMax: Math.round(Math.max(gpuBlockedMax, gpuBlockedSince !== null ? end - gpuBlockedSince : 0)),
    gpuBlockedAt: Math.round(gpuBlockedAt),
    modals,
    minModalSpacing: autoModalTimes.length < 2 ? null
      : Math.round(Math.min(...autoModalTimes.slice(1).map((x, i) => x - autoModalTimes[i]!))),
    research: milestones['reveal:research'] ?? null,
    projects: milestones['reveal:projects'] ?? null,
    grid: milestones['buy:p_grid'] ?? null,
    datacenterShown: milestones['shown:p_datacenter'] === undefined ? null : Math.round(milestones['shown:p_datacenter']),
    wallToDc: transition !== null && typeof s.flags['wallAt'] === 'number' ? Math.round(transition - (s.flags['wallAt'] as number)) : null,
    latencyMedian: s1Latency.length ? median(s1Latency.map(([, v]) => v)) : null,
    latencyWithin10Pct: s1Latency.length ? Math.round((100 * s1Latency.filter(([, v]) => v <= 10).length) / s1Latency.length) : 0,
    latencies: s1Latency,
    maxReveals6min,
    maxReveals6minAt,
    exitState1: s1Snap,
    choices1: s1Choices,
    s2,
    s3: t3.summary(s, actionTimes),
    s4: t4.summary(s, actionTimes),
    s5: t5.summary(s, actionTimes),
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
  console.log(`G34 whole lot lit         ${sum.lotLitPct}% of checks; Train pressable or armed ${sum.trainReadyPct}% of its idle time; ${sum.lotPresses} lot presses   (≥ 35%; ≥ 80%; ≤ 250)${ok(sum.lotLitPct >= 35 && sum.trainReadyPct >= 80 && sum.lotPresses <= 250)}`);
  console.log(`G26 longest release gap   ${clock(sum.longestRelease)} from ${clock(sum.longestReleaseAt)}   (≤ 5:30)${ok(sum.longestRelease <= 330)}`);
  console.log(`   mechanics              ${sum.mechanics.join(' · ')}`);
  console.log(`A5 training runs          ${sum.runs}   (10–12)`);
  console.log(`A6 interval between starts mean ${sum.intervalMean ?? '—'} s, max ${sum.intervalMax ?? '—'} s   (mean 180–300, max ≤ 330)`);
  console.log(`   training starts        ${sum.trainStarts.map((x) => fmtClock(x)).join(' ')}`);
  console.log(`   longest interval held by ${sum.longestIntervalBlockers || '—'}`);
  console.log(`A7 run durations          ${sum.durationMin ?? '—'}–${sum.durationMax ?? '—'} s; GPUs needed ${sum.runGpus.join(' / ')}   (60–110)`);
  console.log(`   Train blocked for GPUs ${sum.gpuBlockedPct}% of the stage   (bot ≤ 5 %, trainfirst ≤ 25 %)`);
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

function skinTest(args: Args): void {
  const variant = [args.variant, 'answers-silence'].filter(Boolean).join(',');
  const a = simulate({ ...args, variant, quiet: true });
  const b = simulate({ ...args, variant: `${variant},flip`, quiet: true });
  const sa = a.summary.s5?.screens ?? [];
  const sb = b.summary.s5?.screens ?? [];
  const n = Math.min(sa.length, sb.length);
  let same = 0;
  const diffs: string[] = [];
  for (let k = 0; k < n; k++) {
    if (sa[k]!.values === sb[k]!.values) same++;
    else diffs.push(`${fmtClock(sa[k]!.t)}: ${sa[k]!.values}\n      ${sb[k]!.values}`);
  }
  console.log(`\n== D7 the skins are equal (preset ${args.preset}, seed ${args.seed}): ${a.summary.s5?.skin} and ${b.summary.s5?.skin} ==`);
  console.log(`   five-minute marks before swarm 0.006%: ${same} of ${n} identical${diffs.length ? '  <-- MISS' : ''}`);
  for (const d of diffs) console.log(`   ${d}`);
  console.log(`   endings: ${a.summary.s5?.ending} at ${fmtClock(a.summary.s5?.duration ?? 0)}; ${b.summary.s5?.ending} at ${fmtClock(b.summary.s5?.duration ?? 0)}`);
  void screenValues;
  void swarmReached;
  void ROWS_TAKEN_AT;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.skinTest) {
    skinTest(args);
    return;
  }
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
  if (args.preset === '1') {
    console.log(`\n== Stage 1 milestones (policy ${args.policy}, seed ${args.seed}) ==`);
    console.log(`first GPU                ${fmt('firstGpu')}   (target ≤ 0:20)`);
    console.log(`Research panel           ${fmt('reveal:research')}`);
    console.log(`Projects panel           ${fmt('reveal:projects')}`);
    console.log(`Grid Contract bought     ${fmt('buy:p_grid')}   (target bot 9:00–13:00; after ${GRID_CONTRACT_PRESSES} Buy Power presses)`);
    console.log(`Sage-1 train / deploy   ${fmt('prologueStart')} / ${fmt('sageLive')}`);
    console.log(`first training start     ${fmt('firstTrainingStart')}`);
    console.log(`first release            ${fmt('firstRelease')}`);
    console.log(`Anthrosoft arrives       ${fmt('reveal:rival')}   (the first event, a minute after the first release)`);
    console.log(`Series A bought          ${fmt('buy:p_series_a')}`);
    console.log(`First Datacenter shown   ${clock(sum.datacenterShown)}; bought ${sum.wallToDc === null ? 'before the wall' : `${sum.wallToDc} s after the wall`}   (bot 60–150 s, trainfirst ≤ 240 s)`);
    console.log(`TRANSITION (First Datacenter) ${clock(sum.transition)}   (target bot 20:00–26:00, naive / greedy / trainfirst 22:00–30:00)`);
    console.log(`capability at transition ${sum.capabilityAtTransition ?? '—'}   (target 1.5–1.8)`);
    console.log(`LONGEST REVEAL GAP       ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)})   (target ≤ 180 s)`);
    console.log(`reveal gaps > 120 s      ${sum.revealGapsOver120.length ? sum.revealGapsOver120.map(span).join(', ') : 'none'}`);
    console.log(`LONGEST NOVELTY GAP      ${sum.longestNoveltyGap} s (${span(sum.longestNoveltyGapAt)})`);
    console.log(`Buy Power presses        ${sum.powerPresses} (worst 5-min window ${sum.worstPressWindow})   (target ${GRID_CONTRACT_PRESSES}–60, ≤ 15)`);
    console.log(`idle rescues             ${sum.idleRescues} (at 0 tasks: ${sum.rescuesAtZeroTasks})   (target ≤ 2, none at 0)`);
    console.log(`soft-locks               ${sum.softLocks.length ? sum.softLocks.map(span).join(', ') : 'none'}`);
    console.log(`training runs            ${sum.runs}; GPUs needed ${sum.runGpus.join(' / ')}`);
    console.log(`Train blocked by GPUs    longest ${clock(sum.gpuBlockedMax)} from ${clock(sum.gpuBlockedAt)}   (target ≤ 4:00)`);
    console.log(`modals                   ${sum.modals} (min spacing ${sum.minModalSpacing ?? '—'} s)   (target 7–9, ≥ 150 s apart)`);
    console.log(`reveal → purchase        median ${sum.latencyMedian ?? '—'} s, ${sum.latencyWithin10Pct}% within 10 s (${sum.latencies.length} projects)   (target bot ≥ 90, naive ≥ 60; ≤ 10 %)`);
    console.log(`densest six minutes      ${sum.maxReveals6min} first-time reveals from ${fmtClock(sum.maxReveals6minAt)}   (target ≤ 16)`);
    const x1 = sum.s1x;
    console.log(`run starts               ${x1.trainStarts.map((v) => fmtClock(v)).join(' ')}; longest gap ${clock(x1.maxStartGap)}   (first by 6:45; ≤ 5:00 apart reading delays, ≤ 8:00 buying everything)`);
    console.log(`Train blocked by         ${Object.entries(x1.blocked).map(([k, v]) => `${k} ${v} s`).join(', ') || 'nothing'}; disabled with nothing training ${x1.disabledIdle} s before the wall   (research 0; ≤ 60)`);
    console.log(`First Datacenter         on screen ${clock(x1.dcOnScreen)} before its purchase, ${x1.dcShare ?? '—'}% of the stage   (≥ 8:00, ≤ 50%)`);
    console.log(`delays                   ${x1.delayed} purchases delayed the wait 10 s or more, ${x1.unprinted} with no delay on their row   (0 unprinted)`);
    console.log(`minutes 3–7              research at the cap ${x1.capBeforeTraining} s, Projects empty ${x1.emptyPanelMax} s at most   (≤ 60, ≤ 15)`);
    console.log(`money's second half      Marketing grey ${x1.marketingGreyMax} s at most; longest gap between dollar buys, card to wall ${x1.dollarGapMax ?? '—'} s   (≤ 180, ≤ 180)`);
    console.log(`first training cycle     ${x1.linesIn26} console lines in the densest 26 s, ${x1.linesIn26All} with the replies to purchases   (≤ 4)`);
    const x = sum.exitState1;
    if (x) console.log(`exit state               capability ${x.capability}, alignment ${x.alignTrue} true / ${x.alignApparent} apparent, Trust ${x.trust}, ${x.researchers} researchers, lab ${x.labSpace}, marketing ${x.hypeLevel}, ${x.contracts} contracts ($${x.contractRate}/s of $${x.revPerSec}/s), price $${x.price}, ${x.gpus} GPUs, ${x.incidents} incidents`);
    if (sum.choices1.length) console.log(`modal answers            ${sum.choices1.join(', ')}`);
  }
  if (sum.s2) printStage2(sum.s2);
  if (sum.s3) printStage3(sum.s3, args.policy);
  if (sum.s4) printStage4(sum.s4, args.policy, args.preset);
  if (sum.s5) printStage5(sum.s5, args.policy, args.variant);
  if (args.preset === '1' && result.state.stage >= 2) printWholeGame(result.state);
  console.log(`IDLE GAPs > 60 s         ${result.idleGaps.length ? result.idleGaps.map(span).join(', ') : 'none'}`);
}

if (process.argv[1] && /bot\.js$/.test(process.argv[1])) main();
