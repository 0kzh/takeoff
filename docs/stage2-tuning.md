# Stage 2 tuning log

Measured with the headless bot (`npm run sim -- --seed N --minutes 60 --quiet`), which prints a `== Stage 2 ==` block: stage length, the end state at the Automate the Lab purchase, run starts, reveals, modals, buys and idle gaps. The bot never pauses to read, so a human run is expected to be about 1.3× longer.

## Current constants (initial values, see stage2-plan.md §11)

| Knob | Value | Where |
|---|---|---|
| Compute needed per run | `1,000 × (c/1.8)^4.0` effective GPUs, ÷ chip multiplier (G4 1×, G5 4×, G6 16×) | `training.ts` `S2_GPU_EXPONENT` |
| Funds per run | `$200k × (c/1.8)^3.2` | `S2_FUNDS_EXPONENT` |
| Run duration | `clamp(50 + 12 × runsThisStage, 50, 110)` s | `S2_RUN_*` |
| Gain per run | capability 0.14 + 0.03·(rng+rng); efficiency 0.10; safety 0.10; +0.03 RL envs, +0.04 continuous, +0.15/+0.30 compute request; × √(data coverage) | `S2_FOCUS_BASE`, `startRun` |
| Reach (demand grows with the fleet) | `max(1, (servingCompute/1000)^0.35)` | `economy.ts` `ADOPTION_EXPONENT` |
| GPU price | $100 per G4 (×3 G5, ×10 G6), ×1.05 per batch bought; batch 1,000 (10,000 after Hyperscale) | `CHIP_PRICE`, `GPU_BATCH_GROWTH` |
| Datacenter | $250k × 2.2^n; room 10k (×10 after Hyperscale) | `datacenterCost`, `dcRoom` |
| Grid tier | $100 per kW of the next tier (×0.7 with the PPA) | `GRID_COST_PER_KW_S2` |
| Security | $5M × 8^(level−1); theft odds 90/50/25/10%; research −3% per level | `securityCost`, `theftOdds` |
| Data | 20T on the public web at 1T/min; need `10T × (c/1.8)^1.4`; licensing $500k doubling for +15T; synthetic `√(idle copies / 10,000)` T/min | `data.ts` |
| Insight in Stage 2 | +12 per public release; Sage research × 0.01 per second once Sage writes the code; human research as before only at the cap | `economy.ts`, `training.ts` |
| Alignment drift | `−6 × log10(c_new/c_old) × (0.5 + tempo/100) × (1 − coverage)`; bias jump 30% × race factor per doubling | `alignment.ts` |
| Rivals | Anthrosoft rubber band 0.85–1.15× ours, own growth ×1.08–1.18 per release, capped at 1.3× ours unless the lab has not released for 10 min; Baiwen enters Jun 2026 at 0.35×, target 0.6×, theft → 0.85×; distillation +3% to rivals still behind | `rivals.ts`, `events.ts` |
| Gate | Automate the Lab: shown at 5×, buyable at 10× for 30k research, 150 insight, 180 s of revenue | `projects-stage2.ts` |

## Results (2026-10-08, bot policy)

| Seed | Stage 1 end | Stage 2 length | Runs | Longest run gap | Longest reveal/modal gap | Idle gaps > 60 s | End: capability / rivals / approval / alignment |
|---|---|---|---|---|---|---|---|
| 1 | 15:31 | 23:15 | 14 | 2:33 | 1:57 | none | 10.6× / Anthrosoft 6.2, Baiwen 8.3 / 69 / 59 ± 21 |
| 2 | 16:56 | 30:26 | 13 | 7:39 (the last run before the gate) | 2:30 | none | 10.0× / 7.8, 7.5 / 83 / 64 ± 9 |
| 3 | 19:04 | 21:02 | 14 | 2:29 | — | none | 10× class / behind / 73 / 57 ± 27 |

Other policies, seed 1: `naive` reaches the gate in 23:27 of stage time at 11.5× (15 runs, took customer data and growth capital, approval 71); `greedy` in 20:20 at 11.6× (15 runs, theft detected and traced, approval 72). Neither shows an idle gap over 60 s.

