import { GameState, ActiveChoice, Cost, say, logNews, canPay, pay } from './state.js';
import { DEVELOPMENTS, DevelopmentDef } from '../data/developments.js';
import { CHOICES, ChoiceDef, ChoiceOption } from '../data/choices.js';
import { crisisById, CRISES, INCIDENTS } from '../data/crises.js';
import { RIVAL_LINES } from '../data/flavor.js';
import { visibleProjects, costLabel } from './projects.js';
import { pressCost } from '../data/projects.js';
import { effectiveData } from './data.js';
import {
  gpuCost, marketingCost, qualityMult, powerBlockCost, CONTRACT_PAUSE_SECONDS, researchCap, researchRate,
  datacenterCost, gpuBatchCost, gridUpgradeCost, canExpandGrid, canBuyGpuBatch, canUpgradeSecurity, securityCost,
} from './economy.js';
import { canStartTraining, canRedTeam, trainCost } from './training.js';
import { dateLabel, fmtMoneyShort, fmtInt } from './format.js';
import { mechanic, mechanicClear } from './stages.js';
import { BEAT_GAP_SECONDS } from './reveal.js';
import { rand, pick, chance } from './rng.js';
import { labStalled } from './rivals.js';

export function developmentById(id: string): DevelopmentDef | undefined {
  return DEVELOPMENTS.find((d) => d.id === id);
}

export function choiceById(id: string): ChoiceDef | undefined {
  return CHOICES.find((c) => c.id === id);
}

export function updateDevelopments(s: GameState): void {
  for (const d of DEVELOPMENTS) {
    if (s.developments[d.id] || d.stage !== s.stage || d.calendar) continue;
    if (d.requires && !d.requires(s)) continue;
    const byDate = d.month !== undefined && s.date >= d.month;
    const byProgress = d.trigger ? d.trigger(s) : false;
    if (byDate || byProgress) fireDevelopment(s, d.id);
  }
  updateCalendar(s);
}

export const EVENT_AFTER_RELEASE = 60;
export const EVENT_SPACING = 156;

let calendarChoices: Set<string> | null = null;
function isCalendarChoice(id: string): boolean {
  calendarChoices ??= new Set(DEVELOPMENTS.filter((d) => d.calendar && d.choice).map((d) => d.choice!));
  return calendarChoices.has(id);
}

function calendarSlotAt(s: GameState): number {
  if (s.stage !== 1 || !DEVELOPMENTS.some((d) => d.calendar && d.stage === 1 && !s.developments[d.id])) return Infinity;
  const first = s.flags['firstReleaseAt'];
  if (typeof first !== 'number') return Infinity;
  const answered = s.flags['eventAnsweredAt'];
  return Math.max(first + EVENT_AFTER_RELEASE, typeof answered === 'number' ? answered + EVENT_SPACING : 0);
}

function updateCalendar(s: GameState): void {
  if (s.stage !== 1 || s.stats.timePlayed < calendarSlotAt(s)) return;
  const run = s.training.run;
  if (run && run.phase !== 'training') return;
  if (!modalCanOpen(s) || !mechanicClear(s)) return;
  const next = DEVELOPMENTS.find((d) => d.calendar && d.stage === 1 && !s.developments[d.id] && (!d.requires || d.requires(s)));
  if (!next) return;
  mechanic(s);
  s.flags['calendarOpened'] = true;
  fireDevelopment(s, next.id);
}

function noteAnswered(s: GameState, choiceId: string): void {
  if (s.stage === 1 && isCalendarChoice(choiceId)) s.flags['eventAnsweredAt'] = s.stats.timePlayed;
}

export function fireDevelopment(s: GameState, id: string): boolean {
  const d = developmentById(id);
  if (!d) return false;
  s.developments[id] = true;
  if (d.crisis && d.choice) s.scheduled.push({ id: d.crisis, delay: 4 });
  else if (d.crisis) fireCrisis(s, d.crisis);
  if (d.text) logNews(s, d.text);
  d.effect?.(s);
  if (d.choice) openChoice(s, d.choice, {});
  return true;
}

