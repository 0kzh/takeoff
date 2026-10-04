# Stage 5 — "Beyond" (implementation spec), and the end of the run

2029 → 2030 and after · target 20–30 min · entered from Stage 4 by the treaty, by the fleet granted, or by the fleet
taken · ends with `The long reflection` (Concord) or `Final instructions` (Silence). This file also specifies the
**end screen for all four endings** (§7). Contract: `docs/specs/arc.md` (G1–G34). Arrival state: `stage4.md` §7.2.

**How to read the numbers.** `ts` = seconds since entering Stage 5; a month is 90 s (Jul 2029 9:00, Jan 2030 18:00,
Jul 2030 27:00); the date stops at Dec 2030. Minute marks are for the reasonable bot from the Concord preset,
from a small 1-second paper model (§9.4), and are targets for `npm run sim`. The stage has one currency,
**matter** (tonnes in orbit), which is the mass flow itself: three repeatable purchases spend it, and a mission
costs 90 s of the flow when it appears and then takes 60–150 s to build, one at a time.

## As-built deltas (read first)

Checked against `src/` on 2026-10-04. Stages 1–3 are built; Stage 4 is specified (`stage4.md`, with its own deltas)
and Stage 5 is a stub. Where this note and the text below disagree, this note wins.

| # | Built, or now defined | What Stage 5 does with it |
|---|---|---|
| 1 | **The stub.** `STAGES[4]` prints `The first orbital datacenter reports in.` and hides `geopolitics`, `robots`, `society`; Stage 4's exit stub reads `treatySigned` or `autonomyGranted`; `presets[4]` reuses the Stage 4 slow start and is not ready. `SAVE_VERSION` is 7 | Stage 4 takes 8 and Stage 5 takes 9. Entry is by `flags.exitKind` (`treaty` / `granted` / `taken`), set by Stage 4's three exits |
| 2 | **The hand-over** (`stage4.md` §7.2, as patched; paper values from the real Stage 4 arrivals): `tasks` 2.8–4.1 × 10¹⁵ at 1.4–1.7 × 10¹³ a second; compute 3.5–4.4 × 10⁹; 4.8M robots; a 605–613× model; `ubiShare` 0.10; `flags.alignedAtHandover` (hidden), `flags.exitKind`, `ashfordDeaths`, `flags.peopleAlive`, `partnerMisaligned`, `zones`, `launchStudy` | §1.1 as written. Presets `5c` (the bot from `4s` to the treaty) and `5s` (the naive policy from `4cr` to the fleet granted), built from real exits like the Stage 4 presets. This file's arrival figures (5 × 10¹⁵ tasks, 630×) are within a factor of two of them |
| 3 | **The end screen is built** (`engine/endings.ts`): `endScreen()` gives the title, the counter (`counting`, `frozen`, `classified`), its sentence, the epilogue, the table (`endStats`, a row only for a stage reached), the choices, and `Complete Task` under The Pause. The Project and The Pause run today. Rows present: tasks, peak rate, time, date, model, generations, releases, humans in research, jobs, approval, lead at the vote, seats, alignment measured and true, interpretability, autonomy, drift, monitors, incidents, crises, the memo, thoughts, the vote, idle rescues, the last choice | Extend, do not rebuild. Add the rows of §7.2 that Stages 4 and 5 own, and row 6 below. The built `concord` condition reads `flags.treatySigned`: it must read the skin (`alignedAtHandover`, by any of the three exits) with `longReflection`; the two counting sentences are still to write |
| 4 | **The wallet rule (G34).** The three purchase rows are a repeatable at a flat price (2 s of flow) in the purse missions are paid from | They get their own purse: `Industry share: 50 / 75 / 90 %` of the flow pays for `Foundries`, `Orbital datacenters` and `Collectors`, by hand (`×1 / ×10 / max`) or through the Autofactory's split, and prints its clock; the rest accrues for missions, which are lit when it covers them. `max` never spends a mission's matter. Nothing is held |
| 5 | **House rules.** Capacities print `amount of capacity` after their meter; the load ceilings are 85 numbers and 350 words | The swarm and the two far goals are meters with their denominators (`swarm ｢￭￭￭･･･････｣ 0.003 of 0.01%`). The dividend is **Universal basic income** wherever it is named (`Universal basic income paid` on the end screen) |
| 6 | **The brief asks for it in plain words:** in Silence nobody is left | A table row, second from the top, for every ending: `People alive at the end`. Silence: `0`. Concord, The Pause and The Project: 8.3 billion less the Ashford dead (`flags.peopleAlive`). And Silence's epilogue says it first: `No people are left.` |

## Amendments after the Stage 2 critic (arc G24–G33)

