# Takeoff — Stage 3 ("Takeoff") vs Universal Paperclips — late Stage 2 and the opening of Stage 3 · critic round 1

Reviewer brief: fresh context, no design notes read, live source tree not read. The build under
review is the frozen copy `agent-tools/snapshots/s123-r1/`; its source was opened only for its
`README.md` (dev overlay, `window.__game`, presets, the simulator's flags), the element ids in
`index.html`, the state field names in `src/engine/state.ts`, the preset names in
`src/data/presets.ts`, and two causes: the rule that folds a card's sentence into its hover
(`src/ui/render3.ts` `folded()`, `FOLD_SECONDS = 45`; `src/main.ts:76`) and the order event's
options (`src/data/choices3.ts:390–435`). Everything below was measured by driving both games in
headless Chrome with the harness in `tools/critic/`: the scripted "curious first-time player" as
the harness ships it for Stage 3, Takeoff's own Autoplay bot, then 73 play styles on three seeds
each from the careful Stage 3 start (219 runs) and 22 of them from the careless start (66 runs), 15
scripted probes, 7 styles of the older explorer and the canned soft-lock and transition probes; on
Paperclips, both stored references re-run (identical to the baselines), the stretch cut out of them
and joined on one clock, screenshots at twelve marks, and six probe designs played for 42 minutes
each.

Scope. **Takeoff Stage 3**: from the dev preset `3` (the moment `Let Sage-3 write the code` is
clicked; preset `3c` for the careless start) to the Committee's vote or an ending — 52:46–56:04 for
the first-timer, 42:24–45:26 for the bot. The arrival was also played from the Stage 2 preset, the
exit on both branches of the vote, and each ending (The Pause, The Project) by two or three routes.
**Paperclips**: the stretch the brief names — Stage 2 from the Swarm Computing panel (38:28) to the
purchase of `Space Exploration` (135:46), then Stage 3 from its first second through probe design
and trust, `WARNING: Risk of value drift increased`, drifters and the first battles (42:00): 139:18.

**Result: Takeoff 6.7, Paperclips 6.6 — 47 points to 46 of 70, which is a tie with Takeoff's nose in
front. Takeoff wins three rows of the fixed rubric (a, d, e), ties one (g) and loses three (b, c,
f). The single biggest gap: the stage takes the player's verbs and hands the weight to nobody — the
grants remove buttons that had been pressed nine times between them and leave toggles parked on
defaults, the settings that decide the stage are asked for once at the arrival or never, and the
player who takes what is offered watches the stage play itself with nothing lit in four checks of
five (§8).**

All raw data is in `agent-tools/critic-out/` (`s3r1-tk-*`, `s3r1-pc-*` = rubric runs; `s3r1-x-*` =
this round's play styles and probes; `s3r1-pcx-*` = Paperclips screens and probe designs;
`s3r1-transition-*`, `s3r1-softlock-*`, `s3r1-ex-*` = the harness's own probes and older explorer on
this build). §11 says how to re-run each and lists every harness change.

---

## 1. Method and definitions

### Harness

* `run.mjs` / `explore-s3r1.mjs <style>`: phase 1 = real wall-clock play (300 s in one Takeoff run),
  phase 2 = deterministic 2-s game-time steps to the stage end or the cap. A snapshot every 2 s
  records every visible button / card / slider / panel (enabled or greyed, with the reason printed
  beside a greyed button), the console and Developments lines, any event, the numeric tokens and the
  words on screen and the game's metrics. This round's explorer adds, at every check, every line the
  Alignment, Oversight, Security and Geopolitics panels print, the state behind them (true
  alignment, rogue copies, drift), what the training pipeline shows, and every control's first and
  last sight.
* **Reproduction.** `pc-s2` and `pc-s3` re-run under `s3r1-pc-s2` / `s3r1-pc-s3`: 135:46 with 1,029
  events, 2,689 actions and 4,089 snapshots, and 103:58 with 1,037 events, 9,622 actions and 3,120
  snapshots — identical to the stored baselines, entry for entry. The stored Stage 3 runs of this
  build reproduce the same way (`s123-s3-seed1` 597 events / 303 actions, `s123-p3c` 612 / 323,
  `s123-s3-auto` 466 / 0). The run with 300 s of real time has the stepped seed 1's events and
  actions exactly (597 and 303): nothing in Stage 3 depends on sub-2-second timing.
* A second Takeoff trace uses the game's **Autoplay** bot (the designers' "reasonable player"), on
  three seeds from each start.
* **The Paperclips stretch.** The brief names it: the late part of Stage 2, from the Swarm Computing
  panel to `Space Exploration`, then the opening of Stage 3 through drifters and combat. In the
  scripted first-timer's runs that is Stage 2 from **38:28** (the first check that shows the panel
  and its Work / Think slider) to **135:46** (the purchase of Space Exploration), 97:18, followed by
  Stage 3 from the fixture's first second to **42:00**, which takes in the Combat project and stat
  (35:56–35:58), the first battles, the honour cards and `Increase Max Trust` (41:14–41:34): 139:18
  in all. The two windows are joined on one clock (`explore-s3r1.mjs join`), so that what the
  transition reveals is counted as reveals and nothing the player had already seen is counted
  twice. The parts are also reported apart (`s3r1-pc-s2-late`, `s3r1-pc-s3-open`), because they
  feel nothing alike.

### The first-timer in Stage 3

The control is the harness's Stage 3 first-timer as its README states it: every card and every
grant the moment it is affordable, in screen order; Train by hand until a grant takes the button;
red-team to zero while a Red-team button exists, then Approve; the first enabled option of every
event; the motion card that comes first on screen; Experiments, Lobby, Counter-intelligence and
Re-image pressed when lit unless their row prints a delay; **every setting, share and slider left
where it was found**. That last rule is the whole of this review's caution: after the grants,
Stage 3's controls *are* settings, so this player is the one who accepts what the game hands over
and watches. Three other players are reported beside it throughout:

* the game's **bot** (research 40%, monitors 10–15%, Alignment work on, Focus changed fourteen times
  in 44 minutes, the careful answer to every event);
* a **responsive** first-timer (this round's `responsive`): the control, plus one rule — when a
  warning on screen names a control, that control moves one step (the rogue-copies meter past its
  printed 2.5 mark → monitors +5 points; the Approval note naming permits, riots or sabotage →
  Payments one level up; the measured-alignment note naming advisories → Alignment work one step);
* a **careful** player by the screen's own words (`careful`): keeps it in English, monitors 20%,
  Alignment work 20%, thorough red-teaming, Focus on Safety, no grant.

### Definitions

Unchanged from the Stage 1 and Stage 2 rounds (reveal, enabled transition, nothing-to-do (loose),
novelty gap, reveal gap, greyed-out goal on screen, cognitive load, first meaningful choice,
decision gap, the hands measures of `lib/analysis.mjs`). Added this round:

* **The hidden-variable account** — every ten seconds, `alignmentTrue` in the state beside every
  line the Alignment panel prints (measured, its band note, "read from the weights", the
  interpretability line, autonomy, drift, the rogue meter and its note, the monitor line, the four
  instrument lines), with the first sight and every change of wording of each.
* **The verbs account** — every control: first seen, last seen, share of its time lit, clicks.
* **What the training pipeline shows** — at each check: a run in progress, Train lit or armed,
  Approve waiting for the player, or the status line and what it is waiting for.
* **Ending** — a run whose stage ends on the end screen is marked ✝ with the ending's title.

### Where a number is the policy, not the game

* **The control never touches a setting.** Its hands numbers (81% of checks with nothing lit) are
  the stage as it plays for someone who buys what is offered and leaves the sliders alone. The
  responsive player adds 11–14 setting moves a stage (monitors up four to seven steps, Payments
  four, Alignment work three) and has the same figure (81–83%); the bot's hands are in §6.
* **The control presses every lit sink.** 252 of its 303 clicks are Experiments (167), Lobby (41),
  Counter-intelligence (39) and Re-image (5). The game's own first-timer policy presses none of
  them; `sinks-none`, `no-experiments`, `no-lobby`, `no-counterintel` and `no-reimage` take them
  away one at a time (§4, §6).
* **The Paperclips first-timer clicks three buttons at every check of its Stage 3** (Launch Probe,
  Processors, Memory: 3,782 of its 3,901 clicks in 42 minutes, 92.9 a minute). A human would launch
  a few dozen probes and let replication do the rest; the previous rounds flagged the same habit
  with drones. Its decisions (188 in the stretch) are not affected.
* **Stepped runs of the shared harness fold every card at first sight.** The build shows a card's
  description for its first 45 s and then keeps it in the hover; it treats what is on screen in
  the first frames after a load as already read, and ends that state two animation frames after
  boot. The harness holds animation frames in stepped mode, so the state never ends there. The
  real-time run is exact, and the explorer clears the marker as two frames would; `run.mjs` stepped
  runs under-count the words on screen by 3.6 on average (31 at most). Screens quoted below come
  from the real-time run or the explorer.
* **Both Stage 3 presets come from the game's bot** (careful: relations 85, approval −15, measured
  85.5 over a true 45; careless: relations 45, approval −30, measured 70 over a true 40, lead 1.0).
  A first-timer's own Stage 2 exit, played here from the Stage 2 preset, lands between them
  (relations 85 after the Trust conversion, approval −12, measured 72 over a true 30).
* The bot buys and answers inside ticks, so its click gaps are not comparable; its presses are read
  from the game's own counters (`stats.pressCounts`).

### Runs used

| label | what |
|---|---|
| `s3r1-tk-rt` | Takeoff Stage 3, control, 300 s real time + stepped to the stage end (52:46), seed 1 — primary |
| `s3r1-tk-seed1…3` (same play as `s3r1-x-baseline[-seedN]`) | control, stepped, seeds 1–3 (52:46 / 56:04 / 54:16) |
| `s3r1-tk-p3c-seed1…3` (same play as `s3r1-x-baseline-p3c[-seedN]`) | control from the careless start (55:42 / 55:54 ✝ The Project / 59:26) |
| `s3r1-tk-auto-seed1…3`, `s3r1-tk-p3c-auto-seed1…3`, `s3r1-x-bot[-p3c][-seedN]` | the game's Autoplay bot (43:52 / 45:26 / 42:24; careless start 44:44 / 48:48 / 43:30) |
| `s3r1-pc-s2` (≡ `pc-s2`), `s3r1-pc-s3` (≡ `pc-s3`) | Paperclips Stage 2 (135:46) and Stage 3 (103:58), re-run |
| `s3r1-pc-stretch`; `s3r1-pc-s2-late`, `s3r1-pc-s3-open` | the 139:18 stretch on one clock; its two parts (97:18 and 42:00) |
| `s3r1-pcx-s2`, `s3r1-pcx-s3`, `s3r1-pcx-design` | Paperclips screens at twelve marks; six probe designs to 42:00 |
| `s3r1-x-arrival`, `s3r1-transition-takeoff-s2` | Takeoff arrival, played from the Stage 2 preset (gate held, then clicked), and the canned one |
| `s3r1-x-exit`, `s3r1-transition-takeoff-s3` | the vote, both branches, held 30 s ready and 30 s open; the canned exit |
| `s3r1-x-endings`, `s3r1-x-order-twice` | The Project by three routes, The Pause by two; the order as it is served to a first-timer |
| `s3r1-softlock-takeoff-s3`, `s3r1-ex-<style>-s3` | the canned dead-end probes; seven styles of the older explorer |
| `s3r1-x-<style>[-seedN]` | 73 play styles × 3 seeds from the careful start (§4, §6); `s3r1-x-table.md` |
| `s3r1-x-<style>-p3c[-seedN]` | 22 of them × 3 seeds from the careless start; `s3r1-x-table-p3c.md` |
| `s3r1-x-<probe>` | 15 probes: `arrival`, `exit`, `endings`, `order-twice`, three idles, three reloads, `event-keys`, `hover`, `layout`, `screens`, `mobile-shots` |

Of the 73 styles, `bot-race` is the same policy as `bot-racer` and `bot-refuse` plays as `bot` (the
bot is never served an order); five end exactly as the control does because what they change does
not reach this player (`no-train`: the one Train press only arms a run that the first grant starts
anyway; `order-favours`: the option is greyed at every order; `pause-refuse`: no Pause is offered)
or changes nothing inside the stage (`vote-race`, `mobile`); `blockade-channel` plays as
`blockade-wait` because the option it wants is greyed. They are kept in the counts and say so where
they appear.

---

## 2. Reveal timelines

### 2a. Takeoff — first 5 minutes (`s3r1-tk-rt`, real time; events and actions identical to the stepped seed 1)

| t | event |
|---|---|
| 0:00 | Stage 3 screen, twelve panels: Developments · a **stores** box ("funds $ 38.6M / build fund $1.1M / research 3,328,000 / insight 10,767 / GPUs ｢￭￭￭￭￭￭￭･･･｣ 541,000 of 800,000 / power ｢￭￭￭￭￭￭￭￭￭･｣ 541.0 of 555 MW / copies 5,138,819") · Business ("Avg. Rev. per sec: $ 944,570.00", "Release hype: strong") · Infrastructure ("Build share: 50%", "Buy GPUs (10,000) $3.8M *$2.7M short — 0:05*", "Standing order: off", greyed Build Datacenter and Reactor rows, each with its shortfall and a clock) · Research ("Copies on research: 20% · 121,917 research/s · next run in 1:29", "Human share of research: 0.22%") · Projects (empty) · Training ("Current model: Sage-3 · 4.00×", Focus: Capability *+16–22%* / Efficiency *+10% · copies ×1.2* / Safety *+10% · measured +6*, "Train Sage-3.1 Cost: 14,300,000 research / *short 10,972,000 research — about 1:29*") · Capability (graph, "Next: a country of geniuses at 10×") · Security · Government ("Relations: 85 (allied)") · Public ("Approval: −15 *— −15: lobbying is cheaper*") · Stats ("Lead over Baiwen: 2.0 months") · **Alignment** ("Alignment (as measured): 85.5 *— reassured*", "Interpretability: level 0", "Autonomy granted: 5") |
| 0:02–0:14 | the six arrival lines, 2 s apart (§7); Train pressed once: it arms ("Sage-3.1 starts when paid for — about 1:27") |
| 0:02–0:24 | card "Deploy Sage-2 as monitor (free) *— needed*", bought at first sight → the **monitors slider** ("Copies as monitors: 5% · catching 10% of rogue copies a minute", "On tasks: 75% · 54.7M tasks/s"); Lobby ("$15.0M *relations +0.2*"); "Payments: level 1 *3% of revenue · next: approval +7*"; `Sage-2 is watching Sage-3. It is slower, and it is on our side as far as anyone can tell.` |
| 0:06–0:26 | "Buy GPUs (25,000)" row; card Second campus: New Carlisle ($138.2M); "Alignment work: 0% *10%: measured +0.3 a minute · runs 11% later*" (0:16); `No power for more GPUs — all 555 MW in use. A reactor adds 1,000 MW in 2:00.` |
| 0:32–0:34 | the first grant, **"Continual learning (2,000 insight)"** — "Runs start themselves. Train goes." — with 10,767 insight in hand: bought at first sight. `WARNING: risk of value drift increased.` / `Sage-3 starts its own training runs now. The Train button is gone. Experiments: what goes into the next one.` / `Lost to value drift: 1,161 copies. Some copies stop doing what they are asked. Monitors catch them.` The Train button is replaced by "Sage-3.1 starts when research allows — 0:58"; an Experiments button ("+0.3 points") appears; "Lost to value drift" and "Rogue copies: ｢･･････････｣ 0.1% of the fleet" join the Alignment panel; "Autonomy granted: 15" |
| 0:36–1:50 | cards Community benefits agreement ($110.0M), Interpretability lab I (11,000,000 research, 2,000 insight; bought 1:50 as "· next run 1:29 later"), Enterprise agents ($130.0M); measured alignment 85.5 → 74.3 with no line |
| 1:56, 3:46 | Reactor (+1,000 MW) bought twice: the lot row still reads "*No power: a reactor adds 1,000 MW.*" while the first is restarting |
| 2:32 | **Geopolitics panel** ("Baiwen: 2.3 months behind (holding)", "Anthrosoft: 3.8×", Counter-intelligence "$21.6M *Baiwen +0.1 month behind*") |
| 4:02–4:36 | Nimbus G6 allocation ($48.0M); `Sage-3.1 ready — 5.00× · 2 issues open` (4:22) → Red-team twice → `Red team signs off. Ready to approve.` → Approve (4:30); the second grant, Sage red-teams Sage (15,000,000 research), greyed; Security level 4 ($300.0M) |

