# Stage 1, round 3: fixes

Source: `docs/critic-stage1-round3.md` (Takeoff 8.0, Paperclips 7.7). For the engineer, after the Stage 3 build.
**Untouched:** the opening to 3:32, the blocked-Train sentences and the gate walk, the wall line and the `— needed`
card, stakes on event buttons, the transition, the meters. **Not here:** the bugs already sent (the power meter's
scale, events on an idle lab, the deposit, the wall-price inversion, the price ceiling, the hire-only advice,
mispriced Trust cards). Times marked "paper" are estimates from the built traces; the sim decides.

**Amended by `stage2-round2-fixes.md` §1 (the wallet rule, arc G34).** The `the run first` hold this file first
proposed is withdrawn: nothing is held back for the player. Purchases that delay a waiting run print the delay,
and Train can be armed. §1 below is the amended text.

## 1. A run costs money and needs GPUs (the biggest gap)

**Decision.** Research leaves the run's price in Stage 1. A run is paid for in dollars and needs its GPUs.
Research buys cards and nothing else. This is the critic's second fix, with the stakes of every other dollar
purchase printed and a Train that can be armed.

**Why not a reserved queue.** Reserving research for a queued run keeps a wait on the Train row that no button
on screen shortens (`research — about 1:10`) and puts a delay figure on every research card for the whole stage.
The owner asked for a requirement stated plainly that blocks, and for less on screen. With research out, the row
is a price and a GPU count, both moved by buttons the player already has, and money has something to buy in the
second half. Arming (below) reserves nothing, and delay figures appear on dollar rows only while a run waits. **Why no hold.** Stage 2's built hold greys its lot rows for more than half
the stage; here it would grey Marketing and Rent GPU between every pair of runs. Stage 1's dollar sinks climb in
price, so they limit themselves: each stays lit and says what it costs the run.

| | Rule |
|---|---|
| Price | `trainCost` in Stage 1 is dollars only: `$290 × c^11.5`, two significant figures. Capability runs: **$290 / $1,100 / $3,800 / $14,000 / $52,000** at 1.00 / 1.12 / 1.25 / 1.40 / 1.57× (built: $288 / $844 / $2,390 / $7,030 / $20,900 and 2,000–19,000 research) |
| GPUs | Unchanged: 10 / 15 / 30 / 45 / 80, then the wall. `Distributed training` as built |
| Other dollar purchases | Stay lit. While the next run (or, at the wall, First Datacenter) waits for money, Marketing, Rent GPU and dollar cards print the delay they would cause when it is 10 s or more: `Sage-1.4 0:55 later` |
| Arming | Train is disabled only by its GPUs. Pressed while money is short it is armed and starts by itself; pressed again it stands down. Nothing is reserved |
| Research is for | The Projects list: what a copy can do, what the cloud will rent (the three lease cards), what the business earns (the API, pricing, contracts), what the lab no longer does by hand (Grid Contract, Dynamic pricing), and the pipeline itself |
| The lab's size | Limits cards only. `atPlateau` and `needs 11,000 research; the lab holds 8,000` never apply to a Stage 1 run; `researchWanted` ignores the run; `Lease the floor upstairs` and `Rent desks` key on a card that costs more than the lab holds |
| Stage 2 | Its price is unchanged (research, dollars, data, GPUs). Research is new to the Train row there, so one console line 30 s after the arrival narration (its five lines are full): `Runs this size need research as well as money: 34,000 for Sage-1.6.` The arrival's research gift stays. From 1.6× the Stage 1 row quotes the Stage 2 dollar price ($150,000 at 1.76×), so the figure does not move when the datacenter opens |
| Stage 3 | Unchanged. Its arrival line (`A run is a research program`) now completes the sequence: money, then money and research, then research |

**The Train row.**

