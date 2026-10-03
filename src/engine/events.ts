import { GameState, ActiveChoice, say, logNews, canPay, pay } from './state.js';
import { DEVELOPMENTS, DevelopmentDef } from '../data/developments.js';
import { CHOICES, ChoiceDef } from '../data/choices.js';
import { crisisById, CRISES, INCIDENTS } from '../data/crises.js';
import { RIVAL_LINES } from '../data/flavor.js';
import { visibleProjects } from './projects.js';
import { gpuCost, marketingCost, qualityMult, datacenterCost, gpuBatchCost, turbineCost, gpuCapacity, GPU_BATCH } from './economy.js';
import { canStartTraining, canRedTeam } from './training.js';
import { dateLabel } from './format.js';
import { rand, pick } from './rng.js';

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

/** Upcoming developments for the dev overlay's "Show hidden". */
export function pendingDevelopments(s: GameState): DevelopmentDef[] {
  return DEVELOPMENTS.filter((d) => !s.developments[d.id] && d.stage <= s.stage + 1);
}

// ---------- crises & incidents ----------

export function fireCrisis(s: GameState, id: string): boolean {
  const c = crisisById(id);
  if (!c) return false;
  if (c.duration > 0) s.effects.push({ id: c.id, remaining: c.duration, demandMult: c.demandMult });
  c.effect(s);
  say(s, c.console);
  logNews(s, c.log);
  if (INCIDENTS.includes(c)) s.stats.incidents += 1;
  else s.stats.crises += 1;
  return true;
}

export function updateScheduled(s: GameState, dt: number): void {
  if (s.scheduled.length === 0) return;
  const due: string[] = [];
  for (const e of s.scheduled) {
    e.delay -= dt;
    if (e.delay <= 0) due.push(e.id);
  }
  s.scheduled = s.scheduled.filter((e) => e.delay > 0);
  for (const id of due) fireCrisis(s, id);
}

// ---------- rival releases ----------

/** Every 4–7 minutes Anthrosoft ships; `qualityMult = (capability / rivalCapability)^0.5`. Slow tick. */
export function updateRival(s: GameState): void {
  if (s.stage > 2) return;
  s.nextRivalIn -= 1;
  if (s.nextRivalIn > 0) return;
  rivalRelease(s);
}

export function rivalRelease(s: GameState): void {
  s.rivalVersion += 1;
  s.rivalCapability *= rand(s, 1.12, 1.28);
  s.nextRivalIn = Math.round(rand(s, 240, 420));
  const name = `Cadence-${s.rivalVersion}`;
  logNews(s, pick(s, RIVAL_LINES).replace('{name}', name));
  const q = qualityMult(s);
  if (q < 1) say(s, `Anthrosoft ${name} beats ${s.training.deployedName}. Demand down ${Math.round((1 - q) * 100)}%.`);
  else say(s, `Anthrosoft ships ${name}. ${s.training.deployedName} is still ahead.`);
}

// ---------- choices ----------

export function openChoice(s: GameState, id: string, context: Record<string, number | string>): boolean {
  const def = choiceById(id);
  if (!def) return false;
  const entry: ActiveChoice = { id, remaining: def.timer ?? 0, context };
  if (s.activeChoice) s.choiceQueue.push(entry);
  else s.activeChoice = entry;
  return true;
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
    s.activeChoice = s.choiceQueue.shift() ?? null;
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
  if (!s.activeChoice) s.activeChoice = s.choiceQueue.shift() ?? null;
  return true;
}

/** Timed choices pick their default when the timer runs out. The game never pauses. */
export function updateChoice(s: GameState, dt: number): void {
  const active = s.activeChoice;
  if (!active) return;
  const def = choiceById(active.id);
  if (!def) {
    s.activeChoice = s.choiceQueue.shift() ?? null;
    return;
  }
  if (!def.timer) return;
  active.remaining -= dt;
  if (active.remaining <= 0) {
    const fallback = def.defaultOption ?? def.options.length - 1;
    if (!resolveChoice(s, fallback)) s.activeChoice = s.choiceQueue.shift() ?? null;
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

/**
 * Anti-soft-lock valve (design.md §8). Every tick. After 60 s with nothing newly affordable or
 * newly revealed, surface `Press release (5 insight)` or a `Customer email` that pays funds.
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
  s.idle.quiet += dt;
  if (s.idle.quiet < 60 || s.activeChoice) return;
  s.idle.quiet = 0;
  s.stats.idleRescues += 1;
  if (s.insightUnlocked && s.insight >= 5 && !s.flags['idlePress']) {
    s.flags['idlePress'] = true;
  } else {
    openChoice(s, 'c_customer_email', { amount: customerEmailAmount(s) });
  }
}

export function customerEmailAmount(s: GameState): number {
  return Math.max(25, Math.round(45 * s.stats.revPerSec));
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
    return openChoice(s, id, { runId: run ? run.id : 0, amount: customerEmailAmount(s) });
  }
  return false;
}
