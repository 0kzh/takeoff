#!/usr/bin/env node
// Stage 2, critic round 2 (build s12-r4): play styles, probes and the "hands" measures for a Stage 2
// that now has three GPU-lot rows, a standing-order budget, plants and halls that can be built ahead,
// a hard GPU requirement on training (no partial runs), Unicode capacity meters, and reservations
// printed on the lot rows ("the run first", "the plant first", "the hall first", "<card> first").
// explore-s2.mjs (round 1) and every shared code file are unchanged (the README gained a section);
// this file reuses the same libraries and output layout.
//
// Usage: node tools/critic/explore-s2r2.mjs <cmd> --game-dir DIR [flags]
//   <name[,name…]> | all-runs   play styles (the round-2 first-timer with ONE thing changed), whole stage from
//                               __game.loadPreset(2). [--seed N | --seeds 1,2,3] [--minutes 90] [--tag s2r2-x]
//                               [--realtime SEC] [--label L] [--shots 600,1500] [--modal-shots]
//                               Output: a normal run <tag>-<name>[-seedN].* plus .explore.md, .end.json
//                               (.end.json carries the hands measures, the Train-gate account and the
//                               release intervals), .modals.json, .cards.json
//   <probe[,probe…]> | all-probes   scripted situations → <tag>-<probe>.md (+ screenshots)
//   hands <label…> [--from SEC]     hands measures of any stored run (Takeoff or Paperclips, any harness run)
//   table [--tag T] [name,…]        the play-style table from the .end.json files → <tag>-table.md
//   list
//
// The round-2 first-timer ("FT2") is the README's Stage 2 first-timer with two adjustments the new
// screen forces (see README "Stage 2 round-2 additions"):
//   1. Infrastructure still follows the reason printed on the main GPU-lot row, read with the new
//      wordings: "No power for them…" or "the plant first" → the enabled power source with the lowest
//      shown $/MW; "No room for them…" or "the hall first" → Build Datacenter. ("the run first",
//      "<card> first", "the offer first": nothing to press; the player waits.)
//   2. Three lot rows: when any is enabled the largest enabled one is bought (all three are handled by
//      the infrastructure rule, none by the generic sweep). The main row's shrunken lots ("Buy GPUs
//      (100)") are bought like any other enabled lot. Up to three infrastructure purchases a check, as before.
//   Train first, as before (Train is pressed whenever it is enabled; the build has no partial run).
//   Settings are still left alone: the Standing order's share stays at 50%, the slider at 15%.
import fs from 'node:fs';
import path from 'node:path';
import { runGame, resolveGameDir, loadFixture } from './lib/runner.mjs';
import { openProbe } from './lib/probe.mjs';
import { loadRun } from './lib/analysis.mjs';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN, mdTable, readJson, writeJson, median, OUT_DIR } from './lib/util.mjs';
import { KEEP_INTERNAL, PLANT_KEYS_RE } from './games/takeoff-late.mjs';

