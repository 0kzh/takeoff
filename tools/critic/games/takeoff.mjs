// Takeoff adapter: everything the harness knows about Takeoff specifically. Buttons are discovered
// generically from the DOM (any visible <button>), so new buttons/projects need no changes here.
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
    /** Never clicked by the generic buy loop (handled in special()). */
    skip: ['btn-redteam', 'btn-release'],
    /** Red-team until 0 open issues, then release. */
    async special(ctx) {
      let c = ctx.controls;
      const find = (k) => c.buttons.find((b) => b.k === k);
      for (let guard = 0; guard < 3; guard++) {
        const m = c.m;
        if (m.trainingPhase !== 'redteam') break;
        const rt = find('btn-redteam');
        const rel = find('btn-release');
        if ((m.issuesOpen ?? 0) > 0 && rt && rt.e) {
          c = await ctx.click('btn-redteam', 'redteam', `${m.issuesOpen} open issues`);
        } else if ((m.issuesOpen ?? 0) === 0 && rel && rel.e) {
          c = await ctx.click('btn-release', 'release', '0 open issues');
        } else break;
      }
      return c;
    },
  },

  /** Stage N ends when state.stage increases or an ending is set. */
  stageEnded(m, startStage) {
    return (m.stage ?? startStage) > startStage || !!m.ending;
  },

  /**
   * New game with a fixed seed: the init script pins Date.now() to the seed until window.__game
   * exists (main.ts: `loadSave() ?? newGame(Date.now())`, storage is empty in a fresh context).
   * Falls back to replaceState(newGame(seed)) through the engine module. --stage N → loadPreset(N).
   */
  async boot(session, { seed, stage }) {
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
    if (stage > 1) {
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
        [seed, stage],
      );
      info.preset = `loadPreset(${stage}) → state.stage ${got}`;
      if (got !== stage) info.stageWarning = `preset for Stage ${stage} is not built yet; the game loaded Stage ${got}`;
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
