#!/usr/bin/env node
// Stage 1 critic round 3 (build s12-r4): the play styles, probes and tables explore.mjs lacks for the
// redesigned stage (one-mechanic-at-a-time opening, hard GPU gate on Train, meters, one First Datacenter).
// explore.mjs and every shared library are unchanged; this file only imports the libraries.
//
// Usage (repo root):
//   node tools/critic/explore-s1r3.mjs list
//   node tools/critic/explore-s1r3.mjs <run[,run…]|all-runs> --game-dir DIR [--seed N | --seeds 1,2,3] [--minutes MIN] [--tag T] [--modal-shots] [--gate-shots]
//   node tools/critic/explore-s1r3.mjs <probe[,probe…]|all-probes> --game-dir DIR [--seed N] [--tag T]
//   node tools/critic/explore-s1r3.mjs table [name…] [--tag T] [--seeds 1,2,3] [--out LABEL]
//   node tools/critic/explore-s1r3.mjs gate <label> [<label> …]
//   node tools/critic/explore-s1r3.mjs gate-table <name> [<name> …] [--tag T] [--seeds 1,2,3,4,5]
//   node tools/critic/explore-s1r3.mjs measures <label> [<label> …]     (any run of this harness)
//   node tools/critic/explore-s1r3.mjs hands <label> [<label> …]        (any scripted-policy run)
//   node tools/critic/explore-s1r3.mjs says <name> [<name> …] [--tag T]
//
// RUNS    Takeoff Stage 1 played by the scripted first-timer with ONE thing changed. Output is a normal run
//         (<tag>-<name>[-seedN].snaps/.events/.actions.json — analyze.mjs, compare.mjs, decisions.mjs work on
//         it) plus <label>.explore.md (one row per minute, every modal with its full on-screen text, the
//         on-screen notes each time they change, every console and Developments line), <label>.gate.json
//         (the Train row, the Rent GPU row and the datacenter card at every 2-s check), <label>.end.json
//         (exit state and the last Stage 1 screen) and <label>.modals.json.
// PROBES  short scripted situations, each writing <tag>-<name>.md and screenshots.
// TABLE   stage end and exit state per play style and seed, from the .end.json files.
// GATE    "training under the hard gate" for any run of this file: how long Train was ready / running /
//         blocked and by what, every distinct text the row showed, whether the fix was on screen.
// GATE-TABLE  one row per run: seconds Train was unpressable with nothing training (by cause), the longest
//         such stretch, when the row first asked for GPUs, when the wall was first on the row, wall → stage end.
// MEASURES  from a run's .snaps/.events files: greyed-goal holes, seconds the power meter is red (power under
//         20 % of the fleet's block) and of those with Buy Power selling a smaller block, text per minute,
//         the densest six minutes of reveals, seconds the Projects panel is empty, enabled-purchase shares.
// HANDS   what the first-timer's hands and money do: research pinned at the first cap, run starts, when the
//         datacenter card appears and the funds then, funds as a share of $250,000 over time, the last GPU
//         rental / Marketing purchase / price move / Buy Power press, funds-priced purchases after 12:00.
// SAYS    what the screen says for a play style: the most repeated console lines and the last Stage 1 screen.
//
// Default tag: s1r3x. Labels: <tag>-<name>[-seedN].
import fs from 'node:fs';
import path from 'node:path';
import { runGame, resolveGameDir } from './lib/runner.mjs';
import { openProbe } from './lib/probe.mjs';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN, readJson } from './lib/util.mjs';

const money = (v) => (v == null || !Number.isFinite(v) ? '—' : `$${fmtN(v, Math.abs(v) < 100 ? 2 : 0)}`);
const base = await loadAdapter('takeoff');
const pc = await loadAdapter('paperclips');
const variant = (over) => ({ ...base, policy: { ...base.policy, ...over } });
const baseVeto = (c) => (base.policy.veto ? base.policy.veto(c) : []);
/** Never buys a project whose card matches `re`. */
const vetoCards = (re) => (c) => [...baseVeto(c), ...c.buttons.filter((b) => b.kind === 'project' && re.test(b.l)).map((b) => b.k)];
const MOBILE = { width: 390, height: 844 };
const labelFor = (name, flags, seed) => `${flags.tag ?? 's1r3x'}-${name}${seed && Number(seed) !== 1 ? `-seed${seed}` : ''}`;
const seedsOf = (flags) => (flags.seeds ? String(flags.seeds).split(',').map(Number) : [Number(flags.seed ?? 1)]);

/** In page: everything a player can read that the 2-s snapshot does not keep, plus a few state fields. */
const READ = () => {
  const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  const txt = (id) => {
    const el = document.getElementById(id);
    return vis(el) ? el.innerText.replace(/\s+/g, ' ').trim() : null;
  };
  const raw = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null;
  };
  const btn = (id) => {
    const el = document.getElementById(id);
    return vis(el) ? { e: el.disabled ? 0 : 1, l: el.innerText.replace(/\s+/g, ' ').trim(), title: el.title || '' } : null;
  };
  const cls = (id) => {
    const el = document.getElementById(id);
    return vis(el) ? `${el.className}${el.title ? ` · title "${el.title}"` : ''}` : null;
  };
  const W = /[A-Za-z][A-Za-z'’-]*/g;
  let excl = '';
  for (const sel of ['#dev', '#toast']) {
    const el = document.querySelector(sel);
    if (vis(el)) excl += ' ' + el.innerText;
  }
  const body = document.body.innerText || '';
  const words = (body.match(W) || []).length - (excl.match(W) || []).length;
  const ov = document.getElementById('modalOverlay');
  const g = window.__game;
  const s = g && g.state;
  const bought = (id) => (s && s.projects[id] && s.projects[id].bought) || 0;
  const dc = document.getElementById('proj-p_datacenter');
  const cards = [...document.querySelectorAll('#projectList .projectButton')].filter(vis);
  return {
    words,
    notes: {
      billing: txt('billingLine'),
      billing2: txt('billingLine2'),
      priceHint: txt('priceHint'),
      hype: txt('hypeLine'),
      gpuNote: txt('gpuNote'),
      powerNote: txt('powerNote'),
      gridStatus: txt('gridStatus'),
      copiesRow: txt('copiesRow'),
      insightNote: txt('insightNote'),
      trustNote: txt('trustCostNote'),
      nextTrust: txt('nextTrust'),
      focusNote: txt('focusNote'),
      rival: txt('rivalLine'),
      contractRate: txt('contractRate'),
      revPerSec: txt('revPerSec'),
      unbilled: txt('unbilledLine'),
    },
    train: { btn: btn('btn-train'), cost: txt('trainCost'), gpus: txt('trainGpus'), meter: txt('trainGpuMeter'), reason: txt('trainReason'), runLine: txt('runLine'), panel: vis(document.getElementById('panel-training')) ? 1 : 0 },
    rent: { btn: btn('btn-gpu'), cost: txt('gpuCost'), note: txt('gpuNote'), meter: txt('quotaMeter'), shown: txt('gpus'), quota: raw('gpuQuota') },
    power: { meter: txt('powerMeter'), kwh: txt('power'), note: txt('powerNote'), btn: btn('btn-buyPower'), cost: txt('powerCost'), block: raw('powerBlock'), warn: cls('powerMeter') },
    meterCls: { power: cls('powerMeter'), research: cls('researchMeter'), quota: cls('quotaMeter'), train: cls('trainGpuMeter') },
    researchRow: { meter: txt('researchMeter'), research: txt('research'), cap: raw('researchCap') },
    dc: vis(dc) ? { e: dc.disabled ? 0 : 1, l: dc.innerText.replace(/\s*\n\s*/g, ' / ').trim(), cls: dc.className } : null,
    cards: cards.length,
    cardsEnabled: cards.filter((b) => !b.disabled).length,
    modal: vis(ov)
      ? {
          title: txt('modalTitle'),
          text: txt('modalText'),
          timer: txt('modalTimer'),
          options: [...document.querySelectorAll('#modalButtons button')].map((b) => ({ id: b.id, label: b.innerText.replace(/\s*\n\s*/g, ' — ').replace(/\s+/g, ' ').trim(), title: b.title || '', disabled: b.disabled })),
        }
      : null,
    st: s
      ? {
          contracts: bought('p_contract'),
          dynPricing: s.autoPrice ? 1 : 0,
          capability: s.capability,
          rival: s.rivalCapability,
          alignA: s.alignmentApparent,
          alignT: s.alignmentTrue,
          demandMult: s.demandMult,
          clicks: (s.flags && s.flags.clicks) || 0,
          focus: s.training && s.training.focus,
          runGpus: s.training && s.training.run ? s.training.run.gpus : null,
          copyBoost: s.copyBoost,
          copiesPerGPU: s.copiesPerGPU,
        }
      : {},
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
  };
};