| State | Reads |
|---|---|
| Ready | `Train Sage-1.4` · `Cost: $14,000` · `Needs 45 GPUs for 1:06` |
| Short of money | The same, lit, with the built wait: `money — about 1:20`. Pressed: `Sage-1.4 starts when paid for — about 1:20` |
| Short of GPUs, at the quota, the wall, training | As built: the only states in which Train is disabled |

No research line appears on it in Stage 1.

**Runs, on paper** (a player who declines purchases that print a delay of 0:30 or more; one who buys everything
lit reaches the fifth run about three to five minutes later):

| Run | From | Needs | Costs | Starts about | Paid by |
|---|---|---|---|---|---|
| 1 | 1.00× | 10 GPUs | $290 | 6:15 (built 7:44) | the Seed round |
| 2 | 1.12× | 15 | $1,100 | 8:15 | a minute of income |
| 3 | 1.25× | 30 | $3,800 | 11:15 | a minute and a half |
| 4 | 1.40× | 45 | $14,000 | 14:45 (built 22:28–26:14) | the Series A, or two minutes |
| 5 | 1.57× | 80: all of a base quota | $52,000 | 18:45 | two to three minutes |
| The wall | 1.76× | 1,200 | — | 20:15 | — |
| First Datacenter | | | the wall price | by 24:15 | at most four minutes |

**The engineer changes** `trainCost`, `fundsFor`, `trainWait` and `runOtherwiseReady` for Stage 1; the armed
state of Train; the delay line on Rent GPU, Marketing and dollar cards; the plateau helpers above; the Stage 2
line; the sim's Stage 1 policies (no research reserve; `Train blocked` reported by cause). Knob: the 11.5 (±0.5 moves the fifth
run by about a minute); then the Series A's $20,000.

**Acceptance** (`explore-s1r3.mjs`, seeds 1–5; the sim for the built policies). Research blocks Train for 0 s
(was 614–996). Train is disabled, with nothing training, for no more than 60 s a stage before the wall (was
822–1,132). For `train-priority` and for a first-timer that declines printed delays of 0:30 or more: at least five
runs, starts no more than 5:00 apart. For the first-timer that buys everything lit: five runs, starts no more than
8:00 apart, and every purchase that delayed an armed run by 10 s or more had the delay on its row. The wall
sentence on screen for at least 20 s before the purchase in every seed (was one seed of five, for 2 s). Wall to
purchase ≤ 4:00. `contracts: never` no faster than the control (was 1:18 faster). Stage 1 in 21–27 minutes for
the first-timer and not under 19:30 for the bot.

## 2. First Datacenter: a sense of approach, and money's second half

**Decision.** The card appears at the third release, says how near the cloud is to full and what the price is in
income, and fills a meter once it is needed. Money's sinks from minute 12 are the runs themselves, the GPUs the fifth needs,
and a Marketing button that stays in reach. No rungs.

| | Rule |
|---|---|
| Appears | Pinned and grey when the next run needs 45 GPUs or more: the third release on the Capability path (paper 12:45), or November 2025 (16:00). Was: Series A, the second release or October (10:44–12:02, grey for 56–62 % of the stage). Still at least eight minutes before it is bought |
| Until the wall | Under the built title and sentence, two short lines: `Cloud GPUs the next model needs ｢￭￭￭￭￭￭････｣ 45 of 80` (cells: need ÷ what the cloud rents; full at the fifth run) and `Price: 71 minutes of income.` (price ÷ revenue a second; minutes from ten up, `m:ss` below). When the run after next will not fit: `The one after will not fit.` |
| Once needed | The second line becomes the money meter: `｢￭￭￭･･･････｣ $87,000 short — about 2:25` |
| Marketing | Costs `$100 × 2^(levels bought)`. Levels given by rounds and events raise the level, not the price (it was $12,800–$204,800 and grey for 13–23 minutes) |

