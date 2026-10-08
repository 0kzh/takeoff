#!/usr/bin/env node
// Usage: node tools/critic/determinism.ts <game> [run.ts flags…] [--out LABEL]   (stepped only: --realtime is forced to 0)
// Runs the same accelerated run twice (LABEL-a, LABEL-b; default det-<game>[-autoplay][-sN]) and compares
// the event, action and snapshot streams. Pass --out to keep earlier determinism outputs.
// Example: node tools/critic/determinism.ts takeoff --game-dir agent-tools/snapshots/base --accel-minutes 40
import { runGame } from './lib/runner.ts';
import { parseArgs } from './lib/util.ts';

const { pos, flags } = parseArgs(process.argv.slice(2), ['autoplay']);
const game = pos[0];
if (!game) {
  console.error('usage: determinism.ts <takeoff|paperclips|adr> [--game-dir DIR] [--accel-minutes MIN] [--autoplay] [--stage N] [--seed N] [--out LABEL]');
  process.exit(2);
}
const base = flags.out ?? `det-${game}${flags.autoplay ? '-autoplay' : ''}${flags.stage ? `-s${flags.stage}` : ''}`;
const common = { game, gameDir: flags.gameDir, realtime: 0, accelMinutes: flags.accelMinutes ?? 20, autoplay: !!flags.autoplay, stage: flags.stage ?? 1, seed: flags.seed ?? 1, fixture: flags.fixture, quiet: true };
const a = await runGame({ ...common, prefix: `${base}-a` });
const b = await runGame({ ...common, prefix: `${base}-b` });

function firstDiff(x, y, path = '') {
  if (x === y) return null;
  if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object') return `${path}: ${JSON.stringify(x)?.slice(0, 120)} ≠ ${JSON.stringify(y)?.slice(0, 120)}`;
  if (Array.isArray(x) && x.length !== y.length) {
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const d = firstDiff(x[i], y[i], `${path}[${i}]`);
      if (d) return d;
    }
    return `${path}: length ${x.length} ≠ ${y.length}`;
  }
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const d = firstDiff(x[k], y[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

let ok = true;
for (const [name, x, y] of [
  ['events', a.rec.events, b.rec.events],
  ['actions', a.rec.actions, b.rec.actions],
  ['snapshots', a.rec.snaps, b.rec.snaps],
]) {
  const d = firstDiff(x, y);
  console.log(`${name}: ${x.length} vs ${y.length} — ${d ? `DIFFERENT at ${d}` : 'identical'}`);
  if (d) ok = false;
}
console.log(ok ? `DETERMINISTIC (${base}-a vs ${base}-b, ${common.accelMinutes} min)` : 'NOT DETERMINISTIC');
process.exit(ok ? 0 : 1);
