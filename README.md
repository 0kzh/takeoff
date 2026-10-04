# Takeoff

An incremental browser game about an AI lab racing to superintelligence, in the style of
*Universal Paperclips* (layout, numbers, console) and *A Dark Room* (Developments log, choice
modals). You run OpenMind from July 2025: complete tasks, bill them, rent GPUs, hire researchers,
train and release Sage models, and watch the world react in the margin.

Built so far: the full architecture, **Stage 1 — The Startup** (about 20–30 minutes),
**Stage 2 — Scale** (about 36–44 minutes) and **Stage 3 — Takeoff** (about 42–50 minutes). Stage 1
opens one mechanic at a time (one button, then funds, a GPU to save for, the power meter, Buy Power,
the price, Marketing, Research), and every training run needs a number of GPUs: when the next one
needs more than the cloud will rent, `First Datacenter` (1,000 GPUs of OpenMind's own at Abilene)
opens Stage 2, where OpenMind owns its datacenters: GPU lots in three sizes, datacenters that take
time to build, power plants and an interconnect queue, an AUTO-priced market, data, two training
pipelines, rivals, government, public approval, security and an alignment number nobody can see.
`Let Sage-3 write the code` opens Stage 3, where the model does the research: a run is a research
program, the player hands the lab to the model one autonomy grant at a time (each prints
`WARNING: risk of value drift increased.`), copies drift at a rate set by a true alignment nobody can
see until the interpretability labs read it, older generations watch the new as monitors, and an
Oversight Committee counts seats, incidents and a memo. The stage ends with the Committee's vote
(`Slow down — the Steward program` or `Race — Sage-5`) into a clean Stage 4 shell, or with one of two
endings (`The Pause`, `The Project`) and the end screen. The design lives in `docs/design.md` and the
stage plan in `docs/stages.md` (where the two differ, `docs/stages.md` and the code win).

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
| `node tools/verify/smoke-stage3.mjs` | Stage 3 browser smoke test, from both Stage 3 presets through the vote, the Pause and the Project |

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
    reveal.ts     the reveal scheduler: triggered projects drip in; Stage 3's grant list, late rows and governor; first-time reveal bookkeeping
    clock.ts      game date (Stage 1: one month per 4 minutes; snaps on transitions)
    endings.ts    the endings, their conditions and the end screen's rows
    rng.ts        mulberry32; the rolling seed lives in the state, so saves and sims replay exactly
    format.ts     numbers, money, durations, dates
    infrastructure.ts, market.ts, world.ts, stores.ts   Stage 2's lots, halls, plants, market, world, Stores hover
    stage3.ts     Stage 3's coordinator: shipments, the loop, drift every tick; budget, world, Committee each second
    alignment.ts  drift, monitors, rogue copies, Re-image, the labs and the instruments
    world3.ts, oversight.ts, events3.ts   the lead, Anthrosoft, jobs and approval; the Committee, the order, the session, the vote; the scripted beats
  data/           content tables: projects (projects3.ts for Stage 3), developments, choices (choices3.ts),
                  crises, the Stage 2 and 3 content tables (stage2.ts, stage3.ts), flavor text, dev presets
  ui/             the only code that touches the DOM
    render.ts     render(state): diffs text into spans, toggles visibility from state.revealed
    render3.ts    Stage 3's panels: allocation, the loop, shipments, Alignment and its grant list, Oversight, the end screen
    meter.ts      meter(fraction): the ten-cell capacity bar `｢￭￭￭￭￭￭￭･･･｣` (DOM-free; boot width check)
    console.ts, log.ts, modal.ts, graph.ts, stores.ts, dev.ts, save.ts, dom.ts
  sim/
    policy.ts     the "reasonable player" bot and the other policies (pure; also drives the dev overlay's Autoplay)
    policy3.ts    the Stage 3 branch of every policy, with the decision variants
    stage3sim.ts  the Stage 3 tracker and its B1–B35 block
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
  milestone, `projects` 40 s after `research` (with its first card and `Research buys projects.`),
  `expandLab` with the first Trust awarded 40 s after that with the lab full (never while Trust is 0),
  `training` once the Training Pipeline is bought and not before 5:00, `focus` 30 s after the first
  release, `quota` at 60 rented but not during a run's first cycle (Focus, the first event and the
  quota line are 30 s apart at least), `log` (the Developments column and the date) from 3:30,
* engine events (the first training run sets `copies`; from Stage 2 a release sets `focus`),
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
Training panel (only the first lab's four cards, in order: Better Prompting, Grid Contract, Blue-sky
Research, Training Pipeline), then every 30 s, at most four on screen (after 140 s with nothing new
one more may come out); an empty panel gets its next card 10 s after its last one was bought, and is
not drawn without a card; a card already paid for when it would come out waits up to 60 s for a
purchase to take the balance below it; Stage 2 every 15 s, at most six on screen with everything counted but rescues (after
160 s with nothing new, one or two more may join, eight at most). These skip the wait: `rescue`
(also uncapped, drawn dashed), `pinned` (the stage goal), `urgent(s)` (a wall's named fix while it
holds), `ignoresCap` (Stage 2's G6 pre-order), `chain` (the next step of a series, at once when
there is room); Stage 1 `sideline` offers drip in but never fill the cap. A card never appears
within 4 s of a modal opening, nor a modal within 4 s of anything new (`BEAT_GAP_SECONDS`). Stage 1
projects mostly cost research or insight, as Paperclips' cost operations; money is for compute,
marketing, training and First Datacenter. A Stage 1 run costs dollars only (`$290 × c^13`, two
figures: $290 / $1,300 / $5,300 / $23,000 / $100,000) and needs its GPUs; research buys cards. While
the next run (at the wall, First Datacenter) waits for money, Marketing, Rent GPU and dollar cards
print the delay they cause when it is 10 s or more (`· Sage-1.4 0:55 later`), and Train, pressed
short of money, arms. A card the lab cannot hold says so (`needs a lab that holds 2,000 — Expand Lab`).

Stage 3 projects live in `src/data/projects3.ts` and its content table (`src/data/stage3.ts`) orders
them with the panels, buttons and modals the stage reveals. Extra options there: `grant` (an autonomy
grant, listed in the Alignment panel outside the cap, three on offer and 15 s apart; buying one
prints the WARNING line and adds autonomy), `lateAt` (an approach row, released at that capability
75 s apart, or from September 2027 regardless), `instrument` (one of the approach's tests: it may pass
a full shelf once the last mechanic is 150 s old) and `needs` (what a greyed card waits for when it
is not money). Five cards are counted against the cap (the exit goals, the Pause and urgent fixes
ride free), and one to three more may come out after a quiet spell. The governor fills a 170 s hole
with the next row of the table, and as a last resort with the next late row within 15 % of its
threshold.

**A development** (Developments log): add to `src/data/developments.ts`. It fires on `month`
(months since Jul 2025; use `monthOf(2025, 11)`) or on `trigger(s)`, whichever comes first. It can
also print a `console` line, fire a `crisis` or open a `choice`.

**A choice** (modal): add to `src/data/choices.ts` with `title`, `text(s, ctx)`, two or three
`options` (`label`, `record`, `tooltip`, `cost`, `enabled`, `effect`, `log`) and an optional
`timer` plus `defaultOption`, and `valid(s, ctx)` (a queued modal that no longer applies is
dropped). Open it with `openChoice(s, id, context)` or from a development. Modals open at least
150 s apart (`MODAL_SPACING`); later ones wait in `choiceQueue`. A modal the player's own click
causes (`PLAYER_MODALS`: the open-issues confirm, Sage-2) opens at once. Stage 1's six events are a
queue (`calendar` developments): the first a minute after the first release, each later one 2:36
after the last was answered, never while a run waits for its evaluation, Red-team or Release, in
table order, one whose condition fails giving its slot to the next; plus the training gamble when it
fits. Stage 1's options list the timer's default first, then the costly ones, cheapest first. The
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
  records, 34:59, with the four cards every current exit has bought) run through the Stage 3
  arrival; Stage 4 is a real Stage 3 exit: the bot plays the Stage 3 preset (median seed) until the
  session is ready and the slow-down motion is brought. Stage 5 says `preset pending`.