/** The whole visible page as text lines (dev overlay and toast removed). */
const PAGE_TEXT = () => {
  let t = document.body.innerText || '';
  for (const sel of ['#dev', '#toast']) {
    const el = document.querySelector(sel);
    if (el && el.innerText) t = t.replace(el.innerText, '');
  }
  return t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

// ------------------------------------------------------------------------------------------ RUNS
function focusSpecial(key) {
  return async function special(ctx) {
    let c = await base.policy.special(ctx);
    if (c.buttons.some((b) => b.k === key && b.e) && !ctx.noop.has(key)) c = await ctx.click(key, 'focus', key);
    return c;
  };
}
const releaseAtOnce = {
  /** Release the moment the button works, whatever is open; never red-team. */
  async special(ctx) {
    let c = ctx.controls;
    if (c.m.trainingPhase !== 'redteam') return c;
    const rel = c.buttons.find((b) => b.k === 'btn-release');
    if (rel && rel.e && !ctx.noop.has('btn-release')) c = await ctx.click('btn-release', 'release-open', `${c.m.issuesOpen} open issues`);
    return c;
  },
  /** The open-issues confirm: pick the option that ships. Every other modal: first option. */
  modalChoice(modal, enabled) {
    const ship = enabled.find((o) => /release|ship/i.test(o.l) && !/red|wait|hold|back|not|keep/i.test(o.l));
    return ship || enabled[0];
  },
};
/** modalChoice: the first enabled option whose label matches one of `wanted`; `wait` leaves the modal open while a wanted option exists but is greyed (the timer decides if it never becomes affordable). */
function byLabel(wantedSpec, wait = false) {
  return (modal, enabled) => {
    const wanted = wantedSpec.map((w) => (typeof w === 'function' ? w() : w));
    const hit = enabled.find((o) => wanted.some((re) => re.test(o.l)));
    if (hit) return hit;
    if (wait && modal.options.some((o) => !o.e && wanted.some((re) => re.test(o.l)))) return null;
    return enabled[0];
  };
}
/** modalChoice: the option matching `optRe` for the modal whose title matches `titleRe` (when enabled); the first enabled option otherwise. */
function only(titleRe, optRe) {
  return (modal, enabled) => (titleRe.test(modal.title) ? enabled.find((o) => optRe.test(o.l)) || enabled[0] : enabled[0]);
}
/** What the Training panel says about the rival right now (kept by the run's onSnapshot; the leaderboard answers read it). */
const screenNow = { ahead: false };
/** Presses Train whenever it is enabled, before anything else is bought. */
async function trainFirstSpecial(ctx) {
  const tr = ctx.controls.buttons.find((b) => b.k === 'btn-train');
  if (tr && tr.e && !ctx.noop.has('btn-train')) await ctx.click('btn-train', 'train', 'Train is enabled');
  return base.policy.special(ctx);
}

const RUNS = {
  baseline: { title: 'The unmodified first-timer policy (control): first option of every modal', adapter: base },
  // --- modals ---
  'modal-last': { title: 'Answers every modal with its last enabled option', adapter: variant({ modalChoice: (modal, enabled) => enabled[enabled.length - 1] }) },
  'modal-ignore': { title: 'Never answers a modal (every one runs out its timer)', adapter: variant({ modalChoice: () => null }) },
  'modal-worst': {
    title: 'Picks the worst-looking option of every modal, judged from the effect line printed on the button (lose Trust, smaller contracts, lose researchers, a demand hit, the gamble, ship with open issues; the leaderboard: submit when behind, decline when ahead)',
    adapter: variant({ modalChoice: byLabel([/take the bridge/, /cut the price/, /no comment/, /publish a rebuttal/, /let them go/, () => (screenNow.ahead ? /decline/ : /submit Sage/), /let her try/, /release anyway/]) }),
  },
  'modal-best': {
    title: 'Picks the best-looking option of every modal (Trust and permanent demand, keep the researchers, no gamble; the leaderboard: submit when ahead, decline when behind); waits for a greyed option to become affordable',
    adapter: variant({ modalChoice: byLabel([/wait for a real round/, /open-source/, /publish the system card/, /sign it/, /match the offer|offer equity/, () => (screenNow.ahead ? /submit Sage/ : /decline/), /not now/, /keep fixing/], true) }),
  },
  // --- one modal answered differently, every other one with its first option (what each framed choice weighs) ---
  'm-bridge-wait': { title: 'A Bridge Round → wait for a real round (every other modal: first option)', adapter: variant({ modalChoice: only(/Bridge/, /wait for a real round/) }) },
  'm-weights-cut': { title: 'Open Weights → cut the price', adapter: variant({ modalChoice: only(/Open Weights/, /cut the price/) }) },
  'm-weights-nothing': { title: 'Open Weights → say nothing', adapter: variant({ modalChoice: only(/Open Weights/, /say nothing/) }) },
  'm-reporter-nocomment': { title: 'A Reporter Calls → no comment', adapter: variant({ modalChoice: only(/Reporter/, /no comment/) }) },
  'm-letter-rebuttal': { title: 'An Open Letter → publish a rebuttal', adapter: variant({ modalChoice: only(/Open Letter/, /publish a rebuttal/) }) },
  'm-letter-nothing': { title: 'An Open Letter → say nothing', adapter: variant({ modalChoice: only(/Open Letter/, /say nothing/) }) },
  'm-offer-letgo': { title: 'A Better Offer → let them go', adapter: variant({ modalChoice: only(/Better Offer/, /let them go/) }) },
  'm-board-decline': { title: 'The Leaderboard Wants Sage → decline', adapter: variant({ modalChoice: only(/Leaderboard/, /decline/) }) },
  'm-try-no': { title: 'Can I try something? → not now (the first option, let her try, is taken by the control whenever it is affordable)', adapter: variant({ modalChoice: only(/Can I try/, /not now/) }) },
  // --- release, focus ---
  'ship-open': { title: 'Releases every model the moment Release works, open issues or not; never red-teams', adapter: variant(releaseAtOnce) },
  'focus-capability': { title: 'Always trains with Focus: Capability (pressed explicitly; it is also the default)', adapter: variant({ special: focusSpecial('btn-focus-capability') }) },
  'focus-efficiency': { title: 'Always trains with Focus: Efficiency', adapter: variant({ special: focusSpecial('btn-focus-efficiency') }) },
  'focus-safety': { title: 'Always trains with Focus: Safety', adapter: variant({ special: focusSpecial('btn-focus-safety') }) },
  // --- money ---
  greedy: { title: 'Rents GPUs and buys marketing whenever affordable, never saves for anything', adapter: variant({ drip: [], goal: [], goalRule: null }) },
  'no-price': { title: 'Never touches lower/raise (buys Dynamic pricing when it is offered)', adapter: variant({ lower: null, raise: null }) },
  'no-price-strict': { title: 'Never touches lower/raise AND never buys Dynamic pricing: $0.25 for the whole stage', adapter: variant({ lower: null, raise: null, veto: vetoCards(/Dynamic pricing/i) }) },
  'no-dynamic-pricing': { title: 'Never buys Dynamic pricing: prices by hand (backlog rule) to the end', adapter: variant({ veto: vetoCards(/Dynamic pricing/i) }) },
  'no-marketing': { title: 'Never buys Marketing', adapter: variant({ skip: [...base.policy.skip, 'btn-marketing'] }) },
  'power-late': {
    title: 'Never buys power until the meter reads 0 (buys the Grid Contract when offered, as any card)',
    adapter: variant({ consumable: null, skip: [...base.policy.skip, 'btn-buyPower'], special: powerLate }),
  },
  'power-late-nogrid': {
    title: 'Never buys power until the meter reads 0, and never buys the Grid Contract',
    adapter: variant({ consumable: null, skip: [...base.policy.skip, 'btn-buyPower'], special: powerLate, veto: vetoCards(/Grid Contract/i) }),
  },
  'no-contracts': { title: 'Never buys the repeatable Custom model contract', adapter: variant({ veto: vetoCards(/Custom model contract/i) }) },
  'no-side-offers': { title: 'Never buys a funds-priced card except First Datacenter', adapter: variant({ veto: (c) => [...baseVeto(c), ...c.buttons.filter((b) => b.kind === 'project' && /\$/.test(b.l) && !/First Datacenter/.test(b.l)).map((b) => b.k)] }) },
  'no-free-cards': { title: 'Never clicks a card marked (free): no Seed round, no Series A', adapter: variant({ veto: vetoCards(/\(free\)/i) }) },
  // --- training and GPUs ---
  'no-train': { title: 'Never trains a model', adapter: variant({ skip: [...base.policy.skip, 'btn-train'] }) },
  'train-first': { title: 'Presses Train whenever it is enabled, before anything else is bought', adapter: variant({ special: trainFirstSpecial }) },
  'train-first-greedy': { title: 'Presses Train whenever it is enabled AND rents whenever a GPU is affordable (never saves)', adapter: variant({ special: trainFirstSpecial, drip: [], goal: [], goalRule: null }) },
  'train-priority': {
    title: 'Puts the next run first: presses Train the moment it works; while the Train row says it is short of research buys no research-priced card, while it says money buys nothing funds-priced but power; rents a GPU whenever one is affordable otherwise (never saves for the datacenter)',
    adapter: variant({
      special: trainFirstSpecial,
      drip: [],
      goal: [],
      goalRule: null,
      veto: (c) => {
        const out = [...baseVeto(c)];
        const tr = c.buttons.find((b) => b.k === 'btn-train');
        if (tr && !tr.e) {
          const why = tr.why || '';
          const shortGpus = /Rent\s+[0-9,]+\s+more/i.test(tr.rowText || '');
          if (/research/.test(why)) out.push(...c.buttons.filter((b) => b.kind === 'project' && b.costs && b.costs.research).map((b) => b.k));
          if (/money|\$/.test(why)) out.push(...c.buttons.filter((b) => b.kind === 'project' && /\$/.test(b.l) && !/First Datacenter/.test(b.l)).map((b) => b.k), 'btn-marketing', ...(shortGpus ? [] : ['btn-gpu']));
        }
        return out;
      },
      rowText: true,
    }),
  },
  'autoplay-bot': { title: "The game's own Autoplay bot (policy 'bot')", adapter: base, autoplay: 'bot' },
  'autoplay-trainfirst': { title: "The game's own Autoplay with its 'trainfirst' policy", adapter: base, autoplay: 'trainfirst' },
  'autoplay-greedy': { title: "The game's own Autoplay with its 'greedy' policy", adapter: base, autoplay: 'greedy' },
  'autoplay-naive': { title: "The game's own Autoplay with its 'naive' policy", adapter: base, autoplay: 'naive' },
  'rent-10': { title: 'Never rents past what the first run needs: stops at 10 GPUs', adapter: variant({ veto: (c) => [...baseVeto(c), ...((c.m.gpus || 0) >= 10 ? ['btn-gpu'] : [])] }) },
  'rent-as-needed': {
    title: 'Rents freely until the Training panel shows; from then on rents only while the Train row says it is short of GPUs',
    adapter: variant({
      drip: ['btn-marketing'],
      veto: (c) => {
        const tr = c.buttons.find((b) => b.k === 'btn-train');
        const trainingSeen = !!tr || !!c.m.trainingPhase || (c.m.trainings || 0) > 0;
        if (!trainingSeen) return baseVeto(c);
        const short = tr && /Rent\s+[0-9,]+\s+more/i.test(tr.rowText || '');
        return [...baseVeto(c), ...(short ? [] : ['btn-gpu'])];
      },
      rowText: true,
    }),
  },
  'rent-stop-at-training': {
    title: 'Stops renting for good the moment the Training panel appears (so a later run is blocked by GPUs)',
    adapter: variant({
      veto: (c) => {
        const seen = c.buttons.some((b) => b.k === 'btn-train') || !!c.m.trainingPhase || (c.m.trainings || 0) > 0;
        return [...baseVeto(c), ...(seen ? ['btn-gpu'] : [])];
      },
    }),
  },
  // --- Trust ---
  'hire-only': { title: 'Spends every Trust on Hire Researcher, never Expand Lab', adapter: variant({ skip: [...base.policy.skip, 'btn-expandLab'] }) },
  'expand-only': { title: 'Spends every Trust on Expand Lab, never Hire Researcher (after the opening hires, if the game forces them)', adapter: variant({ skip: [...base.policy.skip, 'btn-hireResearcher'] }) },
  'no-research': { title: 'Never clicks Hire Researcher or Expand Lab (Trust is never spent on them)', adapter: variant({ skip: [...base.policy.skip, 'btn-hireResearcher', 'btn-expandLab'] }) },
  // --- hands ---
  'click-fast': { title: 'Clicks Complete Task 10 times a second through the opening (until the copies make 8 tasks/s)', adapter: base, clickRate: 10 },
  'click-slow': { title: 'Clicks Complete Task once every two seconds through the opening (until the copies make 8 tasks/s)', adapter: base, clickRate: 0.5 },
  'click-steady': { title: 'Clicks Complete Task 1.5 times a second through the opening (until the copies make 8 tasks/s)', adapter: base, clickRate: 1.5 },
  'click-only': { title: 'Never rents a GPU: the manual button only', adapter: variant({ automation: [], skip: [...base.policy.skip, 'btn-gpu'] }) },
  'no-projects': { title: 'Never buys a project card (buttons only)', adapter: { ...base, policy: { ...base.policy, goal: [], goalRule: null, veto: (c) => c.buttons.filter((b) => b.kind === 'project').map((b) => b.k) } } },
  mobile: { title: 'The unmodified policy at a 390 × 844 viewport', adapter: base, viewport: MOBILE },
  'reload-every-minute': { title: 'The unmodified policy; the page is reloaded every 60 s of game time (the game\'s own save / load)', adapter: base, reloadEvery: 60 },
  'reload-every-14s': { title: 'The unmodified policy; the page is reloaded every 14 s of game time', adapter: base, reloadEvery: 14 },
};

/** Buy Power only when the meter reads 0 (and the button works). */
async function powerLate(ctx) {
  let c = await base.policy.special(ctx);
  const bp = c.buttons.find((b) => b.k === 'btn-buyPower');
  if (bp && bp.e && (c.m.power ?? 1) < 1 && !ctx.noop.has('btn-buyPower')) c = await ctx.click('btn-buyPower', 'consumable', 'power ran out');
  return c;
}

/** Metrics with autoRate for a hand clicking at `rate`/s, so "mash until the copies make 8/s" holds at any click rate. */
const metricsAt = (rate) => new Function(`const m = (${base.metrics.toString()})(); if (m && m.ready) m.autoRate = Math.max(0, (m.rate || 0) - Math.min(${rate}, (window.__game.state.stats.clicksPerSec != null ? window.__game.state.stats.clicksPerSec : ${rate}))); return m;`);
/** In page: replaces the phase-2 click loop with one that clicks `rate` times a second (50-ms ticks). */
const installClickRate = (rate) => {
  window.__clickAcc = 0;
  const lib = window.__critic;
  lib.mashAdvance = (key, n, stepMs) => {
    let clicks = 0;
    const total = n * stepMs;
    for (let e = 0; e < total; e += 50) {
      if (key) {
        window.__clickAcc += (50 * rate) / 1000;
        while (window.__clickAcc >= 1 - 1e-9) {
          window.__clickAcc -= 1;
          const el = lib.find(key);
          if (el && !el.disabled) {
            el.click();
            clicks++;
          }
        }
      }
      window.__game.tick(50);
    }
    return clicks;
  };
};

async function runVariant(name, flags, seed) {
  const sc = RUNS[name];
  const label = labelFor(name, flags, seed);
  const prefix = resolvePrefix(label);
  const lines = [];
  const modals = [];
  const noteLog = [];
  const minutes = [];
  const gate = [];
  const lastNote = {};
  let lastModalKey = null;
  let nShots = 0;
  let maxOverflow = 0;
  let lastS1 = null;
  let arrival = null;
  let reloads = 0;
  const gateShots = new Set();
  const QUIET_NOTES = new Set(['billing', 'billing2', 'contractRate', 'revPerSec', 'unbilled', 'nextTrust', 'copiesRow']);
  let adapter = sc.adapter;
  if (sc.clickRate) adapter = { ...adapter, metrics: metricsAt(sc.clickRate) };
  if (sc.autoplay) {
    const pol = sc.autoplay;
    adapter = { ...adapter, setAutoplay: async (session, on) => session.page.evaluate(([v, p]) => window.__game.setAutoplay(v, p), [on, pol]) };
  }
  // rent-as-needed reads the Train row's own text: pass it to the policy through the controls.
  const { meta, rec } = await runGame({
    game: 'takeoff',
    adapter,
    prefix: label,
    gameDir: flags.gameDir,
    realtime: 0,
    accelMinutes: Number(flags.minutes ?? 60),
    seed,
    stage: 1,
    viewport: sc.viewport,
    autoplay: !!sc.autoplay,
    quiet: true,
    async onSnapshot({ t, raw, session }) {
      if (t === 0 && sc.clickRate) await session.page.evaluate(installClickRate, sc.clickRate);
      if (t === 0 && adapter.policy.rowText) {
        // Give every controls() read the Train row's GPU sentence (what the player reads next to the button).
        await session.page.evaluate(() => {
          const lib = window.__critic;
          const orig = lib.controls;
          lib.controls = () => {
            const c = orig();
            const tr = c.buttons.find((b) => b.k === 'btn-train');
            const el = document.getElementById('trainGpus');
            if (tr && el) tr.rowText = el.innerText;
            return c;
          };
        });
      }
      if (sc.reloadEvery && t > 0 && t % sc.reloadEvery === 0 && (raw.m.stage || 1) === 1) {
        await session.page.reload({ waitUntil: 'load' });
        await session.page.waitForFunction(() => !!(window.__game && window.__game.state), null, { timeout: 20000 });
        await session.page.evaluate(() => window.__game.setSpeed(0));
        reloads++;
      }
      const scr = await session.page.evaluate(READ);
      screenNow.ahead = /^Ahead/i.test(scr.notes.rival || '');
      maxOverflow = Math.max(maxOverflow, scr.overflowX);
      for (const [k, v] of Object.entries(scr.notes)) {
        if (v !== lastNote[k]) {
          if (v && !QUIET_NOTES.has(k)) noteLog.push({ t, k, v });
          lastNote[k] = v;
        }
      }
      if (scr.modal) {
        const key = `${scr.modal.title}|${scr.modal.text}`;
        if (key !== lastModalKey) {
          modals.push({ t, ...scr.modal, m: { funds: raw.m.funds, trust: raw.m.trust, research: raw.m.research } });
          if (flags.modalShots && nShots < 14) {
            await session.page.waitForTimeout(900);
            await session.page.screenshot({ path: `${prefix}.modal${++nShots}.png`, fullPage: false }).catch(() => {});
          }
        }
        lastModalKey = key;
      } else lastModalKey = null;
      const stage = raw.m.stage || 1;
      gate.push({
        t,
        stage,
        phase: raw.m.trainingPhase || '',
        panel: scr.train.panel,
        tb: scr.train.btn ? scr.train.btn.e : null,
        tl: scr.train.btn ? scr.train.btn.l : null,
        cost: scr.train.cost,
        g: scr.train.gpus,
        meter: scr.train.meter,
        r: scr.train.reason,
        rent: scr.rent.btn ? scr.rent.btn.e : null,
        rc: scr.rent.cost,
        rn: scr.rent.note,
        qm: scr.rent.meter,
        quota: scr.rent.quota,
        gpus: raw.m.gpus,
        funds: Math.round(raw.m.funds),
        research: Math.round(raw.m.research),
        dc: scr.dc ? scr.dc.e : null,
        dcl: scr.dc ? scr.dc.l : null,
        pm: scr.power.meter,
        pw: scr.power.warn,
        pb: scr.power.block,
        pk: scr.power.kwh,
        cards: scr.cards,
        cardsEn: scr.cardsEnabled,
        modal: scr.modal ? 1 : 0,
        en: raw.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal').map((b) => b.k),
      });
      if (flags.gateShots && stage === 1 && scr.train.gpus && /Rent|rented|cloud|quota|more than/i.test(scr.train.gpus)) {
        const k = scr.train.gpus.replace(/[0-9,]+/g, '#');
        if (!gateShots.has(k) && gateShots.size < 6) {
          gateShots.add(k);
          await session.page.waitForTimeout(900);
          await session.page.screenshot({ path: `${prefix}.gate${gateShots.size}.png`, fullPage: true }).catch(() => {});
        }
      }
      const row = { t, ...raw.m, ...scr.st, numbers: raw.numbers, controls: raw.buttons.length + raw.sliders.length, panels: raw.panels.length, words: scr.words, notes: scr.notes, researchCap: scr.researchRow.cap, quota: scr.rent.quota, pageHeight: scr.pageHeight };
      if (t % 60 === 0) minutes.push(row);
      if (stage === 1) {
        lastS1 = {
          row,
          screen: {
            console: raw.consoleLines,
            train: scr.train,
            rent: scr.rent,
            power: scr.power,
            research: scr.researchRow,
            dc: scr.dc,
            enabled: raw.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l),
            grey: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').map((b) => b.l + (b.why ? ` [${b.why}]` : '')),
            panels: raw.panels.map((p) => p.l),
            modal: scr.modal,
            notes: scr.notes,
          },
        };
      } else {
        if (arrival == null) arrival = { t0: t };
        if (t - arrival.t0 >= 28 && !arrival.row) arrival.row = row;
      }
    },
  });
  for (const e of rec.events) if (e.type === 'console' || e.type === 'log') lines.push(`${mmss(e.t)} [${e.type}${e.novel ? '' : ', repeat'}] ${e.text}`);

  // ---- exit state ----
  const end = meta.stageEnd;
  const snaps = rec.snaps;
  const avg = (from, to, k) => {
    const w = snaps.filter((s) => s.t >= from && s.t <= to && s.stage === 1);
    return w.length ? w.reduce((a, s) => a + (s.m[k] || 0), 0) / w.length : null;
  };
  const inStage = (a) => end == null || a.t <= end;
  const count = (re) => rec.actions.filter((a) => inStage(a) && re.test(a.label || '')).length;
  const m = lastS1 ? lastS1.row : {};
  const exit = {
    label,
    name,
    seed,
    end,
    endT: meta.endT,
    capability: m.capability,
    rival: m.rival,
    alignA: m.alignA,
    alignT: m.alignT,
    researchers: m.researchers,
    lab: m.labSpace,
    researchCap: m.researchCap,
    marketing: m.hypeLevel,
    trust: m.trust,
    funds: m.funds,
    rev: end != null ? avg(end - 30, end, 'revPerSec') : m.revPerSec,
    revAfter: arrival && arrival.row ? arrival.row.revPerSec : null,
    price: m.price,
    gpus: m.gpus,
    tasks: m.tasks,
    runs: m.trainings,
    releases: m.releases,
    incidents: m.incidents,
    rescues: m.idleRescues,
    projects: m.projectsBought,
    contracts: m.contracts,
    powerPresses: rec.actions.filter((a) => inStage(a) && a.key === 'btn-buyPower').length,
    priceMoves: rec.actions.filter((a) => inStage(a) && /^price-/.test(a.why)).length,
    gpuRents: count(/^Rent GPU/),
    modals: rec.events.filter((e) => e.type === 'modal' && (end == null || e.t <= end)).length,
    clicks: m.clicks,
    reloads,
    pageErrors: meta.pageErrors,
    maxOverflow,
    lastScreen: lastS1 ? lastS1.screen : null,
  };
  fs.writeFileSync(`${prefix}.end.json`, JSON.stringify(exit, null, 1));
  fs.writeFileSync(`${prefix}.gate.json`, JSON.stringify({ label, end, gate }));
  fs.writeFileSync(`${prefix}.modals.json`, JSON.stringify(modals, null, 1));

  const md = [`# Explore run (s1r3): ${name} — ${sc.title}`, '', `Seed ${meta.seed}, stepped, cap ${meta.accelMinutes} min. **Stage end: ${end != null ? mmss(end) : `not reached by ${mmss(meta.endT)}`}**. Page errors: ${meta.pageErrors.length}${meta.pageErrors.length ? ` (${meta.pageErrors[0]})` : ''}. Largest horizontal overflow: ${maxOverflow} px.${reloads ? ` Reloads: ${reloads}.` : ''}`, ''];
  md.push('## Per minute', '', '| t | stage | funds | rev/s | contracts line | tasks/s | sold/s | price | unsold | GPUs / quota | power | research / cap | trust | researchers | lab | cap × | rival × | mkt | contracts | runs | releases | incidents | rescues | numbers | controls | panels | words | billing line |', `|${'---|'.repeat(28)}`);
  for (const r of minutes) md.push(`| ${mmss(r.t)} | ${r.stage} | ${money(r.funds)} | ${money(r.revPerSec)} | ${r.notes.contractRate ?? ''} | ${fmtN(r.rate, 1)} | ${fmtN(r.soldPerSec, 1)} | $${fmtN(r.price, 2)} | ${fmtN(r.backlog)} | ${r.gpus} / ${r.quota ?? ''} | ${fmtN(r.power)} | ${fmtN(r.research)} / ${r.researchCap ?? ''} | ${r.trust} | ${r.researchers} | ${r.labSpace} | ${fmtN(r.capability, 2)} | ${fmtN(r.rival, 2)} | ${r.hypeLevel} | ${r.contracts} | ${r.trainings} | ${r.releases} | ${r.incidents} | ${r.idleRescues} | ${r.numbers} | ${r.controls} | ${r.panels} | ${r.words} | ${r.notes.billing ?? r.notes.billing2 ?? ''} |`);
  md.push('', '## Modals (first sight of each; option text as printed on the button, effect line after the dash)', '');
  for (const mo of modals) md.push(`- **${mmss(mo.t)} — ${mo.title}** ${mo.timer ? `[${mo.timer}] ` : '(no timer shown) '}(funds ${money(mo.m.funds)}, trust ${mo.m.trust}, research ${fmtN(mo.m.research)})`, `  - text: ${mo.text}`, ...mo.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`));
  md.push('', '## Modal answers', '', ...rec.actions.filter((a) => a.why === 'modal').map((a) => `- ${mmss(a.t)} ${a.detail}`));
  md.push('', '## On-screen notes, each time they changed', '', ...noteLog.map((n) => `- ${mmss(n.t)} ${n.k}: ${n.v}`));
  md.push('', '## Last Stage 1 screen', '', '```', JSON.stringify(exit.lastScreen, null, 1), '```');
  md.push('', '## Console and Developments lines', '', ...lines.map((l) => `- ${l}`), '');
  fs.writeFileSync(`${prefix}.explore.md`, md.join('\n'));
  console.log(`${label}: stage end ${end != null ? mmss(end) : `NOT REACHED by ${mmss(meta.endT)}`} · cap ${fmtN(exit.capability, 2)}× · runs ${exit.runs} · GPUs ${exit.gpus} · modals ${modals.length} · page errors ${meta.pageErrors.length}${maxOverflow ? ` · overflow ${maxOverflow} px` : ''}`);
  return meta;
}

// ------------------------------------------------------------------------------------------ GATE
/** Classifies one 2-s check of the Train row. */
function classify(x) {
  if (x.stage !== 1) return 'stage2';
  if (!x.panel) return 'no-panel';
  if (x.phase === 'training') return 'running';
  if (x.phase === 'evaluating') return 'evaluating';
  if (x.phase === 'redteam') return 'redteam';
  if (x.tb === 1) return 'ready';
  const gpuShort = /Rent\s+[0-9,]+\s+more|rented\.|cloud|quota|more than|own/i.test(x.g || '') && !/for [0-9]+:[0-9]+/.test(x.g || '');
  const r = x.r || '';
  const why = /research/.test(r) ? 'research' : /money|\$/.test(r) ? 'money' : r ? 'other' : '';
  if (gpuShort) return why ? `gpus+${why}` : 'gpus';
  return why || 'blocked-unknown';
}

function gateReport(label) {
  const prefix = resolvePrefix(label);
  if (!fs.existsSync(`${prefix}.gate.json`)) return `(no gate file for ${label})`;
  const { end, gate } = readJson(`${prefix}.gate.json`);
  const rows = gate.filter((x) => x.stage === 1 && (end == null || x.t <= end));
  const total = {};
  const longest = {};
  let cur = null;
  const stretches = [];
  for (const x of rows) {
    const c = classify(x);
    total[c] = (total[c] || 0) + 2;
    if (!cur || cur.c !== c) {
      if (cur) stretches.push(cur);
      cur = { c, from: x.t, to: x.t + 2, g: x.g, r: x.r, rent: [], dc: x.dc, gpus: x.gpus, quota: x.quota };
    } else cur.to = x.t + 2;
    cur.rent.push(x.rent);
  }
  if (cur) stretches.push(cur);
  for (const s of stretches) if (!longest[s.c] || s.to - s.from > longest[s.c].to - longest[s.c].from) longest[s.c] = s;
  const firstPanel = rows.find((x) => x.panel);
  const out = [];
  const span = rows.length ? rows[rows.length - 1].t + 2 : 0;
  out.push(`### ${label} — stage ${end != null ? `ends ${mmss(end)}` : `not ended by ${mmss(span)}`}; Training panel from ${firstPanel ? mmss(firstPanel.t) : '—'}`);
  const cls = Object.keys(total).filter((c) => c !== 'no-panel');
  const withPanel = rows.filter((x) => x.panel).length * 2;
  out.push('', '| state of the Train row | seconds | % of the time the panel is up | longest stretch |', '|---|---|---|---|', ...cls.sort((a, b) => total[b] - total[a]).map((c) => `| ${c} | ${total[c]} | ${withPanel ? ((100 * total[c]) / withPanel).toFixed(1) : '—'}% | ${mmss(longest[c].from)}–${mmss(longest[c].to)} (${longest[c].to - longest[c].from} s) |`));
  // Stretches without being able to train: everything that is not ready/running/evaluating/redteam.
  const can = new Set(['ready', 'running', 'evaluating', 'redteam']);
  let dry = null;
  const drys = [];
  for (const s of stretches) {
    if (s.c === 'no-panel') continue;
    if (!can.has(s.c)) {
      if (!dry) dry = { from: s.from, to: s.to, parts: [s] };
      else {
        dry.to = s.to;
        dry.parts.push(s);
      }
    } else if (dry) {
      drys.push(dry);
      dry = null;
    }
  }
  if (dry) drys.push(dry);
  drys.sort((a, b) => b.to - b.from - (a.to - a.from));
  out.push('', `Longest stretches with Train not pressable and nothing training: ${drys.slice(0, 4).map((d) => `${mmss(d.from)}–${mmss(d.to)} (${d.to - d.from} s; ${[...new Set(d.parts.map((p) => p.c))].join(', ')})`).join('; ') || 'none'}.`);
  // GPU-blocked stretches in detail.
  const gp = stretches.filter((s) => /^gpus/.test(s.c));
  const gpTotal = gp.reduce((a, s) => a + s.to - s.from, 0);
  out.push('', `GPU-blocked: ${gp.length} stretch(es), ${gpTotal} s in total.`);
  // Merge adjacent gpus / gpus+x stretches.
  const merged = [];
  for (const s of gp) {
    const last = merged[merged.length - 1];
    if (last && last.to === s.from) {
      last.to = s.to;
      last.rent.push(...s.rent);
      last.texts.add(s.g);
    } else merged.push({ from: s.from, to: s.to, rent: [...s.rent], texts: new Set([s.g]), dc: s.dc, gpus: s.gpus, quota: s.quota });
  }
  for (const s of merged.slice(0, 12)) {
    const n = s.rent.length;
    const en = s.rent.filter((v) => v === 1).length;
    const gone = s.rent.filter((v) => v == null).length;
    out.push(`- ${mmss(s.from)}–${mmss(s.to)} (${s.to - s.from} s) with ${s.gpus} GPUs (quota ${s.quota}): row says ${[...s.texts].map((g) => `"${g}"`).join(' → ')}; Rent GPU enabled in ${en} of ${n} checks${gone ? `, not on screen in ${gone}` : ''}; First Datacenter card ${s.dc == null ? 'not on screen' : s.dc ? 'on screen, affordable' : 'on screen, grey'} at the start.`);
  }
  // Every distinct sentence the row showed.
  const texts = new Map();
  for (const x of rows) {
    if (!x.panel || x.phase) continue;
    const k = `${(x.g || '').replace(/[0-9][0-9,]*/g, '#').replace(/#:#/g, 'T')} | ${(x.r || '').replace(/[0-9][0-9,]*/g, '#').replace(/#:#/g, 'T')}`;
    if (!texts.has(k)) texts.set(k, { first: x.t, n: 0, ex: `${x.g || ''} | ${x.r || ''}` });
    texts.get(k).n++;
  }
  out.push('', 'Every distinct Train-row text while no run is in progress (numbers → #; first seen; seconds shown; an example):', ...[...texts].map(([k, v]) => `- \`${k}\` — first ${mmss(v.first)}, ${v.n * 2} s — e.g. "${v.ex}"`));
  // Training runs.
  const runs = [];
  let prev = '';
  for (const x of rows) {
    if (x.phase === 'training' && prev !== 'training') runs.push({ t: x.t, gpus: x.gpus });
    prev = x.phase;
  }
  out.push('', `Training runs started at: ${runs.map((r) => mmss(r.t)).join(', ') || 'none'} (gaps ${runs.slice(1).map((r, i) => `${r.t - runs[i].t} s`).join(', ') || '—'}).`);
  const dcFirst = rows.find((x) => x.dc != null);
  const dcEn = rows.find((x) => x.dc === 1);
  out.push(`First Datacenter card: first on screen ${dcFirst ? `${mmss(dcFirst.t)} ("${dcFirst.dcl}")` : 'never'}; first affordable ${dcEn ? mmss(dcEn.t) : 'never'}.`);
  return { md: out.join('\n'), total, longest, drys, merged, runs, withPanel, dcFirst: dcFirst ? dcFirst.t : null, end };
}

// ----------------------------------------------------------------------------------------- TABLE
function tableCmd(names, flags) {
  const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [1, 2, 3];
  const tag = flags.tag ?? 's1r3x';
  if (!names.length) names = Object.keys(RUNS);
  const rows = [];
  for (const name of names) {
    const cells = seeds.map((sd) => {
      const f = `${resolvePrefix(labelFor(name, { tag }, sd))}.end.json`;
      return fs.existsSync(f) ? readJson(f) : null;
    });
    if (cells.some(Boolean)) rows.push({ name, cells });
  }
  const endOf = (x) => (x ? (x.end != null ? mmss(x.end) : `> ${mmss(x.endT)}`) : '·');
  const rng = (cells, f, d = 0) => {
    const v = cells.filter(Boolean).map(f).filter((x) => x != null && Number.isFinite(x));
    if (!v.length) return '—';
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return lo === hi ? fmtN(lo, d) : `${fmtN(lo, d)}–${fmtN(hi, d)}`;
  };
  const mean = (cells) => {
    const v = cells.filter((x) => x && x.end != null).map((x) => x.end);
    return v.length && v.length === cells.filter(Boolean).length ? mmss(v.reduce((a, b) => a + b, 0) / v.length) : '—';
  };
  const gateOf = (cells, name) => {
    const v = [];
    seeds.forEach((sd, i) => {
      if (!cells[i]) return;
      const g = gateReport(labelFor(name, { tag }, sd));
      if (typeof g === 'string') return;
      const gpu = Object.entries(g.total).filter(([k]) => /^gpus/.test(k)).reduce((a, [, n]) => a + n, 0);
      v.push(gpu);
    });
    return v.length ? v.map((n) => `${n}`).join(' / ') : '—';
  };
  const md = ['| play style | stage end (per seed) | mean | cap × | align (true) | researchers / lab | mkt | Trust | funds at exit ($k) | rev/s last 30 s | rev/s +30 s | GPUs | runs / releases | incidents | rescues | cards | contracts | Train GPU-blocked (s, per seed) |', `|${'---|'.repeat(18)}`];
  for (const r of rows) {
    const c = r.cells;
    md.push(`| ${r.name} | ${c.map(endOf).join(' / ')} | ${mean(c)} | ${rng(c, (x) => x.capability, 2)} | ${rng(c, (x) => x.alignT, 0)} | ${rng(c, (x) => x.researchers)} / ${rng(c, (x) => x.lab)} | ${rng(c, (x) => x.marketing)} | ${rng(c, (x) => x.trust)} | ${rng(c, (x) => Math.round(x.funds / 1000))} | ${rng(c, (x) => Math.round(x.rev))} | ${rng(c, (x) => (x.revAfter == null ? null : Math.round(x.revAfter)))} | ${rng(c, (x) => x.gpus)} | ${rng(c, (x) => x.runs)} / ${rng(c, (x) => x.releases)} | ${rng(c, (x) => x.incidents)} | ${rng(c, (x) => x.rescues)} | ${rng(c, (x) => x.projects)} | ${rng(c, (x) => x.contracts)} | ${gateOf(c, r.name)} |`);
  }
  const out = md.join('\n');
  console.log(out);
  const errs = rows.flatMap((r) => r.cells).filter((x) => x && x.pageErrors && x.pageErrors.length);
  if (errs.length) console.log(`\npage errors in: ${errs.map((x) => `${x.label} (${x.pageErrors[0]})`).join(', ')}`);
  if (flags.out) fs.writeFileSync(`${resolvePrefix(flags.out)}.md`, `# Play-style table (Takeoff Stage 1)\n\nSeeds ${seeds.join(', ')}; "> 60:00" = the stage had not ended at the cap; "·" = not run. Exit state = the last Stage 1 snapshot (rev/s = mean of the last 30 s; "+30 s" = 28–30 s after the stage change).\n\n${out}\n`);
}

// ----------------------------------------------------------- GATE-TABLE, MEASURES, HANDS, SAYS
const load = (label, kind) => {
  const f = `${resolvePrefix(label)}.${kind}.json`;
  return fs.existsSync(f) ? readJson(f) : null;
};
const purchaseLike = (b) => !b.a && b.kind !== 'modal' && b.kind !== 'tab';

function gateTableCmd(names, flags) {
  const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [1, 2, 3, 4, 5];
  const tag = flags.tag ?? 's1r3x';
  const rows = [];
  for (const name of names) {
    for (const sd of seeds) {
      const label = labelFor(name, { tag }, sd);
      const gj = load(label, 'gate');
      if (!gj) continue;
      const { end, gate } = gj;
      const acts = (load(label, 'actions') || { actions: [] }).actions;
      const g = gate.filter((x) => x.stage === 1 && (end == null || x.t <= end));
      const wall = g.find((x) => /cloud will rent/.test(x.g || ''));
      const shortFirst = g.find((x) => /Rent\s+[0-9,]+\s+more/.test(x.g || ''));
      const lastT = g.length ? g[g.length - 1].t : 0;
      let dry = 0;
      let longest = { len: 0 };
      let cur = null;
      let bGpu = 0;
      let bRes = 0;
      let bMoney = 0;
      let wallEn = 0;
      let wallN = 0;
      for (const x of g) {
        if (!x.panel) continue;
        const isDry = !x.phase && x.tb !== 1;
        if (isDry) {
          dry += 2;
          if (!cur) cur = { from: x.t, to: x.t + 2 };
          else cur.to = x.t + 2;
          if (cur.to - cur.from > longest.len) longest = { len: cur.to - cur.from, from: cur.from, to: cur.to };
          if (/Rent\s+[0-9,]+\s+more|cloud will rent/.test(x.g || '')) bGpu += 2;
          else if (/research/.test(x.r || '')) bRes += 2;
          else if (/money|\$/.test(x.r || '')) bMoney += 2;
        } else cur = null;
        if (wall && x.t >= wall.t) {
          wallN++;
          if ((x.en || []).some((k) => k !== 'btn-buyPower' && k !== 'btn-gpu' && k !== 'proj-p_datacenter')) wallEn++;
        }
      }
      const wallActs = wall ? acts.filter((a) => a.t >= wall.t && a.t <= (end ?? lastT) && !['mash', 'consumable', 'price-lower', 'price-raise', 'automation'].includes(a.why)).length : null;
      const runs = g.filter((x, i) => x.phase === 'training' && (i === 0 || g[i - 1].phase !== 'training')).length;
      rows.push(`| ${label.replace(`${tag}-`, '')} | ${end != null ? mmss(end) : `> ${mmss(lastT)}`} | ${runs} | ${dry} | ${bRes} / ${bMoney} / ${bGpu} | ${longest.len ? `${mmss(longest.from)}–${mmss(longest.to)} (${longest.len} s)` : '—'} | ${shortFirst ? mmss(shortFirst.t) : '—'} | ${wall ? `${mmss(wall.t)} "${wall.g}"` : 'never'} | ${wall && end != null ? `${end - wall.t} s` : '—'} | ${wall ? `${wallN ? Math.round((100 * wallEn) / wallN) : 0}% · ${wallActs}` : '—'} |`);
    }
  }
  const out = ['| run | stage end | runs | Train not pressable, nothing training (s) | of which research / money / GPUs | longest such stretch | first "Rent N more" | the wall first on the row | wall → stage end | at the wall: checks with another purchase enabled · non-drip actions |', `|${'---|'.repeat(10)}`, ...rows].join('\n');
  console.log(out);
  if (flags.out) fs.writeFileSync(`${resolvePrefix(flags.out)}.md`, `# Training under the gate, one row per run\n\n${out}\n`);
}

function measuresCmd(labels) {
  for (const label of labels) {
    const sj = load(label, 'snaps');
    const ej = load(label, 'events');
    if (!sj || !ej) {
      console.log(`(no run files for ${label})`);
      continue;
    }
    const { meta, snaps } = sj;
    const { events } = ej;
    const end = meta.stageEnd ?? meta.endT;
    const st = snaps.filter((x) => x.t <= end && x.stage === meta.stageStart);
    const holes = [];
    let cur = null;
    for (const x of st) {
      const hit = x.milestone || x.buttons.some((b) => !b.e && purchaseLike(b));
      if (!hit) {
        if (!cur) cur = { from: x.t, to: x.t + 2 };
        else cur.to = x.t + 2;
      } else if (cur) {
        holes.push(cur);
        cur = null;
      }
    }
    if (cur) holes.push(cur);
    const holeSec = (a, b) => holes.reduce((n, h) => n + Math.max(0, Math.min(h.to, b) - Math.max(h.from, a)), 0);
    const big = [...holes].sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, 5);
    let red = 0;
    let redFirst = null;
    let redLast = null;
    let redSmall = 0;
    for (const x of st) {
      if (x.m.power == null || !(x.m.gpus >= 1)) continue;
      const block = x.m.gpus >= 200 ? 100000 : x.m.gpus >= 20 ? 10000 : 1000;
      if (x.m.power < 0.2 * block) {
        red += 2;
        if (redFirst == null) redFirst = x.t;
        redLast = x.t;
        if (x.m.stockUnit < block) redSmall += 2;
      }
    }
    const con = events.filter((e) => e.type === 'console' && e.t <= end);
    const log = events.filter((e) => e.type === 'log' && e.t <= end);
    const win = (a, b, arr) => arr.filter((e) => e.t >= a && e.t < b).length;
    const rev = events.filter((e) => e.type === 'reveal' && e.t <= end);
    let best = { n: 0, from: 0 };
    for (let a = 0; a + 360 <= end; a += 2) {
      const n = rev.filter((e) => e.t >= a && e.t < a + 360).length;
      if (n > best.n) best = { n, from: a };
    }
    let bestLate = { n: 0, from: 0 };
    for (let a = 2; a + 360 <= end; a += 2) {
      const n = rev.filter((e) => e.t >= a && e.t < a + 360).length;
      if (n > bestLate.n) bestLate = { n, from: a };
    }
    let emptyProj = 0;
    let emptyFirst5 = 0;
    for (const x of st) {
      if (x.panels.some((p) => p.l === 'Projects') && !x.buttons.some((b) => b.kind === 'project')) {
        emptyProj += 2;
        if (x.t < 300) emptyFirst5 += 2;
      }
    }
    const after = st.filter((x) => x.t >= 180);
    const none = after.filter((x) => !x.buttons.some((b) => b.e && purchaseLike(b))).length;
    const two = after.filter((x) => new Set(x.buttons.filter((b) => b.e && purchaseLike(b)).map((b) => b.k)).size >= 2).length;
    console.log(`\n== ${label}: stage end ${meta.stageEnd != null ? mmss(meta.stageEnd) : 'not reached'}`);
    console.log(`greyed-goal holes: first 60 s ${holeSec(0, 60)} s, first 5 min ${holeSec(0, 300)} s, stage ${holeSec(0, end)} s, after 5:00 ${holeSec(300, end)} s; biggest: ${big.map((h) => `${mmss(h.from)}–${mmss(h.to)} (${h.to - h.from} s)`).join(', ') || '—'}`);
    console.log(`power meter red (power under 20% of the fleet's block): ${red} s (${redFirst != null ? `${mmss(redFirst)} … ${mmss(redLast)}` : '—'}); with Buy Power selling a smaller block than the meter's scale: ${redSmall} s`);
    console.log(`console lines ${con.length} (${(con.length / (end / 60)).toFixed(1)}/min; distinct ${con.filter((e) => e.novel).length}); minutes 0–3: ${win(0, 180, con)}, 3–10: ${win(180, 600, con)} (${(win(180, 600, con) / 7).toFixed(1)}/min), 10–20: ${win(600, 1200, con)} (${(win(600, 1200, con) / 10).toFixed(1)}/min), 20–end: ${win(1200, end + 1, con)}; Developments entries ${log.length} (${(log.length / (end / 60)).toFixed(1)}/min)`);
    console.log(`reveals ${rev.length}: 0–3 min ${rev.filter((e) => e.t < 180).length}, 3–9 min ${rev.filter((e) => e.t >= 180 && e.t < 540).length}; densest six minutes ${best.n} from ${mmss(best.from)} (opening screen excluded: ${bestLate.n} from ${mmss(bestLate.from)})`);
    console.log(`Projects panel on screen with no card: ${emptyProj} s (first 5 min ${emptyFirst5} s)`);
    console.log(`after 3:00: no enabled purchase in ${after.length ? ((100 * none) / after.length).toFixed(0) : '—'}% of checks; two or more distinct in ${after.length ? ((100 * two) / after.length).toFixed(0) : '—'}%`);
  }
}

