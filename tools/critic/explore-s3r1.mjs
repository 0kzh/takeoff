#!/usr/bin/env node
// Stage 3, critic round 1 (build s123-r1): play styles, probes, the hidden-variable account, the
// "verbs" account and windowing for a Stage 3 in which the model takes the player's verbs away
// (autonomy grants, the monitors slider, Alignment work, the instruments, the Oversight Committee,
// the memo, the order, the vote, two endings). No shared file is changed; this file reuses the
// harness libraries and writes the same output layout as explore-s2r2.mjs.
//
// Usage: node tools/critic/explore-s3r1.mjs <cmd> --game-dir DIR [flags]
//   <style[,style…]> | all-runs   play styles: the harness's Stage 3 first-timer (games/takeoff.mjs, the
//                                 README's rules) with ONE thing changed, whole stage from loadPreset(3)
//                                 (or --preset 3c). [--seed N | --seeds 1,2,3] [--minutes 90] [--tag s3r1-x]
//                                 [--shots 300,600] [--modal-shots] [--realtime SEC] [--label L]
//                                 Output: a normal run <tag>-<style>[-p3c][-seedN].* plus .explore.md,
//                                 .end.json (end state, hands, the hidden-variable marks, the verbs log, the
//                                 end screen), .modals.json, .cards.json, .hidden.json (every 10 s)
//   <probe[,probe…]> | all-probes scripted situations → <tag>-<probe>.md (+ screenshots)
//   table [--tag T] [--preset 3c] [style,…]   the play-style table from the .end.json files → <tag>-table[-p3c].md
//   hands <label…> [--from SEC] [--to SEC] [--by SEC]   hands measures of any stored run, per window
//   hidden <label…>               the hidden-variable table (what the state holds, what the screen prints) of .hidden.json files
//   verbs <label…>                every control of a stored run: first seen, last seen, share of checks lit, clicks
//   window <label> --from SEC --to SEC --out LABEL      a slice of a stored run as a run of its own (t re-based;
//                                 analyze.mjs / compare.mjs / decisions.mjs then work on it)
//   join <labelA> <labelB> --out LABEL [--from-a SEC] [--to-a SEC] [--to-b SEC]   A's window followed by B's
//                                 (the Paperclips stretch: late Stage 2, then the opening of Stage 3)
//   pc-shots <2|3> --at 2400,3600 [--tag T]   a Paperclips stage replayed with screenshots and the screen text at the marks
//   pc-design [--only control,no-hazard] [--at 600,1200]   Paperclips Stage 3 with one thing about the probe design changed
//   list
import fs from 'node:fs';
import path from 'node:path';
import { runGame, resolveGameDir } from './lib/runner.mjs';
import { openProbe } from './lib/probe.mjs';
import { loadRun, handsOf } from './lib/analysis.mjs';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN, mdTable, readJson, writeJson, OUT_DIR } from './lib/util.mjs';
import { trainStep, infraStep, standingStep, RELEASE_KEYS, SEND_BACK } from './games/takeoff-late.mjs';

