import { GameState, Cost, canPay, isBought, addFunds, say, counter, buildFundOpen, DEFAULT_BUILD_SHARE } from '../engine/state.js';
import { enterStage, STUCK } from '../engine/stages.js';
import {
  researchCap, gpuCost, fleetPowerBlock, bestCapability, researchRate, nextContractWeight,
  rentQuota,
} from '../engine/economy.js';
import {
  atPlateau, plateauSeconds, trainCost, researchFor, startCapability, gpusShort, needsDatacenter, cardWallSeconds, gpusForS1,
  gpusNeeded, MAX_RENT_QUOTA,
} from '../engine/training.js';
import { monthOf, fmtMoneyShort, fmtNum } from '../engine/format.js';
import { s2, applyBehindTheMeter, gpuCapacity } from '../engine/infrastructure.js';
import { moveGov, moveLead, dataShort, dataWall, dataShortSeconds, capWall, dataNotInHand } from '../engine/world.js';
import { stage3Projects, granted } from './projects3.js';
import { stage4Projects } from './projects4.js';
import { stage5Projects } from './projects5.js';
import { minedPerSec } from '../engine/fleet.js';

export interface ProjectDef {
  id: string;
  title: string;
  priceTag?: string | ((s: GameState) => string);
  description: string;
  stages: number[];
  cost: (s: GameState) => Cost;
  trigger: (s: GameState) => boolean;
  canAfford: (s: GameState) => boolean;
  buy: (s: GameState) => void;
  uses: number;
  rehide?: boolean;
  rescue?: boolean;
  pinned?: boolean;
  urgent?: (s: GameState) => boolean;
  chain?: boolean;
  expires?: (s: GameState) => boolean;
  sideline?: boolean;
  ignoresCap?: boolean;
  late?: boolean;
  prereq?: (s: GameState) => boolean;
  onShow?: (s: GameState) => void;
  revealFunds?: number;
  revealResearch?: number;
  revealMaterials?: number;
  repeatable?: boolean;
  consoleMsg?: string;
  logMsg?: string;
  grant?: boolean;
  lateAt?: number;
  instrument?: boolean;
  needs?: (s: GameState) => string;
  revealMatter?: number;
  mission?: { seconds: number; beside?: boolean; complete: (s: GameState) => void };
}

export type ProjectInput = Omit<ProjectDef, 'canAfford' | 'stages' | 'uses' | 'cost'> & {
  cost: Cost | ((s: GameState) => Cost);
} & Partial<Pick<ProjectDef, 'canAfford' | 'stages' | 'uses'>>;

export function project(def: ProjectInput): ProjectDef {
  const base = typeof def.cost === 'function' ? def.cost : ((c: Cost) => () => c)(def.cost);
  const secs = def.revealFunds;
  const rsecs = def.revealResearch;
  const msecs = def.revealMaterials;
  const fsecs = def.revealMatter;
  const stage1 = (def.stages ?? [1]).includes(1);
  const fixed = secs === undefined && rsecs === undefined && msecs === undefined && fsecs === undefined;
  const cost = fixed ? base : (s: GameState): Cost => {
    const c = base(s);
    const out: Cost = { ...c };
    if (msecs !== undefined) out.materials = Math.max(c.materials ?? 0, revealMaterialsPrice(s, def.id, msecs));
    if (fsecs !== undefined) out.fund = Math.max(c.fund ?? 0, revealMatterPrice(s, def.id, fsecs));
    if (secs !== undefined) {
      const floor = revealPrice(s, def.id, secs);
      out.funds = Math.max(c.funds ?? 0, stage1 && s.stage === 1 && c.funds ? Math.min(floor, 4 * c.funds) : floor);
    }
    if (rsecs !== undefined) out.research = Math.max(c.research ?? 0, revealResearchPrice(s, def.id, rsecs));
    return out;
  };
  const onShow = fixed ? def.onShow : (s: GameState) => {
    if (secs !== undefined) s.flags[`price:${def.id}`] = revealPrice(s, def.id, secs);
    if (rsecs !== undefined) s.flags[`rprice:${def.id}`] = revealResearchPrice(s, def.id, rsecs);
    if (msecs !== undefined) s.flags[`mprice:${def.id}`] = revealMaterialsPrice(s, def.id, msecs);
    if (fsecs !== undefined) s.flags[`fprice:${def.id}`] = revealMatterPrice(s, def.id, fsecs);
    def.onShow?.(s);
  };
  const gated = !!def.prereq && (def.stages ?? [1]).some((x) => x >= 3);
  return {
    stages: [1],
    uses: 1,
    canAfford: (s) => (!gated || s.stage < 3 || def.prereq!(s)) && canPay(s, cost(s)),
    ...def,
    cost,
    onShow,
  };
}

