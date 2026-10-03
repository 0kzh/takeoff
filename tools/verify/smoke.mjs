#!/usr/bin/env node
/**
 * Stage 1 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke.mjs [--policy bot|naive] [--seed 1]
 *
 * Starts its own static server on a free port, drives the game in system Chrome (headless) with
 * `__game.setAutoplay(true)` + `__game.tick(ms)`, and checks: no page or console errors from boot
 * through the Stage 2 arrival; the minute-0 screen; the opening price decision; reveal order and
 * the staggered reveals; numeric-token counts at minutes 0/1/3/5/10/20/end; save → reload during a
 * training run; the transition narration; no horizontal overflow at 390 px. Screenshots go to
 * agent-tools/shots/stage1/. Exits non-zero when any check fails.
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
  const buttons = [...document.querySelectorAll('button')].filter((b) => !b.closest('#dev') && vis(b));
  const panels = [...document.querySelectorAll('.panel')].filter((p) => vis(p) && p.querySelector(':scope > b'));
  const modal = document.getElementById('modalOverlay');
  const s = window.__game.state;
  return {
    t: s.stats.timePlayed,
    stage: s.stage,
    numbers: tokens.length,
    interactive: buttons.length,
    panels: panels.map((p) => p.id),
    buttons: buttons.map((b) => ({ id: b.id, enabled: !b.disabled, label: b.innerText.trim().split('\n')[0] })),
    visibleIds: [...document.querySelectorAll('[id]')].filter((el) => !el.closest('#dev') && vis(el)).map((el) => el.id),
    modal: modal && modal.classList.contains('shown') ? document.getElementById('modalTitle').innerText : '',
    console: [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean),
    run: s.training.run ? { phase: s.training.run.phase, name: s.training.run.name, elapsed: s.training.run.elapsed } : null,
    releases: s.stats.publicReleases,
    trainings: s.stats.trainings,
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
  await page.goto(`${BASE}?seed=${SEED}`);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.setSpeed(0));
  return { context, page };
}

try {
  // ===== 1. Minute 0 =====
  {
    const { context, page } = await freshPage('minute0');
    const snap = await page.evaluate(SNAPSHOT);
    const enabled = snap.buttons.filter((b) => b.enabled).map((b) => b.id);
    const greyed = snap.buttons.filter((b) => !b.enabled).map((b) => b.id);
    check('minute 0: one enabled button (Complete Task)', enabled.length === 1 && enabled[0] === 'btn-task', enabled.join(', '));
    check('minute 0: a greyed purchase with its price (Buy Power)', greyed.includes('btn-buyPower'), greyed.join(', '));
    const text = await page.evaluate(() => document.body.innerText);
    check('minute 0: Power 1,000 kWh and a $20 block on screen', /Power: 1,000 kWh/.test(text) && /\$ 20\.00/.test(text));
    await shot(page, '00-minute0');

    // The opening price decision: click at 4/s at the starting price, then lower it.
    let gpuAffordableAt = null;
    let snap30 = null;
    for (let i = 1; i <= 160; i++) {
      const r = await page.evaluate(() => {
        document.getElementById('btn-task').click();
        window.__game.tick(250);
        const gpu = document.getElementById('btn-gpu');
        return { t: window.__game.state.stats.timePlayed, gpuOk: gpu.checkVisibility() && !gpu.disabled };
      });
      if (r.gpuOk && gpuAffordableAt === null) gpuAffordableAt = r.t;
      if (i === 120) {
        snap30 = await page.evaluate(() => ({
          unbilled: window.__game.state.unbilled,
          state: document.getElementById('marketState').innerText,
          line: document.getElementById('billingLine').innerText,
        }));
        await shot(page, '01-opening-backlog');
      }
    }
    check('first GPU affordable by 0:20 (4 clicks/s, opening price)', gpuAffordableAt !== null && gpuAffordableAt <= 20, `at ${gpuAffordableAt === null ? 'never' : clock(gpuAffordableAt)}`);
    check('0:30 at the opening price: backlog visibly growing', snap30.unbilled >= 30 && snap30.state === 'backlog growing', `${snap30.line}; unbilled ${snap30.unbilled}`);
    const after = await page.evaluate(() => {
      for (let i = 0; i < 9; i++) document.getElementById('btn-lowerPrice').click();
      for (let i = 0; i < 40; i++) {
        document.getElementById('btn-task').click();
        window.__game.tick(250);
      }
      return { state: document.getElementById('marketState').innerText, line: document.getElementById('billingLine').innerText, price: window.__game.state.price };
    });
    check('lowering the price fixes the backlog', after.state === 'selling out' || after.state === 'backlog shrinking', `$${after.price.toFixed(2)}: ${after.line}`);
    await context.close();
  }

  // ===== 2. A full Stage 1 under autoplay =====
  const { context, page } = await freshPage('stage1');
  // The policy plays, but leaves Break ground to the test so the arrival can be inspected.
  await page.evaluate((p) => window.__game.setAutoplay(true, p, true), POLICY);
  const first = new Map(); // element id / modal title → first time visible
  const counts = {};
  const countAt = [0, 1, 3, 5, 10, 20];
  const beats = []; // per-snapshot newly visible interactive elements and numbers
  let prev = await page.evaluate(SNAPSHOT);
  counts['0'] = { numbers: prev.numbers, interactive: prev.interactive, panels: prev.panels.length };
  for (const id of prev.visibleIds) first.set(id, 0);
  let reloadDone = false;
  let reloadInfo = null;
  let transitionAt = null;
  let narration = null;
  let arrival = null;
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
    beats.push({ t: snap.t, newButtons, dNumbers: firstTime.length ? snap.numbers - prev.numbers : 0 });

    for (const m of countAt) {
      if (m > 0 && counts[String(m)] === undefined && snap.t >= m * 60) {
        counts[String(m)] = { numbers: snap.numbers, interactive: snap.interactive, panels: snap.panels.length };
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
      counts['end'] = { numbers: snap.numbers, interactive: snap.interactive, panels: snap.panels.length };
      await shot(page, '07b-before-break-ground');
      const consoleBefore = snap.console;
      await page.click('#proj-p_datacenter');
      arrival = await page.evaluate(() => {
        const s = window.__game.state;
        const vis = (id) => document.getElementById(id).checkVisibility();
        const infraEnabled = ['btn-datacenter', 'btn-gpuBatch', 'btn-turbines'].filter((id) => vis(id) && !document.getElementById(id).disabled);
        const cap = s.labSpace * 1000 * s.labMult;
        const need = Math.round(21000 * Math.pow(Math.max(s.capability, s.training.internalCapability) / 1.6, 5));
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
  const order = ['panel-business', 'panel-compute', 'panel-research', 'panel-projects', 'panel-training', 'focusRow', 'panel-site', 'panel-infrastructure'];
  const times = order.map(at);
  const inOrder = times.every((t, i) => t !== Infinity && (i === 0 || t >= times[i - 1]));
  check('reveal order: Business → Compute → Research → Projects → Training → Focus → Abilene → Infrastructure', inOrder, order.map((id, i) => `${id.replace('panel-', '')} ${times[i] === Infinity ? '—' : clock(times[i])}`).join(', '));
  check('Research arrives with Trust and Hire Researcher only (Expand Lab later)', at('btn-expandLab') > at('panel-research') && at('btn-hireResearcher') === at('panel-research'), `research ${clock(at('panel-research'))}, expand ${clock(at('btn-expandLab'))}`);
  check('Projects arrive 30–60 s after Research', at('panel-projects') - at('panel-research') >= 30 && at('panel-projects') - at('panel-research') <= 62, `${Math.round(at('panel-projects') - at('panel-research'))} s`);
  check('Focus row hidden during the first training run', at('focusRow') > at('train-running'), `first run ${clock(at('train-running'))}, focus ${clock(at('focusRow'))}`);
  const greyedFromStart = at('btn-buyPower') === 0;
  check('a greyed goal is on screen from second 0', greyedFromStart);
  const maxNewButtons = Math.max(...beats.map((b) => b.newButtons.length));
  const worstBeat = beats.find((b) => b.newButtons.length === maxNewButtons);
  check('no beat adds more than 3 interactive elements', maxNewButtons <= 3, `max ${maxNewButtons} at ${clock(worstBeat.t)} (${worstBeat.newButtons.join(', ')})`);
  const maxNumbers = Math.max(...beats.map((b) => b.dNumbers));
  check('no beat adds more than ~8 numbers', maxNumbers <= 8, `max +${maxNumbers} at ${clock(beats.find((b) => b.dNumbers === maxNumbers).t)}`);

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
  check('numeric tokens recorded at 0/1/3/5/10/20/end', keys.every((k) => counts[k]), `numbers ${row}; interactive ${irow}`);
  const paperclips = { 0: 10, 1: 12, 3: 15, 5: 30, 10: 26, 20: 29, end: 49 };
  const over = keys.filter((k) => counts[k] && counts[k].numbers > paperclips[k] * 1.6 + 6);
  check('numeric tokens stay near the Paperclips curve (≤ 1.6× + 6)', over.length === 0, over.length ? `over at ${over.join(', ')}` : 'Paperclips 10 / 12 / 15 / 30 / 26 / 29 / 49');

  // ----- transition narration -----
  if (narration) {
    const f0 = narration.frames[0];
    const kept = narration.consoleBefore.filter((l) => f0.includes(l)).length;
    check('transition keeps earlier console lines (no wipe)', f0.length >= 4 && kept >= 3, `${kept} earlier lines kept; first frame ${f0.length} lines`);
    check('"Ground broken outside Abilene." is on screen', narration.frames.some((f) => f.some((l) => l.startsWith('Ground broken outside Abilene.'))));
    const all = narration.frames.flat();
    const lost = all.find((l) => /rented GPUs go back/.test(l));
    const replaced = all.find((l) => /Power is bought in megawatts now/.test(l));
    const means = all.find((l) => /Tasks per second ×/.test(l));
    const firstIdx = (re) => narration.frames.findIndex((f) => f.some((l) => re.test(l)));
    const i1 = firstIdx(/rented GPUs go back/);
    const i2 = firstIdx(/Power is bought in megawatts now/);
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
    await p3.goto(`${BASE}?seed=${SEED}&dev=1`);
    await p3.waitForFunction(() => !!window.__game);
    const pre = await p3.evaluate(() => {
      window.__game.setSpeed(0);
      window.__game.loadPreset(2);
      window.__game.tick(8000);
      const s = window.__game.state;
      const vis = (id) => document.getElementById(id).checkVisibility();
      return {
        stage: s.stage, gpus: s.gpus, trust: s.trust, cap: s.labSpace * 1000 * s.labMult,
        need: Math.round(21000 * Math.pow(Math.max(s.capability, s.training.internalCapability) / 1.6, 5)), infra: vis('panel-infrastructure'),
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
