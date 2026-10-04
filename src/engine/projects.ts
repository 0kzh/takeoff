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
  // A grant's first line is its WARNING (stage3.md §4.2), so its effect runs before its message.
  if (def.grant) def.buy(s);
  if (def.consoleMsg) say(s, def.consoleMsg);
  // Stage 2's carried cards keep their console line in Stage 3; the Developments log is Stage 3's own.
  const carriedIntoS3 = s.stage >= 3 && def.stages.some((x) => x < 3);
  if (def.logMsg && !carriedIntoS3) logNews(s, def.logMsg);
  if (!def.grant) def.buy(s);
  return true;
}