export function secondsToNextCalendarModal(s: GameState): number {
  return Math.max(0, calendarSlotAt(s) - s.stats.timePlayed);
}

export function pendingDevelopments(s: GameState): DevelopmentDef[] {
  return DEVELOPMENTS.filter((d) => !s.developments[d.id] && d.stage >= s.stage && d.stage <= s.stage + 1);
}

export function fireCrisis(s: GameState, id: string, source?: string): boolean {
  const c = crisisById(id);
  if (!c) return false;
  if (c.duration > 0) {
    s.effects.push({
      id: c.id,
      remaining: c.duration,
      demandMult: c.demandMult,
    });
  }
  c.effect(s);
  if (c.console) say(s, c.console);
  const incident = INCIDENTS.includes(c);
  if (source && incident) say(s, `Traced to an issue shipped in ${source}.`);
  if (c.log) logNews(s, source && incident ? `${c.log} It traces back to ${source}.` : c.log);
  if (incident) {
    s.stats.incidents += 1;
    s.trust -= 1;
    say(s, 'The board asks what happened. Trust −1.');
    if ((s.projects['p_contract']?.bought ?? 0) > 0) {
      const until = typeof s.flags['contractsPausedUntil'] === 'number' ? (s.flags['contractsPausedUntil'] as number) : 0;
      s.flags['contractsPausedUntil'] = Math.max(until, s.stats.timePlayed) + CONTRACT_PAUSE_SECONDS;
      say(s, 'The bank pauses its pilot. Contract customers stop buying for 1:30.');
    }
  } else {
    s.stats.crises += 1;
  }
  return true;
}

export function updateScheduled(s: GameState, dt: number): void {
  if (s.scheduled.length === 0) return;
  const due: { id: string; source?: string }[] = [];
  for (const e of s.scheduled) {
    e.delay -= dt;
    if (e.delay <= 0) due.push({ id: e.id, source: e.source });
  }
  s.scheduled = s.scheduled.filter((e) => e.delay > 0);
  for (const e of due) fireCrisis(s, e.id, e.source);
}

export function updateRival(s: GameState): void {
  if (!s.revealed['rival']) return;
  s.nextRivalIn -= 1;
  if (s.nextRivalIn > 0) return;
  rivalRelease(s);
}

export const RIVAL_BAND: [number, number] = [0.85, 1.15];

export function rivalRelease(s: GameState): void {
  s.revealed['rival'] = true;
  s.rivalVersion += 1;
  const ours = s.capability;
  const target = chance(s, 0.35) ? ours * rand(s, 1.02, 1.12) : s.rivalCapability * rand(s, 1.03, 1.1);
  let next = Math.min(RIVAL_BAND[1] * ours, Math.max(RIVAL_BAND[0] * ours, target));
  if (s.stage >= 2) {
    const own = s.rivalCapability * rand(s, 1.08, 1.18);
    next = Math.max(next, labStalled(s) ? own : Math.min(own, 1.3 * ours));
  }
  s.rivalCapability = Math.max(s.rivalCapability, next);
  s.nextRivalIn = Math.round(rand(s, 240, 420) * (s.stage >= 2 ? 1.4 - s.tempo / 125 : 1));
  if (s.stage >= 2) s.flags['rivalReleasesS2'] = ((s.flags['rivalReleasesS2'] as number) || 0) + 1;
  const name = `Cadence-${s.rivalVersion}`;
  logNews(s, pick(s, RIVAL_LINES).replace('{name}', name));
  const q = qualityMult(s);
  if (q < 0.995) say(s, `Anthrosoft's ${name} beats ${s.training.deployedName}. Demand ${q < 0.9 ? 'falls' : 'dips'}.`);
  else say(s, `Anthrosoft ships ${name}. ${s.training.deployedName} is still ahead.`);
}

export const MODAL_SPACING = 150;
export const PLAYER_MODALS = ['c_ship_issues', 'c_sage2', 'c_release'];

