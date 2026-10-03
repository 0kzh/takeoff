# Stages

*Written in the format of the Universal Paperclips wiki's [Stages](https://universalpaperclips.fandom.com/wiki/Stages) page. This is the plan the implementation follows; numbers are targets to be validated with the headless simulator (`npm run sim`).*

The gameplay of **Takeoff** takes place over five **stages**. The stages limit which projects can be launched, and each has a distinct play style. The first stage is roughly analogous to running a small API business. The second is a datacenter and power-management game. The third is a race with a hidden variable. The fourth is a negotiation you may or may not be part of. The fifth is space.

The player is never told which stage they are in and is never told how many there are.

## Summary

| Stage | Name | In-game dates | Target wall clock | Analogy | Exit condition |
|---|---|---|---|---|---|
| 1 | The Startup | Jul 2025 → Dec 2025 | 25–35 min | UP Stage 1 (manufacturing + business) | Buy **First Datacenter** |
| 2 | Scale | Jan 2026 → Dec 2026 | 35–45 min | UP Stage 2 (power management) + GDS loop | Reach **superhuman coder** (capability ≥ 4×) |
| 3 | Takeoff | Jan 2027 → Oct 2027 | 40–50 min | The AI-2027 "race" chapters | Reach **superhuman AI researcher** (≥ 25×) **and** make the Committee choice |
| 4 | Superintelligence | Nov 2027 → Dec 2028 | 30–40 min | AI-2027 branch chapters | Treaty signed, or autonomy granted, or nationalized |
| 5 | Beyond | 2029 → 2030+ | 20–30 min | UP Stage 3 (space), compressed | Ending |

Total: ~2.5–3.5 hours for a reasonable player; 4 hours for a cautious one.

---

## Stage 1 — The Startup

The first stage is by far the simplest. OpenMind has a model, a cloud bill, and no customers. You manage **Funds** against the **Public Demand** for completed tasks, buy **Power** (kWh) in blocks whose price drifts, and rent **GPUs** so that copies of the model complete tasks without you clicking. Late in the stage you hire **Researchers**, who turn **Trust** into **Research** points, which buy the projects that lay the technical backbone of the later stages, and you run your first **training runs**. If you run out of money with no power and nothing to bill, the game lets you **Ask the cloud provider for credit** in exchange for Trust rather than losing the game.

### What is on screen

*Minute 0:* black console (`Welcome to OpenMind.`), `Tasks Completed: 0`, the date `Jul 2025`, and one button: **Complete Task**. Below it, `Power: 1,000 kWh`.

*Reveal order (triggers, not timers; typical minute in brackets):*

1. **Business** panel after the first task is completed [0:05] — `Available Funds`, `Unbilled Tasks`, `lower / raise` price, `Public Demand`.
2. **Buy Power (1,000 kWh) — $20.00** when power < 900 or funds ≥ 5 [0:30].
3. **Rent GPU — $7.00** and `GPUs rented: 0 / Copies running: 0` at funds ≥ 5 or tasks ≥ 50 [1:00]. First GPU affordable around [1:30].
4. **Developments log** (left column) on the first world development, `Jul 2025 — Agents can order food and fill spreadsheets. Sometimes.` [1:30].
5. **Marketing — Level 1 — $100.00** at funds ≥ 20 [3:00]. Affordable around [6:00].
6. **Research** panel at the first Trust milestone (3,000 tasks) [3:00]: `Trust: 2`, `+1 Trust at: 5,000 tasks`, `Researchers: 1`, `Lab Space: 1`, `Research: 0 / 1,000`, `Hire Researcher (1 Trust)`, `Expand Lab (1 Trust)`.
7. **Projects** column at the same moment, with **Better Prompting (750 research)** greyed out.
8. **Blue-sky Research (1,000 research)** when research first hits its cap [5:00]. → **Insight** line appears.
9. **Training Pipeline (2,000 research, $500)** at 10,000 tasks [7:00] alongside the free **Seed round**. → **Training** panel: `Current model: Sage-1`, `Train Sage-1.1`, focus buttons.
10. First training run [9:00–10:30]; evaluation bars; first red-team; first **Release**; first hype spike; `Avg. Rev. per sec` doubles.
11. **Grid Contract (7,000 research)** after the fifth power purchase [11:00].
12. **Bulk GPU lease** at 50 GPUs [14:00]; **Usage-based pricing** at $10/s [16:00].
13. **Series A** (free) at 100,000 tasks and one release [18:00].
14. **First Datacenter ($250,000, 20,000 research)** greyed out at 500,000 tasks [22:00]; affordable around [28:00].

### Resources introduced

Tasks Completed, Unbilled Tasks, Funds, Power (kWh), Compute (GPUs rented), Copies, Hype (Marketing level), Trust, Research, Insight.

### The bottleneck rotates

power → funds → demand (price too high) → compute → research → funds again. Each has a visible fix (see design.md §6). The console names the bottleneck when it bites: `Power exhausted — copies idle.` / `Demand saturated — lower the price or market.` / `Research at capacity — insight accrues.`

### Projects (Stage 1)

Better Prompting · Ask the cloud provider for credit · Blue-sky Research · Chain-of-thought · Tool use · Research blog post · Training Pipeline · Seed round · Public API · Launch demo video · Grid Contract · Bulk GPU lease · Usage-based pricing · Hire an evals team · Series A · First Datacenter.

### Stage 1 ends

when you buy **First Datacenter**. The console clears, shows a single line — `Ground broken outside Abilene.` — and the date snaps to **Jan 2026**. The **Buy Power** and **Rent GPU** buttons disappear; **Infrastructure** replaces them.

### Strategy

* Click until you can afford one GPU; after that clicking is optional.
* Watch the power price. Anything under $18 is cheap; stock up. Never let power hit zero with copies running — that is the first soft-lock trap, and the *Ask for credit* project is the escape hatch.
* Keep demand under ~100 % by raising the price while the copies can't keep up; lower it when unbilled tasks pile up.
* First Trust → Researcher (two researchers, one lab unit). Then alternate. The *Blue-sky Research* cap trick is the most important thing in the stage: you want to be sitting at the cap often.
* Don't market before your first release; the hype spike from a release is worth more than three marketing levels.
* The first training run with **Capability** focus roughly doubles revenue. The second with **Efficiency** lets you run two copies per GPU. Save **Safety** for later; it looks useless now (it isn't).
* Release with issues > 0 once, just to see what happens. Then never again.

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
| 0 | Complete Task, Power |
| 0–1 | Business, Buy Power, Rent GPU |
| 1–3 | Developments log, Marketing |
| 3 | Research, Trust, Projects |
| 5 | Insight |
| 7 | Training |
| 9–11 | Evaluate / Red-team / Release, Grid Contract |
| 14–18 | Bulk lease, Pricing, Series A |
| 22–30 | First Datacenter → Stage 2: Infrastructure, Data |
| 32–40 | Allocation slider, Capability graph, Government, Public |
| 40–50 | Security, Distillation, Stats |
| 55–70 | Stage 3: Alignment, Interpretability, Geopolitics, Auto-train |
| 70–100 | Neuralese, Monitors, Committee, the memo, the choice |
| 100–130 | Stage 4: Robots, Society/UBI, Treaty, Monitors at scale |
| 130–160 | Stage 5: Space |
| 160–200 | Ending |

Every row must have at least one greyed-out project on screen when it starts.
