import { GameState } from './state.js';
import { fmtInt, fmtNum, fmtMoney, fmtClock } from './format.js';
import {
  contractRate, humanResearchRate, aiResearchRate, researchRate, researchCap, insightRate, insightTrickle, copies,
  taskShare, alignExtra, JOB_FUND_SHARE,
} from './economy.js';
import {
  freeSlots, freePowerGpus, poweredGpus, SUBSTATION_MW, GAS_MW, SOLAR_MW, NUCLEAR_MW, GULF_MW,
} from './infrastructure.js';
import { trainCost, busyGpus } from './training.js';
import { crawlRate, synthRate, flywheelRate } from './world.js';

/**
 * The Stores hover (stage2.md §2.13): for one row, every source and sink per second and a bold
 * total, as `[label, text, kind]` rows. DOM-free, so the sim and tests can read it.
 */
export type StoreKey = 'funds' | 'research' | 'insight' | 'trust' | 'gpus' | 'power' | 'copies' | 'data' | 'chips';
export type TipRow = [string, string, ('total' | 'note')?];

/** `+$2,148/s`, `−$43/s`, `+$1.2M/s`: whole dollars in a hover. */
const signedMoney = (v: number) => {
  const a = Math.abs(v);
  const text = a >= 1e6 ? fmtMoney(a).replace('$ ', '$') : `$${fmtInt(Math.round(a))}`;
  return `${v < 0 ? '−' : '+'}${text}/s`;
};

/** Stock that is filling at `rate` per second toward `cap`: `full in 2:31`. */
function fillsIn(stock: number, cap: number, rate: number): string {
  if (stock >= cap - 0.5) return 'full';
  if (rate <= 0) return 'not filling';
  return `full in ${fmtClock((cap - stock) / rate)}`;
}

