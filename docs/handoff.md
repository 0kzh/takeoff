# Handoff — Takeoff (ASI race incremental game)

**Repo:** `/Users/kelvin/Projects/takeoff-asi-race` (remote `github.com/0kzh/takeoff`). **Branch:** `asi-race-game` (local commits only — nothing has been pushed from this machine; `main` is not to be touched).
**Goal:** a browser incremental game about an AI lab racing to superintelligence, built in raw HTML/CSS + vanilla TypeScript (`tsc` → plain ES modules, no frameworks, no bundler, no runtime deps). Primary bar: Universal Paperclips. Secondary: A Dark Room. World: AI 2027. The user's full brief is `docs/original-prompt.md`.

**Process rules from the user:** Fable models for research/planning (and the critic), Opus 5.5 for implementation, via subagents, **1–3 running at a time**. The critic loop runs **after each stage**, with fresh context and no access to the design notes. Do not create PRs.

## The plan

| # | Step | Owner | State |
|---|---|---|---|
| 1 | Stage 1 critic round-1 fixes (`docs/critic-stage1-round1.md`) | Opus | **Done** — commits `66d0fa0`…`02be228` |
| 2 | Stage 1 polish pass (capability-based training costs, modal pacing, project drip, rental quota, fewer numbers) | Opus | **Done** — commits `ce41926`…`75874a7` |
| 3 | Rebuild the critic harness (the old one was lost with the previous VM) | Opus | **Done** — `tools/critic/`; extension for Paperclips Stage 2/3 play in flight |
| 4 | Stage 1 critic round 2 on a frozen snapshot | Fable critic | **Done** — `docs/critic-stage1-round2.md`: **Takeoff 8.1 vs Paperclips 7.7**. Takeoff wins narrowly |
| 4b | Stage 1 round-2 fix pass (decisions that matter, slower minute 3–10, rental quota in steps, price steps, wall and console bugs) and the mid-game income stall the harness found afterwards | Opus | **Done** — commits `352eb1d`…`4549e17`. Harness first-timer 30:30–33:40; sim bot 26:05–26:43. Critic round 3 in flight on snapshot `s12-r3` → `docs/critic-stage1-round3.md` |
| 5 | Arc contract + Stage 2 spec | Fable | **Done** — `docs/specs/arc.md`, `docs/specs/stage2.md` |
| 6 | Stage 2 build from the spec, then its critic loop vs Paperclips Stage 2 | Opus / Fable | Build **done** (`6359aac`…`7fd0121`). Critic round 1: **Takeoff 7.4 vs Paperclips 6.7** (`docs/critic-stage2-round1.md`). Its fixes are **done** (`0b84d2f`…`4549e17`): lots in three sizes with printed returns, a standing-order budget, building ahead, Train now, Focus trades on the buttons, meters with bands. Critic round 2 in flight on `s12-r3` → `docs/critic-stage2-round2.md` |
| 7 | Stage 3 spec → build → critic loop | Fable / Opus / Fable | Spec **done** — `docs/specs/stage3.md` (as-built patch in flight); build starts when the patch lands |
| 8 | Stage 4 spec → build → critic loop | | Spec **done** — `docs/specs/stage4.md`; build pending 7 |
| 9 | Stage 5 + endings + end-of-run stats → spec → build → critic loop | | Spec **done** — `docs/specs/stage5.md`; build pending 8 |
| 10 | Full-run critic pass (new game → an ending, ~3–4 h of game time), final polish, docs | | Not started |

Each stage follows the same pipeline: **spec (Fable) → build (Opus) → frozen snapshot → critic (Fable, fresh context) → fixes (Opus) → critic again until the stage beats the matching Paperclips stage on the rubric.** The planner works one stage ahead of the builder; the critic plays a snapshot so the builder can keep going.

## Where the design lives (precedence, highest first)

1. `docs/original-prompt.md` — the user's requirements.
2. `docs/specs/arc.md` — cross-stage contract: requirement checklist (R1–R35), per-stage scale targets, persistent variables, exact ending conditions, pacing guardrails G1–G14, the transition contract.
3. `docs/specs/stageN.md` — implementation-ready stage specs for Stages 2–5. Stage 3–5 numbers come from paper models and must be re-tuned in the sim; each spec gets an "as-built deltas" patch from the planner just before its build starts.
4. `README.md` and the code — what is actually shipped.
5. `docs/design.md`, `docs/stages.md` — the original design; superseded wherever the above disagree. `docs/stages.md` is kept in sync with each stage as it lands.
6. `docs/reference-analysis.md` (6,909 lines) — the mined references: Universal Paperclips source and wiki, A Dark Room source, Game Dev Story, AI-2027 / Situational Awareness / Wait But Why / IABIED. Do not re-fetch; grep it.