* **A second row** of named starts: `Stage 3 start (careless)` (the same exit after a Stage 2 played
  for speed: Al-Marsa signed, the theft warning ignored, little alignment compute, relations 45,
  approval −30) and the four Stage 4 starts, slow and race from each Stage 3 preset (the careless
  pair played by the first-timer).
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
__game.loadPreset(n)    // 1–5, or a named start: '3c', '4s', '4r', '4cs', '4cr'
__game.setSpeed(n)      // 1, 5, 20 … (0 freezes the real-time loop; drive it with tick)
__game.setAutoplay(on, policy?, holdTransition?, variant?)
                        // policy 'bot' | 'naive' | 'greedy' | 'trainfirst' | 'racer' | 'cautious';
                        // hold leaves First Datacenter (Stage 1) or the motion (Stage 3) to you;
                        // variant: one of the sim's --variant names, e.g. 'pause' or 'refuse'
__game.save()           // write localStorage now
__game.version          // SAVE_VERSION
```

Every button and panel has a stable `id`: `btn-*` for buttons, `panel-*` for panels, `proj-<id>`
for project buttons, `choice-<choiceId>-<n>` for modal options, `dev-*` for the overlay.

## Saving

`localStorage["takeoff.save.v1"]` holds the whole `GameState` as JSON (`SAVE_VERSION` 9; versions
1–8 are migrated on load; a version-5 save keeps its screen, its Abilene ladder becomes First
Datacenter, and the opening's new flags are set; version 7 adds Stage 3's fields: shipments,
autonomy, drift and rogue copies, interpretability, the Committee, the ending; version 8 the build
fund; version 9 `marketingBought`, the Marketing levels paid for, estimated for an older save from its
level less the levels rounds, cards and events gave). The game saves every 15 s,
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
npm run sim -- --minutes 90 --preset 3 --stop-at-stage 4   # Stage 3 from its preset (3c: the careless start)
npm run sim -- --minutes 90 --preset 3 --policy racer --variant memo-bury
```

