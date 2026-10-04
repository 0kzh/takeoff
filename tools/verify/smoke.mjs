#!/usr/bin/env node
/**
 * Stage 1 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke.mjs [--policy bot|naive] [--seed 1]
 *
 * Starts its own static server on a free port, drives the game in system Chrome (headless) with
 * `__game.setAutoplay(true)` + `__game.tick(ms)`, and checks: no page or console errors from boot
 * through the Stage 2 arrival; the opening (owner feedback 1: one control and one number at 0:00, the
 * first GPU at 1.5 / 2 / 4 clicks a second, numbers and controls at 0:00 / 0:30 / 1:00 / 2:00 / 3:00
 * / 5:00 with a screenshot each); reveal order and the staggered beats; the greyed goal from the
 * first purchase; no yield wording; the Train row's GPU shortfall; numeric-token counts at minutes
 * 0/1/3/5/10/20/end; save → reload during a training run; the transition narration; the meter's
 * width at every fill; no horizontal overflow at 390 px. Screenshots go to agent-tools/shots/stage1/.
 * Exits non-zero when any check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = join(ROOT, 'agent-tools/shots/stage1');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const POLICY = argOf('--policy', 'bot');
const SEED = Number(argOf('--seed', '1'));
const STEP_MS = 2000;
const MAX_MINUTES = 45;

// ---------- static server on a free port ----------

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

// ---------- checks ----------

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
function watch(page, label) {
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => errors.push(`${label} requestfailed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${label} HTTP ${r.status()} ${r.url()}`);
  });
}

/** What a player sees: visible text outside the dev overlay, buttons, panels, the modal. */
const SNAPSHOT = () => {
  const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const text = [...document.body.children]
    .filter((el) => el.id !== 'dev' && vis(el))
    .map((el) => el.innerText)
    .join('\n');
  const tokens = text.match(/\d+(?:[.,:]\d+)*/g) ?? [];
  // Owner feedback 1 counts numbers outside the console and the Developments log.
  const outside = [...document.querySelectorAll('#topDiv, #columns > .column > .panel')]
    .filter((el) => el.id !== 'panel-log' && vis(el))
    .map((el) => el.innerText)
    .join('\n');
  const outsideTokens = outside.match(/\d+(?:[.,:]\d+)*/g) ?? [];
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
  const buttons = [...document.querySelectorAll('button, input')].filter((b) => !b.closest('#dev') && vis(b));
  const panels = [...document.querySelectorAll('.panel')].filter((p) => vis(p) && p.querySelector(':scope > b'));
  const modal = document.getElementById('modalOverlay');
  const s = window.__game.state;
  return {
    t: s.stats.timePlayed,
    stage: s.stage,
    numbers: tokens.length,
    numbersOutside: outsideTokens.length,
    interactive: buttons.length,
    words,
    panels: panels.map((p) => p.id),
    buttons: buttons.map((b) => ({ id: b.id, enabled: !b.disabled, label: b.innerText.trim().split('\n')[0] })),
    visibleIds: [...document.querySelectorAll('[id]')].filter((el) => !el.closest('#dev') && vis(el)).map((el) => el.id),
    modal: modal && modal.classList.contains('shown') ? document.getElementById('modalTitle').innerText : '',
    console: [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean),
    run: s.training.run ? { phase: s.training.run.phase, name: s.training.run.name, elapsed: s.training.run.elapsed } : null,
    releases: s.stats.publicReleases,
    trainings: s.stats.trainings,
    gpus: s.gpus,
    // Owner feedback 1: no yield anywhere; the Train row names the GPU shortfall and its fix.
    banned: /undertrained|Train now/i.test(text),
    trainShort: vis(document.getElementById('trainGpuMeter')) ? document.getElementById('trainGpus').innerText : '',
    // G3 as amended: a greyed purchase on screen; in the first three minutes the next GPU or power block counts lit.
    greyed: buttons.some((b) => b.disabled && /^(btn-|proj-)/.test(b.id) && !/^btn-(task|lowerPrice|raisePrice)$/.test(b.id)),
    unitShown: ['btn-gpu', 'btn-buyPower'].some((id) => vis(document.getElementById(id))),
  };
};

/** CSS fade-ins run on real time; let them finish before a screenshot. */
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(SHOTS, `${name}.png`), ...opts });
}

