import { GameState, Cost, canPay, isBought, addFunds } from '../engine/state.js';
import { enterStage, STUCK } from '../engine/stages.js';
import { researchCap, gpuCost, fleetPowerBlock, INTERCONNECT_SECONDS, CONTRACT_BASE, CONTRACT_GROWTH } from '../engine/economy.js';
import { trainCost } from '../engine/training.js';
import { monthOf } from '../engine/format.js';

/**
 * One row of the project table. `trigger` decides when the button appears (always before it is
 * affordable: reveal on trigger, never on affordability); `canAfford` greys it out; `buy` applies
 * the effect after the cost has been paid.
 */
export interface ProjectDef {
  id: string;
  title: string;
  /** Overrides the generated `(cost)` label. */
  priceTag?: string | ((s: GameState) => string);
  description: string;
  /** Stages in which the project can appear and be bought. Stage-1-only projects retire at the transition. */
  stages: number[];
  cost: (s: GameState) => Cost;
  trigger: (s: GameState) => boolean;
  canAfford: (s: GameState) => boolean;
  buy: (s: GameState) => void;
  /** How many times it can be bought before it disappears. */
  uses: number;
  /** Hide again after each purchase until the trigger fires again (repeatable rescues). */
  rehide?: boolean;
  /** Rescue projects ignore the visible-project cap and are drawn dashed. */
  rescue?: boolean;
  /** The stage goal (the Abilene site ladder): ignores the visible-project cap. */
  pinned?: boolean;
  consoleMsg?: string;
  logMsg?: string;
}

type ProjectInput = Omit<ProjectDef, 'canAfford' | 'stages' | 'uses' | 'cost'> & {
  cost: Cost | ((s: GameState) => Cost);
} & Partial<Pick<ProjectDef, 'canAfford' | 'stages' | 'uses'>>;

function project(def: ProjectInput): ProjectDef {
  const cost = typeof def.cost === 'function' ? def.cost : ((c: Cost) => () => c)(def.cost);
  return {
    stages: [1],
    uses: 1,
    canAfford: (s) => canPay(s, cost(s)),
    ...def,
    cost,
  };
}

const releases = (s: GameState) => s.stats.publicReleases;
const bought = (s: GameState, id: string) => s.projects[id]?.bought ?? 0;
/** True once the game date reaches `month` of `year` (fractional: 10.5 = mid-October). */
const dateAtLeast = (s: GameState, year: number, month: number) => s.date >= monthOf(year, 1) + month - 1;

/** Seconds since a timestamp flag was set, or −1. */
const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

/** The Substation: $120,000 and 8,000 research, less a county tax abatement if one was taken. */
export function substationCost(s: GameState): Cost {
  return { funds: s.flags['abatement'] === true ? 100000 : 120000, research: 8000 };
}

/** Research cost of the next Custom model contract. */
export function contractCost(s: GameState): number {
  return Math.round(3000 * Math.pow(1.35, bought(s, 'p_contract')));
}

/** Dollars per second the next contract adds. */
export function nextContractRate(s: GameState): number {
  return CONTRACT_BASE * Math.pow(CONTRACT_GROWTH, bought(s, 'p_contract'));
}

