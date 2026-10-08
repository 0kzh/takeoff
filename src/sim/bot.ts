import { newGame, GameState, serialize } from '../engine/state.js';
import { step, actions } from '../engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from './policy.js';
import { noveltyKeys, isRescueKey, PLAYER_MODALS, choiceById, optionCost } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { GRID_CONTRACT_PRESSES } from '../data/projects.js';
import {
  researchCap, copies, copiesIdle, bestCapability, marketingCost, contractRate, powerBlockCost, gpuCost, rentQuota, atRentQuota, gpuCapacity,
} from '../engine/economy.js';
import {
  trainCost, canStartTraining, gpusShort, trainSlotFree, canPressTrain, needsDatacenter, gpusNeeded, runDelaySeconds,
} from '../engine/training.js';
import { fmtInt, fmtMoney, fmtMw, fmtClock, dateLabel } from '../engine/format.js';

declare const process: { argv: string[]; exitCode?: number };

interface Args {
  minutes: number;
  seed: number;
  quiet: boolean;
  json: boolean;
  policy: PolicyName;
  stopAtStage: number;
  variant: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { minutes: 60, seed: 1, quiet: false, json: false, policy: 'bot', stopAtStage: 0, variant: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--minutes' && v) args.minutes = Number(v);
    if (k === '--seed' && v) args.seed = Number(v);
    if (k === '--stop-at-stage' && v) args.stopAtStage = Number(v);
    if (k === '--variant' && v) args.variant = v;
    if (k === '--policy' && (v === 'bot' || v === 'naive' || v === 'greedy' || v === 'trainfirst')) args.policy = v;
    if (k === '--quiet') args.quiet = true;
    if (k === '--json') args.json = true;
  }
  return args;
}

const RESCUE_PROJECTS = ['p_beg_power', 'p_press'];
const RESCUE_CHOICES = ['c_customer_email'];

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

export interface SimResult {
  state: GameState;
  milestones: Record<string, number>;
  idleGaps: [number, number][];
  lines: string[];
  summary: Summary;
  stage2Lines: string[];
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

function trainBlockedBy(s: GameState): string {
  if (!s.revealed['training'] || s.training.run || canStartTraining(s)) return '';
  if (needsDatacenter(s)) return 'wall';
  if (gpusShort(s)) return gpusNeeded(s) > rentQuota(s) || atRentQuota(s) ? 'quota' : 'gpus';
  if ((trainCost(s).funds ?? 0) > s.funds) return 'money';
  return 'other';
}

export function simulate(args: Args): SimResult {
  const s = newGame(args.seed);
  const mem = newBotMemory(args.policy, false, args.variant);
  const lines: string[] = [];
  const milestones: Record<string, number> = {};
  const idleGaps: [number, number][] = [];
  const out = (t: number, text: string) => lines.push(`${fmtClock(t)}  ${text}`);
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
  const s2Reveals: [number, string][] = [];
  const s2Starts: number[] = [];
  const s2Modals: [number, string][] = [];
  const s2Buys: [number, string][] = [];
  let stage3At: number | null = null;
  let s2EndState: GameState | null = null;

  const s1ShownAt = new Map<string, number>();
  const s1BoughtSeen = new Set<string>();
  const s1Latency: [string, number][] = [];
  let s1Snap: ExitState1 | null = null;
  const s1Choices: string[] = [];

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
  let linesSeen = s.stats.consoleLines;
  const s1Starts: number[] = [];
  let govSeen = s.cadence.governed.length;
  let releasesSeen = s.stats.releases;

  let prevKeys = new Set<string>();
  let lastNovelty = 0;
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
  };
  for (const [id, on] of Object.entries(s.revealed)) {
    if (on) {
      seenFlags.add(id);
      revealTimes.push(0);
    }
  }
  for (const [id, st] of Object.entries(s.projects)) if (st.shown || st.bought) seenProjects.add(id);

