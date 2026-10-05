# Takeoff — Stage 2 ("Scale") vs Universal Paperclips — Stage 2 · critic round 1

Reviewer brief: fresh context, no design docs read, live source tree not read. The build under
review is the frozen copy `agent-tools/snapshots/s2-r1/`; its source was opened only to learn the
`window.__game` API, the control ids and the state field names (`main.ts`, `ui/dev.ts`,
`ui/render.ts`, `ui/stores.ts`, `engine/state.ts`) and to chase two causes (`engine/stages.ts:135`,
the government clamp at the gate; `engine/infrastructure.ts:303`, the nuclear discount).
Everything below was measured by driving both games in headless Chrome with the harness in
`tools/critic/`: the same scripted "curious first-time player" for both, Takeoff's own Autoplay
bot, then 34 play-style variants of the first-timer on three seeds each (102 runs) and 18 scripted
probes on Takeoff (13 new, 3 canned, 2 from the older explorer), and 5 reference runs and 8 probes
on Paperclips.

Scope. **Takeoff Stage 2**: from dev preset 2 (the designers' median Stage 1 state at Break ground,
run through the arrival; its five arrival lines print at 0:02–0:10) to the click on
`Let Sage-3 write the code` — 38:30–41:26 for the first-timer, 40:32–40:54 for the bot. The
arrival itself was also played from a new game on this build (Stage 1 → 2 at 30:42–32:06).
**Paperclips Stage 2**: from the harness fixture just after `Release the HypnoDrones` to
`Space Exploration` — 135:46 for the same first-timer (127:26–135:46 across five variants of it).

**Result: Takeoff 7.4, Paperclips 6.7. Takeoff wins the fixed rubric, on the rows that count what
appears and what is explained (a, d, e, g); it loses the two rows that count what the player is
doing and how much the screen asks of them (b, c). The single biggest gap is that from the
Standing order to the gate — 72–74% of the stage — the player has almost nothing to press (§6).**

All raw data is in `agent-tools/critic-out/` (`s2r1-*` = rubric runs, transitions and canned
probes; `s2x-*` = this round's play styles and probes; `s2r1x-*` = the older explorer at Stage 2);
§10 says how to re-run each and lists every harness change.

---

## 1. Method and definitions

### Harness

* `run.mjs <game> <label> --stage 2`: phase 1 = real wall-clock play (300 s in one Takeoff run),
  phase 2 = deterministic 2-s game-time steps to the stage end or the cap. A snapshot every 2 s
  records every visible button / card / slider / panel (enabled or greyed, with the reason the game
  prints beside a greyed button), the console and Developments lines, any event, the count of
  numeric tokens on screen and the game's metrics.
* **Reproduction.** The existing baselines were re-run before anything else: Takeoff seeds 1–3 and
  the bot (586 / 579 / 589 / 645 events, 157 / 153 / 162 / 0 policy actions) and Paperclips Stage 2
  (1,029 events, 2,689 actions) are **identical** to the stored `tk-s2-seed1..3`, `tk-s2-auto` and
  `pc-s2`. The Takeoff run with 300 s of real time is identical, event for event, to the stepped
  seed 1 — in Stage 2 nothing depends on sub-2-second timing.
* **Policy** (README "Takeoff Stage 2 (Abilene)" and "Paperclips Stage 2 (Earth)"): the first-timer
  presses Train whenever it is enabled, red-teams to zero and releases publicly, buys infrastructure
  by the reason printed on the GPU-lot row, buys every card the moment it is affordable, answers an
  event with its first enabled option, and leaves every setting where it found it (AUTO pricing on,
  Standing order on, Share evals / Job-transition fund off, alignment compute 1%, slider 15%, Focus
  on Capability). In Paperclips it rebuilds the chain with ops, keeps harvesters, wire drones and
  factories in step by the stocks on screen, powers before it builds, runs tournaments for the
  nearest yomi goal and moves the slider to Think only while memory is the wall.
* A second Takeoff trace uses the game's **Autoplay** bot (the designers' "reasonable player").

### Definitions

Unchanged from the Stage 1 reports (reveal, enabled transition, nothing-to-do (loose), novelty
gap, reveal gap, greyed-out goal on screen, cognitive load, first meaningful choice, decision gap,
reveal → purchase latency; all windows run from the stage start, t = 0, to the stage change). From
Stage 2 on the harness also counts repeat purchases as drip (Paperclips' drones, farms, batteries;
Takeoff's GPU lots, plants, datacenters). Three measures were added this round because the two
stages differ in *kind*, not only in length:

* **Hands-idle gap** — time between consecutive player clicks of any kind (drip included). Reported
  as the share of the stage spent inside gaps of ≥ 30 s.
* **Affordable things** — at each 2-s check, the number of distinct enabled purchases (bulk sizes of
  one item count once; settings and "Disassemble All" do not count).
* **Pipeline state** (Takeoff) — at each check, whether a training run is in progress, and if not,
  which of the Train button's printed costs the stores cannot cover.

### Where a number is the policy, not the game

* **Takeoff's first-timer never saves**, so anything affordable is bought within one check and the
  "nothing enabled" share is as high as it can be; a human who saves for a datacenter sees more
  black buttons and presses fewer. Paperclips' first-timer has the opposite bias (a bulk buy only
  when it costs ≤ 10% of the clips), so a drone is nearly always left affordable. The structural
  difference survives both biases: Paperclips' Stage 2 has five repeatable sinks for one currency;
  Takeoff's has one (the GPU lot), which a card hands to the Standing order at 10:16–10:56, and
  everything else is one-shot or locked "to spare".
* **Paperclips' length is not an artifact of one rule.** Five versions of its first-timer end the
  stage at 135:46 (as shipped), 135:32 (drones always wait for a factory while wire piles up),
  134:30 (that, and bulk buys up to 50% of the clips), 129:00 (those, and the slider fully on Think
  whenever memory is the wall) and 127:26 (arriving with 15,000 yomi; the fixture arrives with 0).
  The longest reveal gap is 2,198 / 2,276 / 1,198 s in the first, fifth and fourth. The pace is set
  by ops capacity (80,000–120,000-op projects against a 70,000 cap, raised only by swarm gifts), not
  by how the drones are bought. Still an upper bound for a human: this player never presses Quantum
  Compute (which can push ops past the cap), buys two tournament strategies before the Power Grid
  (first drone at 7:44, first factory at 11:00; the right order would save about three minutes) and
  the fixture's resource values are round numbers, not a played Stage 1.
* **The Stage 2 preset is not a played arrival.** A played arrival on this build lands with $98,550
  and a training run at 87%; the preset lands with $95,500 and an idle pipeline. The arrival rubric
  row uses the played one (§2e, §3f).
* The bot answers events inside the tick that opens them and buys inside ticks, so its loose
  nothing-to-do (20–27%) and its event list are not comparable with the first-timer's.
* Stepped screenshots catch Takeoff's 0.8-s fade-in half-way.

### Runs used

| label | what |
|---|---|
| `s2r1-tk-rt` | Takeoff Stage 2, 300 s real time + stepped to the stage end (41:26), seed 1 — primary |
| `s2r1-tk-seed1…3` (≡ `tk-s2-seed1…3`) | Takeoff, stepped, seeds 1–3 (41:26 / 38:30 / 38:38) |
| `s2r1-tk-auto`, `-auto-seed2`, `-auto-seed3` | Takeoff, the game's Autoplay bot (40:54 / 40:32 / 40:48) |
| `s2r1-pc` (≡ `pc-s2`), `pc-s2-rt` | Paperclips Stage 2, stepped to Space Exploration (135:46); its first 5 minutes in real time |
| `s2r1-pc-save`, `-save-bulk`, `-brisk`, `s2x-pc-stage-yomi` | Paperclips fairness variants (135:32 / 134:30 / 129:00 / 127:26) |
| `s2r1-transition-takeoff-s1[-seed2,-seed3]`, `s2r1-transition-takeoff-s2`, `s2x-exit` | Takeoff arrival (played from a new game, three seeds) and exit (canned, and held for 30 s) |
| `s2r1-transition-pc-s1`, `s2r1-pc.transition.*` | Paperclips Stage 1 → 2 and 2 → 3 |
| `s2r1-softlock-takeoff-s2` | canned dead-end probes (identical to the stored report) |
| `s2x-<style>[-seed2,-seed3]` | 34 Takeoff play styles × 3 seeds (§4, §5); `s2x-table.md` |
| `s2x-<probe>`, `s2x-pc-<probe>`, `s2r1x-*` | 13 new Takeoff probes, 8 Paperclips Stage 2 probes, 2 older explorer probes at Stage 2 (§4) |

---

## 2. Reveal timelines

### 2a. Takeoff — first 5 minutes (`s2r1-tk-rt`, real time; identical to the stepped seed 1)

