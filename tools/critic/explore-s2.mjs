#!/usr/bin/env node
// Stage 2 exploratory play styles and probes for Takeoff ("a player who does the unexpected with
// Stage 2's systems"), added by the Stage 2 round-1 critic. explore.mjs stays as it was (its runs
// and probes were written for Stage 1); this file reuses the same libraries and output layout.
//
// Usage: node tools/critic/explore-s2.mjs <name[,name…]|list|all-runs|all-probes|all-paperclips|table> --game-dir DIR
//          [--seed N | --seeds 1,2,3] [--minutes MIN] [--tag T] [--shots 600,1200]
//   RUNS    the whole of Stage 2 (from __game.loadPreset(2)) played by the first-timer policy with ONE
//           thing changed. Output: a normal run <tag>-<name>[-seedN].* (analyze/compare/decisions work
//           on it) plus .explore.md (a metrics row per minute, every modal with its printed effect
//           lines, on-screen notes each time they change, how long each greyed-button reason stood,
//           every console/log line), .end.json (the meters on screen and in the state at the last
//           Stage 2 snapshot, or at the cap), .modals.json, .cards.json, .end.png.
//   PROBES  short scripted situations (idle, reloads, slider, 390 px), each writing <tag>-<name>.md.
//   table   `explore-s2.mjs table [--tag T] [name,name…]` prints the play-style table from the .end.json files.
//   --tag T output label prefix (default "s2x").
import fs from 'node:fs';
import path from 'node:path';
import { runGame, resolveGameDir, loadFixture } from './lib/runner.mjs';
import { openProbe } from './lib/probe.mjs';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN, mdTable, readJson, writeJson, OUT_DIR } from './lib/util.mjs';
import { INFRA, KEEP_INTERNAL, PLANT_KEYS_RE, trainStep } from './games/takeoff-late.mjs';

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
const variant = (over) => ({ ...base, policy: { ...BP, ...over } });
const MOBILE = { width: 390, height: 844 };
const find = (c, k) => c.buttons.find((b) => b.k === k);
const labelFor = (name, flags, seed) => `${flags.tag ?? 's2x'}-${name}${seed && Number(seed) !== 1 ? `-seed${seed}` : ''}`;

/** Everything the player can read (and the hidden state behind it) that the 2-s snapshot does not keep. */
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
  const words = ((bodyText.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length) - ((devText.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length);
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  return {
    notes: {
      gpuReason: txt('gpuReason'),
      dcReason: txt('dcReason'),
      gasReason: txt('gasReason'),
      solarReason: txt('solarReason'),
      nuclearReason: txt('nuclearReason'),
      interconnect: txt('interconnectLine'),
      trainReason: txt('trainReason'),
      trainShort: txt('trainShort'),
      releaseNote: txt('releaseNote'),
      allocPct: txt('allocPct'),
      alignShare: txt('btn-alignShare'),
      hype: txt('hypeLine'),
      rival: txt('rivalStanding'),
      nextTier: txt('nextTier'),
      leadLine: txt('leadLine'),
      gov: txt('govLine'),
      approval: txt('approvalLine'),
      security: txt('securityNote'),
      auto: txt('btn-autoPrice'),
      standing: txt('btn-standing'),
      shareEvals: txt('btn-shareEvals'),
      jobFund: txt('btn-jobFund'),
      evalLine: txt('evalLine'),
      statAlignment: txt('statAlignment'),
      statLead: txt('statLead'),
    },
    // not change-logged (they move every second)
    live: {
      model: txt('modelName'),
      capability: txt('capability'),
      trainCost: `${txt('trainCost') || ''}${txt('trainData') || ''}`,
      trainCompute: txt('trainComputeLine'),
      billing: txt('billingLine2') || txt('billingLine'),
      marketingCost: txt('marketingCost'),
      humanShare: txt('humanShare'),
      jobs: txt('jobsDisplaced'),
      statCopies: txt('statCopies'),
      statSpeed: txt('statSpeed'),
      statRunRate: txt('statRunRate'),
      stores: txt('panel-stores'),
      date: txt('gameDate'),
    },
    st: {
      stage: s.stage,
      capability: n(s.capability),
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
      alloc: n(s.researchAlloc),
      alignShare: n(s.alignShare),
      autoPrice: !!s.autoPrice,
      standing: !!s.standingOrder,
      shareEvals: !!s.shareEvals,
      jobFund: !!s.jobFund,
      autonomy: n(s.autonomy),
      jobs: n(s.jobsDisplaced),
      trust: n(s.trust),
      incidents: n(s.stats.incidents),
      releases: n(s.stats.releases),
      trainings: n(s.stats.trainings),
      research: n(s.research),
      insight: n(s.insight),
      tasks: n(s.tasks),
      rev: n(s.stats.revPerSec),
      rate: n(s.stats.tasksPerSec),
      timeInStage: n(s.stats.timeInStage),
      date: n(s.date),
      hype: n(s.hypeLevel),
      price: n(s.price),
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

/** Latest READ result of the running scenario (set at each snapshot, before the policy pass at that t). */
let SCREEN = null;

// --------------------------------------------------------------------------------- policy pieces
const plants = (c) => c.buttons.filter((b) => b.kind === 'button' && PLANT_KEYS_RE.test(b.l));
const mwOf = (b) => Number(/\+([0-9][0-9,]*)\s*MW/.exec(b.l)[1].replace(/,/g, ''));

/**
 * takeoff-late.mjs's infraStep with switches: { lots, plants, dcs } false = that kind is never bought;
 * plantsAlways = a plant whenever one is enabled (the "buys only power" player).
 */
async function infra(ctx, f = {}) {
  for (let i = 0; i < 3; i++) {
    const c = ctx.controls;
    const m = c.m;
    const lot = find(c, INFRA.lot);
    if (!lot) return;
    const why = lot.why || '';
    let need = null;
    if (lot.e) need = 'gpus';
    else if (/no power/i.test(why)) need = 'power';
    else if (/no room/i.test(why)) need = 'room';
    else if (/standing order/i.test(why) && m.gpuCapacity > 0 && m.powerCapMW > 0) need = m.gpusShown / m.gpuCapacity >= m.powerDrawMW / m.powerCapMW ? 'room' : 'power';
    if (f.plantsAlways) need = 'power';
    if (!need) return;
    if ((need === 'gpus' && f.lots === false) || (need === 'power' && f.plants === false) || (need === 'room' && f.dcs === false)) return;
    const before = ctx.controls;
    if (need === 'gpus') {
      await ctx.click(INFRA.lot, 'infra', `GPU lot (${lot.l})`);
    } else if (need === 'room') {
      const dc = find(c, INFRA.datacenter);
      if (!(dc && dc.e) || ctx.noop.has(INFRA.datacenter)) return;
      await ctx.click(INFRA.datacenter, 'infra', why === 'no room' ? 'GPU lot says "no room"' : 'standing order on; room nearer full than power');
    } else {
      const options = plants(c).filter((b) => b.e && !ctx.noop.has(b.k) && (b.funds || 0) > 0);
      if (!options.length) return;
      const best = options.reduce((x, y) => (y.funds / mwOf(y) < x.funds / mwOf(x) ? y : x));
      await ctx.click(best.k, 'infra', `${f.plantsAlways ? 'a plant whenever one is enabled' : why === 'no power' ? 'GPU lot says "no power"' : 'standing order on; power nearer full than room'}: ${best.l}`);
    }
    if (ctx.controls === before) return;
  }
}

/**
 * The first-timer's Stage 2 steps (games/takeoff.mjs special) with switches:
 *   train false         never presses Train
 *   redteam 'never'     releases the moment Release works, whatever is open
 *   release 'internal'  presses "Keep internal" instead of Release whenever it is on screen
 *   infra {…}           see infra()
 *   pre / post          extra steps before / after
 */
function special(o = {}) {
  return async function s2special(ctx) {
    if (o.pre) await o.pre(ctx);
    if (o.train !== false) await trainStep(ctx);
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
    if (o.post) await o.post(ctx);
    return ctx.controls;
  };
}

const vetoProjects = (re) => (c) => [...(BP.veto ? BP.veto(c) : []), ...c.buttons.filter((b) => b.kind === 'project' && re.test(b.l)).map((b) => b.k)];

/** Printed-effect score of a modal option: gains minus losses/costs, as the option line shows them. */
function effectScore(label) {
  const gains = (label.match(/\+\s?[0-9$]|×\s?[0-9]|% off|for good|half price/g) || []).length;
  const losses = (label.match(/[−-]\s?[0-9]|waits|stops|lawsuit|\$\s?[0-9][0-9.,]*[MK]?$|[0-9,]+ research$|will remember|else [0-9]/g) || []).length;
  return gains - losses;
}
/** The careful / most-pluses answer and the reckless / most-minuses answer to each Stage 2 modal, by title. */
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
      // "best" waits for a greyed wanted option (the timer decides if it never becomes affordable).
      if (mode === 'best' && modal.options.some((o) => !o.e && wanted.some((re) => re.test(o.l)))) return null;
    }
    const full = SCREEN && SCREEN.modal && SCREEN.modal.title === modal.title ? SCREEN.modal.options : [];
    const scored = enabled.map((o) => ({ o, s: effectScore((full.find((f) => f.id === o.k) || {}).label || o.l) }));
    if (!scored.length) return null;
    const pick = scored.reduce((a, b) => (mode === 'best' ? (b.s > a.s ? b : a) : b.s < a.s ? b : a), scored[0]);
    if (!wanted) FALLBACKS.push({ t, title: modal.title, mode, picked: pick.o.l, scores: scored.map((x) => `${x.o.l}: ${x.s}`) });
    return pick.o;
  };
}
/** The meter-chaser: the enabled option whose printed line moves `word` up the most (ties: first). */
function byMeter(word) {
  const re = new RegExp(`${word} ([+−-])\\s?([0-9.]+)`);
  return (modal, enabled) => {
    const full = SCREEN && SCREEN.modal && SCREEN.modal.title === modal.title ? SCREEN.modal.options : [];
    const val = (o) => {
      const m = re.exec((full.find((f) => f.id === o.k) || {}).label || '');
      return m ? (m[1] === '+' ? 1 : -1) * Number(m[2]) : 0;
    };
    if (!enabled.length) return null;
    return enabled.reduce((a, b) => (val(b) > val(a) ? b : a), enabled[0]);
  };
}

/** Visible sliders (id, min, max, value). */
const sliders = (ctx) =>
  ctx.session.page.evaluate(() =>
    [...document.querySelectorAll('input[type=range]')]
      .filter((el) => el.id && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }))
      .map((el) => ({ sel: `#${el.id}`, min: el.min, max: el.max, v: el.value })),
  );
