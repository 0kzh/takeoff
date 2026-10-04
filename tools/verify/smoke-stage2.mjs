#!/usr/bin/env node
/**
 * Stage 2 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke-stage2.mjs [--policy bot|naive] [--seed 1]
 *
 * Starts its own static server on a free port, loads the Stage 2 preset in system Chrome
 * (headless) and plays it with `__game.setAutoplay(true)` + `__game.tick(ms)` through the Stage 3
 * arrival. Checks: no page or console errors; the arrival narration (five lines, held whole for
 * 10 s), revenue rising, no Stage 1 diagnosis line; the Stores rows and a hover breakdown; the
 * capability graph drawn; every Stage 2 panel appears; the event panel (two-line options, focus,
 * click-through, Escape takes the default); reload mid-run, mid-queue and mid-cooldown restore
 * their timers; numeric tokens, controls and words on screen at each 5-minute mark against
 * stage2.md §6.3; owner feedback 1 (no yield wording, the Stores meters, the Train row's GPU
 * shortfall); the Stage 3 narration and a usable dev overlay; no horizontal overflow at 390 px.
 * Screenshots go to agent-tools/shots/stage2/. Exits non-zero when any check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = join(ROOT, 'agent-tools/shots/stage2');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const POLICY = argOf('--policy', 'bot');
const SEED = Number(argOf('--seed', '1'));
const STEP_MS = 2000;
const MAX_MINUTES = 60;
/**
 * On-screen budget at the 5-minute marks, against the reference (critic Stage 2 round 1, §2e/§3c):
 * Paperclips' Stage 2 shows 39 / 54 numbers at 5:00 / 10:00 (its early stage is nearly empty, while
 * Takeoff carries the Stage 1 screen, so +16) and 66–83 at the marks from 15:00 (76 at 20:00, 61 at its
 * end), so 60 / 70 and then 80. Controls stay at 30 (stage2.md §6.3).
 */
const BUDGET = { numbers: 80, interactive: 30 };
/** stage2-round2-fixes.md item 7: numbers on screen ≤ 80 at every five-minute mark (the build share and capacity rows added theirs). */
const numbersAllowed = () => BUDGET.numbers;
/** The wallet rule (arc G34): no row is held back with a `… first` or `keeps …'s price` reason. */
const HOLD_WORDS = /\b(the run|the plant|the hall|the offer|the reactor) first\b|keeps [^.]*'s price/;

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

/** What a player sees: numbers, controls and words outside the dev overlay; the console; timers. */
const SNAPSHOT = () => {
  const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const text = [...document.body.children]
    .filter((el) => el.id !== 'dev' && vis(el))
    .map((el) => el.innerText)
    .join('\n');
  // stage2.md §6.3's counting rule: numeric tokens in panels and the header, excluding the console,
  // the Developments log and modals (the canvas has no DOM text).
  const counted = [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
    .filter((el) => el.id !== 'panel-log' && vis(el) && !el.parentElement.closest('.panel'))
    .map((el) => el.innerText)
    .join('\n');
  const tokens = counted.match(/\d+(?:[.,:]\d+)*/g) ?? [];
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const controls = [...document.querySelectorAll('button, input')].filter((b) => !b.closest('#dev') && vis(b));
  const panels = [...document.querySelectorAll('.panel')].filter((p) => vis(p)).map((p) => p.id);
  const modal = document.getElementById('modalOverlay');
  const s = window.__game.state;
  const run = s.training.run ?? s.training.pending;
  return {
    t: s.stats.timePlayed,
    stage: s.stage,
    numbers: tokens.length,
    interactive: controls.length,
    words: words.length,
    panels,
    modal: modal && modal.classList.contains('shown') ? document.getElementById('modalTitle').innerText : '',
    modalId: s.activeChoice ? s.activeChoice.id : '',
    console: [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean),
    run: run ? { id: run.id, phase: run.phase, elapsed: run.elapsed, duration: run.duration } : null,
    queue: s.powerQueue.map((o) => ({ kind: o.kind, remaining: o.remaining })),
    cooldown: s.training.cooldown,
    releaseWait: s.training.releaseWait,
    redTeam: s.training.redTeamRemaining,
    revPerSec: s.stats.revPerSec,
    unbilled: s.unbilled,
    revealed: Object.keys(s.revealed).filter((k) => s.revealed[k]),
    // Owner feedback 1: no yield wording; the Train row names a GPU shortfall; the Stores meters.
    banned: /undertrained|Train now/i.test(text),
    trainShort: vis(document.getElementById('trainGpuMeter')) ? document.getElementById('trainGpus').innerText : '',
    gpuRow: vis(document.getElementById('row-gpus')) ? document.getElementById('row-gpus').innerText : '',
    powerRow: vis(document.getElementById('row-power')) ? document.getElementById('row-power').innerText : '',
  };
};

/** Numeric tokens per visible top-level block (the `--dump` flag). */
const DUMP_TOKENS = () => [...document.body.children, ...document.querySelectorAll('.panel')]
  .filter((el) => el.id !== 'dev' && el.id !== 'columns' && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }))
  .map((el) => `${el.id}:${(el.innerText.match(/\d+(?:[.,:]\d+)*/g) ?? []).join(' ')}`)
  .filter((x) => !x.endsWith(':'))
  .join(' | ');

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

