#!/usr/bin/env node
// Exploratory probes on Takeoff ("a player who does the unexpected"), added by the round-2 critic
// (ported from tools/critic-r2/explore.ts; behaviour unchanged for Stage 1).
// Usage: node tools/critic/explore.ts <scenario[,scenario…]|list|all-runs|all-probes|all-paperclips>
//          --game-dir DIR [--seed N] [--minutes MIN] [--stage N] [--tag T]
//   --stage N  start every run/probe at Stage N (Takeoff: __game.loadPreset(N); Paperclips: its
//              stage fixture); probes written for Stage 1 report what they cannot find instead.
//   --tag T    output label prefix (default "x": x-<name>[-sN][-seedN]; round 2 used "r2x").
//
// Two kinds of scenario:
//   RUNS    a whole stage played by a *modified* first-timer policy (greedy, never touches the price, …).
//           Output is a normal run (agent-tools/critic-out/<tag>-<name>.snaps/.events/.actions.json, so
//           analyze.ts/compare.ts work on it) plus <tag>-<name>.explore.md: every console/log line, every
//           modal with its body text, timer and option tooltips, the on-screen notes (#gpuNote, #marketState,
//           #trainShort, …) each time they change, and one metrics row per minute.
//   PROBES  short scripted situations (reload mid-modal / mid-countdown / mid-transition, idling, a real
//           mouse click behind a modal, the 390-px viewport), each writing <tag>-<name>.md and screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { runGame, resolveGameDir } from './lib/runner.ts';
import { openProbe } from './lib/probe.ts';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN } from './lib/util.ts';

const money = (v) => (v == null ? '—' : `$${fmtN(v, 2)}`);
const base = await loadAdapter('takeoff');
const variant = (over) => ({ ...base, policy: { ...base.policy, ...over } });
const MOBILE = { width: 390, height: 844 };
/** Output label: <tag>-<name>[-sN][-seedN]. */
const labelFor = (name, flags) => {
  const stage = Number(flags.stage ?? 1);
  return `${flags.tag ?? 'x'}-${name}${stage > 1 ? `-s${stage}` : ''}${flags.seed && Number(flags.seed) !== 1 ? `-seed${flags.seed}` : ''}`;
};

/** Everything the player can read that the 2-s snapshot does not keep. */
const READ_SCREEN = () => {
  const txt = (id) => {
    const el = document.getElementById(id);
    return el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? el.innerText.replace(/\s+/g, ' ').trim() : null;
  };
  const ov = document.getElementById('modalOverlay');
  const modalOpen = ov && ov.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  return {
    notes: {
      gpuNote: txt('gpuNote'),
      powerNote: txt('powerNote'),
      billing: txt('billingLine'),
      marketState: txt('marketState'),
      hype: txt('hypeLine'),
      powerBill: txt('powerBill'),
      copiesNote: txt('copiesNote'),
      insightNote: txt('insightNote'),
      trainCompute: txt('trainComputeLine'),
      trainShort: txt('trainShort'),
      rival: txt('rivalLine'),
      site: txt('panel-site'),
      trustNote: txt('trustCostNote'),
      ending: txt('endingTitle'),
    },
    modal: modalOpen
      ? {
          title: txt('modalTitle'),
          text: txt('modalText'),
          timer: txt('modalTimer'),
          options: [...document.querySelectorAll<HTMLButtonElement>('#modalButtons button')].map((b) => ({ id: b.id, label: b.innerText.replace(/\s+/g, ' ').trim(), title: b.title || '', disabled: b.disabled })),
        }
      : null,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
  };
};

// ------------------------------------------------------------------------------------------ RUNS
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
    const ship = enabled.find((o) => /release|ship/i.test(o.l) && !/red|wait|hold|back|not/i.test(o.l));
    return ship || enabled[0];
  },
};

