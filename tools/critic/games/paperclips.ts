// Universal Paperclips adapter (jgmize mirror, served from agent-tools/refs/paperclips/docs).
// The game is never modified: timers/Date/Math.random are virtualised by the init script, and
// game state is read from its globals (declared with `var`, so they live on window).
import path from 'node:path';
import { REFS_DIR, fmtN } from '../lib/util.ts';
import { REPEAT_KEYS, FACTORY, LAUNCH_PROBE, stageGoals, opsPlan, pickStrategy, swarmSlider, stage2, stage3 } from './paperclips-late.ts';

/** Debug/save buttons the jgmize mirror leaves visible. Excluded from every count. */
const DEBUG_BUTTONS = [
  'save1Button', 'load1Button', 'save2Button', 'load2Button', 'resetButton', 'freeClipsButton', 'freeMoneyButton',
  'freeTrustButton', 'freeOpsButton', 'freeCreatButton', 'freeYomiButton', 'resetPrestige', 'destroyAllHumansButton',
  'freePrestigeU', 'freePrestigeS', 'debugBattleNumbers', 'availMatterZero',
];

/** Probe-design allocation arrows (Stage 3) behave like sliders: ambient, never "a purchase". */
const PROBE_ARROWS = ['Speed', 'Nav', 'Rep', 'Haz', 'Fac', 'Harv', 'Wire', 'Combat'].flatMap((x) => [`btnLowerProbe${x}`, `btnRaiseProbe${x}`]);

