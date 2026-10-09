#!/usr/bin/env node
// Usage: node tools/critic/softlock.ts <takeoff|paperclips> [--game-dir DIR] [--seed N] [--stage N] [--scenario NAME] [--out LABEL]
// Dead-end probes from critic report §4, each a named scenario played in stepped (deterministic)
// mode from a new game (or, with --stage N, from the start of Stage N). Each reports what the player
// sees and whether/when recovery is possible, or "scenario no longer applicable: <reason>" when the
// game no longer has what it needs. A scenario with `stages` runs only at those stages (Takeoff's
// power-zero, idle-new-game and price-200x are Stage 1 situations; ignore-research-15min needs
// Stage 1–2's Hire Researcher / Expand Lab).
// Writes <out>.md (default softlock-<game>[-sN].md) and <out>-<scenario>.png screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { openProbe, NotApplicable } from './lib/probe.ts';
import { resolveGameDir } from './lib/runner.ts';
import { loadAdapter, parseArgs, resolvePrefix, mmss, fmtN } from './lib/util.ts';

const money = (v) => (v == null ? '—' : `$${fmtN(v, 2)}`);
const need = (cond, reason) => {
  if (!cond) throw new NotApplicable(reason);
};
const text = (kit, sel) => kit.session.page.evaluate((s) => (document.querySelector(s) ? document.querySelector(s).textContent.trim() : null), sel);