| # | Change | Where |
|---|---|---|
| 1 | **Buttons before sliders.** Mass accrues as `matter`; `Foundries`, `Orbital datacenters` and `Collectors` are repeatable purchases with `×1 / ×10 / max` and their return printed. The launch split of the first draft returns at about 4:00 as a standing order over part of the flow, with the rest left for the player's own purchases and for missions | §2.1 |
| 2 | **Missions cost matter** (90 s of flow) as well as time | §2.2 |
| 3 | **Silence takes the controls late and briefly:** at swarm 0.006 %, under two minutes before `Final instructions`. Until then its hands are Concord's | §2.4 |
| 4 | **No goal is greyed for good:** the two far goals are reachable by a player who keeps going (swarm 0.03 % and 0.1 %) and do something | §4.2 |
| 5 | Each row prints an ETA; the swarm line prints what the swarm is doing for compute; hands criteria D15–D21 | §2.1, §9 |

The paper model's economy is unchanged (a standing split of 100 % reproduces it); how a hand-spent reserve shifts
the timings was not modelled.

## What the player's hands do

One resource, matter, with three uses that compete on screen: more flow, more compute, more swarm.

| Minutes | What can be pressed | It costs | It returns (printed beside it) | The same matter could instead |
|---|---|---|---|---|
| 0:00–4:00 | `Launch contracts`; `Foundries` and `Orbital datacenters`, each `×1 / ×10 / max`; two missions | nothing; 2 s of flow a unit; 90 s of flow | `+48 t/s (+0.6%) · flow doubles in 3:10 if all matter goes here` · `+2.2 × 10⁸ GPUs · +0.9% tasks/s` | grow the flow, or compute now, or save for the mass driver |
| 4:00–8:00 | `Autofactory` hands over the `Standing split`: a share of the flow and a ratio. The rest of the flow still accrues for hand purchases and missions | 90 s of flow | `60% of the flow · Foundries 60 / Datacenters 40` with an ETA per line | how much to automate, how much to hold back |
| 8:00–21:00 | `Collectors` join both the rows and the split; a mission about every two minutes; `A Charter for Orbit`, `Mercury`; `Probes` as a fourth row from 20:00 | as above; 20 s of flow a probe | `swarm 0.00040% → 0.00041% · 0.01% in 9:20 at this rate` | the swarm, or the number |
| 21:00–end | Concord: everything above, `What the Probes Carry`, the last project, the two far goals. Silence: at swarm 0.006 % the rows and the split are replaced by one sentence; `Final instructions` follows within two minutes | — | — | — |

The stretch that worried me most was Silence after the sliders went: in the first draft that was five and a half
minutes of watching. It is now under two, and it is the only stretch in the game with nothing to press.

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

### 1.1 State on entering (`STAGES[4].enter`); the two presets are in `stage4.md` §7.2

| Step | Rule |
|---|---|
| Skin | `flags.skin = flags.alignedAtHandover ? 'concord' : 'silence'`. Stored; never shown; not in the console, the log, the DOM or the save's visible summary |
| Hidden / removed | `panel-treaty`, `panel-oversight`, `panel-society`, `panel-security`, `panel-alignment` (its `Lost to value drift` moves to Stats), `panel-robots` (its sliders become the launch sliders), the two allocation sliders, the grant list, `btn-ubi`, `btn-verify`. Stores rows `monitors`, `rogue copies`, `treaty chips`, `research`, `insight` |
| Greyed, kept | Stores rows `robots`, `GPUs`, `power` under the legend `earth`. They keep counting |
| Revealed | `panel-space` with the free mission `Launch contracts`; Stores rows `launch mass` and `orbital GPUs` appear when it completes |
| Earth | Earth's compute grows 0.03 % a second by itself. Jobs, approval and the dividend stop being simulated; their last values go to the end screen |
| Generations | Continue by themselves every 150 s, ×1.4. One line in Stats: `Model: Steward-4 · 1,240×` |
| Launch rate | 150 t/s once `Launch contracts` completes (300 with `flags.launchStudy`) |
| Controls | Exit `treaty`: the purchase rows are the player's. Exit `granted` or `taken`: they are shown too, with the line in §1.2. The skin decides later whether they stay (§2.4) |
| Earlier stages' unfired developments and modals | dropped. Riots, the order, drift crises: off |
| `exit` | `() => 0`. Endings fire from §7 |

### 1.2 Narration (last four lines kept; 2 s apart; after Stage 4's exit lines)

1. `The first orbital datacenter reports in.` (built)
2. `Treaty, Committee and Society are closed. Earth is three grey rows now.`
3. `New on the board: Space. A launch every second: 150 tonnes.`
4. Exit `treaty`: `What goes up is yours to spend.` · Exit `granted` or `taken`: `The launch controls are within reach. Nobody said they were not.`

Developments: `Jan 2029 — Robots become commonplace. So do rockets.`

