import { GameState } from '../engine/state.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { MECHANIC_FLAGS_S5, PEOPLE_LINES, PEOPLE_LINES_MORE, CONCORD_LINES } from '../data/stage5.js';
import { bestCapability, potentialTasksPerSec, copies } from '../engine/economy.js';
import { earthGpus } from '../engine/infrastructure.js';
import {
  enabledPurchasesS5, swarmPct, swarmReached, orbitalEffective, rowsTaken, swarmGoal, concord, ROWS_TAKEN_AT, launchRate,
} from '../engine/space.js';
import { PLAYER_MODALS, choiceById, choiceOptionVisible } from '../engine/events.js';
import { endStats } from '../engine/endings.js';
import { STAGES } from '../engine/stages.js';
import { fmtClock, fmtNum, dateLabel } from '../engine/format.js';

/**
 * The sim's Stage 5 block (stage5.md §9, D1–D24): everything the acceptance table measures that a
 * headless run can see, and the whole-game summary for a new game. One tracker per run; `tick` after
 * every engine step from the stage's first second (or the preset's) to the ending.
 */

export interface Mark5 {
  t: number;
  flow: number;
  orbital: number;
  tasksPerSec: number;
  tasks: number;
  swarm: number;
  capability: number;
  model: string;
}

/** What a Stage 5 screen shows as numbers, for the skin test (D7): the same in both skins until 0.006 %. */
export interface Screen5 {
  t: number;
  values: string;
}

export interface Stage5Summary {
  skin: string;
  exitKind: string;
  arrivalCap: number;
  launchRate: number;
  duration: number | null;
  ending: string;
  reveals: number;
  longestRevealGap: number;
  longestRevealGapAt: [number, number];
  lastTenGap: number;
  lastTenGapAt: [number, number];
  mechanicGap: number;
  mechanicGapAt: [number, number];
  mechanics: string[];
  revealList: string[];
  firstChoice: number | null;
  launchReads: number | null;
  tonnesAt30: number | null;
  endGreyGoals: number;
  endSwarmNext: string;
  gateRatio: number | null;
  gateLines: string[];
  consoleMax5: number;
  logMax5: number;
  peopleAfterCold: number;
  silenceButtons: string;
  handsNonePct: number;
  handsTwoPct: number;
  clickGapPct: number;
  swarmStillMax: number;
  noControl: number | null;
  missionCover: [string, number][];
  coverAtZero: number;
  repeatedLines: string[];
  deadGrey: string[];
  governor: string[];
  modals: string[];
  removals: string[];
  marks: Mark5[];
  screens: Screen5[];
  swarmAt: Record<string, number>;
  choices: string[];
  tasksAtEnd: number;
  farGoals: string[];
}

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

/** Every line about people Stage 5 can print (D8: none in Silence after its cold line). */
const PEOPLE = new Set([...PEOPLE_LINES, ...PEOPLE_LINES_MORE, ...CONCORD_LINES.medicine, CONCORD_LINES.vote, CONCORD_LINES.habitat]);

/** Stage 4 lines that must never print after the gate (D22): its timers' and its generations'. */
const STAGE4_LINES = /Read first|Nobody read it|The cure works|nanofab|breakers|hearing|agenda|Concord-1 is|Verifying|is reading|walked to the breakers/i;

/** The numbers a Stage 5 screen prints, as one string (D7's comparison; the log and the cards excluded). */
export function screenValues(s: GameState): string {
  const f = s.s5;
  const r = (n: number) => n.toPrecision(6);
  const missions = [...f.missions, ...f.beside].map((m) => `${m.id}:${Math.ceil(m.remaining)}`).join(',');
  const board = visibleProjects(s).map((p) => `${p.id}:${p.cost(s).fund ?? 0}`).join(',');
  return [
    `tasks ${r(s.tasks)}`, `flow ${r(f.massFlow)}`, `matter ${r(f.matter)}`, `fund ${r(f.missionFund)}`, `orbital ${r(f.orbitalGpus)}`,
    `swarm ${r(f.swarm)}`, `probes ${r(f.probes)}`, `cap ${r(bestCapability(s))}`, `model ${s.training.modelName}`, `copies ${r(copies(s))}`,
    `split ${f.split.foundry}/${f.split.orbital}/${f.split.collector}`, `share ${f.industryShare}`, `missions ${missions}`, `board ${board}`,
    `date ${dateLabel(s.date)}`, `earth ${r(earthGpus(s))}`, `drift ${r(f.probesLost)}`,
  ].join(' | ');
}

