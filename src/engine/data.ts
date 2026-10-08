import { GameState, say, isBought, bump } from './state.js';
import { idleCopies } from './economy.js';

// Training data is a cap, not a spend: each run needs enough of it, and a
// shortfall shrinks the run's gain. The public web runs out early in Stage 2.
export const WEB_TOTAL = 20;
export const WEB_RATE_PER_SEC = 1 / 60;
export const DATA_BASE = 10;
export const DATA_EXPONENT = 1.4;
export const DATA_REF = 1.8;
export const SYNTHETIC_UNIT_COPIES = 10000;
export const SYNTHETIC_PER_UNIT_PER_MIN = 1;
export const LICENSE_BASE = 500000;
export const LICENSE_GROWTH = 2;
export const LICENSE_DATA = 15;
export const CUSTOMER_DATA = 25;
export const RL_DATA_MULT = 1.5;

export function dataRequired(c: number): number {
  return DATA_BASE * Math.pow(Math.max(DATA_REF, c) / DATA_REF, DATA_EXPONENT);
}

export function dataMultiplier(s: GameState): number {
  return isBought(s, 's2_rl_envs') ? RL_DATA_MULT : 1;
}

export function effectiveData(s: GameState): number {
  return (s.data.stock + s.data.synthetic) * dataMultiplier(s);
}

export function dataCoverage(s: GameState, c: number): number {
  if (s.stage < 2) return 1;
  return Math.min(1, effectiveData(s) / dataRequired(c));
}

export function dataFactor(s: GameState, c: number): number {
  return Math.sqrt(dataCoverage(s, c));
}

export function dataShort(s: GameState, c: number): boolean {
  return s.stage >= 2 && dataCoverage(s, c) < 0.999;
}

export function licenseCost(s: GameState): number {
  return LICENSE_BASE * Math.pow(LICENSE_GROWTH, s.data.licensed);
}

export function syntheticRatePerMin(s: GameState): number {
  if (!isBought(s, 's2_synthetic')) return 0;
  return Math.sqrt(idleCopies(s) / SYNTHETIC_UNIT_COPIES) * SYNTHETIC_PER_UNIT_PER_MIN;
}

export function webShare(s: GameState): number {
  return 1 - Math.max(0, s.data.webRemaining) / WEB_TOTAL;
}

export function dataTick(s: GameState, dt: number): void {
  if (s.stage < 2) return;
  const d = s.data;
  if (d.webRemaining > 0) {
    const take = Math.min(d.webRemaining, WEB_RATE_PER_SEC * dt);
    d.stock += take;
    d.webRemaining -= take;
    if (d.webRemaining <= 1e-9) {
      d.webRemaining = 0;
      s.flags['webExhausted'] = true;
    }
  }
  if (isBought(s, 's2_synthetic')) {
    const rate = syntheticRatePerMin(s);
    if (rate > 0) d.synthetic += (rate / 60) * dt;
  }
}

export function licenseData(s: GameState): void {
  s.data.stock += LICENSE_DATA;
  s.data.licensed += 1;
  bump(s, 'licensesBought');
  say(s, `Licensed ${LICENSE_DATA}T tokens. Data: ${Math.floor(effectiveData(s))}T.`);
}