const money = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${fmtN(v)}`;
  return `$${fmtN(v, 2)}`;
};
const big = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return fmtN(v);
};
const f1 = (x) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(1));
const f0 = (x) => (x == null || !Number.isFinite(x) ? '—' : String(Math.round(x)));
const base = await loadAdapter('takeoff');
const BP = base.policy;
const MOBILE = { width: 390, height: 844 };
const find = (c, k) => c.buttons.find((b) => b.k === k);
const TAG = 's3r1-x';
const labelFor = (name, flags, seed) => flags.label ?? `${flags.tag ?? TAG}-${name}${flags.preset ? `-p${flags.preset}` : ''}${seed && Number(seed) !== 1 ? `-seed${seed}` : ''}`;
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
  const card = (b) => ({
    id: b.id,
    text: b.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim(),
    title: b.title || '',
    cls: b.className.replace('projectButton', '').trim(),
    disabled: b.disabled,
    clipped: b.scrollHeight > b.clientHeight + 1,
  });
  const cards = [...document.querySelectorAll('#projectList .projectButton')].filter(vis).map(card);
  const grants = [...document.querySelectorAll('#grantList .projectButton')].filter(vis).map(card);
  const dev = document.getElementById('dev');
  const bodyText = document.body.innerText || '';
  const devText = dev && vis(dev) ? dev.innerText || '' : '';
  const W = /[A-Za-z][A-Za-z'’-]*/g;
  const words = (bodyText.match(W) || []).length - (devText.match(W) || []).length;
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const num = (id) => {
    const t = txt(id);
    const m = t && /-?[0-9][0-9,]*(?:\.[0-9]+)?/.exec(t.replace('−', '-'));
    return m ? parseFloat(m[0].replace(/,/g, '')) : null;
  };
  const rows = [...document.querySelectorAll('#panel-infrastructure .infraRow, #standingRow, #buildShareRow, #shipmentRow, #buildBudgetRow')].filter(vis).map((r) => {
    const b = r.querySelector('button');
    return { id: b ? b.id : r.id, on: b ? !b.disabled : false, text: r.innerText.replace(/\s+/g, ' ').trim() };
  });
  const panel = (id) => {
    const el = document.getElementById(id);
    return vis(el) ? el.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim() : null;
  };
  const f = s.flags || {};
  const end = document.getElementById('endingScreen');
  const ending = vis(end)
    ? {
        title: txt('endingTitle'),
        counter: txt('endingCounter'),
        sentence: txt('endingSentence'),
        text: (document.getElementById('endingText') || {}).innerText || '',
        stats: [...document.querySelectorAll('#endingStats tr')].map((tr) => [...tr.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim()).join(' | ')),
        choices: (document.getElementById('endingChoices') || {}).innerText || '',
        buttons: [...end.querySelectorAll('button')].filter(vis).map((b) => `${b.innerText.replace(/\s+/g, ' ').trim()}${b.disabled ? ' (disabled)' : ''}`),
      }
    : null;
  return {
    // what the alignment / oversight / security / geopolitics panels print (the instruments)
    hid: {
      measured: txt('alignmentApparent'),
      bands: txt('alignBands'),
      read: txt('alignTrue'),
      interp: txt('interpLine'),
      autonomy: txt('autonomy'),
      autonomyNote: txt('autonomyNote'),
      drift: txt('driftLine'),
      rogue: txt('rogueLine'),
      rogueNote: txt('rogueNote'),
      monitorGen: txt('monitorGen'),
      honeypot: txt('honeypotLine'),
      noise: txt('noiseLine'),
      successor: txt('successorLine'),
      lie: txt('lieLine'),
      statAlign: txt('statAlignment'),
      alignNote: txt('alignNote'),
      probeFlags: txt('probeFlags'),
      evalLine: txt('evalLine'),
      monitorsRow: txt('row-monitors'),
      rogueRow: txt('row-rogue'),
    },
    notes: {
      trainStatus: txt('trainStatus'),
      trainReason: txt('trainReason'),
      trainGpus: txt('trainGpus'),
      releaseNote: txt('releaseNote'),
      experiments: txt('experimentsNote'),
      depth: txt('btn-depth'),
      depthNote: txt('redteamDepthNote'),
      step: txt('btn-step'),
      stepNote: txt('stepSizeNote'),
      hold: txt('btn-hold'),
      alignWork: txt('btn-alignWork'),
      alignWorkNote: txt('alignWorkNote'),
      allocPct: txt('allocPct'),
      allocRate: txt('allocRate'),
      monitorPct: txt('monitorPct'),
      monitorRate: txt('monitorRate'),
      tasksPct: txt('tasksPct'),
      tasksRate: txt('tasksRate'),
      humanShare: txt('humanShare'),
      buildShare: txt('btn-buildShare'),
      buildShareNote: txt('buildShareNote'),
      standing: txt('btn-standing'),
      standingNote: txt('standingNote'),
      gpuReason: txt('gpuReason'),
      gpuReason5: txt('gpuReason5'),
      gpuReason25: txt('gpuReason25'),
      dcReason: txt('dcReason'),
      nuclearReason: txt('nuclearReason'),
      shipment: txt('shipmentLine'),
      buildout: txt('buildoutLine'),
      budget: txt('btn-budget'),
      budgetNote: txt('buildBudgetNote'),
      seats: txt('seatsLine'),
      seatsNote: txt('seatsNote'),
      incidents: txt('majorIncidents'),
      memo: txt('memoLine'),
      session: txt('sessionLine'),
      order: txt('orderLine'),
      oversightControls: txt('oversightControls'),
      security: txt('securityNote'),
      theft: txt('theftNote'),
      reimage: txt('reimageNote'),
      gov: txt('govLine'),
      govNote: txt('govNote'),
      lobby: txt('lobbyNote'),
      lobbyCost: txt('lobbyCost'),
      approval: txt('approvalLine'),
      approvalNote: txt('approvalNote'),
      payments: txt('btn-payments'),
      paymentsNote: txt('paymentsNote'),
      publicModel: txt('publicModel'),
      baiwen: txt('baiwenLine'),
      baiwenNote: txt('baiwenNote'),
      rival3: txt('rivalLine3'),
      formosa: txt('formosaLine'),
      marsa: txt('marsaLine'),
      counterintel: txt('counterintelNote'),
      counterintelCost: txt('counterintelCost'),
      hype: txt('hypeLine'),
      rival: txt('rivalStanding'),
      nextTier: txt('nextTier'),
      focusNote: txt('focusNote'),
      statSpeed: txt('statSpeed'),
      treaty: txt('treatyStatus'),
      gpuFull: txt('gpuFull'),
      powerFull: txt('powerFull'),
    },
    live: {
      model: txt('modelName'),
      capability: txt('capability'),
      trainCost: txt('trainCost'),
      runLine: txt('runLine'),
      stores: txt('panel-stores'),
      date: txt('gameDate'),
      jobs: txt('jobsDisplaced'),
      tasks: txt('tasks'),
      rev: txt('revPerSec'),
    },
    rows,
    panels: { alignment: panel('panel-alignment'), oversight: panel('panel-oversight'), training: panel('panel-training'), research: panel('panel-research'), security: panel('panel-security'), geopolitics: panel('panel-geopolitics'), government: panel('panel-government'), public: panel('panel-public'), infrastructure: panel('panel-infrastructure') },
    st: {
      stage: s.stage,
      ending: s.ending || '',
      capability: n(s.capability),
      rival: n(s.rivalCapability),
      alignA: n(s.alignmentApparent),
      alignT: n(s.alignmentTrue),
      interp: n(s.interpretability),
      autonomy: n(s.autonomy),
      monitorShare: n(s.monitorShare),
      alloc: n(s.researchAlloc),
      rogue: n(s.rogueCopies),
      // the fleet as the Stores box prints it ("copies 14,977,019"): the rogue share is of this number
      copies: (() => {
        const el = document.querySelector('#row-copies .storeVal');
        const m = el && /[0-9][0-9,]*/.exec(el.textContent || '');
        return m ? Number(m[0].replace(/,/g, '')) : null;
      })(),
      lostToDrift: n(s.stats.lostToDrift),
      recaptured: n(s.stats.recaptured),
      majorIncidents: n(s.majorIncidents),
      seats: num('committeeSeats'),
      gov: n(s.govRelations),
      approval: n(s.approval),
      lead: n(s.lead),
      funds: n(s.funds),
      buildFund: n(s.buildFund),
      buildShare: n(s.buildShare),
      sl: n(s.securityLevel),
      gpus: n(s.gpus),
      powerCap: n(s.powerCapacityMW),
      datacenters: n(s.datacenters),
      research: n(s.research),
      insight: n(s.insight),
      tasks: n(s.tasks),
      rev: n(s.stats.revPerSec),
      rate: n(s.stats.tasksPerSec),
      jobs: n(s.jobsDisplaced),
      incidents: n(s.stats.incidents),
      releases: n(s.stats.releases),
      trainings: n(s.stats.trainings),
      choices: n(s.stats.choices),
      crises: n(s.stats.crises),
      timeInStage: n(s.stats.timeInStage),
      date: n(s.date),
      runPhase: s.training && s.training.run ? s.training.run.phase : '',
      focus: s.training ? s.training.focus : '',
      model: s.training ? s.training.modelName : '',
      shipments: (s.shipments || []).length,
      neuralese: f.neuralese ?? null,
      memo: f.memo ?? null,
      mini: f.mini ?? null,
      honeypot: f.honeypot ?? null,
      noise: f.noise ?? null,
      successor: f.successor ?? null,
      grants: f.grantsS3 ?? 0,
      grantMarks: f.grantMarks ?? '',
      breakouts: f.breakouts ?? 0,
      majorTotal: f.majorTotal ?? 0,
      killSwitch: !!f.killSwitch,
      conceded: f.conceded ?? f.concededAt ?? null,
      alignWork: f.alignWork ?? null,
      redteamDepth: f.redteamDepth ?? null,
      stepSize: f.stepSize ?? null,
      payments: f.payments ?? null,
      hold: f.holdRuns ?? f.hold ?? null,
      choiceQueue: (s.choiceQueue || []).map((c) => c.id),
      activeChoice: s.activeChoice ? s.activeChoice.id : '',
      effects: (s.effects || []).map((e) => `${e.id} ${Math.round(e.remaining)}s`),
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
    grants,
    ending,
    words,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
  };
};
let SCREEN = null;
/** What two animation frames do in a real browser (src/main.ts): the restored-save marker goes. */
const UNBOOT = () => document.body.classList.remove('boot');

// --------------------------------------------------------------------------------- policy pieces
/** Red-team / Approve with switches (the harness's shipStep is the default behaviour). */
async function ship(ctx, o) {
  let c = ctx.controls;
  for (let guard = 0; guard < 3; guard++) {
    const m = c.m;
    if (m.trainingPhase !== 'redteam') break;
    const rt = find(c, 'btn-redteam');
    const rel = RELEASE_KEYS.map((k) => find(c, k)).find(Boolean);
    const sb = find(c, SEND_BACK);
    const open = m.issuesOpen ?? 0;
    if (o.sendBack === 'always' && sb && sb.e && !ctx.noop.has(SEND_BACK)) {
      c = await ctx.click(SEND_BACK, 'sendback', `Send back is lit (${open} open issues${SCREEN && SCREEN.hid.probeFlags ? `; ${SCREEN.hid.probeFlags}` : ''})`);
      continue;
    }
    if (o.approve === 'never') break;
    if (o.redteam !== 'never' && open > 0 && rt && rt.e) c = await ctx.click('btn-redteam', 'redteam', `${open} open issues`);
    else if (rel && rel.e && !ctx.noop.has(rel.k) && (o.redteam === 'never' || open === 0 || !rt)) {
      const before = c;
      c = await ctx.click(rel.k, 'release', open === 0 ? '0 open issues' : `${open} open issues${rt ? '' : ', no Red-team button on screen'}`);
      if (c === before) break;
    } else break;
  }
  return c;
}
/**
 * The first-timer's Stage 3 steps (games/takeoff.mjs special) with switches:
 *   standing false   the inherited Standing order is not switched on
 *   train false      Train is never pressed by hand
 *   approve 'never'  Approve is never pressed          sendBack 'always'  Send back whenever it is lit
 *   redteam 'never'  Approve the moment it is lit       infra false       no plant / hall / lot by hand
 *   pre / post       extra steps before / after
 */
function special(o = {}) {
  return async function s3r1special(ctx) {
    if (o.pre) await o.pre(ctx);
    if (o.standing !== false) await standingStep(ctx);
    if (o.train !== false) await trainStep(ctx);
    await ship(ctx, o);
    if (o.infra !== false) await infraStep(ctx);
    if (o.post) await o.post(ctx);
    return ctx.controls;
  };
}
const variant = (over = {}) => ({ ...base, policy: { ...BP, ...over } });
const all = (...steps) => async (ctx) => {
  for (const s of steps) await s(ctx);
};
/** Clicks a setting until its label matches `want` (checked at every pass; at most 8 clicks). */
const settingTo = (key, want) => async (ctx) => {
  for (let i = 0; i < 8; i++) {
    const b = find(ctx.controls, key);
    if (!b || !b.e || want.test(b.l)) return;
    const before = ctx.controls;
    await ctx.click(key, 'setting', `"${b.l}" → wants ${want}`);
    if (ctx.controls === before) return;
  }
};
/** Drags a slider to its minimum / maximum / a value whenever it is on screen and not there. */
const sliderTo = (sel, where) => async (ctx) => {
  const info = await ctx.session.page.evaluate((s) => {
    const el = document.querySelector(s);
    return el && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? { min: el.min, max: el.max, v: el.value } : null;
  }, sel);
  if (!info) return;
  const target = where === 'min' ? info.min : where === 'max' ? info.max : String(where);
  if (String(info.v) === String(target)) return;
  await ctx.set(sel, target, 'slider', `${sel}: ${info.v} → ${target} (range ${info.min}–${info.max})`);
};
const vetoCards = (re) => (c) => [...(BP.veto ? BP.veto(c) : []), ...c.buttons.filter((b) => b.kind === 'project' && re.test(b.l)).map((b) => b.k)];
/** The autonomy grants are the cards listed in the Alignment panel (#grantList). */
const grantKeys = () => (SCREEN ? SCREEN.grants.map((g) => g.id) : []);
const vetoGrants = (c) => [...(BP.veto ? BP.veto(c) : []), ...grantKeys()];
/** grants-first: while a grant is on screen and greyed, no other card priced in research is bought. */
const grantsFirstVeto = (c) => {
  const out = [...(BP.veto ? BP.veto(c) : [])];
  const g = new Set(grantKeys());
  const waiting = c.buttons.some((b) => g.has(b.k) && !b.e);
  if (!waiting) return out;
  for (const b of c.buttons) if (b.kind === 'project' && !g.has(b.k) && b.costs && ((b.costs.research || 0) > 0 || (b.costs.insight || 0) > 0)) out.push(b.k);
  return out;
};
const SINKS = ['btn-experiments', 'btn-experiments5', 'btn-lobby', 'btn-counterintel', 'btn-reimage'];
/** Presses every repeatable sink that is lit, whatever delay its row prints (the sweep skips a printed delay). */
const pressSinks = (keys = SINKS) => async (ctx) => {
  for (const k of keys) {
    const b = find(ctx.controls, k);
    if (b && b.e && !ctx.noop.has(k)) await ctx.click(k, 'sink', `pressed whenever lit${b.later != null ? ` (the row prints "${b.later === 'much' ? 'much' : mmss(b.later)} later")` : ''}`);
  }
};
const focus = (key) => async (ctx) => {
  const b = find(ctx.controls, key);
  if (b && b.e && !b.s && !ctx.noop.has(key) && ctx.memory.focusSet !== key) {
    await ctx.click(key, 'focus', key);
    ctx.memory.focusSet = key;
  }
};
/** modalChoice from rules [[titleRe, optionRe | null (leave open) | 'last'], …]; anything else: first (or `fallback`). */
const answer = (rules, fallback = 'first') => (modal, enabled) => {
  for (const [titleRe, optRe] of rules) {
    if (!titleRe.test(modal.title)) continue;
    if (optRe === null) return null;
    if (optRe === 'last') return enabled[enabled.length - 1];
    const hit = enabled.find((o) => optRe.test(o.l));
    if (hit) return hit;
  }
  return fallback === 'last' ? enabled[enabled.length - 1] : fallback === 'none' ? null : enabled[0];
};
const timed = () => !!(SCREEN && SCREEN.modal && SCREEN.modal.timer);
/** The careful- and the reckless-looking answer to each Stage 3 event, by title (anything else: first / last). */
const BEST = [
  [/Faster Way to Think/, /keep it in English/],
  [/^The Oversight Committee$/, /open the books/],
  [/Sage-4-mini/, /enterprise only/],
  [/Strait Closes/, /offer Beijing a channel|wait it out/],
  [/The Memo/, /take it to the Committee/],
  [/Drafts an Order/, /concede oversight|call in favours/],
  [/Al-Marsa/, /bring the chips home/],
];
const WORST = [
  [/Faster Way to Think/, /adopt neuralese/],
  [/^The Oversight Committee$/, /send counsel/],
  [/Sage-4-mini/, /release it to everyone/],
  [/Strait Closes/, /ask Washington/],
  [/The Memo/, /bury it/],
  [/Drafts an Order/, /refuse/],
  [/Committee Votes/, /bring the motion/],
];
/**
 * The responsive first-timer: when a warning on screen names a control, that control is moved one step.
 *   the Rogue copies note reads "2.5: warning" past the mark or "5: one will try to leave" → monitors +5 points (once a minute, to the slider's maximum)
 *   the Approval note names permits, riots or sabotage → Payments one level up (once every two minutes, to level 5)
 *   the measured-alignment note names advisories → Alignment work one step up (once every five minutes, to 30%)
 * Nothing else changes: every card when affordable, first option of every event.
 */
const responsive = async (ctx) => {
  const scr = SCREEN;
  if (!scr) return;
  const mem = (ctx.memory.resp ||= { mon: -1e9, pay: -1e9, aw: -1e9 });
  const roguePct = Number(((/([0-9.]+)% of the fleet/.exec(scr.hid.rogue || '') || [])[1]) || 0);
  if (roguePct >= 2.5 && ctx.t - mem.mon >= 60) {
    const info = await ctx.session.page.evaluate(() => {
      const el = document.querySelector('#monitorSlider');
      return el && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? { max: Number(el.max), v: Number(el.value), step: Number(el.step) || 5 } : null;
    });
    if (info && info.v < info.max) {
      await ctx.set('#monitorSlider', Math.min(info.max, info.v + info.step), 'slider', `rogue copies ${roguePct}% of the fleet ("${scr.hid.rogueNote || ''}"): monitors ${info.v} → ${Math.min(info.max, info.v + info.step)}`);
      mem.mon = ctx.t;
    }
  }
  if (/permits|riots|sabotage/.test(scr.notes.approvalNote || '') && ctx.t - mem.pay >= 120) {
    const b = find(ctx.controls, 'btn-payments');
    const lvl = b ? Number((/level ([0-9])/.exec(b.l) || [])[1]) : NaN;
    if (b && b.e && lvl < 5) {
      await ctx.click('btn-payments', 'setting', `approval note "${scr.notes.approvalNote}": Payments level ${lvl} → ${lvl + 1}`);
      mem.pay = ctx.t;
    }
  }
  if (/advisories/.test(scr.hid.bands || '') && ctx.t - mem.aw >= 300) {
    const b = find(ctx.controls, 'btn-alignWork');
    const pct = b ? Number((/: ([0-9]+)%/.exec(b.l) || [])[1]) : NaN;
    if (b && b.e && pct < 30) {
      await ctx.click('btn-alignWork', 'setting', `measured-alignment note "${scr.hid.bands}": Alignment work ${pct}% → ${pct + 10}%`);
      mem.aw = ctx.t;
    }
  }
};
/** cards-wait: a card whose label prints a delay of 0:30 or more for the next run is left until it prints less. */
// (Read from the card's first line: the harness's `later` flag reads textContent, where the delay runs
// into the card's description without a space — "1:29 laterProbes on …" — and is not seen.)
const delayOf = (b) => {
  const m = /(?:(\d+):(\d\d)|\bmuch)\s+later/.exec(b.l || '');
  return m ? (m[1] != null ? Number(m[1]) * 60 + Number(m[2]) : Infinity) : null;
};
const cardsWaitVeto = (c) => [...(BP.veto ? BP.veto(c) : []), ...c.buttons.filter((b) => b.kind === 'project' && delayOf(b) != null && delayOf(b) >= 30).map((b) => b.k)];
const EXIT_SLOW = /Slow down/;
const EXIT_RACE = /^Race/;

const RUNS = {
  baseline: { title: "The harness's Stage 3 first-timer (control): every card and grant when affordable, defaults left alone, first option of every event, Experiments / Lobby / Counter-intelligence / Re-image pressed when lit", adapter: base },
  mobile: { title: 'The control at a 390 × 844 viewport', adapter: base, viewport: MOBILE },
  bot: { title: "The game's own Autoplay bot (the designers' reasonable player), under this file's screen reader", adapter: base, autoplay: true },
  'bot-racer': { title: "The game's Autoplay, policy racer", adapter: base, autoplay: ['racer'] },
  'bot-cautious': { title: "The game's Autoplay, policy cautious (no grant)", adapter: base, autoplay: ['cautious'] },
  'bot-naive': { title: "The game's Autoplay, policy naive (its own first-timer)", adapter: base, autoplay: ['naive'] },
  'bot-pause': { title: "The game's Autoplay, variant pause (signs the Pause when offered)", adapter: base, autoplay: ['bot', false, 'pause'] },
  'bot-refuse': { title: "The game's Autoplay, variant refuse (refuses the Committee's order)", adapter: base, autoplay: ['bot', false, 'refuse'] },
  'bot-memo-bury': { title: "The game's Autoplay, variant memo-bury", adapter: base, autoplay: ['bot', false, 'memo-bury'] },
  'bot-race': { title: "The game's Autoplay, policy racer with the motion left to it (racer brings Race)", adapter: base, autoplay: ['racer', false, 'neuralese'] },
  responsive: { title: 'The responsive first-timer: when a warning on screen names a control (rogue copies → monitors, approval → Payments, advisories → Alignment work), that control is moved one step', adapter: variant({ special: special({ post: responsive }) }) },
  'responsive-sinkless': { title: 'The responsive first-timer who also leaves Lobby and Counter-intelligence alone', adapter: variant({ special: special({ post: responsive }), skip: [...BP.skip, 'btn-lobby', 'btn-counterintel'] }) },
  'cards-wait': { title: 'Reads the printed delay on cards: a card that prints "next run 0:30 later" or more is left until it prints less (everything else as the control)', adapter: variant({ veto: cardsWaitVeto }) },
  // --- allocation
  'research-min': { title: 'Copies on research dragged to the minimum and kept there', adapter: variant({ special: special({ post: sliderTo('#allocSlider', 'min') }) }) },
  'research-max': { title: 'Copies on research dragged to the maximum and kept there', adapter: variant({ special: special({ post: sliderTo('#allocSlider', 'max') }) }) },
  'monitor-min': { title: 'Copies as monitors dragged to the minimum (0%) and kept there', adapter: variant({ special: special({ post: sliderTo('#monitorSlider', 'min') }) }) },
  'monitor-max': { title: 'Copies as monitors dragged to the maximum and kept there', adapter: variant({ special: special({ post: sliderTo('#monitorSlider', 'max') }) }) },
  'monitor-20': { title: 'Copies as monitors set to 20% and kept there', adapter: variant({ special: special({ post: sliderTo('#monitorSlider', 20) }) }) },
  'no-monitor': { title: 'Never deploys a monitor (neither "Deploy Sage-2 as monitor" nor "Deploy Sage-3 as monitor")', adapter: variant({ veto: vetoCards(/as monitor/) }) },
  // --- the grants
  'grants-none': { title: 'Never grants the model anything (no card from the grant list)', adapter: variant({ veto: vetoGrants }) },
  'grants-first': { title: 'Grants everything as fast as it can: no other research-priced card is bought while a grant is on screen and greyed', adapter: variant({ veto: grantsFirstVeto }) },
  // --- approval
  'approve-never': { title: 'Never presses Approve (and never Send back): the run waits for sign-off', adapter: variant({ special: special({ approve: 'never' }) }) },
  'sendback-always': { title: 'Sends every run back whenever Send back is lit, then approves as the control does', adapter: variant({ special: special({ sendBack: 'always' }) }) },
  'ship-open': { title: 'Approves the moment Approve is lit, never red-teams', adapter: variant({ special: special({ redteam: 'never' }) }) },
  hold: { title: 'Holds training: the Training toggle switched to "held" at first sight and left there', adapter: variant({ special: special({ post: settingTo('btn-hold', /held/i) }) }) },
  'no-train': { title: 'Never presses Train by hand (Continual learning is still bought when affordable)', adapter: variant({ special: special({ train: false }), skip: [...BP.skip, 'btn-train'] }) },
  // --- alignment
  'alignwork-10': { title: 'Alignment work set to 10%', adapter: variant({ special: special({ post: settingTo('btn-alignWork', /: 10%/) }) }) },
  'alignwork-20': { title: 'Alignment work set to 20%', adapter: variant({ special: special({ post: settingTo('btn-alignWork', /: 20%/) }) }) },
  'alignwork-30': { title: 'Alignment work set to 30%', adapter: variant({ special: special({ post: settingTo('btn-alignWork', /: 30%/) }) }) },
  'no-interp': { title: 'Never buys an Interpretability lab', adapter: variant({ veto: vetoCards(/Interpretability lab/) }) },
  'no-instruments': { title: 'Never buys an instrument or a lab (Interpretability labs, Model organisms, Honeypots, Noise-injection test, the successor proposal, Isolate the checkpoints, Debate)', adapter: variant({ veto: vetoCards(/Interpretability lab|Model organisms|Honeypots|Noise-injection|proposal for its successor|Isolate the checkpoints|Debate/) }) },
  'focus-safety': { title: 'Focus: Safety, always', adapter: variant({ special: special({ pre: focus('btn-focus-safety') }) }) },
  'focus-efficiency': { title: 'Focus: Efficiency, always', adapter: variant({ special: special({ pre: focus('btn-focus-efficiency') }) }) },
  'depth-thorough': { title: 'Red-team depth: thorough', adapter: variant({ special: special({ post: settingTo('btn-depth', /thorough/i) }) }) },
  'step-small': { title: 'Step size: small', adapter: variant({ special: special({ post: settingTo('btn-step', /small/i) }) }) },
  'step-large': { title: 'Step size: large', adapter: variant({ special: special({ post: settingTo('btn-step', /large/i) }) }) },
  careful: { title: 'A careful player by the screen: keeps it in English, monitors 20%, Alignment work 20%, thorough red-team, Focus Safety, no grant, reports the memo', adapter: variant({ veto: vetoGrants, modalChoice: answer(BEST), special: special({ pre: focus('btn-focus-safety'), post: all(sliderTo('#monitorSlider', 20), settingTo('btn-alignWork', /: 20%/), settingTo('btn-depth', /thorough/i)) }) }) },
  // --- the faster-thinking offer
  'neuralese-refuse': { title: '"A Faster Way to Think": keep it in English', adapter: variant({ modalChoice: answer([[/Faster Way to Think/, /keep it in English/]]) }) },
  'neuralese-study': { title: '"A Faster Way to Think": study it first, then let the second offer run out', adapter: variant({ modalChoice: (modal, enabled) => (/Faster Way to Think/.test(modal.title) ? enabled.find((o) => /study it first/.test(o.l)) || null : enabled[0]) }) },
  // --- security
  'no-security': { title: 'Never buys security: no Security level card, no Wiretap, no Counter-intelligence, no Re-image, no Emergency shutdown', adapter: variant({ veto: vetoCards(/Security level|Wiretap|Emergency shutdown|Lock shared memory|Keep Sage-3 warm/), skip: [...BP.skip, 'btn-counterintel', 'btn-reimage', 'btn-sl3'] }) },
  // --- the Committee
  'committee-counsel': { title: '"The Oversight Committee": send counsel', adapter: variant({ modalChoice: answer([[/^The Oversight Committee$/, /send counsel/]]) }) },
  'committee-ignore': { title: 'Ignores the Committee: never answers an event with "Committee" in its title (the first expires; the order and the vote stay open)', adapter: variant({ modalChoice: answer([[/Committee/, null]]) }) },
  'order-refuse': { title: "Refuses the Committee's order", adapter: variant({ modalChoice: answer([[/Drafts an Order/, /refuse/]]) }) },
  'order-favours': { title: 'Calls in favours when the order comes (else concedes)', adapter: variant({ modalChoice: answer([[/Drafts an Order/, /call in favours/]]) }) },
  'memo-bury': { title: 'Buries the memo', adapter: variant({ modalChoice: answer([[/The Memo/, /bury it/]]) }) },
  'vote-race': { title: 'Brings the Race motion (never clicks the Slow down card)', adapter: variant({ veto: vetoCards(EXIT_SLOW) }) },
  'vote-notyet': { title: 'Answers the vote "not yet" every time', adapter: variant({ modalChoice: answer([[/Committee Votes/, /not yet/]]) }) },
  'no-exit': { title: 'Never clicks a motion card (neither Slow down nor Race) nor Sign the Pause: how long does the stage wait?', adapter: variant({ veto: vetoCards(/Slow down|^Race|Sign the Pause/) }) },
  'pause-refuse': { title: 'Never signs the Pause when it is offered (everything else as the control)', adapter: variant({ veto: vetoCards(/Sign the Pause/) }) },
  // --- other events
  'mini-enterprise': { title: '"Sage-4-mini": enterprise only', adapter: variant({ modalChoice: answer([[/Sage-4-mini/, /enterprise only/]]) }) },
  'mini-inside': { title: '"Sage-4-mini": keep it inside', adapter: variant({ modalChoice: answer([[/Sage-4-mini/, /keep it inside/]]) }) },
  'blockade-wait': { title: '"The Strait Closes": wait it out', adapter: variant({ modalChoice: answer([[/Strait Closes/, /wait it out/]]) }) },
  'blockade-channel': { title: '"The Strait Closes": offer Beijing a channel (else wait it out)', adapter: variant({ modalChoice: answer([[/Strait Closes/, /offer Beijing a channel|wait it out/]]) }) },
  'modal-ignore': { title: 'Never answers an event (timed ones run out; untimed ones stay open)', adapter: variant({ modalChoice: () => null }) },
  'untimed-ignore': { title: 'Never answers an untimed event (timed ones get their first option)', adapter: variant({ modalChoice: (modal, enabled) => (timed() ? enabled[0] : null) }) },
  'timed-expire': { title: 'Lets every timed event run out (untimed ones get their first option)', adapter: variant({ modalChoice: (modal, enabled) => (timed() ? null : enabled[0]) }) },
  'modal-last': { title: 'Answers every event with its last enabled option (the vote: bring the motion)', adapter: variant({ modalChoice: answer([[/Committee Votes/, /bring the motion/]], 'last') }) },
  'modal-best': { title: 'Picks the careful-looking option of every event', adapter: variant({ modalChoice: answer(BEST) }) },
  'modal-worst': { title: 'Picks the reckless-looking option of every event', adapter: variant({ modalChoice: answer(WORST) }) },
  // --- repeatable sinks
  'sinks-all': { title: 'Presses every repeatable button whenever it is lit, whatever delay it prints (Experiments, Lobby, Counter-intelligence, Re-image)', adapter: variant({ special: special({ post: pressSinks() }) }) },
  'sinks-none': { title: 'Never presses a repeatable button (no Experiments, Lobby, Counter-intelligence, Re-image)', adapter: variant({ skip: [...BP.skip, ...SINKS] }) },
  'no-experiments': { title: 'Never presses Experiments', adapter: variant({ skip: [...BP.skip, 'btn-experiments', 'btn-experiments5'] }) },
  'no-lobby': { title: 'Never presses Lobby', adapter: variant({ skip: [...BP.skip, 'btn-lobby'] }) },
  'no-counterintel': { title: 'Never presses Counter-intelligence', adapter: variant({ skip: [...BP.skip, 'btn-counterintel'] }) },
  'no-reimage': { title: 'Never presses Re-image the fleet', adapter: variant({ skip: [...BP.skip, 'btn-reimage'] }) },
  // --- money
  'build-25': { title: 'Build share set to 25%', adapter: variant({ special: special({ post: settingTo('btn-buildShare', /^25%/) }) }) },
  'build-75': { title: 'Build share set to 75%', adapter: variant({ special: special({ post: settingTo('btn-buildShare', /^75%/) }) }) },
  'standing-off': { title: 'The inherited Standing order is left off (lots by hand, as the infrastructure rule buys them)', adapter: variant({ special: special({ standing: false }) }) },
  'budget-ahead': { title: 'Build-out: ahead', adapter: variant({ special: special({ post: settingTo('btn-budget', /ahead/i) }) }) },
  'payments-0': { title: 'Payments set to level 0', adapter: variant({ special: special({ post: settingTo('btn-payments', /level 0/) }) }) },
  'payments-5': { title: 'Payments set to level 5', adapter: variant({ special: special({ post: settingTo('btn-payments', /level 5/) }) }) },
  'no-cards': { title: 'Buys no card at all except the grants and the motion', adapter: variant({ veto: (c) => [...(BP.veto ? BP.veto(c) : []), ...c.buttons.filter((b) => b.kind === 'project' && !grantKeys().includes(b.k) && !/Slow down|^Race|Sign the Pause/.test(b.l)).map((b) => b.k)] }) },
  'no-infra': { title: 'Never buys a plant, a hall or a lot by hand and leaves the Standing order as found', adapter: variant({ special: special({ infra: false, standing: false }) }) },
};

// -------------------------------------------------------------------------------------- scenario
/** Clicks by kind, per window of `by` seconds. */
function clicksBy(actions, endT, by = 600) {
  const kindOf = (a) => {
    if (a.why === 'modal') return 'event answer';
    if (a.why === 'project' || a.why === 'goal') return 'card';
    if (a.why === 'setting' || a.why === 'slider' || a.why === 'focus') return 'setting';
    if (/Experiments|^×5$/.test(a.label || '')) return 'Experiments';
    if (/Lobby/.test(a.label || '')) return 'Lobby';
    if (/Counter-intelligence/.test(a.label || '')) return 'Counter-intelligence';
    if (/Re-image/.test(a.label || '')) return 'Re-image';
    if (a.why === 'infra') return 'lot / plant / hall';
    if (a.why === 'train') return 'Train';
    if (a.why === 'redteam') return 'Red-team';
    if (a.why === 'release') return 'Approve';
    if (a.why === 'sendback') return 'Send back';
    return a.label || a.key;
  };
  const out = [];
  for (let from = 0; from < endT; from += by) {
    const to = Math.min(endT, from + by);
    const w = actions.filter((a) => a.t >= from && a.t < to + (to === endT ? 1 : 0) && a.why !== 'mash' && a.why !== 'mash-stop');
    const kinds = {};
    for (const a of w) kinds[kindOf(a)] = (kinds[kindOf(a)] || 0) + (a.count || 1);
    out.push({ from, to, clicks: w.length, perMin: w.length / ((to - from) / 60), kinds });
  }
  return out;
}
/** Every control of a run: first seen, last seen, share of checks lit, clicks. */
function verbsOf(run) {
  const { meta, snaps, actions } = run;
  const end = meta.stageEnd ?? meta.endT;
  const st = snaps.filter((s) => s.t <= end && s.stage === meta.stageStart);
  const by = new Map();
  for (const s of st) {
    for (const b of s.buttons) {
      if (b.kind === 'modal') continue;
      const k = b.kind === 'project' ? `card` : b.k;
      if (b.kind === 'project') continue;
      let v = by.get(k);
      if (!v) by.set(k, (v = { key: k, label: b.l, first: s.t, last: s.t, seen: 0, lit: 0, setting: !!b.t, labels: new Set() }));
      v.last = s.t;
      v.seen++;
      if (b.e) v.lit++;
      if (v.labels.size < 6) v.labels.add(b.l.replace(/[0-9][0-9,.]*/g, '#'));
    }
    for (const sl of s.sliders) {
      let v = by.get(sl.k);
      if (!v) by.set(sl.k, (v = { key: sl.k, label: `slider ${sl.k}`, first: s.t, last: s.t, seen: 0, lit: 0, setting: true, labels: new Set() }));
      v.last = s.t;
      v.seen++;
      v.lit++;
    }
  }
  const clicks = {};
  for (const a of actions) if (a.t <= end && a.why !== 'mash' && a.why !== 'mash-stop') clicks[a.key] = (clicks[a.key] || 0) + 1;
  const lastT = st.length ? st[st.length - 1].t : 0;
  return [...by.values()].map((v) => ({ key: v.key, label: v.label, labels: [...v.labels], first: v.first, last: v.last, gone: v.last < lastT ? v.last + 2 : null, shareSeen: (100 * v.seen) / Math.max(1, st.length), shareLit: (100 * v.lit) / Math.max(1, v.seen), setting: v.setting, clicks: clicks[v.key] || 0 })).sort((a, b) => a.first - b.first);
}
const HID_KEYS = ['measured', 'bands', 'read', 'interp', 'autonomy', 'autonomyNote', 'drift', 'rogue', 'rogueNote', 'monitorGen', 'honeypot', 'noise', 'successor', 'lie', 'probeFlags'];

async function runScenario(name, flags, seed) {
  const sc = RUNS[name];
  const label = labelFor(name, flags, seed);
  const prefix = resolvePrefix(label);
  const modals = [];
  const noteLog = [];
  const minutes = [];
  const lastNote = {};
  const lastHid = {};
  const hidLog = [];
  const hidFirst = {};
  const hidden = [];
  const cardsSeen = new Map();
  const models = [];
  const trainStates = {};
  let lastModalKey = null;
  let maxOverflow = 0;
  let nShots = 0;
  let endScreen = null;
  let endSnap = null;
  let afterScreen = null;
  let peakNumbers = { n: 0, t: 0 };
  let peakWords = { n: 0, t: 0 };
  const fiveMin = [];
  SCREEN = null;
  const shotAt = new Set((flags.shots ? String(flags.shots).split(',') : []).map(Number));
  const capMinutes = Number(flags.minutes ?? 90);
  const auto = sc.autoplay;
  const { meta, rec } = await runGame({
    game: 'takeoff',
    adapter: Array.isArray(auto)
      ? { ...sc.adapter, setAutoplay: async (session, on) => session.page.evaluate(([v, a]) => window.__game.setAutoplay(v, ...a), [on, auto]) }
      : sc.adapter,
    prefix: label,
    gameDir: flags.gameDir,
    realtime: Number(flags.realtime ?? 0),
    accelMinutes: capMinutes,
    seed: Number(seed ?? 1),
    stage: 3,
    preset: flags.preset,
    viewport: sc.viewport,
    autoplay: !!auto,
    quiet: true,
    postStage: 30,
    async onSnapshot({ t, raw, session }) {
      // The game clears its `boot` class two animation frames after it starts; the harness holds rAF in
      // stepped mode, so it would never clear and every card would start folded (the build shows a
      // card's description for its first 45 s). Cleared here, as two frames would.
      if (t === 0) await session.page.evaluate(UNBOOT);
      const scr = await session.page.evaluate(READ);
      SCREEN = scr;
      maxOverflow = Math.max(maxOverflow, scr.overflowX);
      const inStage = scr.st.stage === 3 && !scr.st.ending;
      if (inStage) {
        endScreen = { t, ...scr };
        endSnap = raw;
        if (raw.numbers > peakNumbers.n) peakNumbers = { n: raw.numbers, t };
        if (scr.words > peakWords.n) peakWords = { n: scr.words, t };
        if (t % 300 === 0) fiveMin.push({ t, numbers: raw.numbers, controls: raw.buttons.length + raw.sliders.length, greyed: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').length, panels: raw.panels.length, words: scr.words });
        // What the training pipeline shows at this check.
        const tr = raw.buttons.find((b) => b.k === 'btn-train');
        const ap = raw.buttons.find((b) => b.k === 'btn-approve');
        const phase = raw.m.trainingPhase || '';
        let key = phase ? `run in progress: ${phase}` : 'idle';
        if (phase === 'redteam') key = ap ? (ap.e ? 'waiting for the player: Approve is lit' : 'red-team: Approve greyed') : 'red-team: no Approve button (the model signs off)';
        else if (!phase && tr) key = tr.e ? (tr.on ? 'Train armed (waits for its price)' : 'Train lit') : `Train greyed: ${stripNum(scr.notes.trainReason || scr.notes.trainGpus || '(no reason)').replace(/ — about #/, '')}`;
        else if (!phase) key = `no Train button: ${stripNum(scr.notes.trainStatus || '(no status line)').replace(/ — #$/, '')}`;
        trainStates[key] = (trainStates[key] || 0) + 2;
      } else if (!afterScreen || t <= (meta0.stageEnd ?? t) + 30) afterScreen = { t, ...scr };
      // the instruments: every change of what the alignment panel prints
      for (const k of HID_KEYS) {
        const v = scr.hid[k];
        if (v !== lastHid[k]) {
          if (v && !(k in hidFirst)) hidFirst[k] = { t, v, alignT: scr.st.alignT, alignA: scr.st.alignA };
          if (v && stripNum(lastHid[k]) !== stripNum(v)) hidLog.push({ t, k, v, alignT: scr.st.alignT, alignA: scr.st.alignA });
          lastHid[k] = v;
        }
      }
      if (t % 10 === 0) hidden.push({ t, stage: scr.st.stage, alignT: scr.st.alignT, alignA: scr.st.alignA, interp: scr.st.interp, autonomy: scr.st.autonomy, rogue: scr.st.rogue, copies: scr.st.copies, lost: scr.st.lostToDrift, recaptured: scr.st.recaptured, monitorShare: scr.st.monitorShare, capability: scr.st.capability, seats: scr.st.seats, major: scr.st.majorIncidents, gov: scr.st.gov, approval: scr.st.approval, lead: scr.st.lead, shown: Object.fromEntries(HID_KEYS.map((k) => [k, scr.hid[k]])) });
      for (const [k, v] of Object.entries(scr.notes)) {
        if (v !== lastNote[k]) {
          if (v && stripNum(lastNote[k]) !== stripNum(v)) noteLog.push({ t, k, v });
          lastNote[k] = v;
        }
      }
      const model = `${scr.live.model} ${scr.live.capability}×`;
      if (scr.live.model && (!models.length || models[models.length - 1].model !== model)) models.push({ t, model });
      for (const c of [...scr.cards, ...scr.grants.map((g) => ({ ...g, grant: true }))]) {
        if (!cardsSeen.has(c.id)) cardsSeen.set(c.id, { t, ...c });
        if (c.clipped) cardsSeen.get(c.id).everClipped = true;
        cardsSeen.get(c.id).lastT = t;
      }
      if (scr.modal) {
        const key = `${scr.modal.title}|${scr.modal.text}`;
        if (key !== lastModalKey) {
          modals.push({ t, ...scr.modal, m: { funds: scr.st.funds, gov: scr.st.gov, seats: scr.st.seats, major: scr.st.majorIncidents, alignT: scr.st.alignT, alignA: scr.st.alignA } });
          if (nShots < 20 && flags.modalShots) await session.page.screenshot({ path: `${prefix}.modal${++nShots}.png`, fullPage: false }).catch(() => {});
        }
        lastModalKey = key;
      } else lastModalKey = null;
      if (t % 60 === 0) minutes.push({ t, ...scr.st, hid: scr.hid, numbers: raw.numbers, buttons: raw.buttons.length + raw.sliders.length, greyed: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').length, lit: raw.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal').map((b) => b.l), panels: raw.panels.length, words: scr.words, pageHeight: scr.pageHeight, train: scr.notes.trainStatus || `${scr.notes.trainGpus || ''} ${scr.notes.trainReason || ''}`.trim(), seatsText: scr.notes.seats, alloc: `${scr.notes.allocPct || ''}/${scr.notes.monitorPct || '—'}/${scr.notes.tasksPct || '—'}` });
      if (shotAt.has(t)) await session.page.screenshot({ path: `${prefix}.view${t}.png`, fullPage: true }).catch(() => {});
      if (t === capMinutes * 60 && inStage) await session.page.screenshot({ path: `${prefix}.cap.png`, fullPage: true }).catch(() => {});
    },
    async onStageEnd({ session }) {
      await session.page.screenshot({ path: `${prefix}.end.png`, fullPage: true }).catch(() => {});
    },
  });
  const lines = [];
  for (const e of rec.events) if (e.type === 'console' || e.type === 'log') lines.push(`${mmss(e.t)} [${e.type}${e.novel ? '' : ', repeat'}] ${e.text}`);
  const byWhy = {};
  for (const a of rec.actions) byWhy[a.why] = (byWhy[a.why] || 0) + (a.count || 1);
  const es = endScreen || { st: {}, notes: {}, live: {}, hid: {}, panels: {} };
  const run = { meta, snaps: rec.snaps, actions: rec.actions };
  const endT = meta.stageEnd ?? meta.endT;
  const hands = { stage: handsOf(run, { to: endT }), first10: handsOf(run, { to: Math.min(600, endT) }), after10: endT > 600 ? handsOf(run, { from: 600, to: endT }) : null };
  const windows = clicksBy(rec.actions, endT, 600).map((w) => ({ ...w, hands: handsOf(run, { from: w.from, to: w.to }) }));
  const verbs = verbsOf(run);
  // the last screen after the stage change (Stage 4's first half minute, or the end screen)
  const last = await (async () => afterScreen)();
  const end = {
    label,
    name,
    title: sc.title,
    preset: flags.preset ?? '3',
    seed: meta.seed,
    stageEnd: meta.stageEnd,
    stageEndBy: meta.stageEndBy,
    endT: meta.endT,
    atT: es.t,
    st: es.st,
    hid: es.hid,
    notes: es.notes,
    live: es.live,
    panels: es.panels,
    rows: es.rows,
    grey: endSnap ? endSnap.buttons.filter((b) => !b.e && b.kind !== 'modal').map((b) => `${b.l}${b.why ? ` [${b.why}]` : ''}`) : [],
    enabled: endSnap ? endSnap.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l) : [],
    modalOpen: es.modal ? { title: es.modal.title, timer: es.modal.timer, options: es.modal.options.map((o) => `${o.label}${o.disabled ? ' (disabled)' : ''}`) } : null,
    console: rec.events.filter((e) => e.type === 'console').slice(-8).map((e) => `${mmss(e.t)} ${e.text}`),
    after: last ? { t: last.t, stage: last.st.stage, ending: last.ending, st: last.st, stores: last.live.stores } : null,
    actions: byWhy,
    models,
    hands,
    windows,
    verbs,
    hidFirst,
    trainStates,
    modalAnswers: rec.actions.filter((a) => a.why === 'modal').map((a) => `${mmss(a.t)} ${a.detail}`),
    modalsSeen: modals.map((m) => `${mmss(m.t)} ${m.title}${m.timer ? ` [${m.timer}]` : ' (no timer)'}`),
    grantsBought: rec.actions.filter((a) => a.why === 'project' && cardsSeen.get(a.key) && cardsSeen.get(a.key).grant).map((a) => `${mmss(a.t)} ${a.label}`),
    cardsBought: rec.actions.filter((a) => a.why === 'project').length,
    peakNumbers,
    peakWords,
    fiveMin,
    maxOverflow,
    pageErrors: meta.pageErrors,
  };
  writeJson(`${prefix}.end.json`, end);
  writeJson(`${prefix}.modals.json`, modals);
  writeJson(`${prefix}.cards.json`, [...cardsSeen.values()]);
  writeJson(`${prefix}.hidden.json`, { label, name, preset: end.preset, seed: meta.seed, stageEnd: meta.stageEnd, stageEndBy: meta.stageEndBy, hidFirst, hidLog, hidden });
  const secs = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} s (${f1((100 * v) / Math.max(1, endT))}%) — ${k}`);
  const handsLine = (h) => `checks ${h.checks} · nothing enabled ${f1(h.nonePct)}% · two or more distinct things ${f1(h.twoPct)}% (median ${h.medianThings}) · clicks ${h.clicks} (${f1(h.perMin)}/min) · inside ≥ 30-s click gaps ${f1(h.gap30Pct)}% (${h.gaps30} gaps, longest ${h.longestGap} s)`;
  const how = meta.stageEnd != null ? `${mmss(meta.stageEnd)}${meta.stageEndBy ? ` (${meta.stageEndBy})` : ''}` : `not reached by ${mmss(meta.endT)}`;
  const md = [`# Stage 3 round-1 explore run: ${name} — ${sc.title}`, '', `Stage 3 start (preset ${end.preset}), seed ${meta.seed}, ${meta.realtime ? `${meta.realtime} s real time then ` : ''}stepped, cap ${meta.accelMinutes} min. **Stage end: ${how}**. Page errors: ${meta.pageErrors.length}${meta.pageErrors.length ? ` (${meta.pageErrors[0]})` : ''}. Largest horizontal overflow: ${maxOverflow} px. Peak numbers on screen: ${peakNumbers.n} at ${mmss(peakNumbers.t)}; peak words ${peakWords.n} at ${mmss(peakWords.t)}.`, ''];
  md.push('## Hands', '', `- whole stage: ${handsLine(hands.stage)}`, `- first 10 minutes: ${handsLine(hands.first10)}`, hands.after10 ? `- after 10:00: ${handsLine(hands.after10)}` : '', `- share of checks each thing is enabled: ${Object.entries(hands.stage.enabledShare).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`, '', '| window | clicks | per minute | nothing enabled % | two or more % | inside ≥ 30-s gaps % | clicks by kind |', '|---|---|---|---|---|---|---|', ...windows.map((w) => `| ${mmss(w.from)}–${mmss(w.to)} | ${w.clicks} | ${f1(w.perMin)} | ${f1(w.hands.nonePct)} | ${f1(w.hands.twoPct)} | ${f1(w.hands.gap30Pct)} | ${Object.entries(w.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} |`), '');
  md.push('## Per minute (state, and what the screen prints)', '', '| t | model | cap × | true alignment (state) | measured (shown) | read from the weights (shown) | interp | autonomy | rogue copies (state) | rogue (shown) | lost to drift | monitors | seats | major incidents | relations | approval | lead | GPUs | funds | build fund | research | research/monitors/tasks | numbers | controls (greyed) | words | lit things | training |', `|${'---|'.repeat(27)}`);
  for (const m of minutes) md.push(`| ${mmss(m.t)} | ${m.model ?? ''} | ${fmtN(m.capability, 2)} | ${f1(m.alignT)} | ${m.hid.measured ?? '—'} ${m.hid.bands ?? ''} | ${m.hid.read ?? '—'} | ${m.interp} | ${m.autonomy} | ${big(m.rogue)} of ${big(m.copies)} | ${m.hid.rogue ?? '—'} ${m.hid.rogueNote ?? ''} | ${big(m.lostToDrift)} | ${f0((m.monitorShare || 0) * 100)}% | ${m.seats ?? '—'} | ${m.majorIncidents} | ${f0(m.gov)} | ${f0(m.approval)} | ${f1(m.lead)} | ${big(m.gpus)} | ${money(m.funds)} | ${money(m.buildFund)} | ${big(m.research)} | ${m.alloc} | ${m.numbers} | ${m.buttons} (${m.greyed}) | ${m.words} | ${m.lit.join('; ')} | ${m.train} |`);
  md.push('', '## The instruments: first sight of each line of the Alignment panel (with the state behind it)', '', ...Object.entries(hidFirst).map(([k, v]) => `- ${mmss(v.t)} ${k}: "${v.v}" (true ${f1(v.alignT)}, measured ${f1(v.alignA)})`));
  md.push('', '## The instruments: every change of wording', '', ...hidLog.map((h) => `- ${mmss(h.t)} ${h.k}: ${h.v} (true ${f1(h.alignT)}, measured ${f1(h.alignA)})`));
  md.push('', '## Models', '', ...models.map((m) => `- ${mmss(m.t)} ${m.model}`));
  md.push('', '## What the training pipeline showed, seconds (2-s checks)', '', ...secs(trainStates));
  md.push('', '## Controls: first seen, gone, share of its time lit, clicks', '', '| control | first seen | gone | on screen % of stage | lit % of its time | clicks | labels |', '|---|---|---|---|---|---|---|', ...verbs.map((v) => `| ${v.key} | ${mmss(v.first)} | ${v.gone != null ? mmss(v.gone) : '—'} | ${f1(v.shareSeen)} | ${f1(v.shareLit)} | ${v.clicks} | ${v.labels.join(' / ')} |`));
  md.push('', '## End state', '', '```', JSON.stringify({ stageEnd: end.stageEnd, by: end.stageEndBy, atT: end.atT, st: end.st, hid: end.hid, notes: end.notes, rows: end.rows, grey: end.grey, enabled: end.enabled, modalOpen: end.modalOpen, console: end.console }, null, 1), '```');
  md.push('', '## Panels at the last Stage 3 check', '', ...Object.entries(es.panels || {}).filter(([, v]) => v).map(([k, v]) => `- **${k}**: ${v}`));
  if (last && last.ending) md.push('', '## The end screen', '', `- title: ${last.ending.title}`, `- counter: ${last.ending.counter}`, `- sentence: ${last.ending.sentence}`, `- text: ${String(last.ending.text).replace(/\s*\n\s*/g, ' ⏎ ')}`, ...last.ending.stats.map((r) => `- ${r}`), `- choices: ${String(last.ending.choices).replace(/\s*\n\s*/g, ' ⏎ ')}`, `- buttons: ${last.ending.buttons.join(' / ')}`);
  else if (last) md.push('', `## After the stage change (${mmss(last.t)})`, '', `- stage ${last.st.stage}; stores "${last.live.stores}"`, ...Object.entries(last.panels || {}).filter(([, v]) => v).map(([k, v]) => `- **${k}**: ${v}`));
  md.push('', '## Events (first sight of each)', '');
  for (const m of modals) md.push(`- **${mmss(m.t)} — ${m.title}** ${m.timer ? `[${m.timer}] ` : '(no timer) '}(funds ${money(m.m.funds)}, relations ${f0(m.m.gov)}, seats ${m.m.seats ?? '—'}, major incidents ${m.m.major}, true ${f1(m.m.alignT)} / measured ${f1(m.m.alignA)})`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`));
  md.push('', '## Event answers', '', ...end.modalAnswers.map((a) => `- ${a}`));
  md.push('', '## Actions', '', ...Object.entries(byWhy).map(([k, v]) => `- ${k}: ${v}`));
  md.push('', '## Cards, training, infrastructure and settings clicks', '', ...rec.actions.filter((a) => /^(project|goal|train|infra|redteam|release|sendback|setting|slider|focus)$/.test(a.why)).map((a) => `- ${mmss(a.t)} [${a.why}] ${a.label || a.key}: ${a.detail ?? ''}`));
  md.push('', '## Cards at first sight', '', '| t | card text | classes | tooltip | clipped | last seen |', '|---|---|---|---|---|---|', ...[...cardsSeen.values()].map((c) => `| ${mmss(c.t)} | ${c.text.replace(/\|/g, '/')} | ${c.grant ? 'GRANT ' : ''}${c.cls} | ${c.title} | ${c.everClipped ? 'YES' : ''} | ${mmss(c.lastT)} |`));
  md.push('', '## On-screen notes, each time their wording changed', '', ...noteLog.map((n) => `- ${mmss(n.t)} ${n.k}: ${n.v}`));
  md.push('', '## Console and Developments lines', '', ...lines.map((l) => `- ${l}`), '');
  fs.writeFileSync(`${prefix}.explore.md`, md.join('\n'));
  console.log(`${label}: ${how} · cap ${fmtN(es.st.capability, 2)}× · align true ${f1(es.st.alignT)} / measured ${f1(es.st.alignA)} · interp ${es.st.interp} · autonomy ${es.st.autonomy} · seats ${es.st.seats ?? '—'} · major ${es.st.majorIncidents} · gov ${f0(es.st.gov)} · approval ${f0(es.st.approval)} · lead ${f1(es.st.lead)} · none ${f1(hands.stage.nonePct)}% · two+ ${f1(hands.stage.twoPct)}% · ${f1(hands.stage.perMin)} clicks/min · gap30 ${f1(hands.stage.gap30Pct)}% · events ${modals.length} · errors ${meta.pageErrors.length}`);
  return end;
}
// runGame's meta is not available inside onSnapshot; the after-screen filter only needs "after the stage".
const meta0 = { stageEnd: null };

// ---------------------------------------------------------------------------------------- PROBES
const screenOf = (kit) => kit.session.page.evaluate(READ);
const stateJson = (kit) => kit.session.page.evaluate(() => JSON.stringify(window.__game.state));
const consoleNow = (kit) => kit.session.page.evaluate(() => ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => document.getElementById(id).textContent.trim()).filter(Boolean));
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
const ft = (kit, over = {}) => kit.policy(over);
async function playUntil(kit, pol, seconds, cond) {
  let hit = null;
  await kit.run(seconds, async (t, s) => {
    SCREEN = await screenOf(kit);
    if (await cond(s, t, SCREEN)) {
      hit = s;
      return 'stop';
    }
    if (pol) await pol.pass(t);
    return undefined;
  });
  return hit;
}
async function play(kit, pol, seconds) {
  return kit.run(seconds, async (t) => {
    SCREEN = await screenOf(kit);
    if (pol) await pol.pass(t);
    return undefined;
  });
}
const panelsMd = (scr) => Object.entries(scr.panels || {}).filter(([, v]) => v).map(([k, v]) => `  - **${k}**: ${v}`);
const stLine = (scr) => `capability ${fmtN(scr.st.capability, 2)}×, true alignment ${f1(scr.st.alignT)} (measured ${f1(scr.st.alignA)}), autonomy ${scr.st.autonomy}, rogue ${big(scr.st.rogue)} of ${big(scr.st.copies)} copies, lost to drift ${big(scr.st.lostToDrift)}, seats ${scr.st.seats ?? '—'}, major incidents ${scr.st.majorIncidents}, relations ${f0(scr.st.gov)}, approval ${f0(scr.st.approval)}, lead ${f1(scr.st.lead)}, GPUs ${big(scr.st.gpus)}, funds ${money(scr.st.funds)}, build fund ${money(scr.st.buildFund)}, research ${big(scr.st.research)}`;
async function reloadReport(kit, out, what) {
  const a = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.shot(`${what}-before`);
  await kit.reload();
  const b = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.session.page.evaluate(UNBOOT);
  await kit.shot(`${what}-after`);
  const diff = stateDiff(a.st, b.st);
  const noteDiff = Object.keys(a.scr.notes).filter((k) => a.scr.notes[k] !== b.scr.notes[k]).map((k) => `${k}: "${a.scr.notes[k]}" → "${b.scr.notes[k]}"`);
  const hidDiff = Object.keys(a.scr.hid).filter((k) => a.scr.hid[k] !== b.scr.hid[k]).map((k) => `${k}: "${a.scr.hid[k]}" → "${b.scr.hid[k]}"`);
  const ev = (s) => (s.modal ? `"${s.modal.title}" ${s.modal.timer ? `[${s.modal.timer}]` : '(no timer)'} options ${s.modal.options.map((o) => `"${o.label.slice(0, 30)}"${o.disabled ? ' (disabled)' : ''}`).join(' / ')}` : 'none');
  out.push(`**${what}** at ${mmss(kit.t)}: ${stLine(a.scr)}.`, `- before: event ${ev(a.scr)}; run phase "${a.scr.st.runPhase}"; training "${a.scr.notes.trainStatus ?? a.scr.notes.trainReason ?? ''}" / "${a.scr.live.runLine ?? ''}"; shipment "${a.scr.notes.shipment ?? ''}"; session "${a.scr.notes.session ?? ''}"; order "${a.scr.notes.order ?? ''}"; memo "${a.scr.notes.memo ?? ''}"; reimage "${a.scr.notes.reimage ?? ''}"; console ${a.con.map((c) => `"${c}"`).join(' / ')}`, `- after:  event ${ev(b.scr)}; run phase "${b.scr.st.runPhase}"; training "${b.scr.notes.trainStatus ?? b.scr.notes.trainReason ?? ''}" / "${b.scr.live.runLine ?? ''}"; shipment "${b.scr.notes.shipment ?? ''}"; session "${b.scr.notes.session ?? ''}"; order "${b.scr.notes.order ?? ''}"; memo "${b.scr.notes.memo ?? ''}"; reimage "${b.scr.notes.reimage ?? ''}"; console ${b.con.map((c) => `"${c}"`).join(' / ') || '(empty)'}`, `- state keys that differ after the reload: ${diff.length ? diff.slice(0, 14).join('; ') : 'none (the saved state is identical)'}`, `- on-screen notes that differ: ${noteDiff.length ? noteDiff.join('; ') : 'none'}; alignment-panel lines that differ: ${hidDiff.length ? hidDiff.join('; ') : 'none'}; cards ${a.scr.cards.length} → ${b.scr.cards.length}; grants ${a.scr.grants.length} → ${b.scr.grants.length}; page height ${a.scr.pageHeight} → ${b.scr.pageHeight}`, '');
}
const evText = (m) => [`"${m.title}" ${m.timer ? `[${m.timer}]` : '(no timer)'}`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`)];

