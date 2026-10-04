import { GameState, say } from './state.js';
import { fmtMoneyShort } from './format.js';
import { effectsDemandMult, marketingMult, productionPerSec, autoTarget1 } from './economy.js';

/**
 * The Stage 2 market (stage2.md §2.3). Deterministic: customers take `market × (0.25 / p)²`
 * tasks a second at price p, and AUTO walks the price toward the level that clears what the
 * copies make. At that price revenue is `0.25 × √(market × supply)`: compute always pays, but
 * pays less each time, until a better model or a wider market lifts it.
 */
export const MARKET_BASE_MIN = 30;
export const MARKET_BASE_MAX = 54;
/** AUTO closes this share of the gap to its target each second. */
export const AUTO_RATE = 0.5;
export const S2_MIN_PRICE = 0.001;
export const S2_MAX_AUTO = 5;
/** Manual price steps in Stage 2 are 5 % of the price. */
export const S2_PRICE_STEP = 0.05;

/** Stage 2: `clamp(capability / rival, 0.80, 1.25)`. Stage 1 keeps its square root. */
export function qualityMultS2(s: GameState): number {
  return Math.min(1.25, Math.max(0.8, s.capability / Math.max(0.01, s.rivalCapability)));
}

/** Tasks per second the market takes at price `p` of 0.25, before the price term. */
export function marketSize2(s: GameState): number {
  return (
    s.marketBase *
    s.capability * s.capability *
    marketingMult(s) *
    s.demandMult *
    qualityMultS2(s) *
    s.hypeBoost *
    effectsDemandMult(s)
  );
}

export function wantedAt(s: GameState, price: number): number {
  const p = Math.max(S2_MIN_PRICE, price);
  return marketSize2(s) * Math.pow(0.25 / p, 2);
}

/** The price that would clear production plus a thirtieth of the backlog each second. */
export function autoTarget(s: GameState): number {
  const supply = Math.max(1, productionPerSec(s) + s.unbilled / 30);
  return Math.min(S2_MAX_AUTO, Math.max(S2_MIN_PRICE, 0.25 * Math.sqrt(marketSize2(s) / supply)));
}

export function updateAutoPrice(s: GameState, dt: number): void {
  if (!s.autoPrice) return;
  // Stage 1's Dynamic pricing clears the Stage 1 market; Stage 2 and on, this one.
  const target = s.stage < 2 ? autoTarget1(s) : autoTarget(s);
  s.price += (target - s.price) * Math.min(1, AUTO_RATE * dt);
  s.price = Math.max(S2_MIN_PRICE, s.price);
}

/**
 * Calibrated once on arrival from what Stage 1 was selling, so revenue does not fall across the
 * boundary: `clamp(S × (price / 0.25)² / X, 30, 54)`.
 */
export function calibrateMarket(s: GameState, contractShare = 0): void {
  // Stage 1's contract customers keep paying a frozen rate in Stage 2: the market is the rest.
  const S = Math.max(s.stats.soldPerSec, s.stats.tasksPerSec, 1) * (1 - contractShare);
  const X = s.capability * s.capability * marketingMult(s) * s.demandMult * qualityMultS2(s) * s.hypeBoost;
  const raw = (S * Math.pow(s.price / 0.25, 2)) / Math.max(1e-9, X);
  s.marketBase = Math.min(MARKET_BASE_MAX, Math.max(MARKET_BASE_MIN, raw));
}

/** Every tick: bill what customers take at the current price, deterministically. */
export function sellS2(s: GameState, dt: number): void {
  if (s.marketBase <= 0) calibrateMarket(s);
  const n = Math.min(s.unbilled, wantedAt(s, s.price) * dt);
  if (n <= 0) return;
  const revenue = n * s.price * s.revenueMult;
  s.unbilled -= n;
  if (s.unbilled < 1e-6) s.unbilled = 0;
  s.tasksSold += n;
  s.funds = Math.floor((s.funds + revenue) * 100) / 100;
  s.totalRevenue += revenue;
  s.stats.secRevenue += revenue;
  s.stats.secSold += n;
}

/** The market's multipliers for the price hover: `capability² ×2.7 · marketing ×3.8 · …`. */
export function marketBreakdown(s: GameState): [string, number][] {
  const rows: [string, number][] = [
    ['capability²', s.capability * s.capability],
    ['marketing', marketingMult(s)],
    ['products', s.demandMult],
    ['rival', qualityMultS2(s)],
  ];
  if (s.hypeBoost > 1.005) rows.push(['release hype', s.hypeBoost]);
  const fx = effectsDemandMult(s);
  if (Math.abs(fx - 1) > 0.005) rows.push(['incidents', fx]);
  return rows;
}

/** A second-by-second price record for the "market flooded" line (60 samples). */
export function recordPrice(s: GameState): void {
  const hist = s.stats.priceHist;
  hist.push(s.price);
  if (hist.length > 60) hist.shift();
}

/**
 * At most once per 90 s: the price fell more than 35 % in a minute with no release in it. The fix
 * the line names (a better model, a wider market) is the Training panel and the market projects.
 */
export function floodedCheck(s: GameState): void {
  if (s.stage !== 2 || !s.autoPrice) return;
  const hist = s.stats.priceHist;
  if (hist.length < 60) return;
  const now = s.stats.timePlayed;
  const lastRelease = typeof s.flags['lastReleaseAt'] === 'number' ? (s.flags['lastReleaseAt'] as number) : -999;
  if (now - lastRelease < 60) return;
  const at = typeof s.flags['floodedAt'] === 'number' ? (s.flags['floodedAt'] as number) : -999;
  if (now - at < 90) return;
  if (s.price < 0.65 * hist[0]!) {
    s.flags['floodedAt'] = now;
    say(s, `Market flooded — price per task down to ${fmtPrice(s.price)}. A better model or a wider market lifts it.`);
  }
}

/** `$0.031` below a dime, `$0.25` above (console and price tags). */
export function fmtPrice(p: number): string {
  if (p < 0.1) return `$${p.toFixed(3)}`;
  return fmtMoneyShort(Math.round(p * 100) / 100);
}
