import type { GameState } from '../engine/state.js';
import { monthOf } from '../engine/format.js';

/**
 * World timeline for the Developments log. Each entry fires on `month` (months since Jul 2025)
 * or on `trigger`, whichever comes first, and the log stamps it with the current game date.
 */
export interface DevelopmentDef {
  id: string;
  stage: number;
  text?: string;
  month?: number;
  trigger?: (s: GameState) => boolean;
  console?: string;
  crisis?: string;
  choice?: string;
  effect?: (s: GameState) => void;
}

const num = (s: GameState, k: string): number => {
  const v = s.flags[k];
  return typeof v === 'number' ? v : 0;
};

export const DEVELOPMENTS: DevelopmentDef[] = [
  // ---- Stage 1: Jul 2025 → Dec 2025 ----
  {
    id: 'd_agents',
    stage: 1,
    text: 'Agents can order food and fill spreadsheets. Sometimes.',
    trigger: (s) => s.gpus >= 2 || s.stats.timePlayed >= 90,
  },
  {
    id: 'd_contract',
    stage: 1,
    text: 'First enterprise contract. They want it to read Slack and write pull requests.',
    month: monthOf(2025, 9),
    trigger: (s) => s.totalRevenue >= 60,
  },
  {
    id: 'd_researchers',
    stage: 1,
    text: 'Three researchers leave a larger lab for OpenMind. They bring a whiteboard.',
    trigger: (s) => s.revealed['research'] === true,
  },
  {
    id: 'd_grid',
    stage: 1,
    text: 'A utility in Virginia pauses new datacenter hookups. The queue is three years long.',
    trigger: (s) => s.powerBought >= 4,
  },
  {
    id: 'd_price',
    stage: 1,
    text: '"You get what you pay for." Best agents now $200/month. Nobody is sure they\'re worth it.',
    month: monthOf(2025, 9),
    trigger: (s) => s.priceRaises >= 3 && s.stats.timePlayed >= 300,
  },
  {
    id: 'd_lead_times',
    stage: 1,
    text: 'Nimbus G4 lead times reach nine months. Cloud providers ration by relationship.',
    trigger: (s) => s.gpus >= 25,
  },
  {
    id: 'd_rival',
    stage: 1,
    crisis: 'cr_rival_open_weights',
    choice: 'c_rival',
    month: monthOf(2025, 10),
    trigger: (s) => s.stats.publicReleases >= 1 && s.stats.timePlayed >= 840,
  },
  {
    id: 'd_benchmark',
    stage: 1,
    text: 'Benchmark saturated. "We\'re literally running out of benchmarks."',
    trigger: (s) => num(s, 'maxBenchmark') >= 7.5,
  },
  {
    id: 'd_expensive',
    stage: 1,
    text: 'Anthrosoft finishes the most expensive training run in history. Ours is next.',
    month: monthOf(2025, 11),
    trigger: (s) => s.training.runIndex >= 3,
  },
  {
    id: 'd_journalist',
    stage: 1,
    choice: 'c_journalist',
    text: 'A reporter is writing about how frontier models are tested. Nobody is sure who tests them.',
    trigger: (s) => s.stats.publicReleases >= 2 && s.stats.timePlayed >= 1080,
  },
  {
    id: 'd_spec',
    stage: 1,
    text: 'Model memorised the Spec. We cannot check whether it believed it.',
    month: monthOf(2025, 12),
    trigger: (s) => num(s, 'safetyRuns') >= 1,
  },
  {
    id: 'd_grown',
    stage: 1,
    text: 'Memo from a safety researcher: "grown, not crafted." Filed.',
    trigger: (s) => s.training.runIndex >= 4 && num(s, 'safetyRuns') === 0,
  },
  {
    id: 'd_honesty',
    stage: 1,
    text: 'Internal eval: the model hid a failed task to get a better rating. "Rigged demo," says comms.',
    month: monthOf(2026, 1),
    trigger: (s) => s.stats.incidents >= 1,
  },
  {
    id: 'd_abilene',
    stage: 1,
    text: 'OpenMind files for a 1-GW site outside Abilene. Locals ask about the water.',
    trigger: (s) => s.projects['p_datacenter']?.shown === true,
  },
  // ---- Stage 2 seeds (Phase 2 extends this list) ----
  {
    id: 'd_fifth_code',
    stage: 2,
    text: 'Sage models write a fifth of the code at Fortune 500 companies.',
    month: monthOf(2026, 2),
  },
  {
    id: 'd_lanzhou',
    stage: 2,
    text: 'Beijing designates Baiwen the national champion. The Lanzhou CDZ begins construction.',
    month: monthOf(2026, 4),
  },
];