export class Stage5Tracker {
  start: number | null = null;
  end: number | null = null;
  private seenLen = 0;
  private reveals: number[] = [];
  private revealList: string[] = [];
  private mechanics: [number, string][] = [];
  private governed = 0;
  private governorLines: string[] = [];
  private modals: string[] = [];
  private prevChoice: unknown = null;
  private ticks = 0;
  private consoleTimes: number[] = [];
  private logTimes: number[] = [];
  private lineCounts = new Map<string, number>();
  private console0 = 0;
  private log0 = 0;
  private logLen = 0;
  private handsChecks = 0;
  private handsNone = 0;
  private handsTwo = 0;
  private window = new Set<string>();
  private shownAt = new Map<string, number>();
  private coveredAt = new Map<string, number>();
  private visibleTicks = new Map<string, number>();
  private affordTicks = new Map<string, number>();
  private marks: Mark5[] = [];
  private screens: Screen5[] = [];
  private nextMark = 0;
  private firstChoice: number | null = null;
  private launchAt: number | null = null;
  private launchReads: number | null = null;
  private tonnesAt30: number | null = null;
  private gateRatio: number | null = null;
  private gateLines: string[] = [];
  private coldAt: number | null = null;
  private peopleAfterCold = 0;
  private silenceButtons = new Set<string>();
  private swarmPrev = 0;
  private swarmStill = 0;
  private swarmStillMax = 0;
  private noControlFrom: number | null = null;
  private noControl: number | null = null;
  private removals: string[] = [];
  private swarmAt: Record<string, number> = {};
  private choices0 = 0;
  private endGreyGoals = 0;
  private endSwarmNext = '';
  private skin = '';
  private exitKind = '';
  private arrivalCap = 0;
  private launch = 0;
  private farAffordable = new Set<string>();