function handsCmd(labels) {
  for (const label of labels) {
    const sj = load(label, 'snaps');
    const ej = load(label, 'events');
    const aj = load(label, 'actions');
    if (!sj || !ej || !aj) {
      console.log(`(no run files for ${label})`);
      continue;
    }
    const { meta, snaps } = sj;
    const { events } = ej;
    const { actions } = aj;
    const end = meta.stageEnd ?? meta.endT;
    const st = snaps.filter((x) => x.t <= end && x.stage === 1);
    const at = (t) => st.find((x) => x.t >= t) || st[st.length - 1];
    const acts = actions.filter((x) => x.t <= end && x.why !== 'mash');
    const lastAct = (re) => {
      const a = acts.filter((x) => re.test(x.label || ''));
      return a.length ? a[a.length - 1].t : null;
    };
    const count = (re) => acts.filter((x) => re.test(x.label || '')).length;
    const mk = (x) => x.buttons.find((b) => b.k === 'btn-marketing');
    const mkLast = lastAct(/^Marketing/);
    const mkGrey = st.filter((x) => x.t > (mkLast ?? 0) && mk(x) && !mk(x).e).length * 2;
    const mkEn = st.filter((x) => x.t > (mkLast ?? 0) && mk(x) && mk(x).e).length * 2;
    const priceGone = events.find((e) => e.type === 'hidden' && e.key === 'btn-lowerPrice');
    const dc = events.find((e) => e.type === 'reveal' && /First Datacenter/.test(e.label || ''));
    const capSec = st.filter((x) => x.t >= 150 && x.t <= 420 && x.m.labSpace === 1 && x.m.research >= 999).length * 2;
    const firstReveal = (f) => (events.find((e) => e.type === 'reveal' && f(e)) || {}).t;
    const starts = events.filter((e) => e.type === 'console' && /^Training Sage-[0-9.]+ on/.test(e.text)).map((e) => ({ t: e.t, text: e.text.replace(/;.*/, '').replace('Training ', '') }));
    const rel = events.filter((e) => e.type === 'console' && /^Sage-[0-9.]+ released/.test(e.text)).map((e) => e.t);
    const t3 = starts[2] ? starts[2].t : null;
    const t4 = starts[3] ? starts[3].t : null;
    const between = t3 != null && t4 != null ? acts.filter((a) => a.t > t3 && a.t < t4 && /research/.test(a.detail || '') && a.why === 'project') : [];
    const spent = between.reduce((n, a) => n + Number((((a.detail || '').match(/([0-9,]+) research/) || [0, '0'])[1]).replace(/,/g, '')), 0);
    const pct = (t) => `${((100 * at(t).m.funds) / 250000).toFixed(0)}%`;
    const rv = (t) => Math.round(at(t).m.revPerSec);
    const fundsBuys = acts.filter((a) => a.t >= 720 && /\$/.test(a.detail || '') && !/^Rent GPU|^Buy Power|^Marketing/.test(a.label || ''));
    console.log(`\n== ${label}: stage end ${meta.stageEnd != null ? mmss(meta.stageEnd) : 'not reached'}`);
    console.log(`Research panel ${mmss(firstReveal((e) => e.what === 'panel' && e.label === 'Research'))}, Projects panel ${mmss(firstReveal((e) => e.what === 'panel' && e.label === 'Projects'))}, Expand Lab on screen ${mmss(firstReveal((e) => e.key === 'btn-expandLab'))}, first Expand Lab click ${mmss((acts.find((a) => /^Expand Lab/.test(a.label || '')) || {}).t)}; research pinned at the 1,000 cap for ${capSec} s between 2:30 and 7:00`);
    console.log(`runs: ${starts.map((x) => `${mmss(x.t)} ${x.text}`).join('; ')}; releases ${rel.map((t) => mmss(t)).join(', ')}; run 3 → run 4: ${t3 != null && t4 != null ? `${t4 - t3} s, ${between.length} research cards bought in between for ${fmtN(spent)} research (${between.filter((b) => /contract/i.test(b.label)).length} contracts)` : '—'}; capability after the 3rd release ${rel[2] != null ? fmtN(at(rel[2] + 2).m.capability, 2) : '—'}×, after the 4th ${rel[3] != null ? fmtN(at(Math.min(end, rel[3] + 2)).m.capability, 2) : '—'}×`);
    console.log(`First Datacenter card ${dc ? `${mmss(dc.t)} (${dc.label}); funds then ${money(at(dc.t).m.funds)}, rev/s then ${money(rv(dc.t))}; on screen ${end - dc.t} s = ${((100 * (end - dc.t)) / end).toFixed(0)}% of the stage` : 'never'}`);
    console.log(`funds as % of $250,000: 15:00 ${pct(900)}, 20:00 ${pct(1200)}, end−5:00 ${pct(end - 300)}, end−2:30 ${pct(end - 150)}, end−1:00 ${pct(end - 60)}; rev/s: 15:00 $${rv(900)}, 20:00 $${rv(1200)}, end−5:00 $${rv(end - 300)}, end−2:30 $${rv(end - 150)}, end $${rv(end)}; price: end−5:00 $${at(end - 300).m.price.toFixed(2)}, end $${at(end).m.price.toFixed(2)}`);
    const lg = lastAct(/^Rent GPU/);
    console.log(`last GPU rented ${mmss(lg)} (${at(end).m.gpus} GPUs; flat for ${end - (lg ?? 0)} s = ${((100 * (end - (lg ?? 0))) / end).toFixed(0)}% of the stage); Marketing: ${count(/^Marketing/)} bought, last ${mmss(mkLast)}, then grey ${mkGrey} s / affordable ${mkEn} s, level ${at(end).m.hypeLevel} at the end; lower/raise gone at ${mmss(priceGone ? priceGone.t : null)}; price moves ${acts.filter((a) => /^price-/.test(a.why)).length}; Buy Power presses ${count(/^Buy Power/)} (last ${mmss(lastAct(/^Buy Power/))})`);
    console.log(`funds-priced purchases after 12:00: ${fundsBuys.map((a) => `${mmss(a.t)} ${a.label}`).join('; ') || '—'}`);
  }
}

