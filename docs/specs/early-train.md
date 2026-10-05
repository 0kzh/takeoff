# Early train: Sage-1 is trained in the opening (as built)

The owner's Stage 1 opening: complete tasks, rent GPUs, and with the first GPU the Training and Power
panels arrive together. The player trains Sage-1 (money, GPUs and power), deploys it, and only then do
GPUs run copies that complete tasks. Pricing comes right after the deploy. Research comes after
Training. After the deploy the game goes on as before: Sage-1.1 is the first full run ($75, 10 GPUs,
evaluation, red team, Release), and the Focus row comes 30 s after its release.

## State

* `newGame` sets `flags.prologue = true`. `inPrologue(s)` (engine/state.ts) is `stage === 1 && flags.prologue === true`.
  A save without the flag (every save from before this change) has Sage live and plays as before.
* While in the prologue `copies()` is 0: GPUs complete no tasks and burn no power. Clicks pay at once, as before.
* The prologue run is the ordinary run machinery with `run.prologue = true` and id 0 (later run ids are unchanged).
  It does not bump `runIndex` or `stats.trainings`, has no event and no gamble, and skips evaluation and the red
  team (`Sage-1 is trained.`). Its Release is `deployFirstModel`: it clears the run, deletes `flags.prologue` and
  stamps `flags.sageLiveAt`. It adds no model record, no Trust, hype or insight, sets no release clocks and
  counts no release. `firstReleaseAt` belongs to Sage-1.1.
* `Cost` has `power` (kWh). `canPay`/`pay` honour it; `costLabel` prints `$4, 100 kWh`; a power shortfall reads `power`.

## Numbers (engine/training.ts)

| Constant | Value |
| --- | --- |
| `PROLOGUE_FUNDS` | $4 |
| `PROLOGUE_GPUS` | 1 |
| `PROLOGUE_POWER` | 100 kWh (1,000 → 900) |
| `PROLOGUE_SECONDS` | 15 s |

## Beats (a player clicking twice a second, renting one GPU, then pressing Train and Deploy)

Times from the Train press on were measured at the old price ($12, 2 GPUs, 250 kWh, pressed at 0:48); at
$4, 1 GPU and 100 kWh the press is about 28 s earlier and the later rows have not been re-measured.

| Beat | Trigger | Time | Console line |
| --- | --- | --- | --- |
| `business` | first task | 0:00 | `Task complete. The customer pays $0.25.` |
| `compute` | $3 | 0:06 | `GPUs can be rented. They train Sage, and later run it.` |
| `fleet` + `power` + `training` | first GPU, one tick | 0:12 | `GPU rented. Sage can be trained on it: training takes money, GPUs and power.` |
| Train Sage-1 | pressed with 1 GPU (arms while short of $4) | 0:20 | `Training Sage-1 on 1 GPU.` |
| `buyPower` | power ≤ 800 and 30 s after the last beat | 0:48 | `Power is draining. Everything stops when it runs out.` |
| Sage-1 trained, Deploy | 15 s later | 1:03 | `Sage-1 is trained.` · `Sage-1 is live. Each GPU runs a copy; each copy completes a task a second.` |
| `pricing` | 8 s after the deploy and 30 s after the last beat | 1:18 | `Customers buy what Sage makes at $0.25. More tasks sell at a lower price and each earns less.` |
| `marketing` | as before | 2:03 | `Marketing brings more customers at every price.` |
| `research` | first Trust milestone, after `training` and `marketing` | 3:33 | `Trust earned: 3. Each one hires a researcher.` |
| `projects` | 40 s after `research` | 4:13 | `Research buys projects.` |

Before the deploy the Training panel is the Train row only (`Train Sage-1`, `Cost: $4, 100 kWh`, the GPU
line), then the run's bar, then a single `Deploy Sage-1` button. There is no evaluation, no `Open issues` line and no
Red-team button. The Training Pipeline card is gone; Chain-of-thought follows Better Prompting.