`--preset N` starts from the dev overlay's Stage N preset (2: the Stage 1 median at First Datacenter;
3: the Stage 2 median exit; `3c`: the careless Stage 3 start; `4s`, `4r`, `4cs`, `4cr`: the Stage 4
starts). `--variant` plays the policy with one decision fixed. Both stages:
`modals-best` / `modals-worst` (the most careful- or reckless-looking answer to every modal, waiting
for a greyed careful one), `modals-last`, `modals-ignore` (alias `ignore-modals`: every event runs
out its timer to the default), `redteam-never`, `focus-efficiency` / `focus-safety` (every run).
Stage 1: `price-never` (the opening price is never touched). Stage 2: `slider-N` (copies on research
fixed at N %), `safety-0` / `safety-2` (Safety runs), `gulf-sign` / `gulf-domestic`. Stage 3
(`stage3.md` §9.3): `neuralese`, `focus-capability` / `focus-safety`, `research-20` … `research-70`,
`monitors-0`, `grants-none`, `memo-bury`, `mini-everyone` / `mini-inside`, `committee-open` /
`committee-counsel`, `blockade-escort` / `blockade-channel`, `modals-first` / `modals-last` /
`modals-never`, `sendback-always`, `alignwork-0` / `alignwork-30`, `budget-0` … `budget-100`,
`lobby-never`, `payments-0` / `payments-5`, `step-small` / `step-large`, `pause` (signs the Pause when
offered) and `refuse` (refuses the Committee's order: The Project). Variants combine with commas.

Six policies play through `actions` only:

* **bot** (default) — a reasonable player: the first-timer's purchase loop with judgment on top.
  It prices every second (Dynamic pricing once offered), answers each modal with the careful
  option (waiting for a greyed one it can afford soon), takes the leaderboard only when ahead, is
  patient with side offers, presses Train once the run's GPUs are there (short of money it waits
  armed), and in Stage 1 reads the delay a dollar purchase prints for the waiting run (at the wall,
  First Datacenter), declining once its purchases would have put it 0:30 later (a GPU the run still
  needs prints none); red-teams to zero, releases.
