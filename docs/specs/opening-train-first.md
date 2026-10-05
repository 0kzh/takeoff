# Opening: train first — proposal for review

**Status:** approved by the owner on 2026-10-04 (decisions at the end); being built. Replaces section (a) of `user-feedback-1.md` for beats 0–3 and moves the
Training panel; everything from the Projects panel on is as built.

**Asked for (owner, 2026-10-04):** the opening should make its mechanics obvious; start by training a model,
because the player does not know what Sage is; drop `Complete Task`; keep the game balanced without it.

## The proposal in five lines

1. The game opens on two console lines and one button, `Train Sage-1`. It is free and takes 12 seconds.
2. `Release Sage-1` puts the model to work on the borrowed GPU: one task a second, with no click and no power.
3. The release also clears $20 of pre-orders, which is what the first GPUs are rented with.
4. `Complete Task` is gone. Tasks Completed stays: it is what Sage does.
5. The Train row comes back at about 2:00, as the answer to the first unsold tasks. `Sage-1.1` costs $100 and
   ships at 3:36–4:14 instead of 6:53–7:01. The Training Pipeline card and the 5:00 floor are removed.

## What is wrong today (measured, built engine, 7 seeds)

| | Today |
|---|---|
| Sage is named | 0:03, in `GPUs can be rented. Each one runs a copy of Sage.` It is never explained |
| First thing that says what Sage is | 5:00–5:21, `Current model: Sage-1` on the Training panel |
| First Train press / first release | 5:41–6:02 / 6:53–7:01 |
| What gates the panel | The fourth card of a fixed queue; 7,000 tasks; a 2,000-research price in a lab that holds 1,000 (so Expand Lab, so the Trust award at 8,000 tasks); a hard floor at 5:00 |
| What the click does | Pays $0.25 at once, skipping demand. About 200 clicks in the first minute; the hand stops at 0:40. The first GPU lands anywhere from 0:06 to 0:49 depending on the hand (`critic-stage1-round3.md`) |

## The new opening

One beat teaches one thing; beats after the first rented GPU keep the built 30 s spacing. Times are the sim's
medians for the proposal (see Balance).

| Beat | When | The one thing it teaches | What appears | Console line |
|---|---|---|---|---|
| 0 | 0:00 | There is one thing to do | The console and `Train Sage-1`, where `Complete Task` sat. No numbers | `Welcome to OpenBrain.` · `A rented office. One desk. One borrowed GPU, humming.` |
| 1 | The press | A model takes time to train | The built training bar, 12 s. The run's one flavour line at halfway, as every run has | `Training Sage-1 on the borrowed GPU.` |
| 2 | 0:12 | A trained model has to be shipped | The button reads `Release Sage-1` | `Sage-1 is trained.` |
| 3 | The press, about 0:14 | Sage does the work | `Tasks Completed` starts counting by itself. The button is gone | `Sage-1 is live. It completes a task every second.` |
| 4 | The first task | Work pays | `Available Funds: $ 20.25` | `Task complete. The customer pays $0.25. Pre-orders: $20.` |
| 5 | Beat 4 + 5 s | Money rents more copies | `Rent GPU`, lit, `Cost: $ 6.00` | `GPUs can be rented. Each one runs a copy of Sage.` (as built) |
| 6 | The first rent | — | `GPUs rented: 1` | `GPU rented. A second copy of Sage is at work.` |
| 7–9 | 0:34 · 1:04 · 1:34 | Power; Buy Power; the price | As built, except that power waits 20 s after the first rented GPU whatever the fleet (the pre-orders rent three at once) | As built |
| 10 | 2:04 | A better model sells more | The Training panel: `Current model: Sage-1`, `Train Sage-1.1`, `Cost: $ 100`, `Needs 10 GPUs for 0:45` | `Customers would buy more from a better Sage.` |
| 11 | 2:34 · 3:04 | Marketing; Trust and researchers | As built. They may land while the bar runs | As built |
| 12 | 3:36 | A release brings customers | The first full cycle as built: evaluation, red team, Release. Demand doubles | As built: `Sage-1.1 released. … +1 Trust.` |
| 13 | 3:44 on | Projects | As built, less one card: Better Prompting, Grid Contract, Blue-sky Research | As built |

The Focus row still comes 30 s after the first release. Nothing new appears between the end of the first bar and
its release; a beat that falls due then waits until 10 s after.

## The three mechanics

**1. The prologue run.** `Train Sage-1` is free, needs only the borrowed GPU and takes 12 s. It has no evaluation,
no red team, no gamble, no event and no Trust: it is a button, a bar and a second button. It produces the model the
game already starts with (Sage-1, 1.00×), so the names and the capability ladder do not move.

**2. The borrowed GPU and the pre-orders replace the click.**

- The borrowed GPU runs one copy for the whole of Stage 1. It is not rented (the first rent still costs $6.00)
  and it draws no power, so a lab with no power and no money still earns $0.25 a second. That is the guarantee
  `Complete Task` gave ("the one verb that always works").
- The first release pays $20 once. It is a balance knob and nothing else: see the table below.

**3. Training answers the first wall.** The price lesson (`Sage makes more than customers buy`) is followed, one
beat later, by the Train row. A release already doubles demand, so the row is the fix for the pile the player has
just been shown. To make that reachable:

- The Training Pipeline card and `TRAINING_PANEL_FROM` (5:00) are removed. The opening queue is three cards.
- The first run costs $100 instead of $290. Every later price, every GPU requirement and every gain is unchanged.
- The Seed round ($5,000 at 10,000 tasks) now lands before the second run instead of the first.

## Balance

A harness around the built engine, bot and first-timer policies, 7 seeds, medians. Stage 2 shows the range.