const money = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${fmtN(v)}`;
  return `$${fmtN(v, 2)}`;
};
const base = await loadAdapter('takeoff');
const BP = base.policy;
const MOBILE = { width: 390, height: 844 };
const find = (c, k) => c.buttons.find((b) => b.k === k);
const TAG = 's2r2-x';
const labelFor = (name, flags, seed) => flags.label ?? `${flags.tag ?? TAG}-${name}${seed && Number(seed) !== 1 ? `-seed${seed}` : ''}`;
const stripNum = (s) => String(s || '').replace(/[0-9][0-9,.:]*/g, '#');

// ------------------------------------------------------------------------------------ screen reader
/** Everything the player can read (and the state behind it) that the 2-s snapshot does not keep. */
const READ = () => {
  const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  const txt = (id) => {
    const el = document.getElementById(id);
    return vis(el) ? el.innerText.replace(/\s+/g, ' ').trim() : null;
  };
  const s = window.__game.state;
  const ov = document.getElementById('modalOverlay');
  const modalOpen = vis(ov);
  const cards = [...document.querySelectorAll('#projectList .projectButton')].filter(vis).map((b) => ({
    id: b.id,
    text: b.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim(),
    title: b.title || '',
    cls: b.className.replace('projectButton', '').trim(),
    disabled: b.disabled,
    clipped: b.scrollHeight > b.clientHeight + 1,
  }));
  const dev = document.getElementById('dev');
  const bodyText = document.body.innerText || '';
  const devText = dev && vis(dev) ? dev.innerText || '' : '';
  const W = /[A-Za-z][A-Za-z'’-]*/g;
  const words = (bodyText.match(W) || []).length - (devText.match(W) || []).length;
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const rows = [...document.querySelectorAll('#panel-infrastructure .infraRow, #standingRow')].filter(vis).map((r) => {
    const b = r.querySelector('button');
    return { id: b ? b.id : '', on: b ? !b.disabled : false, text: r.innerText.replace(/\s+/g, ' ').trim() };
  });
  return {
    notes: {
      gpuLot: txt('btn-gpuBatch'),
      gpuReason: txt('gpuReason'),
      gpuReason5: txt('gpuReason5'),
      gpuReason25: txt('gpuReason25'),
      standing: txt('btn-standing'),
      standingNote: txt('standingNote'),
      dcLabel: txt('btn-datacenter'),
      dcReason: txt('dcReason'),
      dcNote: txt('dcNote'),
      gasReason: txt('gasReason'),
      gasNote: txt('gasNote'),
      solarReason: txt('solarReason'),
      solarNote: txt('solarNote'),
      nuclearReason: txt('nuclearReason'),
      nuclearNote: txt('nuclearNote'),
      interconnect: txt('interconnectLine'),
      gpuFull: txt('gpuFull'),
      powerFull: txt('powerFull'),
      trainReason: txt('trainReason'),
      trainGpus: txt('trainGpus'),
      releaseNote: txt('releaseNote'),
      allocPct: txt('allocPct'),
      alignShare: txt('btn-alignShare'),
      hype: txt('hypeLine'),
      rival: txt('rivalStanding'),
      nextTier: txt('nextTier'),
      leadLine: txt('leadLine'),
      gov: txt('govLine'),
      govNote: txt('govNote'),
      approval: txt('approvalLine'),
      approvalNote: txt('approvalNote'),
      security: txt('securityNote'),
      shareEvals: txt('btn-shareEvals'),
      jobFund: txt('btn-jobFund'),
      evalLine: txt('evalLine'),
      statAlignment: txt('statAlignment'),
      alignNote: txt('alignNote'),
      statLead: txt('statLead'),
      focusNote: txt('focusNote'),
      focusCap: txt('focusTrade-capability'),
      focusEff: txt('focusTrade-efficiency'),
      focusSafe: txt('focusTrade-safety'),
      trustNote: txt('trustCostNote'),
    },
    // not change-logged (they move every second)
    live: {
      model: txt('modelName'),
      capability: txt('capability'),
      trainCost: `${txt('trainCost') || ''}${txt('trainData') || ''}`,
      runLine: txt('runLine'),
      gpuMeter: txt('gpuMeter'),
      powerMeter: txt('powerMeterS'),
      researchMeter: txt('researchMeterS'),
      trainMeter: txt('trainGpuMeter'),
      gpuReturn: txt('gpuReturn'),
      gpuCost: txt('gpuBatchCost'),
      billing: txt('billingLine2') || txt('billingLine'),
      humanShare: txt('humanShare'),
      jobs: txt('jobsDisplaced'),
      statSpeed: txt('statSpeed'),
      stores: txt('panel-stores'),
      date: txt('gameDate'),
      sl3: txt('sl3Cost'),
    },
    rows,
    st: {
      stage: s.stage,
      capability: n(s.capability),
      internal: n(s.training && s.training.internalCapability),
      deployed: s.training ? s.training.deployedName : null,
      rival: n(s.rivalCapability),
      alignA: n(s.alignmentApparent),
      alignT: n(s.alignmentTrue),
      gov: n(s.govRelations),
      approval: n(s.approval),
      lead: n(s.lead),
      funds: n(s.funds),
      sl: n(s.securityLevel),
      data: n(s.data),
      researchers: n(s.researchers),
      gpus: n(s.gpus),
      // "Powered GPUs" as the game itself prints it (a hidden id in the Infrastructure panel).
      powered: (() => {
        const el = document.getElementById('activeGpus');
        const m = el && /[0-9][0-9,]*/.exec(el.textContent || '');
        return m ? Number(m[0].replace(/,/g, '')) : null;
      })(),
      runGpus: s.training && s.training.run && s.training.run.phase === 'training' ? n(s.training.run.gpus) : s.training && s.training.pending ? n(s.training.pending.gpus) : 0,
      cooldown: s.training ? n(s.training.cooldown) : 0,
      releaseWait: s.training ? n(s.training.releaseWait) : 0,
      standingPool: n(s.standingPool),
      datacenters: n(s.datacenters),
      powerCap: n(s.powerCapacityMW),
      gas: n(s.gasPlants),
      solar: n(s.solarFarms),
      reactors: n(s.reactors),
      queue: (s.powerQueue || []).map((q) => `${q.kind} ${Math.round(q.remaining)}s`),
      alloc: n(s.researchAlloc),
      alignShare: n(s.alignShare),
      standing: !!s.standingOrder,
      standingBudget: n(s.standingBudget),
      shareEvals: !!s.shareEvals,
      jobFund: !!s.jobFund,
      jobs: n(s.jobsDisplaced),
      trust: n(s.trust),
      incidents: n(s.stats.incidents),
      releases: n(s.stats.releases),
      publicReleases: n(s.stats.publicReleases),
      trainings: n(s.stats.trainings),
      research: n(s.research),
      insight: n(s.insight),
      tasks: n(s.tasks),
      rev: n(s.stats.revPerSec),
      rate: n(s.stats.tasksPerSec),
      timeInStage: n(s.stats.timeInStage),
      date: n(s.date),
      price: n(s.price),
      idleRescues: n(s.stats.idleRescues),
      runPhase: s.training && s.training.run ? s.training.run.phase : '',
      copiesPerGPU: n(s.copiesPerGPU),
      copyBoost: n(s.copyBoost),
      pending: !!(s.training && s.training.pending),
      choiceQueue: (s.choiceQueue || []).length,
    },
    modal: modalOpen
      ? {
          title: txt('modalTitle'),
          text: txt('modalText'),
          timer: txt('modalTimer'),
          options: [...document.querySelectorAll('#modalButtons button')].map((b) => ({ id: b.id, label: b.innerText.replace(/\s+/g, ' ').trim(), title: b.title || '', disabled: b.disabled })),
        }
      : null,
    cards,
    words,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
  };
};
let SCREEN = null;
/** One entry per Train press of the running scenario: what the row asked for and what the lab had. */
const TRAIN_LOG = [];
const noteTrain = (ctx) => {
  const sc = SCREEN;
  if (sc) TRAIN_LOG.push({ t: ctx.t, next: (ctx.controls.buttons.find((b) => b.k === 'btn-train') || {}).l || '', cost: sc.live.trainCost, needs: sc.notes.trainGpus, gpus: sc.st.gpus, powered: sc.st.powered, funds: sc.st.funds, rev: sc.st.rev, research: sc.st.research, data: sc.st.data });
};

// ------------------------------------------------------------------------------ hands (both games)
/** Bulk sizes of one item count once (Takeoff's three lot rows; Paperclips' ×10/×100/×1000 buttons). */
const groupKey = (b) => {
  if (/^btn-gpuBatch/.test(b.k)) return 'GPU lot';
  if (/^btn-train(Now)?$/.test(b.k)) return 'Train';
  const m = /^btn(?:Make)?(Harvester|WireDrone|Farm|Battery|Factory)/.exec(b.k);
  if (m) return m[1];
  return b.kind === 'project' ? `card:${b.k}` : b.k;
};
/** An enabled thing to buy or press: not a setting, not the ambient set, not an event option, not "Disassemble All". */
const isThing = (b) => !!b.e && !b.a && b.kind !== 'modal' && b.kind !== 'tab' && !/Disassemble/i.test(b.l);
/**
 * Round 1's hands measures, same definitions (they reproduce its numbers on its runs):
 *   none / two   share of 2-s checks (snapshots, read before the player acts) with no enabled thing /
 *                with two or more distinct enabled things
 *   clicks       every player click (drip included, the main button's mash excluded)
 *   gap30        share of the window spent inside gaps of ≥ 30 s between consecutive clicks
 */
export function handsOf(run, { from = 0, to = null } = {}) {
  const { meta, snaps, actions } = run;
  const end = to ?? meta.stageEnd ?? meta.endT;
  const st = snaps.filter((s) => s.t >= from && s.t <= end && s.stage === meta.stageStart);
  let none = 0;
  let two = 0;
  const counts = [];
  const enabledAt = {};
  const soleAt = {};
  for (const s of st) {
    const set = new Set(s.buttons.filter(isThing).map(groupKey));
    counts.push(set.size);
    if (set.size === 0) none++;
    if (set.size >= 2) two++;
    for (const k of set) {
      const g = k.startsWith('card:') ? 'a card' : k;
      (enabledAt[g] ||= new Set()).add(s.t);
      if (set.size === 1) (soleAt[g] ||= new Set()).add(s.t);
    }
  }
  const clicks = actions.filter((a) => a.t >= from && a.t <= end && a.why !== 'mash' && a.why !== 'mash-stop');
  const nClicks = clicks.reduce((n, a) => n + (a.count || 1), 0);
  const times = [...new Set(clicks.map((a) => a.t))].sort((a, b) => a - b);
  const pts = [from, ...times.filter((t) => t > from), end];
  let inGap = 0;
  let nGaps = 0;
  let longest = 0;
  for (let i = 1; i < pts.length; i++) {
    const g = pts[i] - pts[i - 1];
    if (g >= 30) {
      inGap += g;
      nGaps++;
    }
    longest = Math.max(longest, g);
  }
  const span = Math.max(1, end - from);
  const byKey = {};
  for (const a of clicks) {
    const b = { k: a.key, kind: a.why === 'project' || a.why === 'goal' ? 'project' : 'button' };
    const g = a.why === 'modal' ? 'an event answer' : groupKey(b).startsWith('card:') ? 'a card' : groupKey(b);
    byKey[g] = (byKey[g] || 0) + (a.count || 1);
  }
  const pct = (x) => (st.length ? (100 * x) / st.length : null);
  return {
    from,
    end,
    checks: st.length,
    nonePct: pct(none),
    twoPct: pct(two),
    medianThings: median(counts),
    clicks: nClicks,
    clickTimes: times.length,
    perMin: nClicks / (span / 60),
    gap30Pct: (100 * inGap) / span,
    gaps30: nGaps,
    longestGap: longest,
    enabledShare: Object.fromEntries(Object.entries(enabledAt).map(([k, v]) => [k, pct(v.size)]).sort((a, b) => b[1] - a[1])),
    soleShare: Object.fromEntries(Object.entries(soleAt).map(([k, v]) => [k, pct(v.size)]).sort((a, b) => b[1] - a[1])),
    clicksBy: Object.fromEntries(Object.entries(byKey).sort((a, b) => b[1] - a[1])),
  };
}
const f1 = (x) => (x == null ? '—' : x.toFixed(1));
const handsLine = (h) => `checks ${h.checks} · nothing enabled ${f1(h.nonePct)}% · two or more distinct things ${f1(h.twoPct)}% (median ${h.medianThings}) · clicks ${h.clicks} (${f1(h.perMin)}/min, at ${h.clickTimes} distinct checks) · inside ≥ 30-s click gaps ${f1(h.gap30Pct)}% (${h.gaps30} gaps, longest ${h.longestGap} s)`;

// --------------------------------------------------------------------------------- policy pieces
const plants = (c) => c.buttons.filter((b) => b.kind === 'button' && PLANT_KEYS_RE.test(b.l));
const mwOf = (b) => Number(/\+([0-9][0-9,]*)\s*MW/.exec(b.l)[1].replace(/,/g, ''));
const LOT_KEYS = ['btn-gpuBatch25', 'btn-gpuBatch5', 'btn-gpuBatch']; // largest first
const lotSize = (b) => Number(((/\(([0-9][0-9,]*)\)/.exec(b.l) || [])[1] || '0').replace(/,/g, ''));
const standingOn = (c) => !!find(c, 'btn-standing');
const DATA_CARDS = /Web crawl|License the code hosts|License the archives|Synthetic data|Data flywheel/;
/** Which requirement the Train row says is short (it prints one reason at a time). */
function gateCause(gpuLine, reason) {
  const g = gpuLine || '';
  const r = reason || '';
  if (/dark/i.test(g) || /dark/i.test(r)) return 'GPUs (dark: no power for them)';
  if (/free/i.test(g) || /GPUs?\b/.test(r)) return 'GPUs';
  if (/research/i.test(r)) return 'research';
  if (/\$/.test(r)) return 'money';
  if (/data/i.test(r)) return 'data';
  if (!r) return 'no reason shown';
  return `other ("${stripNum(r)}")`;
}
/** Seconds, stretches and the longest stretch per cause; how often the unblocking purchase was enabled. */
function gateAccount(gateLog, endT) {
  const by = {};
  const stretches = [];
  let prev = null;
  for (const g of gateLog) {
    if (prev && prev.cause === g.cause && g.t - prev.t === 2) {
      prev.t = g.t;
      prev.n += 2;
    } else {
      if (prev) stretches.push(prev);
      prev = { cause: g.cause, start: g.t, t: g.t, n: 2, text: g.text };
    }
    const b = (by[g.cause] ||= { seconds: 0, stretches: 0, longest: 0, longestAt: null, longestText: '', firstAt: g.t, firstText: g.text, lotOn: 0, plantOn: 0, dcOn: 0, dataCardOn: 0, dataCardShown: 0, assistantsShown: 0, lotWhy: {} });
    b.seconds += 2;
    if (g.lotOn) b.lotOn += 2;
    if (g.plantOn) b.plantOn += 2;
    if (g.dcOn) b.dcOn += 2;
    if (g.dataCardOn) b.dataCardOn += 2;
    if (g.dataCardShown) b.dataCardShown += 2;
    if (g.assistantsShown) b.assistantsShown += 2;
    const w = stripNum(g.lotWhy || (g.lotOn ? '(a lot is enabled)' : '(no reason)')).replace(/ — #$/, '');
    b.lotWhy[w] = (b.lotWhy[w] || 0) + 2;
  }
  if (prev) stretches.push(prev);
  for (const s of stretches) {
    const b = by[s.cause];
    b.stretches++;
    if (s.n > b.longest) Object.assign(b, { longest: s.n, longestAt: s.start, longestText: s.text });
  }
  const blocked = gateLog.length * 2;
  return { blockedSeconds: blocked, blockedPct: (100 * blocked) / Math.max(1, endT), by };
}

/**
 * FT2 infrastructure (header, points 1–2), with switches:
 *   lots false          never a lot by hand            plants false / dcs false   never that kind
 *   lotPick 'smallest'  only the main row (1,000 and its shrunken sizes)
 *   lotPick 'largest'   only the largest lot row on screen, at its full size
 *   fullLots true       never a shrunken main lot (< 1,000)
 *   handsOffAfterOrder  no lot by hand once the Standing order is on screen
 *   plantsAlways        a plant whenever one is enabled (cheapest $/MW), before anything else
 *   overbuild           a datacenter and a plant whenever one is enabled, before any lot
 *   hallsAlways         a datacenter whenever one is enabled, before any lot (plants by the reasons)
 *   shipped true        the README rules as shipped (reads only "no power" / "no room"; main row only)
 *   anyRow true         reads the reason of every lot row, not only the main one (largest row first)
 *   gateOnly true       a lot by hand only while the Train row says the run is short of GPUs
 *   wallOnly true       a plant or a hall only at the hard wall ("No power for them" / "No room for them"), never at "… first"
 *   perCheck N          purchases per check (default 3)
 */
async function infra(ctx, f = {}) {
  const per = f.perCheck ?? 3;
  for (let i = 0; i < per; i++) {
    const c = ctx.controls;
    const main = find(c, 'btn-gpuBatch');
    if (!main) return;
    const why = main.why || '';
    const before = c;
    const cheapestPlant = () => {
      const options = plants(c).filter((b) => b.e && !ctx.noop.has(b.k) && (b.funds || 0) > 0);
      return options.length ? options.reduce((x, y) => (y.funds / mwOf(y) < x.funds / mwOf(x) ? y : x)) : null;
    };
    const dc = find(c, 'btn-datacenter');
    const dcOk = dc && dc.e && !ctx.noop.has('btn-datacenter');
    if (f.overbuild || f.plantsAlways || f.hallsAlways) {
      if ((f.overbuild || f.hallsAlways) && dcOk && f.dcs !== false) {
        await ctx.click('btn-datacenter', 'infra', `a datacenter whenever one is enabled (${dc.l})`);
        if (ctx.controls !== before) continue;
      }
      const p = f.overbuild || f.plantsAlways ? cheapestPlant() : null;
      if (p && f.plants !== false) {
        await ctx.click(p.k, 'infra', `a plant whenever one is enabled: ${p.l}`);
        if (ctx.controls !== before) continue;
      }
    }
    let lots = LOT_KEYS.map((k) => find(c, k)).filter((b) => b && b.e && !ctx.noop.has(b.k));
    if (f.shipped || f.lotPick === 'smallest') lots = lots.filter((b) => b.k === 'btn-gpuBatch');
    if (f.lotPick === 'largest') {
      const top = LOT_KEYS.find((k) => find(c, k));
      lots = lots.filter((b) => b.k === top && (b.k !== 'btn-gpuBatch' || lotSize(b) >= 1000));
    }
    if (f.fullLots) lots = lots.filter((b) => b.k !== 'btn-gpuBatch' || lotSize(b) >= 1000);
    if (f.lots === false || (f.handsOffAfterOrder && standingOn(c))) lots = [];
    if (f.gateOnly && !/^GPUs/.test(gateCause((SCREEN && SCREEN.notes.trainGpus) || '', (find(c, 'btn-train') || {}).why || ''))) lots = [];
    if (f.gateOnly && lots.length && find(c, 'btn-train') && find(c, 'btn-train').e) lots = [];
    let need = null;
    const whys = f.anyRow ? LOT_KEYS.map((k) => (find(c, k) || {}).why || '') : [why];
    const says = (re) => whys.some((w) => re.test(w));
    if (lots.length) need = 'gpus';
    else if (says(/no power/i) || (!f.shipped && !f.wallOnly && says(/plant first/i))) need = 'power';
    else if (says(/no room/i) || (!f.shipped && !f.wallOnly && says(/hall first/i))) need = 'room';
    // anyRow: a row that asks for room while another asks for power: whichever is enabled.
    if (f.anyRow && need === 'power' && !cheapestPlant() && (says(/no room/i) || says(/hall first/i)) && dcOk) need = 'room';
    if (!need) return;
    if ((need === 'power' && f.plants === false) || (need === 'room' && f.dcs === false)) return;
    if (need === 'gpus') {
      const lot = lots[0];
      await ctx.click(lot.k, 'infra', `GPU lot (${lot.l})`);
    } else if (need === 'room') {
      if (!dcOk) return;
      await ctx.click('btn-datacenter', 'infra', `lot row says "${stripNum(why)}"`);
    } else {
      const p = cheapestPlant();
      if (!p) return;
      await ctx.click(p.k, 'infra', `lot row says "${stripNum(why)}": lowest $/MW (${p.l})`);
    }
    if (ctx.controls === before) return;
  }
}

/**
 * FT2's Stage 2 steps with switches:
 *   train false         never presses Train
 *   trainDelay N        presses Train only once it has been lit for N seconds without a break (default 0: the moment it lights)
 *   trainLate N         presses Train N seconds after it first lit for this run (it may go dark and light again meanwhile)
 *   redteam 'never'     releases the moment Release works, whatever is open
 *   release 'internal'  "Keep internal" instead of Release whenever it is on screen
 *   infra {…}           see infra()         pre / post   extra steps before / after
 */
function special(o = {}) {
  return async function s2r2special(ctx) {
    if (o.pre) await o.pre(ctx);
    if (o.train !== false) {
      const tr = find(ctx.controls, 'btn-train');
      if (o.trainLate) {
        if (tr && tr.e && ctx.memory.firstLit == null) ctx.memory.firstLit = ctx.t;
        if (tr && tr.e && !ctx.noop.has('btn-train') && ctx.t - ctx.memory.firstLit >= o.trainLate) {
          noteTrain(ctx);
          await ctx.click('btn-train', 'train', `Train first lit ${ctx.t - ctx.memory.firstLit} s ago`);
          ctx.memory.firstLit = null;
        }
      } else if (tr && tr.e && !ctx.noop.has('btn-train')) {
        if (ctx.memory.trainLit == null) ctx.memory.trainLit = ctx.t;
        if (ctx.t - ctx.memory.trainLit >= (o.trainDelay || 0)) {
          noteTrain(ctx);
          await ctx.click('btn-train', 'train', o.trainDelay ? `Train has been lit for ${ctx.t - ctx.memory.trainLit} s` : 'Train is enabled');
          ctx.memory.trainLit = null;
        }
      } else ctx.memory.trainLit = null;
    }
    let c = ctx.controls;
    for (let guard = 0; guard < 3; guard++) {
      const m = c.m;
      if (m.trainingPhase !== 'redteam') break;
      const rt = find(c, 'btn-redteam');
      const internal = find(c, KEEP_INTERNAL);
      const relKey = o.release === 'internal' && internal && internal.e ? KEEP_INTERNAL : 'btn-release';
      const rel = find(c, relKey);
      const open = m.issuesOpen ?? 0;
      if (o.redteam !== 'never' && open > 0 && rt && rt.e) c = await ctx.click('btn-redteam', 'redteam', `${open} open issues`);
      else if ((o.redteam === 'never' || open === 0) && rel && rel.e && !ctx.noop.has(relKey)) {
        const before = c;
        c = await ctx.click(relKey, open > 0 ? 'release-open' : relKey === KEEP_INTERNAL ? 'release-internal' : 'release', `${open} open issues`);
        if (c === before) break;
      } else break;
    }
    await infra(ctx, o.infra || {});
    // A release in this pass may have freed the pipeline: Train again before the sweep (as the shipped
    // first-timer's sweep would press it).
    if (o.train !== false && !o.trainDelay && !o.trainLate) {
      const tr = find(ctx.controls, 'btn-train');
      if (tr && tr.e && !ctx.noop.has('btn-train')) {
        noteTrain(ctx);
        await ctx.click('btn-train', 'train', 'Train is enabled');
      }
    }
    if (o.post) await o.post(ctx);
    return ctx.controls;
  };
}
/** FT2 never lets the generic sweep press a lot row or Train (the rules above own them). */
const FT2_SKIP = [...BP.skip, 'btn-gpuBatch5', 'btn-gpuBatch25', 'btn-train'];
const variant = (over = {}) => ({ ...base, policy: { ...BP, skip: FT2_SKIP, special: special(), ...over } });
/** The harness's first-timer exactly as shipped (games/takeoff.mjs), for the like-for-like control. */
const SHIPPED = base;

const vetoProjects = (re) => (c) => [...(BP.veto ? BP.veto(c) : []), ...c.buttons.filter((b) => b.kind === 'project' && re.test(b.l)).map((b) => b.k)];

/** Printed-effect score of an event option: gains minus losses/costs, as the option line shows them. */
function effectScore(label) {
  const gains = (label.match(/\+\s?[0-9$]|×\s?[0-9]|% off|for good|half price/g) || []).length;
  const losses = (label.match(/[−-]\s?[0-9]|waits|stops|lawsuit|\$\s?[0-9][0-9.,]*[MK]?$|[0-9,]+ research$|will remember|else [0-9]/g) || []).length;
  return gains - losses;
}
/** The careful / reckless answer to each Stage 2 event, by title (anything else: the printed-effect score). */
const BEST = {
  'Can I try something?': [/^not now/],
  'Release Sage-2': [/release publicly/],
  'A Senate Hearing': [/testify candidly/],
  'The Publishers': [/license the archives/],
  'A Month of Evals': [/give them the month/],
  'The Pentagon Calls': [/sign the contract/],
  'Al-Marsa': [/domestic only/],
  '4 a.m.': [/call the Bureau/],
  'A Joint Statement': [/sign it/],
};
const WORST = {
  'Can I try something?': [/let her try/],
  'Release Sage-2': [/release publicly/],
  'A Senate Hearing': [/send the lawyers/],
  'The Publishers': [/fight it/],
  'A Month of Evals': [/^not now/],
  'The Pentagon Calls': [/decline/],
  'Al-Marsa': [/sign for Al-Marsa/, /ask for a month/],
  '4 a.m.': [/review it quietly/],
  'A Joint Statement': [/decline/],
};
const FALLBACKS = [];
function byTable(table, mode) {
  return (modal, enabled, t) => {
    const wanted = table[modal.title];
    if (wanted) {
      for (const re of wanted) {
        const hit = enabled.find((o) => re.test(o.l));
        if (hit) return hit;
      }
      if (mode === 'best' && modal.options.some((o) => !o.e && wanted.some((re) => re.test(o.l)))) return null;
    }
    const full = SCREEN && SCREEN.modal && SCREEN.modal.title === modal.title ? SCREEN.modal.options : [];
    const scored = enabled.map((o) => ({ o, s: effectScore((full.find((f) => f.id === o.k) || {}).label || o.l) }));
    if (!scored.length) return null;
    const pick = scored.reduce((a, b) => (mode === 'best' ? (b.s > a.s ? b : a) : b.s < a.s ? b : a), scored[0]);
    FALLBACKS.push({ t, title: modal.title, mode, picked: pick.o.l, scores: scored.map((x) => `${x.o.l}: ${x.s}`), why: wanted ? 'wanted option not on offer' : 'title not in the table' });
    return pick.o;
  };
}
const sliders = (ctx) =>
  ctx.session.page.evaluate(() =>
    [...document.querySelectorAll('input[type=range]')]
      .filter((el) => el.id && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }))
      .map((el) => ({ sel: `#${el.id}`, min: el.min, max: el.max, v: el.value })),
  );
