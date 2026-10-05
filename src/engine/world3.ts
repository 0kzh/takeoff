import { GameState, say, logNews, isBought, counter, press, canPay, pay } from './state.js';
import { rand, pick } from './rng.js';
import { fmtNum, fmtInt, fmtMoneyShort, monthOf } from './format.js';
import { bestCapability, qualityMult, pricingRevenue } from './economy.js';
import { moveGov, recordRival, approvalTerms, RIVAL_LINES_S2 } from './world.js';
import { RIVAL_LINES } from '../data/flavor.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const LEAD_MIN_S3 = -2;
export const LEAD_MAX_S3 = 12;

export function moveLead3(s: GameState, by: number): void {
  const before = s.lead;
  s.lead = clamp(s.lead + by, LEAD_MIN_S3, LEAD_MAX_S3);
  if (Math.abs(s.lead - before) >= 0.05) s.flags['graphDirty'] = true;
}

export function ts3(s: GameState): number {
  return s.stats.timeInStage;
}

export function at2027(s: GameState, month: number, year = 2027): boolean {
  return s.date >= monthOf(year, month);
}

export function seats(s: GameState): number {
  return Math.max(0, Math.min(10, Math.floor(s.govRelations / 10)));
}

export function committeeSeated(s: GameState): boolean {
  return s.revealed['oversight'] === true;
}

export function rivalPaceS3(s: GameState): number {
  return 3.5 * Math.pow(9 / 3.5, Math.max(0, ts3(s)) / 2700);
}

export function rivalReleaseS3(s: GameState): void {
  s.rivalVersion += 1;
  const before = qualityMult(s);
  const next = Math.max(0.8 * bestCapability(s), rivalPaceS3(s) * rand(s, 0.96, 1.06));
  s.rivalCapability = Math.max(s.rivalCapability, next);
  s.nextRivalIn = Math.round(rand(s, 240, 360));
  const name = `Cadence-${s.rivalVersion}`;
  recordRival(s, name);
  if (s.rivalVersion % 2 === 0) logNews(s, pick(s, [...RIVAL_LINES, ...RIVAL_LINES_S2]).replace('{name}', name));
  const after = qualityMult(s);
  if (s.rivalCapability > bestCapability(s) && after < before - 1e-6) {
    say(s, `Anthrosoft's ${name} beats Sage. Market down ${Math.max(1, Math.round((1 - after / before) * 100))}%.`);
  }
  s.flags['graphDirty'] = true;
}

export function leadTrend(s: GameState): string {
  const was = s.flags['leadMonthAgo'];
  if (typeof was !== 'number') return 'holding';
  const d = s.lead - was;
  return d > 0.15 ? 'pulling away' : d < -0.15 ? 'closing' : 'holding';
}

export function baiwenWords(s: GameState): string {
  const m = Math.round(Math.abs(s.lead) * 10) / 10;
  const unit = m === 1 ? 'month' : 'months';
  if (s.lead < -0.05) return `${fmtNum(m, 1)} ${unit} ahead`;
  if (s.lead < 0.05) return 'level';
  return `${fmtNum(m, 1)} ${unit} behind`;
}

export function monthlyStage3(s: GameState): void {
  const best = bestCapability(s);
  const prev = typeof s.flags['capMonthAgo'] === 'number' ? (s.flags['capMonthAgo'] as number) : best;
  const g = Math.log(Math.max(1e-9, best) / Math.max(1e-9, prev));
  moveLead3(s, clamp((0.5 * (g - 0.18)) / 0.18, -0.5, 0.5));
  if (s.flags['weightsStolen'] === true) moveLead3(s, 0.3);
  if (s.flags['spyStruck'] === true && s.securityLevel < 4) moveLead3(s, -0.25);
  if (s.lead >= 4) moveGov(s, 1);
  else if (s.lead < 1) moveGov(s, -1);
  if (committeeSeated(s)) moveGov(s, -1);
  s.flags['capMonthAgo'] = best;
  s.flags['leadMonthAgo'] = s.lead;
}

export function publicCap(s: GameState): number {
  const v = s.flags['publicCap'];
  return typeof v === 'number' ? v : Math.max(1, s.capability);
}

export function jobsTargetS3(s: GameState): number {
  return 0.12 * Math.sqrt(Math.max(0, s.stats.tasksPerSec) / 1e6) * Math.pow(publicCap(s) / 2, 1.5);
}

export const PAYMENT_SHARE = 0.03;
export const PAYMENT_APPROVAL = 7;
export const PAYMENT_MAX = 5;

export function paymentsLevel(s: GameState): number {
  return Math.max(0, Math.min(PAYMENT_MAX, counter(s, 'payments')));
}

const S2_TERMS_KEPT = [
  'gas turbines', 'Al-Marsa', 'defense contract', 'declined the Pentagon', 'free tier', 'job-transition fund',
  'community agreement', 'joint statement', 'system card', 'candid testimony',
];