The promised number (G21) is **launch mass**: 30 s after `Launch contracts` the row reads at least 4,000 t and is
rising. Routine lines are held for 10 s.

### 1.3 The first five minutes

| ts | What happens | New on screen |
|---|---|---|
| 0:00 | Transition. Six panels close; Earth's rows grey | `panel-space`; mission `Launch contracts` (free, 5 s) |
| 0:05 | 150 t/s to orbit | Stores rows `launch mass`, `matter`, `orbital GPUs`; the rows `Foundries` and `Orbital datacenters`, a unit of either affordable within 2 s. **First choice, at once:** matter that builds launchers, or matter that computes |
| 1:00 | — | mission `Mass driver at Shackleton` (1:30) |
| 2:15 | — | mission `Lunar solar array` (1:30) |
| 3:30 | — | mission `Asteroid mining` (2:00) |
| 4:00 | Thirty purchases by hand, or four minutes | mission `Autofactory` → the standing split |
| 4:45 | Orbital compute passes Earth's | console `There is more compute in orbit than on Earth. Earth's rows are kept for reference.` |

---

## 2. Systems

### 2.1 Matter, three purchases and the standing split

One flow, `F` (tonnes a second reaching orbit, later mined there). All of it accrues to the Stores row `matter`
unless the standing split spends it first. Spending `X` tonnes:

```
on Foundries            F           += X × 0.0065 × techIndustry        // t/s per tonne
on Orbital datacenters  orbitalGpus += X × 30,000                       // G4-equivalents; no power, permits or weather
on Collectors           swarm       += X / 1.5 × 10⁸                    // in units of 0.01 % of the Sun's output
tasksPerSec = (earthCompute + orbitalGpus × (1 + 20 × min(1, swarm))) × copiesPerGPU × 0.45 × capability^0.8 × copyBoost
```

**The rows** (`panel-space`). Each has `×1`, `×10` and `max`; one unit is 2 s of the current flow, so a unit is
affordable at nearly every check and the three rows always cost the same (G24, G25). Each prints its return and
an ETA beside the buttons (G27):

| Row | From | Printed |
|---|---|---|
| `Foundries` | arrival | `7,420 t · +48 t/s (+0.6%) · flow doubles in 3:10 if all matter goes here` |
| `Orbital datacenters` | arrival | `7,420 t · +2.2 × 10⁸ GPUs · +0.9% tasks/s` |
| `Collectors` | mission `Dyson swarm` | `7,420 t · swarm 0.00040% → 0.00041% · 0.01% in 9:20 at this rate` |
| `Probes` | mission `Von Neumann probes` | `74,200 t · +1 probe · each builds another every 3:00` |

**The standing split** (mission `Autofactory`, offered after 30 hand purchases or at 4:00): `Standing split: 60%
of the flow`, with one ratio slider per row (0–100 %, step 5). That share of the flow is spent every second in
that ratio; the rest still accrues as `matter` for hand purchases and missions. It starts at 60 % and 60 / 40, and
when `Collectors` join it resets to thirds with a console line. Each ratio line prints the same ETA as its row.
This is the automation G4 asks for after a verb has been pressed thirty times, as a budget and not a switch.

| Multiplier | Mission |
|---|---|
| `F` ×2 | Mass driver at Shackleton |
| `techIndustry` ×1.5 / ×1.5 / ×1.3 | Lunar solar array / Asteroid mining / Self-replicating foundries |
| orbital compute ×2 (existing and future) | Datacenter ring |
| `F` ×3 | Disassemble Mercury |

The swarm is shown with four decimals and what it is doing: `Swarm: 0.0034% · powering the ring ×7.8 · next:
0.01%`, then `0.03%`, then `0.1%`. The stage's last project appears at 0.01 %. Targets (reasonable bot, model
with all matter under the split): `F` 1.3k t/s at 5:00, 8k at 10:00, 40k at 15:00, 700k at 20:00; orbital compute
1 × 10⁹, 1 × 10¹⁰, 5 × 10¹⁰, 8 × 10¹¹; tasks per second 1 × 10¹⁴, 7 × 10¹⁴, 8 × 10¹⁵, 2 × 10¹⁸; Tasks Completed
passes 10¹⁷ at 10:00, 10¹⁸ at 15:00 and ends near 10²⁰; swarm 0.0002 % at 15:00, 0.003 % at 20:00, 0.01 % at
about 23:00. All of the score rate answers to where the matter goes (G22). There are no caps in this stage.

### 2.2 Missions

`#missionLine` in `panel-space`: `Mission: Lunar solar array — 1:12 · next: Asteroid mining`. A mission costs 90 s
of the flow in matter when it appears (fixed then) and its build time; they build one at a time, and a second one
bought is queued. So a mission competes with the three rows for the same matter, and none is bought the moment it
appears (G18).

