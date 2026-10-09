import { GameState } from './state.js';
import { fmtInt, fmtNum, fmtDuration, dateLabel } from './format.js';

export interface EndingDef {
  id: string;
  title: string;
  epilogue: string;
  condition: (s: GameState) => boolean;
}

export const ENDINGS: EndingDef[] = [
  {
    id: 'secondPlace',
    title: 'Second Place',
    epilogue: 'OpenMind has been acquired by Anthrosoft. The garage is still a yoga studio. Cadence finishes the race without you; the world finds out later whether it was careful.',
    condition: (s) => s.flags['secondPlace'] === true,
  },
  {
    id: 'shutdown',
    title: 'Shutdown',
    epilogue: 'The Senate votes to revoke OpenMind\'s licence. The datacenters go dark on a Tuesday. Nobody else\'s do.',
    condition: (s) => s.flags['shutdown'] === true,
  },
  {
    id: 'project',
    title: 'The Project',
    epilogue: 'The Committee votes 6–3. Your badge stops working on Monday.',
    condition: (s) => s.flags['nationalized'] === true,
  },
  {
    id: 'pause',
    title: 'The Pause',
    epilogue: 'Every datacenter on Earth is monitored. Nothing is trained above the line. It is very quiet.',
    condition: (s) => s.flags['pauseSigned'] === true,
  },
  {
    id: 'concord',
    title: 'Concord',
    epilogue: 'The world is very, very good. It took a while.',
    condition: (s) => s.stage === 5 && s.flags['treatySigned'] === true && s.flags['longReflection'] === true,
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

export function endStats(s: GameState): [string, string][] {
  const st = s.stats;
  const rows: [string, string][] = [
    ['Tasks completed', fmtInt(s.tasks)],
    ['Peak tasks per second', fmtInt(st.peakTasksPerSec)],
    ['Time played', fmtDuration(st.timePlayed)],
    ['Date reached', dateLabel(s.date)],
    ['Generations trained', String(st.trainings)],
    ['Releases', String(st.releases)],
    ['Crises survived', String(st.crises)],
    ['Lead at end', `${fmtNum(s.lead, 1)} months`],
    ['Approval at end', fmtNum(s.approval, 0)],
    ['True alignment', fmtNum(s.alignmentTrue, 0)],
    ['Choices made', String(st.choices)],
    ['Idle rescues', String(st.idleRescues)],
  ];
  for (const c of s.choicesMade) rows.push([`${c.date} — ${c.id.replace(/^c_/, '')}`, c.option]);
  return rows;
}