  for (let i = 0; i < totalTicks; i++) {
    const linesBefore = s.stats.consoleLines;
    policyStep(s, tracked, mem);
    replyLines += s.stats.consoleLines - linesBefore;
    step(s);
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
      const grey = t >= 300 && s.revealed['marketing'] === true && s.funds < marketingCost(s);
      if (grey && greySince === null) greySince = t;
      if (!grey && greySince !== null) {
        marketingGreyMax = Math.max(marketingGreyMax, t - greySince);
        greySince = null;
      }
      const lines = s.stats.consoleLines;
      for (; linesSeen < lines; linesSeen++) {
        allLineTimes.push(t);
        if (replyLines > 0) replyLines--;
        else lineTimes.push(t);
      }
      const blockedGpu = s.revealed['training'] === true && trainSlotFree(s) && gpusShort(s);
      if (blockedGpu && gpuBlockedSince === null) gpuBlockedSince = t;
      if (!blockedGpu && gpuBlockedSince !== null) {
        if (t - gpuBlockedSince > gpuBlockedMax) {
          gpuBlockedMax = t - gpuBlockedSince;
          gpuBlockedAt = gpuBlockedSince;
        }
        gpuBlockedSince = null;
      }
    } else if (gpuBlockedSince !== null) {
      if (t - gpuBlockedSince > gpuBlockedMax) {
        gpuBlockedMax = t - gpuBlockedSince;
        gpuBlockedAt = gpuBlockedSince;
      }
      gpuBlockedSince = null;
    }
    for (const id of mem.bought) {
      out(t, `BUY ${projectById(id)?.title ?? id}`);
      mark(`buy:${id}`, t);
      noveltyTimes.push(t);
      if (s.stage >= 2) s2Buys.push([t, id]);
    }
    for (const [id, on] of Object.entries(s.revealed)) {
      if (on && !seenFlags.has(id)) {
        seenFlags.add(id);
        reveal(t, `REVEAL ${id}`);
        mark(`reveal:${id}`, t);
        if (s.stage >= 2) s2Reveals.push([t, id]);
      }
    }
    const visible = visibleProjects(s);
    for (const p of visible) {
      if (!prevShown.has(p.id)) {
        out(t, `PROJECT shown: ${p.title}`);
        mark(`shown:${p.id}`, t);
        if (!seenProjects.has(p.id) && !RESCUE_PROJECTS.includes(p.id)) {
          seenProjects.add(p.id);
          revealTimes.push(t);
          noveltyTimes.push(t);
          if (s.stage >= 2) s2Reveals.push([t, `proj:${p.id}`]);
        }
      }
    }
    prevShown = new Set(visible.map((p) => p.id));
    if (s.activeChoice && s.activeChoice !== prevChoice && !countedChoices.has(s.activeChoice)) {
      countedChoices.add(s.activeChoice);
      if (s.stage === 1) {
        modals++;
        if (!PLAYER_MODALS.includes(s.activeChoice.id)) autoModalTimes.push(t);
      }
    }
    prevChoice = s.activeChoice;
    const run = s.training.run;
    const queued = s.training.next;
    for (const r of [run, queued]) {
      if (r && !prevRunIds.has(r.id)) {
        prevRunIds.add(r.id);
        if (r.prologue) mark('prologueStart', t);
        else if (s.stage === 1) {
          runs++;
          runGpus1.push(r.gpus);
          s1Starts.push(t);
          dollarBuys.push(t);
        } else {
          s2Starts.push(t);
          out(t, `TRAIN ${r.name} started (${r.focus}, ${r.duration}s, ${fmtInt(r.gpus)} GPUs, cap ${r.capBefore.toFixed(2)}${queued && r === queued ? ', queued' : ''})`);
        }
      }
    }
    if (prevRunIds.size > 50) prevRunIds = new Set([...prevRunIds].slice(-10));
    const choice = s.activeChoice?.id;
    if (choice && !seenChoices.has(choice)) {
      seenChoices.add(choice);
      if (!RESCUE_CHOICES.includes(choice)) reveal(t, `MODAL ${choice}`);
      else out(t, `MODAL ${choice}`);
      if (s.stage >= 2) s2Modals.push([t, choice]);
    }
    if (s.gpus >= 1) mark('firstGpu', t);
    if (typeof s.flags['sageLiveAt'] === 'number') mark('sageLive', t);
    if (s.stats.powerPresses > prevPowerPresses) {
      for (let k = prevPowerPresses; k < s.stats.powerPresses; k++) pressTimes.push(t);
      prevPowerPresses = s.stats.powerPresses;
    }