export default {
  name: 'paperclips',
  title: 'Universal Paperclips',
  page: 'index2.html',
  clock: 'virtual',
  /** Button states refresh in the 10-ms main loop; one loop tick after each click. */
  clickGapMs: 10,
  defaultDir: () => path.join(REFS_DIR, 'paperclips', 'docs'),

  spec: {
    buttons: 'button',
    project: '.projectButton',
    sliders: 'input[type=range]',
    exclude: DEBUG_BUTTONS.map((id) => `#${id}`),
    ambient: ['btnMakePaperclip', 'btnLowerPrice', 'btnRaisePrice', 'btnInvest', 'btnWithdraw', 'btnQcompute', ...PROBE_ARROWS],
    console: { selector: '#readout5, #readout4, #readout3, #readout2, #readout1' },
    log: null,
    modal: null,
    milestone: '#nextTrust',
    panels: { headings: 'b, h2' },
  },

  metrics: function paperclipsMetrics() {
    const w = window;
    const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
    if (typeof w.clips === 'undefined' || typeof w.humanFlag === 'undefined') return { ready: 0 };
    // Stage 2/3 rates are read as printed ("36.65 billion"), like a player would.
    const WORDS = { thousand: 3, million: 6, billion: 9, trillion: 12, quadrillion: 15, quintillion: 18, sextillion: 21, septillion: 24, octillion: 27, nonillion: 30, decillion: 33, undecillion: 36, duodecillion: 39, tredecillion: 42, quattuordecillion: 45, quindecillion: 48, sexdecillion: 51 };
    const shown = (id) => {
      const el = (document.getElementById(id) as HTMLButtonElement);
      const mm = el && /(-?[0-9][0-9,]*(?:\.[0-9]+)?)\s*([a-z]+)?/i.exec(el.textContent || '');
      return mm ? parseFloat(mm[1].replace(/,/g, '')) * Math.pow(10, WORDS[(mm[2] || '').toLowerCase()] || 0) : 0;
    };
    const vis = (id) => {
      const el = (document.getElementById(id) as HTMLButtonElement);
      return !!(el && el.checkVisibility({ checkVisibilityCSS: true }));
    };
    const slider = (document.getElementById('slider') as HTMLInputElement);
    return {
      ready: 1,
      stage: w.milestoneFlag >= 15 ? 4 : w.spaceFlag == 1 ? 3 : w.humanFlag == 0 ? 2 : 1,
      funds: n(w.funds),
      backlog: n(w.unsoldClips),
      rate: n(w.clipRate),
      autoRate: n(w.clipmakerLevel) * n(w.clipperBoost) + n(w.megaClipperLevel) * n(w.megaClipperBoost) * 500,
      automation: n(w.clipmakerLevel) + n(w.megaClipperLevel) + n(w.harvesterLevel) + n(w.wireDroneLevel) + n(w.factoryLevel),
      price: n(w.margin),
      demand: n(w.demand),
      stock: w.humanFlag == 1 ? n(w.wire) : null,
      stockPrice: n(w.wireCost),
      stockUnit: n(w.wireSupply),
      clips: n(w.clips),
      unusedClips: n(w.unusedClips),
      trust: n(w.trust),
      nextTrust: n(w.nextTrust),
      processors: n(w.processors),
      memory: n(w.memory),
      ops: n(w.operations),
      maxOps: n(w.memory) * 1000,
      creativity: n(w.creativity),
      yomi: n(w.yomi),
      marketingLvl: n(w.marketingLvl),
      clipmakerLevel: n(w.clipmakerLevel),
      megaClipperLevel: n(w.megaClipperLevel),
      wirePurchase: n(w.wirePurchase),
      harvesterLevel: n(w.harvesterLevel),
      wireDroneLevel: n(w.wireDroneLevel),
      factoryLevel: n(w.factoryLevel),
      farmLevel: n(w.farmLevel),
      batteryLevel: n(w.batteryLevel),
      storedPower: n(w.storedPower),
      availableMatter: n(w.availableMatter),
      probeCount: n(w.probeCount),
      ticks: n(w.ticks),
      // Stage 2 (Manufacturing / Wire Production / Power / Swarm Computing boxes)
      wireStock: n(w.wire),
      acquiredMatter: n(w.acquiredMatter),
      harvestRate: shown('maps'),
      wireRate: shown('wpps'),
      powerProd: shown('powerProductionRate'),
      powerCons: shown('powerConsumptionRate'),
      powerCap: n(w.batteryLevel) * n(w.batterySize),
      performance: shown('performance'),
      factoryCost: n(w.factoryCost),
      harvesterCost: n(w.harvesterCost),
      wireDroneCost: n(w.wireDroneCost),
      farmCost: n(w.farmCost),
      batteryCost: n(w.batteryCost),
      swarmGifts: n(w.swarmGifts),
      swarmStatus: vis('swarmEngine') && vis('swarmStatusDiv') ? (document.getElementById('swarmStatus').textContent || '').trim() : '',
      slider: slider ? Number(slider.value) : 0,
      autoTourney: vis('autoTourneyStatusDiv') ? (document.getElementById('autoTourneyStatus').textContent || '').trim() : '',
      // Stage 3 (Von Neumann Probe Design / Space Exploration boxes)
      probeTrust: n(w.probeTrust),
      probeUsedTrust: n(w.probeUsedTrust),
      maxTrust: n(w.maxTrust),
      probeSpeed: n(w.probeSpeed),
      probeNav: n(w.probeNav),
      probeRep: n(w.probeRep),
      probeHaz: n(w.probeHaz),
      probeFac: n(w.probeFac),
      probeHarv: n(w.probeHarv),
      probeWire: n(w.probeWire),
      probeCombat: n(w.probeCombat),
      probesLaunched: n(w.probeLaunchLevel),
      probesLostHaz: n(w.probesLostHaz),
      probesLostDrift: n(w.probesLostDrift),
      probesLostCombat: n(w.probesLostCombat),
      drifterCount: n(w.drifterCount),
      honor: n(w.honor),
      explored: shown('colonizedDisplay'),
      milestoneFlag: n(w.milestoneFlag),
    };
  },

  fingerprint: function paperclipsFingerprint() {
    const w = window;
    return JSON.stringify([
      w.funds, w.clips, w.unsoldClips, w.wire, w.clipmakerLevel, w.megaClipperLevel, w.marketingLvl, w.margin, w.trust,
      w.processors, w.memory, w.standardOps, w.tempOps, w.creativity, w.yomi, w.wireBuyerStatus, w.harvesterLevel,
      w.wireDroneLevel, w.factoryLevel, w.farmLevel, w.batteryLevel, w.probeCount, w.unusedClips, w.bankroll, w.investLevel,
      w.tourneyInProg, w.swarmGifts, w.activeProjects ? w.activeProjects.length : 0,
      w.projects ? w.projects.map((p) => p.flag).join('') : '',
      w.probeTrust, w.probeSpeed, w.probeNav, w.probeRep, w.probeHaz, w.probeFac, w.probeHarv, w.probeWire, w.probeCombat,
      w.maxTrust, w.honor, w.probeLaunchLevel, w.boredomFlag, w.disorgFlag, w.entertainCost, w.storedPower, w.autoTourneyStatus,
    ]);
  },

  policy: {
    main: 'btnMakePaperclip',
    automation: ['btnMakeClipper'],
    consumable: 'btnBuyWire',
    lower: 'btnLowerPrice',
    raise: 'btnRaisePrice',
    drip: ['btnMakeClipper', 'btnExpandMarketing', 'btnMakeMegaClipper'],
    goal: [],
    /**
     * Toggles and "Disassemble All" are never clicked; tournaments are handled in special(), and the
     * Stage 2 repeat purchases (drones, farms, batteries) by the Stage 2 rules (paperclips-late.ts).
     */
    skip: [
      'btnToggleWireBuyer', 'btnToggleAutoTourney', 'btnFactoryReboot', 'btnHarvesterReboot', 'btnWireDroneReboot',
      'btnFarmReboot', 'btnBatteryReboot', 'btnNewTournament', 'btnRunTournament', ...REPEAT_KEYS,
    ],
    /** Stage 2: the first Clip Factory, then Space Exploration (saved for; bought first when affordable). */
    goalRule(c) {
      return stageGoals(c);
    },
    /**
     * Trust goes to Memory while the cheapest visible project costs more ops than the cap; any Trust
     * left is spent by the generic loop (Processors/Memory least-bought first). Strategic Modeling
     * tournaments are run with spare ops only (ops at the cap), so they never starve a project.
     */
    /** Keys the generic loop must not buy right now: no Processors while Memory is what is needed. */
    veto(c) {
      const out = [];
      const opsCosts = c.buttons.filter((b) => b.kind === 'project' && b.costs && b.costs.ops > 0).map((b) => b.costs.ops);
      const cheapest = opsCosts.length ? Math.min(...opsCosts) : null;
      if (cheapest != null && cheapest > c.m.maxOps) out.push('btnAddProc');
      // Factories after the first are bought by the Stage 2 chain rule (wire piling up).
      if ((c.m.factoryLevel || 0) >= 1) out.push(FACTORY);
      // Stage 2+: Photonic Chips (a repeatable ops sink) wait while ops are wanted elsewhere.
      if ((c.m.stage || 1) >= 2) {
        const plan = opsPlan(c);
        if (plan.pendingOps || plan.focus) out.push(...c.buttons.filter((b) => /^Photonic Chip/.test(b.l)).map((b) => b.k));
      }
      // Probes died to hazards and the design has no hazard remediation or replication yet: wait.
      if ((c.m.probesLostHaz || 0) >= 1 && ((c.m.probeHaz || 0) < 1 || (c.m.probeRep || 0) < 1)) out.push(LAUNCH_PROBE);
      return out;
    },
    async special(ctx) {
      const stage = ctx.controls.m.stage || 1;
      if (stage >= 2) await pickStrategy(ctx);
      let c = ctx.controls;
      const nt = c.buttons.find((b) => b.k === 'btnNewTournament');
      if (stage < 2) {
        // Stage 1 (round 1): tournaments only with spare ops (ops at the cap).
        if (nt && nt.e && c.m.ops >= c.m.maxOps) c = await ctx.click('btnNewTournament', 'tournament', `ops at cap ${c.m.maxOps}`);
      } else {
        // Stage 2+: a project waiting for ops comes first; then tournaments while the closest goal is
        // priced in yomi; ops idle at the cap while it is priced in creativity; else spare ops only.
        const plan = opsPlan(c);
        const yomiFocus = !plan.pendingOps && plan.focus && plan.focus.res === 'yomi';
        const atCap = !plan.pendingOps && !plan.focus && c.m.ops >= c.m.maxOps;
        if (nt && nt.e && (yomiFocus || atCap)) {
          c = await ctx.click('btnNewTournament', 'tournament', yomiFocus ? `for ${plan.focus.project} (${fmtN(plan.focus.have)} of ${fmtN(plan.focus.price)} yomi)` : `ops at cap ${c.m.maxOps}`);
        }
        // AutoTourney (once bought) is on exactly while tournaments are wanted.
        const want = yomiFocus ? 'ON' : 'OFF';
        if (c.m.autoTourney && c.m.autoTourney !== want && c.buttons.some((b) => b.k === 'btnToggleAutoTourney' && b.e)) {
          c = await ctx.click('btnToggleAutoTourney', 'tournament', `AutoTourney ${want}: ${plan.pendingOps ? `ops wanted for ${plan.pendingOps.l}` : plan.focus ? `goal ${plan.focus.project} (${plan.focus.res})` : 'no goal'}`);
        }
      }
      const run = c.buttons.find((b) => b.k === 'btnRunTournament');
      if (run && run.e) c = await ctx.click('btnRunTournament', 'tournament', 'run');
      for (let guard = 0; guard < 30; guard++) {
        const mem = c.buttons.find((b) => b.k === 'btnAddMem');
        if (!(mem && mem.e)) break;
        const opsCosts = c.buttons.filter((b) => b.kind === 'project' && b.costs && b.costs.ops > 0).map((b) => b.costs.ops);
        const cheapest = opsCosts.length ? Math.min(...opsCosts) : null;
        if (!(cheapest != null && cheapest > c.m.maxOps)) break;
        const before = c;
        c = await ctx.click('btnAddMem', 'memory', `cheapest project ${cheapest} ops > cap ${c.m.maxOps}`);
        if (c === before) break;
      }
      if (stage >= 2) await swarmSlider(ctx);
      if (stage === 2) await stage2(ctx, ctx.memory);
      if (stage === 3) await stage3(ctx, ctx.memory);
      return ctx.controls;
    },
  },

  stageEnded(m, startStage) {
    return (m.stage ?? startStage) > startStage;
  },
  /** Buttons whose purchase ends a stage (pre-transition screenshot only). */
  stageGate: ['projectButton35', 'projectButton46'],

  async boot(session, { stage, fixture }) {
    // Let the first main-loop ticks hide the not-yet-revealed panels before t = 0.
    await session.advance(50);
    const m = await session.metrics();
    const info: { stage: number; fixture: string | null; stageWarning?: string } = { stage: m.stage, fixture: fixture ? fixture.name : null };
    if (stage > 1 && !fixture) info.stageWarning = `--stage ${stage} needs a fixture (run make-fixtures.ts)`;
    if (stage > 1 && m.stage !== stage) info.stageWarning = `fixture loaded Stage ${m.stage}, expected ${stage}`;
    return info;
  },

  /** Fixture names for --stage N. */
  stageFixtures: { 2: 'paperclips-stage2', 3: 'paperclips-stage3' },

  /**
   * Cheats used by make-fixtures.ts. Resource levels are set to round values typical of a player
   * at that point; the gating projects are then bought through their own buttons so the game's
   * own effect/transition code runs. Returns a log of what was done.
   */
  cheats: {
    /** Everything for the Stage 1 → 2 gate except the Release itself; trust stops at `trustTarget`. */
    async toHypnoDrones(session, { trustTarget = 100 } = {}) {
      const log = [];
      const { page } = session;
      for (let i = 0; i < 400; i++) {
        const st = await page.evaluate((tt) => {
          /* global clips:writable, unusedClips:writable, funds:writable, trust:writable, creativity:writable, standardOps:writable, memory:writable, processors:writable, project70:writable, project35:writable, project219:writable */
          // Some funds, as any player has after the first sales: the game's milestone chain (and with
          // it "Full autonomy attained", "One Trillion Clips Created" … and the end of Stage 3,
          // "Universal Paperclips achieved") starts with "funds ≥ $5". Too little for any funds project.
          funds = Math.max(funds, 1000);
          clips = Math.max(clips, 1.2e9); // trust milestones + projects reveal (calculateTrust runs per tick)
          unusedClips = Math.max(unusedClips, clips); // every clip made adds to unusedClips (clipClick)
          if (trust < tt) trust = tt;
          if (typeof creativity === 'number') creativity = Math.max(creativity, 2000);
          standardOps = memory * 1000;
          return { p70: project70.flag, p35: project35.flag, trust, processors, memory };
        }, trustTarget);
        if (st.p70 === 1) break;
        // Trust allocation typical at the release: 30 processors / 70 memory (HypnoDrones needs 70,000 ops).
        await page.evaluate(() => {
          /* global processors:writable, memory:writable, trust:writable, addProc:writable, addMem:writable */
          while (memory < 70 && trust > processors + memory) addMem();
          while (processors < 30 && trust > processors + memory) addProc();
        });
        const bought = await page.evaluate(() => {
          const skip = new Set(['projectButton35', 'projectButton219', 'projectButton217', 'projectButton218', 'projectButton2']);
          const out = [];
          for (const b of document.querySelectorAll<HTMLButtonElement>('#projectListTop button.projectButton')) {
            if (b.disabled || skip.has(b.id)) continue;
            out.push(b.innerText.split('\n')[0].trim());
            b.click();
          }
          return out;
        });
        if (bought.length) log.push(...bought.map((t) => `bought ${t}`));
        await session.advance(1000);
      }
      return log;
    },
    /** Lands just after "Release the HypnoDrones" (start of Stage 2). */
    async stage2(session) {
      const log = await this.toHypnoDrones(session, { trustTarget: 100 });
      const { page } = session;
      await session.advance(1000);
      const ok = await page.evaluate(() => {
        const b = (document.getElementById('projectButton35') as HTMLButtonElement);
        if (!b || b.disabled) return false;
        b.click();
        return true;
      });
      if (!ok) throw new Error('Release the HypnoDrones not available after cheats');
      log.push('bought Release the HypnoDrones');
      await session.advance(10000);
      return log;
    },
    /** Lands just after "Space Exploration" (start of Stage 3). Starts from a Stage 2 session. */
    async stage3(session) {
      const log = [];
      const { page } = session;
      // Stage 2 projects through their buttons (Tóth Tubule Enfolding → Power Grid → Nanoscale Wire →
      // Harvester/Wire Drones → Clip Factories …), with ops kept at the cap.
      for (let i = 0; i < 300; i++) {
        await page.evaluate(() => {
          /* global standardOps:writable, memory:writable, creativity:writable, unusedClips:writable */
          standardOps = memory * 1000;
          creativity = Math.max(creativity, 50000);
          unusedClips = Math.max(unusedClips, 1e12);
        });
        const st = await page.evaluate(() => {
          /* global project45:writable, project127:writable */
          const skip = new Set(['projectButton46', 'projectButton219', 'projectButton217', 'projectButton218']);
          const out = [];
          for (const b of document.querySelectorAll<HTMLButtonElement>('#projectListTop button.projectButton')) {
            if (b.disabled || skip.has(b.id)) continue;
            out.push(b.innerText.split('\n')[0].trim());
            b.click();
          }
          return { out, done: project45.flag === 1 && project127.flag === 1 };
        });
        log.push(...st.out.map((t) => `bought ${t}`));
        if (st.done) break;
        await session.advance(1000);
      }
      // A built-up Earth: some farms, batteries, drones and factories through their buttons.
      await page.evaluate(() => {
        const click = (id, n) => {
          for (let i = 0; i < n; i++) {
            const b = (document.getElementById(id) as HTMLButtonElement);
            if (b && !b.disabled) b.click();
          }
        };
        click('btnFarmx100', 3);
        click('btnBatteryx100', 10);
        click('btnHarvesterx1000', 5);
        click('btnWireDronex1000', 5);
        click('btnMakeFactory', 50);
      });
      await session.advance(5000);
      // Earth consumed; Space Exploration needs 120,000 ops (memory ≥ 120 via swarm gifts),
      // 10,000,000 MW-seconds and 5 octillion clips.
      await page.evaluate(() => {
        /* global availableMatter:writable, acquiredMatter:writable, storedPower:writable, unusedClips:writable, swarmGifts:writable, memory:writable, addMem:writable, standardOps:writable, batteryLevel:writable, batterySize:writable */
        availableMatter = 0;
        acquiredMatter = 0;
        storedPower = Math.max(storedPower, 1e7, batteryLevel * batterySize);
        unusedClips = Math.max(unusedClips, 6e27);
        swarmGifts = Math.max(swarmGifts, 60);
        while (memory < 125 && swarmGifts > 0) addMem();
        standardOps = memory * 1000;
      });
      for (let i = 0; i < 30; i++) {
        await session.advance(1000);
        await page.evaluate(() => {
          /* global standardOps:writable, memory:writable, storedPower:writable */
          standardOps = memory * 1000;
          storedPower = Math.max(storedPower, 2e7); // drones/factories drain it every tick
        });
        await session.advance(20); // let manageProjects() refresh the button's disabled state
        const ok = await page.evaluate(() => {
          const b = (document.getElementById('projectButton46') as HTMLButtonElement);
          if (!b || b.disabled) return false;
          b.click();
          return true;
        });
        if (ok) {
          log.push('bought Space Exploration');
          await session.advance(10000);
          return log;
        }
      }
      throw new Error('Space Exploration not available after cheats');
    },
    /**
     * Just before the Stage 1 → 2 gate: HypnoDrones bought, Trust 99, clips ~15 s short of the next
     * Trust milestone with AutoClippers running, so a policy buys the Release ~15–20 s into the run.
     */
    async s1End(session) {
      const log = await this.toHypnoDrones(session, { trustTarget: 99 });
      const { page } = session;
      // Settle: buy whatever else is affordable now (e.g. Limerick, +1 Trust), so the 100th Trust
      // comes from the next clip milestone and not from a leftover project.
      for (let i = 0; i < 5; i++) {
        const bought = await page.evaluate(() => {
          const skip = new Set(['projectButton35', 'projectButton219', 'projectButton217', 'projectButton218', 'projectButton2', 'projectButton40', 'projectButton40b']);
          const out = [];
          for (const b of document.querySelectorAll<HTMLButtonElement>('#projectListTop button.projectButton')) {
            if (b.disabled || skip.has(b.id)) continue;
            out.push(b.innerText.split('\n')[0].trim());
            b.click();
          }
          return out;
        });
        log.push(...bought.map((t) => `bought ${t}`));
        await session.advance(1000);
      }
      await page.evaluate(() => {
        /* global trust:writable, clips:writable, nextTrust:writable, clipmakerLevel:writable, clipperBoost:writable, wire:writable, unsoldClips:writable, funds:writable, margin:writable */
        trust = 99;
        clipmakerLevel = Math.max(clipmakerLevel, 120);
        wire = Math.max(wire, 2e6);
        funds = 50000; // enough for wire; "A Token of Goodwill" ($500,000, +1 Trust) stays unaffordable
        unsoldClips = Math.min(unsoldClips, 5000);
      });
      await session.advance(3000);
      await page.evaluate(() => {
        /* global clips:writable, nextTrust:writable, clipmakerLevel:writable, clipperBoost:writable */
        const rate = clipmakerLevel * clipperBoost;
        clips = nextTrust - 1 - rate * 15;
      });
      log.push('trust 99; clips 15 s short of the next Trust milestone');
      return log;
    },
  },
};
