#!/usr/bin/env node
/**
 * Stage 2 browser verification.
 *
 *   npm run build && node tools/verify/stage2.ts [--seed 1]
 *
 * Does not build: it serves dist/ as the caller built it (run `npm run build` first, as for smoke.ts).
 * Starts its own static server on a free port and drives the game in system Chrome (headless) through
 * the in-page `window.__game` debug API: `loadPreset(2)` for the Stage 2 arrival (built from the Stage 1
 * end preset), `setSpeed(0)`, `setAutoplay(true)` and `tick(ms)` in 2-s steps.
 *
 * Checks, in three fresh pages (a crash in one does not stop the others):
 *  1. The arrival, paused: no page or console errors; no Complete Task; the Infrastructure panel with
 *     Buy GPUs, Build Datacenter and Expand Grid; the capability header; no alignment strip and no Race
 *     panel yet; a project card within 15 s and exactly one greyed card at some point in the first minute.
 *  2. The reveal order under autoplay, for up to 40 minutes of game time (stopping at Stage 3): the
 *     first time each of the Race panel, the Data row, the tempo row, the Security row, the alignment
 *     strip, Public, Government, Automate the Lab, the queued-run row and the Training pipeline card is
 *     CSS-visible. The Race panel within 3 min; Data before the alignment strip; Public and Government
 *     together; Automate the Lab before Stage 3 and greyed when first seen; tempo no later than security;
 *     no two first appearances within 15 s (Public/Government count once; reveals that come with the Stage 3
 *     transition itself are listed but not spaced); Stage 3 within 40 min; a greyed goal (a disabled card
 *     or Automate the Lab) on >= 95 % of 2-s samples from the first card. Every dialog title seen is
 *     listed with its stage time (dialogs the bot answers between two samples are recovered from
 *     `state.choicesMade`); at least `Deploy or keep internal?`, `The Senate Hearing` and `The Data Wall`.
 *  3. The dev overlay's Stage 2 checkpoints (`#dev-s2-arrival|datawall|baiwen|alignment|final`, open
 *     with ?dev=1): each loads without errors into Stage 2 (final: 2 or 3) with the Infrastructure panel
 *     up, with a screenshot each. At `baiwen`: a run started with Train (funds and compute granted until
 *     it can be pressed), 10 s, `__game.save()`, reload without a preset: the run and the stage survive.
 *     At `alignment`: no horizontal overflow at 1280x720 and the page at most 1.5x the viewport tall;
 *     at 390 px no horizontal overflow and the alignment strip no wider than the viewport. At `final`: an
 *     open dialog closes on its first enabled option, else `c_theft` fires as `Weight Theft` and closes on
 *     `#choice-c_theft-0`.
 * Screenshots go to agent-tools/shots/stage2/. Exits non-zero when any check fails.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SITE = join(ROOT, 'dist');
const SHOTS = join(ROOT, 'agent-tools/shots/stage2');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SEED = Number(argOf('--seed', '1'));
const STEP_MS = 2000;
const MAX_MINUTES = 40;
const VIEWPORT = { width: 1280, height: 720 };

// ---------- static server on a free port ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(SITE, path));
  if (!file.startsWith(SITE + '/')) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/`;

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
  page.on('pageerror', (e) => {
    const where = (e.stack || '').split('\n')[1];
    errors.push(`${label} pageerror: ${e.message}${where ? ` @ ${where.trim()}` : ''}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => errors.push(`${label} requestfailed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${label} HTTP ${r.status()} ${r.url()}`);
  });
}

/** Elements whose first appearance the reveal run records, in the order the checks name them. */
const TARGETS = [
  'panel-race',
  'dataRow',
  'tempoRow',
  'securityRow',
  'alignmentStrip',
  'panel-public',
  'panel-government',
  'proj-s2_automate',
  'train-queued',
  'proj-s2_pipeline',
];
/** Everything a snapshot reports visibility for. */
const WATCH = [
  ...TARGETS,
  'panel-infrastructure',
  'btn-task',
  'btn-gpuBatch',
  'btn-datacenter',
  'btn-expandGrid',
  'capabilityHeader',
  'btn-train',
  'btn-release',
  'raceGraph',
];

/** Advances the game (when ms > 0) and reads what the test watches. Runs in the page. Returns null
 * when the debug API is gone: React removes it when it unmounts the root after a render error. */
