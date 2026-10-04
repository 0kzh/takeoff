// Universal Paperclips, Stage 2 (Earth: power, drones, factories, swarm) and Stage 3 (space:
// probes) — the rules the curious first-time player follows there. Every input is a number or a
// word printed on screen (see the metrics in paperclips.mjs); every action is a click on a visible
// button or a change of a visible control (strategy picker, work/think slider).
import { fmtN } from '../lib/util.mjs';

export const KEYS = {
  harvester: { 1: 'btnMakeHarvester', 10: 'btnHarvesterx10', 100: 'btnHarvesterx100', 1000: 'btnHarvesterx1000' },
  wireDrone: { 1: 'btnMakeWireDrone', 10: 'btnWireDronex10', 100: 'btnWireDronex100', 1000: 'btnWireDronex1000' },
  farm: { 1: 'btnMakeFarm', 10: 'btnFarmx10', 100: 'btnFarmx100' },
  battery: { 1: 'btnMakeBattery', 10: 'btnBatteryx10', 100: 'btnBatteryx100' },
};
/** Repeat-purchase buttons bought only by these rules (never by the generic buy loop). */
export const REPEAT_KEYS = Object.values(KEYS).flatMap((k) => Object.values(k));
export const FACTORY = 'btnMakeFactory';
export const SPACE_EXPLORATION = 'projectButton46';
export const LAUNCH_PROBE = 'btnMakeProbe';

/** A bulk button is used once N × the shown unit price is ≤ 10% of the unused clips. */
export const TRIVIAL_SHARE = 0.1;
/** Per-unit power draw read off the Power panel (drones 1 MW, factories 200 MW, farms +50 MW). */
const MW = { harvester: 1, wireDrone: 1, factory: 200, farm: 50 };
const STATS = ['Speed', 'Nav', 'Rep', 'Haz', 'Fac', 'Harv', 'Wire', 'Combat'];

const find = (c, k) => c.buttons.find((b) => b.k === k);
const unitCost = (m, kind) => ({ harvester: m.harvesterCost, wireDrone: m.wireDroneCost, farm: m.farmCost, battery: m.batteryCost })[kind] || 0;

/** Largest enabled bulk size N ≤ maxN with N × unit ≤ 10% of the clips; 1 when only a single is affordable. */
function pickSize(c, kind, maxN = Infinity) {
  const keys = KEYS[kind];
  const unit = unitCost(c.m, kind);
  for (const N of Object.keys(keys).map(Number).sort((a, b) => b - a)) {
    if (N > maxN) continue;
    const b = find(c, keys[N]);
    if (!b || !b.e) continue;
    if (N === 1 || N * unit <= TRIVIAL_SHARE * c.m.unusedClips) return N;
  }
  return 0;
}

/** Buys solar farms until production covers `mw` more than consumption (≤ 3 clicks). */
async function ensurePower(ctx, mw, reason) {
  for (let i = 0; i < 3; i++) {
    const c = ctx.controls;
    const short = c.m.powerCons + mw - c.m.powerProd;
    if (short <= 0) return true;
    const want = Math.ceil(short / MW.farm);
    const sizes = [1, 10, 100].filter((N) => {
      const b = find(c, KEYS.farm[N]);
      return b && b.e;
    });
    if (!sizes.length) return false;
    const N = sizes.find((s) => s >= want) ?? sizes[sizes.length - 1];
    const before = ctx.controls;
    await ctx.click(KEYS.farm[N], 'power', `${reason}: production ${fmtN(c.m.powerProd)} MW < consumption ${fmtN(c.m.powerCons)} MW + ${fmtN(mw)} MW`);
    if (ctx.controls === before) return false;
  }
  return ctx.controls.m.powerProd >= ctx.controls.m.powerCons + mw;
}

