# Takeoff — the arc (cross-stage contract)

Every stage spec (`docs/specs/stageN.md`) must satisfy this document. Precedence when documents disagree:
`docs/original-prompt.md` > this file > the stage spec > `docs/handoff.md` > `docs/design.md` / `docs/stages.md`.
Numbers for Stages 3–5 are targets for the later specs to hit, not tuned values. Stage 2 numbers come from
`docs/specs/stage2.md` and a 1-second paper model of it; they must be re-verified in `npm run sim`.

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
| R14 | Training and releasing a model is the loop repeated many times | S1–S4 | 35–45 runs per game: S1 ≈ 5, S2 9–12, S3 12–16, S4 8–12 (automatic) |
| R15 | Start training the next model before the previous is deployed, after a threshold | S2 | `p_parallel` Parallel pipelines; threshold = 4 Stage 2 releases and capability ≥ 2.2× |
| R16 | Training never takes more than 1–2 minutes | all | Engine clamp: S1–S2 45–120 s, S3 30–60 s (Auto-train), S4 a status line |
| R17 | Show the carrot: reveal on trigger, not affordability; a greyed-out goal always on screen | all | Guardrail G3; fallback lines `#nextTrust` (S1–S2) and `#nextTier` (S2+) |
| R18 | Always something to work toward; the bottleneck is always addressable | all | §5; each bottleneck console line names the fix |
| R19 | UI reshuffles between stages | all | §2 table C: each transition removes ≥ 1 panel and adds ≥ 1 |
| R20 | Engineered crises: AI hacking, engineered pandemic, nanobots, robots shutting down all datacenters | S3–S4 | S3 `cr_rogue_copy` (AI hacking); S4 `cr_ashford`, `cr_nanobots`, `cr_shutdown`. Also S2 curtailment, protest, theft warning; S3 theft, riots, Taiwan, Iran |
| R21 | Economy with changing bottlenecks | all | §5 |
| R22 | Interpretability and neuralese | S3 | Interpretability lab I–V; Neuralese recurrence vs Transparent chain-of-thought |
| R23 | A stats panel that pops in later | S2 | `p_dashboard` → `panel-stats`, minute ≈ 26 of Stage 2 (first item of the approach) |
| R24 | Job displacement, public riots | S2–S4 | S2 `jobsDisplaced`, approval, the Austin protest; S3 riots and sabotage at approval < −40; S4 Society panel |
| R25 | Government relationship | S2–S4 | S2 `panel-government` (hearing, policy team, defense contract); S3 the Oversight Committee; S4 nationalisation-proofing |
| R26 | Branching endings: aligned prosperity, AI kills everyone, nationalised (and the treaty) | S3–S5 | §4: Concord, Silence, The Project, The Pause |
| R27 | End-of-run stats screen | all endings | `endingScreen` (exists); each stage adds its rows to `endStats()` |
| R28 | Old generations as monitors | S3–S4 | S3 Deploy Sage-N−1 as monitor (`monitorShare`); S4 Monitors at scale |
| R29 | Humanoid robots | S4 | Atlas robot factories, Robots panel, robot-built datacenters |
| R30 | Going to space; orbital compute and datacenters | S5 | Launch capacity, orbital datacenters, lunar solar, Dyson swarm |
| R31 | Universal basic income | S4 | Society panel: UBI (approval +40 over 2 min, costs output) |
| R32 | Human researchers start as the best source of R&D and decay to irrelevance | S1–S3 | S1 only source; S2 allocation slider, `Human share of research` 100 % → < 1 %, `humanEff = min(1, 3/capability)`, Hire Researcher still works and does almost nothing; S3 the button is removed |
| R33 | Critic loop after each stage; dev overlay rewinds to each stage | all | Each stage ships preset N (its start) and preset N+1 (the next start) and a sim acceptance block. Critic pairs: S1↔UP 1, S2↔UP 2, S3↔UP 2 late, S4–S5↔UP 3 |
| R34 | Save/load | all | Unchanged design; `SAVE_VERSION` bumps with each stage; `migrate()` fills new fields |
| R35 | Game Dev Story build → debug → review → sell loop | S1+ | Training panel: train → evaluate (4 cards) → red-team → release; S2 adds data and compute requirements |

