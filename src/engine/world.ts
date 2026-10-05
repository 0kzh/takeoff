import { GameState, say, logNews, isBought, addFunds, press, counter, canPay, pay } from './state.js';
import { rand, pick } from './rng.js';
import { fmtNum, fmtInt, monthOf } from './format.js';
import { bestCapability, copies, qualityMult, researchCap } from './economy.js';
import { trainCost } from './training.js';
import { s2, secondsOfRevenue } from './infrastructure.js';
import { RIVAL_LINES } from '../data/flavor.js';
import { stageDef } from './stages.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const CRAWL_TOTAL = 15;
export const CRAWL_RATE = 0.1;
export const FLYWHEEL_T_PER_BILLION = 0.6;

export function crawlRate(s: GameState): number {
  return isBought(s, 'p_web_crawl') && s.crawlLeft > 0 ? CRAWL_RATE : 0;
}

export const SYNTH_RATE = 0.006;

export function synthRate(s: GameState): number {
  if (!isBought(s, 'p_synth')) return 0;
  return SYNTH_RATE * Math.sqrt((copies(s) * s.researchAlloc) / 1000);
}

export function flywheelRate(s: GameState): number {
  return isBought(s, 'p_flywheel') ? (s.stats.soldPerSec / 1e9) * FLYWHEEL_T_PER_BILLION : 0;
}

export function updateData(s: GameState, dt: number): void {
  if (s.stage < 2) return;
  const crawl = Math.min(s.crawlLeft, crawlRate(s) * dt);
  if (crawl > 0) {
    s.crawlLeft -= crawl;
    s.data += crawl;
    if (s.crawlLeft <= 1e-9) {
      s.crawlLeft = 0;
      say(s, 'The crawl is finished. There is no more public web to read.');
    }
  }
  const synth = synthRate(s) * dt;
  if (synth > 0) {
    s.data += synth;
    s.dataSynthetic += synth;
  }
  if (isBought(s, 'p_flywheel')) {
    const last = counter(s, 'flywheelSold');
    if (last > 0 && s.tasksSold > last) s.data += ((s.tasksSold - last) / 1e9) * FLYWHEEL_T_PER_BILLION;
    s.flags['flywheelSold'] = s.tasksSold;
  }
}

export function dataWall(s: GameState): boolean {
  if (s.stage !== 2 || s.flags['dataEra'] !== true || !isBought(s, 'p_web_crawl') || s.crawlLeft > 0) return false;
  const need = trainCost(s).data ?? 0;
  return need > 0 && s.data + 1e-9 < need;
}

export function dataNotInHand(s: GameState): boolean {
  if (s.stage !== 2 || s.flags['dataEra'] !== true) return false;
  const need = trainCost(s).data ?? 0;
  return need > 0 && s.data + 1e-9 < need;
}

export function dataShort(s: GameState): boolean {
  if (s.stage !== 2 || s.flags['dataEra'] !== true) return false;
  const cost = trainCost(s);
  if (!cost.data || s.data + 1e-9 >= cost.data) return false;
  return s.crawlLeft <= 0 && s.research >= 0.5 * (cost.research ?? 0);
}

export function dataWallCheck(s: GameState): void {
  const short = dataShort(s);
  const was = s.flags['dataShortNow'] === true;
  if (short && !was) {
    s.flags['dataShortCount'] = counter(s, 'dataShortCount') + 1;
    s.flags['dataShortSince'] = s.stats.timePlayed;
    const need = trainCost(s).data ?? 0;
    say(s, `The Data Wall — the next run needs ${fmtNum(need, 1)} T. The lab holds ${fmtNum(s.data, 1)} T.`);
  }
  if (!short) delete s.flags['dataShortSince'];
  s.flags['dataShortNow'] = short;
}