function saysCmd(names, flags) {
  const tag = flags.tag ?? 's1r3x';
  for (const name of names) {
    const label = fs.existsSync(`${resolvePrefix(name)}.end.json`) ? name : `${tag}-${name}`;
    const ej = load(label, 'events');
    const end = load(label, 'end');
    if (!ej || !end) {
      console.log(`(no run files for ${label})`);
      continue;
    }
    const stageEnd = end.end ?? 1e9;
    const con = ej.events.filter((e) => e.type === 'console' && e.t <= stageEnd);
    const counts = new Map();
    for (const e of con) {
      const k = e.text.replace(/[0-9][0-9,.]*/g, '#');
      if (!counts.has(k)) counts.set(k, { n: 0, first: e.t, ex: e.text });
      counts.get(k).n++;
    }
    const top = [...counts.values()].filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 7);
    const ls = end.lastScreen || {};
    console.log(`\n== ${label}: stage end ${end.end != null ? mmss(end.end) : `> ${mmss(end.endT)}`}; capability ${fmtN(end.capability, 2)}×; GPUs ${end.gpus}; funds ${money(end.funds)}; rev/s ${money(end.rev)}; runs ${end.runs}; incidents ${end.incidents}; rescues ${end.rescues}; Buy Power presses ${end.powerPresses}; price moves ${end.priceMoves}; modals ${end.modals}`);
    console.log(`  repeated lines: ${top.map((x) => `${x.n}× "${x.ex}" (first ${mmss(x.first)})`).join(' | ') || '—'}`);
    console.log(`  last console: ${(ls.console || []).slice(-3).map((c) => `"${c}"`).join(' / ')}`);
    console.log(`  Train row: ${ls.train && ls.train.btn ? `${ls.train.btn.l}${ls.train.btn.e ? '' : ' (grey)'} — ${ls.train.cost} — ${ls.train.gpus} — ${ls.train.reason ?? ''}` : '(no Train button)'}; billing: ${(ls.notes && (ls.notes.billing ?? ls.notes.billing2)) ?? ''}`);
    console.log(`  grey: ${(ls.grey || []).join('; ')}`);
    console.log(`  enabled: ${(ls.enabled || []).join('; ')}`);
  }
}