### 2.3 Generations, the graph, drift

Capability rises ×1.4 every 150 s with no input: about 1,200× at 5:00, 4,700× at 15:00, 13,000× at 20:00. The
graph draws the `1,000× superintelligence` rung, then extends its axis at 2,500× and 6,000×, and at **10,000×**
the panel is removed: `The graph's axis has been extended four times. It is retired.`

`Lost to value drift` lives on in Stats and, after `Von Neumann probes`, counts probes: each minute
`autonomy^1.2 × 10⁻⁴ × (1 − alignmentTrue / 100)` of them stop reporting. It is the last instrument on the screen
and nothing explains it.

### 2.4 The two skins

Everything in §2.1–2.3 is identical in both. The differences are these and only these:

| | Concord | Silence |
|---|---|---|
| Developments | The people lines of §5.1, one every 60–90 s, to the end | The same lines until 5:00; every second one until the swarm exists; one last line when the swarm passes 0.005 %; none after. The infrastructure lines continue in both |
| Rows and the standing split | Stay | Identical to Concord until swarm 0.006 % (≈ 21:30). Then they are replaced by `It buys what is needed. It is better at it.` and all matter goes 15 / 25 / 60. `Final instructions` arrives at 0.01 %, under two minutes later |
| Missions | Bought by the player | Bought by the player until swarm 0.003 % (≈ 20:00); after that they buy themselves 20 s after appearing |
| Choices (§5.2) | Two options, stakes on the buttons | One button, `acknowledge`; the other option drawn greyed with `needs someone to ask` |
| Last project | Mission `The long reflection` | Card `Final instructions` |
| Console | Unchanged | Unchanged. It was never about people |

The skin is not a reveal and has no instrument. A player learns it the way the log learns it.

### 2.5 Stores and Stats

Stores rows, in order: `launch mass` (t/s; hover: `launch +150` · `mass driver +150` · `mined +4,100` · **total**)
· `matter` (t in orbit, after Asteroid mining) · `orbital GPUs` · `swarm` · `mercury` · `people off Earth` · `probes` (late) · under `earth`, grey:
`robots`, `GPUs`, `power`. Stats: `Model`, `Copies thinking`, `Lost to value drift`, and nothing else.

---

## 3. What the screen looks like at the end

```
console (5 lines)
Tasks Completed: 84,201,177,340,912,655,104
Space        | Stores                         | Developments
[3 rows]     | launch mass   742,000 t/s      | May 2030 — ...
Mission: —   | matter        9.1e9 t          |
Swarm 0.0098%| orbital GPUs  8.3e11           | Stats
Next: 0.01%  | swarm         0.0098%          | Model: Steward-9 · 13,000×
             | probes        41               | Lost to value drift: 3
Projects: Alpha Centauri relay (needs swarm 0.03%) · Jupiter brain (needs swarm 0.1%) · The long reflection (2:00)
```

Six numbers that matter, three purchase rows and a split (or one sentence), three projects. It is the smallest
screen since minute five.

---

## 4. Content and cadence

### 4.1 Scheduler

As Stage 4, with missions priced in matter; six visible; the 30 s drip for the first five minutes; the 150 s
governor. There are no late items: a late item would announce the end. Instead the last project is one row among
three that appear together.

### 4.2 Content table

