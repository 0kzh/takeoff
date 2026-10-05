# Takeoff — Stage 1 ("The Startup") vs Universal Paperclips — Stage 1 · critic round 3

Reviewer brief: fresh context, no design notes read, live source tree not read. The build under
review is the frozen copy `agent-tools/snapshots/s12-r4/`; its `README.md` was read for the
`window.__game` API and the simulator's policies, its `index.html` for element ids, and its source
only to chase four causes (`ui/render.ts` `renderPower`, `engine/economy.ts` `powerBlock`,
`engine/training.ts` `gpusFor` / `needsDatacenter`, `data/projects.ts` `datacenterAtWall`).
Everything below was measured by driving both games in headless Chrome with the same scripted
"curious first-time player" (`tools/critic/`), then by 50 play-style variants (192 full-stage runs,
three to five seeds each) and 16 scripted probes on Takeoff. A Dark Room was measured for its
first five minutes only, as a third reference for early cadence.

Scope: Takeoff from a new game to the console line `First Datacenter online outside Abilene.`
(Stage 1→2; 26:36–31:34 for the first-timer, 23:30–25:00 for the game's own bot). Paperclips from
a new game toward `Release the HypnoDrones` (not reached in 120 stepped minutes by this policy, so
its transition is played from the harness's cheated fixture, as in rounds 1 and 2).

**Result: Takeoff 8.0, Paperclips 7.7 (round 2: 8.1 and 7.7; round 1: 5.6 and 7.9). Takeoff wins the
fixed rubric again, narrowly. It wins it differently: the opening is now the best five minutes in
either game and the stage's decisions finally move the stage (round 2's biggest gap is largely
closed); what it lacks is its own centrepiece in the middle of the stage — training stops for ten
minutes — and the redesign's hard GPU gate is not what stops it (§8, §9).**

All raw data is in `agent-tools/critic-out/` (`s1r3-*` = rubric runs and canned probes, `s1r3x-*` =
play styles and probes of this round); §13 says how to re-run each.

---

## 1. Method and definitions

### Harness

* `tools/critic/run.mjs <game> <label>`: **phase 1** = 300 s of real wall-clock play, **phase 2** =
  deterministic 2-s game-time steps to the stage end or the cap. A snapshot every 2 s records every
  visible button / project / slider / panel, the console and Developments lines, any modal, the
  count of numeric tokens on screen, and the game's metrics. Two stepped Takeoff runs of the same
  seed are identical (381 events, 266 actions, 814 snapshots; `determinism.mjs`).
* **Policy** (identical shape for every game, unchanged since round 1): mash the main button at 4/s
  until automation makes ≥ 8/s; first automation the moment it is affordable; anything affordable
  is bought, one consumable purchase kept in reserve; price lowered when the backlog exceeds 30 s
  of production and grows, raised after four near-zero checks, 8 s cool-down; a modal is answered
  with its first enabled option; red-team to 0 open issues, then release; once a big-ticket goal is
  visible (any card priced ≥ $10,000 and ≥ 60 s of revenue) the GPU and marketing drip stops.
* A second Takeoff trace uses the game's own **Autoplay** bot (the designers' "reasonable player").
* This round's additions live in one new file, `tools/critic/explore-s1r3.mjs` (no shared file was
  edited; §13): play styles for the redesigned stage, a 1-s-resolution probe of the opening for four
  hands, and a log of the Train row, the Rent GPU row and the First Datacenter card at every check.

### Definitions

Applied identically to both games and unchanged from round 1 §1 and round 2 §1 (`lib/analysis.mjs`
header): reveal, enabled transition, nothing-to-do (loose), novelty gap, reveal gap, greyed-out
goal on screen, cognitive load, first meaningful choice, decision gap, reveal → purchase latency.
Added this round:

* **State of the Train row** at each 2-s check while the Training panel is up: *running /
  evaluating / red-team*, *ready* (button enabled), or blocked — by **GPUs** (the row asks for more
  than are rented, or for more than the cloud will rent), by **research** or by **money** (the
  row's own reason line). "Train not pressable, nothing training" = blocked for any reason.
* **Greyed-goal holes**: the snapshots the coverage measure misses, as stretches.
* **Power meter red**: checks with power under 20% of the meter's scale (the class the game paints
  red), and of those the checks in which Buy Power sold a smaller block than that scale.
* **Words on screen**: word tokens in the page's visible text, dev overlay excluded (console and
  Developments included); for Paperclips the mirror's debug buttons are excluded.

### Where a number is the policy, not the game

* The first-timer **stops renting when First Datacenter appears** (10:44–12:02, at 72–76 GPUs), so
  it never meets the rental quota a greedy player meets at ~14:14 (`greedy`, `wall`).
* The big-ticket rule treats **every** funds-priced card of $10,000 or more as a goal, so it buys
  "Lease the floor upstairs" and "Hire a recruiter" when they appear late in the stage — $158,000
  and $220,000 together in seeds 2 and 4, about four minutes before the datacenter. Those two
  seeds are the 30:26 and 31:34 finishes.
* The policy **spends research the moment anything is affordable**. That is what starves the
  training run in §8; a player who saves for the run finishes 3:44 sooner (`train-priority`). The
  starvation is the policy *and* the game: every card the game offers in that stretch is cheaper
  than the run, and nothing on screen says so.
* Paperclips is played badly by this policy (price driven to $0.03–$0.10, no investing, no quantum
  clicks), so its reveal gaps after 35:38 are longer than a human's. Its first 35 minutes are not
  affected.
* Stepped screenshots catch Takeoff's 0.8-s fade-in half-way (`*.tend.png`); the probes of this
  round wait a second before each shot.
* Loose nothing-to-do for the Autoplay bot is an artifact: it buys inside the tick.

### Runs used

| label | what |
|---|---|
| `s1r3-tk-s1` | Takeoff, 300 s real time + stepped to the stage end (28:18), seed 1 — primary |
| `s1r3-tk-s1-seed1` … `-seed5` | Takeoff, stepped, seeds 1–5 (26:36, 30:26, 27:28, 31:34, 29:34) |
| `s1r3-tk-s1-auto`, `-auto-seed2`, `-auto-seed3` | Takeoff, the game's Autoplay bot, stepped (24:40, 23:30, 24:34; seeds 4–5 via the explorer: 24:16, 25:00) |
| `s1r3-pc-s1` | Paperclips, 300 s real time + stepped to 60:00 — re-run this round; **identical to `pc-s1` and `r2-pc-s1` on every headline number** (one reveal gap 874 s instead of 876 s), so the baselines are reused |
| `pc-s1-accel`, `adr-5min` | Paperclips stepped 120 min; A Dark Room 300 s real time (baselines) |
| `s1r3-transition-*`, `s1r3-softlock-*`, `s1r3-det-*` | canned transition and dead-end probes for both games; determinism |
| `s1r3x-<name>[-seedN]` | 50 Takeoff play styles (all on seeds 1–3, 20 of them on seeds 1–5; two re-run to 150 minutes), 16 Takeoff probes, one Paperclips probe (§6–§8) |

No run of either game raised a page error (192 explorer runs, 10 rubric runs).

---

## 2. Reveal timelines

### 2a. Takeoff — first 5 minutes (real time, `s1r3-tk-s1`, 4 clicks a second)

| t | event |
|---|---|
| 0:00 | `Welcome to OpenMind. Customers are waiting.` · "Tasks Completed: 0" · one button, Complete Task. Nothing else. |
| 0:02 | **Business**: "Available Funds: $ 0.25" · `Task complete. The customer pays $0.25.` |
| 0:04 | **Compute**: Rent GPU (grey) "Cost: $ 6.00" · `GPUs can be rented. Each one runs a copy of Sage.` |
| 0:08–0:10 | Rent GPU affordable → **first automation at 0:08** · "GPUs rented: 1" · `GPU rented. A copy of Sage completes a task every second.` |
| 0:18 | third GPU → "Power ｢￭￭￭￭￭￭￭￭￭￭｣ 980 kWh" and "each copy burns a kWh a task" · `Each task a copy completes burns 1 kWh. The meter drains.` |
| 0:40 | the hand stops (10 GPUs make more than 8 tasks a second; 159 clicks in all) |
| 0:48 | Buy Power (grey, about $20) at 800 kWh · `Power is draining. Copies stop when it runs out.` |
| 0:56 | Buy Power and Rent GPU both affordable |
| 1:18 | "Unsold tasks", **lower / raise** "lower: more tasks sell, each earns less", "Price per Task: $ 0.25", "Customers buy 8.6 of the 14 tasks Sage makes a second. Unsold tasks pile up." · `Sage makes more than customers buy at $0.25. Unsold tasks are piling up.` |
| 1:54 | 20th GPU · `Power can now be bought 10,000 kWh at a time.` — the power meter drops from eight cells to one and turns red (§4) |
| 2:02 | Marketing (grey) "Cost: $ 100.00", "Avg. Rev. per sec" · `Marketing brings more customers at every price.` |
| 2:06 | the policy's first price cut |
| 2:32 | **Research**: "Trust: 3", "Next Trust at 3,000 tasks", Hire Researcher "(costs Trust)", "Researchers: 1", "Research ｢･･････････｣ 6" · `Trust earned: 3. Each one hires a researcher.` |
| 3:12 | **Projects**: one card, Better Prompting (750 research) "Rewrite the prompts. Copies 25% faster." |
| 3:32 | **Developments** column and the date, five world lines at once |
| 4:12 | Blue-sky Research (1,000 research) · 4:14 `Insight unlocked. It accrues while research is full, and with every release.` · 4:30 `Research at capacity: 1,000. Insight accrues.` |

Policy actions in those 5 minutes: 159 clicks, 43 GPUs, 8 Buy Power presses, 16 price cuts, 6 hires,
2 projects.

### 2b. Takeoff — whole stage (`s1r3-tk-s1`, 28:18; cross-checked against seeds 1–5 and Autoplay)

