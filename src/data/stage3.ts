import type { GameState } from '../engine/state.js';
import { monthOf } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { openChoice, fireDevelopmentOnce, fireCrisis, modalCanOpen } from '../engine/events.js';
import type { ContentRow } from './stage2.js';

export const MECHANIC_FLAGS_S3 = [
  'alignment', 'monitors', 'lobby', 'autoTrain', 'experiments', 'alignWork', 'drift', 'rogueRow', 'geopolitics',
  'counterintel', 'redteamDepth', 'shipments', 'buildout', 'buildBudget', 'sendBack', 'payments', 'oversight',
  'incidents', 'trueAlignment', 'honeypot', 'noise', 'successor', 'lie', 'monitorGen', 'reimage', 'publicModel',
  'stepSize', 'holdRuns', 'memo', 'session', 'order', 'formosa', 'marsa',
];

const ts = (s: GameState) => s.stats.timeInStage;
const best = (s: GameState) => bestCapability(s);
const date = (s: GameState, m: number) => s.date >= monthOf(2027, m);

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

const stolen = (s: GameState) => s.flags['weightsStolen'] === true;

export const STAGE3_TABLE: ContentRow[] = [
  project('p_monitor2'),
  flagRow('btn-lobby', 'lobby', { mechanic: true, trigger: () => true }),
  flagRow('btn-alignWork', 'alignWork', { mechanic: true, trigger: (s) => ts(s) >= 15 }),
  project('p_auto_train'),
  project('p_interp1'),
  project('p_enterprise_agents'),
  flagRow('panel-geopolitics', 'geopolitics', {
    mechanic: true,
    trigger: (s) => ts(s) >= 150 || stolen(s),
    onReveal: (s) => {
      s.revealed['counterintel'] = true;
      if (s.gulfExposure > 0) s.revealed['marsa'] = true;
    },
  }),
  project('p_auto_redteam'),
  project('p_g6'),
  project('p_sl4'),
  project('p_buildout'),
  project('p_model_organisms'),
  choiceRow('c_neuralese', { mechanic: true, trigger: (s) => best(s) >= 5.6 || ts(s) >= 510 }),
  project('p_interp2'),
  project('p_gov_cloud'),
  project('p_auto_research'),
  project('p_stockpile'),
  project('p_honeypots'),
  flagRow('btn-payments', 'payments', {
    mechanic: true,
    trigger: (s) => s.approval <= -15 || s.jobsDisplaced >= 5.5,
    onReveal: (s) => {
      if (s.jobFund) {
        s.flags['payments'] = 1;
        s.jobFund = false;
      }
      s.revealed['jobFund'] = false;
    },
  }),
  choiceRow('c_committee', { mechanic: true, trigger: (s) => best(s) >= 7 || date(s, 4) || (s.majorIncidents ?? 0) >= 1 }),
  project('p_sl5'),
  project('p_interp3'),
  project('p_debate'),
  project('p_second_source'),
  project('p_kill_switch'),
  choiceRow('c_hormuz', {
    mechanic: true,
    trigger: (s) => date(s, 5) && s.gulfExposure > 0,
    prereq: (s) => s.gulfExposure > 0,
    onOpen: (s) => fireDevelopmentOnce(s, 'd_tehran'),
  }),
  project('p_wiretaps'),
  flagRow('#monitorGen', 'monitorGen', {
    mechanic: true,
    trigger: (s) => best(s) >= 10 && s.training.major >= 4 && !(s.projects['p_monitor3']?.bought ?? 0),
    prereq: (s) => best(s) >= 10 && !(s.projects['p_monitor3']?.bought ?? 0),
    onReveal: () => undefined,
  }),
  project('p_monitor3'),
  project('p_self_directed'),
  project('p_auto_approve'),
  project('p_clinics'),
  choiceRow('c_mini', { mechanic: true, trigger: (s) => date(s, 7) || best(s) >= 13, prereq: (s) => best(s) >= 8 }),
  project('p_steward'),
  project('p_race'),
  project('p_interp4'),
  project('p_spec2'),
  project('p_fab'),
  choiceRow('c_blockade', {
    mechanic: true,
    trigger: (s) => (date(s, 8) || best(s) >= 14) && date(s, 6),
    prereq: (s) => date(s, 6),
    onOpen: (s) => {
      fireCrisis(s, 'cr_taiwan');
      fireDevelopmentOnce(s, 'd_blockade');
    },
  }),
  choiceRow('c_memo', { late: true, mechanic: true, trigger: (s) => best(s) >= 14 || date(s, 9) }),
  project('p_noise'),
  project('p_successor'),
  project('p_external'),
  project('p_come_clean'),
  project('p_freeze'),
  project('p_lie_test'),
  project('p_backups'),
  project('p_interp5'),
  project('p_pause'),
  project('p_swing'),
  project('p_dpa'),
];

export const STAGE3_ORDER: Map<string, number> = new Map(STAGE3_TABLE.map((r, i) => [r.id, i]));

export function rowById3(id: string): ContentRow | undefined {
  return STAGE3_TABLE.find((r) => r.id === id);
}

export function inApproach3(s: GameState): boolean {
  return s.stage === 3 && (best(s) >= 14 || date(s, 9));
}

export function dateFallback3(s: GameState): boolean {
  return s.stage === 3 && date(s, 9);
}
