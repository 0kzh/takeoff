// Small toolkit for scripted probes (softlock.mjs): a stepped session with a recorder, helpers to
// play with the policy (optionally modified), to describe what is on screen, and to reload.
import { openSession } from './session.mjs';
import { Recorder } from './recorder.mjs';
import { Policy } from './policy.mjs';
import { mmss, fmtN } from './util.mjs';

/** Thrown by a scenario when the game no longer has what the scenario needs. */
export class NotApplicable extends Error {}

export async function openProbe(adapter, { gameDir, seed = 1, stage = 1, fixture = null, prefix, viewport }) {
  const session = await openSession({ adapter, gameDir, seed, stage, fixture, viewport });
  if (session.bootInfo.stage != null) stage = session.bootInfo.stage;
  const rec = new Recorder();
  const kit = {
    adapter,
    session,
    rec,
    t: 0,
    prefix,
    stage,
    mashKey: null,
    /**
     * A Policy whose adapter.policy fields are overridden (e.g. { skip: [...], lower: null }).
     * `special`: true keeps the adapter's game-specific steps, false drops them, a function replaces them.
     */
    policy(over = {}, special = true) {
      const pol = { ...adapter.policy, ...over };
      if (over.skip) pol.skip = [...(adapter.policy.skip || []), ...over.skip];
      if (typeof special === 'function') pol.special = special;
      else if (!special) pol.special = null;
      return new Policy({ ...adapter, policy: pol }, session, rec, { startStage: stage });
    },
    async snap() {
      const raw = await session.snapshot();
      return rec.snapshot(kit.t, 2, raw);
    },
    /**
     * Plays `seconds` in 2-s steps: snapshot, then `each(t, snap)` (may click), then advance
     * 2 s (mashing `kit.mashKey` at 4/s when set). Stops early when `each` returns 'stop'.
     */
    async run(seconds, each) {
      const end = kit.t + seconds;
      while (kit.t < end) {
        const s = await kit.snap();
        if (each && (await each(kit.t, s)) === 'stop') return s;
        const pmash = each && each.policy ? each.policy.mashing : true;
        const n = await session.step(2000, kit.mashKey && pmash ? kit.mashKey : null);
        if (n) rec.action({ t: kit.t, key: kit.mashKey, why: 'mash', count: n });
        kit.t += 2;
      }
      return kit.snap();
    },
    /** A step function that runs a policy pass (and lets the policy decide on mashing). */
    with(policy) {
      const f = async (t) => {
        await policy.pass(t);
      };
      f.policy = policy;
      return f;
    },
    async click(key, times = 1, why = 'probe') {
      let n = 0;
      for (let i = 0; i < times; i++) {
        const r = await session.click(key);
        if (!r.ok) break;
        n++;
        rec.action({ t: kit.t, key, label: r.label, why });
      }
      return n;
    },
    find: (s, re) => s.buttons.find((b) => (re instanceof RegExp ? re.test(b.l) || re.test(b.k) : b.k === re)),
    /** "What the player sees": newest console lines, enabled/grey buttons, panels, modal. */
    screen(s, { lines = 3 } = {}) {
      const con = rec.events.filter((e) => e.type === 'console' && e.t <= s.t).slice(-lines).map((e) => e.text);
      const en = s.buttons.filter((b) => b.e && b.kind !== 'modal').map((b) => b.l);
      const grey = s.buttons.filter((b) => !b.e && b.kind !== 'modal').map((b) => b.l);
      return [
        `console: ${con.length ? con.map((c) => `"${c}"`).join(' / ') : '(empty)'}`,
        `enabled: ${en.join('; ') || 'none'}`,
        `grey: ${grey.join('; ') || 'none'}`,
        `panels: ${s.panels.map((p) => p.l).join(', ')}`,
        s.modal ? `modal: "${s.modal.title}" (${s.modal.options.map((o) => o.l).join(' / ')})` : null,
      ].filter(Boolean);
    },
    linesBetween(t0, t1, types = ['console', 'log', 'modal']) {
      return rec.events
        .filter((e) => types.includes(e.type) && e.t >= t0 && e.t <= t1)
        .map((e) => `${mmss(e.t)} [${e.type}] ${e.text || e.title}`);
    },
    revealsBetween(t0, t1) {
      return rec.events.filter((e) => e.type === 'reveal' && e.t > t0 && e.t <= t1).map((e) => `${mmss(e.t)} ${e.what} ${e.label}`);
    },
    async shot(name) {
      const file = `${prefix}-${name}.png`;
      await session.screenshot(file).catch(() => {});
      return file;
    },
    /** Reload the page (the game's own save/load), re-run the adapter's boot steps. */
    async reload() {
      await session.page.reload({ waitUntil: 'load' });
      if (adapter.clock === 'tick') {
        await session.page.waitForFunction(() => !!(window.__game && window.__game.state), null, { timeout: 20000 });
        await session.page.evaluate(() => window.__game.setSpeed(0));
      } else {
        await session.advance(50);
      }
    },
    fmt: fmtN,
    close: () => session.close(),
  };
  return kit;
}
