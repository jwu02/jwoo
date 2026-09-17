# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal "Activity Telemetry" dashboard built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and shadcn/ui. It renders a single page (`app/page.tsx`) that visualizes mouse/keyboard activity collected from MongoDB and displayed via Recharts and a custom SVG keyboard heatmap.

## Commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint
npm run format     # prettier --write on ts/tsx
npm run typecheck  # tsc --noEmit
npm test           # jest (all tests)
```

- Run a single test: `npx jest tests/lib/telemetry/aggregation.test.ts` (or `npm test -- <path>`).
- Tests live under `tests/`, mirroring the source tree (e.g. `tests/lib/telemetry/…`, `tests/components/telemetry/…`, `tests/app/api/telemetry/…`).

## Architecture

Data flows from MongoDB through a pure logic layer into presentational components:

```
MongoDB ──► lib/telemetry/db.ts ──► lib/telemetry/aggregation.ts ──► app/api/telemetry/route.ts ──► components/telemetry/*
```

- **`app/api/telemetry/route.ts`** — the only API route. A `GET` handler validates a `range` query param (`24h` | `7d` | `1y`), then fetches totals, key counts, and a time series in parallel. Returns a `TelemetryResponse` (`totals`, `keys`, `timeSeries`) with `Cache-Control: no-store`.
- **`lib/telemetry/`** — pure, framework-free logic, almost entirely unit-tested:
  - `types.ts` — shared types (`TelemetryRange`, `TelemetryTotals`, `KeyCounts`, `TimeSeriesPoint`, `TelemetryResponse`).
  - `db.ts` — Mongo client access, cached on `global._mongoClient` across dev hot-reloads. Two collections in `ACTIVITY_DB_NAME`: `telemetry` (click/movement/keypress events) and `keyboard_heatmap` (per-key press counts).
  - `aggregation.ts` — Mongo aggregation pipelines + bucket generation. `fetchTimeSeries` fills empty buckets with zero values so charts are always continuous.
  - `ranges.ts` — maps each `TelemetryRange` to a lookback window (`getRangeStart`) and bucket interval (`getBucketInterval`).
  - `chart-format.ts` / `chart-ticks.ts` — tick/tooltip label formatting and tick selection per range.
  - `key-layout.ts` — defines the physical MacBook M3 UK keyboard geometry (`PHYSICAL_KEYS`) and maps raw telemetry labels to physical keys (`buildKeyCountMap`).
- **`components/three/`** — the shared rig all three 3D scenes mount through (home desk, keyboard heatmap, mouse telemetry), so the WebGL gate, Canvas config, default lights and hover/tooltip layer exist once instead of three times:
  - `scene-gate.tsx` — the three-free gate: WebGL capability check, error boundary, `next/dynamic({ ssr: false })` loading, and the fallback swap. Contains no three.js imports.
  - `scene-canvas.tsx` — the Canvas itself: `dpr`, `gl`, camera, hemisphere light, optional directional key light, Suspense. Mounted only from inside a scene's lazily loaded implementation.
  - `scene-hover.tsx` — the shared hover layer: anchor→screen-position plumbing, the positioned tooltip, and the focusable a11y layer that drives the same hover state as the 3D pointer.
  - `three-console.ts` — side-effect import that filters the upstream R3F `THREE.Clock` deprecation warning; imported by `scene-canvas`.
- **`components/telemetry/`** — presentational React components (`SummaryCards`, `KeyboardHeatmap`, `MouseVisual`, `RangeSelector`, `ActivityChart`, `ErrorBanner`). `app/page.tsx` owns all state and polling (refetches every 60s, aborts stale requests via `AbortController`).
- **`components/ui/`** — shadcn/ui components (`components.json` config: base-nova style, lucide icons, RSC enabled).
- **`lib/ui/`** — small framework-free UI helpers (`tooltip-position.ts` — clamps/flips a tooltip within its scroll container; shared by the telemetry charts and the 3D scenes).

## Conventions

- **Path alias**: `@/*` maps to the project root (configured in both `tsconfig.json` and `jest.config.js`).
- **Env vars**: `.env` must provide `MONGO_URI` and `ACTIVITY_DB_NAME` (defaults to `activity-telemetry`). `MONGO_URI` is read lazily and throws if missing.
- **Time handling**: buckets are UTC ISO strings; aggregation functions accept an injectable `now = new Date()` for testability. Bucket alignment (`alignToInterval`) deliberately mirrors MongoDB `$dateTrunc` semantics.
- **Testing**: Jest with `next/jest` + `jest-environment-jsdom`; `@testing-library/jest-dom` is auto-loaded via `jest.setup.ts`.
- **Theming**: `next-themes` via `components/theme-provider.tsx`; pressing `d` (with no modifiers, outside a typing target) toggles light/dark.

## Gotchas

- **Next.js 16 has breaking changes** vs. prior versions — APIs, conventions, and file structure may differ from older training data. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.
- **Non-trivial work is planned through an interview** (`/grill-with-docs`), approved in-session, then implemented — no committed spec docs. Domain vocabulary lives in `CONTEXT.md` and hard-to-reverse decisions in `docs/adr/`.
- **The `shadcn` skill is installed** as a project skill (symlinked in `.claude/skills/`) — use it for shadcn component work rather than hand-writing UI primitives.
- **three must never enter a route's eager module graph.** Each scene is a three-free adapter (`*-scene.tsx`, decides *whether* and *where* the scene mounts) plus a lazily loaded implementation (`*-canvas.tsx`, owns camera/model/overlays and is the only place three is imported). `next/dynamic({ ssr: false })` must sit outside the implementation. See `docs/adr/0001-scene-chunk-isolation.md`; `tests/lib/three/eager-graph-is-three-free.test.ts` enforces it.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues on jwu02/jwoo via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
