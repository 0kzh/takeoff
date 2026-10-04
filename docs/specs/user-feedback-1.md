# Owner feedback 1 — the opening, training gates, power, one datacenter

The project owner played the build of 2026-10-04 and gave four notes. Where they disagree with a critic-driven
rule, the owner's note wins and the rule is amended (list at the end of section (a); `arc.md` carries the edits).

1. `Undertrained: n of m GPUs` is the normal state from the middle of Stage 1; it should be a requirement that
   blocks `Train`, not a warning.
2. It is not obvious that GPUs need power; capacity should be a meter, not bare numbers.
3. The Abilene ladder asks for too much at once; go back to one `First Datacenter` purchase.
4. The start of Stage 1 shows too much at once.

Section (a) answers note 4. Section (b) puts numbers on notes 1–3. Section (c) lists what changed in the other specs.

---

## (a) The Stage 1 opening, one mechanic at a time

### What the references show in their first five minutes

Measured by the critic's harness (`docs/critic-stage1-round2.md` §2a, §2c, §2e) and read from the sources
(`docs/reference-analysis.md` Part I §6.3–6.4, Part II §3). "Numbers" are numeric readouts outside the log or console.

| Time | Universal Paperclips | A Dark Room | Takeoff as built |
|---|---|---|---|
| 0:00 | The whole business: `Paperclips: 0`, Make Paperclip, Available Funds, Unsold Inventory, lower / raise, `Price per Clip: $.25`, `Public Demand: 32%`, Marketing `Level: 1` `Cost: $100`, Clips per Second, `Wire: 1,000 inches` `Cost: $20`. **10 numbers, 5 controls**, no sentence of explanation | A title, one button (`light fire`), two log lines (`the room is freezing.` `the fire is dead.`). **0 numbers, 1 control** | Tasks Completed, Complete Task, `Power: 1,000 kWh`, Buy Power `$20`, the date. 3 numbers, 2 controls |
| 0:30 | AutoClippers `$5` appears at 0:32 and is bought at once. 12 numbers, 6 controls | `stoke fire`; at 0:32 `a ragged stranger stumbles through the door and collapses in the corner`. 0 numbers, 1 control | By 0:06 the Business panel (funds, unbilled, price, the billing line, Marketing level and cost) and the Compute panel (Rent GPU, `0 / 80`). **13 numbers, 6 controls**; first GPU at 0:12 |
| 1:00 | The same screen. The first price cut was at 0:44 | The stores box with one row (`wood`), a second place (`A Silent Forest`), `gather wood`. 1 number, 2 controls | The same screen; Buy Power and Rent GPU both affordable |
| 2:00 | The same screen (`500 clips created in 1 minute 46 seconds`) | 2:04 the stranger `says she builds things`; `trap` and `cart` appear. 1–2 numbers, 4 controls | Price cuts from 1:20; the Developments column from 1:34 |
| 3:00 | The same screen | The first event (a visitor at the door) | 3:06 the Research panel (Trust, next Trust, Hire, Research `0 / 1,000`) |
| 5:00 | 4:54 Trust, Processors, Memory, Operations and three projects in one beat. About 20 numbers | About 12 reveals and 21 log lines so far; 1–3 numbers | Projects (a card every 15 s from 3:46), Insight, the Grid Contract; Training at 5:12–5:44. About 25 numbers |

Paperclips puts its whole business on screen at second 0 and then adds one thing in five minutes. A Dark Room
starts with one verb and adds one thing at a time, each announced by a sentence. Takeoff was built to match
Paperclips (and passed it: 13 numbers six seconds in, against 10). The owner's note asks for A Dark Room's opening
with Paperclips' economy behind it. The four lessons they listed, in their order, are the plan below.

### The new opening

One beat teaches one thing. A beat fires on its trigger, but never sooner than 30 s after the beat before it
(beats 1–4 follow the player's own first clicks and do not wait). Times are for a steady player (two clicks a second
for the first minute); in brackets, a button-masher and a slow one, from a paper model of these rules.

