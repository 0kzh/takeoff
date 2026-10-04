import type { GameState } from '../engine/state.js';
import { monthOf, fmtNum } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { moveLead } from '../engine/world.js';

/**
 * World timeline for the Developments log. Each entry fires on `month` (months since Jul 2025)
 * or on `trigger`, whichever comes first, and the log stamps it with the current game date.
 * Stage 1 runs at five minutes a month: Aug ≈ 5:00, Sep ≈ 10:00, Oct ≈ 15:00, Nov ≈ 20:00, Dec ≈ 25:00.
 * Stage 2 runs at 3½ minutes a month: Feb ≈ 3:30, Apr ≈ 10:30, Jul ≈ 21:00, Oct ≈ 31:30, Dec ≈ 38:30.
 * Entries fire only in their own stage.
 */
export interface DevelopmentDef {
  id: string;
  stage: number;
  text?: string | ((s: GameState) => string);
  month?: number;
  trigger?: (s: GameState) => boolean;
  /** Must hold for the entry to fire at all, by date or by trigger (e.g. the Pentagon needs relations ≥ 40). */
  requires?: (s: GameState) => boolean;
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
    // The Developments column is the reveal between the first GPUs and the first Trust.
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
    id: 'd_bridge',
    stage: 1,
    choice: 'c_bridge',
    month: monthOf(2025, 9) + 0.2,
  },
  {
    id: 'd_lead_times',
    stage: 1,
    text: 'Nimbus chip lead times reach nine months. Cloud providers ration by relationship.',
    trigger: (s) => s.gpus >= 25,
  },
  // ---- The modal calendar: six choices 2:36 apart from about 8:50 at 240 s a month (MODAL_SPACING is 2½). ----
  {
    id: 'd_rival',
    stage: 1,
    crisis: 'cr_rival_open_weights',
    choice: 'c_rival',
    month: monthOf(2025, 9) + 0.85,
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
    text: 'A reporter is writing about how frontier models are tested. Nobody is sure who tests them.',
    month: monthOf(2025, 10) + 0.5,
  },
  {
    id: 'd_letter',
    stage: 1,
    choice: 'c_letter',
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
    text: 'Pay for AI researchers passes that of professional athletes. Nobody checks the comparison.',
    month: monthOf(2025, 11) + 0.8,
  },
  {
    id: 'd_leaderboard',
    stage: 1,
    choice: 'c_leaderboard',
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
  // ---- Stage 2: Jan 2026 → Dec 2026 (stage2.md §5.1) ----
  {
    id: 'd_fifth_code',
    stage: 2,
    text: 'Sage models write a fifth of the code at Fortune 500 companies.',
    month: monthOf(2026, 2),
  },
  {
    id: 'd_open_weights2',
    stage: 2,
    text: 'An open-weights model matches last year\'s Sage. The moat is this year\'s Sage.',
    month: monthOf(2026, 3),
  },
  {
    id: 'd_lanzhou',
    stage: 2,
    text: 'Beijing designates Baiwen the national champion. The Lanzhou CDZ begins construction.',
    month: monthOf(2026, 4),
    effect: (s) => moveLead(s, -1),
  },
  {
    id: 'd_cdz_chips',
    stage: 2,
    text: 'Eighty percent of China\'s new chips now go to Lanzhou. Baiwen absorbs three rivals overnight.',
    month: monthOf(2026, 5),
  },
  {
    id: 'd_hearing',
    stage: 2,
    choice: 'c_hearing',
    month: monthOf(2026, 5),
    // stage2.md says 300k tasks/s; the built economy reaches 80k where the paper model reached 300k.
    trigger: (s) => s.stats.tasksPerSec >= 80000,
  },
  {
    id: 'd_juniors',
    stage: 2,
    text: 'Junior-engineer hiring slows. "Learn to manage agents," say the gurus.',
    month: monthOf(2026, 6),
    trigger: (s) => s.jobsDisplaced >= 0.1,
  },
  {
    id: 'd_heat',
    stage: 2,
    text: 'A heat dome settles over Texas. The grid operator publishes a curtailment schedule.',
    month: monthOf(2026, 7),
    effect: (s) => {
      s.scheduled.push({ id: 'cr_curtailment', delay: 60 });
    },
  },
  {
    id: 'd_gulf',
    stage: 2,
    choice: 'c_gulf',
    month: monthOf(2026, 7),
    trigger: (s) => s.powerCapacityMW >= 100,
    requires: (s) => s.gasPlants >= 1,
  },
  {
    id: 'd_capex',
    stage: 2,
    text: 'Compute bill passes power bill passes payroll. Industry capex this year: $200 billion.',
    month: monthOf(2026, 8),
  },
  {
    id: 'd_stocks',
    stage: 2,
    text: 'Stock market up 30% on the year. The gains fit on one hand of tickers.',
    month: monthOf(2026, 8),
    trigger: (s) => s.tasks >= 5e8,
  },
  {
    id: 'd_juniors2',
    stage: 2,
    text: 'Junior developer postings down 40%. Bootcamps pivot to "agent management."',
    month: monthOf(2026, 9),
    trigger: (s) => s.jobsDisplaced >= 0.5,
  },
  {
    id: 'd_pentagon',
    stage: 2,
    choice: 'c_defense',
    month: monthOf(2026, 9),
    trigger: (s) => bestCapability(s) >= 2.8,
    requires: (s) => s.revealed['government'] === true && s.govRelations >= 40,
  },
  {
    id: 'd_friends',
    stage: 2,
    text: 'One in ten Americans under 25 calls an AI a close friend.',
    month: monthOf(2026, 10),
  },
  {
    id: 'd_billion',
    stage: 2,
    text: 'A billion tasks. Most were spreadsheets. Some were not.',
    trigger: (s) => s.tasks >= 1e9,
  },
  {
    id: 'd_take_home',
    stage: 2,
    text: 'Sage passes the take-home interview at every company that still gives one.',
    trigger: (s) => bestCapability(s) >= 3,
  },
  {
    id: 'd_protest',
    stage: 2,
    text: '10,000 march in Austin. One datacenter\'s fence is cut.',
    crisis: 'cr_protest',
    trigger: (s) => s.approval <= -20 || (s.date >= monthOf(2026, 11) && s.approval <= -10),
  },
  {
    id: 'd_airgap',
    stage: 2,
    text: 'An intrusion at Abilene is stopped at the air gap. Nobody outside hears of it.',
  },
  {
    id: 'd_gap',
    stage: 2,
    text: (s) => {
      const m = Math.round(s.lead * 2) / 2;
      return `Baiwen is believed to be ${fmtNum(m, m % 1 ? 1 : 0)} months behind. Nobody is sure how anyone knows.`;
    },
    month: monthOf(2026, 12),
  },
];
