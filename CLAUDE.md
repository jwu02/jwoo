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
  - `tooltip-position.ts` — clamps/flips heatmap tooltip within its scroll container.
- **`components/telemetry/`** — presentational React components (`SummaryCards`, `KeyboardHeatmap`, `MouseVisual`, `RangeSelector`, `ActivityChart`, `ErrorBanner`). `app/page.tsx` owns all state and polling (refetches every 60s, aborts stale requests via `AbortController`).
- **`components/ui/`** — shadcn/ui components (`components.json` config: base-nova style, lucide icons, RSC enabled).

## Conventions

- **Path alias**: `@/*` maps to the project root (configured in both `tsconfig.json` and `jest.config.js`).
- **Env vars**: `.env` must provide `MONGO_URI` and `ACTIVITY_DB_NAME` (defaults to `activity-telemetry`). `MONGO_URI` is read lazily and throws if missing.
- **Time handling**: buckets are UTC ISO strings; aggregation functions accept an injectable `now = new Date()` for testability. Bucket alignment (`alignToInterval`) deliberately mirrors MongoDB `$dateTrunc` semantics.
- **Testing**: Jest with `next/jest` + `jest-environment-jsdom`; `@testing-library/jest-dom` is auto-loaded via `jest.setup.ts`.
- **Theming**: `next-themes` via `components/theme-provider.tsx`; pressing `d` (with no modifiers, outside a typing target) toggles light/dark.

## Gotchas

- **Next.js 16 has breaking changes** vs. prior versions — APIs, conventions, and file structure may differ from older training data. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.
- **Development uses a spec-driven workflow**: feature specs and plans are committed under `docs/superpowers/specs/` and `docs/superpowers/plans/` (one pair per dated feature), with progress ledgers in `.superpowers/sdd/<feature>/`. Follow that pattern when adding non-trivial features.
- **The `shadcn` skill is installed** as a project skill (symlinked in `.claude/skills/`) — use it for shadcn component work rather than hand-writing UI primitives.
