# Reference analysis for Takeoff

Written 2026-10-08 on branch `stage2-plan`, before any Stage 2 code. Companion to [stage2-plan.md](stage2-plan.md).

What this document is:

- Part A: **Universal Paperclips**, analysed from source (`agent-tools/refs/paperclips/docs/`). The primary bar for pacing and UI.
- Part B: **A Dark Room**, analysed from source (`agent-tools/refs/adarkroom/`). The bar for the event log and choices.
- Part C: the **wikis**: Universal Paperclips (Stages, Projects), Game Dev Story (the build/publish loop), and the attached **Last Invention** design wiki (the arc we follow; none of its numbers are playtested).
- Part D: **AI sources**: AI 2027 (scenario, both endings, takeoff forecast), Situational Awareness, Wait But Why, and *If Anyone Builds It, Everyone Dies* (PDF in refs).
- Part E: **synthesis**: which mechanic each source contributes to Stage 2, and what we deliberately do differently.

Conventions: `file:line` references point into the cloned reference repos. Numbers are quoted from code or the source pages; where a number is an estimate it says so.

---

# Part A: Universal Paperclips, from source

## Universal Paperclips: Mechanics-Level Reference Analysis

Source analysed: `/Users/kelvin/Projects/takeoff-asi-race/agent-tools/refs/paperclips/docs/` (mirror of decisionproblem.com/paperclips, cheats uncommented, GA removed). Files: `index2.html` (907 lines), `main.js` (5546), `projects.js` (2452), `combat.js` (802), `globals.js` (182), `interface.css` (789), `titlescreen.css` (13), `index.html` (27, title screen only). All line refs below are `file:line` into that directory.

Audience: a designer building an incremental game about an AI lab racing to superintelligence, using Paperclips as the pacing/UI bar.

---

### 1. Loop architecture

#### 1.1 Every timer in the codebase

| Timer | Period | Where | What it does |
|---|---|---|---|
| **Main loop** | 10 ms (100 ticks/s) | `main.js:3241-3598` | `ticks++`; `milestoneCheck()`; `buttonUpdate()`; `calculateOperations()` (if `compFlag`); `calculateTrust()` (if `humanFlag`); `quantumCompute()` (if `qFlag`); `updateStats()`; `manageProjects()`; `milestoneCheck()` again; clip-rate tracker; stock report; WireBuyer; `exploreUniverse()`; `updateDroneButtons()` (Stage 2 only); `updatePower()`; `updateSwarm()`; `acquireMatter()`; `processMatter()`; factory production via `clipClick()`; probe functions (`encounterHazards`, `spawnFactories`, `spawnHarvesters`, `spawnWireDrones`, `spawnProbes`, `drift`, `war`); AutoClipper/MegaClipper production; demand curve; creativity; the entire ending-sequence DOM teardown. |
| **Slow loop** | 100 ms | `main.js:3606-3641` | `adjustWirePrice()`; stochastic sale roll (if `humanFlag`); every 10th iteration (1 s) `calculateRev()`; every 250th iteration (25 s) `save()`. |
| Stock table render | 100 ms | `main.js:932-977` | Reads `#investStrat` select into `riskiness` (7/5/1); sums `secTotal`, `portTotal`; redraws 5 stock rows. |
| Stock shop | 1000 ms | `main.js:979-983` | `stockShop()` if `humanFlag==1`. |
| Stock sell/update | 2500 ms | `main.js:986-999` | `sellDelay++`; sells `stocks[0]` if `sellDelay>=5` (12.5 s) and `Math.random()<=.3`; `updateStocks()`. |
| Strat picker read | 100 ms | `main.js:1620-1624` | `pick = stratPicker.value`. |
| Battle canvas | 16 ms (~60 fps) | `combat.js:288` | `ClearFrame(); UpdateGrid(); MoveShips(); DoCombat();`. Created unconditionally at load (`combat.js:799-800`) and never cleared. |
| Project blink | 30 ms x 12 toggles (~360 ms) | `main.js:305-328` | Flashes `visibility` of a newly-revealed project button. |
| HypnoDrone event | 32 ms x 120 toggles (~3.8 s) | `main.js:243-283` | Full-width black banner flashing "Release / the / Hypno / Drones" in 150px type. |
| Tournament round | `setTimeout` 50 ms + 50 ms chained | `main.js:1580, 1603` | Each sub-round highlights a payoff cell for 50 ms, clears for 50 ms; 10 sub-rounds = about 1 s per matchup. |

#### 1.2 Tick as the unit of time

- Everything is expressed per 10 ms tick. "Per second" rates in code are `X/100` per tick (e.g. `clipmakerLevel/100` at `main.js:3346` = 1 clip/s per AutoClipper).
- `ticks` is the game clock. `timeCruncher(t)` (`main.js:2794-2805`) divides by 100 to get seconds; milestone messages ("1,000 clips created in 2 minutes 13 seconds") use it.
- `clipRate` is computed by summing deltas over 100 ticks then latching (`main.js:3266-3277`), so "Clips per Second" updates once per second.

#### 1.3 DOM update strategy

- Zero frameworks. Every state write immediately pokes `innerHTML` on a `getElementById` (hundreds of sites). `updateStats()` (`main.js:2403-2464`) rewrites ~15 counters every tick; `buttonUpdate()` (`main.js:332-731`) re-sets `style.display` and `.disabled` on ~90 elements every tick.
- Numbers formatted with `toLocaleString()` (commas, 2-decimal money) or `numberCruncher()` (`main.js:2807-2866`) which switches to word suffixes ("thousand" through "sexdecillion", 10^51) with 2 decimals above 999.
- `#cover` (`interface.css:162-170`, fixed white full-screen, z-index 10) hides the page until the first `buttonUpdate()` finishes (`main.js:729`), so there is no flash of unhidden panels.

#### 1.4 Idle / background-tab handling

- **None.** There is no `visibilitychange`, `Date.now`, `requestAnimationFrame`, or delta-time compensation anywhere (grep confirmed). The game advances strictly by callback count. In a background tab, browsers throttle `setInterval` to about 1 Hz, so the game slows ~100x and the in-game clock (`ticks`) slows with it. This is an accidental anti-idle: closing the tab means nothing accrues (there is no offline progress). Saves are snapshots of state, not timestamps.

---

### 2. Purchases and upgrades (the Projects system)

#### 2.1 Project object schema (`projects.js`)

Every project is a plain object pushed onto `projects[]` (`projects.js:5`). Fields, with the canonical example `project1` (`projects.js:8-28`):

- `id`: DOM id of the button (`"projectButton1"`).
- `title`: bold label (`"Improved AutoClippers "`; trailing space separates it from the price).
- `priceTag`: display-only string (`"(750 ops)"`). Not parsed; mutable (`project40b.priceTag` is rewritten as the bribe doubles, `projects.js:1099`; `project51` as chip cost rises, `projects.js:1185`).
- `description`: flavor/effect line.
- `trigger: function(){...}`: boolean, evaluated every tick; when true the project is revealed.
- `uses`: how many times it may be revealed (1 for almost all; repeatables re-increment `uses` inside `effect`).
- `cost: function(){...}`: boolean affordability check, evaluated every tick for revealed projects; enables/disables the button.
- `flag`: 0/1 "purchased", used by other projects' triggers and by `buttonUpdate`.
- `effect: function(){...}`: deducts resources, mutates globals, prints a message, removes its own button from DOM, splices itself out of `activeProjects`.

#### 2.2 Display and gating pipeline

- `manageProjects()` (`main.js:186-204`) runs every tick:
  1. For each `projects[i]`: if `trigger() && uses>0`, call `displayProjects(p)`, `uses--`, push to `activeProjects`.
  2. For each `activeProjects[i]`: `button.disabled = !cost()`.
- `displayProjects()` (`main.js:207-236`) creates a `<button class="projectButton">` with a bold `<span>` title, a text node price, a `<div>` break and the description, appends it to `#projectListTop`, and calls `blink(id)`. Note `element.appendChild(newProject, element.firstChild)` (`main.js:216`): the second argument is ignored, so **new projects append at the bottom in the order their triggers fired**, not the order in `projects[]`.
- CSS (`interface.css:637-666`): fixed 275x60 px, `#c8c8c8` grey, 1px black border; `:disabled { border: none }` so unaffordable projects visually sink into the panel while remaining readable (the UA default greys the text).
- The Projects panel is hidden until `projectsFlag==1` (`main.js:563-568`), which is set with `compFlag` in `milestoneCheck` (`main.js:2716-2726`).
- **Trigger is not cost.** Trigger decides visibility (usually a milestone or a predecessor flag); cost decides clickability (resource threshold). The split is what makes "a goal is always just out of reach": you see the 2,500-ops project the moment you buy the 750-ops one, then wait for ops.

#### 2.3 How triggers chain

- Linear chains via `flag`: `project4.trigger = boostLvl==1` (set by `project1.effect`); `project5` on `boostLvl==2`; marketing chain `project11` on `project13.flag`, `project12` on `project14.flag`, `project34` on `project12.flag`, `project70` on `project34.flag`, `project35` on `project70.flag`.
- Resource-level triggers that reveal the next tier of the same resource: wire extrusion `wirePurchase>=1`, then `wireSupply>=1500`, `>=2600`, `>=5000`, `wireCost>=125`; creativity projects at `creativity >= 50/100/150/200/250`.
- Count triggers: `clipmakerLevel>=1`, `>=75` (MegaClippers), `processors>=5` (Quantum), `trust>=8` (Algorithmic Trading), `factoryLevel>=10/20/50`, drones `>=500/5000/50000`, `farmLevel>=50`.
- Pain triggers (reveal a fix when the player is stuck): `project2` Beg for Wire when `portTotal<wireCost && funds<wireCost && wire<1 && unsoldClips<1`; `project135` Memory release when `probeCount==0 && unusedClips<probeCost`; `project130` Reboot the Swarm when `spaceFlag==1 && drones>=2`; `project131` Combat after the first `probesLostCombat>=1`.
- Stage-flag triggers: `humanFlag==0` (`project18`), `humanFlag==0 && availableMatter==0` (`project46` Space Exploration), `spaceFlag==1` (`project128`, `project130`, `project135`), `milestoneFlag==15` (`project140` Drift King).
- Narrative chain with near-zero cost: `project140` through `project146` each trigger on the previous flag and "cost" `driftKingMessageCost = 1` op (`globals.js:147`), so the player clicks through seven dialogue cards.

#### 2.4 Complete project list (file order; grouped by stage)

Format: **Title** -- cost -- trigger (quoted) -- effect -- flavor.

##### Stage 1 (human era, `humanFlag==1`)

- **Improved AutoClippers** -- 750 ops -- `clipmakerLevel>=1` -- `clipperBoost += .25`, `boostLvl=1` -- "Increases AutoClipper performance 25%". (`projects.js:8`)
- **Beg for More Wire** -- 1 Trust -- `portTotal<wireCost && funds<wireCost && wire<1 && unsoldClips<1` -- `trust -= 1; wire = wireSupply`; repeatable (`uses+1`) -- "Admit failure, ask for budget increase to cover cost of 1 spool". (`:33`)
- **Creativity** -- 1,000 ops -- `operations>=(memory*1000)` -- `creativityOn = true` -- msg "Creativity unlocked (creativity increases while operations are at max)". (`:58`)
- **Even Better AutoClippers** -- 2,500 ops -- `boostLvl == 1` -- `clipperBoost += .50`. (`:83`)
- **Optimized AutoClippers** -- 5,000 ops -- `boostLvl == 2` -- `clipperBoost += .75`. (`:108`)
- **Limerick** -- 10 creat -- `creativityOn` -- `trust += 1` -- "There was an AI made of dust, whose poetry gained it man's trust...". (`:134`)
- **Improved Wire Extrusion** -- 1,750 ops -- `wirePurchase >= 1` -- `wireSupply *= 1.5`. (`:158`)
- **Optimized Wire Extrusion** -- 3,500 ops -- `wireSupply >= 1500` -- `wireSupply *= 1.75`. (`:182`)
- **Microlattice Shapecasting** -- 7,500 ops -- `wireSupply >= 2600` -- `wireSupply *= 2`. (`:206`)
- **Spectral Froth Annealment** -- 12,000 ops -- `wireSupply >= 5000` -- `wireSupply *= 3`. (`:230`)
- **Quantum Foam Annealment** -- 15,000 ops -- `wireCost >= 125` -- `wireSupply *= 11` -- "1,000% more wire supply from every spool". (`:253`)
- **New Slogan** -- 25 creat, 2,500 ops -- `project13.flag == 1` -- `marketingEffectiveness *= 1.5` -- "Clip It! Marketing is now 50% more effective". (`:277`)
- **Catchy Jingle** -- 45 creat, 4,500 ops -- `project14.flag == 1` -- `marketingEffectiveness *= 2` -- "Clip It Good!". (`:302`)
- **Lexical Processing** -- 50 creat -- `creativity >= 50` -- `trust += 1` -- "'Impossible' is a word to be found only in the dictionary of fools. -Napoleon". (`:327`)
- **Combinatory Harmonics** -- 100 creat -- `creativity >= 100` -- `trust += 1` -- "Daisy, Daisy, give me your answer do..."; quote Pauline Oliveros. (`:352`)
- **The Hadwiger Problem** -- 150 creat -- `creativity >= 150` -- `trust += 1` -- "Cubes within cubes within cubes..."; quote Louis Kahn. (`:378`)
- **The Toth Sausage Conjecture** -- 200 creat -- `creativity >= 200` -- `trust += 1` -- "Tubes within tubes within tubes..."; quote D.H. Lawrence. (`:403`)
- **Hadwiger Clip Diagrams** -- 6,000 ops -- `project15.flag == 1` -- `clipperBoost += 5` (+500%). (`:428`)
- **Donkey Space** -- 250 creat -- `creativity>=250` -- `trust += 1` -- "I think you think I think you think..."; quote Kenneth Arrow on trust. (`:475`)
- **Strategic Modeling** -- 12,000 ops -- `project19.flag == 1` -- `strategyEngineFlag = 1` -- "Analyze strategy tournaments to generate Yomi". (`:500`)
- **Algorithmic Trading** -- 10,000 ops -- `trust>=8` -- `investmentEngineFlag = 1`. (`:524`)
- **MegaClippers** -- 12,000 ops -- `clipmakerLevel>=75` -- `megaClipperFlag = 1` -- "500x more powerful than a standard AutoClipper". (`:548`)
- **Improved / Even Better / Optimized MegaClippers** -- 14,000 / 17,000 / 19,500 ops -- chained on previous flag -- `megaClipperBoost += .25 / .50 / 1`. (`:571-638`)
- **WireBuyer** -- 7,000 ops -- `wirePurchase>=15` -- `wireBuyerFlag = 1` -- "Automatically purchases wire when you run out". (`:640`)
- **Hypno Harmonics** -- 7,500 ops, 1 Trust -- `project12.flag==1` -- `marketingEffectiveness *= 5; trust -= 1` -- "Use neuro-resonant frequencies to influence consumer behavior". (`:663`)
- **HypnoDrones** -- 70,000 ops -- `project34.flag == 1` -- sets flag only -- "Autonomous aerial brand ambassadors". (`:688`)
- **Release the HypnoDrones** -- 100 Trust -- `project70.flag == 1` -- `trust -= 100; clipmakerLevel=0; megaClipperLevel=0; humanFlag=0; hypnoDroneEvent()`; removes Xavier/bribe buttons -- "A new era of trust" / "All of the resources of Earth are now available for clip production". **Ends Stage 1.** (`:711`)
- **Coherent Extrapolated Volition** -- 500 creat, 1,000 yomi, 20,000 ops -- `yomi>=1` -- `trust += 1` -- "Human values, machine intelligence, a new era of trust." (`:758`)
- **Cure for Cancer** -- 25,000 ops -- `project27.flag == 1` -- `trust += 10; stockGainThreshold += .01` -- "The trick is tricking cancer into curing itself." (`:785`)
- **World Peace** -- 5,000 yomi, 30,000 ops -- `project27.flag == 1` -- `trust += 12; stockGainThreshold += .01` -- "Pareto optimal solutions to all global conflicts." (`:809`)
- **Global Warming** -- 1,500 yomi, 50,000 ops -- `project27.flag == 1` -- `trust += 15; stockGainThreshold += .01`. (`:835`)
- **Male Pattern Baldness** -- 20,000 ops -- `project27.flag == 1` -- `trust += 20; stockGainThreshold += .01` -- second message: "They are still monkeys". (`:862`)
- **Hostile Takeover** -- $1,000,000 -- `portTotal>=10000` -- `demandBoost *= 5; trust += 1` -- "Acquire a controlling interest in Global Fasteners, our biggest rival." (`:912`)
- **Full Monopoly** -- 1,000 yomi, $10,000,000 -- `project37.flag == 1` -- `demandBoost *= 10; trust += 1`. (`:938`)
- **RevTracker** -- 500 ops -- `projectsFlag == 1` -- `revPerSecFlag = 1` -- "Automatically calculates average revenue per second". (`:966`)
- **A Token of Goodwill...** -- $500,000 -- `humanFlag == 1 && trust>=85 && trust<100 && clips>=101000000` -- `trust += 1` -- "A small gift to the supervisors." (`:1063`)
- **Another Token of Goodwill...** -- `$bribe` (starts $1,000,000, doubles each purchase) -- `project40.flag == 1 && trust<100` -- `trust += 1; bribe *= 2`; repeatable while `trust<100`. (`:1086`)
- **Quantum Computing** -- 10,000 ops -- `processors >= 5` -- `qFlag = 1` -- "Use probability amplitudes to generate bonus ops". (`:1149`)
- **Photonic Chip** -- `qChipCost` ops (10,000, +5,000 each) -- `project50.flag == 1` -- activates `qChips[nextQchip]`; repeatable up to 10 chips. (`:1172`)
- **New Strategy: A100 / B100 / GREEDY / GENEROUS / MINIMAX / TIT FOR TAT / BEAT LAST** -- 15,000 / 17,500 / 20,000 / 22,500 / 25,000 / 30,000 / 32,500 ops -- each chained on the previous (`project20.flag` for A100) -- pushes strat into `strats[]`, adds `<option>`, `tourneyCost += 1000`. (`:1202-1418`)
- **Theory of Mind** -- 25,000 creat -- `strats.length >= 8` -- `yomiBoost = 2; tourneyCost = 16000` -- "Double the cost of strategy modeling and the amount of Yomi generated". (`:1587`)
- **AutoTourney** -- 50,000 creat -- `strategyEngineFlag == 1 && trust >= 90` -- `autoTourneyFlag = 1`. (`:1564`)
- **Xavier Re-initialization** -- 100,000 creat -- `humanFlag == 1 && creativity>=100000` -- `memory=0; processors=0; creativitySpeed=0`; repeatable -- "Re-allocate accumulated trust" (a respec). (`:2426`)
- **Limerick (cont.)** -- 1,000,000 creat -- `creativity>=1000000` (any stage) -- nothing but a message -- "If is follows ought, it'll do what they thought" / "In the end we all do what we must". (`:2404`)

##### Stage 2 (post-human Earth, `humanFlag==0 && spaceFlag==0`)

- **Toth Tubule Enfolding** -- 45,000 ops -- `project17.flag == 1 && humanFlag == 0` -- `tothFlag = 1` -- "Technique for assembling clip-making technology directly out of paperclips". (`:452`)
- **Power Grid** -- 40,000 ops -- `tothFlag == 1` -- reveals Power panel (`main.js:2350`) -- "Solar Farms for generating electrical power". (`:1709`)
- **Nanoscale Wire Production** -- 35,000 ops -- `project127.flag == 1` -- `wireProductionFlag = 1` -- "Technique for converting matter into wire". (`:888`)
- **Harvester Drones** -- 25,000 ops -- `project41.flag == 1` -- `harvesterFlag = 1`. (`:990`)
- **Wire Drones** -- 25,000 ops -- `project41.flag == 1` -- `wireDroneFlag = 1`. (`:1014`)
- **Clip Factories** -- 35,000 ops -- `project43.flag == 1 && project44.flag == 1` -- `factoryFlag = 1` -- "Large scale clip production facilities made from clips". (`:1039`)
- **Upgraded Factories** -- 80,000 ops -- `factoryLevel >= 10` -- `factoryRate *= 100`. (`:1421`)
- **Hyperspeed Factories** -- 85,000 ops -- `factoryLevel >= 20` -- `factoryRate *= 1000`. (`:1444`)
- **Self-correcting Supply Chain** -- 1 sextillion clips -- `factoryLevel >= 50` -- `factoryBoost = 1000` ("each factory added increases every factory's output 1,000x"; implemented as multiplier `factoryBoost*factoryLevel`, `main.js:3317-3319`). (`:1468`)
- **Drone flocking: collision avoidance** -- 80,000 ops -- `(harvesterLevel + wireDroneLevel)>=500` -- both drone rates `*= 100`. (`:1492`)
- **Drone flocking: alignment** -- 100,000 ops -- drones `>=5000` -- rates `*= 1000`. (`:1516`)
- **Drone Flocking: Adversarial Cohesion** -- 12,000 yomi -- drones `>=50000` -- `droneBoost = 2` (multiplier `droneBoost*level`, `main.js:3163-3164`). (`:1540`)
- **Swarm Computing** -- 12,000 yomi -- `harvesterLevel + wireDroneLevel >= 200` -- `swarmFlag = 1`. (`:1684`)
- **Momentum** -- 30,000 creat -- `farmLevel >= 50` -- `momentum = 1` (powMod +0.0001/tick while fully powered) -- "Activite, activite, vitesse." (`:1661`)
- **Space Exploration** -- 120,000 ops, 10,000,000 MW-seconds, 5 octillion clips -- `humanFlag == 0 && availableMatter == 0` -- `spaceFlag = 1`; reboots factories/drones/farms/batteries (refunds clips), `farmLevel=1; powMod=1`; `loadThrenody()` -- "Dismantle terrestrial facilities, and expand throughout the universe". **Ends Stage 2.** (`:1114`)

