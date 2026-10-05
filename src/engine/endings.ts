import { GameState } from './state.js';
import { fmtInt, fmtNum, fmtDuration, dateLabel } from './format.js';
import { bestCapability } from './economy.js';
import { choiceById } from './events.js';

export interface EndingDef {
  id: string;
  title: string;
  epilogue: string;
}

export const ENDINGS: EndingDef[] = [
  {
    id: 'datacenter',
    title: 'The First Datacenter',
    epilogue: 'OpenMind owns its first datacenter outside Abilene. The rented GPUs go back to the cloud.',
  },
];

export function endingById(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id);
}

export function forceEnding(s: GameState, id: string): boolean {
  if (!endingById(id)) return false;
  s.ending = id;
  s.flags['endedAt'] = s.stats.timePlayed;
  return true;
}

export interface EndScreen {
  title: string;
  epilogue: string[];
  rows: [string, string][];
  choices: string[];
}

export function endScreen(s: GameState): EndScreen {
  const def = endingById(s.ending);
  return {
    title: def?.title ?? s.ending,
    epilogue: def ? [def.epilogue] : [],
    rows: endStats(s),
    choices: endChoices(s),
  };
}

export function endStats(s: GameState): [string, string][] {
  const st = s.stats;
  const rows: [string, string][] = [
    ['Tasks completed', fmtInt(s.tasks)],
    ['Peak tasks per second', fmtInt(st.peakTasksPerSec)],
    ['Time played', fmtDuration(st.timePlayed)],
    ['Date reached', dateLabel(s.date)],
    ['Final model', `${s.training.modelName} (${fmtNum(bestCapability(s), 2)}×)`],
    ['Generations trained', fmtInt(st.trainings)],
    ['Public releases', fmtInt(st.publicReleases)],
    ['Alignment as measured', fmtNum(s.alignmentApparent, 0)],
    ['True alignment', fmtNum(s.alignmentTrue, 0)],
    ['Incidents', fmtInt(st.incidents)],
    ['Crises', fmtInt(st.crises)],
    ['Idle rescues', fmtInt(st.idleRescues)],
  ];
  const last = [...s.choicesMade].reverse().find((c) => !c.id.startsWith('g:'));
  if (last) rows.push(['Last human-authored choice', `${last.date} — ${choiceTitle(last.id)} — ${last.option}`]);
  return rows;
}

export function endChoices(s: GameState): string[] {
  return s.choicesMade.map((c) => `${c.date || dateLabel(s.date)} — ${choiceTitle(c.id)} — ${c.option}`);
}

function choiceTitle(id: string): string {
  if (id.startsWith('g:')) return id.slice(2);
  return choiceById(id)?.title ?? id.replace(/^c_/, '');
}
