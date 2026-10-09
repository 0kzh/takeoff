import { GameState, isBought, addFunds, counter } from '../engine/state.js';
import { enterStage, STUCK } from '../engine/stages.js';
import { researchCap, gpuCost, fleetPowerBlock, nextContractWeight, rentQuota, marketingCost } from '../engine/economy.js';
import { startCapability, gpusShort, needsDatacenter, cardWallSeconds, gpusForS1, gpusNeeded, MAX_RENT_QUOTA } from '../engine/training.js';
import { monthOf, fmtMoneyShort, fmtInt } from '../engine/format.js';

export type { ProjectDef, ProjectInput } from './project-def.js';
export { project, revealPrice, revealResearchPrice } from './project-def.js';
import { project, type ProjectDef } from './project-def.js';
import { STAGE2_PROJECTS } from './projects-stage2.js';

const releases = (s: GameState) => s.stats.publicReleases;
const bought = (s: GameState, id: string) => s.projects[id]?.bought ?? 0;

const dateAtLeast = (s: GameState, year: number, month: number) => s.date >= monthOf(year, 1) + month - 1;

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

export const DATACENTER_LIST = 450000;
export const DATACENTER_WALL_CAP = DATACENTER_LIST;
export const DATACENTER_FLOOR = 100000;
export const DATACENTER_WALL_SECONDS = 200;

export function datacenterPrice(s: GameState): number {
  const held = s.flags['dcWallPrice'];
  const best = Math.max(s.stats.revPerSec, counter(s, 'peakRev'));
  const base = typeof held === 'number' ? held : Math.min(DATACENTER_WALL_CAP, Math.max(DATACENTER_FLOOR, DATACENTER_WALL_SECONDS * best));
  return threeSig(base * (isBought(s, 'p_abatement') ? 5 / 6 : 1));
}

export function rentDeposit(s: GameState): number {
  return Math.max(DEPOSIT_MIN, DEPOSIT_PER_GPU * s.gpus);
}
export const DEPOSIT_PER_GPU = 400;
export const DEPOSIT_MIN = 12000;

export function datacenterDue(s: GameState): number {
  return Math.max(0, datacenterPrice(s) - rentDeposit(s));
}

export function datacenterAtWall(s: GameState): void {
  if (s.stage !== 1) return;
  if (s.stats.revPerSec > counter(s, 'peakRev')) s.flags['peakRev'] = s.stats.revPerSec;
  if (s.flags['wallAt'] !== undefined || !s.projects['p_datacenter']?.shown) return;
  if (!needsDatacenter(s) || s.training.run) return;
  s.flags['wallAt'] = s.stats.timePlayed;
  const best = Math.max(s.stats.revPerSec, counter(s, 'peakRev'));
  s.flags['dcWallPrice'] = Math.min(DATACENTER_WALL_CAP, Math.max(DATACENTER_FLOOR, DATACENTER_WALL_SECONDS * best));
}

function threeSig(raw: number): number {
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 2));
  return Math.round(raw / unit) * unit;
}

export interface DatacenterStatus {
  need: number;
  rent: number;
  afterTooBig: boolean;
  needed: boolean;
  price: number;
  incomeSeconds: number;
  short: number;
  eta: number;
}

const STEP_S1 = { capability: 0.12, efficiency: 0.05, safety: 0.05 };

export function datacenterStatus(s: GameState): DatacenterStatus {
  const price = datacenterDue(s);
  const rev = Math.max(0, s.stats.revPerSec);
  const mult = typeof s.flags['trainingCompute'] === 'number' ? (s.flags['trainingCompute'] as number) : 1;
  const after = startCapability(s) * (1 + STEP_S1[s.training.focus]);
  const short = Math.max(0, price - s.funds);
  return {
    need: gpusNeeded(s),
    rent: rentQuota(s),
    afterTooBig: gpusForS1(after) / mult > MAX_RENT_QUOTA,
    needed: needsDatacenter(s),
    price,
    incomeSeconds: rev > 0 ? price / rev : Infinity,
    short,
    eta: short <= 0 ? 0 : rev > 0 ? short / rev : Infinity,
  };
}

export const SERIES_A = 5000;

export const GRID_CONTRACT_PRESSES = 6;

export function seriesABonus(s: GameState): number {
  return typeof s.flags['seriesABonus'] === 'number' ? (s.flags['seriesABonus'] as number) : 0;
}

