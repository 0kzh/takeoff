import { GameState, ActiveChoice, say, logNews, canPay, pay } from './state.js';
import { DEVELOPMENTS, DevelopmentDef } from '../data/developments.js';
import { CHOICES, ChoiceDef } from '../data/choices.js';
import { crisisById, CRISES, INCIDENTS } from '../data/crises.js';
import { RIVAL_LINES } from '../data/flavor.js';
import { visibleProjects } from './projects.js';
import {
  gpuCost, marketingCost, qualityMult, datacenterCost, gpuBatchCost, turbineCost, gpuCapacity, powerBlockCost, GPU_BATCH,
} from './economy.js';
import { canStartTraining, canRedTeam, trainCost } from './training.js';
import { dateLabel } from './format.js';
import { stageDef } from './stages.js';
import { rand, pick, chance } from './rng.js';

export function developmentById(id: string): DevelopmentDef | undefined {
  return DEVELOPMENTS.find((d) => d.id === id);
}

export function choiceById(id: string): ChoiceDef | undefined {
  return CHOICES.find((c) => c.id === id);
}

// ---------- developments (world timeline) ----------

/** Developments fire on their date or on their condition, whichever comes first. */
export function updateDevelopments(s: GameState): void {
  for (const d of DEVELOPMENTS) {
    if (s.developments[d.id] || d.stage > s.stage) continue;
    const byDate = d.month !== undefined && s.date >= d.month;
    const byProgress = d.trigger ? d.trigger(s) : false;
    if (byDate || byProgress) fireDevelopment(s, d.id);
  }
}

export function fireDevelopment(s: GameState, id: string): boolean {
  const d = developmentById(id);
  if (!d) return false;
  s.developments[id] = true;
  if (d.crisis) fireCrisis(s, d.crisis);
  if (d.text) logNews(s, d.text);
  if (d.console) say(s, d.console);
  d.effect?.(s);
  if (d.choice) openChoice(s, d.choice, {});
  return true;
}

/** Seconds until the next dated development that opens a modal (Infinity when none is left). */
export function secondsToNextCalendarModal(s: GameState): number {
  let next = Infinity;
  for (const d of DEVELOPMENTS) {
    if (!d.choice || d.month === undefined || d.stage !== s.stage || s.developments[d.id]) continue;
    next = Math.min(next, Math.max(0, d.month - s.date) * stageDef(s.stage).secondsPerMonth);
  }
  return next;
}

/** Upcoming developments for the dev overlay's "Show hidden". */
export function pendingDevelopments(s: GameState): DevelopmentDef[] {
  return DEVELOPMENTS.filter((d) => !s.developments[d.id] && d.stage <= s.stage + 1);
}

// ---------- crises & incidents ----------