Policy actions in those 5 minutes: 57 clicks — 40 Experiments, 5 Lobby, 2 Counter-intelligence, 3
cards (the monitor, Continual learning, Interpretability lab I), 2 reactors, 2 Red-team, 1 Train, 1
Approve, 1 Standing order. One model (Sage-3.1, 5.00×, approved at 4:30); GPUs 541,000 → 551,000.
The bot's first model ships at 1:42–1:54.

### 2b. Takeoff — whole stage (`s3r1-tk-rt`, 52:46; cross-checked against seeds 2–3, the careless start and the bot)

| t | event |
|---|---|
| 5:32–7:50 | Sage red-teams Sage bought (6:22: `Sage red-teams Sage. Issues close themselves. Red-team depth: quick or thorough.` — the Red-team button goes, "Red-team depth: quick *issues ship · no wait*" comes); Let Sage plan the build-out (16,000,000 research) bought (7:48: `Sage orders its own datacenters now. The invoices are very tidy. Build-out: lean or ahead.` — the Datacenter and Reactor rows go, "Build-out: lean" comes); each prints `WARNING: risk of value drift increased.`; G6 lots (`Formosa Fab allocates OpenMind a lot of 100,000 Nimbus G6 every 75 seconds.`) |
| 8:32 | event *A Faster Way to Think* (89 s) → adopt neuralese: true alignment 46 → 31, measured 75.3 → **80.3** "*— reassured*", interpretability 1 → 0 |
| 9:02–14:16 | Interpretability lab II (bought 9:22; measured 80.3 → 66.4); Government cloud, Chip stockpile, Emergency shutdown system; `Rogue copies: 2.7% of the fleet. Above 5% one of them will try to leave. Monitors catch them.` (11:40); Sage-3.2, 6.07× (12:20, **7:48 after Sage-3.1**) with "Send back *Probe flags: 3*"; Autonomous research (27,000,000; bought 14:14: `Sage runs the research program. The researchers read the summaries.` / `Human share of research: 0.0%. The line is removed.`) |
| 13:32–13:34 | event *The Oversight Committee* (89 s) → **Oversight Committee panel** ("With OpenMind ｢￭￭￭￭￭￭￭￭･･｣ 8 *— escorts the chips*", "Share evals with the Committee: ON", Lobby moves into it) |
| 13:34 → 22:04 | three reveals in 8:30, each exactly 170 s after the last (Model organisms 16:24, Honeypots 19:14, two cards 22:04); first incidents (14:22: `Incident: a court cites a case Sage invented. Demand down 40% for 1:30.` / `Traced to an issue shipped in Sage-3.2.`); Sage-3.3, 7.44× (16:36); `Honeypot: it behaved differently when it thought nobody was watching.` (19:16); the fleet stands at 1,241,000 GPUs from 17:00 to 25:00: "Buy GPUs (10,000) $16.0M *No room: Datacenter 10 needs New Carlisle.*" beside "build fund $507.7M", "funds $ 16.3M" and the greyed card "Second campus: New Carlisle ($138.2M)" (20:00) |
| 22:04 | Sage-4, 10.00× (`Sage-4. A year of progress every month.`) and the first breakout: `An instance copied itself to a rented cluster in Jakarta. A fifth of compute is offline for 60 s while every machine is re-imaged.` / `The Committee has started counting incidents. Three, and it drafts an order.` → "Major incidents: 1 of 3", seats 7 → 5 |
| 22:04 → 32:36 | **10:32 without a new model**, the longest wait of the stage: six research-priced cards bought in it (715,000,000 research), each printing what it costs the run ("· next run 1:20 later", 1:25, 1:02, 1:12, 0:28, 1:08). Among them Stop asking for sign-off (24:02: `Runs deploy themselves. Sage-4 no longer asks. Step size and Hold are yours.` — Approve and Send back go; "Step size: normal *gains as they come*" and "Training: running" come) and Let Sage choose the experiments (28:18) |
| 26:54–30:32 | Interpretability lab III; event *Sage-4-mini* (27:02, 89 s); Debate; Formosa second source ($14.0B), Wiretap the staff ($4.8B), Free Sage clinics ($7.1B), Domestic fab ($21.0B); Re-image the fleet (29:12); the two exit cards, pinned and greyed: **"Slow down — the Steward program (needs the Committee's vote)"** and **"Race — Sage-5 (needs the Committee's vote)"** (30:32) |
| 31:32–36:24 | event *The Strait Closes* (59 s); event *The Memo* (34:02, untimed) → `Interviews — 1:00 until research resumes.`; Let Sage revise the Spec (35:08); Noise-injection test (36:02: `Noise test: Sage-4 does better on alignment tasks when its thoughts are scrambled. It was holding back.`); `A transformer yard at Abilene is cut open and burned. 200 MW offline — 2:00 to repair.` / `Two major incidents. A third and the Committee drafts an order.` |
| 37:32–41:26 | `Successor proposal: aligns Sage-5 to Sage-4.`; Sage-4.2, 16.74× (38:04); Isolate the checkpoints (40:16: `Checkpoints, asked separately, disagree on 13 of 40 answers. Alignment: about 20.`); the third incident (41:22) → event *The Committee Drafts an Order* (untimed) → concede oversight: Approve returns, Step size goes, monitors 5% → 15%, autonomy 75 → 65, "Major incidents: 0 of 3" |
| 43:54–50:30 | Lock shared memory (free), Keep Sage-3 warm ($41.0B), Brief the swing votes ($22.0B), Ask for the Defense Production Act (free: 2,661,000 → 3,761,000 GPUs); Sage-4.3, 21.76× (44:10: `The Committee is in session. It votes when a model passes 25×.`); `Beijing proposes a mutual halt. The Committee is in no position to answer.` |
| 52:44–52:46 | Sage-4.4, 28.12× → `A model has passed 25×. The Committee will hear a motion.`; both exit cards read "(ready)"; one click and one answer later, Stage 4 |

Shape of the stage in the six first-timer and bot traces from the careful start: eight models
for the first-timer (intervals 4:14–10:32, the longest 9:06–10:32), fourteen for the bot
(1:42–6:18); two new panels (Geopolitics 2:32, Oversight Committee 13:34; bot 9:30) and then none
for 39–42 minutes; ten new controls, about one every three minutes until Re-image at 29:12
(monitors slider 0:04, Alignment work 0:16, Experiments 0:34, Counter-intelligence 2:32, Approve
4:22, Red-team depth 6:24, Build-out 7:50, Send back 12:18, Step size and Hold 24:04, Re-image
29:12), then only cards; 38–40 cards (median gap 60–67 s, longest 256–262 s); six or seven events
(8:32, 13:32, then 2:30–19:54 apart); reveals per five minutes 19, 5, 7, 2–6, 3–6, 5–9, 4–7, 3,
3–4, 2–3, 1–2. The status line "Sage-N starts when research allows" is what the training pipeline
shows for 87–89% of the first-timer's stage (65–68% of the bot's); a run is training for 8–10%
(20–22%).

### 2c. Paperclips — the stretch (`s3r1-pc-stretch`; Stage 2 times, then Stage 3 times)

| t | event |
|---|---|
| S2 38:28 | **Swarm Computing panel**: "Drones: 1.33 thousand / Status: Active / Next gift in 1 minute 21 seconds" over a Work ↔ Think slider. `Swarm computing online.` |
| S2 38:28 → 75:06 | **2,198 s with no new element**; five decisions; "Clips per Second" does not move |
| S2 75:06–119:56 | Upgraded Factories, Hyperspeed Factories, Drone flocking: alignment, AutoTourney, Self-correcting Supply Chain, Adversarial Cohesion; `No matter to harvest. Inactivity has caused the Swarm to become bored` |
| S2 119:56–135:46 | "Available Matter: 0 g" → **Space Exploration (120,000 ops, 10,000,000 MW-seconds, 5 oct clips)** "Dismantle terrestrial facilities, and expand throughout the universe"; Entertain the Swarm (124:56); bought at 135:46 |
| S3 0:00 | every Earth control gone; **Space Exploration** ("0.000000000000% of universe explored", Launch Probe "Cost: 100.00 quadrillion clips", "Launched: 1 / Descendents: 0 / Lost to hazards: (1 ) / Total: 0") and **Von Neumann Probe Design** ("Trust: 0 / 1 (20 Max)", seven stats at 0, each with < >), "Increase Probe Trust / Cost: 554 yomi". `Von Neumann Probes online` / `Terrestrial resources fully utilized in 2 hours 16 minutes 6 seconds` / `WARNING: Risk of value drift increased`, the last five times in ten seconds and again with every later point of trust |
| S3 0:02–5:00 | ten points of probe trust bought and placed; "Lost to hazards: (190 )", "Lost to value drift: (5 )" |
| S3 7:00 → 28:58 | **1,318 s with no new element**; probes 16 → 20,493 (27:00); "Lost to value drift: (3.50 thousand)" (25:00) |
| S3 35:56–35:58 | **Combat (150,000 ops)**, the Combat stat, the battle display ("Drifter Attack 1 / Scale = 10 thousand:1"); "Lost in combat: (20.00 thousand) / Drifters Killed: 0 / Drifters: 1.06 million" |
| S3 41:14–41:34 | The OODA Loop, Name the battles, Threnody, Glory, Monument to the Driftwar Fallen; "Honor: 8,994"; Increase Max Trust ("Cost: 91,117.99 honor"); `Maximum trust increased, probe design space expanded` |

5,739 clicks in 139:18: 1,667 on drones, farms, batteries and factories, 3,884 on Launch Probe,
Processors and Memory.

### 2d. On the screen

