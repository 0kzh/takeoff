/**
 * Headless simulator: `npm run sim -- --minutes 60 --seed 1 [--quiet]`.
 * Plays the engine through `actions` at 100 ms steps with no DOM and prints a timeline.
 */
import { newGame, GameState } from '../engine/state.js';
import { step, actions } from '../engine/tick.js';
import { botStep, newBotMemory } from './policy.js';
import { noveltyKeys, isRescueKey } from '../engine/events.js';
import { visibleProjects, projectById } from '../engine/projects.js';
import { researchCap, copies } from '../engine/economy.js';
import { fmtInt, fmtMoney, fmtClock, dateLabel } from '../engine/format.js';

/** The only Node global the sim needs; avoids a dependency on @types/node. */
declare const process: { argv: string[] };

interface Args {
  minutes: number;
  seed: number;
  quiet: boolean;
  stopAtStage: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { minutes: 60, seed: 1, quiet: false, stopAtStage: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--minutes' && v) args.minutes = Number(v);
    if (k === '--seed' && v) args.seed = Number(v);
    if (k === '--stop-at-stage' && v) args.stopAtStage = Number(v);
    if (k === '--quiet') args.quiet = true;
  }
  return args;
}

export interface SimResult {
  state: GameState;
  milestones: Record<string, number>;
  idleGaps: [number, number][];
  lines: string[];
}

export function simulate(args: Args): SimResult {
  const s = newGame(args.seed);
  const mem = newBotMemory();
  const lines: string[] = [];
  const milestones: Record<string, number> = {};
  const idleGaps: [number, number][] = [];
  const out = (t: number, text: string) => lines.push(`${fmtClock(t)}  ${text}`);
  const mark = (key: string, t: number) => {
    if (milestones[key] === undefined) milestones[key] = t;
  };

  let prevRevealed = new Set<string>();
  let prevKeys = new Set<string>();
  let lastNovelty = 0;
  let prevPhase = '';
  let prevStage = s.stage;
  let prevLog = 0;
  let prevChoices = 0;
  let prevRescues = 0;
  let prevShown = new Set<string>();
  const totalTicks = Math.round(args.minutes * 600);

  for (let i = 0; i < totalTicks; i++) {
    botStep(s, actions, mem);
    step(s);
    const t = s.stats.timePlayed;

    for (const id of mem.bought) {
      out(t, `BUY ${projectById(id)?.title ?? id}`);
      mark(`buy:${id}`, t);
    }
    for (const [id, on] of Object.entries(s.revealed)) {
      if (on && !prevRevealed.has(id)) {
        out(t, `REVEAL ${id}`);
        mark(`reveal:${id}`, t);
      }
    }
    prevRevealed = new Set(Object.entries(s.revealed).filter(([, on]) => on).map(([id]) => id));
    for (const p of visibleProjects(s)) {
      if (!prevShown.has(p.id)) {
        out(t, `PROJECT shown: ${p.title}`);
        mark(`shown:${p.id}`, t);
      }
    }
    prevShown = new Set(visibleProjects(s).map((p) => p.id));
    if (s.gpus >= 1) mark('firstGpu', t);

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
      prevPhase = phase;
    }
    if (s.stage !== prevStage) {
      out(t, `STAGE ${prevStage} → ${s.stage} (${dateLabel(s.date)})`);
      mark(`stage${s.stage}`, t);
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
      out(t, `IDLE RESCUE #${s.stats.idleRescues}`);
      prevRescues = s.stats.idleRescues;
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
  return { state: s, milestones, idleGaps, lines };
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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const result = simulate(args);
  for (const line of result.lines) {
    if (args.quiet && !line.startsWith('m')) continue;
    console.log(line);
  }
  const m = result.milestones;
  const fmt = (k: string) => (m[k] !== undefined ? fmtClock(m[k]!) : '—');
  console.log('\n== Stage 1 milestones ==');
  console.log(`first GPU               ${fmt('firstGpu')}   (target ≤ 1:30)`);
  console.log(`Research panel          ${fmt('reveal:research')}   (target ≈ 3:00)`);
  console.log(`Blue-sky Research shown ${fmt('shown:p_insight')}`);
  console.log(`Training Pipeline bought ${fmt('buy:p_training')}`);
  console.log(`first training start    ${fmt('firstTrainingStart')}   (target ≤ 10:00)`);
  console.log(`first release           ${fmt('firstRelease')}`);
  console.log(`Grid Contract shown     ${fmt('shown:p_grid')}`);
  console.log(`Bulk GPU lease shown    ${fmt('shown:p_compute_deal')}`);
  console.log(`Usage pricing shown     ${fmt('shown:p_pricing')}`);
  console.log(`Series A shown          ${fmt('shown:p_series_a')}`);
  console.log(`First Datacenter shown  ${fmt('shown:p_datacenter')}`);
  console.log(`First Datacenter bought ${fmt('buy:p_datacenter')}   (target 25:00–35:00)`);
  console.log(`idle rescues            ${result.state.stats.idleRescues}`);
  console.log(`IDLE GAPs > 60 s        ${result.idleGaps.length ? result.idleGaps.map(([a, b]) => `${fmtClock(a)}–${fmtClock(b)}`).join(', ') : 'none'}`);
}

if (process.argv[1] && /bot\.js$/.test(process.argv[1])) main();
