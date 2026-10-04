import { GameState, say, logNews, isBought, addFunds, press, counter, canPay, pay } from './state.js';
import { rand, pick } from './rng.js';
import { fmtNum, fmtInt, monthOf } from './format.js';
import { bestCapability, copies, qualityMult, researchCap } from './economy.js';
import { trainCost } from './training.js';
import { s2 } from './infrastructure.js';
import { RIVAL_LINES } from '../data/flavor.js';
import { stageDef } from './stages.js';

/**
 * The world around the lab in Stage 2 (stage2.md §2.6–§2.10): the data supply, Anthrosoft and
 * Baiwen, government relations, jobs and approval, security. DOM-free; all randomness via rng.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------- data (§2.6) ----------

/** The public web, read once: 15 T at 0.1 T/s. */
export const CRAWL_TOTAL = 15;
export const CRAWL_RATE = 0.1;
/** Data flywheel: customers' tasks become training data. */
export const FLYWHEEL_T_PER_BILLION = 0.6;

/** T/s the crawlers are adding (0 once the web is read). */
export function crawlRate(s: GameState): number {
  return isBought(s, 'p_web_crawl') && s.crawlLeft > 0 ? CRAWL_RATE : 0;
}

/** Synthetic data: `0.006 × √(research copies / 1000)` T/s (stage2.md has 0.004; see tuning notes). */
export const SYNTH_RATE = 0.006;

export function synthRate(s: GameState): number {
  if (!isBought(s, 'p_synth')) return 0;
  return SYNTH_RATE * Math.sqrt((copies(s) * s.researchAlloc) / 1000);
}

/** T/s from the flywheel at the current billing rate. */
export function flywheelRate(s: GameState): number {
  return isBought(s, 'p_flywheel') ? (s.stats.soldPerSec / 1e9) * FLYWHEEL_T_PER_BILLION : 0;
}

/** Every tick: the crawl, the synthetic writers, the flywheel. */
export function updateData(s: GameState, dt: number): void {
  if (s.stage < 2) return;
  const crawl = Math.min(s.crawlLeft, crawlRate(s) * dt);
  if (crawl > 0) {
    s.crawlLeft -= crawl;
    s.data += crawl;
    if (s.crawlLeft <= 1e-9) {
      s.crawlLeft = 0;
      say(s, 'The crawl is finished. There is no more public web to read.');
    }
  }
  const synth = synthRate(s) * dt;
  if (synth > 0) {
    s.data += synth;
    s.dataSynthetic += synth;
  }
  if (isBought(s, 'p_flywheel')) {
    const last = counter(s, 'flywheelSold');
    if (last > 0 && s.tasksSold > last) s.data += ((s.tasksSold - last) / 1e9) * FLYWHEEL_T_PER_BILLION;
    s.flags['flywheelSold'] = s.tasksSold;
  }
}

/** The data wall's named fixes are urgent while the crawl is spent and the next run lacks data. */
export function dataWall(s: GameState): boolean {
  if (s.stage !== 2 || s.flags['dataEra'] !== true || !isBought(s, 'p_web_crawl') || s.crawlLeft > 0) return false;
  const need = trainCost(s).data ?? 0;
  return need > 0 && s.data + 1e-9 < need;
}

/** The next run needs more data than the lab holds, the crawl is spent, and research is half there. */
export function dataShort(s: GameState): boolean {
  if (s.stage !== 2 || s.flags['dataEra'] !== true) return false;
  const cost = trainCost(s);
  if (!cost.data || s.data + 1e-9 >= cost.data) return false;
  return s.crawlLeft <= 0 && s.research >= 0.5 * (cost.research ?? 0);
}

/**
 * Slow tick: counts each time the data wall rises (the licences appear on the second and third),
 * names it in the console, and times the shortfall for the university's offer.
 */
