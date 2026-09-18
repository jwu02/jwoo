# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal site built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and shadcn/ui: a 3D home scene at `/`, an activity-telemetry dashboard, AI-usage charts, a knowledge graph, and a resume. Data comes from MongoDB and is drawn with Recharts, a custom SVG keyboard heatmap, and react-three-fiber scenes.

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

Each dashboard owns one vertical slice — lib, route, components — and the two
slices stand on the same shared kernels:

```
MongoDB ─► lib/db.ts ─┬─► lib/telemetry/aggregation.ts ─► app/api/telemetry/route.ts ─► components/telemetry/*
                      └─► lib/ai-usage/aggregation.ts  ─► app/api/ai-usage/route.ts  ─► components/ai-usage/*
```

Both aggregations also sit on `lib/ranges.ts` and `lib/timezone.ts`.

- **`lib/db.ts`** — the Mongo client and every collection getter (`getTelemetryCollection`, `getKeyboardHeatmapCollection`, `getAiUsageCollection`), all in `ACTIVITY_DB_NAME`. The client is cached on `global._mongoClient` across dev hot-reloads. Neither feature reaches the database through the other.
- **`lib/ranges.ts`** — the shared `Range` type (`24h` | `30d` | `1y`), `getRangeStart`, and activity telemetry's bucket interval.
- **`lib/timezone.ts`** — timezone validation (`isValidTimeZone`), bucket alignment (`alignToInterval`, deliberately mirroring MongoDB `$dateTrunc`) and bucket generation (`generateBuckets`).
- **`lib/ui/`** — framework-free UI vocabulary, consumed by components and by nothing in the lib: `chart-format.ts` (tick/tooltip labels, number formatting), `chart-ticks.ts` (tick selection per range), `pill-toggle.ts` (the toggle styling both dashboards share), `tooltip-position.ts` (clamps/flips a tooltip within its scroll container; shared by the charts and the 3D scenes).
- **`app/api/`** — three `GET` routes. `telemetry` and `ai-usage` each validate a `range` param (`24h` | `30d` | `1y`) and a `tz`, fetch their aggregates in parallel, and answer `Cache-Control: no-store`, returning 400 on an invalid range. `knowledge-graph` serves the cached snapshot.
- **`lib/telemetry/`** — activity telemetry only. Shares the range type with AI usage but keeps its own bucket interval (24h bins every 30 minutes) and its own `RANGE_OPTIONS`:
  - `types.ts` — the wire types (`TelemetryRange`, `TelemetryTotals`, `KeyCounts`, `TimeSeriesPoint`, `TelemetryResponse`).
  - `aggregation.ts` — the mouse/keyboard pipelines. `fetchTimeSeries` fills empty buckets with zero values so charts are always continuous.
  - `key-layout.ts` — the physical MacBook M3 UK keyboard geometry (`PHYSICAL_KEYS`) and the raw-label → physical-key map (`buildKeyCountMap`).
- **`lib/ai-usage/`** — AI usage only, importing nothing from `lib/telemetry/` and vice versa; shared code is reached from the lib root. `tests/lib/features-do-not-import-each-other.test.ts` enforces that boundary:
  - `types.ts` — the wire types (`Totals`, the `byModel`/`byProject`/`byHarness` rows, the time series).
  - `aggregation.ts` — the AI-usage pipelines and fetchers.
  - `ranges.ts` — this dashboard's `RANGE_OPTIONS` and its hourly bucket interval.
  - `colors.ts` — the chart palette: a provider's brand hue, stepped into a shade per sibling model.
  - `project-groups.ts` — the cwd → project display config. Its ordering is load-bearing: a nested project must precede the broader key whose paths also contain it.
- **`components/three/`** — the shared rig all three 3D scenes mount through (home desk, keyboard heatmap, mouse telemetry), so the WebGL gate, Canvas config, default lights and hover/tooltip layer exist once instead of three times:
  - `scene-gate.tsx` — the three-free gate: WebGL capability check, error boundary, `next/dynamic({ ssr: false })` loading, and the fallback swap. Contains no three.js imports.
  - `scene-canvas.tsx` — the Canvas itself: `dpr`, `gl`, camera, hemisphere light, optional directional key light, Suspense. Mounted only from inside a scene's lazily loaded implementation.
  - `scene-hover.tsx` — the shared hover layer: anchor→screen-position plumbing, the positioned tooltip, and the focusable a11y layer that drives the same hover state as the 3D pointer.
  - `three-console.ts` — side-effect import that filters the upstream R3F `THREE.Clock` deprecation warning; imported by `scene-canvas`.
- **`components/polled/`** — the controls both polled pages share (`RangeSelector`, `ErrorBanner`), named for the domain role they serve rather than for one of their two users. The range selector takes its options as a prop, so no dashboard's range list lives in another's feature.
- **`components/telemetry/`**, **`components/ai-usage/`** — each dashboard's presentational components. The polled pages own only their local UI state; the fetch/abort/poll cycle they share lives in `hooks/`.
- **`components/ui/`** — shadcn/ui components (`components.json` config: base-nova style, lucide icons, RSC enabled).
- **`hooks/`** — cross-feature React hooks. `use-polled-json.ts` owns the polled pages' whole cycle (refetches every 60s, aborts the request it replaces, and shapes errors); `use-mobile.ts` is the shadcn breakpoint hook.

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
