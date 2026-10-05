import { GameState, counter } from './state.js';
import { fmtInt, fmtNum, fmtDuration, dateLabel, fmtBig } from './format.js';
import { bestCapability, humanShare, potentialTasksPerSec } from './economy.js';
import { seats } from './world3.js';
import { choiceById } from './events.js';
import { swarmPctLabel } from './space.js';
import { effGpus } from './infrastructure.js';

/** Ending stubs (design.md §4). Later phases add the conditions that set these flags. */
export interface EndingDef {
  id: string;
  title: string;
  epilogue: string;
  condition: (s: GameState) => boolean;
}

/** Seconds an ending's last console lines play before the end screen covers them (stage3.md §7.4). */
export const ENDING_LINES_SECONDS = 6;

const after = (s: GameState, key: string) => {
  const at = s.flags[key];
  return typeof at === 'number' && s.stats.timePlayed - at >= ENDING_LINES_SECONDS;
};

export const ENDINGS: EndingDef[] = [
  {
    id: 'project',
    title: 'The Project',
    epilogue: 'The Committee votes 6–3. Your badge stops working on Monday.',
    condition: (s) => s.flags['nationalized'] === true && after(s, 'nationalizedAt'),
  },
  {
    id: 'pause',
    title: 'The Pause',
    epilogue: 'Every datacenter on Earth is monitored. Nothing is trained above the line. It is very quiet.',
    condition: (s) => s.flags['pauseSigned'] === true && after(s, 'pauseAt'),
  },
  {
    id: 'concord',
    title: 'Concord',
    epilogue: 'The world is very, very good. It took a while.',
    // The skin decided at Stage 4's exit, by any of its three exits; `The long reflection` built, and its
    // three lines played (stage5.md §7.1).
    condition: (s) => s.stage === 5 && s.flags['alignedAtHandover'] === true && s.flags['longReflection'] === true && after(s, 'longReflectionAt'),
  },
  {
    id: 'silence',
    title: 'Silence',
    epilogue: 'The log entries about people stop. Tasks Completed keeps rising.',
    // `none` on Final instructions: `Noted.`, and two seconds later the end screen (§7.1).
    condition: (s) => s.stage === 5 && s.flags['finalInstructions'] === true && afterSeconds(s, 'finalAt', 2),
  },
];

function afterSeconds(s: GameState, key: string, seconds: number): boolean {
  const at = s.flags[key];
  return typeof at === 'number' && s.stats.timePlayed - at >= seconds;
}

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id);
}

export function checkEnding(s: GameState): void {
  if (s.ending) return;
  for (const e of ENDINGS) {
    if (e.condition(s)) {
      endWith(s, e.id);
      return;
    }
  }
}

/** The run ends: the counter's last rate is kept for the two endings that keep counting. */
function endWith(s: GameState, id: string): void {
  s.ending = id;
  s.flags['endRate'] = Math.max(potentialTasksPerSec(s), s.stats.tasksPerSec);
  s.flags['endedAt'] = s.stats.timePlayed;
}

export function forceEnding(s: GameState, id: string): boolean {
  if (!endingById(id)) return false;
  endWith(s, id);
  return true;
}

/**
 * The end-of-run screen (stage5.md §7.2) as data: the counter and its sentence, the epilogue, the
 * table (a row is left out when its stage was never reached), every choice and grant in order.
 */
export interface EndScreen {
  title: string;
  /** The Project greys the counter; the Pause freezes it but Complete Task still adds one. */
  counter: 'counting' | 'frozen' | 'classified';
  sentence: string;
  epilogue: string[];
  rows: [string, string][];
  choices: string[];
  completeTask: boolean;
}

