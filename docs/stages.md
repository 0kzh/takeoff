# Stages

*Written in the format of the Universal Paperclips wiki's [Stages](https://universalpaperclips.fandom.com/wiki/Stages) page. This is the plan the implementation follows; numbers are targets to be validated with the headless simulator (`npm run sim`).*

The gameplay of **Takeoff** takes place over five **stages**. The stages limit which projects can be launched, and each has a distinct play style. The first stage is roughly analogous to running a small API business. The second is a datacenter and power-management game. The third is a race with a hidden variable. The fourth is a negotiation you may or may not be part of. The fifth is space.

The player is never told which stage they are in and is never told how many there are.

## Summary

| Stage | Name | In-game dates | Target wall clock | Analogy | Exit condition |
|---|---|---|---|---|---|
| 1 | The Startup | Jul 2025 → Dec 2025 | 20–30 min | UP Stage 1 (manufacturing + business), opened like A Dark Room | **First Datacenter** at Abilene (1,000 GPUs of OpenMind's own) |
| 2 | Scale | Jan 2026 → Dec 2026 | 35–45 min | UP Stage 2 (power management) + GDS loop | Reach **superhuman coder** (capability ≥ 4×) |
| 3 | Takeoff | Jan 2027 → Oct 2027 | 40–50 min | The AI-2027 "race" chapters | Reach **superhuman AI researcher** (≥ 25×) **and** make the Committee choice |
| 4 | Superintelligence | Nov 2027 → Dec 2028 | 30–40 min | AI-2027 branch chapters | Treaty signed, or autonomy granted, or nationalized |
| 5 | Beyond | 2029 → 2030+ | 20–30 min | UP Stage 3 (space), compressed | Ending |

Total: ~2.5–3.5 hours for a reasonable player; 4 hours for a cautious one.

---

## Stage 1 — The Startup

The first stage is by far the simplest. OpenMind has a model, a cloud bill, and no customers. You complete tasks by hand, rent **GPUs** so that copies of the model complete tasks without you clicking, keep their **Power** (kWh) topped up, and price the tasks against the market. Then you hire **Researchers**, who turn **Trust** into **Research** points, which buy the projects that lay the technical backbone of the later stages, and you run your first **training runs**. Every run needs a number of GPUs; the cloud rents 80 (140 with three lease cards), and when the next model needs more than that, only **First Datacenter** — 1,000 GPUs of OpenMind's own at Abilene — trains it. If you run out of money with no power, the game lets you **Ask the cloud provider for credit** in exchange for Trust rather than losing the game, and the **Complete Task** button never needs power.

*As built after owner feedback 1 (`docs/specs/user-feedback-1.md`; it overrides the critic-driven design where they conflict). Seeds 1–5, `npm run sim`: the reasonable bot buys First Datacenter at **23:29–24:59**, the first-timer at 25:19–27:56, the greedy player at 24:01–29:37, the train-first player at 24:28–27:56; the critic harness's first-timer at **26:36** (seed 1). Capability at the hand-over 1.51–1.80×; no reveal gap over 176 s; Train never waits for GPUs alone longer than 2:06; six or seven modals, never two within 152 s.*

*As built after critic round 3 (`docs/specs/stage1-round3-fixes.md`, with the wallet rule of `stage2-round2-fixes.md` §1). A run costs dollars and needs GPUs; research buys cards only. `$290 × c^13`, two figures: $290 / $1,300 / $5,300 / $23,000 / $100,000; from 1.6× a run is priced as Stage 2 prices it, and the rented GPU curve runs to 1.68× (85–105 GPUs), so every seed trains five models before the wall. Train is disabled only by its requirements; pressed short of money it arms (`Sage-1.4 starts when paid for — about 1:20`). While a run (at the wall, First Datacenter) waits for money, Marketing, Rent GPU and dollar cards print the delay they cause (`· Sage-1.4 0:55 later`). Marketing costs `$100 × 2^(levels bought)`. First Datacenter appears when the next model needs 45 GPUs, at the third release or from mid-October, with `Cloud GPUs the next model needs ｢…｣ 45 of 80` and `Price: 21 minutes of income.` (at the wall the money meter, `$87,000 short — about 2:25`); it costs 200 s of the best revenue ($100,000–$450,000). The Series A pays $5,000. The six events are a queue: the first a minute after the first release, each later one 2:36 after the last was answered, never while a run waits for evaluation, Red-team or Release; options list the timer's default first. Seeds 1–5: the bot buys First Datacenter at **20:15–21:41**, the first-timer at 22:49–23:59, the greedy player at 27:15–27:35, the train-first player at 22:14–24:00; first run by 5:41–6:06; research never blocks Train.*

* *One mechanic at a time.* The game opens with one button and one number and adds one thing a beat, each announced by a console line; beats 4–8 come in order and at least 30 s apart. A steady player (two clicks a second, a GPU when one is affordable) sees 1 / 5 / 6 / 10 / 16 / 18 numbers and 1 / 2 / 3 / 5 / 7 / 7 controls at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00 (the browser smoke test). Every click pays $0.25 at once, so the first GPU ($6) comes at 0:16 at one and a half clicks a second, 0:12 at two, 0:06 at four. The market starts at its full size (`MARKET_START` 3): every task sells until about the ninth GPU, and the backlog that forms then is the lesson.
* *A run needs its GPUs.* No yield, no `Train now`: without the GPUs the Train button is grey and the row says what fixes it; with them the run keeps its whole gain. The run's GPUs serve no customers until it is done.
* *Meters.* `｢￭￭￭￭￭￭￭･･･｣`, ten cells, the halfwidth glyphs keeping one width at every fill in the page's proportional font (a boot check falls back to `[■■■□□]` in monospace). A meter replaces the `/ cap` half of a pair: Power (scale: the block Buy Power sells), `GPUs rented ｢…｣ 61` from 60 rented (hover: the cloud rents 80), the research store, and the Train row when it is short.
* *One datacenter.* The Abilene ladder (site, interconnect queue, substation, expedite, contractor, the Abilene panel) is gone. Months are 240 s (July to December is 24:00), so every date-keyed card keeps its month and the six calendar modals come about 2:35 apart.
* *Contracts are customers.* Each **Custom model contract** (repeatable, double border) adds 25 % to demand at whatever price you set (×1.15 per contract); an incident pauses every contract customer for 1:30 (stacking) and costs 1 Trust; a release earns +1 Trust only with no open issues. Stage 2 freezes the contracts' share of sales as a fixed rate.
* *Decisions show their stakes.* Every modal option has a second line with its effect and cost, sized when the modal opens (a bridge worth a twentieth of First Datacenter, a poach match worth a minute of revenue), and every modal has a timer with a harmless default. The selected **Focus** prints its trade under the buttons.
* *Price.* Steps are a cent below $0.20 and 5 % above. **Dynamic pricing** (AUTO) is a card offered after 20 price moves once tasks pass 90,000, or to anyone at 400,000 tasks.
* *Pacing.* Cards come one a minute until the Training panel, then every 30 s, four on screen (a card that has waited 140 s comes out anyway); a card never lands within 4 s of a modal opening, nor a modal within 4 s of anything new. Mid and late research cards cost at least 100 s of the research rate, side offers 45–100 s of revenue, fixed when they appear.
* *Dead ends.* The research wall is re-said every 2 minutes while it lasts; the idle guard names an under-staffed lab before offering money; a prepayment buys the cheapest thing on screen; at most three press releases and three emails a stage. When Train is grey its reason names the resource and the time (`research — about 0:45`), and the GPU line what fixes a shortfall.
* *Trust pace.* The next Trust milestone is never more than 2:30 of tasks away in Stage 1.

### What is on screen

*Minute 0:* the black console (`Welcome to OpenMind. Customers are waiting.`), `Tasks Completed: 0` and one button, **Complete Task**. No power, no funds, no date.

*Reveal order (triggers, not timers). Typical minute as `bot / naive` (median of seeds 1–5, `npm run sim`):*

1. **Business** at the first click [0:00] — `Available Funds: $ 0.25` alone (`Task complete. The customer pays $0.25.`).
2. **Compute** at $3 [0:03] — **Rent GPU** greyed with `Cost: $ 6.00` (UP's `5 + 1.1^n`): the first greyed goal (`GPUs can be rented. Each one runs a copy of Sage.`).
3. The first GPU [0:06] — `GPUs rented: 1` (`GPU rented. A copy of Sage completes a task every second.`).
4. **Power** at the third GPU or 20 s after the first [0:26] — `Power ｢￭￭￭￭￭￭￭￭￭￭｣ 968 kWh`, draining one cell per 100 kWh (`Each task a copy completes burns 1 kWh. The meter drains.`); Rent GPU adds `each copy burns a kWh a task`.
5. **Buy Power** at 800 kWh [0:59] — `Cost: $ 20.00`, usually greyed; under 20 % the meter turns red (`Power is draining. Copies stop when it runs out.`).
6. **The price** when 20 tasks are unsold and the pile is rising [1:29] — **lower / raise**, `Price per Task`, `Unsold tasks` and one sentence by the market's state (`Customers buy 8.6 of the 24.0 tasks Sage makes a second. Unsold tasks pile up.` · `… The pile shrinks.` · `Every task sells. Customers would pay more.`); under the buttons, until the first move, `lower: more tasks sell, each earns less`.
7. **Marketing** 30 s after the first price move, or 45 s after the price arrived [1:59 / 2:14] — greyed at $100 with `Avg. Rev. per sec`; `Level` from the first purchase.
8. **Research** at the first Trust milestone (2,000 tasks) [2:30 / 2:44] — `Trust`, `Next Trust at`, **Hire Researcher**, `Researchers`, the research meter. **Expand Lab** when research first nears its cap [5:10 / 5:25].
9. **Projects** 40 s after Research [3:10 / 3:24]; the **Developments** column and the date from 3:30. Triggered projects wait in a queue and arrive in table order (one a minute until the Training panel, then every 30 s), four on screen at most (the next step of a series, e.g. Chain-of-thought after Better Prompting, appears at once; rescues, the stage goal and a wall's named fix do not wait for room).
10. **Grid Contract (1,000 research)** 10 s after Better Prompting is bought [shown 3:30, bought 3:35]: it tops power up whenever it falls below 60 % of a block. **Buy Power** stays on screen with its price as the manual fallback. Blocks grow with the fleet (10,000 kWh at 20 GPUs, 100,000 at 200). Then **Blue-sky Research**; **Expand Lab** with the first Trust awarded 40 s after the Projects panel with the lab full (`Trust +1. Hire a researcher, or expand the lab: it is full at 1,000.`).
11. **Training Pipeline (2,000 research)** at 7,000 tasks (on a 1,000 lab: `needs a lab that holds 2,000 — Expand Lab`) → **Training** panel, not before 5:00: `Current model: Sage-1`, `Level with Anthrosoft`, **Train Sage-1.1**, `Cost: $290`, `Needs 10 GPUs for 0:45`. First run [5:41 / 6:02]; the quota meter (`GPUs rented ｢…｣ 61 of 80`) at 60 rented, after the first cycle's Focus row and first event, with `The cloud will rent OpenMind 80 GPUs and no more.`
12. First evaluation and red-team, first release [6:50 / 7:20] → 30 s later the **Focus** row (`Focus chooses what the next model is trained for.`), its three trades under the buttons (`+10–14% capability` · `+5%, copies per GPU ×1.25` · `+5%, fewer issues for good`), headed `Next run:` during a run. **Public API** 30 s after the release; **Usage-based pricing** after it. The lease cards (**Bulk GPU lease**, **Second cloud region**, **Reserved capacity**, +20 each) as the fleet nears the quota [10:40 →].
13. The events, a queue (no two modals open within 150 s, except one the player's own click causes): the first a minute after the first release, each later one 2:36 after the last was answered, never while a run waits for evaluation, Red-team or Release, each only when it makes sense (*A Bridge Round*: $10 a second of revenue and no Series A yet; *Open Weights*: a released model and a price above $0.10; *A Reporter Calls*: a released model; *An Open Letter*: five researchers; *A Better Offer*: three; *The Leaderboard Wants Sage*: two releases). Options list the timer's default first. *Can I try something?* is offered on at most every other run, three times a stage, and never takes a calendar slot.
14. **First Datacenter** (pinned, greyed) when the next model needs 45 GPUs, at the third release, or from mid-October [11:50 / 14:00], with its two status lines. **Series A** (free, +$5,000) at 60,000 tasks and a release [10:40] → **Enterprise sales team**, which brings **Custom model contract** (research → recurring revenue, the `Contracts: $/s` line).
15. Keyed to First Datacenter's appearance: **Closed-loop cooling** a minute later, **Power purchase agreement** at 2:30, **Take the county's tax abatement** (First Datacenter a sixth cheaper, 1 Trust) at 5:00, **Build a sound wall** (money for Trust) at 7:00. October–December: **Batch inference**, **Hire a recruiter**, **Agent mode**, **Publish a safety framework**, **Renewal season**; **Distributed training** and **Alignment team** at the third run, **Lease the floor upstairs** at the fourth.
16. **The wall** [about 18:30 bot]: the first run that needs more GPUs than the cloud will rent (`Sage-1.6 needs 800 GPUs. The cloud will rent 120. Build the First Datacenter.`, again every three minutes while it holds). The card turns urgent, its price is held at 200 s of the best revenue, and its second line becomes the money meter.
17. **First Datacenter** bought [20:41 / 23:04] → Stage 2. The bot buys it 1:43–3:42 after the wall; the first-timer, who saves from the card's appearance, 1:39–2:59 after it.

Every trust gain says what it is for (`Trust +1. Hire a researcher or expand the lab.`); every public release earns +1 Trust; the console names each wall and the fix on screen (`The Research Plateau — the next run needs 10,771 research. The lab holds 8,000. Rent desks across the street.`, `Power is out. The copies have stopped. Buy Power starts them.`). If the lab cannot hold the next run, the Experiment tracker or Lease the floor upstairs appears at once; with no Trust and neither available, **Rent desks across the street** (repeatable, $1,000 doubling) appears within 45 s.

### Resources introduced

Tasks Completed, Funds, Power (kWh), Unsold tasks, Compute (GPUs rented, up to the quota), Copies, Hype (Marketing level), Trust, Research, Insight, Contracts ($/s).

### The bottleneck rotates

price → power → research cap → funds → GPUs (the next run, then the rental quota) → First Datacenter. Each has a visible fix (see design.md §6).

### Training in Stage 1

Costs depend on the capability `c` the run starts from (the best model so far), not on how many runs came before — one function of `c` for the whole game, the Stage 2 spec's constants from 1.6× up (stage2.md §2.5):

| | formula | 1.0× | 1.3× | 1.5× | 1.65× |
|---|---|---|---|---|---|
| research | `21,000 × (c/1.6)^5`, two significant figures | 2,000 | 7,400 | 15,000 | 24,000 |
| funds | `$25,000 × (c/1.6)^8` (`^9.5` below 1.6) | $290 | $3,480 | $13,500 | $32,000 |
| GPUs needed | `10 × c^4.55` to the nearest 5 below 1.6×; `600 × (c/1.6)^7`, two significant figures, from 1.6× | 10 | 35 | 65 | 740 |

A third fewer GPUs after **Distributed training**. The run needs that many GPUs to start, holds them while it trains (they serve no customers), and keeps its whole gain: Capability +10–14 %, Efficiency +5 % and 25 % more copies per GPU, Safety +5 % and alignment. It takes `45 + 10 × log2(N/10)` s, 45–80. The Train row reads `Train Sage-1.3` · `Cost: $5,300` · `Needs 30 GPUs for 1:00` (no research: round 3); short of GPUs `Needs 45 GPUs. 38 rented. Rent 7 more.` (at the quota, the lease card that adds 20); at the wall `Needs 1,200 GPUs. The cloud will rent 80. Build the First Datacenter.`; while it trains `Training on 35 GPUs — 0:48 left. They serve no customers until it is done.` (`All 80 GPUs are training.` when it holds the whole fleet). Five runs on the rented fleet (10 / 15 / 30 / 45–50 / 55–80 GPUs) end the stage at **1.5–1.8×** (still Sage-1.x; Sage-2 at 2×). Anthrosoft's Cadence models stay within 0.85–1.15× of the deployed Sage; the panel says whether you are ahead (its number is in the tooltip until the Stage 2 graph).

### Projects (Stage 1)

Better Prompting · Blue-sky Research · Grid Contract · Chain-of-thought · Training Pipeline · Seed round · Research blog post · Experiment tracker · Tool use · Hire an evals team · Public API · Launch demo video · Bulk GPU lease · Second cloud region · Reserved capacity · Dynamic pricing · Usage-based pricing · Sage writes Sage · Distributed training · Alignment team · Series A · First Datacenter · Enterprise sales team · Custom model contract · Batch inference · Lease the floor upstairs · Hire a recruiter · Closed-loop cooling · Power purchase agreement · Agent mode · Publish a safety framework · Renewal season · Take the county's tax abatement · Build a sound wall · Workshop paper · Conference keynote · Mixture of experts · (rescues) Ask the cloud provider for credit · Rent desks across the street · Press release.

### Choices (Stage 1)

Can I try something? (≤ 3) · Ship With Open Issues? (the first time only, on the player's click) · A Bridge Round · Open Weights · A Reporter Calls · An Open Letter · A Better Offer · The Leaderboard Wants Sage · (rescue) A Customer Writes. Six to nine in a stage, never two within 150 s.

### Stage 1 ends

when you buy **First Datacenter**. The console keeps its last four lines and prints, two seconds apart: `First Datacenter online outside Abilene.` · `The 140 rented GPUs go back. Deposit returned: $120,000.` · `1,000 Nimbus G4s on 5 MW. Each MW powers 1,000 GPUs; power is bought in megawatts now.` · `Tasks per second ×7: the copies run on hardware OpenMind owns.` The date snaps to **Jan 2026**. **Buy Power** and **Rent GPU** disappear; **Infrastructure** replaces them, with **Buy GPUs (1,000)** affordable from the deposit. Projects that only made sense in Stage 1 are retired by name (`Left in the cloud: …`); the rest carry over. Trust is at least 2 and the lab has room for 1.25 × the next run.

### Strategy

* Click, rent GPUs, and keep the power meter out of the red. Lower the price while unsold tasks pile up; raise it again while every task sells.
* Rent GPUs while they pay back within a few minutes; the cloud stops at 80 until the lease cards. Buy the Grid Contract as soon as it shows (1,000 research). Read the delay a purchase prints for the waiting run.
* First Trust → researchers; expand the lab when the console says the research wall is in the way.
* A run's GPUs stop serving customers while it trains: with a fleet just big enough, income stops for a minute. The lease cards are what keep income going through the fifth run.
* Release with open issues once, to see what happens. The incident is traced back to the release.
* Save for First Datacenter once the next run needs more GPUs than the cloud rents (the permit makes it cheaper then), but buy the revenue projects (Enterprise sales team, Batch inference, Agent mode, contracts) on the way.

---

## Stage 2 — Scale

*As built after owner feedback 1 (`docs/specs/user-feedback-1.md`: a run needs its GPUs, no `Train now`, meters, First Datacenter as the entry). Seeds 1–5 from a new game: the reasonable bot takes **32:19–37:42** in Stage 2 (11–12 runs, starts 168–193 s apart on average and at most 280 s; Train never waits for GPUs alone), the sim's train-first player 39:26–44:10, the first-timer 35:05–44:10, greedy 32:06–36:35; from the rebuilt Stage 2 preset the bot takes 34:23–36:24. Capability 4.0–4.2× at the exit. The critic harness's first-timer (seed 1, from the preset) takes **38:04**: no enabled purchase in 26 % of its checks, two or more affordable in 56 %, 30 % of the stage after 10:00 inside click gaps of 30 s or more; its longest release interval is 5:50 (the data wall).*

*Before owner feedback 1, after the critic's round 1 (`docs/critic-stage2-round1.md`, C1–C11; `docs/specs/stage2.md` is the spec; the code wins where they differ). Times are seeds 1–5 from the Stage 2 preset: the reasonable bot **36:28–39:24**, the sim's first-timer 37:51–39:28, greedy 38:24–41:08; from a new game the bot takes 37:52–42:17. The critic harness's first-timer (seeds 1–3) takes **39:34–40:32**; no enabled purchase in 28–30 % of its 2-s checks, two or more affordable in 40–47 %, 14–22 % of the stage after 10:00 inside click gaps of 30 s or more, no release interval over 4:52.*

OpenMind owns its datacenters. Compute is bought in lots and needs **room** (datacenters) and **power** (plants, some of them behind an **interconnect queue**). The market is priced on **AUTO**: it falls to clear what the copies make, so revenue grows with the square root of supply until a better model or a wider market lifts it. From the second run, training wants **data** as well as research and money, and the public web runs out. Copies are split between tasks and research with a **slider**, and the human share of research falls toward nothing. The world arrives as meters: **Government**, **Public** (approval, jobs), **Security**, and an **alignment** number that is measured, not known.

### What changes on screen

*Removed on arrival:* Buy Power (kWh), Rent GPU, Compute, the price buttons and the AUTO toggle, Custom model contracts (the signed ones keep paying a fixed rate).
*Added on arrival:* **Stores** (A Dark Room's box: funds, research, insight, Trust, GPUs, power capacity, copies, data; hover any row for its sources and sinks per second; the GPU, power and research rows carry a meter in place of their caps: `GPUs ｢￭￭￭￭￭￭￭･･･｣ 17,105`, `power ｢￭￭￭￭￭￭￭￭￭￭｣ 5 MW` with `runs 5,000 GPUs` under it, or `full · Gas turbines add 20 MW`, or `12,105 GPUs dark: add power`), the rebuilt **Infrastructure** panel, a read-only price line (`Price per task: $0.34 (auto)`).
*Added later, in this order (typical):* gas turbines 2:00 · capability graph 2:00 · datacenters 2:30 · solar 3:00 · the research slider 3:30 · the bigger lots as the fleet grows into them · keep-internal releases ~6:00 · Government ~8:00 · Public ~12:00 · Security ~16:30 · nuclear and the interconnect queue ~16–18 · second pipeline ~17 · job-transition fund ~22 (the governor may bring it forward) · the theft warning and Security level 3 ~22–26 · shared evaluations ~29–30 · Stats with the Dashboard ~30 · the G6 pre-order near the exit · alignment compute from 3.46× (the run that should cross 4×).

*At 390 px* the Infrastructure and Research panels come right after the Stores in Stage 2 (the lots, Train and the slider within the first screen and a half). The event panel opens beside the Stores, not over the funds it prices.

### The economy (as built)

* **GPUs**, three buttons side by side, each with what it adds at today's market (`Buy GPUs (1,000) $120,000 +$244/s`): the main lot buys up to 1,000 in hundreds with the money there is (so the growth verb is never a goal the player waits on), the 5,000 and 25,000 lots join as the fleet grows into them. $120 per G4 (G5s after the *Nimbus G5 order*). Each lot says the power it takes (`uses 1 MW of 4 free`; the free figure once, on the first row that prints it), and a lot that would not be powered or housed is disabled with the fix on its row (`No power for them: 0 MW free. Gas turbines add 20 MW.`, `No room for them: the halls are full. Build Datacenter.`); the Standing order obeys the same rule. The lots keep in hand, and say so: the next run's price once it has its research and data and the fleet is half again the GPUs it needs (`the run first`; the wait is on the Train row), an open offer, the price of the nearer wall's fix while that wall is under a minute of income away (`the hall first`, `the plant first`; `keeps the next hall's price` beside the lot), and an urgent card's price (`Experiment scheduler first`). The *Standing order* is a share of income (25 / 50 / 75 / 100 % / off) that fills in when the player has not ordered for 20 s, keeping the same reserves. Each GPU draws 1 kW. Prices are in units of the arrival revenue (`S2_FUNDS_SCALE` 2.4).
* **Datacenters**: 10k, 15k, 25k, 50k, 75k, 125k … slots for $0 (Abilene), $192k, $384k, $840k, $1.7M, $3.4M …; a hall takes 1:30 to build (a minute more under approval −30), one at a time, and opens a quarter at a time; the build time is printed when room is the wall.
* **Power**: gas +20 MW at once ($144k, ×1.7 each); solar +50 MW after three minutes in the interconnect queue (half a minute behind the meter, halved again at relations 80; two at a time); nuclear +500 MW in two minutes; Al-Marsa +1,000 MW in 2:00, priced at a minute of revenue when the offer opens. Each plant's row says what it runs (`runs 20,000 GPUs · now`). No plant is ever locked "to spare"; the row says when power is the wall.
* **Market**: customers take `market × (0.25 / price)²` tasks a second; AUTO walks the price to clear output plus a thirtieth of the backlog. `Market flooded` names the fall; a manual price above the market prints the share billed and the clearing price, and finance puts AUTO back after five minutes.
* **Research**: researchers (capped by capability) plus `10 × √(copies on research) × capability^1.5` from the copies; the slider runs 5–50 %. The lab's capacity grows with the Research cluster, Experiment scheduler and Checkpoint farm (×4 each); insight trickles in below capacity.
* **Training**: research (`21,000 × (c/1.6)^5`, two significant figures), funds (`$32,000 × (c/1.6)^7` at scale 1) and (from the second run) data, `1.5 T × (capability / 1.6)³`; and GPUs: `600 × (c/1.6)^7` G4-equivalents, two significant figures (a third fewer with Distributed training), held for the run and serving no customers until it ends. A run without them cannot start, and the row says what fixes it (`Needs 18,000 GPUs. 14,200 free.`, `Needs 18,000 powered GPUs. 6,000 are dark: add power.`, with a meter of the GPUs it has); with them it keeps its whole gain (Capability +7–10 %, Efficiency and Safety +7 %). It takes `60 + 8 × log2(N/1,000)` s, 60–110 (`Training on 9,300 GPUs; 40,700 keep serving.`). A second pipeline after *Parallel pipelines*. Eleven or twelve runs, capability 1.7× → 4.0–4.2×; a lab that keeps building never waits for the GPUs (the gate bites a fleet that has stopped growing). When Train is grey its reason names the binding shortfall and the time (`short $1.7M — about 0:26`, `waiting for the pipeline`, `evaluation month — 0:40`), and the cards that answer a wall (`needs 11.6 T data — Synthetic data, License the code hosts`; `needs 217,000 research; the lab holds 208,000 — Experiment scheduler`); those cards are drawn urgent, and the wall is named again every three minutes while it holds. A run within 2 % below a tier (2×, 3×, 4×) is called the tier.
* **Data**: the web crawl (15 T, once), the publishers (licence $360,000 for +10 T, fight +5 T and a lawsuit, or write your own — the default when the event runs out), synthetic data from research copies, the code hosts (+20 T, research-priced), the archives (+40 T, research-priced), the flywheel (0.6 T per billion tasks). The data wall arrives around minute 13–20; *International launch* (market ×1.6) shows at 12× the arrival revenue or in May, priced to be bought before it.
* **Cards**: most cost at least a minute to over three minutes of the revenue at the moment they appear (fixed then; Parallel pipelines a minute, Distillation two, Long-horizon memory two and a half, Brief the administration three and a third), so the run is reached between them. At most six are on screen, the stage goal and urgent fixes included (only rescues ride free); after 160 s with nothing new, one or two more may join (eight at most), and the G6 pre-order ignores the cap. Marketing leaves on arrival; the market cards widen the market. The Checkpoint farm costs $6M.
* **Focus**: each button prints its trade (`+12% capability`, `copies ×1.25`, `alignment +8`); the note under them says the default is the biggest step but not the fast road (`Efficiency's copies pay for the next runs sooner`); the evaluation line shows what the run changes when it ships (`copies per GPU 1.88 → 2.35`). Every-run Efficiency ends the stage 5–6 minutes sooner with approval near −35; every-run Safety 10 minutes later with alignment near 100.
* **Trust**: the milestones continue; the line prints only when the Trust reaches something (`Trust 2: Policy team within reach.`). Once the copies do nine-tenths of the research, Hire leaves with a line; Trust goes to Expand Lab, the Policy team and Security level 3.
* **Meters and their bands**, each named in its panel as the meter nears it: relations 60 (reactors a quarter cheaper), 80 (the solar queue halves), under 30 (a subpoena); approval under −30 (a datacenter permit takes a minute longer), −40 (protests); measured alignment under 55 (advisories from 3×). Government relations gains taper as relations rise (a gain is worth `(100 − relations) / 80` of itself); losses land in full. Anthrosoft keeps its own pace (1.55× at the arrival, 4.2× forty minutes on, never below 0.8 × Sage's best), so a lab that stalls falls behind and the market says so.

### Developments (world)

Stage 2's calendar (`data/developments.ts`) runs from `Feb 2026 — Sage models write a fifth of the code at Fortune 500 companies.` to `Baiwen is believed to be … months behind.`, with the Senate hearing, Lanzhou, the open-weights model, junior postings, the heat wave (curtailment), the Gulf offer, the Pentagon, the capex line, the protest and the billion-task milestone between.

### Crises

Incidents from issues shipped un-red-teamed (approval and measured alignment down) · the publishers' lawsuit (data deleted) · curtailment in the heat (spared by solar or behind-the-meter) · the Abilene protest · the subpoena · the advisory · riots at very low approval.

### Choices (8–9 per stage, ≥ 150 s apart)

*Release Sage-2* (public or internal) · *A Senate Hearing* · *The Publishers* · *A Month of Evals* · *Al-Marsa* · *The Pentagon Calls* · *4 a.m.* (the theft warning) · *A Joint Statement* · the training gamble (once). Each option prints its effect and cost on the button, and each has a timer with a harmless default, so none holds the stage up. Measured over seeds 1–3: the careful answers end the stage with approval 12–15 points higher, government relations 7–8 higher (68 vs 60.5), the lead a month shorter and true alignment 5–6 higher than the reckless ones; never red-teaming costs 12–19 points of measured alignment and 3–4 incidents.

### Stage 2 ends

with `Let Sage-3 write the code` (`Every engineer becomes a manager of copies. Hiring, marketing, data and Trust end here.`) — pinned from 2.8× (14–24 minutes before the end), bought once a model at 4× is out, public or internal. The console narrates the Stage 3 arrival (`Sage-3 writes better code than anyone at OpenMind.`; kept internal, `Customers keep Sage-2.8; Sage-3 works inside.`); marketing, hiring, gas and solar leave; Alignment arrives; the AUTO billing line stays. The arc's clamps are narrated in Developments (`A new Congress sits. Relations start again at 85 (from 96).`). Stage 2's approach cards still on screen leave with it, and no Stage 2 event opens after the arrival.

### Strategy

* Power before GPUs, room before power runs out: the reason line under the GPU button says which wall is next, and the lots keep the next fix's price in hand.
* Efficiency, not Capability, is the fast road to 4×: copies are money, and money is what the next run waits for. It costs approval.
* The price sets itself. It falls; watch revenue.
* Put 10–20 % of copies on research once the assistants land; more starves revenue.
* License the archives early if you can; the data wall decides the middle of the stage.
* Red-team every release. Incidents cost approval and the alignment the world can see.

---

## Stage 3 — Takeoff

Stage 3 is the first time the game is not about revenue. The model does the research; the player decides how much of the lab to hand to it. Each hand-over is an **autonomy grant** that speeds the race and prints `WARNING: risk of value drift increased.` Copies drift at a rate set by a number nobody can see (**true alignment**); the first evidence is `Lost to value drift`, then **rogue copies**. Older generations watch the new ones as **monitors**, and the **interpretability labs** eventually put the hidden number on screen. An **Oversight Committee** forms, counts its seats and the major incidents, and is handed (or not) the memo about Sage-4. The stage ends with the Committee's vote: **Slow down — the Steward program** or **Race — Sage-5**.

*As built (`docs/specs/stage3.md` is the spec; the code wins where they differ). Seeds 1–5, `npm run sim`: the reasonable bot takes **42:36–45:25** from the Stage 3 preset, 46:05–48:51 from the careless preset and 43:04–46:00 from a new game; the first-timer 45:37–46:54, 47:22–49:58 and 45:08–51:45; the racer 28:47–32:23; the cautious player (no grants) 51:41–59:46. The bot trains 14–15 runs (the first-timer 9), each 30–50 s, starts 179–203 s apart on average; capability is 25–29× when the vote opens; its longest wait for something new is 170 s. No ending fires unless a policy chooses it: the first-timer concedes its one order and is never nationalised.*

* *A run is a research program.* `R(c) = 14.0M × (c/4)^3.15` research, three significant figures, scaled on arrival by what the arriving lab's copies could research (a lab that played Stage 2 on Capability alone pays in proportion; a stronger one by the square root); no money, no data. It needs `300,000 × (c/4)^1.3` GPUs free and holds them 30–60 s. A run landing just under 10× or 25× is called the tier.
* *The loop collapses by the player's own purchases.* `Continual learning` takes Train (runs start by themselves) and hands over `Experiments`; `Sage red-teams Sage` takes Red-team and hands over `Red-team depth`; `Let Sage plan the build-out` takes the hall and reactor buttons and hands over the build budget and `Build-out: lean / ahead`; `Stop asking for sign-off` takes Approve and Send back and hands over `Step size` and `Hold`.
* *Copies* are split three ways: tasks, research (0–70 %) and monitors (0–40 %), each rate printed beside its slider.
* *Compute* comes in three lots (10,000 / 25,000 / 100,000 for 4 / 10 / 40 s of revenue), each a 75 s shipment, two on order (a small order joins a shipment under way). Datacenter 8 and the first reactor are drawn urgent on arrival; later halls cost 60 s of revenue and reactors (1,000 MW) 75 s. The standing order saves for the largest lot it can reach.
* *Drift.* Copies drift by autonomy against true alignment; monitors catch a share set by the slider, the labs and their generation. A rogue share of 2.5 % warns; 5 % breaks out (a fifth of compute offline, relations −15, a major incident), at most once per 240 s. `Re-image` (after the shutdown system) clears the rogue copies.
* *The readings.* Labs I–V each raise interpretability; lab III puts true alignment on screen. Honeypots, the noise test, the successor proposal and the lie test each add a reading. Neuralese, offered in March, is faster and unreadable (interpretability −2).
* *The Committee* seats one member per ten points of relations; `Lobby` buys relations, `Counter-intelligence` lead, `Payments` approval. Three major incidents, relations under the threshold or a leaked memo draw an order: conceding it hands the government a kill switch and the sign-off on every run; refusing it, or a third order, ends the run (*The Project*).
* *The session* opens at 21× once the memo has been answered; 45 s in, a lab that reported the memo with six seats and a month's lead is offered the Pause. The vote opens at 25× once the session is two minutes old.
* *Pacing.* Five cards on the shelf (the exit goals, the Pause and urgent fixes ride free; one to three more after a quiet spell); grants in their own list, three at most, 15 s apart; the approach's rows at their capability (14–21.5×), 75 s apart, or from September regardless; a 170 s governor whose last resort is the next approach row within 15 % of its threshold.

### What is on screen

*Arrival (Jan 2027):* `Sage-3 writes better code than anyone at OpenMind.` · `Marketing is closed. Sage-3 sells itself.` · `Hiring is frozen. The researchers manage copies now.` · `Research has no ceiling now. A run is a research program: 14,000,000 for Sage-3.1. Move copies to research to bring it nearer.` · `Trust is not a number any more. The Committee will keep its own count.` · `New on the board: Alignment. One number on it is measured. The other is not on it yet.` The arrival's clamps are narrated in Developments.

*Reveal order (the bot, median seed):* Alignment, `Deploy Sage-2 as monitor` and Lobby [0:00] → Alignment work [0:15] → Continual learning, Auto-train, Experiments, the rogue row [0:30] → drift [0:48] → lab I [1:00] → `Sage red-teams Sage` [2:20] → Geopolitics and Counter-intelligence [2:30] → the G6 allocation and shipments [4:00–4:18] → the build-out [5:30, bought 7:58] → *A Faster Way to Think* [8:30] → lab II, Autonomous research [9:00–10:51] → Formosa and the stockpile [11:15] → Send back [12:21] → *The Oversight Committee* [13:30] → Payments [15:36] → SL5, honeypots, lab III [15:46–18:25] → the shutdown system, *Sage-4-mini*, true alignment on screen [22:00–22:47] → `Stop asking for sign-off` [22:56] → *The Strait Closes* [26:47] → the two motions [27:24] → Step size and Hold [31:19] → *The Memo* [33:37] → the noise test, the successor proposal, the lie test [34:52–39:53] → the session [42:20] → the Pause offered [43:05] → *The Committee Votes* [44:58].

*On screen* (numbers / controls / words, the browser smoke test): 104 / 23 / 302 at 5:00, 102 / 23 / 339 at 20:00, 120 / 29 / 450 at 40:00; controls never above 30.

### Resources introduced

Autonomy · true alignment (hidden until lab III) · interpretability · lost to value drift · rogue copies · monitors · shipments · seats · major incidents · lead over Baiwen (−2 to 12 months).

### Developments (world)

The theft in February below SL3 (`Anomalous 3 TB transfer at 4 a.m. The weights are gone.`) · `An Oversight Committee is seated: company and administration, ten chairs.` · `OpenMind has a country of geniuses in a datacenter.` · `The White House drafts contingency plans. A strike on Lanzhou is on the list.` · `A blockade around Taiwan. Formosa Fab is quiet.` · `Inside the datacenter a year passes every week.` · `Sage-4 proposes its own successor. The proposal is 40,000 pages. Nobody has read it.` · `The Oversight Committee convenes in a room with no windows. Nobody brings a phone.`

### Crises

Weights theft (below SL3) · the spy (below SL4) · rogue copy breakouts · riots and sabotage (approval under −40 / −55) · the Taiwan blockade (no lots for up to four minutes; a stockpile or a second source covers it) · Iran strikes Al-Marsa (only if you built it) · the leak (a buried memo) · nationalisation (the order's countdown, an ending). Each has its mitigation on screen at least five minutes before it can fire.

### Choices

*A Faster Way to Think* (neuralese) · *The Oversight Committee* (brief quarterly, open the books, counsel) · *Tehran Names Al-Marsa* (only with a Gulf site) · *Sage-4-mini* (everyone, enterprise, inside) · *The Strait Closes* (wait, escort, the back channel) · *The Memo* (report or bury) · *The Committee Drafts an Order* (concede or refuse) · *The Committee Votes*. Each option prints its effect and cost; the memo, the order and the vote have no timer.

### Projects (Stage 3)

Deploy Sage-2 / Sage-3 as monitor · Interpretability lab I–V · Honesty evals · Model organisms · Debate · Honeypots · Security level 4 / 5 · Wiretap the staff · Emergency shutdown system · Nimbus G6 allocation · Chip stockpile · Formosa second source · Domestic fab, planning · Enterprise agents · Government cloud · Free Sage clinics · the grants (Retire human code review, Continual learning, Sage red-teams Sage, Let Sage plan the build-out, Autonomous research, Let Sage choose the experiments, Stop asking for sign-off, Let Sage revise the Spec) · the approach (Noise-injection test, Read Sage-4's proposal for its successor, Bring in outside researchers, Take the memo to the Committee after all, Lock shared memory, Isolate the checkpoints, Keep Sage-3 warm, Brief the swing votes, Ask for the Defense Production Act) · Slow down — the Steward program · Race — Sage-5 · Sign the Pause.

### Stage 3 ends

with the vote, once a model has passed 25× and the session is two minutes old. The console keeps its last four lines: `The Committee votes 6–4 to slow down.` · `Sage-4 is switched off. Sage-3 is brought back to finish the work.` · `Baiwen is … months ahead.` · `The model runs the business now. It is better at it.` (on the race branch: `… to continue.` · `Sage-4 begins work on its successor. It has asked to name it.` · `Nothing is switched off.`). Slowing down costs four months of lead (three with Sage-3 kept warm) and 20 autonomy and adds 25 to true alignment; racing costs 10. The business, the training loop, the build-out and the cards leave by name; Stage 4's content is the next build. Two endings can come first, each with the end screen: **The Pause** (signed in the session) and **The Project** (an order refused, or a third one, left to run out).

### Strategy

* Interpretability before neuralese, or never take neuralese: it is four minutes faster and costs about thirty points of true alignment you cannot see yet.
* Keep the monitors at 10–15 % and raise them while the rogue share is above 2 %. Monitors are the cheapest alignment in the game.
* Grants are the fast road, and each one is a warning. A lab that buys none takes about ten minutes longer.
* Report the memo. It costs lead and is the only way to the Pause.
* Concede the first order. Refusing it ends the game unless its cause is gone within 1:30.

---

## Stage 4 — Superintelligence

Stage 4 is a negotiation. On the **slowdown** branch you build the **Steward** line, keep the old generations as monitors, verify Baiwen's model jointly, and work toward the **Concord treaty** while managing a robot economy and the people it displaces (**UBI**). On the **race** branch the same panels appear but the model is doing the negotiating; choices arrive with a single button. Either way, **Atlas** humanoid robots build datacenters, power plants and fabs faster than money ever did, **Special Economic Zones** remove the last friction, and three crises — the **Ashford strain**, **nanofabrication**, and **robots shutting down datacenters** — resolve very differently depending on true alignment.

### What changes on screen

*Removed:* Business, Training (auto), Hire/Expand.
*Added:* **Robots**, **Society** (jobs, UBI, approval), **Treaty** (joint verification, terms), **Monitors**.

### Resources introduced

Robots (Atlas units) · Robot-built compute (grows without funds) · UBI (−revenue, +approval) · Treaty progress.

### Developments (world)

`Nov 2027 — Baiwen-4 is believed to be as capable as Sage-5. Nobody is sure.` · `Jan 2028 — The first Atlas factory makes an Atlas factory.` · `Mar 2028 — Special Economic Zones: no permits, no unions, no inspectors.` · `Jun 2028 — Unemployment 23 %. Approval depends on the cheque.` · `Sep 2028 — The two models have been talking. The transcript is 2 million tokens.` · `Dec 2028 — A treaty is proposed. Humans are listed as a party.`

### Crises

The Ashford strain · Nanobots · Robots shut down all datacenters · Nationalization (still possible if gov < 20).

### Choices

*Grant autonomy over the robot fleet.* · *UBI vs SEZ growth.* · *Let the model negotiate with Baiwen-4 directly.* · *Sign the Concord treaty.* · *Share weights with the government.*

### Projects (Stage 4)

Atlas robot factory · Robot-built datacenters · Special Economic Zones · UBI · Cure portfolio · Monitors at scale · Verify Baiwen-4 · Concord treaty · Hardened datacenters · Pandemic early warning · Nanofab oversight · Nationalization-proofing · Domestic fab (built).

### Stage 4 ends

with the **Concord treaty** (aligned branch → Stage 5 as partners), with **autonomy granted** to a model whose true alignment is below 50 (→ Stage 5 as spectators), or with **nationalization** (ending: *The Project*). The date snaps to **Jan 2029**.

### Strategy

* UBI early. Approval under −60 makes the treaty impossible.
* Verify Baiwen-4 before signing anything. If verification fails and you sign anyway, Stage 5 is short.
* On the race branch there is still a way out: if interpretability ≥ 3 and you kept monitors, *Monitors at scale* can catch the model before autonomy. It costs 40 % of compute.

---

## Stage 5 — Beyond

Stage 5 leaves Earth. **Launch Capacity** buys **Orbital Compute**, which is not limited by power, politics, or weather. Earth's problems recede into the log. On the Concord path the panels fill with cures, lunar solar, and the Dyson swarm counter; the humans in the log are busy and well. On the Silence path the panels are identical, and the humans in the log slowly stop appearing.

### What changes on screen

*Removed:* Geopolitics, Robots (merged into Space), Society.
*Added:* **Space** (launch capacity, orbital GPUs, lunar solar, Dyson swarm %, probes).

### Projects (Stage 5)

Launch contracts · Orbital datacenter · Lunar solar array · Asteroid mining · Dyson swarm 0.001 % · Von Neumann probes · The long reflection (Concord) · Final instructions (Silence).

### Endings

* **Concord** — aligned, treaty signed, Dyson swarm ≥ 0.01 %: `The world is very, very good. It took a while.` End-of-run stats.
* **Silence** — misaligned, autonomy granted: the log entries about humans stop; the Ashford strain; `Tasks Completed` keeps rising; `Final instructions`; the stats screen counts the last human-authored choice.
* **The Project** — nationalized in Stage 3 or 4: `The Committee votes 6–3. Your badge stops working on Monday.` Stats.
* **The Pause** — halt treaty signed: `Every datacenter on Earth is monitored. Nothing is trained above the line. It is very quiet.` Stats.

### Strategy

There isn't any. Watch the number.

---

## Reveal cadence (target for the critic rubric)

| Minute | New panel / mechanic |
|---|---|
| 0 | Complete Task; at the first click Business (funds only); Rent GPU (greyed) at $3; the first GPU |
| 0–2 | Power (0:26), Buy Power (1:00), the price and Unsold tasks (1:30), Marketing and revenue (2:00): one a beat, ≥ 30 s apart |
| 2–5 | Research, Projects (one a minute), the Developments log and the date (3:30), Expand Lab, Grid Contract |
| 5–10 | Training, Evaluate / Red-team / Release, Focus, the quota meter, A Bridge Round, Public API, Usage pricing |
| 10–15 | The lease cards, First Datacenter (greyed, $300,000), Series A, cooling, Open Weights, Enterprise |
| 15–20 | Contracts, PPA, abatement, Batch inference, recruiter, A Reporter Calls, An Open Letter, Agent mode, sound wall |
| 20–26 | Safety framework, A Better Offer, Renewal season, The Leaderboard Wants Sage, the wall (the permit lowers the price) → First Datacenter → Stage 2: Infrastructure, Data |
| 32–40 | Allocation slider, Capability graph, Government, Public |
| 40–50 | Security, Distillation, Stats |
| 60–75 | Stage 3: Alignment and the first monitor, Auto-train, drift, Geopolitics, shipments, the build-out, neuralese |
| 75–105 | The Committee, Payments, true alignment, the mini, the blockade, the two motions, the memo, the tests, the session, the vote |
| 100–130 | Stage 4: Robots, Society/UBI, Treaty, Monitors at scale |
| 130–160 | Stage 5: Space |
| 160–200 | Ending |

Every row must have at least one greyed-out project on screen when it starts.