// ------------------------------------------------------------------------------------- Takeoff
const TAKEOFF = [
  {
    name: 'power-zero',
    title: 'Spend everything on GPUs until power hits 0',
    stages: { 1: true, other: 'Stage 1 only: power is a consumable bought by the 1,000 there; from Stage 2 it is built capacity (MW)' },
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      let zero = null;
      await kit.run(600, async (t, s) => {
        if ((s.m.power ?? 1) < 1 && (s.m.automation || 0) >= 1) {
          zero = s;
          return 'stop';
        }
        if (kit.find(s, 'btn-gpu')) for (let i = 0; i < 30; i++) if (!(await kit.click('btn-gpu', 1, 'gpu'))) break;
        return undefined;
      });
      need(zero, 'power never reached 0 within 10 minutes of buying only GPUs');
      await kit.shot('power-zero');
      out.push(`Power hit 0 at ${mmss(zero.t)} with ${zero.m.gpus} GPUs and ${money(zero.m.funds)} (no power ever bought).`, '', 'On screen at that moment:', ...kit.screen(zero).map((l) => `- ${l}`));
      const main = kit.find(zero, 'btn-task');
      out.push(`- main button "Complete Task": ${main ? (main.e ? 'enabled' : 'disabled') : 'not visible'}`, '');
      // Watch 4 minutes, still clicking the main button when it works, buying nothing.
      const t0 = kit.t;
      let buyBack = null;
      let rescueVisible = null;
      await kit.run(240, async (t, s) => {
        const bp = kit.find(s, 'btn-buyPower');
        if (!buyBack && bp && bp.e) buyBack = t;
        const rescue = s.buttons.find((b) => b.kind === 'project' && b.e);
        if (!rescueVisible && (rescue || s.modal)) rescueVisible = { t, what: rescue ? rescue.l : `modal "${s.modal.title}"` };
      });
      out.push('Next 4 minutes (main button clicked when enabled, nothing bought):', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`));
      const reveals = kit.revealsBetween(t0, kit.t);
      if (reveals.length) out.push(...reveals.map((l) => `- reveal ${l}`));
      out.push('', `Recovery: Buy Power affordable again ${buyBack != null ? `at ${mmss(buyBack)} (${buyBack - zero.t} s after power hit 0, from unbilled tasks still selling)` : 'never within 4 minutes'}; first rescue offer ${rescueVisible ? `at ${mmss(rescueVisible.t)}: ${rescueVisible.what}` : 'none within 4 minutes'}.`);
    },
  },
  {
    name: 'idle-new-game',
    title: 'Idle 3 minutes on a brand-new game',
    stages: { 1: true, other: 'Stage 1 only: a brand-new game' },
    async run(kit, out) {
      const s0 = await kit.snap();
      need(kit.find(s0, 'btn-task'), 'no main button on a new game');
      const end = await kit.run(180);
      await kit.shot('idle-new-game');
      const ev = kit.linesBetween(0, kit.t);
      out.push('Nothing clicked for 180 s. Everything that appeared:', ...(ev.length ? ev.map((l) => `- ${l}`) : ['- (nothing)']));
      const rv = kit.revealsBetween(0, kit.t);
      if (rv.length) out.push(...rv.map((l) => `- reveal ${l}`));
      out.push('', `At 3:00 — tasks ${fmtN(end.m.tasks)}, funds ${money(end.m.funds)}:`, ...kit.screen(end).map((l) => `- ${l}`));
      const modal = kit.rec.events.find((e) => e.type === 'modal');
      out.push('', modal ? `A modal opened at ${mmss(modal.t)} ("${modal.title}") with ${fmtN(kit.rec.snaps.find((s) => s.t === modal.t)?.m.tasks ?? 0)} tasks completed.` : 'No modal opened.');
    },
  },
  {
    name: 'price-200x',
    title: 'Raise the price 200× (after 3 minutes of normal play)',
    stages: { 1: true, other: 'Stage 1 only: the scenario starts from a new game' },
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      await kit.run(180, kit.with(pol));
      const s0 = await kit.snap();
      need(kit.find(s0, 'btn-raisePrice'), 'no raise-price button after 3 minutes');
      const before = { price: s0.m.price, demand: await text(kit, '#demand'), rev: s0.m.revPerSec, backlog: s0.m.backlog };
      const n = await kit.click('btn-raisePrice', 200, 'raise');
      const s1 = await kit.snap();
      out.push(`At ${mmss(kit.t)}: price ${money(before.price)}, demand ${before.demand}%, revenue ${money(before.rev)}/s, unbilled ${fmtN(before.backlog)}. Clicked raise ${n}× → price ${money(s1.m.price)} (no cap hit: ${n === 200 ? 'yes' : `stopped after ${n}`}).`);
      const t0 = kit.t;
      const noPrice = kit.policy({ lower: null, raise: null });
      kit.mashKey = null;
      const s2 = await kit.run(120, kit.with(noPrice));
      await kit.shot('price-200x');
      out.push(`After 120 s at that price (policy keeps buying, never touches the price): demand ${await text(kit, '#demand')}%, revenue ${money(s2.m.revPerSec)}/s, sold ${fmtN(s2.m.soldPerSec)}/s, unbilled ${fmtN(s2.m.backlog)}.`, '', 'Lines in those 120 s:', ...(kit.linesBetween(t0, kit.t).map((l) => `- ${l}`) || []), '', 'On screen:', ...kit.screen(s2).map((l) => `- ${l}`));
      const k = await kit.click('btn-lowerPrice', 200, 'lower');
      const s3 = await kit.run(60, kit.with(noPrice));
      out.push('', `Recovery: lowering ${k}× back to ${money(s3.m.price)} → after 60 s revenue ${money(s3.m.revPerSec)}/s, unbilled ${fmtN(s3.m.backlog)}.`);
    },
  },
  {
    name: 'ignore-research-15min',
    title: 'Ignore research for 15 minutes (never Hire Researcher / Expand Lab)',
    stages: { 1: true, 2: true, other: 'Stages 1–2 only: Hire Researcher and Expand Lab leave the screen in Stage 3' },
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy({ skip: ['btn-hireResearcher', 'btn-expandLab'] });
      let labFull = null;
      const step = async (t, snap) => {
        const tr = kit.find(snap, 'btn-train');
        if (!labFull && tr && /lab holds/i.test(tr.why || '')) labFull = { t, why: tr.why };
        await pol.pass(t);
      };
      step.policy = pol; // as kit.with(pol): the policy decides when mashing stops
      const s = await kit.run(900, step);
      need(kit.rec.events.some((e) => e.type === 'reveal' && e.key === 'btn-hireResearcher'), 'no Hire Researcher button appeared in 15 minutes');
      await kit.shot('ignore-research-15min');
      if (kit.stage >= 2) {
        const tr = kit.find(s, 'btn-train');
        const trains = kit.rec.actions.filter((a) => /^Train /.test(a.label || ''));
        out.push(`Stage ${kit.stage}: Train ${tr ? `${tr.e ? 'enabled' : 'grey'}${tr.why ? ` ("${tr.why}")` : ''}` : 'not visible'} at 15:00; Train pressed ${trains.length}× (last ${trains.length ? `${mmss(trains[trains.length - 1].t)} ${trains[trains.length - 1].label}` : '—'}); Train first greyed by the lab cap ${labFull ? `at ${mmss(labFull.t)} ("${labFull.why}")` : 'never in 15 minutes'}.`);
      }
      const cap = await text(kit, '#researchCap');
      const tp = s.buttons.find((b) => /Training Pipeline/.test(b.l));
      const capLines = kit.rec.events.filter((e) => e.type === 'console' && /capacity/i.test(e.text));
      out.push(`At 15:00: Trust ${fmtN(s.m.trust)} unspent, research ${fmtN(s.m.research)} / ${cap}, researchers ${s.m.researchers}, lab space ${s.m.labSpace}.`, `Training Pipeline: ${tp ? (tp.e ? 'visible, affordable' : 'visible, grey for the rest of the run') : 'not visible'}${kit.rec.actions.some((a) => /Training Pipeline/.test(a.label || '')) ? ' (bought)' : ''}.`, `Capacity lines printed: ${capLines.length}${capLines.length ? ` ("${capLines[0].text}", first at ${mmss(capLines[0].t)})` : ''}.`, '', 'On screen at 15:00:', ...kit.screen(s).map((l) => `- ${l}`));
      out.push('', `Recovery: spending the Trust (Hire/Expand) is the way out; ${s.buttons.some((b) => /Expand Lab/.test(b.l) && b.e) ? 'Expand Lab is enabled at 15:00' : 'Expand Lab is not enabled at 15:00'}.`);
    },
  },
  {
    name: 'reload-mid-training',
    title: 'Reload the page mid-training',
    stages: { 1: true, 2: true, 3: true, other: 'Stages 1–3 only: the Training panel leaves the screen in Stage 4' },
    async run(kit, out) {
      kit.mashKey = 'btn-task';
      const pol = kit.policy();
      let mid = null;
      await kit.run(1500, async (t, s) => {
        await pol.pass(t);
        if (s.m.trainingPhase === 'training') {
          const pct = Number(await text(kit, '#runPct'));
          if (pct >= 25) {
            mid = s;
            return 'stop';
          }
        }
        return undefined;
      });
      need(mid, 'no training run reached 25% within 25 minutes');
      const grab = async () => ({ pct: await text(kit, '#runPct'), remaining: await text(kit, '#runRemaining'), name: await text(kit, '#runName'), con: await text(kit, '#readout1'), m: (await kit.snap()).m });
      const a = await grab();
      const panelsA = (await kit.snap()).panels.map((p) => p.l).join(', ');
      await kit.reload();
      const b = await grab();
      const sB = await kit.snap();
      await kit.shot('reload-mid-training');
      out.push(`Before reload (${mmss(kit.t)}): training ${a.name} ${a.pct}%, ${a.remaining} remaining; tasks ${fmtN(a.m.tasks)}, funds ${money(a.m.funds)}; console "${a.con}"; panels ${panelsA}.`, `After reload: training ${b.name ?? '—'} ${b.pct ?? '—'}%, ${b.remaining ?? '—'} remaining; tasks ${fmtN(b.m.tasks)}, funds ${money(b.m.funds)}; console "${b.con}"; panels ${sB.panels.map((p) => p.l).join(', ')}.`, '', `Recovery: ${b.pct === a.pct && b.remaining === a.remaining && b.m.tasks === a.m.tasks ? 'the run resumes exactly where it was (nothing lost)' : 'state differs after reload (see numbers above)'}.`);
    },
  },
];

// ---------------------------------------------------------------------------------- Paperclips
const PAPERCLIPS = [
  {
    name: 'wire-out-low-price',
    title: 'Wire runs out at a $0.01 price (classic wire-out)',
    async run(kit, out) {
      const s0 = await kit.snap();
      need(kit.find(s0, 'btnLowerPrice') && kit.find(s0, 'btnMakePaperclip'), 'price or main button missing');
      const n = await kit.click('btnLowerPrice', 30, 'lower');
      kit.mashKey = 'btnMakePaperclip';
      let out0 = null;
      await kit.run(900, async (t, s) => {
        if ((s.m.stock ?? 1) < 1) {
          out0 = s;
          return 'stop';
        }
        return undefined;
      });
      need(out0, 'wire never ran out within 15 minutes of hand-clicking');
      out.push(`Lowered the price ${n}× to ${money(out0.m.price)}, hand-clicked only. Wire hit 0 at ${mmss(out0.t)}: ${fmtN(out0.m.clips)} clips, ${money(out0.m.funds)} funds, wire costs ${money(out0.m.stockPrice)}, unsold ${fmtN(out0.m.backlog)}.`, '', 'On screen:', ...kit.screen(out0).map((l) => `- ${l}`));
      const t0 = kit.t;
      let beg = null;
      await kit.run(180, async (t, s) => {
        const b = s.buttons.find((x) => /Beg for More Wire/.test(x.l));
        if (b && b.e && !beg) {
          beg = s;
          return 'stop';
        }
        return undefined;
      });
      out.push('', 'Then (still clicking):', ...kit.linesBetween(t0, kit.t).map((l) => `- ${l}`), ...kit.revealsBetween(t0, kit.t).map((l) => `- reveal ${l}`));
      if (beg) {
        await kit.shot('wire-out-low-price');
        await kit.click(beg.buttons.find((x) => /Beg for More Wire/.test(x.l)).k, 1, 'beg');
        const s2 = await kit.snap();
        out.push('', `Recovery: "Beg for More Wire" clickable at ${mmss(beg.t)} (${beg.t - out0.t} s after wire ran out); clicking it → wire ${fmtN(s2.m.stock)}, trust ${fmtN(s2.m.trust)}.`);
      } else out.push('', 'Recovery: no "Beg for More Wire" within 3 minutes.');
    },
  },
  {
    name: 'absurd-price',
    title: 'Absurd price ($2.25) with 5 AutoClippers',
    async run(kit, out) {
      kit.mashKey = 'btnMakePaperclip';
      const pol = kit.policy();
      let five = null;
      await kit.run(600, async (t, s) => {
        await pol.pass(t);
        if ((s.m.clipmakerLevel || 0) >= 5) {
          five = s;
          return 'stop';
        }
        return undefined;
      });
      need(five, 'policy did not reach 5 AutoClippers within 10 minutes');
      let clicks = 0;
      for (let i = 0; i < 400 && ((await kit.session.metrics()).price ?? 0) < 2.25 - 1e-9; i++) clicks += await kit.click('btnRaisePrice', 1, 'raise');
      const s1 = await kit.snap();
      out.push(`At ${mmss(kit.t)} with ${s1.m.clipmakerLevel} AutoClippers: raised the price ${clicks}× to ${money(s1.m.price)}; demand ${await text(kit, '#demand')}%.`);
      const t0 = kit.t;
      const funds0 = s1.m.funds;
      const noPrice = kit.policy({ lower: null, raise: null });
      kit.mashKey = null;
      let sold = 0;
      let prevUnsold = s1.m.backlog;
      const s2 = await kit.run(180, async (t, s) => {
        if (s.m.backlog < prevUnsold) sold += prevUnsold - s.m.backlog;
        prevUnsold = s.m.backlog;
        await noPrice.pass(t);
      });
      await kit.shot('absurd-price');
      out.push(`After 180 s (policy plays, never touches the price): sold ≈ ${fmtN(sold)} clips, funds ${money(funds0)} → ${money(s2.m.funds)}, unsold ${fmtN(s2.m.backlog)}, wire ${fmtN(s2.m.stock)}.`, '', 'Lines in those 180 s:', ...(kit.linesBetween(t0, kit.t).map((l) => `- ${l}`)), '', 'On screen:', ...kit.screen(s2).map((l) => `- ${l}`));
      const beg = s2.buttons.find((x) => /Beg for More Wire/.test(x.l));
      out.push('', `"Beg for More Wire": ${beg ? (beg.e ? 'visible, enabled' : 'visible, grey') : 'not visible'}. Recovery: lower the price (the screen shows demand ${await text(kit, '#demand')}%).`);
    },
  },
  {
    name: 'reload',
    title: 'Reload after 60 s of play',
    async run(kit, out) {
      kit.mashKey = 'btnMakePaperclip';
      const pol = kit.policy();
      const s0 = await kit.run(60, kit.with(pol));
      const a = s0.m;
      await kit.reload();
      const b = (await kit.snap()).m;
      await kit.shot('reload');
      const lost = a.clips - b.clips;
      out.push(`Before reload (60 s): clips ${fmtN(a.clips)}, funds ${money(a.funds)}, wire ${fmtN(a.stock)}, AutoClippers ${a.clipmakerLevel}.`, `After reload: clips ${fmtN(b.clips)}, funds ${money(b.funds)}, wire ${fmtN(b.stock)}, AutoClippers ${b.clipmakerLevel}.`, '', `Recovery: progress since the last autosave is lost (${fmtN(lost)} clips${b.clips === 0 ? '; no save had been written yet' : ''}). The game autosaves every 25 s and does not save on unload.`);
    },
  },
  {
    name: 'idle',
    title: 'Idle 3 minutes from a new game',
    async run(kit, out) {
      const end = await kit.run(180);
      await kit.shot('idle');
      const ev = kit.linesBetween(0, kit.t);
      out.push('Nothing clicked for 180 s. Everything that appeared:', ...(ev.length ? ev.map((l) => `- ${l}`) : ['- (nothing)']), ...kit.revealsBetween(0, kit.t).map((l) => `- reveal ${l}`), '', 'At 3:00:', ...kit.screen(end).map((l) => `- ${l}`));
    },
  },
];

const SCENARIOS = { takeoff: TAKEOFF, paperclips: PAPERCLIPS };

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const game = pos[0];
  if (!SCENARIOS[game]) {
    console.error('usage: softlock.ts <takeoff|paperclips> [--game-dir DIR] [--seed N] [--stage N] [--scenario NAME] [--out LABEL]');
    process.exit(2);
  }
  const adapter = await loadAdapter(game);
  const gameDir = resolveGameDir(adapter, flags.gameDir);
  const stage = Number(flags.stage ?? 1);
  const prefix = resolvePrefix(flags.out ?? `softlock-${game}${stage > 1 ? `-s${stage}` : ''}`);
  const list = SCENARIOS[game].filter((s) => !flags.scenario || s.name === flags.scenario);
  const from = stage > 1 ? `the start of Stage ${stage}${game === 'takeoff' ? ` (__game.loadPreset(${stage}))` : ` (fixture ${game}-stage${stage})`}` : 'a new game';
  const md = [`# Soft-lock probes: ${adapter.title}${stage > 1 ? `, Stage ${stage}` : ''}`, '', `Game dir \`${path.relative(process.cwd(), gameDir)}\`, seed ${flags.seed ?? 1}, stepped mode (2-s steps), each scenario from ${from}. Times are game time${stage > 1 ? ' from that start' : ''}.`, ''];
  for (const sc of list) {
    process.stdout.write(`${sc.name} … `);
    const out = [];
    let kit;
    if (sc.stages && !sc.stages[stage]) {
      out.push(`scenario no longer applicable: ${sc.stages.other}`);
      console.log('not applicable at this stage');
      md.push(`## ${sc.name} — ${sc.title}`, '', ...out, '');
      continue;
    }
    try {
      kit = await openProbe(adapter, { gameDir, seed: Number(flags.seed ?? 1), stage, prefix });
      await sc.run(kit, out);
      console.log('ok');
    } catch (e) {
      if (e instanceof NotApplicable) {
        out.push(`scenario no longer applicable: ${e.message}`);
        console.log('not applicable');
      } else {
        out.push(`scenario failed: ${String(e.message).split('\n')[0]}`);
        console.log(`failed: ${e.message}`);
      }
    } finally {
      if (kit) await kit.close();
    }
    md.push(`## ${sc.name} — ${sc.title}`, '', ...out, '', `Screenshot: \`${path.basename(prefix)}-${sc.name}.png\``, '');
  }
  fs.writeFileSync(`${prefix}.md`, md.join('\n'));
  console.log(`written ${path.relative(process.cwd(), prefix)}.md`);
}