async function freshPage(label, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${BASE}?seed=${SEED}&speed=0`);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.setSpeed(0));
  return { context, page };
}

try {
  // ===== 1. The opening, one mechanic at a time (owner feedback 1, (a)) =====
  {
    const { context, page } = await freshPage('minute0');
    const snap = await page.evaluate(SNAPSHOT);
    const enabled = snap.buttons.filter((b) => b.enabled).map((b) => b.id);
    check('0:00: one control (Complete Task) and one number (the tasks)', enabled.length === 1 && enabled[0] === 'btn-task' && snap.interactive === 1 && snap.numbersOutside === 1,
      `controls ${snap.buttons.map((b) => b.id).join(', ')}; numbers ${snap.numbersOutside}`);
    const text = await page.evaluate(() => document.body.innerText);
    check('0:00: no power, no funds, no date on screen', !/kWh|Funds|Jul 2025/.test(text) && /Welcome to OpenMind\. Customers are waiting\./.test(text));
    await shot(page, '00-opening-0m00');
    // The meter is one width at every fill (halfwidth glyphs, or the monospace fallback).
    const widths = await page.evaluate(() => {
      // A copy of the power meter's span in a visible spot (the Power panel is hidden at 0:00).
      const probe = document.getElementById('powerMeter').cloneNode();
      probe.id = 'meterProbe';
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap';
      document.getElementById('columns').appendChild(probe);
      const mono = document.body.classList.contains('meterMono');
      const g = mono ? ['[', '■', '□', ']'] : ['｢', '￭', '･', '｣'];
      const out = [];
      for (let k = 0; k <= 10; k++) {
        probe.textContent = g[0] + g[1].repeat(k) + g[2].repeat(10 - k) + g[3];
        out.push(probe.getBoundingClientRect().width);
      }
      probe.remove();
      return { out, mono };
    });
    const spread = Math.max(...widths.out) - Math.min(...widths.out);
    check('the meter is one width at every fill (0–10 cells)', spread <= 1 && widths.out[0] > 0,
      `${widths.mono ? 'monospace fallback' : 'halfwidth glyphs'}: ${widths.out.map((w) => w.toFixed(1)).join(' / ')} px`);
    await context.close();
  }
  // The first GPU at 1.5, 2 and 4 clicks a second (every click pays $0.25 at once; the GPU is $6).
  const firstGpu = {};
  for (const rate of [1.5, 2, 4]) {
    const { context, page } = await freshPage(`gpu${rate}`);
    firstGpu[rate] = await page.evaluate((r) => {
      let acc = 0;
      for (let i = 0; i < 400; i++) {
        acc += r * 0.1;
        while (acc >= 1) {
          acc -= 1;
          document.getElementById('btn-task').click();
        }
        window.__game.tick(100);
        const gpu = document.getElementById('btn-gpu');
        if (gpu.checkVisibility() && !gpu.disabled) return window.__game.state.stats.timePlayed;
      }
      return null;
    }, rate);
    await context.close();
  }
  check('first GPU within 16 s at 1.5–2 clicks a second', firstGpu[1.5] !== null && firstGpu[1.5] <= 16.5 && firstGpu[2] !== null && firstGpu[2] <= 13,
    `1.5/s ${firstGpu[1.5] ?? '—'} s · 2/s ${firstGpu[2] ?? '—'} s · 4/s ${firstGpu[4] ?? '—'} s`);
  // A steady player for five minutes (the spec's paper player): two clicks a second; a GPU whenever
  // one is affordable and power is not about to run out; power under a third of a block; the price
  // moved a few seconds after reading the line (down while the pile grows, up while every task
  // sells); Marketing, researchers and project cards when affordable. Counts and a screenshot at six marks.
  const opening = {};
  {
    const { context, page } = await freshPage('opening');
    const marks = [0, 30, 60, 120, 180, 300];
    let t = 0;
    for (const m of marks) {
      while (t < m) {
        await page.evaluate(() => {
          const g = window.__game;
          const s = g.state;
          const p = (window.__sp ??= { grow: 0, sells: 0, lastMove: -100, prev: 0 });
          const el = (id) => document.getElementById(id);
          const can = (id) => {
            const b = el(id);
            return !!b && b.checkVisibility() && !b.disabled;
          };
          const money = (id) => Number((el(id)?.innerText ?? '').replace(/[^0-9.]/g, '')) || 0;
          for (let k = 0; k < 10; k++) {
            if (k % 5 === 0) can('btn-task') && el('btn-task').click();
            const block = Number((el('powerBlock')?.innerText ?? '1000').replace(/,/g, '')) || 1000;
            const powerShown = el('btn-buyPower').checkVisibility();
            if (powerShown && s.power < block / 3 && can('btn-buyPower')) el('btn-buyPower').click();
            const spare = !powerShown || s.power > block / 2 || s.funds - money('gpuCost') >= money('powerCost');
            if (spare && can('btn-gpu')) el('btn-gpu').click();
            if (k === 9) {
              // Once a second: the price, read from the line on screen.
              const line = el('billingLine').checkVisibility() ? el('billingLine').innerText : '';
              p.grow = /pile up/.test(line) && s.unbilled > p.prev ? p.grow + 1 : 0;
              p.sells = /Every task sells/.test(line) ? p.sells + 1 : 0;
              p.prev = s.unbilled;
              const now = s.stats.timePlayed;
              if (now - p.lastMove >= 5) {
                if (p.grow >= 6 && can('btn-lowerPrice')) {
                  el('btn-lowerPrice').click();
                  p.lastMove = now;
                } else if (p.sells >= 10 && can('btn-raisePrice')) {
                  el('btn-raisePrice').click();
                  p.lastMove = now;
                  p.sells = 0;
                }
              }
              if (s.funds - money('marketingCost') >= money('powerCost') && can('btn-marketing')) el('btn-marketing').click();
              if (can('btn-hireResearcher')) el('btn-hireResearcher').click();
              for (const b of document.querySelectorAll('#projectList button')) if (b.checkVisibility() && !b.disabled) b.click();
            }
            g.tick(100);
          }
        });
        t += 1;
      }
      const snap = await page.evaluate(SNAPSHOT);
      opening[m] = { numbers: snap.numbersOutside, controls: snap.interactive };
      await shot(page, `00-opening-${Math.floor(m / 60)}m${String(m % 60).padStart(2, '0')}`);
    }
    await context.close();
  }
  const targets = { 0: [1, 1], 30: [4, 2], 60: [6, 3], 120: [11, 5], 180: [17, 7], 300: [22, 10] };
  // At 0:30 the steady player has rented a third GPU, so the power reading (beat 4, at 0:26 in the
  // spec's own beat table) is on screen too: one number over the table's 4.
  const slack = { 30: 1 };
  const openingRow = Object.entries(opening).map(([m, c]) => `${clock(Number(m))} ${c.numbers}/${c.controls}`).join(' · ');
  check('opening: numbers ≤ 1 / 4 / 6 / 11 / 17 / 22 and controls ≤ 1 / 2 / 3 / 5 / 7 / 10 at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00',
    Object.entries(targets).every(([m, [n, c]]) => opening[m] && opening[m].numbers <= n + (slack[m] ?? 0) && opening[m].controls <= c), openingRow);

  // ===== 2. A full Stage 1 under autoplay =====
  const { context, page } = await freshPage('stage1');
  // The policy plays, but leaves Break ground to the test so the arrival can be inspected.
  await page.evaluate((p) => window.__game.setAutoplay(true, p, true), POLICY);
  const first = new Map(); // element id / modal title → first time visible
  const counts = {};
  const countAt = [0, 1, 3, 5, 10, 20];
  const beats = []; // per-snapshot newly visible interactive elements and numbers
  let prev = await page.evaluate(SNAPSHOT);
  counts['0'] = { numbers: prev.numbers, interactive: prev.interactive, words: prev.words, panels: prev.panels.length };
  for (const id of prev.visibleIds) first.set(id, 0);
  let reloadDone = false;
  let reloadInfo = null;
  let transitionAt = null;
  let narration = null;
  let arrival = null;
  let bannedAt = null;
  const shortLines = new Set();
  let firstPurchase = null;
  const goal = { ticks: 0, ok: 0, misses: [] };
  const shotsAt = { 1: '02-minute1', 3: '03-minute3', 5: '04-minute5', 10: '05-minute10', 20: '07-minute20' };

  while (true) {
    const snap = await page.evaluate((ms) => {
      window.__game.tick(ms);
      return null;
    }, STEP_MS).then(() => page.evaluate(SNAPSHOT));
    const firstTime = snap.visibleIds.filter((id) => !first.has(id));
    for (const id of firstTime) first.set(id, snap.t);
    if (snap.modal && !first.has(`modal:${snap.modal}`)) first.set(`modal:${snap.modal}`, snap.t);
    // A beat = one 2-s snapshot; count only elements the player has never seen before.
    const newButtons = snap.buttons.filter((b) => firstTime.includes(b.id)).map((b) => b.id);
    beats.push({ t: snap.t, newButtons, dNumbers: firstTime.length ? snap.numbersOutside - prev.numbersOutside : 0 });
    if (snap.banned && bannedAt === null) bannedAt = snap.t;
    if (snap.stage === 1 && snap.trainShort) shortLines.add(snap.trainShort);
    if (firstPurchase === null && snap.gpus > 0) firstPurchase = snap.t;
    if (firstPurchase !== null && snap.stage === 1 && !snap.modal) {
      goal.ticks++;
      if (snap.greyed || (snap.t < 180 && snap.unitShown)) goal.ok++;
      else if (goal.misses.length < 6) goal.misses.push(clock(snap.t));
    }

    for (const m of countAt) {
      if (m > 0 && counts[String(m)] === undefined && snap.t >= m * 60) {
        counts[String(m)] = { numbers: snap.numbers, interactive: snap.interactive, words: snap.words, panels: snap.panels.length };
        if (shotsAt[m]) await shot(page, shotsAt[m]);
      }
    }

    // Save → reload while the first training run is in progress.
    if (!reloadDone && snap.run && snap.run.phase === 'training' && snap.run.elapsed > 8) {
      reloadDone = true;
      const before = await page.evaluate(() => {
        window.__game.save();
        const s = window.__game.state;
        return { tasks: s.tasks, elapsed: s.training.run.elapsed, name: s.training.run.name, console: s.console.slice(), t: s.stats.timePlayed };
      });
      await shot(page, '06-training-before-reload');
      await page.reload();
      await page.waitForFunction(() => !!window.__game);
      await page.evaluate((p) => {
        window.__game.setSpeed(0);
        window.__game.setAutoplay(true, p, true);
      }, POLICY);
      const afterReload = await page.evaluate(() => {
        const s = window.__game.state;
        return {
          tasks: s.tasks,
          run: s.training.run ? { name: s.training.run.name, phase: s.training.run.phase, elapsed: s.training.run.elapsed } : null,
          trainingShown: document.getElementById('panel-training').checkVisibility(),
          runningShown: document.getElementById('train-running').checkVisibility(),
          console: s.console.slice(),
        };
      });
      reloadInfo = { before, afterReload };
      check(
        'save → reload mid-training restores the run',
        afterReload.run && afterReload.run.name === before.name && afterReload.run.phase === 'training' &&
          Math.abs(afterReload.run.elapsed - before.elapsed) < 2 && afterReload.trainingShown && afterReload.runningShown &&
          afterReload.tasks >= before.tasks && afterReload.console.join('|') === before.console.join('|'),
        `${before.name} at ${before.elapsed.toFixed(1)} s → ${afterReload.run ? `${afterReload.run.name} ${afterReload.run.phase} ${afterReload.run.elapsed.toFixed(1)} s` : 'no run'}`,
      );
      prev = await page.evaluate(SNAPSHOT);
      continue;
    }

    // Break ground affordable: the test (not the policy) clicks it, then inspects the arrival before
    // anyone spends the new Trust or money.
    if (snap.stage === 1 && !snap.modal && snap.buttons.some((b) => b.id === 'proj-p_datacenter' && b.enabled)) {
      await page.evaluate(() => window.__game.setAutoplay(false));
      counts['end'] = { numbers: snap.numbers, interactive: snap.interactive, words: snap.words, panels: snap.panels.length };
      await shot(page, '07b-before-break-ground');
      const consoleBefore = snap.console;
      await page.click('#proj-p_datacenter');
      arrival = await page.evaluate(() => {
        const s = window.__game.state;
        const vis = (id) => document.getElementById(id).checkVisibility();
        const infraEnabled = ['btn-datacenter', 'btn-gpuBatch', 'btn-turbines'].filter((id) => vis(id) && !document.getElementById(id).disabled);
        const cap = s.labSpace * 1000 * s.labMult;
        const raw = 21000 * Math.pow(Math.max(s.capability, s.training.internalCapability) / 1.6, 5);
        const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
        const need = Math.round(raw / unit) * unit;
        return { stage: s.stage, t: s.stats.timePlayed, infra: vis('panel-infrastructure'), compute: vis('panel-compute'), infraEnabled, trust: s.trust, cap, need };
      });
      transitionAt = arrival.t;
      for (const id of await page.evaluate(() => [...document.querySelectorAll('[id]')].filter((el) => !el.closest('#dev') && el.checkVisibility()).map((el) => el.id))) {
        if (!first.has(id)) first.set(id, transitionAt);
      }
      const frames = [];
      for (let k = 0; k < 16; k++) {
        const c = await page.evaluate(() => {
          window.__game.tick(500);
          return [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean);
        });
        frames.push(c);
        if (k === 3) await shot(page, '08-transition');
      }
      narration = { consoleBefore, frames };
      await shot(page, '09-stage2-arrival');
      break;
    }
    prev = snap;
    if (snap.t > MAX_MINUTES * 60) break;
  }

  check('reached Stage 2', transitionAt !== null, transitionAt === null ? 'no transition' : `at ${clock(transitionAt)}`);
  check('save → reload was exercised', reloadDone, reloadInfo ? '' : 'no training run seen');

  // ----- reveal order and staggering -----
  const at = (id) => (first.has(id) ? first.get(id) : Infinity);
  const order = ['panel-business', 'panel-compute', 'panel-power', 'panel-research', 'panel-projects', 'panel-training', 'focusRow', 'panel-infrastructure'];
  const times = order.map(at);
  const inOrder = times.every((t, i) => t !== Infinity && (i === 0 || t >= times[i - 1]));
  check('reveal order: Business → Compute → Power → Research → Projects → Training → Focus → Infrastructure', inOrder, order.map((id, i) => `${id.replace('panel-', '')} ${times[i] === Infinity ? '—' : clock(times[i])}`).join(', '));
  check('Research arrives with Trust and Hire Researcher only (Expand Lab later)', at('btn-expandLab') > at('panel-research') && at('btn-hireResearcher') === at('panel-research'), `research ${clock(at('panel-research'))}, expand ${clock(at('btn-expandLab'))}`);
  check('Projects arrive 30–60 s after Research', at('panel-projects') - at('panel-research') >= 30 && at('panel-projects') - at('panel-research') <= 62, `${Math.round(at('panel-projects') - at('panel-research'))} s`);
  check('Focus row hidden during the first training run', at('focusRow') > at('train-running'), `first run ${clock(at('train-running'))}, focus ${clock(at('focusRow'))}`);
  // G3 as amended by owner feedback 1: from the first purchase on, a greyed goal stays on screen.
  const goalShare = goal.ticks ? goal.ok / goal.ticks : 0;
  check('G3: a greyed goal on screen ≥ 99 % of Stage 1 from the first purchase (the next GPU or power block counts in the first 3 min)',
    goalShare >= 0.99, `${(goalShare * 100).toFixed(1)} % of ${goal.ticks} snapshots from ${firstPurchase === null ? '—' : clock(firstPurchase)}${goal.misses.length ? `; none at ${goal.misses.join(', ')}` : ''}`);
  // G5 as amended: the first five minutes add at most 4 numbers and 2 controls a beat; later, 8 and 3.
  const early = beats.filter((b) => b.t <= 300);
  const late = beats.filter((b) => b.t > 300);
  const worst = (list, key) => list.reduce((w, b) => ((key === 'n' ? b.newButtons.length : b.dNumbers) > (key === 'n' ? w.newButtons.length : w.dNumbers) ? b : w), list[0]);
  const eb = worst(early, 'n');
  const en = worst(early, 'd');
  check('G5, first five minutes: no beat adds more than 2 controls or 4 numbers', eb.newButtons.length <= 2 && en.dNumbers <= 4,
    `max ${eb.newButtons.length} controls at ${clock(eb.t)} (${eb.newButtons.join(', ')}); max +${en.dNumbers} numbers at ${clock(en.t)}`);
  const lb = worst(late, 'n');
  check('no later beat adds more than 3 interactive elements', lb.newButtons.length <= 3, `max ${lb.newButtons.length} at ${clock(lb.t)} (${lb.newButtons.join(', ')})`);
  const ln = worst(late, 'd');
  check('no later beat adds more than ~8 numbers', ln.dNumbers <= 8, `max +${ln.dNumbers} at ${clock(ln.t)}`);
  // Beats 4–8 (power, Buy Power, the price, Marketing, Research) at least 30 s apart (2-s snapshots).
  const beatIds = ['panel-power', 'btn-buyPower', 'btn-lowerPrice', 'btn-marketing', 'panel-research'];
  const beatTimes = beatIds.map(at);
  const spaced = beatTimes.every((x, i) => x !== Infinity && (i === 0 || x - beatTimes[i - 1] >= 28));
  check('opening beats 4–8 arrive in order, ≥ 30 s apart', spaced, beatIds.map((id, i) => `${id.replace(/^(panel|btn)-/, '')} ${beatTimes[i] === Infinity ? '—' : clock(beatTimes[i])}`).join(', '));
  check('no "undertrained" and no "Train now" anywhere on screen', bannedAt === null, bannedAt === null ? '' : `seen at ${clock(bannedAt)}`);
  const lines = [...shortLines];
  const okLine = (l) => /^Needs [\d,]+ GPUs\. [\d,]+ rented\. Rent [\d,]+ more\.$/.test(l) ||
    /^Needs [\d,]+ GPUs\. The cloud rents [\d,]+\.( .+ adds 20\.)?$/.test(l) ||
    /^Needs [\d,]+ GPUs\. The cloud will rent [\d,]+\. Build the First Datacenter\.$/.test(l);
  check('a Train short of GPUs names the shortfall and its fix', lines.length > 0 && lines.every(okLine), lines.slice(0, 4).join(' | '));

  // Reveal gaps as the critic measures them: panels, buttons, project buttons, modals.
  const revealTimes = [...first.entries()]
    .filter(([id]) => id.startsWith('panel-') || id.startsWith('btn-') || id.startsWith('proj-') || id.startsWith('modal:'))
    .filter(([id]) => !/proj-p_(beg_power|press)|modal:A Customer Writes/.test(id))
    .map(([, t]) => t)
    .filter((t) => transitionAt === null || t <= transitionAt)
    .sort((a, b) => a - b);
  let gap = 0;
  let gapAt = [0, 0];
  for (let i = 1; i < revealTimes.length; i++) {
    if (revealTimes[i] - revealTimes[i - 1] > gap) {
      gap = revealTimes[i] - revealTimes[i - 1];
      gapAt = [revealTimes[i - 1], revealTimes[i]];
    }
  }
  check('longest reveal gap (panels, buttons, projects, modals) ≤ 180 s', gap <= 180, `${Math.round(gap)} s (${clock(gapAt[0])}–${clock(gapAt[1])}), ${revealTimes.length} reveals`);
  if (args.includes('--verbose')) {
    const list = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([id, t]) => `${clock(t)} ${id}`);
    console.log(`      first-visible: ${list.join(' | ')}`);
  }

  // ----- numeric tokens -----
  const keys = ['0', '1', '3', '5', '10', '20', 'end'];
  const row = keys.map((k) => (counts[k] ? counts[k].numbers : '—')).join(' / ');
  const irow = keys.map((k) => (counts[k] ? counts[k].interactive : '—')).join(' / ');
  const wrow = keys.map((k) => (counts[k] ? counts[k].words : '—')).join(' / ');
  check('numeric tokens recorded at 0/1/3/5/10/20/end', keys.every((k) => counts[k]), `numbers ${row}; controls ${irow}; words ${wrow}`);
  // Critic round 2 §6.1 targets at minute 10: ≤ 38 numbers, ≤ 15 controls, ≤ 230 words.
  const m10 = counts['10'];
  check('minute 10: ≤ 38 numbers, ≤ 15 controls, ≤ 230 words', !!m10 && m10.numbers <= 38 && m10.interactive <= 15 && m10.words <= 230,
    m10 ? `${m10.numbers} numbers, ${m10.interactive} controls, ${m10.words} words` : 'no minute-10 snapshot');
  const paperclips = { 0: 10, 1: 12, 3: 15, 5: 30, 10: 26, 20: 29, end: 49 };
  const over = keys.filter((k) => counts[k] && counts[k].numbers > paperclips[k] * 1.6 + 6);
  check('numeric tokens stay near the Paperclips curve (≤ 1.6× + 6)', over.length === 0, over.length ? `over at ${over.join(', ')}` : 'Paperclips 10 / 12 / 15 / 30 / 26 / 29 / 49');

  // ----- transition narration -----
  if (narration) {
    const f0 = narration.frames[0];
    const kept = narration.consoleBefore.filter((l) => f0.includes(l)).length;
    check('transition keeps earlier console lines (no wipe)', f0.length >= 4 && kept >= 3, `${kept} earlier lines kept; first frame ${f0.length} lines`);
    check('"First Datacenter online outside Abilene." is on screen', narration.frames.some((f) => f.some((l) => l.startsWith('First Datacenter online outside Abilene.'))));
    const all = narration.frames.flat();
    const lost = all.find((l) => /rented GPUs go back/.test(l));
    const replaced = all.find((l) => /[Pp]ower is bought in megawatts now/.test(l));
    const means = all.find((l) => /Tasks per second ×/.test(l));
    const firstIdx = (re) => narration.frames.findIndex((f) => f.some((l) => re.test(l)));
    const i1 = firstIdx(/rented GPUs go back/);
    const i2 = firstIdx(/[Pp]ower is bought in megawatts now/);
    const i3 = firstIdx(/Tasks per second ×/);
    check('three lines of consequence print over ~6 s, in order', lost && replaced && means && i1 < i2 && i2 < i3 && i3 <= 14, `${i1 * 0.5}s / ${i2 * 0.5}s / ${i3 * 0.5}s`);
    check('Stage 2 arrival: Infrastructure replaces Compute', arrival.infra && !arrival.compute);
    check('Stage 2 arrival: an Infrastructure button is affordable', arrival.infraEnabled.length >= 1, arrival.infraEnabled.join(', '));
    check('Stage 2 arrival: Trust ≥ 2 and research cap ≥ next run', arrival.trust >= 2 && arrival.cap >= arrival.need, `Trust ${arrival.trust}, cap ${arrival.cap} vs ${arrival.need}`);
    console.log(`      console during the narration: ${JSON.stringify(narration.frames[13])}`);
  } else {
    check('transition narration observed', false, 'no transition');
  }

  // ----- 390 px -----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__game.tick(100));
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await shot(page, '10-mobile-390-stage2', { fullPage: true });
  check('390 px wide (Stage 2 screen): no horizontal overflow', overflow.sw <= overflow.cw, `${overflow.sw} vs ${overflow.cw}`);
  await context.close();

  {
    const { context: c2, page: p2 } = await freshPage('mobile', { width: 390, height: 844 });
    await p2.evaluate((p) => {
      window.__game.setAutoplay(true, p);
      for (let i = 0; i < 300; i++) window.__game.tick(2000);
    }, POLICY);
    const o = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await shot(p2, '11-mobile-390-minute10', { fullPage: true });
    check('390 px wide (minute 10): no horizontal overflow', o.sw <= o.cw, `${o.sw} vs ${o.cw}`);
    await c2.close();
  }

  {
    // The dev overlay's Stage 2 preset (rebuilt from the new end of Stage 1) loads and plays.
    const c3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p3 = await c3.newPage();
    watch(p3, 'preset');
    await p3.goto(`${BASE}?seed=${SEED}&speed=0&dev=1`);
    await p3.waitForFunction(() => !!window.__game);
    const pre = await p3.evaluate(() => {
      window.__game.setSpeed(0);
      window.__game.loadPreset(2);
      window.__game.tick(8000);
      const s = window.__game.state;
      const vis = (id) => document.getElementById(id).checkVisibility();
      const raw = 21000 * Math.pow(Math.max(s.capability, s.training.internalCapability) / 1.6, 5);
      const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
      return {
        stage: s.stage, gpus: s.gpus, trust: s.trust, cap: s.labSpace * 1000 * s.labMult,
        need: Math.round(raw / unit) * unit, infra: vis('panel-infrastructure'),
        compute: vis('panel-compute'), batch: !document.getElementById('btn-gpuBatch').disabled,
      };
    });
    await shot(p3, '12-stage2-preset');
    check('Stage 2 preset loads into a playable arrival', pre.stage === 2 && pre.infra && !pre.compute && pre.gpus === 1000 && pre.trust >= 2 && pre.cap >= pre.need && pre.batch, JSON.stringify(pre));
    await c3.close();
  }

  check('no page errors or console errors from boot through Stage 2', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  check('smoke test ran to completion', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (policy ${POLICY}, seed ${SEED}). Screenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
