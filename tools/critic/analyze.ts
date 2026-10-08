#!/usr/bin/env node
// Usage: node tools/critic/analyze.ts <prefix|label> [--stage N]
//   → prints and writes <prefix>.analysis.md (+ .analysis.json); with --stage N (a later stage reached
//     inside the run) the window starts at that stage and times count from its start
//     (<prefix>.s<N>.analysis.md).
import fs from 'node:fs';
import { analyze, loadRun, sliceStage, LOAD_MINUTES, GAP_LIST_OVER } from './lib/analysis.ts';
import { resolvePrefix, mmss, fmtN, mdTable, writeJson, parseArgs } from './lib/util.ts';

export function renderAnalysis(a) {
  const m = a.meta;
  const L = [];
  const pct = (x) => (x == null ? '—' : `${x.toFixed(1)}%`);
  const gapLine = (g) => `${mmss(g.start)} → ${g.endLabel ? `${mmss(g.end)} (${g.endLabel})` : mmss(g.end)}: **${g.len} s**`;
  L.push(`# Analysis: ${m.prefix}`, '');
  L.push(`${m.title} · Stage ${m.stageStart}${m.fixture ? ` (fixture ${m.fixture})` : ''} · ${m.autoplay ? "game's own Autoplay" : 'scripted curious first-time player'} · seed ${m.seed} · ${m.realtime} s real time, then stepped to ${mmss(m.endT)} (cap ${m.accelMinutes} min).`);
  L.push(`Stage end: **${a.stageEnd != null ? `${mmss(a.stageEnd)}${m.stageEndBy ? ` (${m.stageEndBy})` : ''}` : `not reached (run ended ${mmss(m.endT)})`}**. Stage window used below: 0:00 → ${mmss(a.endT)}.`, '');

  L.push('## Headline', '');
  const ntd5 = a.nothingToDo.first5;
  const ntdS = a.nothingToDo.stage;
  const lr = a.gaps.reveal.stage.longest;
  const ln = a.gaps.novelty.stage.longest;
  L.push(mdTable(['metric', 'value'], [
    ['time to first automation', a.firstAutomation ? `${mmss(a.firstAutomation.t)} (${a.firstAutomation.how})` : 'never'],
    ['first meaningful choice (earliest candidate)', a.choice.earliest != null ? mmss(a.choice.earliest) : '—'],
    ['nothing-to-do, first 5 min', `${ntd5.seconds} s (${pct(ntd5.pct)}), longest ${ntd5.longest.len} s${ntd5.longest.start != null ? ` at ${mmss(ntd5.longest.start)}` : ''}`],
    ['nothing-to-do, whole stage', `${ntdS.seconds} s (${pct(ntdS.pct)}), longest ${ntdS.longest.len} s${ntdS.longest.start != null ? ` at ${mmss(ntdS.longest.start)}` : ''}`],
    ['longest reveal gap (stage)', lr ? gapLine(lr) : '—'],
    [`reveal gaps > ${GAP_LIST_OVER} s (stage)`, String(a.gaps.reveal.stage.over.length)],
    ['longest novelty gap (stage)', ln ? gapLine(ln) : '—'],
    ['greyed-out goal on screen', `first 5 min ${pct(a.grey.first5.pct)} · stage ${pct(a.grey.stage.pct)}`],
    ['reveals / console lines (distinct) / modals', `${a.totals.reveals} / ${a.totals.consoleLines} (${a.totals.distinctConsole}) / ${a.totals.modals}`],
    ['hands: nothing enabled / two or more distinct things (checks)', `${pct(a.hands.stage.nonePct)} / ${pct(a.hands.stage.twoPct)}`],
    ['hands: clicks per minute · inside ≥ 30-s click gaps after 10:00', `${a.hands.stage.perMin.toFixed(1)} · ${a.hands.after10 ? pct(a.hands.after10.gap30Pct) : '—'}`],
  ]), '');

  L.push('## First meaningful choice candidates', '');
  const c = a.choice;
  L.push(`- ≥ 2 distinct affordable non-ambient actions: ${c.twoAffordable ? `${mmss(c.twoAffordable.t)} — ${c.twoAffordable.actions.join('; ')}` : 'never'}`);
  L.push(`- first price move by the policy: ${c.firstPriceMove ? `${mmss(c.firstPriceMove.t)} — ${c.firstPriceMove.why}: ${c.firstPriceMove.detail}` : 'none'}`);
  L.push(`- first modal: ${c.firstModal ? `${mmss(c.firstModal.t)} — "${c.firstModal.title}" (${c.firstModal.options.join(' / ')})` : 'none'}`, '');

  L.push('## Nothing-to-do (loose)', '');
  L.push(mdTable(['window', 'seconds', '% of snapshots', 'longest stretch', 'snapshots'], [
    ['first 5 min', ntd5.seconds, pct(ntd5.pct), ntd5.longest.len ? `${ntd5.longest.len} s (${mmss(ntd5.longest.start)}–${mmss(ntd5.longest.end)})` : '0 s', ntd5.snapshots],
    ['whole stage', ntdS.seconds, pct(ntdS.pct), ntdS.longest.len ? `${ntdS.longest.len} s (${mmss(ntdS.longest.start)}–${mmss(ntdS.longest.end)})` : '0 s', ntdS.snapshots],
  ]), '');
  if (!a.firstAutomation || a.firstAutomation.t > a.endT) L.push('_No automation owned in the window: condition (1) never holds._', '');

  for (const [name, key] of [['Reveal gaps', 'reveal'], ['Novelty gaps', 'novelty']]) {
    L.push(`## ${name}`, '');
    for (const [wname, w] of [['first 5 min', a.gaps[key].first5], ['whole stage', a.gaps[key].stage]]) {
      L.push(`**${wname}** — longest: ${w.longest ? gapLine(w.longest) : '—'}; gaps > ${GAP_LIST_OVER} s: ${w.over.length ? '' : 'none'}`);
      for (const g of w.over) L.push(`- ${gapLine(g)}`);
      L.push('');
    }
  }

  L.push('## Reveal timeline (stage)', '');
  L.push(mdTable(['t', 'what appeared'], a.timeline.map((r) => [mmss(r.t), r.items.join('; ')])), '');

  L.push('## Greyed-out goal on screen', '');
  L.push(`First 5 min: ${pct(a.grey.first5.pct)} of ${a.grey.first5.snapshots} snapshots (first at ${mmss(a.grey.first5.firstHit)}). Whole stage: ${pct(a.grey.stage.pct)} of ${a.grey.stage.snapshots}.`, '');

  L.push('## Cognitive load', '');
  L.push('Minute 0 is sampled at t = 0:02, the first snapshot after the first input.', '');
  L.push(mdTable(['minute', 't', 'numbers on screen', 'interactive (buttons + sliders)', 'panels', 'sum', 'words'], a.load.map((r) => [r.label, r.t != null ? mmss(r.t) : '—', r.numbers ?? '—', r.interactive ?? '—', r.panels ?? '—', r.total ?? '—', r.words ?? '—'])), '');
  L.push(`Numbers on screen at ${LOAD_MINUTES.join('/')}/end: ${a.load.map((r) => r.numbers ?? '—').join(' / ')}; interactive: ${a.load.map((r) => r.interactive ?? '—').join(' / ')}; panels: ${a.load.map((r) => r.panels ?? '—').join(' / ')}; words: ${a.load.map((r) => r.words ?? '—').join(' / ')}.`, '');
  L.push('**Largest single-beat disclosure spikes** (consecutive snapshots):', '');
  L.push(mdTable(['t', 'Δnumbers', 'Δinteractive', 'Δpanels', 'what appeared'], a.spikes.map((s) => [mmss(s.t), s.dNumbers, s.dInteractive, s.dPanels, s.appeared.join('; ') || '(values only)'])), '');

  L.push('## Actions', '');
  const ac = a.actions;
  L.push(`Mash clicks ${ac.mashClicks}${ac.mashStop != null ? ` (stopped at ${mmss(ac.mashStop)})` : ''} · consumable presses ${ac.consumable} · automation bought ${ac.automation} · price moves ${ac.priceLower + ac.priceRaise} (${ac.priceLower} lower, ${ac.priceRaise} raise) · projects ${ac.projects} · modal answers ${ac.modals}.`, '');
  if (ac.byAction.length) L.push(mdTable(['action', 'count'], ac.byAction.map(([k, v]) => [k, v])), '');
  if (Object.keys(a.counters).length) {
    L.push('Game counters (start → stage end), useful for Autoplay runs:', '');
    L.push(mdTable(['counter', 'start', 'end'], Object.entries<{ start: number; end: number }>(a.counters).map(([k, v]) => [k, fmtN(v.start), fmtN(v.end)])), '');
  }

  L.push('## Hands', '');
  L.push('The Stage 2 critics\' measures (lib/analysis.ts handsOf): checks are the 2-s snapshots, read before the player acts; a thing is an enabled non-ambient button or card (lot sizes and bulk buttons count once); clicks exclude the main button\'s mash.', '');
  const hRow = (name, h) => [name, h ? `${mmss(h.from)}–${mmss(h.end)}` : '—', h ? h.checks : '—', h ? pct(h.nonePct) : '—', h ? pct(h.twoPct) : '—', h ? h.medianThings : '—', h ? h.clicks : '—', h ? h.perMin.toFixed(1) : '—', h ? pct(h.gap30Pct) : '—', h ? `${h.gaps30} (longest ${h.longestGap} s)` : '—'];
  L.push(mdTable(['window', 'span', 'checks', 'nothing enabled', 'two or more things', 'median things', 'clicks', 'clicks/min', 'inside ≥ 30-s gaps', '≥ 30-s gaps'], [hRow('whole stage', a.hands.stage), hRow('first 10 min', a.hands.first10), hRow('after 10:00', a.hands.after10)]), '');
  L.push(`Share of checks each thing is enabled: ${Object.entries<number>(a.hands.stage.enabledShare).slice(0, 12).map(([k, v]) => `${k} ${v.toFixed(0)}%`).join(' · ')}.`, '');

  L.push('## Cadence', '');
  const cad = (x) => `${x.n} (${x.times.map(mmss).join(', ') || '—'}); median gap ${x.medianGap != null ? `${Math.round(x.medianGap)} s` : '—'}, max gap ${x.maxGap != null ? `${x.maxGap} s` : '—'}, last one ${x.sinceLast != null ? `${x.sinceLast} s before ${a.endLabel}` : '—'}`;
  L.push(`- new panels after t = 0: ${cad(a.cadence.panels)}`);
  L.push(`- new projects after t = 0: ${cad(a.cadence.projects)}`, '');
  return L.join('\n');
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const arg = pos[0];
  if (!arg) {
    console.error('usage: analyze.ts <prefix|label> [--stage N]');
    process.exit(2);
  }
  const prefix = resolvePrefix(arg.replace(/\.(snaps|events|actions)\.json$/, ''));
  const run = loadRun(prefix);
  const stage = flags.stage != null ? Number(flags.stage) : null;
  const a = analyze(sliceStage(run, stage));
  const md = renderAnalysis(a);
  const out = stage != null && stage !== run.meta.stageStart ? `${prefix}.s${stage}` : prefix;
  fs.writeFileSync(`${out}.analysis.md`, md);
  writeJson(`${out}.analysis.json`, a);
  console.log(md);
}
