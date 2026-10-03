# tools/critic — playtest measurement harness

Plays Takeoff, Universal Paperclips and A Dark Room in headless Chrome with one scripted "curious
first-time player" and measures them with the definitions of `docs/critic-stage1-round1.md` §1
(the report of critic round 1, whose harness was lost). It measures; it does not judge.

All commands run from the repo root. Outputs go to `agent-tools/critic-out/<label>.*` (gitignored).

## Setup (once)

```sh
sh tools/critic/setup.sh            # clones the reference games into agent-tools/refs/ (idempotent)
(cd tools && npm install)           # only if tools/node_modules is missing (playwright-core)
```

Chrome is used through `chromium.launch({ channel: 'chrome', headless: true })`; no browser
download. Every run starts its own static servers on ephemeral ports (127.0.0.1:0) and stops them
on exit. Network access other than that server is blocked, so the runs are offline.

**Never point `--game-dir` at the repo root while someone is rebuilding it.** Freeze a build first:

```sh
mkdir -p agent-tools/snapshots/<name> && cp -R index.html styles.css dist agent-tools/snapshots/<name>/
```

## Running a stage comparison

```sh
# Takeoff build under test (Stage N start via __game.loadPreset(N); presets 1 and 2 are real today)
node tools/critic/run.mjs takeoff    tk-sN        --game-dir agent-tools/snapshots/<build> --stage N --realtime 300 --accel-minutes 60
node tools/critic/run.mjs takeoff    tk-sN-auto   --game-dir agent-tools/snapshots/<build> --stage N --realtime 0 --accel-minutes 60 --autoplay
# Reference (Stage 2/3 start from the cheated fixtures in tools/critic/fixtures/)
node tools/critic/run.mjs paperclips pc-sN        --stage N --realtime 300 --accel-minutes 60
node tools/critic/run.mjs paperclips pc-sN-accel  --stage N --realtime 0 --accel-minutes 120
node tools/critic/analyze.mjs tk-sN               # → agent-tools/critic-out/tk-sN.analysis.md (+ .json)
node tools/critic/analyze.mjs pc-sN
node tools/critic/compare.mjs tk-sN pc-sN tk-sN-auto
node tools/critic/transition.mjs takeoff    --game-dir agent-tools/snapshots/<build> --stage N
node tools/critic/transition.mjs paperclips                   # Stage 1→2 from fixture paperclips-s1-end
node tools/critic/softlock.mjs takeoff    --game-dir agent-tools/snapshots/<build>
node tools/critic/softlock.mjs paperclips
```

Round-1 baselines (Stage 1) were captured with:

```sh
node tools/critic/run.mjs takeoff takeoff-base          --game-dir agent-tools/snapshots/base --realtime 300 --accel-minutes 60
node tools/critic/run.mjs takeoff takeoff-base-autoplay --game-dir agent-tools/snapshots/base --realtime 0 --accel-minutes 60 --autoplay
node tools/critic/run.mjs paperclips pc-s1              --realtime 300 --accel-minutes 60
node tools/critic/run.mjs paperclips pc-s1-accel        --realtime 0 --accel-minutes 120
node tools/critic/run.mjs adr adr-5min                  --realtime 300
```

Run only one real-time run at a time (phase 1 is timing-sensitive); stepped runs are not.

## run.mjs

`node tools/critic/run.mjs <takeoff|paperclips|adr> <label|path-prefix> [flags]`

| flag | meaning |
|---|---|
| `--game-dir DIR` | directory to serve (required for Takeoff; Paperclips/ADR default to `agent-tools/refs/…`) |
| `--realtime SEC` | phase 1: SEC seconds of real wall-clock play |
| `--accel-minutes MIN` | phase 2 cap: stepped until the stage ends or MIN minutes of **total** game time (phase 1 included, as in the old harness) |
| `--autoplay` | Takeoff only: the game's own bot (`__game.setAutoplay(true)`) instead of the scripted player |
| `--stage N` | start of Stage N: Takeoff `__game.loadPreset(N)`; Paperclips fixture `paperclips-stageN` (N = 2, 3) |
| `--seed N` | default 1. Seeds `Math.random` (mulberry32) in every page; Takeoff's new game uses `newGame(N)` |
| `--fixture NAME` | start from `tools/critic/fixtures/NAME.json` (localStorage save) |
| `--post-stage SEC` | keep playing SEC (default 30) after the stage ends, for the transition capture |