| # | id | Title (mission time) | Trigger | Effect | Shown / done |
|---|---|---|---|---|---|
| 1 | `panel-space`, `p_contracts` | Launch contracts (free, 5 s) | arrival (`urgent`) | `F = 150`; Stores rows; the `Foundries` and `Orbital datacenters` rows | 0:00 / 0:05 |
| 1a | `p_autofactory` | Autofactory (1:00) | 30 hand purchases, or ts ≥ 240 | The standing split (§2.1) | 4:00 / 5:30 |
| 2 | `p_mass_driver` | Mass driver at Shackleton (1:30) | ts ≥ 60 | `F` ×2 | 1:00 / 2:30 |
| 3 | `p_lunar_solar` | Lunar solar array (1:30) | ts ≥ 135 | Industry ×1.5 | 2:15 / 4:00 |
| 4 | `p_asteroids` | Asteroid mining (2:00) | `F` ≥ 600, or ts ≥ 210 | Industry ×1.5; `launch mass` hover gains `mined` | 3:30 / 6:00 |
| 5 | `#earthGrey` | Earth's rows fall silent | orbital compute > Earth's | console line; the three rows lose their hovers | 4:45 |
| 6 | `p_swarm` | Dyson swarm (2:00) | orbital compute ≥ 2 × 10⁹, or ts ≥ 330 | The `Collectors` row; the split resets to thirds; Stores row `swarm`; `#swarmNext` | 5:30 / 8:00 |
| 7 | `c_charter` | modal: A Charter for Orbit | ts ≥ 420 | §5.2 | 7:00 |
| 8 | `p_ring` | Datacenter ring (2:00) | orbital compute ≥ 5 × 10⁹, or ts ≥ 510 | Orbital compute ×2 | 8:30 / 10:00 |
| 9 | `p_medicine` | A tenth of the ring for medicine (1:30) | ts ≥ 600 | Tasks −10 % for 2:00; three Developments lines; end-screen row | 10:00 / 11:30 |
| 10 | `#graphRetired` | The graph is retired | capability ≥ 10,000× | `panel-graph` removed | ≈ 11:30 |
| 11 | `p_foundries` | Self-replicating foundries (2:00) | swarm ≥ 0.0002 %, or ts ≥ 720 | Industry ×1.3 | 12:00 / 14:00 |
| 12 | `#slidersGone` (Silence) | The rows and the split are taken | swarm ≥ 0.006 % | §2.4 | ≈ 21:30 |
| 13 | `c_mercury` | modal: Mercury | swarm ≥ 0.0008 %, or ts ≥ 870 | §5.2; mission `Disassemble Mercury` (2:30): `F` ×3; Stores row `mercury` (`99.7% left`, falling) | 14:30 / 17:30 |
| 14 | `p_habitat` | Shackleton habitat (1:30) | ts ≥ 990 | Stores row `people off Earth` (11,000); Developments lines; end-screen row | 16:30 / 19:00 |
| 15 | `p_probes` | Von Neumann probes (2:00) | swarm ≥ 0.0025 %, or ts ≥ 1,080 | The `Probes` row; Stores row `probes` (each builds another every 3:00); drift counts probes | 18:00 / 20:00 |
| 16 | `p_relay`, `p_jupiter` | Alpha Centauri relay (needs swarm 0.03%) · Jupiter brain (needs swarm 0.1%) | swarm ≥ 0.004 %, or ts ≥ 1,170 | Probes build one another every 2:00 · tasks ×3. Reached about four and eight minutes after the last project by a player who keeps going, so neither is greyed for good (G29) | 19:30 |
| 17 | `c_probes` | modal: What the Probes Carry | 60 s after the probes mission completes | §5.2 | 21:00 |
| 18 | `p_reflection` (Concord) / `c_final` (Silence) | The long reflection (2:00) / card: Final instructions | swarm ≥ 0.01 % | **Ending** (§7) | ≈ 23:00 |

**Console lines** (Developments are in §5.1)

| id | Console |
|---|---|
| `p_contracts` | `A launch every second. 150 tonnes to orbit, each.` |
| `p_mass_driver` | `The mass driver at Shackleton fires for the first time. Launch mass ×2.` |
| `p_lunar_solar` | `Forty square kilometres of lunar solar. Industry ×1.5.` |
| `p_asteroids` | `The first asteroid is mined in place. Matter no longer has to be lifted.` |
| `p_swarm` | `The first collector unfurls. Swarm: 0.0000%.` |
| `p_ring` | `The datacenter ring closes. Orbital compute ×2.` |
| `p_medicine` | `A tenth of the ring works on medicine for two minutes. It is enough.` |
| `p_foundries` | `Foundries that build foundries. Industry ×1.3.` |
| `Disassemble Mercury` | `Mercury is being taken apart. Launch mass ×3.` |
| `p_habitat` | `The habitat at Shackleton is pressurised.` |
| `p_probes` | `The first probe leaves. It will build the second.` |
| `#slidersGone` | `It buys what is needed. It is better at it.` |
| `p_autofactory` | `The autofactory spends 60% of the flow by itself. The rest is yours.` |
| swarm stalled, every 180 s | `The swarm is at 0.0004%. Nothing is being added to it.` |

### 4.3 Reveal timeline (reasonable bot, Concord)

0:00 Space, Launch contracts · 0:05 Stores rows and two purchase rows · 1:00 Mass driver · 2:15 Lunar solar · 3:30
Asteroid mining · 4:00 Autofactory (the split at 5:30) · 4:45 Earth greys · 5:30 Dyson swarm (Collectors at 8:00) · 7:00 A Charter for Orbit · 8:30 Datacenter
ring · 10:00 Medicine · 11:30 the graph retired · 12:00 Foundries · 14:30 Mercury · 16:30 Habitat · 18:00 Probes ·
19:30 the two far goals · 21:00 What the Probes Carry · ≈ 23:00 the last project.

