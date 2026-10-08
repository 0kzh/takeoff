// Metrics from a run's snaps/events/actions, using the critic report §1 definitions verbatim:
//   Reveal: first time a panel, button, slider, project button or modal becomes visible.
//   Enabled transition: a visible disabled button becoming enabled.
//   Nothing-to-do (loose): a 2-s snapshot where (1) ≥ 1 automation unit is owned, (2) no modal is
//     open, (3) no visible enabled button exists other than the ambient set, (4) nothing became
//     newly visible or newly enabled since the previous snapshot.
//   Novelty gap: time between consecutive novelty events (first-time reveal, modal, new console/log line).
//   Reveal gap: time between consecutive first-time reveals (console lines excluded).
//   Greyed-out goal on screen: ≥ 1 visible disabled purchase/project, or a visible "+1 Trust at" line.
//   Cognitive load: numeric tokens + visible interactive elements (buttons + sliders) + visible panels,
//     sampled at minutes 0, 1, 3, 5, 10, 20 and stage end (+ minute 30, added for stages that run
//     longer, e.g. Takeoff Stage 2; '—' when the stage ends before it).
//   First meaningful choice: ≥ 2 distinct affordable non-ambient actions; a price decision; a modal.
//   Words on screen (load table): letter-led tokens of the page's rendered text (the excluded roots
//     left out), as the Stage 1 round-3 and Stage 2 round-2 critics counted them.
//   Hands (handsOf, the Stage 2 critics' measures, same definitions): share of 2-s checks with no
//     enabled thing / with two or more distinct ones (bulk sizes count once), clicks per minute (mash
//     excluded), share of the window inside gaps of ≥ 30 s between clicks.
import fs from 'node:fs';
import { elementsOf } from './recorder.ts';
import { median, readJson } from './util.ts';

export const LOAD_MINUTES = [0, 1, 3, 5, 10, 20, 30];
export const GAP_LIST_OVER = 120;
export const FIRST_WINDOW = 300;

export function loadRun(prefix) {
  const snaps = readJson(`${prefix}.snaps.json`);
  const events = readJson(`${prefix}.events.json`);
  const actions = fs.existsSync(`${prefix}.actions.json`) ? readJson(`${prefix}.actions.json`).actions : [];
  return { meta: snaps.meta, snaps: snaps.snaps, events: events.events, actions };
}

/**
 * The part of a run that is Stage `stage`, re-based so t = 0 is that stage's start (the first
 * snapshot showing it). A run that starts in that stage is returned unchanged. The window ends at
 * the next stage change (meta.stageEnd) or at the end of the run.
 */
export function sliceStage(run, stage) {
  const { meta, snaps, events, actions } = run;
  if (stage == null || stage === meta.stageStart) return run;
  const first = snaps.find((s) => s.stage === stage);
  if (!first) throw new Error(`run ${meta.prefix} never shows Stage ${stage}`);
  const t0 = first.t;
  const after = snaps.find((s) => s.t > t0 && s.stage !== stage);
  const t1 = after ? after.t : snaps[snaps.length - 1].t;
  const shift = (x) => ({ ...x, t: x.t - t0 });
  const inWin = (x) => x.t >= t0 && x.t <= t1;
  const stEvents = events.filter((e) => e.type === 'stage-end' && e.t > t0);
  return {
    meta: {
      ...meta,
      prefix: `${meta.prefix} (Stage ${stage} from ${Math.floor(t0 / 60)}:${String(t0 % 60).padStart(2, '0')})`,
      stageStart: stage,
      stageEnd: after ? (stEvents.length ? stEvents[0].t : after.t) - t0 : null,
      endT: t1 - t0,
      phase1End: Math.max(0, meta.phase1End - t0),
      sliceFrom: t0,
    },
    // The first snapshot of the stage counts as the stage's opening screen: its elements are "initial".
    snaps: snaps.filter(inWin).map(shift),
    events: events.filter(inWin).map((e) => (e.t === t0 && e.type === 'reveal' ? { ...shift(e), initial: true } : shift(e))),
    actions: actions.filter(inWin).map(shift),
  };
}

const purchaseLike = (b) => !b.a && b.kind !== 'modal' && b.kind !== 'tab';

/** Gaps between sorted event times inside [from, to]; the window edges close the first/last gap. */
function gaps(times, from, to) {
  const ts = [...new Set<number>(times.filter((t) => t >= from && t <= to))].sort((a, b) => a - b);
  const pts = [from, ...ts.filter((t) => t > from), to].filter((t, i, a) => i === 0 || t !== a[i - 1]);
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push({ start: pts[i - 1], end: pts[i], len: pts[i] - pts[i - 1], trailing: i === pts.length - 1 });
  return out;
}