export const S2_CARD_FLOOR = 0.7;

export function revealPrice(s: GameState, id: string, seconds: number): number {
  const fixed = s.flags[`price:${id}`];
  if (typeof fixed === 'number') return fixed;
  const toFunds = s.stage === 2 && buildFundOpen(s) ? S2_CARD_FLOOR * (1 - DEFAULT_BUILD_SHARE) : 1;
  return twoFigures(seconds * Math.max(1, s.stats.revPerSec * toFunds));
}

export function revealResearchPrice(s: GameState, id: string, seconds: number): number {
  const fixed = s.flags[`rprice:${id}`];
  if (typeof fixed === 'number') return fixed;
  return Math.min(twoFigures(seconds * Math.max(1, researchRate(s))), Math.floor((0.85 * researchCap(s)) / 100) * 100);
}

export function revealMaterialsPrice(s: GameState, id: string, seconds: number): number {
  const fixed = s.flags[`mprice:${id}`];
  if (typeof fixed === 'number') return fixed;
  return twoFigures(seconds * Math.max(1, minedPerSec(s)));
}

export function revealMatterPrice(s: GameState, id: string, seconds: number): number {
  const fixed = s.flags[`fprice:${id}`];
  if (typeof fixed === 'number') return fixed;
  return twoFigures(seconds * Math.max(1, s.s5.massFlow));
}

function twoFigures(raw: number): number {
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.round(raw / unit) * unit;
}

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
  if (!needsDatacenter(s) || s.training.run || s.training.pending) return;
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

export const GRID_CONTRACT_PRESSES = 10;

export function seriesABonus(s: GameState): number {
  return typeof s.flags['seriesABonus'] === 'number' ? (s.flags['seriesABonus'] as number) : 0;
}

export const AUTO_PRICING_MOVES = 20;
export const AUTO_PRICING_TASKS = 90000;
export const AUTO_PRICING_LATE = 400000;

