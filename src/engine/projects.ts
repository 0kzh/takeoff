import { GameState, Cost, projectState, pay, say, logNews } from './state.js';
import { PROJECTS, ProjectDef } from '../data/projects.js';
import { fmtInt, fmtMoneyShort, fmtTonnes, fmtShortNum } from './format.js';

export function projectById(id: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.id === id);
}

/** A price in words: `$12M, 3 Trust`; Stage 4's big research prices short (`1.2B research`). */
export function costLabel(c: Cost, short = false): string {
  const parts: string[] = [];
  const n = (v: number) => (short ? fmtShortNum(v) : fmtInt(v));
  if (c.funds) parts.push(fmtMoneyShort(c.funds));
  if (c.research) parts.push(`${n(c.research)} research`);
  if (c.insight) parts.push(`${n(c.insight)} insight`);
  if (c.trust) parts.push(`${fmtInt(c.trust)} Trust`);
  if (c.materials) parts.push(`${fmtTonnes(c.materials)}`);
  return parts.length ? parts.join(', ') : 'free';
}

export function priceTag(s: GameState, def: ProjectDef): string {
  if (typeof def.priceTag === 'function') return def.priceTag(s);
  return def.priceTag ?? `(${costLabel(def.cost(s), s.stage >= 4)})`;
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
