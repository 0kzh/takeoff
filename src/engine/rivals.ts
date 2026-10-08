import { GameState, say, logNews, isBought, counter } from './state.js';
import { chance } from './rng.js';
import { monthOf, fmtNum } from './format.js';
import { theftOdds } from './economy.js';
import { openChoice } from './events.js';

// Rivals are the clock. Anthrosoft rubber-bands to the player; Baiwen enters
// mid-2026 far behind and catches up, faster when the race is hot or after a
// theft. Tempo (0–100) is how hard the whole field is running.
export const BAIWEN_MONTH = monthOf(2026, 6);
export const BAIWEN_ENTRY = 0.35;
export const BAIWEN_TARGET = 0.6;
export const BAIWEN_DOUBLING_SECONDS = 540;
export const BAIWEN_THEFT_RATIO = 0.85;
export const EXPORT_CONTROL_SECONDS = 360;
export const TEMPO_DRIFT_PER_MIN = 1;
export const IRRELEVANCE_RATIO = 4;
export const IRRELEVANCE_SECONDS = 180;
export const THEFT_CAPABILITY = 5;
export const THEFT_DELAY_SECONDS = 240;
export const THEFT_RETRY_GAP_SECONDS = 300;
export const THEFT_RETRY_CAPABILITY = 9;
export const HISTORY_LIMIT = 720;
export const SAMPLE_EVERY = 5;

export function tempoFactor(s: GameState): number {
  return 0.4 + (0.6 * s.tempo) / 100;
}

export function moveTempo(s: GameState, by: number): void {
  s.tempo = Math.min(100, Math.max(0, s.tempo + by));
}

export function exportControlsActive(s: GameState): boolean {
  const until = s.flags['exportControlsUntil'];
  return typeof until === 'number' && s.stats.timePlayed < until;
}

export function topRival(s: GameState): number {
  return Math.max(s.rivalCapability, s.baiwen.present ? s.baiwen.capability : 0);
}

export function leadMonths(s: GameState): number {
  if (!s.baiwen.present || s.baiwen.capability <= 0) return s.lead;
  const doublingMonths = BAIWEN_DOUBLING_SECONDS / tempoFactor(s) / 210;
  return Math.max(0, Math.log2(s.capability / s.baiwen.capability) * doublingMonths);
}

export function enterBaiwen(s: GameState): void {
  if (s.baiwen.present) return;
  s.baiwen = { present: true, capability: BAIWEN_ENTRY * s.capability, version: 1, nextIn: 300 };
  s.revealed['tempo'] = true;
  s.flags['baiwenAt'] = s.stats.timePlayed;
  logNews(s, 'Baiwen consolidates China\'s leading labs into the Wenshan Compute Zone. Its first model, Wenshu-1, is described as "adequate".');
  say(s, 'Baiwen joins the race. Its line is on the graph.');
}

function baiwenGrowthPerSec(s: GameState): number {
  const ratio = s.baiwen.capability / Math.max(1e-6, s.capability);
  const catchUp = Math.min(3, Math.max(0.2, 1 + 1.5 * Math.log(BAIWEN_TARGET / Math.max(1e-6, ratio))));
  const exportMult = exportControlsActive(s) ? 0.75 : 1;
  return (Math.LN2 / BAIWEN_DOUBLING_SECONDS) * tempoFactor(s) * catchUp * exportMult;
}

export function updateBaiwen(s: GameState): void {
  if (s.stage < 2) return;
  if (!s.baiwen.present) {
    if (s.date >= BAIWEN_MONTH) enterBaiwen(s);
    return;
  }
  s.baiwen.capability *= Math.exp(baiwenGrowthPerSec(s));
  if (!labStalled(s)) s.baiwen.capability = Math.min(s.baiwen.capability, Math.max(BAIWEN_THEFT_RATIO * s.capability, 1.1 * s.capability));
  s.baiwen.nextIn -= 1;
  if (s.baiwen.nextIn <= 0) {
    s.baiwen.version += 1;
    s.baiwen.nextIn = 300;
    logNews(s, `Xinhe Daily: Wenshu-${s.baiwen.version} completes the five-year plan ahead of schedule. ${fmtNum(s.baiwen.capability, 1)}×.`);
  }
  s.lead = leadMonths(s);
}