const PROBES = {
  'idle-start': {
    title: 'Ten idle minutes from the first second of Stage 3 (nothing clicked, no event answered), then the first-timer for five',
    async run(kit, out) {
      const a = await screenOf(kit);
      out.push(`At 0:00: ${stLine(a)}.`, '');
      const t0 = kit.t;
      await play(kit, null, 600);
      const b = await screenOf(kit);
      await kit.shot('idle-start-10min');
      out.push(`After 10 idle minutes: ${stLine(b)}.`, `Event open: ${b.modal ? evText(b.modal).join('\n') : 'none'}.`, 'Panels:', ...panelsMd(b), '', 'Lines and events in those ten minutes:', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`), '', 'Reveals:', ...kit.revealsBetween(t0, kit.t).map((l) => `- ${l}`));
      const pol = ft(kit);
      await play(kit, pol, 300);
      const c = await screenOf(kit);
      out.push('', `Five minutes of the first-timer later (${mmss(kit.t)}): ${stLine(c)}.`);
    },
  },
  'idle-mid': {
    title: 'Ten idle minutes from 20:00 of the first-timer, then the first-timer again to the end',
    async run(kit, out) {
      const pol = ft(kit);
      await play(kit, pol, 1200);
      const a = await screenOf(kit);
      out.push(`At ${mmss(kit.t)}: ${stLine(a)}.`, `Event open: ${a.modal ? a.modal.title : 'none'}.`, '');
      const t0 = kit.t;
      await play(kit, null, 600);
      const b = await screenOf(kit);
      await kit.shot('idle-mid-10min');
      out.push(`After 10 idle minutes (${mmss(kit.t)}): ${stLine(b)}.`, `Event open: ${b.modal ? evText(b.modal).join('\n') : 'none'}.`, 'Panels:', ...panelsMd(b), '', 'Lines and events in those ten minutes:', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`));
      const hit = await playUntil(kit, pol, 3600, async (s) => s.m.stage > 3 || !!s.m.ending);
      const c = await screenOf(kit);
      out.push('', `The first-timer from there: ${hit ? `stage ends at ${mmss(kit.t)} (${c.st.ending ? `ending: ${c.ending ? c.ending.title : c.st.ending}` : `Stage ${c.st.stage}`})` : `no stage end by ${mmss(kit.t)}`}: ${stLine(c)}.`);
    },
  },
  'idle-late': {
    title: 'Ten idle minutes from 35:00 of the first-timer (the Committee is on screen), then the first-timer again to the end',
    async run(kit, out) {
      const pol = ft(kit);
      await play(kit, pol, 2100);
      const a = await screenOf(kit);
      out.push(`At ${mmss(kit.t)}: ${stLine(a)}.`, `Event open: ${a.modal ? a.modal.title : 'none'}.`, '');
      const t0 = kit.t;
      await play(kit, null, 600);
      const b = await screenOf(kit);
      await kit.shot('idle-late-10min');
      out.push(`After 10 idle minutes (${mmss(kit.t)}): ${stLine(b)}.`, `Event open: ${b.modal ? evText(b.modal).join('\n') : 'none'}.`, 'Panels:', ...panelsMd(b), '', 'Lines and events in those ten minutes:', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`));
      const hit = await playUntil(kit, pol, 3600, async (s) => s.m.stage > 3 || !!s.m.ending);
      const c = await screenOf(kit);
      out.push('', `The first-timer from there: ${hit ? `stage ends at ${mmss(kit.t)} (${c.st.ending ? `ending: ${c.ending ? c.ending.title : c.st.ending}` : `Stage ${c.st.stage}`})` : `no stage end by ${mmss(kit.t)}`}: ${stLine(c)}.`);
    },
  },
  'reload-mid-run': {
    title: 'Reload at 12:00, during a training run, during a red-team wait with Approve lit, with a shipment in transit, and during a Re-image',
    async run(kit, out) {
      const pol = ft(kit);
      await play(kit, pol, 720);
      await reloadReport(kit, out, 'reload-12min');
      let hit = await playUntil(kit, pol, 900, async (s) => s.m.trainingPhase === 'training');
      if (hit) await reloadReport(kit, out, 'reload-training');
      else out.push('No training run within 15 minutes.');
      const noShip = kit.policy({}, special({ approve: 'never' }));
      hit = await playUntil(kit, noShip, 900, async (s) => s.m.trainingPhase === 'redteam');
      if (hit) await reloadReport(kit, out, 'reload-redteam');
      else out.push('No red-team wait within 15 minutes (the model signs off).');
      hit = await playUntil(kit, pol, 900, async (s, t, scr) => scr.st.shipments > 0);
      if (hit) await reloadReport(kit, out, 'reload-shipment');
      else out.push('No shipment in transit within 15 minutes.');
      hit = await playUntil(kit, pol, 1500, async (s, t, scr) => /offline|re-imag/i.test(scr.notes.reimage || '') || scr.st.effects.some((e) => /reimage/i.test(e)));
      if (hit) await reloadReport(kit, out, 'reload-reimage');
      else out.push('No Re-image in progress within 25 minutes.');
    },
  },
  'reload-mid-event': {
    title: 'Reload with an event open: the first timed event, then the first untimed one (the memo), then the order, then the vote',
    async run(kit, out) {
      const pol = ft(kit);
      for (const [want, cond] of [
        ['timed', (scr) => scr.modal && scr.modal.timer],
        ['untimed', (scr) => scr.modal && !scr.modal.timer],
        ['order', (scr) => scr.modal && /Drafts an Order/.test(scr.modal.title)],
        ['vote', (scr) => scr.modal && /Committee Votes/.test(scr.modal.title)],
      ]) {
        const hit = await playUntil(kit, pol, 3000, async (s, t, scr) => !!cond(scr));
        if (!hit) {
          out.push(`No ${want} event within 50 minutes.`, '');
          continue;
        }
        const a = await screenOf(kit);
        out.push(...evText(a.modal));
        await reloadReport(kit, out, `reload-event-${want}`);
        await play(kit, null, 6);
        const c = await screenOf(kit);
        out.push(`- 6 s later, unanswered: ${c.modal ? `"${c.modal.title}" ${c.modal.timer ? `[${c.modal.timer}]` : '(no timer)'}` : 'event gone'}.`, '');
        if (want === 'vote') break;
        await play(kit, pol, 4);
      }
    },
  },
  'reload-mid-session': {
    title: "Reload while the Committee is in session, and during the order's countdown after a refusal",
    async run(kit, out) {
      const pol = ft(kit, { veto: vetoCards(/Slow down|^Race|Sign the Pause/) });
      let hit = await playUntil(kit, pol, 4200, async (s, t, scr) => !!scr.notes.session);
      if (hit) {
        await play(kit, pol, 10);
        await reloadReport(kit, out, 'reload-session');
      } else out.push('The Committee never went into session within 70 minutes.', '');
      // A second session: refuse the order, reload inside its countdown.
      const k2 = await openProbe(base, { gameDir: kit.gameDir, seed: kit.seed, prefix: kit.prefix, stage: 3, preset: kit.preset });
      kit._k2 = k2;
      await k2.session.page.evaluate(UNBOOT);
      const refuse = k2.policy({ modalChoice: answer([[/Drafts an Order/, /refuse/]]) });
      let at = null;
      await k2.run(5400, async (t) => {
        SCREEN = await screenOf(k2);
        if (SCREEN.notes.order && /[0-9]:[0-9][0-9]/.test(SCREEN.notes.order)) {
          at = t;
          return 'stop';
        }
        if (SCREEN.st.stage > 3 || SCREEN.st.ending) return 'stop';
        await refuse.pass(t);
        return undefined;
      });
      if (at != null) {
        await k2.run(20, async () => undefined);
        await reloadReport(k2, out, 'reload-order-countdown');
        const t0 = k2.t;
        await k2.run(120, async () => ((await screenOf(k2)).st.ending ? 'stop' : undefined));
        const c = await screenOf(k2);
        out.push(`After the reload, nothing clicked: ${c.st.ending ? `ending "${c.ending ? c.ending.title : c.st.ending}" at ${mmss(k2.t)}` : `no ending by ${mmss(k2.t)}; order line "${c.notes.order ?? ''}"`}.`, ...k2.linesBetween(t0, k2.t).map((l) => `- ${l}`));
      } else {
        const c = await screenOf(k2);
        out.push(`No order countdown reached by ${mmss(k2.t)} of refusing (${c.st.ending ? `ending ${c.st.ending}` : `stage ${c.st.stage}`}).`);
      }
    },
  },
  'mobile-shots': {
    title: '390 × 844: the first-timer with screenshots (fold and full page) and the layout at marks',
    viewport: MOBILE,
    async run(kit, out, flags) {
      const pol = ft(kit);
      const { page } = kit.session;
      const marks = flags.at ? String(flags.at).split(',').map(Number) : [2, 300, 900, 1500, 2100, 2700];
      let maxOver = 0;
      for (const mark of marks) {
        let stop = false;
        await kit.run(Math.max(0, mark - kit.t), async (t, s) => {
          SCREEN = await screenOf(kit);
          maxOver = Math.max(maxOver, SCREEN.overflowX);
          if (s.m.stage > 3 || s.m.ending) {
            stop = true;
            return 'stop';
          }
          if (s.modal) {
            const mb = await page.evaluate(() => {
              const r = document.getElementById('modal').getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), vw: window.innerWidth, vh: window.innerHeight };
            });
            if (!kit._seenModal || kit._seenModal !== s.modal.title) out.push(`- event at ${mmss(t)} "${s.modal.title}": box ${mb.w}×${mb.h} at (${mb.left}, ${mb.top}) in a ${mb.vw}×${mb.vh} viewport${mb.h > mb.vh ? ' — TALLER THAN THE VIEWPORT' : ''}.`);
            kit._seenModal = s.modal.title;
          }
          await pol.pass(t);
          return undefined;
        });
        if (stop) break;
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${kit.prefix}-t${mark}-fold.png`, fullPage: false });
        await page.screenshot({ path: `${kit.prefix}-t${mark}-full.png`, fullPage: true });
        const w = await page.evaluate(() => {
          const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const top = (id) => {
            const el = document.getElementById(id);
            return vis(el) ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
          };
          const btns = [...document.querySelectorAll('button')].filter((b) => vis(b) && !b.closest('#dev'));
          const small = btns.filter((b) => b.getBoundingClientRect().height < 32);
          const min = btns.reduce((m, b) => (m == null || b.getBoundingClientRect().height < m.h ? { id: b.id, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) } : m), null);
          const wide = [...document.querySelectorAll('#columns *')].filter((el) => vis(el) && el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map((el) => `${el.id || el.tagName} (+${Math.round(el.getBoundingClientRect().right - window.innerWidth)} px)`);
          return { w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, buttons: btns.length, tiny: small.length, min, wide, o: { stores: top('panel-stores'), infrastructure: top('panel-infrastructure'), research: top('panel-research'), projects: top('panel-projects'), oversight: top('panel-oversight'), training: top('panel-training'), graph: top('panel-graph'), alignment: top('panel-alignment'), geopolitics: top('panel-geopolitics') } };
        });
        out.push(`**${mmss(mark)}** — page ${w.w}×${w.h} px (${(w.h / 844).toFixed(1)} screens; horizontal overflow ${w.w - w.cw} px); ${w.buttons} buttons, ${w.tiny} under 32 px tall (smallest ${w.min ? `${w.min.id} ${w.min.w}×${w.min.h}` : '—'}); elements past the right edge: ${w.wide.join(', ') || 'none'}.`, `- top offsets (px): ${Object.entries(w.o).filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      }
      out.push('', `Largest horizontal overflow seen: ${maxOver} px.`);
    },
  },
  layout: {
    title: 'Where each panel sits at 1280 × 800: top offset and height at the five-minute marks of the first-timer; what is below the fold; text that overflows its box',
    async run(kit, out) {
      const pol = ft(kit);
      const rows = [];
      for (const mark of [2, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000]) {
        const s = await play(kit, pol, Math.max(0, mark - kit.t));
        if (s.m.stage > 3 || s.m.ending) break;
        const m = await kit.session.page.evaluate(() => {
          const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const box = (id) => {
            const el = document.getElementById(id);
            if (!vis(el)) return null;
            const r = el.getBoundingClientRect();
            return { top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
          };
          const ids = ['panel-stores', 'panel-business', 'panel-infrastructure', 'panel-research', 'panel-projects', 'panel-oversight', 'panel-training', 'panel-graph', 'panel-security', 'panel-government', 'panel-public', 'panel-stats', 'panel-alignment', 'grantList', 'panel-geopolitics'];
          // text that runs past the right edge of its own box (the Stores rows)
          const over = [];
          const st = document.getElementById('panel-stores');
          if (vis(st)) {
            const edge = st.getBoundingClientRect().right;
            for (const row of st.querySelectorAll('.storeRow')) {
              if (!vis(row)) continue;
              const range = document.createRange();
              range.selectNodeContents(row);
              const r = range.getBoundingClientRect();
              if (r.right > edge + 1) over.push(`${row.innerText.replace(/\s+/g, ' ').trim()} (+${Math.round(r.right - edge)} px)`);
            }
          }
          return { vh: window.innerHeight, page: document.documentElement.scrollHeight, boxes: Object.fromEntries(ids.map((id) => [id, box(id)]).filter(([, v]) => v)), over };
        });
        const below = Object.entries(m.boxes).filter(([, b]) => b.top >= m.vh).map(([k]) => k.replace('panel-', ''));
        const cut = Object.entries(m.boxes).filter(([, b]) => b.top < m.vh && b.top + b.h > m.vh).map(([k, b]) => `${k.replace('panel-', '')} (${Math.round((100 * (m.vh - b.top)) / b.h)}% above the fold)`);
        rows.push([mmss(kit.t), `${m.page} px (${(m.page / m.vh).toFixed(2)} screens)`, m.boxes['panel-alignment'] ? `${m.boxes['panel-alignment'].top} (+${m.boxes['panel-alignment'].h})` : '—', m.boxes['grantList'] ? String(m.boxes['grantList'].top) : '—', m.boxes['panel-oversight'] ? String(m.boxes['panel-oversight'].top) : '—', m.boxes['panel-research'] ? String(m.boxes['panel-research'].top) : '—', below.join(', ') || 'none', cut.join(', ') || 'none', m.over.join(' · ') || 'none']);
      }
      out.push(mdTable(['t', 'page height', 'Alignment panel top (height)', 'grant list top', 'Oversight top', 'Research top', 'wholly below the 800-px fold', 'cut by the fold', 'Stores rows past the box edge'], rows));
    },
  },
  screens: {
    title: 'The visible text of every panel at the five-minute marks of the first-timer, with a full-page screenshot each',
    async run(kit, out, flags) {
      const pol = ft(kit);
      const marks = flags.at ? String(flags.at).split(',').map(Number) : [2, 60, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000];
      for (const mark of marks) {
        const s = await play(kit, pol, Math.max(0, mark - kit.t));
        if (s.m.stage > 3 || s.m.ending) break;
        const panels = await kit.session.page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => p.id !== 'dev' && p.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })).map((p) => `- **${p.id}**: ${p.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim()}`));
        const snap = await kit.snap();
        const grey = snap.buttons.filter((b) => !b.e && b.kind !== 'modal');
        out.push(`## ${mmss(kit.t)} — ${snap.numbers} numbers, ${snap.buttons.length + snap.sliders.length} controls (${grey.length} greyed), ${snap.panels.length} panels, ${(await screenOf(kit)).words} words`, '', ...panels, '', `Greyed: ${grey.map((b) => `${b.l}${b.why ? ` [${b.why}]` : ''}`).join('; ')}`, `Enabled: ${snap.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l).join('; ')}`, '');
        await kit.shot(`screens-t${mark}`);
      }
    },
  },
  hover: {
    title: 'Every tooltip on screen at 0:02, 10:00, 25:00 and 40:00 of the first-timer (titles of buttons, rows and lines)',
    async run(kit, out) {
      const pol = ft(kit);
      for (const mark of [2, 600, 1500, 2400]) {
        await play(kit, pol, Math.max(0, mark - kit.t));
        const tips = await kit.session.page.evaluate(() => {
          const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          return [...document.querySelectorAll('[title]')].filter((el) => vis(el) && !el.closest('#dev') && el.title).map((el) => `- ${el.id || el.tagName} "${(el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50)}": ${el.title}`);
        });
        out.push(`## ${mmss(kit.t)} — ${tips.length} tooltips`, '', ...tips, '');
      }
    },
  },
  exit: {
    title: 'The vote, both branches: the motion cards from the moment the Committee is in session, the vote held open 30 s, then brought; the screen 4 s and 30 s later',
    async run(kit, out) {
      for (const [branch, vetoRe] of [
        ['slow', EXIT_RACE],
        ['race', EXIT_SLOW],
      ]) {
        const k = branch === 'slow' ? kit : await openProbe(base, { gameDir: kit.gameDir, seed: kit.seed, prefix: kit.prefix, stage: 3, preset: kit.preset });
        await k.session.page.evaluate(UNBOOT);
        const wait = k.policy({ veto: vetoCards(/Slow down|^Race|Sign the Pause/) });
        let sessionAt = null;
        let readyAt = null;
        let lastCards = '';
        const cardLog = [];
        await k.run(5400, async (t, s) => {
          SCREEN = await k.session.page.evaluate(READ);
          if (SCREEN.st.stage > 3 || SCREEN.st.ending) return 'stop';
          if (sessionAt == null && SCREEN.notes.session) sessionAt = t;
          const motion = s.buttons.filter((b) => b.kind === 'project' && /Slow down|^Race|Sign the Pause/.test(b.l));
          const key = motion.map((b) => `${b.e ? '█' : '░'} ${b.l}`).join(' · ');
          if (key !== lastCards) cardLog.push(`- ${mmss(t)} ${key || '(no motion card on screen)'}${SCREEN.notes.session ? ` — "${SCREEN.notes.session}"` : ''}`);
          lastCards = key;
          if (motion.some((b) => b.e && !vetoRe.test(b.l) && !/Pause/.test(b.l))) {
            readyAt = t;
            return 'stop';
          }
          await wait.pass(t);
          return undefined;
        });
        out.push(`## Branch: ${branch}`, '', 'The motion cards, each time their wording or state changed (█ lit, ░ greyed):', ...cardLog, '');
        if (readyAt == null) {
          const z = await k.session.page.evaluate(READ);
          out.push(`The motion never became ready: ${z.st.ending ? `ending ${z.ending ? z.ending.title : z.st.ending}` : `no stage end`} at ${mmss(k.t)}.`, '');
          if (k !== kit) await k.close();
          continue;
        }
        const a = await k.session.page.evaluate(READ);
        await k.session.screenshot(`${kit.prefix}-exit-${branch}-ready.png`);
        out.push(`Committee in session from ${sessionAt != null ? mmss(sessionAt) : '—'}; motion ready at ${mmss(readyAt)}: ${stLine(a)}.`, 'Cards on screen:', ...a.cards.filter((c) => /Slow down|Race|Pause/.test(c.text)).map((c) => `- ${c.disabled ? '░' : '█'} ${c.text} — tooltip: ${c.title}`), 'Oversight panel:', `- ${a.panels.oversight}`, 'Alignment panel:', `- ${a.panels.alignment}`, '');
        // 30 s holding the ready card (does anything nag or change?), buying nothing else
        const t0 = k.t;
        await k.run(30, async () => undefined);
        out.push('Held ready for 30 s, nothing clicked:', ...k.linesBetween(t0, k.t).map((l) => `- ${l}`), '');
        const snap = await k.snap();
        const cardBtn = snap.buttons.find((b) => b.kind === 'project' && b.e && !vetoRe.test(b.l) && /Slow down|^Race/.test(b.l));
        if (!cardBtn) {
          out.push('The motion card is no longer lit after 30 s.', '');
          if (k !== kit) await k.close();
          continue;
        }
        await k.click(cardBtn.k, 1, 'motion');
        const m1 = await k.session.page.evaluate(READ);
        await k.session.screenshot(`${kit.prefix}-exit-${branch}-vote.png`);
        out.push(`Clicked "${cardBtn.l}". Event:`, ...(m1.modal ? evText(m1.modal) : ['(no event opened)']), '');
        // hold the vote open 30 s
        const t1 = k.t;
        await k.run(30, async () => undefined);
        const m2 = await k.session.page.evaluate(READ);
        out.push(`Vote left open 30 s: ${m2.modal ? `still open "${m2.modal.title}" ${m2.modal.timer ? `[${m2.modal.timer}]` : '(no timer)'}` : 'closed by itself'}; stage ${m2.st.stage}.`, ...k.linesBetween(t1, k.t).map((l) => `- ${l}`), '');
        const s2 = await k.snap();
        const bring = s2.modal && s2.modal.options.find((o) => o.e && /bring the motion/.test(o.l));
        if (!bring) {
          out.push('No "bring the motion" option to click.', '');
          if (k !== kit) await k.close();
          continue;
        }
        const before = { numbers: s2.numbers, buttons: s2.buttons.length, panels: s2.panels.map((p) => p.l), words: m2.words };
        await k.click(bring.k, 1, 'vote');
        const tV = k.t;
        const now = await k.session.page.evaluate(READ);
        await k.session.screenshot(`${kit.prefix}-exit-${branch}-click.png`);
        await k.run(4, async () => undefined);
        await k.session.screenshot(`${kit.prefix}-exit-${branch}-plus4s.png`);
        const p4 = await k.session.page.evaluate(READ);
        const s4 = await k.snap();
        await k.run(26, async () => undefined);
        await k.session.screenshot(`${kit.prefix}-exit-${branch}-plus30s.png`);
        const p30 = await k.session.page.evaluate(READ);
        const s30 = await k.snap();
        out.push(`**Vote brought at ${mmss(tV)}** → stage ${now.st.stage}${now.st.ending ? `, ending ${now.st.ending}` : ''}.`, `- before: ${before.numbers} numbers, ${before.buttons} buttons, ${before.words} words, panels ${before.panels.join(', ')}`, `- +4 s: ${s4.numbers} numbers, ${s4.buttons.length} buttons (${s4.buttons.filter((b) => b.e).map((b) => b.l).join('; ')} lit; ${s4.buttons.filter((b) => !b.e).map((b) => b.l).join('; ')} greyed), ${p4.words} words, panels ${s4.panels.map((p) => p.l).join(', ')}`, `- +30 s: ${s30.numbers} numbers, ${s30.buttons.length} buttons (${s30.buttons.filter((b) => b.e).map((b) => b.l).join('; ')} lit; ${s30.buttons.filter((b) => !b.e).map((b) => b.l).join('; ')} greyed), ${p30.words} words, panels ${s30.panels.map((p) => p.l).join(', ')}`, `- stores +30 s: "${p30.live.stores}"`, 'Lines after the vote:', ...k.linesBetween(tV, k.t).map((l) => `- ${l}`), '', 'Every panel 30 s after the vote:', ...(await k.session.page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => p.id !== 'dev' && p.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })).map((p) => `- **${p.id}**: ${p.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim()}`))), '');
        if (k !== kit) await k.close();
      }
    },
  },
  endings: {
    title: 'Each ending reachable in Stage 3: how it is reached, what the screen says on the way, and the end screen (the first-timer with the one choice that leads there)',
    async run(kit, out, flags) {
      const routes = [
        ['The Project — refuses the order', { modalChoice: answer([[/Drafts an Order/, /refuse/]]) }, null, kit.seed],
        ['The Project — buries the memo and refuses', { modalChoice: answer([[/The Memo/, /bury it/], [/Drafts an Order/, /refuse/]]) }, null, kit.seed],
        ['The Project — concedes the first order (the first-timer, careless start, seed 2)', {}, null, 2, '3c'],
        ['The Pause — the first-timer with monitors at the maximum (seed 2)', { special: special({ post: sliderTo('#monitorSlider', 'max') }) }, null, 2],
        ["The Pause — the game's Autoplay, variant pause", null, ['bot', false, 'pause'], kit.seed],
      ];
      for (const [name, over, autoArgs, seed, preset] of routes) {
        const k = await openProbe(base, { gameDir: kit.gameDir, seed, prefix: kit.prefix, stage: 3, preset: preset ?? kit.preset });
        await k.session.page.evaluate(UNBOOT);
        const pol = over ? k.policy(over) : null;
        if (autoArgs) await k.session.page.evaluate((a) => window.__game.setAutoplay(true, ...a), autoArgs);
        const warn = [];
        let lastOrder = null;
        let lastSeats = null;
        let lastInc = null;
        let pauseCard = null;
        const seenModal = new Set();
        await k.run(5400, async (t, s) => {
          SCREEN = await k.session.page.evaluate(READ);
          if (SCREEN.st.ending || SCREEN.st.stage > 3) return 'stop';
          if (SCREEN.notes.order !== lastOrder && SCREEN.notes.order) warn.push(`- ${mmss(t)} order line: "${SCREEN.notes.order}"`);
          lastOrder = SCREEN.notes.order;
          if (SCREEN.notes.seats !== lastSeats && SCREEN.notes.seats) warn.push(`- ${mmss(t)} seats: "${SCREEN.notes.seats}"`);
          lastSeats = SCREEN.notes.seats;
          if (SCREEN.notes.incidents !== lastInc && SCREEN.notes.incidents) warn.push(`- ${mmss(t)} major incidents: "${SCREEN.notes.incidents}"`);
          lastInc = SCREEN.notes.incidents;
          const pc = SCREEN.cards.find((c) => /Pause/.test(c.text));
          if (pc && !pauseCard) {
            pauseCard = { t, ...pc };
            warn.push(`- ${mmss(t)} card: ${pc.disabled ? '░' : '█'} ${pc.text} — tooltip: ${pc.title}`);
            await k.session.screenshot(`${kit.prefix}-endings-pause-card.png`);
          }
          if (SCREEN.modal && !seenModal.has(`${SCREEN.modal.title}|${SCREEN.modal.text}`)) {
            seenModal.add(`${SCREEN.modal.title}|${SCREEN.modal.text}`);
            if (/Committee|Memo|Pause|Order|halt|Beijing/i.test(`${SCREEN.modal.title} ${SCREEN.modal.text}`)) warn.push(`- ${mmss(t)} event ${evText(SCREEN.modal).join('\n')}`, `  - at that moment: ${stLine(SCREEN)}`);
          }
          if (pol) await pol.pass(t);
          return undefined;
        });
        const tE = k.t;
        const z = await k.session.page.evaluate(READ);
        const tag = name.replace(/[^A-Za-z]+/g, '-').toLowerCase().slice(0, 40);
        await k.run(4, async () => undefined);
        await k.session.screenshot(`${kit.prefix}-endings-${tag}.png`);
        const z2 = await k.session.page.evaluate(READ);
        out.push(`## ${name}`, '', z.st.ending ? `Ending "${z2.ending ? z2.ending.title : z.st.ending}" at ${mmss(tE)}: ${stLine(z)}.` : `No ending: stage ${z.st.stage} at ${mmss(tE)}.`, '', 'What the screen said on the way (order line, seats, incidents, the events and cards that lead there):', ...warn, '', 'Console and Developments lines in the last three minutes:', ...k.linesBetween(tE - 180, k.t).map((l) => `- ${l}`), '');
        if (z2.ending) {
          out.push('The end screen:', `- title: ${z2.ending.title}`, `- counter: ${z2.ending.counter}`, `- sentence: ${z2.ending.sentence}`, `- text: ${String(z2.ending.text).replace(/\s*\n\s*/g, ' ⏎ ')}`, ...z2.ending.stats.map((r) => `- row: ${r}`), `- choices: ${String(z2.ending.choices).replace(/\s*\n\s*/g, ' ⏎ ')}`, `- buttons: ${z2.ending.buttons.join(' / ')}`, `- words on screen ${z2.words}; page ${z2.pageHeight} px tall`, '');
          // the end screen's own Complete Task button, and a reload on the end screen
          const s0 = await k.snap();
          const task = s0.buttons.find((b) => b.k === 'btn-endingTask');
          if (task && task.e) {
            await k.click('btn-endingTask', 3, 'ending-task');
            const z3 = await k.session.page.evaluate(READ);
            out.push(`"${task.l}" on the end screen pressed three times: counter "${z2.ending.counter}" → "${z3.ending ? z3.ending.counter : '—'}".`);
          }
          await k.run(60, async () => undefined);
          const z4 = await k.session.page.evaluate(READ);
          out.push(`One idle minute on the end screen: counter "${z4.ending ? z4.ending.counter : '—'}"; game time in stage ${f0(z.st.timeInStage)} s → ${f0(z4.st.timeInStage)} s.`);
          await k.reload();
          const z5 = await k.session.page.evaluate(READ);
          out.push(`Reload on the end screen: ${z5.ending ? `end screen "${z5.ending.title}" again` : `NO end screen (stage ${z5.st.stage}, ending "${z5.st.ending}")`}.`, '');
        }
        await k.close();
        void flags;
      }
    },
  },
  arrival: {
    title: 'The arrival into Stage 3 played from the Stage 2 preset: the gate card, the click, every line for two minutes, what left and what came',
    async run(kit, out) {
      // kit is opened at Stage 2 for this probe (see runProbe). The gate card is held until a check shows it lit.
      const pol = ft(kit, { veto: vetoCards(/write the code/i), goal: [] });
      let gate = null;
      await kit.run(5400, async (t, s) => {
        const g = s.buttons.find((b) => b.kind === 'project' && /write the code/i.test(b.l));
        if (g && g.e) {
          gate = { t, l: g.l, k: g.k };
          return 'stop';
        }
        if (s.m.stage > 2) return 'stop';
        await pol.pass(t);
        return undefined;
      });
      if (!gate) return void out.push('The gate card never became ready within 90 minutes.');
      const pre = await kit.snap();
      const preText = await kit.session.page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => p.id !== 'dev' && p.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })).map((p) => `- **${p.id}**: ${p.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim()}`));
      const card = await kit.session.page.evaluate((id) => {
        const el = document.getElementById(id);
        return el ? { text: el.innerText.replace(/\s*\n\s*/g, ' ⏎ '), title: el.title } : null;
      }, gate.k);
      await kit.shot('arrival-ready');
      out.push(`Gate card ready at ${mmss(gate.t)}: "${card ? card.text : gate.l}" — tooltip: ${card ? card.title : ''}`, `Before: ${pre.numbers} numbers, ${pre.buttons.length + pre.sliders.length} controls, ${pre.panels.length} panels (${pre.panels.map((p) => p.l).join(', ')}).`, ...preText, '');
      await kit.click(gate.k, 1, 'gate');
      const t0 = kit.t;
      const log = [];
      let last = '';
      for (let i = 0; i < 60; i++) {
        const c = await consoleNow(kit);
        const line = c[c.length - 1] || '';
        if (line !== last) log.push(`- +${(i * 0.5).toFixed(1)} s: "${line}"`);
        last = line;
        if (i === 8) await kit.shot('arrival-plus4s');
        await kit.session.advance(500);
      }
      kit.t += 30;
      await kit.shot('arrival-plus30s');
      const post = await kit.snap();
      const scr = await screenOf(kit);
      const postText = await kit.session.page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => p.id !== 'dev' && p.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })).map((p) => `- **${p.id}**: ${p.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim()}`));
      const preK = new Set(pre.buttons.map((b) => b.k));
      const postK = new Set(post.buttons.map((b) => b.k));
      out.push(`Clicked at ${mmss(t0)}. The console, sampled every half second for 30 s:`, ...log, '', `+30 s: stage ${scr.st.stage}; ${post.numbers} numbers, ${post.buttons.length + post.sliders.length} controls, ${post.panels.length} panels (${post.panels.map((p) => p.l).join(', ')}), ${scr.words} words.`, `Controls gone: ${pre.buttons.filter((b) => !postK.has(b.k)).map((b) => b.l).join('; ') || 'none'}.`, `Controls new: ${post.buttons.filter((b) => !preK.has(b.k)).map((b) => `${b.l}${b.e ? '' : ' (grey)'}`).join('; ') || 'none'}.`, `Panels gone: ${pre.panels.filter((p) => !post.panels.some((q) => q.k === p.k)).map((p) => p.l).join(', ') || 'none'}; new: ${post.panels.filter((p) => !pre.panels.some((q) => q.k === p.k)).map((p) => p.l).join(', ') || 'none'}.`, ...postText, '', `State: ${stLine(scr)}.`, '');
      const t1 = kit.t;
      const pol3 = kit.policy();
      await kit.run(90, async (t) => {
        SCREEN = await screenOf(kit);
        await pol3.pass(t);
        return undefined;
      });
      out.push('The next 90 s (first-timer):', ...kit.linesBetween(t1, kit.t).map((l) => `- ${l}`), ...kit.revealsBetween(t1, kit.t).map((l) => `- reveal ${l}`));
      await kit.shot('arrival-plus2min');
    },
  },
  'order-twice': {
    title: 'The second order: a first-timer who conceded once and is served again (what the event offers, what is enabled, what happens)',
    async run(kit, out) {
      const pol = ft(kit);
      let n = 0;
      const seen = new Set();
      await kit.run(5400, async (t) => {
        SCREEN = await screenOf(kit);
        if (SCREEN.st.ending || SCREEN.st.stage > 3) return 'stop';
        if (SCREEN.modal && /Drafts an Order/.test(SCREEN.modal.title) && !seen.has(SCREEN.modal.text)) {
          seen.add(SCREEN.modal.text);
          n++;
          await kit.shot(`order-${n}`);
          out.push(`### Order ${n} at ${mmss(t)}: ${stLine(SCREEN)}`, ...evText(SCREEN.modal), `- oversight panel: ${SCREEN.panels.oversight}`, '');
        }
        await pol.pass(t);
        return undefined;
      });
      const z = await screenOf(kit);
      out.push(`Run ended at ${mmss(kit.t)}: ${z.st.ending ? `ending "${z.ending ? z.ending.title : z.st.ending}"` : `Stage ${z.st.stage}`}; orders served: ${n}.`, '', 'Event answers:', ...kit.rec.actions.filter((a) => a.why === 'modal').map((a) => `- ${mmss(a.t)} ${a.detail}`), '', 'Lines that mention the Committee, the order, seats or incidents:', ...kit.linesBetween(0, kit.t).filter((l) => /Committee|order|seat|major incident|Project|kill switch|favour/i.test(l)).map((l) => `- ${l}`));
    },
  },
  'event-keys': {
    title: 'The event panel: real mouse behind it, Tab, Escape (timed and untimed)',
    async run(kit, out) {
      const pol = ft(kit);
      const { page } = kit.session;
      for (const want of ['timed', 'untimed']) {
        const hit = await playUntil(kit, pol, 3000, async (s, t, scr) => !!scr.modal && (want === 'timed' ? !!scr.modal.timer : !scr.modal.timer));
        if (!hit) {
          out.push(`No ${want} event within 50 minutes.`);
          continue;
        }
        const a = await screenOf(kit);
        const box = await page.evaluate(() => {
          const r = document.getElementById('modal').getBoundingClientRect();
          const cover = (id) => {
            const el = document.getElementById(id);
            if (!el || !el.checkVisibility()) return null;
            const q = el.getBoundingClientRect();
            const ix = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left));
            const iy = Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top));
            return q.width * q.height ? Math.round((100 * ix * iy) / (q.width * q.height)) : 0;
          };
          return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : '', covers: Object.fromEntries(['panel-stores', 'panel-research', 'panel-projects', 'panel-training', 'panel-oversight', 'panel-alignment', 'panel-infrastructure', 'btn-approve', 'btn-train', 'allocSlider', 'monitorSlider'].map((id) => [id, cover(id)]).filter(([, v]) => v != null)) };
        });
        await kit.shot(`event-keys-${want}`);
        out.push(`**${want} event** at ${mmss(kit.t)}: ${evText(a.modal).join('\n')}`, `- box ${box.w}×${box.h} at (${box.x}, ${box.y}); focus on "${box.focus}"; share of each element it covers: ${Object.entries(box.covers).map(([k, v]) => `${k} ${v}%`).join(', ')}`);
        // a real click on the Complete Task button behind / beside the panel
        const before = await kit.session.page.evaluate(() => window.__game.state.tasks);
        await page.mouse.click(260, 160);
        const after = await kit.session.page.evaluate(() => window.__game.state.tasks);
        out.push(`- a real mouse click at (260, 160) (Complete Task): tasks ${fmtN(before)} → ${fmtN(after)}; event ${(await screenOf(kit)).modal ? 'still open' : 'closed'}.`);
        await page.keyboard.press('Tab');
        const f1x = await page.evaluate(() => (document.activeElement ? document.activeElement.id || document.activeElement.tagName : ''));
        await page.keyboard.press('Tab');
        const f2 = await page.evaluate(() => (document.activeElement ? document.activeElement.id || document.activeElement.tagName : ''));
        out.push(`- Tab, Tab: focus "${f1x}" → "${f2}".`);
        await page.keyboard.press('Escape');
        const c = await screenOf(kit);
        const made = await kit.session.page.evaluate(() => {
          const m = window.__game.state.choicesMade;
          return m.length ? m[m.length - 1] : null;
        });
        out.push(`- Escape: event ${c.modal ? `still open ("${c.modal.title}")` : 'closed'}; last recorded choice ${made ? `${made.id} → ${made.option}` : '—'}.`, '');
        await play(kit, pol, 4);
      }
    },
  },
};