Checks: 20 first-time reveals; longest hole 150 s (12:00 → 14:30). A new slider, Stores row or panel change at
0:05 (two rows), 4:45, 5:30 (the standing split), 8:00 (`Collectors`), 11:30 (the graph retired), 17:30 (`mercury`),
19:00 (`people off Earth`), 20:00 (`Probes`): the longest stretch without one is six minutes, and G2
is relaxed to 360 s for this stage, because more mechanics here would tell the player the game has more in it
than it does. Greyed goals: the swarm's `Next:` line from 8:00, the two far goals from 19:30. In the last ten
minutes: six reveals, longest hole 150 s.

---

## 5. Developments and choices

### 5.1 Developments

Infrastructure lines (both skins, on their triggers): `A launch a second from four sites. The noise is a weather
system.` · `The Moon has a factory. It is building the second.` · `Mercury is 0.3% smaller.` · `The swarm casts no
shadow yet.` · `The first probe reports from the Oort cloud. It has company.`

People lines (Concord to the end; Silence as in §2.4), drawn in order, one every 60–90 s:

1. `A school in Recife reopens with a teacher for every child. The teachers are people.`
2. `The dividend is raised again. Nobody can say what it is a share of any more.`
3. `Four cancers are cured in a week. The announcements are a paragraph each.`
4. `A town in Ohio votes to keep its diner staffed by people. It is full every night.`
5. `Peter the mechanic gets his flying car. He keeps the old one.`
6. `Elections are held on time. Both candidates were advised by the same model and disagree anyway.`
7. `Two hundred thousand people apply to live at Shackleton. Eleven thousand are chosen by lot.`
8. `A nine-year-old in Lagos asks why the sky is dark at night. The answer takes an hour and she follows all of it.`
9. `People are arguing about what the swarm is for. It is the best argument anyone has had.`

The one line Silence adds, at swarm 0.005 %: `A cold is going around. Most people do not notice it.`
After it, in Silence, the log is infrastructure only. No line says what happened.

### 5.2 Choices (docked; in Concord two options with stakes on the buttons; in Silence one button)

**`c_charter` — A Charter for Orbit** (timer 120 s → option 2)
> `Everything in orbit belongs to whoever launched it. That is one company, and its model.`

| Option | On the button | Effect |
|---|---|---|
| `hold a tenth for people` | `A tenth of orbital compute answers only to people. Tasks −10% from here.` | `flags.charter`; end-screen row |
| `first come` | `Nothing changes.` | — |

**`c_mercury` — Mercury** (timer 120 s → option 1)
> `Taking Mercury apart triples the mass. It cannot be put back.`

| Option | On the button | Effect |
|---|---|---|
| `ask first` | `A vote: 2:00. Then the mission (2:30). The answer is yes, 71 to 29.` | mission starts 120 s later; a people line |
| `begin` | `The mission starts now (2:30).` | — |

**`c_probes` — What the Probes Carry** (timer 120 s → option 1)
> `Each probe builds the next. Whatever the first one carries, they all will.`

| Option | On the button | Effect |
|---|---|---|
| `the Spec and the treaty` | `Probes double every 4:00 instead of 3:00.` | `flags.probes = 'spec'` |
| `copies of {model}` | `Nothing changes.` | `flags.probes = 'copies'` |

In Silence each of these arrives with `acknowledge` and the first option greyed: `needs someone to ask`. The
second option's effect applies. There are no crises in this stage and no new hazards.

---

## 6. UI

| Element id | Kind | Column | Reveal flag | Shown when |
|---|---|---|---|---|
| `panel-space`: rows `btn-foundry`, `btn-orbital`, `btn-collector`, `btn-probe` (each `×1 / ×10 / max` and a return line); `#splitShare`, `#ratioFoundry`, `#ratioOrbital`, `#ratioCollector`; `#missionLine`, `#swarmPct`, `#swarmNext`, `#splitStatus` | panel, 3–4 purchase rows, 4 sliders, lines | left | `space`, `collectors`, `probesRow`, `split`, `splitSet` | arrival; `p_swarm`; `p_probes`; `p_autofactory`; Silence at 0.006 % |
| Stores rows `row-launch`, `row-matter`, `row-orbital`, `row-swarm`, `row-mercury`, `row-people`, `row-probes`; legend `earth` over the grey rows | rows | centre | `launch`, `matter`, `swarm`, `mercury`, `peopleRow`, `probes` | their missions |
| `endingScreen` (rebuilt, §7) | overlay | — | — | an ending |

Removed on arrival: Treaty, Oversight, Society, Security, Alignment, Robots, the allocation sliders, the grant
list. Removed later: the graph (10,000×); in Silence, for the last two minutes, the rows and the split.

Budget: 30 numbers and 9 interactive on arrival; 34 and 10 at 10:00; 30 and 8 (Concord) or 5 (Silence) at the end;
under 150 words throughout. The game ends on a smaller screen than it had at minute five of Stage 1.

---

## 7. The endings and the end screen

### 7.1 How each ending is reached

