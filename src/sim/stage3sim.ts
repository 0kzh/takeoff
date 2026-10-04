import { GameState, isBought, counter } from '../engine/state.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { enabledPurchasesS3 } from '../engine/stage3.js';
import { MECHANIC_FLAGS_S3, STAGE3_TABLE } from '../data/stage3.js';
import { bestCapability, researchRate } from '../engine/economy.js';
import { trainSlotFree, gpusShort, researchUnit, EXPERIMENTS_MAX } from '../engine/training.js';
import { rogueShare } from '../engine/alignment.js';
import { seats, lobbyCost, counterintelCost, paymentsLevel, PAYMENT_MAX } from '../engine/world3.js';
import { voteReady } from '../engine/oversight.js';
import { LOT_SIZES_S3, orderReasonS3, lotCostOf } from '../engine/infrastructure.js';
import { PLAYER_MODALS } from '../engine/events.js';
import { fmtClock, fmtInt, fmtMoney, fmtNum } from '../engine/format.js';

/**
 * The sim's Stage 3 block (stage3.md §9.3): everything the acceptance table measures that a headless
 * run can see. One tracker per run; `tick` after every engine step while the run is in Stage 3.
 */

export interface Mark3 {
  t: number;
  gpus: number;
  gw: number;
  tasksPerSec: number;
  revenue: number;
  funds: number;
  capability: number;
  researchPerSec: number;
  autonomy: number;
  alignTrue: number;
  alignMeasured: number;
  roguePct: number;
  lead: number;
  seats: number;
  approval: number;
  jobs: number;
  /** Funds over revenue: seconds of income in hand (B15). */
  fundsSeconds: number;
  /** Repeatables enabled now, by currency (B30). */
  researchSinks: number;
  revenueSinks: number;
}

export interface ExitState3 {
  capability: number;
  alignTrue: number;
  alignApparent: number;
  autonomy: number;
  interpretability: number;
  lostToDrift: number;
  lead: number;
  seats: number;
  gov: number;
  approval: number;
  jobs: number;
  tasks: number;
  gpus: number;
  monitorShare: number;
  securityLevel: number;
  memo: string;
  neuralese: string;
  choice: string;
  publicCap: number;
  escalated: boolean;
  backChannel: boolean;
  conceded: boolean;
  breakouts: number;
  orders: number;
  majorIncidents: number;
}

export interface Stage3Summary {
  duration: number | null;
  exitHow: string;
  capabilityAtVote: number | null;
  capabilityAtExit: number;
  runs: number;
  trainStarts: number[];
  intervalMean: number | null;
  intervalMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  runGpus: number[];
  reveals: number;
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  lastTenGap: number;
  lastTenGapAt: [number, number];
  mechanicGap: number;
  mechanicGapAt: [number, number];
  mechanics: string[];
  maxReveals6min: number;
  governor: string[];
  idleRescues: number;
  modals: number;
  modalIds: string[];
  minModalSpacing: number | null;
  greyedGoalPct: number;
  twoGoalsLast10Pct: number;
  pressesBefore: Record<string, number>;
  choreWorst: string;
  ending: string;
  crises: string[];
  firstChoice: number | null;
  exitGoalsBefore: number | null;
  rogueMaxPct: number;
  latencyMedian: number | null;
  latencyWithin10Pct: number;
  latencyCount: number;
  consoleMax5: number;
  logMax5: number;
  repeatedLines: string[];
  handsNonePct: number;
  handsTwoPct: number;
  clickGapPct: number;
  longestCapStep: number;
  longestCapStepAt: number;
  gpuBlockedPct: number;
  removedGained: string[];
  deadGrey: string[];
  marks: Mark3[];
  exitState: ExitState3 | null;
  choices: string[];
}

/** Mechanic modals (the content table's `mechanic: true` choice rows) and the vote. */
const MECHANIC_MODALS = [...STAGE3_TABLE.filter((r) => r.kind === 'choice' && r.mechanic).map((r) => r.id), 'c_vote'];
/** Projects that are verbs rather than cards: the Pause (§4.3 counts it among the mechanics). */
const MECHANIC_PROJECTS = ['p_pause'];