Phase 1 runs the game on its own clock. Phase 2 steps 2 s of game time at a time: Takeoff with
`__game.tick(ms)` (its rAF loop is held/`setSpeed(0)`), Paperclips and ADR through a virtual clock
installed at page init (`lib/initscript.mjs`: `setTimeout/setInterval/requestAnimationFrame/Date/
performance.now` behind `window.__advance(ms)`; a page-side pump makes it follow the wall clock
during phase 1). The games' code is never modified.

Each 2 s of game time: snapshot → policy pass → advance (the main button is clicked every 250 ms
while mashing). Outputs per run:

| file | content |
|---|---|
| `<p>.snaps.json` | `{meta, snaps}`; snapshot = buttons `{k key, l label, e enabled, kind button/project/modal/tab, a ambient}`, sliders, panels `{k, l}`, newest console line, newest log entry, modal `{title, options}`, `numbers` (numeric tokens on screen), `milestone` (`#nextTrust` visible), `m` (game metrics from the adapter) |
| `<p>.events.json` | `reveal` (first time visible), `enabled`, `hidden`, `console`/`log` lines (`novel` = text not seen before), `modal`, `stage`, `stage-end`, `transition-samples` (250-ms console/panel samples for 2 s after a stage change) |
| `<p>.actions.json` | every policy click `{t, key, label, why, detail}`; mash clicks aggregated per 2-s window (`why: 'mash', count`) |
| `<p>.summary.md` | run metadata and counts |
| `<p>.t<min>.png` | screenshots at minutes 0, 1, 3, 5, 10, 20; `.tpre.png` just before the policy buys a stage gate, `.tend.png` at the stage change, `.transition.png` 4 s later |
| `<p>.transition.txt` | console lines, vanished/appeared elements, projects gone un-bought, buttons on arrival, numbers before/after |

## analyze.mjs, compare.mjs

`node tools/critic/analyze.mjs <label>` prints and writes `<label>.analysis.md` and `.analysis.json`:
time to first automation; first-meaningful-choice candidates; nothing-to-do (loose) for the first
5 minutes and the stage; novelty and reveal gaps (every gap > 120 s, the longest); reveal timeline;
greyed-out-goal coverage; cognitive load at minutes 0/1/3/5/10/20/end and the five largest
single-beat disclosure spikes; action counts (+ game counters for Autoplay runs); panel and project
cadence. Analysis windows end at the stage change. `compare.mjs A B […]` writes one side-by-side table.

## Probes

* `transition.mjs <game> [--stage N] [--fixture NAME]` — plays (stepped) until the stage changes and
  writes `transition-<game>.md` plus `.tpre/.tend/.transition.png`.
* `softlock.mjs <game> [--scenario NAME]` — the §4 dead-end probes as named scenarios, each from a
  new game in stepped mode; writes `softlock-<game>.md` and `softlock-<game>-<scenario>.png`.
  Takeoff: `power-zero`, `idle-new-game`, `price-200x`, `ignore-research-15min`,
  `release-open-issues`, `reload-mid-training`. Paperclips: `wire-out-low-price`, `absurd-price`,
  `reload`, `idle`. A scenario whose preconditions no longer hold reports
  `scenario no longer applicable: <reason>` instead of failing.
* `determinism.mjs <game> [run flags]` — runs the same stepped run twice and diffs events, actions
  and snapshots (`DETERMINISTIC` or the first difference).