// ---------------------------------------------------------------------------------------- PROBES
const settle = (kit, ms = 1000) => kit.session.page.waitForTimeout(ms);
const screenOf = (kit) => kit.session.page.evaluate(READ);
const pageText = (kit) => kit.session.page.evaluate(PAGE_TEXT);
const stateJson = (kit) => kit.session.page.evaluate(() => JSON.stringify(window.__game.state));
const consoleNow = (kit) => kit.session.page.evaluate(() => ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => document.getElementById(id).textContent.trim()).filter(Boolean));

async function playUntil(kit, pol, seconds, cond) {
  let hit = null;
  const f = async (t, s) => {
    if (await cond(s, t)) {
      hit = s;
      return 'stop';
    }
    await pol.pass(t);
    return undefined;
  };
  f.policy = pol;
  await kit.run(seconds, f);
  return hit;
}

/** Lines of `b` not in `a` (multiset), numbers kept. */
function addedLines(a, b) {
  const left = new Map();
  for (const l of a) left.set(l, (left.get(l) || 0) + 1);
  const out = [];
  for (const l of b) {
    if (left.get(l)) left.set(l, left.get(l) - 1);
    else out.push(l);
  }
  return out;
}
const shape = (l) => l.replace(/[0-9][0-9,.]*/g, '#');

