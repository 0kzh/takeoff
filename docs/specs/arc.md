# Takeoff — the arc (cross-stage contract)

Every stage spec (`docs/specs/stageN.md`) must satisfy this document. Precedence when documents disagree:
`docs/original-prompt.md` > this file > the stage spec > `docs/handoff.md` > `docs/design.md` / `docs/stages.md`.
Numbers for Stages 4–5 are targets for the later specs to hit, not tuned values. Stage 2 and Stage 3 numbers come
from `docs/specs/stage2.md`, `docs/specs/stage3.md` and 1-second paper models of them; they must be re-verified in
`npm run sim`.

## Amendments after critic round 2 (Stage 1: Takeoff 8.1, Paperclips 7.7)

The round-2 critic's headline finding has no rubric row: *nothing Stage 1 asks the player to decide changes
Stage 1*. Ten play styles ended within 31–35 minutes in the same state. The changes below make that testable.

1. §6 gains **G16–G23**: decisions decide; stakes on the button; goals, not a conveyor belt; a text budget; modals
   never block input; the promised number moves first; levers reach the income; walls repeat and nothing is dead.
2. §7 "every stage ships" gains the decision-variant block.
3. §2, §4 and §8 are updated from `stage4.md` and `stage5.md`: scale at the last two boundaries, the exact
   `alignedAtHandover` inputs, the four end screens. The rule of §4 itself is unchanged.
4. `stage3.md` is patched to the new guardrails (its own amendment list says where).

## Amendments after the Stage 2 critic (Takeoff 7.4, Paperclips 6.7)

Stage 2 won on cadence and lost the two rows that ask what the player's hands and eyes are doing: from the
Standing order to the gate there was nothing to press and no way to spend toward the thing being waited for.

1. §6 gains **G24–G33** ("hands and eyes"), with the critic's measures as thresholds, and G23's repeat interval
   becomes 180 s. G17 now covers standing switches (Focus, Verify, goal selectors), not only modal options.
2. §7 "every stage ships" gains the hands block; every stage spec opens with a section **What the player's hands do**.
3. §8's rule about the model taking verbs away gains its other half: each removal hands over a heavier lever.
4. `stage3.md`, `stage4.md` and `stage5.md` are patched to these; each lists its changes at the top.

## Amendments after owner feedback 1 (`user-feedback-1.md`)

The owner played the build of 2026-10-04. Where a note of theirs and a critic-driven rule disagree, the note wins.

1. **Stage 1 opens one mechanic at a time:** the manual verb, then a GPU, then power, then price, then Marketing
   (`user-feedback-1.md` (a)). G3, G5, G10 and G14 are amended in §6.
2. **No undertrained runs, anywhere.** A run needs N GPUs (a function of capability, set per stage) or `Train` is
   disabled and says why. The yield mechanic and `Train now` are withdrawn. Those GPUs are busy while it trains.
3. **Stage 1 ends with one purchase, `First Datacenter`.** The Abilene ladder, its rungs, panel and countdown are
   gone. Stage 1 targets 20–26 minutes at 240 s a month, with about five runs.
4. **Capacities are meters** (`｢￭￭￭･･｣`, one style everywhere), and a row with a meter shows one number. GPUs
   cannot be bought into no power or no room; the rows say that GPUs need power.
5. The Pause needs a lead of 1 month, not 2 (the built Stage 2 ends at 1.4; `stage3.md`, as-built deltas).

## Amendments after the Stage 1 round-3 critic (`stage1-round3-fixes.md`)

1. **What a run costs changes once a stage, and is said each time.** Stage 1: dollars and GPUs (research buys
   cards only). Stage 2: dollars, research and data, and GPUs. Stage 3: research, and GPUs. Stage 4: nothing.
2. **The run first.** While a run lacks only its dollars, other dollar purchases keep its price in hand and say
   so; the same for a card a wall names. Built for Stage 2's lots; Stage 1 takes it for every dollar button.
3. First Datacenter appears at the third release, prints its price in minutes of income and a meter of the
   cloud's GPUs; cards wait until they cannot be paid for at once; events queue behind the player's progress
   and list their default first.

## 1. Requirements checklist

Every feature in the original prompt, the stage that delivers it, and the mechanic. "S2" = Stage 2, etc.

