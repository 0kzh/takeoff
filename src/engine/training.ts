import { GameState, TrainingRun, Focus, Cost, say, logNews, canPay, pay, bump, isBought, counter, press } from './state.js';
import { rng, rand, randInt, chance, pick, poisson } from './rng.js';
import { effGpus, S2_FUNDS_SCALE, poweredGpus, s2Scale, G5_COMPUTE, G6_COMPUTE } from './infrastructure.js';
import { researchCap, researchRate, rentQuota, atRentQuota } from './economy.js';
import { openChoice, secondsToNextCalendarModal, MODAL_SPACING } from './events.js';
import { TRAINING_FLAVOR, TRAINING_EVENTS, EVALUATOR_LINES, RELEASE_LINES, REDTEAM_LINES, RELEASE_HEADLINES } from '../data/flavor.js';
import { INCIDENTS } from '../data/crises.js';
import { fmtNum, fmtInt, fmtClock, fmtMoneyShort } from './format.js';
import { visibleProjects } from './projects.js';
import { crawlRate, synthRate, flywheelRate, moveGov, ADVISORY_BELOW, TRUSTED_FROM } from './world.js';

export const EVAL_SECONDS = 5;
export const BENCHMARKS = ['Coding', 'Research', 'Persuasion', 'Agency', 'Bio', 'Cyber'] as const;
export const EVALUATORS = ['HumanBench', 'Tech press', 'Enterprise analyst', 'Safety Institute'] as const;
const BENCH_WEIGHT = [0.9, 0.6, 0.5, 0.55, 0.3, 0.35];
/** Crossing each tier bumps the major version: Sage-2 at 2×, Sage-3 at 4×, Sage-4 at 10× (the next name comes from the vote). */
export const MAJOR_TIERS = [2, 4, 10];
/** Stage 3 rounds a run that lands within 3 % under a named rung up to it (arc G33's 3 %). */
export const S3_RUNGS = [10, 25];
/** A run this close below a named tier or rung is called it (arc G33: within 3 %, Stages 2 and 3). */
export const NEAR_MISS = 0.97;
export const NEAR_MISS_S3 = NEAR_MISS;
export const FRONTIER_SCORE = 32;
/** Insight each public release brings the lab (critic round 2 §6.7: insight was dead UI for an efficient player). */
export const RELEASE_INSIGHT = 6;
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
 * Stage 2 spec's constants hold from `COST_KNEE` (1.6×) up; below it the funds curve is steeper.
 */
export const COST_KNEE = 1.6;

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

/**
 * Research `21,000 × (c/1.6)^5` to two significant figures (owner feedback 1's `Cost: 7,400
 * research`): 2,000 at 1.0×, 15,000 at 1.5×, 25,000 at 1.65×. Stage 3's programs keep every digit.
 */
