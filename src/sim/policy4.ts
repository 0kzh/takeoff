import { GameState, isBought } from '../engine/state.js';
import type { Actions } from '../engine/tick.js';
import type { BotMemory } from './policy.js';
import { visibleProjects } from '../engine/projects.js';
import { choiceById, choiceOptionEnabled } from '../engine/events.js';
import { atPermitCap, fleetAuto, housingCost, FleetJob } from '../engine/fleet.js';
import { approvalTargetS4, ubiTerm } from '../engine/society.js';
import { seats } from '../engine/world3.js';
import { treatyCeiling, talksOpen, treatyStall } from '../engine/treaty.js';
import { rogueShare, reimageCooldown } from '../engine/alignment.js';
import { counter } from '../engine/state.js';

export interface S4Memory {
  ubiBand?: number;
  warnSeen?: number;
  stallSeen?: number;
}

function mem4(mem: BotMemory): S4Memory {
  if (!mem.s4) mem.s4 = {};
  return mem.s4;
}

const has = (mem: BotMemory, v: string) => mem.variant.split(',').includes(v);

const NEVER = ['p_halt', 'p_autonomy', 'p_revoke'];

export function stage4Step(s: GameState, a: Actions, mem: BotMemory): void {
  mem.ticks += 1;
  mem.bought = [];
  if (s.ending || s.stage !== 4) return;
  if (mem.policy === 'naive' || mem.policy === 'greedy' || mem.policy === 'trainfirst') firstTimerS4(s, a, mem);
  else botS4(s, a, mem);
}

function readModal4(s: GameState, mem: BotMemory): boolean {
  const c = s.activeChoice;
  if (!c) return false;
  const key = `${c.id}|${JSON.stringify(c.context)}`;
  if (key !== mem.choiceKey) {
    mem.choiceKey = key;
    mem.choiceSince = s.stats.timePlayed;
  }
  return s.stats.timePlayed - mem.choiceSince >= 2.5;
}

function botAnswer(s: GameState, mem: BotMemory): number[] {
  const id = s.activeChoice!.id;
  const racer = mem.policy === 'racer';
  const cautious = mem.policy === 'cautious';
  switch (id) {
    case 'c_sez':
      return has(mem, 'sez-open') || racer ? [0] : has(mem, 'sez-none') || cautious ? [2] : [1];
    case 'c_ashford':
      return has(mem, 'labs') || racer ? [0] : has(mem, 'pool') ? [2] : [1];
    case 'c_consolidation':
      return has(mem, 'refuse-consolidation') ? [2] : has(mem, 'verify-off') || mem.policy === 'racer' ? [1, 2] : [0];
    case 'c_verify':
      return has(mem, 'sign-anyway') || racer ? [0, 1] : has(mem, 'walk-away') ? [0, 3] : [0, 2, 1];
    case 'c_autonomy':
      return has(mem, 'grant-at-first-ask') ? [0] : has(mem, 'refuse-fleet') ? [2, 1] : [1];
    case 'c_treaty':
      return [0];
    case 'c_halt':
      return has(mem, 'pause') ? [0] : [1];
    case 'c_order':
      return has(mem, 'refuse') ? [3] : [0, 2, 3];
    default:
      return [0, 1, 2, 3];
  }
}

function answer(s: GameState, a: Actions, order: number[]): void {
  const def = choiceById(s.activeChoice!.id);
  if (!def) return;
  const enabled = def.options.map((_, i) => i).filter((i) => choiceOptionEnabled(s, def, i));
  for (const i of order) {
    if (enabled.includes(i)) {
      a.resolveChoice(s, i);
      return;
    }
  }
  if (enabled.length) a.resolveChoice(s, enabled[0]!);
}

function verifyWanted(mem: BotMemory): boolean {
  if (has(mem, 'verify-off') || mem.policy === 'racer') return false;
  return true;
}

function alignWorkShare(mem: BotMemory): number {
  if (mem.policy === 'racer' || has(mem, 'alignwork-0')) return 0;
  if (has(mem, 'alignwork-30')) return 0.3;
  if (mem.policy === 'cautious' || has(mem, 'alignwork-20')) return 0.2;
  return 0.1;
}

function grantWanted(mem: BotMemory, id: string): boolean {
  if (mem.policy === 'cautious' || has(mem, 'grants-none')) return false;
  if (id === 'p_negotiate_auto') return mem.policy === 'racer' || has(mem, 'negotiate') || has(mem, 'grants-all');
  return true;
}

