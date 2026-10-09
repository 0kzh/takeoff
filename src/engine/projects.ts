import { GameState, Cost, projectState, pay, say, logNews } from './state.js';
import { PROJECTS, ProjectDef } from '../data/projects.js';
import { fmtInt, fmtMoneyShort } from './format.js';

export function projectById(id: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function costLabel(c: Cost): string {
  const parts: string[] = [];
  if (c.funds) parts.push(fmtMoneyShort(c.funds));
  if (c.research) parts.push(`${fmtInt(c.research)} research`);
  if (c.insight) parts.push(`${fmtInt(c.insight)} insight`);
  if (c.trust) parts.push(`${fmtInt(c.trust)} Trust`);
  if (c.power) parts.push(`${fmtInt(c.power)} kWh`);
  return parts.length ? parts.join(', ') : 'free';
}

export function priceTag(s: GameState, def: ProjectDef): string {
  if (typeof def.priceTag === 'function') return def.priceTag(s);
  return def.priceTag ?? `(${costLabel(def.cost(s))})`;
}

function remainingUses(s: GameState, def: ProjectDef): number {
  return def.uses - (s.projects[def.id]?.bought ?? 0);
}

export function isVisible(s: GameState, def: ProjectDef): boolean {
  const st = s.projects[def.id];
  return !!st && st.shown && remainingUses(s, def) > 0 && def.stages.includes(s.stage);
}

export function visibleProjects(s: GameState): ProjectDef[] {
  return PROJECTS.filter((p) => isVisible(s, p));
}

export function buyProject(s: GameState, id: string): boolean {
  const def = projectById(id);
  if (!def || !isVisible(s, def) || !def.canAfford(s)) return false;
  if (!pay(s, def.cost(s))) return false;
  const st = projectState(s, id);
  st.bought += 1;
  if (remainingUses(s, def) > 0 && def.rehide) st.shown = false;
  if (def.consoleMsg) say(s, def.consoleMsg);
  if (def.logMsg) logNews(s, def.logMsg);
  def.buy(s);
  return true;
}
