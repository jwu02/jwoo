# Telemetry Chart: Custom x-axis Ticks and Grid Lines

## Context

The telemetry dashboard's activity chart uses `recharts` to plot four time series across four ranges: `24h`, `7d`, `30d`, and `1y`. Currently the x-axis labels every data bucket and the vertical grid lines appear at every bucket, which makes the axis feel crowded and the grid visually noisy.

## Goals

- Show meaningful, spaced-out x-axis tick labels for each range:
  - `24h`: every 3 hours (`12am`, `3am`, `6am`, `9am`, `12pm`, `3pm`, `6pm`, `9pm`).
  - `7d`: at midnight each day (`Aug 5`).
  - `30d`: at midnight each day (`Aug 5`).
  - `1y`: at the start of each month (`Aug 2025`).
- Draw vertical dashed grid lines only at the labeled tick positions.
- Keep the existing data bucket intervals unchanged.

## Non-Goals

- Redesign the chart series, colors, or legend.
- Change the range selector component.
- Modify the API response shape or aggregation pipeline.
- Add panning, zooming, or custom date ranges.

## Design

### Tick selection

Introduce a pure helper, `lib/telemetry/chart-ticks.ts`, with a single function:

```ts
export function getTicksForRange(
  buckets: string[],
  range: TelemetryRange
): string[]
```

The function receives the already-bucketed ISO date strings from the chart's `data` prop and returns the subset that should receive a label.

Rules:

- `24h`: select buckets whose hour is divisible by 3 (UTC, matching the hourly bucket alignment).
- `7d` and `30d`: select buckets whose time is at 00:00 UTC (daily bucket boundaries).
- `1y`: select the first bucket in each month (the earliest bucket whose date falls within that month).

### Axis formatting

`components/telemetry/activity-chart.tsx` is updated to:

1. Import `getTicksForRange`.
2. Pass the computed tick array to `<XAxis ticks={computedTicks}>`.
3. Replace the existing `RANGE_FORMATS` with range-specific formatters that produce:
   - `24h`: `12am`, `3am`, etc.
   - `7d` / `30d`: `Aug 5`.
   - `1y`: `Aug 2025`.

Because `recharts` draws `<CartesianGrid>` vertical lines at the x-axis ticks by default, the grid lines will automatically be restricted to the same labeled positions without additional configuration.

### Data flow

No data flow changes. Ticks are derived at render time from the `data` prop; the API, MongoDB aggregation, and bucket generation stay the same.

## Components

### `lib/telemetry/chart-ticks.ts` (new)

- `getTicksForRange(buckets, range)` — pure helper that selects which buckets get labels.

### `components/telemetry/activity-chart.tsx` (modified)

- Compute ticks with `getTicksForRange`.
- Pass `ticks` to `<XAxis>`.
- Update `formatTick` to produce the agreed label formats.

### `tests/lib/telemetry/chart-ticks.test.ts` (new)

- Unit tests for `getTicksForRange` covering all four ranges.
- Edge cases: empty data, midnight alignment, month boundaries.

## Error Handling

No new error states. If `data` is empty, `getTicksForRange` returns an empty array and the chart renders without labels.

## Testing

- `npm test` — existing suite plus new `chart-ticks.test.ts`.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Manual verification: switch through `24h`, `7d`, `30d`, and `1y` and confirm labels and vertical grid lines align at the specified intervals.

## Out of Scope

- Changing bucket intervals or aggregation logic.
- Horizontal grid-line changes.
- New chart interactions.
- Dark-mode-specific tick styling.