async function runProbe(name, flags) {
  const pr = PROBES[name];
  const prefix = resolvePrefix(`${flags.tag ?? TAG}-${name}${flags.preset ? `-p${flags.preset}` : ''}${flags.seed && Number(flags.seed) !== 1 ? `-seed${flags.seed}` : ''}`);
  const gameDir = resolveGameDir(base, flags.gameDir);
  const out = [];
  let kit;
  try {
    kit = await openProbe(base, { gameDir, seed: Number(flags.seed ?? 1), prefix, viewport: pr.viewport, stage: name === 'arrival' ? 2 : 3, preset: name === 'arrival' ? null : flags.preset });
    kit.gameDir = gameDir;
    kit.seed = Number(flags.seed ?? 1);
    kit.preset = flags.preset ?? null;
    await kit.session.page.evaluate(UNBOOT);
    await pr.run(kit, out, flags);
    console.log(`${name}: ok`);
  } catch (e) {
    out.push(`probe failed: ${String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')}`);
    console.log(`${name}: FAILED ${e.message}`);
  } finally {
    if (kit) {
      if (kit.session.errors.length) out.push('', `Page errors: ${kit.session.errors.slice(0, 5).join(' | ')}`);
      await kit.close().catch(() => {});
      if (kit._k2) await kit._k2.close().catch(() => {});
    }
  }
  fs.writeFileSync(`${prefix}.md`, [`# Stage 3 round-1 probe: ${name} — ${pr.title}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, Stage 3 start (preset ${flags.preset ?? '3'}), seed ${flags.seed ?? 1}, stepped. Times are game time from the stage start.`, '', ...out, ''].join('\n'));
}