A reckless variant (`--variant reckless`: deflects the hearing, uses customer data, ships unrestricted bio, ignores the protest, buys no safety or security projects) reaches the gate in 24:45 at 10.7× with approval 34, tempo 85, security SL2 and a 61 ± 30 band over a true value of 51; the protest, the ultimatum and the emergency vote all fire within the next five minutes.

Modals seen in order (seed 1, stage time): Release decision 6:49 · Mega-round 10:28 · Senate hearing 12:59 · Data wall 15:29 · Sage-mini 17:59 · Weight theft 21:31 · Bio red line 24:02 · Defense partnership 26:32 · Sage asks for compute 29:02. Protest and the ultimatum did not fire for the careful bot (approval stayed above 45); both are covered by unit tests.

Panels revealed (seed 1, stage time): Infrastructure 0:00 · Data row 1:00 · Race graph 1:40 · Synthetic data 3:27 · Reach 4:46 · Research share 5:40 · Jobs 12:32 · Alignment strip 12:43 · Public + Government 12:59 · Dangerous evals 13:23 · Tempo 17:30 · Security row 18:07.

## History

- Round 1: reach exponent 0.5 and compute exponent 3.3 made the stage too rich: runs every 90 s, 45× before the gate, revenue $20M/s, insight starving the gate (300 needed). Release modals reset the modal spacing and starved the hearing and data wall until minute 20. Synthetic data exploded with 30M idle copies. Theft fired the second Baiwen appeared.
- Round 2: reach 0.35, compute 3.8, funds 3.0, insight from Sage research and +12 per release, synthetic √-scaled, theft 150 s after Baiwen, player modals exempt from spacing. Stage 24 min, approval climbed to 100, thefts still before security.
- Round 3: compute 4.2 → 4.0, GPU price $100 and ×1.05, approval drain 1/min (0.3 covered), deploy +1, Security Office urgent on Baiwen's arrival, theft 240 s after Baiwen and retries only at SL1 after 300 s.
- Round 4: rivals capped at 1.3× ours unless the lab stalls; distillation +3% only to rivals still behind; gate 30k research / 150 insight. Stage 2 ends at ~10× with rivals behind.

## Critic head-to-head (tools/critic, scripted "curious first-timer", seed 1)

Round 1 (build `stage2-v1`) against the Paperclips Stage 2 fixture, both capped at 50 min of game time:

| metric | Takeoff Stage 2 | Paperclips Stage 2 |
|---|---|---|
| start → stage end | 33:38 (Stage 3) | not reached in 50:00 |
| first meaningful choice | 0:20 | 0:38 |
| nothing-to-do (loose), stage | 1306 s / 64.7%, longest 62 s | 0 s |
| hands: nothing enabled / two or more enabled | 68.9% / 10.2% | 3.0% / 90.6% |
| longest reveal gap | 146 s | 850 s |
| longest novelty gap | 80 s | 390 s |
| greyed-out goal on screen | 100% | 100% |
| numbers on screen at 0/5/10/20/end | 40 / 68 / 80 / 93 / 84 | 26 / 32 / 60 / 66 / 74 |
| interactive elements at 0/10/20 | 11 / 16 / 17 | 11 / 21 / 32 |
| panels, modals | 9, 18 | 8, 0 |

Biggest gap named by the numbers: the scripted player has nothing enabled 69% of the time because Stage 2 purchases are lumpy ($100k+ each) while Paperclips always has a cheap repeatable buy. Fix in round 2: the GPU buy offers a tenth of the batch (down to 100 GPUs) at the same price per GPU whenever the full batch is out of reach, like Stage 1's power block. Also trimmed numbers: the unbilled line hides under auto pricing in Stage 2, the "uses N MW" note and the theft percentage moved into tooltips.

Round 2 (build `stage2-v2`, adaptive GPU block): nothing-to-do fell to 314 s / 19.2% (longest 30 s) and nothing-enabled to 20.5%; clicks per minute rose from 8.1 to 26.4; first meaningful choice 0:16; longest reveal gap 152 s; numbers on screen 41 / 70 / 76 / 87 at 0 / 5 / 10 / 20 min. The run died at 27:18 on the Weight Theft dialog crash, which that build predates; round 3 uses the fixed build.

