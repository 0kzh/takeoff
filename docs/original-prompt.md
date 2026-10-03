# Original Prompt

/goal
Help me make a browser game similar to Universal Paperclips (https://github.com/jgmize/paperclips), which is the primary reference, and A Dark Room (https://github.com/doublespeakgames/adarkroom) about training AI as an AI lab racing to build superintelligence (ASI), and aligning it before it kills everyone. It should be based on https://ai-2027.com. I want you to analyze the source code for both of these in detail. Similar to both of the games, the game should start out very simple. The website should be pretty similar in styling. The user doesn't really know where things are going just yet, and if you look closely, a lot of things are revealed over time. The user doesn't know when the game ends. Build it in raw HTML/CSS with vanilla TypeScript compiled to plain JS (no frameworks, no game engines). do this on a separate branch, another agent will be working on main

Primary bar: Universal Paperclips (mirror: https://github.com/jgmize/paperclips).
Secondary: A Dark Room (https://github.com/doublespeakgames/adarkroom).

Clone both and analyze the source in detail before writing any code. Specifically document:

* How purchases/upgrades are defined (trigger, cost, effect, flavor text) and how triggers chain so a new goal is always just out of reach.
* How panels and buttons are revealed over time, and how the UI reshuffles between stages.
* How the event log works: message cadence, tone, and how choices are presented and resolved.
* How currencies are layered (e.g. a currency that only accumulates while another is capped).
* How pacing is controlled: tick rates, cost curves, milestone thresholds (e.g. Paperclips' Fibonacci trust schedule).
* How save/load works.


You should also analyze https://universalpaperclips.fandom.com/wiki/Universal_Paperclips_Wiki
and https://kairosoft.fandom.com/wiki/Game_Dev_Story with separate agents. the training model loop would look similar to the building/publishing game loop in game dev story

Write this analysis to `docs/reference-analysis.md` before building. As much detail into the mechanics here as you can possibly do. You should map out both games in depth.
Other sources you can draw from:

* https://situational-awareness.ai
* https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html
* https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-2.html
* https://universalpaperclips.fandom.com/
* If anyone builds it everyone dies (in the repo)


There's a core loop that the user creates, which is basically around gathering resources and then training AI. You can also release the AI to the public, who will then feed you revenue, and you can use that revenue to build more data centers, mine more resources, hire people, etc. The game itself should also have multiple stages. At some stage, I'm thinking you have a graph similar to AI-2027 showing relative IQ, which basically shows how smart the AI is compared to different benchmarks (ex. human, researcher, etc.).
you should also have a resources panel very similar to what A Dark Room has for meat, wood, etc.
Similar to A Dark Room, there should be a log of events that happen over time. Eventually, you get presented with some opportunities, and the user has to make a choice on what to do. The game should use fictitious names, similar to what AI-2027 does with DeepCent and OpenBrain. At some point in the game, there should also be geopolitics involved, including China and potentially Iran.
The only number that matters is Tasks Completed. The game runs from mid-2025 to the end of the world (or the treaty), in five stages over about 3–4 hours.
Core loop: Complete tasks → earn revenue → buy compute → run more copies → complete more tasks.
The core loop that should be done multiple times is training and releasing a model. At some point as well, you should be able to start training a new model before the old one is deployed, after passing a threshold. Make sure that training a model on this timeline does not take more than 1-2 minutes.
Show the carrot before it's reachable. Reveal projects on their trigger, not on affordability, so there's always a greyed-out goal on screen. At any point in the game, the user should always have something that they're working towards next. The current bottleneck should always be able to be addressable, for example, if revenue is the bottleneck, you should always have a way for the user to make more revenue. If compute is the bottleneck, the user should always have a way to get more compute.
The UI should re-shuffle, as in universal paperclips or a dark room, as the user progresses through stages.
As part of the game, there should also be an event log of developments (similar to a dark room and plague inc) that updates as the user makes progress or performs actions.
You should also engineer certain crises during the game, such as AI hacking, engineering a pandemic, nanobots, robots shutting down all datacenters, etc.
Here a list of everything you should probably include in the game:

* give the economy changing bottlenecks
* interpretability and neuralese
* a stats panel that pops in later
* job displacement / public riots
* government relationship
* branching endings (alignment/prosperity, ai kills all humans, you get nationalized)
* end-of-run stats screen
* old generations as monitors
* humanoid robots
* going to space
* universal basic income
* human researchers start as your best source of R&D and decay to irrelevance
* space/orbital compute/datacenters

6. Stages

Outline and plan your stages similar to https://universalpaperclips.fandom.com/wiki/Stages

7. Build and Testing
Critic loop
Fan out a separate, harsh critic with fresh context and no access to our design notes.
8. The critic clones Universal Paperclips and treats it as the bar.
9. It plays our build head-to-head with Paperclips/A Dark Place in a headless browser (e.g. Playwright), using the dev overlay to reach later stages. Add the same dev overlay/cheat menu to Paperclips/A Dark Place if needed.
10. It scores both games on:

* Time to first meaningful choice
* Seconds spent with nothing to do
* Cognitive load and progressive disclosure
* Cadence of reveals (new panel or mechanic every N minutes)
* Whether a greyed-out goal is always on screen
* Clarity of stage transitions
* Soft-locks found

11. It names the single biggest gap, specific enough to act on. Example: "Stage 2 has 4 minutes with no new goal after Agent-3," not "pacing feels off."
12. Fix it, then loop until ours wins on the rubric or I stop you.

Playtesting should be done in phases/stages of the game. With the dev menu you can rewind to each stage.

Use fable for planning and research, opus 5.5 for implementation. use subagents.