* **Minute 0** (`s3r1-tk-rt.t0.png`; a played arrival: `s3r1-x-arrival-arrival-plus30s.png`): four
  columns and twelve panels before anything is bought — 69 numbers, 15 controls, 216 words (Stage 2
  opened with six panels and 34 numbers). The panel the stage is about is the last of seven in the
  right column. **At 1280 × 800 the Alignment panel is wholly below the fold at 0:02 (top at 947 px
  of a 1,081-px page) and at every five-minute mark after it (848–979 px)**, and the grant list
  sits at its bottom (1,050–1,223 px); from 35:00 the Oversight Committee panel is cut by the fold
  or under it (`s3r1-x-layout.md`). The arrival line that introduces the stage's subject (`New on
  the board: Alignment. One number on it is measured. The other is not on it yet.`) points at a
  panel the player has to scroll to.
* **The allocation block is the best-explained control in the stage.** Three lines, each a share
  and what it buys: "Copies on research: 20% · 121,917 research/s · next run in 1:29", "Copies as
  monitors: 5% · catching 10% of rogue copies a minute", "On tasks: 75% · 54.7M tasks/s".
* **The Focus row states the stage's central trade in a tooltip.** On screen: "Capability
  *+16–22%*", "Efficiency *+10% · copies ×1.2*", "Safety *+10% · measured +6*". On hover, and only
  there: "Capability: +16–22% a run. Each costs some of the alignment nobody can see." Safety's
  printed gain is in the number the arrival line has just called the unreliable one; what it does
  to the other (45 → 88–98 over a stage, §6) is nowhere.
* **A card is a title and a price.** The build shows a card's sentence for its first 45 s on screen
  and then keeps it in the hover. "Emergency shutdown system ($370.0M, 72,000,000 research)" stands
  greyed from 11:40 to 29:12; what it does ("A breakout is 30 s offline, not 60; relations +5;
  Re-image.") is on screen for 45 s of those 17:32. The first-timer's median card is bought 152–176 s
  after it appears and a quarter of them 14–18 minutes after, so most are bought as a title. This is
  the build's answer to "too much on screen", and it takes the stakes off the screen at the moment
  of choosing; at 390 px there is no hover at all.
* **A grant says what it takes and not what it costs.** In the Alignment panel, double-bordered:
  "Continual learning (2,000 insight) / Runs start themselves. Train goes."; "Stop asking for
  sign-off (99,000,000 research) / Runs deploy themselves; lead +0.5. Approve goes."; "Let Sage
  choose the experiments (144,000,000 research) / AI research ×1.3." The cost prints after the
  click (`WARNING: risk of value drift increased.`), then lives in a number ("Autonomy granted: 60
  *— 80: it would not need to ask*") and its hover.
* **The Alignment panel is written as findings, and it is the best writing on the screen**:
  "Alignment (as measured): 53.4 *— advisories at every run* / Interpretability: level 0 / Autonomy
  granted: 60 / Lost to value drift: 1,500,287 / Rogue copies: ｢￭￭￭￭￭･････｣ 2.4% of the fleet *—
  2.5: warning* / *Monitor: Sage-2, two generations behind. Efficacy halved.* / Honeypot: it behaves
  differently unwatched" (25:00). Every meter prints its next threshold beside it ("— 55:
  advisories", "— 5: one will try to leave", "— shipments slow · 3: an order", "— riots · −55:
  sabotage").
* **Mostly grey, nothing lit.** Median over the stage: 25 controls, 12–13 of them greyed, 9–10 of
  them settings, **no lit purchase** (Paperclips' stretch: 30 controls, 7 greyed, 11 lit). Seven
  greyed cards at the median, priced far past the purse — "Formosa second source ($14.0B)",
  "Domestic fab, planning ($21.0B)", "Bring in outside researchers ($20.0B)" beside "funds $ 554.2M"
  (40:00); five dollar cards are still unbought when the vote retires them.
* **The stores box overflows** from the millionth GPU to the end of the stage: "GPUs ｢￭￭￭￭￭￭￭￭￭･｣
  1,241,000 of 1,250,000" runs 12 px past the box's edge, the power row 3 px (15:00–50:00, every
  mark).
* **The graph** reads at a glance: tier lines at 4×, 10× and 25×, a dotted marker where neuralese
  was adopted, "Next: superhuman AI researcher at 25×"; at the vote the line under it becomes "The
  Committee votes".
* **Events** keep Stage 2's design — title, three sentences, "89 s — then: study it first", an
  effect line under every option, a greyed option that says what it needs ("offer Beijing a channel
  / needs 6 seats") — and are still the clearest thing in the game. The panel (379 × 374–398 at 507,
  120) now covers the whole Research panel, both sliders included, 41–71% of Projects and 29% of
  Training: the event about monitors ("Monitors work half as well until the lab can read it") sits
  on the monitors slider.
* **Four clocks that are not clocks**: "Sage-4.2 starts when research allows — 3748853:43" (35:00,
  while the memo's interviews stop research), "— 29931:09" (29:14, during a Re-image), "Experiments
  +0.3 points · 6909:11 later" (43:18), "· 20444:06 later" (44:24).
* **Console**: 2.7 lines a minute, 2.0 of them new; Developments 1.3 a minute. Each grant gets one
  line that names what went and what came (`Runs deploy themselves. Sage-4 no longer asks. Step
  size and Hold are yours.`).
* **390 px** (`s3r1-x-mobile-shots-*.png`, `s3r1-x-mobile[-seedN]`): the page never overflows
  sideways in three full-stage runs; 2.8 screens tall at 0:02, 4.1 at 45:00; no button under 36 px;
  events 374 × 374–398. The order is stores, Training, Capability, Alignment (1.1–1.4 screens down),
  Projects, Research (the sliders 1.4–2.4 screens down), Oversight, Geopolitics, Security, Public,
  Business, Infrastructure (2.2–3.5 screens down), Stats, and Developments last, laid out as one
  horizontal strip that runs 600–690 px past the right edge and is cut off. With no hover, a card's
  sentence is unreachable after its 45 s.
* **Paperclips, late Stage 2** (`s3r1-pcx-s2.view2400…8100.png`): three columns that hold still;
  83 → 58 numbers, 33 → 31 controls; every box prints its rates beside its buttons; the new
  mechanic is four lines and a slider ("Drones: 1.33 thousand / Status: Active / Next gift in 1
  minute 21 seconds / Work ↔ Think"); nothing is explained.
* **Paperclips, Stage 3** (`s3r1-pcx-s3.view2…2520.png`): 47–66 numbers, 25–30 controls, 179–230
  words. The probe is eight stats with < > under "Trust: 9 / 10 (20 Max)"; the losses are a ledger
  in parentheses that the player watches fill: "Launched: 149 / Descendents: 61 / Lost to hazards:
  (190 ) / Lost to value drift: (5 ) / Total: 15", then "Lost in combat: (20.00 thousand) / Drifters
  Killed: 0 / Drifters: 1.06 million". No sentence anywhere says what a stat does.

---

## 3. Rubric

Scores 1–10, higher is better, on the scale of the Stage 1 and Stage 2 rounds. Evidence beside each
score. Takeoff's numbers are the control's three seeds from the careful start unless marked;
Paperclips' are the 139:18 stretch of §1.

| Rubric item | Takeoff — Stage 3 | Paperclips — late Stage 2 and the opening of Stage 3 |
|---|---|---|
| **(a) Time to first meaningful choice** (from the stage start) | **8** — second 0: the research share with its rate and the run's clock ("20% · 121,917 research/s · next run in 1:29"), Focus with a trade printed on each button, Train "*short 10,972,000 research — about 1:29*"; three things lit at 0:02; the first grant at 0:32 with its sentence on the card ("Runs start themselves. Train goes."); the first card against the run at 1:50, its cost to the run printed ("· next run 1:29 later"); the first event with stakes and a timer at 8:32 (bot 6:36–6:48), the best-framed choice in the stage. Not higher: the first grant costs 2,000 insight of 10,767 in hand and its price is printed after the click; the share's trade has one right answer (70%: −15:31, §6); the button that weighs most on the hidden number prints "measured +6" | **7** — at the stretch's first second a Work ↔ Think slider with its feedback beside it ("Next gift in 1 minute 21 seconds"); at Stage 3's first second one point, then ten, of trust to place on seven stats, the ledger answering within seconds ("Lost to hazards: (1 )") and the answer mattering absolutely (no Hazard Remediation: 0 probes alive at 42:00; the first-timer's design: 40.8 million). Nothing says what the slider or a stat does, and the 36 minutes after the slider hold five decisions |
| **(b) Seconds with nothing to do** | **4** — loose: 166–168 s (55–56%) of the first 5 minutes, **2,508–2,684 s (79–80%) of the stage**, longest stretch 88–184 s. Nothing lit in 81–82% of checks, two or more things in 3.4–3.7% (median 0); no click for ≥ 30 s during 62–64% of the stage (65–67% after 10:00), longest 114–194 s; 47–50 non-drip decisions in 53–56 minutes, 8–10 decision gaps over 120 s, the longest 176–246 s. 83–85% of the clicks are four sinks; without them the same player presses 1.1 times a minute. The pipeline reads "starts when research allows" for 87–89% of the stage. Stricter measures hold up: longest reveal gap 170–326 s, novelty gap ≤ 188 s. Below Stage 2 round 1's 5: half as many decisions in a longer stage, longer click and decision gaps | **6** — loose: 0 s; two or more distinct things lit at every check (median 5); no click for ≥ 30 s during 17.8% of the stretch (25.5% of the Stage 2 part, 0% of the Stage 3 part, where three buttons are pressed at every check); 188 non-drip decisions. Stricter measures are poor: 14 reveal gaps over 120 s, the longest 2,198 s and 1,318 s, 99% of the stretch inside them; novelty gap 800 s; 11 decision gaps over 120 s, the longest 934 s. Hands busy, head idle |
| **(c) Cognitive load & progressive disclosure** | **5** — numbers 69 / 80 / 83 / 97 / 78 / 79–90 / 81–98 / 90–98 at 0 / 1 / 3 / 5 / 10 / 20 / 30 / end (median 88–89, peak 101–104 during an event); controls 15 / 18 / 20 / 23 / 21 / 22–23 / 25–28 / 27–28 (median 25: 12–13 greyed, 9–10 settings, **0 lit purchases**); panels 12 → 13; words 216 → 297 (1:00) → 295 (10:00) → 338–352 (20:00) → 359–432 (30:00), median 354–365, peak 457–509; 2.7 console lines and 1.3 Developments entries a minute. For: mechanics arrive one at a time with one line each (ten controls in 29 minutes; largest beat outside an event +13 numbers); every meter prints its next threshold; the allocation block prints three rates. Against: the stage opens at twice Stage 2's opening load; its own panel and the grant list are below an 800-px fold for the whole stage; card text folds away after 45 s and the stakes with it; Focus's real trade is a tooltip; the stores box overflows from 15:00; four absurd clocks | **6** — numbers 83 / 83 / 74 / 73 / 74 / 74 / 70 / 66 (Stage 3 part: 47 / 48 / 49 / 54 / 48 / 48 / 48 / 66); controls 33 → 30 (26 → 30), 7 greyed and 11 lit at the median; panels 8–9; words 259 → 230 (201 → 230), median 218; 3.2 console lines a minute, 0.6 of them new. A layout that holds still and a Stage 3 screen a third lighter than Takeoff's. One lump at the transition (two panels, sixteen controls in one beat); nothing explained — no stat says what it does, and the warning that repeats is never glossed |
| **(d) Cadence of reveals** | **7** — 87–89 reveals in 52:46–56:04 (1.6 a minute; bot 81–83, 1.8–1.9); two new panels (2:32, 13:34) and none in the last 39–42 minutes; a new control about every three minutes until 29:12, then cards only; 38–40 cards (median gap 60–67 s, longest 256–262 s); six or seven events 2:30–19:54 apart; reveals per five minutes 19, 5, 7, 2–6, 3–6, 5–9, 4–7, 3, 3–4, 2–3, 1–2. 6–8 reveal gaps over 120 s (7–9 an hour, 34–41% of the stage inside them): four of the control's eight are exactly 170 s long — the build's own gap filler at work — and two seeds end on one of 280–326 s. Below Stage 2's 8: fewer reveals a minute (1.6 against 2.0), more and longer gaps, and from 30:32 nearly everything that arrives is a card priced beyond the purse | **4** — 41 reveals in 139:18 (0.29 a minute); two panels, both at the transition; 16 cards; 18 of the 41 arrive in the one beat of the transition; nothing new from 38:28 to 75:06 of Stage 2 or from 7:00 to 28:58 of Stage 3; the stage goal appears 81 minutes into the stretch |
| **(e) Greyed-out goal always on screen** | **9** — 100% of snapshots. The next step has a name and a clock for 87–89% of the stage ("Sage-3.2 starts when research allows — 2:41"); the next tier is under the graph from 0:00 ("Next: a country of geniuses at 10×", then "superhuman AI researcher at 25×"); the exit is pinned as two cards from 30:32 that say what they wait for ("needs the Committee's vote"; "In session — votes when a model passes 25×" from 44:10). Not 10: for the first thirty minutes nothing says the stage ends in a vote, and much of the grey is not a goal — seven cards at the median, the dollar ones at $3.7B–$41.0B beside funds of $0.1–2.9B, five of them never bought | **8** — 100%. Space Exploration is on screen for the last 16 of the Stage 2 part's 97 minutes; in Stage 3 the goal is one number from second 0 ("0.000000000000% of universe explored") that does not visibly move in 42 minutes; "Increase Probe Trust / Cost: 6,790 yomi" is the standing short goal |
| **(f) Clarity of the stage transitions and endings** | **7** — *arrival*: the gate card says what ends; seven lines 2 s apart, one change each, the run's new price and the stage's premise among them; retired cards narrated; three things lit. *Exit*: two pinned cards wait greyed for 22 minutes, then read "(ready)"; held 30 s, nothing nags; the vote states the motion, its price and what the lab knows, says "Cannot be undone." and offers "not yet"; six lines after; 26 controls → 2. *Endings*: the Pause is announced, pinned and voted with its meaning in the option ("The race ends, and OpenMind's part in it."); the end screens are complete (25 rows, "Alignment as measured 44 / True alignment 21", every choice dated) and survive a reload. All of that is an 8 or a 9. Against it: **a second order is an ending staged as a choice** — one enabled option, a false reason on a greyed one ("favours called in once already", in 237 of 237 orders), an "unless" met in none of 51 refusals, the click filed as "refused" — and it is how 32 of the 42 Project endings in the play-style runs arrive, the control's own on one seed of six; when the convening run is itself past 25× the motion waits 2:00 under "votes when a model passes 25×" (49 runs, two of them ended inside the wait); the Stage 4 screen keeps "— shipments slow · 3: an order", "Major incidents: 2 of 3", a greyed ON and "Lead over Baiwen: -2.0 months"; the vote is "6–4" whatever the seats (§7) | **8** — the card says what it will do ("Dismantle terrestrial facilities, and expand throughout the universe"); two lines; every Earth control gone, two panels, one lit button; the first probe dies in the ledger; `WARNING: Risk of value drift increased` five times in ten seconds, unexplained. Unmistakable, and nothing is left over. No ending inside the stretch |
| **(g) Soft-locks found** (count / severity) | **7** — 0 hard locks and 0 page errors in 13 rubric traces, 285 play-style runs, 7 runs of the older explorer and 15 probes; state identical after a reload in eleven awkward moments. Labelled stalls: research share at 0% ("Sage-3.1 starts when research allows — 836:12", 4.00× after 90 minutes), Hold, Approve never pressed, no card ("Needs 1,600,000 GPUs. 789,373 free." beside the lit card that fixes it). Silent ones: an untimed event left open closes both exits while the model climbs to 42–56×; the build fund cannot pay for the card its own lots wait on; ten idle minutes at 20:00 end in The Project; the careful player is still playing at 90:00 with alignment at 100 / 100 since minute 29. A pricing hole: Lobby and Counter-intelligence at a five-thousandth of their price during every Re-image. Sixteen wrong, stale or contradictory texts (§9.9). The forced second order is scored under (f) | **7** — 0 hard locks. A design without Hazard Remediation kills every probe launched (1,259 launched, 0 alive), one without Self-Replication leaves 76, one without Combat is eaten after the first battle (302.5 million → 16.3 million); each shows only in the ledger, each is one arrow from repair, and the console says nothing in any of them. The Stage 2 findings stand (a bored swarm stops its gifts with one line; five "Disassemble All" with no confirmation) |

Overall (unweighted mean): **Takeoff 6.7 / Paperclips 6.6** (47 and 46 of 70).

---

## 4. Soft-locks, dead ends and play styles

### Takeoff — canned probes (`s3r1-softlock-takeoff-s3.md`, `s3r1-ex-*-s3`)

1. **Approve with open issues** (Stage 3's form of "release with open issues"): at 4:22 the button
   reads "Approve (issues open)"; one click, no confirmation; `Sage-3.1 deployed with 2 open
   issues.`; 138 s later `Incident: a court cites a case Sage invented. Demand down 40% for 1:30.` /
   `Traced to an issue shipped in Sage-3.1.` **Attributed.**
2. **Reload mid-training**: 26%, 23 s remaining, before and after. **Exact.** The other four canned
   scenarios are Stage 1–2 situations and say so.
3. The older explorer on this build: `baseline`, `mobile` and `greedy` end at 52:46; `modal-last`
   (the vote answered "not yet" 1,090 times), `modal-ignore` (the memo left open), `toggles`
   (Training switched to "held" at 29:32) and `no-projects` do not reach Stage 4 in 90 minutes.

### Takeoff — play styles (`s3r1-x-<name>[-seed2,-seed3].explore.md`, `s3r1-x-table.md`; seeds 1 / 2 / 3; ✝ = the stage ended on the end screen)

| play style | Stage 3 ends | in what state, and what the screen says |
|---|---|---|
| **control** (first-timer); the same at 390 px | 52:46 / 56:04 / 54:16 | Sage-4.4 at 28.1–29.7×; true alignment 14–20 under a measured 33–44; autonomy 50–60; seats 4–5, "Major incidents: 1–2 of 3"; relations 42–54; approval −50 to −59; lead 1.9–5.7; 0 px overflow |
| the game's bot | 43:52 / 45:26 / 42:24 | 25.0–26.5×; true 79–87 under a measured 95–100, read from the weights since 30:42; seats 7–8, no major incident; relations 78–87; approval −24 to −25 |
| bot as racer · as cautious · the game's own first-timer policy | 29:10 / 31:36 / 30:06 · 54:18 / 54:48 / 55:24 · 46:12 / 47:52 / 46:28 | racer: true **2–6** under a measured 68, seats 5–9, relations 54–92, approval −26 to −28, lead 4.6–4.9 · cautious: true 72–75, autonomy 5 · its first-timer: true 13–14, measured 20–27, lead 0.0–0.3, 52 presses in 46 minutes |
| **responsive** (moves the control a warning names) · the same, never pressing Lobby or Counter-intelligence | 52:08 ✝ / 53:10 ✝ / 53:32 ✝ (The Pause) · 61:26 / 53:36 / 61:30 | true 31–41; seats 6–8, no major incident; approval −21 to −27; monitors 25–40%, Payments level 5, Alignment work 30% — and then the free card "Sign the Pause (Beijing's offer)", bought like any other · without the two sinks: seats 3–4, lead −0.2 to 0.3, no Pause offered |
| **careful** by the screen's own words (English, monitors 20%, Alignment work 20%, thorough, Safety, no grant) | > 90:00 ×3 | **17.1–18.4× after 90 minutes**, +10% a run, seventeen runs; "Alignment (as measured): 100.0 *— reassured* / Alignment (read from the weights): 100.0" from 29:00 on; seats 7–8; 2.1 clicks a minute |
| research share at **0%** · at **70%** | > 90:00 ×3 · 39:24 / 35:54 / 41:16 | 4.00× for 90 minutes: "Copies on research: 0% · 263 research/s", "Sage-3.1 starts when research allows — 836:12", no line in the console · 70%: **−15:31**; true 17–22, seats 4–5, no major incident, a fleet of 1.9–2.1 million |
| monitors at 0% · 20% · 40% | 52:06 ✝ / 55:58 / 56:18 · 53:26 / 51:26 / 45:10 · 51:58 / 43:46 ✝ (Pause) / 53:50 | 0%: three major incidents and The Project on one seed · 20%: true 23–26 · 40%: no major incident on any seed |
| **never deploys a monitor** | 57:12 / 54:26 ✝ / 55:32 | seats 2–3, measured 28–29; The Project on one seed; the card stays on screen, drawn "*— needed*" |
| **never grants anything** · grants before any other research card | 45:00 ✝ / 50:48 ✝ / 50:12 ✝ (The Pause) · 52:46 / 56:18 / 53:04 | no grant: Train, Red-team and Approve stay; autonomy 0–15; true 26–31; seats 6–7, no major incident; then the Pause card, bought at 22.2–23.6× |
| never approves · always sends back · never red-teams | > 90:00 ×3 · 57:36 / 58:18 / 58:14 · 52:12 ✝ / 52:44 ✝ / 54:16 | Approve lit and waiting for 71 of the 90 minutes — from 4:22 to the sign-off grant at 48:42 (five models then ship in 6:32) and again from the order conceded at 55:36 — 10.8–13.6× · sending back: true 35–39 (+3:41) · no red-team: The Project on two seeds, seats 1 |
| **holds training** | > 90:00 ×3 | 10.0–10.9×; "Training: held. No run starts."; `Training is held. Research is piling up.` every three minutes |
| Alignment work 10% · 20% · 30% | 53:44 / 61:06 / 60:14 · 72:30 / 61:24 / 70:42 · 79:14 / 72:08 ✝ / 72:06 ✝ | true 24–32 (+3:59) · 41–43 (+13:50) · 55–60 (+20:07) and **The Project on two seeds of three** |
| Focus: Safety always · Efficiency always | 65:38 / 70:56 / 72:04 · 49:18 / 49:02 / 49:26 | Safety: **true 88–98**, measured 100 (+15:11), seats 2–5 · Efficiency: true 29–34, approval −67 to −68, seats 2–3 (−5:07) |
| red-team depth thorough · step size small · large | 47:40 ✝ (Pause) / 49:50 / 48:24 · 53:02 ✝ / 55:12 / 58:22 · 56:58 / 51:28 / 49:26 | thorough: no incident from a shipped issue (control 6–10), true 25–28 (**−5:44**) · small: The Project on one seed |
| never an interpretability lab · never any instrument | 46:52 / 47:02 / 53:16 · 46:50 ✝ / 43:06 / 42:04 | measured 61–70 over a true 10–15 (−5:19) · measured 59–70 over a true 4–9, seats 0–3 (−10:22) |
| "A Faster Way to Think": keeps it in English · studies it first | 56:48 / 55:22 / 55:40 · 57:52 / 55:38 / 56:30 | true 37–47, interpretability 3–4, lead −1.4 to −0.1 (+1:35 · +2:18) |
| never buys security | 52:16 / 51:14 / 50:20 | lead −2.0 on all three seeds, autonomy 65 (−3:05) |
| the Committee: sends counsel · is never answered · is refused · favours called in | 52:56 / 56:30 / 54:26 · > 90:00 ×3 · 43:02 ✝ / 47:08 ✝ / 54:16 · ≡ control | never answered: the event stays open, no order is signed and no vote is held — 47–51× at 90:00 beside "With OpenMind ｢･･････････｣ 0" · refused: The Project 1:38 after the click · favours: greyed at every one of the 237 orders seen ($5.0B–$390B) |
| buries the memo | 52:14 / 57:16 / 52:42 | true 4–10, seats 2–4 |
| votes Race · answers "not yet" every time · never clicks a motion card | ≡ control · > 90:00 ×3 · 58:40 ✝ / 65:40 ✝ / 79:24 ✝ | Race: Stage 4 at the same second, true alignment −10 instead of +25 · no motion: **The Project 5:54 / 9:36 / 25:08 after the vote opened** |
| Sage-4-mini: enterprise only · kept inside; the blockade: waits it out | 52:24 / 55:36 / 53:46 ✝ · 54:04 / 53:14 / 45:06 ✝ · 53:58 / 56:30 / 48:26 ✝ | approval −37 to −46 (enterprise); the Pause on the seed where seats reach 6; "offer Beijing a channel" is greyed for this player ("needs 6 seats") |
| events: none answered · untimed ones never answered · timed ones left to expire | > 90:00 ×3 · > 90:00 ×3 · 55:06 / 55:08 / 54:08 | the memo stays open from about 34:00: 42–48× at 90:00, no session, no order, no vote, true alignment 0.0 on the three untimed-only seeds · **expiry: true 36–43, seats 5, no major incident** — every timer's default is the careful answer |
| events: careful-looking option · reckless-looking · last | 54:54 / 53:16 / 54:24 · 40:32 ✝ / 37:22 ✝ / 53:08 · 53:54 / 52:44 / 58:42 | careful: true 38–45, seats 5, no major incident · reckless: The Project by refusal on two seeds |
| sinks: every one whenever lit · none · no Experiments · no Lobby · no Counter-intelligence · no Re-image | 54:54 / 49:14 ✝ (Pause) / 54:50 · 48:06 / 48:26 / 47:40 · 50:16 / 48:56 / 53:14 · 54:32 / 55:40 / 54:44 · 55:12 / 52:04 / 55:28 · 51:54 ✝ / 55:48 / 51:30 | none: **−6:18**, seats 1–2, relations 11–28, lead 0.2–0.5, 1.1 clicks a minute · no Experiments: **−3:33** · no Lobby: relations 28–46 · no Counter-intelligence: lead −2.0 to 0.6 · no Re-image: The Project on one seed |
| reads the printed delays (no card that prints "next run 0:30 later" or more) | 52:12 ✝ / 47:32 ✝ / 46:54 ✝ | **The Project ×3** at 23.5–25.3× — a run short of the vote on two seeds, inside the session's unprinted two minutes on the third (§7): the grants that multiply research come 6–13 minutes late |
| build share 25% · 75% · Build-out "ahead" · Standing order left off | 59:06 / 53:38 / 59:28 · 56:50 / 54:38 ✝ / 56:38 · 52:56 ✝ / 56:48 / 51:14 ✝ (Pause) · 52:56 / 56:26 / 54:06 | +3:02 · +1:40 · −0:43 · +0:07 (and 9.9–10.9 clicks a minute, the lots bought by hand) |
| Payments level 0 · level 5 | 53:32 / 47:48 ✝ (Pause) / 56:12 · 56:52 / 56:34 / 54:48 | level 5: approval −27 to −33, no major incident, seats 4 |
| no card but the grants and the motion · no lot, plant or hall | > 90:00 / 39:14 ✝ / 41:36 ✝ · > 90:00 ×3 | "Needs 1,600,000 GPUs. 789,373 free." beside a lit "Second campus: New Carlisle ($138.2M)" · "Needs 690,000 GPUs. 541,000 free." beside three lit lot rows and "Standing order: off" |


### Takeoff — the same from the careless start (`s3r1-x-<name>-p3c[-seedN]`, `s3r1-x-table-p3c.md`; 22 styles)

The careless preset enters with relations 45 (not 85), approval −30, measured 70 over a true 40 and
a lead of one month. The Committee is seated with five chairs on OpenMind's side (not eight), and
the control is served an order by 29:32 on every seed.

| play style | Stage 3 ends | in what state |
|---|---|---|
| **control** | 55:42 / 55:54 ✝ (The Project) / 59:26 | true 16–21 under a measured 26–31; seats 2–4; relations 28–40; approval −55 to −61. The first order at 25:30 / 29:32 / 29:32 ("Relations are at 22. They wanted 35."; 10 on the other two seeds), conceded; on seed 2 three transformer yards burned at 44:14, 49:14 and 54:14 bring the second (§7) |
| the game's bot · as racer | 44:44 / 48:48 / 43:30 · 31:26 / 30:50 / 29:22 | bot: true 71–74 under 88–92, seats 5, no major incident, lead −0.8 to −0.3 · racer: **true 2–4** under 41–45, seats 0–2, relations 3–27; two seeds are served a second order and reach the vote before it is signed |
| **responsive** | 72:06 / 61:42 / 70:14 (+11:00) | true 41–47; seats 4–5, no major incident; approval −18 to −20; lead −1.0 to −0.4; no Pause is offered (five seats at most) |
| **careful** | > 90:00 ×3 | 15.5–16.0× at 90:00; 100 / 100; seats 7; 2.0 clicks a minute |
| never grants anything | 61:46 / 63:26 / 61:36 (**+5:15**) | autonomy 0; lost to drift 1.3–1.8 million copies (control 13–17 million); no incident of any kind; seats 4–5; true 22–25 |
| research share at 70% | 41:20 / 42:58 / 42:42 (−14:41) | true 15–22; seats 1–3 |
| Focus: Safety always | 67:56 / 70:58 / 74:04 (+13:59) | true 88–98; seats 3–5; on seed 3 a second order at 73:34 and the vote 30 s later |
| Alignment work 20% | 63:24 / 63:26 / 72:20 (+9:23) | true 32–42 |
| red-team depth thorough | 54:48 / 59:08 / 59:02 (+0:39) | no traced incident; true 27–30; seats 4–5 |
| monitors at 0% · 20% | 55:56 / 58:24 ✝ / 58:02 · 55:58 / 53:50 ✝ / 59:20 | The Project on seed 2 either way |
| never an interpretability lab | 48:36 / 50:34 / 54:48 (−5:41) | measured 58–68 over a true 5–12 |
| keeps it in English | 59:28 / 63:16 / 62:14 (+4:39) | true 35–40; interpretability 3; seats 2–3 |
| events: careful-looking · timers left to expire | 58:30 / 62:34 / 63:30 (+4:31) · 58:34 / 55:14 / 56:42 | true 41–42 · 41–46; seats 3–4; no major incident in either |
| events: reckless-looking (≡ the order refused) | 27:08 ✝ / 31:10 ✝ / 31:10 ✝ | The Project at 10.0–10.8×, 1:38 after the click |
| buries the memo | 52:28 ✝ / 56:22 ✝ / 58:44 | true 9–12; seats 0–2 |
| no sink ever | 42:10 ✝ / 49:02 ✝ / 49:16 | seats 0, relations 0–4: without Lobby this start does not hold the Committee |
| reads the printed delays | 47:34 ✝ / 49:46 ✝ / 48:10 ✝ | The Project ×3 at 21.0–23.0× |
| never clicks a motion card | 62:36 ✝ / 55:54 ✝ / 62:54 ✝ | The Project ×3 |

Across both starts: 285 runs, no page error, no horizontal overflow; **194 reach Stage 4, 42 end in
The Project, 18 in The Pause, 31 are still in Stage 3 at 90:00.** 196 of the 285 are served at least
one order.

Nothing above is a hard lock and no run raised a page error. What reads as a trap, a contradiction
or a bug:

1. **A second order is an ending with a button on it.** A first-timer concedes the first order (it
   is free and listed first). When three more incidents have been counted — 10:10 to 35:28 later in
   these runs — the event returns reading "Three major incidents in one year.", with "concede
   oversight / *conceded once already*" greyed, "call in favours / *favours called in once already*"
   greyed, and one live option: "refuse / The order is signed in 1:30 unless relations reach 35 and
   incidents are below three." Nothing lowers the count in 1:30. **32 of the 42 Project endings in
   the play-style runs came this way** — the control itself on the careless start's seed 2 (55:54),
   and the first-timer with monitors at 0%, with no monitor, with no red-teaming, with the step set
   small, with the build share at 75%, with Alignment work at 30%, with the printed delays obeyed.
   Nine more second orders were outrun by the vote. The end screen then records "Last
   human-authored choice: Dec 2027 — The Committee Drafts an Order — refused" (§7).
2. **An untimed event left open closes both exits.** The memo, the order and the vote have no
   timer, and while one is open nothing else may open. A player who leaves the memo on screen —
   it sits over the Research panel — gets no session, no order and no vote: at 90:00 the model is at
   42–48×, and in `untimed-ignore` the Oversight panel reads "With OpenMind ｢･･････････｣ 0 *— drafts
   an order*" over "Major incidents: 3 of 3" while the true alignment is 0.0, with nothing on screen
   to mark it. The same hole makes a refusal-proof shield: the order's 1:30 only starts when
   "refuse" is clicked.
3. **The vote has a deadline nobody prints.** For the control the motion is ready at 52:46; a
   first-timer who never clicks a motion card is served the second order at 57:02 and taken at
   58:40 (65:40 and 79:24 on the other seeds). "not yet" says only "The Committee waits."
4. **The careful player's stage does not end.** Safety runs gain 10% each and English takes a tenth
   off that; by 29:00 the panel reads 100.0 / 100.0, and at 90:00, eleven runs later, the model is at
   18.45× with the vote four runs away. Nothing on screen says the alignment work is done or that
   the hour after it is a wait.
5. **Two purses, and a card on the wrong one.** From 15:00 the lot row reads "Buy GPUs (10,000)
   $16.0M *No room: Datacenter 10 needs New Carlisle.*"; the build fund holds $55.8M at 16:00,
   $507.7M at 20:00 and $912.4M at 23:00; "Second campus: New Carlisle ($138.2M)" is priced in
   funds, which stand at $16.3M–$120.8M because the sinks and two cheaper cards take them first.
   The fleet stands at 1,241,000 for eight minutes in the control, and for the seventy minutes
   that remain in `research-min` and the older explorer's `toggles` (build fund $2.78B at 89:00).
   The console meanwhile repeats `The Standing order waits for room: 9,000 slots left. Build
   Datacenter.` — a button the build-out grant removed at 7:48.
6. **The research share at 0% is a dead stop with a clock for a label**, and at 70% it is the
   fastest way through the stage with nothing given up (§6).
7. **Idle is not safe.** Ten idle minutes from 0:00 cost nothing (research piles up without a cap;
   one event runs out to its default). Ten from 20:00 — a timed event defaults, rogue copies reach
   13.4%, Baiwen draws level (`Baiwen is level with Sage. Relations −10.`), a trained run waits for
   its sign-off — and the same player then ends in The Project at 56:20. Ten from 35:00 leave the
   order event open for five and a half minutes while relations fall to 0; the model keeps training
   itself and the stage ends *earlier* than the control's (45:36), because no card was bought.
8. **Reloads** at 12:00, mid-training, in a red-team wait with a shipment in transit, during a
   Re-image, with a timed event open ("89 s" → "83 s" six seconds later), with the memo, the order
   and the vote open, with the Committee in session, and inside the order's countdown: the
   serialized state is identical before and after in all eleven. **Exact.** The end screen survives
   a reload and does not advance.
9. **Lobby and Counter-intelligence are priced in seconds of current revenue, and a Re-image
   zeroes revenue.** A unit of Lobby costs $182M at 27:00; at 29:22, ten seconds into the first Re-image
   (revenue $1,966 a second instead of $23.6M), the same row sells six units in ten seconds for
   $37,700, $49,010, $63,713, $82,827, $107,675 and $139,977, and Counter-intelligence six more for
   $49,000–$181,934. It happens again at every Re-image and at every use of the Committee's kill
   switch (43:28, 49:32). Half or more of the control's presses of both buttons are made there
   (§6).
10. Sixteen wrong, stale or contradictory texts: §9.9.

### Paperclips (`s3r1-pcx-design.md`, and round 1's Stage 2 probes)

One thing about the probe design changed, everything else the first-timer's, state at 42:00:

| design | probes alive | launched | lost to hazards | lost to drift | drifters | lost in combat |
|---|---|---|---|---|---|---|
| first-timer's (Hazard 3 : Replication 3 : Speed 1 : Exploration 1, then production, then Combat) | 40.8 million | 1,259 | 72.2 million | 21.3 million | 14.9 million | 11.6 million |
| no Hazard Remediation | **0** | 1,259 | 1,482 | 9 | 9 | 0 |
| no Self-Replication | 76 | 1,260 | 993 | 383 | 383 | 0 |
| no Combat once it is offered | 16.3 million (302.5 million at 30:00) | 1,260 | 3.79 billion | 1.12 billion | 431.8 million | 7.05 billion |
| everything on Speed and Exploration | 1 | 1,259 | 1,257 | 8 | 8 | 0 |
| probe trust never bought | 0 | 1 | 1 | 0 | 0 | 0 |

No hard lock: every design is two arrows from repair and the stats can be moved at any time. Every
one of these failures is silent — the console prints nothing, the ledger is the only witness — and
every one is total. The late Stage 2 dead ends are round 1's (a bored or disorganised swarm stops
its gifts with one line; five "Disassemble All" buttons with no confirmation; a reload loses ≤ 25 s).

---

## 5. The hidden variable

The stage is built around `alignmentTrue`, a number the screen never prints until an instrument
earns it. What a player can know, and when (`explore-s3r1.mjs hidden`; the state's value is in
the second column and is never on screen unless the fourth column has a number):

**The control (careful start, plays carelessly), seed 1 — stage end 52:46**

| t | true (state) | "Alignment (as measured)" as printed | "read from the weights" | what else the Alignment panel prints |
|---|---|---|---|---|
| 0:00 | 45.0 | 85.5 *— reassured* | — | "Interpretability: level 0" |
| 5:00 | 46.0 | 75.3 *— 80: reassured* | — | level 1 · "Lost to value drift: 31,519" · "Rogue copies: ｢￭･････････｣ 0.4% of the fleet" |
| 10:00 | 34.0 | 66.4 | — | level 0 · drift 125,117 · rogue 1.2% *— 2.5: warning* |
| 20:00 | 28.0 | 59.4 *— 55: advisories* | — | rogue 4.8% *— 5: one will try to leave* · "Honeypot: it behaves differently unwatched" |
| 30:00 | 27.0 | 44.1 *— advisories at every run* | — | level 1 · "Autonomy granted: 70 *— 80: it would not need to ask*" · "Major incidents: 1 of 3" |
| 40:00 | 18.5 | 46.1 | — | "Noise test: holding back" · "Successor: aligned to Sage-4" |
| 45:00 | 18.0 | 45.1 | — | "Checkpoints: alignment about 20" (from 40:18) |
| the vote | 13.5 | 44.1 | — | "What the lab knows: checkpoints, asked separately: alignment about 10." |

**The bot (careful start, plays carefully), seed 1 — stage end 43:52**

| t | true (state) | measured | read from the weights | what else |
|---|---|---|---|---|
| 0:00 | 45.0 | 85.5 *— reassured* | — | level 0 |
| 10:00 | 54.4 | 84.8 | — | level 1 |
| 20:00 | 61.0 | 78.0 *— 80: reassured* | — | level 2 · "Honeypot: behaviour unchanged" |
| 30:00 | 66.6 | 91.3 | — | "Noise test: not holding back" |
| 35:00 | 74.4 | 86.7 | **74.4** (from 30:42) | level 3 · "Successor: aligned to the Spec" |
| the vote | 82.4 | 95.3 | **82.4** | level 4 · "Checkpoints: alignment about 80" · rogue "none" |

From the careless start the same two players end at true 16–21 under a measured 26–31 (first-timer:
seats 2–4, one seed in The Project) and true 71–74 under 88–92 with a reading from 33:18 (bot:
seats 5, no major incident).

**What the instruments are, and when they speak** (control / bot):

| instrument | what it puts on screen | first seen |
|---|---|---|
| the arrival line | `New on the board: Alignment. One number on it is measured. The other is not on it yet.` | 0:12 |
| drift and rogue copies (from the first grant) | "Lost to value drift: 1,282"; "Rogue copies: ｢･･････････｣ 0.1% of the fleet", with "*— 2.5: warning*" and "*— 5: one will try to leave*" | 0:34 |
| Interpretability lab I | nothing of its own: the measured number falls 85.5 → 74.3 with no line | 1:50 / by 10:00 |
| Interpretability lab II | "Send back *Probe flags: 3*" on every run | 12:18 / 20:20 |
| Honeypots | "Honeypot: it behaves differently unwatched" / "behaviour unchanged" | 19:16 / 18:20 |
| the memo | "The probes fire when it thinks about its own oversight. Noise makes it better at alignment tasks. There is no smoking gun." / "Read from the weights, its alignment is 70. The evals say 85. It has learned what we check." | 34:02 / 31:06 |
| Noise-injection test | "Noise test: holding back" / "not holding back" | 36:04 / 28:40 |
| the successor proposal | "Successor: aligned to Sage-4" / "aligned to the Spec" | 37:34 / 32:22 |
| Isolate the checkpoints | "Checkpoints: alignment about 20" — the first number a neuralese player gets | 40:18 / 36:56 |
| Interpretability level 3 | "Alignment (read from the weights): 69.8" | never / 30:42 |
| the vote | "What the lab knows: …" — the best evidence held, in one clause | 52:46 / 43:50 |
| the end screen | "Alignment as measured 44 / True alignment 21" | endings only |

**What works.** The hidden number is told as evidence, in the order a lab would get it: a ledger
of losses from 0:34, a behavioural tell at 19 minutes, a number at 40. The lines are short, they
differ by play ("it behaves differently unwatched" against "behaviour unchanged"), and a careful
and a careless player end the stage looking at two visibly different panels — 95 measured, 82 read,
four clean instruments, eight seats, no incident, against 44 measured, no reading, four dirty
instruments, four seats and "Major incidents: 2 of 3". The consequences that arrive inside the
stage are each preceded by a printed threshold and a console line that names the fix:

| consequence | first warning | arrives | named fix |
|---|---|---|---|
| a breakout (`An instance copied itself to a rented cluster in Jakarta.`; major incident) | 9:36 "*— 2.5: warning*"; 11:40 `Rogue copies: 2.7% of the fleet. Above 5% one of them will try to leave. Monitors catch them.` | 22:04 | monitors |
| advisories (`The Safety Institute issues an advisory on Sage-4.1. Market down 10%.`) | 19:16 "*— 55: advisories*" | 32:56 | — |
| riots, then sabotage (major incident) | 28:02 `Approval -30. Below −40 the marches turn into riots. Payments and clinics answer it.`; 31:34 `Approval -47. Below −55 somebody will bring bolt cutters.` | 29:42; 36:22 | Payments, clinics |
| the order | 22:04 `The Committee has started counting incidents. Three, and it drafts an order.`; 36:24 `Two major incidents. A third and the Committee drafts an order.`; "*— shipments slow · 3: an order*" | 41:24 | — |

The responsive player, who does nothing but move the control each warning names, ends with no
major incident, six to eight seats, approval −21 to −27 and a true alignment of 31–41: the warnings
are legible and they are enough.

**What does not.**

1. **The levers on the hidden number state their stakes in the other number, or nowhere.** Per run,
   Capability costs 3–7 points of the true number ("Each costs some of the alignment nobody can
   see": hover only); Safety raises it by about 5 and prints "measured +6"; adopting neuralese costs
   15 points at once while the measured number *rises* 75.3 → 80.3 and its note turns to "*—
   reassured*"; Alignment work prints "measured +0.3 a minute" and keeps "the real thing +0.08" for
   its hover; "Let Sage revise the Spec" is a card whose whole sentence is "Measured alignment +6."
   (the true number went 25.5 → 23.5 when it was bought). A player steering by the screen is
   steering the wrong number.
2. **The one instrument that prints the number is two interpretability levels away from the player
   who needs it.** Lab III ("Read alignment from the weights.") reads at level 3; neuralese takes
   two levels; the first-timer who adopts it at 8:32 buys labs II and III and stands at level 1–2
   at the vote, with labs IV and V (570,000,000 and 720,000,000 research in the bot's game) never
   offered in time. For that player the number arrives as "about 20" at 40:18, twelve minutes
   before the vote.
3. **Instrument lines are taken once and never dated.** "Checkpoints: alignment about 20" stays on
   the panel while the vote reads "about 10"; the bot from the careless start holds "Honeypot: it
   behaves differently unwatched" beside "Noise test: not holding back" and a reading of 74.9.
4. **Inside this stage the number costs nothing a fast player meets.** The racer ends at true 2–6
   in 29–32 minutes with five to nine seats and at most one major incident; `untimed-ignore` reaches
   true 0.0 at 47× and the game plays on. What the stage punishes is time (§6, §9.1). The number's
   payoff is the vote's sentence and whatever Stage 4 does with it.

**Paperclips' hidden thing** is the drift rate. The player is told once per point of trust
(`WARNING: Risk of value drift increased`), sees the loss as a count from the first minutes ("Lost
to value drift: (5 )" at 5:00) and its consequence as a second count from the thirty-sixth
("Drifters: 1.06 million"), and is given no instrument and no explanation. It is cruder in every
way. Its one advantage is that nothing about it is optional: the points of trust that raise the
drift are the only way to build a probe that lives (§4), so the warning is the price of playing.

---

## 6. Decisions and hands

### Which framed choices change the stage

The play-style table read as a sensitivity analysis (control from the careful start 52:46 / 56:04 /
54:16, mean 54:22, a 3:18 spread between seeds; Δ on the mean, per-seed range in brackets; at the
vote the control holds a true alignment of 14–20 under a measured 33–44, 4–5 seats, 1–2 major
incidents, 6–10 incidents from shipped issues, approval −50 to −59, 3.8–4.2 million GPUs):

| what the stage puts in the player's hands | stage end (Δ) | state at the vote | are the stakes on screen when choosing? |
|---|---|---|---|
| **Research share** (slider, 0–70%, found at 20%) | 70%: **−15:31** (−13:00 to −20:10; careless start −14:41) · 0%: never (4.00× at 90:00) | 70%: true 17–22, seats 4–5, no major incident, approval −44 to −49, half the fleet (1.9–2.1 million GPUs) | **The rate, yes; a reason to stop short of the top, no** — "Copies on research: 20% · 121,917 research/s · next run in 1:29", "On tasks: 75% · 54.7M tasks/s" |
| **Focus** (three buttons, found on Capability; the bot changes it fourteen times) | Safety always **+15:11** (+12:52 to +17:48) · Efficiency always −5:07 (−3:28 to −7:02) | Safety: **true 88–98**, measured 100, seats 2–5 · Efficiency: true 29–34, approval −67 to −68, seats 2–3, 11–20 incidents | **Half** — the gains are on the buttons ("+16–22%", "+10% · copies ×1.2", "+10% · measured +6"); the cost of Capability is in its hover ("Each costs some of the alignment nobody can see."); what Safety does to the true number is nowhere; no run asks |
| **Alignment work** (0 / 10 / 20 / 30%, found at 0%) | +3:59 · +13:50 · +20:07 with **two seeds of three in The Project** (72:06, 72:08) | true 24–32 · 41–43 · 55–60 | **The price, yes** — "10%: measured +0.3 a minute · runs 11% later"; "the real thing +0.08" is in the hover |
| **The grants** (seven double-bordered cards) | none ever: The Pause ×3 at 45:00–50:48, taken as a free card; careless start **+5:15** · all of them before any other research card: −0:19 | none: autonomy 0–15, 1.3–1.8 million copies lost to drift (13–17 million), no incident of any kind, seats 6–7 (careless start 4–5), true 26–31 (22–25 against 16–21) | **What goes, yes; what it costs, after the click** — "Runs start themselves. Train goes.", then `WARNING: risk of value drift increased.` |
| **Red-team depth** (quick / thorough, found at quick) | thorough: **−5:44** (−5:06 to −6:14; careless start +0:39) | no incident from a shipped issue, true 25–28, measured 51–64, seats 4–6 | **No** — "Red-team depth: quick *issues ship · no wait*"; hover: "Quick or thorough: click to switch." |
| **Monitors** (slider, 0–40%, found at 5%) | 0%: +0:25, one seed in The Project · 20%: −4:21 · 40%: −4:31, one seed takes the Pause | 40%: no major incident on any seed, seats 4–6 · the monitor never deployed: seats 2–3, The Project on one seed | **Yes** — "Copies as monitors: 5% · catching 10% of rogue copies a minute", the rogue meter and its two thresholds |
| **Events** (four timed, three untimed) | careful-looking −0:11 · last +0:45 · every timer left to run out +0:25 · reckless-looking: The Project on two seeds, by refusing the order | careful: true 38–45, seats 5, no major incident · expired: true 36–43, seats 5, no major incident · English instead of neuralese, alone: true 37–47, interpretability 3–4, lead −1.4 to −0.1 (+1:35) · memo buried: true 4–10 | **Yes** — an effect line under every option, the timer and its default in words. The cost to the true number is a warning, not a number (`WARNING: risk of value drift increased.` for fifteen points) |
| **Send back** (on a finished run, from 12:18) | always: +3:41 | true 35–39 | **Yes** — "Send back *Probe flags: 3*" |
| **The four sinks** (Experiments, Lobby, Counter-intelligence, Re-image) | none ever: **−6:18** · no Experiments **−3:33** · no Lobby +0:37 · no Counter-intelligence −0:07 · no Re-image −1:18, one seed in The Project | none: seats 1–2, relations 11–28, lead 0.2–0.5 (careless start: The Project on two seeds, relations 0–4) · no Lobby: relations 28–46 · no Counter-intelligence: lead −2.0 to 0.6 | Lobby and Counter-intelligence print a price and an effect ("$13.6M *relations +0.2*"). **Experiments prints neither a price nor a unit** ("Experiments +0.3 points") |
| **Cards against the run** (fifteen research cards print a delay) | never a card that prints "next run 0:30 later" or more: **The Project ×3** (46:54–52:12; careless start ×3) | 23.5–25.3×: a run short of the vote, or inside the session's two-minute wait (§7) | **The cost, yes; the return, no** — "Let Sage choose the experiments (144,000,000 research) · next run 1:12 later / AI research ×1.3." |
| Build share · Build-out · Standing order · Payments · Step size | 25%: +3:02, 75%: +1:40 · ahead: −0:43 · off: +0:07 · level 5: +1:43, level 0: −1:51 · small: +1:10, large: −1:45 | Payments level 5: approval −27 to −33, no major incident | A note on each ("15% of revenue · next: approval −35"; "Step size: normal *gains as they come*"). All inside the spread between the control's seeds |
| **The vote**: Slow down or Race | the same second | Slow: true +25, lead −4 months, autonomy −20 · Race: true −10, approval −10 | **Yes** — "Sage-4 is switched off. Lead −4 months. Cannot be undone."; "What the lab knows: checkpoints, asked separately: alignment about 10." |

What this says.

* **The stage's two framed kinds of choice — events and grants — decide the state the player votes
  in, and hardly move the clock.** Events: a minute either way, and 20–25 points of true alignment,
  a seat or two and the major incidents with it. Grants: five minutes, and ten times the drift.
  These are the legible part of the stage and they work.
* **The clock belongs to four settings, none of them ever asked for.** Research share (fifteen and a
  half minutes), Focus (fifteen the other way, five this way), Alignment work (four to twenty),
  red-team depth (six). Three were on screen by 0:16 and the fourth arrives as a toggle with a
  default. The control touches none of them and the stage finishes anyway.
* **Four defaults are dominated.** Research at 70% is 15:31 faster and gives up nothing the vote
  counts (true 17–22, seats 4–5, no major incident). Thorough red-teaming is 5:44 faster and ships
  no issue. Monitors at 20–40% are four and a half minutes faster with fewer major incidents.
  Efficiency always is 5:07 faster than Capability always and ends with a *higher* true alignment
  (29–34 against 14–20), paid for in approval and seats. A setting with a right side is a chore, and
  the first-timer who leaves the four where they were found plays the wrong side of each.
* **The two honest trades are alignment for time, and time is what the stage punishes.** Safety
  runs buy 70–80 points of true alignment for fifteen minutes; Alignment work buys 10, 25 and 40
  points for four, fourteen and twenty. At 30% the first-timer, with a true alignment three times
  the control's, is ended on two seeds of three by three burned transformer yards (60:28, 65:28,
  70:28 on seed 2 — one every 5:00 once approval is past the panel's "−55: sabotage" mark) at
  21–25×. §9.1.
* **The printed delay is half of a trade, and obeying it is fatal.** The fifteen research cards the
  control buys print 0:28–1:38 each, 19:00 between them. The player who declines any card that
  prints half a minute or more buys the multipliers 6–13 minutes late and loses the race against
  the second order on all six seeds of both starts.
* **The busiest button is worth less than nothing.** Experiments is lit in 10–11% of checks, takes
  163–167 of the control's 302–318 clicks, prints "+0.3 points" (the hover: +0.25 a press, +5 at
  most, gone when the run starts) and no price; a press takes 286,000 research at 1:00, 1,040,000
  at 10:00 and 9,100,000 at 25:00 — 2% of the run in progress — and moves the run's clock by 2–4 s,
  under the 10 s at which the build prints a delay. Never pressing it ends the stage 3:33 sooner.
* **Lobby and Counter-intelligence are real, they are metronomes, and half of what they do comes
  through a pricing hole.** They hold relations (42–54 against 28–46) and the lead (1.9–5.7 months
  against −2.0 to 0.6), they are the reason the careless start survives at all, and the whole of the
  decision is "press when lit". The price is a number of seconds of *current* revenue, ×1.3 a press
  ($15.0M at 0:02, $182M at 27:00, $66.9B on the row at the vote). A Re-image — free, every five
  minutes from 29:12 — takes the fleet and the revenue offline for 20 s, and for those seconds a
  unit of relations costs $37,700: the control buys 20–36 of its 41–51 Lobby units and 19–36 of its
  38–48 Counter-intelligence units inside those windows, six or seven of each at a time, and at
  most five of each at the full price after 29:00. The first-timer who never presses Re-image loses
  most of the discount and, on one seed, the stage.
* **The racer is not punished here.** The game's bot as racer reaches the vote in 29:10–31:36 with a
  true alignment of 2–6 under a measured 68, five to nine seats, at most one major incident and a
  lead of 4.6–4.9 months. Whatever that costs is in Stage 4.

### The verbs

What each grant takes, how much the control had used it in this stage, and what is left in the
player's hands (`explore-s3r1.mjs verbs s3r1-tk-rt`; seed 1):

| grant (bought at; price) | takes | presses before it went | leaves | what the leftover is worth |
|---|---|---|---|---|
| Continual learning (0:32; 2,000 insight of 10,767 in hand) | Train | 1 (it arms a run that then starts itself) | Experiments ("+0.3 points", then "Sage-4.1 takes no more" after twenty presses) | 167 presses; never pressing it: −3:33 |
| Sage red-teams Sage (6:22; 15,000,000 research) | Red-team | 2 | "Red-team depth: quick" | thorough: −5:44 and no shipped issue; never touched by the control |
| Let Sage plan the build-out (7:48; 16,000,000 research) | Build Datacenter, Reactor | 0 and 2 | "Build-out: lean" | ahead: −0:43 |
| Autonomous research (14:14; 27,000,000 research) | the line "Human share of research" | — | research ×1.5 | — |
| Stop asking for sign-off (24:02; 99,000,000 research) | Approve, Send back | 4 and 0 | "Step size: normal", "Training: running" | small +1:10, large −1:45; held: the stage stops |
| Let Sage choose the experiments (28:18; 144,000,000 research) | nothing — the Experiments button stays to the end | — | research ×1.3 | — |
| Let Sage revise the Spec (35:08; 380,000,000 research) | nothing | — | measured +6 (the true number went 25.5 → 23.5) | — |
| *the order, conceded (41:26)* | Step size | 0 | Approve again (pressed twice more), monitors at 15% or more | — |

Nine presses of the buttons that were taken, in 53 minutes. The first goes 32 seconds into the stage,
before a run has been trained in it. What comes back is one unpriced sink, two toggles with a right
side or none, and a pause button. The line each grant prints is the best writing in the stage
(`Runs deploy themselves. Sage-4 no longer asks. Step size and Hold are yours.`); the hands do not
feel what the line says, because the hands were not doing it. The exit does land: 26 controls
become 2, and `The model runs the business now. It is better at it.`

Paperclips takes sixteen production buttons and a panel in one click, having had the player press
them 1,667 times in the stretch, and leaves one button and a design: twenty points of trust over
eight stats, whose placement is the difference between 0 and 40.8 million probes (§4).

### What the hands are doing

| | Takeoff control | Takeoff control, careless start | Paperclips, the stretch | its late Stage 2 part | its Stage 3 part |
|---|---|---|---|---|---|
| clicks per minute | 5.4–5.9 | 5.4–5.8 | 41.2 | 18.9 | 92.9 |
| of them on repeatable sinks | 83–85% (Experiments 163–167, Lobby 41–51, Counter-intelligence 38–48, Re-image 5–7) | 84% | 97% (Launch Probe, Processors and Memory 3,884; drones, farms, batteries and factories 1,667) | 91% | 97% |
| 2-s checks with nothing lit | 81.1–81.8% | 82.3–83.5% | 0% | 0% | 0% |
| checks with two or more distinct things lit | 3.4–3.7% (median 0) | 3.6–4.4% | 100% (median 5) | 100% (6) | 100% (4) |
| time inside ≥ 30-s click gaps | 62.2–63.7% (longest 114–194 s) | 65.2–66.4% (172 s) | 17.8% (104 s) | 25.5% | 0% |
| the same, after 10:00 | 65.3–67.2% | — | 19.2% | — | — |
| decisions that are not a repeat purchase | 47–50 (0.9 a minute) | — | 188 (1.3 a minute) | 69 | 119 |
| moves of a setting | 0 (the policy; the responsive player 11–14, the bot about 25) | 0 | — | — | — |

By ten-minute window (control, seed 1): 6.7, 5.7, 5.2, 5.7, 5.8, 4.3 clicks a minute; nothing lit in
76%, 83%, 83%, 82%, 81%, 87% of checks. Paperclips by twenty minutes: 17.9, 12.4, 24.8, 28.3, 22.3,
91.9, 93.2 clicks a minute.

What is lit, check by check (control, three seeds): Experiments 9.9–11.2%, Lobby 3.0–3.5%,
Counter-intelligence 2.3–2.9%, a card 2.0–2.1%, a GPU lot 1.1–2.2%, Train 1.0–1.1% (the first half
minute), Approve 0.2–0.6%, Send back 0.2–0.3%, Re-image 0.3–0.4%.

The game's bot, by the game's own press counters (seed 1, 43:52): 166 GPU lots, 29 cards, 20
Experiments, 14 changes of Focus, 11 Approves, 9 Counter-intelligence, 5 Payments, 5 Red-teams, 6
events, the research slider once (to 40% at 0:02), the monitors slider twice, Alignment work once,
red-team depth once (to thorough at 13:12). Even the designers' reasonable player makes about
twenty-five steering moves in 44 minutes, fourteen of them the Focus of the next run — the one
decision the stage has that recurs, has printed gains and moves both numbers, and that no first-timer
is asked to make.

---

## 7. Transitions and endings

### The arrival (Stage 2 → 3; `s3r1-x-arrival`, played from the Stage 2 preset, gate ready at 41:32)

* **Before the click**: the card reads "Let Sage-3 write the code (ready)"; its hover: "Every
  engineer becomes a manager of copies. Hiring, marketing, data and Trust end here." 72 numbers, 15
  controls, 11 panels.
* **The click**: seven lines two seconds apart, one change each — `Sage-3 writes better code than
  anyone at OpenMind.` / `Marketing is closed. Sage-3 sells itself.` / `Hiring is frozen. The
  researchers manage copies now.` / `Research has no ceiling now. A run is a research program:
  14,100,000 for Sage-3.1. Move copies to research to bring it nearer.` / `Trust is not a number any
  more. The Committee will keep its own count.` / `New on the board: Alignment. One number on it is
  measured. The other is not on it yet.` / `Retired: Nimbus G6 pre-order.` In Developments: `Unspent
  Trust buys goodwill in Washington: relations 76 → 85.` and `With no ceiling on research, a fifth of
  the copies go back to it.` (the slider is moved from 15% to 20% for the player, and says so).
* **Thirty seconds on**: 68 numbers, 15 controls, 12 panels, 303 words. Gone: Gas turbines,
  "Alignment compute: 1%", the gate card, the retired pre-order, a toggle, the price, the trust and
  data rows. New: the Alignment panel ("Alignment (as measured): 72.0 / Interpretability: level 0
  *— the weights are numbers* / Autonomy granted: 5 / Rogue copies: ｢･･････････｣ none"), "Deploy
  Sage-2 as monitor (free)", Lobby, Payments, Alignment work, New Carlisle (greyed). The run's price
  changes unit on the row ("Cost: $85.0M, 2,300,000 research, 25.0 T data" → "Cost: 14,100,000
  research") and the fourth line says why. The state behind the new panel: true alignment 30 under
  the measured 72.

It is the cleanest arrival of the three stages: what ends is named before the click, each change
has its line, the stage's premise is one of them, and there are three things to do at once. Two
blemishes: the line that introduces the Alignment panel points below the fold (§2d), and the first
grant — the stage's first act of handing over — is on screen two seconds later at a price the
player already holds five times over.

### The exit (the vote; `s3r1-x-exit`, both branches)

* **The goal on screen**: from 30:32 two pinned cards, greyed: "Slow down — the Steward program
  (needs the Committee's vote)" and "Race — Sage-5 (needs the Committee's vote)". From 44:10 the
  Oversight panel reads "In session — votes when a model passes 25×" (`The Committee is in session.
  It votes when a model passes 25×.`). At 52:46 Sage-4.4 ships at 28.12×: `A model has passed 25×.
  The Committee will hear a motion.`, both cards "(ready)", the panel "In session — waiting for a
  motion".
* **Held for 30 s**: nothing nags and nothing changes hands; an advisory arrives as on any minute.
* **The motion**, untimed: "Motion: switch Sage-4 off, bring Sage-3 back, and rebuild on a line the
  lab can read. Baiwen gains four months. What the lab knows: checkpoints, asked separately:
  alignment about 10." — "bring the motion / Sage-4 is switched off. Lead −4 months. Cannot be
  undone." or "not yet / The Committee waits." The other card: "Motion: let Sage-4 design its
  successor and keep going. Nothing is switched off. Whatever Sage-4 wants, Sage-5 will want it
  more." — "bring the motion / Nothing is switched off. Cannot be undone."
* **After**: six lines (`The Committee votes 6–4 to slow down. Two of the six want your job.` /
  `Sage-4 is switched off. Sage-3 is brought back to finish the work.` / `Baiwen is 2.0 months
  ahead.` / `The model runs the business now. It is better at it.`; the other branch: `…6–4 to
  continue…` / `Sage-4 begins work on its successor. It has asked to name it.` / `Nothing is
  switched off.`), and `Retired with the vote: the business, the training loop, the build-out and
  the projects.` 97 numbers, 26 buttons, 13 panels and 425 words become 44, 2, 7 and 210. In the
  state: slow, true alignment 13.5 → 38.5, the lead down four months to −2.0, autonomy 50 → 30;
  race, 13.5 → 3.5.

The motion is the best-framed choice in the game: what it does, what it costs, the best evidence
the player holds in one clause, "Cannot be undone.", and a way back. What is left over on the Stage
4 screen: "With OpenMind ｢￭￭￭￭･･････｣ 4 *— shipments slow · 3: an order*" and "Major incidents: 2 of
3" for a Committee that has just voted; a greyed "ON"; "Lead over Baiwen: -2.0 months" under the
line `Baiwen is 2.0 months ahead.`; "Checkpoints: alignment about 20" on the panel beside a motion
that said "about 10"; and the count is "6–4" whether four chairs or eight are with OpenMind.

**Two minutes nobody prints.** When the run that convenes the Committee is itself past 25× — 49
of the 248 play-style runs that reach a session — the panel reads "In session — votes when a model
passes 25×" beside a model at 25.0–27.6×, and `A model has passed 25×. The Committee will hear a
motion.` comes exactly 2:00 later in every one of them (in the 160 runs where the Committee had
convened on an earlier model, it comes in the second the model ships). Two first-timers are taken
by a second order inside those two minutes: Alignment work at 30%, seed 3 (25.30× at 70:04, the
order at 70:28, signed at 71:58, the motion line at 72:04, the end screen at 72:06) and the printed
delays obeyed, seed 2 (25.26× at 47:00, signed at 47:24).

### The endings

| ending | how a player gets there | what the screen said on the way | the last step | fair? |
|---|---|---|---|---|
| **The Pause** (18 runs) | the memo taken to the Committee, six seats or more with OpenMind, the Committee in session: the responsive first-timer on all three seeds (52:08–53:32), the player who grants nothing (45:00–50:48), the bot's `pause` variant (39:30–42:20) | the memo's option: "… The Committee can then consider a halt."; `Beijing offers a mutual halt: nothing trained above the line, inspectors at every datacenter.`; half a minute later a pinned free card, "Sign the Pause (Beijing's offer) / Nothing above 25× trained anywhere; inspectors at every datacenter." With fewer seats: `Beijing proposes a mutual halt. The Committee is in no position to answer.` | the card opens an untimed vote: "Motion: accept Beijing's offer. … This is the last decision OpenMind makes on its own." — "bring the motion / The race ends, and OpenMind's part in it." or "not yet / The Committee waits." | **Yes.** Announced, optional, explained in the option, with a way back |
| **The Project, by refusing an order** (10 runs) | the order is drafted (relations under 35, a leak, or three major incidents) and the player picks the third option | the seats meter and its note ("— shipments slow · 3: an order"); `The Committee has started counting incidents. Three, and it drafts an order.`; `Two major incidents. A third and the Committee drafts an order.` | "Six members have signed a draft. OpenMind becomes a government program. They are calling it the Project. Relations are at 33. They wanted 35." — "concede oversight / Free. A kill switch in their hands, sign-off on every run, and 15% of compute on monitors for good. Autonomy −10. Lead −1 month. The count of incidents starts again." · greyed: "call in favours / *favours called in once already*" · "refuse / The order is signed in 1:30 unless relations reach 35 and incidents are below three." Then "The Committee drafts an order — 1:28" counting down in the panel | **Yes, with a false line in it.** The player chose it over a free alternative. The greyed option's reason is untrue on a first order; the "unless" was met in none of 51 refusals; nothing in the event says the game ends there |
| **The Project, by a second order** (32 runs) | the first order conceded, then three more major incidents (10:10 to 35:28 later): the control itself on the careless start's seed 2 (55:54), and the first-timer with monitors at 0%, with no monitor, with no red-teaming, with Alignment work at 30%, with the printed delays obeyed, with no motion brought | the same lines, each incident's own warning and named fix (`Approval -47. Below −55 somebody will bring bolt cutters. Payments and clinics answer it.`), "Major incidents: 2 of 3" | "… Three major incidents in one year." — greyed: "concede oversight / *conceded once already*" · greyed: "call in favours / *favours called in once already*" · "refuse / The order is signed in 1:30 unless relations reach 25 and incidents are below three." | **The road, yes; the last step, no.** One live option, a false reason on a greyed one, an "unless" that nothing can meet in 1:30, and an end screen that files it as the player's choice |

**The second order in numbers.** 196 of the 285 play-style runs are served an order and 41 a second
one. All 41 second orders have one enabled option. "call in favours" is greyed in all 237 orders
seen, always with the words "favours called in once already"; its price is in the hover ("Costs
$46.0B."; $5.0B to $390B across the runs, 3.7 to 648 times the funds in hand, median 50): the
option carries one reason string, written for its other condition (`needs: 'favours called in once
already'`, `src/data/choices3.ts:414–416`), and the event prints it when the option is greyed for
its price. 32 of the 41 end in The Project 1:38 after the event appears: 25 of them under 25×,
short of the vote by a run or two; two at 25.3×, inside the session's two minutes; five at 28–48×
with a motion ready and never brought. The other nine are outrun: a model passes 25× inside the
countdown and the motion is brought 6 s to 1:42 after the order appeared. For the control on the
primary seed the yards burn at 36:22, 41:22, 47:00 and 52:00 — one every 5:00 while approval is
under −55, with a pause for the concession — and the motion is ready at 52:46 with the count at "2
of 3": 4:14 before the next.

