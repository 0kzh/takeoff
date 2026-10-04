import { GameState, ActiveChoice, Cost, say, logNews, canPay, pay, bump } from './state.js';
import { DEVELOPMENTS, DevelopmentDef } from '../data/developments.js';
import { CHOICES, ChoiceDef, ChoiceOption } from '../data/choices.js';
import { crisisById, CRISES, INCIDENTS } from '../data/crises.js';
import { RIVAL_LINES } from '../data/flavor.js';
import { visibleProjects, costLabel } from './projects.js';
import { gpuCost, marketingCost, qualityMult, powerBlockCost, CONTRACT_PAUSE_SECONDS, researchCap, researchRate, rentQuota } from './economy.js';
import {
  datacenterCost, lotCost, lotSize, gasCost, solarCost, nuclearCost, solarQueueFull, standingOrderOn,
  lotSizes, lotFits, lotCostOf, datacenterReason, plantReason,
} from './infrastructure.js';
import { canStartTraining, canRedTeam, canRelease, trainCost, trainingRun, delayNote } from './training.js';
import { rivalReleaseS2, recordRival, noteIncident, sl3Cost } from './world.js';
import { dateLabel } from './format.js';
import { stageDef, mechanic, mechanicClear } from './stages.js';
import { BEAT_GAP_SECONDS } from './reveal.js';
import { rand, pick, chance } from './rng.js';

export function developmentById(id: string): DevelopmentDef | undefined {
  return DEVELOPMENTS.find((d) => d.id === id);
}

export function choiceById(id: string): ChoiceDef | undefined {
  return CHOICES.find((c) => c.id === id);
}

// ---------- developments (world timeline) ----------

/**
 * Developments fire on their date or on their condition, whichever comes first, and only in their
 * own stage: an earlier stage's unfired entries are dropped at the transition (arc §7).
 */
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

/** Stage 1's first event waits this long after the first release; each later one this long after the last was answered. */
export const EVENT_AFTER_RELEASE = 60;
export const EVENT_SPACING = 156;

/** The choices Stage 1's calendar opens (their answers start the next event's 2:36); built on first use. */
let calendarChoices: Set<string> | null = null;
function isCalendarChoice(id: string): boolean {
  calendarChoices ??= new Set(DEVELOPMENTS.filter((d) => d.calendar && d.choice).map((d) => d.choice!));
  return calendarChoices.has(id);
}

/** When the next calendar event may open (Infinity before the first release, or with none left). */
function calendarSlotAt(s: GameState): number {
  if (s.stage !== 1 || !DEVELOPMENTS.some((d) => d.calendar && d.stage === 1 && !s.developments[d.id])) return Infinity;
  const first = s.flags['firstReleaseAt'];
  if (typeof first !== 'number') return Infinity;
  const answered = s.flags['eventAnsweredAt'];
  return Math.max(first + EVENT_AFTER_RELEASE, typeof answered === 'number' ? answered + EVENT_SPACING : 0);
}

/**
 * Stage 1's calendar is a queue (stage1-round3-fixes.md §4): events wait for the player. The first opens
 * a minute after the first release, each later one 2:36 after the last was answered, never while a run
 * waits for its evaluation, Red-team or Release; in table order, an event whose condition fails giving
 * its slot to the next one and coming back.
 */
function updateCalendar(s: GameState): void {
  if (s.stage !== 1 || s.stats.timePlayed < calendarSlotAt(s)) return;
  const run = s.training.run;
  if (run && run.phase !== 'training') return;
  // Not within 30 s of another first-time mechanic (the Focus row, the quota line).
  if (!modalCanOpen(s) || !mechanicClear(s)) return;
  const next = DEVELOPMENTS.find((d) => d.calendar && d.stage === 1 && !s.developments[d.id] && (!d.requires || d.requires(s)));
  if (!next) return;
  mechanic(s);
  s.flags['calendarOpened'] = true;
  fireDevelopment(s, next.id);
}

