# Takeoff — Stage 2 ("Scale") vs Universal Paperclips — Stage 2 · critic round 2

Reviewer brief: fresh context, no design docs read, live source tree not read. The build under
review is the frozen copy `agent-tools/snapshots/s12-r4/`; its source was opened only for its
`README.md` (dev overlay, `window.__game`, presets, the simulator's flags), the element ids in
`index.html`, the state field names in `src/engine/state.ts`, and one cause
(`src/data/stage2.ts:108–111`, the reveal rule behind a wrong console line). Everything below was
measured by driving both games in headless Chrome with the harness in `tools/critic/`: the scripted
"curious first-time player" (adjusted for this build, §1), the same player exactly as the harness
shipped it, Takeoff's own Autoplay bot, then 51 play styles on three seeds each (153 runs), 19 new
scripted probes, the 13 probes of round 1's explorer, 2 of the older explorer and the 3 canned
ones, three played arrivals and two exits; on Paperclips, one re-run of the reference (identical to
the stored baseline) and round 1's variants, probes and transitions, reused.

Scope. **Takeoff Stage 2**: from dev preset 2 to the click on `Let Sage-3 write the code` —
41:24–42:50 for the round-2 first-timer, 36:40–39:56 for the first-timer as the harness shipped it,
34:56–36:28 for the bot. The arrival was also played from a new game on this build (Stage 1 → 2 at
26:36 / 30:26 / 27:28, seeds 1–3). **Paperclips Stage 2**: from the fixture just after `Release the
HypnoDrones` to `Space Exploration`, 135:46.

**Result: Takeoff 7.9, Paperclips 6.7 (round 1: 7.4 and 6.7). Takeoff wins five rows of the fixed
rubric (a, d, e, f, g), ties two (b, c) and loses none. The single biggest gap: one purse pays for
the run, the lots, the plants, the halls and the cards, so the build ships a governor that decides
what each dollar is for — it greys the lot rows for 53–58% of the stage — and what it leaves lit
either does not move the stage or moves it the wrong way (§7).**

All raw data is in `agent-tools/critic-out/` (`s2r2-tk-*`, `s2r2-pc` = rubric runs; `s2r2-x-*` =
this round's play styles and probes; `s2r2-transition-*`, `s2r2-softlock-*`, `s2r2-s2x-*`,
`s2r2-ex-*` = the harness's own probes and older explorers on this build). §11 says how to re-run
each and lists every harness change.

---

## 1. Method and definitions

### Harness

* `run.mjs` / `explore-s2r2.mjs <style>`: phase 1 = real wall-clock play (300 s in one Takeoff
  run), phase 2 = deterministic 2-s game-time steps to the stage end or the cap. A snapshot every
  2 s records every visible button / card / slider / panel (enabled or greyed, with the reason
  printed beside a greyed button), the console and Developments lines, any event, the count of
  numeric tokens on screen and the game's metrics; the round-2 explorer adds the text of every
  Infrastructure row, the Train row, the meters as drawn, and the fleet against the GPUs the game
  itself counts as powered.
* **Reproduction.** Paperclips Stage 2 re-run under `s2r2-pc`: 135:46, 1,029 events and 2,689
  actions, identical to the stored `pc-s2`. The Takeoff run with 300 s of real time is identical to
  the stepped seed 1, action for action (824) and event for event (714): nothing in Stage 2
  depends on sub-2-second timing. The whole play-style matrix was run twice (before and after the
  last edit of the explorer): every stage end and every measure identical.
* A second Takeoff trace uses the game's **Autoplay** bot (the designers' "reasonable player").

### The first-timer on this build — what had to be adjusted

The harness's Stage 2 rules were written for a build with one lot row whose greyed reasons read
"no power" / "no room" / "standing order". On `s12-r4` the lot row prints reservations instead, and
the shipped first-timer does not understand them: from 1:02 to 3:00 it stands beside a lit `Gas
turbines (+20 MW) $144,000 runs 20,000 GPUs · now` while the lot row reads `the plant first`,
pressing `Buy GPUs (100) $12,000 … keeps the next plant's price`, and buys the turbine only when
the row reaches `No power for them: 0 MW free. Gas turbines add 20 MW.` A first-timer who reads the
row would press the turbine. Two adjustments, both in my own file (`explore-s2r2.mjs`; no shared
code changed):

1. **The lot row's new wordings are read as what they say.** `No power for them…` or `the plant
   first` → the enabled power source with the lowest shown $/MW; `No room for them…` or `the hall
   first` → Build Datacenter; `the run first`, `<card> first`, `the offer first` → nothing to press.
2. **All three lot rows belong to the infrastructure rule** (largest enabled row first, the main
   row's shrunken lots included, up to three purchases a check, as before); the shipped rules left
   the 5,000 and 25,000 rows to the generic sweep.

Everything else is the README's first-timer: Train the moment it is enabled (the build has no
partial run to choose), red-team to zero, release publicly, first enabled option of an event, every
card the moment it is affordable, every setting left where it was found (Standing order 50%, slider
15%, Focus on Capability). This is the **control**. The shipped first-timer is kept as the play
style `shipped` and reported beside it, because the developers tuned the build against it (their
simulator's `trainfirst`) and round 1 set its targets with it. They differ by one habit — the
control builds when the row says `… first`, the shipped player only at the hard wall — and that
habit is worth 3:43 (§5).

### Definitions

Unchanged from round 1 (reveal, enabled transition, nothing-to-do (loose), novelty gap, reveal gap,
greyed-out goal on screen, cognitive load, first meaningful choice, decision gap, hands-idle gap,
affordable things, pipeline state). The hands measures are computed by `explore-s2r2.mjs hands`,
which reproduces round 1's numbers on round 1's runs (`s2x-baseline`: no enabled purchase 85.4–87.5%,
two or more 4.9–6.6%, ≥ 30-s gaps 50.4–55.2%; `pc-s2`: 0.6%, 97.1%, 27.7%, 19.5 clicks a minute).
Added this round:

* **Lot-row state** — at each 2-s check, whether the main lot is enabled at 1,000, enabled
  shrunken (hundreds), or greyed, and with which printed reason.
* **Train-gate account** — at each check where Train is on screen and greyed, which requirement
  the row names (GPUs, GPUs dark, money, research, data, a wait), in how many stretches, the
  longest, and whether a lot, a plant, a hall or a data card was enabled meanwhile.
* **Dark GPUs** — fleet minus the GPUs the game counts as powered, and what the power row says.

### Where a number is the policy, not the game

* **The control never saves, and on this build that sets the opening.** It buys a lot, a card, a
  plant or a hall the moment one is lit, so its first run starts at 6:12 and its first model ships
  at 7:20–7:40. The same player holding cards back while the Train row says "short" ships it at
  2:06–2:16, the shipped first-timer and the bot at 3:12–3:22, a player who buys nothing and
  releases the moment the evaluation ends at 1:34. Every figure that depends on it is given for
  the control and for the shipped first-timer; §5 gives the disciplined variants.
* **It presses whatever lot is lit, up to three times a check**: 663–798 lot presses a stage,
  428–473 of them in hundreds. A human would not; `lot-full` is the same player without the
  hundreds (60–140 lot presses). Paperclips' first-timer has the same bias (1,724 single Wire
  Drone presses; a human uses the bulk buttons).
* **"Two or more distinct things affordable" counts lit plants and halls that the player's rules
  leave alone** (the README's known limit). The control leaves them until the lot row asks
  (24.8–29.6%), the shipped first-timer until the hard wall (46.8–53.5%). §5 separates what is lit
  from what is worth pressing.
* **Paperclips' length is not an artifact of one rule** (round 1: 127:26–135:46 across five
  variants of its player); its re-run is identical, so its rows are scored on the same evidence.
* **The Stage 2 preset is the bot's Stage 1 exit, not the first-timer's.** The preset lands with
  Sage-1.5 at 1.77×, $121,000 and a $154,488 run that needs 800 GPUs; the first-timer's own arrival
  lands with Sage-1.4 at 1.55–1.61×, $123,665–$153,066 and a $60,854–$81,821 run that needs 50–640
  GPUs. The arrival rubric row uses the played ones (§2d, §3f).
* The bot answers events and buys inside ticks, so its click gaps and event waits are not
  comparable. Stepped screenshots catch the 0.8-s fade-in half-way.

### Runs used

| label | what |
|---|---|
| `s2r2-tk-rt` | Takeoff Stage 2, control, 300 s real time + stepped to the stage end (41:34), seed 1 — primary |
| `s2r2-x-baseline[-seed2,-seed3]` | control, stepped, seeds 1–3 (41:34 / 41:24 / 42:50) |
| `s2r2-x-shipped[-seedN]` (≡ `s2r2-s2x-baseline[-seedN]`, `s2r2-check-ft`) | the first-timer as shipped (38:04 / 39:56 / 36:40) |
| `s2r2-tk-auto[-seedN]`, `s2r2-x-bot[-seedN]` | the game's Autoplay bot (36:28 / 35:00 / 34:56) |
| `s2r2-pc` (≡ `pc-s2`), `pc-s2-rt`, `s2r1-pc-*`, `s2x-pc-*` | Paperclips Stage 2 (135:46), its first 5 minutes in real time, round 1's fairness variants and probes |
| `s2r2-transition-takeoff-s1[-seed2,-seed3]`, `s2r2-transition-takeoff-s2`, `s2r2-x-exit` | Takeoff arrival (played from a new game, three seeds) and exit (canned, and held 30 s) |
| `s2r1-transition-pc-s1`, `pc-s2.transition.*` | Paperclips Stage 1 → 2 and 2 → 3 (round 1's, reused) |
| `s2r2-softlock-takeoff-s2`, `s2r2-s2x-<probe>`, `s2r2-ex-*` | the canned dead-end probes, round 1's 13 probes and the older explorer on this build |
| `s2r2-x-<style>[-seedN]` | 51 play styles × 3 seeds (§4, §5); `s2r2-x-table.md` |
| `s2r2-x-<probe>` | 19 new probes (§4–§6) |

---

## 2. Reveal timelines

### 2a. Takeoff — first 5 minutes (`s2r2-tk-rt`, real time; identical to the stepped seed 1)

| t | event |
|---|---|
| 0:00 | Stage 2 screen: Developments · a **stores** box ("funds $ 121,000.00 / research ｢￭￭￭￭￭･････｣ 26,250 / insight 31 / trust 2 / GPUs ｢￭･････････｣ 1,000 / power ｢￭￭････････｣ 5 MW — *runs 5,000 GPUs* / copies 1,250") · Business ("Avg. Rev. per sec: $ 2,786.00", "Price per task: $ 0.31 *(auto)*", "Release hype: strong") · Infrastructure ("Buy GPUs (1,000) $120,000 *uses 1 MW of 4 free · +$362/s*") · Research (Hire Researcher, Expand Lab) · Projects (empty) · Training ("Current model: Sage-1.5 · 1.77×", "Ahead of Anthrosoft", Focus: Capability *+12% capability* / Efficiency *copies ×1.15* / Safety *alignment +8*, "The biggest step per run; Efficiency's copies pay for the next runs sooner.", "Train Sage-1.6 Cost: $154,488, 35,000 research / Needs 800 GPUs for 1:00 / *short 8,750 research — about 0:26*") |
| 0:02–0:10 | the five arrival lines (§2d) |
| 0:02–1:32 | a card every ~15 s: Alignment team (34,000 research), Hire a recruiter ($420,000), Agent mode (35,000 research), Publish a safety framework (35,000 research), Workshop paper (100 insight), Research cluster ($144,000), Standing order ($420,000, 30,000 research) |
| 0:32 | `Power draw is 60% of the site's 5 MW. Gas turbines can be on site in a week.`; rows "Buy GPUs (5,000) $600,000 *No power for them: 2 MW free. Gas turbines add 20 MW.*" and "Gas turbines (+20 MW) $144,000 *runs 20,000 GPUs · now*"; the main lot now reads "*the plant first*" |
| 1:02 | turbine bought (`Gas turbines online. +20 MW. The county has questions.`) |
| 1:34 | Solar + storage (+50 MW) row (`Solar + storage: cheaper power, but it waits in the interconnect queue.`) |
| 2:16–3:36 | Build Datacenter (+15,000 slots) row; lot row "*the hall first*" (2:40); bought 3:34 (`Datacenter 2 — 1:30 until the halls are ready.`) |
| 3:02 | Web crawl (15,000 research) bought at first sight; a "data" row joins the stores |
| 4:32 | **Capability panel** (graph of Sage, Anthrosoft, Baiwen; "Next: superhuman coder at 4.00×", "Baiwen: about 4 months behind") — brought by the rival's release (`Anthrosoft ships Cadence-6. Sage is still ahead.`), not by the player's |
| the Train row | "short $146,189 — about 0:49" (0:02) → "short 33,725 research — about 1:36" (0:26) → "short $142,836 — about 0:29" (1:34) → research (2:06) → "short $132,376 — about 0:22" (3:58) → research (4:22). **No run started in five minutes.** |

Policy actions in those 5 minutes: 106 clicks — 91 GPU lots (one of 1,000, ninety in hundreds), 8
Hire / Expand, 5 cards (three of them priced 34,000–35,000 research against a 35,000-research run),
1 gas turbine, 1 datacenter. GPUs 1,000 → 11,400, revenue $2,786/s → $6,559/s, no model trained.
The shipped first-timer starts the run at 2:04 and ships Sage-1.6 (1.95×) at 3:12; the bot at 2:10
and 3:14.

### 2b. Takeoff — whole stage (`s2r2-tk-rt`, 41:34; cross-checked against seeds 2–3, the shipped first-timer and the bot)

| t | event |
|---|---|
| 5:44–5:48 | event *A Senate Hearing* (59 s) → **Government panel** ("Relations: 56 (cordial) *at 60 reactors cost a quarter less*"); Policy team ($600,000, 2 Trust) |
| 6:12–7:20 | first run of the stage (`Training Sage-1.6 on 800 GPUs; 13,600 keep serving.`); "Buy GPUs (25,000) $3.0M" row (6:26); Sage-1.6, 1.93× (7:20) |
| 7:24–9:30 | AI research assistants bought (7:54) → **allocation slider** ("Copies on research: 15%" over a "Human share of research" line); Series B (free); Mixture of experts, Agent platform, Security level 2, Conference keynote; event *Release Sage-2* (9:10, 89 s) → Sage-2, 2.11×; Standing order bought (9:30: `Standing order placed. GPUs arrive when there is room, power and cash.`) and its "50% of income" button |
| 11:30–13:40 | Keep internal button; Sage-2.1, 2.29× (11:42); Publish the Spec, Automated evals; event *Can I try something?* (13:26, 20 s); Nimbus G5 order; **Public panel** (13:30: "Approval: −2", "Jobs displaced: … *by the copies' tasks*"); International launch |
| 13:40 → 15:56 | 136 s with no new element; Sage-2.2, 2.53× (14:22); Train "short 1.3 T data" (14:22–15:58) with no card on screen that sells data |
| 15:56–17:22 | event *The Publishers* (90 s; all three lot rows read "*the offer first*"); **Security panel** (16:20), Synthetic data; Job-transition fund toggle; Parallel pipelines; Free tier for students |
| 19:02–21:46 | event *A Month of Evals* (43 s); Nuclear PPA (+500 MW) row (19:32); License the code hosts (19:46, drawn urgent); Experiment scheduler; Sage-2.3, 2.75× (20:44, **6:22 after the last release**); Long-horizon memory, Distillation; event *Al-Marsa* (21:32, 89 s); Behind-the-meter |
| 21:46 → 25:04 | **198 s with no new element** — the longest of the stage |
| 25:04–26:24 | Brief the administration; Sage-2.4, 3.03× (25:08); the gate card, pinned: **"Let Sage-3 write the code (needs a 4.00× model, public or internal) / Every engineer becomes a manager of copies. Hiring, marketing, data and Trust end here."**; event *The Pentagon Calls* (25:12, 89 s); Dashboard; "Air-gap the weights" button; **Stats panel** (26:24: "Lead over Baiwen: 2.5 months", "Alignment (as measured): 70") |
| 26:24 → 28:34 | 130 s with no new element |
| 28:34–32:08 | Data flywheel; event *4 a.m.* (28:54, 59 s); Sage-2.5, 3.29× (29:26); Honesty evals; event *A Joint Statement* (31:24, 89 s); Share evals toggle; Series C (free) |
| 34:06–40:26 | Sage-2.6, 3.57× (34:06); "Alignment compute: 1%" button (35:26); Sage-2.7, 3.81× (37:20); six cards at $30.0M–$144.0M (Retire human code review, Sage-3 system card, Nimbus G6 pre-order, Second campus: New Carlisle, Community benefits agreement, Counter-offer for the alignment lead) and Checkpoint farm |
| 41:04–41:36 | `Outside evaluation — 0:30 until Sage-3 can ship.` → `The outside evaluators sign off. Sage-3 can ship.` → Sage-3, 4.11×; the gate card reads "(ready)"; clicked → Stage 3 |

Shape of the stage in the nine rubric traces (control ×3, shipped ×3, bot ×3): nine to eleven
training runs; five new panels (Capability 3:12–4:32, Government 5:46–9:26, Public 11:54–13:34,
Security 15:16–18:58, Stats 21:32–27:24) and then none until the gate; 34–42 cards (median gap
28–44 s); eight or nine events from 5:44–7:04 to 28:22–34:06 (150–256 s apart in the control) and
none in the last three to ten minutes; a new control or mechanic about every three minutes to the
end (5,000 row and turbines 0:30, solar 1:34–3:32, halls 2:16–3:52, slider 3:46–8:10, Standing
order 6:24–10:52, Keep internal 8:40–12:48, 25,000 row 6:26–11:04, job fund 16:22–28:16, nuclear
17:32–19:46, air-gap 25:36–29:24, share evals 28:22–34:06, alignment compute 31:34–38:48); reveals
per five minutes 13–18, 11–16, 7–10, 5–10, 3–9, 4–9, 4–7, 1–6. Release intervals from the arrival:
control 7:20–7:40 then 1:52–6:22; shipped 3:12–3:22 then 2:16–5:50; bot 3:14–3:22 then 2:16–5:52.

### 2c. Paperclips — Stage 2 (`s2r2-pc` ≡ `pc-s2`, 135:46; unchanged from round 1 §2c–2d)

| t | event |
|---|---|
| 0:00–0:20 | Manufacturing ("Clips per Second: 0"), Computational Resources ("Operations: 70,000 / 70,000"), Strategic Modeling; five ops-priced cards, **Power Grid (40,000 ops)** among them; the first-timer buys two strategies first |
| 4:22 | Power Grid → **Power panel** and Nanoscale Wire Production in one beat (+15 numbers, +8 controls) |
| 6:18–11:00 | **Wire Production panel**; Harvester and Wire Drone buttons (first drone 7:44); Clip Factory (first factory 11:00; production resumes) |
| 13:10–22:00 | Swarm Computing (12,000 yomi), four world-fixing cards, drone flocking, Momentum |
| 22:00 → 38:28 | 988 s with no new element; 38:28 **Swarm Computing panel** (Work / Think slider) |
| 38:28 → 75:06 | **2,198 s with no new element**; "Clips per Second: 900.00 billion" from 20:00 to 75:00 |
| 75:06–117:42 | Upgraded and Hyperspeed Factories, two flocking upgrades, AutoTourney, Self-correcting Supply Chain |
| 119:56 | "Available Matter: 0 g" → **Space Exploration (120,000 ops, 10,000,000 MW-seconds, 5 oct clips)**; 124:56 Entertain the Swarm; 135:46 bought |

2,651 clicks, 2,174 of them Wire Drone and Harvester presses.

### 2d. On the screen

* **Minute 0** (`s2r2-tk-rt.t0.png`): four columns and the stores box. The two walls of the stage
  are now two **ten-cell bars**: "GPUs ｢￭･････････｣ 1,000" and "power ｢￭￭････････｣ 5 MW", with one
  sentence under the power row — "*runs 5,000 GPUs*". The fill reads at a glance. What does not:
  the two numbers beside the bars mean different things (the GPU row prints the **stock**, its bar
  is stock ÷ slots and the slot count is nowhere on screen; the power row prints the **capacity**,
  its bar is draw ÷ capacity and the draw is nowhere on screen), so "how many more fit" — which
  round 1's "GPUs 1,000 / 10,000 · power 1.0 / 5 MW" answered — now takes a hover ("room for
  24,500 / power for 9,500") or counting cells. The research bar empties when a card or a run
  spends research.
* **The Train row** is the best-explained control in either game: "Train Sage-1.6 Cost: $154,488,
  35,000 research / Needs 800 GPUs for 1:00 / *short 8,750 research — about 0:26*". The wait has a
  name and a clock from second 0, and when the fix is a card the row names it ("needs 3.5 T data —
  License the code hosts", "short 46,025 research — about 2:06 — AI research assistants"). It
  prints one shortfall at a time, so in the opening it flips between "short $…" and "short …
  research" six times in six minutes.
* **The Infrastructure rows carry sentences** — return, draw, delay, reservation: "Buy GPUs (100)
  $12,000 *uses 1 MW of 2 free · +$42/s · keeps the next plant's price*"; "Buy GPUs (5,000)
  $600,000 *No power for them: 2 MW free. Gas turbines add 20 MW.*"; "Nuclear PPA (+500 MW) $27.0M
  *runs 500,000 GPUs · in two minutes · power is the wall · cheaper: good relations*"; "Build
  Datacenter (+75,000 slots) $1.7M *1:30 to build · room is the wall*". A full bar gets its fix
  beside it: "power ｢￭￭￭￭￭￭￭￭￭￭｣ 25 MW / *full · Gas turbines add 20 MW*", "GPUs ｢￭￭￭￭￭￭￭￭￭￭｣
  10,000 *the halls are full · Build Datacenter*". This is round 1's "wall hidden behind *standing
  order*" answered in full. The cost is words and wrapping: most rows run to two lines at 1280 px.
* **Minutes 5–41** (`s2r2-tk-rt.view1500.png`, 25:00): "funds $ 182,287.62"; "Buy GPUs (1,000)
  $264,000 *the run first*", "Buy GPUs (5,000) $1.3M *the run first*", "Buy GPUs (25,000) $6.6M
  *the run first*", "Standing order: 50% of income", greyed Build Datacenter (+125,000 slots) $3.4M,
  greyed Gas turbines $2.0M, Solar $1.2M, Nuclear PPA $36.0M, "Interconnect queue: solar farm —
  0:31"; "Evaluating Sage-2.4 …" above "Train Sage-2.5 Cost: $6.7M, 510,000 research, 10.2 T data /
  Needs 35,000 GPUs for 1:41 / *short $6.5M — about 1:22*"; four greyed cards. Live: Complete Task,
  the slider, "50%", Focus, one OFF toggle. It is round 1's 25:00 picture with captions: every grey
  thing now says why, and the why is "wait". Median over the stage: 12 greyed controls of 19, one
  enabled purchase (round 1: 15 and 0).
* **Gone since round 1**: lower / raise, Marketing, the AUTO toggle ("Price per task: $ 0.31
  *(auto)*" with the multipliers on hover), and the lead printed in three places (it is under the
  graph until Stats arrives, then only in Stats).
* **Focus** now prints its trade under each button ("+12% capability" / "copies ×1.15" / "alignment
  +8") and a note that changes with the selection: Capability "The biggest step per run;
  Efficiency's copies pay for the next runs sooner.", Efficiency "More copies: more money for runs,
  more jobs displaced.", Safety "Fewer issues on every later run; the slowest road to 4×."
* **The capability graph** still reads at a glance, and still overdraws its own goal: at the gate
  the series' markers sit on the "4× superhuman coder" label (`s2r2-x-exit-exit-ready.png`).
* **Events** (`s2r2-tk-rt.modal1…9.png`, `s2r2-x-event-keys-*.png`): unchanged in design and still
  the best element — title, three sentences, "89 s — then: release publicly", an effect line under
  every option ("keep it internal / research ×1.25 · lead +0.5 months · customers keep the old
  model"), a greyed option that says what it needs ("license the archives / needs $360,000"). Every
  event now has a timer with a harmless default. The panel (379 × 259–357 at 507, 120) no longer
  covers the stores; it covers the Research panel, the top of Projects and the left third of the
  Training panel, the Train button included.
* **Paperclips** (`pc-s2.t5…t20.png`, `.tpre.png`): three columns that hold still; each production
  box prints its rates beside its buttons ("Wire: 546.31 billion inches (873.74 billion inches per
  sec)", "Consumption: 2,265 MWs / Production: 2,300 MWs"); nothing is explained; the mirror's
  debug buttons are excluded from every count.
* **390 px** (`s2r2-x-mobile-shots-*.png`, `s2r2-x-mobile[-seedN]`): no horizontal overflow in
  three full-stage runs and the probe; page 1.5 screens tall at 0:02, 2.8 at 10:00, 3.3 from 30:00;
  no button under 36 px tall (round 1: 15–21 of 19–25 under 32 px); events fit (374 × 357 at most).
  The order is stores (219–300 px), Infrastructure (402–483), Research, Training (594–1,103),
  Projects, and the Train button sits 0.9–1.5 screens down (751–1,259 px), the graph 1.7–2.3.
* **Arrival** (`s2r2-transition-takeoff-s1[-seed2,-seed3].tpre/.transition.png`). Before, on seed
  3: "Train Sage-1.5 Cost: $26,876, 22,000 research / ｢￭･････････｣ *Needs 640 GPUs. The cloud will
  rent 100. Build the First Datacenter.*" beside the pinned card "First Datacenter ($138,000) —
  *needed* / 1,000 GPUs of our own at Abilene. Stop renting." — the GPU requirement is the reason
  for the stage. After: five lines 2 s apart (`First Datacenter online outside Abilene.` / `The 75
  rented GPUs go back. Deposit returned: $120,000.` / `1,000 Nimbus G4s on 5 MW. Each MW powers
  1,000 GPUs; power is bought in megawatts now.` / `Tasks per second ×17: the copies run on
  hardware OpenMind owns.` / `Prices set themselves from here. Marketing ends; the market cards
  widen the market now.`), the stores box with its two bars, one lit lot. And one thing no line
  mentions: the same run now reads "Cost: **$81,821**, 22,000 research" (seed 1: $18,229 →
  $60,854; seed 2: $19,666 → $64,354).
* **Exit** (`s2r2-x-exit-exit-ready/-plus4s/-plus30s.png`): the pinned card goes dark — "Let Sage-3
  write the code (ready)" — and waits; after the click six lines 2 s apart, a Developments line for
  the retired cards and one for the meter (`Unspent Trust buys goodwill in Washington: relations 69
  → 71.`), 24 controls → 14, a new Alignment panel, and a Business panel that reads "Avg. Rev. per
  sec: $ 806,073.06 / Price per task: $ 0.022 (auto)". Paperclips' transitions
  (`s2r1-transition-pc-s1.*`, `pc-s2.tpre/.transition.png`) delete more and explain less, as in
  round 1.

---

## 3. Rubric

Scores 1–10, higher is better, same scale as round 1. Evidence beside each score. Takeoff's
numbers are the control's three seeds unless marked; "shipped" is the first-timer as the harness
shipped it.

| Rubric item | Takeoff — Stage 2 | Paperclips — Stage 2 |
|---|---|---|
| **(a) Time to first meaningful choice** (from the stage start) | **8** — second 0: "Buy GPUs (1,000) $120,000 … +$362/s" against "Train Sage-1.6 Cost: $154,488, 35,000 research … short 8,750 research — about 0:26" with "funds $ 121,000.00"; a return and a wait both printed; Focus with its trade under each button. Same shape on the three played arrivals (+2 s: one lit lot, Train "short 4,125–5,050 research — about 0:18–0:22"). First event with printed stakes and a timer at 5:44–5:46 (shipped 6:54–7:04, bot 6:30–6:46). The opening choice now weighs minutes, not seconds — the first model ships at 1:34 for a player who buys nothing, 3:12 at the wall, 7:20–7:40 for the control. Not higher: neither the lot nor the cards say what they do to the run, and the first advice the screen volunteers ("the plant first", 0:32) is worth minus four minutes (§5) | **6** — 0:00–0:20: 70,000 ops and five ops-priced cards with nothing saying which rebuilds production; first drone 7:44, first factory 11:00 ("Clips per Second: 0" until then); the first allocation choice with feedback at 9:04–11:00; the slider at 38:28 |
| **(b) Seconds with nothing to do** | **6** — loose: 96 s (32%) of the first 5 minutes, 654–728 s (26–28%) of the stage, longest stretch 30–32 s (round 1: 82–83% of the stage). No enabled purchase in 28.8–30.6% of checks (85–88%); no click for ≥ 30 s during 20.9–27.4% of the stage, longest 52–56 s (50–55%, 86–104 s). Longest reveal gap 150–198 s (2–4 over 120 s), novelty gap ≤ 74 s, decision gap ≤ 120 s, 113–131 non-drip decisions. Held at 6: 83% of the clicks are lot presses and 428–473 of them are hundreds lots that make the stage no shorter (§5); the game greys the lots for the run in 32–41% of the stage; Train is greyed for money for 40–48% of it and nothing lit shortens that wait (§7) | **6** — loose: 0 s; a drone or a tournament is always affordable, median five distinct things; no click for ≥ 30 s during 27.7% of the stage (longest 134 s); the first eleven minutes are the emptiest ("Clips per Second: 0", four waits of 108–134 s). Stricter measures are poor: 13 reveal gaps over 120 s covering 91% of the stage, the longest 2,198 s; novelty gap 800 s; 12 decision gaps over 120 s, the longest 934 s |
| **(c) Cognitive load & progressive disclosure** | **6** — numbers 34 / 47 / 52 / 62 / 78 / 74 / 76 / 88 at 0 / 1 / 3 / 5 / 10 / 20 / 30 / end (seeds 2–3: 68–72 at 10:00, 77–87 at 20:00); peak 97–99 during *4 a.m.*; controls 9 / 13 / 17 / 15 / 21 / 19 / 22 / 28, of which greyed 10 at 5:00 and 9–15 at every five-minute mark from 10:00; panels 6 → 11; words 121 → 226 (5:00) → 301–318 (10:00) → 347–382 (20:00) → 362–389 (30:00); 4.5 console lines and 1.5 Developments entries a minute. Staged (largest beat outside an event +8 numbers, +3 controls), every row and option explains itself, walls and waits are printed where the eye is, the dead controls of round 1 are gone and the event panel is off the stores. Against that: greyed controls are still the majority at most marks from 5:00 (10 of 15, 14 of 21, 14 of 22), two of the three lot rows are grey furniture for this player (the 5,000 row enabled in 1.2–2.1% of checks, the 25,000 row in 0.0%), rows wrap to two lines, the slider's trade and every rate are still hover-only | **6** — numbers 24 / 24 / 24 / 39 / 54 / 76 / 72 / 61; controls 11 / 11 / 11 / 19 / 29 / 32 / 33 / 31, nearly all enabled; panels 5–8; words 55 → 179 → 211 → 251 → 237–267; 1.6 console lines a minute; a layout that holds still. One lump (4:22: +15 numbers, +8 controls, +1 panel), stale cards after the arrival, nothing explained |
| **(d) Cadence of reveals** | **8** — 83–85 reveals in 41:24–42:50 (2.0 a minute; shipped 81–82, bot 76–77); five new panels by 21:32–27:24; a new control or mechanic about every three minutes from 0:30 to 31:34–38:48; 38–42 cards (median gap 28–44 s); nine events 150–256 s apart; 2–4 reveal gaps over 120 s (2.9–5.6 an hour), none over 198 s. Held below 9: the stream still halves after 10:00 (reveals per five minutes 13, 16, 7, 9, 5, 8, 5, 6), no event in the last ten minutes, and the last six cards cost $30.0M–$144.0M against $23.6M in hand at the gate | **5** — 64 reveals in 135:46 (0.47 a minute); three panels; 28 cards, 22 of them in the first 22 minutes; 13 reveal gaps over 120 s, the longest 2,198 s, 91% of the stage inside them; the stage goal appears at 119:56 |
| **(e) Greyed-out goal always on screen** | **10** — 100% of snapshots in every run. The Train row names the next step and its wait from 0:00 ("short $6.5M — about 1:22"); the stage goal is named from 3:12–4:32 ("Next: superhuman coder at 4.00×") and pinned as a card from 23:32–25:08 with what it ends | **9** — 100%; "Next Upgrade at: 10 Factories"; the stage's goal is not on screen until 119:56 of 135:46 |
| **(f) Clarity of the stage transitions** (arrival and exit) | **9** — *arrival* (three seeds): the reason is on the Train row ("Needs 640 GPUs. The cloud will rent 100. Build the First Datacenter."); five lines 2 s apart, each one change with its number, one of them the stage's rule ("Each MW powers 1,000 GPUs"); revenue $1,634 → $2,973/s, $1,066 → $2,206/s, $1,181 → $3,219/s thirty seconds in; one lit lot; no wrong line. *Exit*: the pinned card says what ends, turns dark and waits (30 s held, nothing nags); six lines 2 s apart; the retired cards and the meter change are narrated; no dead readout. Every exit defect of round 1 is gone. Not 10: the run on screen at the arrival triples in price at the click with no line ($18,229 → $60,854; $19,666 → $64,354; $26,876 → $81,821); gas, solar and the alignment-compute button vanish at the exit unannounced; "Air-gap the weights $48.0M, 3 Trust" stays, greyed, after `Trust is not a number any more.` | **8** — *arrival*: three lines at once, Business and Investments deleted, "Clips per Second: 0", nothing to buy, two stale cards, production back only at 7:44–11:00. *Exit*: the card says what it will do; every Earth control gone, two new panels, Launch Probe enabled; then `WARNING: Risk of value drift increased` five times in ten seconds, unexplained |
| **(g) Soft-locks found** (count / severity) | **8** — 0 hard locks in 9 rubric traces, 153 play-style runs and 37 probes; no page error in any; state identical after a reload in eight awkward moments; ten idle minutes safe at the start and mid-stage, thirty idle minutes without a Stage 1 rescue. Every self-inflicted stall names its wall and its fix in three or four places on screen (§4). Found: the Standing order stalls in silence (one seed: 54 minutes, $354M in hand); the hard gate turns three under-building styles from a limp into a stop at 2.42–2.79×; over-building costs 13 minutes and a late Train press 6, neither with a line; nine wrong, stale or contradictory texts (§8.8) | **7** — 0 hard locks. One silent dead end whose exit is unexplained (every clip into drones before the first factory); power-out silent ("Factory/Drone Performance: 0%"); five "Disassemble All" with no confirmation; a reload loses ≤ 25 s; the console says nothing in any of them |

Overall (unweighted mean): **Takeoff 7.9 / Paperclips 6.7** (55 and 47 of 70).

---

## 4. Soft-locks, dead ends and play styles

### Takeoff — canned probes (`s2r2-softlock-takeoff-s2.md`)

1. **Ignore research for 15 minutes** (never Hire / Expand): Trust 19 unspent; four runs by 13:46;
   Train never greyed by the lab cap; at 15:00 `Human share of research: 10%. Hiring stops; Trust
   goes to the lab and the capitol.` Over the whole stage never spending Trust is 1:40 *faster*
   (below).
2. **Release with open issues**: "Release (issues open)" → the *Release Sage-2* event → `Sage-2
   released. Sign-ups double overnight. No Trust: 3 open issues shipped.`; 178 s and 200 s later
   `Incident: a court cites a case Sage invented. Demand down 40% for 1:30.` / `Traced to an issue
   shipped in Sage-2.` **Attributed, and the cost now has a size and a length.**
3. **Reload mid-training**: 26%, 45 s remaining, before and after. **Exact.**

Round 1's own probes on this build (`s2r2-s2x-*.md`): `untimed-open` — "No untimed event within 30
minutes"; `idle-rescue` — the first event an idle player meets is the scheduled *A Senate Hearing*
at 12:22, with a timer, idle rescues 0; `auto-off-raise` — there is no AUTO button to press.

### Takeoff — play styles (`s2r2-x-<name>[-seed2,-seed3].explore.md`, `s2r2-x-table.md`; seeds 1 / 2 / 3)

| play style | Stage 2 ends | in what state, and what the screen says |
|---|---|---|
| **control** (round-2 first-timer); the same at 390 px | 41:34 / 41:24 / 42:50 | Sage-3 past 4.00× (4.11× on seed 1); government 67–70, approval −21 to −26, lead 2.7–2.8 months, alignment 67–71 shown (43–45 true); 490,000–615,000 GPUs; 0 px overflow |
| first-timer as shipped · builds only at the hard wall (control otherwise) | 38:04 / 39:56 / 36:40 · 37:36 / 39:58 / 36:42 | as the control; first model at 3:12–3:22 instead of 7:20–7:40 |
| the game's bot | 36:28 / 35:00 / 34:56 | government 72–74, approval −8 to −10, alignment 85–88 shown (58–59 true) |
| **never buys power** | > 90:00 ×3 | **stops at 2.42–2.47×** after four runs on 5,000 GPUs: "Train Sage-2.3 … *Needs 8,700 GPUs. 5,000 free.*" from 14:54 to 90:00 with $93.8M in hand; three lot rows "*No power for them: 0 MW free. Gas turbines add 20 MW.*", stores "power ｢￭￭￭￭￭￭￭￭￭￭｣ 5 MW *full · Gas turbines add 20 MW*", "Gas turbines (+20 MW) $144,000 *runs 20,000 GPUs · now · power is the wall*" lit for 74 of the last 75 minutes |
| **never builds a datacenter** | > 90:00 ×3 | stops at 2.59–2.79× on 10,000 GPUs: "*Needs 19,000 GPUs. 10,000 free.*"; rows "*No room for them: the halls are full. Build Datacenter.*"; "Build Datacenter (+15,000 slots) $192,000 *1:30 to build · room is the wall*" lit |
| **buys only power** (a plant whenever one is lit; no lot or hall by hand) | > 90:00 ×3 | 2.67–2.71×; "power ｢･･････････｣ 855 MW *runs 855,000 GPUs*" over 10,000 GPUs; "Gas turbines (+20 MW) $29.0M" |
| **over-builds**: a hall and a plant whenever one is lit · halls only · plants only | 55:04 / 52:00 / 58:32 · 45:10 / 44:52 / 43:48 · 54:00 / 61:04 / 53:04 | +13:16 · +2:41 · +14:07 on the mean; lead 1.0–1.3 months where plants are over-built; no line and no note says the capacity is idle or what the next plant will cost |
| lots: smallest row only · largest row only · never a shrunken lot · one purchase a check | 41:24 / 41:32 / 42:10 · 40:20 / 43:58 / 38:02 · 37:50 / 41:44 / 38:52 · 41:46 / 41:42 / 40:40 | 21–24 · 3.3–3.5 · 4.9–6.8 · 15 clicks a minute; the same stage within the seed spread |
| **never a lot by hand** (the Standing order buys) · the minimalist (a lot only when Train says GPUs are short; order off) | 44:32 / 46:14 / 46:36 · 55:14 / 51:00 / 49:28 | +3:51 · +9:58; Train blocked for GPUs for 508–524 s · 178–292 s, a lot lit beside it throughout |
| **Standing order**: card never bought · share off / 25% / 75% / 100% with lots still bought by hand | 36:36 / 41:06 / 37:28 · 41:36 / 41:46 / 42:50 · 41:34 / 41:24 / 42:50 ×3 | never buying it is 3:33 faster; 25%, 75% and 100% give the control's run **action for action** (824 / 874 / 994 actions, each at the same second); "off" moves the stage end by 0:00–0:22 |
| **trusts the Standing order** (no lot by hand once it is on screen) at 25% · 50% · 75% · 100% | 38:48 / 41:28 / 42:00 · 41:56 / 43:00 / 40:06 · 41:42 / 43:26 / 43:10 · 41:42 / 41:52 / 43:10 | fleet at the gate 182,000–246,000 · 391,000–540,000 · 507,000–585,000 · 507,000–585,000 GPUs; 7–8 clicks a minute |
| the same, reading only the main lot row | **> 90:00** / 40:46 / 39:56 | seed 1: from 35:30 "Train Sage-2.8 … *Needs 180,000 GPUs. 117,900 free.*", funds $353.9M at 90:00, "Standing order: 50% of income" with nothing beside it (§4.1) |
| slider dragged to **5%** · to **50%** | 38:40 / 42:02 / 41:16 · 52:18 / 52:04 / 45:36 | −1:17 · +8:03 |
| **never buys AI research assistants** | > 90:00 ×3 | 2.86–2.95×; "Train … *short 254,100 research — about 7:03 — AI research assistants*" for 30 minutes; the card on screen |
| **ignores the data wall** (crawl, then nothing) · never any data | > 90:00 ×3 · > 90:00 ×3 | 2.68–2.82× · 1.90–1.93×; "Train … *needs 7.6 T data — Synthetic data, License the code hosts*"; `The Data Wall, 63 minutes on — the next run needs 7.6 T more. Synthetic data, License the code hosts close it.` every three minutes |
| **keeps every model internal** | 65:34 / 60:34 / 63:20 | +21:13; customers on Sage-1.6 at 1.90–1.93× ("Sage-1.6 (internal: Sage-2.7)"); lead 6.1–6.2 months; `Marketing is closed. Customers keep Sage-1.6; Sage-3 works inside.` |
| **ships every model with open issues** | 40:18 / 45:04 / 40:34 | 7–9 incidents, each `Demand down 40% for 1:30` and `Traced to …`; government 44–51, alignment 46–50 shown (31–39 true) |
| **never trains** | > 90:00 ×3 | 1.77×; 1,220,000 GPUs; "Train Sage-1.6" lit for 81 of the 90 minutes |
| **comes back a minute late to Train** (presses it 60 s after it first lights) | 48:12 / 47:46 / 48:28 | +6:13 |
| Focus: **Efficiency** always · **Safety** always | 34:56 / 35:14 / 37:50 · 43:48 / 41:16 / 41:00 | Efficiency −5:56: approval −41 to −52, 855,000–1,043,000 GPUs. Safety +0:05: alignment 96–100 shown (100 true) |
| **lets every event run out** | 43:32 / 42:50 / 42:58 | +1:11; each closes on its timer and logs its default; government 49–55, lead 1.0 |
| events: last option · worst-looking · best-looking | 41:04 / 38:32 / 44:46 · 38:10 / 41:50 / 43:38 · 38:48 / 37:46 / 37:56 | government 49–56 · 47–51 · 67–69; lead 1.5–1.8 · 1.0–1.3 · 2.1–2.2 |
| never spends Trust · every Trust on Hire · on Expand | 39:32 / 39:10 / 42:06 · 40:30 / 42:40 / 39:22 · 37:34 / 42:34 / 42:16 | −1:40 · −1:05 · −1:08; SL2 and government 61–62 without it |
| every toggle on (Share evals, Job-transition fund) | 41:56 / 41:22 / 42:58 | approval −15 to −17 |
| holds cards while Train says "short" · the same and builds only at the wall | 37:52 / 35:18 / 34:24 · 37:22 / 38:14 / 35:04 | −6:05 · −5:03; first model at 2:06–2:16 |

Nothing above is a hard lock. What reads as a trap, a contradiction or a bug:

1. **The Standing order stalls in silence.** A player who trusts it and builds a hall when the
   main lot row asks (seed 1): the halls reach 99,400 of 100,000 slots at 31:00; the order's
   smallest lot no longer fits; the main row stays lit as "Buy GPUs (600) $158,400 … keeps the next
   hall's price", so it never asks for a hall; and from 35:30 to 90:00 the Train row reads "Needs
   180,000 GPUs. 117,900 free." with $25M rising to $353.9M in funds. The order's row reads
   "Standing order: 50% of income" throughout, $12.0M idle in its pool, no note. The way out is on
   screen — "Buy GPUs (5,000) $1.3M *No room for them: the halls are full. Build Datacenter.*" and a
   lit "Build Datacenter (+75,000 slots) $1.7M *1:30 to build · room is the wall*" — but not on the
   row that stopped. Seeds 2–3 never meet it.
2. **The hard gate turns under-building from a limp into a stop.** In round 1 the player who never
   bought power was at 3.54–3.67× after 90 minutes on undertrained runs; now 2.42–2.47×, blocked for
   GPUs for 75 minutes. It is the best-labelled wall in the game (four places name the fix) and it
   is absolute.
3. **Building ahead is offered, advised and punished** (§5): +13:16 for buying what is lit, +3:43
   for obeying "the plant first" / "the hall first" instead of waiting for the wall. No row prints
   idle capacity or the next price (the turbine goes $144,000 → $245,000 → $416,000 → $707,000 →
   $1.2M → $2.0M, the tooltip says "The county notices each one.").
4. **Train does not wait for the player.** It is lit for 20–22 s of a 41-minute stage in the
   control; pressed a minute after it first lights, the stage is 6:13 longer; pressed only after it
   has been lit for an unbroken minute — it goes dark each time a card is bought — 17:32 longer
   (56:12–62:38). There is no way to queue the run.
5. **Reloads** at 12:00, mid-training, mid-evaluation, in the red-team wait, with a hall under
   construction ("building — 1:27" → "1:27"), with a farm in the queue ("solar farm — 2:57"), with
   an event open ("59 s" → "59 s"; "89 s" → "89 s"): the serialized state is identical before and
   after in all eight. **Exact.**
6. **Idle**: ten minutes from the first second — the arrival lines print, funds reach $2.0M, no
   event, five minutes after returning the model is at 1.91×. From 12:00 — the Standing order keeps
   buying to the last megawatt (26,700 → 44,700 GPUs), *Al-Marsa* is on the last three seconds of
   its timer at the return, a curtailment has left "8,700 GPUs dark: a crisis holds power back";
   funds $10.9M. Thirty minutes from the first second — two events open and close, no rescue,
   1.77×. **Safe.**
7. Nine wrong, stale or contradictory texts: §8.8.

### Paperclips (`s2x-pc-*.md`, round 1; the game and the fixture are unchanged)

Every clip into drones before the first factory is a silent dead end ("Clips per Second: 0", no
line; "Disassemble All" refunds in full and nothing says so); farms disassembled → "Factory/Drone
Performance: 0%", no line; five "Disassemble All" presses, no confirmation; the slider at each end
is legible and matters; a reload loses ≤ 25 s; ten idle minutes are safe and silent.

---

## 5. Decisions and hands

### Which framed choices change the stage

The play-style table read as a sensitivity analysis (control 41:34 / 41:24 / 42:50, mean 41:56, a
1:26 spread between seeds; Δ on the mean, per-seed range in brackets):

| what the stage frames as a choice | stage end (Δ) | meters at the gate | are the stakes on screen when choosing? |
|---|---|---|---|
| **Release publicly or keep internal** (event, then a button) | internal always +21:13 | lead 6.1–6.2 months (2.7–2.8); customers on 1.90–1.93× | **Yes** — "research ×1.25 · lead +0.5 months · customers keep the old model" |
| **Focus** (three buttons, default Capability) | Efficiency **−5:56** (−5:00 to −6:38) · Safety +0:05 (−1:50 to +2:14) | Efficiency: approval −41 to −52 (control −21 to −26). Safety: alignment 96–100 shown and true (67–71 shown, 43–45 true) | **Mostly, now** — trade under each button and a note per selection ("More copies: more money for runs, more jobs displaced."). Two misprints: the Efficiency tooltip says "25% more copies on every GPU" (the button and the game: ×1.15); Safety's note says "the slowest road to 4×" and it is not slower |
| **Plants and halls: when to build** (lit ahead of need since this build) | at the wall −3:43 to −3:51 · on the row's "… first" 0 (control) · whenever lit **+13:16** (halls only +2:41, plants only +14:07) | lead 1.0–1.3 when over-built | **No** — the row prints capacity and delay ("runs 20,000 GPUs · now"); the lot row and the hall's tooltip ("Building ahead of the wall keeps the lots coming.") argue for the slower choice; nothing prints idle capacity or the next price |
| **Cards against the run** (every card is lit the moment it is affordable) | cards held while Train says "short": **−6:05** (−3:42 to −8:26) | approval −3 to −11, fleet 243,000–325,000 | **No** — a card says what it does ("market ×1.6") and never what it does to the run it is taking money or research from |
| **Allocation slider** (5–50%) | 5%: −1:17 · 50%: **+8:03** | none | **No** — research 1,404 / 2,061 / 3,495 a second and revenue $11,115 / $10,468 / $7,972 at 5 / 15 / 50% (`s2r2-x-slider-ends.md`); the block prints "Copies on research: 50% / Human share of research: 13%" |
| **Events** (nine, all timed) | best-looking −3:46 · worst-looking −0:43 · last −0:29 · all expire +1:11 | government 47–69; lead 1.0–2.2 | **Yes** — effect line under every option, timer and default in words |
| **Red-team or ship** | ship always +0:03 (−2:16 to +3:40) | government 44–51 (67–70); alignment 46–50 shown; 7–9 incidents | **Yes, after the fact** — "Release (issues open)", `No Trust: 3 open issues shipped`, `Demand down 40% for 1:30`, `Traced to …` |
| **GPU lots: which size, how many** | smallest only −0:14 · largest only −1:09 · whole lots only −2:27 · none by hand +3:51 · the bare requirement +9:58 | fleet 118,000–615,000 | **Yes for the return** (printed, and true: below); the sizes are one price per GPU, so the size is a click count, not a choice |
| **Standing order** (card $420,000 + 30,000 research, then a share) | never bought −3:33 · share 25 / 75 / 100% with hand lots **0:00** · order alone at 25 / 50 / 75 / 100%: −1:11 / −0:15 / +0:50 / +0:19 | fleet 182,000–246,000 at 25% against 507,000–585,000 at 100% | **No** — the row prints a share and nothing it does; "It never buys plants or datacenters" is in the tooltip |
| **Trust**: Hire, Expand, or keep | never spent −1:40 · Hire only −1:05 · Expand only −1:08 | SL2 and government 61–62 when kept | Tooltips; 38–40 presses a stage that change nothing measurable |
| **Share evals · Job-transition fund** | +0:09 together | approval −15 to −17 (−21 to −26) | Tooltips ("2% of revenue while it is on. Approval +10.") |

What this says.

* **Two choices are legible and heavy** — release policy (+21 minutes, lead ×2.2) and Focus (6
  minutes, 20–25 points of approval, alignment to 100) — and Focus is new to that list: round 1's
  largest hidden lever is now printed.
* **The three largest levers on the ordinary path are abstentions the screen argues against.** Not
  buying cards while the Train row says "short" (6:05), not building before the wall (3:43–3:51),
  not buying a plant because it is lit (13–14 minutes). In each the button is lit, the row or its
  tooltip recommends it, and the faster play is to leave it. The bot — which by the build's README
  builds at the wall and lends the run's money to cards for 30 s at most — ends at 34:56–36:28.
* **Lots: the printed return is honest, and it does not matter.** Twin sessions from the same
  state, one buying the lot (`s2r2-x-lot-return.md`, Standing order off in both): the revenue gained
  40 s later is 97–137% of the printed "+$/s" at eight marks from 3:36 to 37:02 and 175% at 0:00
  ("+$362/s" printed, +$633/s measured, release hype "strong"). At the printed rate a lot pays for
  itself in 4:39–12:30. Across the stage it washes out: fleets from 182,000 to 615,000 GPUs at the
  gate end within 2:46 of each other, seed by seed (the order alone at 25% against the control);
  only the extremes move it (none by hand +3:51; the bare requirement +9:58).
* **Is there a dominant button?** Among the three lot rows, the largest that is lit — same $120 (G4)
  or $264 (G5) a GPU on each, and for the first-timer the 5,000 row is lit in 1.2–2.1% of checks
  and the 25,000 row never. Among the plants there is a real trade (turbines now at a climbing
  price and "The county notices each one."; solar cheaper per MW, "in three minutes", one at a time
  through the queue; nuclear "$27.0M … cheaper: good relations") and it is the best purchase
  decision in the stage. The lit **hundreds lot is dominated by not pressing it**: the same player
  without it ends 2:27 sooner (−3:44 / +0:20 / −3:58) with a quarter to a third of the clicks.
* **The Standing order's share is not a control.** For a player who also buys by hand, 25, 50, 75
  and 100% produce the same run, click for click; the row's pool counts $16.1M / $33.6M / $50.7M /
  $67.7M "set aside" at the gate while the same dollars were spent by hand. For a player who lets
  it buy, three idle minutes at 25, 50, 75 and 100% buy the same 4,000 GPUs
  (`s2r2-x-standing-rates.md`: power was the wall), and over a stage the 25% setting ends with
  two-fifths of the 100% setting's fleet and 1:30 sooner. Its fifth setting reads "Standing order:
  off of income".
* **The race still cannot be lost here**: Anthrosoft `ships Cadence-21, level with Sage` at 2.47×
  in minute 86 of the player who never bought power.

### What the hands are doing

| | Takeoff control | Takeoff as shipped | Paperclips Stage 2 | Takeoff round 1 |
|---|---|---|---|---|
| clicks per minute | 19.2–22.3 | 17.6–18.4 | 19.5 | 3.8–4.1 |
| of them lot / drone presses | 83% (428–473 in hundreds, 220–298 at 1,000, 15–27 at 5,000, none at 25,000) | 79–81% | 82% (1,724 Wire Drone, 450 Harvester) | 15% |
| 2-s checks with no enabled purchase | 28.8–30.6% | 25.5–28.5% | 0.6% | 85–88% |
| checks with two or more distinct things affordable | 24.8–29.6% (median 1) | 46.8–53.5% | 97.1% (median 5) | 5–7% |
| time inside ≥ 30-s click gaps, whole stage | 20.9–27.4% (longest 52–56 s) | 26.0–28.8% (46–58 s) | 27.7% (134 s) | 50–55% (86–104 s) |
| the same, after 10:00 | 20.6–30.9% | 24.9–30.0% | 22.3% | 62–68% |
| first ten minutes: nothing enabled / two or more | 32–35% / 6–13% | 38–40% / 27–31% | 7.6% / 60.5% | 77–80% / 8–10% |

By ten-minute window (control, seed 1): 19.5, 14.6, 13.8, 26.6 clicks a minute; nothing enabled in
35%, 37%, 27%, 16% of checks. Paperclips by twenty minutes: 10.6, 31.9, 17.2, 11.9, 26.4, 30.6, 4.9.

What is lit, check by check (control, three seeds): nothing 29–31%; **only the hundreds lot
22–27%**; only a whole lot 8–15%; **only plants or halls that the lot row is not asking for
16–24%**; only the plant or hall it asks for 3–4%; a lot beside such a plant 2%; a card, Train, a
release or a Trust button (alone or with infrastructure) 9–11%. So the hands have a purchase in
front of them in seven checks of ten, and in four or five of those seven it is a hundreds lot or a
plant ahead of need — the two purchases this section shows are worth nothing or less.

---

## 6. Training under the hard gate, and power

### Training

What the pipeline is doing, share of the stage (nine traces):

| | control ×3 | shipped ×3 | bot ×3 |
|---|---|---|---|
| a run is training | 34–40% | 38–40% | 44–46% |
| Train on screen and greyed | 56–63% | 55–57% | 52–54% |
| — for **money** | **40.5–47.6%** (14–18 stretches, longest 136–192 s) | 40.9–46.7% (11–13, 168–182 s) | 43.6–45.9% (13, 132–248 s) |
| — for research | 11.0–11.5% (longest 112 s) | 8.6–10.4% (106–118 s) | 7.5–8.0% (108 s) |
| — for data | 0–5.8% (90–96 s) | 0–3.9% (62–88 s) | 0–0.7% |
| — "evaluation month — 0:15" | 0–0.6% | 0–2.4% | 0 |
| — for **GPUs** | **0** | **0** | **0** |
| Train lit | 20–22 s | 18–20 s | 0–4 s |

* **The GPU requirement never blocks a player who buys lots.** Each run prints it — "Needs 800
  GPUs for 1:00", then 1,500, 2,700, 4,900, 10,000, 18,000, 35,000, 62,000, 110,000, 170,000 — and
  at each press the control's fleet is 18.0, 13.1, 7.6, 5.4, 5.7, 4.7, 3.2, 2.6, 2.2 and 2.3 times
  that. It blocks in 7 of the 51 play styles: no lot by hand (508–524 s: "Needs 1,300 GPUs. 1,000
  free."), the minimalist (178–292 s), the order alone at 25% (0–36 s), the silent stall of §4.1,
  and the three under-builders (3,836–4,570 s).
* **When it blocks, it is the clearest wall in the game** (`s2r2-x-gate-screens.md`,
  `-gate-blocked.png`): "Train Sage-1.7 Cost: $239,510, 47,000 research, 2.4 T data / ｢￭￭￭￭￭￭￭￭･･｣
  *Needs 1,300 GPUs. 1,000 free.*" — a bar that appears only then, two numbers, and beside it a lit
  "Buy GPUs (1,000) $120,000 uses 1 MW of 4 free · +$649/s" with $565,749 in funds. One click;
  Train lights 2 s later. No console line in two minutes of refusing.
* **The requirement has a cost a player can see.** `Training Sage-2.7 on 110,000 GPUs` takes 46% of
  the fleet out of service ("They serve no customers until it is done.") and revenue falls from
  $442,734 to $352,714 a second twenty seconds in; 15% at Sage-2.6, 13% at Sage-2.5, 5–9% for the
  four runs before, about 1% for the first two.
* **Does it read as arbitrary?** No reason is given for 800 or for the near-doubling per run (the
  tooltip: "Train the next model. The GPUs it needs train it; the rest keep serving."), but the
  numbers are round and steady, and on the played arrival the requirement is the story: "Sage-1.5
  needs 640 GPUs. The cloud will rent 100. Build the First Datacenter." One thing breaks it: after
  the Nimbus G5 card (`Each does the work of one and a half G4s.`) the Train row counts in G4s and
  the stores in chips — "Needs 180,000 GPUs. **117,900 free.**" beside "GPUs ｢￭￭￭￭￭￭￭￭￭･｣
  **99,400**"; `Training Sage-3.1 on 310,000 GPUs; 399,050 keep serving.` (709,050 in all) while
  the stores count between 500,000 and 566,000.
* **What blocks training is money**, as in round 1 (49–54% then, 40–48% now). The row says so each
  time with a clock — "short $6.5M — about 1:22", "short $11.1M — about 1:33" — and nothing on
  screen is for sale that shortens it: during that wait nothing is lit in 31–35% of checks, only
  plants and halls the lot row is not asking for in 41–50%, a lot in 10–12%, a card or a Trust
  button in 10–12%; the main lot reads "the run first" for 79–86% of it.
* **Research** blocks for stretches of ~1:50 at the opening, when a card priced within 3% of the
  run takes the research ("short 33,725 research — about 1:36"); **data** for 58–96 s at the first
  data wall in four of the six first-timer traces ("short 1.3 T data"), with no card on screen
  that sells data in any of them: the wall is ended by an event (*The Publishers*: "fight it / +5 T
  data now · government −3 · approval −4 · a lawsuit"). Later walls name their card ("needs 3.5 T
  data — License the code hosts", drawn urgent).

### Power

* **Can a player end up with GPUs that are not running?** Not by buying: a lot is refused without
  power ("No power for them: 0 MW free. Gas turbines add 20 MW.") and the Standing order stops at
  the last megawatt. Only a crisis darkens GPUs: 103 of the 153 play-style runs had some, for 2–144 s
  a stage, up to 487,500 at once (the nine rubric traces: 0–90 s, up to 21,000). **The screen says
  so every time**: the power row's sentence changes from "runs 85,000 GPUs" to "*1,000 GPUs dark: a
  crisis holds power back*" (`s2r2-x-dark-gpus.md`: "32,500 GPUs dark…" with `Protesters cut a
  datacenter fence. Power halved for 90 s.`; the lot rows turn to "No power for them: 0 MW free."
  and the plants to "power is the wall"). Train was never blocked for dark GPUs in 153 runs. A
  curtailment that leaves every GPU powered shows on the row only as "65 MW / runs 46,800 GPUs",
  beside its console line (`Curtailment — the grid takes back a fifth of Abilene's power for 90 s.`).
* **Do the meters read at a glance?** The fill does; the count does not (§2d): the bar beside
  "GPUs" measures against a number that is not on screen, the bar beside "power" measures a number
  that is not on screen, and one cell is a tenth of a capacity that grows 80-fold in the stage
  (10,000 → 800,000 slots). The sentences rescue it: "runs 5,000 GPUs", "full · Gas turbines add 20
  MW", "the halls are full · Build Datacenter".
* **Is the GPU–power dependency evident before the first power wall?** Yes, five times over, the
  first three in the first ten seconds: the arrival line "Each MW powers 1,000 GPUs; power is
  bought in megawatts now." (0:06); "power ｢￭￭････････｣ 5 MW / runs 5,000 GPUs" (0:00); the lot's
  "uses 1 MW of 4 free" (0:00); `Power draw is 60% of the site's 5 MW. Gas turbines can be on site
  in a week.` with "the plant first" and "No power for them: 2 MW free. Gas turbines add 20 MW."
  (0:32). The wall itself (3:00 for the shipped first-timer) prints `No power for more GPUs — all 5
  MW in use. Gas turbines are fast.`

---

## 7. THE SINGLE BIGGEST GAP

**One purse pays for the run, the lots, the plants, the halls and the cards, so the build ships a
governor that decides what each dollar is for — it greys the lot rows for more than half of the
stage — and what it leaves lit either does not move the stage or moves it the wrong way.** Round 1
found nothing to press; round 2 finds plenty to press and nothing to decide with it.

The lock, in the three control traces:

| the main lot row | share of the stage | what it reads |
|---|---|---|
| greyed by a reservation | **53–58%** (shipped 52–55%, bot 57–59%) | "Buy GPUs (1,000) $264,000 *the run first*" 32–41% · "*the hall first*" 9–12% · "*the plant first*" 7–9% · "*Synthetic data first*", "*the offer first*" ≤ 1% |
| lit, shrunken | 27–32% | "Buy GPUs (100) $12,000 uses 1 MW of 2 free · +$42/s · *keeps the next plant's price*" |
| lit at 1,000 | **9–16%** | "Buy GPUs (1,000) $120,000 uses 1 MW of 4 free · +$362/s" |
| greyed at a wall or for money | 2–4% | "No power for them: 0 MW free. Gas turbines add 20 MW." |

The 5,000 row is on screen for 99% of the stage and lit in 1.2–2.1% of checks; the 25,000 row for
85% and lit in none.

What the lock protects is the wait round 1 measured. Train is on screen and greyed for money for
**40–48% of the stage** (49–54% in round 1), in 14–18 stretches of up to 136–192 s, and lit for
20–22 seconds in 41–43 minutes. The screen at 25:00 (`s2r2-tk-rt.view1500.png`): "funds $
182,287.62", three lot rows reading "*the run first*", four greyed plants and halls, four greyed
cards, "Train Sage-2.5 … *short $6.5M — about 1:22*" — and nothing live but Complete Task, the
slider, "50%", Focus and a toggle.

And what stays lit:

* **the hundreds lot** — 428–473 presses a stage, one every 5–6 s — and the same player who never
  presses a shrunken lot ends **2:27 sooner** (37:50 / 41:44 / 38:52) with a quarter to a third of
  the clicks, because the Standing order buys the GPUs instead;
* **the Standing order's share** — 25, 50, 75, 100%: the same run action for action for a player
  who also buys by hand; a fleet two-fifths the size and the same stage (±1:30) for one who does
  not;
* **plants and halls ahead of need** — bought when lit, **+13:16**; bought on the lot row's own
  advice ("the plant first" at 60% draw, "the hall first") instead of at the wall, **+3:43**, and
  the first model at 7:20 instead of 3:12;
* **cards** — bought when lit, as every first-timer buys them, +6:05 against holding them while
  the Train row says "short", and three of the first four cost 34,000–35,000 research against a
  35,000-research run.

So round 1's hands targets are met on paper — no enabled purchase in 29–31% of checks, two or more
in 25–30%, 21–31% inside long click gaps after minute 10 — by buttons whose best use is to leave
them alone. The decisions that set the control's 41:56 against the bot's 35:28 are three
abstentions and a reflex (press Train within seconds of its lighting: a minute late costs 6:13),
and no row frames any of them.

Paperclips' Stage 2 is slower, sparser and explains nothing, and it does not have this problem,
for a structural reason: it has **separate purses**. Clips buy drones, factories, farms and
batteries; ops, yomi and creativity buy projects. Waiting on one never idles the other, so at 97%
of checks the player must choose between at least two things, each choice moves a rate printed
beside its button, and nothing needs a governor. Takeoff put the run, the build and the cards on
one account and then had to write the player's budget for them.

Fix, in order of leverage:

1. **Give the build its own purse and make its share the stage's allocation decision.** The state
   already has the pieces (`standingBudget`, `standingPool`); today the pool is a counter, not
   money. From 0:00, split income into "funds" (runs, cards) and a "build fund" (lots, plants,
   halls) at a share the player sets (25 / 50 / 75%), both rows in the stores; a lot, a plant or a
   hall spends only the build fund, a run or a card only funds. Then no lot competes with the run,
   every "… first" reservation and the shrunken lot can be deleted, the three lot rows are lit
   whenever the build fund covers them, and the share has two clocks to print beside it: "run in
   0:52 · next 5,000 lot in 0:31". The Standing order card becomes the automation of that fund
   ("buys the largest lot that fits"), not a second, inert setting.
2. **If the single purse stays, turn the locks into prices.** Leave the lot lit and print what it
   does to the wait: "Buy GPUs (1,000) $264,000 · +$778/s · *run 0:07 later*". Both numbers exist:
   the row prints the return, the Train row prints the wait. Do the same on cards ("market ×1.6 ·
   run 0:41 later").
3. **Sell whole lots only.** Drop the shrunken main lot; grey the 1,000 with its own clock
   ("$12,400 short — 0:09").
4. **Stop advising what costs time.** Print "the plant first" when less than one lot of free power
   is left (the reveal uses 60% draw), never before the stage's first run, and print idle capacity
   and the next price on the plant and hall rows ("18 of 25 MW idle · next turbine $245,000").
5. **Let the run be queued**: a "start when ready" toggle on the Train row.

Targets for the next build, control and shipped first-timers on seeds 1–3 with
`explore-s2r2.mjs`: the main lot greyed by a reservation ≤ 15% of the stage (53–58% now); a whole
lot lit in ≥ 35% of checks (9–16% for the 1,000, 0–2% for the larger rows); ≤ 250 lot presses a
stage (663–798); the build share (or the Standing order's) moving the stage end by ≥ 4 minutes
between its ends with both clocks printed, or the control removed (0:00 now); over-building
≤ +5:00 or priced on the row (+13:16); first model ≤ 4:00 for the control (7:20–7:40); no release
interval over 5:30 (5:00–7:40); the bot inside 36–44 (34:56–36:28); round 1's three hands targets
still met.

---

## 8. Secondary gaps (priority order)

1. **The opening starves the first run for a player who buys what is lit.** First model at
   7:20–7:40 (control) against 3:12–3:22 (at the wall), 2:06–2:16 (cards held) and 1:34 (nothing
   bought). At 0:00 the only lit purchase priced in money takes $120,000 of $121,000 against a
   $154,488 run; cards at 0:02, 0:32 and 0:46 cost 34,000–35,000 research against the run's
   35,000; "the plant first" (0:32) and "the hall first" (2:40) take $336,000 more; the Train row
   flips between "short $…" and "short … research" six times. Fix: price the arrival's run under
   the arrival's funds and lab, reveal the three research cards after the stage's first run
   starts, and print both shortfalls on the Train row ("short $146,189 and 8,750 research").
2. **Release intervals still exceed 5:30.** Besides the opening, the fifth or sixth release of the
   stage (Sage-2.3 or 2.4, between minutes 13 and 26) takes 4:56–6:22 in eight of the nine rubric
   traces (the bot's seed 3: 3:52 at most). In the control's (14:22 → 20:44) the first data wall
   stands for 96 s with nothing on screen that sells data, and the run is then 3:02 short of a
   price that has doubled ($947,834 → $1.9M). Fix: put Synthetic data on screen before the first
   data wall, not two minutes after it, and step that run's price by ×1.5, not ×2.
3. **The Standing order**: an inert share (§5), a pool that is not money, a row that says nothing
   when it cannot buy (§4.1), a card ($420,000 and 30,000 research at 9:30) that a hand-buyer is
   3:33 faster without. Fix 1 of §7 replaces it; short of that, three settings, a reserved pool, and
   a note ("waiting for room — 600 slots left").
4. **Train does not wait for the player** (§4.4): 20 s lit per stage; a minute late per run costs
   6:13. A queue toggle costs one control.
5. **The slider's trade is still not on the screen.** 50% is +8:03 and 5% is −1:17; the block
   prints two percentages. Print the two rates the Stores hover already has ("research +3,495/s ·
   revenue −24%").
6. **Trust is quieter and still close to dead.** The loud line is gone (14 Trust lines in 41
   minutes, all "+1 Trust" on a release; `Trust +1. Expand the lab, or save it.` no longer prints),
   Hire is retired at 10% human share with a line, `Trust 2: Policy team within reach.` announces
   the one card it buys — and 38–40 Hire / Expand presses are still worth less than nothing (never
   pressing them: −1:40).
7. **Meters with little behind them.** Government and approval now print their thresholds ("at 60
   reactors cost a quarter less", "at 80 the solar queue halves", "under −30 permits slow") and
   government no longer saturates (44–74 at the gate; round 1: 93–100). Lead and measured alignment
   still change nothing a player can see before the gate, and the rival is still tied to the player.
8. **Wrong, stale or contradictory text** (each should be fixed regardless of the rubric):
   1. `Power draw is 60% of the site's 5 MW.` prints at 2:02 to a player drawing 1.0 of 5 MW: the
      row's reveal fires at 60% draw *or* 120 s and the line is the same (`src/data/stage2.ts:108–111`).
   2. "Needs 180,000 GPUs. 117,900 free." beside "GPUs 99,400": the Train row counts G5s as 1.5.
   3. "No room for them: the halls are full. Build Datacenter." on the 5,000 and 25,000 rows while
      the halls have room (20,400 of 25,000 slots at 9:10; 43,000 of 50,000 at 15:00) and the GPU
      bar beside it shows eight or nine cells of ten.
   4. "Buy GPUs (100) $12,000 *uses 1 MW of 0 free* · +$30/s" — lit (2:38–3:00 for a player at the
      power wall); every shrunken lot prints "uses 1 MW" for 0.1–0.9 MW.
   5. Efficiency's tooltip: "+7% capability, and 25% more copies on every GPU"; the button says
      "copies ×1.15" and one run gives ×1.15 and +8.0%.
   6. "Standing order: off of income"; "keeps AI research assistants's price".
   7. "Air-gap the weights" stays, greyed, after it is bought ("Security level: SL3 — weights
      air-gapped / Air-gap the weights $48.0M, 3 Trust") and into Stage 3, where Trust is gone.
   8. Safety's note "the slowest road to 4×": Safety always is +0:05 on the mean.
   9. The arrival triples the price of the run on screen with no line ($18,229 → $60,854).
9. **Building ahead** needs its stakes on the row (§5, §7 fix 4).
10. **The screen**: greyed controls are still the majority after 5:00; two of three lot rows are
    grey for a first-timer nearly always; the "4× superhuman coder" label is still overdrawn at the
    gate; the event panel covers the Train row; words 301–404 from 10:00 against Paperclips'
    211–267; at 390 px the Train button is 0.9–1.5 screens down. The build's own budget (numbers
    ≤ 60 at 5:00, ≤ 70 at 10:00, ≤ 80 after) is missed by the control at 5:00 (62), in two seeds
    at 10:00 (72, 78) and at a later mark in every seed (81–87).

---

## 9. Verdict

| Rubric item | Winner | Margin |
|---|---|---|
| (a) Time to first meaningful choice | **Takeoff** (8–6) | a priced trade with a printed return and a printed wait at second 0, and a timed event with stakes by 5:44–7:04, against five unexplained ops cards and no production for 7:44–11:00 |
| (b) Nothing to do | Tie (6–6) | round 1: Paperclips 6–5. Takeoff's checks with nothing enabled fell from 85–88% to 29–31% and its long click gaps from 50–55% to 21–27% of the stage (Paperclips: 1% and 28%); it stays far ahead on reveal, novelty and decision gaps; it does not take the row because half of what it added to press is worth nothing (§5) and the wait for the run's money is unchanged in kind |
| (c) Cognitive load / disclosure | Tie (6–6) | round 1: Paperclips 6–5. Dead controls gone, walls and waits printed in place, the event panel off the stores; still 301–404 words to 211–267, 11 panels to 8, 4.5 lines a minute to 1.6, and a majority of greyed controls |
| (d) Cadence of reveals | **Takeoff** (8–5) | 2.0 reveals a minute against 0.47; no reveal gap over 198 s against one of 2,198 s |
| (e) Greyed-out goal on screen | **Takeoff** (10–9) | 100% both; Takeoff names the next step with a clock from 0:00 and the stage goal from 3:12–4:32 |
| (f) Clarity of transitions | **Takeoff** (9–8) | round 1: 8–8. The three exit defects are fixed and the arrival now carries the stage's rule in a line; Paperclips explains less and is unmistakable |
| (g) Soft-locks | **Takeoff** (8–7) | both 0 hard locks; Takeoff's stalls name their fix in three or four places, Paperclips has a silent dead end |
| **Overall** | **Takeoff: 7.9 vs 6.7** | five rows won, two tied, none lost; +0.5 on round 1, earned on (b), (c) and (f) |

**On the hard GPU requirement.** *Helps*: it is the reason for the stage ("Sage-1.5 needs 640 GPUs.
The cloud will rent 100. Build the First Datacenter."); it replaced "undertrained (92%)" with one
plain line; when it blocks it is the clearest wall in either game, with its fix lit beside it; a
run visibly takes its GPUs out of service. *Hurts or does nothing*: on the ordinary path it never
blocks — 0 s in nine rubric traces — so it is not what gates training (money is, 40–48% of the
stage) and it cannot be a decision; it removed the one lever round 1 asked for on that wait;
under-builders now stop dead at 2.4–2.8× where they used to limp to 3.5–3.9×; after the G5 card it
counts in a different unit from the stores. Keep it, fix the unit, and do not mistake it for the
stage's gate.

**On the meters.** *Help*: the fill reads at a glance at fixed width; a full bar gets the fix in
words beside it; "runs 5,000 GPUs" states the dependency from the first second; dark GPUs get a
sentence. *Hurt*: the two bars in the stores measure against numbers that are not printed, and the
numbers that are printed mean different things on adjacent rows (stock; capacity), so the count
round 1 could read off the screen now takes a hover. Put the denominator back as small type
("1,000 of 10,000").

What is measurably good in Takeoff's Stage 2, so that the next fix does not break it:

* **Every wall and every wait is named where the eye is**: the Train row's shortfall with a clock
  from 0:00; the fix named on the row when it is a card; full bars with their fix; lot rows that
  say which wall; plants that say "power is the wall"; `The Data Wall, 63 minutes on — …` every
  three minutes while it stands; the wall's card drawn urgent.
* **The hard gate, where it blocks, is one click from open** and says so (§6).
* **The printed return on a lot is true**: 97–137% of the printed figure 40 s later at eight of
  nine marks.
* **Stage length is stable**: 41:24–42:50 for the control, 36:40–39:56 as shipped, 34:56–36:28 for
  the bot; 36 of the 51 play styles end between 34:24 and 46:36 on all three seeds.
* **Decisions with printed stakes**: release policy (+21 minutes, lead ×2.2), Focus (6 minutes,
  20–25 points of approval, alignment to 100), red-teaming (government −20, 7–9 traced incidents
  with a size and a length), every event option.
* **Every event has a timer with a harmless default**; the panel does not block the page, takes
  focus, Tab walks the options, Escape takes the default, and it no longer covers the stores.
* **No dead air by novelty**: no reveal gap over 198 s, no novelty gap over 74 s, no decision gap
  over 120 s; 2.0 reveals a minute.
* **The goal is always named**, and the gate card says what it ends and waits for the click.
* **The exit is clean**: six lines, the retired cards and the meter change narrated, no dead
  readout; the internal path has its own line.
* **Persistence**: identical state after a reload in eight situations, a hall under construction
  and a farm in the queue included; idle is safe for 10 and 30 minutes with no Stage 1 rescue.
* **No page error in 168 runs, no horizontal overflow at 390 px, no button under 36 px there**;
  same seed, same run; 300 s of real time reproduce the stepped trace exactly.

---

## 10. Status of each round-1 finding and target

### The single biggest gap of round 1

*"From the Standing order to the gate, Stage 2 gives the player nothing to press and no way to spend
toward the thing they are waiting for."* — **Half fixed; the other half replaced by a new problem.**
*Nothing to press*: fixed in the numbers (after 10:00: 19–23 clicks a minute against 2.7–3.3;
nothing enabled 27–29% against 88–90%; two or more 30–35% against 4–5%; long click gaps 21–31%
against 63–69%). *No way to spend toward the thing they are waiting for*: still true — Train greyed
for money 40–48% of the stage (49–54%), and the fix round 1 proposed for it (a run on the money
there is) was built and then removed for the hard gate. *New*: the lots were handed back with a
governor on them (greyed by a reservation 53–58% of the stage), and what is left lit is redundant
(hundreds lots), inert (the share) or harmful (plants ahead) — §7.

### Its five targets

| target (round 1 §6) | control (seeds 1–3) | as shipped — the player round 1 measured with | bot |
|---|---|---|---|
| checks with no enabled purchase ≤ 50% | **met**: 28.8 / 29.4 / 30.6% | **met**: 28.5 / 26.4 / 25.5% | met: 19.4 / 18.8 / 21.8% |
| two or more distinct things affordable in ≥ 25% of checks | **met in two seeds**: 26.8 / 29.6 / 24.8% | **met**: 53.5 / 46.8 / 50.5% | met: 56.4 / 54.4 / 52.7% |
| time inside ≥ 30-s click gaps after minute 10 ≤ 35% | **met**: 30.4 / 30.9 / 20.6% | **met**: 30.0 / 24.9 / 28.4% | — |
| no model-release interval over 5:30 | **missed**: 7:20 / 7:40 / 7:20 (after the first: 6:22 / 5:10 / 5:52) | **missed in two seeds**: 5:50 / 5:00 / 5:32 | missed in one: 4:56 / 5:52 / 3:52 |
| stage inside 36–44 min, first-timer and bot | **met**: 41:34 / 41:24 / 42:50 | **met**: 38:04 / 39:56 / 36:40 | **missed in two seeds**: 36:28 / 35:00 / 34:56 |

### The nine secondary gaps

| # | round-1 gap | status | evidence |
|---|---|---|---|
| 1 | Focus is the biggest lever and unlabelled | **Fixed**, two misprints | trade under each button, a note per selection; stale tooltip (25% for ×1.15), "slowest road" for Safety |
| 2 | A dead verb with the loudest voice (Trust) | **Partly fixed** | the line is gone, Hire retires with a line, the Policy team is announced; never spending Trust is still 1:40 faster |
| 3 | The Standing order's reason hides the wall | **Fixed on the rows; replaced** | lot rows, stores and plants name the wall; the order's own row is silent when it stalls and its share is inert |
| 4 | Meters with nothing behind them; silent clamp | **Partly fixed** | thresholds printed for government and approval; government 44–74 at the gate; the gate's change is narrated (69 → 71); lead and alignment still without a visible consequence; rival still tied |
| 5 | The slow middle (7:02–7:50 between releases) | **Partly fixed, moved** | longest mid-stage interval 5:00–6:22; the long one is now the opening (7:20–7:40) for a never-saver |
| 6 | Mandatory cards look like every other card | **Fixed** | named on the Train row and in a repeating line; drawn urgent; lots held "AI research assistants first". Skipping them still ends the stage at > 90:00 |
| 7 | Mostly grey, some things said three times | **Partly fixed** | lower / raise / Marketing gone, one home for the rival and the lead, event panel off the stores; median greyed controls 12 of 19 (15); the 4× label still overdrawn; 390 px buttons fixed |
| 8 | Stage 1's rescue in Stage 2; the calendar frozen behind an untimed event | **Fixed** | no rescue in 30 idle minutes; every event has a timer and a default |
| 9 | Exit loose ends | **Fixed**, one new leftover | no dead billing line, no silent −11, the card names what ends and says "public or internal"; "Air-gap the weights … 3 Trust" survives into Stage 3 |

### The listed bugs (round 1 §4)

| # | round-1 item | status |
|---|---|---|
| 1 | the lot row hides the wall once the Standing order is on | fixed |
| 2 | walls named once, then the console goes quiet | fixed (`The Data Wall, N minutes on — …` every three minutes; standing sentences on rows) |
| 3 | the idle guard thinks it is Stage 1 ($14,642 for a player holding $715,523) | fixed |
| 4 | an unanswered untimed event freezes the calendar | fixed (no untimed event exists) |
| 5 | the gate click costs 11 points of government and says nothing | fixed (narrated; +2 in the measured runs) |
| 6 | Stage 3 opens on a dead readout | fixed |
| 7 | a hollow option (*4 a.m.*: "security level 3 25% off") | fixed ("at a fifth, no Trust, for 5:00": "Air-gap the weights $9.6M", bought inside the window in five of the six first-timer traces) |
| 8 | wrong line when AUTO is switched back on | removed with the toggle |
| 9 | reloads exact | still exact (eight situations) |
| 10 | idle ten minutes safe | still safe |

Round 1's "five known issues": the manual price buttons are gone; a model that lands just under 4×
still forces one more run (the control's last model before Sage-3 lands at 3.81–3.92×, 3:38–4:36
before the gate); government no longer saturates; the number count is as it was (62 at 5:00, 68–87
from 10:00); the slow middle is §8.2.

---

## 11. Re-running

All commands from the repo root; outputs in `agent-tools/critic-out/`. In zsh write `${=G}` for `$G`.

```sh
G="--game-dir agent-tools/snapshots/s12-r4"
# rubric runs (one real-time run at a time)
node tools/critic/explore-s2r2.mjs baseline $G --realtime 300 --label s2r2-tk-rt --seed 1 --shots 300,600,900,1200,1500,1800,2100,2400 --modal-shots
node tools/critic/explore-s2r2.mjs baseline,shipped,bot $G --seeds 1,2,3            # → s2r2-x-<name>[-seedN].*
for s in 1 2 3; do node tools/critic/run.mjs takeoff s2r2-tk-auto$([ $s -ne 1 ] && echo -seed$s) $G --stage 2 --realtime 0 --accel-minutes 90 --autoplay --seed $s; done
node tools/critic/run.mjs paperclips s2r2-pc --stage 2 --realtime 0 --accel-minutes 180                 # ≡ pc-s2
node tools/critic/analyze.mjs s2r2-tk-rt --stage 2                                  # → .analysis.md; same for every label
node tools/critic/compare.mjs s2r2-tk-rt s2r2-x-baseline-seed2 s2r2-x-baseline-seed3 s2r2-x-shipped s2r2-tk-auto s2r2-pc
node tools/critic/decisions.mjs s2r2-tk-rt s2r2-x-baseline-seed2 s2r2-x-baseline-seed3 s2r2-x-shipped s2r2-pc --stage 2
node tools/critic/explore-s2r2.mjs hands s2r2-tk-rt s2r2-x-baseline-seed2 s2r2-x-baseline-seed3 s2r2-x-shipped s2r2-pc
# transitions and the harness's own probes on this build
node tools/critic/transition.mjs takeoff $G --out s2r2-transition-takeoff-s1                           # arrival, played from a new game (also --seed 2, 3 → -seed2, -seed3)
node tools/critic/transition.mjs takeoff $G --stage 2 --out s2r2-transition-takeoff-s2                 # exit
node tools/critic/softlock.mjs takeoff $G --stage 2 --out s2r2-softlock-takeoff-s2
node tools/critic/explore-s2.mjs baseline $G --seeds 1,2,3 --tag s2r2-s2x                              # ≡ shipped
node tools/critic/explore-s2.mjs all-probes $G --tag s2r2-s2x
node tools/critic/explore.mjs toggles,modal-last,modal-ignore,reload-mid-modal,modal-click-through $G --stage 2 --tag s2r2-ex --minutes 90
# this round's play styles and probes
node tools/critic/explore-s2r2.mjs list
node tools/critic/explore-s2r2.mjs all-runs $G --seeds 1,2,3     # 51 styles × 3 seeds → s2r2-x-<name>[-seedN].explore.md / .end.json
node tools/critic/explore-s2r2.mjs table                         # → s2r2-x-table.md (the §4 / §5 tables)
node tools/critic/explore-s2r2.mjs all-probes $G                 # 19 probes → s2r2-x-<probe>.md + screenshots
node tools/critic/explore-s2r2.mjs lot-return $G --at 0,180,420,720,1080,1380,1680,1980,2220          # the nine marks of §5
```

### Harness changes made this round (the game and its snapshot were not touched)

1. **New** `tools/critic/explore-s2r2.mjs`, adapted from the untested draft in
   `agent-tools/critic-drafts/` (which targeted an older build: its "Train now" styles and probe are
   gone, the reasons are re-read from this build's rows). It holds the round-2 first-timer (§1), 50
   variants of it, the hands measures for any stored run of either game, the Train-gate account,
   the lot-row and dark-GPU accounts, a per-run log of what each run asked for against the fleet,
   and 19 probes (`lot-return`, `gate-screens`, `dark-gpus`, `governor`, `reserve-refused`,
   `standing-cycle`, `standing-rates`, three reloads, three idles, `event-keys`, `exit`, `hover`,
   `slider-ends`, `mobile-shots`, `screens`). Its `shipped` style reproduces the harness's own
   first-timer exactly (same stage ends as `explore-s2.mjs baseline` and `run.mjs`).
2. `tools/critic/README.md` — a "Stage 2 round-2 additions" section describing 1, and one line in
   the layout. **No other shared file was changed**: `games/takeoff-late.mjs` still reads only "No
   power…" / "No room…" on the main lot row.

Notes for whoever runs the next round. `run.mjs`, `transition.mjs`, `softlock.mjs`, `explore.mjs`
and `explore-s2.mjs` play Takeoff's Stage 2 with the shipped first-timer; they run cleanly on this
build, 3:43 faster than the control (§1). In `explore-s2.mjs`, `auto-off-raise` finds no AUTO
button and `untimed-open` no untimed event; its `READ` names ids that no longer exist
(`trainShort`, `trainComputeLine`, `btn-autoPrice`) and reports them empty; its play styles other
than `baseline` were not re-run this round. `transition.mjs takeoff --stage 2` clicks the gate in
the check that makes it ready; `explore-s2r2.mjs exit` holds it for 30 s first. The labels
`s2r2-probe0` and `s2r2x-*` come from an interrupted earlier attempt on build `s12-r3`, and
`s2r2-t0-*` is this round's scaffolding, superseded by `s2r2-x-*`; none of them is used above.