/** Saves, reloads, and returns the state's value before and after (the clock is stopped). */
async function reloadAndCompare(page, read) {
  const before = await page.evaluate(read);
  await page.evaluate(() => window.__game.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate((p) => {
    window.__game.setSpeed(0);
    window.__game.setAutoplay(true, p);
  }, POLICY);
  const after = await page.evaluate(read);
  return { before, after };
}

const STAGE1_LINES = /Nobody buys at|Lower the price|Billing lags production|Hire a researcher or expand the lab|Expand Lab to hold more/;
const PANELS = ['panel-infrastructure', 'panel-stores', 'panel-graph', 'panel-security', 'panel-government', 'panel-public', 'panel-stats'];

try {
  const { context, page } = await freshPage('stage2');
  await page.evaluate(() => window.__game.loadPreset(2));
  const revenueBefore = await page.evaluate(() => window.__game.state.stats.revPerSec);

  // ===== 1. Arrival: five lines, held whole for 10 s; revenue up; no backlog =====
  const narration = [
    'First Datacenter online outside Abilene.',
    'rented GPUs go back',
    'power is bought in megawatts now.',
    'Tasks per second',
    'Half of income builds from here',
  ];
  let wholeAt = null;
  let heldUntil = null;
  let maxUnbilled = 0;
  for (let i = 1; i <= 40; i++) {
    const snap = await page.evaluate((ms) => {
      window.__game.tick(ms);
      const s = window.__game.state;
      return { t: s.stats.timePlayed, console: [5, 4, 3, 2, 1].map((k) => document.getElementById(`readout${k}`).innerText), unbilled: s.unbilled, made: s.stats.tasksPerSec };
    }, 500);
    maxUnbilled = Math.max(maxUnbilled, snap.unbilled);
    const whole = narration.every((line, k) => (snap.console[k] ?? '').includes(line));
    if (whole && wholeAt === null) wholeAt = i * 0.5;
    if (whole) heldUntil = i * 0.5;
    if (i === 6) await shot(page, '00-arrival');
  }
  check('arrival: the five narration lines appear in order', wholeAt !== null, wholeAt ? `whole at +${wholeAt} s` : 'never whole');
  check('arrival: the narration stays whole for ≥ 10 s', wholeAt !== null && heldUntil - wholeAt >= 10, wholeAt ? `+${wholeAt}–${heldUntil} s` : '');
  const after = await page.evaluate(() => {
    window.__game.tick(10000);
    return { rev: window.__game.state.stats.revPerSec, unbilled: window.__game.state.unbilled, made: window.__game.state.stats.tasksPerSec };
  });
  check('arrival: revenue 30 s in is above revenue before Break ground', after.rev > revenueBefore, `$${Math.round(revenueBefore)}/s → $${Math.round(after.rev)}/s`);
  check('arrival: no backlog balloons (≤ 10 s of output)', maxUnbilled <= 10 * Math.max(1, after.made), `max unbilled ${Math.round(maxUnbilled)}, output ${Math.round(after.made)}/s`);

  // ===== 2. Stores: rows and a hover breakdown =====
  const rows = await page.evaluate(() => [...document.querySelectorAll('#panel-stores .storeRow')].filter((r) => r.checkVisibility()).map((r) => r.id));
  check('Stores: funds, research and GPUs rows on screen', ['row-funds', 'row-research', 'row-gpus'].every((id) => rows.includes(id)), rows.join(', '));
  await page.hover('#row-funds');
  await page.evaluate(() => window.__game.tick(200));
  const tip = await page.evaluate(() => {
    const t = document.getElementById('storeTip');
    return { open: t.classList.contains('open') && t.checkVisibility(), rows: t.querySelectorAll('.tipRow').length, text: t.innerText };
  });
  check('Stores: hovering funds shows a breakdown with a total', tip.open && tip.rows >= 2 && /total/.test(tip.text), tip.text.replace(/\n/g, ' | '));
  await shot(page, '01-stores-hover');
  await page.mouse.move(5, 5);

  // ===== 3. Stage 2 under autoplay =====
  await page.evaluate((p) => window.__game.setAutoplay(true, p), POLICY);
  const t0 = await page.evaluate(() => window.__game.state.stats.timePlayed);
  const marks = [];
  let nextMark = 300;
  const panelsSeen = new Set();
  let stage1Line = '';
  let modalChecked = null;
  const reloads = { run: null, queue: null, cooldown: null };
  let graphDrawn = false;
  let stage3 = null;
  let bannedAt = null;
  const shortLines = new Set();
  const meterRows = { gpu: '', power: '' };
  const wallet = { hold: [], share: false, fund: false, armed: '', delay: '', capacity: '', greyMarks: [] };
  for (let step = 0; step < (MAX_MINUTES * 60 * 1000) / STEP_MS; step++) {
    const snap = await page.evaluate((ms) => {
      window.__game.tick(ms);
      return null;
    }, STEP_MS).then(() => page.evaluate(SNAPSHOT));
    const ts = snap.t - t0;
    for (const p of snap.panels) panelsSeen.add(p);
    const bad = snap.console.find((l) => STAGE1_LINES.test(l));
    if (bad && !stage1Line) stage1Line = `${clock(ts)} ${bad}`;
    if (snap.banned && bannedAt === null) bannedAt = ts;
    if (snap.stage === 2 && snap.trainShort) shortLines.add(snap.trainShort);
    if (snap.stage === 2 && !meterRows.gpu && snap.gpuRow) meterRows.gpu = snap.gpuRow;
    if (snap.stage === 2 && !meterRows.power && snap.powerRow) meterRows.power = snap.powerRow;
    if (snap.stage === 2) {
      const w = await page.evaluate(() => {
        const vis = (el) => !!el && el.checkVisibility();
        const text = [...document.querySelectorAll('#columns .panel')].filter(vis).map((el) => el.innerText).join('\n');
        const train = document.getElementById('btn-train');
        return {
          text,
          share: vis(document.getElementById('buildShareRow')),
          fund: vis(document.getElementById('row-buildFund')),
          armed: train.classList.contains('armed') ? document.getElementById('trainReason').innerText : '',
          delay: [...document.querySelectorAll('#projectList .projectButton')].filter(vis).map((b) => b.querySelector('.projectTitle').innerText).find((x) => / later$/.test(x)) ?? '',
          capacity: document.getElementById('row-gpus').innerText.replace(/\s+/g, ' '),
        };
      });
      const hold = w.text.match(HOLD_WORDS);
      if (hold && wallet.hold.length < 3) wallet.hold.push(`${clock(ts)}: ${hold[0]}`);
      wallet.share ||= w.share;
      wallet.fund ||= w.fund;
      if (!wallet.armed && w.armed) wallet.armed = w.armed;
      if (!wallet.delay && w.delay) wallet.delay = w.delay;
      if (!wallet.capacity && /[\d,]+ of [\d,]+/.test(w.capacity)) wallet.capacity = w.capacity;
    }

    // The event panel, on the first timed modal: two lines per option, focus inside, the page
    // behind still clickable, Escape takes the default.
    if (!modalChecked && snap.modalId && snap.stage === 2) {
      const info = await page.evaluate(() => {
        const s = window.__game.state;
        const def = window.__game.events && s.activeChoice ? s.activeChoice : null;
        const modal = document.getElementById('modal');
        const box = modal.getBoundingClientRect();
        const buttons = [...modal.querySelectorAll('button.modalButton')];
        const lines = buttons.map((b) => (b.querySelector('.optLine')?.textContent ?? '').trim());
        // A point on the page outside the event panel: what does a click there land on?
        const x = box.left > 60 ? 20 : Math.min(window.innerWidth - 20, box.right + 20);
        const y = Math.min(window.innerHeight - 20, box.bottom + 40);
        const under = document.elementFromPoint(x, y);
        return {
          id: def ? def.id : '',
          timed: !!document.getElementById('modalTimer').innerText,
          focusInside: modal.contains(document.activeElement),
          lines,
          catcher: under ? (under.id === 'modalOverlay') : false,
          under: under ? `${under.tagName.toLowerCase()}#${under.id}` : '',
          made: s.choicesMade.length,
        };
      });
      if (info.timed) {
        await page.evaluate(() => window.__game.setAutoplay(false));
        await shot(page, `02-modal-${info.id}`);
        await page.keyboard.press('Escape');
        const res = await page.evaluate(() => {
          window.__game.tick(100);
          const s = window.__game.state;
          return { open: !!s.activeChoice && s.activeChoice.id, last: s.choicesMade[s.choicesMade.length - 1] };
        });
        modalChecked = { ...info, closed: res.open !== info.id, recorded: res.last };
        await page.evaluate((p) => window.__game.setAutoplay(true, p), POLICY);
      }
    }

    // Reloads: mid-run (a run training), mid-queue (a plant in the interconnect queue),
    // mid-cooldown (an evaluation month, the outside evaluator's wait, or a red-team pass).
    if (!reloads.run && snap.stage === 2 && snap.run && snap.run.phase === 'training' && snap.run.elapsed > 10 && snap.run.elapsed < snap.run.duration - 10) {
      reloads.run = await reloadAndCompare(page, () => {
        const s = window.__game.state;
        const r = s.training.run && s.training.run.phase === 'training' ? s.training.run : s.training.pending;
        return r ? { id: r.id, elapsed: Math.round(r.elapsed * 10) / 10 } : null;
      });
    } else if (!reloads.queue && snap.stage === 2 && snap.queue.length && snap.queue[0].remaining > 5) {
      reloads.queue = await reloadAndCompare(page, () => window.__game.state.powerQueue.map((o) => Math.round(o.remaining * 10) / 10));
      await shot(page, '03-interconnect-queue');
    } else if (!reloads.cooldown && snap.stage === 2 && (snap.cooldown > 3 || snap.releaseWait > 3 || snap.redTeam > 1)) {
      reloads.cooldown = await reloadAndCompare(page, () => {
        const t = window.__game.state.training;
        return { cooldown: Math.round(t.cooldown * 10) / 10, releaseWait: Math.round(t.releaseWait * 10) / 10, redTeam: Math.round(t.redTeamRemaining * 10) / 10 };
      });
    }

    if (!graphDrawn && snap.panels.includes('panel-graph')) {
      graphDrawn = await page.evaluate(() => {
        const c = document.getElementById('graphCanvas');
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 0 && (d[k] < 200 || d[k + 1] < 200 || d[k + 2] < 200)) ink++;
        return ink > 200;
      });
      if (graphDrawn) await shot(page, '04-graph');
    }

    if (snap.stage === 2 && ts >= nextMark) {
      marks.push({ t: nextMark, numbers: snap.numbers, interactive: snap.interactive, words: snap.words, panels: snap.panels.length });
      // Grey is for goals (round 2 item 7): fewer than half the controls on screen are grey.
      const grey = await page.evaluate(() => {
        const all = [...document.querySelectorAll('#columns button, #columns input')].filter((b) => b.checkVisibility());
        return { grey: all.filter((b) => b.disabled).length, all: all.length, ids: all.filter((b) => b.disabled).map((b) => b.id || b.className).join(',') };
      });
      wallet.greyMarks.push(`${grey.grey}/${grey.all}`);
      if (args.includes('--dump')) console.log(`      ${clock(nextMark)} grey: ${grey.ids}`);
      // `--dump`: the numeric tokens per block at each mark (for trimming the screen).
      if (args.includes('--dump')) console.log(`      ${clock(nextMark)} ${await page.evaluate(DUMP_TOKENS)}`);
      await shot(page, `10-mark-${String(nextMark / 60).padStart(2, '0')}min`);
      nextMark += 300;
    }

    if (snap.stage >= 3) {
      stage3 = { t: ts, first: snap.console };
      break;
    }
  }

  check('Stage 2 reaches the Stage 3 arrival', !!stage3, stage3 ? `exit at ${clock(stage3.t)}` : `not in ${MAX_MINUTES} min`);
  check('no "undertrained" and no "Train now" anywhere on screen', bannedAt === null, bannedAt === null ? '' : `seen at ${clock(bannedAt)}`);
  const meterGlyph = /[｢\[][￭･■□]{10}[｣\]]/;
  check('Stores: the GPU and power rows carry a meter', meterGlyph.test(meterRows.gpu) && meterGlyph.test(meterRows.power), `${meterRows.gpu.replace(/\s+/g, ' ')} | ${meterRows.power.replace(/\s+/g, ' ')}`);
  const lines = [...shortLines];
  check('a Train short of GPUs names the shortfall (free or dark GPUs)', lines.every((l) => /^Needs [\d,]+ GPUs\. [\d,]+ free\.$/.test(l) || /^Needs [\d,]+ powered GPUs\. [\d,]+ are dark: add power\.$/.test(l)),
    lines.length ? lines.slice(0, 4).join(' | ') : 'never short (the bot builds ahead)');
  for (const id of PANELS) check(`panel appears: ${id}`, panelsSeen.has(id));
  check('capability graph is drawn', graphDrawn);
  check('no Stage 1 diagnosis line in Stage 2', !stage1Line, stage1Line);
  if (modalChecked) {
    check('event panel: every option prints an effect line', modalChecked.lines.length >= 2 && modalChecked.lines.every(Boolean), modalChecked.lines.join(' / '));
    check('event panel: keyboard focus moves into it', modalChecked.focusInside);
    check('event panel: the page behind still takes clicks', !modalChecked.catcher, modalChecked.under);
    check('event panel: Escape takes the timed default', modalChecked.closed && modalChecked.recorded && modalChecked.recorded.id === modalChecked.id, JSON.stringify(modalChecked.recorded));
  } else {
    check('event panel was exercised', false, 'no timed modal seen');
  }
  const r = reloads.run;
  check('reload mid-run restores the run', r && r.before && r.after && r.before.id === r.after.id && Math.abs(r.before.elapsed - r.after.elapsed) <= 0.2, r ? JSON.stringify(r) : 'no run seen');
  const q = reloads.queue;
  check('reload mid-queue restores the interconnect timer', q && q.before.length && JSON.stringify(q.before) === JSON.stringify(q.after), q ? JSON.stringify(q) : 'no queue seen');
  const c = reloads.cooldown;
  check('reload mid-cooldown restores the timer', c && JSON.stringify(c.before) === JSON.stringify(c.after), c ? JSON.stringify(c) : 'no cooldown seen');
  console.log('      5-minute marks (numbers / controls / words / panels):');
  for (const m of marks) console.log(`        ${clock(m.t)}  ${m.numbers} / ${m.interactive} / ${m.words} / ${m.panels}`);
  check(`on-screen numbers ≤ ${BUDGET.numbers} at every 5-minute mark`, marks.length > 0 && marks.every((m) => m.numbers <= numbersAllowed(m.t)), marks.map((m) => m.numbers).join(' '));
  check('no hold strings on screen (arc G34)', wallet.hold.length === 0, wallet.hold.join(' | '));
  check('the build share row and the build fund row are on screen', wallet.share && wallet.fund, JSON.stringify({ share: wallet.share, fund: wallet.fund }));
  check('Train armed while short: `… starts when paid for`', /starts when paid for/.test(wallet.armed), wallet.armed);
  check('a card prints the delay it causes the waiting run (`· Sage-N m:ss later`)', !!wallet.delay, wallet.delay);
  check('the GPU row prints its amount and its capacity (`17,105 of 25,000`)', !!wallet.capacity, wallet.capacity);
  check('fewer than half the controls are grey at every 5-minute mark after 5:00', wallet.greyMarks.slice(1).every((g) => { const [a, b] = g.split('/').map(Number); return 2 * a < b; }), wallet.greyMarks.join(' '));
  check(`on-screen controls ≤ ${BUDGET.interactive} at every 5-minute mark`, marks.length > 0 && marks.every((m) => m.interactive <= BUDGET.interactive), marks.map((m) => m.interactive).join(' '));

  // ===== 4. Stage 3 arrival: narration, no crash, dev overlay usable =====
  if (stage3) {
    await page.evaluate(() => window.__game.tick(3000));
    const s3 = await page.evaluate(SNAPSHOT);
    check('Stage 3 arrival: narration prints', s3.console.some((l) => /writes better code than anyone at OpenMind/.test(l)), s3.console.join(' | '));
    check('Stage 3 arrival: Alignment panel revealed', s3.panels.includes('panel-alignment'), s3.panels.join(', '));
    await shot(page, '20-stage3-arrival');
    await page.evaluate(() => window.__game.tick(60000));
    await page.keyboard.press('`');
    const dev = await page.evaluate(() => {
      const d = document.getElementById('dev');
      return { open: d.classList.contains('open') && d.checkVisibility(), stage3: !!document.getElementById('dev-stage-3') };
    });
    check('Stage 3: a minute in, the dev overlay opens and offers the Stage 3 preset', dev.open && dev.stage3, JSON.stringify(dev));
    await shot(page, '21-stage3-dev');
    await page.keyboard.press('`');
  }
  await context.close();

  // ===== 5. The Stage 3 preset loads =====
  {
    const { context: c3, page: p3 } = await freshPage('stage3-preset');
    const info = await p3.evaluate(() => {
      window.__game.loadPreset(3);
      window.__game.tick(15000);
      const s = window.__game.state;
      return { stage: s.stage, cap: s.capability, gov: s.govRelations, align: [s.alignmentApparent, s.alignmentTrue], trust: s.trust };
    });
    check('Stage 3 preset loads into the Stage 3 shell', info.stage === 3 && info.cap >= 4, JSON.stringify(info));
    await shot(p3, '22-stage3-preset');
    await c3.close();
  }

  // ===== 5b. The Train row short of GPUs (owner feedback 1, B1): forced from the Stage 2 preset =====
  {
    const { context: cs, page: ps } = await freshPage('train-short');
    const read = () => ({
      line: document.getElementById('trainGpus').innerText,
      meter: document.getElementById('trainGpuMeter').checkVisibility() ? document.getElementById('trainGpuMeter').innerText : '',
      train: !document.getElementById('btn-train').disabled,
    });
    const free = await ps.evaluate((r) => {
      window.__game.loadPreset(2);
      const s = window.__game.state;
      s.funds = 1e9;
      s.research = s.labSpace * 1000 * s.labMult;
      s.capability = 2.2;
      s.training.internalCapability = 2.2;
      window.__game.tick(1000);
      return new Function(`return (${r})();`)();
    }, read.toString());
    await shot(ps, '23-train-short-free');
    const dark = await ps.evaluate((r) => {
      const s = window.__game.state;
      s.capability = 2.4;
      s.training.internalCapability = 2.4;
      s.gpus = 9000;
      window.__game.tick(1000);
      return new Function(`return (${r})();`)();
    }, read.toString());
    await shot(ps, '24-train-short-dark');
    check('Train short, Stage 2: `Needs N GPUs. M free.` with a meter, Train disabled', /^Needs [\d,]+ GPUs\. [\d,]+ free\.$/.test(free.line) && free.meter && !free.train, JSON.stringify(free));
    check('Train short of power: `Needs N powered GPUs. K are dark: add power.`', /^Needs [\d,]+ powered GPUs\. [\d,]+ are dark: add power\.$/.test(dark.line) && !dark.train, JSON.stringify(dark));
    await cs.close();
  }

  // ===== 6. 390 px: no horizontal overflow =====
  {
    const { context: cm, page: pm } = await freshPage('mobile', { width: 390, height: 844 });
    await pm.evaluate(() => window.__game.loadPreset(2));
    await pm.evaluate((p) => window.__game.setAutoplay(true, p), POLICY);
    let worst = { sw: 0, cw: 390, at: 0 };
    for (let m = 1; m <= 30; m++) {
      const o = await pm.evaluate(() => {
        for (let k = 0; k < 30; k++) window.__game.tick(2000);
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      if (o.sw - o.cw > worst.sw - worst.cw) worst = { ...o, at: m };
      if (m === 10 || m === 25) await shot(pm, `30-mobile-${m}min`, { fullPage: true });
    }
    check('390 px wide: no horizontal overflow through minute 30', worst.sw <= worst.cw, `${worst.sw} vs ${worst.cw}${worst.at ? ` at minute ${worst.at}` : ''}`);
    await cm.close();
  }

  check('no page errors or console errors from load through Stage 3', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  check('smoke test ran to the end', false, String(e && e.stack ? e.stack : e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (policy ${POLICY}, seed ${SEED}). Screenshots: ${SHOTS}`);
process.exitCode = failed.length ? 1 : 0;