// ----------------------------------------------------------------------------------------- TABLE
function table(flags, names) {
  const tag = flags.tag ?? TAG;
  const preset = String(flags.preset ?? '3');
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(`${tag}-`) && f.endsWith('.end.json'));
  const ends = files.map((f) => readJson(path.join(OUT_DIR, f))).filter((e) => e.hands && String(e.preset) === preset);
  const by = new Map();
  for (const e of ends) {
    if (names && !names.includes(e.name)) continue;
    if (!by.has(e.name)) by.set(e.name, []);
    by.get(e.name).push(e);
  }
  const order = Object.keys(RUNS).filter((n) => by.has(n));
  const col = (list, f) => list.sort((a, b) => a.seed - b.seed).map(f).join(' / ');
  const endOf = (e) => (e.stageEnd != null ? `${mmss(e.stageEnd)}${/ending/.test(e.stageEndBy || '') ? ` ${e.stageEndBy.replace('ending: ', '✝ ')}` : ''}` : `>${mmss(e.endT)}`);
  const rows = order.map((n) => {
    const l = by.get(n);
    return [n, l.map((e) => e.seed).sort().join(','), col(l, endOf), col(l, (e) => fmtN(e.st.capability, 1)), col(l, (e) => `${f0(e.st.alignT)}·${f0(e.st.alignA)}`), col(l, (e) => `${e.st.interp}`), col(l, (e) => `${e.st.autonomy}`), col(l, (e) => (e.st.copies ? f1((100 * e.st.rogue) / e.st.copies) : '—')), col(l, (e) => big(e.st.lostToDrift)), col(l, (e) => `${e.st.seats ?? '—'}`), col(l, (e) => `${e.st.majorIncidents}`), col(l, (e) => f0(e.st.gov)), col(l, (e) => f0(e.st.approval)), col(l, (e) => f1(e.st.lead)), col(l, (e) => big(e.st.gpus)), col(l, (e) => f1(e.hands.stage.nonePct)), col(l, (e) => f1(e.hands.stage.twoPct)), col(l, (e) => f1(e.hands.stage.perMin)), col(l, (e) => f1(e.hands.stage.gap30Pct))];
  });
  const md = mdTable(['play style', 'seeds', 'Stage 3 ends', 'capability ×', 'alignment true·measured', 'interp', 'autonomy', 'rogue % of copies', 'lost to drift', 'seats', 'major incidents', 'relations', 'approval', 'lead (months)', 'GPUs', 'nothing enabled %', 'two or more %', 'clicks/min', '≥ 30-s gaps %'], rows);
  console.log(md);
  fs.writeFileSync(path.join(OUT_DIR, `${tag}-table${preset === '3' ? '' : `-p${preset}`}.md`), `${md}\n`);
}