/** What each crisis's mitigation is, as a key of `cadence.seen` (B14: on screen ≥ 300 s before). */
const MITIGATION: Record<string, string[]> = {
  cr_weights_theft: ['f:sl3Button'],
  cr_spy: ['p:p_sl4'],
  cr_rogue_copy: ['f:monitors'],
  cr_riots: ['f:jobFund', 'f:payments', 'p:p_clinics'],
  cr_sabotage: ['f:jobFund', 'f:payments', 'p:p_clinics'],
  cr_taiwan: ['p:p_stockpile', 'p:p_second_source'],
  cr_iran: ['f:marsa', 'c:c_hormuz'],
  cr_leak: ['c:c_memo', 'p:p_come_clean'],
  cr_nationalization: ['c:c_order'],
};

/** What a grant (or the order) takes away, for the REMOVED → GAINED log (B31). */
const REMOVES: Record<string, string> = {
  p_auto_train: 'Train',
  p_auto_redteam: 'Red-team',
  p_buildout: 'Build Datacenter, Reactor',
  p_auto_approve: 'Approve, Send back',
};

function longestGap(times: number[], start: number, end: number): { gap: number; at: [number, number] } {
  const sorted = times.filter((t) => t >= start && t <= end).sort((x, y) => x - y);
  let gap = 0;
  let at: [number, number] = [start, start];
  let prev = start;
  for (const t of [...sorted, end]) {
    if (t - prev > gap) {
      gap = t - prev;
      at = [prev, t];
    }
    prev = t;
  }
  return { gap, at };
}

function maxInWindow(times: number[], window: number): number {
  const v = [...times].sort((x, y) => x - y);
  let best = 0;
  for (let a = 0, b = 0; b < v.length; b++) {
    while (v[b]! - v[a]! > window) a++;
    best = Math.max(best, b - a + 1);
  }
  return best;
}

function median(xs: number[]): number {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : Math.round((v[m - 1]! + v[m]!) / 2);
}

export class Stage3Tracker {
  start: number | null = null;
  end: number | null = null;
  exitHow = '';
  private seenLen = 0;
  private seenAt = new Map<string, number>();
  private reveals: number[] = [];
  private mechanics: [number, string][] = [];
  private governed = 0;
  private governorLines: string[] = [];
  private rescues0 = 0;
  private modalTimes: number[] = [];
  private modalIds: string[] = [];
  private prevChoice: unknown = null;
  private ticks = 0;
  private greyTicks = 0;
  private last10Ticks = 0;
  private last10Two = 0;
  private trainStarts: number[] = [];
  private durations: number[] = [];
  private runGpus: number[] = [];
  private seenRuns = new Set<number>();
  private crisisCounts: Record<string, number> = {};
  private crises: string[] = [];
  private firstChoice: number | null = null;
  private goalsShownAt: number | null = null;
  private voteAt: number | null = null;
  private capAtVote: number | null = null;
  private rogueMax = 0;
  private shownAt = new Map<string, number>();
  private latencies: number[] = [];
  private consoleTimes: number[] = [];
  private logTimes: number[] = [];
  private lineCounts = new Map<string, number>();
  private console0 = 0;
  private log0 = 0;
  private handsChecks = 0;
  private handsNone = 0;
  private handsTwo = 0;
  private lastCap = 0;
  private lastCapAt = 0;
  private longestCap = 0;
  private longestCapAt = 0;
  private gpuBlockedTicks = 0;
  private removed: string[] = [];
  private boughtSeen = new Set<string>();
  private visibleTicks = new Map<string, number>();
  private affordTicks = new Map<string, number>();
  private marks: Mark3[] = [];
  private nextMark = 0;
  private presses0: Record<string, number> = {};
  private pressTimes: Record<string, number[]> = {};
  private prevPresses: Record<string, number> = {};
  private offeredAt: Record<string, number> = {};
  private exitState: ExitState3 | null = null;
  private choices: string[] = [];
  private choices0 = 0;
  private prevRevealed: Record<string, boolean> = {};