/** A calendar event was answered (or ran out): the next one is 2:36 away. */
function noteAnswered(s: GameState, choiceId: string): void {
  if (s.stage === 1 && isCalendarChoice(choiceId)) s.flags['eventAnsweredAt'] = s.stats.timePlayed;
}

export function fireDevelopment(s: GameState, id: string): boolean {
  const d = developmentById(id);
  if (!d) return false;
  s.developments[id] = true;
  // A development that also opens a choice lets the panel land first: the crisis line follows 4 s later.
  if (d.crisis && d.choice) s.scheduled.push({ id: d.crisis, delay: 4 });
  else if (d.crisis) fireCrisis(s, d.crisis);
  const text = typeof d.text === 'function' ? d.text(s) : d.text;
  if (text) logNews(s, text);
  if (d.console) say(s, d.console);
  d.effect?.(s);
  if (d.choice) openChoice(s, d.choice, {});
  return true;
}

/** Fires a development unless it already has (Stage 3: a project and a date can both name one). */
export function fireDevelopmentOnce(s: GameState, id: string): boolean {
  if (s.developments[id]) return false;
  return fireDevelopment(s, id);
}

/** Seconds until the next dated development that opens a modal (Infinity when none is left). */
export function secondsToNextCalendarModal(s: GameState): number {
  // Stage 1's calendar is a queue: its next slot.
  if (s.stage === 1) return Math.max(0, calendarSlotAt(s) - s.stats.timePlayed);
  let next = Infinity;
  for (const d of DEVELOPMENTS) {
    if (!d.choice || d.month === undefined || d.stage !== s.stage || s.developments[d.id]) continue;
    next = Math.min(next, Math.max(0, d.month - s.date) * stageDef(s.stage).secondsPerMonth);
  }
  return next;
}

/** Upcoming developments for the dev overlay's "Show hidden". */
export function pendingDevelopments(s: GameState): DevelopmentDef[] {
  return DEVELOPMENTS.filter((d) => !s.developments[d.id] && d.stage >= s.stage && d.stage <= s.stage + 1);
}

// ---------- crises & incidents ----------

