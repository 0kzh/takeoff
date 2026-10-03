# Handoff — Takeoff (ASI race incremental game)

**Date:** 2026-10-03. **Branch:** `cursor/asi-race-game-c688` (pushed; everything committed, working tree clean).
**Goal:** a browser incremental game about an AI lab racing to superintelligence, built in raw HTML/CSS + vanilla TypeScript (`tsc` → plain ES modules, no frameworks, no bundler, no runtime deps). Primary bar: Universal Paperclips. Secondary: A Dark Room. World: AI 2027.
**Process rule from the user:** Fable models for research/planning, Opus 5.5 for implementation, via subagents. Critic loop runs **after each stage** (user correction: "Critic loop should start earlier, after stage 1 is done. Should run for each of the stages."). Do not create PRs (New Project session).

## Status

| Stage | Build | Critic |
|---|---|---|
| 1 The Startup | Built, tuned, verified (commits `53be53b`…`50196b2`). **Critic round 1 scored it 5.6 vs Paperclips 7.9. Fixes specified but NOT yet implemented** — see "Next action" below. | Round 1 done (`/tmp/critic/report-stage1.md`). Round 2 pending after fixes. |
| 2 Scale | Only the Infrastructure seed (datacenters, gas turbines, GPU batches). No projects, no data, no allocation slider, no capability graph, no gov/public/security/stats panels revealed. | Not started |
| 3 Takeoff | Stage shell + reveal flags only (alignment/security/geopolitics/oversight panels exist hidden). | Not started |
| 4 Superintelligence | Stage shell (robots/society/treaty/monitors). | Not started |
| 5 Beyond | Stage shell (space). Endings stubbed in `src/engine/endings.ts`. | Not started |

## Next action (start here)

A fix brief was written for an Opus 5.5 subagent but the agent was **not launched** (session ended). Re-issue it. The full brief is the prompt under "Stage 1 fix brief" below; it was derived from the critic report. After the fixes land and the sim targets pass, **re-run the critic** (harness is reusable, see "Critic loop" below) and repeat until Takeoff wins the Stage 1 rubric, then build Stage 2.

## How to run

```sh
cd /workspace && npm install && npm run dev     # tsc + static server on http://127.0.0.1:8731/  (?dev=1 shows the dev overlay; backtick toggles it)
npm run sim -- --minutes 40 --seed 1            # headless reasonable-player timeline
```

Dev overlay + `window.__game` API documented in `README.md` (state, actions, tick(dtMs), projects, events, presets, loadPreset(n)). Stage presets exist for Stage 1 and Stage 2 starts; presets 3–5 load Stage 2 and print `preset pending`.

## Architecture (what exists)

```
index.html    all panels for all 5 stages present and hidden (stable ids, data-panel, data-reveal)
styles.css    UP/ADR look (Times New Roman 16px, black/white, UP .button2 gradient, .projectButton 275x60 #c8c8c8, ADR cooldown bar, responsive <1100px / <700px)
src/main.ts   boot: load save → mount → rAF loop
src/engine/   PURE (no DOM) — state.ts (GameState, newGame, SAVE_VERSION=1, migrate), tick.ts (100ms fixed step),
              economy.ts (UP demand/sales), training.ts (train→eval→red-team→release), projects.ts, events.ts
              (developments, choices, idle guard), stages.ts (stage defs, enter(), reveal rules), clock.ts,
              endings.ts (stubs), rng.ts (mulberry32, seed in state), format.ts
src/data/     projects.ts, developments.ts, choices.ts, crises.ts (stubs), flavor.ts, presets.ts
src/ui/       render.ts (visibility from state.revealed), console.ts, log.ts, modal.ts, graph.ts (stub), dev.ts, save.ts, dom.ts
src/sim/      policy.ts (the bot; also drives dev overlay Autoplay), bot.ts
scripts/serve.mjs   zero-dep static server, port 8731, Cache-Control: no-store
```