| t | event |
|---|---|
| 5:12 | Expand Lab (grey, Trust 0) and Grid Contract (2,000 research, grey) · `The lab is full at 1,000. Expand Lab makes room for more research.` / `Research at capacity. Grid Contract needs 2,000. Expand Lab with the next Trust.` |
| 6:22–6:40 | Trust +1 → Expand Lab → Grid Contract → "Grid Contract: ON buys as needed" (manual power ends after 14 presses) |
| 7:12–7:14 | Training Pipeline (2,000 research) → **Training panel**: "Train Sage-1.1 Cost: $288, 2,000 research / Needs 10 GPUs for 0:45 / *money — about 0:40*" |
| 7:42–7:44 | Seed round (free, +$5,000, +2 Trust) → first run: `Training Sage-1.1 on 10 GPUs; 40 keep serving.` |
| 8:28–8:50 | `The cloud will rent OpenMind 80 GPUs and no more.` (quota meter) · evaluation (six benchmark bars, four reviewer cards) · Red-team / "Release (issues open)" · release → **Focus row** (8:46) · modal *A Bridge Round* (8:50) — six new things in 22 s |
| 9:12–11:12 | a card every 30 s: Hire an evals team, Public API, Launch demo video, Bulk GPU lease, Sage writes Sage |
| 10:56 | second run (15 GPUs) · 11:26 modal *Open Weights* · 12:30 release |
| 12:02 | **First Datacenter ($300,000)**, pinned, grey — funds $1,050, revenue $35/s |
| 13:36 | third run (30 GPUs) · 14:02 modal *A Reporter Calls* · 14:50 release (Sage-1.3, 1.42×) |
| 13:02–20:02 | Closed-loop cooling ($10,000), Power purchase agreement, Dynamic pricing (16:04: lower / raise leave the screen), Usage-based pricing, tax abatement (1 Trust; the card drops to $250,000), Series A (free), Enterprise sales team, Distributed training, sound wall, **Custom model contract** (19:32, repeatable; "Contracts: $ … per sec" joins Business), Alignment team · modals *An Open Letter* (16:38), *A Better Offer* (19:14) |
| 14:50 → 26:10 | **the Train row reads "research — about 1:10" (anywhere from 0:01 to 1:56); no run for 11 minutes 20 seconds** while 13 research cards (98,864 research) are bought |
| 20:02 → 24:06 | 244 s with no new card; the only reveal is the modal *The Leaderboard Wants Sage* (21:50) — the longest reveal gap of the stage in 5 of 6 traces (136–144 s) |
| 24:06–25:44 | Renewal season, Press release, Hire a recruiter ($39,000), Agent mode |
| 26:12 | fourth run (50 GPUs) · 26:28 modal *Can I try something?* · 27:38 release (1.58×) → "Needs 80 GPUs. 75 rented. Rent 5 more." |
| 28:18 | First Datacenter ($250,000) → Stage 2 |

Shape of the stage in all six first-timer traces: panels at 0:02, 0:04, 2:32, 3:12, 3:32, 7:14 and
none after; 29–34 cards (one a minute until the Training panel, then one every 30 s, median gap
30–32 s, longest 176–248 s); six calendar events 2:36 apart (8:50, 11:26, 14:02, 16:38, 19:14,
21:50) plus the training gamble in 4 of 6; training runs at 7:44, 9:46–10:58, 11:50–13:36 and then
22:28–26:14; First Datacenter on screen from 10:44–12:02 (56–62% of the stage); 4 runs, exit
capability 1.55–1.61×. Autoplay: five runs (7:38–7:42, 11:10–12:14, 13:36–14:40, 16:26–17:38,
20:14–21:46), the wall at 21:48–23:32, the purchase 44–126 s later, 1.72–1.78×.

### 2c. Paperclips — first 5 minutes (real time, `s1r3-pc-s1`)

| t | event |
|---|---|
| 0:00 | Business (Funds, Unsold Inventory, lower / raise, "Price per Clip: $ .25", "Public Demand: 32%", Marketing $100 grey) and Manufacturing (Clips per Second, Wire 1,000 inches, Wire grey) — 7 elements, 10 numbers |
| 0:32 | AutoClippers ($5) appears and is affordable → first automation 0:32 |
| 0:44 | first price cut (unsold 157 at 32% demand) |
| 1:46 | Wire and AutoClippers both affordable; 1:48 `500 clips created in 1 minute 46 seconds` |
| 3:18 | `1,000 clips created in 3 minutes 16 seconds` |
| 4:54 | **Computational Resources + Projects in one beat**: Processors, Memory, "Trust: 2", "+1 Trust at: 3,000 clips", three projects |

Nothing new appears between 0:32 and 4:54 (262 s). 879 clicks (the hand stops at 3:40).

### 2d. Paperclips — rest of Stage 1

Unchanged from round 2 §2d (`r2-pc-s1` ≡ `s1r3-pc-s1`, `pc-s1-accel`): a project every 99–106 s
from 4:54 to 35:38; panels at 33:32 (Investments), 35:38 (Quantum Computing), 52:36 (Strategic
Modeling); 874 s without a new element from 35:38; 2,516 s from 70:12; Trust 26 of 100 at 120:00.

### 2e. A Dark Room — first 5 minutes (`adr-5min`)

0:00 `the room is freezing.` / light fire → 0:02 stoke fire → 0:32 `a ragged stranger stumbles
through the door` → 0:46 stores, "A Silent Forest" → 0:48 gather wood → 2:04 builder → 2:06 trap,
cart → 3:00 event *The Mysterious Wanderer*. 12 reveals, 21 distinct lines, 1 number on screen.

---

## 3. The opening, second by second

`explore-s1r3.mjs opening` (`s1r3x-opening.md`, `s1r3x-slow-opening.md`, `s1r3x-long-opening.md`)
plays the first three to seven minutes at one-second resolution for four hands; purchases are the
first-timer's, made at its 2-s checks.

| beat | what appears | the console says | slow (0.5/s) | steady (1.5/s) | first-timer (4/s) | fast (10/s) |
|---|---|---|---|---|---|---|
| 0 | "Tasks Completed: 0", Complete Task | `Welcome to OpenMind. Customers are waiting.` | 0:00 | 0:00 | 0:00 | 0:00 |
| 1 | Business: "Available Funds: $ 0.25" | `Task complete. The customer pays $0.25.` | 0:02 | 0:01 | 0:01 | 0:01 |
| 2 | Compute: Rent GPU (grey) "Cost: $ 6.00" — at $3 | `GPUs can be rented. Each one runs a copy of Sage.` | 0:24 | 0:08 | 0:03 | 0:02 |
| 3 | "GPUs rented: 1" | `GPU rented. A copy of Sage completes a task every second.` | 0:49 | 0:17 | 0:07 | 0:05 |
| 4 | "Power ｢￭￭￭￭￭￭￭￭￭￭｣ 973 kWh", "each copy burns a kWh a task" — third GPU | `Each task a copy completes burns 1 kWh. The meter drains.` | 1:09 | 0:35 | 0:17 | 0:09 |
| 5 | Buy Power (grey) "Cost: $ 19.57" — at 800 kWh | `Power is draining. Copies stop when it runs out.` | 1:48 | 1:06 | 0:47 | 0:39 |
| 6 | "Unsold tasks", lower / raise + hint, "Price per Task", the billing sentence | `Sage makes more than customers buy at $0.25. Unsold tasks are piling up.` | 2:18 | 1:36 | 1:17 | 1:09 |
| – | 20th GPU: the power meter rescales to one red cell | `Power can now be bought 10,000 kWh at a time.` | 3:03 | 2:21 | 1:57 | 1:43 |
| 7 | Marketing (grey) "Cost: $ 100.00", "Avg. Rev. per sec" | `Marketing brings more customers at every price.` | 3:03 | 2:21 | 2:02 | 1:54 |
| 8 | Research panel (Trust 3, Hire Researcher, the research meter) | `Trust earned: 3. Each one hires a researcher.` | 3:37 | 2:51 | 2:32 | 2:24 |
| 9 | Projects panel, one card | (the card: "Rewrite the prompts. Copies 25% faster.") | 4:17 | 3:31 | 3:12 | 3:04 |
| 10 | Developments column, date | (three to five world lines at once; by the clock, 3:30) | 3:31 | 3:31 | 3:32 | 3:31 |
| 11 | Expand Lab (grey), Grid Contract (grey) | `The lab is full at 1,000…` / `…Expand Lab with the next Trust.` | 6:17 | 5:31 | 5:12 | 5:04 |

On screen at the same seconds (numbers / controls / panels):

| t | Takeoff, steady hand | Takeoff, first-timer | Paperclips | A Dark Room |
|---|---|---|---|---|
| 0:00 | 1 / 1 / 0 — one button | 1 / 1 / 0 | 10 / 5 / 2 — both panels, price, demand %, wire | 0 / 2 / 0 — "light fire" |
| 0:30 | 5 / 2 / 2 — funds, Rent GPU, 2 GPUs | 7 / 2 / 2 — + power meter | 10 / 5 / 2 (AutoClippers at 0:32) | fire lit, stoke; the stranger at 0:32 |
| 1:00 | 7 / 2 / 2 — + power meter | 8 / 3 / 2 — + Buy Power | 12 / 6 / 2 | 1 / 3 / 1 — forest, gather wood, stores |
| 2:00 | 12 / 5 / 2 — + price | 16 / 5 / 2 | 15 / 6 / 2 | builder arrives 2:04; trap, cart 2:06 |
| 3:00 | 22 / 7 / 3 — + Marketing, Research | 20 / 7 / 3 | 15 / 6 / 2 | 3 / 8 / 2; first event at 3:00 |
| 5:00 | — | 22 / 7 / 5 | 30 / 11 / 4 (the 4:54 lump) | 1 / 5 / 2 |

