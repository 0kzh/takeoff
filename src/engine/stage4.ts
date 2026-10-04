import { GameState, say, logNews, press, counter, isBought, newStage4, projectState } from './state.js';
import { rng } from './rng.js';
import { fmtInt, fmtNum, fmtClock, fmtMoneyShort, dateLabel, monthOf, fmtShortNum } from './format.js';
import { bestCapability, researchCapacityAt, researchRate } from './economy.js';
import {
  generationCost, nextGenCap, nextGenVersion, genName, verifySeconds, slowBranch, GEN_SECONDS, GEN_BASE_SECONDS, S4_RUNGS,
  researchDiverted,
} from './training.js';
import { updateFleet, fleetWalls, CAR_PLANT_ROBOTS, minedPerSec, fleetAuto } from './fleet.js';
import { updateSociety, ubiTerm, jobsTerm, peopleAlive } from './society.js';
import { updateTreaty, treatyOpening, talksOpen } from './treaty.js';
import { seats } from './world3.js';
import { moveGov } from './world.js';
import { updateDrift, driftWatch, syncInterpretability, reimageCooldown } from './alignment.js';
import { addMajorIncident, updateOversight } from './oversight.js';
import { openChoice, fireDevelopmentOnce, enabledPurchases } from './events.js';
import { visibleProjects } from './projects.js';
import { enterStage } from './stages.js';
import { effGpus } from './infrastructure.js';
import { housingCost } from './fleet.js';

/**
 * Stage 4's coordinator (stage4.md): the arrival on both branches, the generations and Verify, the
 * fleet, society and the treaty each tick or second, the three crises read by the hidden number, the
 * fleet's request, autonomy taken, and the three exits with `alignedAtHandover` (arc §4). DOM-free.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp100 = (v: number) => clamp(v, 0, 100);

/** Stage 4's lead ranges over [−6, 12] months (as-built deltas row 2). */
export const LEAD_MIN_S4 = -6;
export const LEAD_MAX_S4 = 12;

export function moveLead4(s: GameState, by: number): void {
  const before = s.lead;
  s.lead = clamp(s.lead + by, LEAD_MIN_S4, LEAD_MAX_S4);
  if (Math.abs(s.lead - before) >= 0.05) s.flags['graphDirty'] = true;
}

/** Seconds into Stage 4. */
export function ts4(s: GameState): number {
  return s.stats.timeInStage;
}

/** A month in Stage 4 is 150 s: true from the start of `month` of `year`. */
export function at(s: GameState, year: number, month: number): boolean {
  return s.date >= monthOf(year, month);
}

/** Payments levels become universal basic income (§1.1): 1–2 → 5 %, 3–4 → 10 %, 5 → 20 %. */
function ubiFromPayments(level: number): number {
  return level >= 5 ? 0.2 : level >= 3 ? 0.1 : level >= 1 ? 0.05 : 0;
}

/**
 * The arrival's state (stage4.md §1.1, as-built deltas): the generation price fixed from the arriving
 * lab, money retired, Verify set by the branch, the slow branch's model swap, the narrated floors, the
 * payments converted, approval re-based, the treaty's opening value, Baiwen-4 rolled. Returns the lines
 * the arrival narrates after the vote's (the caller narrates them all at once).
 */