## How to run

```sh
npm install && npm run build
PORT=8742 node scripts/serve.mjs          # port 8731 (the default) is taken by Cursor on this Mac
npm run sim -- --minutes 45 --seed 1      # headless bot; add --policy naive, --json, --quiet
node tools/verify/smoke.mjs               # Playwright smoke test (starts its own server); --policy naive
```

`?dev=1` (or backtick) opens the dev overlay; `window.__game` is the scripting API (see `README.md`). Playwright lives in `tools/node_modules/playwright-core` and drives the system Chrome (`chromium.launch({ channel: 'chrome', headless: true })`); no browser download is needed.

Gitignored working folders under `agent-tools/`: `refs/` (clones of Universal Paperclips and A Dark Room), `snapshots/<label>/` (frozen builds of Takeoff for the critic, with the design notes removed), `critic-out/` (harness output), `shots/` (screenshots).

## Critic loop

- Rubric (unchanged since round 1): time to first meaningful choice; seconds with nothing to do; cognitive load & progressive disclosure; cadence of reveals; greyed-out goal always on screen; clarity of the stage transition; soft-locks. The critic names the single biggest gap, specific enough to act on.
- Round 1 (Stage 1): **Takeoff 5.6 vs Paperclips 7.9** — `docs/critic-stage1-round1.md`. Biggest gap: a 10–14 minute dead tail before the datacenter. All of its findings are addressed in step 1 above.
- Round 2 (Stage 1): **Takeoff 8.1 vs Paperclips 7.7** — `docs/critic-stage1-round2.md`. The dead tail is fixed (longest reveal gap 150–162 s vs Paperclips' 876 s). Biggest remaining gap: "Nothing Stage 1 asks the player to decide changes Stage 1" — ten play styles all finish in 31–35 min in the same state. Its lessons (stakes printed on the buttons and sized to the economy, no conveyor-belt projects, a words budget, non-blocking modals) are being applied to every later stage and are being written into `docs/specs/arc.md` as guardrails.
- Stage 2, round 1: **Takeoff 7.4 vs Paperclips 6.7** — `docs/critic-stage2-round1.md`. Wins on first choice, cadence, greyed goal, soft-locks; loses "nothing to do" (5–6) and cognitive load (5–6). Biggest gap: from the Standing order to the gate (72–74 % of the stage) there is no enabled purchase in 88–90 % of checks and no way to spend toward the next run. Targets for the next build are in its §6.
- Harness: `tools/critic/` (see its README). It plays Takeoff Stages 1–2 and Paperclips Stages 1–3 to their ends with a scripted first-timer; `explore.mjs` runs play-style variants and `decisions.mjs` measures decision gaps and reveal → purchase latency. Paperclips reference: Stage 2 takes 135:46 (longest reveal gap 2,198 s), Stage 3 103:58 (3,762 s). It serves a `--game-dir` snapshot on its own port, plays both games with the same scripted "curious first-time player", and can also drive Takeoff's own bot (`--autoplay`). Reports go in `docs/critic-stageN-roundM.md`.
- To freeze a build for the critic: `git archive HEAD | tar -x -C agent-tools/snapshots/<label>`, build it with `./node_modules/.bin/tsc -p agent-tools/snapshots/<label>/tsconfig.json`, then delete its `docs/` and `tools/` so the critic cannot read the design notes.

## Fiction and tone (unchanged)

Console = Lantz: flat, present tense, 4–20 words, no exclamation marks, deadpan. Developments log = AI-2027 by way of A Dark Room: `Mon YYYY — one or two sentences`, calm; the scariest lines are the calmest. Names: **OpenMind** (player), **Anthrosoft** (US rival, model line Cadence-N), **Baiwen** (China, nationalised into the **Lanzhou CDZ**), **Sage-N** / **Steward-N** / **Concord-1**, chips **Nimbus G4–G7** fabbed at **Formosa Fab**, **the Oversight Committee**, **the Project**, **Al-Marsa Compute Park**, the pandemic **the Ashford strain**, robots **Atlas-class**.

## History

- 2026-10-03, earlier session (Linux VM, `/workspace`, branch `cursor/asi-race-game-c688`): research (`docs/reference-analysis.md`), design, architecture, Stage 1 build, critic round 1. That VM's `/tmp` (harness, reference clones, raw traces) is gone.
- 2026-10-03, this session (macOS): project moved to this repo as a single initial commit on `main`; work continues on `asi-race-game`. Plan restored; Stage 1 fixes landed; harness rebuilt; arc and Stage 2 spec written.
