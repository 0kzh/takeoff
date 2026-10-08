// Plays one game: phase 1 = real wall-clock seconds, phase 2 = deterministic 2-s game-time steps.
// Snapshot every 2 s (before the policy acts), policy pass after each snapshot, main-button mash
// every 250 ms while mashing.
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { openSession } from './session.mjs';
import { Recorder } from './recorder.mjs';
import { Policy, MASH_PER_SEC } from './policy.mjs';
import { transitionReport } from './transition-report.mjs';
import { loadAdapter, resolvePrefix, writeJson, mmss, sleep, fmtN, FIXTURE_DIR, REPO_ROOT } from './util.mjs';

export const SNAP_EVERY = 2;
export const SHOT_MINUTES = [0, 1, 3, 5, 10, 20];
export const POST_STAGE_SECONDS = 30;

export function resolveGameDir(adapter, gameDir) {
  if (gameDir) return path.resolve(gameDir);
  if (adapter.defaultDir) return adapter.defaultDir();
  throw new Error(`${adapter.name}: pass --game-dir <dir> (a copy of the Vite build, dist/)`);
}

export function loadFixture(adapter, { stage, fixture }) {
  let name = fixture;
  if (!name && stage > 1 && adapter.stageFixtures) name = adapter.stageFixtures[stage];
  if (!name) return null;
  const file = name.endsWith('.json') ? path.resolve(name) : path.join(FIXTURE_DIR, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`fixture not found: ${file} (run: node tools/critic/make-fixtures.mjs)`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { ...data, name: path.basename(file, '.json') };
}

/**
 * opts: { game, prefix, gameDir, realtime, accelMinutes, autoplay, stage, seed, fixture,
 *         postStage, quiet, onSnapshot(ctx), onStageEnd({ t, session }), adapter, viewport }
 * Returns { prefix, meta, rec }.
 */
export async function runGame(opts) {
  // opts.adapter: a ready adapter (e.g. explore.mjs's modified policies) instead of loading one by name.
  const adapter = opts.adapter ?? (await loadAdapter(opts.game));
  const prefix = resolvePrefix(opts.prefix);
  const gameDir = resolveGameDir(adapter, opts.gameDir);
  const seed = Number(opts.seed ?? 1);
  const realtime = Number(opts.realtime ?? 0);
  const capSeconds = Math.max(realtime, Number(opts.accelMinutes ?? 0) * 60);
  const postStage = Number(opts.postStage ?? POST_STAGE_SECONDS);
  const stageReq = Number(opts.stage ?? 1);
  const fixture = loadFixture(adapter, { stage: stageReq, fixture: opts.fixture });
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  if (opts.autoplay && !adapter.setAutoplay) throw new Error(`${adapter.name} has no autoplay`);
  if (path.resolve(gameDir) === REPO_ROOT) log('warning: measuring the repo root (it may be mid-rebuild)');

  const wallStart = performance.now();
  const session = await openSession({ adapter, gameDir, seed, stage: stageReq, fixture, viewport: opts.viewport });
  const startStage = session.bootInfo.stage ?? stageReq;
  const rec = new Recorder();
  const policy = opts.autoplay ? null : new Policy(adapter, session, rec, { startStage });
  if (opts.autoplay) await adapter.setAutoplay(session, true);
  const mainKey = adapter.policy.main;
  const gate = new Set([...(adapter.policy.goal || []), ...(adapter.stageGate || [])]);

  let stageEnd = null;
  let stageEndBy = null;
  let stopAt = capSeconds;
  let transitionShot = false;
  const shots = new Map(SHOT_MINUTES.map((m) => [m * 60, `t${m}`]));
  const shot = async (name) => session.screenshot(`${prefix}.${name}.png`).catch((e) => log(`screenshot ${name} failed: ${e.message}`));

  const markStageEnd = async (t, how, m) => {
    if (stageEnd != null) return;
    stageEnd = t;
    // What the stage ended in (adapter.endedHow: Takeoff "Stage 4" or "ending: The Pause").
    stageEndBy = (adapter.endedHow && m && adapter.endedHow(m, startStage)) || null;
    stopAt = Math.min(capSeconds, t + postStage);
    if (opts.onStageEnd) await opts.onStageEnd({ t, session });
    rec.event({ t, type: 'stage-end', how, ...(stageEndBy ? { by: stageEndBy } : {}) });
    await shot('tend');
    log(`  stage end at ${mmss(t)} (${how}${stageEndBy ? `; ${stageEndBy}` : ''})`);
    // Stepped mode: what the screen shows in the first 2 s after the change, every 250 ms
    // (inside the current 2-s step, so the snapshot grid is unchanged).
    if (!session.realtime) {
      const samples = [];
      for (let i = 0; i < 8; i++) {
        const s = await session.snapshot();
        samples.push({ dt: i * 0.25, console: s.console, consoleLines: s.consoleLines, panels: s.panels.map((p) => p.l), buttons: s.buttons.map((b) => b.l), numbers: s.numbers });
        if (i < 7) await session.advanceWithinStep(250);
      }
      rec.event({ t, type: 'transition-samples', samples });
    }
  };

  const onSnapshot = async (t, phase) => {
    const raw = await session.snapshot();
    const snap = rec.snapshot(t, phase, raw);
    if (shots.has(t)) await shot(shots.get(t));
    if (stageEnd == null && adapter.stageEnded(raw.m || {}, startStage)) await markStageEnd(t, 'detected at snapshot', raw.m || {});
    if (stageEnd != null && !transitionShot && t >= stageEnd + 4) {
      transitionShot = true;
      await shot('transition');
    }
    if (!opts.quiet && t % 60 === 0) {
      const m = raw.m || {};
      log(`  ${mmss(t)} p${phase} stage ${snap.stage} · ${raw.buttons.length} buttons · ${raw.panels.length} panels · ${raw.numbers} numbers` +
        (m.funds != null ? ` · funds ${fmtN(m.funds, 2)}` : '') + (m.automation != null ? ` · automation ${fmtN(m.automation)}` : ''));
    }
    if (opts.onSnapshot) await opts.onSnapshot({ t, phase, snap, raw, session, rec });
    return snap;
  };

  const policyPass = async (t) => {
    if (!policy) return;
    // Pre-transition screenshot: the policy is about to buy a stage gate.
    if (stageEnd == null && gate.size) {
      const c = await session.controls();
      if (c.buttons.some((b) => gate.has(b.k) && b.e)) await shot('tpre');
    }
    await policy.pass(t);
    if (stageEnd == null) {
      const m = await session.metrics();
      if (adapter.stageEnded(m, startStage)) await markStageEnd(t, 'policy purchase', m);
    }
  };

  // ---------------- phase 1: real time ----------------
  let t = 0;
  let mashClicks = 0;
  let phase1End = 0;
  let abort = null;
  try {
    if (realtime > 0) {
      log(`${adapter.name}: phase 1, ${realtime} s real time`);
      await session.startRealtime();
      const t0 = performance.now();
      let nextSnap = 0;
      let nextMash = 1 / MASH_PER_SEC;
      for (;;) {
        const el = (performance.now() - t0) / 1000;
        if (el >= realtime || nextSnap >= stopAt) break;
        if (el >= nextSnap) {
          t = nextSnap;
          // Mash clicks are logged per 2-s window, stamped with the window start (as in phase 2).
          if (mashClicks) rec.action({ t: t - SNAP_EVERY, key: mainKey, why: 'mash', count: mashClicks });
          mashClicks = 0;
          await onSnapshot(t, 1);
          await policyPass(t);
          nextSnap += SNAP_EVERY;
          continue;
        }
        if (el >= nextMash) {
          if (policy && policy.mashing && mainKey) {
            const r = await session.page.evaluate((k) => window.__critic.click(k), mainKey);
            if (r.ok) mashClicks++;
          }
          nextMash += 1 / MASH_PER_SEC;
          while (nextMash < el) nextMash += 1 / MASH_PER_SEC; // skip, never burst
          continue;
        }
        await sleep(Math.max(1, (Math.min(nextSnap, nextMash) - el) * 1000));
      }
      await session.stopRealtime();
      t = Math.min(nextSnap, Math.ceil(realtime / SNAP_EVERY) * SNAP_EVERY);
      if (mashClicks) rec.action({ t: t - SNAP_EVERY, key: mainKey, why: 'mash', count: mashClicks });
    }
    phase1End = realtime > 0 ? t : 0;

    // ---------------- phase 2: deterministic stepping ----------------
    if (t < stopAt) log(`${adapter.name}: phase 2, stepping from ${mmss(t)} to ${mmss(capSeconds)} game time (or stage end + ${postStage} s)`);
    while (t <= stopAt) {
      await onSnapshot(t, 2);
      if (t >= stopAt) break;
      await policyPass(t);
      const n = await session.step(SNAP_EVERY * 1000, policy && policy.mashing ? mainKey : null);
      if (n) rec.action({ t, key: mainKey, why: 'mash', count: n });
      t += SNAP_EVERY;
    }
  } catch (e) {
    // The game navigated (Paperclips' reset() reloads the page into a new universe) or the page broke:
    // end the run here and keep everything recorded so far.
    const msg = String((e && e.message) || e).split('\n')[0];
    const navigated = /context was destroyed|navigat|Target page, context or browser has been closed/i.test(msg);
    abort = navigated ? 'the game reloaded the page (reset / new universe)' : msg;
    rec.event({ t, type: navigated ? 'page-reset' : 'abort', message: abort });
    log(`  run ended at ${mmss(t)}: ${abort}`);
  }

  const harnessErr = await session.harnessErrors().catch(() => ({}));
  const wallSeconds = (performance.now() - wallStart) / 1000;
  const meta = {
    game: adapter.name,
    title: adapter.title,
    prefix: path.relative(REPO_ROOT, prefix),
    gameDir: path.relative(REPO_ROOT, gameDir) || '.',
    seed,
    stageStart: startStage,
    stageRequested: stageReq,
    fixture: fixture ? fixture.name : null,
    realtime,
    accelMinutes: Number(opts.accelMinutes ?? 0),
    autoplay: !!opts.autoplay,
    phase1End,
    stageEnd,
    stageEndBy,
    endT: rec.snaps.length ? rec.snaps[rec.snaps.length - 1].t : 0,
    snapshots: rec.snaps.length,
    boot: session.bootInfo,
    pageErrors: session.errors.slice(0, 20),
    harnessErrors: harnessErr,
    policyNoops: policy ? policy.noops : null,
    abort,
    wallSeconds: Math.round(wallSeconds),
    createdAt: new Date().toISOString(),
  };
  await session.close();

  writeJson(`${prefix}.snaps.json`, { meta, snaps: rec.snaps });
  writeJson(`${prefix}.events.json`, { meta, events: rec.events });
  writeJson(`${prefix}.actions.json`, { meta, actions: rec.actions });
  if (stageEnd != null) fs.writeFileSync(`${prefix}.transition.txt`, transitionReport({ meta, snaps: rec.snaps, events: rec.events, actions: rec.actions }, { format: 'text' }));
  fs.writeFileSync(`${prefix}.summary.md`, summary(meta, rec));
  log(`done in ${Math.round(wallSeconds)} s → ${path.relative(process.cwd(), prefix)}.*`);
  return { prefix, meta, rec };
}

function summary(meta, rec) {
  const ev = rec.events;
  const count = (f) => ev.filter(f).length;
  const byWhy = new Map();
  for (const a of rec.actions) {
    const k = a.why === 'mash' ? 'mash (clicks)' : a.why;
    byWhy.set(k, (byWhy.get(k) || 0) + (a.why === 'mash' ? a.count : 1));
  }
  const last = rec.snaps[rec.snaps.length - 1];
  const lines = [
    `# Run summary: ${meta.prefix}`,
    '',
    `| field | value |`,
    `|---|---|`,
    `| game | ${meta.title} (${meta.game}) |`,
    `| game dir | \`${meta.gameDir}\` |`,
    `| seed | ${meta.seed} (${meta.boot.seedMethod ?? 'Math.random seeded in page'}) |`,
    `| start | Stage ${meta.stageStart}${meta.fixture ? ` (fixture ${meta.fixture})` : ''}${meta.boot.preset ? ` (${meta.boot.preset})` : ''} |`,
    meta.boot.stageWarning ? `| stage warning | ${meta.boot.stageWarning} |` : null,
    `| player | ${meta.autoplay ? "the game's own Autoplay bot" : 'scripted curious first-time player'} |`,
    `| phase 1 (real time) | ${meta.realtime} s |`,
    `| phase 2 (stepped) | ${mmss(meta.phase1End)} → ${mmss(meta.endT)} game time (cap ${meta.accelMinutes} min) |`,
    `| stage end | ${meta.stageEnd != null ? `${mmss(meta.stageEnd)}${meta.stageEndBy ? ` (${meta.stageEndBy})` : ''}` : 'not reached'} |`,
    meta.abort ? `| run ended at ${mmss(meta.endT)} | ${meta.abort} |` : null,
    `| snapshots | ${meta.snapshots} |`,
    `| reveals | ${count((e) => e.type === 'reveal')} (${count((e) => e.type === 'reveal' && e.what === 'panel')} panels, ${count((e) => e.type === 'reveal' && e.what === 'button')} buttons, ${count((e) => e.type === 'reveal' && e.what === 'project')} projects, ${count((e) => e.type === 'reveal' && e.what === 'modal')} modals) |`,
    `| enabled transitions | ${count((e) => e.type === 'enabled')} |`,
    `| console lines | ${count((e) => e.type === 'console')} (${count((e) => e.type === 'console' && e.novel)} distinct) |`,
    `| log entries | ${count((e) => e.type === 'log')} |`,
    `| modals opened | ${count((e) => e.type === 'modal')} |`,
    `| page errors | ${meta.pageErrors.length}${meta.harnessErrors && meta.harnessErrors.timerErrors ? `, timer callback errors ${meta.harnessErrors.timerErrors}` : ''} |`,
    `| wall-clock | ${meta.wallSeconds} s |`,
    '',
    '## Policy actions',
    '',
    byWhy.size ? [...byWhy].map(([k, v]) => `- ${k}: ${v}`).join('\n') : '- none (autoplay)',
    '',
    '## Final metrics',
    '',
    '```',
    JSON.stringify(last ? last.m : {}, null, 0),
    '```',
    '',
    `Outputs: \`${path.basename(meta.prefix)}.snaps.json\`, \`.events.json\`, \`.actions.json\`, \`.t<min>.png\`${meta.stageEnd != null ? ', `.tend.png`, `.tpre.png`, `.transition.png/.txt`' : ''}. Analyse with \`node tools/critic/analyze.mjs ${meta.prefix}\`.`,
    '',
  ];
  return lines.filter((l) => l !== null).join('\n');
}
