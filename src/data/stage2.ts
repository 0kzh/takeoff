import type { GameState } from '../engine/state.js';
import { isBought, say } from '../engine/state.js';
import { monthOf } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { gpuCapacity, queuedMW, powerDrawMW } from '../engine/infrastructure.js';
import { dataShort, dataNotInHand } from '../engine/world.js';
import { trainingRun } from '../engine/training.js';
import { openChoice, fireDevelopment, modalCanOpen } from '../engine/events.js';
import { LATE_AT } from './projects.js';

/**
 * The Stage 2 content table (stage2.md §4.2), in order: queue order, expected order, and the order
 * the cadence governor walks. Projects are rows by id (their definitions are in projects.ts); the
 * other rows — buttons, panels, modals — are defined here with their trigger and prerequisite.
 */
export type RowKind = 'project' | 'flag' | 'choice';

/**
 * A new panel, verb, toggle, slider or Stores row (arc G2). `secondPipeline` and `queue` are
 * bookkeeping flags (Parallel pipelines bought; the first plant in the interconnect queue).
 */
export const MECHANIC_FLAGS = [
  'stores', 'infrastructure', 'autoPrice', 'gasButton', 'dataRow', 'graph', 'allocation', 'dcButton', 'solarButton',
  'queue', 'standingOrder', 'releaseInternal', 'government', 'secondPipeline', 'security', 'public', 'nuclearButton',
  'jobFund', 'stats', 'sl3Button', 'alignShare', 'shareEvals', 'chipsRow',
];

export interface ContentRow {
  id: string;
  kind: RowKind;
  /** Reveals a new panel or mechanic: the governor also pulls these when mechanics run dry (240 s). */
  mechanic?: boolean;
  /** Approach item: from 3×, through the late drip. */
  late?: boolean;
  /** False for rows the governor never pulls (c_sage2, c_publishers, toggles). */
  governed?: boolean;
  /** Hard condition the governor respects (flags and choices; projects carry their own). */
  prereq?: (s: GameState) => boolean;
  /** When the row appears on its own (flags and choices). */
  trigger?: (s: GameState) => boolean;
  /** Already revealed or opened. */
  done?: (s: GameState) => boolean;
  /** Reveal it now; false when it cannot happen right now (a modal that would have to wait). */
  reveal?: (s: GameState) => boolean;
}

const ts = (s: GameState) => s.stats.timeInStage;
const releasesS2 = (s: GameState) => (typeof s.flags['releasesThisStage'] === 'number' ? (s.flags['releasesThisStage'] as number) : 0);

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

/** A modal opened by a dated development (month or trigger): the governor fires the development early. */
function devChoiceRow(id: string, dev: string, opts: { prereq?: (s: GameState) => boolean; late?: boolean; mechanic?: boolean } = {}): ContentRow {
  return {
    id,
    kind: 'choice',
    ...opts,
    // The development's own month/trigger opens it; the table only lets the governor pull it early.
    trigger: () => false,
    done: (s) => s.developments[dev] === true,
    reveal: (s) => {
      if (!modalCanOpen(s)) return false;
      fireDevelopment(s, dev);
      return true;
    },
  };
}

/** A modal the engine opens on its trigger (queued behind the 150 s spacing if it must wait). */
function choiceRow(id: string, opts: { trigger: (s: GameState) => boolean; prereq?: (s: GameState) => boolean; late?: boolean; governed?: boolean; mechanic?: boolean; open?: (s: GameState) => boolean }): ContentRow {
  return {
    id,
    kind: 'choice',
    late: opts.late,
    mechanic: opts.mechanic,
    governed: opts.governed,
    prereq: opts.prereq,
    trigger: opts.trigger,
    done: (s) => s.flags[`opened:${id}`] === true,
    reveal: (s) => {
      // Late and governed modals open only when they can open now; the rest may queue.
      if ((opts.late || !opts.trigger(s)) && !modalCanOpen(s)) return false;
      if (opts.open && !opts.open(s)) return false;
      s.flags[`opened:${id}`] = true;
      if (!opts.open) openChoice(s, id, {});
      return true;
    },
  };
}

const project = (id: string): ContentRow => ({ id, kind: 'project' });