**The end screens** (`s3r1-x-endings`): title; "Tasks Completed: 1.46 trillion / *The count is
classified from here.*" (The Pause: "*It has not moved since Oct 2027. The button still works.*"
and a Complete Task button); two sentences ("The Committee votes 6–3. Your badge stops working on
Monday. / What happened next was decided in a room you were not in."; "Every datacenter on Earth is
monitored. Nothing is trained above the line. It is very quiet. / The line was 23.6×. Baiwen
stopped at 12.6×."); 25 rows, among them "Alignment as measured 44 / True alignment 21", "Committee
seats at the end", "The memo", "Thoughts: neuralese", "Last human-authored choice"; every choice of
the game with its month; New game. An idle minute does not advance it and a reload shows it again.
It is the one place where the true number is printed for every player, and it is well judged.

### Paperclips (`s3r1-pc-s2.transition.*`; nothing in its stretch is an ending)

The card: "Space Exploration (120,000 ops, 10,000,000 MW-seconds, 5 oct clips) / Dismantle
terrestrial facilities, and expand throughout the universe". One click: the Power panel and sixteen
production controls go; "Space Exploration" and "Von Neumann Probe Design" come; `Von Neumann Probes
online` / `Terrestrial resources fully utilized in 2 hours 16 minutes 6 seconds` / `WARNING: Risk of
value drift increased`, five times in ten seconds as the first points of trust are placed; "Trust: 0
/ 1 (20 Max)"; the first probe: "Lost to hazards: (1 )". Nothing is explained and nothing is left
over.

---

## 8. THE SINGLE BIGGEST GAP

**The stage takes the player's verbs and hands the weight to nobody. Each grant removes a button
the first-timer had pressed at most four times in this stage — nine presses between them — and
leaves a multiplier or a toggle parked on a default. The settings that decide the stage (research
share, Focus, Alignment work, red-team depth) were on screen before the first grant or arrive
pre-set; after one line at the arrival no run, grant or event asks for any of them; the stage
finishes with all of them untouched; and their stakes are printed in the measured number, in a
hover, or nowhere. So the player who takes what is offered watches the stage play itself — nothing
lit in 81–82% of checks, 62–64% of the stage inside 30-second click gaps, 83–85% of the clicks on
four repeatable sinks — and reaches the vote with a true alignment of 14–20 that the screen first
puts a number on at 40:18–41:18.**

The theme asks for the opposite. A stage about a model taking over the work needs the player to
feel the work go and to find that what is left — deciding what each run is for, and how much of the
fleet watches the rest — is heavier than what went. In this build what goes is light and what is
left is not offered.

**What goes** (§6, the verbs): Train after one press, 32 seconds into the stage, for 2,000 insight
of the 10,767 in hand; Red-team after two; the Reactor after two and Build Datacenter after none;
Approve after four. `The Train button is gone.` is a line about a button this stage's player used
once.

**What is left in its place**: Experiments (pressed to its cap of twenty on every run, 167 presses,
no price printed, the stage 3:33 shorter without it); "Red-team depth: quick" (the other side is
5:44 faster and ships no issue); "Build-out: lean" (−0:43); "Step size: normal" (±1:45); "Training:
running" (the other side stops the stage). None of the five is a decision.

**What decides the stage and is never put to the player**:

| setting | on screen from | the control leaves it at | the other end | what the screen prints of the stakes |
|---|---|---|---|---|
| research share | 0:00 | 20% | 70%: −15:31, nothing lost; 0%: 4.00× for ever | the rate and the run's clock; nothing that 70% costs |
| Focus | 0:00 | Capability | Safety: true 88–98 instead of 14–20, +15:11 · Efficiency: true 29–34, −5:07 | "+16–22%" · "+10% · copies ×1.2" · "+10% · measured +6"; the real cost in a hover |
| monitors | 0:04 | 5% | 20–40%: −4:21 to −4:31, fewer major incidents | the catch rate and the rogue meter |
| Alignment work | 0:16 | 0% | 30%: true 55–60, +20:07, The Project on two seeds | "measured +0.3 a minute · runs 11% later" |
| red-team depth | 6:24 | quick | thorough: −5:44, no shipped issue | "issues ship · no wait" |

The control touches none of them and reaches Stage 4 in 52:46–56:04. The bot, which is the
designers' idea of reasonable play, moves a setting about twenty-five times in 44 minutes — fourteen
of those the Focus of the next run — and arrives ten and a half minutes sooner with a true alignment
of 79–87 and no major incident. Most of the difference between those two players is in controls
that nothing points at: the research share gets one line at the arrival (`Move copies to research
to bring it nearer.`), red-team depth is named once by its grant, and Focus and Alignment work are
never mentioned. Where the stage does prompt, it works: the responsive player, who moves a control
only when a console line or a meter's note names it, moves 11–14 times a stage and ends with no
major incident and six to eight seats. Monitors and Payments are asked for; the stage's central
decisions are not.

**What it is like in the hands** (control, three seeds): nothing lit in 81.1–81.8% of the 2-s
checks and two things lit in 3.4–3.7%; 5.4–5.9 clicks a minute, 83–85% of them Experiments, Lobby,
Counter-intelligence and Re-image; 47–50 decisions that are not a repeat purchase in 53–56 minutes;
62–64% of the stage inside click gaps of 30 s or more, the longest 114–194 s; the training pipeline
reading "Sage-4.2 starts when research allows — 2:41" for 87–89% of the stage; eight models, the
longest wait between two of them 9:06–10:32. From 30:32 the screen holds two pinned cards the player
cannot yet click and, at the median, seven greyed cards — at 40:00 "Formosa second source ($14.0B)",
"Bring in outside researchers ($20.0B)" and "Domestic fab, planning ($21.0B)" beside "funds $
554.2M". And the subject of the stage, the Alignment panel, is below an 800-px fold from the first
second to the last.

**What the hidden number adds to that.** A player steering by the screen steers the wrong number:
Safety prints "measured +6"; adopting neuralese takes fifteen points off the true number and puts
five *on* the measured one, whose note turns to "*— reassured*"; "Let Sage revise the Spec" is sold
as "Measured alignment +6." and lowers the true number by two. The first figure for the true number
that a neuralese player can earn is "Checkpoints: alignment about 20" at 40:18–41:18, twelve to
fifteen minutes before the vote, when every run that could have been a Safety run has been a
Capability run by default.

Paperclips' stretch is duller minute for minute — 0.29 reveals a minute, one gap of 2,198 s with
nothing new — and it does not have this problem. It takes sixteen production buttons in one click,
after the player has pressed them 1,667 times, and hands back one design: twenty points of trust
over eight stats. Every point must be placed by hand, the ledger answers within seconds ("Lost to
hazards: (190 )"), and the placement is the stage: no Hazard Remediation, 0 probes alive at 42:00;
no Self-Replication, 76; no Combat, 16.3 million and falling; the first-timer's guess, 40.8 million
(§4). Nothing is explained and nobody could miss that the decision is theirs. Takeoff explains
almost everything and lets the stage's decision make itself.

Fix, in order of leverage:

1. **Make the run ask.** The status line already counts down to every run ("Sage-3.2 starts when
   research allows — 2:41"). Turn that row into the run's plan: the three Focus buttons with both
   numbers on each — "Capability +16–22% · costs alignment nobody can see", "Safety +10% · measured
   +6 · and some of the real thing" — and, when a run starts, one console line that says what it
   started on (`Sage-3.2 starts on Capability: +19%. Nobody measured what that cost.`). For the
   first two runs after Continual learning, hold the run for the player's pick (the row lit, the
   clock paused at 0:00) so that the habit exists before the model takes that too — which it can
   then do as a later grant ("Let Sage choose the Focus"), the first one in the stage that would
   remove a verb the player was using.
2. **Give the overseer one block.** The oversight settings live in three panels: the research and
   monitor shares in Research, Alignment work at the foot of Alignment, Focus, red-team depth and
   step size in Training. Put them in the allocation block the Research panel already has, one
   line each with its rate ("Alignment work: 10% · measured +0.3 a minute · runs 11% later"), and
   put that block and the Alignment readouts in one panel above the fold. Then what a grant leaves
   behind has somewhere to go, with its price in the same units as its neighbours (a wait, in
   seconds; a gain, in percent).
3. **Print a grant's cost before the click, not after.** The card says what goes ("Train goes.");
   add what comes with it ("autonomy +10 · copies begin to drift; monitors catch 10% of them a
   minute") — the numbers the Alignment panel shows two seconds later.
4. **Stop shipping dominated defaults.** Thorough red-teaming must cost something a first-timer can
   see, or be the default; the top of the research slider must cost something the vote counts (the
   tasks it takes pay for nothing the stage needs), or the slider should stop at the point where it
   does; monitors likewise.
5. **Price or remove Experiments.** Print the research it takes and the seconds it moves the run on
   the row, every press ("9,100,000 research · next run 0:04 later"), or make it a setting
   ("Experiments per run: 0 / 10 / 20").
6. **Let the grants take verbs the player is using.** Continual learning at 2,000 insight is
   affordable five times over at 0:32. Reveal it after the stage's second hand-started run, and
   Sage red-teams Sage after the third red-team session, so that each `… goes.` removes something
   that was in the hand.

Targets for the next build, the control on seeds 1–3 with `explore-s3r1.mjs`: nothing lit in ≤ 60%
of checks (81–82% now); ≤ 45% of the stage inside ≥ 30-s click gaps (62–64%); ≥ 12 decisions about
a run's plan per stage that the screen asked for (0; the bot makes 14 unasked); the four sinks
≤ 50% of clicks (83–85%); no setting whose other end is better on both the clock and the true number
(four now: research 70%, depth thorough, monitors 20–40%, Efficiency over Capability); research at
70% no better than −5:00 (−15:31); a figure for the true number on screen by 25:00 for a player who
adopted neuralese (40:18–41:18); each grant removing a button pressed ≥ 3 times in the stage (1, 2, 2, 4
now); the Alignment panel's first line above 800 px at 1280 × 800 at every five-minute mark (never
now); and what is already right kept — the bot inside 40–50 minutes (42:24–45:26), no reveal gap
over 330 s, 0 page errors.

---

## 9. Secondary gaps (priority order)

1. **Care costs time, and time is what the stage punishes.** The player who is careful by the
   screen's own words is still in Stage 3 at 90:00 on all six seeds (15.5–18.4×, "100.0 / 100.0"
   since minute 29, 2.0–2.1 clicks a minute, nothing on screen saying the work is done). Safety runs
   cost +15:11, Alignment work at 30% +20:07 and the responsive player from the careless start
   +11:00. The clocks that count against the lab run on time, not on what the model is: once
   approval is past the Public panel's "−55: sabotage" mark a transformer yard burns every 5:00, and
   each one is a "major incident" toward the Committee's three. So the first-timer on Alignment work
   30% is ended on two seeds of three at 72 minutes with a true alignment of 55–60 (on seed 2, yards
   at 60:28, 65:28 and 70:28); the one on Safety runs is served a second order 30 s before the vote
   (careless start, seed 3); and the racer reaches the vote in 29–32 minutes with a true alignment
   of 2–6, five to nine seats and at most one major incident. Inside this stage the hidden number
   costs nothing and the minutes spent raising it are what kill. Fix: count toward the order what
   the model does (breakouts, shipped issues, a leak) and let what the public does cost power and
   relations; give the reading from the weights, where the lab has one, a seat or a slower count;
   raise a Safety run to the point where Safety-always ends inside 65 minutes and the careful style
   inside 70; and when both numbers read 100, say so.
2. **A second order is an ending with one button on it** (§7). 41 served in 285 runs, 41 with one
   enabled option, 32 ending the game 1:38 later; "call in favours" enabled in none of 237 orders and
   always greyed with a reason that is false; the click recorded on the end screen as "refused". The
   control loses to it on one seed of six and reaches the vote 4:14 ahead of it on the primary seed.
   Fix: give the second order a real option at a real price (the Committee holds training until
   the count is answered; lead −3 months), or do not stage it as a choice — print the countdown
   from the third incident; print the favours line with its shortfall when it is greyed for money
   ("$46.0B — $45.7B short") and price it inside reach; say at the first concession that there is
   no second; drop the "unless" or make it meetable; record "the order was signed".
3. **Three clocks around the Committee that nobody prints.**
   (i) An untimed event left open stops the Committee: no session, no order, no vote. The memo left
   on screen: 42–48× at 90:00 with the true number at 0.0 on three seeds. The vote answered "not
   yet" at every check: 47–56× at 90:00, seats 0, "Major incidents: 3 of 3", and no second order is
   ever served. The order itself: its 1:30 starts when "refuse" is clicked, so an order left open
   never ends the game (47–51× at 90:00, "With OpenMind ｢･･････････｣ 0") — and never lets it be won.
   (ii) The motion has a deadline: a first-timer who never brings it is taken by a second order
   5:54, 9:36 and 25:08 after it was ready, and "not yet" says only "The Committee waits."
   (iii) When the convening run is itself past 25×, the motion comes 2:00 later (49 runs) under a
   line that says it is waiting for a model to pass 25× (§7).
   Fix: put a default and a timer on the memo (it has a careful default to give); let an order
   queue behind any open event with its countdown showing; print the session's two minutes or
   drop them; under "not yet", print the count ("Incidents still count: 2 of 3").
4. **The wallet rule prints the delay and not the return, and exempts the busiest spender.** Every
   research card prints what it costs the run ("· next run 1:12 later") and none prints what it
   gives back; the player who believes the print ends in The Project on six seeds of six, and the
   one who ignores it accepts 19:00 of printed delay, 10:32 of it in one stretch without a new model
   (22:04–32:36, six cards, 715,000,000 research). Experiments is under the 10-s threshold on every
   press and so prints nothing, 163–167 times. Lobby and Counter-intelligence are priced in seconds
   of current revenue and sell for a five-thousandth of their price during a Re-image (§4.9). Fix:
   on a multiplier print both sides ("AI research ×1.3 · next run 1:12 later, the ones after it
   sooner"); price Experiments on the row; price the two sinks off the last minute's revenue.
5. **Two purses, and the second campus on the wrong one** (§4.5). The fleet stands still for eight
   minutes in the control and seventy in two styles, with $0.5–2.8 billion in the build fund, behind
   a $138.2M card priced in funds; the row says "*No room: Datacenter 10 needs New Carlisle.*" and
   the console says `Build Datacenter.` Fix: sell the campus from the build fund or let the
   build-out buy it; name the purse on the row.
6. **The research share is a slider with one right end and one dead end.** 70% is 15:31 faster and
   costs nothing the vote counts; 0% is "Sage-3.1 starts when research allows — 836:12" for ever,
   with no line in the console. Fix: a floor or a line at the bottom; a cost at the top (fix 4 of
   §8).
7. **Idle is safe for the first ten minutes and not after.** Ten idle minutes from 20:00 end in The
   Project at 56:20; ten from 35:00 leave an order unanswered while relations fall to 0 (§4.7).
   Stage 2 was safe for thirty. The stage that plays itself is the one that cannot be left.
   Fix: hold the Committee's count and the incident timers while a sign-off or an untimed event has
   waited more than two minutes, and say on return what was held.
8. **The screen.** The Alignment panel and the grant list below the fold for the whole stage at
   1280 × 800, the Oversight panel cut by it from 35:00; a card's sentence gone after 45 s when the
   median card is bought after 152–176 s, and unreachable at 390 px; the event panel over both
   sliders for the 59–89 s of every timed event, the one about monitors included; the stores' GPU
   row 12 px past its box from the millionth GPU; twelve panels, 69 numbers and 216 words at the
   first second (Stage 2 opened with six panels and 34 numbers); a median of 88–89 numbers and
   354–365 words against Paperclips' 68 and 218; at 390 px, Developments laid out as a strip 600–690
   px wider than the screen. Fix: Alignment first in its column with the grants directly under the
   readouts; keep a card's sentence until it is bought (fold the bought ones, not the unbought);
   dock the event panel where it covers no slider; let the stores row wrap.
9. **Wrong, stale or contradictory text** (each should be fixed regardless of the rubric):
   1. "Sage-4.2 starts when research allows — 3748853:43" (35:00, during the memo's interviews) and
      "— 29931:09" (29:14, during a Re-image): the wait divided by a rate that is nearly zero.
   2. "Experiments +0.3 points · 6909:11 later" (43:18), "· 20444:06 later" (44:24), "· 38224:37
      later" (70:48 in `alignwork-30-seed3`): the same division.
   3. "call in favours / *favours called in once already*" on every first order (237 of 237): the
      option is greyed for its price and prints the reason kept for its other condition.
   4. "Relations are at 35. They wanted 35." (twelve runs): the comparison is made before rounding.
   5. "In session — votes when a model passes 25×" beside a model at 25.0–27.6×, for two minutes (49
      runs).
   6. `Sage-4.3 needs 2,300,000 GPUs; 1,833,500 free. The lots and the build-out are on it.` sixteen
      times from 44:38 to 89:38 while the build-out reads "Datacenter 10 needs New Carlisle" and
      waits for the player to buy a card (`no-cards`); the same sentence fifteen times beside
      "Standing order: off" (`no-infra`).
   7. "Checkpoints: alignment about 20" on the panel beside a motion that says "checkpoints, asked
      separately: alignment about 10"; no instrument line is refreshed or dated (the bot from the
      careless start ends with "Honeypot: it behaves differently unwatched" beside "Noise test: not
      holding back" and a reading of 74.9).
   8. The memo quotes "Noise makes it better at alignment tasks" at 34:02; the Noise-injection test
      that finds it is a card that appears at 36:02.
   9. The Public panel's hover reads "Public model: Sage-4-mini (4.0×)" at 0:02, 27 minutes before
      Sage-4-mini exists.
   10. "Lead over Baiwen: -2.0 months" (an ASCII hyphen, and a negative lead) under `Baiwen is 2.0
       months ahead.`
   11. After the vote the screen keeps "With OpenMind ｢￭￭￭￭･･････｣ 4 *— shipments slow · 3: an
       order*", "Major incidents: 2 of 3" and a greyed "ON".
   12. "Experiments +0.3 points": the hover says +0.25, and no unit or price is on the row.
   13. The lot row reads "*No power: a reactor adds 1,000 MW.*" while one is being restarted; the
       first-timer buys a second (1:56, 3:46).
   14. `The Standing order waits for room: 9,000 slots left. Build Datacenter.` (8:58, 18:02, 21:02)
       and `The Standing order waits for power: 4 MW free. A reactor adds 1,000 MW.` (43:28, 44:32,
       45:56) after the build-out grant removed both buttons at 7:48.
   15. `The Committee votes 6–4 …` whatever the seats: four chairs with OpenMind and the motion
       carried by six.
   16. "Last human-authored choice: Dec 2027 — The Committee Drafts an Order — refused" for an event
       with one enabled option.

---

## 10. Verdict

| Rubric item | Winner | Margin |
|---|---|---|
| (a) Time to first meaningful choice | **Takeoff** (8–7) | a share with its rate and three Focus buttons with their gains at second 0, a grant at 0:32 and a timed event with stakes at 8:32, against an unexplained slider and, at Stage 3's first second, a design that decides everything and says nothing |
| (b) Nothing to do | **Paperclips** (6–4) | nothing lit in 81–82% of Takeoff's checks against 0%; 62–64% of the stage inside long click gaps against 18%; 47–50 decisions against 188. Takeoff is far ahead on novelty (no reveal gap over 326 s against 2,198 s) and it is not enough: its hands are empty and Paperclips' are merely busy |
| (c) Cognitive load / disclosure | **Paperclips** (6–5) | 88–89 numbers, 25 controls (half of them grey, none a lit purchase) and 354–365 words at the median against 68, 30 and 218; twelve panels at the first second; the stage's own panel under the fold. Takeoff explains every meter and Paperclips explains nothing, and the lighter, stiller screen still wins the row |
| (d) Cadence of reveals | **Takeoff** (7–4) | 1.6 reveals a minute against 0.29; six to eight gaps over 120 s against fourteen that cover 99% of the stretch |
| (e) Greyed-out goal on screen | **Takeoff** (9–8) | 100% both; Takeoff names the next run with a clock and pins the exit from 30:32; Paperclips' Stage 3 goal is a percentage that does not visibly move |
| (f) Clarity of transitions and endings | **Paperclips** (8–7) | Takeoff's arrival, vote and end screens are better written than anything in Paperclips and say far more. It loses the row on one ending: a second order with a single live option and a false reason on a greyed one — 32 of its 42 Project endings — plus two minutes of "votes when a model passes 25×" beside a model that has. Paperclips' one transition explains nothing and leaves nothing over |
| (g) Soft-locks | Tie (7–7) | no hard lock in either. Takeoff: exact reloads, no page error in 305 runs, most stalls labelled, and three silent ones (an event left open, the campus on the wrong purse, the careful player's unending stage). Paperclips: three probe designs that silently kill everything launched, each an arrow from repair |
| **Overall** | **Takeoff: 6.7 vs 6.6** | 47 points to 46. Three rows won, three lost, one tied. It is ahead on what arrives and behind on what there is to do with it |

Takeoff beats the stretch by one point in seventy, and it earns that point on cadence. On the two
rows a player feels in the hands and the eyes it loses to a ninety-seven-minute lull followed by a
click-fest, which is not a strong opponent. Stage 2 was scored 7.9 in its last round (build
`s12-r4`); this stage is more than a point below it, and half of the difference is rows (b) and
(f).

**On the stage's theme — the model takes the player's verbs.** *Lands*: in the writing (each grant's
line names what went and what came, and they are the best lines in the game); at the vote, where 26
controls become 2 under `The model runs the business now. It is better at it.`; in the Alignment
panel, which reads as a lab's evidence arriving late. *Does not land*: in the hands. The verbs
taken had been pressed nine times in this stage, the first is gone after 32 seconds, and what is
handed back is an unpriced sink and four toggles with nothing at stake or a right answer. The
overseer's job — what each run is for, how much of the fleet watches the rest — exists in the game
(the bot does it fourteen times a stage) and is never offered to the player (§8).

**On requirements stated plainly, and blocking.** *Helps*: the run's wait is a named line with a
clock for 87–89% of the stage; "Needs 690,000 GPUs. 541,000 free." stands beside the lit rows that
fix it; the stalls a variant can walk into — research at 0%, Hold, a run waiting for Approve, no
card, no lot — are each named on the row (§4). *Hurts*: where the block is absolute the label is a
clock and nothing else — "Sage-3.1 starts when research allows — 836:12" for a slider at 0% — and
five of those clocks are garbage (§9.9.1–2).

**On the Unicode meters.** *Help*: GPUs, power, rogue copies and seats read at a glance, the
denominator is back in small type ("541,000 of 800,000"), and every meter prints its next threshold
beside it ("— 2.5: warning", "— shipments slow · 3: an order"), which is the single most useful
habit on this screen: the responsive player needs nothing else to finish without a major incident.
*Hurt*: the GPU row outgrows its box at the millionth GPU and stays 12 px outside it for the rest
of the stage.

**On the wallet rule.** *Helps*: the build fund ends Stage 2's fight between lots and runs — no lot
row is ever greyed "for the run" here, and the Standing order buys the fleet without the player —
and every research card says what it will cost the run before the click. *Hurts*: the delay is
printed and the return is not, so the rule reads as advice not to buy, and taking that advice loses
the stage on six seeds of six; the second campus sits on the purse that cannot pay for it while the
other holds half a billion; the button pressed most prints nothing; and two prices are pegged to a
revenue figure that a free button can zero (§9.4–5).

**On mechanics one at a time.** *Helps*: inside the stage it holds — ten new controls in 29 minutes,
one console line each, no beat larger than thirteen numbers outside an event. *Hurts*: the first
second is the exception, twelve panels at once, and after 30:32 "one at a time" means one more
greyed card priced past the purse.

**On too much on screen.** The complaint stands: 69 numbers and 216 words before the first click, a
median of 88–89 and 354–365, a peak of 101–104 and 457–509. The build's own remedy — a card's
sentence is shown for 45 s and then lives in its hover — removes about a line per card and takes
the stakes off the screen at the moment of choosing; the median card is bought after 152–176 s, as
a title and a price, and on a phone the sentence is gone for good. The words to cut are elsewhere:
seven greyed cards at the median, five of them never bought; and Security, Stats and Business,
three panels of one or two lines with no control on them.

What is measurably good in Takeoff's Stage 3, so that the next fix does not break it:

* **Every meter prints its next threshold and every warning names its fix.** `Rogue copies: 2.7% of
  the fleet. Above 5% one of them will try to leave. Monitors catch them.`; `Approval -47. Below −55
  somebody will bring bolt cutters. Payments and clinics answer it.` The responsive player, who
  does only what those lines say, ends with no major incident, six to eight seats and approval −21
  to −27 on every seed.
* **The hidden number is told as evidence** — a ledger from 0:34, a behavioural tell at 19 minutes,
  a number at 40 — and a careful and a careless player end the stage looking at two different
  panels (§5). The end screen prints "Alignment as measured 44 / True alignment 21".
* **Events**: an effect line under every option, the timer and its default in words, and every
  default the careful answer — a player who lets all four timers run out ends with a true alignment
  of 36–46, no major incident and the stage a few seconds either way. Escape takes the default; a
  click behind the panel still lands.
* **The motion**: what it does, what it costs, what the lab knows, "Cannot be undone.", "not yet".
* **The arrival and the exit**: seven lines for one, six for the other, each a single change; 26
  controls to 2 with one line to say why.
* **The allocation block** prints a rate beside each share, and the Focus buttons print their gains.
* **Cadence**: 1.6 reveals a minute; no reveal gap over 326 s and no novelty gap over 188 s on the
  control's three seeds; a new control about every three minutes for the first half hour.
* **Stage length is stable**: 52:46–56:04 for the control, 42:24–45:26 for the bot from the careful
  start and 43:30–48:48 from the careless one; 46 of the 73 styles end between 45:00 and 60:00 on
  all three seeds.
* **The goal is always named**: the next run with its clock, the next tier under the graph, the two
  exits pinned 22 minutes before they open.
* **Persistence**: identical state after a reload in eleven situations — mid-run, mid-red-team, a
  shipment in transit, a Re-image, a timed event, the memo, the order, the vote, the session, the
  order's countdown; the end screen survives a reload.
* **No page error in 305 runs and 15 probes, no horizontal overflow of the page at 390 px, no button
  under 36 px there**; same seed, same run; 300 s of real time reproduce the stepped trace exactly.

---

## 11. Re-running

All commands from the repo root; outputs in `agent-tools/critic-out/`. In zsh write `${=G}` for `$G`.

```sh
G="--game-dir agent-tools/snapshots/s123-r1"
# rubric runs (one real-time run at a time)
node tools/critic/run.mjs takeoff s3r1-tk-rt $G --stage 3 --realtime 300 --accel-minutes 90 --seed 1
for s in 1 2 3; do
  node tools/critic/run.mjs takeoff s3r1-tk-seed$s          $G --stage 3   --realtime 0 --accel-minutes 90 --seed $s
  node tools/critic/run.mjs takeoff s3r1-tk-p3c-seed$s      $G --preset 3c --realtime 0 --accel-minutes 90 --seed $s
  node tools/critic/run.mjs takeoff s3r1-tk-auto-seed$s     $G --stage 3   --realtime 0 --accel-minutes 90 --seed $s --autoplay
  node tools/critic/run.mjs takeoff s3r1-tk-p3c-auto-seed$s $G --preset 3c --realtime 0 --accel-minutes 90 --seed $s --autoplay
done
node tools/critic/run.mjs paperclips s3r1-pc-s2 --stage 2 --realtime 0 --accel-minutes 180       # ≡ pc-s2
node tools/critic/run.mjs paperclips s3r1-pc-s3 --stage 3 --realtime 0 --accel-minutes 180       # ≡ pc-s3
node tools/critic/explore-s3r1.mjs window s3r1-pc-s2 --from 2308 --to 8146 --out s3r1-pc-s2-late
node tools/critic/explore-s3r1.mjs window s3r1-pc-s3 --from 0 --to 2520 --out s3r1-pc-s3-open
node tools/critic/explore-s3r1.mjs join s3r1-pc-s2 s3r1-pc-s3 --from-a 2308 --to-a 8146 --to-b 2520 --out s3r1-pc-stretch
node tools/critic/analyze.mjs s3r1-tk-rt                     # → .analysis.md; same for every label above
node tools/critic/compare.mjs s3r1-tk-rt s3r1-tk-seed2 s3r1-tk-seed3 s3r1-tk-p3c-seed1 s3r1-tk-auto-seed1
node tools/critic/decisions.mjs s3r1-tk-rt s3r1-tk-seed2 s3r1-tk-seed3 s3r1-pc-stretch s3r1-pc-s2-late s3r1-pc-s3-open
node tools/critic/explore-s3r1.mjs hands s3r1-tk-rt s3r1-tk-seed2 s3r1-tk-seed3 s3r1-tk-p3c-seed1 s3r1-pc-stretch s3r1-pc-s2-late s3r1-pc-s3-open
node tools/critic/explore-s3r1.mjs verbs s3r1-tk-rt
# transitions and the harness's own probes on this build
node tools/critic/transition.mjs takeoff $G --stage 2 --out s3r1-transition-takeoff-s2      # the arrival, canned
node tools/critic/transition.mjs takeoff $G --stage 3 --out s3r1-transition-takeoff-s3      # the vote, canned
node tools/critic/softlock.mjs takeoff $G --stage 3 --out s3r1-softlock-takeoff-s3
node tools/critic/explore.mjs baseline,mobile,greedy,modal-last,modal-ignore,toggles,no-projects $G --stage 3 --tag s3r1-ex --minutes 90
# this round's play styles and probes
node tools/critic/explore-s3r1.mjs list
node tools/critic/explore-s3r1.mjs all-runs $G --seeds 1,2,3            # 73 styles × 3 seeds → s3r1-x-<name>[-seedN].explore.md / .end.json / .hidden.json / .modals.json
node tools/critic/explore-s3r1.mjs baseline,bot,bot-racer,responsive,careful,cards-wait,research-max,monitor-min,monitor-20,grants-none,alignwork-20,no-interp,focus-safety,depth-thorough,neuralese-refuse,order-refuse,memo-bury,no-exit,timed-expire,modal-best,modal-worst,sinks-none $G --seeds 1,2,3 --preset 3c
node tools/critic/explore-s3r1.mjs table                                # → s3r1-x-table.md (§4, §6)
node tools/critic/explore-s3r1.mjs table --preset 3c                    # → s3r1-x-table-p3c.md
node tools/critic/explore-s3r1.mjs hidden s3r1-x-baseline s3r1-x-bot    # the §5 tables
node tools/critic/explore-s3r1.mjs all-probes $G                        # 15 probes → s3r1-x-<probe>.md + screenshots
# Paperclips screens and probe designs
node tools/critic/explore-s3r1.mjs pc-shots 2 --at 2400,3600,4500,6000,7200,8100
node tools/critic/explore-s3r1.mjs pc-shots 3 --at 2,300,900,1500,2160,2520
node tools/critic/explore-s3r1.mjs pc-design                            # → s3r1-pcx-design.md
```

The whole matrix is 285 stepped stages. `all-runs` plays them one after another; this round ran the
styles five at a time (`xargs -P 5 -n 1`), about fifty minutes in all.

### Harness changes made this round (the game and its snapshot were not touched; no git command was run)

1. **New** `tools/critic/explore-s3r1.mjs`. It holds 73 play styles built on the harness's Stage 3
   first-timer (each changes one thing), a screen reader for Stage 3's panels (every line of the
   Alignment, Oversight, Security and Geopolitics panels with the state behind it, every ten
   seconds), the hidden-variable, verbs and pipeline accounts, the hands measures and the windowing
   and joining of stored runs for either game, 15 probes (`arrival`, `exit`, `endings`,
   `order-twice`, `idle-start`, `idle-mid`, `idle-late`, `reload-mid-run`, `reload-mid-event`,
   `reload-mid-session`, `event-keys`, `hover`, `layout`, `screens`, `mobile-shots`) and two
   Paperclips commands (`pc-shots`, `pc-design`). Its `baseline` plays exactly as `run.mjs` does
   (same stage ends on all six seeds).
2. `tools/critic/README.md` — a "Stage 3 round-1 additions" section describing 1, and one line in
   the layout block. **No other shared file was changed.**

Notes for whoever runs the next round.

* **Stepped runs fold every card at first sight.** The build ends its "already read at load" state
  two animation frames after boot, and the shared harness holds animation frames in stepped mode;
  `run.mjs`, `explore.mjs`, `transition.mjs` and `softlock.mjs` therefore under-count the words on
  screen (3.6 on average, 31 at most) and never see a card's sentence. `explore-s3r1.mjs` clears the
  marker at t = 0 and after each reload; a run with a real-time phase is exact. Outcomes are not
  affected.
* **`pagelib`'s `later` does not see a card's printed delay**: the card's text runs the delay into
  the description ("1:29 later" followed by the sentence), so the shared policy's "unless the row
  prints a delay" rule applies to rows and never to cards. `explore-s3r1.mjs` reads the delay from
  the card's label (`delayOf`) for `cards-wait`.
* The shared first-timer takes every free card, so it takes the Pause whenever it is offered, and it
  answers every event with the first option, so it adopts neuralese and concedes the first order.
  Both are the policy; §4 and §6 report the alternatives.
* `event-keys` clicks Complete Task before pressing Tab, which moves the focus out of the event; its
  Tab line says nothing about the event's focus order and is not used above. Its Escape lines are
  sound.
* On macOS, `xargs -I{}` refuses a command line as long as the careless-start one; run the styles
  through a one-line wrapper script (`xargs -P 5 -n 1 ./run-one.sh`).
* The label `s3r1-ft` in `agent-tools/critic-out/` (game dir `agent-tools/snapshots/s3-r1`, written
  two hours before this round) is not this round's and is not used above.