export function researchFor(c: number, stage = 1): number {
  const raw = 21000 * Math.pow(c / COST_KNEE, 5);
  if (stage >= 3 || raw < 100) return Math.round(raw);
  const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

/**
 * Stage 1's run price (stage1-round3-fixes.md §1): dollars only, `$290 × c^13` to two significant
 * figures — $290 / $1,300 / $5,300 / $23,000 / $100,000 at 1.00 / 1.12 / 1.25 / 1.40 / 1.57×. Research
 * buys cards and nothing else. The exponent is the spec's knob (its 11.5 came from a paper model): at
 * 11.5 the sim's bot ended at 18:20–20:20 and the first-timer at 21:30–22:20 (seeds 1–5), the late runs
 * being paid from a revenue the paper did not foresee. Above about 13 the fifth run would cost more
 * than the Stage 2 quote at the knee. With the Series A at $5,000 and First Datacenter at 200 s of the
 * best revenue, seeds 1–10 end at 20:13–21:41 for the bot and 22:14–24:00 for the first-timers.
 */
export const S1_RUN_BASE = 290;
export const S1_RUN_EXPONENT = 13;

export function fundsFor(c: number): number {
  return twoSig(S1_RUN_BASE * Math.pow(Math.max(1, c), S1_RUN_EXPONENT));
}

/**
 * A Stage 2 run's dollar price, `fundsForS2` at the arrival's scale. From the knee (the wall run) the
 * Stage 1 row quotes it, so the figure does not move when the datacenter opens.
 */
export function stage2RunFunds(s: GameState, c: number): number {
  return Math.round(fundsForS2(c) * S2_FUNDS_SCALE * s2Scale(s));
}

/**
 * Stage 2 funds per run: `$25,000 × (c/1.6)^F2` at scale 1. stage2.md §2.5 has F2 = 8; with the
 * built economy the last runs (3.6–4.0×) then cost a spender minutes of saving (see the tuning
 * notes in docs/stages.md), so Stage 2 uses a gentler exponent.
 */
export const S2_FUNDS_EXPONENT = 7;

/**
 * Scale-1 base of a Stage 2 run (stage2.md has $25,000; the round-2 knob, `stage2-round2-fixes.md` §1).
 * $52,000 since the wallet rule: the run no longer borrows from lots, the first run is not starved,
 * cards cost 70 % of the seconds of what fills funds and runs take 90–120 s, so the stage came several
 * minutes shorter at $32,000. The reasonable bot moves least with it, its stage being mostly training.
 */
export const S2_RUN_BASE = 52000;

export function fundsForS2(c: number): number {
  return Math.round(S2_RUN_BASE * Math.pow(c / COST_KNEE, S2_FUNDS_EXPONENT));
}

/**
 * Data `1.5 T × (c/1.6)^3` (Stage 2, from the second run): 2.1 T at 1.8×, 9.9 T at 3.0×.
 * stage2.md has 2.0 T; 1.5 keeps the mid-stage data wall to the length its paper model had.
 */
export const DATA_BASE = 1.5;

export function dataFor(c: number): number {
  return Math.round(10 * DATA_BASE * Math.pow(c / COST_KNEE, 3)) / 10;
}

/**
 * The GPUs a run needs, a hard requirement (owner feedback 1, B1: no yield): below the knee
 * `10 × c^4.55` rounded to 5 — 10 / 15 / 30 / 45 / 80 at 1.00 / 1.12 / 1.25 / 1.40 / 1.57×, so a
 * rented fleet trains about five models; from the knee the Stage 2 rule `600 × (c/1.6)^7`, two
 * significant figures — 780 at 1.66×, 5,600 at 2.2×, 39,000 at 2.9×, 310,000 at 3.9× — more than
 * any cloud rents (the wall). Stage 3's shell, provisionally, `300,000 × (c/4)^1.3`.
 */
export const GPU_NEED_BASE = 10;
export const GPU_NEED_EXPONENT_S1 = 4.55;
export const GPU_NEED_DC = 600;
export const GPU_NEED_EXPONENT = 7;

export function gpusFor(c: number): number {
  const raw = c < COST_KNEE ? GPU_NEED_BASE * Math.pow(Math.max(1, c), GPU_NEED_EXPONENT_S1) : GPU_NEED_DC * Math.pow(c / COST_KNEE, GPU_NEED_EXPONENT);
  return twoSig(raw);
}

/**
 * Stage 1's wall (stage1-round3-fixes.md §1: five rented runs for every seed). Four Capability runs
 * land at 1.46–1.69×; one that lands just past the knee still trains a fifth model on rented GPUs
 * (85–105 of the 140 the leases allow) before the datacenter curve takes over here.
 */
export const S1_WALL = 1.68;

/** The GPUs a Stage 1 run needs: the rented curve up to the wall, then `gpusFor`'s. */
export function gpusForS1(c: number): number {
  return c < S1_WALL ? twoSig(GPU_NEED_BASE * Math.pow(Math.max(1, c), GPU_NEED_EXPONENT_S1)) : gpusFor(c);
}

/** Stage 3's shell (stage3.md, provisional): `300,000 × (c/4)^1.3`. */
export function gpusForS3(c: number): number {
  return twoSig(300000 * Math.pow(Math.max(1, c) / 4, 1.3));
}

/**
 * Stage 3's research per run (stage3.md §2.5, as-built deltas row 2): `18,000,000 × (c/4)^3`, to
 * three figures — 18.0M for Sage-3.1, 35M at 5×, 144M at 8×, 281M at 10×, 4.4B at 25×. A re-base,
 * not a continuation: the arrival's narration names the number.
 */
export const S3_RUN_BASE = 14000000;
export const S3_RUN_EXPONENT = 3.15;

/**
 * The run price follows the lab that arrives (a departure from §2.5's fixed base). `R(c)` is quoted
 * for the median arrival, whose copies could make `S3_RUN_REF_RATE` research a second with the slider
 * at 40 % once Distillation and code review (bought by every lab in its first minutes) are in. A lab
 * that arrives weaker (a Stage 2 played on Capability alone has half the copies per GPU) pays in
 * proportion; a stronger one pays more by the square root of the ratio only, since the shipments
 * cap how fast any fleet grows. Within 0.5–1.5; measured once on arrival (`flags.runScaleS3`) and
 * named by the narration's price.
 */
export const S3_RUN_REF_RATE = 167000;

export function arrivalRunScale(potential: number): number {
  const ratio = Math.max(1, potential) / S3_RUN_REF_RATE;
  const raw = ratio < 1 ? ratio : Math.sqrt(ratio);
  return Math.round(Math.min(1.5, Math.max(0.5, raw)) * 100) / 100;
}

/** The scale fixed on arrival (1 for a save from before it existed). */
export function runScaleS3(s: GameState): number {
  const v = s.flags['runScaleS3'];
  return typeof v === 'number' && v > 0 ? v : 1;
}

export function researchForS3(c: number, scale = 1): number {
  const raw = S3_RUN_BASE * scale * Math.pow(Math.max(1, c) / 4, S3_RUN_EXPONENT);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / unit) * unit;
}

