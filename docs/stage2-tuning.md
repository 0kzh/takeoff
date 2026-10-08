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

## Open tuning questions

- The bot deploys every model. A player who keeps models internal will have less revenue and more research; the sim has no such policy yet.
- Approval ends 69–83 for the bot. The protest and ultimatum paths exist but need a careless policy to exercise in the sim.
- Humans will take longer per decision; verify in the browser that 35–45 minutes feels right.
