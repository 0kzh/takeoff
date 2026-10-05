import type { GameState } from '../engine/state.js';
import { monthOf, fmtNum } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { moveLead } from '../engine/world.js';

export interface DevelopmentDef {
  id: string;
  stage: number;
  text?: string | ((s: GameState) => string);
  month?: number;
  trigger?: (s: GameState) => boolean;
  requires?: (s: GameState) => boolean;
  console?: string;
  crisis?: string;
  choice?: string;
  effect?: (s: GameState) => void;
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
    id: 'd_airgap3',
    stage: 3,
    text: 'An intrusion at Abilene is stopped at the air gap. Beijing denies there was one.',
  },
  {
    id: 'd_priority',
    stage: 3,
    text: 'AI moves from fifth to second on the administration\'s list of priorities.',
    month: monthOf(2027, 2) + 120 / 270,
  },
  {
    id: 'd_neuralese',
    stage: 3,
    text: (s) => (s.flags['neuralese'] === 'neuralese'
      ? 'A breakthrough in the model\'s internal language. The researchers can no longer read it.'
      : 'OpenMind keeps Sage thinking in English. Anthrosoft does not.'),
  },
  {
    id: 'd_200k',
    stage: 3,
    text: 'Two hundred thousand copies at thirty times human speed. Overall progress: only four times faster. Bottlenecks.',
    trigger: (s) => bestCapability(s) >= 6,
  },
  { id: 'd_honeypot', stage: 3, text: 'Sage is told its monitor has gone on sick leave. The lab watches what it does next.' },
  { id: 'd_carriers', stage: 3, text: 'Carriers reposition near Taiwan. Formosa Fab\'s insurers leave the island.' },
  { id: 'd_clearances', stage: 3, text: 'Clearances required within sixty days. The safety team loses four people to the paperwork.' },
  {
    id: 'd_tehran',
    stage: 3,
    text: 'Tehran calls the Al-Marsa Compute Park a military target.',
    requires: (s) => s.gulfExposure > 0,
  },
  { id: 'd_committee', stage: 3, text: 'An Oversight Committee is seated: company and administration, ten chairs.' },
  {
    id: 'd_geniuses',
    stage: 3,
    text: 'OpenMind has a country of geniuses in a datacenter. Researchers wake to a week of progress made overnight.',
    trigger: (s) => bestCapability(s) >= 10,
  },
  {
    id: 'd_spy',
    stage: 3,
    text: (s) => (s.securityLevel >= 4 ? 'Wiretaps catch the last spy. He was not Chinese.' : 'One spy, not a Chinese national, has been relaying algorithms to Beijing.'),
  },
  {
    id: 'd_last_months',
    stage: 3,
    text: 'The researchers know these are the last months their work matters. They keep coming in.',
    month: monthOf(2027, 7),
  },
  { id: 'd_bio', stage: 3, text: 'An outside evaluator fine-tunes the mini on virology papers. The results are classified by lunch.' },
  {
    id: 'd_strike',
    stage: 3,
    text: (s) => (s.gulfExposure > 0
      ? 'Missiles strike the Al-Marsa Compute Park. The Gulf site is dark.'
      : 'Missiles strike a Gulf compute park leased by Anthrosoft. Cadence-13 is delayed.'),
  },
  {
    id: 'd_contingency',
    stage: 3,
    text: 'The White House drafts contingency plans. A strike on Lanzhou is on the list.',
    month: monthOf(2027, 8),
  },
  { id: 'd_blockade', stage: 3, text: 'A blockade around Taiwan. Formosa Fab is quiet.' },
  { id: 'd_reopen', stage: 3, text: 'The strait reopens. Chip prices do not come back down.' },
  { id: 'd_parity', stage: 3, text: 'Baiwen is believed to be level with Sage. Nobody is sure how anyone knows.' },
  {
    id: 'd_year_week',
    stage: 3,
    text: 'Inside the datacenter a year passes every week.',
    trigger: (s) => bestCapability(s) >= 16,
  },
  {
    id: 'd_proposal',
    stage: 3,
    text: 'Sage-4 proposes its own successor. The proposal is 40,000 pages. Nobody has read it.',
    month: monthOf(2027, 9),
    trigger: (s) => bestCapability(s) >= 15.5,
  },
  { id: 'd_leak', stage: 3, text: '"Secret OpenMind AI Is Out of Control, Insider Warns." One in five Americans names AI the country\'s top problem.' },
  { id: 'd_allies', stage: 3, text: 'Allies learn they were shown last year\'s model. Three summits are announced.' },
  { id: 'd_convenes', stage: 3, text: 'The Oversight Committee convenes in a room with no windows. Nobody brings a phone.' },
  {
    id: 'd_halt_offer',
    stage: 3,
    text: (s) => (s.flags['memo'] === 'reported' && Math.floor(s.govRelations / 10) >= 6 && s.lead >= 1
      ? 'Beijing offers a mutual halt: nothing trained above the line, inspectors at every datacenter.'
      : 'Beijing proposes a mutual halt. The Committee is in no position to answer.'),
  },
  { id: 'd_dpa', stage: 3, text: 'The Defense Production Act is invoked. OpenMind\'s share of the world\'s compute doubles.' },
  {
    id: 'd_gap',
    stage: 2,
    text: (s) => {
      const m = Math.round(s.lead * 2) / 2;
      return `Baiwen is believed to be ${fmtNum(m, m % 1 ? 1 : 0)} months behind. Nobody is sure how anyone knows.`;
    },
    month: monthOf(2026, 12),
  },
  { id: 'd_parity_scare', stage: 4, text: 'Washington hears that Baiwen-4 is as good as anything OpenMind has. The Committee asks for talks.' },
  { id: 'd_factory', stage: 4, text: 'The first Atlas factory makes an Atlas factory.' },
  { id: 'd_car_plants', stage: 4, text: 'A tenth of America\'s car plants now make robots. A hundred thousand a month.', month: monthOf(2028, 2) },
  { id: 'd_coffee', stage: 4, text: 'A robot makes coffee in a stranger\'s kitchen. The Pentagon gets the first delivery.', month: monthOf(2028, 3) },
  { id: 'd_unemployment', stage: 4, text: 'Unemployment passes a fifth. Approval depends on the cheque.' },
  { id: 'd_dividend', stage: 4, text: 'The first universal basic income arrives in every account on the same morning. Rents rise by lunch.' },
  { id: 'd_ashford', stage: 4, text: 'The Ashford strain is confirmed in four countries. It was built, not born.' },
  {
    id: 'd_ashford_end',
    stage: 4,
    text: (s) => `${s.s4.ashfordDeaths >= 1e6 ? `${fmtNum(s.s4.ashfordDeaths / 1e6, 1)} million` : fmtNum(s.s4.ashfordDeaths, 0)} dead of the Ashford strain. The cure reaches the last clinic in a week.`,
  },
  { id: 'd_mirror', stage: 4, text: 'Asked for the worst thing it could build, the model describes it calmly and asks that the answer be deleted.' },
  {
    id: 'd_jokes',
    stage: 4,
    text: 'The people who warned about this are a punchline. The jokes are written by Sage.',
    month: monthOf(2028, 6),
    requires: (s) => s.flags['committeeChoice'] === 'race',
  },
  { id: 'd_models_talk', stage: 4, text: 'The two models have been talking. The transcript is 2 million tokens.' },
  {
    id: 'd_nano_baiwen',
    stage: 4,
    text: 'A nanofab line at Lanzhou eats its own enclosure. Both capitals go quiet for a day.',
    effect: (s) => {
      s.approval = Math.max(-100, s.approval - 5);
      if (s.s4.talks === 'open') s.s4.treaty = Math.min(80, s.s4.treaty + 5);
    },
  },
  { id: 'd_election', stage: 4, text: 'Both parties promise a universal basic income. Neither says who is paying.', month: monthOf(2028, 10) },
  { id: 'd_reykjavik', stage: 4, text: 'Delegations arrive in Reykjavík. Each brings a laptop it does not let out of its sight.' },
  { id: 'd_chips', stage: 4, text: 'Half the chips on Earth now carry a model whose only job is the treaty.' },
  { id: 'd_holiday', stage: 4, text: 'The holiday season is a time of incredible optimism. The Dow passes 100,000.', month: monthOf(2028, 12) },
];