function gapSummary(times, from, to, endLabel) {
  const g = gaps(times, from, to);
  const longest = g.reduce((a, b) => (b.len > (a ? a.len : -1) ? b : a), null);
  return {
    over: g.filter((x) => x.len > GAP_LIST_OVER).map((x) => ({ ...x, endLabel: x.trailing ? endLabel : null })),
    longest: longest ? { ...longest, endLabel: longest.trailing ? endLabel : null } : null,
    count: g.length,
  };
}

/** Nothing-to-do (loose) over the snapshots in [from, to). */
function nothingToDo(snaps, from, to) {
  let total = 0;
  let n = 0;
  let run = 0;
  let best = { len: 0, start: null, end: null };
  let runStart = null;
  let prev = null;
  for (const s of snaps) {
    if (s.t < from || s.t >= to) {
      prev = s;
      continue;
    }
    n++;
    let idle = (s.m.automation || 0) >= 1 && !s.modal && !s.buttons.some((b) => b.e && purchaseLike(b));
    if (idle && prev) {
      const pe = new Map(elementsOf(prev).map((e) => [e.uid, e]));
      for (const e of elementsOf(s)) {
        const p = pe.get(e.uid);
        if (!p || (p.enabled === 0 && e.enabled === 1)) {
          idle = false;
          break;
        }
      }
    }
    if (idle) {
      total += 2;
      if (run === 0) runStart = s.t;
      run += 2;
      if (run > best.len) best = { len: run, start: runStart, end: s.t + 2 };
    } else run = 0;
    prev = s;
  }
  return { seconds: total, snapshots: n, pct: n ? (100 * total) / (2 * n) : null, longest: best };
}

function coverage(snaps, from, to) {
  const win = snaps.filter((s) => s.t >= from && s.t < to);
  const hit = win.filter((s) => s.milestone || s.buttons.some((b) => !b.e && purchaseLike(b)));
  return { pct: win.length ? (100 * hit.length) / win.length : null, snapshots: win.length, firstHit: hit.length ? hit[0].t : null };
}

function loadAt(s) {
  if (!s) return null;
  const interactive = s.buttons.length + s.sliders.length;
  return { t: s.t, numbers: s.numbers, interactive, panels: s.panels.length, words: s.words ?? null, total: s.numbers + interactive + s.panels.length };
}

// ---- hands (the Stage 2 critics' measures) ----
/** Bulk sizes of one item count once (Takeoff's three lot rows; Paperclips' ×10/×100/×1000 buttons). */
export function handsKey(b) {
  if (/^btn-gpuBatch/.test(b.k)) return 'GPU lot';
  if (/^btn-train(Now)?$/.test(b.k)) return 'Train';
  const m = /^btn(?:Make)?(Harvester|WireDrone|Farm|Battery|Factory)/.exec(b.k);
  if (m) return m[1];
  return b.kind === 'project' ? `card:${b.k}` : b.k;
}
/** An enabled thing to buy or press: not a setting, not the ambient set, not an event option, not "Disassemble All". */
const isThing = (b) => !!b.e && !b.a && b.kind !== 'modal' && b.kind !== 'tab' && !/Disassemble/i.test(b.l);
/**
 *   none / two   share of 2-s checks (snapshots, read before the player acts) with no enabled thing /
 *                with two or more distinct enabled things
 *   clicks       every player click (drip included, the main button's mash excluded)
 *   gap30        share of the window spent inside gaps of ≥ 30 s between consecutive clicks
 * Window: from `from` to `to` (default: the stage start to the stage end), stage snapshots only.
 */
export function handsOf(run, { from = 0, to = null } = {}) {
  const { meta, snaps, actions } = run;
  const end = to ?? meta.stageEnd ?? meta.endT;
  const st = snaps.filter((s) => s.t >= from && s.t <= end && s.stage === meta.stageStart);
  let none = 0;
  let two = 0;
  const counts = [];
  const enabledAt: Record<string, Set<number>> = {};
  for (const s of st) {
    const set = new Set<string>(s.buttons.filter(isThing).map(handsKey));
    counts.push(set.size);
    if (set.size === 0) none++;
    if (set.size >= 2) two++;
    for (const k of set) (enabledAt[k.startsWith('card:') ? 'a card' : k] ||= new Set()).add(s.t);
  }
  const clicks = actions.filter((a) => a.t >= from && a.t <= end && a.why !== 'mash' && a.why !== 'mash-stop');
  const nClicks = clicks.reduce((n, a) => n + (a.count || 1), 0);
  const times = [...new Set<number>(clicks.map((a) => a.t))].sort((a, b) => a - b);
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
  const pct = (x) => (st.length ? (100 * x) / st.length : null);
  return {
    from,
    end,
    checks: st.length,
    nonePct: pct(none),
    twoPct: pct(two),
    medianThings: median(counts),
    clicks: nClicks,
    perMin: nClicks / (span / 60),
    gap30Pct: (100 * inGap) / span,
    gaps30: nGaps,
    longestGap: longest,
    enabledShare: Object.fromEntries(Object.entries(enabledAt).map(([k, v]) => [k, pct(v.size)] as [string, number]).sort((a, b) => b[1] - a[1])),
  };
}