export function dataShortSeconds(s: GameState): number {
  const at = s.flags['dataShortSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
}

export const RIVAL_LINES_S2: string[] = [
  'Anthrosoft ships {name}. It matches Sage on everything but price.',
  'Anthrosoft ships {name}. Their safety card is longer than ours.',
];

export function rivalReleaseS2(s: GameState): void {
  s.rivalVersion += 1;
  const before = qualityMult(s);
  const lo = 0.8 * bestCapability(s);
  const next = Math.max(lo, rivalPace(s) * rand(s, 0.96, 1.06));
  s.rivalCapability = Math.max(s.rivalCapability, next);
  s.nextRivalIn = Math.round(rand(s, 240, 420));
  const name = `Cadence-${s.rivalVersion}`;
  recordRival(s, name);
  logNews(s, pick(s, [...RIVAL_LINES, ...RIVAL_LINES_S2]).replace('{name}', name));
  const after = qualityMult(s);
  if (s.rivalCapability > s.capability && after < before - 1e-6) {
    const pct = Math.max(1, Math.round((1 - after / before) * 100));
    say(s, `Anthrosoft's ${name} beats Sage. Market down ${pct}%.`);
  } else if (s.rivalCapability > s.capability) {
    say(s, `${name} is ahead of Sage.`);
  } else {
    say(s, `Anthrosoft ships ${name}. Sage is still ahead.`);
  }
  s.flags['graphDirty'] = true;
}

export function rivalPace(s: GameState): number {
  return 1.55 * Math.pow(4.2 / 1.55, Math.max(0, s.stats.timeInStage) / 2400);
}

export function recordRival(s: GameState, name: string): void {
  s.rivalHistory.push({ name, capability: Math.round(s.rivalCapability * 1000) / 1000, date: s.date });
  if (s.rivalHistory.length > 40) s.rivalHistory.splice(0, s.rivalHistory.length - 40);
}

export function baiwenAt(s: GameState, date: number): number {
  const then = date - s.lead;
  let best = 0.7;
  for (const m of s.training.models) if (m.date <= then) best = Math.max(best, m.capability);
  return best;
}

export function leadWords(s: GameState): string {
  const m = Math.round(s.lead * 2) / 2;
  return `about ${fmtNum(m, m % 1 ? 1 : 0)} month${m === 1 ? '' : 's'} behind`;
}

export function moveLead(s: GameState, by: number): void {
  const before = s.lead;
  s.lead = clamp(s.lead + by, 1, 9);
  if (Math.abs(s.lead - before) >= 0.25) s.flags['graphDirty'] = true;
}

export function moveGov(s: GameState, by: number): void {
  const eff = by > 0 ? by * Math.min(1, (100 - s.govRelations) / 80) : by;
  s.govRelations = clamp(s.govRelations + eff, 0, 100);
}

export function govMood(s: GameState): string {
  if (s.govRelations >= 80) return 'allied';
  if (s.govRelations >= 60) return 'close';
  if (s.govRelations >= 30) return 'cordial';
  return 'wary';
}

export function govBandNote(s: GameState): string {
  const g = s.govRelations;
  if (g >= 80) return 'the solar queue is halved';
  if (g >= 60) return 'at 80 the solar queue halves';
  if (g >= 40) return 'at 60 reactors cost a quarter less';
  if (g >= 30) return 'under 30: a subpoena';
  return 'a subpoena is coming';
}

export function approvalBandNote(s: GameState): string {
  const a = s.approval;
  if (a <= -40) return 'protests at Abilene; permits slow';
  if (a < -30) return 'datacenter permits take a minute longer';
  if (a < -15) return 'under −30 permits slow';
  return '';
}

export const ADVISORY_BELOW = 65;
export const TRUSTED_FROM = 85;

export function alignBandNote(s: GameState): string {
  const a = s.alignmentApparent;
  if (a < ADVISORY_BELOW) return 'advisories from 3× · 85: releases win relations';
  if (a < TRUSTED_FROM) return 'under 65: advisories · 85: releases win relations';
  return 'each public release: relations +1 · under 65: advisories';
}

export function leadBandNote(s: GameState): string {
  if (s.stage !== 2) return '';
  if (s.lead < 1) return 'Washington tightens exports: chips cost a tenth more';
  if (s.lead >= 3) return 'Washington warms: relations +1 a month';
  return 'under 1: chips cost a tenth more · 3: relations +1 a month';
}

export function jobsTarget(s: GameState): number {
  return 0.12 * Math.sqrt(Math.max(0, s.stats.tasksPerSec) / 1e6) * Math.pow(bestCapability(s) / 2, 1.5);
}

export function recentIncidents(s: GameState): number {
  const now = s.stats.timePlayed;
  return s.stats.incidentTimes.filter((t) => now - t <= 300).length;
}

export function noteIncident(s: GameState): void {
  const now = s.stats.timePlayed;
  s.stats.incidentTimes = s.stats.incidentTimes.filter((t) => now - t <= 300);
  s.stats.incidentTimes.push(Math.round(now));
}

export function approvalTerms(s: GameState): [string, number][] {
  const terms: [string, number][] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.05) terms.push([label, v]);
  };
  add('jobs displaced', -10 * Math.pow(Math.max(0, s.jobsDisplaced), 0.6));
  add('gas turbines', -1.5 * s.gasPlants);
  add('Sage-mini', isBought(s, 'p_distill') ? -5 : 0);
  add('Al-Marsa', s.flags['gulfSigned'] === true ? -3 : 0);
  add('defense contract', s.flags['defenseContract'] === true ? -8 : 0);
  add('recent incidents', -2 * recentIncidents(s));
  add('fought the publishers', s.flags['foughtPublishers'] === true ? -4 : 0);
  add('Sage-3 public', s.flags['sage3Released'] === 'public' ? -6 : 0);
  add('free tier', isBought(s, 'p_free_tier') ? 8 : 0);
  add('job-transition fund', s.jobFund ? 10 : 0);
  add('community agreement', isBought(s, 'p_community') ? 6 : 0);
  add('candid testimony', s.flags['candid'] === true ? 3 : 0);
  add('licensed the publishers', s.flags['licensedPublishers'] === true ? 2 : 0);
  add('licensed the archives', isBought(s, 'p_license_archive') ? 2 : 0);
  add('declined the Pentagon', s.flags['declinedDefense'] === true ? 3 : 0);
  add('joint statement', s.flags['pactSigned'] === true ? 5 : s.flags['pactDeclined'] === true ? -2 : 0);
  add('system card', isBought(s, 'p_system_card') ? 2 : 0);
  return terms;
}

