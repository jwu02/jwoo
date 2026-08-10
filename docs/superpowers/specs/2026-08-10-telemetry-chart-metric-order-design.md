# Telemetry Chart: Metric Display Order and Movement Label

## Context

The telemetry dashboard surfaces four metrics across three places: the summary overview cards (`summary-cards.tsx`), the activity chart legend and lines (`activity-chart.tsx` `SERIES`), and the chart tooltip (derived from recharts payload order). The current order is Left Clicks → Right Clicks → Key Presses → Mouse movement, which does not match the desired order.

## Goals

- Display metrics in the fixed order: **Key Presses, Left Clicks, Right Clicks, Mouse Movement** across:
  - summary overview cards
  - activity chart legend (and chart lines)
  - activity chart tooltip
- The tooltip must keep this same order even after series are hidden/shown via the legend.
- Rename the movement metric from "Mouse Distance" / "Distance (m)" to **Mouse Movement** / **Mouse Movement (m)**.

## Non-Goals

- Change data keys, aggregation, API, or range behavior.
- Change series colors or icons.
- Persist hidden-series state.
- Extract a shared metric-order module (the two surfaces have different shapes — see Approach B rationale below).

## Design

### Canonical order

A single desired order drives all three surfaces:

1. **Key Presses**
2. **Left Clicks**
3. **Right Clicks**
4. **Mouse Movement**

### `components/telemetry/activity-chart.tsx` (modified)

Reorder the `SERIES` array and rename the movement label:

- `{ dataKey: "keyPresses", name: "Key Presses", color: "--chart-3" }`
- `{ dataKey: "leftClicks", name: "Left Clicks", color: "--chart-1" }`
- `{ dataKey: "rightClicks", name: "Right Clicks", color: "--chart-2" }`
- `{ dataKey: "movementMeters", name: "Mouse Movement (m)", color: "--chart-4" }`

This single array drives all three chart surfaces at once:

- **Legend** — rendered by `SERIES.map(...)`, so order follows the array.
- **Chart lines** — `visibleSeries` is `SERIES.filter(...)` (preserves array order), so line render order (and therefore the recharts tooltip payload order) follows the array.
- **Tooltip** — recharts builds the payload in the order the `Line` components are rendered. Hiding/showing a series only removes/re-adds a `Line`; it never reorders the remaining ones, so the tooltip stays in the canonical order after toggling.

### `components/telemetry/summary-cards.tsx` (modified)

Reorder the `items` array and rename the movement label:

1. Key Presses — `Keyboard` icon, no unit
2. Left Clicks — `MousePointerClick` icon, no unit
3. Right Clicks — `MousePointer` icon, no unit
4. Mouse Movement — `Ruler` icon, unit `m`

### Why not a shared order constant (Approach B, rejected)

The card item shape (`label`/`value`/`icon`/`unit`) and the chart series shape (`dataKey`/`name`/`color`) are different. With only two consumers and a fixed order, a shared module adds coupling without a real win. In-place reorder keeps the diff minimal and matches the existing file structure.

## Components

- `components/telemetry/activity-chart.tsx` — reorder `SERIES`, rename movement series name.
- `components/telemetry/summary-cards.tsx` — reorder `items`, rename movement label.

## Error Handling

No new runtime error states. This is a purely presentational reorder; data shape and values are unchanged.

## Testing

- Update `tests/components/telemetry/activity-chart.test.tsx`:
  - Legend items render in the canonical order (Key Presses first, Mouse Movement (m) last).
  - Add a tooltip-order assertion: the recharts tooltip payload for the visible series appears in canonical order, including after hiding a middle series (e.g. hide Left Clicks → tooltip shows Key Presses, Right Clicks, Mouse Movement (m)).
- Update `tests/components/telemetry/summary-cards.test.tsx` to assert card order via DOM order, and assert the "Mouse Movement" label renders.
- `npm test`
- `npm run typecheck`
- `npm run lint`
- Manual verification:
  - Cards show Key Presses, Left Clicks, Right Clicks, Mouse Movement in that order.
  - Legend shows Key Presses, Left Clicks, Right Clicks, Mouse Movement (m) in that order.
  - Hovering the chart shows the tooltip in the same order; hiding/showing series keeps the relative tooltip order.

## Out of Scope

- Persistence of hidden series.
- Changes to data keys, aggregation, API, or range selection.
- Series colors and icons.
- A shared metric-order module.
