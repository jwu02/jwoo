# Telemetry Chart: Square Legend Symbols and Normal Text Colors

## Context

The telemetry dashboard's activity chart uses Recharts with a default legend and a styled tooltip. The legend currently shows the default line-shaped icons and the tooltip text uses the popover foreground color, which can look slightly off against the chart's surrounding text.

## Goals

- Change the legend symbol from the default line to a square filled with each series' color.
- Ensure legend labels use the normal text color (`--foreground`).
- Ensure tooltip label and item values use the normal text color (`--foreground`).

## Non-Goals

- Change the chart data, axes, grid, or line styling.
- Add custom legend interactivity such as toggling series.
- Redesign the tooltip layout or add extra tooltip content.

## Design

### Legend

In `components/telemetry/activity-chart.tsx`, update the existing `<Legend>` component:

- Add `iconType="square"` so Recharts renders a square marker for each series.
- Keep `wrapperStyle={{ color: "var(--foreground)" }}` so legend labels already use the normal text color.

### Tooltip

Update the existing `<Tooltip>` component:

- Add `labelStyle={{ color: "var(--foreground)" }}` for the time/date header.
- Add `itemStyle={{ color: "var(--foreground)" }}` for each series row.
- Keep the existing `contentStyle` background/border theming unchanged.

## Components

### `components/telemetry/activity-chart.tsx`

- `<Legend>`: add `iconType="square"`.
- `<Tooltip>`: add `labelStyle` and `itemStyle` with `color: "var(--foreground)"`.

No other components change.

## Data Flow

No data flow changes. The chart continues to receive the same `TimeSeriesPoint[]` data and `TelemetryRange`.

## Error Handling

No new error states are introduced.

## Testing

- Run `npm run typecheck` to confirm the updated prop types are valid.
- Run `npm run test` to confirm no existing tests regress.
- Manual check: verify each legend entry shows a colored square next to its label, and the tooltip text matches the surrounding body text color in both light and dark mode.

## Out of Scope

- Custom legend or tooltip renderers.
- Changes to the color palette or series names.
- Responsive or accessibility behavior beyond what Recharts provides by default.