function wanted(s: GameState, mem: BotMemory, id: string): boolean {
  if (NEVER.includes(id)) return false;
  if (id === 'p_concord') return s.s4.treaty >= 100 - 1e-9;
  if (id === 'p_monitors_scale' && (has(mem, 'no-monitors') || mem.policy === 'racer')) return false;
  if (id === 'p_nanofab' && has(mem, 'nanofab-never')) return false;
  if (id === 'p_hardened' && has(mem, 'hardened-never')) return false;
  if (id === 'p_nano_oversight' && has(mem, 'nano-oversight-never')) return false;
  if (id === 'p_early_warning' && has(mem, 'warning-never')) return false;
  const p = visibleProjects(s).find((x) => x.id === id);
  if (!p) return false;
  if (p.grant === true) return grantWanted(mem, id);
  return true;
}

function fleetTarget(s: GameState, mem: BotMemory): Record<FleetJob, number> {
  let chips = 0;
  if (s.revealed['fleetChips'] && s.s4.chipsInstalled < 1) chips = has(mem, 'chips-25') ? 25 : has(mem, 'chips-100') ? 100 : 50;
  const capped = atPermitCap(s) || (s.flags['zones'] !== 'open' && s.robots >= 0.98 * s.s4.permitCap);
  if (chips >= 100) return { mine: 0, replicate: 0, build: 0, chips: 100 };
  if (chips > 0) {
    const rest = 100 - chips;
    const mine = Math.round((rest * 0.3) / 5) * 5;
    return { mine, replicate: 0, build: rest - mine, chips };
  }
  if (capped) return { mine: 30, replicate: 0, build: 70, chips: 0 };
  return { mine: 35, replicate: 40, build: 25, chips: 0 };
}

function setFleet(s: GameState, a: Actions, target: Record<FleetJob, number>): void {
  const jobs: FleetJob[] = ['mine', 'replicate', 'build', 'chips'];
  const now = (j: FleetJob) => Math.round(s.s4[j] * 100);
  for (const j of jobs) if (target[j] < now(j) && (j !== 'chips' || s.revealed['fleetChips'])) a.setFleetShare(s, j, target[j]);
  for (const j of jobs) if (target[j] > now(j) && (j !== 'chips' || s.revealed['fleetChips'])) a.setFleetShare(s, j, target[j]);
}

function ubiWanted(s: GameState, mem: BotMemory): number {
  if (has(mem, 'dividend-0')) return 0;
  if (has(mem, 'dividend-20')) return 0.2;
  const m = mem4(mem);
  const base = approvalTargetS4(s) - ubiTerm(s.s4.ubiShare);
  const prev = m.ubiBand ?? (s.s4.ubiShare >= 0.2 - 1e-9 ? 2 : s.s4.ubiShare >= 0.1 - 1e-9 ? 1 : 0);
  const want = base > -25 ? 0 : base > -55 ? 1 : 2;
  const band = want < prev && base <= (prev === 2 ? -55 : -25) + 3 ? prev : want;
  m.ubiBand = band;
  return band === 0 ? 0 : band === 1 ? 0.1 : 0.2;
}