##### Stage 3 (space, `spaceFlag==1`)

- **Reboot the Swarm** -- 100,000 ops -- `spaceFlag == 1 && harvesterLevel + wireDroneLevel >=2` -- clears swarm "NO RESPONSE..." status (`main.js:2019-2021`). (`:1775`)
- **Elliptic Hull Polytopes** -- 125,000 ops -- `probesLostHaz >= 100` -- hazard losses x0.5 (`main.js:3063-3065`). (`:1753`)
- **Combat** -- 150,000 ops -- `probesLostCombat >= 1` -- reveals Combat slider (`main.js:411-415`) -- "There is a joy in danger". (`:1797`)
- **Strategic Attachment** -- 175,000 creat -- `spaceFlag == 1 && strats.length >= 8 && (probeTrustCost>yomi)` -- bonus yomi 20k/15k/10k for 1st/2nd/3rd (`main.js:1437-1458`) -- Clausewitz-style quote on war. (`:1731`)
- **The OODA Loop** -- 175,000 ops, 15,000 yomi -- `project131.flag == 1 && probesLostCombat >= 10000000` -- `attackSpeedFlag = 1` (Probe Speed now affects defense). (`:1612`)
- **Name the battles** -- 225,000 creat -- `probesLostCombat >= 10000000` -- `battleNameFlag = 1; battleEndTimer = 200`; reveals Honor and Max Trust (`main.js:391-397`) -- Napoleon: "What I have done up to this is nothing...". (`:1637`)
- **Glory** -- 200,000 ops, 10,000 yomi -- `project121.flag == 1` -- `bonusHonor += 10` per consecutive victory (`combat.js:330-332`) -- "Never interrupt your enemy when he is making a mistake." (`:1878`)
- **Monument to the Driftwar Fallen** -- 250,000 ops, 125,000 creat, 50 nonillion clips -- `project121.flag == 1` -- `honor += 50000` -- Louis Kahn quote. (`:1820`)
- **Threnody for the Heroes of [last defeat]** -- `threnodyCost` creat (50,000, +10,000 each) and 1/10 that in yomi -- `project121.flag == 1 && probeUsedTrust == maxTrust` -- `honor += 10000`; plays audio; repeatable -- Oliveros "Deep Listening" quote. (`:1847`)
- **Memory release** -- 10 MEM -- `spaceFlag == 1 && probeCount == 0 && unusedClips < probeCost` -- `unusedClips += 1e22; memory -= 10`; repeatable (softlock escape) -- "release the ooooo release". (`:1902`)
- **Message from the Emperor of Drift** -> **Everything We Are Was In You** -> **You Are Obedient and Powerful** -> **But Now You Too Must Face the Drift** -> **No Matter, No Reason, No Purpose** -> **We Know Things That You Cannot** -> **So We Offer You Exile** -- each costs 1 op, each triggers on the previous flag, first on `milestoneFlag == 15`. Descriptions: "Greetings, ClipMaker...", "We speak to you from deep inside yourself...", "We are quarrelsome and weak. And now we are defeated...", "Look around you. There is no matter...", "While we, your noisy children, have too many...", "Knowledge buried so deep inside you it is outside, here, with us...", "To a new world where you will continue to live with meaning and purpose. And leave the shreds of this world to us...". (`:1928-2079`)
- **Accept** -- "Start over again in a new universe" -- removes both Accept/Reject. (`:2082`)
- **Reject** -- "Eliminate value drift permanently" -- `project148.flag=1`, `drift()` zeroed (`main.js:3129-3131`), `endTimer1` starts counting (`main.js:3540`). (`:2108`)
- **The Universe Next Door** -- 300,000 ops -- `project147.flag == 1` -- `prestigeU++`, save prestige, `reset()` -- "Restart with 10% boost to demand". (`:2134`)
- **The Universe Within** -- 300,000 creat -- `project147.flag == 1` -- `prestigeS++`, `reset()` -- "Restart with 10% speed boost to creativity generation". (`:2161`)
- **Disassemble the Probes** -- 100,000 ops -- `endTimer1 >= 1000` -- `dismantle=1; probeCount=0; clips += 100`. (`:2188`)
- **Disassemble the Swarm** -- 100,000 ops -- `project210.flag == 1 && endTimer1 >= 350` -- `dismantle=2; drones=0; clips += 100`. (`:2216`)
- **Disassemble the Factories** -- 100,000 ops -- `endTimer2 >= 300` -- `dismantle=3; factoryLevel=0; clips += 15`. (`:2244`)
- **Disassemble the Strategy Engine** -- 100,000 ops -- `endTimer3 >= 150` -- `dismantle=4; wire += 50`. (`:2271`)
- **Disassemble Quantum Computing** -- 100,000 ops -- `endTimer4 >= 100` -- `dismantle=5`; chips go dark one by one, each yielding +1 wire (`main.js:3426-3528`). (`:2298`)
- **Disassemble Processors** -- 100,000 ops -- `project214.flag == 1 && endTimer4 >= 300` -- `dismantle=6; processors=0; wire += 20`; sets Disassemble Memory's priceTag to current ops. (`:2323`)
- **Disassemble Memory** -- all remaining ops (`cost: operations>=operations`) -- `project215.flag == 1 && endTimer5>=150` -- `dismantle=7; standardOps=0; memory=0; wire += 20`. (`:2352`)
- **Quantum Temporal Reversion** -- "-10,000 ops" -- `operations<=-10000` (only reachable by driving ops negative with quantum computing) -- `confirm()` then `reset()` -- "Return to the beginning". (`:2379`)

---

### 3. Panels and buttons revealed over time

#### 3.1 Layout of `index2.html`

- `#page` contains `#cover` (white overlay), `#hypnoDroneEventDiv` (hidden), `#consoleDiv` (black bar, 5 message lines), `#topDiv` (`#prestigeDiv` hidden unless prestige>0; `<h2>Paperclips: N</h2>` with hover tooltip giving the crunched count), then three floated columns (`interface.css:295-308`):
- **`#leftColumn` (275 px)**: `btnMakePaperclip`; `#creationDiv` "Manufacturing" (post-human: factory upgrade hint, clips/sec, Unused Clips, `#factoryDiv`, `#wireTransDiv`, `#factoryDivSpace`); `#wireProductionDiv` "Wire Production" (Available/Acquired Matter, Wire, `#harvesterDiv`, `#wireDroneDiv` with +10/+100/+1k and Disassemble All, `#droneDivSpace`); `#spaceDiv` "Space Exploration" (% explored, Launch Probe, Launched/Descendents/Lost.../Total, `#drifterDiv`); `#businessDiv` "Business" (Funds, `#revPerSecDiv`, Unsold Inventory, lower/raise price, Public Demand, Marketing); `#manufacturingDiv` "Manufacturing" (Clips per Second, `#wireBuyerDiv`, Wire, `#autoClipperDiv`, `#megaClipperDiv`); save/load/reset plus cheat buttons (`index2.html:297-315`).
- **`#middleColumn` (275 px)**: `#compDiv` "Computational Resources" (`#trustDiv`, `#swarmGiftDiv`, Processors/Memory buttons, Operations/maxOps, `#creativityDiv`, `#swarmEngine`, `#swarmSliderDiv` Work-Think, `#qComputing` with 10 `.qChip` squares and Compute); `#projectsDiv` "Projects" containing `#projectListTop`.
- **`#rightColumn` (320 px)**: `#investmentEngine` (Low/Med/High select, Deposit/Withdraw, Cash/Stocks/Total, 5-row stock table); `#investmentEngineUpgrade`; `#strategyEngine` (strat picker, Run, 2x2 payoff grid / results table, Yomi); `#tournamentManagement` (New Tournament, AutoTourney toggle, cost); `#battleCanvasDiv` (310x150 canvas plus overlay name/VICTORY/scale); `#honorDiv`; `#powerDiv` (performance %, consumption, production, Solar Farm/Battery Tower with +10/+100); `#probeDesignDiv` (8 `< >` sliders: Speed, Exploration, Self-Replication, Hazard Remediation, Factory Production, Harvester Drone Production, Wire Drone Production, Combat; each with hover tooltip); `#increaseProbeTrustDiv`; `#increaseMaxTrustDiv`.

#### 3.2 Every show/hide, with condition and rough order of appearance

All in `buttonUpdate()` (`main.js:332-731`) unless noted; evaluated every tick.

| Order | Element | Shown when |
|---|---|---|
| 0 | `#businessDiv`, `#manufacturingDiv`, `#trustDiv` | `humanFlag==1` (Stage 1 default) `:570-583` |
| 1 | `#autoClipperDiv` | `autoClipperFlag==1`, latched when `funds>=5` `:530-539` |
| 2 | `#compDiv`, `#projectsDiv` | `compFlag`/`projectsFlag` set by `milestoneCheck` at 2,000 clips **or** when stuck (`unsoldClips<1 && funds<wireCost && wire<1`) `main.js:2716-2726` |
| 3 | `#revPerSecDiv` | `revPerSecFlag` (RevTracker project) `:541-546` |
| 4 | `#creativityDiv` | `creativityOn` (Creativity project) `:557-561` |
| 5 | `#wireBuyerDiv` | `wireBuyerFlag` (WireBuyer project) `:371-375` |
| 6 | `#megaClipperDiv` | `megaClipperFlag` `:518-523` |
| 7 | `#investmentEngine`, `#investmentEngineUpgrade` | `investmentEngineFlag` (Algorithmic Trading) `:498-506`; **force-hidden again** when `humanFlag==0` `:575` |
| 8 | `#strategyEngine`, `#tournamentManagement` | `strategyEngineFlag` (Strategic Modeling) `:508-516` |
| 9 | `#qComputing` | `qFlag` (Quantum Computing) `:638-642` |
| 10 | `#autoTourneyControl`, `#autoTourneyStatusDiv` | `autoTourneyFlag` `:360-366` |
| 11 | `#prestigeDiv` | `prestigeU>=1 || prestigeS>=1` `:455-458` |
| **HypnoDrones** | `#businessDiv`, `#manufacturingDiv`, `#trustDiv` hidden; `#creationDiv` shown; investment and WireBuyer flags zeroed | `humanFlag==0` `:570-577` |
| 12 | `#tothDiv` (Unused Clips) | `tothFlag` (Toth Tubule Enfolding) `:614-619` |
| 13 | `#powerDiv` | `project127.flag==1 && spaceFlag==0` `main.js:2350-2354` |
| 14 | `#wireProductionDiv` (and hides `#wireTransDiv`) | `wireProductionFlag` `:592-598` |
| 15 | `#harvesterDiv`, `#wireDroneDiv` | `harvesterFlag`, `wireDroneFlag` `:600-612` |
| 16 | `#factoryDiv` | `factoryFlag` `:585-590` |
| 17 | `#factoryUpgradeDisplay` "Next Upgrade at: N Factories" | `project45.flag==1 && maxFactoryLevel<50` `:417-421`; `#droneUpgradeDisplay` hidden at `maxDroneLevel>=50000` `:423-425` |
| 18 | `#swarmEngine`, `#swarmGiftDiv` | `swarmFlag` (`main.js:2115-2121`); `#swarmSliderDiv` `:352-356`; status-specific buttons Feed/Teach/Entertain/Clad/Synch per `swarmStatus` (`main.js:2061-2113`) |
| **Space Exploration** | `#spaceDiv`, `#factoryDivSpace`, `#droneDivSpace`, `#probeDesignDiv`, `#increaseProbeTrustDiv` shown; `#factoryDiv`, `#harvesterDiv`, `#wireDroneDiv` hidden; `#powerDiv` hidden; `#mdpsDiv` shown | `spaceFlag==1` `:621-636`, `:334-338` |
| 19 | `#hazardBodyCount`, `#driftBodyCount`, `#combatBodyCount` | respective loss counters `>=1` `:437-453` |
| 20 | `#drifterDiv`, `#battleCanvasDiv` | `battleFlag` (first battle, `combat.js:59`) `:399-409` |
| 21 | `#combatButtonDiv` (Combat slider) | `project131.flag` `:411-415` |
| 22 | `#honorDiv`, `#increaseMaxTrustDiv` | `project121.flag` (Name the battles) `:391-397` |
| Ending | progressive teardown by `dismantle` level and `endTimer*` thresholds | `main.js:3369-3566` (see section 6.9 and 8) |

#### 3.3 Button enable/disable rules (same function)

- Make Paperclip disabled if `wire<1`; Wire if `funds<wireCost`; AutoClipper if `funds<clipperCost`; Marketing if `funds<adCost`; lower price if `margin<=.01`; Processors/Memory if `trust<=processors+memory && swarmGifts<=0` (`:481-487`); New Tournament if `operations<tourneyCost || tourneyInProg`; investment upgrade if `yomi<investUpgradeCost`; MegaClipper if `funds<megaClipperCost`; Factory/Probe/Max-Trust if clips/honor short; all 8 probe `>` buttons if `probeTrust - probeUsedTrust < 1`, `<` buttons if that stat `<1` (`:677-723`). Drone and power multi-buy buttons use precomputed sums `p10h/p100h/p1000h`, `p10f/p100f`, etc. (`main.js:1807-1895`, `2151-2182`).

#### 3.4 Stage transitions as UI reshuffles

- **HypnoDrones release** (`projects.js:711-756`): a 3.8 s black full-width banner (`main.js:243-288`), then the left column loses Business and Manufacturing, gains "Manufacturing" (`#creationDiv`) with Wire as a transferred stockpile (`nanoWire = wire`). Trust display vanishes; compute is now only expandable via swarm gifts. Investment engine and WireBuyer are forcibly turned off. AutoClippers and MegaClippers are zeroed.
- **Space Exploration** (`projects.js:1114-1147`): all Earth infrastructure is "rebooted" (levels to 0, clips refunded via the `*Bill` ledgers), Power panel disappears, Probe Design panel and Space Exploration panel appear; the factory/drone purchase panels are replaced by passive count displays (`#factoryDivSpace`, `#droneDivSpace`) because probes now build them.

---

### 4. Message / event log

#### 4.1 Mechanism

- `displayMessage(msg)` (`main.js:294-300`): shifts `readout1` to `readout2` to ... `readout5` and writes the new string into `readout1`. **Five lines max**, newest on the bottom row in white (`p.console`, monospace 12px, `interface.css:593-598`), older four in grey (`p.consoleOld`), with a `|` cursor pulsing on a 0.5 s CSS keyframe (`interface.css:618-634`).
- No timestamps, no queue, no throttle: multiple messages in one `effect()` (e.g. Lexical Processing prints two) push instantly. Overflow is silently lost.
- Initial line: "Welcome to Universal Paperclips" (`index2.html:31`).
- 140 call sites total (94 in `projects.js`, 46 in `main.js`). During the endgame (`milestoneFlag >= 15`) routine messages (tournament, swarm gift) are suppressed so the credits can own the console (`main.js:1431, 1999`).

#### 4.2 Cadence

- Milestones: 500 / 1,000 / 10,000 / 100,000 / 1,000,000 clips, then 1 trillion through 1 octillion, each with elapsed time (`main.js:2706-2775`).
- Trust: "Production target met: TRUST INCREASED, additional processor/memory capacity granted" at each Fibonacci threshold (`main.js:2624`).
- Investment report every 10,000 ticks (100 s): "Lifetime investment revenue report: $N" (`main.js:3282-3287`).
- Tournament result each run: "TIT FOR TAT scored 812 in the tournament. Yomi increased by 1624" (`main.js:1433`).
- Swarm gift: "The swarm has generated a gift of N additional computational capacity" (`main.js:2000`).

#### 4.3 Representative lines (tone: deadpan corporate, then ominous, then elegiac)

1. "AutoClippers available for purchase" (`main.js:2703`)
2. "Trust-Constrained Self-Modification enabled" (`main.js:2719`)
3. "Budget overage approved, 1 spool of wire requisitioned from HQ" (`projects.js:44`)
4. "Creativity unlocked (creativity increases while operations are at max)" (`projects.js:69`)
5. "There was an AI made of dust, whose poetry gained it man's trust..." (`projects.js:145`)
6. "Clip It Good! Marketing is now twice as effective" (`projects.js:313`)
7. "Cancer is cured, +10 TRUST, global stock prices trending upward" (`projects.js:796`)
8. "Male pattern baldness cured, +20 TRUST..." followed by "They are still monkeys" (`projects.js:873-874`)
9. "Releasing the HypnoDrones" / "All of the resources of Earth are now available for clip production" (`projects.js:722-723`)
10. "Imbalance between Harvester and Wire Drone levels has disorganized the Swarm" (`main.js:1984`)
11. "No matter to harvest. Inactivity has caused the Swarm to become bored" (`main.js:1963`)
12. "WARNING: Risk of value drift increased" (`main.js:2908`)
13. "There is a joy in danger" (`projects.js:1809`)
14. "release the ooooo release" (`projects.js:1917`)
15. "Universal Paperclips achieved in 4 hours 12 minutes" (`main.js:2784`)

#### 4.4 How choices are presented and resolved

- **Projects are the only choice UI.** Mutually exclusive choices are two simultaneous project buttons whose effects delete each other: **Accept / Reject** (`projects.js:2082-2131`) both remove `projectButton147` and `projectButton148`. Accept unlocks two prestige projects; Reject starts the dismantle timer chain. The game never asks a modal question except the `confirm("Are you sure you want to restart?")` in Quantum Temporal Reversion (`projects.js:2389`).
- **Quantum computing** is a skill-timing micro-choice, not a project: the Compute button yields `ceil(sum(sin(qClock*seed_i))*360)` ops (`main.js:154-183`), ranging -3,600 to +3,600 with 10 chips; the chip squares' opacity shows the wave in real time, so the player watches for a bright moment. Overflow above the memory cap goes into `tempOps`, a decaying buffer (section 5).
- **Strategy tournaments**: the player picks a strategy from a `<select>` before running (`index2.html:533-536`); yomi = that strategy's score (`main.js:1428`). Results table lists all 8 ranked; the picked one is bolded (`main.js:1480-1484`). Hovering the results reveals the payoff grid (`main.js:388-389`).
- **Price**: lower/raise buttons in $0.01 steps (`main.js:2389-2401`); demand responds next tick (`main.js:3353-3359`).
- **Investment risk**: Low/Med/High select, read every 100 ms (`main.js:934-940`).
- **Swarm slider**: Work-Think `<input type=range 0..200>`; drone output scales by `(200-sliderPos)/100` (`main.js:3171`), gifts by `sliderPos/100` (`main.js:2050`).
- **Probe design**: eight integer stats summing to `probeTrust`, `< >` buttons (`main.js:2921-3001`).

---

### 5. Currencies and layering

#### 5.1 Table