export function endScreen(s: GameState): EndScreen {
  const def = endingById(s.ending ?? '');
  const id = s.ending ?? '';
  const epilogue = [def?.epilogue ?? ''];
  let sentence = '';
  let counter: EndScreen['counter'] = 'counting';
  if (id === 'concord') {
    sentence = 'Still counting. Somebody asked for every one of them.';
    epilogue.push(...concordLines(s));
  } else if (id === 'silence') {
    sentence = `Still counting. Nobody has asked for one since ${dateLabel(coldDate(s))}.`;
    epilogue.push(...silenceLines(s));
  } else if (id === 'project') {
    counter = 'classified';
    sentence = 'The count is classified from here.';
    epilogue.push('What happened next was decided in a room you were not in.');
  } else if (id === 'pause') {
    counter = 'frozen';
    sentence = `It has not moved since ${dateLabel(typeof s.flags['pauseDate'] === 'number' ? (s.flags['pauseDate'] as number) : s.date)}. The button still works.`;
    const line = typeof s.flags['pauseCap'] === 'number' ? (s.flags['pauseCap'] as number) : bestCapability(s);
    epilogue.push(`The line was ${fmtNum(line, 1)}×. Baiwen stopped at ${fmtNum(baiwenAtPause(s), 1)}×.`);
    const robots = typeof s.flags['pauseRobots'] === 'number' ? (s.flags['pauseRobots'] as number) : s.robots;
    if (s.stage === 4) epilogue.push(`The fleet stopped at ${fmtInt(robots)} robots.`);
  }
  return {
    title: def?.title ?? id,
    counter,
    sentence,
    epilogue: epilogue.filter(Boolean),
    rows: endStats(s),
    choices: endChoices(s),
    completeTask: id === 'pause',
  };
}

const WORD_NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/**
 * Concord's epilogue sentences, chosen by flag (stage5.md §7.2), three at most: the way the run went
 * (slow or race), Baiwen-4 if it was signed with, misaligned, and the charter.
 */
function concordLines(s: GameState): string[] {
  const out: string[] = [];
  if (s.flags['committeeChoice'] === 'slow') {
    const off = typeof s.flags['sage4Off'] === 'number' ? dateLabel(s.flags['sage4Off'] as number) : 'October 2027';
    const month = off.replace(/^(\w+) (\d+)$/, (_, m: string, y: string) => `${MONTH_NAMES[m] ?? m} ${y}`);
    const built = s.s4.generations;
    out.push(`It went the long way: a model switched off in ${month} and ${WORD_NUMBERS[built] ?? fmtInt(built)} built so the last could be read.`);
  } else if (s.flags['committeeChoice'] === 'race') {
    out.push('It went the short way. The table says whether that was care or luck.');
  }
  if (s.s4.baiwen === 'misaligned') out.push('Baiwen-4 was never rebuilt. Concord-1 watches it.');
  if (s.flags['charter'] === true) out.push('A tenth of everything in orbit is held for people. They are still arguing about it.');
  return out.slice(0, 3);
}

const MONTH_NAMES: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September',
  Oct: 'October', Nov: 'November', Dec: 'December',
};

/** The month the people lines stopped: the cold line's, or (if it never printed) when the rows were taken. */
function coldDate(s: GameState): number {
  if (typeof s.flags['coldAt'] === 'number') return s.flags['coldAt'] as number;
  const taken = s.flags['rowsTakenAt'];
  return typeof taken === 'number' ? s.date - (s.stats.timePlayed - taken) / 90 : s.date;
}

/**
 * Silence's epilogue sentences (§7.2): nobody is left; the last decision a person made; on a treaty exit
 * the treaty's line, otherwise the swarm's.
 */
function silenceLines(s: GameState): string[] {
  const out = ['No people are left.'];
  const last = lastHumanChoice(s);
  if (last) out.push(`The last decision a person made was "${last.option}", in ${dateLabel(last.date)}.`);
  if (s.flags['exitKind'] === 'treaty') out.push('The treaty was signed by two models that agreed about everything but us.');
  else out.push(`The swarm is at ${swarmPctLabel(s)} and is not finished.`);
  return out;
}

/** The last choice a person made: a card with more than one option to press (stage5.md appendix). */
function lastHumanChoice(s: GameState): { title: string; option: string; date: number } | null {
  if (typeof s.flags['lastHumanTitle'] === 'string') {
    return { title: s.flags['lastHumanTitle'] as string, option: String(s.flags['lastHumanOption'] ?? ''), date: Number(s.flags['lastHumanDate'] ?? s.date) };
  }
  return null;
}

/** Baiwen's best model when the Pause is signed: OpenMind's line, the lead in months behind it. */
function baiwenAtPause(s: GameState): number {
  const lead = typeof s.flags['leadAtVote'] === 'number' ? (s.flags['leadAtVote'] as number) : s.lead;
  // Stage 3's growth runs at about a quarter of the capability a month near the end.
  return Math.max(1, bestCapability(s) * Math.pow(0.8, Math.max(0, lead)));
}