**Is each new thing explained when it appears?** Yes, eight times out of eight in the first three
minutes: every beat is one element and one console sentence that says what it is and what it does
to the thing before it ("Each one runs a copy of Sage", "burns 1 kWh", "Copies stop when it runs
out", "lower: more tasks sell, each earns less"). No beat in the first five minutes adds more than
4 numbers and 2 controls (Paperclips' 4:54 adds 12 and 5 with one line, `Trust-Constrained
Self-Modification enabled`). Beats 4–8 keep at least 30 s between them at every click rate. This is
the best-taught opening of the three games.

**Does anything appear before the player can understand it?**

* *The power meter at the 20th GPU.* `Power can now be bought 10,000 kWh at a time.` is printed while
  Buy Power still reads "Cost: $ 18.14" and still sells 1,000 kWh (the player has $28; a 10,000 kWh
  block costs about $180). The meter is rescaled to the block the player cannot buy: "Power
  ｢￭￭￭￭￭￭￭￭･･｣ 783 kWh" becomes "Power ｢￭･････････｣ 744 kWh", in red, in one second, and stays red for
  most of the next five minutes (§4, §6.1).
* *Research before it has a use.* For 40 s (2:32–3:12) the Research panel shows Trust, a hire
  button and a filling meter and nothing to spend research on; the line says what Trust buys, not
  what research is for. Paperclips' Processors and Memory are worse (no description at all).
* *The Developments column* arrives with five entries (about 60 words) in one beat at 3:32; words on
  screen go 101 → 155 in the minute.

**Is anything a player needs withheld too long?**

* *Expand Lab.* The lab fills at 2:58 (four researchers, 1,000 research, 26 s after the panel
  appears). The only Trust sink on screen until 5:12 is Hire Researcher and the console says `Each
  one hires a researcher.` / `Trust +1. Hire a researcher.`, so the first five Trust all go to
  hires; Expand Lab then appears with Trust at 0 and the next Trust is 62–70 s away. Measured in
  every seed: research pinned at the 1,000 cap for 168–174 s between 2:30 and 7:00, the Projects
  panel on screen with **no card on it for 104 s of the first five minutes** (116 s in all), no
  non-drip decision for 80–90 s (4:46–6:22, the longest decision gap of the stage after the
  opening), and — because the Grid Contract costs 2,000 research the lab cannot hold — 13 Buy
  Power presses between 2:08 and 6:32, one every 18 s by minute 5 (round 2: 6 presses in the stage).
* *The price lever for a slow hand*: 2:18 at one click every two seconds (1:09–1:36 otherwise);
  until the GPU card appears at $3 that hand has one button and a dollar figure for 24 s. That is
  the hand's pace, not a fault; the reveals are tied to progress, as they should be.
* *A goal in the first minute* (the rubric's greyed-goal row): see §5 (e).

**Against the references.** Paperclips puts ten numbers, five controls and its first lever on
screen at second 0 and then shows nothing new for 262 s; A Dark Room has a new noun every 30–60 s
with one number. Takeoff now sits between them and beats both on explanation: 1 number at 0:00, 8 at
1:00, 20–22 at 3:00 (Paperclips 10 / 12 / 15), a new mechanic about every 30 s for three and a half
minutes, each with its sentence.

---

## 4. On the screen

* **Minute 0** (`s1r3-tk-s1.t0.png`): a black five-line console, "Tasks Completed: 0", one button.
  Paperclips' minute 0 is two panels and ten numbers; A Dark Room's is one button and two lines.
* **Minutes 1–3** (`s1r3x-opening-r1.5-t*.png`): one column grows downward, one row at a time.
  The first decision is stated in a sentence — "Customers buy 8.6 of the 13 tasks Sage makes a
  second. Unsold tasks pile up." — with a hint beside the buttons, where Paperclips shows "Public
  Demand: 32%". The sentence has four states and each names the move: "…Unsold tasks pile up.",
  "Customers buy 52 a second; Sage makes 48. The pile shrinks.", "Every task sells. Customers would
  pay more.", "Nobody buys at $4,254.83."
* **The meters** (ten cells, exact figures in the tooltip): three of the four read at a glance.
  "Research ｢￭￭￭￭￭￭￭￭￭￭｣ 1,000" is unmistakably full; "GPUs rented ｢￭￭￭￭￭￭￭￭･･｣ 60" arrives with
  `The cloud will rent OpenMind 80 GPUs and no more.`, twenty GPUs before the limit; the Train row's
  "｢￭￭￭￭￭￭￭￭￭･｣ Needs 75 GPUs. 72 rented. Rent 3 more." is the clearest blocked-button message in
  either game. They also keep numbers off the screen (19–22 at 5:00 against round 2's 28).
  **The power meter is wrong for five of the first seven minutes**: from the 20th GPU (1:36–1:56) to the
  first 10,000 kWh block the player can afford (6:30–6:38) it shows one or two red cells —
  284–298 s in every first-timer trace and 284–292 s for the game's own bot — while every Buy
  Power press adds a tenth of a cell (`s1r3-tk-s1.t3.png`, `.t5.png`, `s1r3x-opening-r1.5-t141.png`).
  Cause: `renderPower` scales the meter to `fleetPowerBlock` (10,000 kWh from 20 GPUs) while Buy
  Power sells `powerBlock`, which falls back to 1,000 kWh when funds are short.
* **Minutes 5–7**: the weakest screen of the stage — a full research bar, a red power meter, a
  "Projects" heading with nothing under it (`s1r3-tk-s1.t5.png`).
* **Minutes 10–25** (`.t10/.t20.png`, `s1r3x-shots-t0900.png`): four columns (Developments ·
  clicker, power, Business, Compute · Research, Projects · Training). Aligned and legible; each card
  is a title with its price and one sentence stating the effect ("Bill per token. Demand +50% at any
  price."). It is a dashboard: 34–41 numbers, 14–15 controls and 245 words at 10:00, 44–48 / 20 / 305
  at 15:00, against Paperclips' 29 / 11 / 110 and 30 / 12 / 120. Seven cards are on screen at 15:00,
  all grey: six priced in research, and the datacenter.
* **Events** (`s1r3x-shots-modal1…6.png`): a bordered panel, two short paragraphs, a timer line
  that names its default ("59 s — then: wait for a real round"), and each option a two-line button —
  label, then effect and cost: "take the bridge / +$15,000 now · −1 Trust · contracts 30% smaller". A
  greyed option says what it needs ("offer equity / needs 1 Trust"). The page behind stays live
  (real mouse clicks pass), keyboard focus enters the panel, Tab reaches the options, Escape takes
  the default. The panel is not modal, but it is opaque: at 1280 px it sits on Hire Researcher,
  Expand Lab, one or two cards and the left edge of the Training panel — the Red-team button during
  the first event (8:50), Train during the second (`s1r3x-event-keys.md`); at 390 px it covers the
  console, Complete Task and the power row.
* **Training** (`s1r3x-shots-training.png`, `-evaluating.png`, `-redteam.png`): "Training on 10
  GPUs — 0:43 left. They serve no customers until it is done." states the cost of a run; the
  evaluation (six bars fill, four reviewer cards turn over, then "Capability 1.11×") is still the
  best-staged reveal in the stage.
* **Focus** (`s1r3x-focus-row.md`): one line under the three buttons for the selected focus only —
  "The most capable next model (about +17%)." / "Copies per GPU ×1.25; a smaller capability gain." /
  "Fewer red-team issues, now and on every later run." The other two are tooltips until clicked.
* **Wordiness**: 18 / 65 / 71 / 90 / 101 / 162 / 189 / 245 / 305 / 279 / 260 words on screen at
  0:02 / 0:30 / 1 / 2 / 3 / 5 / 7 / 10 / 15 / 20 / 25 minutes; Paperclips 29 / 29 / 35 / 40 / 40 / 82 /
  91 / 110 / 120 / 129 / 128. New text: 3.6–3.9 console lines and 1.3–1.5 Developments entries a
  minute (4.3–5.1 console lines a minute between 3:00 and 10:00; 4.9–5.1 for the bot) against
  Paperclips' 1.6. A training run prints four structural lines, one per red-team pass and one or
  two of flavour (round 2: three or four); the first run's 92 seconds hold 16 console lines.
* **Reveals** fade in over 0.8 s; panels are announced in the console, cards arrive silently, the
  stage goal has a heavier border and, at the wall, a left bar and the words "— needed".
* **Paperclips** (`s1r3-pc-s1.t1/.t10.png`): two columns, three grey projects, nothing explained;
  from 4:54 to 33:32 the screen does not change shape. Calmer and plainer.
* **Transition** (`s1r3x-shots-pre-datacenter.png`, `-arrival-12s.png`, `-arrival-60s.png`,
  `s1r3x-arrival.md`): before, the pinned card "First Datacenter ($250,000) / 1,000 GPUs of our own
  at Abilene. Stop renting."; after, five console lines two seconds apart, each naming one change
  with its number, whole on screen for 24 s (until the player's own next purchase prints a line); a
  "stores" box and an Infrastructure panel fade in; "Avg. Rev. per sec" goes $1,634 → $2,218 in 10 s
  with nothing bought and $3,260 by +60 s. Paperclips
  (`s1r3-transition-paperclips.*.png`): three lines, Business and Investments gone, "Clips per
  Second: 0", one grey project.
* **390 px** (`s1r3x-mobile-shots-*.png`, `s1r3x-mobile.*`): one column, Training above Projects
  above Business, no horizontal overflow in a whole stage, 1.0–2.2 screens tall, buttons 36 px tall
  (round 2: 19 px), the "saved." toast hidden. The run is identical to the desktop control.
* No clipped card in 29 cards (`s1r3x-shots.md`).

---

## 5. Rubric

Scores 1–10, higher is better, same scale as rounds 1 and 2. Evidence beside each score.

| Rubric item | Takeoff | Paperclips | A Dark Room (5 min only) |
|---|---|---|---|
| **(a) Time to first meaningful choice** | **8** — first automation 0:06–0:08 (0:17 at 1.5 clicks/s, 0:49 at 0.5); two affordable purchases (Buy Power, Rent GPU) at 0:52–0:58 with the meter's stake already explained; the price lever arrives at 1:09–1:36 (2:18 for the slowest hand) with its situation in a sentence and a hint; the policy's first cut at 1:48–2:14 (its rule waits for 30 s of backlog). The lever now weighs: never touching it ends a 29-minute stage 6:12 later (five seeds; 11:51 later on three seeds if Dynamic pricing is also refused) | **8** — everything on screen at 0:00; first automation 0:32; first price cut 0:44 at "Public Demand: 32%"; wire-vs-clipper 1:46. Earlier and heavier (the never-pricer has 19× fewer clips at 40:00, round 2), and unexplained | 5 — 0:48 (gather wood vs stoke); no trade-off until 2:06 |
| **(b) Seconds with nothing to do** | **8** — first 5 min, loose: 18–34 s (6.0–11.3%), longest stretch 4–6 s. Stage: 20–38 s (1.1–2.0%). Longest reveal gap 126–144 s, longest novelty gap 68–110 s, 3–5 decision gaps over 60 s per stage (the longest after the opening 80–90 s). Held below round 2's 9 by two waits the loose measure cannot see: the lab pinned full for 168–174 s with an empty Projects panel in minutes 3–6½, and the Train row unpressable with nothing training for 822–1,132 s per stage (§8) | **7** — first 5 min, loose: 62 s (20.7%), one 32-s stretch. Stage: 100 s (2.8%). Reveal gaps of 262 s (0:32 → 4:54), 874 s and 2,516 s; 11 over 120 s in the first hour; 23 decision gaps over 60 s in 60 minutes | n/a — no automation; longest novelty gap 120 s |
| **(c) Cognitive load & progressive disclosure** | **7** — numbers 3 / 8 / 20–22 / 19–22 / 34–41 / 42–46 / 44–46 at 0/1/3/5/10/20/end (peak 54 with an event open); controls 1 / 3 / 7 / 7 / 14–15 / 17–18 / 17; panels 1 / 2 / 3 / 5 / 6 / 6 / 6; words 18 / 71 / 101 / 162 / 245 / 279. The first five minutes are lighter than Paperclips' and taught one element at a time (largest beat +4 numbers, +2 controls). From minute 10 it is the heavier screen by a quarter to a third in numbers and controls and 2.2× in words, with three times the text per minute; the half-minute 8:28–8:50 stacks the quota line, the first evaluation, Red-team, Release, the Focus row and the first event; one meter lies for five minutes | **7** — numbers 10 / 12 / 15 / 30 / 29 / 28 / 48 (60 min); controls 5 / 6 / 6 / 11 / 11 / 12 / 20; panels 2 / 2 / 2 / 4 / 4 / 4 / 7; words 29 / 35 / 40 / 82 / 110 / 129; 1.6 console lines a minute. One lump (4:54: +12 numbers, +5 controls, +2 panels), no explanation of Processors or Memory, otherwise one element at a time | 10 — 1 number, ≤ 8 buttons |
| **(d) Cadence of reveals** | **8** — a new mechanic about every 30 s for 3½ minutes (0:02, 0:04, 0:10, 0:18, 0:48, 1:18, 2:02, 2:32, 3:12, 3:32); six panels by 7:14, none after; 29–34 cards, one a minute then one every 30 s (median gap 30–32 s, longest 176–248 s at 20:02 → 24:06); an event every 2:36 from 8:50 to 21:50; 1–2 reveal gaps over 120 s per run, none over 144 s. Held at 8 because after 8:50 the stream is cards and events only, 9–12 of the 31–35 cards are affordable the moment they appear and 11–14 of the 25–30 bought are bought within 10 s | **7** — panels at 0:00, 4:54, 33:32, 35:38, 52:36 (each a new mechanic); a project every 99–106 s from 4:54 to 35:38, then 874 s without one; nothing at all between 0:32 and 4:54 | 8 — a new noun every 30–60 s for three minutes |
| **(e) Greyed-out goal always on screen** | **8** — 68.7–71.3% of snapshots in the first 5 minutes, 94.4–95.1% of the stage (Autoplay 63–67% / 92–93%). Every miss is before 2:02: 86–94 s in six traces — the first 4 s, 2–6-s flickers while the next GPU is affordable, and one stretch of 44–70 s (0:52/1:14 → 2:02) in which Buy Power and Rent GPU are both affordable and nothing on screen is out of reach. 100% from 2:02; the stage goal is pinned from 10:44–12:02. The measure penalises the deliberate one-at-a-time opening; judged on the screen, the player always has a purchase to make but for about a minute has nothing to want | **10** — 100% (Marketing $100 and Wire grey from second 0; "+1 Trust at" from 4:54) | 8 — 84% |
| **(f) Clarity of stage transition** | **9** — announced by its own pinned card ("…Stop renting."); five console lines 2 s apart, each one change with its number (`First Datacenter online outside Abilene.` / `The 72 rented GPUs go back. Deposit returned: $120,000.` / `1,000 Nimbus G4s on 5 MW. Each MW powers 1,000 GPUs; power is bought in megawatts now.` / `Tasks per second ×14: the copies run on hardware OpenMind owns.` / `Prices set themselves from here. Marketing ends; the market cards widen the market now.`), whole on screen for 24 s; Developments names what was retired; revenue rises at once (+36% at +10 s, ×2 at +60 s) — round 2's contradiction is gone; one to three affordable purchases on arrival; a reload half a second in loses nothing. Not 10: the $120,000 deposit is never mentioned before it is returned, the next run's price goes $18,229 → $60,854 without a line, and in 4 of 5 first-timer seeds the reason for the datacenter (a run the cloud cannot train) is never shown | **8** — three lines at once; Business and Investments deleted, "Clips per Second: 0", one grey project and nothing to buy for about a minute. Unmistakable; explains less, strands the player longer | n/a |
| **(g) Soft-locks found** (count / severity) | **8** — 0 hard locks in 10 rubric traces, 192 play-style runs and 23 probes (16 of this round, 6 canned dead ends, the transition). Power-out, absurd price, full lab and open issues each get a line that names the fix and repeats; reload restores state and screen exactly at 11 awkward moments and when reloading every 14 s for a whole stage; a stage at 390 px is identical. Found (§6): a meter that signals an emergency that is not one for five minutes; a wall line that names a fix the player cannot buy (hire-only, ×25); calendar events that ignore the player's state (a $15,000 bridge round offered at 0 tasks); a wait of up to 12 minutes at the wall for a low earner; no price ceiling ($22.8M) | **7** — 0 hard locks; wire-out rescued at +0 s. Three dead ends, all silent: absurd price → zero sales with no line; every Trust into Processors → nine unaffordable projects and a silent console for 26 minutes; reload loses up to 25 s | n/a |

Overall (unweighted mean): **Takeoff 8.0 / Paperclips 7.7** (56 and 54 of 70).

Against round 2 (57 of 70) Takeoff is one point down on the same scale: +1 on load (c) and +1 on
the transition (f), −1 on nothing-to-do (b), −2 on the greyed goal (e), the last of them the stated
price of the one-at-a-time opening. The rubric has no row for what improved most this round —
whether the player's decisions matter (§7).

---

## 6. Soft-locks, dead ends and the play-style table

### Takeoff — canned probes (`s1r3-softlock-takeoff.md`)

1. **Power 0** (everything on GPUs: 0 kWh at 1:36 with 21 GPUs and $8.76). Complete Task stays
   enabled; `Power is out. The copies have stopped. Buy Power starts them.` / `No power, and no
   money for more. The cloud provider may extend credit.`; Projects opens early with "Ask the cloud
   provider for credit (1 Trust)" at +2 s; Buy Power affordable again at +16 s. **Handled.**
2. **Idle on a new game**, 3 minutes: nothing happens. **Handled** (at 10 minutes an event opens: see
   "the event calendar" below).
3. **Price ×200** at 3:00 → $2,742.71 (5% steps now): "Nobody buys at $2,742.71." on the billing
   line and `Nobody buys at $2,742.71: the copies make 30 a second. Lower the price.` every 90 s;
   200 lowers restore $0.16. **Diagnosed, still not capped** (400 raises from the floor: $22.8M).
4. **Ignore research for 15 minutes**: Trust 13 unspent; `Research at capacity. Chain-of-thought
   needs 2,500. Expand Lab to hold more.` every two minutes, the card named moving on. **Named.**
5. **Release with open issues**: modal *Ship With Open Issues?* with the stakes on the buttons
   ("release anyway / incidents in 2–4 min: each pauses the contracts 1:30 · no Trust" · "keep
   red-teaming / a clean release: +1 Trust"); `Sage-1.1 released. Demand up. No Trust: 4 open issues
   shipped.`; at +142 s and +202 s `Incident: a jailbreak for the new model is trending. Demand down
   40% for 1:30.` / `Traced to an issue shipped in Sage-1.1.` / `The board asks what happened. Trust
   −1.` **Handled, and it costs.**
6. **Reload mid-training**: 26%, 34 s remaining before and after. **Exact.**

### Takeoff — play styles (`s1r3x-table.md`, `s1r3x-<name>.explore.md`; seeds 1 / 2 / 3)

| play style | Stage 1 ends | exit state | what the screen says |
|---|---|---|---|
| first option of every modal (the rubric policy) | 26:36 / 30:26 / 27:28 | 1.55–1.61×, 72–75 GPUs, 4 runs | — |
| last option of every modal | 31:22 / 31:50 / 31:46 | 1.52–1.57× | — |
| best-looking option (waits for greyed ones) | 29:44 / 29:10 / 29:18 | 1.55–1.59× | — |
| worst-looking option | 36:48 / 36:22 / 33:04 | 1.42–1.58×, 12–14 researchers, 3–4 runs | `Three of the signatories resign. Researchers −3.` / `Two researchers leave for a larger lab. Their bank follows them: one contract fewer.` |
| never answers a modal | 31:52 / 32:20 / 31:56 | 1.54–1.62× | each takes its timer default (19–60 s) |
| never red-teams, ships at once | 32:58 / 32:06 / 30:50 | 1.50–1.59×, 4–7 incidents | `No Trust: 4 open issues shipped.`, `Demand down 40% for 1:30`, `Trust −1` ×7 |
| Focus: Capability / Efficiency / Safety always | 28:10 mean · 28:14 / 26:42 / 27:26 · 29:18 / 28:56 / 28:46 | 1.55–1.61×, 4 runs · 1.42–1.49×, 7 runs · 1.49–1.53×, 7 runs, alignment 81 instead of 51 | — |
| rents greedily, never saves | 29:02 / 34:54 / 29:34 | 120 GPUs | 14:14 "the cloud rents no more" / `The provider has no more GPUs to rent. Owning compute is the way past this.` |
| never touches the price (buys Dynamic pricing) | 36:06 / 36:24 / 34:20 | 1.62–1.72×; pays $75,000 at the wall | `Sage makes more than customers buy at $0.25. Lower the price or buy Marketing.` ×8; then 5–9 minutes at the wall |
| never touches the price, refuses Dynamic pricing | 38:24 / 41:58 / 39:40 | revenue $101–107/s at the exit | the same, then 10–12 minutes at the wall |
| never buys Marketing | 30:28 / 33:50 / 32:52 | marketing level 6–9 | — |
| power only when the meter reads 0 | 27:08 / 26:52 / 26:42 | — | Grid Contract takes over at ~6:40 |
| …and never the Grid Contract | 27:44 / 29:26 / 32:16 | 28 presses | `Power is out. The copies have stopped. Buy Power starts them.` ×29 |
| never buys the contract card | 27:04 / 28:24 / 25:44 | 1.60–1.76×, 4–5 runs | — (faster than the control) |
| never buys a funds-priced side offer | 26:50 / 28:22 / 27:40 | 1.44–1.57× | — |
| never takes a free card (Seed, Series A) | 30:24 / 29:34 / 29:02 | pays $75,000 at the wall | — |
| never trains | > 60:00 (not by 150:00) | 1.00×, revenue $37/s | Train Sage-1.1 enabled for 143 minutes; no line asks for it |
| presses Train whenever it is enabled | 26:36 / 31:06 / 28:12 | 4–5 runs | identical to the control in seed 1: Train is almost never enabled (§8) |
| puts the run first (saves research and money for it) | 24:04 / 24:42 / 25:08 | 1.62–1.77×, 4–5 runs | the wall: `Sage-1.5 needs 870 GPUs. The cloud will rent 80. Build the First Datacenter.` |
| never rents past the first run's 10 GPUs | 44:34 / 46:58 / 44:50 | 1.26–1.28×, 2 runs | "Needs 20 GPUs. 10 rented. Rent 10 more." for 25 minutes, Rent GPU enabled at $7.59 throughout |
| stops renting when the Training panel appears | 31:36 / 31:20 / 28:42 | 48–49 GPUs | "Needs 50 GPUs. 48 rented. Rent 2 more." for 5–13 minutes |
| every Trust on Hire Researcher | > 60:00 | 33 researchers, lab 1, no Training panel | item 2 below |
| every Trust on Expand Lab | > 60:00 (68:02 in a longer run) | 1 researcher (4 once a recruiter is hired), 39–40 rooms, 2–3 runs | `One researcher cannot fill 17 rooms. Hire a researcher with the next Trust.` every ~5 min |
| Trust never spent | > 60:00 | Trust 33 | `Research at capacity. … needs 7,000. Expand Lab to hold more.` every 2 min |
| 10 clicks a second / one click every 2 s / 1.5 a second | 29:14 / 26:40 / 26:06 · 32:04 / 28:44 / 27:26 · 28:24 / 30:40 / 31:52 | as the control | within seed noise |
| never rents a GPU · never buys a card | > 60:00 | — | each has its enabled button in view |
| 390 × 844 viewport | 26:36 / 30:26 / 27:28 | identical to the control | no overflow |
| page reloaded every 60 s · every 14 s | 26:36 / 30:26 / 27:28 (both) | identical to the control | — |
| the game's Autoplay bot | 24:40 / 23:30 / 24:34 | 1.72–1.77×, 120–140 GPUs, 5 runs | the wall for 76–118 s |

Nothing above is a hard lock. What reads as a trap, a contradiction or a bug:

1. **The power meter cries wolf for five minutes (bug).** §4. 284–298 s in every first-timer trace
   and 284–292 s for the bot, all of it with Buy Power selling a smaller block than the meter's
   scale; `Power can now be bought 10,000 kWh at a time.` at 1:36–1:57 is false for a player with
   $28. Thirteen presses fall inside it.
2. **Hire-only: the wall line names a fix the player cannot buy (bug; replaces round 2's silent
   wall).** With 4+ researchers and one room, research sits at "1,000" from 2:58 to 60:00. The line
   is right three times (`Research at capacity. Grid Contract needs 2,000. Expand Lab with the next
   Trust.`, 5:12; Chain-of-thought, 7:12 and 9:12) and then, from 11:12, wrong 25 times in 49 minutes:
   `Research at capacity. Experiment tracker needs 3,000. The Experiment tracker doubles it.` and
   `…Power purchase agreement needs 7,000. The Experiment tracker doubles it.` — the Experiment
   tracker costs 3,000 research in a lab that holds 1,000. No Training panel ever appears (Training
   Pipeline costs 2,000). Each Trust still prints `Trust +1. Hire a researcher or expand the lab.`
3. **The event calendar does not look at the player (bug).** The six events fire at 8:50, 11:26,
   14:02, 16:38, 19:14 and 21:50 whatever has happened. On a game with **zero tasks and nothing
   clicked**, *A Bridge Round* opens at 8:50 over an empty screen: "A fund offers $ 15,000.00 now…"
   (`s1r3x-idle-new.md`); taking it after one click yields 71 GPUs three minutes later and six of
   the opening's console lessons in 64 seconds (`s1r3x-idle-bridge.md`). A player who rented one GPU
   and walked away is told at 19:14 that "A larger lab has offered two of your researchers twice
   their salary. They built the contract models. Their bank would follow them." and, on the timer,
   `Two researchers leave for a larger lab.` — with one researcher and no Research panel
   (`s1r3x-idle-after-gpu.md`). The same sentence about contract models is shown to the ordinary
   first-timer **before any contract exists** in 4 of 6 traces (the card first appears at 19:32,
   the event at 19:14).
4. **The wall price is an inversion, and a slow one for the poor.** First Datacenter lists at
   $300,000 ($250,000 after the abatement). The first time a run needs more than the cloud rents,
   the card is re-priced once to 180 s of revenue, floor $90,000, a sixth less with the abatement:
   `Abilene fast-tracks the permit. First Datacenter: $75,000.` So the player who saves as the
   pinned card asks pays $250,000 (seeds 1, 2, 4, 5: never at the wall) and the player who trains
   into the wall pays $75,000–$138,000; and since `Deposit returned: $120,000.` follows either way
   (the same $120,000 for 10 rented GPUs as for 140, and never mentioned before), the $75,000 card
   pays the player $45,000. For low earners the wait at the wall is long: 86–536 s
   for the never-pricer, 626–720 s if Dynamic pricing is also refused, 570 s for `train-priority`
   seed 4 (funds $1,245 at the wall at 18:44), with another purchase enabled in 4–49% of the
   checks — against the build's own stated target of 4:00 (its README) and 44–126 s for the bot.
5. **The first event lands on the first red-team.** 8:28–8:50 holds the quota line, the first
   evaluation, Red-team / Release, the Focus row and *A Bridge Round*; the panel covers the Red-team
   button it interrupts (§4). Eight console lines pass in 26 s through a five-line console.
6. **The standing offer is a mild trap.** "Custom model contract (3,000 research · repeatable) / A
   bank that buys at your price. Demand +12%." is drawn with a double border and is always the
   cheapest lit card (3,000 → 4,050 → 5,468 → 7,381 → 9,965 → 13,452). The first-timer buys five or
   six (30,000–43,000 research, three training runs' worth). Never buying it ends the stage 1:18
   *sooner* on five seeds (4 of 5 paired) at 1.60–1.77× instead of 1.55–1.61×. In round 2 skipping
   it cost 18 minutes; it has gone from hidden key to mild trap.
7. **The idle rescue is still generic.** *A Customer Writes* — "We would like to pay for a year up
   front. $ 44.00, if that works." — to a player holding $2,376 (`no-research`, 30:22); $1,800–$2,200
   to the hire-only player whose problem is a room. It now has a timer and a second option.
8. **Reloads**: at 11 awkward moments in one playthrough (three clicks in; the tick the first GPU
   is rented; the power meter, Buy Power and Research each new; mid-training; mid-evaluation; one
   second into a red-team cool-down; an event open with 56 s on its timer; the datacenter affordable;
   half a second after buying it) the serialized state, every line of the screen and the console are
   identical before and after (`s1r3x-reloads.md`). A stage reloaded every 60 s or every 14 s ends
   at the same second in the same state. **Exact.**
9. **Walking away**: at 10:00 for ten minutes — events take their defaults, the Grid Contract
   keeps the power on, funds $342 → $9,962, 20,962 unsold, Trust 5 waiting; on return 13 purchases
   are lit at once. With one GPU for twenty minutes — the meter drains to 0 at 16:48 (`Power is out…`),
   $252 in hand, Buy Power enabled. **Safe.**

### Paperclips (`s1r3-softlock-paperclips.md`; round 2's `r2x-pc-*` reused)

Unchanged: wire-out at a $0.01 price rescued at +0 s by *Beg for More Wire*; $2.25 with six
clippers sells nothing for 180 s with no line; every Trust into Processors is a silent wall from
10:00 to 60:00; a reload after 60 s loses 49 clips; three idle minutes do nothing.

---

## 7. Decisions

Round 2's biggest gap was that nothing the stage asked the player to decide changed the stage. It
does now. Stage end, mean of seeds 1–5 (`s1r3x-table-5seeds.md`); "paired" = the same seeds against
the control, whose own spread is 26:36–31:34:

| what the player decides | printed stakes | stage end | vs the control (29:08) | exit state |
|---|---|---|---|---|
| every modal: worst-looking option | on each button | 35:06 | **+5:58** (5 of 5 seeds later) | 1.39–1.58×, 12–14 researchers |
| every modal: best-looking option | | 29:15 | +0:08 | 1.52–1.59×, 19–20 researchers |
| every modal ignored (timer defaults; seeds 1–3) | "59 s — then: …" | 32:03 | +3:53 on those seeds | — |
| *Open Weights*: cut the price | "price −20% · contracts 30% smaller for good" | 31:29 | **+2:21** (5 of 5) | — |
| *Open Weights*: say nothing (the default) | "demand −15% for 3:00" | 30:00 | +0:53 (5 of 5) | — |
| *An Open Letter*: publish a rebuttal | "marketing level +1 · −3 researchers" | 30:39 | **+1:32** (5 of 5) | 3 runs in two seeds |
| *An Open Letter*: say nothing (default) | "nothing changes" | 29:42 | +0:34 | — |
| *A Reporter Calls*: no comment (default) | "the piece runs: demand −30% for 3:00" | 29:58 | +0:50 | — |
| *A Better Offer*: let them go (default) | "−2 researchers · the newest contract leaves with them" | 29:58 | +0:51 | — |
| *A Bridge Round*: wait (default) | "the Series A pays $15,000 more" vs "+$15,000 now · −1 Trust · contracts 30% smaller" | 28:52 | −0:16 (2 later, 3 sooner) | — |
| *The Leaderboard*: decline (default) | "nothing changes" vs "ahead of Cadence: marketing +2 · behind: marketing −2" | 28:52 | −0:16 | — |
| *Can I try something?*: not now | "let her try / needs 13,000 research" is grey when it opens | 29:08 | 0:00 (identical runs) | — |
| red-team: never | the confirm, above | 31:45 | **+2:37** (4 of 5; +3:48 on seeds 1–3) | 4–7 incidents, lab 10–13 |
| price: never touched (Dynamic pricing bought) | the billing sentence | 35:20 | **+6:12** (5 of 5; +7:27 on seeds 1–3) | pays $75,000 at the wall |
| price: never touched, Dynamic pricing refused (seeds 1–3) | | 40:01 | +11:51 | — |
| Marketing: never | — | 31:22 | +2:14 (4 of 5) | level 6–10 |
| Focus: Efficiency always | one line when selected | 27:33 | −1:35 | 1.42–1.51×, 7 runs |
| Focus: Safety always | one line when selected | 28:58 | −0:10 | 1.48–1.53×, alignment 81 |
| contracts: never | card text | 27:50 | **−1:18** (4 of 5 sooner) | 1.60–1.77× |
| research: the run first (`train-priority`) | nothing on screen | 25:24 | **−3:44** (5 of 5 sooner) | 1.61–1.77×, 4–5 runs |
| the game's bot | — | 24:24 | −4:44 | 1.72–1.78×, 26–32 researchers |

* **Round 2's targets** (its §5, measured its way, seeds 1–3): best vs worst modal answers ≥ 3
  minutes — **met** (29:24 vs 35:25, 6:01); red-team to zero vs never ≥ 3 minutes — **met** (+3:48;
  +2:37 on five seeds, so marginal); price tracked vs never ≥ 5 minutes — **met** (+7:27); every
  first-timer seed inside 26–40 minutes — **met** (26:36–31:34); Autoplay at or under 27 — **met**
  (23:30–25:00).
* **Legibility at the moment of choosing**: good. Every event option prints its effect and cost on
  the button, sized to the moment ($15,000 at 8:50; "match the offer / both stay · $16,000"), a
  greyed option says what it needs, the timer names its default, the open-issues confirm states
  both outcomes. A clean release is worth a Trust; a dirty one costs Trust, demand and contracts.
  The exit state now differs with play (1.39–1.78×, 12–32 researchers, alignment 50–81; round 2:
  1.41–1.66×, 13–19, flat).
* **What is still thin**: three of the seven events are inside seed noise (Bridge, Leaderboard,
  the training gamble, which was unaffordable every time it opened in the control); and **the top
  button is the best or equal-best answer to every event** — "first option always" (29:08) ties
  "best-looking" (29:15). A player learns to press the top one.
* **Trap defaults**: none among the timers (ignoring every event costs about four minutes; four of
  the six defaults are the weaker option by 0:34–0:53, two are no worse, and each is stated on the
  timer line). Two off the timer: the
  repeatable contract (§6.6), and the largest decision in the table, which is **not framed at all**
  — whether research goes to cards or to the next run (§8).

---

## 8. Training under the hard gate

Every 2-s check of the Train row was logged for every run (`explore-s1r3.mjs gate`, `gate-table`;
`s1r3x-gate-table.md`).

**What the row says.** With enough GPUs: "Needs 15 GPUs for 0:50", and under it the one thing
missing with an estimate — "*money — about 0:20*", "*research — about 1:10*", or "*needs 11,000
research; the lab holds 8,000*". Short of GPUs: "｢￭￭￭￭￭￭￭･･･｣ Needs 15 GPUs. 10 rented. Rent 5 more."
— the meter fills and the sentence updates with each rental ("…14 rented. Rent 1 more."), and at 15
the button lights (`s1r3x-gate-walk.md`); Rent GPU was enabled in every check of every such stretch
inspected (the first-timer's, the 10-GPU player's, the 48-GPU player's). At the wall: "｢￭￭････････｣ Needs 660 GPUs. The cloud will rent 140. Build the First
Datacenter.", the card gains "— needed" and a left bar, and the console repeats `Sage-1.6 needs 660
GPUs. The cloud will rent 140. Build the First Datacenter.` every three minutes (`s1r3x-wall.md`).
The purchase that unblocks Train is on screen every time. As a message, the hard gate is
exemplary, and nothing on screen says "undertrained" any more.

**How often it blocks.** For the first-timer, hardly ever:

| run | stage end | runs | Train not pressable, nothing training | blocked by research / money / GPUs | longest stretch | GPU message first seen | the wall |
|---|---|---|---|---|---|---|---|
| first-timer, seed 1 | 26:36 | 4 | 822 s | 614 / 60 / **148** | 13:14–22:26 (552 s) | 24:10 "Rent 3 more." | never |
| seed 2 | 30:26 | 4 | 1,068 s | 952 / 116 / **0** | 14:28–22:06 (458 s) | — | never |
| seed 3 | 27:28 | 4 | 898 s | 780 / 116 / **2** | 14:56–25:16 (620 s) | — | 27:28, for 2 s |
| seed 4 | 31:34 | 4 | 1,132 s | 996 / 94 / **42** | 14:44–24:38 (594 s) | 26:24 | never |
| seed 5 | 29:34 | 4 | 1,018 s | 890 / 128 / **0** | 14:34–24:08 (574 s) | — | never |
| the game's bot, seeds 1–5 | 23:30–25:00 | 5 | 576–662 s | 328–474 / 134–174 / 44–126 | 118–278 s | — | 21:48–23:32, then 44–126 s |
| run first (`train-priority`), seeds 1–5 | 24:04–28:14 | 4–5 | 598–934 s | 228–400 / 104–244 / 56–572 | 222–572 s | — | 18:44–24:00, then 54–570 s |
| never prices | 34:20–36:24 | 4–5 | 1,166–1,396 s | 738–990 / 24–122 / 184–538 | 392–584 s | — | 27:04–33:50, then 86–536 s |
| worst modal answers | 33:04–36:48 | 3–4 | 1,312–1,468 s | 1,190–1,402 / 58–122 / 0 | **1,082–1,234 s** | — | never |
| stops at 10 GPUs | 44:34–46:58 | 2 | 1,900–2,052 s | 66–70 / 0 / 1,834–1,984 | 1,516–1,660 s | 12:14–12:34 | never |

* **The GPU requirement stops the first-timer for 0–148 s per stage** (0–18% of its blocked time),
  only at the very end, with the fix one click away at $260–$326 against $87,000+ in hand. The runs
  need 10, 15–20, 25–30 and 45–50 GPUs against 48–75 rented; the need then jumps to 440–1,200 once
  capability passes about 1.6× (`gpusFor`'s knee), which four first-timer runs reach in one seed of
  five. **In 4 of 5 seeds the first-timer never sees the wall; in the fifth it is on screen for
  two seconds.** The gate is met as designed only by players who train more — the bot, at 21:48–23:32.
* **Research is what stops training, and for a long time.** In every first-timer trace the third
  run starts at 11:50–13:36 and the fourth at 22:28–26:14: **580–758 s between them**. The row reads
  "research — about 0:19 … 1:56" for 458–620 s without a break (52–68% of the time the Training
  panel is up). In that stretch the first-timer buys 10–13 research cards — 67,899–98,864 research,
  four or five of them contracts — while the run costs 10,000–12,000: each time the lab nears
  8,000 a card priced 7,400–9,000 lights and takes it (`hands`, and the trace in §9). The model on
  screen is "Sage-1.3 · 1.38–1.44×" for 10:20–12:48 while `Anthrosoft ships Cadence-5` and `-6`.
* **Is that the policy or the game?** Both. The policy buys what is lit; the game prices every card
  at so many seconds of the lab's income (cards re-price to the player: "Hire an evals team" is
  5,000 research for a ten-GPU player, 8,000 for the control), so a card is always nearer than the
  run, and the row's estimate silently resets with each purchase. The game's own `naive` and
  `greedy` policies run in the browser show the same shape (340–512 s). A player who holds research
  for the run gets five runs 122–304 s apart (seed 1) and the stage in 24:04–28:14. Pressing Train
  "whenever it is enabled" changes nothing in seed 1, because it almost never is: 6–8 s per stage.
* **The stretch without training before the datacenter**, then: 458–620 s for the first-timer (of
  its own making, with a card to buy every 55 s or so, an event every 2:36, and nothing on screen
  that marks it as a problem); 44–126 s at the wall for the bot; 54–570 s at the wall for the
  run-first player and 86–720 s for the low earner, where there is little else to do — another
  purchase is enabled in 4–49% of the checks, the Train row is dead by design, and the card is
  priced at three minutes of an income that may be $100 a second.

---

## 9. THE SINGLE BIGGEST GAP

**Training — the loop the stage is about and the thing the hard GPU gate was built to govern —
stops for ten minutes in the middle of every first-timer stage, and the gate is not what stops it.**
In all six first-timer traces the third run starts at 11:50–13:36 and the fourth at 22:28–26:14
(580–758 s apart). For 458–620 s without a break the Train row reads "*research — about 1:10*"; over
the stage Train is unpressable with nothing training for 822–1,132 s, of which research accounts
for 614–996 s and the GPU requirement for 0–148 s. Seed 1, every 30 s from 14:00 to 22:00, the row
never changing but for the estimate — "Train Sage-1.4 Cost: $6,048, 10,000 research / Needs 45 GPUs
for 1:06 / research — about 0:53 · 0:46 · 1:15 · 0:45 · 1:00 · 0:30 · 0:55 · 0:25 · 0:57 · 0:27 · 0:52 ·
0:22 · 0:49 · 0:19 · 0:32 · 0:54 · 0:24" — while the same lab buys, in order, Hire an evals team
(8,000), three contracts (3,000, 4,050, 5,468), a fourth (7,381), Public API (8,000), Dynamic
pricing (7,800), Bulk GPU lease (8,000), Sage writes Sage (8,000) and a Power purchase agreement
(9,000): 68,699 research on ten cards, each lit before the 10,000-research run could be. Capability
stays at 1.38× from 13:14 to 24:10. The money side is idle through the same minutes: the last GPU
is rented at 10:26–11:58 (the fleet is flat for 59–64% of the stage), Marketing has priced itself
out ($12,800 at level 8, $204,800 at level 12; grey for 13–23 of the remaining minutes), the price
goes AUTO at 16:04–18:44, and First Datacenter — on screen from 10:44–12:02 at $300,000 against
$199–$1,189 in hand — is 2–9% funded at 15:00 and 10–15% at 20:00; revenue is $146–$254/s at 20:00
and $1,066–$1,955/s at the end, so a quarter to a half of the price arrives in the last minute. The
stage then ends as a savings goal: in 4 of 5 seeds the sentence the redesign exists to deliver,
`Sage-1.6 needs 660 GPUs. The cloud will rent 140. Build the First Datacenter.`, is never printed,
and the last thing the Train row says is "Needs 75 GPUs. 72 rented. Rent 3 more." Players who do
train into the wall (the bot, 23:30–25:00 at 1.72–1.78×; `train-priority`, 25:24 mean at 1.61–1.77×)
finish three and a half to five minutes sooner than the first-timer (29:08 at 1.55–1.61×), and the
second pays $75,000 for the card instead of $250,000. The stage's most valuable decision — research
to cards or to the run — is the one choice it never frames.

Fix, in order of leverage:

1. **Let the run claim its research.** When Train is short of research only, pressing it should
   queue the run ("Queued — starts at 10,000 research, about 0:53") and reserve the lab's income
   for it; a card bought meanwhile says what it costs the run ("delays Sage-1.4 by 0:58") on the
   card, not in a tooltip. Or take research out of the run's price in Stage 1 altogether — keep the
   dollar price, the GPUs and the minute they are off the market, and gate on the lab's *size*
   ("needs a lab that holds 10,000") — so that cards and runs stop sharing a wallet and money has a
   sink in the second half.
2. **Then the GPU gate becomes the stage's constraint, as intended.** With runs every 2–4 minutes
   the first-timer reaches 45–50 and 75–80 GPUs of need by about 17–21 minutes with 72–76 rented:
   "Rent 5 more" becomes a decision at the right time, the quota and the Bulk lease become a ladder,
   and the wall arrives for everyone.
3. **Show the datacenter when it is needed, at a price the player can read.** Reveal the card (or
   price it) one run before the wall, not at 10:44 at 250–1,500 times the player's funds; print the
   deposit on it ("$250,000 · $120,000 back when the rented GPUs return"); never make the wall
   cheaper than saving.

Target for the next build, measured with `explore-s1r3.mjs` on seeds 1–5: for the first-timer no
stretch over 240 s with Train unpressable and nothing training; at least five runs; the wall
sentence on screen for at least 20 s before the purchase in every seed; `train-priority` no more
than two minutes ahead of the control; stage length still 22–30 minutes.

---

## 10. Secondary gaps (priority order)

1. **Minutes 3–7 stall on a full lab, under a red meter.** Research is pinned at the 1,000 cap for
   168–174 s; "Projects" has no card under it for 104 s of the first five minutes; the longest
   decision gap after the opening (80–90 s, 4:46–6:22) is the wait for a Trust to spend on the
   Expand Lab button that appeared after the last Trust was spent on a hire the console told the
   player to make; and power is a chore again — 14 presses, 13 of them between 2:08 and 6:32 —
   because the Grid Contract costs 2,000 research. Fix: show Expand Lab with the second Trust
   (`Trust +1. Hire a researcher or expand the lab.` from 3:00) or start the lab at 2,000; put the
   Grid Contract inside the first lab's reach (750–1,000 research) so it lands by 4:30; never show
   the Projects heading without a card.
2. **The power meter (bug).** Scale it to the block Buy Power actually sells (or to the larger of
   that and ten seconds of draw), colour it by time-to-empty, and print the 10,000 kWh line when the
   player can first afford the block.
3. **Too much lands at 8:28–8:50, and the text volume has not come down.** The quota line, the
   first evaluation, Red-team, Release, the Focus row and the first event arrive within 22 s; eight
   console lines scroll a five-line console in 26 s; the event panel covers the button the player
   was just taught. From minute 10 the screen holds 245–305 words against Paperclips' 110–120 and
   adds 4.9–5.4 lines a minute against 1.6 (round 2: 5.3). Fix: hold the first event until 30 s
   after the first release; keep the Focus row for the second run's Train row; dock the event panel
   where it covers nothing the stage is teaching; one flavour line per run, the rest to Developments.
4. **Money has nothing to do after 12:00 and the end cannot be read from the screen.** After the
   datacenter card appears the first-timer makes 3–6 funds purchases in 15–19 minutes; Marketing is
   a grey button with a five- to seven-figure price for 13–23 of them; funds are 10–15% of the price
   at 20:00 and the rest arrives in the last few minutes when the fourth release and two demand
   cards stack under AUTO pricing (the price per task is $0.90–$1.77 five minutes from the end in
   five of six traces and $3.30–$6.40 at the end). Fix: fix 1 of §9; cap Marketing's price growth
   once events have raised its level; put a meter on the pinned card ("First Datacenter
   ｢￭･････････｣ $37,045 of $250,000").
5. **The wall price** (§6.4): re-price *up* from what the player has, never below it; state the
   deposit; cap the wait at the wall at the four minutes the build promises (price to 180 s of
   income with no floor, or advance the money: `Abilene lends against the site.`).
6. **Events ignore the player** (§6.3): gate each on what it mentions (a bridge round on revenue; *A
   Better Offer* on three researchers and a signed contract, or drop the contract sentence; *A
   Reporter Calls* on a released model), and delay the calendar for a lab that is behind it.
7. **Cards are still a conveyor.** 9–12 of 31–35 cards are affordable the moment they appear and
   11–14 of the 25–30 bought are bought within 10 s; the median card stands 56–82 s as a goal (round
   2: 28–34 s; Paperclips: 262 s); two are free (Seed round, Series A). The card stream also runs
   dry at 20:02 for 176–248 s, the quietest four minutes of the stage.
8. **Hire-only's wrong advice** (§6.2): the fix line should name Expand Lab whenever the named card
   costs more than the lab holds.
9. **Small things.** Focus shows one of its three trades (the other two in tooltips), and a click
   during a run re-labels the row while the run keeps its focus; the top option is the best answer
   to every event; no price ceiling; the next run's dollar price triples on arrival without a line;
   "Trust: 0 (1 owed)" after the bridge; *A Customer Writes* offers $44 to a player with $2,376;
   `Anthrosoft's Cadence-2 beats Sage-1. Demand dips.` prints on a screen with nothing but one button.

---

## 11. Verdict

| Rubric item | Winner | Margin |
|---|---|---|
| (a) Time to first meaningful choice | Tie (8–8) | Takeoff automates sooner (0:06–0:17 vs 0:32), offers an either-or sooner (0:52–0:58 vs 1:46) and explains its lever in a sentence; Paperclips has the lever at 0:00 and uses it at 0:44 against Takeoff's 1:09–1:36, and it weighs more (19× vs 21–42% of the stage) |
| (b) Nothing to do | **Takeoff** (8–7) | 18–34 s idle in the first 5 minutes vs 62 s; worst reveal gap 144 s vs 874 s in the first hour; but a full lab for 170 s and a starved Train row for ten minutes |
| (c) Cognitive load / disclosure | Tie (7–7) | Takeoff's first five minutes are lighter and far better taught (3 / 8 / 20 / 22 numbers vs 10 / 12 / 15 / 30); from minute 10 Paperclips is lighter (29 vs 34–41 numbers, 11 vs 14–15 controls, 110 vs 245 words, 1.6 vs 5 lines a minute) |
| (d) Cadence of reveals | **Takeoff** (8–7) | a mechanic every 30 s for 3½ minutes, a card every 30 s, an event every 2:36; Paperclips shows nothing between 0:32 and 4:54 and a project every 99–106 s |
| (e) Greyed-out goal on screen | Paperclips (10–8) | 100% vs 69–71% of the first five minutes and 94–95% of the stage; all of Takeoff's misses are before 2:02, the price of its one-at-a-time opening |
| (f) Clarity of transition | **Takeoff** (9–8) | five numbered lines held for 24 s, revenue up at once, something to buy on arrival; Paperclips is unmistakable and explains less |
| (g) Soft-locks | **Takeoff** (8–7) | both 0 hard locks; Takeoff's dead ends have lines (two of them wrong), Paperclips' three are silent |
| **Overall** | **Takeoff, narrowly: 8.0 vs 7.7** | earned on the opening, on pacing and on the transition; given back on the first-minute goal and on a middle in which the stage's own loop goes quiet |

### The four deliberate changes

1. **One mechanic at a time in the opening — right, and the best thing in the build.** Numbers on
   screen 3 / 8 / 20 / 22 at 0 / 1 / 3 / 5 minutes (round 2: 11 / 13 / 18 / 28; Paperclips 10 / 12 / 15 /
   30), eight beats each with a sentence, no beat over +4 numbers. It costs the greyed-goal row two
   points on paper (86–94 s without a goal, all before 2:02, each with an affordable purchase) and
   delays the price lever to 1:09–1:36; neither hurts on the screen. What does hurt is inside it and
   fixable: the red power meter, and a research beat that funnels five Trust into hires and then
   makes the player wait 80–90 s under an empty Projects panel (§10.1–2).
2. **One First Datacenter and a shorter stage — clearer, and it reopened a milder tail.** The
   stage is 26:36–31:34 (round 2: 30:42–32:06), the goal is one card with one sentence, and the
   transition scores 9. But the card stands grey for 56–62% of the stage at a price the player
   cannot relate to, funds are 10–15% of it at 20:00, and the end arrives as a revenue spike; the
   four-rung ladder's sense of approach is gone and nothing replaced it (§10.4–5).
3. **The hard GPU requirement — clean, legible, and not yet the constraint.** "Needs 15 GPUs. 10
   rented. Rent 5 more." with a meter and an enabled Rent GPU is better than "undertrained (38%)"
   in every way, and the wall's sentence is the right ending. But it blocks the first-timer for
   0–148 s per stage and shows the wall in 1 seed of 5; research blocks Train for 614–996 s. The
   gate needs §9's fix before it can matter.
4. **Unicode meters — a gain, with one meter wrong.** Research, the rental quota and the Train row
   read at a glance and helped take the screen from 28 numbers to 22 at 5:00. The power meter is red
   for 284–298 s of every trace for no reason (§4).

### What is measurably good, so that the next fix does not break it

* The opening: one button at 0:00; first automation at 0:06–0:17; a new mechanic about every 30 s
  to 3:32, each explained in the console the moment it appears; ≤ 22 numbers on screen at 5:00; the
  hand retires at 0:40 (159–168 clicks; Paperclips 879).
* The price lever stated in words with four states that each name the move; 5% steps; 36–60 price
  moves a stage (round 2: 103–138); Dynamic pricing as an offer.
* Decisions that move the stage: worst vs best event answers 6 minutes, pricing 6–12 minutes,
  red-teaming 2½–4 minutes, with the stakes printed on every button and the exit state varying
  (1.39–1.78×).
* The blocked-Train message, the gate walk, the wall line and the "— needed" card.
* No dead air by the rubric's measures: ≤ 34 s idle in the first five minutes, no reveal gap over
  144 s, no novelty gap over 110 s, in six first-timer traces; stage length 26:36–31:34 across five
  seeds and 23:30–25:00 for the bot.
* The transition: five explanatory lines 2 s apart, held whole for 24 s; revenue up on arrival;
  purchases affordable at once; retired cards named.
* Dead ends: the manual button never dies; power-out, absurd price, full lab and one-researcher lab
  each get a repeating line that names the fix; open issues are confirmed with both outcomes
  stated, attributed when they bite, and cost Trust.
* Persistence: state, screen and console identical across a reload at eleven awkward moments and
  every 14 s for a stage; ten or twenty minutes away is safe.
* The event panel: non-modal, keyboard-reachable, Escape takes the named default.
* 390 px: one column, no overflow, 36-px buttons, an identical run.
* Insight is alive (it accrues at the cap and with releases and has four cards to spend on); clean
  releases pay Trust; no card is clipped; no page error in 202 runs; same seed, same run.

---

## 12. Status of each round-2 finding

| Round-2 finding | Status in s12-r4 | Evidence |
|---|---|---|
| **Biggest gap: nothing Stage 1 asks the player to decide changes Stage 1** | **Largely fixed** | §7: worst vs best event answers 35:25 vs 29:24 (seeds 1–3; 35:06 vs 29:15 on five); never red-teaming +3:48 (+2:37 on five) with incidents that cost demand, contracts and Trust; never pricing +7:27; all five of round 2's targets met. Its four fixes: contracts follow the price (done: "A bank that buys at your price"); a shipped issue costs and a clean release earns (done); stakes sized and printed on the button (done); Focus trade visible (partly: the selected one). New: the top option is always the best one; the heaviest choice, cards vs run, is unframed (§9) |
| Secondary 1: too much, too fast, in minutes 3–10 | **Partly fixed; moved** | reveals in minutes 3–9: 18–21 (24 in round 2's six minutes from 3:06); numbers 20 / 22 at 3:00 / 5:00 (18 / 28). The densest six minutes are now 5:46–12:04 (22–23 reveals; Paperclips 11–15), the pile-up is at 8:28–8:50, and the text rate is unchanged: 3.6–3.9 console + 1.3–1.5 Developments lines a minute (3.7 + 1.6). One flavour line per run, mostly (was 3–4). Minutes 3–7 are now too thin (§10.1) |
| Secondary 2: projects are a conveyor belt, not goals | **Partly fixed** | median reveal → purchase 56–82 s (28–34 s; Paperclips 262 s); still 11–14 of 25–30 bought within 10 s and 9–12 of 31–35 affordable at first sight. The two refunded "discounts" are gone: the abatement costs 1 Trust; no contractor |
| Secondary 3: the main verb is dead for 60% of the stage and the quota is a surprise | **Half fixed** | the quota is announced at 60 GPUs with a meter and a line; undertrained runs are gone; two research cards add 20 GPUs each. The fleet is still flat for 59–64% of the first-timer's stage (last rental 10:26–11:58), now by the saving rule rather than the quota, and the Train row's GPU need never pulls on it (§8) |
| Secondary 4: price is 103–138 one-cent clicks for a 12% gain | **Fixed** | 5% steps; 36–60 moves a stage; Dynamic pricing (6,000–7,800 research) takes over at 16:04–18:44; the lever is worth 6–12 minutes |
| Secondary 5: the transition's payoff contradicts its announcement | **Fixed** | revenue $1,634 → $2,218 at +10 s → $3,260 at +60 s; unsold never above one second of output; narration whole for 24 s; no `Nobody buys` line. New and small: the unannounced deposit; the run price ×3.3 |
| Secondary 6: allocation walls named once, or not at all | **Mostly fixed; one line wrong** | the wall line repeats every two minutes and names card and fix; expand-only gets `One researcher cannot fill 17 rooms. Hire a researcher with the next Trust.`; hire-only gets a fix it cannot buy from 11:12 (§6.2); the prepayment is still generic ($44) |
| Secondary 7: insight is dead UI for an efficient player | **Fixed** | "Insight: 24 (accruing)" by 5:00; releases add to it; Research blog post, Launch demo video, Press release and Workshop paper spend it |
| Secondary 8: small things | **Fixed, but for the ceiling** | negative Trust reads "Trust: 0 (1 owed)" and `Trust +1, back to 0. Nothing to spend yet.`; no clipped card; the event panel takes focus, Tab reaches its options, Escape answers; the cent floor pays what it says (1,094 tasks at $0.01 in 120 s: +$10.94) and the line there reads "Every task sells. Customers would pay more."; the toast is hidden at 390 px; buttons are 36 px. The price still has no ceiling |
| Bug 4.1: hire-only wall line never prints | **Fixed; replaced** by a wrong line | §6.2 |
| Bug 4.2: the idle guard does not know why the player is stuck | **Partly fixed** | expand-only is diagnosed in words; *A Customer Writes* still pays $44–$2,200 for any stall; it has a timer and a second option now |
| Bug 4.3: `Trust +1. Hire…` while both buttons stay grey; "Trust: -1" | **Fixed** | above |
| Bug 4.4: `Nobody buys at $1.02` on arrival in Stage 2 | **Fixed** | not printed in 10 arrivals; pricing is AUTO on arrival |
| Bug 4.5: a modal is a 60-second input lock | **Fixed** | overlay passes clicks, Escape takes the default, every event has a timer. New: the panel covers controls (§4) |
| Bug 4.6: price floor pays less than it says | **Fixed** | above |
| 4.7 reloads · 4.8 walking away · 4.9 grid off | **Still exact / safe** | §6.8–9 |

---

## 13. Re-running

All commands from the repo root; outputs in `agent-tools/critic-out/`.

```sh
D=agent-tools/snapshots/s12-r4
# rubric runs (one real-time run at a time)
node tools/critic/run.mjs takeoff    s1r3-tk-s1 --game-dir $D --realtime 300 --accel-minutes 60 --seed 1
for s in 1 2 3 4 5; do node tools/critic/run.mjs takeoff s1r3-tk-s1-seed$s --game-dir $D --realtime 0 --accel-minutes 60 --seed $s; done
node tools/critic/run.mjs takeoff    s1r3-tk-s1-auto --game-dir $D --realtime 0 --accel-minutes 60 --autoplay      # also --seed 2, 3 (labels -auto-seed2, -auto-seed3)
node tools/critic/run.mjs paperclips s1r3-pc-s1 --realtime 300 --accel-minutes 60                                # ≡ pc-s1, r2-pc-s1
node tools/critic/analyze.mjs s1r3-tk-s1                                                                          # → .analysis.md; same for every label
node tools/critic/compare.mjs s1r3-tk-s1 s1r3-tk-s1-seed1 s1r3-tk-s1-seed2 s1r3-tk-s1-seed3 s1r3-tk-s1-seed4 s1r3-tk-s1-seed5
node tools/critic/compare.mjs s1r3-tk-s1-auto s1r3-tk-s1-auto-seed2 s1r3-tk-s1-auto-seed3 s1r3-pc-s1 pc-s1-accel adr-5min
node tools/critic/decisions.mjs s1r3-tk-s1 s1r3-tk-s1-seed1 s1r3-tk-s1-seed2 s1r3-tk-s1-seed3 s1r3-tk-s1-seed4 s1r3-tk-s1-seed5 s1r3-pc-s1 pc-s1-accel
# canned probes
node tools/critic/transition.mjs takeoff --game-dir $D --out s1r3-transition-takeoff
node tools/critic/transition.mjs paperclips --out s1r3-transition-paperclips
node tools/critic/softlock.mjs takeoff --game-dir $D --out s1r3-softlock-takeoff
node tools/critic/softlock.mjs paperclips --out s1r3-softlock-paperclips
node tools/critic/determinism.mjs takeoff --game-dir $D --accel-minutes 60 --out s1r3-det
node tools/critic/explore.mjs mobile-shots --game-dir $D --tag s1r3x
# this round's explorer (labels s1r3x-<name>[-seedN])
node tools/critic/explore-s1r3.mjs list
node tools/critic/explore-s1r3.mjs all-runs --game-dir $D --seeds 1,2,3            # 50 play styles → .explore.md, .gate.json, .end.json, .modals.json
node tools/critic/explore-s1r3.mjs baseline,m-bridge-wait,m-weights-cut,m-weights-nothing,m-reporter-nocomment,m-letter-rebuttal,m-letter-nothing,m-offer-letgo,m-board-decline,m-try-no,modal-best,modal-worst,ship-open,no-price,no-marketing,no-contracts,focus-efficiency,focus-safety,train-priority,autoplay-bot --game-dir $D --seeds 4,5
node tools/critic/explore-s1r3.mjs all-probes --game-dir $D                        # opening, shots, arrival, reloads, idle-*, event-keys, price-ends, trust-floor, focus-row, gate-walk, wall, pc-words
node tools/critic/explore-s1r3.mjs opening --game-dir $D --rates 0.5 --seconds 420 --tag s1r3x-slow
node tools/critic/explore-s1r3.mjs expand-only,no-train --game-dir $D --minutes 150 --tag s1r3x-long
node tools/critic/explore-s1r3.mjs table --seeds 1,2,3 --out s1r3x-table           # §6
node tools/critic/explore-s1r3.mjs table baseline m-bridge-wait … autoplay-bot --seeds 1,2,3,4,5 --out s1r3x-table-5seeds   # §7
node tools/critic/explore-s1r3.mjs gate s1r3x-baseline s1r3x-autoplay-bot          # §8, one run in detail
node tools/critic/explore-s1r3.mjs gate-table baseline train-priority autoplay-bot no-price modal-worst rent-10 --out s1r3x-gate-table
node tools/critic/explore-s1r3.mjs measures s1r3-tk-s1-seed1 s1r3-pc-s1            # grey-goal holes, red meter, text rate, empty Projects
node tools/critic/explore-s1r3.mjs hands s1r3-tk-s1-seed1                          # run times, funds vs the card, last rental / Marketing / price move
node tools/critic/explore-s1r3.mjs says hire-only rent-10 no-price-strict          # repeated lines and the last Stage 1 screen
```

### Harness changes made this round

1. **New file `tools/critic/explore-s1r3.mjs`** — the only change under `tools/`. It imports the
   shared libraries and edits none of them. Play styles (adapter overrides, as in `explore.mjs`,
   plus: one event answered differently, `train-priority`, the game's four Autoplay policies in the
   browser, rental caps, click rates of 0.5 / 1.5 / 10 a second, a reload every 14 or 60 s); probes
   (`opening`, `shots`, `arrival`, `reloads`, `idle-new`, `idle-one-click`, `idle-after-gpu`,
   `idle-bridge`, `idle-mid`, `event-keys`, `price-ends`, `trust-floor`, `focus-row`, `gate-walk`,
   `wall`, `pc-words`); and the read-only reports `table`, `gate`, `gate-table`, `measures`, `hands`,
   `says`. Inside the *page* (not on disk) two of its variants replace `window.__critic.mashAdvance`
   (to click at another rate) or wrap `window.__critic.controls` (to hand the policy the Train row's
   sentence); neither touches the game.
2. `tools/critic/README.md` and every other shared file: **not touched** (another reviewer was using
   the harness); the header of the new file documents its commands.
3. `agent-tools/critic-out/`: the outputs an interrupted earlier attempt at this round had written
   under the same `s1r3` labels against the older build `s12-r3` were moved, not deleted, to
   `agent-tools/critic-out/_stale-s1r3-on-s12-r3/`. The draft `agent-tools/critic-drafts/explore-s1r3.mjs`
   was used as a starting point for three probes and is otherwise superseded.

Two notes for whoever ports this. The rubric policy's big-ticket rule (`goalRule` in
`games/takeoff.mjs`) now catches the revenue-priced side offers that appear late in the stage
("Lease the floor upstairs ($110,000)", "Hire a recruiter ($110,000)") and buys them ahead of the
datacenter; restricting it to the pinned card would take two to four minutes off seeds 2 and 4 and
is the fairer reading of "save for the goal". And the build's README describes its `trainfirst`
simulator policy as "the critic harness's first-timer"; in Stage 1 the harness's first-timer has no
Train-first rule (it has one from Stage 2), which is why the simulator and the harness disagree
about how often Stage 1 trains.
