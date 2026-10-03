/**
 * Headless simulator: `npm run sim -- --minutes 45 --seed 1 [--policy bot|naive] [--quiet] [--json]`.
 * Plays the engine through `actions` at 100 ms steps with no DOM, prints a timeline and a summary.
 */
import { newGame, GameState } from '../engine/state.js';
import { step, actions } from '../engine/tick.js';
import { policyStep, newBotMemory, PolicyName } from './policy.js';
import { noveltyKeys, isRescueKey } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { researchCap, copies, copiesIdle } from '../engine/economy.js';
import { fmtInt, fmtMoney, fmtClock, dateLabel } from '../engine/format.js';

/** The only Node global the sim needs; avoids a dependency on @types/node. */
declare const process: { argv: string[]; exitCode?: number };

interface Args {
  minutes: number;
  seed: number;
  quiet: boolean;
  json: boolean;
  policy: PolicyName;
  stopAtStage: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { minutes: 60, seed: 1, quiet: false, json: false, policy: 'bot', stopAtStage: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--minutes' && v) args.minutes = Number(v);
    if (k === '--seed' && v) args.seed = Number(v);
    if (k === '--stop-at-stage' && v) args.stopAtStage = Number(v);
    if (k === '--policy' && (v === 'bot' || v === 'naive')) args.policy = v;
    if (k === '--quiet') args.quiet = true;
    if (k === '--json') args.json = true;
  }
  return args;
}

/** Rescue content does not count as a reveal: it is the game noticing a stall, not new content. */
const RESCUE_PROJECTS = ['p_beg_power', 'p_press'];
const RESCUE_CHOICES = ['c_customer_email'];

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
  /** Idle rescues in Stage 1 (Stage 2 has no content yet, so its rescues are not counted). */
  idleRescues: number;
  rescuesAtZeroTasks: number;
  /** Stretches in Stage 1 where nothing was produced, or the copies sat without power, for 60 s+. */
  softLocks: [number, number][];
  reveals: number;
  /** When each Abilene rung was bought (site, interconnect, substation, break ground). */
  ladder: (number | null)[];
  /** First-time reveals that matter for pacing: Research and Projects panels, Grid Contract bought. */
  research: number | null;
  projects: number | null;
  grid: number | null;
}

export interface SimResult {
  state: GameState;
  milestones: Record<string, number>;
  idleGaps: [number, number][];
  lines: string[];
  summary: Summary;
}