const RUNS = {
  baseline: { title: 'The unmodified first-timer policy (control)', adapter: base },
  greedy: { title: 'Rents GPUs and buys marketing whenever affordable, never saves for anything', adapter: variant({ drip: [], goal: [], goalRule: null }) },
  'no-price': { title: 'Never touches the price', adapter: variant({ lower: null, raise: null }) },
  'price-up': {
    title: 'Raises the price one cent at every check and never lowers it ("dearer is richer")',
    adapter: variant({
      lower: null,
      raise: null,
      async special(ctx) {
        let c = await base.policy.special(ctx);
        if (c.buttons.some((b) => b.k === 'btn-raisePrice' && b.e) && ctx.t % 4 === 0) c = await ctx.click('btn-raisePrice', 'price-raise', 'always raise');
        return c;
      },
    }),
  },
  'no-research': { title: 'Never clicks Hire Researcher or Expand Lab (Trust is never spent)', adapter: variant({ skip: [...base.policy.skip, 'btn-hireResearcher', 'btn-expandLab'] }) },
  'hire-only': { title: 'Spends every Trust on Hire Researcher, never Expand Lab', adapter: variant({ skip: [...base.policy.skip, 'btn-expandLab'] }) },
  'expand-only': { title: 'Spends every Trust on Expand Lab, never Hire Researcher', adapter: variant({ skip: [...base.policy.skip, 'btn-hireResearcher'] }) },
  'ship-open': { title: 'Releases every model the moment Release works, open issues or not; never red-teams', adapter: variant(releaseAtOnce) },
  'modal-last': { title: 'Answers every modal with its last enabled option', adapter: variant({ modalChoice: (modal, enabled) => enabled[enabled.length - 1] }) },
  'modal-ignore': { title: 'Never answers a modal (timed ones expire, the rest stay)', adapter: variant({ modalChoice: () => null }) },
  'modal-worst': {
    title: 'Picks the worst-looking option of every modal (judged from the tooltips: lose Trust, lose researchers, cut the price, gamble)',
    adapter: variant({ modalChoice: byLabel([/take the bridge/, /cut the price/, /no comment/, /publish a rebuttal/, /let them go/, /submit Sage/, /let her try/, /release anyway/]) }),
  },
  'modal-best': {
    title: 'Picks the best-looking option of every modal (gain Trust, keep the researchers, no gamble); waits for a greyed option to become affordable',
    adapter: variant({ modalChoice: byLabel([/wait for a real round/, /open-source/, /publish the system card/, /sign it/, /match the offer|offer equity/, /decline/, /not now/, /keep fixing/], true) }),
  },
  'no-train': { title: 'Never trains a model', adapter: variant({ skip: [...base.policy.skip, 'btn-train'] }) },
  'click-only': { title: 'Never rents a GPU: the manual button only', adapter: variant({ automation: [], skip: [...base.policy.skip, 'btn-gpu'] }) },
  'no-projects': { title: 'Never buys a project (buttons only)', adapter: { ...base, policy: { ...base.policy, goal: [], goalRule: null, veto: (c) => c.buttons.filter((b) => b.kind === 'project').map((b) => b.k) } } },
  mobile: { title: 'The unmodified policy at a 390 × 844 viewport', adapter: base, viewport: MOBILE },
  // --- how much does each presented choice weigh? ---
  'focus-efficiency': { title: 'Always trains with Focus: Efficiency', adapter: variant({ special: focusSpecial('btn-focus-efficiency') }) },
  'focus-safety': { title: 'Always trains with Focus: Safety', adapter: variant({ special: focusSpecial('btn-focus-safety') }) },
  'no-marketing': { title: 'Never buys Marketing', adapter: variant({ skip: [...base.policy.skip, 'btn-marketing'] }) },
  'no-redteam-wait': { title: 'Red-teams to zero but never answers "let her try" (first option only on other modals)', adapter: variant({ modalChoice: (modal, enabled) => (/Can I try/.test(modal.title) ? enabled[enabled.length - 1] : enabled[0]) }) },
  'no-contracts': { title: 'Never buys the repeatable Custom model contract', adapter: { ...base, policy: { ...base.policy, veto: (c) => c.buttons.filter((b) => /Custom model contract/.test(b.l)).map((b) => b.k) } } },
  toggles: {
    title: 'Presses every setting (toggle, AUTO, "Name: value" button) once when it first appears, and drags each slider to its minimum when it first appears and to its maximum 10 minutes later',
    adapter: variant({ special: togglesSpecial }),
  },
  'no-side-projects': {
    title: 'Buys only research projects and the four Abilene rungs — none of the funds-priced side offers',
    adapter: { ...base, policy: { ...base.policy, veto: (c) => c.buttons.filter((b) => b.kind === 'project' && /\$/.test(b.l) && !/Reserve the Abilene|Interconnect queue|Substation|Break ground/.test(b.l)).map((b) => b.k) } },
  },
};

/** modalChoice: the first enabled option whose label matches one of `wanted`; `wait` leaves the modal open while a wanted option exists but is greyed (the timer decides if it never becomes affordable). */
function byLabel(wanted, wait = false) {
  return (modal, enabled) => {
    const hit = enabled.find((o) => wanted.some((re) => re.test(o.l)));
    if (hit) return hit;
    if (wait && modal.options.some((o) => !o.e && wanted.some((re) => re.test(o.l)))) return null;
    return enabled[0];
  };
}

/**
 * The `toggles` run: the first-timer's own steps, plus every setting (lib/pagelib.ts marks toggles,
 * ON/OFF/AUTO and "Name: value" buttons with `t`) pressed once at first sight and never again, and
 * every visible slider set to its min at first sight and to its max 600 s later (input event, as a drag).
 */
async function togglesSpecial(ctx) {
  let c = await base.policy.special(ctx);
  const mem = (ctx.memory.toggles ||= { pressed: new Set(), sliders: {} });
  for (const b of c.buttons) {
    if (!b.t || !b.e || mem.pressed.has(b.k)) continue;
    mem.pressed.add(b.k);
    c = await ctx.click(b.k, 'setting', `pressed at first sight: "${b.l}"`);
  }
  const sliders = await ctx.session.page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('input[type=range]')]
      .filter((el) => el.id && !el.disabled && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }))
      .map((el) => ({ sel: `#${el.id}`, min: el.min, max: el.max, v: el.value })),
  );
  for (const sl of sliders) {
    const st = (mem.sliders[sl.sel] ||= { first: ctx.t, phase: 0 });
    if (st.phase === 0) {
      c = await ctx.set(sl.sel, sl.min, 'slider', `first sight: ${sl.v} → minimum ${sl.min}`);
      st.phase = 1;
    } else if (st.phase === 1 && ctx.t >= st.first + 600) {
      c = await ctx.set(sl.sel, sl.max, 'slider', `${sl.v} → maximum ${sl.max}`);
      st.phase = 2;
    }
  }
  return c;
}

function focusSpecial(key) {
  return async function special(ctx) {
    let c = await base.policy.special(ctx);
    if (c.buttons.some((b) => b.k === key && b.e) && !ctx.noop.has(key)) c = await ctx.click(key, 'focus', key);
    return c;
  };
}