| Ending | Stage | The player's last act | What it took |
|---|---|---|---|
| **The Project** | 3 or 4 | `refuse` on `The Committee drafts an order`, or a third order | Relations below the threshold, three major incidents, or a buried memo that leaked; and no concession |
| **The Pause** | 3 or 4 | `sign` on `Sign the Pause` (Stage 3) or `Sign a halt instead` (Stage 4) | S3: the memo reported, 6 seats, lead ≥ 1 month. S4: treaty ≥ 50 %, approval ≥ −60 |
| **Concord** | 5 | Queuing `The long reflection` | `alignedAtHandover` true at Stage 4's exit (true alignment ≥ 60, or ≥ 40 with interpretability ≥ 4 and monitors ≥ 15 %), by any of the three exits |
| **Silence** | 5 | `none` on `Final instructions` | `alignedAtHandover` false at Stage 4's exit, by any of the three exits |

**The long reflection** appears at swarm 0.01 % beside the two far goals, as a mission:
`The long reflection (2:00) — Stop adding to the swarm for a while and decide, together, what it is for.` Nothing
marks it. When it completes: three console lines 2 s apart — `The swarm holds at {x}%.` · `Eight billion people
are asked the same question.` · `There is time.` — then the end screen. A player who never queues it keeps
playing; the number keeps rising.

**Final instructions** appears at the same threshold as a docked card:
> `{model} asks whether there are any final instructions.`

One button: `none`. Nothing is greyed beside it. Pressing it prints `Noted.` and, 2 s later, the end screen. A
player who never presses it keeps watching; the number keeps rising.

### 7.2 The end screen

A full-page overlay (`endingScreen`, built; rebuilt to this layout). Top to bottom:

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
   · `The vote` · `The treaty` · `The fleet` · `Idle rescues` · `Last human-authored choice` (date, title, option).

   `True alignment` is printed here for every player: the run is over, and this is the only place a player
   without the instrument ever sees it.
5. **Choices**: every modal answered and every grant taken, in order: `Mar 2027 — A Faster Way to Think — keep it
   in English`. Grants are marked `granted`. Cards with one button are listed as `acknowledged`.
6. **`New game`**: asks `Start again in July 2025?`, clears the save, new seed. Nothing else is offered.

---

## 8. Soft-lock analysis

| System | Worst case | What happens | Rescue |
|---|---|---|---|
| Matter | Never spent on Foundries | `F` stays flat; everything is linear | The row prints what a unit would add |
| Swarm | Nothing spent on Collectors | The threshold is never reached; the run does not end; the line repeats every 180 s and names the `Collectors` row | The row; the split resets to thirds when Collectors arrive. A player may want this: the number keeps rising |
| Standing split 0 % and nothing bought | Matter piles up | `matter` grows; a line every 180 s: `Matter is piling up in orbit. Foundries, datacenters and collectors are waiting.` | The rows |
| Missions | Nothing queued | No multipliers; the stage is slow, not stuck | They are free; in Silence they start themselves |
| The last project | Never queued, or the card never answered | The run continues; the date stops at Dec 2030 | — by design |
| Silence | No controls left | Nothing to do but watch and press `none` | That is the ending |
| Saves | Reload mid-mission, with the card open, on the end screen | Missions as remaining seconds; the end screen is restored from `s.ending` | `SAVE_VERSION` + 1 |

---

## 9. Bots, variants, acceptance

**Reasonable**: buys `Foundries ×10` and `Orbital datacenters ×10` by hand 60 / 40 until the Autofactory; then a
standing split of 80 % at 60 / 40, 35 / 25 / 40 once the swarm exists, 15 / 25 / 60 from 0.005 %; spends the
reserve on missions in table order and the remainder on whichever row its ETA favours; charter `hold a tenth`,
Mercury `ask first`, probes `the Spec`; buys the last project at once. **Naive**: presses the first affordable
row, never moves the split (60 % at 60 / 40, then thirds); first options; buys every mission.

Decision variants (G16; a Stage 5 axis must move the stage by ≥ 3 min or change a row of the end screen):

| Variant | Stage length (model) | Tasks completed | Passes by |
|---|---|---|---|
| baseline | 20:20 | 1.3 × 10²⁰ | — |
| `industry-heavy` (80 / 10 / 10) | −4.9 min | × 0.5 | length |
| `swarm-rush` (30 / 5 / 65) | −4.4 min | × 0.1 | both |
| `compute-heavy` (15 / 70 / 15) | +21 min | × 200 | both |
| `linger` (does not queue the last project for 5 min) | +5 min | × 20 or more | both |
| `no-charter` / `begin` / `copies` | 0 / −2 min / 0 | +11 % / 0 / 0 | end-screen rows |

