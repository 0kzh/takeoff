# Takeoff

An incremental browser game about an AI lab racing to superintelligence, in the style of
*Universal Paperclips* (layout, numbers, console) and *A Dark Room* (Developments log, choice
modals). You run OpenMind from July 2025: complete tasks, bill them, rent GPUs, hire researchers,
train and release Sage models, and watch the world react in the margin.

Built so far: the full architecture, **Stage 1 — The Startup** (about 20–30 minutes) and
**Stage 2 — Scale** (about 36–44 minutes). Stage 1 opens one mechanic at a time (one button, then
funds, a GPU to save for, the power meter, Buy Power, the price, Marketing, Research), and every
training run needs a number of GPUs: when the next one needs more than the cloud will rent, `First
Datacenter` (1,000 GPUs of OpenMind's own at Abilene) opens Stage 2, where OpenMind owns its
datacenters: GPU lots in three sizes, datacenters that take time to build, power plants and an
interconnect queue, an AUTO-priced market, data, two training pipelines, rivals, government, public
approval, security and an alignment number nobody can see. `Let Sage-3 write the code`
ends it and opens the Stage 3 shell (narrated arrival; Stage 3's content is not built yet). The design lives in `docs/design.md` and the stage plan in `docs/stages.md` (where the
two differ, `docs/stages.md` and the code win).

## Running it

```sh
npm install          # TypeScript is the only dependency
npm run dev          # build once, then serve on http://127.0.0.1:8731/
npm run watch        # in a second terminal: recompile on save
```

| Script | What it does |
| --- | --- |
| `npm run build` | `tsc`: compiles `src/` to `dist/` (ES2022 modules, no bundler) |
| `npm run watch` | `tsc --watch` |
| `npm run serve` | zero-dependency static server (`scripts/serve.mjs`) on port 8731, `Cache-Control: no-store` |
| `npm run dev` | build, then serve |
| `npm run sim -- --minutes 45 --seed 1` | build, then run the headless simulator |
| `node tools/verify/smoke.mjs` | Stage 1 browser smoke test (after `npm run build`; needs `npm install` in `tools/`) |
| `node tools/verify/smoke-stage2.mjs` | Stage 2 browser smoke test, from the Stage 2 preset through the Stage 3 arrival |

The browser loads `dist/main.js` as a native ES module, which is why every TypeScript import uses
an explicit `.js` extension. `dist/` is gitignored.

## Architecture

```
index.html        every panel for all five stages, present and hidden (stable ids, data-panel, data-reveal)
styles.css        one file; UP/ADR look; responsive rules at the bottom
src/
  main.ts         boot: load save → mount UI → requestAnimationFrame loop
  engine/         pure game logic, no DOM
    state.ts      GameState, newGame(seed), SAVE_VERSION, migrate(), serialize/deserialize
    tick.ts       tick(state, dtMs): 100 ms fixed step with an accumulator; the `actions` object
    economy.ts    demand and billing (UP formula), power, GPUs, marketing, research, infrastructure
    training.ts   training → evaluating → red-team → release state machine
    projects.ts   project runtime: triggers, visibility cap, purchase
    events.ts     developments, crises, rival releases, choices, the idle guard
    stages.ts     stage definitions, transitions and reveal rules
    reveal.ts     the reveal scheduler: triggered projects drip in one every 15 s; first-time reveal bookkeeping
    clock.ts      game date (Stage 1: one month per 4 minutes; snaps on transitions)
    endings.ts    ending stubs and end-of-run stats
    rng.ts        mulberry32; the rolling seed lives in the state, so saves and sims replay exactly
    format.ts     numbers, money, durations, dates
  data/           content tables: projects, developments, choices, crises, flavor text, dev presets
  ui/             the only code that touches the DOM
    render.ts     render(state): diffs text into spans, toggles visibility from state.revealed
    meter.ts      meter(fraction): the ten-cell capacity bar `｢￭￭￭￭￭￭￭･･･｣` (DOM-free; boot width check)
    console.ts, log.ts, modal.ts, graph.ts, dev.ts, save.ts, dom.ts
  sim/
    policy.ts     the "reasonable player" bot (pure; also drives the dev overlay's Autoplay)
    bot.ts        headless runner that prints a timeline
```

`src/engine`, `src/data` and `src/sim` never reference `document`, `window` or `localStorage`, so
the same code runs in Node for the simulator. All randomness goes through `engine/rng.ts`.

### Tick order

Each 100 ms step runs: production → power → billing → research and insight → training → projects
→ events → clock → stage checks → stats. Slow work (power price walk, 10 s averages, bottleneck
lines, rival releases) runs every tenth step.

## Reveal flags

Visibility is state. `state.revealed` is a map of flag → boolean. Any element with
`data-reveal="flag"` is shown exactly when that flag is true; `render.ts` is the only code that
toggles it. Flags are set by:

* reveal rules in `engine/stages.ts`: Stage 1's opening beats, one thing each (`business` at the
  first task, `compute` at $3, `fleet` at the first GPU, `power` at the third GPU or 20 s later,
  `buyPower` at 800 kWh, `pricing` when unsold tasks pile up, `marketing` after the first price
  move; beats 4–8 in that order and at least 30 s apart), then `research` at the first Trust
  milestone, `expandLab` when research nears the cap, `projects` 40 s after `research`, `quota` at
  60 rented, `log` (the Developments column and the date) from 3:30,