| Beat | Trigger and time | The one thing it teaches | Exactly what appears (ids · reveal flag) | The console line | Deliberately not on screen yet |
|---|---|---|---|---|---|
| 0 | 0:00 | There is one thing to do | `consoleDiv`, `h2#tasksHeader`, `btn-task` · `console`, `task` | `Welcome to OpenMind. Customers are waiting.` | Everything else: no power, no funds, no date |
| 1 | The first click | A task pays | `panel-business` with one line, `Available Funds: $ 0.25` (`#funds`) · `business` | `Task complete. The customer pays $0.25.` | Price, unsold tasks, the billing line, Marketing |
| 2 | Funds ≥ $3 — 0:05 (0:02, 0:07) | There is something to save for: the first greyed goal | `panel-compute` with `btn-gpu` greyed and `Cost: $ 6.00` (`#gpuCost`) · `compute` (rule unchanged) | `GPUs can be rented. Each one runs a copy of Sage.` | The `GPUs rented` line, the quota |
| 3 | The first GPU — 0:11 (0:05, 0:15) | A copy completes tasks without a click | `GPUs rented: 1` (`#gpus`, no `/ 80`) · new flag `fleet`. The header starts counting on its own | `GPU rented. A copy of Sage completes a task every second.` | The quota, `Copies running`, power |
| 4 | The third GPU, or 20 s after the first — 0:26 (0:14, 0:34) | Copies burn power | `panel-power`: `Power ｢￭￭￭￭￭￭￭￭￭￭｣ 968 kWh` (`#power`, new `#powerMeter`) · `power`. It drains as the player watches: one cell per 100 kWh | `Each task a copy completes burns 1 kWh. The meter drains.` | Buy Power |
| 5 | Power ≤ 800 kWh (two cells gone) — 0:56 (0:45, 1:10) | Power has to be kept on | `btn-buyPower` and `Cost: $ 20.00` (`#powerCost`), usually greyed · `buyPower`. Under 20 % the meter takes the `warn` style | `Power is draining. Copies stop when it runs out.` | The Grid Contract (a project, as now) |
| 6 | A backlog has formed: 20 tasks unsold and rising — 1:26 (1:15, 1:43) | Supply can outrun demand; the price decides how much sells | `btn-lowerPrice`, `btn-raisePrice`, `Price per Task: $ 0.25` (`#price`), the sales line (`#billingLine`, reworded below), `Unsold tasks: 197` (`#unbilledLine`) · new flag `pricing` | `Sage makes more than customers buy at $0.25. Unsold tasks are piling up.` | Marketing, revenue per second, `Public Demand` |
| 7 | The first price change + 30 s, or beat 6 + 45 s — 2:02 (1:51, 2:19) | More customers at every price | `marketingBlock`: `btn-marketing` greyed, `Cost: $ 100.00` · `marketing`; and `Avg. Rev. per sec` · `revPerSec` | `Marketing brings more customers at every price.` | `Level` (it appears with the first purchase) |
| 8 | The first Trust milestone (2,000 tasks) — 2:32 (2:21, 3:10) | Trust hires researchers | As built: `panel-research` with Trust, the next milestone and Hire · `research`, `hireResearcher` | As built: `Trust earned: 3. Each one hires a researcher.` | Expand Lab, Projects |
| 9+ | As built | Expand Lab when the lab fills; Projects 40 s after Research; Training with its project | As built. The Developments column's first line is held until 3:30 (it arrived at 1:34), and `#gameDate` arrives with it | As built | — |

**The market.** `MARKET_START` becomes 3, the built full size, so from the first second customers buy up to 8.6
tasks a second at $0.25 and there is no ramp: every click and the first eight GPUs sell everything they make,
which is what "every task simply sells" means here. The backlog forms because the fleet grew past that, at about
the ninth GPU (0:35–1:25), and that is the lesson. Because power is taught first, a fast player's unsold line
arrives up to 40 s after the backlog began, reading 200–400 unsold; in that time income has flattened at $2.15 a
second, not fallen, and the line explains it. Nothing else in the market changes.

**Lines rewritten for a newcomer.**

