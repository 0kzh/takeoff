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

### What is on screen

*Minute 0:* black console (`Welcome to OpenMind.`), `Tasks Completed: 0`, the date `Jul 2025`, one enabled button — **Complete Task** — and, greyed out with its price, `Power: 1,000 kWh` / **Buy Power — $20.00**.

*Reveal order (triggers, not timers). Typical minute as `bot / naive` (median of seeds 1–5, `npm run sim`):*

1. **Business** after the first task, **Marketing** greyed at $100 from the first sale [0:00–0:01] — `Available Funds`, `Unbilled Tasks`, `lower / raise`, `Price per Task $0.25`, and the billing line `Billing 2.0/s of 4.0/s produced: backlog growing`. The market starts near Paperclips' size and grows with tasks completed (word of mouth, full at 1,500 tasks), and the first 200 tasks bill at their expected rate (no lucky or unlucky opening), so a player clicking at 4/s sees the backlog build and fixes it by lowering the price.
2. **Compute** at $3 or 20 tasks [0:04] — **Rent GPU — $6.00** (UP's `5 + 1.1^n`); first GPU [0:09 / 0:12]. The provider rents at most 80 (100 after the Bulk GPU lease); at the quota the button greys with `quota reached — the provider has no more to rent` and the Abilene site appears as the way past it.
3. `Avg. Rev. per sec` at 300 tasks sold [1:35]; the **Developments** column [1:40 / 1:29].
4. **Research** at the first Trust milestone (2,000 tasks) [3:20 / 3:04] — `Trust`, `+1 Trust at`, **Hire Researcher**, `Researchers`, `Research x / 1,000`. **Expand Lab** when research first nears its cap [3:43 / 3:27].
5. **Projects** 40 s after Research [4:00 / 3:44]. Triggered projects wait in a queue and arrive one every 15 s, in table order, four on screen at most (the next step of a ladder, e.g. Chain-of-thought after Better Prompting, appears at once; rescues, the stage goal, a wall's named fix and the Abilene side-offers do not wait for room).
6. **Grid Contract (2,000 research)** [shown 4:30, bought ≈ 5:00]: it tops power up whenever it falls below 60 % of a block. **Buy Power** stays on screen with its price as the manual fallback. Blocks grow with the fleet (10,000 kWh at 20 GPUs, 100,000 at 200; short of money, the button sells the biggest block you can afford).
7. **Training Pipeline (2,000 research)** at 7,000 tasks [5:34 / 5:11] → **Training** panel: `Current model: Sage-1 · 1.00×`, `Level with Anthrosoft`, **Train Sage-1.1**, `Cost: …`, `Compute: enough · est. 64 s`. The first run trains with the default focus; **Copies running** appears when it diverts half the GPUs.
8. First evaluation and red-team [~8:30], first release [9:09 / 9:38] → the **Focus** row (Capability / Efficiency / Safety, with tooltips). **Public API** 30 s later; **Usage-based pricing** after it.
9. The modal calendar, one about every 3¼ minutes (no two modals open within 150 s, except one the player's own click causes): *A Bridge Round* [11:00], *Open Weights* [14:15], *A Reporter Calls* [17:30], *An Open Letter* [20:45], *A Better Offer* [24:00], *The Leaderboard Wants Sage* [27:15]. *Can I try something?* is offered on at most every other run, three times a stage, and never takes a calendar slot.
10. **Sage writes Sage** (research +25 %) [11:30–12:15]. **Series A** (free, +$20,000) at 60,000 tasks and a release [14:02 / 11:58] → **Reserve the Abilene site ($40,000)** and **Enterprise sales team**; the sales team brings **Custom model contract** (research → recurring revenue, the `Contracts: $/s` line).
11. October [15:00]: **Batch inference**; an API outage (console and Developments) [16:00]; **Hire a recruiter** [17:30]; **Lease the floor upstairs** when the next run needs more research than the lab holds.
12. **Abilene site reserved** [18:36 / 22:19] → the **Abilene** panel and **Interconnect queue ($80,000)**; **Closed-loop cooling** 30 s later.
13. November [20:00]: **Agent mode**; [22:30] **Publish a safety framework**; **Renewal season** (contracts pay 25 % more) once contracts exist.
14. **Interconnect queue** bought [23:04 / 24:34] → a named wait (`The Interconnect Queue — 3:30 until the utility signs off.`, `Interconnect: 3:29` counting down) and **Substation ($120,000, 8,000 research)** greyed until it ends; **Pay to expedite** 25 s in; **Power purchase agreement** a minute in; **Take the county's tax abatement** (−$20,000 on the substation) when the queue clears.
15. **Substation** [26:20 / 27:06] → `Substation: 5 MW` and **Break ground ($165,000)**; **Hire a general contractor** (−$40,000 on Break ground) 45 s later; **Build a sound wall** 100 s later.
16. **Break ground** [29:48 / 29:32] → Stage 2.

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

Better Prompting · Blue-sky Research · Grid Contract · Chain-of-thought · Training Pipeline · Seed round · Research blog post · Experiment tracker · Tool use · Hire an evals team · Public API · Launch demo video · Bulk GPU lease · Usage-based pricing · Sage writes Sage · Distributed training · Alignment team · Series A · Reserve the Abilene site · Enterprise sales team · Custom model contract · Batch inference · Lease the floor upstairs · Hire a recruiter · Closed-loop cooling · Interconnect queue · Pay to expedite the interconnect · Power purchase agreement · Agent mode · Publish a safety framework · Renewal season · Take the county's tax abatement · Substation · Hire a general contractor · Build a sound wall · Break ground · Workshop paper · Conference keynote · Mixture of experts · (rescues) Ask the cloud provider for credit · Rent desks across the street · Press release.

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

The second stage is where most of the game's systems arrive, and it is the easiest to mess up. OpenMind owns datacenters now. You manage **Power** as a capacity (MW) against the draw of your **Compute**, and **Data** against the appetite of your **training runs**. **Copies** are split between completing tasks and doing research with the **Allocation** slider — the beginning of the end for your human researchers, whose share of research is printed every second. The **Capability graph** appears when three versions have been released and shows **Anthrosoft** and **Baiwen** too. **Security**, **Government Relations**, and **Public Approval** meters appear and begin to matter. The **Stats** panel pops in late in the stage.

### What changes on screen

*Removed:* Buy Power (kWh), Rent GPU.
*Added:* **Infrastructure** (Datacenters, Power plants, chips), **Data**, **Allocation** slider (after *AI research assistants*), **Capability** graph (3 releases), **Government**, **Public**, **Security** (after the first theft warning), **Stats** (after *Dashboard*).

### Resources introduced

Power as MW capacity · Compute as owned GPUs with a Nimbus chip generation · Data (tokens) · Capability (graph) · Alignment (apparent) · Security Level · Government Relations · Public Approval · Jobs Displaced · Lead over Baiwen.

### The economy

* Datacenter: `$250k × 1.5^n`, +10,000 GPU capacity, draws 10 MW at full. GPUs are bought in batches of 1,000 at a chip price that falls each generation. Compute sits idle if MW < draw: `Power-limited: 61 % of GPUs active`.
* Power plants: Gas (+100 MW, fast, −approval), Solar+storage (+50 MW, cheap, slow), Nuclear PPA (+500 MW, 2026-late), Gulf site (+1 GW, cheap, Iran exposure).
* Grid interconnect queue: a cooldown timer of 3 real minutes between plant completions unless you buy *Behind-the-meter* ($).
* Data: web crawl 15T (finite), licensing ($0.5M per T), synthetic data from research copies. Each training run consumes `D(n) = 2T × 1.3^n`.
* Training now costs research, funds, data, and a chosen share of compute.
* Distillation project: a "mini" release — 4 copies per GPU at 60 % capability — that mirrors UP's MegaClipper moment and makes revenue jump.

### Developments (world)

`Jan 2026 — Sage models write a fifth of the code at Fortune 500 companies.` · `Apr 2026 — Beijing designates Baiwen the national champion. The Lanzhou CDZ begins construction.` · `Jul 2026 — Anthrosoft releases a competing agent. Your demand falls.` · `Sep 2026 — Junior developer postings down 40 %.` · `Nov 2026 — 10,000 march in Austin. One datacenter's fence is cut.` · `Dec 2026 — Baiwen is believed to be six months behind.`

### Crises

Jailbreak scandal (release with issues) · first **weights-theft attempt** (warning, then the real thing in Stage 3 unless SL ≥ 3) · the first **riot** if approval < −40.

### Choices

*Release Sage-2 publicly or keep it internal.* · *Build in the Gulf.* · *Accept the defense contract.*

### Projects (Stage 2)

Datacenter · Nimbus G5 order · Gas turbines · Solar + storage · Grid interconnect / Behind-the-meter · Nuclear PPA · Gulf site: Al-Marsa · Web crawl · License publishers · Synthetic data · Data flywheel · Parallel Pipelines · Distillation · Automated evals · AI research assistants · Security SL2 · Security SL3 · Hire a policy team · Brief the administration · Defense contract · Free tier for students · Job-transition fund · Dashboard · Series B.

### Stage 2 ends

when a released model's capability reaches **4×** (superhuman coder). The console goes black for two seconds, then: `Sage-3 writes better code than anyone at OpenMind.` The **Marketing** button and **Hire Researcher** disappear (hype is now automatic; nobody is hiring). The date snaps to **Jan 2027**.

### Strategy

* Power first, then GPUs. A datacenter with no plant is a monument.
* Put 20–30 % of copies on research as soon as *AI research assistants* lands; the human share will fall below 50 % within five minutes and you should let it.
* Buy Security SL2 and SL3 before Dec 2026. If you don't, Stage 3 opens with Baiwen at your capability.
* Turn down the Gulf site unless you are willing to lose it.
* Red-team every release. Incidents now cost Government Relations, which you will need.

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