export interface OpenOptions {
  onlyIfFree?: boolean;
  force?: boolean;
}

function modalFree(s: GameState): boolean {
  return !s.activeChoice && s.stats.timePlayed - s.cadence.lastModalAt >= MODAL_SPACING;
}

function beatClear(s: GameState): boolean {
  return s.stats.timePlayed - s.cadence.lastRevealAt >= BEAT_GAP_SECONDS;
}

export function modalCanOpen(s: GameState): boolean {
  return modalFree(s) && s.choiceQueue.length === 0 && beatClear(s);
}

function present(s: GameState, entry: ActiveChoice): void {
  s.activeChoice = entry;
  // Player-initiated modals (release decisions) do not reset the spacing that
  // paces the world's own events, or those events starve behind every run.
  if (!PLAYER_MODALS.includes(entry.id)) s.cadence.lastModalAt = s.stats.timePlayed;
  choiceById(entry.id)?.onOpen?.(s, entry.context);
}

export function openChoice(s: GameState, id: string, context: Record<string, number | string>, opts: OpenOptions = {}): boolean {
  const def = choiceById(id);
  if (!def) return false;
  const entry: ActiveChoice = { id, remaining: def.timer ?? 0, context };
  if (PLAYER_MODALS.includes(id) || opts.force) {
    if (s.activeChoice) s.choiceQueue.unshift(s.activeChoice);
    present(s, entry);
    return true;
  }
  if (modalFree(s) && s.choiceQueue.length === 0 && (beatClear(s) || opts.onlyIfFree)) {
    present(s, entry);
    return true;
  }
  if (opts.onlyIfFree) return false;
  s.choiceQueue.push(entry);
  return true;
}

export function drainChoiceQueue(s: GameState): void {
  while (s.choiceQueue.length && !s.activeChoice) {
    const next = s.choiceQueue[0]!;
    const def = choiceById(next.id);
    if (!def || (def.valid && !def.valid(s, next.context))) {
      s.choiceQueue.shift();
      continue;
    }
    if (!PLAYER_MODALS.includes(next.id) && (s.stats.timePlayed - s.cadence.lastModalAt < MODAL_SPACING || !beatClear(s))) return;
    s.choiceQueue.shift();
    present(s, next);
  }
}

export function optionCost(s: GameState, opt: ChoiceOption): Cost | undefined {
  return typeof opt.cost === 'function' ? opt.cost(s, s.activeChoice?.context ?? {}) : opt.cost;
}

export function optionTooltip(s: GameState, opt: ChoiceOption): string {
  return (typeof opt.tooltip === 'function' ? opt.tooltip(s, s.activeChoice?.context ?? {}) : opt.tooltip) ?? '';
}

export function choiceOptionEnabled(s: GameState, def: ChoiceDef, index: number): boolean {
  const opt = def.options[index];
  if (!opt || !s.activeChoice) return false;
  const cost = optionCost(s, opt);
  if (cost && !canPay(s, cost)) return false;
  return opt.enabled ? opt.enabled(s, s.activeChoice.context) : true;
}

export function resolveChoice(s: GameState, index: number): boolean {
  const active = s.activeChoice;
  if (!active) return false;
  const def = choiceById(active.id);
  if (!def) {
    s.activeChoice = null;
    return false;
  }
  if (!choiceOptionEnabled(s, def, index)) return false;
  const opt = def.options[index]!;
  const cost = optionCost(s, opt);
  const before = choiceSnapshot(s);
  const lines = s.console.length;
  if (cost) pay(s, cost);
  s.activeChoice = null;
  noteAnswered(s, def.id);
  opt.effect(s, active.context);
  reportChoice(s, opt.label, before, lines);
  s.choicesMade.push({ id: def.id, option: opt.record, date: dateLabel(s.date) });
  s.stats.choices += 1;
  if (opt.log) logNews(s, typeof opt.log === 'function' ? opt.log(s, active.context) : opt.log, 'choice');
  return true;
}

