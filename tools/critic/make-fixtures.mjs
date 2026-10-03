#!/usr/bin/env node
// Builds the Paperclips stage-start fixtures (localStorage saves) with the adapter's cheats:
//   paperclips-stage2  just after "Release the HypnoDrones"      (--stage 2)
//   paperclips-stage3  just after "Space Exploration"            (--stage 3)
//   paperclips-s1-end  HypnoDrones bought, Trust 99, ~15 s before the Release becomes affordable
//                      (used by transition.mjs paperclips)
// Usage: node tools/critic/make-fixtures.mjs [name …]   (default: all three)
import fs from 'node:fs';
import path from 'node:path';
import { openSession } from './lib/session.mjs';
import { loadAdapter, FIXTURE_DIR, writeJson } from './lib/util.mjs';

const adapter = await loadAdapter('paperclips');
const wanted = process.argv.slice(2);
const all = ['paperclips-stage2', 'paperclips-stage3', 'paperclips-s1-end'];
const names = wanted.length ? wanted : all;
fs.mkdirSync(FIXTURE_DIR, { recursive: true });

async function build(name) {
  const from = name === 'paperclips-stage3' ? JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'paperclips-stage2.json'), 'utf8')) : null;
  const session = await openSession({ adapter, gameDir: adapter.defaultDir(), seed: 1, stage: from ? 2 : 1, fixture: from ? { ...from, name: 'paperclips-stage2' } : null });
  try {
    let log;
    if (name === 'paperclips-stage2') log = await adapter.cheats.stage2(session);
    else if (name === 'paperclips-stage3') log = await adapter.cheats.stage3(session);
    else if (name === 'paperclips-s1-end') log = await adapter.cheats.s1End(session);
    else throw new Error(`unknown fixture ${name}`);
    await session.page.evaluate(() => window.save()); // the game's own save()
    const localStorage = await session.page.evaluate(() => Object.fromEntries(Object.keys(window.localStorage).map((k) => [k, window.localStorage.getItem(k)])));
    const m = await session.metrics();
    const stage = { 'paperclips-stage2': 2, 'paperclips-stage3': 3, 'paperclips-s1-end': 1 }[name];
    if (m.stage !== stage) throw new Error(`${name}: landed in stage ${m.stage}, expected ${stage}`);
    const pick = ['stage', 'clips', 'unusedClips', 'funds', 'trust', 'processors', 'memory', 'ops', 'creativity', 'yomi', 'harvesterLevel', 'wireDroneLevel', 'factoryLevel', 'farmLevel', 'batteryLevel', 'storedPower', 'availableMatter', 'probeCount', 'nextTrust'];
    const fixture = {
      name,
      game: 'paperclips',
      stage,
      createdWith: 'node tools/critic/make-fixtures.mjs (cheats in tools/critic/games/paperclips.mjs)',
      notes: 'Resource levels are cheated to round values; gating projects were bought through their own buttons.',
      metrics: Object.fromEntries(pick.map((k) => [k, m[k]])),
      cheatLog: log,
      localStorage,
    };
    writeJson(path.join(FIXTURE_DIR, `${name}.json`), fixture);
    console.log(`${name}: stage ${m.stage}, ${log.length} cheat steps, keys ${Object.keys(localStorage).join(', ')}`);
  } finally {
    await session.close();
  }
}

for (const n of names) await build(n);