export function dataWallCheck(s: GameState): void {
  const short = dataShort(s);
  const was = s.flags['dataShortNow'] === true;
  if (short && !was) {
    s.flags['dataShortCount'] = counter(s, 'dataShortCount') + 1;
    s.flags['dataShortSince'] = s.stats.timePlayed;
    const need = trainCost(s).data ?? 0;
    say(s, `The Data Wall — the next run needs ${fmtNum(need, 1)} T. The lab holds ${fmtNum(s.data, 1)} T.`);
  }
  if (!short) delete s.flags['dataShortSince'];
  s.flags['dataShortNow'] = short;
}

/** Seconds the current data shortfall has lasted (0 when there is none). */
export function dataShortSeconds(s: GameState): number {
  const at = s.flags['dataShortSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

// ---------- rivals (§2.7) ----------

export const RIVAL_LINES_S2: string[] = [
  'Anthrosoft ships {name}. It matches Sage on everything but price.',
  'Anthrosoft ships {name}. Their safety card is longer than ours.',
];

/**
 * Anthrosoft in Stage 2: `clamp(rival × rand(1.10, 1.22), 0.80 × best, 1.08 × deployed)`, never
 * lower than it was. The market moves with the ratio, and the console says by how much.
 */
export function rivalReleaseS2(s: GameState): void {
  s.rivalVersion += 1;
  const before = qualityMult(s);
  const lo = 0.8 * bestCapability(s);
  const hi = 1.08 * s.capability;
  const next = Math.min(hi, Math.max(lo, s.rivalCapability * rand(s, 1.1, 1.22)));
  s.rivalCapability = Math.max(s.rivalCapability, next);
  s.nextRivalIn = Math.round(rand(s, 240, 420));
  const name = `Cadence-${s.rivalVersion}`;
  recordRival(s, name);
  logNews(s, pick(s, [...RIVAL_LINES, ...RIVAL_LINES_S2]).replace('{name}', name));
  const after = qualityMult(s);
  const deployed = s.training.deployedName;
  if (s.rivalCapability > s.capability && after < before - 1e-6) {
    const pct = Math.max(1, Math.round((1 - after / before) * 100));
    say(s, `Anthrosoft ${name} beats ${deployed}. Market down ${pct}%.`);
  } else if (s.rivalCapability > s.capability) {
    say(s, `Anthrosoft ships ${name}. It is level with ${deployed}.`);
  } else {
    say(s, `Anthrosoft ships ${name}. ${deployed} is still ahead.`);
  }
  s.flags['graphDirty'] = true;
}

/** A dot on the graph's dashed line for each Cadence release (kept in the state for reloads). */
export function recordRival(s: GameState, name: string): void {
  s.rivalHistory.push({ name, capability: Math.round(s.rivalCapability * 1000) / 1000, date: s.date });
  if (s.rivalHistory.length > 40) s.rivalHistory.splice(0, s.rivalHistory.length - 40);
}

/** Baiwen on the graph: OpenMind's own best capability `lead` months earlier, at least 0.7×. */
export function baiwenAt(s: GameState, date: number): number {
  const then = date - s.lead;
  let best = 0.7;
  for (const m of s.training.models) if (m.date <= then) best = Math.max(best, m.capability);
  return best;
}

/** `about 5 months behind`. */
export function leadWords(s: GameState): string {
  const m = Math.round(s.lead * 2) / 2;
  return `about ${fmtNum(m, m % 1 ? 1 : 0)} month${m === 1 ? '' : 's'} behind`;
}

export function moveLead(s: GameState, by: number): void {
  const before = s.lead;
  s.lead = clamp(s.lead + by, 1, 9);
  if (Math.abs(s.lead - before) >= 0.25) s.flags['graphDirty'] = true;
}

// ---------- government relations (§2.8) ----------

export function moveGov(s: GameState, by: number): void {
  s.govRelations = clamp(s.govRelations + by, 0, 100);
}

export function govMood(s: GameState): string {
  if (s.govRelations >= 65) return 'close';
  if (s.govRelations >= 40) return 'cordial';
  return 'wary';
}

// ---------- jobs and approval (§2.9) ----------

/** Millions of jobs the deployed copies stand in for: `0.12 × √(tasks/s ÷ 10⁶) × (best/2)^1.5`. */
export function jobsTarget(s: GameState): number {
  return 0.12 * Math.sqrt(Math.max(0, s.stats.tasksPerSec) / 1e6) * Math.pow(bestCapability(s) / 2, 1.5);
}

/** Incidents (released issues, advisories) in the last five minutes. */
export function recentIncidents(s: GameState): number {
  const now = s.stats.timePlayed;
  return s.stats.incidentTimes.filter((t) => now - t <= 300).length;
}

export function noteIncident(s: GameState): void {
  const now = s.stats.timePlayed;
  s.stats.incidentTimes = s.stats.incidentTimes.filter((t) => now - t <= 300);
  s.stats.incidentTimes.push(Math.round(now));
}

/** Every term of the approval target, for the hover: `[label, value]`. */
export function approvalTerms(s: GameState): [string, number][] {
  const terms: [string, number][] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.05) terms.push([label, v]);
  };
  add('jobs displaced', -10 * Math.pow(Math.max(0, s.jobsDisplaced), 0.6));
  add('gas turbines', -1.5 * s.gasPlants);
  add('Sage-mini', isBought(s, 'p_distill') ? -5 : 0);
  add('Al-Marsa', s.flags['gulfSigned'] === true ? -3 : 0);
  add('defense contract', s.flags['defenseContract'] === true ? -8 : 0);
  add('recent incidents', -2 * recentIncidents(s));
  add('fought the publishers', s.flags['foughtPublishers'] === true ? -4 : 0);
  add('Sage-3 public', s.flags['sage3Released'] === 'public' ? -6 : 0);
  add('free tier', isBought(s, 'p_free_tier') ? 8 : 0);
  add('job-transition fund', s.jobFund ? 10 : 0);
  add('community agreement', isBought(s, 'p_community') ? 6 : 0);
  add('candid testimony', s.flags['candid'] === true ? 3 : 0);
  add('licensed the publishers', s.flags['licensedPublishers'] === true ? 2 : 0);
  add('licensed the archives', isBought(s, 'p_license_archive') ? 2 : 0);
  add('declined the Pentagon', s.flags['declinedDefense'] === true ? 3 : 0);
  add('joint statement', s.flags['pactSigned'] === true ? 5 : s.flags['pactDeclined'] === true ? -2 : 0);
  add('system card', isBought(s, 'p_system_card') ? 2 : 0);
  return terms;
}