| t | event |
|---|---|
| 0:00 | Stage 2 screen: Developments · a **stores** box ("funds $ 95,500.00 / research 33,000 / 36,000 / insight 4 / trust 2 / GPUs 1,000 / 10,000 / power 1.0 / 5 MW / copies 1,250") · Business ("Avg. Rev. per sec: $ 1,044.00", greyed lower / raise, "Billing 506 tasks/s at $ 0.21 **AUTO**", Marketing "Cost: $ 102,400.00") · Infrastructure ("Buy GPUs (1,000) $95,000") · Research (Hire Researcher, Expand Lab) · Projects (empty) · Training ("Current model: Sage-1.5 · 1.64×", "Ahead of Anthrosoft", Focus ×3, "Train Sage-1.6 Cost: $55,269, 23,400 research", "Compute: 1,000 of 1,176 GPUs wanted · undertrained (92%)") |
| 0:02–0:10 | the five arrival lines (§2e) |
| 0:02 | first cards: Research blog post (10 insight), Web crawl (15,000 research) |
| 0:20–0:24 | first run started (`Not enough compute. Sage-1.6 trains to 92%.`); `The Data Wall — the next run needs 1.6 T. The lab holds 0.0 T.`; Web crawl bought (`Crawlers released. 15 trillion tokens of public web, once.`), a "data" row joins the stores |
| 1:02 | Research cluster ($114,000) |
| 1:40 | Gas turbines (+20 MW) row (`Power draw is 60% of the substation. Gas turbines can be on site in a week.`) |
| 2:06–2:08 | first evaluation and release (Sage-1.6, 1.85×) → **Capability panel**: a graph of Sage, Anthrosoft and Baiwen against "1× human researcher / 1.5× reliable agent / 4× superhuman coder", "Next: superhuman coder at 4.00×", "Baiwen: about 5 months behind"; AI research assistants ($190,000, 15 insight) |
| 2:22–2:38 | Series B (free: +$475,000, 3 Trust, a marketing push); Agent platform |
| 2:28 | `No power for more GPUs — 5.0 of 5 MW in use. Gas turbines are fast.` |
| 3:14–3:24 | Build Datacenter 2 (+15,000 slots) row; Standing order ($400,000, 30,000 research); Solar + storage (+50 MW) row |
| 3:38–4:32 | three insight cards (Launch demo video, Workshop paper, Conference keynote) |
| 4:26 | `No room for more GPUs — 10,000 slots, all full. Build Datacenter 2.` |

Policy actions in those 5 minutes: 34 clicks — 9 GPU lots, 15 Hire / Expand, 6 cards, 1 Train, 1
Release, 1 Marketing ($409,600 at 2:22, with the Series B money), 1 gas turbine. GPUs 1,000 →
10,000, revenue $1,044/s → $5,892/s, one model trained and shipped.

### 2b. Takeoff — whole stage (`s2r1-tk-rt`, 41:26; cross-checked against seeds 2–3 and Autoplay)

| t | event |
|---|---|
| 5:52 | **allocation slider** ("Copies on research: 15%", "Human share of research: 31%") after AI research assistants |
| 6:50–6:52 | event *Release Sage-2* (no timer: public or internal) → Sage-2, 2.06×; Agent scaffolding |
| 8:34–9:56 | Keep internal button; Sage-2.1, 2.29× (8:56); Publish the Spec, Automated evals, Mixture of experts, Policy team ($475,000, 2 Trust), Security level 2 ($1.2M) |
| 9:20–9:22 | event *A Senate Hearing* (59 s) → **Government panel** ("Relations: 58 (cordial)") |
| 10:52–10:54 | Standing order bought (`Standing order placed. GPUs arrive when there is room, power and cash.`); its ON toggle |
| 12:38 | event *Can I try something?* (19 s) |
| 13:38–14:08 | Sage-2.2, 2.60× (13:52); Experiment scheduler, Parallel pipelines, International launch; **Security panel** (14:04); Train greyed "needs 6.4 T data" |
| 15:08–15:24 | event *The Publishers* (no timer); Synthetic data, License the code hosts |
| 15:24 → 17:32 | 128 s with no new element |
| 17:32–18:32 | Nimbus G5 order; event *A Month of Evals* (45 s); **Public panel** ("Approval: 0", "Jobs displaced: 0.10M") and Free tier (18:04); Sage-2.3, 2.85× (18:32); Long-horizon memory; the gate card, pinned: **"Let Sage-3 write the code (needs a released 4.00× model)"** |
| 19:56–22:38 | Distillation: Sage-mini; event *The Pentagon Calls* (20:08, 90 s); Dashboard; Data flywheel; Nuclear PPA (+500 MW) row (22:04); event *Al-Marsa* (22:38, 90 s) |
| 23:28 | **Stats panel** ("Copies thinking … at 11× human speed", run-rate, lead, "Alignment (as measured): 69") |
| 23:28 → 26:20 | **172 s with no new element** — and the model has stood at 2.85× since 18:32 |
| 26:20–26:24 | Behind-the-meter; event *4 a.m.* (58 s); Sage-2.4, 3.16× (26:22, 7:50 after the last release); Security level 3 row ("$28.5M, 3 Trust") |
| 27:36, 29:10 | "Alignment compute: 1%" button; Job-transition fund toggle |
| 29:10 → 31:36 | 146 s with no new element |
| 31:36–33:28 | Checkpoint farm, Honesty evals; Sage-2.5, 3.53× (31:46); event *A Joint Statement* (33:00, 90 s); Share evals toggle (33:02); Series C (free); Brief the administration |
| 34:16–40:30 | six cards at $20.0M–$114.0M (Retire human code review, Sage-3 system card, Nimbus G6 pre-order, Second campus, Community benefits agreement, Counter-offer for the alignment lead); Sage-2.6, **3.90×** (35:06) |
| 41:26–41:28 | `The outside evaluators sign off. Sage-3 can ship.` → Sage-3, 4.25×; the gate card reads "(ready)"; clicked → Stage 3 |

Shape of the stage in all three first-timer traces: nine training runs, released at intervals of
2:08–2:18, 2:48–4:44, 2:04–3:14, 4:56–6:36, 4:18–4:40, **7:02–7:50**, 4:30–5:24, 3:20–3:44 and
3:56–6:22; five new panels (2:08–2:18, 8:06–9:22, 14:04–16:02, 14:18–18:16, 18:40–23:28) and then
none; 38–39 cards (median gap 30–63 s, longest 208–386 s, all between 18:46 and 31:36); eight
events 2:30–4:52 apart (most of them 2:30) from 4:54–6:50 to 26:04–26:28 and a ninth at
33:00–33:04; reveals per five minutes 15–16, 10–11, 6–8, 10–13, 3–6, 4–5, 7–8, 3–4. Autoplay: twelve runs, 40:32–40:54, longest reveal
gap 130–160 s (7:06 → 9:46), Stats only at 33:28.

### 2c. Paperclips — first 5 minutes (`pc-s2-rt`, real time)

| t | event |
|---|---|
| 0:00 | Manufacturing ("Clips per Second: 0", "Wire: 1.00 thousand inches"), Computational Resources (Processors 30, Memory 70, "Operations: 70,000 / 70,000"), Quantum Computing, Projects, Strategic Modeling ("Yomi: 0"); Limerick and Tóth Tubule Enfolding (45,000 ops) bought |
| 0:02–0:20 | grey cards: Photonic Chip (35,000 ops), New Strategy: TIT FOR TAT (30,000), AutoTourney (50,000 creat), Quantum Temporal Reversion (−10,000 ops), **Power Grid (40,000 ops)**, New Strategy: BEAT LAST (32,500) |
| 0:18, 2:06 | the first-timer buys the two strategies (62,500 ops) before the grid |
| 2:08 | Theory of Mind (25,000 creat) |
| 2:08 → 4:22 | 134 s with nothing new |
| 4:20–4:22 | Power Grid bought → **Power panel** (Solar Farm, Battery Tower, +10 / +100, two Disassemble All, "Factory/Drone Performance", consumption, production, storage) and Nanoscale Wire Production, in one beat |

Seven clicks in five minutes; "Clips per Second: 0" throughout.

### 2d. Paperclips — rest of Stage 2 (`s2r1-pc`, 135:46)

| t | event |
|---|---|
| 6:18–9:04 | **Wire Production panel**; Harvester Drones → Harvester Drone buttons (first drone 7:44); Wire Drones → Wire Drone buttons; Clip Factories (35,000 ops) |
| 11:00 | Clip Factory button — the first factory; production resumes |
| 13:10–15:24 | Swarm Computing (12,000 yomi), Coherent Extrapolated Volition, Cure for Cancer, World Peace, Global Warming, Male Pattern Baldness |
| 20:22, 22:00 | Drone flocking: collision avoidance (80,000 ops); Momentum (30,000 creat) |
| 22:00 → 38:28 | 988 s with no new element |
| 38:28 | **Swarm Computing panel** (Work / Think slider, gifts) |
| 38:28 → 75:06 | **2,198 s with no new element**; 9 factories and "Clips per Second: 900.00 billion" from 20:00 to 75:00; four decisions that are not a drone, farm or battery between 40:00 and 75:00 |
| 75:06–85:52 | Upgraded Factories (80,000 ops), Hyperspeed Factories, Drone flocking: alignment |
| 101:28–117:42 | AutoTourney toggle, Self-correcting Supply Chain, Drone Flocking: Adversarial Cohesion |
| 119:56 | "Available Matter: 0 g" → **Space Exploration (120,000 ops, 10,000,000 MW-seconds, 5 oct clips)** |
| 124:56 | Entertain the Swarm (`No matter to harvest. Inactivity has caused the Swarm to become bored`) |
| 135:46 | Space Exploration bought |

