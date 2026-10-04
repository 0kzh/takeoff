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
node tools/critic/softlock.mjs takeoff    --game-dir agent-tools/snapshots/<build> [--stage N]
node tools/critic/softlock.mjs paperclips
```

Takeoff Stage 2 baselines (build `s2-r1`, seeds 1–3, stepped):

```sh
node tools/critic/run.mjs takeoff tk-s2-seedN --game-dir agent-tools/snapshots/s2-r1 --stage 2 --realtime 0 --accel-minutes 70 --seed N   # N = 1, 2, 3
node tools/critic/run.mjs takeoff tk-s2-auto  --game-dir agent-tools/snapshots/s2-r1 --stage 2 --realtime 0 --accel-minutes 70 --autoplay
node tools/critic/explore.mjs baseline,modal-last,modal-ignore,toggles --game-dir agent-tools/snapshots/s2-r1 --stage 2 --minutes 90
node tools/critic/transition.mjs takeoff --game-dir agent-tools/snapshots/s2-r1 --stage 2      # → transition-takeoff-s2.md
node tools/critic/softlock.mjs takeoff   --game-dir agent-tools/snapshots/s2-r1 --stage 2      # → softlock-takeoff-s2.md
node tools/critic/decisions.mjs tk-s2-seed1 tk-s2-seed2 tk-s2-seed3
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
greyed-out-goal coverage; cognitive load at minutes 0/1/3/5/10/20/30/end (30 added for longer
stages; '—' when the stage ends earlier) and the five largest
single-beat disclosure spikes; action counts (+ game counters for Autoplay runs); panel and project
cadence. Analysis windows run from the stage start to the stage change; for a run that starts at
Stage N (`--stage N`) t = 0 is that stage's start. `analyze.mjs <label> --stage M` analyses a later
stage reached inside a run (window from its first snapshot, times re-based; writes
`<label>.sM.analysis.md`). `compare.mjs A B […]` writes one side-by-side table (`label:M` for a later
stage of a run).

## Probes

* `transition.mjs <game> [--stage N] [--fixture NAME]` — plays (stepped) until the stage changes and
  writes `transition-<game>.md` plus `.tpre/.tend/.transition.png`.
* `softlock.mjs <game> [--scenario NAME] [--stage N]` — the §4 dead-end probes as named scenarios,
  each from a new game (or the start of Stage N) in stepped mode; writes `softlock-<game>[-sN].md`
  and `softlock-<game>[-sN]-<scenario>.png`. Takeoff: `power-zero`, `idle-new-game`, `price-200x`
  (these three are Stage 1 situations and report "not applicable" under `--stage 2`),
  `ignore-research-15min` (from Stage 2 it also reports the Train button's state and when the lab cap
  first greyed it), `release-open-issues` (from Stage 2 the player keeps training and building while
  it waits for an evaluation with open issues), `reload-mid-training`. Paperclips:
  `wire-out-low-price`, `absurd-price`, `reload`, `idle`. A scenario whose preconditions no longer
  hold reports `scenario no longer applicable: <reason>` instead of failing.
* `determinism.mjs <game> [run flags]` — runs the same stepped run twice and diffs events, actions
  and snapshots (`DETERMINISTIC` or the first difference).
* `make-fixtures.mjs` — rebuilds `fixtures/paperclips-stage2.json` (just after "Release the
  HypnoDrones"; cheated: round resource values — processors 30, memory 70, clips 1.2 billion, funds
  $1,000 so the game's milestone chain runs (it starts at "funds ≥ $5" and ends Stage 3 with
  "Universal Paperclips achieved") — and the gating projects bought through their own buttons so the
  game's transition code runs),
  `paperclips-stage3.json` (just after "Space Exploration"; **played**: the scripted first-timer
  plays Stage 2 from `paperclips-stage2` in stepped mode and the save is taken the moment it buys
  Space Exploration, 135:46 with seed 1; a cheat is the fallback if that takes over 180 min) and
  `paperclips-s1-end.json` (cheated: HypnoDrones bought, Trust 99, ~15 s before the Release is
  affordable). Rebuild the Stage 3 fixture after changing the Stage 2 rules.

