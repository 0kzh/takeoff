// Takeoff adapter: everything the harness knows about Takeoff specifically. Buttons are discovered
// generically from the DOM (any visible <button>), so new buttons/projects need no changes here.
/** Release after red-teaming to zero open issues. */
export const RELEASE_KEYS = ['btn-release'];
/** The New game button (shown in the blank stages): never pressed (a new game would wipe the run). */
const END_SCREEN = ['btn-newGame'];

const find = (c, k) => c.buttons.find((b) => b.k === k);

/** Red-team until no issue is open, then Release (publicly). */
export async function shipStep(ctx) {
  let c = ctx.controls;
  for (let guard = 0; guard < 3; guard++) {
    const m = c.m;
    if (m.trainingPhase !== 'redteam') break;
    const rt = find(c, 'btn-redteam');
    const rel = RELEASE_KEYS.map((k) => find(c, k)).find(Boolean);
    const open = m.issuesOpen ?? 0;
    if (open > 0 && rt && rt.e) {
      c = await ctx.click('btn-redteam', 'redteam', `${open} open issues`);
    } else if (rel && rel.e && !ctx.noop.has(rel.k) && (open === 0 || !rt)) {
      c = await ctx.click(rel.k, 'release', open === 0 ? '0 open issues' : `${open} open issues, no Red-team button on screen`);
    } else break;
  }
  return c;
}