| Was | Now |
|---|---|
| `Billing 0.0/s of 0.0/s produced: idle` | Hidden until beat 6. Then one sentence, by the built `marketState`: backlog growing → `Customers buy 8.6 of the 24.0 tasks Sage makes a second. Unsold tasks pile up.` · backlog shrinking → `Customers buy 30.1 a second; Sage makes 24.0. The pile shrinks.` · selling out → `Every task sells. Customers would pay more.` · idle → no line |
| `Unbilled Tasks: 46` | `Unsold tasks: 46` (hidden until beat 6, and while it is zero) |
| `GPUs rented: 0 / 80` | `GPUs rented: 3`. The quota appears at 60 rented (new flag `quota`) as a meter, `GPUs rented ｢￭￭￭￭￭￭￭￭･･｣ 61`, with one line, `The cloud will rent OpenMind 80 GPUs and no more.` |
| `Power: 1,000 kWh` at second 0 | The meter, from beat 4 |
| `Marketing` · `Level: 1` · `Cost: $ 100.00` at the first sale | `Marketing` `Cost: $ 100.00` at beat 7; `Level: 2` from the first purchase |
| `Billing lags production at $0.24. Lower the price or market.` | `Sage makes more than customers buy at $0.24. Lower the price.` — and `or buy Marketing` only once Marketing is on screen |
| `Power exhausted — copies idle.` | `Power is out. The copies have stopped. Buy Power starts them.` |
| `lower` / `raise` (effect in the tooltip only) | Unchanged labels; under them, once: `lower: more tasks sell, each earns less` |

**Numbers on screen** (outside the console), targets for the sim's five-minute report and the Playwright count:

| | 0:00 | 0:30 | 1:00 | 2:00 | 3:00 | 5:00 |
|---|---|---|---|---|---|---|
| Numbers | 1 | 4 | 6 | ≤ 11 | ≤ 17 | ≤ 22 |
| Controls | 1 | 2 | 3 | 5 | ≤ 7 | ≤ 10 |
| What they are | tasks | + funds, GPU cost, GPUs rented | + power, power cost | + price, bought and made a second, unsold; Marketing cost | + revenue; Trust, the next milestone, researchers, research and its cap | + the first project prices |
| As built | 3 | 13 | 13 | 13 | 17 | about 25 |

**The first GPU** costs $6.00 and every click pays $0.25 at once: 24 clicks, 12 s at two a second, 16 s at one
and a half. (As built the market billed 2.0 tasks a second however fast the player clicked.)

**The greyed goal.** The first is `Rent GPU` at beat 2, about five seconds in and before the first purchase. From
the first purchase on, one stays: the next GPU until beat 5, then Buy Power ($20, greyed whenever the player has
just rented a GPU), then Marketing ($100, the first goal a minute away), then projects as now. Between beats 3 and 5
(about a minute) the only goal is the next GPU, which an active player affords every few seconds, so it is often
lit rather than grey.

**What this costs against the critic's guardrails, honestly.**

| Guardrail | As it stood | What the new opening does | Amended to |
|---|---|---|---|
| G3 greyed goal | on screen ≥ 99 % of ticks, from second 0 | None for the first 5 s; for about a minute the goal is the next GPU, lit about half the time | From the first purchase onward. In Stage 1's first three minutes the next unit of the newest mechanic (a GPU, a power block) counts, lit or grey |
| G10 first meaningful choice | ≤ 90 s | GPU or power from 0:56 (0:45–1:10), once both can be afforded; price at 1:26 | A new game: ≤ 120 s for the reasonable bot, ≤ 150 s for the naive one |
| G5 disclosure spike | ≤ 8 new numbers and ≤ 3 new controls in a beat | Tighter: one mechanic a beat | Stage 1's first five minutes: ≤ 4 new numbers and ≤ 2 new controls in a beat; beats ≥ 30 s apart after the first GPU |
| G14 on-screen load | ≤ 65 numbers, within 25 % of Paperclips | The table above; under Paperclips for the first two minutes | Adds the opening targets: 1 / 4 / 6 / 11 / 17 / 22 numbers at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00 |
| G1 reveal gap | ≤ 180 s | Longest opening gap about 35 s | Unchanged |
| The critic's "first decision in words" (the billing line two seconds in) | praised in round 2 | Moved to beat 6 and reworded | The owner's note wins: a line nobody can read at second 2 is not a decision |

What is lost: for most of the first minute the player has one thing to buy, the critic's harness will score that
stretch lower on "choice" than the built opening, and a fast player's backlog is invisible for up to 40 s. From
3:00 the screen is as full as it was; the saving is in the first two minutes (1, 4 and 6 numbers where there were
3, 13 and 13). What is gained is the owner's point: each number on screen was put there by something the player
just did or just saw happen.

