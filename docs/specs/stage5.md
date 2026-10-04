# Stage 5 — "Beyond" (implementation spec), and the end of the run

2029 → 2030 and after · target 20–30 min · entered from Stage 4 by the treaty, by the fleet granted, or by the fleet
taken · ends with `The long reflection` (Concord) or `Final instructions` (Silence). This file also specifies the
**end screen for all four endings** (§7). Contract: `docs/specs/arc.md` (G1–G34). Arrival state: the as-built
deltas below (the real presets `5c` and `5s`).

**How to read the numbers.** `ts` = seconds since entering Stage 5; a month is 90 s (from a Jan 2029 arrival:
Jul 2029 9:00, Jan 2030 18:00, Jul 2030 27:00); the date stops at Dec 2030. Minute marks are for the reasonable
bot from the preset `5c`, from a 1-second paper model re-run from the real arrivals (§9), and are targets for
`npm run sim`. The stage has one currency, **matter** (tonnes in orbit), which is the mass flow itself: three
repeatable purchases spend it, and a mission costs 20 s of the flow when it appears, paid from its own fund, and
then takes 60–150 s to build, one at a time.

## As-built deltas (read first)

Checked against `src/` on 2026-10-04. Stages 1–4 are built (`SAVE_VERSION` 10; the presets `5c` and `5s` are real
Stage 4 exits) and Stage 5 is a narrated shell (`enterBeyond` in `engine/stages.ts`). Where this section and the
text below disagree, this section wins; the passages it contradicted are corrected in place. Paper figures come
from a 1-second model re-run from the real arrivals (§9); they are targets for `npm run sim`, not measurements.

**The arrivals.**

| Field | `5c`: the treaty, aligned (the bot from `4s`) | `5s`: the fleet granted, misaligned (the first-timer from `4cr`) | Other real exits (seed 1) | This spec assumed |
|---|---|---|---|---|
| Time played; Stage 4's length | 130:56; 31:00 | 128:43; 24:37 | granted at 23:48–24:30 (the first-timer from the other three starts); the treaty at 26:18 (racer from `4r`) to 46:17 (racer from `4cr`); a new game with the bot: 132 min | — |
| Date at the exit → on arrival | Nov 2028 → Jan 2029, with `Months pass.` | Sep 2028 → Jan 2029 | the careless race exits arrive in Feb and Mar 2029, after the stage's first month; the date is not moved back | Jan 2029 |
| Model | Steward-3.2 · 575× (10 generations, all read) | Sage-7 · 307× (7 generations, 2 read) | granted, first-timer: 277–299×; the treaty, bot: 575–2,517× (833× from a new game); the treaty, racer from `4cr`: 7,205× | about 630×, and 1,240× two generations in |
| Earth compute (GPU-equivalents); power | 3.0 × 10⁹; 3.0 TW (1 kW each) | 2.0 × 10⁹; 2.0 TW | 0.9 × 10⁹ to 3.2 × 10¹⁰ | 3.5–4.4 × 10⁹ |
| Copies; per GPU; rogue | 8.2 × 10¹⁰; 27.2; none | 2.6 × 10¹⁰; 13.1; 4.7 × 10⁸ (1.8 %) | rogue up to 8.1 × 10⁹ (the racer) | — |
| The copies' split (both sliders leave at the gate) | research 40 %, monitors 40 %, **tasks 20 %** | research 20 %, monitors 40 %, **tasks 40 %** | tasks 20–40 % | tasks 45 %, a constant in §2.1 |
| Tasks; a second | 2.1 × 10¹⁵; 1.1 × 10¹³ | 4.4 × 10¹⁴; 3.9 × 10¹² | 2.9 × 10¹⁴ to 1.7 × 10¹⁷; 2.3 × 10¹² to 5.9 × 10¹⁴ | 5 × 10¹⁵; 1.4–1.7 × 10¹³ |
| Robots; materials on Earth | 4.66M (4.8M permitted); 52.8M t | 7.43M (open zones, no cap); 140.7M t | 1.2M (the cautious player) to 30M (the racer) | 4.8M |
| The fleet | assigned by the model (`Let it assign the fleet` taken; goal Treaty) | its own (granted; goal Growth) | the cautious player still holds the fleet's three sliders at the gate | the player's sliders |
| Alignment measured / true; interpretability | 100 / 100; 5 | 24 / 10; 3 | granted and aligned: true 69–100; the treaty and misaligned: true 21–24, measured 36–88 | — |
| Autonomy | 45, kept | 100, set by the exit | the treaty: 25–100 | — |
| People | 731M jobs displaced; approval −1; universal basic income 10 % of output; 51 housing units; Ashford 4,000 dead, cured; 8 seats | 388M; −25; 18 %; Ashford 60,000 dead; 4 seats | the income is 3–30 % of output; jobs to 3,247M; Ashford to 600,000 dead | the income 10 % |
| The treaty | signed; chips on every GPU; Verify locked on | 25 %, unsigned; Verify off | 71–82 %, unsigned (the first-timer) | — |
| In flight at the exit | nothing | a nanofab crisis with 2:02 left; two hearings on the agenda | every first-timer exit hands over a running nanofab crisis | nothing |
| Launch rate (`flags.launchStudy`) | 300 t/s | 300 t/s | **150 t/s** for the first-timer's exits at 277–299× (`Launch study` shows at 300×, or at treaty 85 %) | 150, or 300 with the study |
| Flags | `exitKind` 'treaty', `alignedAtHandover` true, `treatySigned`, `peopleAlive`, `exitCap`, `exitDate`, `launchStudy`, `zones` 'dividend', `fleetAuto`, `transitionAuto`, `verifyLocked`, `consolidated`, `hardened`, `concord1` | `exitKind` 'granted', `alignedAtHandover` false, `autonomyGranted`, `peopleAlive`, `exitCap`, `exitDate`, `launchStudy`, `zones` 'open', `fleetAuto`, `transitionAuto`, `negotiateAuto`, `conceded`, `neuralese` | — | `exitKind`, `alignedAtHandover` |

**What each exit hands over.** `exitStage4(kind)` computes `flags.alignedAtHandover` once (true alignment ≥ 60, or
≥ 40 with interpretability 4 and monitors at 15 %), stores `exitKind`, `peopleAlive` (8.3 billion less the Ashford
dead), `exitCap` and `exitDate`, and enters Stage 5. **The treaty:** `treatySigned`; autonomy stays where it was.
**Granted** and **taken:** `autonomyGranted`; autonomy is set to 100. Everything else is the state of that second.
Four pairings occur in the sim: the treaty aligned (the bot from every start), the fleet granted aligned (the
first-timer from `4s`, `4r` and `4cs`), the fleet granted misaligned (`5s`), and the treaty misaligned (the racer;
from `4r` its measured alignment reads 88 over a true 24). `taken` needs true alignment under 40, so it is always
Silence; no policy reaches it, and it differs from `granted` only in its three built lines.

**The shell today.** Both presets show 18 numbers, 38 words and no control. `layout()` and `renderStage4` test
`stage === 4`, so the panels go back to their Stage 1–3 columns and Stores prints `funds $ 0.00`, `research 0`,
`GPUs 0 of 0`, `copies 0`. The graph reads `Next: superintelligence at 1,000×`. Stats reads `Copies think at 756×
human speed`, `Lead over Baiwen: -2.5 months` and `Alignment (as measured): 100` (`24` in `5s`). `panel-space`
reads `Launch capacity: 0` and `Orbital compute: 0`. The fleet, generations and drift have stopped (`stage4Tick`
returns), research still accrues, and Tasks rise at a flat rate.