* `make-fixtures.mjs` — rebuilds `fixtures/paperclips-stage2.json` (just after "Release the
  HypnoDrones"), `paperclips-stage3.json` (just after "Space Exploration") and
  `paperclips-s1-end.json` (HypnoDrones bought, Trust 99, ~15 s before the Release is affordable).
  The cheats (`games/paperclips.mjs`) set round resource values (processors 30, memory 70, clips
  1.2 billion, …; Stage 3: memory 125, 6 octillion clips, 10 M MW-s) and buy the gating projects
  through their own buttons so the game's transition code runs.

## Definitions and implementation choices

The report's §1 definitions are applied verbatim (see the header of `lib/analysis.mjs`). Where §1
left something open, the harness does this:

* **Visible** = `checkVisibility({visibilityProperty})` (ADR also: opacity, and clipping by an
  `overflow:hidden` ancestor, because its locations slide off-screen inside a clipped frame).
* **Panel** = a visible container whose *first* element child is a `<b>`/`<h2>` title and that
  contains an `<hr>` or a control (button/select/input). This keeps nested titled sections
  (Paperclips' Quantum Computing, Investments) and excludes inline titled cards (Takeoff's evaluator
  cards). ADR panels are its `[data-legend]` boxes.
* **Numbers on screen** = numeric tokens (`1,234.5`, `.25`, `2025`) in visible text nodes,
  excluding Takeoff's `#dev`/`#toast` and Paperclips' debug/save buttons. **Minute 0** of the
  cognitive-load table is sampled at t = 0:02 (first snapshot after the first input).
* **Policy** (`lib/policy.mjs`; game knowledge in `games/*.mjs`): mash the main button at 4/s
  until automation makes ≥ 8 units/s (Stage 1 starts only); buy the first automation when
  affordable; answer a modal with its first enabled option; consumable (power/wire) bought when
  below half of one purchase (≤ 3 per check) and, while visible, one purchase of it always kept in
  reserve; price lowered when the backlog > 30 s of production and growing, raised after 4
  consecutive checks with backlog ≤ max(5, 1 s of production), 8 s cool-down; then one sweep over
  every other visible enabled non-ambient button (each clicked at most once per check, least-bought
  first); once a big-ticket goal is visible (Takeoff: First Datacenter) GPU/marketing and any other
  funds purchase stop until it is bought. Takeoff: red-team until 0 open issues, then release.
  Paperclips: Memory (never Processors) while the cheapest visible project costs more ops than the
  cap, otherwise Trust goes through the generic loop; tournaments
  only with ops at the cap; toggles and "Disassemble All" never clicked. ADR: when nothing in view
  is clickable, visit the next location tab. A click that changes nothing is not retried for 30 s
  (ADR's "not enough wood").
* **Stage end**: Takeoff `state.stage` increases or `state.ending` is set; Paperclips Stage 1 ends
  when `humanFlag` drops to 0 (Release the HypnoDrones), Stage 2 when `spaceFlag` becomes 1.

## Layout

```
run.mjs analyze.mjs compare.mjs transition.mjs softlock.mjs determinism.mjs make-fixtures.mjs setup.sh
lib/   server.mjs (static server) · initscript.mjs (virtual clock, seeded PRNG, Takeoff boot seed)
       pagelib.mjs (in-page snapshot/controls/click) · session.mjs (browser + clock control)
       policy.mjs · recorder.mjs (events) · runner.mjs (phases, outputs) · analysis.mjs
       transition-report.mjs · probe.mjs (softlock kit) · util.mjs
games/ takeoff.mjs · paperclips.mjs · adr.mjs   (selectors, ambient set, metrics, policy hooks, cheats)
fixtures/ paperclips-stage2.json · paperclips-stage3.json · paperclips-s1-end.json
```

## Known limits

* A Dark Room is fully steppable through the virtual clock (deterministic); it has no stage-end
  detector, no automation in its first minutes (nothing-to-do condition 1 never holds) and its
  first event ("Sound Available!") is answered like any modal.
* Paperclips Stage 2/3 starts load and play, but the policy is a Stage 1 policy: in Stage 2 it
  spends unused clips on drones/farms/batteries as soon as affordable and never saves for the first
  100-million-clip Clip Factory (30 stepped minutes: 7 harvester + 4 wire drones, 0 factories); in
  Stage 3 probe-design arrows are ambient, so probes are launched but never given trust. Treat
  `--stage 2/3` Paperclips runs as verified start points until the policy learns to save in clips.
* Takeoff's Autoplay bot answers a modal inside the tick that opens it, so 2-s snapshots of an
  `--autoplay` run show no modals; the analysis's game counters (`choices`) still count them.
* "Nothing-to-do (loose)" depends strongly on spending rules: an affordable purchase the policy
  holds back (one consumable purchase in reserve) counts as "something to do". Compare it only
  between runs of this harness.
* Real-time (phase 1) runs are not reproducible by design; only stepped runs are.
