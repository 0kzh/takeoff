// A Dark Room adapter (doublespeakgames/adarkroom, served from agent-tools/refs/adarkroom).
// Buttons are <div class="button"> (disabled via the `disabled` class, also during cool-downs);
// locations slide inside an overflow:hidden frame, so visibility includes a clipping check.
import path from 'node:path';
import { REFS_DIR } from '../lib/util.ts';

export default {
  name: 'adr',
  title: 'A Dark Room',
  page: 'index.html',
  clock: 'virtual',
  clickGapMs: 10,
  defaultDir: () => path.join(REFS_DIR, 'adarkroom'),

  spec: {
    buttons: '.button, .headerButton',
    // Auto-generated ids (BTN_<guid>) and generic event ids are not stable; key every button by label.
    labelKeyIds: '.*',
    tab: '.headerButton',
    // Build costs live in a hover tooltip (row_key/row_val); ADR does not grey out unaffordable builds.
    tooltipCosts: '.tooltip .row_key',
    modalOption: '#event .button',
    disabledClass: 'disabled',
    selectedClass: 'selected',
    opacity: true,
    clip: true,
    sliders: 'input[type=range]',
    exclude: ['.menu', '#saveNotify', '.logo'],
    ambient: [],
    console: { selector: '#notifications .notification', newestFirst: true, max: 10 },
    log: null,
    modal: { root: '#event', title: '.eventTitle', options: '#buttons .button' },
    milestone: null,
    panels: { selector: '[data-legend]', titleAttr: 'data-legend' },
  },

  metrics: function adrMetrics() {
    const SM = window.$SM;
    if (!SM || !window.Engine) return { ready: 0 };
    const get = (k) => {
      try {
        return SM.get(k, true);
      } catch {
        return 0;
      }
    };
    const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
    // Store amounts by name (wood, fur, …) so tooltip costs can be checked against them.
    const stores = {};
    const raw = (window.State && window.State.stores) || {};
    for (const k of Object.keys(raw)) stores[k.toLowerCase()] = n(raw[k]);
    return {
      ...stores,
      ready: 1,
      stage: 1,
      fire: n(get('game.fire.value')),
      temperature: n(get('game.temperature.value')),
      builder: n(get('game.builder.level')),
      population: n(get('game.population')),
      automation: n(get('game.buildings["hut"]')),
      location: window.Engine.activeModule ? window.Engine.activeModule.name || '' : '',
    };
  },

  fingerprint: function adrFingerprint() {
    return JSON.stringify(window.State) + '|' + (window.Engine.activeModule ? window.Engine.activeModule.name : '');
  },

  policy: {
    main: null, // every ADR verb has a cool-down; the generic loop clicks whatever is enabled
    automation: [],
    consumable: null,
    lower: null,
    raise: null,
    drip: [],
    goal: [],
    skip: [],
    /** A curious player visits the other location when nothing in view is clickable. */
    async special(ctx) {
      const c = ctx.controls;
      const tabs = c.buttons.filter((b) => b.kind === 'tab');
      if (tabs.length < 2 || c.modal) return c;
      const actionable = c.buttons.some((b) => b.e && !b.a && b.kind === 'button');
      if (actionable) return c;
      const cur = tabs.findIndex((b) => b.s);
      const next = tabs[(cur + 1) % tabs.length];
      return ctx.click(next.k, 'navigate', `nothing enabled here → ${next.l}`);
    },
  },

  stageEnded() {
    return false;
  },

  async boot(session) {
    // jQuery ready → Engine.init run on (virtual) timers.
    await session.advance(50);
    const ok = await session.page.evaluate(() => !!(window.Engine && window.$SM));
    return { stage: 1, engine: ok ? 'ok' : 'Engine missing' };
  },
};