/** `source` names the release an incident is traced to (a release that shipped open issues). */
export function fireCrisis(s: GameState, id: string, source?: string): boolean {
  const c = crisisById(id);
  if (!c) return false;
  if (c.duration > 0) s.effects.push({ id: c.id, remaining: c.duration, demandMult: c.demandMult });
  c.effect(s);
  say(s, c.console);
  if (source) say(s, `Traced to an issue shipped in ${source}.`);
  logNews(s, source ? `${c.log} It traces back to ${source}.` : c.log);
  if (INCIDENTS.includes(c)) s.stats.incidents += 1;
  else s.stats.crises += 1;
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

// ---------- rival releases ----------

/** Every 4–7 minutes Anthrosoft ships; `qualityMult = (capability / rivalCapability)^0.5`. Slow tick. */
export function updateRival(s: GameState): void {
  if (s.stage > 2) return;
  s.nextRivalIn -= 1;
  if (s.nextRivalIn > 0) return;
  rivalRelease(s);
}

/** Anthrosoft stays within 0.85–1.15× of the deployed model: usually a step behind, sometimes ahead. */
export const RIVAL_BAND: [number, number] = [0.85, 1.15];

export function rivalRelease(s: GameState): void {
  s.rivalVersion += 1;
  const ours = s.capability;
  // A third of releases leapfrog the deployed model; the rest are an increment on the last one.
  const target = chance(s, 0.35) ? ours * rand(s, 1.02, 1.12) : s.rivalCapability * rand(s, 1.03, 1.1);
  const next = Math.min(RIVAL_BAND[1] * ours, Math.max(RIVAL_BAND[0] * ours, target));
  s.rivalCapability = Math.max(s.rivalCapability, next);
  s.nextRivalIn = Math.round(rand(s, 240, 420));
  const name = `Cadence-${s.rivalVersion}`;
  logNews(s, pick(s, RIVAL_LINES).replace('{name}', name));
  const q = qualityMult(s);
  if (q < 0.995) say(s, `Anthrosoft's ${name} beats ${s.training.deployedName}. Demand ${q < 0.9 ? 'falls' : 'dips'}.`);
  else say(s, `Anthrosoft ships ${name}. ${s.training.deployedName} is still ahead.`);
}

// ---------- choices ----------

/** Seconds between two modals opening on their own; a modal the player's click caused is exempt. */
export const MODAL_SPACING = 150;
/** Modals that answer the player's own click (a confirm), so they open at once. */
export const PLAYER_MODALS = ['c_ship_issues', 'c_sage2'];

export interface OpenOptions {
  /** Open only if it can open right now; otherwise do nothing (a passing offer, like the gamble). */
  onlyIfFree?: boolean;
  /** Ignore the spacing (the dev overlay's "Fire event"). */
  force?: boolean;
}

function modalFree(s: GameState): boolean {
  return !s.activeChoice && s.stats.timePlayed - s.cadence.lastModalAt >= MODAL_SPACING;
}

function present(s: GameState, entry: ActiveChoice): void {
  s.activeChoice = entry;
  s.cadence.lastModalAt = s.stats.timePlayed;
}

/**
 * Modals open one at a time and, unless the player's click caused them, at least MODAL_SPACING
 * apart: the rest wait in `choiceQueue` (in order) and `drainChoiceQueue` opens them when allowed.
 */
export function openChoice(s: GameState, id: string, context: Record<string, number | string>, opts: OpenOptions = {}): boolean {
  const def = choiceById(id);
  if (!def) return false;
  const entry: ActiveChoice = { id, remaining: def.timer ?? 0, context };
  if (PLAYER_MODALS.includes(id) || opts.force) {
    if (s.activeChoice) s.choiceQueue.unshift(s.activeChoice);
    present(s, entry);
    return true;
  }
  if (modalFree(s) && s.choiceQueue.length === 0) {
    present(s, entry);
    return true;
  }
  if (opts.onlyIfFree) return false;
  s.choiceQueue.push(entry);
  return true;
}

/** Every tick: open the next queued modal when the spacing allows; drop ones that no longer apply. */
export function drainChoiceQueue(s: GameState): void {
  while (s.choiceQueue.length && !s.activeChoice) {
    const next = s.choiceQueue[0]!;
    const def = choiceById(next.id);
    if (!def || (def.valid && !def.valid(s, next.context))) {
      s.choiceQueue.shift();
      continue;
    }
    if (!PLAYER_MODALS.includes(next.id) && s.stats.timePlayed - s.cadence.lastModalAt < MODAL_SPACING) return;
    s.choiceQueue.shift();
    present(s, next);
  }
}

export function choiceOptionEnabled(s: GameState, def: ChoiceDef, index: number): boolean {
  const opt = def.options[index];
  if (!opt || !s.activeChoice) return false;
  if (opt.cost && !canPay(s, opt.cost)) return false;
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
  if (opt.cost) pay(s, opt.cost);
  s.activeChoice = null;
  opt.effect(s, active.context);
  s.choicesMade.push({ id: def.id, option: opt.record, date: dateLabel(s.date) });
  s.stats.choices += 1;
  if (opt.log) logNews(s, typeof opt.log === 'function' ? opt.log(s, active.context) : opt.log, 'choice');
  return true;
}

/** Timed choices pick their default when the timer runs out. The game never pauses. */
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
  if (active.remaining <= 0) {
    const fallback = def.defaultOption ?? def.options.length - 1;
    if (!resolveChoice(s, fallback)) s.activeChoice = null;
  }
}

// ---------- idle guard ----------

/**
 * Everything the player could newly act on or newly see: affordable verbs, revealed panels,
 * shown projects, an open choice, the training phase. A key that was absent at the last check
 * counts as novelty.
 */