export const STAGE2_TABLE: ContentRow[] = [
  flagRow('btn-gpuBatch', 'infrastructure', { trigger: () => true }),
  project('p_research_cluster'),
  flagRow('btn-turbines', 'gasButton', { mechanic: true,
    trigger: (s) => s.gpus >= 0.6 * s.powerCapacityMW * 1000 || ts(s) >= 120,
    // The draw it prints is the draw there is (critic S2 round 2 §8.8.1: `60%` printed at 20 %).
    onReveal: (s) => say(s, `Power draw is ${Math.round((100 * powerDrawMW(s)) / Math.max(1, s.powerCapacityMW))}% of the site's ${s.powerCapacityMW} MW. Gas turbines can be on site in a week.`),
  }),
  project('p_web_crawl'),
  flagRow('panel-graph', 'graph', { mechanic: true, trigger: (s) => releasesS2(s) >= 1 || s.flags['rivalS2'] === true }),
  project('p_ai_assistants'),
  project('p_series_b'),
  flagRow('btn-datacenter', 'dcButton', { mechanic: true, trigger: (s) => s.gpus >= 0.6 * gpuCapacity(s) || ts(s) >= 330 }),
  project('p_agent_platform'),
  flagRow('btn-solar', 'solarButton', { mechanic: true,
    trigger: (s) => typeof s.flags['firstGasAt'] === 'number' && s.stats.timePlayed - (s.flags['firstGasAt'] as number) >= 30,
    prereq: (s) => s.revealed['gasButton'] === true,
    onReveal: (s) => say(s, 'Solar + storage: cheaper power, but it waits in the interconnect queue.'),
  }),
  project('p_standing_order'),
  project('p_scaffold'),
  project('p_exp_scheduler'),
  {
    id: 'c_sage2',
    kind: 'choice',
    governed: false,
    trigger: () => false,
    done: (s) => s.flags['sage2Decided'] === true,
  },
  project('p_spec'),
  project('p_auto_evals'),
  project('p_sl2'),
  choiceRow('c_publishers', {
    governed: false,
    // At the first data shortfall (round 2 item 2), whether or not the crawl has run dry.
    trigger: (s) => dataNotInHand(s) || (isBought(s, 'p_web_crawl') && s.crawlLeft <= 0 && dataShort(s)),
    prereq: (s) => isBought(s, 'p_web_crawl') && s.crawlLeft <= 0,
  }),
  project('p_synth'),
  project('p_parallel'),
  devChoiceRow('c_hearing', 'd_hearing', { mechanic: true }),
  project('p_policy'),
  project('p_license_code'),
  project('p_brief'),
  project('p_memory'),
  project('p_international'),
  project('p_g5'),
  flagRow('panel-public', 'public', { mechanic: true, trigger: (s) => s.jobsDisplaced >= 0.07 || s.date >= monthOf(2026, 8) }),
  project('p_free_tier'),
  choiceRow('c_evals_month', { trigger: (s) => s.flags['evalsMonthDue'] === true, prereq: (s) => s.flags['evalsMonthDue'] === true }),
  devChoiceRow('c_gulf', 'd_gulf', { prereq: (s) => s.gasPlants >= 1 }),
  flagRow('btn-nuclear', 'nuclearButton', { mechanic: true,
    trigger: (s) => s.flags['gulfDeclined'] === true || s.powerCapacityMW + queuedMW(s) >= 110 || s.date >= monthOf(2026, 9),
    prereq: (s) => s.revealed['solarButton'] === true,
  }),
  project('p_distill'),
  devChoiceRow('c_defense', 'd_pentagon', { prereq: (s) => s.revealed['government'] === true && s.govRelations >= 40 }),
  flagRow('btn-jobFund', 'jobFund', {
    // A mechanic the governor may bring forward once the Public panel is up (critic C8: the middle's
    // mechanic holes).
    mechanic: true,
    trigger: (s) => s.revealed['public'] === true && (s.jobsDisplaced >= 0.5 || s.approval <= -8),
    prereq: (s) => s.revealed['public'] === true,
  }),
  project('p_flywheel'),
  project('p_btm'),
  project('p_license_archive'),
  project('p_checkpoint_farm'),
  project('p_series_c'),
  // ---- the approach ----
  project('p_dashboard'),
  project('p_superhuman_coder'),
  choiceRow('c_theft_warning', {
    late: true,
    mechanic: true,
    // The release that crosses ~3× (minutes 21–24): the approach's first mechanic arrives with it.
    trigger: (s) => bestCapability(s) >= LATE_AT(3.15),
    open: (s) => {
      if (s.securityLevel >= 3) {
        // Nothing to warn about: the intrusion stops at the air gap.
        fireDevelopment(s, 'd_airgap');
        return true;
      }
      return openChoice(s, 'c_theft_warning', {});
    },
  }),
  flagRow('btn-sl3', 'sl3Button', {
    late: true,
    mechanic: true,
    // A release after the theft warning (~25 min), unless the warning already put it on screen.
    trigger: (s) => bestCapability(s) >= LATE_AT(3.4) && s.securityLevel < 3,
    prereq: (s) => s.securityLevel < 3,
  }),
  flagRow('btn-alignShare', 'alignShare', {
    late: true,
    mechanic: true,
    // The last new control before the exit: the run that should cross 4× is training (or it is December).
    trigger: (s) =>
      (bestCapability(s) >= LATE_AT(3.7) && trainingRun(s) !== null) ||
      (s.revealed['shareEvals'] === true && s.date >= monthOf(2026, 12)),
    // The governor may bring it forward, but not before the model is most of the way to 4×.
    prereq: (s) => bestCapability(s) >= LATE_AT(3.6),
    onReveal: (s) => say(s, 'Alignment compute: a share of the copies can check the others. It is 1% now.'),
  }),
  project('p_honesty_evals'),
  choiceRow('c_pact', { late: true, mechanic: true, trigger: (s) => bestCapability(s) >= LATE_AT(3.5) }),
  project('p_code_review'),
  project('p_system_card'),
  project('p_g6_preorder'),
  project('p_site2'),
  project('p_community'),
  project('p_retention'),
];

/** Late rows in table order (projects included), for the late queue. */
export const STAGE2_ORDER: Map<string, number> = new Map(STAGE2_TABLE.map((r, i) => [r.id, i]));

export function rowById(id: string): ContentRow | undefined {
  return STAGE2_TABLE.find((r) => r.id === id);
}

/**
 * The approach: late items may appear once the best model reaches 2.8×, when the exit project goes
 * up (stage2.md says 3.0×; one run earlier keeps the approach's content and the exit's lead time
 * from depending on how far the crossing run jumps).
 */
export const APPROACH = 2.8;

export function inApproach(s: GameState): boolean {
  return s.stage === 2 && bestCapability(s) >= APPROACH;
}