## Round-2 additions (ported from the round-2 critic's `tools/critic-r2/`)

* `explore.mjs <name[,name…]|list|all-runs|all-probes|all-paperclips> --game-dir DIR [--seed N]
  [--minutes MIN] [--stage N] [--tag T]` — "a player who does the unexpected". **Runs** play a
  whole stage with a modified first-timer policy (`greedy`, `no-price`, `price-up`, `no-research`,
  `hire-only`, `expand-only`, `ship-open`, `modal-last`, `modal-ignore`, `modal-worst`,
  `modal-best`, `no-train`, `click-only`, `no-projects`, `mobile` (390 × 844), `focus-efficiency`,
  `focus-safety`, `no-marketing`, `no-redteam-wait`, `no-contracts`, `no-side-projects`,
  `toggles` (every setting pressed once at first sight, each slider set to its minimum at first
  sight and its maximum 10 minutes later), `baseline`) and write a normal run `<tag>-<name>.*` (so `analyze.mjs`, `compare.mjs` and
  `decisions.mjs` work on it) plus `<tag>-<name>.explore.md` (one metrics row per minute, every
  modal with body text / timer / option tooltips, on-screen notes each time they change, every
  console and log line), `.modals.json` and `.modal<N>.png`. **Probes** are short scripted
  situations writing `<tag>-<name>.md` and screenshots: `reload-mid-modal`, `reload-mid-countdown`,
  `reload-mid-transition`, `reload-mid-redteam`, `idle-10min-new`, `idle-mid`,
  `price-200x-at-start`, `price-floor`, `modal-click-through` (real mouse and keyboard),
  `modal-hover`, `grid-off-broke`, `wall-flag`, `contracts-vs-price`, `tour` (screens at each first
  meeting, full text of every project card, clipped cards), `mobile-shots`. **Paperclips**
  reference runs: `pc-no-price`, `pc-proc-only`, `pc-mobile`. `--stage N` starts every run or probe
  at Stage N (Takeoff preset, Paperclips fixture; labels get `-sN`); the probes were written for
  Takeoff Stage 1 and say what they cannot find on other stages. `--tag` sets the label prefix
  (default `x`; round 2 used `r2x`).
* `decisions.mjs <label[:N]…> [--stage N]` — gaps between non-drip decisions, and reveal → purchase
  latency of projects, for any run; `:N`/`--stage N` takes Stage N of a run, timed from its start.
  From Stage 2 on, repeat purchases count as drip too — Paperclips' drones, farms, batteries, probe
  launches and Processors/Memory bought with swarm gifts; Takeoff's GPU lots, plants and
  datacenters (policy tag `infra`); Stage 1 numbers are unchanged.
* Library hooks: `adapter.policy.modalChoice(modal, enabledOptions, t)` in `lib/policy.mjs`
  (default unchanged: first enabled option; return `null` to leave the modal open);
  `runGame({ adapter, viewport })` in `lib/runner.mjs` (a pre-built adapter instead of the one
  loaded by name; viewport passed to the session); `openProbe(adapter, { viewport })` in
  `lib/probe.mjs`.
* Fixes asked for by the round-2 critic: `determinism.mjs --out LABEL` (writes `LABEL-a/-b` instead
  of overwriting `det-<game>-a/-b`), and the `release-open-issues` soft-lock scenario reports the
  game's own confirmation modal (title, options, the option that releases) as well as browser
  dialogs, and confirms through it.

## Stage 2 round-1 additions (the Stage 2 critic's `explore-s2.mjs`)

`explore.mjs` is unchanged (its runs and probes were written for Stage 1). Stage 2's own systems
are probed by a second script with the same libraries and output layout:

