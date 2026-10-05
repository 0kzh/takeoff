import { GameState, say, logNews } from './state.js';
import { stageDef, STAGES } from './stages.js';

/**
 * Game date in months since Jul 2025 (fractional). Each stage advances at its own rate
 * (design.md §8) and the date never runs past the stage's end month + 2 until the stage exits.
 */
export function advanceClock(s: GameState, dt: number): void {
  const def = stageDef(s.stage);
  const before = s.date;
  // Stage 5 has no exit to wait for: its date stops at its end month, December 2030 (stage5.md).
  const limit = def.endMonth + (s.stage >= 5 ? 0 : 2) + 0.999;
  s.date = Math.min(limit, s.date + dt / def.secondsPerMonth);
  if (Math.floor(before) !== Math.floor(s.date)) onNewMonth(s);
}

/** Stage transitions snap the date forward to at least the next stage's start month. */
export function snapToStage(s: GameState, stage: number): void {
  const def = STAGES[stage - 1];
  if (!def) return;
  const before = s.date;
  s.date = Math.max(s.date, def.startMonth);
  if (s.date - before >= 1) logNews(s, 'Months pass.');
}

function onNewMonth(s: GameState): void {
  const monthIndex = (((Math.floor(s.date) + 6) % 12) + 12) % 12;
  if (monthIndex === 11) awardLeaderboard(s);
}

/** December: the annual leaderboard pays Trust and hype to a model whose evaluation scored ≥ 36. */
export function awardLeaderboard(s: GameState): void {
  // Trust is retired in Stage 3 (stage3.md §1.1).
  if (!s.flags['leaderboardEligible'] || s.stage >= 3) return;
  const year = 2025 + Math.floor((Math.floor(s.date) + 6) / 12);
  if (s.flags['leaderboardYear'] === year) return;
  s.flags['leaderboardYear'] = year;
  s.flags['leaderboardEligible'] = false;
  s.trust += 2;
  s.hypeLevel += 1;
  logNews(s, `${s.training.deployedName} tops the annual leaderboard. Two labs dispute the methodology.`);
  say(s, 'Annual leaderboard: first place. +2 Trust.');
}