| | Today, bot | Proposal, bot | Today, first-timer | Proposal, first-timer |
|---|---|---|---|---|
| First rented GPU | 0:05 | 0:14 | 0:05 | 0:14 |
| Ten rented GPUs | 0:57 | 0:43 | 0:57 | 0:43 |
| Power · Buy Power · price | 0:26 · 0:58 · 1:28 | 0:34 · 1:04 · 1:34 | 0:26 · 0:58 · 1:28 | 0:34 · 1:04 · 1:34 |
| Training panel | 5:00 | 2:04 | 5:21 | 2:04 |
| First Train press | 5:41 | 2:28 | 6:02 | 2:50 |
| Sage-1.1 released | 6:53 | 3:36 | 7:01 | 4:14 |
| Research panel · Projects | 2:29 · 3:09 | 3:04 · 3:44 | 2:44 · 3:24 | 3:06 · 3:46 |
| Runs 2 · 3 · 4 · 5 start | 8:01 · 10:51 · 13:33 · 16:23 | 5:45 · 9:19 · 12:59 · 17:01 | 11:08 · 14:37 · 17:10 · 19:33 | 5:49 · 11:41 · 17:14 · 20:13 |
| Stage 2 begins | 20:50 (20:14–21:40) | 19:56 (17:54–20:14) | 23:19 (22:48–23:58) | 23:30 (22:06–24:19) |
| Runs in Stage 1 | 5 | 5 | 5 | 5 |

The two knobs, each moved alone (medians, bot / first-timer):

| | Ten GPUs | Sage-1.1 released | Stage 2 |
|---|---|---|---|
| Pre-orders $0 | 1:42 | 4:01 / 4:32 | 20:34 / 22:35 |
| Pre-orders $10 | 1:00 | 3:42 / 4:02 | 20:09 / 22:54 |
| **Pre-orders $20** | **0:43** | **3:36 / 4:14** | **19:56 / 23:30** |
| Pre-orders $30 | 0:34 | 3:42 / 3:56 | 19:31 / 23:09 |
| First run $60 | 0:43 | 3:34 / 3:50 | 19:31 / 23:47 |
| **First run $100** | **0:43** | **3:36 / 4:14** | **19:56 / 23:30** |
| First run $290 (today's price) | 0:43 | 4:57 / 5:43 | 20:34 / 23:00 |

Read as: without the click and without pre-orders the opening runs about 45 s slow and Stage 1 is within its
seed noise. $20 puts the first minute back where a fast clicker has it today, for every hand. The stage's length
barely moves with either knob; what they set is how the first four minutes feel.

**What these figures are not.** The harness emulates the changes on the built engine: the borrowed GPU is counted
as a rented one (so it draws power and the first rent costs $6.10), the first run's price is a rebate at the
press, the pipeline card is marked bought, and the policies are today's with "save for the first run" added. No
beat is held during the first evaluation. Expect the built version to differ by up to 30 s on any one beat; it has
to be re-measured with `npm run sim` and played.

## What it costs

| | Today | Proposal |
|---|---|---|
| Numbers on screen at 0:00 · 0:30 · 1:00 | 1 · 4 · 6 | 0 · 4 · 5 |
| Numbers on screen at 2:00 · 3:00 | ≤ 11 · ≤ 17 | about 13 · about 20 (the Train row is three: price, GPUs, time). Counted from the table above, not measured |
| The evaluation screen (six benchmarks, four cards) | first seen at about 6:30 | first seen at about 3:20. It is the densest beat of the opening |
| Research and Projects | 2:29 · 3:09 | about 35 s later: the Train row takes a beat |
| The first 14 seconds | about 30 clicks | two presses and a bar |
| The first run's GPUs | — | 10 of about 17 stop serving for 45 s, at the moment unsold tasks are piling up |

## What it touches

| Where | Change |
|---|---|
| `index.html`, `ui/render.ts` | `btn-task` becomes the prologue button; `panel-task` leaves after the release |
| `engine/state.ts` | Beat 0's state and the two welcome lines; Sage-1 is not live until released |
| `engine/economy.ts` | `clickTask` and the click term in `productionPerSec` go; the borrowed copy in `copies` for Stage 1; pre-orders on the first release |
| `engine/stages.ts` | Beats 1–6 re-keyed as above; the `training` rule follows the price beat; `TRAINING_PANEL_FROM` goes |
| `data/projects.ts`, `engine/reveal.ts` | `p_training` goes; `OPENING_CARDS` is three; `p_prompting2` keys on the Training panel |
| `engine/training.ts` | The first run's price |
| `engine/endings.ts`, `engine/stage4.ts` | The Pause's `Complete Task` button and Stage 4's `The Complete Task button is gone.` |
| `sim/policy.ts`, `tools/critic`, `tools/verify`, `data/presets.ts` | The bots click; the smoke tests and presets assume the old opening (`trainingAt: 300.1`) |
| Saves | A save from before the change has Sage-1 live and the opening's flags set |

OpenMind is the lab's name in 119 places across 20 files; they become OpenBrain (decision 4).

## Decided (owner, 2026-10-04)

1. **Pre-orders: $20.**
2. **The Pause ending loses `Complete Task`, and its count keeps rising.** It is not a complete pause: the models
   that exist keep working. The counter counts on as Concord's and Silence's do, with a sentence of its own.
3. **The first evaluation lands at about 3:20.** All three mechanics are built. If it plays as too much that
   early, the fallback is mechanics 1 and 2 with the Training panel where it was (measured on 5 seeds: panel at
   5:00–5:17, Sage-1.1 released at 6:47–7:04, Stage 2 at 20:51 / 22:55).
4. **The lab is OpenBrain.** The welcome line names it, so the rename is done with this change, in the game's
   own text; the older design documents keep the name they were written with.
