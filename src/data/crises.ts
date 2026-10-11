import { isBought, type GameState } from '../engine/state.js';
import { fmtNum } from '../engine/format.js';
import { theftShare } from '../engine/economy.js';
import { THEFT_CAPABILITY, THEFT_DELAY_SECONDS, moveTempo } from '../engine/rivals.js';

export interface CrisisDef {
  id: string;
  stage: number;
  title: string;
  /** Threshold, checked every second in `stage`; the crisis fires once. Omit when a development or choice fires it. */
  when?: (s: GameState) => boolean;
  /** Modal body: pure, runs during render on a frozen snapshot. */
  text: (s: GameState) => string[];
  /** Applies the result; may return the one-line effects summary shown in the modal, e.g. "Baiwen 2.2× → 5.9× · tempo +8". */
  effect?: (s: GameState) => string | void;
  duration?: number;
  demandMult?: number;
  console?: string;
  log: string;
  /** Open this ChoiceDef as the crisis modal instead of the plain acknowledgement. */
  choice?: string;
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
    text: () => ['A rival model is free to download.'],
    effect: () => 'demand −15% for 1:30',
    duration: 90,
    demandMult: 0.85,
    log: 'A rival ships an open-weights model that matches ours. Investors ask what the moat is.',
    choice: 'c_rival',
  },
  {
    id: 'cr_outage',
    stage: 1,
    title: 'API outage',
    text: () => ['The API is down for an hour.'],
    effect: () => 'demand −20% for 1:00',
    duration: 60,
    demandMult: 0.8,
    log: 'An AI agent books every restaurant table in Austin in one night. Every agent API is rate-limited by morning.',
  },
  {
    id: 'cr_theft',
    stage: 2,
    title: 'Weight theft',
    when: (s) => {
      const sinceBaiwen =
        typeof s.flags['baiwenAt'] === 'number' ? s.stats.timePlayed - s.flags['baiwenAt'] : 0;
      return (
        s.baiwen.present &&
        sinceBaiwen >= THEFT_DELAY_SECONDS &&
        Math.max(s.capability, s.training.internalCapability) >= THEFT_CAPABILITY
      );
    },
    text: (s) => [
      'Anomalous egress from Training Cluster 3.',
      isBought(s, 's2_egress')
        ? 'Egress monitoring cut the transfer halfway. Baiwen has part of Sage.'
        : 'By the time anyone looked, Baiwen had a copy of Sage.',
    ],
    effect: (s) => {
      const before = s.baiwen.capability;
      const cap = Math.max(s.capability, s.training.internalCapability);
      s.baiwen.capability = Math.max(before, theftShare(s) * cap);
      const after = s.baiwen.capability;
      moveTempo(s, 8);
      s.flags['weightsStolen'] = true;
      return `Baiwen ${fmtNum(before, 1)}× → ${fmtNum(after, 1)}× · tempo +8`;
    },
    log: 'OpenMind confirms a theft of model weights. Baiwen declines to comment on anything.',
  },
  {
    id: 'cr_bio_headline',
    stage: 2,
    title: 'Bio uplift headline',
    text: () => ['A reporter asks Sage for a synthesis route. It answers.', 'Nobody had tested for that.'],
    effect: (s) => {
      relations(-8, -8)(s);
      return 'demand −30% for 2:00 · relations −8 · approval −8';
    },
    duration: 120,
    demandMult: 0.7,
    log: 'The Ledger: "OpenMind\'s model will explain how to make a pathogen." OpenMind learns this from the Ledger.',
  },
  {
    id: 'cr_bio_near_miss',
    stage: 2,
    title: 'Bio near miss',
    text: () => ['A DNA synthesis company in Rotterdam stopped an order it could not explain.', 'It was close.'],
    effect: (s) => {
      relations(-4, -3)(s);
      s.flags['bioNearMiss'] = ((s.flags['bioNearMiss'] as number) || 0) + 1;
      return 'relations −4 · approval −3';
    },
    log: 'A DNA synthesis company in Rotterdam stops an order it cannot explain. The order was drafted by a Sage model.',
  },
  {
    id: 'cr_cyber_worm',
    stage: 2,
    title: 'Worm built on Sage',
    text: () => ['A worm written with Sage hits two hospitals and a port.'],
    effect: (s) => {
      relations(-5, -5)(s);
      s.flags['cyberSeed'] = true;
      return 'demand −40% for 1:30 · relations −5 · approval −5';
    },
    duration: 90,
    demandMult: 0.6,
    log: 'A worm written with the help of a Sage model takes two hospitals offline. The hospitals\' AI restores them by morning.',
  },
  {
    id: 'cr_defection',
    stage: 2,
    title: 'Baiwen defects',
    text: () => ['Baiwen\'s compute usage tripled overnight.', 'The compute cap is, in their words, "under review".'],
    effect: (s) => {
      s.tempo = Math.min(100, s.tempo + 20);
      if (s.baiwen.present) s.baiwen.capability *= 1.3;
      return `tempo +20${s.baiwen.present ? ' · Baiwen capability +30%' : ''}`;
    },
    log: 'Xinhe Daily: the compute cap was advisory. Baiwen\'s compute usage has tripled.',
  },
];

export function crisisById(id: string): CrisisDef | undefined {
  return CRISES.find((c) => c.id === id);
}
