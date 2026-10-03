# Takeoff — Stage 1 ("The Startup") vs Universal Paperclips — Stage 1 · critic round 2

Reviewer brief: fresh context, no design docs read, live source tree not read. The build under
review is the frozen copy `agent-tools/snapshots/s1-r2/`; its source was opened only to learn the
`window.__game` API and to chase three causes (`tick.ts` `researchWall`, `economy.ts`
`priceAbsurd` and `bill`). Everything below was measured by driving both games in headless Chrome
with the same scripted "curious first-time player" (frozen harness `tools/critic-r2/`), then by 22
play-style variants (one of them the unmodified control) and 15 scripted probes on Takeoff ("a
player who does the unexpected"). A Dark Room was measured for its first 5 minutes only, as a
third reference for early cadence.

Scope: Takeoff from a new game to the console line `Ground broken outside Abilene. 2026 begins.`
(Stage 1→2, 30:42–32:06 for the first-timer). Paperclips from a new game toward
`Release the HypnoDrones` (not reached in 120 stepped minutes by this policy — Trust 26 of 100 —
so its transition is played from the harness's cheated fixture, as in round 1).

**Result: Takeoff 8.1, Paperclips 7.7 (round 1: 5.6 and 7.9). Takeoff wins the fixed rubric,
narrowly, on pacing; it does not win on what the rubric does not score — whether the player's
decisions matter (§5).**

All raw data is in `agent-tools/critic-out/` (`r2-*` = rubric runs, `r2x-*` = exploratory runs and
probes); §9 says how to re-run each.

---

## 1. Method and definitions

### Harness

* `tools/critic-r2/run.mjs <game> <label>`: **phase 1** = 300 s of real wall-clock play, **phase 2**
  = deterministic 2-s game-time steps to the stage end or the cap (Takeoff `__game.tick(ms)`;
  Paperclips and A Dark Room through a virtual clock). A snapshot every 2 s records every visible
  button / project / slider / panel, the console and Developments lines, any modal, the count of
  numeric tokens on screen, and the game's metrics. Seeded: two stepped Takeoff runs of the same
  seed are identical (424 events, 352 actions, 979 snapshots; `determinism.mjs`).
* **Policy** (identical shape for every game, unchanged from round 1): mash the main button at
  4/s until automation makes ≥ 8/s; first automation the moment it is affordable; anything
  affordable is bought, one consumable purchase kept in reserve; price lowered when the backlog
  exceeds 30 s of production and grows, raised after four near-zero checks, 8 s cool-down; a modal
  is answered with its first enabled option; red-team to 0 open issues, then release; once a
  big-ticket goal is visible (any project priced ≥ $10,000 and ≥ 60 s of revenue) the GPU and
  marketing drip stops. Paperclips: Memory while the cheapest project costs more ops than the cap.
* A second Takeoff trace uses the game's own **Autoplay** bot (the designers' "reasonable player").

### Definitions

Applied identically to both games and unchanged from round 1 §1 (`lib/analysis.mjs` header):
reveal, enabled transition, nothing-to-do (loose), novelty gap, reveal gap, greyed-out goal on
screen, cognitive load (numeric tokens + buttons/sliders + panels at minutes 0/1/3/5/10/20/end),
first meaningful choice. Two measures were added this round because the loose nothing-to-do is
structurally near zero in both games (a drip purchase or the consumable is almost always
affordable):

* **Decision gap** — time between consecutive policy actions that are not the main button, a drip
  purchase (GPU, AutoClipper, MegaClipper), the consumable (power, wire) or a price move
  (`decisions.mjs`).
* **Reveal → purchase latency** — for every project the policy bought, seconds between its first
  appearance and its purchase: how long it stood on screen as a goal.

### Where a number is the policy, not the game

* Paperclips is played badly by this policy: its price rule drives the price to $0.03–$0.10 for
  the first half hour (Marketing level 1 until 19:54) and it never deposits in Investments,
  never clicks Quantum Compute and runs tournaments only with spare ops. Paperclips' late reveal
  gaps (35:38 → 50:14, 70:12 → 112:08) are therefore longer than a human's, and during the first
  of them a human has two new panels to play with. Its first 35 minutes are not affected.
* Takeoff's first-timer stops renting at 79–80 GPUs when the first ladder rung appears
  (12:40–13:00), so it never meets the rental quota a human meets at 12:48 (measured with the
  `greedy` variant).
* The policy spends research the moment anything is affordable, so Takeoff's Insight (accrues only
  while research is at capacity) stays at 0.0 in all six first-timer traces. A slower human would
  see some.
* Stepped screenshots catch Takeoff's 0.8-s fade-in half-way; the faded Infrastructure panel in
  `r2-tk-s1.transition.png` is that, not the game.
* Loose nothing-to-do for the Autoplay bot (130 s in the first 5 minutes) is an artifact: the bot
  buys inside the tick, so a snapshot never sees an enabled button.

### Runs used

| label | what |
|---|---|
| `r2-tk-s1` | Takeoff, 300 s real time + stepped to the stage end (31:40), seed 1 — primary |
| `r2-tk-s1-seed1` … `-seed5` | Takeoff, stepped, seeds 1–5 (32:06, 30:42, 31:24, 31:28, 31:58) |
| `r2-tk-s1-auto`, `-auto-seed2`, `-auto-seed3` | Takeoff, the game's Autoplay bot, stepped (28:54, 29:50, 29:40) |
| `r2-pc-s1` | Paperclips, 300 s real time + stepped to 60:00 — re-run this round; **identical to the baseline `pc-s1` on every headline number**, so the baselines below are reused |
| `pc-s1-accel` | Paperclips, stepped 120 min (baseline) |
| `adr-5min` | A Dark Room, 300 s real time (baseline) |
| `r2-transition-*`, `r2-softlock-*` | canned transition and dead-end probes, both games |
| `r2x-<name>[-seedN]` | 22 Takeoff play-style variants (ten of them on seeds 1–3), 15 Takeoff probes, 3 Paperclips reference runs (§4, §5) |

---

## 2. Reveal timelines

### 2a. Takeoff — first 5 minutes (real time, `r2-tk-s1`)