type ChoiceSnapshot = Record<string, number>;

/** What a choice can move, read before and after its effect so the console can say what changed. */
function choiceSnapshot(s: GameState): ChoiceSnapshot {
  return {
    funds: s.funds,
    trust: s.trust,
    research: s.research,
    insight: s.insight,
    approval: s.approval,
    tempo: s.tempo,
    relations: s.govRelations,
    alignment: s.revealed['alignment'] ? s.alignmentApparent : 0,
    data: effectiveData(s),
    researchers: s.researchers,
    gpus: s.gpus,
    marketing: s.hypeLevel,
    demand: s.demandMult,
    security: s.security,
    labSpace: s.labSpace,
  };
}

function choiceDeltas(before: ChoiceSnapshot, after: ChoiceSnapshot): string[] {
  const out: string[] = [];
  const signed = (n: number, digits = 0) => `${n > 0 ? '+' : '−'}${digits ? Math.abs(n).toFixed(digits) : fmtInt(Math.abs(n))}`;
  const d = (key: string) => after[key]! - before[key]!;
  if (Math.abs(d('funds')) >= 1) out.push(`${d('funds') > 0 ? '+' : '−'}${fmtMoneyShort(Math.abs(d('funds')))}`);
  if (d('trust') !== 0) out.push(`${signed(d('trust'))} Trust`);
  if (Math.abs(d('research')) >= 1) out.push(`${signed(d('research'))} research`);
  if (Math.abs(d('insight')) >= 1) out.push(`${signed(d('insight'))} insight`);
  if (Math.abs(d('approval')) >= 0.5) out.push(`approval ${signed(d('approval'))}`);
  if (Math.abs(d('tempo')) >= 0.5) out.push(`tempo ${signed(d('tempo'))}`);
  if (Math.abs(d('relations')) >= 0.5) out.push(`relations ${signed(d('relations'))}`);
  if (before['alignment'] && Math.abs(d('alignment')) >= 0.5) out.push(`alignment ${signed(d('alignment'))}`);
  if (Math.abs(d('data')) >= 0.05) out.push(`${signed(d('data'), 1)}T data`);
  if (d('researchers') !== 0) out.push(`${signed(d('researchers'))} researchers`);
  if (d('gpus') !== 0) out.push(`${signed(d('gpus'))} GPUs`);
  if (d('marketing') !== 0) out.push(`marketing ${signed(d('marketing'))}`);
  if (d('labSpace') !== 0) out.push(`lab space ${signed(d('labSpace'))}`);
  if (d('security') !== 0) out.push(`security ${signed(d('security'))}`);
  const demand = after['demand']! / Math.max(1e-9, before['demand']!);
  if (Math.abs(demand - 1) >= 0.005) out.push(`demand ×${demand.toFixed(2)}`);
  return out;
}

/** After a choice: its own console line, if it wrote one, gains the numbers that moved; otherwise one line is written. */
function reportChoice(s: GameState, label: string, before: ChoiceSnapshot, linesBefore: number): void {
  const deltas = choiceDeltas(before, choiceSnapshot(s));
  const wrote = s.console.length > linesBefore;
  if (wrote) {
    if (deltas.length) s.console[s.console.length - 1] += ` ${deltas.join(' · ')}`;
    return;
  }
  if (!deltas.length) return;
  const head = label.charAt(0).toUpperCase() + label.slice(1);
  say(s, `${head}: ${deltas.join(' · ')}.`);
}

export function updateChoice(s: GameState, dt: number): void {
  const active = s.activeChoice;
  if (!active) return;
  const def = choiceById(active.id);
  if (!def) {
    s.activeChoice = null;
    return;
  }
  if (!def.timer) return;
  active.remaining -= dt;
  if (active.remaining <= 0) takeDefault(s);
}

export function takeDefault(s: GameState): boolean {
  const active = s.activeChoice;
  const def = active ? choiceById(active.id) : undefined;
  if (!active || !def || !def.timer) return false;
  const fallback = defaultIndex(def);
  if (!resolveChoice(s, fallback)) {
    s.activeChoice = null;
    noteAnswered(s, def.id);
  }
  return true;
}

