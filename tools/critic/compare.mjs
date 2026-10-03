#!/usr/bin/env node
// Usage: node tools/critic/compare.mjs <prefixA> <prefixB> [<prefixC> …]
// One side-by-side markdown table of the headline numbers (writes <lastPrefix-dir>/compare-<A>-vs-<B>.md).
import fs from 'node:fs';
import path from 'node:path';
import { analyze, loadRun, LOAD_MINUTES } from './lib/analysis.mjs';
import { resolvePrefix, mmss, mdTable } from './lib/util.mjs';

export function headline(a) {
  const pct = (x) => (x == null ? '—' : `${x.toFixed(1)}%`);
  const gap = (g) => (g ? `${g.len} s (${mmss(g.start)}→${mmss(g.end)}${g.endLabel ? ', open' : ''})` : '—');
  const ntd = (n) => `${n.seconds} s / ${pct(n.pct)} / ${n.longest.len} s`;
  const load = (k) => a.load.map((r) => r[k] ?? '—').join(' / ');
  return [
    ['player', a.meta.autoplay ? 'game Autoplay' : 'scripted policy'],
    ['start → stage end', `Stage ${a.meta.stageStart} → ${a.stageEnd != null ? mmss(a.stageEnd) : `not reached (${mmss(a.meta.endT)})`}`],
    ['first automation', a.firstAutomation ? mmss(a.firstAutomation.t) : 'never'],
    ['first choice: ≥ 2 affordable actions', a.choice.twoAffordable ? mmss(a.choice.twoAffordable.t) : '—'],
    ['first choice: first price move', a.choice.firstPriceMove ? `${mmss(a.choice.firstPriceMove.t)} (${a.choice.firstPriceMove.why})` : '—'],
    ['first choice: first modal', a.choice.firstModal ? `${mmss(a.choice.firstModal.t)} ${a.choice.firstModal.title}` : '—'],
    ['nothing-to-do first 5 min (s / % / longest)', ntd(a.nothingToDo.first5)],
    ['nothing-to-do stage (s / % / longest)', ntd(a.nothingToDo.stage)],
    ['longest reveal gap, stage', gap(a.gaps.reveal.stage.longest)],
    ['reveal gaps > 120 s, stage', String(a.gaps.reveal.stage.over.length)],
    ['longest novelty gap, stage', gap(a.gaps.novelty.stage.longest)],
    ['greyed-out goal % (5 min / stage)', `${pct(a.grey.first5.pct)} / ${pct(a.grey.stage.pct)}`],
    [`numbers on screen (${LOAD_MINUTES.join('/')}/end)`, load('numbers')],
    ['interactive elements', load('interactive')],
    ['panels', load('panels')],
    ['reveals / distinct console lines / modals', `${a.totals.reveals} / ${a.totals.distinctConsole} / ${a.totals.modals}`],
    ['new panels: n, median gap', `${a.cadence.panels.n}, ${a.cadence.panels.medianGap != null ? Math.round(a.cadence.panels.medianGap) + ' s' : '—'}`],
    ['new projects: n, median gap', `${a.cadence.projects.n}, ${a.cadence.projects.medianGap != null ? Math.round(a.cadence.projects.medianGap) + ' s' : '—'}`],
    ['consumable presses / automation bought / price moves', `${a.actions.consumable} / ${a.actions.automation} / ${a.actions.priceLower + a.actions.priceRaise}`],
  ];
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('usage: compare.mjs <prefixA> <prefixB> [more…]');
    process.exit(2);
  }
  const prefixes = args.map((p) => resolvePrefix(p));
  const cols = prefixes.map((p) => headline(analyze(loadRun(p))));
  const rows = cols[0].map((row, i) => [row[0], ...cols.map((c) => c[i][1])]);
  const md = [`# Compare: ${prefixes.map((p) => path.basename(p)).join(' vs ')}`, '', mdTable(['metric', ...prefixes.map((p) => path.basename(p))], rows), ''].join('\n');
  const out = path.join(path.dirname(prefixes[0]), `compare-${prefixes.map((p) => path.basename(p)).join('-vs-')}.md`);
  fs.writeFileSync(out, md);
  console.log(md);
  console.log(`(written to ${path.relative(process.cwd(), out)})`);
}
