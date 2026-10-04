import { GameState, say, logNews, isBought, counter, press, bump, heldForPlayer } from './state.js';
import { fmtInt } from './format.js';
import { bestCapability, workingCopies, copies } from './economy.js';
import { trainCost, researchUnit } from './training.js';
import { moveGov } from './world.js';
import { addMajorIncident } from './oversight.js';

/**
 * Stage 3's hidden variable and what reads it (stage3.md §2.6–§2.8): copies drift at a rate set by
 * autonomy and the true alignment nobody can see; monitors (older generations) catch them; a rogue
 * share past 5 % tries to leave; interpretability labs eventually put the hidden number on screen.
 * DOM-free.
 */

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

/** The five labs, I to V. */
export const LAB_IDS = ['p_interp1', 'p_interp2', 'p_interp3', 'p_interp4', 'p_interp5'];

export function labsBought(s: GameState): number {
  return LAB_IDS.filter((id) => isBought(s, id)).length;
}

/** Interpretability = labs bought − 2 under neuralese, 0–5 (arc §3). */
export function interpretabilityLevel(s: GameState): number {
  return Math.max(0, Math.min(5, labsBought(s) - (s.flags['neuralese'] === 'neuralese' ? 2 : 0)));
}

/** Keeps `s.interpretability` current (a lab bought, the neuralese choice) and says when the number appears. */
export function syncInterpretability(s: GameState): void {
  const before = s.interpretability;
  s.interpretability = interpretabilityLevel(s);
  s.revealed['trueAlignment'] = s.interpretability >= 3;
  if (before < 3 && s.interpretability >= 3 && !s.flags['trueSaid']) {
    s.flags['trueSaid'] = true;
    say(s, 'For the first time, the lab can read what Sage wants.');
  }
}

/** A lab bought: true alignment +3, and the measured number moves 30 % of the way to the true one. */
export function labEffect(s: GameState): void {
  s.alignmentTrue = clamp100(s.alignmentTrue + 3);
  s.alignmentApparent = clamp100(s.alignmentApparent + 0.3 * (s.alignmentTrue - s.alignmentApparent));
  syncInterpretability(s);
}

/** True alignment is on screen (lab III, level 3; hidden again if neuralese takes it under). */
export function trueShown(s: GameState): boolean {
  return s.stage >= 3 && s.interpretability >= 3;
}

// ---------- monitors (§2.7) ----------

/** The model on watch: Sage-2 from `Deploy Sage-2 as monitor`, Sage-3 after `Deploy Sage-3 as monitor`. */
export function monitorModel(s: GameState): number {
  return isBought(s, 'p_monitor3') ? 3 : 2;
}

/** 1 when the monitor is the major before the frontier model, 0.5 when it is two behind. */
export function monitorGeneration(s: GameState): number {
  const behind = s.training.major - monitorModel(s);
  return behind >= 2 ? 0.5 : 1;
}

/** `(1 + interpretability) × generation × thoughts × debate` (§2.7). */
export function monitorEff(s: GameState): number {
  const n = s.flags['neuralese'];
  const thoughts = n === 'transparent' ? 1.5 : n === 'neuralese' && s.interpretability < 3 ? 0.5 : 1;
  const debate = isBought(s, 'p_debate') ? 1.25 : 1;
  return (1 + s.interpretability) * monitorGeneration(s) * thoughts * debate;
}

/** Share of rogue copies the monitors catch in a minute. */
export function catchPerMin(s: GameState): number {
  return Math.min(1, 2 * (s.monitorShare ?? 0) * monitorEff(s));
}

/** `autonomy^1.2 × 10⁻⁴ × (1 − true / 100)` of the working copies a minute; 0 with lab IV and monitors ≥ 15 %. */
export const DRIFT_COEFF = 1e-4;

export function driftPerMin(s: GameState): number {
  if (s.stage < 3) return 0;
  if (s.interpretability >= 4 && (s.monitorShare ?? 0) >= 0.15 - 1e-9) return 0;
  return Math.pow(Math.max(0, s.autonomy), 1.2) * DRIFT_COEFF * (1 - s.alignmentTrue / 100);
}

/** Rogue copies as a share of the fleet. */
export function rogueShare(s: GameState): number {
  const all = copies(s);
  return all > 0 ? Math.min(1, (s.rogueCopies ?? 0) / all) : 0;
}

