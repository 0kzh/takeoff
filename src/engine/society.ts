import { GameState, say, logNews, press, counter, isBought, heldForPlayer } from './state.js';
import { fmtInt } from './format.js';
import { bestCapability } from './economy.js';
import { fireCrisis, fireDevelopmentOnce } from './events.js';
import { HOUSING_APPROVAL, relaxHousing } from './fleet.js';

/**
 * Stage 4's society (stage4.md §2.7): jobs follow the best model the public can run, approval follows a
 * target that the universal basic income, the cures, the Ashford strain, the zones, the transition
 * grant and housing move. Riots and sabotage keep Stage 3's lines. DOM-free.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The world's workforce, millions. */
export const WORKFORCE = 3400;
export const JOBS_SCALE = 700;
export const JOBS_RATE = 0.005;
export const JOBS_APPROVAL = 70;
/** Universal basic income: the share of output, and what it adds to the approval target. */
export const UBI_SHARES = [0, 0.05, 0.1, 0.2];
const UBI_POINTS: [number, number][] = [[0, 0], [0.05, 15], [0.1, 30], [0.2, 50], [0.3, 65]];

/** Approval points a share of output buys (piecewise between 0 / 5 / 10 / 20 %, +15 / +30 / +50). */
export function ubiTerm(share: number): number {
  const x = clamp(share, 0, 0.3);
  for (let i = 1; i < UBI_POINTS.length; i++) {
    const [x1, y1] = UBI_POINTS[i]!;
    const [x0, y0] = UBI_POINTS[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return UBI_POINTS[UBI_POINTS.length - 1]![1];
}

export function publicCapS4(s: GameState): number {
  const v = s.flags['publicCap'];
  return Math.max(typeof v === 'number' ? v : 1, 0.5 * bestCapability(s));
}

export function jobsTargetS4(s: GameState): number {
  return WORKFORCE * (1 - Math.exp(-publicCapS4(s) / JOBS_SCALE));
}

/** The jobs term of the approval target: `−70 × √(jobs / 3,400)`. */
export function jobsTerm(s: GameState): number {
  return -JOBS_APPROVAL * Math.sqrt(Math.max(0, s.jobsDisplaced) / WORKFORCE);
}

/** Every term of Stage 4's approval target, for the hover. */
export function approvalTermsS4(s: GameState): [string, number][] {
  const out: [string, number][] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.05) out.push([label, v]);
  };
  add('where Stage 3 ended', s.s4.approvalBase);
  add('jobs displaced', jobsTerm(s));
  add('universal basic income', ubiTerm(s.s4.ubiShare));
  add('Cure portfolio', isBought(s, 'p_cures') ? 10 : 0);
  const f = s.s4;
  if (f.ashfordPhase === 'spreading') add('the Ashford strain', s.alignmentTrue < 40 ? -20 : -10);
  if (f.ashfordPhase === 'cured') add('the Ashford cure', f.ashfordBand >= 60 ? 15 : 5);
  add('the zones', s.flags['zones'] === 'open' ? -10 : s.flags['zones'] === 'none' ? 5 : 0);
  add('Let it run the transition', s.flags['transitionAuto'] === true ? 10 : 0);
  add('housing', HOUSING_APPROVAL * f.housingUnits);
  add('the fleet builds housing', s.flags['fleetAuto'] === true && f.fleetGoal === 'people' ? 12 : 0);
  add('a nanofab line', counter(s, 'nanoApproval'));
  return out;
}

export function approvalTargetS4(s: GameState): number {
  return approvalTermsS4(s).reduce((a, [, v]) => a + v, 0);
}

/** The target without the dividend: what `Approval to hold` has to make up. */
function targetWithoutUbi(s: GameState): number {
  return approvalTargetS4(s) - ubiTerm(s.s4.ubiShare);
}

/**
 * `Let it run the transition` (§2.5): the dividend is set to keep approval at the held line (−25, 0 or
 * +25); what that costs is printed under the selector.
 */
export function heldShare(s: GameState): number {
  const need = s.s4.approvalHold - targetWithoutUbi(s);
  if (need <= 0) return 0;
  let lo = 0;
  let hi = 0.3;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ubiTerm(mid) >= need) hi = mid;
    else lo = mid;
  }
  return Math.round(hi * 100) / 100;
}