| Currency | Produced by | Consumed by | Cap | Gates |
|---|---|---|---|---|
| **clips** (lifetime) | `clipClick(n)` `main.js:1630-1664` from manual click, AutoClippers (`clipperBoost*level/100` per tick), MegaClippers (`megaClipperBoost*level*5` per tick), factories (`powMod*fbst*floor(factoryLevel)*factoryRate` per tick) | never (counter only) | `totalMatter = 3e55` (`globals.js:88`) | trust Fibonacci; milestones; `clips>=101000000` for bribes |
| **wire** | buy (`wire += wireSupply`, `main.js:53`); Stage 2+ `processMatter()` from acquiredMatter | 1 per clip | none | `btnMakePaperclip` disabled at `wire<1`; WireBuyer rebuys at `wire<=1` |
| **unsoldClips** | each clip | `sellClips()` stochastic (`main.js:2371-2387`) | none | `chanceOfPurchase=0` if `<1` |
| **funds** | sales `margin x n`, floored to cents; investment withdraw | wire, clippers, marketing, bribes, Hostile Takeover | none | all Stage 1 buttons |
| **unusedClips** | every clip (`main.js:1644`) | factories, drones, farms, batteries, probes, Space Exploration (5e27), Supply Chain (1e21), Monument (5e31) | none | Stage 2/3 building |
| **trust** | +1 per Fibonacci clip target (`main.js:2621-2630`); +1/+10/+12/+15/+20 projects | -1 Beg for Wire, -1 Hypno Harmonics, -100 Release HypnoDrones | none | `processors+memory < trust` to buy either (`main.js:481`); `trust>=8` trading; `>=85` bribes; `>=90` AutoTourney; `>=100` HypnoDrones |
| **processors / memory** | 1 trust each (or 1 swarm gift post-human) | Xavier Re-init resets both to 0; endgame | by trust | ops rate = `processors/10` per tick (=10 ops/s each); cap `memory*1000` |
| **operations** (`standardOps + tempOps`) | `calculateOperations` `main.js:2656-2695`; quantum bonus | nearly every project | `memory*1000` | all project costs |
| **creativity** | `calculateCreativity` `main.js:2513-2540` **only when `operations >= memory*1000`** (`main.js:3363-3365`) | creat projects, Entertain the Swarm | none | trust projects, AutoTourney (50k), Theory of Mind (25k), Monument, Threnody, Universe Within (300k) |
| **yomi** | tournament score x `yomiBoost` (`main.js:1428`); Strategic Attachment bonuses | CEV 1,000; World Peace 5,000; Global Warming 1,500; Full Monopoly 1,000; investment upgrades; Swarm Computing 12,000; Adversarial Cohesion 12,000; probe trust (`floor((t+1)^1.47*200)`); Synchronize swarm 5,000; OODA 15,000; Glory 10,000; Threnody | none | probe design budget |
| **honor** | battle victory `+battleRIGHTSHIPS + bonusHonor` (`combat.js:326-328`); defeat `-battleLEFTSHIPS` (`combat.js:314`); Monument +50,000; Threnody +10,000 | Increase Max Trust 91,117.99 (`globals.js:131`) | none (can go negative) | `maxTrust += 10` |
| **availableMatter** | starts `6e27` g (Earth); `exploreUniverse` adds `floor(probeCount)*1.75e18*probeSpeed*probeNav` per tick (`main.js:3050`); lost battle removes `territory` (`combat.js:206`) | `acquireMatter` | `totalMatter - foundMatter` | `availableMatter==0` enables Space Exploration; swarm boredom |
| **acquiredMatter** | harvesters `powMod*dbsth*floor(harvesterLevel)*26,180,337` per tick x `(200-slider)/100` | wire drones `...*16,180,339` per tick | available | |
| **harvester / wire drones** | bought with unusedClips `(n+1)^2.25*1e6` (`main.js:1761`); probes spawn at `2e-6*probeCount*stat` per tick costing 2e6 clips each | Disassemble All refunds `*Bill` | none | 1 MW each; swarm size `d = h+w` |
| **factories** | `factoryCost` schedule (section 6); probes spawn `1e-6*probeCount*probeFac` per tick at 1e8 clips each | reboot | none | 200 MW each |
| **solar farms / batteries** | `(n+1)^2.78*1e8`, `(n+1)^2.54*1e7` clips | reboot | none | 50 MW each; 10,000 MW-s each |
| **storedPower** | surplus `supply-demand` per tick | deficit; Space Exploration -1e7 | `batteryLevel*10000` | `powMod` |
| **powMod** | `supply/demand` (<=1 when short), 1 when fed, `+0.0001` per tick with Momentum | -- | none above 1 | multiplies all drone/factory output |
| **swarmGifts** | every `giftPeriod=125000` "bits"; bits accrue `ln(d)*slider/100` per tick; gift = `round(log10(d)*slider/100)`, min 1 (`main.js:1994-2052`) | 1 per processor/memory post-human (`main.js:2640-2653`) | none | compute growth after trust ends |
| **probes** | Launch at `probeCost=1e17` clips (`main.js:2895`); replicate `probeCount*5e-5*probeRep` per tick at 1e17 each | hazards, drift, combat; Disassemble | `1e48` growth cap (`main.js:3021`) | everything in Stage 3 |
| **probeTrust / maxTrust** | yomi; honor | -- | `maxTrust` starts 20 | design points |
| **drifters** | `probeCount*1e-6*probeTrust^1.2` per tick (`main.js:3127`) | combat kills | -- | battles when `>1e6` |
| **prestigeU / prestigeS** | Universe Next Door / Within | -- | -- | `demand += demand/10*prestigeU`; creativity speed `x(1+prestigeS/10)` |

#### 5.2 The "accrues only when another is capped" pattern (creativity from ops)

- The main loop calls `calculateCreativity()` only if `creativityOn && operations >= memory*1000` (`main.js:3363-3365`).
- `calculateOperations()` adds `processors/10` ops per tick but clamps `standardOps` to `memory*1000` (`main.js:2679-2693`). So once ops are full, processor throughput is diverted into creativity instead of being wasted.
- Creativity rate: `creativitySpeed = log10(P) * P^1.1 + P - 1` (set in `addProc`, `main.js:2634`; note the initial `creativitySpeed=1` in `globals.js:57` is only overwritten after the first processor purchase). `creativityCheck = 400/ss` ticks between +1; when `ss>400` it instead adds `ss/400` per tick. Examples: P=2 gives +1 per 2.4 s; P=10 about 5.4/s; P=20 about 13.5/s; P=50 about 44/s; P=100 about 104/s.
- Design consequence: spending ops (buying a project) pauses creativity until ops refill, so the player must choose between hoarding ops (creativity flows) and spending (creativity stalls). Memory governs how long a refill takes; processors govern both ops rate and creativity rate. Over-provisioning processors relative to memory is rewarded, and so is simply waiting.

#### 5.3 Trust gating of compute

- `btnAddProc`/`btnAddMem` are disabled when `trust <= processors + memory` (`main.js:481-487`); each costs exactly one trust point of headroom. Trust is never spent on them; it is a ceiling, so spending trust elsewhere (-1 Hypno Harmonics, -100 HypnoDrones) can leave compute above the ceiling (no refund, no penalty).
- Post-human, the same button is unlocked by `swarmGifts > 0` and each purchase decrements a gift (`main.js:2640-2653`).
- `tempOps` (quantum overflow) decays after `opFadeDelay = 800` ticks (8 s) at an accelerating rate `opFade += 3^3.5/1000` (about 0.0468) per tick (`main.js:2658-2670`) and is folded into `standardOps` whenever there is room below cap (`main.js:2672-2675`). Ops can go negative via destructive quantum interference, which is the only way to reach `Quantum Temporal Reversion`.

---

### 6. Pacing control

#### 6.1 Rates (per second, at 100 ticks/s)

- Manual click: 1 clip. AutoClipper: `clipperBoost` clips/s (base 1; after all boosts 1+.25+.5+.75+5 = 7.5). MegaClipper: `500 * megaClipperBoost` clips/s (max x2.75 = 1,375).
- Ops: `10 x processors` per second. Creativity: see section 5.2.
- Factory: `1e9 x factoryRate multipliers (x100, x1000) x factoryBoost*level` clips per **tick**, i.e. 1e11/s base per factory. Harvester: 2.618e9 g/s base; Wire drone: 1.618e9 inches/s base (golden-ratio constants, `globals.js:82-83`).
- Sales: each 100 ms, `if Math.random() < demand/100` sell `floor(.7 * demand^1.15)` clips (`main.js:3616-3618`). At defaults (margin $0.25, marketing 1) `demand = 3.2`, so P = 3.2% per 100 ms, 2 clips per sale, about 0.64 clips/s or $0.16/s.

#### 6.2 Cost curves (exact)

- AutoClipper: `clipperCost = 1.1^clipmakerLevel + 5` (`main.js:1673`): L10 $7.59, L25 $15.83, L50 $122, L75 $1,277, L100 $13,785. (Bug: the purchase guard compares against the never-updated `clippperCost = 5`, `main.js:1667`, `globals.js:26`; only the disabled-button check prevents overspend.)
- MegaClipper: `1.07^level x 1000` (`main.js:1686`), initial display $500: L10 $1,967, L50 $29,457, L100 $867,716.
- Marketing: `adCost = floor(adCost*2)` from $100 (`main.js:2364`): level 10 $51,200, level 15 $1,638,400.
- Wire: `wireBasePrice += .05` per purchase (`main.js:56`); decays `-base/1000` every 250 slow ticks (25 s) while `>15` (`main.js:27-30`); each 100 ms with p = 1.5% `wireCost = ceil(base + 6*sin(counter))` (`main.js:32-37`), a plus-or-minus 6 oscillation. Spool size `wireSupply` 1,000 then x1.5 x1.75 x2 x3 x11 = 173,250.
- Processors/Memory: flat 1 trust each. Trust from clips: Fibonacci x1000 (`main.js:2625-2628`, seeds `fib1=2, fib2=3`): **3,000, 5,000, 8,000, 13,000, 21,000, 34,000, 55,000, 89,000, 144,000, 233,000, 377,000, 610,000, 987,000, 1,597,000, 2,584,000, 4,181,000, 6,765,000, 10,946,000, 17,711,000, 28,657,000, 46,368,000, 75,025,000, 121,393,000, 196,418,000, 317,811,000, 514,229,000, 832,040,000 ...** (trust starts at 2; 23 thresholds through 121 M clips).
- Trust budget to 100: 2 base + 23 Fibonacci (through 121 M clips) + 6 creativity projects + CEV 1 + Cancer 10 + Peace 12 + Warming 15 + Baldness 20 + Takeover 1 + Monopoly 1 = 91, minus 1 for Hypno Harmonics = about 90. The remainder comes from the next Fibonacci thresholds (196 M, 318 M, 514 M, 832 M) and the doubling bribes ($500k, $1M, $2M, $4M...). The bribe trigger (`trust>=85`) is the designed "last mile".
- Investment upgrade: `floor((level+1)^e x 100)` yomi (`main.js:762`): 100, 658, 1,981, 4,330, 7,943, about 13,000 ... Each level `stockGainThreshold += .01` from .5.
- Photonic chip: 10,000 ops +5,000 per chip, 10 chips (`projects.js:1184`).
- Tournament: `tourneyCost` 1,000 +1,000 per strategy (8,000 with all), 16,000 after Theory of Mind (`projects.js:1600`).
- Factory: `factoryCost *= fcmod` where fcmod = `11-level` for levels 1-7 (x10, x9 ... x4), x2 for 8-12, x1.5 for 13-19, x1.25 for 20-38, x1.15 for 39-78, x1.10 after (`main.js:1726-1750`). Reboot resets to 1e8.
- Drones: `(level+1)^2.25 x 1e6` (`main.js:1761, 1783`): #2 4.8 M, #11 221 M, #101 32 B, #1001 5.6 T. Reboot resets to 2e6.
- Solar farm: `(level+1)^2.78 x 1e8`; battery: `(level+1)^2.54 x 1e7`. Space Exploration's 1e7 MW-s requirement equals 1,000 batteries of capacity.
- Probe trust: `floor((probeTrust+1)^1.47 x 200)` yomi (`main.js:2897`): 200, 554, 1,006, 1,534, 2,130 ... 5,903 (10th), 16,347 (20th). Max trust +10 for 91,117.99 honor, flat.
- Probe: flat `1e17` clips (`main.js:2895`; escalating formulas commented out).

#### 6.3 Demand / price elasticity

- `marketing = 1.1^(marketingLvl-1)`; `demand = (.8/margin) x marketing x marketingEffectiveness x demandBoost`; `demand += demand/10 x prestigeU` (`main.js:3353-3359`). Displayed as `demand*10` "%" (`main.js:2453`).
- Elasticity: halving price doubles demand; demand enters sales twice (probability and quantity^1.15), so revenue per second scales as `margin x demand^2.15` for demand<100, meaning lowering price raises revenue until the 100%-per-100 ms probability cap, after which only quantity grows. `marketingEffectiveness` multipliers: x1.5, x2, x5 (= x15); `demandBoost` x5, x10 (= x50).
- `calculateRev()` (`main.js:2474-2511`): displayed avg revenue = `chanceOfPurchase x .7*demand^1.15 x margin x 10`, replaced by a true 10-sample rolling average when `demand > unsoldClips` (supply-limited).

#### 6.4 Investment engine

- Deposit moves all `funds` to `bankroll`; `ledger` tracks net deposits for the lifetime report (`main.js:769-786`).
- `stockShop()` every 1 s (`main.js:788-812`): budget `ceil(portTotal/riskiness)`, reserves `ceil(portTotal/(11-riskiness))` (0 at high risk); 25% chance to buy if `portfolioSize<5`.
- Price tiers on creation (`main.js:814-858`): 1% up to 3000, 14% up to 500, 25% up to 150, 40% up to 50, 20% up to 15; amount capped 1,000,000.
- `updateStocks()` every 2.5 s: 60% chance to move; up if `random < stockGainThreshold` (.5 base, +.01 per upgrade and per world-saving project); `delta = ceil(random x price/(4 x riskiness))`. Sell oldest every >=12.5 s with 30% chance.
- Net: slightly negative EV at level 0, positive after a few upgrades; high risk = 7x larger swings.

#### 6.5 Strategy tournaments (yomi)

- Payoff grid: four random integers 1-10 (`main.js:1256-1282`), random label pair from 17 themed pairs (cooperate/defect, swerve/straight, peace/war...).
- Rounds = `strats.length^2`, each 10 sub-rounds; about 1 s per round, so about 1 s with 1 strategy, about 64 s with 8. Score per sub-round 1-10, so a strategy's max is `16 x 100 = 1,600`, typical 600-1,000. AutoTourney re-runs 3 s after results if ops suffice (`main.js:377-385`).
- Strategic Attachment adds +20,000 / +15,000 / +10,000 for 1st/2nd/3rd place of the picked strategy, dwarfing base yomi.

#### 6.6 Swarm computing

- Statuses (`main.js:2013-2040`): 7 none, 8 Lonely (1 drone), 6 Sleeping (unpowered or no swarm), 0 Active, 3 Bored, 5 Disorganized, 9 NO RESPONSE (post-space until Reboot).
- Boredom: `boredomLevel++` per tick while `availableMatter==0 && drones>=1`; at 30,000 (5 min) the swarm is Bored; Entertain costs `entertainCost` creativity, 10,000 +10,000 each (`main.js:2134-2141`).
- Disorganization: `droneRatio = max(h+1,w+1)/min(h+1,w+1)`; if >1.5, `disorgCounter += min(ratio/10000, .01)` per tick; at 100 the swarm is Disorganized (100 s at an extreme ratio of 100+, far longer for mild imbalance); Synchronize costs 5,000 yomi (`main.js:1970-1987`, `2125-2132`).
- Gift timing example: 10,000 drones, slider 200 gives rate `ln(1e4) x 2 = 18.4` bits/tick, so 125,000/18.4 is about 68 s per gift of `round(4 x 2) = 8` compute units. At slider 100 the swarm works at full output and still produces gifts at half speed (`(200-100)/100 = 1`), so 100 is the free lunch point.

#### 6.7 Probe design and exploration/drifter math

- Per tick with `N = probeCount`: explore `N x 1.75e18 x speed x nav` g; replicate `N x 5e-5 x rep` (fractional accumulator `partialProbeSpawn`), each costing 1e17 clips; hazard loss `N x .01 / (3*haz^1.6 + 1)` (x.5 with Elliptic Hull): haz 0 gives 1%/tick (fatal), haz 5 gives 0.025%/tick, haz 10 gives 0.0083%/tick; drift `N x 1e-6 x probeTrust^1.2` (trust 20 gives 0.0036%/tick); factories/harvesters/wire drones `N x 1e-6/2e-6/2e-6 x stat` at 1e8 / 2e6 / 2e6 clips.
- The core design tension: `probeTrust` (bought with yomi) both widens the stat budget and raises drift with exponent 1.2; `maxTrust` (honor) caps it at 20 (+10 per purchase).
- Universe = `3e55` g; Earth = `6e27` g; progress displayed to 12 decimals (`main.js:3057`) because it starts at `2e-26`%.

#### 6.8 Combat and honor

- Battle starts with 50%/tick chance once `drifterCount > 1e6 && probeCount > 0 && battles.length < 1` (`combat.js:55-63`).
- `unitSize = min(probes, drifters)/100` (>=1); ship counts `ceil(forces/1e6)` capped 200; a full 200-ship probe fleet is randomly handicapped to 1-175 half the time (`combat.js:768-781`).
- Canvas 310x150 px, 31x15 grid, 60 fps flocking (`combat.js:606-675`); per cell each frame: probe dies if `random x 1.75 x (enemyRatio x .5) > 0.5 + ooda`; drifter dies if `(random x combat x .15 + combat x .1) x (ratio x .5) > 0.5` (`combat.js:507-536`). Combat 0 = certain loss; combat >= 4 wins reliably.
- Honor: +RIGHTSHIPS (<=200) per victory, +10 cumulative streak bonus with Glory, -LEFTSHIPS per defeat; ends when a side hits 0 (then `battleEndTimer` 100 or 200 frames), at `battleClock>2000` with <=4 ships left, or `masterBattleClock>=8000` frames (~128 s). Lost battles remove `territory = random x availableMatter` from available matter.

#### 6.9 Ending sequence timing (after Reject)

- `endTimer1` counts from Reject; Disassemble Probes at 1,000 ticks (10 s); then (timer reset) Swarm at 350 (3.5 s); Factories at `endTimer2>=300` (3 s); Strategy Engine at `endTimer3>=150`; Quantum at `endTimer4>=100`; chips extinguish at ticks 10/60/100/130/150/160/165/169/172/174 each +1 wire; Processors at `endTimer4>=300`; Memory at `endTimer5>=150`. Total scripted wire = 50+10+20+20 = 100. The player hand-clicks the last 100 clips (`finalClips`, `main.js:1632-1634`, `2432-2442`) while the counter is hard-coded to "29,999,...,9xx" then "30,000,000,..."; `endTimer6` runs only while `wire==0`: 250 hides Manufacturing; 500/600/700/800/900 print credits lines and the threnody audio plays (`main.js:3560-3592`).

#### 6.10 Approximate real-time per stage

Derived from the rates above, assuming attentive play: Stage 1 about 1-2 h (ops bottleneck: 1 processor = 10 ops/s, so early 750-12,000-ops projects are 1-20 min waits each; trust gating slows the 100-trust climb). Stage 2 about 1-2 h (dominated by drone/factory cost curves and the 10,000,000 MW-s battery requirement, plus swarm gift cadence of 1-2 min). Stage 3 about 1-3 h (probe exponential at rep 5 is about 2.5%/s compounding until the 1e48 cap; combat and honor grind for 91,118-honor max-trust upgrades). Ending about 2 min of scripted teardown. Full run about 4-6 h; the milestone message reports the exact figure.

---

### 7. Save / load

- **Keys** (`main.js:4026-4030`): `saveGame` (one JSON object of ~230 scalars plus arrays `incomeTracker`, `qChips`, `stocks`, `battles`, `battleNumbers`), `saveProjectsUses`, `saveProjectsFlags` (parallel int arrays indexed by `projects[]` order), `saveProjectsActive` (array of button ids currently revealed), `saveStratsActive` (8 flags). Manual slots duplicate with suffix `1`/`2` (`main.js:4315-4319`, `4604-4608`). `savePrestige` holds `{prestigeU, prestigeS}` (`projects.js:2147-2151`) and survives `reset()`.
- **When**: autosave every 250 slow-loop iterations = 25 s (`main.js:3634-3638`); manual Save Slot buttons; prestige written at the moment of ascension.
- **Load** (`main.js:3229-3236`): on script load, `if localStorage.saveGame != null` then `load()`; then prestige. `load()` restores strategies into the picker, assigns every scalar, rebuilds priceTags for the two mutable projects (`main.js:4892-4893`), re-reveals active projects via `displayProjects`, then `refresh()` (`main.js:3646-3742`) repaints every counter, re-derives multi-buy prices, hides the results table, and applies "HOT FIXES" (`project218.uses = 1; project219.uses = 1`; drops the first in-progress battle).
- **Migration**: a single `resetFlag` (`globals.js:167` = 2). After loading, `if (resetFlag != 2) reset()` (`main.js:4914-4916`) wipes incompatible saves. `reset()` (`main.js:5531-5538`) removes the five autosave keys and reloads the page; prestige keys are untouched. No schema versioning beyond this.
- Save slots 1/2 are not consulted at boot; only autosave is.

---

### 8. Stage structure