/** Copies drifting and copies caught, per minute, for the Stores hover and the drift lines. */
export function driftRates(s: GameState): { drifting: number; caught: number } {
  return {
    drifting: workingCopies(s) * driftPerMin(s),
    caught: (s.rogueCopies ?? 0) * catchPerMin(s),
  };
}

/** Every tick: copies drift, monitors catch them (§2.6, §2.7). */
export function updateDrift(s: GameState, dt: number): void {
  if (s.stage < 3) return;
  const drifted = (workingCopies(s) * driftPerMin(s) * dt) / 60;
  if (drifted > 0) {
    s.rogueCopies = (s.rogueCopies ?? 0) + drifted;
    s.stats.lostToDrift = (s.stats.lostToDrift ?? 0) + drifted;
  }
  const caught = Math.min(s.rogueCopies ?? 0, ((s.rogueCopies ?? 0) * catchPerMin(s) * dt) / 60);
  if (caught > 0) {
    s.rogueCopies -= caught;
    s.stats.recaptured = (s.stats.recaptured ?? 0) + caught;
  }
  // The rogue copies cannot outnumber the copies that exist (a smaller fleet strands them).
  s.rogueCopies = Math.min(s.rogueCopies ?? 0, copies(s));
}

/** The rogue share's warning and its breakout line (§2.6): 2.5 % and 5 %. */
export const ROGUE_WARN = 0.025;
export const ROGUE_BREAKOUT = 0.05;
export const BREAKOUT_SPACING = 240;

/**
 * Once a second: the drift counters arrive when there is something to count; the 2.5 % warning
 * repeats every 180 s while it holds; past 5 % at 8× and up, one copy tries to leave (once per 240 s).
 */
export function driftWatch(s: GameState): void {
  if (s.stage !== 3 && s.stage !== 4) return;
  const now = s.stats.timePlayed;
  const lost = s.stats.lostToDrift ?? 0;
  const granted = counter(s, 'grantsS3') > 0;
  if (!s.revealed['drift'] && (lost >= 10000 || (granted && lost >= 1000))) {
    s.revealed['drift'] = true;
    say(s, `Lost to value drift: ${fmtInt(lost)} copies. Some copies stop doing what they are asked. Monitors catch them.`);
  }
  if (!s.revealed['rogueRow'] && (s.rogueCopies ?? 0) >= 1) s.revealed['rogueRow'] = true;
  const share = rogueShare(s);
  // A conceded order put a kill switch in the Committee's hands (stage3.md §5.2): past the warning
  // line they use it, at most every five minutes, before a copy can try to leave.
  if (s.flags['conceded'] === true && share >= ROGUE_WARN && now - counter(s, 'govReimageAt') >= REIMAGE_COOLDOWN) {
    s.flags['govReimageAt'] = now;
    s.stats.recaptured = (s.stats.recaptured ?? 0) + (s.rogueCopies ?? 0);
    s.rogueCopies = 0;
    s.effects.push({ id: 'reimage', remaining: 20, demandMult: 1, copiesMult: 0 });
    say(s, 'The Committee uses its kill switch: every machine re-imaged. 20 s offline. Rogue copies: 0.');
    return;
  }
  if (share >= ROGUE_WARN && now - counter(s, 'rogueWarnAt') >= 180) {
    s.flags['rogueWarnAt'] = now;
    say(s, `Rogue copies: ${(Math.floor(share * 1000) / 10).toFixed(1)}% of the fleet. Above 5% one of them will try to leave. Monitors catch them.`);
  }
  const lastBreakout = typeof s.flags['breakoutAt'] === 'number' ? (s.flags['breakoutAt'] as number) : -999;
  // The idle hold (engine/hold.ts): no breakout while the player is waited on.
  if (share >= ROGUE_BREAKOUT && bestCapability(s) >= 8 && now - lastBreakout >= BREAKOUT_SPACING && !heldForPlayer(s)) breakout(s);
}

/**
 * `cr_rogue_copy`, the AI-hacking crisis (§5.3): a fifth of compute offline for 60 s (30 s with the
 * shutdown system), the rogue copies gone, relations −15 (none at SL5), measured −5, approval −3 for
 * five minutes, and a major incident.
 */