export function defaultIndex(def: ChoiceDef): number {
  return def.defaultOption ?? def.options.length - 1;
}

export function optionLine(s: GameState, opt: ChoiceOption): string {
  const ctx = s.activeChoice?.context ?? {};
  return (typeof opt.line === 'function' ? opt.line(s, ctx) : opt.line) ?? '';
}

export function optionNeeds(s: GameState, opt: ChoiceOption): string {
  const cost = optionCost(s, opt);
  if (cost && !canPay(s, cost)) return `needs ${costLabel(cost)}`;
  const needs = typeof opt.needs === 'function' ? opt.needs(s, s.activeChoice?.context ?? {}) : opt.needs;
  return needs || 'not available';
}

export function noveltyKeys(s: GameState): string[] {
  const keys: string[] = [];
  for (const [id, on] of Object.entries(s.revealed)) if (on) keys.push(`rev:${id}`);
  for (const [id, st] of Object.entries(s.projects)) if (st.shown || st.bought) keys.push(`shown:${id}`);
  for (const p of visibleProjects(s)) if (p.canAfford(s)) keys.push(`aff:${p.id}:${s.projects[p.id]?.bought ?? 0}`);
  if (s.stage < 2 && s.revealed['compute'] && s.funds >= gpuCost(s)) keys.push(`aff:gpu:${s.gpus}`);
  if (s.revealed['marketing'] && s.funds >= marketingCost(s)) keys.push(`aff:marketing:${s.marketingBought ?? 0}`);
  if (s.revealed['research'] && s.revealed['hireResearcher'] && s.trust >= 1) {
    keys.push(`aff:trust:${s.researchers + s.labSpace}`);
  }
  if (canStartTraining(s)) keys.push(`aff:train:${s.flags['prologue'] === true ? 'prologue' : s.training.runIndex}`);
  const run = s.training.run;
  if (run) {
    keys.push(`phase:${run.id}:${run.phase}`);
    if (canRedTeam(s)) keys.push(`aff:redteam:${run.id}:${run.issues}`);
  }
  if (s.revealed['infrastructure']) {
    if (s.funds >= datacenterCost(s)) keys.push(`aff:datacenter:${s.datacenters}`);
    if (s.funds >= gpuBatchCost(s) && canBuyGpuBatch(s)) keys.push(`aff:gpubatch:${s.gpuBatches}`);
    if (canUpgradeSecurity(s) && s.funds >= securityCost(s)) keys.push(`aff:security:${s.security}`);
  }
  if (canExpandGrid(s) && s.funds >= gridUpgradeCost(s)) keys.push(`aff:grid:${s.gridCapacity}`);
  if (s.activeChoice) keys.push(`choice:${s.activeChoice.id}`);
  return keys;
}

export function isRescueKey(key: string): boolean {
  return key.includes('p_press') || key.includes('p_beg_power') || key.includes('c_customer_email');
}

export const MAX_PRESS_PER_STAGE = 3;
export const MAX_EMAILS_PER_STAGE = 3;

export function idleGuard(s: GameState, dt: number): void {
  const keys = noveltyKeys(s);
  const prev = new Set(s.idle.affordable);
  const novel = keys.some((k) => !prev.has(k));
  s.idle.affordable = keys;
  if (novel) {
    s.idle.quiet = 0;
    s.idle.lastNoveltyAt = s.stats.timePlayed;
    return;
  }
  if (s.tasks <= 0 || !s.revealed['business'] || s.activeChoice || s.training.run) return;
  s.idle.quiet += dt;
  if (s.idle.quiet < 60) return;
  s.idle.quiet = 0;
  if (diagnoseStall(s)) return;
  const presses = (s.flags['pressReleases'] as number) || 0;
  const emails = (s.flags['emailsThisStage'] as number) || 0;
  const raw = customerEmailAmount(s);
  const amount = raw < Math.max(0.25 * s.funds, 30 * s.stats.revPerSec) ? 0 : raw;
  if (s.insightUnlocked && s.insight >= pressCost(s) && !s.flags['idlePress'] && presses < MAX_PRESS_PER_STAGE) {
    s.flags['idlePress'] = true;
    s.flags['pressReleases'] = presses + 1;
  } else if (amount > 0 && emails < MAX_EMAILS_PER_STAGE && !s.choiceQueue.some((c) => c.id === 'c_customer_email')) {
    s.flags['emailsThisStage'] = emails + 1;
    openChoice(s, 'c_customer_email', { amount });
  } else {
    return;
  }
  s.stats.idleRescues += 1;
}