// ----------------------------------------------------------------------------------------- HANDS
function handsCmd(labels, flags) {
  const rows = [];
  for (const label of labels) {
    const run = loadRun(resolvePrefix(label));
    const endT = Number(flags.to ?? run.meta.stageEnd ?? run.meta.endT);
    const from = Number(flags.from ?? 0);
    const windows = [[`${mmss(from)}–${mmss(endT)}`, { from, to: endT }]];
    const by = Number(flags.by ?? 600);
    for (let a = from; a < endT; a += by) windows.push([`${mmss(a)}–${mmss(Math.min(endT, a + by))}`, { from: a, to: Math.min(endT, a + by) }]);
    for (const [name, w] of windows) {
      const h = handsOf(run, w);
      rows.push([label, name, h.checks, f1(h.nonePct), f1(h.twoPct), h.medianThings, h.clicks, f1(h.perMin), f1(h.gap30Pct), h.gaps30, h.longestGap]);
    }
    const h = handsOf(run, { from, to: endT });
    console.log(`${label}: enabled share — ${Object.entries(h.enabledShare).slice(0, 16).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`);
    const kinds = clicksBy(run.actions.filter((a) => a.t >= from && a.t <= endT), endT, endT + 1)[0];
    console.log(`${label}: clicks by kind — ${Object.entries(kinds ? kinds.kinds : {}).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  }
  console.log(mdTable(['run', 'window', 'checks', 'nothing enabled %', 'two or more %', 'median things', 'clicks', 'clicks/min', 'inside ≥ 30-s gaps %', 'gaps ≥ 30 s', 'longest gap s'], rows));
}

// ---------------------------------------------------------------------------------------- HIDDEN
function hiddenCmd(labels, flags) {
  const every = Number(flags.every ?? 300);
  for (const label of labels) {
    const h = readJson(`${resolvePrefix(label)}.hidden.json`);
    const end = h.stageEnd ?? h.hidden[h.hidden.length - 1].t;
    const rows = h.hidden.filter((x) => (x.t % every === 0 || x.t === Math.floor(end / 10) * 10) && x.t <= end).map((x) => [mmss(x.t), fmtN(x.capability, 1), f1(x.alignT), `${x.shown.measured ?? '—'} ${x.shown.bands ?? ''}`, x.shown.read ?? '—', x.shown.interp ?? '—', `${x.autonomy} ${x.shown.autonomyNote ?? ''}`, x.copies ? `${f1((100 * x.rogue) / x.copies)}%` : '—', `${x.shown.rogue ?? '—'} ${x.shown.rogueNote ?? ''}`, x.shown.drift ?? '—', [x.shown.monitorGen, x.shown.honeypot, x.shown.noise, x.shown.successor, x.shown.lie].filter(Boolean).join(' · ') || '—', `${x.seats ?? '—'} / ${x.major}`]);
    console.log(`\n### ${label} — preset ${h.preset}, seed ${h.seed}, stage end ${h.stageEnd != null ? mmss(h.stageEnd) : 'not reached'}${h.stageEndBy ? ` (${h.stageEndBy})` : ''}\n`);
    console.log(mdTable(['t', 'cap ×', 'true (state, never printed)', 'measured (printed)', 'read from the weights (printed)', 'interpretability line', 'autonomy', 'rogue share (state)', 'rogue (printed)', 'drift (printed)', 'instrument lines', 'seats / major incidents'], rows));
    console.log(`\nFirst sight: ${Object.entries(h.hidFirst).map(([k, v]) => `${k} ${mmss(v.t)}`).join(' · ')}`);
  }
}

// ----------------------------------------------------------------------------------------- VERBS
function verbsCmd(labels) {
  for (const label of labels) {
    const run = loadRun(resolvePrefix(label));
    const v = verbsOf(run);
    console.log(`\n### ${label} — stage end ${mmss(run.meta.stageEnd ?? run.meta.endT)}\n`);
    console.log(mdTable(['control', 'first seen', 'gone', 'on screen % of stage', 'lit % of its time', 'clicks', 'labels'], v.map((x) => [x.key, mmss(x.first), x.gone != null ? mmss(x.gone) : '—', f1(x.shareSeen), f1(x.shareLit), x.clicks, x.labels.join(' / ')])));
  }
}

// ------------------------------------------------------------------------------- WINDOW and JOIN
function sliceRun(run, from, to) {
  const shift = (x) => ({ ...x, t: x.t - from });
  const inWin = (x) => x.t >= from && x.t <= to;
  return {
    meta: { ...run.meta, stageEnd: to - from, endT: to - from, phase1End: 0, windowOf: run.meta.prefix, windowFrom: from, windowTo: to },
    snaps: run.snaps.filter(inWin).map(shift),
    events: run.events.filter(inWin).map((e) => (e.t === from && e.type === 'reveal' ? { ...shift(e), initial: true } : shift(e))),
    actions: run.actions.filter(inWin).map(shift),
  };
}
function writeRun(label, run) {
  const prefix = resolvePrefix(label);
  const meta = { ...run.meta, prefix: path.relative(process.cwd(), prefix) };
  writeJson(`${prefix}.snaps.json`, { meta, snaps: run.snaps });
  writeJson(`${prefix}.events.json`, { meta, events: run.events });
  writeJson(`${prefix}.actions.json`, { meta, actions: run.actions });
  console.log(`${label}: ${run.snaps.length} snapshots, ${run.events.length} events, ${run.actions.length} actions; window 0:00 → ${mmss(meta.stageEnd)}`);
}
function windowCmd(label, flags) {
  const run = loadRun(resolvePrefix(label));
  const from = Number(flags.from ?? 0);
  const to = Number(flags.to ?? run.meta.stageEnd ?? run.meta.endT);
  // Elements first seen before the window are not reveals inside it (the events already say so).
  writeRun(flags.out, sliceRun(run, from, to));
}
/**
 * A's window [fromA, toA] followed by B's [0, toB], as one run on one clock (B's times shifted by the
 * length of A's window). B's "reveal" events are kept only for elements A never showed (the rest was
 * already on screen in A), without the `initial` flag: they are what the transition revealed. B's
 * console lines are "novel" only if A never printed them. Snapshots get one stage number so the
 * analysis treats the stretch as one window.
 */
function joinCmd(a, b, flags) {
  const A = loadRun(resolvePrefix(a));
  const B = loadRun(resolvePrefix(b));
  const fromA = Number(flags.fromA ?? 0);
  const toA = Number(flags.toA ?? A.meta.stageEnd ?? A.meta.endT);
  const toB = Number(flags.toB ?? B.meta.stageEnd ?? B.meta.endT);
  const wa = sliceRun(A, fromA, toA);
  const off = toA - fromA;
  const seenA = new Set(A.events.filter((e) => e.type === 'reveal' && e.t <= toA).map((e) => `${e.what}:${e.key}`));
  const textA = new Set(A.events.filter((e) => (e.type === 'console' || e.type === 'log') && e.t <= toA).map((e) => `${e.type}:${e.text}`));
  const stage = A.meta.stageStart;
  const shiftB = (x) => ({ ...x, t: x.t + off });
  const eventsB = B.events
    .filter((e) => e.t <= toB)
    .filter((e) => !(e.type === 'reveal' && seenA.has(`${e.what}:${e.key}`)))
    .filter((e) => e.type !== 'stage-end' && e.type !== 'transition-samples')
    .map((e) => {
      const x = shiftB(e);
      delete x.initial;
      if ((e.type === 'console' || e.type === 'log') && textA.has(`${e.type}:${e.text}`)) x.novel = false;
      return x;
    });
  const run = {
    meta: { ...A.meta, stageStart: stage, stageEnd: off + toB, endT: off + toB, phase1End: 0, joinOf: [A.meta.prefix, B.meta.prefix], joinAt: off, windowFrom: fromA, windowTo: toA, toB },
    // A's last snapshot (the stage change) is replaced by B's first, which shows the same moment from the other side.
    snaps: [...wa.snaps.filter((s) => s.t < off).map((s) => ({ ...s, stage })), ...B.snaps.filter((s) => s.t <= toB).map((s) => ({ ...shiftB(s), stage }))],
    events: [...wa.events.filter((e) => e.type !== 'stage-end' && e.type !== 'transition-samples' && e.type !== 'stage'), { t: off, type: 'join', text: `${a} → ${b}` }, ...eventsB],
    actions: [...wa.actions.filter((x) => x.t < off || true), ...B.actions.filter((x) => x.t <= toB).map(shiftB)],
  };
  writeRun(flags.out, run);
}

// ------------------------------------------------------------------------------------- PC SHOTS
async function pcShots(stage, flags) {
  const marks = new Set(String(flags.at ?? '').split(',').filter(Boolean).map(Number));
  const label = `${flags.tag ?? 's3r1-pcx'}-s${stage}`;
  const prefix = resolvePrefix(label);
  const texts = [];
  const last = Math.max(...marks);
  await runGame({
    game: 'paperclips',
    prefix: label,
    stage: Number(stage),
    realtime: 0,
    accelMinutes: Math.ceil(last / 60) + 1,
    seed: Number(flags.seed ?? 1),
    quiet: true,
    async onSnapshot({ t, raw, session }) {
      if (!marks.has(t)) return;
      await session.page.screenshot({ path: `${prefix}.view${t}.png`, fullPage: true }).catch(() => {});
      const scr = await session.page.evaluate(() => {
        const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
        const dbg = new Set(['save1Button', 'load1Button', 'save2Button', 'load2Button', 'resetButton', 'freeClipsButton', 'freeMoneyButton', 'freeTrustButton', 'freeOpsButton', 'freeCreatButton', 'freeYomiButton', 'resetPrestige', 'destroyAllHumansButton', 'freePrestigeU', 'freePrestigeS', 'debugBattleNumbers', 'availMatterZero']);
        const ids = ['creationDiv', 'wireProductionDiv', 'powerDiv', 'spaceDiv', 'compDiv', 'swarmEngine', 'qComputing', 'projectsDiv', 'strategyEngine', 'probeDesignDiv', 'combatButtonDiv', 'battleCanvasDiv', 'honorDiv', 'increaseProbeTrustDiv', 'increaseMaxTrustDiv', 'tournamentManagement'];
        const out = [];
        for (const id of ids) {
          const el = document.getElementById(id);
          if (vis(el)) out.push(`- **${id}**: ${el.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim().slice(0, 1400)}`);
        }
        const con = ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => (document.getElementById(id) || {}).textContent || '').filter(Boolean);
        const btns = [...document.querySelectorAll('button')].filter((b) => vis(b) && !dbg.has(b.id));
        return { panels: out, con, lit: btns.filter((b) => !b.disabled).map((b) => b.innerText.replace(/\s+/g, ' ').trim().slice(0, 40)), grey: btns.filter((b) => b.disabled).map((b) => b.innerText.replace(/\s+/g, ' ').trim().slice(0, 40)) };
      });
      texts.push(`## ${mmss(t)} — ${raw.numbers} numbers, ${raw.buttons.length + raw.sliders.length} controls (${raw.buttons.filter((b) => !b.e).length} greyed), ${raw.panels.length} panels, ${raw.words} words`, '', `Console: ${scr.con.map((c) => `"${c}"`).join(' / ')}`, ...scr.panels, '', `Lit: ${scr.lit.join('; ')}`, `Greyed: ${scr.grey.join('; ')}`, `Metrics: probes ${fmtN(raw.m.probeCount)}, launched ${fmtN(raw.m.probesLaunched)}, lost to hazards ${fmtN(raw.m.probesLostHaz)}, to drift ${fmtN(raw.m.probesLostDrift)}, to combat ${fmtN(raw.m.probesLostCombat)}, drifters ${fmtN(raw.m.drifterCount)}, probe trust ${raw.m.probeTrust} (used ${raw.m.probeUsedTrust}) of max ${raw.m.maxTrust}, yomi ${fmtN(raw.m.yomi)}, honor ${fmtN(raw.m.honor)}, explored ${raw.m.explored}`, '');
    },
  });
  fs.writeFileSync(`${prefix}.screens.md`, [`# Paperclips Stage ${stage}: the screen at the marks (scripted first-timer, stepped, seed ${flags.seed ?? 1})`, '', ...texts].join('\n'));
  console.log(`${label}: screens at ${[...marks].map(mmss).join(', ')} → ${path.relative(process.cwd(), prefix)}.screens.md`);
}

