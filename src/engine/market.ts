import { GameState, say, creditIncome } from './state.js';
import { fmtMoneyShort } from './format.js';
import { effectsDemandMult, marketingMult, productionPerSec, autoTarget1 } from './economy.js';

export const MARKET_BASE_MIN = 30;
export const MARKET_BASE_MAX = 54;
export const AUTO_RATE = 0.5;
export const S2_MIN_PRICE = 0.001;
export const S2_MAX_AUTO = 5;
export const S2_PRICE_STEP = 0.05;

export function qualityMultS2(s: GameState): number {
  return Math.min(1.25, Math.max(0.8, s.capability / Math.max(0.01, s.rivalCapability)));
}

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

export function autoTarget(s: GameState): number {
  const supply = Math.max(1, productionPerSec(s) + s.unbilled / 30);
  return Math.min(S2_MAX_AUTO, Math.max(S2_MIN_PRICE, 0.25 * Math.sqrt(marketSize2(s) / supply)));
}

export function updateAutoPrice(s: GameState, dt: number): void {
  if (!s.autoPrice) return;
  const target = s.stage < 2 ? autoTarget1(s) : autoTarget(s);
  s.price += (target - s.price) * Math.min(1, AUTO_RATE * dt);
  s.price = Math.max(S2_MIN_PRICE, s.price);
}

export function calibrateMarket(s: GameState, contractShare = 0): void {
  const S = Math.max(s.stats.soldPerSec, s.stats.tasksPerSec, 1) * (1 - contractShare);
  const X = s.capability * s.capability * marketingMult(s) * s.demandMult * qualityMultS2(s) * s.hypeBoost;
  const raw = (S * Math.pow(s.price / 0.25, 2)) / Math.max(1e-9, X);
  s.marketBase = Math.min(MARKET_BASE_MAX, Math.max(MARKET_BASE_MIN, raw));
}

export function sellS2(s: GameState, dt: number): void {
  if (s.marketBase <= 0) calibrateMarket(s);
  const n = Math.min(s.unbilled, wantedAt(s, s.price) * dt);
  if (n <= 0) return;
  const revenue = n * s.price * s.revenueMult;
  s.unbilled -= n;
  if (s.unbilled < 1e-6) s.unbilled = 0;
  s.tasksSold += n;
  creditIncome(s, revenue);
  s.totalRevenue += revenue;
  s.stats.secRevenue += revenue;
  s.stats.secSold += n;
}

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

export function recordPrice(s: GameState): void {
  const hist = s.stats.priceHist;
  hist.push(s.price);
  if (hist.length > 60) hist.shift();
}

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

export function fmtPrice(p: number): string {
  if (p < 0.1) return `$${p.toFixed(3)}`;
  return fmtMoneyShort(Math.round(p * 100) / 100);
}