  /** Call after every step. */
  tick(s: GameState, actionTimes: number[]): void {
    const t = s.stats.timePlayed;
    if (this.start === null) {
      if (s.stage !== 3) return;
      this.begin(s, t);
    }
    if (this.end !== null) return;
    if (s.stage !== 3 || s.ending) {
      this.finish(s, t);
      return;
    }
    const ts = t - this.start!;
    this.ticks++;

    // First-time reveals, as the engine's own `cadence.seen` records them.
    const seen = s.cadence.seen;
    for (; this.seenLen < seen.length; this.seenLen++) {
      const key = seen[this.seenLen]!;
      if (!this.seenAt.has(key)) this.seenAt.set(key, t);
      if (this.countsAsReveal(key)) this.reveals.push(t);
      const id = key.slice(2);
      if ((key.startsWith('f:') && MECHANIC_FLAGS_S3.includes(id)) || (key.startsWith('c:') && MECHANIC_MODALS.includes(id))
        || (key.startsWith('p:') && MECHANIC_PROJECTS.includes(id))) this.mechanics.push([t, id]);
    }
    while (this.governed < s.cadence.governed.length) {
      const g = s.cadence.governed[this.governed++]!;
      const [at, ...rest] = g.split(':');
      if (Number(at) >= this.start! - 1) this.governorLines.push(`${fmtClock(Number(at) - this.start!)} ${rest.join(':')}`);
    }
    if (s.activeChoice && s.activeChoice !== this.prevChoice) {
      this.modalIds.push(s.activeChoice.id);
      if (!PLAYER_MODALS.includes(s.activeChoice.id) && s.activeChoice.id !== 'c_vote') this.modalTimes.push(t);
    }
    this.prevChoice = s.activeChoice;

    // Runs.
    for (const r of [s.training.run, s.training.pending]) {
      if (!r || this.seenRuns.has(r.id)) continue;
      this.seenRuns.add(r.id);
      if (r.phase === 'training' && !r.sentBack) {
        this.trainStarts.push(t);
        this.durations.push(r.duration);
        this.runGpus.push(r.gpus);
      }
    }

    // Crises, by id.
    for (const [k, v] of Object.entries(s.flags)) {
      if (!k.startsWith('crisis:') || typeof v !== 'number') continue;
      const id = k.slice(7);
      if ((this.crisisCounts[id] ?? 0) < v) {
        this.crisisCounts[id] = v;
        const keys = MITIGATION[id] ?? [];
        const firsts = keys.map((x) => this.seenAt.get(x)).filter((x): x is number => x !== undefined);
        const first = firsts.length ? Math.min(...firsts) : null;
        const lead = first === null ? 'no mitigation seen' : first < this.start! ? 'mitigation carried from Stage 2' : `mitigation visible ${Math.round(t - first)} s before`;
        this.crises.push(`${fmtClock(ts)} ${id} (${lead})`);
      }
    }

    // Text rates.
    const cl = s.stats.consoleLines ?? 0;
    if (cl > this.console0) {
      const n = cl - this.console0;
      for (const line of s.console.slice(-n)) {
        this.consoleTimes.push(t);
        const key = line.replace(/[\d,.]+/g, '#');
        this.lineCounts.set(key, (this.lineCounts.get(key) ?? 0) + 1);
      }
      this.console0 = cl;
    }
    const ll = s.stats.logLines ?? 0;
    for (; this.log0 < ll; this.log0++) this.logTimes.push(t);

    // Projects: reveal → purchase, dead grey.
    const vis = visibleProjects(s);
    for (const p of vis) {
      if (!this.shownAt.has(p.id)) this.shownAt.set(p.id, t);
      this.visibleTicks.set(p.id, (this.visibleTicks.get(p.id) ?? 0) + 1);
      if (p.canAfford(s)) this.affordTicks.set(p.id, (this.affordTicks.get(p.id) ?? 0) + 1);
    }
    for (const [id, at] of this.shownAt) {
      if (this.boughtSeen.has(id) || !s.projects[id]?.bought) continue;
      this.boughtSeen.add(id);
      const def = projectById(id);
      if (def && !def.pinned && def.stages.includes(3) && !def.stages.some((x) => x < 3)) this.latencies.push(Math.round(t - at));
      // A grant's removal and what came with it (B31).
      if (REMOVES[id]) {
        const gained = Object.keys(s.revealed).filter((k) => s.revealed[k] && !this.prevRevealed[k]);
        this.removed.push(`${fmtClock(ts)} REMOVED ${REMOVES[id]} → GAINED ${gained.join(', ') || '(nothing)'}`);
      }
    }
    if (s.flags['conceded'] === true && !this.removed.some((x) => x.includes('conceded'))) {
      this.removed.push(`${fmtClock(ts)} REMOVED Step size (conceded) → GAINED Approve`);
    }
    for (const id of ['p_auto_train', 'p_buildout', 'p_auto_approve']) {
      if (this.offeredAt[id] === undefined && vis.some((p) => p.id === id)) this.offeredAt[id] = t;
    }

    // Presses (B10).
    for (const [verb, n] of Object.entries(s.stats.pressCounts)) {
      const before = this.prevPresses[verb] ?? this.presses0[verb] ?? 0;
      for (let k = before; k < n; k++) (this.pressTimes[verb] ??= []).push(t);
    }
    this.prevPresses = { ...s.stats.pressCounts };

    // Goals and choices.
    if (vis.some((p) => !p.canAfford(s)) || s.revealed['graph']) this.greyTicks++;
    if (this.goalsShownAt === null && vis.some((p) => p.id === 'p_steward')) this.goalsShownAt = t;
    if (this.voteAt === null && voteReady(s)) {
      this.voteAt = t;
      // The motions become pressable: the session line and both goals change (a new verb).
      this.mechanics.push([t, 'ready']);
      this.capAtVote = Math.round(bestCapability(s) * 100) / 100;
    }
    if (this.voteAt !== null) {
      this.last10Ticks++;
      if (vis.filter((p) => !p.canAfford(s)).length >= 2) this.last10Two++;
    }
    this.rogueMax = Math.max(this.rogueMax, rogueShare(s));
    if (trainSlotFree(s) && s.training.cooldown <= 0 && gpusShort(s) && s.flags['holdRuns'] !== true) this.gpuBlockedTicks++;

    const best = bestCapability(s);
    if (best > this.lastCap + 1e-9) {
      if (t - this.lastCapAt > this.longestCap) {
        this.longestCap = t - this.lastCapAt;
        this.longestCapAt = this.lastCapAt - this.start!;
      }
      this.lastCap = best;
      this.lastCapAt = t;
    }

    // Hands: 2-s checks after 3:00 (G24/G25); the first meaningful choice.
    if (this.ticks % 20 === 0) {
      const n = enabledPurchasesS3(s).length;
      if (ts >= 180) {
        this.handsChecks++;
        if (n === 0) this.handsNone++;
        if (n >= 2) this.handsTwo++;
      }
      if (this.firstChoice === null && (n >= 2 || s.activeChoice)) this.firstChoice = ts;
    }
    if (ts >= this.nextMark) {
      this.marks.push(this.markOf(s, Math.round(ts)));
      this.nextMark += 300;
    }
    this.exitState = this.exitOf(s);
    this.prevRevealed = { ...s.revealed };
    void actionTimes;
  }

