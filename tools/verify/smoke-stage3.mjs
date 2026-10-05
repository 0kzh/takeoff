#!/usr/bin/env node
/**
 * Stage 3 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke-stage3.mjs [--seed 1] [--dump]
 *
 * Starts its own static server on a free port and drives system Chrome (headless) with
 * `__game.setAutoplay(true, policy)` + `__game.tick(ms)`. Checks: the arrival (narration, the
 * promised number, Approve in place of Release, no Stage 2 controls); a run of the reasonable bot
 * from `Stage 3 start` through the vote into Stage 4 (panels, grants and their WARNING, drift,
 * the readings, the session, the motion, Stage 4's narration); reloads mid-run, mid-shipment,
 * mid-event and mid-session restore their timers; numbers, controls and words at each 5-minute
 * mark (stage3.md §6.3's counting rule); the careless start played by the first-timer into Stage 4;
 * the Pause and the Project each reached with the end screen rendered; no horizontal overflow at
 * 390 px; zero page errors. Screenshots go to agent-tools/shots/stage3/. Exits non-zero when any
 * check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = join(ROOT, 'agent-tools/shots/stage3');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SEED = Number(argOf('--seed', '1'));
const STEP_MS = 3000;
const MAX_MINUTES = 70;
/**
 * The on-screen budget (stage3.md §6.3, arc G14; the coordinator's round-3 load limits, as amended by
 * owner feedback 2): 30 controls, 90 numbers and 380 words at every five-minute mark. Stage 3's own
 * notes fold into hovers once read, band edges print only when near, each fact has one home; a
 * project card keeps its sentence for as long as it is on screen, as in Stages 1–2 (the owner's note
 * outranks the budget: with the cards unfolded the build reaches 72–88 numbers and 235–370 words from
 * the rebuilt preset, where the folded cards gave 73–83 and 206–293).
 */
const BUDGET = { numbers: 90, interactive: 30, words: 380 };
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

/**
 * What a player sees, by stage3.md §6.3's rule: numeric tokens in the panels and the header (not
 * the console, the Developments log, modals or canvas text); visible buttons and sliders; words.
 */
