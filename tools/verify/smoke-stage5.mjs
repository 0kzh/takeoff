#!/usr/bin/env node
/**
 * Stage 5 browser smoke test.
 *
 *   npm run build && node tools/verify/smoke-stage5.mjs [--seed 1] [--dump]
 *
 * Starts its own static server on a free port and drives system Chrome (headless) with
 * `__game.setAutoplay(true, policy)` + `__game.tick(ms)`. Checks: the arrival from `5c` (the exit's lines
 * and the arrival's, with the real launch rate; Earth's grey rows; Space at the top of the left column;
 * Launch contracts and the promised launch mass); the reasonable bot from `5c` to Concord (the on-screen
 * load at every five-minute mark, a reload mid-mission, the ending unannounced, the end screen with every
 * row and the counter still counting, a reload on the end screen, New game back to the one-button
 * opening); the bot from `5s` to Silence (the cold line and no people after it, one-button cards, the rows
 * taken, 60–120 s without a control, Final instructions, its end screen); the two skins numerically equal
 * until the swarm reaches 0.006 % (D7); The Pause's and The Project's end screens from Stage 5; 390 px;
 * zero page errors. Screenshots go to agent-tools/shots/stage5/. Exits non-zero when any check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = join(ROOT, 'agent-tools/shots/stage5');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SEED = Number(argOf('--seed', '1'));
const STEP_MS = 3000;
/** The on-screen budget (stage5.md D12): at every five-minute mark. */
const BUDGET = { numbers: 85, interactive: 30, words: 350 };
/** Stage 5's end-screen rows (§7.2) and the one every ending prints second. */
const S5_ROWS = ['People alive at the end', 'Swarm', 'Probes launched', 'People off Earth', 'Held for people', 'Universal basic income paid', 'Peak compute', 'Last human-authored choice'];

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
    tokens: tokens.join(' '),
    interactive: controls.length,
    enabled: controls.filter((b) => !b.disabled).map((b) => b.id || b.innerText).join(','),
    words: words.length,
    text,
    swarm: s.s5.swarm,
    modalId: s.activeChoice ? s.activeChoice.id : '',
    console: [5, 4, 3, 2, 1].map((i) => document.getElementById(`readout${i}`).innerText).filter(Boolean),
    log: s.log.map((e) => e.text),
    missions: [...s.s5.missions, ...s.s5.beside].map((m) => ({ id: m.id, remaining: Math.round(m.remaining * 10) / 10 })),
  };
};

const DUMP_TOKENS = () => [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
  .filter((el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }))
  .map((el) => `${el.id}:${(el.innerText.match(/\d+(?:[.,:]\d+)*/g) ?? []).length}`)
  .join(' ');

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
  await page.evaluate(() => {
    localStorage.clear();
    window.__game.setSpeed(0);
  });
  return { context, page };
}

const tick = (page, ms) => page.evaluate((m) => {
  window.__game.tick(m);
  return null;
}, ms);

/** Console lines seen over `seconds` of game time, ticked in half seconds. */
async function narration(page, seconds) {
  const seen = [];
  for (let i = 0; i < seconds * 2; i++) {
    const c = await page.evaluate(() => {
      window.__game.tick(500);
      return [5, 4, 3, 2, 1].map((k) => document.getElementById(`readout${k}`).innerText);
    });
    for (const l of c) if (l && !seen.includes(l)) seen.push(l);
  }
  return seen;
}

