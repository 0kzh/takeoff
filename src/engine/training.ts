import { GameState, TrainingRun, Focus, Cost, say, logNews, canPay, pay, bump, isBought, counter, press } from './state.js';
import { rng, rand, randInt, chance, pick, poisson } from './rng.js';
import { activeGpus, effGpus, S2_FUNDS_SCALE } from './infrastructure.js';
import { researchCap, researchRate } from './economy.js';
import { openChoice, secondsToNextCalendarModal, MODAL_SPACING } from './events.js';
import { TRAINING_FLAVOR, TRAINING_EVENTS, EVALUATOR_LINES, RELEASE_LINES, REDTEAM_LINES, RELEASE_HEADLINES } from '../data/flavor.js';
import { INCIDENTS } from '../data/crises.js';
import { fmtNum, fmtClock, fmtMoneyShort } from './format.js';
import { visibleProjects } from './projects.js';
import { crawlRate, synthRate, flywheelRate, moveGov } from './world.js';

export const EVAL_SECONDS = 5;
export const BENCHMARKS = ['Coding', 'Research', 'Persuasion', 'Agency', 'Bio', 'Cyber'] as const;
export const EVALUATORS = ['HumanBench', 'Tech press', 'Enterprise analyst', 'Safety Institute'] as const;
const BENCH_WEIGHT = [0.9, 0.6, 0.5, 0.55, 0.3, 0.35];
/** Crossing each tier bumps the major version: Sage-2 at 2×, Sage-3 at 4×, … */
export const MAJOR_TIERS = [2, 4, 8, 16, 32, 64];
export const FRONTIER_SCORE = 32;
/** Insight each public release brings the lab (critic round 2 §6.7: insight was dead UI for an efficient player). */
export const RELEASE_INSIGHT = 6;
/** A run this close below a named tier is called the tier (Stage 2). */
export const NEAR_MISS = 0.98;
export const LEADERBOARD_SCORE = 36;
export const RED_TEAM_SECONDS = 8;
export const RED_TEAM_SECONDS_EVALS = 5;
/** Stage 2: 8 s per issue, 4 s once Automated evals exist. */
export const RED_TEAM_SECONDS_S2 = 8;
export const RED_TEAM_SECONDS_AUTO = 4;
/** The superhuman-coder line: the Stage 2 exit needs a released model at this capability. */
export const SUPERHUMAN_CODER = 4;
/** Joint statement: a public release at 4× or more waits this long for the outside evaluator. */
export const OUTSIDE_EVAL_SECONDS = 30;

export function majorFor(capability: number): number {
  let major = 1;
  for (const t of MAJOR_TIERS) if (capability >= t - 1e-9) major++;
  return major;
}

/**
 * Training costs depend on the capability the run starts from, not on how many runs came before,
 * so every mix of focuses pays the same to reach a capability and nothing jumps at a stage
 * boundary (stage2.md §2.5). One continuous function of `c` per cost, for the whole game: the
 * Stage 2 spec's constants hold from `COST_KNEE` (1.6×) up; below it the compute and funds curves
 * are steeper, so a first run at 1.0× trains fully on the fleet a player has at minute six.
 */
export const COST_KNEE = 1.6;
/** Every run keeps at least this share of its nominal gain, however little compute it had. */
export const MIN_YIELD = 0.3;

/** The run waiting in evaluation or red-team (the release slot), if any. */
export function evalRun(s: GameState): TrainingRun | null {
  const r = s.training.run;
  return r && r.phase !== 'training' ? r : null;
}

/** The run in its training phase, in either slot (a second pipeline trains while the first waits). */
export function trainingRun(s: GameState): TrainingRun | null {
  const t = s.training;
  if (t.pending) return t.pending;
  return t.run && t.run.phase === 'training' ? t.run : null;
}

/** Finds a run in either slot by id (choices refer to runs by id). */
export function runById(s: GameState, id: unknown): TrainingRun | undefined {
  const t = s.training;
  if (t.run && t.run.id === id) return t.run;
  if (t.pending && t.pending.id === id) return t.pending;
  return undefined;
}

/** The capability the next run starts from: the best model so far, deployed, internal or waiting to ship. */
export function startCapability(s: GameState): number {
  const waiting = evalRun(s);
  return Math.max(s.capability, s.training.internalCapability, waiting && waiting.capAfter > 0 ? waiting.capAfter : 0);
}

/** Research `21,000 × (c/1.6)^5`: ≈ 2,000 at 1.0×, 15,200 at 1.5×, 24,500 at 1.65×. */
export function researchFor(c: number): number {
  return Math.round(21000 * Math.pow(c / COST_KNEE, 5));
}

/** Funds `$25,000 × (c/1.6)^8` from the knee up; exponent 9.5 below it: ≈ $290 at 1.0×, $13,500 at 1.5×. */
export function fundsFor(c: number): number {
  return Math.round(25000 * Math.pow(c / COST_KNEE, c >= COST_KNEE ? 8 : 9.5));
}

/**
 * Stage 2 funds per run: `$25,000 × (c/1.6)^F2` at scale 1. stage2.md §2.5 has F2 = 8; with the
 * built economy the last runs (3.6–4.0×) then cost a spender minutes of saving (see the tuning
 * notes in docs/stages.md), so Stage 2 uses a gentler exponent.
 */