| # | Requirement (original prompt) | Stage | Delivered by |
|---|---|---|---|
| R1 | Universal Paperclips look and structure; A Dark Room log and modals; raw HTML/CSS + vanilla TS | all | Built. `styles.css`, console, three columns, `panel-log`, `modalOverlay` |
| R2 | Starts with one button; things revealed over time; player does not know where it goes or when it ends | all | `state.revealed` flags; no stage number, no end date, no progress bar to the ending; exit projects never name the next stage |
| R3 | Core loop: gather resources → train → release → revenue → build datacenters, mine resources, hire | S1–S2 | S1 tasks/funds/GPUs/researchers; S2 datacenters, power plants, data (the web crawl is the mine), teams as projects; S4 robots mine materials; S5 asteroids |
| R4 | Five stages planned like the UP wiki Stages page | all | `docs/stages.md` kept in sync with each stage spec |
| R5 | AI-2027-style graph of relative intelligence against benchmarks (human, researcher, …) | S2 | `panel-graph` canvas at the first Stage 2 release: capability in × on a log scale, rungs `1× human researcher`, `1.5× reliable agent`, `4× superhuman coder`, then 10×/25×/250×/1,000× as each is approached; IQ gloss in the tooltip |
| R6 | Resources panel "very similar to A Dark Room" | S2 | `panel-stores` on Stage 2 arrival: bordered box, one row per stock, hover shows income by source with a bold total. Rows are added late in S2 (chips on order), in S3 (monitors), S4 (robots, materials; `funds` leaves) and S5 (launch mass, orbital GPUs); see §2D |
| R7 | Log of developments that updates with progress and actions (ADR, Plague Inc.) | S1+ | `panel-log`; every stage ≥ 1 line per 2 min; player choices logged in italics |
| R8 | Opportunities presented as choices | S1+ | Choice modals, at most nine per stage (G15): S1 as built, S2 ×9 (`stage2.md` §5), S3 ×9 (`stage3.md` §5: neuralese, the memo, the vote, …), S4 autonomy / UBI vs SEZ / treaty, S5 final |
| R9 | Fictitious names in the AI-2027 manner | all | OpenMind, Anthrosoft (Cadence-N), Baiwen (Lanzhou CDZ), Sage-N / Steward-N / Concord-1, Nimbus G4–G7, Formosa Fab, the Oversight Committee, the Project, Al-Marsa Compute Park, the Ashford strain, Atlas-class |
| R10 | Geopolitics with China and Iran | S2–S4 | S2 Baiwen nationalised, lead line on the graph, Gulf site choice sets `gulfExposure`; S3 weights theft, Taiwan blockade, Iran strikes Al-Marsa; S4 Verify Baiwen, treaty |
| R11 | "The only number that matters is Tasks Completed" | all | `h2#tasksHeader` is always the first thing under the console; milestone lines report it; every ending prints it; in Silence it keeps rising |
| R12 | Mid-2025 to the end of the world or the treaty, five stages, 3–4 hours | all | §2 |
| R13 | Complete tasks → revenue → compute → copies → tasks | S1–S3 | S1 UP market; S2 market where revenue = 0.25·√(market × supply), so compute always pays; S3 the same until the business panel leaves |
| R14 | Training and releasing a model is the loop repeated many times | S1–S4 | 38–43 runs per game: S1 ≈ 5, S2 9–12, S3 13–16, S4 8–12 (automatic) |
| R15 | Start training the next model before the previous is deployed, after a threshold | S2 | `p_parallel` Parallel pipelines; threshold = 4 Stage 2 releases and capability ≥ 2.2× |
| R16 | Training never takes more than 1–2 minutes | all | Engine clamp: S1–S2 45–120 s, S3 30–60 s, S4 a status line |
| R17 | Show the carrot: reveal on trigger, not affordability; a greyed-out goal always on screen | all | Guardrail G3; fallback lines `#nextTrust` (S1–S2) and `#nextTier` (S2+) |
| R18 | Always something to work toward; the bottleneck is always addressable | all | §5; each bottleneck console line names the fix |
| R19 | UI reshuffles between stages | all | §2 table C: each transition removes ≥ 1 panel and adds ≥ 1 |
| R20 | Engineered crises: AI hacking, engineered pandemic, nanobots, robots shutting down all datacenters | S3–S4 | S3 `cr_rogue_copy` (AI hacking: rogue copies above 5 % of the fleet); S4 `cr_ashford`, `cr_nano`, `cr_shutdown`, each resolving in one of three bands of true alignment (`stage4.md` §5.3). Also S2 curtailment, protest, theft warning; S3 theft, the spy, riots, sabotage, Taiwan, Iran, the leak |
| R21 | Economy with changing bottlenecks | all | §5 |
| R22 | Interpretability and neuralese | S3 | Interpretability lab I–V (level 3 puts true alignment on screen); `c_neuralese`: neuralese vs thoughts kept in English; honeypots, the noise test, the checkpoint test |
| R23 | A stats panel that pops in later | S2 | `p_dashboard` → `panel-stats`, minute ≈ 26 of Stage 2 (first item of the approach) |
| R24 | Job displacement, public riots | S2–S4 | S2 `jobsDisplaced`, approval, the Austin protest; S3 riots and sabotage at approval < −40; S4 Society panel |
| R25 | Government relationship | S2–S4 | S2 `panel-government` (hearing, policy team, defense contract); S3 the Oversight Committee; S4 nationalisation-proofing |
| R26 | Branching endings: aligned prosperity, AI kills everyone, nationalised (and the treaty) | S3–S5 | §4: Concord, Silence, The Project, The Pause |
| R27 | End-of-run stats screen | all endings | `endingScreen` (exists); each stage adds its rows to `endStats()` |
| R28 | Old generations as monitors | S3–S4 | S3 `Deploy Sage-2 as monitor` on arrival, the Monitors slider (`monitorShare`), `Deploy Sage-3 as monitor` at 10×; S4 Monitors at scale |
| R29 | Humanoid robots | S4 | Atlas robot factories, Robots panel, robot-built datacenters |
| R30 | Going to space; orbital compute and datacenters | S5 | Launch capacity, orbital datacenters, lunar solar, Dyson swarm |
| R31 | Universal basic income | S4 | Society panel: UBI (approval +40 over 2 min, costs output) |
| R32 | Human researchers start as the best source of R&D and decay to irrelevance | S1–S3 | S1 only source; S2 allocation slider, `Human share of research` 100 % → < 1 %, `humanEff = min(1, 3/capability)`, Hire Researcher still works and does almost nothing; S3 the button is removed on arrival and the share line is removed when it rounds to 0.0 % |
| R33 | Critic loop after each stage; dev overlay rewinds to each stage | all | Each stage ships preset N (its start) and preset N+1 (the next start) and a sim acceptance block. Critic pairs: S1↔UP 1, S2↔UP 2, S3↔UP 2 late, S4–S5↔UP 3 |
| R34 | Save/load | all | Unchanged design; `SAVE_VERSION` bumps with each stage; `migrate()` fills new fields |
| R35 | Game Dev Story build → debug → review → sell loop | S1+ | Training panel: train → evaluate (4 cards) → red-team → release; S2 adds data and compute requirements |

Nothing in the original prompt is unplaced.

## 2. Stage targets

### A. Time, entry, exit