2,651 clicks, 2,425 of them drones, farms and batteries (1,274 single Wire Drone presses by this
policy; a human uses the bulk buttons).

### 2e. On the screen

* **Takeoff, minute 0** (`tk-s2-seed1.t0.png`): Stage 1's four columns with one change that reads at
  a glance — the *stores* box, a bordered list of seven label / value rows in the style of A Dark
  Room. "GPUs 1,000 / 10,000" and "power 1.0 / 5 MW" put the two walls of the stage on screen as
  fractions from the first second. The first decision is stated in words on the Train row
  ("1,000 of 1,176 GPUs wanted · undertrained (92%)") with a $95,000 lot and a $55,269 run against
  $95,500.
* **Takeoff, minutes 5–41** (`.t5/.t10/.t20/.tend.png`, `s2x-baseline.view1500.png`): a dashboard
  that fills the fourth column downward — Training, the capability graph, then Security, Government,
  Public, Stats, each arriving as one line. It is tidy and every card is a title, a price and one
  sentence that states its effect ("Customers hand over whole jobs instead of questions: market
  ×1.6."). But from minute 10 it is mostly grey: at 25:00 the screen shows five greyed
  Infrastructure rows ("Buy GPUs (5,000) $1.0M *standing order*", "Build Datacenter 4 (+50,000
  slots) $3.8M", "Gas turbines (+20 MW) $560,000 *power to spare*", "Solar + storage (+50 MW)
  $570,000 *power to spare*", "Nuclear PPA (+500 MW) $21.4M *power to spare*"), greyed lower / raise
  and Marketing ("Cost: $ 26.2M"), greyed Hire Researcher / Expand Lab, four greyed cards and a
  training bar. The only live controls are Complete Task, AUTO, the slider, Focus and the Standing
  order toggle. Median over the stage: 15 greyed controls, 0 enabled purchases.
* **The capability graph** reads at a glance for most of the stage: a black staircase climbing
  toward a dotted line labelled "4× superhuman coder", two grey rivals just under it, a caption
  that names the goal. Two flaws: near the end the series' own markers overdraw the "4× superhuman
  coder" label (`s2x-exit-exit-ready.png`), and the same fact is printed three times ("Anthrosoft
  is ahead" in Training, "Baiwen: about 3.5 months behind" under the graph, "Lead over Baiwen: 3.5
  months" in Stats).
* **What a newcomer cannot tell from the screen**: what the three Focus buttons do (tooltips only:
  "Capability: the next model is 10–14% more capable. Customers notice." / "Efficiency: +7%
  capability, and 25% more copies on every GPU." / "Safety: +7% capability, measured alignment +8,
  and fewer issues on every later run."); what the slider trades (no rate is printed; the Stores
  rows have a good hover — "researchers (34) +425/s / copies on research (14,062) +5,714/s / total
  +6,139/s / full in 0:53", "room for 0 / power for 15,000" — that nothing advertises); which wall
  stops the Standing order (the row says only "standing order"); what government relations, approval
  or lead are for.
* **Events** (`s2x-baseline.modal1…9.png`) are the best-designed element of the stage: a title,
  three sentences, the timer and its default in words ("59 s — then: send the lawyers"), and under
  each option its effect ("testify candidly / government +8 · approval +3 · lead −0.5 months"); a
  greyed option says what it needs ("sign for Al-Marsa / needs $3.9M"). The page behind stays live
  (a real click on Complete Task goes through), focus moves into the panel, Tab walks the options,
  Escape takes a timed default. One flaw: the panel sits on top of the stores values — while "The
  Publishers" offers "license the archives / +10 T data now · approval +2 · $475,000" the funds row
  reads "$ 731,0" and the data row's value is covered (`s2x-baseline.modal4.png`).
* **Reveals** fade in over 0.8 s; a new control gets a console line when it is a mechanic
  (`Solar + storage: cheaper power, but it waits in the interconnect queue.`, `Alignment compute: a
  share of the copies can check the others. It is 1% now.`); panels arrive as one line and cards
  silently, as in Paperclips. An affordable card turns dark with a black border; the gate card has
  a heavier border from the moment it appears.
* **Paperclips** (`pc-s2.t0…t20.png`, `.tpre.png`): three columns that barely change shape from
  11:00 to 38:28. Each production box carries its own rates next to its buttons ("Acquired Matter:
  55.64 trillion g (1.02 trillion g per sec)", "Wire: 546.31 billion inches (873.74 billion inches
  per sec)", "Consumption: 2,265 MWs / Production: 2,300 MWs"), so the bottleneck can be read off
  the screen and a purchase moves a number beside the button at once. Nothing is explained (the
  slider says "Work … Think"; "Disassemble All" refunds without saying so), two stale Stage 1 cards
  stay on screen after the arrival, and the mirror's debug buttons are excluded from every count.
* **390 px** (`s2x-mobile-shots-*.png`, `s2x-pc-mobile-*.png`): Takeoff has no horizontal overflow in
  three full-stage runs and the probe at that width; the page is 1.4 screens tall at 0:02 and
  2.5–2.9 from 10:00; events fit (374 × 333 at most). The order puts Training and Projects first and the stage's two controls far
  down: Infrastructure at 938–1,383 px and the slider at 1,284–1,627 px. 15–21 of 19–25 buttons are
  under 32 px tall (19 px). Paperclips at 390 px: no overflow, 1.7–2.8 screens, 19-px buttons too.
* **Arrival** (`s2r1-transition-takeoff-s1.tpre/.transition.png`): before, the pinned card "Break
  ground ($125,000) — Pour the slab, rack the first thousand GPUs. Stop renting."; after, five lines
  2 s apart, the Compute and Abilene panels replaced by Infrastructure with one affordable button,
  the stores box, greyed lower / raise beside "Billing 1,348 tasks/s at $ 0.18 AUTO". **Exit**
  (`s2x-exit-exit-ready/-plus4s/-plus30s.png`): the pinned card goes dark — "Let Sage-3 write the
  code (ready) / Every engineer at OpenMind becomes a manager of copies." — and waits; after the
  click, six lines, 27 controls become 14, a new Alignment panel, and a Business panel that reads
  "Price per Task: $ 0.03 / Billing 0.0/s of 0.0/s produced: *idle*" under "Avg. Rev. per sec:
  $ 725,449.66". Paperclips' transitions (`s2r1-transition-pc-s1.*.png`, `s2r1-pc.tpre/.transition.png`)
  delete more and explain less: Business and Investments vanish and "Clips per Second: 0"; later
  every Earth control vanishes and "0.000000000000% of universe explored" appears.

---

## 3. Rubric

Scores 1–10, higher is better, same scale as the Stage 1 reports. Evidence beside each score.

| Rubric item | Takeoff — Stage 2 | Paperclips — Stage 2 |
|---|---|---|
| **(a) Time to first meaningful choice** (from the stage start) | **8** — second 0: a $95,000 GPU lot and a $55,269 training run against "funds $ 95,500.00", the stake printed on the Train row ("1,000 of 1,176 GPUs wanted · undertrained (92%)"); on a played arrival the first choice comes 20 s in ("Release (6 open)" or Red-team). First event with printed stakes at 4:54–6:50 (*Release Sage-2*: public or internal — the heaviest single choice of the stage, §5). Not higher: the opening choice is an ordering worth about 40 s (income is $1,044–$1,694/s), and the stage's biggest lever, Focus, is on screen from 0:00 with its stakes in tooltips | **6** — 0:00–0:20: 70,000 ops and five ops-priced cards (Tóth Tubule Enfolding 45,000, Power Grid 40,000, Photonic Chip 35,000, two strategies at 30,000 and 32,500) with nothing saying which of them rebuilds production; the first-timer buys both strategies first. First drone 7:44, first factory 11:00 ("Clips per Second: 0" until then); the first allocation choice with feedback on screen (harvester, wire drone, factory or farm) at 9:04–11:00; the slider at 38:28 |
| **(b) Seconds with nothing to do** | **5** — loose: 218–228 s (73–76%) of the first 5 minutes, **1,896–2,060 s (82–83%) of the stage**, longest stretch 82–102 s; no enabled purchase in 85–88% of 2-s checks; no click of any kind for ≥ 30 s during 50–55% of the stage (24–28 stretches, longest 86–104 s) and 63–69% after the Standing order; a run is training for 39–42% of the stage and Train is greyed for want of funds for 49–54%. Stricter measures are good: longest reveal gap 150–184 s (2–4 over 120 s per run), novelty gap ≤ 78 s, decision gap ≤ 126 s, 110–118 non-drip decisions (one per 20–22 s). The wait is short and frequent, and nothing shortens it | **6** — loose: 0 s (a drone or a tournament is always affordable; before the first drone the measure is undefined, and the first eleven minutes are the stage's emptiest: "Clips per Second: 0" and four waits of 108–134 s without a click); no click for ≥ 30 s during 28% of the stage; a median of five distinct things affordable at every check. Stricter measures are poor: 13 reveal gaps over 120 s covering 91% of the stage, the longest 2,198 s (1,198–2,276 s in the variants); novelty gap 800 s; 12 decision gaps over 120 s, the longest 934 s; from 40:00 to 75:00 the hands are busy (drones) and the head is not (four decisions) |
| **(c) Cognitive load & progressive disclosure** | **5** — numbers 32 / 34 / 49 / 55 / 68 / 74 / 69 / 84 at 0 / 1 / 3 / 5 / 10 / 20 / 30 / end (seeds 2–3: 83 and 81 at 20:00); peak 93–100 during the *4 a.m.* event; controls 13 / 12 / 17 / 19 / 24 / 25 / 23 / 31; panels 6 / 6 / 7 / 7 / 8 / 10 / 11 / 11; words 90 → 265–277 (5:00) → 321–337 (10:00) → 369–404 (20:00); 4.6 console lines and 1.4 Developments entries a minute. Disclosure is staged (cards 15 s apart, panels arriving as one line, largest beat outside an event +11 numbers and +3 controls) and every card and option explains itself. Against that: a median of 15 greyed controls, three of them never enabled (lower, raise, Marketing: 0% of checks), the rival stated three times, rates and the binding wall only on hover, Focus only in tooltips, and the event panel covering the funds it prices | **6** — numbers 24 / 24 / 24 / 39 / 54 / 76 / 72 / 61; controls 11 / 11 / 11 / 19 / 29 / 32 / 33 / 31; panels 5 / 5 / 5 / 6 / 7 / 7 / 7 / 8; words 55 → 179 (5:00) → 211 (10:00) → 251 (20:00) → 237–267 after; 1.6 console lines a minute. From minute 15 it shows as many numbers as Takeoff (66–83 against 61–89 at the five-minute marks) and more controls, with a third fewer words, a quarter of the lines, and a layout that holds still. One lump (4:22: +15 numbers, +8 controls, +1 panel in one beat), stale cards after the arrival, and nothing explained |
| **(d) Cadence of reveals** | **8** — 83–84 reveals in 38:30–41:26 (2.0–2.2 a minute); a new panel every ~5 minutes until 18:40–23:28, then none; a new control or mechanic about every 2 minutes until 33:02 (plants 1:40 and 3:24, datacenters 3:14, slider 5:52, Keep internal 8:34, Standing order 10:54, nuclear 22:04, SL3 26:24, alignment compute 27:36, two toggles 29:10 and 33:02); 38–39 cards, one a minute (median gap 30–63 s, longest 208–386 s); eight events 2:30–4:52 apart and a ninth at 33:00; 2–4 reveal gaps over 120 s per run (3.1–6.2 an hour), none over 184 s, 14–25% of the stage inside them. Held below 9: four of the five new panels are read-only meters, the stream halves after 15:00 (reveals per 5 minutes 15–16, 10–11, 6–8, 10–13, **3–6, 4–5**, 7–8, 3–4), and the last six cards cost $20.0M–$114.0M against $1.0M–$29.0M | **5** — 64 reveals in 135:46 (0.47 a minute); three panels (4:22, 6:18, 38:28), each a new mechanic; 28 cards (0.2 a minute; median gap 134 s, longest 3,186 s); 22 of the 28 cards arrive in the first 22 minutes, six in the next 114; 13 reveal gaps over 120 s (5.7 an hour), the longest 2,198 s, **91% of the stage inside them**; no reveal at all in 40:00–75:00 or 90:00–100:00; the stage goal appears at 119:56 |
| **(e) Greyed-out goal always on screen** | **10** — 100% of snapshots in every run. The stage goal is named from 2:08 ("Next: superhuman coder at 4.00×" under a graph that draws progress toward it) and pinned as a card from 18:32. Too much of the rest of the grey is not a goal: Marketing ($819,200 at 3:00, $26.2M at 10:00, $52.4M at the end, against $43,681, $101,405 and $29.0M), lower / raise, the last three cards | **9** — 100%; "Next Upgrade at: 10 Factories" / "500 Drones" name the next project. But the stage's goal is not on screen until 119:56 of 135:46, and "Available Matter: 6.00 octillion g" does not visibly move for about 115 of them |
| **(f) Clarity of the stage transitions** (arrival and exit) | **8** — *arrival*: announced by its card; five lines 2 s apart, held 10 s, each naming one change with its number; revenue $750 → $1,809/s, $928 → $1,972/s, $1,250 → $2,110/s thirty seconds in (three seeds); one affordable button; no wrong line. *Exit*: the pinned card turns dark and the game waits (30 s held, nothing nags); six lines 2 s apart, each naming one change; `Retired: Sage-3 system card, Nimbus G6 pre-order, Counter-offer for the alignment lead.`; 27 controls → 14. Not higher: the click takes government from 96 to 85 with no line; the first Business panel of Stage 3 says "Billing 0.0/s of 0.0/s produced: *idle*" beside $725,449.66 a second; the card's one sentence names none of what is lost (Marketing, hiring, Trust, gas and solar) | **8** — *arrival*: three lines at once (`Releasing the HypnoDrones` / `All of the resources of Earth are now available for clip production` / `Full autonomy attained in …`), Business and Investments deleted, "Clips per Second: 0", nothing to buy, two stale cards left behind, production back only at 7:44–11:00. *Exit*: the card says what it will do ("Dismantle terrestrial facilities, and expand throughout the universe"); `Von Neumann Probes online` / `Terrestrial resources fully utilized in 2 hours 16 minutes 6 seconds`; every Earth control gone, two new panels, a new goal in one number, Launch Probe enabled; then `WARNING: Risk of value drift increased` five times in ten seconds, unexplained |
| **(g) Soft-locks found** (count / severity) | **8** — 0 hard locks in 7 rubric traces, 102 play-style runs and 18 probes; no page error; state byte-identical after a reload in six awkward moments; ten idle minutes are safe. Every self-inflicted stall keeps its reason on the greyed button and its fix enabled on screen (§4). Found: one mislabelled wall ("standing order" where the wall is room or power), walls named once and then silent for 70 minutes, an idle "rescue" of $14,642 for a player holding $715,523, events queued silently behind an unanswered one, the AUTO-off trap (+21:12 to +27:56), two exit defects, three hollow or wrong lines | **7** — 0 hard locks. One silent dead end whose exit is unexplained (every clip into drones before the first factory: "Clips per Second: 0", 21.98 million clips against a 100-million factory, no line; "Disassemble All" refunds in full and nothing says so); power-out silent ("Factory/Drone Performance: 0%", no line); five "Disassemble All" buttons with no confirmation; a reload loses ≤ 25 s; ten idle minutes are safe; the console says nothing in any of them |

Overall (unweighted mean): **Takeoff 7.4 / Paperclips 6.7** (52 and 47 of 70).

---

## 4. Soft-locks, dead ends and play styles

### Takeoff — canned probes (`s2r1-softlock-takeoff-s2.md`, identical to the stored report)

1. **Ignore research for 15 minutes** (never Hire / Expand): Trust 22 unspent; Train first greyed
   by the lab at 2:08 ("lab holds 36,000"), then carried by cards (`Research cluster online. The lab
   holds four times as much.`); four runs by 12:06. Over the whole stage it costs 2:32–8:02 (below).
2. **Release with open issues**: at 6:18 the button reads "Release (3 open)"; the *Release Sage-2*
   event opens (public or internal), not the Stage 1 confirmation — that was seen once in Stage 1
   and never returns. 178 s and 200 s later: `Incident: a court cites a case Sage invented. Demand
   down 30%.` / `Traced to an issue shipped in Sage-2.` **Attributed.**
3. **Reload mid-training**: 25%, 90 s remaining, before and after. **Exact.**

### Takeoff — play styles (`s2x-<name>[-seed2,-seed3].explore.md`, `s2x-table.md`; seeds 1 / 2 / 3)

| play style | Stage 2 ends | in what state, and what the screen says |
|---|---|---|
| first-timer (control); the same at 390 px | 41:26 / 38:30 / 38:38 | Sage-3 at 4.14–4.25×; government 93–96, approval −16 to −22, lead 2.7–2.8 months, alignment 68–71 shown (47–48 true); 0 px overflow |
| **never buys power** | > 90:00 ×3 | 3.54–3.67× after 14–15 runs on 5,000 GPUs ("5,000 of 505,254 GPUs wanted · undertrained (30%)"); still climbing. `No power for more GPUs — 5.0 of 5 MW in use. Gas turbines are fast.` once at 2:28; after the Standing order the lot row reads "standing order" for 4,618 s with "power 5.0 / 5 MW" in the stores; the turbine button is enabled for 83 of the 90 minutes |
| **never builds a second datacenter** | > 90:00 ×3 | 3.78–3.92× on 10,000 GPUs; one or two runs short. `No room for more GPUs — 10,000 slots, all full. Build Datacenter 2.` once; "Build Datacenter 2" is enabled for 76 of the 90 minutes |
| **buys only power** (a plant whenever one is enabled) | > 90:00 ×3 | 3.69–3.73×; one plant bought in 90 minutes — every plant button reads "power to spare" for the rest |
| drags the slider to **5%** and leaves it | 38:38 / 39:58 / 39:56 | mean 39:31 — the same second as the control's mean |
| drags the slider to **50%** and leaves it | 44:40 / 46:18 / 40:12 | +4:12 on the mean |
| **never buys AI research assistants** | > 90:00 ×3 | 2.83–2.96×; releases at 10:48, 31:36, 67:34. `The Research Plateau — at this rate the next run is 6 minutes away. The model could help.` once at 15:00; the card is enabled for 77 of the 90 minutes |
| **runs out of data and ignores it** | > 90:00 ×3 | 3.13–3.49×; Train reads "needs 11.6 T data" from 29:14 to 90:00 beside three enabled data cards. `The Data Wall — …` at 13:38 and 20:02, then never |
| never buys any data source | > 90:00 ×3 | 1.80–1.85×; Train "needs 2.3 T data" for 88 minutes; Web crawl enabled throughout |
| **keeps every model internal** | 61:00 / 67:42 / 64:22 | customers stay on Sage-1.6 at 1.80–1.85× ("Sage-1.6 (internal: Sage-2.6)"); lead 6.5–6.7 months; run-rate $364M a year against $1.1B. The gate ("needs a released 4.00× model") opens on the internal Sage-3; Stage 3 begins `Marketing is closed. Sage-3 sells itself.` |
| **ships every model with open issues**, never red-teams | 39:18 / 40:02 / 41:28 | 6–9 incidents, each `Demand down 30%` and `Traced to …`; government 63–74, alignment 44–53 shown (34–41 true) |
| **never trains** | > 90:00 ×3 | 1.64×; "Train Sage-1.6" enabled for 90 minutes; 1,275,000 GPUs; `Anthrosoft ships Cadence-21. It is level with Sage-1.5.` |
| Focus: **Efficiency** always / **Safety** always | 34:08 / 32:54 / 31:52 · 47:40 / 46:24 / 47:52 | Efficiency: approval −45 to −55, run-rate $10.4B, 1,250,000 GPUs. Safety: alignment 96–100 shown (100 true) |
| **lets every timed event expire** (answers the untimed two) | 41:52 / 39:32 / 40:18 | each closes on its timer and logs its default (`OpenMind declines defense work. The Pentagon calls Anthrosoft.`); government 56–59 |
| **never answers any event** | > 90:00 ×3 | *Release Sage-2* (no timer) stays open from 6:50; the pipeline stays in red-team, 1.80–1.85×; *A Senate Hearing* and *Al-Marsa* wait behind it; no line mentions it |
| events: last option / worst-looking / best-looking | 38:32 / 39:52 / 44:14 · 42:38 / 39:52 / 42:16 · 39:44 / 40:24 / 40:06 | government 66 · 56 · 100; lead 2.8–3.0 · 2.2–2.3 · 3.3 |
| events: chase government / approval / lead | 41:26 / 40:06 / 38:38 · 41:02 / 40:58 / 41:28 · 40:46 / 38:30 / 39:52 | government 100 · 76–79 · 88; approval −16 to −19 · −2 to −7 · −13 to −19; lead 3.2–3.3 · 2.2 · 4.4–4.5 |
| **switches every setting off** (AUTO, Standing order; slider to 5%), then prices by the backlog | 41:22 / 40:30 / 39:16 | as the control |
| AUTO off on arrival, **price never touched** | 62:38 / 62:26 / 66:34 | +21:12 to +27:56 |
| every OFF toggle switched on, alignment compute to its maximum | 42:06 / 39:10 / 39:04 | approval −6 to −11 (Job-transition fund), alignment 71–73 shown (49–52 true) |
| never spends Trust · every Trust on Hire · every Trust on Expand | 43:58 / 44:38 / 46:40 · 44:36 / 37:56 / 41:08 · 40:58 / 41:56 / 39:46 | +2:32 to +8:02 · −0:34 to +3:10 · −0:28 to +3:26 |
| never buys the Standing order · never buys a security level | 41:50 / 37:42 / 37:38 · 39:00 / 37:44 / 38:52 | 48–49 lot presses instead of 24 · lead 2.3 instead of 2.7–2.8, SL1 |

Nothing above is a hard lock. Every stall is self-inflicted and has its reason on screen. What
reads as a trap, a contradiction or a bug:

1. **The lot row hides the wall once the Standing order is on.** In the control the row reads
   "*standing order*" for 1,834 s (74% of the stage), including 20:00–25:36, when the stores read
   "GPUs 50,000 / 50,000" and the only thing that can restart growth is "Build Datacenter 4
   (+50,000 slots) $3.8M" — greyed, with no reason beside it. `No room for more GPUs — …` printed
   at 4:26 and 10:14 and never again after the order was placed at 10:52. The truth is one hover
   away ("room for 0 / power for 15,000").
2. **Walls are named once, then the console goes quiet.** Data: two lines in 90 minutes while the
   button says "needs … T data" for 72 of them (the last 61 without a break). Research: one line that does not name the card
   ("The model could help."). Power: one line.
3. **The idle guard still thinks it is Stage 1** (`s2x-idle-rescue.md`). Nothing clicked from the
   first second: at 6:32 *A Customer Writes* — "Your model saved our quarter." "We would like to pay
   for a year up front. $ 14,642.00, if that works." — to a player holding $715,523 with 11
   purchases enabled behind it; no timer; again at 9:02 and 11:32. A player who walks away at 12:00
   returns at 22:00 to the same event with $11.5M in the stores.
4. **An unanswered untimed event freezes the calendar.** With *Release Sage-2* open for 20 minutes
   (`s2x-untimed-open.md`) two timed events wait behind it, the Red-team and Release buttons stay
   grey, and no line says why nothing is happening. The event has no "not yet" and Escape does
   nothing.
5. **The gate click costs 11 points of government and says nothing** (`s2x-exit.md`): "Relations: 96
   (close)" → "Relations: 85 (close)". The cause is a clamp on entering Stage 3
   (`engine/stages.ts:135`: 25–85, plus 2 per unspent Trust). The meter is above 85 at the gate (or
   at 90:00) in 27 of the 34 play styles.
6. **Stage 3 opens on a dead readout.** After the click the Business panel reads "Price per Task:
   $ 0.03 / Billing 0.0/s of 0.0/s produced: *idle*" while "Avg. Rev. per sec: $ 725,449.66" and
   Tasks Completed climbs by 23 million a second (`s2x-exit-exit-plus30s.png`).
7. **A hollow option.** *4 a.m.*'s first option reads "lock it down / research stops 1:00 · security
   level 3 25% off for 5:00". For those five minutes Security level 3 costs "$28.5M, 3 Trust" (from
   $38.0M) against $529,521, Trust 0 and $74,608 a second — five minutes of the whole income is $22.4M. It
   was bought in none of the 102 runs.
8. **Wrong line when AUTO is switched back on** (`s2x-auto-off-raise.md`): after 200 raises
   ("Billing 0 tasks/s at $ 2,235.21 AUTO: off") the diagnosis is right (`Billing 0% of output at
   $2,235.21. AUTO would clear it at $0.062.`), and on re-enabling the console prints `Market
   flooded — price per task down to $1,338.32. A better model or a wider market lifts it.`
9. **Reloads** at 12:00, mid-training, mid-evaluation, in the interconnect queue ("Solar farm 1 —
   2:59" → "2:59"), with an untimed event open and with a timed one ("59 s" → "59 s"): the
   serialized state is identical before and after in all six. **Exact.**
10. **Idle ten minutes** from the first second: the arrival lines print, funds reach $1.0M, nothing
    breaks; five minutes after returning the model is at 2.00×. From 12:00: the Standing order
    stalls on room, revenue slips from $21,897 to $16,810 a second under two rival releases, funds
    reach $11.5M; five minutes later 2.87×. **Safe.**

### Paperclips (`s2x-pc-*.md`)

1. **Every clip into drones before the first factory — a silent dead end.** At 9:04, six purchases
   leave 21.98 million clips against a 100-million factory; "Clips per Second: 0"; no line in 300 s.
   The way out is "Disassemble All" (no confirmation), which refunds every clip — and nothing on
   screen says so.
2. **No power**: farms disassembled at 20:00 → "Factory/Drone Performance: 0%", "Clips per Second:
   0", no line; the fix is readable in the Power box.
3. **Five "Disassemble All" presses** at 20:00: everything gone, no confirmation; full refund
   (29.5 → 316.2 trillion unused clips) and base prices again, so it costs only the rebuild.
4. **The slider at each end**: all Work, 0 gifts in 300 s; all Think, 18 gifts and harvest and wire
   at 0 per second, each gift announced (`The swarm has generated a gift of 6 additional
   computational capacity`). Legible, and it matters.
5. Reload at 20:00 loses ≤ 25 s; ten idle minutes are safe (316 → 841 trillion clips) and the
   console prints nothing.

---

## 5. Decisions

The Stage 1 round-2 finding was that nothing the stage framed as a choice changed the stage. Stage 2
is better: several choices move the stage end by minutes and the meters by tens of points, and the
events print their stakes. The play-style table above, read as a sensitivity analysis (control:
41:26 / 38:30 / 38:38, mean 39:31, a 2:56 spread between seeds):

| what the stage frames as a choice | stage end (mean, Δ) | meters at the gate | are the stakes on screen when choosing? |
|---|---|---|---|
| **Focus** (three buttons, default Capability) | Efficiency 32:58 (**−6:33**) · Safety 47:19 (**+7:48**) | Efficiency: approval −45 to −55 (control −16 to −22). Safety: alignment 96–100 shown (68–71) | **No** — three bare buttons; tooltips only, and the tooltips point the wrong way for a player chasing 4.00× (below) |
| **Release publicly or keep internal** (event, then a button) | internal always 64:21 (**+24:50**) | lead 6.5–6.7 months (2.7–2.8); customers on 1.80–1.85× | **Yes** on the event ("research ×1.25 · lead +0.5 months · customers keep the old model"); the later button has a tooltip only |
| **Red-team or ship** | ship always 40:16 (+0:45) | government 63–74 (93–96); alignment 44–53 shown (68–71); 6–9 incidents | **Partly** — "Release (1 open)"; each incident is traced to its release; that government and alignment fall is not said anywhere |
| **Events** (nine or ten, seven of them timed) | the eight strategies that finish span 39:31–41:35 (2:04, less than the 2:56 between seeds) | government 56–100; approval −2 to −22; lead 2.2–4.5 | **Yes** — effect line under every option, timer and default in words, a greyed option says what it needs |
| **Allocation slider** (5–50%) | 5%: 39:31 (0:00) · 50%: 43:43 (+4:12) | none | **No** — research 977 / 1,437 / 2,334 a second and revenue $5,393 / $5,223 / $3,997 at 5 / 15 / 50% (`s2x-slider-ends.md`); the screen shows only "Human share of research: 35% / 24% / 14%"; the rates are in the Stores hover |
| **Trust**: Hire, Expand, or keep | never spent 45:05 (+5:34) · Hire only 41:13 · Expand only 40:53 | none | **No** — tooltips; `Trust +1. Expand the lab, or save it.` |
| **Standing order** (card, then toggle) | never bought 39:03 (−0:28) | none | Yes ("Lots arrive by themselves …") — and it changes nothing but the number of clicks |
| **Security level 2** | never bought 38:32 (−0:59) | lead 2.3 (2.7–2.8) | Partly ("holds against opportunists") |
| **Share evals** · **Job-transition fund** · **Alignment compute** | +0:00 · +0:35 · +0:21 | government +1 and alignment +1 · approval +10 to +12 · alignment +2 shown, +2 to +4 true | Tooltips only ("Each release: relations +1, measured alignment +1, lead −0.1 months." / "2% of revenue while it is on. Approval +10.") |
| **AUTO pricing** | off and untouched 63:53 (**+24:22**) | none | One line, once the damage is done (being removed) |
| **Infrastructure**: which plant, when to build | — | — | There is no choice to measure: a plant is greyed "power to spare" in 87–91% of checks and a lot is bought by the order; the first-timer builds what the game un-greys |

What this says.

* **Three choices matter and one of them is invisible.** Release policy (+25 minutes, lead ×2.4) and
  red-teaming (government −25, alignment −20) are legible trades. Focus is the largest lever on the
  ordinary path — a 14-minute spread and the only thing that moves approval by 30 points or
  alignment to 100 — and it is three unlabelled buttons. Worse, its tooltips mislead a player whose
  goal on screen is "superhuman coder at 4.00×": "Capability: the next model is 10–14% more capable"
  is the default and the slow road; "Efficiency: +7% capability, and 25% more copies on every GPU"
  reaches 4× 6:33 sooner, because copies compound into money (run-rate $10.4B a year against $1.1B)
  and money, not capability per run, is what the next run waits for (§6). Nothing on screen connects
  the two.
* **Events are well made and weigh little in this stage.** They move three meters by 20–45 points
  and the stage end by less than the seed does. One of them has a consequence the player meets
  later and can trace: in seed 2 the first-timer cannot afford "license the archives … $475,000",
  takes "fight it / +5 T data now · government −3 · approval −4 · a lawsuit", and 4:48 later reads
  `A court orders 5 T of training data deleted.` with Train greyed "needs 8.1 T data". The rest act
  on meters, and what the meters buy inside Stage 2 is thin:
  relations ≥ 60 takes 25% off the Nuclear PPA ("*25% off: relations*"); low approval brings one
  line, once (`Protesters cut a fence at Abilene. A tenth of the site is dark for a minute.`);
  lead and alignment change nothing a player can see before the gate. The player is choosing
  between numbers whose use is promised, not shown.
* **The race cannot be lost here.** Anthrosoft tracks the player: 4.21× when the first-timer is at
  3.90×, 1.77× when the player who never trains is at 1.64× (`Anthrosoft ships Cadence-21. It is
  level with Sage-1.5.`).
* **Four framed choices change nothing a player can see**: Hire or Expand, the Standing order, Share
  evals, and the slider anywhere between 5% and 15%. The stage's most repeated line, `Trust +1.
  Expand the lab, or save it.` (21 times in 41 minutes, one console line in nine), asks for 37–38
  presses that together are worth 2:32–8:02; "Human share of research" reads 31% at 5:52, 6.7% at
  20:00 and 0.66% at the gate; the designers' bot ends the stage with the 20 researchers it began
  with.

---

## 6. THE SINGLE BIGGEST GAP

**From the Standing order to the gate, Stage 2 gives the player nothing to press and no way to
spend toward the thing they are waiting for.** This is not the minute-15-to-22 lull; it is the
27.6–30.6 minutes (72–74% of the stage) between 10:16–10:56 and 38:30–41:26.

In that span, in the three first-timer traces:

| | before the Standing order (0:00 → 10:16–10:56) | after it (→ 38:30–41:26) | Paperclips Stage 2 (whole stage) |
|---|---|---|---|
| clicks per minute | 6.3–6.5 | **2.7–3.3** | 19.5 |
| 2-s checks with no enabled purchase | 77–79% | **88–90%** | 1% |
| checks with two or more distinct things affordable | 8–10% | **4–5%** | 97% (median five) |
| time inside stretches of ≥ 30 s without a click | 15–16% | **63–69%** (21–26 stretches, longest 86–104 s) | 28% |

What the player is waiting for is money for the next training run: over the whole stage a run is
in the pipeline for 45–50% of the time and Train is greyed because the stores cannot cover its
dollar price for another 49–54% (1,142–1,348 s; data is short for 42–274 s, research for 48–332 s).
The goal number on the graph moves nine times in 39–41 minutes and stands still for 7:02–7:50
between about 18:30 and 26:20. And nothing on the screen lets the player push on that wait:

* the growth verb of the first ten minutes is gone — the lot row reads "Buy GPUs (5,000) $1.0M
  *standing order*" (greyed in 98% of checks, 74% of them with that reason);
* the price is on AUTO and lower / raise are greyed in 100% of checks;
* a plant is locked "*power to spare*" in 87–91% of checks and a datacenter is greyed until the room
  is full, so the whole build after the order is **16 forced clicks in half an hour** — 4
  datacenters, 7 gas turbines, 5 solar farms, one every 1:43–1:55, each pressed because exactly one
  row turned black;
* Marketing, the Stage 1 money verb, is enabled in 0% of checks ("Cost: $ 26.2M" at 10:00 against
  $101,405 and $13,792 a second: 31 minutes of revenue);
* the remaining clicks are 22–26 one-shot cards bought the moment they turn black, 17–18 Hire /
  Expand presses that §5 shows do not matter, and the Train → Red-team → Release sequence.

The screen at 25:00 (`s2x-baseline.view1500.png`) is the stage in one picture: "GPUs 50,000 /
50,000", five greyed Infrastructure rows, "Marketing Cost: $ 26.2M", four greyed cards, "Training
Sage-2.4 (capability): 41% / 70 s remaining" — and nothing live but Complete Task, AUTO, the slider,
Focus and the Standing order toggle.

Paperclips' Stage 2 is slower, sparser and explains nothing, but it never does this. Its one
currency has five repeatable sinks whose rates are printed beside their buttons ("Acquired Matter …
(1.02 trillion g per sec)", "Wire … (873.74 billion inches per sec)", "Consumption: 2,265 MWs /
Production: 2,300 MWs"), so at 99% of checks the player can buy something, at 97% they must choose
between at least two things, and the choice is the game: which link of the chain is short. Takeoff
has the same chain — room, power, GPUs, data, research, money — and has automated or locked every
link of it; the one test of that in the data is the player who never buys the Standing order, who
has something enabled in 69% of checks instead of 13%, presses Buy GPUs 48–49 times instead of 24,
and finishes at the same minute (37:38–41:50).

The one lever that does act on the wait — Focus: Efficiency, which turns the money wall into
back-to-back runs and ends the stage 6:33 sooner — is the one whose stakes are not on the screen
(§5).

Fix, in order of leverage:

1. **Give Stage 2's money a sink the player steers, with its return printed, from 0:00 to the
   gate.** The GPU lot is the natural one. Keep it in the player's hands: offer three lot sizes side
   by side (the stage already scales the lot 1,000 → 5,000 → 25,000) and print what a lot adds at
   today's price ("Buy GPUs (5,000) $1.0M · +$4,100/s"). Sell the Standing order after Datacenter 4
   (about 20:00), not at 3:14, or make it a budget ("spend up to 50% of income on lots") rather than
   a switch.
2. **Unlock the build so that it is a decision.** Drop "power to spare" and "room to spare": let a
   plant or a datacenter be bought ahead of the wall. Plants already take time (solar 3:00 in the
   queue, 0:30 after Behind-the-meter; nuclear 2:00); give the datacenter a build time too (today
   its tooltip says "Room for 50,000 more GPUs, at once." and it completes 2 s after the click), so
   that building ahead is the skill and over-building is paid for out of the next run's money. Print
   the binding wall where the order's reason is now: "standing order — waiting for room (50,000 / 50,000)".
3. **Put the wait on the Train row and let the player cut it.** "Train Sage-2.4 — short $1.9M ·
   0:42 at +$45,052/s" (the rate is already in the funds hover). Then give the run a size: train now
   on what the money buys (the stage already models an undertrained run: "trains to 81%") or wait
   for the full one. That turns the wait that fills half the stage into one decision per run.
4. **Re-price or remove Marketing.** At 90 s of revenue a level it is a second sink; at 31 minutes
   it is a grey box.
5. **Print the Focus trade under the buttons** as the events do ("Efficiency / +7% capability ·
   copies per GPU ×1.25 · more jobs displaced"), since it is the lever on the wait.

Targets for the next build, measured with `explore-s2.mjs baseline` on seeds 1–3: checks with no
enabled purchase ≤ 50% (85–88% now); two or more distinct things affordable in ≥ 25% of checks
(5–6%); time inside ≥ 30-s click gaps after minute 10 ≤ 35% (63–69%); no model release interval
over 5:30 (7:02–7:50); and the stage still inside 36–44 minutes for the first-timer and the bot.

---

## 7. Secondary gaps (priority order)

1. **Focus is the stage's biggest lever and it is unlabelled** — a 14-minute spread, approval −45
   to −55 or alignment 96–100, behind three buttons whose tooltips recommend the slow road to a
   player chasing 4.00× (§5). Fix: effect lines under the buttons; show "copies per GPU 1.88 →
   2.35" in the evaluation result; say in the Public panel what displaces jobs.
2. **A dead verb with the loudest voice.** `Trust +1. Expand the lab, or save it.` is 21 of 191
   console lines; 37–38 Hire / Expand presses are worth 2:32–8:02 in total; the two things Trust
   could buy that matter (Policy team, 2 Trust; Security level 3, 3 Trust) are out of reach for a
   player who follows the line — Policy team waited 1,414 s for Series C's three seats and SL3 was
   never bought. Fix: stop the per-milestone Trust in Stage 2 or price things in it that the player
   wants; print the line only when Trust can buy something new.
3. **The Standing order's reason hides the wall** (§4.1) and the wall lines stop when it is bought.
   Fix: the reason names the wall; re-print `No room for more GPUs — …` when the order has stalled
   for 20 s; tint the full row in the stores.
4. **Meters with nothing behind them, and a silent clamp.** Government is above 85 at the end in 27
   of the 34 play styles, everything above 85 is thrown away at the gate without a line, and nothing
   above 60 buys anything a player can see in Stage 2; approval's whole consequence is one line; lead and
   alignment have none before the gate; the rival is tied to the player. Fix: one visible
   consequence per band inside the stage (relations ≥ 80: the interconnect queue halves; approval
   < −30: a datacenter permit takes a minute longer), the thresholds printed in the panel, and a
   narrated clamp.
5. **The slow middle is longer than minutes 15–22, and it has a cause.** Decisions per five minutes
   fall from 14–25 (0:00–15:00) to 8–10 (15–20), 7–11 (20–25) and 9–13 (25–30); reveals to 3–6 per
   five minutes in 20:00–30:00; the longest release interval of the stage is the sixth, 18:22–19:26
   → 26:04–26:28 (7:02–7:50). In all three seeds the first-timer spends that interval buying a queue
   of five to seven cards priced just under the next run — Dashboard $0.9M–$2.1M, Nimbus G5 order
   $1.5M, Free tier $1.7M, Long-horizon memory $1.8M, License the code hosts $1.9M, International
   launch $1.8M–$1.9M, Parallel pipelines $1.3M–$2.6M — and reaches the Sage-2.4 run ("Cost: $2.7M" in
   seed 1, "$2.4M" in seed 2) last, at 23:48–24:16. *A Month of Evals* ("next run waits 1:00") lands
   in the same stretch at 17:38, and in seed 2 so does the lawsuit that "fight it" bought (`A court
   orders 5 T of training data deleted.`, Train "needs 8.1 T data").
   Fix: price the Sage-2.4 run under the cards that arrive between 17:32 and 20:34, or spread those
   cards from $1M to $6M so the run is reached after two of them; move one mechanic reveal (the
   nuclear row or alignment compute, 27:36) to about 24:00.
6. **Mandatory cards look like every other card.** Without AI research assistants the stage is past
   90 minutes at 2.83–2.96×; without a data source after the crawl, 3.13–3.49×. Each gets one or two
   lines. Fix: draw the card that answers a standing wall in the `urgent` style, name it in the
   Train reason ("needs 11.6 T data — Synthetic data, License the code hosts"), repeat the wall line
   every three minutes while it holds.
7. **A screen that is mostly grey and says some things three times.** Median 15 greyed controls;
   lower, raise and Marketing never enabled; the rival and the lead printed in three places and
   "Alignment (as measured)" in two after the gate; 265–404 words; the event panel over the funds
   row; the "4× superhuman coder" label overdrawn as the player reaches it; at 390 px the two
   controls of the stage 1.5–2 screens down. Fix: hide what cannot be pressed this stage; one home
   for each fact; open the event panel beside the stores, not over them.
8. **Stage 1's rescue in Stage 2** (§4.3) and **the calendar frozen behind an untimed event**
   (§4.4). Fix: gate the idle guard on "nothing affordable" and give it a timer; give *Release
   Sage-2* a "not yet" that returns the model to the Release button.
9. **Exit loose ends** (§4.5–4.6): the dead billing line, the silent −11, and a gate card that
   undersells the change. Also the internal path: the gate asks for "a released 4.00× model" and
   accepts one nobody outside has seen, then announces that it "sells itself".

---

## 8. Verdict

| Rubric item | Winner | Margin |
|---|---|---|
| (a) Time to first meaningful choice | **Takeoff** (8–6) | a priced, worded trade at second 0 and a heavy, legible event by 4:54–6:50, against five unexplained ops cards and no production for 7:44–11:00 |
| (b) Nothing to do | Paperclips (6–5) | Takeoff: no enabled purchase in 85–88% of checks, hands idle ≥ 30 s for 50–55% of the stage; Paperclips: 1% and 28%. Takeoff is far ahead on the stricter measures (reveal gap 184 s against 2,198 s; decision gap 126 s against 934 s) and still loses the row: its waits are short, constant and cannot be acted on |
| (c) Cognitive load / disclosure | Paperclips (6–5) | equal numbers on screen from minute 15 (61–89 against 66–83); Takeoff has 11 panels to 8, 369–404 words to 251 at 20:00, six lines a minute to 1.6, and 15 greyed controls. Takeoff's staging and self-explanation are the better of the two |
| (d) Cadence of reveals | **Takeoff** (8–5) | 2.0–2.2 reveals a minute against 0.47; a card a minute against one per five; 14–25% of the stage inside reveal gaps over 120 s against 91%; no gap over 184 s against one of 2,198 s |
| (e) Greyed-out goal on screen | **Takeoff** (10–9) | 100% both; Takeoff names the stage goal from 2:08 and pins it from 18:32, Paperclips shows its goal at 119:56 |
| (f) Clarity of transitions | Tie (8–8) | Takeoff explains more at both ends and contradicts itself at the exit; Paperclips explains less and is unmistakable |
| (g) Soft-locks | **Takeoff** (8–7) | both 0 hard locks; Takeoff's stalls carry their reason and their fix on screen, Paperclips has one silent dead end with an unexplained exit |
| **Overall** | **Takeoff: 7.4 vs 6.7** | earned on appearance, explanation and safety; lost where the rubric asks what the player's hands and eyes are doing |

What is measurably good in Takeoff's Stage 2, so that the next fix does not break it:

* **The arrival pays off**: five lines, one affordable button, revenue ×1.7–2.4 within 30 seconds on
  three seeds, no wrong advice.
* **Stage length is stable**: 38:30–41:26 for the first-timer, 40:32–40:54 for the bot, 31:52–47:52
  across Focus; nothing on the ordinary path runs past 48 minutes.
* **Decisions have weight and events have printed stakes**: release policy (+25 minutes, lead
  ×2.4), red-teaming (government −25, alignment −20), Focus (14 minutes); every event option carries
  its effect line, its timer and its default; a greyed option says what it needs; an expired event
  logs what happened.
* **No dead air by novelty**: no reveal gap over 184 s, no novelty gap over 78 s, no decision gap
  over 126 s in three seeds; 2.0–2.2 reveals a minute; an event every 2:30–4:52 until 26:28.
* **The goal is always named**: a graph and "Next: superhuman coder at 4.00×" from 2:08, a pinned
  card from 18:32, and a gate that waits for the click.
* **Cards are goals, not a conveyor belt**: reveal → purchase median 216–342 s (Paperclips 226 s);
  2 of 33–34 bought within 10 s of appearing (11–13 of 34 in Stage 1 round 2); one sentence each;
  none clipped.
* **Greyed buttons say why** ("no room", "no power", "queue full", "needs 6.4 T data", "evaluation
  month — 6 s", "25% off: relations") and the Stores rows have a real breakdown on hover.
* **Wall lines name the fix** when they print (`No room for more GPUs — 10,000 slots, all full.
  Build Datacenter 2.`), and incidents name their cause.
* **The event panel does not block**: the page behind is live, focus lands in the panel, Tab walks
  the options, Escape takes a timed default.
* **Persistence**: byte-identical state after a reload in six situations; ten idle minutes are safe
  at the start and in the middle.
* **Exit narration**: six lines, each naming a change, and a line for the three cards retired.
* No page error and no horizontal overflow at 390 px in any run; same seed, same run; 300 seconds of
  real time reproduce the stepped trace exactly; no click chore anywhere (43 infrastructure presses
  in a stage).

---

## 9. The five known issues, confirmed or contradicted

| the developers' statement | this round |
|---|---|
| The manual price buttons and the AUTO toggle are being removed | **Confirmed.** lower / raise are greyed in 100% of checks and the first-timer makes 0 price moves; AUTO off and untouched costs +21:12 to +27:56 with one line; AUTO off with the backlog rule changes nothing (39:16–41:22). One more reason: re-enabling AUTO prints a wrong line (§4.8) |
| A model that lands just under 4× forces one extra run | **Confirmed**, and it is the usual case: the model before Sage-3 sat at 3.74–3.99× in all nine Capability, Efficiency and Safety traces (3.90 / 3.74 / 3.77; 3.91 / 3.83 / 3.90; 3.89 / 3.96 / 3.99); the last run cost 3:56–6:22 on Capability and 4:48 at 3.99× |
| The government meter saturates near 100 | **Confirmed, and worse than stated**: 93–96 for the first-option player, 100 for two strategies, and the gate click clamps it to 85 with no line (§4.5) |
| The number count runs 68–79 at the five-minute marks | **Confirmed in substance**: 55–60 at 5:00, then 61–89 (peak 93–100 during *4 a.m.*). The reference is no lighter: Paperclips shows 54–83 at the same marks from 10:00. The heavier difference is words (369–404 against 251 at 20:00) and grey controls |
| Minutes 15–22 are the slowest stretch | **Confirmed, and longer than stated**: the trough runs 15:00–30:00 and the model stands still for 7:02–7:50 from 18:22–19:26, because five to seven cards priced $0.9M–$2.6M queue ahead of a $2.4M–$2.7M run (§7.5); the wider cause runs from the Standing order to the gate (§6) |

---

## 10. Re-running

All commands from the repo root; outputs in `agent-tools/critic-out/`.

```sh
G="--game-dir agent-tools/snapshots/s2-r1"
# rubric runs (one real-time run at a time)
node tools/critic/run.mjs takeoff s2r1-tk-rt $G --stage 2 --realtime 300 --accel-minutes 90 --seed 1
for s in 1 2 3; do node tools/critic/run.mjs takeoff s2r1-tk-seed$s $G --stage 2 --realtime 0 --accel-minutes 90 --seed $s; done
node tools/critic/run.mjs takeoff s2r1-tk-auto $G --stage 2 --realtime 0 --accel-minutes 90 --autoplay     # also --seed 2, 3 → -auto-seed2, -auto-seed3
node tools/critic/run.mjs paperclips s2r1-pc --stage 2 --realtime 0 --accel-minutes 180                    # ≡ pc-s2
node tools/critic/analyze.mjs s2r1-tk-rt --stage 2            # → .analysis.md; same for every label
node tools/critic/compare.mjs s2r1-tk-rt s2r1-tk-seed2 s2r1-tk-seed3 s2r1-tk-auto s2r1-pc pc-s2-rt
node tools/critic/decisions.mjs s2r1-tk-rt s2r1-tk-seed2 s2r1-tk-seed3 s2r1-pc --stage 2
# Paperclips fairness variants
PC_FACTORY_HORIZON=Infinity node tools/critic/run.mjs paperclips s2r1-pc-save --stage 2 --accel-minutes 180
PC_FACTORY_HORIZON=Infinity PC_TRIVIAL_SHARE=0.5 node tools/critic/run.mjs paperclips s2r1-pc-save-bulk --stage 2 --accel-minutes 180
PC_THINK_VALUE=200 PC_FACTORY_HORIZON=Infinity PC_TRIVIAL_SHARE=0.5 node tools/critic/run.mjs paperclips s2r1-pc-brisk --stage 2 --accel-minutes 180
node tools/critic/explore-s2.mjs pc-stage --yomi 15000                                                     # → s2x-pc-stage-yomi
# transitions and canned probes
node tools/critic/transition.mjs takeoff $G --out s2r1-transition-takeoff-s1                               # arrival, played from a new game (also --seed 2, 3)
node tools/critic/transition.mjs takeoff $G --stage 2 --out s2r1-transition-takeoff-s2                     # exit
node tools/critic/transition.mjs paperclips --out s2r1-transition-pc-s1                                    # Paperclips 1 → 2 (2 → 3 is s2r1-pc.transition.txt)
node tools/critic/softlock.mjs takeoff $G --stage 2 --out s2r1-softlock-takeoff-s2
node tools/critic/explore.mjs toggles,reload-mid-modal,modal-click-through $G --stage 2 --tag s2r1x --minutes 90
# this round's play styles and probes
node tools/critic/explore-s2.mjs list
node tools/critic/explore-s2.mjs all-runs $G --seeds 1,2,3      # 34 play styles × 3 seeds → s2x-<name>[-seedN].explore.md / .end.json
node tools/critic/explore-s2.mjs table                          # → s2x-table.md (the §4 / §5 table)
node tools/critic/explore-s2.mjs all-probes $G                  # 13 probes → s2x-<name>.md + screenshots
node tools/critic/explore-s2.mjs all-paperclips                 # 8 Paperclips Stage 2 probes → s2x-pc-<name>.md
```

In zsh, write `${=G}` for `$G`.

### Harness changes made this round (the game and its snapshot were not touched)

1. **New** `tools/critic/explore-s2.mjs` — Stage 2 play styles (the first-timer's Stage 2 rules
   with one thing changed: infrastructure switches, slider, Focus, release and red-team policy,
   event strategies by title, by printed effect and by meter, settings, vetoed cards), each writing
   a normal run plus a per-minute table of the meters, model releases, how long each greyed-button
   reason stood, what the training pipeline waited for at each check, every event with its effect
   lines, every card's text, and the last Stage 2 screen as `.end.json`; `table`; 13 Takeoff probes
   (idle ×3, reloads with a whole-state diff ×3, slider, 390 px, event keys, an untimed event left
   open, the held exit, hovers, AUTO off); 8 Paperclips Stage 2 probes and a reference run
   (`pc-stage [--yomi N]`). Its `baseline` reproduces the harness's own first-timer exactly (157
   actions, same times and keys). `explore.mjs` is unchanged.
2. `tools/critic/games/paperclips-late.mjs` — three optional environment variables for the
   fairness check (`PC_TRIVIAL_SHARE`, `PC_FACTORY_HORIZON`, `PC_THINK_VALUE`). Unset, the rules are
   as before: the default Stage 2 run is still identical to `pc-s2`, action for action.
3. `tools/critic/README.md` — a "Stage 2 round-1 additions" section describing 1 and 2, and one
   line in the layout.

Notes for whoever runs the next round. `softlock.mjs paperclips --stage 2` does not load the
Stage 2 fixture (it opens a new game); the Paperclips Stage 2 probes are in `explore-s2.mjs`.
`transition.mjs takeoff --stage 2` takes no `.tpre.png` because the gate card is not in the
adapter's goal list; `explore-s2.mjs exit` takes the before and after screenshots. `explore.mjs`'s
`reload-mid-redteam`, `tour` and `modal-hover` find nothing at Stage 2 (they were written against
Stage 1's screen).
