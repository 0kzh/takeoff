#!/usr/bin/env node
/**
 * Stage 1 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke.mjs [--policy bot|naive] [--seed 1]
 *
 * Starts its own static server on a free port, drives the game in system Chrome (headless) with
 * `__game.setAutoplay(true)` + `__game.tick(ms)`, and checks: no page or console errors from boot
 * through the end screen; the opening (owner feedback 1: one control and one number at 0:00, the
 * first GPU at 1.5 / 2 / 4 clicks a second, numbers and controls at 0:00 / 0:30 / 1:00 / 2:00 / 3:00
 * / 5:00 with a screenshot each); reveal order and the staggered beats; the greyed goal from the
 * first purchase; no yield wording; the Train row's line at the cloud's limit; numeric-token counts at
 * minutes 0/1/3/5/10/20/end; save → reload during a training run; the end screen; the meter's
 * width at every fill; no horizontal overflow at 390 px. The Train row (a plain purchase since the
 * prologue, docs/specs/early-train.md): prices only under `Resources needed`, each named by its unit
 * with a whole bar; grey while short of its price, never armed; no research price in Stage 1. Round 3
 * (stage1-round3-fixes.md): each event's default listed first; no `… first` hold anywhere. Owner
 * feedback 2 (the core screen reads as it did at a2117b5): no delay printed beside a purchase; First
 * Datacenter a plain card before and at the wall; `Power [bar] 968 kWh` and `GPUs rented [bar] 61 / 80`;
 * three plain Focus buttons and one note line.
 * Screenshots go to agent-tools/shots/stage1/. Exits non-zero when any check fails.
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
    stage: 1,
    numbers: tokens.length,
    numbersOutside: outsideTokens.length,
    // The lab's capacity is half of the research pair (`837 / 1,000`): one reading, counted once in a beat.
    capHalves: vis(document.getElementById('researchCap')) ? 1 : 0,
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
    // Owner feedback 1: no yield anywhere. A GPU shortfall is the GPUs price's bar; at the cloud's limit
    // one line under the prices names what lifts it.
    banned: /undertrained|Train now/i.test(text),
    trainShort: vis(document.getElementById('trainGpuLine')) ? document.getElementById('trainGpus').innerText.trim() : '',
    // The Train row's price bars, when shown, are bars: one width, each fill as tall as its track.
    trainMeter: (() => {
      const bars = [...document.querySelectorAll('#trainCosts .costRow .progress')].filter(vis);
      if (!bars.length) return null;
      return {
        widths: bars.map((b) => Math.round(b.getBoundingClientRect().width)),
        trackH: Math.round(bars[0].clientHeight),
        fillH: Math.min(...bars.map((b) => Math.round(b.querySelector('.progressFill').getBoundingClientRect().height))),
      };
    })(),
    // G3 as amended: a greyed purchase on screen; in the first three minutes the next GPU or power block counts lit.
    greyed: buttons.some((b) => b.disabled && /^(btn-|proj-)/.test(b.id) && !/^btn-(task|lowerPrice|raisePrice)$/.test(b.id)),
    unitShown: ['btn-gpu', 'btn-buyPower'].some((id) => vis(document.getElementById(id))),
    // Round 3 (stage1-round3-fixes.md, the wallet rule) as amended by owner feedback 2 (the core screen
    // reads as it did at a2117b5): the Train row; no printed delays; First Datacenter a plain card; the
    // power and quota rows; three plain Focus buttons and one note; the event order.
    train: (() => {
      const b = document.getElementById('btn-train');
      if (!vis(b)) return null;
      // One line a price, named by its unit (`$75`, `100 kWh`, `10 GPUs`); what the lab holds is in the hover.
      const prices = ['funds', 'power', 'gpus']
        .filter((k) => vis(document.getElementById(`costRow-${k}`)))
        .map((k) => ({ key: k, text: document.getElementById(`costText-${k}`).innerText.trim(), fill: document.getElementById(`costBar-${k}`).getBoundingClientRect().width / document.getElementById(`costBar-${k}`).parentElement.clientWidth }));
      const funds = prices.find((p) => p.key === 'funds');
      return {
        enabled: !b.disabled, armed: b.classList.contains('armed'), label: b.innerText.trim(),
        head: document.getElementById('trainCosts').innerText.trim().split('\n')[0].trim(),
        prices,
        cost: prices.map((p) => p.text).join(', '),
        short: !!funds && s.funds < Number(funds.text.replace(/[^0-9.]/g, '')),
      };
    })(),
    delays: (text.match(/· (?:Sage-\d+(?:\.\d+)?|First Datacenter|next run) (?:\d+:\d\d|much) later/g) ?? []),
    dc: (() => {
      const card = document.getElementById('proj-p_datacenter');
      if (!card || !vis(card)) return null;
      return { text: card.innerText.trim(), meters: card.querySelectorAll('.meter').length, wall: s.flags['wallAt'] !== undefined };
    })(),
    powerLine: vis(document.getElementById('panel-power')) ? document.getElementById('panel-power').innerText.split('\n')[0] : '',
    quotaLine: vis(document.getElementById('quotaMeter')) ? document.getElementById('quotaMeter').parentElement.parentElement.innerText.split('\n')[0] : '',
    focus: vis(document.getElementById('focusRow'))
      ? {
        row: document.getElementById('focusRow').innerText.replace(/\s+/g, ' ').trim(),
        labels: ['capability', 'efficiency', 'safety'].map((f) => document.getElementById(`btn-focus-${f}`).innerText.trim()),
        note: document.getElementById('focusNote').innerText.trim(),
        running: !!s.training.run,
      }
      : null,
    held: /\b(?:the run|the plant|the hall|First Datacenter) first\b|keeps [^.]*'s price/.test(text),
    event: modal && modal.classList.contains('shown')
      ? {
        first: (document.querySelector('#modalButtons button .optLabel') ?? document.querySelector('#modalButtons button'))?.innerText.trim(),
        then: (document.getElementById('modalTimer').innerText.split('then: ')[1] ?? '').trim(),
      }
      : null,
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
    // Every bar is the training bar: its border, track, height and fill, at one width for every fill.
    const bars = await page.evaluate(() => {
      const look = (bar, fill) => {
        const b = getComputedStyle(bar);
        const f = getComputedStyle(fill);
        return [b.height, b.borderTopWidth, b.borderTopStyle, b.borderTopColor, b.backgroundColor, f.backgroundColor].join(' ');
      };
      const run = document.getElementById('runBar');
      const want = look(run.parentElement, run);
      const fillOf = (bar, cls) => bar.querySelector(`.${cls}`) ?? bar.appendChild(Object.assign(document.createElement('span'), { className: cls, probe: true }));
      const off = [];
      // The Train row's price bars took the place of its GPU meter: five of them, one a price.
      const all = [...document.querySelectorAll('.benchBar, .meter, .costRow .progress')];
      for (const bar of all) {
        const fill = fillOf(bar, bar.classList.contains('meter') ? 'meterFill' : bar.classList.contains('progress') ? 'progressFill' : 'benchFill');
        const got = look(bar, fill);
        if (got !== want) off.push(`${bar.id || bar.parentElement.id}: ${got}`);
        if (fill.probe) fill.remove();
      }
      // A copy of the power meter in a visible spot (the Power panel is hidden at 0:00), filled 0–100 %.
      const probe = document.getElementById('powerMeter').cloneNode(true);
      probe.id = 'meterProbe';
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden';
      document.getElementById('columns').appendChild(probe);
      const fill = fillOf(probe, 'meterFill');
      const widths = [];
      for (let k = 0; k <= 10; k++) {
        fill.style.width = `${k * 10}%`;
        widths.push(probe.getBoundingClientRect().width);
      }
      probe.remove();
      return { want, count: all.length, off, widths };
    });
    check('every meter, eval bar and price bar is the training bar (border, track, height, fill)', bars.count >= 12 && bars.off.length === 0,
      bars.off.length ? bars.off.join(' | ') : `${bars.count} bars: ${bars.want}`);
    const spread = Math.max(...bars.widths) - Math.min(...bars.widths);
    check('the meter is one width at every fill (0–100 %)', spread <= 1 && bars.widths[0] > 0, `${bars.widths.map((w) => w.toFixed(1)).join(' / ')} px`);
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
  // moved a few seconds after reading the line (down while it says `backlog growing`, up while it says
  // `selling out`); Marketing, researchers and project cards when affordable. Counts and a screenshot at six marks.
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
            // The prologue (docs/specs/early-train.md): Train Sage-1 when it can be pressed, Deploy when trained.
            if (s.flags['prologue'] === true) {
              if (can('btn-train') && !el('btn-train').classList.contains('armed')) el('btn-train').click();
              if (can('btn-release')) el('btn-release').click();
            }
            if (k === 9) {
              // Once a second: the price, read from the line on screen.
              const line = el('billingLine').checkVisibility() ? el('billingLine').innerText : '';
              p.grow = /backlog growing/.test(line) && s.unbilled > p.prev ? p.grow + 1 : 0;
              p.sells = /selling out/.test(line) ? p.sells + 1 : 0;
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
  // The prologue (docs/specs/early-train.md): the first GPU brings the Power panel and the Train row
  // together (`Power 1,000 kWh`, `Train Sage-1`, `Resources needed`: `$4`, `100 kWh`, `1 GPU`). Sage-1
  // costs one GPU and $4, so this player is training it at 0:30 and has deployed it before 1:00; every
  // later beat then lands sooner than in the spec's table (its player waited for two GPUs and $12): the
  // price by 1:00, Buy Power and Marketing by 2:00, Research by 3:00, five cards by 5:00 (the Grid
  // Contract comes later, at the tenth Buy Power). This player rents a GPU whenever it can and never
  // saves the $75 for Sage-1.1, so 5:00 is still the idle Train row. Limits are what the built opening measures (seeds 1–6: the same to 3:00,
  // 31–32 numbers and 14–15 controls at 5:00), not a budget the owner has set: see the reveal-order and
  // G5 checks below for one mechanic a beat.
  const targets = { 0: [1, 1], 30: [7, 2], 60: [13, 5], 120: [16, 7], 180: [21, 8], 300: [32, 15] };
  const slack = {};
  const openingRow = Object.entries(opening).map(([m, c]) => `${clock(Number(m))} ${c.numbers}/${c.controls}`).join(' · ');
  check('opening: numbers ≤ 1 / 7 / 13 / 16 / 21 / 32 and controls ≤ 1 / 2 / 5 / 7 / 8 / 15 at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00',
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
  let arrival = null;
  let bannedAt = null;
  const shortLines = new Set();
  const trainMeters = [];
  const trainRows = new Set();
  // Round 3's observations (stage1-round3-fixes.md §1–§4 and the wallet rule).
  const r3 = { armed: null, shortSeen: null, head: null, delay: null, dcBefore: null, dcWall: null, powerRow: null, powerOf: null, quotaRow: null, focusFirst: null, focusRows: new Set(), events: new Map(), heldAt: null };
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
    beats.push({ t: snap.t, newButtons, dNumbers: firstTime.length ? (snap.numbersOutside - snap.capHalves) - (prev.numbersOutside - prev.capHalves) : 0 });
    if (snap.banned && bannedAt === null) bannedAt = snap.t;
    if (snap.stage === 1 && snap.trainShort) shortLines.add(snap.trainShort);
    if (snap.stage === 1 && snap.trainMeter) trainMeters.push(snap.trainMeter);
    if (snap.stage === 1) {
      if (snap.train) {
        trainRows.add(snap.train.cost);
        if (snap.train.head !== 'Resources needed' && !r3.head) r3.head = { t: snap.t, head: snap.train.head };
        // Train is a plain purchase (owner's playtest notes): grey while short of its price, never armed.
        if (snap.train.short) r3.shortSeen ??= { t: snap.t, label: snap.train.label, cost: snap.train.cost };
        if ((snap.train.armed || (snap.train.short && snap.train.enabled)) && !r3.armed) r3.armed = { t: snap.t, ...snap.train };
      }
      if (snap.delays.length && !r3.delay) r3.delay = { t: snap.t, text: snap.delays[0] };
      if (snap.dc && !snap.dc.wall && !r3.dcBefore) r3.dcBefore = { t: snap.t, ...snap.dc };
      if (snap.dc && snap.dc.wall && !r3.dcWall) r3.dcWall = { t: snap.t, ...snap.dc };
      if (!r3.powerRow && /^Power\s+[\d,]+ kWh/.test(snap.powerLine)) r3.powerRow = { t: snap.t, line: snap.powerLine };
      if (!r3.powerOf && / of [\d,]+ kWh/.test(snap.powerLine)) r3.powerOf = { t: snap.t, line: snap.powerLine };
      if (!r3.quotaRow && snap.quotaLine) r3.quotaRow = { t: snap.t, line: snap.quotaLine };
      if (snap.focus) {
        r3.focusFirst ??= { t: snap.t, ...snap.focus };
        r3.focusRows.add(`${snap.focus.labels.join(' ')} | ${snap.focus.note}`);
      }
      if (snap.event && !r3.events.has(snap.modal)) r3.events.set(snap.modal, snap.event);
    }
    if (snap.held && r3.heldAt === null) r3.heldAt = snap.t;
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
    // The reasonable bot breaks ground at the wall (the price is three minutes of income for everyone,
    // so it can be affordable sooner); the first-timer as soon as it can.
    const atWall = POLICY !== 'bot' || await page.evaluate(() => window.__game.state.flags['wallAt'] !== undefined);
    if (snap.stage === 1 && !snap.modal && atWall && snap.buttons.some((b) => b.id === 'proj-p_datacenter' && b.enabled)) {
      await page.evaluate(() => window.__game.setAutoplay(false));
      counts['end'] = { numbers: snap.numbers, interactive: snap.interactive, words: snap.words, panels: snap.panels.length };
      await shot(page, '07b-before-break-ground');
      await page.click('#proj-p_datacenter');
      arrival = await page.evaluate(() => {
        const s = window.__game.state;
        const vis = (id) => document.getElementById(id).checkVisibility();
        return {
          t: s.stats.timePlayed,
          ending: s.ending,
          screen: vis('endingScreen'),
          title: document.getElementById('endingTitle').innerText,
          tasks: document.getElementById('endingTasks').innerText,
          rows: document.querySelectorAll('#endingStats tr').length,
          newGame: vis('btn-newGame'),
        };
      });
      transitionAt = arrival.t;
      await shot(page, '08-end-screen');
      break;
    }
    prev = snap;
    if (snap.t > MAX_MINUTES * 60) break;
  }

  check('reached the end of Stage 1', transitionAt !== null, transitionAt === null ? 'First Datacenter never bought' : `at ${clock(transitionAt)}`);
  check('save → reload was exercised', reloadDone, reloadInfo ? '' : 'no training run seen');

  // ----- reveal order and staggering -----
  const at = (id) => (first.has(id) ? first.get(id) : Infinity);
  // The prologue (docs/specs/early-train.md): Power and Training arrive together with the first GPU.
  const order = ['panel-business', 'panel-compute', 'panel-power', 'panel-training', 'panel-research', 'panel-projects', 'focusRow'];
  const times = order.map(at);
  const inOrder = times.every((t, i) => t !== Infinity && (i === 0 || t >= times[i - 1])) && at('panel-power') === at('panel-training') && at('panel-research') > at('panel-training');
  check('reveal order: Business → Compute → Power and Training together → Research → Projects → Focus', inOrder, order.map((id, i) => `${id.replace('panel-', '')} ${times[i] === Infinity ? '—' : clock(times[i])}`).join(', '));
  check('Research arrives with Trust and Hire Researcher only (Expand Lab later)', at('btn-expandLab') > at('panel-research') && at('btn-hireResearcher') === at('panel-research'), `research ${clock(at('panel-research'))}, expand ${clock(at('btn-expandLab'))}`);
  check('Projects arrive 30–60 s after Research', at('panel-projects') - at('panel-research') >= 30 && at('panel-projects') - at('panel-research') <= 62, `${Math.round(at('panel-projects') - at('panel-research'))} s`);
  check('Focus row hidden during the first training run', at('focusRow') > at('train-running'), `first run ${clock(at('train-running'))}, focus ${clock(at('focusRow'))}`);
  // G3 as amended by owner feedback 1: from the first purchase on, a greyed goal stays on screen.
  const goalShare = goal.ticks ? goal.ok / goal.ticks : 0;
  check('G3: a greyed goal on screen ≥ 99 % of Stage 1 from the first purchase (the next GPU or power block counts in the first 3 min)',
    goalShare >= 0.99, `${(goalShare * 100).toFixed(1)} % of ${goal.ticks} snapshots from ${firstPurchase === null ? '—' : clock(firstPurchase)}${goal.misses.length ? `; none at ${goal.misses.join(', ')}` : ''}`);
  // G5 as amended: the first five minutes add at most 4 numbers and 2 controls a beat; later, 8 and 3.
  // Research prints its capacity beside the amount (owner, 2026-10-04); the pair counts as one number.
  // The first-GPU beat (Power and the Train row together, docs/specs/early-train.md) is checked on its own.
  const gpuBeat = beats.find((b) => b.t === at('panel-training'));
  check('the first-GPU beat adds the Power panel and the Train row: one control', !!gpuBeat && gpuBeat.newButtons.length <= 1 && gpuBeat.dNumbers <= 9,
    gpuBeat ? `${clock(gpuBeat.t)}: ${gpuBeat.newButtons.join(', ')}, +${gpuBeat.dNumbers} numbers` : 'not seen');
  // Anthrosoft arrives as a dialog (`A Rival Lab`), the first event, a minute after the first release:
  // its row is not on the Training panel before then.
  check('Anthrosoft\'s row appears with its dialog, after the Focus row, not with the Training panel',
    at('rivalLine') !== Infinity && at('rivalLine') >= at('focusRow') + 20 && Math.abs(at('rivalLine') - at('modal:A Rival Lab')) <= STEP_MS / 1000,
    `model lines ${clock(at('modelName'))}, focus ${clock(at('focusRow'))}, Anthrosoft ${at('rivalLine') === Infinity ? 'never' : clock(at('rivalLine'))}, dialog ${at('modal:A Rival Lab') === Infinity ? 'never' : clock(at('modal:A Rival Lab'))}`);
  // Deploying Sage-1 turns the Train row into the full panel (`Current model: Sage-1`,
  // `Train Sage-1.1  Cost: $75`, its GPU line): checked on its own as well.
  const deployBeat = beats.find((b) => b.t === at('modelName'));
  check('the deploy beat redraws the Training panel and adds no control', !!deployBeat && deployBeat.newButtons.length === 0 && deployBeat.dNumbers <= 6,
    deployBeat ? `${clock(deployBeat.t)}: +${deployBeat.dNumbers} numbers` : 'not seen');
  const early = beats.filter((b) => b.t <= 300 && b !== gpuBeat && b !== deployBeat);
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
  // The opening's beats (power, Buy Power, the price, Marketing, Research) at least 30 s apart (2-s
  // snapshots). Power comes first; the price, Marketing and Research follow in that order. Buy Power
  // waits for the store to fall to 800 kWh and the price for the deploy (engine/stages.ts), so either
  // may come first: the prologue run draws 100 kWh, and the price usually wins.
  const beatIds = ['panel-power', 'btn-buyPower', 'btn-lowerPrice', 'btn-marketing', 'panel-research'];
  const beatTimes = beatIds.map(at);
  const sortedBeats = [...beatTimes].sort((x, y) => x - y);
  const chain = ['panel-power', 'btn-lowerPrice', 'btn-marketing', 'panel-research'].map(at);
  const spaced = beatTimes.every((x) => x !== Infinity) && sortedBeats.every((x, i) => i === 0 || x - sortedBeats[i - 1] >= 28) &&
    chain.every((x, i) => i === 0 || x > chain[i - 1]) && at('btn-buyPower') > at('panel-power');
  check('opening beats arrive ≥ 30 s apart: power first, then the price → Marketing → Research, with Buy Power among them', spaced, beatIds.map((id, i) => `${id.replace(/^(panel|btn)-/, '')} ${beatTimes[i] === Infinity ? '—' : clock(beatTimes[i])}`).join(', '));
  check('no "undertrained" and no "Train now" anywhere on screen', bannedAt === null, bannedAt === null ? '' : `seen at ${clock(bannedAt)}`);
  // The GPUs are a price with a bar (`10 GPUs`); the line under the prices is only for the cloud's limit,
  // which a bar cannot explain.
  const lines = [...shortLines];
  const okLine = (l) => /^The cloud rents [\d,]+\.( .+ adds 20\.)?$/.test(l) ||
    /^The cloud will rent [\d,]+\. Build the First Datacenter\.$/.test(l);
  // A first-timer may never reach the cloud's limit: the test breaks ground before the wall.
  check('a Train the cloud cannot rent enough GPUs for names the limit and what lifts it', (lines.length > 0 || POLICY !== 'bot') && lines.every(okLine),
    lines.length ? lines.slice(0, 4).join(' | ') : 'never at the limit in this run');
  const barsOk = (m) => m.widths.every((w) => w === m.widths[0]) && m.widths[0] > 0 && m.fillH >= 10 && m.fillH === m.trackH;
  const badBar = trainMeters.find((m) => !barsOk(m));
  check('the Train row\'s price bars are whole bars (one width, each fill as tall as its track)',
    trainMeters.length > 0 && !badBar,
    badBar ? `widths ${badBar.widths.join(' / ')} px, fill ${badBar.fillH} px in a ${badBar.trackH} px track`
      : trainMeters.length ? `${trainMeters[0].widths[0]} px wide, fill ${trainMeters[0].fillH} px tall` : 'never shown');

  // ----- round 3: a run costs money and GPUs (stage1-round3-fixes.md §1–§4); Train is a plain purchase -----
  const rows = [...trainRows];
  check('the Stage 1 Train row has no research price', rows.length > 0 && rows.every((r) => !/research/i.test(r)),
    rows.slice(0, 3).join(' || '));
  const okPrices = (r) => /^\$[\d,.]+(, [\d,]+ kWh)?, (1 GPU|(?!1 )[\d,]+ GPUs)$/.test(r);
  const badRow = rows.find((r) => !okPrices(r));
  check('the Train row lists prices only, each named by its unit (`$75` · `100 kWh` · `10 GPUs`, one GPU as `1 GPU`), under `Resources needed`',
    rows.length > 0 && !badRow && !r3.head,
    badRow ? `"${badRow}"` : r3.head ? `${clock(r3.head.t)} headed "${r3.head.head}"` : rows.slice(0, 3).join(' || '));
  check('Train is a plain purchase: grey while short of its price, never armed',
    !r3.armed && (!!r3.shortSeen || POLICY !== 'bot'),
    r3.armed ? `${clock(r3.armed.t)} ${r3.armed.label}: ${r3.armed.cost} lit or armed while short`
      : r3.shortSeen ? `${clock(r3.shortSeen.t)} ${r3.shortSeen.label} grey at ${r3.shortSeen.cost}` : 'never short in this run');
  // Owner feedback 2: the core screen reads as it did at a2117b5.
  check('no purchase prints a delay beside it (no `· Sage-1.x 0:41 later` anywhere)', !r3.delay,
    r3.delay ? `${clock(r3.delay.t)} ${r3.delay.text}` : '');
  const plainCard = (d) => /^First Datacenter \(\$[\d,]+\)\s+1,000 GPUs of our own at Abilene\. Stop renting\.$/.test(d.text) && d.meters === 0;
  const dcb = r3.dcBefore;
  check('First Datacenter is a plain card before the wall: its title and price, its sentence, nothing else',
    !!dcb && plainCard(dcb), dcb ? `${clock(dcb.t)} ${dcb.text.replace(/\s+/g, ' ')}` : 'card never seen before the wall');
  const dcw = r3.dcWall;
  // A first-timer may buy the card before the wall (the test clicks it as soon as it can).
  check('First Datacenter is the same plain card at the wall', dcw ? plainCard(dcw) : POLICY !== 'bot',
    dcw ? `${clock(dcw.t)} ${dcw.text.replace(/\s+/g, ' ')}` : 'no wall in this run');
  check('the power row is its bar and the amount (`Power 968 kWh`); the quota reads `61 / 80` beside its bar',
    !!r3.powerRow && !r3.powerOf && !!r3.quotaRow && /^GPUs rented\s+[\d,]+ \/ [\d,]+$/.test(r3.quotaRow.line.trim()),
    `${r3.powerRow ? `${clock(r3.powerRow.t)} "${r3.powerRow.line}"` : 'power: none'}${r3.powerOf ? ` (but "${r3.powerOf.line}")` : ''} · ${r3.quotaRow ? `${clock(r3.quotaRow.t)} "${r3.quotaRow.line}"` : 'quota: none'}`);
  const ff = r3.focusFirst;
  const focusNotes = ['The most capable next model (about +12%).', 'Copies per GPU ×1.25; a smaller capability gain.', 'Fewer red-team issues, now and on every later run.'];
  check('Focus is three plain buttons and one note line under them, and reads `Focus:` during a run',
    !!ff && /^Focus: Capability Efficiency Safety /.test(ff.row) && ff.labels.join(' ') === 'Capability Efficiency Safety' &&
      [...r3.focusRows].every((r) => r.startsWith('Capability Efficiency Safety | ') && focusNotes.includes(r.split(' | ')[1])),
    ff ? `${clock(ff.t)} ${ff.row}` : 'never shown');
  const evs = [...r3.events.entries()];
  check('every event lists the timer\'s default first', evs.length > 0 && evs.every(([, e]) => e.then && e.first === e.then),
    evs.map(([title, e]) => `${title}: ${e.first}${e.first === e.then ? '' : ` (default ${e.then})`}`).join(' · '));
  check('nothing is held for the player: no `… first` or `keeps …\'s price` anywhere', r3.heldAt === null, r3.heldAt === null ? '' : `seen at ${clock(r3.heldAt)}`);

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
  // A stage that ends before minute 20 has no minute-20 mark.
  const due = keys.filter((k) => k === 'end' || transitionAt === null || Number(k) * 60 <= transitionAt);
  check('numeric tokens recorded at 0/1/3/5/10/20/end (each mark the stage reached)', due.every((k) => counts[k]), `numbers ${row}; controls ${irow}; words ${wrow}`);
  // Critic round 2 §6.1 set minute 10 at ≤ 38 numbers, ≤ 15 controls, ≤ 230 words (the build before
  // round 3 measured 35 / 15 / 231). Round 3 adds what the spec puts on that screen: all three Focus
  // trades (5 numbers), the power and quota capacities (2), the printed delays while a run waits (2 a
  // row), the armed Train row's model name (1): 48 / 16 / 250. With Sage-1 trained in the opening
  // (docs/specs/early-train.md) minute 10 is a run further along: the Focus row and a fifth card, 18.
  const m10 = counts['10'];
  check('minute 10: ≤ 48 numbers, ≤ 18 controls, ≤ 250 words', !!m10 && m10.numbers <= 48 && m10.interactive <= 18 && m10.words <= 250,
    m10 ? `${m10.numbers} numbers, ${m10.interactive} controls, ${m10.words} words` : 'no minute-10 snapshot');
  const paperclips = { 0: 10, 1: 12, 3: 15, 5: 30, 10: 26, 20: 29, end: 49 };
  // Round 3's additions above, and First Datacenter's two status lines from the third release (five
  // numbers; minute 20 is at the wall for the bot, with every side card up): + 14 (was + 6).
  const over = keys.filter((k) => counts[k] && counts[k].numbers > paperclips[k] * 1.6 + 14);
  check('numeric tokens stay near the Paperclips curve (≤ 1.6× + 14)', over.length === 0, over.length ? `over at ${over.join(', ')}` : 'Paperclips 10 / 12 / 15 / 30 / 26 / 29 / 49');

  // ----- the end screen -----
  if (arrival) {
    check('buying First Datacenter ends the game on its end screen', arrival.ending === 'datacenter' && arrival.screen && arrival.title === 'The First Datacenter' && arrival.rows >= 5 && arrival.newGame,
      JSON.stringify(arrival));
  } else {
    check('end screen observed', false, 'First Datacenter never bought');
  }

  // ----- 390 px -----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__game.tick(100));
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await shot(page, '10-mobile-390-end', { fullPage: true });
  check('390 px wide (end screen): no horizontal overflow', overflow.sw <= overflow.cw, `${overflow.sw} vs ${overflow.cw}`);
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
    // The dev overlay's Stage 1 end preset loads, shows First Datacenter, and buying it ends the game.
    const c3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p3 = await c3.newPage();
    watch(p3, 'preset');
    await p3.goto(`${BASE}?seed=${SEED}&speed=0&dev=1`);
    await p3.waitForFunction(() => !!window.__game);
    const pre = await p3.evaluate(() => {
      window.__game.setSpeed(0);
      window.__game.loadPreset('end');
      window.__game.tick(8000);
      const s = window.__game.state;
      return { ending: s.ending, card: !!document.getElementById('proj-p_datacenter'), tasks: s.tasks };
    });
    await shot(p3, '12-end-preset');
    check('the Stage 1 end preset loads with First Datacenter on the board', pre.ending === '' && pre.card && pre.tasks > 200000, JSON.stringify(pre));
    await c3.close();
  }

  check('no page errors or console errors from boot through the end screen', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  check('smoke test ran to completion', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (policy ${POLICY}, seed ${SEED}). Screenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
