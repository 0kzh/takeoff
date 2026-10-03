// In-page measuring library. Installed with page.addInitScript() (so it survives reloads) and
// serialized with Function.prototype.toString(): it must be self-contained.
//
// It reads window.__harnessSpec (plain data from the game adapter) and window.__harnessMetrics
// (the adapter's in-page metrics function) and exposes window.__critic:
//   snapshot()        the §1 snapshot (buttons, sliders, panels, console, log, modal, numbers, …)
//   controls()        a light read for the policy: visible buttons with parsed costs + metrics
//   click(key)        clicks the visible button with that key if it is enabled; returns controls()
//   mashAdvance(key, n, stepMs, mode)  n × (click main if possible, advance stepMs) — phase 2;
//                     mode 'tick' advances with __game.tick(ms), anything else with __advance(ms)
export function pageLib() {
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const spec = () => window.__harnessSpec || {};

  function excludedRoots(sp) {
    const roots = [];
    for (const sel of sp.exclude || []) for (const el of document.querySelectorAll(sel)) roots.push(el);
    return roots;
  }
  function isExcluded(el, roots) {
    for (const r of roots) if (r === el || r.contains(el)) return true;
    return false;
  }
  function clippedOut(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return true;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const q = p.getBoundingClientRect();
        if (r.right <= q.left || r.left >= q.right || r.bottom <= q.top || r.top >= q.bottom) return true;
      }
    }
    return false;
  }
  function makeVisible(sp) {
    const cache = new Map();
    const opts = { checkVisibilityCSS: true, visibilityProperty: true, checkOpacity: !!sp.opacity, opacityProperty: !!sp.opacity };
    return (el) => {
      let v = cache.get(el);
      if (v === undefined) {
        v = el.checkVisibility(opts) && !(sp.clip && clippedOut(el));
        cache.set(el, v);
      }
      return v;
    };
  }
  function firstLine(el) {
    const t = el.innerText != null && el.innerText !== '' ? el.innerText : el.textContent || '';
    for (const line of String(t).split('\n')) if (line.trim()) return norm(line);
    return '';
  }
  function keyOf(el, sp) {
    if (el.id && !(sp.labelKeyIds && new RegExp(sp.labelKeyIds).test(el.id))) return el.id;
    return 'label:' + firstLine(el).replace(/[0-9][0-9,.]*/g, '#').slice(0, 60);
  }

  // ---- costs ---------------------------------------------------------------------------------
  const MULT = { k: 1e3, K: 1e3, M: 1e6, B: 1e9, T: 1e12, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, quadrillion: 1e15 };
  function parseMoney(text) {
    const m = /\$\s*([0-9][0-9,]*(?:\.[0-9]+)?|\.[0-9]+)\s*(k|K|M|B|T|thousand|million|billion|trillion|quadrillion)?\b/.exec(text);
    if (!m) return null;
    return parseFloat(m[1].replace(/,/g, '')) * (m[2] ? MULT[m[2]] : 1);
  }
  /** Non-money costs in a price tag: "(3,000 research, 25 insight)", "(750 ops)", "(1 Trust)". */
  function parseCosts(text) {
    const out = {};
    const inParens = /\(([^)]*)\)/.exec(text);
    const src = inParens ? inParens[1] : text;
    const re = /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|M|B|thousand|million|billion)?\s+([A-Za-z][A-Za-z-]*)/g;
    let m;
    while ((m = re.exec(src))) {
      const unit = m[3].toLowerCase();
      if (/^(each|per|at|in|to|of|and)$/.test(unit)) continue;
      out[unit] = (out[unit] || 0) + parseFloat(m[1].replace(/,/g, '')) * (m[2] ? MULT[m[2]] : 1);
    }
    const money = parseMoney(src);
    if (money != null) out.funds = money;
    return out;
  }
  /** Text that follows a button on its line(s) — "Cost: $ 7.00" in both games' layouts. */
  function trailingText(el) {
    let text = '';
    let brs = 0;
    let node = el;
    for (let hops = 0; hops < 3 && node; hops++) {
      let sib = node.nextSibling;
      while (sib) {
        if (sib.nodeType === 1) {
          const tag = sib.tagName;
          if (tag === 'BUTTON' || tag === 'HR' || (sib.classList && sib.classList.contains('button'))) return text;
          if (tag === 'BR') {
            if (++brs > 2) return text;
            text += '\n';
          } else if ((tag === 'DIV' || tag === 'P') && text.trim()) {
            return text;
          } else {
            if (sib.querySelector && sib.querySelector('button')) return text;
            text += ' ' + (sib.textContent || '');
          }
        } else if (sib.nodeType === 3) {
          text += sib.textContent;
        }
        if (/Cost/i.test(text) && /\$\s*[0-9.]/.test(text)) return text;
        sib = sib.nextSibling;
      }
      // Button was the last thing in an inline wrapper (<p>, <span>): continue after the wrapper.
      node = node.parentElement;
      if (!node || node.tagName === 'DIV' || node === document.body) break;
    }
    return text;
  }
  function fundsCost(el, sp, label) {
    const sel = sp.costSel && sp.costSel[el.id];
    if (sel) {
      const c = document.querySelector(sel);
      const v = c ? parseMoney(c.textContent || '') : null;
      if (v != null) return v;
    }
    const own = parseMoney(label);
    if (own != null) return own;
    const tail = trailingText(el);
    const m = /Cost[^$\n]*(\$[^\n]*)/i.exec(tail);
    if (m) {
      const v = parseMoney(m[1]);
      if (v != null) return v;
    }
    return 0;
  }

  // ---- collectors ----------------------------------------------------------------------------
  function kindOf(el, sp) {
    if (sp.modalOption && el.matches(sp.modalOption)) return 'modal';
    if (sp.project && el.matches(sp.project)) return 'project';
    if (sp.tab && el.matches(sp.tab)) return 'tab';
    return 'button';
  }
  function isEnabled(el, sp) {
    if (el.disabled) return false;
    if (sp.disabledClass && el.classList.contains(sp.disabledClass)) return false;
    return true;
  }
  function collectButtons(sp, roots, vis, withCosts) {
    const out = [];
    const ambient = new Set(sp.ambient || []);
    for (const el of document.querySelectorAll(sp.buttons || 'button')) {
      if (isExcluded(el, roots) || !vis(el)) continue;
      const k = keyOf(el, sp);
      const l = firstLine(el).slice(0, 90);
      const kind = kindOf(el, sp);
      const b = { k, l, e: isEnabled(el, sp) ? 1 : 0, kind, a: ambient.has(k) || kind === 'tab' ? 1 : 0 };
      if (sp.selectedClass && el.classList.contains(sp.selectedClass)) b.s = 1;
      if (withCosts && !b.a && kind !== 'modal') {
        b.funds = b.e ? fundsCost(el, sp, l) : 0;
        b.costs = parseCosts(l);
        // Costs shown in a hover tooltip as key/value rows (A Dark Room).
        if (sp.tooltipCosts) {
          for (const kEl of el.querySelectorAll(sp.tooltipCosts)) {
            const v = parseFloat(String((kEl.nextElementSibling && kEl.nextElementSibling.textContent) || '').replace(/,/g, ''));
            if (isFinite(v)) b.costs[norm(kEl.textContent).toLowerCase()] = v;
          }
        }
      }
      out.push(b);
    }
    return out;
  }
  function collectPanels(sp, roots, vis) {
    const out = [];
    const seen = new Set();
    const p = sp.panels || {};
    if (p.selector) {
      for (const el of document.querySelectorAll(p.selector)) {
        if (isExcluded(el, roots) || !vis(el)) continue;
        const l = norm(p.titleAttr ? el.getAttribute(p.titleAttr) : firstLine(el));
        const k = el.id || 'panel:' + l;
        if (!seen.has(k)) out.push({ k, l });
        seen.add(k);
      }
      return out;
    }
    const BAD = /^(BUTTON|TD|TH|A|LABEL|OPTION|SELECT|LI)$/;
    for (const h of document.querySelectorAll(p.headings || 'b, h2')) {
      const c = h.parentElement;
      if (!c || c.firstElementChild !== h || BAD.test(c.tagName) || c.closest('button')) continue;
      if (isExcluded(c, roots) || !vis(h) || !vis(c)) continue;
      const l = firstLine(h);
      if (!l || !/[A-Za-z]/.test(l)) continue;
      // A panel is a titled section with a divider or a control, not an inline titled card. A title
      // paragraph (<p><b>…</b>) stands for its enclosing block (Paperclips' engine boxes).
      const scope = c.tagName === 'P' && c.parentElement ? c.parentElement : c;
      if (!scope.querySelector('hr, button, select, input, textarea')) continue;
      const k = c.id || 'panel:' + l.replace(/[0-9][0-9,.]*/g, '#');
      if (!seen.has(k)) out.push({ k, l: l.replace(/[:\s]+$/, '') });
      seen.add(k);
    }
    return out;
  }
  function collectLines(cfg, roots, vis) {
    if (!cfg) return [];
    const els = [...document.querySelectorAll(cfg.selector)].filter((el) => !isExcluded(el, roots) && (cfg.anyVisibility || vis(el)));
    let lines = els.map((el) => norm(el.textContent)).filter(Boolean);
    if (cfg.newestFirst) lines = lines.slice(0, cfg.max || 10).reverse();
    else lines = lines.slice(-(cfg.max || 10));
    return lines; // oldest → newest
  }
  function collectModal(sp, roots, vis) {
    const m = sp.modal;
    if (!m) return null;
    const root = document.querySelector(m.root);
    if (!root || !vis(root)) return null;
    const title = root.querySelector(m.title);
    const options = [...root.querySelectorAll(m.options)].filter(vis).map((el) => ({ k: keyOf(el, sp), l: firstLine(el), e: isEnabled(el, sp) ? 1 : 0 }));
    return { title: title ? norm(title.textContent) : '', options };
  }
  const NUM = /(?:[0-9][0-9,]*(?:\.[0-9]+)?|\.[0-9]+)/g;
  function countNumbers(sp, roots, vis) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const skipTags = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|SELECT|OPTION|TEMPLATE)$/;
    let count = 0;
    const tokens = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue;
      if (!text || !/[0-9]/.test(text)) continue;
      const parent = n.parentElement;
      if (!parent || skipTags.test(parent.tagName) || isExcluded(parent, roots) || !vis(parent)) continue;
      const m = text.match(NUM);
      if (m) {
        count += m.length;
        if (tokens.length < 400) tokens.push(...m);
      }
    }
    return { count, tokens };
  }
  function metrics() {
    try {
      return window.__harnessMetrics ? window.__harnessMetrics() : {};
    } catch (e) {
      return { metricsError: String(e) };
    }
  }

  window.__critic = {
    snapshot(opts) {
      const sp = spec();
      const roots = excludedRoots(sp);
      const vis = makeVisible(sp);
      const sliders = [...document.querySelectorAll(sp.sliders || 'input[type=range]')]
        .filter((el) => !isExcluded(el, roots) && vis(el))
        .map((el) => ({ k: keyOf(el, sp), v: el.value }));
      const consoleLines = collectLines(sp.console, roots, vis);
      const logLines = collectLines(sp.log, roots, vis);
      const nums = countNumbers(sp, roots, vis);
      const ms = sp.milestone ? document.querySelector(sp.milestone) : null;
      const snap = {
        buttons: collectButtons(sp, roots, vis, false),
        sliders,
        panels: collectPanels(sp, roots, vis),
        console: consoleLines.length ? consoleLines[consoleLines.length - 1] : '',
        consoleLines,
        log: logLines.length ? logLines[logLines.length - 1] : '',
        logLines,
        modal: collectModal(sp, roots, vis),
        numbers: nums.count,
        milestone: !!(ms && !isExcluded(ms, roots) && vis(ms)),
        m: metrics(),
      };
      if (opts && opts.tokens) snap.tokens = nums.tokens;
      return snap;
    },
    controls() {
      const sp = spec();
      const roots = excludedRoots(sp);
      const vis = makeVisible(sp);
      return { buttons: collectButtons(sp, roots, vis, true), modal: collectModal(sp, roots, vis), m: metrics() };
    },
    find(key) {
      const sp = spec();
      const roots = excludedRoots(sp);
      const vis = makeVisible(sp);
      for (const el of document.querySelectorAll(sp.buttons || 'button')) {
        if (isExcluded(el, roots) || !vis(el)) continue;
        if (keyOf(el, sp) === key) return el;
      }
      return null;
    },
    click(key) {
      const sp = spec();
      const el = window.__critic.find(key);
      let ok = false;
      let label = '';
      if (el && isEnabled(el, sp)) {
        label = firstLine(el).slice(0, 90);
        el.click();
        ok = true;
      }
      return { ok, label };
    },
    /** Phase 2 inner loop: n × (click the main button if visible+enabled, advance stepMs). */
    mashAdvance(key, n, stepMs, mode) {
      let clicks = 0;
      for (let i = 0; i < n; i++) {
        if (key) {
          const el = window.__critic.find(key);
          if (el && isEnabled(el, spec())) {
            el.click();
            clicks++;
          }
        }
        if (mode === 'tick') window.__game.tick(stepMs);
        else window.__advance(stepMs);
      }
      return clicks;
    },
    parseMoney,
    parseCosts,
  };
}