function botS4(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal4(s, mem)) answer(s, a, botAnswer(s, mem));
  if (mem.ticks % 5 !== 0) return;
  const f = s.s4;

  if (visibleProjects(s).some((p) => p.id === 'p_car_plant') && a.buyProject(s, 'p_car_plant')) mem.bought.push('p_car_plant');

  if (s.revealed['generations']) a.setVerify(s, verifyWanted(mem));

  if (s.revealed['allocation']) a.setResearchAlloc(s, mem.policy === 'racer' ? 50 : 40);
  if (s.revealed['monitors']) {
    let m = mem.policy === 'racer' || has(mem, 'monitors-0') ? 5 : 15;
    if (rogueShare(s) > 0.02) m += 5;
    a.setMonitorShare(s, Math.max(m, Math.round((s.monitorShare ?? 0) * 100)));
  }
  if (s.revealed['reimage'] && rogueShare(s) >= 0.04 && reimageCooldown(s) <= 0) a.reimage(s);

  if (s.revealed['robotFleet'] && !fleetAuto(s)) setFleet(s, a, fleetTarget(s, mem));
  if (fleetAuto(s)) a.setFleetGoal(s, has(mem, 'goal-people') ? 'people' : has(mem, 'goal-treaty') || f.treaty >= 60 ? 'treaty' : 'growth');

  if (s.revealed['ubi'] && s.flags['transitionAuto'] !== true) a.setUbiShare(s, ubiWanted(s, mem));
  if (s.flags['transitionAuto'] === true) a.setApprovalHold(s, has(mem, 'hold-25') ? 25 : 0);

  if (s.revealed['alignWork']) a.setAlignWork(s, alignWorkShare(mem));
  if (s.revealed['draft']) {
    const { cap } = treatyCeiling(s);
    const drafting = !has(mem, 'draft-never') && talksOpen(s) && !treatyStall(s) && cap <= 80 && f.treaty < cap - 0.5;
    a.setDraftShare(s, drafting ? (has(mem, 'draft-30') ? 0.3 : 0.2) : 0);
  }

  for (const p of visibleProjects(s)) {
    if (!wanted(s, mem, p.id) || !p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  const housingWanted = approvalTargetS4(s) < 0 || (s.flags['transitionAuto'] === true && f.ubiShare > 0);
  const reserve = visibleProjects(s)
    .filter((p) => wanted(s, mem, p.id) && (p.cost(s).materials ?? 0) > 0 && (!p.prereq || p.prereq(s)))
    .reduce((m, p) => Math.max(m, p.cost(s).materials ?? 0), 0);
  if (s.revealed['housing'] && !has(mem, 'housing-never') && housingWanted && f.materials - reserve >= housingCost(s)) a.buildHousing(s, 1);
  if (s.revealed['hearing'] && !has(mem, 'hearings-never') && f.agenda.length === 0 && seats(s) < 8) a.holdHearing(s);
  if (s.flags['negotiateAuto'] === true) a.setStance(s, has(mem, 'stance-concede') ? 'concede' : has(mem, 'stance-hold') ? 'hold' : 'balanced');
  if (has(mem, 'pause') && !s.activeChoice) {
    const halt = visibleProjects(s).find((p) => p.id === 'p_halt');
    if (halt && halt.canAfford(s)) a.buyProject(s, 'p_halt');
  }
  if (has(mem, 'grant-at-first-ask') && !s.activeChoice && visibleProjects(s).some((p) => p.id === 'p_autonomy')) a.buyProject(s, 'p_autonomy');
}

function firstTimerS4(s: GameState, a: Actions, mem: BotMemory): void {
  if (s.activeChoice && readModal4(s, mem)) {
    const def = choiceById(s.activeChoice.id);
    if (def) {
      if (has(mem, 'refuse') && def.id === 'c_order') a.resolveChoice(s, 3);
      else {
        const first = def.options.map((_, i) => i).find((i) => choiceOptionEnabled(s, def, i));
        if (first !== undefined) a.resolveChoice(s, first);
      }
    }
  }
  if (mem.ticks % 10 !== 0) return;
  for (const p of visibleProjects(s)) {
    if (p.id === 'p_halt' || p.id === 'p_revoke' || !p.canAfford(s)) continue;
    if (a.buyProject(s, p.id)) mem.bought.push(p.id);
  }
  const m = mem4(mem);
  const warned = Math.max(counter(s, 'riotWarnAt'), counter(s, 'sabotageWarnAt'));
  if (s.revealed['ubi'] && warned > (m.warnSeen ?? 0)) {
    m.warnSeen = warned;
    if (s.s4.ubiShare < 0.2 - 1e-9) a.cycleUbi(s);
  }
  const stall = counter(s, 'treatyStallAt');
  if (s.revealed['hearing'] && stall > (m.stallSeen ?? 0)) {
    m.stallSeen = stall;
    if (seats(s) < 5) a.holdHearing(s);
  }
  if (s.revealed['housing'] && s.s4.materials >= housingCost(s) && (mem.policy === 'greedy' || mem.ticks % 100 === 0)) a.buildHousing(s, 1);
  if (s.revealed['hearing'] && s.s4.agenda.length === 0) a.holdHearing(s);
  if ((mem.policy === 'greedy' || mem.policy === 'trainfirst') && s.revealed['reimage'] && rogueShare(s) >= 0.02 && reimageCooldown(s) <= 0) a.reimage(s);
  void isBought;
}