async function runScenario(name, flags) {
  const sc = RUNS[name];
  const label = labelFor(name, flags);
  const prefix = resolvePrefix(label);
  const lines = [];
  const modals = [];
  const noteLog = [];
  const minutes = [];
  const lastNote = {};
  let lastModalKey = null;
  let maxOverflow = 0;
  let nShots = 0;
  const shotAt = new Set((flags.shots ? String(flags.shots).split(',') : []).map(Number));
  const { meta, rec } = await runGame({
    game: 'takeoff',
    adapter: sc.adapter,
    prefix: label,
    gameDir: flags.gameDir,
    realtime: 0,
    accelMinutes: Number(flags.minutes ?? 60),
    seed: Number(flags.seed ?? 1),
    stage: Number(flags.stage ?? 1),
    viewport: sc.viewport,
    quiet: true,
    async onSnapshot({ t, raw, session }) {
      const scr = await session.page.evaluate(READ_SCREEN);
      maxOverflow = Math.max(maxOverflow, scr.overflowX);
      for (const [k, v] of Object.entries(scr.notes)) {
        if (v !== lastNote[k] && k !== 'billing' && k !== 'site' && k !== 'trainCompute') {
          if (v) noteLog.push({ t, k, v });
          lastNote[k] = v;
        }
      }
      if (scr.modal) {
        const key = `${scr.modal.title}|${scr.modal.text}`;
        if (key !== lastModalKey) {
          modals.push({ t, ...scr.modal, m: { funds: raw.m.funds, trust: raw.m.trust, tasks: raw.m.tasks } });
          if (nShots < 14) await session.page.screenshot({ path: `${prefix}.modal${++nShots}.png`, fullPage: false }).catch(() => {});
        }
        lastModalKey = key;
      } else lastModalKey = null;
      if (t % 60 === 0) minutes.push({ t, ...raw.m, numbers: raw.numbers, buttons: raw.buttons.length, billing: scr.notes.billing, pageHeight: scr.pageHeight, overflowX: scr.overflowX });
      if (shotAt.has(t)) await session.page.screenshot({ path: `${prefix}.view${t}.png`, fullPage: false }).catch(() => {});
    },
  });
  for (const e of rec.events) if (e.type === 'console' || e.type === 'log') lines.push(`${mmss(e.t)} [${e.type}${e.novel ? '' : ', repeat'}] ${e.text}`);
  const md = [`# Explore run: ${name} — ${sc.title}`, '', `Stage ${meta.stageStart} start, seed ${meta.seed}, stepped, cap ${meta.accelMinutes} min. **Stage end: ${meta.stageEnd != null ? `${mmss(meta.stageEnd)}${meta.stageEndBy ? ` (${meta.stageEndBy})` : ''}` : `not reached by ${mmss(meta.endT)}`}**. Page errors: ${meta.pageErrors.length}${meta.pageErrors.length ? ` (${meta.pageErrors[0]})` : ''}. Largest horizontal overflow: ${maxOverflow} px.`, ''];
  md.push('## Per minute', '', '| t | stage | funds | rev/s | tasks/s | sold/s | price | unbilled | GPUs | power | research | trust | researchers | lab | trainings | releases | incidents | rescues | numbers | page height | billing line |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of minutes) md.push(`| ${mmss(m.t)} | ${m.stage} | ${money(m.funds)} | ${money(m.revPerSec)} | ${fmtN(m.rate, 1)} | ${fmtN(m.soldPerSec, 1)} | ${money(m.price)} | ${fmtN(m.backlog)} | ${m.gpus} | ${fmtN(m.power)} | ${fmtN(m.research)} | ${m.trust} | ${m.researchers} | ${m.labSpace} | ${m.trainings} | ${m.releases} | ${m.incidents} | ${m.idleRescues} | ${m.numbers} | ${m.pageHeight} | ${m.billing ?? ''} |`);
  md.push('', '## Modals (first sight of each)', '');
  for (const m of modals) md.push(`- **${mmss(m.t)} — ${m.title}** ${m.timer ? `[${m.timer}] ` : ''}(funds ${money(m.m.funds)}, trust ${m.m.trust})`, `  - text: ${m.text}`, ...m.options.map((o) => `  - option${o.disabled ? ' (disabled)' : ''}: "${o.label}"${o.title ? ` — tooltip: ${o.title}` : ''}`));
  md.push('', '## Modal answers', '', ...rec.actions.filter((a) => a.why === 'modal').map((a) => `- ${mmss(a.t)} ${a.detail}`));
  md.push('', '## On-screen notes, each time they changed', '', ...noteLog.map((n) => `- ${mmss(n.t)} ${n.k}: ${n.v}`));
  md.push('', '## Console and Developments lines', '', ...lines.map((l) => `- ${l}`), '');
  fs.writeFileSync(`${prefix}.explore.md`, md.join('\n'));
  fs.writeFileSync(`${prefix}.modals.json`, JSON.stringify(modals, null, 1));
  console.log(`${name}: stage end ${meta.stageEnd != null ? `${mmss(meta.stageEnd)}${meta.stageEndBy ? ` (${meta.stageEndBy})` : ''}` : `NOT REACHED by ${mmss(meta.endT)}`} · modals ${modals.length} · overflow ${maxOverflow} px · page errors ${meta.pageErrors.length} → ${path.relative(process.cwd(), prefix)}.explore.md`);
  return meta;
}

// ---------------------------------------------------------------------------------------- PROBES
const text = (kit, sel) => kit.session.page.evaluate((s) => (document.querySelector(s) ? document.querySelector(s).innerText.replace(/\s+/g, ' ').trim() : null), sel);
const screen = (kit) => kit.session.page.evaluate(READ_SCREEN);
const state = (kit, expr) => kit.session.page.evaluate(`(() => { const s = window.__game.state; return (${expr}); })()`);
const consoleNow = (kit) => kit.session.page.evaluate(() => ['readout5', 'readout4', 'readout3', 'readout2', 'readout1'].map((id) => document.getElementById(id).textContent.trim()).filter(Boolean));

/** Plays with the policy until cond(snapshot) holds (checked before the policy acts). */
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
const withPolicy = (kit, pol) => {
  const f = kit.with(pol);
  return f;
};

const PROBES = {
  'reload-mid-modal': {
    title: 'Reload with a modal open (first modal, then the first timed modal)',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      for (const want of ['any', 'timed']) {
        const hit = await playUntil(kit, pol, 1800, async (s) => {
          if (!s.modal) return false;
          if (want === 'any') return true;
          const scr = await screen(kit);
          return !!(scr.modal && scr.modal.timer);
        });
        if (!hit) {
          out.push(`No ${want} modal within 30 minutes.`);
          continue;
        }
        const a = await screen(kit);
        const ma = (await kit.snap()).m;
        await kit.shot(`reload-mid-modal-${want}-before`);
        await kit.reload();
        const b = await screen(kit);
        const mb = (await kit.snap()).m;
        await kit.shot(`reload-mid-modal-${want}-after`);
        out.push(`**${want} modal** at ${mmss(kit.t)}: "${a.modal.title}" ${a.modal.timer ? `[${a.modal.timer}]` : '(no timer)'} — options ${a.modal.options.map((o) => `"${o.label}"`).join(' / ')}.`, `- after reload: ${b.modal ? `modal "${b.modal.title}" ${b.modal.timer ? `[${b.modal.timer}]` : '(no timer)'} still open, options ${b.modal.options.map((o) => `"${o.label}"`).join(' / ')}` : 'NO MODAL on screen'}; tasks ${fmtN(ma.tasks)} → ${fmtN(mb.tasks)}, funds ${money(ma.funds)} → ${money(mb.funds)}, choice id "${ma.choice}" → "${mb.choice}".`);
        // let 6 s pass un-answered, then answer through the policy
        await kit.run(6);
        const c = await screen(kit);
        out.push(`- 6 s later, still unanswered: ${c.modal ? `"${c.modal.title}" ${c.modal.timer ? `[${c.modal.timer}]` : ''}` : 'modal gone'}.`);
        await kit.run(4, withPolicy(kit, pol));
        out.push('');
      }
    },
  },
  'reload-mid-countdown': {
    title: 'Reload during the interconnect-queue countdown',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const isCount = async () => /^\d+:\d\d$/.test((await text(kit, '#interconnect')) || '') && (await kit.session.page.evaluate(() => document.getElementById('interconnect').checkVisibility()));
      const hit = await playUntil(kit, pol, 2400, async () => {
        if (!(await isCount())) return false;
        const v = await text(kit, '#interconnect');
        const [m, s] = v.split(':').map(Number);
        return m * 60 + s <= 150; // well inside the wait
      });
      if (!hit) return void out.push('No interconnect countdown within 40 minutes.');
      const a = { v: await text(kit, '#interconnect'), site: await text(kit, '#panel-site'), con: await consoleNow(kit), m: (await kit.snap()).m };
      await kit.shot('reload-mid-countdown-before');
      await kit.reload();
      const b = { v: await text(kit, '#interconnect'), site: await text(kit, '#panel-site'), con: await consoleNow(kit), m: (await kit.snap()).m };
      await kit.shot('reload-mid-countdown-after');
      out.push(`At ${mmss(kit.t)}: Abilene panel "${a.site}". After reload: "${b.site}". Countdown ${a.v} → ${b.v}; tasks ${fmtN(a.m.tasks)} → ${fmtN(b.m.tasks)}; funds ${money(a.m.funds)} → ${money(b.m.funds)}.`, `Console before: ${a.con.map((c) => `"${c}"`).join(' / ')}`, `Console after: ${b.con.map((c) => `"${c}"`).join(' / ')}`);
      const t0 = kit.t;
      await kit.run(200, withPolicy(kit, pol));
      out.push('', 'Next 200 s:', ...kit.linesBetween(t0, kit.t, ['console']).map((l) => `- ${l}`));
    },
  },
  'reload-mid-transition': {
    title: 'Reload half a second after Break ground (mid-narration)',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const gateRe = /Break ground/;
      const hit = await playUntil(kit, pol, 3000, async (s) => s.buttons.some((b) => gateRe.test(b.l) && b.e));
      if (!hit) return void out.push('Break ground never became affordable within 50 minutes.');
      const key = hit.buttons.find((b) => gateRe.test(b.l)).k;
      const before = (await kit.snap()).m;
      await kit.click(key, 1, 'gate');
      await kit.session.advance(500);
      const con0 = await consoleNow(kit);
      const s0 = await kit.session.metrics();
      await kit.reload();
      const con1 = await consoleNow(kit);
      const s1 = await kit.session.metrics();
      await kit.shot('reload-mid-transition-after');
      out.push(`Break ground bought at ${mmss(kit.t)} (funds ${money(before.funds)}, ${before.gpus} GPUs). 0.5 s later: stage ${s0.stage}, console ${con0.map((c) => `"${c}"`).join(' / ')}.`, `After reload: stage ${s1.stage}, funds ${money(s0.funds)} → ${money(s1.funds)}, GPUs ${s0.gpus} → ${s1.gpus}; console ${con1.map((c) => `"${c}"`).join(' / ') || '(empty)'}.`);
      const t0 = kit.t;
      const end = await kit.run(30);
      out.push('', 'Next 30 s (nothing clicked):', ...kit.linesBetween(t0, kit.t, ['console', 'log']).map((l) => `- ${l}`), '', 'On screen:', ...kit.screen(end, { lines: 5 }).map((l) => `- ${l}`));
      await kit.shot('reload-mid-transition-30s');
    },
  },
  'reload-mid-redteam': {
    title: 'Reload during the red-team cool-down and during evaluation',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy({}, false);
      const hit = await playUntil(kit, pol, 1800, async (s) => s.m.trainingPhase === 'redteam' && (s.m.issuesOpen ?? 0) > 0);
      if (!hit) return void out.push('No evaluation with open issues within 30 minutes.');
      await kit.click('btn-redteam', 1, 'redteam');
      await kit.session.advance(1000);
      const a = { label: await text(kit, '#btn-redteam'), open: await text(kit, '#issuesOpen'), rem: (await kit.session.metrics()).redTeamRemaining, dis: await kit.session.page.evaluate(() => (document.getElementById('btn-redteam') as HTMLButtonElement).disabled) };
      await kit.reload();
      const b = { label: await text(kit, '#btn-redteam'), open: await text(kit, '#issuesOpen'), rem: (await kit.session.metrics()).redTeamRemaining, dis: await kit.session.page.evaluate(() => (document.getElementById('btn-redteam') as HTMLButtonElement).disabled) };
      await kit.shot('reload-mid-redteam');
      out.push(`At ${mmss(kit.t)}, 1 s after clicking Red-team: button "${a.label}" (${a.dis ? 'disabled' : 'enabled'}), open issues ${a.open}, cool-down ${fmtN(a.rem, 1)} s. After reload: "${b.label}" (${b.dis ? 'disabled' : 'enabled'}), open issues ${b.open}, cool-down ${fmtN(b.rem, 1)} s.`);
    },
  },
  'idle-10min-new': {
    title: 'Idle 10 minutes on a brand-new game',
    async run(kit, out) {
      const end = await kit.run(600);
      await kit.shot('idle-10min-new');
      const ev = kit.linesBetween(0, kit.t);
      out.push('Nothing clicked for 600 s. Everything that appeared:', ...(ev.length ? ev.map((l) => `- ${l}`) : ['- (nothing)']), ...kit.revealsBetween(0, kit.t).map((l) => `- reveal ${l}`), '', `At 10:00 — tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)}, idle rescues ${end.m.idleRescues}:`, ...kit.screen(end).map((l) => `- ${l}`));
    },
  },
  'idle-mid': {
    title: 'Play 10 minutes, then walk away for 10 minutes, then come back',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const a = await kit.run(600, withPolicy(kit, pol));
      kit.mashKey = null;
      const t0 = kit.t;
      const scrA = await screen(kit);
      const b = await kit.run(600);
      await kit.shot('idle-mid-after-10min-away');
      const scrB = await screen(kit);
      out.push(`At ${mmss(t0)} (walking away): funds ${money(a.m.funds)}, ${a.m.gpus} GPUs, power ${fmtN(a.m.power)} kWh (grid ${a.m.gridAuto ? 'ON' : 'off'}), research ${fmtN(a.m.research)}, trust ${a.m.trust}, training "${a.m.trainingPhase || 'idle'}", billing "${scrA.notes.billing}".`, '', 'While away (600 s, nothing clicked):', ...kit.linesBetween(t0 + 1, kit.t).map((l) => `- ${l}`), '', `At ${mmss(kit.t)} (back): funds ${money(b.m.funds)}, ${b.m.gpus} GPUs, power ${fmtN(b.m.power)} kWh, unbilled ${fmtN(b.m.backlog)}, research ${fmtN(b.m.research)}, trust ${b.m.trust}, training "${b.m.trainingPhase || 'idle'}", idle rescues ${b.m.idleRescues}, billing "${scrB.notes.billing}"${scrB.modal ? `, modal open "${scrB.modal.title}" ${scrB.modal.timer || ''}` : ''}.`, '', 'On screen:', ...kit.screen(b, { lines: 5 }).map((l) => `- ${l}`));
      const t1 = kit.t;
      const c = await kit.run(300, withPolicy(kit, pol));
      out.push('', `After 5 more minutes of normal play: funds ${money(c.m.funds)}, rev ${money(c.m.revPerSec)}/s, ${c.m.gpus} GPUs, trust ${c.m.trust}.`, ...kit.linesBetween(t1 + 1, t1 + 60, ['console']).map((l) => `- ${l}`));
    },
  },
  'price-200x-at-start': {
    title: 'Raise the price 200× the moment the price buttons appear (before any GPU)',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      await kit.run(4);
      const s0 = await kit.snap();
      if (!kit.find(s0, 'btn-raisePrice')) return void out.push('No raise button at 0:04.');
      const n = await kit.click('btn-raisePrice', 200, 'raise');
      const s1 = await kit.snap();
      const scr1 = await screen(kit);
      out.push(`At ${mmss(kit.t)}: clicked raise ${n}× → price ${money(s1.m.price)}; billing line "${scr1.notes.billing}".`);
      const t0 = kit.t;
      const pol = kit.policy({ lower: null, raise: null });
      const end = await kit.run(300, withPolicy(kit, pol));
      await kit.shot('price-200x-at-start');
      const scr = await screen(kit);
      out.push(`After 300 s of clicking Complete Task at 4/s and buying whatever is affordable (price never touched): tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)}, GPUs ${end.m.gpus}, unbilled ${fmtN(end.m.backlog)}, idle rescues ${end.m.idleRescues}; billing line "${scr.notes.billing}".`, '', 'Lines:', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`), '', 'On screen:', ...kit.screen(end).map((l) => `- ${l}`));
    },
  },
  'modal-click-through': {
    title: 'With a modal open, can the player still use the game behind it? (real mouse and keyboard)',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const hit = await playUntil(kit, pol, 1800, async (s) => !!s.modal);
      if (!hit) return void out.push('No modal within 30 minutes.');
      const { page } = kit.session;
      const scr = await screen(kit);
      await kit.shot('modal-click-through');
      const box = await page.locator('#btn-task').boundingBox();
      const before = await kit.session.metrics();
      let mouse = 'not attempted';
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const after = await kit.session.metrics();
        mouse = after.tasks > before.tasks ? `went through (tasks ${before.tasks} → ${after.tasks})` : 'blocked by the overlay (tasks unchanged)';
      }
      const top = await page.evaluate(() => {
        const b = (document.getElementById('btn-task') as HTMLButtonElement).getBoundingClientRect();
        const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        const ov = document.getElementById('modalOverlay');
        const cs = getComputedStyle(ov);
        return { top: el ? el.id || el.tagName : null, overlay: { position: cs.position, bg: cs.backgroundColor, pe: cs.pointerEvents, w: ov.getBoundingClientRect().width, h: ov.getBoundingClientRect().height }, focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null };
      });
      await page.keyboard.press('Escape');
      const afterEsc = await screen(kit);
      out.push(`Modal at ${mmss(kit.t)}: "${scr.modal.title}" ${scr.modal.timer ? `[${scr.modal.timer}]` : '(no timer)'}.`, `- real mouse click on Complete Task: ${mouse}; element on top at that point: ${top.top}; overlay ${JSON.stringify(top.overlay)}; keyboard focus on: ${top.focus}.`, `- Escape: ${afterEsc.modal ? 'modal stays open' : 'modal closed'}.`);
      const t0 = kit.t;
      const m0 = await kit.session.metrics();
      await kit.run(20);
      const m1 = await kit.session.metrics();
      const scr2 = await screen(kit);
      out.push(`- game clock while the modal is open: tasks ${fmtN(m0.tasks)} → ${fmtN(m1.tasks)} in 20 s (${m1.tasks > m0.tasks ? 'the game keeps running' : 'paused'}); modal ${scr2.modal ? `still open ${scr2.modal.timer ? `[${scr2.modal.timer}]` : ''}` : 'gone'}.`, ...kit.linesBetween(t0, kit.t).map((l) => `  - ${l}`));
    },
  },
  tour: {
    title: 'Screens at the moments a newcomer meets something new, and the full text of every project card',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const { page } = kit.session;
      const seen = new Set();
      const cards = [];
      const shots = new Set();
      let peak: { n: number; t: number; phase?: string; modal?: string } = { n: 0, t: 0 };
      const shotOnce = async (name, t) => {
        if (shots.has(name)) return;
        shots.add(name);
        await page.screenshot({ path: `${kit.prefix}-${name}.png`, fullPage: true });
        out.push(`- shot \`${path.basename(kit.prefix)}-${name}.png\` at ${mmss(t)}`);
      };
      let prevPanels = 0;
      await kit.run(2100, async (t, s) => {
        if (s.m.stage > 1 && !shots.has('z-arrival')) {
          await shotOnce('z-arrival', t);
          return 'stop';
        }
        const info = await page.evaluate(() => {
          const vis = (el) => el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
          const list = [...document.querySelectorAll<HTMLElement>('#projectList .projectButton')].filter(vis).map((b) => {
            const r = b.getBoundingClientRect();
            return { id: b.id, text: b.innerText.replace(/\s*\n\s*/g, ' ⏎ ').trim(), title: b.title || '', cls: b.className, clipped: b.scrollHeight > b.clientHeight + 1, h: Math.round(r.height), sh: b.scrollHeight };
          });
          const g = (id) => (vis(document.getElementById(id)) ? document.getElementById(id).innerText.replace(/\s+/g, ' ').trim() : null);
          return { list, gpuNote: g('gpuNote'), evalText: g('train-eval'), redteam: g('train-redteam'), site: g('panel-site'), research: g('panel-research'), training: g('panel-training') };
        });
        for (const c of info.list) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            cards.push({ t, ...c });
          }
        }
        if (s.numbers > peak.n) peak = { n: s.numbers, t, phase: s.m.trainingPhase, modal: s.modal ? s.modal.title : null };
        if (s.panels.length !== prevPanels) await shotOnce(`panels${s.panels.length}`, t);
        prevPanels = s.panels.length;
        if (s.m.trainingPhase === 'evaluating') await shotOnce('evaluating', t);
        if (s.m.trainingPhase === 'redteam') {
          if (!shots.has('redteam')) out.push(`- red-team block reads: "${info.redteam}"; eval block: "${info.evalText}"`);
          await shotOnce('redteam', t);
        }
        if (s.m.trainingPhase === 'training') await shotOnce('training', t);
        if (info.gpuNote) {
          if (!shots.has('gpu-note')) out.push(`- GPU note at ${mmss(t)}: "${info.gpuNote}" (GPUs ${s.m.gpus})`);
          await shotOnce('gpu-note', t);
        }
        if (/\d:\d\d/.test(info.site || '')) await shotOnce('countdown', t);
        if (s.buttons.some((b) => b.k === 'btn-focus-capability')) await shotOnce('focus', t);
        if (info.list.some((c) => c.clipped)) {
          if (!shots.has('clipped-card')) out.push(`- clipped project card at ${mmss(t)}: ${info.list.filter((c) => c.clipped).map((c) => `"${c.text}" (box ${c.h} px, content ${c.sh} px)`).join('; ')}`);
          await shotOnce('clipped-card', t);
        }
        await pol.pass(t);
        return undefined;
      });
      out.push('', `Peak numbers on screen: ${peak.n} at ${mmss(peak.t)} (training phase "${peak.phase || 'idle'}"${peak.modal ? `, modal "${peak.modal}"` : ''}).`, '', '## Project cards at first sight', '', '| t | card text | classes | tooltip |', '|---|---|---|---|', ...cards.map((c) => `| ${mmss(c.t)} | ${c.text.replace(/\|/g, '/')} | ${c.cls.replace('projectButton', '').trim()} | ${c.title} |`));
    },
  },
  'wall-flag': {
    title: 'Hire-only player: is the research-wall line ever printed? (reads state.flags)',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy({ skip: ['btn-expandLab'] });
      let first = null;
      await kit.run(600, async (t, s) => {
        const f = await state(kit, `({ flags: Object.keys(s.flags).filter((k) => k.startsWith('wall')), research: s.research, projects: !!s.revealed.projects, expandLab: !!s.revealed.expandLab })`);
        if (f.flags.length && !first) first = { t, ...f, console: s.console };
        await pol.pass(t);
      });
      const end = await kit.snap();
      await kit.shot('10min');
      const lines = kit.rec.events.filter((e) => e.type === 'console' && /capacity|nearly full/i.test(e.text)).map((e) => `${mmss(e.t)} "${e.text}"`);
      out.push(first ? `First wall flag at ${mmss(first.t)}: ${JSON.stringify(first.flags)} with research ${fmtN(first.research)}, Projects panel revealed: ${first.projects}, Expand Lab revealed: ${first.expandLab}; newest console line then: "${first.console}".` : 'No wall flag in 10 minutes.', `At 10:00: research ${fmtN(end.m.research)}, lab space ${end.m.labSpace}, researchers ${end.m.researchers}; grey projects: ${end.buttons.filter((b) => b.kind === 'project' && !b.e).map((b) => b.l).join(' | ')}.`, `Console lines about the lab or capacity in 10 minutes: ${lines.join('; ') || 'none'}.`);
    },
  },
  'price-floor': {
    title: 'Lower the price to the floor at 0:04; then what 120 s of hand-clicking pays at several prices',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      await kit.run(4);
      const n = await kit.click('btn-lowerPrice', 100, 'lower');
      out.push(`Lower accepted ${n}× → price ${await text(kit, '#price')}; lower button disabled: ${await kit.session.page.evaluate(() => (document.getElementById('btn-lowerPrice') as HTMLButtonElement).disabled)}; billing line "${await text(kit, '#billingLine')}".`);
      const pol = kit.policy({ lower: null, raise: null });
      const end = await kit.run(300, withPolicy(kit, pol));
      out.push(`After 5 minutes at the floor (4 clicks/s, buying whatever is affordable): tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)}, GPUs ${end.m.gpus}, displayed revenue ${money(end.m.revPerSec)}/s; billing line "${await text(kit, '#billingLine')}".`, ...kit.linesBetween(0, kit.t, ['console']).map((l) => `- ${l}`), '', '| price | tasks made in 120 s | billed | funds gained | billed × price | Σ displayed rev/s |', '|---|---|---|---|---|---|');
      for (const lowers of [24, 23, 20, 10, 0]) {
        const k2 = await openProbe(base, { gameDir: kit.gameDir, seed: 1, prefix: kit.prefix, stage: kit.stage });
        try {
          k2.mashKey = 'btn-task';
          await k2.run(2);
          await k2.click('btn-lowerPrice', lowers, 'lower');
          const a = await k2.session.metrics();
          let revSum = 0;
          await k2.run(120, async (t, s) => {
            revSum += (s.m.revPerSec || 0) * 2;
          });
          const b = await k2.session.metrics();
          const billed = b.tasks - b.backlog - (a.tasks - a.backlog);
          out.push(`| ${money(b.price)} | ${fmtN(b.tasks - a.tasks)} | ${fmtN(billed)} | ${money(b.funds - a.funds)} | ${money(billed * b.price)} | ${money(revSum)} |`);
        } finally {
          await k2.close();
        }
      }
    },
  },
  'contracts-vs-price': {
    title: 'Minute 21: raise the price 300× and do nothing for 60 s — what happens to income?',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      await kit.run(1260, withPolicy(kit, pol));
      const read = async () => ({ contracts: await text(kit, '#contractRate'), rev: await text(kit, '#revPerSec'), billing: await text(kit, '#billingLine'), price: await text(kit, '#price'), funds: (await kit.session.metrics()).funds });
      const a = await read();
      const n = await kit.click('btn-raisePrice', 300, 'raise');
      kit.mashKey = null;
      const t0 = kit.t;
      await kit.run(60);
      const b = await read();
      out.push(`At ${mmss(t0)}: price ${a.price}, "${a.billing}", "Avg. Rev. per sec: ${a.rev}", "Contracts: ${a.contracts} per sec".`, `After ${n} raises and 60 s with nothing clicked: price ${b.price}, "${b.billing}", "Avg. Rev. per sec: ${b.rev}", "Contracts: ${b.contracts} per sec"; funds grew ${money(b.funds - a.funds)} in 60 s (${money((b.funds - a.funds) / 60)}/s).`, '', ...kit.linesBetween(t0, kit.t, ['console']).map((l) => `- ${l}`));
    },
  },
  'modal-hover': {
    title: 'Are the consequences of a modal option visible anywhere but the title tooltip? Where does Tab go?',
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const { page } = kit.session;
      let n = 0;
      await kit.run(1500, async (t, s) => {
        if (s.modal && /Bridge|Better Offer/.test(s.modal.title)) {
          n++;
          const info = [];
          for (const b of await page.$$('#modalButtons button')) {
            await b.hover({ force: true }).catch(() => {});
            await new Promise((r) => setTimeout(r, 1200));
            info.push(await b.evaluate((el) => ({ text: el.innerText, title: el.title, disabled: el.disabled, after: getComputedStyle(el, '::after').content, describedby: el.getAttribute('aria-describedby') })));
          }
          await page.screenshot({ path: `${kit.prefix}-${n}.png`, fullPage: false });
          const visible = await page.evaluate(() => document.getElementById('modal').innerText.replace(/\s*\n\s*/g, ' / '));
          await page.keyboard.press('Tab');
          const f1 = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
          await page.keyboard.press('Tab');
          const f2 = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
          out.push(`**${mmss(t)} "${s.modal.title}"** — visible text: "${visible}"`, ...info.map((o) => `- option "${o.text}"${o.disabled ? ' (disabled)' : ''}: title="${o.title}", ::after ${o.after}, aria-describedby ${o.describedby}`), `- Tab, Tab → focus on ${f1}, then ${f2} (buttons behind the overlay).`, '');
          if (n >= 2) return 'stop';
        }
        await pol.pass(t);
        return undefined;
      });
    },
  },
  'mobile-shots': {
    title: '390 × 844 viewport: what is on the first screen, how far the page scrolls',
    viewport: MOBILE,
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      const { page } = kit.session;
      const where = () =>
        page.evaluate(() => {
          const ids = ['consoleDiv', 'tasksHeader', 'gameDate', 'btn-task', 'powerRows', 'panel-business', 'panel-infrastructure', 'panel-research', 'panel-projects', 'panel-training', 'panel-site', 'panel-log', 'btn-gpu', 'btn-train', 'btn-release', 'btn-lowerPrice'];
          const o = {};
          for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })) {
              const r = el.getBoundingClientRect();
              o[id] = [Math.round(r.top + window.scrollY), Math.round(r.height), Math.round(r.width)];
            }
          }
          const small = [...document.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) && !b.closest('#dev')).map((b) => ({ id: b.id, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
          return { o, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, minButton: small.reduce((a, b) => (a && a.h <= b.h ? a : b), null), buttons: small.length, tiny: small.filter((b) => b.h < 32).length, font: getComputedStyle(document.body).fontSize };
        });
      const marks = [2, 60, 180, 300, 600, 1200];
      let modalShot = 0;
      for (const mark of marks) {
        await kit.run(mark - kit.t, async (t, s) => {
          if (s.modal && modalShot < 3) {
            modalShot++;
            await page.screenshot({ path: `${kit.prefix}-mobile-modal${modalShot}.png`, fullPage: false });
            const mb = await page.evaluate(() => {
              const r = document.getElementById('modal').getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), vw: window.innerWidth, vh: window.innerHeight };
            });
            out.push(`- modal at ${mmss(t)} "${s.modal.title}": box ${mb.w}×${mb.h} at (${mb.left}, ${mb.top}) in a ${mb.vw}×${mb.vh} viewport${mb.h > mb.vh ? ' — TALLER THAN THE VIEWPORT' : ''}.`);
          }
          await pol.pass(t);
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${kit.prefix}-mobile-t${mark}-fold.png`, fullPage: false });
        await page.screenshot({ path: `${kit.prefix}-mobile-t${mark}-full.png`, fullPage: true });
        const w = await where();
        out.push(`**${mmss(mark)}** — page ${w.w}×${w.h} px (viewport ${w.cw}×844 → ${(w.h / 844).toFixed(1)} screens; horizontal overflow ${w.w - w.cw} px); body font ${w.font}; ${w.buttons} buttons, ${w.tiny} under 32 px tall (smallest ${w.minButton ? `${w.minButton.id} ${w.minButton.w}×${w.minButton.h}` : '—'}).`, `- top offsets (px): ${Object.entries(w.o).map(([k, v]) => `${k} ${v[0]}`).join(', ')}`);
      }
    },
  },
};

async function runProbe(name, flags) {
  const pr = PROBES[name];
  const prefix = resolvePrefix(labelFor(name, { ...flags, seed: undefined }));
  const gameDir = resolveGameDir(base, flags.gameDir);
  const stage = Number(flags.stage ?? 1);
  const out = [];
  let kit;
  try {
    kit = await openProbe(base, { gameDir, seed: Number(flags.seed ?? 1), prefix, viewport: pr.viewport, stage });
    kit.gameDir = gameDir;
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
  fs.writeFileSync(`${prefix}.md`, [`# Explore probe: ${name} — ${pr.title}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, Stage ${stage} start, seed ${flags.seed ?? 1}, stepped. Times are game time.`, '', ...out, ''].join('\n'));
}

// ------------------------------------------------------------------- Paperclips reference runs
// The same question asked of the reference: how much does its first lever weigh, and does it warn
// a player who puts every Trust into one of its two sinks? Writes <tag>-<name>.* and <tag>-<name>.md.
const pc = await loadAdapter('paperclips');
const PC_RUNS = {
  'pc-no-price': { title: 'Paperclips, never touches the price', minutes: 40, over: { lower: null, raise: null } },
  'pc-proc-only': { title: 'Paperclips, every Trust into Processors, never Memory', minutes: 60, over: { skip: [...pc.policy.skip, 'btnAddMem'], special: null, veto: () => [] } },
  'pc-mobile': { title: 'Paperclips at a 390 × 844 viewport (10 minutes)', minutes: 10, over: {}, viewport: MOBILE },
};
async function runPaperclips(name, flags) {
  const sc = PC_RUNS[name];
  const label = labelFor(name, { ...flags, seed: undefined });
  const prefix = resolvePrefix(label);
  const rows = [];
  let maxOverflow = 0;
  const { meta, rec } = await runGame({
    game: 'paperclips',
    adapter: { ...pc, policy: { ...pc.policy, ...sc.over } },
    prefix: label,
    realtime: 0,
    accelMinutes: Number(flags.minutes ?? sc.minutes),
    seed: Number(flags.seed ?? 1),
    stage: Number(flags.stage ?? 1),
    viewport: sc.viewport,
    quiet: true,
    async onSnapshot({ t, raw, session }) {
      if (sc.viewport) maxOverflow = Math.max(maxOverflow, await session.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
      if (t % 300 === 0) rows.push(`| ${mmss(t)} | ${fmtN(raw.m.clips)} | ${money(raw.m.funds)} | ${money(raw.m.price)} | ${fmtN(raw.m.backlog)} | ${raw.m.clipmakerLevel} | ${raw.m.trust} | ${raw.m.processors} / ${raw.m.memory} | ${fmtN(raw.m.ops)} / ${fmtN(raw.m.maxOps)} | ${raw.buttons.filter((b) => b.kind === 'project' && !b.e).length} |`);
    },
  });
  const con = rec.events.filter((e) => e.type === 'console' && e.novel).map((e) => `- ${mmss(e.t)} ${e.text}`);
  fs.writeFileSync(`${prefix}.md`, [`# Explore run: ${name} — ${sc.title}`, '', `Stage ${meta.stageStart} start, seed ${meta.seed}, stepped to ${mmss(meta.endT)}.${sc.viewport ? ` Largest horizontal overflow: ${maxOverflow} px.` : ''}`, '', '| t | clips | funds | price | unsold | AutoClippers | trust | processors / memory | ops | grey projects |', '|---|---|---|---|---|---|---|---|---|---|', ...rows, '', '## Distinct console lines', '', ...con, '', '## Projects bought', '', ...rec.actions.filter((a) => a.why === 'project').map((a) => `- ${mmss(a.t)} ${a.label}`), ''].join('\n'));
  console.log(`${name}: done → ${path.relative(process.cwd(), prefix)}.md`);
}

const { pos, flags } = parseArgs(process.argv.slice(2));
const which = pos[0];
if (!which || which === 'list') {
  console.log('runs:       ' + Object.keys(RUNS).join(', '));
  console.log('probes:     ' + Object.keys(PROBES).join(', '));
  console.log('paperclips: ' + Object.keys(PC_RUNS).join(', '));
  process.exit(which ? 0 : 2);
}
const names = which === 'all-runs' ? Object.keys(RUNS) : which === 'all-probes' ? Object.keys(PROBES) : which === 'all-paperclips' ? Object.keys(PC_RUNS) : which.split(',');
for (const n of names) {
  if (RUNS[n]) await runScenario(n, flags);
  else if (PROBES[n]) await runProbe(n, flags);
  else if (PC_RUNS[n]) await runPaperclips(n, flags);
  else console.error(`unknown scenario "${n}"`);
}