* **naive** — the critic's first-timer: clicks at 4/s until the copies make 8 tasks/s, buys
  anything affordable while keeping one power block in reserve (each control once a pass, as the
  harness sweeps: Marketing before the next GPU), starts a run it can pay for, lowers the price only when the
  backlog exceeds 30 s of production and grows (raises after four near-zero checks, 8 s
  cool-down), answers every modal with its first enabled option (the timer's default), never touches Focus, red-teams
  to zero, and stops the GPU and marketing drip to save once First Datacenter is on screen.
* **greedy** — the naive player without restraint: rents a GPU whenever one is affordable, buys
  everything else the moment it can, and never saves (the rental quota is what stops it).
* **trainfirst** — the naive player who presses Train whenever it is lit (arming it when short)
  before buying anything else: the critic harness's first-timer, in the sim. From the
  Stage 2 arrival naive, greedy and trainfirst all play this way (greedy pressing the
  Infrastructure buttons up to fifteen times a check); its Infrastructure follows the main lot's
  reason (a lot when it is enabled, the cheapest power per MW at "no power", a hall at "no
  room"), as the harness does.
* **racer** and **cautious** (Stage 3 only; the bot before it) — the reasonable bot with one
  temperament changed: the racer adopts neuralese, puts half the copies on research, buys no lab
  after the first and no alignment project, trains three Capability runs to one Efficiency and buries
  the memo; the cautious player buys no grant.

In Stage 3 (`stage3.md` §9.1–§9.2) the bot answers each modal with the careful option (keep it in
English, brief quarterly, enterprise only, report, concede) and brings Slow down when its best reading
of true alignment is under 60 or it has none; it keeps research at 40 % and monitors at 10–15 %, buys
the monitor, every grant but `Let Sage revise the Spec` and then the cards in table order, never
spends more than a run's price on research, red-teams to zero, and feeds a seventh of research to
Alignment work. The first-timer buys everything affordable in screen order, never touches a slider,
and takes the first option of every modal; greedy presses every enabled purchase; trainfirst follows
the lot row's reason, then presses everything enabled once, as the critic harness does.

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
adds the reveal → purchase latency, the densest six minutes of first-time reveals, the exit
state (capability, alignment, Trust, staff, marketing, contracts, revenue, price, GPUs,
incidents), and round 3's measures (`s1x` in `--json`): the run starts and the longest gap between
them, Train blocked by cause (money, GPUs, the quota, the wall, an evaluation month; research and
the lab never), Train disabled with nothing training before the wall, First Datacenter's time on
screen before its purchase and its share of the stage, purchases that delayed the waiting run 10 s
or more and those with no delay printed, research at the cap and the empty Projects panel before the
Training panel, Marketing grey from 5:00, the longest gap between dollar purchases from the card to
the wall, and the console lines in the densest 26 s of the first training cycle. The Stage 2 summary block adds the A1–A19 acceptance numbers
(duration, reveal and mechanic gaps, training runs, the intervals between their starts and the
GPUs each needed, the share of the stage with Train blocked for GPUs alone, governor pulls, modals,
visible cards and queue waits, first power / datacenter / AI assistants, GPU presses before the
Standing order, 5-minute marks), the reveal → purchase latency per card (median and the share bought within 10 s),
the modal answers, the exit state (capability, alignment true / apparent, government, approval,
lead, funds, security level), and the critic's hands-and-eyes measures from 3:00 on (G24–G26): the
share of 2-s checks with no enabled purchase and with two or more distinct ones (lot sizes count
once), the share of the stage after 10:00 spent inside gaps of 30 s or more between the player's
actions, and the longest interval between two model releases (from the arrival).

The Stage 3 block prints the B1–B35 acceptance numbers of `stage3.md` §9.3 with `<-- MISS` beside a
miss: duration and how the stage ended, reveal and mechanic gaps, runs and the intervals between their
starts, the GPUs each needed, capability at the vote, the greyed goal, presses before each
automation, governor pulls and modals, crises with when their mitigation first showed, the reveal →
purchase latency, text rates, the hands measures (nothing enabled, two or more things, click gaps,
the longest capability step), the `REMOVED → GAINED` log, dead grey and repeated lines, and 5-minute
marks (GPUs, power, tasks, revenue, capability, research, autonomy, true and measured alignment, the
rogue share, lead, seats, approval, jobs). `--json` carries it as `s3`.

Stage 3 targets (seeds 1–5 from both Stage 3 presets and from a new game): 40–50 minutes for the bot
(the first-timer 40–55, the racer 28–38, the cautious player at most 64); no first-time reveal gap
over 180 s (the first-timer 210 s); 13–16 runs (the first-timer 8–11), each 30–60 s, starting 150–200
s apart on average; capability 25–30× when the vote opens; no ending the policy did not choose.

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
Round 3 (stage1-round3-fixes.md): five runs for every seed, the first by 6:45, starts ≤ 5:00 apart
for the bot and ≤ 8:00 for a player who buys everything lit; research never blocks Train; Train
disabled with nothing training ≤ 60 s before the wall; First Datacenter on screen ≥ 8:00 before its
purchase and ≤ half the stage, wall to purchase ≤ 4:00. Decision variants (naive, seeds 1–3): best
vs worst modal answers ≥ 3 min apart, red-team to zero vs never ≥ 3 min, price tracked vs never
≥ 5 min.

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
(≤ 48 numbers, ≤ 16 controls, ≤ 250 words: round 2's 38 / 15 / 230 plus round 3's Focus trades,
capacities and printed delays), round 3's rows (the Train row costs money only and arms when short;
a printed delay; First Datacenter's two status lines before and at the wall; the power and quota rows
with their capacity; Focus's three trades and `Next run:`; each event's default listed first; no
`… first` hold), a save → reload during a training run, the transition
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

```sh
node tools/verify/smoke-stage3.mjs [--seed 1] [--dump]
```

Loads `Stage 3 start` and plays it with the reasonable bot through the vote into Stage 4. It checks
the arrival (the narration, the promised research number passed within 30 s, `Approve` in place of
`Release`, no Stage 2 control left); every Stage 3 panel, the grants and their WARNING line, drift,
the readings, the session and the motion; Stage 4's narration and its clean screen; save → reload
mid-run, mid-shipment, mid-event and mid-session with the timers kept; numbers / controls / words at
each 5-minute mark (counted as in `stage2.md` §6.3; controls ≤ 30; numbers held under 130, above the
spec's 65, see `stage3.md` §6.3); the careless start played by the first-timer into Stage 4; the
Pause (signed by the test when the bot is offered it) and the Project (the first-timer with
`refuse`), each with the end screen; 390 px without horizontal overflow; and no page errors. `--dump` prints what it counted.
Screenshots go to `agent-tools/shots/stage3/`.
