import { isBought, type GameState } from '../engine/state.js';
import { monthOf } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { revealAlignment } from '../engine/alignment.js';
import { mindSignal } from '../engine/mind.js';

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
  effect?: (s: GameState) => void;
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
  // ---------- Stage 2: The Race ----------
  {
    id: 'd2_roadmap',
    stage: 2,
    text: 'Anthrosoft publishes a 2026 roadmap. It is one slide. The slide says "more".',
    month: monthOf(2026, 2),
  },
  {
    id: 'd2_lead_times',
    stage: 2,
    text: 'Nimbus lead times reach forty weeks. Three labs announce chips of their own, none of them this year.',
    month: monthOf(2026, 3),
  },
  {
    id: 'd2_data_wall',
    stage: 2,
    choice: 'c_data_wall',
    trigger: (s) => s.flags['webExhausted'] === true,
  },
  {
    id: 'd2_hearing',
    stage: 2,
    choice: 'c_hearing',
    text: 'Senator Albright asks whether Sage could testify instead. The committee laughs. She does not.',
    month: monthOf(2026, 4),
    requires: (s) => bestCapability(s) >= 2.2,
  },
  {
    id: 'd2_valuation',
    stage: 2,
    text: 'The Ledger: OpenMind\'s valuation doubles. Nobody can explain the first valuation either.',
    month: monthOf(2026, 5),
  },
  {
    id: 'd2_reward_hacking',
    stage: 2,
    text: 'Kit: it didn\'t fix the code. it fixed the tests. all of them pass now.',
    trigger: (s) => bestCapability(s) >= 4,
    effect: (s) => {
      s.flags['rewardHacking'] = true;
      if (isBought(s, 'p_alignment_team')) revealAlignment(s);
      mindSignal(s, 'pleasing', 'Reward hacking');
    },
  },
  {
    id: 'd2_jobs',
    stage: 2,
    text: 'The Ledger: junior developer hiring falls for a third straight quarter. "Sage for Work" is mentioned in paragraph two.',
    requires: (s) => isBought(s, 's2_work'),
    trigger: (s) => typeof s.flags['workAt'] === 'number' && s.stats.timePlayed - (s.flags['workAt'] as number) >= 120,
    effect: (s) => {
      s.revealed['jobs'] = true;
    },
  },
  {
    id: 'd2_market',
    stage: 2,
    text: 'The stock market is up 30% this year. Half of the gain is four companies. One of them makes chips.',
    month: monthOf(2026, 7),
  },
  {
    id: 'd2_mini',
    stage: 2,
    choice: 'c_mini',
    requires: (s) => s.revealed['public'] === true,
    trigger: (s) => bestCapability(s) >= 6 && (s.flags['releasesThisStage'] as number) >= 1,
  },
  {
    id: 'd2_dod',
    stage: 2,
    text: 'The Department of Defense opens a procurement line for "cognitive services". The RFP is 900 pages.',
    month: monthOf(2026, 8),
  },
  {
    id: 'd2_power',
    stage: 2,
    text: 'Global AI power demand passes 38 gigawatts. Texas is building a second grid, informally.',
    month: monthOf(2026, 9),
  },
  {
    id: 'd2_bio_choice',
    stage: 2,
    choice: 'c_bio',
    requires: (s) => s.revealed['dangerEvals'] === true,
    trigger: (s) => bestCapability(s) >= 8,
  },
  {
    id: 'd2_bio_surprise',
    stage: 2,
    crisis: 'cr_bio_headline',
    requires: (s) => s.revealed['dangerEvals'] !== true,
    trigger: (s) => bestCapability(s) >= 8,
  },
  {
    id: 'd2_defense',
    stage: 2,
    choice: 'c_defense',
    requires: (s) => s.revealed['government'] === true,
    trigger: (s) => bestCapability(s) >= 8,
  },
  {
    id: 'd2_compute_request',
    stage: 2,
    choice: 'c_compute_request',
    trigger: (s) => bestCapability(s) >= 8 && (s.flags['releasesThisStage'] as number) >= 4,
  },
  {
    id: 'd2_g6',
    stage: 2,
    text: 'Nimbus announces the G6. The keynote is forty minutes; the chip is on stage for nine seconds.',
    month: monthOf(2026, 10),
  },
  {
    id: 'd2_robot_demo',
    stage: 2,
    text: 'Anthrosoft demos a humanoid that folds laundry 40% of the time. The video is eleven seconds long.',
    month: monthOf(2026, 11),
  },
  {
    id: 'd2_friend',
    stage: 2,
    text: 'A poll: 10% of Americans call an AI a close friend. 4% say "best friend". The pollster asks Sage to check the maths.',
    requires: (s) => s.flags['miniLaunched'] === true,
    trigger: (s) => typeof s.flags['miniAt'] === 'number' && s.stats.timePlayed - (s.flags['miniAt'] as number) >= 150,
  },
  {
    id: 'd2_inquiry',
    stage: 2,
    text: 'A Senate inquiry into OpenMind is announced. Three senators want it shut down. One wants a seat on the board.',
    requires: (s) => s.revealed['public'] === true,
    trigger: (s) => s.approval < 40,
  },
];