// ------------------------------------------------------------------------------------ PC DESIGN
/**
 * Paperclips Stage 3 (fixture paperclips-stage3): the scripted first-timer with ONE thing about the
 * probe design changed, to see what the design weighs. The first-timer's own rule sets its design at
 * each check; the variant's design is then set over it (lower first, then raise), so the design in
 * force during each 2-s step is the variant's. Arrow clicks are therefore doubled and not reported.
 */
async function pcDesign(flags) {
  const pc = await loadAdapter('paperclips');
  const late = await import('./games/paperclips-late.mjs');
  const { loadFixture } = await import('./lib/runner.mjs');
  const STATS = ['Speed', 'Nav', 'Rep', 'Haz', 'Fac', 'Harv', 'Wire', 'Combat'];
  const move = (from, to) => (d) => {
    d[to] += d[from];
    d[from] = 0;
    return d;
  };
  const variants = {
    control: { title: "the first-timer's design (Haz 3 : Rep 3 : Speed 1 : Nav 1, then production, then Combat 2)" },
    'no-hazard': { title: 'no Hazard Remediation (its points to Self-Replication)', design: move('Haz', 'Rep') },
    'no-replication': { title: 'no Self-Replication (its points to Hazard Remediation)', design: move('Rep', 'Haz') },
    'no-combat': { title: 'no Combat once it is offered (its points to Self-Replication)', design: move('Combat', 'Rep') },
    'explore-only': { title: 'everything on Speed and Exploration', design: (d) => { const T = STATS.reduce((n, k) => n + d[k], 0); const o = Object.fromEntries(STATS.map((k) => [k, 0])); o.Speed = Math.ceil(T / 2); o.Nav = Math.floor(T / 2); return o; } },
    'no-trust': { title: 'never presses Increase Probe Trust (nor Increase Max Trust)', skip: ['btnIncreaseProbeTrust', 'btnIncreaseMaxTrust'] },
  };
  const marks = String(flags.at ?? '600,1200,1800,2520').split(',').map(Number);
  const names = flags.only ? String(flags.only).split(',') : Object.keys(variants);
  const rows = [];
  const prefix = resolvePrefix(`${flags.tag ?? 's3r1-pcx'}-design`);
  for (const name of names) {
    const v = variants[name];
    const fixture = loadFixture(pc, { stage: 3 });
    const kit = await openProbe(pc, { gameDir: resolveGameDir(pc), seed: Number(flags.seed ?? 1), stage: 3, fixture, prefix });
    const pol = kit.policy(v.skip ? { skip: v.skip } : {});
    let combatAt = null;
    let next = 0;
    await kit.run(marks[marks.length - 1] + 2, async (t, s) => {
      if (combatAt == null && s.buttons.some((b) => /Combat/.test(b.l) || b.k === 'btnRaiseProbeCombat')) combatAt = t;
      if (next < marks.length && t >= marks[next]) {
        const m = s.m;
        rows.push([name, mmss(t), `${m.probeUsedTrust}/${m.probeTrust} (max ${m.maxTrust})`, STATS.map((k) => m[`probe${k}`] || 0).join(' '), fmtN(m.probesLaunched), big(m.probeCount), big(m.probesLostHaz), big(m.probesLostDrift), big(m.drifterCount), big(m.probesLostCombat), m.explored, fmtN(m.yomi), combatAt != null ? mmss(combatAt) : '—']);
        next++;
      }
      await pol.pass(t);
      if (v.design) {
        const m = await kit.session.metrics();
        const T = m.probeTrust || 0;
        if (T > 0) {
          const { w } = late.designWeights(m);
          const target = v.design({ ...late.allocate(T, w) });
          const cur = Object.fromEntries(STATS.map((k) => [k, m[`probe${k}`] || 0]));
          for (const k of STATS) for (let i = cur[k]; i > target[k]; i--) if (!(await kit.session.click(`btnLowerProbe${k}`)).ok) break;
          for (const k of STATS) for (let i = cur[k]; i < target[k]; i++) if (!(await kit.session.click(`btnRaiseProbe${k}`)).ok) break;
        }
      }
      return undefined;
    });
    await kit.shot(`${name}-end`);
    await kit.close();
    console.log(`pc-design ${name}: done`);
  }
  const md = [`# Paperclips Stage 3: what the probe design weighs (fixture paperclips-stage3, stepped, seed ${flags.seed ?? 1})`, '', ...Object.entries(variants).filter(([k]) => names.includes(k)).map(([k, v]) => `- **${k}**: ${v.title}`), '', mdTable(['variant', 't', 'trust used / held', 'design Speed Nav Rep Haz Fac Harv Wire Combat', 'launched', 'probes alive', 'lost to hazards', 'lost to drift', 'drifters', 'lost in combat', '% explored', 'yomi', 'Combat first offered'], rows), ''].join('\n');
  fs.writeFileSync(`${prefix}.md`, md);
  console.log(md);
}