/** Buys up to `maxN` units of a drone kind, powering them first; returns the units bought. */
async function buyDrones(ctx, kind, reason, maxN = Infinity) {
  let N = pickSize(ctx.controls, kind, maxN);
  if (!N) return 0;
  if (!(await ensurePower(ctx, N * MW[kind], `power for ${N} ${kind === 'harvester' ? 'harvester' : 'wire'} drone${N > 1 ? 's' : ''}`))) {
    const head = ctx.controls.m.powerProd - ctx.controls.m.powerCons;
    N = pickSize(ctx.controls, kind, Math.max(0, Math.floor(head / MW[kind])));
    if (!N) return 0;
  }
  const before = ctx.controls;
  await ctx.click(KEYS[kind][N], 'build', `${reason} (${N} × ${fmtN(unitCost(before.m, kind))} clips each)`);
  return ctx.controls === before ? 0 : N;
}

/** The goals a first-timer saves for: the first Clip Factory, then Space Exploration. */
export function stageGoals(c) {
  const out = [];
  if (c.m.stage === 2 && (c.m.factoryLevel || 0) < 1 && find(c, FACTORY)) out.push(FACTORY);
  if (find(c, SPACE_EXPLORATION)) out.push(SPACE_EXPLORATION);
  return out;
}

const isChip = (b) => /^Photonic Chip/.test(b.l);
const HAVE = { yomi: 'yomi', creat: 'creativity', ops: 'ops' };

/**
 * What the ops are for right now (Stage 2+), from the projects on screen:
 *   pendingOps  a project (not a Photonic Chip) priced in ops within the cap but above the ops held
 *   focus       'yomi' or 'creat': the scarce currency of the visible project closest to affordable
 */
export function opsPlan(c) {
  const m = c.m;
  const projects = c.buttons.filter((b) => b.kind === 'project' && b.costs);
  const pendingOps = projects.find((b) => !isChip(b) && b.costs.ops > (m.ops || 0) && b.costs.ops <= m.maxOps) || null;
  let focus = null;
  let best = -1;
  for (const b of projects) {
    for (const res of ['yomi', 'creat']) {
      const price = b.costs[res];
      const have = m[HAVE[res]] || 0;
      // No yomi yet: the tournament has not been tried, so it gets the first turn.
      const frac = res === 'yomi' && have === 0 ? Infinity : have / price;
      if (price > have && frac > best) {
        best = frac;
        focus = { res, project: b.l, have, price };
      }
    }
  }
  return { pendingOps, focus };
}

/** Strategic Modeling (Stage 2+): pick the strategy the last results table shows on top. */
export async function pickStrategy(ctx) {
  const info = await ctx.session.page.evaluate(() => {
    const sel = document.getElementById('stratPicker');
    if (!sel || !sel.checkVisibility({ checkVisibilityCSS: true })) return null;
    const tbl = document.getElementById('tournamentResultsTable');
    const top = document.getElementById('results0');
    const m = top && tbl && tbl.checkVisibility({ checkVisibilityCSS: true }) ? /^\s*1\.\s*(.+?):/.exec(top.textContent) : null;
    return { value: sel.value, opts: [...sel.options].map((o) => ({ v: o.value, t: o.textContent.trim() })), winner: m ? m[1].trim() : null };
  });
  if (!info) return;
  const real = info.opts.filter((o) => o.v !== '10');
  if (!real.length) return;
  let target = info.winner ? real.find((o) => o.t === info.winner) : null;
  if (!target && info.value === '10') target = real[real.length - 1];
  if (target && target.v !== info.value) await ctx.set('#stratPicker', target.v, 'strategy', info.winner ? `"1. ${info.winner}" in the last results` : '"Pick strategy, run tournament, gain yomi"');
}

/** Work/think slider: think half-way only while memory is what blocks a visible project. */
export async function swarmSlider(ctx) {
  const c = ctx.controls;
  const m = c.m;
  if (!(m.swarmStatus || '').length) return; // the Swarm Computing box (with the slider) is not on screen
  const opsCosts = c.buttons.filter((b) => b.kind === 'project' && b.costs && b.costs.ops > 0).map((b) => b.costs.ops);
  const needMemory = opsCosts.some((x) => x > m.maxOps);
  const target = needMemory ? 100 : 0;
  if (Number(m.slider) !== target) {
    await ctx.set('#slider', target, 'slider', needMemory ? `a project needs more than ${fmtN(m.maxOps)} ops: think (gifts) half-way` : 'no project waits for memory: all work');
  }
}