    const phase = run ? `${run.name}:${run.phase}` : '';
    if (phase !== prevPhase) {
      if (run && !prevPhase.includes(phase)) {
        const extra = run.phase === 'training' ? ` (${run.focus}, ${run.duration}s, ${run.gpus} GPUs)`
          : run.phase === 'redteam' ? ` (cap ${run.capAfter.toFixed(2)}, score ${run.scores.reduce((x, y) => x + y, 0)}/40, issues ${run.issuesFound})` : '';
        out(t, `TRAIN ${run.name} → ${run.phase}${extra}`);
        if (run.phase === 'training' && !run.prologue) mark('firstTrainingStart', t);
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
    if (s.stage !== prevStage) {
      out(t, `STAGE ${prevStage} → ${s.stage} (${dateLabel(s.date)})`);
      mark(`stage${s.stage}`, t);
      if (s.stage === 2) {
        transition = t;
        capAtTransition = s.capability;
      }
      if (s.stage === 3) {
        stage3At = t;
        s2EndState = JSON.parse(serialize(s)) as GameState;
      }
      prevStage = s.stage;
      if (args.stopAtStage && s.stage >= args.stopAtStage) break;
    }
    while (prevLog < s.log.length) {
      const e = s.log[prevLog++]!;
      out(t, `LOG ${e.date} — ${e.text}`);
    }
    if (s.log.length < prevLog) prevLog = s.log.length;
    if (s.stats.choices > prevChoices) {
      const c = s.choicesMade[s.choicesMade.length - 1]!;
      if (s.stage === 1) s1Choices.push(`${c.id}:${c.option}`);
      out(t, `CHOICE ${c.id} → ${c.option}`);
      prevChoices = s.stats.choices;
    }
    if (s.stats.idleRescues > prevRescues) {
      out(t, `IDLE RESCUE #${s.stats.idleRescues} (tasks ${fmtInt(s.tasks)})`);
      if (s.tasks <= 0) rescuesAtZero++;
      if (s.stage === 1) stage1Rescues++;
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
    const keys = noveltyKeys(s).filter((k) => !isRescueKey(k));
    if (keys.some((k) => !prevKeys.has(k))) {
      if (t - lastNovelty > 60) {
        idleGaps.push([lastNovelty, t]);
        out(t, `IDLE GAP ${fmtClock(lastNovelty)}–${fmtClock(t)}`);
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
  const rg = longestGap(revealTimes, 0, horizon);
  const ng = longestGap(noveltyTimes, 0, horizon);
  const stage1Presses = pressTimes.filter((t) => t <= horizon);
  let worstWindow = 0;
  for (let k = 0; k < stage1Presses.length; k++) {
    let n = 0;
    while (k + n < stage1Presses.length && stage1Presses[k + n]! - stage1Presses[k]! < 300) n++;
    worstWindow = Math.max(worstWindow, n);
  }

  const s1Reveals = revealTimes.filter((x) => x > 0 && x <= horizon).sort((x, y) => x - y);
  let maxReveals6min = 0;
  let maxReveals6minAt = 0;
  for (let a = 0, b = 0; b < s1Reveals.length; b++) {
    while (s1Reveals[b]! - s1Reveals[a]! > 360) a++;
    if (b - a + 1 > maxReveals6min) {
      maxReveals6min = b - a + 1;
      maxReveals6minAt = Math.round(s1Reveals[a]!);
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
    trainStarts: s1Starts.map((x) => Math.round(x)),
    maxStartGap: startGaps.length ? Math.round(Math.max(...startGaps)) : null,
    firstRun: s1Starts.length ? Math.round(s1Starts[0]!) : null,
    blocked: Object.fromEntries(Object.entries(blocked).map(([k, v]) => [k, Math.round(v)])),
    disabledIdle: Math.round(disabledIdle),
    dcOnScreen: dcShownAt !== undefined && transition !== null ? Math.round(transition - dcShownAt) : null,
    dcShare: dcShownAt !== undefined && transition !== null ? Math.round((100 * (transition - dcShownAt)) / Math.max(1, transition)) : null,
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
  };
  const s2 = transition !== null ? stage2Report(s2EndState ?? s, transition, stage3At ?? end, s2Reveals, s2Starts, s2Modals, s2Buys, idleGaps, args.policy) : [];
  return { state: s, milestones, idleGaps, lines, summary, stage2Lines: s2 };
}

function stage2Report(
  s: GameState,
  from: number,
  to: number,
  reveals: [number, string][],
  starts: number[],
  modals: [number, string][],
  buys: [number, string][],
  idleGaps: [number, number][],
  policy: PolicyName,
): string[] {
  const out: string[] = [];
  const stageClock = (t: number) => fmtClock(t - from);
  out.push(`\n== Stage 2 (policy ${policy}, seed ${s.seed}) ==`);
  out.push(`arrival ${fmtClock(from)}; ${s.stage >= 3 ? `Automate the Lab at ${fmtClock(to)} (stage time ${stageClock(to)})` : `still in Stage ${s.stage} at ${fmtClock(to)} (stage time ${stageClock(to)})`}   (target 38:00–48:00 of stage time)`);
  out.push(`end state: capability ${s.capability.toFixed(2)} / internal ${s.training.internalCapability.toFixed(2)}, rev/s ${fmtMoney(s.stats.revPerSec)}, gpus ${fmtInt(s.gpus)} (G${3 + s.chipGen}, ${s.datacenters} dc, tier ${s.dcTier}), grid ${fmtMw(s.gridCapacity)} MW, data ${(s.data.stock + s.data.synthetic).toFixed(1)}T, approval ${s.approval.toFixed(0)}, tempo ${s.tempo.toFixed(0)}, align ${s.alignmentTrue.toFixed(0)} true / ${s.alignmentApparent.toFixed(0)} ± ${s.alignmentBand.toFixed(0)}, baiwen ${s.baiwen.present ? s.baiwen.capability.toFixed(2) : '—'}, anthrosoft ${s.rivalCapability.toFixed(2)}, security SL${s.security}`);
  out.push(`runs: ${starts.length}; starts at ${starts.map(stageClock).join(' ')}`);
  const gaps = starts.slice(1).map((x, i) => x - starts[i]!);
  out.push(`run start gaps: longest ${gaps.length ? fmtClock(Math.max(...gaps)) : '—'} (target ≤ 5:00)`);
  out.push(`reveals (${reveals.length}): ${reveals.map(([t, id]) => `${stageClock(t)} ${id}`).join(', ')}`);
  const rt = reveals.map(([t]) => t);
  const rg = longestGap([...rt, ...modals.map(([t]) => t)], from, to);
  out.push(`longest reveal/modal gap in stage 2: ${fmtClock(rg.gap)} (${stageClock(rg.at[0])}–${stageClock(rg.at[1])})   (target ≤ 4:00)`);
  out.push(`modals (${modals.length}): ${modals.map(([t, id]) => `${stageClock(t)} ${id}`).join(', ')}`);
  const mt = modals.map(([t]) => t);
  const spacing = mt.slice(1).map((x, i) => x - mt[i]!);
  out.push(`modal spacing: min ${spacing.length ? fmtClock(Math.min(...spacing)) : '—'}`);
  out.push(`buys (${buys.length}): ${buys.map(([t, id]) => `${stageClock(t)} ${id}`).join(', ')}`);
  const s2Idle = idleGaps.filter(([a, b]) => b > from && a < to);
  out.push(`idle gaps > 60 s in stage 2: ${s2Idle.length ? s2Idle.map(([a, b]) => `${stageClock(Math.max(a, from))}–${stageClock(Math.min(b, to))}`).join(', ') : 'none'}`);
  out.push(`choices: ${s.choicesMade.filter((c) => c.id.startsWith('c_') && !['c_gamble', 'c_ship_issues', 'c_sage2', 'c_customer_email'].includes(c.id)).slice(-20).map((c) => `${c.id}:${c.option}`).join(', ')}`);
  return out;
}

function minuteLine(s: GameState, minute: number): string {
  const vis = visibleProjects(s)
    .map((p) => `${p.title}${p.canAfford(s) ? '*' : ''}`)
    .join(', ');
  const run = s.training.run;
  const training = run ? ` | ${run.name} ${run.phase}` : '';
  const s2 = s.stage >= 2 ? ` | dc ${s.datacenters} (${fmtInt(gpuCapacity(s))}) | grid ${fmtMw(s.gridCapacity)} MW | G${3 + s.chipGen} | data ${(s.data.stock + s.data.synthetic).toFixed(0)}T | appr ${s.approval.toFixed(0)} | tempo ${s.tempo.toFixed(0)} | align ${s.alignmentApparent.toFixed(0)}±${s.alignmentBand.toFixed(0)} | bw ${s.baiwen.present ? s.baiwen.capability.toFixed(2) : '—'}` : '';
  return (
    `m${minute} | S${s.stage} ${dateLabel(s.date)} | tasks ${fmtInt(s.tasks)} | ${fmtMoney(s.funds)} | rev/s ${fmtInt(s.stats.revPerSec)}` +
    ` | price ${s.price < 0.1 ? s.price.toFixed(4) : s.price.toFixed(2)} | gpus ${fmtInt(s.gpus)} | copies ${fmtInt(copies(s))} | tps ${fmtInt(s.stats.tasksPerSec)}` +
    ` | research ${fmtInt(s.research)}/${fmtInt(researchCap(s))} | insight ${Math.floor(s.insight)} | trust ${s.trust}` +
    ` | res ${s.researchers} lab ${s.labSpace} | mkt ${s.hypeLevel} | cap ${s.capability.toFixed(2)}/${bestCapability(s).toFixed(2)}${training}${s2}` +
    ` | visible: ${vis || '—'}`
  );
}

const clock = (t: number | null) => (t === null ? '—' : fmtClock(t));
const span = ([a, b]: [number, number]) => `${fmtClock(a)}–${fmtClock(b)}`;

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
  console.log(`IDLE GAPs > 60 s         ${result.idleGaps.length ? result.idleGaps.map(span).join(', ') : 'none'}`);
  for (const line of result.stage2Lines) console.log(line);
}

if (process.argv[1] && /bot\.[tj]s$/.test(process.argv[1])) main();