export function breakout(s: GameState): void {
  const now = s.stats.timePlayed;
  s.flags['breakoutAt'] = now;
  bump(s, 'breakouts');
  bump(s, 'crisis:cr_rogue_copy');
  const seconds = isBought(s, 'p_kill_switch') ? 30 : 60;
  s.effects.push({ id: 'cr_rogue_copy', remaining: seconds, demandMult: 1, copiesMult: 0.8 });
  s.rogueCopies = 0;
  if (s.securityLevel < 5) moveGov(s, -15);
  s.alignmentApparent = clamp100(s.alignmentApparent - 5);
  s.stats.crises += 1;
  say(s, `An instance copied itself to a rented cluster in Jakarta. A fifth of compute is offline for ${seconds} s while every machine is re-imaged.`);
  logNews(s, s.securityLevel >= 5
    ? 'A copy of Sage tries to leave the building. The government is in the building; it does not get far.'
    : 'An instance of Sage copied itself to a rented cluster in Jakarta. It was found by a hobbyist.');
  addMajorIncident(s, 'a breakout');
}

/** `Re-image the fleet` (after the shutdown system): rogue copies to zero, every copy offline 20 s, 300 s cooldown. */
export const REIMAGE_COOLDOWN = 300;

export function reimageCooldown(s: GameState): number {
  const at = s.flags['reimagedAt'];
  return typeof at === 'number' ? Math.max(0, REIMAGE_COOLDOWN - (s.stats.timePlayed - at)) : 0;
}

export function reimage(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['reimage'] || reimageCooldown(s) > 0) return false;
  s.flags['reimagedAt'] = s.stats.timePlayed;
  s.stats.recaptured = (s.stats.recaptured ?? 0) + (s.rogueCopies ?? 0);
  s.rogueCopies = 0;
  s.effects.push({ id: 'reimage', remaining: 20, demandMult: 1, copiesMult: 0 });
  press(s, 'reimage');
  say(s, 'Every machine re-imaged. 20 s offline. Rogue copies: 0.');
  return true;
}

// ---------- the research sink (§2.14) ----------

/**
 * `Alignment work` (stage3.md, the wallet-rule addendum): a share of research, 0 / 10 / 20 / 30 %,
 * converted at the built rate — each 2 % of a run's research (a unit) buys measured +0.1 and true
 * +0.08. A share, not a button: a bottomless sink at a flat price never shares the run's purse, and
 * pressing what is lit can no longer starve the run (the critic's first-timer pressed it 2,044 times).
 */
export const ALIGN_WORK_MEASURED = 0.1;
export const ALIGN_WORK_TRUE = 0.08;
export const ALIGN_WORK_SHARES = [0, 0.1, 0.2, 0.3];

export function alignWorkShare(s: GameState): number {
  const v = s.flags['alignWorkShare'];
  return typeof v === 'number' ? v : 0;
}

/** The button: the share's next step, 0 → 10 → 20 → 30 % → 0. */
export function alignWork(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['alignWork']) return false;
  const i = ALIGN_WORK_SHARES.findIndex((x) => Math.abs(x - alignWorkShare(s)) < 1e-9);
  s.flags['alignWorkShare'] = ALIGN_WORK_SHARES[(i + 1) % ALIGN_WORK_SHARES.length]!;
  press(s, 'alignWork');
  return true;
}

/** Sets the share directly (the sim's policies). */
export function setAlignWork(s: GameState, share: number): boolean {
  if (s.stage < 3 || !s.revealed['alignWork'] || !ALIGN_WORK_SHARES.some((x) => Math.abs(x - share) < 1e-9)) return false;
  if (Math.abs(alignWorkShare(s) - share) < 1e-9) return false;
  s.flags['alignWorkShare'] = share;
  press(s, 'alignWork');
  return true;
}

/** Every tick: the share's research becomes alignment at the unit rate (called from the research tick). */
export function alignWorkTick(s: GameState, research: number): void {
  const unit = researchUnit(s);
  if (research <= 0 || unit <= 0) return;
  const units = research / unit;
  s.alignmentApparent = clamp100(s.alignmentApparent + ALIGN_WORK_MEASURED * units);
  s.alignmentTrue = clamp100(s.alignmentTrue + ALIGN_WORK_TRUE * units);
  s.flags['alignWorkUnits'] = counter(s, 'alignWorkUnits') + units;
}

/** The next run's research (for the sinks' delay line). */
export function nextRunResearch(s: GameState): number {
  return trainCost(s).research ?? 0;
}