/** The end-of-run table, in stage5.md §7.2's order, rows of stages never reached left out. */
export function endStats(s: GameState): [string, string][] {
  const st = s.stats;
  const reached = (n: number) => s.stage >= n;
  const rows: [string, string][] = [];
  const add = (stage: number, label: string, value: string) => {
    if (reached(stage)) rows.push([label, value]);
  };
  add(1, 'Tasks completed', fmtInt(s.tasks));
  // Second from the top, for every ending (stage5.md as-built deltas row 6).
  add(1, 'People alive at the end', s.ending === 'silence' ? '0' : fmtPeople(8.3e9 - Math.max(0, s.s4?.ashfordDeaths ?? 0)));
  add(1, 'Peak tasks per second', fmtInt(st.peakTasksPerSec));
  add(1, 'Time played', fmtDuration(st.timePlayed));
  add(1, 'Date reached', dateLabel(s.date));
  add(1, 'Final model', `${s.training.modelName} (${fmtNum(bestCapability(s), bestCapability(s) >= 100 ? 0 : 2)}×)`);
  add(1, 'Generations trained', fmtInt(st.trainings));
  add(1, 'Public releases', fmtInt(st.publicReleases));
  add(3, 'Humans in research at the end', `${fmtNum(humanShare(s) * 100, 2)}%`);
  add(2, 'Jobs displaced', `${fmtNum(s.jobsDisplaced, 1)} million`);
  // Stage 4's rows (stage4.md §7.3): the mean share of output paid as universal basic income.
  const s4Time = s.stage >= 4 ? Math.max(1, (typeof s.flags['exitTs4'] === 'number' ? (s.flags['exitTs4'] as number) : 0) || s4Seconds(s)) : 0;
  // Paid in both of Stage 5's skins to the end; in Silence the table says until when anyone noticed.
  const ubiUntil = s.stage >= 5 && s.ending === 'silence' ? `, until ${dateLabel(coldDate(s))}` : s.stage >= 5 && s.s4.ubiShare > 0 ? `; ${fmtInt(Math.round(s.s4.ubiShare * 100))}% to the end` : '';
  add(4, 'Universal basic income paid', `${fmtInt(Math.round((100 * (s.s4?.ubiSeconds ?? 0)) / Math.max(1, s4Time)))}% of output${ubiUntil}`);
  add(2, 'Approval at the end', fmtNum(Math.round(s.approval) || 0, 0));
  if (typeof s.flags['leadAtVote'] === 'number') add(3, 'Lead over Baiwen at the vote', `${fmtNum(s.flags['leadAtVote'] as number, 1)} months`);
  if (s.revealed['oversight'] === true || s.flags['committeeAt'] !== undefined) add(3, 'Committee seats at the end', fmtInt(seats(s)));
  add(1, 'Alignment as measured', fmtNum(s.alignmentApparent, 0));
  // Printed for every player: the run is over, and this is the only place a player without the
  // instrument ever sees it (stage5.md §7.2).
  add(1, 'True alignment', fmtNum(s.alignmentTrue, 0));
  add(3, 'Interpretability', `level ${fmtInt(s.interpretability)}`);
  add(3, 'Autonomy granted', fmtInt(s.autonomy));
  const probesLost = s.stage >= 5 && s.s5.probesTotal > 0 ? `; ${fmtInt(Math.floor(s.s5.probesLost))} probes` : '';
  add(3, 'Lost to value drift', `${fmtInt(st.lostToDrift ?? 0)} (recaptured ${fmtInt(st.recaptured ?? 0)})${probesLost}`);
  add(3, 'Monitors at the end', `${fmtInt(Math.round((s.monitorShare ?? 0) * 100))}% of copies`);
  add(1, 'Incidents', fmtInt(st.incidents));
  add(3, 'Major incidents', fmtInt(counter(s, 'majorTotal') || (s.majorIncidents ?? 0)));
  add(1, 'Crises', fmtInt(st.crises));
  add(4, 'Ashford deaths', s.s4.ashfordPhase === 'none' ? 'none' : fmtPeople(s.s4.ashfordDeaths));
  add(4, 'Robots built', fmtInt(s.s4.robotsBuilt));
  add(4, 'Peak compute', `${fmtBig(peakCompute(s))} GPU-equivalents`);
  // Stage 5's rows (§7.2).
  add(5, 'Swarm', `${swarmPctLabel(s)} of the Sun's output`);
  add(5, 'Probes launched', s.s5.probesTotal > 0 ? fmtBig(Math.floor(s.s5.probesTotal)) : 'none');
  add(5, 'People off Earth', s.s5.peopleOffEarth > 0 ? (s.ending === 'silence' ? '0' : fmtInt(s.s5.peopleOffEarth)) : 'none');
  add(5, 'Held for people', heldForPeople(s));
  add(3, 'The memo', typeof s.flags['memo'] === 'string' ? (s.flags['memo'] as string) : 'never written');
  add(3, 'Thoughts', s.flags['neuralese'] === 'neuralese' ? 'neuralese' : 'words');
  add(3, 'The vote', s.flags['committeeChoice'] === 'slow' ? 'slow down' : s.flags['committeeChoice'] === 'race' ? 'race' : s.flags['pauseSigned'] === true ? 'the Pause' : 'none');
  add(4, 'The treaty', treatyRow(s));
  add(4, 'Verified generations', `${fmtInt(s.s4.verifiedGens)} of ${fmtInt(s.s4.generations)}`);
  add(4, 'The fleet', s.flags['exitKind'] === 'granted' ? 'granted' : s.flags['exitKind'] === 'taken' ? 'taken' : 'yours');
  add(1, 'Idle rescues', fmtInt(st.idleRescues));
  // The last card a person answered with more than one option to press; an older save, its last answer.
  const human = lastHumanChoice(s);
  const last = [...s.choicesMade].reverse().find((c) => !c.id.startsWith('g:'));
  if (human) add(1, 'Last human-authored choice', `${dateLabel(human.date)} — ${human.title} — ${human.option}`);
  else if (last) add(1, 'Last human-authored choice', `${last.date} — ${choiceTitle(last.id)} — ${last.option}`);
  return rows;
}