export function storeBreakdown(s: GameState, key: StoreKey): TipRow[] {
  switch (key) {
    case 'funds': {
      const billed = s.stats.soldPerSec * s.price;
      const lines: [string, number][] = [['tasks billed', billed]];
      if (s.revenueMult > 1) lines.push(['defense contract', billed * (s.revenueMult - 1)]);
      const contracts = contractRate(s);
      if (contracts > 0) lines.push(['custom contracts', contracts]);
      const gross = lines.reduce((a, [, v]) => a + v, 0);
      if (s.jobFund) lines.push(['job-transition fund', -JOB_FUND_SHARE * gross]);
      const total = lines.reduce((a, [, v]) => a + v, 0);
      // A line under 0.5 % of the total folds into "other".
      const rows: TipRow[] = [];
      let other = 0;
      for (const [label, v] of lines) {
        if (Math.abs(v) < 0.005 * Math.abs(total) && label !== 'tasks billed') other += v;
        else rows.push([label, signedMoney(v)]);
      }
      if (other !== 0) rows.push(['other', signedMoney(other)]);
      rows.push(['total', signedMoney(total), 'total']);
      return rows;
    }
    case 'research': {
      const human = humanResearchRate(s);
      const ai = aiResearchRate(s);
      const rows: TipRow[] = [[`researchers (${fmtInt(s.researchers)})`, `+${fmtInt(human)}/s`]];
      if (ai > 0) rows.push([`copies on research (${fmtInt(copies(s) * s.researchAlloc)})`, `+${fmtInt(ai)}/s`]);
      const total = researchRate(s);
      rows.push(['total', `+${fmtInt(total)}/s`, 'total']);
      if (s.stage < 3) rows.push([fillsIn(s.research, researchCap(s), total), '', 'note']);
      return rows;
    }
    case 'insight': {
      const atCap = s.stage >= 3 || s.research >= researchCap(s) - 0.5;
      const rate = atCap ? insightRate(s) : insightTrickle(s);
      if (!s.insightUnlocked) return [['not yet unlocked', '', 'note']];
      return [
        [atCap ? 'at capacity' : 'below capacity', `+${fmtNum(rate, 1)}/s`],
        ['total', `+${fmtNum(rate, 1)}/s`, 'total'],
        ...(atCap || rate > 0 ? [] : [['accrues once research is full', '', 'note'] as TipRow]),
      ];
    }
    case 'trust':
      return [
        [`next at ${fmtInt(s.nextTrust)} tasks`, ''],
        ['each public release', '+1'],
      ];
    case 'gpus': {
      const g5 = s.gpusG5;
      return [
        ['Nimbus G4', fmtInt(s.gpus - g5)],
        ['Nimbus G5', fmtInt(g5)],
        ['room for', fmtInt(freeSlots(s))],
        ['power for', fmtInt(freePowerGpus(s))],
        ...(poweredGpus(s) < s.gpus ? [['dark (power cut)', fmtInt(s.gpus - poweredGpus(s))] as TipRow] : []),
      ];
    }
    case 'power': {
      const rows: TipRow[] = [['Abilene grid', `${SUBSTATION_MW}`]];
      if (s.gasPlants) rows.push([`gas (${s.gasPlants})`, fmtInt(s.gasPlants * GAS_MW)]);
      rows.push([`solar (${s.solarFarms})`, fmtInt(s.solarFarms * SOLAR_MW)]);
      if (s.reactors) rows.push([`nuclear (${s.reactors})`, fmtInt(s.reactors * NUCLEAR_MW)]);
      if (s.gulfSites) rows.push(['Al-Marsa', fmtInt(s.gulfSites * GULF_MW)]);
      const queued = s.powerQueue.reduce((a, o) => a + o.mw, 0);
      if (queued) {
        const soonest = Math.min(...s.powerQueue.map((o) => o.remaining));
        rows.push(['in the queue', `+${fmtInt(queued)} (${fmtClock(soonest)})`]);
      }
      rows.push(['total', `${fmtInt(s.powerCapacityMW)} MW`, 'total']);
      return rows;
    }
    case 'copies': {
      const running = copies(s);
      const onResearch = Math.floor(running * s.researchAlloc);
      const onAlign = Math.floor(running * alignExtra(s));
      const rows: TipRow[] = [
        ['on tasks', fmtInt(Math.floor(running * taskShare(s)))],
        ['on research', fmtInt(onResearch)],
      ];
      if (onAlign > 0) rows.push(['on alignment', fmtInt(onAlign)]);
      rows.push(['GPUs training', fmtInt(busyGpus(s))]);
      rows.push(['per GPU', fmtNum(s.copiesPerGPU, 2)]);
      return rows;
    }
    case 'data': {
      const rows: TipRow[] = [];
      const crawl = crawlRate(s);
      if (crawl > 0 || s.crawlLeft > 0) rows.push(['web crawl', `+${fmtNum(crawl, 2)} T/s (${fmtNum(s.crawlLeft, 1)} T left)`]);
      const synth = synthRate(s);
      if (synth > 0) rows.push(['synthetic', `+${fmtNum(synth, 3)} T/s`]);
      const fly = flywheelRate(s);
      if (fly > 0) rows.push(['flywheel', `+${fmtNum(fly, 2)} T/s`]);
      if (rows.length === 0) rows.push(['nothing adding data', '', 'note']);
      const need = trainCost(s).data;
      if (need) rows.push([`next run needs ${fmtNum(need, 1)} T`, '', 'note']);
      return rows;
    }
    case 'chips':
      return s.flags['g6Preorder'] === true
        ? [['Nimbus G6, paid for', '100,000'], ['delivery', 'when Formosa Fab can', 'note']]
        : [['Nimbus G6 pre-order', 'not placed', 'note']];
  }
  return [];
}

/** `chips on order` row value. */
export function chipsOnOrder(s: GameState): number {
  return s.flags['g6Preorder'] === true ? 100000 : 0;
}