export function approvalTarget(s: GameState): number {
  return approvalTerms(s).reduce((a, [, v]) => a + v, 0);
}

export function updateWorld(s: GameState): void {
  if (s.stage !== 2) return;
  const target = jobsTarget(s);
  if (target > s.jobsDisplaced) s.jobsDisplaced += (target - s.jobsDisplaced) * 0.02;
  s.approval += clamp(approvalTarget(s) - s.approval, -0.1, 0.1);
  s.approval = clamp(s.approval, -100, 100);

  const perMonth = 1 / stageDef(s.stage).secondsPerMonth;
  if (isBought(s, 'p_policy')) {
    if (s.govRelations < 60) s.govRelations = Math.min(60, s.govRelations + 0.5 * perMonth);
  } else if (s.capability >= 2.5) {
    moveGov(s, -0.5 * perMonth);
  }

  if (s.date >= monthOf(2026, 7) && s.securityLevel < 3) moveLead(s, -0.1 * perMonth);
  if (s.lead >= 3) moveGov(s, 1 * perMonth);

  if (s.govRelations < 30 && !s.flags['subpoenaFired']) {
    s.flags['subpoenaFired'] = true;
    s.flags['subpoenaDue'] = true;
  }
  if (s.approval <= -40 && s.stats.timePlayed - counter(s, 'riotsAt') > 300) {
    s.flags['riotsAt'] = s.stats.timePlayed;
    s.flags['riotsDue'] = true;
  }
}

export const SECURITY_NOTES: Record<number, string> = {
  1: 'SL1 — a password on the cluster',
  2: 'SL2 — holds against opportunists',
  3: 'SL3 — weights air-gapped',
};

export function sl3Cost(s: GameState): { funds: number; trust: number } {
  const until = s.flags['sl3DiscountUntil'];
  const discounted = typeof until === 'number' && s.stats.timePlayed < until;
  if (s.stage >= 3) return { funds: secondsOfRevenue(s, discounted ? 30 : 60), trust: 0 };
  return discounted ? { funds: s2(s, 4000000), trust: 0 } : { funds: s2(s, 20000000), trust: 3 };
}

export function buySL3(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['sl3Button'] || s.securityLevel >= 3) return false;
  const cost = sl3Cost(s);
  if (!canPay(s, cost)) return false;
  pay(s, cost);
  s.securityLevel = 3;
  moveGov(s, 5);
  if (s.stage >= 3) s.lead = clamp(s.lead + 1, -2, 12);
  else moveLead(s, 1);
  press(s, 'sl3');
  say(s, 'Weights air-gapped. Two people and two keys to move a checkpoint. SL3.');
  logNews(s, 'OpenMind\'s weights now live on machines with no network cable.');
  return true;
}

export function toggleJobFund(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['jobFund']) return false;
  s.jobFund = !s.jobFund;
  press(s, 'toggleJobFund');
  if (s.jobFund && !s.flags['jobFundSaid']) {
    s.flags['jobFundSaid'] = true;
    say(s, 'Job-transition fund on. 2% of revenue, for as long as it is on.');
    logNews(s, 'OpenMind funds retraining for displaced engineers. The course is taught by Sage.');
  }
  return true;
}

export function toggleShareEvals(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['shareEvals']) return false;
  s.shareEvals = !s.shareEvals;
  press(s, 'toggleShareEvals');
  if (s.shareEvals && !s.flags['shareEvalsSaid']) {
    s.flags['shareEvalsSaid'] = true;
    say(s, 'The Safety Institute gets the eval suite with every release.');
  }
  return true;
}

export function cycleAlignShare(s: GameState): boolean {
  if (s.stage < 2 || !s.revealed['alignShare']) return false;
  const pct = Math.round(s.alignShare * 100);
  s.alignShare = pct < 5 ? 0.05 : pct < 10 ? 0.1 : 0.01;
  press(s, 'alignShare');
  say(s, `Alignment compute set to ${Math.round(s.alignShare * 100)}%. ${s.alignShare > 0.01 ? 'That many copies stop earning.' : 'The copies go back to work.'}`);
  return true;
}

export function runRate(s: GameState): number {
  return s.stats.revPerSec * 2520;
}

export function capWall(s: GameState): boolean {
  return (trainCost(s).research ?? 0) > 0.6 * researchCap(s);
}

export function grant(s: GameState, scale1: number): void {
  addFunds(s, s2(s, scale1));
}

export function atMonth(s: GameState, year: number, month: number): boolean {
  return s.date >= monthOf(year, month);
}

export function fmtJobs(m: number): string {
  if (m < 10) return `${fmtNum(m, m < 0.1 ? 2 : 1)}M`;
  return `${fmtInt(m)}M`;
}