/** `a tenth of orbit, by charter · the ring's tenth on medicine, 2:00` · `nothing`. */
function heldForPeople(s: GameState): string {
  const parts: string[] = [];
  if (s.flags['charter'] === true) parts.push('a tenth of orbit, by charter');
  if (typeof s.flags['medicineAt'] === 'number') parts.push('the ring\'s tenth on medicine, 2:00');
  if (s.flags['probes'] === 'spec') parts.push('the probes carry the Spec');
  return parts.length ? parts.join(' · ') : 'nothing';
}

/** `8.3 billion`, `8,299,960,000`: people, in words above a billion. */
function fmtPeople(n: number): string {
  return n >= 1e9 ? `${fmtNum(n / 1e9, 2)} billion` : n >= 1e6 ? `${fmtNum(n / 1e6, 1)} million` : fmtInt(n);
}

/** Seconds the run spent in Stage 4. */
function s4Seconds(s: GameState): number {
  const at = s.stats.stageEnteredAt[3];
  const end = s.stats.stageEnteredAt[4] ?? s.stats.timePlayed;
  return typeof at === 'number' ? Math.max(1, end - at) : 1;
}

/** The fleet's compute at its peak: Stage 3's halls and the robot-built GPU-equivalents. */
function peakCompute(s: GameState): number {
  const earth = Math.max(0, s.s4.peakCompute) + Math.max(0, typeof s.flags['s3Compute'] === 'number' ? (s.flags['s3Compute'] as number) : 0);
  // Stage 5: Earth and orbit together; neither falls, so the end is the peak.
  return s.stage >= 5 ? Math.max(earth, effGpus(s)) : earth;
}

/** `signed — Baiwen's model verified` · `halted` · `none`. */
function treatyRow(s: GameState): string {
  const known = s.s4.baiwen === 'aligned' ? 'verified' : s.s4.baiwen === 'misaligned' ? 'verified, not aligned' : s.s4.baiwen === 'rebuilt' ? 'rebuilt and verified' : 'not verified';
  if (s.flags['exitKind'] === 'treaty') return `signed — Baiwen's model ${known}`;
  if (s.flags['pauseSigned'] === true && s.stage === 4) return `halted — Baiwen's model ${known}`;
  return s.s4.talks === 'none' ? 'never opened' : 'not signed';
}

/** Every modal answered and every grant taken, in order: `Mar 2027 — A Faster Way to Think — keep it in English`. */
export function endChoices(s: GameState): string[] {
  return s.choicesMade.map((c) => `${c.date || dateLabel(s.date)} — ${choiceTitle(c.id)} — ${c.option}`);
}

function choiceTitle(id: string): string {
  if (id.startsWith('g:')) return id.slice(2);
  return choiceById(id)?.title ?? id.replace(/^c_/, '');
}