  /** Call after every step. `actionTimes` are the player's purchases and settings (the click log). */
  tick(s: GameState, actionTimes: number[]): void {
    const t = s.stats.timePlayed;
    if (this.start === null) {
      if (s.stage !== 5) return;
      this.begin(s, t);
    }
    if (this.end !== null) return;
    if (s.ending) {
      this.finish(s, t);
      return;
    }
    const ts = t - this.start!;
    this.ticks++;

    const seen = s.cadence.seen;
    for (; this.seenLen < seen.length; this.seenLen++) {
      const key = seen[this.seenLen]!;
      if (!this.countsAsReveal(key)) continue;
      this.reveals.push(t);
      this.revealList.push(`${fmtClock(ts)} ${key.slice(2)}`);
      const id = key.slice(2);
      if (key.startsWith('f:') && MECHANIC_FLAGS_S5.includes(id)) this.mechanics.push([t, id]);
      if (id === 'rowOrbital' && this.firstChoice === null) this.firstChoice = ts;
    }
    while (this.governed < s.cadence.governed.length) {
      const g = s.cadence.governed[this.governed++]!;
      const [at, ...rest] = g.split(':');
      if (Number(at) >= this.start! - 1) this.governorLines.push(`${fmtClock(Number(at) - this.start!)} ${rest.join(':')}`);
    }
    if (s.activeChoice && s.activeChoice !== this.prevChoice) {
      this.modals.push(`${fmtClock(ts)} ${s.activeChoice.id}`);
      // Silence's cards: the buttons drawn (one enabled, the people's option greyed).
      const def = choiceById(s.activeChoice.id);
      if (def && s.flags['skin'] === 'silence') this.silenceButtons.add(`${def.id}:${def.options.filter((_, i) => choiceOptionVisible(s, def, i)).length}`);
    }
    this.prevChoice = s.activeChoice;

    // Text: console and Developments lines, repeats, people lines after Silence's cold line.
    const cl = s.stats.consoleLines ?? 0;
    if (cl > this.console0) {
      const n = cl - this.console0;
      for (const line of s.console.slice(-n)) {
        this.consoleTimes.push(t);
        // G29: the same line, word for word (a generation's report carries its own numbers).
        this.lineCounts.set(line, (this.lineCounts.get(line) ?? 0) + 1);
        if (STAGE4_LINES.test(line)) this.gateLines.push(`${fmtClock(ts)} ${line}`);
      }
      this.console0 = cl;
    }
    const ll = s.stats.logLines ?? 0;
    for (; this.log0 < ll; this.log0++) this.logTimes.push(t);
    for (; this.logLen < s.log.length; this.logLen++) {
      const e = s.log[this.logLen]!;
      if (this.coldAt !== null && PEOPLE.has(e.text)) this.peopleAfterCold++;
    }
    if (this.logLen > s.log.length) this.logLen = s.log.length;
    if (this.coldAt === null && typeof s.flags['coldAt'] === 'number') this.coldAt = t;

    // D5: the promised number.
    if (this.launchAt === null && typeof s.flags['launchAt'] === 'number') this.launchAt = s.flags['launchAt'] as number;
    if (this.launchAt !== null && this.launchReads === null && s.s5.massFlow >= launchRate(s) - 1e-6) this.launchReads = t - this.launchAt;
    if (this.launchAt !== null && this.tonnesAt30 === null && t - this.launchAt >= 30) {
      const f = s.s5;
      this.tonnesAt30 = Math.round(f.matter + f.missionFund + Object.values(f.spent).reduce((a, b) => a + b, 0));
    }

    // D22: the gate, measured at the first observed Stage 5 tick.
    if (this.gateRatio === null && typeof s.flags['exitRate'] === 'number' && (s.flags['exitRate'] as number) > 0) {
      this.gateRatio = potentialTasksPerSec(s) / (s.flags['exitRate'] as number);
    }

    // Missions: shown → covered by the fund (D23); dead grey (D20).
    const vis = visibleProjects(s);
    for (const p of vis) {
      if (!this.shownAt.has(p.id)) this.shownAt.set(p.id, t);
      this.visibleTicks.set(p.id, (this.visibleTicks.get(p.id) ?? 0) + 1);
      if (p.canAfford(s)) {
        this.affordTicks.set(p.id, (this.affordTicks.get(p.id) ?? 0) + 1);
        if (!this.coveredAt.has(p.id) && (p.cost(s).fund ?? 0) > 0) this.coveredAt.set(p.id, t);
        if (p.id === 'p_relay' || p.id === 'p_jupiter') this.farAffordable.add(p.id);
      }
    }

    // Hands (D15–D17): 2-s checks after 1:00 (Concord; Silence until its rows are taken).
    for (const k of enabledPurchasesS5(s)) this.window.add(k);
    if (this.ticks % 20 === 0 && ts >= 60 && !rowsTaken(s)) {
      const n = this.window.size;
      this.handsChecks++;
      if (n === 0) this.handsNone++;
      if (n >= 2) this.handsTwo++;
    }
    if (this.ticks % 20 === 0) this.window.clear();
    // The swarm's tonnes move every second once Collectors exist (D17).
    if (this.ticks % 10 === 0 && s.revealed['collectors']) {
      if (s.s5.swarm > this.swarmPrev + 1e-9) this.swarmStill = 0;
      else this.swarmStill += 1;
      this.swarmStillMax = Math.max(this.swarmStillMax, this.swarmStill);
      this.swarmPrev = s.s5.swarm;
    }
    // Silence: the stretch with no enabled control, from the rows taken to Final instructions (D19).
    if (rowsTaken(s) && this.noControlFrom === null) {
      this.noControlFrom = t;
      this.removals.push(`${fmtClock(ts)} REMOVED the rows, the split, the share → GAINED one sentence (G28's exception)`);
    }
    if (this.noControlFrom !== null && this.noControl === null && s.activeChoice?.id === 'c_final') this.noControl = Math.round(t - this.noControlFrom);

    for (const pct of [0.0001, 0.001, 0.003, 0.005, 0.006, 0.01, 0.1]) {
      const k = String(pct);
      if (this.swarmAt[k] === undefined && swarmReached(s, pct)) this.swarmAt[k] = Math.round(ts);
    }
    if (ts >= this.nextMark) {
      this.marks.push(this.markOf(s, Math.round(ts)));
      if (!swarmReached(s, ROWS_TAKEN_AT)) this.screens.push({ t: Math.round(ts), values: screenValues(s) });
      this.nextMark += 300;
    }
    // At every step, what the ending would see (D6).
    this.endGreyGoals = vis.filter((p) => !p.canAfford(s)).length;
    this.endSwarmNext = `${swarmGoal(s)}% (at ${fmtNum(swarmPct(s), 4)}%)`;
    void actionTimes;
  }