const SNAPSHOT = () => {
  const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const blocks = [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
    .filter((el) => el.id !== 'panel-log' && vis(el) && !el.parentElement.closest('.panel'));
  const text = blocks.map((el) => el.innerText).join('\n');
  const tokens = text.match(/\d+(?:[.,:]\d+)*/g) ?? [];
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const controls = [...document.querySelectorAll('#columns button, #columns input')].filter((b) => vis(b));
  const s = window.__game.state;
  const run = s.training.run ?? s.training.pending;
  return {
    t: s.stats.timePlayed,
    ts: s.stats.timeInStage,
    stage: s.stage,
    ending: s.ending,
    numbers: tokens.length,
    interactive: controls.length,
    words: words.length,
    panels: [...document.querySelectorAll('.panel')].filter((p) => vis(p)).map((p) => p.id),
    modalId: s.activeChoice ? s.activeChoice.id : '',
    modalTimed: !!document.getElementById('modalTimer').innerText,
    console: [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean),
    run: run ? { id: run.id, phase: run.phase, elapsed: run.elapsed, duration: run.duration } : null,
    shipments: s.shipments.map((x) => ({ gpus: x.gpus, remaining: x.remaining })),
    session: typeof s.flags['sessionAt'] === 'number',
    grants: [...document.querySelectorAll('#grantList .projectButton')].filter((b) => vis(b)).length,
    pause: !!document.getElementById('proj-p_pause') && vis(document.getElementById('proj-p_pause')) && !document.getElementById('proj-p_pause').disabled,
    motion: ['p_steward', 'p_race'].find((id) => document.getElementById(`proj-${id}`) && !document.getElementById(`proj-${id}`).disabled) ?? '',
    trueShown: vis(document.getElementById('alignTrue')),
    researchText: document.getElementById('research').innerText,
  };
};

const DUMP_TOKENS = () => [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
  .filter((el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }))
  .map((el) => `${el.id}:${(el.innerText.match(/\d+(?:[.,:]\d+)*/g) ?? []).length}`)
  .join(' ');

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(500);
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

async function reloadAndCompare(page, policy, read) {
  const before = await page.evaluate(read);
  await page.evaluate(() => window.__game.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate((p) => {
    window.__game.setSpeed(0);
    window.__game.setAutoplay(true, p, true);
  }, policy);
  const after = await page.evaluate(read);
  return { before, after };
}

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

const tick = (page, ms) => page.evaluate((m) => {
  window.__game.tick(m);
  return null;
}, ms);

/** Clicks a motion and brings it (the vote): `p_steward`, `p_race` or `p_pause`. */
async function bringMotion(page, id) {
  await page.evaluate(() => window.__game.setAutoplay(false));
  await page.click(`#proj-${id}`);
  await tick(page, 100);
  const options = await page.evaluate(() => [...document.querySelectorAll('#modalButtons button.modalButton')].map((b) => b.innerText));
  await page.click('#modalButtons button.modalButton >> nth=0');
  return options;
}

try {
  // ===== 1. The arrival =====
  const { context, page } = await freshPage('stage3');
  const arrival = await page.evaluate(() => {
    window.__game.loadPreset(3);
    const s = window.__game.state;
    return { research: s.research, stage: s.stage, t: s.stats.timePlayed };
  });
  let narrationWhole = false;
  for (let i = 0; i < 24; i++) {
    const c = await page.evaluate(() => {
      window.__game.tick(500);
      return [5, 4, 3, 2, 1].map((k) => document.getElementById(`readout${k}`).innerText);
    });
    if (c.some((l) => /Research has no ceiling now\. A run is a research program: [\d,]+ for Sage-3\.1\./.test(l)) && c.some((l) => /Marketing is closed/.test(l))) narrationWhole = true;
  }
  check('arrival: the narration names the run\'s price in research and the end of marketing and hiring', narrationWhole);
  await shot(page, '00-arrival');
  const a30 = await page.evaluate(() => {
    window.__game.tick(18000);
    const s = window.__game.state;
    const vis = (id) => { const el = document.getElementById(id); return !!el && el.checkVisibility(); };
    return {
      research: s.research,
      text: document.getElementById('research').innerText,
      approve: !!document.getElementById('btn-approve'),
      release: vis('btn-release'),
      marketing: vis('btn-marketing'), hire: vis('btn-hireResearcher'), gas: vis('btn-turbines'), solar: vis('btn-solar'),
      lots: ['btn-gpuBatch', 'btn-gpuBatch5', 'btn-gpuBatch25'].filter(vis).length,
      monitor: vis('proj-p_monitor2'),
      alignment: vis('panel-alignment'),
    };
  });
  check('B26: research ≥ arrival + 1,000,000 at ts 30 and shown without a ceiling', a30.research >= arrival.research + 1e6 && !/\//.test(a30.text), `${Math.round(arrival.research)} → ${Math.round(a30.research)} (“${a30.text}”)`);
  // The lots: every lit one, and at most one grey (stage2-round2-fixes.md item 7) — at the arrival's power wall, one.
  check('arrival: Marketing, Hire, gas, solar and Release are gone; a lot row and Alignment are on screen', !a30.marketing && !a30.hire && !a30.gas && !a30.solar && !a30.release && a30.lots >= 1 && a30.alignment, JSON.stringify(a30));
  check('arrival: Deploy Sage-2 as monitor is on screen', a30.monitor);

  // ===== 2. The reasonable bot through the stage =====
  await page.evaluate(() => window.__game.setAutoplay(true, 'bot', true));
  const t0 = arrival.t;
  const marks = [];
  const holdSeen = [];
  let shareSeen = false;
  let fundSeen = false;
  let alignShareSeen = false;
  let nextMark = 300;
  const panelsSeen = new Set();
  const consoleSeen = new Set();
  const reloads = { run: null, shipment: null, event: null, session: null };
  let maxGrants = 0;
  let trueShownAt = null;
  let voteAt = null;
  let campusText = '';
  let storesOverflow = 0;
  let motionInfo = null;
  for (let step = 0; step < (MAX_MINUTES * 60 * 1000) / STEP_MS; step++) {
    await tick(page, STEP_MS);
    const snap = await page.evaluate(SNAPSHOT);
    const ts = snap.t - t0;
    for (const p of snap.panels) panelsSeen.add(p);
    for (const l of snap.console) consoleSeen.add(l);
    maxGrants = Math.max(maxGrants, snap.grants);
    if (snap.trueShown && trueShownAt === null) trueShownAt = ts;
    if (snap.stage !== 3) break;

    if (!campusText) campusText = await page.evaluate(() => document.getElementById('proj-p_site2')?.innerText ?? '');
    if (!reloads.run && snap.run && snap.run.phase === 'training' && snap.run.elapsed > 5 && snap.run.elapsed < snap.run.duration - 5) {
      reloads.run = await reloadAndCompare(page, 'bot', () => {
        const s = window.__game.state;
        const r = s.training.run && s.training.run.phase === 'training' ? s.training.run : s.training.pending;
        return r ? { id: r.id, elapsed: Math.round(r.elapsed * 10) / 10 } : null;
      });
      await shot(page, '01-mid-run');
    } else if (!reloads.shipment && snap.shipments.length && snap.shipments[0].remaining > 5) {
      reloads.shipment = await reloadAndCompare(page, 'bot', () => window.__game.state.shipments.map((x) => [x.gpus, Math.round(x.remaining * 10) / 10]));
    } else if (!reloads.event && snap.modalId && snap.modalTimed) {
      reloads.event = await reloadAndCompare(page, 'bot', () => {
        const c = window.__game.state.activeChoice;
        return c ? { id: c.id, remaining: Math.round(c.remaining * 10) / 10 } : null;
      });
      await shot(page, `02-event-${snap.modalId}`);
    } else if (!reloads.session && snap.session) {
      reloads.session = await reloadAndCompare(page, 'bot', () => ({ at: window.__game.state.flags['sessionAt'], memo: window.__game.state.flags['memo'] }));
      await shot(page, '03-session');
    }

    if (ts >= nextMark) {
      marks.push({ t: nextMark, numbers: snap.numbers, interactive: snap.interactive, words: snap.words, panels: snap.panels.length });
      // The stores box holds its rows (critic S3 round 1 §9 item 8: the GPU row ran 12 px past it).
      storesOverflow = Math.max(storesOverflow, await page.evaluate(() => {
        const box = document.getElementById('panel-stores').getBoundingClientRect();
        return Math.max(0, ...[...document.querySelectorAll('#panel-stores .storeRow')].filter((r) => r.checkVisibility()).map((r) => Math.ceil(Math.max(...[...r.querySelectorAll('*')].map((e) => e.getBoundingClientRect().right)) - box.right)));
      }));
      const extra = await page.evaluate(() => ({
        text: [...document.querySelectorAll('#columns .panel')].filter((el) => el.checkVisibility()).map((el) => el.innerText).join('\n'),
        share: !!document.getElementById('buildShareRow')?.checkVisibility() && /\d+%/.test(document.getElementById('btn-buildShare').innerText),
        fund: !!document.getElementById('row-buildFund')?.checkVisibility(),
        align: /Alignment work: \d+%/.test(document.getElementById('btn-alignWork').innerText),
      }));
      const hold = extra.text.match(HOLD_WORDS);
      if (hold) holdSeen.push(`${clock(nextMark)}: ${hold[0]}`);
      shareSeen ||= extra.share;
      fundSeen ||= extra.fund;
      alignShareSeen ||= extra.align;
      if (args.includes('--dump')) console.log(`      ${clock(nextMark)} ${await page.evaluate(DUMP_TOKENS)}`);
      await shot(page, `10-mark-${String(nextMark / 60).padStart(2, '0')}min`);
      nextMark += 300;
    }

    // The vote: the test, not the policy, brings the motion the bot would bring.
    if (snap.motion && /waiting for a motion/.test(await page.evaluate(() => document.getElementById('sessionLine').innerText))) {
      voteAt = ts;
      await shot(page, '04-vote-ready');
      const motion = await page.evaluate(() => {
        const s = window.__game.state;
        return s.interpretability >= 3 && s.alignmentTrue >= 60 ? 'p_race' : 'p_steward';
      });
      const options = await bringMotion(page, motion);
      motionInfo = { motion, options };
      break;
    }
  }
  check('the bot reaches the vote', voteAt !== null, voteAt !== null ? `ready at ${clock(voteAt)}` : `not in ${MAX_MINUTES} min`);
  check('the vote: the motion\'s button prints what it does', motionInfo && motionInfo.options.length === 2 && /Cannot be undone|switched off/.test(motionInfo.options[0]), motionInfo ? motionInfo.options.join(' / ').replace(/\n/g, ' · ') : '');
  const s4 = [];
  for (let i = 0; i < 20; i++) {
    const c = await page.evaluate(() => {
      window.__game.tick(500);
      return { stage: window.__game.state.stage, console: [5, 4, 3, 2, 1].map((k) => document.getElementById(`readout${k}`).innerText) };
    });
    s4.push(c);
  }
  const last = s4[s4.length - 1];
  check('Stage 4 arrival: the vote is narrated and the model runs the business', last.stage === 4 && last.console.some((l) => /The Committee votes \d+–\d+/.test(l)) && last.console.some((l) => /The model runs the business now/.test(l)), last.console.join(' | '));
  await shot(page, '05-stage4-arrival');
  const s4panels = await page.evaluate(() => [...document.querySelectorAll('.panel')].filter((p) => p.checkVisibility()).map((p) => p.id));
  const carPlant = await page.evaluate(() => !!document.getElementById('proj-p_car_plant')?.checkVisibility());
  // Stage 4 is built (stage4.md §1.1): the business, training and infrastructure leave; the car plant is the first card.
  check('Stage 4 arrival: the business, training and infrastructure have left; the car plant is on screen', !['panel-business', 'panel-training', 'panel-infrastructure'].some((id) => s4panels.includes(id)) && carPlant, s4panels.join(', '));
  for (const id of ['panel-alignment', 'panel-geopolitics', 'panel-oversight', 'panel-security', 'panel-public']) check(`Stage 3 panel appears: ${id}`, panelsSeen.has(id));
  check('grants render in the Alignment panel\'s list', maxGrants >= 1, `up to ${maxGrants} on offer`);
  check('a grant prints its WARNING', [...consoleSeen].some((l) => l === 'WARNING: risk of value drift increased.'));
  check('true alignment appears with interpretability lab III', trueShownAt !== null, trueShownAt !== null ? `at ${clock(trueShownAt)}` : '');
  const r = reloads;
  const campus = await page.evaluate(() => {
    const c = window.__game.projects.byId('p_site2').cost(window.__game.state);
    return { build: c.build ?? 0, funds: c.funds ?? 0 };
  });
  check('the second campus is paid from the build fund (or funds), named on its row (§9 item 5)', campus.build > 0 && !campus.funds && (!campusText || /from the build fund/.test(campusText)), `${JSON.stringify(campus)} “${campusText.split('\n')[0]}”`);
  check('the stores box holds its rows at every mark (§9 item 8)', storesOverflow <= 1, `${storesOverflow} px past the box at most`);
  check('reload mid-run restores the run', r.run && r.run.before && r.run.after && r.run.before.id === r.run.after.id && Math.abs(r.run.before.elapsed - r.run.after.elapsed) <= 0.2, r.run ? JSON.stringify(r.run) : 'no run seen');
  check('reload mid-shipment restores the shipment timers', r.shipment && JSON.stringify(r.shipment.before) === JSON.stringify(r.shipment.after), r.shipment ? JSON.stringify(r.shipment) : 'no shipment seen');
  check('reload mid-event restores the event and its timer', r.event && r.event.before && r.event.after && r.event.before.id === r.event.after.id && Math.abs(r.event.before.remaining - r.event.after.remaining) <= 0.2, r.event ? JSON.stringify(r.event) : 'no timed event seen');
  check('reload mid-session restores the session', r.session && JSON.stringify(r.session.before) === JSON.stringify(r.session.after), r.session ? JSON.stringify(r.session) : 'no session seen');
  console.log('      5-minute marks (numbers / controls / words / panels):');
  for (const m of marks) console.log(`        ${clock(m.t)}  ${m.numbers} / ${m.interactive} / ${m.words} / ${m.panels}`);
  check(`on-screen numbers ≤ ${BUDGET.numbers} at every 5-minute mark`, marks.length > 0 && marks.every((m) => m.numbers <= BUDGET.numbers), marks.map((m) => m.numbers).join(' '));
  check(`on-screen words ≤ ${BUDGET.words} at every 5-minute mark`, marks.length > 0 && marks.every((m) => m.words <= BUDGET.words), marks.map((m) => m.words).join(' '));
  check('no hold strings on screen at any 5-minute mark (arc G34)', holdSeen.length === 0, holdSeen.slice(0, 3).join(' | '));
  check('the build share and the build fund are on screen, Alignment work is a share', shareSeen && fundSeen && alignShareSeen, JSON.stringify({ shareSeen, fundSeen, alignShareSeen }));
  check(`on-screen controls ≤ ${BUDGET.interactive} at every 5-minute mark`, marks.length > 0 && marks.every((m) => m.interactive <= BUDGET.interactive), marks.map((m) => m.interactive).join(' '));
  await context.close();

  // ===== 3. The careless start, played by the first-timer, into Stage 4 =====
  {
    const { context: cc, page: pc } = await freshPage('careless');
    await pc.evaluate(() => {
      window.__game.loadPreset('3c');
      window.__game.setAutoplay(true, 'naive', true);
    });
    let out = null;
    for (let step = 0; step < (MAX_MINUTES * 60 * 1000) / 5000; step++) {
      await tick(pc, 5000);
      const snap = await pc.evaluate(SNAPSHOT);
      if (snap.stage !== 3 || snap.ending) {
        out = snap;
        break;
      }
      if (snap.motion && /waiting for a motion/.test(await pc.evaluate(() => document.getElementById('sessionLine').innerText))) {
        await bringMotion(pc, 'p_steward');
        await tick(pc, 5000);
        out = await pc.evaluate(SNAPSHOT);
        break;
      }
    }
    check('careless start: the first-timer reaches Stage 4 without an ending', out && out.stage === 4 && !out.ending, out ? `stage ${out.stage}, ending ${out.ending || 'none'}` : 'still in Stage 3');
    await shot(pc, '06-careless-stage4');
    await cc.close();
  }

  // ===== 4. The Pause: the reasonable bot signs it when it is offered =====
  {
    const { context: cp, page: pp } = await freshPage('pause');
    await pp.evaluate(() => {
      window.__game.loadPreset(3);
      window.__game.setAutoplay(true, 'bot', true);
    });
    let signed = false;
    for (let step = 0; step < (MAX_MINUTES * 60 * 1000) / 5000 && !signed; step++) {
      await tick(pp, 5000);
      const snap = await pp.evaluate(SNAPSHOT);
      if (snap.stage !== 3) break;
      if (snap.pause && !snap.modalId) {
        await shot(pp, '07-pause-offered');
        await bringMotion(pp, 'p_pause');
        signed = true;
      }
    }
    const end = await pp.evaluate(() => {
      window.__game.tick(8000);
      const s = window.__game.state;
      const vis = (id) => document.getElementById(id).checkVisibility();
      return {
        ending: s.ending,
        screen: vis('endingScreen'),
        title: document.getElementById('endingTitle').innerText,
        sentence: document.getElementById('endingSentence').innerText,
        rows: document.querySelectorAll('#endingStats tr').length,
        trueRow: [...document.querySelectorAll('#endingStats tr')].some((tr) => /True alignment/.test(tr.innerText)),
        choices: document.querySelectorAll('#endingChoices div').length,
        tasks: s.tasks,
        button: vis('btn-endingTask'),
      };
    });
    if (end.button) await pp.click('#btn-endingTask');
    const after = await pp.evaluate(() => window.__game.state.tasks);
    await shot(pp, '08-the-pause', { fullPage: true });
    check('the Pause: signed when offered, the ending fires and the end screen renders', signed && end.ending === 'pause' && end.screen && end.title === 'The Pause' && /has not moved since/.test(end.sentence), JSON.stringify({ signed, ...end }));
    check('the Pause: the table prints true alignment, the choices are listed, Complete Task still adds one', end.trueRow && end.rows >= 15 && end.choices >= 5 && after === end.tasks + 1, `${end.rows} rows, ${end.choices} choices, tasks ${end.tasks} → ${after}`);
    await cp.close();
  }

  // ===== 5. The Project: the first-timer from the careless start refuses an order =====
  {
    const { context: cj, page: pj } = await freshPage('project');
    await pj.evaluate(() => {
      window.__game.loadPreset('3c');
      window.__game.setAutoplay(true, 'naive', true, 'refuse');
    });
    let refused = 0;
    let end = null;
    for (let step = 0; step < (MAX_MINUTES * 60 * 1000) / 3000; step++) {
      await tick(pj, 3000);
      const snap = await pj.evaluate(SNAPSHOT);
      if (snap.ending || snap.stage !== 3) {
        end = snap;
        break;
      }
      if (snap.modalId === 'c_order') {
        await pj.evaluate(() => window.__game.setAutoplay(false));
        const options = await pj.evaluate(() => [...document.querySelectorAll('#modalButtons button.modalButton')].map((b) => b.innerText.split('\n')[0]));
        const i = options.findIndex((o) => /refuse/.test(o));
        await pj.click(`#modalButtons button.modalButton >> nth=${i}`);
        refused++;
        await pj.evaluate(() => window.__game.setAutoplay(true, 'naive', true, 'refuse'));
      }
    }
    const screen = await pj.evaluate(() => ({
      ending: window.__game.state.ending,
      screen: document.getElementById('endingScreen').checkVisibility(),
      title: document.getElementById('endingTitle').innerText,
      sentence: document.getElementById('endingSentence').innerText,
      counter: document.getElementById('endingCounter').classList.contains('classified'),
      // The end screen is the page: nothing of the game is drawn, and the last choice is in the document.
      gameHidden: !document.getElementById('columns').checkVisibility() && !document.getElementById('topDiv').checkVisibility(),
      choicesInPage: (() => {
        const last = document.querySelector('#endingChoices div:last-child');
        if (!last) return false;
        const r = last.getBoundingClientRect();
        return r.bottom + window.scrollY <= document.documentElement.scrollHeight + 1;
      })(),
    }));
    await shot(pj, '09-the-project', { fullPage: true });
    check('the Project: an order refused while its cause stands ends the run, end screen rendered', screen.ending === 'project' && screen.screen && screen.title === 'The Project' && screen.counter && /classified/.test(screen.sentence), JSON.stringify({ refused, ...screen, stage: end?.stage }));
    check('the end screen covers the page: the game is not drawn, the Choices list scrolls with it', screen.gameHidden && screen.choicesInPage, JSON.stringify({ gameHidden: screen.gameHidden, choicesInPage: screen.choicesInPage }));
    await cj.close();
  }

  // ===== 5b. Capped clocks and the idle hold (critic S3 round 1 §9 items 1, 7) =====
  {
    const { context: ch, page: ph } = await freshPage('hold');
    await ph.evaluate(() => {
      window.__game.loadPreset(3);
      window.__game.setAutoplay(true, 'bot', true);
    });
    // To the first run waiting for its sign-off (Approve is the player's until Stop asking for sign-off).
    let waiting = false;
    for (let step = 0; step < 200 && !waiting; step++) {
      await tick(ph, 1000);
      waiting = await ph.evaluate(() => {
        const s = window.__game.state;
        const r = s.training.run;
        return !!r && r.phase === 'redteam' && !document.getElementById('btn-approve').disabled && document.getElementById('btn-approve').checkVisibility();
      });
    }
    await ph.evaluate(() => window.__game.setAutoplay(false));
    // Research stopped (a re-image): no clock past an hour, and the reason in its place.
    const clocks = await ph.evaluate(() => {
      const s = window.__game.state;
      s.effects.push({ id: 'reimage', remaining: 20, demandMult: 1, copiesMult: 0 });
      window.__game.tick(1000);
      const text = ['allocRate', 'trainStatus', 'experimentsNote'].map((id) => document.getElementById(id)?.innerText ?? '').join(' | ');
      return text;
    });
    check('capped clocks: no wait over an hour is printed as a clock; a stop says what stops research', !/\d{3,}:\d\d/.test(clocks) && /re-image/.test(clocks), clocks);
    // Idle with the sign-off waiting: two minutes, then the clocks hold; Approve brings a line saying so.
    await tick(ph, 150000);
    const held = await ph.evaluate(() => ({ held: window.__game.state.flags['held'] === true, what: window.__game.state.flags['waitWhat'] }));
    await ph.click('#btn-approve');
    const back = await narration(ph, 3);
    check('the idle hold: a sign-off waiting two minutes holds the Committee\'s count; the return says what was held', waiting && held.held && back.some((l) => /waited, the Committee's count.* and the incident clocks held for/.test(l)), `${JSON.stringify(held)} · ${back.filter((l) => /held/.test(l)).join(' | ') || back.slice(-2).join(' | ')}`);
    // The memo, opened and left: a timer with its careful default (§9 item 3), and the order the same.
    const timers = await ph.evaluate(() => {
      const out = {};
      for (const id of ['c_memo', 'c_order']) {
        window.__game.events.fire(id);
        window.__game.tick(1000);
        out[id] = document.getElementById('modalTimer').innerText;
        window.__game.state.activeChoice = null;
      }
      return out;
    });
    check('the memo and the order have a timer with a careful default (§9 item 3)', /\d+ s — then: take it to the Committee/.test(timers.c_memo) && /\d+ s — then: (concede oversight|call in favours|refuse)/.test(timers.c_order), JSON.stringify(timers));
    await ch.close();
  }

  // ===== 6. 390 px =====
  {
    const { context: cm, page: pm } = await freshPage('mobile', { width: 390, height: 844 });
    const width = await pm.evaluate(() => {
      window.__game.loadPreset(3);
      window.__game.setAutoplay(true, 'bot', true);
      window.__game.tick(20 * 60 * 1000);
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, stage: window.__game.state.stage };
    });
    await shot(pm, '11-mobile', { fullPage: true });
    check('390 px wide (Stage 3, minute 20): no horizontal overflow', width.scroll <= width.client + 1, `${width.scroll} vs ${width.client} (stage ${width.stage})`);
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
