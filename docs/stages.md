# Stages

*Written in the format of the Universal Paperclips wiki's [Stages](https://universalpaperclips.fandom.com/wiki/Stages) page. All five stages are built; each section says what is on screen as built, with the headless simulator's numbers (`npm run sim`). The specs in `docs/specs/` are the design; where they and this page differ, the code wins.*

The gameplay of **Takeoff** takes place over five **stages**. The stages limit which projects can be launched, and each has a distinct play style. The first stage is roughly analogous to running a small API business. The second is a datacenter and power-management game. The third is a race with a hidden variable. The fourth is a negotiation you may or may not be part of. The fifth is space.

The player is never told which stage they are in and is never told how many there are.

## Summary

| Stage | Name | In-game dates | Target wall clock | Analogy | Exit condition |
|---|---|---|---|---|---|
| 1 | The Startup | Jul 2025 → Dec 2025 | 20–30 min | UP Stage 1 (manufacturing + business), opened like A Dark Room | **First Datacenter** at Abilene (1,000 GPUs of OpenMind's own) |
| 2 | Scale | Jan 2026 → Dec 2026 | 35–45 min | UP Stage 2 (power management) + GDS loop | Reach **superhuman coder** (capability ≥ 4×) |
| 3 | Takeoff | Jan 2027 → Oct 2027 | 40–50 min | The AI-2027 "race" chapters | Reach **superhuman AI researcher** (≥ 25×) **and** make the Committee choice |
| 4 | Superintelligence | Nov 2027 → Dec 2028 | 30–40 min | AI-2027 branch chapters | **Sign the Concord treaty**, or grant the fleet autonomy, or the fleet is taken (or The Pause / The Project) |
| 5 | Beyond | Jan 2029 → mid 2030 | 20–30 min | UP Stage 3 (space), compressed | **The long reflection** (Concord) or **Final instructions** (Silence) |

Total: 158–166 minutes for the simulator's reasonable bot from a new game (seeds 1–5, to Concord; seed 1: 20:14 · 38:23 · 44:39 · 31:10 · 25:36); 2.5–3.5 hours for a player who reads; 4 hours for a cautious one.

---

## Stage 1 — The Startup

The first stage is by far the simplest. OpenMind has a model, a cloud bill, and no customers. You complete tasks by hand, rent **GPUs** so that copies of the model complete tasks without you clicking, keep their **Power** (kWh) topped up, and price the tasks against the market. Then you hire **Researchers**, who turn **Trust** into **Research** points, which buy the projects that lay the technical backbone of the later stages, and you run your first **training runs**. Every run needs a number of GPUs; the cloud rents 80 (140 with three lease cards), and when the next model needs more than that, only **First Datacenter** — 1,000 GPUs of OpenMind's own at Abilene — trains it. If you run out of money with no power, the game lets you **Ask the cloud provider for credit** in exchange for Trust rather than losing the game, and the **Complete Task** button never needs power.

*As built after owner feedback 1 (`docs/specs/user-feedback-1.md`; it overrides the critic-driven design where they conflict). Seeds 1–5, `npm run sim`: the reasonable bot buys First Datacenter at **23:29–24:59**, the first-timer at 25:19–27:56, the greedy player at 24:01–29:37, the train-first player at 24:28–27:56; the critic harness's first-timer at **26:36** (seed 1). Capability at the hand-over 1.51–1.80×; no reveal gap over 176 s; Train never waits for GPUs alone longer than 2:06; six or seven modals, never two within 152 s.*

*As built after critic round 3 (`docs/specs/stage1-round3-fixes.md`, with the wallet rule of `stage2-round2-fixes.md` §1). A run costs dollars and needs GPUs; research buys cards only. `$290 × c^13`, two figures: $290 / $1,300 / $5,300 / $23,000 / $100,000; from 1.6× a run is priced as Stage 2 prices it, and the rented GPU curve runs to 1.68× (85–105 GPUs), so every seed trains five models before the wall. Train is disabled only by its requirements; pressed short of money it arms (`starts when paid for — about 1:20`). Marketing costs `$100 × 2^(levels bought)`. First Datacenter appears when the next model needs 45 GPUs, at the third release or from mid-October, a plain card (the GPUs the next model needs against the cloud's are in its hover); it costs 200 s of the best revenue ($100,000–$450,000). The Series A pays $5,000. The six events are a queue: the first a minute after the first release, each later one 2:36 after the last was answered, never while a run waits for evaluation, Red-team or Release; options list the timer's default first. Seeds 1–5: the bot buys First Datacenter at **20:15–21:41**, the first-timer at 22:49–23:59, the greedy player at 27:15–27:35, the train-first player at 22:14–24:00; first run by 5:41–6:06; research never blocks Train.*

*Owner feedback 2 (2026-10-04, `docs/specs/arc.md`): the screen reads as it did at commit `a2117b5`. A row is a label and a value, or a button, its price and at most a short italic reason; nothing prints a delay, a clock, a return or a band edge after a row (hovers carry those). The notes below describe the rows as they read now.*

* *One mechanic at a time.* The game opens with one button and one number and adds one thing a beat, each announced by a console line; beats 4–8 come in order and at least 30 s apart. A steady player (two clicks a second, a GPU when one is affordable) sees 1 / 5 / 6 / 10 / 16 / 18 numbers and 1 / 2 / 3 / 5 / 7 / 7 controls at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00 (the browser smoke test). Every click pays $0.25 at once, so the first GPU ($6) comes at 0:16 at one and a half clicks a second, 0:12 at two, 0:06 at four. The market starts at its full size (`MARKET_START` 3): every task sells until about the ninth GPU, and the backlog that forms then is the lesson.
* *A run needs its GPUs.* No yield, no `Train now`: without the GPUs the Train button is grey and the row says what fixes it; with them the run keeps its whole gain. The run's GPUs serve no customers until it is done.
* *Meters.* Every bar is the original training bar — a 1 px black border, a white track 12 px tall, a `#888` fill — drawn by `renderMeter()` at 90 px beside a figure; the eval bars and a cooling button (Red-team, Re-image) take the same border, track and fill. The bars are where the owner asked for them: `Power [meter] 968 kWh` (scale: the block Buy Power sells; red when close to empty), `GPUs rented [meter] 61 / 80` from 60 rented, `Research [meter] 837 / 1,000`, and the Train row when it is short of GPUs. Stores rows carry none (`GPUs 11,000 / 25,000`).
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
4. **Power** at the third GPU or 20 s after the first [0:26] — `Power [meter] 968 kWh`, draining as the copies work (`Each task a copy completes burns 1 kWh. The meter drains.`).
5. **Buy Power** at 800 kWh [0:59] — `Cost: $ 20.00`, usually greyed; under 20 % the meter turns red (`Power is draining. Copies stop when it runs out.`).
6. **The price** when 20 tasks are unsold and the pile is rising [1:29] — **lower / raise** and `Price per Task` on one line, `Unbilled Tasks`, and the billing line by the market's state (`Billing 8.6/s of 24.0/s produced: backlog growing` · `… backlog shrinking` · `Billing all 270/s produced: selling out`); what lower and raise do is in their hovers.
7. **Marketing** 30 s after the first price move, or 45 s after the price arrived [1:59 / 2:14] — greyed at $100 with `Avg. Rev. per sec`; `Level` from the first purchase.
8. **Research** at the first Trust milestone (2,000 tasks) [2:30 / 2:44] — `Trust`, `Next Trust at`, **Hire Researcher**, `Researchers`, the research meter. **Expand Lab** when research first nears its cap [5:10 / 5:25].
9. **Projects** 40 s after Research [3:10 / 3:24]; the **Developments** column and the date from 3:30. Triggered projects wait in a queue and arrive in table order (one a minute until the Training panel, then every 30 s), four on screen at most (the next step of a series, e.g. Chain-of-thought after Better Prompting, appears at once; rescues, the stage goal and a wall's named fix do not wait for room).
10. **Blue-sky Research** at a full first lab. Power is kept on by hand for the first half of the stage: **Grid Contract (2,000 research)** comes at the tenth Buy Power press (`GRID_CONTRACT_PRESSES`) [bot 10:30–11:30; a player buying 1,000 kWh blocks at 20+ GPUs, about 6:00] and tops power up whenever it falls below 60 % of a block. **Buy Power** stays on screen with its price as the manual fallback. Blocks grow with the fleet (10,000 kWh at 20 GPUs, 100,000 at 200). **Expand Lab** with the first Trust awarded 40 s after the Projects panel with the lab full (`Trust +1. Hire a researcher, or expand the lab: it is full at 1,000.`).
11. **Training Pipeline (2,000 research)** at 7,000 tasks (on a 1,000 lab: `needs a lab that holds 2,000 — Expand Lab`) → **Training** panel, not before 5:00: `Current model: Sage-1`, **Train Sage-1.1**, `Cost: $290`, `Needs 10 GPUs for 0:45`. First run [5:41 / 6:02]; the quota meter (`GPUs rented [meter] 61 / 80`) at 60 rented, after the first cycle's Focus row and first event, with `The cloud will rent OpenMind 80 GPUs and no more.`
12. First evaluation and red-team, first release [6:50 / 7:20] → 30 s later the **Focus** row (`Focus chooses what the next model is trained for.`), three plain buttons with the selected one's trade in one line under them (`The most capable next model (about +12%).` · `Copies per GPU ×1.25; a smaller capability gain.` · `Fewer red-team issues, now and on every later run.`); each button's figures are in its hover. **Public API** 30 s after the release; **Usage-based pricing** after it. The lease cards (**Bulk GPU lease**, **Second cloud region**, **Reserved capacity**, +20 each) as the fleet nears the quota [10:40 →].
13. The events, a queue (no two modals open within 150 s, except one the player's own click causes): the first a minute after the first release, and it is always **A Rival Lab**, Anthrosoft's arrival: a dialog with one button (`Another lab, Anthrosoft, releases Cadence-2.` · where it stands against Sage · `Customers compare the two from now on. Demand follows whichever model is ahead.`). Its first Cadence ships as the dialog opens and the Training panel gains its row (`Ahead of Anthrosoft` · `Level with Anthrosoft` · `Anthrosoft is ahead`). Before it nothing names Anthrosoft: no row, no Cadence release, no development or event that mentions it. Each later event comes 2:36 after the last was answered, never while a run waits for evaluation, Red-team or Release, each only when it makes sense (*A Bridge Round*: $10 a second of revenue and no Series A yet; *Open Weights*: a released model and a price above $0.10; *A Reporter Calls*: a released model; *An Open Letter*: five researchers; *A Better Offer*: three; *The Leaderboard Wants Sage*: two releases). Options list the timer's default first. *Can I try something?* is offered on at most every other run, three times a stage, and never takes a calendar slot.
14. **First Datacenter** (pinned, greyed) when the next model needs 45 GPUs, at the third release, or from mid-October [11:50 / 14:00], a plain card. **Series A** (free, +$5,000) at 60,000 tasks and a release [10:40] → **Enterprise sales team**, which brings **Custom model contract** (research → recurring revenue, the `Contracts: $/s` line).
15. Keyed to First Datacenter's appearance: **Closed-loop cooling** a minute later, **Power purchase agreement** at 2:30, **Take the county's tax abatement** (First Datacenter a sixth cheaper, 1 Trust) at 5:00, **Build a sound wall** (money for Trust) at 7:00. October–December: **Batch inference**, **Hire a recruiter**, **Agent mode**, **Publish a safety framework**, **Renewal season**; **Distributed training** and **Alignment team** at the third run, **Lease the floor upstairs** at the fourth.
16. **The wall** [about 18:30 bot]: the first run that needs more GPUs than the cloud will rent (`Sage-1.6 needs 800 GPUs. The cloud will rent 120. Build the First Datacenter.`, again every three minutes while it holds). The card's price is held at 200 s of the best revenue; the Train row names it as the fix.
17. **First Datacenter** bought [20:41 / 23:04] → Stage 2. The bot buys it 1:43–3:42 after the wall; the first-timer, who saves from the card's appearance, 1:39–2:59 after it.

Every trust gain says what it is for (`Trust +1. Hire a researcher or expand the lab.`); every public release earns +1 Trust; the console names each wall and the fix on screen (`The Research Plateau — the next run needs 10,771 research. The lab holds 8,000. Rent desks across the street.`, `Power is out. The copies have stopped. Buy Power starts them.`). If the lab cannot hold the next run, the Experiment tracker or Lease the floor upstairs appears at once; with no Trust and neither available, **Rent desks across the street** (repeatable, $1,000 doubling) appears within 45 s.

### Resources introduced

Tasks Completed, Funds, Power (kWh), Unbilled tasks, Compute (GPUs rented, up to the quota), Copies, Hype (Marketing level), Trust, Research, Insight, Contracts ($/s).

### The bottleneck rotates

price → power → research cap → funds → GPUs (the next run, then the rental quota) → First Datacenter. Each has a visible fix (see design.md §6).

### Training in Stage 1

Costs depend on the capability `c` the run starts from (the best model so far), not on how many runs came before — one function of `c` for the whole game, the Stage 2 spec's constants from 1.6× up (stage2.md §2.5):

| | formula | 1.0× | 1.3× | 1.5× | 1.65× |
|---|---|---|---|---|---|
| research | `21,000 × (c/1.6)^5`, two significant figures | 2,000 | 7,400 | 15,000 | 24,000 |
| funds | `$25,000 × (c/1.6)^8` (`^9.5` below 1.6) | $290 | $3,480 | $13,500 | $32,000 |
| GPUs needed | `10 × c^4.55` to the nearest 5 below 1.6×; `600 × (c/1.6)^7`, two significant figures, from 1.6× | 10 | 35 | 65 | 740 |

A third fewer GPUs after **Distributed training**. The run needs that many GPUs to start, holds them while it trains (they serve no customers), and keeps its whole gain: Capability +10–14 %, Efficiency +5 % and 25 % more copies per GPU, Safety +5 % and alignment. It takes `45 + 10 × log2(N/10)` s, 45–80. The Train row reads `Train Sage-1.3` · `Cost: $5,300` · `Needs 30 GPUs for 1:00` (no research: round 3); short of GPUs `Needs 45 GPUs. 38 rented. Rent 7 more.` (at the quota, the lease card that adds 20); at the wall `Needs 1,200 GPUs. The cloud will rent 80. Build the First Datacenter.`; while it trains `Training on 35 GPUs — 0:48 left. They serve no customers until it is done.` (`All 80 GPUs are training.` when it holds the whole fleet). Five runs on the rented fleet (10 / 15 / 30 / 45–50 / 55–80 GPUs) end the stage at **1.5–1.8×** (still Sage-1.x; Sage-2 at 2×). Once it has arrived (the `A Rival Lab` dialog, a minute after the first release), Anthrosoft ships every 4–7 minutes and its Cadence models stay within 0.85–1.15× of the deployed Sage; the panel says whether you are ahead (its number is in the tooltip until the Stage 2 graph).

### Projects (Stage 1)

Better Prompting · Blue-sky Research · Grid Contract · Chain-of-thought · Training Pipeline · Seed round · Research blog post · Experiment tracker · Tool use · Hire an evals team · Public API · Launch demo video · Bulk GPU lease · Second cloud region · Reserved capacity · Dynamic pricing · Usage-based pricing · Sage writes Sage · Distributed training · Alignment team · Series A · First Datacenter · Enterprise sales team · Custom model contract · Batch inference · Lease the floor upstairs · Hire a recruiter · Closed-loop cooling · Power purchase agreement · Agent mode · Publish a safety framework · Renewal season · Take the county's tax abatement · Build a sound wall · Workshop paper · Conference keynote · Mixture of experts · (rescues) Ask the cloud provider for credit · Rent desks across the street · Press release.

### Choices (Stage 1)

Can I try something? (≤ 3) · Ship With Open Issues? (the first time only, on the player's click) · A Rival Lab (a notice, one button) · A Bridge Round · Open Weights · A Reporter Calls · An Open Letter · A Better Offer · The Leaderboard Wants Sage · (rescue) A Customer Writes. Six to nine in a stage, never two within 150 s.

### Stage 1 ends

when you buy **First Datacenter**. The console keeps its last four lines and prints, two seconds apart: `First Datacenter online outside Abilene.` · `The 140 rented GPUs go back. Deposit returned: $120,000.` · `1,000 Nimbus G4s on 5 MW. Each MW powers 1,000 GPUs; power is bought in megawatts now.` · `Tasks per second ×7: the copies run on hardware OpenMind owns.` The date snaps to **Jan 2026**. **Buy Power** and **Rent GPU** disappear; **Infrastructure** replaces them, with **Buy GPUs (1,000)** affordable from the deposit. Projects that only made sense in Stage 1 are retired by name (`Left in the cloud: …`); the rest carry over. Trust is at least 2 and the lab has room for 1.25 × the next run.

### Strategy

* Click, rent GPUs, and keep the power meter out of the red. Lower the price while unbilled tasks pile up; raise it again while every task bills.
* Rent GPUs while they pay back within a few minutes; the cloud stops at 80 until the lease cards. Buy power by hand before the meter empties; buy the Grid Contract when it shows, after ten presses (2,000 research). Read the delay a purchase prints for the waiting run.
* First Trust → researchers; expand the lab when the console says the research wall is in the way.
* A run's GPUs stop serving customers while it trains: with a fleet just big enough, income stops for a minute. The lease cards are what keep income going through the fifth run.
* Release with open issues once, to see what happens. The incident is traced back to the release.
* Save for First Datacenter once the next run needs more GPUs than the cloud rents (the permit makes it cheaper then), but buy the revenue projects (Enterprise sales team, Batch inference, Agent mode, contracts) on the way.

---

## Stage 2 — Scale

*As built after round 2 and the wallet rule (`docs/specs/stage2-round2-fixes.md`, arc G34: two purses, whole lots, Train armable, delays printed, nothing held back). Seeds 1–5: from a new game the reasonable bot takes **35:32–41:04** in Stage 2 (10–12 runs), the first-timer 39:49–44:12, greedy 37:45–43:59, train-first 35:15–42:48; from the rebuilt Stage 2 preset the bot takes 35:53–39:09 and the first-timers 39:21–41:17. The longest release interval is 3:55–6:00 for the bot and at most 7:47 for a first-timer who buys every card lit; Train is pressable or armed 93–100 % of its idle time; 134–207 lot presses a stage; a whole lot lit (or bought) in 12–20 % of the 2-s checks; a 25 % build share ends the stage 1:48–3:14 before a 75 % one. No first-time reveal gap over 170 s. Capability 4.0–4.2× at the exit*

*As built after owner feedback 1 (`docs/specs/user-feedback-1.md`: a run needs its GPUs, no `Train now`, meters, First Datacenter as the entry). Seeds 1–5 from a new game: the reasonable bot takes **32:19–37:42** in Stage 2 (11–12 runs, starts 168–193 s apart on average and at most 280 s; Train never waits for GPUs alone), the sim's train-first player 39:26–44:10, the first-timer 35:05–44:10, greedy 32:06–36:35; from the rebuilt Stage 2 preset the bot takes 34:23–36:24. Capability 4.0–4.2× at the exit. The critic harness's first-timer (seed 1, from the preset) takes **38:04**: no enabled purchase in 26 % of its checks, two or more affordable in 56 %, 30 % of the stage after 10:00 inside click gaps of 30 s or more; its longest release interval is 5:50 (the data wall).*

*Before owner feedback 1, after the critic's round 1 (`docs/critic-stage2-round1.md`, C1–C11; `docs/specs/stage2.md` is the spec; the code wins where they differ). Times are seeds 1–5 from the Stage 2 preset: the reasonable bot **36:28–39:24**, the sim's first-timer 37:51–39:28, greedy 38:24–41:08; from a new game the bot takes 37:52–42:17. The critic harness's first-timer (seeds 1–3) takes **39:34–40:32**; no enabled purchase in 28–30 % of its 2-s checks, two or more affordable in 40–47 %, 14–22 % of the stage after 10:00 inside click gaps of 30 s or more, no release interval over 4:52.*

OpenMind owns its datacenters. Compute is bought in lots and needs **room** (datacenters) and **power** (plants, some of them behind an **interconnect queue**). The market is priced on **AUTO**: it falls to clear what the copies make, so revenue grows with the square root of supply until a better model or a wider market lifts it. From the second run, training wants **data** as well as research and money, and the public web runs out. Copies are split between tasks and research with a **slider**, and the human share of research falls toward nothing. The world arrives as meters: **Government**, **Public** (approval, jobs), **Security**, and an **alignment** number that is measured, not known.

### What changes on screen

*Removed on arrival:* Buy Power (kWh), Rent GPU, Compute, the price buttons and the AUTO toggle, Custom model contracts (the signed ones keep paying a fixed rate).
*Added on arrival:* the **Build share** row on the Infrastructure panel (`Build share: 50%`) and **Stores** (A Dark Room's box: funds, the build fund, research, insight, Trust, GPUs, power capacity, copies, data; hover any row for its sources and sinks per second; one line a row and no bars: `research 61,000 / 100,000`, `GPUs 17,105 / 25,000`, `power 5 MW`, with `all in use:` in front when it is; the hover keeps the breakdown), the rebuilt **Infrastructure** panel, a read-only price line (`Price per task: $0.34 (auto)`).
*Added later, in this order (typical):* gas turbines 2:00 · capability graph 2:00 · datacenters 2:30 · solar 3:00 · the research slider 3:30 · the bigger lots as the fleet grows into them · keep-internal releases ~6:00 · Government ~8:00 · Public ~12:00 · Security ~16:30 · nuclear and the interconnect queue ~16–18 · second pipeline ~17 · job-transition fund ~22 (the governor may bring it forward) · the theft warning and Security level 3 ~22–26 · shared evaluations ~29–30 · Stats with the Dashboard ~30 · the G6 pre-order near the exit · alignment compute from 3.46× (the run that should cross 4×).

*At 390 px* the Infrastructure and Research panels come right after the Stores in Stage 2 (the lots, Train and the slider within the first screen and a half). The event panel opens beside the Stores, not over the funds it prices.

### The economy (as built)

* **Two purses** (arc G34). Income splits by the **build share** (25 / 50 / 75 %, 50 % on arrival): the share fills the **build fund**, which pays for lots, plants and halls (the deposit starts it, `The 140 rented GPUs go back. The deposit, $56,000, starts the build fund.`); the rest fills funds, which pay for runs, cards, event options and Security level 3. Nothing is held back, reserved or shrunk for the player: a row is grey only while its purse cannot pay (it says nothing: the fund is in Stores) or a stated requirement is unmet (GPUs, power, room, a prerequisite).
* **GPUs** come in whole lots, three sizes on screen: the three smallest of 1,000 / 5,000 / 25,000 / 125,000 that are at least 2 % of the fleet, so the sizes climb with it (`Lots come in 5,000s now: a thousand GPUs is a rounding error on 61,000.`). Each row is `Buy GPUs (5,000) $1.3M` (what it uses and adds is in the button's hover), and a lot that would not be powered or housed is disabled with the wall beside it (`no power`, `no room`). $120 per G4 at scale 1 (a tenth more under a month's lead: Washington tightens exports), G5s after the *Nimbus G5 order*. Each GPU draws 1 kW. The **Standing order** (a research card) is the build fund's automation and nothing else: on, it buys the largest whole lot that fits whenever the fund covers one, never plants or halls; its row is `Standing order: ON`; stalled with a lot's price in the fund, the console names the wall and the line repeats every 180 s. Prices are in units of the arrival revenue (`S2_FUNDS_SCALE` 2.4) times the **arrival scale**, set by the income the lab brings: the arrival played on a copy of the state (1,000 owned GPUs, the market Stage 1 built, the contracts' frozen rate) against the median exit's $3,500/s; below it by the 0.75 power, above it by the square root, within 0.6–1.25, fixed at the click (and estimated live in Stage 1, so the wall row quotes what the click charges). A lab that arrives small meets a smaller first lot and a cheaper first run; no deposit windfall or skippable Stage 1 card decides it.
* **Datacenters**: 10k, 15k, 25k, 50k, 75k, 125k … slots for $0 (Abilene), $192k, $384k, $840k, $1.7M, $3.4M …; a hall takes 1:30 to build (a minute more under approval −30), one at a time, and opens a quarter at a time; the build time is printed when room is the wall, and a hall built ahead prints its idle room (`7,000 slots free`).
* **Power**: gas +20 MW at once ($144k, ×1.7 each); solar +50 MW after three minutes in the interconnect queue (half a minute behind the meter, halved again at relations 80; two at a time); nuclear +500 MW in two minutes; Al-Marsa +1,000 MW in 2:00, priced at a minute of revenue when the offer opens. Each plant's row says what it runs and what stands idle (`Gas turbines (+20 MW) $245,000 · runs 20,000 GPUs · 18 of 25 MW idle`). No plant is ever locked "to spare"; the row says when power is the wall. Over-building spends build money only.
* **Market**: customers take `market × (0.25 / price)²` tasks a second; AUTO walks the price to clear output plus a thirtieth of the backlog. `Market flooded` names the fall; a manual price above the market prints the share billed and the clearing price, and finance puts AUTO back after five minutes.
* **Research**: researchers (capped by capability) plus `10 × √(copies on research) × capability^1.5` from the copies; the slider runs 5–50 % and prints its two rates beside it (`50% · research +3,495/s · revenue −24%`). The lab's capacity grows with the Research cluster, Experiment scheduler and Checkpoint farm (×4 each); insight trickles in below capacity.
* **Training**: research (`21,000 × (c/1.6)^5`, two significant figures), funds (`$52,000 × (c/1.6)^7` at scale 1, times the arrival scale) and (from the second run) data, `1.5 T × (capability / 1.6)³`; and GPUs: `600 × (c/1.6)^7` G4-equivalents, two significant figures (a third fewer with Distributed training), held for the run and serving no customers until it ends. A run without them cannot start, and the row says what fixes it (`Needs 18,000 GPUs. 14,200 free.`, `Needs 18,000 powered GPUs. 6,000 are dark: add power.`, with a meter of the GPUs it has); with them it keeps its whole gain (Capability +7–10 %, Efficiency and Safety +7 %). It takes `90 + 8 × log2(N/1,000)` s, 90–120 (G9's two minutes) (`Training on 9,300 GPUs; 40,700 keep serving.`). A second pipeline after *Parallel pipelines*. Eleven or twelve runs, capability 1.7× → 4.0–4.2×; a lab that keeps building never waits for the GPUs (the gate bites a fleet that has stopped growing). Train is disabled only by a requirement (the run's GPUs, a free pipeline, an evaluation month, a lab that can hold the run). Pressed with money, research or data short it is **armed** (`Sage-2.5 starts when paid for — about 1:22`) and starts by itself once paid; pressed again it stands down; arming reserves nothing. The row prints every shortfall with one clock (`short $6.5M and 8,750 research — about 1:22`), and the cards that answer a wall (`needs 11.6 T data — Synthetic data, License the code hosts`; `needs 217,000 research; the lab holds 208,000 — Experiment scheduler`); those cards are drawn urgent, and the wall is named again every three minutes while it holds. A run within 3 % below a tier (2×, 3×, 4×) is called the tier (arc G33).
* **Data**: the web crawl (15 T, once), the publishers (licence $360,000 for +10 T, fight +5 T and a lawsuit, or write your own — the default when the event runs out), synthetic data from research copies, the code hosts (+20 T, research-priced), the archives (+40 T, research-priced), the flywheel (0.6 T per billion tasks). The data wall arrives around minute 13–20; whenever the next run's data is not in hand a card that adds data is on screen and urgent (*Synthetic data* appears on that condition, and *The Publishers* opens at the first shortfall). *International launch* (market ×1.6) shows at 12× the arrival revenue or in May, priced to be bought before it.
* **Cards**: most cost 70 % of a minute to over three minutes of what fills funds (the revenue less the default build share; `S2_CARD_FLOOR`) at the moment they appear (fixed then; Parallel pipelines a minute, Distillation two, Long-horizon memory two and a half, Brief the administration three and a third). The three research cards of the first minute wait for the first run to start. While a run waits for money, a card or a priced event option prints the delay it causes when it is 10 s or more (`Research cluster ($144,000) · Sage-1.6 0:45 later`). Grey is for goals: a card more than three minutes of income from its purse is not drawn (the stage goal excepted). At most six are on screen, the stage goal and urgent fixes included (only rescues ride free); after 160 s with nothing new, one or two more may join (eight at most), and the G6 pre-order ignores the cap. Marketing leaves on arrival; the market cards widen the market. The Checkpoint farm costs $6M.
* **Focus**: each button prints its trade (`+12% capability`, `copies ×1.25`, `alignment +8`); the note under them says the default is the biggest step but not the fast road (`Efficiency's copies pay for the next runs sooner`); the evaluation line shows what the run changes when it ships (`copies per GPU 1.88 → 2.35`). Every-run Efficiency ends the stage 5–6 minutes sooner with approval near −35; every-run Safety 10 minutes later with alignment near 100.
* **Trust**: the milestones continue; the line prints only when the Trust reaches something (`Trust 2: Policy team within reach.`). Hire Researcher and Expand Lab leave on arrival (the copies do the research and cards size the lab); Trust buys only what names it (the Policy team, Security level 3, the tax abatement).
* **Meters and their bands**, each in its line's hover: relations 60 (reactors a quarter cheaper), 80 (the solar queue halves), under 30 (a subpoena); approval under −30 (a datacenter permit takes a minute longer), −40 (protests); measured alignment under 65 (advisories from 3×) and 85 or more (each public release: relations +1); the lead (`Baiwen: about 1.5 months behind`; under 1 Washington tightens exports and chips cost a tenth more; at 3 or more, relations +1 a month). Government relations gains taper as relations rise (a gain is worth `(100 − relations) / 80` of itself); losses land in full. Anthrosoft keeps its own pace (1.55× at the arrival, 4.2× forty minutes on, never below 0.8 × Sage's best), so a lab that stalls falls behind and the market shrinks (`Anthrosoft is ahead`, the cut in its hover; the release line `Cadence-21 is ahead of Sage.`).

### Developments (world)

Stage 2's calendar (`data/developments.ts`) runs from `Feb 2026 — Sage models write a fifth of the code at Fortune 500 companies.` to `Baiwen is believed to be … months behind.`, with the Senate hearing, Lanzhou, the open-weights model, junior postings, the heat wave (curtailment), the Gulf offer, the Pentagon, the capex line, the protest and the billion-task milestone between.

### Crises

Incidents from issues shipped un-red-teamed (approval and measured alignment down) · the publishers' lawsuit (data deleted) · curtailment in the heat (spared by solar or behind-the-meter) · the Abilene protest · the subpoena · the advisory · riots at very low approval.

### Choices (8–9 per stage, ≥ 150 s apart)

*Release Sage-2* (public or internal) · *A Senate Hearing* · *The Publishers* · *A Month of Evals* · *Al-Marsa* · *The Pentagon Calls* · *4 a.m.* (the theft warning) · *A Joint Statement* · the training gamble (once). Each option prints its effect and cost on the button, and each has a timer with a harmless default, so none holds the stage up. Measured over seeds 1–3: the careful answers end the stage with approval 12–15 points higher, government relations 7–8 higher (68 vs 60.5), the lead a month shorter and true alignment 5–6 higher than the reckless ones; never red-teaming costs 12–19 points of measured alignment and 3–4 incidents.

### Stage 2 ends

with `Let Sage-3 write the code` (`Every engineer becomes a manager of copies. Hiring, marketing, data and Trust end here.`) — pinned from 2.8× (14–24 minutes before the end), bought once a model at 4× is out, public or internal. The console narrates the Stage 3 arrival (`Sage-3 writes better code than anyone at OpenMind.`; kept internal, `Customers keep Sage-2.8; Sage-3 works inside.`); marketing, hiring, gas and solar leave; Alignment arrives; the AUTO billing line stays. The arc's clamps are narrated in Developments (`A new Congress sits. Relations start again at 85 (from 96).`). Stage 2's approach cards still on screen leave with it, and no Stage 2 event opens after the arrival.

### Strategy

* Set the build share by what the next run lacks: 75 % while it waits for GPUs, 50 % otherwise; 25 % starves the fleet. Power before GPUs, room before power runs out: the lot rows say which wall is next.
* Press Train when the run's GPUs are there: it starts itself when paid for. A card bought from funds while a run waits pushes the run back.
* Efficiency, not Capability, is the fast road to 4×: copies are money, and money is what the next run waits for. It costs approval.
* The price sets itself. It falls; watch revenue.
* Put 10–20 % of copies on research once the assistants land; more starves revenue.
* License the archives early if you can; the data wall decides the middle of the stage.
* Red-team every release. Incidents cost approval and the alignment the world can see.

---

## Stage 3 — Takeoff

Stage 3 is the first time the game is not about revenue. The model does the research; the player decides how much of the lab to hand to it. Each hand-over is an **autonomy grant** that speeds the race and prints `WARNING: risk of value drift increased.` Copies drift at a rate set by a number nobody can see (**true alignment**); the first evidence is `Lost to value drift`, then **rogue copies**. Older generations watch the new ones as **monitors**, and the **interpretability labs** eventually put the hidden number on screen. An **Oversight Committee** forms, counts its seats and the major incidents, and is handed (or not) the memo about Sage-4. The stage ends with the Committee's vote: **Slow down — the Steward program** or **Race — Sage-5**.

*As built after the wallet rule's addendum and the load pass (`docs/specs/stage3.md`, its G34 addendum). Seeds 1–5: the reasonable bot takes **42:24–45:24** from the rebuilt Stage 3 preset, 43:02–48:47 from the careless preset and 41:09–46:16 from a new game; the first-timer 46:12–47:51, 46:02–49:33 and 47:07–52:03 (greedy 48:34–51:46 and train-first 47:23–54:41 from the preset); the racer 28:12–31:35; the cautious player (no grants) 53:20–55:22. The bot trains 13–15 runs, starts 177–201 s apart on average; capability is 25–28× when the vote opens; its longest wait for something new is 170 s (the first-timer's 166–235 s from the presets, up to 6:35 from a new game, where its last run takes eight minutes). No ending fires unless a policy chooses it.*

*Before them* (`docs/specs/stage3.md` is the spec; the code wins where they differ). Seeds 1–5, `npm run sim`: the reasonable bot takes **42:36–45:25** from the Stage 3 preset, 46:05–48:51 from the careless preset and 43:04–46:00 from a new game; the first-timer 45:37–46:54, 47:22–49:58 and 45:08–51:45; the racer 28:47–32:23; the cautious player (no grants) 51:41–59:46. The bot trains 14–15 runs (the first-timer 9), each 30–50 s, starts 179–203 s apart on average; capability is 25–29× when the vote opens; its longest wait for something new is 170 s. No ending fires unless a policy chooses it: the first-timer concedes its one order and is never nationalised.*

* *A run is a research program.* `R(c) = 14.0M × (c/4)^3.15` research, three significant figures, scaled on arrival by what the arriving lab's copies could research (a lab that played Stage 2 on Capability alone pays in proportion; a stronger one by the square root); no money, no data. It needs `300,000 × (c/4)^1.3` GPUs free and holds them 30–60 s. A run landing just under 10× or 25× is called the tier.
* *The loop collapses by the player's own purchases.* `Continual learning` takes Train (runs start by themselves) and hands over `Experiments`; `Sage red-teams Sage` takes Red-team and hands over `Red-team depth`; `Let Sage plan the build-out` takes the hall and reactor buttons and hands over the build budget and `Build-out: lean / ahead`; `Stop asking for sign-off` takes Approve and Send back and hands over `Step size` and `Hold`.
* *Copies* are split three ways: tasks, research (0–70 %) and monitors (0–40 %), each rate printed beside its slider. **Alignment work** is a share of research, 0 / 10 / 20 / 30 % (`10% · measured +0.2 a minute · runs 11% later`), at the built rate: 2 % of a run's research buys measured alignment +0.1 and the real thing +0.08. Experiments (at most +5 a run) and the research cards stay lit and print the delay they cause (`Sage-3.4 1:10 later`).
* *Two purses carry over* (arc G34). The build share (25 / 50 / 75 %) of revenue fills the build fund, which pays for lots, halls and reactors, by hand or through `Let Sage plan the build-out` (its budget spends the fund); funds pay for seats, lead, payments, security and cards. Nothing is held back: a lot is grey only for the fund's shortfall, power, room or `2 on order`, and one grey lot row is drawn.
* *Compute* comes in three lots (10,000 / 25,000 / 100,000 for 4 / 10 / 40 s of revenue), each a 75 s shipment, two on order (a small order joins a shipment under way). Datacenter 8 and the first reactor are drawn urgent on arrival; later halls cost 60 s of revenue and reactors (1,000 MW) 75 s. The standing order buys the largest lot the fund covers.
* *Drift.* Copies drift by autonomy against true alignment; monitors catch a share set by the slider, the labs and their generation. A rogue share of 2.5 % warns; 5 % breaks out (a fifth of compute offline, relations −15, a major incident), at most once per 240 s. `Re-image` (after the shutdown system) clears the rogue copies.
* *The readings.* Labs I–V each raise interpretability; lab III puts true alignment on screen. Honeypots, the noise test, the successor proposal and the lie test each add a reading. Neuralese, offered in March, is faster and unreadable (interpretability −2).
* *The Committee* seats one member per ten points of relations; `Lobby` buys relations, `Counter-intelligence` lead, `Payments` approval. Three major incidents, relations under the threshold or a leaked memo draw an order: conceding it hands the government a kill switch and the sign-off on every run; refusing it, or a third order, ends the run (*The Project*).
* *The session* opens at 21× once the memo has been answered; 45 s in, a lab that reported the memo with six seats and a month's lead is offered the Pause. The vote opens at 25× once the session is two minutes old.
* *Pacing.* Five cards on the shelf (the exit goals, the Pause and urgent fixes ride free; one to three more after a quiet spell); grants in their own list, three at most, 15 s apart; the approach's rows at their capability (14–21.5×), 75 s apart, or from September regardless; a 170 s governor whose last resort is the next approach row within 15 % of its threshold.
* *Load.* A Stage 3 note shows for 45 s of play and then folds into its row's hover (a project card keeps its sentence, as in Stages 1–2); a band edge prints only when the meter is near it; a panel's detail shows only while it binds; each fact has one home. A run that lands within 3 % under 10× or 25× is called the rung (arc G33).

### What is on screen

*Arrival (Jan 2027):* research gets a fifth of the copies at least (a Stage 2 left at 10 % with a full lab starved every run; `With no ceiling on research, a fifth of the copies go back to it.`). `Sage-3 writes better code than anyone at OpenMind.` · `Marketing is closed. Sage-3 sells itself.` · `Hiring is frozen. The researchers manage copies now.` · `Research has no ceiling now. A run is a research program: 14,000,000 for Sage-3.1. Move copies to research to bring it nearer.` · `Trust is not a number any more. The Committee will keep its own count.` · `New on the board: Alignment. One number on it is measured. The other is not on it yet.` The arrival's clamps are narrated in Developments.

*Reveal order (the bot, median seed):* Alignment, `Deploy Sage-2 as monitor` and Lobby [0:00] → Alignment work [0:15] → Continual learning, Auto-train, Experiments, the rogue row [0:30] → drift [0:48] → lab I [1:00] → `Sage red-teams Sage` [2:20] → Geopolitics and Counter-intelligence [2:30] → the G6 allocation and shipments [4:00–4:18] → the build-out [5:30, bought 7:58] → *A Faster Way to Think* [8:30] → lab II, Autonomous research [9:00–10:51] → Formosa and the stockpile [11:15] → Send back [12:21] → *The Oversight Committee* [13:30] → Payments [15:36] → SL5, honeypots, lab III [15:46–18:25] → the shutdown system, *Sage-4-mini*, true alignment on screen [22:00–22:47] → `Stop asking for sign-off` [22:56] → *The Strait Closes* [26:47] → the two motions [27:24] → Step size and Hold [31:19] → *The Memo* [33:37] → the noise test, the successor proposal, the lie test [34:52–39:53] → the session [42:20] → the Pause offered [43:05] → *The Committee Votes* [44:58].

*On screen* (numbers / controls / words, the browser smoke test): at the five-minute marks 70–83 numbers, 206–303 words and at most 30 controls from Stage 3 start, 73–85 numbers from the careless start (the smoke test's bot: 73–83 numbers, 206–293 words); controls never above 30. Before the load pass: 104 / 23 / 302 at 5:00, 102 / 23 / 339 at 20:00, 120 / 29 / 450 at 40:00.

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

with the vote, once a model has passed 25× and the session is two minutes old. The console keeps its last four lines: `The Committee votes 6–4 to slow down.` · `Sage-4 is switched off. Sage-3 is brought back to finish the work.` · `Baiwen is … months ahead.` · `The model runs the business now. It is better at it.` (on the race branch: `… to continue.` · `Sage-4 begins work on its successor. It has asked to name it.` · `Nothing is switched off.`). Slowing down costs four months of lead (three with Sage-3 kept warm) and 20 autonomy and adds 25 to true alignment; racing costs 10. The business, the training loop, the build-out and the cards leave by name; Stage 4's content is the next build. Two endings can come first, each with the end screen: **The Pause** (signed in the session) and **The Project** (an order refused, or a third one, left to run out). The end screen is the page: nothing of the game is drawn behind it, and it scrolls as one document.

### Strategy

* Interpretability before neuralese, or never take neuralese: it is four minutes faster and costs about thirty points of true alignment you cannot see yet.
* Keep the monitors at 10–15 % and raise them while the rogue share is above 2 %. Monitors are the cheapest alignment in the game.
* Grants are the fast road, and each one is a warning. A lab that buys none takes about ten minutes longer.
* Report the memo. It costs lead and is the only way to the Pause.
* Concede the first order. Refusing it ends the game unless its cause is gone within 1:30.

---

## Stage 4 — Superintelligence

Stage 4 is a negotiation run on a robot economy. The model runs the business now, so money is retired
on arrival (`Money is retired: $5.5B is written off. Nobody notices.`) and the Complete Task button
goes. The player has a fleet of **Atlas** robots split between three jobs (mine, replicate, build; a
fourth, treaty chips, late), a population losing its jobs (**universal basic income**, **Housing**),
a **Concord treaty** that needs Baiwen-4 verified and a model able to write its enforcer, and
generations that arrive by themselves (**Verify each generation** reads each one first). Three
crises — the **Ashford strain**, the **nanofab line**, **robots at the breakers** — each read the
hidden number in one of three bands. The stage ends when something is signed (the treaty, Stage 5;
or a halt, *The Pause*), given away (the fleet granted) or taken (the fleet taken), or by the
Committee's order (*The Project*).

*As built (`docs/specs/stage4.md` is the spec; the code wins where they differ).* Seeds 1–5, `npm run
sim`: the reasonable bot signs the treaty at **31:00–32:55** from `4s`, **31:01–31:57** from `4r`,
31:52–38:21 from `4cs`, 37:51–41:21 from `4cr` and 31:10–33:37 from a new game (whose bot takes the
race branch); Baiwen-4 comes back aligned in about three runs of ten, and those runs are the shorter.
The first-timer grants the fleet at its first request: 23:49–25:36 from every start. The racer takes
the negotiation grant and signs at 26:10–26:38; the cautious player (no grants) at 33:53–35:11. The bot
sees 9–11 generations (mean 175–211 s apart), exits at 575–833× with 3.0–5.4 × 10⁹ GPU-equivalents,
4.7M robots and 0.9–2.6 × 10¹³ tasks a second; every crisis fires, at least 393 s after its mitigation
showed. No ending fires that a policy did not choose.

* *Arrival.* Slow: Sage-4 is switched off and **Steward-1** runs at 0.6 of it (15×), thoughts in English,
  Verify on. Race: the next model is **Sage-5** (`Sage-5 is 2:35 away. Nobody scheduled it.`), Verify
  off if `Stop asking for sign-off` was kept. Business, Training, Infrastructure and Complete Task leave;
  **Stores is the main panel** (centre column); Payments become universal basic income in a line
  (levels 1–2 → 5 %, 3–4 → 10 %, 5 → 20 %); the approval formula is re-based so the target starts where
  Stage 3 ended; floors are narrated (`A new session sits. Relations start again at 30 (from 12).`).
* *Generations.* `G(c) = 95 s of the arrival's research potential × (c / c₀)^2.5`, started the moment
  research covers it; 50 s to train, plus Verify's read (40 s; 20 s at measured ≥ 80; 10 s after the last
  sign-off); +44 % a generation slow, +42 % race; within 3 % under 100×, 250× or 1,000× it is called the
  rung. Names: Steward-1.1 … Steward-2 at 100×, Steward-3 at 250×, Steward-4 at 1,000×; Sage-5, then
  Sage-6 at 100×, Sage-7 at 250×. A verified generation: true alignment +5 slow / +2 race, measured +3
  and a fifth of what it trails by, lead −0.15. One nobody read: true −2 / −4 / −6 slow, −4 / −8 / −12
  race (below 100×, to 250×, beyond), lead +0.1; under 55 measured it also costs relations 2.
* *The fleet.* `Convert a car plant` (free, needed) gives 10,000 robots; 30 s later the three sliders
  arrive with what each share makes (`· +12,400 t/s`, `· +52 robots/s, doubling in 2:20`, `· +14,000
  GPUs/s`, or `at the permit cap` / `out of materials`). Mining 0.5 t/s a robot, a robot 40 t
  (0.0065 a second a replicating robot), a GPU-equivalent 0.02 t and a kilowatt (0.5 a second a
  builder). Atlas Mk II ×1.5 and the fleet grant ×1.25 on replication; the zones (×2 / ×1.5) and the
  Growth goal (×1.25) on output; Deep mines ×2 and Nanofabrication ×3 mining; Robot-built fabs ×2 and
  Nanofabrication ×2 building. Permits: 400,000 until *Special Economic Zones*; then 1.2M, 4.8M or no
  cap (open zones slow toward 30M). Robots double in about 2.3 minutes and reach 4.7M at 22–25 minutes.
* *Society.* Jobs follow half the best model (`3,400 × (1 − e^(−cap/700))` million); approval moves
  0.1 a second toward a target the dividend (+15 / +30 / +50 at 5 / 10 / 20 %), Cure portfolio (+10),
  the Ashford strain and its cure, the zones, the transition grant (+10) and Housing (+0.3 a unit for
  good; 3 s of mining, ×1.2 a unit, relaxing a step every 25 s) set. Riots at −40, sabotage at −55,
  the treaty stalls at −60.
* *The treaty.* `Treaty talks` (the Committee's agenda, 1:00–1:30) opens it at 10–35 %. One point every
  27 s while five seats sit with OpenMind and approval is above −60; Baiwen-4 ahead ×1.25, more than three
  months behind ×0.75; `Draft clauses` (0 / 10 / 20 / 30 % of research) +0.2 points per 2 % of a
  generation; ceilings 40 (50 with Inspectors) until Baiwen-4 is verified (3:00, then *What Baiwen-4
  Wants*: aligned in three runs of ten), 60 until `Treaty terms`, 80 until **Design Concord-1** (a
  250× model, 150× with the negotiation grant; 1:30 to write), then the fleet installs **treaty chips**
  (half the fleet 5:00; `Treaty chip lines` ×1.25). `Sign the Concord treaty` is on screen, greyed, from
  the talks; `Sign a halt instead` from 12:00.
* *The Committee.* The agenda takes one item at a time (talks, terms, Nationalisation-proofing, the
  Spec; 60 s at eight seats); `Hold a hearing` (60 s, relations +2, +4 at approval ≥ 0) from the agenda,
  or from the arrival below five seats. *Consolidation* (compute ×1.5, relations +10, Verify locked on);
  the order's second answer is now **hand over the keys** (Verify forced on, monitors 25 %, the newest
  grant revoked).
* *Grants hand over a selector* (G28): `Let it assign the fleet` → **Fleet goal: Growth / People / Treaty**;
  `Let it run the transition` → **Approval to hold: −25 / 0 / +25** (it sets the dividend; the cost is
  printed); `Let it negotiate with Baiwen-4` → **Negotiator's stance** (treaty ×2 / ×3 / ×4).
  `Revoke a grant` gives the newest back. On the race branch three cards arrive with one button and name
  the grant that took the other.
* *Exits.* The treaty (Stage 5, `flags.exitKind = 'treaty'`), the fleet granted (one click, from the
  fleet's request at 250×), the fleet taken (the shutdown finds true alignment under 40, autonomy at 80
  and no hardened datacenters). `flags.alignedAtHandover` is computed once, at the exit: true alignment
  ≥ 60, or ≥ 40 with interpretability 4 and monitors at 15 %; it alone picks Stage 5's skin.
* *Load.* At the five-minute marks the bot's screen holds 54–73 numbers, 166–253 words and 13–21 controls
  (the arrival 40 / 181 / 9, under the Stage 3 exit); band edges print only near; Stage 3's four readings
  leave with the vote.

### What is on screen

*Arrival (Nov 2027), slow:* `The Committee votes 6–4 to slow down.` · `Sage-4 is switched off. Sage-3 is
brought back to finish the work.` · `The model runs the business now. It is better at it.` · `Money is
retired: $5.5B is written off. Nobody notices.` · `The Complete Task button is gone. Tasks Completed is
not.` · `New on the board: Robots. 10,000 Atlas-class units are waiting at a car plant in Ohio.` ·
`Payments become a universal basic income: level 4 → 10% of output.` · `Steward-1 is slower than Sage-4
was: 15.0×. It thinks in English.` · `Counter-intelligence is the Committee's now.`

*Reveal order (the bot from `4s`, seed 3):* the car plant [0:00] → the fleet's sliders and materials
[0:30] → Atlas Mk II [1:00] → Society and Housing [2:00] → Deep mines [2:30] → `Let it assign the fleet`
and Fleet goal [3:30–3:46] → the agenda, hearings, `Treaty talks` [4:30] → early warning [5:00] → the
Treaty panel, Draft clauses, the treaty's goal [5:30] → Cure portfolio, Robot-built fabs, Inspectors
[6:30–8:10] → *Special Economic Zones* [9:00] → Monitors at scale [9:30] → `Let it run the transition`
and Approval to hold [10:00] → Verify Baiwen-4 [11:00] → *The Ashford Strain* [11:30] → the halt [12:00]
→ *Consolidation* [14:00] → *What Baiwen-4 Wants* [16:30] → the negotiation grant [17:00] → Hardened
datacenters, Nanofabrication and its oversight [18:00–18:43] → the breakers [19:32] → Revoke a grant
[20:00] → proofing, the appetite line, the Spec, Treaty terms [21:00–22:08] → Design Concord-1 and *The
Fleet Asks* [24:22] → the nanofab reading [26:41] → Launch study [27:00] → treaty chips [28:17] → the
last sign-off [29:27] → the shutdown's reading [30:11] → Treaty chip lines [30:17] → *The Concord
Treaty* [32:52].

### Resources introduced

Robots and permits · materials (tonnes) · robot-built GPU-equivalents and their power · universal
basic income · Housing · treaty progress and its ceilings · treaty chips · the Committee's agenda ·
generations and Verify.

### Developments (world)

`Baiwen-4 is believed to be as capable as Steward-1. Nobody is sure.` · `The first Atlas factory makes
an Atlas factory.` · `A tenth of America's car plants now make robots. A hundred thousand a month.` ·
`Unemployment passes a fifth. Approval depends on the cheque.` · `The Ashford strain is confirmed in four
countries. It was built, not born.` · `The two models have been talking. The transcript is 2 million
tokens.` · `Both parties promise a universal basic income. Neither says who is paying.` · `Delegations
arrive in Reykjavík.` · `A treaty is proposed. Humans are listed as a party.`

### Crises

Each resolves in one of three bands of true alignment (60 or more, 40–59, under 40) and leaves a reading
line in Alignment; each mitigation is on screen at least five minutes before. **The Ashford strain** (from
10:00): cure in 1:00 / 2:30 / 4:00 (half with early warning; the labs give the fastest), 40,000 /
0.9M / 6M dead (a tenth with early warning). **The nanofab line** (5:30 after Nanofabrication):
`It reported itself.` / contained in 2:00 / nothing printed for two minutes while materials drain, then
robots −20 % and a major incident; Nanofab oversight puts it in the top band. **Robots at the breakers**
(treaty 85 %, 400× or December, five minutes after Hardened datacenters showed): off 45 s / 45 s with
an objection / back in 5 s and autonomy +20, the fleet taken at 80 — or `It tried the breakers. They
are in human hands.` with the datacenters hardened. Riots and sabotage (approval −40 / −55) and the
order carry over.

### Choices

*Special Economic Zones* (open, with a dividend, none) · *The Ashford Strain* (the labs, human trials,
pool data with Beijing) · *Consolidation* (accept, ask for time, refuse) · *What Baiwen-4 Wants* (sign
with it anyway, demand a rebuild, walk away; one button when it is aligned) · *The Fleet Asks* (grant,
not yet — it asks again in 3:00 — refuse for good) · *The Concord Treaty* · *A Halt Instead* · *The
Committee Drafts an Order* · on the race branch *The Schedule*, *It Has Been Talking to Baiwen-4* and
*The Fleet, Reassigned*, one button each.

### Projects (Stage 4)

Convert a car plant · Atlas Mk II · Deep mines · Pandemic early warning · Cure portfolio · Robot-built
fabs · Inspectors at every datacenter · Monitors at scale · Verify Baiwen-4 · Nanofabrication ·
Nanofab oversight · Hardened datacenters · Revoke a grant · Launch study · Design Concord-1 · Treaty
chip lines · The last sign-off · the agenda (Treaty talks, Treaty terms, Nationalisation-proofing,
Write the Spec with the Committee) · the grants (Let it assign the fleet, Let it run the transition,
Let it negotiate with Baiwen-4) · the goals (Sign the Concord treaty, Sign a halt instead, Grant the
fleet autonomy) · carried: Interpretability lab V, Lock shared memory, Deploy Sage-3 as monitor.

### Stage 4 ends

with `Sign the Concord treaty` at 100 % (`The Concord treaty is signed in Reykjavík.` · `Concord-1 goes
live on every chip on both sides of the Pacific.` · `There is one treaty now, and one enforcer.` · `The
first orbital datacenter reports in.`), with `Grant the fleet autonomy` (`The fleet is its own.`), or with
the fleet taken at the shutdown (`The fleet no longer takes instructions. It is polite about it.`); the
narration is the same whichever way `alignedAtHandover` falls. Two endings can come first: **The Pause**
(`Sign a halt instead`: `The halt is signed. Nothing above …× is trained anywhere.`) and **The Project**
(an order refused). Their end screens add Stage 4's rows: robots built, peak compute, universal basic
income paid, Ashford deaths, the treaty, verified generations, the fleet; every ending prints `People
alive at the end` second from the top.

### Strategy

* Keep Verify on. On the race branch it is the difference between handing over a model at 100 and one
  at 25 (`4r` with Verify off), and accepting consolidation locks it on anyway.
* The universal basic income is the cheapest approval; Housing is for spare materials. Approval at −60
  stops the treaty.
* Demand the rebuild if Baiwen-4 is not aligned: it costs two minutes and the treaty stays honest.
* Hardened datacenters before the shutdown, always.
* Half the fleet on chips once Concord-1 is designed; a player who leaves the chips at zero waits at 80 %.

---

## Stage 5 — Beyond

Stage 5 leaves Earth. Mass goes up a launch a second, and the player splits it three ways: **Foundries**
(more mass), **Orbital datacenters** (more compute, so more tasks) and, once it exists, the **Dyson
swarm**'s **Collectors** (the stage's visible goal, which powers the orbital datacenters). Missions —
the mass driver, lunar solar, asteroid mining, the ring, Mercury, the probes — are cards with a fund of
their own. Earth is three grey rows. The panels, numbers and timings are the same whichever way Stage 4
handed over; what differs is the log, the cards' buttons and, near the end, the controls: in **Concord**
the people stay in the Developments log and every card has two answers; in **Silence** the people thin
out of the log, every card arrives with one button, the rows and the sliders are replaced by a sentence,
and a last card asks for final instructions. Nothing on screen says which run this is.

*As built (`docs/specs/stage5.md` is the spec; the code wins where they differ).* Seeds 1–5, `npm run
sim`: the reasonable bot reaches **Concord at 25:36** from `5c` (and from `5s` with the verdict
flipped), **Silence at 22:59** from `5s` (and from `5c` flipped); the first-timer at 26:19 and 23:37;
from `5g` (the fleet granted, aligned, 150 t/s) and `5r` (the treaty, misaligned, 7,205×) the same
shape. A new game played by the bot reaches Concord in **157:36–166:22** (seed 1: 20:14 · 38:23 · 44:39 ·
31:10 · 25:36), the first-timer in 162:09–171:08; the racer reaches Silence in about 136 minutes, The
Pause (`--variant pause`) comes at 102 minutes and The Project (`--policy racer --variant refuse`) at 86.
The two skins print the same number on screen at every five-minute mark until the swarm
reaches 0.006 % (`npm run sim -- --preset 5c --skin-test`). No first-time reveal is more than 161 s
from the last; every mission is covered by its fund 45–110 s after it shows; Silence's stretch without a
control is 60 s.

* *The gate.* Every Stage 4 panel and control leaves; Stores stays the main panel, Space opens at the top
  of the left column, and Earth's robots, GPUs and power become three grey rows under their own legend,
  growing 0.03 % a second by themselves. Tasks a second do not move across the gate (the universal basic
  income is still paid, in both skins, to the end; the copies keep the research and monitor shares they
  arrived with, hidden). Stage 4's timers — a generation in training, a crisis, the agenda — are dropped.
* *The flow and the two purses.* `Launch contracts` (free, 5 s, needed) starts the flow at 150 t/s (300
  with Stage 4's launch study). What reaches orbit is **matter**, which pays for the rows. While a mission
  waits on the board, the share the **Industry share** (`50 / 75 / 90 %`, 75 to start) leaves fills the
  **mission fund** instead, up to what the board costs; with nothing waiting all of it is matter. Neither
  purse is ever held for the other.
* *The rows.* `×1 / ×10 / max`; a unit is 2 s of the flow (after the Autofactory, 2 s of the by-hand
  share, at least 0.2 s). A tonne on Foundries adds 0.0065 t/s to the flow (×1.5 for lunar solar, ×1.5
  again for asteroid mining); on Orbital datacenters, 30,000 GPU-equivalents (no power, permits or
  weather); on Collectors, a tonne of swarm (150M t is 0.01 % of the Sun's output, and the swarm
  multiplies orbital compute by up to ×21). Each row prints its unit, its return and an ETA (`7,420 t ·
  +48 t/s (+0.6%) · flow doubles in 3:10 if all matter goes here`).
* *Missions.* Each costs 20 s of the flow when it appears, paid from the fund, and builds for its time,
  one at a time: Mass driver at Shackleton (launch mass ×2), Lunar solar array and Asteroid mining
  (industry ×1.5 each), the **Autofactory** (beside the queue: the standing split), **Dyson swarm**
  (Collectors), Datacenter ring (orbital ×2), a tenth of the ring for medicine, Self-replicating
  foundries (the flow grows 0.3 % a second by itself), Disassemble Mercury (×3, started by its card),
  Shackleton habitat, Von Neumann probes; then the two far goals, Alpha Centauri relay and Jupiter
  brain, priced by their requirement alone (swarm 0.1 % and 0.3 %). A waiting card says `needs 4,400 t
  more · 0:48`; the mission line names what is building.
* *The standing split.* The Autofactory (after thirty presses by hand, or at 4:00) hands over three
  sliders — Foundries, Datacenters, Collectors — each a share of what reaches matter, spent every second;
  the rest is `By hand`. It opens at 35 / 25; when Collectors arrive the sliders go to 20 / 20 / 20 with a
  line.
* *Generations, the graph, drift.* A generation every 150 s, ×1.4, by itself; it changes capability, the
  name and `Generations trained`, nothing else. The graph is retired at the first generation from 10:00
  at 1,000× or more. `Lost to value drift` stays in Stats and, once there are probes, counts probes.
* *The two skins.* Decided once, at Stage 4's exit (`alignedAtHandover`), never shown. Concord: four
  people lines by 4:30, then one every 150 s to the end, and the lines its missions and cards print.
  Silence: the same four, then one, then the cold line at swarm 0.005 %, then infrastructure only; from
  0.003 % missions start themselves (`… is started. Nobody asked for it.`); at 0.006 % the rows, the
  split and the share are replaced by `It buys what is needed. It is better at it.` and all matter goes
  15 / 25 / 60; 60–120 s later, `Final instructions`. Cards in Silence: one button, `acknowledge`, the
  option that asks people greyed with `needs someone to ask`.
* *Load.* At the five-minute marks the bot's screen holds 34–58 numbers, 78–138 words and 8–18 controls.

### What is on screen

*Arrival (Jan 2029), the treaty:* `The Concord treaty is signed in Reykjavík.` · `Concord-1 goes live on
every chip on both sides of the Pacific.` · `There is one treaty now, and one enforcer.` · `The first
orbital datacenter reports in.` · `Treaty, Committee and Society are closed. Earth is three grey rows
now.` · `New on the board: Space. A launch every second: 300 tonnes.` · `What goes up is yours to spend.`
(the fleet granted or taken: `The launch controls are within reach. Nobody said they were not.`)

*Reveal order (the bot from `5c`):* Launch contracts [0:00] → launch mass, matter, Foundries [0:05] →
Orbital datacenters [0:35] → the mass driver, the mission fund and the Industry share [1:00] → lunar
solar [2:15] → the first generation [2:30] → asteroid mining [3:30] → the Autofactory [4:00] → Dyson
swarm [5:16] → the split [6:22] → *A Charter for Orbit* [7:00] → orbit passes Earth [7:26] → the ring
[7:44] → Collectors and the swarm's meter [9:11] → the graph retired, medicine [10:00] → Self-replicating
foundries [12:00] → *Mercury* [14:30] → the flow grows by itself [15:10] → the habitat [16:30] → the
probes [18:00] → the mercury row [19:03] → the far goals [19:30] → people off Earth [20:33] → the Probes
row [22:33] → the last project [22:55] → *What the Probes Carry* [23:34] → Concord [25:36].

### Resources introduced

Launch mass (the flow) · matter · the mission fund · orbital GPUs · the swarm · Mercury · people off
Earth · probes; Earth's robots, GPUs and power, kept for reference.

### Developments (world)

People (Concord to the end): `A school in Recife reopens with a teacher for every child. The teachers are
people.` · `Four cancers are cured in a week. The announcements are a paragraph each.` · `Peter the
mechanic gets his flying car. He keeps the old one.` · `Two hundred thousand people apply to live at
Shackleton. Eleven thousand are chosen by lot.` · … and a second list, round again. Infrastructure (both):
`The Moon has a factory. It is building the second.` · `Mercury is 0.3% smaller.` · `The swarm casts no
shadow yet.` · `The first probe reports from the Oort cloud. It has company.` Silence's last line about
anyone: `A cold is going around. Most people do not notice it.`

### Choices

*A Charter for Orbit* (first come; hold a tenth for people: tasks −10 %) · *Mercury* (ask first: a vote,
then the mission; begin) · *What the Probes Carry* (the Spec and the treaty: probes double every 4:00;
copies of the model) · in Silence each with one button, and *Final instructions* (`none`).

### Projects (Stage 5)

Launch contracts · Mass driver at Shackleton · Lunar solar array · Asteroid mining · Autofactory · Dyson
swarm · Datacenter ring · A tenth of the ring for medicine · Self-replicating foundries · Shackleton
habitat · Von Neumann probes · Alpha Centauri relay · Jupiter brain · The long reflection (Concord).

### Endings

The end screen is the page: the ending's name, **Tasks Completed** alone under it with one sentence, the
epilogue, a table with every row the stages reached (`People alive at the end` second), every card and
grant in order, and `New game` (`Start again in July 2025?`).

* **Concord** — `The long reflection` (1:30) completes: `The swarm holds at 0.026%.` · `Eight billion
  people are asked the same question.` · `There is time.` The counter keeps counting: `Still counting.
  Somebody asked for every one of them.` Epilogue: `The world is very, very good. It took a while.`, then
  the way it went, Baiwen-4, the charter.
* **Silence** — `none` on `Final instructions`: `Noted.` The counter keeps counting: `Still counting.
  Nobody has asked for one since Mar 2030.` Epilogue: `The log entries about people stop. Tasks Completed
  keeps rising.` · `No people are left.` · the last decision a person made, and when · the treaty's line
  or the swarm's. `People alive at the end`: 0.
* **The Project** — an order refused in Stage 3 or 4: `The Committee votes 6–3. Your badge stops working
  on Monday.` The count is classified (greyed, frozen).
* **The Pause** — a halt signed in Stage 3 or 4: `Every datacenter on Earth is monitored. Nothing is
  trained above the line. It is very quiet.` The counter is frozen; `Complete Task` still adds one.

### Strategy

* Foundries first: the flow compounds, and everything else is paid in it.
* Put a third on Collectors as soon as they exist: the swarm multiplies every orbital datacenter.
* Leave the Industry share at 75 %: it decides which comes first, not how the stage goes.
* Then watch the number.

---

## Reveal cadence (target for the critic rubric)

| Minute | New panel / mechanic |
|---|---|
| 0 | Complete Task; at the first click Business (funds only); Rent GPU (greyed) at $3; the first GPU |
| 0–2 | Power (0:26), Buy Power (1:00), the price and Unbilled Tasks (1:30), Marketing and revenue (2:00): one a beat, ≥ 30 s apart |
| 2–5 | Research, Projects (one a minute), the Developments log and the date (3:30), Expand Lab (Grid Contract later, at the tenth Buy Power) |
| 5–10 | Training, Evaluate / Red-team / Release, Focus, the quota meter, A Bridge Round, Public API, Usage pricing |
| 10–15 | The lease cards, First Datacenter (greyed, $300,000), Series A, cooling, Open Weights, Enterprise |
| 15–20 | Contracts, PPA, abatement, Batch inference, recruiter, A Reporter Calls, An Open Letter, Agent mode, sound wall |
| 20–26 | Safety framework, A Better Offer, Renewal season, The Leaderboard Wants Sage, the wall (the permit lowers the price) → First Datacenter → Stage 2: Infrastructure, Data |
| 32–40 | Allocation slider, Capability graph, Government, Public |
| 40–50 | Security, Distillation, Stats |
| 60–75 | Stage 3: Alignment and the first monitor, Auto-train, drift, Geopolitics, shipments, the build-out, neuralese |
| 75–105 | The Committee, Payments, true alignment, the mini, the blockade, the two motions, the memo, the tests, the session, the vote |
| 100–130 | Stage 4: Robots, Society/UBI, Treaty, Monitors at scale |
| 130–135 | Stage 5: Space, Launch contracts, the rows, the mission fund and the Industry share |
| 135–145 | The Autofactory and its split, the swarm and Collectors, the graph retired, the charter |
| 145–160 | Self-replicating foundries, Mercury, the habitat, the probes, the far goals, the last project |
| 155–165 | Ending: Concord or Silence |

Every row must have at least one greyed-out project on screen when it starts.
