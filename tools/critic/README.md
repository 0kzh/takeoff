# tools/critic — playtest measurement harness

Plays Takeoff, Universal Paperclips and A Dark Room in headless Chrome with one scripted "curious
first-time player" and measures them with the definitions of `docs/critic-stage1-round1.md` §1
(the report of critic round 1, whose harness was lost). It measures; it does not judge.

All commands run from the repo root. Outputs go to `agent-tools/critic-out/<label>.*` (gitignored).

## Setup (once)

```sh
sh tools/critic/setup.sh            # clones the reference games into agent-tools/refs/ (idempotent)
npm ci                            # Node 22.18+; includes playwright-core
```

Chrome is used through `chromium.launch({ channel: 'chrome', headless: true })`; no browser
download. Every run starts its own static servers on ephemeral ports (127.0.0.1:0) and stops them
on exit. Network access other than that server is blocked, so the runs are offline.

**Takeoff defaults to the Vite `dist/` build.** Run `npm run build` first. To freeze a build:

```sh
mkdir -p agent-tools/snapshots/<name> && cp -R dist/. agent-tools/snapshots/<name>/
```

## Running a stage comparison

```sh
# Takeoff build under test (Stage N start via __game.loadPreset(N); presets 1 and 2 are real today)
node tools/critic/run.ts takeoff    tk-sN        --game-dir agent-tools/snapshots/<build> --stage N --realtime 300 --accel-minutes 60
node tools/critic/run.ts takeoff    tk-sN-auto   --game-dir agent-tools/snapshots/<build> --stage N --realtime 0 --accel-minutes 60 --autoplay
# Reference (Stage 2/3 start from the cheated fixtures in tools/critic/fixtures/)
node tools/critic/run.ts paperclips pc-sN        --stage N --realtime 300 --accel-minutes 60
node tools/critic/run.ts paperclips pc-sN-accel  --stage N --realtime 0 --accel-minutes 120
node tools/critic/analyze.ts tk-sN               # → agent-tools/critic-out/tk-sN.analysis.md (+ .json)
node tools/critic/analyze.ts pc-sN
node tools/critic/compare.ts tk-sN pc-sN tk-sN-auto
node tools/critic/transition.ts takeoff    --game-dir agent-tools/snapshots/<build> --stage N
node tools/critic/transition.ts paperclips                   # Stage 1→2 from fixture paperclips-s1-end
node tools/critic/softlock.ts takeoff    --game-dir agent-tools/snapshots/<build> [--stage N]
node tools/critic/softlock.ts paperclips
```

Round-1 baselines (Stage 1) were captured with:

```sh
node tools/critic/run.ts takeoff takeoff-base          --game-dir agent-tools/snapshots/base --realtime 300 --accel-minutes 60
node tools/critic/run.ts takeoff takeoff-base-autoplay --game-dir agent-tools/snapshots/base --realtime 0 --accel-minutes 60 --autoplay
node tools/critic/run.ts paperclips pc-s1              --realtime 300 --accel-minutes 60
node tools/critic/run.ts paperclips pc-s1-accel        --realtime 0 --accel-minutes 120
node tools/critic/run.ts adr adr-5min                  --realtime 300
```

Run only one real-time run at a time (phase 1 is timing-sensitive); stepped runs are not.

## run.ts

`node tools/critic/run.ts <takeoff|paperclips|adr> <label|path-prefix> [flags]`

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
installed at page init (`lib/initscript.ts`: `setTimeout/setInterval/requestAnimationFrame/Date/
performance.now` behind `window.__advance(ms)`; a page-side pump makes it follow the wall clock
during phase 1). The games' code is never modified.

Each 2 s of game time: snapshot → policy pass → advance (the main button is clicked every 250 ms
while mashing). Outputs per run:

| file | content |
|---|---|
| `<p>.snaps.json` | `{meta, snaps}`; snapshot = buttons `{k key, l label, e enabled, kind button/project/modal/tab, a ambient, t setting, on shows on/armed, u drawn urgent, why reason printed beside it, later delay it prints for the waiting run (s, or "much")}`, sliders, panels `{k, l}`, newest console line, newest log entry, modal `{title, options}`, `numbers` (numeric tokens on screen), `words` (words on screen), `milestone` (`#nextTrust` visible), `m` (game metrics from the adapter). `meta.stageEndBy` says what the stage ended in (Takeoff: "Stage 4", "ending: The Pause") |
| `<p>.events.json` | `reveal` (first time visible), `enabled`, `hidden`, `console`/`log` lines (`novel` = text not seen before), `modal`, `stage`, `stage-end`, `transition-samples` (250-ms console/panel samples for 2 s after a stage change) |
| `<p>.actions.json` | every policy click `{t, key, label, why, detail}`; mash clicks aggregated per 2-s window (`why: 'mash', count`) |
| `<p>.summary.md` | run metadata and counts |
| `<p>.t<min>.png` | screenshots at minutes 0, 1, 3, 5, 10, 20; `.tpre.png` just before the policy buys a stage gate, `.tend.png` at the stage change, `.transition.png` 4 s later |
| `<p>.transition.txt` | console lines, vanished/appeared elements, projects gone un-bought, buttons on arrival, numbers before/after |

## analyze.ts, compare.ts

`node tools/critic/analyze.ts <label>` prints and writes `<label>.analysis.md` and `.analysis.json`:
time to first automation; first-meaningful-choice candidates; nothing-to-do (loose) for the first
5 minutes and the stage; novelty and reveal gaps (every gap > 120 s, the longest); reveal timeline;
greyed-out-goal coverage; cognitive load (numbers, interactive elements, panels and words on screen)
at minutes 0/1/3/5/10/20/30/end (30 added for longer stages; '—' when the stage ends earlier) and the
five largest single-beat disclosure spikes; action counts (+ game counters for Autoplay runs); the
**hands** measures for the whole stage, its first 10 minutes and after 10:00 (`handsOf` in
`lib/analysis.ts`, the Stage 2 critics' definitions: share of 2-s checks with nothing enabled / with
two or more distinct things enabled, clicks per minute, share of the window inside ≥ 30-s click
gaps); panel and project cadence. Analysis windows run from the stage start to the stage change; for a run that starts at
Stage N (`--stage N`) t = 0 is that stage's start. `analyze.ts <label> --stage M` analyses a later
stage reached inside a run (window from its first snapshot, times re-based; writes
`<label>.sM.analysis.md`). `compare.ts A B […]` writes one side-by-side table (`label:M` for a later
stage of a run).

## Probes

* `transition.ts <game> [--stage N] [--fixture NAME]` — plays (stepped) until the
  stage changes and writes `transition-<game>[-sN].md` plus `.tpre/.tend/.transition.png`
  (default cap 60 min).
* `softlock.ts <game> [--scenario NAME] [--stage N]` — the §4 dead-end probes as named scenarios,
  each from a new game (or the start of Stage N) in stepped mode; writes
  `softlock-<game>[-sN].md` and `softlock-<game>[-sN]-<scenario>.png`. Takeoff: `power-zero`,
  `idle-new-game`, `price-200x` (Stage 1 situations: "not applicable" from Stage 2),
  `ignore-research-15min` (Stages 1–2; "not applicable" in Stage 3, where Hire Researcher / Expand
  Lab are gone) and `reload-mid-training` (Stages 1–3). Paperclips:
  `wire-out-low-price`, `absurd-price`, `reload`, `idle`. A scenario whose preconditions no longer
  hold reports `scenario no longer applicable: <reason>` instead of failing.
* `determinism.ts <game> [run flags]` — runs the same stepped run twice and diffs events, actions
  and snapshots (`DETERMINISTIC` or the first difference).