/** Drags every visible slider to one end the first time it is seen and never touches it again. */
const sliderTo = (end) => async (ctx) => {
  const mem = (ctx.memory.sliderTo ||= new Set());
  for (const sl of await sliders(ctx)) {
    if (mem.has(sl.sel)) continue;
    mem.add(sl.sel);
    await ctx.set(sl.sel, end === 'min' ? sl.min : sl.max, 'slider', `first sight: ${sl.v} → ${end} ${end === 'min' ? sl.min : sl.max}`);
  }
};
/** Switches off every setting that reads ON / AUTO, each time it is seen on. */
const settingsOff = async (ctx) => {
  for (const b of ctx.controls.buttons) {
    if (b.t && b.e && /^(ON|AUTO)$/.test(b.l) && !ctx.noop.has(b.k)) await ctx.click(b.k, 'setting', `switched off: "${b.l}"`);
  }
};
/** Switches on every toggle that reads OFF whose key matches `re`. */
const settingsOn = (re) => async (ctx) => {
  for (const b of ctx.controls.buttons) {
    if (b.t && b.e && /^OFF$/.test(b.l) && re.test(b.k) && !ctx.noop.has(b.k)) await ctx.click(b.k, 'setting', `switched on: ${b.k}`);
  }
};
/** "Alignment compute: N%" pressed until it shows the largest value of its cycle (found at first sight). */
const alignMax = async (ctx) => {
  const mem = (ctx.memory.align ||= { max: null, seq: [] });
  const pct = (c) => {
    const b = find(c, 'btn-alignShare');
    const m = b && /([0-9.]+)%/.exec(b.l);
    return m ? Number(m[1]) : null;
  };
  if (pct(ctx.controls) == null) return;
  if (mem.max == null) {
    const first = pct(ctx.controls);
    mem.seq.push(first);
    for (let i = 0; i < 12; i++) {
      await ctx.click('btn-alignShare', 'setting', 'alignment compute: looking at the cycle');
      const v = pct(ctx.controls);
      if (v === first || v == null) break;
      mem.seq.push(v);
    }
    mem.max = Math.max(...mem.seq);
  }
  for (let i = 0; i < 12 && pct(ctx.controls) !== mem.max; i++) await ctx.click('btn-alignShare', 'setting', `alignment compute → ${mem.max}% (cycle ${mem.seq.join(' → ')})`);
};
const seq = (...fns) => async (ctx) => {
  for (const f of fns) await f(ctx);
};
const focus = (key) => async (ctx) => {
  const b = find(ctx.controls, key);
  if (b && b.e && !ctx.noop.has(key)) await ctx.click(key, 'focus', key);
};