/** `Universal basic income: 10% of output` — its next step, 0 → 5 → 10 → 20 % → 0. */
export function cycleUbi(s: GameState): boolean {
  if (s.stage !== 4 || !s.revealed['ubi'] || s.flags['transitionAuto'] === true) return false;
  const i = UBI_SHARES.findIndex((x) => Math.abs(x - s.s4.ubiShare) < 1e-9);
  s.s4.ubiShare = UBI_SHARES[(i + 1) % UBI_SHARES.length]!;
  press(s, 'ubi');
  if (s.s4.ubiShare > 0 && s.flags['dividendSaid'] !== true) {
    s.flags['dividendSaid'] = true;
    fireDevelopmentOnce(s, 'd_dividend');
  }
  return true;
}

export function setUbiShare(s: GameState, share: number): boolean {
  if (s.stage !== 4 || !s.revealed['ubi'] || s.flags['transitionAuto'] === true) return false;
  if (!UBI_SHARES.some((x) => Math.abs(x - share) < 1e-9) || Math.abs(s.s4.ubiShare - share) < 1e-9) return false;
  s.s4.ubiShare = share;
  press(s, 'ubi');
  if (share > 0 && s.flags['dividendSaid'] !== true) {
    s.flags['dividendSaid'] = true;
    fireDevelopmentOnce(s, 'd_dividend');
  }
  return true;
}

/** `Approval to hold: −25 / 0 / +25` (the transition grant's selector). */
export function setApprovalHold(s: GameState, v: number): boolean {
  if (s.stage !== 4 || s.flags['transitionAuto'] !== true || ![-25, 0, 25].includes(v) || s.s4.approvalHold === v) return false;
  s.s4.approvalHold = v;
  press(s, 'approvalHold');
  return true;
}

/**
 * Once a second in Stage 4: jobs creep toward their target; the dividend follows the held line once the
 * model runs the transition; approval moves ±0.1 a second toward its target; housing relaxes; riots and
 * sabotage at their lines, with warnings first (Stage 3's, §2.7).
 */
export function updateSociety(s: GameState): void {
  const target = jobsTargetS4(s);
  if (target > s.jobsDisplaced) s.jobsDisplaced += (target - s.jobsDisplaced) * JOBS_RATE;
  if (s.flags['transitionAuto'] === true) s.s4.ubiShare = heldShare(s);
  s.s4.ubiSeconds += s.s4.ubiShare;
  s.approval = clamp(s.approval + clamp(approvalTargetS4(s) - s.approval, -0.1, 0.1), -100, 100);
  relaxHousing(s);
  if (s.jobsDisplaced >= 300 && !s.developments['d_unemployment']) fireDevelopmentOnce(s, 'd_unemployment');
  societyLines(s);
}

function societyLines(s: GameState): void {
  const now = s.stats.timePlayed;
  if (s.stats.timeInStage < 120 || heldForPlayer(s)) return;
  const fix = s.flags['transitionAuto'] === true ? 'Approval to hold answers it.' : 'Universal basic income and housing answer it.';
  if (s.approval <= -30 && s.approval > -40 && now - counter(s, 'riotWarnAt') >= 180) {
    s.flags['riotWarnAt'] = now;
    say(s, `Approval ${fmtInt(Math.round(s.approval))}. Below −40 the marches turn into riots. ${fix}`);
  }
  if (s.approval <= -45 && s.approval > -55 && now - counter(s, 'sabotageWarnAt') >= 180) {
    s.flags['sabotageWarnAt'] = now;
    say(s, `Approval ${fmtInt(Math.round(s.approval))}. Below −55 somebody will bring bolt cutters. ${fix}`);
  }
  if (s.approval <= -40 && now - counter(s, 'riots4At') >= 300) {
    s.flags['riots4At'] = now;
    fireCrisis(s, 'cr_riots4');
  }
  if (s.approval <= -55 && now - counter(s, 'sabotage4At') >= 300) {
    s.flags['sabotage4At'] = now;
    fireCrisis(s, 'cr_sabotage4');
  }
}

/** People alive at the end: 8.3 billion less the Ashford dead (stage5.md row 6). */
export function peopleAlive(s: GameState): number {
  return 8.3e9 - Math.max(0, s.s4.ashfordDeaths);
}

export { logNews };
