import type { GameState } from '../engine/state.js';
import { monthOf } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { openChoice, modalCanOpen } from '../engine/events.js';
import { chipsOpen } from '../engine/stage4.js';
import type { ContentRow } from './stage2.js';
import { approach4 } from './projects4.js';

export const MECHANIC_FLAGS_S4 = [
  'robots', 'robotsRow', 'robotFleet', 'materialsRow', 'generations', 'society', 'housing', 'ubi', 'agenda', 'hearing',
  'treaty', 'draft', 'fleetGoal', 'approvalTarget', 'stance', 'treatyAppetite', 'fleetChips', 'breakers', 'ashford',
  'nano', 'shutdown', 'ashfordDeaths',
];

const ts = (s: GameState) => s.stats.timeInStage;
const best = (s: GameState) => bestCapability(s);

function flagRow(id: string, flag: string, opts: Omit<ContentRow, 'id' | 'kind' | 'done' | 'reveal'> & { onReveal?: (s: GameState) => void }): ContentRow {
  return {
    id,
    kind: 'flag',
    ...opts,
    done: (s) => s.revealed[flag] === true,
    reveal: (s) => {
      s.revealed[flag] = true;
      opts.onReveal?.(s);
      return true;
    },
  };
}

function choiceRow(id: string, opts: { trigger: (s: GameState) => boolean; prereq?: (s: GameState) => boolean; late?: boolean; mechanic?: boolean; onOpen?: (s: GameState) => void }): ContentRow {
  return {
    id,
    kind: 'choice',
    late: opts.late,
    mechanic: opts.mechanic,
    prereq: opts.prereq,
    trigger: opts.trigger,
    done: (s) => s.flags[`opened:${id}`] === true,
    reveal: (s) => {
      if (!modalCanOpen(s)) return false;
      s.flags[`opened:${id}`] = true;
      opts.onOpen?.(s);
      openChoice(s, id, {});
      return true;
    },
  };
}

const project = (id: string): ContentRow => ({ id, kind: 'project' });

export const STAGE4_TABLE: ContentRow[] = [
  project('p_car_plant'),
  project('p_atlas2'),
  flagRow('panel-society', 'society', {
    mechanic: true,
    trigger: (s) => ts(s) >= 120,
    onReveal: (s) => {
      s.revealed['public'] = false;
      s.revealed['housing'] = true;
    },
  }),
  project('p_deep_mines'),
  project('p_fleet_auto'),
  project('p_talks'),
  project('p_early_warning'),
  project('p_cures'),
  project('p_robot_fabs'),
  project('p_inspectors'),
  choiceRow('c_sez', {
    mechanic: true,
    trigger: (s) => s.robots >= 0.6 * s.s4.permitCap || ts(s) >= 540,
    prereq: (s) => s.flags['zones'] === undefined,
  }),
  project('p_monitors_scale'),
  project('p_concord'),
  project('p_transition_auto'),
  project('p_verify'),
  choiceRow('c_ashford', {
    mechanic: true,
    trigger: (s) => ts(s) >= 600 && (s.date >= monthOf(2028, 3) + 0.6 || s.jobsDisplaced >= 300),
    prereq: (s) => ts(s) >= 600 && s.s4.ashfordPhase === 'none',
  }),
  choiceRow('c_consolidation', {
    trigger: (s) => ts(s) >= 720,
    prereq: (s) => s.flags['dpa'] !== true,
  }),
  project('p_halt'),
  project('p_terms'),
  project('p_negotiate_auto'),
  project('p_nanofab'),
  project('p_nano_oversight'),
  project('p_hardened'),
  project('p_revoke'),
  project('p_proofing'),
  flagRow('#treatyAppetite', 'treatyAppetite', {
    late: true,
    mechanic: true,
    trigger: (s) => s.s4.talks === 'open' && (s.s4.treaty >= 75 || ts(s) >= 1290),
    prereq: (s) => s.s4.talks === 'open',
  }),
  project('p_spec4'),
  choiceRow('c_autonomy', {
    late: true,
    mechanic: true,
    trigger: (s) => best(s) >= 250,
    prereq: (s) => best(s) >= 250 - 1e-9,
  }),
  project('p_autonomy'),
  project('p_concord1'),
  project('p_launch'),
  flagRow('#fleetChips', 'fleetChips', {
    late: true,
    mechanic: true,
    trigger: chipsOpen,
    prereq: chipsOpen,
    onReveal: (s) => {
      s.flags['fleetChipsSaid'] = s.stats.timePlayed;
    },
  }),
  project('p_chip_lines'),
  project('p_last_signoff'),
  project('p_interp4'),
  project('p_interp5'),
  project('p_monitor3'),
  project('p_freeze'),
];

export const STAGE4_ORDER: Map<string, number> = new Map(STAGE4_TABLE.map((r, i) => [r.id, i]));

export function rowById4(id: string): ContentRow | undefined {
  return STAGE4_TABLE.find((r) => r.id === id);
}

export function inApproach4(s: GameState): boolean {
  return s.stage === 4 && approach4(s);
}
