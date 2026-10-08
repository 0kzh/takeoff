import { GameState, Cost, canPay } from '../engine/state.js';
import { researchCap, researchRate } from '../engine/economy.js';

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
  sideline?: boolean;
  onShow?: (s: GameState) => void;
  revealFunds?: number;
  revealResearch?: number;
  repeatable?: boolean;
  consoleMsg?: string;
  logMsg?: string;
}

export type ProjectInput = Omit<ProjectDef, 'canAfford' | 'stages' | 'uses' | 'cost'> & {
  cost: Cost | ((s: GameState) => Cost);
} & Partial<Pick<ProjectDef, 'canAfford' | 'stages' | 'uses'>>;

export function project(def: ProjectInput): ProjectDef {
  const base = typeof def.cost === 'function' ? def.cost : ((c: Cost) => () => c)(def.cost);
  const secs = def.revealFunds;
  const rsecs = def.revealResearch;
  const fixed = secs === undefined && rsecs === undefined;
  const cost = fixed ? base : (s: GameState): Cost => {
    const c = base(s);
    const out: Cost = { ...c };
    if (secs !== undefined) {
      const floor = revealPrice(s, def.id, secs);
      out.funds = Math.max(c.funds ?? 0, c.funds ? Math.min(floor, 4 * c.funds) : floor);
    }
    if (rsecs !== undefined) out.research = Math.max(c.research ?? 0, revealResearchPrice(s, def.id, rsecs));
    return out;
  };
  const onShow = fixed ? def.onShow : (s: GameState) => {
    if (secs !== undefined) s.flags[`price:${def.id}`] = revealPrice(s, def.id, secs);
    if (rsecs !== undefined) s.flags[`rprice:${def.id}`] = revealResearchPrice(s, def.id, rsecs);
    def.onShow?.(s);
  };
  return {
    stages: [1],
    uses: 1,
    canAfford: (s) => canPay(s, cost(s)),
    ...def,
    cost,
    onShow,
  };
}

export function revealPrice(s: GameState, id: string, seconds: number): number {
  const fixed = s.flags[`price:${id}`];
  if (typeof fixed === 'number') return fixed;
  return twoFigures(seconds * Math.max(1, s.stats.revPerSec));
}

export function revealResearchPrice(s: GameState, id: string, seconds: number): number {
  const fixed = s.flags[`rprice:${id}`];
  if (typeof fixed === 'number') return fixed;
  return Math.min(twoFigures(seconds * Math.max(1, researchRate(s))), Math.floor((0.85 * researchCap(s)) / 100) * 100);
}

function twoFigures(raw: number): number {
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.round(raw / unit) * unit;
}