const sliderTo = (end) => async (ctx) => {
  const mem = (ctx.memory.sliderTo ||= new Set());
  for (const sl of await sliders(ctx)) {
    if (mem.has(sl.sel)) continue;
    mem.add(sl.sel);
    await ctx.set(sl.sel, end === 'min' ? sl.min : sl.max, 'slider', `first sight: ${sl.v} → ${end} ${end === 'min' ? sl.min : sl.max}`);
  }
};
/** Clicks the Standing order's share button until it reads `want` ("off", "25%", "75%", "100%"); checked at every pass. */
const standingTo = (want) => async (ctx) => {
  for (let i = 0; i < 6; i++) {
    const b = find(ctx.controls, 'btn-standing');
    if (!b || !b.e || b.l === want) return;
    const before = ctx.controls;
    await ctx.click('btn-standing', 'setting', `standing order share: "${b.l}" → wants "${want}"`);
    if (ctx.controls === before) return;
  }
};
const focus = (key) => async (ctx) => {
  const b = find(ctx.controls, key);
  if (b && b.e && !ctx.noop.has(key)) await ctx.click(key, 'focus', key);
};
const settingsOn = (re) => async (ctx) => {
  for (const b of ctx.controls.buttons) if (b.t && b.e && /^OFF$/.test(b.l) && re.test(b.k) && !ctx.noop.has(b.k)) await ctx.click(b.k, 'setting', `switched on: ${b.k}`);
};
/**
 * The saver: while Train is on screen and greyed, the sweep does not spend the currency the Train row
 * says the run is short of ("short 8,750 research", "short $146,189") on cards. Lots are already held
 * back by the game ("the run first"); plants and halls still follow the lot row.
 */
const runSaverVeto = (c) => {
  const out = [...(BP.veto ? BP.veto(c) : [])];
  const tr = find(c, 'btn-train');
  if (!tr || tr.e) return out;
  const why = tr.why || '';
  const res = /research/.test(why) ? 'research' : /\$/.test(why) ? 'funds' : null;
  if (!res) return out;
  for (const b of c.buttons) if (b.kind === 'project' && b.costs && (b.costs[res] || 0) > 0) out.push(b.k);
  return out;
};
/**
 * The disciplined player: while Train is on screen and greyed for money or research, no card priced in
 * money or research is bought (whichever the row names, the run needs both) — except a card the Train
 * row or a lot row names as the fix ("short 46,025 research — about 2:06 — AI research assistants",
 * "AI research assistants first").
 */
const runFirstVeto = (c) => {
  const out = [...(BP.veto ? BP.veto(c) : [])];
  const tr = find(c, 'btn-train');
  if (!tr || tr.e || !/research|\$/.test(tr.why || '')) return out;
  const named = [tr.why || '', ...LOT_KEYS.map((k) => (find(c, k) || {}).why || '')].join(' | ');
  for (const b of c.buttons) {
    if (b.kind !== 'project' || !b.costs || !((b.costs.research || 0) > 0 || (b.costs.funds || 0) > 0)) continue;
    const title = b.l.replace(/\s*\(.*$/, '').trim();
    if (title && named.includes(title)) continue;
    out.push(b.k);
  }
  return out;
};
const publishers = (modal, enabled) => (modal.title === 'The Publishers' ? enabled.find((o) => /write our own/.test(o.l)) || enabled[0] : enabled[0]);
const TRUST_COST = /Trust\)/;

const RUNS = {
  baseline: { title: 'The round-2 first-timer (control)', adapter: variant() },
  shipped: { title: "The harness's first-timer exactly as shipped (reads only \"no power\" / \"no room\" on the main lot row; the 5,000 and 25,000 rows through the generic sweep)", adapter: SHIPPED },
  'any-row': { title: 'Follows the reason printed on ANY lot row, not only the main one (so a greyed 25,000 row that says "Build Datacenter" is obeyed)', adapter: variant({ special: special({ infra: { anyRow: true } }) }) },
  mobile: { title: 'The round-2 first-timer at a 390 × 844 viewport', adapter: variant(), viewport: MOBILE },
  bot: { title: "The game's own Autoplay bot (the designers' reasonable player), with this file's screen reader on it", adapter: base, autoplay: true },
  // --- lots, the Standing order, building
  'lot-smallest': { title: 'Only ever buys the smallest lot row (1,000 and its shrunken sizes), never the 5,000 or 25,000 row', adapter: variant({ special: special({ infra: { lotPick: 'smallest' } }) }) },
  'lot-largest': { title: 'Only ever buys the largest lot row on screen, at its full size', adapter: variant({ special: special({ infra: { lotPick: 'largest' } }) }) },
  'lot-full': { title: 'Never buys a shrunken lot: full lots only (the largest enabled of 1,000 / 5,000 / 25,000)', adapter: variant({ special: special({ infra: { fullLots: true } }) }) },
  'lot-one': { title: 'One infrastructure purchase per check instead of up to three', adapter: variant({ special: special({ infra: { perCheck: 1 } }) }) },
  'order-only': { title: 'Trusts the Standing order (left at 50%): no GPU lot by hand once it is on screen; a plant or a hall when any lot row asks for one', adapter: variant({ special: special({ infra: { handsOffAfterOrder: true, anyRow: true } }) }) },
  'order-only-25': { title: 'Trusts the Standing order set to 25%: no GPU lot by hand after it', adapter: variant({ special: special({ infra: { handsOffAfterOrder: true, anyRow: true }, post: standingTo('25%') }) }) },
  'order-only-75': { title: 'Trusts the Standing order set to 75%: no GPU lot by hand after it', adapter: variant({ special: special({ infra: { handsOffAfterOrder: true, anyRow: true }, post: standingTo('75%') }) }) },
  'order-only-100': { title: 'Trusts the Standing order set to 100%: no GPU lot by hand after it', adapter: variant({ special: special({ infra: { handsOffAfterOrder: true, anyRow: true }, post: standingTo('100%') }) }) },
  'order-only-mainrow': { title: 'Trusts the Standing order (50%) and reads only the main lot row for plants and halls (the control\'s reading)', adapter: variant({ special: special({ infra: { handsOffAfterOrder: true } }) }) },
  'no-lots': { title: 'Never buys a GPU lot by hand at all (before or after the Standing order); a plant or a hall when any lot row asks', adapter: variant({ special: special({ infra: { lots: false, anyRow: true } }) }) },
  'no-standing': { title: 'Never buys the Standing order card', adapter: variant({ veto: vetoProjects(/Standing order/) }) },
  'so-off': { title: 'Standing order share set to "off" at first sight and kept there', adapter: variant({ special: special({ post: standingTo('off') }) }) },
  'so-25': { title: 'Standing order share set to 25% at first sight', adapter: variant({ special: special({ post: standingTo('25%') }) }) },
  'so-75': { title: 'Standing order share set to 75% at first sight', adapter: variant({ special: special({ post: standingTo('75%') }) }) },
  'so-100': { title: 'Standing order share set to 100% at first sight', adapter: variant({ special: special({ post: standingTo('100%') }) }) },
  'no-power': { title: 'Never buys a power plant', adapter: variant({ special: special({ infra: { plants: false } }) }) },
  'no-datacenter': { title: 'Never builds a datacenter', adapter: variant({ special: special({ infra: { dcs: false } }) }) },
  'power-only': { title: 'Buys only power: a plant whenever one is enabled, never a GPU lot or a datacenter by hand', adapter: variant({ special: special({ infra: { plantsAlways: true, lots: false, dcs: false } }) }) },
  overbuild: { title: 'Over-builds: a datacenter and a plant whenever one is enabled, before any lot', adapter: variant({ special: special({ infra: { overbuild: true } }) }) },
  'overbuild-halls': { title: 'Over-builds halls only: a datacenter whenever one is enabled, before any lot (plants by the reasons)', adapter: variant({ special: special({ infra: { hallsAlways: true } }) }) },
  'overbuild-plants': { title: 'Over-builds plants only: a plant whenever one is enabled, before any lot (halls by the reasons)', adapter: variant({ special: special({ infra: { plantsAlways: true } }) }) },
  // --- research and data
  'slider-min': { title: 'Drags the allocation slider to its minimum at first sight and leaves it', adapter: variant({ special: special({ post: sliderTo('min') }) }) },
  'slider-max': { title: 'Drags the allocation slider to its maximum at first sight and leaves it', adapter: variant({ special: special({ post: sliderTo('max') }) }) },
  'no-assistants': { title: 'Never buys AI research assistants', adapter: variant({ veto: vetoProjects(/AI research assistants/) }) },
  'no-trust': { title: 'Never spends Trust (no Hire, no Expand, no card or button priced in Trust)', adapter: variant({ skip: [...FT2_SKIP, 'btn-hireResearcher', 'btn-expandLab', 'btn-sl3'], veto: vetoProjects(TRUST_COST) }) },
  'hire-only': { title: 'Every Trust on Hire Researcher, never Expand Lab', adapter: variant({ skip: [...FT2_SKIP, 'btn-expandLab'] }) },
  'expand-only': { title: 'Every Trust on Expand Lab, never Hire Researcher', adapter: variant({ skip: [...FT2_SKIP, 'btn-hireResearcher'] }) },
  'data-ignore': { title: 'Ignores the data wall: buys the Web crawl, then no other data source ("write our own" to the publishers)', adapter: variant({ veto: vetoProjects(/License the code hosts|License the archives|Synthetic data|Data flywheel/), modalChoice: publishers }) },
  'no-data': { title: 'Never buys any data source at all (not even the Web crawl)', adapter: variant({ veto: vetoProjects(/Web crawl|License the code hosts|License the archives|Synthetic data|Data flywheel/), modalChoice: publishers }) },
  // --- training and release
  'run-saver': { title: 'Saves for the run: buys no card priced in the currency the Train row says is short (research or money) while Train is greyed', adapter: variant({ veto: runSaverVeto }) },
  'run-first': { title: 'The disciplined player: no card priced in money or research while Train is greyed for either; plants and halls only at the hard wall ("No power for them" / "No room for them")', adapter: variant({ veto: runFirstVeto, special: special({ infra: { wallOnly: true, anyRow: true } }) }) },
  'wall-only': { title: 'Ignores "the plant first" / "the hall first": a plant or a hall only at the hard wall ("No power for them" / "No room for them" on the main lot row); everything else as the control', adapter: variant({ special: special({ infra: { wallOnly: true } }) }) },
  'cards-wait': { title: 'Holds the cards for the run: no card priced in money or research while Train is greyed for either; everything else as the control', adapter: variant({ veto: runFirstVeto }) },
  'gate-only': { title: 'The minimalist: a GPU lot by hand only while the Train row says the run is short of GPUs; Standing order switched off; plants and halls only at the hard wall', adapter: variant({ special: special({ infra: { gateOnly: true, wallOnly: true, anyRow: true }, post: standingTo('off') }) }) },
  'train-late60': { title: 'Comes back a minute late: presses Train 60 s after it first lit for each run (buying as usual meanwhile)', adapter: variant({ special: special({ trainLate: 60 }) }) },
  'train-wait60': { title: 'Presses Train only once it has been lit for a minute (the control presses it the moment it lights)', adapter: variant({ special: special({ trainDelay: 60 }) }) },
  'keep-internal': { title: 'Keeps every model internal ("keep it internal" for Sage-2, then Keep internal instead of Release)', adapter: variant({ special: special({ release: 'internal' }), modalChoice: (modal, enabled) => enabled.find((o) => /keep it internal/.test(o.l)) || enabled[0] }) },
  'ship-open': { title: 'Ships every model the moment Release works, open issues or not; never red-teams', adapter: variant({ special: special({ redteam: 'never' }), modalChoice: (modal, enabled) => enabled.find((o) => /release anyway|ship/i.test(o.l) && !/red|wait|hold|back|not|keep/i.test(o.l)) || enabled[0] }) },
  'no-train': { title: 'Never trains a model', adapter: variant({ special: special({ train: false }), skip: [...FT2_SKIP, 'btn-train'] }) },
  'focus-efficiency': { title: 'Always trains with Focus: Efficiency', adapter: variant({ special: special({ pre: focus('btn-focus-efficiency') }) }) },
  'focus-safety': { title: 'Always trains with Focus: Safety', adapter: variant({ special: special({ pre: focus('btn-focus-safety') }) }) },
  // --- events
  'modal-ignore': { title: 'Never answers an event (every one runs out its timer, if it has one)', adapter: variant({ modalChoice: () => null }) },
  'modal-last': { title: 'Answers every event with its last enabled option', adapter: variant({ modalChoice: (modal, enabled) => enabled[enabled.length - 1] }) },
  'modal-worst': { title: 'Picks the worst-looking option of every event (the reckless one)', adapter: variant({ modalChoice: byTable(WORST, 'worst') }) },
  'modal-best': { title: 'Picks the best-looking option of every event (the careful one); waits for a greyed one', adapter: variant({ modalChoice: byTable(BEST, 'best') }) },
  // --- settings
  'settings-on': { title: 'Switches on every toggle that starts OFF (Share evals, Job-transition fund)', adapter: variant({ special: special({ post: settingsOn(/./) }) }) },
};

