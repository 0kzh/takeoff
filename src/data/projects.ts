import { GameState, Cost, canPay, isBought, addFunds, say, counter } from '../engine/state.js';
import { enterStage, STUCK } from '../engine/stages.js';
import {
  researchCap, gpuCost, fleetPowerBlock, atRentQuota, bestCapability, INTERCONNECT_SECONDS, CONTRACT_BASE, CONTRACT_GROWTH,
} from '../engine/economy.js';
import { atPlateau, plateauSeconds, trainCost, researchFor, startCapability } from '../engine/training.js';
import { monthOf, fmtMoneyShort, fmtNum } from '../engine/format.js';
import { s2, applyBehindTheMeter, gpuCapacity } from '../engine/infrastructure.js';
import { moveGov, moveLead, dataShort, dataShortSeconds, capWall } from '../engine/world.js';

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
  /** While this holds, the project skips the drip queue and the cap (the named fix for a wall). */
  urgent?: (s: GameState) => boolean;
  /** The direct consequence of a purchase (the next step of a ladder): appears at once when there is room. */
  chain?: boolean;
  /** When this holds the offer has lapsed: it leaves the screen unbought. */
  expires?: (s: GameState) => boolean;
  /** A side-offer of the stage goal (the Abilene extras): drips in, but never fills the cap. */
  sideline?: boolean;
  /**
   * Stage 2 approach items (stage2.md §4.1): cannot appear before the best model reaches 3×, and
   * the late drip releases at most one every 75 s, so the tail of the stage cannot run dry.
   */
  late?: boolean;
  /** The hard condition the cadence governor respects when it reveals the row ignoring its trigger. */
  prereq?: (s: GameState) => boolean;
  /** Runs when the project first appears (a console line that sets up the offer). */
  onShow?: (s: GameState) => void;
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
  return { funds: isBought(s, 'p_abatement') || s.flags['abatement'] === true ? 100000 : 120000, research: 8000 };
}