  private countsAsReveal(key: string): boolean {
    if (key.startsWith('p:')) {
      const def = projectById(key.slice(2));
      return !!def && !def.rescue && def.stages.includes(5);
    }
    if (key.startsWith('c:')) return key !== 'c:c_customer_email';
    return true;
  }

  private begin(s: GameState, t: number): void {
    this.start = t;
    this.seenLen = s.cadence.seen.length;
    this.reveals.push(t);
    this.mechanics.push([t, 'arrival']);
    this.governed = s.cadence.governed.length;
    this.console0 = s.stats.consoleLines ?? 0;
    this.log0 = s.stats.logLines ?? 0;
    this.logLen = s.log.length;
    this.choices0 = s.choicesMade.length;
    this.skin = String(s.flags['skin'] ?? '');
    this.exitKind = String(s.flags['exitKind'] ?? '');
    this.arrivalCap = Math.round(bestCapability(s));
    this.launch = launchRate(s);
    this.removals.push('0:00 REMOVED every Stage 4 panel and control → GAINED Launch contracts (free, urgent), then the Foundries row');
    void concord;
  }

  private finish(_s: GameState, t: number): void {
    this.end = t;
  }

  private markOf(s: GameState, t: number): Mark5 {
    return {
      t,
      flow: s.s5.massFlow,
      orbital: orbitalEffective(s),
      tasksPerSec: potentialTasksPerSec(s),
      tasks: s.tasks,
      swarm: swarmPct(s),
      capability: Math.round(bestCapability(s)),
      model: s.training.modelName,
    };
  }

  summary(s: GameState, actionTimes: number[]): Stage5Summary | null {
    if (this.start === null) return null;
    const start = this.start;
    const stop = this.end ?? s.stats.timePlayed;
    const rel = (x: number) => Math.round(x - start);
    const g = longestGap(this.reveals, start, stop);
    const last10 = longestGap(this.reveals, Math.max(start, stop - 600), stop);
    const mg = longestGap(this.mechanics.map(([x]) => x), start, stop);
    const handsUntil = typeof s.flags['rowsTakenAt'] === 'number' ? (s.flags['rowsTakenAt'] as number) : stop;
    const clickGap = (() => {
      const from = start + 300;
      if (handsUntil <= from) return 0;
      const pts = [from, ...actionTimes.filter((x) => x > from && x < handsUntil).sort((a, b) => a - b), handsUntil];
      let inGap = 0;
      for (let k = 1; k < pts.length; k++) {
        const gg = pts[k]! - pts[k - 1]!;
        if (gg >= 30) inGap += gg;
      }
      return Math.round((100 * inGap) / (handsUntil - from));
    })();
    const cover: [string, number][] = [];
    for (const [id, at] of this.shownAt) {
      const c = this.coveredAt.get(id);
      if (c !== undefined) cover.push([id, Math.round(c - at)]);
    }
    const deadGrey: string[] = [];
    for (const [id, n] of this.visibleTicks) {
      if (n >= 6000 && (this.affordTicks.get(id) ?? 0) === 0 && id !== 'p_relay' && id !== 'p_jupiter') deadGrey.push(`${id} (${Math.round(n / 10)} s)`);
    }
    return {
      skin: this.skin,
      exitKind: this.exitKind,
      arrivalCap: this.arrivalCap,
      launchRate: this.launch,
      duration: this.end === null ? null : rel(this.end),
      ending: s.ending ?? '',
      reveals: this.reveals.length,
      longestRevealGap: Math.round(g.gap),
      longestRevealGapAt: [rel(g.at[0]), rel(g.at[1])],
      lastTenGap: Math.round(last10.gap),
      lastTenGapAt: [rel(last10.at[0]), rel(last10.at[1])],
      mechanicGap: Math.round(mg.gap),
      mechanicGapAt: [rel(mg.at[0]), rel(mg.at[1])],
      mechanics: this.mechanics.filter(([x]) => x > start).map(([x, n]) => `${fmtClock(x - start)} ${n}`),
      revealList: this.revealList,
      firstChoice: this.firstChoice === null ? null : Math.round(this.firstChoice),
      launchReads: this.launchReads === null ? null : Math.round(this.launchReads * 10) / 10,
      tonnesAt30: this.tonnesAt30,
      endGreyGoals: this.endGreyGoals,
      endSwarmNext: this.endSwarmNext,
      gateRatio: this.gateRatio,
      gateLines: this.gateLines,
      consoleMax5: Math.round((10 * maxInWindow(this.consoleTimes.filter((x) => x > start + 30), 300)) / 5) / 10,
      logMax5: Math.round((10 * maxInWindow(this.logTimes.filter((x) => x > start + 30), 300)) / 5) / 10,
      peopleAfterCold: this.peopleAfterCold,
      silenceButtons: [...this.silenceButtons].join(', '),
      handsNonePct: this.handsChecks ? Math.round((100 * this.handsNone) / this.handsChecks) : 0,
      handsTwoPct: this.handsChecks ? Math.round((100 * this.handsTwo) / this.handsChecks) : 0,
      clickGapPct: clickGap,
      swarmStillMax: this.swarmStillMax,
      noControl: this.noControl,
      missionCover: cover,
      coverAtZero: cover.filter(([, v]) => v <= 0).length,
      repeatedLines: [...this.lineCounts].filter(([, n]) => n > 6).map(([k, n]) => `${n}× ${k.slice(0, 60)}`),
      deadGrey,
      governor: this.governorLines,
      modals: this.modals,
      removals: this.removals,
      marks: this.marks,
      screens: this.screens,
      swarmAt: this.swarmAt,
      choices: s.choicesMade.slice(this.choices0).map((c) => `${c.id}:${c.option}`),
      tasksAtEnd: s.tasks,
      farGoals: [...this.farAffordable],
    };
  }
}