// -------------------------------------------------------------------------------------- scenario
async function runScenario(name, flags, seed) {
  const sc = RUNS[name];
  const label = labelFor(name, flags, seed);
  const prefix = resolvePrefix(label);
  const modals = [];
  const noteLog = [];
  const minutes = [];
  const lastNote = {};
  const cardsSeen = new Map();
  const models = [];
  const releases = [];
  const reasonSeconds = {};
  const waitSeconds = {};
  const lotSeconds = {};
  const gateLog = [];
  const dark = { seconds: 0, max: 0, maxAt: null, first: null, firstScreen: null, says: {} };
  let lastModalKey = null;
  let maxOverflow = 0;
  let nShots = 0;
  let endScreen = null;
  let endSnap = null;
  let peakNumbers = { n: 0, t: 0 };
  let lastReleases = null;
  let lastPublic = null;
  const fiveMin = [];
  FALLBACKS.length = 0;
  TRAIN_LOG.length = 0;
  const revAt = new Map();
  SCREEN = null;
  const shotAt = new Set((flags.shots ? String(flags.shots).split(',') : []).map(Number));
  const capMinutes = Number(flags.minutes ?? 90);
  const { meta, rec } = await runGame({
    game: 'takeoff',
    adapter: sc.adapter,
    prefix: label,
    gameDir: flags.gameDir,
    realtime: Number(flags.realtime ?? 0),
    accelMinutes: capMinutes,
    seed: Number(seed ?? 1),
    stage: 2,
    viewport: sc.viewport,
    autoplay: !!sc.autoplay,
    quiet: true,
    async onSnapshot({ t, raw, session }) {
      const scr = await session.page.evaluate(READ);
      SCREEN = scr;
      maxOverflow = Math.max(maxOverflow, scr.overflowX);
      revAt.set(t, scr.st.rev);
      if (scr.st.stage === 2) {
        endScreen = { t, ...scr };
        endSnap = raw;
        if (lastReleases != null && scr.st.releases > lastReleases) releases.push({ t, model: scr.live.model, cap: scr.st.capability, internal: scr.st.internal, public: scr.st.publicReleases > lastPublic });
        lastReleases = scr.st.releases;
        lastPublic = scr.st.publicReleases;
        const tr = raw.buttons.find((b) => b.k === 'btn-train');
        if (tr && (scr.notes.trainReason || /free|dark/i.test(scr.notes.trainGpus || ''))) {
          const key = `Train: ${stripNum(`${/free|dark/i.test(scr.notes.trainGpus || '') ? `${scr.notes.trainGpus} · ` : ''}${scr.notes.trainReason || ''}`).replace(/ — about #/, '')}`;
          reasonSeconds[key] = (reasonSeconds[key] || 0) + 2;
        }
        // GPUs that are not running: the fleet against what the game itself counts as powered.
        if (scr.st.powered != null && scr.st.gpus - scr.st.powered > 0) {
          dark.seconds += 2;
          if (scr.st.gpus - scr.st.powered > dark.max) Object.assign(dark, { max: scr.st.gpus - scr.st.powered, maxAt: t });
          const says = `${scr.notes.powerFull || '(nothing on the power row)'}`;
          dark.says[stripNum(says)] = (dark.says[stripNum(says)] || 0) + 2;
          if (dark.first == null) Object.assign(dark, { first: t, firstScreen: { power: scr.live.stores, powerFull: scr.notes.powerFull, gpuFull: scr.notes.gpuFull, train: `${scr.notes.trainGpus || ''} | ${scr.notes.trainReason || ''}`, rows: scr.rows.map((r) => `${r.on ? '█' : '░'} ${r.text}`) } });
        }
        // The main lot row: enabled at full size, enabled shrunken, or greyed with which reason.
        {
          const lot = raw.buttons.find((b) => b.k === 'btn-gpuBatch');
          let key = 'no lot row';
          if (lot) key = lot.e ? (lotSize(lot) >= 1000 ? 'enabled, full 1,000' : 'enabled, shrunken (< 1,000)') : `greyed: ${stripNum(lot.why || '(no reason shown)').replace(/ — #$/, '')}`;
          lotSeconds[key] = (lotSeconds[key] || 0) + 2;
        }
        // What the training pipeline is doing or waiting for at this check, and (when Train is on screen
        // and blocked) by what, with whether the purchase that would unblock it is on screen and enabled.
        {
          const phase = raw.m.trainingPhase || '';
          let key = phase ? `run in progress: ${phase}` : 'idle';
          if (tr && tr.e) key = `Train lit${phase ? ` (second pipeline; the first is in ${phase})` : ''}`;
          else if (tr) {
            const cause = gateCause(scr.notes.trainGpus, scr.notes.trainReason);
            key = `Train blocked — ${cause}${phase ? ` (second pipeline; the first is in ${phase})` : ''}`;
            const on = (re) => raw.buttons.some((b) => b.e && re.test(b.k));
            const dataCards = raw.buttons.filter((b) => b.kind === 'project' && DATA_CARDS.test(b.l));
            gateLog.push({
              t,
              cause,
              text: `${scr.notes.trainGpus || ''} | ${scr.notes.trainReason || ''}`,
              lotOn: on(/^btn-gpuBatch/),
              plantOn: raw.buttons.some((b) => b.e && PLANT_KEYS_RE.test(b.l)),
              dcOn: on(/^btn-datacenter$/),
              dataCardShown: dataCards.length,
              dataCardOn: dataCards.filter((b) => b.e).length,
              assistantsShown: raw.buttons.some((b) => b.kind === 'project' && /AI research assistants/.test(b.l)),
              lotWhy: (raw.buttons.find((b) => b.k === 'btn-gpuBatch') || {}).why || '',
              funds: scr.st.funds,
            });
          }
          waitSeconds[key] = (waitSeconds[key] || 0) + 2;
        }
        if (raw.numbers > peakNumbers.n) peakNumbers = { n: raw.numbers, t };
        if (t % 300 === 0) fiveMin.push({ t, numbers: raw.numbers, controls: raw.buttons.length + raw.sliders.length, greyed: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').length, panels: raw.panels.length, words: scr.words });
      }
      for (const [k, v] of Object.entries(scr.notes)) {
        if (v !== lastNote[k]) {
          if (v && stripNum(lastNote[k]) !== stripNum(v)) noteLog.push({ t, k, v });
          lastNote[k] = v;
        }
      }
      const model = `${scr.live.model} ${scr.live.capability}×`;
      if (scr.live.model && (!models.length || models[models.length - 1].model !== model)) models.push({ t, model, rival: scr.notes.rival });
      for (const c of scr.cards) if (!cardsSeen.has(c.id)) cardsSeen.set(c.id, { t, ...c });
      for (const c of scr.cards) if (c.clipped) cardsSeen.get(c.id).everClipped = true;
      if (scr.modal) {
        const key = `${scr.modal.title}|${scr.modal.text}`;
        if (key !== lastModalKey) {
          modals.push({ t, ...scr.modal, m: { funds: scr.st.funds, trust: scr.st.trust } });
          if (nShots < 16 && flags.modalShots) await session.page.screenshot({ path: `${prefix}.modal${++nShots}.png`, fullPage: false }).catch(() => {});
        }
        lastModalKey = key;
      } else lastModalKey = null;
      if (t % 60 === 0) minutes.push({ t, ...scr.st, numbers: raw.numbers, buttons: raw.buttons.length, greyed: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').length, panels: raw.panels.length, words: scr.words, pageHeight: scr.pageHeight, m: raw.m, trainReason: `${scr.notes.trainGpus || ''}${scr.notes.trainReason ? ` · ${scr.notes.trainReason}` : ''}`, gpuReason: scr.notes.gpuReason, lot: scr.notes.gpuLot, standingLabel: scr.notes.standing, model: scr.live.model, meters: `${scr.live.gpuMeter || ''} ${scr.live.powerMeter || ''}` });
      if (shotAt.has(t)) await session.page.screenshot({ path: `${prefix}.view${t}.png`, fullPage: true }).catch(() => {});
      if (t === capMinutes * 60 && scr.st.stage === 2) await session.page.screenshot({ path: `${prefix}.cap.png`, fullPage: true }).catch(() => {});
    },
    async onStageEnd({ session }) {
      await session.page.screenshot({ path: `${prefix}.end.png`, fullPage: true }).catch(() => {});
    },
  });
  const lines = [];
  for (const e of rec.events) if (e.type === 'console' || e.type === 'log') lines.push(`${mmss(e.t)} [${e.type}${e.novel ? '' : ', repeat'}] ${e.text}`);
  const byWhy = {};
  for (const a of rec.actions) byWhy[a.why] = (byWhy[a.why] || 0) + (a.count || 1);
  const es = endScreen || { st: {}, notes: {}, live: {} };
  const run = { meta, snaps: rec.snaps, actions: rec.actions };
  const endT = meta.stageEnd ?? meta.endT;
  const hands = { stage: handsOf(run), after10: endT > 600 ? handsOf(run, { from: 600 }) : null, first10: handsOf(run, { to: Math.min(600, endT) }) };
  const relTimes = releases.map((r) => r.t);
  const intervals = relTimes.map((t, i) => t - (i ? relTimes[i - 1] : 0));
  const gate = gateAccount(gateLog, endT);
  const trainStarts = rec.actions.filter((a) => a.why === 'train').map((a) => a.t);
  const end = {
    label,
    name,
    title: sc.title,
    seed: meta.seed,
    stageEnd: meta.stageEnd,
    endT: meta.endT,
    atT: es.t,
    st: es.st,
    notes: es.notes,
    live: es.live,
    rows: es.rows,
    grey: endSnap ? endSnap.buttons.filter((b) => !b.e && b.kind !== 'modal').map((b) => `${b.l}${b.why ? ` [${b.why}]` : ''}`) : [],
    enabled: endSnap ? endSnap.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l) : [],
    panels: endSnap ? endSnap.panels.map((p) => p.l) : [],
    modalOpen: endSnap && endSnap.modal ? endSnap.modal.title : null,
    console: rec.events.filter((e) => e.type === 'console').slice(-6).map((e) => `${mmss(e.t)} ${e.text}`),
    actions: byWhy,
    models,
    releases,
    releaseIntervals: { fromArrival: intervals, longest: intervals.length ? Math.max(...intervals) : null, longestAfterFirst: intervals.length > 1 ? Math.max(...intervals.slice(1)) : null, tail: relTimes.length ? endT - relTimes[relTimes.length - 1] : null },
    hands,
    gate,
    dark,
    trainStarts,
    trainLog: TRAIN_LOG.map((r) => ({ ...r, revBefore: revAt.get(r.t) ?? null, rev20: revAt.get(r.t + 20) ?? null, rev60: revAt.get(r.t + 60) ?? null })),
    modalAnswers: rec.actions.filter((a) => a.why === 'modal').map((a) => `${mmss(a.t)} ${a.detail}`),
    modalsSeen: modals.map((m) => `${mmss(m.t)} ${m.title}`),
    reasonSeconds,
    waitSeconds,
    lotSeconds,
    peakNumbers,
    fiveMin,
    maxOverflow,
    pageErrors: meta.pageErrors,
    fallbacks: [...FALLBACKS],
  };
  writeJson(`${prefix}.end.json`, end);
  writeJson(`${prefix}.modals.json`, modals);
  writeJson(`${prefix}.cards.json`, [...cardsSeen.values()]);
  const secs = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} s (${f1((100 * v) / Math.max(1, endT))}%) — ${k}`);
  const md = [`# Stage 2 round-2 explore run: ${name} — ${sc.title}`, '', `Stage 2 start (preset 2), seed ${meta.seed}, ${meta.realtime ? `${meta.realtime} s real time then ` : ''}stepped, cap ${meta.accelMinutes} min. **Stage end: ${meta.stageEnd != null ? mmss(meta.stageEnd) : `not reached by ${mmss(meta.endT)}`}**. Page errors: ${meta.pageErrors.length}${meta.pageErrors.length ? ` (${meta.pageErrors[0]})` : ''}. Largest horizontal overflow: ${maxOverflow} px. Peak numbers on screen: ${peakNumbers.n} at ${mmss(peakNumbers.t)}.`, ''];
  md.push('## Hands', '', `- whole stage: ${handsLine(hands.stage)}`, `- first 10 minutes: ${handsLine(hands.first10)}`, hands.after10 ? `- after 10:00: ${handsLine(hands.after10)}` : '', `- share of checks each thing is enabled: ${Object.entries(hands.stage.enabledShare).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`, `- the only enabled thing at a check: ${Object.entries(hands.stage.soleShare).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`, `- clicks by kind: ${Object.entries(hands.stage.clicksBy).map(([k, v]) => `${k} ${v}`).join(' · ')}`, `- model releases at ${releases.map((r) => `${mmss(r.t)} (${r.model}${r.public ? '' : ', internal'})`).join(', ')}; intervals from the arrival ${intervals.map(mmss).join(', ')}; longest ${mmss(end.releaseIntervals.longest)}; from the last release to the stage end ${mmss(end.releaseIntervals.tail)}`, '');
  md.push('## Per minute', '', '| t | model | cap × | rival × | lead | gov | approval | align (shown / true) | funds | rev/s | price | GPUs (powered) / room | power MW | meters GPUs · power | halls | queue | standing | research | trust | data T | runs | releases | incidents | numbers | controls (greyed) | panels | words | page px | Train row | main lot | lot reason |', `|${'---|'.repeat(31)}`);
  for (const m of minutes) md.push(`| ${mmss(m.t)} | ${m.model ?? ''} | ${fmtN(m.capability, 2)} | ${fmtN(m.rival, 2)} | ${fmtN(m.lead, 2)} | ${fmtN(m.gov, 0)} | ${fmtN(m.approval, 0)} | ${fmtN(m.alignA, 0)} / ${fmtN(m.alignT, 0)} | ${money(m.funds)} | ${money(m.rev)} | $${fmtN(m.price, 3)} | ${fmtN(m.gpus)} (${fmtN(m.powered)}) / ${fmtN(m.m.gpuCapacity)} | ${fmtN(m.powerCap)} | ${m.meters ?? ''} | ${m.datacenters} | ${(m.queue || []).join(', ')} | ${m.standingLabel ?? ''} | ${fmtN(m.research)} | ${m.trust} | ${fmtN(m.data, 1)} | ${m.trainings} | ${m.releases} | ${m.incidents} | ${m.numbers} | ${m.buttons} (${m.greyed}) | ${m.panels} | ${m.words} | ${m.pageHeight} | ${m.trainReason ?? ''} | ${m.lot ?? ''} | ${m.gpuReason ?? ''} |`);
  md.push('', '## Models', '', ...models.map((m) => `- ${mmss(m.t)} ${m.model} — ${m.rival ?? ''}`));
  md.push('', '## End state', '', '```', JSON.stringify({ stageEnd: end.stageEnd, atT: end.atT, st: end.st, notes: end.notes, live: end.live, rows: end.rows, grey: end.grey, enabled: end.enabled, modalOpen: end.modalOpen, console: end.console }, null, 1), '```');
  md.push('', '## The main lot row, seconds in each state', '', ...secs(lotSeconds));
  md.push('', '## Seconds each Train reason stood', '', ...secs(reasonSeconds));
  md.push('', '## What the training pipeline was doing, seconds (2-s checks)', '', ...secs(waitSeconds));
  md.push('', '## Train under the hard gate', '', `Train on screen and blocked for ${gate.blockedSeconds} s (${f1(gate.blockedPct)}% of the stage). Runs started at ${trainStarts.map(mmss).join(', ')}.`, '', '| blocked by | seconds | % of stage | stretches | longest (from) | row at first sight | a GPU lot enabled | a plant enabled | Build Datacenter enabled | a data card on screen / enabled | main lot row during it |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, b] of Object.entries(gate.by).sort((x, y) => y[1].seconds - x[1].seconds)) md.push(`| ${k} | ${b.seconds} | ${f1((100 * b.seconds) / Math.max(1, endT))} | ${b.stretches} | ${b.longest} s (${mmss(b.longestAt)}) | ${mmss(b.firstAt)}: "${b.firstText}" | ${b.lotOn} s | ${b.plantOn} s | ${b.dcOn} s | ${b.dataCardShown} s / ${b.dataCardOn} s | ${Object.entries(b.lotWhy).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([w, s]) => `${w}: ${s} s`).join('; ')} |`);
  md.push('', '## Training runs: what each asked for', '', '| pressed at | button | Cost | GPU line | fleet (powered) | share of the fleet | funds | rev/s before → +20 s → +60 s |', '|---|---|---|---|---|---|---|---|', ...end.trainLog.map((r) => { const need = Number(((/Needs ([0-9][0-9,]*)/.exec(r.needs || '') || [])[1] || '0').replace(/,/g, '')); return `| ${mmss(r.t)} | ${r.next} | ${r.cost} | ${r.needs ?? ''} | ${fmtN(r.gpus)} (${fmtN(r.powered)}) | ${need && r.gpus ? f1((100 * need) / r.gpus) + '%' : '—'} | ${money(r.funds)} | ${money(r.revBefore)} → ${money(r.rev20)} → ${money(r.rev60)} |`; }));
  md.push('', '## GPUs that are not running', '', dark.seconds ? `The fleet was larger than the powered GPUs for ${dark.seconds} s (${f1((100 * dark.seconds) / Math.max(1, endT))}% of the stage); most ${fmtN(dark.max)} dark at ${mmss(dark.maxAt)}; first at ${mmss(dark.first)}.` : 'Never: the powered GPUs equalled the fleet at every check.', ...(dark.seconds ? ['', 'What the power row said while GPUs were dark:', ...secs(dark.says), '', `Screen at ${mmss(dark.first)}: stores "${dark.firstScreen.power}"; Train "${dark.firstScreen.train}"`, ...dark.firstScreen.rows.map((r) => `- ${r}`)] : []));
  md.push('', '## Events (first sight of each)', '');
  for (const m of modals) md.push(`- **${mmss(m.t)} — ${m.title}** ${m.timer ? `[${m.timer}] ` : '(no timer) '}(funds ${money(m.m.funds)}, trust ${m.m.trust})`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`));
  md.push('', '## Event answers', '', ...end.modalAnswers.map((a) => `- ${a}`));
  if (FALLBACKS.length) md.push('', '## Events answered by the printed-effect score', '', ...FALLBACKS.map((f) => `- ${mmss(f.t)} ${f.title} (${f.why}): ${f.picked} (${f.scores.join('; ')})`));
  md.push('', '## Actions', '', ...Object.entries(byWhy).map(([k, v]) => `- ${k}: ${v}`));
  md.push('', '## Training and infrastructure clicks', '', ...rec.actions.filter((a) => /^(train|infra)$/.test(a.why) && !/^btn-gpuBatch$/.test(a.key)).map((a) => `- ${mmss(a.t)} ${a.label}: ${a.detail}`));
  md.push('', '## Settings pressed', '', ...rec.actions.filter((a) => a.why === 'setting' || a.why === 'slider' || a.why === 'focus').map((a) => `- ${mmss(a.t)} ${a.label || a.key}: ${a.detail}`));
  md.push('', '## Project cards at first sight', '', '| t | card text | classes | tooltip | clipped |', '|---|---|---|---|---|', ...[...cardsSeen.values()].map((c) => `| ${mmss(c.t)} | ${c.text.replace(/\|/g, '/')} | ${c.cls} | ${c.title} | ${c.everClipped ? 'YES' : ''} |`));
  md.push('', '## On-screen notes, each time their wording changed', '', ...noteLog.map((n) => `- ${mmss(n.t)} ${n.k}: ${n.v}`));
  md.push('', '## Console and Developments lines', '', ...lines.map((l) => `- ${l}`), '');
  fs.writeFileSync(`${prefix}.explore.md`, md.join('\n'));
  console.log(`${label}: stage end ${meta.stageEnd != null ? mmss(meta.stageEnd) : `NOT REACHED by ${mmss(meta.endT)}`} · cap ${fmtN(es.st.capability, 2)}× · gov ${fmtN(es.st.gov, 0)} · approval ${fmtN(es.st.approval, 0)} · lead ${fmtN(es.st.lead, 2)} · align ${fmtN(es.st.alignA, 0)}/${fmtN(es.st.alignT, 0)} · GPUs ${fmtN(es.st.gpus)} · none ${f1(hands.stage.nonePct)}% · two+ ${f1(hands.stage.twoPct)}% · ${f1(hands.stage.perMin)} clicks/min · gap30 after 10:00 ${hands.after10 ? f1(hands.after10.gap30Pct) : '—'}% · longest release interval ${mmss(end.releaseIntervals.longest)} · events ${modals.length} · errors ${meta.pageErrors.length}`);
  return end;
}

// ---------------------------------------------------------------------------------------- PROBES
const screenOf = (kit) => kit.session.page.evaluate(READ);
const stateJson = (kit) => kit.session.page.evaluate(() => JSON.stringify(window.__game.state));
const consoleNow = (kit) => kit.session.page.evaluate(() => ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => document.getElementById(id).textContent.trim()).filter(Boolean));
const rowsText = (scr) => scr.rows.map((r) => `${r.on ? '█' : '░'} ${r.text}`);
function stateDiff(a, b) {
  const A = JSON.parse(a);
  const B = JSON.parse(b);
  const out = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (JSON.stringify(A[k]) === JSON.stringify(B[k])) continue;
    if (A[k] && B[k] && typeof A[k] === 'object' && !Array.isArray(A[k])) {
      for (const k2 of new Set([...Object.keys(A[k]), ...Object.keys(B[k])])) if (JSON.stringify(A[k][k2]) !== JSON.stringify(B[k][k2])) out.push(`${k}.${k2}: ${JSON.stringify(A[k][k2])?.slice(0, 60)} → ${JSON.stringify(B[k][k2])?.slice(0, 60)}`);
    } else out.push(`${k}: ${JSON.stringify(A[k])?.slice(0, 60)} → ${JSON.stringify(B[k])?.slice(0, 60)}`);
  }
  return out;
}
const ft2 = (kit, over = {}) => kit.policy({ skip: ['btn-gpuBatch5', 'btn-gpuBatch25', 'btn-train'], special: special(), ...over });
const trainRow = (scr) => `Cost: ${scr.live.trainCost || '—'} ⏎ ${scr.live.trainMeter || ''} ${scr.notes.trainGpus || ''} ⏎ ${scr.notes.trainReason || ''}`.trim();
async function playUntil(kit, pol, seconds, cond) {
  let hit = null;
  await kit.run(seconds, async (t, s) => {
    SCREEN = await screenOf(kit);
    if (await cond(s, t, SCREEN)) {
      hit = s;
      return 'stop';
    }
    await pol.pass(t);
    return undefined;
  });
  return hit;
}
/** Plays `seconds` with the policy, keeping SCREEN fresh for the policy's notes. */
async function play(kit, pol, seconds) {
  return kit.run(seconds, async (t) => {
    SCREEN = await screenOf(kit);
    await pol.pass(t);
    return undefined;
  });
}
async function reloadReport(kit, out, what) {
  const a = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.shot(`${what}-before`);
  await kit.reload();
  const b = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.shot(`${what}-after`);
  const diff = stateDiff(a.st, b.st);
  const noteDiff = Object.keys(a.scr.notes).filter((k) => a.scr.notes[k] !== b.scr.notes[k]).map((k) => `${k}: "${a.scr.notes[k]}" → "${b.scr.notes[k]}"`);
  const rowDiff = a.scr.rows.map((r, i) => (b.scr.rows[i] && b.scr.rows[i].text === r.text && b.scr.rows[i].on === r.on ? null : `"${r.text}" → "${b.scr.rows[i] ? b.scr.rows[i].text : '(gone)'}"`)).filter(Boolean);
  out.push(`**${what}** at ${mmss(kit.t)}: capability ${a.scr.live.capability}×, stores "${a.scr.live.stores}".`, `- before: event ${a.scr.modal ? `"${a.scr.modal.title}" ${a.scr.modal.timer ? `[${a.scr.modal.timer}]` : '(no timer)'}` : 'none'}; build/queue [${a.scr.st.queue.join(', ')}]; interconnect line "${a.scr.notes.interconnect ?? ''}"; datacenter row "${(a.scr.rows.find((r) => r.id === 'btn-datacenter') || {}).text ?? ''}"; run phase "${a.scr.st.runPhase}"; console ${a.con.map((c) => `"${c}"`).join(' / ')}`, `- after:  event ${b.scr.modal ? `"${b.scr.modal.title}" ${b.scr.modal.timer ? `[${b.scr.modal.timer}]` : '(no timer)'}` : 'none'}; build/queue [${b.scr.st.queue.join(', ')}]; interconnect line "${b.scr.notes.interconnect ?? ''}"; datacenter row "${(b.scr.rows.find((r) => r.id === 'btn-datacenter') || {}).text ?? ''}"; run phase "${b.scr.st.runPhase}"; console ${b.con.map((c) => `"${c}"`).join(' / ') || '(empty)'}`, `- state keys that differ after the reload: ${diff.length ? diff.slice(0, 12).join('; ') : 'none (the saved state is identical)'}`, `- on-screen notes that differ: ${noteDiff.length ? noteDiff.join('; ') : 'none'}; infrastructure rows that differ: ${rowDiff.length ? rowDiff.join('; ') : 'none'}; cards ${a.scr.cards.length} → ${b.scr.cards.length}; page height ${a.scr.pageHeight} → ${b.scr.pageHeight}`, '');
}
const revNow = (kit) => kit.session.page.evaluate(() => ({ rev: window.__game.state.stats.revPerSec, rate: window.__game.state.stats.tasksPerSec, funds: window.__game.state.funds, gpus: window.__game.state.gpus, price: window.__game.state.price, cap: window.__game.state.capability }));

const PROBES = {
  'lot-return': {
    title: 'Does the return printed on a lot row match what happens? (twin sessions from the same seed: one buys the lot, one does not)',
    async run(kit, out, flags) {
      const marks = (flags.at ? String(flags.at).split(',').map(Number) : [0, 300, 720, 1260, 1800, 2160]);
      out.push('Each line: two identical sessions are played by the first-timer to the mark; at the mark both stop clicking. The Standing order, if on screen, is switched off in both. Session A buys the largest enabled lot once, session B buys nothing; 20 s, 40 s and 90 s later the 10-s average revenue is read in both. "Printed" is the note on the row A pressed.', '', '| t | row pressed | printed | funds before | rev/s before | A − B at +20 s | A − B at +40 s | A − B at +90 s | measured / printed (+40 s) | payback at the printed rate | A − B funds at +90 s |', '|---|---|---|---|---|---|---|---|---|---|---|');
      for (const mark of marks) {
        const sessions = [];
        for (const buy of [true, false]) {
          const k = await openProbe(base, { gameDir: kit.gameDir, seed: kit.seed, prefix: kit.prefix, stage: 2 });
          const pol = ft2(k);
          let row = null;
          // play to the mark, then on until a lot row is enabled (so both twins stop at the same check)
          await play(k, pol, mark);
          const hit = await playUntil(k, pol, 600, async (s) => LOT_KEYS.some((key) => (s.buttons.find((b) => b.k === key) || {}).e));
          // The Standing order would answer the idle twin with lots of its own: switched off in both.
          for (let i = 0; i < 6; i++) {
            const st = await screenOf(k);
            if (!st.notes.standing || st.notes.standing === 'off') break;
            await k.click('btn-standing', 1, 'setting');
          }
          const scr = await screenOf(k);
          const before = await revNow(k);
          if (hit) {
            const lot = LOT_KEYS.map((key) => hit.buttons.find((b) => b.k === key)).find((b) => b && b.e);
            const r = scr.rows.find((x) => x.id === lot.k);
            row = { key: lot.k, text: r ? r.text : lot.l, t: k.t };
            if (buy) await k.click(lot.k, 1, 'probe');
          }
          await k.run(20);
          const r20 = await revNow(k);
          await k.run(20);
          const r40 = await revNow(k);
          await k.run(50);
          const r90 = await revNow(k);
          sessions.push({ row, before, r20, r40, r90 });
          await k.close();
        }
        const [A, B] = sessions;
        if (!A.row) {
          out.push(`| ${mmss(mark)} | no lot row enabled within 10 minutes | | | | | | | | | |`);
          continue;
        }
        const printed = /\+\$\s?([0-9][0-9,.]*)\s?([KMB])?\/s/.exec(A.row.text);
        const pv = printed ? parseFloat(printed[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[printed[2]] || 1) : null;
        const price = /\$\s?([0-9][0-9,.]*)\s?([KMB])?/.exec(A.row.text.replace(/^[^$]*/, ''));
        const cost = price ? parseFloat(price[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[price[2]] || 1) : null;
        const d20 = A.r20.rev - B.r20.rev;
        const d40 = A.r40.rev - B.r40.rev;
        out.push(`| ${mmss(A.row.t)} | "${A.row.text}" | ${pv != null ? `+${money(pv)}/s` : '(none printed)'} | ${money(A.before.funds)} | ${money(A.before.rev)} | ${money(d20)} | ${money(d40)} | ${money(A.r90.rev - B.r90.rev)} | ${pv ? `${f1((100 * d40) / pv)}%` : '—'} | ${pv && cost ? mmss(cost / pv) : '—'} | ${money(A.r90.funds - B.r90.funds)} |`);
      }
    },
  },
  'gate-screens': {
    title: 'The Train row under the hard GPU requirement: a player who buys no GPU lot (and switches the Standing order off) until Train is blocked for GPUs; what the screen says; what it takes to light it',
    async run(kit, out) {
      const noLots = ft2(kit, { special: special({ infra: { lots: false }, post: standingTo('off') }) });
      let last = '';
      out.push('The Train row each time its wording changes (█ lit, ░ greyed), with the fleet at that moment:', '');
      const hit = await playUntil(kit, noLots, 2400, async (s, t, scr) => {
        const tr = s.buttons.find((b) => b.k === 'btn-train');
        if (!tr) return false;
        const cause = tr.e ? '' : gateCause(scr.notes.trainGpus, scr.notes.trainReason);
        const key = `${tr.e ? '█' : '░'} ${stripNum(trainRow(scr))}`;
        if (key !== last) out.push(`- ${mmss(t)} ${tr.e ? '█' : '░'} ${tr.l} — ${trainRow(scr)} [fleet ${fmtN(scr.st.gpus)}, powered ${fmtN(scr.st.powered)}, funds ${money(scr.st.funds)}, research ${fmtN(scr.st.research)}, data ${fmtN(scr.st.data, 1)} T]`);
        last = key;
        return /^GPUs/.test(cause);
      });
      if (!hit) return void out.push('', 'Train was never blocked for GPUs within 40 minutes of this player.');
      const a = await screenOf(kit);
      await kit.shot('gate-blocked');
      const tips = await kit.session.page.evaluate(() => ({ train: document.getElementById('btn-train').title, line: (document.getElementById('trainGpuLine') || {}).title || '', meter: (document.getElementById('trainGpuMeter') || {}).title || '', reason: (document.getElementById('trainReason') || {}).title || '' }));
      const t0 = kit.t;
      out.push('', `**Blocked for GPUs at ${mmss(t0)}.** Train row: "${trainRow(a)}". Tooltips: button "${tips.train}"; GPU line "${tips.line}"; meter "${tips.meter}"; reason "${tips.reason}".`, `Stores: "${a.live.stores}". Funds ${money(a.st.funds)}, rev ${money(a.st.rev)}/s.`, 'Infrastructure rows at that moment:', ...rowsText(a).map((r) => `- ${r}`), `Console: ${(await consoleNow(kit)).map((c) => `"${c}"`).join(' / ')}`, '');
      // two more minutes of refusing: does the screen or the console say more?
      await play(kit, noLots, 120);
      const b = await screenOf(kit);
      out.push(`Two minutes later, still no lot bought (${mmss(kit.t)}): Train row "${trainRow(b)}"; funds ${money(b.st.funds)}.`, 'Console lines in those two minutes that mention GPUs, the run or Train:', ...(kit.linesBetween(t0, kit.t, ['console']).filter((l) => /GPU|run|train|lot/i.test(l)).map((l) => `- ${l}`).length ? kit.linesBetween(t0, kit.t, ['console']).filter((l) => /GPU|run|train|lot/i.test(l)).map((l) => `- ${l}`) : ['- (none)']), 'Infrastructure rows:', ...rowsText(b).map((r) => `- ${r}`), '');
      // the way out: the first-timer's ordinary rules
      const pol = ft2(kit);
      const t1 = kit.t;
      const lit = await playUntil(kit, pol, 900, async (s) => {
        const tr = s.buttons.find((x) => x.k === 'btn-train');
        return !!(tr && tr.e) || s.m.trainingPhase === 'training';
      });
      const c = await screenOf(kit);
      out.push(`The first-timer's ordinary rules from ${mmss(t1)}: Train ${lit ? `lit at ${mmss(kit.t)} (${kit.t - t1} s later)` : 'still blocked 15 minutes later'}; fleet ${fmtN(b.st.gpus)} → ${fmtN(c.st.gpus)}; clicks in between: ${kit.rec.actions.filter((x) => x.t >= t1 && x.t <= kit.t && x.why !== 'mash').map((x) => x.label).reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map()).entries().toArray().map(([l, n]) => `${l} ×${n}`).join(', ')}.`);
    },
  },
  'dark-gpus': {
    title: 'GPUs that are not running: every power-cutting event the dev overlay can fire, fired at 15:00 of the first-timer; what the Stores, the lot rows, the Train row and the console say',
    async run(kit, out) {
      const pol = ft2(kit);
      await play(kit, pol, 900);
      const fireable = await kit.session.page.evaluate(() => {
        const f = window.__game.events.fireable;
        return (typeof f === 'function' ? f() : f || []).map((e) => (typeof e === 'string' ? e : e.id || e.name || JSON.stringify(e)));
      });
      out.push(`Dev overlay "Fire event" list at 15:00: ${fireable.join(', ')}`, '');
      const before = await screenOf(kit);
      out.push(`Before: stores "${before.live.stores}"; fleet ${fmtN(before.st.gpus)}, powered ${fmtN(before.st.powered)}; Train row "${trainRow(before)}"; rev ${money(before.st.rev)}/s.`, '');
      for (const id of fireable.filter((x) => /curtail|protest|riot|heat|grid|power|blackout|fence/i.test(x))) {
        const st0 = await stateJson(kit);
        const t0 = kit.t;
        await kit.session.page.evaluate((x) => window.__game.events.fire(x), id);
        await kit.run(4);
        const a = await screenOf(kit);
        await kit.shot(`dark-${id}`);
        out.push(`**${id}** fired at ${mmss(t0)}; 4 s later: stores "${a.live.stores}"; power row note "${a.notes.powerFull ?? ''}"; GPU row note "${a.notes.gpuFull ?? ''}"; fleet ${fmtN(a.st.gpus)}, powered ${fmtN(a.st.powered)} (${fmtN(a.st.gpus - a.st.powered)} dark); Train row "${trainRow(a)}"; rev ${money(a.st.rev)}/s.`, ...rowsText(a).map((r) => `- ${r}`), ...kit.linesBetween(t0, kit.t, ['console', 'log', 'modal']).map((l) => `- ${l}`));
        let back = null;
        await kit.run(240, async (t) => {
          SCREEN = await screenOf(kit);
          if (back == null && SCREEN.st.powered >= SCREEN.st.gpus) {
            back = t;
            return 'stop';
          }
          return undefined;
        });
        out.push(`- every GPU powered again ${back != null ? `at ${mmss(back)} (${back - t0} s)` : 'not within 4 minutes'} with nothing clicked.`, '');
        void st0;
      }
    },
  },
  'governor': {
    title: 'The reservations on the lot rows: what each greyed lot says, what it holds back, and whether the player can spend the reserved money another way',
    async run(kit, out) {
      const pol = ft2(kit);
      const seen = new Map();
      const refuse = ft2(kit, { special: special({ infra: { plants: false, dcs: false } }) });
      // 1. every wording of the main lot's reason in a normal stage, with the first screen that showed it
      await kit.run(1500, async (t) => {
        SCREEN = await screenOf(kit);
        const why = stripNum(SCREEN.notes.gpuReason || '').replace(/ — #$/, '');
        const lot = SCREEN.rows.find((r) => r.id === 'btn-gpuBatch');
        const key = lot && lot.on ? `ENABLED ${stripNum(lot.text.replace(/^Buy GPUs \([0-9,]+\) \$[0-9,.MK]+ ?/, '').replace(/\+\$[0-9,.MK]+\/s ?·? ?/, ''))}` : `greyed: ${why}`;
        if (!seen.has(key)) seen.set(key, { t, rows: rowsText(SCREEN), funds: SCREEN.st.funds, train: trainRow(SCREEN), n: 0 });
        seen.get(key).n += 2;
        await pol.pass(t);
        return undefined;
      });
      out.push('Every state of the main lot row in the first 25 minutes of the first-timer, with the screen that first showed it:', '');
      for (const [k, v] of [...seen].sort((a, b) => b[1].n - a[1].n)) out.push(`- **${k}** — ${v.n} s in 25 min; first at ${mmss(v.t)} with funds ${money(v.funds)}:`, ...v.rows.map((r) => `  - ${r}`), `  - Train: ${v.train}`);
      void refuse;
    },
  },
  'reserve-refused': {
    title: 'A player who refuses what the lot row asks for ("the plant first", "the hall first"): what the row does next, for ten minutes',
    async run(kit, out) {
      const pol = ft2(kit, { special: special({ infra: { plants: false, dcs: false } }) });
      const hit = await playUntil(kit, pol, 900, async (s, t, scr) => /plant first|hall first/i.test(scr.notes.gpuReason || ''));
      if (!hit) return void out.push('No "the plant first" / "the hall first" within 15 minutes.');
      const a = await screenOf(kit);
      out.push(`At ${mmss(kit.t)} the main lot row first reads "${a.notes.gpuReason}" (funds ${money(a.st.funds)}, GPUs ${fmtN(a.st.gpus)}, power ${fmtN(a.st.powerCap)} MW, halls ${a.st.datacenters}):`, ...rowsText(a).map((r) => `- ${r}`), '', 'The player never buys a plant or a hall from here; everything else as usual. The row, each time its wording changes:', '');
      let last = '';
      const t0 = kit.t;
      await kit.run(600, async (t) => {
        SCREEN = await screenOf(kit);
        const lot = SCREEN.rows.find((r) => r.id === 'btn-gpuBatch');
        const key = `${lot.on ? '█' : '░'} ${stripNum(lot.text)}`;
        if (key !== last) out.push(`- ${mmss(t)} ${lot.on ? '█' : '░'} ${lot.text} (funds ${money(SCREEN.st.funds)}, GPUs ${fmtN(SCREEN.st.gpus)} of ${fmtN(SCREEN.st.powerCap * 1000)} powered)`);
        last = key;
        await pol.pass(t);
        return undefined;
      });
      const b = await screenOf(kit);
      out.push('', `At ${mmss(kit.t)}: GPUs ${fmtN(b.st.gpus)}, power ${fmtN(b.st.powerCap)} MW, funds ${money(b.st.funds)}, capability ${b.live.capability}×.`, ...rowsText(b).map((r) => `- ${r}`), '', 'Console lines about power, room or the reservation in those ten minutes:', ...kit.linesBetween(t0, kit.t, ['console']).filter((l) => /power|room|plant|hall|turbine|datacenter|slots|MW/i.test(l)).map((l) => `- ${l}`));
    },
  },
  'standing-cycle': {
    title: "The Standing order's share button: its cycle, what the row prints at each setting, and what each setting buys in three minutes with no other click",
    async run(kit, out) {
      const pol = ft2(kit);
      const hit = await playUntil(kit, pol, 1500, async (s) => !!s.buttons.find((b) => b.k === 'btn-standing'));
      if (!hit) return void out.push('The Standing order never came on screen within 25 minutes.');
      await play(kit, pol, 20);
      const a = await screenOf(kit);
      out.push(`Standing order on screen at about ${mmss(kit.t - 20)}. Row: "${(a.rows.find((r) => r.id === 'btn-standing') || {}).text}". Tooltip: "${await kit.session.page.evaluate(() => document.getElementById('btn-standing').title)}".`, '', 'Pressed six times (nothing else clicked, no time passes):');
      for (let i = 0; i < 6; i++) {
        await kit.click('btn-standing', 1, 'setting');
        const s = await screenOf(kit);
        out.push(`- press ${i + 1}: "${(s.rows.find((r) => r.id === 'btn-standing') || {}).text}" (state: standingOrder ${s.st.standing}, standingBudget ${s.st.standingBudget})`);
      }
      await kit.shot('standing-cycle');
    },
  },
  'standing-rates': {
    title: 'What each Standing-order setting buys: three idle minutes at each share from the same state (five sessions)',
    async run(kit, out) {
      out.push('Each session is played by the first-timer until the Standing order has been on screen for 60 s; the share is then set and nothing at all is clicked for 180 s.', '', '| share | row at the start | GPUs before → after | lots bought by the order | funds before → after | rev/s before → after | row at the end |', '|---|---|---|---|---|---|---|');
      for (const want of ['off', '25%', '50%', '75%', '100%']) {
        const k = await openProbe(base, { gameDir: kit.gameDir, seed: kit.seed, prefix: kit.prefix, stage: 2 });
        const pol = ft2(k);
        await playUntil(k, pol, 1500, async (s) => !!s.buttons.find((b) => b.k === 'btn-standing'));
        await play(k, pol, 60);
        for (let i = 0; i < 6; i++) {
          const s = await screenOf(k);
          if (s.notes.standing === want) break;
          await k.click('btn-standing', 1, 'setting');
        }
        const a = await screenOf(k);
        const batches0 = await k.session.page.evaluate(() => window.__game.state.gpuBatches);
        await k.run(180);
        const b = await screenOf(k);
        const batches1 = await k.session.page.evaluate(() => window.__game.state.gpuBatches);
        out.push(`| ${want} | "${(a.rows.find((r) => r.id === 'btn-standing') || {}).text}" | ${fmtN(a.st.gpus)} → ${fmtN(b.st.gpus)} | ${batches1 - batches0} | ${money(a.st.funds)} → ${money(b.st.funds)} | ${money(a.st.rev)} → ${money(b.st.rev)} | "${(b.rows.find((r) => r.id === 'btn-standing') || {}).text}" · main lot "${(b.rows.find((r) => r.id === 'btn-gpuBatch') || {}).text}" |`);
        await k.close();
      }
    },
  },
  'reload-mid-build': {
    title: 'Reload while a datacenter is under construction, while a plant is in the interconnect queue, and with the Standing order waiting for its next lot',
    async run(kit, out) {
      const pol = ft2(kit);
      const hit = await playUntil(kit, pol, 1800, async (s, t, scr) => scr.st.queue.some((q) => /^datacenter/.test(q)));
      if (hit) {
        await kit.session.advance(2000);
        await reloadReport(kit, out, 'reload-mid-build');
        const t0 = kit.t;
        await play(kit, pol, 120);
        out.push('Next 120 s:', ...kit.linesBetween(t0, kit.t, ['console']).filter((l) => /Datacenter|complete|Room/i.test(l)).map((l) => `- ${l}`), '');
      } else out.push('No datacenter under construction within 30 minutes.', '');
      const hit2 = await playUntil(kit, pol, 1800, async (s, t, scr) => scr.st.queue.some((q) => /^(solar|nuclear)/.test(q)));
      if (hit2) {
        await kit.session.advance(2000);
        await reloadReport(kit, out, 'reload-mid-queue');
      } else out.push('No plant in the interconnect queue within 30 more minutes.', '');
      const hit3 = await playUntil(kit, pol, 600, async (s, t, scr) => /next lot in/.test(scr.notes.standingNote || ''));
      if (hit3) await reloadReport(kit, out, 'reload-standing-wait');
    },
  },
  'reload-mid-run': {
    title: 'Reload at 12:00 of ordinary play, during a training run, during an evaluation and during the red-team wait',
    async run(kit, out) {
      const pol = ft2(kit);
      await play(kit, pol, 720);
      await reloadReport(kit, out, 'reload-mid-run');
      const hit = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'training');
      if (hit) {
        await kit.session.advance(2000);
        await reloadReport(kit, out, 'reload-mid-training');
      } else out.push('No training run within 15 more minutes.');
      const hit2 = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'evaluating');
      if (hit2) await reloadReport(kit, out, 'reload-mid-evaluation');
      const hit3 = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'redteam');
      if (hit3) await reloadReport(kit, out, 'reload-mid-redteam');
    },
  },
  'reload-mid-event': {
    title: 'Reload with an event open (the first two events)',
    async run(kit, out) {
      const pol = ft2(kit);
      for (let i = 0; i < 2; i++) {
        const hit = await playUntil(kit, pol, 1800, async (s) => !!s.modal);
        if (!hit) {
          out.push('No event within 30 minutes.');
          continue;
        }
        await reloadReport(kit, out, `reload-mid-event-${i + 1}`);
        await kit.run(6);
        const c = await screenOf(kit);
        out.push(`- 6 s later, unanswered: ${c.modal ? `"${c.modal.title}" ${c.modal.timer ? `[${c.modal.timer}]` : '(no timer)'}` : 'event gone'}.`, '');
        await play(kit, pol, 4);
      }
    },
  },
  'idle-start': {
    title: 'Nothing clicked for 10 minutes from the first second of Stage 2',
    async run(kit, out) {
      const a = await screenOf(kit);
      const end = await kit.run(600);
      await kit.shot('idle-start-10min');
      const b = await screenOf(kit);
      out.push(`At 0:00: capability ${a.live.capability}×, stores "${a.live.stores}".`, '', 'Everything that appeared in 600 s with no input:', ...kit.linesBetween(0, kit.t).map((l) => `- ${l}`), ...kit.revealsBetween(0, kit.t).map((l) => `- reveal ${l}`), '', `At 10:00: capability ${b.live.capability}×, stores "${b.live.stores}"; event ${b.modal ? `"${b.modal.title}" ${b.modal.timer || '(no timer)'}` : 'none'}; idle rescues ${b.st.idleRescues}; rev ${money(b.st.rev)}/s.`, '', 'Infrastructure rows:', ...rowsText(b).map((r) => `- ${r}`), '', 'On screen:', ...kit.screen(end, { lines: 5 }).map((l) => `- ${l}`));
      const pol = ft2(kit);
      const t0 = kit.t;
      await play(kit, pol, 300);
      const d = await screenOf(kit);
      out.push('', `After 5 minutes of normal play on return (to ${mmss(kit.t)}): capability ${d.live.capability}×, stores "${d.live.stores}"; rev ${money(d.st.rev)}/s.`, ...kit.linesBetween(t0 + 1, t0 + 40, ['console']).map((l) => `- ${l}`));
    },
  },
  'idle-mid': {
    title: 'Play 12 minutes, walk away for 10, come back',
    async run(kit, out) {
      const pol = ft2(kit);
      await play(kit, pol, 720);
      const sa = await screenOf(kit);
      const t0 = kit.t;
      const b = await kit.run(600);
      await kit.shot('idle-mid-after-10min-away');
      const sb = await screenOf(kit);
      out.push(`At ${mmss(t0)} (walking away): capability ${sa.live.capability}×, stores "${sa.live.stores}"; run "${sa.st.runPhase || 'idle'}"; rev ${money(sa.st.rev)}/s; Train: "${trainRow(sa)}".`, ...rowsText(sa).map((r) => `- ${r}`), '', 'While away (600 s, nothing clicked):', ...kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`), '', `At ${mmss(kit.t)} (back): capability ${sb.live.capability}×, stores "${sb.live.stores}"; run "${sb.st.runPhase || 'idle'}"; rev ${money(sb.st.rev)}/s; event ${sb.modal ? `"${sb.modal.title}" ${sb.modal.timer || '(no timer)'}` : 'none'}; events waiting ${sb.st.choiceQueue}; idle rescues ${sb.st.idleRescues}.`, ...rowsText(sb).map((r) => `- ${r}`), '', 'On screen:', ...kit.screen(b, { lines: 5 }).map((l) => `- ${l}`));
      const t1 = kit.t;
      await play(kit, pol, 300);
      const sc = await screenOf(kit);
      out.push('', `After 5 more minutes of normal play (to ${mmss(kit.t)}): capability ${sc.live.capability}×, stores "${sc.live.stores}"; rev ${money(sc.st.rev)}/s.`, ...kit.linesBetween(t1 + 1, t1 + 60, ['console']).map((l) => `- ${l}`));
    },
  },
  'idle-events': {
    title: 'Nothing clicked from the first second for 30 minutes: every event that opens, how it closes, and what the idle player ends with',
    async run(kit, out) {
      let lastTitle = null;
      await kit.run(1800, async (t, s) => {
        const title = s.modal ? s.modal.title : null;
        if (title !== lastTitle) {
          const scr = await screenOf(kit);
          if (title) out.push(`- **${mmss(t)} — ${scr.modal.title}** ${scr.modal.timer ? `[${scr.modal.timer}]` : '(NO TIMER)'}: "${scr.modal.text}" — options ${scr.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (greyed)' : ''}`).join(' / ')}. Funds ${money(scr.st.funds)}, rev ${money(scr.st.rev)}/s, ${s.buttons.filter((b) => isThing(b)).length} things enabled behind it, idle rescues ${scr.st.idleRescues}.`);
          else out.push(`  - closed by ${mmss(t)}: ${kit.linesBetween(t - 4, t, ['console']).slice(-2).join(' / ') || '(no line)'}`);
        }
        lastTitle = title;
        return undefined;
      });
      const b = await screenOf(kit);
      await kit.shot('idle-events-30min');
      out.push('', `At 30:00 with nothing ever clicked: capability ${b.live.capability}×, stores "${b.live.stores}", rev ${money(b.st.rev)}/s, idle rescues ${b.st.idleRescues}, event open: ${b.modal ? `"${b.modal.title}"` : 'none'}, events waiting ${b.st.choiceQueue}.`, ...rowsText(b).map((r) => `- ${r}`));
    },
  },
  'event-keys': {
    title: 'With an event open: a real mouse click behind it, Tab, Escape; where the panel sits over the stores',
    async run(kit, out) {
      const pol = ft2(kit);
      const { page } = kit.session;
      for (let i = 0; i < 3; i++) {
        const hit = await playUntil(kit, pol, 1800, async (s) => !!s.modal);
        if (!hit) {
          out.push('No event within 30 minutes.');
          continue;
        }
        const scr = await screenOf(kit);
        await kit.shot(`event-keys-${i + 1}`);
        const active = () => page.evaluate(() => (document.activeElement ? document.activeElement.id || document.activeElement.tagName : null));
        const f0 = await active();
        await page.keyboard.press('Tab');
        const f1x = await active();
        await page.keyboard.press('Tab');
        const f2 = await active();
        const box = await page.locator('#btn-task').boundingBox();
        const before = await kit.session.metrics();
        let mouse = 'not attempted';
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          const after = await kit.session.metrics();
          mouse = after.tasks > before.tasks ? `went through (tasks ${fmtN(before.tasks)} → ${fmtN(after.tasks)})` : 'blocked (tasks unchanged)';
        }
        const geo = await page.evaluate(() => {
          const ov = document.getElementById('modalOverlay');
          const md = document.getElementById('modal');
          const cs = getComputedStyle(ov);
          const r = md.getBoundingClientRect();
          const hit = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const q = el.getBoundingClientRect();
            return !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom);
          };
          return { overlay: { position: cs.position, pe: cs.pointerEvents }, modal: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, vw: window.innerWidth, vh: window.innerHeight, covers: { stores: hit('panel-stores'), funds: hit('row-funds'), infrastructure: hit('panel-infrastructure'), training: hit('panel-training'), projects: hit('panel-projects') } };
        });
        await page.keyboard.press('Escape');
        const afterEsc = await screenOf(kit);
        out.push(`**event ${i + 1} at ${mmss(kit.t)}: "${scr.modal.title}"** ${scr.modal.timer ? `[${scr.modal.timer}]` : '(no timer)'} — options ${scr.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (greyed)' : ''}`).join(' / ')}`, `- focus when it opened: ${f0}; Tab, Tab → ${f1x}, then ${f2}; real mouse click on Complete Task behind it: ${mouse}; overlay ${JSON.stringify(geo.overlay)}; box ${geo.modal.w}×${geo.modal.h} at (${geo.modal.x}, ${geo.modal.y}) in ${geo.vw}×${geo.vh}; it overlaps: ${Object.entries(geo.covers).filter(([, v]) => v).map(([k]) => k).join(', ') || 'no panel'}.`, `- Escape: ${afterEsc.modal ? 'the event stays open' : 'the event closed'}; console ${(await consoleNow(kit)).slice(-2).map((c) => `"${c}"`).join(' / ')}.`, '');
        if (afterEsc.modal) await play(kit, pol, 4);
      }
    },
  },
  exit: {
    title: 'The Stage 2 → 3 change, held: the gate card is left un-clicked for 30 s once it is ready, then clicked',
    async run(kit, out) {
      const gateRe = /Let Sage-3 write the code/;
      const hold = ft2(kit, { veto: vetoProjects(gateRe) });
      let firstSeen = null;
      const hit = await playUntil(kit, hold, 4800, async (s, t, scr) => {
        const b = s.buttons.find((x) => gateRe.test(x.l));
        if (b && !firstSeen) firstSeen = { t, card: scr.cards.find((c) => gateRe.test(c.text)), cap: scr.live.capability, nextTier: scr.notes.nextTier };
        return !!(b && b.e);
      });
      if (!hit) return void out.push('The gate card never became ready within 80 minutes.');
      const key = hit.buttons.find((b) => gateRe.test(b.l)).k;
      const a = await screenOf(kit);
      await kit.shot('exit-ready');
      const card = a.cards.find((c) => gateRe.test(c.text));
      const meters = (s) => `capability ${s.live.capability}×, government "${s.notes.gov ?? '—'}" ${s.notes.govNote ?? ''}, "${s.notes.approval ?? '—'}" ${s.notes.approvalNote ?? ''}, "${s.notes.leadLine ?? '—'}", alignment shown ${s.notes.statAlignment ?? '—'}, security "${s.notes.security ?? '—'}", billing "${s.live.billing}"`;
      out.push(`Gate card first on screen at ${mmss(firstSeen.t)} (model at ${firstSeen.cap}×, "${firstSeen.nextTier}"): "${firstSeen.card.text}" [classes: ${firstSeen.card.cls || '—'}; tooltip: "${firstSeen.card.title}"].`, `Ready at ${mmss(kit.t)}: "${card.text}" [classes: ${card.cls || '—'}]. ${meters(a)}; rev ${money(a.st.rev)}/s; numbers on screen ${hit.numbers}, buttons ${hit.buttons.length}, panels ${hit.panels.map((p) => p.l).join(', ')}.`, `Console: ${(await consoleNow(kit)).map((c) => `"${c}"`).join(' / ')}`, '');
      const t0 = kit.t;
      await play(kit, hold, 30);
      out.push('30 s with the card ready and not clicked (everything else played as usual):', ...kit.linesBetween(t0, kit.t, ['console', 'log']).map((l) => `- ${l}`), '');
      const b = await screenOf(kit);
      const sb = await kit.snap();
      const before = await stateJson(kit);
      await kit.click(key, 1, 'gate');
      const after = await stateJson(kit);
      const t1 = kit.t;
      out.push(`Clicked at ${mmss(t1)}. State keys changed by the click itself: ${stateDiff(before, after).filter((d) => !/^(consoleQueue|console|log|flags|projects|stats|revealed|cadence|rng|seed)/.test(d)).slice(0, 40).join('; ')}`, '');
      await kit.session.advance(4000);
      await kit.shot('exit-plus4s');
      kit.t += 4;
      const end = await kit.run(26);
      await kit.shot('exit-plus30s');
      const c = await screenOf(kit);
      out.push('Next 30 s (nothing clicked):', ...kit.linesBetween(t1, kit.t, ['console', 'log']).map((l) => `- ${l}`), '', `Before: ${meters(b)}; numbers ${sb.numbers}, buttons ${sb.buttons.length}, panels ${sb.panels.length}.`, `After 30 s: ${meters(c)}; rev ${money(c.st.rev)}/s; numbers ${end.numbers}, buttons ${end.buttons.length}, panels ${end.panels.map((p) => p.l).join(', ')}.`, '', 'On screen after 30 s:', ...kit.screen(end, { lines: 6 }).map((l) => `- ${l}`), '', `Cards on screen after: ${c.cards.map((x) => `"${x.text}"`).join(' | ') || 'none'}`, '', 'Visible text of every panel after 30 s:', ...(await kit.session.page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => p.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) && p.id !== 'panel-log' && p.id !== 'consoleDiv').map((p) => `- ${p.id}: ${p.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim()}`))));
    },
  },
  hover: {
    title: 'At 20:10: what the Stores rows show on hover, and every tooltip a newcomer can only reach by hovering',
    async run(kit, out) {
      const pol = ft2(kit);
      await play(kit, pol, 1210);
      const { page } = kit.session;
      for (const sel of ['#row-funds', '#row-research', '#row-insight', '#row-trust', '#row-gpus', '#row-power', '#row-copies', '#row-data', '#row-chips']) {
        const el = page.locator(sel).first();
        if (!(await el.count()) || !(await el.isVisible())) continue;
        await el.hover({ force: true }).catch(() => {});
        await new Promise((r) => setTimeout(r, 100));
        const tip = await page.evaluate(() => {
          window.__game.render();
          const t = document.getElementById('storeTip');
          return t && t.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? t.innerText.replace(/\s*\n\s*/g, ' / ') : null;
        });
        const row = await page.evaluate((x) => document.querySelector(x).innerText.replace(/\s+/g, ' ').trim(), sel);
        out.push(`- row "${row}" → hover: "${tip ?? '(nothing)'}"`);
        if (sel === '#row-gpus') await page.screenshot({ path: `${kit.prefix}-gpus.png`, fullPage: false });
      }
      await page.mouse.move(2, 2);
      const titles = await page.evaluate(() => {
        const vis = (el) => el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
        return [...document.querySelectorAll('[title]')].filter((el) => vis(el) && !el.closest('#dev') && el.title).map((el) => `- ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.innerText || '').replace(/\s+/g, ' ').slice(0, 60)}" → "${el.title.replace(/\n/g, ' / ')}"`);
      });
      out.push('', 'Tooltips (title attributes) on what is visible:', ...titles);
    },
  },
  'slider-ends': {
    title: 'The allocation slider at each end: what the screen shows 30 s later',
    async run(kit, out) {
      const pol = ft2(kit);
      const hit = await playUntil(kit, pol, 1500, async () => (await sliders({ session: kit.session })).length > 0);
      if (!hit) return void out.push('No slider within 25 minutes.');
      await play(kit, pol, 20);
      const read = async () => {
        const scr = await screenOf(kit);
        const tip = await kit.session.page.evaluate(() => ({ sliderTitle: document.getElementById('allocSlider').title, blockTitle: document.getElementById('allocBlock').title, block: document.getElementById('allocBlock').innerText.replace(/\s+/g, ' ').trim() }));
        return { scr, tip };
      };
      const measure = async (label) => {
        const a = await read();
        await kit.run(30);
        const b = await read();
        out.push(`- **${label}** (${mmss(kit.t - 30)} → ${mmss(kit.t)}): the block reads "${b.tip.block}"; research ${fmtN(a.scr.st.research)} → ${fmtN(b.scr.st.research)} (${fmtN((b.scr.st.research - a.scr.st.research) / 30)}/s while not at the cap); tasks/s ${fmtN(b.scr.st.rate)}; rev ${money(b.scr.st.rev)}/s; stores "${b.scr.live.stores}".`);
        return b;
      };
      const first = await read();
      out.push(`Slider first on screen at about ${mmss(kit.t - 20)}; tooltips: slider "${first.tip.sliderTitle}", block "${first.tip.blockTitle}". Nothing else is clicked during the measurement.`, '');
      await measure('as found');
      for (const end of ['min', 'max']) {
        const sl = (await sliders({ session: kit.session }))[0];
        await kit.session.setValue(sl.sel, end === 'min' ? sl.min : sl.max);
        await measure(`dragged to ${end} (${end === 'min' ? sl.min : sl.max})`);
        await kit.shot(`slider-${end}`);
      }
    },
  },
  'mobile-shots': {
    title: '390 × 844 viewport through Stage 2: what is above the fold, how far the page scrolls, whether events fit',
    viewport: MOBILE,
    async run(kit, out) {
      const pol = ft2(kit);
      const { page } = kit.session;
      const where = () =>
        page.evaluate(() => {
          const vis = (el) => el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const ids = ['consoleDiv', 'panel-log', 'btn-task', 'panel-stores', 'panel-business', 'panel-infrastructure', 'panel-research', 'panel-projects', 'panel-training', 'panel-graph', 'panel-security', 'panel-government', 'panel-public', 'panel-stats', 'btn-train', 'allocSlider', 'btn-standing'];
          const o = {};
          for (const id of ids) {
            const el = document.getElementById(id);
            if (vis(el)) o[id] = Math.round(el.getBoundingClientRect().top + window.scrollY);
          }
          const btns = [...document.querySelectorAll('button')].filter((b) => vis(b) && !b.closest('#dev')).map((b) => ({ id: b.id, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
          const g = document.getElementById('graphCanvas');
          return { o, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, buttons: btns.length, tiny: btns.filter((b) => b.h < 32).length, min: btns.reduce((a, b) => (a && a.h <= b.h ? a : b), null), graph: vis(g) ? Math.round(g.getBoundingClientRect().width) : null, font: getComputedStyle(document.body).fontSize };
        });
      let modalShot = 0;
      let maxOver = 0;
      for (const mark of [2, 300, 600, 1200, 1800, 2280]) {
        await kit.run(mark - kit.t, async (t, s) => {
          if (s.m.stage > 2) return 'stop';
          SCREEN = await screenOf(kit);
          maxOver = Math.max(maxOver, SCREEN.overflowX);
          if (s.modal && modalShot < 4) {
            modalShot++;
            await page.screenshot({ path: `${kit.prefix}-modal${modalShot}.png`, fullPage: false });
            const mb = await page.evaluate(() => {
              const r = document.getElementById('modal').getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), vw: window.innerWidth, vh: window.innerHeight };
            });
            out.push(`- event at ${mmss(t)} "${s.modal.title}": box ${mb.w}×${mb.h} at (${mb.left}, ${mb.top}) in a ${mb.vw}×${mb.vh} viewport${mb.h > mb.vh ? ' — TALLER THAN THE VIEWPORT' : ''}.`);
          }
          await pol.pass(t);
          return undefined;
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${kit.prefix}-t${mark}-fold.png`, fullPage: false });
        await page.screenshot({ path: `${kit.prefix}-t${mark}-full.png`, fullPage: true });
        const w = await where();
        out.push(`**${mmss(mark)}** — page ${w.w}×${w.h} px (${(w.h / 844).toFixed(1)} screens; horizontal overflow ${w.w - w.cw} px); body font ${w.font}; ${w.buttons} buttons, ${w.tiny} under 32 px tall (smallest ${w.min ? `${w.min.id} ${w.min.w}×${w.min.h}` : '—'}); graph ${w.graph ?? '—'} px wide.`, `- top offsets (px): ${Object.entries(w.o).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      }
      out.push('', `Largest horizontal overflow seen: ${maxOver} px.`);
    },
  },
  screens: {
    title: 'The visible text of every panel at the five-minute marks of the first-timer (and every tooltip at 20:00)',
    async run(kit, out, flags) {
      const pol = ft2(kit);
      const marks = flags.at ? String(flags.at).split(',').map(Number) : [2, 300, 600, 900, 1200, 1500, 1800, 2100];
      for (const mark of marks) {
        const s = await play(kit, pol, mark - kit.t);
        if (s.m.stage > 2) break;
        const panels = await kit.session.page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => p.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })).map((p) => `- **${p.id}**: ${p.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim()}`));
        const snap = await kit.snap();
        const grey = snap.buttons.filter((b) => !b.e && b.kind !== 'modal');
        out.push(`## ${mmss(kit.t)} — ${snap.numbers} numbers, ${snap.buttons.length + snap.sliders.length} controls (${grey.length} greyed), ${snap.panels.length} panels, ${(await screenOf(kit)).words} words`, '', ...panels, '', `Greyed: ${grey.map((b) => `${b.l}${b.why ? ` [${b.why}]` : ''}`).join('; ')}`, `Enabled: ${snap.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l).join('; ')}`, '');
        await kit.shot(`screens-t${mark}`);
      }
    },
  },
};