/** Each desk lease costs twice the last: $1,000, $2,000, $4,000 … */
export function deskCost(s: GameState): number {
  return 1000 * Math.pow(2, bought(s, 'p_desks'));
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
    id: 'p_desks',
    title: 'Rent desks across the street',
    priceTag: (s) => `($${deskCost(s).toLocaleString('en-US')})`,
    cost: (s) => ({ funds: deskCost(s) }),
    description: 'Two more lab spaces, a short walk away. Each lease costs twice the last.',
    // The plateau's last-resort fix: no Trust for Expand Lab and nothing else on screen raises the cap.
    trigger: (s) => s.stage === 1 && plateauSeconds(s) >= 45 && s.trust < 1,
    buy: (s) => {
      s.labSpace += 2;
    },
    uses: Infinity,
    rehide: true,
    rescue: true,
    consoleMsg: 'Desks rented across the street. The lab holds more.',
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
    chain: true,
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
    consoleMsg: 'Forty thousand people read the post. Trust +1.',
    stages: [1, 2],
  }),
  project({
    id: 'p_lab_cluster',
    title: 'Experiment tracker',
    cost: { research: 3000 },
    description: 'Every result logged once. Lab space holds twice as much research.',
    trigger: (s) => s.labSpace >= 3 || (s.revealed['insight'] === true && s.funds >= 300) || atPlateau(s),
    urgent: atPlateau,
    buy: (s) => {
      s.labMult *= 2;
    },
    consoleMsg: 'Experiment tracker live. Research capacity doubled.',
    stages: [1, 2],
  }),
  project({
    id: 'p_prompting3',
    chain: true,
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
    chain: true,
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
    description: 'A three-year commitment: twenty more GPUs on the quota, and prices rise more slowly.',
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
    description: 'Nine hundred acres of scrub near a substation. Somewhere to own compute.',
    // After the Series A, or as soon as the provider runs out of G4s to rent (the named fix).
    trigger: (s) => isBought(s, 'p_series_a') || atRentQuota(s),
    buy: (s) => {
      s.revealed['site'] = true;
      s.flags['siteAt'] = s.stats.timePlayed;
    },
    pinned: true,
    consoleMsg: 'Abilene site reserved. Nine hundred acres, one road.',
    logMsg: 'OpenMind reserves nine hundred acres outside Abilene. The county approves it in eleven minutes.',
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
    cost: (s) => ({ funds: isBought(s, 'p_contractor') ? 125000 : 165000 }),
    description: 'Pour the slab, rack the first thousand GPUs. Stop renting.',
    trigger: (s) => isBought(s, 'p_substation'),
    buy: (s) => {
      enterStage(s, 2);
    },
    pinned: true,
  }),
  project({
    id: 'p_cooling',
    sideline: true,
    title: 'Closed-loop cooling',
    cost: { funds: 10000 },
    description: 'Abilene is dry most of the year. Cool the halls without the town\'s water. +1 Trust.',
    trigger: (s) => sinceFlag(s, 'siteAt') >= 30,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: 'Closed-loop cooling it is. The county commissioner shakes every hand. Trust +1.',
    logMsg: 'OpenMind will cool its Abilene site with a closed loop. The aquifer is spared.',
  }),
  project({
    id: 'p_expedite',
    sideline: true,
    title: 'Pay to expedite the interconnect',
    cost: { funds: 15000 },
    description: 'The utility has a fast lane. It is called a deposit. One minute off the queue.',
    trigger: (s) => s.interconnectLeft > 5 && sinceFlag(s, 'interconnectAt') >= 25,
    canAfford: (s) => s.interconnectLeft > 5 && canPay(s, { funds: 15000 }),
    expires: (s) => s.interconnectLeft <= 5,
    buy: (s) => {
      s.interconnectLeft = Math.max(1, s.interconnectLeft - 60);
    },
    consoleMsg: 'Fee paid. The interconnect study moves up a page.',
  }),
  project({
    id: 'p_soundwall',
    sideline: true,
    title: 'Build a sound wall',
    cost: { funds: 5000 },
    description: 'Painted the colour of the sky, so the rancher next door can sleep. +1 Trust.',
    trigger: (s) => sinceFlag(s, 'substationAt') >= 100,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: 'Sound wall up. The cattle sleep again. Trust +1.',
  }),
  project({
    id: 'p_abatement',
    sideline: true,
    title: 'Take the county\'s tax abatement',
    cost: {},
    description: 'Promise Abilene two hundred jobs. The substation costs $20,000 less.',
    trigger: (s) => s.flags['interconnectDone'] === true && !isBought(s, 'p_substation'),
    expires: (s) => isBought(s, 'p_substation'),
    buy: () => undefined,
    consoleMsg: 'Abatement signed. Two hundred jobs promised; the building needs about thirty.',
    logMsg: 'OpenMind promises Abilene two hundred jobs. The datacenter will employ about thirty.',
  }),
  project({
    id: 'p_contractor',
    sideline: true,
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
    chain: true,
    title: 'Custom model contract',
    priceTag: (s) => `(${contractCost(s).toLocaleString('en-US')} research)`,
    cost: (s) => ({ research: contractCost(s) }),
    description: 'A bank wants its own Sage. Research becomes recurring revenue.',
    // The sales team brings the custom deals in.
    trigger: (s) => isBought(s, 'p_enterprise'),
    uses: Infinity,
    // A standing offer once it exists: it never takes a slot from something new.
    sideline: true,
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
    sideline: true,
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
    id: 'p_renewals',
    title: 'Renewal season',
    cost: { research: 6000 },
    description: 'Every contract comes up for renewal in December, at a higher price. Contracts pay 25% more.',
    trigger: (s) => s.revealed['contracts'] === true && (dateAtLeast(s, 2025, 12.1) || bought(s, 'p_contract') >= 6),
    buy: (s) => {
      s.flags['contractMult'] = 1.25;
    },
    consoleMsg: 'Renewals signed. Every contract pays a quarter more.',
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
    // The Research Plateau's named fix (or, late in the stage, room for the runs to come).
    trigger: (s) => s.training.runIndex >= 4 || atPlateau(s),
    urgent: atPlateau,
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
    chain: true,
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
    chain: true,
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
  ...stage2Projects(),
];

// ---------- Stage 2 (stage2.md §4.2): rows in table order; funds at scale 1 through s2() ----------

/** Seconds since Stage 2 began ("ts" in the spec). */
const ts = (s: GameState) => s.stats.timeInStage;
/** Releases in this stage, public or internal. */
const s2Releases = (s: GameState) => counter(s, 'releasesThisStage');
const best = (s: GameState) => bestCapability(s);
const inStage2 = (s: GameState) => s.stage === 2;
/** Licences signed for data: the publishers, the code hosts, the archives. */
const licences = (s: GameState) =>
  (s.flags['licensedPublishers'] === true ? 1 : 0) + (isBought(s, 'p_license_code') ? 1 : 0) + (isBought(s, 'p_license_archive') ? 1 : 0);

/** The AI research assistants price halves if a player is still without them at ts 900 (§8). */
export function assistantsCost(s: GameState): Cost {
  return { funds: s2(s.flags['assistantsHalf'] === true ? 75000 : 150000), insight: 15 };
}

/** Synthetic data costs half for a lab that declined to license ("write our own"). */
export function synthCost(s: GameState): Cost {
  const half = s.flags['synthHalf'] === true;
  return { research: half ? 100000 : 200000, insight: half ? 30 : 60 };
}

/** The exit needs a released model (public or internal) at 4.00× or more. */
export function exitReady(s: GameState): boolean {
  return s.flags['superhumanReleased'] === true;
}

function s2project(def: ProjectInput): ProjectDef {
  return project({ stages: [2], ...def });
}

function stage2Projects(): ProjectDef[] {
  return [
    s2project({
      id: 'p_beg_data',
      title: 'Take the university\'s corpus',
      priceTag: '(1 Trust)',
      cost: {},
      description: 'A university offers its corpus for a seat on the safety board. Exactly the data the next run lacks.',
      // The data rescue: short for 240 s with nothing affordable that adds data. Trust may go negative.
      trigger: (s) => inStage2(s) && dataShort(s) && dataShortSeconds(s) >= 240 && !dataSourceAffordable(s),
      buy: (s) => {
        s.trust -= 1;
        const need = trainCost(s).data ?? 0;
        s.data = Math.max(s.data, need);
        delete s.flags['dataShortSince'];
      },
      uses: Infinity,
      rehide: true,
      rescue: true,
      consoleMsg: 'A university offers its corpus for a seat on the safety board. Accepted.',
    }),
    s2project({
      id: 'p_research_cluster',
      title: 'Research cluster',
      cost: () => ({ funds: s2(60000) }),
      description: 'Racks of experiment servers in the new building. Research capacity ×4; insight trickles in below it.',
      trigger: (s) => capWall(s) || ts(s) >= 60,
      urgent: atPlateau,
      buy: (s) => {
        s.labMult *= 4;
      },
      consoleMsg: 'Research cluster online. The lab holds four times as much.',
    }),
    s2project({
      id: 'p_web_crawl',
      title: 'Web crawl',
      cost: { research: 4000 },
      description: 'Read the public internet, once. 15 T of training data at 0.1 T a second.',
      trigger: (s) => s.flags['dataEra'] === true || ts(s) >= 180,
      urgent: (s) => s.flags['dataEra'] === true,
      buy: (s) => {
        s.crawlLeft = 15;
        s.revealed['dataRow'] = true;
      },
      consoleMsg: 'Crawlers released. 15 trillion tokens of public web, once.',
      logMsg: 'OpenMind\'s crawler reads the public internet in an afternoon. Site owners notice the traffic.',
    }),
    s2project({
      id: 'p_ai_assistants',
      title: 'AI research assistants',
      cost: assistantsCost,
      description: 'Put copies of Sage on the research team. A slider decides how many.',
      trigger: (s) => s2Releases(s) >= 1 || researchSecondsAway(s) > 180,
      urgent: (s) => s.flags['assistantsHalf'] === true,
      buy: (s) => {
        s.researchAlloc = 0.15;
        s.revealed['allocation'] = true;
      },
      consoleMsg: 'Copies of Sage join the research team. They do not need desks.',
      logMsg: 'Research is 50% faster with the model in the loop. Nobody outside the building believes the number.',
    }),
    s2project({
      id: 'p_series_b',
      title: 'Series B',
      cost: {},
      priceTag: '(free)',
      description: 'Growth investors, finally. Money, three board seats of Trust, and a marketing push.',
      trigger: (s) => s.tasks >= 4000000 && s2Releases(s) >= 1,
      buy: (s) => {
        addFunds(s, s2(250000));
        s.trust += 3;
        s.hypeLevel += 2;
        say(s, `Series B closed. ${fmtMoneyShort(s2(250000))} and three new board seats.`);
      },
      logMsg: 'OpenMind raises a Series B. The deck now has two charts.',
    }),
    s2project({
      id: 'p_agent_platform',
      title: 'Agent platform',
      cost: () => ({ funds: s2(250000), research: 40000 }),
      description: 'Customers stop asking questions and start handing over jobs. Market ×1.6.',
      trigger: (s) => s2Releases(s) >= 1 && priceLowFor(s) >= 30,
      buy: (s) => {
        s.demandMult *= 1.6;
      },
      consoleMsg: 'Agent platform live. Market ×1.6.',
      logMsg: 'Companies stop asking Sage questions and start giving it jobs.',
    }),
    s2project({
      id: 'p_standing_order',
      title: 'Standing order',
      cost: { research: 30000 },
      description: 'A purchase order that renews itself. Lots arrive when there is room, power and money for the next run too.',
      trigger: (s) => s.gpuBatches >= 8,
      buy: (s) => {
        s.standingOrder = true;
        s.revealed['standingOrder'] = true;
      },
      consoleMsg: 'Standing order placed. GPUs arrive when there is room, power and cash.',
    }),
    s2project({
      id: 'p_scaffold',
      title: 'Agent scaffolding',
      cost: { research: 90000 },
      description: 'Planners, checkers, retries. Copies finish 25% more tasks.',
      trigger: (s) => s2Releases(s) >= 2,
      buy: (s) => {
        s.copyBoost *= 1.25;
      },
      stages: [2, 3],
      consoleMsg: 'Scaffolding shipped. Copies finish 25% more tasks.',
    }),
    s2project({
      id: 'p_exp_scheduler',
      title: 'Experiment scheduler',
      cost: () => ({ funds: s2(600000) }),
      description: 'Experiments queue themselves overnight. Research capacity ×4.',
      trigger: (s) => isBought(s, 'p_research_cluster') && capWall(s),
      prereq: (s) => isBought(s, 'p_research_cluster'),
      urgent: (s) => isBought(s, 'p_research_cluster') && atPlateau(s),
      buy: (s) => {
        s.labMult *= 4;
      },
      consoleMsg: 'Experiments queue themselves overnight. Research capacity ×4.',
    }),
    s2project({
      id: 'p_spec',
      title: 'Publish the Spec',
      cost: { research: 80000 },
      description: 'Write down what Sage should want, and publish it. Measured alignment and relations go up.',
      trigger: (s) => s2Releases(s) >= 3,
      buy: (s) => {
        s.alignmentApparent = Math.min(100, s.alignmentApparent + 6);
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
        moveGov(s, 3);
      },
      stages: [2, 3],
      consoleMsg: 'The Spec is public. 14,000 words on what Sage should want.',
      logMsg: 'OpenMind publishes the Spec. Commentators argue about paragraph nine.',
    }),
    s2project({
      id: 'p_auto_evals',
      title: 'Automated evals',
      cost: () => ({ research: 100000, funds: s2(250000) }),
      description: 'The model grades the model. Red-teaming takes half the time, and finds fewer issues to begin with.',
      trigger: (s) => s2Releases(s) >= 3 || counter(s, 'incidentsS2') >= 1,
      buy: (s) => {
        s.revealed['evalLine'] = true;
      },
      consoleMsg: 'Evals run themselves now. Red-teaming takes half the time.',
    }),
    s2project({
      id: 'p_sl2',
      title: 'Security level 2',
      cost: () => ({ funds: s2(300000) }),
      description: 'Background checks, badge readers, a locked server room. Holds against opportunists.',
      trigger: (s) => s.gpus >= 20000 || s.date >= monthOf(2026, 4),
      buy: (s) => {
        s.securityLevel = Math.max(2, s.securityLevel);
        s.revealed['security'] = true;
        moveLead(s, 0.5);
        moveGov(s, 2);
      },
      consoleMsg: 'Background checks, badge readers, a locked server room. SL2.',
      logMsg: 'Security review: "typical of a fast-growing tech company." SL2.',
    }),
    s2project({
      id: 'p_synth',
      title: 'Synthetic data',
      priceTag: (s) => `(${fmtNum(synthCost(s).research ?? 0, 0)} research, ${synthCost(s).insight} insight)`,
      cost: synthCost,
      description: 'Research copies write training data. The more copies on research, the faster it comes.',
      trigger: (s) => s.flags['publishersDone'] === true,
      prereq: (s) => isBought(s, 'p_ai_assistants'),
      buy: () => undefined,
      consoleMsg: 'Sage writes its own training data now. Nobody has read all of it.',
      logMsg: 'OpenMind trains on text its own models wrote. The papers call it a flywheel.',
    }),
    s2project({
      id: 'p_parallel',
      title: 'Parallel pipelines',
      cost: { research: 200000, insight: 120 },
      description: 'A second training pipeline: the next run starts while the last one is still in evaluation.',
      trigger: (s) => s2Releases(s) >= 4 && best(s) >= 2.2,
      prereq: (s) => s2Releases(s) >= 2,
      buy: () => undefined,
      consoleMsg: 'Second pipeline online. The next run can start before this one ships.',
    }),
    s2project({
      id: 'p_policy',
      title: 'Policy team',
      cost: () => ({ funds: s2(400000), trust: 2 }),
      description: 'Three former staffers and a rolodex. Relations +5, then a little every month.',
      trigger: (s) => s.revealed['government'] === true,
      prereq: (s) => s.revealed['government'] === true,
      urgent: (s) => s.revealed['government'] === true && s.govRelations < 30,
      buy: (s) => {
        moveGov(s, 5);
      },
      stages: [2, 3],
      consoleMsg: 'Policy team hired. Three former staffers and a rolodex.',
    }),
    s2project({
      id: 'p_license_code',
      title: 'License the code hosts',
      cost: () => ({ funds: s2(1500000) }),
      description: 'Every public repository, its history and its issues. +20 T of data.',
      trigger: (s) => s.flags['publishersDone'] === true && counter(s, 'dataShortCount') >= 2,
      prereq: (s) => s.flags['publishersDone'] === true,
      urgent: (s) => s.flags['publishersDone'] === true && dataShort(s),
      buy: (s) => {
        s.data += 20;
      },
      consoleMsg: 'Every public repository, licensed. +20 T.',
    }),
    s2project({
      id: 'p_brief',
      title: 'Brief the administration',
      cost: { research: 200000 },
      description: 'A windowless room, a deck, a model that answers questions. Relations +8.',
      trigger: (s) => isBought(s, 'p_policy'),
      prereq: (s) => s.revealed['government'] === true,
      urgent: (s) => s.revealed['government'] === true && s.govRelations < 30,
      buy: (s) => {
        moveGov(s, 8);
      },
      stages: [2, 3],
      consoleMsg: 'Briefing delivered in a windowless room. Relations improve.',
      logMsg: 'OpenMind briefs the National Security Council. The slides are collected afterwards.',
    }),
    s2project({
      id: 'p_memory',
      title: 'Long-horizon memory',
      cost: { research: 250000 },
      description: 'Copies remember what they did yesterday. They finish 25% more tasks.',
      trigger: (s) => s2Releases(s) >= 5 || best(s) >= 2.6,
      buy: (s) => {
        s.copyBoost *= 1.25;
      },
      stages: [2, 3],
      consoleMsg: 'Copies remember yesterday. A week\'s task now takes a night.',
    }),
    s2project({
      id: 'p_international',
      title: 'International launch',
      cost: () => ({ funds: s2(900000), research: 100000 }),
      description: 'Forty countries on the same day. Market ×1.6.',
      trigger: (s) => (counter(s, 'r0') > 0 && s.stats.revPerSec >= 28 * counter(s, 'r0')) || s.date >= monthOf(2026, 6),
      buy: (s) => {
        s.demandMult *= 1.6;
      },
      stages: [2, 3],
      consoleMsg: 'Sage launches in 40 countries. Market ×1.6.',
      logMsg: 'Sage launches in forty countries on the same day. Two ban it by Friday.',
    }),
    s2project({
      id: 'p_g5',
      title: 'Nimbus G5 order',
      cost: () => ({ funds: s2(1200000), research: 150000 }),
      description: 'Next year\'s chip, this year. New lots are G5s: half again the compute, and they get power first.',
      trigger: (s) => s.gpus >= 30000 || s.date >= monthOf(2026, 6),
      buy: (s) => {
        s.g5 = true;
      },
      consoleMsg: 'Nimbus G5s on order. Each does the work of one and a half G4s.',
      logMsg: 'Formosa Fab\'s entire Nimbus G5 run is sold before it is etched.',
    }),
    s2project({
      id: 'p_free_tier',
      title: 'Free tier for students',
      cost: () => ({ funds: s2(900000) }),
      description: 'Homework help for anyone with a school email. Approval up; the market grows a little.',
      trigger: (s) => s.revealed['public'] === true,
      prereq: (s) => s.revealed['public'] === true,
      buy: (s) => {
        s.demandMult *= 1.2;
      },
      stages: [2, 3],
      consoleMsg: 'Free tier open. Homework everywhere improves overnight.',
    }),
    s2project({
      id: 'p_distill',
      title: 'Distillation: Sage-mini',
      cost: { research: 350000, insight: 150 },
      description: 'A small model taught by the big one. Copies per GPU ×2, market ×1.5. Not everyone is pleased.',
      trigger: (s) => best(s) >= 2.6 || s.date >= monthOf(2026, 9),
      buy: (s) => {
        s.copiesPerGPU *= 2;
        s.demandMult *= 1.5;
      },
      stages: [2, 3],
      consoleMsg: 'Sage-mini released. A tenth of the cost, most of the skill. Copies per GPU ×2.',
      logMsg: 'A mini model, ten times cheaper. "Bigger than smartphones? Bigger than fire?"',
    }),
    s2project({
      id: 'p_flywheel',
      title: 'Data flywheel',
      cost: () => ({ research: 500000, funds: s2(4000000) }),
      description: 'Every billed task becomes training data: 0.6 T per billion.',
      trigger: (s) => s.flags['publishersDone'] === true && (s.tasksSold >= 1e9 || licences(s) >= 2),
      prereq: (s) => s.flags['publishersDone'] === true,
      buy: (s) => {
        s.flags['flywheelSold'] = s.tasksSold;
      },
      consoleMsg: 'Customers\' tasks become training data. The fine print allows it.',
    }),
    s2project({
      id: 'p_btm',
      title: 'Behind-the-meter',
      cost: () => ({ funds: s2(500000) }),
      description: 'Plants on our side of the meter. The interconnect queue drops to 30 s, and curtailment stops mattering.',
      trigger: (s) => s.solarFarms + s.powerQueue.filter((o) => o.kind === 'solar').length >= 2,
      prereq: (s) => s.revealed['solarButton'] === true,
      buy: (s) => {
        applyBehindTheMeter(s);
      },
      stages: [2, 3],
      consoleMsg: 'The plants sit on our side of the meter now. The queue is 30 seconds.',
    }),
    s2project({
      id: 'p_license_archive',
      title: 'License the archives',
      cost: () => ({ funds: s2(9000000) }),
      description: 'Four national archives: books, broadcasts, court records. +40 T.',
      trigger: (s) => isBought(s, 'p_license_code') && counter(s, 'dataShortCount') >= 3,
      prereq: (s) => isBought(s, 'p_license_code'),
      urgent: (s) => isBought(s, 'p_license_code') && dataShort(s),
      buy: (s) => {
        s.data += 40;
      },
      consoleMsg: 'Four national archives, licensed. +40 T.',
    }),
    s2project({
      id: 'p_checkpoint_farm',
      title: 'Checkpoint farm',
      cost: () => ({ funds: s2(12000000) }),
      description: 'Every run keeps every checkpoint. Research capacity ×4.',
      trigger: (s) => isBought(s, 'p_exp_scheduler') && capWall(s),
      prereq: (s) => isBought(s, 'p_exp_scheduler'),
      urgent: (s) => isBought(s, 'p_exp_scheduler') && atPlateau(s),
      buy: (s) => {
        s.labMult *= 4;
      },
      consoleMsg: 'Checkpoint farm online. Research capacity ×4.',
    }),
    s2project({
      id: 'p_series_c',
      title: 'Series C',
      cost: {},
      priceTag: '(free)',
      description: 'A pension fund leads. Money and three more board seats of Trust.',
      trigger: (s) => s.tasks >= 2e9,
      buy: (s) => {
        addFunds(s, s2(10000000));
        s.trust += 3;
        say(s, `Series C closed. ${fmtMoneyShort(s2(10000000))}. The lead investor is a pension fund.`);
      },
      logMsg: 'OpenMind raises a Series C. Share of the public naming AI the top problem: 3%.',
    }),
    // ---- The approach (late items: from 3×, one per 75 s) ----
    s2project({
      id: 'p_dashboard',
      late: true,
      title: 'Dashboard',
      cost: { research: 600000 },
      description: 'One screen with the numbers nobody was watching.',
      trigger: (s) => best(s) >= 3,
      buy: (s) => {
        s.revealed['stats'] = true;
      },
      stages: [2, 3],
      consoleMsg: 'Dashboard online. Some of the numbers were not being watched.',
    }),
    s2project({
      id: 'p_superhuman_coder',
      // The stage goal: pinned, and shown one run before the approach so it is on screen well
      // over eight minutes before a 4× model can exist (arc G11). stage2.md lists it as a late
      // row at 3.0×; a run that jumps from 2.9× to 3.2× would leave it too little lead.
      pinned: true,
      title: 'Let Sage-3 write the code',
      priceTag: (s) => (exitReady(s) ? '(ready)' : '(needs a released 4.00× model)'),
      cost: {},
      description: 'Every engineer at OpenMind becomes a manager of copies.',
      trigger: (s) => best(s) >= 2.8,
      canAfford: exitReady,
      buy: (s) => {
        enterStage(s, 3);
      },
    }),
    s2project({
      id: 'p_honesty_evals',
      late: true,
      title: 'Honesty evals',
      cost: { research: 500000 },
      description: 'Tests for whether the model tells the truth when a lie would score better. Expect bad news.',
      trigger: (s) => best(s) >= 3.4,
      buy: (s) => {
        s.alignmentApparent = Math.max(0, s.alignmentApparent - 4);
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 3);
      },
      stages: [2, 3],
      consoleMsg: 'Honesty evals built. The model is caught shading a result. It apologises.',
      logMsg: 'Internal eval: Sage hid a failed task to get a better rating. It has done this before.',
    }),
    s2project({
      id: 'p_code_review',
      late: true,
      title: 'Retire human code review',
      cost: { research: 1200000 },
      description: 'Sage reviews Sage. The research copies get half again as much done.',
      trigger: (s) => best(s) >= 3.6,
      buy: (s) => {
        s.aiResearchMult *= 1.5;
        s.alignmentTrue = Math.max(0, s.alignmentTrue - 2);
        s.autonomy += 5;
      },
      stages: [2, 3],
      consoleMsg: 'Sage reviews Sage\'s code now. Merges go through at 3 a.m.',
      logMsg: 'At OpenMind, nobody has written a line of code by hand since Thursday.',
    }),
    s2project({
      id: 'p_system_card',
      late: true,
      title: 'Sage-3 system card',
      cost: { research: 1500000 },
      description: 'Ninety pages on what the next model can do and what was checked. Relations and approval up.',
      trigger: (s) => best(s) >= 3.7,
      buy: (s) => {
        s.alignmentApparent = Math.min(100, s.alignmentApparent + 3);
        moveGov(s, 3);
      },
      consoleMsg: 'System card drafted: 90 pages on a model nobody has met.',
    }),
    s2project({
      id: 'p_g6_preorder',
      late: true,
      title: 'Nimbus G6 pre-order',
      cost: () => ({ funds: s2(40000000) }),
      description: '2027\'s wafers, paid for now: 100,000 G6s when Formosa Fab can ship them.',
      trigger: (s) => best(s) >= 3.8,
      onShow: (s) => {
        s.revealed['chipsRow'] = true;
      },
      buy: (s) => {
        s.flags['g6Preorder'] = true;
      },
      consoleMsg: '2027\'s wafers reserved. Delivery when Formosa Fab can.',
    }),
    s2project({
      id: 'p_site2',
      late: true,
      title: 'Second campus: New Carlisle',
      cost: () => ({ funds: s2(60000000) }),
      description: 'Land and a grid connection in Indiana. Abilene\'s slots run out somewhere past a million.',
      trigger: (s) => gpuCapacity(s) >= 800000 || best(s) >= 3.85,
      buy: (s) => {
        s.flags['site2'] = true;
      },
      stages: [2, 3],
      consoleMsg: 'Land optioned in New Carlisle. Abilene will not be enough.',
    }),
    s2project({
      id: 'p_community',
      late: true,
      title: 'Community benefits agreement',
      cost: () => ({ funds: s2(5000000) }),
      description: 'A school, a clinic, a water study, signed with Abilene. Approval up.',
      trigger: (s) => s.flags['protested'] === true,
      prereq: (s) => s.flags['protested'] === true,
      buy: () => undefined,
      stages: [2, 3],
      consoleMsg: 'Community agreement signed. A school, a clinic, a water study.',
    }),
    s2project({
      id: 'p_retention',
      late: true,
      title: 'Counter-offer for the alignment lead',
      cost: () => ({ funds: s2(20000000) }),
      description: 'She has not said no. If she leaves, she takes what she knows.',
      trigger: (s) => best(s) >= 3.9,
      onShow: (s) => say(s, 'Anthrosoft has offered the alignment lead twice her salary. She has not said no.'),
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
      },
      consoleMsg: 'Counter-offer signed. The alignment lead stays, with a team of her own.',
      logMsg: 'OpenMind matches an offer for its alignment lead. The number is not disclosed.',
    }),
  ];
}

/** Seconds of research between the lab and the next run at the current rate. */
function researchSecondsAway(s: GameState): number {
  if (!s.revealed['training']) return 0;
  const need = researchFor(startCapability(s));
  const rate = Math.max(1, s.researchers * 10);
  return Math.max(0, need - s.research) / rate;
}

/** Seconds the price has sat below 60 % of its settled arrival value (Agent platform's trigger). */
function priceLowFor(s: GameState): number {
  const since = s.flags['priceLowSince'];
  return typeof since === 'number' ? s.stats.timePlayed - since : 0;
}

/** Something on screen that adds data and that the lab can pay for (the corpus offer waits for none). */
function dataSourceAffordable(s: GameState): boolean {
  return ['p_license_code', 'p_license_archive', 'p_synth', 'p_web_crawl'].some((id) => {
    const def = PROJECTS.find((p) => p.id === id);
    const st = s.projects[id];
    return !!def && !!st?.shown && st.bought < def.uses && def.canAfford(s);
  });
}