| t | event |
|---|---|
| 0:00 | `Welcome to OpenMind.` · "Tasks Completed: 0", Complete Task, "Power: 1,000 kWh", Buy Power $20 (grey), "Jul 2025" |
| 0:02 | Business panel after the first click: Funds, Unbilled Tasks, lower/raise, "Price per Task: $ 0.25", **"Billing 2.0/s of 4.0/s produced: *backlog growing*"**, Marketing $100 (grey) |
| 0:06 | Compute panel, Rent GPU $6 (grey); `GPUs can be rented. Each one runs a copy of the model.` |
| 0:12 | Rent GPU affordable → **first automation at 0:12** (`GPU rented. A copy of the model is running.`) |
| 0:50 | Buy Power and Rent GPU both affordable (963 kWh left: power is not needed yet) |
| 1:20 | the policy's first price cut (backlog 235 > 30 s of production); 1:26 `Billing lags production at $0.24. Lower the price or market.` |
| 1:34 | Developments column (first world line) |
| 2:46 | `Power can now be bought 10,000 kWh at a time.` |
| 3:06 | **Research panel**: "Trust: 3", "+1 Trust at: 3,000 tasks", Hire Researcher, "Research: 0 / 1,000"; `Trust earned: 3. Each one hires a researcher.` |
| 3:30 | Expand Lab appears (grey); `The lab is nearly full. Expand Lab makes room for more research.` |
| 3:46 | **Projects panel** with one card, Better Prompting (750 research); then a card every ~15 s: Chain-of-thought 3:48, Blue-sky Research 4:02, Grid Contract 4:16, Research blog post 4:32, Experiment tracker 4:46 |
| 4:04 | `Insight unlocked. It accrues while research is at capacity.` |
| 4:54 | Grid Contract bought → "Grid Contract: ON buys power when it runs low" (manual power ends after 6 presses) |
| 5:12–5:44 | Training Pipeline (2,000 research) → **Training panel**, Train Sage-1.1 |

Policy actions in those 5 minutes: 439 clicks (mashing stops at 1:50), 38 GPUs, 12 price cuts, 6
power purchases, 3 hires, 2 lab expansions, 3 projects.

### 2b. Takeoff — whole stage (`r2-tk-s1`, 31:40; cross-checked against seeds 1–5 and Autoplay)

| t | event |
|---|---|
| 6:12–6:28 | Seed round (free, +$5,000, +2 Trust); Bulk GPU lease (5,000 research) |
| 6:30–8:44 | first training run: progress bar, flavour lines, modal *Can I try something?* (18 s timer) at 6:48, evaluation (six benchmark bars, four reviewer cards), Red-team / "Release (4 open)" at 7:46, release → Focus row (Capability / Efficiency / Safety) at 8:44 (8:06 in seed 1) |
| 7:30–9:44 | Tool use, Hire an evals team, Public API, Usage-based pricing |
| 11:02 | modal *A Bridge Round* (59 s); 11:32 Sage writes Sage |
| 12:58–13:12 | Series A (free, +$20,000) → **Reserve the Abilene site ($40,000)**, pinned; Enterprise sales team ($20,000, 6,000 research) |
| 14:16 | modal *Open Weights* (3 options); 14:30 Custom model contract (repeatable; "Contracts: $ … per sec" joins the Business panel); 15:02 Batch inference |
| 15:02 → 17:32 | **150 s with no new element — the longest reveal gap inside the stage in 4 of 6 traces** (three contracts are bought in it) |
| 17:32 | modal *A Reporter Calls*; Hire a recruiter |
| 18:20–18:22 | site reserved → **Abilene panel** ("Site: reserved") and **Interconnect queue ($80,000)** |
| 18:52–20:02 | Closed-loop cooling, Distributed training, Alignment team, Agent mode |
| 20:46 | modal *An Open Letter*; 22:32 Publish a safety framework |
| 22:56–22:58 | queue joined (`The Interconnect Queue — 3:30 until the utility signs off.`, a countdown in the Abilene panel) → **Substation ($120,000, 8,000 research, after the queue)** |
| 23:22–25:42 | Pay to expedite ($15,000), Power purchase agreement, modal *A Better Offer* (24:02), Lease the floor upstairs, tax abatement (free), Renewal season |
| 27:16 | modal *The Leaderboard Wants Sage* |
| 27:44–27:46 | substation bought ($100,000 after the abatement) → **Break ground ($165,000)** |
| 28:30–29:26 | Hire a general contractor ($25,000, "Break ground costs $40,000 less"), Build a sound wall |
| 29:26 → 31:40 | 134 s with no new element (162 s in seed 1, 152 s in seed 5): the last save-up; a training run and (in 4 of 6 traces) a second *Can I try something?* fall inside it |
| 31:40 | Break ground ($125,000) → Stage 2 |