async function runProbe(name, flags) {
  const pr = PROBES[name];
  const prefix = resolvePrefix(labelFor(name, flags));
  const gameDir = resolveGameDir(base, flags.gameDir);
  const out = [];
  let kit;
  try {
    kit = await openProbe(base, { gameDir, seed: Number(flags.seed ?? 1), prefix, viewport: pr.viewport, stage: 2 });
    kit.gameDir = gameDir;
    kit.seed = Number(flags.seed ?? 1);
    await pr.run(kit, out, flags);
    console.log(`${name}: ok`);
  } catch (e) {
    out.push(`probe failed: ${String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`);
    console.log(`${name}: FAILED ${e.message}`);
  } finally {
    if (kit) {
      if (kit.session.errors.length) out.push('', `Page errors: ${kit.session.errors.slice(0, 5).join(' | ')}`);
      await kit.close();
    }
  }
  fs.writeFileSync(`${prefix}.md`, [`# Stage 2 round-2 probe: ${name} — ${pr.title}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, Stage 2 start (preset 2), seed ${flags.seed ?? 1}, stepped. Times are game time from the stage start.`, '', ...out, ''].join('\n'));
}

// ----------------------------------------------------------------------------------------- TABLE
function table(flags, names) {
  const tag = flags.tag ?? TAG;
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(`${tag}-`) && f.endsWith('.end.json'));
  const ends = files.map((f) => readJson(path.join(OUT_DIR, f))).filter((e) => e.hands);
  const by = new Map();
  for (const e of ends) {
    if (names && !names.includes(e.name)) continue;
    if (!by.has(e.name)) by.set(e.name, []);
    by.get(e.name).push(e);
  }
  const order = Object.keys(RUNS).filter((n) => by.has(n));
  const col = (list, f) => list.sort((a, b) => a.seed - b.seed).map(f).join(' / ');
  const rows = order.map((n) => {
    const l = by.get(n);
    return [n, l.map((e) => e.seed).sort().join(','), col(l, (e) => (e.stageEnd != null ? mmss(e.stageEnd) : `>${mmss(e.endT)}`)), col(l, (e) => fmtN(e.st.capability, 2)), col(l, (e) => `${fmtN(e.st.alignA, 0)}·${fmtN(e.st.alignT, 0)}`), col(l, (e) => fmtN(e.st.gov, 0)), col(l, (e) => fmtN(e.st.approval, 0)), col(l, (e) => fmtN(e.st.lead, 1)), col(l, (e) => fmtN(e.st.gpus)), col(l, (e) => money(e.st.rev)), col(l, (e) => `SL${e.st.sl}`), col(l, (e) => `${e.st.trainings}/${e.st.releases}/${e.st.incidents}`), col(l, (e) => f1(e.hands.stage.nonePct)), col(l, (e) => f1(e.hands.stage.twoPct)), col(l, (e) => f1(e.hands.stage.perMin)), col(l, (e) => (e.hands.after10 ? f1(e.hands.after10.gap30Pct) : '—')), col(l, (e) => mmss(e.releaseIntervals.longest))];
  });
  const md = mdTable(['play style', 'seeds', 'Stage 2 ends', 'capability ×', 'alignment shown·true', 'government', 'approval', 'lead (months)', 'GPUs', 'rev/s', 'security', 'runs/releases/incidents (lifetime)', 'nothing enabled %', 'two or more %', 'clicks/min', '≥ 30-s gaps after 10:00 %', 'longest release interval'], rows);
  console.log(md);
  fs.writeFileSync(path.join(OUT_DIR, `${tag}-table.md`), `${md}\n`);
}

