#!/usr/bin/env node
// Usage: node tools/critic/run.ts <takeoff|paperclips|adr> <outPrefix|label>
//          [--game-dir DIR] [--realtime SEC] [--accel-minutes MIN] [--autoplay] [--stage N]
//          [--seed N] [--fixture NAME] [--post-stage SEC] [--quiet]
// --accel-minutes is the total game-time cap (phase 1 included), as in the old harness.
import { runGame } from './lib/runner.ts';
import { parseArgs } from './lib/util.ts';

const { pos, flags } = parseArgs(process.argv.slice(2), ['autoplay', 'quiet']);
const [game, prefix] = pos;
if (!game || !prefix) {
  console.error('usage: run.ts <takeoff|paperclips|adr> <outPrefix> [--game-dir DIR] [--realtime SEC] [--accel-minutes MIN] [--autoplay] [--stage N] [--seed N]');
  process.exit(2);
}
try {
  await runGame({
    game,
    prefix,
    gameDir: flags.gameDir,
    realtime: flags.realtime ?? 0,
    accelMinutes: flags.accelMinutes ?? 0,
    autoplay: !!flags.autoplay,
    stage: flags.stage ?? 1,
    seed: flags.seed ?? 1,
    fixture: flags.fixture,
    postStage: flags.postStage,
    quiet: !!flags.quiet,
  });
} catch (e) {
  console.error(e.stack || e.message);
  process.exit(1);
}