export function deskCost(s: GameState): number {
  return 1000 * Math.pow(2, bought(s, 'p_desks'));
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
    priceTag: '(1 Trust)',
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
    cost: { insight: 5 },
    description: 'Marketing level +1.',
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
    description: 'Two more lab spaces. Each lease costs twice the last.',
    trigger: (s) => s.stage === 1 && s.revealed['training'] === true && cardWallSeconds(s) >= 45 && s.trust < 1,
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
    description: 'Rewrite the prompts. Copies 25% faster.',
    trigger: (s) => s.gpus >= 1,
    buy: (s) => {
      s.copyBoost += 0.25;
    },
    consoleMsg: 'Prompt templates rewritten. Copies 25% faster.',
    stages: [1, 2],
  }),
  project({
    id: 'p_grid',
    title: 'Grid Contract',
    cost: { research: 2000 },
    description: 'Power is bought when it runs low.',
    trigger: (s) => s.powerBought >= GRID_CONTRACT_PRESSES,
    buy: (s) => {
      s.gridAuto = true;
      s.revealed['gridContract'] = true;
    },
    consoleMsg: 'Grid contract signed. Power is bought when it runs low.',
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
    stages: [1, 2],
  }),
  project({
    id: 'p_prompting2',
    chain: true,
    title: 'Chain-of-thought',
    cost: { research: 2500 },
    description: 'Copies think before they answer. 50% faster.',
    trigger: (s) => isBought(s, 'p_prompting') && s.revealed['training'] === true,
    buy: (s) => {
      s.copyBoost += 0.5;
    },
    consoleMsg: 'Copies think out loud now. 50% faster.',
    stages: [1, 2],
  }),
  project({
    id: 'p_seed',
    title: 'Seed round',
    cost: {},
    description: '+$5,000, +2 Trust.',
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
    cost: { insight: 40 },
    description: 'Mostly charts. +1 Trust.',
    trigger: (s) => s.insightUnlocked && s.insight >= 1,
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
    description: 'Research capacity ×2.',
    trigger: (s) => s.labSpace >= 3 || (s.revealed['insight'] === true && s.funds >= 300) || cardWallSeconds(s) >= 30 || plateauSeconds(s) >= 30,
    urgent: (s) => cardWallSeconds(s) >= 30 || plateauSeconds(s) >= 30,
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
    description: 'A terminal and a browser. Copies 75% faster.',
    trigger: (s) => isBought(s, 'p_prompting2'),
    buy: (s) => {
      s.copyBoost += 0.75;
    },
    consoleMsg: 'Copies can run code and search. 75% faster.',
    stages: [1, 2],
  }),
  project({
    id: 'p_eval_team',
    revealResearch: 100,
    title: 'Hire an evals team',
    cost: { research: 2500 },
    description: 'Fixes take a third less time.',
    trigger: (s) => s.flags['redTeamed'] === true,
    buy: () => undefined,
    stages: [1, 2],
    consoleMsg: 'Evals team hired. Fixes are faster.',
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
    stages: [1, 2],
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
    priceTag: (s) => `(${contractCost(s).toLocaleString('en-US')} research · repeatable)`,
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
    description: 'Four people who ask why. Fewer issues.',
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
    revealResearch: 100,
    title: 'Sage writes Sage',
    cost: { research: 4000 },
    description: 'Sage writes OpenMind\'s code. Research +25%.',
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
    cost: { research: 8000 },
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
    description: 'More desks. Research capacity ×2.',
    trigger: (s) => s.training.runIndex >= 4 || cardWallSeconds(s) >= 90 || plateauSeconds(s) >= 90,
    urgent: (s) => cardWallSeconds(s) >= 90 || plateauSeconds(s) >= 90,
    buy: (s) => {
      s.labMult *= 2;
    },
    stages: [1, 2],
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
    stages: [1, 2],
    consoleMsg: 'Three researchers start Monday. One brings a cat.',
  }),
  project({
    id: 'p_agents',
    revealResearch: 100,
    title: 'Agent mode',
    cost: { research: 12000 },
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
    cost: { insight: 100 },
    description: 'Eight pages, one good idea. +1 Trust.',
    trigger: (s) => isBought(s, 'p_demo') && releases(s) >= 3,
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
    trigger: (s) => isBought(s, 'p_workshop') && isBought(s, 'p_series_a'),
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
    description: 'Only part of the model wakes. Copies per GPU ×1.5.',
    trigger: (s) => isBought(s, 'p_keynote') || (s.insight >= 90 && releases(s) >= 3),
    buy: (s) => {
      s.copiesPerGPU *= 1.5;
    },
    stages: [1, 2],
    consoleMsg: 'Mixture of experts deployed. More copies fit on each GPU.',
  }),
  ...stage2Projects(),
  ...stage3Projects(project),
  ...stage4Projects(project),
  ...stage5Projects(project),
];

export function LATE_AT(specified: number): number {
  return 2.8 + 1.1 * (specified - 3.0);
}

const ts = (s: GameState) => s.stats.timeInStage;
const s2Releases = (s: GameState) => counter(s, 'releasesThisStage');
const best = (s: GameState) => bestCapability(s);
const inStage2 = (s: GameState) => s.stage === 2;
const licences = (s: GameState) =>
  (s.flags['licensedPublishers'] === true ? 1 : 0) + (isBought(s, 'p_license_code') ? 1 : 0) + (isBought(s, 'p_license_archive') ? 1 : 0);

export function assistantsCost(s: GameState): Cost {
  return { funds: s2(s, s.flags['assistantsHalf'] === true ? 50000 : 100000), insight: 15 };
}

