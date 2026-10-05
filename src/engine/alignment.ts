import { GameState, say, logNews, isBought, counter, press, bump, heldForPlayer } from './state.js';
import { fmtInt } from './format.js';
import { bestCapability, workingCopies, copies } from './economy.js';
import { trainCost, researchUnit } from './training.js';
import { moveGov } from './world.js';
import { addMajorIncident } from './oversight.js';

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

export const LAB_IDS = ['p_interp1', 'p_interp2', 'p_interp3', 'p_interp4', 'p_interp5'];

export function labsBought(s: GameState): number {
  return LAB_IDS.filter((id) => isBought(s, id)).length;
}

export function interpretabilityLevel(s: GameState): number {
  return Math.max(0, Math.min(5, labsBought(s) - (s.flags['neuralese'] === 'neuralese' ? 2 : 0)));
}

export function syncInterpretability(s: GameState): void {
  const before = s.interpretability;
  s.interpretability = interpretabilityLevel(s);
  s.revealed['trueAlignment'] = s.interpretability >= 3;
  if (before < 3 && s.interpretability >= 3 && !s.flags['trueSaid']) {
    s.flags['trueSaid'] = true;
    say(s, 'For the first time, the lab can read what Sage wants.');
  }
}

export function labEffect(s: GameState): void {
  s.alignmentTrue = clamp100(s.alignmentTrue + 3);
  s.alignmentApparent = clamp100(s.alignmentApparent + 0.3 * (s.alignmentTrue - s.alignmentApparent));
  syncInterpretability(s);
}

export function trueShown(s: GameState): boolean {
  return s.stage >= 3 && s.interpretability >= 3;
}

export function monitorModel(s: GameState): number {
  return isBought(s, 'p_monitor3') ? 3 : 2;
}

export function monitorGeneration(s: GameState): number {
  const behind = s.training.major - monitorModel(s);
  return behind >= 2 ? 0.5 : 1;
}

export function monitorEff(s: GameState): number {
  const n = s.flags['neuralese'];
  const thoughts = n === 'transparent' ? 1.5 : n === 'neuralese' && s.interpretability < 3 ? 0.5 : 1;
  const debate = isBought(s, 'p_debate') ? 1.25 : 1;
  return (1 + s.interpretability) * monitorGeneration(s) * thoughts * debate;
}

export function catchPerMin(s: GameState): number {
  return Math.min(1, 2 * (s.monitorShare ?? 0) * monitorEff(s));
}

export const DRIFT_COEFF = 1e-4;

export function driftPerMin(s: GameState): number {
  if (s.stage < 3) return 0;
  if (s.interpretability >= 4 && (s.monitorShare ?? 0) >= 0.15 - 1e-9) return 0;
  return Math.pow(Math.max(0, s.autonomy), 1.2) * DRIFT_COEFF * (1 - s.alignmentTrue / 100);
}

export function rogueShare(s: GameState): number {
  const all = copies(s);
  return all > 0 ? Math.min(1, (s.rogueCopies ?? 0) / all) : 0;
}

export function driftRates(s: GameState): { drifting: number; caught: number } {
  return {
    drifting: workingCopies(s) * driftPerMin(s),
    caught: (s.rogueCopies ?? 0) * catchPerMin(s),
  };
}

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
  s.rogueCopies = Math.min(s.rogueCopies ?? 0, copies(s));
}

export const ROGUE_WARN = 0.025;
export const ROGUE_BREAKOUT = 0.05;
export const BREAKOUT_SPACING = 240;

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
  if (share >= ROGUE_BREAKOUT && bestCapability(s) >= 8 && now - lastBreakout >= BREAKOUT_SPACING && !heldForPlayer(s)) breakout(s);
}

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

export const ALIGN_WORK_MEASURED = 0.1;
export const ALIGN_WORK_TRUE = 0.08;
export const ALIGN_WORK_SHARES = [0, 0.1, 0.2, 0.3];

export function alignWorkShare(s: GameState): number {
  const v = s.flags['alignWorkShare'];
  return typeof v === 'number' ? v : 0;
}

export function alignWork(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['alignWork']) return false;
  const i = ALIGN_WORK_SHARES.findIndex((x) => Math.abs(x - alignWorkShare(s)) < 1e-9);
  s.flags['alignWorkShare'] = ALIGN_WORK_SHARES[(i + 1) % ALIGN_WORK_SHARES.length]!;
  press(s, 'alignWork');
  return true;
}

export function setAlignWork(s: GameState, share: number): boolean {
  if (s.stage < 3 || !s.revealed['alignWork'] || !ALIGN_WORK_SHARES.some((x) => Math.abs(x - share) < 1e-9)) return false;
  if (Math.abs(alignWorkShare(s) - share) < 1e-9) return false;
  s.flags['alignWorkShare'] = share;
  press(s, 'alignWork');
  return true;
}

export function alignWorkTick(s: GameState, research: number): void {
  const unit = researchUnit(s);
  if (research <= 0 || unit <= 0) return;
  const units = research / unit;
  s.alignmentApparent = clamp100(s.alignmentApparent + ALIGN_WORK_MEASURED * units);
  s.alignmentTrue = clamp100(s.alignmentTrue + ALIGN_WORK_TRUE * units);
  s.flags['alignWorkUnits'] = counter(s, 'alignWorkUnits') + units;
}

export function nextRunResearch(s: GameState): number {
  return trainCost(s).research ?? 0;
}