| | 1 The Startup | 2 Scale | 3 Takeoff | 4 Superintelligence | 5 Beyond |
|---|---|---|---|---|---|
| Wall clock | 20–26 min | 35–45 min | 40–50 min | 30–40 min | 20–30 min |
| Dates | Jul–Dec 2025 | Jan–Dec 2026 | Jan–Oct 2027 | Nov 2027–Dec 2028 | 2029–2030+ |
| Seconds per month | 240 | 210 | 270 | 150 | 90 |
| Entry | new game | buy `First Datacenter` | buy `Let Sage-3 write the code` | Committee choice made at ≥ 25× | treaty signed, or autonomy granted/taken |
| Exit project (visible, greyed, ≥ 8 min early) | First Datacenter | Let Sage-3 write the code — needs a released 4.00× model | Slow down (Steward) / Race (Sage-5) — needs 25× | Sign the Concord treaty / Grant the fleet autonomy | The long reflection / Final instructions |
| Training runs | ≈ 5 | 9–12 (naive 7–9) | 13–16 (naive 8–11) | 9–11, automatic, with a Verify toggle | automatic, one line in Stats |
| UP stage the critic compares | Stage 1 | Stage 2 (power management) | Stage 2, late | Stage 3 | Stage 3 |

Total 145–195 min of play; 3–4 h with reading. The date never passes the stage's end month + 2 before the exit.

### B. Scale at each boundary (for presets; ± a factor of 2 is fine after S2)

S1→S2 is the built Stage 1 (`npm run sim`); S2→S3 is the Stage 2 paper model re-run from that arrival
(`stage2.md` §9.4); S3→S4 is the Stage 3 paper model (`stage3.md` §9.4). Dollar figures are real dollars on screen.

| | new game | S1→S2 | S2→S3 | S3→S4 | S4→S5 | ending |
|---|---|---|---|---|---|---|
| Capability | 1.0× | 1.5–1.8× | 4.0–4.6× | 25–30× | 300–1,000× | ≈ 10⁴× (the graph is retired there) |
| Model | Sage-1 | Sage-1.6 | Sage-3 | Sage-4.7; the next is Sage-5 or Steward-1 | Sage-7 / Steward-3; Concord-1 enforces the treaty | — |
| Tasks per second | 0 | ≈ 500 rented, ≈ 9,000 a second later | ≈ 1 × 10⁸ | ≈ 10¹⁰ | 2–9 × 10¹³ | ≈ 10¹⁸ |
| Tasks Completed | 0 | 0.4–0.55 × 10⁶ | 3–7 × 10¹⁰ | 4–6 × 10¹² | 0.4–1.6 × 10¹⁶ | ≈ 10²⁰ |
| Revenue | 0 | $0.7–1.1k/s, of which contracts $0.3–0.8k | $1.0–1.5M/s | $120–140M/s, then removed | — | — |
| Funds on hand | 0 | the returned deposit: one GPU lot | $10–60M | $30–60B, then removed | — | — |
| Price per task | $0.25 | $0.75–0.90 | ≈ $0.01 | — | — | — |
| Compute | 0 | 90–115 rented GPUs → 1,000 owned | 0.8–1.25M owned GPUs (G4 + G5) | ≈ 4M (3M of them G6) | ≈ 4 × 10⁹ GPU-equivalents, robot-built | orbital, ≈ 10¹² |
| Power | 1,000 kWh blocks | 5 MW on site | 1.0–1.6 GW | ≈ 4 GW | ≈ 4 TW | the swarm, 0.01 % of the Sun |
| Copies running | 0 | 110–180 | ≈ 10⁷ | ≈ 3 × 10⁸ | ≈ 10¹¹ | — |
| Research per second | 0 | 250–340 (all human) | 50–100k (0.3–0.6 % human) | ≈ 30M (no human share shown) | — | — |
| Jobs displaced | 0 | 0 | 2.6–4.2M | 30–65M | 0.8–1.0B | — |

### C. The reshuffle at each transition

