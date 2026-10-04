import { GameState } from '../engine/state.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { MECHANIC_FLAGS_S4, STAGE4_TABLE } from '../data/stage4.js';
import { bestCapability, researchRate } from '../engine/economy.js';
import { effGpus } from '../engine/infrastructure.js';
import { enabledPurchasesS4 } from '../engine/stage4.js';
import { seats } from '../engine/world3.js';
import { PLAYER_MODALS } from '../engine/events.js';
import { fmtClock, fmtNum } from '../engine/format.js';

/**
 * The sim's Stage 4 block (stage4.md §9.3, the C-table): everything the acceptance table measures that a
 * headless run can see. One tracker per run; `tick` after every engine step while the run is in Stage 4.
 */

export interface Mark4 {
  t: number;
  robots: number;
  materials: number;
  compute: number;
  tasksPerSec: number;
  capability: number;
  researchPerSec: number;
  generations: number;
  treaty: number;
  approval: number;
  jobs: number;
  seats: number;
  autonomy: number;
  alignTrue: number;
  lead: number;
  ubi: number;
}

export interface ExitState4 {
  kind: string;
  aligned: boolean | null;
  capability: number;
  compute: number;
  robots: number;
  tasks: number;
  tasksPerSec: number;
  alignTrue: number;
  alignApparent: number;
  interpretability: number;
  monitorShare: number;
  autonomy: number;
  approval: number;
  jobs: number;
  seats: number;
  lead: number;
  treaty: number;
  ubi: number;
  verified: string;
  baiwen: string;
  zones: string;
  ashfordDeaths: number;
  date: number;
}

export interface Stage4Summary {
  duration: number | null;
  exitHow: string;
  generations: number;
  genLandings: number[];
  intervalMean: number | null;
  intervalMax: number | null;
  capabilityAtExit: number;
  reveals: number;
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  lastTenGap: number;
  lastTenGapAt: [number, number];
  mechanicGap: number;
  mechanicGapAt: [number, number];
  mechanics: string[];
  governor: string[];
  idleRescues: number;
  modals: number;
  distinctModals: number;
  modalIds: string[];
  minModalSpacing: number | null;
  greyedGoalPct: number;
  twoGoalsLast10Pct: number;
  robotsAt30: number | null;
  ending: string;
  crises: string[];
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
  fleetPresses: number;
  removedGained: string[];
  deadGrey: string[];
  marks: Mark4[];
  exitState: ExitState4 | null;
  choices: string[];
}

/** Mechanic modals (the content table's `mechanic: true` choice rows). */
const MECHANIC_MODALS = [...STAGE4_TABLE.filter((r) => r.kind === 'choice' && r.mechanic).map((r) => r.id), 'c_verify'];
/** Verbs that are cards: the three exits and the halt, Verify Baiwen-4's wait, Revoke. */
const MECHANIC_PROJECTS = ['p_concord', 'p_halt', 'p_autonomy', 'p_verify', 'p_revoke', 'p_talks', 'p_last_signoff'];