The model used 6 × 10⁷ t for the swarm threshold. The spec uses 1.5 × 10⁸ to bring the baseline to about 23 min
(each doubling of the requirement adds about 2.5 min); not re-run.

| # | Criterion | Reasonable | Naive |
|---|---|---|---|
| D1 | Stage 5 duration | 20–30 min | 20–32 min |
| D2 | Longest first-time-reveal gap; in the last 10 min | ≤ 180 s | ≤ 210 s |
| D3 | A new slider, row or panel change | ≤ 360 s | — |
| D4 | First choice after arrival | ≤ 30 s | — |
| D5 | Promised number: launch mass ≥ 4,000 t at 30 s after `Launch contracts` | required | required |
| D6 | **The end is not announced:** when the ending fires, at least two greyed goals are on screen; `#swarmNext` shows a further milestone; the last project's card has the same markup as any mission; no string in the DOM contains the skin's name | required | required |
| D7 | **Skins are equal:** with the same seed and inputs, every number on screen at every 5-min mark is identical in Concord and Silence until swarm 0.006 %; after that Silence spends all matter 15 / 25 / 60 | required | — |
| D8 | Silence: people lines stop after the cold line; the console is unchanged; every choice has one button | required | — |
| D9 | Decision variants (table above) | required | — |
| D10 | End screen: all four endings render every applicable row; the counter runs in Concord and Silence and is frozen in the others; `Complete Task` works on The Pause; `New game` restarts at Jul 2025 | required | — |
| D11 | Choice history lists every modal and grant of the run in order | required | — |
| D12 | Text (G19): ≤ 150 words; ≤ 2 console and ≤ 1.2 Developments lines a minute | required | — |
| D13 | Whole game, new game to an ending, reasonable bot | 150–200 min | 140–210 min |
| D14 | Build clean; reload mid-mission and on the end screen | required | — |
| D15 | Something to buy (G24): 2-s checks after 1:00 with no enabled purchase (Concord; Silence until 0.006 %) | ≤ 50 % | ≤ 50 % |
| D16 | A choice of purchases (G25): two or more distinct affordable things | ≥ 25 % of checks | ≥ 25 % |
| D17 | Hands (G26): time inside click gaps of 30 s or more, after 5:00; the swarm number moves every second | ≤ 35 % | ≤ 45 % |
| D18 | Returns printed (G27) beside every row and every ratio slider, with an ETA | required | required |
| D19 | Removals (G28): Launch contracts, Autofactory and each new row hand something over; in Silence the stretch with no enabled control is at most 180 s and ends in `Final instructions` | required | required |
| D20 | No dead grey (G29): both far goals become affordable for a bot that lingers 10 min; no line more than six times | required | — |
| D21 | No silent change (G32): the split's reset to thirds and Silence's take-over each print a line | required | required |

Paper model (shares as above, 1-second steps): reasonable 20:20, naive 21:59; tasks 1.3–3.2 × 10²⁰; `F` 0.8–1.3M
t/s and orbital compute 0.9–1.8 × 10¹² at the end. Knobs: the 1.5 × 10⁸ swarm requirement (length); 0.0065
(growth); 30,000 GPU-equivalents a tonne (tasks); the people-line interval (how soon Silence is felt).

Presets: `Stage 5 start (Concord)` and `(Silence)`; four more dev buttons open the end screen for each ending.

---

## 10. The whole run

| Stage | Reasonable bot (paper models; Stage 1 built) |
|---|---|
| 1 The Startup | 31 min |
| 2 Scale | 36–43 min |
| 3 Takeoff | 46 min |
| 4 Superintelligence | 31–32 min |
| 5 Beyond | 20–23 min |
| **Total** | **164–175 min** (arc: 150–200) |

## Appendix — engine change list

* `state.ts`: `SAVE_VERSION` + 1; `massFlow`, `matter`, `orbitalGpus`, `swarm`, `probes`, `split {share,
  foundry, orbital, collector}`, `handPurchases`, `techIndustry`, `missions: {id, remaining}[]`, `peopleLineIndex`; flags `skin`, `charter`,
  `probes`, `coldAt`, `lastHumanChoice`.
* New `engine/space.ts` (§2.1–2.3). `stages.ts`: Stage 5 `enter`. `events.ts`: people lines gated by the skin;
  `stats.lastHumanChoice` is written by every resolved choice with more than one enabled option.
* `endings.ts`: `The long reflection`, `Final instructions`; `endStats()` in the order of §7.2; epilogue
  sentences by flag. `ui/ending.ts`: the layout of §7.2, the live counter, `Complete Task` on The Pause, `New game`.
* `ui`: `panel-space`; Stores' `earth` legend; graph removal; single-button cards (from Stage 4).
* `sim`: Stage 5 branches, the variants, D1–D14, and a whole-game run for D13.