**For the engine.** New reveal flags `fleet`, `pricing`, `quota` (and `#gameDate` under `log`). `power` and
`buyPower` leave Stage 1's `enter` and become rules (beats 4 and 5); `marketing` and `revPerSec` move to beat 7.
`MARKET_START = 3` (no ramp). Beat 6's trigger is `unbilled ≥ 20` and rising. A 30 s spacing between beats 4–8.
`#powerMeter` is section (b)'s meter. Starting power stays 1,000 kWh and a click still never needs power. Saves
from before this change set all the new flags true.

---

## (b) Numbers for notes 1–3

Checked against what the engineer has in `engine/training.ts` today (`gpusFor`, `gpusNeeded`, `busyGpus`).

### B1. What a run needs (note 1)

There is no yield and no `Train now` anywhere in the game. A run needs N GPUs; without them `Train` is disabled
and says why; with them the run gains in full. The N GPUs serve no customers while it trains.

| Stage | Rule (c = the capability the run starts from) | Run by run |
|---|---|---|
| 1 | `N = 10 × c^4.55`, rounded to 5 | 10 / 15 / 30 / 45 / 80 GPUs at 1.00 / 1.12 / 1.25 / 1.40 / 1.57× |
| 1, from 1.6× | the Stage 2 rule | 600 at 1.60×, 780 at 1.66×, 1,200 at 1.76×: more than the cloud rents (80; 140 with all three lease cards). This is the wall |
| 2 | `N = 600 × (c/1.6)^7` G4-equivalents, two significant figures | 780 / 1,700 / 5,600 / 10,000 / 18,000 / 39,000 / 77,000 / 140,000 / 260,000 / 310,000 at 1.66 / 1.85 / 2.2 / 2.4 / 2.6 / 2.9 / 3.2 / 3.5 / 3.8 / 3.9× |
| 3 (for the as-built patch, provisional) | `N = 300,000 × (c/4)^1.3`; Auto-train waits for it and the status line says so | 0.31M / 0.51M / 0.99M / 1.8M / 3.2M at 4.07 / 6 / 10 / 16 / 25× |
| 4–5 | none: generations and compute are the fleet's business | — |

`Distributed training` (a third fewer GPUs) carries through Stages 1–2 as built.

**One thing the brief's numbers need.** With the built Capability gain (+14–20 %) and no yield to shrink it, the
rented fleet trains three models, not five: the runs start at 1.00 / 1.17 / 1.37× (10 / 20 / 40 GPUs) and the
fourth, from 1.60×, already needs 600. Yield used to cut the later gains to about 10 %. For five rented runs,
Stage 1's Capability gain becomes **+10–14 %** (Efficiency and Safety stay at +5 %); the table's first row is
that path. Research and funds prices are functions of capability and do not move.

**Checks on Stage 2.** Against the built fleet at each run (median bot: 5,000 GPUs at 1.85×, 14,000 at 2.2×,
47,000 at 2.6×, 85,000 at 2.9×, 420,000 G4-equivalents at 3.35×, 579,000 at 3.9×) the rule asks for 26–54 % of
the fleet, 17–36 % with Distributed training. So the reasonable player is never stopped by it, the busy GPUs cost
about what "half the compute" did, and the gate bites only a player who has under-built — who now reads
`Needs 18,000 GPUs. 14,200 free.` beside three lot buttons, which is the direct line from money to training that
the Stage 2 critic asked for. Two details: `60 + 8 × log2(N/1,000)` gives 57 s at 780 and 126 s at 310,000, so
clamp it to 60–110 s (G9); and in Stage 1 the fifth run takes all 80 of a base quota, so task production stops
for 75 s unless a lease card was bought — say so on the row (`All 80 GPUs are training.`), it is what the lease
cards are for.

Acceptance (sim, seeds 1–5): time `Train` is blocked for want of GPUs ≤ 5 % of Stage 2 for `bot`, ≤ 25 % for
`trainfirst`; training starts 180–300 s apart on average, never more than 330 s; 10–12 runs; Stage 2 in 36–44
minutes. Knob: the 600 (±100 moves a first-timer about a minute and the bot not at all); then `S2_RUN_BASE`.
Leave the exponent.

**The Train row.**

