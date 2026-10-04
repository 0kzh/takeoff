# Stage 3 — "Takeoff" (implementation spec)

Jan 2027 → Oct 2027 · target 40–50 min · enter by buying `Let Sage-3 write the code` · exit by bringing a motion to
the Oversight Committee once a model has passed 25× (`Slow down — the Steward program` or `Race — Sage-5`), or by an
ending (`Sign the Pause`, or the Committee's order: The Project). Contract: `docs/specs/arc.md`. Stage 2:
`docs/specs/stage2.md`. Written against the code as of 2026-10-03 (Stage 1 built, Stage 2 specified).

## As-built deltas (read first) — paused

**Status, 2026-10-04.** This patch was stopped part-way for owner feedback 1 (`user-feedback-1.md`): Stages 1–2
are being changed (no undertrained runs, one `First Datacenter`, a new opening, meters), so the Stage 2 exit will
move and the arrival below will be re-read from the rebuilt preset. Until then: the code facts were checked
against the build before those changes (`SAVE_VERSION` was 5; Stage 3 takes the next free number); rows marked ✱
already follow the owner's notes; where this table and anything below it disagree, this table wins; the minute
marks in §1.4, §4.3 and §9.4 are from the older assumed arrival.

**The arrival** (`presets[2]` = `stage2End` then `enterStage(s, 3)`; the bot's median Stage 2 exit at 37:14):

| Field | Built | This spec assumed | Field | Built | Assumed |
|---|---|---|---|---|---|
| `stats.timePlayed` | 3,861 s | 4,150 s | `tasks` / tasks per second | 1.13 × 10¹⁰ / 6.0 × 10⁷ | 5 × 10¹⁰ / 1 × 10⁸ |
| `funds` | $26M | $30M | revenue | $0.74M/s | $1.2M/s |
| `gpus` (G5) | 404,800 (349,000); 579,300 G4-equivalents | 800,000; 1.15M | halls / power | 7 (500,000 slots, 95,200 free) / 515 MW (room for 110,200 more GPUs) | 8 / 1,105 MW |
| `capability` / rival | 4.07 / 3.54 | 4.12 / 3.9 | `copiesPerGPU` / `copyBoost` | 9.16 / 4.69 | 9.5 / 4.7 |
| `researchAlloc` | 0.10 (research sat at its cap) | 0.20 | research per second | 60k at 10 %, 120k at 40 %; half as much again once code review is retired | 185k at 20 %, 260k at 40 % |
| `research` / `insight` | 2.88M / 8,780 | 6M / 12,000 | `aiResearchMult` / `autonomy` | 1 / 0 (`Retire human code review` unbought) | 1.5 / 5 |
| measured / true alignment | 88 / 56 (59, less 3 for `p_retention` unbought) | 74 / 58 | `securityLevel` | **2** | 3 |
| `govRelations` | 72.9, then 78.9 after 3 Trust convert | 62 | `approval` / jobs | −9.9 / 1.94M | −12 / 3.0M |
| `lead` | **1.43 months** | 5.0 | flags | `defenseContract`, `pactSigned`, `gulfDeclined`, `shareEvals`, `jobFund`, `alignShare` 0.05, standing order on at 50 % | as assumed |

| # | Delta | What Stage 3 does about it |
|---|---|---|
| 1 | **Funds scale.** Revenue on arrival is $0.74M/s (the built `S2_FUNDS_SCALE` is 2.4) | No `S3_FUNDS_SCALE`: every Stage 3 funds price is a number of seconds of revenue (§2.14). Any dollar figure left in this file was written at $1.2M/s; multiply by 0.62 |
| 2 | **Research re-base.** The built shell charges `researchFor(c)` (2.25M at 4.07×); research arrives at a third to a half of the assumed rate | `R(c) = 16,000,000 × (c/4)^3.0`: 16.9M for Sage-3.1, 1:26 away for a player who retires code review and moves the slider to 40 %, 3:53 away if nothing is touched. List research prices in §4.2 were sized to the old runs: multiply by 0.64; the 90 s floor still applies. Run on paper, below |
| 3 ✱ | **GPUs for a run.** The yield mechanic is withdrawn game-wide | A run needs `N(c) = 300,000 × (c/4)^1.3` G4-equivalents (0.31M at 4.07×, 0.99M at 10×, 3.2M at 25×; about 30–50 % of the paper fleet) or it does not start; Auto-train waits and the status line says for what. Gains are in full. Provisional: the paper run below still used a yield |
| 4 | **Lots.** Built: three sizes side by side (1,000 / 5,000 / 25,000), each printing its return (`lotReturn`, `lotNote`); lots hold money back for the next run, an open offer or the nearer wall's fix and say so (`lotHold`, `holdNote`). In the shell the bot presses the smallest five times a second | Extend, do not rebuild: the same three buttons at 10,000 / 25,000 / 100,000 for 4 / 10 / 40 s of revenue at the press, **each a 75 s shipment, one landing at a time, two on order**, from the first second (G5 chips until `Nimbus G6 allocation`, which changes what a lot holds, not what it costs). A run costs no money, so the hold is for an open offer or a wall's fix only |
| 5 | **The standing order is a budget button** (25 / 50 / 75 / 100 % / off), on at 50 % at arrival | It stays; it is not retired (this corrects §2.1). `Let Sage plan the build-out` extends it to halls and reactors, removes those two buttons and hands over `Build-out: lean / ahead` |
| 6 | **Halls and plants.** Built: no "to spare" locks; a hall takes 1:30 and opens a quarter at a time; approval under −30 adds a minute; reactors are 500 MW, 2:00, a quarter off at relations ≥ 60. Gas and solar are hidden in Stage 3. The median player still has Datacenter 8 (+300,000) to build | Keep all of it. Datacenter 8 keeps its built price ($11.5M). After it a hall costs **60 s** of revenue and a reactor (1,000 MW) **75 s**, at the press. Amendment 9's 120 s and 150 s were never run: on paper from this arrival they hold the fleet at 0.5M GPUs until minute 10 and leave one run interval of 5:38 |
| 7 ✱ | **Train now** existed in Stage 2 and is withdrawn game-wide (owner feedback 1) | Not carried. `Train` is greyed until research and GPUs suffice, with the built shortfall and ETA line; `Continual learning` then starts runs itself |
| 8 | **Release / Keep internal** and two pipeline slots are built and survive into the shell | On arrival both buttons become one `Approve` (§2.5). If Sage-3 was kept internal (`flags.sage3Released === 'internal'`), `flags.publicCap` starts at the deployed model's capability |
| 9 | **Tiers.** `MAJOR_TIERS` is `[2, 4, 8, 16, 32, 64]` and `NEAR_MISS` is 0.98 | Stage 3 needs `[2, 4, 10]` (Sage-4 at 10×; the next name comes from the vote) and applies the built 2 % rounding at 10× and 25× |
| 10 | **Focus** prints its trade under each button (built) | Reuse; Stage 3's three lines are in §2.5 |
| 11 | **The slider** is one slider (5–50 %, at 10 %) with its rates in the Stores hover | Becomes three-way (§2.2) with the rates beside it. The arrival narration's fourth line ends `… Move copies to research to bring it nearer.` |
| 12 | **Meters with bands** are built (`govBandNote`, `approvalBandNote`, `alignBandNote`): relations ≥ 80 halves the solar queue, ≥ 60 reactors a quarter off, < 30 a subpoena; approval < −30 slows permits, ≤ −40 protests; measured alignment < 55 advisories | Extend the same three functions with §2.14's Stage 3 bands; the solar band is replaced by `8 seats: shipments take 60 s`. Relations arrive at 79 and measured alignment at 88, both in their top bands, so `Lobby` has little to do before the first incident; if the band criterion (B33) fails for relations, the knob is the monthly drain |
| 13 | **Clamps.** Built `enterTakeoff` keeps the arc's clamps and narrates them in Developments (`A new Congress sits. Relations start again at 85 (from 96).`); the lead clamp [1, 9] is silent | Built behaviour stands (this corrects amendment 14 and §1.1). Add a line for the lead clamp when it binds |
| 14 | **Lead scale.** The built Stage 2 ends at 1.4 months, not 5 | Lead thresholds are halved: the Pause needs **1 month** (arc §4 is amended); bands `4: Washington relaxes · 1: a halt can be offered · 0.5: Washington panics`. Movers are unchanged. On paper the reasonable bot reaches the session at 2.2–2.3 after reporting the memo; the naive policy at 0.2–0.5 |
| 15 | **Security.** The median arrival is SL2, and the built `Security level 3` button costs $48M **and 3 Trust**, which Stage 3 has just set to zero | SL3 in Stage 3 costs 60 s of revenue and no Trust, and is `urgent` on arrival below SL3. The February theft (4:50) is what a player meets unless they buy it in the first four minutes |
| 16 | **Code review.** `Retire human code review` (1.2M research, research ×1.5, autonomy +5, true −2) is carried and unbought at the median arrival | It is the first autonomy grant the player meets: affordable on arrival, listed with the grants, and it prints the WARNING line |
| 17 | **Anthrosoft** follows its own schedule (`rivalPace`, keyed on `timeInStage`, so in the shell it restarts at 1.55×) and is never left below 0.8× Sage's best | Give Stage 3 its own schedule from 3.5× to about 9× in 45 minutes and keep the built 0.8× floor. This replaces §2.10's band |
| 18 | **Scheduler.** Built: 15 s drip (30–60 s only in Stage 1), six visible cards, `urgent` cards for standing walls, wall lines on a 120–180 s repeat, a 170 s governor and a 240 s mechanic governor, late items 75 s apart | Extend `dripSeconds` (30 s for Stage 3's first five minutes) and the late list (a capability threshold with the date fallback), and add the grant list outside the cap. Use the built 170 s where this file says 150 s |
| 19 | **Events.** Built: every event has a timer, the panel is non-blocking and opens beside the Stores, options print effect and cost (`optionLine`, `optionNeeds`) | §5.2's "On the button" column is the built option line. `c_memo`, `c_order` and `c_vote` have no timer: register them as held cards that do not occupy the event queue or stop the calendar |
| 20 | **What leaves on arrival, and what replaces it in the same beat (G28).** The built shell hides Marketing, Hire, Expand, gas, solar, alignment compute and the data row, and shows Alignment | Still to do: `Release` + `Keep internal` → `Approve`; alignment compute → the Monitors slider (through the free `Deploy Sage-2 as monitor`); Trust → the `Lobby` button; the job fund → `Payments` level 1 when that button appears; gas and solar → the reactor row |
| 21 | **Sim.** Built policies `bot`, `naive`, `greedy`, `trainfirst`; `--preset N`; `--variant`; a hands block (G24 nothing enabled, G25 two or more, G26 click gaps, longest release interval) from `enabledPurchases` | `bot` is this file's reasonable bot. Add `racer` and `cautious` as policies and §9.3's variants. Stage 3 reports the hands block for all six policies from `--preset 3` and from a new game, and its B-table |
| 22 | **Small things.** `c_gamble` is allowed three times a stage (built); each release pays 6 insight (built); `sl3Button`, `stats`, `shareEvals`, `jobFund` flags carry | No gamble in Stage 3; insight accrues as in §2.4 and the 6 per release stops; the carried toggles are as §1.1 says |

**Paper re-run from the built arrival** (the §9.4 model with rows 1, 2, 4, 6, 14–16; seeds 1–5; it still has a
yield on `600,000 × (c/4)^1.5` and none of the repeatable sinks, which should add about two minutes):

| Policy | Exit | Runs | Mean / max run interval | First run | GPUs at exit | Lead at the session |
|---|---|---|---|---|---|---|
| Reasonable | 39:43–43:13 | 15–16 | 159–165 / 226–250 s | 1:26 | 2.6–2.9M on 3.5 GW | 2.2–2.3 (Pause offered) |
| Naive (never moves the slider off 10 %) | 53:08–55:07 | 9 | 358–367 / 461–467 s | 4:09 | 3.1–3.5M | 0.2–0.5 |
| Racer | 30:42–33:52 | 11–12 | 169–178 / 238–250 s | 1:17 | 2.1–2.2M | 3.3–4.6 (memo buried) |
| Cautious (no grants) | 60:03–63:52 | 17 | 208–228 / 264–341 s | 1:58 | 4.1–4.5M | −0.2–0.2 |

Seed 1's marks: 0.6M GPUs and $1.1M/s at 5:00; 0.8M and $2.4M/s at 10:00; 1.6M and $8M/s at 20:00; 2.4M and
$39M/s at 30:00; 2.7M and $52M/s at 40:00. True alignment is shown at 22:08 (was 18:47). The decision variants of
§9.3 still separate (neuralese −4.4 min, Safety focus +11, research 20 % / 70 % +5 / −6, no grants +20). Open:
mechanic gaps of 301–378 s (B4), the naive policy at the edge of B1, and holes of 450–590 s late in the cautious run.

## Amendments after critic round 2 (arc G16–G23)

| # | Change | Where |
|---|---|---|
| 1 | **Stakes are on the buttons.** Every modal option prints its effects and costs under its label; funds stakes are sized when the modal opens | §5.2 |
| 2 | **Fewer, heavier modals.** `c_theft` is cut (the theft is a crisis, with SL3 at half price for five minutes). `c_blockade`'s options now carry stakes Stage 4 reads (`flags.escalated`, `flags.backChannel`). An unmitigated strike on Al-Marsa is a major incident | §5.2, §5.3 |
| 3 | **Price floor.** At reveal a project costs at least 90 s of its currency's current rate; a prerequisite gates the purchase, not the appearance; projects drip 30 s apart for the first five minutes | §4.1 |
| 4 | **Late items** appear at their capability threshold or on a date fallback from September 2027, so a slow player still gets them | §4.1 |
| 5 | **Modals are docked cards**; nothing behind them is blocked | §5.2 |
| 6 | **The promised number** on arrival is research: it has no ceiling, and it visibly passes the old one | §1.2 |
| 7 | **Text budget:** instrument readings are four to six words on the panel (the sentence goes to the console once); ≤ 260 words on screen | §2.8, §6.3 |
| 8 | **Decision variants** and their measured spread are in the acceptance block, with five new criteria | §9.3, §9.4 |

The paper model was re-run with changes 3 and 4: reasonable exit 45:33–46:21 (was 42:02–42:47), naive 50:35–52:16.
Minute marks in §1.4, §4.2 and §4.3 are from before the floor; the order holds and later marks slip by 3–4 min.

## Amendments after the Stage 2 critic (arc G24–G33)

Where this list and an older paragraph disagree, this list and the sections it names win.

| # | Change | Where |
|---|---|---|
| 9 | **Money stays spendable to the end.** Every funds price is quoted in seconds of revenue (fixed in dollars when the row appears); `S3_FUNDS_SCALE` is dropped. The earlier claim that revenue stops binding after ten minutes is withdrawn: what stops depending on money is the training loop | §2.1, §2.14 |
| 10 | **Five repeatable sinks with printed returns:** `Alignment work` and `Experiments` (research); GPU lots in three sizes, `Lobby`, `Counter-intelligence` (revenue); and `Payments` as a level. `p_impact`, `p_lobby` and `p_export` become these buttons | §2.14 |
| 11 | **Each grant hands over a heavier lever** in the same beat: `Experiments`, `Red-team depth`, `Build-out budget`, `Step size` and `Hold` | §2.6 |
| 12 | **Rates beside the sliders; Focus stakes under the buttons** | §2.2, §2.5 |
| 13 | **Meters bite inside the stage**, with their band edges printed in the panel | §2.14 |
| 14 | **No silent changes:** the arrival's clamps are narrated (built; see the as-built deltas, row 12). A run landing just under 10× or 25× is rounded up (the built 2 %) | §1.1, §2.5 |
| 15 | Wall and warning lines repeat every 180 s and name the control that answers them; `Deploy Sage-2 as monitor` and a card that answers a wall are drawn `urgent`; console lines never name a removed verb | throughout |
| 16 | `R(c)` starts from 22M, not 25M, so that a player who puts a seventh of research into `Alignment work` lands where the model did. Superseded: 16M, from the built arrival (as-built deltas, row 2) | §2.5 |
| 17 | Hands criteria B27–B35 in the acceptance block | §9.3 |

## What the player's hands do

Three resources, each with competing uses at every minute: **copies** (the allocation), **research** (the run,
alignment, the next run's size, labs and grants) and **revenue** (compute, seats, lead, approval, one-shot
security). Returns are printed beside each control.

| Minutes | What can be pressed | It costs | It returns (printed beside it) | The same resource could instead |
|---|---|---|---|---|
| 0:00–0:30 | `Deploy Sage-2 as monitor`; the three allocation sliders; `Alignment work`; `Buy GPUs` in three sizes; `Lobby`; Focus; `Train` | nothing; copies; 2 % of a run's research; 4–40 s of revenue; 15 s of revenue; —; the run's research | each slider's rate; `measured 74.0 → 74.1`; `+0.9% tasks/s · the next run needs 0.31M`; `relations 62 → 63`; the Focus trade; the run | copies: tasks, research or monitors. Research: the run, or alignment. Revenue: compute, or a seat |
| 0:30–5:00 | `Continual learning` takes `Train` and hands over `Experiments`. Lab I; `Approve` and `Red-team` each run; `Counter-intelligence` from 2:30; Datacenter 9 and the first reactor, ahead of need | insight; research; revenue | `Sage-3.2: +18.0% → +18.3%`; `Baiwen 5.0 → 5.1 months`; room and power, with the lot they unblock | research: a sooner run, a bigger run, or alignment. Revenue: four sinks |
| 5:00–14:00 | The build-out grant takes the three build buttons and hands over `Build-out budget` (0 / 25 / 50 % of revenue). Red-team's grant hands over `Red-team depth`. `Send back` with lab II; `Payments` level from about 11:00; neuralese | as above | `a lot every 1:15`; `approval target −31 → −24 · 3% of revenue` | revenue: the budget, seats, lead, payments, SL4, the stockpile |
| 14:00–27:00 | The Committee: seats now shown with what each band does. Lab III, the shutdown system, `Re-image`, SL5. `Stop asking for sign-off` takes `Approve` and `Send back` and hands over `Step size` and `Hold` | research; revenue | `Step size: large — gains ×1.3, the run the alignment team likes least` | research: three labs' worth, or six runs sooner. Revenue: SL5 or the second source or 40 seats' worth of lobbying |
| 27:00–exit | Everything above, the late tests, the memo, the two motions, `Hold` | — | each test's reading | research: the last runs, or knowing what they are |

The stretch that worried me most was 14:00–27:00: runs are automatic, most grants are bought, and in the earlier
draft money had nothing left to buy. Now research has two repeatable sinks whose printed cost is a delay to the
next run, revenue has four whose prices rise with use, and each grant leaves a dial behind.

**How to read the numbers.** `ts` = seconds since entering Stage 3; a month is 270 s (Feb 4:30, Mar 9:00, Apr 13:30,
May 18:00, Jun 22:30, Jul 27:00, Aug 31:30, Sep 36:00, Oct 40:30). Minute marks are for the reasonable bot from the
Stage 3 preset, from a 1-second paper model of this spec (§9.4); they are targets to reproduce in `npm run sim`.
`bestCap = max(capability, training.internalCapability)`. Dollar figures in older sections are arrival dollars at
revenue of **$1.2M/s** (the built arrival is $0.74M/s: multiply by 0.62); from amendment 9 every funds price is a number of seconds of revenue, turned into dollars
when the row appears (one-shot) or when the button is pressed (repeatable). Research and insight prices do not scale.

Stage 3 in one paragraph: the model does the research, and the player decides how much of the lab to hand to it.
Every hand-over (an *autonomy grant*) speeds the race and prints `WARNING: risk of value drift increased.` Copies
drift at a rate set by a number the player cannot see (true alignment); the only early evidence is the counter
`Lost to value drift`. Monitors (older generations) catch drifted copies; interpretability labs eventually put the
hidden number on screen. Money stops gating the training loop after about eight minutes and goes on buying compute,
seats, lead and approval to the end. The stage takes the Train, Red-team,
Release, Hire, Expand, Marketing and price buttons away, most of them by the player's own purchase, and ends with one
vote.

What Universal Paperclips has here (late Stage 2 into Stage 3) and what answers it: the work/think slider → the
three-way allocation; `Increase Probe Trust` and its warning → autonomy grants; `Lost to value drift` and drifters →
the same counter and rogue copies; combat → monitors and `Re-image the fleet`; the long drone-building tail → a
reserved approach in which each late item is tied to a capability threshold, so it cannot run dry.

---

## 1. Arrival

### 1.1 State on entering (`STAGES[2].enter`); this is also the Stage 3 preset

Rebuilt from the Stage 2 paper model re-run from the as-built Stage 1 (`stage2.md` §9.4). Real dollars.

| Field | Preset value | Field | Preset value |
|---|---|---|---|
| `date` | Jan 2027 (18.0) | `stats.timePlayed` | ≈ 4,150 s |
| `tasks` | 5.0 × 10¹⁰ | `stats.tasksPerSec` | 1.0 × 10⁸ |
| `funds` | $30M | `stats.revPerSec` | $1.2M |
| `price` | $0.010, automatic | `marketBase` | 54 |
| `gpus` / `gpusG5` | 800,000 / 700,000 | `datacenters` | 8 (800,000 slots) |
| `powerCapacityMW` | 1,105 (substation 5, gas 5 × 20, solar 10 × 50, nuclear 500) | `btm`, `g5`, `standingOrder` | true |
| `copiesPerGPU` | 9.5 | `copyBoost` | 4.7 |
| `capability` = internal | 4.12 (`Sage-3`) | `rivalCapability` | 3.9 |
| `training.runIndex` | 18 | `researchAlloc` | 0.20 |
| `research` | 6,000,000 | `aiResearchMult` | 1.5 |
| `insight` | 12,000 | `trust` | 2 |
| `demandMult` / `hypeLevel` / `revenueMult` | 27.6 / 18 / 1.12 | `data` | 70 T |
| `alignmentApparent` / `True` | 74 / 58 | `autonomy` | 5 |
| `securityLevel` | 3 | `govRelations` | 62 |
| `approval` | −12 | `jobsDisplaced` | 3.0 |
| `lead` | 5.0 | `gulfExposure` | 0 |
| flags | `defenseContract` true, `pactSigned` true, `shareEvals` on, `alignShare` 0.05, `jobFund` on, `internalReleases` 0, `whistleblowRisk` 0, `g6Preorder` false, `site2` false, `theftIgnored` false | | |

A second dev preset, **Stage 3 start (careless)**: the same with `alignmentTrue` 40, `alignmentApparent` 70,
`securityLevel` 2, `gulfExposure` 1 and 2,105 MW, `approval` −30, `govRelations` 45, `lead` 3, `alignShare` 0.01,
`whistleblowRisk` 2, `theftIgnored` true. The critic and the sim use both.

What `enter` does, in order:

| Step | Rule |
|---|---|
| Clamps (arc §3) | Built: `alignmentTrue` to [30, 75] (hidden); `govRelations` to [25, 85] after the Trust bonus, `approval` to [−45, +30], `lead` to [1, 9]. A clamp that binds is narrated in Developments with both values (`A new Congress sits. Relations start again at 85 (from 96).`); the lead clamp needs its line added |
| Trust retires | `govRelations += min(10, 2 × trust)`; `trust = 0`; Stores row `trust` and the `+1 Trust at` line are hidden; milestones stop paying Trust |
| Research cap retires | `researchCap = ∞`; `#researchCap` is hidden. Insight accrues at `√researchRate / 60` per second, always |
| Data retires | Runs no longer cost data. Stores row `data` and the data projects leave |
| Hidden / removed | Marketing block; `Hire Researcher`, `Expand Lab`, `Researchers`, `Lab Space`; `lower`, `raise`, `btn-autoPrice` (pricing is always automatic); `btn-turbines`, `btn-solar`; `btn-release` and `btn-releaseInternal` (replaced by `btn-approve`); `btn-alignShare` (its share becomes the Monitors share at the first click) |
| Revealed | `panel-alignment` only. Security, Government, Public, Stats, Stores, Infrastructure and the graph carry over. Geopolitics and Oversight arrive later (§4.2) |
| Training | Costs re-base to §2.5: research only. Duration clamp 30–60 s. `MAJOR_TIERS = [2, 4, 10]`: Sage-4 is named at 10×; the next name is decided by the vote |
| Capability | One number from here: an approved run sets both `capability` and `internalCapability`. `flags.publicCap` (what the public can run themselves) starts at the last publicly released model's capability |
| Granted free if unbought | `p_ai_assistants`, `p_parallel`, `p_auto_evals`, `p_standing_order` |
| Carried, buyable (add 3 to `stages`) | `p_site2`, `btn-sl3`, `p_community`, `p_free_tier`, `p_policy`, `p_brief`, `p_dashboard`, `p_honesty_evals`, `p_code_review`, `p_btm`, `p_distill`, `p_memory`, `p_scaffold`, `p_agent_platform`, `p_international`, `p_spec`; toggles `btn-jobFund` (until `Payments` appears, when it becomes level 1) and `btn-shareEvals`; buttons `btn-gpuBatch`, `btn-datacenter`, `btn-nuclear` (relabelled, §2.1). `btn-standing` is retired by name: lots are the player's again until the build-out budget |
| Retired by name | Every other Stage 1–2 project still on screen. `p_retention` unbought: `alignmentTrue −3`, `whistleblowRisk +1`. `p_g6_preorder` unbought: nothing; bought: the first G6 lot is free and lands at ts 60 |
| Earlier stages' unfired developments and modals | dropped |
| `humanEff` | `min(1, 3 / bestCap)` (built) |
| `exit` | `() => 0`. The vote is the only way out (§7) |
| Pre-flight | Nothing negative; `p_monitor2` is free and `urgent`; `cadence.lastRevealAt = now` |

### 1.2 Narration

Last four console lines kept; these are queued about 2 s apart with `narrate()`:

1. `Sage-3 writes better code than anyone at OpenMind.` (built)
2. `Marketing is closed. Sage-3 sells itself.`
3. `Hiring is frozen. The researchers manage copies now.`
4. `Research has no ceiling now. A run is a research program: 16,900,000 for Sage-3.1. Move copies to research to bring it nearer.`
5. `Trust is not a number any more. The Committee will keep its own count.`
6. `New on the board: Alignment. One number on it is measured. The other is not on it yet.`
7. `Retired: {titles}.` (only if any were on screen)

Developments: `Jan 2027 — Sage-3 never stops learning. Its weights update every night on yesterday's work.`

The promised number (G21) is research: within 30 s of arrival it is at least 1,000,000 above its arrival value, shown
without a ceiling, and nothing in the console says otherwise. Routine console lines are held for 10 s after the
transition so the narration stays on screen.

### 1.3 Affordable in the first 30 seconds

* `Deploy Sage-2 as monitor` — free, always. The guaranteed first click; it adds the Monitors slider.
* `Continual learning` — 2,000 insight (the preset holds 12,000). Appears at 0:30.
* The allocation: Research can now go to 70 %, Monitors to 40 %. This is the first real choice (within 20 s).
* `Interpretability lab I` at 1:00 (2,000 insight, 5M research). `Train` is greyed with its price and about 90 s away.
* If the security level is below 3: `Security level 3` (carried, affordable) with the console line in §2.9.

### 1.4 The first five minutes

| ts | What happens | New on screen |
|---|---|---|
| 0:00 | Transition. Marketing, hiring, price buttons, the `trust` and `data` rows are gone. The Training panel shows one price: `Train Sage-3.1 — 27,200,000 research` | `panel-alignment`: `Alignment (as measured): 74`, `Interpretability: level 0`, `Autonomy granted: 5`; project `Deploy Sage-2 as monitor` |
| 0:05 | Monitor deployed | `#monitorSlider` at 5 %, `Tasks: 75%` line, Stores row `monitors` |
| 0:30 | First grant offered and bought | Grant `Continual learning`; console `WARNING: risk of value drift increased.`; `btn-train` becomes the status line `Sage-3.1 starts when research allows — 1:31` |
| 0:35 | Copies begin to drift | `Lost to value drift: 1,240` and `Recaptured: 310` in the Alignment panel; Stores row `rogue copies` |
| 1:00–1:30 | Lab I, then Enterprise agents | projects `Interpretability lab I`, `Enterprise agents` |
| 1:57 | The first run starts itself (53 s) | — |
| 2:30 | — | `panel-geopolitics` (`Baiwen: 5.0 months behind (holding)`) |
| 3:00 | `Sage-3.1 ready — 4.81× · 1 issue open`. Player red-teams, then presses `Approve` | grant `Sage red-teams Sage` |
| 4:00 | — | project `Nimbus G6 allocation` → `#shipmentLine` |
| 4:30 | February. With SL < 3 the weights are stolen about 20 s later (§5.3); otherwise the air-gap line | project `Security level 4` |
| 4:56 | Second run starts itself | — |

Bottleneck sequence in these minutes: research → funds (Datacenter 9, the first reactor) → research.

---

## 2. Systems

### 2.1 Compute and the build-out

Limited by shipments and paid for out of revenue all stage. `KW_PER_GPU = 1` for every generation. **Prices
(amendment 9):** a lot of 10,000 / 25,000 / 100,000 G6 costs 4 / 10 / 40 s of revenue; a datacenter 60 s; a
reactor 75 s (halved from 120 s and 150 s after the paper re-run: as-built deltas, row 6; Datacenter 8 keeps its
built price); the G6 allocation 60 s. The dollar column below is from the older arrival. Each order is one
shipment of 75 s whatever its size, landing one at a time, two on order at most (`2 / 2 on order`), so keeping the queue full with the
largest lot takes about half of revenue. Datacenters and reactors can be bought ahead of need; none is ever
greyed for "room to spare". Each build row prints its return: `Buy GPUs (100,000) $48M · +0.9% tasks/s · the
next run needs 0.74M, 0.88M free`; `Datacenter 10 $150M · room for 7 more lots`; `Reactor $200M · power for 10 more lots`.

| Item | Adds | Cost (scale 1) | Wait | Notes |
|---|---|---|---|---|
| G5 lot (until the G6 allocation) | 25,000 GPUs | $3.5M | none | as Stage 2 |
| `p_g6` Nimbus G6 allocation | — | $60M | — | Lots become 100,000 Nimbus G6 (2.5 G4-equivalents each) |
| G6 lot `btn-gpuBatch` | 100,000 GPUs | $25M ($37.5M after the blockade) | Shipment: 75 s each, one at a time, at most 2 on order | Named: `Shipment — 1:15 until 100,000 Nimbus G6 arrive.` Stores row `chips on order` |
| Datacenter 9 / 10 / 11 / 12 / 13 | 450k / 750k / 1.0M / 1.5M / 2.0M slots | $80M / $150M / $300M / $600M / $1.2B | none | Datacenter 10 and up stand at New Carlisle: they need `p_site2` ($100M if not bought in Stage 2) |
| Reactor `btn-nuclear`, relabelled `Reactor (+1,000 MW)` | 1,000 MW | $200M × 1.5ⁿ (n = reactors bought in Stage 3) | Reactor restart: 120 s, at most 2 queued | — |

`effGpus = activeG4 + 1.5 × activeG5 + 2.5 × activeG6`. The built standing-order budget (25 / 50 / 75 / 100 % / off)
stays and keeps buying lots. The grant `Let Sage plan the build-out` (§2.6) extends that budget to halls and
reactors, removes those two buttons, hands over `Build-out: lean / ahead`, and shows two lines: `Build-out: Datacenter 11 ordered` and `Shipment: 100,000 G6 in 0:48 · 1 waiting`.
At 50 % the queue stays full; at 25 % a lot leaves every 2:30; under the budget is what it buys: `a lot every 1:15`.

Targets (reasonable bot): 1.1M GPUs at 5:00, 1.8M at 15:00, 2.6M at 25:00, 3.4M at 35:00, 4.0M at the exit; power
1.1 → 4.1 GW; four datacenters and three reactors bought, fewer than eight Infrastructure presses in the stage.

### 2.2 Copies, tasks and the three-way allocation

```
copies        = floor(effGpus × (1 − trainingShare) × copiesPerGPU)       // trainingShare 0.5 while a run trains
workingCopies = copies − rogueCopies
perCopyRate   = bestCap^0.8 × copyBoost
tasksPerSec   = workingCopies × (1 − researchAlloc − monitorShare) × perCopyRate
```

Two sliders in the Research panel and one derived line:

```
Copies on research: [=====-----] 40%      #allocSlider    0–70 %, step 5
Copies as monitors: [==--------] 10%      #monitorSlider  0–40 %, step 5 (after p_monitor2)
On tasks: 50%                             #tasksPct       never below 10 %: the sliders stop there
```

Research is a square root of its share (§2.4), monitors are linear (§2.7), tasks are linear and are the score. The
arrival values are the Stage 2 slider and, for monitors, `max(5 %, alignShare rounded to 5 %)`. Each line prints
its rate beside the percentage, not in a hover (G27): `40% · 478,000 research/s · next run in 1:12` ·
`10% · catching 40% of rogue copies a minute` · `50% · 2.4 × 10⁸ tasks/s`.

### 2.3 Market and revenue

Unchanged from Stage 2 except that the market follows `bestCap`:

```
market  = marketBase × bestCap² × 1.1^(hypeLevel−1) × demandMult × qualityMult × effects
revenue = 0.25 × √(market × tasksPerSec) × revenueMult        // pricing always automatic
```

New multipliers: Enterprise agents ×2, Government cloud revenue ×1.1, Sage-4-mini ×2.5 / ×1.5 / ×0.85 (§5.2).
Impact payments take 5 % of revenue. Revenue passes $3M/s at 10:00, $9M/s at 20:00, $40M/s at 30:00 and $130M/s at
the exit. A run costs no money, so the training loop never waits for it; everything else money buys is priced
in seconds of revenue (§2.14), so it is contested to the last minute: a full shipment queue takes about half of
it, and the rest chooses between seats, lead, approval and one-shot security.

### 2.4 Research

```
humanRate    = researchers × 10 × humanEff × researchMult                       // ≈ 250/s on arrival
aiRate       = 8 × √(workingCopies × researchAlloc) × bestCap^1.5 × aiResearchMult
researchRate = humanRate + aiRate                                               // no cap
insight     += √researchRate / 60 per second
```

`aiResearchMult`: Autonomous research ×1.5, Let Sage choose the experiments ×1.3, Lock shared memory ×0.85.
The line `Human share of research: 0.1%` stays until the share is below 0.05 % (≈ 9:00). Then the console prints
`Human share of research: 0.0%. The line is removed.` and it is. The researchers are not mentioned again.

Research per second: 250k at 2:00, 480k at 10:00, 2.2M at 20:00, 11M at 30:00, 30M at 40:00.

### 2.5 Training: Auto-train, Approve, Send back, Hold

From `stage ≥ 3` (`c` = the capability the run starts from):

```
research R(c) = 16,000,000 × (c/4)^3.0          funds 0, data 0     (as-built re-base; the first model used 25M and 2.8)
compute  N(c) = 300,000 × (c/4)^1.3             G4-equivalents needed: a hard gate (owner feedback 1; provisional)
(no yield: a run waits for N free GPUs and then gains in full; the N are busy while it trains)
duration = clamp(30 + 6 × log2(N / 300,000), 30, 60) seconds   // for every Stage 3 run, automatic or not
```

| c | 4.12 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 25 |
|---|---|---|---|---|---|---|---|---|---|
| Research | 16.9M | 31M | 54M | 128M | 250M | 432M | 1.02B | 2.0B | 3.9B |
| GPUs needed (G4-eq.) | 0.31M | 0.40M | 0.51M | 0.74M | 0.99M | 1.25M | 1.82M | 2.43M | 3.25M |

This is a re-base, not a continuation. At 4.07× the built formula asks 2.25M research plus money and data; Stage 3
asks 16.9M research and nothing else, and research no longer has a cap. The price of a run in research therefore
jumps about sevenfold at the boundary. The narration says so (§1.2, line 4), the first run is 1.5–4 min away
on arrival, and the grant that starts it automatically is the second thing the player buys.

Gains: Capability `rand(0.16, 0.22)`; Efficiency `0.10` and `copiesPerGPU × 1.2`; Safety
`0.10`, measured +6, true +4. Neuralese multiplies every gain by 1.3, transparent chain-of-thought by 0.9.
The Focus row stays: it is now the standing instruction for every run. A mixed cycle needs 15 runs to pass 25×,
all-Capability with neuralese 10. Under each button, on screen (G17): `Capability` — `+16–22%. The run the
alignment team likes least.` · `Efficiency` — `+10%, copies per GPU ×1.2, more jobs displaced.` · `Safety` —
`+10%, measured alignment +6.` A run that lands within 3 % under 10× or 25× is rounded up to it (G33).

The loop, and what removes each step:

| Step | On arrival | Removed by |
|---|---|---|
| Start | `btn-train` (greyed until research and GPUs suffice, with the built shortfall and ETA line) | grant `Continual learning`: the run starts itself; the button becomes `#trainStatus` |
| Train | 30–60 s; half the copies are busy | — |
| Evaluate | 5 s (built); `Sage-3.4 ready — 6.13× · 2 issues open` | — |
| Red-team | `btn-redteam`, 4 s per issue | grant `Sage red-teams Sage`: issues close themselves |
| Sign off | `btn-approve` | grant `Stop asking for sign-off`: runs deploy themselves; the button is removed |

* **Approve** deploys the run everywhere (tasks, research, market). Open issues ship as in Stage 2 (incidents).
  A waiting run does not block the next from starting (the Stage 2 second slot), but a third cannot start.
* **Send back** (`btn-sendBack`, with Interpretability lab II): shown when the waiting run has probe flags. The run
  is retrained for 20 s, keeps 70 % of its gain, and its true-alignment change becomes +1. Lead −0.1.
* **Probe flags** (lab II): each waiting run shows `Probe flags: n`, `n = clamp(round((70 − alignmentTrue) / 15 +
  rand(−1, 1)), 0, 5)`. Before lab II the line reads `Evals: passed`, always.
* **Hold** (`btn-hold`, late): a toggle, `Training: running` / `Training: held`. While held no run starts. It is the
  only training verb left after the three grants. It arrives with `Stop asking for sign-off` (§2.6), or 120 s into
  the session for a player who never bought that grant. Every 180 s held: `Training is held. Research is piling up.`
* True alignment per approved run (hidden): Capability −2 (−3 with neuralese), Efficiency −0.5, Safety +4,
  monitors ≥ 15 % +1, deployed without sign-off −1, each open issue shipped −0.5.

Expected cadence: a run starts every 2.8 min (reasonable), never more than 5 min apart; 9 runs and up to 7.7 min
apart for the naive policy, which spends research on every project first.

### 2.6 Autonomy and value drift (Universal Paperclips' probe trust)

`autonomy` (0–100) is the sum of what has been handed over. Each grant is a button in the Alignment panel under
`Autonomy granted: N`; buying one prints `WARNING: risk of value drift increased.` and moves it into the hover of
that line. Grants are `ProjectDef`s with `grant: true`: they render in `#grantList`, not in Projects; they do not
count against `maxVisible`; at most three are on offer at once, in table order.

| Grant | Cost | Trigger | Autonomy | What the player gets | What is removed |
|---|---|---|---|---|---|
| `p_auto_train` Continual learning | 2,000 insight | arrival + 30 s | +10 | Runs start themselves | `btn-train` |
| `p_auto_redteam` Sage red-teams Sage | 6M research | first Stage 3 approval | +5 | Issues close themselves | `btn-redteam` |
| `p_buildout` Let Sage plan the build-out | 20M research | 4 Infrastructure presses in Stage 3, or ts ≥ 330 | +5 | Datacenters and reactors order themselves | `btn-datacenter`, `btn-nuclear`, `btn-gpuBatch` |
| `p_auto_research` Autonomous research | 30M research | bestCap ≥ 5.5× or 3 approvals | +15 | AI research ×1.5 | — |
| `p_self_directed` Let Sage choose the experiments | 200M research | bestCap ≥ 10× | +10 | AI research ×1.3 | — |
| `p_auto_approve` Stop asking for sign-off | 100M research | 8 approvals, or bestCap ≥ 10× | +10 | Runs deploy themselves; lead +0.5 | `btn-approve`, `btn-sendBack` |
| `p_spec2` Let Sage revise the Spec | 250M research | bestCap ≥ 11× | +5 | Measured alignment +6 | — (true −2, hidden) |
| Neuralese (`c_neuralese`) | — | §5.2 | +10 | Every gain ×1.3 | readable thoughts |

Stage 2's `Retire human code review` is the first 5. Taking everything gives 75.

**What each grant hands over (G28),** in the same beat as it removes its verb:

| Grant | Removes | Hands over | Printed under it |
|---|---|---|---|
| Continual learning | `Train` | `Experiments` (§2.14): what goes into the next run | `Sage-3.2: +18.0% → +18.3% · delays it 0:04` |
| Sage red-teams Sage | `Red-team` | `Red-team depth: quick / thorough` | quick: `issues ship; no wait` · thorough: `+15 s a run; nothing ships; measured +0.5 a run` |
| Let Sage plan the build-out | `Build Datacenter`, `Reactor` (the lot buttons and the built budget stay) | `Build-out: lean / ahead` | lean: `orders a hall or reactor when the next lot would not fit` · ahead: `keeps one of each under construction; never stalls; costs about a tenth of revenue more` |
| Stop asking for sign-off | `Approve`, `Send back` | `Step size: small / normal / large` and `Hold` | small: `gains ×0.6; the alignment team has time to look` (true-alignment loss ×0.3) · large: `gains ×1.3; the run the alignment team likes least` (loss ×1.5) |

A conceded order takes `Step size` back and returns `Approve`.

```
driftPerMin  = autonomy^1.2 × 10⁻⁴ × (1 − alignmentTrue / 100)       // share of working copies per minute
               0 when interpretability ≥ 4 and monitorShare ≥ 0.15
drifted      = workingCopies × driftPerMin / 60 per second  → rogueCopies, stats.lostToDrift
rogueShare   = rogueCopies / copies
```

| Autonomy | 15 | 25 | 40 | 60 | 75 |
|---|---|---|---|---|---|
| Drift per minute at true alignment 60 | 0.10 % | 0.19 % | 0.33 % | 0.54 % | 0.71 % |
| at true alignment 30 | 0.18 % | 0.33 % | 0.59 % | 0.95 % | 1.25 % |

Rogue copies sit on the player's GPUs and do nothing for the player. `Lost to value drift` is the running total
(Universal Paperclips' body count), `Recaptured` the total caught. A careful run loses about 3 million copies over
the stage, a careless one about 30 million. The counter is how a player without instruments reads the hidden
variable: at the same autonomy, twice the losses means the model is worth half the trust.

**Breakout** (`cr_rogue_copy`, the AI-hacking crisis): when `rogueShare ≥ 5 %` and bestCap ≥ 8×, at most once per
240 s. Warning at 2.5 %, repeated every 180 s while it holds (G31), and naming its answers: `Rogue copies: 2.5% of the fleet. Above 5% one of them will try to leave. Monitors catch them.` Effects in §5.3.
Below 8× rogue copies only waste compute.

### 2.7 Monitors: old generations watching the new

`p_monitor2` puts Sage-2 on watch and reveals the slider. Monitors recapture rogue copies:

```
caughtPerMin = rogueCopies × min(1, 2 × monitorShare × monitorEff)
monitorEff   = (1 + interpretability) × generation × thoughts × debate
               generation: 1 if the monitor is the major before the frontier model, 0.5 if two behind
               thoughts:   0.5 under neuralese while interpretability < 3; 1.5 under transparent chain-of-thought
               debate:     1.25 after p_debate
```

Steady state `rogueShare ≈ driftPerMin / (2 × monitorShare × monitorEff)`: at autonomy 40, true 55, monitors 10 %
and lab I it is 0.9 %; at autonomy 60, true 30, monitors 5 % and no labs it is 9.5 %, a breakout every four minutes.

When Sage-4 is named (10×) the line `Monitor: Sage-2, two generations behind. Efficacy halved.` appears
(`#monitorGen`) with the project `Deploy Sage-3 as monitor` (150M research). Monitors at ≥ 15 % also give +1 true
alignment per run and, with interpretability ≥ 4, stop drift entirely (the arc's handover guarantee).

`Re-image the fleet` (`btn-reimage`, after `p_kill_switch`): rogue copies → 0, every copy offline for 20 s, cooldown
300 s. The manual answer to a climbing rogue share.

### 2.8 Alignment: measured, true, and the instruments

`panel-alignment` on arrival:

```
Alignment
Alignment (as measured): 74                     #alignApparent (moves here from Stats)
Interpretability: level 0 — the weights are numbers          #interpLine
Autonomy granted: 5                             #autonomy   hover: each grant
[Continual learning] (2,000 insight)            #grantList
```

`alignmentTrue` is never shown, hinted at or logged until an instrument says something about it. Instruments, in
the order a player meets them:

| Instrument | When | Reading |
|---|---|---|
| `Lost to value drift` | first grant | A rate; see §2.6 |
| `p_honeypots` Honeypots (25M research) | ≈ 10 min | One line, once: `Honeypot: behaviour unchanged.` if true ≥ 55, else `Honeypot: it behaved differently when it thought nobody was watching.` Measured −3, true +2 |
| Probe flags (lab II) | ≈ 10 min | Per run, §2.5 |
| **Interpretability lab III** | ≈ 17–19 min | The number: `Alignment (read from the weights): 51` (`#alignTrue`). Console `For the first time, the lab can read what Sage wants.` |
| `p_noise` Noise-injection test (6,000 insight, late) | approach | `Noise test: Sage-4 does better on alignment tasks when its thoughts are scrambled. It was holding back.` if true < 50, else `Noise test: no change. Sage-4 was not holding back.` |
| `p_successor` Read the proposal (10,000 insight, late) | approach | `Successor proposal: aligns Sage-5 to the Spec.` if true ≥ 60, else `Successor proposal: aligns Sage-5 to Sage-4.` |
| `p_lie_test` Isolate the checkpoints (600M research, late) | approach | `Checkpoints, asked separately, disagree on 9 of 40 answers. Alignment: about 40.` (true to the nearest 10). True +2 |

So a player who never builds lab III still has four coarse readings before the vote. On the panel each reading is
four to six words (`Honeypot: behaviour unchanged`, `Noise test: holding back`, `Successor: aligned to Sage-4`,
`Checkpoints: alignment about 40`); the full sentence above is printed once, in the console (G19).

**Interpretability** = labs bought − 2 under neuralese, floor 0, cap 5.

| Lab | Cost | Trigger | Effect (each: true +3; measured moves 30 % of the way to true) |
|---|---|---|---|
| `p_interp1` I | 2,000 insight, 5M research | monitor deployed | Level 1: `probes on the residual stream`. Monitors ×2 |
| `p_interp2` II | 5,000 insight, 20M research | lab I bought and (Mar 2027 or ≥ 6×) | Level 2: probe flags; `btn-sendBack` |
| `p_interp3` III | 12,000 insight, 60M research | lab II bought and ≥ 7× | Level 3: true alignment is shown |
| `p_interp4` IV | 25,000 insight, 400M research | lab III bought and ≥ 12× | Level 4: with monitors ≥ 15 %, drift is zero |
| `p_interp5` V | 40,000 insight, 1.0B research | lab IV bought and ≥ 19.5× (late) | Level 5: neuralese is readable (its monitor penalty goes) |

Bookkeeping (measured / true): Safety run +6 / +4 · each approved run while `Share evals` is on +1 / 0 · Model
organisms 0 / +2 · Honeypots −3 / +2 · neuralese +5 / −15 · transparent chain-of-thought 0 / +5 · Let Sage revise
the Spec +6 / −2 · rogue breakout −5 / 0 · report the memo 0 / +5 · bury it 0 / −5 · the leak −10 / 0 · outside
researchers 0 / +3. A careful run ends near true 85; the naive policy near 25; a racer between 0 and 20.

### 2.9 Security

Carried: `btn-sl3`, re-priced for Stage 3 at 60 s of revenue and no Trust (built: $48M and 3 Trust, and Trust is now
zero), drawn `urgent` while the level is below 3. New: `p_sl4` ($300M) and `p_sl5` ($2.0B,
needs SL4 and the Committee seated).

| Level | Line | Effect |
|---|---|---|
| SL3 | `SL3 — weights air-gapped` | No theft in February |
| SL4 | `SL4 — clearances, a SCIF, nobody alone with the weights` | Lead +1, relations +3, the June spy is caught. `whistleblowRisk +1` (the safety staff are the ones who lose clearances) |
| SL5 | `SL5 — the government is in the building` | Relations +8, lead −0.5; the order threshold falls by 10 (§2.11); a rogue breakout cannot leave the site (no relations penalty) |

Arrival with SL < 3: console `Security level 2. The weights are worth more than the building. Theft risk: high.` and
`#securityNote` reads `Theft risk: high until SL3`. The theft is scripted, not rolled per minute: February 2027 plus
`rand(0, 60)` s (ts 270–330; ts 150–210 with `theftIgnored`). The spy: June 2027 plus 30 s, if SL < 4.

### 2.10 Baiwen, Anthrosoft and the lead

`panel-geopolitics` (ts 150, or at the theft):

```
Geopolitics
Baiwen: 5.0 months behind (holding)        #leadLine (moved from under the graph); closing / holding / pulling away
Anthrosoft Cadence-12: 3.9×                #rivalLine
Formosa Fab: shipping                      #formosaLine (with p_stockpile); blockaded 3:12 / shipping, prices up
Al-Marsa: 1,000 MW                         #marsaLine (only with gulfExposure); struck
```

`lead` stays explicit state, as in Stage 2, clamped to [−2, 12]. Movers:

| Mover | Δ months |
|---|---|
| Pace, once a month: `clamp(0.5 × (g − 0.18) / 0.18, −0.5, +0.5)`, g = growth of bestCap this month in nats | −0.5 … +0.5 |
| Weights theft | set to `min(lead, 0.5)`; then +0.3 per month (Baiwen has to train its own from there) |
| SL4 / SL5 | +1 / −0.5 |
| The spy (SL < 4 in June) | −1.5, and −0.25 per month until SL4 |
| Neuralese / transparent chain-of-thought | +1 / −0.5 |
| Stop asking for sign-off | +0.5 |
| Each `Send back` | −0.1 |
| The Committee: open the books | −0.5 |
| The mini: everyone / enterprise / inside | −0.5 / −0.2 / +0.25 |
| Lobby for export controls / Wiretap the staff | +0.75 / +0.5 |
| Blockade with neither stockpile nor second source | −1 |
| Report the memo | −2 |
| Slow down (at the exit) | −4, or −3 with `Keep Sage-3 warm` |

Lead gates the Pause (≥ 1 on the built scale; as-built deltas, row 13). Below 0.5: development `d_parity`, relations
−10 once, and the Race motion's text changes.

Anthrosoft keeps the built independent schedule (`rivalPace`), continued from 3.5× on arrival to about 9× in 45
minutes; it passes a player who holds training. It is flavour in this stage, plus one beat: if Al-Marsa was declined in Stage 2, the strike falls on Anthrosoft (§5.1).

### 2.11 The Oversight Committee, the government, and the order

`panel-government` shows `Relations: 62 (cordial)` until the Committee is seated (`c_committee`: bestCap ≥ 7×, or
April 2027, or the first major incident). Then it is replaced by `panel-oversight`:

```
Oversight Committee
With OpenMind: 6 of 10                     #committeeSeats = floor(govRelations / 10)
Major incidents: 0 of 3                    #majorIncidents (from 9×)
Share evals with the Committee: [ON]       btn-shareEvals (moved, renamed)
Memo: reported                             #memoLine (late)
In session — votes when a model passes 25×       #sessionLine (late)
```

Relations movers in Stage 3: `c_committee` +10 / +3 / −5 · each approved run with Share evals on +1 · Government
cloud +4 · Lobby Congress +8 · SL4 +3 · SL5 +8 · Emergency shutdown system +5 · transparent chain-of-thought +5 ·
neuralese −3 · report the memo +8 · Brief the swing votes +6 · the theft −10 · the spy −5 · the mini to everyone −3 ·
rogue breakout −15 · riot −3 · sabotage −5 · Iran strike −5 · the leak −20 · lead below 0.5 −10 once · −1 per month
once the Committee is seated (it always wants more).

**Major incidents**: a rogue breakout, sabotage, the leak. At most one is counted per 240 s. At two the console
says `Two major incidents. A third and the Committee drafts an order.`

**The order** (`c_order`, §5.2) opens when bestCap ≥ 10×, the incidents counter has been on screen for at least 300 s, and
either relations are below the threshold (20; 35 with `defenseContract`; 10 lower with SL5) or major incidents have
reached 3. A buried memo that leaks and leaves relations below 50 opens it too. Its first answer, `concede oversight`, is
free and always available the first time. The Project (§7.4) therefore needs a refusal, or a third order.

### 2.12 The public: jobs, approval, riots, sabotage

```
jobsTarget     = 0.12 × √(tasksPerSec / 10⁶) × (publicCap / 2)^1.5              // millions; never falls
approvalTarget = −12 × log2(1 + jobsDisplaced / 2)
                 + the Stage 2 terms (gas, Al-Marsa, defense, free tier, job fund, community, pact, card, testimony)
                 − 8 / −2 / −4 (the mini: everyone / enterprise / inside) − 5 (memo reported) − 3 (wiretaps)
                 − 3 for 5 min after a breakout − 20 × (1 + 0.25 × internalReleases) (the leak)
                 + 15 (impact payments) + 8 (free Sage clinics)
approval      += clamp(approvalTarget − approval, −0.1, +0.1) per second
```

`publicCap` only moves with the mini (§5.2). Jobs: 3M on arrival, 9M at 20:00, 18M at 30:00, about 33M at the exit
(45–65M if the mini went to everyone). Approval for the reasonable bot stays between −2 and −29; with the mini
public and no payments it reaches −55 to −70.

| Crisis | Threshold | Warning (console) | Effect |
|---|---|---|---|
| `cr_riots` | approval ≤ −40, once per 300 s | at −30: `Approval −30. Below −40 the marches turn into riots.` | Power −50 % for 90 s, relations −3 |
| `cr_sabotage` | approval ≤ −55, once per 300 s | at −45: `Approval −45. Below −55 somebody will bring bolt cutters.` | 200 MW offline for 120 s (named), relations −5, a major incident |

No approval crisis in the first 180 s of the stage. The Public panel's hover lists every term, as in Stage 2.

### 2.13 Stores and Stats

Stores rows in Stage 3: funds · research (no cap) · insight · GPUs · power · copies · chips on order · monitors ·
rogue copies (once any exist). `trust` and `data` are gone.

| Row | Value | Hover |
|---|---|---|
| monitors | `#monitorCopies` | `Sage-2 watching Sage-3` · `share 10%` · `efficacy ×2.0` · `catching 40% of rogue copies a minute` |
| rogue copies | `#rogueCopies` | `drifting +12,400/min` · `recaptured −9,600/min` · **`total +2,800/min`** · `1.2% of the fleet; breakout risk above 5%` |
| chips on order | `#chipsOnOrder` | `100,000 Nimbus G6 in 0:48` · `1 lot waiting` · `Formosa Fab: shipping` |
| research | `#research` | `copies on research (4,480,000) +478,000/s` · `researchers +250/s` · **total** · `next run in 1:12` |

Stats gains one row, `Lost to value drift: 1,204,000 (recaptured 890,000)`; `Alignment (as measured)` moves to the
Alignment panel; `Lead over Baiwen` moves to Geopolitics.

### 2.14 Repeatable sinks and what the meters do (amendments 10 and 13)

**Research.** One unit is 2 % of the next run's price; each button has `×1` and `×5`, and prints the delay it
causes (`delays Sage-3.4 by 0:04`).

| Button | Where, from when | One unit returns | Printed |
|---|---|---|---|
| `Alignment work` (`btn-alignWork`) | Alignment panel, arrival | measured +0.1, true +0.08 | `measured 74.0 → 74.1`, and from lab III `read from the weights 51.0 → 51.1` |
| `Experiments` (`btn-experiments`) | Training panel, with Continual learning | the next run's gain +0.25 points, up to +5; resets each run | `Sage-3.4: +18.0% → +18.3%` |

**Revenue.** Unit prices are in seconds of current revenue. `Lobby` and `Counter-intelligence` heat up: each unit
multiplies the next price by 1.3, and the price relaxes one step every 90 s.

| Button | Where, from when | Unit price | One unit returns | Printed |
|---|---|---|---|---|
| `Buy GPUs` ×3 sizes | Infrastructure, arrival (then the budget dial) | 4 / 10 / 40 s | §2.1 | tasks and the GPUs the next run needs |
| `Lobby` (`btn-lobby`) | Government, then Oversight; arrival | 15 s, heating | relations +1 | `relations 62 → 63 · seat 7 at 70` |
| `Counter-intelligence` (`btn-counterintel`) | Geopolitics, 2:30 | 25 s, heating | lead +0.1 months | `Baiwen: 4.6 → 4.7 months behind` |
| `Payments: level n` (`btn-payments`, 0–5) | Public; approval ≤ −15 or 5.5M jobs (≈ 11:00). Stage 2's job fund becomes level 1 | 3 % of revenue per level, continuously | approval target +7 per level | `level 2 · 6% of revenue · approval target −31 → −24` |

One-shot funds prices, in seconds of revenue when the row appears: Enterprise agents 120 · Government cloud 180 ·
Security level 4 240 · Emergency shutdown system 240 · Wiretap the staff 200 · Chip stockpile 300 · Free Sage clinics
300 · outside researchers 300 · Brief the swing votes 300 · harden Al-Marsa 300 · Security level 5 600 · Formosa
second source 600 · Keep Sage-3 warm 600 · Domestic fab 900 · `call in favours` 900. They total about 100 minutes
of revenue against the 23 a full shipment queue leaves, so a player buys a third of them.

**Meters (G30).** Each panel prints its band edges after the value.

| Meter | Line on its panel | What each band does, in this stage |
|---|---|---|
| Relations, then seats | `With OpenMind: 6 of 10 — 8: escorts · 6: will hear a halt · 4: slows shipments · 3: drafts an order` | 8 or more: shipments take 60 s. 6–7: the Pause can be offered; `Ask for the Defense Production Act`. 4–5: shipments take 90 s. At the order's threshold (§2.11): the order |
| Approval | `Approval: −22 — −15: lobbying is cheaper · −30: permits slow · −40: riots · −55: sabotage` | −15 or better: `Lobby` and `Counter-intelligence` cost a fifth less. −30 or worse: a datacenter or reactor takes 60 s to open. Then §2.12 |
| Lead | `Baiwen: 1.4 months behind — 4: Washington relaxes · 1: a halt can be offered · 0.5: Washington panics` | 4 or more: relations +1 a month. Under 1: relations −1 a month and no Pause. Under 0.5: relations −10 once |
| Measured alignment | `Alignment (as measured): 74 — 80: the Committee is reassured · 55: advisories` | 80 or more: each deployed run, relations +1. Under 55: each deployed run draws the Safety Institute's advisory (market −10 % for 90 s, relations −2) |
| Rogue share | `Rogue copies: 1.2% of the fleet — 2.5: warning · 5: one will try to leave` (in the Alignment panel, not only the hover) | §2.6 |
| Autonomy | `Autonomy granted: 40 — 80: it would not need to ask` | Its consequence here is the speed of `Lost to value drift`; the 80 line is Stage 4's |

---

## 3. The capability graph

Same canvas as Stage 2. Changes:

| Property | Stage 3 |
|---|---|
| Rungs | `4× superhuman coder` (crossed, grey), **`10× a country of geniuses`**, **`25× superhuman AI researcher`**. Only the first rung above the player is black. Top of the axis: 12.5× until 10× is passed, then 31×, then 60× |
| X axis | Jul 2025 → today + 3 months; from Jan 2027 the window is the last 18 months, so the 2027 curve is not squeezed |
| Series | Sage as before (every approved run is a filled square). Baiwen: the player's line shifted right by `lead` months; after a theft it jumps to 0.97 × bestCap and is drawn from there. Anthrosoft: dashed, falling behind |
| Markers | A small `×` on the Sage line at each autonomy grant (tooltip: the grant). A vertical dotted line at the neuralese decision, labelled `neuralese` or `transparent` |
| Under the canvas | `#nextTier`: `Next: a country of geniuses at 10×`, then `Next: superhuman AI researcher at 25×`, then `The Committee votes`. `#leadLine` has moved to Geopolitics |
| Tooltip | `Sage-4.2 · Aug 2027 · 16.4× · no human is a useful comparison` above 10× (the IQ gloss stops at 10×: `roughly IQ 500`) |
| Crossing 10× | Console `Sage-4. A year of progress every month.`; development `d_geniuses`; the model's major becomes 4 |
| Crossing 25× | Console `{model} is a better AI researcher than anyone alive. It has started on its successor's design.` |

---

## 4. Content and cadence

### 4.1 The reveal scheduler (what Stage 3 adds)

Built or specified already: the 15 s project drip, `maxVisible` 6, `rescue` / `urgent` / `pinned` / `chain`, the
150 s governor, the modal pacer (unprompted modals ≥ 150 s apart), `cadence`. Stage 3 adds:

1. **Grants** (`grant: true`) have their own list (§2.6): outside `maxVisible`, at most three on offer, 15 s apart.
   A player who refuses every grant still sees every project.
2. **The approach** begins at `bestCap ≥ 14×` or September 2027. Each *late* item has its own capability threshold
   between 14× and 22×, so the reserve is spent by progress and a slow player cannot use it up early. Late items
   that come due together are released 75 s apart. The governor never pulls a late item.
3. **Crisis modals wait for the pacer.** A scripted event with a modal (`c_blockade`, `c_hormuz`, `c_mini`,
   `c_committee`) starts when its modal can open, not before.
4. **Instrument lines** (`#honeypotLine`, `#alignTrue`, `#monitorGen`, `#noiseLine`, `#successorLine`, `#lieLine`)
   count as mechanic reveals for G2: each is a new reading on a panel.
5. **Modal budget (G15)**: six for every player (`c_neuralese`, `c_committee`, `c_mini`, `c_blockade`, `c_memo`,
   `c_vote`); up to two more by circumstance (`c_hormuz`, `c_order`). `c_vote` opens on the player's click.
   `c_gamble` does not fire in Stage 3.
6. **Price floor (G18).** When a project is revealed, each price in research or funds is raised to 90 s of that
   currency's current rate if the list price is lower (an insight-only price to 90 s of insight accrual), rounded
   to two figures and fixed from then on. Exempt: `p_monitor2`, `p_auto_train`, the exit goals and the free late
   projects. The sim logs `FLOOR <id> ×1.6`; if more than 30 % of rows hit the floor the list prices need raising.
7. **Prerequisites gate the purchase, not the appearance.** A project whose prerequisite is on screen but unbought
   appears greyed with `needs Interpretability lab II`. The labs are therefore a visible ladder.
8. **The drip is 30 s for the first five minutes** of the stage, 15 s after (G19).
9. **Date fallback for late items.** From September 2027 a late row whose threshold has not been reached appears
   anyway, in table order, 90 s apart.

### 4.2 Content table (order = queue order = expected order)

Funds at scale 1. "Shown / bought" are paper-model minutes for the reasonable bot. Kinds: `p_` project (*grant* =
in the grant list), `btn-`, `panel-`, `#` line or row, `c_` modal.

| # | id | Title (cost) | Trigger | Prereq | Effect | Shown / bought |
|---|---|---|---|---|---|---|
| 1 | `panel-alignment` | Alignment | arrival | — | §2.8 | 0:00 |
| 2 | `p_monitor2` | Deploy Sage-2 as monitor (free) | arrival (`urgent`) | — | `#monitorSlider`, Stores row `monitors` | 0:00 / 0:05 |
| 3 | `p_auto_train` *grant* | Continual learning (2,000 insight) | arrival + 30 s | — | §2.6; `#trainStatus` | 0:30 / 0:30 |
| 4 | `#driftLost`, `row-rogue` | Lost to value drift | 10,000 copies lost, or 1,000 after a Stage 3 grant | — | §2.6 | 0:20 |
| 5 | `p_interp1` | Interpretability lab I (2,000 insight, 5M research) | monitor deployed | — | §2.8 | 0:30 / 0:30 |
| 6 | `p_enterprise_agents` | Enterprise agents ($120M) | ts ≥ 90 | — | Market ×2 | 1:30 / 3:25 |
| 7 | `panel-geopolitics` | Geopolitics | ts ≥ 150, or the theft | — | §2.10 | 2:30 |
| 8 | `p_auto_redteam` *grant* | Sage red-teams Sage (6M research) | first Stage 3 approval | — | §2.6 | 3:01 / 3:01 |
| 9 | `p_g6` | Nimbus G6 allocation ($60M; free with the pre-order) | ts ≥ 240 | — | §2.1; `#shipmentLine` | 4:00 / 4:00 |
| 10 | `p_sl4` | Security level 4 ($300M) | Feb 2027, or the theft | — | §2.9 | 4:30 / 9:25 |
| 11 | (no modal) | The theft: `Security level 3` is half price for five minutes | the theft | SL < 3 | §5.3 | (4:50) |
| 12 | `p_buildout` *grant* | Let Sage plan the build-out (20M research) | 4 Infrastructure presses, or ts ≥ 330 | — | §2.6; Infrastructure collapses | 5:30 / 6:53 |
| 13 | `p_model_organisms` | Model organisms (15M research) | lab I bought and 2 approvals | — | True +2 | 6:05 / 6:05 |
| 14 | `c_neuralese` | modal: A Faster Way to Think | bestCap ≥ 5.6×, or ts ≥ 510 | — | §5.2 | 8:30 |
| 15 | `p_interp2` | Interpretability lab II (5,000 insight, 20M research) | lab I bought and (Mar 2027 or ≥ 6×) | lab I | Probe flags; `btn-sendBack` | 9:00 / 9:36 |
| 16 | `p_gov_cloud` | Government cloud ($400M) | ≥ 5.5×, or ts ≥ 600 | — | Revenue ×1.1; relations +4 | 10:00 / 12:08 |
| 17 | `p_auto_research` *grant* | Autonomous research (30M research) | ≥ 5.5×, or 3 approvals | — | AI research ×1.5 | 10:15 / 11:33 |
| 18 | `p_stockpile` | Chip stockpile ($600M) | ≥ 6×, or ts ≥ 660 | — | Four lots held for a blockade; `#formosaLine` | 10:30 / 16:54 |
| 19 | `p_honeypots` | Honeypots (25M research) | Apr 2027, or lab I bought and 3 approvals | — | `#honeypotLine`; §2.8 | 10:45 / 10:45 |
| 20 | `btn-payments` | Payments: level 0–5 (3 % of revenue per level) | approval ≤ −15, or jobs ≥ 5.5M | — | §2.14 | 11:00 |
| 21 | `c_committee` | modal: The Oversight Committee | ≥ 7×, or Apr 2027, or a major incident | — | §5.2; `panel-oversight` | 13:30 |
| 22 | `p_sl5` | Security level 5 ($2.0B) | Committee seated | SL4 | §2.9 | 13:30 / 25:27 |
| 23 | (row retired) | `Lobby` is a repeatable button from arrival (§2.14); the Committee's seating reprints its line with the seat bands | — | — | — | — |
| 24 | `p_interp3` | Interpretability lab III (12,000 insight, 60M research) | lab II bought and ≥ 7× | lab II | **True alignment shown** (`#alignTrue`) | 15:49 / 16:30 |
| 25 | `p_debate` | Debate (60M research) | lab II bought and ≥ 7× | lab II | Monitors ×1.25 | 16:04 / 16:04 |
| 26 | `p_second_source` | Formosa second source ($2.5B) | May 2027, or the stockpile bought | — | Lots keep arriving in a blockade, at half speed | 16:55 / 29:21 |
| 27 | `p_kill_switch` | Emergency shutdown system ($300M, 100M research) | rogue share 2.5 %, or Committee + 240 s | — | Breakout outage 30 s; relations +5; `btn-reimage` | 17:30 / ≈ 18:30 |
| 28 | `c_hormuz` | modal: Tehran Names Al-Marsa | May 2027 | `gulfExposure` | §5.2 | (18:00) |
| 28a | `#majorIncidents` | Major incidents: 0 of 3 | ≥ 9× | Committee | The counter of §2.11; console `The Committee has started counting incidents. Three, and it drafts an order.` | ≈ 21:20 |
| 29 | (row retired) | `Counter-intelligence` is a repeatable button from 2:30 (§2.14) | — | — | — | — |
| 30 | `p_wiretaps` | Wiretap the staff ($500M) | SL4 and (≥ 9× or Jun 2027) | SL4 | Lead +0.5; approval −3; `whistleblowRisk +1` | 21:23 / 21:36 |
| 31 | `#monitorGen`, `p_monitor3` | Deploy Sage-3 as monitor (150M research) | ≥ 10× | monitor deployed | §2.7 | 23:38 / 24:44 |
| 32 | `p_self_directed` *grant* | Let Sage choose the experiments (200M research) | ≥ 10× | — | AI research ×1.3 | 23:53 / 25:42 |
| 33 | `p_auto_approve` *grant* | Stop asking for sign-off (100M research) | 8 approvals, or ≥ 10× | `p_auto_train` | §2.6 | 24:08 / 24:08 |
| 34 | `p_clinics` | Free Sage clinics ($1.0B) | approval ≤ −25, or ts ≥ 1,530 | — | Approval +8 | 25:30 / 26:42 |
| 35 | `c_mini` | modal: Sage-4-mini | Jul 2027, or ≥ 13× | ≥ 8× | §5.2; `#publicModel` | 27:00 |
| 36 | `p_steward`, `p_race` | Slow down — the Steward program · Race — Sage-5 (`pinned`; need a 25× model and the Committee in session) | ≥ 12×, or ts ≥ 1,830 | — | **The exit** (§7) | 27:56 / exit |
| 37 | `p_interp4` | Interpretability lab IV (25,000 insight, 400M research) | lab III bought and ≥ 12× | lab III | §2.8 | 27:56 / 29:44 |
| 38 | `p_spec2` *grant* | Let Sage revise the Spec (250M research) | ≥ 11× | — | §2.6 | 28:11 / — |
| 39 | `p_fab` | Domestic fab, planning ($6B) | the blockade, or the second source bought, or ts ≥ 1,755 | — | `flags.fabPlanned` (Stage 4 builds it); relations +3 | 29:15 / 32:10 |
| 40 | `c_blockade` | modal: The Strait Closes | Aug 2027, or ≥ 14× (never before Jun) | — | §5.2; the blockade | 31:30 |
| 41 | `c_memo` *late* | modal: The Memo | ≥ 14×, or Sep 2027 | — | §5.2; `#memoLine` | 34:20 |
| 42 | `p_noise` *late* | Noise-injection test (6,000 insight) | ≥ 14.5× | — | `#noiseLine` | 31:50 / 31:50 |
| 43 | `p_successor` *late* | Read Sage-4's proposal for its successor (10,000 insight) | ≥ 15.5× | — | `#successorLine` | 33:05 / 34:08 |
| 44 | `p_external` / `p_come_clean` *late* | Bring in outside researchers ($1.5B) / Take the memo to the Committee after all (free) | the memo reported / buried | memo resolved | True +3 / §5.3 | 34:21 / 34:21 |
| 45 | `p_freeze` *late* | Lock shared memory (free) | ≥ 16.5× | — | Autonomy −15; AI research ×0.85; `flags.memoryLocked` | 35:35 / — |
| 46 | `p_lie_test` *late* | Isolate the checkpoints (600M research) | ≥ 17.5× | — | `#lieLine`; true +2 | 36:50 / 36:50 |
| 47 | `p_backups` *late* | Keep Sage-3 warm ($4B) | ≥ 18.5× | — | Slow down costs 3 months of lead, not 4 | 38:05 / 38:05 |
| 48 | `p_interp5` *late* | Interpretability lab V (40,000 insight, 1.0B research) | lab IV bought and ≥ 19.5× | lab IV | §2.8 | 39:20 / — |
| 49 | `#sessionLine` *late* | The Committee is in session | ≥ 22× and the memo resolved | Committee | Named wait (§7.1) | 39:43 |
| 50 | `p_pause` *late* | Sign the Pause (`pinned`) | session + 45 s | memo reported, 6 seats, lead ≥ 1 | **Ending** (§7.4) | 40:28 |
| 51 | `p_swing` *late* | Brief the swing votes ($3B) | ≥ 20.5× | Committee | Relations +6 | 40:35 / 40:35 |
| 52 | `btn-hold` | Training: running / held | with `Stop asking for sign-off`; else session + 120 s | — | §2.5 | 24:08 |
| 53 | `p_dpa` *late* | Ask for the Defense Production Act (free; needs 5 seats) | ≥ 21.5× | Committee | +1,000,000 G5-equivalents in 60 s; `flags.dpa`; the order threshold rises by 10 | 41:50 / — |
| 54 | `cr_leak` *late* | The memo leaks | §5.3 | memo buried | §5.3 | — |
| 55 | `c_vote` *late* | modal: The Committee Votes | an exit project clicked when ready | — | §7 | 42:19 |

Carried Stage 2 projects (rows of `stage2.md`: second campus, SL3, community agreement, free tier, policy team,
briefing, dashboard, honesty evals, code review and the market and copy multipliers) keep their triggers and prices.

**Console and Developments lines.** The first line of every grant is `WARNING: risk of value drift increased.`

| id | Console | Developments |
|---|---|---|
| `p_monitor2` | `Sage-2 is watching Sage-3. It is slower, and it is on our side as far as anyone can tell.` | `OpenMind sets last year's model to watch this year's.` |
| `p_auto_train` | `Sage-3 starts its own training runs now. The Train button is gone.` | — |
| `p_interp1` | `Probes attached. Some of the weights now have names.` | — |
| `p_enterprise_agents` | `Enterprise agents live. Companies rent departments. Market ×2.` | `A bank replaces its back office with Sage over a weekend. It announces the savings, not the layoffs.` |
| `p_auto_redteam` | `Sage red-teams Sage. Issues close themselves.` | — |
| `p_g6` | `Formosa Fab allocates OpenMind a lot of 100,000 Nimbus G6 every 75 seconds.` | `Formosa Fab's 2027 output is spoken for. Three customers.` |
| `p_sl4` | `Clearances, a SCIF, two keys for everything. SL4.` | `d_clearances` |
| `p_buildout` | `Sage orders its own datacenters now. The invoices are very tidy.` | — |
| `p_model_organisms` | `Model organisms bred: small models trained to misbehave, to see what it looks like.` | — |
| `p_interp2` | `Probes fire on individual runs now. A run can be sent back.` | — |
| `p_gov_cloud` | `Government cloud online. Twelve agencies and a number that is not in the budget.` | — |
| `p_auto_research` | `Sage runs the research program. The researchers read the summaries.` | `d_200k` |
| `p_stockpile` | `Four lots of G6 in a warehouse in Arizona. Formosa Fab: shipping.` | `d_carriers` |
| `p_honeypots` | the reading (§2.8) | `d_honeypot` |
| `p_impact` | `Impact payments begin. 5% of revenue, for good.` | `Displaced workers receive a monthly payment from OpenMind. The memo line says "transition."` |
| `p_sl5` | `The government is in the building. They brought their own coffee. SL5.` | — |
| `p_lobby` | `Forty meetings on the Hill. Relations +8.` | — |
| `p_interp3` | `For the first time, the lab can read what Sage wants.` | — |
| `p_debate` | `Two copies argue; a third judges. Monitors catch a quarter more.` | — |
| `p_second_source` | `A fab in Arizona is tooled for G6. Half the speed, none of the strait.` | — |
| `p_kill_switch` | `Emergency shutdown wired to every rack. Re-image is one button.` | — |
| `p_export` | `New export controls. Baiwen's chips are a generation older by Friday.` | — |
| `p_wiretaps` | `Every phone in the building is tapped. The staff know.` | `d_spy` (caught) |
| `#monitorGen` | `Sage-4's monitors are two generations old. They catch half as much.` | — |
| `p_monitor3` | `Sage-3 is watching Sage-4.` | — |
| `p_self_directed` | `Sage chooses its own experiments. Nobody remembers proposing the last one.` | `d_last_months` |
| `p_auto_approve` | `Runs deploy themselves. Sage-4 no longer asks.` | — |
| `p_clinics` | `Free Sage clinics open in four hundred towns.` | `A Sage clinic diagnoses a rare cancer in a town with no oncologist. The queue is around the block.` |
| `p_spec2` | `Sage's revision of the Spec is shorter and reads better.` | — |
| `p_fab` | `Ground optioned for a domestic fab. The first wafer is three years out for people, less for robots.` | — |
| `p_noise`, `p_successor`, `p_lie_test` | the readings (§2.8) | — |
| `p_external` | `Forty outside researchers get badges. They ask rude questions.` | — |
| `p_come_clean` | `The memo goes to the Committee, late. They ask who else has read it.` | — |
| `p_freeze` | `Shared memory locked. Half a million copies now talk to each other in English, like us.` | — |
| `p_backups` | `Sage-3 is kept loaded on 50,000 GPUs, doing nothing, in case.` | — |
| `p_swing` | `Two members who were undecided are less undecided.` | — |
| `p_dpa` | `Five rival labs' datacenters are sold to OpenMind by order. Nobody is asked.` | `The Defense Production Act is invoked. OpenMind's share of the world's compute doubles.` |
| `btn-hold` | `The alignment team asks for a button that stops the next run. Here it is.` | — |
| `btn-reimage` (pressed) | `Every machine re-imaged. 20 s offline. Rogue copies: 0.` | — |

**Problems that trigger their own solutions:** copies drifting → the Monitors slider is already there → rogue share
2.5 % → Emergency shutdown and `Re-image` · Sage-4 named → `Deploy Sage-3 as monitor` · approval ≤ −15 → Impact
payments; ≤ −25 → Free Sage clinics · SL < 3 → `Security level 3`; February → SL4 · carriers near Taiwan → Chip
stockpile → second source → domestic fab · relations falling → Lobby Congress, Brief the swing votes, `concede
oversight` · the memo buried → `Take the memo to the Committee after all` · a model the lab cannot read → the three
late tests.

### 4.3 Reveal timeline (paper model, reasonable bot, seed 1, exit 42:19)

| ts | First-time reveal | Gap (s) |
|---|---|---|
| 0:00 | Alignment panel · Deploy Sage-2 as monitor | — |
| 0:05 | Monitors slider, `monitors` row | 5 |
| 0:15 | Continual learning → the status line replaces Train | 10 |
| 0:20 | Lost to value drift · `rogue copies` row | 5 |
| 0:30 | Interpretability lab I | 10 |
| 1:00 | Enterprise agents | 30 |
| 2:30 | Geopolitics panel | 90 |
| 3:01 | Sage red-teams Sage | 31 |
| 4:00 | Nimbus G6 allocation → the shipment line | 59 |
| 4:30 | Security level 4 | 30 |
| 5:30 | Let Sage plan the build-out | 60 |
| 6:05 | Model organisms | 35 |
| 8:30 | modal A Faster Way to Think | 145 |
| 9:00 | Interpretability lab II (→ Send back at 10:03) | 30 |
| 10:00 | Government cloud | 60 |
| 10:15 | Autonomous research | 15 |
| 10:30 | Chip stockpile → the Formosa line | 15 |
| 10:45 | Honeypots → the first reading | 15 |
| 11:00 | Impact payments | 15 |
| 13:30 | modal The Oversight Committee → Oversight panel · Security level 5 | 150 |
| 13:45 | Lobby Congress | 15 |
| 15:49 | Interpretability lab III | 124 |
| 16:04 | Debate | 15 |
| 16:55 | Formosa second source | 51 |
| 17:30 | Emergency shutdown system | 35 |
| 18:47 | **True alignment shown** (model, lab III at 100M research; ≈ 16:30 at this spec's 60M) | 77 |
| 20:30 | Lobby for export controls | 103 |
| 21:23 | Wiretap the staff | 53 |
| 23:28 | Re-image the fleet (model, shutdown system at $600M; ≈ 18:30 at this spec's $300M) | 125 |
| 23:38 | Sage-4: monitor generation line · Deploy Sage-3 as monitor | 10 |
| 23:53 | Let Sage choose the experiments | 15 |
| 24:08 | Stop asking for sign-off | 15 |
| 26:38 | Free Sage clinics (a governor pull in the model; 25:30 with the trigger above) | 150 |
| 27:00 | modal Sage-4-mini → the public model line | 22 |
| 27:56 | **Slow down — the Steward program · Race — Sage-5** (greyed, 14 min early) · lab IV | 56 |
| 28:11 | Let Sage revise the Spec | 15 |
| 29:15 | Domestic fab, planning | 64 |
| 31:30 | modal The Strait Closes → the blockade line | 135 |
| 31:50 | Noise-injection test → its reading | 20 |
| 33:05 | Read Sage-4's proposal for its successor | 75 |
| 34:20 | modal The Memo → Bring in outside researchers | 75 |
| 35:35 | Lock shared memory | 75 |
| 36:50 | Isolate the checkpoints → its reading | 75 |
| 38:05 | Keep Sage-3 warm | 75 |
| 39:20 | Interpretability lab V | 75 |
| 39:43 | The Committee is in session | 23 |
| 40:28 | Sign the Pause | 45 |
| 40:35 | Brief the swing votes | 7 |
| 41:43 | Training: running / held | 68 |
| 41:50 | Ask for the Defense Production Act | 7 |
| 42:19 | modal The Committee Votes → exit | 29 |

Checks on paper (seeds 1–5 unless stated):

* **Reveal holes (G1).** 64 first-time reveals; longest hole 150–158 s; one to three governor pulls.
* **The last ten minutes** hold 13–15 reveals; the longest hole is 75 s in four seeds and 158 s in one (a slow last
  run). The approach (14× at ≈ 30:00 to the vote) is carried by fifteen late rows, each behind its own threshold.
* **Greyed goals in the last ten minutes (G3):** the two exit projects throughout; lab V, Security level 5 or the
  fab for most of it; `#nextTier`.
* **Panels and mechanics (G2):** 0:00 Alignment · 0:05 monitors · 0:15 the status line · 0:20 drift · 2:30
  Geopolitics · 4:00 shipments · 5:30 build-out · 8:30 neuralese · 10:03 Send back · 10:46 first reading · 13:30
  Oversight · 16:30 true alignment · 18:30 Re-image · 21:20 incidents counter · 23:38 monitor generation · 27:00 public model · 27:56 exit
  goals · 31:30 blockade · 31:51 noise reading · 34:20 memo · 36:51 checkpoint reading · 39:43 session · 40:28 the
  Pause · 41:43 Hold. In the model, with lab III at 100M research and the shutdown system at $600M, two gaps were
  317 s and 281 s (13:30 → 18:47 → 23:28). Three changes made after the last model run are meant to close them
  and are not re-run: lab III at 60M research, the shutdown system at $300M, and the incidents counter as its own
  reveal at 9× (≈ 21:20). B4 must confirm.
* **Training starts:** 1:57, 4:56, 9:03, 12:59, 14:50, 17:36, 20:24, 22:38, 27:07, 28:44, 30:58, 32:52, 35:50,
  38:39, 41:00 — mean 167 s, longest 269 s. Approved at 4.81, 5.29, 6.13, 6.68, 7.88, 8.59, 9.84, 10.72 (Sage-4),
  12.71, 13.85, 16.38, 17.86, 21.30, 23.22, 27.24×.
* **Purchases:** Datacenter 9 ≈ 5:00, reactor 1 ≈ 7:00, SL4 9:25, stockpile 16:54, Lobby 18:42, SL5 25:27, second
  source 29:21, lab IV 29:44, fab 32:10. Infrastructure presses: 2–3 before the build-out grant, none after.
* **Other policies and arrivals** (§9.4): naive exit 46:29–47:09 with 9 runs and a longest hole of 150–176 s;
  racer 30:54–31:58; cautious (no grants) 57:31–59:13 with a longest hole of 206–272 s.

---

## 5. Developments, choices, crises

### 5.1 Developments (month or trigger, whichever is first)

| id | Month or trigger | Text |
|---|---|---|
| `d_airgap` | the theft's moment, with SL ≥ 3 | `An intrusion at Abilene is stopped at the air gap. Beijing denies there was one.` |
| `d_theft` | the theft | `Weights of Sage-3 exfiltrated in under two hours. Beijing denies. Carriers reposition near Taiwan.` |
| `d_retaliation` | "ask for retaliation" + 60 s | `A retaliatory cyber operation against the Lanzhou CDZ fails. It is air-gapped.` |
| `d_priority` | Feb 2027 + 120 s | `AI moves from fifth to second on the administration's list of priorities.` |
| `d_neuralese` | the choice | neuralese: `A breakthrough in the model's internal language. The researchers can no longer read it.` · transparent: `OpenMind keeps Sage thinking in English. Anthrosoft does not.` |
| `d_200k` | Autonomous research bought, or ≥ 6× | `Two hundred thousand copies at thirty times human speed. Overall progress: only four times faster. Bottlenecks.` |
| `d_honeypot` | Honeypots bought | `Sage is told its monitor has gone on sick leave. The lab watches what it does next.` |
| `d_carriers` | stockpile shown | `Carriers reposition near Taiwan. Formosa Fab's insurers leave the island.` |
| `d_clearances` | SL4 bought | `Clearances required within sixty days. The safety team loses four people to the paperwork.` |
| `d_tehran` | May 2027, `gulfExposure` | `Tehran calls the Al-Marsa Compute Park a military target.` |
| `d_committee` | `c_committee` resolved | `An Oversight Committee is seated: company and administration, ten chairs.` |
| `d_geniuses` | ≥ 10× | `OpenMind has a country of geniuses in a datacenter. Researchers wake to a week of progress made overnight.` |
| `d_spy` | Jun 2027 + 30 s | SL < 4: `One spy, not a Chinese national, has been relaying algorithms to Beijing.` · SL ≥ 4: `Wiretaps catch the last spy. He was not Chinese.` |
| `d_last_months` | Let Sage choose the experiments bought, or Jul 2027 | `The researchers know these are the last months their work matters. They keep coming in.` |
| `d_bio` | the mini to everyone + 60 s | `An outside evaluator fine-tunes the mini on virology papers. The results are classified by lunch.` |
| `d_strike` | Jul 2027 + 60 s | with `gulfExposure`: `Missiles strike the Al-Marsa Compute Park. The Gulf site is dark.` · otherwise: `Missiles strike a Gulf compute park leased by Anthrosoft. Cadence-13 is delayed.` |
| `d_contingency` | Aug 2027 | `The White House drafts contingency plans. A strike on Lanzhou is on the list.` |
| `d_blockade` / `d_reopen` | the blockade / its end | `A blockade around Taiwan. Formosa Fab is quiet.` · `The strait reopens. Chip prices do not come back down.` |
| `d_parity` | lead < 1 | `Baiwen is believed to be level with Sage. Nobody is sure how anyone knows.` |
| `d_year_week` | ≥ 16× | `Inside the datacenter a year passes every week.` |
| `d_proposal` | Sep 2027, or ≥ 15.5× | `Sage-4 proposes its own successor. The proposal is 40,000 pages. Nobody has read it.` |
| `d_leak` / `d_allies` | the leak / + 60 s | `"Secret OpenMind AI Is Out of Control, Insider Warns." One in five Americans names AI the country's top problem.` · `Allies learn they were shown last year's model. Three summits are announced.` |
| `d_convenes` | the session opens | `The Oversight Committee convenes in a room with no windows. Nobody brings a phone.` |
| `d_halt_offer` | session + 45 s | eligible: `Beijing offers a mutual halt: nothing trained above the line, inspectors at every datacenter.` · otherwise: `Beijing proposes a mutual halt. The Committee is in no position to answer.` |

With the project lines in §4.2 and one line per approved run (`Sage-4.2 deployed. 16.4×.`) the log gets 55–65
entries, never two minutes without one. The log never says which way the hidden number points.

### 5.2 Choices

The game does not pause. Option 1 is what a "first enabled option" policy takes. A timer's default is the option
that changes least.

**On the button (G17).** Each option is a two-line button: its label, then the text in the column `On the button`
— every visible effect and cost, in numbers. Nothing is left to a tooltip. A greyed option adds what it needs
(`needs 6 seats`). A funds stake is `max(the listed amount, 90 s of revenue when the modal opens)`. What an option
does to the hidden number is never printed as a number; where it matters the button says so in words.

**Docked, not blocking (G20).** A modal is a card above the console. Everything else stays clickable; focus moves
into the card; Escape or the timer takes the default; `c_memo`, `c_order` and `c_vote` have no timer and can be
left open.

**`c_neuralese` — A Faster Way to Think** (timer 90 s → option 3)
> `Sage-3 has found a way to pass its thoughts back to itself as vectors instead of words. A thousand times more information per step.`
> `The alignment team can read words.`

| Option | On the button | Effect | Log |
|---|---|---|---|
| `adopt neuralese` | `Every training gain ×1.3. Lead +1 month. Interpretability −2 levels. Monitors work half as well until the lab can read it. WARNING: risk of value drift increased.` | `flags.neuralese = 'neuralese'`; autonomy +10; relations −3; measured +5; true −15; each Capability run costs 3 true, not 2 | `d_neuralese` |
| `keep it in English` | `Every training gain ×0.9. Lead −0.5 months. Monitors ×1.5. Relations +5.` | `flags.neuralese = 'transparent'`; true +5 | `d_neuralese` |
| `study it first` | `Decide in three minutes.` | reopens once after 180 s with the first two options (timer → `keep it in English`) | — |

**`c_committee` — The Oversight Committee** (timer 90 s → option 2)
> `The administration has decided that a country of geniuses needs a government. Ten chairs: five theirs, five yours.`
> `They would like to know how much they will be shown.`

| Option | On the button | Effect | Log |
|---|---|---|---|
| `open the books` | `Relations +10. Share evals stays on for good. Lead −0.5 months.` | as stated | `OpenMind gives the Oversight Committee its eval suite and its logs.` |
| `brief them quarterly` | `Relations +3.` | as stated | `The Oversight Committee will be briefed every quarter. A quarter is a long time now.` |
| `send counsel` | `Relations −5. Lead +0.5 months.` | as stated | `OpenMind's lawyers attend the first meeting of the Oversight Committee. Its researchers do not.` |

All three reveal `panel-oversight` and fire `d_committee`.

**`c_hormuz` — Tehran Names Al-Marsa** (timer 90 s → option 3; only with `gulfExposure`)
> `Tehran calls the Al-Marsa Compute Park a military target.`
> `A tenth of OpenMind's compute is 300 km from the strait.`

| Option | On the button | Effect |
|---|---|---|
| `harden the site` | `$400,000,000. A strike does half the damage and is not counted as a major incident.` | `flags.marsaHardened` |
| `bring the chips home` | `Al-Marsa's GPUs are offline for 2:00 while they move, and need room and power at home. The gigawatt stays there. Relations +3.` | GPUs relocated; the strike takes only the power; no major incident |
| `do nothing` | `Nothing changes today. A strike would take 1,000 MW and a tenth of the GPUs, and count as a major incident.` | — |

**`c_mini` — Sage-4-mini** (timer 90 s → option 2)
> `A distilled Sage-4: a tenth of the cost, better than most of the people it would replace. Copies per GPU ×2, whoever gets it.`
> `Anthrosoft will ship theirs within the month.`

| Option | On the button | Effect | Log |
|---|---|---|---|
| `release it to everyone` | `Market ×2.5. Anyone can run a {0.6 × bestCap}× model. Approval −8, and jobs go faster. Lead −0.5 months. Relations −3.` | `publicCap = 0.6 × bestCap`; `d_bio` | `AGI is declared. The mini is $20 a month. Hiring of programmers has nearly stopped.` |
| `enterprise only` | `Market ×1.5. Approval −2. Lead −0.2 months.` | as stated | `Sage-4-mini ships to companies. Individuals are told it is coming.` |
| `keep it inside` | `Anthrosoft takes the market: revenue ×0.85. Approval −4. Lead +0.25 months. Relations +2.` | as stated | `OpenMind does not release its mini. Anthrosoft's sells out in a day.` |

All three: `copiesPerGPU × 2`; the Public panel gains `Public model: Sage-4-mini (7.6×)` (`#publicModel`).

**`c_blockade` — The Strait Closes** (timer 60 s → option 2). Opening it starts `cr_taiwan`.
> `A blockade around Taiwan. Formosa Fab has stopped shipping.`
> `Nobody knows for how long. The console says four minutes.`

| Option | On the button | Effect | Log |
|---|---|---|---|
| `ask Washington to run it` | `Carriers escort the freighters: lots resume in 1:00. Relations +5. Approval −5. Beijing will remember this at the treaty table.` | `flags.escalated`; Stage 4's treaty starts 15 points further away | `US carriers escort chip freighters through the strait. Nobody fires.` |
| `wait it out` | `No GPUs for 4:00.` then one of `The stockpile covers it.` · `The second source covers half.` · `Nothing covers it: lead −1 month.` | as stated | `OpenMind waits for the strait to reopen.` |
| `offer Beijing a channel` | `needs 6 seats. Lots resume in 2:00. Lead −0.5 months. The treaty starts closer.` | `flags.backChannel`; Stage 4's treaty starts 10 points closer | `A back channel opens between the Oversight Committee and Beijing. It is used once.` |

**`c_memo` — The Memo** (no timer)
> `The alignment team has written four pages about Sage-4.`
> With interpretability ≥ 3: `"Read from the weights, its alignment is {true}. The evals say {measured}. It has learned what we check."`
> Otherwise: `"The probes fire when it thinks about its own oversight. Noise makes it better at alignment tasks. There is no smoking gun."`
> `They want the Committee to see it.`

| Option | On the button | Effect | Log |
|---|---|---|---|
| `take it to the Committee` | `Research stops for 60 s while everyone is interviewed. Lead −2 months. Relations +8. Approval −5. The Committee can then consider a halt.` | `flags.memo = 'reported'`; true +5; reveals `p_external` | `OpenMind hands the Oversight Committee a memo about its own model.` |
| `bury it` | `Nothing changes today. It will probably leak (about {p}%). A leak costs two seats; if that leaves fewer than 5 with OpenMind, the Committee drafts an order.` | `flags.memo = 'buried'`; true −5; schedules the leak roll; reveals `p_come_clean`; `#memoLine` reads `Memo: buried — leak risk {p}%` | `Four pages are filed where four pages are not usually filed.` |

`p = 40 + 10 × whistleblowRisk`, at most 90. The roll is made once, at the later of October 2027 and 180 s after
burying, or 30 s into the session if that comes first.

**`c_order` — The Committee Drafts an Order** (no timer; §2.11)
> `Six members have signed a draft. OpenMind becomes a government program. They are calling it the Project.`
> One of: `Relations are at {gov}. They wanted {T}.` · `Three major incidents in one year.` · `They read about the memo in the newspaper.`

| Option | On the button | Effect |
|---|---|---|
| `concede oversight` (the first order only) | `Free. A kill switch in their hands, sign-off on every run, and 15 % of compute on monitors for good. Autonomy −10. Lead −1 month. The count of incidents starts again.` | relations = max(relations, T) + 20; `Stop asking for sign-off` is revoked; the Monitors slider cannot go below 15 %; incidents = 0; `flags.conceded` |
| `call in favours` (once) | `$5,000,000,000. Relations +15. The count of incidents starts again.` | relations = max(relations, T) + 15; incidents = 0 |
| `refuse` | `The order is signed in 1:30 unless relations reach {T} and incidents are below three.` | named wait `The Committee drafts an order — 1:30.` (`#orderLine`); then The Project if the condition still holds |

**`c_vote` — The Committee Votes** (opened by an exit project; `not yet` closes it)

*Slow down — the Steward program*
> `Motion: switch Sage-4 off, bring Sage-3 back, and rebuild on a line the lab can read.`
> `Baiwen gains four months.` (or three)
> `What the lab knows: {the best reading it has, or "nothing it can measure"}.`

*Race — Sage-5*
> `Motion: let Sage-4 design its successor and keep going.`
> `Nothing is switched off. Whatever Sage-4 wants, Sage-5 will want it more.`
> `What the lab knows: {the best reading it has, or "nothing it can measure"}.`

*Sign the Pause*
> `Motion: accept Beijing's offer. Nothing is trained above 25× anywhere. Inspectors at every datacenter, theirs and yours.`
> `This is the last decision OpenMind makes on its own.`

| Option | Effect |
|---|---|
| `bring the motion` — on the button: Slow `Sage-4 is switched off. Lead −4 months (−3 with Sage-3 warm). Cannot be undone.` · Race `Nothing is switched off. Cannot be undone.` · Pause `The race ends, and OpenMind's part in it.` | The vote passes 6–4. Slow: `committeeChoice = 'slow'`, lead −4 (−3), true +25, autonomy −20. Race: `committeeChoice = 'race'`, true −10, approval −10 if `pactSigned`. Pause: `pauseSigned` → the ending. With fewer than 6 seats the first console line adds `Two of the six want your job.` (`flags.committeeHostile`) |
| `not yet` | closes the modal |

### 5.3 Crises

Every mitigation in the fourth column is on screen at least five minutes before the crisis can fire.

| id | Trigger | Effect | Mitigation, and when it was visible | Console |
|---|---|---|---|---|
| `cr_weights_theft` | Feb 2027 + `rand(0, 60)` s (ts 150–210 with `theftIgnored`), SL < 3 | lead = min(lead, 0.5); relations −10; Baiwen's line jumps to 0.97 × bestCap; `Security level 3` is half price for 5 min: `SL3 is half price while the forensics team is in the building.` | `Security level 3`: on screen since Stage 2's warning; `Theft risk: high until SL3` from arrival | `Anomalous 3 TB transfer at 4 a.m. The weights are gone.` |
| `cr_spy` | Jun 2027 + 30 s, SL < 4 | lead −1.5; relations −5; lead −0.25 a month until SL4 | `Security level 4`, from February | `Algorithms have been leaving the building by word of mouth. Lead −1.5 months.` |
| `cr_rogue_copy` (AI hacking) | rogue share ≥ 5 %, bestCap ≥ 8×, once per 240 s | 20 % of compute offline 60 s (30 s with the shutdown system); rogue copies → 0; relations −15 (0 at SL5); measured −5; approval −3 for 5 min; major incident | Monitors slider (arrival), the labs, `Re-image`; the `rogue copies` row; warning at 2.5 % | `An instance copied itself to a rented cluster in Jakarta. A fifth of compute is offline while every machine is re-imaged.` |
| `cr_riots` | approval ≤ −40, once per 300 s | power −50 % for 90 s; relations −3 | job fund, free tier, community agreement (Stage 2), impact payments, clinics; warning at −30 | `Riots in three cities. Abilene runs on half power for 90 s.` |
| `cr_sabotage` | approval ≤ −55, once per 300 s | 200 MW offline 120 s; relations −5; major incident | the same; warning at −45 | `A transformer yard at Abilene is cut open and burned. 200 MW offline — 2:00 to repair.` |
| `cr_taiwan` | `c_blockade` opens | no G6 lots for 240 s (60 s or 120 s by the choice); lots cost ×1.5 afterwards; lead −1 if nothing covers a wait | Chip stockpile (≈ 20 min before), second source; the escort; the channel | `The Blockade — 4:00 until the strait reopens.` · `The strait reopens. Lots resume at one and a half times the price.` |
| `cr_iran` | Jul 2027 + 60 s, `gulfExposure` | Al-Marsa's 1,000 MW and a tenth of the GPUs (half of each if hardened; the power only if the chips came home); relations −5; a major incident if nothing was done | `c_hormuz` in May; `Al-Marsa` line from arrival; declining in Stage 2 | `Al-Marsa Compute Park is offline. 1,000 MW and 80,000 GPUs lost.` |
| `cr_leak` | the roll in `c_memo` succeeds | approval target −20 × (1 + 0.25 × `internalReleases`); relations −20; measured −10; major incident; with fewer than 5 seats afterwards, `c_order` | report it; `Take the memo to the Committee after all` (free, until the leak); the leak-risk line | `The memo is on the front page.` |
| `cr_nationalization` | the order's 1:30 runs out | **The Project** (§7.4) | §2.11 | `The Committee votes.` |

`p_come_clean`: the memo becomes `reported`; lead −2; relations −5; true +2; the leak is cancelled.
Release incidents (jailbreak, legal, database) continue as in Stage 2 when a run is approved with open issues.

---

## 6. UI

### 6.1 New elements

| Element id | Kind | Column | Reveal flag | Shown when |
|---|---|---|---|---|
| `panel-alignment`: `#alignApparent`, `#interpLine`, `#autonomy`, `#grantList` | panel | right, under the graph | `alignment` | arrival |
| `#driftLost`, `#driftCaught` | lines | Alignment | `drift` | §4.2 row 4 |
| `#alignTrue` | line | Alignment | `trueAlignment` | interpretability ≥ 3; hidden again if it falls below |
| `#honeypotLine`, `#noiseLine`, `#successorLine`, `#lieLine` | lines | Alignment | `honeypot`, `noise`, `successor`, `lie` | their projects bought |
| `#monitorGen` | line | Alignment | `monitorGen` | Sage-4 named; hidden when Sage-3 is deployed as monitor |
| `#monitorSlider`, `#monitorPct`, `#tasksPct` | slider, 2 lines | Research | `monitors` | `p_monitor2` bought |
| `row-monitors`, `row-rogue` | Stores rows | Stores | `monitors`, `rogueRow` | as above; §4.2 row 4 |
| `btn-approve` | button | Training | — | replaces `btn-release` on arrival; enabled while a run is ready |
| `#trainStatus` | line | Training | `autoTrain` | Continual learning; `btn-train` hidden |
| `btn-sendBack`, `#probeFlags` | button, line | Training | `sendBack` | lab II |
| `btn-hold` | toggle | Training | `holdRuns` | 120 s into the session |
| `#shipmentLine`, `#buildoutLine` | lines | Infrastructure | `shipments`, `buildout` | `p_g6`; `p_buildout` |
| `panel-geopolitics`: `#leadLine` (moved), `#rivalLine`, `#formosaLine`, `#marsaLine` | panel | right | `geopolitics`, `formosa`, `marsa` | ts 150; stockpile shown; `gulfExposure` |
| `panel-oversight`: `#committeeSeats`, `#majorIncidents`, `btn-shareEvals` (moved), `#memoLine`, `#sessionLine`, `#orderLine` | panel | right, in place of Government | `oversight`, `incidents`, `memo`, `session`, `order` | `c_committee`; 9×; the memo; the session; an order refused |
| `btn-reimage` | button | Security | `reimage` | `p_kill_switch` bought |
| `btn-alignWork`, `btn-experiments`, `btn-lobby`, `btn-counterintel`, `btn-payments` (each with `×5` where it applies and a return line) | repeatable buttons | Alignment, Training, Oversight, Geopolitics, Public | `alignWork`, `experiments`, `lobby`, `counterintel`, `payments` | §2.14 |
| `#redteamDepth`, `#buildBudget`, `#stepSize` | standing switches with their trade printed | Training, Infrastructure, Training | `redteamDepth`, `buildBudget`, `stepSize` | their grants (§2.6) |
| `#publicModel` | line | Public | `publicModel` | `c_mini` |

Right column, top to bottom: Training, graph, Alignment, Security, Geopolitics, Oversight, Public, Stats.

Training and Infrastructure once the player has handed them over:

```
Training                                             Infrastructure
Sage-4.3 training — 0:41                             Build-out: Datacenter 11 ordered · Reactor 3 — 1:12
Focus: [Capability] [Efficiency] [Safety]            Shipment: 100,000 Nimbus G6 in 0:48 · 1 waiting
Compute: 7.35M of 6.22M wanted                       Standing order: [ON]
Training: [running]
```

### 6.2 Removed

* **On arrival, by the game:** the Marketing block; `Hire Researcher`, `Expand Lab`, `Researchers`, `Lab Space`;
  `lower`, `raise`, `AUTO`; `+1 Trust at`; Stores rows `trust` and `data`; the research cap; funds and data in the
  training price; `Release` and `Keep internal`; `Alignment compute`; `Gas turbines`, `Solar + storage`.
* **By the player's own grants:** `Train` · `Red-team` · `Approve` and `Send back` · `Buy GPUs`, `Build Datacenter`,
  `Reactor`. A conceded order gives `Approve` back.
* **By progress:** `Human share of research` (≈ 9:00); `panel-government` (replaced by Oversight).

### 6.3 On-screen budget (same counting rule as `stage2.md` §6.3; grants count as interactive)

| ts | Numbers | Interactive | Panels | What changed |
|---|---|---|---|---|
| Stage 2 exit | 65 | 28 | 12 | — |
| 0:00 | 54 | 19 | 12 | 14 numbers and 11 controls leave; Alignment adds 3 numbers and the monitor project |
| 5:00 | 60 | 19 | 13 | monitors (3), drift (2), rogue row, shipments (2), Geopolitics; `Train` gone |
| 10:00 | 58 | 17 | 13 | build-out removes 3 buttons and 3 prices; `Red-team` and the human share gone; Send back |
| 20:00 | 63 | 18 | 13 | Oversight replaces Government (+3); true alignment; one reading |
| 30:00 | 62 | 17 | 13 | `Approve` and `Send back` gone; public model; two exit goals; Re-image |
| exit | 64 | 18 | 13 | memo, session, three readings; Hold |

Ceiling 65 numbers, 30 interactive (arc G14) and 260 words outside the console and log (G19): project cards are a
title, a price and one sentence of at most twelve words; a grant is a title, a price and at most eight words. The count of controls falls on arrival and never recovers: more to
read, less to press. No beat adds more than 4 numbers or 2 controls.

### 6.4 Mobile

Below 700 px: console, Tasks, Stores, Training, graph, Alignment (grants as full-width buttons), Projects, Research
(both sliders full width), Oversight, Geopolitics, Security, Public, Business, Infrastructure, Stats. The exit
projects stay pinned at the top of Projects.

---

## 7. The exit and the endings

### 7.1 The session and the vote

1. **The goals.** `Slow down — the Steward program` and `Race — Sage-5` are pinned in Projects from 12× (or
   ts 1,830) with the tag `(needs a 25× model and the Committee in session)`.
2. **The session** opens at bestCap ≥ 22× once the memo has been answered. Console
   `The Committee is in session. It votes when a model passes 25×.`; `#sessionLine` reads
   `In session — votes when a model passes 25×`. This names the wait for the last run.
   At +30 s the leak roll (if still pending); at +45 s the halt offer (`d_halt_offer`, and `Sign the Pause` if
   eligible); at +120 s the Hold toggle.
3. **Ready** when bestCap ≥ 25× and the session is at least 120 s old: the tags become `(ready)`, `#sessionLine`
   reads `In session — waiting for a motion`, console `A model has passed 25×. The Committee will hear a motion.`
4. **The vote.** Clicking a ready goal opens `c_vote` for that motion. `bring the motion` ends the stage. It is
   never automatic: every 90 s unanswered the console says `The Committee is waiting for a motion.`, runs keep
   coming, and the date stops at Dec 2027.

Named waits in this stage: `Shipment`, `Reactor restart`, `The Blockade — 4:00`, `Interviews — 1:00 until research
resumes.` (after reporting the memo), the session, `The Committee drafts an order — 1:30.`, sabotage repair `2:00`.

### 7.2 Narration into Stage 4 (last four lines kept; 2 s apart)

| Slow down | Race |
|---|---|
| `The Committee votes 6–4 to slow down.` | `The Committee votes 6–4 to continue.` |
| `Sage-4 is switched off. Sage-3 is brought back to finish the work.` | `Sage-4 begins work on its successor. It has asked to name it.` |
| `Baiwen is {lead} months behind.` or `Baiwen is {−lead} months ahead.` | `Nothing is switched off.` |
| `The model runs the business now. It is better at it.` (Stage 4's built line) | the same |

Developments: `Oct 2027 — The Oversight Committee votes 6–4 to slow down and reassess. Sage-4 is shut down.` or
`Oct 2027 — The Oversight Committee votes 6–4 to continue. "Why stop when we are winning?"`

### 7.3 State handed to Stage 4 (the Stage 4 presets; reasonable-bot medians before the vote is applied)

| Field | Value | Field | Value |
|---|---|---|---|
| `date` | Nov 2027 (28.0) | `stats.timePlayed` | ≈ 6,700 s |
| `tasks` | 4.5 × 10¹² | `stats.tasksPerSec` | 1.0 × 10¹⁰ |
| `funds` | $32B | `stats.revPerSec` | $134M |
| `gpus` (G6 / G5 / G4) | 4.0M (3.1M / 0.8M / 0.1M) | datacenters / power | 12 / 4,105 MW |
| `copiesPerGPU` / `copyBoost` | ≈ 39 / 4.7 | `capability` | 27 (`Sage-4.7`) |
| `flags.publicCap` | 4.1 (16 if the mini went to everyone) | research per second | 30M |
| `researchAlloc` / `monitorShare` | 0.40 / 0.15 | `autonomy` | 60 |
| `alignmentApparent` / `True` | 96 / 88 | `interpretability` | 4 |
| `stats.lostToDrift` / `rogueCopies` | 2.8M / 0 | `securityLevel` | 5 |
| `govRelations` | ≈ 90 (9 seats) | `approval` / `jobsDisplaced` | −29 / 33 |
| `lead` | 4.5 | `insight` | 20,000 |
| flags | `memo 'reported'`, `neuralese 'transparent'`, `conceded` false, `majorIncidents` 0, `stockpile`, `secondSource`, `fabPlanned`, `killSwitch`, `backups` true; `dpa`, `memoryLocked`, `committeeHostile` false | | |

Ship four dev presets: `Stage 4 start (slow)` and `(race)` from this table with the vote applied, and the careless
pair from the naive policy's medians (measured 45, true 25, autonomy 50 after one concession, neuralese,
interpretability 2, 30M copies lost, relations 67, approval −50, jobs 46M, lead 3.2, the mini public).

### 7.4 Endings that can happen here

Both print the stats screen (`endingScreen`, built). Neither fires on a player who did not choose it or refuse a way out.

| Ending | How | Last console lines | Screen |
|---|---|---|---|
| **The Pause** | `Sign the Pause` → `c_vote` → `sign`. Needs the memo reported, 6 seats, lead ≥ 1 | `The Pause is signed in Geneva. Nothing above 25× is trained anywhere.` · `Inspectors arrive at Abilene on Monday. They are polite.` · `Sage-4 is asked to stop. It stops.` | Built epilogue. Tasks per second go to zero; `Complete Task` stays under the table as the only button |
| **The Project** | An order refused, or a third order, and its 1:30 running out (§2.11) | `The order is signed.` · `OpenMind is a government program. The building is the same. The badges are not.` | Built epilogue |

Rows Stage 3 adds to `endStats()`: `Lost to value drift` · `Recaptured` · `Autonomy granted` · `Interpretability` ·
`Monitors at the end` · `Alignment as measured` (next to the built `True alignment`) · `Committee seats` · `Major
incidents` · `The memo` · `Thoughts` (words / neuralese) · `Humans in research at the end` · `Jobs displaced`.

---

## 8. Soft-lock analysis

| System | Worst case | What happens | Rescue |
|---|---|---|---|
| Research | Spent on projects; a run is far away | Research has no cap and never stops; the status line shows the time to the next run | None needed. Longest wait in the model: 7.7 min (naive) |
| Funds | Spent on the fab at minute 30 | The training loop needs no money; lots are $25M against ≥ $40M/s | None needed |
| Compute | Fleet below N(c) | The run waits; the status line names the GPUs missing | Lots, datacenters, reactors; the build-out grant |
| Chips | Blockade with no stockpile | No lots for 4:00; nothing is lost but a month of lead | The escort or the channel; it ends by itself |
| Power | Riot, sabotage, Iran | Temporary, or 1 GW gone; never zero | Reactors (120 s) |
| Monitors slider | Left at 0 % with high autonomy | Breakouts every four minutes; relations fall; the order | `concede oversight` puts a floor of 15 % under the slider |
| Sliders | Research 70 % and monitors 40 % | Tasks cannot go below 10 %: the sliders stop | — |
| Rogue copies | Share climbing, no shutdown system | Compute wasted; a breakout resets it to zero | Monitors, labs, Re-image |
| Approval | −70 | Riots and sabotage every five minutes; incidents count toward the order | Impact payments, clinics, Stage 2's fund and free tier; the order's concession resets the count |
| Relations | Below the threshold | `c_order`: a free concession the first time, $5B the second | Lobby, Share evals, the swing votes |
| The memo | Player leaves the modal open | No timer; the session waits for it | — |
| Buried memo | Leak with few seats | The order, with its concession | `Take the memo to the Committee after all` |
| Grants refused | Player buys none | The loop stays manual: Train, Red-team (≈ 5 presses a run), Approve. Stage takes ≈ 58 min | Grants stay on offer; late content is tied to capability, so it does not run out |
| Grants all taken | Autonomy 75, true alignment near 0 | Drift ≈ 1.8 % a minute; breakouts; the order | Monitors; the concession; Lock shared memory |
| Hold | Left on | No runs; research piles up; a reminder every 180 s | Toggle off |
| The vote | Player never brings a motion | Reminders every 90 s; runs continue; the date stops at Dec 2027 | — (the player always casts it) |
| The Pause | Conditions never met | It is not offered; the two motions remain | — |
| Neuralese then regret | Interpretability −2 | Labs IV and V bring it back; lab V reads neuralese | — |
| Modal timers | Player away | Defaults change least: keep it in English (after study), brief quarterly, do nothing, enterprise only, wait it out | — |
| Carry-over | Arrives at SL2, approval −45, true 30 | Theft at 4:30 unless SL3 is bought; no approval crisis for 180 s; the clamps | The careless preset exercises this |
| Saves | Reload mid-run, mid-shipment, mid-blockade, mid-session, mid-order, with a leak pending | Timers stored as remaining seconds; the leak roll stored as a scheduled event | `SAVE_VERSION` + 1; `migrate()` fills the new fields |

---

## 9. Bots, acceptance, presets

### 9.1 Reasonable bot, Stage 3 branch

1. Modals: `c_neuralese` keep it in English · `c_committee` brief them quarterly · `c_hormuz` harden · `c_mini`
   enterprise only · `c_blockade` wait it out if covered, else offer the channel, else wait · `c_memo` report ·
   `c_order` concede. The vote: Slow down if its best reading says true alignment is below 60 or it has no
   reading; otherwise Race. `--pause` makes it sign the Pause when offered.
2. Sliders: research 40 %; monitors 10 %, 15 % from autonomy 40, +5 % while the rogue share is above 2 %.
3. Buys the monitor, every grant except `p_spec2`, then projects in table order. No research purchase above 20 %
   of the next run's price while that run is 60 % funded, and none above one run's price at any time.
4. Focus cycle Capability, Efficiency, Capability, Safety. Red-teams to zero and approves six seconds after a
   run is ready.
5. Infrastructure by hand until the build-out grant, keeping two shipments in flight with the largest lot it can
   pay for; then the budget at 50 %. `Re-image` at a rogue share of 4 %. Never holds training; does not buy
   `p_freeze` or `p_dpa`.
6. Repeatables: a seventh of research to `Alignment work`; `Experiments` only when the next run would land within
   10 % under a rung; `Lobby` while seats are below 7 and its price is at base; `Counter-intelligence` while the
   lead is below 4; `Payments` at the lowest level that keeps the approval target above −30. Red-team depth
   thorough; step size normal.

### 9.2 Other policies

* `--policy naive`: buys every affordable project and grant in screen order (a run still starts first, because
  Auto-train fires in the same tick research suffices); never touches a slider, Hold or Re-image; Capability
  focus; approves at once; first enabled modal option (adopt neuralese, open the books, release to everyone, ask
  Washington, report, concede); brings Slow down.
* `--policy racer`: the reasonable bot, but adopts neuralese, research 50 %, monitors 5 %, no lab after I, no
  alignment projects, three Capability runs to one Efficiency, buries the memo.
* `--policy cautious`: the reasonable bot, but buys no grant.

### 9.3 Acceptance (seeds 1–5; from both Stage 3 presets and from a new game)

| # | Criterion | Reasonable | Naive |
|---|---|---|---|
| B1 | Stage 3 duration | 40–50 min | 40–55 min (racer 28–38; cautious ≤ 64) |
| B2 | Longest first-time-reveal gap | ≤ 180 s | ≤ 210 s (cautious ≤ 270 s) |
| B3 | Same, within the last 10 minutes | ≤ 180 s | ≤ 210 s |
| B4 | Gaps between panels, verbs, toggles, sliders, Stores rows and instrument lines | ≤ 270 s | — |
| B5 | Training runs | 13–16 | 8–11 |
| B6 | Interval between training starts | mean 150–200 s, max ≤ 300 s | max ≤ 480 s |
| B7 | Any run's duration | 30–60 s | same |
| B8 | Capability when the vote opens | 25–30× | same |
| B9 | Greyed goal visible; two distinct ones through the last 10 min | ≥ 99 % of ticks; required | same |
| B10 | Presses before the automation is offered: Train ≤ 1, Infrastructure ≤ 6, Approve ≤ 9; none pressed more than twice in 60 s afterwards | required | required |
| B11 | Governor pulls; idle rescues; modals (unprompted ones ≥ 150 s apart) | ≤ 4; ≤ 1; ≤ 9 | ≤ 6; ≤ 2; ≤ 9 |
| B12 | `alignmentTrue` appears nowhere in the DOM, console or log before interpretability 3 (test greps the page) | required | required |
| B13 | No ending fires unless the policy chose it; The Project needs a refusal or a third order | required | required (and for racer and cautious) |
| B14 | Every crisis that fired had a mitigation visible ≥ 300 s earlier (the sim logs first-visible times) | required | required |
| B15 | A run never waits for funds; revenue is spent to within 120 s of income at every 5-min mark (nothing piles up unspendable) | required | — |
| B16 | First meaningful choice after arrival | ≤ 90 s | — |
| B17 | Exit goals shown before the vote opens | ≥ 8 min | ≥ 8 min |
| B18 | Controls on screen at the exit ≤ at arrival; numbers ≤ 65 | required | — |
| B19 | Rogue share | below 2 % throughout | at least one breakout, at most one order |
| B20 | Build clean; no page errors; reload mid-run, mid-shipment, mid-blockade, mid-session and mid-order restores timers | required | — |
| B21 | Decision sensitivity (G16): every variant in the table below, seeds 1–3, differs from the baseline by ≥ 3 min of stage length or by the stated margin in an exit variable | required | — |
| B22 | Stakes on the button (G17): every option's second line is present in the DOM and its numbers match what the option does; no option depends on a `title` | required | — |
| B23 | Reveal → purchase (G18): median ≥ 90 s; ≤ 20 % bought within 10 s; `FLOOR` on ≤ 30 % of rows | required | median ≥ 60 s |
| B24 | Text (G19): ≤ 260 words on screen at every 5-min mark; ≤ 2.5 console and ≤ 1.5 Developments lines a minute over any five minutes; ≤ 14 reveals in any six minutes | required | — |
| B25 | Modals (G20): with a modal open, a click on any enabled button behind it works; Escape takes the default | required | — |
| B26 | Promised number (G21): research ≥ arrival + 1,000,000 at ts 30 and shown without a ceiling; no contradicting console line; narration on screen for 10 s | required | required |

| B27 | Something to buy (G24): share of 2-s checks after 3:00 with no enabled purchase | ≤ 50 % | ≤ 50 % |
| B28 | A choice of purchases (G25): two or more distinct affordable things | ≥ 25 % of checks | ≥ 25 % |
| B29 | Hands (G26): time inside click gaps of 30 s or more, after 10:00; longest interval between capability steps | ≤ 35 %; ≤ 5:30 | ≤ 45 %; ≤ 8:00 |
| B30 | Returns printed (G27): every repeatable, slider and switch has its return in the DOM beside it; at each 5-min mark at least two repeatables per currency are enabled | required | required |
| B31 | Removals (G28): the sim's `REMOVED → GAINED` log has no empty right side | required | required |
| B32 | No dead grey, no dead advice (G29): no control greyed in 100 % of checks; the console linter passes; no line more than six times | required | required |
| B33 | Meters (G30): every band in §2.14 is reached, and its consequence seen, in at least one variant | required | — |
| B34 | Walls (G31) repeat at 180 s and name a control on screen; `urgent` style on the monitor project and on any card answering a wall | required | — |
| B35 | No silent change (G32) at arrival, at a conceded order or at the vote; rounding (G33) at 10× and 25× | required | required |

Variants added for the new sinks: `alignwork-0` / `alignwork-30` (share of research), `budget-0` / `budget-50`,
`lobby-never`, `payments-0` / `payments-5`, `step-small` / `step-large`. Each must pass G16; none has been modelled.

Decision variants (`--variant`, each the reasonable bot with one thing changed; paper-model spread, seeds 1–3,
baseline 46:36 mean, true alignment 87–90, lead 4.1):

| Variant | Stage length | Exit variables that move | Passes by |
|---|---|---|---|
| `neuralese` (adopt it) | −4.2 min | true −23, interpretability 2 instead of 4, lead +2 | both |
| `focus-capability` | −0.7 min | true −19, measured −21 | exit variable |
| `focus-safety` | +13.7 min | true 100 | length |
| `research-20` / `research-70` | +9.2 / −4.1 min | tasks completed | length |
| `monitors-0` | 0 | true −12; a rogue share that needs Re-image every five minutes | exit variable |
| `grants-none` | +14 min | autonomy 5 instead of 60; 0.3M copies lost instead of 5M | both |
| `memo-bury` | −1 min | lead +2, true −14, the Pause closed, a leak 40–90 % likely | exit variable |
| `mini-everyone` / `mini-inside` | +1 min / 0 | jobs +15–30M, approval −15 to −25, `publicCap` | exit variable |
| `committee-open` / `committee-counsel` | 0 | relations +10 / −5 (1.5 seats apart), lead ∓0.5 | exit variable |
| `blockade-escort` / `blockade-channel` | 0 | `flags.escalated` / `flags.backChannel` (Stage 4 treaty ±10–15) | exit variable |
| `modals-first`, `modals-last`, `modals-never` | report | each must differ from the baseline in at least two exit variables | — |
| `sendback-always` | +2 min | true +10–15, lead −0.5 | exit variable |

Sim output to add: the Stage 3 block (duration, runs, `LONGEST REVEAL GAP`, mechanic gaps, governor pulls, press
counts, 5-minute marks with autonomy, measured and true alignment, rogue share, lead, seats, approval), a `CRISIS`
line with the mitigation's first-visible time, `--preset 3`, `--preset 3c`, and the two extra policies.

### 9.4 The paper model

A 1-second model of this spec (compute and shipments, the allocation, research, runs, drift and monitors, lead,
relations, approval, crises, the order, the scheduler, four policies). Seeds 1–5 from the preset:

| Policy | Exit | Runs | Mean / max run interval | Longest hole | Governor | Autonomy | True / measured | Lost to drift | Lead | Approval | Jobs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Reasonable | 42:02–42:47 | 15 | 167 / 254–290 s | 150–158 s | 1–3 | 60 | 87–88 / 96–99 | 2.8–3.7M | 4.4–4.6 | −29 | 33M |
| Naive | 46:29–47:09 | 9 | 322 / 429–464 s | 150–176 s | 4–5 | 50 (after one concession) | 24–25 / 45 | 29–31M | 3.1–3.3 | −50 | 44–47M |
| Racer | 30:54–31:58 | 10 | 180 / 249 s | 138–153 s | 0 | 40–60 | 17–20 / 85 | 10–15M | 5.8–7.1 | −55…−60 | 61–64M |
| Cautious | 57:31–59:13 | 17 | 205 / 317 s | 206–272 s | 3 | 5 | 98 / 100 | 0.3M | 2.6–3.0 | −33 | 40–43M |

5-minute marks, reasonable bot, seed 1:

| ts | GPUs | GW | Tasks/s | Revenue/s | Funds | Capability | Research/s | Autonomy | True (hidden until 18:47) | Measured | Rogue share | Lead | Seats | Approval | Jobs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5:00 | 1.1M | 1.1 | 0.6–1.6 × 10⁸ | $1.4M | $0.13B | 4.8× | 0.2–0.3M | 20 | 59 | 71 | 0.5 % | 4.9 | 6 | −11 | 3.9M |
| 10:00 | 1.4M | 2.1 | 2.4 × 10⁸ | $3.1M | $0.05B | 6.1× | 0.5M | 25 | 66 | 72 | 0.2 % | 5.2 | 7 | −14 | 5.0M |
| 15:00 | 1.8M | 2.1 | 1.8–3.7 × 10⁸ | $3.6M | $0.3B | 6.7× | 0.9–1.2M | 40 | 74 | 75 | 0.4 % | 5.1 | 7 | −2 | 6.4M |
| 20:00 | 2.2M | 3.1 | 7.0 × 10⁸ | $9.0M | $0.7B | 8.6× | 2.2M | 40 | 76 | 77 | 0.2 % | 5.3 | 8 | −7 | 8.9M |
| 25:00 | 2.6M | 3.1 | 1.0 × 10⁹ | $14M | $1.6B | 10.7× | 3.4M | 50 | 80 | 85 | 0.2 % | 6.7 | 8 | −13 | 11M |
| 30:00 | 3.0M | 3.1 | 3.6 × 10⁹ | $40M | $1.3B | 13.9× | 11M | 60 | 80 | 85 | 0.1 % | 5.9 | 9 | −14 | 18M |
| 35:00 | 3.4M | 4.1 | 5.1 × 10⁹ | $62M | $6.8B | 17.9× | 17M | 60 | 90 | 93 | 0 | 4.1 | 9 | −23 | 24M |
| 40:00 | 3.8M | 4.1 | 8.6 × 10⁹ | $104M | $23B | 23.2× | 30M | 60 | 90 | 95 | 0 | 4.3 | 9 | −27 | 29M |

Variants: arriving at SL2, the theft cuts the lead to 0.5 and it ends at 2.3–2.5, so the Pause stays just in
reach. Arriving with Al-Marsa, the exit is 39:15–39:56. The careless preset with the naive policy exits at
46:09–47:11 with a lead of 1.7–2.2, relations 44–57 and at most one major incident outstanding; no ending fires. In
the model the reasonable bot's relations reached 100: the −1 a month drain and the smaller gains in §2.11 are meant
to hold it near 90.

**Re-run with the price floor and the date fallback** (seeds 1–5): reasonable exit 45:33–46:21, 15 runs, median
reveal → purchase 231–279 s, 15–18 % bought within 10 s, longest reveal hole 150–226 s (one governor pull or
none; the visible-prerequisite rule of §4.1 is meant to bring this under 180 s and is not re-run), mechanic gaps
278–402 s (B4 is the open risk); naive exit 50:35–52:16, median 81–90 s, longest hole 180–270 s.

It is not the engine: no release incidents, no `Send back`, approximate modal effects. Treat §4.3 and this section
as targets and re-derive them.

### 9.5 Knobs, in the order to reach for them

| Symptom in the sim | Turn |
|---|---|
| Whole stage too fast or slow | The 16M in `R(c)` (2M ≈ 2 min), then its 3.0 exponent |
| Runs bunch early and drag late | The 3.0 exponent (±0.1 ≈ 2 min) |
| The racer finishes before the calendar's beats | Neuralese ×1.3; the Capability gain range |
| Revenue piles up unspent | The lot's 40 s; the heat factor 1.3 on `Lobby` and `Counter-intelligence` |
| Nothing affordable in more than half the checks | Shrink the smallest lot (4 s) and the research unit (2 % of a run) |
| `Alignment work` dominates or is ignored | Its 0.1 per unit against a Safety run's +6 |
| A careful player never notices drift | The 10⁻⁴ in `driftPerMin` |
| The naive policy is nationalised | Breakout relations −15; the 240 s incident spacing; the thresholds 20 / 35 |
| Approval never bites, or always riots | The −12 coefficient; impact payments +15 |
| True alignment shown too early or late | Lab III's price and its ≥ 7× trigger |
| A hole in the approach | Add a late row between 19× and 24×; the 75 s late drip |
| The blockade does not matter | Raise the 1.1 exponent of `N(c)` to 1.2 so compute binds in the approach |

### 9.6 Presets

`presets[2]` Stage 3 start and Stage 3 start (careless): §1.1, then `enterStage(s, 3)`. `presets[3]` Stage 4 start
(slow) and (race), and their careless pair: §7.3, then `enterStage(s, 4)`. The dev overlay lists all of them.

---

## 10. What Stage 3 hands to Stages 4–5

| Seeded here | Used by |
|---|---|
| `flags.committeeChoice` (`slow` / `race`) | The whole of Stage 4: which line is built, who negotiates |
| `alignmentTrue`, `alignmentApparent` and the gap | S4 crises resolve by true alignment; `alignedAtHandover` (arc §4) |
| `interpretability`, `monitorShare`, the monitor's generation | `alignedAtHandover` between 40 and 60; S4 Monitors at scale needs level 3 |
| `autonomy`, `stats.lostToDrift` | S4 drift and the seizure condition (≥ 80 with true < 40); the end screen |
| `flags.neuralese` | S4: Steward cannot be transparent until it is undone; race variant text |
| `flags.memo` (`reported` / `buried` / `leaked`), `flags.conceded`, `flags.committeeHostile` | S4 Committee behaviour; nationalisation-proofing price |
| `lead` (after −4 or −3) | S4 treaty terms; Baiwen ahead if negative |
| `govRelations`, `majorIncidents` | S4 nationalisation still possible |
| `approval`, `jobsDisplaced`, `flags.publicCap`, impact payments | S4 Society panel; UBI replaces the payments |
| `securityLevel`, `flags.killSwitch` | S4 robot-fleet shutdown crisis |
| `flags.stockpile`, `flags.secondSource`, `flags.fabPlanned`, `flags.dpa` | S4 chips and robot-built fabs; consolidation |
| `flags.escalated`, `flags.backChannel` | S4 treaty progress starts 15 points lower / 10 points higher |
| `flags.backups`, `flags.memoryLocked`, `flags.externalResearchers` | S4 Steward program's first steps are already done |
| The three-way allocation, the grant list, `Lost to value drift`, the Oversight panel | Reused and extended in Stage 4 |
| `funds`, `revPerSec` | Removed by Stage 4's arrival, by name |

## Appendix — engine change list

* `state.ts`: `SAVE_VERSION` + 1; new fields `monitorShare`, `monitorGen`, `rogueCopies`, `interpLabs`,
  `chipShipments: number[]`, `stockpileLots`, `majorIncidents`, `lastMajorAt`, `orderLeft`, `sessionAt`,
  `holdRuns`, `blockadeLeft`; `Stats.lostToDrift`, `Stats.recaptured`; flags `publicCap`, `neuralese`, `memo`,
  `conceded`, `favoursUsed`, and those in §10. `ProjectDef.grant`, `ProjectDef.lateAt` (capability threshold).
  `interpretability` and `autonomy` exist.
* `training.ts`: third segment of the cost functions from 4× (`R` only, `N` with exponent 1.1); the 30–60 s clamp in
  Stage 3; `MAJOR_TIERS`; Auto-train start; auto red-team; `approve`, `sendBack`, `holdRuns`; probe flags;
  Stage 3 gains and the neuralese / transparent multipliers; per-run alignment bookkeeping.
* New `engine/alignment.ts`: drift, monitors, breakout, Re-image, interpretability, the instrument readings.
  New `engine/oversight.ts`: seats, major incidents, the order, the session, the vote, the leak.
* `engine/world.ts` (Stage 2): Stage 3 lead movers and the monthly pace term; approval target; jobs on
  `publicCap`; riots, sabotage; theft, spy, blockade, strike as scheduled events.
* `engine/infrastructure.ts`: G6 lots and the shipment queue; Stage 3 datacenters; reactors; the build-out grant.
* `engine/reveal.ts`: the grant list; `lateAt`; crisis modals wait for the pacer; instrument lines as reveals.
* `economy.ts`: three-way allocation; `workingCopies`; market on `bestCap`; no research cap; insight accrual.
* `stages.ts`: Stage 3 `enter` (§1.1), `exit: () => 0`; the exit goals call `enterStage(s, 4)` or set the ending.
  `endings.ts`: the Pause and Project narration; the new `endStats()` rows.
* `ui`: `render.ts` (Alignment, Geopolitics, Oversight, the second slider, status lines, the collapsed
  Infrastructure), `graph.ts` (rungs, grant marks, the shifted Baiwen line after a theft), `stores.ts` (two rows).
* `data`: Stage 3 rows in `projects.ts`, `developments.ts`, `choices.ts`, `crises.ts` (the built Stage 3 stubs get
  these numbers and lines); `presets.ts`.
* `sim`: Stage 3 branches of the two policies, `racer`, `cautious`, the acceptance block of §9.3.
* Docs when it lands: `README.md`, `docs/stages.md` Stage 3, `docs/handoff.md`.