export default {
  name: 'takeoff',
  title: 'Takeoff',
  page: 'index.html',
  /** Native game loop; phase 2 steps with __game.tick(ms). */
  clock: 'tick',

  spec: {
    buttons: 'button',
    project: '.projectButton',
    modalOption: '#modalButtons button',
    sliders: 'input[type=range]',
    // Dev overlay and the save toast are not part of the game screen.
    exclude: ['#dev', '#toast'],
    ambient: ['btn-task', 'btn-lowerPrice', 'btn-raisePrice', 'btn-focus-capability', 'btn-focus-efficiency', 'btn-focus-safety', 'btn-grid'],
    console: { selector: '#readout5, #readout4, #readout3, #readout2, #readout1' },
    log: { selector: '#logList .logEntry', newestFirst: true, max: 10 },
    modal: { root: '#modalOverlay', title: '#modalTitle', options: '#modalButtons button' },
    milestone: '#nextTrust',
    panels: { headings: 'b, h2' },
  },

  /** In-page; reads the documented window.__game API. */
  metrics: function takeoffMetrics() {
    const g = window.__game;
    if (!g || !g.state) return { ready: 0 };
    const s = g.state;
    const run = s.training && s.training.run;
    let projectsBought = 0;
    for (const k in s.projects) projectsBought += (s.projects[k] && s.projects[k].bought) || 0;
    const shown = (id) => {
      const el = document.getElementById(id);
      const mm = el && /-?[0-9][0-9,]*(?:\.[0-9]+)?/.exec(el.textContent || '');
      return mm ? parseFloat(mm[0].replace(/,/g, '')) : 0;
    };
    /** Text of an element as the player sees it ('' when it is not visible). */
    const seen = (id) => {
      const el = document.getElementById(id);
      return el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    };
    const bp = document.getElementById('btn-buyPower');
    const unitMatch = bp && /\(([0-9][0-9,]*)/.exec(bp.textContent || '');
    return {
      ready: 1,
      stage: s.stage,
      gameTime: s.stats.timePlayed,
      funds: s.funds,
      backlog: s.unbilled,
      rate: s.stats.tasksPerSec,
      price: s.price,
      automation: s.gpus,
      stock: s.revealed && s.revealed.buyPower ? s.power : null,
      stockPrice: s.powerPrice,
      stockUnit: unitMatch ? parseFloat(unitMatch[1].replace(/,/g, '')) : 1000,
      tasks: s.tasks,
      research: s.research,
      insight: s.insight,
      trust: s.trust,
      issuesOpen: run && run.phase === 'redteam' ? run.issues : null,
      trainingPhase: run ? run.phase : '',
      redTeamRemaining: s.training ? s.training.redTeamRemaining : 0,
      choice: s.activeChoice ? s.activeChoice.id : '',
      revPerSec: s.stats.revPerSec,
      soldPerSec: s.stats.soldPerSec,
      gpus: s.gpus,
      power: s.power,
      powerBought: s.powerBought,
      gridAuto: s.gridAuto ? 1 : 0,
      hypeLevel: s.hypeLevel,
      priceRaises: s.priceRaises,
      researchers: s.researchers,
      labSpace: s.labSpace,
      trainings: s.stats.trainings,
      releases: s.stats.releases,
      choices: s.stats.choices,
      idleRescues: s.stats.idleRescues,
      incidents: s.stats.incidents,
      projectsBought,
      capability: s.capability,
      date: s.date,
      autoPrice: s.autoPrice ? 1 : 0,
      // The Train row's GPU line ("Needs 18,000 GPUs. 14,200 free.").
      trainGpus: seen('trainGpus'),
    };
  },

  /** In-page; any state change from a click shows up here. */
  fingerprint: function takeoffFingerprint() {
    return JSON.stringify(window.__game.state);
  },

  policy: {
    main: 'btn-task',
    automation: ['btn-gpu'],
    consumable: 'btn-buyPower',
    lower: 'btn-lowerPrice',
    raise: 'btn-raisePrice',
    /** Repeat purchases stopped while saving for a big-ticket goal. */
    drip: ['btn-gpu', 'btn-marketing'],
    goal: ['proj-p_datacenter'],
    /**
     * Report §1: "once a big-ticket goal is visible stop the GPU/marketing drip and save". Round 1
     * named its one such project by id (the stage gate above). Stated as a rule so later builds
     * need no edit: any visible project priced in funds at ≥ $10,000 and ≥ one minute of revenue.
     */
    goalRule(c) {
      const floor = Math.max(10000, 60 * (c.m.revPerSec || 0));
      return c.buttons.filter((b) => b.kind === 'project' && ((b.costs && b.costs.funds) || 0) >= floor).map((b) => b.k);
    },
    /** Never clicked by the generic buy loop: red-team and release (special), and the New game button. */
    skip: ['btn-redteam', ...RELEASE_KEYS, ...END_SCREEN],
    /** Every run: red-team until 0 open issues, then Release. */
    async special(ctx) {
      await shipStep(ctx);
      return ctx.controls;
    },
  },

  /** Stage N ends when state.stage increases (Stage 2 onward is a blank placeholder). */
  stageEnded(m, startStage) {
    return (m.stage ?? startStage) > startStage;
  },
  /** How the stage ended, for the record: "Stage 2". */
  endedHow(m, startStage) {
    return (m.stage ?? startStage) > startStage ? `Stage ${m.stage}` : '';
  },

  /**
   * New game with a fixed seed: the init script pins Date.now() to the seed until window.__game
   * exists (main.ts: `loadSave() ?? newGame(Date.now())`, storage is empty in a fresh context).
   * Falls back to replaceState(newGame(seed)) through the engine module. --preset NAME →
   * loadPreset(NAME) ('1' the start, 'end' the end of Stage 1, with the First Datacenter on the board).
   */
  async boot(session, { seed, stage, preset }) {
    const { page } = session;
    await page.waitForFunction(() => !!(window.__game && window.__game.state), null, { timeout: 20000 });
    const info = { seedMethod: 'Date.now pinned during boot' };
    let st = await page.evaluate(() => ({ seed: window.__game.state.seed, tickCount: window.__game.state.tickCount, tasks: window.__game.state.tasks }));
    if (st.seed !== seed || st.tickCount !== 0 || st.tasks !== 0) {
      const ok = await page
        .evaluate(async (sd) => {
          const main = document.querySelector('script[type=module][src]');
          const mod = await import(new URL('engine/state.js', main.src).href);
          window.__game.setSpeed(0);
          mod.replaceState(window.__game.state, mod.newGame(sd));
          window.__game.save();
          window.__game.render();
          return window.__game.state.seed === sd;
        }, seed)
        .catch((e) => String(e));
      info.seedMethod = ok === true ? 'replaceState(newGame(seed)) via dist/engine/state.js' : `FAILED (${ok}); seed ${st.seed}`;
    }
    await page.evaluate(() => window.__game.setSpeed(0));
    const named = preset != null && preset !== '' ? String(preset) : null;
    if (named != null) {
      const got = await page.evaluate(
        ([sd, n]) => {
          const pinned = Date.now;
          Date.now = () => sd;
          try {
            window.__game.loadPreset(n);
          } finally {
            Date.now = pinned;
          }
          return window.__game.state.tasks;
        },
        [seed, named],
      );
      info.preset = `loadPreset(${JSON.stringify(named)}) → ${got} tasks`;
    }
    st = await page.evaluate(() => ({ seed: window.__game.state.seed, stage: window.__game.state.stage, version: window.__game.version }));
    Object.assign(info, { stateSeed: st.seed, stage: st.stage, saveVersion: st.version });
    return info;
  },

  /** The game's own bot (README: __game.setAutoplay). */
  async setAutoplay(session, on) {
    await session.page.evaluate((v) => window.__game.setAutoplay(v), on);
  },
};