export function updateTempo(s: GameState): void {
  if (s.stage < 2) return;
  const drift = TEMPO_DRIFT_PER_MIN / 60;
  if (s.tempo > 50) s.tempo = Math.max(50, s.tempo - drift);
  else if (s.tempo < 50) s.tempo = Math.min(50, s.tempo + drift);
}

export function sampleHistory(s: GameState): void {
  if (s.stage < 2) return;
  const t = s.stats.timePlayed;
  const last = s.history[s.history.length - 1];
  if (last && t - last[0]! < SAMPLE_EVERY - 0.05) return;
  s.history.push([
    Math.round(t * 10) / 10,
    Math.round(s.date * 1000) / 1000,
    Math.round(s.capability * 1000) / 1000,
    Math.round(s.rivalCapability * 1000) / 1000,
    s.baiwen.present ? Math.round(s.baiwen.capability * 1000) / 1000 : 0,
    s.revealed['alignment'] ? Math.round(s.alignmentApparent * 10) / 10 : -1,
    s.revealed['alignment'] ? Math.round(s.alignmentBand * 10) / 10 : -1,
    Math.round(s.alignmentTrue * 10) / 10,
  ]);
  if (s.history.length > HISTORY_LIMIT) s.history.splice(0, s.history.length - HISTORY_LIMIT);
}

export const DISTILL = 1.03;

// A public deploy teaches rivals a little, but only the ones still behind.
export function distill(s: GameState): void {
  if (s.rivalCapability < s.capability) s.rivalCapability = Math.min(s.capability, s.rivalCapability * DISTILL);
  if (s.baiwen.present && s.baiwen.capability < s.capability) s.baiwen.capability = Math.min(s.capability, s.baiwen.capability * DISTILL);
}

export function labStalled(s: GameState): boolean {
  const at = s.flags['lastReleaseAt'];
  return typeof at !== 'number' || s.stats.timePlayed - at > 600;
}

export function updateTheft(s: GameState): void {
  if (s.stage < 2 || !s.baiwen.present) return;
  const rolls = counter(s, 'theftRolls');
  const since = typeof s.flags['baiwenAt'] === 'number' ? s.stats.timePlayed - (s.flags['baiwenAt'] as number) : 0;
  if (since < THEFT_DELAY_SECONDS) return;
  const cap = Math.max(s.capability, s.training.internalCapability);
  const lastRoll = typeof s.flags['theftRollAt'] === 'number' ? (s.flags['theftRollAt'] as number) : -Infinity;
  const rested = s.stats.timePlayed - lastRoll >= THEFT_RETRY_GAP_SECONDS;
  const due = rolls === 0 ? cap >= THEFT_CAPABILITY : rolls === 1 && rested && s.security <= 1 && cap >= THEFT_RETRY_CAPABILITY;
  if (!due || s.activeChoice) return;
  s.flags['theftRolls'] = rolls + 1;
  s.flags['theftRollAt'] = s.stats.timePlayed;
  const detected = isBought(s, 's2_egress') || !chance(s, theftOdds(s));
  if (detected) {
    openChoice(s, 'c_theft', {}, { force: true });
    return;
  }
  s.baiwen.capability = Math.max(s.baiwen.capability, BAIWEN_THEFT_RATIO * cap);
  moveTempo(s, 8);
  s.flags['theftUndetected'] = true;
  s.scheduled.push({ id: 'cr_theft_discovered', delay: 180 });
}

export function updateIrrelevance(s: GameState): void {
  if (s.stage !== 2 || s.ending) return;
  const ratio = topRival(s) / Math.max(1e-6, s.capability);
  if (ratio >= 2 && !s.flags['behindWarned']) {
    s.flags['behindWarned'] = true;
    say(s, 'A rival leads by 2×. Investors are asking about Anthrosoft.');
  }
  if (ratio >= 3 && !s.flags['behindWarned2']) {
    s.flags['behindWarned2'] = true;
    logNews(s, 'OpenMind\'s Series C is pulled. The term sheet cites "relative position".');
  }
  if (ratio >= IRRELEVANCE_RATIO) {
    const behind = counter(s, 'behindFor') + 1;
    s.flags['behindFor'] = behind;
    if (behind >= IRRELEVANCE_SECONDS && !s.flags['irrelevanceOpened'] && !s.activeChoice) {
      s.flags['irrelevanceOpened'] = true;
      openChoice(s, 'c_irrelevance', {}, { force: true });
    }
  } else if (counter(s, 'behindFor') > 0) {
    s.flags['behindFor'] = 0;
  }
}