export const S2_FUNDS_EXPONENT = 7;

/** Scale-1 base of a Stage 2 run (stage2.md has $25,000; the held lots and Train now made the stage a minute or two short). */
export const S2_RUN_BASE = 29000;

export function fundsForS2(c: number): number {
  return Math.round(S2_RUN_BASE * Math.pow(c / COST_KNEE, S2_FUNDS_EXPONENT));
}

/**
 * Data `1.8 T × (c/1.6)^3` (Stage 2, from the second run): 2.6 T at 1.8×, 11.9 T at 3.0×.
 * stage2.md has 2.0 T; 1.8 keeps the mid-stage data wall to the length its paper model had.
 */
export const DATA_BASE = 1.5;

export function dataFor(c: number): number {
  return Math.round(10 * DATA_BASE * Math.pow(c / COST_KNEE, 3)) / 10;
}

/**
 * GPUs of training compute a run wants: `1,000 × (c/1.6)^7.5` from the knee up (≈ 1,260 at
 * 1.65×); exponent 10 below it (≈ 9 at 1.0×, 125 at 1.3×, 520 at 1.5×). Rented fleets top out
 * near a hundred GPUs, so late Stage 1 runs are undertrained — the case for owning compute.
 */
export function computeFor(c: number): number {
  return 1000 * Math.pow(c / COST_KNEE, c >= COST_KNEE ? 7.5 : 10);
}

export function trainCost(s: GameState): Cost {
  const c = startCapability(s);
  if (s.stage < 2) return { research: researchFor(c), funds: fundsFor(c) };
  // Stage 3: runs are research programs (stage3.md §1.1); its build re-bases the price itself.
  if (s.stage >= 3) return { research: researchFor(c) };
  const cost: Cost = { research: researchFor(c), funds: Math.round(fundsForS2(c) * S2_FUNDS_SCALE) };
  if (s.flags['dataEra'] === true) cost.data = dataFor(c);
  return cost;
}

/**
 * Stage 2's compute exponent (stage2.md §2.5 and §9.5's second knob: `N(c) = 1,000 × (c/1.6)^7.5`).
 * 7.2 keeps a player who trains the moment Train lights up from a tail of half-trained runs.
 */
export const S2_COMPUTE_EXPONENT = 7.5;

/** GPUs of training compute the next run wants. */
export function requiredCompute(s: GameState): number {
  const c = startCapability(s);
  if (s.stage >= 2 && c >= COST_KNEE) return 1000 * Math.pow(c / COST_KNEE, S2_COMPUTE_EXPONENT);
  return computeFor(c);
}

/**
 * GPUs the next run would get. Stage 1: the training share of the rented fleet, × Distributed
 * training. Stage 2: the whole active fleet in G4-equivalents (owned hardware trains on everything).
 */
export function trainingCompute(s: GameState): number {
  if (s.stage >= 2) return Math.max(1, effGpus(s));
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  return Math.max(1, activeGpus(s) * s.training.computeShare * mult);
}

/** Share of the nominal gain the run keeps: `clamp(√(have / wanted), 0.3, 1)`. */
export function computeYield(s: GameState): number {
  return Math.min(1, Math.max(MIN_YIELD, Math.sqrt(trainingCompute(s) / requiredCompute(s))));
}

/** `clamp(120 × √(wanted / have), 45, 120)` seconds: a run with four times the compute it wants takes a minute. */
export function trainingDuration(s: GameState): number {
  return Math.min(120, Math.max(45, 120 * Math.sqrt(requiredCompute(s) / trainingCompute(s))));
}

/** The Research Plateau: the next run costs more research than the lab can hold. */
export function atPlateau(s: GameState): boolean {
  const idle = s.stage < 2 ? !s.training.run : trainSlotFree(s);
  return s.revealed['training'] === true && idle && (trainCost(s).research ?? 0) > researchCap(s);
}