function longestGap(times: number[], end: number): { gap: number; at: [number, number]; over: [number, number][] } {
  const sorted = [...times].filter((t) => t <= end).sort((x, y) => x - y);
  let gap = 0;
  let at: [number, number] = [0, 0];
  const over: [number, number][] = [];
  let prev = 0;
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

export function simulate(args: Args): SimResult {
  const s = newGame(args.seed);
  const mem = newBotMemory(args.policy);
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
  let transition: number | null = null;
  let capAtTransition: number | null = null;

  let prevKeys = new Set<string>();
  let lastNovelty = 0;
  let prevPhase = '';
  let prevStage = s.stage;
  let prevLog = 0;
  let prevChoices = 0;
  let prevRescues = 0;
  let prevPresses = 0;
  let prevShown = new Set<string>();
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

  for (let i = 0; i < totalTicks; i++) {
    policyStep(s, actions, mem);
    step(s);
    const t = s.stats.timePlayed;

    for (const id of mem.bought) {
      out(t, `BUY ${projectById(id)?.title ?? id}`);
      mark(`buy:${id}`, t);
      noveltyTimes.push(t);
    }
    for (const [id, on] of Object.entries(s.revealed)) {
      if (on && !seenFlags.has(id)) {
        seenFlags.add(id);
        reveal(t, `REVEAL ${id}`);
        mark(`reveal:${id}`, t);
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
        }
      }
    }
    prevShown = new Set(visible.map((p) => p.id));
    const choice = s.activeChoice?.id;
    if (choice && !seenChoices.has(choice)) {
      seenChoices.add(choice);
      if (!RESCUE_CHOICES.includes(choice)) reveal(t, `MODAL ${choice}`);
      else out(t, `MODAL ${choice}`);
    }
    if (s.gpus >= 1) mark('firstGpu', t);
    if (s.stats.powerPresses > prevPresses) {
      for (let k = prevPresses; k < s.stats.powerPresses; k++) pressTimes.push(t);
      prevPresses = s.stats.powerPresses;
    }

    const run = s.training.run;
    const phase = run ? `${run.name}:${run.phase}` : '';
    if (phase !== prevPhase) {
      if (run) {
        const extra = run.phase === 'training' ? ` (${run.focus}, ${run.duration}s, yield ${run.computeYield.toFixed(2)})`
          : run.phase === 'redteam' ? ` (cap ${run.capAfter.toFixed(2)}, score ${run.scores.reduce((x, y) => x + y, 0)}/40, issues ${run.issuesFound})` : '';
        out(t, `TRAIN ${run.name} → ${run.phase}${extra}`);
        if (run.phase === 'training') mark('firstTrainingStart', t);
      } else {
        const m = s.training.models[s.training.models.length - 1]!;
        out(t, `RELEASE ${m.name} (${m.public ? 'public' : 'internal'}, capability ${m.capability.toFixed(2)})`);
        mark('firstRelease', t);
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
      out(t, `CHOICE ${c.id} → ${c.option}`);
      prevChoices = s.stats.choices;
    }
    if (s.stats.idleRescues > prevRescues) {
      out(t, `IDLE RESCUE #${s.stats.idleRescues} (tasks ${fmtInt(s.tasks)})`);
      if (s.tasks <= 0) rescuesAtZero++;
      if (s.stage === 1) stage1Rescues++;
      prevRescues = s.stats.idleRescues;
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
  const rg = longestGap(revealTimes, horizon);
  const ng = longestGap(noveltyTimes, horizon);
  const stage1Presses = pressTimes.filter((t) => t <= horizon);
  let worstWindow = 0;
  for (let k = 0; k < stage1Presses.length; k++) {
    let n = 0;
    while (k + n < stage1Presses.length && stage1Presses[k + n]! - stage1Presses[k]! < 300) n++;
    worstWindow = Math.max(worstWindow, n);
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
    research: milestones['reveal:research'] ?? null,
    projects: milestones['reveal:projects'] ?? null,
    grid: milestones['buy:p_grid'] ?? null,
    ladder: ['p_site', 'p_interconnect', 'p_substation', 'p_datacenter'].map((id) => {
      const at = milestones[`buy:${id}`];
      return at === undefined ? null : Math.round(at);
    }),
  };
  return { state: s, milestones, idleGaps, lines, summary };
}

function minuteLine(s: GameState, minute: number): string {
  const vis = visibleProjects(s)
    .map((p) => `${p.title}${p.canAfford(s) ? '*' : ''}`)
    .join(', ');
  const run = s.training.run;
  const training = run ? ` | ${run.name} ${run.phase}` : '';
  return (
    `m${minute} | ${dateLabel(s.date)} | tasks ${fmtInt(s.tasks)} | ${fmtMoney(s.funds)} | rev/s ${s.stats.revPerSec.toFixed(1)}` +
    ` | price ${s.price.toFixed(2)} | gpus ${fmtInt(s.gpus)} | copies ${fmtInt(copies(s))} | tps ${fmtInt(s.stats.tasksPerSec)}` +
    ` | research ${fmtInt(s.research)}/${fmtInt(researchCap(s))} | insight ${Math.floor(s.insight)} | trust ${s.trust}` +
    ` | res ${s.researchers} lab ${s.labSpace} | mkt ${s.hypeLevel} | cap ${s.capability.toFixed(2)}${training}` +
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
  console.log(`Grid Contract bought     ${fmt('buy:p_grid')}   (target ≤ 6:00)`);
  console.log(`Training Pipeline bought ${fmt('buy:p_training')}`);
  console.log(`first training start     ${fmt('firstTrainingStart')}`);
  console.log(`first release            ${fmt('firstRelease')}`);
  console.log(`Series A bought          ${fmt('buy:p_series_a')}`);
  console.log(`Abilene site reserved    ${fmt('buy:p_site')}`);
  console.log(`Interconnect queue       ${fmt('buy:p_interconnect')}`);
  console.log(`Substation               ${fmt('buy:p_substation')}`);
  console.log(`TRANSITION (Break ground) ${clock(sum.transition)}   (target bot 25:00–35:00, naive 26:00–40:00)`);
  console.log(`capability at transition ${sum.capabilityAtTransition ?? '—'}   (target 1.5–1.8)`);
  console.log(`LONGEST REVEAL GAP       ${sum.longestRevealGap} s (${span(sum.longestRevealGapAt)})   (target ≤ 180 s)`);
  console.log(`reveal gaps > 120 s      ${sum.revealGapsOver120.length ? sum.revealGapsOver120.map(span).join(', ') : 'none'}`);
  console.log(`LONGEST NOVELTY GAP      ${sum.longestNoveltyGap} s (${span(sum.longestNoveltyGapAt)})`);
  console.log(`Buy Power presses        ${sum.powerPresses} (worst 5-min window ${sum.worstPressWindow})   (target ≤ 60, ≤ 10)`);
  console.log(`idle rescues             ${sum.idleRescues} (at 0 tasks: ${sum.rescuesAtZeroTasks})   (target ≤ 2, none at 0)`);
  console.log(`soft-locks               ${sum.softLocks.length ? sum.softLocks.map(span).join(', ') : 'none'}`);
  console.log(`Abilene ladder           ${sum.ladder.map(clock).join(' → ')}`);
  console.log(`IDLE GAPs > 60 s         ${result.idleGaps.length ? result.idleGaps.map(span).join(', ') : 'none'}`);
}

if (process.argv[1] && /bot\.js$/.test(process.argv[1])) main();