/**
 * Stage 2. Power first; save for the first factory; then keep the chain harvesters → wire drones
 * → factories in step by the stocks on screen; batteries for spare power and for Space Exploration.
 */
export async function stage2(ctx, mem) {
  let c = ctx.controls;
  let m = c.m;
  // 1. Power deficit (performance below 100%): solar farms.
  if (m.powerCons > m.powerProd) await ensurePower(ctx, 0, 'power deficit');
  c = ctx.controls;
  m = c.m;
  const goals = stageGoals(c);

  // 2. Space Exploration on screen: only storage (its price includes 10,000,000 MW-seconds) and power.
  if (goals.includes(SPACE_EXPLORATION)) {
    const se = find(c, SPACE_EXPLORATION);
    const needStore = se && /([0-9][0-9,]*)\s*MW-seconds/.exec(se.l);
    const store = needStore ? Number(needStore[1].replace(/,/g, '')) : 1e7;
    if (m.powerCap < store) {
      for (const N of [100, 10, 1]) {
        const b = find(c, KEYS.battery[N]);
        if (b && b.e) {
          await ctx.click(KEYS.battery[N], 'storage', `Space Exploration needs ${fmtN(store)} MW-seconds; storage ${fmtN(m.powerCap)}`);
          break;
        }
      }
    }
    // Storage only fills from spare production: size the surplus to fill it in about two minutes.
    const mm = ctx.controls.m;
    if (mm.storedPower < store) await ensurePower(ctx, Math.max(50, (store - mm.storedPower) / 120), `charge the batteries (${fmtN(mm.storedPower)} of ${fmtN(store)} MW-seconds)`);
    return;
  }

  // 3. No factory yet: one farm, one harvester, one wire drone, and save the rest for it.
  if ((m.factoryLevel || 0) < 1) {
    if ((m.farmLevel || 0) < 1) await ensurePower(ctx, 1, 'first power');
    if ((ctx.controls.m.harvesterLevel || 0) < 1) await buyDrones(ctx, 'harvester', 'first harvester', 1);
    if ((ctx.controls.m.wireDroneLevel || 0) < 1) await buyDrones(ctx, 'wireDrone', 'first wire drone', 1);
    return;
  }

  // 4. The chain, from the stocks on screen (compared with the last check).
  const A = m.acquiredMatter;
  const W = m.wireStock;
  const matterUp = mem.prevA != null && A > mem.prevA && A > 0;
  const wireUp = mem.prevW != null && W > mem.prevW && W > 0;
  mem.prevA = A;
  mem.prevW = W;
  mem.wireUpChecks = wireUp ? (mem.wireUpChecks || 0) + 1 : 0;

  // Wire piling up for two checks: the factories are the bottleneck.
  const fac = find(c, FACTORY);
  if (mem.wireUpChecks >= 2 && fac && fac.e) {
    if (await ensurePower(ctx, MW.factory, 'power for a factory')) {
      const before = ctx.controls;
      await ctx.click(FACTORY, 'build', `wire piling up (${fmtN(W)} inches): factories are the bottleneck (${fmtN(m.factoryCost)} clips)`);
      if (ctx.controls !== before) mem.wireUpChecks = 0;
    }
  }

  // Still piling up and the next factory is affordable within ~2 minutes of the clip income shown:
  // save for it (more drones would only add wire). A factory further off does not stop the drones.
  if (mem.wireUpChecks >= 2 && m.factoryCost <= m.unusedClips + 120 * (m.rate || 0)) return;

  // Matter piling up → wire drones; otherwise (matter left on Earth) → harvesters; in step (≤ 1.4×).
  c = ctx.controls;
  m = c.m;
  const H = m.harvesterLevel || 0;
  const D = m.wireDroneLevel || 0;
  let kind = matterUp ? 'wireDrone' : m.availableMatter > 0 ? 'harvester' : null;
  if (kind === 'harvester' && H + 1 > 1.4 * (D + 1)) kind = 'wireDrone';
  else if (kind === 'wireDrone' && D + 1 > 1.4 * (H + 1)) kind = 'harvester';
  if (kind) {
    const why = matterUp ? `acquired matter piling up (${fmtN(A)} g): wire drones are the bottleneck` : 'matter is processed as fast as it is harvested: more harvesters';
    const keepStep = (kind === 'wireDrone' && !matterUp) || (kind === 'harvester' && matterUp) ? ' (kept in step with the other drones)' : '';
    const other = kind === 'harvester' ? D : H;
    const mine = kind === 'harvester' ? H : D;
    // Never more than 1.4× the other kind after the purchase.
    const cap = Math.max(1, Math.floor(1.4 * (other + 1)) - 1 - mine);
    await buyDrones(ctx, kind, why + keepStep, cap);
  }

  // 5. Storage full while production exceeds consumption: a cheap battery (≤ 1% of the clips).
  c = ctx.controls;
  m = c.m;
  if (m.powerProd > m.powerCons && m.storedPower >= m.powerCap && m.batteryCost <= 0.01 * m.unusedClips) {
    for (const N of [100, 10, 1]) {
      const b = find(c, KEYS.battery[N]);
      if (b && b.e && N * m.batteryCost <= 0.01 * m.unusedClips) {
        await ctx.click(KEYS.battery[N], 'storage', `storage full (${fmtN(m.powerCap)} MW-seconds) with spare production`);
        break;
      }
    }
  }
}