/** Seconds the plateau has lasted (0 when there is none). */
export function plateauSeconds(s: GameState): number {
  const at = s.flags['plateauSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

/** "Far beyond anything rentable": the run wants three times the compute it can get. */
export function needsOwnedCompute(s: GameState): boolean {
  return s.stage < 2 && requiredCompute(s) >= 3 * trainingCompute(s);
}

/** Training steals a share of compute while a run is in its training phase. */
export function trainingShare(s: GameState): number {
  const r = trainingRun(s);
  return r && r.elapsed < r.duration ? s.training.computeShare : 0;
}

/** `Sage-2.4`: the next version after the latest model, counting one waiting in the release slot. */
export function nextRunName(s: GameState): string {
  const v = nextVersion(s);
  return `Sage-${v.major}.${v.minor}`;
}

function nextVersion(s: GameState): { major: number; minor: number } {
  const waiting = evalRun(s);
  if (waiting) return { major: waiting.major, minor: waiting.minor + 1 };
  return { major: s.training.major, minor: s.training.minor + 1 };
}

/** The wall that binds the next run, for the sim and the walls' console lines ('' when none does). */
export function trainBlocker(s: GameState): string {
  const t = s.training;
  if (t.cooldown > 0) return `evaluation month — ${Math.ceil(t.cooldown)} s`;
  const cost = trainCost(s);
  if ((cost.research ?? 0) > researchCap(s)) return `lab holds ${fmtNum(researchCap(s), 0)}`;
  if (cost.data && s.data + 1e-9 < cost.data) return `needs ${fmtNum(cost.data, 1)} T data`;
  return '';
}

/**
 * Why Train is grey, and roughly for how long (arc G6: every wait is named): the evaluation
 * month, the pipeline, the lab's size, or the shortfall that will take longest to fill —
 * `short 41,000 research — about 1:20`, `short 5.6 T data — about 2:10`, `short $1.2M — about 0:45`.
 */
export function trainWait(s: GameState): string {
  const t = s.training;
  if (!s.revealed['training']) return '';
  if (t.cooldown > 0) return `evaluation month — ${fmtClock(t.cooldown)}`;
  if (!trainSlotFree(s)) return 'waiting for the pipeline';
  const cost = trainCost(s);
  const cap = researchCap(s);
  const fixes = s.stage === 2 ? runFixNames(s) : '';
  if ((cost.research ?? 0) > cap) return `needs ${fmtNum(cost.research ?? 0, 0)} research; the lab holds ${fmtNum(cap, 0)}${fixes ? ` — ${fixes}` : ''}`;
  const waits: [number, string][] = [];
  // Stage 1 names the resource and the time only (`research — about 0:45`: its cost line is right
  // above, and minute 10 stays at 38 numbers); from Stage 2 the shortfall too (critic follow-up B8).
  const amounts = s.stage >= 2;
  const add = (short: number, rate: number, label: string, word: string) => {
    if (short <= 1e-9) return;
    const eta = rate > 0 ? short / rate : Infinity;
    const what = amounts ? `short ${label}` : word;
    waits.push([eta, `${what}${Number.isFinite(eta) && eta < 3600 ? ` — about ${fmtClock(eta)}` : ''}`]);
  };
  add((cost.research ?? 0) - s.research, researchRate(s), `${fmtNum((cost.research ?? 0) - s.research, 0)} research`, 'research');
  if (cost.data) add(cost.data - s.data, crawlRate(s) + synthRate(s) + flywheelRate(s), `${fmtNum(cost.data - s.data, 1)} T data`, 'data');
  add((cost.funds ?? 0) - s.funds, s.stats.revPerSec, fmtMoneyShort(Math.ceil((cost.funds ?? 0) - s.funds)), 'money');
  waits.sort((x, y) => y[0] - x[0]);
  const top = waits[0]?.[1] ?? '';
  // Stage 2: a wall with a card on screen names the card (critic C9: `needs 11.6 T data — Synthetic data`).
  if (fixes && cost.data && top.startsWith('short') && top.includes(' T data')) return `needs ${fmtNum(cost.data - s.data, 1)} T data — ${fixes}`;
  if (fixes && top.includes(' research')) return `${top} — ${fixes}`;
  return top;
}

/** The cards that answer the wall in front of the next run, by id (drawn urgent while it stands). */
const RUN_FIXES = ['p_research_cluster', 'p_exp_scheduler', 'p_checkpoint_farm', 'p_lab_cluster', 'p_floor', 'p_desks', 'p_ai_assistants', 'p_synth', 'p_license_code', 'p_license_archive', 'p_beg_data'];

/** `Synthetic data, License the code hosts`: the urgent run fixes on screen ('' when none). */
export function runFixNames(s: GameState): string {
  const names = visibleProjects(s)
    .filter((p) => RUN_FIXES.includes(p.id) && (p.rescue || p.urgent?.(s) === true))
    .map((p) => p.title);
  if (atPlateau(s) && s.revealed['expandLab'] && s.trust >= 1) names.push('Expand Lab');
  return names.join(', ');
}

/** A slot is free for a new run: none training, and the release slot empty (or a second pipeline). */
export function trainSlotFree(s: GameState): boolean {
  const t = s.training;
  if (t.pending) return false;
  if (!t.run) return true;
  return t.run.phase !== 'training' && isBought(s, 'p_parallel');
}

/** Everything but the money is there for the next run: a free slot, no cooldown, research and data. */
export function runOtherwiseReady(s: GameState): boolean {
  if (!s.revealed['training'] || !trainSlotFree(s) || s.training.cooldown > 0) return false;
  const cost = trainCost(s);
  return s.research >= (cost.research ?? 0) && s.data + 1e-9 >= (cost.data ?? 0);
}

export function canStartTraining(s: GameState): boolean {
  if (!s.revealed['training'] || !trainSlotFree(s) || s.training.cooldown > 0) return false;
  return canPay(s, trainCost(s));
}

/** The Focus row appears after the first release; the first run trains with the default focus. */
export function setFocus(s: GameState, focus: Focus): boolean {
  if (focus !== 'capability' && focus !== 'efficiency' && focus !== 'safety') return false;
  if (!s.revealed['focus']) return false;
  s.training.focus = focus;
  return true;
}

/**
 * Stage 2's short run (critic C3): with everything else ready and at least this share of the money,
 * the run can start now on what the money buys and keep that share of its gain (it still spends all
 * its research and data). Waiting for the full price is the other choice.
 */
export const TRAIN_NOW_SHARE = 0.4;
/** Train now is offered only when the full run is at least this far away (seconds of income). */
export const TRAIN_NOW_WAIT = 30;

export function canTrainNow(s: GameState): boolean {
  if (s.stage !== 2 || !s.revealed['trainNow'] || !runOtherwiseReady(s)) return false;
  const price = trainCost(s).funds ?? 0;
  if (!(price > 0 && s.funds < price && s.funds >= TRAIN_NOW_SHARE * price)) return false;
  return fullRunWait(s) >= TRAIN_NOW_WAIT;
}

/** Seconds of income until the full run's price is in hand. */
export function fullRunWait(s: GameState): number {
  const price = trainCost(s).funds ?? 0;
  return Math.max(0, price - s.funds) / Math.max(1, s.stats.revPerSec);
}

/**
 * The share of its gain a run on part of the money keeps: a smaller run is worth more than its
 * share of the price (the square root of it: 40 % of the money keeps 63 %), times the compute yield.
 */
export function moneyShareYield(share: number): number {
  return Math.sqrt(Math.max(0, Math.min(1, share)));
}

export function trainNowYield(s: GameState): number {
  const price = trainCost(s).funds ?? 0;
  return price > 0 ? moneyShareYield(s.funds / price) * computeYield(s) : 0;
}

export function trainNow(s: GameState): boolean {
  if (!canTrainNow(s)) return false;
  const cost = trainCost(s);
  const paid = Math.floor(s.funds);
  const share = moneyShareYield(paid / (cost.funds ?? 1));
  const ok = startRun(s, { ...cost, funds: paid }, share);
  if (ok) press(s, 'trainNow');
  return ok;
}

export function startTraining(s: GameState): boolean {
  if (!canStartTraining(s)) return false;
  return startRun(s, trainCost(s), 1);
}

function startRun(s: GameState, cost: Cost, moneyYield: number): boolean {
  const t = s.training;
  const yieldNow = computeYield(s);
  const duration = Math.round(trainingDuration(s));
  const capBefore = startCapability(s);
  const version = nextVersion(s);
  const synthetic = cost.data && s.data > 0 ? Math.min(1, s.dataSynthetic / s.data) : 0;
  pay(s, cost);
  const run: TrainingRun = {
    id: t.nextRunId++,
    name: `Sage-${version.major}.${version.minor}`,
    focus: t.focus,
    phase: 'training',
    elapsed: 0,
    duration,
    computeYield: yieldNow,
    moneyYield,
    evalElapsed: 0,
    flavorShown: 0,
    eventAt: chance(s, 0.3) ? rand(s, 0.35, 0.7) : -1,
    eventId: '',
    gambleAt: 0.25,
    gamble: 'none',
    capBefore,
    capAfter: 0,
    gainBonus: 0,
    capMult: 1,
    benchBonus: [0, 0, 0, 0, 0, 0],
    benchmarks: [],
    scores: [],
    issues: 0,
    issuesFound: 0,
    extraIssues: 0,
    major: version.major,
    minor: version.minor,
    syntheticShare: synthetic,
    alignShare: s.alignShare,
  };
  if (t.run) t.pending = run;
  else t.run = run;
  t.runIndex += 1;
  s.stats.trainings += 1;
  // Copies now differ from GPUs: the Copies line appears with the first run that diverts compute
  // (from Stage 2; in Stage 1 the Training panel's own line says half the GPUs are training).
  if (s.stage >= 2) s.revealed['copies'] = true;
  if (run.focus === 'safety') bump(s, 'safetyRuns');
  if (moneyYield < 0.999) {
    say(s, `Training ${run.name} now, on ${fmtMoneyShort(cost.funds ?? 0)}: it keeps ${Math.round(moneyYield * yieldNow * 100)}% of its gain.`);
  } else {
    say(s, `Training ${run.name}. Half the compute is diverted.`);
    if (yieldNow < 0.999) say(s, `Not enough compute: this run trains to ${Math.round(yieldNow * 100)}%.`);
  }
  if (s.stage >= 2) startedInStage2(s, run);
  return true;
}

/** Stage 2 bookkeeping when a run starts: the data era, the evals-month trigger, run start times. */
function startedInStage2(s: GameState, run: TrainingRun): void {
  bump(s, 'runsS2');
  if (s.flags['dataEra'] !== true) {
    s.flags['dataEra'] = true;
    say(s, 'The run after this one will want data. The lab has none it has not used.');
  }
  if (run.focus === 'capability' && run.capBefore >= 2.5 && s.flags['evalsMonthDue'] === undefined) {
    s.flags['evalsMonthDue'] = true;
  }
}

/** Dev helper: skip to the end of the current phase. */
export function finishTraining(s: GameState): boolean {
  const run = trainingRun(s) ?? s.training.run;
  if (!run) return false;
  if (run.phase === 'training') run.elapsed = run.duration;
  else if (run.phase === 'evaluating') run.evalElapsed = EVAL_SECONDS;
  else return false;
  return true;
}

export function updateTraining(s: GameState, dt: number): void {
  const t = s.training;
  if (t.cooldown > 0) {
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.cooldown <= 0) say(s, 'The evaluation month is over. Training can resume.');
  }
  if (t.releaseWait > 0) {
    t.releaseWait = Math.max(0, t.releaseWait - dt);
    if (t.releaseWait <= 0 && t.run?.phase === 'redteam') say(s, `The outside evaluators sign off. ${t.run.name} can ship.`);
  }
  const run = t.run;
  if (run?.phase === 'training') updateRunning(s, run, dt, true);
  else if (run?.phase === 'evaluating') {
    run.evalElapsed += dt;
    if (run.evalElapsed >= EVAL_SECONDS) finishEvaluation(s, run);
  }
  if (t.pending) updateRunning(s, t.pending, dt, false);
  if (t.redTeamRemaining > 0) {
    t.redTeamRemaining -= dt;
    if (t.redTeamRemaining <= 0) {
      t.redTeamRemaining = 0;
      const r = t.run;
      if (r && r.phase === 'redteam' && r.issues > 0) {
        r.issues -= 1;
        say(s, r.issues === 0 ? 'Red team signs off. Ready to release.' : `${pick(s, REDTEAM_LINES)} ${r.issues} open.`);
      }
    }
  }
}

/** `slotFree`: the release slot can take the run when it finishes (false for the second pipeline). */
function updateRunning(s: GameState, run: TrainingRun, dt: number, slotFree: boolean): void {
  if (run.elapsed < run.duration) {
    run.elapsed += dt;
    const progress = run.elapsed / run.duration;
    // One flavour line per run, at the halfway mark (critic round 2 §6.1: the console is for
    // lines that carry a number or an instruction).
    if (run.flavorShown < 1 && progress >= 0.5) {
      const pool = TRAINING_FLAVOR[1] ?? [];
      run.flavorShown = 1;
      if (pool.length) say(s, pick(s, pool));
    }
    if (run.gambleAt >= 0 && run.gamble === 'none' && progress >= run.gambleAt) offerGamble(s, run);
    if (run.eventAt >= 0 && !run.eventId && progress >= run.eventAt) applyTrainingEvent(s, run);
  }
  if (run.elapsed >= run.duration) {
    run.elapsed = run.duration;
    if (!slotFree) {
      const key = `waitSaid:${run.id}`;
      if (!s.flags[key]) {
        s.flags[key] = true;
        say(s, `${run.name} is trained. It waits until ${s.training.run?.name ?? 'the last model'} ships.`);
      }
      return;
    }
    run.phase = 'evaluating';
    run.evalElapsed = 0;
    computeResults(s, run);
    say(s, `Training complete. Evaluating ${run.name}.`);
  }
}

/** "Can I try something?" — Stage 1: at most every other run, three times. Stage 2: once, on the first Capability run from 2.2×. */
export const GAMBLES_PER_STAGE = 3;

function offerGamble(s: GameState, run: TrainingRun): void {
  // Stage 3 brings its own events; nothing from Stage 2 opens a modal there (critic follow-up B6).
  if (s.stage >= 3) {
    run.gamble = 'declined';
    return;
  }
  const last = s.flags['lastGambleRun'];
  const count = (s.flags['gamblesThisStage'] as number) || 0;
  // Stage 1: never on the first run (it is the tutorial run), then every other run.
  let rested = s.stage === 1 && run.id <= 1 ? false : typeof last !== 'number' || run.id - last >= 2;
  let allowed = count < GAMBLES_PER_STAGE;
  if (s.stage >= 2) {
    // Stage 2 budget (stage2.md §5.2): at most one, on the first Capability run from ≥ 2.2×.
    rested = true;
    allowed = count < 1 && run.focus === 'capability' && run.capBefore >= 2.2;
  }
  // A passing offer: it never delays a modal on the calendar.
  const clear = secondsToNextCalendarModal(s) >= MODAL_SPACING;
  if (allowed && rested && clear && openChoice(s, 'c_gamble', { runId: run.id }, { onlyIfFree: true })) {
    run.gamble = 'offered';
    s.flags['gamblesThisStage'] = count + 1;
    s.flags['lastGambleRun'] = run.id;
  } else {
    run.gamble = 'declined';
    // Stage 2 offers it on one run only: the first that qualifies, whether or not a modal could open.
    if (s.stage >= 2 && allowed) s.flags['gamblesThisStage'] = 1;
  }
}

function applyTrainingEvent(s: GameState, run: TrainingRun): void {
  const ev = pick(s, TRAINING_EVENTS);
  run.eventId = ev.id;
  let bench = -1;
  switch (ev.id) {
    case 'loss_spike':
      run.duration = s.stage >= 2 ? Math.min(120, run.duration + 10) : run.duration + 10;
      break;
    case 'lucky_seed':
      run.duration = Math.max(run.elapsed + 1, run.duration - 10);
      break;
    case 'contamination':
      // Costs a quarter of what the run gains; a release is never worse than the model before it.
      run.capMult *= 0.75;
      break;
    case 'emergent':
      bench = randInt(s, 0, BENCHMARKS.length - 1);
      run.benchBonus[bench]! += 1;
      run.gainBonus += 0.01;
      break;
  }
  // A console line carries its number (critic round 2: a number or an instruction).
  const numbered: Record<string, string> = {
    contamination: 'Data contamination found in the eval set. The run gains a quarter less.',
    emergent: `Emergent ability: ${BENCHMARKS[bench] ?? 'a benchmark'} up a tier.`,
  };
  say(s, numbered[ev.id] ?? ev.line);
}

/**
 * Stage 1: Capability focus +12–18 %; Efficiency and Safety +5 % (their real payoff is copies per
 * GPU and alignment, applied at release). Stage 2 (smaller, more even steps, so runs come every
 * 3–5 minutes): Capability +10–14 %, Efficiency and Safety +7 %.
 */
export function focusBase(s: GameState, run: TrainingRun): number {
  if (s.stage >= 2) return run.focus === 'capability' ? 0.10 + 0.02 * (rng(s) + rng(s)) : 0.07;
  // Triangular on 14–20 %: the same swing as before, two points higher (a fast lab still reaches 1.5×).
  return run.focus === 'capability' ? 0.14 + 0.03 * (rng(s) + rng(s)) : 0.05;
}

function computeResults(s: GameState, run: TrainingRun): void {
  // Everything a run gains — focus, lucky events, the frontier bonus — scales with its compute.
  const gain = (focusBase(s, run) + run.gainBonus + s.training.frontierBonus) * run.computeYield * (run.moneyYield ?? 1) * run.capMult;
  run.capAfter = run.capBefore * (1 + gain);
  // Within 2 % below a named tier, the evaluators call it the tier (Stage 2: no 4-minute run for a
  // hair at 3.97×). The rename below prints "good enough to be called Sage-N".
  if (s.stage === 2) {
    const tier = MAJOR_TIERS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS * x && run.capBefore < x);
    if (tier) run.capAfter = tier;
  }
  run.benchmarks = BENCHMARKS.map((_, i) => {
    const base = 10 * (1 - Math.exp(-run.capAfter * BENCH_WEIGHT[i]! * 0.8));
    const noisy = base + rand(s, -0.4, 0.4) + run.benchBonus[i]!;
    return Math.round(Math.min(10, Math.max(0, noisy)) * 10) / 10;
  });
  const lambda = Math.max(0.3, 2 + run.capAfter / 3 - safetyInvestment(s, run));
  run.issuesFound = poisson(s, lambda) + run.extraIssues;
  run.issues = run.issuesFound;
  run.scores = scoreCards(s, run);
  // A run that crosses a tier takes the new name now, so a run started behind it is numbered after it.
  const newMajor = majorFor(run.capAfter);
  if (newMajor > run.major) {
    s.flags[`renamedFrom:${run.id}`] = run.name;
    run.major = newMajor;
    run.minor = 0;
    run.name = `Sage-${newMajor}`;
  }
}