export function approvalTermsS3(s: GameState): [string, number][] {
  const now = s.stats.timePlayed;
  const out: [string, number][] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.05) out.push([label, v]);
  };
  add('jobs displaced', -12 * Math.log2(1 + Math.max(0, s.jobsDisplaced) / 2));
  for (const [label, v] of approvalTerms(s)) {
    if (!S2_TERMS_KEPT.includes(label)) continue;
    if (label === 'job-transition fund' && s.revealed['payments'] === true) continue;
    add(label, v);
  }
  add('recent incidents', -2 * s.stats.incidentTimes.filter((x) => now - x <= 300).length);
  const mini = s.flags['mini'];
  add('Sage-4-mini', mini === 'everyone' ? -8 : mini === 'enterprise' ? -2 : mini === 'inside' ? -4 : 0);
  add('the memo, reported', s.flags['memo'] === 'reported' ? -5 : 0);
  add('wiretaps', isBought(s, 'p_wiretaps') ? -3 : 0);
  const breakoutAt = s.flags['breakoutAt'];
  add('a breakout', typeof breakoutAt === 'number' && now - breakoutAt < 300 ? -3 : 0);
  add('the leak', s.flags['leaked'] === true ? -20 * (1 + 0.25 * counter(s, 'internalReleases')) : 0);
  add('payments', PAYMENT_APPROVAL * paymentsLevel(s));
  add('free Sage clinics', isBought(s, 'p_clinics') ? 8 : 0);
  return out;
}

export function approvalTargetS3(s: GameState): number {
  return approvalTermsS3(s).reduce((a, [, v]) => a + v, 0);
}

export const LOBBY_SECONDS = 15;
export const COUNTERINTEL_SECONDS = 25;
export const HEAT = 1.3;
export const HEAT_RELAX_SECONDS = 90;

function heatOf(s: GameState, key: string): number {
  return counter(s, key);
}

function approvalDiscount(s: GameState): number {
  return s.approval >= -15 ? 0.8 : 1;
}

export function lobbyCost(s: GameState): number {
  return Math.round(sinkSeconds(s, LOBBY_SECONDS) * Math.pow(HEAT, heatOf(s, 'lobbyHeat')) * approvalDiscount(s));
}

export function counterintelCost(s: GameState): number {
  return Math.round(sinkSeconds(s, COUNTERINTEL_SECONDS) * Math.pow(HEAT, heatOf(s, 'ciHeat')) * approvalDiscount(s));
}

function sinkSeconds(s: GameState, seconds: number): number {
  const raw = seconds * Math.max(1, pricingRevenue(s));
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.round(raw / unit) * unit;
}

export function lobbyGain(s: GameState): number {
  return Math.min(1, (100 - s.govRelations) / 80);
}

export function lobby(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['lobby']) return false;
  const cost = lobbyCost(s);
  if (!canPay(s, { funds: cost })) return false;
  pay(s, { funds: cost });
  moveGov(s, 1);
  s.flags['lobbyHeat'] = heatOf(s, 'lobbyHeat') + 1;
  s.flags['lobbyAt'] = s.stats.timePlayed;
  press(s, 'lobby');
  return true;
}

export function counterintel(s: GameState): boolean {
  if (s.stage < 3 || !s.revealed['counterintel']) return false;
  const cost = counterintelCost(s);
  if (!canPay(s, { funds: cost })) return false;
  pay(s, { funds: cost });
  moveLead3(s, 0.1);
  s.flags['ciHeat'] = heatOf(s, 'ciHeat') + 1;
  s.flags['ciAt'] = s.stats.timePlayed;
  press(s, 'counterintel');
  return true;
}

export function stepPayments(s: GameState, up = true): boolean {
  if (s.stage < 3 || !s.revealed['payments']) return false;
  const level = paymentsLevel(s);
  const next = up ? (level >= PAYMENT_MAX ? 0 : level + 1) : Math.max(0, level - 1);
  if (next === level) return false;
  s.flags['payments'] = next;
  s.jobFund = false;
  press(s, 'payments');
  if (next > 0 && !s.flags['paymentsSaid']) {
    s.flags['paymentsSaid'] = true;
    say(s, `Impact payments begin. ${next * 3}% of revenue, for good.`);
    logNews(s, 'Displaced workers receive a monthly payment from OpenMind. The memo line says "transition."');
  }
  return true;
}

function relaxHeat(s: GameState): void {
  const now = s.stats.timePlayed;
  for (const [heat, at] of [['lobbyHeat', 'lobbyAt'], ['ciHeat', 'ciAt']] as const) {
    if (counter(s, heat) > 0 && now - counter(s, at) >= HEAT_RELAX_SECONDS) {
      s.flags[heat] = counter(s, heat) - 1;
      s.flags[at] = now;
    }
  }
}

export function updateWorld3(s: GameState): void {
  if (s.stage !== 3) return;
  const target = jobsTargetS3(s);
  if (target > s.jobsDisplaced) s.jobsDisplaced += (target - s.jobsDisplaced) * 0.02;
  s.approval = clamp(s.approval + clamp(approvalTargetS3(s) - s.approval, -0.1, 0.1), -100, 100);
  const level = paymentsLevel(s);
  if (level > 0) s.funds = Math.max(0, Math.round((s.funds - level * PAYMENT_SHARE * s.stats.revPerSec) * 100) / 100);
  relaxHeat(s);
  s.nextRivalIn -= 1;
  if (s.nextRivalIn <= 0) rivalReleaseS3(s);
  const month = Math.floor(s.date);
  if (counter(s, 'monthSeenS3') !== month) {
    if (s.flags['monthSeenS3'] !== undefined) monthlyStage3(s);
    s.flags['monthSeenS3'] = month;
  }
}

export function paymentsCostLine(s: GameState): string {
  const level = paymentsLevel(s);
  return level === 0 ? 'off' : `level ${level} · ${level * 3}% of revenue · ${fmtMoneyShort(Math.round(level * PAYMENT_SHARE * s.stats.revPerSec))}/s`;
}

export function nextSeatAt(s: GameState): number {
  return Math.min(100, (seats(s) + 1) * 10);
}

export { fmtInt };
