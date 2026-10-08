#!/usr/bin/env node
// Builds the Paperclips stage-start fixtures (localStorage saves):
//   paperclips-stage2  just after "Release the HypnoDrones" — cheated (Stage 1 to 100 Trust takes
//                      hours): round resource values, gating projects bought through their buttons
//   paperclips-stage3  just after "Space Exploration" — PLAYED: the scripted first-timer plays Stage 2
//                      from paperclips-stage2 (stepped, seed 1) and the save is taken the moment it
//                      buys Space Exploration; falls back to the cheat if that takes > 180 min
//   paperclips-s1-end  HypnoDrones bought, Trust 99, ~15 s before the Release is affordable — cheated
//                      (used by transition.ts paperclips)
// Usage: node tools/critic/make-fixtures.ts [name …]   (default: all three, in dependency order)
import fs from 'node:fs';
import path from 'node:path';
import { openSession } from './lib/session.ts';
import { runGame } from './lib/runner.ts';
import { loadAdapter, FIXTURE_DIR, writeJson, mmss } from './lib/util.ts';

const adapter = await loadAdapter('paperclips');
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : ['paperclips-stage2', 'paperclips-stage3', 'paperclips-s1-end'];
fs.mkdirSync(FIXTURE_DIR, { recursive: true });
const STAGE = { 'paperclips-stage2': 2, 'paperclips-stage3': 3, 'paperclips-s1-end': 1 };
const PICK = ['stage', 'clips', 'unusedClips', 'funds', 'trust', 'processors', 'memory', 'ops', 'creativity', 'yomi', 'harvesterLevel', 'wireDroneLevel', 'factoryLevel', 'farmLevel', 'batteryLevel', 'storedPower', 'availableMatter', 'probeCount', 'probeTrust', 'swarmGifts', 'nextTrust'];

const grab = (session) =>
  session.page.evaluate(() => {
    window.save(); // the game's own save()
    return Object.fromEntries(Object.keys(window.localStorage).map((k) => [k, window.localStorage.getItem(k)]));
  });

function write(name, how, notes, log, m, localStorage) {
  if (m.stage !== STAGE[name]) throw new Error(`${name}: landed in stage ${m.stage}, expected ${STAGE[name]}`);
  writeJson(path.join(FIXTURE_DIR, `${name}.json`), {
    name,
    game: 'paperclips',
    stage: STAGE[name],
    createdWith: `node tools/critic/make-fixtures.ts ${name} (${how})`,
    notes,
    metrics: Object.fromEntries(PICK.map((k) => [k, m[k]])),
    cheatLog: log,
    localStorage,
  });
  console.log(`${name}: stage ${m.stage} (${how}), keys ${Object.keys(localStorage).join(', ')}`);
}

async function cheat(name) {
  const from = name === 'paperclips-stage3' ? JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'paperclips-stage2.json'), 'utf8')) : null;
  const session = await openSession({ adapter, gameDir: adapter.defaultDir(), seed: 1, stage: from ? 2 : 1, fixture: from ? { ...from, name: 'paperclips-stage2' } : null });
  try {
    let log;
    if (name === 'paperclips-stage2') log = await adapter.cheats.stage2(session);
    else if (name === 'paperclips-stage3') log = await adapter.cheats.stage3(session);
    else if (name === 'paperclips-s1-end') log = await adapter.cheats.s1End(session);
    else throw new Error(`unknown fixture ${name}`);
    const ls = await grab(session);
    write(name, 'cheats', 'Resource levels are cheated to round values; gating projects were bought through their own buttons.', log, await session.metrics(), ls);
  } finally {
    await session.close();
  }
}

/** Stage 3 start as the scripted player reaches it: play Stage 2 and save at Space Exploration. */
async function played3() {
  let saved = null;
  const { meta } = await runGame({
    game: 'paperclips',
    prefix: 'fixture-build-stage3',
    realtime: 0,
    accelMinutes: 180,
    stage: 2,
    seed: 1,
    postStage: 0,
    quiet: true,
    onStageEnd: async ({ t, session }) => {
      saved = { t, localStorage: await grab(session), m: await session.metrics() };
    },
  });
  if (!saved) return false;
  write('paperclips-stage3', `played: Stage 2 policy from paperclips-stage2, Space Exploration at ${mmss(saved.t)}`, `The scripted first-timer played Stage 2 (run ${meta.prefix}); saved the moment it bought Space Exploration.`, [`Space Exploration bought at ${mmss(saved.t)} of Stage 2`], saved.m, saved.localStorage);
  return true;
}

for (const n of names) {
  if (n === 'paperclips-stage3' && (await played3())) continue;
  await cheat(n);
}