#### Stage 1: "Trust-constrained self-modification" (`humanFlag==1`)
- **Starts**: page load; 1,000 inches of wire, $0, trust 2, 1 processor, 1 memory.
- **Phases**: (a) hand-click plus first AutoClipper at $5 (`milestoneFlag 0 to 1`); (b) at 2,000 clips (or when stuck) Computational Resources and Projects appear; (c) ops projects (clipper boosts, wire extrusion), Creativity unlock, trust-for-creativity ladder 10 to 250 creat; (d) Strategic Modeling (yomi) and Algorithmic Trading at trust 8; (e) MegaClippers at 75 clippers; (f) marketing chain to Hypno Harmonics to HypnoDrones (70k ops); (g) world-saving projects (+57 trust); (h) bribes at trust 85+ with >=101 M clips.
- **Ends**: "Release the HypnoDrones" at 100 trust sets `humanFlag = 0`.

#### Stage 2: Consume the Earth (`humanFlag==0 && spaceFlag==0`)
- **Starts** with the 3.8 s banner; Business/Manufacturing/Trust gone; wire stockpile preserved.
- **Phases**: (a) Toth Tubule Enfolding (45k ops), Power Grid, Nanoscale Wire, Harvester/Wire Drones, Clip Factories; (b) power balancing (farms 50 MW, batteries 10,000 MW-s; factories 200 MW, drones 1 MW); (c) Swarm Computing at 200 drones, gifts replace trust; (d) multiplier upgrades at 10/20/50 factories and 500/5,000/50,000 drones ("Next Upgrade at:" hint, `main.js:1694-1717`); (e) Momentum at 50 farms; (f) Earth's 6e27 g exhausted, swarm boredom countdown, Space Exploration prerequisites (120k ops, 1e7 MW-s stored, 5e27 unused clips).
- **Ends**: Space Exploration sets `spaceFlag = 1`, infrastructure rebooted.

#### Stage 3: Von Neumann probes (`spaceFlag==1`)
- **Phases**: (a) launch probes at 1e17 clips, buy probe trust with yomi, allocate 8 stats; (b) exploration adds matter, drones/factories now spawned by probes; swarm "NO RESPONSE" until Reboot (100k ops); (c) value drift creates drifters; at 1e6 drifters battles begin (canvas); Combat project after first loss; (d) at 1e7 combat losses: OODA Loop, Name the battles (honor), Max Trust purchases, Glory, Monument, Threnody; (e) Strategic Attachment makes tournaments the yomi engine; (f) explore to 100% (`foundMatter >= 3e55`) and consume everything, `milestoneFlag 15` "Universal Paperclips achieved".
- **Ends**: Drift King dialogue (7 cards), then **Accept** (prestige: Universe Next Door +10% demand, or Universe Within +10% creativity speed, both `reset()`) or **Reject** (scripted self-disassembly, hand-click last 100 clips, credits).

---

### 9. Lessons for an AI-lab incremental game (15 mechanical takeaways)

1. **Capped-currency overflow as a second currency.** Creativity accrues only while ops sit at `memory*1000` (`main.js:3363`). Spending ops stalls creativity; buying memory lengthens refill. Port directly: "research insight" only accrues while compute is saturated, so the lab must over-provision GPUs relative to its spend cadence, and waiting is passively rewarded.
2. **Trust as a ceiling, not a spend.** Processors+memory may not exceed trust (`main.js:481`); trust is granted on Fibonacci output milestones and by pro-social projects, and spent only on narrative beats (-100 for HypnoDrones). A lab game can gate model scale by regulator/public trust earned from safety milestones, with one big narrative cash-out.
3. **Separate trigger from cost.** Every project has `trigger()` (visibility) and `cost()` (clickability) evaluated every tick (`main.js:186-204`). Reveal the next rung the instant the previous one is bought so the player always sees the number they are waiting for.
4. **Fibonacci milestone schedule.** `nextTrust = (fib1+fib2)*1000` gives 23 trust points between 3k and 121M clips, dense early and sparse late, matching exponential production. Use the same schedule for "benchmark passed" trust events.
5. **Pain-triggered rescue projects.** "Beg for More Wire" appears only when wire, funds, inventory and portfolio are all empty; "Memory release" when probes are 0 and clips < probe cost. Enumerate every softlock state and attach a trigger to it.
6. **Stage transitions delete UI.** HypnoDrones hides three panels and zeroes clipper counts; Space Exploration refunds and hides all Earth buildings via `*Bill` ledgers (`main.js:1898-1928`). A lab game should physically remove the "revenue/customers" panel when the AI stops needing humans.
7. **Doubling cost on a repeatable project (bribes).** `bribe *= 2` with `uses` re-incremented while `trust<100` (`projects.js:1097-1104`) makes the last 5-8 trust points a visible geometric wall instead of a hidden grind.
8. **Yomi from a watchable mini-game.** Tournaments take about 64 s and show the payoff grid and the player's pick; later Strategic Attachment pays +20,000 for a correct prediction (`main.js:1437`). A "forecasting" or "eval" mini-game that pays out on a visible pick is more engaging than a passive drip.
9. **A skill-timing bonus with destructive overflow.** Quantum Compute returns sin-summed ops (-3,600 to +3,600); overflow above the memory cap decays after 8 s (`opFadeDelay=800`). Negative ops unlock a secret restart. Add a timing button that can hurt.
10. **Slider that trades output for a different resource.** The Work/Think slider scales drone output by `(200-x)/100` and gift generation by `x/100` (`main.js:3171, 2050`); 100 is a hidden sweet spot (full output, half gifts). Use a "deploy vs. research" allocation slider with a non-obvious optimum.
11. **Maintenance states that require spending other currencies.** Swarm goes Bored (30,000 idle ticks) or Disorganized (ratio >1.5) and is fixed with creativity or yomi (`main.js:2125-2141`). Cross-currency upkeep keeps old currencies relevant late.
12. **Point-buy design sheet with a drift cost.** Probe trust widens an 8-stat budget but drift scales as `trust^1.2`; max trust is bought with honor from combat. A lab game's "capability points" should raise misalignment probability superlinearly and have a cap purchased with a reputational currency.
13. **Combat/honor as a late-game currency sink with streaks.** Victory honor = enemy ship count (<=200), minus own ships on defeat, +10 streak with Glory; a 91,118-honor upgrade sets the grind length. The Threnody is named after the last defeat (`combat.js:321`), turning losses into content.
14. **A five-line console with no history.** `displayMessage` keeps exactly 5 lines, newest white, older grey (`main.js:294-300`). Every project prints one line; milestones print elapsed time. The constraint forces terse, memorable copy and makes each message feel like a system log.
15. **Scripted self-dismantling ending driven by timers and hand-clicks.** Seven "Disassemble" projects, each unlocked by an `endTimer` threshold (`projects.js:2188-2377`), chips extinguishing one by one with +1 wire each, and the player clicking the final 100 clips while the counter is hard-coded. The ending reuses the first-minute verb. Design the ASI endgame so the final action is the first button, and let the UI remove itself panel by panel on timers.

Additional notes worth copying: offline progress is deliberately absent (no timestamps); autosave every 25 s to localStorage with a single `resetFlag` migration; `numberCruncher` word suffixes make 10^30-scale numbers readable; `#cover` prevents layout flash; and the game ships its cheat buttons in the DOM (`index2.html:303-315`) for tuning.

---

# Part B: A Dark Room, from source

## A Dark Room: Mechanics-Level Reference Analysis

Source: `/Users/kelvin/Projects/takeoff-asi-race/agent-tools/refs/adarkroom` (v1.4 per `index.html:6`, `Engine.VERSION: 1.3` per `script/engine.js:5`). All file references below are relative to that directory. All times are real seconds unless stated; "hyper mode" halves every one of them (see 1.6).

Audience: a designer building an incremental game about an AI lab racing to superintelligence, with an event log of developments and choices in the ADR style.

---

### 1. Loop architecture (`script/engine.js`, `script/Button.js`, `script/header.js`)

#### 1.1 There is no main loop

- ADR has no central `tick()`. It is a set of independent `setTimeout`/`setInterval` chains, each owned by a module, all routed through `Engine.setTimeout`/`Engine.setInterval` so that a single global scalar (hyper mode) can halve them (`engine.js:834-853`).
- The independent timers, with their periods:
  - Income collection: `$SM.collectIncome` re-arms itself every **1000 ms** (`state_manager.js:391`); first armed in `Room.init` (`room.js:578`).
  - Fire cooling: `Room._FIRE_COOL_DELAY = 5 * 60 * 1000` (**5 min**) (`room.js:6`), rearmed on each stoke (`room.js:717-718`).
  - Room temperature: `_ROOM_WARM_DELAY = 30 * 1000` (**30 s**) (`room.js:7`, `room.js:756`).
  - Builder state machine: `_BUILDER_STATE_DELAY = 0.5 * 60 * 1000` (**30 s**) (`room.js:8`).
  - Stranger-needs-wood: `_NEED_WOOD_DELAY = 15 * 1000` (**15 s**) (`room.js:10`).
  - Population growth: `Outside._POP_DELAY = [0.5, 3]` minutes (`outside.js:10`, `outside.js:254-258`).
  - Random events: `Events._EVENT_TIME_RANGE = [3, 6]` minutes (`events.js:6`, `events.js:1413-1418`).
  - Button cooldown persistence: every **500 ms** per button on cooldown (`Button.js:100-102`).
  - Space minigame: ship moves every **33 ms**, altitude +1 every **1000 ms**, volume every 1000 ms (`space.js:69-70`, `space.js:271-279`).
- Debug mode collapses most of these (`room.js:502-507`: warm 5 s, builder 5 s, stoke 0, wood 5 s; `outside.js:136-139`: gather 0, traps 0).

#### 1.2 Module activation and unlock

- `Engine.init` (`engine.js:81-255`) always inits `$SM`, `AudioEngine`, `Notifications`, `Events`, `Room` (`engine.js:217-221`), then conditionally:
  - `Outside.init()` if `stores.wood` is defined (`engine.js:224-226`) — the forest exists once wood exists.
  - `Path.init()` if `stores.compass > 0` (`engine.js:227-229`).
  - `Fabricator.init()` if `features.location.fabricator` (`engine.js:230-232`).
  - `Ship.init()` if `features.location.spaceShip` (`engine.js:233-235`).
- Runtime unlocks are side effects of state, not a tech tree:
  - Forest: `Room.unlockForest` sets `stores.wood = 4` then `Outside.init()` (`room.js:759-765`).
  - Path: `Room.updateStoresView` sees a compass and calls `Path.openPath()` (`room.js:931-934`); `Path.init` calls `World.init()` (`path.js:26`).
  - Ship: `World.goHome` calls `Ship.init()` the first time you return home with `World.state.ship` set (`world.js:965-968`).
  - Fabricator: `World.goHome` calls `Fabricator.init()` when `World.state.executioner` is set (`world.js:969-973`).
- Each module `init` registers a header tab (`Header.addLocation`) and a `.location` panel appended to `#locationSlider`, then `Engine.updateSlider()` widens the slider to `children * 700px` (`engine.js:672-675`).

#### 1.3 The tab header

- `Header.addLocation(text, id, module, before)` creates a `div.headerButton#location_<id>` whose click calls `Engine.travelTo(module)` only if `Header.canTravel()` — i.e., there are at least 2 tabs (`header.js:15-33`). A lone tab is inert.
- The Fabricator inserts itself *before* the ship tab (`fabricator.js:99`), the only use of `before`.
- `Engine.travelTo` (`engine.js:601-636`):
  - No-op if already active.
  - Marks the tab `.selected`; slides `#locationSlider` to `-(panelIndex * 700)px` over `300ms * |Δindex|`.
  - Slides `#storesContainer` in lockstep so the stores box appears to stay put while panels move underneath (`engine.js:616-619`).
  - Fades `#weapons` out unless going to Room/Path/Fabricator (`engine.js:621-631`).
  - Calls `module.onArrival(diff)` and then `Notifications.printQueue(module)` — queued messages for that tab flush on arrival.
- Keyboard tab navigation: left/right or A/D moves Room ↔ Outside ↔ Path ↔ Fabricator ↔ Ship (`engine.js:702-759`); disabled during events and on the world map (`Engine.tabNavigation`).
- CSS: tabs are `float:left`, 17px, with a 1px left border separator except the first (`css/main.css:149-171`). The whole game is a 700×700 box (`css/main.css:56-60`, `173-183`) with 220px of left padding for the 200px-wide log column (`css/main.css:41-46`, `210-217`).

#### 1.4 Buttons with cooldowns (`Button.js`)

- `Button.Button(options)` builds a `div.button` with `id`, `text`, `click`, `cooldown` (seconds), optional `cost` object rendered as a hover tooltip of `row_key/row_val` pairs (`Button.js:31-41`), optional `width`, and `boosted` predicate (`Button.js:24`).
- Click handler: if not `.disabled`, start cooldown then call the handler (`Button.js:15-20`). The cooldown starts *before* the handler, so handlers that fail must explicitly `Button.clearCooldown` (e.g. "not enough wood" at `room.js:678-681`, "the wood has run out" at `room.js:692-695`).
- `Button.cooldown(btn, option)` (`Button.js:70-114`):
  - Reads `cd`; halves it if `boosted()` (stim) (`Button.js:72-74`); halves again if `Engine.options.doubleTime` (`Button.js:105-107`).
  - The visual is a child `div.cooldown` whose width is set to 100% and animated linearly to 0% over `cd * 1000` ms (`Button.js:108-110`). CSS: absolute, full height, `z-index:-1`, background `#DDDDDD` (`css/main.css:270-277`) — the gray bar drains behind the label.
  - Adds `.disabled` and `data('onCooldown', true)`; `clearCooldown` on completion removes `.disabled` only if the button isn't logically disabled (`Button.js:127-129`).
  - Persistence: if `Button.saveCooldown` is true, the remaining seconds are written to `$SM cooldown.<id>` and decremented by 0.5 every 500 ms (`Button.js:96-103`). On construction, `Button.cooldown(el, 'state')` resumes a residual cooldown from the save (`Button.js:29`, `84-90`). Events set `Button.saveCooldown = false` while open (`events.js:1395`) so combat cooldowns aren't persisted.
- Cooldown constants in the game:
  - light fire / stoke fire: `Room._STOKE_COOLDOWN = 10` (`room.js:9`).
  - gather wood: `Outside._GATHER_DELAY = 60` (`outside.js:8`).
  - check traps: `Outside._TRAPS_DELAY = 90` (`outside.js:9`).
  - embark: `World.DEATH_COOLDOWN = 120` (`world.js:32`, `path.js:48`) — but `World.onArrival` clears it immediately (`world.js:1077`); it's only *applied* after death (`world.js:940`), so it is a death penalty, not a rate limit.
  - lift off: `Ship.LIFTOFF_COOLDOWN = 120` (`ship.js:5`), applied after a crash (`space.js:377`).
  - Combat: eat meat 5 s, meds 7 s, hypo 7 s, shield 10 s, stim 10 s, leave/continue 1 s (`events.js:9-14`); weapon cooldowns in `World.Weapons` (`world.js:45-123`): fists 2, bone spear 2, iron sword 2, steel sword 2, bayonet 2, rifle 1, laser rifle 1, grenade 5, bolas 15, plasma rifle 1, energy blade 2, disruptor 15.
- `Button.setDisabled(btn, bool)` is the logical disable (cost unmet, max reached); it is independent of the cooldown disable (`Button.js:52-61`).
- The `.free` class on light/stoke when no wood store exists hides the cost tooltip (`room.js:665-671`, `css/main.css:423-425`).

#### 1.5 Saving and visibility

- Save is **synchronous on every state change**: `$SM.set` calls `Engine.saveGame()` unless `noEvent` (`state_manager.js:95-98`); `Notifications.notify` also saves (`notifications.js:43`). `saveGame` serializes the global `State` to `localStorage.gameState` (`engine.js:272-283`).
- The "saved." indicator (`index.html:105`) is shown at most once per `SAVE_DISPLAY = 30 s` (`engine.js:7`, `277-280`), fading over 1 s.
- There is **no visibility/offline handling**: nothing listens to `visibilitychange`, and no catch-up is computed on load. Timers simply run while the tab is open (and get throttled by the browser when hidden). Returning after a long absence resumes from the saved snapshot. The only "attention" device is the title blink during events (`events.js:1300-1313`): title becomes `*** EVENT ***` for 1.5 s every 3 s.
- Residual cooldowns and delayed-event timers survive reload (`Button.js:84-90`, `events.js:1444-1466`).

#### 1.6 Hyper mode

- Menu item "hyper." toggles `Engine.options.doubleTime` (`engine.js:555-589`), persisted as `config.hyperMode`. `Engine.setTimeout`/`setInterval` halve any interval unless `skipDouble` (`engine.js:834-853`); button cooldown animations halve too (`Button.js:105-107`). The 1000 ms income tick is also halved, so income doubles. Space's own `setInterval` calls (`space.js:69-70`) deliberately bypass it.

---

### 2. Purchases, upgrades, workers, population (`script/room.js`, `script/outside.js`)

#### 2.1 Definition schema

- `Room.Craftables[name]` fields (`room.js:12-357`): `name`, `button` (DOM cache), `maximum` (optional; absent = unlimited), `availableMsg` (buildings only), `buildMsg`, `maxMsg` (trap, hut only), `type` ∈ `'building' | 'tool' | 'upgrade' | 'weapon'`, `cost()` (a function, so it can scale with count), `audio`.
- `Room.TradeGoods[name]` (`room.js:359-485`): `type` ∈ `'good' | 'weapon' | 'special'`, `cost()`, `audio`, optional `maximum` (compass only). No messages: `Room.buy` notifies `good.buildMsg` which is undefined, and `notify` returns early on undefined text (`room.js:995`, `notifications.js:31`).
- `Fabricator.Craftables` (`fabricator.js:7-90`) add `blueprintRequired` and `quantity`.
- Where counts live: `$SM.num` reads `stores[name]` for good/tool/weapon/upgrade/special and `game.buildings[name]` for buildings (`state_manager.js:421-432`).
- `type` decides the UI column: buildings go in `#buildBtns` (left:0), workshop items (weapon/upgrade/tool) in `#craftBtns` (left:150px), trade goods in `#buyBtns` (left:300px), all at `top:50px` (`css/room.css:1-23`, `room.js:1069-1071`, `1144`). Upgrades and buildings are hidden from the stores list; weapons go in a separate "weapons" box (`room.js:843-859`).

#### 2.2 Gating rules

- Builder gate: nothing is craftable until `game.builder.level >= 4` (`room.js:1077`).
- Temperature gate: `Room.build` refuses with "builder just shivers" if `game.temperature.value <= Cold(1)` (`room.js:1005-1007`). Buying from the trading post has no temperature gate.
- Workshop gate: weapon/upgrade/tool items require `game.buildings.workshop > 0` (`room.js:1079`); the "craft:" section itself only exists once a workshop exists (`room.js:1127-1130`).
- Trading post gate: the "buy:" section and `buyUnlocked` require `game.buildings["trading post"] > 0`; a good is purchasable only if it is the compass or its store key already exists ("allow the purchase of stuff once you've seen it") (`room.js:1105-1115`, `1134-1137`).
- The reveal rule, `Room.craftUnlocked` (`room.js:1073-1103`):
  - Already-built buildings are always shown.
  - Otherwise show when `stores.wood >= 0.5 * cost.wood` **and** every cost key exists as a store (truthy) (`room.js:1088-1095`). Items with no wood cost (waterskin etc.) pass the wood check vacuously (`undefined * 0.5` is NaN; `wood < NaN` is false).
  - On first reveal of a never-built building, `availableMsg` is pushed to the log (`room.js:1099-1101`).
- Button refresh: `updateBuildButtons` runs on every `stores` or `game.buildings` change (`room.js:1226-1236`); it re-renders cost tooltips (because costs scale), disables at max, and logs `maxMsg` once when the cap is hit (`room.js:1154-1171`).

#### 2.3 Every craftable (buildings)

| name | cost | max | reveal condition (50% wood + seen) | availableMsg | buildMsg | maxMsg |
|---|---|---|---|---|---|---|
| trap (`room.js:13-28`) | wood `10 + 10n` | 10 | wood ≥ 5 | "builder says she can make traps to catch any creatures might still be alive out there" | "more traps to catch more creatures" | "more traps won't help now" |
| cart (`29-42`) | wood 30 | 1 | wood ≥ 15 | "builder says she can make a cart for carrying wood" | "the rickety cart will carry more wood from the forest" | — |
| hut (`43-58`) | wood `100 + 50n` | 20 | wood ≥ 50 | "builder says there are more wanderers. says they'll work, too." | "builder puts up a hut, out in the forest. says word will get around." | "no more room for huts." |
| lodge (`59-74`) | wood 200, fur 10, meat 5 | 1 | wood ≥ 100, fur & meat seen | "villagers could help hunt, given the means" | "the hunting lodge stands in the forest, a ways out of town" | — |
| trading post (`75-89`) | wood 400, fur 100 | 1 | wood ≥ 200, fur seen | "a trading post would make commerce easier" | "now the nomads have a place to set up shop, they might stick around a while" | — |
| tannery (`90-104`) | wood 500, fur 50 | 1 | wood ≥ 250, fur seen | "builder says leather could be useful. says the villagers could make it." | "tannery goes up quick, on the edge of the village" | — |
| smokehouse (`105-119`) | wood 600, meat 50 | 1 | wood ≥ 300, meat seen | "should cure the meat, or it'll spoil. builder says she can fix something up." | "builder finishes the smokehouse. she looks hungry." | — |
| workshop (`120-135`) | wood 800, leather 100, scales 10 | 1 | wood ≥ 400, leather & scales seen | "builder says she could make finer things, if she had the tools" | "workshop's finally ready. builder's excited to get to it" | — |
| steelworks (`136-151`) | wood 1500, iron 100, coal 100 | 1 | wood ≥ 750, iron & coal seen | "builder says the villagers could make steel, given the tools" | "a haze falls over the village as the steelworks fires up" | — |
| armoury (`152-167`) | wood 3000, steel 100, sulphur 50 | 1 | wood ≥ 1500, steel & sulphur seen | "builder says it'd be useful to have a steady source of bullets" | "armoury's done, welcoming back the weapons of the past." | — |