* `explore-s2.mjs <name[,name…]|list|all-runs|all-probes|all-paperclips|table> --game-dir DIR
  [--seed N | --seeds 1,2,3] [--minutes MIN] [--tag T] [--shots 600,1200] [--modal-shots]` — every
  run and probe starts at Takeoff's Stage 2 preset; labels are `<tag>-<name>[-seedN]` (tag default
  `s2x`).
  * **Runs** play the whole stage with the first-timer's Stage 2 rules and ONE thing changed:
    `baseline`, `mobile` (390 × 844), `no-power`, `no-datacenter`, `power-only`, `no-standing`,
    `slider-min`, `slider-max`, `no-assistants`, `no-research`, `hire-only`, `expand-only`,
    `data-ignore` (buys the Web crawl, then no other data source), `no-data`, `keep-internal`,
    `ship-open`, `no-train`, `focus-efficiency`, `focus-safety`, `modal-ignore`, `modal-timed-only`
    (timed events expire, untimed ones are answered), `modal-last`, `modal-worst` / `modal-best` (by
    a per-title table of the reckless / careful option; an unknown event falls back to a score of
    the printed effect line and is listed in the report), `modal-gov` / `modal-approval` /
    `modal-lead` (the option that prints the largest gain of that meter), `settings-off` (every
    ON/AUTO setting switched off whenever seen, slider to its minimum; the backlog rule then moves
    the price), `auto-off` (AUTO off, price never touched), `settings-on`, `share-evals`,
    `job-fund`, `align-max`, `no-security`. Each writes a normal run plus `.explore.md` (a row per
    minute with the meters on screen and in the state, model releases, how long each greyed-button
    reason stood, what the training pipeline was doing or waiting for at each 2-s check, every event
    with its printed effect lines, every card's full text at first sight, every line), `.end.json`
    (the last Stage 2 screen: meters, greyed and enabled buttons, console), `.modals.json`,
    `.cards.json`, `.end.png` / `.cap.png`.
  * `table [--tag T] [name,…]` prints the play-style table (stage end and end-of-stage meters per
    seed) from the `.end.json` files and writes `<tag>-table.md`.
  * **Probes** (each writes `<tag>-<name>.md` and screenshots): `idle-start`, `idle-mid`,
    `idle-rescue` (the event that opens for an idle player), `reload-mid-run` (also mid-training and
    mid-evaluation; compares the whole serialized state before and after), `reload-mid-queue`,
    `reload-mid-event` (untimed and timed), `slider-ends`, `mobile-shots`, `event-keys` (real mouse
    behind the event panel, Tab, Escape), `untimed-open` (an untimed event left open for 20
    minutes), `exit` (the gate card held ready for 30 s, then clicked: what the click changes, the
    narration, the screen 4 s and 30 s later), `hover` (Stores-row breakdowns and every tooltip),
    `auto-off-raise`.
  * **Paperclips Stage 2 probes** (fixture `paperclips-stage2`): `pc-all-in-drones`, `pc-no-power`,
    `pc-disassemble-all`, `pc-idle`, `pc-reload`, `pc-slider`, `pc-mobile`, `pc-words` (numbers,
    controls, panels and words on screen at the five-minute marks). `pc-stage [--yomi N]` replays
    the stage with the scripted player, optionally arriving with yomi (the fixture has 0).
* `games/paperclips-late.mjs` reads three optional environment variables that give reference
  variants of the Stage 2 player for the fairness check; unset, the rules are exactly as described
  below: `PC_TRIVIAL_SHARE` (default 0.1: the share of the clips a bulk purchase may cost),
  `PC_FACTORY_HORIZON` (default 120 s; `Infinity` = drones always wait for a factory while wire
  piles up), `PC_THINK_VALUE` (default 100: the slider position while memory is the wall; 200 = all
  Think).

## Stage 2 round-2 additions (the Stage 2 round-2 critic's `explore-s2r2.mjs`)

Written against build `s12-r4` (three GPU-lot rows, a Standing-order share, plants and halls that
can be built ahead, a hard GPU requirement on Train, Unicode meters, reservations printed on the
lot rows). `explore-s2.mjs`, `explore.mjs` and every shared file are unchanged; the shipped
first-timer (`games/takeoff-late.mjs`) still runs on this build but reads only "No power for them…"
/ "No room for them…" on the main lot row, so it waits at "the plant first" / "the hall first"
beside a lit plant (it is kept as the play style `shipped`).

* `explore-s2r2.mjs <name[,name…]|all-runs|all-probes|hands|table|list> --game-dir DIR [--seed N |
  --seeds 1,2,3] [--minutes MIN] [--tag T] [--realtime SEC] [--label L] [--shots 600,1200]
  [--modal-shots]` — every run and probe starts at Takeoff's Stage 2 preset; labels are
  `<tag>-<name>[-seedN]` (tag default `s2r2-x`; `--label` names one run outright, e.g. the rubric's
  real-time run).
  * **The round-2 first-timer** (`baseline`, the control): the README's Stage 2 rules with two
    adjustments. (1) Infrastructure follows the reason on the main lot row in its new wordings:
    "No power for them…" or "the plant first" → the enabled power source with the lowest shown
    $/MW; "No room for them…" or "the hall first" → Build Datacenter; "the run first", "<card>
    first", "the offer first" → nothing to press. (2) All three lot rows belong to the
    infrastructure rule (largest enabled row first, the main row's shrunken lots included, up to
    three purchases a check); none is left to the sweep. Train is pressed the moment it is enabled;
    settings are left alone (Standing order 50%, slider 15%).
  * **Runs** (the control with ONE thing changed): `shipped` (the harness's first-timer as shipped),
    `any-row` (obeys the reason on any lot row), `mobile`, `bot` (the game's Autoplay under this
    file's screen reader), `lot-smallest`, `lot-largest`, `lot-full` (never a shrunken lot),
    `lot-one`, `order-only[-25|-75|-100|-mainrow]` (no lot by hand once the Standing order is on
    screen, at each share), `no-lots`, `no-standing`, `so-off|-25|-75|-100` (the share changed, lots
    still bought by hand), `no-power`, `no-datacenter`, `power-only`, `overbuild`,
    `overbuild-halls`, `overbuild-plants`, `wall-only` (ignores "… first", builds at the hard
    wall), `slider-min`, `slider-max`, `no-assistants`, `no-trust`, `hire-only`, `expand-only`,
    `data-ignore`, `no-data`, `run-saver`, `cards-wait`, `run-first` (the disciplined player),
    `gate-only` (the minimalist), `train-late60`, `train-wait60`, `keep-internal`, `ship-open`,
    `no-train`, `focus-efficiency`, `focus-safety`, `modal-ignore`, `modal-last`, `modal-worst`,
    `modal-best`, `settings-on`. Each writes a normal run plus `.explore.md` (hands; a row per
    minute with the meters as drawn; seconds the main lot row spent in each state; **Train under the
    hard gate**: seconds, stretches and the longest stretch per cause — GPUs, GPUs dark, money,
    research, data — with whether a lot, a plant, a hall or a data card was enabled meanwhile; what
    each run asked for against the fleet, and revenue 20 s and 60 s into it; GPUs that are not
    running and what the power row said; events with their effect lines; every card; every note and
    line) and `.end.json`.
  * `hands <label…> [--from SEC]` — round 1's hands measures for any stored run of either game
    (share of 2-s checks with nothing enabled / with two or more distinct things enabled, clicks per
    minute, share of the window inside ≥ 30-s click gaps; bulk sizes of one item count once). It
    reproduces round 1's numbers on round 1's runs (`s2x-baseline`: 85–88 % / 5–7 % / 50–55 %;
    `pc-s2`: 0.6 % / 97.1 % / 27.7 %, 19.5 clicks a minute). `table` prints the play-style table.
  * **Probes**: `lot-return` (twin sessions: does the return printed on a lot row happen),
    `gate-screens` (the Train row when GPUs are short), `dark-gpus` (every power-cutting event
    fired from the dev list), `governor` (every state of the main lot row with its screen),
    `reserve-refused`, `standing-cycle`, `standing-rates`, `reload-mid-build` (hall under
    construction, plant in the queue), `reload-mid-run` (also training, evaluation, red-team),
    `reload-mid-event`, `idle-start`, `idle-mid`, `idle-events` (30 idle minutes), `event-keys`,
    `exit`, `hover`, `slider-ends`, `mobile-shots`, `screens` (the text of every panel at the
    five-minute marks).

## Definitions and implementation choices

The report's §1 definitions are applied verbatim (see the header of `lib/analysis.mjs`). Where §1
left something open, the harness does this:

* **Big-ticket goals** (Takeoff Stage 1). §1 says the first-timer stops the GPU/marketing drip and saves once a
  big-ticket goal is visible, and round 1 named that goal by id (First Datacenter). The adapter keeps the
  id as the stage gate and adds a rule (`policy.goalRule`) so later builds need no edit: any visible
  project priced in funds at ≥ $10,000 and ≥ 60 s of current revenue is a goal. Without it the policy
  keeps renting GPUs at any price and never saves for a funds-priced ladder. While a goal is visible only
  the `drip` set (GPUs, marketing) is held back, as §1 words it; training runs and one-off projects are
  still bought when affordable, keeping the one-purchase consumable reserve. Not used from Stage 2 on
  (see Takeoff Stage 2).

* **Visible** = `checkVisibility({visibilityProperty})` (ADR also: opacity, and clipping by an
  `overflow:hidden` ancestor, because its locations slide off-screen inside a clipped frame).
* **Panel** = a visible container whose *first* element child is a `<b>`/`<h2>` title and that
  contains an `<hr>` or a control (button/select/input). This keeps nested titled sections
  (Paperclips' Quantum Computing, Investments) and excludes inline titled cards (Takeoff's evaluator
  cards). ADR panels are its `[data-legend]` boxes.
* **Reveal timing**: an element is revealed at the first 2-s snapshot that shows it. Paperclips' clock
  keeps running while the player clicks (one 10-ms game tick per click), so a project can appear and
  be bought inside one check; an element the player clicks before any snapshot showed it is recorded
  as revealed at that check (`viaClick: true` in the event).
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
  first; settings are never pressed by this sweep, see below); while a big-ticket goal is visible
  (Takeoff Stage 1: funds-priced projects, see above) the drip
  (GPU/marketing) is held back until it is bought; a purchase that changes the stage ends the check
  (the new screen is read at the next one). Takeoff: red-team until 0 open issues, then release.
  Paperclips: Memory (never Processors) while the cheapest visible project costs more ops than the
  cap, otherwise Trust goes through the generic loop; tournaments
  only with ops at the cap; toggles and "Disassemble All" never clicked. ADR: when nothing in view
  is clickable, visit the next location tab. A click that changes nothing is not retried for 30 s
  (ADR's "not enough wood").
* **Paperclips Stage 2 (Earth)** — rules used only from Stage 2 on (`games/paperclips-late.mjs`).
  Every input is a number or word on screen (Manufacturing, Wire Production, Power, Swarm
  Computing, Strategic Modeling, Projects); every action is a click on a visible button or a change
  of a visible control.
  * *Ops.* A visible project priced in ops within the cap (Photonic Chips aside) comes first: no
    tournament starts and AutoTourney is switched off while it waits. Otherwise the player works
    toward the visible project priced in yomi or creativity that is closest to affordable (an
    untried tournament, 0 yomi, goes first): for yomi, a tournament whenever New Tournament is
    enabled and AutoTourney on; for creativity, ops left idle at the cap (creativity only grows
    there) and AutoTourney off. With neither, a tournament only with ops at the cap. Photonic Chips
    (a repeatable ops sink) wait while any of these is pending.
  * *Strategy picker* set to the strategy on top of the last results table ("1. NAME: score"), or
    the newest strategy before any result; the panel itself says "Pick strategy, run tournament,
    gain yomi" (left at "Pick a Strat", tournaments pay no yomi).
  * *Memory and slider.* Swarm gifts go through the Stage 1 Memory rule. The work/think slider is
    set to 100 (half think, so gifts arrive) while a visible project costs more ops than the cap,
    and back to 0 (all work) otherwise.
  * *Power first.* Consumption above production → solar farms (+10/+100 sized to the deficit);
    farms are added for a purchase's draw (drone 1 MW, factory 200 MW, as the Power box shows)
    before the purchase.
  * *First factory.* Until one Clip Factory exists only one farm, one harvester and one wire drone
    are bought and the rest of the clips are saved; the factory is a goal (`goalRule`) and is bought
    first once affordable.
  * *The chain*, from the stocks on screen against the previous check: wire stock rising two checks
    in a row → a factory (and drones pause if that factory is affordable within ~2 minutes of the
    clip income shown); acquired matter rising → wire drones; otherwise, while Earth matter is left,
    harvesters. Harvesters and wire drones are kept within 1.4× of each other (the game
    disorganizes the swarm past 1.5×).
  * *Bulk buttons:* the largest of ×1000/×100/×10 whose size × the shown unit price is ≤ 10% of the
    unused clips (else a single).
  * *Storage:* a battery block when storage is full while production exceeds consumption and it
    costs ≤ 1% of the clips. Once Space Exploration is on screen (Earth's matter is gone) only
    batteries toward its 10,000,000 MW-seconds and farms for a surplus that fills them in about two
    minutes are bought; Space Exploration is a goal.
  * *Projects:* every affordable project through the generic loop (Momentum, drone flocking, Swarm
    Computing, factory upgrades …); "Entertain/Synchronize the Swarm" when shown and affordable.
* **Paperclips Stage 3 (space)** — same ops/strategy/memory/slider rules, plus:
  * *Trust:* "Increase Probe Trust" (yomi) and "Increase Max Trust" (honor) whenever affordable.
  * *Probe design:* the trust shown is split by largest remainder over weights Haz 3, Rep 3, Speed 1,
    Nav 1; once ≥ 100 probes exist or found matter is on screen, also Fac 1, Harv 1, Wire 1; once
    drifters appear or probes are lost in combat, also Combat 2 (ties in the order Haz, Rep, Speed,
    Nav, Wire, Harv, Fac, Combat). The arrows are clicked to match (lower first, then raise).
  * *Launch Probe* once per check, except while probes have died to hazards and the design still has
    no Haz or no Rep.
* **Settings are not purchases** (all games). `lib/pagelib.mjs` marks a visible button as a setting
  (`t: 1`, ambient) when it is a toggle (class `toggle` or an `aria-pressed` attribute), is labelled
  ON/OFF or AUTO…, or reads "Name: value" with a short value ("Alignment compute: 1%"); the sweep
  never presses one. It also records a greyed button's inline reason (`why`, from a
  `<span class="reason">` in the same row). Paperclips' toggles are switched only by its own rules.
* **Takeoff Stage 2 (Abilene)** — rules used only from Stage 2 on (`games/takeoff-late.mjs`).
  Inputs are labels, the reasons printed next to greyed buttons, and numbers on screen.
  * *Defaults are left alone.* A first-timer does not switch a newly offered setting: AUTO pricing
    stays on (on at arrival), the Standing order stays on (switched on when its project is bought),
    Share evals and the Job-transition fund stay off, alignment compute stays at 1%, and the copies
    slider is never dragged. While a setting labelled AUTO (not "off") is on screen, lower/raise are
    not touched (`policy.priceHold`); the Stage 1 backlog rule would apply if AUTO were off.
    (`explore.mjs toggles` is the player who presses all of them.)
  * *Train first:* Train is pressed whenever it is enabled, before anything else is bought. Then
    red-team until 0 open issues and Release; "Keep internal" is never pressed (the release modal is
    answered like any other: first enabled option, "release publicly").
  * *Infrastructure follows the GPU lot's reason:* lot enabled → buy a lot; "no power" → the power
    source (a button labelled "(+N MW)") with the lowest shown $ per MW; "no room" → a datacenter;
    "standing order" (the order buys the lots) → room or power, whichever the Stores panel shows
    nearer full ("GPUs X / Y" against "power A / B MW"). Up to three such purchases per check; plants
    and datacenters are bought by this rule only (never by the sweep), and the game greys the ones it
    calls "power to spare" / "room to spare".
  * *Modals:* first enabled option (`policy.modalChoice` overrides it). *Projects and the rest:*
    whatever is affordable, through the sweep (projects, Hire Researcher/Expand Lab with Trust,
    Marketing, Security level 3).
  * *No big-ticket saving from Stage 2 on* (`goalRule` returns nothing). Checked, not assumed: on
    `s2-r1`, seeds 1–3, with the Stage 1 rule the stage ended at the same times (41:26 / 38:30 / 38:38)
    with the same 9 runs, 24 GPU lots and 33–34 projects as without it; the rule held back only
    Marketing (1 press instead of 1–2) and moved a few plants/datacenters, so nothing that gates
    progress starves without it.
  * Ids used: `btn-gpuBatch` (GPU lot), `btn-datacenter`, `btn-train`, `btn-redteam`, `btn-release`,
    `btn-releaseInternal` (never pressed); plants by their "(+N MW)" label, AUTO by its label; the
    Stores numbers from `#infraGpus`, `#gpuCapacity`, `#powerMW`, `#powerCapMW` (adapter metrics).
* **Stage end**: Takeoff `state.stage` increases or `state.ending` is set; Paperclips Stage 1 ends
  when `humanFlag` drops to 0 (Release the HypnoDrones), Stage 2 when `spaceFlag` becomes 1 (Space
  Exploration), Stage 3 at "Universal Paperclips achieved" (milestone 15, the Emperor of Drift
  messages that open the endgame).

## Layout

```
run.mjs analyze.mjs compare.mjs transition.mjs softlock.mjs determinism.mjs make-fixtures.mjs setup.sh
explore.mjs decisions.mjs   (round-2 additions)
explore-s2.mjs              (Stage 2 round-1 addition: Stage 2 play styles, probes, Paperclips Stage 2 probes)
explore-s2r2.mjs            (Stage 2 round-2 addition: build s12-r4's first-timer, play styles, hands, Train-gate account, probes)
lib/   server.mjs (static server) · initscript.mjs (virtual clock, seeded PRNG, Takeoff boot seed)
       pagelib.mjs (in-page snapshot/controls/click) · session.mjs (browser + clock control)
       policy.mjs · recorder.mjs (events) · runner.mjs (phases, outputs) · analysis.mjs
       transition-report.mjs · probe.mjs (softlock kit) · util.mjs
games/ takeoff.mjs · paperclips.mjs · adr.mjs   (selectors, ambient set, metrics, policy hooks, cheats)
       takeoff-late.mjs (Takeoff Stage 2+ play rules) · paperclips-late.mjs (Paperclips Stage 2/3 play rules)
fixtures/ paperclips-stage2.json · paperclips-stage3.json · paperclips-s1-end.json
```

## Known limits

* A Dark Room is fully steppable through the virtual clock (deterministic); it has no stage-end
  detector, no automation in its first minutes (nothing-to-do condition 1 never holds) and its
  first event ("Sound Available!") is answered like any modal.
* Paperclips endgame: right after "Universal Paperclips achieved" (the end of Stage 3) the generic
  loop clicks the free Emperor of Drift messages, Accept and "The Universe Next Door" within one
  check; the game then resets into a new universe (page reload) and the run ends there (event
  `page-reset`). The endgame is outside every Stage 3 window. The Stage 2/3 rules apply only from
  Stage 2 on; Paperclips Stage 1 play is unchanged from round 1 (identical policy actions over 50
  stepped minutes).
* Takeoff's Autoplay bot answers a modal inside the tick that opens it, so 2-s snapshots of an
  `--autoplay` run show no modals; the analysis's game counters (`choices`) still count them.
* "Nothing-to-do (loose)" depends strongly on spending rules: an affordable purchase the policy
  holds back (one consumable purchase in reserve) counts as "something to do". Compare it only
  between runs of this harness.
* Real-time (phase 1) runs are not reproducible by design; only stepped runs are.
