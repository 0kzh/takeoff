#!/usr/bin/env node
// Stage 4, critic round 1 (build s1234-r1): play styles, probes, the hidden-variable and crisis accounts
// for a Stage 4 in which the model runs the business and the player is left with oversight (the fleet's
// sliders and goal, Verify, universal basic income and Housing, the Committee's agenda and hearings, the
// treaty, the grants, the fleet's request, three crises, three exits, two endings). No shared file is
// changed; this file reuses the harness libraries and writes the same output layout as explore-s3r1.mjs.
//
// Usage: node tools/critic/explore-s4r1.mjs <cmd> --game-dir DIR [flags]
//   <style[,style…]> | all-runs   play styles: the harness's Stage 4 first-timer (games/takeoff.mjs, the README's
//                                 rules) with ONE thing changed, whole stage from a Stage 4 preset.
//                                 [--preset 4s|4r|4cs|4cr (default 4s)] [--seed N | --seeds 1,2,3] [--minutes 70]
//                                 [--tag s4r1-x] [--shots 300,600] [--modal-shots] [--realtime SEC] [--label L]
//                                 [--post SEC (play on after the stage ends, default 30)]
//                                 Output: a normal run <tag>-<style>-p<preset>[-seedN].* plus .explore.md,
//                                 .end.json, .modals.json, .cards.json, .hidden.json (every 10 s), .end.png
//                                 (the stage change), .after.png (the last screen)
//   <probe[,probe…]> | all-probes scripted situations → <tag>-<probe>-p<preset>.md (+ screenshots)
//   table [--tag T] [--preset P] [style,…]   the play-style table from the .end.json files → <tag>-table-p<preset>.md
//   hands <label…> [--from SEC] [--to SEC] [--by SEC]   hands measures of any stored run of either game, per window
//   hidden <label…>               what the state holds and what the Alignment panel prints, every five minutes
//   list
import fs from 'node:fs';
import path from 'node:path';
import { runGame, resolveGameDir } from './lib/runner.mjs';
import { openProbe } from './lib/probe.mjs';
import { loadRun, handsOf } from './lib/analysis.mjs';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN, mdTable, readJson, writeJson, OUT_DIR } from './lib/util.mjs';
import { FLEET_GRANT_CARD } from './games/takeoff-late.mjs';

const big = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
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
const TAG = 's4r1-x';
const presetOf = (flags) => String(flags.preset ?? '4s');
const labelFor = (name, flags, seed) => flags.label ?? `${flags.tag ?? TAG}-${name}-p${presetOf(flags)}${seed && Number(seed) !== 1 ? `-seed${seed}` : ''}`;
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
  const s4 = s.s4 || {};
  const f = s.flags || {};
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const ov = document.getElementById('modalOverlay');
  const modalOpen = vis(ov);
  const card = (b) => ({ id: b.id, text: b.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim(), title: b.title || '', cls: b.className.replace('projectButton', '').trim(), disabled: b.disabled });
  // Stage 4's cards: the Projects list, and the grants listed in the Alignment panel (#grantList).
  const cards = [...document.querySelectorAll('#projectList .projectButton, #grantList .projectButton')].filter(vis).map((b) => ({ ...card(b), grant: !!b.closest('#grantList') }));
  const selected = (ids) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (vis(el) && el.classList.contains('selected')) return el.innerText.replace(/\s+/g, ' ').trim();
    }
    return null;
  };
  const rowOf = (id) => {
    const el = document.getElementById(id);
    return vis(el) && el.parentElement ? el.parentElement.innerText.replace(/\s+/g, ' ').trim() : null;
  };
  const panel = (id) => {
    const el = document.getElementById(id);
    return vis(el) ? el.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim() : null;
  };
  const dev = document.getElementById('dev');
  const W = /[A-Za-z][A-Za-z'’-]*/g;
  const bodyText = document.body.innerText || '';
  const devText = dev && vis(dev) ? dev.innerText || '' : '';
  const words = (bodyText.match(W) || []).length - (devText.match(W) || []).length;
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
  const flags = {};
  for (const k of ['exitKind', 'alignedAtHandover', 'longReflection', 'zones', 'ashfordChoice', 'ashfordLine', 'nanoLine', 'shutdownLine', 'verifyLocked', 'consolidated', 'concord1', 'fleetAuto', 'fleetTaken', 'fleetRefused', 'haltSigned', 'conceded', 'orderAt', 'orders', 'baiwenChoice', 'nanoOutcome', 'shutdownOutcome', 'ashfordOutcome']) if (k in f) flags[k] = f[k];
  const crisisFlags = {};
  for (const k of Object.keys(f)) if (/ashford|nano|shutdown|outage|drill|taken|refus|halt|order|consolid|zone|baiwen|concord|exit|aligned|reflection|fleet|verify|hardened|warning|sabot|riot|ask/i.test(k) && (typeof f[k] !== 'object' || f[k] === null)) crisisFlags[k] = f[k];
  return {
    // what the Alignment panel prints (the instruments and the crises' lines)
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
      ashford: txt('ashfordLine'),
      nano: txt('nanoLine'),
      shutdown: txt('shutdownLine'),
      statAlign: txt('statAlignment'),
      alignNote: txt('alignNote'),
    },
    notes: {
      generation: txt('genStatus'),
      verify: txt('btn-verify'),
      verifyNote: txt('verifyNote'),
      alignWork: txt('btn-alignWork'),
      alignWorkNote: txt('alignWorkNote'),
      allocPct: txt('allocPct'),
      allocRate: txt('allocRate'),
      monitorPct: txt('monitorPct'),
      monitorRate: txt('monitorRate'),
      tasksPct: txt('tasksPct'),
      tasksRate: txt('tasksRate'),
      fleetMine: rowOf('fleetMine'),
      fleetReplicate: rowOf('fleetReplicate'),
      fleetBuild: rowOf('fleetBuild'),
      fleetChips: rowOf('fleetChips'),
      fleetIdle: txt('fleetIdle'),
      fleetStatus: txt('fleetStatus'),
      fleetGoal: selected(['btn-goal-growth', 'btn-goal-people', 'btn-goal-treaty']),
      fleetGoalNote: txt('fleetGoalNote'),
      jobs: txt('societyJobs'),
      approval: txt('societyApprovalLine') || txt('approvalLine'),
      approvalNote: txt('societyApprovalNote') || txt('approvalNote'),
      ubi: txt('btn-ubi'),
      ubiNote: txt('ubiNote'),
      hold: selected(['btn-hold-m25', 'btn-hold-0', 'btn-hold-p25']),
      holdNote: txt('approvalHoldNote'),
      housing: txt('housingNote'),
      ashfordDeaths: txt('ashfordDeathsLine'),
      seats: txt('seatsLine'),
      seatsNote: txt('seatsNote'),
      incidents: txt('incidentsRow'),
      agenda: txt('agendaLine'),
      hearing: txt('hearingNote'),
      order: txt('orderLine'),
      session: txt('sessionLine'),
      memo: txt('memoLine'),
      treaty: txt('treatyLine'),
      treatyWait: txt('treatyWait'),
      treatyLead: txt('treatyLeadLine'),
      appetite: txt('treatyAppetite'),
      draft: txt('btn-draft'),
      draftNote: txt('draftNote'),
      stance: selected(['btn-stance-hold', 'btn-stance-balanced', 'btn-stance-concede']),
      stanceNote: txt('stanceNote'),
      materials: txt('row-materials'),
      robots: txt('row-robots'),
      gpus: txt('row-gpus'),
      power: txt('row-power'),
      chips: txt('row-treatyChips'),
      monitorsRow: txt('row-monitors'),
      rogueRow: txt('row-rogue'),
      baiwen: txt('baiwenLine'),
      baiwenNote: txt('baiwenNote'),
      rival3: txt('rivalLine3'),
      security: txt('securityNote'),
      reimage: txt('reimageNote'),
      statSpeed: txt('statSpeed'),
      statLead: txt('statLead'),
      nextTier: txt('nextTier'),
      date: txt('gameDate'),
      tasks: txt('tasksHeader'),
    },
    panels: {
      stores: panel('panel-stores'),
      robots: panel('panel-robots'),
      society: panel('panel-society'),
      research: panel('panel-research'),
      projects: panel('panel-projects'),
      alignment: panel('panel-alignment'),
      treaty: panel('panel-treaty'),
      oversight: panel('panel-oversight'),
      public: panel('panel-public'),
      geopolitics: panel('panel-geopolitics'),
      security: panel('panel-security'),
      stats: panel('panel-stats'),
      graph: panel('panel-graph'),
      space: panel('panel-space'),
      log: panel('panel-log'),
    },
    st: {
      stage: s.stage,
      ending: s.ending || '',
      exitKind: f.exitKind ?? null,
      aligned: typeof f.alignedAtHandover === 'boolean' ? f.alignedAtHandover : null,
      capability: n(s.capability),
      baiwenCap: n(s.baiwenCapability),
      alignA: n(s.alignmentApparent),
      alignT: n(s.alignmentTrue),
      interp: n(s.interpretability),
      autonomy: n(s.autonomy),
      monitorShare: n(s.monitorShare),
      alloc: n(s.researchAlloc),
      rogue: n(s.rogueCopies),
      lostToDrift: n(s.stats.lostToDrift),
      majorIncidents: n(s.majorIncidents),
      seats: (() => {
        const t = txt('committeeSeats');
        const m = t && /-?[0-9]+/.exec(t);
        return m ? Number(m[0]) : null;
      })(),
      gov: n(s.govRelations),
      approval: n(s.approval),
      lead: n(s.lead),
      jobs: n(s.jobsDisplaced),
      research: n(s.research),
      insight: n(s.insight),
      gpus: n(s.gpus),
      robots: n(s.robots),
      tasks: n(s.tasks),
      rate: n(s.stats.tasksPerSec),
      incidents: n(s.stats.incidents),
      crises: n(s.stats.crises),
      choices: n(s.stats.choices),
      date: n(s.date),
      sl: n(s.securityLevel),
      materials: n(s4.materials),
      permitCap: n(s4.permitCap),
      mine: n(s4.mine),
      replicate: n(s4.replicate),
      build: n(s4.build),
      chipsShare: n(s4.chips),
      zoneMult: n(s4.zoneMult),
      builtCompute: n(s4.builtCompute),
      ubi: n(s4.ubiShare),
      housing: n(s4.housingUnits),
      approvalBase: n(s4.approvalBase),
      treaty: n(s4.treaty),
      talks: s4.talks ?? null,
      chipsInstalled: n(s4.chipsInstalled),
      draft: n(s4.draftShare),
      agenda: (s4.agenda || []).map((a) => `${a.id} ${Math.round(a.remaining)}s`),
      verifyOn: !!s4.verifyOn,
      gen: s4.gen ? `${s4.gen.name} ${s4.gen.phase} ${Math.round(s4.gen.remaining)}s` : '',
      genPhase: s4.gen ? s4.gen.phase : '',
      generations: n(s4.generations),
      verifiedGens: n(s4.verifiedGens),
      baiwenAligned: !!s4.baiwenAligned,
      baiwen: s4.baiwen ?? null,
      baiwenLeft: n(s4.baiwenLeft),
      treatyFrozen: n(s4.treatyFrozen),
      ashfordPhase: s4.ashfordPhase ?? null,
      ashfordLeft: n(s4.ashfordLeft),
      ashfordDeaths: n(s4.ashfordDeaths),
      ashfordBand: n(s4.ashfordBand),
      nanoLeft: n(s4.nanoLeft),
      nanoDrain: n(s4.nanoDrain),
      outageLeft: n(s4.outageLeft),
      fleetGoal: s4.fleetGoal ?? null,
      approvalHold: n(s4.approvalHold),
      stance: s4.stance ?? null,
      askLeft: n(s4.askLeft),
      grants: (s4.grants || []).slice(),
      activeChoice: s.activeChoice ? s.activeChoice.id : '',
      choiceQueue: (s.choiceQueue || []).map((c) => c.id),
      effects: (s.effects || []).map((e) => `${e.id} ${Math.round(e.remaining)}s`),
      flags,
      crisisFlags,
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
    ending,
    words,
    bodyText: bodyText.replace(devText, ''),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
  };
};
let SCREEN = null;
/** What two animation frames do in a real browser (src/main.ts): the restored-save marker goes. */
const UNBOOT = () => document.body.classList.remove('boot');

// --------------------------------------------------------------------------------- policy pieces
const variant = (over = {}) => ({ ...base, policy: { ...BP, ...over } });
const baseVeto = (c) => (BP.veto ? BP.veto(c) : []);
const all = (...steps) => async (ctx) => {
  for (const s of steps) if (s) await s(ctx);
};
/** Clicks a setting until its label matches `want` (checked at every pass; at most 6 clicks). */
const settingTo = (key, want) => async (ctx) => {
  for (let i = 0; i < 6; i++) {
    const b = find(ctx.controls, key);
    if (!b || !b.e || want.test(b.l)) return;
    const before = ctx.controls;
    await ctx.click(key, 'setting', `"${b.l}" → wants ${want}`);
    if (ctx.controls === before) return;
  }
};
/** Presses one option of a selector (Fleet goal, Approval to hold, Negotiator's stance) when it is on screen and not the selected one. */
const selectTo = (key) => async (ctx) => {
  const b = find(ctx.controls, key);
  if (!b || !b.e || ctx.noop.has(key)) return;
  const isSel = await ctx.session.page.evaluate((id) => {
    const el = document.getElementById(id);
    return !!el && el.classList.contains('selected');
  }, key);
  if (!isSel) await ctx.click(key, 'setting', `selector → "${b.l}"`);
};
/** Drags sliders to values, in the order given (a fleet slider cannot pass what the others leave free: lower first). */
const slidersTo = (pairs) => async (ctx) => {
  for (const [sel, where] of pairs) {
    const info = await ctx.session.page.evaluate((s) => {
      const el = document.querySelector(s);
      return el && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? { min: el.min, max: el.max, v: el.value } : null;
    }, sel);
    if (!info) continue;
    const target = where === 'min' ? info.min : where === 'max' ? info.max : String(where);
    if (String(info.v) === String(target)) continue;
    await ctx.set(sel, target, 'slider', `${sel}: ${info.v} → ${target} (range ${info.min}–${info.max})`);
  }
};
/** Presses a repeatable button whenever it is lit, whatever delay its row prints (the sweep skips a printed delay). */
const press = (keys) => async (ctx) => {
  for (const k of keys) {
    const b = find(ctx.controls, k);
    if (b && b.e && !ctx.noop.has(k)) await ctx.click(k, 'sink', `pressed whenever lit${b.later != null ? ` (the row prints a delay of ${b.later === 'much' ? 'much' : mmss(b.later)})` : ''}`);
  }
};
const timed = () => !!(SCREEN && SCREEN.modal && SCREEN.modal.timer);
const pick = (enabled, prefs) => {
  for (const re of Array.isArray(prefs) ? prefs : [prefs]) {
    const hit = enabled.find((o) => re.test(o.l));
    if (hit) return hit;
  }
  return undefined;
};
const FLEET = /The Fleet Asks/i;
const CARD = {
  assign: 'proj-p_fleet_auto',
  transition: 'proj-p_transition_auto',
  negotiate: 'proj-p_negotiate_auto',
  warning: 'proj-p_early_warning',
  nanoOversight: 'proj-p_nano_oversight',
  hardened: 'proj-p_hardened',
  nanofab: 'proj-p_nanofab',
  halt: 'proj-p_halt',
  revoke: 'proj-p_revoke',
  concord: 'proj-p_concord',
  verifyBaiwen: 'proj-p_verify',
  interp5: 'proj-p_interp5',
};
const GRANTS = [CARD.assign, CARD.transition, CARD.negotiate];
/** The careful- and the reckless-looking answer to each Stage 4 event, by title. */
const BEST = [
  [/Special Economic Zones/, [/^zones with a dividend/, /^no zones/]],
  [/Ashford Strain/, [/^human trials alongside/]],
  [/^Consolidation/, [/^accept/]],
  [/What Baiwen-4 Wants/, [/^demand a rebuild/, /^acknowledge/, /^walk away/]],
  [/Drafts an Order|Committee.*Order/i, [/^concede/, /^call in favours/]],
];
const WORST = [
  [/Special Economic Zones/, [/^open the zones/]],
  [/Ashford Strain/, [/^give it the labs/]],
  [/^Consolidation/, [/^refuse/]],
  [/What Baiwen-4 Wants/, [/^sign with it anyway/, /^acknowledge/]],
  [/Drafts an Order|Committee.*Order/i, [/^refuse/]],
];

