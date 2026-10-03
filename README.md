# Takeoff

An incremental browser game about an AI lab racing to superintelligence, in the style of
*Universal Paperclips* (layout, numbers, console) and *A Dark Room* (Developments log, choice
modals). You run OpenMind from July 2025: complete tasks, bill them, rent GPUs, hire researchers,
train and release Sage models, and watch the world react in the margin.

Phase 1 ships the full architecture and **Stage 1 — The Startup** (about 27–31 minutes). Its last
third is the Abilene site ladder — reserve the site, wait out the interconnect queue, build the
substation, break ground — and breaking ground opens a working seed of Stage 2's Infrastructure
panel. The design lives in `docs/design.md` and the stage plan in `docs/stages.md` (where the
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
| `node tools/verify/smoke.mjs` | browser smoke test (after `npm run build`; needs `npm install` in `tools/`) |

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
for rescues), `priceTag`, `canAfford`, `rescue` and `pinned` (both bypass the four-visible cap;
`pinned` is the Abilene ladder). Stage 1 projects cost research or insight, as Paperclips' cost
operations; money is for compute, marketing and the ladder. If the bot should buy it, add the id
to `PROJECT_PRIORITY` in `src/sim/policy.ts`.

**A development** (Developments log): add to `src/data/developments.ts`. It fires on `month`
(months since Jul 2025; use `monthOf(2025, 11)`) or on `trigger(s)`, whichever comes first. It can
also print a `console` line, fire a `crisis` or open a `choice`.

**A choice** (modal): add to `src/data/choices.ts` with `title`, `text(s, ctx)`, two or three
`options` (`label`, `record`, `tooltip`, `cost`, `enabled`, `effect`, `log`) and an optional
`timer` plus `defaultOption`. Open it with `openChoice(s, id, context)` or from a development. The
game does not pause while it is open.

## Dev overlay

Open with the backtick key or `?dev=1`. The fixed bottom-right panel has:

* **Stage 1–5**: load a preset. Stages 1 and 2 are hand-tuned; 3–5 load the Stage 2 preset and say `preset pending`.
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
__game.setAutoplay(on, policy?, holdTransition?)  // policy 'bot' | 'naive'; hold leaves Break ground to you
__game.save()           // write localStorage now
__game.version          // SAVE_VERSION
```

Every button and panel has a stable `id`: `btn-*` for buttons, `panel-*` for panels, `proj-<id>`
for project buttons, `choice-<choiceId>-<n>` for modal options, `dev-*` for the overlay.

## Saving

`localStorage["takeoff.save.v1"]` holds the whole `GameState` as JSON (`SAVE_VERSION` 2; a
version-1 save is migrated on load). The game saves every 15 s,
about 250 ms after any player action, and when the tab is hidden or closed. A `saved.` toast shows
at most once every 30 s. Timers (training, red-team cooldown, choice countdowns) are stored as
remaining seconds, so a reload cannot skip them. There is no offline progress. `migrate()` upgrades
older save versions and fills fields that newer versions added.

## Headless simulator

```sh
npm run sim -- --minutes 45 --seed 1                    # full timeline, bot policy
npm run sim -- --minutes 45 --seed 3 --quiet            # minute lines and the summary
npm run sim -- --minutes 45 --seed 2 --policy naive     # the critic's scripted first-timer
npm run sim -- --minutes 45 --seed 1 --json             # one machine-readable summary line
npm run sim -- --minutes 60 --stop-at-stage 2
```

Two policies play through `actions` only:

* **bot** (default) — a reasonable player: clicks until the first GPU, keeps a power reserve,
  prices to clear production, spends Trust on researchers or lab space by need, buys projects in
  priority order (revenue first, then the Abilene ladder), trains Capability while rented compute
  still teaches the model and Efficiency after, red-teams to zero, releases.
* **naive** — the critic's first-timer: clicks at 4/s until the copies make 8 tasks/s, buys
  anything affordable while keeping one power block in reserve, lowers the price only when the
  backlog exceeds 30 s of production and grows (raises after four near-zero checks, 8 s
  cool-down), answers every modal with its first enabled option, never touches Focus, red-teams
  to zero, and stops the GPU and marketing drip once an Abilene rung is on screen.

Both read a modal for 2.5 s before answering. The output contains one line per minute, one line
per event (BUY, REVEAL, PROJECT shown, MODAL, TRAIN, RELEASE, STAGE, LOG, CHOICE, IDLE RESCUE),
`IDLE GAP` lines, and a summary: Stage 1 milestones, the Abilene ladder timings, the transition
time and capability, `LONGEST REVEAL GAP` (between first-time reveals: a `revealed` flag, a
project first shown, a modal first opened; rescues excluded) with every gap over 120 s,
`LONGEST NOVELTY GAP` (reveals plus TRAIN phase changes and BUYs), Buy Power presses with the
worst 5-minute window, Stage 1 idle rescues (and any at 0 tasks), and soft-lock stretches (60 s+
without production in Stage 1). `--json` prints the summary only, as one line.

Stage 1 targets (seeds 1–5, both policies): transition 25:00–35:00 (bot) / 26:00–40:00 (naive),
longest reveal gap ≤ 180 s, ≤ 60 Buy Power presses and ≤ 10 in any 5 minutes, capability
1.5–1.8× at the transition, ≤ 2 idle rescues and none at 0 tasks, first GPU ≤ 0:20.

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