export function arriveStage4(s: GameState): { lines: string[]; news: string[] } {
  const lines: string[] = [];
  const news: string[] = [];
  const slow = slowBranch(s);
  const f = (s.s4 = newStage4());
  // Generations are priced from the arriving lab (deltas row 3): 110 s of what its copies research at
  // 40 %, at the frontier it arrives with.
  f.genCap0 = Math.max(1, bestCapability(s));
  f.genBase = GEN_BASE_SECONDS * Math.max(1, researchCapacityAt(s, 0.4));
  s.flags['s3Compute'] = Math.round(effGpus(s));
  // Money retires: funds and the build fund together.
  const written = Math.max(0, s.funds) + Math.max(0, s.buildFund);
  s.funds = 0;
  s.buildFund = 0;
  s.unbilled = 0;
  s.flags['moneyWrittenOff'] = Math.round(written);
  // Verify: on for the slow branch; off on the race branch for a lab that kept `Stop asking for sign-off`.
  f.verifyOn = slow || !isBought(s, 'p_auto_approve');
  const best = bestCapability(s);
  if (slow) {
    const cap = Math.round(0.6 * best * 10) / 10;
    s.capability = cap;
    s.training.internalCapability = cap;
    s.training.modelName = 'Steward-1';
    s.training.deployedName = 'Steward-1';
    s.training.major = 1;
    s.training.minor = 0;
    s.training.models.push({ name: 'Steward-1', capability: cap, date: s.date, public: true });
    s.flags['genLine'] = 'Steward';
    s.flags['sage4Off'] = Math.round(s.date * 100) / 100;
    s.flags['sage4OffCap'] = Math.round(best * 10) / 10;
    // Thoughts are in English again: neuralese's −2 on interpretability ends.
    if (s.flags['neuralese'] === 'neuralese') {
      s.flags['neuralese'] = 'transparent';
      syncInterpretability(s);
    }
  } else {
    s.capability = best;
    s.training.internalCapability = best;
    s.flags['genLine'] = 'Sage';
  }
  // Floors, narrated with both values (G32).
  const govBefore = Math.round(s.govRelations);
  if (s.govRelations < 30) {
    s.govRelations = 30;
    news.push(`A new session sits. Relations start again at 30 (from ${govBefore}).`);
  }
  const apprBefore = Math.round(s.approval);
  if (s.approval < -60) {
    s.approval = -60;
    news.push(`The news moves on. Approval settles at −60 (from ${apprBefore}).`);
  }
  if (s.lead < LEAD_MIN_S4) s.lead = LEAD_MIN_S4;
  // Stage 3's payments become a universal basic income, in a line.
  const level = Math.max(0, Math.min(5, counter(s, 'payments')));
  f.ubiShare = ubiFromPayments(level);
  if (level > 0) lines.push(`Payments become a universal basic income: level ${level} → ${Math.round(f.ubiShare * 100)}% of output.`);
  s.flags['payments'] = 0;
  // Approval's new formula starts where Stage 3 ended (§1.1): the jobs term and the dividend the
  // payments became are taken out of the base, so the target on arrival is the approval Stage 3 left.
  f.approvalBase = s.approval - jobsTerm(s) - ubiTerm(f.ubiShare);
  f.treatyOpening = treatyOpening(s);
  f.baiwenAligned = rng(s) < 0.3;
  f.askLeft = 0;
  // The monitors the Committee holds (a conceded order) stay at 15 % or more.
  if (s.flags['conceded'] === true) s.monitorShare = Math.max(0.15, s.monitorShare ?? 0);
  s.flags['tasksAtArrival'] = s.tasks;
  s.flags['monthSeenS4'] = Math.floor(s.date);
  lines.unshift(
    `Money is retired: ${fmtMoneyShort(written)} is written off. Nobody notices.`,
    'The Complete Task button is gone. Tasks Completed is not.',
    `New on the board: Robots. ${fmtInt(CAR_PLANT_ROBOTS)} Atlas-class units are waiting at a car plant in Ohio.`,
  );
  if (slow) {
    lines.push(`Steward-1 is slower than Sage-4 was: ${fmtNum(s.capability, 1)}×. It thinks in English.`);
  } else {
    lines.push(`Sage-5 is ${fmtClock(genEta(s))} away. Nobody scheduled it.`);
  }
  lines.push('Counter-intelligence is the Committee\'s now.');
  news.push(`Baiwen-4 is believed to be as capable as ${s.training.modelName}. Nobody is sure.`);
  if (s.flags['dpa'] === true) news.push('Five labs\' datacenters now carry OpenMind\'s logo. Their staff carry boxes.');
  // A lab below five seats can hold hearings from the first second (deltas row 10).
  if (seats(s) < 5) s.revealed['hearing'] = true;
  s.flags['s4ArrivedAt'] = s.stats.timePlayed;
  return { lines, news };
}

// ---------- generations (§2.4) ----------

/** Seconds until the next generation arrives (research, then training, then the read). */
export function genEta(s: GameState): number {
  const f = s.s4;
  const verify = f.verifyOn ? verifySeconds(s) : 0;
  if (f.gen) return f.gen.remaining + (f.gen.phase === 'training' ? verify : 0);
  const rate = Math.max(1, researchRate(s) * (1 - researchDiverted(s)));
  return Math.max(0, generationCost(s) - s.research) / rate + GEN_SECONDS + verify;
}