export function approvalTarget(s: GameState): number {
  return approvalTerms(s).reduce((a, [, v]) => a + v, 0);
}

/**
 * Slow tick (1 s): jobs creep toward their target and never fall; approval follows its target at
 * ±0.1 a second; monthly drifts (the policy team, an unattended capitol, the lead) run per second.
 */
export function updateWorld(s: GameState): void {
  if (s.stage !== 2) return;
  const target = jobsTarget(s);
  if (target > s.jobsDisplaced) s.jobsDisplaced += (target - s.jobsDisplaced) * 0.02;
  s.approval += clamp(approvalTarget(s) - s.approval, -0.1, 0.1);
  s.approval = clamp(s.approval, -100, 100);

  const perMonth = 1 / stageDef(s.stage).secondsPerMonth;
  if (isBought(s, 'p_policy')) {
    if (s.govRelations < 60) s.govRelations = Math.min(60, s.govRelations + 0.5 * perMonth);
  } else if (s.capability >= 2.5) {
    moveGov(s, -0.5 * perMonth);
  }
  if (s.date >= monthOf(2026, 7) && s.securityLevel < 3) moveLead(s, -0.1 * perMonth);

  if (s.govRelations < 30 && !s.flags['subpoenaFired']) {
    s.flags['subpoenaFired'] = true;
    s.flags['subpoenaDue'] = true;
  }
  if (s.approval <= -40 && s.stats.timePlayed - counter(s, 'riotsAt') > 300) {
    s.flags['riotsAt'] = s.stats.timePlayed;
    s.flags['riotsDue'] = true;
  }
}

