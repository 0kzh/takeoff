#!/usr/bin/env node
// Usage: node tools/critic/decisions.mjs <label[:N]> [<label[:N]> …] [--stage N]
// Two measures the loose "nothing-to-do" cannot give (a drip purchase is always affordable):
//   decision gap        time between consecutive policy actions that are not the main button, a drip
//                       purchase (GPU / AutoClipper / MegaClipper), a consumable (power / wire) or a price move
//   reveal → purchase   for every project the policy bought: seconds between its first appearance and
//                       its purchase (how long it stood on screen as a goal)
// Works on any run written by run.mjs / explore.mjs. Windows run from the stage start to the stage change.
// Stage-aware: `--stage N` (or `label:N`) takes Stage N of a run that reaches it, timed from that stage's
// start; a run started with --stage N needs nothing. From Stage 2 on, repeat purchases also count as
// drip: Paperclips' drones, farms, batteries, probe launches and Processors/Memory bought with swarm
// gifts; Takeoff's GPU lots, power plants and datacenters (policy tag 'infra') and Stage 3's repeatable
// sinks (Experiments, Lobby, Counter-intelligence, Re-image the fleet).
// (Ported from the round-2 critic's tools/critic-r2/decisions.mjs; Stage 1 numbers are unchanged.)
import { loadRun, sliceStage } from './lib/analysis.mjs';
import { resolvePrefix, mmss, median, parseArgs } from './lib/util.mjs';

const DRIP = /Rent GPU|AutoClippers|MegaClippers|Buy Power|^Wire$|^lower$|^raise$/;
const SKIP_WHY = new Set(['mash', 'mash-stop', 'consumable', 'price-lower', 'price-raise', 'first-automation', 'automation']);
const LATE_SKIP_WHY = new Set(['build', 'power', 'storage', 'infra']);
const LATE_DRIP = /^Launch Probe$|^Processors$|^Memory$|^Experiments$|^Lobby$|^Counter-intelligence$|^Re-image/;

const { pos, flags } = parseArgs(process.argv.slice(2));
if (!pos.length) {
  console.error('usage: decisions.mjs <label[:N]> [more…] [--stage N]');
  process.exit(2);
}
for (const arg of pos) {
  const [label, st] = /^(.*?)(?::(\d+))?$/.exec(arg).slice(1);
  const stage = st != null ? Number(st) : flags.stage != null ? Number(flags.stage) : null;
  const run = sliceStage(loadRun(resolvePrefix(label)), stage);
  const late = (run.meta.stageStart || 1) >= 2;
  const end = run.meta.stageEnd ?? run.meta.endT;
  const isDecision = (a) => !SKIP_WHY.has(a.why) && !DRIP.test(a.label || '') && !(late && (LATE_SKIP_WHY.has(a.why) || LATE_DRIP.test(a.label || '')));
  const acts = run.actions.filter((a) => a.t <= end && isDecision(a));
  const times = [...new Set(acts.map((a) => a.t))].sort((a, b) => a - b);
  const pts = [0, ...times, end];
  const gaps = [];
  for (let i = 1; i < pts.length; i++) gaps.push({ from: pts[i - 1], to: pts[i], len: pts[i] - pts[i - 1] });
  const byLen = [...gaps].sort((a, b) => b.len - a.len);
  const name = stage != null && run.meta.sliceFrom != null ? `${label} (Stage ${stage})` : label;
  console.log(`\n== ${name}: window 0:00 → ${mmss(end)}; ${acts.length} non-drip decisions at ${times.length} distinct times; median gap ${median(gaps.map((g) => g.len))} s; gaps > 60 s: ${gaps.filter((g) => g.len > 60).length}; > 120 s: ${gaps.filter((g) => g.len > 120).length}`);
  console.log(`   longest: ${byLen.slice(0, 6).map((g) => `${mmss(g.from)}→${mmss(g.to)} (${g.len} s)`).join(', ')}`);
  const buckets = new Map();
  for (const a of acts) buckets.set(Math.floor(a.t / 300) * 5, (buckets.get(Math.floor(a.t / 300) * 5) || 0) + 1);
  console.log(`   decisions per 5 min: ${[...buckets].map(([k, v]) => `${k}–${k + 5}: ${v}`).join('  ')}`);

  const reveal = new Map();
  for (const e of run.events) if (e.type === 'reveal' && e.what === 'project' && !reveal.has(e.key)) reveal.set(e.key, e);
  const seen = new Set();
  const lat = [];
  for (const a of run.actions) {
    if ((a.why === 'project' || a.why === 'goal') && reveal.has(a.key) && !seen.has(a.key) && a.t <= end) {
      seen.add(a.key);
      lat.push(a.t - reveal.get(a.key).t);
    }
  }
  lat.sort((a, b) => a - b);
  const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null);
  console.log(`   projects bought ${lat.length}: reveal → purchase median ${q(0.5)} s (p25 ${q(0.25)} s, p75 ${q(0.75)} s, max ${lat[lat.length - 1]} s); bought within 10 s of appearing: ${lat.filter((d) => d <= 10).length}; affordable at first sight: ${[...reveal.values()].filter((r) => r.enabled).length} of ${reveal.size}`);
}