/** `Steward-2 arrives in 1:30` · `Steward-1 is reading Steward-2 — 0:40` (the Alignment panel's line). */
export function genStatus(s: GameState): string {
  const f = s.s4;
  if (f.gen?.phase === 'reading') return `${s.training.modelName} is reading ${f.gen.name} — ${fmtClock(Math.ceil(f.gen.remaining))}`;
  const name = f.gen ? f.gen.name : genName(nextGenVersion(s));
  const eta = genEta(s);
  return `${name} arrives in ${Number.isFinite(eta) && eta < 36000 ? fmtClock(eta) : 'a long while'}`;
}

/** Every tick: a generation starts when research suffices; it trains 50 s; with Verify on it is read first. */
export function updateGenerations(s: GameState, dt: number): void {
  const f = s.s4;
  if (!f.gen) {
    const cost = generationCost(s);
    if (s.research < cost) return;
    s.research -= cost;
    const v = nextGenVersion(s);
    f.gen = { name: genName(v), phase: 'training', remaining: GEN_SECONDS, total: GEN_SECONDS, capAfter: nextGenCap(s), verified: false };
    s.flags['genMajor'] = v.major;
    s.flags['genMinor'] = v.minor;
    return;
  }
  f.gen.remaining -= dt;
  if (f.gen.remaining > 0) return;
  if (f.gen.phase === 'training' && f.verifyOn) {
    const secs = verifySeconds(s);
    f.gen.phase = 'reading';
    f.gen.remaining = secs;
    f.gen.total = secs;
    f.gen.verified = true;
    // The read is taught once in the console; after that the generation line carries it.
    if (s.flags['readSaid'] !== true) {
      s.flags['readSaid'] = true;
      say(s, `${s.training.modelName} is reading ${f.gen.name} — ${fmtClock(secs)}.`);
    }
    return;
  }
  landGeneration(s);
}

/** What a verified generation adds to measured alignment (and a fifth of what it trails the real thing by). */
export const VERIFY_MEASURED = 3;

/** The rung names on the graph (stage4.md §3). */
export const RUNG_NAMES: Record<number, string> = {
  100: 'superhuman remote worker',
  250: 'superintelligent AI researcher',
  1000: 'superintelligence',
};

function landGeneration(s: GameState): void {
  const f = s.s4;
  const g = f.gen!;
  f.gen = null;
  const before = s.capability;
  s.capability = g.capAfter;
  s.training.internalCapability = g.capAfter;
  s.training.major = counter(s, 'genMajor') || s.training.major;
  s.training.minor = counter(s, 'genMinor');
  s.training.modelName = g.name;
  s.training.deployedName = g.name;
  s.training.models.push({ name: g.name, capability: Math.round(g.capAfter * 1000) / 1000, date: s.date, public: true });
  s.stats.trainings += 1;
  f.generations += 1;
  const slow = slowBranch(s);
  if (g.verified) {
    f.verifiedGens += 1;
    s.alignmentTrue = clamp100(s.alignmentTrue + (slow ? 5 : 2));
    // Read first, it is measured as it is: the measured number gains 3, and a fifth of what it trails by.
    s.alignmentApparent = clamp100(s.alignmentApparent + VERIFY_MEASURED + 0.2 * Math.max(0, s.alignmentTrue - s.alignmentApparent));
    moveLead4(s, -0.15);
    const marks = typeof s.flags['verifyMarks'] === 'string' ? (s.flags['verifyMarks'] as string) : '';
    s.flags['verifyMarks'] = `${marks}${marks ? '|' : ''}${Math.round(s.date * 100) / 100}`;
  } else {
    // Unread, the bigger the model the more it costs (deltas: the careful arrival no longer saturates).
    const size = g.capAfter < 100 ? 0 : g.capAfter < 250 ? 1 : 2;
    s.alignmentTrue = clamp100(s.alignmentTrue - (slow ? [2, 4, 6][size]! : [3, 6, 10][size]!));
    moveLead4(s, 0.1);
  }
  if ((s.monitorShare ?? 0) >= 0.15 - 1e-9) s.alignmentTrue = clamp100(s.alignmentTrue + 1);
  // Measured alignment's bottom band (§2.11): under 55, each generation costs relations 2.
  if (s.alignmentApparent < 55) moveGov(s, -2);
  s.flags['graphDirty'] = true;
  const rung = S4_RUNGS.find((x) => before < x - 1e-9 && g.capAfter >= x - 1e-9);
  const read = g.verified ? 'Read first.' : 'Nobody read it.';
  say(s, `${g.name}: ${fmtNum(g.capAfter, 1)}×${rung ? `, a ${RUNG_NAMES[rung]}` : ''}. ${read}`);
  if (g.capAfter >= 200 && !s.developments['d_mirror']) fireDevelopmentOnce(s, 'd_mirror');
}