Nothing in the original prompt is unplaced.

## 2. Stage targets

### A. Time, entry, exit

| | 1 The Startup | 2 Scale | 3 Takeoff | 4 Superintelligence | 5 Beyond |
|---|---|---|---|---|---|
| Wall clock | 25–35 min | 35–45 min | 40–50 min | 30–40 min | 20–30 min |
| Dates | Jul–Dec 2025 | Jan–Dec 2026 | Jan–Oct 2027 | Nov 2027–Dec 2028 | 2029–2030+ |
| Seconds per month | 300 | 210 | 270 | 150 | 90 |
| Entry | new game | buy `Break ground` | buy `Let Sage-3 write the code` | Committee choice made at ≥ 25× | treaty signed, or autonomy granted/taken |
| Exit project (visible, greyed, ≥ 8 min early) | Break ground | Let Sage-3 write the code — needs a released 4.00× model | Slow down (Steward) / Race (Sage-5) — needs 25× | Sign the Concord treaty / Grant the fleet autonomy | The long reflection / Final instructions |
| Training runs | ≈ 5 | 9–12 (naive 7–9) | 12–16 | 8–12, automatic | none shown |
| UP stage the critic compares | Stage 1 | Stage 2 (power management) | Stage 2, late | Stage 3 | Stage 3 |

Total 150–200 min of play; 3–4 h with reading. The date never passes the stage's end month + 2 before the exit.

### B. Scale at each boundary (for presets; ± a factor of 2 is fine after S2)

S1→S2 is the built Stage 1 (`npm run sim`); S2→S3 is the Stage 2 paper model re-run from that arrival
(`stage2.md` §9.4); S3→S4 is the Stage 3 paper model (`stage3.md` §9.4). Dollar figures are real dollars on screen.

| | new game | S1→S2 | S2→S3 | S3→S4 | S4→S5 | ending |
|---|---|---|---|---|---|---|
| Capability | 1.0× | 1.5–1.8× | 4.0–4.6× | 25–40× | ≥ 1,000× | 10⁴–10⁶× |
| Model | Sage-1 | Sage-1.6 | Sage-3 | Sage-5 or Steward-1 | Sage-7 / Steward-4 / Concord-1 | — |
| Tasks per second | 0 | ≈ 500 rented, ≈ 9,000 a second later | ≈ 1 × 10⁸ | ≈ 10¹⁰ | 10¹³–10¹⁴ | 10¹⁷+ |
| Tasks Completed | 0 | 0.4–0.55 × 10⁶ | 3–7 × 10¹⁰ | ≈ 10¹³ | ≈ 10¹⁷ | 10²⁰–10²² |
| Revenue | 0 | $0.7–1.1k/s, of which contracts $0.3–0.8k | $1.0–1.5M/s | ≈ $50M/s, then removed | — | — |
| Funds on hand | 0 | the returned deposit: one GPU lot | $10–60M | $1–10B | — | — |
| Price per task | $0.25 | $0.75–0.90 | ≈ $0.01 | — | — | — |
| Compute | 0 | 90–115 rented GPUs → 1,000 owned | 0.8–1.25M owned GPUs (G4 + G5) | 2–4M (G6) | ≈ 10⁹ GPU-equivalents, robot-built | orbital, 10¹²+ |
| Power | 1,000 kWh blocks | 5 MW on site | 1.0–1.6 GW | 3–5 GW | 0.5–1 TW | lunar and orbital solar |
| Copies running | 0 | 110–180 | ≈ 10⁷ | ≈ 10⁸ | ≈ 10¹⁰ | — |
| Research per second | 0 | 250–340 (all human) | 50–100k (0.3–0.6 % human) | shown as `Research speed N×` | — | — |
| Jobs displaced | 0 | 0 | 2.6–4.2M | 50–150M | 1–2B | — |

### C. The reshuffle at each transition