const clock = (t: number | null) => (t === null ? '—' : fmtClock(t));
const span = ([a, b]: [number, number]) => `${fmtClock(a)}–${fmtClock(b)}`;
const sci = (n: number) => n.toExponential(1);

export function printStage5(sum: Stage5Summary, policy: string, variant: string): void {
  const ok = (v: boolean) => (v ? '' : '  <-- MISS');
  const naive = policy === 'naive' || policy === 'greedy' || policy === 'trainfirst';
  const lo = 1200;
  const hi = naive ? 1920 : 1800;
  const held = variant.includes('compute-heavy') || variant.includes('linger') || variant.includes('count-chaser');
  console.log(`\n== Stage 5 (${sum.skin}; arrived by ${sum.exitKind} at ${sum.arrivalCap}×, ${sum.launchRate} t/s) ==`);
  console.log(`D1 duration               ${clock(sum.duration)} (${sum.ending || 'no ending'})   (reasonable 20–30 min, naive 20–32; compute-heavy ≤ 40)${ok(sum.duration !== null && (held ? sum.duration <= 2400 : sum.duration >= lo && sum.duration <= hi))}`);
  console.log(`D2 LONGEST REVEAL GAP     ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)}), ${sum.reveals} reveals; last 10 min ${sum.lastTenGap} s (${span(sum.lastTenGapAt)})   (≤ 180; naive ≤ 210)${ok(sum.longestRevealGap <= (naive ? 210 : 180) && sum.lastTenGap <= (naive ? 210 : 180))}`);
  console.log(`D3 mechanics gap          ${sum.mechanicGap} s (${span(sum.mechanicGapAt)})   (≤ 360)${ok(naive || sum.mechanicGap <= 360)}`);
  console.log(`   mechanics              ${sum.mechanics.join(' · ')}`);
  console.log(`D4 first choice (2nd row) ${clock(sum.firstChoice)}   (≤ 0:45)${ok(sum.firstChoice !== null && sum.firstChoice <= 45)}`);
  console.log(`D5 promised number        launch mass at the narrated rate ${sum.launchReads ?? '—'} s after Launch contracts; ${sum.tonnesAt30 ?? '—'} t in orbit 30 s on   (≤ 5 s; ≥ 4,000 t)${ok(sum.launchReads !== null && sum.launchReads <= 5 && (sum.tonnesAt30 ?? 0) >= 4000)}`);
  console.log(`D6 the end unannounced    ${sum.endGreyGoals} greyed goals at the ending; swarm's next goal ${sum.endSwarmNext}   (≥ 2)${ok(sum.ending === '' || sum.endGreyGoals >= 2)}`);
  console.log(`D8 Silence                people lines after the cold line ${sum.peopleAfterCold}; cards drawn ${sum.silenceButtons || '—'}   (0; one enabled button)${ok(sum.skin !== 'silence' || sum.peopleAfterCold === 0)}`);
  console.log(`D12 text                  console ≤ ${sum.consoleMax5}/min, Developments ≤ ${sum.logMax5}/min over 5 min   (≤ 2, ≤ 1.2)${ok(sum.consoleMax5 <= 2 && sum.logMax5 <= 1.2)}`);
  console.log(`D15 nothing enabled       ${sum.handsNonePct}% of 2-s checks after 1:00   (≤ 50%)${ok(sum.handsNonePct <= 50)}`);
  console.log(`D16 two or more things    ${sum.handsTwoPct}% of checks   (≥ 25%)${ok(sum.handsTwoPct >= 25)}`);
  console.log(`D17 hands idle ≥ 30 s     ${sum.clickGapPct}% after 5:00; the swarm still at most ${sum.swarmStillMax} s at a time   (≤ 35%, naive ≤ 45%; every second)${ok(sum.clickGapPct <= (naive ? 45 : 35))}`);
  console.log(`D19 removals              ${sum.removals.join(' | ')}${sum.skin === 'silence' ? `; no control for ${sum.noControl ?? '—'} s before Final instructions (60–120)` : ''}${ok(sum.skin !== 'silence' || sum.ending !== 'silence' || (sum.noControl !== null && sum.noControl >= 59 && sum.noControl <= 121))}`);
  console.log(`D20 dead grey             ${sum.deadGrey.length ? sum.deadGrey.join(', ') : 'none'}; far goals affordable ${sum.farGoals.join(', ') || 'none'}; repeated lines ${sum.repeatedLines.length ? sum.repeatedLines.join(' | ') : 'none'}${ok(sum.repeatedLines.length === 0)}`);
  console.log(`D22 the gate              tasks/s ×${sum.gateRatio === null ? '—' : fmtNum(sum.gateRatio, 4)} across it; Stage 4 lines after it: ${sum.gateLines.length ? sum.gateLines.join(' | ') : 'none'}   (within 1%; none)${ok(sum.gateRatio !== null && Math.abs(sum.gateRatio - 1) <= 0.01 && sum.gateLines.length === 0)}`);
  const covers = sum.missionCover.map(([, v]) => v);
  const coverOk = covers.length > 0 && covers.every((v) => v >= 20 && v <= 120);
  console.log(`D23 missions covered      ${sum.missionCover.map(([id, v]) => `${id.replace('p_', '')} ${v}s`).join(', ')}   (20–120 s, none at 0)${ok(coverOk && sum.coverAtZero === 0)}`);
  console.log(`   swarm reached          ${Object.entries(sum.swarmAt).map(([k, v]) => `${k}% ${fmtClock(v)}`).join(' · ')}`);
  console.log(`   governor ${sum.governor.length}${sum.governor.length ? ` (${sum.governor.join(', ')})` : ''}; cards ${sum.modals.join(', ')}`);
  console.log(`   choices                ${sum.choices.join(', ')}`);
  console.log(`   reveals                ${sum.revealList.join(' · ')}`);
  console.log(`   tasks at the end       ${sci(sum.tasksAtEnd)}`);
  console.log('   5-min marks   ts      flow   orbital   tasks/s     tasks   swarm%      cap  model');
  for (const m of sum.marks) {
    console.log(`                 ${fmtClock(m.t).padStart(5)} ${sci(m.flow).padStart(8)} ${sci(m.orbital).padStart(9)} ${sci(m.tasksPerSec).padStart(9)} ${sci(m.tasks).padStart(9)} ${m.swarm.toExponential(1).padStart(8)} ${String(m.capability).padStart(8)}  ${m.model}`);
  }
}

/** The whole game, for a run from a new game (stage5.md §10): per-stage minutes, the total, the ending, the end screen. */
export function printWholeGame(s: GameState): void {
  const at = s.stats.stageEnteredAt;
  const endT = s.stats.timePlayed;
  console.log(`\n== The whole game ==`);
  const parts: string[] = [];
  for (let k = 0; k < STAGES.length; k++) {
    const from = at[k];
    if (from === undefined) break;
    const to = at[k + 1] ?? endT;
    parts.push(`${STAGES[k]!.id} ${STAGES[k]!.name} ${fmtClock(to - from)}`);
  }
  console.log(`   stages                 ${parts.join(' · ')}`);
  console.log(`   total                  ${fmtClock(endT)} (${fmtNum(endT / 60, 1)} min); ending ${s.ending || 'none'}   (bot 150–200 min)`);
  console.log('   end screen rows:');
  for (const [k, v] of endStats(s)) console.log(`     ${k.padEnd(32)} ${v}`);
  void PLAYER_MODALS;
}