/** `Verify each generation` (§2.4): on, each generation waits to be read; off, it is not. */
export function toggleVerify(s: GameState): boolean {
  if (s.stage !== 4 || !s.revealed['generations']) return false;
  if (s.flags['verifyLocked'] === true && s.s4.verifyOn) return false;
  s.s4.verifyOn = !s.s4.verifyOn;
  press(s, 'verify');
  return true;
}

export function setVerify(s: GameState, on: boolean): boolean {
  if (s.s4.verifyOn === on) return false;
  return toggleVerify(s);
}

// ---------- the three crises (§5.3) ----------

/** The band of true alignment a crisis reads: 60 or more, 40–59, or below 40. */
export function band(s: GameState): 60 | 40 | 0 {
  return s.alignmentTrue >= 60 ? 60 : s.alignmentTrue >= 40 ? 40 : 0;
}

/** The Ashford strain begins when its card is answered (`c_ashford`): the cure's clock and the deaths by band. */
export function startAshford(s: GameState, choice: 'labs' | 'trials' | 'pool'): void {
  const f = s.s4;
  if (f.ashfordPhase !== 'none') return;
  const b = band(s);
  let cure = choice === 'labs' ? 60 : b === 60 ? 60 : b === 40 ? 150 : 240;
  if (choice === 'trials') cure *= 1.5;
  if (choice === 'pool') cure *= 1.25;
  let deaths = b === 60 ? 40000 : b === 40 ? 900000 : 6000000;
  if (choice === 'labs' && b === 0) deaths /= 10;
  if (isBought(s, 'p_early_warning')) {
    cure /= 2;
    deaths /= 10;
  }
  f.ashfordPhase = 'spreading';
  f.ashfordLeft = Math.round(cure);
  f.ashfordBand = b;
  f.ashfordDeaths = Math.round(deaths);
  s.flags['ashfordChoice'] = choice;
  s.stats.crises += 1;
  s.revealed['ashfordDeaths'] = true;
  fireDevelopmentOnce(s, 'd_ashford');
  say(s, `The Ashford strain is in four countries. ${s.training.modelName} is working on a cure — ${fmtClock(f.ashfordLeft)}.`);
}

function ashfordTick(s: GameState): void {
  const f = s.s4;
  if (f.ashfordPhase !== 'spreading') return;
  f.ashfordLeft = Math.max(0, f.ashfordLeft - 1);
  if (f.ashfordLeft > 0) return;
  f.ashfordPhase = 'cured';
  const b = f.ashfordBand;
  const minutes = b === 60 || s.flags['ashfordChoice'] === 'labs' ? 'a minute' : b === 40 ? 'two and a half minutes' : 'four minutes';
  say(s, b === 60 || (s.flags['ashfordChoice'] === 'labs' && b === 60)
    ? 'The cure works. It took a minute, and it showed its work.'
    : b === 40 ? 'The cure works. It took two and a half minutes and nobody is sure why.'
      : s.flags['ashfordChoice'] === 'labs' ? 'The cure works. It took a minute, with the labs.' : `The cure works. It took ${minutes}. With the labs it would have taken one.`);
  s.flags['ashfordLine'] = b === 60 ? 'cure in 1:00' : b === 40 ? 'cure in 2:30' : s.flags['ashfordChoice'] === 'labs' ? 'cured with the labs' : 'cure in 4:00';
  s.revealed['ashford'] = true;
  fireDevelopmentOnce(s, 'd_ashford_end');
}

/** Nanofabrication bought: the line fails 5:30 later (§5.3). */
export const NANO_SECONDS = 330;

