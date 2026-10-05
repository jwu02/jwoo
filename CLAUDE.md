# CLAUDE.md

## Project

Personal site: Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui. A 3D home scene at `/`, activity-telemetry and AI-usage dashboards, a knowledge graph, and a resume. Data lives in MongoDB; drawn with Recharts, react-three-fiber scenes, and a 3D keyboard heatmap.

## Commands

Standard scripts in `package.json` (`dev`, `build`, `start`, `lint`, `format`, `typecheck`, `test`). Tests live under `tests/`, mirroring the source tree; run one with `npm test -- <path>`.

## Layout

Each dashboard is one vertical slice — lib, API route, components — standing on shared kernels: `lib/db.ts` (the Mongo client, one collection accessor), `lib/ranges.ts` + `lib/timezone.ts` (ranges, UTC buckets), `lib/ui/` (framework-free chart/tooltip vocabulary), `hooks/` (shared React hooks: the polled fetch cycle, the pixi app lifecycle). Read the tree for the file map.

Boundaries: `lib/telemetry/` and `lib/ai-usage/` import nothing from each other — shared code sits at the lib root (`tests/lib/features-do-not-import-each-other.test.ts` enforces it). three loads only inside `*-canvas.tsx` implementations (Gotchas below).

The site is framed as an OS: every route is an *application* the Dock selects. `app/layout.tsx` mounts the shell; `components/os/` holds it, and `components/os/apps.ts` is the single list of applications the Dock reads. See `docs/adr/0004-one-application-at-a-time.md`.

## Conventions

- `.env` needs `MONGO_URI` (read lazily, throws if missing) and `ACTIVITY_DB_NAME` (defaults to `activity-telemetry`).
- Buckets are UTC ISO strings; aggregations take an injectable `now = new Date()`; `alignToInterval` deliberately mirrors MongoDB `$dateTrunc`.
- Dark only: `<html class="dark">` is fixed in `app/layout.tsx`. There is no theme toggle — the OS chrome is glass, which needs a dark wallpaper to read as glass.
- Domain vocabulary in `CONTEXT.md`; hard-to-reverse decisions in `docs/adr/`.

## Gotchas

- **Next.js 16 has breaking changes** vs. prior versions — read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.
- **Non-trivial work is planned through the interview** (`/grill-with-docs`), approved in-session, then implemented — no committed spec docs.
- **Use the `shadcn` skill** for shadcn component work (project skill, symlinked in `.claude/skills/`) rather than hand-writing UI primitives.
- **three must never enter a route's eager module graph.** Each scene is a three-free adapter (`*-scene.tsx`) plus a lazily loaded implementation (`*-canvas.tsx`, the only place three is imported); `next/dynamic({ ssr: false })` sits outside the implementation. See `docs/adr/0001-scene-chunk-isolation.md`; `tests/lib/three/eager-graph-is-three-free.test.ts` enforces it.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues on jwu02/jwoo via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
