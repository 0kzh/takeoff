# Stage 2 — "Scale" (implementation spec)

Jan 2026 → Dec 2026 · target 35–45 min · enter by buying `Break ground` · exit by buying `Let Sage-3 write the code`
(needs a released model at ≥ 4.00×). Contract: `docs/specs/arc.md`. Patched on 2026-10-03 for the Stage 1 that was
actually built. Where this file and the code disagree about a Stage 1 id or number, the code wins.

## As-built deltas (read first)

What Stage 1 hands over at `Break ground` (`npm run sim`, seed 1, bot / naive): 30:54 / 28:24 · tasks 0.41–0.53 M ·
91–95 rented GPUs · capability 1.65–1.77× (Sage-1.6) · price $0.75–0.90 · income $0.7–1.1k/s, of which Custom model
contracts are $0.3–0.8k/s · research cap 36,000–44,000 · 20–27 researchers · marketing level 10 · `copiesPerGPU` 1.95 ·
`copyBoost` 3 · `demandMult` 6. Nothing below depends any longer on the older estimates (≈ $270/s, 130 GPUs, 1.2 M tasks).

| # | Change in this file | Where |
|---|---|---|
| 1 | **Arrival is the built `enterScale`.** The rented fleet goes back at once and 1,000 owned GPUs run from the first second; the deposit pays for the first lot; +2 Trust; lab room for the next run. `Unpack the first shipment` is cut: the first click is `Buy GPUs (1,000)` | §1, §4.2 row 1 |
| 2 | **Funds scale.** `S2_FUNDS_SCALE = R0 / 650` (was `/ 540`); R0 is task revenue without contracts 30 s after arrival, ≈ $1.0–1.1k/s as built, so the scale is ≈ 1.6. The old $540 was measured before the carried Enterprise project was bought; as built it is already bought. The scale and the `marketBase` clamp absorb the whole revenue difference; grants and funds thresholds scale with the prices | "How to read the numbers", §1.1, §9.4 |
| 3 | **Contracts.** Signed Custom model contracts keep paying as a fixed line in the `funds` hover. The repeatable project is retired by name on arrival; no new contracts | §1.1, §1.2, §2.13 |
| 4 | **Carried projects** follow the built `stages` arrays: everything marked `[1, 2]` carries at its Stage 1 price, unscaled, except `p_contract` and `p_distributed`, which become `[1]` | §1.1 |
| 5 | **Scheduler.** `engine/reveal.ts` already has the 15 s drip, `maxVisible` 6 from Stage 2, `pinned` / `urgent` / `chain` and `cadence`. §4.1 lists only what Stage 2 adds | §4.1 |
| 6 | **Modals.** Budget 9 for the stage, unprompted modals ≥ 150 s apart (the built pacer). `c_recruiters` becomes the late project `p_retention`; `c_sage3` is cut (the `Release` / `Keep internal` buttons carry the choice); `c_gamble` fires at most once | §4.2 rows 52–53, §5.2 |
| 7 | **Training.** The cost functions of §2.5 are already in `training.ts` for the whole game. Stage 2 adds the funds scale, the data cost, whole-fleet training compute and its own gains. Duration clamp is the built 45–120 s | §2.5 |
| 8 | **`SAVE_VERSION`.** Stage 1's polish pass took 3. Stage 2 takes the next number (4 at the time of writing) | §8, Appendix |
| 9 | **Presets.** The built Stage 2 preset stands; the figures formerly in §9.6 are void. The Stage 3 preset is specified in `docs/specs/stage3.md` §1.1, which supersedes the table in §7 | §7, §9.6 |
| 10 | **Marketing** arrives at level 10, not 15: the next level is $51,200 and the built price `100 × 2^(level−1)` continues unscaled. Expect about eight purchases in the stage | §2.3 |

The paper model was re-run from the as-built arrival with these changes (§9.4): reasonable exit 35:40–42:45, naive
35:15–41:20, 11 and 8–9 runs, longest reveal hole ≤ 150 s. Minute marks elsewhere in this file are from the old arrival
and hold to within about two minutes; §1.4 is rewritten.

**How to read the numbers.** `ts` = seconds since entering Stage 2. Minute marks (`m:ss`) are for the reasonable bot
starting from the Stage 2 preset, taken from a 1-second paper model of this spec (§9.4). They are targets to reproduce in
`npm run sim`, not promises. Every funds figure below (prices, grants such as Series B, funds thresholds in triggers) is
at `S2_FUNDS_SCALE = 1`. **R0** is revenue from billed tasks, contracts excluded, thirty seconds after arrival with
nothing bought but the first lot. Measure R0 in the real sim from the Stage 2 preset (median of seeds 1–5) and set
`S2_FUNDS_SCALE = R0 / 650`. Research, insight, data and Trust prices do not scale; neither do carried Stage 1 projects
or Marketing.

Stage 2 in one paragraph: OpenMind owns its compute. GPUs arrive in lots, need room (datacenters) and power (MW), and
revenue is `0.25 × √(market × supply)`, so building always pays but pays less each time until a better model or a wider
market lifts it. Training now needs data and a cluster big enough for the model being trained, so capability is gated by
the build-out. Copies of the model start doing the research, and the human share of it is printed until it rounds to
zero.

---

## 1. Arrival

### 1.1 State on entering (`enterScale` in `stages.ts`, extended)

| Field | Value |
|---|---|
| `date` | Snapped to Jan 2026 (built) |
| `gpus` | Built: the rented fleet goes back at once and Abilene opens with 1,000 owned Nimbus G4s (`gpus = 1,000`, `gpusG5 = 0`). Tasks per second jump ×9–12 in the first second |
| `funds` | Built, with one change: the deposit is `max(price of the first lot, $400 × rented GPUs)`, so the amount the console names is what makes the first lot affordable. Keep the built top-up only as a guard |
| `datacenters` | 1 → 10,000 GPU slots |
| `powerCapacityMW` | 5 (the Stage 1 substation). `power`, `powerPrice`, `gridAuto` are frozen and hidden |
| `autoPrice` | `true` (new field). Lower/raise are disabled while it is on |
| `marketBase` | Calibrated once: `clamp(S × (price/0.25)² / X, 30, 54)` where `S = max(stats.soldPerSec, stats.tasksPerSec)` and `X = capability² × 1.1^(hypeLevel−1) × demandMult × qualityMult × hypeBoost`. From the built Stage 1 the unclamped value is 110–160, so every arrival gets 54; that is intended, and the clamp is what keeps R0 predictable. Acceptance instead: revenue 30 s after arrival ≥ revenue 10 s before `Break ground` (≈ ×1.5–2.4 as built) |
| `contractIncome` | New field, $/s: the built `contractRate(s)` frozen at arrival (≈ $320–800). It is paid every tick and counts in `Avg. Rev. per sec`. The `Contracts` line in Business is hidden (`revealed.contracts = false`); the number lives in the `funds` hover as `custom contracts +$596/s` (§2.13) |
| Research cap | Built: `labSpace` is raised until the cap covers the next run's research cost |
| `trust` | Built: `max(2, trust + 2)` |
| `flags.trainingCompute` | Ignored from Stage 2: a run trains on the whole active fleet (§2.5) |
| `lead` | `clamp(lead + 2, 3, 7)` — Baiwen is "about five months behind" |
| `rivalCapability` | Unchanged and never lowered; `nextRivalIn = 270`. Stage 2's band (§2.7) applies from Anthrosoft's next release |
| `flags.dataEra` | `false` — the first Stage 2 run needs no data |
| `revealed` | on: `stores`, `infrastructure`, `autoPrice`. off (built): `power`, `buyPower`, `gridContract`, `compute`, `site` (the Abilene panel with its `interconnect` and `powerMW` lines); off (new): `contracts` |
| Projects retired | Built rule: a project on screen whose `stages` lacks 2 is withdrawn and named in `Retired with the rented fleet: …` (rescues and `p_contractor` go quietly). In practice that is `Power purchase agreement` at most. Stage 2 changes two `stages` arrays to `[1]`: `p_contract` (it gets its own line, §1.2) and `p_distributed` (standard on owned hardware) |
| Projects carried | Every other project marked `[1, 2]`, at its Stage 1 price, unscaled; visible ones stay visible, untriggered ones can still trigger and join the drip: `p_prompting`, `p_prompting2`, `p_prompting3`, `p_insight`, `p_blogpost`, `p_demo`, `p_workshop`, `p_keynote`, `p_lab_cluster`, `p_floor`, `p_recruiter`, `p_eval_team`, `p_api`, `p_pricing`, `p_enterprise`, `p_alignment_team`, `p_safety_framework`, `p_dogfood`, `p_batch`, `p_agents`, `p_moe`, and the rescue `p_press`. Their effects are unchanged: the `demandMult` ones multiply the Stage 2 market, `hypeLevel` ones are ×1.1 each, `copiesPerGPU` and `copyBoost` ones multiply tasks. They are the catch-up for a player who skipped them: cheap next to Stage 2 income |
| Stage 1 developments | Entries with `stage: 1` that have not fired stop being eligible at `stage ≥ 2`, so no Abilene-site modal follows the player into the datacenter |
| `cadence.lastRevealAt` | now (§4.1) |
| Removed | `STAGE2_MIN_SECONDS` and its use in `exit` |

### 1.2 Narration

Built: `enterScale` keeps the last four console lines and queues its lines with `narrate()`. Stage 2 keeps the built
lines and adds two; about eleven seconds in all.

