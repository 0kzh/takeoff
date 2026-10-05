# Stage 2, round 2: fixes, and one wallet rule for the whole game

Source: `docs/critic-stage2-round2.md` (Takeoff 7.9, Paperclips 6.7). **Untouched:** every wall and wait named
where the eye is, the hard gate's sentences, the true `+$/s` on a lot, timed events with harmless defaults, the
goal card, the exit, persistence. **Not here:** the critic's bug list (stale texts, the run's price tripling at
the Stage 1 → 2 click, G5s counted as 1.5 on the Train row, a greyed card that stays after purchase).

## 1. The wallet rule

**Decision.** The game never holds the player's money. A sink that income could feed forever gets its own purse
and a share the player sets; every other purchase stays lit and prints what it costs the run that is waiting;
and a price never blocks Train. Both critics' gaps come from one fact: a run is a large price sharing a wallet
with small, repeatable ones.

| Test | Hold (greyed, with a reason) | Purses, with a share | Lit, with the cost printed |
|---|---|---|---|
| A requirement stated plainly that blocks | `the run first` is a governor's reason, not a requirement | Grey means this purse cannot pay, or a requirement | The same |
| No permanent warning or grey | Fails: lot rows greyed 53–58 % of Stage 2; my Stage 1 hold would grey every dollar button between runs | Passes while the purse covers a whole lot in a third of checks | Passes: the cost line shows only while a run waits |
| Nothing the player cannot act on | Fails: nothing lit shortens the wait; Train is lit 20 s a stage | The share moves two printed clocks | Every row can be pressed or declined |
| One idea a beat | None new, which is why it was built | One: the share, on arrival in Stage 2 | None |
| Stage 1: cards starved the run | Works | Works when the sink is in another purse (research for cards) | Stakes are printed; a player who ignores them is still slowed |
| Stage 2: the governor and its leftovers | Is the problem | The critic's first fix | Alone it fails: lots at a flat price are bottomless, so the run is never paid for |

**The rule** (arc G34):

1. **Two reasons for grey.** The purse cannot pay (the row prints the shortfall and a clock), or a stated
   requirement is unmet (GPUs, power, room, a prerequisite). Nothing is reserved, held back or shrunk for the player.
2. **A purse for a bottomless sink.** A repeatable purchase at a flat price never shares a purse with a run or
   a stage goal. It is paid from its own purse, filled by a share of income the player sets, and the share's
   control prints both clocks. Sinks whose price climbs (GPU rental, Marketing, `Lobby`) limit themselves and need none.
3. **Everything else is lit, with its delay.** A purchase from a purse that a waiting run or a needed card
   draws on prints the delay when it is 10 s or more: `Sage-2.5 0:41 later`.
4. **A price never blocks Train.** Train is disabled only by a requirement. Pressed with something short, it is
   armed and starts by itself; pressed again, it stands down. Arming reserves nothing.

### Stage 2

| Purse | Filled by | Pays for |
|---|---|---|
| `funds` | income × (1 − build share); rounds; events | runs, cards, event options, Security level 3 |
| `build fund` (a new Stores row) | income × build share; the deposit on arrival | lots, plants, halls |
| research | as built | runs, cards |

| Row | State | Reads |
|---|---|---|
| Build share (Infrastructure, from 0:00; 25 / 50 / 75 %) | — | `Build share: 50% · next 5,000 lot in 0:31 · Sage-2.5 in 0:52` |
| Lot: three whole sizes | lit | `Buy GPUs (1,000) $264,000 · uses 1 MW of 4 free · +$778/s` |
| | fund short | `$12,400 short — 0:09` |
| | no power, no room | as built |
| Plant, hall | lit or short | `Gas turbines (+20 MW) $245,000 · runs 20,000 GPUs · 18 of 25 MW idle` · `Build Datacenter 4 (+50,000 slots) $840,000 · 1:30 to build · 7,000 slots free` |
| Card, while a run waits | lit | its own line, then `· Sage-2.5 0:41 later` |
| Train | a requirement unmet | the built GPU sentences: the only block |
| | pressable | `Train Sage-2.5` · the cost · `Needs 10,000 GPUs for 1:26` · every shortfall, one clock: `short $6.5M and 8,750 research — about 1:22` |
| | armed | `Sage-2.5 starts when paid for — about 1:22` |
| Standing order | on | `Standing order: on · next lot in 0:31`; stalled: `waiting for power: 0 MW free`, `waiting for room: 600 slots left` |