// ----------------------------------------------------------------------------------------- HANDS
function handsCmd(labels, flags) {
  const rows = [];
  for (const label of labels) {
    const run = loadRun(resolvePrefix(label));
    const endT = run.meta.stageEnd ?? run.meta.endT;
    const windows = [['stage', {}], ['first 10 min', { to: Math.min(600, endT) }]];
    if (endT > 600) windows.push(['after 10:00', { from: 600 }]);
    if (flags.from != null) windows.push([`after ${mmss(Number(flags.from))}`, { from: Number(flags.from) }]);
    for (const [name, w] of windows) {
      const h = handsOf(run, w);
      rows.push([label, `${name} (${mmss(h.from)}–${mmss(h.end)})`, h.checks, f1(h.nonePct), f1(h.twoPct), h.medianThings, h.clicks, f1(h.perMin), f1(h.gap30Pct), h.gaps30, h.longestGap]);
      if (name === 'stage') {
        console.log(`${label}: enabled share — ${Object.entries(h.enabledShare).slice(0, 14).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`);
        console.log(`${label}: sole enabled thing — ${Object.entries(h.soleShare).slice(0, 8).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`);
        console.log(`${label}: clicks by kind — ${Object.entries(h.clicksBy).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
      }
    }
  }
  console.log(mdTable(['run', 'window', 'checks', 'nothing enabled %', 'two or more %', 'median things', 'clicks', 'clicks/min', 'inside ≥ 30-s gaps %', 'gaps ≥ 30 s', 'longest gap s'], rows));
}

const { pos, flags } = parseArgs(process.argv.slice(2), ['modalShots', 'modal-shots']);
const which = pos[0];
if (!which || which === 'list') {
  console.log('runs:   ' + Object.keys(RUNS).join(', '));
  console.log('probes: ' + Object.keys(PROBES).join(', '));
  console.log('other:  hands <label…> [--from SEC] · table [--tag T] [name,…]');
  process.exit(which ? 0 : 2);
}
if (which === 'table') {
  table(flags, pos[1] ? pos[1].split(',') : null);
  process.exit(0);
}
if (which === 'hands') {
  handsCmd(pos.slice(1), flags);
  process.exit(0);
}
const names = which === 'all-runs' ? Object.keys(RUNS) : which === 'all-probes' ? Object.keys(PROBES) : which.split(',');
const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [Number(flags.seed ?? 1)];
for (const n of names) {
  if (RUNS[n]) for (const sd of seeds) await runScenario(n, flags, sd);
  else if (PROBES[n]) await runProbe(n, flags);
  else console.error(`unknown scenario "${n}"`);
}
void loadFixture;