const STEP = (arg: { ms: number; ids: string[] }) => {
  const g = window.__game;
  if (!g) return null;
  if (arg.ms > 0) g.tick(arg.ms);
  const s = g.state;
  const vis = (id: string) => {
    const el = document.getElementById(id);
    return !!el && el.checkVisibility();
  };
  const stage2At = typeof s.flags['stage2At'] === 'number' ? (s.flags['stage2At'] as number) : 0;
  const projects = [...document.querySelectorAll<HTMLButtonElement>('.projectButton')].filter((b) =>
    b.checkVisibility(),
  );
  const overlay = document.getElementById('modalOverlay');
  const modalOpen = !!overlay && overlay.classList.contains('shown');
  const visible: Record<string, boolean> = {};
  for (const id of arg.ids) visible[id] = vis(id);
  const enabled = (id: string) => {
    const b = document.getElementById(id) as HTMLButtonElement | null;
    return !!b && b.checkVisibility() && !b.disabled;
  };
  const run = s.training.run;
  return {
    t: s.stats.timePlayed - stage2At,
    stage: s.stage,
    visible,
    projects: projects.map((b) => ({ id: b.id, disabled: b.disabled })),
    modal: modalOpen ? document.getElementById('modalTitle').innerText.trim() : '',
    choiceId: s.activeChoice ? s.activeChoice.id : '',
    choices: s.choicesMade.map((c) => c.id),
    run: run ? { name: run.name, phase: run.phase, elapsed: run.elapsed } : null,
    trainEnabled: enabled('btn-train'),
    releaseEnabled: enabled('btn-release'),
    graphLines: vis('raceGraph') ? document.querySelectorAll('#raceGraph polyline').length : -1,
  };
};
async function probe(page, ms) {
  const x = await page.evaluate(STEP, { ms, ids: WATCH });
  if (!x)
    throw new Error(
      `window.__game is gone (the React root unmounted after a render error?): ${errors.slice(-3).join(' | ') || 'no page errors recorded'}`,
    );
  return x;
}
const snap = (page) => probe(page, 0);
const step = (page, ms = STEP_MS) => probe(page, ms);
/** A DOM click: works on the dev overlay's buttons whether or not the overlay is on screen. */
const click = (page, id) =>
  page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el) return false;
    el.click();
    return true;
  }, id);

/** CSS fade-ins run on real time; let them finish. The dev overlay would cover the right of a 720-px
 * viewport, so it is off for the picture (React leaves the class alone: its prop has not changed). */
async function shot(page, name, opts = {}) {
  await page.evaluate(() => document.getElementById('dev')?.classList.remove('open'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(SHOTS, `${name}.png`), ...opts });
  await page.evaluate(() => document.getElementById('dev')?.classList.add('open'));
}

