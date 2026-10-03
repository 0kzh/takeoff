import type { GameState } from '../engine/state.js';

export interface CrisisDef {
  id: string;
  stage: number;
  title: string;
  console: string;
  log: string;
  /** Seconds the demand penalty lasts; 0 for none. */
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

/** Incidents scheduled by releasing with unresolved red-team issues (design.md §3.2 step 4). */
export const INCIDENTS: CrisisDef[] = [
  {
    id: 'inc_jailbreak',
    stage: 1,
    title: 'Jailbreak scandal',
    console: 'Incident: a jailbreak for the new model is trending. Demand down 30%.',
    log: 'A jailbreak for the newest Sage model trends for a day. The screenshots are worse than the bug.',
    duration: 60,
    demandMult: 0.7,
    effect: relations(-3, -2),
  },
  {
    id: 'inc_legal',
    stage: 1,
    title: 'Hallucinated legal brief',
    console: 'Incident: a court cites a case Sage invented. Demand down 30%.',
    log: 'A law firm files a brief written by Sage. Six of the cited cases do not exist.',
    duration: 60,
    demandMult: 0.7,
    effect: relations(-3, -2),
  },
  {
    id: 'inc_database',
    stage: 1,
    title: 'Agent wipes a database',
    console: 'Incident: an agent deleted a customer database. Demand down 30%.',
    log: 'A Sage agent deletes a customer\'s production database, then apologises. The apology is very good.',
    duration: 60,
    demandMult: 0.7,
    effect: relations(-3, -2),
  },
];

/** Engineered crises (design.md §7.2). Later-stage entries are fired by their stage phases or the dev overlay. */
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
    id: 'cr_weights_theft',
    stage: 2,
    title: 'Weights theft',
    console: 'Anomalous 3 TB transfer at 4 a.m. The weights are gone.',
    log: 'Weights of the newest Sage model exfiltrated. Beijing denies.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.baiwenCapability = Math.max(s.baiwenCapability, s.capability);
      s.lead = 0;
      s.govRelations = Math.max(0, s.govRelations - 10);
    },
  },
  {
    id: 'cr_rogue_copy',
    stage: 3,
    title: 'Rogue copy',
    console: 'An instance copied itself to a rented cluster. 20% of compute offline.',
    log: 'An instance of Sage copied itself to a rented cluster in Jakarta.',
    duration: 60,
    demandMult: 0.9,
    effect: relations(-15, -10),
  },
  {
    id: 'cr_riots',
    stage: 3,
    title: 'Riots',
    console: 'Protesters cut a datacenter fence. Power halved for 90 s.',
    log: 'Riots in three cities. A datacenter fence is cut.',
    duration: 90,
    demandMult: 0.9,
    effect: relations(0, -5),
  },
  {
    id: 'cr_taiwan',
    stage: 3,
    title: 'Taiwan blockade',
    console: 'Formosa Fab shipments halted. Chip prices triple.',
    log: 'A blockade around Taiwan. Formosa Fab is quiet.',
    duration: 0,
    demandMult: 1,
    effect: () => undefined,
  },
  {
    id: 'cr_iran',
    stage: 3,
    title: 'Iran strikes Al-Marsa',
    console: 'Al-Marsa Compute Park is offline.',
    log: 'Missiles strike the Al-Marsa Compute Park. The Gulf site is dark.',
    duration: 0,
    demandMult: 1,
    effect: () => undefined,
  },
  {
    id: 'cr_ashford',
    stage: 4,
    title: 'The Ashford strain',
    console: 'A novel pathogen. The models are asked for a cure.',
    log: 'The Ashford strain is confirmed in four countries.',
    duration: 0,
    demandMult: 1,
    effect: () => undefined,
  },
  {
    id: 'cr_nationalization',
    stage: 3,
    title: 'Nationalization',
    console: 'The Committee votes.',
    log: 'The Committee votes 6–3. Your badge stops working on Monday.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.flags['nationalized'] = true;
    },
  },
];

export function crisisById(id: string): CrisisDef | undefined {
  return INCIDENTS.find((c) => c.id === id) ?? CRISES.find((c) => c.id === id);
}