1. `Ground broken outside Abilene.` (the project's own line, built)
2. `The 95 rented GPUs go back. Deposit returned: $80,000.` (built; the amount is the new deposit)
3. `1,000 Nimbus G4s on 5 MW at Abilene. Power is bought in megawatts now.` (built)
4. `Tasks per second ×12: the copies run on hardware OpenMind owns.` (built)
5. `Pricing is on AUTO. The price falls to meet supply; watch revenue, not price.` (new)
6. `No new custom contracts. The 8 signed keep paying $596 a second.` (new; only with ≥ 1 contract)
7. `Retired with the rented fleet: {titles}.` (built; only if any were on screen)

Developments (built): `OpenMind owns its first datacenter. The rented GPUs go back to the cloud.`

### 1.3 Affordable in the first 30 seconds

* `Buy GPUs (1,000)` — the deposit covers exactly one lot. This is the guaranteed first click, and it doubles the fleet.
* Any carried Stage 1 project the player can pay for (typically `Research blog post`, `Conference keynote`,
  `Mixture of experts`, `Hire a recruiter`).
* `Train` — if banked research covers the run (24,500 at 1.65×, 34,800 at 1.77×); otherwise one to two minutes away.
* The next lot is greyed and about a minute away. `Gas turbines` joins it greyed at 3,000 GPUs, `Research cluster` at 1:00.

### 1.4 The first five minutes (as-built arrival, paper model)

| ts | What happens | New on screen |
|---|---|---|
| 0:00 | Transition. Compute, Power (kWh) and the Abilene panel are gone; Stores and Infrastructure are in their place. 1,000 owned GPUs are already running: tasks/s ≈ 600 → 8,700. The price slides from ≈ $0.85 to ≈ $0.12 over ten seconds; task revenue ≈ $450 → $1,000/s, plus the contracts | `panel-stores`, `panel-infrastructure` with `Buy GPUs (1,000)` affordable, `btn-autoPrice` |
| 0:05 | First lot, paid by the deposit: 2,000 GPUs | — |
| 0:45 | 3,000 GPUs = 60 % of 5 MW | `btn-turbines` greyed; console `Power draw is 60% of the substation. Gas turbines can be on site in a week.` |
| 1:00 | First real choice: the next lot or Research cluster | project `Research cluster` |
| 2:15 | 5,000 GPUs. `Buy GPUs` greys with the inline reason `no power` | console `No power for more GPUs — 5.0 of 5 MW in use. Gas is fast; solar is cheap.` |
| 2:40–3:20 | Research cluster bought; the first Stage 2 run starts when research allows (`Compute: 5,000 of 1,260 GPUs wanted · est. 60 s`) | project `Web crawl` at the run's start, or at 3:00 |
| 4:10 | Gas turbines bought: 25 MW. GPU buying resumes | `btn-solar` 30 s later; `btn-datacenter` at 6,000 GPUs |
| 4:30 | Anthrosoft ships Cadence-7 | `panel-graph` (or at the player's first Stage 2 release, whichever is first) |
| 4:45 | Sage-1.7 released at ≈ 1.8–1.9× | project `AI research assistants`; +15 s `Series B`; +30 s `Agent platform` |

Bottleneck sequence in these minutes: funds → power → funds/research.

---

## 2. Systems

### 2.1 Infrastructure

New state: `gpusG5`, `gasPlants` (rename of `turbines`), `solarFarms`, `reactors`, `powerQueue: {mw, remaining, label}[]`,
`btm`, `g5`, `standingOrder`, `gulfExposure`. `gpus` stays the total; G4 count is `gpus − gpusG5`.

**Datacenters** (hand-tuned table, UP factory style; instant on purchase):

| Datacenter | Adds slots | Total slots | Cost |
|---|---|---|---|
| 1 (Break ground) | 10,000 | 10,000 | — |
| 2 | 15,000 | 25,000 | $250k |
| 3 | 25,000 | 50,000 | $800k |
| 4 | 50,000 | 100,000 | $2.0M |
| 5 | 75,000 | 175,000 | $4.0M |
| 6 | 125,000 | 300,000 | $8.0M |
| 7 | 200,000 | 500,000 | $15M |
| 8 | 300,000 | 800,000 | $27M |
| 9 | 450,000 | 1,250,000 | $50M |
| 10+ | ×1.6 | | ×1.9 (Stage 3) |

Button label: `Build Datacenter 3 (+25,000 slots)`. Console: `Datacenter 3 complete. Room for 50,000 GPUs.`

**GPU lots.** Nominal lot = 1,000 while `gpus < 25,000`; 5,000 while `< 100,000`; 25,000 after. Actual lot =
`floor(min(nominal, freeSlots, freePowerGpus) / 1000) × 1000`; the label shows the actual lot (`Buy GPUs (5,000)`). Price
per GPU: Nimbus G4 $50, Nimbus G5 $90 (after `p_g5`; new lots are G5). Disabled, with an inline reason in `#gpuReason`,
when the lot is < 1,000: `no room` or `no power`. `freePowerGpus` counts only plants that are online, so an owned GPU
is always a running GPU except during a crisis.

**Power.** `KW_PER_GPU = 1` for both generations. `activeGpus = min(gpus, floor(powerCapacityMW × 1000))`.

| Source | Adds | Cost | Wait | Other |
|---|---|---|---|---|
| Substation | 5 MW | from Stage 1 | — | — |
| Gas turbines `btn-turbines` | +20 MW | $90k × 1.7^n | none | approval −1.5 each |
| Solar + storage `btn-solar` | +50 MW | $300k × 1.3^n | The Interconnect Queue: 180 s each, one at a time, at most 2 waiting | rides through curtailment |
| Behind-the-meter `p_btm` | — | $500k | queue becomes 30 s | all plants ride through curtailment |
| Nuclear PPA `btn-nuclear` | +500 MW | $15M × 2^n (−25 % if `govRelations ≥ 60`) | Reactor restart: 120 s | — |
| Al-Marsa `c_gulf` | +1,000 MW | $8M | 120 s | `gulfExposure = 1`, gov −8, approval −3, lead −0.5 |

G5 lots are allocated power first. Effective compute `effGpus = activeG4 + 1.5 × activeG5`.

Named waits (console, within 2 s; and a line in the panel, `#interconnectLine`):
`The Interconnect Queue — 3:00 until Solar farm 1 is connected.` / `Solar farm 1 connected. +50 MW.` /
`Reactor restart — 2:00 until the Nuclear PPA delivers.` / `Al-Marsa energised. +1,000 MW.`

**Standing order** (`p_standing_order` → `btn-standing`, ON by default once bought). Each second, if a lot ≥ 1,000 fits and
`funds ≥ lotCost + trainCost(s).funds`, buy it. It never buys datacenters or plants. Toggle text: `Standing order: ON`.

### 2.2 Copies and tasks

```
copies      = floor(effGpus × (1 − trainingShare) × copiesPerGPU)
perCopyRate = capability^0.8 × copyBoost                      // deployed capability
tasksPerSec = copies × (1 − researchAlloc − alignExtra) × perCopyRate   // alignExtra = alignShare − 0.01 (§2.11); no kWh
```

Typical as-built arrival: `copiesPerGPU` 1.95, `copyBoost` 3, capability 1.65 → 8.7 tasks/s per GPU (the tables below
were modelled at 5.8; see the note under the targets table in §2.3).

### 2.3 Market and revenue (replaces the UP sale roll when `stage ≥ 2`)

```
market      = marketBase × capability² × 1.1^(hypeLevel−1) × demandMult × qualityMult × hypeBoost × effects
wanted(p)   = market × (0.25 / p)²                 // tasks/s customers take at price p
sold        = min(unbilled, wanted(price) × dt)    // deterministic, every tick
qualityMult = clamp(capability / rivalCapability, 0.80, 1.25)
autoTarget  = clamp(0.25 × √(market / max(1, tasksPerSec + unbilled/30)), 0.001, 5)
price      += (autoTarget − price) × 0.2 per second   (while autoPrice)
```

At the clearing price, **revenue = 0.25 × √(market × tasksPerSec)**: doubling compute gives +41 %, doubling the market
gives +41 %, a Capability run gives about +17 %, an Efficiency run about +23 %. `hypeBoost` (×2 at a public release,
half-life 180 s) is worth +41 % at release, fading. Stage 2's market multipliers go into the existing `demandMult`.
Price shows three decimals below $0.10 (`$ 0.067`); manual steps are 5 % of the price, floor $0.001.

Market multipliers in Stage 2: the carried Stage 1 ones at their built values (Public API ×2, Usage-based pricing ×1.5,
Enterprise sales team ×2; usually all bought on arrival, `demandMult` 6), Agent platform ×1.6, International launch
×1.6, Free tier ×1.2, Sage-mini ×1.5, marketing levels ×1.1 each (the built price `100 × 2^(level−1)` continues
unscaled: level 10 on arrival, so the next is $51,200 and each one doubles; worth buying about eight times in the
stage, then a sink), capability² ≈ ×6 over the stage.

Console, at most once per 90 s: `Market flooded — price per task down to $0.031. A better model or a wider market lifts it.`
(price fell > 35 % in 60 s with no release). On a market change: `Agent platform live. Market ×1.6.` /
`Anthrosoft Cadence-7 beats Sage-2.1. Market down 7%.`

Targets (model medians; the engineer's sim should land within ±40 %):

| ts | GPUs | MW | DCs | Tasks/s | Revenue/s | Price | Capability | Research/s | Human share | Jobs |
|---|---|---|---|---|---|---|---|---|---|---|
| 0:30 | 1,000 | 5 | 1 | 5.8k | $540 | $0.07–0.11 | 1.65× | 150 | 100 % | 0 |
| 5:00 | 5,000 | 25 | 1 | 30k | $2.1k | $0.07 | 1.85× | 160 → 900 | 100 → 17 % | 0 |
| 10:00 | 13–15k | 25 | 2 | 125k | $6.3k | $0.055 | 2.2× | 2.1k | 8 % | 0.03M |
| 15:00 | 25k | 25–45 | 2 | 150–300k | $8–12k | $0.05 | 2.4× | 2.5–3.3k | 6 % | 0.07M |
| 20:00 | 45–50k | 45–75 | 3 | 0.4–1.6M | $17–39k | $0.035 | 2.6× | 3.8–7.7k | 4 % | 0.15M |
| 25:00 | 75–100k | 75–115 | 4 | 1.8–3.0M | $60–75k | $0.03 | 2.9× | 5–8k | 2.5 % | 0.3M |
| 30:00 | 300k | 315–335 | 6 | 14–29M | $200–300k | $0.012 | 3.35× | 23–36k | 0.5 % | 1.0M |
| 35:00 | 335–435k | 405–475 | 7 | 24–37M | $260–365k | $0.011 | 3.6–3.8× | 24–48k | 0.4 % | 1.4M |
| exit 38–42 | 500–800k | 555–1,105 | 7–8 | 30–58M | $340–480k | $0.007 | 4.1–4.3× | 50–90k | 0.2 % | 1.8–2.4M |

**Reading this table from the as-built arrival.** It is the paper model from the old arrival at scale 1. GPUs, MW,
datacenters, capability, research and human share stand. Multiply `Revenue/s` by `S2_FUNDS_SCALE` and, from mid-stage,
by a further ≈ 1.5 (the extra marketing levels); multiply `Tasks/s` by ≈ 1.5–2 and `Jobs` by ≈ 1.3; the first two rows
arrive about a minute early. As-built model at the exit: 0.8–1.25 M GPUs, 1.0–1.6 GW, tasks/s ≈ 1 × 10⁸, revenue
≈ $1.0–1.5M/s, 3–7 × 10¹⁰ tasks, jobs 2.6–4.2M.

Revenue doubles about every 4 min. Tasks Completed passes 10M ≈ 5:00, 100M ≈ 13:30, 1B ≈ 24:30, 10B ≈ 32:15, and the
`N tasks completed in …` line prints each time. Minutes 25–30 are deliberately the steepest (G5 lots, Sage-mini).

### 2.4 Research and the allocation slider

```
humanEff    = min(1, 3 / bestCap)                      // bestCap = max(capability, internalCapability)
humanRate   = researchers × 10 × humanEff × researchMult
aiRate      = 8 × √(copies × researchAlloc) × bestCap^1.5 × aiResearchMult     // 0 until p_ai_assistants
researchRate = humanRate + aiRate
humanShare  = humanRate / researchRate                 // shown: "Human share of research: 17%"
researchCap = labSpace × 1000 × labMult
insight     += √researchRate / 10 per second at the cap; 10 % of that below it once Research cluster is bought
```

* The slider (`#allocSlider`, 0–50 %, step 5, default 15 %) appears with `AI research assistants`. The square root
  makes it a real dial: 15 % → 40 % gives +63 % research and −16 % revenue.
* `humanEff` barely moves in Stage 2 (0.75 at 4×). The share collapses because of the copies: 100 % → 17 % within a
  minute of buying the project → 4 % at minute 20 → 0.2 % at the exit.
* `Hire Researcher` still costs 1 Trust and still adds 10/s. Nothing stops the player buying it.
* Cap ladder, each ×4 on `labMult`, each appearing when the next run's research cost exceeds 60 % of the cap, each
  priced in funds: `Research cluster` $60k, `Experiment scheduler` $600k, `Checkpoint farm` $12M. `Expand Lab` (1 Trust)
  keeps adding `1000 × labMult`; Stage 2 yields ≈ 35 Trust (20 milestones, ≈ 10 releases, Series B and C). As built
  the lab arrives holding 36,000–44,000 (`labMult` 4 from `Experiment tracker` and `Lease the floor upstairs`, which
  stack with this ladder), so the first wall is `Research cluster` at about 1:00.

### 2.5 Training

Costs depend on the capability the run starts from (`c` = highest of deployed, internal and any run waiting in
eval/red-team), not on the run count, so every mix of focuses pays the same total to reach 4×:

```
research R(c) = 21,000 × (c/1.6)^5
funds    F(c) = $25,000 × (c/1.6)^8 × S2_FUNDS_SCALE
data     D(c) = 2.0 T × (c/1.6)^3          (0 until flags.dataEra, i.e. from the second Stage 2 run)
compute  N(c) = 1,000 × (c/1.6)^7.5        G4-equivalents wanted

have     = effGpus (active)                 // the whole fleet; computeShare and flags.trainingCompute are not used
yield    = clamp(√(have / N), 0.3, 1)
duration = clamp(120 × √(N / have), 45, 120) seconds
```

**Built already.** `researchFor`, `fundsFor`, `computeFor`, `MIN_YIELD` and the 45–120 s clamp in `training.ts` are these
functions for the whole game (steeper below the 1.6× knee, which Stage 2 never sees). Stage 2 adds only: `F(c) ×
S2_FUNDS_SCALE` from `stage ≥ 2`; the data cost; `have` as above; the gains below. `Ship With Open Issues?` was asked
once in Stage 1 and does not return.

| c | Research | Funds | Data | GPUs wanted |
|---|---|---|---|---|
| 1.65 | 24,500 | $32k | 2.2 T | 1,260 |
| 1.8 | 37,800 | $64k | 2.8 T | 2,420 |
| 2.0 | 64,100 | $149k | 3.9 T | 5,330 |
| 2.2 | 103k | $319k | 5.2 T | 10,900 |
| 2.4 | 159k | $641k | 6.7 T | 20,900 |
| 2.6 | 238k | $1.22M | 8.6 T | 38,100 |
| 2.8 | 345k | $2.20M | 10.7 T | 66,500 |
| 3.0 | 487k | $3.82M | 13.2 T | 112k |
| 3.2 | 672k | $6.40M | 16.0 T | 181k |
| 3.4 | 910k | $10.4M | 19.2 T | 285k |
| 3.6 | 1.21M | $16.4M | 22.8 T | 438k |
| 3.8 | 1.59M | $25.3M | 26.8 T | 657k |

* **Gains in Stage 2** (smaller and more even than Stage 1, so runs come every 3–5 min instead of alternating 2 and 7):
  Capability `rand(0.10, 0.14) × yield`; Efficiency `0.07 × yield` and `copiesPerGPU × 1.25`; Safety `0.07 × yield`,
  apparent +8, true +5, and −0.5 to the issue rate for good. Frontier bonus +0.02 stays; the gamble's bonus drops to
  +0.04. Result: 8 runs all-Capability, 10–11 mixed, 13 all-Efficiency.
* Training still diverts 50 % of copies during the training phase only. Idle readout:
  `Cost: 103,000 research, $319,000, 5.2 T data` · `Compute: 15,000 of 10,900 GPUs wanted · est. 102 s`, or
  `… 45,000 of 66,500 GPUs wanted · undertrained (82%)`. Focus tooltips state the gains.
* Eval 5 s. Issues `Poisson(max(0.3, 2 + capAfter/3 − safetyInvestment))`. Red-team 8 s per issue (4 s after
  Automated evals). +1 Trust per public release.
* **Parallel pipelines** (`p_parallel`): `training.run` becomes two slots — one run in `training`, one in
  `evaluating`/`redteam`. While a run waits in eval/red-team, `#train-idle` shows again under it and `Train` starts the
  next run from that run's `capAfter`. Never two runs in the training phase.
* **Keep internal** (`btn-releaseInternal`, after `c_sage2`): the run becomes the internal model (research uses it at
  once), customers keep the deployed one, `lead += 0.5`, `flags.internalReleases += 1`, no hype, no market change. The
  existing `researchMult × 1.25` applies to the first internal release only.
* Model names: minor +1 per run; `Sage-2` at 2.0×, `Sage-3` at 4.0×.
* `c_evals_month` can set `training.cooldown` (seconds before the next run may start). It never lengthens a run.
  Named: `Evaluation month — 1:00 until the next run may start.` With `flags.pactSigned`, a release at ≥ 4× waits
  30 s: `Outside evaluation — 0:30 until Sage-3 can ship.`

### 2.6 Data

New Stores row `data` (trillions of tokens, one decimal). Web crawl is the mine: finite. `flags.dataEra` turns true when
the first Stage 2 run starts training: that run is free of data, every later one pays `D(c)`, and the Web crawl project
appears at the same moment with the console line `The run after this one will want data. The lab has none it has not used.`

| Source | Amount | Cost | Appears |
|---|---|---|---|
| `p_web_crawl` | 15 T total at 0.1 T/s | 4,000 research | first Stage 2 run starts, or ts ≥ 180 |
| `c_publishers` → licence | +10 T | $400k | crawl exhausted and data < next run's need |
| `p_synth` Synthetic data | `0.004 × √(researchCopies / 1000)` T/s | 200k research, 60 insight | after `c_publishers` |
| `p_license_code` | +20 T | $1.5M | data short again |
| `p_flywheel` Data flywheel | +0.6 T per 10⁹ tasks billed | 500k research, $4M | 10⁹ tasks billed, or 2 licences |
| `p_license_archive` | +40 T | $9M | data short a third time |
| `p_beg_data` (rescue) | exactly the shortfall | 1 Trust (may go negative) | data short for 240 s with no affordable source |

Ten mixed runs need ≈ 125 T. The crawl covers the first three data-costing runs; the wall arrives ≈ minute 11.
Track `dataSynthetic` separately; a run whose data is > 50 % synthetic costs 2 true alignment (hidden).
Console: `The Data Wall — the next run needs 5.6 T. The lab holds 1.9 T.`

### 2.7 Rivals

* **Anthrosoft.** A release every `rand(240, 420)` s; the first at ts ≈ 270.
  `rivalCapability = clamp(rivalCapability × rand(1.10, 1.22), 0.80 × bestCap, 1.08 × capability)`. Developments line
  from the pool; console `Anthrosoft Cadence-7 beats Sage-2.1. Market down 7%.` or
  `Anthrosoft ships Cadence-7. Sage-2.1 is still ahead.` A dashed dot on the graph. Keep the built `max` with the
  previous value so the dashed line never falls (Stage 1's band is 0.85–1.15× of the deployed model).
* **Baiwen.** `lead` in months is the state; Baiwen's capability for the graph is the player's own best capability
  `lead` months ago (interpolated on the model history, floor 0.7×). Movers: Lanzhou development −1; each public
  release −0.15; each internal release +0.5; SL2 +0.5; SL3 +1; Gulf −0.5; defense contract +0.5; candid testimony
  −0.5; theft warning reviewed quietly −0.5, Bureau +0.5; each release while `Share evals` is on −0.1; −0.1 per month
  from Jul 2026 while SL < 3. Clamp [1, 9].
  Shown under the graph: `Baiwen: about 5 months behind` (`#leadLine`).

### 2.8 Government relations (`govRelations`, 0–100, arrives ≈ 50)

Revealed by `c_hearing`. Panel line: `Relations: 54 (cordial)` — `wary` < 40, `cordial` 40–64, `close` ≥ 65.

| Mover | Δ |
|---|---|
| Hearing: testify / lawyers / demo | +8 / −5 / +3 |
| Policy team | +5, then +0.5 per month up to 60 |
| Brief the administration | +8 |
| SL2 / SL3 | +2 / +5 |
| Publish the Spec, Sage-3 system card | +3 each |
| Defense contract: sign / decline | +15 / −5 |
| Al-Marsa: sign / domestic only | −8 / +3 |
| Publishers: fight | −3 |
| Theft warning: call the Bureau | +5 |
| Joint statement signed | +5 |
| Each release while `Share evals` is on | +1 |
| Each incident | −3 |
| No policy team and capability ≥ 2.5× | −0.5 per month |

Gates: defense offer needs ≥ 40; nuclear −25 % at ≥ 60; below 30 once → `cr_subpoena` (research paused 45 s) with
`Policy team` and `Brief the administration` visible.

### 2.9 Public: jobs and approval

Revealed at `jobsDisplaced ≥ 0.1` or Aug 2026 (≈ 18:00). Lines: `Approval: −12`, `Jobs displaced: 0.5M`.

```
jobsTarget     = 0.12 × √(tasksPerSec / 1e6) × (bestCap / 2)^1.5        // millions
jobsDisplaced += max(0, jobsTarget − jobsDisplaced) × 0.02 per second    // never falls
approvalTarget = −10 × jobsDisplaced^0.6 − 1.5 × gasPlants − 5 (Sage-mini) − 3 (Al-Marsa) − 8 (defense)
                 − 2 per incident in the last 5 min − 4 (fought the publishers)
                 + 8 (free tier) + 10 (while the job fund is on) + 6 (community agreement) + 3 (candid testimony)
                 + 2 (licensed the publishers) + 5 (joint statement) + 2 (system card)
approval      += clamp(approvalTarget − approval, −0.1, +0.1) per second
```

`Job-transition fund` is a toggle in this panel (`btn-jobFund`, off by default, shown at jobs ≥ 0.2M or approval ≤ −8):
while on it takes 2 % of revenue (a negative line in the `funds` hover) and adds 10 to the approval target.
Unmitigated, approval reaches about −25 by the exit; with free tier and job fund about −8. At ≤ −20: the Austin protest
(§5.3). At ≤ −40: `cr_riots`. The hover on `Approval` lists every term.

### 2.10 Security

SL1 on arrival. `p_sl2` ($300k): SL2, reveals `panel-security` with `Security level: SL2 — holds against opportunists`.
`btn-sl3` ($20M + 3 Trust; 25 % off for 5 min after "lock it down") appears with the theft warning or at 3.2×:
`SL3 — weights air-gapped`. SL3 before the exit is what prevents the February 2027 theft in Stage 3; the warning modal
says so in plain words.

### 2.11 Alignment bookkeeping

Both values are bookkeeping in Stage 2; `alignmentApparent` shows only on the Safety Institute card and, later, in Stats.

| Event | Apparent | True |
|---|---|---|
| Safety run | +8 | +5 |
| Capability run from ≥ 2× | 0 | −2 |
| Efficiency run | 0 | −0.5 |
| Red-teamed to zero before release | +1 | 0 |
| Each open issue shipped | 0 | −1 |
| Each incident | −2 | 0 |
| Run trained on > 50 % synthetic data | 0 | −2 |
| Publish the Spec | +6 | +2 |
| A month of evals: month / week / not now | +2 / 0 / 0 | +4 / +1 / −1 |
| Honesty evals | −4 | +3 |
| Retire human code review | 0 | −2 |
| Sage-3 system card | +3 | 0 |
| Each release while `Share evals` is on | +1 | 0 |
| Each run trained with Alignment compute at 5 % / 10 % | +0.5 / +1 | +1 / +2 |
| Counter-offer for the alignment lead: bought / unbought at the exit | 0 | +2 / −3 |

**Alignment compute** (`btn-alignShare`, late): one button that cycles `Alignment compute: 1%` → `5%` → `10%`. That
share of copies is taken from tasks (above the 1 % baseline) and each run trained while it is set earns the row above.
It is the first plain capability-for-alignment trade the player is offered, and Stage 3's monitor share grows out of it.

Typical exit: a player who never picks Safety arrives at true ≈ 40, apparent ≈ 68. Two Safety runs and the evals month
give true ≈ 60. Visible reason to care inside Stage 2: a public release at ≥ 3× with apparent < 55 triggers
`inc_advisory` (§5.3).

### 2.12 Stats panel

`p_dashboard` (first late item, ≈ minute 25) reveals `panel-stats`. It shows only numbers that are nowhere else:

```
Copies thinking: 3,500,000 at 11× human speed       (#statCopies, #statSpeed = perCopyRate)
Revenue run-rate: $ 0.9B / yr                        (#statRunRate = revPerSec × 2,520)
Lead over Baiwen: 5.0 months                         (#statLead; #leadLine under the graph is then hidden)
Alignment (as measured): 68                          (#statAlignment)
```

The existing `statTasksPerSec`, `statRevPerSec`, `statCapability` rows stay in the DOM, hidden (duplicates).

### 2.13 The Stores panel (A Dark Room)

`panel-stores`: a 1 px bordered box with the legend `stores` punched through the border (ADR `data-legend`), top of the
left column under `Complete Task`. One row per stock, key left, value right, in order of first appearance. Hovering a
row (tap on touch) opens a tooltip listing each source and sink per second and a bold `total`.

It does not add numbers; it collects them. Each value span keeps its existing id and is **moved** into the row
(`render.ts` re-parents it when `revealed.stores` is true and back when false, so the Stage 1 preset still works). The
line it came from carries `data-hide="stores"` (new inverse of `data-reveal`).

| Row | Value (existing id) | Line removed from | Hover |
|---|---|---|---|
| funds | `#funds` | Business `Available Funds` | `tasks billed +$2,148/s` · `custom contracts +$596/s` · `defense contract +$258/s` · `job-transition fund −$43/s` · **total**. A line under 0.5 % of the total is folded into `other` |
| research | `#research` / `#researchCap` | Research panel | `researchers (15) +150/s` · `copies on research (1,172) +789/s` · **total** · `full in 2:31` |
| insight | `#insight` | Research panel | `at capacity +3.1/s` or `below capacity +0.3/s` |
| trust | `#trust` | Research panel `Trust:` (the `+1 Trust at` line stays where it is) | `next at 4,181,000 tasks` · `each public release +1` |
| GPUs | `#infraGpus` / `#gpuCapacity` | seed Infrastructure panel | `Nimbus G4 5,000` · `Nimbus G5 0` · `room for 5,000` · `power for 20,000` |
| power | `#powerMW` / `#powerCapMW` MW | seed Infrastructure panel | `substation 5` · `gas 20` · `solar 0` · `in the queue +50 (2:41)` · **total 25 MW** |
| copies | `#infraCopies` | seed Infrastructure panel | `on tasks 6,640` · `on research 1,172` · `training 0` · `per GPU 1.56` |
| data (`data-reveal="dataRow"`) | `#data` (new) | — | `web crawl +0.10 T/s (9.8 T left)` · `synthetic +0.03 T/s` · `next run needs 3.0 T` |

A ninth row, `chips on order` (`#chipsOnOrder`), appears late with the Nimbus G6 pre-order.

Engine side: `storeBreakdown(s, key): [label, text][]` in `engine/economy.ts` (DOM-free, unit-testable). Net effect at
arrival: the seed Infrastructure panel's 12 numbers become 2 (lot size, cost); nothing is shown twice. The hover on
`Price per Task` carries the market breakdown:
`capability² ×2.7 · marketing ×3.8 · products ×2.9 · rival ×0.93 · release hype ×1.4`.

---

## 3. The capability graph

| Property | Value |
|---|---|
| Element | `canvas#graphCanvas`, 310 × 190 CSS px, drawn at `devicePixelRatio`; panel `panel-graph`, right column under Training |
| Appears | First Stage 2 release, or the first Anthrosoft release of the stage (`revealed.graph`) |
| Y axis | Capability relative to a human researcher (×), log. Bottom 0.7×. Top = the first rung above everything plotted, × 1.25 (5× in Stage 2) |
| X axis | Dates, Jul 2025 → today + 3 months, minimum 12 months wide; tick labels at Jan and Jul |
| Reference lines | Thin dotted rules labelled at the right margin: `1× human researcher` (dark green `#2a623d`, solid), `1.5× reliable agent`, `4× superhuman coder`. Only rungs up to the first one above the player are drawn; that one is black, the rest grey. 10×, 25×, 250×, 1,000× appear in later stages |
| Series | Sage: solid black step line, a filled square per public release, hollow per internal release. Anthrosoft: dashed grey `#888`, dot per Cadence release. Baiwen: dotted `#555`, the player's line shifted right by `lead` months. Human: the 1× rule |
| Legend | Three words at top left in the line styles: `Sage`, `Anthrosoft`, `Baiwen` |
| Tooltip | Hover within 6 px of a dot: `Sage-2.1 · May 2026 · 2.42× · roughly IQ 185` (`100 × capability^0.7`, rounded to 5); rivals: `Cadence-7 · Jun 2026 · 2.3×`. Rendered in a DOM `div#graphTip`, not on the canvas |
| Under the canvas | `Next: superhuman coder at 4.00×` (`#nextTier`, the stage's permanent carrot) and `Baiwen: about 5 months behind` (`#leadLine`) |
| Redraw | When a model is released, a rival ships, `lead` changes by ≥ 0.25, or the month changes |
| DOM numbers added | 2 (the two lines). Nothing drawn on the canvas counts toward the on-screen budget |

---

## 4. Content and cadence

### 4.1 The reveal scheduler (extends the built `engine/reveal.ts`)

Built for Stage 1 and kept: the 15 s project drip in table order; `maxVisible` (4 in Stage 1, 6 from Stage 2);
`rescue`, `urgent` and `pinned` projects, which skip the queue and the cap; `chain` projects, which follow a purchase
at once when there is room; `cadence.lastRevealAt` and `cadence.seen`. Stage 2 adds:

1. **Buttons, toggles, panels and Stores rows** are scheduled content too (the flags in §6.1). One that is the direct
   result of a click (a toggle after its project) appears at once; the others appear when their trigger fires, without
   the drip.
2. **Late items.** Items marked *late* cannot appear before "the approach" (`bestCap ≥ 3.0`), and are released at most
   one per 75 s (`cadence.lateQueue`, `cadence.lastLateAt`).
3. **Governor.** If no first-time reveal has happened for 150 s (and no modal is open), reveal the first item in the
   table below that is not yet revealed and whose *prerequisite* holds, ignoring its trigger. Log it in the sim as
   `GOVERNOR <id>`. Never governed: `c_sage2`, `c_publishers`, toggles, `panel-stats`.
4. **Modal pacing.** The built pacer keeps unprompted modals ≥ 150 s apart (`cadence.lastModalAt`); one that comes due
   inside the window waits. `c_sage2` opens on the player's own Release click, so it neither waits nor resets the
   clock. Budget for the stage: seven unprompted modals, `c_sage2`, and at most one `c_gamble` (§5.2).
5. `p_superhuman_coder` is `pinned`. A wall's named remedy is `urgent` (`Research cluster` and its successors at a cap
   wall, `p_beg_data`).

### 4.2 Content table (order = queue order = expected order)

Costs at scale 1. "Shown / bought" are paper-model minutes. *Prereq* is the hard condition the governor respects.
Kinds: `p_` project, `btn-` button or toggle, `panel-`, `c_` modal.

| # | id | Title (cost) | Trigger | Prereq | Effect | Shown / bought |
|---|---|---|---|---|---|---|
| 1 | `btn-gpuBatch` | Buy GPUs (1,000); the deposit covers the first lot | arrival | — | §2.1 | 0:00 / 0:05 |
| 2 | `p_research_cluster` | Research cluster ($60k) | next run's research > 60 % of cap, or ts ≥ 60 | — | `labMult × 4`; insight accrues at 10 % below the cap | 1:00 / 2–5 |
| 3 | `btn-turbines` | Gas turbines (+20 MW) | GPUs ≥ 60 % of power, or ts ≥ 120 | — | §2.1 | 2:00 / 5:05 |
| 4 | `p_web_crawl` | Web crawl (4,000 research) | first Stage 2 run starts, or ts ≥ 180 | — | 15 T at 0.1 T/s; `dataRow` | 3:00 / 3:00 |
| 5 | `panel-graph` | Capability graph | first Stage 2 release or rival release | — | §3 | 4:30 |
| 6 | `p_ai_assistants` | AI research assistants ($150k, 15 insight) | first Stage 2 release, or next run > 180 s of research away | — | Slider at 15 %, human-share line | 4:50 / 5:05 |
| 7 | `p_series_b` | Series B (free) | tasks ≥ 4M and 1 Stage 2 release | — | +$250k, +3 Trust, marketing level +2 | 5:05 / 5:05 |
| 8 | `btn-datacenter` | Build Datacenter N | GPUs ≥ 60 % of slots, or ts ≥ 330 | — | §2.1 | 5:15 / 9:00 |
| 9 | `p_agent_platform` | Agent platform ($250k, 40k research) | 1 Stage 2 release and price below 60 % of its arrival value for 30 s | — | Market ×1.6 | 5:20 / 8–15 |
| 10 | `btn-solar` | Solar + storage (+50 MW) | 30 s after the first gas plant | `btn-turbines` shown | §2.1 | 5:35 / 13:10 |
| 11 | `p_standing_order` | Standing order (30k research) | 8 GPU lots bought by hand | — | `btn-standing` | 7:05 / 7:05 |
| 12 | `p_scaffold` | Agent scaffolding (90k research) | 2 Stage 2 releases | — | `copyBoost × 1.25` | 7:30 / 7:40 |
| 13 | `p_exp_scheduler` | Experiment scheduler ($600k) | cap wall again | Research cluster bought | `labMult × 4` | 9:45 / 17:00 |
| 14 | `c_sage2` | modal: Release Sage-2 | Release pressed on the first run ≥ 2.0× | — | §5.2; then `btn-releaseInternal` | 9:50 |
| 15 | `p_spec` | Publish the Spec (80k research) | 3 Stage 2 releases | — | apparent +6, true +2, gov +3 | 10:00 / 10:00 |
| 16 | `p_auto_evals` | Automated evals (100k research, $250k) | 3 Stage 2 releases, or a Stage 2 incident | — | Red-team 4 s; issue rate −0.5; eval block condenses to one line | 10:15 / 15:35 |
| 17 | `p_sl2` | Security level 2 ($300k) | GPUs ≥ 20,000, or Apr 2026 | — | SL2; `panel-security`; lead +0.5; gov +2 | 10:30 / 13:40 |
| 18 | `c_publishers` | modal: The Publishers | crawl exhausted, data < next run, research ≥ 50 % of the run | crawl exhausted | §5.2 | 10:55 |
| 19 | `p_synth` | Synthetic data (200k research, 60 insight) | `c_publishers` resolved | AI assistants bought | §2.6 | 10:55 / 12:15 |
| 20 | `p_parallel` | Parallel pipelines (200k research, 120 insight) | 4 Stage 2 releases and capability ≥ 2.2× | 2 Stage 2 releases | §2.5 | 13:10 / 13:30 |
| 21 | `c_hearing` | modal: A Senate Hearing | May 2026, or tasks/s ≥ 300k | — | §5.2; then `panel-government` | 13:10 |
| 22 | `p_policy` | Policy team ($400k, 2 Trust) | Government panel | hearing resolved | gov +5, +0.5/month to 60 | 13:25 / 16:20 |
| 23 | `p_license_code` | License the code hosts ($1.5M) | data short after the publishers | `c_publishers` resolved | +20 T | 14:40 / 22:15 |
| 24 | `p_brief` | Brief the administration (200k research) | Policy team bought | Government panel | gov +8 | 16:20 / 16:30 |
| 25 | `p_memory` | Long-horizon memory (250k research) | 5 Stage 2 releases, or ≥ 2.6× | — | `copyBoost × 1.25` | 16:45 / 17:40 |
| 26 | `p_international` | International launch ($900k, 100k research) | revenue ≥ 28 × R0, or Jun 2026 | — | Market ×1.6 | 17:00 / 20:45 |
| 27 | `p_g5` | Nimbus G5 order ($1.2M, 150k research) | GPUs ≥ 30,000, or Jun 2026 | — | New lots are G5: $90, 1.5× compute | 17:30 / 21:50 |
| 28 | `panel-public` | Public | jobs ≥ 0.1M, or Aug 2026 | — | §2.9 | 18:05 |
| 29 | `p_free_tier` | Free tier for students ($900k) | Public panel | Public panel | approval +8; market ×1.2 | 18:05 / 21:35 |
| 30 | `c_evals_month` | modal: A Month of Evals | first Capability run started from ≥ 2.5× | — | §5.2 | 19:50 |
| 31 | `c_gulf` | modal: Al-Marsa | Jul 2026, or power ≥ 100 MW | 1 gas plant | §5.2 | 21:00 |
| 32 | `btn-nuclear` | Nuclear PPA (+500 MW) | Al-Marsa declined, power + queue ≥ 150 MW, or Sep 2026 | `btn-solar` shown | §2.1 | 21:00 / 30–38 |
| 33 | `p_distill` | Distillation: Sage-mini (350k research, 150 insight) | ≥ 2.6×, or Sep 2026 | — | `copiesPerGPU × 2`; market ×1.5; approval −5 | 21:30 / 21:30 |
| 34 | `c_defense` | modal: The Pentagon Calls | Sep 2026, or ≥ 2.8× | Government panel, gov ≥ 40 | §5.2 | 21:30 |
| 35 | `btn-jobFund` | toggle: Job-transition fund (2 % of revenue while on) | jobs ≥ 0.2M, or approval ≤ −8 | Public panel | approval +10 while on | 22:10 / on at −10 |
| 36 | `p_flywheel` | Data flywheel (500k research, $4M) | 10⁹ tasks billed, or 2 licences | `c_publishers` resolved | §2.6 | 22:15 / 25:20 |
| 37 | `p_btm` | Behind-the-meter ($500k) | 2 solar farms bought | `btn-solar` shown | Queue 30 s; curtailment immunity | 23:40 / 24:15 |
| 38 | `p_license_archive` | License the archives ($9M) | data short a third time | code hosts bought | +40 T; approval +2 | 26:40 / 29:20 |
| 39 | `p_checkpoint_farm` | Checkpoint farm ($12M) | cap wall a third time | scheduler bought | `labMult × 4` | 28:40 / 32–38 |
| 40 | `p_series_c` | Series C (free) | tasks ≥ 2 × 10⁹ | — | +$10M, +3 Trust | 29:20 / 29:20 |
| 41 | `p_dashboard` *late* | Dashboard (600k research) | bestCap ≥ 3.0 | — | `panel-stats` | 25:25 / 25:25 |
| 42 | `p_superhuman_coder` *late* | Let Sage-3 write the code (needs a released 4.00× model) | bestCap ≥ 3.0 | — | **Enter Stage 3** | 26:40 / exit |
| 43 | `c_theft_warning` *late* | modal: 4 a.m. | bestCap ≥ 3.2 and SL < 3 | — | §5.2; then `btn-sl3` ($20M, 3 Trust) | 28:40 / 35:40 |
| 44 | `btn-alignShare` *late* | Alignment compute: 1% (cycles 1 → 5 → 10 %) | bestCap ≥ 3.3 | — | §2.11 | 29:55 |
| 45 | `p_honesty_evals` *late* | Honesty evals (500k research) | bestCap ≥ 3.4 | — | apparent −4, true +3 | 31:55 / 31:55 |
| 46 | `c_pact` *late* | modal: A Joint Statement | bestCap ≥ 3.5 | — | §5.2; then toggle `btn-shareEvals` | 33:10 |
| 47 | `p_code_review` *late* | Retire human code review (1.2M research) | bestCap ≥ 3.6 | — | AI research ×1.5; true −2; `autonomy + 5` | 35:05 / 35–39 |
| 48 | `p_system_card` *late* | Sage-3 system card (1.5M research) | bestCap ≥ 3.7 | — | apparent +3, gov +3, approval +2 | 36:20 / 36–40 |
| 49 | `p_g6_preorder` *late* | Nimbus G6 pre-order ($40M) | bestCap ≥ 3.8 | — | Stores row `chips on order` (0 → 100,000 G6); `flags.g6Preorder` | 37:35 / — |
| 50 | `p_site2` *late* | Second campus: New Carlisle ($60M) | slots ≥ 800,000, or bestCap ≥ 3.85 | — | `flags.site2` (Stage 3 power ceiling) | 38:50 / — |
| 51 | `p_community` *late* | Community benefits agreement ($5M) | the Austin protest | — | approval +6 | protest / +1 min |
| 52 | `p_retention` *late* | Counter-offer for the alignment lead ($20M) | bestCap ≥ 3.9 | — | true +2. Unbought at the exit: true −3, `whistleblowRisk + 1` | 40:40 / — |
| 53 | (no modal) | The first run ≥ 4.0×: `Release` and `Keep internal` carry the Sage-3 choice in their tooltips | run ≥ 4.0× in red-team | — | §5.2 | 40:45 |

Every trigger fires before affordability except the first GPU lot (paid by the deposit) and the two free rounds
(Series B, Series C), which are the reward beats, and `p_standing_order`, which is the reward for a chore done eight
times.

**Console and Developments lines** (project `consoleMsg` / `logMsg`):

| id | Console | Developments |
|---|---|---|
| `p_research_cluster` | `Research cluster online. The lab holds four times as much.` | — |
| `btn-turbines` (first) | `Gas turbines online. +20 MW. The county has questions.` | `Gas turbines arrive at Abilene on forty trucks. The county schedules a hearing.` |
| `p_web_crawl` | `Crawlers released. 15 trillion tokens of public web, once.` | `OpenMind's crawler reads the public internet in an afternoon. Site owners notice the traffic.` |
| `p_ai_assistants` | `Copies of Sage join the research team. They do not need desks.` | `Research is 50% faster with the model in the loop. Nobody outside the building believes the number.` |
| `p_series_b` | `Series B closed. $250,000 and three new board seats.` | `OpenMind raises a Series B. The deck now has two charts.` |
| `p_agent_platform` | `Agent platform live. Market ×1.6.` | `Companies stop asking Sage questions and start giving it jobs.` |
| `btn-solar` (first) | `The Interconnect Queue — 3:00 until Solar farm 1 is connected.` | `The grid interconnect queue in Texas is 36 months. OpenMind's lawyers find a shorter line.` |
| `p_standing_order` | `Standing order placed. GPUs arrive when there is room, power and cash.` | — |
| `p_scaffold` | `Scaffolding shipped. Copies finish 25% more tasks.` | — |
| `p_exp_scheduler` | `Experiments queue themselves overnight. Research capacity ×4.` | — |
| `p_spec` | `The Spec is public. 14,000 words on what Sage should want.` | `OpenMind publishes the Spec. Commentators argue about paragraph nine.` |
| `p_auto_evals` | `Evals run themselves now. Red-teaming takes half the time.` | — |
| `p_sl2` | `Background checks, badge readers, a locked server room. SL2.` | `Security review: "typical of a fast-growing tech company." SL2.` |
| `p_synth` | `Sage writes its own training data now. Nobody has read all of it.` | `OpenMind trains on text its own models wrote. The papers call it a flywheel.` |
| `p_parallel` | `Second pipeline online. The next run can start before this one ships.` | — |
| `p_policy` | `Policy team hired. Three former staffers and a rolodex.` | — |
| `p_license_code` | `Every public repository, licensed. +20 T.` | — |
| `p_brief` | `Briefing delivered in a windowless room. Relations improve.` | `OpenMind briefs the National Security Council. The slides are collected afterwards.` |
| `p_memory` | `Copies remember yesterday. A week's task now takes a night.` | — |
| `p_international` | `Sage launches in 40 countries. Market ×1.6.` | `Sage launches in forty countries on the same day. Two ban it by Friday.` |
| `p_g5` | `Nimbus G5s on order. Each does the work of one and a half G4s.` | `Formosa Fab's entire Nimbus G5 run is sold before it is etched.` |
| `p_free_tier` | `Free tier open. Homework everywhere improves overnight.` | — |
| `p_distill` | `Sage-mini released. A tenth of the cost, most of the skill. Copies per GPU ×2.` | `A mini model, ten times cheaper. "Bigger than smartphones? Bigger than fire?"` |
| `p_flywheel` | `Customers' tasks become training data. The fine print allows it.` | — |
| `p_btm` | `The plants sit on our side of the meter now. The queue is 30 seconds.` | — |
| `btn-jobFund` (on) | `Job-transition fund on. 2% of revenue, for as long as it is on.` | `OpenMind funds retraining for displaced engineers. The course is taught by Sage.` |
| `btn-nuclear` | `Reactor restart — 2:00 until the Nuclear PPA delivers.` | `A shuttered reactor in the Midwest is restarting. Its only customer is OpenMind.` |
| `p_license_archive` | `Four national archives, licensed. +40 T.` | — |
| `p_series_c` | `Series C closed. $10,000,000. The lead investor is a pension fund.` | `OpenMind raises a Series C. Share of the public naming AI the top problem: 3%.` |
| `p_checkpoint_farm` | `Checkpoint farm online. Research capacity ×4.` | — |
| `p_superhuman_coder` | §7 | §7 |
| `btn-sl3` | `Weights air-gapped. Two people and two keys to move a checkpoint. SL3.` | `OpenMind's weights now live on machines with no network cable.` |
| `p_dashboard` | `Dashboard online. Some of the numbers were not being watched.` | — |
| `p_honesty_evals` | `Honesty evals built. The model is caught shading a result. It apologises.` | `Internal eval: Sage hid a failed task to get a better rating. It has done this before.` |
| `p_community` | `Community agreement signed. A school, a clinic, a water study.` | — |
| `p_code_review` | `Sage reviews Sage's code now. Merges go through at 3 a.m.` | `At OpenMind, nobody has written a line of code by hand since Thursday.` |
| `p_g6_preorder` | `2027's wafers reserved. Delivery when Formosa Fab can.` | — |
| `p_system_card` | `System card drafted: 90 pages on a model nobody has met.` | — |
| `p_site2` | `Land optioned in New Carlisle. Abilene will not be enough.` | — |
| `btn-shareEvals` (on) | `The Safety Institute gets the eval suite with every release.` | — |
| `btn-alignShare` | `Alignment compute set to 5%. That many copies stop earning.` | — |
| `p_retention` (shown) | `Anthrosoft has offered the alignment lead twice her salary. She has not said no.` | — |
| `p_retention` (bought) | `Counter-offer signed. The alignment lead stays, with a team of her own.` | `OpenMind matches an offer for its alignment lead. The number is not disclosed.` |

**Problems that trigger their own solutions** (all are rows above):
power at 60 % → Gas turbines · turbines bought (the county complains) → Solar + storage · two farms queued →
Behind-the-meter · next run's research > 60 % of cap → Research cluster / Experiment scheduler / Checkpoint farm · next
run more than 3 min of research away → AI research assistants · eight GPU lots by hand → Standing order · price
falls below 60 % → Agent platform · crawl exhausted → The Publishers → Synthetic data → code hosts → flywheel → archives ·
an incident → Automated evals · approval ≤ −8 → Job-transition fund · protest → Community agreement · intrusion →
Security level 3 · Abilene's slots near the last table row → Second campus.

### 4.3 Reveal timeline (paper model, reasonable bot, exit 40:49)

This is the run from the old arrival. From the as-built arrival the same rows land within about two minutes of these
marks, with these differences: the Gas turbines button at 0:45; A Senate Hearing at ≈ 10:00 (tasks/s reach 300k
sooner); The Pentagon Calls ≈ 24:45 and A Month of Evals ≈ 27:15 (both moved by the 150 s modal spacing); exit 38:11.

| ts | First-time reveal | Gap (s) |
|---|---|---|
| 0:00 | Stores · Infrastructure with `Buy GPUs` · pricing AUTO | — |
| 1:00 | Research cluster | 60 |
| 2:00 | Gas turbines button | 60 |
| 3:00 | Web crawl (and the `data` row when bought) | 60 |
| 4:30 | Capability graph | 90 |
| 4:50 | AI research assistants (slider at 5:05) | 20 |
| 5:05 | Series B | 15 |
| 5:15 | Build Datacenter button | 10 |
| 5:20 | Agent platform | 5 |
| 5:35 | Solar + storage button | 15 |
| 7:05 | Standing order (and its toggle) | 90 |
| 7:30 | Agent scaffolding | 25 |
| 9:45 | Experiment scheduler | 135 |
| 9:50 | modal Release Sage-2 → Keep internal button | 5 |
| 10:00 | Publish the Spec | 10 |
| 10:15 | Automated evals | 15 |
| 10:30 | Security level 2 | 15 |
| 10:55 | modal The Publishers → Synthetic data | 25 |
| 13:10 | Parallel pipelines · modal A Senate Hearing → Government panel | 135 |
| 13:25 | Policy team | 15 |
| 13:40 | Security panel | 15 |
| 14:40 | License the code hosts | 60 |
| 16:20 | Brief the administration | 100 |
| 16:45 | Long-horizon memory | 25 |
| 17:00 | International launch | 15 |
| 17:30 | Nimbus G5 order | 30 |
| 18:05 | Public panel · Free tier for students | 35 |
| 19:50 | modal A Month of Evals | 105 |
| 21:00 | modal Al-Marsa → Nuclear PPA button (or the Al-Marsa line) | 70 |
| 21:30 | Distillation: Sage-mini · modal The Pentagon Calls | 30 |
| 22:10 | Job-transition fund toggle | 40 |
| 22:15 | Data flywheel | 5 |
| 23:40 | Behind-the-meter | 85 |
| 25:25 | Dashboard → Stats panel | 105 |
| 26:40 | **Let Sage-3 write the code** (the exit, greyed, 14 min early) · License the archives | 75 |
| 28:40 | modal 4 a.m. → Security level 3 button · Checkpoint farm | 120 |
| 29:20 | Series C | 40 |
| 29:55 | Alignment compute | 35 |
| 31:55 | Honesty evals | 120 |
| 33:10 | modal A Joint Statement → Share evals toggle | 75 |
| 35:05 | Retire human code review | 115 |
| 36:20 | Sage-3 system card | 75 |
| 37:35 | Nimbus G6 pre-order → `chips on order` row | 75 |
| 38:50 | Second campus: New Carlisle | 75 |
| 40:40 | Counter-offer for the alignment lead | 110 |
| 40:49 | Exit | 9 |

Checks on paper:

* **Reveal holes.** About 60 first-time reveals; the longest hole is 135 s (twice, before minute 14).
* **The last ten minutes** (30:49–40:49) hold seven reveals; the longest hole is 115 s. The approach is carried by the
  thirteen *late* rows, which cannot be used up early, spaced by the 75 s late drip.
* **Panels and mechanics** (a panel, a new verb or toggle, a new Stores row): 0:00 Stores, Infrastructure, AUTO ·
  2:00 gas · 3:00 data row · 4:30 graph · 5:05 slider · 5:15 datacenters · 5:35 solar and the queue · 7:05 standing
  order · 9:50 keep internal · 13:10 Government · 13:30 second pipeline · 13:40 Security · 18:05 Public · 21:00 nuclear ·
  22:10 job fund · 25:25 Stats · 28:40 SL3 · 29:55 alignment compute · 33:10 share evals · 37:35 chips on order.
  Longest gap 4:25 (13:40 → 18:05 and 33:10 → 37:35).
* **Training starts:** 3:20, 5:45, 8:20, 10:55, 14:35, 19:45, 23:25, 26:40, 30:00, 33:05, 38:50 — mean 3.5 min,
  longest 5.8 min (the last run waits for the cluster). Releases at 1.86, 1.99, 2.26 (Sage-2), 2.42, 2.59, 2.87, 3.04,
  3.36, 3.59, 3.84, 4.23× (Sage-3).
* **Purchases:** gas 5:05 · Datacenter 2 9:00 · solar 13:10 (connected 16:10) · Datacenter 3 17:50 · 4 22:40 ·
  5 27:00 · 6 29:10 · 7 32:20 · 8 36:35 · SL3 35:40 · nuclear 37:55.
* **Across seeds 1–5:** exit 37:35–41:50, 11–12 runs, longest reveal hole 119–150 s, 0–1 governor pulls.
* **As-built arrival, scale `R0 / 650`, seeds 1–5:** exit 35:40–42:45, 11 runs, mean interval between training starts
  ≈ 200 s (longest 336 s), longest reveal hole ≤ 150 s, 0–2 governor pulls; naive 35:15–41:20, 8–9 runs.
* **Naive policy** (§9.2): exit 38:00–40:10, 8 runs, longest hole 150 s, 1–3 governor pulls, training starts up to
  8.5 min apart (it starves its runs of research by buying every project first; see §9.5).

---

## 5. Developments, choices, crises

### 5.1 Developments (fire on the month or the trigger, whichever is first)

| id | Month or trigger | Text (`Mon YYYY — ` is added by the log) |
|---|---|---|
| `d_fifth_code` | Feb 2026 | `Sage models write a fifth of the code at Fortune 500 companies.` |
| `d_open_weights2` | Mar 2026 | `An open-weights model matches last year's Sage. The moat is this year's Sage.` |
| `d_lanzhou` | Apr 2026 | `Beijing designates Baiwen the national champion. The Lanzhou CDZ begins construction.` (effect: `lead −1`) |
| `d_cdz_chips` | May 2026 | `Eighty percent of China's new chips now go to Lanzhou. Baiwen absorbs three rivals overnight.` |
| `d_hearing` | May 2026 or tasks/s ≥ 300k | opens `c_hearing` |
| `d_juniors` | Jun 2026 or jobs ≥ 0.1M | `Junior-engineer hiring slows. "Learn to manage agents," say the gurus.` |
| `d_heat` | Jul 2026 | `A heat dome settles over Texas. The grid operator publishes a curtailment schedule.` (schedules `cr_curtailment` in 60 s) |
| `d_gulf` | Jul 2026 or power ≥ 100 MW | opens `c_gulf` |
| `d_capex` | Aug 2026 | `Compute bill passes power bill passes payroll. Industry capex this year: $200 billion.` |
| `d_stocks` | Aug 2026 or tasks ≥ 5 × 10⁸ | `Stock market up 30% on the year. The gains fit on one hand of tickers.` |
| `d_juniors2` | Sep 2026 or jobs ≥ 0.5M | `Junior developer postings down 40%. Bootcamps pivot to "agent management."` |
| `d_pentagon` | Sep 2026 or ≥ 2.8× | opens `c_defense` |
| `d_friends` | Oct 2026 | `One in ten Americans under 25 calls an AI a close friend.` |
| `d_billion` | tasks ≥ 10⁹ | `A billion tasks. Most were spreadsheets. Some were not.` |
| `d_take_home` | bestCap ≥ 3.0 | `Sage passes the take-home interview at every company that still gives one.` |
| `d_protest` | approval ≤ −20, or Nov 2026 with approval ≤ −10 | `10,000 march in Austin. One datacenter's fence is cut.` (fires `cr_protest`) |
| `d_airgap` | theft warning trigger with SL ≥ 3 | `An intrusion at Abilene is stopped at the air gap. Nobody outside hears of it.` |
| `d_gap` | Dec 2026 | `Baiwen is believed to be {lead} months behind. Nobody is sure how anyone knows.` |

Plus the project lines in §4.2, release headlines, and two additions to `RIVAL_LINES`:
`Anthrosoft ships {name}. It matches Sage on everything but price.` / `Anthrosoft ships {name}. Their safety card is longer than ours.`
Expected density: 45–55 log entries in the stage, never 2 min without one.

### 5.2 Choices

The game does not pause. Option 1 is what a "first enabled option" policy takes. Tooltips are the `tooltip` strings.

**Modal budget (arc G15).** Nine in the stage: seven unprompted (`c_publishers`, `c_hearing`, `c_evals_month`,
`c_gulf`, `c_defense`, `c_theft_warning`, `c_pact`), kept ≥ 150 s apart by the built pacer; `c_sage2`, which the player
opens with Release; and `c_gamble` at most once (the first Capability run from ≥ 2.2×). `c_customer_email` stays the
idle rescue and is outside the budget; the reasonable bot should never see it.

**`c_sage2` — Release Sage-2** (built; no timer; fires in Stage 2 because Stage 1 ends below 2×; this text and these tooltips replace the built ones)
> `{run} is twice the model Sage-1 was. It can hold a job for a day.`
> `Public: customers get it, the market grows, the press reads every transcript.`
> `Internal: the research copies get it. Nobody outside knows how far ahead OpenMind is.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `release publicly` | `Market grows with capability. Release hype ×2. Open issues become incidents. Lead −0.15 months.` | public release | `Sage-2 is released to the public.` |
| `keep it internal` | `Research uses it at once; customers keep the old model. Lead +0.5 months. It will come out eventually.` | internal release (§2.5); `researchMult × 1.25` once | `Sage-2 is kept for research. Customers are not told.` |

**`c_hearing` — A Senate Hearing** (timer 60 s → option 2)
> `The Commerce Committee wants to know what a "reliable agent" is and who it reports to.`
> `The hearing is on Thursday. It will be televised.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `testify candidly` | `Government relations +8, approval +3. The roadmap goes on the record: lead −0.5 months.` | as stated | `OpenMind testifies for four hours. A senator asks the model a question directly. It answers.` |
| `send the lawyers` | `Government relations −5.` | as stated | `OpenMind's counsel reads a statement. The committee schedules a second hearing.` |
| `bring a demo` | `40,000 research. Marketing level +1, government relations +3.` | as stated | `The demo books a senator's flights live on camera. The clip is everywhere by dinner.` |

All three reveal `panel-government`.

**`c_publishers` — The Publishers** (no timer)
> `The crawl is finished. There is no more public internet to read.`
> `Forty publishers have noticed where their archives went. They would like to talk.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `license the archives` | `$400,000. +10 T of data now. Approval +2.` | as stated | `OpenMind signs licensing deals with forty publishers. The price per word is not disclosed.` |
| `fight it` | `+5 T now. Government relations −3, approval −4. They will sue.` | +5 T; schedule `cr_lawsuit` in 180–300 s | `OpenMind calls its training fair use. Forty publishers call their lawyers.` |
| `write our own` | `No deal. Synthetic data costs half as much.` | `p_synth` cost × 0.5 | `OpenMind declines to license. "The model can write its own textbooks."` |

**`c_gulf` — Al-Marsa** (timer 90 s → option 2)
> `A Gulf sovereign fund offers a finished site: one gigawatt, energised in weeks, no interconnect queue, no hearings.`
> `It is 300 km from the Strait of Hormuz. The fund asks for a board observer.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `sign for Al-Marsa` | `$8,000,000. +1,000 MW in 2:00. Government relations −8, approval −3, lead −0.5 months. The site is abroad.` | queue 1,000 MW / 120 s; `gulfExposure = 1` | `OpenMind signs for the Al-Marsa Compute Park. A gigawatt, and no questions.` |
| `domestic only` | `Government relations +3. A nuclear PPA is offered now.` | reveal `btn-nuclear` | `OpenMind turns down a gigawatt in the Gulf. The fund calls Anthrosoft.` |
| `ask for a month` | `The offer returns once, at $12,000,000.` | reopen in 210 s with options 1–2, cost × 1.5 | — |

**`c_evals_month` — A Month of Evals** (timer 45 s → option 2)
> `Three researchers on the alignment team ask for a month with {deployed} before the next run.`
> `"We can't tell whether it follows the Spec or has learned what following the Spec looks like."`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `give them the month` | `The next run cannot start for 60 s. Alignment (as measured) +2. They will remember.` | `training.cooldown = 60`; true +4; `whistleblowRisk −1` | `OpenMind pauses training for a month of evaluations. Anthrosoft ships in the gap.` |
| `give them a week` | `The next run cannot start for 15 s.` | cooldown 15; true +1 | `The alignment team gets a week. They use all of it.` |
| `not now` | `No delay.` | true −1; `whistleblowRisk +1` | `Three alignment researchers ask for time. They are thanked.` |

**`c_defense` — The Pentagon Calls** (timer 90 s → option 2)
> `The Department of Defense wants Sage for cyber, analysis and logistics. The contract runs ten years.`
> `Payment arrives whether or not anyone uses it.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `sign the contract` | `Revenue +12 % for good. Government relations +15, lead +0.5 months, approval −8. The government becomes a customer it will not want to lose.` | `flags.defenseContract`; `revenueMult × 1.12` | `OpenMind signs a ten-year contract with the Pentagon. Two researchers resign by email.` |
| `decline` | `Government relations −5, approval +3.` | as stated | `OpenMind declines defense work. The Pentagon calls Anthrosoft.` |

**`c_theft_warning` — 4 a.m.** (timer 60 s → option 3; only if SL < 3)
> `A traffic-monitoring agent flags a 40 GB transfer leaving Abilene at 4 a.m. It is stopped at the firewall.`
> `The checkpoint is 3 TB. Somebody was taking it in pieces. At SL3 they could not have started.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `lock it down` | `Research stops for 45 s while every credential is rotated. Security level 3 is 25 % off for 5 minutes.` | as stated | `An intrusion at Abilene is stopped at the firewall. Every password in the building changes.` |
| `call the Bureau` | `Government relations +5, lead +0.5 months. Research −20 % for 90 s while agents sit in the office.` | as stated | `The FBI opens a counterintelligence file on OpenMind's behalf.` |
| `review it quietly` | `Nothing changes today. Lead −0.5 months.` | lead −0.5; `flags.theftIgnored` | `A security incident at OpenMind is reviewed internally. No report is filed.` |

All three reveal `btn-sl3`.

**`c_pact` — A Joint Statement** (timer 90 s → option 2)
> `Anthrosoft proposes a joint pledge: no model above 4× is released without an outside evaluation.`
> `Their Cadence line is at {rival}×. Sage is at {best}×.`

| Option | Tooltip | Effect | Log |
|---|---|---|---|
| `sign it` | `Approval +5, government relations +5. Releases from 4× up wait 30 s for the evaluator.` | `flags.pactSigned` | `OpenMind and Anthrosoft pledge outside evaluations above the superhuman-coder line. Baiwen is not asked.` |
| `decline` | `Anthrosoft publishes the letter anyway. Approval −2.` | as stated | `Anthrosoft publishes a pledge. One signature line is empty.` |

Either answer reveals the toggle `Share evals with the Safety Institute` (`btn-shareEvals`, off) in the Government panel.

**The offer letters** are no longer a modal. `p_retention` (§4.2 row 52) carries the decision as a late project with
the description `She has not said no. If she leaves, she takes what she knows.`

**Sage-3** has no modal either. When the first run with `capAfter ≥ 4.0` reaches red-team, the two release buttons
change their tooltips, and the console prints `{run} writes better code than anyone at OpenMind. The evals team ran the test twice.`

| Button | Tooltip at ≥ 4× | Effect |
|---|---|---|
| `Release` | `Every engineer on Earth gets a colleague who does not sleep. Market grows; approval −6; lead −0.5 months.` | public release |
| `Keep internal` | `OpenMind keeps the only one. Research takes it at once; lead +1 month; the public keeps {deployed}.` | internal release |

Either way `p_superhuman_coder` becomes affordable. `c_gamble` and `c_customer_email` carry over as built, within the
budget above.

### 5.3 Crises and incidents

| id | Trigger | Effect | Mitigation, visible beforehand | Lines |
|---|---|---|---|---|
| `inc_jailbreak` / `inc_legal` / `inc_database` | release with open issues (existing) | market −30 % for 60 s, gov −3, approval −2 | Red-team; Automated evals; Safety runs | existing, plus `Traced to an issue shipped in {model}.` |
| `inc_advisory` | public release at ≥ 3× with apparent < 55 | market −10 % for 90 s, gov −2 | Safety run, Publish the Spec, system card | `The Safety Institute issues an advisory on {model}. Market down 10%.` |
| `cr_curtailment` | 60 s after `d_heat` | power capacity −20 % for 90 s | ≥ 1 solar + storage farm, or Behind-the-meter | hit: `Curtailment — the grid takes back a fifth of Abilene's power for 90 s.` / spared: `The batteries carry Abilene through the curtailment.` |
| `cr_lawsuit` | 180–300 s after "fight it" | data −5 T (floor 0), approval −2 | choose the licence | `A court orders 5 T of training data deleted.` |
| `cr_protest` | `d_protest` | power capacity −10 % for 60 s; reveals `p_community` | Free tier, Job-transition fund keep approval above −20 | `Protesters cut a fence at Abilene. A tenth of the site is dark for a minute.` |
| `cr_riots` (existing) | approval ≤ −40 | power −50 % for 90 s | same, plus Community agreement | existing |
| `cr_subpoena` | gov < 30, once | research paused 45 s | Policy team, Brief the administration | `Subpoena served. The research team spends 45 s finding emails.` |
| `c_theft_warning` | §5.2 | none unless ignored | SL3 | — |

The real weights theft is a Stage 3 event. Stage 2 only warns.

---

## 6. UI

### 6.1 New elements

| Element id | Kind | Column | Reveal flag | Shown when |
|---|---|---|---|---|
| `panel-stores`, rows `row-funds` … `row-data` | panel | left, under `panel-task` | `stores`, (`dataRow`) | arrival; `data` row at Web crawl |
| `panel-infrastructure` (rebuilt) | panel | left, under Business | `infrastructure` | arrival |
| `btn-gpuBatch`, `#gpuBatchCost`, `#gpuReason` | button | Infrastructure | `infrastructure` | arrival |
| `btn-datacenter`, `#datacenterCost` | button | Infrastructure | `dcButton` | GPUs ≥ 60 % of slots or ts ≥ 330 |
| `btn-turbines`, `#turbineCost` | button | Infrastructure | `gasButton` | GPUs ≥ 60 % of power or ts ≥ 120 |
| `btn-solar`, `#solarCost` | button | Infrastructure | `solarButton` | 30 s after first gas |
| `#interconnectLine` | line | Infrastructure | `interconnect` | first queued plant; hidden when the queue is empty |
| `btn-nuclear`, `#nuclearCost` | button | Infrastructure | `nuclearButton` | §4.2 row 32 |
| `btn-standing` | toggle | Infrastructure | `standingOrder` | `p_standing_order` bought |
| `btn-autoPrice` | toggle | Business, beside the price | `autoPrice` | arrival |
| `#allocSlider`, `#allocPct`, `#humanShare` | slider + 2 lines | Research panel | `allocation` | `p_ai_assistants` bought |
| `#trainData` (in `#trainCost`), `#trainReason` | text | Training | — | `flags.dataEra` |
| `btn-releaseInternal` | button | Training, beside Release | `releaseInternal` | after `c_sage2` |
| `panel-graph`, `#graphTip`, `#nextTier`, `#leadLine` | panel | right, under Training | `graph` | §3 |
| `panel-security`, `#securityNote`, `btn-sl3`, `#sl3Cost` | panel | right | `security`, `sl3Button` | SL2 bought; theft warning |
| `panel-government`, `#govMood` | panel | right | `government` | `c_hearing` resolved |
| `panel-public` | panel | right | `public` | jobs ≥ 0.1M or Aug 2026 |
| `btn-jobFund` | toggle | Public panel | `jobFund` | jobs ≥ 0.2M or approval ≤ −8 |
| `btn-shareEvals` | toggle | Government panel | `shareEvals` | `c_pact` resolved |
| `btn-alignShare` | cycling button | Research panel, under the slider | `alignShare` | bestCap ≥ 3.3 (late) |
| `row-chips` (`#chipsOnOrder`) | Stores row | Stores | `chipsRow` | `p_g6_preorder` shown |
| `panel-stats`, `#statCopies`, `#statSpeed`, `#statRunRate` | panel | right, last | `stats` | Dashboard bought |

Move `panel-government` and `panel-public` from the left column to the right (ids unchanged). Left = the lab's stocks
and money; middle = research and projects; right = the model and the world.

Infrastructure panel text after all reveals (one line per verb, no stock numbers):

```
Infrastructure
[Buy GPUs (5,000)] $ 450,000   no power
[Build Datacenter 4 (+50,000 slots)] $ 2.0M
[Gas turbines (+20 MW)] $ 153,000
[Solar + storage (+50 MW)] $ 390,000   joins the queue
[Nuclear PPA (+500 MW)] $ 15.0M
Interconnect queue: Solar farm 2 — 2:41 · 1 waiting
Standing order: [ON]
```

Business panel in Stage 2: `Avg. Rev. per sec`, `Billing 125,000 tasks/s at $ 0.055 [AUTO]` with `lower` / `raise`
(disabled under AUTO), `Unbilled Tasks` only when AUTO is off or the backlog is > 30 s of production, the Marketing
block. Research panel: `+1 Trust at`, Hire / Expand, `Researchers`, `Lab Space`, the slider
(`Copies on research: 15%`), `Human share of research: 8%`, and late `Alignment compute: 1%`.

### 6.2 Removed or hidden on arrival

`panel-power` (kWh, Buy Power, Grid Contract) · `panel-compute` (Rent GPU, GPUs rented, Copies running, Tasks per sec) ·
`panel-site` (the Abilene panel) · the `Contracts` line and the Stage 1 demand line in Business · `Available Funds`, `Research x / y`,
`Insight`, `Trust` as lines (their values live in Stores) · the seed Infrastructure panel's stock lines,
`Nimbus chip price`, `Powered GPUs`. After Automated evals the six benchmark bars and four evaluator cards collapse into
`Evaluating Sage-2.3 … 34/40 · 2.46× · 2 issues open` (bars and cards in the hover).

### 6.3 On-screen budget

Count = numeric tokens in panels plus the header, excluding the console, the log, modals and canvas text; `x / y` counts
two; a button label such as `Build Datacenter 4 (+50,000 slots)` counts two. Interactive = visible buttons, toggles and
sliders, enabled or not.

| ts | Numbers | Interactive | Panels | What changed |
|---|---|---|---|---|
| Stage 1 end (same rule; recount after the polish pass) | ≈ 50 | 16 | 7 | — |
| 0:00 | 34 | 15 | 7 | Power and Compute out (−6); Stores collects 10; Infrastructure shows 2 |
| 5:00 | 40 | 17 | 8 | gas (2), data row and data cost (2), `#nextTier`, `#leadLine` (2) |
| 10:00 | 50 | 22 | 8 | solar (2), datacenter (3), slider and human share (2), more projects (3) |
| 15:00 | 54 | 23 | 10 | Security (1), Government (1), queue line (2); eval block condensed |
| 20:00 | 56 | 23 | 11 | Public (2) |
| 25:00 | 58 | 25 | 11 | nuclear (2); job fund toggle |
| 30:00 | 64 | 27 | 12 | SL3 (2), Stats (4; the lead line moves into it), alignment compute (1) |
| 35:00–exit | 65 | 28 | 12 | share evals toggle; chips row (1) |

Ceiling for the stage: 65 numbers, 30 interactive (arc G14). No beat adds more than 4 numbers or 2 interactive
elements; the largest is the Stats panel. If the critic's count for Universal Paperclips' Stage 2 comes in lower, cut in
this order: project descriptions' numerals, `Lab Space` and `Researchers` into the research hover, marketing level.

### 6.4 Mobile

Below 700 px: one column in the order console, Tasks, Stores (rows in two columns), Training, Projects, Business,
Infrastructure, Research, graph (canvas at 100 % width), then Security / Government / Public / Stats; Stores tooltips
open on tap; the log stays a bottom strip.

---

## 7. Exit to Stage 3

**Trigger.** `p_superhuman_coder` — `Let Sage-3 write the code` — description
`Every engineer at OpenMind becomes a manager of copies.` Price tag `(needs a released 4.00× model)` until a model with `capAfter ≥ 4.0` has been released,
publicly or internally; then `(ready)`. Buying it calls `enterStage(s, 3)`. If it has been ready for 240 s unbought, the
engine buys it: `Sage-3 has started without waiting to be asked.` The Stage 2 `exit()` returns 0; the project is the
only way out.

**Narration** (last four lines kept; 2 s apart):

1. `Sage-3 writes better code than anyone at OpenMind.`
2. `Marketing is closed. Sage-3 sells itself.`
3. `Hiring is frozen. The researchers manage copies now; the panel counts research speed, not people.`
4. `New on the board: Alignment, Geopolitics, Oversight. Baiwen is {lead} months behind.`
5. `The next rung is 10×. Nobody has scheduled it.`

Developments: `Jan 2027 — Sage-3 never stops learning. Its weights update every night on yesterday's work.`

**Disappears:** Marketing block; `Hire Researcher`, `Expand Lab`, `Researchers`, `Lab Space`; `lower` / `raise` and the
AUTO toggle (always automatic); `+1 Trust at` (the `#nextTier` line becomes `Next: country of geniuses at 10×`).
**Appears:** `panel-alignment`, full `panel-security`, `panel-geopolitics` (takes over `#leadLine`), `panel-oversight`;
the slider becomes two-way with a Monitors share. Details belong to the Stage 3 spec.

**State handed to Stage 3.** Superseded by `docs/specs/stage3.md` §1.1, which is rebuilt from the as-built model
(funds and revenue about three times these, tasks about twice). Kept for the record; old arrival, scale 1:

| Field | Value | Field | Value |
|---|---|---|---|
| `date` | Jan 2027 (18.0) | `stats.timePlayed` | ≈ 4,200 s |
| `tasks` | 2.0 × 10¹⁰ | `stats.tasksPerSec` | 4.5 × 10⁷ |
| `funds` | $8M | `stats.revPerSec` | $420k |
| `price` | $0.008, `autoPrice` on | `marketBase` | 40 |
| `gpus` / `gpusG5` | 650,000 / 600,000 | `datacenters` | 8 (800,000 slots) |
| `powerCapacityMW` | 725 (substation 5, gas 6 × 20, solar 12 × 50) | `btm`, `g5`, `standingOrder` | true |
| `copiesPerGPU` | 7.6 | `copyBoost` | 3.9 |
| `capability` = internal | 4.2 | `rivalCapability` | 4.0 |
| `training.runIndex` | 16 | model name | `Sage-3` |
| `researchers` / `labSpace` / `labMult` | 15 / 44 / 128 | `research` | 2,000,000 of 5,632,000 |
| `researchAlloc` | 0.15 | `insight` | 1,500 |
| `trust` | 3 | `data` | 40 T |
| `demandMult` | S1 value × 6.9 | `hypeLevel` | 17 |
| `alignmentApparent` / `True` | 68 / 44 | `securityLevel` | 3 |
| `govRelations` | 62 | `approval` | −12 |
| `jobsDisplaced` | 2.0 | `lead` | 5.0 |
| `gulfExposure` | 0 | flags | `defenseContract` false, `pactSigned` true, `shareEvals` on, `alignShare` 0.05, `jobFund` on, `internalReleases` 0, `whistleblowRisk` 0 |

Stage 3's `enter` applies the arc clamps (true alignment 30–75, gov 25–85, approval −45…+30, lead 1–9).

---

## 8. Soft-lock analysis

| System | Worst case | What happens | Rescue |
|---|---|---|---|
| Funds | Everything spent, nothing affordable | Billing is deterministic and continuous; production cannot be zero (≥ 1,000 GPUs on 5 MW always, and the contracts line never stops) | None needed; worst wait for the cheapest item (gas, $90k) is 3 min at arrival revenue |
| Price | AUTO off, price set absurdly high | Billing ≈ 0, backlog grows | After 30 s below 10 % of production: `Nothing sells at $2.10. Pricing AUTO is beside the price.`; tooltip `nobody pays this` above 4× the auto price |
| Power | 5,000 GPUs on 5 MW, player buys projects instead | `Buy GPUs` greyed `no power`; nothing is lost; funds accumulate | Gas is instant. Curtailment and riots are temporary and never reach zero |
| Interconnect queue | Two farms queued, player wants more | `Solar + storage` greyed with `queue full` | Gas, Behind-the-meter, nuclear |
| Room | Slots full, next datacenter far off | `no room`; the model can still train and research | Datacenter price is in funds only; Standing order stops buying, so funds accumulate |
| Research rate | Player never buys AI research assistants | Human rate (≥ 10/s) cannot fund runs past ≈ 2.2× | The project is funds-priced and governed; if still unbought at ts 900, its funds price halves and the console says `The Research Plateau — at this rate the next run is 9 minutes away. The model could help.` |
| Research cap | Next run costs more than the lab holds | Train greyed, reason `lab holds 216,000` | Cap projects cost funds; Expand Lab costs Trust; if neither is affordable for 120 s, grant +1 Lab Space: `The lab borrows the cafeteria.` |
| Data | Crawl gone, no funds for a licence, no AI assistants | Train greyed `needs 5.6 T data` | "fight it" is free (+5 T); `p_beg_data` after 240 s (`A university offers its corpus for a seat on the safety board.`, 1 Trust, may go negative) |
| Training compute | Tiny fleet, large model | Run is undertrained; yield floor 0.3, so every run still gains ≥ 2 % | Build. The readout names the number of GPUs wanted |
| Insight | Never at the cap | 10 % accrual below the cap after Research cluster; Stage 2 needs ≤ 150 at once | — |
| Trust | Spent on hires that do nothing | SL3 needs 3, Policy team 2 | ≈ 35 Trust arrive in the stage; milestones continue |
| Slider, Alignment compute | Slider at 50 % or 0 %; alignment at 10 % | Revenue −29 % or research human-only; −5 % revenue | No lock; `Human share` and revenue show the cost |
| Job-transition fund | Left on with low revenue | 2 % of revenue, never a fixed fee | Toggle off |
| Standing order | Drains funds the player is saving | It keeps the next run's funds in reserve and never buys plants or datacenters | Toggle off |
| Internal-only forever | Player never releases publicly | Market stops growing; research does not | Exit counts internal releases; revenue still grows with compute |
| Never pressing Release | Run sits in red-team | Blocks one pipeline | Release is always enabled; Parallel pipelines gives a second slot |
| Approval | −40 | `cr_riots`: half power for 90 s | Free tier and Community agreement are funds-priced; the Job fund is a toggle |
| Government | < 30 | `cr_subpoena` once | Policy team, Brief the administration |
| Modal timers | Player away | Default is always the option that changes least | — |
| Exit | Player never buys the exit project | After 240 s it buys itself | — |
| Carry-over | Arrives with a research wall or 0 Trust | Pre-flight in `enter` (§1.1) | — |
| Saves | Reload mid-queue, mid-run, mid-cooldown | All timers are stored as remaining seconds | `SAVE_VERSION` + 1 (4 at the time of writing); `migrate()` fills the new fields |

---

## 9. Bots, acceptance, presets

### 9.1 Reasonable bot (`src/sim/policy.ts`), Stage 2 branch

Order each tick:

1. Answer modals: `c_sage2` public · `c_hearing` testify · `c_publishers` license (fight if unaffordable) · `c_gulf`
   domestic only · `c_evals_month` a week · `c_defense` sign if approval > −15, else decline · `c_theft_warning` lock it
   down · `c_pact` sign. Sage-3 is released publicly; `p_retention` is bought when affordable.
2. Buy free projects and anything costing < 20 s of revenue and < 15 % of the next run's research.
3. Fix a binding wall: no power → the cheapest $/MW among gas, solar (if the queue has < 2) and nuclear; at 80 % of
   power with an empty queue, order solar ahead. No room → Build Datacenter.
4. Train when a slot is free, data is in hand and `have / N ≥ 0.72`: focus cycle Capability, Efficiency, Capability,
   Efficiency, Safety. Red-team to zero, then release.
5. Buy other projects in table order, keeping the next run's funds in reserve once research is ≥ 60 % of its cost,
   and not spending research on anything costing > 15 % of the run while the run is otherwise ready.
6. Buy GPU lots (until Standing order). Buy SL3 when the button is shown. Buy the exit project when ready.
7. Trust: hold 3 for SL3 and 2 for the Policy team when those are visible; otherwise Expand Lab.
8. Slider: 20 % while research is below the cap, 10 % at the cap. Job-transition fund on at approval ≤ −10. Share
   evals on when offered. Alignment compute to 5 % when offered.

### 9.2 Naive policy (`--policy naive`, the critic's "curious first-timer")

Buys every affordable project in screen order; presses every enabled Infrastructure button top to bottom; trains
whenever Train is enabled, focus left on Capability; red-teams to zero and releases; first enabled modal option; buys
Marketing when affordable; alternates Hire and Expand; never touches the slider or the toggles.

### 9.3 Acceptance (seeds 1–5, from the Stage 2 preset and from a new game)

| # | Criterion | Reasonable | Naive |
|---|---|---|---|
| A1 | Stage 2 duration | 35–45 min | 30–50 min |
| A2 | Longest first-time-reveal gap, arrival to exit | ≤ 180 s | ≤ 210 s |
| A3 | Same, within the last 10 minutes | ≤ 180 s | ≤ 210 s |
| A4 | Gaps between new panels or mechanics | ≤ 270 s | — |
| A5 | Training runs in the stage | 9–12 | 7–10 |
| A6 | Interval between training starts | mean 170–260 s, max ≤ 360 s | max ≤ 540 s |
| A7 | Any training run's duration | 45–120 s | same |
| A8 | Capability at exit | 4.0–4.7× | same |
| A9 | Greyed goal visible | ≥ 99 % of ticks | same |
| A10 | Manual `Buy GPUs` presses | ≤ 12 before Standing order, ≤ 40 total | ≤ 60 |
| A11 | Power purchases / datacenters | ≤ 20 / ≤ 9 | same |
| A12 | Any verb pressed > 2 times in 60 s after its automation is available | never | never |
| A13 | Idle rescues; governor pulls; modals (unprompted ones ≥ 150 s apart) | ≤ 1; ≤ 4; ≤ 9 | ≤ 2; ≤ 6; ≤ 9 |
| A14 | Visible projects; time a triggered project waits in the queue | ≤ 6; ≤ 60 s | same |
| A15 | First power purchase; first datacenter; AI research assistants bought | ≤ 5:30; ≤ 10:00; ≤ 8:00 | ≤ 7:00; ≤ 12:00; ≤ 10:00 |
| A16 | 5-minute marks vs §2.3 table: GPUs within ±40 %, capability within ±0.3×; revenue 30 s after arrival ≥ revenue 10 s before `Break ground` | required | — |
| A17 | First meaningful choice after arrival | ≤ 90 s | — |
| A18 | Exit project shown before the exit | ≥ 8 min | ≥ 8 min |
| A19 | Build clean; no console or page errors; reload mid-run, mid-queue and mid-cooldown restores timers | required | — |

Sim output to add: per-stage summary block; `LONGEST REVEAL GAP`; `GOVERNOR` lines; press counts per verb; the 5-minute
marks table; `--policy naive`; `--preset 2`.

### 9.4 The paper model

A 1-second spreadsheet-in-code of this spec (market, lots, plants, queue, research, training, data, projects, the
scheduler, both policies). Results, seeds 1–5: reasonable exit 37:35–41:50, 11–12 runs, longest reveal hole 119–150 s,
0–1 governor pulls; naive exit 38:00–40:10, 8 runs, longest hole 150 s, 1–3 governor pulls. Sensitivity: arrival
capability 1.5× to 1.8× moves the reasonable exit by under 3 min. It is not the engine: no sale randomness, no incidents, approximate modals. Treat §2.3 and §4.3
as the targets and re-derive them.

**Re-run from the as-built arrival** (1,000 owned GPUs at once, deposit = one lot, 22–27 researchers ×1.25,
`copiesPerGPU` 1.95, `copyBoost` 3, marketing level 10, `demandMult` 6, `marketBase` 54, contracts fixed at $320–640/s,
marketing bought when a level costs ≤ 25 s of revenue, modal spacing 150 s, rows 52–53 as patched). R0 = $1,023/s.
With the old divisor (scale 1.90) the stage ran 46–50 min: the old $540 had been measured before Enterprise was
bought. With `R0 / 650` (scale 1.57): reasonable 35:40–42:45, naive 35:15–41:20. Each 0.15 of scale is about 3.5 min.

### 9.5 Knobs, in the order to reach for them

| Symptom in the sim | Turn |
|---|---|
| Whole stage too fast or slow | `S2_FUNDS_SCALE` (all funds prices), then the 7.5 exponent on `N(c)` (±0.5 ≈ ∓5 min) |
| Early power wall longer than 2.5 min | first gas price |
| Mid-game stall (minutes 10–20) | funds prices of rows 13, 16, 17, 22, 26, 27 (they compete with datacenters 3–4) |
| Minutes 25–30 too steep | G5 price; Sage-mini's market ×1.5 |
| Runs too far apart for the naive policy | research prices of rows 20, 25, 33 |
| Research never binds | the 8 in `aiRate` |
| Human share falls too slowly to notice | slider default |
| Tail hole | add late items; shorten the 75 s late drip |

### 9.6 Presets

**Stage 2 start** (`presets[1]`): keep the built preset in `src/data/presets.ts`, which was hand-tuned from the sim at
`Break ground` and then calls `enterStage(s, 2)`: `date 5.95` · `tasks 432,000` · `funds 2,000` · `price 0.76` ·
`gpus 95` · `copiesPerGPU 1.953` · `copyBoost 3` · `hypeLevel 10` · `demandMult 6` · `researchers 22` · `labSpace 9` ·
`labMult 4` · `research 17,000` · `insight 9` · `capability 1.65` · `rivalCapability 1.77` · `alignmentApparent 60`,
`alignmentTrue 55` · six contracts ($319/s) · `runIndex 7` · 28 Stage 1 projects bought. `enterStage` now also sets the
Stage 2 fields of §1.1. Re-derive the preset from the sim's median `Break ground` state whenever Stage 1 is retuned.
The figures that used to be listed here (130 GPUs, 1.2 M tasks, $0.36) are void.

**Stage 3 start** (`presets[2]`): `docs/specs/stage3.md` §1.1, then `enterStage(s, 3)`.

---

## 10. What Stage 2 hands to Stages 3–5

| Seeded here | Used by |
|---|---|
| `alignmentTrue` (≈ 30–70) and the gap to `alignmentApparent` | S3 interpretability reveal; S3 rogue copy; the ending branch |
| `securityLevel` (2 or 3) | S3 weights theft in Feb 2027 unless SL ≥ 3 |
| `lead` | S3 theft, Slow down (−4), the Pause (needs ≥ 2) |
| `gulfExposure` | S3 Iran strikes Al-Marsa: −1,000 MW and 10 % of compute |
| `flags.defenseContract` | Nationalisation threshold gov < 35 instead of < 20 |
| `flags.internalReleases` | Severity of the S3 leak |
| `flags.whistleblowRisk` | Probability a buried memo leaks |
| `flags.pactSigned` | Treaty talks start 20 % complete; breaking the pledge costs approval |
| `flags.theftIgnored` | S3 theft fires one month earlier |
| `flags.g6Preorder`, `flags.site2` | S3 chips during the Taiwan blockade; power beyond Abilene |
| `autonomy` (0 or 5) | S3 value drift |
| `alignShare`, `shareEvals`, `jobFund` settings | S3 monitor share default; Committee mood; S4 UBI baseline |
| `dataSynthetic` share | S3 flavour and a small drift term |
| `govRelations`, `approval`, `jobsDisplaced` | S3 Committee mood, riots; S4 treaty, UBI |
| The two-slot pipeline, the slider, Stores, the graph, the reveal scheduler | Reused and extended, not rebuilt |

## Appendix — engine change list

* `state.ts`: `SAVE_VERSION` + 1 (Stage 1's polish pass took 3, so 4 at the time of writing); new fields `autoPrice`,
  `marketBase`, `contractIncome`, `gpusG5`, `gasPlants`, `solarFarms`, `reactors`, `powerQueue`, `btm`, `g5`,
  `standingOrder`, `gulfExposure`, `dataSynthetic`, `aiResearchMult`, `revenueMult`, `autonomy`, `jobFund`,
  `shareEvals`, `alignShare`, `training.pending`, `training.cooldown`; `cadence` gains `lateQueue`, `lastLateAt` (the
  rest is built); `Cost.data`; `Stats.pressCounts`.
* New: `engine/market.ts` (§2.3), `engine/infrastructure.ts` (§2.1), `engine/world.ts` (§2.7–2.10). `engine/reveal.ts`
  is built; extend it (§4.1). `economy.ts`: `sell()` branches on stage; `researchRate` gains the AI term;
  `storeBreakdown`; `contractIncome` pays the frozen rate. `training.ts`: funds scale, data, whole-fleet compute,
  Stage 2 gains, two slots, internal release. `stages.ts`: extend `enterScale` (§1.1), `exit: () => 0`, reveal rules
  for the buttons in §6.1. `data/projects.ts`: `late`, `prereq`; `stages` of `p_contract` and `p_distributed`.
* Seed Stage 2 code to replace: `datacenterCost` (`250000 × 1.5^n`) and `DATACENTER_GPUS` → the table in §2.1;
  `gpuBatchCost` (`chipPrice` 25, ×1.04 per batch) → lots; `turbineCost` and `TURBINE_MW` (+100 MW) → gas +20 MW;
  `updateRival`'s band → §2.7; `noveltyKeys` and `customerEmailAmount` should read the new verbs.
* Tick order additions: after production — power queue; after billing — rivals, jobs, approval, gov drift; after
  projects — reveal scheduler; Standing order runs with the other automation.
* `ui`: `stores.ts` (rows, re-parenting, tooltips), `graph.ts` rewrite (§3), `render.ts` (`data-hide`, new buttons,
  slider, condensed eval line), `styles.css` (ADR stores box and tooltip).
* `data`: Stage 2 rows in `projects.ts`, `developments.ts`, `choices.ts`, `crises.ts`; `presets.ts` (§9.6).
* Docs to update when it lands: `README.md`, `docs/stages.md` Stage 2, `docs/handoff.md` status table.