export function synthCost(s: GameState): Cost {
  const half = s.flags['synthHalf'] === true;
  return { research: half ? 100000 : 200000, insight: half ? 30 : 60 };
}

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
      description: 'A university\'s corpus, exactly what the next run lacks, for a seat on the safety board.',
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
      cost: (s) => ({ funds: s2(s, 60000) }),
      description: 'Experiment servers: four times the research capacity, and insight trickles in below it.',
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
      cost: { research: 15000 },
      description: 'Read the public internet once: 15 T of data at 0.1 T a second.',
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
      description: 'Copies of Sage join the research team; a slider decides how many.',
      trigger: (s) => s2Releases(s) >= 1 || researchSecondsAway(s) > 180,
      urgent: (s) => s.flags['assistantsHalf'] === true || researchSecondsAway(s) > 120,
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
      description: 'Growth investors: money, three board seats of Trust and a marketing push.',
      trigger: (s) => s.tasks >= 1200000 && s2Releases(s) >= 1,
      buy: (s) => {
        addFunds(s, s2(s, 250000));
        s.trust += 3;
        s.hypeLevel += 2;
        say(s, `Series B closed. ${fmtMoneyShort(s2(s, 250000))} and three new board seats.`);
      },
      logMsg: 'OpenMind raises a Series B. The deck now has two charts.',
    }),
    s2project({
      id: 'p_agent_platform',
      title: 'Agent platform',
      cost: (s) => ({ funds: s2(s, 250000), research: 40000 }),
      description: 'Customers hand over whole jobs instead of questions: market ×1.6.',
      trigger: (s) => s2Releases(s) >= 1 && priceLowFor(s) >= 30,
      stages: [2, 3],
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
      description: 'Whole GPU lots arrive by themselves whenever the build fund covers one and they fit.',
      trigger: (s) => s.gpuBatches >= 5,
      buy: (s) => {
        s.standingOrder = true;
        s.revealed['standingOrder'] = true;
      },
      consoleMsg: 'Standing order placed. GPUs arrive when there is room, power and cash.',
    }),
    s2project({
      id: 'p_scaffold',
      revealFunds: 90,
      title: 'Agent scaffolding',
      cost: { research: 90000 },
      description: 'Planners, checkers and retries: copies finish a quarter more tasks.',
      trigger: (s) => s2Releases(s) >= 2,
      buy: (s) => {
        s.copyBoost *= 1.25;
      },
      stages: [2, 3],
      consoleMsg: 'Scaffolding shipped. Copies finish 25% more tasks.',
    }),
    s2project({
      id: 'p_exp_scheduler',
      revealResearch: 60,
      title: 'Experiment scheduler',
      cost: { research: 20000 },
      description: 'Experiments queue themselves overnight: four times the research capacity.',
      trigger: (s) => isBought(s, 'p_research_cluster') && capWall(s),
      prereq: (s) => isBought(s, 'p_research_cluster'),
      urgent: (s) => isBought(s, 'p_research_cluster') && atPlateau(s),
      buy: (s) => {
        s.labMult *= 4;
      },
      consoleMsg: 'Experiments queue themselves overnight. The lab holds four times as much.',
    }),
    s2project({
      id: 'p_spec',
      revealFunds: 90,
      title: 'Publish the Spec',
      cost: { research: 80000 },
      description: 'Publish what Sage should want: measured alignment and relations go up.',
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
      cost: (s) => ({ research: 100000, funds: s2(s, 150000) }),
      description: 'The model grades the model: fixes take half the time and runs have fewer issues.',
      trigger: (s) => s2Releases(s) >= 3 || counter(s, 'incidentsS2') >= 1,
      buy: (s) => {
        s.revealed['evalLine'] = true;
      },
      consoleMsg: 'Evals run themselves now. Fixes take half the time.',
    }),
    s2project({
      id: 'p_sl2',
      revealFunds: 90,
      title: 'Security level 2',
      cost: (s) => ({ funds: s2(s, 200000) }),
      description: 'Background checks and a locked server room: holds against opportunists.',
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
      revealFunds: 30,
      title: 'Synthetic data',
      priceTag: (s) => `(${fmtNum(synthCost(s).research ?? 0, 0)} research, ${synthCost(s).insight} insight)`,
      cost: synthCost,
      description: 'Research copies write training data; the more on research, the faster it comes.',
      trigger: (s) => s.flags['publishersDone'] === true || dataNotInHand(s),
      prereq: (s) => isBought(s, 'p_ai_assistants'),
      urgent: (s) => dataNotInHand(s) || (s.flags['publishersDone'] === true && dataWall(s)),
      buy: () => undefined,
      consoleMsg: 'Sage writes its own training data now. Nobody has read all of it.',
      logMsg: 'OpenMind trains on text its own models wrote. The papers call it a flywheel.',
    }),
    s2project({
      id: 'p_parallel',
      revealFunds: 60,
      title: 'Parallel pipelines',
      cost: { research: 200000, insight: 120 },
      description: 'A second pipeline: the next run starts while the last is in evaluation.',
      trigger: (s) => s2Releases(s) >= 4 && best(s) >= 2.2,
      prereq: (s) => s2Releases(s) >= 2,
      buy: (s) => {
        s.revealed['secondPipeline'] = true;
      },
      consoleMsg: 'Second pipeline online. The next run can start before this one ships.',
    }),
    s2project({
      id: 'p_policy',
      title: 'Policy team',
      cost: (s) => ({ funds: s2(s, 250000), trust: 2 }),
      description: 'Three former staffers and a rolodex: relations +5, then a little every month.',
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
      revealResearch: 120,
      title: 'License the code hosts',
      cost: { research: 300000 },
      description: 'Every public repository, its history and its issues: +20 T of data.',
      trigger: (s) => s.flags['publishersDone'] === true && (counter(s, 'dataShortCount') >= 2 || dataWall(s)),
      prereq: (s) => s.flags['publishersDone'] === true,
      urgent: (s) => s.flags['publishersDone'] === true && dataWall(s),
      buy: (s) => {
        s.data += 20;
      },
      consoleMsg: 'Every public repository, licensed. +20 T.',
    }),
    s2project({
      id: 'p_brief',
      revealFunds: 200,
      title: 'Brief the administration',
      cost: { research: 200000 },
      description: 'A windowless room, a deck and a model that answers questions: relations +8.',
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
      revealFunds: 150,
      title: 'Long-horizon memory',
      cost: { research: 250000 },
      description: 'Copies remember yesterday: they finish a quarter more tasks.',
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
      cost: (s) => ({ funds: s2(s, 500000), research: 50000 }),
      description: 'Forty countries on the same day: market ×1.6.',
      trigger: (s) => (counter(s, 'r0') > 0 && s.stats.revPerSec >= 12 * counter(s, 'r0')) || s.date >= monthOf(2026, 5),
      buy: (s) => {
        s.demandMult *= 1.6;
      },
      stages: [2, 3],
      consoleMsg: 'Sage launches in forty countries. Market ×1.6.',
      logMsg: 'Sage launches in forty countries on the same day. Two ban it by Friday.',
    }),
    s2project({
      id: 'p_g5',
      title: 'Nimbus G5 order',
      cost: (s) => ({ funds: s2(s, 800000), research: 150000 }),
      description: 'Next year\'s chip this year: new lots are G5s, half again the compute, powered first.',
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
      cost: (s) => ({ funds: s2(s, 900000) }),
      description: 'Homework help for anyone with a school email: approval up, the market a little wider.',
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
      revealFunds: 120,
      title: 'Distillation: Sage-mini',
      cost: { research: 350000, insight: 150 },
      description: 'A small model taught by the big one: twice the copies per GPU, and a wider market.',
      trigger: (s) => best(s) >= 2.6 || s.date >= monthOf(2026, 9),
      buy: (s) => {
        s.copiesPerGPU *= 2;
        s.demandMult *= 1.3;
      },
      stages: [2, 3],
      consoleMsg: 'Sage-mini released. A tenth of the cost, most of the skill. Copies per GPU ×2.',
      logMsg: 'A mini model, ten times cheaper. "Bigger than smartphones? Bigger than fire?"',
    }),
    s2project({
      id: 'p_flywheel',
      revealFunds: 60,
      title: 'Data flywheel',
      cost: (s) => ({ research: 500000, funds: s2(s, 4000000) }),
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
      revealFunds: 60,
      title: 'Behind-the-meter',
      cost: (s) => ({ funds: s2(s, 500000) }),
      description: 'Plants on our side of the meter: the queue drops to 30 s and curtailment stops mattering.',
      trigger: (s) => s.solarFarms + s.powerQueue.filter((o) => o.kind === 'solar').length >= 2,
      prereq: (s) => s.revealed['solarButton'] === true,
      buy: (s) => {
        applyBehindTheMeter(s);
      },
      consoleMsg: 'The plants sit on our side of the meter now. The queue is 30 seconds.',
    }),
    s2project({
      id: 'p_license_archive',
      revealResearch: 150,
      title: 'License the archives',
      cost: { research: 1000000 },
      description: 'Four national archives of books, broadcasts and court records: +40 T.',
      trigger: (s) => isBought(s, 'p_license_code') && dataWall(s),
      prereq: (s) => isBought(s, 'p_license_code'),
      urgent: (s) => isBought(s, 'p_license_code') && dataWall(s),
      buy: (s) => {
        s.data += 40;
      },
      consoleMsg: 'Four national archives, licensed. +40 T.',
    }),
    s2project({
      id: 'p_checkpoint_farm',
      revealResearch: 60,
      title: 'Checkpoint farm',
      cost: { research: 100000 },
      description: 'Every run keeps every checkpoint: four times the research capacity.',
      trigger: (s) => isBought(s, 'p_exp_scheduler') && capWall(s),
      prereq: (s) => isBought(s, 'p_exp_scheduler'),
      urgent: (s) => isBought(s, 'p_exp_scheduler') && atPlateau(s),
      buy: (s) => {
        s.labMult *= 4;
      },
      consoleMsg: 'Checkpoint farm online. The lab holds four times as much.',
    }),
    s2project({
      id: 'p_series_c',
      title: 'Series C',
      cost: {},
      priceTag: '(free)',
      description: 'A pension fund leads: money and three more board seats of Trust.',
      trigger: (s) => s.tasks >= 2e9,
      buy: (s) => {
        addFunds(s, s2(s, 10000000));
        s.trust += 3;
        say(s, `Series C closed. ${fmtMoneyShort(s2(s, 10000000))}. The lead investor is a pension fund.`);
      },
      logMsg: 'OpenMind raises a Series C. Share of the public naming AI the top problem: 3%.',
    }),
    s2project({
      id: 'p_dashboard',
      revealFunds: 45,
      late: true,
      title: 'Dashboard',
      cost: { research: 600000 },
      description: 'One screen with the numbers nobody was watching.',
      trigger: (s) => best(s) >= 2.8,
      buy: (s) => {
        s.revealed['stats'] = true;
      },
      stages: [2, 3],
      consoleMsg: 'Dashboard online. Some of the numbers were not being watched.',
    }),
    s2project({
      id: 'p_superhuman_coder',
      pinned: true,
      title: 'Let Sage-3 write the code',
      priceTag: (s) => (exitReady(s) ? '(ready)' : '(needs a 4.00× model, public or internal)'),
      cost: {},
      description: 'Every engineer becomes a manager of copies. Hiring, marketing, data and Trust end here.',
      trigger: (s) => best(s) >= 2.8,
      canAfford: exitReady,
      buy: (s) => {
        enterStage(s, 3);
      },
    }),
    s2project({
      id: 'p_honesty_evals',
      revealFunds: 90,
      late: true,
      title: 'Honesty evals',
      cost: { research: 500000 },
      description: 'Tests for whether the model tells the truth when a lie scores better; expect bad news.',
      trigger: (s) => best(s) >= LATE_AT(3.4),
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
      revealFunds: 90,
      late: true,
      grant: true,
      title: 'Retire human code review',
      cost: { research: 1200000 },
      description: 'Sage reviews Sage: the research copies get half again as much done.',
      trigger: (s) => best(s) >= LATE_AT(3.6),
      buy: (s) => {
        s.aiResearchMult *= 1.5;
        s.alignmentTrue = Math.max(0, s.alignmentTrue - 2);
        if (s.stage >= 3) granted(s, 'Retire human code review', 5);
        else s.autonomy += 5;
      },
      stages: [2, 3],
      consoleMsg: 'Sage reviews Sage\'s code now. Merges go through at 3 a.m.',
      logMsg: 'At OpenMind, nobody has written a line of code by hand since Thursday.',
    }),
    s2project({
      id: 'p_system_card',
      revealFunds: 90,
      late: true,
      title: 'Sage-3 system card',
      cost: { research: 1500000 },
      description: 'Ninety pages on what the next model can do: relations and approval up.',
      trigger: (s) => best(s) >= LATE_AT(3.7),
      buy: (s) => {
        s.alignmentApparent = Math.min(100, s.alignmentApparent + 3);
        moveGov(s, 3);
      },
      consoleMsg: 'System card drafted: 90 pages on a model nobody has met.',
    }),
    s2project({
      id: 'p_g6_preorder',
      ignoresCap: true,
      late: true,
      title: 'Nimbus G6 pre-order',
      cost: (s) => ({ funds: s2(s, 40000000) }),
      description: '2027\'s wafers paid for now: 100,000 G6s when Formosa Fab can ship them.',
      trigger: (s) => best(s) >= LATE_AT(3.7) || (s.revealed['shareEvals'] === true && s.date >= monthOf(2026, 11)),
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
      cost: (s) => ({ build: s2(s, 60000000) }),
      description: 'Land and a grid connection in Indiana, for when Abilene\'s slots run out.',
      trigger: (s) => gpuCapacity(s) >= 800000 || best(s) >= LATE_AT(3.85),
      buy: (s) => {
        s.flags['site2'] = true;
      },
      stages: [2, 3],
      consoleMsg: 'Land optioned in New Carlisle. Abilene will not be enough.',
    }),
    s2project({
      id: 'p_community',
      revealFunds: 90,
      late: true,
      title: 'Community benefits agreement',
      cost: (s) => ({ funds: s2(s, 5000000) }),
      description: 'A school, a clinic and a water study, signed with Abilene: approval up.',
      trigger: (s) => s.flags['protested'] === true,
      prereq: (s) => s.flags['protested'] === true,
      buy: () => undefined,
      stages: [2, 3],
      consoleMsg: 'Community agreement signed. A school, a clinic, a water study.',
    }),
    s2project({
      id: 'p_retention',
      revealFunds: 60,
      late: true,
      title: 'Counter-offer for the alignment lead',
      cost: (s) => ({ funds: s2(s, 20000000) }),
      description: 'She has not said no; if she leaves, she takes what she knows.',
      trigger: (s) => best(s) >= LATE_AT(3.9),
      onShow: (s) => say(s, 'Anthrosoft has offered the alignment lead twice her salary. She has not said no.'),
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
      },
      consoleMsg: 'Counter-offer signed. The alignment lead stays, with a team of her own.',
      logMsg: 'OpenMind matches an offer for its alignment lead. The number is not disclosed.',
    }),
  ];
}

function researchSecondsAway(s: GameState): number {
  if (!s.revealed['training']) return 0;
  const need = researchFor(startCapability(s));
  const rate = Math.max(1, s.researchers * 10);
  return Math.max(0, need - s.research) / rate;
}

function priceLowFor(s: GameState): number {
  const since = s.flags['priceLowSince'];
  return typeof since === 'number' ? s.stats.timePlayed - since : 0;
}

function dataSourceAffordable(s: GameState): boolean {
  return ['p_license_code', 'p_license_archive', 'p_synth', 'p_web_crawl'].some((id) => {
    const def = PROJECTS.find((p) => p.id === id);
    const st = s.projects[id];
    return !!def && !!st?.shown && st.bought < def.uses && def.canAfford(s);
  });
}
