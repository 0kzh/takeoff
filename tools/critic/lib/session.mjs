// One game in one headless Chrome: static server, context, init scripts, clock control.
import { chromium } from 'playwright-core';
import { serveDir } from './server.mjs';
import { harnessInit } from './initscript.mjs';
import { pageLib } from './pagelib.mjs';

/** Virtual Date.now() at game start (2026-01-01T00:00:00Z) so reference-game clocks are reproducible. */
export const EPOCH = Date.UTC(2026, 0, 1);

/**
 * opts: { adapter, gameDir, seed, stage, fixture, viewport }
 * Returns a session with page, clock controls and the in-page measuring helpers.
 */
export async function openSession(opts) {
  const { adapter, gameDir } = opts;
  const seed = Number(opts.seed ?? 1);
  const server = await serveDir(gameDir);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const origin = server.url.replace(/\/$/, '');
  const ctxOpts = { viewport: opts.viewport ?? { width: 1280, height: 800 }, deviceScaleFactor: 1 };
  if (opts.fixture?.localStorage) {
    ctxOpts.storageState = {
      cookies: [],
      origins: [{ origin, localStorage: Object.entries(opts.fixture.localStorage).map(([name, value]) => ({ name, value })) }],
    };
  }
  const context = await browser.newContext(ctxOpts);
  // Offline and reproducible: only the local server is reachable (ADR falls back to its bundled jQuery).
  await context.route((url) => !url.href.startsWith(server.url), (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.length < 200 && errors.push(String(e.message).split('\n')[0]));

  const virtual = adapter.clock === 'virtual';
  await page.addInitScript(harnessInit, {
    seed,
    virtual,
    epoch: EPOCH,
    pinBootDate: adapter.clock === 'tick',
    holdRaf: adapter.clock === 'tick',
  });
  const fp = adapter.fingerprint ? adapter.fingerprint.toString() : 'null';
  await page.addInitScript({
    content:
      `window.__harnessSpec = ${JSON.stringify(adapter.spec)};\n` +
      `window.__harnessMetrics = (${adapter.metrics.toString()});\n` +
      `window.__harnessFingerprint = (${fp});\n`,
  });
  await page.addInitScript(pageLib);

  // Games that refresh button states on their own timer (Paperclips: 10-ms main loop) get one
  // UI tick after every click, so a stale "enabled" button cannot be clicked twice in one task.
  // In stepped mode that time is taken out of the current 2-s step.
  const clickGap = virtual ? Number(adapter.clickGapMs ?? 0) : 0;
  let realtimeActive = false;
  let consumed = 0;

  const session = {
    page,
    adapter,
    server,
    browser,
    context,
    errors,
    seed,
    virtual,
    url: server.url + adapter.page,
    bootInfo: {},
    async goto() {
      await page.goto(session.url, { waitUntil: 'load' });
    },
    /** Advances game time by ms (no clicks). */
    async advance(ms) {
      if (ms <= 0) return;
      if (virtual) await page.evaluate((m) => window.__advance(m), ms);
      else await page.evaluate((m) => window.__game.tick(m), ms);
    },
    /** Advances ms of game time inside the current 2-s step (stepped mode only); step() takes it off. */
    async advanceWithinStep(ms) {
      if (realtimeActive) return;
      await session.advance(ms);
      consumed += ms;
    },
    get realtime() {
      return realtimeActive;
    },
    /** Phase-2 step: ms of game time (minus click gaps already spent) in 250-ms slices, clicking `mainKey` before each. */
    async step(ms, mainKey) {
      const left = Math.max(0, ms - consumed);
      consumed = 0;
      if (!mainKey) {
        await session.advance(left);
        return 0;
      }
      const n = Math.floor(left / 250);
      const clicks = await page.evaluate(([k, nn, mode]) => window.__critic.mashAdvance(k, nn, 250, mode), [mainKey, n, virtual ? 'virtual' : 'tick']);
      await session.advance(left - n * 250);
      return clicks;
    },
    async startRealtime() {
      realtimeActive = true;
      if (virtual) await page.evaluate(() => window.__harness.startRealtime());
      else await page.evaluate(() => {
        window.__harness.releaseRaf();
        window.__game.setSpeed(1);
      });
    },
    async stopRealtime() {
      realtimeActive = false;
      if (virtual) await page.evaluate(() => window.__harness.stopRealtime());
      else await page.evaluate(() => window.__game.setSpeed(0));
    },
    snapshot: (o) => page.evaluate((oo) => window.__critic.snapshot(oo), o ?? null),
    controls: () => page.evaluate(() => window.__critic.controls()),
    metrics: () => page.evaluate(() => (window.__harnessMetrics ? window.__harnessMetrics() : {})),
    /** Clicks a visible enabled button; reports whether the game state changed. */
    async click(key) {
      const r = await page.evaluate((k) => {
        const fp = () => {
          try {
            return window.__harnessFingerprint ? window.__harnessFingerprint() : document.body.innerText;
          } catch {
            return document.body.innerText;
          }
        };
        const before = fp();
        const res = window.__critic.click(k);
        res.changed = res.ok && fp() !== before;
        return res;
      }, key);
      if (r.ok && clickGap > 0) {
        if (realtimeActive) await new Promise((res) => setTimeout(res, clickGap));
        else {
          await page.evaluate((m) => window.__advance(m), clickGap);
          consumed += clickGap;
        }
      }
      return r;
    },
    /**
     * Sets a visible <select>/<input> to `value` the way a player would (then input/change events).
     * Returns { ok, changed, label } (label = the chosen option's text for a <select>).
     */
    async setValue(selector, value) {
      const r = await page.evaluate(
        ([sel, v]) => {
          const el = document.querySelector(sel);
          if (!el || !el.checkVisibility({ checkVisibilityCSS: true }) || el.disabled) return { ok: false, changed: false, label: '' };
          const before = String(el.value);
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          const opt = el.tagName === 'SELECT' && el.selectedOptions[0] ? el.selectedOptions[0].textContent.trim() : String(el.value);
          return { ok: true, changed: String(el.value) !== before, label: opt };
        },
        [selector, value],
      );
      if (r.ok && r.changed && clickGap > 0) {
        if (realtimeActive) await new Promise((res) => setTimeout(res, clickGap));
        else {
          await page.evaluate((m) => window.__advance(m), clickGap);
          consumed += clickGap;
        }
      }
      return r;
    },
    async screenshot(file) {
      await page.screenshot({ path: file, fullPage: true });
    },
    async harnessErrors() {
      return page.evaluate(() => ({ errors: window.__harness.errors.slice(0, 50), timerErrors: window.__harness.timerErrors }));
    },
    async close() {
      await browser.close().catch(() => {});
      await server.close();
    },
  };
  await session.goto();
  session.bootInfo = (await adapter.boot(session, { seed, stage: Number(opts.stage ?? 1), fixture: opts.fixture })) ?? {};
  return session;
}