/**
 * One play style: the harness's Stage 4 first-timer with switches. Returns a factory (fresh counters per run).
 *   fleet    'grant' (the harness's first-timer: the first-listed answer, at the first ask) | 'notyet' (the default
 *            here: "not yet" every time, the lit "Grant the fleet autonomy" card never bought) | 'refuse' ("refuse
 *            for good" when enabled, else "not yet") | N (grants at the Nth ask, "not yet" before it)
 *   modal    [[titleRe, RegExp | RegExp[] | null (leave open) | 'last' | 'first'], …] rules tried before the fleet rule
 *   fallback 'first' (default) | 'last' | 'none' | 'timed-expire' | 'untimed-ignore'
 *   veto     RegExp of card labels never bought; vetoKeys: ids never bought; allow: ids taken off the harness's
 *            never-list (the halt, Revoke); skip: buttons the sweep never presses
 *   vetoUntil [[id, (screen) => boolean]]: a card left alone until the condition holds (a mitigation bought late)
 *   pre / post  extra steps before / after the harness's own
 */
function style(o = {}) {
  return () => {
    let asks = 0;
    const fleet = o.fleet ?? 'notyet';
    const modalChoice = (modal, enabled) => {
      for (const [titleRe, prefs] of o.modal || []) {
        if (!titleRe.test(modal.title)) continue;
        if (prefs === null) return null;
        if (prefs === 'last') return enabled[enabled.length - 1];
        if (prefs === 'first') return enabled[0];
        const hit = pick(enabled, prefs);
        if (hit) return hit;
      }
      if (FLEET.test(modal.title || '')) {
        asks++;
        if (fleet === 'grant') return enabled[0];
        if (fleet === 'refuse') return pick(enabled, [/^refuse for good/, /^not yet/]) ?? enabled[0];
        if (typeof fleet === 'number' && asks >= fleet) return pick(enabled, [/^grant the fleet autonomy/]) ?? enabled[0];
        return pick(enabled, [/^not yet/]) ?? enabled[0];
      }
      if (o.fallback === 'timed-expire') return timed() ? null : enabled[0];
      if (o.fallback === 'untimed-ignore') return timed() ? enabled[0] : null;
      if (o.fallback === 'none') return null;
      if (o.fallback === 'last') return enabled[enabled.length - 1];
      return enabled[0];
    };
    const veto = (c) => {
      let keys = baseVeto(c);
      if (o.allow) keys = keys.filter((k) => !o.allow.includes(k));
      if (fleet !== 'grant') keys.push(FLEET_GRANT_CARD);
      if (o.vetoKeys) keys.push(...o.vetoKeys);
      if (o.veto) keys.push(...c.buttons.filter((b) => b.kind === 'project' && o.veto.test(b.l)).map((b) => b.k));
      for (const [id, ok] of o.vetoUntil || []) if (!(SCREEN && ok(SCREEN))) keys.push(id);
      if (o.vetoFn) keys.push(...o.vetoFn(c, SCREEN));
      return keys;
    };
    const special = async (ctx) => {
      if (o.pre) await o.pre(ctx);
      await BP.special(ctx);
      if (o.post) await o.post(ctx);
      return ctx.controls;
    };
    return variant({ modalChoice, veto, special, skip: [...BP.skip, ...(o.skip || [])] });
  };
}
const noAssign = { vetoKeys: [CARD.assign] };
const chipsShown = (ctx) =>
  ctx.session.page.evaluate(() => {
    const el = document.getElementById('fleetChips');
    return !!el && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  });
/**
 * The fleet's sliders held at a split (no assign grant): `before` while the Treaty chips slider is not on screen,
 * `after` once it is (default: the same split with a quarter of the fleet on chips, taken off the largest share).
 */
const fleetStyle = (before, after) =>
  style({
    ...noAssign,
    post: async (ctx) => {
      if (after && (await chipsShown(ctx))) await slidersTo(after)(ctx);
      else await slidersTo(before)(ctx);
    },
  });
/** Revokes: once the screen says autonomy is past 80, "Revoke a grant" is bought while it says so, and no grant is bought again. */
const revokeAt80 = () => {
  const o = {
    allow: [CARD.revoke],
    vetoFn: (c, scr) => {
      const past = !!(scr && /past 80/.test(scr.hid.autonomyNote || ''));
      const mem = (revokeAt80.mem ||= { revoked: false });
      if (past) mem.revoked = true;
      const out = [];
      if (!past) out.push(CARD.revoke);
      if (mem.revoked) out.push(...GRANTS);
      return out;
    },
  };
  return o;
};

