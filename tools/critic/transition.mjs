#!/usr/bin/env node
// Usage: node tools/critic/transition.mjs <takeoff|paperclips|adr> [--game-dir DIR] [--stage N]
//          [--preset NAME] [--fixture NAME] [--seed N] [--accel-minutes MIN] [--autoplay] [--out LABEL]
// Plays (stepped, scripted policy) until the stage changes, keeps ~20 s before and 30 s after, and
// writes <out>.md: console lines, what vanished/appeared, projects gone un-bought, buttons affordable
// on arrival, rates before/after, screenshots (<out>.tpre/.tend/.transition.png).
// Defaults: takeoff → new game; paperclips → fixture paperclips-s1-end (HypnoDrones bought, Trust
// 99, ~15 s before "Release the HypnoDrones" is affordable).
import fs from 'node:fs';
import { runGame } from './lib/runner.mjs';
import { transitionReport } from './lib/transition-report.mjs';
import { parseArgs, mmss } from './lib/util.mjs';

const { pos, flags } = parseArgs(process.argv.slice(2), ['autoplay']);
const game = pos[0];
if (!game) {
  console.error('usage: transition.mjs <takeoff|paperclips|adr> [--game-dir DIR] [--stage N] [--fixture NAME] [--out LABEL]');
  process.exit(2);
}
const stage = Number(flags.stage ?? 1);
const fixture = flags.fixture ?? (game === 'paperclips' && stage === 1 ? 'paperclips-s1-end' : undefined);
const label = flags.out ?? `transition-${game}${flags.preset ? `-p${flags.preset}` : stage > 1 ? `-s${stage}` : ''}`;
const { prefix, meta, rec } = await runGame({
  game,
  prefix: label,
  gameDir: flags.gameDir,
  realtime: 0,
  // Takeoff's Stage 3 runs ~45–55 minutes of game time: a longer default cap from Stage 3 on.
  accelMinutes: flags.accelMinutes ?? (fixture ? 10 : stage >= 3 || flags.preset ? 90 : 60),
  autoplay: !!flags.autoplay,
  stage,
  seed: flags.seed ?? 1,
  fixture,
  preset: flags.preset,
  quiet: true,
});
const md = [
  transitionReport({ meta, snaps: rec.snaps, events: rec.events, actions: rec.actions }),
  '## Run',
  '',
  `\`node tools/critic/transition.mjs ${process.argv.slice(2).join(' ')}\` → stepped run \`${meta.prefix}\` (seed ${meta.seed}${meta.fixture ? `, fixture ${meta.fixture}` : ''}${meta.autoplay ? ', Autoplay' : ''}), stage change ${meta.stageEnd != null ? `at ${mmss(meta.stageEnd)}${meta.stageEndBy ? ` (${meta.stageEndBy})` : ''}` : 'not reached'}.`,
  fixture
    ? 'The fixture is a cheated save (tools/critic/make-fixtures.mjs, see tools/critic/README.md); only the last ~15 s before the change are played.'
    : `Played from ${flags.preset ? `the named start ${flags.preset}${meta.boot && meta.boot.preset ? ` (${meta.boot.preset})` : ''}` : stage > 1 ? `the start of Stage ${stage}${meta.boot && meta.boot.preset ? ` (${meta.boot.preset})` : ""}` : 'a new game'} by ${meta.autoplay ? "the game's own Autoplay" : 'the scripted policy'}.`,
  '',
].join('\n');
fs.writeFileSync(`${prefix}.md`, md);
console.log(md);
console.log(`(written to ${prefix}.md)`);