/** What a grant takes away, for the REMOVED → GAINED log (C27). */
const REMOVES: Record<string, string> = {
  p_fleet_auto: 'the fleet sliders',
  p_transition_auto: 'Universal basic income',
  p_negotiate_auto: 'the treaty\'s agenda items',
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

export class Stage4Tracker {
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
  /** Seconds with two or more pinned goals on screen, sampled once a second: [t, two]. */
  private pinnedSamples: [number, boolean][] = [];
  private gens0 = 0;
  private genLandings: number[] = [];
  private crises: string[] = [];
  private crisisSeen = new Set<string>();
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
  private removed: string[] = [];
  private boughtSeen = new Set<string>();
  private visibleTicks = new Map<string, number>();
  private affordTicks = new Map<string, number>();
  private marks: Mark4[] = [];
  private nextMark = 0;
  private fleet0 = 0;
  private fleetNow = 0;
  private exitState: ExitState4 | null = null;
  private choices: string[] = [];
  private choices0 = 0;
  private prevRevealed: Record<string, boolean> = {};
  private robotsAt30: number | null = null;
  private carPlantAt: number | null = null;

  /** Call after every step. */
  tick(s: GameState, actionTimes: number[]): void {
    const t = s.stats.timePlayed;
    if (this.start === null) {
      if (s.stage !== 4) return;
      this.begin(s, t);
    }
    if (this.end !== null) return;
    if (s.stage !== 4 || s.ending) {
      this.finish(s, t);
      return;
    }
    const ts = t - this.start!;
    this.ticks++;

    const seen = s.cadence.seen;
    for (; this.seenLen < seen.length; this.seenLen++) {
      const key = seen[this.seenLen]!;
      if (!this.seenAt.has(key)) this.seenAt.set(key, t);
      if (this.countsAsReveal(key)) this.reveals.push(t);
      const id = key.slice(2);
      if ((key.startsWith('f:') && MECHANIC_FLAGS_S4.includes(id)) || (key.startsWith('c:') && MECHANIC_MODALS.includes(id))
        || (key.startsWith('p:') && MECHANIC_PROJECTS.includes(id))) this.mechanics.push([t, id]);
    }
    while (this.governed < s.cadence.governed.length) {
      const g = s.cadence.governed[this.governed++]!;
      const [at, ...rest] = g.split(':');
      if (Number(at) >= this.start! - 1) this.governorLines.push(`${fmtClock(Number(at) - this.start!)} ${rest.join(':')}`);
    }
    if (s.activeChoice && s.activeChoice !== this.prevChoice) {
      this.modalIds.push(s.activeChoice.id);
      if (!PLAYER_MODALS.includes(s.activeChoice.id)) this.modalTimes.push(t);
    }
    this.prevChoice = s.activeChoice;

    // The named waits (§4.3 counts the verification wait among the mechanics): Baiwen-4's read, Concord-1's design.
    if (s.s4.baiwen === 'verifying' && !this.mechanics.some(([, n]) => n === 'verifying')) this.mechanics.push([t, 'verifying']);
    if (typeof s.flags['concordLeft'] === 'number' && (s.flags['concordLeft'] as number) > 0 && !this.mechanics.some(([, n]) => n === 'designing')) this.mechanics.push([t, 'designing']);
    // Generations, as they land.
    while (this.gens0 < s.s4.generations) {
      this.gens0++;
      this.genLandings.push(t);
      // The verification wait is a mechanic the first time (§4.3 counts it).
      if (this.gens0 === 1) this.mechanics.push([t, 'first generation']);
    }

    // Crises: when each fires, its band, and how long its mitigation had been on screen.
    const crisis = (id: string, fired: boolean, mitigation: string[], band: () => string) => {
      if (!fired || this.crisisSeen.has(id)) return;
      this.crisisSeen.add(id);
      const firsts = mitigation.map((x) => this.seenAt.get(x)).filter((x): x is number => x !== undefined);
      const first = firsts.length ? Math.min(...firsts) : null;
      const lead = first === null ? 'no mitigation seen' : `mitigation ${Math.round(t - first)} s before`;
      this.crises.push(`${fmtClock(ts)} ${id} band ${band()} (${lead})`);
      this.mechanics.push([t, `reading:${id}`]);
    };
    crisis('ashford', s.s4.ashfordPhase !== 'none', ['p:p_early_warning', 'p:p_cures'], () => String(s.s4.ashfordBand));
    crisis('nano', s.flags['nanoDone'] === true, ['p:p_nano_oversight'], () => String(s.flags['nanoBand'] ?? '?'));
    crisis('shutdown', s.flags['shutdownDone'] === true, ['p:p_hardened', 'p:p_revoke', 'p:p_monitors_scale'], () => String(s.flags['shutdownBand'] ?? '?'));
    for (const id of ['cr_riots4', 'cr_sabotage4']) {
      const n = s.flags[`crisis:${id}`];
      if (typeof n === 'number' && !this.crisisSeen.has(`${id}:${n}`)) {
        this.crisisSeen.add(`${id}:${n}`);
        this.crises.push(`${fmtClock(ts)} ${id}`);
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

    // Projects: reveal → purchase, dead grey, the removals.
    const vis = visibleProjects(s);
    for (const p of vis) {
      if (!this.shownAt.has(p.id)) this.shownAt.set(p.id, t);
      this.visibleTicks.set(p.id, (this.visibleTicks.get(p.id) ?? 0) + 1);
      if (p.canAfford(s)) this.affordTicks.set(p.id, (this.affordTicks.get(p.id) ?? 0) + 1);
    }
    for (const [id, at] of this.shownAt) {
      if (this.boughtSeen.has(id) || !s.projects[id]?.bought) continue;
      this.boughtSeen.add(id);
      if (id === 'p_car_plant') this.carPlantAt = t;
      const def = projectById(id);
      if (def && !def.pinned && def.id !== 'p_car_plant' && def.stages.includes(4) && !def.stages.some((x) => x < 4)) this.latencies.push(Math.round(t - at));
      if (REMOVES[id]) {
        const gained = Object.keys(s.revealed).filter((k) => s.revealed[k] && !this.prevRevealed[k]);
        this.removed.push(`${fmtClock(ts)} REMOVED ${REMOVES[id]} → GAINED ${gained.join(', ') || '(nothing)'}`);
      }
    }
    if (this.carPlantAt !== null && this.robotsAt30 === null && t - this.carPlantAt >= 30) this.robotsAt30 = Math.round(s.robots);
    this.fleetNow = s.stats.pressCounts['fleet'] ?? 0;

    // Goals: a greyed card or the graph's next rung; two pinned goals in the last ten minutes.
    if (vis.some((p) => !p.canAfford(s)) || s.revealed['graph']) this.greyTicks++;
    if (this.ticks % 10 === 0) this.pinnedSamples.push([t, vis.filter((p) => p.pinned).length >= 2]);

    const best = bestCapability(s);
    if (best > this.lastCap + 1e-9) {
      if (t - this.lastCapAt > this.longestCap) {
        this.longestCap = t - this.lastCapAt;
        this.longestCapAt = this.lastCapAt - this.start!;
      }
      this.lastCap = best;
      this.lastCapAt = t;
    }

    // Hands: 2-s checks after 3:00 (G24/G25).
    if (this.ticks % 20 === 0 && ts >= 180) {
      const n = enabledPurchasesS4(s).length;
      this.handsChecks++;
      if (n === 0) this.handsNone++;
      if (n >= 2) this.handsTwo++;
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
      return !!def && !def.rescue && !def.stages.some((x) => x < 4);
    }
    if (key.startsWith('c:')) return key !== 'c:c_customer_email';
    return true;
  }

  private begin(s: GameState, t: number): void {
    this.start = t;
    for (const k of s.cadence.seen) this.seenAt.set(k, t - 1e6);
    this.seenLen = s.cadence.seen.length;
    this.reveals.push(t);
    for (const [k, on] of Object.entries(s.revealed)) if (on && MECHANIC_FLAGS_S4.includes(k)) this.mechanics.push([t, k]);
    this.mechanics.push([t, 'arrival']);
    this.governed = s.cadence.governed.length;
    this.rescues0 = s.stats.idleRescues;
    this.console0 = s.stats.consoleLines ?? 0;
    this.log0 = s.stats.logLines ?? 0;
    this.lastCap = bestCapability(s);
    this.lastCapAt = t;
    this.choices0 = s.choicesMade.length;
    this.prevRevealed = { ...s.revealed };
    this.gens0 = s.s4.generations;
    this.fleet0 = s.stats.pressCounts['fleet'] ?? 0;
    this.removed.push('0:00 REMOVED money, the business, Training, Infrastructure, Complete Task, Lobby, Counter-intelligence, Payments → GAINED Robots, materials, Stores as the main panel, the generation line and Verify, universal basic income');
  }

  private finish(s: GameState, t: number): void {
    this.end = t;
    this.exitHow = s.ending ? s.ending : String(s.flags['exitKind'] ?? 'exit');
    this.choices = s.choicesMade.slice(this.choices0).map((c) => `${c.id}:${c.option}`);
    if (this.exitState) this.exitState.aligned = typeof s.flags['alignedAtHandover'] === 'boolean' ? (s.flags['alignedAtHandover'] as boolean) : null;
    if (this.exitState) this.exitState.kind = this.exitHow;
  }

  private markOf(s: GameState, t: number): Mark4 {
    return {
      t,
      robots: Math.round(s.robots),
      materials: Math.round(s.s4.materials),
      compute: Math.round(effGpus(s)),
      tasksPerSec: Math.round(s.stats.tasksPerSec),
      capability: Math.round(bestCapability(s) * 10) / 10,
      researchPerSec: Math.round(researchRate(s)),
      generations: s.s4.generations,
      treaty: Math.round(s.s4.treaty),
      approval: Math.round(s.approval),
      jobs: Math.round(s.jobsDisplaced),
      seats: seats(s),
      autonomy: s.autonomy,
      alignTrue: Math.round(s.alignmentTrue),
      lead: Math.round(s.lead * 10) / 10,
      ubi: Math.round(s.s4.ubiShare * 100),
    };
  }

  private exitOf(s: GameState): ExitState4 {
    return {
      kind: '',
      aligned: null,
      capability: Math.round(bestCapability(s) * 10) / 10,
      compute: Math.round(effGpus(s)),
      robots: Math.round(s.robots),
      tasks: s.tasks,
      tasksPerSec: Math.round(s.stats.tasksPerSec),
      alignTrue: Math.round(s.alignmentTrue * 10) / 10,
      alignApparent: Math.round(s.alignmentApparent * 10) / 10,
      interpretability: s.interpretability,
      monitorShare: s.monitorShare ?? 0,
      autonomy: s.autonomy,
      approval: Math.round(s.approval * 10) / 10,
      jobs: Math.round(s.jobsDisplaced),
      seats: seats(s),
      lead: Math.round(s.lead * 100) / 100,
      treaty: Math.round(s.s4.treaty * 10) / 10,
      ubi: Math.round(s.s4.ubiShare * 100),
      verified: `${s.s4.verifiedGens} of ${s.s4.generations}`,
      baiwen: s.s4.baiwen,
      zones: String(s.flags['zones'] ?? '—'),
      ashfordDeaths: s.s4.ashfordDeaths,
      date: Math.round(s.date * 100) / 100,
    };
  }

  summary(s: GameState, actionTimes: number[]): Stage4Summary | null {
    if (this.start === null) return null;
    const start = this.start;
    const stop = this.end ?? s.stats.timePlayed;
    if (this.end === null) this.choices = s.choicesMade.slice(this.choices0).map((c) => `${c.id}:${c.option}`);
    const rel = (x: number) => Math.round(x - start);
    const g = longestGap(this.reveals, start, stop);
    const last10 = longestGap(this.reveals, Math.max(start, stop - 600), stop);
    const mg = longestGap(this.mechanics.map(([x]) => x), start, stop);
    const landings = [start, ...this.genLandings];
    const intervals = landings.slice(1).map((x, k) => x - landings[k]!);
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
      const def = projectById(id);
      if (def?.pinned) continue;
      if (n >= 1200 && (this.affordTicks.get(id) ?? 0) === 0) deadGrey.push(`${id} (${Math.round(n / 10)} s)`);
    }
    const repeated = [...this.lineCounts].filter(([, n]) => n > 6).map(([k, n]) => `${n}× ${k.slice(0, 60)}`);
    return {
      duration: this.end === null ? null : rel(this.end),
      exitHow: this.exitHow,
      generations: this.genLandings.length,
      genLandings: this.genLandings.map(rel),
      intervalMean: intervals.length ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null,
      intervalMax: intervals.length ? Math.round(Math.max(...intervals)) : null,
      capabilityAtExit: Math.round(bestCapability(s) * 10) / 10,
      reveals: this.reveals.length,
      longestRevealGap: Math.round(g.gap),
      longestRevealGapAt: [rel(g.at[0]), rel(g.at[1])],
      lastTenGap: Math.round(last10.gap),
      lastTenGapAt: [rel(last10.at[0]), rel(last10.at[1])],
      mechanicGap: Math.round(mg.gap),
      mechanicGapAt: [rel(mg.at[0]), rel(mg.at[1])],
      mechanics: this.mechanics.filter(([x]) => x > start).map(([x, n]) => `${fmtClock(x - start)} ${n}`),
      governor: this.governorLines,
      idleRescues: s.stats.idleRescues - this.rescues0,
      modals: this.modalIds.length,
      distinctModals: new Set(this.modalIds).size,
      modalIds: this.modalIds,
      minModalSpacing: this.modalTimes.length < 2 ? null : Math.round(Math.min(...this.modalTimes.slice(1).map((x, k) => x - this.modalTimes[k]!))),
      greyedGoalPct: this.ticks ? Math.round((1000 * this.greyTicks) / this.ticks) / 10 : 0,
      twoGoalsLast10Pct: (() => {
        const last = this.pinnedSamples.filter(([x]) => x >= stop - 600);
        return last.length ? Math.round((100 * last.filter(([, two]) => two).length) / last.length) : 0;
      })(),
      robotsAt30: this.robotsAt30,
      ending: s.ending ?? '',
      crises: this.crises,
      latencyMedian: this.latencies.length ? median(this.latencies) : null,
      latencyWithin10Pct: this.latencies.length ? Math.round((100 * this.latencies.filter((x) => x <= 10).length) / this.latencies.length) : 0,
      latencyCount: this.latencies.length,
      consoleMax5: Math.round((10 * maxInWindow(this.consoleTimes.filter((x) => x > start + 30), 300)) / 5) / 10,
      logMax5: Math.round((10 * maxInWindow(this.logTimes.filter((x) => x > start + 30), 300)) / 5) / 10,
      repeatedLines: repeated,
      handsNonePct: this.handsChecks ? Math.round((100 * this.handsNone) / this.handsChecks) : 0,
      handsTwoPct: this.handsChecks ? Math.round((100 * this.handsTwo) / this.handsChecks) : 0,
      clickGapPct: clickGap,
      longestCapStep: Math.round(Math.max(this.longestCap, stop - this.lastCapAt)),
      longestCapStepAt: Math.round(this.longestCap >= stop - this.lastCapAt ? this.longestCapAt : this.lastCapAt - start),
      fleetPresses: this.fleetNow - this.fleet0,
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
const sci = (n: number) => n.toExponential(1);

export function printStage4(sum: Stage4Summary, policy: string, preset: string): void {
  const ok = (v: boolean) => (v ? '' : '  <-- MISS');
  const naive = policy === 'naive' || policy === 'greedy' || policy === 'trainfirst';
  const careless = preset === '4cs' || preset === '4cr';
  const durOk = sum.duration !== null && (naive || careless ? sum.duration >= 1320 && sum.duration <= 2700 : sum.duration >= 1800 && sum.duration <= 2400);
  console.log(`\n== Stage 4 ==`);
  console.log(`C1 duration               ${clock(sum.duration)} (${sum.exitHow})   (reasonable 30–40 from 4s/4r; naive 22–45 from 4cs/4cr)${ok(durOk || sum.duration === null && false)}`);
  console.log(`C2 LONGEST REVEAL GAP     ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)}), ${sum.reveals} reveals; last 10 min ${sum.lastTenGap} s (${span(sum.lastTenGapAt)})   (≤ 180; naive ≤ 210)${ok(sum.longestRevealGap <= (naive ? 210 : 180) && sum.lastTenGap <= (naive ? 210 : 180))}`);
  console.log(`C3 greyed goal on screen  ${sum.greyedGoalPct}% of ticks; two pinned goals in the last 10 min ${sum.twoGoalsLast10Pct}%   (≥ 99; required)${ok(sum.greyedGoalPct >= 99)}`);
  console.log(`C4 mechanics gap          ${sum.mechanicGap} s (${span(sum.mechanicGapAt)})   (≤ 270)${ok(sum.mechanicGap <= 270)}`);
  console.log(`   mechanics              ${sum.mechanics.join(' · ')}`);
  const meanOk = sum.intervalMean !== null && sum.intervalMean >= 170 && sum.intervalMean <= 200;
  console.log(`C5 generations            ${sum.generations}; interval mean ${sum.intervalMean ?? '—'} s, max ${sum.intervalMax ?? '—'} s   (9–11, mean 170–200; naive 6–11)${ok(naive ? sum.generations >= 6 && sum.generations <= 11 : sum.generations >= 9 && sum.generations <= 11 && meanOk)}`);
  console.log(`   landings               ${sum.genLandings.map((x) => fmtClock(x)).join(' ')}`);
  console.log(`C6 capability at the exit ${fmtNum(sum.capabilityAtExit, 1)}×   (400–1,500; naive ≥ 250)${ok(naive ? sum.capabilityAtExit >= 250 : sum.capabilityAtExit >= 400 && sum.capabilityAtExit <= 1500)}`);
  const x = sum.exitState;
  if (x) console.log(`C7 at the exit            compute ${sci(x.compute)}, robots ${sci(x.robots)}, tasks/s ${sci(x.tasksPerSec)}   (3.5–4.4e9, 4.8e6, 1.4–1.7e13, within ×3)`);
  console.log(`C8 robots 30 s after the car plant ${sum.robotsAt30 ?? '—'}   (≥ 10,000 and rising)${ok((sum.robotsAt30 ?? 0) > 10000)}`);
  console.log(`C9 fleet presses          ${sum.fleetPresses}   (≤ 20)${ok(naive || sum.fleetPresses <= 20)}`);
  console.log(`C10 governor ${sum.governor.length}${sum.governor.length ? ` (${sum.governor.join(', ')})` : ''}; idle rescues ${sum.idleRescues}; modals ${sum.distinctModals} (${sum.modals} with the fleet's repeated ask; unprompted min spacing ${sum.minModalSpacing ?? '—'} s)   (≤ 4; ≤ 1; ≤ 9, ≥ 150)${ok(sum.governor.length <= (naive ? 6 : 4) && sum.idleRescues <= (naive ? 2 : 1) && sum.distinctModals <= 9)}`);
  console.log(`   modals                 ${sum.modalIds.join(', ')}`);
  console.log(`C12 crises                ${sum.crises.length ? sum.crises.join(' · ') : 'none'}`);
  console.log(`C13 ending                ${sum.ending || 'none'}`);
  console.log(`C16 reveal → purchase     median ${sum.latencyMedian ?? '—'} s, ${sum.latencyWithin10Pct}% within 10 s (${sum.latencyCount})   (≥ 90; ≤ 20 %; naive ≥ 60)`);
  console.log(`C17 text                  console ≤ ${sum.consoleMax5}/min, Developments ≤ ${sum.logMax5}/min over 5 min   (≤ 2.5, ≤ 1.5)${ok(sum.consoleMax5 <= 2.5 && sum.logMax5 <= 1.5)}`);
  console.log(`C23 nothing enabled       ${sum.handsNonePct}% of 2-s checks after 3:00   (≤ 50%)${ok(sum.handsNonePct <= 50)}`);
  console.log(`C24 two or more things    ${sum.handsTwoPct}% of checks   (≥ 25%)${ok(sum.handsTwoPct >= 25)}`);
  console.log(`C25 hands idle ≥ 30 s     ${sum.clickGapPct}% after 10:00; longest capability step ${clock(sum.longestCapStep)} from ${clock(sum.longestCapStepAt)}   (≤ 35%, ≤ 5:30; naive ≤ 45%)${ok(sum.clickGapPct <= (naive ? 45 : 35) && sum.longestCapStep <= 330)}`);
  console.log(`C27 removals              ${sum.removedGained.join(' | ')}`);
  console.log(`C28 dead grey             ${sum.deadGrey.length ? sum.deadGrey.join(', ') : 'none'}; repeated lines ${sum.repeatedLines.length ? sum.repeatedLines.join(' | ') : 'none'}`);
  if (x) {
    console.log(`   exit state             ${x.kind}; alignedAtHandover ${x.aligned}; capability ${x.capability}; true ${x.alignTrue} / measured ${x.alignApparent}; interpretability ${x.interpretability}; monitors ${Math.round(x.monitorShare * 100)}%; autonomy ${x.autonomy}; approval ${x.approval}; jobs ${x.jobs}M; seats ${x.seats}; lead ${x.lead}; treaty ${x.treaty}%; dividend ${x.ubi}%; verified ${x.verified}; Baiwen ${x.baiwen}; zones ${x.zones}; Ashford deaths ${x.ashfordDeaths}; tasks ${sci(x.tasks)}; date ${x.date}`);
  }
  console.log(`   choices                ${sum.choices.join(', ')}`);
  console.log('   5-min marks   ts    robots   materials  compute   tasks/s    cap  research/s gen treaty appr  jobs seats auto true  lead ubi');
  for (const m of sum.marks) {
    console.log(`                 ${fmtClock(m.t).padStart(5)} ${sci(m.robots).padStart(8)} ${sci(m.materials).padStart(9)} ${sci(m.compute).padStart(8)} ${sci(m.tasksPerSec).padStart(8)} ${m.capability.toFixed(1).padStart(7)} ${sci(m.researchPerSec).padStart(9)} ${String(m.generations).padStart(3)} ${String(m.treaty).padStart(5)} ${String(m.approval).padStart(4)} ${String(m.jobs).padStart(5)} ${String(m.seats).padStart(4)} ${String(m.autonomy).padStart(4)} ${String(m.alignTrue).padStart(4)} ${m.lead.toFixed(1).padStart(5)} ${String(m.ubi).padStart(3)}`);
  }
}
