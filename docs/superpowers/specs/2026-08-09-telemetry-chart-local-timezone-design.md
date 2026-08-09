# Telemetry Chart: Local Timezone Display and 24-Hour Format

## Context

The telemetry activity chart currently formats bucket timestamps in UTC. For users in non-UTC timezones (e.g., China Standard Time, UTC+8), the axis labels and tooltip times do not match their local time. The previous iteration aligned tooltips with UTC ticks, but the user wants the chart to reflect their local timezone instead.

## Goals

- Display all chart time labels in the browser's local timezone.
- Show a timezone badge near the chart so the viewer knows which timezone is being used.
- Use 24-hour time format on the `24h` view:
  - X-axis: `00:00`, `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`
  - Tooltip: `8/9/2025, 03:00`
- Keep `7d`/`30d`/`1y` labels date-focused:
  - X-axis: `Aug 5`
  - Tooltip: `Aug 5, 2025`
  - `1y` x-axis: `Aug 2025`
  - `1y` tooltip: `Aug 2025`

## Non-Goals

- Add timezone selection or user preference.
- Change the data bucket intervals or aggregation.
- Support multiple timezones simultaneously.

## Design

### Time formatting helpers

Introduce a new file, `lib/telemetry/chart-format.ts`, with pure helpers:

```ts
export function formatTick(bucket: string, range: TelemetryRange): string
export function formatTooltip(bucket: string, range: TelemetryRange): string
export function getTimezoneLabel(): string
```

All helpers use the browser's local timezone via `toLocaleString` / `toLocaleDateString` without an explicit `timeZone` option.

- `formatTick`:
  - `24h`: `{ hour: "2-digit", minute: "2-digit", hour12: false }` → `00:00`, `03:00`, etc.
  - `7d`/`30d`: `{ month: "short", day: "numeric" }` → `Aug 5`
  - `1y`: `{ month: "short", year: "numeric" }` → `Aug 2025`

- `formatTooltip`:
  - `24h`: `{ dateStyle: "short", timeStyle: "short", hour12: false }` → `8/9/2025, 03:00`
  - `7d`/`30d`: `{ month: "short", day: "numeric", year: "numeric" }` → `Aug 5, 2025`
  - `1y`: `{ month: "short", year: "numeric" }` → `Aug 2025`

- `getTimezoneLabel`:
  - Derives the short timezone name (e.g., `CST`) using `new Date().toLocaleTimeString("en-US", { timeZoneName: "short" })`.
  - Computes the offset (e.g., `UTC+08:00`) from `new Date().getTimezoneOffset()`.
  - Returns a string like `CST UTC+08:00`.

### Chart component

`components/telemetry/activity-chart.tsx` is updated to:

1. Import `formatTick`, `formatTooltip`, and `getTimezoneLabel` from `chart-format.ts`.
2. Remove the existing inline `formatTick` and the imported `formatTooltipLabel` from `chart-ticks.ts`.
3. Use `formatTick` for `<XAxis tickFormatter>` and `formatTooltip` for `<Tooltip labelFormatter>`.
4. Render a small timezone badge in the top-right corner of the chart card, using `getTimezoneLabel()`.

### Cleanup

`lib/telemetry/chart-ticks.ts` keeps only `getTicksForRange`; the `formatTooltipLabel` helper added during the UTC fix is removed.

### Data flow

No API or aggregation changes. The bucket strings remain UTC ISO strings; only the display layer converts to local time.

## Components

### `lib/telemetry/chart-format.ts` (new)

- `formatTick(bucket, range)` — local-time x-axis label formatter.
- `formatTooltip(bucket, range)` — local-time tooltip label formatter.
- `getTimezoneLabel()` — browser timezone abbreviation + offset.

### `components/telemetry/activity-chart.tsx` (modified)

- Use helpers from `chart-format.ts`.
- Add timezone badge in chart card corner.

### `lib/telemetry/chart-ticks.ts` (modified)

- Remove `formatTooltipLabel`.

### `tests/lib/telemetry/chart-format.test.ts` (new)

- Unit tests for `formatTick`, `formatTooltip`, and `getTimezoneLabel` covering all ranges.

## Error Handling

No new error states. If `Intl` or `Date` APIs are unavailable, the helpers fall back to default browser behavior.

## Testing

- `npm test` — existing suite plus new `chart-format.test.ts`.
- `npm run typecheck`
- `npm run lint`
- Manual check: verify the timezone badge, 24h x-axis labels, and tooltip time match the browser's local timezone.

## Out of Scope

- Timezone picker or user preference.
- Changing bucket intervals.
- Dark-mode-specific label styling.