* engine events (the first training run sets `copies`, the first release sets `focus`),
* project effects (Training Pipeline sets `training`),
* stage `enter()` functions, which also hide panels (Stage 2 hides `power`, `buyPower`, `compute`).

A few lines are shown or hidden by plain state rather than a flag (the manual power row while the
Grid Contract buys, Copies only when they differ from GPUs); `render.ts` still does all of it. A
save therefore restores the screen exactly as it was. Elements that become visible fade in over
0.8 s (not under `prefers-reduced-motion`, not on the restore after a load).

## Adding content

**A project**: add a `project({...})` entry to `src/data/projects.ts`:

```ts
project({
  id: 'p_example',
  title: 'Example',
  cost: { research: 4000, funds: 1000 },      // or (s) => Cost for scaling prices
  description: 'One plain sentence about the effect.',
  trigger: (s) => s.tasks >= 50000,           // when it appears (greyed out until affordable)
  buy: (s) => { s.copyBoost += 0.25; },       // effect after the cost is paid
  consoleMsg: 'Example shipped.',             // optional console line
  logMsg: 'OpenMind ships an example.',       // optional Developments entry
}),
```

Options: `stages` (default `[1]`; Stage-1-only projects still on screen at the transition are
retired with a console line), `uses` (default 1; `Infinity` for repeatables, with `rehide: true`
for rescues), `repeatable` (a standing offer such as the Custom model contract, drawn with a double
border), `priceTag`, `canAfford`, `expires` (the offer lapses and leaves the screen),
`revealFunds` / `revealResearch` (a price of at least that many seconds of revenue or research,
fixed when the card first shows; research never above 85 % of the lab). A triggered project joins
the reveal queue (`engine/reveal.ts`) and appears in table order: Stage 1 one a minute until the
Training panel, then every 30 s, at most four on screen (a card that has waited 140 s comes out
anyway); Stage 2 every 15 s, at most six on screen with everything counted but rescues (after
160 s with nothing new, one or two more may join, eight at most). These skip the wait: `rescue`
(also uncapped, drawn dashed), `pinned` (the stage goal), `urgent(s)` (a wall's named fix while it
holds), `ignoresCap` (Stage 2's G6 pre-order), `chain` (the next step of a series, at once when
there is room); Stage 1 `sideline` offers drip in but never fill the cap. A card never appears
within 4 s of a modal opening, nor a modal within 4 s of anything new (`BEAT_GAP_SECONDS`). Stage 1
projects mostly cost research or insight, as Paperclips' cost operations; money is for compute,
marketing, training and First Datacenter.

**A development** (Developments log): add to `src/data/developments.ts`. It fires on `month`
(months since Jul 2025; use `monthOf(2025, 11)`) or on `trigger(s)`, whichever comes first. It can
also print a `console` line, fire a `crisis` or open a `choice`.

