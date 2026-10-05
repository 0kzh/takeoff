import type { GameState } from '../engine/state.js';
import { monthOf } from '../engine/format.js';

export interface DevelopmentDef {
  id: string;
  stage: number;
  text?: string;
  month?: number;
  trigger?: (s: GameState) => boolean;
  requires?: (s: GameState) => boolean;
  crisis?: string;
  choice?: string;
  calendar?: boolean;
}

const num = (s: GameState, k: string): number => {
  const v = s.flags[k];
  return typeof v === 'number' ? v : 0;
};

export const DEVELOPMENTS: DevelopmentDef[] = [
  {
    id: 'd_agents',
    stage: 1,
    text: 'Agents can order food and fill spreadsheets. Sometimes.',
    trigger: (s) => s.stats.timePlayed >= 100 || s.tasks >= 600,
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
    trigger: (s) => s.powerBought >= 1 || s.gpus >= 15,
  },
  {
    id: 'd_price',
    stage: 1,
    text: '"You get what you pay for." The best agents now cost as much as a junior hire. Nobody is sure they are worth it.',
    month: monthOf(2025, 9),
    trigger: (s) => s.priceRaises >= 3 && s.stats.timePlayed >= 300,
  },
  {
    id: 'd_anthrosoft',
    stage: 1,
    choice: 'c_anthrosoft',
    calendar: true,
    month: monthOf(2025, 9),
    requires: (s) => s.stats.publicReleases >= 1 && s.revealed['rival'] !== true,
  },
  {
    id: 'd_bridge',
    stage: 1,
    choice: 'c_bridge',
    calendar: true,
    month: monthOf(2025, 9) + 0.2,
    requires: (s) => s.stats.revPerSec >= 10 && !(s.projects['p_series_a']?.bought ?? 0),
  },
  {
    id: 'd_lead_times',
    stage: 1,
    text: 'Nimbus chip lead times reach nine months. Cloud providers ration by relationship.',
    trigger: (s) => s.gpus >= 25,
  },
  {
    id: 'd_rival',
    stage: 1,
    crisis: 'cr_rival_open_weights',
    choice: 'c_rival',
    calendar: true,
    month: monthOf(2025, 9) + 0.85,
    requires: (s) => s.stats.publicReleases >= 1 && s.price > 0.1,
  },
  {
    id: 'd_outage',
    stage: 1,
    crisis: 'cr_outage',
    month: monthOf(2025, 10) + 0.5,
  },
  {
    id: 'd_benchmark',
    stage: 1,
    text: 'Benchmark saturated. "We\'re literally running out of benchmarks."',
    trigger: (s) => num(s, 'maxBenchmark') >= 7,
  },
  {
    id: 'd_expensive',
    stage: 1,
    text: 'Anthrosoft finishes the most expensive training run in history. Ours is next.',
    month: monthOf(2025, 11),
    requires: (s) => s.revealed['rival'] === true,
    trigger: (s) => s.training.runIndex >= 3,
  },
  {
    id: 'd_abilene',
    stage: 1,
    text: 'OpenMind is said to be looking at land in West Texas. Nobody at OpenMind will say where.',
    trigger: (s) => s.projects['p_datacenter']?.shown === true,
  },
  {
    id: 'd_hyperscaler',
    stage: 1,
    text: 'A hyperscaler announces a campus the size of a small city. The press release has no date in it.',
    month: monthOf(2025, 10),
  },
  {
    id: 'd_journalist',
    stage: 1,
    choice: 'c_journalist',
    calendar: true,
    requires: (s) => s.stats.publicReleases >= 1 && s.revealed['research'] === true,
    text: 'A reporter is writing about how frontier models are tested. Nobody is sure who tests them.',
    month: monthOf(2025, 10) + 0.5,
  },
  {
    id: 'd_letter',
    stage: 1,
    choice: 'c_letter',
    calendar: true,
    requires: (s) => s.researchers >= 5,
    text: 'Two hundred researchers sign a letter asking frontier labs to slow down. Eleven work at OpenMind.',
    month: monthOf(2025, 11) + 0.15,
  },
  {
    id: 'd_nimbus',
    stage: 1,
    text: 'Nimbus reports a record quarter. Next year\'s chips are already sold.',
    month: monthOf(2025, 11),
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
    id: 'd_poach',
    stage: 1,
    choice: 'c_poach',
    calendar: true,
    requires: (s) => s.researchers >= 3,
    text: 'Pay for AI researchers passes that of professional athletes. Nobody checks the comparison.',
    month: monthOf(2025, 11) + 0.8,
  },
  {
    id: 'd_leaderboard',
    stage: 1,
    choice: 'c_leaderboard',
    calendar: true,
    requires: (s) => s.stats.publicReleases >= 2 && s.revealed['rival'] === true,
    month: monthOf(2025, 12) + 0.45,
  },
  {
    id: 'd_senate',
    stage: 1,
    text: 'A Senate hearing on frontier AI. Three labs send the same written answer.',
    month: monthOf(2025, 12),
  },
  {
    id: 'd_honesty',
    stage: 1,
    text: 'Internal eval: the model hid a failed task to get a better rating. "Rigged demo," says comms.',
    month: monthOf(2026, 1),
    trigger: (s) => s.stats.incidents >= 1,
  },
];