const PROBES = {
  opening: {
    title: 'The first three minutes, second by second, for four hands (0.5, 1.5, 4 and 10 clicks a second); purchases by the scripted first-timer at its 2-s checks',
    async run(kit0, out, flags) {
      await kit0.close();
      const rates = flags.rates ? String(flags.rates).split(',').map(Number) : [0.5, 1.5, 4, 10];
      const seconds = Number(flags.seconds ?? 180);
      for (const rate of rates) {
        const adapter = { ...base, metrics: metricsAt(rate) };
        const kit = await openProbe(adapter, { gameDir: kit0.gameDir, seed: kit0.seedN, prefix: kit0.prefix });
        try {
          const { page } = kit.session;
          await page.evaluate(installClickRate, rate);
          const pol = kit.policy();
          const beats = [];
          const marks = [];
          let prevLines = [];
          let prevShapes = new Set();
          let prevCon = [];
          let prevCtl = new Set();
          let nShot = 0;
          const firsts = {};
          for (let t = 0; t <= seconds; t++) {
            const s = await kit.session.snapshot();
            const lines = await pageText(kit);
            const con = s.consoleLines || [];
            const newCon = con.filter((c) => !prevCon.includes(c));
            // New things on screen: lines whose shape (numbers → #) was not there a second ago, console excluded.
            const conSet = new Set(con);
            const body = lines.filter((l) => !conSet.has(l.replace(/^[.>]\s*/, '')) && !/^[.>]$/.test(l));
            const shapes = new Set(body.map(shape));
            const added = body.filter((l) => !prevShapes.has(shape(l)));
            const gone = [...prevShapes].filter((x) => !shapes.has(x));
            const ctl = new Set(s.buttons.map((b) => b.k));
            const newCtl = s.buttons.filter((b) => !prevCtl.has(b.k)).map((b) => `${b.l}${b.e ? '' : ' (grey)'}`);
            const m = s.m;
            if (t === 0 || added.length || newCon.length || newCtl.length) {
              beats.push({ t, added, gone: gone.filter((g) => !/^Tasks Completed/.test(g)), newCon, newCtl, numbers: s.numbers, controls: s.buttons.length, panels: s.panels.length, funds: m.funds, gpus: m.gpus, tasks: m.tasks, clicks: null });
              if (rate === 1.5 && (added.length || newCtl.length) && nShot < 30) {
                await settle(kit, 900);
                await page.screenshot({ path: `${kit.prefix}-r${rate}-t${String(t).padStart(3, '0')}.png`, fullPage: false });
                nShot++;
              }
            }
            for (const [k, cond] of [['funds', m.funds > 0], ['gpu', m.gpus >= 1], ['gpu3', m.gpus >= 3], ['gpu10', m.gpus >= 10], ['power', s.buttons.some((b) => b.k === 'btn-buyPower')], ['price', s.buttons.some((b) => b.k === 'btn-lowerPrice')], ['marketing', s.buttons.some((b) => b.k === 'btn-marketing')], ['research', s.panels.some((p) => p.l === 'Research')], ['projects', s.panels.some((p) => p.l === 'Projects')]]) if (cond && firsts[k] == null) firsts[k] = t;
            if ([0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180].includes(t)) {
              marks.push({ t, numbers: s.numbers, controls: s.buttons.length, panels: s.panels.length, words: lines.join(' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length, greyGoal: s.buttons.some((b) => !b.e && !b.a) || s.milestone, enabled: s.buttons.filter((b) => b.e && !b.a).map((b) => b.l), tasks: m.tasks, funds: m.funds, gpus: m.gpus, lines: body });
              if ([0, 10, 30, 60, 120, 180].includes(t)) {
                await settle(kit, 900);
                await page.screenshot({ path: `${kit.prefix}-r${rate}-mark${String(t).padStart(3, '0')}.png`, fullPage: false });
              }
            }
            prevLines = lines;
            prevShapes = shapes;
            prevCon = con;
            prevCtl = ctl;
            if (t % 2 === 0) {
              kit.t = t;
              await pol.pass(t);
            }
            // one second: clicks at `rate` while the policy is still mashing
            await page.evaluate(([k, on]) => window.__critic.mashAdvance(on ? k : null, 4, 250), ['btn-task', pol.mashing]);
          }
          void prevLines;
          const clicks = await page.evaluate(() => window.__game.state.flags.clicks);
          out.push(`## ${rate} clicks a second`, '', `First money ${firsts.funds ?? '—'} s · first GPU ${firsts.gpu ?? '—'} s · third GPU ${firsts.gpu3 ?? '—'} s · tenth GPU ${firsts.gpu10 ?? '—'} s · Buy Power on screen ${firsts.power ?? '—'} s · price buttons ${firsts.price ?? '—'} s · Marketing ${firsts.marketing ?? '—'} s · Research ${firsts.research ?? '—'} s · Projects ${firsts.projects ?? '—'} s. Hand clicks in ${seconds} s: ${clicks}; the hand stopped ${pol.mashing ? 'never (copies under 8 tasks/s)' : 'when the copies made 8 tasks/s'}.`, '');
          out.push('| t | new on screen | gone | console | numbers / controls / panels | funds · GPUs |', '|---|---|---|---|---|---|');
          for (const b of beats) out.push(`| ${mmss(b.t)} | ${[...b.added.map((l) => `"${l}"`), ...b.newCtl.map((l) => `[${l}]`)].join(' · ') || ''} | ${b.gone.map((g) => `~~${g}~~`).join(' · ')} | ${b.newCon.map((c) => `\`${c}\``).join(' / ')} | ${b.numbers} / ${b.controls} / ${b.panels} | ${money(b.funds)} · ${b.gpus} |`);
          out.push('', '| mark | numbers | controls | panels | words | greyed goal on screen | enabled purchases | tasks · funds · GPUs |', '|---|---|---|---|---|---|---|---|', ...marks.map((k) => `| ${mmss(k.t)} | ${k.numbers} | ${k.controls} | ${k.panels} | ${k.words} | ${k.greyGoal ? 'yes' : 'no'} | ${k.enabled.join('; ') || '—'} | ${fmtN(k.tasks)} · ${money(k.funds)} · ${k.gpus} |`), '');
          for (const k of marks.filter((x) => [0, 30, 60, 120, 180].includes(x.t))) out.push(`Screen at ${mmss(k.t)} (console excluded): ${k.lines.map((l) => `"${l}"`).join(' / ')}`, '');
        } finally {
          if (kit.session.errors.length) out.push(`Page errors: ${kit.session.errors.slice(0, 5).join(' | ')}`);
          await kit.close();
        }
      }
    },
  },
  shots: {
    title: 'Settled screenshots (fade-ins finished) and numbers / controls / panels / words at the minute marks and at each first meeting; the full text of every card and modal',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const { page } = kit.session;
      const marks = new Set([2, 30, 60, 120, 180, 300, 420, 600, 900, 1200, 1500]);
      const shot = async (name, full = true) => {
        await settle(kit);
        await page.screenshot({ path: `${kit.prefix}-${name}.png`, fullPage: full });
      };
      const once = new Set();
      const first = async (name, t, note) => {
        if (once.has(name)) return;
        once.add(name);
        await shot(name);
        out.push(`- shot \`${path.basename(kit.prefix)}-${name}.png\` at ${mmss(t)}${note ? ` — ${note}` : ''}`);
      };
      const rows = [];
      const texts = [];
      const cards = [];
      const seenCards = new Set();
      const titles = new Map();
      let arrival = null;
      let nModal = 0;
      let lastModal = null;
      let peak = { n: 0, t: 0 };
      const stepFn = async (t, s) => {
        if (s.m.stage > 1) {
          if (arrival == null) arrival = t;
          if (t === arrival) await first('arrival-0s', t);
          if (t >= arrival + 4) await first('arrival-4s', t);
          if (t >= arrival + 12) await first('arrival-12s', t);
          if (t >= arrival + 30) await first('arrival-30s', t);
          if (t >= arrival + 60) {
            await first('arrival-60s', t);
            texts.push({ t, name: 'arrival +60 s', lines: await pageText(kit) });
            return 'stop';
          }
          await pol.pass(t);
          return undefined;
        }
        const scr = await screenOf(kit);
        if (s.numbers > peak.n) peak = { n: s.numbers, t, phase: s.m.trainingPhase, modal: s.modal ? s.modal.title : null };
        if (marks.has(t)) {
          await shot(`t${String(t).padStart(4, '0')}`);
          rows.push({ t, numbers: s.numbers, controls: s.buttons.length + s.sliders.length, panels: s.panels.length, words: scr.words, height: scr.pageHeight, cards: scr.cards });
          if ([2, 60, 180, 300, 600, 1200].includes(t)) texts.push({ t, name: mmss(t), lines: await pageText(kit) });
        }
        const info = await page.evaluate(() => {
          const vis = (el) => el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const list = [...document.querySelectorAll('#projectList .projectButton')].filter(vis).map((b) => ({ id: b.id, text: b.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim(), title: b.title || '', cls: b.className, clipped: b.scrollHeight > b.clientHeight + 1, h: Math.round(b.getBoundingClientRect().height), sh: b.scrollHeight, disabled: b.disabled }));
          const tips = [...document.querySelectorAll('[title]')].filter((el) => vis(el) && el.title && !el.closest('#dev')).map((el) => ({ id: el.id || el.tagName, text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), title: el.title }));
          return { list, tips };
        });
        for (const c of info.list) {
          if (!seenCards.has(c.id)) {
            seenCards.add(c.id);
            cards.push({ t, ...c });
          }
          if (c.clipped) await first(`clipped-${c.id}`, t, `clipped card "${c.text}" (box ${c.h} px, content ${c.sh} px)`);
        }
        for (const tip of info.tips) if (!titles.has(tip.id)) titles.set(tip.id, { t, ...tip });
        if (s.modal && s.modal.title !== lastModal && nModal < 12) {
          nModal++;
          await settle(kit, 800);
          await page.screenshot({ path: `${kit.prefix}-modal${nModal}.png`, fullPage: false });
          out.push(`- modal shot \`${path.basename(kit.prefix)}-modal${nModal}.png\` at ${mmss(t)}: "${s.modal.title}" ${scr.modal && scr.modal.timer ? `[${scr.modal.timer}]` : ''} — text "${scr.modal ? scr.modal.text : ''}" — ${scr.modal ? scr.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (grey)' : ''}`).join(' / ') : ''}`);
        }
        lastModal = s.modal ? s.modal.title : null;
        const tp = () => page.evaluate(() => document.getElementById('panel-training').innerText.replace(/\s*\n\s*/g, ' / '));
        if (scr.train.panel) await first('training-panel', t, `Training panel: "${await tp()}"`);
        if (s.m.trainingPhase === 'training') await first('training', t, `Training panel: "${await tp()}"`);
        if (s.m.trainingPhase === 'evaluating') await first('evaluating', t, `Training panel: "${await tp()}"`);
        if (s.m.trainingPhase === 'redteam') await first('redteam', t, `Training panel: "${await tp()}"`);
        if (s.buttons.some((b) => b.k === 'btn-focus-capability')) await first('focus', t, `Training panel: "${await tp()}"`);
        if (scr.rent.meter) await first('quota-meter', t, `Compute panel: "${await page.evaluate(() => document.getElementById('panel-compute').innerText.replace(/\s*\n\s*/g, ' / '))}"`);
        if (scr.dc) await first('datacenter-card', t, `card "${scr.dc.l}"`);
        if (scr.train.gpus && /Rent\s+[0-9,]+\s+more|rented\./.test(scr.train.gpus)) await first('gate', t, `Train row: "${scr.train.gpus}" / "${scr.train.reason}"`);
        if (scr.dc && scr.dc.e) {
          await first('pre-datacenter', t, `card "${scr.dc.l}"`);
          if (!texts.some((x) => x.name === 'pre-transition')) texts.push({ t, name: 'pre-transition', lines: await pageText(kit) });
        }
        await pol.pass(t);
        return undefined;
      };
      stepFn.policy = pol;
      await kit.run(2700, stepFn);
      out.push('', `Peak numbers on screen: ${peak.n} at ${mmss(peak.t)} (training phase "${peak.phase || 'idle'}"${peak.modal ? `, modal "${peak.modal}"` : ''}).`);
      out.push('', '| t | numbers | controls | panels | words | cards | page height px |', '|---|---|---|---|---|---|---|', ...rows.map((r) => `| ${mmss(r.t)} | ${r.numbers} | ${r.controls} | ${r.panels} | ${r.words} | ${r.cards} | ${r.height} |`));
      out.push('', '## Project cards at first sight', '', '| t | card text | classes | greyed | tooltip |', '|---|---|---|---|---|', ...cards.map((c) => `| ${mmss(c.t)} | ${c.text.replace(/\|/g, '/')} | ${c.cls.replace('projectButton', '').trim()} | ${c.disabled ? 'grey' : 'affordable'} | ${c.title} |`));
      out.push('', '## Tooltips (title attributes) on visible elements, at first sight', '', '| t | element | its text | tooltip |', '|---|---|---|---|', ...[...titles.values()].map((x) => `| ${mmss(x.t)} | ${x.id} | ${x.text.replace(/\|/g, '/')} | ${x.title.replace(/\|/g, '/')} |`));
      for (const x of texts) out.push('', `## Everything on screen at ${x.name} (${mmss(x.t)})`, '', '```', ...x.lines, '```');
    },
  },
  'pc-words': {
    title: 'Paperclips Stage 1: numbers / controls / panels / words at the same minute marks (scripted player, stepped)',
    game: 'paperclips',
    async run(kit, out) {
      kit.mashKey = 'btnMakePaperclip';
      const pol = kit.policy();
      const marks = [2, 30, 60, 120, 180, 300, 420, 600, 900, 1200, 1500, 1800];
      const DEBUG = ['save1Button', 'load1Button', 'save2Button', 'load2Button', 'resetButton', 'freeClipsButton', 'freeMoneyButton', 'freeTrustButton', 'freeOpsButton', 'freeCreatButton', 'freeYomiButton', 'resetPrestige', 'destroyAllHumansButton', 'freePrestigeU', 'freePrestigeS', 'debugBattleNumbers', 'availMatterZero'];
      const words = () =>
        kit.session.page.evaluate((dbg) => {
          const W = /[A-Za-z][A-Za-z'’-]*/g;
          let n = (document.body.innerText.match(W) || []).length;
          for (const id of dbg) {
            const el = document.getElementById(id);
            if (el && el.checkVisibility({ checkVisibilityCSS: true })) n -= (el.innerText.match(W) || []).length;
          }
          return { words: n, height: document.documentElement.scrollHeight };
        }, DEBUG);
      out.push('| t | numbers | controls | panels | words (debug buttons excluded) |', '|---|---|---|---|---|');
      const f = kit.with(pol);
      for (const mark of marks) {
        await kit.run(mark - kit.t, f);
        const s = await kit.snap();
        const w = await words();
        out.push(`| ${mmss(kit.t)} | ${s.numbers} | ${s.buttons.length + s.sliders.length} | ${s.panels.length} | ${w.words} |`);
        if ([2, 60, 180, 300, 600].includes(mark)) await kit.session.page.screenshot({ path: `${kit.prefix}-t${String(mark).padStart(4, '0')}.png`, fullPage: false });
      }
    },
  },
  arrival: {
    title: 'First Datacenter: the screen before, and every 2 s for 90 s after — console, revenue, unsold, price, what can be bought (the first-timer resumes buying at +20 s)',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const hit = await playUntil(kit, pol, 3000, async () => {
        const scr = await screenOf(kit);
        return !!(scr.dc && scr.dc.e);
      });
      if (!hit) return void out.push('First Datacenter never became affordable within 50 minutes.');
      const scr0 = await screenOf(kit);
      const before = (await kit.snap()).m;
      out.push(`First Datacenter affordable at ${mmss(kit.t)}. The card: "${scr0.dc.l}". Before: funds ${money(before.funds)}, "Avg. Rev. per sec: ${scr0.notes.revPerSec}", "Contracts: ${scr0.notes.contractRate}", tasks/s ${fmtN(before.rate, 1)}, price $${fmtN(before.price, 2)}, unsold ${fmtN(before.backlog)}, ${before.gpus} GPUs, Trust ${before.trust}, research ${fmtN(before.research)}; Train row "${scr0.train.btn ? scr0.train.btn.l : ''} — ${scr0.train.cost} — ${scr0.train.gpus} — ${scr0.train.reason}".`, '');
      await settle(kit);
      await kit.session.page.screenshot({ path: `${kit.prefix}-before.png`, fullPage: true });
      const textBefore = await pageText(kit);
      await kit.click('proj-p_datacenter', 1, 'gate');
      const t0 = kit.t;
      out.push('| t after | console (5 lines, oldest → newest) | rev/s (screen) | tasks/s | sold/s | price | unsold | funds | enabled purchases |', '|---|---|---|---|---|---|---|---|---|');
      await kit.run(90, async (t, s) => {
        const scr = await screenOf(kit);
        const en = s.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal').map((b) => b.l);
        const con = await consoleNow(kit);
        out.push(`| +${t - t0} s | ${con.join(' ⏎ ')} | ${scr.notes.revPerSec ?? ''} | ${fmtN(s.m.rate, 0)} | ${fmtN(s.m.soldPerSec, 0)} | $${fmtN(s.m.price, 2)} | ${fmtN(s.m.backlog)} | ${money(s.m.funds)} | ${en.join('; ') || '—'} |`);
        if ([0, 4, 12, 30, 60].includes(t - t0)) {
          await settle(kit);
          await kit.session.page.screenshot({ path: `${kit.prefix}-plus${t - t0}s.png`, fullPage: true });
        }
        if (t - t0 >= 20) await pol.pass(t);
        return undefined;
      });
      const lines = kit.rec.events.filter((e) => (e.type === 'console' || e.type === 'log') && e.t >= t0).map((e) => `- ${mmss(e.t)} (+${e.t - t0} s) [${e.type}] ${e.text}`);
      out.push('', 'Every console and Developments line from the click on (the first-timer resumes buying at +20 s):', ...lines);
      out.push('', '## The whole screen just before the click', '', '```', ...textBefore, '```', '', '## The whole screen 90 s after', '', '```', ...(await pageText(kit)), '```');
    },
  },
  reloads: {
    title: 'Reload (the game\'s own save / load) at awkward moments in one playthrough: is the state identical, is the screen identical?',
    async run(kit, out) {
      const { page } = kit.session;
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const VOLATILE = /"(lastSavedAt|savedAt|sessionStart|lastTick|now)":[^,}]+,?/g;
      const check = async (name) => {
        const a = { st: (await stateJson(kit)).replace(VOLATILE, ''), text: await pageText(kit), con: await consoleNow(kit), m: await kit.session.metrics(), scr: await screenOf(kit) };
        await kit.reload();
        await settle(kit, 300);
        const b = { st: (await stateJson(kit)).replace(VOLATILE, ''), text: await pageText(kit), con: await consoleNow(kit), m: await kit.session.metrics(), scr: await screenOf(kit) };
        await page.screenshot({ path: `${kit.prefix}-${name}-after.png`, fullPage: true });
        let stateDiff = 'identical';
        if (a.st !== b.st) {
          const ja = JSON.parse(a.st);
          const jb = JSON.parse(b.st);
          const keys = [...new Set([...Object.keys(ja), ...Object.keys(jb)])].filter((k) => JSON.stringify(ja[k]) !== JSON.stringify(jb[k]));
          stateDiff = `DIFFERS in ${keys.map((k) => `${k} (${JSON.stringify(ja[k]).slice(0, 80)} → ${JSON.stringify(jb[k]).slice(0, 80)})`).join('; ')}`;
        }
        const lost = addedLines(b.text, a.text);
        const gained = addedLines(a.text, b.text);
        out.push(`**${name}** at ${mmss(kit.t)} — tasks ${fmtN(a.m.tasks)} → ${fmtN(b.m.tasks)}, funds ${money(a.m.funds)} → ${money(b.m.funds)}, GPUs ${a.m.gpus} → ${b.m.gpus}; state ${stateDiff}; screen ${lost.length || gained.length ? `DIFFERS — lines only before: ${lost.map((l) => `"${l}"`).join(' / ') || '—'}; only after: ${gained.map((l) => `"${l}"`).join(' / ') || '—'}` : 'identical, line for line'}; console ${JSON.stringify(a.con) === JSON.stringify(b.con) ? 'identical' : `before ${a.con.map((c) => `"${c}"`).join(' / ')} → after ${b.con.map((c) => `"${c}"`).join(' / ') || '(empty)'}`}${a.scr.modal ? `; modal "${a.scr.modal.title}" ${a.scr.modal.timer || ''} → ${b.scr.modal ? `"${b.scr.modal.title}" ${b.scr.modal.timer || ''}` : 'GONE'}` : ''}.`);
      };
      // 1. one second in: three clicks, nothing else on screen yet
      await page.evaluate(() => window.__critic.mashAdvance('btn-task', 3, 250, 'tick'));
      await check('1-three-clicks-in');
      // 2. the tick the first GPU is rented
      await playUntil(kit, pol, 120, async (s) => (s.m.gpus || 0) >= 1);
      await check('2-first-gpu-just-rented');
      // 3. the power meter has just appeared
      await playUntil(kit, pol, 120, async (s) => (await screenOf(kit)).power.meter != null && s.t >= 0);
      await check('3-power-meter-new');
      // 4. Buy Power has just appeared
      await playUntil(kit, pol, 240, async (s) => s.buttons.some((b) => b.k === 'btn-buyPower'));
      await check('4-buy-power-new');
      // 5. Research panel has just appeared (Trust unspent)
      await playUntil(kit, pol, 400, async (s) => s.panels.some((p) => p.l === 'Research'));
      await check('5-research-new-trust-unspent');
      // 6. mid-training
      await playUntil(kit, pol, 1500, async (s) => s.m.trainingPhase === 'training');
      await kit.run(10);
      await check('6-mid-training');
      // 7. mid-evaluation
      await playUntil(kit, pol, 300, async (s) => s.m.trainingPhase === 'evaluating');
      await kit.session.advance(1500);
      await check('7-mid-evaluation');
      // 8. red-team cool-down (if any issue is open)
      const rt = await playUntil(kit, pol, 300, async (s) => s.m.trainingPhase === 'redteam');
      if (rt && (rt.m.issuesOpen ?? 0) > 0) {
        await kit.click('btn-redteam', 1, 'redteam');
        await kit.session.advance(1000);
        await check('8-redteam-cooldown');
      } else out.push('**8-redteam-cooldown** — the first evaluation had no open issue; skipped.');
      // 9. a timed modal open
      const mo = await playUntil(kit, pol, 1500, async (s) => !!s.modal);
      if (mo) {
        await kit.session.advance(3000);
        await check('9-modal-open');
        await kit.run(4, kit.with(pol));
      } else out.push('**9-modal-open** — no modal within 25 minutes.');
      // 10. First Datacenter affordable, then half a second after buying it
      const dc = await playUntil(kit, pol, 3000, async () => {
        const scr = await screenOf(kit);
        return !!(scr.dc && scr.dc.e);
      });
      if (!dc) return void out.push('First Datacenter never became affordable within 50 more minutes.');
      await check('10-datacenter-affordable');
      await kit.click('proj-p_datacenter', 1, 'gate');
      await kit.session.advance(500);
      await check('11-half-a-second-after-the-purchase');
      const t0 = kit.t;
      const end = await kit.run(30);
      out.push('', 'Next 30 s after that last reload (nothing clicked):', ...kit.linesBetween(t0, kit.t, ['console', 'log']).map((l) => `- ${l}`), '', 'On screen:', ...kit.screen(end, { lines: 5 }).map((l) => `- ${l}`));
      await page.screenshot({ path: `${kit.prefix}-12-arrival-30s.png`, fullPage: true });
    },
  },
  'idle-new': {
    title: 'Idle 10 minutes on a brand-new game (nothing clicked)',
    async run(kit, out) {
      const end = await kit.run(600);
      await kit.shot('10min');
      const ev = kit.linesBetween(0, kit.t);
      out.push('Nothing clicked for 600 s. Everything that appeared:', ...(ev.length ? ev.map((l) => `- ${l}`) : ['- (nothing)']), ...kit.revealsBetween(0, kit.t).map((l) => `- reveal ${l}`), '', `At 10:00 — tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)}, idle rescues ${end.m.idleRescues}:`, ...kit.screen(end).map((l) => `- ${l}`), '', 'Whole screen:', '```', ...(await pageText(kit)), '```');
    },
  },
  'idle-one-click': {
    title: 'Click Complete Task once, then idle 10 minutes',
    async run(kit, out) {
      await kit.click('btn-task', 1, 'click');
      const end = await kit.run(600);
      await kit.shot('10min');
      const ev = kit.linesBetween(0, kit.t);
      out.push('One click, then nothing for 600 s. Everything that appeared:', ...(ev.length ? ev.map((l) => `- ${l}`) : ['- (nothing)']), ...kit.revealsBetween(0, kit.t).map((l) => `- reveal ${l}`), '', `At 10:00 — tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)}, idle rescues ${end.m.idleRescues}:`, ...kit.screen(end).map((l) => `- ${l}`), '', 'Whole screen:', '```', ...(await pageText(kit)), '```');
    },
  },
  'idle-after-gpu': {
    title: 'Rent one GPU, then walk away for 20 minutes',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      await playUntil(kit, pol, 120, async (s) => (s.m.gpus || 0) >= 1);
      kit.mashKey = null;
      const t0 = kit.t;
      const a = (await kit.snap()).m;
      out.push(`At ${mmss(t0)}: ${a.gpus} GPU, funds ${money(a.funds)}, tasks ${fmtN(a.tasks)}. Nothing is clicked from here.`, '');
      const seenModals = [];
      let lastTitle = null;
      const watch = async (t, sn) => {
        if (sn.modal && sn.modal.title !== lastTitle) {
          const sc2 = await screenOf(kit);
          seenModals.push(`- ${mmss(t)} **${sc2.modal.title}** [${sc2.modal.timer || 'no timer'}] (researchers ${sn.m.researchers}, funds ${money(sn.m.funds)}, Trust ${sn.m.trust}): "${sc2.modal.text}" — ${sc2.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (grey)' : ''}`).join(' / ')}`);
          if (seenModals.length <= 6) await kit.session.page.screenshot({ path: `${kit.prefix}-modal${seenModals.length}.png`, fullPage: false });
        }
        lastTitle = sn.modal ? sn.modal.title : null;
        return undefined;
      };
      for (const mark of [60, 300, 600, 900, 1200]) {
        const s = await kit.run(t0 + mark - kit.t, watch);
        const scr = await screenOf(kit);
        out.push(`**+${mark / 60} min** — tasks ${fmtN(s.m.tasks)}, funds ${money(s.m.funds)}, power ${fmtN(s.m.power)} kWh (meter ${scr.power.meter ?? '—'} ${scr.power.note ?? ''}), unsold ${fmtN(s.m.backlog)}, Trust ${s.m.trust}, rescues ${s.m.idleRescues}; billing "${scr.notes.billing ?? ''}"${scr.modal ? `; event open "${scr.modal.title}" ${scr.modal.timer || '(no timer)'}` : ''}; enabled: ${s.buttons.filter((b) => b.e && !b.a).map((b) => b.l).join('; ') || '—'}; grey: ${s.buttons.filter((b) => !b.e).map((b) => b.l).join('; ') || '—'}.`);
      }
      await kit.shot('20min');
      out.push('', 'Events that opened while away (none answered):', ...seenModals);
      out.push('', 'Everything that appeared while away:', ...kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`), ...kit.revealsBetween(t0, kit.t).map((l) => `- reveal ${l}`), '', 'Whole screen at the end:', '```', ...(await pageText(kit)), '```');
    },
  },
  'idle-bridge': {
    title: 'Click once, do nothing until the first calendar event (A Bridge Round, 8:50), take the money, then play as the first-timer',
    async run(kit, out) {
      await kit.click('btn-task', 1, 'click');
      let hit = null;
      await kit.run(900, async (t, s) => {
        if (s.modal) {
          hit = s;
          return 'stop';
        }
        return undefined;
      });
      if (!hit) return void out.push('No event within 15 minutes of idling.');
      const scr = await screenOf(kit);
      await settle(kit);
      await kit.session.page.screenshot({ path: `${kit.prefix}-event.png`, fullPage: true });
      out.push(`At ${mmss(kit.t)} with ${fmtN(hit.m.tasks)} task(s) and ${money(hit.m.funds)}: **${scr.modal.title}** [${scr.modal.timer}] — "${scr.modal.text}" — ${scr.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (grey)' : ''}`).join(' / ')}. Panels on screen: ${hit.panels.map((p) => p.l).join(', ') || 'none'}.`);
      const take = scr.modal.options.find((o) => /take the bridge/.test(o.label) && !o.disabled);
      if (!take) return void out.push('The bridge option is not enabled.');
      await kit.click(take.id, 1, 'modal');
      const after = await kit.snap();
      await settle(kit);
      await kit.session.page.screenshot({ path: `${kit.prefix}-after.png`, fullPage: true });
      out.push(`After "take the bridge": funds ${money(after.m.funds)}, Trust ${after.m.trust}; on screen: ${kit.screen(after).join(' · ')}`);
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const t0 = kit.t;
      let end = null;
      const f = async (t, s) => {
        if (s.m.stage > 1) {
          end = t;
          return 'stop';
        }
        if ((t - t0) % 60 === 0) out.push(`- ${mmss(t)} (+${(t - t0) / 60} min): funds ${money(s.m.funds)}, ${s.m.gpus} GPUs, tasks ${fmtN(s.m.tasks)}, rev ${money(s.m.revPerSec)}/s, researchers ${s.m.researchers}, runs ${s.m.trainings}, panels ${s.panels.map((p) => p.l).join(', ')}`);
        await pol.pass(t);
        return undefined;
      };
      f.policy = pol;
      await kit.run(2700, f);
      out.push('', end != null ? `Stage 1 ended at ${mmss(end)} — ${mmss(end - t0)} after the bridge.` : `Stage 1 had not ended ${mmss(kit.t - t0)} after the bridge.`, '', 'Console lines in the first two minutes after the bridge:', ...kit.linesBetween(t0, t0 + 120, ['console']).map((l) => `- ${l}`));
    },
  },
  'idle-mid': {
    title: 'Play 10 minutes, walk away for 10 minutes, come back',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const a = await kit.run(600, kit.with(pol));
      kit.mashKey = null;
      const t0 = kit.t;
      const scrA = await screenOf(kit);
      const b = await kit.run(600);
      await kit.shot('after-10min-away');
      const scrB = await screenOf(kit);
      out.push(`At ${mmss(t0)} (walking away): funds ${money(a.m.funds)}, ${a.m.gpus} GPUs, power ${fmtN(a.m.power)} kWh (grid ${a.m.gridAuto ? 'ON' : 'off'}), research ${fmtN(a.m.research)}, trust ${a.m.trust}, training "${a.m.trainingPhase || 'idle'}", billing "${scrA.notes.billing ?? scrA.notes.billing2}".`, '', 'While away (600 s, nothing clicked):', ...kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`), '', `At ${mmss(kit.t)} (back): funds ${money(b.m.funds)}, ${b.m.gpus} GPUs, power ${fmtN(b.m.power)} kWh, unsold ${fmtN(b.m.backlog)}, research ${fmtN(b.m.research)}, trust ${b.m.trust}, training "${b.m.trainingPhase || 'idle'}", idle rescues ${b.m.idleRescues}, billing "${scrB.notes.billing ?? scrB.notes.billing2}"${scrB.modal ? `, modal open "${scrB.modal.title}" ${scrB.modal.timer || ''}` : ''}.`, '', 'On screen:', ...kit.screen(b, { lines: 5 }).map((l) => `- ${l}`));
      const t1 = kit.t;
      const c = await kit.run(300, kit.with(pol));
      out.push('', `After 5 more minutes of normal play: funds ${money(c.m.funds)}, rev ${money(c.m.revPerSec)}/s, ${c.m.gpus} GPUs, trust ${c.m.trust}.`, ...kit.linesBetween(t1 + 1, t1 + 60, ['console']).map((l) => `- ${l}`));
    },
  },
  'event-keys': {
    title: 'An event is open: real mouse on the page behind it, Tab, Escape, and what Escape answers',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const { page } = kit.session;
      for (let n = 1; n <= 2; n++) {
        const hit = await playUntil(kit, pol, 1800, async (s) => !!s.modal);
        if (!hit) return void out.push('No event within 30 minutes.');
        await settle(kit, 500);
        const scr = await screenOf(kit);
        const geo = await page.evaluate(() => {
          const ov = document.getElementById('modalOverlay');
          const m = document.getElementById('modal');
          const r = m.getBoundingClientRect();
          const cs = getComputedStyle(ov);
          const task = document.getElementById('btn-task').getBoundingClientRect();
          const el = document.elementFromPoint(task.x + task.width / 2, task.y + task.height / 2);
          return { box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], overlay: { pos: cs.position, pe: cs.pointerEvents, bg: cs.backgroundColor }, top: el ? el.id || el.tagName : null, focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null, vw: window.innerWidth, vh: window.innerHeight };
        });
        await page.screenshot({ path: `${kit.prefix}-${n}.png`, fullPage: false });
        // Keyboard first (focus is where the game put it), then the mouse on the page behind.
        const foc = [];
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab');
          foc.push(await page.evaluate(() => (document.activeElement ? document.activeElement.id || document.activeElement.tagName : null)));
        }
        const before = await kit.session.metrics();
        const box = await page.locator('#btn-task').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const after = await kit.session.metrics();
        // what is under the event panel, and can it be clicked?
        const under = await page.evaluate(() => {
          const r = document.getElementById('modal').getBoundingClientRect();
          const vis = (el) => el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          return [...document.querySelectorAll('button')]
            .filter((b) => vis(b) && !b.closest('#modal') && !b.closest('#dev'))
            .filter((b) => {
              const q = b.getBoundingClientRect();
              const cx = q.x + q.width / 2;
              const cy = q.y + q.height / 2;
              return cx > r.left && cx < r.right && cy > r.top && cy < r.bottom;
            })
            .map((b) => b.innerText.replace(/\s+/g, ' ').trim().slice(0, 50));
        });
        const choicesBefore = (await kit.session.metrics()).choices;
        await page.keyboard.press('Escape');
        const scr2 = await screenOf(kit);
        const m2 = await kit.session.metrics();
        const con = await consoleNow(kit);
        out.push(`**Event ${n} at ${mmss(kit.t)}: "${scr.modal.title}"** ${scr.modal.timer ? `[${scr.modal.timer}]` : '(no timer)'} — options ${scr.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (grey)' : ''}`).join(' / ')}`, `- panel box ${geo.box.join(', ')} in ${geo.vw}×${geo.vh}; overlay ${JSON.stringify(geo.overlay)}; element on top of Complete Task: ${geo.top}; keyboard focus when it opened: ${geo.focus}.`, `- real mouse click on Complete Task behind it: ${after.tasks > before.tasks ? `went through (tasks ${fmtN(before.tasks)} → ${fmtN(after.tasks)})` : 'blocked'}.`, `- Tab ×5 from where the game put the focus → ${foc.join(' → ')}.`, `- buttons covered by the event panel (centre under it): ${under.length ? under.map((u) => `"${u}"`).join(', ') : 'none'}.`, `- Escape: ${scr2.modal ? 'event stays open' : 'event closed'}; choices answered ${choicesBefore} → ${m2.choices}; newest console lines: ${con.slice(-2).map((c) => `"${c}"`).join(' / ')}.`, '');
        await kit.run(4, kit.with(pol));
      }
    },
  },
  'price-ends': {
    title: 'The price lever at its ends: the floor and 200 raises, from the moment the price buttons appear',
    async run(kit0, out) {
      await kit0.close();
      for (const dir of ['lower', 'raise']) {
        const kit = await openProbe(base, { gameDir: kit0.gameDir, seed: kit0.seedN, prefix: kit0.prefix });
        try {
          kit.mashKey = 'btn-task';
          const pol = kit.policy({ lower: null, raise: null });
          const hit = await playUntil(kit, pol, 400, async (s) => s.buttons.some((b) => b.k === 'btn-lowerPrice'));
          if (!hit) {
            out.push(`No price buttons within 400 s (${dir}).`);
            continue;
          }
          const t0 = kit.t;
          const a = await screenOf(kit);
          const m0 = await kit.session.metrics();
          const key = dir === 'lower' ? 'btn-lowerPrice' : 'btn-raisePrice';
          const n = await kit.click(key, 200, dir);
          const b = await screenOf(kit);
          const dis = await kit.session.page.evaluate((k) => document.getElementById(k).disabled, key);
          out.push(`## ${dir} ×200 at ${mmss(t0)}`, '', `Before: price $${fmtN(m0.price, 2)}, "${a.notes.billing}", hint "${a.notes.priceHint}". ${dir} accepted ${n}× → price ${await kit.session.page.evaluate(() => document.getElementById('price').innerText)}; ${dir} button now ${dis ? 'disabled' : 'still enabled'}; billing line "${b.notes.billing}"; hint "${b.notes.priceHint}".`);
          let revSum = 0;
          const end = await kit.run(300, async (t, s) => {
            revSum += (s.m.revPerSec || 0) * 2;
            await pol.pass(t);
          });
          const c = await screenOf(kit);
          await kit.shot(`${dir}-5min`);
          out.push(`After 5 minutes at that price (buying whatever is affordable, price never touched): tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)} (was ${money(m0.funds)}), GPUs ${end.m.gpus}, unsold ${fmtN(end.m.backlog)}, displayed revenue ${money(end.m.revPerSec)}/s (Σ displayed ${money(revSum)}), idle rescues ${end.m.idleRescues}; billing line "${c.notes.billing}"${c.modal ? `; modal "${c.modal.title}": ${c.modal.text}` : ''}.`, '', 'Lines:', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`), '', 'On screen:', ...kit.screen(end).map((l) => `- ${l}`));
          // the way back
          const back = await kit.click(dir === 'lower' ? 'btn-raisePrice' : 'btn-lowerPrice', 400, 'back');
          out.push('', `The way back: ${back} clicks on the other button were accepted (price now ${await kit.session.page.evaluate(() => document.getElementById('price').innerText)}).`, '');
        } finally {
          await kit.close();
        }
      }
    },
  },
  'trust-floor': {
    title: 'Can Trust go below zero, and what do the Trust lines say when the award is already owed?',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      let low = null;
      const seen = [];
      const f = async (t, s) => {
        if (s.m.stage > 1) return 'stop';
        if (s.m.trust < 0 && !low) {
          low = { t, trust: s.m.trust };
          await kit.shot('negative');
        }
        if (/Trust \+1/.test(s.console) && s.m.trust <= 0) seen.push(`${mmss(t)} "${s.console}" with "${await kit.session.page.evaluate(() => (document.getElementById('trust').parentElement.innerText || '').split('\n')[0])}" on screen`);
        await pol.pass(t);
        return undefined;
      };
      f.policy = pol;
      await kit.run(2400, f);
      const txt = await kit.session.page.evaluate(() => document.getElementById('panel-research').innerText.replace(/\s*\n\s*/g, ' / '));
      out.push(low ? `Trust first below zero at ${mmss(low.t)}: ${low.trust}.` : 'The state\'s Trust never went below zero in the stage (first-timer, first option of every event).', `"Trust +1" lines printed while the counter showed 0 or less: ${seen.length ? seen.slice(0, 8).join('; ') : 'none'}.`, `Research panel at the end: "${txt}"`);
    },
  },
  'focus-row': {
    title: 'The Focus row: what it says for each focus, what only a tooltip says, and what a click during a run changes',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const read = () =>
        kit.session.page.evaluate(() => {
          const g = (id) => {
            const el = document.getElementById(id);
            return el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? el.innerText.replace(/\s+/g, ' ').trim() : null;
          };
          const b = (id) => {
            const el = document.getElementById(id);
            return el ? { text: el.innerText.replace(/\s+/g, ' ').trim(), sel: el.classList.contains('selected'), title: el.title } : null;
          };
          return { row: g('focusRow'), note: g('focusNote'), cap: b('btn-focus-capability'), eff: b('btn-focus-efficiency'), safe: b('btn-focus-safety'), run: g('train-running') };
        });
      const hit = await playUntil(kit, pol, 1500, async (s) => s.buttons.some((b) => b.k === 'btn-focus-capability'));
      if (!hit) return void out.push('No Focus row within 25 minutes.');
      const a = await read();
      out.push(`Focus row first on screen at ${mmss(kit.t)}: "${a.row}".`, `- tooltips: Capability "${a.cap.title}" / Efficiency "${a.eff.title}" / Safety "${a.safe.title}"`);
      for (const k of ['btn-focus-efficiency', 'btn-focus-safety', 'btn-focus-capability']) {
        await kit.click(k, 1, 'focus');
        const r = await read();
        out.push(`- after pressing ${k.replace('btn-focus-', '')}: the row reads "${r.row}"`);
      }
      await settle(kit, 500);
      await kit.session.page.screenshot({ path: `${kit.prefix}.png`, fullPage: false });
      const run = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'training');
      if (!run) return void out.push('No second training run within 15 more minutes.');
      await kit.run(6);
      const st0 = await kit.session.page.evaluate(() => JSON.stringify(window.__game.state.training.run));
      const n = await kit.click('btn-focus-safety', 1, 'focus');
      const st1 = await kit.session.page.evaluate(() => JSON.stringify(window.__game.state.training.run));
      const b = await read();
      out.push('', `During a run (${mmss(kit.t)}), pressing Safety: ${n ? 'click accepted' : 'not clickable'}; the run in progress ${st0 === st1 ? 'is unchanged' : 'CHANGED'}; the row now reads "${b.row}" while the run line reads "${b.run}".`);
    },
  },
  'gate-walk': {
    title: 'The hard gate, walked through by hand: a player with 10 GPUs meets a run that needs more — what the row says, what unblocks it, and what the wall (a run the cloud cannot train) looks like',
    async run(kit, out) {
      const { page } = kit.session;
      kit.mashKey = 'btn-task';
      // Frugal: stop renting at 10 GPUs.
      const pol = kit.policy({ veto: (c) => [...baseVeto(c), ...((c.m.gpus || 0) >= 10 ? ['btn-gpu'] : [])] });
      const row = async () => {
        const s = await screenOf(kit);
        return `${s.train.btn ? `[${s.train.btn.l}${s.train.btn.e ? '' : ' (grey)'}]` : '(no Train button)'} Cost: ${s.train.cost} · ${s.train.meter ?? ''} ${s.train.gpus ?? ''} · ${s.train.reason ?? ''}`;
      };
      const short = async () => /Rent\s+[0-9,]+\s+more|rented\./.test((await screenOf(kit)).train.gpus || '');
      const hit = await playUntil(kit, pol, 3600, short);
      if (!hit) {
        out.push(`A player who stops at 10 GPUs never saw the Train row ask for more GPUs in 60 minutes. Row at the end: ${await row()}`);
        return;
      }
      const m = await kit.session.metrics();
      const scr = await screenOf(kit);
      await settle(kit);
      await page.screenshot({ path: `${kit.prefix}-blocked.png`, fullPage: true });
      out.push(`**Blocked at ${mmss(kit.t)}** with ${m.gpus} GPUs, funds ${money(m.funds)}, research ${fmtN(m.research)}: ${await row()}`, `- Train button tooltip: "${scr.train.btn ? scr.train.btn.title : ''}"; disabled attribute: ${scr.train.btn ? !scr.train.btn.e : '—'}.`, `- Rent GPU: ${scr.rent.btn ? (scr.rent.btn.e ? 'enabled' : 'grey') : 'not on screen'}, Cost: ${scr.rent.cost}, note "${scr.rent.note ?? ''}", meter ${scr.rent.meter ?? '(none)'}; "GPUs rented ${scr.rent.shown}" (quota in the page: ${scr.rent.quota}).`, `- console: ${(await consoleNow(kit)).map((c) => `"${c}"`).join(' / ')}`);
      // Rent one at a time and read the row after each.
      const steps = [];
      for (let i = 0; i < 40; i++) {
        if (!(await short())) break;
        const c = await kit.session.controls();
        const g = c.buttons.find((b) => b.k === 'btn-gpu');
        if (!g || !g.e) {
          await kit.run(2, kit.with(pol));
          continue;
        }
        await kit.click('btn-gpu', 1, 'rent');
        steps.push(`${(await kit.session.metrics()).gpus} GPUs → ${await row()}`);
      }
      out.push('', 'Renting one GPU at a time (waiting for funds between clicks):', ...steps.slice(0, 3).map((s) => `- ${s}`), steps.length > 6 ? `- … ${steps.length - 6} more …` : '', ...steps.slice(-3).map((s) => `- ${s}`));
      await settle(kit);
      await page.screenshot({ path: `${kit.prefix}-unblocked.png`, fullPage: true });
      out.push('', `After ${steps.length} rentals at ${mmss(kit.t)}: ${await row()}`);
    },
  },
  wall: {
    title: 'The wall: the first run the cloud cannot train (needs more GPUs than the quota) — what the row, the Compute panel, the console and the card say, for a player who rents to the quota and trains at once',
    async run(kit, out) {
      const { page } = kit.session;
      kit.mashKey = 'btn-task';
      const pol = kit.policy({ special: trainFirstSpecial, drip: [], goal: [], goalRule: null, veto: vetoCards(/First Datacenter/) });
      let wall = null;
      let quotaHit = null;
      const seen = new Map();
      const f = async (t, s) => {
        const scr = await screenOf(kit);
        const g = scr.train.gpus || '';
        const k = g.replace(/[0-9][0-9,]*/g, '#');
        if (g && !seen.has(k)) seen.set(k, { t, g, r: scr.train.reason, rent: scr.rent, dc: scr.dc, con: await consoleNow(kit) });
        if (!quotaHit && scr.rent.btn && !scr.rent.btn.e && s.m.gpus >= Number(scr.rent.quota || 1e9)) {
          quotaHit = { t, rent: scr.rent, compute: await page.evaluate(() => document.getElementById('panel-compute').innerText.replace(/\s*\n\s*/g, ' / ')), con: await consoleNow(kit) };
          await settle(kit);
          await page.screenshot({ path: `${kit.prefix}-quota.png`, fullPage: true });
        }
        const need = /Needs\s+([0-9,]+)\s+GPUs/.exec(g);
        if (!wall && need && Number(need[1].replace(/,/g, '')) > Number(scr.rent.quota || 1e9)) {
          wall = { t, g, r: scr.train.reason, scr, con: await consoleNow(kit), text: await pageText(kit) };
          await settle(kit);
          await page.screenshot({ path: `${kit.prefix}-wall.png`, fullPage: true });
        }
        if (wall && t >= wall.t + 240) return 'stop';
        await pol.pass(t);
        return undefined;
      };
      f.policy = pol;
      await kit.run(3600, f);
      out.push('Every distinct GPU sentence the Train row showed (first time each):', ...[...seen.values()].map((v) => `- ${mmss(v.t)} "${v.g}" / "${v.r ?? ''}" — Rent GPU ${v.rent.btn ? (v.rent.btn.e ? 'enabled' : 'grey') : 'absent'} at ${v.rent.cost}${v.rent.note ? ` "${v.rent.note}"` : ''}; First Datacenter ${v.dc ? `"${v.dc.l}" (${v.dc.e ? 'affordable' : 'grey'})` : 'not on screen'}`));
      if (quotaHit) out.push('', `**Quota reached at ${mmss(quotaHit.t)}**: Compute panel reads "${quotaHit.compute}"; console ${quotaHit.con.map((c) => `"${c}"`).join(' / ')}.`);
      else out.push('', 'The quota was never reached.');
      if (wall) {
        out.push('', `**The wall at ${mmss(wall.t)}**: Train row "${wall.g}" / "${wall.r ?? ''}"; Train button ${wall.scr.train.btn ? (wall.scr.train.btn.e ? 'ENABLED' : 'grey') : 'absent'}; Rent GPU ${wall.scr.rent.btn ? (wall.scr.rent.btn.e ? 'enabled' : 'grey') : 'absent'} "${wall.scr.rent.note ?? ''}"; First Datacenter ${wall.scr.dc ? `"${wall.scr.dc.l}" (${wall.scr.dc.e ? 'affordable' : 'grey'}; classes ${wall.scr.dc.cls})` : 'NOT ON SCREEN'}; console ${wall.con.map((c) => `"${c}"`).join(' / ')}.`, '', 'Console and Developments lines in the 4 minutes after the wall (First Datacenter is never bought in this probe):', ...kit.linesBetween(wall.t, kit.t, ['console', 'log', 'modal']).map((l) => `- ${l}`), '', 'Whole screen at the wall:', '```', ...wall.text, '```');
        const endScr = await screenOf(kit);
        const endS = await kit.snap();
        out.push('', `4 minutes later (${mmss(kit.t)}): funds ${money(endS.m.funds)}; Train row "${endScr.train.gpus}" / "${endScr.train.reason ?? ''}"; enabled purchases: ${endS.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal').map((b) => b.l).join('; ') || '—'}; grey: ${endS.buttons.filter((b) => !b.e).map((b) => b.l).join('; ')}.`);
        await settle(kit);
        await page.screenshot({ path: `${kit.prefix}-wall-plus4min.png`, fullPage: true });
      } else out.push('', 'No run needed more GPUs than the quota within 60 minutes.');
    },
  },
};