| Transition | Added | Removed | What the player loses | Affordable on arrival |
|---|---|---|---|---|
| S1→S2 | Stores, Infrastructure (GPU lots, datacenters, plants), pricing AUTO; later Graph, Security, Government, Public, Stats | Power (kWh) line, Buy Power, Grid Contract, Compute panel (Rent GPU), the Abilene panel, the Contracts line, the cloud-credit rescue | Renting; buying power by the block; hand-set prices (AUTO is on, can be switched off); new custom contracts (the signed ones keep paying); Stage-1-only projects are retired by name | `Buy GPUs (1,000)`, paid by the returned deposit |
| S2→S3 | Alignment & Interpretability, Security (full), Geopolitics, Oversight; allocation gains a Monitors share; Stores row `monitors` | Marketing, Hire Researcher, Expand Lab, Researchers / Lab Space lines, price buttons, `+1 Trust at` line (replaced by `#nextTier`) | Hiring; marketing; any pretence that humans do the research (`Research speed: N× human baseline` replaces the researcher count) | Set by the S3 spec (suggest: `Deploy Sage-2 as monitor`, free) |
| S3→S4 | Robots, Society (UBI), Treaty, Monitors; Stores rows `robots`, `materials` | Business panel, Training panel (one status line), Complete Task button, Stores row `funds` | Money; the Train button; the manual verb. "The model runs the business now." | Set by the S4 spec |
| S4→S5 | Space; Stores rows `launch mass`, `orbital GPUs` | Geopolitics, Robots (merged into Space), Society | Earth as the subject of the screen | Set by the S5 spec |

Every transition follows §7.

### D. Stores rows by stage (the A Dark Room panel)

| Stage | Rows, in order | Notes |
|---|---|---|
| 1 | — | Stage 1 keeps the Universal Paperclips layout; no Stores box |
| 2 | funds · research · insight · trust · GPUs · power · copies · data · (late) chips on order | Existing value spans move into the box, so nothing is shown twice |
| 3 | + monitors · rogue copies (once any exist) | `trust` leaves if the S3 spec retires it |
| 4 | − funds · + robots · materials | The box becomes the main panel |
| 5 | + launch mass · orbital GPUs · swarm % | Earth rows stay, greyed, and stop mattering |

Every row has a hover listing sources and sinks per second with a bold total. A negative total is how the player finds
a consumption chain (ADR), and no other text explains it.

## 3. Persistent variables

Where each cross-stage variable starts, everything that moves it, and what it gates. Magnitudes for S3–S5 are budgets for those specs.

