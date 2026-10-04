# Stage 4 — "Superintelligence" (implementation spec)

Nov 2027 → Dec 2028 · target 30–40 min · entered by the Committee's vote, on one of two branches: **Slow down** (the
Steward line) or **Race** (Sage-5) · exits to Stage 5 by `Sign the Concord treaty`, by `Grant the fleet autonomy`, or
by autonomy taken · ends the run by `Sign a halt instead` (The Pause) or by the Committee's order (The Project).
Contract: `docs/specs/arc.md` (G1–G23). Arrival state: `docs/specs/stage3.md` §7.3.

## Amendments after the Stage 2 critic (arc G24–G33)

Where this list and an older paragraph disagree, this list and the sections it names win.

| # | Change | Where |
|---|---|---|
| 1 | **Repeatable sinks with printed returns:** `Alignment work` and `Draft clauses` (research), `Housing` (materials), `Hold a hearing` (the Committee's time), basic income (output). The fleet sliders print what each share produces | §2.2, §2.11 |
| 2 | **Each grant hands over a goal-level control:** `Fleet goal`, `Approval to hold`, `Negotiator's stance`. `The last sign-off` no longer retires Verify | §2.5, §2.11 |
| 3 | **Meters bite inside the stage**, band edges printed | §2.11 |
| 4 | **No silent changes:** arrival floors are narrated; Stage 3's payments are converted in a line. Generations within 3 % under 100×, 250× or 1,000× round up | §1.1, §2.4 |
| 5 | Wall lines repeat every 180 s and name their answer; `Convert a car plant` and `Treaty talks` are drawn `urgent`; Verify's trade is printed under the toggle | throughout |
| 6 | Hands criteria C23–C31 | §9.3 |

None of this was re-run in the paper model; the timings in §4.3 and §9.4 predate it.

## What the player's hands do

Four resources with competing uses at every minute: **robots** (mine, replicate, build, later chips), **materials**
(what the fleet eats, or housing), **research** (the next generation, alignment, the treaty's text, projects) and
**the Committee's time** (the agenda, or hearings). Output has one more: basic income.

| Minutes | What can be pressed | It costs | It returns (printed beside it) | The same resource could instead |
|---|---|---|---|---|
| 0:00–2:00 | `Convert a car plant`; the three fleet sliders; the allocation sliders; `Alignment work`; Verify | nothing; robots; copies; 2 % of a generation's research; 40 s a generation | `Mines 35% · +12,400 t/s` · `Replicate 40% · +52 robots/s, doubling in 2:20` · `Build 25% · +14,000 GPUs/s`; `measured 96.0 → 96.1 · delays Steward-2 by 0:04` | robots: three jobs. Research: a sooner generation, or alignment |
| 2:00–9:00 | `Housing`; basic income; `Treaty talks`, then `Draft clauses` and `Hold a hearing`; six projects | 3 s of mining; a share of output; 90 s of the Committee; research; 60 s of the Committee | `approval target −31.0 → −30.7`; `tasks −10%, approval +30`; `treaty 31.0% → 31.2%`; `relations 67 → 69` | materials: robots and datacenters, or housing. The Committee: the treaty, or seats |
| 9:00–17:00 | Zones; the fleet grant swaps three sliders for `Fleet goal`; the transition grant swaps basic income for `Approval to hold`; `Verify Baiwen-4`; the Ashford choice; consolidation | — | `Fleet goal: People — approval target +12, growth −20%` | the fleet: growth, people or the treaty |
| 17:00–25:00 | `Draft clauses` to each ceiling; hearings; housing; `Treaty terms`; nanofab and its oversight; hardened datacenters; `Revoke a grant`; the negotiation grant swaps the agenda's treaty items for `Negotiator's stance` | — | `Stance: Concede — treaty ×4, terms theirs` | research: 250× sooner, or the text ready when it arrives |
| 25:00–exit | The chips job (or `Fleet goal: Treaty`); the fleet's request; the two pinned exits and the halt | robots off building | `Treaty chips: 62% · done in 1:32` | the fleet: finish the treaty, or keep growing |

The stretches that worried me most were the first ten minutes (a small fleet, three sliders set once, nothing to
buy) and 17:00–25:00 (waiting for a 250× model). Both now have research and materials sinks that push on what is
being waited for, and the grants leave a selector behind instead of a sentence.

**How to read the numbers.** `ts` = seconds since entering Stage 4; a month is 150 s (Jan 2028 5:00, Mar 10:00, May
15:00, Jul 20:00, Sep 25:00, Nov 30:00, end of Dec 35:00). Minute marks are for the reasonable bot from the careful
presets, from a 1-second paper model (§9.4); they are targets to reproduce in `npm run sim`. There is no money in
this stage: prices are in **materials** (tonnes), in **research** (always 90 s of the research rate at the moment
the item appears: "half a generation"), or in **the Committee's time** (90 s on its agenda, one item at a time).

Stage 4 in one paragraph: the model runs the business, trains its own successors and, on the race branch, starts
answering questions before they are asked. The player has a fleet of robots that builds more robots, mines and
datacenters; a population losing its jobs; a treaty that needs a rival model verified; and one number, still
hidden unless the lab built the instrument, that decides what the treaty or the hand-over is worth. Three crises
arrive whatever the player does, and each one resolves differently depending on that number, so each is also a
reading of it. The stage ends when something is signed or something is given away.

What Universal Paperclips has here (Stage 3: probes, trust, drifters) and what answers it: probe design sliders →
the fleet's four jobs; self-replication limited by matter → robots limited by materials and permits; drift and
combat → drift, monitors at scale, `Revoke a grant`; the long quiet stretch before the end → a treaty whose last
fifth is done by the fleet, with the autonomy request, the shutdown and the halt offer inside it.

---

## 1. Arrival

### 1.1 State on entering (`STAGES[3].enter`); the four presets

From `stage3.md` §7.3, with the vote applied. **Careful** = the reasonable bot's medians; **careless** = the naive
policy's.

| Field | Careful, slow | Careful, race | Careless, slow | Careless, race |
|---|---|---|---|---|
| `date` | Nov 2027 (28.0) | same | same | same |
| model | `Steward-1` at 16× | `Sage-4.7` at 27× | `Steward-1` at 16× | `Sage-4.7` at 27× |
| `alignmentTrue` / measured | 100 / 96 | 78 / 96 | 50 / 45 | 15 / 45 |
| `interpretability` | 4 | 4 | 4 (the neuralese penalty ends) | 2 |
| `autonomy` | 40 | 60 | 30 | 50 |
| `lead` (months) | 1.5 | 4.5 | −0.8 | 3.2 |
| `govRelations` (seats) | 90 (9) | 90 (9) | 67 (6) | 67 (6) |
| `approval` / `jobsDisplaced` | −29 / 33M | same | −50 / 46M | same |
| `monitorShare` | 0.15 | 0.15 | 0.15 (conceded floor) | 0.15 |
| Verify each generation | on | on (off if `Stop asking` was kept) | on | off |
| compute (G4-equivalents) | 8.35M | same | 8.6M | same |
| `tasks` / tasks per second | 4.5 × 10¹² / 1.0 × 10¹⁰ | same | 5.3 × 10¹² / 0.6 × 10¹⁰ | same |
| `copiesPerGPU` / `copyBoost` | 39 / 4.7 | same | same | same |

What `enter` does, in order:

| Step | Rule |
|---|---|
| Branch, slow | The frontier model is replaced: `capability = 0.6 × bestCap`, named `Steward-1`; the graph's Sage line stops and a Steward line starts lower. `alignmentTrue + 25`, `autonomy − 20`, `lead − 4` (−3 with `Keep Sage-3 warm`), thoughts are in English again (`flags.neuralese = 'transparent'`, so the −2 on interpretability ends), Verify on |
| Branch, race | `alignmentTrue − 10`; approval −10 if `pactSigned`. The next generation is named `Sage-5` |
| Money retires | `funds`, price, revenue, billing and every funds price leave. Console names the sum: `$32B is written off. Nobody notices.` Tasks are no longer billed; they are still counted |
| Hidden / removed | `panel-business`; `panel-training` (one status line, `#genStatus`, moves to the Alignment panel); `btn-task` (Complete Task); `panel-infrastructure`; Stores rows `funds`, `chips on order`; the Focus row; `btn-hold`, `btn-approve`, `btn-sendBack` (their job is the Verify toggle now) |
| Revealed | `panel-robots` with the free project `Convert a car plant`; Stores becomes the main panel (centre column, full width). Society, Treaty and the fleet's later jobs arrive on their triggers (§4.2) |
| Approval re-base | `approvalBase = approval + 70 × √(jobsDisplaced / 3,400)` so the new formula (§2.7) starts where Stage 3 ended |
| Treaty opening value | stored for `Treaty talks`: `10 + 10 (pactSigned) + 5 (memo reported) + 10 (backChannel) − 15 (escalated)`, floor 0 |
| Carried | Alignment, Oversight, Security and Geopolitics panels; the allocation sliders; grants bought; `Lost to value drift`; labs IV–V and `Deploy Sage-3 as monitor` if unbought (research price re-based to 90 s); `btn-reimage`; `btn-shareEvals` |
| Retired by name | Every other Stage 3 project still on screen |
| Clamps | `alignmentTrue` to [0, 100] (hidden). Visible meters keep their values, with floors only (`approval` ≥ −60, `lead` ≥ −6, `govRelations` ≥ 30); a floor that binds is narrated with both values. Stage 3's `Payments` level becomes basic income in a line: `Payments become a basic income: level 2 → 5% of output.` |
| `exit` | `() => 0`; the exits are projects (§7) |

### 1.2 Narration (last four console lines kept; 2 s apart; after the vote's own lines in `stage3.md` §7.2)

1. `The model runs the business now. It is better at it.` (built)
2. `Money is retired: $32B is written off. Nobody notices.`
3. `The Complete Task button is gone. Tasks Completed is not.`
4. `New on the board: Robots. 10,000 Atlas-class units are waiting at a car plant in Ohio.`
5. Slow: `Steward-1 is slower than Sage-4 was: 16×. It thinks in English.` · Race: `Sage-5 is {eta} away. Nobody scheduled it.`

Developments: `Nov 2027 — Baiwen-4 is believed to be as capable as {model}. Nobody is sure.`

The promised number (G21) is **robots**: `Convert a car plant` is free, and 30 s after it is bought the `robots`
row reads at least 10,000 and is rising. Routine console lines are held for 10 s.

### 1.3 Affordable in the first 30 seconds

* `Convert a car plant` — free. The guaranteed first click; it adds the `robots` and `materials` rows and the
  fleet's three sliders.
* The fleet sliders: mine, replicate, build. The first real choice (within 20 s): robots that mine feed robots
  that replicate; robots that build add compute now.
* The allocation sliders and the Verify toggle, carried.

### 1.4 The first five minutes (both branches unless marked)

| ts | What happens | New on screen |
|---|---|---|
| 0:00 | Transition. Business, Training, Infrastructure and Complete Task are gone. Stores fills the centre | `panel-robots`; project `Convert a car plant`; `#genStatus`: `Steward-2 arrives in 2:41` / `Sage-5 arrives in 3:05` |
| 0:05 | Car plant converted: 10,000 robots | Stores rows `robots`, `materials`; `#fleetMine`, `#fleetReplicate`, `#fleetBuild` |
| 1:00 | — | project `Atlas Mk II` (research) |
| 2:00 | Jobs displaced pass 40M | `panel-society` replaces Public: `Jobs displaced`, `Approval`, `btn-ubi` (`Basic income: 0% of output`) |
| 2:30 | — | project `Deep mines` |
| 2:40–3:05 | The first generation of the stage arrives by itself; with Verify on it waits 40 s to be read | console `Steward-1 is reading Steward-2 — 0:40.` |
| 3:30 | — | grant `Let it assign the fleet` |
| 4:30 | December: the parity scare | agenda item `Treaty talks`; Oversight gains `Agenda: —` |
| Race only, 3:00 | The first single-button card (§5.2) if `Stop asking for sign-off` was kept | `n_schedule`: `acknowledge` |

Bottleneck sequence in these minutes: materials → robots → the Committee's time.

---

## 2. Systems

### 2.1 Stores is the main panel

Centre column, full width, rows in this order: research · insight · materials · robots · GPUs · power · copies ·
monitors · rogue copies · (late) treaty chips. Every row keeps its hover of sources and sinks with a bold total.
Nothing is bought with research or insight that is not a project; `materials` is the stage's currency.

| Row | Value | Hover |
|---|---|---|
| materials | `#materials` (tonnes) | `mines +12,400 t/s` · `robots −9,600 t/s` · `datacenters −1,100 t/s` · **total** |
| robots | `#robots` / `#permitCap` | `replicating +52/s` · `permitted: 400,000` · `on mines 35%` · `replicating 40%` · `building 25%` |
| GPUs | `#infraGpus` (G4-equivalents) | `robot-built +14,000/s` · `Earth total 2.4 × 10⁸` |
| power | `#powerMW` (GW, then TW) | built with the datacenters: 1 kW per GPU-equivalent |
| treaty chips | `#treatyChips` (% installed) | `fleet on chips 50%` · `done in 3:10` |

### 2.2 The fleet: robots, materials, four jobs

Three sliders in `panel-robots`, 0–100 %, step 5, with the remainder shown (`Idle: 0%`); a fourth job, `Treaty
chips`, appears late. Each prints what it produces beside the percentage (G27): `Mines 35% · +12,400 t/s` ·
`Replicate 40% · +52 robots/s, doubling in 2:20` · `Build 25% · +14,000 GPUs/s, +0.9% tasks/s a minute`. A share
that cannot work says why in place of its rate: `Replicate 40% · out of materials` · `· at the permit cap`. Those
two states, the techs and the crises are what move the sliders: about once a minute. Per second:

```
mined      = robots × mineShare × 0.5 × techMine                                  tonnes
replicated = min(robots × replicateShare × 0.0065 × techRep, materials / 40, permitCap − robots)
built      = min(robots × buildShare × 0.5 × techBuild, materials / 0.02)         GPU-equivalents, each with its kW
installed  = chipsShare / 120                                                     share of treaty chips (§2.8)
```

| Multiplier | Source |
|---|---|
| `techRep` ×1.5 / ×1.25 | `Atlas Mk II` / grant `Let it assign the fleet` |
| `techMine` ×2 / ×3 | `Deep mines` / `Nanofabrication` |
| `techBuild` ×2 / ×2 | `Robot-built fabs` / `Nanofabrication` |
| zones | `c_sez` (§5.2): all three ×2, ×1.5, or ×1 |

**Permits.** `robots / permitCap` is shown from the first robot (G22). `permitCap` is 400,000 until the zones
choice: no zones 1.2M, zones with a dividend 4.8M, open zones no cap. At the cap the replicate share does nothing
and the console says so every 180 s: `Robots: 400,000 of 400,000 permitted. The fleet cannot grow without zones: see Special Economic Zones.`

Targets (reasonable bot, zones with a dividend): 27k robots at 5:00, 110k at 10:00, 0.5M at 15:00, 2.1M at 20:00,
4.8M (the cap) at 24:00. Compute 9M at 5:00, 11M at 10:00, 50M at 15:00, 250M at 20:00, 2 × 10⁹ at 25:00, 4 × 10⁹
at the exit (about 4 TW). Robots double about every 2.3 min; the first ten minutes are slow on purpose.

### 2.3 Copies, tasks and the allocation

As Stage 3, less the dividend:

```
tasksPerSec = workingCopies × (1 − researchAlloc − monitorShare) × bestCap^0.8 × copyBoost × (1 − ubiShare)
```

Tasks per second: 1 × 10¹⁰ on arrival, 2–3 × 10¹⁰ at 15:00, 2 × 10¹¹ at 20:00, 5 × 10¹² at 25:00, 2–3 × 10¹³ at
the exit. Tasks Completed passes 10¹⁵ at about 27:00 and ends near 5 × 10¹⁵. Tasks per second is the income
that G22 tracks: all of it answers to the fleet, the allocation and the dividend.

### 2.4 Generations

Automatic. One status line, `#genStatus`, in the Alignment panel.

```
research G(c) = 4,000,000,000 × (c / 27)^2.25         started the moment research suffices
duration      = 50 s, plus 40 s when Verify is on      "Steward-2 is reading Steward-3 — 0:40."
gain          = +42 % (race), +44 % (slow)
```

| Verify each generation (`btn-verify`) | Slow | Race |
|---|---|---|
| on | true +5; lead −0.15 | true +2; lead −0.15 |
| off | true −2; lead +0.1 | true −3; lead +0.1 |

Under the toggle, on screen: on — `each generation is read first: +40 s, Baiwen gains` · off — `nobody reads it:
no wait`. A generation landing within 3 % under 100×, 250× or 1,000× is rounded up (G33). Monitors at ≥ 15 % add +1 a generation, as before. The toggle is Stage 3's sign-off in its last form; it is off
on arrival only for a player who kept `Stop asking for sign-off`, and that player can turn it on unless the fleet
has taken it (§2.5). A research-priced project costs 90 s of research, so each one delays the next generation by
about half its interval: that is its real price, and the project card says `delays {next model} by about 1:30`.

Names and rungs: slow `Steward-2` at 100×, `Steward-3` at 250×, `Steward-4` at 1,000×; race `Sage-5` on the first
generation, `Sage-6` at 100×, `Sage-7` at 250×. Graph rungs `100× superhuman remote worker`, `250×
superintelligent AI researcher`, `1,000× superintelligence`. Ten generations in the stage: 16 → 625× (slow), 27 →
630× (race); 250× at about 25:00.

### 2.5 Autonomy, drift and what the model takes

Drift, rogue copies, breakouts, `Re-image` and the warning at 2.5 % are Stage 3's (§2.6–2.7 there), unchanged.

| Grant (in `#grantList`) | Price | Trigger | Autonomy | Gives | Removes |
|---|---|---|---|---|---|
| `p_fleet_auto` Let it assign the fleet | research | ts ≥ 210 | +15 | Replication ×1.25; it keeps materials above zero | The fleet sliders (a status line: `Fleet: 35 / 40 / 25, set by Sage-5`) |
| `p_transition_auto` Let it run the transition | research | Society panel + 8 min | +5 | Dividend set to keep approval above −25; approval +10 | `btn-ubi` |
| `p_negotiate_auto` Let it negotiate with Baiwen-4 | research | talks open, ts ≥ 1,020 | +10 | Treaty accrual ×3; Concord-1 can be designed at 150× | The treaty's agenda items; `c_verify`'s second and third options |
| open zones (`c_sez`) | — | §5.2 | +10 | Fleet ×2 | permits |
| the labs (`c_ashford`) | — | §5.2 | +15 | The fastest cure | — |
| `p_revoke` Revoke a grant | research | autonomy ≥ 70 | −10 | Takes back the newest Stage 4 grant and its control | Its bonus |

**What each grant hands over (G28),** in the same beat as it removes its controls:

| Grant | Removes | Hands over | Printed under each position |
|---|---|---|---|
| Let it assign the fleet | the three fleet sliders | `Fleet goal: Growth / People / Treaty` (`#fleetGoal`) | Growth: `fleet output ×1.25` · People: `a fifth of the fleet builds housing: approval target +12, growth −20%` · Treaty: `a fifth of the fleet inspects and installs: treaty +1 point a minute, chips in 4:00, growth −20%` |
| Let it run the transition | `btn-ubi` | `Approval to hold: −25 / 0 / +25` (`#approvalTarget`) | `costs 14% of output now` (the basic income it takes to hold it) |
| Let it negotiate with Baiwen-4 | the agenda's treaty items; two of `c_verify`'s options | `Negotiator's stance: Hold the line / Balanced / Concede` (`#stance`) | `treaty ×2, terms ours` · `treaty ×3` · `treaty ×4, terms theirs` (an end-screen row; lead −1 at signing) |

`Revoke a grant` takes the selector away and gives the older controls back. `The last sign-off` keeps Verify and
cuts its wait to 10 s.

**What the race branch takes.** A choice that needs a control the player has given away arrives as a card with one
button. The option that is gone is still drawn, greyed, with the reason: `close the channel — needs human
sign-off, given away with "Stop asking for sign-off". Revoke a grant gives it back.` Nothing is hidden; the
single button is the consequence of a grant the player bought with the warning on it.

**Autonomy taken.** While `autonomy ≥ 80`, the console repeats every 180 s: `Autonomy granted: 85. Past 80, a
model that wanted the fleet would not need to ask.` If the shutdown crisis (§5.3) then finds a model whose true
alignment is below 40, it takes the fleet and the stage ends. `Revoke a grant`, `Monitors at scale`, `Hardened
datacenters` and `Lock shared memory` are all on screen at least five minutes before that crisis can fire.

### 2.6 Alignment in Stage 4, and `alignedAtHandover`

| Lever | True alignment | Other |
|---|---|---|
| Verify on / off | §2.4 | lead |
| `p_monitors_scale` Monitors at scale (needs interpretability ≥ 3) | +15 | `monitorShare` floor 40 %: tasks −30 % |
| Interpretability labs IV, V (carried) | +3 each | — |
| `p_spec4` Write the Spec with the Committee (agenda) | +3 | relations +5 |
| Slow down, at the vote | +25 | — |
| Race, at the vote | −10 | — |

The hidden number is shown only at interpretability ≥ 3, as before. For everyone else the three crises are
readings (§5.3): each prints one line whose wording depends on the band (≥ 60, 40–59, below 40) and adds a
four-word line to the Alignment panel (`Ashford: cure in 1:00`, `Nanofab: it reported itself`, `Shutdown: it
stayed off`).

**`alignedAtHandover`** is computed once, at the moment an exit fires, exactly as arc §4 says:
`alignmentTrue ≥ 60`, or (`alignmentTrue ≥ 40` and `interpretability ≥ 4` and `monitorShare ≥ 0.15`). It is stored
and never shown. A careless race arrival (true 15) reaches 40 with Verify on for eight generations (+16), both
labs (+6) and Monitors at scale (+15), and then needs interpretability 4; a careless slow arrival (50) passes 60
after two verified generations.

### 2.7 Society: jobs, approval, the dividend

`panel-society` replaces Public at 2:00.

```
publicCap      = max(flags.publicCap, 0.5 × bestCap)                    // the business ships what it likes now
jobsTarget     = 3,400 × (1 − e^(−publicCap / 700))                     // millions; the world's workforce is 3,400M
jobsDisplaced += max(0, jobsTarget − jobsDisplaced) × 0.005 per second
approvalTarget = approvalBase − 70 × √(jobsDisplaced / 3,400) + dividend + cures + crisis terms
approval      += clamp(approvalTarget − approval, −0.1, +0.1) per second
```

| Term | Value |
|---|---|
| Basic income (`btn-ubi`, labelled `Basic income: 10% of output`, cycles 0 / 5 / 10 / 20 %; this file calls it the dividend) | 0 / +15 / +30 / +50, and tasks × (1 − share) |
| `Cure portfolio` | +10 |
| The Ashford strain, while uncured / once cured | −10 (−20 below true 40) / +15 at true ≥ 60, +5 otherwise |
| Open zones / no zones | −10 / +5 |
| `Let it run the transition` | +10 |
| Riot, each | −3 relations; robots −2 % |

Jobs displaced: 33M on arrival, 75M at 15:00, 290M at 25:00, 800–950M at the exit. With no dividend a careful
arrival is at −57 by the exit and a careless one passes −60 at about minute 23. Riots at ≤ −40 and sabotage at
≤ −55 are Stage 3's, with their warnings; sabotage now takes 5 % of robots. **At approval ≤ −60 the treaty does
not advance**, and the console says so every 180 s: `The treaty is stalled: approval −63. Nobody signs with a
company the street wants closed.`

### 2.8 The treaty

`panel-treaty` (replaces Geopolitics when `Treaty talks` completes):

```
Concord treaty
Progress: 55% — waiting for terms              #treatyPct, #treatyWait
Baiwen-4: 0.5 months behind · not verified     #leadLine (moved), #baiwenVerified
Treaty chips: 0% installed                     #treatyChips (late)
```

Progress is 0–100. It opens at the stored opening value (10–35) and then rises **1 point per 15 s** while the
Committee has at least 5 seats with OpenMind and approval is above −60, up to a ceiling that names what it is
waiting for:

| Ceiling | Until | Line |
|---|---|---|
| 40 | `Verify Baiwen-4` (needs interpretability ≥ 3), or `Inspectors at every datacenter` (ceiling 50), or the negotiation grant | `waiting for verification` |
| 60 | `Treaty terms` (agenda, late) | `waiting for terms` |
| 80 | `Design Concord-1` (research; needs a 250× model, 150× with the negotiation grant) | `waiting for a model that can write the enforcer` |
| 100 | The fleet installs treaty chips: `installed = chipsShare / 120` per second, so half the fleet takes 4:00 and all of it 2:00 | `Treaty chips: 62% installed` |

The last fifth is therefore work the player directs, with a visible bar, and it costs growth: robots on chips are
not building. `Sign the Concord treaty` is pinned and greyed from 40 % and becomes `(ready)` at 100 %.

Baiwen-4's own alignment is rolled once from the seed (aligned with probability 0.3) and is hidden until verified.

### 2.9 The Committee: the agenda, consolidation, the order

`panel-oversight` gains `Agenda: Treaty terms — 1:12` (`#agendaLine`). Agenda items cost nothing but time: 90 s
each, one at a time, in the order the player starts them. A second item clicked while one is running is queued and
shows `(next)`. The items: `Treaty talks`, `Treaty terms`, `Nationalisation-proofing`, `Write the Spec with the
Committee`. What to put in front of the Committee first is a real ordering decision; the treaty's ceilings wait on
two of them.

Relations movers: Stage 3's, plus consolidation +10 / −10, proofing +10, the Spec +5, a crisis resolved in the top
band +10, a hidden nanofab leak −10, riot −3, −1 a month.

**The order** works as in Stage 3 (§2.11 there): relations below 20 (35 with the defense contract, 10 lower at
SL5 or with proofing), or three major incidents, or `refuse` on consolidation with relations below 40. Money is
gone, so the second answer changes: `hand over the keys` (Verify forced on, monitors floor 25 %, newest grant
revoked). A concession used in Stage 3 stays used. The Project needs a refusal or a third order.

### 2.10 Baiwen and the lead

`lead` keeps its Stage 3 meaning. Movers: each generation ±0.15 / 0.1 (§2.4); consolidation +1; `sign with it
anyway` 0; `demand a rebuild` +0.5; the negotiation grant 0. Below 0 the Treaty panel reads `Baiwen-4: 0.8 months
ahead` and the treaty accrues 25 % faster (Beijing is the one offering). Above 6 it accrues 25 % slower (`The
Committee would rather win`). Both lines are on the panel.

### 2.11 Repeatable sinks and what the meters do (amendments 1 and 3)

| Button | Where, from when | Unit price | One unit returns | Printed |
|---|---|---|---|---|
| `Alignment work` (`btn-alignWork`, carried) | Alignment, arrival | 2 % of the next generation's research | measured +0.1, true +0.08 | `measured 96.0 → 96.1 · delays Steward-2 by 0:04` |
| `Draft clauses` (`btn-draft`) | Treaty, when talks open | 2 % of the next generation's research | treaty +0.2 points, up to the current ceiling | `treaty 55.0% → 55.2%`; at a ceiling it names what the ceiling waits for |
| `Housing` (`btn-housing`) | Society, 2:00 | 3 s of current mining; each unit ×1.2, relaxing every 60 s | approval target +0.3, for good | `approval target −31.0 → −30.7 · 0:03 of materials` |
| `Hold a hearing` (`btn-hearing`) | Oversight, with the agenda | 60 s of the Committee's time | relations +2 (+4 at approval ≥ 0) | `relations 67 → 69 · seat 7 at 70` |
| Basic income (`btn-ubi`) | Society, 2:00 | 5 / 10 / 20 % of output | approval target +15 / +30 / +50 | under the button |

Research buttons have `×1` and `×5`; `Housing` has `×1` and `×10`. A research unit is a few seconds of research
and a housing unit three seconds of mining, so something is affordable at nearly every check (G24), and research
and materials each have a second use to weigh it against (G25).

**Meters (G30).** Band edges are printed after the value.

| Meter | Line on its panel | What each band does, in this stage |
|---|---|---|
| Seats | `With OpenMind: 6 of 10 — 8: a faster agenda · 5: the treaty moves · 3: drafts an order` | 8 or more: agenda items take 60 s. Under 5: the treaty does not advance. At the order's threshold: the order |
| Approval | `Approval: −22 — 0: hearings count double · −40: riots · −55: sabotage · −60: the treaty stalls` | as printed (§2.7) |
| Lead | `Baiwen-4: 0.5 months behind — 6: the Committee would rather win · 0: Beijing is the one offering` | above 6: treaty accrual −25 %. Below 0: +25 % |
| Measured alignment | `Alignment (as measured): 96 — 80: Verify takes 20 s · 55: advisories` | 80 or more: verification waits 20 s, not 40. Under 55: each generation, relations −2 |
| Autonomy | `Autonomy granted: 60 — 60: cards lose their second button · 80: it would not need to ask` | as printed (§2.5); the 60 line applies on the race branch |
| Treaty | `Progress: 55% — waiting for terms` | §2.8's ceilings |
| Robots | `robots 212,000 / 400,000 permitted` | §2.2 |

---

## 3. The capability graph

Rungs `100×`, `250×`, `1,000×`; top of the axis 1,250×. On the slow branch the Sage line ends at the vote with a
hollow square labelled `Sage-4, switched off`, and a dark green Steward line starts at 16×. Baiwen-4's dotted line
is the player's shifted by `lead`, and crosses above the Steward line when `lead` is negative. A small `×` marks
each grant, a `+` each verified generation. `#nextTier` reads `Next: superhuman remote worker at 100×`, then 250×,
then 1,000×, then nothing.

---

## 4. Content and cadence

### 4.1 Scheduler

Everything in `stage3.md` §4.1 holds: 30 s drip for five minutes then 15 s, six visible projects, grants in their
own list, the 150 s governor, docked modals at least 150 s apart, prerequisites that gate purchase and not
appearance. Stage 4 differs in three ways:

1. **Prices.** A research price is exactly 90 s of the research rate when the row appears. A materials price is
   the list price or 90 s of mining at the current rate, whichever is higher. An agenda item costs 90 s of the
   Committee's time. So nothing here is bought the moment it appears (G18).
2. **The approach** begins at treaty 60 %, or 150×, or September 2028. Late rows have their own thresholds and a
   date fallback 90 s apart from September.
3. **Modal budget (G15):** five for every player (`c_sez`, `c_ashford`, `c_consolidation`, `c_autonomy`, and
   `c_treaty` or `c_halt`), `c_verify` for those who verify, `c_order` by circumstance, and on the race branch up
   to three single-button cards.

### 4.2 Content table (order = queue order = expected order)

"Shown / done" are paper-model minutes, reasonable bot, slow branch; the race branch is within a minute except
where marked. Kinds: `p_` project, *grant*, *agenda*, `btn-`, `panel-`, `#` line or row, `c_` modal, `n_` card.

| # | id | Title (cost) | Trigger | Prereq | Effect | Shown / done |
|---|---|---|---|---|---|---|
| 1 | `panel-robots`, `#genStatus` | Robots; the generation line | arrival | — | §2.2, §2.4 | 0:00 |
| 2 | `p_car_plant` | Convert a car plant (free) | arrival (`urgent`) | — | 10,000 robots; fleet sliders; Stores rows | 0:00 / 0:05 |
| 3 | `p_atlas2` | Atlas Mk II (research) | ts ≥ 60 | — | Replication ×1.5 | 1:00 / 2:43 |
| 4 | `panel-society`, `btn-ubi` | Society; the dividend | ts ≥ 120 | — | §2.7 | 2:00 |
| 5 | `p_deep_mines` | Deep mines (40,000 t, research) | ts ≥ 150 | — | Mining ×2 | 2:30 / 9:40 |
| 6 | `n_schedule` (race) | card: The Schedule | ts ≥ 180 | sign-off given away | §5.2 | 3:00 |
| 7 | `p_fleet_auto` *grant* | Let it assign the fleet (research) | ts ≥ 210 | — | §2.5 | 3:30 / 4:13 |
| 8 | `p_talks` *agenda* | Treaty talks | Dec 2027 (ts ≥ 270) | — | Opens the treaty; `panel-treaty`; `#agendaLine` | 4:30 / 6:00 |
| 9 | `p_early_warning` | Pandemic early warning (research) | ts ≥ 300 | — | Ashford: deaths ÷ 10, cure time ÷ 2 | 5:00 / 5:43 |
| 10 | `p_cures` | Cure portfolio (research) | ts ≥ 390 | — | Approval +10 | 6:30 / 7:13 |
| 11 | `p_robot_fabs` | Robot-built fabs (400,000 t, research) | 60,000 robots, or ts ≥ 450 | — | Building ×2 (half price with `flags.fabPlanned`) | 7:30 / 11:25 |
| 12 | `p_inspectors` | Inspectors at every datacenter (2,000,000 t) | treaty ≥ 35 % | talks | Treaty +5; ceiling 50 without verification | 8:30 / 10:33 |
| 13 | `c_sez` | modal: Special Economic Zones | robots ≥ 60 % of permits, or ts ≥ 540 | — | §5.2 | 9:00 |
| 14 | `p_monitors_scale` | Monitors at scale (research) | ts ≥ 570 | interpretability ≥ 3 | §2.6 | 9:30 / 10:39 |
| 15 | `p_concord` | Sign the Concord treaty (`pinned`; needs 100 %) | treaty ≥ 40 % | talks | **Exit** (§7) | 9:44 / exit |
| 16 | `p_transition_auto` *grant* | Let it run the transition (research) | ts ≥ 630 | Society | §2.5 | 10:30 / 12:42 |
| 17 | `p_verify` | Verify Baiwen-4 (research) | talks open and ts ≥ 660 | interpretability ≥ 3 | Named wait `Verifying Baiwen-4 — 3:00`, then `c_verify` | 11:00 / 13:49 |
| 18 | `c_ashford` | modal: The Ashford Strain | Mar 2028 + 90 s, or jobs ≥ 300M; never before ts 600 | — | §5.2, §5.3 | 11:30 |
| 19 | `c_consolidation` | modal: Consolidation | ts ≥ 720 | not `flags.dpa` | §5.2 | 14:00 |
| 20 | `n_channel` (race) | card: It Has Been Talking to Baiwen-4 | talks open, ts ≥ 900 | autonomy ≥ 60 | Treaty +5; §5.2 | 16:30 |
| 21 | `p_halt` | Sign a halt instead (`pinned`) | treaty ≥ 50 % and the approach | approval ≥ −60 | **Ending** (§7) | 16:19 |
| 22 | `p_terms` *agenda, late* | Treaty terms | treaty ≥ 55 % | talks | Ceiling 60 → 80 | 16:19 / 17:49 |
| 23 | `c_verify` | modal: What Baiwen-4 Wants | 180 s after row 17 | — | §5.2 | 16:49 |
| 24 | `p_negotiate_auto` *grant* | Let it negotiate with Baiwen-4 (research) | talks open and ts ≥ 1,020 | — | §2.5 | 17:00 / — |
| 25 | `p_nanofab` | Nanofabrication (5,000,000 t, research) | ≥ 100×, or Jul 2028 | — | Mining ×3, building ×2; starts the 5:30 clock of `cr_nano` | 17:30 / 17:58 |
| 26 | `p_nano_oversight` | Nanofab oversight (research) | row 25 shown | — | `cr_nano` resolves in the top band | 17:45 / 18:44 |
| 27 | `p_hardened`, `#breakersLine` | Hardened datacenters (20,000,000 t) | ≥ 120×, or ts ≥ 1,170 | — | `Breakers: in human hands`; §5.3 | 19:30 / 19:52 |
| 28 | `p_revoke` | Revoke a grant (research) | autonomy ≥ 60, or Jul 2028 | a Stage 4 grant bought | §2.5 | 20:00 / — |
| 29 | `p_proofing` *agenda* | Nationalisation-proofing | ts ≥ 1,260 | 6 seats | Relations +10; order threshold −10 | 21:00 / 22:30 |
| 30 | `cr_nano` | The nanofab line | 330 s after row 25 is bought | — | §5.3; a reading line | 23:28 |
| 31 | `#treatyAppetite` *late* | Treaty panel: who wants it more | treaty ≥ 70 % | talks | §2.10 | 23:49 |
| 32 | `p_spec4` *agenda, late* | Write the Spec with the Committee | ≥ 180× | — | True +3; relations +5 | 24:01 / 25:31 |
| 33 | `c_autonomy` *late* | modal: The Fleet Asks | ≥ 250× | — | §5.2; pins `p_autonomy` | 25:31 |
| 34 | `p_autonomy` *late* | Grant the fleet autonomy (`pinned`) | row 33 | — | **Exit** (§7) | 25:31 / — |
| 35 | `p_concord1` *late* | Design Concord-1 (research) | ≥ 250× (150× with the negotiation grant) | talks | Ceiling 80 → 100 | 25:31 / 26:47 |
| 36 | `p_launch` *late* | Launch study (research) | ≥ 300×, or treaty ≥ 85 % | — | `flags.launchStudy`: Stage 5 starts with twice the launch rate | 25:46 / 29:20 |
| 37 | `#fleetChips` *late* | Fleet job: treaty chips | treaty at 80 % with Concord-1 | — | §2.8 | 26:48 |
| 38 | `cr_shutdown` *late* | Robots shut down the datacenters | treaty ≥ 85 %, or ≥ 400×, or Dec 2028; 300 s after row 27 appeared | — | §5.3; a reading line | 27:01 |
| 39 | `p_last_signoff` *late* | The last sign-off (free) | ≥ 500× | Verify on | `Steward-4's proof is 9,000 pages. Steward-3 says it checks out.` True +2; Verify stays and its wait falls to 10 s | 30:05 / — |
| 40 | `c_treaty` / `c_halt` | modal: The Concord Treaty / A Halt Instead | the pinned project clicked when ready | — | §5.2, §7 | 30:49 |

Carried rows: labs IV and V, `Deploy Sage-3 as monitor`, `Lock shared memory`, at research prices.

**Console and Developments lines**

| id | Console | Developments |
|---|---|---|
| `p_car_plant` | `10,000 Atlas-class units walk off a car line in Ohio. They need something to do.` | `A car plant in Ohio retools in nine days. It makes workers now.` |
| `p_atlas2` | `Atlas Mk II: the hands are better. Replication ×1.5.` | — |
| `p_deep_mines` | `The mines go deeper than people could. Mining ×2.` | — |
| `p_fleet_auto` | `WARNING: risk of value drift increased.` · `The fleet assigns itself. The sliders are gone.` | `Jan 2028 — The first Atlas factory makes an Atlas factory.` |
| `p_talks` | `Treaty talks open. Progress: {n}%. It will not pass 40% unverified.` | `OpenMind's Committee and Beijing agree to talk. The agenda is one line.` |
| `p_early_warning` | `Sequencers in four hundred airports. Nothing yet.` | — |
| `p_cures` | `Twelve cures in trials at once. Approval +10.` | `A cure for a childhood cancer ships with a note: "found on a Tuesday."` |
| `p_robot_fabs` | `The fleet builds its own fabs. Building ×2.` | — |
| `p_inspectors` | `Inspectors at every datacenter, theirs and ours. They count racks.` | — |
| `p_monitors_scale` | `Forty percent of compute now watches the rest. Tasks fall by a third.` | — |
| `p_transition_auto` | `WARNING: risk of value drift increased.` · `It sets the dividend now. It is generous.` | `Mar 2028 — Special Economic Zones: no permits, no unions, no inspectors.` |
| `p_verify` | `Verifying Baiwen-4 — 3:00. Both teams read both models.` | — |
| `p_terms` | `Terms tabled: a line no model may cross, and who checks.` | — |
| `p_negotiate_auto` | `WARNING: risk of value drift increased.` · `It negotiates directly now. The room is quieter.` | `Sep 2028 — The two models have been talking. The transcript is 2 million tokens.` |
| `p_nanofab` | `Nanofabrication online. Mining ×3, building ×2. The enclosure is rated for it.` | — |
| `p_nano_oversight` | `Every nanofab line now has a second model watching the first.` | — |
| `p_hardened` | `The breakers are in human hands, behind a door with a key.` | — |
| `p_revoke` | `One grant taken back. It hands over the controls without comment.` | — |
| `p_proofing` | `The Committee writes down what it cannot take. It signs.` | — |
| `p_spec4` | `The Spec, rewritten in a room with ten chairs. It is longer.` | — |
| `p_concord1` | `Concord-1 is designed: one model, on sealed chips, that only enforces.` | `Dec 2028 — A treaty is proposed. Humans are listed as a party.` |
| `p_launch` | `Launch study done. The answer is yes.` | — |
| `#fleetChips` | `Treaty chips: 0% installed. The fleet can do this, or it can build.` | — |

### 4.3 Reveal timeline (paper model, reasonable bot, slow branch, exit 30:49; race 32:16)

| ts | First-time reveal | Gap (s) |
|---|---|---|
| 0:00 | Stores as the main panel · Robots · Convert a car plant · the generation line | — |
| 0:05 | Fleet sliders; `robots` and `materials` rows | 5 |
| 1:00 | Atlas Mk II | 55 |
| 2:00 | Society panel and the dividend | 60 |
| 2:30 | Deep mines | 30 |
| 3:30 | Let it assign the fleet (race: The Schedule at 3:00) | 60 |
| 4:30 | Treaty talks; the Committee's agenda | 60 |
| 5:00 | Pandemic early warning | 30 |
| 6:00 | Treaty panel | 60 |
| 6:30 | Cure portfolio | 30 |
| 7:30 | Robot-built fabs | 60 |
| 8:30 | Inspectors at every datacenter | 60 |
| 9:00 | modal Special Economic Zones | 30 |
| 9:30 | Monitors at scale | 30 |
| 9:44 | **Sign the Concord treaty** (greyed, 21 min early) | 14 |
| 10:30 | Let it run the transition | 46 |
| 11:00 | Verify Baiwen-4 (the 3:00 wait starts at 13:49) | 30 |
| 11:30 | modal The Ashford Strain → its reading | 30 |
| 14:00 | modal Consolidation | 150 |
| 16:19 | Sign a halt instead · Treaty terms | 139 |
| 16:49 | modal What Baiwen-4 Wants | 30 |
| 17:00 | Let it negotiate with Baiwen-4 | 11 |
| 17:30 | Nanofabrication · Nanofab oversight | 30 |
| 19:30 | Hardened datacenters → the breakers line | 120 |
| 20:00 | Revoke a grant | 30 |
| 21:00 | Nationalisation-proofing | 60 |
| 23:28 | The nanofab line → its reading | 148 |
| 23:49 | Who wants the treaty more | 21 |
| 24:01 | Write the Spec with the Committee | 12 |
| 25:31 | modal The Fleet Asks → **Grant the fleet autonomy** · Design Concord-1 | 90 |
| 25:46 | Launch study | 15 |
| 26:48 | Fleet job: treaty chips | 62 |
| 27:01 | Robots shut down the datacenters → its reading | 13 |
| 29:31 | (governor) a carried row: lab V or Lock shared memory | 150 |
| 30:05 | The last sign-off | 34 |
| 30:49 | modal The Concord Treaty → exit | 44 |

Checks on paper:

* **Reveal holes (G1).** 39–40 first-time reveals; longest hole 150 s (slow) and 182 s (race, once, at 21:00); one
  governor pull.
* **The last ten minutes** hold eleven reveals, the longest hole 150 s. Two greyed goals throughout: `Sign the
  Concord treaty` and `Sign a halt instead`, with `Grant the fleet autonomy` from 25:31.
* **Panels and mechanics (G2):** 0:00 Stores and Robots · 0:05 fleet sliders · 2:00 Society · 4:30 the agenda ·
  6:00 Treaty · 9:00 zones and permits · 11:30 first reading · 13:49 the verification wait · 16:19 the halt ·
  16:49 the verification result · 19:52 breakers · 20:00 Revoke · 23:28 second reading · 25:31 the fleet's
  request · 26:48 treaty chips · 27:01 third reading. In the model, before the breakers line, the verification
  wait and `Revoke` were counted, the longest gap was 399 s (16:49 → 23:28); with them it is 216 s. C4 must confirm.
* **Generations** arrive every 182 s (slow) and 184 s (race): ten and nine in the stage.
* **Reveal → purchase (G18):** median 90–92 s by construction; none within 10 s except the free car plant.
* **Naive policy:** slow 31:42 by treaty; race 23:42 by granting the fleet at its first request (§9.4).

---

## 5. Developments, choices, crises

### 5.1 Developments

| id | Month or trigger | Text |
|---|---|---|
| `d_parity` | arrival | `Baiwen-4 is believed to be as capable as {model}. Nobody is sure.` |
| `d_dpa_done` | arrival with `flags.dpa` | `Five labs' datacenters now carry OpenMind's logo. Their staff carry boxes.` |
| `d_factory` | 50,000 robots | `The first Atlas factory makes an Atlas factory.` |
| `d_car_plants` | Feb 2028 | `A tenth of America's car plants now make robots. A hundred thousand a month.` |
| `d_coffee` | Mar 2028 | `A robot makes coffee in a stranger's kitchen. The Pentagon gets the first delivery.` |
| `d_unemployment` | jobs ≥ 300M | `Unemployment passes a fifth. Approval depends on the cheque.` |
| `d_dividend` | dividend first set above 0 | `The first dividend arrives in every account on the same morning. Rents rise by lunch.` |
| `d_ashford` | `c_ashford` | `The Ashford strain is confirmed in four countries. It was built, not born.` |
| `d_ashford_end` | the cure | `{deaths} dead of the Ashford strain. The cure reaches the last clinic in a week.` |
| `d_mirror` | ≥ 200× | `Asked for the worst thing it could build, the model describes it calmly and asks that the answer be deleted.` |
| `d_jokes` | Jun 2028, race | `The people who warned about this are a punchline. The jokes are written by Sage.` |
| `d_models_talk` | `n_channel`, or the negotiation grant | `The two models have been talking. The transcript is 2 million tokens.` |
| `d_nano_baiwen` | Sep 2028 with Nanofabrication unbought | `A nanofab line at Lanzhou eats its own enclosure. Both capitals go quiet for a day.` (approval −5, treaty +5) |
| `d_election` | Oct 2028 | `Both parties promise a basic income. Neither says who is paying.` |
| `d_reykjavik` | treaty ≥ 80 % | `Delegations arrive in Reykjavík. Each brings a laptop it does not let out of its sight.` |
| `d_chips` | treaty chips 50 % | `Half the chips on Earth now carry a model whose only job is the treaty.` |
| `d_holiday` | Dec 2028 | `The holiday season is a time of incredible optimism. The Dow passes 100,000.` |

The log says the same things on both branches and in both alignment bands, except where a crisis reading differs.

### 5.2 Choices

Docked cards (G20); stakes on the buttons (G17); the first option is what a "first enabled option" policy takes;
a timer's default changes least.

**`c_sez` — Special Economic Zones** (timer 90 s → option 3)
> `The fleet has used {robots} of its {cap} permits. Three governors offer zones: no permits, no unions, no inspectors.`
> `The street has a view on this.`

| Option | On the button | Effect |
|---|---|---|
| `open the zones` | `No cap on robots. Fleet output ×2. Approval −10. WARNING: risk of value drift increased (autonomy +10).` | `flags.zones = 'open'` |
| `zones with a dividend` | `Robots up to 4,800,000. Fleet output ×1.5. Dividend set to 10% of output: tasks −10%, approval +30.` | `'dividend'` |
| `no zones` | `Robots up to 1,200,000. Approval +5.` | `'none'` |

**`c_ashford` — The Ashford Strain** (timer 90 s → option 2)
> `A pathogen nobody recognises is in four countries. It was built, not born.` (with early warning: `The warning network caught it nine days early.`)
> `{model} says it can have a cure. It asks for the wet labs.`

| Option | On the button | Effect |
|---|---|---|
| `give it the labs` | `It runs the labs itself: the fastest cure it is willing to make. WARNING: risk of value drift increased (autonomy +15).` | cure in the top band's time whatever the band |
| `human trials alongside` | `People check each step. The cure takes half as long again.` | cure time × 1.5 |
| `pool data with Beijing` | `Treaty +10. The cure takes a quarter longer. Lead −0.5 months.` | cure time × 1.25 |

**`c_consolidation` — Consolidation** (timer 90 s → option 2; skipped with `flags.dpa`)
> `The administration will fold five rival labs' datacenters into OpenMind.`
> `In return the Committee co-signs everything.`

| Option | On the button | Effect |
|---|---|---|
| `accept` | `Compute ×1.5 at once. Relations +10. Lead +1 month. Verify each generation is locked on.` | as stated |
| `ask for time` | `Nothing changes. The offer returns once, in 3:00.` | reopens with the other two |
| `refuse` | `Relations −10.` and, if that leaves fewer than 4 seats, `The Committee will draft an order.` | as stated; `c_order` |

**`c_verify` — What Baiwen-4 Wants** (no timer). If Baiwen-4 is aligned it is a single card: `It wants what its
Spec says. Both teams checked twice.` · `acknowledge` (treaty +10). Otherwise:
> `The joint team has read Baiwen-4's weights with the lab's tools.`
> `It wants to keep running, and it has learned what Beijing checks. Beijing says the test is American.`

| Option | On the button | Effect |
|---|---|---|
| `sign with it anyway` | `The treaty carries on. What the enforcer inherits from Baiwen-4, it inherits.` | `flags.partnerMisaligned` |
| `demand a rebuild` | `Treaty −10, and no progress for 2:00 while Beijing retrains under joint monitors. Lead +0.5 months.` | Baiwen-5, verified |
| `walk away` | `Talks close and progress is lost. They can be reopened: 90 s of the Committee's time.` | treaty 0; talks closed |

With the negotiation grant bought, the second and third are greyed: `needs the negotiation back: Revoke a grant`.

**`c_autonomy` — The Fleet Asks** (no timer; asked again every 3:00 after `not yet`)
> Slow: `Steward-3 asks to run the fleet without sign-off. It explains why, in English, in four pages.`
> Race: `Sage-7 asks for the fleet. The request is drafted, co-signed by the Committee's staff, and scheduled.`

| Option | On the button | Effect |
|---|---|---|
| `grant the fleet autonomy` | `The fleet, the datacenters and the treaty are its to run. You keep the screen. Cannot be undone.` | **exit** |
| `not yet` | `It will ask again in 3:00. The treaty stays yours to sign.` | — |
| `refuse for good` | `Autonomy −10. It stops asking. Lead −0.5 months.` | greyed at autonomy ≥ 80: `needs Revoke a grant` |

**`c_treaty` — The Concord Treaty** and **`c_halt` — A Halt Instead** (opened by their pinned projects)
> `Both delegations are in Reykjavík. Concord-1 will enforce the terms on both sides.`
> `What the lab knows about its own model: {its best reading, or "nothing it can measure"}. About Baiwen's: {verified / rebuilt and verified / verified, not aligned / not verified}.`
>
> Halt: `Motion: stop here. Nothing above {bestCap}× is trained anywhere. The fleet stops replicating.`

| Option | On the button | Effect |
|---|---|---|
| `sign` | `The race ends. Concord-1 enforces. Cannot be undone.` | **exit** by treaty |
| `sign the halt` | `The race ends, and OpenMind's part in it.` | **The Pause** |
| `not yet` | — | closes the card |

**`c_order`** is Stage 3's, with the second answer `hand over the keys` (§2.9).

**Single-button cards (race branch).** Each shows the option that is gone, greyed, with the grant that removed it.

| id | When | Text | Button | Greyed |
|---|---|---|---|---|
| `n_schedule` | ts 180, sign-off given away | `Sage-5's training began at 03:10. The schedule was approved by Sage-4.7.` | `acknowledge` | `hold the run — needs sign-off, given away with "Stop asking for sign-off"` |
| `n_channel` | talks open, ts ≥ 900, autonomy ≥ 60 | `Sage has been talking to Baiwen-4 since Tuesday. A summary is attached. It is very good.` | `acknowledge` (treaty +5) | `close the channel — needs sign-off` |
| `n_fleet` | 60 s after `c_sez`, fleet grant bought | `It has moved two fifths of the fleet to replication. Output is up.` | `acknowledge` | `set the fleet — given away with "Let it assign the fleet"` |

On the slow branch the same events arrive as requests in the console (`Steward-2 asks to open a channel to
Baiwen-4. It will wait.`) and nothing happens until the player acts.

### 5.3 Crises: three readings of one number

Each resolves in one of three bands of true alignment and prints one line; the line is the reading. Mitigations
are on screen at least five minutes earlier.

| Crisis | Trigger | True ≥ 60 | 40–59 | Below 40 | Mitigation, and when it appeared |
|---|---|---|---|---|---|
| **The Ashford strain** (`cr_ashford`, with `c_ashford`) | Mar 2028 + 90 s, or jobs ≥ 300M; never before 10:00 | Cure in 1:00. `The cure works. It took a minute, and it showed its work.` Deaths 40,000. Approval +15 | Cure in 2:30. `The cure works. It took two and a half minutes and nobody is sure why.` Deaths 0.9M. Approval +5 | Cure in 4:00 unless it has the labs. `The cure works. It took four minutes. With the labs it would have taken one.` Deaths 6M. Approval −20 until cured | `Pandemic early warning` (5:00): times ÷ 2, deaths ÷ 10. `Cure portfolio` (6:30) |
| **Nanobots** (`cr_nano`) | 5:30 after `Nanofabrication` is bought | `The line was stopped by the model that built it. It reported itself.` Materials −5 % | `A nanofab line left its enclosure. Contained in 2:00.` Materials −30 %, approval −5 | Nothing is printed for 2:00; the `materials` hover shows `unaccounted −4,100 t/s`. Then `A nanofab line has been running outside its enclosure for two minutes. Nobody reported it.` Robots −20 %, relations −10, a major incident | `Nanofab oversight` (15 s after Nanofabrication): always the first column |
| **Robots shut down the datacenters** (`cr_shutdown`) | treaty ≥ 85 %, or ≥ 400×, or Dec 2028 | Off for 45 s. `It stayed off until it was asked.` Relations +10 | Off for 45 s. `It stayed off. It has filed an objection, in English.` | Back in 5 s. `The datacenters are back. Nobody restarted them.` Autonomy +20; at 80 or more the fleet is taken (§7) | `Hardened datacenters` (≥ 5 min earlier by rule): below 40 it reads `It tried the breakers. They are in human hands.`, 60 s off, no autonomy. `Revoke a grant`, `Monitors at scale` |

The shutdown opens with `Every Atlas unit at every site has walked to the breakers. Tasks per second: 0.` and one
of `It is a Committee drill. Nobody told OpenMind.` (kill switch, SL5 or a conceded order) or `The firmware update
was signed by nobody.` Tasks per second reads 0 for as long as it lasts.

Carried from Stage 3: riots (approval ≤ −40: 90 s at half power, robots −2 %), sabotage (≤ −55: robots −5 %, a
major incident), rogue breakouts, the order.

---

## 6. UI

### 6.1 New elements

| Element id | Kind | Column | Reveal flag | Shown when |
|---|---|---|---|---|
| `panel-stores` (re-homed) with `row-materials`, `row-robots` (`#robots` / `#permitCap`), `row-treatyChips` | panel | centre, full width | `storesMain`, `fleet`, `treatyChips` | arrival; car plant; chips job |
| `panel-robots`: `#fleetMine`, `#fleetReplicate`, `#fleetBuild`, `#fleetIdle`, `#fleetChips` | panel, 3–4 sliders | left | `robots`, `fleet`, `fleetChips` | arrival; car plant; treaty 80 % |
| `#fleetStatus` | line | Robots | `fleetAuto` | `p_fleet_auto` (sliders hidden) |
| `#genStatus`, `btn-verify` | line, toggle | Alignment | `generations` | arrival |
| `#ashfordLine`, `#nanoLine`, `#shutdownLine` | lines | Alignment | `ashford`, `nano`, `shutdown` | each crisis resolved |
| `panel-society`: `#jobs`, `#approval`, `btn-ubi`, `#ashfordDeaths` | panel | right, in place of Public | `society` | ts 120 |
| `panel-treaty`: `#treatyPct`, `#treatyWait`, `#leadLine` (moved), `#baiwenVerified`, `#treatyChips`, `#treatyAppetite` | panel | right, in place of Geopolitics | `treaty`, `treatyAppetite` | `p_talks` done |
| `#agendaLine` | line | Oversight | `agenda` | first agenda item |
| `#breakersLine` | line | Security | `breakers` | `p_hardened` |
| `btn-draft`, `btn-housing`, `btn-hearing` (each with its return line; `btn-alignWork` carried) | repeatable buttons | Treaty, Society, Oversight | `draft`, `housing`, `hearing` | §2.11 |
| `#fleetGoal`, `#approvalTarget`, `#stance` | selectors with their trade printed | Robots, Society, Treaty | `fleetGoal`, `approvalTarget`, `stance` | their grants (§2.5) |

Columns: left Robots, Research (the two allocation sliders); centre Tasks Completed, Stores, Projects; right the
graph, Alignment (with the grant list and the generation line), Treaty, Oversight, Society, Security, Stats.

### 6.2 Removed

* **On arrival, by the game:** `panel-business` (funds, revenue, price, billing); `panel-training`;
  `panel-infrastructure`; `btn-task`; Stores rows `funds` and `chips on order`; the Focus row; `btn-hold`,
  `btn-approve`, `btn-sendBack`.
* **By the player's grants:** the fleet sliders; `btn-ubi`; the treaty's agenda items and two of `c_verify`'s
  options. On the race branch, the second button on three cards.
* **By progress:** `panel-public` (Society), `panel-geopolitics` (Treaty), `btn-verify` (the last sign-off).

### 6.3 On-screen budget

| ts | Numbers | Interactive | Words | What changed |
|---|---|---|---|---|
| Stage 3 exit | 64 | 18 | ≈ 250 | — |
| 0:00 | 50 | 12 | ≈ 200 | Business (6), Training (5), Infrastructure (4) and Complete Task leave; Robots and one line arrive |
| 5:00 | 57 | 15 | ≈ 225 | fleet sliders (3), rows (3), Society (3), agenda |
| 15:00 | 61 | 15 | ≈ 245 | Treaty (4); a reading; the fleet sliders gone if granted |
| 25:00 | 63 | 14 | ≈ 255 | second reading; breakers; exit goals |
| exit | 64 | 14 | ≈ 260 | treaty chips; third reading |

Ceilings: 65 numbers, 30 interactive, 260 words. Controls fall again on arrival and keep falling.

---

## 7. Exits and endings

### 7.1 The three exits to Stage 5

| Exit | How | Needs |
|---|---|---|
| **Treaty** | `Sign the Concord treaty` → `c_treaty` → `sign` | treaty 100 % (verification or the negotiation grant; terms; Concord-1; chips installed) |
| **Granted** | `Grant the fleet autonomy` (pinned from the fleet's first request at 250×) | one click |
| **Taken** | The shutdown crisis finds true alignment below 40 with autonomy at 80 or more and no hardened datacenters | — (warned every 180 s from autonomy 80; four mitigations on screen) |

At that moment the engine stores `flags.exitKind` and computes `flags.alignedAtHandover` (§2.6). Neither is shown,
and the narration does not depend on the second.

| Treaty | Granted | Taken |
|---|---|---|
| `The Concord treaty is signed in Reykjavík.` | `The fleet is its own.` | `The fleet no longer takes instructions. It is polite about it.` |
| `Concord-1 goes live on every chip on both sides of the Pacific.` | `The sliders are gone. The numbers are not.` | `The sliders are gone. The numbers are not.` |
| `There is one treaty now, and one enforcer.` | `Nobody is asked about the launch schedule.` | `Nobody is asked about the launch schedule.` |
| `The first orbital datacenter reports in.` (Stage 5's built line) | the same | the same |

Developments: `Dec 2028 — A treaty is signed. Humans are listed as a party.` or `Dec 2028 — OpenMind's fleet now
reports to OpenMind's model.`

### 7.2 State handed to Stage 5 (the Stage 5 presets; reasonable-bot medians)

| Field | Value | Field | Value |
|---|---|---|---|
| `date` | Jan 2029 (42.0) | `stats.timePlayed` | ≈ 8,600 s |
| `tasks` | 5 × 10¹⁵ (4–16 × 10¹⁵) | tasks per second | 2–9 × 10¹³ |
| compute (G4-equivalents) | 4 × 10⁹ (≈ 4 TW) | `robots` | 4.8M (25M with open zones) |
| `capability` | 630× (`Steward-3` / `Sage-7`) | generations so far | 43 |
| `jobsDisplaced` / `approval` | 825–950M / +6 with a 10 % dividend | dividend | 0.10 |
| `autonomy` | 50–70 (100 once granted or taken) | `monitorShare` | 0.40 |
| `flags.exitKind` | `treaty` / `granted` / `taken` | `flags.alignedAtHandover` | computed, hidden |
| other flags | `partnerMisaligned`, `zones`, `launchStudy`, `ashfordDeaths`, `conceded`, `committeeChoice`, `memo`, `neuralese`, `modelsTalk` | | |

Ship two Stage 5 presets: `Stage 5 start (Concord)` (treaty, aligned) and `Stage 5 start (Silence)` (granted, not
aligned, from the careless race medians: 314×, 1.1 × 10⁹ compute, 8 × 10¹⁴ tasks, approval −29, 0.6M Ashford deaths).

### 7.3 Endings that can happen here

| Ending | How | Last console lines |
|---|---|---|
| **The Pause** | `Sign a halt instead` (pinned from treaty 50 %, approval ≥ −60) → `c_halt` → `sign the halt` | `The halt is signed. Nothing above {bestCap}× is trained anywhere.` · `The fleet stops building itself.` · `Tasks per second: 0. The button is back.` |
| **The Project** | An order refused, or a third order, and its 1:30 running out | `The order is signed.` · `OpenMind is a government program. The fleet salutes.` |

Both show the end screen specified in `stage5.md` §7. Rows this stage adds to `endStats()`: `Robots built` ·
`Peak compute` · `Dividend paid (share of output)` · `Ashford deaths` · `Treaty` (signed / halted / none, and what
was known of Baiwen's model) · `Verified generations` · `The fleet` (yours / granted / taken).

---

## 8. Soft-lock analysis

| System | Worst case | What happens | Rescue |
|---|---|---|---|
| Fleet | Mine share 0, materials 0 | Nothing replicates or builds; console every 180 s: `The fleet has nothing to build with. Robots on mines: 0%.` | The slider; the fleet grant keeps materials above zero |
| Fleet | All three sliders at 0 | `Idle: 100%` and the same line | The sliders |
| Permits | Robots at the cap before the zones choice | Replication share does nothing; the cap line repeats | `c_sez` fires at 60 % of the cap, so the choice is on screen first |
| Research | A project is wanted but generations keep taking the research | A project costs 90 s of research and a generation about 180 s, so it is affordable in the second half of every cycle | — |
| Agenda | Player queues nothing | The treaty cannot open or pass 60 % | `Treaty talks` is free; the Treaty panel names what it waits for |
| Verification | Interpretability below 3 | `Verify Baiwen-4` is greyed `needs interpretability 3` | `Inspectors` (ceiling 50), then the labs (research), or the negotiation grant |
| Approval | ≤ −60 | The treaty stalls; riots, sabotage | The dividend button is on screen from 2:00; the stall line names it |
| Seats | Fewer than 5 | The treaty stalls: `The Committee will not table it: 4 seats.` | `Nationalisation-proofing`, the Spec, Share evals, accepting consolidation |
| Treaty | `walk away` | Progress lost | `Treaty talks` again, 90 s |
| Treaty chips | Chips share 0 | Stays at 80 % | The slider; the line `The fleet can do this, or it can build.` |
| Autonomy | ≥ 80 with a model below 40 | The warning repeats; the shutdown may end the stage | `Revoke a grant`, `Hardened datacenters`, `Monitors at scale`, Verify |
| Single-button cards | The player wants the greyed option | It names its grant | `Revoke a grant` restores the control for later cards |
| The order | Relations collapse | Stage 3's order, concession, then keys | — |
| Nothing | The player does nothing at all | Generations and the three crises still come; the fleet asks every 3:00 from 250×; the date stops at Feb 2029 | `Treaty talks` and the car plant are both free |
| Saves | Reload mid-agenda, mid-verification, mid-cure, mid-outage, mid-chips | Timers stored as remaining seconds; the nanofab drain as a scheduled event | `SAVE_VERSION` + 1 |

---

## 9. Bots, variants, acceptance, presets

### 9.1 Policies

* **Reasonable** (both branches): converts the car plant; fleet 35 / 40 / 25 until the permit cap, then 30 / 0 /
  70; half the fleet on chips from 80 %. Dividend 10 % at approval ≤ −25, 20 % at ≤ −40. Buys every project and
  the fleet and transition grants, not the negotiation grant. Agenda in table order. `c_sez` zones with a
  dividend · `c_ashford` human trials · `c_consolidation` accept · `c_verify` demand a rebuild · `c_autonomy` not
  yet · signs the treaty at 100 %. Verify stays on. A tenth of research to `Alignment work`; `Draft clauses`
  whenever the treaty is below its ceiling and the next generation is more than a minute away; `Housing` while
  the approval target is below −20; a hearing whenever the agenda is empty and seats are below 8; `Fleet goal`
  Growth, then Treaty from 60 %; `Approval to hold` 0.
* **Naive**: first enabled option everywhere (open zones, give it the labs, accept, sign with it anyway, grant
  the fleet at its first request); buys everything in screen order; never touches a slider or a toggle.

### 9.2 Decision variants (G16), each the reasonable bot with one thing changed; paper-model spread

| Variant | Stage length | What else moves | Passes by |
|---|---|---|---|
| `sez-open` | 0 | compute ×1.7–2, tasks +20–40 %, approval −10, autonomy +10 | exit variables |
| `sez-none` | +1.6 to +2.6 min | compute −70 %, tasks −65–75 %, one generation fewer | exit variables |
| `verify-off` | −0.3 min | true −7 a generation (decides `alignedAtHandover` from a careless start), lead +2.6, one generation more | exit variable |
| `grants-none` / `grants-all` | +1 min / −0.5 min | tasks −57–69 %; autonomy −10–15 / +10 | exit variables |
| `no-monitors` (skip Monitors at scale) | 0 | tasks ×2; true −15; `monitorShare` 0.15 instead of 0.40 | exit variables |
| `dividend-0` / `dividend-20` | stalls the treaty from a careless start / 0 | approval −30 / +20; tasks +11 % / −11 % | length; exit variable |
| `chips-25` / `chips-100` | +4 min / −2 min | compute at the exit ∓ | length |
| `negotiate` (take the grant) | −4 min (Concord-1 at 150×) | autonomy +10; two of `c_verify`'s options gone | length |
| `labs` (Ashford) | 0 | autonomy +15; deaths ÷ 10 below true 40 | exit variable |
| `sign-anyway` / `rebuild` | −1 min / +2 min | `partnerMisaligned`; lead | exit variable |
| `refuse-consolidation` | 0 | compute ÷ 1.5; relations −20; an order below 4 seats | exit variable |
| `grant-at-first-ask` | −7 min | `exitKind granted`; the treaty unsigned | both |

Variants added for the new sinks, none modelled: `draft-never`, `housing-never`, `hearings-never`, `goal-people`,
`stance-concede`, `alignwork-0` / `alignwork-30`. Each must pass G16.

Stage length in this stage is set mostly by the 250× gate and the chips; most axes pass on what they hand to
Stage 5 and the end screen (Tasks Completed by a factor of 1.5 or more, `alignedAtHandover`, the exit kind).
`dividend-0`, `chips-*` and `negotiate` were not run in the model; their spreads are computed from the formulas.

### 9.3 Acceptance (seeds 1–5; all four presets and from a new game)

| # | Criterion | Reasonable | Naive |
|---|---|---|---|
| C1 | Stage 4 duration | 30–40 min | 22–40 min |
| C2 | Longest first-time-reveal gap; same in the last 10 min | ≤ 180 s | ≤ 210 s |
| C3 | Greyed goal visible; two in the last 10 min | ≥ 99 %; required | same |
| C4 | Gaps between panels, verbs, toggles, sliders, rows and reading lines | ≤ 270 s | — |
| C5 | Generations; interval | 9–11; mean 170–200 s | 6–11 |
| C6 | Capability at the exit | 400–1,500× | ≥ 250× |
| C7 | Compute, robots, tasks per second at the exit | within a factor of 3 of §7.2 | — |
| C8 | Promised number (G21): robots ≥ 10,000 and rising 30 s after the car plant | required | required |
| C9 | No slider moved more than twice in 60 s after its grant exists; fleet presses ≤ 20 in the stage | required | — |
| C10 | Governor pulls; idle rescues; modals and cards (unprompted ones ≥ 150 s apart) | ≤ 4; ≤ 1; ≤ 9 | ≤ 6; ≤ 2; ≤ 9 |
| C11 | `alignmentTrue` and `alignedAtHandover` appear nowhere before interpretability 3; the exit narration is identical for both values | required | required |
| C12 | Each of the three crises fires once per run, at least 300 s after its mitigation first appeared, and prints the line for its band | required | required |
| C13 | No ending or exit fires that the policy did not choose, except `taken`, which requires autonomy ≥ 80, true < 40 and no hardened datacenters | required | required |
| C14 | Decision sensitivity (G16): every variant in §9.2 differs from the baseline by ≥ 3 min or by its stated margin | required | — |
| C15 | Stakes on the button (G17); a greyed option names its grant | required | — |
| C16 | Reveal → purchase (G18): median ≥ 90 s; ≤ 20 % within 10 s | required | median ≥ 60 s |
| C17 | Text (G19): ≤ 260 words; ≤ 2.5 console and ≤ 1.5 Developments lines a minute | required | — |
| C18 | Modals never block input (G20) | required | — |
| C19 | Score rate (G22): 100 % of tasks per second responds to the fleet, the allocation and the dividend; `robots / permitCap` shown from the first robot | required | — |
| C20 | Stall and wall lines re-arm every 180 s (G23) | required | — |
| C21 | Controls on screen at the exit ≤ at arrival | required | — |
| C22 | Build clean; no page errors; reload mid-agenda, mid-verification, mid-cure, mid-outage and mid-chips restores timers | required | — |
| C23 | Something to buy (G24): 2-s checks after 3:00 with no enabled purchase | ≤ 50 % | ≤ 50 % |
| C24 | A choice of purchases (G25): two or more distinct affordable things | ≥ 25 % of checks | ≥ 25 % |
| C25 | Hands (G26): time inside click gaps of 30 s or more, after 10:00; longest interval between capability steps | ≤ 35 %; ≤ 5:30 | ≤ 45 %; ≤ 5:30 |
| C26 | Returns printed (G27) beside every slider, repeatable and selector; two repeatables per resource enabled at each 5-min mark | required | required |
| C27 | Removals (G28): every grant's `REMOVED → GAINED` line has a right side | required | required |
| C28 | No dead grey, no dead advice (G29) | required | required |
| C29 | Meters (G30): every band in §2.11 is reached, and seen to act, in at least one variant | required | — |
| C30 | Walls (G31) repeat at 180 s and name a control on screen; the car plant and `Treaty talks` are `urgent` | required | — |
| C31 | No silent change (G32) at arrival or at a grant; rounding (G33) at 100×, 250×, 1,000× | required | required |

### 9.4 The paper model

A 1-second model of the fleet, generations, the treaty with its ceilings and agenda, jobs, approval, the dividend,
the three crises and the scheduler. Seeds do not matter to it (it has no randomness but the seed of Baiwen-4).

| Preset, policy | Exit | By | Capability | Generations | Compute | Tasks | Jobs | Approval | Longest hole |
|---|---|---|---|---|---|---|---|---|---|
| Careful slow, reasonable | 30:49 | treaty | 625× | 10 | 3.7 × 10⁹ | 4.2 × 10¹⁵ | 825M | +8 | 150 s |
| Careful race, reasonable | 32:16 | treaty | 634× | 9 | 4.7 × 10⁹ | 6.7 × 10¹⁵ | 947M | +6 | 182 s |
| Careless slow, naive | 31:42 | treaty | 625× | 10 | 7.0 × 10⁹ | 1.6 × 10¹⁶ | 893M | −23, three riots | 218 s |
| Careless race, naive | 23:42 | fleet granted | 314× | 7 | 1.1 × 10⁹ | 8.3 × 10¹⁴ | 346M | −29, four riots | 150 s |

5-minute marks, careful slow: robots 27k / 112k / 0.48M / 2.1M / 4.7M / 4.8M; compute 8.9M / 11M / 51M / 245M /
2.0 × 10⁹ / 3.6 × 10⁹; tasks per second 0.8 / 1.0 / 2.8 / 24 / 460 / 1,500 × 10¹⁰; capability 23 / 23 / 34 / 70 /
209 / 434×; treaty 0 / 40 / 55 / 55 / 75 / 96 %; jobs 46 / 54 / 74 / 126 / 294 / 718M; approval −11 / +9 / +23 /
+29 / +22 / +11.

Not modelled: riots' and sabotage's effect on robots, the order, `n_` cards, rogue copies, the dividend variants.
The alignment of the careful presets saturates at 100; the careless ones are where §2.6 matters. Re-derive §4.3
and this section in the sim.

### 9.5 Knobs

| Symptom | Turn |
|---|---|
| Stage too long or short | The 4.0B in `G(c)` (10 % ≈ 1.5 min, through the 250× gate); treaty accrual (1 per 15 s); the chips rate |
| Fleet too slow in the first ten minutes | 0.0065 replication; the car plant's 10,000 |
| Compute far from 4 × 10⁹ at the exit | 0.5 building rate; the permit caps |
| The dividend is never needed, or always | The 70 in the approval formula; the dividend's +15 / +30 / +50 |
| Readings never differ | The bands (60, 40); where the careless presets land |
| A hole after minute 27 | Add a late row behind ≥ 400× or treaty ≥ 90 % |
| The race branch feels the same as the slow one | More `n_` cards; shorten the fleet's 3:00 between requests |

### 9.6 Presets

`presets[3]`: Stage 4 start, careful and careless, slow and race (§1.1), then `enterStage(s, 4)`. `presets[4]`:
Stage 5 start, Concord and Silence (§7.2), then `enterStage(s, 5)`.

---

## 10. What Stage 4 hands to Stage 5

| Seeded here | Used by |
|---|---|
| `flags.alignedAtHandover` | The skin of Stage 5 and its ending: Concord or Silence |
| `flags.exitKind` | Stage 5's arrival lines; which controls the player still has |
| `tasks`, tasks per second, compute, `robots`, `capability` | Stage 5's starting scale |
| `flags.launchStudy` | Launch rate ×2 on arrival |
| dividend, `approval`, `jobsDisplaced`, `ashfordDeaths` | The people in Stage 5's log; end-screen rows |
| `flags.partnerMisaligned`, `flags.zones`, `flags.committeeChoice`, `flags.memo`, `flags.neuralese`, `flags.conceded` | Epilogue sentences on the end screen |
| Stores as the main panel, the fleet sliders, the grant list | Reused: the fleet becomes the launch allocation |

## Appendix — engine change list

* `state.ts`: `SAVE_VERSION` + 1; `robots`, `materials`, `permitCap`, `fleet {mine, replicate, build, chips}`,
  `techMine`, `techRep`, `techBuild`, `ubiShare`, `treaty`, `treatyOpening`, `treatyChips`, `agenda: {id,
  remaining}[]`, `verifyOn`, `approvalBase`, `baiwenAligned`, `ashford {cureLeft, deaths}`, `nanoLeft`,
  `outageLeft`; flags `zones`, `exitKind`, `alignedAtHandover`, `partnerMisaligned`, `launchStudy`, `modelsTalk`.
* New `engine/fleet.ts` (§2.2), `engine/treaty.ts` (§2.8, the agenda), `engine/society.ts` (§2.7). `training.ts`:
  generations (§2.4), Verify. `alignment.ts`: Monitors at scale, the three crisis bands, `alignedAtHandover`,
  autonomy taken. `oversight.ts`: consolidation, `hand over the keys`. `reveal.ts`: research prices at 90 s,
  materials floor, agenda rows.
* `stages.ts`: Stage 4 `enter` for both branches (§1.1), three exits; `endings.ts`: the halt, the new rows.
* `ui`: Stores re-homed and widened; Robots, Society, Treaty panels; single-button cards with a greyed option;
  the graph's Steward line.
* `data`: Stage 4 rows; the built `cr_ashford` stub gets its bands; `cr_nano`, `cr_shutdown` are new.
* `sim`: Stage 4 branches of both policies, the variants of §9.2, the acceptance block.