**Deleted:** `lotHold`, `runHold`, `wallFix`, the `urgentCard` and `offerOnTable` reserves, `standingReserve`, the
shrunken lot, and the words `the run first`, `the plant first`, `the hall first`, `… first`, `keeps …'s price`.
**Arrival:** the deposit starts the build fund; line 2 reads `The 80 rented GPUs go back. The deposit, $120,000,
starts the build fund.` and line 5 `Half of income builds from here; the rest pays for runs and cards. Prices
set themselves.` (Marketing's end moves to Developments.) **Tuning:** default 50 %; the hold gave runs all income
about half the time, so a half share starts near the built pace. Knob: `S2_RUN_BASE`.

**Acceptance** (`explore-s2r2.mjs`, control and shipped first-timers, seeds 1–3; the sim's hands block). Rows
greyed by a reservation: none (53–58 %; the critic asked ≤ 15 %). A whole lot lit in at least 35 % of checks
(9–16 %). At most 250 lot presses a stage (663–798). Stage end 4:00 or more apart between a 25 % and a 75 %
share, both clocks printed (0:00). Train pressable or armed for at least 80 % of the time it is on screen and
idle (lit 20 s a stage). No purchase delays a waiting run by 10 s or more without that delay on its row (the
harness logs the run's clock before and after every purchase). Over-building spends build money only and its row
prints the idle capacity (+13:16, nothing printed). The bot in 36–44 minutes. Round 1's three hands targets hold.

### Stage 1 (revises `stage1-round3-fixes.md` §1)

Its only repeatable dollar sinks climb in price, so it needs no second purse. The `the run first` and `First
Datacenter first` holds are withdrawn. Marketing, Rent GPU and dollar cards stay lit and print `Sage-1.4 0:55
later` while a run or the needed datacenter waits for money. Train is armable from the first run.

### Stage 3 (an addendum to `stage3.md`)

| Was | Now |
|---|---|
| Lots keep money back for an offer, an `urgent` card or a wall's fix (`lotHold`, `wallFixS3`) | No hold. A lot is grey only for the build fund's shortfall, power, room or `2 on order` |
| The standing budget (25 / 50 / 75 / 100 % / off) buys lots out of funds | The build fund carries over: `Build share: 25 / 50 / 75 %` of revenue pays for lots, halls and reactors, by hand or through `Let Sage plan the build-out` (`runBuildout` spends it). Funds pay for seats, lead, payments, security and cards |
| `Alignment work`, a button at 2 % of a run a unit: a flat price in the run's purse | A share of research, `Alignment work: 0 / 10 / 20 / 30 %`, at the built rate per unit of research: `10% · measured +0.2 a minute · runs 11% later` |
| `Experiments`, capped at +5 a run | Unchanged: bounded, lit, prints its delay |
| Research cards (labs, grants) | Lit; each prints `Sage-3.4 1:10 later` |
| `Lobby`, `Counter-intelligence` (heating), `Payments` (a level) | Unchanged: self-limiting, and no run is paid from funds |

## 2. The other seven

**1. The first model.** Arrival funds reach the first run's dollar price within two minutes at the default
share, and nothing else is paid from them: the deposit, in the build fund, buys the first lot. The three research cards of the first minute are
revealed when the stage's first run starts. Train shows every shortfall and can be armed at 0:00. *Acceptance:*
first model by 4:00 for the control (7:20–7:40).

**2. Release intervals.** A card that adds data is on screen, `urgent`, whenever the next run's data is not in
hand: `Synthetic data` appears on that condition (it waited for *The Publishers*), and *The Publishers* opens at
the first shortfall if it has not. With the run's dollars no longer lent to lots and Train armed, the fifth and
sixth intervals should fall under five minutes; if one does not, lower `S2_FUNDS_EXPONENT` from 7 to 6.5 and
raise the base to hold the price at 2.6×. *Acceptance:* no release interval over 5:30 (4:56–6:22); no data wall
without a data card lit or grey beside it.

**3. The Standing order** is the build fund's automation and nothing else: on or off, no share of its own, no
pool. On, it buys the largest lot that fits whenever the fund covers one; it never buys plants or halls. Its card
costs research only. When the fund holds more than two minutes of its income and nothing fits, the row says which
wall (above), the fix is drawn `urgent`, and the wall line repeats every 180 s. *Acceptance:* a hand-buyer is no
faster without the card (3:33 faster); no stall over 3:00 with the fund above a lot's price and no line (54 min).

**4. Queueing Train.** Yes, in Stages 1 and 2: rule 4. My Stage 1 objection was to reserving research; arming
reserves nothing and adds no control. It is one press a run, at any moment of the wait, so the press is still the
player's. The permanent version stays Stage 3's grant (`Continual learning`). *Acceptance:* pressing Train a
minute late costs under 1:00 a stage (6:13).

**5. Unprinted trades.**

| What | Decision |
|---|---|
| The slider | Its two rates beside it: `50% · research +3,495/s · revenue −24%` |
| Trust | `Hire Researcher` and `Expand Lab` leave on arrival, with a line: the copies do the research and cards size the lab. Trust then buys only what names it (Policy team, Security level 3, the tax abatement) and converts at the gate as built. 38–40 presses worth nothing go |
| Lead | One band, printed on its line: `Baiwen: 1.5 months behind — under 1: Washington tightens exports; chips cost a tenth more`; at 3 or more, relations +1 a month |
| Measured alignment | Band edges moved into reach: under 65, the built advisory from 3×; at 85 or more each public release adds relations +1. Both printed on the line |
| Anthrosoft | It already keeps its own schedule and the screen hides it (`ships Cadence-21, level with Sage` to a lab it has passed). When it leads, the rival line reads `Anthrosoft leads: market −12%` (the built term, to −20 %) and the release line `Cadence-21 is ahead of Sage.` |
| Building ahead | The idle capacity on the row (§1's plant and hall lines) |

*Acceptance:* slider at 50 % costs what its line says, and the line is in the DOM (+8:03 unprinted); never
spending Trust is no faster than spending it (1:40 faster); each band is reached in at least one play style.

**6. Meters.** A capacity row prints its meter, the amount and the capacity: `GPUs ｢￭￭￭￭￭￭￭･･･｣ 17,105 of
25,000` · `power ｢￭￭････････｣ 1.0 of 5 MW · runs 5,000 GPUs` · `research ｢￭￭￭￭￭￭････｣ 61,000 of 100,000`. The
hover keeps the breakdown only. This withdraws "a row with a meter shows one number" (G14, `user-feedback-1.md`
B3): the owner asked for meters instead of bare numbers, not for fewer facts. *Acceptance:* "how many more fit"
is answerable from the row in every capacity row, Stage 1's power and quota included.

**7. Grey.** Grey is for goals. A row is drawn grey only while it is within three minutes of its purse's
income or its requirement names a fix on screen; farther rows are not drawn (the 25,000 lot, the next hall but
one); the stage's goal card is excepted. At most one grey lot row. *Acceptance:* at every five-minute mark fewer than half the controls on screen
are grey (a majority after 5:00); no row grey in more than 60 % of checks; numbers on screen ≤ 80.

## 3. Files patched with this

| File | Change |
|---|---|
| `arc.md` | G34 (the wallet rule); G27 counts a share as a sink; G14 loses "one number"; an amendment list |
| `stage1-round3-fixes.md` | §1: the holds withdrawn, delays printed, Train armable; acceptance restated; §6 row |
| `stage2.md` | Amendment row: purses, the build share, whole lots, armed Train, the Standing order, items 1–7 |
| `stage3.md` | Amendment block (the table above); as-built deltas rows 4–6, §2.14, §9 adjusted |
| `user-feedback-1.md` | B3's counting rule superseded by item 6 |
