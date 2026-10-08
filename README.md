# Takeoff

An incremental browser game about an AI lab racing to superintelligence.

## Development

Use Node **22.18 or newer** and npm. Dependencies and playtest tools share the root lockfile.

```sh
npm ci
npm run dev
```

Vite starts on `http://127.0.0.1:8731` (or the next available port). It provides React Fast Refresh.

```sh
npm run build          # Typecheck the application AND tooling, then bundle into dist/
npm run preview        # Serve the production build
npm run typecheck
npm run lint
npm run format:check
npm test               # Engine/store parity, saves, React interactions and cleanup
npm run sim -- --seed 1 --minutes 30 --quiet
npm run test:browser   # Existing full Stage 1 → Stage 2 suite; requires installed Chrome
```

Vercel uses the Vite framework and publishes `dist/`. The previous hand-built `public/` package and custom development server have been removed.

## Architecture

- `src/engine/`: deterministic TypeScript game rules, actions, seeded randomness, serialization and fixed 100ms simulation ticks. No React, Zustand, storage or DOM dependencies.
- `src/data/`: typed game content and scenario presets.
- `src/sim/`: headless policies and simulation CLI, using the same engine as the UI.
- `src/store/game.ts`: Zustand store. Typed actions and engine ticks operate on Immer drafts and publish immutable snapshots with structural sharing. Reset/import create independent game instances and clear autoplay memory.
- `src/store/context.tsx`: React provider and selector hooks. Each provider owns its store; tests do not share a singleton.
- `src/components/`: declarative React panels, reusable reveal/progress controls, narrative, choices and developer controls. Existing CSS, IDs and visible game layout are retained.
- `src/App.tsx`: application composition and the lifecycle of the clock, persistence and debug bridge. Effects release timers, listeners and animation frames, including during Strict Mode remounts.
- `src/ui/save.ts`: existing versioned save format, base64 import/export, action saves and periodic autosaves. Storage failures do not stop gameplay.
- `src/ui/debug.ts`: compatibility bridge for existing browser playtests. Its mutable sandbox is separate from the immutable Zustand snapshots; `render()`, `tick()` and `save()` commit external test edits.

Application, engine and unit tests use strict TypeScript. All authored JavaScript tooling is now TypeScript as well. The historical multi-game critic has its own checked configuration (`tools/tsconfig.json`) with relaxed inference for untyped external-game globals and heterogeneous report payloads. It does not use `@ts-nocheck`. Browser contracts are declared in `tools/browser.d.ts`.

The original engine's `.js` import specifiers resolve to TypeScript source through Vite/TypeScript/tsx; they do not imply separate JavaScript source files. Browser tooling runs with Node's native TypeScript erasure so serialized in-page functions do not pick up transpiler helper dependencies.

## Saves and developer controls

Existing local saves and exported saves remain compatible. Add `?seed=1&speed=0` for a reproducible, paused game. Press backtick, or add `&dev=1`, to open developer controls. Stages 1 and 2 have real presets; later preset buttons retain their existing Stage 2 fallback notice.

## Verification notes

The migration adds regression tests for immutable snapshots, direct-engine parity, four autoplay policies, fractional ticks, saved-game continuation, reset, Unicode saves, unavailable storage, keyboard focus and lifecycle cleanup.

The existing browser suite was run before the migration: **45/48 checks passed**. After the React migration and a fix to the existing `1 GPUs` label: **46/48 checks passed**, with no page/console errors and no overflow at 390px. Its two remaining failures also occurred before migration:

1. Focus appears before Projects, contrary to the suite's expected reveal order.
2. Revealing the three Focus buttons exceeds its two-controls-per-beat target.

These are existing gameplay pacing expectations, not migration regressions. `npm run test:browser` deliberately continues to report them and exits nonzero; it does not silently waive failures. Screenshots are written to `agent-tools/shots/stage1/`.

The converted critic can also run repeated deterministic browser sessions:

```sh
node tools/critic/determinism.ts takeoff --accel-minutes 2 --out determinism
```

See [the critic documentation](tools/critic/README.md) for longer playtests and comparisons.