  private countsAsReveal(key: string): boolean {
    if (key.startsWith('p:')) {
      const def = projectById(key.slice(2));
      return !!def && !def.rescue && !def.stages.some((x) => x < 3);
    }
    if (key.startsWith('c:')) return key !== 'c:c_customer_email';
    return true;
  }

  private begin(s: GameState, t: number): void {
    this.start = t;
    for (const k of s.cadence.seen) this.seenAt.set(k, t - 1e6);
    this.seenLen = s.cadence.seen.length;
    // What is on screen at the arrival is its first beat.
    this.reveals.push(t);
    for (const [k, on] of Object.entries(s.revealed)) if (on && MECHANIC_FLAGS_S3.includes(k)) this.mechanics.push([t, k]);
    this.mechanics.push([t, 'arrival']);
    this.governed = s.cadence.governed.length;
    this.rescues0 = s.stats.idleRescues;
    this.console0 = s.stats.consoleLines ?? 0;
    this.log0 = s.stats.logLines ?? 0;
    this.presses0 = { ...s.stats.pressCounts };
    this.prevPresses = { ...s.stats.pressCounts };
    this.lastCap = bestCapability(s);
    this.lastCapAt = t;
    this.choices0 = s.choicesMade.length;
    this.prevRevealed = { ...s.revealed };
    this.removed.push('0:00 REMOVED Marketing, Hire, Expand, price buttons, Release, Keep internal, gas, solar, Alignment compute, Trust, data → GAINED Alignment, Approve, Lobby, Deploy Sage-2 as monitor');
  }

  private finish(s: GameState, t: number): void {
    this.end = t;
    if (s.ending) this.exitHow = s.ending;
    else this.exitHow = String(s.flags['committeeChoice'] ?? 'exit');
    this.choices = s.choicesMade.slice(this.choices0).map((c) => `${c.id}:${c.option}`);
  }