export function analyze(run) {
  const { meta, snaps, events, actions } = run;
  const stageEnd = meta.stageEnd;
  const endT = stageEnd ?? meta.endT;
  const stageSnaps = snaps.filter((s) => s.stage === meta.stageStart && s.t <= endT);
  const lastStage = stageSnaps[stageSnaps.length - 1] || snaps[snaps.length - 1];
  const inStage = (t) => t <= endT;
  const endLabel = stageEnd != null ? 'stage end' : 'run end (stage not reached)';

  // ---- first automation ----
  const firstAutoAction = actions.find((a) => a.why === 'first-automation');
  const s0 = snaps[0];
  let firstAutomation;
  if (s0 && (s0.m.automation || 0) >= 1) firstAutomation = { t: 0, how: 'owned at start' };
  else if (firstAutoAction) firstAutomation = { t: firstAutoAction.t, how: `policy bought ${firstAutoAction.label}` };
  else {
    const s = snaps.find((x) => (x.m.automation || 0) >= 1);
    firstAutomation = s ? { t: s.t, how: 'first snapshot with automation ≥ 1' } : null;
  }

  // ---- first meaningful choice candidates ----
  const two = stageSnaps.find((s) => new Set(s.buttons.filter((b) => b.e && purchaseLike(b)).map((b) => b.k)).size >= 2);
  const priceMove = actions.find((a) => a.why === 'price-lower' || a.why === 'price-raise');
  const firstModal = events.find((e) => e.type === 'modal' && inStage(e.t));
  const choice = {
    earliest: null as number | null,
    twoAffordable: two ? { t: two.t, actions: two.buttons.filter((b) => b.e && purchaseLike(b)).map((b) => b.l) } : null,
    firstPriceMove: priceMove ? { t: priceMove.t, why: priceMove.why, detail: priceMove.detail } : null,
    firstModal: firstModal ? { t: firstModal.t, title: firstModal.title, options: firstModal.options } : null,
  };
  const choiceTimes = [choice.twoAffordable?.t, choice.firstPriceMove?.t, choice.firstModal?.t].filter((t) => t != null);
  choice.earliest = choiceTimes.length ? Math.min(...choiceTimes) : null;

  // ---- nothing to do ----
  const ntd = { first5: nothingToDo(snaps, 0, Math.min(FIRST_WINDOW, endT + 0.001)), stage: nothingToDo(stageSnaps, 0, endT + 0.001) };

  // ---- novelty & reveal gaps ----
  const reveals = events.filter((e) => e.type === 'reveal' && inStage(e.t));
  const novelty = events.filter((e) => inStage(e.t) && (e.type === 'reveal' || e.type === 'modal' || ((e.type === 'console' || e.type === 'log') && e.novel)));
  const gapsOut = {
    novelty: { first5: gapSummary(novelty.map((e) => e.t), 0, Math.min(FIRST_WINDOW, endT), Math.min(FIRST_WINDOW, endT) === endT ? endLabel : '5:00'), stage: gapSummary(novelty.map((e) => e.t), 0, endT, endLabel) },
    reveal: { first5: gapSummary(reveals.map((e) => e.t), 0, Math.min(FIRST_WINDOW, endT), Math.min(FIRST_WINDOW, endT) === endT ? endLabel : '5:00'), stage: gapSummary(reveals.map((e) => e.t), 0, endT, endLabel) },
  };

  // ---- reveal timeline ----
  const byT = new Map();
  for (const e of reveals) {
    if (!byT.has(e.t)) byT.set(e.t, []);
    byT.get(e.t).push(`${e.what} ${e.label}${e.what === 'button' || e.what === 'project' ? (e.enabled ? '' : ' (grey)') : ''}`);
  }
  const timeline = [...byT].map(([t, items]) => ({ t, items }));

  // ---- greyed-out goal ----
  const grey = { first5: coverage(snaps, 0, Math.min(FIRST_WINDOW, endT + 0.001)), stage: coverage(stageSnaps, 0, endT + 0.001) };

  // ---- cognitive load ----
  const at = (t) => stageSnaps.find((s) => s.t >= t);
  const load = LOAD_MINUTES.map((m) => {
    const t = m === 0 ? 2 : m * 60;
    return { label: String(m), ...(t <= endT ? loadAt(at(t)) || {} : {}) };
  });
  load.push({ label: 'end', ...loadAt(lastStage) });

  // ---- disclosure spikes ----
  const spikes = [];
  for (let i = 1; i < stageSnaps.length; i++) {
    const a = stageSnaps[i - 1];
    const b = stageSnaps[i];
    const dn = b.numbers - a.numbers;
    const di = b.buttons.length + b.sliders.length - (a.buttons.length + a.sliders.length);
    const dp = b.panels.length - a.panels.length;
    const prevU = new Set(elementsOf(a).map((e) => e.uid));
    const appeared = elementsOf(b).filter((e) => !prevU.has(e.uid)).map((e) => `${e.what} ${e.label}`);
    spikes.push({ t: b.t, dNumbers: dn, dInteractive: di, dPanels: dp, score: Math.max(0, dn) + Math.max(0, di), appeared });
  }
  spikes.sort((x, y) => y.score - x.score || x.t - y.t);
  const topSpikes = spikes.filter((s) => s.score > 0).slice(0, 5);

  // ---- actions ----
  const counts = new Map();
  let mash = 0;
  for (const a of actions.filter((x) => inStage(x.t))) {
    if (a.why === 'mash') {
      mash += a.count || 0;
      continue;
    }
    if (a.why === 'mash-stop') continue;
    // Short labels ("+10", "+1k", "<", ">") repeat across kinds: name the button too.
    const label = /^[+<>]|^.{0,3}$/.test(a.label || '') ? `${a.label} [${a.key}]` : a.label;
    const k = `${a.why} · ${label}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const why = (w) => actions.filter((a) => inStage(a.t) && a.why === w).length;
  const actionSummary = {
    mashClicks: mash,
    mashStop: actions.find((a) => a.why === 'mash-stop')?.t ?? null,
    consumable: why('consumable'),
    automation: why('automation') + why('first-automation'),
    priceLower: why('price-lower'),
    priceRaise: why('price-raise'),
    projects: why('project'),
    modals: why('modal'),
    byAction: [...counts].sort((a, b) => b[1] - a[1]),
  };
  const COUNTERS = ['automation', 'gpus', 'powerBought', 'hypeLevel', 'priceRaises', 'researchers', 'labSpace', 'trainings', 'releases', 'choices', 'idleRescues', 'incidents', 'projectsBought', 'clipmakerLevel', 'megaClipperLevel', 'marketingLvl', 'wirePurchase', 'processors', 'memory'];
  const counters: Record<string, { start: number; end: number }> = {};
  if (s0 && lastStage) for (const k of COUNTERS) if (typeof lastStage.m[k] === 'number' && typeof s0.m[k] === 'number') counters[k] = { start: s0.m[k], end: lastStage.m[k] };

  // ---- cadence ----
  const cadence = (what) => {
    const evs = reveals.filter((e) => e.what === what && !e.initial);
    const ts = [...new Set<number>(evs.map((e) => e.t))].sort((a, b) => a - b);
    const d = [];
    for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
    const trailing = ts.length ? endT - ts[ts.length - 1] : null;
    return { times: ts, n: evs.length, medianGap: median(d), maxGap: d.length ? Math.max(...d) : null, sinceLast: trailing };
  };

  return {
    meta,
    stageEnd,
    endT,
    endLabel,
    firstAutomation,
    choice,
    nothingToDo: ntd,
    gaps: gapsOut,
    timeline,
    grey,
    load,
    spikes: topSpikes,
    actions: actionSummary,
    counters,
    cadence: { panels: cadence('panel'), projects: cadence('project') },
    hands: {
      stage: handsOf(run, { to: endT }),
      first10: handsOf(run, { to: Math.min(600, endT) }),
      after10: endT > 600 ? handsOf(run, { from: 600, to: endT }) : null,
    },
    totals: {
      reveals: reveals.length,
      consoleLines: events.filter((e) => e.type === 'console' && inStage(e.t)).length,
      distinctConsole: events.filter((e) => e.type === 'console' && e.novel && inStage(e.t)).length,
      modals: events.filter((e) => e.type === 'modal' && inStage(e.t)).length,
    },
  };
}