Key design decisions already baked in (do not undo without reason): visibility is state — `state.revealed` flags, `data-reveal` attributes, renderer is the only thing toggling DOM, so save/load restores the UI for free (UP's approach). `localStorage["takeoff.save.v1"]`, autosave 15 s + on every action + visibility/unload, `saved.` toast ≤1/30 s, timers stored as remaining seconds. All randomness through `rng.ts` so sims replay exactly. `.gitignore` covers `dist/`, `node_modules/`, `agent-tools/` — never commit those.

## Design numbers (current, post-tuning; docs/design.md is the original spec and is partly superseded)

- Stage 1 clock: 1 month / 4.5 min (Jul→Dec 2025). Transition: buy **First Datacenter** (currently triggers at 300k tasks, costs $250k + 18,000 research — the fix brief replaces this with a ladder).
- Demand: UP formula with a ×3 market-size multiplier: `demand = (0.8/price) × 1.1^(hype−1) × qualityMult × hypeBoost(t) × boosts × 3`; sales every 100 ms `if rand < demand/100 sell floor(0.7 × demand^1.15)`.
- Trust: Fibonacci ×1,000 but **first milestone at 2,000 tasks** (not 3,000). Start trust 2.
- GPU cost `6 + 1.1^n` (→ `1.08^n` after Bulk GPU lease). Marketing `$100 × 2^(lvl−1)`. Power price random walk $14–32, start $20.
- Training: 45–120 s, 50 % compute diverted; runs short of compute are **undertrained** (partial gain) not slower; focus gains Capability +35–50 % / Efficiency +15 % + copiesPerGPU ×1.25 / Safety +15 % + alignment +8/+5 — **the fix brief cuts these to +12–18 % / +5 % / +5 %** because capability reached ~4× inside Stage 1, which would trivialize Stage 2's exit (4× = superhuman coder = Stage 3 entry). Target: Stage 1 ends at capability ≈ 1.5–1.8×.
- Capability ladder (AI-2027, `docs/design.md` §9): 1.5× reliable agent · **4× superhuman coder (Stage 3 entry)** · 10× country of geniuses · **25× superhuman AI researcher (Stage 4 entry)** · 250× SIAR · 1,000× ASI. Graph y-axis is this multiplier (log), not IQ; IQ gloss only in tooltips (`100 × cap^0.7`).
- Stage 2 has a 25-min minimum stay (`STAGE2_MIN_SECONDS`) and exits at capability ≥ 4× + one release — remove the timer once Stage 2 content exists.
- Idle guard fires after 60 s with nothing newly affordable/revealed (Customer email / Press release); critic found it fires even at 0 tasks and pays too much late — fix brief gates and caps it.

## Critic loop

- **Report:** `/tmp/critic/report-stage1.md` (method, definitions, reveal timelines for both games, rubric, soft-locks, biggest gap, 5 secondary gaps, verdict). **Copy this into the repo if the /tmp tree might be lost** — it is not in git.
- **Harness (reusable):** `/tmp/critic/pw/` — `run.js`, `analyze.js`, `transition-*.js`, `softlock*-*.js`, `lib.js`, `games.js`; raw traces (`takeoff-final.*`, `pc-final.*`, `pc-accel.*`, `adr.*`) and screenshots under `/tmp/critic/`. Playwright + Chromium already installed (cache in `~/.cache/ms-playwright`; also `/usr/local/bin/google-chrome`). Re-run instructions are in report §8.
- **Reference servers (tmux, still running):** Universal Paperclips `http://127.0.0.1:8732/index2.html` (clone also at `/tmp/refs/paperclips` and `/tmp/critic/paperclips`), A Dark Room `http://127.0.0.1:8733/index.html` (clone `/tmp/refs/adarkroom`), Takeoff `http://127.0.0.1:8731/` (tmux session `takeoff-server`). UP exposes all state as globals (`clips`, `funds`, `wire`, `trust`, `processors`, `memory`, `operations`, `creativity`, functions `clipClick`, `makeClipper`, `buyWire`, project buttons `projectButtonN`) — that is the critic's cheat overlay for Paperclips.
- **Round-1 result (verbatim headline):** Takeoff 5.6 vs Paperclips 7.9. First 6 minutes competitive (first GPU 0:08, max idle stretch 8 s, greyed goal on screen 99.8 %); minutes 15–35 are the failure.

### Biggest gap (verbatim, actionable)
> Takeoff's Stage 1 ends with a 10–14 minute dead tail. In all four full traces the last stretch before the datacenter contains no new panel, button, project or modal (worst: 20:33→34:46, 852 s). The only greyed goal is "First Datacenter ($250,000, 18,000 research)"; research is walled ("next run needs 8,192 research. The lab holds 8,000."); Trust sits at 0 with "+1 Trust at: 377,000 → 987,000 tasks" so Hire/Expand are grey for 20 min; money counts up from ~$90k to $250k while the player presses Buy Power every ~6 s and re-buys the one repeatable (Custom model contract ×4) with no visible effect. Paperclips fills the equivalent window with a new project every 2–4 min. Fix: between Series A and the datacenter insert a ladder of 3–4 purchases a quarter of the price apart that each change a visible number ("Reserve the Abilene site $40k → Interconnect queue $80k → Substation $120k → Break ground"), raise the research cap once at the plateau so one more training run lands in the tail, and put a Trust milestone near 500k tasks. Target: no reveal gap over 180 s anywhere in Stage 1.

### Secondary gaps (priority order, all in the fix brief)
1. Power is a chore: 367 Buy Power presses in 35 min (Paperclips: 9 wire buys in 10 min). Scale block size with fleet, or make Grid Contract land by minute 5.
2. `Public Demand %` illegible (96 %→266 % while backlog grows). Show `Selling X/s of Y/s produced · backlog growing/selling out`; fix the "Demand saturated" line which prints even at 10 % demand.
3. Two disclosure spikes: at 2:34 Research+Projects arrive together (24→36 numbers); at 5:36 three unexplained Focus buttons. Stagger them; hide Focus until the second run.
4. Copy: milestone lines don't state the reward; idle rescue fires at 0 tasks and pays up to $19k; the transition **wipes the console** (`blackout()` in `state.ts`) and prints one unexplained line. Keep the last four lines; print 3 lines of consequence over ~6 s.
5. Transition is destructive without saying so: un-bought projects vanish, all three new Infrastructure buttons are unaffordable on arrival, tasks/sec jumps ×10 unexplained.

### Soft-locks found (report §4)
Power 0 disables the manual button with no inline reason; idle rescue has no "has played" gate; no price ceiling + wrong diagnosis line; research wall nag repeats without naming the fix (spend Trust on Expand Lab); releasing with open issues has no confirm and the later incident isn't attributed to the release; the research/training wall is carried into Stage 2 (cap 28,000, next run costs 33,554, Trust 0). Reload mid-training works correctly. Paperclips' classic wire-out is rescued within 5 s by "Beg for More Wire" — match that.

## Stage 1 fix brief (re-issue to an Opus 5.5 subagent)

Scope: repo `/workspace`, branch `cursor/asi-race-game-c688`, commit + `git push`, never touch `main`, no PR. Read README.md, `/tmp/critic/report-stage1.md` (all of it), `docs/design.md` §0/§3/§5.1/§7.5–7.6/§8/§13, `docs/stages.md` Stage 1, and skim `src/engine/{state,tick,economy,training,projects,events,stages}.ts`, `src/data/{projects,developments,choices,presets}.ts`, `src/ui/{render,dev}.ts`, `src/sim/{policy,bot}.ts`. Keep all existing element ids stable (critic scripts depend on them). Engine/data/sim stay DOM-free; randomness via rng.ts.

Required changes:
- **A. Dead tail:** site ladder `Reserve the Abilene site ($40k)` → `Interconnect queue ($80k, shows a countdown line "Interconnect: m:ss")` → `Substation ($120k + research, reveals a Power MW line)` → `Break ground` (the transition, priced so it lands 2–4 min after Substation). Each with a console line + a Developments entry. Raise research cap once in the tail so one more training run lands. +1 Trust per public release (and/or a milestone near 500k tasks) so Hire/Expand return. Make Custom model contract show a visible effect or remove it. Add to the sim summary: `LONGEST NOVELTY GAP` (time between consecutive REVEAL/PROJECT-shown/CHOICE/TRAIN/BUY events) and list gaps > 120 s.
- **B. Capability:** per-run gains to Capability +12–18 %, Efficiency +5 % (+copiesPerGPU ×1.25), Safety +5 % (+alignment +8 apparent/+5 true). Stage 1 must end at capability ≈ 1.5–1.8× (stays on Sage-1.x; Sage-2 at 2×, Sage-3 at 4×). Revenue growth comes from GPUs/copies, not capability. Re-tune costs so the transition stays 25–35 min.
- **C. Secondary gaps 1–5** exactly as listed above (power block scaling 1,000→10,000→100,000 kWh at 20/200 GPUs with proportional price; Grid Contract ≈ 2,000 research + $200 so it lands by minute 5–6; demand two-rate display + corrected diagnosis lines; stagger Research/Projects/Expand Lab/Focus reveals with tooltips; milestone copy states the reward; idle guard gated on `tasks>0 && revealed.business` and reward capped at `min(max(25, 10×rev/s), 10% of cheapest visible unaffordable cost)`; transition keeps last 4 console lines and prints 3 consequence lines over ~6 s; un-bought projects carry over or are explicitly retired; ≥1 Infrastructure button affordable on arrival).
- **D. Soft-locks:** inline `no power` reason next to the disabled button; "Ask the cloud provider for credit (1 Trust)" triggers at `power<1 && funds<powerPrice` even with Trust 0 (Trust may go negative, like UP); price> $1 raise button tooltip `nobody pays this`; incident lines attribute the release (`Traced to an issue shipped in Sage-1.2.`); on transition ensure research cap ≥ next training cost and Trust ≥ 2.
- **E. Verify:** `npm run build` clean; sim seeds 1–5 for 40 min: transition 25–35 min, longest novelty gap ≤ 180 s, ≤ 60 Buy Power presses, capability 1.5–1.8× at transition. Extend `/tmp/pw/verify.mjs` (Playwright already installed; server in tmux `takeoff-server`, serves live) and run it — zero console/page errors; screenshots to `/tmp/pw/shots2/`. Update README and `docs/stages.md` Stage 1 reveal order. Commit in logical chunks, push, leave the server running. Report: fixes mapped A–E, sim tables, screenshot paths, commit hashes.

## Then: critic round 2, then Stage 2

Re-launch a **fresh-context** critic (no access to `docs/design.md`, `docs/stages.md`, `docs/reference-analysis.md`, or this handoff — it may read README and source only to locate soft-locks). Same rubric: time to first meaningful choice; seconds with nothing to do; cognitive load & progressive disclosure; cadence of reveals (new panel/mechanic every N minutes); greyed-out goal always on screen (%); clarity of stage transition; soft-locks. It must name the single biggest gap specifically enough to act on, and play both games in Playwright (Takeoff via dev overlay, Paperclips via globals). Loop fix→critic until Takeoff wins Stage 1.

**Stage 2 build (Opus 5.5), per `docs/design.md` §5.2 and `docs/stages.md` Stage 2:** Infrastructure (datacenters `$250k×1.5^n`, +10,000 GPU capacity, 10 MW draw; GPU batches of 1,000; chip generations Nimbus G4→G5 with copiesPerGPU ×1.5), power as MW (gas +100, solar+storage +50, nuclear +500, Gulf site Al-Marsa +1 GW setting `gulfExposure`, 3-min interconnect queue, Behind-the-meter), Data (web crawl 15T finite, licensing, synthetic data, flywheel), allocation slider (tasks↔research, appears with "AI research assistants"; human research share displayed and decaying as `min(1, 3/capability)`), capability graph canvas (log × axis, AI-2027 reference lines, Sage solid / Anthrosoft dashed / Baiwen dotted), Government + Public panels (relations, approval, jobs displaced, free tier, job fund, defense contract), Security SL2/SL3, Stats panel (Dashboard project), distillation mini-release, Parallel Pipelines (train next while previous is in eval/red-team), developments for 2026 (China nationalizes Baiwen into the Lanzhou CDZ, junior-dev market collapse, Austin protest), choices (release publicly vs internal, Gulf site, defense contract), rival releases every 4–7 min, weights-theft *warning*. Remove `STAGE2_MIN_SECONDS` once real content gates the exit (capability ≥ 4×). Then the Stage 2 critic vs Paperclips Stage 2 (power management: factories/drones/farms; reach it via cheats).

**Stage 3:** neuralese vs transparent CoT, interpretability I–V (reveals true alignment at ≥3), old generations as monitors, value drift (`driftRate = autonomy^1.2 × 1e-4 × (1−trueAlign/100)`, shown like UP's probe losses; monitors recapture; deterministic zero at interpretability ≥4 + monitors ≥15 %), security SL4/SL5, geopolitics (Baiwen, Taiwan blockade, Iran strike on Al-Marsa if built), crises (weights theft, rogue copy/AI hacking, riots, nationalization ending), the memo choice, the Committee pivot **Slow down (Steward line) vs Race (Sage-5)**, Auto-train, The Pause ending. Exit: capability ≥ 25× AND the Committee choice made; business panel disappears ("The model runs the business now.").

**Stage 4:** Atlas robots, robot-built datacenters, SEZs, UBI (−10 % revenue, +approval), monitors at scale, Verify Baiwen, Concord treaty, crises (Ashford strain pandemic, nanobots, robots shut down all datacenters), nationalization-proofing. Endings branch on true alignment.

**Stage 5:** launch capacity, orbital datacenters, lunar solar, Dyson swarm, von Neumann probes; endings **Concord** (aligned prosperity), **Silence** (misaligned, humans vanish from the log, tasks keep rising), **The Project** (nationalized), **The Pause** (halt treaty) — each with the end-of-run stats screen (design.md §9). Then a full-run critic pass.

## Content sources already mined (do not re-fetch; raw text may be gone from /tmp)

- `docs/reference-analysis.md` (6,909 lines, committed): Part I UP source (all 96 projects, exact triggers/costs/effects, Fibonacci trust, creativity-only-at-cap, demand formula, reveal timeline, save/load), Part II ADR source (timers, craftables ladder, income chains, event system, notifications, CSS), Part III UP fandom wiki (197 pages; stages, strategy, 14 soft-lock table, 40 takeaways), Part IV Game Dev Story wiki (the train/release loop mapping, §7–8), Part V AI-2027 + Situational Awareness + Wait But Why + IABIED (44-row timeline, capability ladder, 60 log lines, 18 choices, 15 crises, naming rules), Part VI side-by-side synthesis answering the six design questions.
- `docs/design.md` (full spec) and `docs/stages.md` (UP-wiki-style stage plan). Where the shipped code differs from these docs, the code + this handoff win; update the docs when you change behaviour.
- Tone: console = Lantz (flat, present tense, 4–20 words, no exclamation marks; deadpan). Log = AI-2027 by way of A Dark Room (`Mon YYYY — one or two sentences.`, lowercase dread, the scariest lines are the calmest). Names: **OpenMind** (player), **Anthrosoft** (US rival, model line Cadence-N), **Baiwen** (China, nationalized into the **Lanzhou CDZ**), **Sage-N** / **Steward-N** / **Concord-1**, chips **Nimbus G4–G7** fabbed at **Formosa Fab**, **the Oversight Committee**, **the Project**, **Al-Marsa Compute Park**, pandemic **the Ashford strain**, robots **Atlas-class**.

## Environment notes

- Linux VM, Node 22, `tsc` 5.6, Python 3.12, Google Chrome at `/usr/local/bin/google-chrome`, Playwright + Chromium installed. 4 cores, ~4 GB free RAM: never run more than one headless browser at a time.
- tmux sessions (config `-f /exec-daemon/tmux.portal.conf`): `takeoff-server` (8731), `up-server` (8732), `adr-server` (8733), `paperclips-server` (8734, critic's own), `critic-runs`.
- Playwright verification script from Phase 1: `/tmp/pw/verify.mjs`; screenshots `/tmp/pw/shots/` (00 minute-0 through 08 mobile). All 89 checks passed with zero console errors at commit `50196b2`.
- `/tmp` artifacts (critic report, harness, reference clones, analysis raw text under `/tmp/analysis/`) are **not in git and live only on this VM**. The committed docs cover the research; the critic report does not — back it up into the repo if a new VM is likely.