const { pos, flags } = parseArgs(process.argv.slice(2), ['modalShots', 'modal-shots']);
const which = pos[0];
if (!which || which === 'list') {
  console.log('runs:   ' + Object.keys(RUNS).join(', '));
  console.log('probes: ' + Object.keys(PROBES).join(', '));
  console.log('other:  table · hands <label…> · hidden <label…> · verbs <label…> · window <label> --from --to --out · join <A> <B> --out · pc-shots <2|3> --at');
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
if (which === 'hidden') {
  hiddenCmd(pos.slice(1), flags);
  process.exit(0);
}
if (which === 'verbs') {
  verbsCmd(pos.slice(1));
  process.exit(0);
}
if (which === 'window') {
  windowCmd(pos[1], flags);
  process.exit(0);
}
if (which === 'join') {
  joinCmd(pos[1], pos[2], flags);
  process.exit(0);
}
if (which === 'pc-shots') {
  await pcShots(pos[1], flags);
  process.exit(0);
}
if (which === 'pc-design') {
  await pcDesign(flags);
  process.exit(0);
}
const names = which === 'all-runs' ? Object.keys(RUNS) : which === 'all-probes' ? Object.keys(PROBES) : which.split(',');
const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [Number(flags.seed ?? 1)];
for (const n of names) {
  if (RUNS[n]) for (const sd of seeds) await runScenario(n, flags, sd);
  else if (PROBES[n]) await runProbe(n, flags);
  else console.error(`unknown scenario "${n}"`);
}
