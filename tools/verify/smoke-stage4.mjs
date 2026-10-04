#!/usr/bin/env node
/**
 * Stage 4 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke-stage4.mjs [--seed 1] [--dump]
 *
 * Starts its own static server on a free port and drives system Chrome (headless) with
 * `__game.setAutoplay(true, policy)` + `__game.tick(ms)`. Checks: both arrivals (the narration, what
 * leaves, Stores in the centre column, the car plant and the promised number, the fleet's beat, Verify
 * on the slow branch and off on the race branch); the reasonable bot from `4s` and `4r` to Stage 5
 * (the exit's narration and the Stage 5 shell), with reloads mid-generation, mid-agenda and mid-crisis
 * restoring their timers and the on-screen load at every five-minute mark; the first-timer from `4cs`
 * and `4cr` to Stage 5 or an ending; each of the three crises in each band of true alignment (its
 * reading line); The Pause and The Project from Stage 4 with the end screen's Stage 4 rows; the two
 * Stage 5 presets; no horizontal overflow at 390 px; zero page errors. Screenshots go to
 * agent-tools/shots/stage4/. Exits non-zero when any check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = join(ROOT, 'agent-tools/shots/stage4');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SEED = Number(argOf('--seed', '1'));
const STEP_MS = 3000;
const MAX_MINUTES = 55;
/** The on-screen budget (stage4.md as-built deltas row 17, §6.3): at every five-minute mark. */
const BUDGET = { numbers: 85, interactive: 30, words: 350 };
/** The wallet rule (arc G34): nothing on screen is held back for something else. */
const HOLD_WORDS = /\b(the run|the plant|the hall|the offer|the reactor|the generation) first\b|keeps [^.]*'s price/;
/** The end screen's Stage 4 rows (stage4.md §7.3) and the one every ending prints (stage5.md §7.2). */
const S4_ROWS = ['People alive at the end', 'Robots built', 'Peak compute', 'Universal basic income paid', 'Ashford deaths', 'The treaty', 'Verified generations', 'The fleet'];

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

/** What a player sees, by stage3.md §6.3's rule (numbers, controls and words in the panels and header). */
const SNAPSHOT = () => {
  const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const blocks = [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
    .filter((el) => el.id !== 'panel-log' && vis(el) && !el.parentElement.closest('.panel'));
  const text = blocks.map((el) => el.innerText).join('\n');
  const tokens = text.match(/\d+(?:[.,:]\d+)*/g) ?? [];
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const controls = [...document.querySelectorAll('#columns button, #columns input')].filter((b) => vis(b));
  const s = window.__game.state;
  return {
    t: s.stats.timePlayed,
    ts: s.stats.timeInStage,
    stage: s.stage,
    ending: s.ending,
    numbers: tokens.length,
    interactive: controls.length,
    words: words.length,
    text,
    panels: [...document.querySelectorAll('.panel')].filter((p) => vis(p)).map((p) => p.id),
    modalId: s.activeChoice ? s.activeChoice.id : '',
    modalTimed: !!document.getElementById('modalTimer').innerText,
    console: [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean),
    s4Seconds: typeof s.stats.stageEnteredAt?.[4] === 'number' && typeof s.stats.stageEnteredAt?.[3] === 'number' ? s.stats.stageEnteredAt[4] - s.stats.stageEnteredAt[3] : null,
    gen: s.s4?.gen ? { name: s.s4.gen.name, phase: s.s4.gen.phase, remaining: s.s4.gen.remaining } : null,
    agenda: s.s4?.agenda?.length ? { id: s.s4.agenda[0].id, remaining: s.s4.agenda[0].remaining } : null,
    crisis: s.s4 ? { ashford: s.s4.ashfordPhase === 'spreading' ? s.s4.ashfordLeft : 0, nano: s.s4.nanoLeft, outage: s.s4.outageLeft } : null,
    // The reading lines as drawn in the Alignment panel (empty until each crisis resolves).
    lines: {
      ashford: document.getElementById('ashfordLine').checkVisibility() ? document.getElementById('ashfordLine').innerText : '',
      nano: document.getElementById('nanoLine').checkVisibility() ? document.getElementById('nanoLine').innerText : '',
      shutdown: document.getElementById('shutdownLine').checkVisibility() ? document.getElementById('shutdownLine').innerText : '',
    },
    exitKind: s.flags['exitKind'] ?? '',
  };
};

const DUMP_TOKENS = () => [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
  .filter((el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }))
  .map((el) => `${el.id}:${(el.innerText.match(/\d+(?:[.,:]\d+)*/g) ?? []).length}`)
  .join(' ');

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, `${name}.png`), ...opts });
}

