import { GameState, Cost, canPay, isBought, addFunds } from '../engine/state.js';
import { enterStage } from '../engine/stages.js';
import { researchCap, gpuCost } from '../engine/economy.js';

/**
 * One row of the project table. `trigger` decides when the button appears (always before it is
 * affordable, except the insight ladder where trigger == cost); `canAfford` greys it out;
 * `buy` applies the effect after the cost has been paid.
 */
export interface ProjectDef {
  id: string;
  title: string;
  /** Overrides the generated `(cost)` label. */
  priceTag?: string | ((s: GameState) => string);
  description: string;
  /** Stages in which the project can appear and be bought. */
  stages: number[];
  cost: (s: GameState) => Cost;
  trigger: (s: GameState) => boolean;
  canAfford: (s: GameState) => boolean;
  buy: (s: GameState) => void;
  /** How many times it can be bought before it disappears. */
  uses: number;
  /** Hide again after each purchase until the trigger fires again (repeatable rescues). */
  rehide?: boolean;
  /** Rescue projects ignore the visible-project cap. */
  rescue?: boolean;
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

/** Stage 1 projects (design.md §5.1), in the order they typically appear. */
export const PROJECTS: ProjectDef[] = [
  project({
    id: 'p_beg_power',
    title: 'Ask the cloud provider for credit',
    cost: { trust: 1 },
    description: 'Admit the bill is a problem. 1,000 kWh.',
    trigger: (s) => s.stage === 1 && s.power < 1 && s.funds < s.powerPrice && s.unbilled < 1,
    buy: (s) => {
      s.power += 1000;
      s.flags['powerOut'] = false;
    },
    uses: Infinity,
    rehide: true,
    rescue: true,
    consoleMsg: 'Emergency credit approved. 1,000 kWh.',
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
  }),
  project({
    id: 'p_insight',
    title: 'Blue-sky Research',
    cost: { research: 1000 },
    description: 'Use idle capacity to generate new problems and new solutions.',
    trigger: (s) => s.research >= Math.min(researchCap(s), 1000),
    buy: (s) => {
      s.insightUnlocked = true;
      s.revealed['insight'] = true;
    },
    consoleMsg: 'Insight unlocked (accrues while research is at capacity).',
  }),
  project({
    id: 'p_blogpost',
    title: 'Research blog post',
    cost: { insight: 10 },
    description: 'Mostly charts. +1 Trust.',
    trigger: (s) => s.insightUnlocked && s.insight >= 10,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: '40,000 people read the post. Trust increased.',
  }),
  project({
    id: 'p_training',
    title: 'Training Pipeline',
    cost: { research: 2000, funds: 500 },
    description: 'Build the infrastructure to train the next Sage.',
    trigger: (s) => s.tasks >= 10000,
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
    consoleMsg: 'Seed round closed. The board wants a plan.',
    logMsg: 'OpenMind closes a seed round. The deck has one chart on it.',
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
  }),
  project({
    id: 'p_demo',
    title: 'Launch demo video',
    cost: { insight: 25 },
    description: 'Three minutes, no cuts. Marketing level +2.',
    trigger: (s) => isBought(s, 'p_blogpost') && s.insight >= 25,
    buy: (s) => {
      s.hypeLevel += 2;
    },
    consoleMsg: 'The demo has 3 million views. Most stopped after a minute.',
  }),
  project({
    id: 'p_eval_team',
    title: 'Hire an evals team',
    cost: { insight: 5, funds: 1000 },
    description: 'Professional red-teamers. Red-team 12 s → 8 s.',
    trigger: (s) => s.flags['redTeamed'] === true,
    buy: () => undefined,
    consoleMsg: 'Evals team hired. Red-teaming is faster.',
  }),
  project({
    id: 'p_lab_cluster',
    title: 'Experiment tracker',
    cost: { research: 3000, funds: 1500 },
    description: 'Every result logged once. Lab space holds twice as much research.',
    trigger: (s) => s.labSpace >= 3 || (s.revealed['insight'] === true && s.funds >= 300),
    buy: (s) => {
      s.labMult *= 2;
    },
    consoleMsg: 'Experiment tracker live. Research capacity doubled.',
  }),
  project({
    id: 'p_api',
    title: 'Public API',
    cost: { research: 3000 },
    description: 'Let developers build on Sage. Demand ×1.5.',
    trigger: (s) => releases(s) >= 1,
    buy: (s) => {
      s.demandMult *= 1.5;
      s.apiCustomers = 40;
      s.revealed['apiCustomers'] = true;
    },
    consoleMsg: 'API live. Developers build things nobody planned for.',
  }),
  project({
    id: 'p_workshop',
    title: 'Workshop paper',
    cost: { insight: 50 },
    description: 'Eight pages, one good idea. +1 Trust.',
    trigger: (s) => isBought(s, 'p_demo') && s.insight >= 50,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: 'Workshop paper accepted. Reviewer 2 was right, it turns out.',
  }),
  project({
    id: 'p_grid',
    title: 'Grid Contract',
    cost: { research: 7000 },
    description: 'Buy power automatically when it runs out.',
    trigger: (s) => s.funds > 100 && s.powerBought >= 5,
    buy: (s) => {
      s.gridAuto = true;
      s.revealed['gridContract'] = true;
    },
    consoleMsg: 'Grid contract signed. Power is bought when it runs out.',
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
  }),
  project({
    id: 'p_keynote',
    title: 'Conference keynote',
    cost: { insight: 100 },
    description: 'The big room. Marketing level +3, +1 Trust.',
    trigger: (s) => isBought(s, 'p_workshop') && s.insight >= 100,
    buy: (s) => {
      s.trust += 1;
      s.hypeLevel += 3;
    },
    consoleMsg: 'Keynote delivered. The room was full. Trust increased.',
  }),
  project({
    id: 'p_compute_deal',
    title: 'Bulk GPU lease',
    cost: { research: 8000, funds: 2000 },
    description: 'A three-year commitment. GPU prices rise more slowly.',
    trigger: (s) => s.gpus >= 50 || gpuCost(s) >= 2000,
    buy: (s) => {
      s.gpuCostGrowth = 1.08;
    },
    consoleMsg: 'Bulk lease signed. The cloud provider sends a fruit basket.',
  }),
  project({
    id: 'p_pricing',
    title: 'Usage-based pricing',
    cost: { research: 12000 },
    description: 'Bill per token, not per seat. Demand +30% at any price.',
    trigger: (s) => s.stats.revPerSec > 10 || (s.unbilled > 2000 && s.unbilled > 10 * Math.max(1, s.stats.soldPerSec)),
    buy: (s) => {
      s.demandMult *= 1.3;
    },
    consoleMsg: 'Usage-based pricing live. Finance is confused, then delighted.',
  }),
  project({
    id: 'p_series_a',
    title: 'Series A',
    cost: {},
    description: 'A real round. +$100,000, +4 Trust, marketing level +3.',
    trigger: (s) => s.tasks >= 100000 && releases(s) >= 1,
    buy: (s) => {
      addFunds(s, 100000);
      s.trust += 4;
      s.hypeLevel += 3;
    },
    consoleMsg: 'Series A closed. $100,000 in the bank.',
    logMsg: 'Series A. The lead investor asks about AGI timelines and writes down the answer.',
  }),
  project({
    id: 'p_contract',
    title: 'Custom model contract',
    cost: (s) => ({ research: Math.round(3000 * 1.35 ** (s.projects['p_contract']?.bought ?? 0)) }),
    description: 'A bank wants its own Sage. Research becomes revenue; each contract pays more.',
    trigger: (s) => isBought(s, 'p_series_a') && s.research >= 3000 * 1.35 ** (s.projects['p_contract']?.bought ?? 0),
    uses: Infinity,
    rehide: true,
    buy: (s) => {
      addFunds(s, Math.round(6000 * 1.3 ** ((s.projects['p_contract']?.bought ?? 1) - 1)));
    },
    consoleMsg: 'Contract signed. The fine-tune ships next week.',
  }),
  project({
    id: 'p_enterprise',
    title: 'Enterprise sales team',
    cost: { funds: 20000, research: 6000 },
    description: 'People who answer procurement questionnaires. Demand ×1.5.',
    trigger: (s) => isBought(s, 'p_series_a'),
    buy: (s) => {
      s.demandMult *= 1.5;
    },
    consoleMsg: 'Enterprise sales team hired. The questionnaires get answered.',
    logMsg: 'OpenMind hires an enterprise sales team. Three banks sign pilots.',
  }),
  project({
    id: 'p_alignment_team',
    title: 'Alignment team',
    cost: { research: 5000, insight: 25 },
    description: 'Four people whose job is to ask why. Fewer red-team issues.',
    trigger: (s) => s.stats.incidents >= 1 || s.training.runIndex >= 3,
    buy: (s) => {
      s.alignmentApparent = Math.min(100, s.alignmentApparent + 5);
      s.alignmentTrue = Math.min(100, s.alignmentTrue + 3);
    },
    consoleMsg: 'Alignment team formed. They have questions.',
  }),
  project({
    id: 'p_distributed',
    title: 'Distributed training',
    cost: { funds: 15000, research: 10000 },
    description: 'Train across every rented GPU at once. Training compute ×2.',
    trigger: (s) => s.training.runIndex >= 3 || (s.training.run?.computeYield ?? 1) < 1,
    buy: (s) => {
      s.flags['trainingCompute'] = 2;
    },
    consoleMsg: 'Distributed training online. Runs need half the GPUs.',
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
    consoleMsg: 'Mixture of experts deployed. More copies fit on each GPU.',
  }),
  project({
    id: 'p_datacenter',
    title: 'First Datacenter',
    cost: { funds: 250000, research: 18000 },
    description: 'Stop renting. Own the compute, and the power bill.',
    trigger: (s) => s.tasks >= 300000,
    buy: (s) => {
      enterStage(s, 2);
    },
  }),
];
