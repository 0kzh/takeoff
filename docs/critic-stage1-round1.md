# Takeoff — Stage 1 ("The Startup") vs Universal Paperclips — Stage 1

Reviewer brief: fresh context, no design docs read. Everything below was measured by driving both
games in headless Chromium with the same scripted "curious first-time player". A Dark Room was
measured for the first 5 minutes only, as a third reference for early cadence.

Scope: Takeoff from a new game to the console line `Ground broken outside Abilene.` (Stage 1→2).
Paperclips from a new game to `Release the HypnoDrones` (reached via cheats; a normal player needs
hours to reach 100 Trust).

All scripts and raw data live in `/tmp/critic/` (see §8 for how to re-run).

---

## 1. Method and definitions

### Harness

* `pw/run.js <game>` plays one game: **phase 1** = 300 s of real wall-clock time, no acceleration;
  **phase 2** = deterministic stepping in 2-second game-time steps until the stage ends (Takeoff:
  `__game.tick(ms)`; Paperclips: every `setInterval` was virtualised at page-init so the whole game
  can be stepped with `__advance(ms)` without touching its code). Every 2 s a snapshot is taken.
* A **snapshot** records: every visible `<button>`/project button (enabled or disabled, using
  `checkVisibility()` and the `disabled` attribute), visible sliders, visible panels (a container
  with a direct `<b>`/`<h2>` heading), the newest console line, the newest Developments entry, any
  open modal, the count of numeric tokens on screen, and whether a "next milestone at N" line
  (`#nextTrust`, same id in both games) is visible. The dev overlay (Takeoff) and the debug/save
  buttons that the jgmize Paperclips mirror leaves visible are excluded from all counts.
* **Policy** (identical shape for both games): mash the main button at 4 clicks/s until automation
  out-produces the hand (≥ 8 units/s) ; buy the first automation the moment it is affordable;
  buy any affordable upgrade/project/automation while keeping one consumable purchase (power /
  wire) in reserve; adjust price only by watching the backlog (lower when the backlog exceeds 30 s
  of production and is growing; raise after 4 consecutive checks of near-zero backlog; 8 s
  cool-down); answer any modal with its first enabled option; red-team until 0 open issues then
  release; once a big-ticket goal is visible (First Datacenter) stop the GPU/marketing drip and
  save. In Paperclips the same policy buys memory when the cheapest visible project costs more ops
  than the cap. A second Takeoff trace uses the game's own **Autoplay** bot as the designer's
  intended play.

### Definitions used (applied identically to both games)