async function runProbe(name, flags) {
  const pr = PROBES[name];
  const adapter = pr.game === 'paperclips' ? pc : base;
  const prefix = resolvePrefix(labelFor(name, flags, null) + (flags.seed && Number(flags.seed) !== 1 ? `-seed${flags.seed}` : ''));
  const gameDir = resolveGameDir(adapter, pr.game === 'paperclips' ? undefined : flags.gameDir);
  const out = [];
  let kit;
  try {
    kit = await openProbe(adapter, { gameDir, seed: Number(flags.seed ?? 1), prefix, viewport: pr.viewport, stage: 1 });
    kit.gameDir = gameDir;
    kit.seedN = Number(flags.seed ?? 1);
    await pr.run(kit, out, flags);
    console.log(`${name}: ok`);
  } catch (e) {
    out.push(`probe failed: ${String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`);
    console.log(`${name}: FAILED ${e.message}`);
  } finally {
    if (kit) {
      if (kit.session.errors.length) out.push('', `Page errors: ${kit.session.errors.slice(0, 5).join(' | ')}`);
      await kit.close().catch(() => {});
    }
  }
  fs.writeFileSync(`${prefix}.md`, [`# Explore probe (s1r3): ${name} — ${pr.title}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, seed ${flags.seed ?? 1}, stepped. Times are game time.`, '', ...out, ''].join('\n'));
}