| State | Reads |
|---|---|
| Ready | `Train Sage-1.3` · `Cost: 7,400 research, $3,480` · `Needs 35 GPUs for 1:03` |
| Short, Stage 1 | `Needs 45 GPUs. 38 rented. Rent 7 more.` |
| The wall | `Needs 1,200 GPUs. The cloud will rent 80. Build the First Datacenter.` The card turns `urgent`; the line repeats every 180 s (G31) |
| Short, Stage 2 | `Needs 18,000 GPUs. 14,200 free.` — or, when the missing ones are unpowered, `Needs 18,000 powered GPUs. 6,000 are dark: add power.` |
| Training | `Training on 35 GPUs — 0:48 left. They serve no customers until it is done.` |

### B2. First Datacenter (note 3)

| | |
|---|---|
| Card | `p_datacenter`, retitled `First Datacenter`, pinned. `1,000 GPUs of our own at Abilene. Stop renting.` |
| Appears (greyed) | When Series A is bought, or at the second release, or in October 2025 — whichever comes first. About minute 10–12, so 9–14 minutes before it is bought (G11 asks for 8) |
| List price | **$150,000** |
| At the wall | The first time a run needs more GPUs than the cloud will rent, the price is set once, down only: `clamp(240 × revenue per second, $90,000, $150,000)`, with a line: `Abilene fast-tracks the permit. First Datacenter: $118,000.` A player with nothing saved then waits four minutes at most; one who has saved since the card appeared, one or two |
| Buying it | Stage 2 at once, with the built arrival (1,000 GPUs, 5 MW, Datacenter 1) and the built narration |
| Removed | `p_site`, `p_interconnect`, `p_substation`, `p_expedite`, `p_contractor`; `panel-site` and its flags (`site`, `interconnect`, `powerMW`); the interconnect countdown; pinned rungs and rung pricing (`rungFunds`, `rungScale`) |

The $150,000 is an estimate from the built ladder (rungs worth $345,000 were paid over 18 minutes at $130–530
a second of net saving). Tune it so the reasonable bot buys 60–150 s after the wall and `trainfirst` within 240 s.

**Stage 1's length and calendar.** Target 20–26 minutes (was 29–32). Months go from 300 s to **240 s**, so July to
December is 24:00: every date-keyed card keeps its place, the six calendar modals fall 2:36 apart at about 8:50,
11:25, 14:00, 16:35, 19:15 and 21:50, and the date still reads December when Stage 2 begins. Runs: 5 (arc R14 said 7).

**What keeps the last ten minutes moving.** No new content: the cards exist. Six hung on rungs and are re-keyed
to the moment the First Datacenter card appears (`dcCardAt`); two become real trades against it.

| Card | Was keyed on | Now | Why it is not a rung |
|---|---|---|---|
| `Closed-loop cooling` ($10,000, +1 Trust) | site + 30 s | `dcCardAt` + 60 s | Money for Trust |
| `Power purchase agreement` (7,000 research, power 30 % cheaper) | interconnect + 60 s | `dcCardAt` + 150 s | Research for a cost the player is paying now |
| `Take the county's tax abatement` (1 Trust) | interconnect done | `dcCardAt` + 300 s; First Datacenter costs a sixth less | Trust against money, on the big purchase |
| `Build a sound wall` ($5,000, +1 Trust) | substation + 100 s | `dcCardAt` + 420 s | Money for Trust |
| `Distributed training`, `Alignment team` | third run | unchanged (≈ 15:00) | — |
| `Lease the floor upstairs` | fourth run | unchanged (≈ 18:30) | — |
| Date-keyed: `Batch inference`, `Hire a recruiter`, `Agent mode`, `Publish a safety framework`, `Renewal season` | Oct, mid-Oct, Nov, mid-Nov, Dec | the same dates, now 12:00, 14:00, 16:00, 18:00, 20:24 | — |

With the release-keyed cards (`Usage-based pricing`, `Workshop paper`, `Conference keynote`, `Mixture of
experts`), the lease cards near the quota and the six modals, minutes 13–23 hold about sixteen first-time reveals
and no gap over two minutes on paper. Acceptance stays G1 (≤ 180 s), measured over the last ten minutes of each seed.

### B3. The meter (note 2)

