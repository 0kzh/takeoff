# Takeoff

An incremental browser game about an AI lab racing to superintelligence, in the style of
*Universal Paperclips* (layout, numbers, console) and *A Dark Room* (Developments log, choice
modals). You run OpenMind from July 2025: complete tasks, bill them, rent GPUs, hire researchers,
train and release Sage models, and watch the world react in the margin.

Built so far: the full architecture, **Stage 1 — The Startup** (about 27–31 minutes) and
**Stage 2 — Scale** (about 37–41 minutes). Stage 1's last third is the Abilene site ladder;
breaking ground opens Stage 2, where OpenMind owns its datacenters: GPU lots, power plants and an
interconnect queue, an AUTO-priced market, data, two training pipelines, rivals, government,
public approval, security and an alignment number nobody can see. `Let Sage-3 write the code`
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
    clock.ts      game date (Stage 1: one month per 4.5 minutes; snaps on transitions)
    endings.ts    ending stubs and end-of-run stats
    rng.ts        mulberry32; the rolling seed lives in the state, so saves and sims replay exactly
    format.ts     numbers, money, durations, dates
  data/           content tables: projects, developments, choices, crises, flavor text, dev presets
  ui/             the only code that touches the DOM
    render.ts     render(state): diffs text into spans, toggles visibility from state.revealed
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

* reveal rules in `engine/stages.ts` (e.g. `business` after the first task, `compute` at $3,
  `research` at the first Trust milestone, `expandLab` when research nears the cap, `projects`
  40 s after `research`),
* engine events (the first training run sets `copies`, the first release sets `focus`),
* project effects (Training Pipeline sets `training`, Reserve the Abilene site sets `site`),
* stage `enter()` functions, which also hide panels (Stage 2 hides `power`, `buyPower`, `compute`,
  `site`).

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
for rescues), `priceTag`, `canAfford`, `expires` (the offer lapses and leaves the screen). A
triggered project joins the reveal queue (`engine/reveal.ts`) and appears 15 s after the previous
one, in table order, while fewer than four are on screen. These skip the wait: `rescue` (also
uncapped, drawn dashed), `pinned` (the stage goal, uncapped), `urgent(s)` (a wall's named fix,
uncapped while it holds), `chain` (the next step of a ladder, at once when there is room);
`sideline` offers drip in but never fill the cap. Stage 1 projects mostly cost research or insight,
as Paperclips' cost operations; money is for compute, marketing, training and the ladder. If the
bot should buy it, add the id to `PROJECT_PRIORITY` in `src/sim/policy.ts`.

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
clicks outside itself, takes keyboard focus when it opens, and Escape takes a timed modal's
default (an untimed one ignores it). From Stage 2 each option prints its effect and cost under
its label (`line` in `data/choices.ts`); a greyed option says what it needs (`needs`, or its
price).

## Dev overlay

Open with the backtick key or `?dev=1`. The fixed bottom-right panel has:

