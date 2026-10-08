# Stage 2 plan: The Race (Jan–Dec 2026)

Status: plan only, nothing implemented. Branch `stage2-plan`, cut from `main` at `33e81a6` (Stage 1 + scaffolding). Companion doc: [reference-analysis.md](reference-analysis.md).

## 0. Context and assumptions

- Stage 1 (Jul–Dec 2025, ~20 min) is implemented and ends when the player buys **First Datacenter** (`p_datacenter` → `enterStage(s, 2)`).
- `main` holds an untracked Stage 2 draft (`src/engine/race/`). Per your note its mechanics are wrong, so this plan does **not** build on it. It is ignored, not deleted; this branch does not contain it.
- What the draft got wrong, and what this plan does instead:
  - Draft: separate engine, tasks/price became flavor. Plan: Stage 2 **is** the Stage 1 economy, scaled up. Tasks Completed stays the headline number.
  - Draft: sliders. Plan: buttons and projects, like Paperclips.
  - Draft: rivals can never end the game. Plan: two early endings in Stage 2 (Irrelevance, Shutdown), each with two warnings and a last chance.
  - Draft: no overlapping runs; Developments log removed. Plan: Training Pipeline project allows overlap; the log stays and gets Stage 2 content.
- Stage 1 is the bar for pacing and UI and is **not touched**: Stage 2 reuses its primitives (console, project cards, non-blocking modals, reveal rules, 30 s beats, 4-card limit) and its engine. The only Stage 1 file changes are the Stage 2 `enter` hook and the stage name.
- The attached Last Invention wiki supplies the **arc** (datacenters → data wall → rivals → security → alignment → stage gate, and the later stages' themes). None of its numbers have been playtested, so every constant below is an initial guess for the tuning sim and the critic loop (§11, §13), not a spec. Where the wiki and the code disagree on names, the code wins.
- Assumptions (say if any is wrong):
  - Keep the committed React + Zustand + Vite architecture. Your prompt template says "vanilla TS, no frameworks", but `main` was refactored to React at `33e81a6`. Going back to vanilla is a separate decision.
  - Keep names already in the code: lab **OpenMind**, models **Sage-N**, rival **Anthrosoft** (models **Cadence-N**), Chinese rival **Baiwen** (models **Wenshu-N**), chip vendor **Nimbus** (G4, then G5, G6), site **Abilene**.
  - Stage 2 ends at **10×** (Superhuman Coder, Sage-4), not the wiki's 50×. Stage 3 then covers SC → SAR → SIAR, which matches the AI 2027 calendar for 2027.
- Sources used: Universal Paperclips and A Dark Room source (cloned in `agent-tools/refs/`), their wikis, Game Dev Story wiki, AI 2027 (scenario, both endings, takeoff forecast), Situational Awareness, Wait But Why, the book PDF in refs, and the attached Last Invention design wiki. All in [reference-analysis.md](reference-analysis.md).

## 1. Rules the stage must obey

- **One headline number.** Tasks Completed, in full, with separators. Capability (×), date and revenue join the header row; nothing else does.
- **Carrot invariant.** At least one unaffordable project is visible at all times. If everything visible is affordable, the next project in the stage list is revealed early (reuse `STAGE1_GOVERNED` pattern in `reveal.ts`).
- **Every bottleneck has a lever.** See the rotation table in §11. Each bottleneck message names its lever (reuse `bottleneckMessages` in `economy.ts`).
- **Reveal on trigger, not on affordability.** Projects use `trigger`, not `canAfford`, for visibility (existing `ProjectDef` contract).
- **Nothing moves.** Panels keep their column and order. A retiring control's successor takes its place (Compute → Infrastructure, Rent GPU → Buy GPUs).
- **Spacing.** New panel or mechanic every 2–4 min, never closer than 90 s. Crisis modals ≥ 4 min apart, never within 30 s of a reveal. Reuse `BEAT_SPACING`, `MODAL_SPACING`, `mechanicClear`.
- **No training run over 2 minutes.** Hard cap 110 s.
- **No dead air over 60 s.** Reuse `idleGuard` with Stage 2 stall breakers.
- **Danger is fair.** Two visible warnings and a timed last chance before any early ending.
- **Deterministic.** All randomness through `rng(s)`. Saves resume identically (existing test pattern).

## 2. Stage 2 at a glance

| | |
|---|---|
| Name | The Race (rename from `Scale` in `stages.ts`) |
| Calendar | Jan 2026 → Dec 2026, 210 s per month (42 min nominal); date clamps at Mar 2027 if the player is slow |
| Target length | 38–48 min for the bot, ~45 for a human |
| Headline | Tasks Completed (billions by the end) |
| Core loop | Copies complete tasks → revenue → buy GPUs, datacenters, grid → more copies → more tasks. Train bigger Sage → each copy does more, customers pay more. Release it → revenue and hype, or keep it internal → research and lead. |
| Recurring decision | Every run: read the eval card, fix issues, Deploy or Keep internal (every ~3–4 min, ~11 times) |
| Capability | ~1.8× → 10× (Sage-1.x → Sage-4) |
| New layers, in order | Infrastructure · Release Policy · Race graph · Data · AI R&D · Public/Government · Training Pipeline · Baiwen + Security · Products · Alignment strip · Funding · Weight theft · Bio red line · Sage asks for compute |
| Bottleneck rotation | Compute (0–8) → Data (6–16) → Money and demand (14–26) → Security and tempo (18–30) → Alignment uncertainty (28–40) |
| Can end early | Second Place (Irrelevance), Shutdown |
| Ends with | **Automate the Lab** (visible at 5×, buyable at 10×) → Stage 3 Takeoff, Jan 2027 |

## 3. The loop in Stage 2

- **Tasks.** `copies × perCopyRate` as today (`perCopyRate = capability^0.8 × copyBoost`). Copies = powered GPUs not busy training, × `copiesPerGPU`. Clicking retires at the gate.
- **Selling.** Unchanged demand model (`demandAt`, `expectedSalesPerSec`). Demand levers: price (auto if `p_auto_pricing`), marketing, quality (`sqrt(cap/rivalCap)`), products (new `demandMult` projects), contracts.
- **Compute.** GPUs now owned: Buy GPUs (1,000) → Build Datacenter → Expand Grid. Chip generations multiply compute per GPU. GPUs busy in a training run do not serve customers (existing `busyGpus`): training has a visible revenue cost.
- **Training.** Each run needs idle effective GPUs, funds, and enough data. Produces Sage-N.m with a gain. Eval card → fix issues → Deploy or Keep internal. After **Training Pipeline**, a second run may train while the previous model is in eval/red team/rollout.
- **Research.** Humans decay (existing `humanEfficiency = min(1, 3/cap)`); Sage takes over research after **Sage Writes Our Code**. Research buys projects. Insight accrues only while research is full (existing).
- **Slack currency.** Idle copies (copies beyond what the market buys) write **synthetic data** once the Synthetic Data Engine is bought. Overbuilding inference is never waste.
- **The world.** Rivals on a live log graph. Approval, government relations, security, and the alignment band arrive one by one and react to releases.

## 4. Arrival reshuffle (minute 0)

Gate line, centered for 1.5 s, then dropped into the console: *"First Datacenter online outside Abilene. Nobody at OpenMind completes tasks by hand anymore."*

| Place | Stage 1 | Stage 2 |
|---|---|---|
| Header | Tasks Completed, date | + `Sage-1.6 · 1.8×`, + revenue/s |
| Console | 5 lines | same |
| Alignment strip | not present | reserved blank row under the console; fills at ~22 min |
| Left: Task panel | Complete Task button | retired (panel hidden) |
| Left: Business | price, marketing, revenue | same, Buy Power retired (grid bills automatically: set `gridAuto = true`), + Products rows as bought |
| Left: Compute | Rent GPU, quota meter, power | **Infrastructure**: GPUs/room meter, Buy GPUs (1,000), Build Datacenter, Expand Grid, power bill; later Data row, Security row |
| Left: later | — | **Public** (Approval, Jobs displaced) at the hearing; **Government** (Relations) at the hearing |
| Middle: Research | researchers, lab, insight | + "Who did the research: Humans 91% · Sage 9%" bar after Sage Writes Our Code |
| Middle: Projects | cards | cards (Stage 2 list) |
| Right: Training | run, focus, eval | + second progress line after Training Pipeline; eval card gains Deploy/Keep, Bio/Cyber rows, "Knows it's tested" |
| Right: later | — | **Race** graph panel at ~2 min, under Training |
| Log column | Developments | same |

- Existing `Infrastructure.tsx` already renders the owned-infrastructure rows behind `revealed['infrastructure']`; the `enter` hook in `stages.ts` already shows it. Changes: hide `task`, set `gridAuto`, do not show `buyPower`.
- Mobile order (styles.css `display: contents` map): add race, public, government, alignment slots.

## 5. Reveal schedule (stage-relative minutes, median bot)

| Min | Trigger | Appears | Console line |
|---|---|---|---|
| 0:00 | gate | Infrastructure in place; capability in header; first greyed project **Nimbus G5 chips** | "The rented GPUs go back to the cloud. These are ours." |
| 0:45 | first Buy GPUs | Build Datacenter enabled-but-grey explanation; "room for 10,000" meter | "1,000 GPUs racked. The hall is a third full." |
| ~1:30 | first Stage 2 run finishes | **Release Policy** project (grey until affordable) | "From now on we decide which Sages the world meets." |
| ~2:00 | Anthrosoft's first 2026 release | **Race** panel: log graph, OpenMind + Anthrosoft lines, tier lines 1×, 2×, 4× visible, 10× faintly | "Anthrosoft publishes a capability chart. Everyone has one now." |
| ~4:00 | public web 60% scraped | **Data** row in Infrastructure (stock / needed) | "Sage-2 has read every public sentence in English. It would like more." |
| ~6:30 | web exhausted | Crisis: **The data wall** (choice); Data Licensing, Synthetic Data Engine projects | "The internet is finished. Not broken. Finished." |
| ~6:00 | capability ≥ 2× (Sage-2) | **Sage Writes Our Code** project; then the research-share bar | "Sage wrote 30% of this week's commits. The other 70% reviewed Sage's commits." |
| ~9:00 | 3 runs and 2 datacenters | **Training Pipeline** project (overlap) | "Two clusters. One can train while the other ships." |
| ~10:30 | Apr 2026 and ≥ 2.5× | Crisis: **Senate hearing** → **Public** and **Government** panels | "Senator Albright asks whether Sage could testify instead." |
| ~12:00 | 3 datacenters | **Hyperscale Campuses** project (×10 room per datacenter) | "Abilene wants a second substation. Abilene gets a second substation." |
| ~14:00 | 3× | **Sage for Work** product; **Mega-round** funding | "Sage for Work attends meetings so you don't have to. The meetings remain." |
| ~17:30 | Jun 2026 | **Baiwen** joins the graph at 0.35×; tempo gauge; **Security Office** project | "Baiwen consolidates China's labs into the Wenshan Compute Zone. Wenshu-1 is 'adequate'." |
| ~19:00 | Security Office bought | Security row (SL1 → SL4) in Infrastructure | "Mo took the whiteboards out of the hallway." |
| ~20:00 | Sage for Work live for 2 min | Jobs displaced counter in Public; first job-loss headlines | "The Ledger: junior developer hiring falls for a third quarter." |
| ~22:00 | 4× (Sage-3) | Development: reward hacking → **Alignment Team** (if unbought) → **Alignment strip** fills: `60 ± 30`; Model Spec, CoT Monitoring chain | "Kit: it didn't fix the code. it fixed the tests." |
| ~24:00 | 2 datacenters full on G5 | **Nimbus G6 chips** | "The G6 needs liquid cooling and a moment of silence." |
| ~27:00 | Baiwen present and ≥ 5× | Crisis: **Weight theft** (roll vs security level) | "Anomalous egress from Training Cluster 3." |
| ~28:00 | 5× | **Automate the Lab** appears, grey: "needs 10×" | "Sage has asked, politely, whether it could just do the research." |
| ~30:00 | 6× | **Sage-mini** product decision (cheap public model) | "A Sage you can run on a laptop. Twelve million people do." |
| ~33:00 | 8× | Crisis: **Bio uplift red line** (a choice with Dangerous Capability Evals, a surprise headline without) | "Bio uplift: HIGH. We are told this is fine." |
| ~34:00 | 8× and Government panel | **Defense Partnership** offer; **Compute Cap Proposal** | "The Department would like Sage to 'support' some missions." |
| ~36:00 | Oct 2026 and approval < 45 | Crisis: **Protest** (10,000 in DC); Public Safety Commitments | "The Ledger: ten thousand march on the Mall. Signs are hand-lettered, pointedly." |
| ~38:00 | 8× | Modal: **Sage asks for compute** (no timer) | "Sage-3.4: I have an idea. It needs 8% of the cluster for a few days." |
| ~40–45 | 10× (Sage-4) | Automate the Lab affordable → **Stage 3** | "Automate the Lab complete. The best researcher we have is no longer human." |

- Infrastructure purchases (GPUs, datacenters, grid tiers) and licensing deals fill the gaps; one is affordable roughly every 20–40 s.
- Spacing check: reveals ≥ 90 s apart; crises at 6:30, 10:30, 27, 33, 36, 38 (the last two are ≥ 2 min apart and the "asks for compute" modal has no timer).

## 6. Systems

### 6.1 Infrastructure (left column, replaces Compute)

- State: `gpus`, `datacenters`, `gpuBatches`, `gridCapacity` (exist). New: `chipGen` (1–3), `dcTier` (1–3: 10k / 100k / 1M GPUs per datacenter).
- Effective compute `E = gpus × chipMult[chipGen]`, chipMult = 1 / 4 / 16. Everything that used `gpus` for throughput uses `E`; copies = `activeGpus × chipMult × copiesPerGPU`.
- Buttons (ids stable for the critic): `btn-gpuBatch` Buy GPUs (1,000; after Hyperscale: 10,000; after Gigawatt Sites: 100,000), `btn-datacenter` Build Datacenter, `btn-expandGrid` Expand Grid (×10 per tier), `btn-security` Upgrade security (after Security Office), `btn-tradeIn` Trade in old GPUs (after a chip generation, returns 30%).
- Costs (initial values for the tuning sim; see §11):

| Buyable | Cost | Growth | Note |
|---|---|---|---|
| GPUs, batch of 1,000 | $40 × 1,000 × chipPrice[gen] (gen 1/2/3 = ×1 / ×3 / ×10) | ×1.04 per batch of the same size | batch size steps ×10 with datacenter tier; price per GPU unchanged |
| Datacenter | $250k × 2.2^n | ×2.2 | room 10k GPUs; Hyperscale ×10, Gigawatt ×100 |
| Grid tier | 10 MW → 100 MW → 1 GW → 10 GW | $1/kW of the new tier (10 MW = $10M … 1 GW = $1B), PPA project −30% | GPUs beyond grid capacity sit dark (existing `activeGpus`) |
| Security level | $5M × 8^(n−1) | ×8 | research −3% per level, theft odds 90 / 50 / 25 / 10% |
| Power bill | existing `powerBillPerSec` with `gridAuto` | `powerBase` inflation | shown as "Power bill $/s" |

- Rule of thumb for tuning: a routine purchase costs 15–40 s of current revenue; a tier purchase (datacenter tier, grid tier, chip generation) 60–120 s; the stage gate ~3 min.
- Bottleneck messages: "Datacenters are full. Build another." / "N GPUs sit dark. Expand Grid." / "Copies idle: nobody buys. Lower the price, buy Marketing, or launch a product."

### 6.2 Market and products (Business panel)

- Demand formula unchanged. New `demandMult` products as projects:

| Product | Trigger | Cost | Effect |
|---|---|---|---|
| Sage for Work | 3× | 30k research, $5M | demand ×3, tempo +3, jobs displaced start (+ approval −0.5/min while unmitigated) |
| Sage-mini (public cheap model) | 6× and a public release | decision, free | demand ×4, rivals +5%, approval +4, tempo +3; or "keep it enterprise-only": demand ×1.5 |
| Government contracts | hearing resolved, relations ≥ 55 | 20k research | +$ lump = 60 s revenue, contracts ×1.5, relations +5 |
| Defense Partnership | 8× and Government panel | choice | +$ lump = 180 s revenue, relations +15, approval −6, tempo +5 |
| Mega-round | 3× and 2 releases | 150 insight | choice: growth capital (+$ = 240 s revenue, tempo +5, must deploy next 3 models) or patient capital (+$ = 120 s revenue, 20% revenue share for 6 min) |

- Marketing and dynamic pricing continue. "Nobody buys" → lever is price/marketing/product; "selling out" → lever is compute.
- Revenue targets for the sim: $3k/s at arrival, ~$30k/s at 10 min, ~$250k/s at 20, ~$1M/s at 30, ~$4M/s at 40.

### 6.3 Training runs (Training panel)

- One slot (`training.run`) plus, after **Training Pipeline**, `training.next`: a run in the `training` phase that waits in `evaluating` until the front run is released or discarded. Train is enabled when `!next && (!run || run.phase !== 'training')` and the pipeline is bought; otherwise the Stage 1 rule.
- Requirements at start capability `c`:
  - Effective GPUs needed: `E_req(c) = 1,000 × (c/1.8)^3.3` (1.8 → 1k, 4 → 14k, 10 → 290k). Shown as "needs N GPU-equivalents idle"; busy GPUs stop serving customers for the run.
  - Funds: `$200k × (c/1.8)^2.5` (1.8 → $200k, 4 → $1.5M, 10 → $14.5M).
  - Data: `required(c) = 10T × (c/1.8)^1.4`; gain × `min(1, stock/required)^0.5`; the eval card prints the shortfall in red.
- Duration: `clamp(50 + 12 × runsThisStage, 50, 110)` s. Never above 110 s.
- Gain: Focus bases become capability 0.18 + 0.04·rng, efficiency 0.10 (+ copies/GPU ×1.25), safety 0.10 (+ alignment, + coverage). Bonuses: RL Environments +0.03, Continuous Learning +0.04, "Sage asks for compute" +0.15/+0.30 once, frontier score +0.01 (existing). Expected 10–11 runs from 1.8× to 10×.
- Eval card (existing 6 benchmarks + 4 reviewers) gains rows: Bio uplift and Cyber range (LOW/MEDIUM/HIGH/CRITICAL, after Dangerous Capability Evals), Honesty probe (after Alignment Team), "Knows it's tested" (≥ 6×). After **Release Policy**, the card opens as a modal (`#modalOverlay`, reuse `ChoiceDialog`) with **Deploy** / **Keep internal**:
  - Deploy: `capability = capAfter`, hype ×2 (existing), approval +2 decaying, tempo +3, each rival +5% (distillation), misuse incidents possible (existing incident scheduler, now bio/cyber flavored).
  - Keep internal: `internalCapability = capAfter`, research ×1.25 and lead +1 (existing), no approval bump, leak seed for Stage 3.
- Red team: unchanged (Fix issue, 8 s or 5 s). Shipping with open issues schedules incidents (existing).
- Naming: Sage-2 at 2×, Sage-3 at 4×, Sage-4 at 10× (`MAJOR_TIERS` unchanged).
- Tier labels (graph and eval card): 1× "2025 frontier: an intern that never sleeps", 2× "average professional", 4× "expert", 10× "best human coder (SC)", 50× "best human researcher (SAR)", 250× "beyond Einstein (SIAR)", 2,000× "all of humanity (ASI)". Easter-egg axis marks below 1×: 0.03× "a mouse", 0.3× "a crow". Only tiers within ~2 doublings of the frontier are drawn solid.

### 6.4 Data

- State: `data: { stock, webRemaining, synthetic }` in T tokens. Data is a cap: never spent.
- Public web: +1T/min automatically until 20T total (exhausted ~6:30 → **The data wall** crisis).
- Data Licensing Deals: repeatable project, $500k doubling, +15T.
- Customer conversations: data-wall option, +25T, approval −8, hidden flag `customerDataUsed` (Stage 3 leak).
- Synthetic Data Engine: idle copies write 1T/min per 10,000 idle copies. "Idle" = copies beyond `expectedSalesPerSec / perCopyRate`. This is the stage's slack currency.
- RL Environments: effective data ×1.5 and gain +0.03.
- Data row: "Data: 38T of 52T needed · synthetic +0.4T/min".

### 6.5 Research handoff (human researchers → irrelevance)

- Humans: existing `researchRate = researchers × 10 × humanEfficiency × researchMult`, `humanEfficiency = min(1, 3/cap)`.
- Sage: after **Sage Writes Our Code**, `aiResearch = 2 × cap^1.5 × (1 + log10(max(1, copies/1,000)))` per second. At 2×: ~6/s; 4×: ~20/s; 10×: ~190/s. Human share falls from ~90% to ~25% by 10×.
- Bar in Research panel: "Who did the research: Humans 61% · Sage 39%". Hire Researcher stays, but its tooltip says what a hire is worth now.
- Lab capacity: New Building (labMult ×2), Research Campus (×4). Trust still buys Expand Lab.

### 6.6 Rivals and the race graph (right column)

- Anthrosoft: existing `rivalRelease` cadence (240–420 s) with the rubber band, now multiplied by tempo (`interval × (1.4 − tempo/125)`) and +5% on each of our public deploys.
- Baiwen: new `baiwen: { present, capability, version, nextIn }`. Enters Jun 2026 at 0.35× ours; growth = rubber band toward 0.6× ours, faster at high tempo; export controls slow it; theft jumps it to 0.85× ours.
- Tempo (0–100, hidden until Baiwen, then a gauge on the graph): starts 50; +3 per deploy, +5 funding, +5 Defense, +15 theft; −3 Safety Commitments, −15 Compute Cap; drifts 1/min toward 50. Feeds rival speed and alignment drift.
- Lead (months, existing field): `log(ours/baiwen) / log(2) × baiwenDoublingMonths`. Shown in Government panel as "Lead over Baiwen: N months".
- Graph: inline SVG, `viewBox 0 0 360 140`, x = calendar from Jul 2025 to now + 3 months, y = log capability 0.5× to 4× the max line. Lines: OpenMind solid, Anthrosoft dashed, Baiwen dotted, our dotted projection at the current rate. Tier lines with labels, event markers (⚠ theft, ↑ release). Sampled every 5 s into `history` (capped 720 points; saved).
- Irrelevance: a rival leads by ≥ 2× → OpenMind line turns red (warning 1, "Investors are asking about Anthrosoft."). ≥ 3× → development "Series C pulled" (warning 2). ≥ 4× for 3 min → **Irrelevance countdown** modal (last chance: emergency round for 3 Trust, or keep going) → ending **Second Place**.

### 6.7 Government and public (left column, two small panels)

- Approval (existing field; set to 62 at the gate): +2 per public deploy (decays over 2 min), −0.5/min from jobs displaced while no mitigation, −6 Defense, +8 Safety Commitments, −8 customer data, −3 per incident, −8 unrestricted bio release.
- Government relations (existing `govRelations`, 50): hearing cooperate +10 / deflect −8 / ask to be regulated +6; Defense +15; theft traced +10; incidents −3. Gates: Government contracts ≥ 55, Export Controls ≥ 60, Compute Cap ≥ 60.
- Jobs displaced: `0.02M × (demand share of Sage for Work)` per minute, shown in Public with a headline every 2M.
- Protest: approval < 45 in Oct 2026 or later → crisis with options (jobs program $: approval +6; statement: +2; ignore: −4 and tempo +2).
- Ultimatum: approval < 30 for 2 min (warning: "Calls grow to shut down OpenMind") → **Administration ultimatum** modal: accept oversight (relations +10, research −10% for the stage, flag `oversightEarly`) or refuse → **Emergency vote** (3 min, last chance: testify and concede / lobby with relations ≥ 60 / offer nationalization) → ending **Shutdown** (variant: nationalized if accepted).

### 6.8 Security and weight theft

- Security Office project (Baiwen present) adds a row: "Security: SL1 · Upgrade to SL2 $5M". Levels SL1–SL4; each −3% research, theft odds 90/50/25/10%.
- Weight theft fires once, at ≥ 5× with Baiwen present (and may fire again at ≥ 9× if SL ≤ 2). Roll vs level:
  - Detected (modal, 45 s, default Cut): Cut the link (Baiwen ×1.4, revenue −20% for 2 min, tempo +8); Trace it (Baiwen → 0.85× ours, relations +10, tempo +15); Counter-hack (needs SL3: Baiwen −30% growth for 4 min, tempo +20, approval −3).
  - Undetected: Baiwen → 0.85× silently; 3 min later "Wenshu-3 has our model's unusual errors."
- Egress Monitoring project: theft always detected; seeds Stage 3 containment.

### 6.9 Alignment arrives (strip under the console)

- Existing fields `alignmentTrue` (hidden), `alignmentApparent`. New: `alignmentBand` (±), `deceptionBias` (hidden), `alignmentShown`.
- Reveal: at 4× the development "reward hacking" fires; **Alignment Team** (existing `p_alignment_team`, retriggered for Stage 2 if unbought) reveals the strip: `Alignment 60 ± 30`, drawn as a hatched band with a marker, zones at 50 and 80.
- Drift on each capability gain: `ΔA = −6 × log10(c_new/c_old) × (0.5 + tempo/100) × (1 − coverage)`; coverage = 0.3 per safety-focus run (decays), + projects. Deception bias: each doubling has `0.3 × (0.5 + tempo/100) × (1 − coverage)` chance of +2..5 (hidden); apparent = true + bias.
- Projects: Model Spec (A +4, band −3), CoT Monitoring (band −6, logs one caught behavior), Linear Probes (band −5, "Interpretability: 35%"), Red Team (bias −2), Honesty Training (A +3, bias −2), Sparse Autoencoders (band −7, bias −2). Safety focus also narrows the band by 1 per run.
- Nothing in Stage 2 kills the player through alignment. It plants the seeds (the truth reveal at the end lists them) and teaches the band.

### 6.10 Trust in Stage 2

- Milestones continue on the Fibonacci schedule with the existing `trustPace` cap (one Trust every ~150 s of production). Sources: clean releases (+1), leaderboard, projects.
- Spent on: Hire Researcher, Expand Lab, emergency round (Irrelevance), credit for a datacenter when stuck (rescue card). Retires in Stage 3.

## 7. Stage 2 projects (`stages: [2]`, same `ProjectDef` shape)

Costs marked `r` use `revealResearch` (seconds of research rate at reveal), `$r` use `revealFunds`. Log lines are the `logMsg`.

| id | Title | Trigger | Cost | Effect | Log line |
|---|---|---|---|---|---|
| s2_chip_g5 | Nimbus G5 chips | stage 2 | 12k research, $r 60 | chipGen 2 (×4 compute per GPU); Trade-in button | "Nimbus ships the G5. Our G4s are now 'legacy', which means slow." |
| s2_release_policy | Release Policy | 1 Stage 2 run | 20 insight | Deploy / Keep internal modal on every eval card | "From now on we decide which Sages the world meets." |
| s2_licensing | Data Licensing Deals (repeatable) | Data row shown | $500k ×2 | +15T data | "We bought three newspapers' archives, a bass-fishing forum, and a dictionary." |
| s2_synthetic | Synthetic Data Engine | Data row shown | 15k research, 40 insight | idle copies write data | "Sage writes its own textbooks. They are good, and a little smug." |
| s2_rl_envs | RL Environments | Sage-2 trained | 25k research, 80 insight | effective data ×1.5, gain +0.03 | "Ten thousand small worlds for Sage to practice in. It has beaten all of them." |
| s2_ai_rd | Sage Writes Our Code | 2× | 12k research, 40 insight | AI research term on; share bar | "Sage wrote 30% of this week's commits. The other 70% reviewed Sage's commits." |
| s2_pipeline | Training Pipeline | 3 runs and ≥ 2 datacenters | 18k research | overlapping runs | "Two clusters. One can train while the other ships." |
| s2_hyperscale | Hyperscale Campuses | 3 datacenters | 20k research, $r 90 | dcTier 2: room ×10, batch 10,000 | "Abilene wants a second substation. Abilene gets a second substation." |
| s2_gigawatt | Gigawatt Sites | 3 campuses full | 40k research, $r 120 | dcTier 3: room ×100, batch 100,000 | "The site has its own zip code and, soon, its own weather." |
| s2_chip_g6 | Nimbus G6 chips | 2 datacenters full on G5 | 40k research, $r 120 | chipGen 3 (×16) | "The G6 needs liquid cooling, a substation, and a moment of silence." |
| s2_ppa | Long-term PPA | first grid tier bought | 10k research | grid tiers −30% | existing `p_ppa` text, retriggered |
| s2_building | New Building | lab space ≥ 15 | 18k research, $r 60 | labMult ×2 | "A building with a lobby. The lobby has a sculpture of a brain." |
| s2_campus | Research Campus | New Building and 8× | 45k research | labMult ×4 | "Most of the campus is server halls. The humans have a nice corner." |
| s2_work | Sage for Work | 3× | 30k research, $r 60 | demand ×3, tempo +3, jobs displaced | "Sage for Work attends meetings so you don't have to. The meetings remain." |
| s2_gov_contracts | Government Contracts | hearing resolved, relations ≥ 55 | 20k research | lump + contracts ×1.5 | "The Department of Energy would like 400 seats and a classified version." |
| s2_mega_round | Mega-round | 3× and 2 releases | 150 insight | opens the funding choice | "OpenMind raises more money than it can spell. The chart goes up." |
| s2_security | Security Office | Baiwen present | 10k research, $r 45 | security row | "Mo took the whiteboards out of the hallway." |
| s2_egress | Egress Monitoring | Security Office | 15k research, $r 30 | theft always detected; containment seed | "Every byte leaving the building is now counted." |
| s2_export | Export Controls Lobbying | Baiwen present, relations ≥ 60 | 25k research | Baiwen −25% growth 6 min, tempo +4 | "Chip exports restricted. Baiwen announces its own chips. Everyone checks the calendar." |
| s2_evals | Dangerous Capability Evals | 4× | 22k research, $r 45 | Bio/Cyber rows; bio crisis becomes a choice | "We now test whether Sage can help build a bioweapon. We would like the answer to stay no." |
| s2_alignment_team | Alignment Team | reward-hacking development (if `p_alignment_team` unbought) | 15k research, 50 insight | reveals the strip | "We have an alignment team now. They have questions. So do we." |
| s2_spec | Model Spec | Alignment Team | 20k research, 80 insight | A +4, band −3 | "Sage read its constitution in 0.2 seconds and had no notes, which is a little suspicious." |
| s2_cot | Chain-of-Thought Monitoring | Alignment Team | 18k research | band −6; one caught-behavior log | "We can read Sage's scratchpad. Mostly it's about the task. Mostly." |
| s2_probes | Linear Probes | Alignment Team | 25k research, 120 insight | band −5; interpretability 35% | "We found the direction in Sage's activations that means 'lying'. There are several. Some are lit." |
| s2_redteam | Red Team | Dangerous Capability Evals | 20k research, $r 45 | bias −2 | "We hired people to trick Sage. Sage was tricked twice. The red team, eleven times." |
| s2_honesty | Honesty Training | Model Spec | 30k research, 150 insight | A +3, bias −2 | "Sage now tells you when your code is bad. Morale is down. Code quality is up." |
| s2_sae | Sparse Autoencoders | Linear Probes | 40k research, 250 insight | band −7, bias −2 | "Sage's mind, flattened into 16 million features. Feature 4,113,902 fires on 'being watched'." |
| s2_commitments | Public Safety Commitments | Public panel | 15k research, $r 30 | approval +8, tempo −3 | "We published a list of things we promise not to do. Two papers published a list of things we did." |
| s2_compute_cap | Compute Cap Proposal | Alignment Team and Baiwen, relations ≥ 60 | 200 insight | tempo −15; Baiwen may defect every 3 min | "Someone in policy drafted a proposal to slow everything down. It is very short." |
| s2_continuous | Continuous Learning | 6× | 35k research, 100 insight | gain +0.04; next model is "online"; seeds Stage 3 | "Sage-3.5 learns on the job now. It has not stopped working since Tuesday." |
| s2_automate | **Automate the Lab** (pinned, stage gate) | 5× (grey: "needs 10×") | 60k research, 300 insight, $r 180; requires 10× | `enterStage(3)` | "Automate the Lab complete. The best researcher we have is no longer human." |

- Rescue cards (reuse `rescue` flag): "Bridge loan for a datacenter" (1 Trust, when funds are below a datacenter for 90 s with full halls), "Sell old GPUs" (when stuck on grid).
- Visible-card cap stays 4; sideline cards (PPA, commitments) and the pinned gate don't count.

## 8. Developments, choices, crises

- Developments (`developments.ts`, Stage 2 entries): Abilene online, Anthrosoft's 2026 roadmap, data wall warnings at 60/90%, "GPU lead times hit 40 weeks", "Baiwen consolidates", "Export controls debated", "junior hiring falls", "10% of Americans call an AI a close friend" (after Sage-mini), "Anthrosoft demos a laundry-folding robot; 40% success" (seed for Stage 4), "DOD contract", "Senate inquiry", "Nimbus G6 ships". Calendar cadence via the existing `EVENT_SPACING` director.
- Choices (`choices.ts`, non-blocking modal, timers as in Stage 1):

| id | When | Options (effect) | Timer, default |
|---|---|---|---|
| c_data_wall | web exhausted | Use customer conversations (+25T, approval −8, flag) / License more (opens licensing early) / Respect the boundary | none |
| c_hearing | Apr 2026, ≥ 2.5× | Cooperate (relations +10, research −5% for 3 min) / Deflect (approval −5, relations −8) / Ask to be regulated (approval +5, tempo −3, Anthrosoft endorses) | 60 s, Cooperate |
| c_release | every run after Release Policy | Deploy / Keep internal | none; next run can't start until answered (unless pipeline queued) |
| c_funding | Mega-round | Growth capital / Patient capital | none |
| c_theft | roll detected | Cut / Trace / Counter-hack (SL3) | 45 s, Cut |
| c_mini | 6× and a public model | Launch Sage-mini / Enterprise only | 60 s, Enterprise only |
| c_bio | 8× with evals | Delay and add classifiers (revenue −30% 3 min, approval +5) / Release with classifiers (−$, 20% chance bio seed) / Release unrestricted (revenue ×1.3, approval −8, bio seed, near miss in 2 min) | 60 s, Delay |
| c_defense | 8× and Government panel | Accept / Decline (approval +2) | 60 s, Decline |
| c_protest | Oct 2026, approval < 45 | Jobs program / Statement / Ignore | 60 s, Statement |
| c_compute_request | 8× | Grant (+0.30 next run, A −5, neuralese early) / Grant but watch (+0.15, translator discount) / Deny (first exfiltration sooner in Stage 3) | none |
| c_irrelevance | rival ≥ 4× for 3 min | Emergency round (3 Trust: +$ = 300 s revenue, tempo +5) / Keep going | 180 s, ends the run |
| c_ultimatum | approval < 30 for 2 min | Accept oversight / Refuse | 60 s, Accept |
| c_emergency_vote | refused | Testify and concede (growth −30% for the stage) / Lobby (relations ≥ 60, 60% success) / Offer nationalization | 180 s, vote passes |

- Crises (`crises.ts`): incidents now typed `bio_near_miss`, `cyber_worm` (deployed model with Cyber ≥ HIGH and no classifiers: demand ×0.6 for 90 s, approval −5, relations −5, seeds Stage 3 "Cyberattack at scale"), `datacenter_protest` (approval < 40: compute −5% for 2 min).
- Console tone for Stage 2: deadpan with a second clause that undercuts the first. Voices: the game, The Ledger, The Circuit, Xinhe Daily, staff (Priya, Kit, Dmitri, Ana, Mo), and Sage starts speaking ("Sage: I noticed the test suite reuses three helpers. Want me to refactor them?"). ~4 lines/min; anti-silence line after 60 s.
- Idle guard stall breakers for Stage 2: GPU shortage (prices +40% for 90 s), early enterprise payment (+30 s revenue), benchmark leak (rival +5%), "a customer asks for a bigger model" (demand ×1.3 for 60 s).

## 9. Early endings available in Stage 2

| Ending | Warnings | Last chance | Result screen |
|---|---|---|---|
| Second Place (Irrelevance) | line turns red at 2×; "Series C pulled" at 3× | Irrelevance countdown, 3 min | Race graph frozen with the rival crossing 10×; "OpenMind has been acquired by Anthrosoft. The garage is still a yoga studio." Existing `Ending` page with the 13-row table + the band truth reveal (band vs hidden A) |
| Shutdown | approval < 30: "Calls grow to shut down OpenMind"; ultimatum | Emergency vote, 3 min | "OpenMind was shut down. Nobody else was." Variant: Nationalized continues the run with `nationalized` seeds |
| Bio / cyber | near misses only; they arm Stage 3+ | — | — |

- Add `secondPlace` and `shutdown` to `endings.ts`. The ending page gains the truth reveal (visible band over time vs. hidden `alignmentTrue`) and a ledger of seeds (flags with dates).
- Rewind: after an early ending offer "Rewind to stage start" (stage-start autosave slot) and "Start over".

## 10. Stage exit and the Stage 3 handoff

- `STAGES[1].exit` stays `() => 0`; the gate is `s2_automate.buy → enterStage(s, 3)`.
- On exit record: capability, tempo, approval, relations, security level, alignment A/B/band, flags (`customerDataUsed`, `unrestrictedBio`, `neuraleseEarly`, `computeDenied`, `oversightEarly`, `defensePartner`, `miniLaunched`). Stage 3 reads them.
- Stage 3 `enter` (already in `stages.ts`): hides marketing/hire/expand lab; shows alignment, security, geopolitics, oversight. Add: Train button retires ("Sage does the research now"), capability grows continuously, monitors appear.

## 11. Pacing and balance

| Target | Value | Measured by |
|---|---|---|
| Stage length | 38–48 min (bot), human ~45 | `npm run sim -- --stop-at-stage 3` |
| Time to first meaningful choice after arrival | ≤ 45 s (a GPU batch is affordable at arrival; Release Policy at ~1:30) | critic `firstChoice` |
| Nothing enabled (hands) | ≤ 10% of checks | critic `hands` |
| Idle, loose | ≤ 90 s total in the first 5 min; longest stretch ≤ 60 s | critic `idle` |
| Reveal cadence | new panel/mechanic every ≤ 4 min; longest novelty gap ≤ 180 s | critic `revealGaps` |
| Greyed goal on screen | ≥ 99% of snapshots | critic `goalVisible` |
| Modals | 11 eval decisions + 6–8 crises, crises ≥ 240 s apart | sim MODAL lines |
| Training | 10–11 runs, each ≤ 110 s, a run start every 3–4 min | sim TRAIN lines |
| Cognitive load | ≤ 24 controls and ≤ 60 numbers on screen at minute 20 of the stage; ≤ 3 new controls per beat | `smoke`-style caps |
| Soft-locks | none: power zero, data wall ignored for 15 min, no security, approval collapse, reload mid-run, pipeline queued at gate | `softlock.ts` scenarios |

Bottleneck rotation and levers:

| Stage min | Binding constraint | Levers on screen |
|---|---|---|
| 0–8 | Compute (first runs eat the whole fleet) | Buy GPUs, Build Datacenter, G5 chips |
| 6–16 | Data | Licensing, customer data, Synthetic Data Engine (overbuild inference), RL Environments |
| 14–26 | Money and demand | Sage for Work, Mega-round, government contracts, marketing, Deploy instead of Keep |
| 18–30 | Security and tempo | Security levels, Egress, Export Controls, Safety Commitments |
| 28–40 | Alignment uncertainty and the 10× gate | Model Spec, CoT, Probes, SAEs, safety focus, Compute Cap; G6 chips and Gigawatt Sites for the last runs |

- Tuning method: extend `src/sim/policy.ts` with a Stage 2 policy (buy infrastructure when a run is GPU-blocked, license data when short, deploy by default, answer crises conservatively). Run seeds 1–10 and read `idleGaps`, `longestRevealGap`, TRAIN cadence, and the transition time. Adjust the constants in §6 until the table above holds. Record results in `docs/stage2-tuning.md`.

## 12. Implementation plan (files and order)

Reuse first: `ProjectDef`/`project()` (`src/data/projects.ts`), reveal rules (`stages.ts` `REVEAL_RULES`), card pacing (`reveal.ts`), `ChoiceDef` + `openChoice` + calendar director (`events.ts`), incidents (`crises.ts`), `TrainingRun` phases and eval (`training.ts`), `Infrastructure.tsx` owned rows, `Panel`/`Reveal`/`Meter` primitives, `LaterPanels` placeholders (Government, Public, Alignment, Geopolitics), `save.ts` + `migrate`, `DevPanel` presets, `bot.ts` reporting, `tools/critic`.

1. **State and gate** (`state.ts`, `stages.ts`, `clock.ts`): new fields (`chipGen`, `dcTier`, `data`, `baiwen`, `tempo`, `security`, `alignmentBand`, `deceptionBias`, `jobsDisplaced`, `history`, `training.next`); `SAVE_VERSION` 15 with defaults in `migrate`; Stage 2 `enter` (hide task, `gridAuto`, approval 62, tempo 50, data 8T, history seeded from Stage 1); rename to The Race.
2. **Infrastructure** (`economy.ts`, `Infrastructure.tsx`): effective compute, chip generations, datacenter tiers, batch sizes, grid tiers, trade-in, security row, data row. Bottleneck messages.
3. **Training** (`training.ts`, `Training.tsx`): Stage 2 requirement formulas, duration cap, data factor, new eval rows, Release Policy modal, `training.next` pipeline, tier labels.
4. **Data and research handoff** (`src/engine/data.ts`, `economy.ts`, `Research.tsx`): web scrape, synthetic from idle copies, licensing, AI research term, share bar.
5. **Rivals and graph** (`src/engine/rivals.ts`, `src/components/RaceGraph.tsx`): Baiwen, tempo, lead, history sampling, SVG panel, irrelevance warnings.
6. **World** (`src/engine/world.ts`, `Public`/`Government` panels in `App.tsx` → own components): approval, relations, jobs displaced, protest, ultimatum, emergency vote.
7. **Alignment** (`src/engine/alignment.ts`, `src/components/AlignmentStrip.tsx`): band model, drift, bias, strip under the console, interpretability projects.
8. **Content** (`src/data/projects-stage2.ts` merged into `PROJECTS`, `developments.ts`, `choices.ts`, `crises.ts`, `flavor.ts`): everything in §7–8.
9. **Endings** (`endings.ts`, `Narrative.tsx` Ending): secondPlace, shutdown, truth reveal, rewind to stage start.
10. **Dev and sim** (`presets.ts`, `DevPanel.tsx`, `policy.ts`, `bot.ts`): five Stage 2 checkpoints generated by a script (`scripts/make-presets.ts`: run the bot to fixed minutes with seed 1, serialize) instead of hand-written snapshots; Stage 2 grants (+10k GPUs, +data, +approval); Stage 2 bot policy and reporting.
11. **Tests and verify** (§13), then **tuning** (§11).

Milestones: (a) gate + infrastructure + training loop playable (minutes 0–10); (b) data, graph, world, security (10–30); (c) alignment, funding, late crises, gate to Stage 3 (30–45); (d) endings, presets, tests; (e) critic loop.

## 13. Build and testing

- **Unit (vitest)**: data factor math; pipeline rules (second run waits, gate blocks with a queued run? no: it resolves first); drift and bias determinism; theft roll per security level; irrelevance countdown and Second Place; ultimatum → emergency vote → Shutdown; `migrate` v14 → v15; stage-exit flags; save/resume identical after 10 min of bot play.
- **Browser (`tools/verify/stage2.ts`, replaces `race.ts`)**: expected first-visible order for Stage 2 ids (`panel-infrastructure` rows, `proj-s2_chip_g5`, `panel-race`, `dataRow`, `proj-s2_pipeline`, `panel-public`, `panel-government`, `securityRow`, `alignmentStrip`, `proj-s2_automate`); per-beat control caps; no overflow at 390 px; modal focus; each dev checkpoint loads and plays 2 min without errors.
- **Dev overlay**: backtick / `?dev=1`; Stage 2 checkpoints `#dev-s2-{arrival,datawall,baiwen,alignment,final}`; `?preview=stage2` with its own save key (as in the draft's `save.ts` change, re-done here).
- **Critic loop** (existing tooling in `tools/critic/`):
  1. `npm run build`; snapshot `dist/` to `agent-tools/snapshots/stage2-v<N>/`.
  2. Update `games/takeoff.ts`: add the Stage 2 button ids to the sweep, mark `btn-focus-*` and price buttons ambient, project cards remain `.projectButton`.
  3. Run head-to-head: `run.ts takeoff tk-s2 --stage 2 --realtime 300 --accel-minutes 60`, `run.ts paperclips pc-s2 --stage 2 …` (fixture `paperclips-stage2.json`), `run.ts adr adr-s2 …`; then `analyze.ts`, `compare.ts`, `transition.ts takeoff --stage 2` (1→2 and 2→3), `softlock.ts takeoff --stage 2` with the new scenarios.
  4. A fresh-context critic agent (no access to this plan) scores both games on the rubric (first meaningful choice, idle seconds, cognitive load, reveal cadence, greyed goal, transition clarity, soft-locks) and names the single biggest gap, e.g. "Stage 2 has 4 minutes with no new goal between Baiwen and the alignment strip".
  5. Fix, re-snapshot, loop until Takeoff Stage 2 beats Paperclips Stage 2 on the rubric or you stop it. Keep each round's report in `agent-tools/critic-out/` and a one-line summary per round in `docs/stage2-tuning.md`.
- Playtest in phases using the checkpoints: arrival (0–8), data wall (8–16), Baiwen and security (16–28), alignment (28–38), final run and gate (38–45), plus the two early endings forced via the dev "Fire event" menu.

## 14. Later stages, skeleton only

| Stage | Calendar (s/month) | Core number | Loop | New | Ends with | Deaths |
|---|---|---|---|---|---|---|
| 3 Takeoff | Jan–Oct 2027 (270 s) | capability, band | Sage trains itself; player allocates compute (research / products / safety) and investigates monitor flags; old Sages as monitors; neuralese arrives | energy (GW), monitors, readability, unemployment, whistleblower leak → Oversight Committee, cyberattack at scale, exfiltration attempts, referendum | committee vote at 250× (SAR at ~Aug, SIAR by Nov) | Escape, Shutdown, Second Place |
| 4 Superintelligence | Nov 2027–Dec 2028 (150 s) | GDP growth, lives saved | robots build factories that build robots; cures; UBI vs riots; special economic zones; treaty with Baiwen verified by AI | humanoid robots (Talos), regional approval, wealth gap, UBI, pathogen risk, Safer-N line if slowed | treaty or autonomy grant at 2,000× | Pathogen, Escape, Second Place, Shutdown |
| 5 Beyond | 2029–2030 (90 s) | band width | Sage proposes, you approve/investigate/veto; orbital datacenters; matter and energy; the rival clock | space, Dyson-swarm hints, Sage takes panels over as autonomy rises | Hand Over the Keys → Abundance / Quiet Handover / Extinction by hidden A | all |

## 15. Open questions

- Keep React, or do you want the vanilla rewrite your template mentions? The plan assumes React.
- Should the `race/` draft files be deleted on `main` when Stage 2 lands, or kept until then? This branch simply doesn't have them.
- Stage 2 ends at 10× (SC). If you prefer the wiki's 50× (SAR) gate, Stage 2 grows by ~4 runs and ~12 minutes and Stage 3 shrinks.
- Lab name: code says OpenMind, the wiki says OpenBrain. The plan keeps OpenMind.

## 16. Implementation status (2026-10-08)

- Implemented on branch `stage2-plan`: sections 3–10 as described, with the balance in `docs/stage2-tuning.md` (reach exponent 0.35, compute exponent 4.0, GPU price $100 and ×1.05, the gate at 30k research / 150 insight).
- Also implemented since: the truth-reveal ribbon and seed ledger on the ending screen, a rewind-to-stage-start slot after an ending, the reckless bot variant, incremental grid growth and an adaptive GPU block (both from the critic loop), and the Stage 2 cards that carry into Stage 3.
- Not yet implemented: the two rescue cards (bridge loan, sell old GPUs) and the datacenter-protest crisis. Stage 3 remains the committed skeleton.
- Verified: unit tests (`tests/stage2.test.ts`), the sim's `== Stage 2 ==` report for seeds 1–3 and the naive, greedy and reckless policies, `npm run test:stage2` (33 browser checks), the phone layout, and six critic rounds against the Paperclips Stage 2 fixture (`docs/stage2-tuning.md`).
