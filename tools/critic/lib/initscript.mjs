// Page-init script installed with page.addInitScript() before any game script runs.
// It is serialized with Function.prototype.toString(), so it must be self-contained.
//
// cfg = {
//   seed:        number   seed for the Math.random replacement (mulberry32)
//   virtual:     boolean  virtualise setTimeout/setInterval/rAF/Date/performance.now behind
//                         window.__advance(ms); a page-side pump makes it follow wall-clock time
//                         while __harness.startRealtime() is active
//   epoch:       number   Date.now() at virtual time 0 (virtual mode only)
//   pinBootDate: boolean  Date.now() returns cfg.seed until window.__game exists (Takeoff:
//                         main.ts calls newGame(Date.now()) when there is no save)
//   holdRaf:     boolean  queue requestAnimationFrame callbacks until __harness.releaseRaf()
// }
export function harnessInit(cfg) {
  const H = (window.__harness = { cfg, errors: [], timerErrors: 0 });

  // ---- seeded Math.random -------------------------------------------------------------------
  let a = cfg.seed >>> 0 || 1;
  Math.random = function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const realSetTimeout = window.setTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realClearInterval = window.clearInterval.bind(window);
  const realPerfNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const RealDate = Date;
  const realDateNow = Date.now.bind(Date);
  H.real = { setTimeout: realSetTimeout, setInterval: realSetInterval, clearInterval: realClearInterval, perfNow: realPerfNow, dateNow: realDateNow };

  window.addEventListener('error', (e) => H.errors.push(String(e.message || e.error)));

  // ---- Takeoff: deterministic boot seed --------------------------------------------------------
  if (cfg.pinBootDate && !cfg.virtual) {
    Date.now = function now() {
      return window.__game ? realDateNow() : cfg.seed;
    };
  }

  // ---- Takeoff: hold the requestAnimationFrame loop ----------------------------------------------
  if (cfg.holdRaf && !cfg.virtual) {
    let hold = true;
    const queue = [];
    window.requestAnimationFrame = function requestAnimationFrame(cb) {
      if (!hold) return realRaf(cb);
      queue.push(cb);
      return 0;
    };
    H.releaseRaf = () => {
      hold = false;
      for (const cb of queue.splice(0)) realRaf(cb);
    };
  } else {
    H.releaseRaf = () => {};
  }

  if (!cfg.virtual) return;

  // ---- virtual clock ------------------------------------------------------------------------------
  let vnow = 0; // virtual ms since page start
  let seq = 0;
  let nextId = 1;
  const timers = new Map(); // id -> { fn, args, at, interval, seq, raf }
  const FRAME = 1000 / 60;

  function add(fn, delay, args, interval, raf) {
    const id = nextId++;
    timers.set(id, { fn, args, at: vnow + delay, interval, seq: seq++, raf });
    return id;
  }
  function call(t) {
    try {
      if (typeof t.fn === 'function') {
        if (t.raf) t.fn(vnow);
        else t.fn(...t.args);
      } else {
        (0, eval)(String(t.fn));
      }
    } catch (e) {
      H.timerErrors++;
      if (H.errors.length < 50) H.errors.push(String(e && e.stack ? e.stack.split('\n')[0] : e));
    }
  }
  window.setTimeout = function setTimeout(fn, delay, ...args) {
    return add(fn, Math.max(1, Number(delay) || 0), args, 0, false);
  };
  window.setInterval = function setInterval(fn, delay, ...args) {
    const d = Math.max(1, Number(delay) || 0);
    return add(fn, d, args, d, false);
  };
  window.clearTimeout = window.clearInterval = function clearTimer(id) {
    timers.delete(id);
  };
  window.requestAnimationFrame = function requestAnimationFrame(cb) {
    const nextFrame = (Math.floor(vnow / FRAME) + 1) * FRAME;
    return add(cb, nextFrame - vnow, [], 0, true);
  };
  window.cancelAnimationFrame = function cancelAnimationFrame(id) {
    timers.delete(id);
  };
  performance.now = function now() {
    return vnow;
  };
  function VDate(...args) {
    if (!new.target) return new RealDate(cfg.epoch + vnow).toString();
    return args.length ? new RealDate(...args) : new RealDate(cfg.epoch + vnow);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => cfg.epoch + Math.floor(vnow);
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  window.Date = VDate;

  /** Runs every due timer in (time, registration) order up to vnow + ms. */
  window.__advance = function advance(ms) {
    const target = vnow + ms;
    let guard = 0;
    for (;;) {
      let best = null;
      let bestId = 0;
      for (const [id, t] of timers) {
        if (t.at <= target && (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq))) {
          best = t;
          bestId = id;
        }
      }
      if (!best) break;
      if (best.at > vnow) vnow = best.at;
      if (best.interval > 0) {
        best.at += best.interval;
        best.seq = seq++;
      } else {
        timers.delete(bestId);
      }
      call(best);
      if (++guard > 2e6) {
        H.errors.push('virtual clock: >2e6 timer firings in one advance, stopped');
        break;
      }
    }
    vnow = target;
    return vnow;
  };
  H.virtualNow = () => vnow;
  H.timerCount = () => timers.size;

  // Wall-clock pump: while active the virtual clock follows real time.
  let pump = 0;
  H.startRealtime = () => {
    if (pump) return;
    let last = realPerfNow();
    pump = realSetInterval(() => {
      const now = realPerfNow();
      window.__advance(now - last);
      last = now;
    }, 4);
  };
  H.stopRealtime = () => {
    if (pump) realClearInterval(pump);
    pump = 0;
  };
}