Shape of the stage in all six first-timer traces: panels at 0:02, 0:06, 1:32, 3:06–3:10,
3:46–3:50, 5:44–5:48, then only Abilene (17:54–18:34); 35 projects, median gap 31–39 s, longest
150–176 s; six calendar modals 3:14–3:16 apart (11:02, 14:16, 17:32, 20:46, 24:02, 27:16) plus the
training gamble once or twice; four ladder rungs each bought 164–350 s after it appears (median
280 s); 18–19 Trust awards (one per ~105 s); 4–5 training runs whose yield falls as the model
outgrows the rental quota (`Not enough compute. Sage-1.2 trains to 98%` … 59% … 39% … 30%; the
Training panel explains it: "Compute: 59 of 408 GPUs wanted · undertrained (38%) / Rented GPUs
can't keep up. Abilene will."). Autoplay: 28:54 / 29:50 / 29:40, longest reveal gap 126–154 s.

### 2c. Paperclips — first 5 minutes (real time, `r2-pc-s1`)

| t | event |
|---|---|
| 0:00 | Business (Funds, Unsold Inventory, lower/raise, "Price per Clip: $ .25", "Public Demand: 32%", Marketing $100 grey) and Manufacturing (Clips per Second, Wire 1,000 inches, Wire $20 grey) |
| 0:32 | AutoClippers ($5) appears and is affordable → first automation 0:32 |
| 0:44 | first price cut (unsold 157 at 32% demand) |
| 1:46 | Wire and AutoClippers both affordable; 1:48 `500 clips created in 1 minute 46 seconds` |
| 3:18 | `1,000 clips created in 3 minutes 16 seconds` |
| 4:54 | **Computational Resources + Projects in one beat** at 2,000 clips: Processors, Memory, "Trust: 2", "+1 Trust at: 3,000 clips", three projects (RevTracker 500 ops, Improved AutoClippers 750, Improved Wire Extrusion 1,750) |

Nothing new appears between 0:32 and 4:54 (262 s). Policy actions: 879 clicks (mashing stops at
3:40), 13 clippers, 2 wire spools, 23 price moves.

### 2d. Paperclips — rest of Stage 1 (`r2-pc-s1` to 60:00, `pc-s1-accel` to 120:00)

| t | event |
|---|---|
| 6:32–13:42 | Even Better AutoClippers, Creativity → Limerick, Optimized Wire Extrusion, Optimized AutoClippers, WireBuyer, Microlattice Shapecasting (one project every 1–2 min) |
| 16:08–23:58 | Algorithmic Trading, Lexical Processing, New Slogan, Quantum Computing, Combinatory Harmonics, Catchy Jingle, Hypno Harmonics, The Hadwiger Problem |
| 25:42–32:52 | WireBuyer toggle, Spectral Froth Annealment, **HypnoDrones (70,000 ops)** at 29:16, MegaClippers, Tóth Sausage Conjecture, Donkey Space, Strategic Modeling |
| 33:32 | **Investments panel** (Deposit / Withdraw / Upgrade) |
| 35:38 | **Quantum Computing panel** (Compute, Photonic Chip) |
| 35:38 → 50:14 | 876 s with no new element (already-visible 10,000–12,000-op projects are bought one by one; the policy ignores the two new panels) |
| 50:14–57:22 | MegaClippers button, Improved MegaClippers, **Strategic Modeling panel** (52:36), Even Better MegaClippers |
| 60:56, 70:12 | New Strategy: B100, Quantum Foam Annealment |
| 70:12 → 112:08 | 2,516 s with no new element (the known late-Stage-1 lull; Trust 25 → 26 of the 100 needed) |

Reveal → purchase latency of its projects: median 262 s (p75 784 s) — a Paperclips project stands
grey as a goal for minutes.

### 2e. A Dark Room — first 5 minutes (`adr-5min`)

0:00 light fire → 0:02 "A Firelit Room", stoke fire → 0:32 `a ragged stranger stumbles through the
door` → 0:46 stores, "A Silent Forest" → 0:48 gather wood → 2:04 builder → 2:06 trap, cart → 3:00
event *The Mysterious Wanderer*. 12 reveals, 21 distinct lines, **1 number on screen**.

### 2f. On the screen

* **Takeoff, minute 0** (`r2-tk-s1.t0.png`): a black five-line console, "Tasks Completed: 0", one
  button, one grey button, a date. Nothing to misread. After the first click the Business panel
  states the first decision in words — "Billing 2.0/s of 4.0/s produced: *backlog growing*" —
  where Paperclips shows "Public Demand: 32%".
* **Takeoff, minutes 5–20** (`.t5/.t10/.t20.png`): four columns (Developments prose · clicker,
  power, Business, Compute · Research, Projects · Training, Abilene). Legible and aligned; every
  project card is a title with its price and one sentence stating the effect ("Give the copies a
  terminal and a browser. 75% faster."). It is a full dashboard by minute 10: 38 numbers, 17
  controls and 312 words on screen against Paperclips' 29, 11 and 149 at the same minute.
* **What a newcomer cannot tell from the screen**: what the three Focus buttons do (the text is in
  `title` tooltips only); what any modal option does — "open-source Sage-1 / cut the price / say
  nothing" are bare labels, and in *A Better Offer* "match the offer" and "offer equity" sit grey
  with their costs ("$12,000", "1 Trust") nowhere visible (`r2x-baseline.modal6.png`,
  `r2x-modal-hover.md`); that a rental quota exists before it is hit ("GPUs rented: 79", no
  "/ 80").
* **Reveals** fade in over 0.8 s and are announced in the console when they are panels
  (`Training infrastructure online.`); project cards arrive silently, as in Paperclips. The pinned
  ladder rung has a heavier border; an affordable card turns dark with a black border — the
  clearest "you can buy this now" signal in either game.
* **Evaluation** (`r2x-tour-evaluating.png`) is the best-staged reveal in the stage: six benchmark
  bars fill, four reviewer cards turn over, then "Capability 1.16×" — no numbers until the result.
* **One visual defect**: the Substation card clips its last line when the title wraps
  (`r2x-tour-clipped-card.png`: box 60 px, content 66 px).
* **Paperclips** (`pc-s1.t0…t20.png`): two columns, one sentence per project, nothing explained
  (Processors and Memory have no description at all), and from 4:54 to 33:32 the screen does not
  change shape. Calmer and plainer; the mirror's debug buttons are excluded from every count.
* **Transition**, Takeoff (`r2-tk-s1-seed1.tpre/.tend/.transition.png`,
  `r2x-reload-mid-transition-reload-mid-transition-30s.png`): before, the pinned card "Break
  ground ($125,000) — Pour the slab, rack the first thousand GPUs. Stop renting." says what will
  happen; after, the console holds four explanatory lines and the Compute and Abilene panels have
  become Infrastructure with one affordable button. Paperclips
  (`r2-transition-paperclips.*.png`): three lines, the Business and Investments panels gone,
  "Clips per Second: 0".
* **390 px** (`r2x-mobile-shots-*.png`): single column, no horizontal overflow, 1.0–1.9 screens
  tall; modals fit (374 × 241 at most). Buttons are 19 px tall (same in Paperclips at 390 px), the
  "saved." toast sits on top of the last text line of the viewport, and the Developments strip
  cuts its second entry at the right edge.

---

## 3. Rubric

Scores 1–10, higher is better, same scale as round 1. Evidence beside each score.

| Rubric item | Takeoff | Paperclips | A Dark Room (5 min only) |
|---|---|---|---|
| **(a) Time to first meaningful choice** | **8** — the price cue is on screen at 0:02 in words ("backlog growing"); first automation 0:12; two affordable purchases 0:48–0:50; console nudge 1:26; the policy's first price cut 1:20–1:24 (later than Paperclips only because its trigger is "backlog > 30 s of production"). It is felt at once — the pricer earns $3.60/s at 4:00 and $30.48/s at 10:00, the never-pricer $1.80/s and $3.00/s — but it does not last: by 30:00 the two have 335,734 and 328,926 tasks (1.02×), and never touching the price ends the stage at 35:12–35:18 instead of 30:42–32:06 | **8** — 0:44: "Public Demand: 32%" and 157 unsold; first automation 0:32; wire-vs-clipper 1:46. Less legible than Takeoff's sentence, later, and far heavier: the same first-timer who never touches the price has 33,587 clips and 11 AutoClippers at 40:00 instead of 649,310 and 96 (19×) | 5 — 0:48 (gather wood vs stoke); no trade-off until traps/carts at 2:06 |
| **(b) Seconds with nothing to do** | **9** — first 5 min, loose: 10–18 s (3.3–6.0%), longest stretch 10 s. Stage: 22–32 s (1.2–1.7%). Stricter: longest reveal gap 150–162 s (six traces; Autoplay 126–154 s), longest novelty gap 68–76 s, and after the opening (first non-drip decision at 3:04–3:10) the longest decision gap is 66–86 s; ~97 non-drip decisions per stage, one per 19 s | **7** — first 5 min, loose: 62 s (20.7%), one 32-s stretch (0:34–1:06). Stage: 100 s (2.8%). Stricter: reveal gaps of 262 s (0:32 → 4:54), 876 s (35:38 → 50:14) and 2,516 s (70:12 → 112:08), 11 over 120 s in the first hour; novelty gap 598 s; 23 decision gaps over 60 s and 9 over 120 s in 60 minutes (the 35–50 min ones are partly the policy, §1) | n/a — no automation; longest novelty gap 120 s |
| **(c) Cognitive load & progressive disclosure** | **6** — numbers 11 / 13 / 18 / 28 / 38 / 38 / 41 at 0/1/3/5/10/20/end (peak 47 at 16:50); controls 5 / 6 / 6 / 12 / 17 / 17 / 16; panels 1 / 2 / 3 / 5 / 6 / 7 / 7; 312–333 words on screen from minute 10. Disclosure is well staged — no beat adds more than 7 numbers and 3 controls, Research → Expand Lab → Projects → cards arrive 14–24 s apart — but fast and wordy: 24 reveals in the six minutes from 3:06, 3.7 console + 1.6 Developments lines per minute, and the effects of Focus and of every modal option live in tooltips | **7** — numbers 10 / 12 / 15 / 30 / 29 / 28 / 48 (60 min); controls 5 / 6 / 6 / 11 / 11 / 12 / 20; panels 2 / 2 / 2 / 4 / 4 / 4 / 7; 149–168 words; 1.6 console lines per minute; densest six minutes 11 reveals. One lump (4:54: 2 panels, 5 controls, 12 numbers in one beat) and no explanation of Processors/Memory, otherwise one element at a time | 10 — 1 number, ≤ 8 buttons, every line explained by the one before |
| **(d) Cadence of reveals** | **8** — a panel a minute for six minutes (0:02, 0:06, 1:32, 3:06, 3:46, 5:44), then one status panel (Abilene, ~18:00) in the remaining 26; a new project every 31–39 s (median; 35 in the stage, longest wait 150–176 s); a modal every 3:15; a ladder rung every ~4:40 from 13:00; 1–2 reveal gaps over 120 s per run, none over 162 s. Held below 9 because after 5:44 the stream is one kind of thing (cards), 11–13 of the 34 bought are bought within 10 s of appearing and three are free | **7** — panels at 0:00, 4:54, 33:32, 35:38, 52:36 (each a new mechanic); a project every 99–106 s (median; 28 in 60 min) from 4:54 to 35:38, then 876 s without one; nothing at all between 0:32 and 4:54 | 8 — a new noun every 30–60 s for three minutes |
| **(e) Greyed-out goal always on screen** | **10** — 100% of snapshots in the first 5 minutes and the whole stage, all nine rubric traces (Buy Power is grey from second 0; from 12:40–13:00 the pinned ladder rung). One of the grey cards is not a goal for an efficient player (§6.7) | **10** — 100% (Marketing $100 and Wire $20 grey from second 0; "+1 Trust at" from 4:54) | 8 — 84% |
| **(f) Clarity of stage transition** | **8** — announced by its own card ("…Stop renting."); five console lines 2 s apart, each naming one change with its number (`Ground broken outside Abilene. 2026 begins.` / `The 80 rented GPUs go back. Deposit returned: $32,000.` / `Power is capacity now, not a bill: 5 MW on site, 1 MW per 1,000 GPUs.` / `1,000 Nimbus G4s racked. Tasks per second ×13: the copies run on hardware OpenMind owns.` / `Left in the cloud: Custom model contract.`); history kept; survives a reload half a second in; "Buy GPUs (1,000) $25,000" affordable on arrival. Not higher because the arrival contradicts the announcement: output goes ×12–×67 but revenue does not move (six traces: −11% to +25% at +30 s; seed 1 $750/s → $756/s), Unbilled Tasks passes 227,000–375,000 in 30 s, in two of six traces the console adds `Nobody buys at $1.02. Lower the price.` while 190–400 tasks/s still bill, and routine lines push the narration out of the console within ~20 s | **8** — three lines at once (`Releasing the HypnoDrones` / `All of the resources of Earth are now available for clip production` / `Full autonomy attained in …`); Business and Investments deleted, "Clips per Second: 0", one grey project (Tóth Tubule Enfolding, 45,000 ops against 4,262) and nothing to buy for about a minute. Dramatic and unmistakable; explains less than Takeoff, strands the player longer | n/a |
| **(g) Soft-locks found** (count / severity) | **8** — 0 hard locks in 9 rubric traces, 22 play-style variants and 21 probes. Every round-1 dead end is now rescued or correctly diagnosed; reload restores the exact state at five awkward moments; ten minutes away from the keyboard is safe. Found: one allocation trap with its warning swallowed by a bug (hire-only: "Research: 1,000 / 1,000" from 3:38 to 60:00), a generic rescue that repeats without helping (*A Customer Writes* ×14, Press release ×35), three wrong console lines, an input-blocking modal (§4) | **7** — 0 hard locks; wire-out rescued at +0 s. Three dead ends, all silent: absurd price → zero sales with no line; every Trust into Processors → "Operations: 1,000 / 1,000" and six to nine unaffordable projects from 10:00 to 60:00 with the console silent for 26 minutes (new probe this round — hence 7, not round 1's 8); reload loses up to 25 s | n/a |

Overall (unweighted mean): **Takeoff 8.1 / Paperclips 7.7** (57 and 54 of 70).

---

## 4. Soft-locks and dead ends

### Takeoff — canned probes (`r2-softlock-takeoff.md`)

1. **Power 0** (all funds on GPUs: 0 kWh at 2:22 with 18 GPUs and $4.11). Complete Task stays
   enabled; console `Power exhausted — copies idle.` / `No power, and no money for more. The cloud
   provider may extend credit.`; the Projects panel opens early with "Ask the cloud provider for
   credit (1 Trust)" at +2 s; Buy Power is affordable again at +14 s. **Handled.**
2. **Idle on a new game** (3 and 10 minutes): no modal, no rescue, 0 tasks; only world lines.
   **Handled.** (At 5:30 the console says `Anthrosoft's Cadence-2 beats Sage-1. Demand dips.` to a
   player who has no Business panel yet — cosmetic.)
3. **Price ×200** at 3:00 → $2.15: billing line "nobody buys at $2.15", console `Nobody buys at
   $2.15. Lower the price.` every 90 s; lowering restores revenue. Still no ceiling (the `price-up`
   variant reaches $8.29), and the way back is one cent per click. **Diagnosed, not capped.**
4. **Ignore research for 15 minutes**: Trust 13 unspent, "Research 1,000 / 1,000"; `Research at
   capacity. Chain-of-thought needs 2,500. Expand Lab to hold more.` at 6:04 and `Trust +1. Hire a
   researcher or expand the lab.` at every milestone. **Named.**
5. **Release with open issues**: modal *Ship With Open Issues?* — "Sage-1.1 has 1 open issue the
   red team has not closed. They ship with it. Customers tend to find them within a few minutes."
   (release anyway / keep red-teaming; no timer; first time only). In the canned run, 124 s after
   the release: `Incident: a court cites a case Sage invented. Demand down 30%.` / `Traced to an
   issue shipped in Sage-1.1.` **Handled.**
6. **Reload mid-training**: 26%, 52 s remaining before and after. **Exact.**

### Takeoff — exploratory play styles (`r2x-<name>.explore.md`; seed 1 unless three times are given)

| play style | Stage 1 ends | what the screen says |
|---|---|---|
| first option of every modal (the rubric policy) | 32:06 / 30:42 / 31:24 | — |
| last option of every modal | 32:06 / 31:56 / 32:54 | — |
| worst-looking option of every modal (lose Trust, cut the price, lose researchers, gamble) | 31:54 / 31:40 / 31:38 | `Two researchers leave for a larger lab.` etc. |
| best-looking option of every modal (waits for greyed options) | 31:38 / 31:54 / 32:32 | — |
| never answers a modal | 31:28 / 31:48 / 34:14 | each closes on its timer (18–60 s) with its default |
| ships every model with open issues, never red-teams | 32:16 / 31:58 / 33:02 | 4–6 incidents, each `Demand down 30%`, each `Traced to…` |
| Focus: Efficiency always / Safety always | 31:12 / 30:48 / 30:36 · 33:16 / 33:14 / 33:40 | — |
| rents GPUs greedily, never saves | 34:28 / 33:00 / 34:28 | 12:48 "quota reached — the provider has no more to rent" / `The provider has no more GPUs to rent. Owning compute is the way past this.` |
| never touches the price | 35:16 / 35:18 / 35:12 | `Billing lags production at $0.25…`, backlog 19,406 at 12:00, then "selling out" for 20 minutes |
| never buys Marketing | 34:16 | — |
| 390 × 844 viewport | 32:06 | identical run; no overflow |
| never buys the Custom model contract | 49:52 | no line points at it |
| never buys a funds-priced side offer | 49:04 | (loses Enterprise sales team, which gates the contracts) |
| raises the price a cent every 4 s, forever | 53:40 | "nobody buys at $1.44 … $6.24"; carried by the funding rounds, contracts and 14 rescues |
| never trains a model | > 60:00 (Substation at 54:30) | `Research at capacity — insight accrues.` ×8; Train button enabled throughout |
| every Trust on Hire Researcher | > 60:00, walled | "Research: 1,000 / 1,000" from 3:38; see 1 below |
| every Trust on Expand Lab | > 60:00 | 1 researcher, 22 lab rooms; see 2 below |
| never spends Trust · never rents a GPU · never buys a project | > 60:00 | expected; each has an enabled button in view |

Nothing above is a hard lock. What reads as a trap, a contradiction or a bug:

1. **Hire-only: the wall line never prints (bug).** `Trust earned: 3. Each one hires a
   researcher.` (3:06–3:10) funnels the first three Trust into hires; research reaches its
   1,000 cap at 3:26–3:38, **before the Projects panel exists** (3:46–3:50). `researchWall`
   (`src/engine/tick.ts:156–174`) marks the cap as announced (`flags['wall:1000']`) before it
   knows whether anything on screen needs more, so it prints nothing then and nothing ever after
   at that cap. A player who keeps hiring sits at "Researchers: 14 / Research: 1,000 / 1,000" with
   four grey cards costing 2,000–3,000 (`r2x-wall-flag-10min.png`); at 60:00 the ladder stands at
   the Substation, which needs 8,000 research against a cap of 1,000. The only capacity line in
   the whole hour is `The lab is nearly full. Expand Lab makes room for more research.` at
   3:22–3:34 (each later Trust still prints `Trust +1. Hire a researcher or expand the lab.`); the
   game's other answer is "Press release (5 insight)" offered 35 times (`Press release out. Three
   outlets run it verbatim.` ×35). Paperclips has the same trap with no line at all (below).
2. **The idle guard does not know why the player is stuck.** Expand-only (1 researcher, 10
   research/s): *A Customer Writes* — "Your model saved our quarter." "We would like to pay for a
   year up front. $ 96.00, if that works." — opens 14 times between 13:46 and 59:38 (every 2:30
   from 36:16), offering $88–$930 to a player holding up to $57,159. Price at $2.25 from 0:04:
   the same modal pays "$ 1.00" twice (`Prepayment received. $ 1.00.`) to a company whose billing
   line reads "nobody buys at $2.25" and whose first GPU costs $6.
3. **`Trust +1. Hire a researcher or expand the lab.` while both buttons stay grey.** Taking the
   bridge round at Trust 0 leaves "Trust: -1" on screen (90–186 s per first-timer trace); the next
   milestone (12:20 in seed 1) prints the line as Trust goes −1 → 0.
4. **`Nobody buys at $1.02. Lower the price.` on arrival in Stage 2** (seed 1 at +18 s, seed 5 at
   +10 s; not in the other four traces), while 188 tasks/s bill for $741/s. `priceAbsurd`
   (`economy.ts:188–191`) compares sales with 2% of output, and output has just gone ×12–×67; in
   these traces the line fires once the player has bought the one affordable thing on arrival, a
   second GPU batch.
5. **A modal is a 60-second input lock.** The overlay covers the viewport and takes real mouse
   clicks (`r2x-modal-click-through.md`); the game keeps running (tasks 12,285 → 13,065 in 20 s);
   Escape does nothing; Tab moves focus to the buttons *behind* the overlay (`btn-task`,
   `btn-buyPower`), not into the dialog. Not a lock — every calendar modal has a timer and a
   harmless default — but *A Customer Writes* and *Ship With Open Issues?* have no timer.
6. **Price floor.** 24 lowers reach $0.01 (button disables). There the billing line says "Billing
   all 4.0/s produced: selling out" and "Avg. Rev. per sec: $ 0.04", but 485 tasks billed in 120 s
   paid $0.38, not $4.85: `bill()` floors funds to the cent after every sale
   (`economy.ts:267–270`, Paperclips' formula — there 1,000 clips at $0.01 pay $2.25). After five
   minutes at the floor: $4.01, no GPU, and no line suggesting the price go up.
7. **Reloads** with a modal open (timer 20 s → 20 s, 59 s → 59 s), during the interconnect
   countdown (1:57 → 1:57), 1 s into a red-team cool-down (11.0 s → 11.0 s) and half a second
   after Break ground (the four remaining narration lines still print): **all exact.**
8. **Walking away** at 10:00 for ten minutes: modals expire to their defaults (`OpenMind turns
   down a bridge round. The fund calls twice more.`), the Grid Contract keeps the power on, funds
   $194 → $16,080; on return eleven purchases are affordable at once and nothing is grey. **Safe.**
9. **Grid Contract off, power never bought** (12:00): 0 kWh at 12:32, "no power — copies idle",
   Buy Power enabled with $1,617. **Obvious fix on screen.**

### Paperclips (`r2-softlock-paperclips.md`, `r2x-pc-*.md`)

1. **Classic wire-out — handled.** Price $0.01, 1,000 clips, wire 0, $2.25 < $16: Projects opens
   early and *Beg for More Wire (1 Trust)* is clickable at +0 s.
2. **Absurd price → zero sales, no message.** $2.25 with 6 clippers: demand 4%, nothing sells for
   180 s, funds $26.98 → $3.19, no console line; *Beg* does not trigger.
3. **Every Trust into Processors — walled, silent** (new this round, the analogue of hire-only).
   "Operations: 1,000 / 1,000" from 10:00 to 60:00 with 16 processors, 1 memory and nine grey
   projects (1,750–12,000 ops); the creativity projects run out at 12:02 and the console prints
   nothing for the next 26 minutes.
4. Reload after 60 s loses 49 clips (autosave every 25 s, none on unload). Idle 3 minutes: nothing.

---

## 5. THE SINGLE BIGGEST GAP

**Nothing Stage 1 asks the player to decide changes Stage 1.** Ten ways of playing the s1-r2
build, on three seeds each, end the stage between 30:36 and 35:18 and arrive in Stage 2 in the
same state (capability 1.41–1.66×, 13–19 researchers, marketing level 9–12):

| what the player decides | stage end, seeds 1 / 2 / 3 | mean |
|---|---|---|
| modals: first option | 32:06 / 30:42 / 31:24 | 31:24 |
| modals: last option | 32:06 / 31:56 / 32:54 | 32:19 |
| modals: the worst-looking option each time | 31:54 / 31:40 / 31:38 | 31:44 |
| modals: the best-looking option each time | 31:38 / 31:54 / 32:32 | 32:01 |
| modals: never answered | 31:28 / 31:48 / 34:14 | 32:30 |
| red-team: never; every model shipped with open issues (4–6 incidents) | 32:16 / 31:58 / 33:02 | 32:25 |
| Focus: Efficiency always / Safety always (default Capability = first row) | 31:12 / 30:48 / 30:36 · 33:16 / 33:14 / 33:40 | 30:52 · 33:23 |
| saving: never; rent a GPU whenever one is affordable | 34:28 / 33:00 / 34:28 | 33:59 |
| price: never touched (first row makes 103–138 price clicks) | 35:16 / 35:18 / 35:12 | 35:15 |

The worst-looking modal answers finish 17 s *sooner* than the best-looking ones; the five modal
strategies differ by 1:06 between their means, less than the 1:24 between the three seeds of the
first row alone; never red-teaming costs 61 s; the game's own bot (28:54 / 29:50 / 29:40) is two
minutes ahead of the scripted first-timer. In Paperclips the first lever alone is worth 19×: the
same first-timer who never touches the price has 33,587 clips and 11 AutoClippers at 40:00
instead of 649,310 and 96 (`r2x-pc-no-price.md` vs `pc-s1-accel`). Measured the same way, Takeoff's
never-pricer has 328,926 tasks at 30:00 against 335,734 (1.02×) and earns $657/s against $778/s —
although at 10:00 it earned a tenth ($3.00/s against $30.48/s). The lever works for fourteen
minutes and then stops mattering.

Why, in on-screen terms. (1) At 32:06 the Business panel reads "Avg. Rev. per sec: $ 749.79 /
Contracts: $ 549.46 per sec": 73% of income is a line that price, demand, hype, incidents,
marketing and every modal leave untouched (it is 51% at 20:00; at 21:00, 300 raises take the price
from $0.69 to $3.69 and billing from 155/s to 3.9/s, and income only falls from $252.58/s to
$167.96/s — `r2x-contracts-vs-price.md`). It comes from one repeatable card,
"Custom model contract (3,000 → 24,516 research) — A bank wants its own Sage. Research becomes
recurring revenue.", which the stage never marks as different from the other 34; a player who
skips it finishes at 49:52. (2) The growth verb the first twelve minutes teach is dead from 12:48
("quota reached — the provider has no more to rent"; 100 GPUs after the Bulk lease at 14:50), so
tasks/s — what the price acts on — moves only with projects. (3) Modal stakes are ±1 Trust (one
arrives every ~105 s anyway), ±1 marketing level, 500–1,500 research or $8,000 at 11:02, against
rungs of $40,000–$165,000; and they are printed only in `title` tooltips — "take the bridge"
carries `+$8,000, −1 Trust`, "let them go" carries `−2 researchers`, "match the offer" sits grey
with its `$12,000` nowhere on screen. (4) An incident is `Demand down 30%` for a minute on the
part of income that depends on demand (49% at 20:00, 27% at the end), and a dirty release still
prints `+1 Trust`.

The stage therefore presents seven or eight timed modals, a release confirm, a three-way Focus
switch and a price lever with a status line as decisions, and the outcome is the same 31–35
minutes whichever way each is taken — while the choices that do decide the stage (spend Trust on
both sinks; buy the contract card; train at all) are never framed as choices.

Fix, in order of leverage:

1. **Tie contract income to the market.** A contract pays for N tasks/s *at the current price and
   demand multiplier* (or cap Contracts at the billing revenue). Then the price lever, hype,
   incidents and marketing act on 100% of late-stage revenue instead of 27%.
2. **Make a shipped issue cost the income that matters and a clean release earn something.** Each
   incident suspends the Contracts line for 60 s (or cancels the newest contract: `The bank
   pauses its pilot.`); the release's `+1 Trust` is paid only at 0 open issues.
3. **Size modal stakes to the current rung and print them on the button.** Two lines per option —
   label, then effect and cost ("take the bridge / +$10,000 now, −1 Trust, −10% contract income").
   Bridge Round = 25% of the next rung's price; *A Better Offer* "let them go" also loses the
   newest contract; *The Leaderboard* loss costs two marketing levels. A greyed option shows what
   it needs.
4. **Give Focus a visible trade.** Today Efficiency always is the fastest stage (30:52) and ends
   at capability 1.41–1.44×, Capability 31:24 at 1.55–1.57×, Safety 33:23 at 1.47–1.48×, and
   nothing on screen says so; put the effect line under the buttons and make Safety remove the
   incident risk that fix 2 creates.

Target for the next build, measured with `explore.mjs` on seeds 1–3: best-looking vs worst-looking
modal answers ≥ 3 minutes apart; red-team-to-zero vs never ≥ 3 minutes; price tracked vs never
touched ≥ 5 minutes; every first-timer seed still inside 26–40 minutes and the Autoplay bot at or
under 27.

---

## 6. Secondary gaps (priority order)

1. **Too much, too fast, in minutes 3–10** (the one rubric row Paperclips still wins). 24 reveals
   in the six minutes from 3:06 — one every 15 s — against 11 in Paperclips' densest six; 38
   numbers, 17 controls and 312 words on screen at 10:00 against 29, 11 and 149; 5.3 lines of new
   text a minute (3.7 console + 1.6 Developments) against 1.6; one training run prints 8–10
   console lines, 3–4 of them pure flavour (`Loss curve looks healthy.`, `Final learning-rate
   decay. Nobody touches anything.`). Fix: drip one card per 30 s (not 15 s) until the Training
   panel is on screen; one flavour line per training run; keep the console for lines that carry a
   number or an instruction and send the rest to Developments; print the Focus effect under the
   buttons instead of in `title`.
2. **Projects are a conveyor belt, not goals.** Median 28–34 s from a card appearing to its
   purchase (Paperclips: 262 s); 11–13 of the 34 bought are bought within 10 s of appearing; two
   cost nothing that isn't refunded at once ("Take the county's tax abatement (free) … The
   substation costs $20,000 less", "Hire a general contractor ($25,000) … Break ground costs
   $40,000 less"). Fix: price research cards so the median one stands grey for ≥ 90 s; turn the
   two discounts into real trades (the abatement costs 1 Trust; the contractor adds a 60-s build
   timer).
3. **The main verb is dead for 60% of the stage and the quota is a surprise.** Rent GPU is capped
   at 80 from 12:48 and at 100 from 14:50 (greedy variant); nothing shows a quota before it is hit
   ("GPUs rented: 79"; the Bulk lease card mentions "the quota" at 6:28, six minutes before the
   player can know there is one); meanwhile Training reads "Compute: 59 of 408 GPUs wanted ·
   undertrained (38%)" and successive runs train to 98%, 59%, 39% and 30%. Fix: show "GPUs
   rented: 66 / 80" from the first rental; sell quota in two or three research-priced steps
   between 13:00 and 25:00 so that renting stays a live, rising-price decision until Break ground.
4. **Price is 103–138 one-cent clicks for a 12% gain.** 86–107 of them are "raise", because demand
   grows about eightfold while the step stays a cent ($0.13 at 5:00, $1.02 at the end). Paperclips
   needs 118 moves in 60 minutes; Takeoff needs as many in 32. On arrival in Stage 2 the price is
   wrong by dozens more. Fix: a 5% step above $0.20 (or hold-to-repeat), and a mid-stage project
   that prices to clear.
5. **The transition's payoff contradicts its announcement.** `Tasks per second ×13`, but in six
   traces "Avg. Rev. per sec" is −11% to +25% thirty seconds later (seed 1: $750 → $756), "Unbilled
   Tasks" passes 227,000–375,000 (159,132 with nothing bought, under "Billing 367/s of 5,475/s
   produced: *backlog growing*"), and in two traces the first advice is the wrong line (§4.4). The
   five narration lines share the console with `Trust +1…` and `Training complete…` and are gone
   in ~20 s. Fix: hold routine console lines for 10 s after Break ground; replace the
   absurd-price line with one that is true ("The site makes 28 times what the market takes at
   $1.02."); sell the first minute's backlog at a bulk rate or re-price to clear once, so the
   first number that moves on arrival is revenue.
6. **Allocation walls are named once, or not at all.** Hire-only: the wall line is swallowed
   (§4.1). Expand-only: 14 identical rescue modals worth 1–3% of the player's funds. Fix: set
   `wall:<cap>` only when a line is printed and re-arm it every 120 s while research is pinned and
   a visible card costs more than the cap; give the idle guard a diagnosis ("One researcher cannot
   fill twenty-two rooms." → highlight Hire) before it offers money; never offer a prepayment below
   the price of the cheapest thing on screen.
7. **Insight is dead UI for an efficient player.** 0.0 insight in all six first-timer traces;
   "Insight: none yet (accrues at capacity)" and the grey card "Research blog post (10 insight) —
   Mostly charts. +1 Trust." stay on screen from 4:30 to the end of the stage (26–27 minutes), and
   the card is the only thing left in Projects on arrival in Stage 2. Fix: accrue a trickle of
   insight from releases, or hide the card and the line until insight is above 0.
8. **Small things on the screen.** `Trust +1. Hire…` at Trust −1 → 0 and a negative "Trust: -1"
   (§4.3); the clipped Substation card; the modal's keyboard focus and Escape (§4.5); the cent
   floor at $0.01–$0.02 (§4.6); "saved." over the last line of a 390-px viewport; 19-px-tall
   buttons on touch (parity with Paperclips, still half the 44-px guideline).

---

## 7. Verdict

| Rubric item | Winner | Margin |
|---|---|---|
| (a) Time to first meaningful choice | Tie (8–8) | Takeoff is earlier and says it in words (0:02 "backlog growing", GPU at 0:12 vs 0:32–0:44); Paperclips' choice weighs 19× at 40:00, Takeoff's 12% of the stage |
| (b) Nothing to do | **Takeoff** (9–7) | 10–18 s idle in the first 5 minutes vs 62 s; worst reveal gap 162 s vs 876 s in the first hour; 2 decision gaps over 60 s per stage vs 23 per hour |
| (c) Cognitive load / disclosure | Paperclips (7–6) | 29 vs 38 numbers, 11 vs 17 controls, 149 vs 312 words at 10:00; 11 vs 24 reveals in the densest six minutes. Takeoff's staging is the better of the two (largest beat +7 numbers vs +12) |
| (d) Cadence of reveals | **Takeoff** (8–7) | a project every 31–39 s vs 99–106 s, a modal every 3:15, a rung every ~4:40; Paperclips' later reveals are new mechanics, Takeoff's are more cards |
| (e) Greyed-out goal on screen | Tie (10–10) | 100% both |
| (f) Clarity of transition | Tie (8–8) | Takeoff explains more (five lines with numbers, an affordable button on arrival) and then contradicts itself (flat revenue, "Nobody buys"); Paperclips explains less and is unmistakable |
| (g) Soft-locks | **Takeoff** (8–7) | both 0 hard locks; Takeoff's dead ends have a line or a rescue (one line swallowed by a bug), Paperclips' three are silent |
| **Overall** | **Takeoff, narrowly: 8.1 vs 7.7** | earned on pacing and coverage (b, d), not on depth: the rubric has no row for whether decisions matter, and there Paperclips is far ahead (§5) |

What is measurably good in Takeoff, so that the next fix does not break it:

* First automation at 0:12 and a price cue in plain words from 0:02 ("Billing 2.0/s of 4.0/s
  produced: *backlog growing*"; later "selling out", "nobody buys at $2.15").
* No dead air: ≤ 18 s idle in the first 5 minutes, no reveal gap over 162 s, no novelty gap over
  76 s, in six first-timer traces; Autoplay ≤ 154 s. Stage length 30:42–32:06 across five seeds.
* The tail is gone: from 12:40–13:00 a pinned four-rung ladder ($40,000 → $80,000 → $120,000 →
  $165,000 list, each bought 164–350 s after it appears, median 280 s), each rung with a console
  line, a Developments entry and a line in the Abilene panel, the queue with a visible countdown.
* Staggered disclosure: no single beat adds more than 7 numbers and 3 controls; Research, Expand
  Lab, Projects and Insight arrive 16–24 s apart (3:06, 3:30, 3:46, 4:04), cards one at a time,
  Focus only after the first release.
* Power is no longer a chore: 6 presses per stage (367 in round 1); Grid Contract at 4:54.
* Trust keeps flowing: 18–19 awards per stage, and the line says what to do with it.
* 100% greyed-goal coverage from second 0.
* The transition: five explanatory lines 2 s apart, history kept, a reload mid-narration loses
  nothing, an affordable Infrastructure purchase on arrival, nothing un-bought vanishes unnamed.
* Dead ends: the manual button never dies; power-out, absurd price and research wall each get a
  line that names the fix; a release with open issues is confirmed once and its incident is
  attributed; the rental quota states its reason on screen.
* Persistence: exact restore mid-training, mid-modal, mid-countdown, mid-cool-down,
  mid-transition; ten minutes of absence is safe.
* Every project card is one sentence that states its effect; the evaluation sequence.
* No page error in any run; no horizontal overflow at 390 px; same seed, same run.

---

## 8. Status of each round-1 finding

| Round-1 finding | Status in s1-r2 | Evidence |
|---|---|---|
| **Biggest gap: a 10–14 minute dead tail** (852 s, 686 s, 372 s without a new element; Autoplay 353 s + 230 s) | **Fixed** | longest reveal gap 150–162 s in six first-timer traces, 126–154 s for Autoplay; the last 19 minutes hold four rungs, 16 side cards, five or six modals and three or four training runs. The rubric's target (no gap over 180 s) is met |
| Secondary 1: power is a chore (367 presses) | **Fixed** | 6 presses per stage; `Power can now be bought 10,000 kWh at a time.` at 2:46; Grid Contract (2,000 research) bought at 4:54–4:58 |
| Secondary 2: Public Demand % is illegible | **Fixed** | replaced by "Billing 26/s of 41/s produced: *backlog growing*" and four other states; the old "saturated" line is now `Billing lags production at $0.24. Lower the price or market.` |
| Secondary 3: two disclosure spikes (2:34, 5:36) | **Fixed** | Research 3:06 (+7 numbers, +1 button), Expand Lab 3:30, Projects 3:46 with one card, Focus row only after the first release (8:06–8:44). The stream that replaced the spikes is now itself too fast (§6.1) |
| Secondary 4: copy repeats and contradicts itself | **Mostly fixed** | milestone line states the reward; Trust arrives every ~105 s; no rescue at 0 tasks; console history survives the transition. New, smaller contradictions: §4.2, §4.3, §4.4 |
| Secondary 5: the transition is destructive without saying so | **Fixed** | `Left in the cloud: Custom model contract.`, `Deposit returned: $32,000.`, `Tasks per second ×13: …`; Buy GPUs (1,000) affordable on arrival. New: the arrival economy contradicts the ×13 (§6.5) |
| Soft-lock 1: power 0 kills the manual verb | **Fixed** | Complete Task stays enabled (tooltip "Never needs power."); credit offer at +2 s; two console lines |
| Soft-lock 2: rescue fires on a player who has done nothing; pays $14,710–$19,377 late | **Fixed** (0 rescues in 10 idle minutes; late amounts $88–$930; 0–1 rescues in an on-path stage) — **but still generic** | *A Customer Writes* ×14 for the expand-only player; "$ 1.00" at an absurd price (§4.2) |
| Soft-lock 3: no price ceiling, misleading diagnosis | **Partly fixed** | diagnosis now right (`Nobody buys at $2.15. Lower the price.`, also on the billing line); still no ceiling ($8.29 reached) and one cent per click back |
| Soft-lock 4: research wall with a nag that does not name the fix | **Partly fixed** | the line names what needs how much and the fix (`…Chain-of-thought needs 2,500. Expand Lab to hold more.`); a bug swallows it for the hire-only player (§4.1) |
| Soft-lock 5: release with open issues — no confirm, no attribution | **Fixed** | modal *Ship With Open Issues?*; `Traced to an issue shipped in Sage-1.1.` The consequence is negligible (§5) |
| Soft-lock 6: research wall carried into Stage 2 | **Fixed** | on arrival "Train Sage-1.6 Cost: $23,683, 20,410 research · Compute: enough · est. 95 s" against "Research: 19,190 / 60,000", Trust 1, Hire and Expand enabled |
| Tedium note: 367 Buy Power presses; reload mid-training works | **Fixed / still works** | 6 presses; exact restore |

---

## 9. Re-running

All commands from the repo root; outputs in `agent-tools/critic-out/`.

```sh
G="--game-dir agent-tools/snapshots/s1-r2"
# rubric runs (one real-time run at a time)
node tools/critic-r2/run.mjs takeoff    r2-tk-s1        $G --realtime 300 --accel-minutes 60 --seed 1
for s in 1 2 3 4 5; do node tools/critic-r2/run.mjs takeoff r2-tk-s1-seed$s $G --realtime 0 --accel-minutes 60 --seed $s; done
node tools/critic-r2/run.mjs takeoff    r2-tk-s1-auto   $G --realtime 0 --accel-minutes 60 --autoplay      # also --seed 2, 3
node tools/critic-r2/run.mjs paperclips r2-pc-s1           --realtime 300 --accel-minutes 60                # ≡ pc-s1
node tools/critic-r2/run.mjs paperclips pc-s1-accel        --realtime 0   --accel-minutes 120               # baseline, reused
node tools/critic-r2/run.mjs adr        adr-5min           --realtime 300                                   # baseline, reused
node tools/critic-r2/analyze.mjs r2-tk-s1                  # → .analysis.md; same for every label
node tools/critic-r2/compare.mjs r2-tk-s1 r2-tk-s1-seed2 r2-tk-s1-seed3 r2-tk-s1-auto r2-pc-s1 pc-s1-accel adr-5min
node tools/critic-r2/decisions.mjs r2-tk-s1 r2-tk-s1-seed1 r2-pc-s1 pc-s1-accel   # decision gaps, reveal → purchase
# canned probes
node tools/critic-r2/transition.mjs takeoff $G --out r2-transition-takeoff
node tools/critic-r2/transition.mjs paperclips --out r2-transition-paperclips
node tools/critic-r2/softlock.mjs takeoff $G --out r2-softlock-takeoff
node tools/critic-r2/softlock.mjs paperclips --out r2-softlock-paperclips
node tools/critic-r2/determinism.mjs takeoff $G --accel-minutes 60
# exploratory (this round)
node tools/critic-r2/explore.mjs list
node tools/critic-r2/explore.mjs all-runs $G                 # 22 play styles, seed 1 → r2x-<name>.explore.md
node tools/critic-r2/explore.mjs baseline,modal-last,modal-ignore,modal-worst,modal-best,ship-open,no-price,greedy,focus-efficiency,focus-safety $G --seed 2   # and --seed 3: the §5 table
node tools/critic-r2/explore.mjs all-probes $G               # 15 probes → r2x-<name>.md + screenshots
node tools/critic-r2/explore.mjs all-paperclips              # pc-no-price, pc-proc-only, pc-mobile
```

### Harness changes made this round (all inside `tools/critic-r2/`; nothing in `tools/critic/` or the game was touched)

1. `lib/policy.mjs` — the modal step calls `adapter.policy.modalChoice(modal, enabledOptions, t)`
   when the adapter defines it (return an option, or `null` to leave the modal open). Default
   unchanged: first enabled option.
2. `lib/runner.mjs` — `runGame` accepts `opts.adapter` (a ready adapter object instead of loading
   one by name) and `opts.viewport` (passed to `openSession`).
3. `lib/probe.mjs` — `openProbe` accepts and passes on `viewport`.
4. **New** `explore.mjs` — the play-style variants (adapter overrides: `drip`/`goal`/`goalRule`,
   `lower`/`raise`, `skip`, `veto`, `special`, `modalChoice`, viewport), the scripted probes
   (reloads, idling, real mouse and keyboard against a modal, price floor, wall flag, contracts
   against price, tour of screens and project-card texts, 390-px shots) and three Paperclips
   reference runs. Each run
   also writes `.explore.md` (per-minute metrics, modal text / timer / option tooltips, on-screen
   notes on change, every console and log line), `.modals.json` and `.modal<N>.png`.
5. **New** `decisions.mjs` — decision gaps and reveal → purchase latency for any run.
6. `README.md` — a "Round-2 additions" section describing 1–5.

Two notes for whoever ports this. `determinism.mjs` has no `--out`; running it here overwrote the
older `det-takeoff-a/b.*` outputs in `agent-tools/critic-out/` with s1-r2 runs. And the canned
`release-open-issues` scenario still reports "no confirmation of any kind" because it only listens
for browser dialogs; the game now confirms with its own modal (visible two lines further down in
the same report).