async function freshPage(label, viewport = VIEWPORT) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${BASE}?seed=${SEED}&speed=0&dev=1`);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.setSpeed(0));
  return { context, page };
}

/** The Stage 2 arrival from the Stage 1 end preset, paused. */
async function arrivalPage(label) {
  const { context, page } = await freshPage(label);
  await page.evaluate(() => {
    window.__game.loadPreset(2);
    window.__game.setSpeed(0);
  });
  return { context, page };
}

/** Reloads a page whose React root has gone (the save, if any, loads). */
async function revive(page) {
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.setSpeed(0));
}

async function phase(name, body) {
  try {
    await body();
  } catch (e) {
    check(
      `${name}: ran to completion`,
      false,
      e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : String(e),
    );
  }
}

// ===== 1. The arrival, paused =====
await phase('arrival', async () => {
  const { context, page } = await arrivalPage('arrival');
  const a = await snap(page);
  const buttons = ['btn-gpuBatch', 'btn-datacenter', 'btn-expandGrid'].filter((id) => a.visible[id]);
  check('arrival: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('arrival: the preset lands in Stage 2', a.stage === 2, `stage ${a.stage}`);
  check('arrival: Complete Task is gone', !a.visible['btn-task']);
  check(
    'arrival: Infrastructure panel with Buy GPUs, Build Datacenter and Expand Grid',
    a.visible['panel-infrastructure'] && buttons.length === 3,
    `panel ${a.visible['panel-infrastructure'] ? 'shown' : 'hidden'}; buttons ${buttons.join(', ') || 'none'}`,
  );
  check('arrival: the capability header is shown', a.visible['capabilityHeader']);
  check('arrival: no alignment strip yet', !a.visible['alignmentStrip']);
  check('arrival: no Race panel yet', !a.visible['panel-race']);
  await shot(page, '00-arrival');
  let firstProject = null;
  let oneGreyed = null;
  const greyCounts = new Set<number>();
  for (let i = 0; i < 30; i++) {
    const x = await step(page);
    if (firstProject === null && x.projects.length)
      firstProject = { t: x.t, ids: x.projects.map((p) => `${p.id}${p.disabled ? ' (grey)' : ''}`) };
    const grey = x.projects.filter((p) => p.disabled).length;
    if (x.projects.length) greyCounts.add(grey);
    if (oneGreyed === null && grey === 1)
      oneGreyed = { t: x.t, id: x.projects.find((p) => p.disabled).id, cards: x.projects.length };
  }
  check(
    'arrival: a project card within 15 s',
    firstProject !== null && firstProject.t <= 15,
    firstProject ? `${clock(firstProject.t)}: ${firstProject.ids.join(', ')}` : 'no card in the first minute',
  );
  check(
    'arrival: exactly one greyed card at some point in the first minute',
    oneGreyed !== null,
    oneGreyed
      ? `${clock(oneGreyed.t)}: ${oneGreyed.id} greyed, ${oneGreyed.cards} card${oneGreyed.cards === 1 ? '' : 's'} shown`
      : `greyed-card counts seen: ${[...greyCounts].join(', ') || 'no cards'}`,
  );
  await shot(page, '01-arrival-1min');
  await context.close();
});

// ===== 2. The reveal order under autoplay =====
await phase('reveal', async () => {
  const { context, page } = await arrivalPage('reveal');
  const errorsBefore = errors.length;
  await page.evaluate(() => window.__game.setAutoplay(true));
  // Dialog ids → titles, for dialogs the bot answers between two samples.
  const titleOf: Record<string, string> = await page.evaluate(() =>
    Object.fromEntries(window.__game.events.fireable.map((e) => [e.id, e.label.replace(/^[a-z]+: /, '')])),
  );
  const first = new Map<string, number>();
  let automateGreyFirst = null;
  let raceLines = null;
  const modals = []; // { t, title, id, between }
  let stage3At = null;
  let firstProjectAt = null;
  let lastT = 0;
  const goal = { ticks: 0, ok: 0, misses: [] };
  const shotsDone = new Set<string>();
  let prev = await snap(page);
  for (const id of TARGETS) if (prev.visible[id]) first.set(id, prev.t);
  let runError = null;
  try {
    while (true) {
      const x = await step(page);
      lastT = x.t;
      for (const id of TARGETS) {
        if (!x.visible[id] || first.has(id)) continue;
        first.set(id, x.t);
        if (id === 'proj-s2_automate') {
          const card = x.projects.find((p) => p.id === id);
          automateGreyFirst = card ? card.disabled : null;
        }
        if (id === 'panel-race') raceLines = x.graphLines;
      }
      if (x.choiceId && x.choiceId !== prev.choiceId)
        modals.push({
          t: x.t,
          title: x.modal || titleOf[x.choiceId] || x.choiceId,
          id: x.choiceId,
          between: false,
        });
      for (const id of x.choices.slice(prev.choices.length)) {
        if (id === prev.choiceId || id === x.choiceId) continue;
        modals.push({ t: x.t, title: titleOf[id] ?? id, id, between: true });
      }
      if (firstProjectAt === null && x.projects.length) firstProjectAt = x.t;
      if (firstProjectAt !== null && x.stage === 2) {
        goal.ticks++;
        if (x.projects.some((p) => p.disabled) || x.visible['proj-s2_automate']) goal.ok++;
        else if (goal.misses.length < 8) goal.misses.push(clock(x.t));
      }
      if (first.has('panel-race') && !shotsDone.has('race')) {
        shotsDone.add('race');
        await shot(page, '02-race-panel');
      }
      if (first.has('alignmentStrip') && !shotsDone.has('align')) {
        shotsDone.add('align');
        await shot(page, '03-alignment-strip');
      }
      if (x.stage >= 3) {
        stage3At = x.t;
        await shot(page, '04-stage3');
        break;
      }
      prev = x;
      if (x.t >= MAX_MINUTES * 60) {
        await shot(page, '04-end-40min');
        break;
      }
    }
  } catch (e) {
    runError = e;
  }

  const at = (id) => (first.has(id) ? first.get(id) : Infinity);
  const withStage3 = (id) => stage3At !== null && first.has(id) && at(id) >= stage3At;
  const when = (id) =>
    first.has(id) ? `${clock(at(id))}${withStage3(id) ? ' (with Stage 3)' : ''}` : 'never';
  check(
    'reveal: the autoplay run survives to Stage 3 or 40 min',
    runError === null,
    runError
      ? `died at ${clock(lastT)}: ${String(runError.message || runError).split('\n')[0]}`
      : `ran to ${clock(lastT)}`,
  );
  check(
    'reveal: no page or console errors during the autoplay run',
    errors.length === errorsBefore,
    errors.slice(errorsBefore, errorsBefore + 3).join(' | '),
  );
  check(
    'reveal: Stage 3 reached within 40 min',
    stage3At !== null && stage3At <= MAX_MINUTES * 60,
    stage3At === null ? `still Stage 2 at ${clock(lastT)}` : `at ${clock(stage3At)}`,
  );
  check('reveal: the Race panel appears within 3 min', at('panel-race') <= 180, `race ${when('panel-race')}`);
  check(
    'reveal: the race graph draws at least our line when it appears',
    raceLines !== null && raceLines >= 1,
    raceLines === null ? 'race graph never seen' : `${raceLines} polylines`,
  );
  check(
    'reveal: the Data row before the alignment strip',
    first.has('dataRow') && at('dataRow') < at('alignmentStrip'),
    `data ${when('dataRow')}, alignment ${when('alignmentStrip')}`,
  );
  check(
    'reveal: Public and Government arrive together',
    first.has('panel-public') && at('panel-public') === at('panel-government'),
    `public ${when('panel-public')}, government ${when('panel-government')}`,
  );
  check(
    'reveal: Automate the Lab appears before Stage 3 and is greyed when first seen',
    first.has('proj-s2_automate') &&
      (stage3At === null || at('proj-s2_automate') < stage3At) &&
      automateGreyFirst === true,
    `automate ${when('proj-s2_automate')}${first.has('proj-s2_automate') ? `, ${automateGreyFirst ? 'greyed' : 'lit'} at first sight` : ''}; Stage 3 ${stage3At === null ? 'never' : clock(stage3At)}`,
  );
  check(
    'reveal: the tempo row no later than the Security row',
    first.has('tempoRow') && at('tempoRow') <= at('securityRow'),
    `tempo ${when('tempoRow')}, security ${when('securityRow')}`,
  );
  // Beats at least 15 s apart: Public and Government are one beat; reveals that come with the
  // Stage 3 transition (enterStage shows alignment and security together) are reported above.
  // The alignment strip (buying the Alignment team) and the Public panel (deploying a model) both
  // follow player actions, so under autoplay they can land within a few seconds of each other.
  // Baiwen's arrival is one beat too: the tempo row and the urgent Security Office card (bought at
  // once by the bot, which reveals the security row) belong to it.
  const beats = TARGETS.filter(
    (id) => first.has(id) && !withStage3(id) && id !== 'panel-government' && id !== 'securityRow',
  )
    .map((id) => ({ id, t: at(id) }))
    .sort((p, q) => p.t - q.t);
  let closest = null;
  for (let i = 1; i < beats.length; i++) {
    const gap = beats[i].t - beats[i - 1].t;
    if (closest === null || gap < closest.gap) closest = { gap, a: beats[i - 1].id, b: beats[i].id };
  }
  check(
    'reveal: first appearances ≥ 15 s apart (Public and Government together; tempo and security together)',
    closest === null || closest.gap >= 15,
    closest ? `closest ${Math.round(closest.gap)} s: ${closest.a} → ${closest.b}` : 'fewer than two reveals',
  );
  const share = goal.ticks ? goal.ok / goal.ticks : 0;
  check(
    'reveal: a greyed goal (a disabled card or Automate the Lab) on ≥ 95 % of samples from the first card',
    goal.ticks > 0 && share >= 0.95,
    `${(share * 100).toFixed(1)} % of ${goal.ticks} samples from ${firstProjectAt === null ? '—' : clock(firstProjectAt)}${goal.misses.length ? `; none at ${goal.misses.join(', ')}` : ''}`,
  );
  const titles = new Set(modals.map((m) => m.title));
  const want = ['Deploy or keep internal?', 'The Senate Hearing', 'The Data Wall'];
  const missing = want.filter((w) => !titles.has(w));
  check(
    'reveal: the Deploy, Senate Hearing and Data Wall dialogs appear',
    missing.length === 0,
    missing.length ? `missing ${missing.join(', ')}` : `${modals.length} dialogs seen`,
  );
  console.log(`      reveal order: ${TARGETS.map((id) => `${id} ${when(id)}`).join(' · ')}`);
  console.log(
    `      dialogs: ${modals.map((m) => `${clock(m.t)} ${m.title}${m.between ? ' (answered between samples)' : ''}`).join(' | ') || 'none'}`,
  );
  await context.close();
});

// ===== 3. The dev overlay's checkpoints =====
await phase('checkpoints', async () => {
  const { context, page } = await freshPage('checkpoints');
  const CPS = ['arrival', 'datawall', 'baiwen', 'alignment', 'final'];
  for (let i = 0; i < CPS.length; i++) {
    const cp = CPS[i];
    const before = errors.length;
    try {
      const clicked = await click(page, `dev-s2-${cp}`);
      const x = await step(page, 5000);
      check(
        `checkpoint ${cp}: loads into Stage 2 with the Infrastructure panel, no errors`,
        clicked &&
          errors.length === before &&
          (x.stage === 2 || (cp === 'final' && x.stage === 3)) &&
          x.visible['panel-infrastructure'],
        `${clicked ? '' : 'button missing; '}stage ${x.stage} at ${clock(x.t)}; run ${x.run ? `${x.run.name} ${x.run.phase}` : 'none'}; dialog ${x.modal || 'none'}${errors.length > before ? `; ${errors.slice(before, before + 2).join(' | ')}` : ''}`,
      );
      await shot(page, `1${i}-cp-${cp}`);

      if (cp === 'baiwen') {
        // Save → reload during a training run. Train is pressed when it can be; otherwise funds and
        // compute are granted until it can. A run already in the slot is kept as the run under test.
        let started = false;
        let grants = 0;
        const freed = [];
        for (let k = 0; k < 20 && !started; k++) {
          const y = await snap(page);
          if (y.trainEnabled) {
            await click(page, 'btn-train');
            started = true;
          } else if (y.modal) {
            // A release decision or another dialog in the way: its first enabled option.
            const id = await page.evaluate(() => {
              const b = document.querySelector<HTMLButtonElement>('#modalButtons button:not(:disabled)');
              if (!b) return '';
              b.click();
              return b.id;
            });
            freed.push(`"${y.modal}" → ${id || 'no option'}`);
            await step(page, 2000);
          } else if (y.run && y.releaseEnabled) {
            // The slot is held by an evaluated model: ship it so the next run can start.
            await click(page, 'btn-release');
            freed.push(`released ${y.run.name}`);
            await step(page, 2000);
          } else {
            await click(page, 'dev-funds');
            await click(page, 'dev-compute');
            await click(page, 'dev-research');
            grants++;
            await step(page, 2000);
          }
        }
        const b = await step(page, 10000);
        const run = b.run;
        await page.evaluate(() => window.__game.save());
        await revive(page);
        const after = await snap(page);
        check(
          'baiwen: save → reload keeps the training run and Stage 2',
          !!run &&
            !!after.run &&
            after.stage === 2 &&
            after.run.name === run.name &&
            Math.abs(after.run.elapsed - run.elapsed) < 2,
          `${started ? `Train pressed after ${grants} grant${grants === 1 ? '' : 's'}` : run ? 'Train never pressable; the run already in the slot' : 'no run could be started'}${freed.length ? ` (${freed.join('; ')})` : ''}: ${run ? `${run.name} ${run.phase} ${run.elapsed.toFixed(1)} s` : 'none'} → ${after.run ? `${after.run.name} ${after.run.phase} ${after.run.elapsed.toFixed(1)} s` : 'no run'}, stage ${after.stage}`,
        );
        await shot(page, '12b-cp-baiwen-after-reload');
      }

      if (cp === 'alignment') {
        const d = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          sh: document.documentElement.scrollHeight,
          ch: document.documentElement.clientHeight,
          strip: document.getElementById('alignmentStrip').checkVisibility(),
        }));
        check(
          'alignment checkpoint, 1280×720: no horizontal overflow',
          d.sw <= d.cw,
          `${d.sw} vs ${d.cw}${d.strip ? '' : ' (alignment strip not shown at this checkpoint)'}`,
        );
        check(
          'alignment checkpoint, 1280×720: the page is at most 1.5× the viewport tall',
          d.sh <= 1.5 * d.ch,
          `${d.sh} px = ${(d.sh / d.ch).toFixed(2)}× ${d.ch} px`,
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await step(page, 100);
        const m = await page.evaluate(() => {
          const strip = document.getElementById('alignmentStrip');
          return {
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
            strip: strip.checkVisibility() ? Math.round(strip.getBoundingClientRect().width) : 0,
            shown: strip.checkVisibility(),
          };
        });
        check('alignment checkpoint, 390 px: no horizontal overflow', m.sw <= m.cw, `${m.sw} vs ${m.cw}`);
        check(
          'alignment checkpoint, 390 px: the alignment strip is no wider than the viewport',
          m.strip <= m.cw,
          m.shown ? `${m.strip} px of ${m.cw}` : 'strip not shown',
        );
        await shot(page, '13b-cp-alignment-390', { fullPage: true });
        await page.setViewportSize(VIEWPORT);
        await step(page, 100);
      }

      if (cp === 'final') {
        const y = await snap(page);
        if (y.modal) {
          const clickedId = await page.evaluate(() => {
            const b = document.querySelector<HTMLButtonElement>('#modalButtons button:not(:disabled)');
            if (!b) return '';
            b.click();
            return b.id;
          });
          const z = await snap(page);
          check(
            'final: the open dialog closes on its first enabled option',
            !!clickedId && z.choiceId !== y.choiceId,
            `"${y.modal}": clicked ${clickedId || 'nothing (no enabled option)'}; after: ${z.modal ? `"${z.modal}" open` : 'closed'}`,
          );
        } else {
          const errorsAt = errors.length;
          const r = await page.evaluate(() => {
            const g = window.__game;
            if (!g.events.fireable.some((e) => e.id === 'c_theft'))
              return { fireable: false, alive: true, open: false, title: '' };
            // A render error here unmounts the React root (and with it the dialog and `window.__game`).
            g.events.fire('c_theft');
            const overlay = document.getElementById('modalOverlay');
            return {
              fireable: true,
              alive: !!window.__game && !!overlay,
              open: !!overlay && overlay.classList.contains('shown'),
              title: overlay ? document.getElementById('modalTitle').innerText.trim() : '',
            };
          });
          let clickedId = '';
          let closed = false;
          if (r.alive && r.open) {
            clickedId = await page.evaluate(() => {
              const b0 = document.getElementById('choice-c_theft-0') as HTMLButtonElement | null;
              const b =
                b0 && !b0.disabled
                  ? b0
                  : document.querySelector<HTMLButtonElement>('#modalButtons button:not(:disabled)');
              if (!b) return '';
              b.click();
              return b.id;
            });
            closed = !(await snap(page)).modal;
          }
          check(
            'final: Weight Theft fires as a dialog and closes on #choice-c_theft-0',
            r.fireable && r.open && r.title === 'Weight Theft' && clickedId === 'choice-c_theft-0' && closed,
            !r.fireable
              ? 'c_theft not fireable'
              : !r.alive
                ? `firing c_theft unmounted the page: ${errors.slice(errorsAt, errorsAt + 2).join(' | ') || 'no page error recorded'}`
                : `title "${r.title}"; clicked ${clickedId || 'nothing'}; ${closed ? 'closed' : 'still open'}`,
          );
          if (!r.alive) await revive(page);
        }
      }
    } catch (e) {
      check(
        `checkpoint ${cp}: ran to completion`,
        false,
        `${String(e && e.message ? e.message : e).split('\n')[0]}${errors.length > before ? ` | ${errors.slice(before, before + 2).join(' | ')}` : ''}`,
      );
      // The page may have lost its React root: reload it for the next checkpoint.
      await revive(page).catch(() => undefined);
    }
  }
  await context.close();
});

check('no page errors or console errors anywhere', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed (seed ${SEED}). Screenshots: ${SHOTS}`,
);
process.exit(failed.length ? 1 : 0);
