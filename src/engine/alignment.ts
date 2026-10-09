import { GameState, Focus, say, logNews, isBought } from './state.js';
import { chance, randInt } from './rng.js';
import { fmtNum } from './format.js';

// The player sees an estimate with a band. The true value is hidden until the
// end. Every capability gain drifts the true value down unless alignment work
// covers it; deception bias inflates the estimate without the player knowing.
export const DRIFT_PER_DECADE = 6;
export const BAND_START = 30;
export const BAND_MIN = 3;
export const BIAS_JUMP_CHANCE = 0.3;
export const SAFETY_FOCUS_COVERAGE = 0.35;
export const PROJECT_COVERAGE = 0.08;
export const MAX_COVERAGE = 0.9;

const COVERAGE_PROJECTS = ['s2_spec', 's2_cot', 's2_probes', 's2_honesty', 's2_sae', 's2_redteam', 'p_safety_framework'];

export function raceFactor(s: GameState): number {
  return 0.5 + s.tempo / 100;
}

export function coverage(s: GameState, focus: Focus): number {
  let c = focus === 'safety' ? SAFETY_FOCUS_COVERAGE : 0;
  for (const id of COVERAGE_PROJECTS) if (isBought(s, id)) c += PROJECT_COVERAGE;
  return Math.min(MAX_COVERAGE, c);
}

export function alignmentShown(s: GameState): boolean {
  return s.revealed['alignment'] === true;
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

export function syncApparent(s: GameState): void {
  if (!alignmentShown(s)) return;
  s.alignmentApparent = clamp(s.alignmentTrue + s.deceptionBias);
}

export function interpretabilityPercent(s: GameState): number {
  return Math.round((100 * (BAND_START - s.alignmentBand)) / (BAND_START - BAND_MIN));
}

export function revealAlignment(s: GameState): void {
  if (alignmentShown(s)) return;
  s.revealed['alignment'] = true;
  s.alignmentBand = Math.min(BAND_START, s.alignmentBand);
  syncApparent(s);
  say(s, `Alignment: ${fmtNum(s.alignmentApparent, 0)} ± ${fmtNum(s.alignmentBand, 0)}. The band is how little we know.`);
  const narrowed = BAND_START - s.alignmentBand;
  if (narrowed > 0 && Object.values(s.mind.features).some((f) => f.status === 'decoded')) {
    say(s, `The Mind decodes already narrowed it by ${narrowed}.`);
  }
}

export function applyDrift(s: GameState, capBefore: number, capAfter: number, focus: Focus): number {
  if (s.stage < 2 || capAfter <= capBefore) return 0;
  const cov = coverage(s, focus);
  const drift = DRIFT_PER_DECADE * Math.log10(capAfter / capBefore) * raceFactor(s) * (1 - cov);
  s.alignmentTrue = clamp(s.alignmentTrue - drift);
  const doubled = Math.floor(Math.log2(capAfter)) > Math.floor(Math.log2(capBefore));
  if (doubled && chance(s, BIAS_JUMP_CHANCE * raceFactor(s) * (1 - cov))) {
    s.deceptionBias = Math.min(20, s.deceptionBias + randInt(s, 2, 5));
    s.flags['biasJumps'] = ((s.flags['biasJumps'] as number) || 0) + 1;
  }
  if (focus === 'safety' && alignmentShown(s)) narrowBand(s, 1);
  syncApparent(s);
  return drift;
}

export function raiseAlignment(s: GameState, by: number): void {
  s.alignmentTrue = clamp(s.alignmentTrue + by);
  syncApparent(s);
}

export function narrowBand(s: GameState, by: number): void {
  s.alignmentBand = Math.max(BAND_MIN, s.alignmentBand - by);
}

export function reduceBias(s: GameState, by: number): void {
  const before = s.deceptionBias;
  s.deceptionBias = Math.max(0, s.deceptionBias - by);
  if (before > s.deceptionBias && alignmentShown(s)) {
    const was = s.alignmentApparent;
    syncApparent(s);
    if (was - s.alignmentApparent >= 1) {
      logNews(s, `Revised alignment estimate: ${fmtNum(was, 0)} → ${fmtNum(s.alignmentApparent, 0)}. The old number was Sage's.`);
    }
  }
}

export function alignmentZone(value: number): 'low' | 'mid' | 'high' {
  return value < 50 ? 'low' : value < 80 ? 'mid' : 'high';
}