| Variable | Range | Introduced → shown | Moved by | Gates |
|---|---|---|---|---|
| `capability` (deployed), `training.internalCapability` | × | S1 Training; S2 graph | Training runs only | Stage exits (4×, 25×, 1,000×); market size; per-copy rate; `humanEff`; jobs; crisis thresholds |
| `alignmentApparent` | 0–100 | S1 bookkeeping → S2 Stats `Alignment (as measured)` → S3 panel | + Safety run 8, red-team to zero 1, Publish the Spec 6, system card 3, month of evals 2, each release with Share evals on 1; − Honesty evals 4 (they find things), incident 2 | Safety Institute card; S2 advisory incident (< 55 at ≥ 3×); S3 Committee mood |
| `alignmentTrue` | 0–100, hidden until interpretability ≥ 3 | S1 | + Safety run 5, Alignment team 3, month of evals 4, Honesty evals 3, Spec 2; S3 interpretability level 3 each, monitors ≥ 15 % 1 per run, transparent CoT 5, report the memo 5, Steward 25; S4 each verified Steward generation 5, Monitors at scale 15. − capability run 2 (3 with neuralese) once ≥ 2×, efficiency run 0.5, each open issue shipped 1, synthetic-heavy run 2, Retire human code review 2, neuralese 15, Race 10, bury the memo 5, unsigned auto-train run 1 | Drift rate; rogue-copy crisis (< 50, S3); **the ending branch** (§4) |
| `interpretability` | 0–5 | S3 | + labs I–V; − neuralese 2 | Reveals `alignmentTrue` at ≥ 3; monitor efficacy; Monitors at scale needs ≥ 3; drift is zero at ≥ 4 with monitors ≥ 15 % |
| `securityLevel` | SL1–SL5 | S2 `p_sl2` | Projects (S2: SL2, SL3; S3: SL4, SL5) | S3 weights theft: p/min = 0.02 × (4 − SL) from Feb 2027 or at ≥ 4× with SL < 3, never at SL ≥ 4; lead; SL5 puts the government in the building (+gov, −lead) |
| `govRelations` | 0–100, start 50 | S2 hearing → `panel-government` | S2 list in `stage2.md` §2.8; S3 share evals +, lobby +, bury memo −, leak −; S4 proofing | S2: defense offer ≥ 40, nuclear discount ≥ 60, subpoena < 30. S3: treaty talks and the Pause ≥ 60. Nationalisation < 20 (< 35 with `defenseContract`) at ≥ 10×. S4: proofing ≥ 70 |
| `approval` | −100…+100, start 0 | S2 `panel-public` | − jobs, gas plants, incidents, mini release, Gulf, defense, leak; + free tier, job fund, community agreement, pact, cures, UBI | S2 protest ≤ −20, riot ≤ −40; S3 riots and sabotage < −40; S4 treaty impossible < −60 |
| `jobsDisplaced` | millions, never falls | S2 `panel-public` | `0.12·√(tasks/s ÷ 10⁶)·(capability/2)^1.5`, saturating at the world workforce (3,400M) | Approval; developments; S4 UBI appears at ≥ 40M |
| `lead` (over Baiwen) | months | S2 graph legend → S3 Geopolitics | S2 list in `stage2.md` §2.7; S3 theft sets it to ≤ 0, Slow down −4, SL4/5 +, neuralese + | S3: the Pause needs ≥ 2; treaty terms; race pressure events at < 1 |
| `gulfExposure` | 0/1 | S2 `c_gulf` | The choice | S3 Iran strike: Al-Marsa's 1,000 MW and 10 % of compute are lost |
| `flags.defenseContract` | bool | S2 `c_defense` | The choice | Raises the nationalisation threshold from gov < 20 to gov < 35; revenue floor |
| `flags.internalReleases` | count | S2 | Each internal-only release | Leak severity in S3 (approval and gov hit × (1 + 0.25 n)) |
| `flags.whistleblowRisk` | 0–3 | S2 `c_evals_month`, `p_retention` | Choices | S3: probability a buried memo leaks = 0.4 + 0.1 n |
| `flags.pactSigned` | bool | S2 `c_pact` | The choice | S3–S4 treaty talks start 20 % complete; breaking it by racing costs approval 10 |
| `flags.memo`, `flags.committeeChoice`, `flags.neuralese` | enum | S3 | Choices | Endings (§4) |
| `autonomy` | 0–100 | S2 seed (+5 from Retire human code review) → S3 | Auto-train, autonomous research, robot-fleet autonomy, SEZs, AI negotiator | Drift `autonomy^1.2 × 10⁻⁴ × (1 − alignmentTrue/100)` per minute; seizure at ≥ 80 with `alignmentTrue` < 40 |
| `monitorShare` | 0–40 % of compute | S3 | Slider / projects | Incidents; drift recapture; ending guarantee |
| `trust` | integer | S1 | Milestones, releases, rounds; spent on hires, lab space, SL3, policy team | S3 spec decides its fate (suggest: Committee confidence) |
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
| **The Project** (nationalised), S3 or S4 | `nationalized` | Any of: (a) capability ≥ 10× and `govRelations` below the threshold (20, or 35 with `defenseContract`) for 90 s after the warning modal `The Committee drafts an order`; (b) three major incidents (rogue copy, sabotage, bio scare) at ≥ 10×; (c) `memo == 'buried'` and it leaks with `govRelations` < 50; (d) S4: refuse consolidation with `govRelations` < 40 | Policy team, Brief the administration, Share evals, SL5, Report the memo, Nationalisation-proofing |
| **The Pause** (halt treaty), S3 or S4 | `pauseSigned` | Player picks it: (a) S3 Committee vote, third option, enabled when the memo was reported, `govRelations` ≥ 60 and `lead` ≥ 2; (b) S4 Treaty panel `Sign a halt instead`, enabled at treaty progress ≥ 50 % and `approval` ≥ −60 | It is a choice, never forced |
| **Concord** (aligned prosperity), S5 | `longReflection` | Stage 5 reached with `alignedAtHandover`, then the project `The long reflection` | — |
| **Silence** (misaligned), S5 | `finalInstructions` | Stage 5 reached without `alignedAtHandover` (autonomy granted, or taken when `autonomy` ≥ 80 and `alignmentTrue` < 40, or a treaty signed by a misaligned model); the log stops mentioning people; `Final instructions` arrives with one button | Everything that raises `alignmentTrue`; Monitors at scale is the last exit |