**A choice** (modal): add to `src/data/choices.ts` with `title`, `text(s, ctx)`, two or three
`options` (`label`, `record`, `tooltip`, `cost`, `enabled`, `effect`, `log`) and an optional
`timer` plus `defaultOption`, and `valid(s, ctx)` (a queued modal that no longer applies is
dropped). Open it with `openChoice(s, id, context)` or from a development. Modals open at least
150 s apart (`MODAL_SPACING`); later ones wait in `choiceQueue`. A modal the player's own click
causes (`PLAYER_MODALS`: the open-issues confirm, Sage-2) opens at once. Stage 1's modals are a
calendar of dated developments about 3¼ minutes apart, plus the training gamble when it fits. The
game does not pause while a modal is open, and neither does the page: the event panel catches no
clicks outside itself, takes keyboard focus when it opens, and Escape takes the default. Every
event carries a timer with a harmless default, so an unanswered one never holds the stage up.
Each option prints its effect and cost under its label (`line` in `data/choices.ts`; stakes are
sized when the modal opens, in `onOpen`'s context); a greyed option says what it needs (`needs`,
or its price).

## Dev overlay

Open with the backtick key or `?dev=1`. The fixed bottom-right panel has:

* **Stage 1–5**: load a preset. Stage 2 is the simulator's median Stage 1 state at First
  Datacenter (bot, seeds 1–5, rebuilt after owner feedback 1; seed 3's records, 24:32), run through
  the arrival; Stage 3 is the median Stage 2 exit (bot from the Stage 2 preset, seeds 1–5; seed 2's
  records, 34:59) run through the Stage 3 arrival; 4–5 load the Stage 3 preset and say `preset
  pending`.
* **Speed ×1/×5/×20**, plus **Autoplay** (the simulator's bot plays in the browser).
* `?seed=N` in the URL starts a reproducible new game when there is no save, and seeds the
  presets; `?speed=0` boots paused (the smoke tests reload mid-game without real-time frames).
* **+$, +Research, +Insight, +Compute, +Power, +Trust, Finish training, Fire event ▾**.
* **Show hidden**: approval, government relations, true alignment, idle-guard state, time in stage, the next developments.
* **Export / Import** (base64 JSON) and **Reset** (asks to confirm).

### `window.__game`

```js
__game.state            // the live GameState (stable reference; loads replace it in place)
__game.actions          // every player verb: actions.rentGpu(state), actions.buyProject(state, 'p_seed') …
__game.tick(ms)         // advance game time (honours Autoplay), then render
__game.projects         // { all, byId(id), visible() }
__game.events           // { fireable, fire(id) }
__game.presets          // preset table
__game.loadPreset(n)    // 1–5
__game.setSpeed(n)      // 1, 5, 20 … (0 freezes the real-time loop; drive it with tick)
__game.setAutoplay(on, policy?, holdTransition?)  // policy 'bot' | 'naive' | 'greedy' | 'trainfirst'; hold leaves First Datacenter to you
__game.save()           // write localStorage now
__game.version          // SAVE_VERSION
```

Every button and panel has a stable `id`: `btn-*` for buttons, `panel-*` for panels, `proj-<id>`
for project buttons, `choice-<choiceId>-<n>` for modal options, `dev-*` for the overlay.

## Saving

`localStorage["takeoff.save.v1"]` holds the whole `GameState` as JSON (`SAVE_VERSION` 6; versions
1–5 are migrated on load; a version-5 save keeps its screen, its Abilene ladder becomes First
Datacenter, and the opening's new flags are set). The game saves every 15 s,
about 250 ms after any player action, and when the tab is hidden or closed. A `saved.` toast shows
at most once every 30 s. Timers (training, red-team cooldown, choice countdowns) are stored as
remaining seconds, so a reload cannot skip them. There is no offline progress. `migrate()` upgrades
older save versions and fills fields that newer versions added.

## Headless simulator

```sh
npm run sim -- --minutes 45 --seed 1                    # full timeline, bot policy
npm run sim -- --minutes 45 --seed 3 --quiet            # minute lines and the summary
npm run sim -- --minutes 45 --seed 2 --policy naive     # the critic's scripted first-timer
npm run sim -- --minutes 45 --seed 2 --policy greedy    # the same, renting whenever it can and never saving
npm run sim -- --minutes 45 --seed 2 --policy trainfirst  # the same, training whenever Train is enabled before saving
npm run sim -- --minutes 45 --seed 1 --json             # one machine-readable summary line
npm run sim -- --minutes 60 --stop-at-stage 2
npm run sim -- --minutes 60 --preset 2 --stop-at-stage 3   # Stage 2 from its preset
npm run sim -- --minutes 60 --preset 2 --variant modals-worst --json
```

`--preset N` starts from the dev overlay's Stage N preset (2: the Stage 1 median at First Datacenter;
3: the Stage 2 median exit). `--variant` plays the policy with one decision fixed. Both stages:
`modals-best` / `modals-worst` (the most careful- or reckless-looking answer to every modal, waiting
for a greyed careful one), `modals-last`, `modals-ignore` (alias `ignore-modals`: every event runs
out its timer to the default), `redteam-never`, `focus-efficiency` / `focus-safety` (every run).
Stage 1: `price-never` (the opening price is never touched). Stage 2: `slider-N` (copies on research
fixed at N %), `safety-0` / `safety-2` (Safety runs), `gulf-sign` / `gulf-domestic`.

Four policies play through `actions` only:

* **bot** (default) — a reasonable player: the first-timer's purchase loop with judgment on top.
  It prices every second (Dynamic pricing once offered), answers each modal with the careful
  option (waiting for a greyed one it can afford soon), takes the leaderboard only when ahead, is
  patient with side offers while the next run's money is there, trains Capability while rented
  compute still teaches the model and Efficiency after, red-teams to zero, releases.
* **naive** — the critic's first-timer: clicks at 4/s until the copies make 8 tasks/s, buys
  anything affordable while keeping one power block in reserve, lowers the price only when the
  backlog exceeds 30 s of production and grows (raises after four near-zero checks, 8 s
  cool-down), answers every modal with its first enabled option, never touches Focus, red-teams
  to zero, and stops the GPU and marketing drip to save once First Datacenter is on screen (the
  bot saves from the wall: the first run the cloud's GPUs cannot train).
* **greedy** — the naive player without restraint: rents a GPU whenever one is affordable, buys
  everything else the moment it can, and never saves (the rental quota is what stops it).
* **trainfirst** — the naive player who presses Train whenever it is enabled before saving for
  anything else: the critic harness's first-timer, in the sim. From the
  Stage 2 arrival naive, greedy and trainfirst all play this way (greedy pressing the
  Infrastructure buttons up to fifteen times a check); its Infrastructure follows the main lot's
  reason (a lot when it is enabled, the cheapest power per MW at "no power", a hall at "no
  room"), as the harness does.

Both read a modal for 2.5 s before answering. The output contains one line per minute, one line
per event (BUY, REVEAL, PROJECT shown, MODAL, TRAIN, RELEASE, STAGE, LOG, CHOICE, IDLE RESCUE),
`IDLE GAP` lines, and a summary: Stage 1 milestones, First Datacenter's appearance, the wall and
the purchase, the transition time and capability, training runs and the GPUs each needed, the
longest stretch with Train blocked for GPUs alone, modals opened (and the
smallest gap between two that opened on their own), `LONGEST REVEAL GAP` (between first-time
reveals: a `revealed` flag, a project first shown, a modal first opened; rescues excluded) with
every gap over 120 s,
`LONGEST NOVELTY GAP` (reveals plus TRAIN phase changes and BUYs), Buy Power presses with the
worst 5-minute window, Stage 1 idle rescues (and any at 0 tasks), and soft-lock stretches (60 s+
without production in Stage 1). `--json` prints the summary only, as one line.

In Stage 2 the bot follows `stage2.md` §9.1 (modals; free and cheap cards; the binding wall —
power when under a thousand GPUs' worth is left, then room, with turbines when a reactor is out of
reach and the next hall built once the last one is 70 % full; training when the run has its GPUs,
the lots saving its price once the fleet is half again what it needs (the game's own run hold);
a wider market first; other cards in table order, the next run's money lent for 30 s of
revenue at most; the largest GPU lot that fits, the main lot's hundreds when none does; Trust; the
slider at 20 %). The Stage 1 summary
adds the reveal → purchase latency, the densest six minutes of first-time reveals and the exit
state (capability, alignment, Trust, staff, marketing, contracts, revenue, price, GPUs,
incidents). The Stage 2 summary block adds the A1–A19 acceptance numbers
(duration, reveal and mechanic gaps, training runs, the intervals between their starts and the
GPUs each needed, the share of the stage with Train blocked for GPUs alone, governor pulls, modals,
visible cards and queue waits, first power / datacenter / AI assistants, GPU presses before the
Standing order, 5-minute marks), the reveal → purchase latency per card (median and the share bought within 10 s),
the modal answers, the exit state (capability, alignment true / apparent, government, approval,
lead, funds, security level), and the critic's hands-and-eyes measures from 3:00 on (G24–G26): the
share of 2-s checks with no enabled purchase and with two or more distinct ones (lot sizes count
once), the share of the stage after 10:00 spent inside gaps of 30 s or more between the player's
actions, and the longest interval between two model releases (from the arrival).

Stage 2 targets (critic round 1 and owner feedback 1; the harness's first-timer and the bot):
36:00–44:00; 10–12 training runs, starts 180–300 s apart on average and never more than 330 s;
Train blocked for want of GPUs ≤ 5 % of the stage (bot), ≤ 25 % (trainfirst); capability
4.0–4.7× at the exit; no enabled purchase in at most half of the checks; two or more affordable in
at least a quarter; at most 35 % of the stage after 10:00 in click gaps of 30 s or more; no release
interval over 5:30.

Stage 1 targets (seeds 1–5, owner feedback 1): transition 20:00–26:00 (bot) / 22:00–30:00 (naive,
greedy, trainfirst), longest reveal gap ≤ 180 s, the longest stretch with Train blocked for GPUs
alone ≤ 4:00, the bot buying First Datacenter 60–150 s after the wall (trainfirst within 240 s),
capability 1.5–1.8× at the transition, at most 9 modals and never two automatic ones within 150 s,
≤ 2 idle rescues and none at 0 tasks, the first GPU by 0:16 at one and a half clicks a second.
Decision variants (naive, seeds 1–3): best vs worst modal answers ≥ 3 min apart, red-team to zero
vs never ≥ 3 min, price tracked vs never ≥ 5 min.

## Browser smoke test

```sh
npm run build && (cd tools && npm install) && node tools/verify/smoke.mjs [--policy naive] [--seed 1] [--verbose]
```

Starts its own static server on a free port and drives system Chrome headless (Playwright,
`channel: 'chrome'`) with autoplay and `__game.tick`. It checks the opening (owner feedback 1): one
control and one number at 0:00 and no power, funds or date; the meter one width at every fill; the
first GPU at 1.5, 2 and 4 clicks a second (16, 12 and 6 s); a steady player's numbers and controls
at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00 (≤ 1 / 4 / 6 / 11 / 17 / 22 and ≤ 1 / 2 / 3 / 5 / 7 /
10, with a screenshot each; 0:30 is allowed 5, the power reading of beat 4 at 0:26); then, under
autoplay, the reveal order, beats 4–8 in order ≥ 30 s apart, no beat in the first five minutes
adding more than 2 controls or 4 numbers (later: 3 and 8), a greyed goal on screen from the first
purchase (G3 as amended), no `undertrained` or `Train now` anywhere, the Train row naming its GPU
shortfall and fix, numbers / controls / words at minutes 0/1/3/5/10/20/end and the minute-10 budget
(≤ 38 numbers, ≤ 15 controls, ≤ 230 words), a save → reload during a training run, the transition
narration and arrival, no horizontal overflow at 390 px, and no page or console errors through the
Stage 2 arrival. Screenshots go to
`agent-tools/shots/stage1/` (gitignored); it exits non-zero on any failure.

```sh
node tools/verify/smoke-stage2.mjs [--policy naive] [--seed 1]
```

Loads the Stage 2 preset and plays it under autoplay to the Stage 3 arrival. It checks the arrival
(five narration lines held whole for 10 s, revenue above the pre-arrival figure 30 s in, no
backlog), no Stage 1 diagnosis line, the Stores rows and a hover breakdown, the capability graph
drawn, every Stage 2 panel appearing, the event panel (an effect line on every option, keyboard
focus inside it, the page behind still clickable, Escape taking a timed default), save → reload
mid-run, mid-interconnect-queue and mid-cooldown, the Stores meters, no `undertrained` or `Train
now`, the Train row short of GPUs (`Needs 3,700 GPUs. 1,000 free.` and, with GPUs unpowered,
`Needs 6,700 powered GPUs. 4,000 are dark: add power.`), numbers / controls / words on screen at each
5-minute mark (numbers ≤ 60 at 5:00, ≤ 70 at 10:00, ≤ 80 after, set against Paperclips' Stage 2:
39 and 54 at 5:00 and 10:00 with a nearly empty early stage, 66–83 at the marks from 15:00;
controls ≤ 30), the Stage 3 narration and dev overlay, the Stage 3 preset,
and 390 px without horizontal overflow. Screenshots go to `agent-tools/shots/stage2/`.