function twoSig(raw: number): number {
  if (raw < 100) return Math.max(GPU_NEED_BASE, Math.round(raw / 5) * 5);
  const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

export function trainCost(s: GameState): Cost {
  const c = startCapability(s);
  // Stage 1: money and GPUs; research buys cards only. From the knee a run is priced as Stage 2 prices
  // it (a fifth run that lands past 1.6× still rents; the wall run is quoted at what the click charges).
  if (s.stage < 2) return { funds: c < COST_KNEE ? fundsFor(c) : stage2RunFunds(s, c) };
  // Stage 3: a run is a research program and nothing else (stage3.md §2.5): no money, no data.
  if (s.stage >= 3) return { research: researchForS3(c, runScaleS3(s)) };
  const cost: Cost = { research: researchFor(c), funds: stage2RunFunds(s, c) };
  if (s.flags['dataEra'] === true) cost.data = dataFor(c);
  return cost;
}

/** GPUs the next run needs: the capability curve above, a third fewer with Distributed training (Stages 1–2). */
export function gpusNeeded(s: GameState): number {
  if (s.stage >= 4) return 0;
  if (s.stage === 3) return gpusForS3(startCapability(s));
  const n = s.stage === 1 ? gpusForS1(startCapability(s)) : gpusFor(startCapability(s));
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  return mult > 1 ? twoSig(n / mult) : n;
}

/**
 * GPUs a run can use: Stage 1, the rented fleet; Stage 2, the powered fleet in G4-equivalents (a
 * G5 does the work of one and a half), less what a run in training already holds.
 */
export function gpusAvailable(s: GameState): number {
  const all = s.stage >= 2 ? Math.floor(effGpus(s)) : s.gpus;
  return Math.max(0, all - busyGpus(s));
}

/** GPUs held by the run in its training phase (they serve no tasks until it is done). */
export function busyGpus(s: GameState): number {
  const r = trainingRun(s);
  return r && r.elapsed < r.duration ? r.gpus ?? 0 : 0;
}

/** The next run lacks GPUs (Train is blocked by the requirement). */
export function gpusShort(s: GameState): boolean {
  return gpusAvailable(s) < gpusNeeded(s);
}

/**
 * Seconds a run takes, by the GPUs it uses: Stage 1 `45 + 10 × log2(N / 10)` (45–80 s), Stage 2
 * `90 + 8 × log2(N / 1,000)` clamped to 90–120 s (G9's two minutes). Stage 2 was 60–110 s: with the
 * run no longer starved by lots or cards (arc G34) a player who reads the delays is training-bound,
 * and the reasonable bot ended at 31–36 minutes whatever the price.
 */
export function trainingDuration(s: GameState): number {
  const n = Math.max(1, gpusNeeded(s));
  if (s.stage < 2) return Math.min(80, Math.max(45, 45 + 10 * Math.log2(n / 10)));
  // Stage 3: `30 + 6 × log2(N / 300,000)`, 30–60 s, for every run, automatic or not (stage3.md §2.5).
  if (s.stage >= 3) return Math.min(60, Math.max(30, 30 + 6 * Math.log2(n / 300000)));
  return Math.min(120, Math.max(90, 90 + 8 * Math.log2(n / 1000)));
}

/**
 * The Research Plateau: the next run costs more research than the lab can hold. Never in Stage 1,
 * where a run costs no research (the lab's size limits cards only: `cardWall`).
 */
export function atPlateau(s: GameState): boolean {
  if (s.stage < 2) return false;
  return s.revealed['training'] === true && trainSlotFree(s) && (trainCost(s).research ?? 0) > researchCap(s);
}

/**
 * Stage 1's lab wall (stage1-round3-fixes.md §1): a card on screen costs more research than the lab
 * holds. `Lease the floor upstairs`, `Rent desks` and the Experiment tracker key on it.
 */
export function cardWall(s: GameState): boolean {
  if (s.stage !== 1 || !s.revealed['projects']) return false;
  const cap = researchCap(s);
  return visibleProjects(s).some((p) => !p.rescue && (p.cost(s).research ?? 0) > cap);
}

/** Seconds the card wall has stood (0 when there is none). */
export function cardWallSeconds(s: GameState): number {
  const at = s.flags['cardWallSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

/** Cards that make the lab hold more (named under a card it cannot hold, when the lab can pay for them). */
const LAB_CARDS = ['p_lab_cluster', 'p_floor', 'p_desks'];

/**
 * The reason under a Stage 1 card that costs more research than the lab holds (stage1-round3-fixes.md
 * §3): `needs a lab that holds 2,000 — Expand Lab`, naming a fix on screen ('' when the card fits).
 */
export function labReason(s: GameState, research: number): string {
  if (s.stage !== 1 || research <= researchCap(s)) return '';
  const cap = researchCap(s);
  const card = visibleProjects(s).find((p) => LAB_CARDS.includes(p.id) && (p.cost(s).research ?? 0) <= cap);
  const fix = s.revealed['expandLab'] ? 'Expand Lab' : card?.title ?? '';
  return `needs a lab that holds ${fmtInt(research)}${fix ? ` — ${fix}` : ''}`;
}

/** Seconds the plateau has lasted (0 when there is none). */
export function plateauSeconds(s: GameState): number {
  const at = s.flags['plateauSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

/** Stage 1: the next run needs more GPUs than the cloud will ever rent (140 with every lease) — the wall. */
export function needsDatacenter(s: GameState): boolean {
  return s.stage < 2 && gpusNeeded(s) > MAX_RENT_QUOTA;
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
  // A run short of GPUs says so on its own line (trainGpuLine); this line names every shortfall, one
  // clock (arc G34: `short $6.5M and 8,750 research — about 1:22`). Stage 1 names the resource words
  // only (`money — about 0:45`: its cost line is right above, and minute 10 stays at 38 numbers).
  const r = runIncome(s);
  const parts: string[] = [];
  const words: string[] = [];
  let eta = 0;
  const add = (short: number, rate: number, label: string, word: string) => {
    if (short <= 1e-9) return;
    parts.push(label);
    words.push(word);
    eta = Math.max(eta, etaOf(short, rate));
  };
  add((cost.funds ?? 0) - s.funds, r.funds, fmtMoneyShort(Math.ceil((cost.funds ?? 0) - s.funds)), 'money');
  add((cost.research ?? 0) - s.research, r.research, `${fmtNum((cost.research ?? 0) - s.research, 0)} research`, 'research');
  if (cost.data) add(cost.data - s.data, r.data, `${fmtNum(cost.data - s.data, 1)} T data`, 'data');
  if (!parts.length) return '';
  const clock = Number.isFinite(eta) && eta >= 1 && eta < 3600 ? ` — about ${fmtClock(eta)}` : '';
  const what = s.stage >= 2 ? `short ${parts.join(' and ')}` : words.join(' and ');
  // Stage 2: a wall with a card on screen names the card (critic C9: `needs 11.6 T data — Synthetic data`).
  if (fixes && cost.data && s.data + 1e-9 < cost.data && !Number.isFinite(eta)) return `needs ${fmtNum(cost.data - s.data, 1)} T data — ${fixes}`;
  if (s.training.armed) return `${nextRunName(s)} starts when paid for${clock}`;
  return `${what}${clock}${fixes ? ` — ${fixes}` : ''}`;
}

/**
 * The Train row's GPU line (owner feedback 1, B1): what the run needs and, when it is short, the
 * purchase that fixes it — `Needs 35 GPUs for 1:03` · `Needs 45 GPUs. 38 rented. Rent 7 more.` ·
 * `Needs 1,200 GPUs. The cloud will rent 80. Build the First Datacenter.` · `Needs 18,000 GPUs.
 * 14,200 free.` · `Needs 18,000 powered GPUs. 6,000 are dark: add power.`
 */
export function trainGpuLine(s: GameState): string {
  const need = gpusNeeded(s);
  if (need <= 0) return '';
  const have = gpusAvailable(s);
  if (have >= need) return `Needs ${fmtInt(s.stage >= 2 ? twoSig(need / computePerGpu(s)) : need)} GPUs for ${fmtClock(trainingDuration(s))}`;
  if (s.stage < 2) {
    if (needsDatacenter(s)) return `Needs ${fmtInt(need)} GPUs. The cloud will rent ${fmtInt(rentQuota(s))}. Build the First Datacenter.`;
    if (atRentQuota(s) || need > rentQuota(s)) {
      const card = visibleProjects(s).find((p) => QUOTA_CARD_IDS.includes(p.id));
      return `Needs ${fmtInt(need)} GPUs. The cloud rents ${fmtInt(rentQuota(s))}.${card ? ` ${card.title} adds 20.` : ''}`;
    }
    return `Needs ${fmtInt(need)} GPUs. ${fmtInt(have)} rented. Rent ${fmtInt(need - have)} more.`;
  }
  const dark = Math.max(0, s.gpus - poweredGpus(s));
  // Counted in the chips the player owns, as the Stores row counts them (critic S2 round 2 §8.8.2: a
  // G5 counted as 1.5 printed `117,900 free` beside `GPUs 99,400`).
  const k = computePerGpu(s);
  const needN = twoSig(need / k);
  if (dark > 0 && have / k + dark >= need / k) return `Needs ${fmtInt(needN)} powered GPUs. ${fmtInt(dark)} are dark: add power.`;
  return `Needs ${fmtInt(needN)} GPUs. ${fmtInt(Math.floor(have / k))} free.`;
}

/** The fleet's work per chip: 1 for G4s, 1.5 for G5s, 2.5 for G6s, averaged over what is owned. */
export function computePerGpu(s: GameState): number {
  if (s.stage < 2 || s.gpus <= 0) return 1;
  const g6 = s.gpusG6 ?? 0;
  const g5 = s.gpusG5 ?? 0;
  const g4 = Math.max(0, s.gpus - g5 - g6);
  return (g4 + G5_COMPUTE * g5 + G6_COMPUTE * g6) / s.gpus;
}

/** Every rent the cloud will ever allow: the base quota and the three lease cards. */
export const MAX_RENT_QUOTA = 140;

const QUOTA_CARD_IDS = ['p_compute_deal', 'p_region', 'p_reserved'];

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

/** Everything but the money is there for the next run: a free slot, no cooldown, research, data and GPUs. */
export function runOtherwiseReady(s: GameState): boolean {
  if (!s.revealed['training'] || !trainSlotFree(s) || s.training.cooldown > 0 || gpusShort(s)) return false;
  const cost = trainCost(s);
  return s.research >= (cost.research ?? 0) && s.data + 1e-9 >= (cost.data ?? 0);
}

/**
 * What may disable Train (arc G34 rule 4): a requirement, never a price — a free slot, the evaluation
 * month, the GPUs, a lab that can hold the run's research, and Stage 3's Hold.
 */
export function trainRequirementsMet(s: GameState): boolean {
  if (!s.revealed['training'] || !trainSlotFree(s) || s.training.cooldown > 0 || gpusShort(s)) return false;
  // Stage 3: `Training: held` stops the next run from starting (stage3.md §2.5).
  if (s.stage >= 3 && s.flags['holdRuns'] === true) return false;
  if (s.stage < 3 && (trainCost(s).research ?? 0) > researchCap(s)) return false;
  return true;
}

export function canStartTraining(s: GameState): boolean {
  return trainRequirementsMet(s) && canPay(s, trainCost(s));
}

/** Train is pressable: its requirements are met (a short price arms it). */
export function canPressTrain(s: GameState): boolean {
  if (s.stage >= 3 && isBought(s, 'p_auto_train')) return false;
  return trainRequirementsMet(s);
}

/** The Focus row appears after the first release; the first run trains with the default focus. */
export function setFocus(s: GameState, focus: Focus): boolean {
  if (focus !== 'capability' && focus !== 'efficiency' && focus !== 'safety') return false;
  if (!s.revealed['focus']) return false;
  s.training.focus = focus;
  return true;
}

/**
 * The Train button (arc G34 rule 4): with the price in hand the run starts; with something short it
 * is armed and starts by itself once paid for; pressed again while armed, it stands down.
 */
export function startTraining(s: GameState): boolean {
  const t = s.training;
  if (canStartTraining(s)) {
    // Stage 3 counts Train presses by hand (B10: Continual learning should come before the second).
    if (s.stage >= 3 && !isBought(s, 'p_auto_train')) press(s, 'train');
    t.armed = false;
    return startRun(s, trainCost(s));
  }
  if (!canPressTrain(s)) return false;
  t.armed = !t.armed;
  if (s.stage >= 3) press(s, 'train');
  if (t.armed) bump(s, 'armedRuns');
  return true;
}

/** Every tick: an armed run starts the moment it is paid for (requirements met). */
export function fireArmedRun(s: GameState): void {
  const t = s.training;
  if (!t.armed) return;
  if (s.stage >= 3 && isBought(s, 'p_auto_train')) {
    t.armed = false;
    return;
  }
  if (!canStartTraining(s)) return;
  t.armed = false;
  startRun(s, trainCost(s));
}

/** Income a second into each purse a run is paid from (Stage 2–3 funds: what the build share leaves). */
function runIncome(s: GameState): { funds: number; research: number; data: number } {
  const share = (s.stage === 2 || s.stage === 3) && s.revealed['infrastructure'] ? s.buildShare : 0;
  return {
    funds: Math.max(0, s.stats.revPerSec) * (1 - share),
    research: researchRate(s),
    data: s.stage === 2 ? crawlRate(s) + synthRate(s) + flywheelRate(s) : 0,
  };
}

function etaOf(short: number, rate: number): number {
  if (short <= 1e-9) return 0;
  return rate > 0 ? short / rate : Infinity;
}

/** Seconds until the next run is paid for (0 when it is; Infinity when a purse has no income). */
export function runPaidInSeconds(s: GameState): number {
  return runPaidIn(s);
}

/** Seconds until the next run is paid for, after spending `spent` (0 when it already is). */
function runPaidIn(s: GameState, spent: Cost = {}): number {
  const cost = trainCost(s);
  const r = runIncome(s);
  return Math.max(
    etaOf((cost.funds ?? 0) - (s.funds - (spent.funds ?? 0)), r.funds),
    etaOf((cost.research ?? 0) - (s.research - (spent.research ?? 0)), r.research),
    etaOf((cost.data ?? 0) - (s.data - (spent.data ?? 0)), r.data),
  );
}

/**
 * What Stage 1's money is waiting for (arc G34 rule 3; stage1-round3-fixes.md §1): the next run while
 * its slot is free, or, once the next run needs more GPUs than any cloud rents, First Datacenter.
 */
export function waitingGoalS1(s: GameState): { name: string; funds: number } | null {
  if (s.stage !== 1 || !s.revealed['training']) return null;
  if (needsDatacenter(s)) {
    const dc = visibleProjects(s).find((p) => p.id === 'p_datacenter');
    return dc ? { name: 'First Datacenter', funds: dc.cost(s).funds ?? 0 } : null;
  }
  if (!trainSlotFree(s) || s.training.cooldown > 0) return null;
  return { name: nextRunName(s), funds: trainCost(s).funds ?? 0 };
}

/**
 * How much later the waiting run starts if `cost` is spent now (arc G34 rule 3): 0 unless a run waits
 * (its slot free, no evaluation month) and draws on a purse this purchase spends from. Stage 1 counts
 * money only, and at the wall the wait is First Datacenter's.
 */
export function runDelaySeconds(s: GameState, cost: Cost): number {
  if (s.stage === 1) {
    const goal = waitingGoalS1(s);
    if (!goal || !cost.funds) return 0;
    const rate = Math.max(0, s.stats.revPerSec);
    const before = etaOf(goal.funds - s.funds, rate);
    const after = etaOf(goal.funds - (s.funds - cost.funds), rate);
    if (!Number.isFinite(after)) return Number.isFinite(before) ? Infinity : 0;
    return Math.max(0, after - before);
  }
  if (!s.revealed['training'] || s.stage >= 4 || !trainSlotFree(s) || s.training.cooldown > 0) return 0;
  if (s.stage >= 3 && s.flags['holdRuns'] === true) return 0;
  const before = runPaidIn(s);
  const after = runPaidIn(s, cost);
  if (!Number.isFinite(after)) return Infinity;
  return Math.max(0, after - before);
}

/**
 * ` · Sage-2.5 0:41 later` beside a purchase that delays the waiting run by 10 s or more ('' otherwise);
 * in Stage 1 at the wall, ` · First Datacenter 0:55 later`.
 */
export function delayNote(s: GameState, cost: Cost): string {
  const d = runDelaySeconds(s, cost);
  if (d < 10) return '';
  // Stage 3 names the run once, on the Train row (one home per fact): a card says `next run 1:10 later`.
  const name = s.stage === 1 ? waitingGoalS1(s)?.name ?? nextRunName(s) : s.stage >= 3 ? 'next run' : nextRunName(s);
  return ` · ${name} ${Number.isFinite(d) && d < 3600 ? fmtClock(d) : 'much'} later`;
}

function startRun(s: GameState, cost: Cost): boolean {
  const t = s.training;
  const gpus = gpusNeeded(s);
  const serving = Math.max(0, gpusAvailable(s) - gpus);
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
    gpus,
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
  // Stage 3: what went into Experiments goes into this run (+0.25 points a unit, at most +5).
  if (s.stage >= 3) {
    run.gainBonus += Math.min(EXPERIMENTS_MAX, counter(s, 'expPts')) / 100;
    s.flags['expPts'] = 0;
    run.probeFlags = 0;
  }
  if (t.run) t.pending = run;
  else t.run = run;
  t.runIndex += 1;
  s.stats.trainings += 1;
  // Copies now differ from GPUs: the Copies line appears with the first run that diverts compute
  // (from Stage 2; in Stage 1 the Training panel's own line says half the GPUs are training).
  if (s.stage >= 2) s.revealed['copies'] = true;
  if (run.focus === 'safety') bump(s, 'safetyRuns');
  // Stage 3 with Continual learning: runs start themselves every two minutes; the Training panel
  // says so and the console keeps the run's one line for when it is ready.
  if (!(s.stage >= 3 && isBought(s, 'p_auto_train'))) say(s, `Training ${run.name} on ${fmtInt(gpus)} GPUs; ${fmtInt(serving)} keep serving.`);
  if (s.stage === 2) startedInStage2(s, run);
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
        // Stage 3: the button carries the count; the console hears only the sign-off. Stage 1: the
        // count is on the panel, and the red team's flavour goes to Developments once a run (§3).
        if (r.issues === 0) {
          if (s.stage === 1) logNews(s, pick(s, REDTEAM_LINES));
          say(s, `Red team signs off. Ready to ${s.stage >= 3 ? 'approve' : 'release'}.`);
        } else if (s.stage === 2) say(s, `${pick(s, REDTEAM_LINES)} ${r.issues} open.`);
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
    if (run.flavorShown < 1 && progress >= 0.5 && s.stage < 3) {
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
    // A run sent back is retrained for 20 s and keeps the results it was given (stage3.md §2.5).
    if (!(run.sentBack && run.capAfter > 0)) computeResults(s, run);
    // Stage 3 says one line per run when it is ready (readyInStage3): runs come every two minutes.
    // Stage 1's panel says `Evaluating Sage-1.1` for its five seconds; the console keeps the result
    // (stage1-round3-fixes.md §3: at most four lines in any 26 s of the first cycle).
    if (s.stage === 2) say(s, `Training complete. Evaluating ${run.name}.`);
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
  // Stage 1: one flavour line a run in the console (the halfway line); the rest go to Developments (§3).
  if (s.stage === 1) logNews(s, numbered[ev.id] ?? ev.line);
  else say(s, numbered[ev.id] ?? ev.line);
}

/**
 * Stage 1: Capability focus +10–14 %; Efficiency and Safety +5 % (their real payoff is copies per
 * GPU and alignment, applied at release): about five models on the rented fleet to 1.5–1.8×.
 * Stage 2: Capability +7–10 %, Efficiency and Safety +7 % — every run has the GPUs it needs and
 * keeps its whole gain, so the reasonable bot's Capability / Efficiency / Safety cycle and the
 * first-timer's Capability-only runs both reach 4× in 10–12 runs.
 */
export function focusBase(s: GameState, run: TrainingRun): number {
  // Stage 3 (stage3.md §2.5): Capability +16–22 %, Efficiency and Safety +10 %; neuralese ×1.3,
  // thoughts kept in English ×0.9; the step size, once Sage stops asking, ×0.6 / ×1 / ×1.3.
  if (s.stage >= 3) return (run.focus === 'capability' ? 0.16 + 0.03 * (rng(s) + rng(s)) : 0.1) * thoughtsGain(s) * stepFactors(s).gain;
  if (s.stage >= 2) return run.focus === 'capability' ? 0.07 + 0.015 * (rng(s) + rng(s)) : 0.07;
  return run.focus === 'capability' ? 0.10 + 0.02 * (rng(s) + rng(s)) : 0.05;
}

function computeResults(s: GameState, run: TrainingRun): void {
  const gain = (focusBase(s, run) + run.gainBonus + s.training.frontierBonus) * run.capMult;
  run.capAfter = run.capBefore * (1 + gain);
  // Within 3 % below a named tier, the evaluators call it the tier (Stage 2: no 4-minute run for a
  // hair at 3.9×; arc G33). The rename below prints "good enough to be called Sage-N".
  if (s.stage === 2) {
    const tier = MAJOR_TIERS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS * x && run.capBefore < x);
    if (tier) run.capAfter = tier;
  }
  if (s.stage >= 3) {
    const rung = S3_RUNGS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS_S3 * x && run.capBefore < x);
    if (rung) run.capAfter = rung;
  }
  run.benchmarks = BENCHMARKS.map((_, i) => {
    const base = 10 * (1 - Math.exp(-run.capAfter * BENCH_WEIGHT[i]! * 0.8));
    const noisy = base + rand(s, -0.4, 0.4) + run.benchBonus[i]!;
    return Math.round(Math.min(10, Math.max(0, noisy)) * 10) / 10;
  });
  // Stage 3: one or two issues a run, more at the top and under neuralese, fewer for a Safety run.
  const lambda = s.stage >= 3
    ? Math.min(4, Math.max(0.3, 1 + 0.5 * Math.log2(run.capAfter / 4) + (s.flags['neuralese'] === 'neuralese' ? 1 : 0) - (run.focus === 'safety' ? 1 : 0)))
    : Math.max(0.3, 2 + run.capAfter / 3 - safetyInvestment(s, run));
  run.issuesFound = poisson(s, lambda) + run.extraIssues;
  run.issues = run.issuesFound;
  // Interpretability lab II: the probes flag a run by how far the hidden number sits under 70 (§2.5).
  if (s.stage >= 3 && isBought(s, 'p_interp2')) {
    run.probeFlags = Math.min(5, Math.max(0, Math.round((70 - s.alignmentTrue) / 15 + rand(s, -1, 1))));
  }
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
  if (s.stage < 3) say(s, `Evaluation done.${frontier} ${issueWords(run.issuesFound)}`);
  s.training.frontierBonus = total >= FRONTIER_SCORE ? 0.01 : 0;
  if (total >= LEADERBOARD_SCORE) s.flags['leaderboardEligible'] = true;
  const maxBench = Math.max(...run.benchmarks);
  if (maxBench > ((s.flags['maxBenchmark'] as number) || 0)) s.flags['maxBenchmark'] = maxBench;
  if (s.stage >= 3) {
    readyInStage3(s, run);
    return;
  }
  if (s.stage === 2 && run.capAfter >= SUPERHUMAN_CODER) {
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
  if (s.stage >= 3) return RED_TEAM_SECONDS_AUTO;
  if (s.stage >= 2) return isBought(s, 'p_auto_evals') ? RED_TEAM_SECONDS_AUTO : RED_TEAM_SECONDS_S2;
  return isBought(s, 'p_eval_team') ? RED_TEAM_SECONDS_EVALS : RED_TEAM_SECONDS;
}

export function redTeam(s: GameState): boolean {
  if (!canRedTeam(s)) return false;
  if (s.stage >= 3) press(s, 'redteam');
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
  // Stage 3: one button, `Approve`, deploys the run everywhere.
  if (s.stage >= 3) return approve(s);
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
  if (s.stage !== 2 || !s.revealed['releaseInternal'] || !run || !canRelease(s)) return false;
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
  // The first release is when the second run becomes possible. Stage 1 shows the Focus row 30 s later,
  // with its line (stages.ts: the first training cycle is not shared with another mechanic).
  if (s.stage >= 2) s.revealed['focus'] = true;
  if (s.stage === 2) releasedInStage2(s, run, isPublic);
  if (run.focus === 'safety' && s.stage < 3) bump(s, 'safetyReleases');
  if (s.stage >= 3) {
    approvedInStage3(s, run);
  } else if (isPublic) {
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
    if (run.capAfter >= 3 && s.alignmentApparent < ADVISORY_BELOW) s.scheduled.push({ id: 'inc_advisory', delay: 20, source: run.name });
    if (s.alignmentApparent >= TRUSTED_FROM) moveGov(s, 1);
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
/** Efficiency's copies-per-GPU step: ×1.25 in Stage 1, ×1.15 from Stage 2 (its copies compound into every later run's money). */
export function efficiencyStep(s: GameState): number {
  if (s.stage >= 3) return 1.2;
  return s.stage >= 2 ? 1.15 : 1.25;
}

export function focusChange(s: GameState, run: TrainingRun): string {
  if (run.focus === 'efficiency') return `copies per GPU ${fmtNum(s.copiesPerGPU, 2)} → ${fmtNum(s.copiesPerGPU * efficiencyStep(s), 2)}`;
  if (run.focus === 'safety') return `measured alignment ${Math.round(s.alignmentApparent)} → ${Math.round(Math.min(100, s.alignmentApparent + safetyMeasured(s)))}`;
  return `capability ${fmtNum(run.capBefore, 2)}× → ${fmtNum(run.capAfter, 2)}×`;
}

/** What a Safety run adds to measured alignment: +8 (Stages 1–2), +6 (Stage 3). */
function safetyMeasured(s: GameState): number {
  return s.stage >= 3 ? 6 : 8;
}

function applyFocusRewards(s: GameState, run: TrainingRun): void {
  if (run.focus === 'efficiency') s.copiesPerGPU *= efficiencyStep(s);
  if (run.focus === 'safety') {
    s.alignmentApparent = Math.min(100, s.alignmentApparent + safetyMeasured(s));
    // A run sent back already carries its own +1 (Stage 3); Safety's +5 / +4 otherwise.
    if (!run.sentBack) s.alignmentTrue = Math.min(100, s.alignmentTrue + (s.stage >= 3 ? 4 : 5));
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

// ---------- Stage 3: the loop collapses (stage3.md §2.5, §2.6) ----------

/** Thoughts as vectors or as words (c_neuralese): every gain ×1.3 or ×0.9. */
export function thoughtsGain(s: GameState): number {
  const n = s.flags['neuralese'];
  return n === 'neuralese' ? 1.3 : n === 'transparent' ? 0.9 : 1;
}

export type StepSize = 'small' | 'normal' | 'large';

/** `Step size` once Sage stops asking: gains ×0.6 / ×1 / ×1.3, a Capability run's hidden loss ×0.3 / ×1 / ×1.5. */
export function stepFactors(s: GameState): { gain: number; loss: number } {
  const v = s.flags['stepSize'];
  if (v === 'small') return { gain: 0.6, loss: 0.3 };
  if (v === 'large') return { gain: 1.3, loss: 1.5 };
  return { gain: 1, loss: 1 };
}

export type RedteamDepth = 'quick' | 'thorough';

/** `Red-team depth` once Sage red-teams Sage: quick ships the issues, thorough takes 15 s and closes them. */
export function redteamDepth(s: GameState): RedteamDepth {
  return s.flags['redteamDepth'] === 'thorough' ? 'thorough' : 'quick';
}

export const THOROUGH_SECONDS = 15;
export const SEND_BACK_SECONDS = 20;
/** Experiments: at most +5 points on the next run's gain (twenty units of a quarter point). */
export const EXPERIMENTS_MAX = 5;
/** One unit of a research sink (Experiments, Alignment work) is 2 % of the next run's research. */
export const RESEARCH_UNIT_SHARE = 0.02;

/** Sage deploys its own runs: `Stop asking for sign-off`, unless an order took it back. */
export function autoApproveOn(s: GameState): boolean {
  return s.stage >= 3 && isBought(s, 'p_auto_approve') && s.flags['conceded'] !== true;
}

/** The run in the release slot has been evaluated (and, with a thorough red team, reviewed). */
export function runReady(s: GameState): boolean {
  const run = s.training.run;
  return s.stage >= 3 && !!run && run.phase === 'redteam' && !((run.reviewLeft ?? 0) > 0);
}

export function canApprove(s: GameState): boolean {
  return runReady(s) && !autoApproveOn(s);
}

/** `Approve`: the waiting run deploys everywhere (tasks, research, market); open issues ship. */
export function approve(s: GameState): boolean {
  if (!canApprove(s)) return false;
  press(s, 'approve');
  return doRelease(s, s.training.run!, true);
}

export function canSendBack(s: GameState): boolean {
  const run = s.training.run;
  return canApprove(s) && !!run && isBought(s, 'p_interp2') && (run.probeFlags ?? 0) > 0 && !run.sentBack;
}

/**
 * `Send back` (lab II): the flagged run is retrained for 20 s and keeps 70 % of its gain; its hidden
 * change becomes +1 whatever its focus; lead −0.1 (stage3.md §2.5).
 */
export function sendBack(s: GameState): boolean {
  if (!canSendBack(s)) return false;
  const run = s.training.run!;
  const gain = run.capAfter / run.capBefore - 1;
  run.capAfter = run.capBefore * (1 + 0.7 * gain);
  const rung = S3_RUNGS.find((x) => run.capAfter < x && run.capAfter >= NEAR_MISS_S3 * x && run.capBefore < x);
  if (rung) run.capAfter = rung;
  const m = majorFor(run.capAfter);
  if (m < run.major) {
    run.major = m;
    run.minor = (s.training.major === m ? s.training.minor : 0) + 1;
    run.name = `Sage-${m}.${run.minor}`;
  }
  run.sentBack = true;
  run.probeFlags = 0;
  run.phase = 'training';
  run.elapsed = 0;
  run.duration = SEND_BACK_SECONDS;
  run.evalElapsed = 0;
  s.training.redTeamRemaining = 0;
  s.lead = Math.max(-2, s.lead - 0.1);
  press(s, 'sendBack');
  say(s, `${run.name} sent back — 0:20 of retraining. It keeps 70% of its gain.`);
  return true;
}

/** `Training: running / held` (stage3.md §2.5): the only training verb left after the grants. */
export function toggleHold(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['holdRuns']) return false;
  const held = s.flags['holdRuns'] !== true;
  s.flags['holdRuns'] = held;
  s.flags['holdSaidAt'] = s.stats.timePlayed;
  press(s, 'hold');
  say(s, held ? 'Training held. No run starts until it is released.' : 'Training running. The next run starts when it is ready.');
  return true;
}

export function setStepSize(s: GameState, v: StepSize): boolean {
  if (s.stage < 3 || !s.revealed['stepSize'] || !autoApproveOn(s)) return false;
  if (v !== 'small' && v !== 'normal' && v !== 'large') return false;
  if (s.flags['stepSize'] === v || (v === 'normal' && s.flags['stepSize'] === undefined)) return false;
  s.flags['stepSize'] = v;
  press(s, 'stepSize');
  return true;
}

export function setRedteamDepth(s: GameState, v: RedteamDepth): boolean {
  if (s.stage < 3 || !s.revealed['redteamDepth']) return false;
  if (v !== 'quick' && v !== 'thorough') return false;
  if (redteamDepth(s) === v) return false;
  s.flags['redteamDepth'] = v;
  press(s, 'redteamDepth');
  return true;
}

/** Research in one unit of a research sink: 2 % of the next run's price. */
export function researchUnit(s: GameState): number {
  return Math.max(1, Math.round(RESEARCH_UNIT_SHARE * (trainCost(s).research ?? 0)));
}

/** Seconds a purchase of `research` pushes the next run back at today's rate (0 once the run is paid for). */
export function delaySeconds(s: GameState, research: number): number {
  const need = trainCost(s).research ?? 0;
  const short = Math.max(0, need - s.research);
  const after = Math.max(0, need - (s.research - research));
  return Math.max(0, (after - short) / Math.max(1, researchRate(s)));
}

/** `Experiments` (with Continual learning): the next run's gain +0.25 points a unit, at most +5; resets each run. */
export function runExperiments(s: GameState, units = 1): boolean {
  if (s.stage < 3 || !s.revealed['experiments']) return false;
  const room = EXPERIMENTS_MAX - counter(s, 'expPts');
  const n = Math.min(units, Math.floor(room / 0.25 + 1e-9));
  if (n <= 0) return false;
  const cost = n * researchUnit(s);
  if (s.research < cost) return false;
  s.research -= cost;
  s.flags['expPts'] = counter(s, 'expPts') + 0.25 * n;
  press(s, 'experiments');
  return true;
}

/** The next run's Capability step as the Experiments button prints it, in percent: `+18.0%`. */
export function nextGainPct(s: GameState, extraPts = 0): number {
  const base = (s.training.focus === 'capability' ? 0.19 : 0.1) * thoughtsGain(s) * stepFactors(s).gain;
  return 100 * base + Math.min(EXPERIMENTS_MAX, counter(s, 'expPts') + extraPts);
}

/** Stage 3, when an evaluation ends: the ready line, and the thorough red team's 15 s. */
function readyInStage3(s: GameState, run: TrainingRun): void {
  if (isBought(s, 'p_auto_redteam') && redteamDepth(s) === 'thorough') run.reviewLeft = THOROUGH_SECONDS;
  const flags = isBought(s, 'p_interp2') ? ` · probe flags: ${run.probeFlags ?? 0}` : '';
  const issues = run.issues === 0 ? 'no issues open' : `${run.issues} issue${run.issues === 1 ? '' : 's'} open`;
  // Once Sage deploys its own runs the Developments line (`Sage-4.2 deployed. 16.4×.`) says it.
  if (!autoApproveOn(s)) say(s, `${run.name} ready — ${fmtNum(run.capAfter, 2)}× · ${issues}${flags}`);
}

const clampTrue = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Stage 3: an approved run deploys everywhere, and capability is one number from here (stage3.md §1.1,
 * §2.5). The hidden bookkeeping per run; the measured number's bands (§2.14: 80 and over, relations
 * +1; under 55, the Safety Institute's advisory); no Trust, no insight, and no lead change (Stage 3's
 * lead moves by §2.10 only).
 */
function approvedInStage3(s: GameState, run: TrainingRun): void {
  const t = s.training;
  const auto = autoApproveOn(s);
  const before = s.capability;
  t.deployedName = run.name;
  s.capability = run.capAfter;
  s.hypeBoost = Math.max(s.hypeBoost, 1.5);
  s.stats.publicReleases += 1;
  const neuralese = s.flags['neuralese'] === 'neuralese';
  let change = 0;
  if (run.sentBack) change = 1;
  else if (run.focus === 'capability') change = -(neuralese ? 3 : 2) * stepFactors(s).loss;
  else if (run.focus === 'efficiency') change = -0.5;
  if (s.monitorShare >= 0.15 - 1e-9) change += 1;
  if (auto) change -= 1;
  change -= 0.5 * run.issues;
  s.alignmentTrue = clampTrue(s.alignmentTrue + change);
  if (s.shareEvals) {
    s.alignmentApparent = clampTrue(s.alignmentApparent + 1);
    moveGov(s, 1);
  }
  if (s.alignmentApparent >= 80) moveGov(s, 1);
  else if (s.alignmentApparent < 55) s.scheduled.push({ id: 'inc_advisory', delay: 20, source: run.name });
  bump(s, 'approvalsS3');
  logNews(s, `${run.name} deployed. ${fmtNum(run.capAfter, 1)}×.`);
  if (run.issues > 0) {
    say(s, `${run.name} deployed with ${run.issues} open issue${run.issues === 1 ? '' : 's'}.`);
    scheduleIncidents(s, run.issues, run.name);
  }
  if (before < 10 && run.capAfter >= 10) {
    say(s, 'Sage-4. A year of progress every month.');
    s.flags['crossed10At'] = s.stats.timePlayed;
  }
  if (before < 25 && run.capAfter >= 25) {
    say(s, `${run.name} is a better AI researcher than anyone alive. It has started on its successor's design.`);
    s.flags['crossed25At'] = s.stats.timePlayed;
  }
  s.flags['graphDirty'] = true;
}

/**
 * Every tick in Stage 3: the thorough red team's review, Sage deploying its own runs, Continual
 * learning starting the next one, and the Hold reminder.
 */
export function updateTakeoffTraining(s: GameState, dt: number): void {
  if (s.stage < 3) return;
  const run = s.training.run;
  if (run && run.phase === 'redteam' && (run.reviewLeft ?? 0) > 0) {
    run.reviewLeft = Math.max(0, (run.reviewLeft ?? 0) - dt);
    if (run.reviewLeft <= 0 && run.issues > 0) {
      run.issues = 0;
      s.alignmentApparent = clampTrue(s.alignmentApparent + 0.5);
    }
  }
  if (run && runReady(s) && autoApproveOn(s)) doRelease(s, run, true);
  if (isBought(s, 'p_auto_train') && canStartTraining(s)) startTraining(s);
  if (s.flags['holdRuns'] === true && s.stats.timePlayed - counter(s, 'holdSaidAt') >= 180) {
    s.flags['holdSaidAt'] = s.stats.timePlayed;
    say(s, 'Training is held. Research is piling up.');
  }
}

/**
 * `#trainStatus`, the Training panel's line once Continual learning has taken the button:
 * `Sage-3.2 starts when research allows — 1:46`, the GPU shortfall, or `Training: held`.
 */
export function trainStatus(s: GameState): string {
  const running = trainingRun(s);
  if (running && running.elapsed < running.duration) return `${running.name} training — ${fmtClock(Math.ceil(running.duration - running.elapsed))}`;
  if (s.flags['holdRuns'] === true) return 'Training: held. No run starts.';
  if (!trainSlotFree(s)) return `${nextRunName(s)} waits for ${s.training.run?.name ?? 'the last run'} to deploy.`;
  if (gpusShort(s)) return trainGpuLine(s);
  const need = (trainCost(s).research ?? 0) - s.research;
  if (need > 0) {
    const eta = need / Math.max(1, researchRate(s));
    return `${nextRunName(s)} starts when research allows — ${fmtClock(eta)}`;
  }
  return `${nextRunName(s)} starts now.`;
}