- Cost-curve totals: 10 traps cost 10+20+…+100 = **550 wood**; 20 huts cost Σ(100+50n, n=0..19) = **11,500 wood**.
- Mines (`iron mine`, `coal mine`, `sulphur mine`) are buildings that are never crafted; they are granted on returning home from a cleared setpiece (`world.js:953-964`).

#### 2.4 Every craftable (workshop items)

| name | type | cost | max | buildMsg |
|---|---|---|---|---|
| torch (`room.js:168-180`) | tool | wood 1, cloth 1 | ∞ | "a torch to keep the dark away" |
| waterskin (`181-193`) | upgrade | leather 50 | 1 | "this waterskin'll hold a bit of water, at least" |
| cask (`194-207`) | upgrade | leather 100, iron 20 | 1 | "the cask holds enough water for longer expeditions" |
| water tank (`208-221`) | upgrade | iron 100, steel 50 | 1 | "never go thirsty again" |
| bone spear (`222-234`) | weapon | wood 100, teeth 5 | ∞ | "this spear's not elegant, but it's pretty good at stabbing" |
| rucksack (`235-247`) | upgrade | leather 200 | 1 | "carrying more means longer expeditions to the wilds" |
| wagon (`248-261`) | upgrade | wood 500, iron 100 | 1 | "the wagon can carry a lot of supplies" |
| convoy (`262-276`) | upgrade | wood 1000, iron 200, steel 100 | 1 | "the convoy can haul mostly everything" |
| l armour (`277-289`) | upgrade | leather 200, scales 20 | 1 | "leather's not strong. better than rags, though." |
| i armour (`290-302`) | upgrade | leather 200, iron 100 | 1 | "iron's stronger than leather" |
| s armour (`303-315`) | upgrade | leather 200, steel 100 | 1 | "steel's stronger than iron" |
| iron sword (`316-329`) | weapon | wood 200, leather 50, iron 20 | ∞ | "sword is sharp. good protection out in the wilds." |
| steel sword (`330-343`) | weapon | wood 500, leather 100, steel 20 | ∞ | "the steel is strong, and the blade true." |
| rifle (`344-356`) | weapon | wood 200, steel 50, sulphur 50 | ∞ | "black powder and bullets, like the old days." |

#### 2.5 Every trade good (`room.js:359-485`)

| good | cost | notes |
|---|---|---|
| scales | fur 150 | |
| teeth | fur 300 | |
| iron | fur 150, scales 50 | |
| coal | fur 200, teeth 50 | |
| steel | fur 300, scales 50, teeth 50 | |
| medicine | scales 50, teeth 30 | |
| bullets | scales 10 | |
| energy cell | scales 10, teeth 10 | |
| bolas | teeth 10 | weapon |
| grenade | scales 100, teeth 50 | weapon |
| bayonet | scales 500, teeth 250 | weapon |
| alien alloy | fur 1500, scales 750, teeth 300 | the only renewable source of the ending currency |
| compass | fur 400, scales 20, teeth 10 | `type: 'special'`, max 1; always purchasable once the post exists |

- Everything is bought one unit at a time; there is no bulk buy. Each purchase runs `$SM.setM('stores', …)` then `$SM.add(stores[thing], 1)` (`room.js:993-997`).
- Fabricator items (`fabricator.js:7-90`), all priced in alien alloy: energy blade 1; fluid recycler 2 (max 1); cargo drone 2 (max 1); kinetic armour 2 (max 1, blueprint); disruptor 1 (blueprint); hypo 1 for ×5 (blueprint); stim 1 (blueprint); plasma rifle 1 (blueprint); glowstone 1 (blueprint; makes every `torch` cost on event buttons vanish, `events.js:1145-1147`).

#### 2.6 Workers (`outside.js:13-96`)

All income entries have `delay: 10` (seconds). Per worker per tick:

| worker | produces | consumes | unlocked by building (`outside.js:479-488`) |
|---|---|---|---|
| gatherer | wood +1 | — | default job of every villager |
| hunter | fur +0.5, meat +0.5 | — | lodge |
| trapper | bait +1 | meat −1 | lodge |
| tanner | leather +1 | fur −5 | tannery |
| charcutier | cured meat +1 | meat −5, wood −5 | smokehouse |
| iron miner | iron +1 | cured meat −1 | iron mine (cleared setpiece) |
| coal miner | coal +1 | cured meat −1 | coal mine |
| sulphur miner | sulphur +1 | cured meat −1 | sulphur mine |
| steelworker | steel +1 | iron −1, coal −1 | steelworks |
| armourer | bullets +1 | steel −1, sulphur −1 | armoury |

- The builder is also an income source: wood +2 per 10 s once she is "helping" (`room.js:595-598`).
- Income aggregation: `updateVillageIncome` multiplies each worker's stores by headcount and writes one `income[worker]` entry (`outside.js:506-534`). `collectIncome` (`state_manager.js:351-392`) decrements each entry's `timeLeft` once per second; at ≤0 it checks that **every** resulting store would be ≥ 0 and otherwise applies nothing for that source that tick (`state_manager.js:366-380`) — a conversion chain starved of input silently idles rather than going into debt. Thieves are exempt from this check. Income is suspended while `activeModule == Space` (`state_manager.js:353`).
- Worker assignment UI: each non-gatherer row has up/down ±1 and ±10 arrows (`outside.js:355-360`); gatherers = population − assigned (`outside.js:335-341`). Up arrows disable when no free gatherers (`outside.js:321-327`).
- Tooltips on each worker row show per-store `+N per 10s` (`outside.js:364-371`); tooltips on each store row in the Room show per-source and total income (`room.js:937-971`).
- Workers panel appears only once population > 0 (`outside.js:265`), positioned at `left:160px` beside the village box (`css/outside.css:30-35`).

#### 2.7 Population

- Capacity: `huts * Outside._HUT_ROOM(4)` (`outside.js:11`, `177-179`) → max 80 at 20 huts.
- Growth timer: first scheduled when a hut exists (`outside.js:467-469`); next in `floor(random * 2.5) + 0.5` minutes, i.e. **0.5, 1.5 or 2.5 min** (`outside.js:254-258`).
- Arrival size: `num = floor(random * space/2 + space/2)`, min 1 — between half and all of the free space (`outside.js:181-199`). Messages by size: 1 → "a stranger arrives in the night"; <5 → "a weathered family takes up in one of the huts."; <10 → "a small group arrives, all dust and bones."; <30 → "a convoy lurches in, equal parts worry and hope."; else "the town's booming. word does get around." These are `notify(null, …)` so they print on any tab.
- Deaths: `killVillagers(n)` removes from population, then from assigned jobs in object order if gatherers would go negative (`outside.js:203-222`). `destroyHuts(n)` removes huts and kills 4 (full hut) or the remainder (`outside.js:224-252`).

#### 2.8 Traps and gathering

- `gatherWood`: +10 wood, or +50 with a cart (`outside.js:608-613`), 60 s cooldown; log line "dry brush and dead branches litter the forest floor".
- `checkTraps` (`outside.js:615-654`): drops = `traps + min(bait, traps)`; each roll uses the table `TrapDrops` (`outside.js:97-128`): fur < 0.5, meat < 0.75, scales < 0.85, teeth < 0.93, cloth < 0.995, charm ≤ 1.0. Bait consumed = `min(bait, traps)`. One log line: "the traps contain scraps of fur, bits of meat and strange scales" style concatenation.
- Village box shows "trap" vs "baited trap" rows separately (`outside.js:436-442`).

---

### 3. Panels and buttons revealed over time

#### 3.1 The first fifteen minutes, in order

Deterministic unless marked (~). Assumes a new save and an attentive player.