// ------------------------------------------------------------------------------------------ main
const { pos, flags } = parseArgs(process.argv.slice(2), ['modal-shots', 'modalShots', 'gate-shots', 'gateShots']);
const which = pos[0];
if (!which || which === 'list') {
  console.log('runs:   ' + Object.keys(RUNS).join(', '));
  console.log('probes: ' + Object.keys(PROBES).join(', '));
  console.log('other:  table [name…] [--seeds 1,2,3] [--out LABEL], gate <label>…, gate-table <name>…, measures <label>…, hands <label>…, says <name>…');
  process.exit(which ? 0 : 2);
}
if (which === 'table') tableCmd(pos.slice(1), flags);
else if (which === 'gate-table') gateTableCmd(pos.slice(1), flags);
else if (which === 'measures') measuresCmd(pos.slice(1));
else if (which === 'hands') handsCmd(pos.slice(1));
else if (which === 'says') saysCmd(pos.slice(1), flags);
else if (which === 'gate') {
  const md = [];
  for (const l of pos.slice(1)) {
    const g = gateReport(l);
    md.push(typeof g === 'string' ? g : g.md, '');
  }
  console.log(md.join('\n'));
  if (flags.out) fs.writeFileSync(`${resolvePrefix(flags.out)}.md`, `# Training under the hard gate\n\n${md.join('\n')}\n`);
} else {
  const names = which === 'all-runs' ? Object.keys(RUNS) : which === 'all-probes' ? Object.keys(PROBES) : which.split(',');
  for (const n of names) {
    if (RUNS[n]) for (const seed of seedsOf(flags)) await runVariant(n, flags, seed);
    else if (PROBES[n]) await runProbe(n, flags);
    else console.error(`unknown scenario "${n}"`);
  }
}