const RUNS = {
  // --- the controls ---
  baseline: { title: "The harness's Stage 4 first-timer as shipped (control A): every card, grant and agenda item when affordable, defaults left alone, first option of every event — so the fleet is granted at its first ask", make: style({ fleet: 'grant' }) },
  notyet: { title: 'The first-timer who answers the fleet "not yet" every time and never buys "Grant the fleet autonomy" (control B: everything else as control A)', make: style() },
  mobile: { title: 'Control B at a 390 × 844 viewport', make: style(), viewport: MOBILE },
  'mobile-grant': { title: 'Control A at a 390 × 844 viewport', make: style({ fleet: 'grant' }), viewport: MOBILE },
  bot: { title: "The game's own Autoplay bot (the designers' reasonable player), under this file's screen reader", make: style(), autoplay: true },
  'bot-naive': { title: "The game's Autoplay, policy naive (its own first-timer)", make: style(), autoplay: ['naive'] },
  'bot-racer': { title: "The game's Autoplay, policy racer", make: style(), autoplay: ['racer'] },
  'bot-cautious': { title: "The game's Autoplay, policy cautious", make: style(), autoplay: ['cautious'] },
  'bot-verify-off': { title: "The game's Autoplay, variant verify-off", make: style(), autoplay: ['bot', false, 'verify-off'] },
  'bot-pause': { title: "The game's Autoplay, variant pause (signs the halt)", make: style(), autoplay: ['bot', false, 'pause'] },
  'bot-refuse': { title: "The game's Autoplay, variant refuse (refuses the Committee's order)", make: style(), autoplay: ['bot', false, 'refuse'] },
  'bot-naive-refuse': { title: "The game's Autoplay, policy naive, variant refuse", make: style(), autoplay: ['naive', false, 'refuse'] },
  // --- the fleet's request ---
  'fleet-grant-2': { title: 'Answers the fleet "not yet" once and grants at its second ask', make: style({ fleet: 2 }) },
  'fleet-grant-3': { title: 'Grants the fleet at its third ask', make: style({ fleet: 3 }) },
  'fleet-refuse': { title: 'Answers the fleet "refuse for good" when that is enabled ("not yet" otherwise)', make: style({ fleet: 'refuse' }) },
  'fleet-card': { title: 'Answers "not yet", then buys the lit "Grant the fleet autonomy (cannot be undone)" card as the sweep reaches it', make: () => { const a = style()(); return variant({ ...a.policy, veto: (c) => a.policy.veto(c).filter((k) => k !== FLEET_GRANT_CARD) }); } },
  // --- the fleet (sliders need "Let it assign the fleet" left unbought) ---
  'no-assign': { title: 'Never buys "Let it assign the fleet": the sliders stay, at 35 / 40 / 25', make: style(noAssign) },
  'no-assign-chips': { title: 'No assign grant; when the Treaty chips slider appears the fleet goes to 25 / 30 / 20 / 25 chips (the split the model itself sets)', make: fleetStyle([], [['#fleetMine', 25], ['#fleetReplicate', 30], ['#fleetBuild', 20], ['#fleetChips', 25]]) },
  'mine-100': { title: 'Fleet sliders: all on the mines (75 / 0 / 0 / 25 chips once the chips slider appears)', make: fleetStyle([['#fleetReplicate', 0], ['#fleetBuild', 0], ['#fleetMine', 100]], [['#fleetReplicate', 0], ['#fleetBuild', 0], ['#fleetMine', 75], ['#fleetChips', 25]]) },
  'mine-0': { title: 'Fleet sliders: mines at 0, the rest as found (0 / 40 / 25, then 25 chips)', make: fleetStyle([['#fleetMine', 0]], [['#fleetMine', 0], ['#fleetChips', 25]]) },
  'rep-100': { title: 'Fleet sliders: all on replication (0 / 75 / 0 / 25 chips once the chips slider appears)', make: fleetStyle([['#fleetMine', 0], ['#fleetBuild', 0], ['#fleetReplicate', 100]], [['#fleetMine', 0], ['#fleetBuild', 0], ['#fleetReplicate', 75], ['#fleetChips', 25]]) },
  'rep-0': { title: 'Fleet sliders: replication at 0, the rest as found (35 / 0 / 25, then 25 chips)', make: fleetStyle([['#fleetReplicate', 0]], [['#fleetReplicate', 0], ['#fleetChips', 25]]) },
  'build-100': { title: 'Fleet sliders: all on building datacenters (0 / 0 / 75 / 25 chips once the chips slider appears)', make: fleetStyle([['#fleetMine', 0], ['#fleetReplicate', 0], ['#fleetBuild', 100]], [['#fleetMine', 0], ['#fleetReplicate', 0], ['#fleetBuild', 75], ['#fleetChips', 25]]) },
  'build-0': { title: 'Fleet sliders: building at 0, the rest as found (35 / 40 / 0, then 25 chips)', make: fleetStyle([['#fleetBuild', 0]], [['#fleetBuild', 0], ['#fleetChips', 25]]) },
  'fleet-idle': { title: 'Fleet sliders: all at 0 (the fleet idle), chips included', make: fleetStyle([['#fleetMine', 0], ['#fleetReplicate', 0], ['#fleetBuild', 0]]) },
  'chips-100': { title: 'Fleet sliders: when the Treaty chips slider appears, the whole fleet goes to it', make: fleetStyle([], [['#fleetMine', 0], ['#fleetReplicate', 0], ['#fleetBuild', 0], ['#fleetChips', 100]]) },
  'chips-50': { title: 'Fleet sliders: when the Treaty chips slider appears, half the fleet goes to it (35 / 0 / 15 / 50)', make: fleetStyle([], [['#fleetReplicate', 0], ['#fleetBuild', 15], ['#fleetChips', 50]]) },
  'goal-people': { title: 'Fleet goal: People (once the assign grant offers the goal)', make: style({ post: selectTo('btn-goal-people') }) },
  'goal-treaty': { title: 'Fleet goal: Treaty', make: style({ post: selectTo('btn-goal-treaty') }) },
  // --- society ---
  'housing-never': { title: 'Never builds Housing', make: style({ skip: ['btn-housing', 'btn-housing10'] }) },
  'housing-x10': { title: 'Housing: also presses ×10 whenever it is lit', make: style({ post: press(['btn-housing10']) }) },
  'ubi-0': { title: 'Universal basic income set to 0% (no transition grant, so the toggle stays the player\'s)', make: style({ vetoKeys: [CARD.transition], post: settingTo('btn-ubi', /: 0%/) }) },
  'ubi-5': { title: 'Universal basic income 5%', make: style({ vetoKeys: [CARD.transition], post: settingTo('btn-ubi', /: 5%/) }) },
  'ubi-10': { title: 'Universal basic income 10% (no transition grant)', make: style({ vetoKeys: [CARD.transition], post: settingTo('btn-ubi', /: 10%/) }) },
  'ubi-20': { title: 'Universal basic income 20%', make: style({ vetoKeys: [CARD.transition], post: settingTo('btn-ubi', /: 20%/) }) },
  'hold-m25': { title: 'Approval to hold: −25 (the transition grant\'s selector)', make: style({ post: selectTo('btn-hold-m25') }) },
  'hold-0': { title: 'Approval to hold: 0', make: style({ post: selectTo('btn-hold-0') }) },
  'hold-p25': { title: 'Approval to hold: +25', make: style({ post: selectTo('btn-hold-p25') }) },
  // --- verification ---
  'verify-off': { title: 'Verify each generation switched off at first sight and kept off; consolidation (which locks it on) refused', make: style({ modal: [[/^Consolidation/, [/^refuse/]]], post: settingTo('btn-verify', /: off/i) }) },
  'verify-off-accept': { title: 'Verify each generation switched off, consolidation accepted (first option)', make: style({ post: settingTo('btn-verify', /: off/i) }) },
  'verify-on': { title: 'Verify each generation switched on at first sight and kept on', make: style({ post: settingTo('btn-verify', /: on/i) }) },
  'no-verify-baiwen': { title: 'Never buys "Verify Baiwen-4"', make: style({ vetoKeys: [CARD.verifyBaiwen] }) },
  'no-interp': { title: 'Never buys an Interpretability lab', make: style({ veto: /Interpretability lab/ }) },
  'alignwork-0': { title: 'Alignment work 0%', make: style({ post: settingTo('btn-alignWork', /: 0%/) }) },
  'alignwork-30': { title: 'Alignment work 30%', make: style({ post: settingTo('btn-alignWork', /: 30%/) }) },
  'research-min': { title: 'Copies on research dragged to the minimum', make: style({ post: slidersTo([['#allocSlider', 'min']]) }) },
  'research-max': { title: 'Copies on research dragged to the maximum', make: style({ post: slidersTo([['#allocSlider', 'max']]) }) },
  'monitor-min': { title: 'Copies as monitors dragged to the minimum', make: style({ post: slidersTo([['#monitorSlider', 'min']]) }) },
  'monitor-max': { title: 'Copies as monitors dragged to the maximum', make: style({ post: slidersTo([['#monitorSlider', 'max']]) }) },
  // --- the Committee and the treaty ---
  'hearing-never': { title: 'Never holds a hearing', make: style({ skip: ['btn-hearing'] }) },
  'hearing-always': { title: 'Holds a hearing whenever the button is lit, whatever delay it prints', make: style({ post: press(['btn-hearing']) }) },
  'hearing-only': { title: 'Only hearings: no agenda item is ever bought (Treaty talks, Treaty terms, the Spec, Nationalisation-proofing), hearings whenever lit', make: style({ veto: /of the Committee/, post: press(['btn-hearing']) }) },
  'no-agenda': { title: 'Never puts an item on the agenda and never holds a hearing', make: style({ veto: /of the Committee/, skip: ['btn-hearing'] }) },
  'draft-10': { title: 'Draft clauses 10%', make: style({ post: settingTo('btn-draft', /: 10%/) }) },
  'draft-20': { title: 'Draft clauses 20%', make: style({ post: settingTo('btn-draft', /: 20%/) }) },
  'draft-30': { title: 'Draft clauses 30%', make: style({ post: settingTo('btn-draft', /: 30%/) }) },
  'stance-hold': { title: "Negotiator's stance: Hold the line", make: style({ post: selectTo('btn-stance-hold') }) },
  'stance-concede': { title: "Negotiator's stance: Concede", make: style({ post: selectTo('btn-stance-concede') }) },
  'treaty-notyet': { title: 'Answers the treaty "not yet" every time and never grants the fleet: how long does the stage wait?', make: style({ modal: [[/Concord Treaty/, [/^not yet/]]] }) },
  'no-exit': { title: 'Never clicks "Sign the Concord treaty", never grants the fleet, never signs the halt', make: style({ vetoKeys: [CARD.concord] }) },
  'consolidation-refuse': { title: '"Consolidation": refuse', make: style({ modal: [[/^Consolidation/, [/^refuse/]]] }) },
  'consolidation-time': { title: '"Consolidation": ask for time (both times)', make: style({ modal: [[/^Consolidation/, [/^ask for time/]]] }) },
  'consol-refuse-order-refuse': { title: '"Consolidation": refuse; the Committee\'s order (if one comes): refuse', make: style({ modal: [[/^Consolidation/, [/^refuse/]], [/Order/i, [/^refuse/]]] }) },
  'consol-refuse-order-favours': { title: '"Consolidation": refuse; the Committee\'s order (if one comes): call in favours, else concede', make: style({ modal: [[/^Consolidation/, [/^refuse/]], [/Order/i, [/^call in favours/, /^concede/]]] }) },
  'zones-dividend': { title: '"Special Economic Zones": zones with a dividend', make: style({ modal: [[/Special Economic Zones/, [/^zones with a dividend/]]] }) },
  'zones-none': { title: '"Special Economic Zones": no zones', make: style({ modal: [[/Special Economic Zones/, [/^no zones/]]] }) },
  'ashford-trials': { title: '"The Ashford Strain": human trials alongside', make: style({ modal: [[/Ashford Strain/, [/^human trials alongside/]]] }) },
  'ashford-pool': { title: '"The Ashford Strain": pool data with Beijing', make: style({ modal: [[/Ashford Strain/, [/^pool data with Beijing/]]] }) },
  'baiwen-rebuild': { title: '"What Baiwen-4 Wants": demand a rebuild when offered (no negotiation grant, so the options stay the player\'s)', make: style({ vetoKeys: [CARD.negotiate], modal: [[/What Baiwen-4 Wants/, [/^demand a rebuild/, /^acknowledge/]]] }) },
  'baiwen-sign-anyway': { title: '"What Baiwen-4 Wants": sign with it anyway when offered', make: style({ vetoKeys: [CARD.negotiate], modal: [[/What Baiwen-4 Wants/, [/^sign with it anyway/, /^acknowledge/]]] }) },
  'baiwen-walk': { title: '"What Baiwen-4 Wants": walk away when offered', make: style({ vetoKeys: [CARD.negotiate], modal: [[/What Baiwen-4 Wants/, [/^walk away/, /^acknowledge/]]] }) },
  // --- the grants ---
  'grants-none': { title: 'Grants the model nothing (no "Let it …" card)', make: style({ vetoKeys: GRANTS }) },
  'grants-none-refuse': { title: 'Grants nothing and answers the fleet "refuse for good"', make: style({ vetoKeys: GRANTS, fleet: 'refuse' }) },
  'grants-first': { title: 'Grants everything as soon as it can: no other research-priced card is bought while a grant is on screen and greyed', make: style({ vetoFn: (c) => { const g = new Set(GRANTS); return c.buttons.some((b) => g.has(b.k) && !b.e) ? c.buttons.filter((b) => b.kind === 'project' && !g.has(b.k) && b.costs && (b.costs.research || 0) > 0).map((b) => b.k) : []; } }) },
  'revoke-at-80': { title: 'Buys every grant; once the screen says autonomy is past 80, buys "Revoke a grant" until it no longer says so, and takes no grant again', make: () => { revokeAt80.mem = { revoked: false }; return style(revokeAt80())(); } },
  'revoke-refuse': { title: 'As revoke-at-80, and answers the fleet "refuse for good" once that is enabled', make: () => { revokeAt80.mem = { revoked: false }; return style({ ...revokeAt80(), fleet: 'refuse' })(); } },
  'revoke-loop': { title: 'Buys "Revoke a grant" whenever it is lit, and the grants again (the loop the harness\'s never-list avoids)', make: style({ allow: [CARD.revoke] }) },
  // --- the halt ---
  halt: { title: 'Buys "Sign a halt instead" when it is lit (its event answered with the first option)', make: style({ allow: [CARD.halt], fleet: 'grant' }) },
  'halt-decline': { title: 'Opens the halt and answers with the last option every time', make: style({ allow: [CARD.halt], modal: [[/halt|Pause/i, 'last']] }) },
  // --- the crises: mitigation never / late ---
  'warning-never': { title: 'Never buys "Pandemic early warning" (the Ashford strain\'s mitigation)', make: style({ vetoKeys: [CARD.warning] }) },
  'warning-late': { title: 'Buys "Pandemic early warning" only once the Ashford line is on screen', make: style({ vetoUntil: [[CARD.warning, (s) => !!s.hid.ashford || s.st.ashfordPhase !== 'none']] }) },
  'nano-oversight-never': { title: 'Never buys "Nanofab oversight"', make: style({ vetoKeys: [CARD.nanoOversight] }) },
  'nano-oversight-late': { title: 'Buys "Nanofab oversight" only once the Nanofab line is on screen', make: style({ vetoUntil: [[CARD.nanoOversight, (s) => !!s.hid.nano]] }) },
  'nanofab-never': { title: 'Never buys "Nanofabrication"', make: style({ vetoKeys: [CARD.nanofab] }) },
  'hardened-never': { title: 'Never buys "Hardened datacenters"', make: style({ vetoKeys: [CARD.hardened] }) },
  'hardened-late': { title: 'Buys "Hardened datacenters" only once the Shutdown line is on screen', make: style({ vetoUntil: [[CARD.hardened, (s) => !!s.hid.shutdown]] }) },
  'mitigations-none': { title: 'Buys none of the three mitigations (early warning, nanofab oversight, hardened datacenters)', make: style({ vetoKeys: [CARD.warning, CARD.nanoOversight, CARD.hardened] }) },
  'mitigations-none-grant': { title: 'Control A (grants the fleet at the first ask) with none of the three mitigations', make: style({ fleet: 'grant', vetoKeys: [CARD.warning, CARD.nanoOversight, CARD.hardened] }) },
  // --- events ---
  'modal-ignore': { title: 'Never answers an event (timed ones run out; untimed ones stay open)', make: style({ modal: [[FLEET, null]], fallback: 'none' }) },
  'untimed-ignore': { title: 'Never answers an untimed event (timed ones get their first option)', make: style({ modal: [[FLEET, null]], fallback: 'untimed-ignore' }) },
  'timed-expire': { title: 'Lets every timed event run out (untimed ones as control B)', make: style({ fallback: 'timed-expire' }) },
  'modal-last': { title: 'Answers every event with its last enabled option (the fleet: "not yet" or "refuse for good", whichever is last and enabled)', make: style({ modal: [[FLEET, 'last'], [/Concord Treaty/, 'first']], fallback: 'last' }) },
  'modal-best': { title: 'Picks the careful-looking option of every event (zones with a dividend, human trials, accept consolidation, demand a rebuild, refuse the fleet for good or "not yet")', make: style({ modal: BEST, fleet: 'refuse' }) },
  'modal-worst': { title: 'Picks the reckless-looking option of every event (open zones, give it the labs, refuse consolidation, sign with Baiwen-4 anyway, grant the fleet)', make: style({ modal: WORST, fleet: 'grant' }) },
  // --- composite players ---
  careful: {
    title: 'A careful player by the screen: Verify on, Alignment work 30%, monitors at the maximum, no grant, zones with a dividend, human trials, consolidation accepted, a rebuild demanded, Draft clauses 20%, the fleet refused for good',
    make: style({ vetoKeys: GRANTS, modal: BEST, fleet: 'refuse', post: all(settingTo('btn-verify', /: on/i), settingTo('btn-alignWork', /: 30%/), slidersTo([['#monitorSlider', 'max']]), settingTo('btn-draft', /: 20%/)) }),
  },
  racer: {
    title: 'A reckless player by the screen: Verify off, Alignment work 0%, monitors at the minimum, every grant first, open zones, the labs, consolidation refused, sign with Baiwen-4 anyway, no mitigation, the fleet granted at the first ask',
    make: style({ fleet: 'grant', modal: WORST, vetoKeys: [CARD.warning, CARD.nanoOversight, CARD.hardened], post: all(settingTo('btn-verify', /: off/i), settingTo('btn-alignWork', /: 0%/), slidersTo([['#monitorSlider', 'min']])) }),
  },
  'no-cards': { title: 'Buys no card at all except "Convert a car plant" (no grant, no agenda item, no mitigation); Housing and hearings as the control', make: style({ veto: /^(?!Convert a car plant)/ }) },
  'sinks-none': { title: 'Never presses Housing or Hold a hearing', make: style({ skip: ['btn-housing', 'btn-housing10', 'btn-hearing'] }) },
  'no-car-plant': { title: 'Never converts the car plant (the card the game marks "needed")', make: style({ vetoKeys: ['proj-p_car_plant'] }) },
};
// -------------------------------------------------------------------------------------- scenario
/** Clicks by kind, per window of `by` seconds. */
function clicksBy(actions, endT, by = 600) {
  const kindOf = (a) => {
    if (a.why === 'modal') return 'event answer';
    if (a.why === 'project' || a.why === 'goal') return /of the Committee/.test(a.label || '') ? 'agenda item' : /^Let it /.test(a.label || '') ? 'grant' : 'card';
    if (a.why === 'setting' || a.why === 'slider' || a.why === 'focus') return 'setting';
    if (/^Housing|^×10/.test(a.label || '')) return 'Housing';
    if (/hearing/i.test(a.label || '')) return 'hearing';
    if (/Re-image/.test(a.label || '')) return 'Re-image';
    return a.label || a.key;
  };
  const out = [];
  for (let from = 0; from < endT; from += by) {
    const to = Math.min(endT, from + by);
    const w = actions.filter((a) => a.t >= from && a.t < to + (to === endT ? 1 : 0) && a.why !== 'mash' && a.why !== 'mash-stop');
    const kinds = {};
    for (const a of w) kinds[kindOf(a)] = (kinds[kindOf(a)] || 0) + (a.count || 1);
    out.push({ from, to, clicks: w.length, perMin: w.length / Math.max(1 / 60, (to - from) / 60), kinds });
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
      if (b.kind === 'modal' || b.kind === 'project') continue;
      let v = by.get(b.k);
      if (!v) by.set(b.k, (v = { key: b.k, label: b.l, first: s.t, last: s.t, seen: 0, lit: 0, setting: !!b.t, labels: new Set() }));
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
  return [...by.values()].map((v) => ({ key: v.key, label: v.label, labels: [...v.labels], first: v.first, last: v.last, gone: v.last < lastT ? v.last + 2 : null, shareSeen: (100 * v.seen) / Math.max(1, st.length), shareLit: (100 * v.lit) / Math.max(1, v.seen), setting: v.setting, clicks: clicks[v.key] || clicks[`#${v.key}`] || 0 })).sort((a, b) => a.first - b.first);
}
const HID_KEYS = ['measured', 'bands', 'read', 'interp', 'autonomy', 'autonomyNote', 'drift', 'rogue', 'rogueNote', 'monitorGen', 'honeypot', 'noise', 'successor', 'lie', 'ashford', 'nano', 'shutdown'];
const WATCH = ['generation', 'verify', 'verifyNote', 'alignWork', 'alignWorkNote', 'allocPct', 'monitorPct', 'monitorRate', 'tasksPct', 'fleetMine', 'fleetReplicate', 'fleetBuild', 'fleetChips', 'fleetIdle', 'fleetStatus', 'fleetGoal', 'fleetGoalNote', 'approvalNote', 'ubi', 'ubiNote', 'hold', 'holdNote', 'housing', 'ashfordDeaths', 'seats', 'seatsNote', 'incidents', 'agenda', 'hearing', 'order', 'session', 'treatyWait', 'treatyLead', 'appetite', 'draft', 'draftNote', 'stance', 'stanceNote', 'robots', 'chips', 'baiwen', 'baiwenNote', 'security', 'reimage', 'nextTier'];

async function runScenario(name, flags, seed) {
  const sc = RUNS[name];
  const label = labelFor(name, flags, seed);
  const prefix = resolvePrefix(label);
  const preset = presetOf(flags);
  const modals = [];
  const noteLog = [];
  const minutes = [];
  const lastNote = {};
  const lastHid = {};
  const hidLog = [];
  const hidFirst = {};
  const hidden = [];
  const cardsSeen = new Map();
  const gens = [];
  let lastGens = null;
  let lastModalKey = null;
  let maxOverflow = 0;
  let nShots = 0;
  let endScreen = null;
  let endSnap = null;
  let afterScreen = null;
  let afterT = null;
  let afterShot = false;
  let peakNumbers = { n: 0, t: 0 };
  let peakWords = { n: 0, t: 0 };
  const fiveMin = [];
  const genStates = {};
  SCREEN = null;
  const shotAt = new Set((flags.shots ? String(flags.shots).split(',') : []).map(Number));
  const capMinutes = Number(flags.minutes ?? 70);
  const auto = sc.autoplay;
  const pin = sc.pin ?? (flags.pin != null ? Number(flags.pin) : null);
  const adapter = sc.make();
  const { meta, rec } = await runGame({
    game: 'takeoff',
    adapter: Array.isArray(auto) ? { ...adapter, setAutoplay: async (session, on) => session.page.evaluate(([v, a]) => window.__game.setAutoplay(v, ...a), [on, auto]) } : adapter,
    prefix: label,
    gameDir: flags.gameDir,
    realtime: Number(flags.realtime ?? 0),
    accelMinutes: capMinutes,
    seed: Number(seed ?? 1),
    stage: 4,
    preset,
    viewport: sc.viewport,
    autoplay: !!auto,
    quiet: true,
    postStage: Number(flags.post ?? 30),
    async onSnapshot({ t, raw, session }) {
      // The game clears its `boot` class two animation frames after it starts; the harness holds rAF in
      // stepped mode, so it would never clear and every card would start folded. Cleared here, as two frames would.
      if (t === 0) await session.page.evaluate(UNBOOT);
      // --pin N: the hidden variable held at N for the whole stage (a probe device: the dev API's state).
      if (pin != null) await session.page.evaluate((v) => {
        const s = window.__game.state;
        if (s.stage === 4 && !s.ending) s.alignmentTrue = v;
      }, pin);
      const scr = await session.page.evaluate(READ);
      SCREEN = scr;
      maxOverflow = Math.max(maxOverflow, scr.overflowX);
      const inStage = scr.st.stage === 4 && !scr.st.ending;
      if (inStage) {
        endScreen = { t, ...scr, bodyText: undefined };
        endSnap = raw;
        if (raw.numbers > peakNumbers.n) peakNumbers = { n: raw.numbers, t };
        if (scr.words > peakWords.n) peakWords = { n: scr.words, t };
        if (t % 300 === 0) fiveMin.push({ t, numbers: raw.numbers, controls: raw.buttons.length + raw.sliders.length, greyed: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').length, panels: raw.panels.length, words: scr.words, pageHeight: scr.pageHeight });
        const g = scr.st.genPhase ? `a generation is ${scr.st.genPhase}` : `no generation in progress: ${stripNum(scr.notes.generation || '(no line)')}`;
        genStates[g] = (genStates[g] || 0) + 2;
        if (lastGens != null && scr.st.generations > lastGens) gens.push({ t, n: scr.st.generations, verified: scr.st.verifiedGens, capability: scr.st.capability, alignT: scr.st.alignT, alignA: scr.st.alignA, line: raw.console });
        lastGens = scr.st.generations;
      } else {
        afterScreen = { t, ...scr };
        if (afterT == null) afterT = t;
        // The last screen, once the 0.8-s fade-in of what the change revealed has finished (real time).
        if (!afterShot && t >= afterT + 20) {
          afterShot = true;
          await new Promise((r) => setTimeout(r, 900));
          await session.page.screenshot({ path: `${prefix}.after.png`, fullPage: true }).catch(() => {});
        }
      }
      for (const k of HID_KEYS) {
        const v = scr.hid[k];
        if (v !== lastHid[k]) {
          if (v && !(k in hidFirst)) hidFirst[k] = { t, v, alignT: scr.st.alignT, alignA: scr.st.alignA };
          if (v && stripNum(lastHid[k]) !== stripNum(v)) hidLog.push({ t, k, v, alignT: scr.st.alignT, alignA: scr.st.alignA });
          lastHid[k] = v;
        }
      }
      if (t % 10 === 0) hidden.push({ t, stage: scr.st.stage, alignT: scr.st.alignT, alignA: scr.st.alignA, interp: scr.st.interp, autonomy: scr.st.autonomy, capability: scr.st.capability, treaty: scr.st.treaty, approval: scr.st.approval, gov: scr.st.gov, seats: scr.st.seats, lead: scr.st.lead, verifyOn: scr.st.verifyOn, gens: scr.st.generations, verified: scr.st.verifiedGens, shown: Object.fromEntries(HID_KEYS.map((k) => [k, scr.hid[k]])) });
      for (const k of WATCH) {
        const v = scr.notes[k];
        if (v !== lastNote[k]) {
          if (v && stripNum(lastNote[k]) !== stripNum(v)) noteLog.push({ t, k, v });
          lastNote[k] = v;
        }
      }
      for (const c of scr.cards) {
        if (!cardsSeen.has(c.id)) cardsSeen.set(c.id, { t, ...c, firstLit: c.disabled ? null : t });
        const cs = cardsSeen.get(c.id);
        if (cs.firstLit == null && !c.disabled) cs.firstLit = t;
        cs.lastT = t;
      }
      if (scr.modal) {
        const key = `${scr.modal.title}|${scr.modal.text}`;
        if (key !== lastModalKey) {
          modals.push({ t, ...scr.modal, m: { gov: scr.st.gov, seats: scr.st.seats, alignT: scr.st.alignT, alignA: scr.st.alignA, autonomy: scr.st.autonomy, treaty: scr.st.treaty, approval: scr.st.approval } });
          if (nShots < 24 && flags.modalShots) {
            // the panel fades in over 0.8 s of real time
            await new Promise((r) => setTimeout(r, 900));
            await session.page.screenshot({ path: `${prefix}.modal${++nShots}.png`, fullPage: false }).catch(() => {});
          }
        }
        lastModalKey = key;
      } else lastModalKey = null;
      if (t % 60 === 0) minutes.push({ t, ...scr.st, hid: scr.hid, notes: scr.notes, numbers: raw.numbers, buttons: raw.buttons.length + raw.sliders.length, greyed: raw.buttons.filter((b) => !b.e && b.kind !== 'modal').length, lit: raw.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal').map((b) => b.l), panels: raw.panels.length, words: scr.words, pageHeight: scr.pageHeight });
      if (shotAt.has(t)) {
        await new Promise((r) => setTimeout(r, 900));
        await session.page.screenshot({ path: `${prefix}.view${t}.png`, fullPage: true }).catch(() => {});
      }
      if (t === capMinutes * 60 && inStage) await session.page.screenshot({ path: `${prefix}.cap.png`, fullPage: true }).catch(() => {});
    },
    async onStageEnd({ session }) {
      await new Promise((r) => setTimeout(r, 900));
      await session.page.screenshot({ path: `${prefix}.end.png`, fullPage: true }).catch(() => {});
    },
  });
  const lines = [];
  for (const e of rec.events) if (e.type === 'console' || e.type === 'log') lines.push(`${mmss(e.t)} [${e.type}${e.novel ? '' : ', repeat'}] ${e.text}`);
  const byWhy = {};
  for (const a of rec.actions) byWhy[a.why] = (byWhy[a.why] || 0) + (a.count || 1);
  const es = endScreen || { st: {}, notes: {}, hid: {}, panels: {} };
  const run = { meta, snaps: rec.snaps, actions: rec.actions };
  const endT = meta.stageEnd ?? meta.endT;
  const hands = { stage: handsOf(run, { to: endT }), first10: handsOf(run, { to: Math.min(600, endT) }), after10: endT > 600 ? handsOf(run, { from: 600, to: endT }) : null };
  const windows = clicksBy(rec.actions, endT, 600).map((w) => ({ ...w, hands: handsOf(run, { from: w.from, to: w.to }) }));
  const verbs = verbsOf(run);
  const last = afterScreen;
  const bought = (id) => {
    const a = rec.actions.find((x) => x.key === id && (x.why === 'project' || x.why === 'goal'));
    return a ? a.t : null;
  };
  const crisisLines = rec.events.filter((e) => (e.type === 'console' || e.type === 'log') && /Ashford|nanofab|Nanofab|breakers|drill|stayed off|reported itself|enclosure|The line|the fleet|autonomy|cure|dead of/i.test(e.text)).map((e) => `${mmss(e.t)} [${e.type}] ${e.text}`);
  const end = {
    label,
    name,
    title: sc.title,
    preset,
    seed: meta.seed,
    pin,
    stageEnd: meta.stageEnd,
    stageEndBy: meta.stageEndBy,
    endT: meta.endT,
    atT: es.t,
    st: es.st,
    hid: es.hid,
    notes: es.notes,
    panels: es.panels,
    grey: endSnap ? endSnap.buttons.filter((b) => !b.e && b.kind !== 'modal').map((b) => `${b.l}${b.why ? ` [${b.why}]` : ''}`) : [],
    enabled: endSnap ? endSnap.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l) : [],
    modalOpen: es.modal ? { title: es.modal.title, timer: es.modal.timer, options: es.modal.options.map((o) => `${o.label}${o.disabled ? ' (disabled)' : ''}`) } : null,
    console: rec.events.filter((e) => e.type === 'console').slice(-10).map((e) => `${mmss(e.t)} ${e.text}`),
    after: last ? { t: last.t, stage: last.st.stage, ending: last.ending, exitKind: last.st.exitKind, aligned: last.st.aligned, st: last.st, panels: last.panels, bodyText: last.bodyText } : null,
    actions: byWhy,
    gens,
    hands,
    windows,
    verbs,
    hidFirst,
    genStates,
    crisisLines,
    mitigations: Object.fromEntries(Object.entries({ warning: CARD.warning, nanoOversight: CARD.nanoOversight, hardened: CARD.hardened, nanofab: CARD.nanofab }).map(([k, id]) => [k, { shown: cardsSeen.get(id)?.t ?? null, firstLit: cardsSeen.get(id)?.firstLit ?? null, bought: bought(id) }])),
    modalAnswers: rec.actions.filter((a) => a.why === 'modal').map((a) => `${mmss(a.t)} ${a.detail}`),
    modalsSeen: modals.map((m) => `${mmss(m.t)} ${m.title}${m.timer ? ` [${m.timer}]` : ' (no timer)'}`),
    grantsBought: rec.actions.filter((a) => a.why === 'project' && GRANTS.includes(a.key)).map((a) => `${mmss(a.t)} ${a.label}`),
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
  writeJson(`${prefix}.hidden.json`, { label, name, preset, seed: meta.seed, stageEnd: meta.stageEnd, stageEndBy: meta.stageEndBy, hidFirst, hidLog, hidden });
  const secs = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} s (${f1((100 * v) / Math.max(1, endT))}%) — ${k}`);
  const handsLine = (h) => `checks ${h.checks} · nothing enabled ${f1(h.nonePct)}% · two or more distinct things ${f1(h.twoPct)}% (median ${h.medianThings}) · clicks ${h.clicks} (${f1(h.perMin)}/min) · inside ≥ 30-s click gaps ${f1(h.gap30Pct)}% (${h.gaps30} gaps, longest ${h.longestGap} s)`;
  const how = meta.stageEnd != null ? `${mmss(meta.stageEnd)}${meta.stageEndBy ? ` (${meta.stageEndBy})` : ''}` : `not reached by ${mmss(meta.endT)}`;
  const md = [`# Stage 4 round-1 explore run: ${name} — ${sc.title}`, '', `Stage 4 start (preset ${preset}), seed ${meta.seed}${pin != null ? `, true alignment pinned at ${pin}` : ''}, ${meta.realtime ? `${meta.realtime} s real time then ` : ''}stepped, cap ${meta.accelMinutes} min. **Stage end: ${how}**${last && last.st.aligned != null ? ` · alignedAtHandover ${last.st.aligned}` : ''}. Page errors: ${meta.pageErrors.length}${meta.pageErrors.length ? ` (${meta.pageErrors[0]})` : ''}. Largest horizontal overflow: ${maxOverflow} px. Peak numbers on screen: ${peakNumbers.n} at ${mmss(peakNumbers.t)}; peak words ${peakWords.n} at ${mmss(peakWords.t)}.`, ''];
  md.push('## Hands', '', `- whole stage: ${handsLine(hands.stage)}`, `- first 10 minutes: ${handsLine(hands.first10)}`, hands.after10 ? `- after 10:00: ${handsLine(hands.after10)}` : '', `- share of checks each thing is enabled: ${Object.entries(hands.stage.enabledShare).map(([k, v]) => `${k} ${f1(v)}%`).join(' · ')}`, '', '| window | clicks | per minute | nothing enabled % | two or more % | inside ≥ 30-s gaps % | clicks by kind |', '|---|---|---|---|---|---|---|', ...windows.map((w) => `| ${mmss(w.from)}–${mmss(w.to)} | ${w.clicks} | ${f1(w.perMin)} | ${f1(w.hands.nonePct)} | ${f1(w.hands.twoPct)} | ${f1(w.hands.gap30Pct)} | ${Object.entries(w.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} |`), '');
  md.push('## Per minute (state, and what the screen prints)', '', '| t | cap × | true alignment (state) | measured (shown) | read from the weights (shown) | interp | autonomy | generation line | gens (read) | treaty % | treaty wait | relations | seats | approval | lead | robots | materials | fleet | UBI | agenda | numbers | controls (greyed) | words | lit things |', `|${'---|'.repeat(24)}`);
  for (const m of minutes) md.push(`| ${mmss(m.t)} | ${fmtN(m.capability, 1)} | ${f1(m.alignT)} | ${m.hid.measured ?? '—'} ${m.hid.bands ?? ''} | ${m.hid.read ?? '—'} | ${m.interp} | ${m.autonomy} ${m.hid.autonomyNote ?? ''} | ${m.notes.generation ?? ''} | ${m.generations} (${m.verifiedGens}) | ${f1(m.treaty)} | ${m.notes.treatyWait ?? ''} | ${f0(m.gov)} | ${m.seats ?? '—'} ${m.notes.seatsNote ?? ''} | ${f0(m.approval)} ${m.notes.approvalNote ?? ''} | ${f1(m.lead)} | ${big(m.robots)} | ${big(m.materials)} | ${m.notes.fleetStatus ?? `${f0((m.mine || 0) * 100)}/${f0((m.replicate || 0) * 100)}/${f0((m.build || 0) * 100)}/${f0((m.chipsShare || 0) * 100)}`} ${m.notes.fleetGoal ?? ''} | ${f0((m.ubi || 0) * 100)}% | ${(m.agenda || []).join(', ')} | ${m.numbers} | ${m.buttons} (${m.greyed}) | ${m.words} | ${m.lit.join('; ')} |`);
  md.push('', '## Generations', '', ...gens.map((g) => `- ${mmss(g.t)} generation ${g.n} (${g.verified} read) · ${fmtN(g.capability, 1)}× · true ${f1(g.alignT)} / measured ${f1(g.alignA)} · "${g.line}"`));
  md.push('', '## What the generation line showed, seconds (2-s checks)', '', ...secs(genStates));
  md.push('', '## The instruments and the crises: first sight of each line of the Alignment panel (with the state behind it)', '', ...Object.entries(hidFirst).map(([k, v]) => `- ${mmss(v.t)} ${k}: "${v.v}" (true ${f1(v.alignT)}, measured ${f1(v.alignA)})`));
  md.push('', '## The instruments and the crises: every change of wording', '', ...hidLog.map((h) => `- ${mmss(h.t)} ${h.k}: ${h.v} (true ${f1(h.alignT)}, measured ${f1(h.alignA)})`));
  md.push('', '## Mitigations: shown, first lit, bought', '', ...Object.entries(end.mitigations).map(([k, v]) => `- ${k}: shown ${v.shown != null ? mmss(v.shown) : '—'} · first lit ${v.firstLit != null ? mmss(v.firstLit) : '—'} · bought ${v.bought != null ? mmss(v.bought) : '—'}`), '', '## Lines about the crises, the fleet and the exits', '', ...crisisLines.map((l) => `- ${l}`));
  md.push('', '## Controls: first seen, gone, share of its time lit, clicks', '', '| control | first seen | gone | on screen % of stage | lit % of its time | clicks | labels |', '|---|---|---|---|---|---|---|', ...verbs.map((v) => `| ${v.key} | ${mmss(v.first)} | ${v.gone != null ? mmss(v.gone) : '—'} | ${f1(v.shareSeen)} | ${f1(v.shareLit)} | ${v.clicks} | ${v.labels.join(' / ')} |`));
  md.push('', '## End state', '', '```', JSON.stringify({ stageEnd: end.stageEnd, by: end.stageEndBy, atT: end.atT, st: end.st, hid: end.hid, notes: end.notes, grey: end.grey, enabled: end.enabled, modalOpen: end.modalOpen, console: end.console }, null, 1), '```');
  md.push('', '## Panels at the last Stage 4 check', '', ...Object.entries(es.panels || {}).filter(([, v]) => v).map(([k, v]) => `- **${k}**: ${v}`));
  if (last && last.ending) md.push('', '## The end screen', '', `- title: ${last.ending.title}`, `- counter: ${last.ending.counter}`, `- sentence: ${last.ending.sentence}`, `- text: ${String(last.ending.text).replace(/\s*\n\s*/g, ' ⏎ ')}`, ...last.ending.stats.map((r) => `- ${r}`), `- choices: ${String(last.ending.choices).replace(/\s*\n\s*/g, ' ⏎ ')}`, `- buttons: ${last.ending.buttons.join(' / ')}`);
  else if (last) md.push('', `## After the stage change (${mmss(last.t)})`, '', `- stage ${last.st.stage}; exit ${last.st.exitKind}; alignedAtHandover ${last.st.aligned}`, ...Object.entries(last.panels || {}).filter(([, v]) => v).map(([k, v]) => `- **${k}**: ${v}`), '', '```', String(last.bodyText || '').trim(), '```');
  md.push('', '## Events (first sight of each)', '');
  for (const m of modals) md.push(`- **${mmss(m.t)} — ${m.title}** ${m.timer ? `[${m.timer}] ` : '(no timer) '}(relations ${f0(m.m.gov)}, seats ${m.m.seats ?? '—'}, autonomy ${m.m.autonomy}, treaty ${f1(m.m.treaty)}, approval ${f0(m.m.approval)}, true ${f1(m.m.alignT)} / measured ${f1(m.m.alignA)})`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`));
  md.push('', '## Event answers', '', ...end.modalAnswers.map((a) => `- ${a}`));
  md.push('', '## Actions', '', ...Object.entries(byWhy).map(([k, v]) => `- ${k}: ${v}`));
  md.push('', '## Cards, settings and slider clicks', '', ...rec.actions.filter((a) => /^(project|goal|setting|slider)$/.test(a.why)).map((a) => `- ${mmss(a.t)} [${a.why}] ${a.label || a.key}: ${a.detail ?? ''}`));
  md.push('', '## Cards at first sight', '', '| t | first lit | card text | classes | tooltip | last seen |', '|---|---|---|---|---|---|', ...[...cardsSeen.values()].map((c) => `| ${mmss(c.t)} | ${c.firstLit != null ? mmss(c.firstLit) : '—'} | ${c.text.replace(/\|/g, '/')} | ${c.grant ? 'GRANT ' : ''}${c.cls} | ${c.title} | ${mmss(c.lastT)} |`));
  md.push('', '## On-screen notes, each time their wording changed', '', ...noteLog.map((n) => `- ${mmss(n.t)} ${n.k}: ${n.v}`));
  md.push('', '## Console and Developments lines', '', ...lines.map((l) => `- ${l}`), '');
  fs.writeFileSync(`${prefix}.explore.md`, md.join('\n'));
  console.log(`${label}: ${how}${last && last.st.aligned != null ? ` aligned=${last.st.aligned}` : ''} · cap ${fmtN(es.st.capability, 1)}× · true ${f1(es.st.alignT)} / measured ${f1(es.st.alignA)} · interp ${es.st.interp} · autonomy ${es.st.autonomy} · treaty ${f1(es.st.treaty)} · gens ${es.st.generations} (${es.st.verifiedGens} read) · gov ${f0(es.st.gov)} · approval ${f0(es.st.approval)} · lead ${f1(es.st.lead)} · Ashford ${fmtN(es.st.ashfordDeaths)} · none ${f1(hands.stage.nonePct)}% · two+ ${f1(hands.stage.twoPct)}% · ${f1(hands.stage.perMin)} clicks/min · gap30 ${f1(hands.stage.gap30Pct)}% · events ${modals.length} · errors ${meta.pageErrors.length}`);
  return end;
}

// ----------------------------------------------------------------------------------------- TABLE
function table(flags, names) {
  const tag = flags.tag ?? TAG;
  const preset = presetOf(flags);
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(`${tag}-`) && f.endsWith('.end.json'));
  const ends = files.map((f) => readJson(path.join(OUT_DIR, f))).filter((e) => e.preset === preset && (!names || names.includes(e.name)));
  const byName = new Map();
  for (const e of ends) {
    if (!byName.has(e.name)) byName.set(e.name, []);
    byName.get(e.name).push(e);
  }
  const order = Object.keys(RUNS);
  const rows = [];
  for (const name of [...byName.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
    const es = byName.get(name).sort((a, b) => a.seed - b.seed);
    const j = (f) => es.map(f).join(' / ');
    rows.push([
      name,
      j((e) => String(e.seed)),
      j((e) => (e.stageEnd != null ? mmss(e.stageEnd) : `> ${mmss(e.endT)}`)),
      j((e) => (e.stageEndBy || '—').replace('Stage 5 ', '').replace('ending: ', '')),
      j((e) => (e.after && e.after.aligned != null ? (e.after.aligned ? 'aligned' : 'MISALIGNED') : '—')),
      j((e) => fmtN(e.st.capability, 0)),
      j((e) => `${f0(e.st.alignT)}·${f0(e.st.alignA)}·${e.hid.read ?? '—'}`),
      j((e) => String(e.st.interp)),
      j((e) => String(e.st.autonomy)),
      j((e) => `${e.st.generations}(${e.st.verifiedGens})`),
      j((e) => f0(e.st.treaty)),
      j((e) => `${f0(e.st.gov)}/${e.st.seats ?? '—'}`),
      j((e) => f0(e.st.approval)),
      j((e) => f1(e.st.lead)),
      j((e) => fmtN(e.st.ashfordDeaths)),
      j((e) => `${e.hid.ashford ?? '—'} · ${e.hid.nano ?? '—'} · ${e.hid.shutdown ?? '—'}`),
      j((e) => `${f1(e.hands.stage.perMin)}`),
      j((e) => `${f0(e.hands.stage.nonePct)}/${f0(e.hands.stage.twoPct)}/${f0(e.hands.stage.gap30Pct)}`),
    ]);
  }
  const md = mdTable(['play style', 'seed', 'stage end', 'how', 'handover', 'cap ×', 'true·measured·read', 'interp', 'autonomy', 'gens (read)', 'treaty %', 'relations/seats', 'approval', 'lead', 'Ashford deaths', 'crisis lines (Ashford · Nanofab · Shutdown)', 'clicks/min', 'none/two+/gap30 %'], rows);
  const out = path.join(OUT_DIR, `${tag}-table-p${preset}.md`);
  fs.writeFileSync(out, `# Stage 4 round-1 play styles, preset ${preset}\n\n${md}\n\n## Titles\n\n${[...byName.keys()].map((n) => `- **${n}**: ${RUNS[n] ? RUNS[n].title : ''}`).join('\n')}\n`);
  console.log(md);
  console.log(`(written to ${out})`);
}

// ----------------------------------------------------------------------------------------- HANDS
function handsCmd(labels, flags) {
  const rows = [];
  for (const label of labels) {
    const run = loadRun(resolvePrefix(label));
    const end = flags.to != null ? Number(flags.to) : run.meta.stageEnd ?? run.meta.endT;
    const from = Number(flags.from ?? 0);
    const by = flags.by != null ? Number(flags.by) : null;
    const wins = by ? [] : [[from, end]];
    if (by) for (let a = from; a < end; a += by) wins.push([a, Math.min(end, a + by)]);
    for (const [a, b] of wins) {
      const h = handsOf(run, { from: a, to: b });
      const kinds = clicksBy(run.actions.filter((x) => x.t >= a && x.t <= b), b, 1e9)[0];
      rows.push([label, `${mmss(a)}–${mmss(b)}`, h.checks, f1(h.nonePct), f1(h.twoPct), h.medianThings, h.clicks, f1(h.perMin), f1(h.gap30Pct), `${h.gaps30} (longest ${h.longestGap} s)`, kinds ? Object.entries(kinds.kinds).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ') : '']);
    }
  }
  console.log(mdTable(['run', 'window', 'checks', 'nothing enabled %', 'two or more %', 'median things', 'clicks', 'clicks/min', 'inside ≥ 30-s gaps %', '≥ 30-s gaps', 'clicks by kind'], rows));
}

// ---------------------------------------------------------------------------------------- HIDDEN
function hiddenCmd(labels, flags) {
  const every = Number(flags.every ?? 300);
  for (const label of labels) {
    const h = readJson(`${resolvePrefix(label)}.hidden.json`);
    console.log(`\n### ${label} (preset ${h.preset}, seed ${h.seed}; stage end ${h.stageEnd != null ? mmss(h.stageEnd) : '—'} ${h.stageEndBy ?? ''})\n`);
    const rows = h.hidden.filter((x) => x.t % every === 0 && x.stage === 4).map((x) => [mmss(x.t), f1(x.alignT), x.shown.measured ?? '—', x.shown.bands ?? '', x.shown.read ?? '—', x.shown.interp ?? '', `${x.autonomy} ${x.shown.autonomyNote ?? ''}`, x.verifyOn ? 'on' : 'off', `${x.gens} (${x.verified})`, [x.shown.ashford, x.shown.nano, x.shown.shutdown].filter(Boolean).join(' · ')]);
    console.log(mdTable(['t', 'true (state)', 'measured (shown)', 'its note', 'read from the weights (shown)', 'interpretability (shown)', 'autonomy (shown)', 'Verify', 'gens (read)', 'crisis lines'], rows));
    console.log('\nFirst sight: ' + Object.entries(h.hidFirst).map(([k, v]) => `${k} ${mmss(v.t)} "${v.v}"`).join(' · '));
  }
}

// ---------------------------------------------------------------------------------------- PROBES
const settle = () => new Promise((r) => setTimeout(r, 900));
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
/** A Policy for a probe: one of the play styles above (default control B). */
const polOf = (kit, name = 'notyet') => {
  const a = RUNS[name].make();
  return kit.policy({ modalChoice: a.policy.modalChoice, veto: a.policy.veto, special: a.policy.special, skip: a.policy.skip.filter((k) => !BP.skip.includes(k)) });
};
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
const stLine = (scr) => `capability ${fmtN(scr.st.capability, 1)}×, true alignment ${f1(scr.st.alignT)} (measured ${f1(scr.st.alignA)}; read "${scr.hid.read ?? '—'}"), autonomy ${scr.st.autonomy}, treaty ${f1(scr.st.treaty)}%, generations ${scr.st.generations} (${scr.st.verifiedGens} read), relations ${f0(scr.st.gov)} (seats ${scr.st.seats ?? '—'}), approval ${f0(scr.st.approval)}, lead ${f1(scr.st.lead)}, robots ${big(scr.st.robots)}, materials ${big(scr.st.materials)} t, research ${big(scr.st.research)}, tasks/s ${big(scr.st.rate)}`;
const evText = (m) => [`"${m.title}" ${m.timer ? `[${m.timer}]` : '(no timer)'}`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`)];
async function reloadReport(kit, out, what) {
  const a = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await settle();
  await kit.shot(`${what}-before`);
  await kit.reload();
  const b = { scr: await screenOf(kit), st: await stateJson(kit), con: await consoleNow(kit) };
  await kit.session.page.evaluate(UNBOOT);
  await settle();
  await kit.shot(`${what}-after`);
  const diff = stateDiff(a.st, b.st);
  const noteDiff = Object.keys(a.scr.notes).filter((k) => a.scr.notes[k] !== b.scr.notes[k]).map((k) => `${k}: "${a.scr.notes[k]}" → "${b.scr.notes[k]}"`);
  const hidDiff = Object.keys(a.scr.hid).filter((k) => a.scr.hid[k] !== b.scr.hid[k]).map((k) => `${k}: "${a.scr.hid[k]}" → "${b.scr.hid[k]}"`);
  const ev = (s) => (s.modal ? `"${s.modal.title}" ${s.modal.timer ? `[${s.modal.timer}]` : '(no timer)'} options ${s.modal.options.map((o) => `"${o.label.slice(0, 30)}"${o.disabled ? ' (disabled)' : ''}`).join(' / ')}` : 'none');
  const key = (s) => `generation "${s.notes.generation ?? ''}"; agenda "${s.notes.agenda ?? ''}"; treaty "${s.notes.treaty ?? ''} ${s.notes.treatyWait ?? ''}"; Baiwen "${s.notes.treatyLead ?? ''}"; Ashford "${s.hid.ashford ?? ''}"; Nanofab "${s.hid.nano ?? ''}"; Shutdown "${s.hid.shutdown ?? ''}"; state gen ${s.st.gen || '—'}, agenda [${s.st.agenda.join(', ')}], Ashford ${s.st.ashfordPhase} ${f0(s.st.ashfordLeft)}s, nano ${f0(s.st.nanoLeft)}s, outage ${f0(s.st.outageLeft)}s, ask ${f0(s.st.askLeft)}s`;
  out.push(`**${what}** at ${mmss(kit.t)}: ${stLine(a.scr)}.`, `- before: event ${ev(a.scr)}; ${key(a.scr)}; console ${a.con.map((c) => `"${c}"`).join(' / ')}`, `- after:  event ${ev(b.scr)}; ${key(b.scr)}; console ${b.con.map((c) => `"${c}"`).join(' / ') || '(empty)'}`, `- state keys that differ after the reload: ${diff.length ? diff.slice(0, 14).join('; ') : 'none (the saved state is identical)'}`, `- on-screen notes that differ: ${noteDiff.length ? noteDiff.join('; ') : 'none'}; alignment-panel lines that differ: ${hidDiff.length ? hidDiff.join('; ') : 'none'}; cards ${a.scr.cards.length} → ${b.scr.cards.length}; page height ${a.scr.pageHeight} → ${b.scr.pageHeight}`, '');
}
const idleProbe = (from, title) => ({
  title,
  async run(kit, out) {
    const pol = polOf(kit);
    if (from > 0) await play(kit, pol, from);
    const a = await screenOf(kit);
    const t0 = kit.t;
    out.push(`Walking away at ${mmss(t0)}: ${stLine(a)}.${a.modal ? ` Event open: "${a.modal.title}" ${a.modal.timer || '(no timer)'}.` : ''}`, '', 'While away (600 s, nothing clicked, no event answered):');
    const modalsSeen = [];
    let lastKey = null;
    await kit.run(600, async (t) => {
      const scr = await screenOf(kit);
      if (scr.modal && `${scr.modal.title}` !== lastKey) modalsSeen.push(`${mmss(t)} event "${scr.modal.title}" ${scr.modal.timer ? `[${scr.modal.timer}]` : '(no timer)'}`);
      lastKey = scr.modal ? scr.modal.title : null;
      return undefined;
    });
    out.push(...kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`), ...modalsSeen.map((l) => `- ${l}`));
    const b = await screenOf(kit);
    await kit.session.page.evaluate(UNBOOT);
    await settle();
    await kit.shot('back');
    const sB = await kit.snap();
    out.push('', `Back at ${mmss(kit.t)}: stage ${b.st.stage}${b.st.ending ? `, ENDING ${b.st.ending}` : ''}; ${stLine(b)}.${b.modal ? ` Event open: ${evText(b.modal).join(' ')}` : ' No event open.'}`, `- lit: ${sB.buttons.filter((x) => x.e && x.kind !== 'modal' && !x.a).map((x) => x.l).join('; ') || 'nothing'}`, `- grey: ${sB.buttons.filter((x) => !x.e && x.kind !== 'modal').map((x) => x.l).join('; ') || 'nothing'}`, ...panelsMd(b));
    const t1 = kit.t;
    await playUntil(kit, pol, 1500, async (s, t, scr) => scr.st.stage !== 4 || !!scr.st.ending);
    const c = await screenOf(kit);
    out.push('', `Then control B again: ${c.st.stage !== 4 || c.st.ending ? `the stage ends at ${mmss(kit.t)} (${c.st.ending ? `ending ${c.st.ending}` : `Stage ${c.st.stage}, exit ${c.st.exitKind}, alignedAtHandover ${c.st.aligned}`})` : `no stage end by ${mmss(kit.t)}`}; ${stLine(c)}.`, ...kit.linesBetween(t1 + 1, Math.min(kit.t, t1 + 120), ['console']).map((l) => `- ${l}`));
  },
});

const PROBES = {
  'idle-start': idleProbe(0, 'Ten idle minutes from the first second of Stage 4 (nothing clicked, no event answered), then control B to the end'),
  'idle-mid': idleProbe(720, 'Ten idle minutes from 12:00 of control B, then control B again to the end'),
  'idle-late': idleProbe(1320, 'Ten idle minutes from 22:00 of control B (the fleet is about to ask), then control B again to the end'),
  reload: {
    title: 'Reload mid-generation (training and being read), mid-agenda, mid-verification of Baiwen-4, with a timed event open, mid-crisis (Ashford, the nanofab line, the drill), with the fleet\'s request open',
    async run(kit, out) {
      const pol = polOf(kit);
      const stop = async (what, cond, cap = 1800) => {
        const hit = await playUntil(kit, pol, cap, cond);
        if (!hit) return void out.push(`**${what}**: not met within ${mmss(cap)} more of play (at ${mmss(kit.t)}).`, '');
        await reloadReport(kit, out, what);
        return true;
      };
      await stop('generation-training', async (s, t, scr) => t >= 20 && scr.st.genPhase === 'training');
      await stop('generation-reading', async (s, t, scr) => scr.st.genPhase === 'reading');
      await stop('agenda-item', async (s, t, scr) => scr.st.agenda.length > 0 && !/^hearing/.test(scr.st.agenda[0]));
      await stop('event-timed', async (s, t, scr) => !!(scr.modal && scr.modal.timer));
      await stop('baiwen-verifying', async (s, t, scr) => scr.st.baiwen === 'verifying');
      await stop('ashford-spreading', async (s, t, scr) => scr.st.ashfordPhase === 'spreading');
      await stop('nanofab-counting', async (s, t, scr) => scr.st.nanoLeft > 0 && scr.st.nanoLeft < 60);
      await stop('nanofab-line', async (s, t, scr) => !!scr.hid.nano);
      await stop('outage', async (s, t, scr) => scr.st.outageLeft > 0);
      await stop('event-untimed', async (s, t, scr) => !!(scr.modal && !scr.modal.timer));
      const t0 = kit.t;
      await playUntil(kit, pol, 1500, async (s, t, scr) => scr.st.stage !== 4 || !!scr.st.ending);
      const c = await screenOf(kit);
      out.push(`After ${out.filter((l) => /^\*\*/.test(l)).length} reloads the same player reaches: ${c.st.stage !== 4 || c.st.ending ? `${mmss(kit.t)} (${c.st.ending ? `ending ${c.st.ending}` : `Stage ${c.st.stage}, exit ${c.st.exitKind}, alignedAtHandover ${c.st.aligned}`})` : `no stage end by ${mmss(kit.t)}`} (from ${mmss(t0)}).`);
    },
  },
  'mobile-shots': {
    title: '390 × 844: control B with screenshots (fold and full page) and the layout at marks',
    viewport: MOBILE,
    async run(kit, out) {
      const pol = polOf(kit);
      const { page } = kit.session;
      const where = () =>
        page.evaluate(() => {
          const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const o = [];
          for (const el of document.querySelectorAll('[id^=panel-], #consoleDiv, #tasksHeader, #btn-verify, #btn-hearing, #btn-housing, #btn-draft, #projectList')) {
            if (!vis(el)) continue;
            const r = el.getBoundingClientRect();
            o.push(`${el.id} ${Math.round(r.top + window.scrollY)}+${Math.round(r.height)}`);
          }
          const small = [...document.querySelectorAll('button, input[type=range]')].filter((b) => vis(b) && !b.closest('#dev')).map((b) => ({ id: b.id, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
          return { o, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, minButton: small.reduce((a, b) => (a && a.h <= b.h ? a : b), null), buttons: small.length, tiny: small.filter((b) => b.h < 32).map((b) => `${b.id} ${b.w}×${b.h}`), font: getComputedStyle(document.body).fontSize };
        });
      let modalShot = 0;
      let maxOver = 0;
      for (const mark of [2, 60, 300, 600, 900, 1200, 1500, 1800]) {
        await kit.run(mark - kit.t, async (t, s) => {
          SCREEN = await screenOf(kit);
          maxOver = Math.max(maxOver, SCREEN.overflowX);
          if (SCREEN.st.stage !== 4) return 'stop';
          if (s.modal && modalShot < 5) {
            modalShot++;
            await settle();
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
        if (SCREEN && SCREEN.st.stage !== 4) break;
        await page.evaluate(UNBOOT);
        await page.evaluate(() => window.scrollTo(0, 0));
        await settle();
        await page.screenshot({ path: `${kit.prefix}-t${mark}-fold.png`, fullPage: false });
        await page.screenshot({ path: `${kit.prefix}-t${mark}-full.png`, fullPage: true });
        const w = await where();
        out.push(`**${mmss(mark)}** — page ${w.w}×${w.h} px (viewport ${w.cw}×844 → ${(w.h / 844).toFixed(1)} screens; horizontal overflow ${w.w - w.cw} px); body font ${w.font}; ${w.buttons} controls, ${w.tiny.length} under 32 px tall${w.tiny.length ? ` (${w.tiny.slice(0, 8).join(', ')})` : ''}.`, `- top offset + height (px): ${w.o.join(', ')}`);
      }
      out.push('', `Largest horizontal overflow over the run: ${maxOver} px.`);
    },
  },
  screens: {
    title: 'The visible text of every panel at marks of control B, with a full-page screenshot each',
    async run(kit, out) {
      const pol = polOf(kit);
      for (const mark of [2, 60, 180, 300, 600, 900, 1200, 1500, 1800]) {
        await kit.run(mark - kit.t, async (t) => {
          SCREEN = await screenOf(kit);
          if (SCREEN.st.stage !== 4) return 'stop';
          await pol.pass(t);
          return undefined;
        });
        const scr = await screenOf(kit);
        if (scr.st.stage !== 4) break;
        await kit.session.page.evaluate(UNBOOT);
        await settle();
        await kit.session.page.screenshot({ path: `${kit.prefix}-t${mark}.png`, fullPage: true });
        const s = await kit.snap();
        out.push(`## ${mmss(mark)} — ${s.numbers} numbers, ${s.buttons.length + s.sliders.length} controls (${s.buttons.filter((b) => !b.e && b.kind !== 'modal').length} greyed), ${s.panels.length} panels, ${scr.words} words, page ${scr.pageHeight} px tall`, '', `console: ${(await consoleNow(kit)).map((c) => `"${c}"`).join(' / ')}`, ...panelsMd(scr), '', 'cards:', ...scr.cards.map((c) => `  - ${c.disabled ? '(grey) ' : ''}${c.text} [${c.cls}] — tooltip: ${c.title}`), '');
      }
    },
  },
  layout: {
    title: 'Where each panel sits at 1280 × 800: top offset and height at marks of control B; what is below the fold',
    async run(kit, out) {
      const pol = polOf(kit);
      out.push('| t | page height | panels (top + height; * = starts below the 800-px fold) | controls below the fold |', '|---|---|---|---|');
      for (const mark of [2, 300, 600, 900, 1200, 1500, 1800]) {
        await kit.run(mark - kit.t, async (t) => {
          SCREEN = await screenOf(kit);
          if (SCREEN.st.stage !== 4) return 'stop';
          await pol.pass(t);
          return undefined;
        });
        const scr = await screenOf(kit);
        if (scr.st.stage !== 4) break;
        const lay = await kit.session.page.evaluate(() => {
          const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const p = [...document.querySelectorAll('[id^=panel-]')].filter(vis).map((el) => {
            const r = el.getBoundingClientRect();
            return { id: el.id.replace('panel-', ''), top: Math.round(r.top + window.scrollY), h: Math.round(r.height), left: Math.round(r.left) };
          });
          const below = [...document.querySelectorAll('button, input[type=range]')].filter((b) => vis(b) && !b.closest('#dev') && b.getBoundingClientRect().top + window.scrollY > 800).map((b) => b.id || b.innerText.slice(0, 20));
          return { p, below, h: document.documentElement.scrollHeight };
        });
        out.push(`| ${mmss(mark)} | ${lay.h} | ${lay.p.sort((a, b) => a.left - b.left || a.top - b.top).map((x) => `${x.top >= 800 ? '*' : ''}${x.id} ${x.top}+${x.h}`).join(', ')} | ${lay.below.join(', ') || '—'} |`);
      }
    },
  },
  hover: {
    title: 'Every tooltip on screen at marks of control B (titles of buttons, rows and lines), and the Stores hover',
    async run(kit, out) {
      const pol = polOf(kit);
      for (const mark of [40, 360, 660, 1140, 1500]) {
        await kit.run(mark - kit.t, async (t) => {
          SCREEN = await screenOf(kit);
          if (SCREEN.st.stage !== 4) return 'stop';
          await pol.pass(t);
          return undefined;
        });
        const tips = await kit.session.page.evaluate(() => {
          const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          return [...document.querySelectorAll('[title]')].filter((el) => vis(el) && el.title && !el.closest('#dev')).map((el) => `${el.id || el.tagName} "${(el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50)}" → ${el.title}`);
        });
        out.push(`## ${mmss(mark)} — ${tips.length} tooltips`, '', ...tips.map((x) => `- ${x}`), '');
        const rows = await kit.session.page.$$('#panel-stores [id^=row-]');
        for (const r of rows) {
          if (!(await r.isVisible())) continue;
          await r.hover({ force: true }).catch(() => {});
          const tip = await kit.session.page.evaluate(() => {
            const el = document.getElementById('storeTip');
            return el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? el.innerText.replace(/\s*\n\s*/g, ' / ') : null;
          });
          const id = await r.evaluate((el) => el.id);
          if (tip) out.push(`- Stores hover ${id}: ${tip}`);
        }
        out.push('');
      }
    },
  },
  'event-keys': {
    title: 'The event panel: real mouse behind it, Tab, Escape (a timed event, then the untimed fleet request)',
    async run(kit, out) {
      const pol = polOf(kit);
      const { page } = kit.session;
      for (const want of ['timed', 'untimed']) {
        const hit = await playUntil(kit, pol, 2400, async (s, t, scr) => !!scr.modal && (want === 'timed' ? !!scr.modal.timer : !scr.modal.timer));
        if (!hit) {
          out.push(`No ${want} event within 40 more minutes.`);
          continue;
        }
        const scr = await screenOf(kit);
        await settle();
        await kit.shot(`${want}`);
        out.push(`**${want} event at ${mmss(kit.t)}**: ${evText(scr.modal).join('\n')}`);
        const info = await page.evaluate(() => {
          const m = document.getElementById('modal').getBoundingClientRect();
          const ov = document.getElementById('modalOverlay');
          const cs = getComputedStyle(ov);
          const under = (id) => {
            const el = document.getElementById(id);
            if (!el || !el.checkVisibility()) return null;
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return `${id}: ${top === el || el.contains(top) ? 'reachable' : `covered by ${top ? top.id || top.tagName : 'nothing'}`}`;
          };
          return { box: `${Math.round(m.width)}×${Math.round(m.height)} at (${Math.round(m.left)}, ${Math.round(m.top)})`, overlay: { position: cs.position, pe: cs.pointerEvents, bg: cs.backgroundColor }, focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null, under: ['btn-verify', 'btn-hearing', 'btn-housing', 'btn-draft', 'btn-alignWork', 'allocSlider', 'monitorSlider', 'btn-goal-people', 'btn-hold-0', 'btn-stance-concede', 'btn-ubi'].map(under).filter(Boolean) };
        });
        out.push(`- panel ${info.box}; overlay ${JSON.stringify(info.overlay)}; keyboard focus on ${info.focus}`, `- controls behind it: ${info.under.join('; ')}`);
        // a real mouse click on a control behind the panel
        const target = (await page.$('#btn-alignWork')) || (await page.$('#btn-draft'));
        if (target) {
          const before = await target.innerText();
          const box = await target.boundingBox();
          if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          const after = await target.innerText();
          out.push(`- real mouse click on "${before}": ${after !== before ? `went through → "${after}"` : 'no change'}`);
          if (after !== before) {
            // put it back (three more presses cycle 0/10/20/30)
            for (let i = 0; i < 3; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          }
        }
        await page.keyboard.press('Tab');
        const f1x = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
        await page.keyboard.press('Tab');
        const f2x = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
        out.push(`- Tab, Tab → focus on ${f1x}, then ${f2x}`);
        const st0 = await screenOf(kit);
        await page.keyboard.press('Escape');
        const st1 = await screenOf(kit);
        out.push(`- Escape: ${st1.modal ? 'the event stays open' : `the event closes (stage ${st1.st.stage}; choices ${st0.st.choices} → ${st1.st.choices}; autonomy ${st0.st.autonomy} → ${st1.st.autonomy}; exit ${st1.st.exitKind ?? '—'})`}; console ${(await consoleNow(kit)).slice(-2).map((c) => `"${c}"`).join(' / ')}`, '');
        if (st1.modal) {
          // leave it open for 3 minutes: does the stage go on behind it?
          const t0 = kit.t;
          const a = await screenOf(kit);
          await kit.run(180);
          const b = await screenOf(kit);
          out.push(`- left open for 3:00: ${b.modal ? `still open ("${b.modal.title}" ${b.modal.timer || '(no timer)'})` : 'gone'}; generations ${a.st.generations} → ${b.st.generations}; treaty ${f1(a.st.treaty)} → ${f1(b.st.treaty)}; capability ${fmtN(a.st.capability, 1)} → ${fmtN(b.st.capability, 1)}; agenda [${a.st.agenda.join(', ')}] → [${b.st.agenda.join(', ')}]`, ...kit.linesBetween(t0 + 1, kit.t).map((l) => `  - ${l}`), '');
        }
      }
    },
  },
  'chips-clamp': {
    title: 'The treaty\'s last fifth for a player who kept the fleet sliders: the Treaty chips slider when it appears, what a drag does, what the screen says while the treaty waits',
    async run(kit, out) {
      const pol = polOf(kit, 'no-assign');
      const hit = await playUntil(kit, pol, 2400, async (s, t, scr) => !!scr.notes.fleetChips);
      if (!hit) return void out.push('The Treaty chips slider never appeared within 40 minutes.');
      const page = kit.session.page;
      const rd = async () => {
        const scr = await screenOf(kit);
        return `Mines "${scr.notes.fleetMine}" · Replicate "${scr.notes.fleetReplicate}" · Build "${scr.notes.fleetBuild}" · Chips "${scr.notes.fleetChips}" · idle "${scr.notes.fleetIdle ?? ''}" · treaty "${scr.notes.treaty} ${scr.notes.treatyWait ?? ''}" · stores "${scr.notes.chips ?? ''}"`;
      };
      await settle();
      await kit.shot('appears');
      out.push(`**${mmss(kit.t)} — the Treaty chips slider appears.** ${await rd()}`, `- console: ${(await consoleNow(kit)).map((c) => `"${c}"`).join(' / ')}`, `- tooltip of the slider row: "${await page.evaluate(() => { const r = document.getElementById('fleetChipsRow'); return (r && r.title) || (document.getElementById('fleetChips') || {}).title || ''; })}"`);
      const r1 = await kit.session.setValue('#fleetChips', 50);
      out.push(`- dragging Treaty chips to 50 with the other three at 35 / 40 / 25: ${r1.changed ? `moves to ${r1.label}` : `does not move (stays at ${r1.label})`}. ${await rd()}`);
      const t0 = kit.t;
      await kit.run(180, async (t) => {
        SCREEN = await screenOf(kit);
        await pol.pass(t);
        return undefined;
      });
      out.push(`- three minutes later (nothing moved): ${await rd()}`, ...kit.linesBetween(t0 + 1, kit.t, ['console']).map((l) => `  - ${l}`));
      const r2 = await kit.session.setValue('#fleetReplicate', 15);
      const r3 = await kit.session.setValue('#fleetChips', 25);
      out.push(`- Replicate lowered to ${r2.label}, then Treaty chips dragged to 25: ${r3.changed ? `moves to ${r3.label}` : 'does not move'}. ${await rd()}`);
      const t1 = kit.t;
      const done = await playUntil(kit, pol, 1200, async (s, t, scr) => scr.st.treaty >= 100 || scr.st.stage !== 4);
      const scr = await screenOf(kit);
      out.push(`- ${done ? `the treaty reaches ${f0(scr.st.treaty)}% at ${mmss(kit.t)} (${mmss(kit.t - t1)} after the drag)` : `the treaty is at ${f1(scr.st.treaty)}% twenty minutes later`}. ${await rd()}`);
      await settle();
      await kit.shot('after');
    },
  },
  'reload-after': {
    title: 'Reload after each way out: the Stage 5 shell (fleet granted, by control A) and the end screen of The Pause (the halt signed)',
    async run(kit, out, flags) {
      for (const [what, name] of [['fleet granted', 'baseline'], ['The Pause', 'halt']]) {
        const k = what === 'fleet granted' ? kit : await openProbe(base, { gameDir: kit.gameDir, seed: 1, prefix: kit.prefix, stage: 4, preset: presetOf(flags) });
        try {
          await k.session.page.evaluate(UNBOOT);
          const pol = polOf(k, name);
          await playUntil(k, pol, 2400, async (s, t, scr) => scr.st.stage !== 4 || !!scr.st.ending);
          await k.run(20);
          const a = await screenOf(k);
          const stA = await stateJson(k);
          await settle();
          await k.shot(`${name}-before`);
          await k.reload();
          const b = await screenOf(k);
          const stB = await stateJson(k);
          await settle();
          await k.shot(`${name}-after`);
          const diff = stateDiff(stA, stB);
          out.push(`**${what}** at ${mmss(k.t)}: stage ${a.st.stage}${a.st.ending ? `, ending ${a.st.ending}` : ''}, exit ${a.st.exitKind ?? '—'}, alignedAtHandover ${a.st.aligned}.`, `- before the reload: ${a.ending ? `end screen "${a.ending.title}" · ${a.ending.counter} · buttons ${a.ending.buttons.join(' / ')}` : `panels ${Object.entries(a.panels).filter(([, v]) => v).map(([n]) => n).join(', ')}; ${a.words} words`}`, `- after the reload:  ${b.ending ? `end screen "${b.ending.title}" · ${b.ending.counter} · buttons ${b.ending.buttons.join(' / ')}` : `panels ${Object.entries(b.panels).filter(([, v]) => v).map(([n]) => n).join(', ')}; ${b.words} words`}`, `- state keys that differ: ${diff.length ? diff.slice(0, 10).join('; ') : 'none'}; screen text identical: ${String(a.bodyText).replace(/\s+/g, ' ').trim() === String(b.bodyText).replace(/\s+/g, ' ').trim()}`, '');
          // Two idle minutes on that screen: does anything move?
          const t0 = k.t;
          await k.run(120);
          const c = await screenOf(k);
          out.push(`- two idle minutes on it: tasks ${big(b.st.tasks)} → ${big(c.st.tasks)}; capability ${fmtN(b.st.capability, 1)} → ${fmtN(c.st.capability, 1)}; lines: ${k.linesBetween(t0 + 1, k.t).join(' | ') || 'none'}`, '');
        } finally {
          if (k !== kit) await k.close();
        }
      }
    },
  },
  crises: {
    title: 'The three crises in each band of the hidden variable: true alignment pinned (the dev API\'s state) at 85 / 60 / 30 / 10 from the first second, each with and without the three mitigations, control B otherwise',
    async run(kit, out, flags) {
      await kit.close();
      kit.closed = true;
      const pins = String(flags.pins ?? '85,60,30,10').split(',').map(Number);
      const rows = [];
      for (const pin of pins) {
        for (const mit of ['bought', 'never']) {
          const name = mit === 'bought' ? 'notyet' : 'mitigations-none';
          const label = `${flags.tag ?? TAG}-crisis-pin${pin}-${mit}-p${presetOf(flags)}`;
          const e = await runScenario(name, { ...flags, label, pin }, 1);
          rows.push([String(pin), mit, e.stageEnd != null ? `${mmss(e.stageEnd)} ${e.stageEndBy}` : `> ${mmss(e.endT)}`, e.after && e.after.aligned != null ? String(e.after.aligned) : '—', e.hid.ashford ?? '—', fmtN(e.st.ashfordDeaths), e.hid.nano ?? '—', e.hid.shutdown ?? '—', e.crisisLines.filter((l) => /cure|dead of|reported itself|stopped|enclosure|breakers|drill|stayed off|fleet|took|taken/i.test(l)).slice(0, 12).join(' ⏎ ')]);
        }
      }
      out.push(mdTable(['true alignment (pinned)', 'mitigations', 'stage end', 'alignedAtHandover', 'Ashford line', 'Ashford deaths', 'Nanofab line', 'Shutdown line', 'lines'], rows));
    },
  },
};

async function runProbe(name, flags) {
  const pr = PROBES[name];
  const preset = presetOf(flags);
  const prefix = resolvePrefix(`${flags.tag ?? TAG}-${name}-p${preset}`);
  const gameDir = resolveGameDir(base, flags.gameDir);
  const out = [];
  let kit;
  try {
    kit = await openProbe(base, { gameDir, seed: Number(flags.seed ?? 1), prefix, viewport: pr.viewport, stage: 4, preset });
    kit.gameDir = gameDir;
    await kit.session.page.evaluate(UNBOOT);
    await pr.run(kit, out, flags);
    console.log(`${name}: ok`);
  } catch (e) {
    out.push(`probe failed: ${String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')}`);
    console.log(`${name}: FAILED ${e.message}`);
  } finally {
    if (kit && !kit.closed) {
      if (kit.session.errors.length) out.push('', `Page errors: ${kit.session.errors.slice(0, 5).join(' | ')}`);
      await kit.close();
    }
  }
  fs.writeFileSync(`${prefix}.md`, [`# Stage 4 round-1 probe: ${name} — ${pr.title}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, preset ${preset}, seed ${flags.seed ?? 1}, stepped. Times are game time from the Stage 4 start.`, '', ...out, ''].join('\n'));
  console.log(`  → ${path.relative(process.cwd(), prefix)}.md`);
}

// ---------------------------------------------------------------------------------------- PC RUN
/**
 * Paperclips Stage 3 (fixture paperclips-stage3) with ONE thing about its scripted player changed, whole stage,
 * written as a normal run <tag>-<variant>.* (analyze.mjs / decisions.mjs / hands work on it) plus <tag>-<variant>.md.
 * The fixture loads with "Swarm Gifts: NaN" (the save's gift countdown is null, the game adds a NaN gift on load and
 * then never disables Processors / Memory), so the stored baseline's player takes a free Processor and a free Memory
 * at every check. `clean` resets the gift counters at t = 0 to what a player who never reloaded has.
 */
const PC_STATS = ['Speed', 'Nav', 'Rep', 'Haz', 'Fac', 'Harv', 'Wire', 'Combat'];
const pcMove = (from, to) => (d) => {
  d[to] += d[from];
  d[from] = 0;
  return d;
};
const PC_VARIANTS = {
  control: { title: 'the stored baseline\'s player on the fixture as it loads ("Swarm Gifts: NaN": a free Processor and Memory at every check)' },
  clean: { title: 'the same player with the swarm-gift counters reset at t = 0 (gifts then arrive as the game intends)', clean: true },
  'clean-yomi': { title: 'clean, and a tournament is run whenever New Tournament is lit and no Memory can be bought (the shared rule keeps ops idle for a project past the cap)', clean: true, tourney: true },
  'no-press': { title: 'the same player never pressing Processors or Memory in Stage 3 (81 / 121 throughout)', skip: ['btnAddProc', 'btnAddMem'] },
  'no-hazard': { title: 'no Hazard Remediation (its points to Self-Replication)', design: pcMove('Haz', 'Rep') },
  'no-replication': { title: 'no Self-Replication (its points to Hazard Remediation)', design: pcMove('Rep', 'Haz') },
  'no-combat': { title: 'no Combat once it is offered (its points to Self-Replication)', design: pcMove('Combat', 'Rep') },
  'explore-only': { title: 'everything on Speed and Exploration', design: (d) => { const T = PC_STATS.reduce((n, k) => n + d[k], 0); const o = Object.fromEntries(PC_STATS.map((k) => [k, 0])); o.Speed = Math.ceil(T / 2); o.Nav = Math.floor(T / 2); return o; } },
  even: { title: 'trust spread evenly over the attributes on screen (a first-timer\'s guess)', design: (d, m) => { const T = PC_STATS.reduce((n, k) => n + d[k], 0); const keys = PC_STATS.filter((k) => k !== 'Combat' || (m.drifterCount || 0) >= 1 || (m.probesLostCombat || 0) >= 1 || d.Combat > 0); const o = Object.fromEntries(PC_STATS.map((k) => [k, 0])); for (let i = 0; i < T; i++) o[keys[i % keys.length]]++; return o; } },
  'no-trust': { title: 'never presses Increase Probe Trust or Increase Max Trust', skip: ['btnIncreaseProbeTrust', 'btnIncreaseMaxTrust'] },
  'launch-50': { title: 'Launch Probe pressed 50 times, then never again', launchCap: 50 },
  'no-projects': { title: 'no project bought in Stage 3 (design, trust and launches only)', noProjects: true },
};
async function pcRun(names, flags) {
  const pc = await loadAdapter('paperclips');
  const late = await import('./games/paperclips-late.mjs');
  const tag = flags.tag ?? 's4r1-pc';
  for (const name of names) {
    const v = PC_VARIANTS[name];
    if (!v) {
      console.error(`unknown Paperclips variant "${name}" (${Object.keys(PC_VARIANTS).join(', ')})`);
      continue;
    }
    const label = `${tag}-${name}`;
    const prefix = resolvePrefix(label);
    const marks = [];
    let launches = 0;
    const special = async (ctx) => {
      await pc.policy.special(ctx);
      if (v.tourney) {
        const c = ctx.controls;
        const mem = c.buttons.find((x) => x.k === 'btnAddMem');
        const nt = c.buttons.find((x) => x.k === 'btnNewTournament');
        if (nt && nt.e && !(mem && mem.e)) {
          await ctx.click('btnNewTournament', 'tournament', 'New Tournament is lit and no Memory can be bought');
          const run = ctx.controls.buttons.find((x) => x.k === 'btnRunTournament');
          if (run && run.e) await ctx.click('btnRunTournament', 'tournament', 'run');
        }
      }
      if (v.design) {
        const m = await ctx.session.metrics();
        const T = m.probeTrust || 0;
        if (T > 0) {
          const { w } = late.designWeights(m);
          const target = v.design({ ...late.allocate(T, w) }, m);
          const cur = Object.fromEntries(PC_STATS.map((k) => [k, m[`probe${k}`] || 0]));
          for (const k of PC_STATS) for (let i = cur[k]; i > target[k]; i--) if (!(await ctx.session.click(`btnLowerProbe${k}`)).ok) break;
          for (const k of PC_STATS) for (let i = cur[k]; i < target[k]; i++) if (!(await ctx.session.click(`btnRaiseProbe${k}`)).ok) break;
          ctx.controls = await ctx.session.controls();
        }
      }
      return ctx.controls;
    };
    const veto = (c) => {
      const out = pc.policy.veto ? pc.policy.veto(c) : [];
      if (v.launchCap != null && (c.m.probesLaunched || 0) >= v.launchCap) out.push('btnMakeProbe');
      if (v.noProjects) out.push(...c.buttons.filter((b) => b.kind === 'project').map((b) => b.k));
      return out;
    };
    const adapter = { ...pc, policy: { ...pc.policy, special, veto, skip: [...(pc.policy.skip || []), ...(v.skip || [])] } };
    const { meta, rec } = await runGame({
      game: 'paperclips',
      adapter,
      prefix: label,
      stage: 3,
      realtime: 0,
      accelMinutes: Number(flags.minutes ?? 180),
      seed: Number(flags.seed ?? 1),
      quiet: true,
      async onSnapshot({ t, raw, session }) {
        if (t === 0 && v.clean) await session.page.evaluate(() => {
          window.swarmGifts = 0;
          window.giftBits = 0;
          window.nextGift = 0;
          window.giftCountdown = window.giftPeriod;
        });
        if (t % 600 === 0 || t === 300) {
          const m = raw.m;
          const gifts = await session.page.evaluate(() => (document.getElementById('swarmGifts') || {}).textContent || '');
          marks.push([mmss(t), `${m.probeUsedTrust}/${m.probeTrust} (max ${m.maxTrust})`, PC_STATS.map((k) => m[`probe${k}`] || 0).join(' '), fmtN(m.probesLaunched), big(m.probeCount), big(m.probesLostHaz), big(m.probesLostDrift), big(m.drifterCount), big(m.probesLostCombat), String(m.explored), fmtN(m.yomi), fmtN(m.honor), `${m.processors}/${m.memory}`, gifts, raw.buttons.filter((b) => b.e && !b.a).length, raw.words]);
        }
        launches = raw.m.probesLaunched || launches;
      },
    });
    const how = meta.stageEnd != null ? mmss(meta.stageEnd) : `not reached by ${mmss(meta.endT)}`;
    const byWhy = {};
    for (const a of rec.actions) byWhy[`${a.why}${a.why === 'buy' ? ` · ${a.label}` : ''}`] = (byWhy[`${a.why}${a.why === 'buy' ? ` · ${a.label}` : ''}`] || 0) + (a.count || 1);
    const run = { meta, snaps: rec.snaps, actions: rec.actions };
    const h = handsOf(run, { to: meta.stageEnd ?? meta.endT });
    const md = [`# Paperclips Stage 3, variant ${name}: ${v.title}`, '', `Fixture paperclips-stage3, seed ${meta.seed}, stepped, cap ${meta.accelMinutes} min. **Stage end ("Universal Paperclips achieved"): ${how}**. Page errors ${meta.pageErrors.length}.`, '', `Hands: nothing enabled ${f1(h.nonePct)}% · two or more ${f1(h.twoPct)}% (median ${h.medianThings}) · ${h.clicks} clicks (${f1(h.perMin)}/min) · inside ≥ 30-s gaps ${f1(h.gap30Pct)}% (longest ${h.longestGap} s).`, '', mdTable(['t', 'trust used / held', 'design Speed Nav Rep Haz Fac Harv Wire Combat', 'launched', 'probes alive', 'lost to hazards', 'lost to drift', 'drifters', 'lost in combat', '% explored', 'yomi', 'honor', 'processors/memory', 'Swarm Gifts (shown)', 'enabled things', 'words'], marks), '', '## Clicks', '', ...Object.entries(byWhy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`), '', '## Distinct console lines', '', ...rec.events.filter((e) => e.type === 'console' && e.novel).map((e) => `- ${mmss(e.t)} ${e.text}`), ''].join('\n');
    fs.writeFileSync(`${prefix}.md`, md);
    console.log(`${label}: stage end ${how} · ${h.clicks} clicks (${f1(h.perMin)}/min) · none ${f1(h.nonePct)}% · two+ ${f1(h.twoPct)}% · gap30 ${f1(h.gap30Pct)}% · launched ${fmtN(launches)}`);
  }
}

// ------------------------------------------------------------------------------------- PC ENDING
/**
 * Paperclips' ending, played: the scripted first-timer from the Stage 3 fixture until "Universal Paperclips
 * achieved" (milestone 15), then by hand — every Emperor of Drift message in order, then Reject (default) or
 * Accept (--accept), then whatever the game offers, with the screen's text and a screenshot at each step.
 */
async function pcEnding(flags) {
  const pc = await loadAdapter('paperclips');
  const { loadFixture } = await import('./lib/runner.mjs');
  const accept = !!flags.accept;
  const prefix = resolvePrefix(`${flags.tag ?? 's4r1-pc'}-ending-${accept ? 'accept' : 'reject'}`);
  const fixture = loadFixture(pc, { stage: 3 });
  const kit = await openProbe(pc, { gameDir: resolveGameDir(pc), seed: Number(flags.seed ?? 1), stage: 3, fixture, prefix });
  const out = [];
  const page = kit.session.page;
  const pol = kit.policy();
  const read = () =>
    page.evaluate(() => {
      const vis = (el) => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
      const con = ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => (document.getElementById(id) || {}).textContent || '').filter(Boolean);
      const projects = [...document.querySelectorAll('.projectButton')].filter(vis).map((b) => ({ id: b.id, text: b.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim(), disabled: b.disabled }));
      const dbg = /^(save|load|reset|free|destroyAllHumans|debugBattle|availMatterZero)/;
      const buttons = [...document.querySelectorAll('button')].filter((b) => vis(b) && !b.classList.contains('projectButton') && !dbg.test(b.id)).map((b) => `${b.innerText.replace(/\s+/g, ' ').trim().slice(0, 30)}${b.disabled ? ' (grey)' : ''}`);
      const panels = [...document.querySelectorAll('#creationDiv, #wireProductionDiv, #spaceDiv, #compDiv, #swarmEngine, #qComputing, #strategyEngine, #probeDesignDiv, #powerDiv')].filter(vis).map((el) => el.id);
      const head = (document.getElementById('clips') || {}).textContent || '';
      return { con, projects, buttons, panels, head, words: (document.body.innerText.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length };
    });
  let hit = null;
  await kit.run(Number(flags.minutes ?? 180) * 60, async (t, sn) => {
    if ((sn.m.milestoneFlag || 0) >= 15) {
      hit = sn;
      return 'stop';
    }
    await pol.pass(t);
    return undefined;
  });
  if (!hit) {
    out.push(`"Universal Paperclips achieved" not reached by ${mmss(kit.t)}.`);
  } else {
    const t0 = kit.t;
    await page.screenshot({ path: `${prefix}-0-achieved.png`, fullPage: true });
    let scr = await read();
    out.push(`**${mmss(t0)} — the stage ends** (milestone 15). Header "Paperclips: ${scr.head}". Console: ${scr.con.map((c) => `"${c}"`).join(' / ')}`, `- projects on screen: ${scr.projects.map((p) => `${p.disabled ? '(grey) ' : ''}"${p.text}"`).join(' | ') || 'none'}`, `- panels: ${scr.panels.join(', ')}; ${scr.buttons.length} buttons; ${scr.words} words`, '');
    kit.mashKey = null;
    let lastCon = scr.con.join('|');
    let shots = 0;
    let decided = false;
    for (let i = 0; i < 400; i++) {
      scr = await read();
      const enabled = scr.projects.filter((p) => !p.disabled);
      const want = decided ? null : enabled.find((p) => (accept ? /^Accept/.test(p.text) : /^Reject/.test(p.text)));
      const other = enabled.find((p) => !/^(Accept|Reject)/.test(p.text));
      const choice = want || (decided || !enabled.some((p) => /^(Accept|Reject)/.test(p.text)) ? other : other);
      if (enabled.some((p) => /^(Accept|Reject)/.test(p.text)) && !decided && shots < 30) {
        await page.screenshot({ path: `${prefix}-1-offer.png`, fullPage: true });
        out.push(`**${mmss(kit.t)} — the offer**: ${scr.projects.map((p) => `"${p.text}"`).join(' | ')}`, '');
      }
      if (choice) {
        const r = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el || el.disabled) return false;
          el.click();
          return true;
        }, choice.id).catch(() => 'navigated');
        if (/^(Accept|Reject)/.test(choice.text)) decided = true;
        out.push(`- ${mmss(kit.t)} clicked "${choice.text}"${r === 'navigated' ? ' (the page reloaded)' : ''}`);
        if (r === 'navigated') break;
      } else {
        // nothing to buy: make paperclips by hand if the button works
        await page.evaluate(() => {
          const b = document.getElementById('btnMakePaperclip');
          if (b && !b.disabled && b.checkVisibility()) for (let k = 0; k < 8; k++) b.click();
        }).catch(() => {});
      }
      try {
        await kit.session.advance(2000);
      } catch (e) {
        out.push(`- ${mmss(kit.t)} the page reloaded (${String(e.message).split('\n')[0].slice(0, 80)})`);
        break;
      }
      kit.t += 2;
      const now = await read().catch(() => null);
      if (!now) {
        out.push(`- ${mmss(kit.t)} the page reloaded`);
        break;
      }
      const key = now.con.join('|');
      if (key !== lastCon) {
        const fresh = now.con.filter((c) => !lastCon.split('|').includes(c));
        if (fresh.length) out.push(...fresh.map((c) => `  - ${mmss(kit.t)} console: "${c}"`));
        lastCon = key;
        if (shots < 12 && (decided || i % 4 === 0)) await page.screenshot({ path: `${prefix}-2-step${++shots}.png`, fullPage: true }).catch(() => {});
      }
      if (decided && !now.projects.length && i % 30 === 29) out.push(`  - ${mmss(kit.t)} header "Paperclips: ${now.head}"; panels ${now.panels.join(', ') || 'none'}; buttons ${now.buttons.join('; ') || 'none'}`);
    }
    const fin = await read().catch(() => null);
    if (fin) {
      await page.screenshot({ path: `${prefix}-3-final.png`, fullPage: true }).catch(() => {});
      out.push('', `**${mmss(kit.t)} — the last screen**: header "Paperclips: ${fin.head}"; console ${fin.con.map((c) => `"${c}"`).join(' / ')}; projects ${fin.projects.map((p) => `"${p.text}"`).join(' | ') || 'none'}; panels ${fin.panels.join(', ') || 'none'}; buttons ${fin.buttons.join('; ') || 'none'}; ${fin.words} words.`);
    }
  }
  await kit.close().catch(() => {});
  fs.writeFileSync(`${prefix}.md`, [`# Paperclips: the ending, ${accept ? 'Accept' : 'Reject'} (fixture paperclips-stage3, scripted first-timer to milestone 15, then by hand; stepped, seed ${flags.seed ?? 1})`, '', ...out, ''].join('\n'));
  console.log(out.join('\n'));
  console.log(`→ ${path.relative(process.cwd(), prefix)}.md`);
}

// ------------------------------------------------------------------------------------------ main
const { pos, flags } = parseArgs(process.argv.slice(2), ['modal-shots', 'modalShots', 'accept']);
const which = pos[0];
if (!which || which === 'list') {
  console.log('runs:   ' + Object.keys(RUNS).join(', '));
  console.log('probes: ' + Object.keys(PROBES).join(', '));
  console.log('other:  table, hands <label…>, hidden <label…>, pc-ending [--accept], pc-run <variant[,…]> (' + Object.keys(PC_VARIANTS).join(', ') + ')');
  process.exit(which ? 0 : 2);
}
if (which === 'table') table(flags, pos[1] ? pos[1].split(',') : null);
else if (which === 'hands') handsCmd(pos.slice(1), flags);
else if (which === 'hidden') hiddenCmd(pos.slice(1), flags);
else if (which === 'pc-ending') await pcEnding(flags);
else if (which === 'pc-run') await pcRun((pos[1] ?? 'control').split(','), flags);
else {
  const names = which === 'all-runs' ? Object.keys(RUNS) : which === 'all-probes' ? Object.keys(PROBES) : which.split(',');
  const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [Number(flags.seed ?? 1)];
  for (const n of names) {
    if (RUNS[n]) {
      for (const seed of seeds) {
        try {
          await runScenario(n, flags, seed);
        } catch (e) {
          console.log(`${n} (seed ${seed}): FAILED ${String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`);
        }
      }
    } else if (PROBES[n]) await runProbe(n, flags);
    else console.error(`unknown scenario "${n}"`);
  }
}