const DATA_AFTER_CRAWL = /License the code hosts|Synthetic data|Data flywheel/;
const RUNS = {
  baseline: { title: 'The unmodified first-timer (control)', adapter: variant({ special: special() }) },
  mobile: { title: 'The unmodified first-timer at a 390 × 844 viewport', adapter: variant({ special: special() }), viewport: MOBILE },
  // --- infrastructure
  'no-power': { title: 'Never buys a power plant', adapter: variant({ special: special({ infra: { plants: false } }) }) },
  'no-datacenter': { title: 'Never builds a second datacenter', adapter: variant({ special: special({ infra: { dcs: false } }) }) },
  'power-only': { title: 'Buys only power: a plant whenever one is enabled, never a GPU lot or a datacenter by hand', adapter: variant({ special: special({ infra: { plantsAlways: true, lots: false, dcs: false } }) }) },
  'no-standing': { title: 'Never buys the Standing order (GPU lots by hand throughout)', adapter: variant({ special: special(), veto: vetoProjects(/Standing order/) }) },
  // --- research
  'slider-min': { title: 'Drags the allocation slider to its minimum at first sight and leaves it', adapter: variant({ special: special({ post: sliderTo('min') }) }) },
  'slider-max': { title: 'Drags the allocation slider to its maximum at first sight and leaves it', adapter: variant({ special: special({ post: sliderTo('max') }) }) },
  'no-assistants': { title: 'Never buys AI research assistants', adapter: variant({ special: special(), veto: vetoProjects(/AI research assistants/) }) },
  'no-research': { title: 'Never spends Trust (no Hire Researcher, no Expand Lab)', adapter: variant({ special: special(), skip: [...BP.skip, 'btn-hireResearcher', 'btn-expandLab'] }) },
  'hire-only': { title: 'Every Trust on Hire Researcher, never Expand Lab', adapter: variant({ special: special(), skip: [...BP.skip, 'btn-expandLab'] }) },
  'expand-only': { title: 'Every Trust on Expand Lab, never Hire Researcher', adapter: variant({ special: special(), skip: [...BP.skip, 'btn-hireResearcher'] }) },
  // --- data
  'data-ignore': {
    title: 'Runs out of training data and ignores it: buys the Web crawl, then no other data source (no licence, no synthetic data, no flywheel; "write our own" to the publishers)',
    adapter: variant({ special: special(), veto: vetoProjects(DATA_AFTER_CRAWL), modalChoice: (modal, enabled) => (modal.title === 'The Publishers' ? enabled.find((o) => /write our own/.test(o.l)) || enabled[0] : enabled[0]) }),
  },
  'no-data': {
    title: 'Never buys any data source at all (not even the Web crawl)',
    adapter: variant({ special: special(), veto: vetoProjects(/Web crawl|License the code hosts|Synthetic data|Data flywheel/), modalChoice: (modal, enabled) => (modal.title === 'The Publishers' ? enabled.find((o) => /write our own/.test(o.l)) || enabled[0] : enabled[0]) }),
  },
  // --- training and release
  'keep-internal': {
    title: 'Keeps every model internal ("keep it internal" for Sage-2, then Keep internal instead of Release)',
    adapter: variant({ special: special({ release: 'internal' }), modalChoice: (modal, enabled) => enabled.find((o) => /keep it internal/.test(o.l)) || enabled[0] }),
  },
  'ship-open': {
    title: 'Ships every model the moment Release works, open issues or not; never red-teams',
    adapter: variant({ special: special({ redteam: 'never' }), modalChoice: (modal, enabled) => enabled.find((o) => /release anyway|ship/i.test(o.l) && !/red|wait|hold|back|not|keep/i.test(o.l)) || enabled[0] }),
  },
  'no-train': { title: 'Never trains a model', adapter: variant({ special: special({ train: false }), skip: [...BP.skip, 'btn-train'] }) },
  'focus-efficiency': { title: 'Always trains with Focus: Efficiency', adapter: variant({ special: special({ pre: focus('btn-focus-efficiency') }) }) },
  'focus-safety': { title: 'Always trains with Focus: Safety', adapter: variant({ special: special({ pre: focus('btn-focus-safety') }) }) },
  // --- events
  'modal-ignore': { title: 'Never answers an event (timed ones expire, untimed ones stay)', adapter: variant({ special: special(), modalChoice: () => null }) },
  'modal-timed-only': { title: 'Lets every timed event expire but answers the untimed ones (first option)', adapter: variant({ special: special(), modalChoice: (modal, enabled) => (SCREEN && SCREEN.modal && SCREEN.modal.title === modal.title && SCREEN.modal.timer ? null : enabled[0]) }) },
  'modal-last': { title: 'Answers every event with its last enabled option', adapter: variant({ special: special(), modalChoice: (modal, enabled) => enabled[enabled.length - 1] }) },
  'modal-worst': { title: 'Picks the worst-looking option of every event (most minuses printed on it; the reckless one)', adapter: variant({ special: special(), modalChoice: byTable(WORST, 'worst') }) },
  'modal-best': { title: 'Picks the best-looking option of every event (most pluses printed on it; the careful one); waits for a greyed one', adapter: variant({ special: special(), modalChoice: byTable(BEST, 'best') }) },
  'modal-gov': { title: 'Picks the option that prints the largest government gain', adapter: variant({ special: special(), modalChoice: byMeter('government') }) },
  'modal-approval': { title: 'Picks the option that prints the largest approval gain', adapter: variant({ special: special(), modalChoice: byMeter('approval') }) },
  'modal-lead': { title: 'Picks the option that prints the largest lead gain', adapter: variant({ special: special(), modalChoice: byMeter('lead') }) },
  // --- settings
  'settings-off': { title: 'Switches every setting off whenever it reads ON/AUTO (AUTO pricing, Standing order …), slider to its minimum; the Stage 1 backlog rule then moves the price', adapter: variant({ special: special({ post: seq(settingsOff, sliderTo('min')) }) }) },
  'auto-off': { title: 'AUTO pricing switched off on arrival, price never touched', adapter: variant({ lower: null, raise: null, special: special({ post: async (ctx) => { const b = find(ctx.controls, 'btn-autoPrice'); if (b && b.e && /^AUTO$/.test(b.l)) await ctx.click('btn-autoPrice', 'setting', 'AUTO off'); } }) }) },
  'settings-on': { title: 'Switches on every toggle that starts OFF (Share evals, Job-transition fund) and sets Alignment compute to its maximum', adapter: variant({ special: special({ post: seq(settingsOn(/./), alignMax) }) }) },
  'share-evals': { title: 'Share evals with the Safety Institute: ON at first sight', adapter: variant({ special: special({ post: settingsOn(/shareEvals/) }) }) },
  'job-fund': { title: 'Job-transition fund: ON at first sight', adapter: variant({ special: special({ post: settingsOn(/jobFund/) }) }) },
  'align-max': { title: 'Alignment compute set to its maximum at first sight', adapter: variant({ special: special({ post: alignMax }) }) },
  'no-security': { title: 'Never buys a security level', adapter: variant({ special: special(), skip: [...BP.skip, 'btn-sl3'], veto: vetoProjects(/Security level/) }) },
};

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
  const reasonSeconds = {};
  const waitSeconds = {};
  let lastModalKey = null;
  let maxOverflow = 0;
  let nShots = 0;
  let endScreen = null;
  let endSnap = null;
  let peakNumbers = { n: 0, t: 0 };
  const fiveMin = [];
  FALLBACKS.length = 0;
  SCREEN = null;
  const shotAt = new Set((flags.shots ? String(flags.shots).split(',') : []).map(Number));
  const capSeconds = Number(flags.minutes ?? 90) * 60;
  const { meta, rec } = await runGame({
    game: 'takeoff',
    adapter: sc.adapter,
    prefix: label,
    gameDir: flags.gameDir,
    realtime: 0,
    accelMinutes: Number(flags.minutes ?? 90),
    seed: Number(seed ?? 1),
    stage: 2,
    viewport: sc.viewport,
    quiet: true,
    async onSnapshot({ t, raw, session }) {
      const scr = await session.page.evaluate(READ);
      SCREEN = scr;
      maxOverflow = Math.max(maxOverflow, scr.overflowX);
      if (scr.st.stage === 2) {
        endScreen = { t, ...scr };
        endSnap = raw;
        for (const k of ['trainReason', 'gpuReason']) {
          const v = scr.notes[k];
          if (v) {
            const key = `${k}: ${v.replace(/[0-9][0-9,.:]*/g, '#')}`;
            reasonSeconds[key] = (reasonSeconds[key] || 0) + 2;
          }
        }
        // What the training pipeline is doing or waiting for at this check.
        {
          const phase = raw.m.trainingPhase || '';
          let key = phase ? `run in progress: ${phase}` : 'idle';
          if (!phase) {
            const tr = raw.buttons.find((b) => b.k === 'btn-train');
            if (!tr) key = 'no Train button';
            else if (tr.e) key = 'Train enabled';
            else {
              const cost = scr.live.trainCost || '';
              const mny = /\$\s?([0-9][0-9,.]*)\s?([KMB])?/.exec(cost);
              const fundsNeed = mny ? parseFloat(mny[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[mny[2]] || 1) : 0;
              const rs = /([0-9][0-9,]*) research/.exec(cost);
              const dt = /([0-9.]+) T data/.exec(cost);
              const short = [];
              if (fundsNeed > scr.st.funds) short.push('funds');
              if (rs && Number(rs[1].replace(/,/g, '')) > scr.st.research) short.push('research');
              if (dt && Number(dt[1]) > scr.st.data + 1e-9) short.push('data');
              const reason = (scr.notes.trainReason || '').replace(/[0-9][0-9,.:]*/g, '#');
              key = `Train greyed, short of ${short.length ? short.join(' + ') : reason ? `nothing priced ("${reason}")` : 'nothing priced (no reason shown)'}`;
            }
          }
          waitSeconds[key] = (waitSeconds[key] || 0) + 2;
        }
        if (raw.numbers > peakNumbers.n) peakNumbers = { n: raw.numbers, t };
        if (t % 300 === 0) fiveMin.push({ t, numbers: raw.numbers, controls: raw.buttons.length + raw.sliders.length, panels: raw.panels.length, words: scr.words });
      }
      for (const [k, v] of Object.entries(scr.notes)) {
        if (v !== lastNote[k]) {
          if (v && !/^(trainReason|interconnect)$/.test(k)) noteLog.push({ t, k, v });
          else if (v && (lastNote[k] || '').replace(/[0-9][0-9,.:]*/g, '#') !== v.replace(/[0-9][0-9,.:]*/g, '#')) noteLog.push({ t, k, v });
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
      if (t % 60 === 0) minutes.push({ t, ...scr.st, numbers: raw.numbers, buttons: raw.buttons.length, panels: raw.panels.length, words: scr.words, pageHeight: scr.pageHeight, m: raw.m, trainReason: scr.notes.trainReason, gpuReason: scr.notes.gpuReason, model: scr.live.model });
      if (shotAt.has(t)) await session.page.screenshot({ path: `${prefix}.view${t}.png`, fullPage: true }).catch(() => {});
      // A run that never leaves Stage 2: the screen at the cap.
      if (t === capSeconds && scr.st.stage === 2) await session.page.screenshot({ path: `${prefix}.cap.png`, fullPage: true }).catch(() => {});
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
    grey: endSnap ? endSnap.buttons.filter((b) => !b.e && b.kind !== 'modal').map((b) => `${b.l}${b.why ? ` [${b.why}]` : ''}`) : [],
    enabled: endSnap ? endSnap.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l) : [],
    panels: endSnap ? endSnap.panels.map((p) => p.l) : [],
    modalOpen: endSnap && endSnap.modal ? endSnap.modal.title : null,
    console: rec.events.filter((e) => e.type === 'console').slice(-6).map((e) => `${mmss(e.t)} ${e.text}`),
    actions: byWhy,
    models,
    modalAnswers: rec.actions.filter((a) => a.why === 'modal').map((a) => `${mmss(a.t)} ${a.detail}`),
    modalsSeen: modals.map((m) => `${mmss(m.t)} ${m.title}`),
    reasonSeconds,
    waitSeconds,
    peakNumbers,
    fiveMin,
    maxOverflow,
    pageErrors: meta.pageErrors,
    fallbacks: [...FALLBACKS],
  };
  writeJson(`${prefix}.end.json`, end);
  writeJson(`${prefix}.modals.json`, modals);
  writeJson(`${prefix}.cards.json`, [...cardsSeen.values()]);
  const md = [`# Stage 2 explore run: ${name} — ${sc.title}`, '', `Stage 2 start (preset 2), seed ${meta.seed}, stepped, cap ${meta.accelMinutes} min. **Stage end: ${meta.stageEnd != null ? mmss(meta.stageEnd) : `not reached by ${mmss(meta.endT)}`}**. Page errors: ${meta.pageErrors.length}${meta.pageErrors.length ? ` (${meta.pageErrors[0]})` : ''}. Largest horizontal overflow: ${maxOverflow} px. Peak numbers on screen: ${peakNumbers.n} at ${mmss(peakNumbers.t)}.`, ''];
  md.push('## Per minute', '', '| t | model | cap × | rival × | lead | gov | approval | align (shown / true) | funds | rev/s | tasks/s | price | GPUs / room | power MW | research | trust | researchers | data T | alloc | runs | releases | incidents | numbers | controls | panels | words | page px | Train reason | GPU-lot reason |', `|${'---|'.repeat(29)}`);
  for (const m of minutes) md.push(`| ${mmss(m.t)} | ${m.model ?? ''} | ${fmtN(m.capability, 2)} | ${fmtN(m.rival, 2)} | ${fmtN(m.lead, 2)} | ${fmtN(m.gov, 0)} | ${fmtN(m.approval, 0)} | ${fmtN(m.alignA, 0)} / ${fmtN(m.alignT, 0)} | ${money(m.funds)} | ${money(m.rev)} | ${fmtN(m.rate, 0)} | $${fmtN(m.price, 3)} | ${fmtN(m.m.gpusShown)} / ${fmtN(m.m.gpuCapacity)} | ${fmtN(m.m.powerDrawMW, 0)} / ${fmtN(m.m.powerCapMW)} | ${fmtN(m.research)} | ${m.trust} | ${m.researchers} | ${fmtN(m.data, 1)} | ${fmtN((m.alloc || 0) * 100)}% | ${m.trainings} | ${m.releases} | ${m.incidents} | ${m.numbers} | ${m.buttons} | ${m.panels} | ${m.words} | ${m.pageHeight} | ${m.trainReason ?? ''} | ${m.gpuReason ?? ''} |`);
  md.push('', '## Models', '', ...models.map((m) => `- ${mmss(m.t)} ${m.model} — ${m.rival ?? ''}`));
  md.push('', '## End state', '', '```', JSON.stringify({ stageEnd: end.stageEnd, atT: end.atT, st: end.st, notes: end.notes, live: end.live, grey: end.grey, enabled: end.enabled, modalOpen: end.modalOpen, console: end.console }, null, 1), '```');
  md.push('', '## Seconds each greyed-button reason stood (Train, GPU lot)', '', ...Object.entries(reasonSeconds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} s — ${k}`));
  md.push('', '## What the training pipeline was doing, seconds (2-s checks)', '', ...Object.entries(waitSeconds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} s — ${k}`));
  md.push('', '## Events (first sight of each)', '');
  for (const m of modals) md.push(`- **${mmss(m.t)} — ${m.title}** ${m.timer ? `[${m.timer}] ` : '(no timer) '}(funds ${money(m.m.funds)}, trust ${m.m.trust})`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`));
  md.push('', '## Event answers', '', ...end.modalAnswers.map((a) => `- ${a}`));
  if (FALLBACKS.length) md.push('', '## Events answered by the printed-effect score (not in the table)', '', ...FALLBACKS.map((f) => `- ${mmss(f.t)} ${f.title}: ${f.picked} (${f.scores.join('; ')})`));
  md.push('', '## Actions', '', ...Object.entries(byWhy).map(([k, v]) => `- ${k}: ${v}`));
  md.push('', '## Settings pressed', '', ...rec.actions.filter((a) => a.why === 'setting' || a.why === 'slider' || a.why === 'focus').map((a) => `- ${mmss(a.t)} ${a.label || a.key}: ${a.detail}`));
  md.push('', '## Project cards at first sight', '', '| t | card text | classes | tooltip | clipped |', '|---|---|---|---|---|', ...[...cardsSeen.values()].map((c) => `| ${mmss(c.t)} | ${c.text.replace(/\|/g, '/')} | ${c.cls} | ${c.title} | ${c.everClipped ? 'YES' : ''} |`));
  md.push('', '## On-screen notes, each time they changed', '', ...noteLog.map((n) => `- ${mmss(n.t)} ${n.k}: ${n.v}`));
  md.push('', '## Console and Developments lines', '', ...lines.map((l) => `- ${l}`), '');
  fs.writeFileSync(`${prefix}.explore.md`, md.join('\n'));
  console.log(`${label}: stage end ${meta.stageEnd != null ? mmss(meta.stageEnd) : `NOT REACHED by ${mmss(meta.endT)}`} · cap ${fmtN(es.st.capability, 2)}× · gov ${fmtN(es.st.gov, 0)} · approval ${fmtN(es.st.approval, 0)} · lead ${fmtN(es.st.lead, 2)} · align ${fmtN(es.st.alignA, 0)}/${fmtN(es.st.alignT, 0)} · funds ${money(es.st.funds)} · events ${modals.length} · overflow ${maxOverflow} px · errors ${meta.pageErrors.length}`);
  return end;
}

// ---------------------------------------------------------------------------------------- PROBES
const screenOf = (kit) => kit.session.page.evaluate(READ);
const stateJson = (kit) => kit.session.page.evaluate(() => JSON.stringify(window.__game.state));
const consoleNow = (kit) => kit.session.page.evaluate(() => ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => document.getElementById(id).textContent.trim()).filter(Boolean));
/** Keys whose values differ between two JSON states (top level, plus one level into objects). */
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
const meters = (scr) => `capability ${scr.live.capability}× (${scr.notes.rival}), "${scr.notes.leadLine ?? '—'}", government "${scr.notes.gov ?? '—'}", "${scr.notes.approval ?? '—'}", stores "${scr.live.stores}"`;
async function playUntil(kit, pol, seconds, cond) {
  let hit = null;
  await kit.run(seconds, async (t, s) => {
    if (await cond(s, t)) {
      hit = s;
      return 'stop';
    }
    await pol.pass(t);
    return undefined;
  });
  return hit;
}
async function reloadReport(kit, out, what) {
  const a = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.shot(`${what}-before`);
  await kit.reload();
  const b = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.shot(`${what}-after`);
  const diff = stateDiff(a.st, b.st);
  const noteDiff = Object.keys(a.scr.notes).filter((k) => a.scr.notes[k] !== b.scr.notes[k]).map((k) => `${k}: "${a.scr.notes[k]}" → "${b.scr.notes[k]}"`);
  const liveDiff = Object.keys(a.scr.live).filter((k) => a.scr.live[k] !== b.scr.live[k]).map((k) => `${k}: "${a.scr.live[k]}" → "${b.scr.live[k]}"`);
  out.push(`**${what}** at ${mmss(kit.t)}: ${meters(a.scr)}.`, `- before: modal ${a.scr.modal ? `"${a.scr.modal.title}" ${a.scr.modal.timer ? `[${a.scr.modal.timer}]` : '(no timer)'}` : 'none'}; interconnect "${a.scr.notes.interconnect ?? ''}"; train "${a.scr.notes.trainReason ?? ''}"; console ${a.con.map((c) => `"${c}"`).join(' / ')}`, `- after:  modal ${b.scr.modal ? `"${b.scr.modal.title}" ${b.scr.modal.timer ? `[${b.scr.modal.timer}]` : '(no timer)'}` : 'none'}; interconnect "${b.scr.notes.interconnect ?? ''}"; train "${b.scr.notes.trainReason ?? ''}"; console ${b.con.map((c) => `"${c}"`).join(' / ') || '(empty)'}`, `- state keys that differ after the reload: ${diff.length ? diff.slice(0, 12).join('; ') : 'none (the saved state is identical)'}`, `- on-screen notes that differ: ${noteDiff.length ? noteDiff.join('; ') : 'none'}; live readouts that differ: ${liveDiff.length ? liveDiff.join('; ') : 'none'}; cards ${a.scr.cards.length} → ${b.scr.cards.length}; panels page height ${a.scr.pageHeight} → ${b.scr.pageHeight}`, '');
}

const PROBES = {
  'idle-start': {
    title: 'Nothing clicked for 10 minutes from the first second of Stage 2',
    async run(kit, out) {
      const a = await screenOf(kit);
      const end = await kit.run(600);
      await kit.shot('idle-start-10min');
      const b = await screenOf(kit);
      out.push(`At 0:00: ${meters(a)}.`, '', 'Everything that appeared in 600 s with no input:', ...kit.linesBetween(0, kit.t).map((l) => `- ${l}`), ...kit.revealsBetween(0, kit.t).map((l) => `- reveal ${l}`), '', `At 10:00: ${meters(b)}; modal ${b.modal ? `"${b.modal.title}" ${b.modal.timer || '(no timer)'}` : 'none'}; idle rescues ${end.m.idleRescues}.`, '', 'On screen:', ...kit.screen(end, { lines: 5 }).map((l) => `- ${l}`));
      const pol = kit.policy({ special: special() });
      const t0 = kit.t;
      const c = await kit.run(300, kit.with(pol));
      const d = await screenOf(kit);
      out.push('', `After 5 minutes of normal play on return (to ${mmss(kit.t)}): ${meters(d)}; rev ${money(c.m.revPerSec)}/s.`, ...kit.linesBetween(t0 + 1, t0 + 40, ['console']).map((l) => `- ${l}`));
    },
  },
  'idle-mid': {
    title: 'Play 12 minutes, walk away for 10, come back',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      const a = await kit.run(720, kit.with(pol));
      const sa = await screenOf(kit);
      const t0 = kit.t;
      const b = await kit.run(600);
      await kit.shot('idle-mid-after-10min-away');
      const sb = await screenOf(kit);
      out.push(`At ${mmss(t0)} (walking away): ${meters(sa)}; training "${a.m.trainingPhase || 'idle'}"; rev ${money(a.m.revPerSec)}/s; Train: "${sa.notes.trainReason ?? 'enabled or running'}"; GPU lot: "${sa.notes.gpuReason ?? ''}"; standing order ${sa.notes.standing ?? 'not on screen'}.`, '', 'While away (600 s, nothing clicked):', ...kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`), '', `At ${mmss(kit.t)} (back): ${meters(sb)}; training "${b.m.trainingPhase || 'idle'}"; rev ${money(b.m.revPerSec)}/s; modal ${sb.modal ? `"${sb.modal.title}" ${sb.modal.timer || '(no timer)'}` : 'none'}; idle rescues ${b.m.idleRescues}.`, '', 'On screen:', ...kit.screen(b, { lines: 5 }).map((l) => `- ${l}`));
      const t1 = kit.t;
      const c = await kit.run(300, kit.with(pol));
      const sc = await screenOf(kit);
      out.push('', `After 5 more minutes of normal play (to ${mmss(kit.t)}): ${meters(sc)}; rev ${money(c.m.revPerSec)}/s.`, ...kit.linesBetween(t1 + 1, t1 + 60, ['console']).map((l) => `- ${l}`));
    },
  },
  'reload-mid-run': {
    title: 'Reload at 12:00 of ordinary play, and again during a training run',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      await kit.run(720, kit.with(pol));
      await reloadReport(kit, out, 'reload-mid-run');
      const hit = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'training');
      if (hit) {
        await kit.session.advance(2000);
        await reloadReport(kit, out, 'reload-mid-training');
      } else out.push('No training run within 15 more minutes.');
      const hit2 = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'evaluating');
      if (hit2) await reloadReport(kit, out, 'reload-mid-evaluation');
    },
  },
  'reload-mid-queue': {
    title: 'Reload while a plant waits in the interconnect queue (and during a datacenter build, if one shows)',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      const hit = await playUntil(kit, pol, 2400, async () => !!(await screenOf(kit)).notes.interconnect);
      if (!hit) return void out.push('The interconnect line never showed anything within 40 minutes.');
      await reloadReport(kit, out, 'reload-mid-queue');
      const t0 = kit.t;
      await kit.run(240, kit.with(pol));
      out.push('Next 240 s:', ...kit.linesBetween(t0, kit.t, ['console']).map((l) => `- ${l}`));
    },
  },
  'reload-mid-event': {
    title: 'Reload with an event open: the first untimed one and the first timed one',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      for (const want of ['untimed', 'timed']) {
        const hit = await playUntil(kit, pol, 1800, async (s) => {
          if (!s.modal) return false;
          const scr = await screenOf(kit);
          return !!scr.modal && (want === 'timed' ? !!scr.modal.timer : !scr.modal.timer);
        });
        if (!hit) {
          out.push(`No ${want} event within 30 minutes.`);
          continue;
        }
        await reloadReport(kit, out, `reload-mid-event-${want}`);
        await kit.run(6);
        const c = await screenOf(kit);
        out.push(`- 6 s later, unanswered: ${c.modal ? `"${c.modal.title}" ${c.modal.timer ? `[${c.modal.timer}]` : '(no timer)'}` : 'event gone'}.`, '');
        await kit.run(4, kit.with(pol));
      }
    },
  },
  'slider-ends': {
    title: 'The allocation slider at each end: what the screen shows 30 s later',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      const hit = await playUntil(kit, pol, 1500, async () => (await sliders({ session: kit.session })).length > 0);
      if (!hit) return void out.push('No slider within 25 minutes.');
      // let the purchase that revealed it settle
      await kit.run(20, kit.with(pol));
      const read = async () => {
        const scr = await screenOf(kit);
        const st = await kit.session.page.evaluate(() => {
          const s = window.__game.state;
          return { research: s.research, rate: s.stats.tasksPerSec, rev: s.stats.revPerSec, alloc: s.researchAlloc };
        });
        const tip = await kit.session.page.evaluate(() => ({ sliderTitle: document.getElementById('allocSlider').title, blockTitle: document.getElementById('allocBlock').title, human: document.getElementById('humanShareLine').title }));
        return { scr, st, tip };
      };
      const measure = async (label) => {
        const a = await read();
        await kit.run(30);
        const b = await read();
        out.push(`- **${label}** (${mmss(kit.t - 30)} → ${mmss(kit.t)}): slider reads "${b.scr.notes.allocPct}", "Human share of research: ${b.scr.live.humanShare}"; research ${fmtN(a.st.research)} → ${fmtN(b.st.research)} (${fmtN((b.st.research - a.st.research) / 30)}/s while not at the cap); tasks/s ${fmtN(b.st.rate)}; rev ${money(b.st.rev)}/s; billing "${b.scr.live.billing}"; stores "${b.scr.live.stores}".`);
        return b;
      };
      const first = await read();
      out.push(`Slider first on screen at about ${mmss(kit.t - 20)}; tooltips: slider "${first.tip.sliderTitle}", block "${first.tip.blockTitle}", human-share line "${first.tip.human}". No training run is started during the measurement; nothing else is clicked.`, '');
      await measure('as found');
      for (const end of ['min', 'max']) {
        const sl = (await sliders({ session: kit.session }))[0];
        await kit.session.setValue(sl.sel, end === 'min' ? sl.min : sl.max);
        await measure(`dragged to ${end} (${end === 'min' ? sl.min : sl.max})`);
        await kit.shot(`slider-${end}`);
      }
      out.push('', 'Console lines during the probe:', ...kit.linesBetween(kit.t - 95, kit.t, ['console']).map((l) => `- ${l}`));
    },
  },
  'mobile-shots': {
    title: '390 × 844 viewport through Stage 2: what is above the fold, how far the page scrolls, whether events fit',
    viewport: MOBILE,
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      const { page } = kit.session;
      const where = () =>
        page.evaluate(() => {
          const vis = (el) => el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const ids = ['consoleDiv', 'tasksHeader', 'panel-log', 'btn-task', 'panel-stores', 'panel-business', 'panel-infrastructure', 'panel-research', 'panel-projects', 'panel-training', 'panel-graph', 'panel-security', 'panel-government', 'panel-public', 'panel-stats', 'btn-train', 'allocSlider'];
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
          maxOver = Math.max(maxOver, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
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
  'event-keys': {
    title: 'With an event open: a real mouse click behind it, Tab, Escape (timed and untimed)',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      const { page } = kit.session;
      for (const want of ['untimed', 'timed']) {
        const hit = await playUntil(kit, pol, 1800, async (s) => {
          if (!s.modal) return false;
          const scr = await screenOf(kit);
          return !!scr.modal && (want === 'timed' ? !!scr.modal.timer : !scr.modal.timer);
        });
        if (!hit) {
          out.push(`No ${want} event within 30 minutes.`);
          continue;
        }
        const scr = await screenOf(kit);
        await kit.shot(`event-keys-${want}`);
        const active = () => page.evaluate(() => (document.activeElement ? document.activeElement.id || document.activeElement.tagName : null));
        const f0 = await active();
        await page.keyboard.press('Tab');
        const f1 = await active();
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
          return { overlay: { position: cs.position, pe: cs.pointerEvents, bg: cs.backgroundColor }, modal: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, vw: window.innerWidth, vh: window.innerHeight };
        });
        await page.keyboard.press('Escape');
        const afterEsc = await screenOf(kit);
        out.push(`**${want} event at ${mmss(kit.t)}: "${scr.modal.title}"** ${scr.modal.timer ? `[${scr.modal.timer}]` : '(no timer)'} — options ${scr.modal.options.map((o) => `"${o.label}"${o.disabled ? ' (greyed)' : ''}`).join(' / ')}`, `- focus when it opened: ${f0}; real mouse click on Complete Task behind it: ${mouse}; overlay ${JSON.stringify(geo.overlay)}; box ${geo.modal.w}×${geo.modal.h} at (${geo.modal.x}, ${geo.modal.y}) in ${geo.vw}×${geo.vh}.`, `- Tab, Tab (before the mouse click) → focus on ${f1}, then ${f2}.`, `- Escape: ${afterEsc.modal ? 'the event stays open' : 'the event closed'}; console ${(await consoleNow(kit)).slice(-2).map((c) => `"${c}"`).join(' / ')}.`, '');
        if (afterEsc.modal) await kit.run(4, kit.with(pol));
      }
    },
  },
  'untimed-open': {
    title: 'An untimed event left open: what else stops? (the first untimed event, never answered, 20 minutes)',
    async run(kit, out) {
      const never = kit.policy({ special: special(), modalChoice: () => null });
      const hit = await playUntil(kit, never, 1800, async (s) => {
        if (!s.modal) return false;
        const scr = await screenOf(kit);
        return !!scr.modal && !scr.modal.timer;
      });
      if (!hit) return void out.push('No untimed event within 30 minutes.');
      const a = await screenOf(kit);
      const t0 = kit.t;
      const ma = await kit.session.metrics();
      const queue0 = await kit.session.page.evaluate(() => (window.__game.state.choiceQueue || []).length);
      const end = await kit.run(1200, kit.with(never));
      await kit.shot('untimed-open-20min');
      const b = await screenOf(kit);
      const mb = await kit.session.metrics();
      const queue1 = await kit.session.page.evaluate(() => (window.__game.state.choiceQueue || []).map((q) => q.id || q));
      out.push(`"${a.modal.title}" opened at ${mmss(t0)} (no timer): ${a.modal.options.map((o) => `"${o.label}"`).join(' / ')}. It is left open; the player keeps doing everything else.`, `- at ${mmss(t0)}: ${meters(a)}; training "${ma.trainingPhase}"; date "${a.live.date}"; events waiting behind it: ${queue0}.`, `- at ${mmss(kit.t)}: ${meters(b)}; training "${mb.trainingPhase}"; date "${b.live.date}"; event still open: ${b.modal ? `"${b.modal.title}"` : 'no'}; events waiting behind it: ${JSON.stringify(queue1)}; trainings ${ma.trainings} → ${mb.trainings}; releases ${ma.releases} → ${mb.releases}.`, '', 'Console lines in those 20 minutes that mention the event, a release or waiting:', ...kit.linesBetween(t0, kit.t, ['console']).filter((l) => /wait|release|decid|answer|Sage-2|pending|event/i.test(l)).map((l) => `- ${l}`), '', 'On screen at the end:', ...kit.screen(end, { lines: 5 }).map((l) => `- ${l}`));
    },
  },
  exit: {
    title: 'The Stage 2 → 3 change, held: the gate card is left un-clicked for 30 s once it is ready, then clicked',
    async run(kit, out) {
      const gateRe = /Let Sage-3 write the code/;
      const hold = kit.policy({ special: special(), veto: vetoProjects(gateRe) });
      // the card as first shown (pinned, greyed)
      let firstSeen = null;
      const hit = await playUntil(kit, hold, 4800, async (s, t) => {
        const b = s.buttons.find((x) => gateRe.test(x.l));
        if (b && !firstSeen) {
          const scr = await screenOf(kit);
          firstSeen = { t, card: scr.cards.find((c) => gateRe.test(c.text)), cap: scr.live.capability, nextTier: scr.notes.nextTier };
        }
        return !!(b && b.e);
      });
      if (!hit) return void out.push('The gate card never became ready within 80 minutes.');
      const key = hit.buttons.find((b) => gateRe.test(b.l)).k;
      const a = await screenOf(kit);
      const ma = await kit.session.metrics();
      await kit.shot('exit-ready');
      const card = a.cards.find((c) => gateRe.test(c.text));
      out.push(`Gate card first on screen at ${mmss(firstSeen.t)} (model at ${firstSeen.cap}×, "${firstSeen.nextTier}"): "${firstSeen.card.text}" [classes: ${firstSeen.card.cls || '—'}; tooltip: "${firstSeen.card.title}"].`, `Ready at ${mmss(kit.t)}: "${card.text}" [classes: ${card.cls || '—'}]. ${meters(a)}; "Alignment (as measured): ${a.notes.statAlignment}", "Lead over Baiwen: ${a.notes.statLead}"; rev ${money(ma.revPerSec)}/s; numbers on screen ${hit.numbers}, buttons ${hit.buttons.length}, panels ${hit.panels.map((p) => p.l).join(', ')}.`, `Console: ${(await consoleNow(kit)).map((c) => `"${c}"`).join(' / ')}`, '');
      const t0 = kit.t;
      await kit.run(30, kit.with(hold));
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
      const mc = await kit.session.metrics();
      out.push('Next 30 s (nothing clicked):', ...kit.linesBetween(t1, kit.t, ['console', 'log']).map((l) => `- ${l}`), '', `Before: ${meters(b)}; gov "${b.notes.gov}", approval "${b.notes.approval}", "${b.notes.leadLine}", alignment shown ${b.notes.statAlignment}; billing "${b.live.billing}"; numbers ${sb.numbers}, buttons ${sb.buttons.length}, panels ${sb.panels.length}.`, `After 30 s: ${meters(c)}; gov "${c.notes.gov}", approval "${c.notes.approval}", "${c.notes.leadLine}", alignment shown ${c.notes.statAlignment}; billing "${c.live.billing}"; rev ${money(mc.revPerSec)}/s; numbers ${end.numbers}, buttons ${end.buttons.length}, panels ${end.panels.map((p) => p.l).join(', ')}.`, '', 'On screen after 30 s:', ...kit.screen(end, { lines: 5 }).map((l) => `- ${l}`), '', `Cards on screen after: ${c.cards.map((x) => `"${x.text}"`).join(' | ') || 'none'}`);
    },
  },
  'idle-rescue': {
    title: 'Nothing clicked from the first second: the event that opens for the idle player, answered, three times over',
    async run(kit, out) {
      let n = 0;
      await kit.run(1200, async (t, s) => {
        if (!s.modal) return undefined;
        const scr = await screenOf(kit);
        const m = await kit.session.metrics();
        if (n === 0) await kit.shot('idle-rescue');
        n++;
        const before = m.funds;
        await kit.click(s.modal.options[0].k, 1, 'answer');
        const after = (await kit.session.metrics()).funds;
        out.push(`- **${mmss(t)} — ${scr.modal.title}** ${scr.modal.timer ? `[${scr.modal.timer}]` : '(no timer)'}: "${scr.modal.text}" — options ${scr.modal.options.map((o) => `"${o.label}"`).join(' / ')}. The player holds ${money(m.funds)} (rev ${money(m.revPerSec)}/s), ${s.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal').length} purchases are enabled behind it, idle rescues so far ${m.idleRescues}. Answered "${s.modal.options[0].l}": funds ${money(before)} → ${money(after)}.`);
        return n >= 3 ? 'stop' : undefined;
      });
      if (!n) out.push('No event opened in 20 idle minutes.');
      out.push('', 'Lines about it:', ...kit.linesBetween(0, kit.t, ['console']).filter((l) => /Prepayment|case study|Customer/i.test(l)).map((l) => `- ${l}`));
    },
  },
  hover: {
    title: 'At 20:10: what the Stores rows show on hover, and every tooltip a newcomer can only reach by hovering',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      await kit.run(1210, kit.with(pol));
      const { page } = kit.session;
      for (const sel of ['#row-funds', '#row-research', '#row-insight', '#row-trust', '#row-gpus', '#row-power', '#row-copies', '#row-data']) {
        const el = page.locator(sel).first();
        if (!(await el.count())) continue;
        await el.hover({ force: true }).catch(() => {});
        await new Promise((r) => setTimeout(r, 100));
        const tip = await page.evaluate(() => {
          window.__game.render();
          const t = document.getElementById('storeTip');
          return t && t.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? t.innerText.replace(/\s*\n\s*/g, ' / ') : null;
        });
        const row = await page.evaluate((x) => document.querySelector(x).innerText.replace(/\s+/g, ' ').trim(), sel);
        out.push(`- row "${row}" → hover: "${tip ?? '(nothing)'}"`);
        if (sel === '#row-research') await page.screenshot({ path: `${kit.prefix}-research.png`, fullPage: false });
      }
      await page.mouse.move(2, 2);
      const titles = await page.evaluate(() => {
        const vis = (el) => el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
        const btn = [...document.querySelectorAll('button')].filter((b) => vis(b) && !b.closest('#dev')).map((b) => `- button "${b.innerText.replace(/\s+/g, ' ').slice(0, 60)}" → ${b.title ? `title "${b.title}"` : 'no tooltip'}`);
        const other = ['billPrice', 'approvalLine', 'evalLine', 'govLine', 'leadLine', 'nextTier', 'humanShareLine', 'allocSlider', 'allocBlock', 'trainComputeLine', 'rivalLine'].map((id) => {
          const el = document.getElementById(id);
          return el && vis(el) ? `- #${id} "${el.innerText.replace(/\s+/g, ' ').slice(0, 60)}" → ${el.title ? `title "${el.title.replace(/\n/g, ' / ')}"` : 'no tooltip'}` : null;
        }).filter(Boolean);
        return [...btn, ...other];
      });
      out.push('', 'Tooltips (title attributes) on what is visible:', ...titles);
    },
  },
  'auto-off-raise': {
    title: 'AUTO pricing off at 3:00, raise pressed 200×, two minutes; then AUTO back on',
    async run(kit, out) {
      const pol = kit.policy({ special: special() });
      await kit.run(180, kit.with(pol));
      const a = await screenOf(kit);
      const ma = await kit.session.metrics();
      await kit.click('btn-autoPrice', 1, 'auto-off');
      const n = await kit.click('btn-raisePrice', 200, 'raise');
      const b = await screenOf(kit);
      const hands = kit.policy({ special: special(), lower: null, raise: null });
      const t0 = kit.t;
      const end = await kit.run(120, kit.with(hands));
      const c = await screenOf(kit);
      await kit.shot('auto-off-raise');
      out.push(`At 3:00: "${a.live.billing}", rev ${money(ma.revPerSec)}/s, AUTO button "${a.notes.auto}".`, `AUTO off, raise accepted ${n}× → "${b.live.billing}" (button "${b.notes.auto}").`, `120 s later (price untouched): "${c.live.billing}", rev ${money(end.m.revPerSec)}/s, unbilled ${fmtN(end.m.backlog)}.`, ...kit.linesBetween(t0, kit.t, ['console']).map((l) => `- ${l}`));
      await kit.click('btn-autoPrice', 1, 'auto-on');
      const t1 = kit.t;
      const end2 = await kit.run(60, kit.with(pol));
      const d = await screenOf(kit);
      out.push('', `AUTO back on; 60 s later: "${d.live.billing}", rev ${money(end2.m.revPerSec)}/s.`, ...kit.linesBetween(t1, kit.t, ['console']).map((l) => `- ${l}`));
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
    await pr.run(kit, out);
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
  fs.writeFileSync(`${prefix}.md`, [`# Stage 2 probe: ${name} — ${pr.title}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, Stage 2 start (preset 2), seed ${flags.seed ?? 1}, stepped. Times are game time from the stage start.`, '', ...out, ''].join('\n'));
}

// ------------------------------------------------------------------ Paperclips Stage 2 probes
// The same "player who does the unexpected", asked of the reference's Stage 2 (fixture
// paperclips-stage2, the scripted Stage 2 player up to the moment of the deviation).
const pc = await loadAdapter('paperclips');
const pcShown = (kit) =>
  kit.session.page.evaluate(() => {
    const t = (id) => {
      const el = document.getElementById(id);
      return el && el.checkVisibility({ checkVisibilityCSS: true }) ? el.innerText.replace(/\s+/g, ' ').trim() : null;
    };
    const words = (document.body.innerText.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
    return {
      clips: t('clips'), rate: t('clipmakerRate2') || t('clipmakerRate'), unused: t('unusedClipsDisplay'), matter: t('availableMatterDisplay'), acquired: t('acquiredMatterDisplay'), wire: t('nanoWire'),
      perf: t('performance'), prod: t('powerProductionRate'), cons: t('powerConsumptionRate'), stored: t('storedPower'), maxStore: t('maxStorage'),
      swarm: t('swarmStatus'), gifts: t('swarmGifts'), ops: t('operations'), yomi: t('yomiDisplay'), words,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, pageHeight: document.documentElement.scrollHeight,
    };
  });
const pcLine = (m, sh) => `clips/s ${sh.rate ?? fmtN(m.rate)}, unused clips ${sh.unused}, factories ${m.factoryLevel}, harvesters ${fmtN(m.harvesterLevel)}, wire drones ${fmtN(m.wireDroneLevel)}, farms ${m.farmLevel}, batteries ${m.batteryLevel}, "Factory/Drone Performance: ${sh.perf}%", power ${sh.prod} / ${sh.cons} MW, swarm "${sh.swarm ?? '—'}"`;
async function pcPlayTo(kit, pol, seconds, cond) {
  let hit = null;
  await kit.run(seconds, async (t, snap) => {
    if (cond && (await cond(snap, t))) {
      hit = snap;
      return 'stop';
    }
    await pol.pass(t);
    return undefined;
  });
  return hit;
}
const PC_PROBES = {
  'pc-all-in-drones': {
    title: 'Paperclips Stage 2: every clip into drones and farms before the first factory',
    async run(kit, out) {
      const pol = kit.policy();
      // the scripted player up to the moment both drone kinds are on sale (before any factory)
      const hit = await pcPlayTo(kit, pol, 1500, async (s) => s.buttons.some((b) => b.k === 'btnMakeWireDrone') && s.buttons.some((b) => b.k === 'btnMakeHarvester'));
      if (!hit) return void out.push('Drones never came on sale within 25 minutes.');
      const m0 = await kit.session.metrics();
      out.push(`Drones on sale at ${mmss(kit.t)}: ${pcLine(m0, await pcShown(kit))}. From here every clip goes into drones and farms (largest enabled button first), nothing else is bought.`);
      const order = ['btnHarvesterx1000', 'btnWireDronex1000', 'btnFarmx100', 'btnHarvesterx100', 'btnWireDronex100', 'btnFarmx10', 'btnHarvesterx10', 'btnWireDronex10', 'btnMakeFarm', 'btnMakeHarvester', 'btnMakeWireDrone'];
      let clicks = 0;
      for (let round = 0; round < 400; round++) {
        let any = false;
        for (const k of order) {
          const n = await kit.click(k, 1, 'all-in');
          if (n) {
            clicks += n;
            any = true;
          }
        }
        if (!any) break;
      }
      const t0 = kit.t;
      const end = await kit.run(300);
      await kit.shot('pc-all-in-drones');
      const m1 = await kit.session.metrics();
      const sh = await pcShown(kit);
      out.push(`${clicks} purchases later and 300 s on (${mmss(kit.t)}): ${pcLine(m1, sh)}; Clip Factory costs ${fmtN(m1.factoryCost)} clips, unused ${fmtN(m1.unusedClips)}.`, '', 'Lines in those 300 s:', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`), '', 'On screen:', ...kit.screen(end, { lines: 4 }).map((l) => `- ${l}`));
      // the way out: Disassemble All
      const before = m1.unusedClips;
      const n = (await kit.click('btnHarvesterReboot', 1, 'disassemble')) + (await kit.click('btnWireDroneReboot', 1, 'disassemble'));
      const m2 = await kit.session.metrics();
      out.push('', `Recovery: "Disassemble All" on both drone kinds (${n} clicks, no confirmation): unused clips ${fmtN(before)} → ${fmtN(m2.unusedClips)} (a full refund); the first factory (${fmtN(m2.factoryCost)}) is ${m2.unusedClips >= m2.factoryCost ? 'affordable again' : 'still out of reach'}. Nothing on screen says that disassembling refunds.`);
    },
  },
  'pc-no-power': {
    title: 'Paperclips Stage 2: at 20:00 every solar farm is disassembled and none is rebuilt for five minutes',
    async run(kit, out) {
      const pol = kit.policy();
      await pcPlayTo(kit, pol, 1200);
      const m0 = await kit.session.metrics();
      out.push(`At ${mmss(kit.t)}: ${pcLine(m0, await pcShown(kit))}.`);
      await kit.click('btnFarmReboot', 1, 'disassemble');
      await kit.click('btnBatteryReboot', 1, 'disassemble');
      const t0 = kit.t;
      const end = await kit.run(300);
      await kit.shot('pc-no-power');
      const m1 = await kit.session.metrics();
      out.push(`Farms and batteries disassembled; 300 s later, nothing clicked: ${pcLine(m1, await pcShown(kit))}; clips ${fmtN(m0.clips)} → ${fmtN(m1.clips)}.`, '', 'Lines in those 300 s:', ...(kit.linesBetween(t0, kit.t).map((l) => `- ${l}`).length ? kit.linesBetween(t0, kit.t).map((l) => `- ${l}`) : ['- (none)']), '', 'On screen:', ...kit.screen(end, { lines: 3 }).map((l) => `- ${l}`));
      const t1 = kit.t;
      await kit.run(120, kit.with(pol));
      const m2 = await kit.session.metrics();
      out.push('', `The scripted player back for 120 s: ${pcLine(m2, await pcShown(kit))}.`, ...kit.linesBetween(t1, kit.t).slice(0, 6).map((l) => `- ${l}`));
    },
  },
  'pc-disassemble-all': {
    title: 'Paperclips Stage 2: at 20:00 every "Disassemble All" is pressed once',
    async run(kit, out) {
      const pol = kit.policy();
      await pcPlayTo(kit, pol, 1200);
      const m0 = await kit.session.metrics();
      out.push(`At ${mmss(kit.t)}: ${pcLine(m0, await pcShown(kit))}.`);
      const dialogs = [];
      kit.session.page.on('dialog', async (d) => {
        dialogs.push(d.message());
        await d.accept();
      });
      let n = 0;
      for (const k of ['btnFactoryReboot', 'btnHarvesterReboot', 'btnWireDroneReboot', 'btnFarmReboot', 'btnBatteryReboot']) n += await kit.click(k, 1, 'disassemble');
      const m1 = await kit.session.metrics();
      await kit.shot('pc-disassemble-all');
      out.push(`${n} "Disassemble All" buttons pressed (confirmation dialogs: ${dialogs.length}): ${pcLine(m1, await pcShown(kit))}; unused clips ${fmtN(m0.unusedClips)} → ${fmtN(m1.unusedClips)}.`);
      const t1 = kit.t;
      let back = null;
      await kit.run(600, async (t, s) => {
        await pol.pass(t);
        const m = s.m;
        if (!back && m.rate >= m0.rate && m0.rate > 0) {
          back = t;
          return 'stop';
        }
        return undefined;
      });
      const m2 = await kit.session.metrics();
      out.push(`The scripted player rebuilds: clips/s back to the earlier ${fmtN(m0.rate)} ${back != null ? `after ${back - t1} s` : `not within 600 s (now ${fmtN(m2.rate)})`}; ${pcLine(m2, await pcShown(kit))}.`);
    },
  },
  'pc-idle': {
    title: 'Paperclips Stage 2: play 20 minutes, walk away for 10, come back',
    async run(kit, out) {
      const pol = kit.policy();
      await pcPlayTo(kit, pol, 1200);
      const m0 = await kit.session.metrics();
      out.push(`At ${mmss(kit.t)} (walking away): ${pcLine(m0, await pcShown(kit))}; clips ${fmtN(m0.clips)}.`);
      const t0 = kit.t;
      const end = await kit.run(600);
      await kit.shot('pc-idle');
      const m1 = await kit.session.metrics();
      out.push('', 'While away (600 s):', ...(kit.linesBetween(t0 + 1, kit.t).length ? kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`) : ['- (no line)']), '', `At ${mmss(kit.t)} (back): ${pcLine(m1, await pcShown(kit))}; clips ${fmtN(m1.clips)}.`, '', 'On screen:', ...kit.screen(end, { lines: 3 }).map((l) => `- ${l}`));
    },
  },
  'pc-reload': {
    title: 'Paperclips Stage 2: reload at 20:00',
    async run(kit, out) {
      const pol = kit.policy();
      await pcPlayTo(kit, pol, 1200);
      const a = await kit.session.metrics();
      await kit.reload();
      const b = await kit.session.metrics();
      await kit.shot('pc-reload');
      out.push(`Before the reload (${mmss(kit.t)}): clips ${fmtN(a.clips)}, unused ${fmtN(a.unusedClips)}, factories ${a.factoryLevel}, harvesters ${a.harvesterLevel}, wire drones ${a.wireDroneLevel}, farms ${a.farmLevel}, yomi ${fmtN(a.yomi)}, ops ${fmtN(a.ops)}.`, `After: clips ${fmtN(b.clips)}, unused ${fmtN(b.unusedClips)}, factories ${b.factoryLevel}, harvesters ${b.harvesterLevel}, wire drones ${b.wireDroneLevel}, farms ${b.farmLevel}, yomi ${fmtN(b.yomi)}, ops ${fmtN(b.ops)}.`, `Lost: ${fmtN(a.clips - b.clips)} clips (${a.clips > 0 ? (((a.clips - b.clips) / a.clips) * 100).toFixed(1) : 0}% of the total; about ${a.rate > 0 ? fmtN((a.clips - b.clips) / a.rate) : '—'} s of production), ${a.harvesterLevel - b.harvesterLevel} harvesters, ${a.wireDroneLevel - b.wireDroneLevel} wire drones, ${a.factoryLevel - b.factoryLevel} factories. The game autosaves every 25 s and does not save on unload.`);
    },
  },
  'pc-slider': {
    title: 'Paperclips Stage 2: the Work/Think slider at each end for five minutes (after Swarm Computing)',
    async run(kit, out) {
      const pol = kit.policy();
      const hit = await pcPlayTo(kit, pol, 3600, async (s) => (s.m.swarmStatus || '').length > 0);
      if (!hit) return void out.push('Swarm Computing never appeared within 60 minutes.');
      await kit.run(60, kit.with(pol));
      const noSlider = kit.policy({ special: null });
      for (const v of [0, 200]) {
        await kit.session.setValue('#slider', v);
        const a = await kit.session.metrics();
        const t0 = kit.t;
        await kit.run(300);
        const b = await kit.session.metrics();
        const sh = await pcShown(kit);
        out.push(`- slider at ${v} (${v === 0 ? 'all Work' : 'all Think'}) from ${mmss(t0)} for 300 s, nothing else clicked: clips/s ${fmtN(a.rate)} → ${fmtN(b.rate)}; swarm gifts ${a.swarmGifts} → ${b.swarmGifts} ("Swarm Gifts: ${sh.gifts ?? '—'}"); harvest ${fmtN(b.harvestRate)} g/s, wire ${fmtN(b.wireRate)} in/s; status "${sh.swarm}".`, ...kit.linesBetween(t0, kit.t).slice(0, 5).map((l) => `  - ${l}`));
      }
      await kit.shot('pc-slider');
      void noSlider;
    },
  },
  'pc-mobile': {
    title: 'Paperclips Stage 2 at 390 × 844 (20 minutes)',
    viewport: MOBILE,
    async run(kit, out) {
      const pol = kit.policy();
      const { page } = kit.session;
      for (const mark of [2, 600, 1200]) {
        await kit.run(mark - kit.t, kit.with(pol));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${kit.prefix}-t${mark}-fold.png`, fullPage: false });
        await page.screenshot({ path: `${kit.prefix}-t${mark}-full.png`, fullPage: true });
        const sh = await pcShown(kit);
        const btn = await page.evaluate(() => {
          const bs = [...document.querySelectorAll('button')].filter((b) => b.checkVisibility({ checkVisibilityCSS: true })).map((b) => Math.round(b.getBoundingClientRect().height));
          return { n: bs.length, tiny: bs.filter((h) => h < 32).length, min: Math.min(...bs) };
        });
        out.push(`**${mmss(mark)}** — page ${390 + sh.overflowX}×${sh.pageHeight} px (${(sh.pageHeight / 844).toFixed(1)} screens; horizontal overflow ${sh.overflowX} px); ${btn.n} buttons (debug buttons included), ${btn.tiny} under 32 px tall (smallest ${btn.min} px); ${sh.words} words on the page (debug buttons included).`);
      }
    },
  },
  'pc-words': {
    title: 'Paperclips Stage 2: words and numbers on screen at the five-minute marks (the scripted player, 60 minutes)',
    async run(kit, out) {
      const pol = kit.policy();
      const debugWords = 34; // the mirror's debug/save buttons: "SAVE SLOT 1 … Set Avail Matter to 0"
      out.push('| t | numbers | controls | panels | words (debug buttons excluded) |', '|---|---|---|---|---|');
      for (let mark = 0; mark <= 3600; mark += 300) {
        if (mark > kit.t) await kit.run(mark - kit.t, kit.with(pol));
        const s = await kit.snap();
        const sh = await pcShown(kit);
        const dbg = await kit.session.page.evaluate(() => {
          const ids = ['save1Button', 'load1Button', 'save2Button', 'load2Button', 'resetButton', 'freeClipsButton', 'freeMoneyButton', 'freeTrustButton', 'freeOpsButton', 'freeCreatButton', 'freeYomiButton', 'resetPrestige', 'destroyAllHumansButton', 'freePrestigeU', 'freePrestigeS', 'debugBattleNumbers', 'availMatterZero'];
          let w = 0;
          for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.checkVisibility({ checkVisibilityCSS: true })) w += (el.innerText.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
          }
          return w;
        });
        out.push(`| ${mmss(kit.t)} | ${s.numbers} | ${s.buttons.length + s.sliders.length} | ${s.panels.length} | ${sh.words - dbg} |`);
      }
      void debugWords;
    },
  },
};
/**
 * Reference run: Paperclips Stage 2 by the scripted player, optionally arriving with yomi
 * (`--yomi N`; the fixture arrives with 0, a player brings what Stage 1's tournaments paid).
 * Policy variants come from the environment (PC_THINK_VALUE, PC_FACTORY_HORIZON, PC_TRIVIAL_SHARE).
 */
async function runPcStage(flags) {
  const yomi0 = Number(flags.yomi ?? 0);
  const adapter = yomi0
    ? {
        ...pc,
        boot: async (session, o) => {
          const info = await pc.boot(session, o);
          await session.page.evaluate((y) => {
            window.yomi = y;
            document.getElementById('yomiDisplay').innerHTML = y.toLocaleString();
          }, yomi0);
          return { ...info, cheat: `yomi set to ${yomi0} at the stage start` };
        },
      }
    : pc;
  const label = labelFor(yomi0 ? 'pc-stage-yomi' : 'pc-stage', flags);
  const { meta } = await runGame({ game: 'paperclips', adapter, prefix: label, realtime: 0, accelMinutes: Number(flags.minutes ?? 180), seed: Number(flags.seed ?? 1), stage: 2, quiet: true });
  console.log(`${label}: stage end ${meta.stageEnd != null ? mmss(meta.stageEnd) : `NOT REACHED by ${mmss(meta.endT)}`}`);
}

async function runPcProbe(name, flags) {
  const pr = PC_PROBES[name];
  const prefix = resolvePrefix(labelFor(name, flags));
  const out = [];
  let kit;
  try {
    kit = await openProbe(pc, { gameDir: resolveGameDir(pc), seed: Number(flags.seed ?? 1), prefix, viewport: pr.viewport, stage: 2, fixture: loadFixture(pc, { stage: 2 }) });
    await pr.run(kit, out);
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
  fs.writeFileSync(`${prefix}.md`, [`# Stage 2 probe (Paperclips): ${name} — ${pr.title}`, '', `Universal Paperclips, fixture paperclips-stage2, seed ${flags.seed ?? 1}, stepped. Times are game time from the stage start.`, '', ...out, ''].join('\n'));
}

// ----------------------------------------------------------------------------------------- TABLE
function table(flags, names) {
  const tag = flags.tag ?? 's2x';
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(`${tag}-`) && f.endsWith('.end.json'));
  const ends = files.map((f) => readJson(path.join(OUT_DIR, f)));
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
    return [n, l.map((e) => e.seed).sort().join(','), col(l, (e) => (e.stageEnd != null ? mmss(e.stageEnd) : `>${mmss(e.endT)}`)), col(l, (e) => fmtN(e.st.capability, 2)), col(l, (e) => `${fmtN(e.st.alignA, 0)}·${fmtN(e.st.alignT, 0)}`), col(l, (e) => fmtN(e.st.gov, 0)), col(l, (e) => fmtN(e.st.approval, 0)), col(l, (e) => fmtN(e.st.lead, 1)), col(l, (e) => money(e.st.funds)), col(l, (e) => `SL${e.st.sl}`), col(l, (e) => `${e.st.trainings}/${e.st.releases}/${e.st.incidents}`)];
  });
  const md = mdTable(['play style', 'seeds', 'Stage 2 ends', 'capability ×', 'alignment shown·true', 'government', 'approval', 'lead (months)', 'funds', 'security', 'runs/releases/incidents (lifetime)'], rows);
  console.log(md);
  fs.writeFileSync(path.join(OUT_DIR, `${tag}-table.md`), `${md}\n`);
}