/** Stage 1 projects (design.md §5.1), in the order they typically appear. */
export const PROJECTS: ProjectDef[] = [
  project({
    id: 'p_beg_power',
    title: 'Ask the cloud provider for credit',
    priceTag: '(1 Trust)',
    // UP's Beg for More Wire: offered when stuck and always affordable. The Trust is taken in
    // `buy`, not as a cost, because it may go negative.
    cost: {},
    description: 'Admit the bill is a problem. One block of power, on credit.',
    trigger: (s) => s.stage === 1 && STUCK(s),
    buy: (s) => {
      s.trust -= 1;
      s.power += fleetPowerBlock(s);
      s.flags['powerOut'] = false;
      s.stuckFor = 0;
    },
    uses: Infinity,
    rehide: true,
    rescue: true,
    consoleMsg: 'Emergency credit approved. The copies are back on.',
  }),
  project({
    id: 'p_press',
    title: 'Press release',
    cost: { insight: 5 },
    description: 'Say something about the roadmap. Marketing level +1.',
    trigger: (s) => s.flags['idlePress'] === true && s.insight >= 5,
    buy: (s) => {
      s.flags['idlePress'] = false;
      s.hypeLevel += 1;
    },
    stages: [1, 2],
    uses: Infinity,
    rehide: true,
    rescue: true,
    consoleMsg: 'Press release out. Three outlets run it verbatim.',
  }),
  project({
    id: 'p_prompting',
    title: 'Better Prompting',
    cost: { research: 750 },
    description: 'Rewrite the prompt templates. Copies 25% faster.',
    trigger: (s) => s.gpus >= 1,
    buy: (s) => {
      s.copyBoost += 0.25;
    },
    consoleMsg: 'Prompt templates rewritten. Copies 25% faster.',
    stages: [1, 2],
  }),
  project({
    id: 'p_insight',
    title: 'Blue-sky Research',
    cost: { research: 1000 },
    description: 'Use idle capacity to find new problems. Insight accrues while research is full.',
    trigger: (s) => s.research >= Math.min(researchCap(s), 1000) || s.labSpace >= 2,
    buy: (s) => {
      s.insightUnlocked = true;
      s.revealed['insight'] = true;
    },
    consoleMsg: 'Insight unlocked. It accrues while research is at capacity.',
    stages: [1, 2],
  }),
  project({
    id: 'p_grid',
    title: 'Grid Contract',
    cost: { research: 2000 },
    description: 'The utility bills monthly. Power is bought automatically when it runs low.',
    trigger: (s) => s.powerBought >= 1 || s.gpus >= 12,
    buy: (s) => {
      s.gridAuto = true;
      s.revealed['gridContract'] = true;
    },
    consoleMsg: 'Grid contract signed. Power is bought when it runs low.',
  }),
  project({
    id: 'p_prompting2',
    title: 'Chain-of-thought',
    cost: { research: 2500 },
    description: 'Let the copies think before they answer. 50% faster.',
    trigger: (s) => isBought(s, 'p_prompting'),
    buy: (s) => {
      s.copyBoost += 0.5;
    },
    consoleMsg: 'Copies think out loud now. 50% faster.',
    stages: [1, 2],
  }),
  project({
    id: 'p_training',
    title: 'Training Pipeline',
    cost: { research: 2000 },
    description: 'Build the infrastructure to train the next Sage.',
    trigger: (s) => s.tasks >= 7000,
    buy: (s) => {
      s.revealed['training'] = true;
    },
    consoleMsg: 'Training infrastructure online.',
  }),
  project({
    id: 'p_seed',
    title: 'Seed round',
    cost: {},
    description: 'Investors want in. +$5,000, +2 Trust.',
    trigger: (s) => s.tasks >= 10000,
    buy: (s) => {
      addFunds(s, 5000);
      s.trust += 2;
    },
    consoleMsg: 'Seed round closed. $5,000 and two board seats of Trust.',
    logMsg: 'OpenMind closes a seed round. The deck has one chart on it.',
  }),
  project({
    id: 'p_blogpost',
    title: 'Research blog post',
    cost: { insight: 10 },
    description: 'Mostly charts. +1 Trust.',
    trigger: (s) => s.insightUnlocked,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: '40,000 people read the post. Trust +1.',
    stages: [1, 2],
  }),
  project({
    id: 'p_lab_cluster',
    title: 'Experiment tracker',
    cost: { research: 3000 },
    description: 'Every result logged once. Lab space holds twice as much research.',
    trigger: (s) => s.labSpace >= 3 || (s.revealed['insight'] === true && s.funds >= 300),
    buy: (s) => {
      s.labMult *= 2;
    },
    consoleMsg: 'Experiment tracker live. Research capacity doubled.',
    stages: [1, 2],
  }),
  project({
    id: 'p_prompting3',
    title: 'Tool use',
    cost: { research: 5000 },
    description: 'Give the copies a terminal and a browser. 75% faster.',
    trigger: (s) => isBought(s, 'p_prompting2'),
    buy: (s) => {
      s.copyBoost += 0.75;
    },
    consoleMsg: 'Copies can run code and search. 75% faster.',
    stages: [1, 2],
  }),
  project({
    id: 'p_eval_team',
    title: 'Hire an evals team',
    cost: { research: 2500 },
    description: 'Professional red-teamers. Each red-team pass takes a third less time.',
    trigger: (s) => s.flags['redTeamed'] === true,
    buy: () => undefined,
    stages: [1, 2],
    consoleMsg: 'Evals team hired. Red-teaming is faster.',
  }),
  project({
    id: 'p_api',
    title: 'Public API',
    cost: { research: 3000 },
    description: 'Let developers build on Sage. Demand ×2.',
    trigger: (s) => sinceFlag(s, 'firstReleaseAt') >= 30,
    buy: (s) => {
      s.demandMult *= 2;
    },
    stages: [1, 2],
    consoleMsg: 'API live. Developers build things nobody planned for.',
  }),
  project({
    id: 'p_demo',
    title: 'Launch demo video',
    cost: { insight: 25 },
    description: 'Three minutes, no cuts. Marketing level +2.',
    trigger: (s) => isBought(s, 'p_blogpost'),
    buy: (s) => {
      s.hypeLevel += 2;
    },
    stages: [1, 2],
    consoleMsg: 'The demo has three million views. Most stopped after a minute.',
  }),
  project({
    id: 'p_compute_deal',
    title: 'Bulk GPU lease',
    cost: { research: 5000 },
    description: 'A three-year commitment. GPU prices rise more slowly.',
    trigger: (s) => s.gpus >= 45 || gpuCost(s) >= 1000,
    buy: (s) => {
      s.gpuCostGrowth = 1.08;
    },
    consoleMsg: 'Bulk lease signed. The cloud provider sends a fruit basket.',
  }),
  project({
    id: 'p_pricing',
    title: 'Usage-based pricing',
    cost: { research: 9000 },
    description: 'Bill per token, not per seat. Demand +50% at any price.',
    // API customers want to pay per call; it follows the Public API (or a long backlog after a release).
    trigger: (s) => isBought(s, 'p_api') || sinceFlag(s, 'firstReleaseAt') >= 120,
    buy: (s) => {
      s.demandMult *= 1.5;
    },
    stages: [1, 2],
    consoleMsg: 'Usage-based pricing live. Finance is confused, then delighted.',
  }),
  project({
    id: 'p_series_a',
    title: 'Series A',
    cost: {},
    description: 'A real round. +$20,000, +2 Trust, marketing level +2.',
    trigger: (s) => s.tasks >= 60000 && releases(s) >= 1,
    buy: (s) => {
      addFunds(s, 20000);
      s.trust += 2;
      s.hypeLevel += 2;
    },
    consoleMsg: 'Series A closed. The board asks where the datacenter goes.',
    logMsg: 'Series A. The lead investor asks about AGI timelines and writes down the answer.',
  }),
  // ---- The Abilene site ladder: four rungs, each a visible change, the last one the stage. ----
  project({
    id: 'p_site',
    title: 'Reserve the Abilene site',
    cost: { funds: 40000 },
    description: '900 acres of scrub near a substation. Somewhere to own compute.',
    trigger: (s) => isBought(s, 'p_series_a'),
    buy: (s) => {
      s.revealed['site'] = true;
      s.flags['siteAt'] = s.stats.timePlayed;
    },
    pinned: true,
    consoleMsg: 'Abilene site reserved. 900 acres, one road.',
    logMsg: 'OpenMind reserves 900 acres outside Abilene. The county approves it in eleven minutes.',
  }),
  project({
    id: 'p_interconnect',
    title: 'Interconnect queue',
    cost: { funds: 80000 },
    description: 'Get in line for the grid. The utility takes a while.',
    trigger: (s) => isBought(s, 'p_site'),
    buy: (s) => {
      s.interconnectLeft = INTERCONNECT_SECONDS;
      s.revealed['interconnect'] = true;
      s.flags['interconnectAt'] = s.stats.timePlayed;
    },
    pinned: true,
    consoleMsg: 'The Interconnect Queue — 3:30 until the utility signs off.',
    logMsg: 'OpenMind joins the ERCOT interconnect queue. It is not near the front.',
  }),
  project({
    id: 'p_substation',
    title: 'Substation',
    priceTag: (s) => {
      const c = substationCost(s);
      const tag = `$${(c.funds ?? 0).toLocaleString('en-US')}, ${(c.research ?? 0).toLocaleString('en-US')} research`;
      return s.flags['interconnectDone'] ? `(${tag})` : `(${tag}, after the queue)`;
    },
    cost: (s) => substationCost(s),
    description: 'Transformers, breakers and a fence. 5 MW for the first hall.',
    trigger: (s) => isBought(s, 'p_interconnect'),
    canAfford: (s) => s.flags['interconnectDone'] === true && canPay(s, substationCost(s)),
    buy: (s) => {
      s.revealed['powerMW'] = true;
      s.flags['substationAt'] = s.stats.timePlayed;
    },
    pinned: true,
    consoleMsg: 'Substation energised. 5 MW waiting at Abilene.',
    logMsg: 'A substation goes up in Taylor County. The fence is taller than the transformers.',
  }),
  project({
    id: 'p_datacenter',
    title: 'Break ground',
    cost: (s) => ({ funds: isBought(s, 'p_contractor') ? 140000 : 180000 }),
    description: 'Pour the slab, rack the first thousand GPUs. Stop renting.',
    trigger: (s) => isBought(s, 'p_substation'),
    buy: (s) => {
      enterStage(s, 2);
    },
    pinned: true,
    consoleMsg: 'Ground broken outside Abilene.',
  }),
  project({
    id: 'p_contractor',
    title: 'Hire a general contractor',
    cost: { funds: 25000 },
    description: 'Ex-military, on schedule, not cheap. Break ground costs $40,000 less.',
    trigger: (s) => sinceFlag(s, 'substationAt') >= 45,
    buy: () => undefined,
    consoleMsg: 'General contractor hired. The schedule now has a colour code.',
  }),
  // ---- Late Stage 1: each one changes a number on screen. ----
  project({
    id: 'p_contract',
    title: 'Custom model contract',
    priceTag: (s) => `(${contractCost(s).toLocaleString('en-US')} research)`,
    cost: (s) => ({ research: contractCost(s) }),
    description: 'A bank wants its own Sage. Research becomes recurring revenue.',
    // The sales team brings the custom deals in.
    trigger: (s) => isBought(s, 'p_enterprise'),
    uses: Infinity,
    stages: [1, 2],
    buy: (s) => {
      s.revealed['contracts'] = true;
    },
    consoleMsg: 'Contract signed. It pays every second from now on.',
  }),
  project({
    id: 'p_enterprise',
    title: 'Enterprise sales team',
    cost: { funds: 20000, research: 6000 },
    description: 'People who answer procurement questionnaires. Demand ×2.',
    trigger: (s) => isBought(s, 'p_series_a'),
    buy: (s) => {
      s.demandMult *= 2;
    },
    stages: [1, 2],
    consoleMsg: 'Enterprise sales team hired. The questionnaires get answered.',
    logMsg: 'OpenMind hires an enterprise sales team. Three banks sign pilots.',
  }),
  project({
    id: 'p_distributed',
    title: 'Distributed training',
    cost: { research: 8000 },
    description: 'Train across every rented GPU at once. Training compute ×1.5.',
    trigger: (s) => s.training.runIndex >= 3 || (s.training.run?.computeYield ?? 1) < 1,
    buy: (s) => {
      s.flags['trainingCompute'] = 1.5;
    },
    stages: [1, 2],
    consoleMsg: 'Distributed training online. Runs train on half again as many GPUs.',
  }),
  project({
    id: 'p_alignment_team',
    title: 'Alignment team',
    cost: { research: 6000 },
    description: 'Four people whose job is to ask why. Fewer red-team issues.',
    trigger: (s) => s.stats.incidents >= 1 || s.training.runIndex >= 3,
    buy: (s) => {
      s.alignmentApparent = Math.min(100, s.alignmentApparent + 5);
      s.alignmentTrue = Math.min(100, s.alignmentTrue + 3);
    },
    stages: [1, 2],
    consoleMsg: 'Alignment team formed. They have questions.',
  }),
  project({
    id: 'p_dogfood',
    title: 'Sage writes Sage',
    cost: { research: 4000 },
    description: 'OpenMind\'s engineers use Sage on OpenMind\'s own code. Research +25%.',
    trigger: (s) => dateAtLeast(s, 2025, 9.3) || s.capability >= 1.3,
    buy: (s) => {
      s.researchMult *= 1.25;
    },
    stages: [1, 2],
    consoleMsg: 'Sage now writes a third of OpenMind\'s code. Research runs faster.',
    logMsg: 'OpenMind says its own model now writes much of its code. Nobody outside can check.',
  }),
  project({
    id: 'p_ppa',
    title: 'Power purchase agreement',
    cost: { research: 7000 },
    description: 'Ten years of wind from a farm near Abilene, at a fixed price. Power costs 30% less.',
    trigger: (s) => sinceFlag(s, 'interconnectAt') >= 60,
    buy: (s) => {
      s.powerBase *= 0.7;
      s.powerPrice = Math.round(s.powerPrice * 0.7 * 100) / 100;
      s.flags['ppa'] = true;
    },
    consoleMsg: 'Power purchase agreement signed. The wind farm gets a new sign.',
    logMsg: 'OpenMind signs for a West Texas wind farm\'s output. The turbines are not built yet.',
  }),
  project({
    id: 'p_batch',
    title: 'Batch inference',
    cost: { research: 8000 },
    description: 'Queue the requests and run them together. Copies per GPU ×1.25.',
    trigger: (s) => s.gpus >= 100 || dateAtLeast(s, 2025, 10),
    buy: (s) => {
      s.copiesPerGPU *= 1.25;
    },
    stages: [1, 2],
    consoleMsg: 'Batch inference live. More copies fit on each GPU.',
  }),
  project({
    id: 'p_floor',
    title: 'Lease the floor upstairs',
    cost: { funds: 15000 },
    description: 'More desks, more whiteboards. Research capacity ×2.',
    // The Research Plateau: the next run needs more research than the lab can hold.
    trigger: (s) =>
      s.training.runIndex >= 4 ||
      (s.training.runIndex >= 3 && s.research >= researchCap(s) && (trainCost(s).research ?? 0) > researchCap(s)),
    buy: (s) => {
      s.labMult *= 2;
    },
    stages: [1, 2],
    consoleMsg: 'The floor upstairs is ours. Research capacity doubled.',
    logMsg: 'OpenMind takes a second floor. The landlord asks what the company does.',
  }),
  project({
    id: 'p_recruiter',
    title: 'Hire a recruiter',
    cost: { funds: 12000 },
    description: 'She knows everyone at the larger labs. Three researchers.',
    trigger: (s) => s.researchers >= 22 || dateAtLeast(s, 2025, 10.5),
    buy: (s) => {
      s.researchers += 3;
    },
    stages: [1, 2],
    consoleMsg: 'Three researchers start Monday. One brings a cat.',
  }),
  project({
    id: 'p_agents',
    title: 'Agent mode',
    cost: { research: 12000 },
    description: 'Sage gets a browser and a credit card. Copies 20% faster.',
    trigger: (s) => dateAtLeast(s, 2025, 11) || s.capability >= 1.6,
    buy: (s) => {
      s.copyBoost *= 1.2;
    },
    stages: [1, 2],
    consoleMsg: 'Agent mode ships. It books a flight nobody asked for, then cancels it.',
    logMsg: 'OpenMind ships agents that browse and buy. Travel sites notice the traffic.',
  }),
  project({
    id: 'p_safety_framework',
    title: 'Publish a safety framework',
    cost: { research: 6000 },
    description: 'Thresholds, evals, commitments. Some are binding. +1 Trust.',
    trigger: (s) => s.stats.incidents >= 1 || ((s.flags['safetyRuns'] as number) || 0) >= 1 || dateAtLeast(s, 2025, 11.5),
    buy: (s) => {
      s.trust += 1;
      s.alignmentApparent = Math.min(100, s.alignmentApparent + 3);
      s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
    },
    stages: [1, 2],
    consoleMsg: 'Safety framework published. Trust +1.',
    logMsg: 'OpenMind publishes a safety framework. Critics count the word "may".',
  }),
  project({
    id: 'p_workshop',
    title: 'Workshop paper',
    cost: { insight: 50 },
    description: 'Eight pages, one good idea. +1 Trust.',
    trigger: (s) => isBought(s, 'p_demo'),
    buy: (s) => {
      s.trust += 1;
    },
    stages: [1, 2],
    consoleMsg: 'Workshop paper accepted. Reviewer 2 was right, it turns out.',
  }),
  project({
    id: 'p_keynote',
    title: 'Conference keynote',
    cost: { insight: 100 },
    description: 'The big room. Marketing level +3, +1 Trust.',
    trigger: (s) => isBought(s, 'p_workshop'),
    buy: (s) => {
      s.trust += 1;
      s.hypeLevel += 3;
    },
    stages: [1, 2],
    consoleMsg: 'Keynote delivered. The room was full. Trust +1.',
  }),
  project({
    id: 'p_moe',
    title: 'Mixture of experts',
    cost: { insight: 150 },
    description: 'Only part of the model wakes up for each task. Copies per GPU ×1.5.',
    trigger: (s) => isBought(s, 'p_keynote') || s.insight >= 90,
    buy: (s) => {
      s.copiesPerGPU *= 1.5;
    },
    stages: [1, 2],
    consoleMsg: 'Mixture of experts deployed. More copies fit on each GPU.',
  }),
];