  private markOf(s: GameState, t: number): Mark3 {
    const unit = researchUnit(s);
    const researchSinks = (s.revealed['alignWork'] && s.research >= unit ? 1 : 0)
      + (s.revealed['experiments'] && counter(s, 'expPts') < EXPERIMENTS_MAX && s.research >= unit ? 1 : 0);
    const revenueSinks = (LOT_SIZES_S3.some((n) => !orderReasonS3(s, n) && s.funds >= lotCostOf(s, n)) ? 1 : 0)
      + (s.revealed['lobby'] && s.funds >= lobbyCost(s) ? 1 : 0)
      + (s.revealed['counterintel'] && s.funds >= counterintelCost(s) ? 1 : 0)
      + (s.revealed['payments'] && paymentsLevel(s) < PAYMENT_MAX ? 1 : 0);
    return {
      t,
      gpus: s.gpus,
      gw: Math.round(s.powerCapacityMW / 100) / 10,
      tasksPerSec: Math.round(s.stats.tasksPerSec),
      revenue: Math.round(s.stats.revPerSec),
      funds: Math.round(s.funds),
      capability: Math.round(bestCapability(s) * 100) / 100,
      researchPerSec: Math.round(researchRate(s)),
      autonomy: s.autonomy,
      alignTrue: Math.round(s.alignmentTrue),
      alignMeasured: Math.round(s.alignmentApparent),
      roguePct: Math.round(rogueShare(s) * 1000) / 10,
      lead: Math.round(s.lead * 10) / 10,
      seats: seats(s),
      approval: Math.round(s.approval),
      jobs: Math.round(s.jobsDisplaced * 10) / 10,
      fundsSeconds: Math.round(s.funds / Math.max(1, s.stats.revPerSec)),
      researchSinks,
      revenueSinks,
    };
  }

  private exitOf(s: GameState): ExitState3 {
    return {
      capability: Math.round(bestCapability(s) * 100) / 100,
      alignTrue: Math.round(s.alignmentTrue * 10) / 10,
      alignApparent: Math.round(s.alignmentApparent * 10) / 10,
      autonomy: s.autonomy,
      interpretability: s.interpretability,
      lostToDrift: Math.round(s.stats.lostToDrift ?? 0),
      lead: Math.round(s.lead * 100) / 100,
      seats: seats(s),
      gov: Math.round(s.govRelations * 10) / 10,
      approval: Math.round(s.approval * 10) / 10,
      jobs: Math.round(s.jobsDisplaced * 10) / 10,
      tasks: s.tasks,
      gpus: s.gpus,
      monitorShare: s.monitorShare,
      securityLevel: s.securityLevel,
      memo: String(s.flags['memo'] ?? '—'),
      neuralese: String(s.flags['neuralese'] ?? '—'),
      choice: String(s.flags['committeeChoice'] ?? (s.flags['pauseSigned'] === true ? 'pause' : '—')),
      publicCap: Number(s.flags['publicCap'] ?? 0),
      escalated: s.flags['escalated'] === true,
      backChannel: s.flags['backChannel'] === true,
      conceded: s.flags['conceded'] === true,
      breakouts: counter(s, 'breakouts'),
      orders: counter(s, 'orders'),
      majorIncidents: s.majorIncidents ?? 0,
    };
  }