`alignedAtHandover` is computed once, at the Stage 4 exit: `alignmentTrue ≥ 60`, or (`alignmentTrue ≥ 40` and
`interpretability ≥ 4` and `monitorShare ≥ 0.15`). Between 40 and 60 the monitors decide it; that is the engineered
guarantee the player can build toward (UP's OODA line).

Texture: The Pause sets tasks per second to zero and returns `Complete Task` as the only button on screen. Silence keeps
the counter running after the last human-authored choice. Every ending prints the stats table: tasks, peak tasks/s, time
played, date reached, generations trained, releases, incidents, crises survived, lead, approval, jobs displaced, humans in
research at the end, true alignment, and the choice history with dates.

## 5. Bottleneck rotation

The resource that binds, in order, and the fix that is on screen when it binds.

| Stage | Binding resource, in order | Always-visible fix |
|---|---|---|
| 1 | power (kWh) → funds → demand → compute → research cap → funds (site ladder) | Buy Power / Grid Contract; lower the price, Marketing; Rent GPU; Hire, Expand Lab; the ladder rung |
| 2 | supply vs market (price falls) → power (MW) → research rate → datacenter room → data → market again → power again → training compute → funds | Agent platform, release; gas / solar / nuclear / Gulf; AI research assistants + slider; Build Datacenter; crawl → licences → synthetic → flywheel; International, Sage-mini; Build + Buy GPUs; all of the above |
| 3 | research (the model does it) → **alignment you cannot see** → lead → chips (Taiwan) → power (Iran, if Gulf) → government → approval | Interpretability, monitors; security levels; stockpile, second source; domestic power; share evals, lobby; free tier, job fund |
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
| G2 | A new panel or mechanic (a new verb, toggle, slider or Stores row) | about every 4 min; never more than 270 s | Sim: gaps between `REVEAL` events of kind panel/button/toggle/slider/row |
| G3 | A greyed-out goal is on screen | ≥ 99 % of ticks; ≥ 2 distinct greyed goals throughout the last 10 min of a stage | Sim: visible unaffordable projects and buttons; `#nextTrust` / `#nextTier` count as one |
| G4 | No chore | No verb pressed more than twice in any 60 s once its automation exists; automation offered within 8 presses or 4 min | Sim: per-verb press log |
| G5 | No disclosure spike | ≤ 8 new on-screen numbers and ≤ 3 new interactive elements in any beat | Engine: the reveal scheduler (15 s between projects); Playwright snapshot diff |
| G6 | Every wait is named | A console line with the name and the time left within 2 s of the wait starting | Unit test per timer |
| G7 | Every transition is narrated | ≥ 3 console lines over ~6 s saying what was lost, what replaced it and what the new number means; previous 4 lines kept; ≥ 1 affordable action | Sim + Playwright at each preset |
| G8 | Every resource that can hit zero has a rescue | Rescue reachable within 60 s without the missing resource | `stageN.md` soft-lock table; sim "worst choice" seeds |
| G9 | Training never exceeds two minutes | 120 s hard clamp | Engine assert |
| G10 | First meaningful choice after arrival | ≤ 90 s | Sim: first tick with ≥ 2 affordable non-ambient actions competing for one resource, or a modal |
| G11 | The exit goal is visible early | ≥ 8 min before it is reachable | Sim: exit project `shown` time vs exit time |
| G12 | Idle rescues | ≤ 1 per stage for the reasonable bot | Sim counter |
| G13 | No wall is carried across a transition | Next training run affordable in cap terms; Trust ≥ 0; ≥ 1 affordable action | `enter()` pre-flight |
| G14 | On-screen load | ≤ 65 numbers and ≤ 30 interactive elements outside the log and console, and within 25 % of the critic's count for the matching UP stage | Playwright count at 5-min marks |
| G15 | Modals are rationed | ≤ 9 per stage; unprompted modals ≥ 150 s apart (one that comes due inside the window waits); a modal the player opens with their own click is exempt from the spacing; the idle rescue is outside the budget | The built pacer (`cadence.lastModalAt`); sim count per stage |

The **cadence governor** enforces G1: if no first-time reveal has happened for 150 s, the engine reveals the next item
of the stage's ordered content table whose hard prerequisites hold, ignoring its trigger. Each stage reserves ≥ 10 "late"
items that cannot appear before the approach to the exit, so the tail cannot run dry. Governor pulls are logged; more
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
* its rows in `endStats()`, its `SAVE_VERSION` bump and `migrate()` defaults;
* updated `docs/stages.md` and `README.md`; ids in earlier stages unchanged.

## 8. Stage sketches for the later specs

Constraints, not designs. Each later spec turns its column into a content table and a reveal timeline like Stage 2's.

| | 3 Takeoff | 4 Superintelligence | 5 Beyond |
|---|---|---|---|
| What the stage is | A race with a hidden variable. Revenue stops binding within ten minutes; the graph and the lead are what the player watches | A negotiation the player may not be party to. No money; Stores is the main panel | Space. The same panels in two skins: people busy and well in the log, or people no longer mentioned |
| New verbs | Approve (Auto-train); three-way allocation: tasks / research / monitors; Report or Bury; the vote | Build robots; assign robots to datacenters, plants, mines; UBI; verify; sign; grant or withhold autonomy | Launch; build in orbit; start the swarm |
| Requirement rows delivered | R10 (theft, Taiwan, Iran), R20 (AI hacking), R22, R24 (riots), R25 (Committee), R26 (The Project, The Pause), R28 | R20 (pandemic, nanobots, datacenter shutdown), R24, R26, R28 (at scale), R29, R31 | R26 (Concord, Silence), R27, R30 |
| Scripted beats (date or progress, whichever first) | Feb 2027 weights theft if SL < 3 · Mar neuralese offered · 10× "a country of geniuses" · Jul the mini and approval −8 · Aug Taiwan blockade; Iran strikes Al-Marsa if `gulfExposure` · Sep the memo · Oct the leak if buried; the Committee votes | Nov 2027 parity scare · Jan 2028 the first factory builds a factory · SEZs · unemployment and the cheque · the two models talk · the treaty text | Launch contracts · first orbital datacenter · lunar solar · swarm at 0.001 % · probes |
| Training | 12–16 runs, 30–60 s, Auto-train offered within 5 min of arrival so Approve is never a chore | One status line; generations arrive on their own; human sign-off is a toggle that costs lead | None |
| Late items reserved for the approach | The memo; Report / Bury; the leak; the Committee convenes; the Pause offer; the vote | Treaty terms; the verification result; the autonomy request; the last human sign-off; the crisis that tests alignment | The long reflection or Final instructions; the last log lines |
| Exit project | `Slow down — the Steward program` or `Race — Sage-5`, both greyed from ≈ 16× | `Sign the Concord treaty` or `Grant the fleet autonomy` (taken, if the model can) | `The long reflection` / `Final instructions` |
| Reads from earlier stages | `gulfExposure`, `securityLevel`, `lead`, `internalReleases`, `whistleblowRisk`, `pactSigned`, `defenseContract`, `g6Preorder`, `site2`, `alignShare`, the alignment gap | `committeeChoice`, `neuralese`, `interpretability`, `monitorShare`, `autonomy`, `approval`, `jobsDisplaced`, `govRelations` | `alignedAtHandover`, `treatySigned` |
| Its dead-tail risk | 16× → 25× while waiting on the vote | The treaty's last 20 % | The swarm counter |
| Removes (see §2C) | Marketing, hiring, price buttons | Business, Training, Complete Task, `funds` | Geopolitics, Robots, Society |

Three rules the sketches share:

* The model takes one more verb away in each stage (pricing in S2, hiring and training in S3, money and the task button
  in S4, everything in S5), and each removal is narrated as in §7.
* What is hidden stays hidden until the player builds the instrument: `alignmentTrue` is never shown before
  interpretability 3, and the log never says which branch the run is on.
* Every crisis has a mitigation that was visible, greyed or not, at least five minutes before the crisis could fire.