* **Reveal**: first time a panel, button, slider, project button or modal becomes visible.
* **Enabled transition**: a visible disabled button becoming enabled.
* **Nothing-to-do (loose)**: a 2-s snapshot in which *all* hold: (1) at least one automation unit
  has already been bought; (2) no modal/choice is open; (3) no visible enabled button exists other
  than the *ambient* set (main clicker; lower/raise price; Takeoff's three Focus buttons and Grid
  toggle; Paperclips' invest/withdraw/qCompute); (4) nothing became newly visible or newly enabled
  since the previous snapshot. Reported as total seconds and longest consecutive stretch.
* Because both games drip cheap repeat purchases (a GPU every ~7 s, a clipper every ~10 s), the
  loose measure under-reports boredom. Two stricter measures are reported alongside it:
  **novelty gap** = time between consecutive novelty events (first-time reveal, modal, or a *new*
  console/log line); **reveal gap** = time between consecutive first-time reveals of a
  panel/button/project/modal (console lines excluded). Reveal gap is the one that separates the
  games.
* **Greyed-out goal on screen**: snapshot has ≥ 1 visible disabled purchase/project, or a visible
  "+1 Trust at: N" line.
* **Cognitive load**: number of numeric tokens visible + number of visible interactive elements
  (buttons + sliders) + visible panels, sampled at minutes 0, 1, 3, 5, 10, 20 and stage end.
* **First meaningful choice**: first moment with ≥ 2 distinct affordable non-ambient actions
  competing for the same resource, or a price decision prompted by visible feedback, or a modal.

### Runs used

| file prefix | what |
|---|---|
| `takeoff-final` | Takeoff, 5 min real time + stepped to stage end (34:46) — primary |
| `takeoff-accel`, `takeoff` | Takeoff, two more full-stage traces with the same policy (30:10, 33:24) |
| `takeoff-autoplay` | Takeoff, the game's own Autoplay bot, stepped (25:18) |
| `pc-final` | Paperclips, 5 min real time + stepped to 56 min — primary |
| `pc-accel` | Paperclips, stepped 120 min, same final policy |
| `adr` | A Dark Room, 5 min real time (optional third point) |
| `transition-*.md`, `softlocks*.md` | transition and dead-end probes |

---

## 2. Reveal timelines

### 2a. Takeoff — first 5 minutes (real time, `takeoff-final`)

| t | event |
|---|---|
| 0:01 | Business panel (Funds, Unbilled Tasks, lower/raise, Price, Public Demand 96%) after the first click |
| 0:06 | Compute panel: Rent GPU $7 (grey), Buy Power $20 (grey); console "GPUs available to rent. $7.00 each." |
| 0:08 | Rent GPU affordable → **first automation at 0:08** |
| 0:18 | Developments log column appears (first world line) |
| 1:04 | Buy Power affordable; Marketing (grey, $100) appears |
| 1:46 | "1,000 tasks completed in 1 minute 47 seconds." |
| 1:56 | "Demand saturated — lower the price or market." |
| 2:34 | **Research + Projects panels at once**: Trust, "+1 Trust at", Hire Researcher, Expand Lab, Researchers, Lab Space, Research 0/1,000; project *Better Prompting (750 research)* grey |
| 3:00 | Better Prompting affordable; 3:03 Chain-of-thought (2,500) appears |
| 3:11 | Hire/Expand affordable; "Milestone reached: TRUST INCREASED" |
| 3:13 | Experiment tracker ($1,500, 3,000) appears |
| 3:35 | Blue-sky Research (1,000) and Usage-based pricing (12,000) appear; 3:37 "Insight unlocked" |
| 4:45 | Chain-of-thought affordable; 4:47 Tool use (5,000) appears |
| 5:28–5:36 | Seed round (free), Training Pipeline; **Training panel** with 3 Focus buttons and Train Sage-1.1 |

Policy actions in those 5 minutes: 40 GPUs rented (one every ~7.5 s), 8 power purchases, 1 project.

### 2b. Takeoff — whole stage (`takeoff-final`, 34:46; cross-checked against three other traces)

| t | event |
|---|---|
| 5:36 | Training panel; 6:14 Train affordable; 7:05 modal *Can I try something?* |
| 7:46 | Red-team / Release buttons (first eval); Public API appears |
| 9:33–9:49 | Research blog post (insight), Grid Contract bought → Grid ON toggle |
| 12:46 | modal *Release Sage-2*; 13:29 modal *Open Weights* (3 options) |
| 13:10–15:04 | Launch demo video, Hire an evals team, Alignment team, Series A (free, +$100k), Experiment tracker, Custom model contract (repeatable), Enterprise sales team (grey) |
| 17:51 | modal *A Customer Writes*; 17:59 modal *A Reporter Calls* (60-s timer) |
| 20:33 | **First Datacenter ($250,000, 18,000 research)** appears, grey |
| 20:33 → 34:46 | **no new panel, button, project or modal for 852 s**; only repeat purchases (Custom model contract ×4, GPUs, power) and console lines |
| 34:46 | Datacenter affordable and bought → Stage 2 |

Other traces: `takeoff-accel` datacenter 18:44, end 30:10 (reveal gap 686 s); `takeoff`
datacenter 21:10, end 33:24 (gaps 199 s + 372 s + 163 s); **Autoplay** (designer bot) Series A
13:54, datacenter visible 19:47, end 25:18 (reveal gaps 353 s and 230 s; funds climb $90k→$250k
from 14:00 to 25:18 while "The Research Plateau — the next run needs 8,192 research. The lab
holds 8,000." prints at 17:07 and again at 20:24).

Panels revealed in Stage 1: Business 0:01, Compute 0:06, Developments 0:18, Research 2:34,
Projects 2:34, Training 5:36 — six panels in the first 5.6 minutes, then **none for the remaining
20–29 minutes** until Infrastructure replaces Compute at the transition.

### 2c. Paperclips — first 5 minutes (real time, `pc-final`)

| t | event |
|---|---|
| 0:02 | Business (Funds, Unsold Inventory, lower/raise, Price $.25, Public Demand 32%, Marketing $100 grey) and Manufacturing (Clips/sec, Wire 1,000 in, Wire $26 grey) |
| 0:40 | AutoClippers ($5) appears **and is affordable** → first automation 0:40 (0:18–0:22 in the other two traces; sales are random) |
| 0:40 | first price cut (inventory 200+ at 32% demand; this is the first real decision) |
| 1:04 | second clipper affordable; 1:48 "500 clips created in 1 minute 49 seconds" |
| 2:04 | Wire affordable (first time the player must choose wire vs clipper) |
| 3:17 | "1,000 clips created in 3 minutes 16 seconds" |
| 4:57 | **Computational Resources + Projects** at 2,000 clips: Processors, Memory (grey), Trust 2, "+1 Trust at 3,000 clips", three projects (RevTracker 500 ops, Improved AutoClippers 750, Improved Wire Extrusion 1,750) |

Policy actions: 14 clippers, 2 wire spools, 7 price moves.

### 2d. Paperclips — rest of Stage 1 (`pc-accel`, 120 min stepped)

| t | event |
|---|---|
| 5:18 | Computational Resources + Projects (3 projects) |
| 7:24 | Even Better AutoClippers |
| 9:08 | Optimized Wire Extrusion |
| 11:12 | Optimized AutoClippers |
| 13:02 | WireBuyer (7,000 ops) |
| 14:00 | Microlattice Shapecasting |
| 16:12–16:46 | Creativity (1,000 ops) → Limerick (10 creat) → Algorithmic Trading (10,000 ops) |
| 21:28 | WireBuyer toggle (bought) |
| 25:40 | Spectral Froth Annealment |
| 30:58 | New Slogan |
| 33:52–34:18 | Combinatory Harmonics, Catchy Jingle, Quantum Computing, Hypno Harmonics |
| 35:20 | HypnoDrones (70,000 ops) — the stage goal becomes visible |
| 39:32–39:44 | Hadwiger Clip Diagrams, MegaClippers |
| 41:56 | **Investments panel** (Deposit/Withdraw/Upgrade) |
| 45:02 | **Quantum Computing panel** (Compute button, Photonic Chip) |
| 52:04 | Tóth Sausage Conjecture; 55:48 MegaClippers toggle + Improved MegaClippers; 59:36 Even Better MegaClippers |
| 67:24–67:28 | Donkey Space, **Strategic Modeling panel** (Run, New Tournament, strategies) |
| 71:02–82:46 | New strategies, Optimized MegaClippers, Quantum Foam Annealment |
| 82:46 → 114:48 | 1,922 s with no new element (trust 28→30 of the 100 needed; this is the known late-Stage-1 lull) |

Trust at 120 min: 30/100. Stage end not reached in 2 hours of stepped play.

### 2e. A Dark Room — first 5 minutes (`adr`)

0:02 light fire → 0:04 "A Firelit Room", stoke fire (10-s cool-down) → 0:32 "a ragged stranger
stumbles through the door" → 0:48 "A Silent Forest" tab, gather wood, stores (wood) → 1:32 / 2:02
stranger lines → 2:58 first event (give in / ignore it). 11 reveals, 17 distinct console lines,
**1 number on screen** for the entire 5 minutes.

---

## 3. Rubric

Scores 1–10, higher is better. Evidence beside each score.

| Rubric item | Takeoff | Paperclips | A Dark Room (5 min only) |
|---|---|---|---|
| **Time to first meaningful choice** | **6** — 1:04 (Buy Power $20 vs Rent GPU $9 for ~$10 of funds). The price lever is on screen from 0:01 but gives no reason to use it: demand reads 96% and nothing backs up until GPUs exist; the first nudge is the console at 1:56 | **8** — ~0:40: inventory visibly piles up at "Public Demand 32%", so lower-the-price is a real, legible trade-off within the first minute; 1:04–2:04 wire-vs-clipper reserve decision | 5 — 0:48 (gather wood vs stoke), no real trade-off until the builder's traps/carts |
| **Seconds with nothing to do** (first 5 min measured / stage estimated) | **5** — loose: 136 s (45%) but longest stretch 8 s because a GPU is affordable every ~7 s; longest novelty gap 44 s. Stage: loose 7%, but the last **852 s** (20:33→34:46) reveal nothing new; autoplay still has 353 s + 230 s | **7** — loose: 34 s (11%), one 22-s stretch at 0:42–1:04 (saving for clipper #2); longest novelty gap 100 s (3:17→4:57). Stage: loose 4%; reveal gaps of 252–318 s at 16–30 min and 1,922 s after 83 min | n/a (no automation to buy; longest novelty gap 115 s) |
| **Cognitive load & progressive disclosure** | **4** — numbers on screen 9 / 19 / 36 / 41 / 63 / 78 / 97 at 0/1/3/5/10/20/end; interactive 3 / 5 / 9 / 11 / 18 / 16 / 16; 4 columns + Developments log + console. 2:34 drops two panels, 5 buttons and 7 numbers in one beat; 5:36 adds three unexplained Focus buttons with the Training panel | **7** — numbers 10 / 12 / 15 / 30 / 26 / 29 / ~49 (pre-HypnoDrones); interactive 5 / 6 / 6 / 11 / 10 / 12 / 24; 2 columns. One lump at 4:57 (5 buttons + 3 projects), otherwise one element at a time | 10 — 1 number, ≤ 4 buttons, every line explained by the preceding line |
| **Cadence of reveals** | **5** — panels at 0:01, 0:06, 0:18, 2:34, 2:34, 5:36 then none for 20–29 min (N ≈ 1 min for 5.6 min, then N = ∞). New projects every ~1–2 min from 2:34 to 15:04, then exactly one (datacenter) in the last 14–20 min | **7** — panels 0:02, 4:57, 41:56, 45:02, 67:28 (N ≈ 15 min); projects every 2–4 min from 5:18 to 45 min sustained (N ≈ 2.5 min), then every 4–8 min to 83 min | 8 — new noun every 30–60 s for 3 min (fire, stranger, forest, wood, builder) |
| **Greyed-out goal always on screen** | **9** — 98.7% of first-5-min snapshots (nothing for the first 6 s), 99.8% whole stage; but for the final 14 min the only goal is one $250k item | **10** — 100% (Marketing $100 and Wire $26 are grey from second 0; "+1 Trust at N" from 4:57) | 9 — 96.6% (stoke/gather cool-downs) |
| **Clarity of stage transition** | **4** — console is wiped to blank for ~1–2 s, then one line "Ground broken outside Abilene."; Compute panel silently replaced by Infrastructure (3 new grey buttons); three unbought projects (Enterprise sales team, Alignment team, Distributed training) vanish; no modal, no pause, no stat change the player can read except $250k gone and tasks/sec ×10 | **8** — four console lines of narration kept in view ("Releasing the HypnoDrones / All of the resources of Earth are now available / Full autonomy attained in 7 seconds"), Business panel removed, Clips/sec drops to 0, "Release" blinks in the header; destructive and legible | n/a |
| **Soft-locks found** (count / severity) | **6** — 0 hard locks; 6 dead-end/clarity defects (see §4): manual button disabled at power 0, rescue modal fires at 0 tasks, no price cap + misleading "saturated" line, research wall with a repeated nag, unconfirmed release with an un-attributed incident, carried-over research wall into Stage 2 | **8** — 0 hard locks; classic wire-out rescued in ≤ 5 s; 2 minor dead ends (no price cap → zero sales with no message; reload loses ≤ 25 s) | n/a |

Overall: **Takeoff 5.6 / Paperclips 7.9** (unweighted mean).

---

## 4. Soft-locks and dead ends

### Takeoff (`softlocks-takeoff.md`, `softlocks2-takeoff.md`)

1. **Power 0 kills the manual verb.** Spend everything on GPUs: power hits 0 at 82 s with 19 GPUs
   and $3. At that instant *Complete Task*, *Rent GPU* and *Buy Power* are all disabled (the only
   enabled buttons are lower/raise). Nothing on screen says why the main button died; the console
   says "Funds exhausted — power cannot be bought." 10 s later and "Power exhausted — copies idle."
   only in some runs. Recovery exists (unbilled tasks keep selling; the idle guard sends a $25
   "Customer Writes" modal every ~70 s; `p_beg_power` "Ask the cloud provider for credit (1 Trust)")
   so it is not a hard lock, but the player's one guaranteed action is removed exactly when they
   are confused. Source: `ui/render.ts:74` `setDisabled('btn-task', s.stage < 2 && s.power < 1)`;
   `engine/economy.ts:225`.
2. **Rescue fires on a player who has done nothing.** Idle 3 minutes on a brand-new game: at ~90 s
   a modal "A Customer Writes — *Your model saved our quarter*… $25" appears with 0 tasks
   completed and no Business panel. `engine/events.ts:192` `idleGuard` has no "has played" gate
   and no dependency on anything being on screen. The same modal is the generic rescue for every
   stall and pays `max(25, 45 × rev/s)` — late in the stage that is $14,710–$19,377 of free money
   with no explanation (it fired at 30:41 and 30:10 in two traces, shortening the datacenter
   save-up).
3. **No price ceiling, misleading diagnosis.** 200 raises → $2.25, demand 10%, revenue 0, 847
   unbilled; the console prints "Demand saturated — lower the price or market." (the advice is
   right, the word *saturated* is wrong for a 10% demand). `economy.ts:255` `raisePrice` has no
   cap. Paperclips has the same missing cap but at least its demand number reads 4%.
4. **Research wall with a nag.** Ignore research for 15 minutes: Trust accumulates to 10 (unspent),
   *Training Pipeline* stays grey for the whole run because research caps at 1,000 until Expand
   Lab, and "Research at capacity. Lab space is full." prints 6 times. The fix (spend Trust on
   Expand Lab) is never named.
5. **Release with open issues: no confirm, no attribution.** Eval found 2 issues; button reads
   "Release (2 open)", no tooltip; clicking releases immediately. 160 s later: "Incident: an agent
   deleted a customer database. Demand down 30%." Nothing links the incident to the skipped
   red-team; the Developments entry at that moment is an unrelated scheduled line.
6. **Wall carried into Stage 2 (flagged, out of scope).** At the transition the Training panel reads
   "Train Sage-3.3 — Cost 16,000, 33,554 research" against "Research 2,586 / 28,000", Trust 0,
   "+1 Trust at 1,597,000 tasks", Hire/Expand grey: the research/training loop enters Stage 2
   already dead.
7. Not locks, but tedium: 367 Buy Power presses in 34:46 (one every 5.7 s); 40 in the first 10
   minutes; auto-buy (Grid Contract, 7,000 research) arrives at 9:49–11:04. Reload mid-training:
   **works** (resumed at 13% with the correct remaining time; console and panels restored).
   Weird order (power before GPUs): 13,800 kWh stockpiled, no nudge, no lock.

### Paperclips (`softlocks-paperclips.md`)

1. **Classic wire-out — handled.** Price $0.01, 1,000 clips, wire 0, $2.27 < wire $18, before 2,000
   clips: the moment inventory reaches 0 the game prints "Trust-Constrained Self-Modification
   enabled", reveals Projects early, and *Beg for More Wire (1 Trust)* is clickable within 5 s;
   trust may go negative so it never fails (`projects.js:38–40`, `main.js:2716`).
2. **Absurd price → zero sales, no message.** $2.25 with 5 clippers: demand 4%, `floor(0.7·0.4^1.15)=0`
   clips per sale event, so nothing ever sells; wire runs out; *Beg* cannot trigger (requires
   unsold < 1). Player must notice and lower the price. Dead end, obvious fix, no copy.
3. Reload loses ≤ 25 s (autosave cadence); idle 3 min from start: nothing happens, no prompt.

---

## 5. THE SINGLE BIGGEST GAP

Takeoff's Stage 1 ends with a 10–14 minute dead tail. In all four full traces (three with the
first-timer policy, one with the game's own Autoplay bot) the last stretch before the datacenter
contains no new panel, button, project or modal: 20:33→34:46 (852 s), 18:44→30:10 (686 s),
21:10→24:29 + 24:29→30:41 (199 s + 372 s), and even Autoplay 13:54→19:47 + 19:47→23:37 (353 s +
230 s). In that window the only greyed goal is "First Datacenter ($250,000, 18,000 research)";
the research loop is explicitly walled ("The Research Plateau — the next run needs 8,192 research.
The lab holds 8,000." at 17:07, again at 20:24 with 13,107 vs 10,000), Trust sits at 0 with "+1
Trust at: 377,000 → 987,000 tasks" so Hire Researcher and Expand Lab are grey for 20 minutes, and
the money loop is a count-up from ~$90k (Series A at ~14 min) to $250k at $15–20k/min while the
player presses Buy Power every ~6 s and re-buys the one repeatable project (Custom model contract
×4, "Contract signed. The fine-tune ships next week." ×6, no visible effect). Paperclips fills the
equivalent 15–45 minute window with a new project every 2–4 minutes (Optimized AutoClippers 11:12,
WireBuyer 13:02, Microlattice 14:00, Creativity→Limerick→Algorithmic Trading 16:12–16:46, Spectral
Froth 25:40, New Slogan 30:58, Combinatory Harmonics/Catchy Jingle/Quantum Computing/Hypno Harmonics
33:52–34:18, HypnoDrones 35:20, Hadwiger/MegaClippers 39:32–39:44, Investments panel 41:56, Quantum
panel 45:02), each one cheap enough to land every few minutes of the current income. Actionable
fix: between Series A and the datacenter insert a ladder of three or four purchases a quarter of the
price apart that each change a number the player can see (e.g. "Reserve the Abilene site $40k →
Interconnect queue $80k → Substation $120k → Break ground", each with a console line and a
Developments entry, the last one *being* the transition), raise the research cap once at the
plateau so one more training run lands in the tail, and put a Trust milestone at ~500k tasks so
Hire/Expand come back once. Target: no reveal gap over 180 s anywhere in Stage 1.

---

## 6. Secondary gaps (priority order)

1. **Power is a chore, not a decision.** 367 Buy Power presses in 34:46 (one per 5.7 s), 40 in
   the first 10 minutes; Paperclips' wire is 9 purchases in 10 minutes, 58 in 56 minutes, and
   WireBuyer is on screen at 13:02. Grid Contract (7,000 research) shows at 5:24 and is bought at
   9:49–11:04. Fix: sell power in blocks that scale with GPU count (1,000 → 10,000 kWh), or price
   Grid Contract at ~2,000 research / $200 so it lands by minute 5; keep Buy Power as the manual
   fallback.
2. **Public Demand % is illegible.** In the first 5 minutes the policy watched "Public Demand" go
   96% → 266% while Unbilled Tasks grew 97 → 2,363 and had to cut the price from $0.28 to $0.09;
   "Demand saturated — lower the price or market." printed 7 times in a run, including at $2.25
   with demand 10%. Paperclips' 32% + "Unsold Inventory" is readable at a glance. Fix: show the
   two rates side by side ("Billing 72/s of 112/s produced") or clamp the display at 100% and add a
   one-word state (backlog growing / selling out) next to the price buttons.
3. **Two disclosure spikes.** At 2:34 the Research and Projects panels arrive together: 2 panels, 5
   buttons, 7 numbers (Trust, +1 Trust at, Researchers, Lab Space, Research x/1,000, a project
   cost) in one beat — numbers on screen go 24 → 36. At 5:36 the Training panel brings three Focus
   buttons (Capability / Efficiency / Safety) with no text about what they do, plus "12 GPUs
   wanted · est. 60 s". Paperclips at the same minutes shows 15 and 30 numbers. Fix: reveal
   Research (Trust + Hire Researcher only) at the trust milestone, Projects 30–60 s later on the
   first affordable project, and hide the Focus row until the second training run.
4. **Copy repeats and contradicts itself.** "Milestone reached: TRUST INCREASED" ×10 in a run
   (Paperclips' line says what you got: "additional processor/memory capacity granted"); the console
   shows "Trust: 0" for 20+ minutes while the two Trust buttons sit grey; "A Customer Writes — your
   model saved our quarter" at 0 tasks; the stage transition **erases** the console history
   (`state.ts:396 blackout`) and prints a single unexplained line two seconds later, while the
   Developments log — not the console — carries the actual news ("OpenMind owns its first
   datacenter"). Fix: milestone lines should state the reward; gate the idle guard on `tasks > 0`;
   keep the last four console lines through the transition and print 2–3 lines of consequence
   (what was lost, what replaced it, what the new number means).
5. **The transition is destructive without saying so.** Enterprise sales team, Alignment team and
   Distributed training disappear from Projects un-bought; Compute (Buy Power, Grid, Rent GPU) is
   replaced by Infrastructure whose three buttons are all grey ($375k / $40k / $300k) against
   $16k–$91k of remaining funds; tasks/sec jumps ~10× (1,030 → 12,186) with no line explaining
   why. Paperclips kills the Business panel just as hard but narrates it in four lines and leaves
   a blinking "Release". Fix: a one-line "Projects moved to the new site: X, Y, Z" or carry them
   over; a Developments entry that explains the GPU count and the power unit change; make at
   least one Infrastructure button affordable on arrival.

---

## 7. Verdict

| Rubric item | Winner | Margin |
|---|---|---|
| Time to first meaningful choice | Paperclips | 0:40 legible price decision vs 1:04 power-vs-GPU with an opaque demand number |
| Nothing-to-do | Paperclips | both busy early (Takeoff's 8-s max stretch is actually tighter than Paperclips' 22 s), but Takeoff's 852-s tail vs Paperclips' steady 2–4 min project cadence through minute 45 |
| Cognitive load / disclosure | Paperclips | 15 vs 36 numbers at 3 min, 26 vs 63 at 10 min; one spike vs two |
| Cadence of reveals | Paperclips | sustained N ≈ 2.5 min for 45 min vs N ≈ 1 min for 15 min then nothing |
| Greyed-out goal on screen | Tie (Paperclips by 1) | 100% vs 99.8%; Takeoff's tail goal is a single $250k item |
| Clarity of transition | Paperclips | narrated and kept vs wiped and silent |
| Soft-locks | Paperclips | both rescue the classic stall; Takeoff removes the manual verb and misfires its rescue |
| **Overall** | **Paperclips, clearly** | Takeoff's first 6 minutes are competitive (six panels, a project every minute, 8-s max idle); minutes 15–35 are not a Stage 1, they are a loading bar |

What is measurably good in Takeoff: first automation at 0:08 (Paperclips 0:18–0:40); 99.8% of
snapshots show a greyed goal; longest idle stretch in the first 5 minutes is 8 s; five modal
choices with real options in the middle 10 minutes (Paperclips has none); reload mid-training
restores the exact timer; the dead-end rescues all work. Everything else above the fold of minute
15 needs the same discipline applied to minutes 15–35.

---

## 8. Re-running

```
cd /tmp/critic/pw
node run.js takeoff    /tmp/critic/takeoff-final --realtime 300 --accel-minutes 60
node run.js paperclips /tmp/critic/pc-final      --realtime 300 --accel-minutes 60
node run.js paperclips /tmp/critic/pc-accel      --realtime 0   --accel-minutes 120
node run.js takeoff    /tmp/critic/takeoff-autoplay --realtime 0 --accel-minutes 60 --autoplay
node run.js adr        /tmp/critic/adr           --realtime 300 --accel-minutes 5.1
node analyze.js /tmp/critic/<prefix>          # first-5-min, gaps, cognitive load, actions
node transition-takeoff.js; node transition-paperclips.js
node softlock-takeoff.js; node softlock2-takeoff.js; node softlock-paperclips.js
```

Outputs per run: `<prefix>.snaps.json` (2-s snapshots), `.events.json` (reveals / enabled
transitions / console lines), `.actions.json`, `.summary.md`, `.t<N>.png` screenshots,
`.transition.png/.txt`. Paperclips must be served from `/tmp/critic/paperclips/docs` on :8734
(`tmux` session `paperclips-server`). Run one browser at a time.
