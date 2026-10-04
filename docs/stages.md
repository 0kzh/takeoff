# Stages

*Written in the format of the Universal Paperclips wiki's [Stages](https://universalpaperclips.fandom.com/wiki/Stages) page. This is the plan the implementation follows; numbers are targets to be validated with the headless simulator (`npm run sim`).*

The gameplay of **Takeoff** takes place over five **stages**. The stages limit which projects can be launched, and each has a distinct play style. The first stage is roughly analogous to running a small API business. The second is a datacenter and power-management game. The third is a race with a hidden variable. The fourth is a negotiation you may or may not be part of. The fifth is space.

The player is never told which stage they are in and is never told how many there are.

## Summary

| Stage | Name | In-game dates | Target wall clock | Analogy | Exit condition |
|---|---|---|---|---|---|
| 1 | The Startup | Jul 2025 → Dec 2025 | 25–35 min | UP Stage 1 (manufacturing + business) | **Break ground** at Abilene (the fourth rung of the site ladder) |
| 2 | Scale | Jan 2026 → Dec 2026 | 35–45 min | UP Stage 2 (power management) + GDS loop | Reach **superhuman coder** (capability ≥ 4×) |
| 3 | Takeoff | Jan 2027 → Oct 2027 | 40–50 min | The AI-2027 "race" chapters | Reach **superhuman AI researcher** (≥ 25×) **and** make the Committee choice |
| 4 | Superintelligence | Nov 2027 → Dec 2028 | 30–40 min | AI-2027 branch chapters | Treaty signed, or autonomy granted, or nationalized |
| 5 | Beyond | 2029 → 2030+ | 20–30 min | UP Stage 3 (space), compressed | Ending |

Total: ~2.5–3.5 hours for a reasonable player; 4 hours for a cautious one.

---

## Stage 1 — The Startup

The first stage is by far the simplest. OpenMind has a model, a cloud bill, and no customers. You manage **Funds** against the market for completed tasks, buy **Power** (kWh) in blocks whose price drifts, and rent **GPUs** so that copies of the model complete tasks without you clicking. Then you hire **Researchers**, who turn **Trust** into **Research** points, which buy the projects that lay the technical backbone of the later stages, and you run your first **training runs**. The last third of the stage is the **Abilene site**: reserve the land, wait out the interconnect queue, build the substation, break ground. If you run out of money with no power, the game lets you **Ask the cloud provider for credit** in exchange for Trust rather than losing the game, and the **Complete Task** button never needs power.

*As built after critic round 2 (`docs/critic-stage1-round2.md`): the reasonable bot breaks ground at **26:34–27:32**, the first-timer at **28:39–31:44**, the greedy player at 30:59–36:56 (seeds 1–5). What changed from the plan below:*

* *Contracts are customers.* Each **Custom model contract** (repeatable, double border) adds 25 % to demand at whatever price you set (×1.15 per contract), so price, hype, marketing and incidents reach most late income; an incident pauses every contract customer for 1:30 (stacking) and costs 1 Trust; a release earns +1 Trust only with no open issues. Stage 2 freezes the contracts' share of sales as a fixed rate.
* *Decisions show their stakes.* Every modal option has a second line with its effect and cost, sized when the modal opens (a bridge worth a quarter of the next rung, a poach match worth a minute of revenue), and every modal has a timer with a harmless default. The selected **Focus** prints its trade under the buttons.
* *Price.* Steps are a cent below $0.20 and 5 % above. **Dynamic pricing** (AUTO) is a card offered after 20 price moves once tasks pass 90,000, or to anyone at 400,000 tasks.
* *Pacing.* Cards come one a minute until the Training panel, then every 30 s, four on screen (a card that has waited 140 s comes out anyway); mid and late research cards cost at least 100 s of the research rate, side offers 45–100 s of revenue, fixed when they appear. `GPUs rented: 66 / 80`; **Second cloud region** and **Reserved capacity** add 20 each. Break ground costs $185,000 ($145,000 with the contractor, whose crew needs 1:00); the interconnect queue is 4:00; the tax abatement costs 1 Trust.
* *Fewer things at once.* One flavour line per run; console lines carry a number or an instruction; five Developments shown. Minute 10 holds 37–38 numbers, 14–15 controls and 212–229 words.
* *Dead ends.* The research wall is re-said every 2 minutes while it lasts; the idle guard names an under-staffed lab before offering money; a prepayment buys the cheapest thing on screen; at most three press releases and three emails a stage. When Train is grey its reason names the resource and the time (`research — about 0:45`).