function safetyInvestment(s: GameState, run: TrainingRun): number {
  let v = (run.focus === 'safety' ? 1.5 : 0) + (isBought(s, 'p_eval_team') ? 0.5 : 0) + (isBought(s, 'p_alignment_team') ? 1 : 0);
  // Every Safety run released takes 0.5 off the issue rate of every later run (critic round 2 §5:
  // Safety removes the incident risk that shipped issues carry). Stage 2 adds Automated evals.
  v += 0.5 * counter(s, 'safetyReleases');
  if (s.stage >= 2 && isBought(s, 'p_auto_evals')) v += 0.5;
  return v;
}

function clampScore(v: number): number {
  return Math.round(Math.min(10, Math.max(0, v)));
}

function scoreCards(s: GameState, run: TrainingRun): number[] {
  const rel = run.capAfter / run.capBefore - 1;
  const avg = run.benchmarks.reduce((a, b) => a + b, 0) / run.benchmarks.length;
  const n = () => rand(s, -1, 1);
  const focusCap = run.focus === 'capability' ? 1 : 0;
  const focusEff = run.focus === 'efficiency' ? 2 : 0;
  const focusSafe = run.focus === 'safety' ? 2 : 0;
  return [
    clampScore(2.5 + avg * 0.6 + rel * 8 + n()),
    clampScore(4 + rel * 10 + focusCap + n()),
    clampScore(5 + focusEff + rel * 5 - run.issuesFound * 0.3 + n()),
    clampScore(8 + focusSafe - run.issuesFound * 0.8 + (s.alignmentApparent - 50) / 10 + n()),
  ];
}

