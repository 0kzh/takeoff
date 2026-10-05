// Takeoff adapter: everything the harness knows about Takeoff specifically. Buttons are discovered
// generically from the DOM (any visible <button>), so new buttons/projects need no changes here.
import { INFRA, LOT_RE, KEEP_INTERNAL, SEND_BACK, RELEASE_KEYS, END_SCREEN, STAGE4_NEVER, PLANT_KEYS_RE, priceAuto, trainStep, shipStep, standingStep, infraStep } from './takeoff-late.mjs';

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
      ending: s.ending || '',
      gameTime: s.stats.timePlayed,
      funds: s.funds,
      backlog: s.unbilled,
      rate: s.stats.tasksPerSec,
      price: s.price,
      automation: s.gpus,
      stock: s.revealed && s.revealed.buyPower && s.stage < 2 ? s.power : null,
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
      // Stage 2+: room and power as the Stores panel prints them ("GPUs X / Y", "power A / B MW").
      gpusShown: shown('infraGpus'),
      gpuCapacity: shown('gpuCapacity'),
      powerDrawMW: shown('powerMW'),
      powerCapMW: shown('powerCapMW'),
      autoPrice: s.autoPrice ? 1 : 0,
      dataT: s.data,
      // The Train row's GPU line ("Needs 18,000 GPUs. 14,200 free."), the build fund, the end screen.
      trainGpus: seen('trainGpus'),
      buildFund: s.buildFund,
      autonomy: s.autonomy,
      endingTitle: seen('endingTitle'),
      // Stage 4 (absent before it): generations landed / read, treaty progress, the fleet, the exit kind.
      ...(s.s4 && s.stage >= 4
        ? { generations: s.s4.generations, verifiedGens: s.s4.verifiedGens, genPhase: s.s4.gen ? s.s4.gen.phase : '', treaty: s.s4.treaty, robots: s.robots, materials: s.s4.materials, exitKind: (s.flags && s.flags.exitKind) || '' }
        : {}),
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
      // Stage 2+: no big-ticket saving. Checked on s2-r1, seeds 1–3: with and without it the stage
      // ends at the same minute with the same runs and purchases (Marketing, the only drip on screen,
      // is rarely affordable there), so nothing that gates progress starves without it.
      if ((c.m.stage || 1) >= 2) return [];
      const floor = Math.max(10000, 60 * (c.m.revPerSec || 0));
      return c.buttons.filter((b) => b.kind === 'project' && ((b.costs && b.costs.funds) || 0) >= floor).map((b) => b.k);
    },
    /**
     * Never clicked by the generic buy loop: red-team and release/approve (special), "Keep internal"
     * and "Send back" (the first-timer ships), Stage 2+ infrastructure (bought by its on-screen
     * reasons), and the end screen's buttons.
     */
    skip: ['btn-redteam', ...RELEASE_KEYS, KEEP_INTERNAL, SEND_BACK, INFRA.lot, INFRA.datacenter, INFRA.standing, ...END_SCREEN],
    /**
     * Every GPU-lot row and power plant (any "+N MW" button) is bought by the infrastructure rule only.
     * Stage 4: "Sign a halt instead" and "Revoke a grant" are not bought (takeoff-late.mjs STAGE4_NEVER).
     */
    veto(c) {
      const keys = c.buttons.filter((b) => b.kind === 'button' && (PLANT_KEYS_RE.test(b.l) || LOT_RE.test(b.k))).map((b) => b.k);
      if ((c.m.stage || 1) >= 4) keys.push(...STAGE4_NEVER);
      return keys;
    },
    /** Stage 2: AUTO pricing is left on; lower/raise are not touched while it is. */
    priceHold(c) {
      return priceAuto(c);
    },
    /**
     * Every stage: red-team until 0 open issues, then Release / Approve. Stage 2+ (takeoff-late.mjs):
     * an inherited Standing order switched on once; Train first whenever it is enabled and not armed;
     * then infrastructure by what the lot rows and the Train row say.
     */
    async special(ctx) {
      const late = (ctx.controls.m.stage || 1) >= 2;
      if (late) await standingStep(ctx);
      if (late) await trainStep(ctx);
      await shipStep(ctx);
      if (late) await infraStep(ctx);
      return ctx.controls;
    },
  },

  /** Stage N ends when state.stage increases or an ending is set. */
  stageEnded(m, startStage) {
    return (m.stage ?? startStage) > startStage || !!m.ending;
  },
  /**
   * How the stage ended, for the record: "Stage 4", "Stage 5 (fleet granted)" (Stage 4's exits: treaty
   * signed, fleet granted, fleet taken), or "ending: The Pause" (the end screen's title).
   */
  endedHow(m, startStage) {
    if (m.ending) return `ending: ${m.endingTitle || m.ending}`;
    if ((m.stage ?? startStage) <= startStage) return '';
    const kind = { treaty: 'treaty signed', granted: 'fleet granted', taken: 'fleet taken' }[m.exitKind];
    return `Stage ${m.stage}${kind ? ` (${kind})` : ''}`;
  },

  /**
   * New game with a fixed seed: the init script pins Date.now() to the seed until window.__game
   * exists (main.ts: `loadSave() ?? newGame(Date.now())`, storage is empty in a fresh context).
   * Falls back to replaceState(newGame(seed)) through the engine module. --stage N → loadPreset(N);
   * --preset NAME → loadPreset(NAME) (a named start such as '3c'; the stage is what it loads).
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
    const named = preset != null && preset !== '' ? (/^[0-9]+$/.test(String(preset)) ? Number(preset) : String(preset)) : null;
    if (stage > 1 || named != null) {
      const which = named ?? stage;
      const got = await page.evaluate(
        ([sd, n]) => {
          const pinned = Date.now;
          Date.now = () => sd;
          try {
            window.__game.loadPreset(n);
          } finally {
            Date.now = pinned;
          }
          return window.__game.state.stage;
        },
        [seed, which],
      );
      info.preset = `loadPreset(${JSON.stringify(which)}) → state.stage ${got}`;
      if (named == null && got !== stage) info.stageWarning = `preset for Stage ${stage} is not built yet; the game loaded Stage ${got}`;
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