/** `source` names the release an incident is traced to (a release that shipped open issues). */
export function fireCrisis(s: GameState, id: string, source?: string): boolean {
  const c = crisisById(id);
  if (!c) return false;
  if (c.duration > 0) {
    s.effects.push({
      id: c.id,
      remaining: c.duration,
      demandMult: c.demandMult,
      ...(c.powerMult !== undefined ? { powerMult: c.powerMult } : {}),
      ...(c.researchMult !== undefined ? { researchMult: c.researchMult } : {}),
    });
  }
  c.effect(s);
  // Stage 3 counts each crisis by id (the sim's CRISIS lines and the end screen read it).
  if (s.stage >= 3) bump(s, `crisis:${id}`);
  const line = typeof c.console === 'function' ? c.console(s, source) : c.console;
  if (line) say(s, line);
  const incident = INCIDENTS.includes(c);
  if (source && incident) say(s, `Traced to an issue shipped in ${source}.`);
  const log = typeof c.log === 'function' ? c.log(s, source) : c.log;
  if (log) logNews(s, source && incident ? `${log} It traces back to ${source}.` : log);
  if (incident) {
    s.stats.incidents += 1;
    // Stage 1: the contract customers stop buying for a minute (critic round 2 §5: a shipped issue
    // costs the income that matters).
    // Stage 1: the board loses a little confidence with every incident.
    if (s.stage === 1) {
      s.trust -= 1;
      say(s, 'The board asks what happened. Trust −1.');
    }
    if (s.stage === 1 && (s.projects['p_contract']?.bought ?? 0) > 0) {
      // Pauses queue up: a second incident during a pause adds its own 1:30.
      const until = typeof s.flags['contractsPausedUntil'] === 'number' ? (s.flags['contractsPausedUntil'] as number) : 0;
      s.flags['contractsPausedUntil'] = Math.max(until, s.stats.timePlayed) + CONTRACT_PAUSE_SECONDS;
      say(s, 'The bank pauses its pilot. Contract customers stop buying for 1:30.');
    }
    if (s.stage >= 2) {
      // Each incident: measured alignment −2, and approval remembers it for five minutes.
      s.alignmentApparent = Math.max(0, s.alignmentApparent - 2);
      noteIncident(s);
      bump(s, 'incidentsS2');
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

// ---------- rival releases ----------

/** Every 4–7 minutes Anthrosoft ships. Slow tick. */
export function updateRival(s: GameState): void {
  if (s.stage > 2) return;
  s.nextRivalIn -= 1;
  if (s.nextRivalIn > 0) return;
  if (s.stage === 2) {
    rivalReleaseS2(s);
    s.flags['rivalS2'] = true;
    return;
  }
  rivalRelease(s);
}

/** Anthrosoft stays within 0.85–1.15× of the deployed model: usually a step behind, sometimes ahead. */
export const RIVAL_BAND: [number, number] = [0.85, 1.15];

export function rivalRelease(s: GameState): void {
  if (s.stage >= 2) {
    rivalReleaseS2(s);
    s.flags['rivalS2'] = true;
    return;
  }
  s.rivalVersion += 1;
  const ours = s.capability;
  // A third of releases leapfrog the deployed model; the rest are an increment on the last one.
  const target = chance(s, 0.35) ? ours * rand(s, 1.02, 1.12) : s.rivalCapability * rand(s, 1.03, 1.1);
  const next = Math.min(RIVAL_BAND[1] * ours, Math.max(RIVAL_BAND[0] * ours, target));
  s.rivalCapability = Math.max(s.rivalCapability, next);
  s.nextRivalIn = Math.round(rand(s, 240, 420));
  const name = `Cadence-${s.rivalVersion}`;
  recordRival(s, name);
  logNews(s, pick(s, RIVAL_LINES).replace('{name}', name));
  // Anthrosoft is named on the Training panel; before it, a release is news, not a console line
  // (critic round 3 §10.9: `Cadence-2 beats Sage-1. Demand dips.` on a screen with one button).
  if (!s.revealed['training']) return;
  const q = qualityMult(s);
  if (q < 0.995) say(s, `Anthrosoft's ${name} beats ${s.training.deployedName}. Demand ${q < 0.9 ? 'falls' : 'dips'}.`);
  else say(s, `Anthrosoft ships ${name}. ${s.training.deployedName} is still ahead.`);
}

// ---------- choices ----------

/** Seconds between two modals opening on their own; a modal the player's click caused is exempt. */
export const MODAL_SPACING = 150;
/** Modals that answer the player's own click (a confirm), so they open at once. */
export const PLAYER_MODALS = ['c_ship_issues', 'c_sage2', 'c_vote', 'c_treaty', 'c_halt'];

export interface OpenOptions {
  /** Open only if it can open right now; otherwise do nothing (a passing offer, like the gamble). */
  onlyIfFree?: boolean;
  /** Ignore the spacing (the dev overlay's "Fire event"). */
  force?: boolean;
}

function modalFree(s: GameState): boolean {
  return !s.activeChoice && s.stats.timePlayed - s.cadence.lastModalAt >= MODAL_SPACING;
}

/** Nothing new appeared in the last few seconds: an unprompted modal is a beat of its own. */
function beatClear(s: GameState): boolean {
  return s.stats.timePlayed - s.cadence.lastRevealAt >= BEAT_GAP_SECONDS;
}

/** An unprompted modal would open right now (nothing open, nothing waiting, the spacing respected). */
export function modalCanOpen(s: GameState): boolean {
  return modalFree(s) && s.choiceQueue.length === 0 && beatClear(s);
}

function present(s: GameState, entry: ActiveChoice): void {
  s.activeChoice = entry;
  s.cadence.lastModalAt = s.stats.timePlayed;
  choiceById(entry.id)?.onOpen?.(s, entry.context);
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
  // A passing offer (`onlyIfFree`) takes its moment or lapses; the rest wait out a fresh reveal.
  if (modalFree(s) && s.choiceQueue.length === 0 && (beatClear(s) || opts.onlyIfFree)) {
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
    if (!PLAYER_MODALS.includes(next.id) && (s.stats.timePlayed - s.cadence.lastModalAt < MODAL_SPACING || !beatClear(s))) return;
    s.choiceQueue.shift();
    present(s, next);
  }
}

/** An option's price now (some scale with the stage, or change after a delay). */
export function optionCost(s: GameState, opt: ChoiceOption): Cost | undefined {
  return typeof opt.cost === 'function' ? opt.cost(s, s.activeChoice?.context ?? {}) : opt.cost;
}

export function optionTooltip(s: GameState, opt: ChoiceOption): string {
  return (typeof opt.tooltip === 'function' ? opt.tooltip(s, s.activeChoice?.context ?? {}) : opt.tooltip) ?? '';
}

/** An option drawn on the card right now (a single-button card hides the option a grant gave away). */
export function choiceOptionVisible(s: GameState, def: ChoiceDef, index: number): boolean {
  const opt = def.options[index];
  if (!opt) return false;
  return opt.visible ? opt.visible(s, s.activeChoice?.context ?? {}) : true;
}

export function choiceOptionEnabled(s: GameState, def: ChoiceDef, index: number): boolean {
  const opt = def.options[index];
  if (!opt || !s.activeChoice) return false;
  if (!choiceOptionVisible(s, def, index)) return false;
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
  // The record is read before the effect changes what else could have been chosen.
  const record = typeof opt.record === 'function' ? opt.record(s) : opt.record;
  if (cost) pay(s, cost);
  s.activeChoice = null;
  noteAnswered(s, def.id);
  opt.effect(s, active.context);
  s.choicesMade.push({ id: def.id, option: record, date: dateLabel(s.date) });
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
  if (active.remaining <= 0) takeDefault(s);
}

/**
 * What the timer does when it runs out, now (Escape on a timed modal): the default option, or, if
 * the default cannot be paid for, the modal closes with no effect. An untimed modal has no default.
 */
export function takeDefault(s: GameState): boolean {
  const active = s.activeChoice;
  const def = active ? choiceById(active.id) : undefined;
  if (!active || !def || !def.timer) return false;
  const fallback = def.defaultOption ?? def.options.length - 1;
  if (!resolveChoice(s, fallback)) {
    s.activeChoice = null;
    noteAnswered(s, def.id);
  }
  return true;
}

/** Stage 2 on: the option's effect and cost, printed under its label (`+10 T data · $675k`). */
export function optionLine(s: GameState, opt: ChoiceOption): string {
  const ctx = s.activeChoice?.context ?? {};
  const line = (typeof opt.line === 'function' ? opt.line(s, ctx) : opt.line) ?? '';
  // A priced answer prints what it costs the waiting run (arc G34 rule 3).
  const cost = optionCost(s, opt);
  return cost && canPay(s, cost) ? `${line}${delayNote(s, cost)}` : line;
}

/** A greyed option says what it needs: its own words, or the price it cannot pay. */
export function optionNeeds(s: GameState, opt: ChoiceOption): string {
  const own = typeof opt.needs === 'function' ? opt.needs(s, s.activeChoice?.context ?? {}) : opt.needs;
  if (own) return own;
  const cost = optionCost(s, opt);
  return cost && !canPay(s, cost) ? `needs ${costLabel(cost)}` : 'not available';
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
  // Marketing is a Stage 1 verb (from Stage 2 the market cards widen the market).
  if (s.stage < 2 && s.revealed['marketing'] && s.funds >= marketingCost(s)) keys.push(`aff:marketing:${s.marketingBought ?? 0}`);
  if (s.revealed['research'] && s.revealed['hireResearcher'] && s.trust >= 1) {
    keys.push(`aff:trust:${s.researchers + s.labSpace}`);
  }
  if (canStartTraining(s)) keys.push(`aff:train:${s.training.runIndex}`);
  const run = s.training.run;
  if (run) {
    keys.push(`phase:${run.id}:${run.phase}`);
    if (canRedTeam(s)) keys.push(`aff:redteam:${run.id}:${run.issues}`);
  }
  const second = s.training.pending;
  if (second) keys.push(`phase:${second.id}:${second.elapsed >= second.duration ? 'trained' : 'training'}`);
  if (s.stage >= 2 && s.revealed['infrastructure']) {
    if (s.revealed['dcButton'] && s.buildFund >= datacenterCost(s)) keys.push(`aff:datacenter:${s.datacenters}`);
    if (!standingOrderOn(s) && lotSize(s) > 0 && s.buildFund >= lotCost(s)) keys.push(`aff:gpulot:${s.gpus}`);
    if (s.revealed['gasButton'] && s.buildFund >= gasCost(s)) keys.push(`aff:gas:${s.gasPlants}`);
    if (s.revealed['solarButton'] && !solarQueueFull(s) && s.buildFund >= solarCost(s)) keys.push(`aff:solar:${s.solarFarms + s.powerQueue.length}`);
    if (s.revealed['nuclearButton'] && s.buildFund >= nuclearCost(s)) keys.push(`aff:nuclear:${s.reactors}`);
    if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) keys.push('aff:sl3');
    // Hardware arriving is news: the fleet and the power online are keys of their own.
    keys.push(`fleet:${s.gpus}:${s.powerCapacityMW}`);
  }
  if (s.activeChoice) keys.push(`choice:${s.activeChoice.id}`);
  return keys;
}

/**
 * The distinct purchases a player could press right now (arc G24/G25, the critic's "affordable
 * things"): every enabled non-setting control but a modal option; the GPU lot sizes count once.
 */
export function enabledPurchases(s: GameState): string[] {
  const out: string[] = [];
  for (const p of visibleProjects(s)) if (p.canAfford(s)) out.push(p.id);
  if (canStartTraining(s)) out.push('train');
  const run = s.training.run;
  if (run && run.phase === 'redteam' && canRedTeam(s)) out.push('redteam');
  if (run && run.phase === 'redteam' && canRelease(s)) out.push('release');
  if (s.revealed['research'] && s.revealed['hireResearcher'] && s.trust >= 1) out.push('hire');
  if (s.revealed['expandLab'] && s.trust >= 1) out.push('expand');
  if (s.stage < 2) {
    if (s.revealed['compute'] && s.funds >= gpuCost(s) && s.gpus < rentQuota(s)) out.push('gpu');
    if (s.revealed['marketing'] && s.funds >= marketingCost(s)) out.push('marketing');
    if (s.revealed['buyPower'] && s.funds >= powerBlockCost(s)) out.push('power');
    return out;
  }
  if (!s.revealed['infrastructure']) return out;
  if (lotSizes(s).some((n, row) => (row === 0 || s.revealed[row === 1 ? 'lot5' : 'lot25']) && lotFits(s, n) && s.buildFund >= lotCostOf(s, n))) out.push('gpuLot');
  if (s.revealed['dcButton'] && !datacenterReason(s) && s.buildFund >= datacenterCost(s)) out.push('datacenter');
  if (s.revealed['gasButton'] && !plantReason(s, 'gas') && s.buildFund >= gasCost(s)) out.push('gas');
  if (s.revealed['solarButton'] && !plantReason(s, 'solar') && s.buildFund >= solarCost(s)) out.push('solar');
  if (s.revealed['nuclearButton'] && !plantReason(s, 'nuclear') && s.buildFund >= nuclearCost(s)) out.push('nuclear');
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) out.push('sl3');
  return out;
}

/** Keys created by the guard itself; the sim ignores them when it measures idle gaps. */
export function isRescueKey(key: string): boolean {
  return key.includes('p_press') || key.includes('p_beg_power') || key.includes('c_customer_email') || key.includes('p_beg_data');
}

/**
 * A visible timer is a named wait, not a stall: a run training or under evaluation, the
 * interconnect queue (Stage 1's and Stage 2's), a reactor restart, an evaluation month.
 */
function namedWait(s: GameState): boolean {
  const phase = s.training.run?.phase;
  return (
    phase === 'training' ||
    phase === 'evaluating' ||
    // Stage 1: no event opens while a run waits for its Red-team or its Release (§4).
    (s.stage === 1 && phase === 'redteam') ||
    !!trainingRun(s) ||
    s.powerQueue.length > 0 ||
    s.training.cooldown > 0 ||
    s.training.releaseWait > 0
  );
}

/** Most idle rescues of each kind per stage: a press release, a customer's prepayment. */
export const MAX_PRESS_PER_STAGE = 3;
export const MAX_EMAILS_PER_STAGE = 3;

/**
 * Anti-soft-lock valve (design.md §8). Every tick. After 60 s with nothing newly affordable or
 * newly revealed, it first names what is wrong when it can (critic round 2 §6.6: a lab with more
 * rooms than researchers, research pinned under a card it cannot hold); only when money is the
 * wall does it surface `Press release (5 insight)` or a `Customer email` big enough to buy the
 * cheapest thing on screen — at most three of each per stage. It only watches a player who has
 * started, and the clock stops while a choice is open or a named wait is counting down.
 */
export function idleGuard(s: GameState, dt: number): void {
  // Stage 3's build brings its own content and valve; the shell does not send customers' emails.
  if (s.stage >= 3) return;
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
  if (diagnoseStall(s)) return;
  // Stage 2: Stage 1's valve only for a lab with nothing at all to buy, and never for pocket change
  // against the funds on hand (critic C11: a $14,642 prepayment to a lab holding $715,523).
  if (s.stage === 2 && enabledPurchases(s).length > 0) return;
  const presses = (s.flags['pressReleases'] as number) || 0;
  const emails = (s.flags['emailsThisStage'] as number) || 0;
  const raw = customerEmailAmount(s);
  // Never pocket change against the funds on hand (critic C11 in Stage 2; critic round 3 §10.9 in
  // Stage 1: $44 offered to a lab holding $2,376).
  const amount = raw < Math.max(0.25 * s.funds, 30 * s.stats.revPerSec) ? 0 : raw;
  if (s.insightUnlocked && s.insight >= 5 && !s.flags['idlePress'] && presses < MAX_PRESS_PER_STAGE) {
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

/**
 * A stall the console can name (at most once per 3 minutes each): more rooms than the researchers
 * can fill; research pinned under something that costs more than the lab holds. True when it spoke.
 */
function diagnoseStall(s: GameState): boolean {
  if (!s.revealed['research'] || s.stage >= 3) return false;
  const now = s.stats.timePlayed;
  const ready = (k: string) => now - ((s.flags[k] as number) ?? -999) >= 180;
  const cap = researchCap(s);
  const rate = researchRate(s);
  // Expand-only: the lab is far bigger than the people in it.
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
  if (s.stage < 2 && s.revealed['marketing']) add(marketingCost(s));
  if (s.revealed['training'] && (s.stage < 2 ? !s.training.run : !trainingRun(s))) add(trainCost(s).funds);
  if (s.revealed['projects']) for (const p of visibleProjects(s)) add(p.cost(s).funds);
  // Lots, plants and halls are paid from the build fund (arc G34): a prepayment to funds does not buy them.
  return out;
}

/**
 * A prepayment that buys the cheapest thing on screen the player cannot afford (critic round 2
 * §6.6: never a dollar against a $6 GPU). 0 — no email — when money is not what is missing (nothing
 * on screen waits for funds) or the gap is more than two minutes of revenue (the wall is elsewhere).
 */
export function customerEmailAmount(s: GameState): number {
  const costs = unaffordableFundsCosts(s);
  if (costs.length === 0) return 0;
  const gap = Math.min(...costs) - s.funds;
  if (gap > Math.max(50, 120 * s.stats.revPerSec)) return 0;
  const raw = Math.max(25, gap);
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
  return Math.ceil(raw / unit) * unit;
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
    return openChoice(s, id, { runId: run ? run.id : 0, amount: customerEmailAmount(s) || 25, issues: run?.issues ?? 1 }, { force: true });
  }
  return false;
}