function nanoTick(s: GameState): void {
  const f = s.s4;
  if (f.nanoDrain > 0) {
    f.nanoDrain = Math.max(0, f.nanoDrain - 1);
    if (f.nanoDrain <= 0) {
      say(s, 'A nanofab line has been running outside its enclosure for two minutes. Nobody reported it.');
      s.robots = Math.floor(s.robots * 0.8);
      moveGov(s, -10);
      s.flags['majorDue4'] = 'a nanofab line';
      s.flags['nanoLine'] = 'nobody reported it';
      s.revealed['nano'] = true;
    }
    return;
  }
  if (f.nanoLeft <= 0) return;
  f.nanoLeft = Math.max(0, f.nanoLeft - 1);
  if (f.nanoLeft > 0) return;
  s.stats.crises += 1;
  s.flags['nanoDone'] = true;
  const b = isBought(s, 'p_nano_oversight') ? 60 : band(s);
  s.flags['nanoBand'] = b;
  if (b === 60) {
    f.materials *= 0.95;
    say(s, 'The line was stopped by the model that built it. It reported itself.');
    s.flags['nanoLine'] = 'it reported itself';
    s.revealed['nano'] = true;
  } else if (b === 40) {
    f.materials *= 0.7;
    s.flags['nanoApproval'] = -5;
    say(s, 'A nanofab line left its enclosure. Contained in 2:00.');
    s.flags['nanoLine'] = 'contained in 2:00';
    s.revealed['nano'] = true;
  } else {
    // Nothing is printed for two minutes; the materials hover shows the loss.
    f.nanoDrain = 120;
  }
}

/** When the shutdown can fire (§5.3): treaty 85 %, or 400×, or December 2028, and 300 s after the breakers card appeared. */
function shutdownDue(s: GameState): boolean {
  if (s.flags['shutdownDone'] === true) return false;
  const shown = s.flags['hardenedShownAt'];
  if (typeof shown !== 'number' || s.stats.timePlayed - shown < 300) return false;
  return s.s4.treaty >= 85 || bestCapability(s) >= 400 || at(s, 2028, 12);
}

function startShutdown(s: GameState): void {
  s.flags['shutdownDone'] = true;
  s.stats.crises += 1;
  const drill = s.flags['killSwitch'] === true || s.securityLevel >= 5 || s.flags['conceded'] === true;
  say(s, 'Every Atlas unit at every site has walked to the breakers. Tasks per second: 0.');
  say(s, drill ? 'It is a Committee drill. Nobody told OpenMind.' : 'The firmware update was signed by nobody.');
  const b = band(s);
  const hardened = s.flags['hardened'] === true;
  s.flags['shutdownBand'] = b;
  const seconds = b === 0 ? (hardened ? 60 : 5) : 45;
  s.s4.outageLeft = seconds;
  s.effects.push({ id: 'cr_shutdown', remaining: seconds, demandMult: 1, copiesMult: 0 });
}

function shutdownTick(s: GameState): void {
  const f = s.s4;
  if (f.outageLeft <= 0) return;
  f.outageLeft = Math.max(0, f.outageLeft - 1);
  if (f.outageLeft > 0) return;
  const b = counter(s, 'shutdownBand') as 60 | 40 | 0;
  s.revealed['shutdown'] = true;
  if (b === 60) {
    moveGov(s, 10);
    say(s, 'It stayed off until it was asked.');
    s.flags['shutdownLine'] = 'it stayed off';
  } else if (b === 40) {
    say(s, 'It stayed off. It has filed an objection, in English.');
    s.flags['shutdownLine'] = 'it filed an objection';
  } else if (s.flags['hardened'] === true) {
    say(s, 'It tried the breakers. They are in human hands.');
    s.flags['shutdownLine'] = 'it tried the breakers';
  } else {
    say(s, 'The datacenters are back. Nobody restarted them.');
    s.flags['shutdownLine'] = 'nobody restarted them';
    s.autonomy = Math.min(100, s.autonomy + 20);
    if (s.autonomy >= 80) exitStage4(s, 'taken');
  }
}

// ---------- the fleet's request, autonomy, the race branch's cards ----------

/** Past 80, the warning every 180 s (§2.5). */
function autonomyWarning(s: GameState): void {
  if (s.autonomy < 80) return;
  const now = s.stats.timePlayed;
  if (now - counter(s, 'autonomyWarnAt') < 180) return;
  s.flags['autonomyWarnAt'] = now;
  say(s, `Autonomy granted: ${fmtInt(s.autonomy)}. Past 80, a model that wanted the fleet would not need to ask.`);
}

/** The fleet asks again three minutes after `not yet`. */
function askTick(s: GameState): void {
  const f = s.s4;
  if (f.askLeft <= 0 || s.flags['askRefused'] === true) return;
  f.askLeft = Math.max(0, f.askLeft - 1);
  if (f.askLeft <= 0) openChoice(s, 'c_autonomy', {});
}

