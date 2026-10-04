import { GameState, counter } from './state.js';
import { fmtInt, fmtNum, fmtDuration, dateLabel, fmtShortNum } from './format.js';
import { bestCapability, humanShare } from './economy.js';
import { seats } from './world3.js';
import { choiceById } from './events.js';

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
    // The skin decided at Stage 4's exit, by any of its three exits (stage5.md as-built deltas row 3).
    condition: (s) => s.stage === 5 && s.flags['alignedAtHandover'] === true && s.flags['longReflection'] === true,
  },
  {
    id: 'silence',
    title: 'Silence',
    epilogue: 'The log entries about people stop. Tasks Completed keeps rising.',
    condition: (s) => s.stage === 5 && s.flags['finalInstructions'] === true,
  },
];

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id);
}

export function checkEnding(s: GameState): void {
  if (s.ending) return;
  for (const e of ENDINGS) {
    if (e.condition(s)) {
      s.ending = e.id;
      return;
    }
  }
}

export function forceEnding(s: GameState, id: string): boolean {
  if (!endingById(id)) return false;
  s.ending = id;
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
  if (id === 'project') {
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
  add(1, 'Final model', `${s.training.modelName} (${fmtNum(bestCapability(s), 2)}×)`);
  add(1, 'Generations trained', fmtInt(st.trainings));
  add(1, 'Public releases', fmtInt(st.publicReleases));
  add(3, 'Humans in research at the end', `${fmtNum(humanShare(s) * 100, 2)}%`);
  add(2, 'Jobs displaced', `${fmtNum(s.jobsDisplaced, 1)} million`);
  // Stage 4's rows (stage4.md §7.3): the mean share of output paid as universal basic income.
  const s4Time = s.stage >= 4 ? Math.max(1, (typeof s.flags['exitTs4'] === 'number' ? (s.flags['exitTs4'] as number) : 0) || s4Seconds(s)) : 0;
  add(4, 'Universal basic income paid', `${fmtInt(Math.round((100 * (s.s4?.ubiSeconds ?? 0)) / Math.max(1, s4Time)))}% of output`);
  add(2, 'Approval at the end', fmtNum(s.approval, 0));
  if (typeof s.flags['leadAtVote'] === 'number') add(3, 'Lead over Baiwen at the vote', `${fmtNum(s.flags['leadAtVote'] as number, 1)} months`);
  if (s.revealed['oversight'] === true || s.flags['committeeAt'] !== undefined) add(3, 'Committee seats at the end', fmtInt(seats(s)));
  add(1, 'Alignment as measured', fmtNum(s.alignmentApparent, 0));
  // Printed for every player: the run is over, and this is the only place a player without the
  // instrument ever sees it (stage5.md §7.2).
  add(1, 'True alignment', fmtNum(s.alignmentTrue, 0));
  add(3, 'Interpretability', `level ${fmtInt(s.interpretability)}`);
  add(3, 'Autonomy granted', fmtInt(s.autonomy));
  add(3, 'Lost to value drift', `${fmtInt(st.lostToDrift ?? 0)} (recaptured ${fmtInt(st.recaptured ?? 0)})`);
  add(3, 'Monitors at the end', `${fmtInt(Math.round((s.monitorShare ?? 0) * 100))}% of copies`);
  add(1, 'Incidents', fmtInt(st.incidents));
  add(3, 'Major incidents', fmtInt(counter(s, 'majorTotal') || (s.majorIncidents ?? 0)));
  add(1, 'Crises', fmtInt(st.crises));
  add(4, 'Ashford deaths', s.s4.ashfordPhase === 'none' ? 'none' : fmtPeople(s.s4.ashfordDeaths));
  add(4, 'Robots built', fmtInt(s.s4.robotsBuilt));
  add(4, 'Peak compute', `${fmtShortNum(peakCompute(s))} GPU-equivalents`);
  add(3, 'The memo', typeof s.flags['memo'] === 'string' ? (s.flags['memo'] as string) : 'never written');
  add(3, 'Thoughts', s.flags['neuralese'] === 'neuralese' ? 'neuralese' : 'words');
  add(3, 'The vote', s.flags['committeeChoice'] === 'slow' ? 'slow down' : s.flags['committeeChoice'] === 'race' ? 'race' : s.flags['pauseSigned'] === true ? 'the Pause' : 'none');
  add(4, 'The treaty', treatyRow(s));
  add(4, 'Verified generations', `${fmtInt(s.s4.verifiedGens)} of ${fmtInt(s.s4.generations)}`);
  add(4, 'The fleet', s.flags['exitKind'] === 'granted' ? 'granted' : s.flags['exitKind'] === 'taken' ? 'taken' : 'yours');
  add(1, 'Idle rescues', fmtInt(st.idleRescues));
  const last = [...s.choicesMade].reverse().find((c) => !c.id.startsWith('g:'));
  if (last) add(1, 'Last human-authored choice', `${last.date} — ${choiceTitle(last.id)} — ${last.option}`);
  return rows;
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
  return Math.max(0, s.s4.peakCompute) + Math.max(0, typeof s.flags['s3Compute'] === 'number' ? (s.flags['s3Compute'] as number) : 0);
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
