# Telemetry Chart: Remove 30d Range and Use Monthly Buckets for 1y

## Context

The telemetry dashboard's activity chart offers four range filters: `24h`, `7d`, `30d`, and `1y`. The `30d` view is no longer needed, and the `1y` view currently aggregates data into weekly buckets. Because the tick labels are derived from the first week-bucket of each month, the spacing between labels is uneven (4–5 weeks apart), which makes the x-axis look irregular.

## Goals

- Remove the `30d` range option from the UI, API, and supporting code.
- Change the `1y` view to use discrete, evenly spaced monthly buckets.
- Ensure `1y` x-axis ticks are evenly spaced and align with the monthly buckets.

## Non-Goals

- Redesign the chart series, colors, legend, or tooltip.
- Change the `24h` or `7d` bucket intervals.
- Add panning, zooming, or custom date ranges.
- Preserve backward compatibility for `?range=30d` API calls.

## Design

### Remove 30d

Drop `30d` from every layer of the stack:

- Update `TelemetryRange` in `lib/telemetry/types.ts` to `"24h" | "7d" | "1y"`.
- Remove the `30d` button from `components/telemetry/range-selector.tsx`.
- Remove the `30d` case from `getRangeStart` and `getBucketInterval` in `lib/telemetry/ranges.ts`.
- Remove the shared `7d` / `30d` formatting branch in `lib/telemetry/chart-format.ts`; `7d` keeps its current date label and `1y` keeps its month-year label.
- Remove the `30d` case from `getTicksForRange` in `lib/telemetry/chart-ticks.ts`.
- Remove `30d` from `VALID_RANGES` in `app/api/telemetry/route.ts`.
- Update or remove `30d`-specific unit tests.

### Monthly buckets for 1y

Change the `1y` interval from `{ unit: "week", binSize: 1 }` to `{ unit: "month", binSize: 1 }`.

The bucket-generation and aggregation code needs to understand the new `month` unit:

- Extend `RangeConfig.unit` in `lib/telemetry/ranges.ts` to include `"month"`.
- Update `alignToInterval` in `lib/telemetry/aggregation.ts` to truncate dates to the first day of the month when `unit === "month"`.
- Update `addInterval` in `lib/telemetry/aggregation.ts` to advance by `binSize` months when `unit === "month"`.
- Update `buildTimeSeriesPipeline` in `lib/telemetry/aggregation.ts` to pass `unit: "month"` to `$dateTrunc`; no `startOfWeek` option is needed for months.

### Ticks for 1y

With monthly buckets, every bucket already represents the start of a month. `getTicksForRange` will return all buckets for the `1y` range, producing ≈13 evenly spaced month labels. If the chart feels crowded, we can thin to every other month later; the initial implementation keeps every month for clarity.

### Data flow

No data flow changes. The API still returns the same `TelemetryResponse` shape; only the bucket interval for `1y` and the set of valid ranges change.

## Components

### `lib/telemetry/types.ts` (modified)

- `TelemetryRange` drops `"30d"`.

### `components/telemetry/range-selector.tsx` (modified)

- Remove the `{ value: "30d", label: "30d" }` option.

### `lib/telemetry/ranges.ts` (modified)

- Remove `30d` from `getRangeStart` and `getBucketInterval`.
- Add `"month"` to `RangeConfig.unit`.

### `lib/telemetry/aggregation.ts` (modified)

- `alignToInterval`: truncate to first of month for `unit === "month"`.
- `addInterval`: add months for `unit === "month"`.
- `buildTimeSeriesPipeline`: remove the `startOfWeek` branch; rely on `$dateTrunc` with the interval unit directly.

### `lib/telemetry/chart-format.ts` (modified)

- Split the shared `7d` / `30d` branch so `7d` has its own case and `30d` is removed.

### `lib/telemetry/chart-ticks.ts` (modified)

- Remove the `30d` case.
- For `1y`, return all buckets (or optionally every other bucket if spacing requires it).

### `app/api/telemetry/route.ts` (modified)

- `VALID_RANGES` becomes `["24h", "7d", "1y"]`.

### Tests (modified)

- `tests/lib/telemetry/ranges.test.ts`: remove `30d` expectations; add `month` interval expectation for `1y`.
- `tests/lib/telemetry/chart-ticks.test.ts`: remove `30d` test; update `1y` test for monthly buckets.
- `tests/lib/telemetry/chart-format.test.ts`: remove `30d` test.
- `tests/lib/telemetry/aggregation.test.ts`: update `1y` pipeline and bucket-generation tests for monthly alignment.
- `tests/components/telemetry/range-selector.test.tsx`: update to click a remaining range.

## Error Handling

- `?range=30d` API requests will now return a 400 validation error, which is the existing behavior for invalid ranges.
- No new runtime error states are introduced.

## Testing

- `npm test` — existing suite plus updated tests.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Manual verification:
  - Confirm the range selector shows only `24h`, `7d`, and `1y`.
  - Switch to `1y` and confirm x-axis labels are evenly spaced month labels.
  - Confirm `24h` and `7d` behavior is unchanged.

## Out of Scope

- Preserving the `30d` API endpoint or selector option.
- Changing the bucket intervals for `24h` or `7d`.
- New chart interactions or visual redesign beyond the requested changes.