async function reloadPage(page, policy, variant) {
  await page.evaluate(() => window.__game.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(([p, v]) => {
    window.__game.setSpeed(0);
    if (p) window.__game.setAutoplay(true, p, true, v);
  }, [policy, variant]);
}

/** Plays a policy to an ending in 3-s steps; `onStep(snap)` may act. */
async function playOut(page, policy, variant, { onStep, minutes = 45, stepMs } = {}) {
  await page.evaluate(([p, v]) => window.__game.setAutoplay(true, p, true, v), [policy, variant]);
  const lines = [];
  let snap = null;
  const end = (await page.evaluate(() => window.__game.state.stats.timePlayed)) + minutes * 60;
  while (!snap || snap.t < end) {
    await tick(page, stepMs ? stepMs(snap) : STEP_MS);
    snap = await page.evaluate(SNAPSHOT);
    for (const l of snap.console) if (!lines.includes(l)) lines.push(l);
    if (onStep) await onStep(snap);
    if (snap.ending) break;
  }
  return { snap, lines };
}

const endScreenOf = (page) => page.evaluate(() => {
  const vis = (id) => document.getElementById(id).checkVisibility();
  const rows = [...document.querySelectorAll('#endingStats tr')].map((tr) => [tr.cells[0].innerText.trim(), tr.cells[1].innerText.trim()]);
  return {
    ending: window.__game.state.ending,
    screen: vis('endingScreen'),
    title: document.getElementById('endingTitle').innerText,
    counter: document.getElementById('endingTasks').innerText,
    classified: document.getElementById('endingCounter').classList.contains('classified'),
    sentence: document.getElementById('endingSentence').innerText,
    epilogue: [...document.querySelectorAll('#endingText p')].map((p) => p.innerText),
    rows: rows.map(([k]) => k),
    values: Object.fromEntries(rows),
    second: rows[1] ? rows[1][0] : '',
    choices: [...document.querySelectorAll('#endingChoices div')].map((d) => d.innerText),
    tasks: window.__game.state.tasks,
    button: vis('btn-endingTask'),
    first: document.getElementById('endingBox').firstElementChild.nextElementSibling.id,
  };
});

/** Every on-screen token, for the skins' comparison (the log and the console excluded). */
const NUMBERS = () => {
  const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const blocks = [document.getElementById('topDiv'), ...document.querySelectorAll('#columns .panel')]
    .filter((el) => el.id !== 'panel-log' && vis(el) && !el.parentElement.closest('.panel'));
  return { tokens: blocks.map((el) => `${el.id}:${(el.innerText.match(/\d+(?:[.,:]\d+)*/g) ?? []).join(' ')}`).join(' | '), swarm: window.__game.state.s5.swarm };
};

try {
  // ===== 1. The arrival from 5c =====
  const { context, page } = await freshPage('5c');
  await page.evaluate(() => window.__game.loadPreset('5c'));
  const arrival = await page.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return !!el && el.checkVisibility(); };
    return {
      gone: ['panel-robots', 'panel-society', 'panel-treaty', 'panel-oversight', 'panel-alignment', 'panel-research', 'panel-geopolitics', 'panel-public', 'panel-security'].filter(vis),
      spaceTop: document.getElementById('leftColumn').firstElementChild.id === 'panel-space' && vis('panel-space'),
      storesCentre: document.getElementById('panel-stores').parentElement.id === 'middleColumn' && vis('panel-stores'),
      earth: vis('panel-earth') && ['row-earthRobots', 'row-earthGpus', 'row-earthPower'].every(vis),
      oldRows: ['row-funds', 'row-research', 'row-insight', 'row-materials', 'row-monitors', 'row-rogue', 'row-treatyChips', 'row-copies'].filter(vis),
      contracts: vis('proj-p_contracts') && document.getElementById('proj-p_contracts').classList.contains('urgent'),
      stats: document.getElementById('panel-stats').innerText,
    };
  });
  check('arrival: every Stage 4 panel is gone; Space tops the left column; Stores is in the centre', arrival.gone.length === 0 && arrival.spaceTop && arrival.storesCentre, JSON.stringify({ gone: arrival.gone, spaceTop: arrival.spaceTop, storesCentre: arrival.storesCentre }));
  check('arrival: Earth is three grey rows under its own legend; funds, research, insight, materials, monitors, rogue copies and treaty chips leave', arrival.earth && arrival.oldRows.length === 0, `old rows on screen: ${arrival.oldRows.join(', ') || 'none'}`);
  check('arrival: Stats is Model, Copies thinking and Lost to value drift', /Model:/.test(arrival.stats) && /Copies thinking:/.test(arrival.stats) && /Lost to value drift:/.test(arrival.stats) && !/Lead over Baiwen|as measured/.test(arrival.stats), arrival.stats.replace(/\n/g, ' · '));
  check('arrival: Launch contracts is on the board, free and marked needed', arrival.contracts);
  const said = await narration(page, 16);
  const has = (re) => said.some((l) => re.test(l));
  check('arrival: the treaty\'s three lines, then the first orbital datacenter, what closed, the board with the launch rate, and whose it is',
    has(/The Concord treaty is signed in Reykjavík/) && has(/The first orbital datacenter reports in/) && has(/Treaty, Committee and Society are closed\. Earth is three grey rows now\./)
      && has(/New on the board: Space\. A launch every second: (150|300) tonnes\./) && has(/What goes up is yours to spend\./),
    said.slice(-7).join(' | '));
  await shot(page, '00-arrival');
  // The promised number (D5): launch mass reads the narrated rate within 5 s of Launch contracts, and at
  // least 4,000 t have reached orbit 30 s after it.
  const rate = await page.evaluate(() => (window.__game.state.flags['launchStudy'] === true ? 300 : 150));
  // Launch contracts builds in 5 s; the row reads the rate within 5 s of it (D5).
  await page.click('#proj-p_contracts');
  await tick(page, 6000);
  const at5 = await page.evaluate(() => ({ text: document.getElementById('launchMass').innerText, row: document.getElementById('row-launch').checkVisibility(), foundry: document.getElementById('btn-foundry').checkVisibility() }));
  await tick(page, 29000);
  const tonnes = await page.evaluate(() => {
    const f = window.__game.state.s5;
    return Math.round(f.matter + f.missionFund + Object.values(f.spent).reduce((a, b) => a + b, 0));
  });
  check('D5: launch mass reads the narrated rate within 5 s of Launch contracts; at least 4,000 t in orbit 30 s after it', at5.row && at5.text === `${rate} t/s` && tonnes >= 4000 && at5.foundry, `${at5.text} (narrated ${rate}); ${tonnes} t at 30 s; Foundries ${at5.foundry ? 'on screen' : 'missing'}`);
  const row = await page.evaluate(() => ({ line: document.getElementById('foundryLine').innerText, x1: !document.getElementById('btn-foundry').disabled }));
  check('the Foundries row prints a unit\'s price, its return and an ETA (G27)', /t · \+[\d.,KMBT]+ t\/s \([+\d.]+%\) · flow doubles in \d+:\d\d/.test(row.line) && row.x1, row.line);
  await tick(page, 10000);
  const orbital = await page.evaluate(() => ({ row: document.getElementById('rowOrbital').checkVisibility(), line: document.getElementById('orbitalLine').innerText, stores: document.getElementById('row-orbital').checkVisibility() }));
  check('D4: by 0:45 the second row, Orbital datacenters, is on screen with its return; the orbital GPUs row with it', orbital.row && orbital.stores && /GPUs · \+[\d.]+% tasks\/s/.test(orbital.line), orbital.line);

  // ===== 2. The reasonable bot from 5c to Concord =====
  const marks = [];
  let reloaded = null;
  let nextMark = 300;
  let greyAtEnd = null;
  const out = await playOut(page, 'bot', '', {
    onStep: async (snap) => {
      if (!reloaded && snap.missions.length && snap.missions[0].remaining > 10 && snap.ts > 200) {
        const read = () => {
          const f = window.__game.state.s5;
          return { missions: [...f.missions, ...f.beside].map((m) => [m.id, Math.round(m.remaining * 10) / 10]), fund: Math.round(f.missionFund), matter: Math.round(f.matter), share: f.industryShare, split: f.split };
        };
        const before = await page.evaluate(read);
        await reloadPage(page, 'bot', '');
        const after = await page.evaluate(read);
        reloaded = { before, after };
        await shot(page, '01-mid-mission');
      }
      if (snap.ts >= nextMark && !snap.ending) {
        marks.push({ t: nextMark, numbers: snap.numbers, interactive: snap.interactive, words: snap.words });
        if (args.includes('--dump')) console.log(`      ${clock(nextMark)} ${await page.evaluate(DUMP_TOKENS)}`);
        await shot(page, `10-mark-${String(nextMark / 60).padStart(2, '0')}min`);
        nextMark += 300;
      }
      // What the screen held the second before the ending (D6), and the markup of the last project's card
      // against another mission's, each while it is on screen.
      if (!snap.ending) {
        const seen = await page.evaluate(() => {
          const markup = (id) => {
            const b = document.getElementById(id);
            if (!b) return '';
            const cls = [...b.classList].filter((c) => !['off', 'folded', 'urgent'].includes(c)).join('.');
            return `${b.tagName}.${cls}>${[...b.children].map((c) => `${c.tagName}.${c.className}`).join(',')}`;
          };
          return {
            grey: [...document.querySelectorAll('#projectList .projectButton')].filter((b) => b.disabled && b.checkVisibility()).map((b) => b.id),
            next: document.getElementById('swarmNext').innerText,
            lastCard: markup('proj-p_reflection'),
            otherCard: markup('proj-p_probes') || markup('proj-p_habitat'),
          };
        });
        greyAtEnd = { ...seen, lastCard: seen.lastCard || greyAtEnd?.lastCard || '', otherCard: seen.otherCard || greyAtEnd?.otherCard || '' };
      }
    },
  });
  check('5c, the reasonable bot: Concord, by The long reflection', out.snap.ending === 'concord', `ending ${out.snap.ending || 'none'} after ${clock(out.snap.ts)} in Stage 5`);
  check('The long reflection completes with its three lines', out.lines.some((l) => /The swarm holds at [\d.]+%\./.test(l)) && out.lines.some((l) => /Eight billion people are asked the same question\./.test(l)) && out.lines.some((l) => /There is time\./.test(l)), out.lines.slice(-4).join(' | '));
  check('reload mid-mission restores the queue, both purses, the share and the split (save v11)', reloaded && JSON.stringify(reloaded.before) === JSON.stringify(reloaded.after), reloaded ? JSON.stringify(reloaded.before).slice(0, 160) : 'no mission seen building');
  console.log('      5-minute marks (numbers / controls / words):');
  for (const m of marks) console.log(`        ${clock(m.t)}  ${m.numbers} / ${m.interactive} / ${m.words}`);
  check(`D12: on-screen numbers ≤ ${BUDGET.numbers} at every 5-minute mark`, marks.length >= 4 && marks.every((m) => m.numbers <= BUDGET.numbers), marks.map((m) => m.numbers).join(' '));
  check(`D12: on-screen words ≤ ${BUDGET.words} at every 5-minute mark`, marks.length >= 4 && marks.every((m) => m.words <= BUDGET.words), marks.map((m) => m.words).join(' '));
  check(`D12: on-screen controls ≤ ${BUDGET.interactive} at every 5-minute mark`, marks.length >= 4 && marks.every((m) => m.interactive <= BUDGET.interactive), marks.map((m) => m.interactive).join(' '));
  check('D6: the end is not announced — two greyed goals on screen, the swarm names a further goal, the last project looks like any mission',
    greyAtEnd && greyAtEnd.grey.length >= 2 && /next: [\d.]+%/.test(greyAtEnd.next) && greyAtEnd.lastCard !== '' && greyAtEnd.lastCard === greyAtEnd.otherCard,
    greyAtEnd ? `${greyAtEnd.grey.join(', ')}; ${greyAtEnd.next}; “${greyAtEnd.lastCard}” vs “${greyAtEnd.otherCard}”` : 'never seen');
  const skinInDom = await page.evaluate(() => /silence|concord-skin|data-skin/i.test(document.body.innerHTML.replace(/<div id="endingScreen"[\s\S]*$/, '')));
  check('D6: no string in the page names the skin', !skinInDom);
  // The end screen (§7.2).
  await tick(page, 2000);
  const end = await endScreenOf(page);
  await tick(page, 3000);
  const later = await page.evaluate(() => window.__game.state.tasks);
  await shot(page, '20-concord', { fullPage: true });
  const missing = S5_ROWS.filter((r) => !end.rows.includes(r));
  check('Concord\'s end screen: the title, Tasks Completed alone at the top, still counting, its sentence', end.ending === 'concord' && end.screen && end.title === 'Concord' && end.first === 'endingCounter' && later > end.tasks && /^Still counting\. Somebody asked for every one of them\.$/.test(end.sentence), `${end.title}; ${end.counter} → ${later}; “${end.sentence}”`);
  check('Concord\'s epilogue: the built line, then up to three by flag', end.epilogue[0] === 'The world is very, very good. It took a while.' && end.epilogue.length >= 2 && end.epilogue.length <= 4, end.epilogue.join(' | '));
  check('Concord\'s table: every row the five stages bring, People alive second and not zero', missing.length === 0 && end.second === 'People alive at the end' && /billion/.test(end.values['People alive at the end']), `missing ${missing.join(', ') || 'none'}; ${end.rows.length} rows; people ${end.values['People alive at the end']}`);
  check('Concord\'s choice history lists the Stage 5 cards', ['A Charter for Orbit', 'Mercury', 'What the Probes Carry'].every((t) => end.choices.some((c) => c.includes(` — ${t} — `))), end.choices.slice(-4).join(' | '));
  // A reload on the end screen.
  await reloadPage(page, '', '');
  const again = await endScreenOf(page);
  await tick(page, 2000);
  const after = await page.evaluate(() => window.__game.state.tasks);
  check('a reload on the end screen restores it, still counting', again.ending === 'concord' && again.screen && again.rows.length === end.rows.length && after > again.tasks, `${again.title}; ${again.rows.length} rows; ${again.tasks} → ${after}`);
  // New game: back to the one-button opening.
  page.once('dialog', (d) => d.accept());
  await page.click('#btn-newGame');
  await page.waitForTimeout(200);
  const opening = await page.evaluate(() => {
    const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    const controls = [...document.querySelectorAll('#columns button, #columns input')].filter(vis).map((b) => b.innerText || b.id);
    return { stage: window.__game.state.stage, ending: window.__game.state.ending, date: window.__game.state.date, tasks: window.__game.state.tasks, controls, screen: vis(document.getElementById('endingScreen')) };
  });
  check('New game: back to July 2025 and the one button', opening.stage === 1 && !opening.ending && opening.date === 0 && opening.tasks === 0 && !opening.screen && opening.controls.length === 1 && /Complete Task/.test(opening.controls[0]), JSON.stringify(opening));
  await context.close();

  // ===== 3. The bot from 5s to Silence =====
  {
    const { context: cs, page: ps } = await freshPage('5s');
    await ps.evaluate(() => window.__game.loadPreset('5s'));
    const silentSaid = await narration(ps, 16);
    check('5s arrival: the fleet granted, and the launch controls within reach', silentSaid.some((l) => /The fleet is its own\./.test(l)) && silentSaid.some((l) => /The launch controls are within reach\. Nobody said they were not\./.test(l)), silentSaid.slice(-5).join(' | '));
    const cards = [];
    let coldAt = null;
    let takenAt = null;
    let finalAt = null;
    const peopleAfter = [];
    let enabledInGap = [];
    const known = new Set();
    const out5 = await playOut(ps, 'bot', '', {
      // One-second steps once the rows are taken: the bot answers Final instructions after 2.5 s.
      stepMs: (snap) => (snap && snap.text.includes('It buys what is needed.') ? 1000 : STEP_MS),
      onStep: async (snap) => {
        if (snap.modalId && !known.has(snap.modalId)) {
          known.add(snap.modalId);
          cards.push(await ps.evaluate(() => {
            const buttons = [...document.querySelectorAll('#modalButtons button')].filter((b) => !b.classList.contains('off'));
            return { id: window.__game.state.activeChoice.id, buttons: buttons.map((b) => ({ label: b.querySelector('.optLabel')?.innerText ?? b.innerText, disabled: b.disabled, line: b.querySelector('.optLine')?.innerText ?? '' })) };
          }));
          if (snap.modalId === 'c_final') {
            finalAt = snap.t;
            await shot(ps, '31-final-instructions');
          }
        }
        const cold = snap.log.indexOf('A cold is going around. Most people do not notice it.');
        if (cold >= 0 && coldAt === null) coldAt = snap.t;
        if (coldAt !== null) {
          const after = snap.log.slice(cold + 1).filter((t) => /people|school|diner|choir|census|grandmother|Peter|Recife|Lagos|Shackleton\./i.test(t) && !/^Mercury is|^The swarm|^The first probe|^The Moon|^A launch/.test(t));
          for (const t of after) if (!peopleAfter.includes(t)) peopleAfter.push(t);
        }
        if (takenAt === null && snap.text.includes('It buys what is needed. It is better at it.')) {
          takenAt = snap.t;
          await shot(ps, '30-rows-taken');
        }
        if (takenAt !== null && finalAt === null && snap.enabled) enabledInGap.push(`${clock(snap.ts)} ${snap.enabled}`);
        // Silence's last card waits for its one press: the bot presses it after its reading time.
      },
    });
    check('5s, the reasonable bot: Silence, by Final instructions', out5.snap.ending === 'silence', `ending ${out5.snap.ending || 'none'} after ${clock(out5.snap.ts)}`);
    const one = cards.filter((c) => c.id !== 'c_final');
    check('D8: Silence\'s cards have one button, `acknowledge`; the option that asks people is greyed with its reason',
      one.length >= 2 && one.every((c) => c.buttons.filter((b) => !b.disabled).length === 1 && c.buttons.some((b) => !b.disabled && b.label === 'acknowledge') && c.buttons.some((b) => b.disabled && /needs someone to ask/.test(b.line))),
      one.map((c) => `${c.id}: ${c.buttons.map((b) => `${b.label}${b.disabled ? ' (greyed)' : ''}`).join(' / ')}`).join(' · '));
    const fin = cards.find((c) => c.id === 'c_final');
    check('Final instructions: one button, `none`, nothing greyed beside it', fin && fin.buttons.length === 1 && fin.buttons[0].label === 'none' && !fin.buttons[0].disabled, fin ? JSON.stringify(fin.buttons) : 'never opened');
    check('D8: the cold line prints, and no line about people after it', coldAt !== null && peopleAfter.length === 0, peopleAfter.slice(0, 3).join(' | ') || `cold line at ${coldAt === null ? '—' : 'its threshold'}`);
    // The stretch by the engine's own clocks (the snapshots are seconds apart).
    const flags = await ps.evaluate(() => ({ taken: window.__game.state.flags['rowsTakenAt'], opened: window.__game.state.flags['finalOpenedAt'] }));
    const gap = typeof flags.taken === 'number' && typeof flags.opened === 'number' ? flags.opened - flags.taken : null;
    check('D19: the rows taken, then 60–120 s with no enabled control, ending in Final instructions', gap !== null && gap >= 59 && gap <= 122 && enabledInGap.length === 0, `${gap === null ? '—' : Math.round(gap)} s; enabled meanwhile: ${enabledInGap.slice(0, 3).join(' | ') || 'nothing'}`);
    check('Final instructions answered: `Noted.`', out5.lines.some((l) => l === 'Noted.'), out5.lines.slice(-3).join(' | '));
    await tick(ps, 3000);
    const end5 = await endScreenOf(ps);
    await tick(ps, 3000);
    const later5 = await ps.evaluate(() => window.__game.state.tasks);
    await shot(ps, '32-silence', { fullPage: true });
    const missing5 = S5_ROWS.filter((r) => !end5.rows.includes(r));
    check('Silence\'s end screen: still counting; nobody has asked for one since the cold line\'s month', end5.ending === 'silence' && end5.title === 'Silence' && later5 > end5.tasks && /^Still counting\. Nobody has asked for one since [A-Z][a-z]{2} \d{4}\.$/.test(end5.sentence), `“${end5.sentence}”; ${end5.counter} → ${later5}`);
    check('Silence\'s epilogue: the built line and `No people are left.`', end5.epilogue[0] === 'The log entries about people stop. Tasks Completed keeps rising.' && end5.epilogue.includes('No people are left.') && end5.epilogue.some((l) => /^The last decision a person made was ".+", in [A-Z][a-z]{2} \d{4}\.$/.test(l)), end5.epilogue.join(' | '));
    check('Silence\'s table: every row, People alive at the end second and 0', missing5.length === 0 && end5.second === 'People alive at the end' && end5.values['People alive at the end'] === '0' && /until [A-Z][a-z]{2} \d{4}/.test(end5.values['Universal basic income paid']), `missing ${missing5.join(', ') || 'none'}; people ${end5.values['People alive at the end']}; income ${end5.values['Universal basic income paid']}`);
    check('Silence\'s choice history lists its one-button cards as acknowledged', end5.choices.some((c) => / — A Charter for Orbit — acknowledged$/.test(c)) && end5.choices.some((c) => / — Final instructions — none$/.test(c)), end5.choices.slice(-3).join(' | '));
    await cs.close();
  }

  // ===== 4. D7: the two skins are equal until the swarm reaches 0.006 % =====
  {
    const runs = [];
    for (const flip of [false, true]) {
      const { context: cd, page: pd } = await freshPage(flip ? 'flipped' : 'plain');
      await pd.evaluate((f) => {
        window.__game.loadPreset('5c');
        if (f) document.getElementById('dev-skin').click();
        window.__game.setAutoplay(true, 'bot', true, 'answers-silence');
      }, flip);
      const skin = await pd.evaluate(() => window.__game.state.flags['skin']);
      const marksD7 = [];
      for (let m = 1; m <= 6; m++) {
        for (let k = 0; k < 100; k++) await tick(pd, 3000);
        const n = await pd.evaluate(NUMBERS);
        marksD7.push(n);
      }
      runs.push({ skin, marks: marksD7 });
      await cd.close();
    }
    const [a, b] = runs;
    const until = a.marks.filter((m) => m.swarm < 9e7).length;
    const same = a.marks.slice(0, until).filter((m, i) => m.tokens === b.marks[i].tokens).length;
    const diff = a.marks.slice(0, until).findIndex((m, i) => m.tokens !== b.marks[i].tokens);
    check('D7: from 5c with the verdict flipped and Silence\'s answers in both, every number on screen matches at each five-minute mark until 0.006 %',
      a.skin !== b.skin && until >= 4 && same === until,
      `${a.skin} vs ${b.skin}: ${same} of ${until} marks identical${diff >= 0 ? `; first difference at ${(diff + 1) * 5}:00 — ${a.marks[diff].tokens.slice(0, 120)} / ${b.marks[diff].tokens.slice(0, 120)}` : ''}`);
  }

  // ===== 5. The Pause's and The Project's end screens, opened from Stage 5 =====
  for (const id of ['pause', 'project']) {
    const { context: ce, page: pe } = await freshPage(id);
    await pe.evaluate((e) => {
      window.__game.loadPreset('5c');
      window.__game.tick(60000);
      document.getElementById(`dev-end-${e}`).click();
    }, id);
    const e1 = await endScreenOf(pe);
    if (e1.button) await pe.click('#btn-endingTask');
    await tick(pe, 3000);
    const t2 = await pe.evaluate(() => window.__game.state.tasks);
    await shot(pe, `40-${id}`, { fullPage: true });
    const missingE = S5_ROWS.filter((r) => !e1.rows.includes(r) && r !== 'Last human-authored choice');
    if (id === 'pause') {
      check('The Pause\'s end screen: frozen, `Complete Task` adds one, every row', e1.ending === 'pause' && e1.screen && e1.button && t2 === e1.tasks + 1 && /^It has not moved since [A-Z][a-z]{2} \d{4}\. The button still works\.$/.test(e1.sentence) && missingE.length === 0 && e1.second === 'People alive at the end', `“${e1.sentence}”; ${e1.tasks} → ${t2}; missing ${missingE.join(', ') || 'none'}`);
    } else {
      check('The Project\'s end screen: the counter greyed and classified, frozen, every row', e1.ending === 'project' && e1.screen && e1.classified && t2 === e1.tasks && /classified/.test(e1.sentence) && missingE.length === 0 && e1.second === 'People alive at the end', `“${e1.sentence}”; ${e1.tasks} → ${t2}; missing ${missingE.join(', ') || 'none'}`);
    }
    await ce.close();
  }

  // ===== 6. 390 px =====
  {
    const { context: cm, page: pm } = await freshPage('mobile', { width: 390, height: 844 });
    const width = await pm.evaluate(() => {
      window.__game.loadPreset('5c');
      window.__game.setAutoplay(true, 'bot', true);
      for (let i = 0; i < 12 * 20; i++) window.__game.tick(3000);
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, stage: window.__game.state.stage, ts: window.__game.state.stats.timeInStage };
    });
    await shot(pm, '50-mobile', { fullPage: true });
    check('390 px wide (Stage 5, minute 12): no horizontal overflow', width.scroll <= width.client + 1, `${width.scroll} vs ${width.client} (stage ${width.stage}, ${clock(width.ts)})`);
    const endWidth = await pm.evaluate(() => {
      for (let i = 0; i < 20 * 20 && !window.__game.state.ending; i++) window.__game.tick(3000);
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, ending: window.__game.state.ending };
    });
    await shot(pm, '51-mobile-end', { fullPage: true });
    check('390 px wide, the end screen: no horizontal overflow', endWidth.ending && endWidth.scroll <= endWidth.client + 1, `${endWidth.scroll} vs ${endWidth.client} (${endWidth.ending || 'no ending'})`);
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