| | |
|---|---|
| Style | The article's own recommendation: `｢￭￭￭￭￭￭￭･･･｣` — U+FFED filled, U+FF65 empty, U+FF62 / U+FF63 caps. Halfwidth forms keep one width in a proportional font, which is what the game uses |
| Width | 10 cells. A store that drains shows `ceil(10 × have / scale)` cells, so the last cell goes out only at zero; a capacity in use shows `round(10 × used / cap)`, and the tenth cell lights only at 99.5 % |
| Fallback | At boot, measure both glyphs in a hidden span; if either is missing or their widths differ by more than a pixel, use `[■■■■■■■□□□]` in a monospace span. One function, `meter(fraction)`, DOM-free, used everywhere below |
| Counting | A meter replaces the `/ cap` half of a pair, so every row it is on shows **one number fewer** than today. The cap's figure moves to the row's hover, and comes back in words only when the meter is full, with the fix |

| Where | Was | Now |
|---|---|---|
| Stage 1 power | `Power: 712 kWh` | `Power ｢￭￭￭￭￭￭￭￭･･｣ 712 kWh`. Scale: the block Buy Power sells (1,000, then 10,000, then 100,000 kWh) |
| Stage 1 quota | `GPUs rented: 61 / 80` | `GPUs rented ｢￭￭￭￭￭￭￭￭･･｣ 61`, from 60 rented; hover `the cloud rents 80` |
| Stage 2+ GPU room (Stores) | `GPUs 17,105 / 25,000` | `GPUs ｢￭￭￭￭￭￭￭･･･｣ 17,105`; full: `25,000 — the halls are full · Build Datacenter` |
| Stage 2+ power (Stores) | `power 5.0 / 5 MW`, with `Powered GPUs: 5,000` hidden | `power ｢￭￭￭￭￭￭￭￭￭￭｣ 5 MW · runs 5,000 GPUs`; full: `… · full · Gas turbines add 20 MW` |
| Training, when short | `Compute: 59 of 408 GPUs wanted · undertrained (38%)` | `GPUs for Sage-2.3 ｢￭￭￭￭￭￭￭￭･･｣ 14,200 of 18,000`; when there are enough, no meter: `Needs 18,000 GPUs` |

**The dependency, in words on the rows.** Every lot button: `+1,000 GPUs · uses 1 MW of 4 free`. Every power
button: `+20 MW · runs 20,000 GPUs`. Rent GPU, once power has been taught: `each copy burns 1 kWh a task`.

**No lot into no power.** A lot button is disabled when the lot would not be powered or housed, with the reason
and the fix on the row (the built `lotReason` and `wallFix`): `No power for them: 0 MW free. Gas turbines add
20 MW.` The Standing order obeys the same rule. A save that already holds unpowered GPUs shows them on the
power row (`12,105 GPUs dark`) until power catches up.

## (c) What changed in the other specs

| File | Changed | Left for later |
|---|---|---|
| `arc.md` | A new amendments list (owner feedback 1). §2A: Stage 1 is 20–26 minutes at 240 s a month, about five runs, entered Stage 2 by `First Datacenter`. R14's run counts. The S1→S2 reshuffle and Stage 1's bottleneck row lose the ladder. G3, G5, G10 and G14 amended as in (a). The Pause's lead is 1 month (from the paused Stage 3 patch) | §2B's Stage 1 exit scale (tasks, funds at the boundary) waits for the retuned sim |
| `stage2.md` | An amendment table at the top. §2.5: `N(c) = 600 × (c/1.6)^7` as a hard gate, no yield, gains in full, the duration rule, the table's GPU column, the Train row's wording. The soft-lock row for training compute. Entry is `First Datacenter` | §1's arrival numbers and the preset: rebuild from the sim's median `First Datacenter` state. §9's 5-minute marks |
| `stage3.md` | The as-built patch is marked paused, with what was verified and what will move. Its rows 3 and 7 follow notes 1–3 (a hard gate, provisionally `300,000 × (c/4)^1.3`; no `Train now`). §2.5 has no yield; lot rows print the GPUs the next run needs; the soft-lock row. The paper re-run from the built arrival is recorded there (`R(c)` from 16M, halls 60 s, reactors 75 s) | Re-read the arrival from the rebuilt preset; re-run the paper model under the hard gate; §1.4, §4.3 and §9.4 minute marks |
| `stage4.md`, `stage5.md` | Nothing: neither has a yield or `Train now` | Their capacity rows (permit zones, launch mass, the swarm) take the same meter when built |