| Transition | Added | Removed | What the player loses | Affordable on arrival |
|---|---|---|---|---|
| S1→S2 | Stores, Infrastructure (GPU lots, datacenters, plants), pricing AUTO; later Graph, Security, Government, Public, Stats | Power (kWh) line, Buy Power, Grid Contract, Compute panel (Rent GPU), the Contracts line, the cloud-credit rescue | Renting; buying power by the block; hand-set prices (AUTO is on, can be switched off); new custom contracts (the signed ones keep paying); Stage-1-only projects are retired by name | `Buy GPUs (1,000)`, paid by the returned deposit |
| S2→S3 | Alignment (measured alignment, autonomy grants, `Lost to value drift`); the Monitors slider; later Geopolitics, Oversight (in place of Government); Stores rows `monitors`, `rogue copies` | Marketing, Hire Researcher, Expand Lab, Researchers / Lab Space lines, price buttons, `+1 Trust at`, Stores rows `trust` and `data`, the research cap, gas and solar buttons, Release / Keep internal (one `Approve`) | Hiring; marketing; Trust as a currency; then, by the player's own grants, Train, Red-team, Approve and the Infrastructure buttons. The human share line stays until it rounds to zero | `Deploy Sage-2 as monitor` (free) |
| S3→S4 | Robots (the fleet's sliders); Stores as the main panel with `materials`, `robots`; then Society (the dividend), Treaty, the Committee's agenda | Business panel, Training panel (one status line), Infrastructure, Complete Task, Stores rows `funds` and `chips on order`, Focus, Approve / Send back / Hold | Money; the Train button; the manual verb. "The model runs the business now." On the race branch, the second button on some cards | `Convert a car plant` (free) |
| S4→S5 | Space (the launch split, missions); Stores rows `launch mass`, `orbital GPUs`, later `matter`, `swarm`, `probes` | Treaty, Oversight, Society, Security, Alignment, Robots (its sliders become the launch sliders), the allocation, the grant list | Earth as the subject of the screen; in Silence, later, the sliders and the second button | `Launch contracts` (free) |

Every transition follows §7.

### D. Stores rows by stage (the A Dark Room panel)

| Stage | Rows, in order | Notes |
|---|---|---|
| 1 | — | Stage 1 keeps the Universal Paperclips layout; no Stores box |
| 2 | funds · research · insight · trust · GPUs · power · copies · data · (late) chips on order | Existing value spans move into the box, so nothing is shown twice |
| 3 | + monitors · rogue copies (once any exist); − trust · − data | Research loses its cap |
| 4 | − funds · − chips on order · + materials · robots · (late) treaty chips | The box becomes the main panel, centre column |
| 5 | + launch mass · matter · orbital GPUs · swarm · mercury · people off Earth · probes; − research · insight · monitors · rogue copies | Earth rows stay, greyed, under the legend `earth` |

Every row has a hover listing sources and sinks per second with a bold total. A negative total is how the player finds
a consumption chain (ADR), and no other text explains it.

## 3. Persistent variables

Where each cross-stage variable starts, everything that moves it, and what it gates. Magnitudes for S3–S5 are budgets for those specs.

| Variable | Range | Introduced → shown | Moved by | Gates |
|---|---|---|---|---|
| `capability` (deployed), `training.internalCapability` | × | S1 Training; S2 graph | Training runs only | Stage exits (4×, 25×, 1,000×); market size; per-copy rate; `humanEff`; jobs; crisis thresholds |
| `alignmentApparent` | 0–100 | S1 bookkeeping → S2 Stats `Alignment (as measured)` → S3 panel | + Safety run 8, red-team to zero 1, Publish the Spec 6, system card 3, month of evals 2, each release with Share evals on 1; − Honesty evals 4 (they find things), incident 2 | Safety Institute card; S2 advisory incident (< 55 at ≥ 3×); S3 Committee mood |
| `alignmentTrue` | 0–100, hidden until interpretability ≥ 3 | S1 | + Safety run 5, Alignment team 3, month of evals 4, Honesty evals 3, Spec 2; S3 interpretability level 3 each, monitors ≥ 15 % 1 per run, transparent CoT 5, report the memo 5, Steward 25; S4 each verified Steward generation 5, Monitors at scale 15. − capability run 2 (3 with neuralese) once ≥ 2×, efficiency run 0.5, each open issue shipped 1, synthetic-heavy run 2, Retire human code review 2, neuralese 15, Race 10, bury the memo 5, unsigned auto-train run 1 | Drift rate; rogue-copy crisis (< 50, S3); **the ending branch** (§4) |
| `interpretability` | 0–5 | S3 | labs I–V bought, − 2 under neuralese | Reveals `alignmentTrue` at ≥ 3; monitor efficacy; Monitors at scale needs ≥ 3; drift is zero at ≥ 4 with monitors ≥ 15 % |
| `securityLevel` | SL1–SL5 | S2 `p_sl2` | Projects (S2: SL2, SL3; S3: SL4, SL5) | S3, scripted: the weights are stolen in Feb 2027 if SL < 3; a spy costs lead in Jun 2027 if SL < 4; SL5 puts the government in the building (+gov, −lead, order threshold −10) |
| `govRelations` | 0–100, start 50 | S2 hearing → `panel-government` | S2 list in `stage2.md` §2.8; S3 share evals +, lobby +, bury memo −, leak −; S4 proofing | S2: defense offer ≥ 40, nuclear discount ≥ 60, subpoena < 30. S3: treaty talks and the Pause ≥ 60. Nationalisation < 20 (< 35 with `defenseContract`) at ≥ 10×. S4: proofing ≥ 70 |
| `approval` | −100…+100, start 0 | S2 `panel-public` | − jobs, gas plants, incidents, mini release, Gulf, defense, leak; + free tier, job fund, community agreement, pact, cures, UBI | S2 protest ≤ −20, riot ≤ −40; S3 riots and sabotage < −40; S4 treaty impossible < −60 |
| `jobsDisplaced` | millions, never falls | S2 `panel-public` | `0.12·√(tasks/s ÷ 10⁶)·(capability/2)^1.5`, saturating at the world workforce (3,400M) | Approval; developments; S4 UBI appears at ≥ 40M |
| `lead` (over Baiwen) | months | S2 graph legend → S3 Geopolitics | S2 list in `stage2.md` §2.7; S3 theft sets it to ≤ 0, Slow down −4, SL4/5 +, neuralese + | S3: the Pause needs ≥ 1 (was 2; the built Stage 2 ends at 1.4); treaty terms; race pressure events at < 0.5 |
| `gulfExposure` | 0/1 | S2 `c_gulf` | The choice | S3 Iran strike: Al-Marsa's 1,000 MW and 10 % of compute are lost |
| `flags.defenseContract` | bool | S2 `c_defense` | The choice | Raises the nationalisation threshold from gov < 20 to gov < 35; revenue floor |
| `flags.internalReleases` | count | S2 | Each internal-only release | Leak severity in S3 (approval and gov hit × (1 + 0.25 n)) |
| `flags.whistleblowRisk` | 0–3 | S2 `c_evals_month`, `p_retention` | Choices | S3: probability a buried memo leaks = 0.4 + 0.1 n |
| `flags.pactSigned` | bool | S2 `c_pact` | The choice | S3–S4 treaty talks start 20 % complete; breaking it by racing costs approval 10 |
| `flags.memo`, `flags.committeeChoice`, `flags.neuralese` | enum | S3 | Choices | Endings (§4) |
| `autonomy` | 0–100 | S2 seed (+5 from Retire human code review) → S3 | Auto-train, autonomous research, robot-fleet autonomy, SEZs, AI negotiator | Drift `autonomy^1.2 × 10⁻⁴ × (1 − alignmentTrue/100)` per minute; seizure at ≥ 80 with `alignmentTrue` < 40 |
| `monitorShare` | 0–40 % of compute | S3 | Slider / projects | Incidents; drift recapture; ending guarantee |
| `trust` | integer | S1 | Milestones, releases, rounds; spent on hires, lab space, SL3, policy team | Retired on entering S3: each unspent Trust becomes +2 government relations (at most +10). The Committee's seats (`floor(govRelations / 10)`) take its place |
| `flags.publicCap` | × | S3 arrival (the last public model) | `c_mini` only | Jobs displaced and, through them, approval |
| `majorIncidents` | 0–3 | S3 Oversight panel, from 9× | Rogue breakout, sabotage, the leak; at most one per 240 s; reset by a conceded or bought-off order | Three opens `c_order` |
| `flags.g6Preorder`, `flags.site2` | bool | S2 approach | Projects | S3 head start against the Taiwan blockade and the Abilene power ceiling |
| `alignShare` (alignment compute) | 1 / 5 / 10 % of copies | S2 approach (`btn-alignShare`) | Player | Per run: apparent +0.5 / +1, true +1 / +2 at 5 % / 10 %; becomes S3's monitor and alignment share (up to 40 %) |
| `shareEvals`, `jobFund` | toggles | S2 Government / Public panels | Player | Share evals: per release gov +1, apparent +1, lead −0.1; S3 Committee mood. Job fund: 2 % of revenue for approval +10; S4 UBI replaces it |

**No ending before Stage 3.** Ending conditions are evaluated only when `stage ≥ 3`. On entering Stage 3 the engine clamps
`alignmentTrue` to [30, 75], `govRelations` to [25, 85], `approval` to [−45, +30] and `lead` to [1, 9]. Stage 2 therefore
moves the starting point, never the outcome: a careless Stage 2 (true alignment ≈ 32) can still reach Concord through
Steward (+25) and four interpretability levels (+12); a careful one (≈ 66) can survive the Race branch.

## 4. Endings (exact conditions)

Checked in this order every tick once `stage ≥ 3`; the first true one ends the run and shows `endingScreen`.

| Ending | Flag | Fires when | Mitigations (all visible before the trigger) |
|---|---|---|---|
| **The Project** (nationalised), S3 or S4 | `nationalized` | S3: every route goes through the modal `The Committee drafts an order` (`stage3.md` §2.11), which opens at ≥ 10× when (a) `govRelations` is below the threshold (20; 35 with `defenseContract`; 10 lower at SL5), (b) three major incidents have been counted (rogue breakout, sabotage, the leak), or (c) a buried memo leaks with `govRelations` < 50. The first order can be answered with a free concession, the second with $5B. The ending fires only when an order is refused, or a third is drawn up, and its 1:30 runs out with the cause unfixed. (d) S4: refuse consolidation with `govRelations` < 40 | Policy team, Brief the administration, Share evals, SL5, Report the memo, Nationalisation-proofing |
| **The Pause** (halt treaty), S3 or S4 | `pauseSigned` | Player picks it: (a) S3 `Sign the Pause`, offered 45 s into the Committee's session when the memo was reported, `govRelations` ≥ 60 and `lead` ≥ 1; (b) S4 `Sign a halt instead`, pinned from treaty progress ≥ 50 % with `approval` ≥ −60 | It is a choice, never forced |
| **Concord** (aligned prosperity), S5 | `longReflection` | Stage 5 reached with `alignedAtHandover`, then the project `The long reflection` | — |
| **Silence** (misaligned), S5 | `finalInstructions` | Stage 5 reached without `alignedAtHandover` (autonomy granted, or taken when `autonomy` ≥ 80 and `alignmentTrue` < 40, or a treaty signed by a misaligned model); the log stops mentioning people; `Final instructions` arrives with one button | Everything that raises `alignmentTrue`; Monitors at scale is the last exit |

`alignedAtHandover` is computed once, at the Stage 4 exit (treaty signed, fleet granted, or fleet taken):
`alignmentTrue ≥ 60`, or (`alignmentTrue ≥ 40` and `interpretability ≥ 4` and `monitorShare ≥ 0.15`), where
`interpretability` is labs bought less 2 under neuralese and `monitorShare` is the Monitors slider (floor 0.15 after a
conceded order, 0.40 after Monitors at scale). It alone picks Stage 5's skin and ending; the exit kind and Baiwen's
alignment only change sentences on the end screen. Between 40 and 60 the monitors decide it; that is the engineered
guarantee the player can build toward (UP's OODA line).

Texture: The Pause sets tasks per second to zero and returns `Complete Task` as the only button on screen. Silence keeps
the counter running after the last human-authored choice. Every ending prints the stats table: tasks, peak tasks/s, time
played, date reached, generations trained, releases, incidents, crises survived, lead, approval, jobs displaced, humans in
research at the end, true alignment, and the choice history with dates.

## 5. Bottleneck rotation

The resource that binds, in order, and the fix that is on screen when it binds.

| Stage | Binding resource, in order | Always-visible fix |
|---|---|---|
| 1 | power (kWh) → funds → demand → compute → research cap (cards) → money for the next run → GPUs (First Datacenter) | Buy Power / Grid Contract; lower the price, Marketing; Rent GPU; Hire, Expand Lab; the levers on income; First Datacenter |
| 2 | supply vs market (price falls) → power (MW) → research rate → datacenter room → data → market again → power again → training compute → funds | Agent platform, release; gas / solar / nuclear / Gulf; AI research assistants + slider; Build Datacenter; crawl → licences → synthetic → flywheel; International, Sage-mini; Build + Buy GPUs; all of the above |
| 3 | research (the model does it) → funds, for the first eight minutes only → **alignment you cannot see** (drift, rogue copies) → lead → chips (Taiwan) → power (Iran, if Gulf) → government → approval | The allocation, autonomy grants; datacenters and reactors; monitors, interpretability, Re-image; security levels; stockpile, second source; reactors; share evals, lobby, the conceded order; impact payments, clinics |
| 4 | robots → materials → approval (jobs) → treaty progress → monitor compute | Atlas factories; robot mines; UBI, cures; Verify Baiwen; Monitors at scale |
| 5 | launch capacity → orbital compute → matter | Launch contracts; orbital datacenters; asteroid mining |

Rule: when a bottleneck console line prints, the named fix must already be visible (greyed or not). A fix that costs the
resource it fixes is not a fix (research-cap projects cost funds; power rescues do not need power).

## 6. Pacing guardrails (testable in the sim; apply to every stage)

"First-time reveal" = a `revealed` flag turning true, a project becoming visible for the first time, or a choice id
opening for the first time. Carried-over projects do not count. A "beat" is a 5-second window.

| # | Rule | Threshold | Measured by |
|---|---|---|---|
| G1 | No hole between first-time reveals | ≤ 180 s, from arrival to exit, last 10 min included | Sim: `LONGEST REVEAL GAP` per stage |
| G2 | A new panel or mechanic (a new verb, toggle, slider, Stores row or instrument line) | about every 4 min; never more than 270 s (360 s in Stage 5, which must not promise more than it has) | Sim: gaps between `REVEAL` events of kind panel/button/toggle/slider/row |
| G3 | A greyed-out goal is on screen | ≥ 99 % of ticks, counted from the first purchase; ≥ 2 distinct greyed goals throughout the last 10 min of a stage. In Stage 1's first three minutes the next unit of the newest mechanic (a GPU, a power block) counts, lit or grey (owner feedback 1) | Sim: visible unaffordable projects and buttons; `#nextTrust` / `#nextTier` count as one |
| G4 | No chore | No verb pressed more than twice in any 60 s once its automation exists; automation offered within 8 presses or 4 min | Sim: per-verb press log |
| G5 | No disclosure spike | ≤ 8 new on-screen numbers and ≤ 3 new interactive elements in any beat. Stage 1's first five minutes: one mechanic a beat, ≤ 4 new numbers and ≤ 2 new controls, beats ≥ 30 s apart after the first GPU (owner feedback 1) | Engine: the reveal scheduler (15 s between projects); Playwright snapshot diff |
| G6 | Every wait is named | A console line with the name and the time left within 2 s of the wait starting | Unit test per timer |
| G7 | Every transition is narrated | ≥ 3 console lines over ~6 s saying what was lost, what replaced it and what the new number means; previous 4 lines kept; ≥ 1 affordable action | Sim + Playwright at each preset |
| G8 | Every resource that can hit zero has a rescue | Rescue reachable within 60 s without the missing resource | `stageN.md` soft-lock table; sim "worst choice" seeds |
| G9 | Training never exceeds two minutes | 120 s hard clamp | Engine assert |
| G10 | First meaningful choice after arrival | ≤ 90 s. A new game: ≤ 120 s (naive ≤ 150 s), because the opening teaches one thing at a time (owner feedback 1) | Sim: first tick with ≥ 2 affordable non-ambient actions competing for one resource, or a modal |
| G11 | The exit goal is visible early | ≥ 8 min before it is reachable | Sim: exit project `shown` time vs exit time |
| G12 | Idle rescues | ≤ 1 per stage for the reasonable bot | Sim counter |
| G13 | No wall is carried across a transition | Next training run affordable in cap terms; Trust ≥ 0; ≥ 1 affordable action | `enter()` pre-flight |
| G14 | On-screen load | ≤ 65 numbers and ≤ 30 interactive elements outside the log and console, and within 25 % of the critic's count for the matching UP stage. A new game: ≤ 1 / 4 / 6 / 11 / 17 / 22 numbers at 0:00 / 0:30 / 1:00 / 2:00 / 3:00 / 5:00. A row with a meter shows one number (owner feedback 1) | Playwright count at 5-min marks |
| G16 | Decisions decide | Every framed choice axis of a stage (each modal, each standing switch or slider, each grant taken or refused) moves the stage's length by ≥ 3 min, or moves an exit variable a later stage reads by a stated margin: true alignment ≥ 8, lead ≥ 1 month, relations ≥ 10, approval ≥ 10, or a branch or ending flag | Sim variants on seeds 1–3, each the reasonable bot with one thing changed (`--variant modals-first`, `modals-last`, `modals-never`, one per switch extreme). The stage spec lists its axes and the spread expected. An axis that fails is cut or stops being framed as a choice |
| G17 | Stakes on the button | A standing switch (Focus, Verify, a goal selector) prints its trade under its buttons the same way. Each modal option is two lines: its label, then every visible effect and cost in numbers. Nothing a decision needs is only in a tooltip. A greyed option says what it needs. A funds or research stake is sized when the modal opens: at least 90 s of income, or a quarter of the dearest goal on screen. A hidden variable's stake is a sentence, never its number | Playwright reads the option text; unit test on the sizing |
| G18 | Goals, not a conveyor belt | Median time from a project's first appearance to its purchase ≥ 90 s for the reasonable bot; ≤ 20 % bought within 10 s; nothing refunds its own price. Engine backstop: at reveal a price is raised to 90 s of its currency's current rate when the list price is lower; a prerequisite gates the purchase, not the appearance | Sim: reveal → purchase table; `FLOOR` lines on ≤ 30 % of rows |
| G19 | Text budget | ≤ 260 words on screen outside the console and log (≤ 200 in Stage 1); ≤ 2.5 console lines and ≤ 1.5 Developments lines a minute over any five minutes; one flavour line per training run; a console line carries a number, a name or an instruction; ≤ 14 first-time reveals in any six minutes; projects drip 30 s apart for the first five minutes of a stage | Playwright word count at 5-min marks; sim line counter |
| G20 | Modals never block input | A modal is a card docked in the page. Everything behind it stays clickable, focus moves into it, Escape or its timer takes the stated default, and one without a timer can be left open | Playwright clicks a button behind an open modal |
| G21 | The promised number moves first | Each transition's narration names one number. Within 30 s of arrival it has moved as promised, no console line contradicts it, and routine console lines are held for 10 s so the narration stays on screen | Sim and Playwright at each preset |
| G22 | Levers reach the income | After the first five minutes of a stage at least 70 % of income (of the score rate, once money is gone) responds to levers the stage has taught. Any quota or ceiling shows `x / cap` from the first unit | Sim: income by source at 5-min marks |
| G23 | Walls repeat, rescues diagnose, nothing is dead | A wall or warning line re-arms every 180 s while it holds (see G31). The idle rescue names the cause before it offers help and never offers less than the cheapest thing on screen. No line reads "none" and no card sits unaffordable for more than 10 min for the reasonable bot, hazard counters and the stage goal excepted | Sim: wall-line log; dead-line scan |
| G24 | Something to buy | After the first 3 minutes of a stage, at most 50 % of 2-second checks find no enabled purchase (Stage 2 as built: 85–88 %; Paperclips: 1 %) | Harness: the first-timer policy samples every enabled, affordable control each 2 s (`explore-sN.mjs baseline`, seeds 1–3). Sim: the same count from `noveltyKeys`, in the stage block |
| G25 | A choice of purchases | Two or more distinct affordable things in at least 25 % of checks (Stage 2: 4–5 %; Paperclips: 97 %) | Same samples; "distinct" = different controls with different printed returns |
| G26 | Hands stay busy | After the first 10 minutes, at most 35 % of the time lies inside stretches of 30 s or more without a click (Stage 2: 63–69 %; Paperclips: 28 %). The number the stage's goal is stated in moves at least every 5:30 | Harness click log; sim press log for the reasonable bot; sim: intervals between changes of the goal number |
| G27 | Sinks print their return | Every repeatable purchase, slider and standing switch prints, beside the control and not in a hover, what one more unit or one more notch returns, and what it costs in the thing being waited for. Each stage has at least two repeatable, player-steered sinks enabled at all times, drawing on one resource, so their returns compete | Playwright: text beside every repeatable control; sim: list of enabled repeatables at each 5-min mark |
| G28 | A removal hands over a heavier lever | When a grant, a transition or the model removes a control, a control one level up (a budget, a target, a goal) appears in the same beat. The only exception is the Silence skin's last three minutes | Sim logs `REMOVED <ids> → GAINED <ids>` for every removal; an empty right side fails |
| G29 | No dead grey, no dead advice | No control is greyed in 100 % of a stage's checks (hide it instead). A console line never names a verb that is not on screen and enabled or one purchase away. No line prints more than six times a stage or twice in 3 minutes | Sim: enabled share per control; a console linter over the stage's lines |
| G30 | Meters bite | Every meter on screen has at least one consequence the player can see in each of its bands, inside the stage where it appears, and the band edges are printed in its panel (`−30: permits slow · −40: riots`) | The stage spec's meter table; sim: each band's consequence fires in at least one variant |
| G31 | Walls repeat and point | A wall line repeats every 180 s while the wall holds and names the card or control that answers it. A card that answers a standing wall, or without which the stage cannot proceed, is drawn in the `urgent` style from its first appearance | Sim wall log; Playwright class check |
| G32 | Nothing changes silently | No number on screen changes at a transition, a clamp, an exit or a grant without a console line that gives the old and the new value | Sim: visible numbers before and after each `enterStage`, clamp and grant, against the narration |
| G33 | Thresholds are generous | A result within 3 % below a threshold the screen names (a rung, a gate, a ceiling) is rounded up to it | Unit test on each named threshold |
| G15 | Modals are rationed | ≤ 9 per stage; unprompted modals ≥ 150 s apart (one that comes due inside the window waits); a modal the player opens with their own click is exempt from the spacing; the idle rescue is outside the budget | The built pacer (`cadence.lastModalAt`); sim count per stage |

The **cadence governor** enforces G1: if no first-time reveal has happened for 150 s, the engine reveals the next item
of the stage's ordered content table whose hard prerequisites hold, ignoring its trigger. Each stage reserves ≥ 10 "late"
items that cannot appear before the approach to the exit, each behind its own progress threshold (Stage 2:
capability 3.0–3.9×; Stage 3: 14–22×), so the tail cannot run dry and a slow player cannot spend the reserve early. Governor pulls are logged; more
than 4 per stage for the reasonable bot means the triggers need retuning.

### Why Stage 1 lost, and the standing answer

| Rubric item | Stage 1 lost because | Rules that answer it in every stage |
|---|---|---|
| Time to first meaningful choice | The first lever (price) gave no reason to pull it | G10; each stage opens with one free action and a real choice inside 90 s |
| Seconds with nothing to do | An 852 s tail with a single $250k goal | G1, G11, the governor, reserved late items, an exit that is a visible project |
| Cognitive load, progressive disclosure | Two panels in one beat; three unexplained buttons; 97 numbers by the end | G5, G14; projects drip 15 s apart; Stores collects stocks; a control arrives with a console line saying what it does |
| Cadence of reveals | Six panels in 5.6 min, then none for 20–29 min | G2; panels are spread across the stage, not front-loaded |
| Greyed-out goal on screen | Fine (99.8 %), but one goal for 14 min | G3 with two goals in the tail |
| Clarity of the transition | Console wiped; un-bought projects vanished; nothing affordable on arrival | G7, G13, §7 |
| Soft-locks | Main verb disabled without a reason; rescue fired on a player who had not played; a wall carried into Stage 2 | G8, G13; every disabled button shows an inline reason |
| Chore (secondary gap 1) | 367 Buy Power presses | G4; lots scale with the fleet and automation arrives after eight presses |

## 7. Transition contract

1. **Exit is a project** the player buys (`pinned`, so it skips the drip and the visible cap); it is revealed greyed ≥ 8 min early and its price tag states the requirement.
   From Stage 2, if it sits affordable for 240 s the model presses it (`Sage-3 has started without waiting to be asked.`).
   Stage 3's Committee choice is exempt: the player always casts that vote.
2. **Pre-flight** in `enter()`: research cap ≥ the next training cost; no negative stocks; the first action of
   the new stage is affordable; date snaps to the stage's first month; earlier stages' unfired developments and
   modals are dropped.
3. **Narration**: keep the last four console lines; queue 3–5 lines 2 s apart (lost / replaced / what the new number
   means / what to click); one Developments entry.
4. **Re-base, don't reset**: currencies carry over, and income never falls across a boundary. Each stage spec states
   its funds prices at scale 1 and multiplies them by one constant measured from the arrival revenue
   (`S2_FUNDS_SCALE = R0 / 650`, `S3_FUNDS_SCALE = R0 / 1,200,000`), so retuning one stage does not unbalance the next.
5. **Retire by name**: projects that cannot be bought any more are listed in one console line.
6. **Presets**: each stage adds `presets[N+1]` built from the sim's median exit state, so the next stage and the critic
   can start from it.

Every stage ships, before its critic round:

* its spec's content table (ids, costs, triggers, prerequisites, late flags) in `src/data`, in table order;
* the sim's stage block: duration, runs, `LONGEST REVEAL GAP`, governor pulls, press counts, 5-minute marks, for the
  reasonable bot and the naive policy on seeds 1–5, from a new game and from the stage preset;
* the two presets (its own start, the next stage's start) and a dev-overlay button for each;
* the decision-variant block (G16): one sim variant per framed axis, with its spread on seeds 1–3;
* the hands block (G24–G29): share of checks with nothing to buy, with two things to buy, time in 30-s click
  gaps, goal-number intervals, the removal log and the console linter's report;
* its rows in `endStats()`, its `SAVE_VERSION` bump and `migrate()` defaults;
* updated `docs/stages.md` and `README.md`; ids in earlier stages unchanged.

## 8. Stage sketches for the later specs

Constraints, not designs. Each later spec turns its column into a content table and a reveal timeline like Stage 2's.
All three columns are now specified (`stage3.md`, `stage4.md`, `stage5.md`); where this table and those files differ,
the files win. The main differences: Stage 4 has no money, so its prices are materials, half a generation of
research, or the Committee's time; its exits are the treaty, the fleet granted, or the fleet taken; Stage 5's
projects are missions that cost only time, and its last project is not marked as the last.

| | 3 Takeoff | 4 Superintelligence | 5 Beyond |
|---|---|---|---|
| What the stage is | A race with a hidden variable. Revenue stops binding within ten minutes; the graph and the lead are what the player watches | A negotiation the player may not be party to. No money; Stores is the main panel | Space. The same panels in two skins: people busy and well in the log, or people no longer mentioned |
| New verbs | Approve, Send back, Hold, Re-image; three-way allocation: tasks / research / monitors; autonomy grants; Report or Bury; the vote | Build robots; assign robots to datacenters, plants, mines; UBI; verify; sign; grant or withhold autonomy | Launch; build in orbit; start the swarm |
| Requirement rows delivered | R10 (theft, Taiwan, Iran), R20 (AI hacking), R22, R24 (riots), R25 (Committee), R26 (The Project, The Pause), R28 | R20 (pandemic, nanobots, datacenter shutdown), R24, R26, R28 (at scale), R29, R31 | R26 (Concord, Silence), R27, R30 |
| Scripted beats (date or progress, whichever first) | Feb 2027 weights theft if SL < 3 · Mar neuralese offered · Apr or 7× the Committee is seated · 10× Sage-4, "a country of geniuses" · Jun the spy if SL < 4 · Jul the mini and approval −8; Iran strikes Al-Marsa if `gulfExposure` · Aug or 14× the Taiwan blockade · Sep or 14× the memo · 22× the Committee goes into session · the leak if buried · 25× the vote | Nov 2027 parity scare · Jan 2028 the first factory builds a factory · SEZs · unemployment and the cheque · the two models talk · the treaty text | Launch contracts · first orbital datacenter · lunar solar · swarm at 0.001 % · probes |
| Training | 13–16 runs of 30–60 s; Auto-train (`Continual learning`) offered 15 s after arrival; `Stop asking for sign-off` after eight approvals | One status line; generations arrive on their own; human sign-off is a toggle that costs lead | None |
| Late items reserved for the approach | `stage3.md` §4.2 rows 41–55: the memo; three tests of the hidden number; outside researchers or coming clean; lock shared memory; keep Sage-3 warm; lab V; the session; the Pause offer; the swing votes; Hold; the Defense Production Act; the leak; the vote | Treaty terms; the verification result; the autonomy request; the last human sign-off; the crisis that tests alignment | The long reflection or Final instructions; the last log lines |
| Exit project | `Slow down — the Steward program` or `Race — Sage-5`, both pinned and greyed from 12× | `Sign the Concord treaty` or `Grant the fleet autonomy` (taken, if the model can) | `The long reflection` / `Final instructions` |
| Reads from earlier stages | `gulfExposure`, `securityLevel`, `lead`, `internalReleases`, `whistleblowRisk`, `pactSigned`, `defenseContract`, `g6Preorder`, `site2`, `alignShare`, the alignment gap | `committeeChoice`, `neuralese`, `interpretability`, `monitorShare`, `autonomy`, `approval`, `jobsDisplaced`, `govRelations` | `alignedAtHandover`, `treatySigned` |
| Its dead-tail risk | 14× → 25× and the wait for the vote; answered by capability-gated late items and a session that opens at 22× | The treaty's last 20 % | The swarm counter |
| Removes (see §2C) | Marketing, hiring, price buttons, Trust, data; by grants: Train, Red-team, Approve, the Infrastructure buttons | Business, Training, Complete Task, `funds` | Geopolitics, Robots, Society |

Three rules the sketches share:

* The model takes one more verb away in each stage (pricing in S2, hiring and training in S3, money and the task button
  in S4, everything in S5), and each removal is narrated as in §7. Each removal also hands the player a heavier
  lever in the same beat (G28): a budget where there was a button, a target where there was a slider, a goal where
  there was a split. Paperclips trades clip-making for drone balancing and then for probe design; a stage whose
  answer to "what do the hands do" is "wait for the next automatic run" fails, however many reveals arrive.
* What is hidden stays hidden until the player builds the instrument: `alignmentTrue` is never shown before
  interpretability 3, and the log never says which branch the run is on.
* Every crisis has a mitigation that was visible, greyed or not, at least five minutes before the crisis could fire.