* **Stage 1–5**: load a preset. Stage 2 is the simulator's median Stage 1 state at Break ground,
  run through the arrival; Stage 3 is the median Stage 2 exit (bot, seeds 1–5; seed 4's records)
  run through the Stage 3 arrival; 4–5 load the Stage 3 preset and say `preset pending`.
* **Speed ×1/×5/×20**, plus **Autoplay** (the simulator's bot plays in the browser).
* `?seed=N` in the URL starts a reproducible new game when there is no save.
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
__game.setAutoplay(on, policy?, holdTransition?)  // policy 'bot' | 'naive' | 'greedy'; hold leaves Break ground to you
__game.save()           // write localStorage now
__game.version          // SAVE_VERSION
```

Every button and panel has a stable `id`: `btn-*` for buttons, `panel-*` for panels, `proj-<id>`
for project buttons, `choice-<choiceId>-<n>` for modal options, `dev-*` for the overlay.

## Saving

`localStorage["takeoff.save.v1"]` holds the whole `GameState` as JSON (`SAVE_VERSION` 4; versions
1–3 are migrated on load). The game saves every 15 s,
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
npm run sim -- --minutes 45 --seed 1 --json             # one machine-readable summary line
npm run sim -- --minutes 60 --stop-at-stage 2
npm run sim -- --minutes 60 --preset 2 --stop-at-stage 3   # Stage 2 from its preset
npm run sim -- --minutes 60 --preset 2 --variant modals-worst --json
```

`--preset N` starts from the dev overlay's Stage N preset (2: the Stage 1 median at Break ground;
3: the Stage 2 median exit). `--variant` plays the bot with one Stage 2 decision fixed:
`modals-best` / `modals-worst` (the most careful- or reckless-looking answer to every modal),
`redteam-never`, `slider-N` (copies on research fixed at N %), `safety-0` / `safety-2` (Safety
runs), `gulf-sign` / `gulf-domestic`, `auto-off` (AUTO pricing off on arrival, price never
touched).

Three policies play through `actions` only:

* **bot** (default) — a reasonable player: clicks until the first GPU, keeps a power reserve,
  prices to clear production, spends Trust on researchers or lab space by need, buys projects in
  priority order (revenue first, then the Abilene ladder), trains Capability while rented compute
  still teaches the model and Efficiency after, red-teams to zero, releases.
* **naive** — the critic's first-timer: clicks at 4/s until the copies make 8 tasks/s, buys
  anything affordable while keeping one power block in reserve, lowers the price only when the
  backlog exceeds 30 s of production and grows (raises after four near-zero checks, 8 s
  cool-down), answers every modal with its first enabled option, never touches Focus, red-teams
  to zero, and stops the GPU and marketing drip once an Abilene rung is on screen.
* **greedy** — the naive player without restraint: rents a GPU whenever one is affordable, buys
  everything else the moment it can, and never saves (the rental quota is what stops it).

Both read a modal for 2.5 s before answering. The output contains one line per minute, one line
per event (BUY, REVEAL, PROJECT shown, MODAL, TRAIN, RELEASE, STAGE, LOG, CHOICE, IDLE RESCUE),
`IDLE GAP` lines, and a summary: Stage 1 milestones, the Abilene ladder timings, the transition
time and capability, training runs and the smallest yield any of them kept, modals opened (and the
smallest gap between two that opened on their own), `LONGEST REVEAL GAP` (between first-time
reveals: a `revealed` flag, a project first shown, a modal first opened; rescues excluded) with
every gap over 120 s,
`LONGEST NOVELTY GAP` (reveals plus TRAIN phase changes and BUYs), Buy Power presses with the
worst 5-minute window, Stage 1 idle rescues (and any at 0 tasks), and soft-lock stretches (60 s+
without production in Stage 1). `--json` prints the summary only, as one line.

In Stage 2 the bot follows `stage2.md` §9.1 (modals; free and cheap cards; the binding wall —
power, then room; training once the cluster gives 72 % of the compute wanted; cards in table
order with the next run's money kept; GPU lots until the Standing order; Trust; the slider at
20 %), naive and greedy §9.2 (every affordable card, every enabled Infrastructure button top to
bottom, greedy five times over). The Stage 2 summary block adds the A1–A19 acceptance numbers
(duration, reveal and mechanic gaps, training intervals, governor pulls, modals, visible cards and
queue waits, first power / datacenter / AI assistants, GPU presses before the Standing order,
5-minute marks), the reveal → purchase latency per card (median and the share bought within 10 s),
the modal answers, and the exit state (capability, alignment true / apparent, government,
approval, lead, funds, security level).

Stage 1 targets (seeds 1–5): transition 25:00–35:00 (bot) / 26:00–40:00 (naive) / ≤ 40:00
(greedy), longest reveal gap ≤ 180 s, ≤ 60 Buy Power presses and ≤ 10 in any 5 minutes,
capability 1.5–1.8× at the transition, no run below 0.3 yield, 7–9 modals and never two
automatic ones within 150 s, Substation → Break ground in 2–4 min, ≤ 2 idle rescues and none at 0
tasks, first GPU ≤ 0:20.

## Browser smoke test

```sh
npm run build && (cd tools && npm install) && node tools/verify/smoke.mjs [--policy naive] [--seed 1] [--verbose]
```

Starts its own static server on a free port and drives system Chrome headless (Playwright,
`channel: 'chrome'`) with autoplay and `__game.tick`. It checks the minute-0 screen, the opening
price decision (4 clicks/s at the opening price builds a backlog by 0:30; lowering the price clears
it), the reveal order and staggering, numeric-token counts at minutes 0/1/3/5/10/20/end, a save →
reload during a training run, the transition narration and arrival, no horizontal overflow at
390 px, and no page or console errors through the Stage 2 arrival. Screenshots go to
`agent-tools/shots/stage1/` (gitignored); it exits non-zero on any failure.

```sh
node tools/verify/smoke-stage2.mjs [--policy naive] [--seed 1]
```

Loads the Stage 2 preset and plays it under autoplay to the Stage 3 arrival. It checks the arrival
(five narration lines held whole for 10 s, revenue above the pre-arrival figure 30 s in, no
backlog), no Stage 1 diagnosis line, the Stores rows and a hover breakdown, the capability graph
drawn, every Stage 2 panel appearing, the event panel (an effect line on every option, keyboard
focus inside it, the page behind still clickable, Escape taking a timed default), save → reload
mid-run, mid-interconnect-queue and mid-cooldown, numbers / controls / words on screen at each
5-minute mark against `stage2.md` §6.3, the Stage 3 narration and dev overlay, the Stage 3 preset,
and 390 px without horizontal overflow. Screenshots go to `agent-tools/shots/stage2/`.