export function totalScore(run: TrainingRun): number {
  return run.scores.reduce((a, b) => a + b, 0);
}

export function evaluatorLine(runId: number, card: number, score: number): string {
  const lines = EVALUATOR_LINES[card]!;
  const bucket = score >= 8 ? lines.high : score >= 5 ? lines.mid : lines.low;
  return bucket[(runId + card) % bucket.length]!;
}

function finishEvaluation(s: GameState, run: TrainingRun): void {
  run.phase = 'redteam';
  const total = totalScore(run);
  const renamed = s.flags[`renamedFrom:${run.id}`];
  if (typeof renamed === 'string') {
    delete s.flags[`renamedFrom:${run.id}`];
    say(s, `${renamed} is good enough to be called ${run.name}.`);
  }
  const frontier = total >= FRONTIER_SCORE ? ' Frontier model.' : '';
  say(s, `Evaluation done.${frontier} ${issueWords(run.issuesFound)}`);
  s.training.frontierBonus = total >= FRONTIER_SCORE ? 0.01 : 0;
  if (total >= LEADERBOARD_SCORE) s.flags['leaderboardEligible'] = true;
  const maxBench = Math.max(...run.benchmarks);
  if (maxBench > ((s.flags['maxBenchmark'] as number) || 0)) s.flags['maxBenchmark'] = maxBench;
  if (s.stage >= 2 && run.capAfter >= SUPERHUMAN_CODER) {
    if (!s.flags['sage3Said']) {
      s.flags['sage3Said'] = true;
      say(s, `${run.name} writes better code than anyone at OpenMind. The evals team ran the test twice.`);
    }
    if (s.flags['pactSigned'] === true) {
      s.training.releaseWait = OUTSIDE_EVAL_SECONDS;
      say(s, `Outside evaluation — 0:30 until ${run.name} can ship.`);
    }
  }
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** `No issues for the red team.` / `Three issues for the red team.` */
function issueWords(n: number): string {
  const count = n < WORDS.length ? WORDS[n]! : String(n);
  return n === 0 ? 'No issues for the red team.' : `${count} issue${n === 1 ? '' : 's'} for the red team.`;
}

export function canRedTeam(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && run.issues > 0 && s.training.redTeamRemaining <= 0;
}

export function redTeamSeconds(s: GameState): number {
  if (s.stage >= 2) return isBought(s, 'p_auto_evals') ? RED_TEAM_SECONDS_AUTO : RED_TEAM_SECONDS_S2;
  return isBought(s, 'p_eval_team') ? RED_TEAM_SECONDS_EVALS : RED_TEAM_SECONDS;
}

export function redTeam(s: GameState): boolean {
  if (!canRedTeam(s)) return false;
  const t = s.training;
  t.redTeamDuration = redTeamSeconds(s);
  t.redTeamRemaining = t.redTeamDuration;
  s.flags['redTeamed'] = true;
  return true;
}

/** Choices that are about the release itself; the button waits while one is open. */
const RELEASE_CHOICES = ['c_sage2', 'c_ship_issues'];

export function canRelease(s: GameState): boolean {
  const run = s.training.run;
  return !!run && run.phase === 'redteam' && !(s.activeChoice && RELEASE_CHOICES.includes(s.activeChoice.id));
}

/** The public Release button: also waits on the outside evaluators (the joint statement). */
export function canReleasePublic(s: GameState): boolean {
  return canRelease(s) && s.training.releaseWait <= 0;
}

/**
 * `Release` is always allowed. The first time it would ship open issues, a confirm modal says
 * so; the first Sage-2 asks whether the public gets it.
 */
export function release(s: GameState): boolean {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam' || !canReleasePublic(s)) return false;
  if (run.issues > 0 && !s.flags['shipIssuesAsked']) {
    openChoice(s, 'c_ship_issues', { runId: run.id, issues: run.issues });
    return true;
  }
  return releaseChecked(s, run);
}

/** Keep internal (Stage 2, after the Sage-2 choice): research gets the model, customers do not. */
export function releaseInternal(s: GameState): boolean {
  const run = s.training.run;
  if (s.stage < 2 || !s.revealed['releaseInternal'] || !run || !canRelease(s)) return false;
  return doRelease(s, run, false);
}

/** Release after the open-issues confirm (or without it). */
export function releaseChecked(s: GameState, run: TrainingRun): boolean {
  if (!s.flags['sage2Decided'] && majorFor(run.capAfter) >= 2) {
    openChoice(s, 'c_sage2', { runId: run.id });
    return true;
  }
  return doRelease(s, run, true);
}

export function doRelease(s: GameState, run: TrainingRun, isPublic: boolean): boolean {
  const t = s.training;
  if (t.run !== run) return false;
  t.run = null;
  t.redTeamRemaining = 0;
  t.releaseWait = 0;
  t.major = run.major;
  t.minor = run.minor;
  t.modelName = run.name;
  applyFocusRewards(s, run);
  s.stats.releases += 1;
  s.flags['releasedAt'] = s.stats.timePlayed;
  t.models.push({ name: run.name, capability: run.capAfter, date: s.date, public: isPublic });
  t.internalCapability = Math.max(t.internalCapability, run.capAfter);
  // The first release is when the second run becomes possible: the Focus row appears now.
  s.revealed['focus'] = true;
  if (s.stage >= 2) releasedInStage2(s, run, isPublic);
  if (run.focus === 'safety' && s.stage < 3) bump(s, 'safetyReleases');
  if (isPublic) {
    t.deployedName = run.name;
    s.capability = run.capAfter;
    s.hypeBoost = Math.max(s.hypeBoost, 2.0);
    s.stats.publicReleases += 1;
    if (s.flags['firstReleaseAt'] === undefined) s.flags['firstReleaseAt'] = s.stats.timePlayed;
    // A clean release earns Trust; one that ships open issues earns none (critic round 2 §5).
    const line = pick(s, RELEASE_LINES).replace('{name}', run.name);
    if (run.issues === 0) {
      s.trust += 1;
      say(s, `${line} +1 Trust.`);
    } else {
      say(s, `${line} No Trust: ${run.issues} open issue${run.issues === 1 ? '' : 's'} shipped.`);
    }
    // What a release teaches the lab: insight for the cards that need it (Stage 1–2).
    if (s.stage < 3 && s.insightUnlocked) s.insight += RELEASE_INSIGHT;
    logNews(s, `OpenMind releases ${run.name}. ${pick(s, RELEASE_HEADLINES)}`);
    if (run.issues > 0) scheduleIncidents(s, run.issues, run.name);
  } else if (s.stage >= 2) {
    const first = counter(s, 'internalReleases') === 1;
    if (first) s.researchMult *= 1.25;
    say(s, first
      ? `${run.name} stays internal. Research runs 25% faster; customers keep ${t.deployedName}.`
      : `${run.name} stays internal. The research copies run it; customers keep ${t.deployedName}.`);
  } else {
    s.researchMult *= 1.25;
    s.lead += 1;
    say(s, `${run.name} stays internal. Research runs 25% faster.`);
  }
  bump(s, 'releasesThisStage');
  s.flags['lastReleaseAt'] = s.stats.timePlayed;
  // The second pipeline's run moves into the release slot.
  if (t.pending) {
    t.run = t.pending;
    t.pending = null;
  }
  return true;
}

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Stage 2 consequences of a release (stage2.md §2.7, §2.8, §2.11): the lead over Baiwen,
 * alignment bookkeeping (apparent and true), the Safety Institute when evals are shared.
 */
function releasedInStage2(s: GameState, run: TrainingRun, isPublic: boolean): void {
  const superhuman = run.capAfter >= SUPERHUMAN_CODER;
  if (run.focus === 'capability' && run.capBefore >= 2) s.alignmentTrue = clamp100(s.alignmentTrue - 2);
  if (run.focus === 'efficiency') s.alignmentTrue = clamp100(s.alignmentTrue - 0.5);
  if (run.focus === 'safety') bump(s, 'safetyReleasesS2');
  if (run.issuesFound > 0 && run.issues === 0) s.alignmentApparent = clamp100(s.alignmentApparent + 1);
  if (run.syntheticShare > 0.5) s.alignmentTrue = clamp100(s.alignmentTrue - 2);
  if (run.alignShare >= 0.1 - 1e-9) {
    s.alignmentApparent = clamp100(s.alignmentApparent + 1);
    s.alignmentTrue = clamp100(s.alignmentTrue + 2);
  } else if (run.alignShare >= 0.05 - 1e-9) {
    s.alignmentApparent = clamp100(s.alignmentApparent + 0.5);
    s.alignmentTrue = clamp100(s.alignmentTrue + 1);
  }
  if (isPublic) {
    s.lead -= 0.15;
    if (run.issues > 0) s.alignmentTrue = clamp100(s.alignmentTrue - run.issues);
    if (s.shareEvals) {
      moveGov(s, 1);
      s.alignmentApparent = clamp100(s.alignmentApparent + 1);
      s.lead -= 0.1;
    }
    if (superhuman && !s.flags['sage3Released']) {
      s.flags['sage3Released'] = 'public';
      s.lead -= 0.5;
    }
    // The Safety Institute reads every transcript of a model this strong.
    if (run.capAfter >= 3 && s.alignmentApparent < 55) s.scheduled.push({ id: 'inc_advisory', delay: 20, source: run.name });
  } else {
    bump(s, 'internalReleases');
    s.lead += superhuman ? 1 : 0.5;
    if (superhuman && !s.flags['sage3Released']) s.flags['sage3Released'] = 'internal';
  }
  if (superhuman) s.flags['superhumanReleased'] = true;
}

/**
 * What a run changes when it ships, for the evaluation line (critic C5): `copies per GPU 1.88 → 2.35`,
 * `measured alignment 62 → 70`, or the capability step itself.
 */
export function focusChange(s: GameState, run: TrainingRun): string {
  if (run.focus === 'efficiency') return `copies per GPU ${fmtNum(s.copiesPerGPU, 2)} → ${fmtNum(s.copiesPerGPU * 1.25, 2)}`;
  if (run.focus === 'safety') return `measured alignment ${Math.round(s.alignmentApparent)} → ${Math.round(Math.min(100, s.alignmentApparent + 8))}`;
  return `capability ${fmtNum(run.capBefore, 2)}× → ${fmtNum(run.capAfter, 2)}×`;
}

function applyFocusRewards(s: GameState, run: TrainingRun): void {
  if (run.focus === 'efficiency') s.copiesPerGPU *= 1.25;
  if (run.focus === 'safety') {
    s.alignmentApparent = Math.min(100, s.alignmentApparent + 8);
    s.alignmentTrue = Math.min(100, s.alignmentTrue + 5);
  }
}

/** Releasing with open issues schedules incidents over the next 2–4 minutes, traced to `source`. */
function scheduleIncidents(s: GameState, issues: number, source: string): void {
  const count = Math.min(3, 1 + Math.floor((issues - 1) / 2));
  for (let i = 0; i < count; i++) {
    const inc = pick(s, INCIDENTS);
    s.scheduled.push({ id: inc.id, delay: rand(s, 120, 240), source });
  }
}

/** Tooltips of the two release buttons once a run at 4× or more is in red-team (no modal: stage2.md §5.2). */
export function superhumanTooltips(s: GameState): { release: string; internal: string } | null {
  const run = s.training.run;
  if (!run || run.phase !== 'redteam' || run.capAfter < SUPERHUMAN_CODER) return null;
  return {
    release: 'Every engineer on Earth gets a colleague who does not sleep. Market grows; approval −6; lead −0.5 months.',
    internal: `OpenMind keeps the only one. Research takes it at once; lead +1 month; the public keeps ${s.training.deployedName}.`,
  };
}