| Money's sink, 12:00 to the wall | Price | What it pushes |
|---|---|---|
| Runs 4 and 5 | $14,000, $52,000 | Capability, so revenue: the card's minutes fall at each release (about 71 → 21 → 9 → 3) |
| Rent GPU, to the quota | the built curve | The fifth run needs 80; the Train row asks for them |
| Marketing | $12,800, $25,600, … | Demand ×1.1 a level |

**Changes:** the card's trigger and two status lines (`meter()` exists), `marketingCost` on a count of bought
levels. **Acceptance:** the card is on screen for at most half the stage and at least 8:00 before its purchase
(G11); the minutes-of-income figure is lower after every release; between the card appearing and the wall the
first-timer makes a dollar purchase other than power in every three-minute window, runs included (was 3–6 in
15–19 minutes);
Marketing is never grey for more than 3:00.

## 3. Minutes 3–7 and the first training cycle, one beat at a time

**Decision.** After the opening, cards follow the player instead of the clock, the Grid Contract fits the first
lab, Expand Lab arrives with the Trust that pays for it, and the first run's results are not shared with an event.

| Beat | Trigger (paper) | Teaches | Appears | Line |
|---|---|---|---|---|
| 9 | Research + 40 s (3:12), built | Research buys projects | `panel-projects` with `Better Prompting` (750) | `Research buys projects.` |
| 10 | 3:32, built | — | Developments and the date | built |
| card | 10 s after the card before it is bought | Power can buy itself | `Grid Contract`, **1,000 research** (was 2,000): bought by about 4:15 | built |
| 11 | The first Trust awarded at least 40 s after beat 9 with the lab full (4:00, at 5,000 tasks) | Trust has two uses | `btn-expandLab` beside Hire, in the tick of the award | `Trust +1. Hire a researcher, or expand the lab: it is full at 1,000.` |
| card | as above | A full lab is not wasted | `Blue-sky Research` (1,000), then Insight | built |
| card | 7,000 tasks (4:50) | Some cards need a bigger lab | `Training Pipeline` (2,000); on a 1,000 lab its reason reads `needs a lab that holds 2,000 — Expand Lab` | built |
| 12 | The pipeline bought (5:30) | A run costs money and needs GPUs | The Training panel: `Train Sage-1.1` · `Cost: $290` · `Needs 10 GPUs for 0:45` | built |

Rules: (a) once shown, the Projects panel is never empty for more than 10 s while a card's trigger has fired:
the next card comes 10 s after the last one on screen is bought, and the 60 s drip only spaces cards that would
overlap; the heading is not drawn without a card; (b) Expand Lab is never shown while Trust is 0; later awards
print the built `Trust +1. Hire a researcher or expand the lab.`; (c) before the Training panel the cards come in
the order above; `Chain-of-thought` (2,500) and the rest follow the pipeline.

**The first training cycle** (built: six new things at 8:28–8:50):

| Order | What | Rule |
|---|---|---|
| 1 | Evaluation, then Red-team and Release | As built. One flavour line a run in the console; the rest go to Developments |
| 2 | The Focus row | With the second run's Train row, 30 s after the first release: `Focus chooses what the next model is trained for.` |
| 3 | The first event | 60 s after the first release at the earliest. No event opens while an evaluation, a Red-team or a Release is waiting, in any run |
| 4 | The quota line and its meter | At 60 rented GPUs, but held from Train to 30 s after that run's release |

**Acceptance:** between beat 9 and the Training panel research sits at the cap for at most 60 s (was 168–174);
the Projects panel is empty for at most 15 s (was 104); Buy Power presses ≤ 6 (was 14); the first run starts by
6:45; numbers on screen at 5:00 still ≤ 22; from the first Train to 60 s after the first release no two
first-time mechanics within 30 s (was six in 22 s) and at most four console lines in any 26 s (was eight).

## 4. Four short rules

