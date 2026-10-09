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
  {
    id: 'cr_theft_discovered',
    stage: 2,
    title: 'Theft discovered late',
    console: 'Wenshu\'s new model makes our model\'s unusual mistakes. The weights left months ago.',
    log: 'The Ledger: OpenMind declines to comment on reports it was robbed. Baiwen declines to comment on anything.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.govRelations = Math.max(0, s.govRelations - 5);
    },
  },
  {
    id: 'cr_bio_headline',
    stage: 2,
    title: 'Bio uplift headline',
    console: 'A reporter asks Sage for a synthesis route. It answers. Nobody had tested for that.',
    log: 'The Ledger: "OpenMind\'s model will explain how to make a pathogen." OpenMind learns this from the Ledger.',
    duration: 120,
    demandMult: 0.7,
    effect: relations(-8, -8),
  },
  {
    id: 'cr_bio_near_miss',
    stage: 2,
    title: 'Bio near miss',
    console: 'A DNA synthesis company in Rotterdam stopped an order it could not explain. It was close.',
    log: 'A DNA synthesis company in Rotterdam stops an order it cannot explain. The order was drafted by a Sage model.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      relations(-4, -3)(s);
      s.flags['bioNearMiss'] = ((s.flags['bioNearMiss'] as number) || 0) + 1;
    },
  },
  {
    id: 'cr_cyber_worm',
    stage: 2,
    title: 'Worm built on Sage',
    console: 'A worm written with Sage hits two hospitals and a port. Demand down 40% for 1:30.',
    log: 'A worm written with the help of a Sage model takes two hospitals offline. The hospitals\' AI restores them by morning.',
    duration: 90,
    demandMult: 0.6,
    effect: (s) => {
      relations(-5, -5)(s);
      s.flags['cyberSeed'] = true;
    },
  },
  {
    id: 'cr_defection',
    stage: 2,
    title: 'Baiwen defects',
    console: 'Baiwen\'s compute usage tripled overnight. The compute cap is, in their words, "under review".',
    log: 'Xinhe Daily: the compute cap was advisory. Baiwen\'s compute usage has tripled.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.tempo = Math.min(100, s.tempo + 20);
      if (s.baiwen.present) s.baiwen.capability *= 1.3;
    },
  },
];

export function crisisById(id: string): CrisisDef | undefined {
  return CRISES.find((c) => c.id === id);
}