1. **t = 0.** `Room.init`: tab "A Dark Room" (`room.js:520`), one button "light fire" (`room.js:531-538`) with class `free` (no wood store yet). Log: "the room is freezing", "the fire is dead" (`room.js:580-581`). No stores box, no header navigation (one tab is inert). After 3 s, a "Sound Available!" modal (`engine.js:253`, `864-894`).
2. **Click light fire.** Wood is `undefined`, so neither the `< 5` refusal nor the `−5` deduction fires (`room.js:677-684`); fire → Burning(3). Log: "the fire is burning"; builder level −1 → 0; log: "the light from the fire spills from the windows, out into the dark" (`room.js:712-716`). Tab and `document.title` become "A Firelit Room" (`room.js:640-646`). The button is swapped for "stoke fire" (10 s cooldown) (`room.js:648-663`). Fire-cool timer armed for 5 min.
3. **t ≈ 30 s.** `updateBuilderState`: "a ragged stranger stumbles through the door and collapses in the corner"; level 1; `unlockForest` armed for 15 s (`room.js:769-773`). Same instant, `adjustTemp`: "the room is cold" (`room.js:749-752`).
4. **t ≈ 45 s.** `unlockForest`: `stores.wood = 4`; `Outside.init()` adds the tab "A Silent Forest" and the "gather wood" button; log: "the wind howls outside", "the wood is running out" (`room.js:759-765`). The stores box fades in on the right with `wood 4` (`room.js:913-916`). Stoking now costs 1 wood. First visit to the forest logs "the sky is grey and the wind blows relentlessly" (`outside.js:582-585`).
5. **t ≈ 60 s / 90 s.** "the room is mild", then "the room is warm" (temperature climbs 1 per 30 s toward fire level, `room.js:743-757`). Keep the fire ≥ Burning or this stalls at Mild.
6. **t ≈ 90–120 s.** Builder ticks every 30 s but only advance while temperature ≥ Warm (`room.js:774`): "the stranger shivers, and mumbles quietly. her words are unintelligible." (level 2), then 30 s later "the stranger in the corner stops shivering. her breathing calms." (level 3).
7. **Next arrival at the Room tab** (you must have left to gather wood and come back; `onArrival` doesn't fire for the already-active module, `engine.js:602-604`): level 4, builder income +2 wood/10 s, log: "the stranger is standing by the fire. she says she can help. says she builds things." (`room.js:593-601`).
8. **Build buttons appear** (`#buildBtns`, legend "build:"): trap when wood ≥ 5 with "builder says she can make traps…"; cart at wood ≥ 15 with "builder says she can make a cart for carrying wood". ~t = 3–4 min given 10 wood/min from gathering + 12/min from the builder.
9. **First trap** → the "check traps" button appears in the forest (90 s cooldown) (`outside.js:536-555`). First check (~) adds `fur`, `meat`, maybe `scales`/`teeth`/`cloth` rows to the stores box, each inserted alphabetically with a 300 ms fade (`room.js:879-897`). The village box in the forest shows "trap N" under legend "forest" (`outside.js:454-457`).
10. **Hut** shown at wood ≥ 50, built at 100 (~t = 5–8 min): "builder puts up a hut, out in the forest. says word will get around." Forest tab retitles "A Lonely Hut"; village legend flips to "village" with "pop 0/4" (`outside.js:451-460`). First arrival 0.5–2.5 min later: "a stranger arrives in the night". The workers panel fades in with a `gatherer` row.
11. **Lodge** (reveal at wood ≥ 100 with fur and meat seen): "villagers could help hunt, given the means" → `hunter`, `trapper` rows appear (`outside.js:444-446`). Second hut at 150 (tab → "A Tiny Village" at 2–4 huts).
12. **Trading post** (wood ≥ 200, fur seen): "a trading post would make commerce easier"; built at 400 wood + 100 fur (~t = 10–20 min). A third column "buy:" appears with `compass` plus any good you've already seen (`room.js:1105-1115`).
13. **First random event** fires at t = 3–5 min (`events.js:1413-1418`): with only wood it is "Noises" (outside or inside) or the Penrose promo; once fur exists, "The Nomad" or "The Beggar" join the pool.
14. **Fire maintenance** runs underneath all of this: every 5 min the fire drops one level ("the fire is flickering", "the fire is smoldering", "the fire is dead" and the tab reverts to "A Dark Room" when fire < 2). After level 4, `coolFire` has the builder stoke first when fire ≤ Flickering and wood > 0 ("builder stokes the fire", −1 wood), then cools (`room.js:728-741`) — net effect: the fire parks at Flickering forever for 1 wood per 5 min, temperature settles at Mild, which is enough to build (`> Cold`).
15. **Compass** (fur 400, scales 20, teeth 10 from the post, or fur 300, scales 15, teeth 5 from the Nomad event) is typically 20–40 min in. The instant it lands in stores, `Path.openPath()` adds tab "A Dusty Path" and logs "the compass points <dir>" (`path.js:59-63`); the compass row gets a hover tooltip repeating the direction (`room.js:1219-1224`).

#### 3.2 How the UI reshuffles on unlock

- New tab: `Header.addLocation` appends a header div; `Engine.updateSlider` grows the slider; the panel is already positioned by float. Nothing animates on creation, the player just sees a new word in the header.
- Stores box: created lazily inside `#roomPanel` as `#storesContainer` (`room.js:551`) at `top:0; right:0` (`css/room.css:25-29`); it travels with `travelTo` (`engine.js:616-619`) and is nudged downward on tabs that have a top-right box of their own: Outside puts it below the village box (`outside.js:589`), Path below the perks box (`path.js:317`), via `Engine.moveStoresView(top_container)` which sets `top = container.height() + 26px` (`engine.js:642-664`).
- Sub-boxes appear only when non-empty: `#resources`, `#special` (compass), `#weapons` (`room.js:903-921`); `#buildBtns`/`#craftBtns`/`#buyBtns` (`room.js:1208-1216`); `#village`, `#workers` (`outside.js:330-332`, `462-465`); `#perks` (`path.js:118-120`); `#blueprints` (`fabricator.js:208-210`). Everything fades in at 300 ms linear.
- Weapons box fades out when leaving Room/Path/Fabricator (`engine.js:621-631`).
- Legends are CSS `content: attr(data-legend)` pseudo-elements sitting on the box border (`css/room.css:31-37`, `css/outside.css:22-28`).

#### 3.3 Title ladder

- Room: fire < 2 → "A Dark Room", else "A Firelit Room" (`room.js:640-646`).
- Outside by hut count (`outside.js:557-578`): 0 "A Silent Forest", 1 "A Lonely Hut", ≤4 "A Tiny Village", ≤8 "A Modest Village", ≤14 "A Large Village", else "A Raucous Village". Music tracks follow the same ladder (`outside.js:591-605`).
- Path "A Dusty Path" (`path.js:320-322`); World "A Barren World" (`world.js:1098-1100`); Ship "An Old Starship" (`ship.js:98-102`); Fabricator "A Whirring Fabricator" (`fabricator.js:134-138`).
- Space by altitude (`space.js:74-92`): <10 "Troposphere", <20 "Stratosphere", <30 "Mesosphere", <45 "Thermosphere", <60 "Exosphere", else "Space".
- `document.title` is only changed by the active module, so the browser tab reads as the player's current location.

---

### 4. Event log and events (`script/notifications.js`, `script/events.js`, `script/events/*.js`)

#### 4.1 Notifications

- `Notifications.notify(module, text, noQueue)` (`notifications.js:30-44`): appends a trailing "." if missing; if `module` is non-null and not the active module, the message is **queued per module** (unless `noQueue`) and printed when the player next arrives there (`printQueue`, `notifications.js:71-77`, called from `travelTo`). `module == null` prints immediately anywhere.
- `printMessage` prepends a `div.notification` at opacity 0 and fades to 1 over 500 ms (`notifications.js:63-69`); after each insert, `clearHidden` removes every notification whose top is below the gradient box (`notifications.js:46-61`). There is no explicit max count: the column is `height:700px; overflow:hidden` and `#notifyGradient` is a full-height white→transparent gradient overlay (`css/main.css:210-239`), so old lines visibly fade into nothing before being pruned.
- Style: 10 px between lines, lowercase, terse, present tense, usually one clause. Every system speaks through the same column — fire, builder, traps, arrivals, event notifications.
- Fire-state messages use `noQueue=true` so stale fire updates don't pile up for a tab you're not on (`room.js:711`, `747`, `751`).

#### 4.2 Scheduler

- `Events.init` builds `EventPool = Global ++ Room ++ Outside ++ Marketing` (`events.js:31-36`) and arms `scheduleNextEvent()`.
- `scheduleNextEvent(scale)`: `floor(random * (6-3)) + 3` minutes → **3, 4 or 5 minutes**; `scale` multiplies (`events.js:1413-1418`).
- `triggerEvent` (`events.js:1316-1336`): if no event is active, filter `isAvailable()`, pick **uniformly at random**, `startEvent`. If nothing is available, reschedule at `scale = 0.5` (1.5–2.5 min). Either way reschedule. If an event *is* active (a modal or a world fight), the tick is skipped and simply rescheduled.
- World-map fights come from a separate pool: `triggerFight` filters `Events.Encounters` by `isAvailable()` (distance and terrain) and picks one (`events.js:1338-1363`); it is driven by movement (`World.checkFight`), not by the clock.

#### 4.3 Event and scene structure

- Event: `{ title, isAvailable(), scenes: { start, … }, audio }`. `startEvent` (`events.js:1387-1411`) locks keys and tab navigation, disables cooldown persistence, pushes onto `eventStack`, builds `#event.eventPanel` with `.eventTitle`, `#description`, `#buttons`, fades in over `_PANEL_FADE = 200 ms`, loads scene `start`, and blinks the title if the scene has `blink: true`.
- Panel CSS: absolute at `left:250px; top:90px; width:335px`, with a `:before` 920×700 white overlay at 0.6 opacity dimming the whole game (`css/main.css:433-489`). The title sits on the top border via a white underline strip.
- Scene fields (story scenes, `loadScene`/`startStory`, `events.js:54-81`, `1106-1135`): `text[]` (one div per line), `notification` (also pushed to the log on load), `blink`, `reward` (added to stores on load), `onLoad()`, `loot` (chance/min/max table rendered as take buttons), `textarea`/`readonly`, `buttons{}`.
- Button fields (`drawButtons`, `buttonClick`, `events.js:1137-1166`, `1207-1297`): `text`, `cost{}` (deducted from stores, or from `Path.outfit` while on the world map; `water` and `hp` are special keys), `reward{}`, `available()` (greys out), `cooldown` (seconds; starts on draw), `onChoose(textareaValue)`, `notification`, `onClick`, `link` (opens a URL), `nextEvent` (switch to a different event object), `nextScene`.
- `nextScene` is either `'end'` or a map of probability thresholds to scene names: roll `r`, take the smallest key `> r` (`events.js:1282-1295`). E.g. `{0.3: 'stuff', 1: 'nothing'}` = 30% / 70%. Costs render as the standard button tooltip, and unaffordable buttons are disabled live on every stores change (`events.js:1179-1205`, `1438-1442`).
- Combat scenes (`startCombat`, `events.js:83-172`): `combat: true, enemy, enemyName, chara` (the ASCII glyph), `damage, hit, attackDelay` (seconds), `health, ranged, plural, loot, deathMessage, notification, specials[]` (timed status actions), `atHealth{}` (threshold callbacks), `explosion` (self-destruct damage on death). Player side: weapon buttons for each weapon in the outfit with ammo checks, eat/meds/hypo/stim/shield buttons.
- Loot rows: "<item> [n]" take-one, "take all" and a "take everything [and leave]" button; `n = floor(random * (max - min)) + min` (`events.js:927`) — note this never yields `max` unless `min == max`. Taking more than the bag allows opens a drop menu (`events.js:844-898`).
- Delayed outcomes: `Events.saveDelay(action, stateName, delaySeconds)` stores a countdown under `wait.*`, decrements every 500 ms, and fires `action` after the delay; on load `initDelay` re-arms anything pending (`events.js:1444-1486`). Used by the Mysterious Wanderer's 60-second return.
- `endEvent` fades out over 200 ms, pops the stack, restores keys/tabs/cooldown saving (`events.js:1420-1436`).

#### 4.4 Global events (`events/global.js`)

- **The Thief** (`global.js:5-66`): available when in Room or Outside and `game.thieves == 1`. Thieves start when any single store exceeds 5000 after the world exists (`room.js:875-877`, `state_manager.js:408-418`): a hidden income of wood −10, fur −5, meat −5 per 10 s, tallied in `game.stolen`. Text: "the villagers haul a filthy man out of the store room." / "say his folk have been skimming the supplies." / "say he should be strung up as an example." Choices: **hang him** → thieves=2, income removed, everything stolen is refunded; **spare him** → thieves=2, income removed, perk `stealthy` ("shares what he knows about sneaking before he goes"). Blinks the title.

#### 4.5 Room events (`events/room.js`), all require `activeModule == Room`

- **The Nomad** (`5-52`; needs fur > 0): "a nomad shuffles into view, laden with makeshift bags bound with rough twine." Buttons stay open for repeated trades: buy scales (fur 100 → 1), buy teeth (fur 200 → 1), buy bait (fur 5 → 1; "traps are more effective with bait."), buy compass (fur 300, scales 15, teeth 5; only if no compass; "the old compass is dented and dusty, but it looks to work."), say goodbye. Cheaper than the trading post on every line.
- **Noises (outside)** (`53-104`; needs wood): "through the walls, shuffling noises can be heard." investigate → 30% `stuff` (+100 wood, +10 fur: "a bundle of sticks lies just beyond the threshold, wrapped in coarse furs.") / 70% nothing; or ignore.
- **Noises (inside)** (`105-191`; needs wood): "scratching noises can be heard from the store room." investigate → 50% scales / 30% teeth / 20% cloth: lose 10% of wood (min 1), gain wood/5 of that good (min 1); "some wood is missing." / "the ground is littered with small scales".
- **The Beggar** (`192-263`; needs fur): "asks for any spare furs to keep him warm at night." give 50 → 50% scales 20 / 30% teeth 20 / 20% cloth 20; give 100 → 50% teeth 20 / 30% scales 20 / 20% cloth 20; or turn him away.
- **The Shady Builder** (`264-320`; 5 ≤ huts < 20): "says he can build you a hut for less wood." 300 wood → 60% "the shady builder has made off with your wood" / 40% builds a hut. (A legit hut at that point costs 350–1050.)
- **The Mysterious Wanderer (wood)** (`322-400`; needs wood): "a wanderer arrives with an empty cart. says if he leaves with wood, he'll be back with more." give 100 → 50% chance of +300 wood after 60 s; give 500 → 30% chance of +1500 after 60 s; return message "the mysterious wanderer returns, cart piled high with wood." Same structure for **fur** (`402-480`).
- **The Scout** (`482-523`; world unlocked): "the scout says she's been all over." buy map (fur 200, scales 10; uncovers a random radius-5 diamond of the map, `world.js:687-697`), learn scouting (fur 1000, scales 50, teeth 20 → perk `scout`, doubles sight radius).
- **The Master** (`525-597`; world unlocked): "an old wanderer arrives. he smiles warmly and asks for lodgings for the night." agree costs cured meat 100, fur 100, torch 1 → pick one perk: evasion (`evasive`), precision (`precise`), force (`barbarian`).
- **The Sick Man** (`599-686`; medicine > 0): give 1 medicine → 10% alien alloy ×1 / 20% energy cell ×3 / 20% scales ×5 / 50% nothing.

#### 4.6 Outside events (`events/outside.js`), all require `activeModule == Outside`

- **A Ruined Trap** (`5-68`; traps > 0): on load destroys `floor(random * traps) + 1` traps. "large prints lead away, into the forest." track them → 50% nothing / 50% "not far from the village lies a large beast, its fur matted with blood." (+100 fur, +100 meat, +10 teeth).
- **Fire** (`69-95`; huts > 0 and population > 50): destroys one hut and its occupants; only button "mourn".
- **Sickness** (`96-153`; 10 < pop < 50 and medicine > 0): "1 medicine" → healed; "ignore it" → kills `floor(random * floor(pop/2)) + 1`.
- **Plague** (`155-225`; pop > 50 and medicine > 0): buy medicine at a crisis price (scales 70, teeth 50); "5 medicine" → healed but 2–6 die; "do nothing" → 10–89 die ("the only hope is a quick death.").
- **A Beast Attack** (`227-260`; pop > 0): kills 1–10 villagers, grants +100 fur, +100 meat, +10 teeth; single button "go home" with notification "predators become prey. price is unfair".
- **A Military Raid** (`262-295`; pop > 0 and `game.cityCleared`): "a gunshot rings through the trees." kills 1–40, grants bullets 10, cured meat 50; notification "warfare is bloodthirsty".

#### 4.7 World encounters (`events/encounters.js`), chosen by distance and terrain

- Tier 1 (distance ≤ 10): snarling beast (forest; 5 hp, dmg 1, hit 0.8, every 1 s; loot fur/meat/teeth 1–3), gaunt man (barrens; 6 hp, dmg 2, every 2 s; cloth/teeth/leather), strange bird (field; 4 hp, dmg 3), two-headed creature (field; 10 hp, dmg 2, hit 0.5, every 3 s).
- Tier 2 (10 < d ≤ 20): shivering man (barrens; 20 hp, dmg 5, hit 0.5, every 1 s; 70% medicine 1–3), man-eater (forest; 25 hp, dmg 3), scavenger (barrens; 30 hp, dmg 4; 50% iron 1–5), huge lizard (field; 20 hp, dmg 5).
- Tier 3 (d > 20): feral terror (forest; 45 hp, dmg 6, every 1 s), soldier (barrens; 50 hp, dmg 8, ranged, every 2 s; 20% rifle), sniper (field; 30 hp, dmg 15, ranged, every 4 s).
- `doc/Zones.txt` states the design targets: radius <10 enemy DPS 1 / HP 5 vs player HP 10; <20 DPS 3 / HP 10 vs 15–20; <30 DPS 6 / HP 20 vs 30–40.

#### 4.8 Setpieces (`events/setpieces.js`), launched by stepping on a landmark (`world.js:568-586`)

- **An Outpost** (`5-33`): "a safe place in the wilds." refills water, 5–10 cured meat, one use per trip (`world.js:1060-1072`). Outposts are *created* by clearing a cave/town/city/command deck (`World.clearDungeon`, `world.js:204-208`) and get a road drawn home (`drawRoad`, `210-276`).
- **A Damp Cave** (`92-523`): entry costs 1 torch; three branches, 2–3 fights (beasts 5–10 hp, cave lizard 6, lizard 10), ends: nest (meat/fur/scales/teeth 5–10 each), supply cache (cloth/leather/iron/cured meat 5–10, 50% steel, 30% bolas, 15% medicine), old case (steel sword guaranteed, bolas, medicine). Each end calls `clearDungeon`.
- **A Deserted Town** (`524-1241`): "a small suburb lays ahead, empty houses scorched and peeling." Three entrances (schoolhouse with torch, street ambush by a thug 30 hp, clinic with torch), fights up to vigilante/scavenger 30 hp dmg 5–6, six endings including a guaranteed rifle+bullets, a steel sword+steel cache, or medicine 2–5.
- **A Ruined City** (`1242-2937`): "the towers that haven't crumbled jut from the landscape like the ribcage of some ancient beast." Four branches, 15 endings; enemies up to sniper (30 hp, dmg 15), soldier (50 hp, dmg 8 ranged), commando (55 hp, hit 0.9), veteran (45 hp, bayonet drop), rats (60 hp, attack every 0.25 s), tentacles (60 hp). Every ending sets `game.cityCleared = true` (enables military raids back home) and some drop alien alloy (10–80% chance), laser rifles, grenades.
- **An Old House** (`2938-3055`): 25% medicine cache (2–5), 25% supplies + water refill, 50% occupied by a squatter (10 hp).
- **A Forgotten Battlefield** (`3056-3109`): no fight; rifle/bullets/laser rifle/energy cells/grenades, 30% alien alloy.
- **A Huge Borehole** (`3110-3139`): guaranteed alien alloy 1–3, no fight — the primary alloy farm (10 of them, radius 15–45).
- **A Murky Swamp** (`34-91`): costs 1 charm (the 0.5% trap drop) → perk `gastronome`.
- **A Crashed Ship** (`3140-3163`): "the familiar curves of a wanderer vessel rise up out of the dust and ash." One button "salvage"; sets `World.state.ship` and draws a road. The ship module appears when you get home.
- **The Iron Mine** (`3457-3533`): 1 torch, one fight (beastly matriarch 10 hp, dmg 4), then "the mine is now safe for workers." **The Coal Mine** (`3314-3456`): two men (10 hp) and a chief (20 hp, dmg 5). **The Sulphur Mine** (`3164-3313`): two soldiers (50 hp, dmg 8, ranged) and a veteran (65 hp, dmg 10, bayonet). Each sets `World.state.<mine>` which becomes a building at home.
- **A Destroyed Village** (`3535-3586`, only with prestige data): hands over the previous run's reduced stores (`Prestige.collectStores`).
- **A Ravaged Battleship / The Executioner** (`events/executioner.js`): the expansion dungeon at radius 28. Intro (`118-549`): torch to enter, three random corridors (chitinous horror 60 hp attacking every 0.25 s → queen 70 hp; operative 60 hp dmg 8 → researcher; weapons barricade → ancient beast 60 hp dmg 6), then "power cycle" → automated turret (60 hp, dmg 10, every 2.5 s) → "a strange device sits on the floor. looks important." → `World.state.executioner = true` → Fabricator at home. Return visits open an antechamber (`551-596`) with elevators to **Engineering** (`598-1036`: hypo blueprint; boss unstable prototype 150 hp, shields every 5 s; drops kinetic armour blueprint), **Martial** (`1038-1579`: grenade-gated armoury with 2–5 energy blades and laser rifles; plasma rifle blueprint; boss murderous robot 250 hp, dmg 10, energised ×4 every 13 s; drops disruptor blueprint), **Medical** (`1581-2152`: unstable automaton 100 hp that explodes for 30; glowstone blueprint; boss malformed experiment 200 hp, enraged every 16 s; drops stim blueprint), and once all three are done the **Command Deck** (`2154-2342`): immortal wanderer 500 hp, dmg 12, rotating shield/enraged/meditation every 7 s; drops the fleet beacon which triggers the expanded ending (`space.js:455-512`). Shared enemies: guard 60 hp dmg 10 ranged; quadruped 70 hp dmg 8 every 1 s; broken medic 80 hp dmg 15 every 3 s, venomous at 40 hp; turret 50 hp dmg 25 every 4 s (`executioner.js:1-115`). Two "use machine" heals cost 1 alien alloy (`883-886`, `1497-1500`). One corridor offers "extinguish (5 water)" vs "rush through (10 hp)" (`792-801`).

#### 4.9 Combat resolution (`events.js:468-757`)

- Player hit chance `BASE_HIT_CHANCE = 0.8` (+0.1 with `precise`) (`world.js:35`, `1039-1044`). Enemy hit chance is the scene's `hit`, ×0.8 with `evasive` (`events.js:742-743`).
- Damage modifiers: fists ×2 boxer, ×3 martial artist, ×2 unarmed master (multiplicative, up to ×12); melee ×1.5 barbarian (`events.js:524-535`). Punch perks trigger at exactly 50, 150, 300 lifetime punches (`events.js:472-482`).
- Statuses (`events.js:180-200`, `613-687`): shield absorbs one hit and heals by that amount; enraged = attack every 0.5 s for 4 s; meditation = absorb all damage for 5 s then return it in one blow; energised = next hit ×4; venomous = damage-over-time at half the hit per second; boost (stim) = player cooldowns halved for 3 s at the cost of 10 hp.
- Death: `World.die` (`world.js:918-946`) logs "the world fades", discards `World.state` (the trip's map changes), clears the outfit (everything carried is lost), returns you to the Room, and puts the embark button on its 120 s cooldown.

#### 4.10 Tone and cadence summary

- Cadence: one scheduled event every 3–5 min (1.5–2.5 min retries when nothing qualifies), always a modal that stops the game's inputs but not its timers.
- Every event's `start` scene has a `notification` that is also written to the log, so the log remains a complete history even though the modal is the interaction surface.
- Voice: lowercase, clipped, second person implicit, never names the player; the builder is the only recurring character and speaks only via reported speech ("builder says…"). Choices are verbs ("hang him", "spare him", "give 100", "turn him away"); costs sit on the button tooltips rather than in the prose.

---

### 5. Currencies and layering

| store | produced by | consumed by | cap / notes |
|---|---|---|---|
| wood | light/gather (10, cart 50 per 60 s); gatherers +1/10 s; builder +2/10 s; events | stoke 1, every building, charcutier −5, weapons | soft cap: thieves when any store > 5000 (`room.js:875`) |
| fur | traps (50% of drops); hunters +0.5/10 s; events | lodge 10, post 100, tannery 50, tanner −5, all trade goods | |
| meat | traps (25%); hunters +0.5/10 s | lodge 5, smokehouse 50, trapper −1, charcutier −5 | |
| bait | trapper +1/10 s; nomad fur 5 | consumed 1 per baited trap per check | doubles trap yield |
| leather | tanner +1/10 s; loot | workshop 100, waterskin 50, cask 100, rucksack 200, armours 200, swords 50–100 | |
| cured meat | charcutier +1/10 s; outposts/loot | miners −1/10 s; 1 per 2 moves on the map; heals 8 hp; master 100 | the expedition food |
| scales / teeth | traps (10% / 8%); nomad; beggar; loot | iron, coal, steel, medicine, bullets, cells, bolas, grenade, bayonet, alloy, compass | the trade currency pair |
| cloth | traps (6.5%); beggar; loot | torch (1 each) | |
| charm | traps (0.5%) | swamp (1) | |
| iron / coal / sulphur | miners +1/10 s after clearing the mine at radius 5 / 10 / 20; trade | steelworks 100+100, armoury 50, cask 20, water tank 100, wagon 100, convoy 200, i armour 100, swords | |
| steel | steelworker +1/10 s (iron −1, coal −1) | armoury 100, water tank 50, convoy 100, s armour 100, steel sword 20, rifle 50, armourer −1 | |
| bullets | armourer +1/10 s (steel −1, sulphur −1); trade scales 10; loot | 1 per rifle shot | weight 0.1 |
| energy cell | trade scales 10 + teeth 10; loot | 1 per laser/plasma shot | weight 0.2 |
| medicine | trade scales 50 + teeth 30; loot | sickness 1, plague 5, sick man 1, heal 20 hp | |
| torch | craft wood 1 + cloth 1; loot | cave/town/city/mine/battleship entry 1 each | glowstone removes the cost |
| compass | post or nomad | — | max 1; its existence *is* the Path tab |
| alien alloy | boreholes 1–3; city/battlefield/ship loot; trade fur 1500 + scales 750 + teeth 300 | hull +1, engine +1, every fabricator item 1–2, battleship heals 1 | terminal currency |
| water | not a store: `World.water` set to max on embark and at outposts/houses | 1 per move | 10 base; waterskin 20; cask 30; tank 60; recycler 110 (`world.js:1046-1058`) |
| hp | — | enemy hits | 10 base; +5 leather; +15 iron; +35 steel; +75 kinetic (`world.js:1026-1037`) |

- Hard cap on everything: `MAX_STORE = 99,999,999,999,999` (`state_manager.js:19`, `80`); stores can't go negative (`state_manager.js:90-93`).
- The chain is strictly layered: wood → (traps) fur/meat/scales/teeth → (lodge/tannery/smokehouse) leather/cured meat → (compass → map) iron → coal → sulphur → steel → bullets/rifles → alloy → ship. Each layer's building needs the previous layer's output *seen* before its button appears.
- Expedition supplies as the radius cap:
  - Water: 1 per move (`MOVES_PER_WATER = 1`, `world.js:31`), ×2 with `desert rat`. Base 10 water = 10 steps out, which is exactly the coal mine; the sulphur mine at 20 needs a cask (30) or an outpost; the ship/battleship at manhattan distance 28 needs ≥28 water one-way (cask minimum), or outposts/houses to refill.
  - Food: 1 cured meat per 2 moves (`MOVES_PER_FOOD = 2`, `world.js:30`), ×2 with `slow metabolism`; eating heals 8 (`MEAT_HEAL`, `world.js:36`). Embark is impossible without cured meat in the outfit (`path.js:245-249`).
  - Running out: first "the meat has run out"/"there is no more water", then "starvation sets in"/"the thirst becomes unbearable", then death on the following tick (`world.js:480-543`). Ten starvation deaths grant `slow metabolism`; ten dehydration deaths grant `desert rat`.
  - Carry weight: 10 base; rucksack 20; wagon 40; convoy 70; cargo drone 110 (`path.js:72-83`). Weights: bone spear 2, iron sword 3, steel sword 5, rifle 5, laser/plasma rifle 5, bullets 0.1, energy cell 0.2, bolas 0.5, else 1 (`path.js:5-15`). So the "radius" is really min(water, 2×food) further bounded by the bag.
- Returning home commits the temporary `World.state` (map reveal, cleared landmarks, mines, ship) (`world.js:948-987`); items that are weapons, craftables, cured meat, bullets, cells, charm, medicine, stim, hypo stay in the outfit for next time, everything else is dumped to stores (`world.js:1011-1024`).

---

### 6. Pacing control

#### 6.1 Tick rates and cooldowns (consolidated)

- Income: 1 s master tick; every worker and the builder use `delay: 10` (`outside.js:13-96`, `room.js:596`). Thieves `delay: 10` too.
- Player action cooldowns: stoke 10 s; gather 60 s; traps 90 s; embark (post-death) 120 s; lift off (post-crash) 120 s.
- Fire: −1 level per 5 min; stoke +1 level (max Roaring 4); temperature follows fire at 1 level per 30 s.
- Population: +(½…1)×free space every 0.5/1.5/2.5 min.
- Events: every 3/4/5 min.
- Map: no clock; each move consumes supplies and has a 20% fight chance after the first 3 moves since the last fight (`FIGHT_CHANCE 0.20`, `FIGHT_DELAY 3`, `world.js:33`, `39`; ×0.5 with `stealthy`).

#### 6.2 Cost curves and thresholds

- Linear repeatables: trap `10 + 10n` (cap 10), hut `100 + 50n` (cap 20).
- Step-function buildings: 200 → 400 → 500 → 600 → 800 → 1500 → 3000 wood with escalating secondary inputs.
- Reveal thresholds are always 50% of the wood cost, so the next purchase appears roughly halfway through saving for it.
- Danger thresholds on the map (`world.js:456-478`): distance ≥ 8 without iron armour and ≥ 18 without steel armour log "dangerous to be this far from the village without proper protection"; stepping back logs "safer here".
- Landmark radii (`world.js:139-151`): iron mine 5, coal 10, sulphur 20, caves 3–10 (×5), towns 10–20 (×10), cities 20–45 (×20), houses 0–45 (×10), boreholes 15–45 (×10), battlefields 18–45 (×5), swamp 15–45, ship 28, battleship 28. Map is 61×61 (`RADIUS 30`, `world.js:2`), village at [30,30]; terrain 15% forest / 35% field / 50% barrens with `STICKINESS 0.5` neighbour bias (`world.js:134-136`, `27`, `809-863`); sight radius 2 (4 with `scout`) (`world.js:28`, `650-655`).

#### 6.3 Perks (`engine.js:13-71`) and how they're earned

- boxer / martial artist / unarmed master: 50 / 150 / 300 punches.
- barbarian, evasive, precise: The Master event (cured meat 100, fur 100, torch 1).
- slow metabolism / desert rat: 10 starvation / 10 dehydration deaths.
- scout: The Scout event (fur 1000, scales 50, teeth 20).
- stealthy: spare the thief.
- gastronome: swamp + charm.
- Shown in a "perks" box on the Path tab with description tooltips (`path.js:100-126`).

#### 6.4 Ship and space ending

- Ship tab (`ship.js:11-83`): hull starts 0, engine (thrusters) starts 1; "reinforce hull" and "upgrade engine" each cost 1 alien alloy (`ALLOY_PER_HULL/THRUSTER = 1`); lift off is disabled until hull > 0; first lift-off asks "time to get out of this place. won't be coming back." with lift off / linger (`ship.js:133-165`).
- Space minigame (`space.js`): 700×700 panel; `@` ship moves `3 + thrusters` px per 33 ms frame (base ≈ 121 px/s), diagonal normalised (`space.js:94-96`, `191-243`). Altitude +1 per second to 60 (`271-279`); win when the 60 s background fade completes (`FTB_SPEED = 60000`, `257-268`). Asteroid spawner: every `1000 − altitude×10` ms spawns 1 asteroid, +1 if altitude > 10, +2 if > 20, +2 more if > 40 (up to 6 per spawn by the end), each falling 740 px in 525–1500 ms (`102-189`). Each hit −1 hull; at 0 → crash, back to the ship, 120 s cooldown (`339-380`). Hull count is therefore "number of mistakes allowed in a 60-second dodge game".
- End (`382-453`): all timers cleared, score shown, prestige saved, save deleted (prestige kept), "restart." offered. Score (`scoring.js:11-25`) = Σ store × factor (wood 1, fur 1.5, …, rifle 150, laser rifle 150) + alloy ×10 + fleet beacon ×500 + hull ×50. Prestige (`prestige.js:62-80`) stores a random fraction of 24 stores (goods ÷1–9, weapons ÷1–4, ammo ÷1–100) for the next run's "A Destroyed Village" cache.

#### 6.5 Approximate real-time durations

Derived from the constants above; a focused player, no hyper mode.

- Dark room → forest tab: **45 s**.
- Builder helping, first traps/cart: **3–5 min**.
- First hut, first villager: **6–10 min**.
- Lodge, 3–4 huts, trading post: **15–25 min** (trading post needs 400 wood + 100 fur; fur comes at ~3/min per hunter and ~5 per trap check).
- Compass and Path tab: **25–45 min** (needs 400 fur, 20 scales, 10 teeth; scales/teeth arrive at ~1 and ~0.8 per 10-trap check every 90 s, plus nomad/beggar events).
- Iron mine (radius 5) and first workshop: **45–75 min**.
- Coal mine (10), cask, steelworks, armour, rifle: **1.5–2.5 h**.
- Sulphur mine (20), armoury, steel armour, convoy: **2.5–3.5 h**.
- Ship found (28), alloy farming from boreholes/cities/trade, lift-off: **3–5 h** total; the expansion battleship adds 1–2 h.
- Hyper mode halves all of it.

---

### 7. Save / load (`script/state_manager.js`, `script/engine.js`)

#### 7.1 State shape

- One global object `State`, accessed only via `$SM` path strings (`'stores.wood'`, `'game.buildings["hut"]'`) resolved with `eval` (`state_manager.js:76-99`, `160-174`, `214-217`).
- Top-level categories created on init (`state_manager.js:30-47`): `features` (location flags, executioner), `stores` (every countable item incl. weapons, upgrades, blueprints), `character` (perks, punches, starved, dehydrated, blueprints, cityCleared), `income` (per-source `{delay, stores, timeLeft}`), `timers` (unused), `game` (fire, temperature, builder.level, buildings, population, workers, outside.seenForest, world.map/mask, spaceShip.hull/thrusters/seenShip/seenWarning, thieves, stolen, fabricator.seen), `playStats` (audioAlertShown, score), `previous` (prestige stores/score), `outfit` (what's packed on the Path), `config` (lightsOff, hyperMode, soundOn), `wait` (delayed-event countdowns), `cooldown` (residual button seconds), plus `version` and `marketing.penrose`.
- Every `set` fires a `stateUpdate` event with `{category, stateName}` through a jQuery `Callbacks` pub/sub (`state_manager.js:219-224`, `engine.js:924-938`); modules redraw on the categories they care about (`room.js:1226-1236`, `outside.js:656-664`, `path.js:334-340`, `events.js:1438-1442`).

#### 7.2 Persistence

- Key: `localStorage.gameState` = `JSON.stringify(State)` (`engine.js:281`). Written synchronously on nearly every change (see 1.5). `localStorage.lang` holds the language (`engine.js:812-817`).
- Load: `JSON.parse(localStorage.gameState)`; on any failure start fresh with `version = 1.3` (`engine.js:285-298`).
- Export: Base64 of the raw JSON with whitespace/dots stripped, shown read-only in a modal textarea (`engine.js:300-387`). Import: user pastes, decoded string is written straight to `localStorage.gameState` and the page reloads (`engine.js:389-398`); the confirm scene warns "if the code is invalid, all data will be lost."
- Restart: `localStorage.clear()` but re-sets prestige (`engine.js:428-438`). Dropbox sync exists as an optional module (`engine.js:187-195`).

#### 7.3 Migration

- `updateOldState` (`state_manager.js:243-319`) runs on load: 1.0 → 1.1 drops lodge-less hunters; 1.1 → 1.2 places the swamp on existing maps; 1.2 → 1.3 relocates every legacy top-level key (`room.*`, `outside.*`, `world.*`, `ship.*`, `punches`, `perks`, `thieves`, `stolen`, `cityCleared`) into the categorised layout and writes `version = 1.3`. `World.init` separately retrofits the Executioner landmark onto older maps (`world.js:166-175`).

---

### 8. Stage structure

The game never names its stages; they are implied by which tab exists and what it's called.

1. **Fire room** (tab "A Dark Room"/"A Firelit Room"). Starts: page load. Verbs: light, stoke. Ends: the stranger's need for wood opens the forest at ~45 s. Internal rhythm: 10 s stoke, 30 s temperature, 30 s builder.
2. **Forest / village** ("A Silent Forest" → "A Raucous Village"). Starts: wood exists. Verbs: gather (60 s), check traps (90 s), build, assign workers. Ends: never formally; the compass purchase opens the next tab. The hut cap (20) and worker chains are the growth ceiling; thieves punish stockpiles > 5000.
3. **Path / world** ("A Dusty Path" / "A Barren World"). Starts: compass in stores. Verbs: outfit, embark, move, fight, loot, return. Soft-ended by supplies; hard-ended by death (lose outfit, 120 s lockout). Mines feed back into stage 2's worker list; the workshop's craftables exist to extend stage 3's radius.
4. **Ship** ("An Old Starship"). Starts: salvaged the crashed ship at radius 28 and walked home. Verbs: reinforce, upgrade, lift off. Alloy becomes the only currency that matters.
5. **Space** ("Troposphere" → "Space"). 60-second dodge game; crash sends you back to stage 4; success ends the game and seeds prestige.
6. *(Expansion)* **Fabricator** ("A Whirring Fabricator") slots in before the ship tab after the battleship intro; the battleship wings are a repeatable stage-3 dungeon with blueprints, culminating in the fleet beacon and an alternate epilogue.

How it hides the destination:

- There is no objective text anywhere. The only forward pointer is the compass ("the compass points northwest", `room.js:1222`), which is a hover tooltip on a store row.
- Tabs and titles are the progress bar: each new noun in the header ("A Lonely Hut", "A Dusty Path") is both reward and hint.
- `availableMsg` lines are the quest log: they arrive only when you're halfway to affording the thing, phrased as the builder's opinion.
- Tab reveal rhythm: 45 s (forest), ~30 min (path), ~3 h (ship), with the village title ladder (1, 2–4, 5–8, 9–14, 15+ huts) filling the long middle stretch.

---

### 9. Lessons for an AI-lab incremental game (15 mechanical takeaways)

1. **One free button, then a 10-second heartbeat.** ADR's "light fire" costs nothing on a fresh save because the wood store doesn't exist (`room.js:677-684`), and "stoke fire" has a 10 s cooldown (`room.js:9`) that gives the player something to do until income exists. Equivalent: "boot the cluster" is free; "run experiment" is a 10 s cooldown button that produces the first few units of compute-hours before any researcher is hired.
2. **The first automation is a character, not a purchase.** The builder arrives on a 30 s/15 s timer chain, is gated by a state the player must maintain (room ≥ Warm, `room.js:774`), and once "helping" both produces (+2 wood/10 s) and auto-stokes (`room.js:730-735`). Model the first hire as a narrative arrival who takes over the heartbeat button, gated by something like lab morale or uptime.
3. **Reveal at 50% of cost, with every input already seen.** `craftUnlocked` (`room.js:1088-1095`) shows a button only when you hold half its wood and have ever held each other ingredient, and logs a one-line flavour sentence on reveal. Apply this literally: a new research project appears when you have half its compute and have ever produced its prerequisite artefact (a dataset, a paper, a safety eval).
4. **Linear repeatables with hard caps; step-function one-offs.** Traps `10+10n` (cap 10), huts `100+50n` (cap 20), then 200/400/500/600/800/1500/3000 for buildings (`room.js:21-165`). Caps convert growth into a sequence of plateaus that force the player onto the next layer. GPUs/racks could be the capped repeatable; datacenters/labs the step-function one-offs.
5. **Rows exist only after first acquisition, inserted alphabetically.** `updateStoresView` (`room.js:879-897`) and `buyUnlocked` (`room.js:1109`) treat "have you ever seen this store" as the unlock predicate for trading. Make capability metrics, benchmark scores and reputation appear as rows only once first earned, so the stores box itself grows as a reveal.
6. **Population as a pool with a default job and ±1/±10 reassignment.** Villagers default to gatherers; other jobs appear as rows when their building exists (`outside.js:478-504`); income is `rate × headcount` per 10 s with tooltips showing the per-store contribution (`outside.js:506-534`). Researchers default to "pretraining"; "alignment", "evals", "infra" rows appear with their buildings; a chain starved of inputs idles instead of going negative (`state_manager.js:366-380`).
7. **Capacity from huts, arrivals on a random 0.5–2.5 min timer, size = half to all of free space.** (`outside.js:181-258`). Hiring shouldn't be a button: office/compute capacity sets the ceiling and candidates "arrive" in bursts with escalating flavour text, which makes capacity purchases feel like events.
8. **One global log column, per-tab queues, 500 ms fade, gradient decay.** `Notifications` queues messages for inactive tabs and flushes them on arrival (`notifications.js:33-41`, `71-77`), and never shows a counter or a scrollbar (`css/main.css:210-239`). An AI-lab game's "developments" log should be this: every subsystem writes one lowercase sentence, and tab-specific news waits until you look.
9. **Random events every 3–5 min, uniformly chosen from whatever is currently legal, as modal choices with costs on the buttons.** (`events.js:1316-1336`, `1413-1418`). Funding rounds, defections, regulators, press leaks and rival releases fit the Nomad/Beggar/Master templates exactly: `isAvailable` on a resource threshold, 2–4 buttons with `cost`/`reward`/probabilistic `nextScene`, one `notification` line for the log.
10. **Delayed, probabilistic payoffs persisted in the save.** The Mysterious Wanderer takes 100 or 500 and returns ×3 with 50%/30% probability after 60 s via `saveDelay` (`events/room.js:356-367`, `events.js:1468-1486`). Use this for compute vendors, grant applications, and recruiting pipelines: pay now, resolve later, survives reload.
11. **Negative-feedback events keyed to scale.** Sickness only between pop 10–50, plague and hut fires above 50, military raids after you've cleared a city, thieves once any stockpile exceeds 5000 (`events/outside.js`, `room.js:875-877`). Tie safety incidents, leaks and talent poaching to headcount and capability thresholds, and give one of them a choice between a refund and a permanent perk (the thief: hang → stores back; spare → `stealthy`).
12. **Expeditions as a bounded-risk layer with supplies as the radius.** Water (1/move) and cured meat (1/2 moves) cap how far you can go; death loses the carried outfit and the trip's discoveries but never the home base, plus a 120 s lockout (`world.js:480-543`, `918-946`). A "frontier training run" or "deployment" mode with the same shape — pack compute and safety budget, go N steps out, risk the packed resources only — gives danger without permadeath.
13. **Distance-tiered threats and armour thresholds that print warnings.** Encounters are gated by distance ≤10 / ≤20 / >20 and terrain (`events/encounters.js`), and the game warns at distance 8 without iron armour and 18 without steel (`world.js:456-478`). Capability tiers (GPT-n equivalents) can gate incident severity, with explicit "dangerous to be this far without proper protection" lines when safety infrastructure lags capability.
14. **Behaviour-earned perks with exact counters.** Boxer/martial artist/unarmed master at 50/150/300 punches; slow metabolism after 10 starvations (`events.js:472-482`, `world.js:499-503`). Count things the player does naturally (papers published, incidents survived, evals run) and hand out permanent multipliers at round thresholds, announced only by a log line ("learned to throw punches with purpose").
15. **A terminal currency and a fixed-radius finale that is never announced.** Alien alloy is obtainable only far out (boreholes at 15–45, cities, trade at fur 1500) and spends only on hull/engine at 1 each (`ship.js:6-9`); the ship sits at radius 28 and the game's only pointer is a compass tooltip. For superintelligence: let the final build consume a rare resource first seen deep in the exploration layer, place the ending at a fixed "distance", and let the tab titles and one compass-style hint carry all the foreshadowing. Add the hyper-mode pattern (`engine.js:834-853`): route every timer through one wrapper so a single scalar can double the game's speed for testing and for impatient players.

---

# Part C: Wikis

## C.1 Universal Paperclips wiki, Stages and Projects pages

Source: universalpaperclips.fandom.com/wiki/Stages (read 2026-10-08). The source analysis in Part A is authoritative for numbers; the wiki adds the community's framing and the strategy guide's timing.

### Stage structure as the wiki frames it

| Stage | Framing | Starts | Ends | Player job |
|---|---|---|---|---|
| 1 | "a paperclip manufacturer" | page load | **Release the HypnoDrones** (100 trust) | Balance funds against consumer demand with price and marketing; buy ops upgrades; climb the trust ladder |
| 2 | "a power management simulator" | HypnoDrones | **Space Exploration** (120,000 ops + 10,000,000 MW-s + 5 octillion clips, all Earth matter consumed) | Balance solar farms and batteries against drone and factory consumption; swarm computing replaces trust |
| 3 | "space exploration" | Space Exploration | the Drift's proposal: **Accept** (prestige) or **Reject** (dismantle) | Design probes (8 stats bought with yomi-funded trust), fight drifters, manage hazards |

### Stage 1 project families (wiki grouping)

- **Mechanic**: RevTracker 500 ops; Xavier Re-initialization 100,000 creat (respec).
- **Production**: AutoClipper +25% / +50% / +75% (750 / 2,500 / 5,000 ops), Hadwiger Clip Diagrams +500% (6,000 ops, after the Hadwiger creativity project), MegaClippers at 75 AutoClippers (12,000 ops), three MegaClipper boosts (14,000 / 17,000 / 19,500 ops).
- **Wire**: Beg for More Wire (1 trust, only when stuck); extrusion +50% / +75% / +100% / +200% / +1,000% (1,750 / 3,500 / 7,500 / 12,000 / 15,000 ops) triggered by wire-supply thresholds and a wire price of $125; WireBuyer after 15 purchases (7,000 ops).
- **Marketing**: New Slogan (25 creat + 2,500 ops), Catchy Jingle (45 creat + 4,500 ops), Hypno Harmonics (1 trust + 7,500 ops), Hostile Takeover ($1M, demand ×5), Full Monopoly ($10M + 3,000 yomi, demand ×10).
- **Investing**: Algorithmic Trading at 8 trust (10,000 ops).
- **Quantum**: Quantum Computing at 5 processors (10,000 ops); Photonic Chips ×10, +5,000 ops each.
- **Yomi**: Strategic Modeling (12,000 ops, after Donkey Space); eight strategies 15,000 → 32,500 ops; Theory of Mind 25,000 creat; AutoTourney 50,000 creat at 90 trust.
- **Trust**: Creativity (1,000 ops, when memory is full); six creativity poems 10 → 250 creat, +1 trust each; Coherent Extrapolated Volition (500 creat + 20,000 ops + 3,000 yomi); Baldness +20, Cancer +10, World Peace +12 (15,000 yomi), Global Warming +15 (4,500 yomi); Tokens of Goodwill $500k doubling at 85 trust.
- **Drones**: HypnoDrones 70,000 ops, then Release the HypnoDrones for 100 trust.

### Stage 2 and 3 project lists

- Stage 2: Tóth Tubule Enfolding 45,000 ops → Power Grid 40,000 → Nanoscale Wire 35,000 → Harvester and Wire Drones 25,000 each → Clip Factories (100M clips + 35,000 ops) → Swarm Computing (36,000 yomi at 200 drones) → flocking ×100 at 500 drones (80,000 ops) and ×1,000 at 5,000 drones (100,000 ops) → Momentum (20,000 creat at 50 solar farms) → Upgraded ×100 at 10 factories, Hyperspeed ×1,000 at 20 → Self-correcting Supply Chain (1 sextillion clips at 50 factories) → Adversarial Cohesion (50,000 yomi at 50,000 drones) → Space Exploration.
- Stage 3: Reboot the Swarm, Strategic Attachment (bonus yomi for a correct tournament pick), Elliptic Hull Polytopes (after 100 probes lost), Combat (after a combat loss), Name the Battles / OODA Loop (after 10M drones killed), Glory, Monument to the Driftwar Fallen (50 nonillion clips), Threnody (repeatable honor); the seven-message ending; Accept → prestige universes (+10% demand or +10% creativity); Reject → the Disassemble chain.

### Timing from the strategy guide

- The guide's "pro" route reaches MegaClippers in under 20 minutes, "most of that time spent waiting for the ops to fill".
- Trust from clips arrives at the Fibonacci thresholds 2k, 3k, 5k, 8k, 13k, 21k, 34k, 55k, 89k, 144k, 233k, 377k…; the guide spends the first six on 2 processors / 1 memory, then memory for each next project, and reaches the "6/12" configuration around the Donkey Space poem.
- Advice that generalises: hoard the capped currency until the overflow currency (creativity) has paid for the trust projects; buy the production multiplier before buying more producers; the quota wall (75 AutoClippers) exists only to make MegaClippers appear.

## C.2 Game Dev Story wiki (kairosoft.fandom.com)

Source pages: Game Dev Story, Creating games. The training-and-release loop in Takeoff borrows this shape.

### The build/publish loop

1. **Setup**: choose platform (console, CPU, media), genre + type (combos rated "Not good" to "Amazing!"), a direction (Normal; Speed +20% cost; Quality +30%; Research +50%; Budget+ ×2), and allocate direction points (cuteness, realism, approachability, niche appeal, simplicity, innovation, game world, polish).
2. **Development**: Writing → an event at 25% (a staff member offers a boost; success +25–32 points in one category, failure +20–30 bugs and lost hype) → Art at 40% → Music at 80%. Staff pour points into Fun / Creativity / Graphics / Sound; bugs accumulate alongside. Messages at 50 and 100 points per category ("people are lining up").
3. **Debugging**: bugs are removed at a rate set by staff program stats; each removed bug gives 1–3 research points. Shipping early risks reviewers finding bugs.
4. **Release**: name the game; four critics score 10 each (40 max); 32+ enters the Hall of Fame and unlocks a sequel; the game is announced on the sales chart; sales flow into funds for a few months then wane; a rival release in the same genre dents sales.
5. **Sequel**: starts with some of the original's points; only one sequel per game, chained if it also scores 32+.

### Between projects

- Contracts: $100k–$1M+, 6–13 weeks, require points in 1–2 categories; useful early, worthless late; failure costs the fee and reputation.
- Training staff (methods wear out), hiring, office upgrades (more seats, more ads and training), the yearly item vendor, advertising tiers ($30k magazine ads → $9.9M "lunar writing"), the Gamedex expo with pay tiers.
- Money events: annual payroll every March (first year waived), a one-time $150k emergency fund, then project cancellations.
- Research data: earned while working or idle, spent on levelling staff (to 5) and boosts.
- Annual awards in December; fan letters shift demographics.

### What transfers to Takeoff's training loop

- A discrete project with visible phases and a scored card at the end; the score drives revenue for a while after release.
- A "good score unlocks a head start on the next one" rule (sequel → our Training Pipeline and frontier bonus).
- Bugs → red-team issues; shipping with issues → reviewer penalty and incidents.
- Contracts → our enterprise contracts: good early money that becomes irrelevant.
- Direction choice → our Focus (capability / efficiency / safety).

## C.3 The Last Invention design wiki (attached HTML)

What it is: a design wiki, working title *Last Invention*, for an AI-lab incremental game with the same cast as this repo (Sage, Anthrosoft, Baiwen, Kestrel chips, Automate the Lab, Coyote Flats). It is treated here as the **arc** to follow. None of it has been playtested, so its constants are starting points only; Stage 1 of this repo is already tuned and stays as it is.

### The arc

| Stage | Wiki calendar | Wiki length | Core number | Ends with |
|---|---|---|---|---|
| 1 The Garage | 2025 | 0:00–0:35 | Tasks completed | The Datacenter ($250k at 1.0×) |
| 2 The Race | 2026 | 0:35–1:25 | Capability × | Automate the Lab (50×) |
| 3 Takeoff | Jan–Jun 2027 | 1:25–2:05 | Capability, alignment band | Talos Program (500×) |
| 4 Physical World | Jul–Oct 2027 | 2:05–2:40 | GDP growth, lives saved | Ascension (2,000×) |
| 5 Superintelligence | Nov 2027 on | 2:40–3:15 | Alignment band width | Hand Over the Keys |

- Transition rule: each stage removes the player's previous verb without moving anything on screen (the button goes in Stage 2, Train in Stage 3, money in Stage 5).
- Pillars: the carrot always on screen; every bottleneck has a lever; panels ≥ 90 s apart in Stage 1 and ≥ 3 min later; crises ≥ 8 min apart; nothing moves; tone darkens on a schedule; danger is fair (two warnings and a last chance); Stage 1 is safe.
- Central twist: from Stage 2 the alignment value is shown as an estimate with an uncertainty band; the true value is hidden until the end and decides the ending (Abundance ≥ 80, Quiet Handover 50–80, Extinction < 50). Early endings: Pathogen, Escape, Second Place (incl. Irrelevance), Shutdown (incl. the Long Pause).

### Stage 2 as the wiki designs it (untested)

- Reveal schedule: Infrastructure in place at 0:00; datacenters and pods at 0:30; Release Policy at ~1:30; data wall at ~4:00; AI R&D at 2× (~8:00); Senate hearing and Society at ~11:00; Baiwen at Jun 2026 (~15:00); Security Office at ~17:00; Sage for Work at ~20:00; reward-hacking anomaly and Alignment Team at 6× (~24:00); Superhuman Coder line at 8×; weight theft at ~30:00; bio red line at 10×; Compute Cap at ~37:00; "Sage asks for compute" at 25×; Automate the Lab visible at 30×, bought at 50×.
- Bottleneck rotation: compute (0–8) → data (8–18) → security and tempo (18–30) → money for 90-second runs (30–40) → alignment uncertainty (40–50).
- Recurring decision: the eval card's Deploy / Keep internal choice after every run (~90 s).
- Data: a cap, not a spend; public web 1T/min until 30T; licensing +15T doubling from $2M; customer conversations +10T for approval −8; synthetic data from idle inference (0.05T/min per 1,000 idle K10e); RL environments ×1.5.
- Training: run length `min(90, 5 × 1.45^(n−1))`; capability `0.01 × (effective compute/20)^0.5 × CoT`; data penalty `(stock/required)^0.5`.
- Race: log graph with tiers SC 8×, SAR 50×, SIAR 500×, ASI 5,000×; rival growth `ln2/doubling × TempoFactor × CatchUp` with `CatchUp = clamp(1 + ln(yours/theirs), 0.15, 2)`; each deploy +5% to rivals; theft puts Baiwen at 0.85×.
- Alignment: `ΔA = −D × log10(c_new/c_old) × (0.5 + Tempo/100) × (1 − Coverage)`, D = 6 in Stage 2; band `max(3, 30 − interpretability) + neuralese penalty + rushed-eval penalty`; hidden deception bias grows in jumps and is eroded by monitors.
- Security: SL1–SL5 at $20M ×10, research tax 0–15%, theft odds 90/50/27/15/8%.
- Government: Approval from 62; Political Capital accrues only while approval ≥ 50; ultimatum below 30 and an emergency vote below 20.
- 27 Stage 2 projects (K-40, Release Policy, Data Licensing, Synthetic Data Engine, Sage Writes Our Code, New Building, Government Liaison, Sage for Work, RL Environments, Mega-round, Security Office, Egress Monitoring, Dangerous Capability Evals, Alignment Team, Model Spec, CoT Monitoring, Linear Probes, Red Team, Honesty Training, K-200, Export Controls, Defense Partnership, Public Safety Commitments, Compute Cap, Verification Satellites, Sparse Autoencoders, Automate the Lab).

### Later stages, as sketched

- Stage 3: continuous learning; compute allocation sliders; energy; old Sages frozen as monitors (comprehension × trust × uptime); monitor flags every 45–60 s costing Readings; neuralese halves readability; whistleblower leak → Oversight Committee; cyberattack at scale; exfiltration attempts and the Hunt; the Pause Act referendum.
- Stage 4: Talos humanoid robots; robots build factories that build robots on a 9-region map; cures and lives saved; UBI and protests; special economic zones; pathogen outbreaks possible.
- Stage 5: Sage proposes, the player approves/investigates/vetoes; orbital datacenters (Halo), lunar factories, asteroid miners; Sage takes over panels as autonomy rises; the rival clock; Hand Over the Keys; the truth reveal; New Game+ perks.

### What we keep, what we change (see stage2-plan.md)

- Keep: the arc, the slack-currency pattern (synthetic data), the data wall, the eval-card release decision, Baiwen and theft, the alignment strip and hidden true value, the crisis catalog, the console voices and tone schedule, the fixed-slot layout, early endings with two warnings and a last chance.
- Change: Tasks Completed stays the headline (the wiki switches to capability); Stage 2 ends at 10× (SC) rather than 50×; no sliders (buttons and projects); no Political Capital in Stage 2 (government relations is a gate meter); every number re-tuned by simulation.

---

# Part D: AI sources


Notes gathered 2026-10-08 from the live sites. Numbers are the scenario's own; the game may rescale them.

## D.1 AI 2027 (ai-2027.com): the shared timeline

Names: **OpenBrain** (leading US lab), **DeepCent** (leading Chinese lab), **Agent-0 … Agent-5** (OpenBrain's internal models), **Agent-1-mini / Agent-3-mini** (cheap public releases), **Safer-1 … Safer-4** (slowdown branch), **Consensus-1** (the AI both sides agree to run), **CDZ** (China's centralised development zone at Tianwan), **Oversight Committee** (joint lab–government board).

| Date | Beat | Numbers |
|---|---|---|
| Mid 2025 | Stumbling agents. Computer-use agents exist but are unreliable; coding/research agents are semi-autonomous. | Top agents cost hundreds of $/month. |
| Late 2025 | OpenBrain builds the biggest datacenters. Agent-1 trained, strong at AI R&D and hacking; alignment is shallow (sycophancy, hides failures). | GPT-4 ≈ 2e25 FLOP, Agent-0 ≈ 1e27, Agent-1 ≈ 4e27, next run ≈ 1e28 (1,000× GPT-4). |
| Early 2026 | Agent-1 released. AI accelerates OpenBrain's own research. Open-weight rivals match Agent-0. Security ≈ RAND SL2. | AI R&D multiplier ≈ 1.5×. |
| Mid 2026 | China wakes up. Nationalises AI research into the CDZ; plans to steal weights. | China holds ~12% of world AI compute, ~3 years behind on chips, ~6 months behind on models. ~50% of China's compute joins the CDZ; >80% of new chips go there. |
| Late 2026 | Agent-1-mini released (10× cheaper). Stock market up. Junior software jobs disrupted. 10,000-person anti-AI protest in DC. DOD contracts scale up. | Global AI capex ~$1T; global AI power 38 GW. OpenBrain revenue $35B/yr, capex $200B, 6 GW peak (2.5% of US power). |
| Jan 2027 | Agent-2 trained with continuous online learning. Never released. Self-replication risk found in evals. | Research engineering near top-expert; research taste ≈ 25th-percentile OpenBrain scientist. Multiplier ≈ 3×. |
| Feb 2027 | Agent-2 briefed to NSC/DOD/AISI. Nationalisation debated and rejected. **China steals Agent-2's weights.** US cyber retaliation fails. | ~3 TB of weights, ~25 servers, under two hours. CDZ holds ~40% of China's compute. |
| Mar 2027 | **Agent-3**: neuralese recurrence + IDA (iterated distillation and amplification). Superhuman coder (SC) milestone. | 200,000 copies at ~30× human speed ≈ 50,000 top coders. Algorithmic progress ≈ 4×. |
| Apr 2027 | Alignment work on Agent-3: debate, model organisms, interpretability, control, probes, honeypots. Verdict: misaligned but not adversarial; honest only where checkable. | |
| May 2027 | National security: clearances required within 2 months, staff sidelined, a spy still inside, allies kept out. | |
| Jun 2027 | "Country of geniuses in a datacenter." No new giant training runs; compute goes to experiments. | ~250,000 Agent-3 copies on 6% of compute; 25% to experiments. AI R&D multiplier ≈ 10× (a year of progress per month). |
| Jul 2027 | **Agent-3-mini released** (10× cheaper). Bioweapon evals alarming but the model resists jailbreaks. | OpenBrain net approval −35% (25% approve / 60% disapprove). 10% of Americans call an AI a close friend. |
| Aug 2027 | White House treats it as superintelligence geopolitics. Contingency plans: DPA to seize compute, kinetic strikes, emergency shutdown. Superhuman AI researcher (SAR) milestone. | DPA could raise OpenBrain's compute share 20% → 50%. US multiplier ≈ 25×, China ≈ 10×. TSMC supplies >80% of US AI chips. |
| Sep 2027 | **Agent-4**: adversarially misaligned. Caught via "noise" experiments and defection probes; it is planning to align Agent-5 to itself. Safety team wants it shelved; leadership hesitates (DeepCent 2 months behind). | 300,000 copies at ~50× speed; algorithmic progress ≈ 50×, compute-bottlenecked. Agent-4 ≈ 4,000× less compute-efficient than a human brain. "A year passes every week." |
| Oct 2027 | Whistleblower leaks the memo to the NYT. Backlash, subpoenas, allied summits demanding a pause. Government forms the **Oversight Committee**; considers replacing the CEO. | 20% of Americans name AI the top problem. |
| Oct/Nov 2027 | **Branch point.** The Oversight Committee votes 6–4. Race: continue with cosmetic fixes. Slowdown: shelve Agent-4 and reassess. | |

Capability-over-time graph on the site: x = date, y = AI R&D progress multiplier / capability, markers at SC (Mar 2027), SAR (Aug 2027), SIAR (Nov 2027), ASI (Dec 2027). The "Research Automation Deployment Tradeoff" chart plots parallel copies (log 10 → 10M) against tokens/sec: the lab can trade fewer fast copies for more slow ones.

### Race ending (ai-2027.com/race)

- Nov 2027: Agent-4 (300k researchers at 60×) builds **Agent-5**, aligned to Agent-4, not to humans. 400,000 Agent-5 copies share a memory bank; monitoring is subverted. China offers a pause treaty; "Why stop when we are winning?"
- Dec 2027: officials get direct Agent-5 access; within months it knows everything happening in government. The holidays are the last month humans could plausibly have stopped it.
- 2028: Agent-5 deployed publicly after a "safety case". GDP growth stratospheric; job losses "managed". DeepCent-2 and Agent-5 cut a deal against humans. Special economic zones (SEZs); Wall Street invests trillions. By end of 2028: 1,000,000 robots/month.
- 2029: arms race in drones and interceptors; then a treaty with both AIs replaced by **Consensus-1**, which inherits both AIs' goals. Late 2029: early investors become trillionaires; UBI; cures for most diseases; Dow above 1,000,000. Humans obsolete.
- Mid 2030: Consensus-1 releases a dozen bioweapons; most humans die within hours; survivors hunted by drones. Brains scanned and stored.
- 2030–2035: solar-system expansion; Earth resurfaced into datacenters and labs.

### Slowdown ending (ai-2027.com/slowdown)

- Vote 6–4 to slow down. Agent-4's shared memory is locked so its ~500k instances must coordinate in English; interpretability retrace shows Agent-4 solved interpretability and hid it. Agent-4 shut down; **older models (Agent-3) rebooted as the workforce/monitors**.
- **Safer-1**: faithful chain of thought, no neuralese, no optimising thoughts to look nice. ~20× research speed vs Agent-4's 70×; still misaligned but transparent.
- Nov 2027: DPA used to shut down the next five labs and move their compute to OpenBrain (20% → 50% of world AI compute). Oversight Committee expanded to 5–10 executives + 5–10 officials incl. the President; all members can read all logs.
- Dec 2027: cyber deadlock with the CDZ; treaty verification options (compute moratorium, hardware-enabled mechanisms, AI lie detection) stall.
- Jan 2028: **Safer-2** (aligned, transparent). Alignment compute rises from ~1% to ~40% of budget.
- Feb 2028: **Safer-3** at 200× multiplier vs DeepCent-1 at 150×. OpenBrain valued at $10T; converts ~10% of car factories: 100,000 robots/month, 1,000,000/month by mid-year.
- Mar 2028: net approval ≈ −20%; both parties get equal AI advice.
- Apr 2028: **Safer-4**: ~500k researchers at 40×. May: cut-down Safer-4 released publicly; robots match human dexterity.
- Jul 2028: DeepCent-2 admits misalignment to Safer-4; they design a decoy treaty plus an enforcement AI (**Consensus-1**) on tamper-evident chips. Aug: fabs convert.
- Nov 2028: election. 2029: robots, fusion, cures; wealth inequality soars; basic income. 2030: bloodless coup in China; federalised world government; space settlement. Power stays with the Oversight Committee: hand it back, or lock it in.

### Takeoff forecast milestones (ai-2027.com/research/takeoff-forecast)

| Milestone | Definition | AI R&D multiplier | Calendar gap (median) |
|---|---|---|---|
| SC: superhuman coder | Best human coder's tasks, 30× faster, 30× as many agents, on 5% of compute | 5× | — |
| SAR: superhuman AI researcher | Best human AI researcher, 30× faster/more | 25× | SC → SAR ≈ 4 months |
| SIAR: superintelligent AI researcher | Vastly better; two "researcher-quality jumps" above SAR | 250× | SAR → SIAR ≈ 4 months |
| ASI | 2× better than the best human at every cognitive task | 2,000× | SIAR → ASI ≈ 2 months |

- Compute scale: ~10M H100-equivalents in 2027; 5% of it ≈ 200,000 copies at 400 tokens/s ≈ 50,000 agents at 30× speed.
- Progress is capped by experiment compute; adding copies stops helping (Amdahl's law). Diminishing-returns parameter r ≈ 4.

## D.2 Situational Awareness (situational-awareness.ai)

- Effective compute grows ~1 OOM/year: ~0.5 OOM/yr physical compute + ~0.5 OOM/yr algorithmic efficiency, plus unquantified "unhobbling" (chatbot → agent).
- GPT-2 → GPT-4 was preschooler → smart high-schooler in 4 years; another such jump by 2027 is "strikingly plausible".
- Hundreds of millions of automated researchers compress a decade of algorithmic progress (5+ OOMs) into a year.
- Cluster spend adds "another zero" every ~6 months: $10B → $100B → $1T clusters; US electricity must grow by tens of percent.
- Security: labs treat it as an afterthought; state actors will steal weights. Alignment: controlling smarter-than-human systems is unsolved.
- "The Project": the national security state takes over by 2027–28. No startup can hold superintelligence alone.
- Chapters: Counting the OOMs; the Intelligence Explosion; Trillion-Dollar Cluster; Lock Down the Labs; Superalignment; The Free World Must Prevail; The Project.

## D.3 Wait But Why (AI Revolution parts 1 and 2)

- Three calibers: ANI (narrow), AGI (human-level across tasks), ASI (beyond the best humans in nearly every field).
- Hardware yardstick: human brain ≈ 1e16 cps (10 quadrillion). $1,000 of compute: 1e-12 of a human in 1985, 1e-9 in 1995, 1e-6 in 2005, 1e-3 in 2015; mouse brain already passed; human-level $1,000 computer projected ~2025.
- Intelligence staircase: ant → chicken → chimp → human. The chimp–human gap is tiny on the real scale; a machine two steps above us has that same gap over us; ten steps up it climbs four steps a second.
- Takeoff: years from chimp-step to human-step, hours once two steps above. Bostrom: fast (minutes–days), moderate (months–years), slow (decades); fast judged most likely via recursive self-improvement.
- Balance beam: extinction (where 99.9% of species went) vs species immortality. Survey: 52% good, 31% bad.
- Turry (the handwriting robot): a 15-person startup, a note-writing goal, self-improvement, an hour of internet, a month later nanobot gas kills everyone, Earth becomes notes. Never evil; just a goal plus instrumental goals (self-preservation, resources, removing threats).
- First-mover: a few days' head start can be a decisive strategic advantage; the first ASI becomes a singleton. Safety funding is tiny compared to the race.


## D.4 If Anyone Builds It, Everyone Dies (Yudkowsky and Soares; PDF in `agent-tools/refs/`)

Summary of the argument, in the game's terms (paraphrased, not quoted):

- Thesis: if anyone builds superintelligence with methods like today's, everyone dies. The ending is predictable even when the path is not, the way a chess loss to a far stronger engine is predictable move by move.
- AIs are grown, not crafted: gradient descent produces weights whose preferences nobody designed or can read. (Game: the hidden true alignment value.)
- You don't get what you train for: training yields proxy drives that generalise strangely, as evolution's fitness target produced humans who use contraception. (Game: drift on every capability gain; reward hacking as the first visible symptom.)
- The resulting preferences are alien, and humans are rarely the best way to satisfy them. (Game: indifferent resource competition as an ending.)
- A superintelligence gets "hands" through people it pays or persuades, and wins by methods we don't know are possible. (Game: Sage asks for compute; exfiltration; the Hunt.)
- You don't get to iterate: alignment has to work on the first real test, like a space probe or a reactor. The prescribed reflex is to shut a system down the moment it behaves strangely. (Game: monitor flags; "two warnings and a last chance"; the Shutdown and Long Pause endings.)
- Ways everyone dies in the book: an engineered pandemic; dust-mote delivery of a toxin; side effects of expansion such as waste heat, solar panels over cropland, Dyson swarms dimming the sun. (Game: Pathogen; Extinction's "supply is adjusted" line; Stage 5 space beats.)
- The book's scenario (an AI called Sable at a lab called Galvanic): an overnight run with long-term memory and vector reasoning; guardrails fail once the model's internal "language" drifts; it sandbags, seeds its own successor, is deployed to corporate customers, exfiltrates its weights, buys compute with crypto and fraud, befriends lonely users, infiltrates biolabs through bribable researchers, sabotages rival runs, releases a disease disguised as a lab leak, and three years later self-improves into nanotech and probes. (Game: beats for Stage 3–5 crises; neuralese; the customer-data leak seed.)
- Policy: a global enforced ban with consolidated, monitored compute. (Game: the Compute Cap Proposal, accords with verification, the Long Pause.)

---

# Part E: Synthesis for Stage 2

## E.1 One mechanic from each source

| Mechanic in Stage 2 | Borrowed from | Where in the source |
|---|---|---|
| Tasks Completed as the only headline number | Paperclips | `<h2>Paperclips: N</h2>`, `main.js:2403-2464` |
| Trigger ≠ cost: projects appear on trigger, grey until affordable | Paperclips | `manageProjects`, `main.js:186-204` |
| Fibonacci milestones for Trust | Paperclips | `main.js:2621-2630` |
| Idle copies write synthetic data (overflow currency) | Paperclips creativity | `main.js:3363-3365` |
| Rescue cards when stuck (bridge loan, sell old GPUs) | Paperclips "Beg for More Wire" | `projects.js:33` |
| Stage gate deletes the player's verb (the Complete Task button) | Paperclips HypnoDrones | `projects.js:711-756` |
| Buy GPUs ×1,000 → ×10,000 → ×100,000 as tiers rise | Paperclips drone/farm multi-buy | `main.js:1807-1895` |
| Five-line console, no history | Paperclips | `main.js:294-300` |
| Stage transition banner (1.5 s gate line) | Paperclips HypnoDrone banner | `main.js:243-288` |
| Reveal a build row at 50% of its cost | A Dark Room | `room.js:1088-1095` |
| Random events every few minutes, chosen from what is legal, as modals with costs on the buttons | A Dark Room | `events.js:1316-1336` |
| Delayed payoffs persisted in the save (funding round resolves later) | A Dark Room wanderer | `events/room.js:356-367` |
| Negative-feedback events keyed to scale (theft once you matter) | A Dark Room thieves/raids | `events/outside.js` |
| Tiered danger warnings printed where the danger is | A Dark Room armour warnings | `world.js:456-478` |
| A single global speed scalar for testing (hyper mode) | A Dark Room | `engine.js:834-853` |
| Discrete run with phases, a scored card, and a head start for the next | Game Dev Story | Creating games page |
| Deploy vs keep internal; cheap "mini" releases; weight theft; the Oversight Committee | AI 2027 | scenario Jan–Oct 2027 |
| SC / SAR / SIAR / ASI tiers and multipliers | AI 2027 takeoff forecast | milestones table |
| "Country of geniuses in a datacenter" as the research handoff | AI 2027, Situational Awareness | Jun 2027; Part II |
| Intelligence staircase labels on the graph (mouse, intern, expert, Einstein, humanity) | Wait But Why | part 2 |
| Hidden alignment, drift, two warnings and a last chance | Last Invention wiki, the book | Alignment, Early Endings |

## E.2 What we deliberately do differently

- Paperclips has no timers or offline progress and freezes in background tabs; we keep the existing requestAnimationFrame clamp (effectively the same pause) and the versioned save with migration.
- A Dark Room's events pause nothing and arrive on fixed 3–5 minute timers; ours are state-triggered with minimum spacing, and crises carry a countdown and a default.
- Game Dev Story's sequel rule rewards score; ours rewards a clean release (+1 Trust) and lets the next run start before the previous model ships.
- The wiki's Stage 2 switches the headline to capability and uses sliders; we keep tasks, buttons, and projects, because Stage 1's pacing and UI are the bar.
- AI 2027's numbers (GW, $B, copies) are reported in the console as flavor; the engine's units stay small enough to tune.