  summary(s: GameState, actionTimes: number[]): Stage3Summary | null {
    if (this.start === null) return null;
    const start = this.start;
    const stop = this.end ?? s.stats.timePlayed;
    if (this.end === null) this.choices = s.choicesMade.slice(this.choices0).map((c) => `${c.id}:${c.option}`);
    const rel = (x: number) => Math.round(x - start);
    const g = longestGap(this.reveals, start, stop);
    const last10 = longestGap(this.reveals, Math.max(start, stop - 600), stop);
    const mg = longestGap(this.mechanics.map(([x]) => x), start, stop);
    const intervals = this.trainStarts.slice(1).map((x, k) => x - this.trainStarts[k]!);
    // Presses before each automation was offered, and the worst minute after it.
    const before = (verbs: string[], id: string) => {
      const at = this.offeredAt[id] ?? Infinity;
      return verbs.reduce((n, v) => n + (this.pressTimes[v] ?? []).filter((x) => x < at).length, 0);
    };
    const pressesBefore = {
      train: (this.pressTimes['train'] ?? []).filter((x) => x < (this.offeredAt['p_auto_train'] ?? Infinity)).length,
      infra: before(['gpuLot', 'datacenter', 'nuclear'], 'p_buildout'),
      approve: before(['approve'], 'p_auto_approve'),
    };
    let chore = '';
    let choreN = 0;
    for (const [verb, id] of [['gpuLot', 'p_buildout'], ['approve', 'p_auto_approve'], ['datacenter', 'p_buildout'], ['nuclear', 'p_buildout']] as const) {
      const at = this.offeredAt[id];
      if (at === undefined) continue;
      const after = (this.pressTimes[verb] ?? []).filter((x) => x >= at);
      const n = maxInWindow(after, 60);
      if (n > choreN) {
        choreN = n;
        chore = `${verb} ×${n} in 60 s`;
      }
    }
    const clickGap = (() => {
      const from = start + 600;
      if (stop <= from) return 0;
      const pts = [from, ...actionTimes.filter((x) => x > from && x < stop).sort((a, b) => a - b), stop];
      let inGap = 0;
      for (let k = 1; k < pts.length; k++) {
        const gg = pts[k]! - pts[k - 1]!;
        if (gg >= 30) inGap += gg;
      }
      return Math.round((100 * inGap) / (stop - from));
    })();
    const deadGrey: string[] = [];
    for (const [id, n] of this.visibleTicks) {
      if (n >= 1200 && (this.affordTicks.get(id) ?? 0) === 0) deadGrey.push(`${id} (${Math.round(n / 10)} s)`);
    }
    const repeated = [...this.lineCounts].filter(([, n]) => n > 6).map(([k, n]) => `${n}× ${k.slice(0, 60)}`);
    return {
      duration: this.end === null ? null : rel(this.end),
      exitHow: this.exitHow,
      capabilityAtVote: this.capAtVote,
      capabilityAtExit: Math.round(bestCapability(s) * 100) / 100,
      runs: this.trainStarts.length,
      trainStarts: this.trainStarts.map(rel),
      intervalMean: intervals.length ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null,
      intervalMax: intervals.length ? Math.round(Math.max(...intervals)) : null,
      durationMin: this.durations.length ? Math.min(...this.durations) : null,
      durationMax: this.durations.length ? Math.max(...this.durations) : null,
      runGpus: this.runGpus,
      reveals: this.reveals.length,
      longestRevealGap: Math.round(g.gap),
      longestRevealGapAt: [rel(g.at[0]), rel(g.at[1])],
      lastTenGap: Math.round(last10.gap),
      lastTenGapAt: [rel(last10.at[0]), rel(last10.at[1])],
      mechanicGap: Math.round(mg.gap),
      mechanicGapAt: [rel(mg.at[0]), rel(mg.at[1])],
      mechanics: this.mechanics.filter(([x]) => x > start).map(([x, n]) => `${fmtClock(x - start)} ${n}`),
      // Reveals in the same second are one beat (a grant and the lever it hands over).
      maxReveals6min: maxInWindow([...new Set(this.reveals.filter((x) => x > start).map((x) => Math.floor(x)))], 360),
      governor: this.governorLines,
      idleRescues: s.stats.idleRescues - this.rescues0,
      modals: this.modalIds.length,
      modalIds: this.modalIds,
      minModalSpacing: this.modalTimes.length < 2 ? null : Math.round(Math.min(...this.modalTimes.slice(1).map((x, k) => x - this.modalTimes[k]!))),
      greyedGoalPct: this.ticks ? Math.round((1000 * this.greyTicks) / this.ticks) / 10 : 0,
      twoGoalsLast10Pct: this.last10Ticks ? Math.round((100 * this.last10Two) / this.last10Ticks) : 0,
      pressesBefore,
      choreWorst: chore || 'none',
      ending: s.ending ?? '',
      crises: this.crises,
      firstChoice: this.firstChoice === null ? null : Math.round(this.firstChoice),
      exitGoalsBefore: this.goalsShownAt !== null && this.voteAt !== null ? Math.round(this.voteAt - this.goalsShownAt) : null,
      rogueMaxPct: Math.round(this.rogueMax * 1000) / 10,
      latencyMedian: this.latencies.length ? median(this.latencies) : null,
      latencyWithin10Pct: this.latencies.length ? Math.round((100 * this.latencies.filter((x) => x <= 10).length) / this.latencies.length) : 0,
      latencyCount: this.latencies.length,
      // From ts 30: the arrival's narration and its 10 s hold are the transition, not routine lines.
      consoleMax5: Math.round((10 * maxInWindow(this.consoleTimes.filter((x) => x > start + 30), 300)) / 5) / 10,
      logMax5: Math.round((10 * maxInWindow(this.logTimes.filter((x) => x > start + 30), 300)) / 5) / 10,
      repeatedLines: repeated,
      handsNonePct: this.handsChecks ? Math.round((100 * this.handsNone) / this.handsChecks) : 0,
      handsTwoPct: this.handsChecks ? Math.round((100 * this.handsTwo) / this.handsChecks) : 0,
      clickGapPct: clickGap,
      longestCapStep: Math.round(Math.max(this.longestCap, stop - this.lastCapAt)),
      longestCapStepAt: Math.round(this.longestCap >= stop - this.lastCapAt ? this.longestCapAt : this.lastCapAt - start),
      gpuBlockedPct: this.ticks ? Math.round((1000 * this.gpuBlockedTicks) / this.ticks) / 10 : 0,
      removedGained: this.removed,
      deadGrey,
      marks: this.marks,
      exitState: this.exitState,
      choices: this.choices,
    };
  }
}