export function noveltyKeys(s: GameState): string[] {
  const keys: string[] = [];
  for (const [id, on] of Object.entries(s.revealed)) if (on) keys.push(`rev:${id}`);
  for (const [id, st] of Object.entries(s.projects)) if (st.shown || st.bought) keys.push(`shown:${id}`);
  for (const p of visibleProjects(s)) if (p.canAfford(s)) keys.push(`aff:${p.id}:${s.projects[p.id]?.bought ?? 0}`);
  // Counted verbs carry their count, so "the next GPU became affordable" is new each time.
  if (s.stage < 2 && s.revealed['compute'] && s.funds >= gpuCost(s)) keys.push(`aff:gpu:${s.gpus}`);
  if (s.revealed['marketing'] && s.funds >= marketingCost(s)) keys.push(`aff:marketing:${s.hypeLevel}`);
  if (s.revealed['research'] && s.revealed['hireResearcher'] && s.trust >= 1) {
    keys.push(`aff:trust:${s.researchers + s.labSpace}`);
  }
  if (canStartTraining(s)) keys.push(`aff:train:${s.training.runIndex}`);
  const run = s.training.run;
  if (run) {
    keys.push(`phase:${run.id}:${run.phase}`);
    if (canRedTeam(s)) keys.push(`aff:redteam:${run.id}:${run.issues}`);
  }
  if (s.revealed['infrastructure']) {
    if (s.funds >= datacenterCost(s)) keys.push(`aff:datacenter:${s.datacenters}`);
    if (s.funds >= gpuBatchCost(s) && s.gpus + GPU_BATCH <= gpuCapacity(s)) keys.push(`aff:gpubatch:${s.gpuBatches}`);
    if (s.funds >= turbineCost(s)) keys.push(`aff:turbine:${s.turbines}`);
  }
  if (s.activeChoice) keys.push(`choice:${s.activeChoice.id}`);
  return keys;
}

/** Keys created by the guard itself; the sim ignores them when it measures idle gaps. */
export function isRescueKey(key: string): boolean {
  return key.includes('p_press') || key.includes('p_beg_power') || key.includes('c_customer_email');
}

/** A visible timer is a named wait, not a stall: a run training or under evaluation, the interconnect queue. */
function namedWait(s: GameState): boolean {
  const phase = s.training.run?.phase;
  return phase === 'training' || phase === 'evaluating' || s.interconnectLeft > 0;
}

/**
 * Anti-soft-lock valve (design.md §8). Every tick. After 60 s with nothing newly affordable or
 * newly revealed, surface `Press release (5 insight)` or a `Customer email` that pays funds. It
 * only watches a player who has started (a task done, the Business panel up), and the clock stops
 * while a choice is open or a named wait is counting down.
 */
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
  if (s.tasks <= 0 || !s.revealed['business'] || s.activeChoice || namedWait(s)) return;
  s.idle.quiet += dt;
  if (s.idle.quiet < 60) return;
  s.idle.quiet = 0;
  if (s.insightUnlocked && s.insight >= 5 && !s.flags['idlePress']) {
    s.flags['idlePress'] = true;
  } else if (!s.choiceQueue.some((c) => c.id === 'c_customer_email')) {
    openChoice(s, 'c_customer_email', { amount: customerEmailAmount(s) });
  } else {
    return;
  }
  s.stats.idleRescues += 1;
}

/** Funds prices of things on screen the player cannot afford yet. */
function unaffordableFundsCosts(s: GameState): number[] {
  const out: number[] = [];
  const add = (cost: number | undefined) => {
    if (cost && cost > s.funds) out.push(cost);
  };
  if (s.stage < 2) {
    if (s.revealed['buyPower']) add(powerBlockCost(s));
    if (s.revealed['compute']) add(gpuCost(s));
  }
  if (s.revealed['marketing']) add(marketingCost(s));
  if (s.revealed['training'] && !s.training.run) add(trainCost(s).funds);
  if (s.revealed['projects']) for (const p of visibleProjects(s)) add(p.cost(s).funds);
  if (s.revealed['infrastructure']) {
    add(datacenterCost(s));
    add(gpuBatchCost(s));
    add(turbineCost(s));
  }
  return out;
}

/** `min(max($25, 10 × revenue/s), 10 % of the cheapest thing on screen the player can't afford)`. */
export function customerEmailAmount(s: GameState): number {
  const base = Math.max(25, Math.round(10 * s.stats.revPerSec));
  const costs = unaffordableFundsCosts(s);
  if (costs.length === 0) return base;
  return Math.max(1, Math.min(base, Math.round(0.1 * Math.min(...costs))));
}

// ---------- dev: fire anything by id ----------

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
    return openChoice(s, id, { runId: run ? run.id : 0, amount: customerEmailAmount(s), issues: run?.issues ?? 1 }, { force: true });
  }
  return false;
}