function diagnoseStall(s: GameState): boolean {
  if (!s.revealed['research']) return false;
  const now = s.stats.timePlayed;
  const ready = (k: string) => now - ((s.flags[k] as number) ?? -999) >= 180;
  const cap = researchCap(s);
  const rate = researchRate(s);
  if (s.research < cap && s.revealed['hireResearcher'] && s.labSpace >= 3 * s.researchers && (cap - s.research) / Math.max(1, rate) > 300) {
    if (!ready('roomsSaidAt')) return false;
    s.flags['roomsSaidAt'] = now;
    const people = s.researchers === 1 ? 'One researcher' : `${WORDS_UP[s.researchers] ?? s.researchers} researchers`;
    say(s, `${people} cannot fill ${s.labSpace} rooms. Hire a researcher with the next Trust.`);
    return true;
  }
  return false;
}

const WORDS_UP = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function unaffordableFundsCosts(s: GameState): number[] {
  const out: number[] = [];
  const add = (cost: number | undefined) => {
    if (cost && cost > s.funds) out.push(cost);
  };
  if (s.revealed['buyPower'] && !s.gridAuto) add(powerBlockCost(s));
  if (canExpandGrid(s)) add(gridUpgradeCost(s));
  if (s.stage < 2 && s.revealed['compute']) add(gpuCost(s));
  if (s.stage >= 2 && s.revealed['infrastructure']) {
    add(datacenterCost(s));
    if (canBuyGpuBatch(s)) add(gpuBatchCost(s));
  }
  if (s.revealed['marketing']) add(marketingCost(s));
  if (s.revealed['training'] && !s.training.run) add(trainCost(s).funds);
  if (s.revealed['projects']) for (const p of visibleProjects(s)) add(p.cost(s).funds);
  return out;
}

export function customerEmailAmount(s: GameState): number {
  const costs = unaffordableFundsCosts(s);
  if (costs.length === 0) return 0;
  const gap = Math.min(...costs) - s.funds;
  if (gap > Math.max(50, 120 * s.stats.revPerSec)) return 0;
  const raw = Math.max(25, gap);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
  return Math.ceil(raw / unit) * unit;
}

export interface FireableEvent {
  id: string;
  label: string;
}

export function fireableEvents(): FireableEvent[] {
  return [
    ...DEVELOPMENTS.map((d) => ({ id: d.id, label: `dev: ${d.id}` })),
    ...INCIDENTS.map((c) => ({ id: c.id, label: `incident: ${c.title}` })),
    ...CRISES.map((c) => ({ id: c.id, label: `crisis: ${c.title}` })),
    ...CHOICES.map((c) => ({ id: c.id, label: `choice: ${c.title}` })),
    { id: 'rival_release', label: 'rival: Anthrosoft release' },
  ];
}

export function fireEvent(s: GameState, id: string): boolean {
  if (id === 'rival_release') {
    rivalRelease(s);
    return true;
  }
  if (developmentById(id)) return fireDevelopment(s, id);
  if (crisisById(id)) return fireCrisis(s, id);
  const choice = choiceById(id);
  if (choice) {
    const run = s.training.run;
    return openChoice(s, id, { runId: run ? run.id : 0, amount: customerEmailAmount(s) || 25, issues: run?.issues ?? 1 }, { force: true });
  }
  return false;
}