const { pos, flags } = parseArgs(process.argv.slice(2), ['modalShots', 'modal-shots']);
const which = pos[0];
if (!which || which === 'list') {
  console.log('runs:   ' + Object.keys(RUNS).join(', '));
  console.log('probes: ' + Object.keys(PROBES).join(', '));
  console.log('paperclips probes: ' + Object.keys(PC_PROBES).join(', '));
  console.log('paperclips reference run: pc-stage [--yomi N]  (env PC_THINK_VALUE, PC_FACTORY_HORIZON, PC_TRIVIAL_SHARE)');
  process.exit(which ? 0 : 2);
}
if (which === 'table') {
  table(flags, pos[1] ? pos[1].split(',') : null);
  process.exit(0);
}
const names = which === 'all-runs' ? Object.keys(RUNS) : which === 'all-probes' ? Object.keys(PROBES) : which === 'all-paperclips' ? Object.keys(PC_PROBES) : which.split(',');
const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [Number(flags.seed ?? 1)];
for (const n of names) {
  if (RUNS[n]) for (const sd of seeds) await runScenario(n, flags, sd);
  else if (PROBES[n]) await runProbe(n, flags);
  else if (PC_PROBES[n]) await runPcProbe(n, flags);
  else if (n === 'pc-stage') await runPcStage(flags);
  else console.error(`unknown scenario "${n}"`);
}