Round 3 (build `stage2-v3`, theft fix): the scripted player reaches Stage 3 at 37:02; nothing-to-do 228 s / 10.3% (longest 28 s); nothing-enabled 11.0%; first meaningful choice 0:16; greyed goal 100%; longest reveal gap 270 s (32:10 → 36:40, the save for the gate); numbers on screen 41 / 70 / 74 / 80 / 90 at 0 / 5 / 10 / 20 / 30 min against Paperclips' 26 / 32 / 60 / 66 / 70. The transition capture shows the gate line and the Oversight and Geopolitics panels arriving, the Projects panel emptying (Stage 3 has no cards yet), and three Stage 2 cards vanishing unbought, so the alignment, security, data and lab cards now stay available in Stage 3.

Round 4 (build `stage2-v4`): the transition capture now lists only the intended retirements (Marketing, Hire Researcher, Expand Lab) and the bought gate; no card vanishes unbought, and the Oversight and Geopolitics panels arrive with the gate line.

### Fresh-context review of build v3 (`agent-tools/critic-out/stage2-v3-review.md`)

| Rubric | Takeoff | Paperclips |
|---|---|---|
| Time to first meaningful choice | 7 | 7 |
| Seconds with nothing to do | 4 | 7 |
| Cognitive load and progressive disclosure | 5 | 6 |
| Cadence of reveals | 7 | 4 |
| Greyed-out goal always on screen | 8 | 7 |
| Clarity of stage transitions | 3 | 6 |
| Soft-locks found | 8 | 7 |
| Total | 42 | 44 |

Biggest gap named: minutes 27:38–37:02 (a quarter of the stage) are a wait for the gate the player cannot read: the Automate the Lab card said "needs 10×" with no progress, its dollar price was decorative (revenue outran it in seconds), and the real gate was four more training runs. Fix (round 5): the card carries a live line and bar, "Sage 5.5× of 10× · about 4 more capability runs", and the dollar price is gone (research, insight and 10× remain). Smaller issues fixed in the same round: the repeated "Trust +1" line (now every third milestone, worded as an unspent balance), Buy GPUs selling dark GPUs (the block is capped by powered room and the button says "Expand Grid first"), the data line reading as a requirement, the orphaned "(costs Trust)" note, the eleven-digit next-Trust target (compact in Stage 2), and the Stage 1 wording on the greyed Train button (it now names the shortfall).

Round 5 (build `stage2-v5`, readable gate, no dollar price, dark-GPU buys blocked): the scripted player reaches Stage 3 at 24:50 and the longest reveal gap falls to 86 s, but nothing-to-do rises to 33.5% because the grid's ×10 tier ($7M) blocks GPU buys for minutes.

Round 6 (build `stage2-v6`, grid grows in +10 MW steps, a quarter of capacity later): Stage 3 at 36:02; nothing-to-do 248 s / 11.5% (longest 22 s); nothing-enabled 12.2%; first meaningful choice 0:16; longest reveal gap 162 s (four over 120 s); greyed goal 100%; numbers on screen 41 / 68 / 72 / 85 / 87 at 0 / 5 / 10 / 20 / 30 min. Browser verification 33/33 (Stage 3 at 24:43 under autoplay).

Soft-lock probes (`softlock.ts --stage 2`): ignoring research for 15 minutes leaves Trust unspent with Expand Lab enabled as the way out; releasing with open issues produces the incident chain; reload mid-training keeps the run. No soft-lock found.

## Browser verification (`npm run test:stage2`)

33/33 checks on seed 1: the arrival screen (no task button, Infrastructure buttons, capability header, no strip or race yet, a greyed card within 15 s), the autoplay run to Stage 3 at 23:03 with no page errors, the reveal order (data 1:01 → race 1:41 → public and government 11:05 → alignment strip 11:51 → Automate the Lab 13:59 greyed → tempo 17:31 → security 17:57), reveals at least 40 s apart, a greyed goal on 100% of samples, the required dialogs, the five checkpoints, save and reload mid-run, layouts at 1280×720 and 390 px, and the Weight Theft dialog round-trip. The script found and this branch fixed a crash: the theft dialog rolled a random number during render.

## Open tuning questions

- The bot deploys every model. A player who keeps models internal will have less revenue and more research; the sim has no such policy yet.
- Approval ends 69–83 for the bot. The protest and ultimatum paths exist but need a careless policy to exercise in the sim.
- Humans will take longer per decision; verify in the browser that 35–45 minutes feels right.
