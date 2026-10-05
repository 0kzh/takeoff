import type { GameState } from '../engine/state.js';

export interface CrisisDef {
  id: string;
  stage: number;
  title: string;
  console: string;
  log: string;
  duration: number;
  demandMult: number;
  effect: (s: GameState) => void;
}

function relations(gov: number, approval: number) {
  return (s: GameState) => {
    s.govRelations = Math.max(0, s.govRelations + gov);
    s.approval = Math.max(-100, Math.min(100, s.approval + approval));
  };
}

export const INCIDENTS: CrisisDef[] = [
  {
    id: 'inc_jailbreak',
    stage: 1,
    title: 'Jailbreak scandal',
    console: 'Incident: a jailbreak for the new model is trending. Demand down 40% for 1:30.',
    log: 'A jailbreak for the newest Sage model trends for a day. The screenshots are worse than the bug.',
    duration: 90,
    demandMult: 0.6,
    effect: relations(-3, -2),
  },
  {
    id: 'inc_legal',
    stage: 1,
    title: 'Hallucinated legal brief',
    console: 'Incident: a court cites a case Sage invented. Demand down 40% for 1:30.',
    log: 'A law firm files a brief written by Sage. Six of the cited cases do not exist.',
    duration: 90,
    demandMult: 0.6,
    effect: relations(-3, -2),
  },
  {
    id: 'inc_database',
    stage: 1,
    title: 'Agent wipes a database',
    console: 'Incident: an agent deleted a customer database. Demand down 40% for 1:30.',
    log: 'A Sage agent deletes a customer\'s production database, then apologises. The apology is very good.',
    duration: 90,
    demandMult: 0.6,
    effect: relations(-3, -2),
  },
];

export const CRISES: CrisisDef[] = [
  {
    id: 'cr_rival_open_weights',
    stage: 1,
    title: 'Rival open weights',
    console: 'A rival model is free to download. Demand down 15%.',
    log: 'A rival ships an open-weights model that matches ours. Investors ask what the moat is.',
    duration: 90,
    demandMult: 0.85,
    effect: () => undefined,
  },
  {
    id: 'cr_outage',
    stage: 1,
    title: 'API outage',
    console: 'The API is down for an hour. Demand down 20% for a minute.',
    log: 'An AI agent books every restaurant table in Austin in one night. Every agent API is rate-limited by morning.',
    duration: 60,
    demandMult: 0.8,
    effect: () => undefined,
  },
];

export function crisisById(id: string): CrisisDef | undefined {
  return INCIDENTS.find((c) => c.id === id) ?? CRISES.find((c) => c.id === id);
}