// ---------- security (§2.10) ----------

export const SECURITY_NOTES: Record<number, string> = {
  1: 'SL1 — a password on the cluster',
  2: 'SL2 — holds against opportunists',
  3: 'SL3 — weights air-gapped',
};

/** SL3: $20M (scale 1) and 3 Trust; 25 % off for five minutes after "lock it down". */
export function sl3Cost(s: GameState): { funds: number; trust: number } {
  const until = s.flags['sl3DiscountUntil'];
  const discount = typeof until === 'number' && s.stats.timePlayed < until ? 0.75 : 1;
  return { funds: s2(20000000 * discount), trust: 3 };
}

export function buySL3(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['sl3Button'] || s.securityLevel >= 3) return false;
  const cost = sl3Cost(s);
  if (!canPay(s, cost)) return false;
  pay(s, cost);
  s.securityLevel = 3;
  moveGov(s, 5);
  moveLead(s, 1);
  press(s, 'sl3');
  say(s, 'Weights air-gapped. Two people and two keys to move a checkpoint. SL3.');
  logNews(s, 'OpenMind\'s weights now live on machines with no network cable.');
  return true;
}

// ---------- toggles ----------

export function toggleJobFund(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['jobFund']) return false;
  s.jobFund = !s.jobFund;
  press(s, 'toggleJobFund');
  if (s.jobFund && !s.flags['jobFundSaid']) {
    s.flags['jobFundSaid'] = true;
    say(s, 'Job-transition fund on. 2% of revenue, for as long as it is on.');
    logNews(s, 'OpenMind funds retraining for displaced engineers. The course is taught by Sage.');
  }
  return true;
}

export function toggleShareEvals(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['shareEvals']) return false;
  s.shareEvals = !s.shareEvals;
  press(s, 'toggleShareEvals');
  if (s.shareEvals && !s.flags['shareEvalsSaid']) {
    s.flags['shareEvalsSaid'] = true;
    say(s, 'The Safety Institute gets the eval suite with every release.');
  }
  return true;
}

/** Alignment compute cycles 1 % → 5 % → 10 % → 1 % of copies. */
export function cycleAlignShare(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['alignShare']) return false;
  const pct = Math.round(s.alignShare * 100);
  s.alignShare = pct < 5 ? 0.05 : pct < 10 ? 0.1 : 0.01;
  press(s, 'alignShare');
  say(s, `Alignment compute set to ${Math.round(s.alignShare * 100)}%. ${s.alignShare > 0.01 ? 'That many copies stop earning.' : 'The copies go back to work.'}`);
  return true;
}

// ---------- misc ----------

/** `$ 0.9B / yr` run-rate: revenue a second × 2,520 (a game year: twelve months of 210 s). */
export function runRate(s: GameState): number {
  return s.stats.revPerSec * 2520;
}

/** Lab room check used by the Stage 2 research-cap projects: the next run's research over 60 % of the cap. */
export function capWall(s: GameState): boolean {
  return (trainCost(s).research ?? 0) > 0.6 * researchCap(s);
}

/** Funds grant helper for the free rounds (Series B/C) at the Stage 2 scale. */
export function grant(s: GameState, scale1: number): void {
  addFunds(s, s2(scale1));
}

/** Months from the Stage 2 start (Jan 2026 = 0) for triggers like `Jun 2026`. */
export function atMonth(s: GameState, year: number, month: number): boolean {
  return s.date >= monthOf(year, month);
}

/** `0.5M` jobs, one decimal under 10 million. */
export function fmtJobs(m: number): string {
  if (m < 10) return `${fmtNum(m, m < 0.1 ? 2 : 1)}M`;
  return `${fmtInt(m)}M`;
}
