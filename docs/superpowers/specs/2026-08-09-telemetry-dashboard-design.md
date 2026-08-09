# Telemetry Dashboard Design

## Context

The sibling project `activity-telemetry-client` is a macOS Python client that collects mouse and keyboard activity and flushes it to MongoDB Atlas every 60 seconds. This dashboard replaces the placeholder home page of the current Next.js personal website and visualizes that telemetry.

Atlas document shape (collection `telemetry` in database `activity-telemetry`):

```json
{
  "createdAt": "2026-08-09T12:34:56.789Z",
  "mouse": {
    "leftClicks": 12,
    "rightClicks": 2,
    "movementMeters": 4.5
  },
  "keys": {
    "A": 3,
    "Space": 7,
    "...": "..."
  },
  "apps": {
    "Visual Studio Code": 45.2
  }
}
```

The current website already has `MONGO_URI` and `ACTIVITY_DB_NAME` in its `.env` file.

## Goals

- Display all-time totals for left clicks, right clicks, mouse movement distance (meters), and total key presses.
- Render a physical mouse with hoverable left/right button regions showing the corresponding counts.
- Render an interactive Mac QWERTY keyboard heatmap colored by all-time key press counts.
- Render four line graphs (left clicks, right clicks, key presses, distance) with selectable ranges: last 24 hours, last 7 days, last 30 days, last year.
- Poll for fresh data every 60 seconds.

## Non-Goals

- Real-time push via WebSockets or MongoDB Change Streams.
- Application time visualization (the `apps` field exists in documents but is out of scope for this dashboard).
- Authentication or multi-user support.

## Architecture

We add one API route and replace `app/page.tsx`.

- **`app/api/telemetry/route.ts`** — Next.js API route.
  - Reads `MONGO_URI` and `ACTIVITY_DB_NAME` from environment variables.
  - Accepts a `range` query parameter: `24h`, `7d`, `30d`, `1y`.
  - Computes all-time totals and a time-series bucketed by the selected range.
  - Returns JSON `{ totals, timeSeries, keys }`.

- **`app/page.tsx`** — Client Component dashboard.
  - Fetches from `/api/telemetry?range=<range>` on mount and every 60 seconds.
  - Renders summary cards, the SVG mouse, the SVG keyboard heatmap, and the range selector + chart.

- **New dependencies:** `recharts` for line graphs; `mongodb` driver added explicitly.

## Components

### Summary cards

Four cards across the top of the dashboard:

1. Left clicks — all-time total.
2. Right clicks — all-time total.
3. Mouse distance — all-time total in meters.
4. Total key presses — sum of every key count.

Each card displays the number with a subtle icon and label.

### Mouse visualization

A custom SVG of a generic two-button mouse:

- Left and right button regions are visually distinct and hoverable.
- Hovering/focusing a button region shows a tooltip with the corresponding all-time count.
- The body is styled with theme-aware borders and fills.

### Keyboard heatmap

A custom SVG Mac QWERTY keyboard layout:

- Each key is colored on a linear scale from the theme's neutral background to a warm accent color based on its all-time press count.
- Unused keys remain neutral.
- Hovering a key shows a tooltip with the key name and exact count.
- Layout matches the key labels produced by the Python client's `telemetry/keymap.py`.

### Range selector and chart

- A segmented control for `24h / 7d / 30d / 1y` sits above the chart.
- `recharts` renders four line series on a shared x-axis:
  1. Left clicks
  2. Right clicks
  3. Key presses
  4. Mouse distance
- Each series uses a distinct color from the theme chart palette.
- The y-axis auto-scales per series; a legend toggles series visibility.

### Loading and error states

- Initial load shows skeleton placeholders for cards and spinners for the chart.
- If a poll fails, the existing data stays on screen and a small inline error banner appears with a manual retry button.

## Data Flow

1. **Mount:** `app/page.tsx` fetches `/api/telemetry?range=24h` and stores the response in React state.
2. **Polling:** a `setInterval` refetches the active range every 60 seconds.
3. **Range change:** selecting a new range immediately fetches that range and updates the chart; polling continues for the selected range.
4. **API aggregation:**
   - **Totals:** sum `mouse.leftClicks`, `mouse.rightClicks`, `mouse.movementMeters`, and all values inside `keys` across every document.
   - **Time series:** filter documents where `createdAt >= rangeStart`, bucket by interval, sum each metric per bucket, and zero-fill missing buckets.
   - **Key heatmap:** sum each key label across all documents and return as `{ [label]: count }`.

### Bucket intervals

| Range | Interval | Description |
|---|---|---|
| 24h | 1 hour | 24 buckets aligned to the hour |
| 7d | 6 hours | 28 buckets aligned to 6-hour marks |
| 30d | 1 day | 30 buckets aligned to midnight UTC |
| 1y | 7 days | ~52 buckets aligned to Monday midnight UTC |

## Error Handling

- **Missing/invalid MongoDB URI:** the API route returns HTTP 500 with a generic message; the UI shows an error banner and retries automatically on the next poll.
- **Empty collection:** totals are zero, the chart shows a flat zero line, and the keyboard is neutral-colored.
- **Clock skew / partial buckets:** ranges are computed from the current server time; buckets are aligned to interval boundaries in UTC.
- **Large data sets:** aggregation runs entirely in MongoDB's aggregation pipeline; no in-memory accumulation of raw documents.
- **Client fetch failures:** stale data remains visible and a "last updated" timestamp indicates the last successful fetch.

## Testing

- **API route unit test:** mock the MongoDB client and assert the aggregation returns expected totals and buckets for a small fixture.
- **Component smoke tests:** verify summary cards render fetched totals, mouse buttons show tooltips on hover, and the range selector changes the fetch URL.
- **Type safety:** add shared TypeScript types for `TelemetryTotals`, `TimeSeriesPoint`, and `TelemetryResponse`; run `npm run typecheck`.
- **Manual smoke test:** run `npm run dev`, load the home page, and verify data refreshes after running the Python telemetry client.

## Dependencies

- `recharts` — line chart rendering.
- `mongodb` — explicit dependency for the API route (Next.js may already bring it transitively, but we pin it).

## Out of Scope

- Application time (`apps`) visualization.
- User authentication or per-user data isolation.
- Real-time updates beyond 60-second polling.
- Editing or deleting telemetry documents.