*After the Stage 2 critic's round 1 (C12, C13; the harness's first-timer had taken 39:16 with Interconnect on screen for twelve minutes):* the reasonable bot breaks ground at **26:04–26:42**, the first-timer (sim) at 27:00–28:56, the greedy player at 26:56–31:41, the train-first player at 27:01–30:28; the harness's first-timer at **30:30–33:40** (seeds 1–3), no rung on screen longer than 5:34, no reveal gap over 140 s.

* *The income step never waits on out-saving a card under a pinned rung.* **Enterprise sales team** costs 6,000 research (at least 100 s of the research rate); the first **Custom model contract** comes a minute after **Series A** even without it; Usage-based pricing, Batch inference, Agent mode and Dynamic pricing (5,000 research) are drawn urgent while they are the card that shortens the rung.
* *Rungs within reach.* List prices are $50,000 / $100,000 / $150,000 / $230,000 (substation money only). A rung unaffordable for 3:30 drops its price once to what the lab can reach in a minute (`Reserve the Abilene site: the county wants the jobs. The price drops from $50,000 to $31,500.`). A rung more than four minutes away names the card that shortens it, every three minutes (`Interconnect queue is 6 minutes away at $210/s. Enterprise sales team shortens it.`). Money side offers wait while the next rung is unaffordable (the expedite, the contractor and the abatement shorten it, and do not wait).
* *Trust pace.* The next Trust milestone is never more than 2:30 of tasks away in Stage 1.
* *Cards as goals.* Insight cards cost 40 / 60 / 100 (blog post, demo, workshop paper); Lease the floor upstairs waits until the lab has been full for 1:30 (the Experiment tracker is the first fix); a card never lands in the same beat as a release (the panel redraw). Reveal → purchase medians: bot 64–84 s, first-timer 65–89 s; the densest six minutes after the opening screen hold 16–18 first-time reveals.

### What is on screen

*Minute 0:* black console (`Welcome to OpenMind.`), `Tasks Completed: 0`, the date `Jul 2025`, one enabled button — **Complete Task** — and, greyed out with its price, `Power: 1,000 kWh` / **Buy Power — $20.00**.

*Reveal order (triggers, not timers). Typical minute as `bot / naive` (median of seeds 1–5, `npm run sim`):*

