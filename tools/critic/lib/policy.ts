// The scripted "curious first-time player" (critic report §1 "Policy"), identical in shape for
// every game. Game-specific knowledge comes only from adapter.policy:
//   main        the clicker mashed at 4 clicks/s until automation out-produces the hand (≥ 8/s)
//   automation  the first automation, bought the moment it is affordable (one sweep per check:
//               every other affordable button is clicked at most once per 2-s check)
//   consumable  bought when its stock is below half of one purchase (≤ 3 per check); while it is
//               visible, one purchase of it is always kept in reserve when buying anything else
//               with funds (the first automation and a big-ticket goal are exempt)
//   lower/raise price controls, moved only by watching the backlog
//   priceHold(c) optional: true while the screen shows pricing on automatic (lower/raise untouched)
//   drip        repeat purchases held back (to save) while a big-ticket goal is visible; other
//               purchases (training, one-off projects) are still bought when affordable
//   goal        big-ticket goal button keys
//   goalRule(c) optional: further big-ticket goal keys derived from what is on screen right now
//   skip        never clicked by the generic buy loop
//   veto(c)     keys the generic loop must not click given the current controls
//   special(ctx) game-specific steps (red-team/release, processors/memory, navigation)
//   modalChoice(modal, enabledOptions, t) optional: which option answers a modal (null = leave it)
// Every other visible, enabled, non-ambient button is "an upgrade/project/automation" and is bought
// when affordable, least-bought first (ties in DOM order). Settings (toggles, ON/OFF or "Name: value"
// buttons; lib/pagelib.ts) are ambient: the buy loop never presses them. Two more things the screen
// says are respected everywhere: a button that shows as already on or armed (b.on) is not pressed
// again (that would switch it off or stand it down), and a repeat purchase — any button that is not a
// project card — whose row prints the delay it causes the thing the player waits for ("· next run
// 1:10 later", b.later) is not pressed.
import { fmtN } from './util.ts';

export const MASH_PER_SEC = 4;
export const MASH_STOP_RATE = 8;
export const PRICE = { lowerBacklogSeconds: 30, raiseAfterChecks: 4, cooldown: 8 };
/** The consumable is bought when its stock is below this fraction of one purchase. */
export const CONSUMABLE_LOW = 0.5;
export const NOOP_BACKOFF = 30;

/** Non-money costs a game shows but does not enforce by disabling the button (ADR tooltips). */
function affordableResources(b, m) {
  for (const [res, need] of Object.entries(b.costs || {})) {
    if (res === 'funds') continue;
    if (typeof m[res] === 'number' && m[res] < Number(need)) return false;
  }
  return true;
}

export class Policy {
  p: Record<string, any>;
  session: Awaited<ReturnType<typeof import('./session.ts').openSession>>;
  rec: import('./recorder.ts').Recorder;
  mashing: boolean;
  firstAuto: boolean;
  lastPriceMove: number;
  nearZero: number;
  prevBacklog: number | null;
  counts = new Map<string, number>();
  noops: number;
  noopUntil = new Map<string, number>();
  memory: Record<string, any>;
  constructor(adapter, session, recorder, { startStage = 1 } = {}) {
    this.p = adapter.policy;
    this.session = session;
    this.rec = recorder;
    // Mashing is the opening of a new game; a later-stage start begins with automation running.
    this.mashing = !!this.p.main && startStage === 1;
    this.firstAuto = false;
    this.lastPriceMove = -Infinity;
    this.nearZero = 0;
    this.prevBacklog = null;
    this.counts = new Map();
    this.noops = 0;
    this.noopUntil = new Map();
    /** Scratch space an adapter's special() keeps between checks (what the player remembers). */
    this.memory = {};
  }