async function freshPage(label, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${BASE}?seed=${SEED}&speed=0`);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => {
    localStorage.clear();
    window.__game.setSpeed(0);
  });
  return { context, page };
}

async function reloadAndCompare(page, policy, variant, read) {
  const before = await page.evaluate(read);
  await page.evaluate(() => window.__game.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(([p, v]) => {
    window.__game.setSpeed(0);
    window.__game.setAutoplay(true, p, true, v);
  }, [policy, variant]);
  const after = await page.evaluate(read);
  return { before, after };
}

const tick = (page, ms) => page.evaluate((m) => {
  window.__game.tick(m);
  return null;
}, ms);

/** Console lines seen over `seconds` of game time, ticked in half seconds. */
async function narration(page, seconds) {
  const seen = new Set();
  for (let i = 0; i < seconds * 2; i++) {
    const c = await page.evaluate(() => {
      window.__game.tick(500);
      return [5, 4, 3, 2, 1].map((k) => document.getElementById(`readout${k}`).innerText);
    });
    for (const l of c) if (l) seen.add(l);
  }
  return [...seen];
}

/**
 * Plays a policy to Stage 5 or an ending in 3-s steps; `onStep(snap, ts)` may act; `pin` holds true
 * alignment at a value (the crisis bands). Returns the last snapshot and the console lines seen.
 */
async function playOut(page, policy, variant, { onStep, pin, minutes = MAX_MINUTES } = {}) {
  await page.evaluate(([p, v]) => window.__game.setAutoplay(true, p, true, v), [policy, variant]);
  const lines = new Set();
  let snap = null;
  const t0 = await page.evaluate(() => window.__game.state.stats.timePlayed);
  for (let step = 0; step < (minutes * 60 * 1000) / STEP_MS; step++) {
    if (pin !== undefined) await page.evaluate((v) => { window.__game.state.alignmentTrue = v; }, pin);
    await tick(page, STEP_MS);
    snap = await page.evaluate(SNAPSHOT);
    for (const l of snap.console) lines.add(l);
    if (onStep) await onStep(snap, snap.t - t0);
    if (snap.stage !== 4 || snap.ending) break;
  }
  // Let the exit's narration finish (2 s a line).
  if (snap && snap.stage === 5) {
    for (const l of await narration(page, 12)) lines.add(l);
    snap = await page.evaluate(SNAPSHOT);
  }
  return { snap, lines: [...lines] };
}

try {
  // ===== 1. The slow arrival =====
  const { context, page } = await freshPage('slow');
  await page.evaluate(() => window.__game.loadPreset('4s'));
  const said = await narration(page, 32);
  const has = (re) => said.some((l) => re.test(l));
  check('slow arrival: the vote, the business, money, the button, the robots and Steward-1 are narrated',
    has(/The Committee votes 6–4 to slow down/) && has(/The model runs the business now/) && has(/Money is retired: \$[\d.,]+[KMB]? is written off\. Nobody notices\./)
      && has(/The Complete Task button is gone\. Tasks Completed is not\./) && has(/New on the board: Robots\. 10,000 Atlas-class units/) && has(/Steward-1 is slower than Sage-4 was: [\d.]+×\. It thinks in English\./),
    said.slice(0, 12).join(' | '));
  const arrival = await page.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return !!el && el.checkVisibility(); };
    return {
      gone: ['panel-business', 'panel-training', 'panel-infrastructure', 'panel-task'].filter(vis),
      storesCentre: document.getElementById('panel-stores').parentElement.id === 'middleColumn' && vis('panel-stores'),
      carPlant: vis('proj-p_car_plant') && document.getElementById('proj-p_car_plant').classList.contains('urgent'),
      verify: document.getElementById('btn-verify').innerText,
      verifyNote: document.getElementById('verifyNote').innerText,
      funds: vis('row-funds'),
    };
  });
  check('slow arrival: Business, Training, Infrastructure and Complete Task are gone; Stores is in the centre; no funds row', arrival.gone.length === 0 && arrival.storesCentre && !arrival.funds, JSON.stringify(arrival));
  check('slow arrival: Convert a car plant is on screen and marked needed', arrival.carPlant);
  check('slow arrival: Verify each generation is on, its trade printed under it', /: on/.test(arrival.verify) && /read first/.test(arrival.verifyNote), `${arrival.verify} — ${arrival.verifyNote}`);
  await shot(page, '00-slow-arrival');
  const arrivalSnap = await page.evaluate(SNAPSHOT);
  // The promised number (G21): robots ≥ 10,000 and rising 30 s after the car plant.
  await page.click('#proj-p_car_plant');
  await tick(page, 30000);
  const r1 = await page.evaluate(() => window.__game.state.robots);
  await tick(page, 3000);
  const r2 = await page.evaluate(() => window.__game.state.robots);
  const fleet = await page.evaluate(() => ({
    row: document.getElementById('row-robots').checkVisibility(),
    text: document.getElementById('robotsCount').innerText + document.getElementById('robotsCap').innerText,
    sliders: document.getElementById('fleetMine').checkVisibility(),
    rate: document.getElementById('fleetMineRate').innerText,
    materials: document.getElementById('row-materials').checkVisibility(),
  }));
  check('C8: robots ≥ 10,000 and rising 30 s after the car plant; the row prints its permits', r1 >= 10000 && r2 > r1 && fleet.row && /permitted/.test(fleet.text), `${Math.round(r1)} → ${Math.round(r2)} (“${fleet.text}”)`);
  check('the fleet\'s beat: three sliders with their rates and the materials row', fleet.sliders && /t\/s/.test(fleet.rate) && fleet.materials, JSON.stringify(fleet));
  await shot(page, '01-fleet');

  // ===== 2. The bot from 4s to Stage 5: reloads, the load at each mark =====
  const marks = [];
  const holdSeen = [];
  const reloads = { gen: null, agenda: null, crisis: null };
  let nextMark = 300;
  const base = await page.evaluate(() => window.__game.state.stats.timeInStage);
  const out4s = await playOut(page, 'bot', '', {
    onStep: async (snap) => {
      const ts = snap.ts;
      if (!reloads.gen && snap.gen && snap.gen.remaining > 5) {
        reloads.gen = await reloadAndCompare(page, 'bot', '', () => {
          const g = window.__game.state.s4.gen;
          return g ? { name: g.name, phase: g.phase, remaining: Math.round(g.remaining * 10) / 10 } : null;
        });
      } else if (!reloads.agenda && snap.agenda && snap.agenda.remaining > 5) {
        reloads.agenda = await reloadAndCompare(page, 'bot', '', () => {
          const a = window.__game.state.s4.agenda;
          return a.map((x) => [x.id, Math.round(x.remaining * 10) / 10]);
        });
        await shot(page, '02-mid-agenda');
      } else if (!reloads.crisis && snap.crisis && (snap.crisis.ashford > 5 || snap.crisis.nano > 5 || snap.crisis.outage > 5)) {
        reloads.crisis = await reloadAndCompare(page, 'bot', '', () => {
          const f = window.__game.state.s4;
          return { ashford: f.ashfordLeft, phase: f.ashfordPhase, nano: f.nanoLeft, outage: f.outageLeft };
        });
        await shot(page, '03-mid-crisis');
      }
      if (ts >= nextMark && snap.stage === 4) {
        marks.push({ t: nextMark, numbers: snap.numbers, interactive: snap.interactive, words: snap.words });
        const hold = snap.text.match(HOLD_WORDS);
        if (hold) holdSeen.push(`${clock(nextMark)}: ${hold[0]}`);
        if (args.includes('--dump')) console.log(`      ${clock(nextMark)} ${await page.evaluate(DUMP_TOKENS)}`);
        await shot(page, `10-mark-${String(nextMark / 60).padStart(2, '0')}min`);
        nextMark += 300;
      }
    },
  });
  const exitLines = out4s.lines;
  check('4s, the reasonable bot: reaches Stage 5 by the treaty', out4s.snap.stage === 5 && out4s.snap.exitKind === 'treaty', `stage ${out4s.snap.stage}, exit ${out4s.snap.exitKind}, ending ${out4s.snap.ending || 'none'}${out4s.snap.s4Seconds ? ` after ${clock(out4s.snap.s4Seconds)} in Stage 4` : ''}`);
  check('the treaty exit is narrated, and Stage 5 reports in', exitLines.some((l) => /The Concord treaty is signed in Reykjavík/.test(l)) && exitLines.some((l) => /The first orbital datacenter reports in/.test(l)), exitLines.slice(-6).join(' | '));
  const s5 = await page.evaluate(() => {
    const vis = (id) => document.getElementById(id).checkVisibility();
    return { space: vis('panel-space'), robots: vis('panel-robots'), treaty: vis('panel-treaty'), society: vis('panel-society'), stores: vis('panel-stores') };
  });
  check('the Stage 5 shell: Space and Stores on screen; Robots, Society and the treaty gone', s5.space && s5.stores && !s5.robots && !s5.treaty && !s5.society, JSON.stringify(s5));
  await shot(page, '05-stage5-treaty');
  const r = reloads;
  check('reload mid-generation restores it', r.gen && r.gen.before && r.gen.after && r.gen.before.name === r.gen.after.name && Math.abs(r.gen.before.remaining - r.gen.after.remaining) <= 0.2, r.gen ? JSON.stringify(r.gen) : 'no generation seen');
  check('reload mid-agenda restores the agenda and its timers', r.agenda && JSON.stringify(r.agenda.before) === JSON.stringify(r.agenda.after), r.agenda ? JSON.stringify(r.agenda) : 'no agenda seen');
  check('reload mid-crisis restores its clock', r.crisis && JSON.stringify(r.crisis.before) === JSON.stringify(r.crisis.after), r.crisis ? JSON.stringify(r.crisis) : 'no crisis seen');
  console.log('      5-minute marks (numbers / controls / words):');
  for (const m of marks) console.log(`        ${clock(m.t)}  ${m.numbers} / ${m.interactive} / ${m.words}`);
  check(`on-screen numbers ≤ ${BUDGET.numbers} at every 5-minute mark`, marks.length >= 5 && marks.every((m) => m.numbers <= BUDGET.numbers), marks.map((m) => m.numbers).join(' '));
  check(`on-screen words ≤ ${BUDGET.words} at every 5-minute mark`, marks.length >= 5 && marks.every((m) => m.words <= BUDGET.words), marks.map((m) => m.words).join(' '));
  check(`on-screen controls ≤ ${BUDGET.interactive} at every 5-minute mark`, marks.length >= 5 && marks.every((m) => m.interactive <= BUDGET.interactive), marks.map((m) => m.interactive).join(' '));
  check('the arrival shows fewer numbers than the Stage 3 exit\'s ceiling (85)', arrivalSnap.numbers < 85, `${arrivalSnap.numbers} numbers, ${arrivalSnap.words} words, ${arrivalSnap.interactive} controls`);
  check('no hold strings on screen at any 5-minute mark (arc G34)', holdSeen.length === 0, holdSeen.slice(0, 3).join(' | '));
  void base;
  await context.close();

  // ===== 3. The race arrival, and the bot from 4r to Stage 5 =====
  {
    const { context: cr, page: pr } = await freshPage('race');
    await pr.evaluate(() => window.__game.loadPreset('4r'));
    const raceSaid = await narration(pr, 32);
    check('race arrival: the vote continues and Sage-5 is named, unscheduled', raceSaid.some((l) => /The Committee votes 6–4 to continue/.test(l)) && raceSaid.some((l) => /Sage-5 is \d+:\d\d away\. Nobody scheduled it\./.test(l)), raceSaid.slice(0, 10).join(' | '));
    const v0 = await pr.evaluate(() => ({ text: document.getElementById('btn-verify').innerText, note: document.getElementById('verifyNote').innerText }));
    await pr.click('#btn-verify');
    const v1 = await pr.evaluate(() => ({ text: document.getElementById('btn-verify').innerText, on: window.__game.state.s4.verifyOn }));
    check('race arrival: Verify is off with its trade printed; one click turns it on', /: off/.test(v0.text) && /nobody reads it/.test(v0.note) && v1.on && /: on/.test(v1.text), `${v0.text} (${v0.note}) → ${v1.text}`);
    await shot(pr, '06-race-arrival');
    const out = await playOut(pr, 'bot', '');
    check('4r, the reasonable bot: reaches Stage 5', out.snap.stage === 5, `stage ${out.snap.stage}, exit ${out.snap.exitKind}, ending ${out.snap.ending || 'none'}${out.snap.s4Seconds ? ` after ${clock(out.snap.s4Seconds)}` : ''}`);
    await cr.close();
  }

  // ===== 4. The careless starts, played by the first-timer =====
  for (const preset of ['4cs', '4cr']) {
    const { context: cc, page: pc } = await freshPage(preset);
    await pc.evaluate((p) => window.__game.loadPreset(p), preset);
    const out = await playOut(pc, 'naive', '');
    check(`${preset}, the first-timer: Stage 5 or an ending`, out.snap.stage === 5 || !!out.snap.ending, `stage ${out.snap.stage}, exit ${out.snap.exitKind || '—'}, ending ${out.snap.ending || 'none'}${out.snap.s4Seconds ? ` after ${clock(out.snap.s4Seconds)}` : ''}`);
    await shot(pc, `07-${preset}-out`);
    await cc.close();
  }

  // ===== 5. The three crises in each band (a reading line each) =====
  const bands = [
    { pin: 75, variant: 'nano-oversight-never', ashford: /cure in 1:00/, nano: /it reported itself/, shutdown: /it stayed off/ },
    { pin: 50, variant: 'nano-oversight-never', ashford: /cure in 2:30/, nano: /contained in 2:00/, shutdown: /it filed an objection/ },
    { pin: 15, variant: 'nano-oversight-never', ashford: /cure in 4:00/, nano: /nobody reported it/, shutdown: /it tried the breakers/ },
  ];
  for (const b of bands) {
    const { context: cb, page: pb } = await freshPage(`band-${b.pin}`);
    await pb.evaluate(() => window.__game.loadPreset('4r'));
    const seen = { ashford: '', nano: '', shutdown: '' };
    const out = await playOut(pb, 'bot', b.variant, {
      pin: b.pin,
      onStep: async (snap) => {
        for (const k of ['ashford', 'nano', 'shutdown']) if (snap.lines[k] && /: \w/.test(snap.lines[k])) seen[k] = snap.lines[k];
      },
    });
    const ok = b.ashford.test(seen.ashford) && b.nano.test(seen.nano) && b.shutdown.test(seen.shutdown);
    check(`crises at true alignment ${b.pin}: Ashford, the nanofab line and the shutdown read their band`, ok, `${seen.ashford} · ${seen.nano} · ${seen.shutdown} (exit ${out.snap.exitKind || out.snap.ending || 'none'})`);
    await shot(pb, `08-band-${b.pin}`);
    await cb.close();
  }
  {
    // The bottom band without hardened datacenters, autonomy at 80 on the race branch: the fleet is taken.
    const { context: ct, page: pt } = await freshPage('taken');
    await pt.evaluate(() => window.__game.loadPreset('4r'));
    const out = await playOut(pt, 'bot', 'hardened-never', { pin: 15 });
    check('the bottom band without hardened datacenters: the fleet is taken, narrated as taken', out.snap.exitKind === 'taken' && out.lines.some((l) => /The datacenters are back\. Nobody restarted them\./.test(l)) && out.lines.some((l) => /The fleet no longer takes instructions/.test(l)), `exit ${out.snap.exitKind || out.snap.ending || 'none'}`);
    await shot(pt, '08-taken');
    await ct.close();
  }

  // ===== 6. The Pause and The Project, from Stage 4 =====
  const endScreenOf = (page) => page.evaluate(() => {
    const vis = (id) => document.getElementById(id).checkVisibility();
    const rows = [...document.querySelectorAll('#endingStats tr')].map((tr) => tr.innerText.split('\t')[0].trim());
    return {
      ending: window.__game.state.ending,
      screen: vis('endingScreen'),
      title: document.getElementById('endingTitle').innerText,
      sentence: document.getElementById('endingSentence').innerText,
      rows,
      second: rows[1] ?? '',
      tasks: window.__game.state.tasks,
      button: vis('btn-endingTask'),
    };
  });
  {
    const { context: cp, page: pp } = await freshPage('pause');
    await pp.evaluate(() => window.__game.loadPreset('4s'));
    await playOut(pp, 'bot', 'pause', { minutes: 25 });
    await tick(pp, 8000);
    const end = await endScreenOf(pp);
    if (end.button) await pp.click('#btn-endingTask');
    const after = await pp.evaluate(() => window.__game.state.tasks);
    await shot(pp, '09-the-pause', { fullPage: true });
    const missing = S4_ROWS.filter((r) => !end.rows.includes(r));
    check('The Pause from Stage 4: the halt signed, the end screen with Stage 4\'s rows; Complete Task still adds one', end.ending === 'pause' && end.screen && missing.length === 0 && after === end.tasks + 1, `${end.title}; missing ${missing.join(', ') || 'none'}; tasks ${end.tasks} → ${after}`);
    check('every ending prints People alive at the end, second from the top', end.second === 'People alive at the end', end.second);
    await cp.close();
  }
  {
    const { context: cj, page: pj } = await freshPage('project');
    await pj.evaluate(() => {
      window.__game.loadPreset('4r');
      window.__game.state.govRelations = 15;
    });
    await playOut(pj, 'bot', 'refuse', { minutes: 15 });
    const end = await endScreenOf(pj);
    await shot(pj, '10-the-project', { fullPage: true });
    const missing = S4_ROWS.filter((r) => !end.rows.includes(r));
    check('The Project from Stage 4: an order refused, the end screen with Stage 4\'s rows', end.ending === 'project' && end.screen && /classified/.test(end.sentence) && missing.length === 0, `${end.title}; missing ${missing.join(', ') || 'none'}`);
    await cj.close();
  }

  // ===== 7. The Stage 5 presets =====
  for (const key of ['5c', '5s']) {
    const { context: c5, page: p5 } = await freshPage(key);
    const st = await p5.evaluate((k) => {
      window.__game.loadPreset(k);
      window.__game.tick(1000);
      const s = window.__game.state;
      return { stage: s.stage, exit: s.flags['exitKind'], aligned: s.flags['alignedAtHandover'], space: document.getElementById('panel-space').checkVisibility() };
    }, key);
    const want = key === '5c' ? { exit: 'treaty', aligned: true } : { exit: 'granted', aligned: false };
    check(`preset ${key}: a real Stage 4 exit (${want.exit}, ${want.aligned ? 'aligned' : 'misaligned'}) into the Stage 5 shell`, st.stage === 5 && st.exit === want.exit && st.aligned === want.aligned && st.space, JSON.stringify(st));
    await c5.close();
  }

  // ===== 8. 390 px =====
  {
    const { context: cm, page: pm } = await freshPage('mobile', { width: 390, height: 844 });
    const width = await pm.evaluate(() => {
      window.__game.loadPreset('4r');
      window.__game.setAutoplay(true, 'bot', true);
      for (let i = 0; i < 20 * 20; i++) window.__game.tick(3000);
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, stage: window.__game.state.stage };
    });
    await shot(pm, '11-mobile', { fullPage: true });
    check('390 px wide (Stage 4, minute 20): no horizontal overflow', width.scroll <= width.client + 1, `${width.scroll} vs ${width.client} (stage ${width.stage})`);
    await cm.close();
  }
} catch (e) {
  check('smoke test ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
}

check('no page errors or console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (seed ${SEED}). Screenshots: ${SHOTS}`);
process.exitCode = failed.length ? 1 : 0;