1. **Business** after the first task, **Marketing** greyed at $100 from the first sale [0:00–0:01] — `Available Funds`, `Unbilled Tasks`, `lower / raise`, `Price per Task $0.25`, and the billing line `Billing 2.0/s of 4.0/s produced: backlog growing`. The market starts near Paperclips' size and grows with tasks completed (word of mouth, full at 1,500 tasks), and the first 200 tasks bill at their expected rate (no lucky or unlucky opening), so a player clicking at 4/s sees the backlog build and fixes it by lowering the price.
2. **Compute** at $3 or 20 tasks [0:04] — **Rent GPU — $6.00** (UP's `5 + 1.1^n`); first GPU [0:09 / 0:12]. The provider rents at most 80 (100 after the Bulk GPU lease); at the quota the button greys with `quota reached — the provider has no more to rent` and the Abilene site appears as the way past it.
3. `Avg. Rev. per sec` at 300 tasks sold [1:35]; the **Developments** column [1:40 / 1:29].
4. **Research** at the first Trust milestone (2,000 tasks) [3:20 / 3:04] — `Trust`, `Next Trust at`, **Hire Researcher**, `Researchers`, `Research x / 1,000`. **Expand Lab** when research first nears its cap [3:43 / 3:27].
5. **Projects** 40 s after Research [4:00 / 3:44]. Triggered projects wait in a queue and arrive in table order (one a minute until the Training panel, then every 30 s), four on screen at most (the next step of a ladder, e.g. Chain-of-thought after Better Prompting, appears at once; rescues, the stage goal, a wall's named fix and the Abilene side-offers do not wait for room).
6. **Grid Contract (2,000 research)** [shown 4:30, bought ≈ 5:00]: it tops power up whenever it falls below 60 % of a block. **Buy Power** stays on screen with its price as the manual fallback. Blocks grow with the fleet (10,000 kWh at 20 GPUs, 100,000 at 200; short of money, the button sells the biggest block you can afford).
7. **Training Pipeline (2,000 research)** at 7,000 tasks [5:34 / 5:11] → **Training** panel: `Current model: Sage-1 · 1.00×`, `Level with Anthrosoft`, **Train Sage-1.1**, `Cost: …`, `Compute: enough · est. 64 s`. The first run trains with the default focus; **Copies running** appears when it diverts half the GPUs.
8. First evaluation and red-team [~8:30], first release [9:09 / 9:38] → the **Focus** row (Capability / Efficiency / Safety, with tooltips). **Public API** 30 s later; **Usage-based pricing** after it.
9. The modal calendar, one about every 3¼ minutes (no two modals open within 150 s, except one the player's own click causes): *A Bridge Round* [11:00], *Open Weights* [14:15], *A Reporter Calls* [17:30], *An Open Letter* [20:45], *A Better Offer* [24:00], *The Leaderboard Wants Sage* [27:15]. *Can I try something?* is offered on at most every other run, three times a stage, and never takes a calendar slot.
10. **Sage writes Sage** (research +25 %) [11:30–12:15]. **Series A** (free, +$20,000) at 60,000 tasks and a release [14:02 / 11:58] → **Reserve the Abilene site ($40,000)** and **Enterprise sales team**; the sales team brings **Custom model contract** (research → recurring revenue, the `Contracts: $/s` line).
11. October [15:00]: **Batch inference**; an API outage (console and Developments) [16:00]; **Hire a recruiter** [17:30]; **Lease the floor upstairs** when the next run needs more research than the lab holds.
12. **Abilene site reserved** [18:36 / 22:19] → the **Abilene** panel and **Interconnect queue ($80,000)**; **Closed-loop cooling** 30 s later.
13. November [20:00]: **Agent mode**; [22:30] **Publish a safety framework**; **Renewal season** (contracts pay 25 % more) once contracts exist.
14. **Interconnect queue** bought [23:04 / 24:34] → a named wait (`The Interconnect Queue — 4:00 until the utility signs off.`, `Interconnect: 3:59` counting down) and **Substation ($120,000, 8,000 research)** greyed until it ends; **Pay to expedite** 25 s in; **Power purchase agreement** a minute in; **Take the county's tax abatement** (−$20,000 on the substation, 1 Trust) when the queue clears.
15. **Substation** [26:20 / 27:06] → `Substation: 5 MW` and **Break ground ($185,000)**; **Hire a general contractor** (−$40,000 on Break ground, its crew on site after 1:00) 45 s later; **Build a sound wall** 100 s later.
16. **Break ground** [~27:00 / ~29:45] → Stage 2.

Every trust gain says what it is for (`Trust +1. Hire a researcher or expand the lab.`); every public release earns +1 Trust; the console names each wall and the fix on screen (`The Research Plateau — the next run needs 10,771 research. The lab holds 8,000. Rent desks across the street.`, `Nobody buys at $2.25. Lower the price.`). If the lab cannot hold the next run, the Experiment tracker or Lease the floor upstairs appears at once; with no Trust and neither available, **Rent desks across the street** (repeatable, $1,000 doubling) appears within 45 s.

### Resources introduced

Tasks Completed, Unbilled Tasks, Funds, Power (kWh), Compute (GPUs rented, up to the quota), Copies, Hype (Marketing level), Trust, Research, Insight, Contracts ($/s), the Abilene site (interconnect, 5 MW).

### The bottleneck rotates

price → power → research cap → funds → compute (training, then the rental quota) → funds again. Each has a visible fix (see design.md §6).

### Training in Stage 1

Costs depend on the capability `c` the run starts from (the best model so far), not on how many runs came before — one function of `c` for the whole game, the Stage 2 spec's constants from 1.6× up (stage2.md §2.5):

| | formula | 1.0× | 1.3× | 1.5× | 1.65× |
|---|---|---|---|---|---|
| research | `21,000 × (c/1.6)^5` | 2,000 | 7,500 | 15,200 | 24,500 |
| funds | `$25,000 × (c/1.6)^8` (`^9.5` below 1.6) | $290 | $3,500 | $13,500 | $32,000 |
| GPUs wanted | `1,000 × (c/1.6)^7.5` (`^10` below 1.6) | 9 | 125 | 520 | 1,260 |

`have` = half the active GPUs (× 1.5 with Distributed training); yield = `clamp(√(have / wanted), 0.3, 1)` — every run keeps at least 30 % of its nominal gain; duration = `clamp(120 × √(wanted / have), 45, 120)` s. Nominal gains: Capability +12–18 %, Efficiency +5 % and 25 % more copies per GPU, Safety +5 % and alignment. The idle readout says what the run will get (`Compute: 59 of 168 GPUs wanted · undertrained (59%)`, tooltip "More GPUs train a better model"); once the run wants three times what the fleet can give, it adds `Rented GPUs can't keep up. A datacenter of your own would.` (`… Abilene will.` once the site is reserved). Stage 1 ends around **1.6–1.7×** after five to seven runs (still Sage-1.x; Sage-2 at 2×). Anthrosoft's Cadence models stay within 0.85–1.15× of the deployed Sage; the panel says whether you are ahead (its number is in the tooltip until the Stage 2 graph).

### Projects (Stage 1)

Better Prompting · Blue-sky Research · Grid Contract · Chain-of-thought · Training Pipeline · Seed round · Research blog post · Experiment tracker · Tool use · Hire an evals team · Public API · Launch demo video · Bulk GPU lease · Second cloud region · Reserved capacity · Dynamic pricing · Usage-based pricing · Sage writes Sage · Distributed training · Alignment team · Series A · Reserve the Abilene site · Enterprise sales team · Custom model contract · Batch inference · Lease the floor upstairs · Hire a recruiter · Closed-loop cooling · Interconnect queue · Pay to expedite the interconnect · Power purchase agreement · Agent mode · Publish a safety framework · Renewal season · Take the county's tax abatement · Substation · Hire a general contractor · Build a sound wall · Break ground · Workshop paper · Conference keynote · Mixture of experts · (rescues) Ask the cloud provider for credit · Rent desks across the street · Press release.

### Choices (Stage 1)

Can I try something? (≤ 3) · Ship With Open Issues? (the first time only, on the player's click) · A Bridge Round · Open Weights · A Reporter Calls · An Open Letter · A Better Offer · The Leaderboard Wants Sage · (rescue) A Customer Writes. Seven to nine in a stage, never two within 150 s.

### Stage 1 ends

when you buy **Break ground**. The console keeps its last four lines and prints, two seconds apart: `Ground broken outside Abilene. 2026 begins.` · `The 87 rented GPUs go back. Deposit returned: $34,800.` · `Power is capacity now, not a bill: 5 MW on site, 1 MW per 1,000 GPUs.` · `1,000 Nimbus G4s racked. Tasks per second ×12: the copies run on hardware OpenMind owns.` (the Stage 2 build moves the racking into the free `Unpack the first shipment` project). The date snaps to **Jan 2026**. **Buy Power**, **Rent GPU** and the Abilene panel disappear; **Infrastructure** replaces them, with **Buy GPUs (1,000)** affordable from the deposit. Projects that only made sense in Stage 1 are retired by name (`Left in the cloud: …`); the rest carry over. Trust is at least 2 and the lab has room for 1.25 × the next run.

### Strategy

* Click, and lower the price until the backlog stops growing. Raise it again while it says *selling out*.
* Rent GPUs while they pay back within a few minutes; the provider stops at 80 anyway. Buy the Grid Contract as soon as you can hold 2,000 research.
* First Trust → researchers; expand the lab when the console says the research wall is in the way.
* Train Capability while the run gets most of its compute; once it says *undertrained*, Efficiency (more copies per GPU) pays better — the datacenter is what trains the next big model.
* Release with open issues once, to see what happens. The incident is traced back to the release.
* Save for the Abilene rungs, but buy the revenue projects (Enterprise sales team, Batch inference, Agent mode, contracts) on the way: they make the next rung come sooner.

---

## Stage 2 — Scale

*As built (`docs/specs/stage2.md` is the spec; the code wins where they differ), after the critic's round 1 (`docs/critic-stage2-round1.md`, C1–C11). Times are seeds 1–5 from the Stage 2 preset: the reasonable bot **36:28–39:24**, the sim's first-timer 37:51–39:28, greedy 38:24–41:08; from a new game the bot takes 37:52–42:17. The critic harness's first-timer (seeds 1–3) takes **39:34–40:32**; no enabled purchase in 28–30 % of its 2-s checks, two or more affordable in 40–47 %, 14–22 % of the stage after 10:00 inside click gaps of 30 s or more, no release interval over 4:52.*

OpenMind owns its datacenters. Compute is bought in lots and needs **room** (datacenters) and **power** (plants, some of them behind an **interconnect queue**). The market is priced on **AUTO**: it falls to clear what the copies make, so revenue grows with the square root of supply until a better model or a wider market lifts it. From the second run, training wants **data** as well as research and money, and the public web runs out. Copies are split between tasks and research with a **slider**, and the human share of research falls toward nothing. The world arrives as meters: **Government**, **Public** (approval, jobs), **Security**, and an **alignment** number that is measured, not known.

### What changes on screen

*Removed on arrival:* Buy Power (kWh), Rent GPU, Compute, the Abilene site ladder, the price buttons and the AUTO toggle, Custom model contracts (the signed ones keep paying a fixed rate).
*Added on arrival:* **Stores** (A Dark Room's box: funds, research, insight, Trust, GPUs, power capacity, copies, data; hover any row for its sources and sinks per second), the rebuilt **Infrastructure** panel, a read-only price line (`Price per task: $0.34 (auto)`).
*Added later, in this order (typical):* Train now ~0:15–4:00 · gas turbines 2:00 · capability graph 2:00 · datacenters 2:30 · solar 3:00 · the research slider 3:30 · the bigger lots as the fleet grows into them · keep-internal releases ~6:00 · Government ~8:00 · Public ~12:00 · Security ~16:30 · nuclear and the interconnect queue ~16–18 · second pipeline ~17 · job-transition fund ~22 (the governor may bring it forward) · the theft warning and Security level 3 ~22–26 · shared evaluations ~29–30 · Stats with the Dashboard ~30 · the G6 pre-order near the exit · alignment compute from 3.46× (the run that should cross 4×).

*At 390 px* the Infrastructure and Research panels come right after the Stores in Stage 2 (the lots, Train and the slider within the first screen and a half). The event panel opens beside the Stores, not over the funds it prices.

### The economy (as built)

* **GPUs**, three buttons side by side, each with what it adds at today's market (`Buy GPUs (1,000) $120,000 +$244/s`): the main lot buys up to 1,000 in hundreds with the money there is (so the growth verb is never a goal the player waits on), the 5,000 and 25,000 lots join as the fleet grows into them. $120 per G4 (G5s after the *Nimbus G5 order*). The lots keep in hand, and say so: the next run's price once only money is missing and the cluster gives 70 % of the compute it wants (`the run first — 0:27`), an open offer, the price of the nearer wall's fix while that wall is under a minute of income away (`the hall first`, `the plant first`; `keeps the next hall's price` beside the lot), and an urgent card's price (`Experiment scheduler first`). The *Standing order* is a share of income (25 / 50 / 75 / 100 % / off) that fills in when the player has not ordered for 20 s, keeping the same reserves. Each GPU draws 1 kW. Prices are in units of the arrival revenue (`S2_FUNDS_SCALE` 2.4).
* **Datacenters**: 10k, 15k, 25k, 50k, 75k, 125k … slots for $0 (Abilene), $192k, $384k, $840k, $1.7M, $3.4M …; a hall takes 1:30 to build (a minute more under approval −30), one at a time, and opens a quarter at a time; the build time is printed when room is the wall.
* **Power**: gas +20 MW at once ($144k, ×1.7 each); solar +50 MW after 3:00 in the interconnect queue (0:30 behind the meter, halved again at relations 80; two at a time); nuclear +500 MW in two minutes; Al-Marsa +1,000 MW in 2:00, priced at a minute of revenue when the offer opens. No plant is ever locked "to spare"; the row says when power is the wall.
* **Market**: customers take `market × (0.25 / price)²` tasks a second; AUTO walks the price to clear output plus a thirtieth of the backlog. `Market flooded` names the fall; a manual price above the market prints the share billed and the clearing price, and finance puts AUTO back after five minutes.
* **Research**: researchers (capped by capability) plus `10 × √(copies on research) × capability^1.5` from the copies; the slider runs 5–50 %. The lab's capacity grows with the Research cluster, Experiment scheduler and Checkpoint farm (×4 each); insight trickles in below capacity.
* **Training**: research, funds (`$29,000 × (c/1.6)^7` at scale 1) and (from the second run) data, `1.5 T × (capability / 1.6)³`; the whole fleet trains; 45–120 s; a second pipeline after *Parallel pipelines*. Eleven or twelve runs, capability 1.64× → 4.0–4.2×. **Train now** (when only money is missing and the full run is 30 s or more away, with at least 40 % of its price) starts the run on the money there is and keeps the square root of that share of its gain (`$1.2M · keeps 77%`). When Train is grey its reason names the binding shortfall and the time (`short $1.7M — about 0:26`, `waiting for the pipeline`, `evaluation month — 0:40`), and the cards that answer a wall (`needs 11.6 T data — Synthetic data, License the code hosts`; `needs 217,000 research; the lab holds 208,000 — Experiment scheduler`); those cards are drawn urgent, and the wall is named again every three minutes while it holds. A run within 2 % below a tier (2×, 3×, 4×) is called the tier.
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

Stage 3 marks the first time the game is not about revenue. Your models now do most of the research and soon all of it; **Auto-train** turns the training loop into an `Approve` button, and later into nothing. The **Lead over Baiwen** counter and the **Capability graph** become the things you watch. **Alignment** is split into *apparent* and *true*; **Interpretability** projects reveal the second one, and the **Neuralese** project — advertised in the log for minutes before it unlocks — raises capability and lowers interpretability. The **Oversight Committee** forms. In October the memo about Sage-4's misalignment is written, and you decide whether the Committee sees it. The stage ends with the Committee's choice: **slow down** (the Steward program) or **race** (Sage-5).

### What changes on screen

*Removed:* Marketing, Hire Researcher, Expand Lab.
*Added:* **Alignment & Interpretability**, **Security** (full), **Geopolitics** (Baiwen, Anthrosoft, Lanzhou CDZ, Taiwan), **Allocation** gains a *Monitors* share, **Oversight** (committee mood).

### Resources introduced

True alignment (hidden → revealed) · Interpretability level · AI R&D multiplier (shown as `Research speed: 25× human baseline`) · Monitors (old generations assigned to watch the new) · Committee mood.

### Developments (world)

`Jan 2027 — Sage-3.4 never stops learning.` · `Feb 2027 — Weights of Sage-3 exfiltrated. Beijing denies.` · `Mar 2027 — A breakthrough in the model's internal language. The researchers can no longer read it.` · `Jun 2027 — A country of geniuses in a datacenter.` · `Jul 2027 — Sage-3-mini is released. Approval −35.` · `Aug 2027 — The White House drafts contingency plans. A strike on Lanzhou is on the list.` · `Sep 2027 — Sage-4 proposes its own successor. The proposal is 40,000 pages. Nobody has read it.` · `Oct 2027 — The memo leaks.`

### Crises

Weights theft (if SL < 3) · Rogue copy / **AI hacking** (if true alignment < 50 and no monitor) · **Riots & datacenter sabotage** (approval < −40) · **Taiwan blockade** (chip price ×3) · **Iran strikes Al-Marsa** (only if you built it) · **Nationalization** (gov < 20 at capability ≥ 10×, or memo buried & leaked) — *this is an ending*.

### Choices

*Neuralese vs transparent chain-of-thought.* · *Deploy old generations as monitors.* · *Share evals with the Committee.* · *Report the misalignment finding or bury the memo.* · *Human sign-off on training (−lead) or let it run.* · ***Slow down (Steward) or race (Sage-5).*** · *The Pause (sign a halt treaty — ending).*

### Projects (Stage 3)

Neuralese recurrence · Transparent chain-of-thought · Interpretability lab I–V · Deploy Sage-N-1 as monitor · Security SL4 · Security SL5 · Share evals with the Committee · Lobby Congress · Chip stockpile · Formosa second source · Domestic fab (planning) · Report misalignment finding / Bury the memo · Steward program / Race: Sage-5 · Enterprise agents · Government cloud · Treaty talks · Auto-train · Autonomous research.

### Stage 3 ends

when a model reaches **25×** (superhuman AI researcher) **and** the Committee choice has been made. The business panel — funds, price, demand — disappears: `The model runs the business now. It is better at it.` The **Training** panel collapses to a single status line. The date snaps to **Nov 2027**.

### Strategy

* Interpretability before Neuralese, or never take Neuralese. The capability bonus is large and the alignment penalty is hidden.
* Monitors cost 15 % of compute and are the single best alignment investment in the game.
* Report the memo. You lose two months of lead and gain the only ending in which humans are consulted.
* If you race: buy SL5 and Nationalization-proofing or the Project takes the lab in Stage 4.

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
| 0 | Complete Task, Power, Buy Power (greyed), Business, Marketing (greyed), Rent GPU |
| 1–2 | Avg. Rev. per sec, Developments log |
| 3–5 | Research, Expand Lab, Projects (one every 15 s), Insight, Grid Contract |
| 5–10 | Training, Evaluate / Red-team / Release, Focus, Public API, Usage pricing |
| 10–15 | A Bridge Round, Sage writes Sage, Series A, Abilene site (greyed), Enterprise, Open Weights |
| 15–20 | Contracts, Batch inference, recruiter, A Reporter Calls, Abilene panel, cooling, Agent mode |
| 20–27 | An Open Letter, safety framework, interconnect queue (named wait), expedite, A Better Offer, PPA, Renewal season, abatement, Substation |
| 26–31 | Break ground, contractor, The Leaderboard Wants Sage, sound wall → Stage 2: Infrastructure, Data |
| 32–40 | Allocation slider, Capability graph, Government, Public |
| 40–50 | Security, Distillation, Stats |
| 55–70 | Stage 3: Alignment, Interpretability, Geopolitics, Auto-train |
| 70–100 | Neuralese, Monitors, Committee, the memo, the choice |
| 100–130 | Stage 4: Robots, Society/UBI, Treaty, Monitors at scale |
| 130–160 | Stage 5: Space |
| 160–200 | Ending |

Every row must have at least one greyed-out project on screen when it starts.