export const AUTO_PRICING_MOVES = 20;
export const AUTO_PRICING_TASKS = 90000;
export const AUTO_PRICING_LATE = 400000;

/** A press release is worth one Marketing level, so its insight price follows the Marketing price. */
export const PRESS_INSIGHT_MAX = 300;
export function pressCost(s: GameState): number {
  const raw = marketingCost(s) / 10000;
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.min(PRESS_INSIGHT_MAX, Math.max(5, Math.round(raw / unit) * unit));
}

export function contractCost(s: GameState): number {
  return Math.round(3000 * Math.pow(1.35, bought(s, 'p_contract')));
}

export function nextContractPct(s: GameState): string {
  return `+${Math.round(100 * nextContractWeight(s))}%`;
}

export const PROJECTS: ProjectDef[] = [
  project({
    id: 'p_beg_power',
    title: 'Ask the cloud provider for credit',
    priceTag: '1 Trust',
    cost: {},
    description: 'One block of power, on credit.',
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
    priceTag: (s) => `${fmtInt(pressCost(s))} insight`,
    cost: (s) => ({ insight: pressCost(s) }),
    description: 'Marketing level +1.',
    trigger: (s) => s.flags['idlePress'] === true && s.insight >= pressCost(s),
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
    description: 'Rewrite the prompts. Copies 25% faster.',
    trigger: (s) => s.gpus >= 1,
    buy: (s) => {
      s.copyBoost += 0.25;
    },
    consoleMsg: 'Prompt templates rewritten. Copies 25% faster.',
    stages: [1],
  }),
  project({
    id: 'p_grid',
    title: 'Grid Contract',
    cost: { research: 2000 },
    description: 'Power is billed as it is used. No more buying it by hand.',
    trigger: (s) => s.powerBought >= GRID_CONTRACT_PRESSES,
    buy: (s) => {
      s.gridAuto = true;
      s.revealed['gridContract'] = true;
      s.flags['powerOut'] = false;
    },
    stages: [1],
    consoleMsg: 'Grid contract signed. Power is billed as it is used.',
  }),
  project({
    id: 'p_insight',
    title: 'Blue-sky Research',
    cost: { research: 1000 },
    description: 'Insight accrues while research is full.',
    trigger: (s) => s.research >= Math.min(researchCap(s), 1000) || s.labSpace >= 2,
    buy: (s) => {
      s.insightUnlocked = true;
    },
    consoleMsg: 'Insight unlocked. It accrues while research is full, and with every release.',
    stages: [1],
  }),
  project({
    id: 'p_prompting2',
    chain: true,
    title: 'Chain-of-thought',
    cost: { research: 2000 },
    description: 'Copies think before they answer. 50% faster.',
    trigger: (s) => isBought(s, 'p_prompting') && s.revealed['training'] === true,
    buy: (s) => {
      s.copyBoost += 0.5;
    },
    consoleMsg: 'Copies think out loud now. 50% faster.',
    stages: [1],
  }),
  project({
    id: 'p_seed',
    title: 'Seed round',
    cost: {},
    description: '+$5,000.',
    trigger: (s) => s.tasks >= 10000,
    buy: (s) => {
      addFunds(s, 5000);
    },
    consoleMsg: 'Seed round closed. $5,000 and two board seats.',
    logMsg: 'OpenMind closes a seed round. The deck has one chart on it.',
  }),
  project({
    id: 'p_blogpost',
    title: 'Research blog post',
    cost: { insight: 40 },
    description: 'Mostly charts. Demand +5%.',
    trigger: (s) => s.insightUnlocked && s.insight >= 1,
    buy: (s) => {
      s.demandMult *= 1.05;
    },
    consoleMsg: 'Forty thousand people read the post. A few of them sign up.',
    stages: [1, 2],
  }),
  project({
    id: 'p_lab_cluster',
    title: 'Experiment tracker',
    cost: { research: 3000 },
    description: 'Every experiment logged. Research +25%.',
    trigger: (s) => s.labSpace >= 3 || (s.revealed['insight'] === true && s.funds >= 300) || cardWallSeconds(s) >= 30,
    urgent: (s) => cardWallSeconds(s) >= 30,
    buy: (s) => {
      s.researchMult *= 1.25;
    },
    consoleMsg: 'Experiment tracker live. Research capacity doubled.',
    stages: [1],
  }),
  project({
    id: 'p_prompting3',
    chain: true,
    title: 'Tool use',
    cost: { research: 4000 },
    description: 'A terminal and a browser. Copies 75% faster.',
    trigger: (s) => isBought(s, 'p_prompting2'),
    buy: (s) => {
      s.copyBoost += 0.75;
    },
    consoleMsg: 'Copies can run code and search. 75% faster.',
    stages: [1],
  }),
  project({
    id: 'p_api',
    revealResearch: 100,
    title: 'Public API',
    cost: { research: 3000 },
    description: 'Developers build on Sage. Demand ×2.',
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
    cost: { insight: 60 },
    description: 'Three minutes, no cuts. Marketing level +2.',
    trigger: (s) => isBought(s, 'p_blogpost') && releases(s) >= 1,
    buy: (s) => {
      s.hypeLevel += 2;
    },
    stages: [1],
    consoleMsg: 'The demo has three million views. Most stopped after a minute.',
  }),
  project({
    id: 'p_auto_pricing',
    revealResearch: 60,
    title: 'Dynamic pricing',
    cost: { research: 5000 },
    description: 'Finance prices to clear what the copies make. Pricing goes AUTO.',
    trigger: (s) => (counter(s, 'priceMoves') >= AUTO_PRICING_MOVES && s.tasks >= AUTO_PRICING_TASKS) || s.tasks >= AUTO_PRICING_LATE,
    buy: (s) => {
      s.autoPrice = true;
      s.revealed['autoPrice'] = true;
    },
    consoleMsg: 'Dynamic pricing live. Finance moves the price every second.',
  }),
  project({
    id: 'p_region',
    title: 'Second cloud region',
    cost: { research: 9000 },
    description: 'Twenty more GPUs on the quota; prices rise more slowly.',
    trigger: (s) => isBought(s, 'p_compute_deal') && s.gpus >= rentQuota(s) - 5,
    buy: (s) => {
      s.gpuCostGrowth = 1.07;
    },
    consoleMsg: 'A second region opens. Twenty more GPUs to rent.',
  }),
  project({
    id: 'p_reserved',
    title: 'Reserved capacity',
    cost: { research: 14000 },
    description: 'Twenty more GPUs on the quota, booked for the year.',
    trigger: (s) => isBought(s, 'p_region') && s.gpus >= rentQuota(s) - 5,
    buy: (s) => {
      s.gpuCostGrowth = 1.06;
    },
    consoleMsg: 'Capacity reserved through December. Twenty more GPUs to rent.',
  }),
  project({
    id: 'p_compute_deal',
    title: 'Bulk GPU lease',
    cost: { research: 5000 },
    description: 'Twenty more GPUs on the quota; prices rise more slowly.',
    trigger: (s) => s.gpus >= 45 || gpuCost(s) >= 1000,
    buy: (s) => {
      s.gpuCostGrowth = 1.08;
    },
    consoleMsg: 'Bulk lease signed. The cloud provider sends a fruit basket.',
  }),
  project({
    id: 'p_pricing',
    revealResearch: 100,
    title: 'Usage-based pricing',
    cost: { research: 9000 },
    description: 'Bill per token. Demand +50% at any price.',
    trigger: (s) => (isBought(s, 'p_api') && releases(s) >= 2) || sinceFlag(s, 'firstReleaseAt') >= 300,
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
    description: `+${fmtMoneyShort(SERIES_A)}, +2 Trust, marketing level +2.`,
    trigger: (s) => s.tasks >= 60000 && releases(s) >= 1,
    buy: (s) => {
      s.flags['seriesAAt'] = s.stats.timePlayed;
      addFunds(s, SERIES_A + seriesABonus(s));
      s.trust += 2;
      s.hypeLevel += 2;
    },
    consoleMsg: 'Series A closed. The board asks where the datacenter goes.',
    logMsg: 'Series A. The lead investor asks about AGI timelines and writes down the answer.',
  }),
  project({
    id: 'p_datacenter',
    title: 'First Datacenter',
    cost: (s) => ({ funds: datacenterDue(s) }),
    description: '1,000 GPUs of our own at Abilene. Stop renting.',
    trigger: (s) => s.stage === 1 && (gpusForS1(startCapability(s)) >= 45 || releases(s) >= 3 || dateAtLeast(s, 2025, 10.5)),
    urgent: (s) => needsDatacenter(s),
    onShow: (s) => {
      s.flags['dcCardAt'] = s.stats.timePlayed;
    },
    buy: (s) => {
      enterStage(s, 2);
    },
    pinned: true,
    logMsg: 'OpenMind is said to be pricing a datacenter of its own in West Texas.',
  }),
  project({
    id: 'p_cooling',
    sideline: true,
    revealFunds: 120,
    title: 'Closed-loop cooling',
    cost: { funds: 10000 },
    description: 'Spare the town\'s water. +1 Trust.',
    trigger: (s) => sinceFlag(s, 'dcCardAt') >= 60,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: 'Closed-loop cooling it is. The county commissioner shakes every hand. Trust +1.',
    logMsg: 'OpenMind will cool its Abilene site with a closed loop. The aquifer is spared.',
  }),
  project({
    id: 'p_abatement',
    sideline: true,
    title: 'Take the county\'s tax abatement',
    cost: { trust: 1 },
    description: 'Promise Abilene two hundred jobs. First Datacenter costs a sixth less.',
    trigger: (s) => sinceFlag(s, 'dcCardAt') >= 300,
    buy: () => undefined,
    consoleMsg: 'Abatement signed. Two hundred jobs promised; the building needs about thirty.',
    logMsg: 'OpenMind promises Abilene two hundred jobs. The datacenter will employ about thirty.',
  }),
  project({
    id: 'p_soundwall',
    sideline: true,
    revealFunds: 120,
    title: 'Build a sound wall',
    cost: { funds: 5000 },
    description: 'So the rancher next to the Abilene site can sleep. +1 Trust.',
    trigger: (s) => sinceFlag(s, 'dcCardAt') >= 420,
    buy: (s) => {
      s.trust += 1;
    },
    consoleMsg: 'Sound wall up. The cattle sleep again. Trust +1.',
  }),
  project({
    id: 'p_contract',
    chain: true,
    title: 'Custom model contract',
    priceTag: (s) => `${contractCost(s).toLocaleString('en-US')} research · repeatable`,
    cost: (s) => ({ research: contractCost(s) }),
    description: 'A bank that buys at your price. Demand +12%.',
    repeatable: true,
    trigger: (s) => isBought(s, 'p_enterprise') || (isBought(s, 'p_series_a') && sinceFlag(s, 'seriesAAt') >= 60),
    uses: Infinity,
    sideline: true,
    buy: (s) => {
      s.revealed['contracts'] = true;
    },
    consoleMsg: 'Contract signed. The bank buys at your price, every second.',
  }),
  project({
    id: 'p_enterprise',
    revealResearch: 100,
    title: 'Enterprise sales team',
    cost: { research: 6000 },
    description: 'Procurement questionnaires, answered. Demand ×2.',
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
    revealResearch: 100,
    title: 'Distributed training',
    cost: { research: 8000 },
    description: 'Runs need a third fewer GPUs.',
    trigger: (s) => s.training.runIndex >= 3 || gpusShort(s),
    buy: (s) => {
      s.flags['trainingCompute'] = 1.5;
    },
    consoleMsg: 'Distributed training online. Runs need a third fewer GPUs.',
  }),
  project({
    id: 'p_alignment_team',
    revealResearch: 100,
    title: 'Alignment team',
    cost: { research: 6000 },
    description: 'Four people who ask why.',
    trigger: (s) => s.training.runIndex >= 3,
    buy: (s) => {
      s.alignmentApparent = Math.min(100, s.alignmentApparent + 5);
      s.alignmentTrue = Math.min(100, s.alignmentTrue + 3);
    },
    stages: [1, 2],
    consoleMsg: 'Alignment team formed. They have questions.',
  }),
  project({
    id: 'p_dogfood',
    revealResearch: 100,
    title: 'Sage writes Sage',
    cost: { research: 4000 },
    description: 'Sage writes OpenMind\'s code. Research +25%.',
    trigger: (s) => dateAtLeast(s, 2025, 9.3) || s.capability >= 1.3,
    buy: (s) => {
      s.researchMult *= 1.25;
    },
    stages: [1],
    consoleMsg: 'Sage now writes a third of OpenMind\'s code. Research runs faster.',
    logMsg: 'OpenMind says its own model now writes much of its code. Nobody outside can check.',
  }),
  project({
    id: 'p_ppa',
    sideline: true,
    title: 'Power purchase agreement',
    cost: { research: 7000 },
    description: 'Ten years of West Texas wind. Power 30% cheaper.',
    trigger: (s) => sinceFlag(s, 'dcCardAt') >= 150,
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
    revealResearch: 100,
    title: 'Renewal season',
    cost: { research: 6000 },
    description: 'Every contract renews bigger. Contract demand +25%.',
    trigger: (s) => s.revealed['contracts'] === true && (dateAtLeast(s, 2025, 12.1) || bought(s, 'p_contract') >= 6),
    buy: (s) => {
      s.flags['contractMult'] = 1.25;
    },
    consoleMsg: 'Renewals signed. Every contract pays a quarter more.',
  }),
  project({
    id: 'p_batch',
    revealResearch: 100,
    title: 'Batch inference',
    cost: { research: 6000 },
    description: 'Run requests together. Copies per GPU ×1.25.',
    trigger: (s) => s.gpus >= 100 || dateAtLeast(s, 2025, 10),
    buy: (s) => {
      s.copiesPerGPU *= 1.25;
    },
    stages: [1, 2],
    consoleMsg: 'Batch inference live. More copies fit on each GPU.',
  }),
  project({
    id: 'p_floor',
    revealFunds: 120,
    title: 'Lease the floor upstairs',
    cost: { funds: 15000 },
    description: 'More desks. Research capacity +3,000.',
    trigger: (s) => s.training.runIndex >= 4 || cardWallSeconds(s) >= 90,
    urgent: (s) => cardWallSeconds(s) >= 90,
    buy: (s) => {
      s.labSpace += 3;
    },
    stages: [1],
    consoleMsg: 'The floor upstairs is ours. Research capacity doubled.',
    logMsg: 'OpenMind takes a second floor. The landlord asks what the company does.',
  }),
  project({
    id: 'p_recruiter',
    revealFunds: 120,
    title: 'Hire a recruiter',
    cost: { funds: 12000 },
    description: 'She knows everyone. Three researchers.',
    trigger: (s) => s.researchers >= 22 || dateAtLeast(s, 2025, 10.5),
    buy: (s) => {
      s.researchers += 3;
    },
    stages: [1],
    consoleMsg: 'Three researchers start Monday. One brings a cat.',
  }),
  project({
    id: 'p_agents',
    revealResearch: 100,
    title: 'Agent mode',
    cost: { research: 8000 },
    description: 'Sage gets a credit card. Copies 20% faster.',
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
    revealResearch: 100,
    title: 'Publish a safety framework',
    cost: { research: 6000 },
    description: 'Thresholds and commitments. +1 Trust.',
    trigger: (s) => ((s.flags['safetyRuns'] as number) || 0) >= 1 || dateAtLeast(s, 2025, 11.5),
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
    cost: { insight: 100 },
    description: 'Eight pages, one good idea. Research +10%.',
    trigger: (s) => isBought(s, 'p_demo') && releases(s) >= 3,
    buy: (s) => {
      s.researchMult *= 1.1;
    },
    stages: [1],
    consoleMsg: 'Workshop paper accepted. Reviewer 2 was right, it turns out.',
  }),
  project({
    id: 'p_keynote',
    title: 'Conference keynote',
    cost: { insight: 100 },
    description: 'The big room. Marketing level +3.',
    trigger: (s) => isBought(s, 'p_workshop') && isBought(s, 'p_series_a'),
    buy: (s) => {
      s.hypeLevel += 3;
    },
    stages: [1],
    consoleMsg: 'Keynote delivered. The room was full.',
  }),
  project({
    id: 'p_moe',
    title: 'Mixture of experts',
    cost: { insight: 150 },
    description: 'Only part of the model wakes. Copies per GPU ×1.5.',
    trigger: (s) => isBought(s, 'p_keynote') || (s.insight >= 90 && releases(s) >= 3),
    buy: (s) => {
      s.copiesPerGPU *= 1.5;
    },
    stages: [1, 2],
    consoleMsg: 'Mixture of experts deployed. More copies fit on each GPU.',
  }),
  ...STAGE2_PROJECTS,
];