/** Probe design weights by what the player has seen: deaths, found matter, drifters. */
export function designWeights(m) {
  const w = { Speed: 1, Nav: 1, Rep: 3, Haz: 3, Fac: 0, Harv: 0, Wire: 0, Combat: 0 };
  const phase = [];
  if ((m.probeCount || 0) >= 100 || (m.availableMatter || 0) > 0) {
    Object.assign(w, { Fac: 1, Harv: 1, Wire: 1 });
    phase.push('production');
  }
  if ((m.drifterCount || 0) >= 1 || (m.probesLostCombat || 0) >= 1) {
    w.Combat = 2;
    phase.push('combat');
  }
  return { w, phase: phase.length ? phase.join('+') : 'survive' };
}

/** Largest-remainder split of T trust over the weights; ties go to the earlier stat in priority. */
export function allocate(T, w) {
  const order = ['Haz', 'Rep', 'Speed', 'Nav', 'Wire', 'Harv', 'Fac', 'Combat'];
  const total = order.reduce((s, k) => s + w[k], 0);
  const out = Object.fromEntries(STATS.map((k) => [k, 0]));
  if (T <= 0 || total <= 0) return out;
  const raw = order.map((k) => ({ k, x: (T * w[k]) / total }));
  let used = 0;
  for (const r of raw) {
    out[r.k] = Math.floor(r.x);
    used += out[r.k];
  }
  raw.sort((a, b) => b.x - Math.floor(b.x) - (a.x - Math.floor(a.x)) || order.indexOf(a.k) - order.indexOf(b.k));
  for (const r of raw) {
    if (used >= T) break;
    if (w[r.k] > 0) {
      out[r.k]++;
      used++;
    }
  }
  return out;
}

/** Stage 3: keep the probe design matched to the trust on screen (lower first, then raise). */
export async function stage3(ctx, mem) {
  const m = ctx.controls.m;
  const T = m.probeTrust || 0;
  if (T <= 0) return;
  const { w, phase } = designWeights(m);
  const target = allocate(T, w);
  const cur = Object.fromEntries(STATS.map((k) => [k, m[`probe${k}`] || 0]));
  if (STATS.every((k) => cur[k] === target[k])) return;
  if (mem.lastPhase !== phase) mem.lastPhase = phase;
  const detail = `design for ${phase}: ${STATS.filter((k) => target[k]).map((k) => `${k} ${target[k]}`).join(', ')} of ${T} trust`;
  for (const k of STATS) {
    for (let i = cur[k]; i > target[k]; i--) {
      const before = ctx.controls;
      await ctx.click(`btnLowerProbe${k}`, 'design', detail);
      if (ctx.controls === before) break;
    }
  }
  for (const k of STATS) {
    for (let i = cur[k]; i < target[k]; i++) {
      const before = ctx.controls;
      await ctx.click(`btnRaiseProbe${k}`, 'design', detail);
      if (ctx.controls === before) break;
    }
  }
}