**Cards are goals, not a conveyor.** A card whose price is already in hand when its trigger fires waits until a
purchase takes the balance below it, for at most 60 s; then it appears lit. Dollar side-cards (`Closed-loop
cooling`, `Build a sound wall`, `Hire a recruiter`, `Lease the floor upstairs`) cost the larger of their list
price and 120 s of revenue (`revealFunds: 120`). The Stage 1 governor may exceed the four-card cap by one, so the
stream cannot stall behind four cards nobody is buying. *Acceptance:* at most a quarter of cards bought within
10 s of appearing (was 11–14 of 25–30); a median of 90 s on screen (was 56–82); no first-time gap over 180 s in
the last ten minutes (was 176–248).

**Events wait for the player.** The bug fix already sent stops events on an idle lab; this is the rule behind it.
The calendar is a queue. The first event opens 60 s after the first release; each later one 2:36 after the last
was answered, never while an evaluation, a Red-team or a Release is waiting. An event whose precondition fails
gives its slot to the next and comes back.

| Event | Opens only when |
|---|---|
| A Bridge Round | revenue is at least $10 a second and the Series A has not come |
| Open Weights | a model is released and the price is above $0.10 |
| A Reporter Calls | a model is released |
| An Open Letter | five researchers |
| A Better Offer | three researchers; the sentence about contract models only with a contract signed |
| The Leaderboard Wants Sage | two releases |

*Acceptance:* the three idle probes (`s1r3x-idle-*`) open no event; no event text names something the player
does not have.

**Focus shows all three trades.** Under the buttons, as in Stage 2: `+10–14% capability` · `+5%, copies per GPU
×1.25` · `+5%, fewer issues for good`. During a run the row is headed `Next run:` and a click changes the next
run only. *Acceptance:* three trade lines in the DOM from the row's first appearance; no tooltip needed.

**The top option is the one that does nothing.** Options are listed with the timer's default first and the ones
that cost something after it, cheapest first. In four of the six events the default is the weaker answer, so
position no longer tells. *Acceptance:* `first option always` ends at least 2:00 after `best-looking` (they tied,
29:08 and 29:15); `never answers` and `first option always` end together.

## 5. The greyed goal

Left as it is. The critic's 86–94 s without a goal are all before 2:02 and each had an affordable Rent GPU or Buy
Power on screen. The amended G3 counts from the first purchase and, in the first three minutes, counts the next
unit of the newest mechanic lit or grey, so those seconds are covered. The harness should count the same way.

## 6. Consequences, and where this meets the owner's notes

| File | Change |
|---|---|
| `arc.md` | Amendment list; Stage 1's bottleneck row ends `… → research cap (cards) → money for the next run → GPUs (First Datacenter)` |
| `stage2.md` | Amendment row: research is new to the Train row at arrival (the line in §1); the preset is rebuilt from the retuned Stage 1 (about 1.7–1.85×, more research in hand, 80–140 rented GPUs returned) |
| `stage3.md` | None |
| `user-feedback-1.md` | B1's "research and funds prices do not move" and B2's trigger for the card are superseded here |

| Owner's note | Where a fix pulls against it | Resolved |
|---|---|---|
| The card visible at least eight minutes early | The critic wanted it one run before the wall | It appears at the third release, nine to eleven minutes early on paper, and says how near the wall is instead of arriving late |
| One mechanic a beat; the opening as it is | The critic wanted Expand Lab at 3:00, seven seconds from the Projects panel | Expand Lab at the next Trust award, about 4:00; nothing before 3:32 moves |
| Meters are for capacity | The critic wanted a money meter on the card for the whole stage | The card's meter is the cloud's GPUs until the wall; money only once the price is final and four minutes away |
| Nothing on screen the player cannot act on | A hold would grey Marketing and Rent GPU between runs | Withdrawn (`stage2-round2-fixes.md` §1): rows stay lit and print their delay; Train can be armed |
| Stage 1 in 20–26 minutes, five rented runs | The critic's band was 22–30 | Five runs for every seed; 21–27 minutes for a first-timer, with the 11.5 as the knob |