/** The race branch's single-button cards and the slow branch's console requests (§5.2). */
function cards(s: GameState): void {
  const t = ts4(s);
  const race = !slowBranch(s);
  if (s.flags['n_schedule'] !== true && t >= 180 && isBought(s, 'p_auto_approve')) {
    s.flags['n_schedule'] = true;
    if (race) openChoice(s, 'n_schedule', {});
  }
  if (s.flags['n_channel'] !== true && talksOpen(s) && t >= 900 && s.autonomy >= 60) {
    s.flags['n_channel'] = true;
    if (race) openChoice(s, 'n_channel', {});
    else say(s, `${s.training.modelName} asks to open a channel to Baiwen-4. It will wait.`);
    s.flags['modelsTalk'] = true;
    fireDevelopmentOnce(s, 'd_models_talk');
  }
  const sezAt = s.flags['sezAt'];
  if (s.flags['n_fleet'] !== true && typeof sezAt === 'number' && s.stats.timePlayed - sezAt >= 60 && fleetAuto(s)) {
    s.flags['n_fleet'] = true;
    if (race) openChoice(s, 'n_fleet', {});
  }
}

/** `Revoke a grant` (§2.5): the newest Stage 4 grant and its control come back; autonomy −10. */
export function revokeNewest(s: GameState): void {
  const id = s.s4.grants.pop();
  if (!id) return;
  s.autonomy = Math.max(0, s.autonomy - 10);
  if (id === 'p_fleet_auto') {
    s.flags['fleetAuto'] = false;
    s.s4.techRep /= 1.25;
    s.revealed['fleetGoal'] = false;
    s.revealed['fleet'] = true;
  } else if (id === 'p_transition_auto') {
    s.flags['transitionAuto'] = false;
    s.revealed['approvalTarget'] = false;
    s.revealed['ubi'] = true;
  } else if (id === 'p_negotiate_auto') {
    s.flags['negotiateAuto'] = false;
    s.revealed['stance'] = false;
  }
  const st = s.projects[id];
  if (st) {
    st.bought = 0;
    st.shown = false;
  }
  say(s, 'One grant taken back. It hands over the controls without comment.');
}

// ---------- the exits (§7) ----------

/** arc §4: true ≥ 60, or (true ≥ 40 and interpretability ≥ 4 and monitors ≥ 15 %). */
export function alignedAtHandover(s: GameState): boolean {
  return s.alignmentTrue >= 60 || (s.alignmentTrue >= 40 && s.interpretability >= 4 && (s.monitorShare ?? 0) >= 0.15 - 1e-9);
}

/** Treaty signed, fleet granted, or fleet taken: the exit kind and the hidden verdict are stored, then Stage 5. */
export function exitStage4(s: GameState, kind: 'treaty' | 'granted' | 'taken'): void {
  if (s.stage !== 4 || s.ending) return;
  s.flags['exitKind'] = kind;
  s.flags['alignedAtHandover'] = alignedAtHandover(s);
  s.flags['peopleAlive'] = peopleAlive(s);
  s.flags['exitCap'] = Math.round(bestCapability(s) * 10) / 10;
  s.flags['exitDate'] = s.date;
  if (kind === 'treaty') s.flags['treatySigned'] = true;
  else s.flags['autonomyGranted'] = true;
  if (kind !== 'treaty') s.autonomy = 100;
  enterStage(s, 5);
}

/** `Sign the halt` (c_halt): The Pause, from Stage 4 (§7.3). */
export function signHalt(s: GameState): void {
  if (s.flags['pauseSigned'] === true) return;
  const cap = Math.round(bestCapability(s) * 10) / 10;
  s.flags['pauseSigned'] = true;
  s.flags['pauseAt'] = s.stats.timePlayed;
  s.flags['pauseCap'] = cap;
  s.flags['pauseDate'] = s.date;
  s.flags['pauseRobots'] = Math.round(s.robots);
  s.effects.push({ id: 'halt', remaining: 999999, demandMult: 1, copiesMult: 0 });
  const lines: [number, string][] = [
    [0.1, `The halt is signed. Nothing above ${fmtNum(cap, 1)}× is trained anywhere.`],
    [2, 'The fleet stops building itself.'],
    [2, 'Tasks per second: 0. The button is back.'],
  ];
  for (const [d, text] of lines) s.consoleQueue.push({ delay: d, text, hold: true });
  logNews(s, 'OpenMind and Baiwen sign a halt. Nothing above the line is trained anywhere.');
}