* `make-fixtures.ts` — rebuilds `fixtures/paperclips-stage2.json` (just after "Release the
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

* `explore.ts <name[,name…]|list|all-runs|all-probes|all-paperclips> --game-dir DIR [--seed N]
  [--minutes MIN] [--stage N] [--tag T]` — "a player who does the unexpected". **Runs** play a
  whole stage with a modified first-timer policy (`greedy`, `no-price`, `price-up`, `no-research`,
  `hire-only`, `expand-only`, `ship-open`, `modal-last`, `modal-ignore`, `modal-worst`,
  `modal-best`, `no-train`, `click-only`, `no-projects`, `mobile` (390 × 844), `focus-efficiency`,
  `focus-safety`, `no-marketing`, `no-redteam-wait`, `no-contracts`, `no-side-projects`,
  `toggles` (every setting pressed once at first sight, each slider set to its minimum at first
  sight and its maximum 10 minutes later), `baseline`) and write a normal run `<tag>-<name>.*` (so `analyze.ts`, `compare.ts` and
  `decisions.ts` work on it) plus `<tag>-<name>.explore.md` (one metrics row per minute, every
  modal with body text / timer / option tooltips, on-screen notes each time they change, every
  console and log line), `.modals.json` and `.modal<N>.png`. **Probes** are short scripted
  situations writing `<tag>-<name>.md` and screenshots: `reload-mid-modal`, `reload-mid-countdown`,
  `reload-mid-transition`, `idle-10min-new`, `idle-mid`,
  `price-200x-at-start`, `price-floor`, `modal-click-through` (real mouse and keyboard),
  `modal-hover`, `wall-flag`, `contracts-vs-price`, `tour` (screens at each first
  meeting, full text of every project card, clipped cards), `mobile-shots`. **Paperclips**
  reference runs: `pc-no-price`, `pc-proc-only`, `pc-mobile`. `--stage N` starts every run or probe
  at Stage N (Takeoff preset, Paperclips fixture; labels get `-sN`); the probes were written for
  Takeoff Stage 1 and say what they cannot find on other stages. `--tag` sets the label prefix
  (default `x`; round 2 used `r2x`).
* `decisions.ts <label[:N]…> [--stage N]` — gaps between non-drip decisions, and reveal → purchase
  latency of projects, for any run; `:N`/`--stage N` takes Stage N of a run, timed from its start.
  From Stage 2 on, repeat purchases count as drip too — Paperclips' drones, farms, batteries, probe
  launches and Processors/Memory bought with swarm gifts; Stage 1 numbers are unchanged.
* Library hooks: `adapter.policy.modalChoice(modal, enabledOptions, t)` in `lib/policy.ts`
  (default unchanged: first enabled option; return `null` to leave the modal open);
  `runGame({ adapter, viewport })` in `lib/runner.ts` (a pre-built adapter instead of the one
  loaded by name; viewport passed to the session); `openProbe(adapter, { viewport })` in
  `lib/probe.ts`.
* Fixes asked for by the round-2 critic: `determinism.ts --out LABEL` (writes `LABEL-a/-b` instead
  of overwriting `det-<game>-a/-b`).

## Definitions and implementation choices

The report's §1 definitions are applied verbatim (see the header of `lib/analysis.ts`). Where §1
left something open, the harness does this:

* **Big-ticket goals** (Takeoff Stage 1). §1 says the first-timer stops the GPU/marketing drip and saves once a
  big-ticket goal is visible, and round 1 named that goal by id (First Datacenter). The adapter keeps the
  id as the stage gate and adds a rule (`policy.goalRule`) so later builds need no edit: any visible
  project priced in funds at ≥ $10,000 and ≥ 60 s of current revenue is a goal. Without it the policy
  keeps renting GPUs at any price and never saves for a funds-priced ladder. While a goal is visible only
  the `drip` set (GPUs, marketing) is held back, as §1 words it; training runs and one-off projects are
  still bought when affordable, keeping the one-purchase consumable reserve.

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
* **Policy** (`lib/policy.ts`; game knowledge in `games/*.ts`): mash the main button at 4/s
  until automation makes ≥ 8 units/s (Stage 1 starts only); buy the first automation when
  affordable; answer a modal with its first enabled option; consumable (power/wire) bought when
  below half of one purchase (≤ 3 per check) and, while visible, one purchase of it always kept in
  reserve; price lowered when the backlog > 30 s of production and growing, raised after 4
  consecutive checks with backlog ≤ max(5, 1 s of production), 8 s cool-down; then one sweep over
  every other visible enabled non-ambient button (each clicked at most once per check, least-bought
  first; settings are never pressed by this sweep, see below); while a big-ticket goal is visible
  (Takeoff Stage 1: funds-priced projects, see above) the drip
  (GPU/marketing) is held back until it is bought; a purchase that changes the stage ends the check
  (the new screen is read at the next one). Takeoff: release as soon as the model is ready;
  in Stage 1 Train goes through the sweep like a purchase, pressed once its price is in hand (so it
  never arms).
  Paperclips: Memory (never Processors) while the cheapest visible project costs more ops than the
  cap, otherwise Trust goes through the generic loop; tournaments
  only with ops at the cap; toggles and "Disassemble All" never clicked. ADR: when nothing in view
  is clickable, visit the next location tab. A click that changes nothing is not retried for 30 s
  (ADR's "not enough wood").
* **Paperclips Stage 2 (Earth)** — rules used only from Stage 2 on (`games/paperclips-late.ts`).
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
* **Settings are not purchases** (all games). `lib/pagelib.ts` marks a visible button as a setting
  (`t: 1`, ambient) when it is a toggle (class `toggle` or an `aria-pressed` attribute), is labelled
  ON/OFF or AUTO…, or reads "Name: value" with a short value ("Alignment compute: 1%"); the sweep
  never presses one. It also records a greyed button's inline reason (`why`, from a
  `<span class="reason">` in the same row). Paperclips' toggles are switched only by its own rules.
* **Selectors are settings** (all games). A button in a row of buttons one of which shows as
  selected (class `selected`) is marked `t: 1`, ambient, like a toggle; buttons the adapter already lists as ambient (Takeoff's
  Focus) are left as they were.
* **On or armed is not pressed again** (all games). A button that shows as already on or armed
  (`on`: `aria-pressed="true"`, class `armed` or `on`, a title starting "Armed", a label ending
  ": on") is never pressed by the sweep or by Takeoff's Train rule: pressing it would switch it off
  or stand it down (Takeoff's Train arms when the money is short and stands down when pressed again).
* **Printed delays** (all games). `later` = the delay a button's own text or a note/reason in its row
  prints for what the player is waiting for ("· Sage-2.5 0:41 later", "· next run 1:10 later", "+0.5
  points · 1:10 later"; "much" counts as any). A repeat purchase — any button that is not a
  project card — that prints one is not pressed by the sweep; cards are still bought when affordable.
  The screen is read as printed: a delay under the game's printing threshold (10 s) is not seen.
* **Words on screen** = letter-led tokens (`[A-Za-z][A-Za-z'’-]*`) in `document.body.innerText`, the
  excluded roots (Takeoff's `#dev`/`#toast`, Paperclips' debug/save buttons) left out — the Stage 1
  round-3 and Stage 2 round-2 critics' count.
* **Stage end**: Takeoff `state.stage` increases or `state.ending` is set; Paperclips Stage 1 ends
  when `humanFlag` drops to 0 (Release the HypnoDrones), Stage 2 when `spaceFlag` becomes 1 (Space
  Exploration), Stage 3 at "Universal Paperclips achieved" (milestone 15, the Emperor of Drift
  messages that open the endgame).

## Layout

```
run.ts analyze.ts compare.ts transition.ts softlock.ts determinism.ts make-fixtures.ts setup.sh
explore.ts decisions.ts   (round-2 additions)
explore-s1r3.ts            (Stage 1 round-3 addition: build s12-r4's Stage 1 play styles, probes, gate tables)
lib/   server.ts (static server) · initscript.ts (virtual clock, seeded PRNG, Takeoff boot seed)
       pagelib.ts (in-page snapshot/controls/click) · session.ts (browser + clock control)
       policy.ts · recorder.ts (events) · runner.ts (phases, outputs) · analysis.ts
       transition-report.ts · probe.ts (softlock kit) · util.ts
games/ takeoff.ts · paperclips.ts · adr.ts   (selectors, ambient set, metrics, policy hooks, cheats)
       paperclips-late.ts (Paperclips Stage 2/3 play rules)
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
