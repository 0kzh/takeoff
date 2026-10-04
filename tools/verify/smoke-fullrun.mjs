#!/usr/bin/env node
/**
 * The whole game in a browser: a new game played by Autoplay (the reasonable bot) to an ending, in
 * stepped time, with a save and a reload at every stage boundary.
 *
 *   npm run build && node tools/verify/smoke-fullrun.mjs [--seed 1] [--policy bot] [--variant ...]
 *
 * Starts its own static server on a free port and drives system Chrome (headless). Checks: every stage
 * boundary survives a save and a reload (the stage, the date, the score and the panels come back); the
 * run reaches an ending with its end screen; the whole game's length; zero page errors. Prints the minutes
 * spent in each stage. Exits non-zero when any check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = join(ROOT, 'agent-tools/shots/fullrun');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SEED = Number(argOf('--seed', '1'));
const POLICY = argOf('--policy', 'bot');
const VARIANT = argOf('--variant', '');
const STEP_MS = 5000;
const MAX_MINUTES = 240;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));

/** What a stage boundary must bring back after a reload. */
const READ = () => {
  const s = window.__game.state;
  const panels = [...document.querySelectorAll('#columns .panel')].filter((p) => p.checkVisibility()).map((p) => p.id).sort();
  return { stage: s.stage, date: Math.round(s.date * 1000) / 1000, tasks: s.tasks, time: Math.round(s.stats.timePlayed * 10) / 10, version: s.version, panels: panels.join(','), ending: s.ending };
};

try {
  await page.goto(`${BASE}?seed=${SEED}&speed=0`);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => {
    localStorage.clear();
    window.__game.setSpeed(0);
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  const start = await page.evaluate(() => ({ stage: window.__game.state.stage, tasks: window.__game.state.tasks }));
  check('a new game opens on Stage 1 with nothing done', start.stage === 1 && start.tasks === 0, JSON.stringify(start));
  await page.evaluate(([p, v]) => {
    window.__game.setSpeed(0);
    window.__game.setAutoplay(true, p, false, v);
  }, [POLICY, VARIANT]);
  let stage = 1;
  const boundaries = [];
  let state = null;
  for (let step = 0; step < (MAX_MINUTES * 60 * 1000) / STEP_MS; step++) {
    state = await page.evaluate((ms) => {
      window.__game.tick(ms);
      const s = window.__game.state;
      return { stage: s.stage, ending: s.ending, t: s.stats.timePlayed };
    }, STEP_MS);
    if (state.stage !== stage && !state.ending) {
      // A stage boundary: save, reload, compare, and play on.
      await page.waitForTimeout(50);
      const before = await page.evaluate(READ);
      await page.evaluate(() => window.__game.save());
      await page.reload();
      await page.waitForFunction(() => !!window.__game);
      const after = await page.evaluate(READ);
      await page.evaluate(([p, v]) => {
        window.__game.setSpeed(0);
        window.__game.setAutoplay(true, p, false, v);
      }, [POLICY, VARIANT]);
      const same = before.stage === after.stage && before.date === after.date && before.tasks === after.tasks && before.time === after.time && before.panels === after.panels;
      boundaries.push({ from: stage, to: state.stage, at: state.t, same, before, after });
      check(`Stage ${stage} → ${state.stage} at ${clock(state.t)}: saved and reloaded, the stage, date, score and panels come back`, same,
        same ? `${after.panels.split(',').length} panels, save v${after.version}` : `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);
      await page.screenshot({ path: join(SHOTS, `stage-${state.stage}.png`) });
      stage = state.stage;
    }
    if (state.ending) break;
  }
  await page.evaluate(() => window.__game.tick(2000));
  const end = await page.evaluate(() => {
    const s = window.__game.state;
    const at = s.stats.stageEnteredAt;
    const rows = [...document.querySelectorAll('#endingStats tr')].map((tr) => tr.cells[0].innerText.trim());
    return {
      ending: s.ending,
      screen: document.getElementById('endingScreen').checkVisibility(),
      title: document.getElementById('endingTitle').innerText,
      time: s.stats.timePlayed,
      stages: at.map((x, i) => (at[i + 1] ?? s.stats.timePlayed) - x),
      rows,
    };
  });
  await page.screenshot({ path: join(SHOTS, 'end.png'), fullPage: true });
  console.log(`      stages: ${end.stages.map((x, i) => `${i + 1} ${clock(x)}`).join(' · ')} · total ${clock(end.time)} (${(end.time / 60).toFixed(1)} min)`);
  check('the five stages are played and every boundary survives a reload', boundaries.length === 4 && boundaries.every((b) => b.same), boundaries.map((b) => `${b.from}→${b.to} ${clock(b.at)}`).join(', '));
  check(`a new game played by ${POLICY} reaches an ending, with its end screen`, !!end.ending && end.screen && end.rows.length >= 30, `${end.title || 'no ending'}; ${end.rows.length} rows`);
  check('the whole game takes 140–210 minutes', end.time >= 140 * 60 && end.time <= 210 * 60, `${(end.time / 60).toFixed(1)} min`);
} catch (e) {
  check('full run ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
}

check('no page errors or console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (seed ${SEED}, ${POLICY}). Screenshots: ${SHOTS}`);
process.exitCode = failed.length ? 1 : 0;