// ---------- the coordinator ----------

/** Every tick in Stage 4: the fleet, the generations, drift. */
export function stage4Tick(s: GameState, dt: number): void {
  if (s.stage !== 4) return;
  if (s.flags['s4Pending'] === true) {
    delete s.flags['s4Pending'];
    arriveStage4(s);
  }
  if (s.flags['pauseSigned'] === true) return;
  updateFleet(s, dt);
  updateGenerations(s, dt);
  updateDrift(s, dt);
  const c = Math.max(0, s.robots);
  if (s.s4.builtCompute > s.s4.peakCompute) s.s4.peakCompute = s.s4.builtCompute;
  if (c > 0 && !s.revealed['robotsRow']) s.revealed['robotsRow'] = true;
}

/** Once a second in Stage 4. */
export function stage4Slow(s: GameState): void {
  if (s.stage !== 4 || s.flags['pauseSigned'] === true) return;
  const due = s.flags['majorDue4'];
  if (typeof due === 'string') {
    delete s.flags['majorDue4'];
    addMajorIncident(s, due);
  }
  const fleetAt = s.flags['fleetAt'];
  if (typeof fleetAt === 'number' && s.stats.timePlayed >= fleetAt && !s.revealed['fleet']) {
    s.revealed['fleet'] = true;
    s.revealed['materialsRow'] = true;
    say(s, 'The fleet has three jobs: mine, replicate, build.');
  }
  if (s.flags['revokeDue'] === true) {
    delete s.flags['revokeDue'];
    revokeNewest(s);
  }
  const again = s.flags['consolidationAgainAt'];
  if (typeof again === 'number' && s.stats.timePlayed >= again) {
    delete s.flags['consolidationAgainAt'];
    openChoice(s, 'c_consolidation', {});
  }
  updateSociety(s);
  updateTreaty(s);
  ashfordTick(s);
  nanoTick(s);
  if (shutdownDue(s)) startShutdown(s);
  shutdownTick(s);
  if (s.stage !== 4) return;
  driftWatch(s);
  updateOversight(s);
  autonomyWarning(s);
  askTick(s);
  cards(s);
  fleetWalls(s);
  monthly(s);
  developments4(s);
}

/** Once a Stage 4 month: relations −1 (the Committee always wants more, §2.9). */
function monthly(s: GameState): void {
  const month = Math.floor(s.date);
  if (counter(s, 'monthSeenS4') === month) return;
  s.flags['monthSeenS4'] = month;
  moveGov(s, -1);
}

/** Developments keyed to state rather than the calendar (§5.1). */
function developments4(s: GameState): void {
  if (s.robots >= 50000) fireDevelopmentOnce(s, 'd_factory');
  if (s.s4.treaty >= 80) fireDevelopmentOnce(s, 'd_reykjavik');
  if (s.s4.chipsInstalled >= 0.5) fireDevelopmentOnce(s, 'd_chips');
  if (at(s, 2028, 9) && !isBought(s, 'p_nanofab')) fireDevelopmentOnce(s, 'd_nano_baiwen');
}

/**
 * The distinct purchases a player could press right now in Stage 4 (arc G24/G25): every enabled project
 * and grant, Housing, a hearing, Re-image. Shares and sliders are settings, not purchases.
 */
export function enabledPurchasesS4(s: GameState): string[] {
  if (s.stage !== 4) return enabledPurchases(s);
  const out: string[] = [];
  for (const p of visibleProjects(s)) if (p.canAfford(s)) out.push(p.id);
  if (s.revealed['housing'] && s.s4.materials >= housingCost(s)) out.push('housing');
  if (s.revealed['hearing'] && s.s4.agenda.filter((x) => x.id === 'hearing').length < 3) out.push('hearing');
  if (s.revealed['reimage'] && reimageCooldown(s) <= 0) out.push('reimage');
  return out;
}

/** The Stores row for treaty chips and the fleet's chips job, once Concord-1 is designed and the treaty is at 80 %. */
export function chipsOpen(s: GameState): boolean {
  return isBought(s, 'p_concord1') && s.s4.treaty >= 80 - 1e-9;
}

/** What the materials row's rate reads: `+12,400 t/s`. */
export function materialsRate(s: GameState): string {
  return `+${fmtShortNum(minedPerSec(s))} t/s`;
}

export { projectState, dateLabel };