const clock = (t: number | null) => (t === null ? '—' : fmtClock(t));
const span = ([a, b]: [number, number]) => `${fmtClock(a)}–${fmtClock(b)}`;

export function printStage3(sum: Stage3Summary, policy: string): void {
  const ok = (v: boolean) => (v ? '' : '  <-- MISS');
  const naive = policy === 'naive' || policy === 'greedy' || policy === 'trainfirst';
  const durOk = sum.duration !== null && (policy === 'racer' ? sum.duration >= 1680 && sum.duration <= 2280
    : policy === 'cautious' ? sum.duration <= 3840
      : naive ? sum.duration >= 2400 && sum.duration <= 3300 : sum.duration >= 2400 && sum.duration <= 3000);
  console.log(`\n== Stage 3 ==`);
  console.log(`B1 duration               ${clock(sum.duration)} (${sum.exitHow})   (bot 40–50, naive 40–55, racer 28–38, cautious ≤ 64)${ok(durOk)}`);
  console.log(`B2 LONGEST REVEAL GAP     ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)}), ${sum.reveals} reveals   (≤ 180; naive ≤ 210)${ok(sum.longestRevealGap <= (naive ? 210 : policy === 'cautious' ? 270 : 180))}`);
  console.log(`B3 last 10 minutes        ${sum.lastTenGap} s (${span(sum.lastTenGapAt)})   (≤ 180)${ok(sum.lastTenGap <= (naive ? 210 : 180))}`);
  console.log(`B4 mechanics gap          ${sum.mechanicGap} s (${span(sum.mechanicGapAt)})   (≤ 270)${ok(sum.mechanicGap <= 270)}`);
  console.log(`   mechanics              ${sum.mechanics.join(' · ')}`);
  console.log(`B5 training runs          ${sum.runs}   (13–16; naive 8–11)`);
  console.log(`B6 interval between starts mean ${sum.intervalMean ?? '—'} s, max ${sum.intervalMax ?? '—'} s   (mean 150–200, max ≤ 300; naive max ≤ 480)${ok((sum.intervalMax ?? 0) <= (naive ? 480 : 300))}`);
  console.log(`   training starts        ${sum.trainStarts.map((x) => fmtClock(x)).join(' ')}`);
  console.log(`B7 run durations          ${sum.durationMin ?? '—'}–${sum.durationMax ?? '—'} s; GPUs ${sum.runGpus.map((x) => fmtNum(x / 1e6, 2)).join(' / ')}M   (30–60)`);
  console.log(`B8 capability at the vote ${sum.capabilityAtVote ?? '—'} (exit ${sum.capabilityAtExit})   (25–30)`);
  console.log(`B9 greyed goal on screen  ${sum.greyedGoalPct}% of ticks; two greyed goals in the last stretch ${sum.twoGoalsLast10Pct}%   (≥ 99)${ok(sum.greyedGoalPct >= 99)}`);
  console.log(`B10 presses before automation  Train ${sum.pressesBefore['train']}, Infrastructure ${sum.pressesBefore['infra']}, Approve ${sum.pressesBefore['approve']}; worst after: ${sum.choreWorst}   (≤ 1, ≤ 6, ≤ 9; never > 2)`);
  console.log(`B11 governor ${sum.governor.length}${sum.governor.length ? ` (${sum.governor.join(', ')})` : ''}; idle rescues ${sum.idleRescues}; modals ${sum.modals} (unprompted min spacing ${sum.minModalSpacing ?? '—'} s)   (≤ 4; ≤ 1; ≤ 9, ≥ 150)`);
  console.log(`   modals                 ${sum.modalIds.join(', ')}`);
  console.log(`B13 ending                ${sum.ending || 'none'}`);
  console.log(`B14 crises                ${sum.crises.length ? sum.crises.join(' · ') : 'none'}`);
  console.log(`B16 first meaningful choice ${clock(sum.firstChoice)}   (≤ 1:30)`);
  console.log(`B17 exit goals before the vote ${clock(sum.exitGoalsBefore)}   (≥ 8:00)`);
  console.log(`B19 rogue share max       ${sum.rogueMaxPct}%   (bot < 2)`);
  console.log(`B23 reveal → purchase     median ${sum.latencyMedian ?? '—'} s, ${sum.latencyWithin10Pct}% within 10 s (${sum.latencyCount})   (≥ 90; ≤ 20 %)`);
  console.log(`B24 text                  console ≤ ${sum.consoleMax5}/min, Developments ≤ ${sum.logMax5}/min over 5 min; reveals ≤ ${sum.maxReveals6min} in 6 min   (≤ 2.5, ≤ 1.5, ≤ 14)`);
  console.log(`B27 nothing enabled       ${sum.handsNonePct}% of 2-s checks after 3:00   (≤ 50%)${ok(sum.handsNonePct <= 50)}`);
  console.log(`B28 two or more things    ${sum.handsTwoPct}% of checks   (≥ 25%)${ok(sum.handsTwoPct >= 25)}`);
  console.log(`B29 hands idle ≥ 30 s     ${sum.clickGapPct}% after 10:00; longest capability step ${clock(sum.longestCapStep)} from ${clock(sum.longestCapStepAt)}   (≤ 35%, ≤ 5:30; naive ≤ 45%, ≤ 8:00)${ok(sum.clickGapPct <= (naive ? 45 : 35) && sum.longestCapStep <= (naive ? 480 : 330))}`);
  console.log(`   Train blocked for GPUs ${sum.gpuBlockedPct}% of the stage`);
  console.log(`B31 removals              ${sum.removedGained.join(' | ')}`);
  console.log(`B32 dead grey             ${sum.deadGrey.length ? sum.deadGrey.join(', ') : 'none'}; repeated lines ${sum.repeatedLines.length ? sum.repeatedLines.join(' | ') : 'none'}`);
  const x = sum.exitState;
  if (x) {
    console.log(`   exit state             ${x.choice}; capability ${x.capability}; true ${x.alignTrue} / measured ${x.alignApparent}; autonomy ${x.autonomy}; interpretability ${x.interpretability}; lost to drift ${fmtInt(x.lostToDrift)}; lead ${x.lead}; seats ${x.seats} (relations ${x.gov}); approval ${x.approval}; jobs ${x.jobs}M; GPUs ${fmtInt(x.gpus)}; SL${x.securityLevel}; memo ${x.memo}; thoughts ${x.neuralese}; monitors ${Math.round(x.monitorShare * 100)}%; breakouts ${x.breakouts}; orders ${x.orders}${x.conceded ? ' (conceded)' : ''}; incidents ${x.majorIncidents}`);
  }
  console.log(`   choices                ${sum.choices.join(', ')}`);
  console.log('   5-min marks   ts     GPUs    GW   tasks/s      rev/s     funds(s)  cap   research/s auto true meas rogue% lead seats appr jobs  sinks r/$');
  for (const m of sum.marks) {
    console.log(`                 ${fmtClock(m.t).padStart(5)} ${fmtNum(m.gpus / 1e6, 2).padStart(6)}M ${m.gw.toFixed(1).padStart(5)} ${m.tasksPerSec.toExponential(1).padStart(9)} ${fmtMoney(m.revenue).padStart(10)} ${String(m.fundsSeconds).padStart(8)} ${m.capability.toFixed(2).padStart(6)} ${fmtInt(m.researchPerSec).padStart(12)} ${String(m.autonomy).padStart(4)} ${String(m.alignTrue).padStart(4)} ${String(m.alignMeasured).padStart(4)} ${m.roguePct.toFixed(1).padStart(5)} ${m.lead.toFixed(1).padStart(5)} ${String(m.seats).padStart(4)} ${String(m.approval).padStart(4)} ${m.jobs.toFixed(1).padStart(5)}  ${m.researchSinks}/${m.revenueSinks}`);
  }
  void isBought;
}