  async pass(t) {
    const s = this.session;
    const p = this.p;
    // A click that changed nothing (e.g. ADR's "not enough wood") is not retried for 30 s.
    const backoff = new Set([...this.noopUntil].filter(([, until]) => until > t).map(([k]) => k));
    const ctx: Record<string, any> = { t, controls: await s.controls(), noop: backoff, session: s, memory: this.memory };
    ctx.click = async (key, why, detail) => {
      const shown = ctx.controls.buttons.find((b) => b.k === key);
      const r = await s.click(key);
      if (!(r.ok && r.changed)) {
        this.noops++;
        ctx.noop.add(key);
        this.noopUntil.set(key, t + NOOP_BACKOFF);
        return ctx.controls;
      }
      this.counts.set(key, (this.counts.get(key) || 0) + 1);
      if (this.rec.clickedUnseen) this.rec.clickedUnseen(t, shown || { k: key, l: r.label, kind: 'button' });
      this.rec.action({ t, key, label: r.label, why, detail });
      ctx.controls = await s.controls();
      return ctx.controls;
    };
    /** Sets a visible <select>/<input> (strategy picker, slider) and logs it like a click. */
    ctx.set = async (selector, value, why, detail) => {
      const r = await s.setValue(selector, value);
      if (!(r.ok && r.changed)) return ctx.controls;
      this.rec.action({ t, key: selector, label: r.label, why, detail });
      ctx.controls = await s.controls();
      return ctx.controls;
    };
    const find = (k) => (k ? ctx.controls.buttons.find((b) => b.k === k) : null);
    // A purchase that changes the stage ends this check: the new screen is read at the next one.
    const passStage = ctx.controls.m.stage;
    const stageChanged = () => passStage != null && ctx.controls.m.stage !== passStage;

    // 1. A modal is answered with its first enabled option (once per pass; a fading or chained
    //    modal is handled at the next check). adapter.policy.modalChoice(modal, enabledOptions, t)
    //    may pick another option, or return null to leave the modal open (critic round 2,
    //    explore.ts variants). Default unchanged.
    if (ctx.controls.modal) {
      const modal = ctx.controls.modal;
      const enabled = modal.options.filter((o) => o.e && !ctx.noop.has(o.k));
      const opt = p.modalChoice ? p.modalChoice(modal, enabled, t) : enabled[0];
      if (opt) await ctx.click(opt.k, 'modal', `${modal.title} → ${opt.l}`);
    }

    // 2. Game-specific steps.
    if (p.special) await p.special(ctx);

    // 3. Consumable: top up when below half of one purchase.
    if (p.consumable) {
      for (let n = 0; n < 3; n++) {
        const b = find(p.consumable);
        const m = ctx.controls.m;
        if (!b || !b.e || m.stock == null || ctx.noop.has(b.k)) break;
        const unit = m.stockUnit || 1000;
        if (!(m.stock < CONSUMABLE_LOW * unit)) break;
        await ctx.click(b.k, 'consumable', `stock ${fmtN(m.stock)} < ${CONSUMABLE_LOW * 100}% of ${fmtN(unit)}`);
      }
    }

    // 4. First automation the moment it is affordable (no reserve).
    if (!this.firstAuto) {
      if ((ctx.controls.m.automation || 0) >= 1) this.firstAuto = true;
      else {
        for (const k of p.automation || []) {
          const b = find(k);
          if (b && b.e) {
            await ctx.click(k, 'first-automation', `affordable at ${fmtN(b.funds, 2)}`);
            if ((ctx.controls.m.automation || 0) >= 1) this.firstAuto = true;
            break;
          }
        }
      }
    }

    // 5. Price, by watching the backlog — unless the screen says pricing is automated (priceHold).
    const lower = find(p.lower);
    const raise = find(p.raise);
    if ((lower || raise) && !(p.priceHold && p.priceHold(ctx.controls))) {
      const m = ctx.controls.m;
      const B = m.backlog ?? 0;
      const R = Math.max(m.rate ?? 0, this.mashing ? MASH_PER_SEC : 0);
      const growing = this.prevBacklog != null && B > this.prevBacklog;
      this.nearZero = B <= Math.max(5, R) ? this.nearZero + 1 : 0;
      const cooled = t - this.lastPriceMove >= PRICE.cooldown;
      if (cooled && B > PRICE.lowerBacklogSeconds * R && growing && lower && lower.e) {
        await ctx.click(lower.k, 'price-lower', `backlog ${fmtN(B)} > ${PRICE.lowerBacklogSeconds} s of production (${fmtN(R, 1)}/s) and growing (was ${fmtN(this.prevBacklog)})`);
        this.lastPriceMove = t;
        this.nearZero = 0;
      } else if (cooled && this.nearZero >= PRICE.raiseAfterChecks && raise && raise.e) {
        await ctx.click(raise.k, 'price-raise', `backlog near zero (${fmtN(B)} ≤ max(5, ${fmtN(R, 1)}/s)) for ${this.nearZero} checks`);
        this.lastPriceMove = t;
        this.nearZero = 0;
      }
      this.prevBacklog = B;
    }

    // 6. Buy anything affordable, keeping one consumable purchase in reserve.
    const skip = new Set([...(p.skip || []), p.consumable, p.lower, p.raise, p.main].filter(Boolean));
    const staticGoals = p.goal || [];
    const drip = new Set(p.drip || []);
    const autos = new Set(p.automation || []);
    // One sweep per check: every affordable button is clicked at most once (a GPU/clipper "drip").
    const clicked = new Set();
    for (let i = 0; i < 60; i++) {
      if (stageChanged()) break;
      const c = ctx.controls;
      const m = c.m;
      const goals = new Set([...staticGoals, ...(p.goalRule ? p.goalRule(c) : [])]);
      const goalVisible = c.buttons.some((b) => goals.has(b.k));
      // "Keeping one consumable purchase in reserve": while the consumable is on screen, a funds
      // purchase must leave enough for one more unit of it.
      const cons = find(p.consumable);
      const reserve = cons && m.stock != null ? m.stockPrice || 0 : 0;
      const veto = new Set(p.veto ? p.veto(c) : []);
      const ok = c.buttons.filter((b) => {
        if (!b.e || b.a || b.kind === 'modal' || b.kind === 'tab' || skip.has(b.k) || veto.has(b.k) || ctx.noop.has(b.k) || clicked.has(b.k)) return false;
        if (b.on || (b.later != null && b.kind !== 'project')) return false;
        if (!affordableResources(b, m)) return false;
        if (goals.has(b.k)) return true;
        // Report §1: "stop the GPU/marketing drip and save" — only the drip is held back; training runs
        // and one-off projects are still bought when affordable (keeping the consumable reserve).
        if (goalVisible && drip.has(b.k)) return false;
        if (!((b.funds || 0) > 0)) return true;
        return m.funds - b.funds >= reserve;
      });
      if (!ok.length) break;
      const rank = (b) => (goals.has(b.k) ? -1 : this.counts.get(b.k) || 0);
      const b = ok.reduce((best, x) => (rank(x) < rank(best) ? x : best), ok[0]);
      const why = goals.has(b.k) ? 'goal' : b.kind === 'project' ? 'project' : autos.has(b.k) ? 'automation' : 'buy';
      const costs = [b.funds > 0 ? `$${fmtN(b.funds, 2)}` : '', ...Object.entries(b.costs || {}).filter(([k]) => k !== 'funds').map(([k, v]) => `${fmtN(v)} ${k}`)].filter(Boolean).join(', ');
      clicked.add(b.k);
      await ctx.click(b.k, why, `${costs || 'free'}${goalVisible && !goals.has(b.k) ? ' (saving for goal)' : ''}`);
    }

    // 7. Stop mashing once automation out-produces the hand.
    if (this.mashing) {
      const m = ctx.controls.m;
      const auto = m.autoRate ?? Math.max(0, (m.rate ?? 0) - MASH_PER_SEC);
      if (auto >= MASH_STOP_RATE) {
        this.mashing = false;
        this.rec.action({ t, key: p.main, label: '', why: 'mash-stop', detail: `automation ${fmtN(auto, 1)}/s ≥ ${MASH_STOP_RATE}/s` });
      }
    }
    return ctx.controls;
  }
}