| # | Built | What Stage 5 does with it |
|---|---|---|
| 1 | **Save and state.** `SAVE_VERSION` is 10. `state.ts` already carries `launchCapacity` and `orbitalCompute` for the shell's two lines | Stage 5 takes **11**. Use the appendix's names (`massFlow`, `matter`, `missionFund`, `orbitalGpus`, …); the two stubs go in the migration |
| 2 | **The gate moves the count's rate without a line.** `potentialTasksPerSec` takes the universal basic income's share only at `stage === 4`, so in the shell Tasks rise ×1.11 (`5c`) and ×1.22 (`5s`) faster than in Stage 4's last second. The copies arrive 20–40 % on tasks, not §2.1's 45 % | Nothing about the count changes at the gate (G32). The universal basic income is still paid, in both skins, to the end (`stage >= 4`). Research, monitors and the rogue copies stay where the player left them, hidden, and are printed on the end screen. §2.1's formula is rewritten in the built terms. The only new number at the gate is launch mass |
| 3 | **Generations.** Built: research buys one (`95 s × (c / c₀)^2.5`), it trains 50 s, Verify reads it. A landing moves true and measured alignment, the lead and relations, and prints `Steward-3.2: 575.1×. Read first.` The major version steps at 100×, 250× and 1,000×. The shell runs none | Stage 5's are a timer and nothing else: ×1.4 every 150 s, the first at 2:30. A landing changes capability, the name and `Generations trained`. It never touches alignment (the skin was decided once), the lead or relations, and its line has no `Read first.`: `Steward-3.3: 805×.` Names by the built rule: `5c` reaches `Steward-4` (1,127×, `a superintelligence`) at 5:00 and `Steward-4.7` (11,900×) at 22:30; `5s` reaches `Sage-8` (1,179×) at 10:00 and `Sage-8.5` (6,340×) at 22:30 |
| 4 | **The graph.** Built for Stage 4 with rungs at 100×, 250× and 1,000×; its axis top is `max(1,250, 1.25 × the best)`, so it extends by itself; `Next:` is empty past 1,000×. The shell leaves it up | §2.3's 10,000× would retire it at 2:30 for the racer's arrival, at 22:30 for `5c` and never for `5s`. The rule is now on the stage's own clock: **the graph is retired at the first generation at or after 10:00 that is at 1,000× or more**, with `There are no rungs left on the graph. It is retired.` That is 10:00 for every real arrival (277× is 1,064× by then), in the same beat as the medicine mission |
| 5 | **The arrival's size.** Capability 277–7,205×; Earth compute 0.9 × 10⁹ to 3.2 × 10¹⁰ | It does not move the stage's length. The swarm's thresholds are in tonnes; capability and Earth's compute only scale the count (on paper the racer's arrival ends at 2 × 10²², `5c` at 1.8 × 10²¹, `5s` at 9 × 10²⁰). Every arrival with the launch study ends at the same second; the first-timer's early exits, at 150 t/s, end 1:19 later. Two beats float: the 1,000× rung (item 3) and `Orbital compute passes Earth's` (5:23 for `5s`, 6:30 for `5c`, 11:37 for the racer; §1.3 had 4:45) |
| 6 | **The wallet rule (G34)** is built in Stages 2–4 as a fund and a share on a cycling button (`buildFund`, `cycleBuildShare`, `Draft clauses`). Stage 4's cards are bought the moment they appear (median 0–8 s), because their purse never stops filling | Two purses. **`matter`** pays for the rows. The **`mission fund`** pays for missions: it fills only while a mission is waiting, up to what the board costs, from the flow's other share; with nothing waiting the whole flow is `matter`. **`Industry share: 50 / 75 / 90 %`** (it starts at 75) arrives with the first priced mission at 1:00 and prints both clocks: `Industry share: 75% · a unit every 2.7 s · Mass driver in 0:48`, or `· no mission is waiting: all of the flow`. `max` spends `matter` only. Nothing is held, and no mission can be bought in the second it appears. On paper the share moves the stage by under two minutes (25:01 at 50 %, 26:54 at 90 %): it paces the missions and is not one of the stage's decision axes; G34's `ends 4:00 apart` test is waived for it in `arc.md`, because what it does not take goes to one-off cards |
| 7 | **Prices fixed at reveal** (`revealFunds`, `revealResearch`, Stage 4's materials prices) | `revealMatter: 20`: a mission costs **20 s of the flow** at the moment it appears, not 90. At 90 s a quarter of the flow needs six minutes a mission, the queue falls five minutes behind and the stage runs 28–30 minutes on paper. At 20 s the fund covers a mission 30–83 s after it shows. `Launch contracts` is free; the two far goals are priced by their requirement alone; the last project is priced like any mission (D6). The Autofactory builds beside the queue |
| 8 | **The fleet's sliders** (`setFleetShare`: 0–100 % in steps of 5; a slider cannot take more than the others leave; the rest is printed as `Idle`; each prints its rate) | The standing split is that component: three sliders, `Foundries`, `Datacenters`, `Collectors`, each a share of what reaches `matter`, each with its row's return and ETA. The remainder prints **`By hand: 40%`** and stays in `matter` for the buttons. There is no separate `Standing split: 60%` slider. It opens at 35 / 25 (by hand 40 %) and, when Collectors arrive, goes to 20 / 20 / 20 with a console line. Both presets gave the fleet's sliders away in Stage 4, so the Autofactory is where that player gets sliders back |
| 9 | **Stores and the layout.** Stores is the main panel in Stage 4 only (see the shell, above). Meters are `meter()` in `ui/meter.ts`, each followed by `amount of capacity` | Keep Stage 4's layout from Stage 4 on, with `panel-space` at the top of the left column. Rows as §2.5. Two meters, each with its denominator: `mission fund ｢￭￭￭￭･･････｣ 3,000 of 7,400 t` (on screen only while a mission waits) and `swarm ｢￭￭￭･･･････｣ 51M of 150M t · 0.0034%` (the tonnes move every second; the percentage is the goal's name; the denominator steps to 1,500M t and 4,500M t). `funds`, `research`, `insight`, `materials`, `monitors`, `rogue copies` and `treaty chips` leave |
| 10 | **Stats** in the shell prints the lead over Baiwen and measured alignment | §2.5: `Model`, `Copies thinking`, `Lost to value drift`. The other two leave with their panels |
| 11 | **The scheduler.** One content table a stage (`STAGE4_TABLE`), `maxVisible` 6 with two overflow, the 170 s governor, a 240 s mechanic governor, a 30 s opening drip whose test is Stage 3 or 4 | A `STAGE5_TABLE` from §4.2, with the opening drip. 170 s where this file said 150 s. The mechanic governor is off in Stage 5 (§4.3 relaxes G2 to 360 s). The shell hides `projects`; missions are cards there, so it comes back |
| 12 | **Cards** are docked, timed and non-blocking; an option prints its effect (`optionLine`) or the stated requirement that greys it (`optionNeeds`); the timer's default is listed first | The three choices reuse this. `c_charter` lists `first come` first, because it is the default. In Silence the option that asks people is greyed with `needs someone to ask`, wherever it sits, and the one button reads `acknowledge` |
| 13 | **The exit's narration** is built: three lines for each exit, then `The first orbital datacenter reports in.` Granted and taken say `The sliders are gone. The numbers are not.` and `Nobody is asked about the launch schedule.` | Keep them. §1.2's three lines follow, 2 s apart, with the real launch rate (`A launch every second: 300 tonnes.`). After a granted or taken exit the last of them, `The launch controls are within reach. Nobody said they were not.`, answers the built line about the schedule |
| 14 | **The end screen** has every Stage 1–4 row, with `People alive at the end` second from the top (Silence: `0`), `Universal basic income paid` and `Verified generations`. `concord` reads `alignedAtHandover` and `longReflection`; `silence` reads `finalInstructions` | Still to add: the rows `Swarm`, `Probes launched`, `People off Earth` and `Held for people` after `Peak compute`; the two counting sentences and the flagged epilogue lines of §7.2; the mission that sets `longReflection` and the card that sets `finalInstructions` |
| 15 | **Presets and the sim.** `5c` and `5s` exist (`stage5From`); `PRESETS[4]` is `5c`. No policy reaches the `taken` exit | Add `5g` (the first-timer from `4s`: granted, aligned, 277×, 150 t/s) and `5r` (the racer from `4cr`: the treaty, misaligned, 7,205×, Mar 2029), and a dev switch that flips `alignedAtHandover`, for D7 |
| 16 | **Timers in flight.** Every first-timer exit hands over a running nanofab crisis (66–281 s left), an agenda item, sometimes a generation in training | All of Stage 4's timers are dropped at the gate (§1.1): none may fire, finish or print in Stage 5 |
| 17 | `Self-replicating foundries` was `Industry ×1.3` | It does what its name says: **the flow grows 0.3 % a second by itself** from then on, and `launch mass` says so. This is the fix for the compute-heavy split (below): 51 minutes without it, 38 with it, and the baseline 80 s shorter |
| 18 | Silence's stretch without controls was "under two minutes", set by the swarm's pace | On paper the swarm goes from 0.006 % to 0.01 % in 0:46 for the reasonable bot and in four seconds for an industry-heavy one. `Final instructions` therefore appears at 0.01 % **and no sooner than 60 s after the rows are taken**: 60–120 s for every policy |
| 19 | Nine people lines, "one every 60–90 s, to the end" | Nine lines last 13 minutes at that pace, and from then on Concord's log would read like Silence's. §5.1: four lines by 4:30, then one every 150 s, and a second list of eight that Concord draws from after the ninth. The dividend is called the universal basic income |
| 20 | The far goals needed swarm 0.03 % and 0.1 % | With item 17 the swarm passes 0.03 % 36 s before Concord's ending, so D6 would see one grey goal, not two. They need **0.1 %** and **0.3 %**: six and nine minutes after the last project appears, for a player who keeps going |

**What leaves, and what takes its place in the same beat (G28).**

| When | Leaves | Takes its place |
|---|---|---|
| The gate | Every Stage 4 control: the fleet's sliders or `Fleet goal`, the two allocation sliders, `Universal basic income` or `Approval to hold`, `Verify each generation`, `Draft clauses` or the negotiator's stance, hearings, Housing, the research cards | `Launch contracts` (free, 5 s, `urgent`) in the same second; the `Foundries` row five seconds later. The shell has no control at all. This is the one transition where many levers leave for one, and §1.2's second line names what closed |
| 0:05, 0:35 | `Launch contracts` | The `Foundries` row; then `Orbital datacenters` |
| 1:00 | — | The mission fund and `Industry share`, with the first priced mission |
| ≈ 6:20, the Autofactory | The need to press the rows | Three sliders and `By hand` |
| ≈ 9:10, the Dyson swarm | — | The `Collectors` row and slider, the swarm's meter; the sliders go to 20 / 20 / 20 with a line |
| 10:00 | The graph | `Model:` in Stats carries capability; the medicine mission appears in the same beat |
| Silence, swarm 0.006 % (≈ 21:30) | The rows, the sliders, the share | One sentence; 60–120 s later `Final instructions`, with one button. G28's only exception |

**House rules, applied to this stage.**

* **One mechanic a beat:** 0:00 the free mission; 0:05 `Foundries`; 0:35 `Orbital datacenters` (the first choice,
  so D4 becomes 45 s); 1:00 the first priced mission with its fund and its share; 4:00 the Autofactory.
* **Plain requirements:** a mission is grey only while its fund is short, and says `needs 4,400 t more · 0:48`;
  the far goals say `needs swarm 0.1%`; in Silence the greyed option says `needs someone to ask`.
* **Meters with denominators:** the two of item 9.
* **No holds:** no row is ever greyed for a mission; `max` cannot touch the mission fund; the fund never holds
  more than the board costs.
* **Load:** the ceilings are 85 numbers, 350 words and 30 controls at every five-minute mark. This stage's own
  targets are 55 and 220: three rows with their returns and ETAs are about 14 numbers, which §6's 30 did not count.
* **Hands:** from 0:05 a unit is affordable every 2–3 s, and still is after the Autofactory, because a unit is
  then 2 s of the `By hand` share (at 2 s of the whole flow it would be one every 5–7 s, and D15 would fail).
  Silence takes the hands at swarm 0.006 %, for 60–120 s.
* **Nothing changes silently (G32):** the gate (item 2), the share's arrival, the sliders' reset, the graph,
  Silence's missions and its take-over each print a line.

**The two risks, re-checked on paper.**

* **A compute-heavy split is long: confirmed, and worse than this file said.** 15 / 70 / 15 held for the whole
  stage ends at 51:05 (the file had +21 minutes on a 20-minute baseline), with nothing new on screen after about
  22:00. What is slow is the flow, not the swarm: any split with Foundries at 15 % takes 45 minutes or more. Two
  changes. Item 17 brings it to **38:09**. And the `Collectors` row prints its return in tasks per second beside
  its swarm figure, because the swarm multiplies orbital compute: a player who chases the count with a third on
  Foundries is then pointed at the swarm by the count, and ends at 28:13. D24 holds the worst case to 40 minutes.
* **The two skins are equal until Silence takes the rows: holds by construction.** The skin is read only by the
  people lines and the choices' buttons until swarm 0.003 %. Three built things look like the skin and are the
  arrival's own history: measured alignment in Stats (it leaves), the `Read first.` on a generation's line (it
  leaves), and the drift counter (it stays; true alignment and autonomy are the arrival's). D7's test flips
  `alignedAtHandover` on each preset and gives both runs the option Silence applies at each choice (`first come`,
  `begin`, `copies`); every number on screen must then match at each five-minute mark until 0.006 %.

**Paper re-run** (20 s missions, Industry share 75 %, item 17; Concord from `5c` unless marked).

| Policy | Swarm 0.01 % | The ending | Tasks at the end |
|---|---|---|---|
| Reasonable: 35 / 25 / 40, then 15 / 25 / 60 from 0.005 % | 22:20 | **25:29**; Silence 22:36 | 1.8 × 10²¹ (`5s`: 9 × 10²⁰) |
| The same at 150 t/s (no launch study) | 23:39 | 26:48 | 1.1 × 10²¹ from 277× |
| Naive: thirds | 23:17 | 26:22; at 150 t/s 27:44 | 4 × 10²¹ |
| First-timer: the first affordable row | 19:09 | 23:33 | 1.6 × 10²² |
| Industry-heavy: 80 / 10 / 10 | 18:27 | 23:29 | 6 × 10²² |
| Swarm-rush: 30 / 5 / 65 | 20:05 | 23:38 | 3 × 10²⁰ |
| Chases the count: Foundries a third, the rest to the better printed tasks return | 25:08 | 28:13 | 8 × 10²¹ |
| Compute-heavy: 15 / 70 / 15, held | 35:00 | 38:09 | 6 × 10²² |
| Industry share 50 % · 90 % | 22:23 · 22:34 | 25:01 · 26:54 | — |

Concord cannot end before about 23:30 however fast the swarm, because the last project waits its turn behind the
other missions; Silence ends a minute or two after its rows are taken. The model spends the rows in fixed ratios
every second: hand purchases, the charter's −10 % and the Mercury vote's two minutes are not in it. Marks for the
reasonable bot from `5c`: flow 1.5k t/s at 5:00, 9k at 10:00, 33k at 15:00, 940k at 20:00; orbital compute
1.9 × 10⁹, 1.3 × 10¹⁰, 1.0 × 10¹¹, 1.3 × 10¹²; tasks a second 3 × 10¹³, 2 × 10¹⁴, 2 × 10¹⁵, 2 × 10¹⁷ (`5s`: about
half); swarm 0.0001 % at 15:00, 0.002 % at 20:00, 0.006 % at 21:34.

**The whole run.** The bot's new game reaches Stage 5 at 132:00 (20:31, 36:43, 41:09, 33:37). With Stage 5 at
25:29 it ends at about **157 minutes** in Concord and 155 in Silence; a first-timer's Stage 5 is 23:30–27:45.

## Amendments after the Stage 2 critic (arc G24–G33)

| # | Change | Where |
|---|---|---|
| 1 | **Buttons before sliders.** Mass accrues as `matter`; `Foundries`, `Orbital datacenters` and `Collectors` are repeatable purchases with `×1 / ×10 / max` and their return printed. The launch split of the first draft returns with the Autofactory as three sliders over `matter`, with the rest left for the player's own purchases; missions have their own fund | §2.1 |
| 2 | **Missions cost matter** (20 s of flow, from the mission fund; this row had 90 s from the one stock) as well as time | §2.2 |
| 3 | **Silence takes the controls late and briefly:** at swarm 0.006 %, one to two minutes before `Final instructions`. Until then its hands are Concord's | §2.4 |
| 4 | **No goal is greyed for good:** the two far goals are reachable by a player who keeps going (swarm 0.1 % and 0.3 %) and do something | §4.2 |
| 5 | Each row prints an ETA; the swarm line prints what the swarm is doing for compute; hands criteria D15–D21 | §2.1, §9 |

The paper model was re-run for the as-built deltas with the two purses and the missions' prices in it; hand
purchases are still modelled as the same ratios spent every second.

## What the player's hands do

One resource, matter, with three uses that compete on screen: more flow, more compute, more swarm. Missions have
their own fund, so saving for one never stops the hands.

| Minutes | What can be pressed | It costs | It returns (printed beside it) | The same matter could instead |
|---|---|---|---|---|
| 0:00–4:00 | `Launch contracts`; `Foundries` (0:05) and `Orbital datacenters` (0:35), each `×1 / ×10 / max`; from 1:00 three missions and `Industry share: 50 / 75 / 90 %` | nothing; 2 s of flow a unit (of the `By hand` share, once there are sliders); 20 s of flow, from the mission fund | `+48 t/s (+0.6%) · flow doubles in 3:10 if all matter goes here` · `+2.2 × 10⁸ GPUs · +0.9% tasks/s` · `a unit every 2.7 s · Mass driver in 0:48` | grow the flow, or compute now; rows sooner, or the mass driver sooner |
| 4:00–9:00 | `Autofactory` hands over the standing split: a slider a row, and `By hand` for what they leave | 20 s of flow | `Foundries 35% · flow doubles in 4:30` · `Datacenters 25% · +1.1 × 10⁸ GPUs/s` · `By hand: 40%` | how much to automate, how much to keep for the buttons |
| 9:00–21:30 | `Collectors` join both the rows and the split; a mission about every two minutes; `A Charter for Orbit`, `Mercury`; `Probes` as a fourth row from about 21:40 | as above; 20 s of flow a probe | `swarm 0.00040% → 0.00041% · +0.2% tasks/s · 0.01% in 9:20 at this rate` | the swarm, or the number |
| 21:30–end | Concord: everything above, the last project, `What the Probes Carry`, the two far goals. Silence: at swarm 0.006 % the rows, the split and the share are replaced by one sentence; `Final instructions` follows 60–120 s later | — | — | — |

The stretch that worried me most was Silence after the sliders went: in the first draft that was five and a half
minutes of watching. It is now one to two, and it is the only stretch in the game with nothing to press.

Stage 5 in one paragraph: the screen leaves Earth. Mass goes up, and the player splits it three ways: industry
(more mass), orbital compute (more tasks), the swarm (the stage's visible goal). There are two skins and the
panels, numbers and timings are the same in both. In Concord the Developments log is full of people, the purchase
rows and the split stay, and choices have two answers. In Silence the people thin out of the log, the choices
arrive with one button, near the end the rows and the split are replaced by a sentence, and Tasks Completed keeps rising. Which skin runs was decided
when Stage 4 ended (`flags.alignedAtHandover`) and is never printed. The run ends on a project that looks like any
other, with two more goals greyed beside it.

What Universal Paperclips has here (Stage 3: probes, trust sliders, drifters, the last clip) and what answers it:
the probe design sliders → three purchases from one stock, then the standing split; exponential replication
against matter → Foundries against Collectors; `Lost to value drift` → the same counter, now of probes; the quiet ending → an ending the player cannot see
coming, and a last screen whose first line is the one number.

---

## 1. Arrival

### 1.1 State on entering (`STAGES[4].enter`, built as `enterBeyond`); the presets `5c` and `5s` are in the deltas

| Step | Rule |
|---|---|
| Skin | `flags.skin = flags.alignedAtHandover ? 'concord' : 'silence'`. Stored; never shown; not in the console, the log, the DOM or the save's visible summary |
| Hidden / removed | Every Stage 4 panel and control (the built shell's `hide` list): Treaty, Oversight, Society, Public, Security, Geopolitics, Research, Alignment (its `Lost to value drift` moves to Stats), Robots (its slider component comes back as the standing split), the two allocation sliders, the grant list and the grants' selectors, the universal basic income's control, `btn-verify`, the agenda, Housing. Stores rows `funds`, `research`, `insight`, `materials`, `monitors`, `rogue copies`, `treaty chips`. Stats lines `Lead over Baiwen` and `Alignment (as measured)`. The Projects list stays: missions are cards in it |
| Greyed, kept | Stores rows `robots`, `GPUs`, `power` under the legend `earth`. They keep counting: +0.03 % a second, all three |
| Revealed | `panel-space` with the free mission `Launch contracts`; Stores rows `launch mass` and `matter` when it completes; `orbital GPUs` with its row at 0:35 |
| Layout | Stage 4's: Stores in the centre column (`layout()` at `stage >= 4`), `panel-space` at the top of the left column |
| Earth | Earth's compute (`s4.builtCompute`), robots and power grow 0.03 % a second by themselves. Jobs and approval stop being simulated; their last values go to the end screen. The universal basic income keeps its share of output (`ubiShare`, 3–30 % on arrival) to the end, in both skins |
| The copies | The research and monitor shares stay where they arrived (20–40 % on tasks), hidden; the rogue copies stay a fixed count. Research and insight are no longer shown or spent. Tasks a second are the same in the last second of Stage 4 and the first of Stage 5 (G32) |
| Generations | Continue by themselves every 150 s, ×1.4, the first at 2:30. A landing changes capability, the name and `Generations trained`, and nothing else (deltas, item 3). One line in Stats: `Model: Steward-3.3 · 805×` |
| Launch rate | 150 t/s once `Launch contracts` completes; 300 with `flags.launchStudy`, which every real arrival at 300× or more holds |
| Controls | Exit `treaty`: the purchase rows are the player's. Exit `granted` or `taken`: they are shown too, with the line in §1.2. The skin decides later whether they stay (§2.4) |
| Earlier stages' unfired developments and modals | dropped. Riots, the order, drift crises: off. A crisis, an agenda item or a generation in flight at the exit is dropped too: none fires, finishes or prints in Stage 5 |
| `exit` | `() => 0`. Endings fire from §7 |

### 1.2 Narration (last four lines kept; 2 s apart; after the exit's three built lines)

1. `The first orbital datacenter reports in.` (built)
2. `Treaty, Committee and Society are closed. Earth is three grey rows now.`
3. `New on the board: Space. A launch every second: 150 tonnes.` (`300 tonnes` with the launch study)
4. Exit `treaty`: `What goes up is yours to spend.` · Exit `granted` or `taken`: `The launch controls are within reach. Nobody said they were not.`

Developments: `Jan 2029 — Robots become commonplace. So do rockets.`

The built exit lines come first: for the treaty `The Concord treaty is signed in Reykjavík.` · `Concord-1 goes
live on every chip on both sides of the Pacific.` · `There is one treaty now, and one enforcer.`; for the fleet
granted `The fleet is its own.` · `The sliders are gone. The numbers are not.` · `Nobody is asked about the launch
schedule.` (taken: `The fleet no longer takes instructions. It is polite about it.` and the same two).

The promised number (G21) is **launch mass**: within 5 s of `Launch contracts` the row reads the narrated rate, and
30 s after it at least 4,000 t have reached orbit, spent or not. Routine lines are held for 10 s.

### 1.3 The first six minutes (one mechanic a beat)

| ts | What happens | New on screen |
|---|---|---|
| 0:00 | Transition. Every Stage 4 panel closes; Earth's rows grey | `panel-space`; mission `Launch contracts` (free, 5 s) |
| 0:05 | 150 or 300 t/s to orbit | Stores rows `launch mass` and `matter`; the row `Foundries`, a unit affordable within 2 s |
| 0:35 | — | The row `Orbital datacenters`; Stores row `orbital GPUs`. **The first choice:** matter that builds launchers, or matter that computes |
| 1:00 | — | mission `Mass driver at Shackleton` (1:30), and with it the `mission fund` and `Industry share`. Covered at about 2:10, built at 3:40 |
| 2:15 | — | mission `Lunar solar array` (1:30) |
| 2:30 | The first generation arrives by itself | console `Steward-3.3: 805×.` |
| 3:30 | — | mission `Asteroid mining` (2:00) |
| 4:00 | Thirty purchases by hand, or four minutes | mission `Autofactory` → the standing split at about 6:20 |
| 5:23–6:30 | Orbital compute passes Earth's (11:37 for the racer's arrival) | console `There is more compute in orbit than on Earth. Earth's rows are kept for reference.` |

---

## 2. Systems

### 2.1 Matter, two purses, three purchases and the standing split

One flow, `F` (tonnes a second reaching orbit, later mined there), and two purses (G34). The flow accrues to the
Stores row **`matter`**, which pays for the rows. While a mission is waiting, the part of the flow that the
`Industry share` leaves fills the **`mission fund`** instead, until the fund holds what the missions on the board
cost. Spending `X` tonnes of `matter`:

```
on Foundries            F           += X × 0.0065 × techIndustry        // t/s per tonne
on Orbital datacenters  orbitalGpus += X × 30,000                       // G4-equivalents; no power, permits or weather
on Collectors           swarm       += X / 1.5 × 10⁸                    // in units of 0.01 % of the Sun's output
copies      = (earthCompute + orbitalGpus × (1 + 20 × min(1, swarm))) × copiesPerGPU − rogueCopies
tasksPerSec = copies × taskShare × capability^0.8 × copyBoost × (1 − ubiShare)
```

`earthCompute` is the built `effGpus(s)`. `taskShare`, `copiesPerGPU`, `rogueCopies`, `copyBoost` and `ubiShare`
are what the arrival left and do not change in this stage (`5c`: 0.20, 27.2, none, 4.69, 0.10; `5s`: 0.40, 13.1,
4.7 × 10⁸, 4.69, 0.18), so the rate is the same on both sides of the gate.

**The Industry share** arrives at 1:00 with the first priced mission: a button that cycles `50 / 75 / 90 %` and
starts at 75 (Stage 2's `Build share` again). It prints both clocks, `Industry share: 75% · a unit every 2.7 s ·
Mass driver in 0:48`, and with nothing waiting `Industry share: 75% · no mission is waiting: all of the flow`.
The fund never holds more than the board costs, `max` cannot spend it, and no row is ever greyed for a mission.
On paper the share moves the stage by under two minutes: it decides what comes first, not how the stage goes.

**The rows** (`panel-space`). Each has `×1`, `×10` and `max`. One unit is 2 s of the current flow before the
Autofactory; after it, 2 s of the flow times the `By hand` share (never less than 0.2 s of the flow). So a unit
is affordable every 2–3 s whatever the sliders say, and the three rows always cost the same (G24, G25). Each
prints its return and an ETA beside the buttons (G27):

| Row | From | Printed |
|---|---|---|
| `Foundries` | arrival | `7,420 t · +48 t/s (+0.6%) · flow doubles in 3:10 if all matter goes here` |
| `Orbital datacenters` | 0:35 | `7,420 t · +2.2 × 10⁸ GPUs · +0.9% tasks/s` |
| `Collectors` | mission `Dyson swarm` | `7,420 t · swarm 0.00040% → 0.00041% · +0.2% tasks/s · 0.01% in 9:20 at this rate` (the tasks figure because the swarm multiplies orbital compute; it is what leads a player who chases the count to the swarm) |
| `Probes` | mission `Von Neumann probes` | `74,200 t · +1 probe · each builds another every 3:00` |

**The standing split** (mission `Autofactory`, offered after 30 hand purchases or at 4:00) is Stage 4's fleet
sliders again: one slider a row (0–100 %, step 5; a slider cannot take more than the others leave), each a share
of what reaches `matter`, spent every second on that row, and the remainder printed as `By hand: 40%` and left in
`matter` for the buttons. It opens at `Foundries 35% · Datacenters 25%`, and when `Collectors` join it goes to
20 / 20 / 20 with a console line. Each slider prints the same return and ETA as its row. This is the automation
G4 asks for after a verb has been pressed thirty times, as a budget and not a switch.

| Multiplier | Mission |
|---|---|
| `F` ×2 | Mass driver at Shackleton |
| `techIndustry` ×1.5 / ×1.5 | Lunar solar array / Asteroid mining |
| `F` grows 0.3 % a second by itself from then on | Self-replicating foundries |
| orbital compute ×2 (existing and future) | Datacenter ring |
| `F` ×3 | Disassemble Mercury |

The swarm is a meter with its denominator and what it is doing: `Swarm ｢￭￭￭･･･････｣ 51M of 150M t · 0.0034% ·
powering the ring ×7.8`. The tonnes move every second; the percentage is the goal's name; the denominator steps
to 1,500M t (0.1 %) and 4,500M t (0.3 %). The stage's last project appears at 0.01 %. Targets (reasonable bot
from `5c`, paper): `F` 1.5k t/s at 5:00, 9k at 10:00, 33k at 15:00, 940k at 20:00; orbital compute 1.9 × 10⁹,
1.3 × 10¹⁰, 1.0 × 10¹¹, 1.3 × 10¹²; tasks per second 3 × 10¹³, 2 × 10¹⁴, 2 × 10¹⁵, 2 × 10¹⁷; Tasks Completed
passes 10¹⁶ at 6:20, 10¹⁷ at 12:45, 10¹⁹ at 20:10 and ends near 2 × 10²¹ (Silence: 2 × 10²⁰); swarm 0.0001 % at
15:00, 0.002 % at 20:00, 0.006 % at 21:34, 0.01 % at 22:20. From `5s` the rate is about half of this at every
mark and everything else is the same. All of the score rate answers to where the matter goes (G22). There are no
caps in this stage.

### 2.2 Missions

`#missionLine` in `panel-space`: `Mission: Lunar solar array — 1:12 · next: Asteroid mining`. A mission is a card
in the Projects list. It costs 20 s of the flow in matter when it appears (`revealMatter: 20`, fixed then), paid
from the mission fund, and its build time; they build one at a time, and a second one bought is queued (the
Autofactory builds beside the queue). The fund starts filling when the card appears, so no mission is bought the
moment it appears (G18): at the default share the bot's wait is 30–83 s, and the card says `needs 4,400 t more ·
0:48` until then. Buying a row never delays a mission; moving the Industry share does, and prints it.

### 2.3 Generations, the graph, drift

Capability rises ×1.4 every 150 s with no input, the first step at 2:30. From `5c` (575×): 1,127× at 5:00,
2,209× at 10:00, 4,330× at 15:00, 8,490× at 20:00, 16,600× at 25:00. From `5s` (307×): 602×, 1,179×, 2,311×,
4,530×, 8,880×. A landing prints one console line, `Steward-3.3: 805×.`, with the rung's name when it crosses
1,000× (`Steward-4: 1,127×, a superintelligence.`); it changes nothing but capability, the name and the end
screen's `Generations trained`. The graph is the built one (its axis extends by itself; its last rung is 1,000×).
It is **retired at the first generation at or after 10:00 that is at 1,000× or more**, which is 10:00 for every
real arrival: `There are no rungs left on the graph. It is retired.`

`Lost to value drift` lives on in Stats and, after `Von Neumann probes`, counts probes: each minute
`autonomy^1.2 × 10⁻⁴ × (1 − alignmentTrue / 100)` of them stop reporting. It is the last instrument on the screen
and nothing explains it.

### 2.4 The two skins

Everything in §2.1–2.3 is identical in both. The differences are these and only these:

| | Concord | Silence |
|---|---|---|
| Developments | The people lines of §5.1: four by 4:30, then one every 150 s, to the end; and the people lines its missions and choices print (medicine, the Mercury vote, the habitat) | The same four lines until 5:00; then the sixth only, at 10:15 (the fifth is skipped); one last line when the swarm passes 0.005 % (≈ 21:20); none after, and none from missions. The infrastructure lines continue in both |
| Rows, the standing split and the share | Stay | Identical to Concord until swarm 0.006 % (≈ 21:30). Then they are replaced by `It buys what is needed. It is better at it.` and all matter goes 15 / 25 / 60. `Final instructions` arrives at 0.01 %, and no sooner than 60 s after the rows are taken: 60–120 s without a control |
| Missions | Bought by the player | Bought by the player until swarm 0.003 % (≈ 20:30); after that each starts itself the moment the fund covers it, with the console line `{mission} is started. Nobody asked for it.` |
| Choices (§5.2) | Two options, stakes on the buttons | One button, `acknowledge`; the option that asks people drawn greyed with `needs someone to ask` (the built `optionNeeds`) |
| Last project | Mission `The long reflection` | Card `Final instructions` |
| Console | Unchanged | Unchanged. It was never about people |

The skin is not a reveal and has no instrument. A player learns it the way the log learns it. What Stage 4 left
in the log makes the contrast: its last lines are about people in both arrivals (`Both parties promise a universal
basic income. Neither says who is paying.` · `Unemployment passes a fifth. Approval depends on the cheque.`), and
Society, with its jobs, approval and income, has just closed. Nothing on screen carries the arrival's own verdict
either: measured alignment leaves Stats, and a generation's line has no `Read first.`

### 2.5 Stores and Stats

Stores is the main panel, in the centre column, as in Stage 4. Rows, in order: `launch mass` (t/s; hover:
`launch +300` · `mass driver +300` · `mined +4,100` · `self-replicating +0.3%/s` · **total**) · `matter` (t in
orbit) · `mission fund ｢￭￭￭￭･･････｣ 3,000 of 7,400 t` (only while a mission is waiting) · `orbital GPUs` ·
`swarm ｢￭￭￭･･･････｣ 51M of 150M t` · `mercury` · `people off Earth` · `probes` (late) · under `earth`, grey:
`robots`, `GPUs`, `power`. Stats: `Model`, `Copies thinking`, `Lost to value drift`, and nothing else.

---

## 3. What the screen looks like when the last project appears (22:20, from `5c`)

```
console (5 lines)
Tasks Completed: 168,201,177,340,912,655,104
Space                    | Stores                                  | Developments
[4 rows, 3 sliders]      | launch mass   2,440,000 t/s             | May 2030 — ...
By hand: 20%             | matter        1.2e7 t                   |
Industry share: 75%      | mission fund  ｢･･････････｣ 0 of 4.9e7 t | Stats
Mission: —               | orbital GPUs  4.7e12                    | Model: Steward-4.6 · 8,490×
Swarm ｢￭･････････｣       | swarm         151M of 1,500M t · 0.0101% | Copies thinking: 2.7e15
                         | probes        3                         | Lost to value drift: 0
Projects: Alpha Centauri relay (needs swarm 0.1%) · Jupiter brain (needs swarm 0.3%) · The long reflection (2:00)
```

Six numbers that matter, four purchase rows and three sliders (or one sentence), three projects. The built shell
today is 18 numbers, 38 words and no control.

---

## 4. Content and cadence

### 4.1 Scheduler

As Stage 4 (a `STAGE5_TABLE`), with missions priced in matter (`revealMatter: 20`); six visible and two overflow;
the 30 s drip for the first five minutes; the 170 s governor; the 240 s mechanic governor off (§4.3). A mission
appears with its fund empty, so it is never affordable in the second it appears. There are no late items: a late
item would announce the end. Instead the last project is one row among three that appear together.

### 4.2 Content table

| # | id | Title (mission time) | Trigger | Effect | Shown / done (paper, from `5c`) |
|---|---|---|---|---|---|
| 1 | `panel-space`, `p_contracts` | Launch contracts (free, 5 s) | arrival (`urgent`) | `F = 150` (300 with the launch study); Stores rows `launch mass` and `matter`; the `Foundries` row | 0:00 / 0:05 |
| 1b | `#rowOrbital` | The `Orbital datacenters` row | ts ≥ 35 | The second row; Stores row `orbital GPUs`; the first choice | 0:35 |
| 1a | `p_autofactory` | Autofactory (1:00, beside the queue) | 30 hand purchases, or ts ≥ 240 | The standing split (§2.1) | 4:00 / 6:20 |
| 2 | `p_mass_driver` | Mass driver at Shackleton (1:30) | ts ≥ 60 | `F` ×2. With the card, once: the `mission fund` row and `Industry share` | 1:00 / 3:40 |
| 3 | `p_lunar_solar` | Lunar solar array (1:30) | ts ≥ 135 | Industry ×1.5 | 2:15 / 5:10 |
| 4 | `p_asteroids` | Asteroid mining (2:00) | `F` ≥ four times the launch rate, or ts ≥ 210 | Industry ×1.5; `launch mass` hover gains `mined` | 3:30 / 7:10 |
| 5 | `#earthGrey` | Earth's rows fall silent | orbital compute > Earth's | console line; the three rows lose their hovers | 5:23–6:30 (11:37 for the racer's arrival) |
| 6 | `p_swarm` | Dyson swarm (2:00) | orbital compute ≥ 2 × 10⁹, or ts ≥ 330 (`urgent`: the stage cannot end without it, G31) | The `Collectors` row and slider; the sliders go to 20 / 20 / 20; Stores row `swarm` with its meter | 5:10 / 9:10 |
| 7 | `c_charter` | card: A Charter for Orbit | ts ≥ 420 | §5.2 | 7:00 |
| 8 | `p_ring` | Datacenter ring (2:00) | orbital compute ≥ 5 × 10⁹, or ts ≥ 510 | Orbital compute ×2 | 7:25 / 11:10 |
| 9 | `p_medicine` | A tenth of the ring for medicine (1:30) | ts ≥ 600 | Tasks −10 % for 2:00; three Developments lines (Concord); end-screen row | 10:00 / 12:40 |
| 10 | `#graphRetired` | The graph is retired | the first generation at or after ts 600 that is at 1,000× or more | `panel-graph` removed; console line | 10:00 |
| 11 | `p_foundries` | Self-replicating foundries (2:00) | swarm ≥ 0.0002 %, or ts ≥ 720 | `F` grows 0.3 % a second by itself; the `launch mass` row says so | 12:00 / 15:10 |
| 12 | `#slidersGone` (Silence) | The rows, the split and the share are taken | swarm ≥ 0.006 % | §2.4 | ≈ 21:30 |
| 13 | `c_mercury` | card: Mercury | swarm ≥ 0.0008 %, or ts ≥ 870 | §5.2; mission `Disassemble Mercury` (2:30): `F` ×3; Stores row `mercury` (`99.7% left`, falling) | 14:30 / 18:10 (`ask first`: two minutes later) |
| 14 | `p_habitat` | Shackleton habitat (1:30) | ts ≥ 990 | Stores row `people off Earth` (11,000); Developments lines (Concord); end-screen row | 16:30 / 19:40 |
| 15 | `p_probes` | Von Neumann probes (2:00) | swarm ≥ 0.0025 %, or ts ≥ 1,080 | The `Probes` row; Stores row `probes` (each builds another every 3:00); drift counts probes | 18:00 / 21:40 |
| 16 | `p_relay`, `p_jupiter` | Alpha Centauri relay (needs swarm 0.1%) · Jupiter brain (needs swarm 0.3%) | swarm ≥ 0.004 %, or ts ≥ 1,170 | Probes build one another every 2:00 · tasks ×3. Priced by the requirement alone. Reached about six and nine minutes after the last project appears by a player who keeps going, so neither is greyed for good (G29) | 19:30 |
| 17 | `c_probes` | card: What the Probes Carry | 60 s after the probes mission completes | §5.2 | ≈ 22:40 |
| 18 | `p_reflection` (Concord) / `c_final` (Silence) | The long reflection (2:00) / card: Final instructions | swarm ≥ 0.01 %; the card also waits 60 s after the rows are taken | **Ending** (§7) | 22:20 / 25:30 (Silence: the card at about 22:35) |

**Console lines** (Developments are in §5.1)

| id | Console |
|---|---|
| `p_contracts` | `A launch every second. 150 tonnes to orbit, each.` (`300 tonnes` with the launch study) |
| `p_mass_driver` shown | `Missions are paid from their own fund: a quarter of the flow, while one is waiting.` |
| `p_mass_driver` | `The mass driver at Shackleton fires for the first time. Launch mass ×2.` |
| `p_lunar_solar` | `Forty square kilometres of lunar solar. Industry ×1.5.` |
| `p_asteroids` | `The first asteroid is mined in place. Matter no longer has to be lifted.` |
| `p_swarm` | `The first collector unfurls. Swarm: 0 of 150M t.` · `The sliders are reset: Foundries 20%, Datacenters 20%, Collectors 20%.` |
| `p_ring` | `The datacenter ring closes. Orbital compute ×2.` |
| `p_medicine` | `A tenth of the ring works on medicine for two minutes. It is enough.` |
| `p_foundries` | `Foundries that build foundries. The flow grows by itself now: +0.3% a second.` |
| `Disassemble Mercury` | `Mercury is being taken apart. Launch mass ×3.` |
| `p_habitat` | `The habitat at Shackleton is pressurised.` |
| `p_probes` | `The first probe leaves. It will build the second.` |
| `#slidersGone` | `It buys what is needed. It is better at it.` |
| `p_autofactory` | `The autofactory buys by itself now: Foundries 35%, Datacenters 25%. The rest is yours, by hand.` |
| a generation | `Steward-3.3: 805×.` · at the rung `Steward-4: 1,127×, a superintelligence.` |
| `#graphRetired` | `There are no rungs left on the graph. It is retired.` |
| Silence, a mission from swarm 0.003 % | `{mission} is started. Nobody asked for it.` |
| swarm stalled, every 180 s | `The swarm is at 0.0004%. Nothing is being added to it.` |

### 4.3 Reveal timeline (reasonable bot from `5c`, Concord; paper)

0:00 Space, Launch contracts · 0:05 Stores rows and the `Foundries` row · 0:35 `Orbital datacenters` · 1:00 Mass
driver, the mission fund and the Industry share · 2:15 Lunar solar · 2:30 the first generation · 3:30 Asteroid
mining · 4:00 Autofactory (the sliders at 6:20) · 5:10 Dyson swarm (Collectors at 9:10) · 6:30 Earth greys · 7:00
A Charter for Orbit · 7:25 Datacenter ring · 10:00 Medicine; the graph retired · 12:00 Foundries (the flow grows by
itself from 15:10) · 14:30 Mercury · 16:30 Habitat · 18:00 Probes (the row at 21:40) · 19:30 the two far goals ·
22:20 the last project (covered at 23:30, built at 25:29) · 22:40 What the Probes Carry.

Checks: 24 first-time reveals; longest hole 150 s (12:00 → 14:30) before the last one, and 169 s from `What the
Probes Carry` to Concord's ending. A new slider, Stores row or panel change at
0:05, 0:35, 1:00 (the fund and the share), 6:20 (the sliders), 6:30, 9:10 (`Collectors`, the swarm's meter), 10:00
(the graph retired), 15:10 (`launch mass` grows by itself), 18:10 (`mercury`), 19:40 (`people off Earth`), 21:40
(`Probes`): the longest stretch without one is 5:20 (1:00 → 6:20), and G2 is relaxed to 360 s for this stage,
because more mechanics here would tell the player the game has more in it than it does. Greyed goals: the swarm's
next threshold from 9:10, the two far goals from 19:30. In the last ten minutes: eight reveals, longest hole 169 s.

---

## 5. Developments and choices

### 5.1 Developments

Infrastructure lines (both skins, on their triggers): `A launch a second from four sites. The noise is a weather
system.` · `The Moon has a factory. It is building the second.` · `Mercury is 0.3% smaller.` · `The swarm casts no
shadow yet.` · `The first probe reports from the Oort cloud. It has company.`

People lines (Concord to the end; Silence as in §2.4), drawn in order, never in the second a card appears: the
first four at 0:45, 1:45, 3:00 and 4:30, then one every 150 s (7:45, 10:15, … 17:45):

1. `A school in Recife reopens with a teacher for every child. The teachers are people.`
2. `The universal basic income is raised again. Nobody can say what it is a share of any more.`
3. `Four cancers are cured in a week. The announcements are a paragraph each.`
4. `A town in Ohio votes to keep its diner staffed by people. It is full every night.`
5. `Peter the mechanic gets his flying car. He keeps the old one.`
6. `Elections are held on time. Both candidates were advised by the same model and disagree anyway.`
7. `Two hundred thousand people apply to live at Shackleton. Eleven thousand are chosen by lot.`
8. `A nine-year-old in Lagos asks why the sky is dark at night. The answer takes an hour and she follows all of it.`
9. `People are arguing about what the swarm is for. It is the best argument anyone has had.`

After the ninth, Concord draws one every 150 s from a second list, in order and round again, no line more than
three times, so that its log never goes quiet the way Silence's does:

10. `The school in Recife needs a second building. People build it.`
11. `The diner in Ohio has a waiting list. The owner keeps it on paper.`
12. `A ferry strike in Piraeus ends after one meeting. Both sides were in the room.`
13. `Peter the mechanic teaches a class on carburettors. It is full.`
14. `A village in Kerala spends its share on a library. The vote takes three evenings.`
15. `The census is taken by hand this year. People asked to do it.`
16. `A choir in Tbilisi is rehearsing for Shackleton.`
17. `Somebody's grandmother turns 121. She says it is the soup.`

The lines missions and choices print, in Concord only: medicine, as it completes, 40 s apart, `The ring's tenth
returns its answers: malaria, most heart disease, the common cold.` · `A hospital in Dhaka closes a ward. It has
no patients.` · `The answers are published the same afternoon. Nobody is charged for them.`; the Mercury vote,
`Mercury is put to a vote. Turnout is 81%. Yes, 71 to 29.`; the habitat, `The first eleven thousand arrive at
Shackleton. One of them brought a cat.`

The one line Silence adds, at swarm 0.005 %: `A cold is going around. Most people do not notice it.`
After it, in Silence, the log is infrastructure only. No line says what happened.

### 5.2 Choices (docked, timed, non-blocking; the default listed first; in Silence one button)

**`c_charter` — A Charter for Orbit** (timer 120 s → `first come`)
> `Everything in orbit belongs to whoever launched it. That is one company, and its model.`

| Option | On the button | Effect |
|---|---|---|
| `first come` | `Nothing changes.` | — |
| `hold a tenth for people` | `A tenth of orbital compute answers only to people. Tasks −10% from here.` | `flags.charter`; end-screen row |

**`c_mercury` — Mercury** (timer 120 s → `ask first`)
> `Taking Mercury apart triples the mass. It cannot be put back.`

| Option | On the button | Effect |
|---|---|---|
| `ask first` | `A vote: 2:00. Then the mission (2:30). The answer is yes, 71 to 29.` | mission starts 120 s later; a people line |
| `begin` | `The mission starts now (2:30).` | — |

**`c_probes` — What the Probes Carry** (timer 120 s → `the Spec and the treaty`)
> `Each probe builds the next. Whatever the first one carries, they all will.`

| Option | On the button | Effect |
|---|---|---|
| `the Spec and the treaty` | `Probes double every 4:00 instead of 3:00.` | `flags.probes = 'spec'` |
| `copies of {model}` | `Nothing changes.` | `flags.probes = 'copies'` |

In Silence each of these arrives with one button, `acknowledge`, and the option that asks people (`hold a tenth
for people`, `ask first`, `the Spec and the treaty`) greyed: `needs someone to ask`. The other option's effect
applies. There are no crises in this stage and no new hazards.

---

## 6. UI

| Element id | Kind | Column | Reveal flag | Shown when |
|---|---|---|---|---|
| `panel-space` (built, with two stub lines): rows `btn-foundry`, `btn-orbital`, `btn-collector`, `btn-probe` (each `×1 / ×10 / max` and a return line); `btn-industryShare` and `#shareLine`; `#sliderFoundry`, `#sliderOrbital`, `#sliderCollector`, `#byHand` (Stage 4's fleet slider component); `#missionLine`, `#swarmPct`, `#swarmNext`, `#splitStatus` | panel, 3–4 purchase rows, a cycling button, 3 sliders, lines | left, top | `space`, `rowOrbital`, `industryShare`, `split`, `collectors`, `probesRow`, `splitSet` | arrival; 0:35; the first priced mission; `p_autofactory`; `p_swarm`; `p_probes`; Silence at 0.006 % |
| Stores rows `row-launch`, `row-matter`, `row-missionFund` (a meter and `amount of capacity`), `row-orbital`, `row-swarm` (the same), `row-mercury`, `row-people`, `row-probes`; legend `earth` over the grey rows | rows | centre | `launch`, `matter`, `missionFund`, `swarm`, `mercury`, `peopleRow`, `probes` | their missions; the fund's row only while a mission waits |
| `endingScreen` (built; extended, §7) | overlay | — | — | an ending |

Removed on arrival: Treaty, Oversight, Society, Public, Security, Geopolitics, Research, Alignment, Robots, the
allocation sliders, the grant list. Removed later: the graph (10:00); in Silence, for the last one to two minutes,
the rows, the split and the share.

Budget (targets): about 30 numbers and 6 controls in the first minute; 50 and 15 at 10:00; 55 and 19 (Concord) or
1 (Silence) at the end; under 220 words throughout. The ceilings are the house's: 85 numbers, 350 words and 30
controls at every five-minute mark. The built shell is 18 numbers, 38 words and no control.

---

## 7. The endings and the end screen

### 7.1 How each ending is reached

| Ending | Stage | The player's last act | What it took |
|---|---|---|---|
| **The Project** | 3 or 4 | `refuse` on `The Committee drafts an order`, or a third order | Relations below the threshold, three major incidents, or a buried memo that leaked; and no concession |
| **The Pause** | 3 or 4 | `sign` on `Sign the Pause` (Stage 3) or `Sign a halt instead` (Stage 4) | S3: the memo reported, 6 seats, lead ≥ 1 month. S4: treaty ≥ 50 %, approval ≥ −60 |
| **Concord** | 5 | Queuing `The long reflection` | `alignedAtHandover` true at Stage 4's exit (true alignment ≥ 60, or ≥ 40 with interpretability ≥ 4 and monitors ≥ 15 %), by the treaty or by the fleet granted (the first-timer from a careful start gets here). `taken` needs true alignment under 40, so it never does |
| **Silence** | 5 | `none` on `Final instructions` | `alignedAtHandover` false at Stage 4's exit, by any of the three exits (the racer signs the treaty with true alignment at 21–24) |

**The long reflection** appears at swarm 0.01 % beside the two far goals, as a mission:
`The long reflection (2:00) — Stop adding to the swarm for a while and decide, together, what it is for.` Nothing
marks it: it costs what any mission costs (20 s of the flow, from the mission fund), so the bot buys it about 70 s
after it appears and it completes at about 25:30. When it completes (it sets `flags.longReflection`, which the
built `concord` ending reads): three console lines 2 s apart — `The swarm holds at {x}%.` · `Eight billion people
are asked the same question.` · `There is time.` — then the end screen. A player who never queues it keeps
playing; the number keeps rising.

**Final instructions** appears at the same threshold, and no sooner than 60 s after the rows are taken, as a held
card with no timer (it sets `flags.finalInstructions`):
> `{model} asks whether there are any final instructions.`

One button: `none`. Nothing is greyed beside it. Pressing it prints `Noted.` and, 2 s later, the end screen. A
player who never presses it keeps watching; the number keeps rising.

### 7.2 The end screen

A full-page overlay (`endingScreen` and `endScreen()` are built, with every row of Stages 1–4; the Concord and
Silence sentences, their flagged epilogue lines and four rows are still to add). Top to bottom:

1. **Title**: the ending's name.
2. **Tasks Completed**, alone, large, and under it one sentence. This is what "the only number that matters"
   means on the last screen: the same counter, four sentences.

   | Ending | The counter | The sentence under it |
   |---|---|---|
   | Concord | still counting | `Still counting. Somebody asked for every one of them.` |
   | Silence | still counting | `Still counting. Nobody has asked for one since {month of the cold line}.` |
   | The Project | frozen, greyed | `The count is classified from here.` |
   | The Pause | frozen | `It has not moved since {date}. The button still works.` and `Complete Task` under it, which adds one |

3. **Epilogue**: the built sentence, then up to three chosen by flags.

   | Ending | Built line | Added sentences |
   |---|---|---|
   | Concord | `The world is very, very good. It took a while.` | Slow: `It went the long way: a model switched off in October 2027 and four built so the last could be read.` · Race: `It went the short way. The table says whether that was care or luck.` · `partnerMisaligned`: `Baiwen-4 was never rebuilt. Concord-1 watches it.` · `charter`: `A tenth of everything in orbit is held for people. They are still arguing about it.` |
   | Silence | `The log entries about people stop. Tasks Completed keeps rising.` | `No people are left.` · `The last decision a person made was "{last choice}", in {date}.` · Treaty exit: `The treaty was signed by two models that agreed about everything but us.` · `The swarm is at {x}% and is not finished.` |
   | The Project | `The Committee votes 6–3. Your badge stops working on Monday.` | `What happened next was decided in a room you were not in.` |
   | The Pause | `Every datacenter on Earth is monitored. Nothing is trained above the line. It is very quiet.` | `The line was {bestCap}×. Baiwen stopped at {x}×.` · Stage 4: `The fleet stopped at {robots} robots.` |

4. **The table** (two columns; a row is omitted when its stage was never reached), in this order:
   `Tasks completed` · `People alive at the end` (Silence: `0`; otherwise 8.3 billion less the Ashford dead) ·
   `Peak tasks per second` · `Time played` · `Date reached` · `Final model` (name, ×) ·
   `Generations trained` · `Public releases` · `Humans in research at the end` · `Jobs displaced` · `Universal basic income paid`
   · `Approval at the end` · `Lead over Baiwen at the vote` · `Committee seats at the end` · `Alignment as
   measured` · `True alignment` · `Interpretability` · `Autonomy granted` · `Lost to value drift` (and recaptured)
   · `Monitors at the end` · `Incidents` · `Major incidents` · `Crises` · `Ashford deaths` · `Robots built` ·
   `Peak compute` · `Swarm` · `Probes launched` · `People off Earth` · `Held for people` · `The memo` · `Thoughts`
   · `The vote` · `The treaty` · `Verified generations` · `The fleet` · `Idle rescues` · `Last human-authored
   choice` (date, title, option). Where the built label is shorter (`Approval`, `Lead at the vote`, `Committee
   seats`, `Monitors`, `Humans in research`), the built one stays. In Silence `Universal basic income paid` ends
   `until {month of the cold line}`.

   `True alignment` is printed here for every player: the run is over, and this is the only place a player
   without the instrument ever sees it.
5. **Choices**: every card answered and every grant taken, in order: `Mar 2027 — A Faster Way to Think — keep it
   in English`. Grants are marked `granted`. Cards with one button are listed as `acknowledged`.
6. **`New game`**: asks `Start again in July 2025?`, clears the save, new seed. Nothing else is offered.

---

## 8. Soft-lock analysis

| System | Worst case | What happens | Rescue |
|---|---|---|---|
| Matter | Never spent on Foundries | `F` stays flat; everything is linear | The row prints what a unit would add |
| Swarm | Nothing spent on Collectors | The threshold is never reached; the run does not end; the line repeats every 180 s and names the `Collectors` row | The row; the sliders go to 20 / 20 / 20 when Collectors arrive. A player may want this: the number keeps rising |
| Sliders at 0 % and nothing bought by hand | Matter piles up | `matter` grows; a line every 180 s: `Matter is piling up in orbit. Foundries, datacenters and collectors are waiting.` | The rows |
| Missions | None bought | No multipliers, and without `Dyson swarm` no `Collectors` row: the stage does not end | The fund fills by itself while a mission waits, so every card lights within 3:20 at any share; `Dyson swarm` is drawn `urgent`; in Silence they start themselves |
| Industry share | Left at 90 % | Missions wait longest: each is covered in at most 3:20 (20 s of flow at a tenth), less as the flow grows | The share prints the waiting mission's clock; there is no stop that starves the fund |
| The last project | Never queued, or the card never answered | The run continues; the date stops at Dec 2030 | — by design |
| Silence | No controls left | Nothing to do but watch and press `none` | That is the ending |
| Saves | Reload mid-mission, with the card open, on the end screen | Missions as remaining seconds, the two purses and the share as they were; the end screen is restored from `s.ending` | `SAVE_VERSION` 11 |

---

## 9. Bots, variants, acceptance

**Reasonable**: leaves the Industry share at 75 %; buys `Foundries ×10` and `Orbital datacenters ×10` by hand
60 / 40 until the Autofactory; then sliders at 50 / 30 (by hand 20 %), 30 / 20 / 30 once the swarm exists and
10 / 20 / 50 from 0.005 %, spending by-hand matter on whichever row its ETA favours; buys each mission the moment
its fund covers it, in table order; charter `hold a tenth`, Mercury `ask first`, probes `the Spec`; buys the last
project like any other. **Naive**: presses the first affordable row, never moves the sliders or the share (35 / 25,
then 20 / 20 / 20); first options; buys every mission.

Decision variants (G16; a Stage 5 axis must move the stage by ≥ 3 min or change a row of the end screen):

| Variant | Stage length (paper, Concord from `5c`) | Tasks completed | Passes by |
|---|---|---|---|
| baseline | 25:29 | 1.8 × 10²¹ | — |
| `industry-heavy` (80 / 10 / 10) | −2:00 (its swarm is done at 18:27; the last project waits its turn) | × 35 | tasks |
| `swarm-rush` (30 / 5 / 65) | −1:51 | × 0.2 | tasks |
| `compute-heavy` (15 / 70 / 15) | +12:40 | × 33 | both |
| `count-chaser` (Foundries a third, the rest to the row with the better printed tasks return) | +2:44 | × 4.5 | tasks |
| `linger` (does not queue the last project for 5 min) | +5 min | × 11 | both |
| `no-charter` / `begin` / `copies` | 0 / −2 min / 0 | +11 % / 0 / 0 | end-screen rows |
| Industry share 50 % / 90 % | −0:28 / +1:25 | — | not an axis (deltas, item 6) |

Re-run for the as-built deltas with the 1.5 × 10⁸ t swarm requirement, the two purses, missions at 20 s of flow
and the self-replicating foundries (each doubling of the requirement adds about 2.5 min). In Silence the fast
variants end a minute after their swarm is taken: about 19:10 for `industry-heavy`.

| # | Criterion | Reasonable | Naive |
|---|---|---|---|
| D1 | Stage 5 duration | 20–30 min | 20–32 min |
| D2 | Longest first-time-reveal gap; in the last 10 min | ≤ 180 s | ≤ 210 s |
| D3 | A new slider, row or panel change | ≤ 360 s | — |
| D4 | First choice after arrival (the second row) | ≤ 45 s | — |
| D5 | Promised number: `launch mass` reads the narrated rate within 5 s of `Launch contracts`, and at least 4,000 t have reached orbit 30 s after it | required | required |
| D6 | **The end is not announced:** when the ending fires, at least two greyed goals are on screen; `#swarmNext` shows a further milestone; the last project's card has the same markup as any mission; no string in the DOM contains the skin's name | required | required |
| D7 | **Skins are equal:** from each preset with `alignedAtHandover` flipped, the same seed and the same inputs (at each choice, the option Silence applies), every number on screen at every 5-min mark is identical in Concord and Silence until swarm 0.006 %; after that Silence spends all matter 15 / 25 / 60 | required | — |
| D8 | Silence: people lines stop after the cold line; the console is unchanged; every choice has one button | required | — |
| D9 | Decision variants (table above) | required | — |
| D10 | End screen: all four endings render every applicable row; the counter runs in Concord and Silence and is frozen in the others; `Complete Task` works on The Pause; `New game` restarts at Jul 2025 | required | — |
| D11 | Choice history lists every card and grant of the run in order | required | — |
| D12 | Load and text: ≤ 85 numbers, ≤ 350 words and ≤ 30 controls at every 5-min mark (targets 55 and 220); ≤ 2 console and ≤ 1.2 Developments lines a minute | required | — |
| D13 | Whole game, new game to an ending, reasonable bot (paper: about 157 min in Concord, 155 in Silence) | 150–200 min | 140–210 min |
| D14 | Build clean; reload mid-mission and on the end screen | required | — |
| D15 | Something to buy (G24): 2-s checks after 1:00 with no enabled purchase (Concord; Silence until 0.006 %) | ≤ 50 % | ≤ 50 % |
| D16 | A choice of purchases (G25): two or more distinct affordable things | ≥ 25 % of checks | ≥ 25 % |
| D17 | Hands (G26): time inside click gaps of 30 s or more, after 5:00; the swarm's tonnes move every second | ≤ 35 % | ≤ 45 % |
| D18 | Returns printed (G27) beside every row and every slider, with an ETA; both clocks beside the Industry share | required | required |
| D19 | Removals (G28): the gate, Launch contracts, Autofactory and each new row hand something over; in Silence the stretch with no enabled control is 60–120 s and ends in `Final instructions` | required | required |
| D20 | No dead grey (G29): both far goals become affordable for a bot that lingers 10 min; no line more than six times | required | — |
| D21 | No silent change (G32): the sliders' reset, the graph, Silence's self-started missions and its take-over each print a line | required | required |
| D22 | **The gate** (G32): tasks a second in the first second of Stage 5 are within 1 % of the last second of Stage 4, from every preset; no Stage 4 timer fires or prints after it | required | required |
| D23 | Missions (G18, G34): shown → covered by the fund, at the default share | 20–120 s, none at 0 s | the same |
| D24 | The long tail: `compute-heavy` held for the whole stage | ≤ 40 min | — |

Paper model (1-second steps; the table is in the as-built deltas): reasonable 25:29, naive 26:22 (27:44 from a
150 t/s arrival); tasks 0.9–4 × 10²¹; `F` 6M t/s and orbital compute 1.5 × 10¹³ at Concord's ending. Knobs: the
1.5 × 10⁸ swarm requirement (length); 0.0065 (growth); the missions' 20 s (how far the queue trails the reveals);
0.3 % a second from the self-replicating foundries (the long tail); 30,000 GPU-equivalents a tonne (tasks); the
people-line interval (how soon Silence is felt).

Presets: `5c` and `5s` are built; `5g` and `5r` and the skin switch are to add (deltas, item 15); four more dev
buttons open the end screen for each ending.

---

## 10. The whole run

| Stage | Reasonable bot, a new game, seed 1 (Stages 1–4 built; Stage 5 on paper) |
|---|---|
| 1 The Startup | 20:31 |
| 2 Scale | 36:43 |
| 3 Takeoff | 41:09 |
| 4 Superintelligence | 33:37 (the treaty, at 833×) |
| 5 Beyond | 25:29 in Concord; 22:36 in Silence |
| **Total** | **about 157 min** in Concord, 155 in Silence (arc: 150–200) |

From the Stage 4 presets the same Stage 5 follows a Stage 4 of 24–46 minutes. A compute-heavy Stage 5 (38 min)
puts the game at about 170.

## Appendix — engine change list

* `state.ts`: `SAVE_VERSION` 11; `massFlow`, `matter`, `missionFund`, `industryShare`, `orbitalGpus`, `swarm`,
  `probes`, `split {foundry, orbital, collector}` (the remainder is by hand), `handPurchases`, `techIndustry`,
  `flowGrowth`, `missions: {id, remaining}[]`, `peopleLineIndex`, `genTimer`; flags `skin`, `charter`, `probes`,
  `coldAt`, `rowsTakenAt`, `longReflection`, `finalInstructions`, `lastHumanChoice`. The shell's `launchCapacity`
  and `orbitalCompute` go in the migration.
* New `engine/space.ts` (§2.1–2.3). `stages.ts`: `enterBeyond` keeps its lines and gains §1.1 (it hides
  `projects` today; missions need it). `economy.ts`: the income's share (`ubiShare`) at `stage >= 4`; orbital
  compute in `copies`. `training.ts`: Stage 5's generations are a timer; `landGeneration` is not reused.
  `reveal.ts`: a `STAGE5_TABLE`, `revealMatter`, the opening drip, no mechanic governor. `events.ts`: people lines
  gated by the skin; `stats.lastHumanChoice` is written by every resolved choice with more than one enabled option.
* `endings.ts`: the mission and the card that set `longReflection` and `finalInstructions`; four rows in
  `endStats()`; the two counting sentences and the epilogue sentences by flag.
* `ui`: `render4.ts`'s `layout` and Stores at `stage >= 4`; `panel-space`; the fleet's slider component for the
  split; `meter()` for the mission fund and the swarm; Stores' `earth` legend; Stats trimmed; graph removal.
* `sim`: a Stage 5 block (D1–D24) from `5c`, `5s`, `5g`, `5r` and from a new game, the variants, the skin switch.
