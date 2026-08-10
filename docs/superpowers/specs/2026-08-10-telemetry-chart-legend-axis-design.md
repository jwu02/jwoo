# Telemetry Chart: Interactive Legend and Axis Styling

## Context

The activity telemetry chart renders four series (Left Clicks, Right Clicks, Key Presses, Distance) using `recharts`. The current built-in legend has tight spacing, is not interactive, and the axes render in `--muted-foreground`, which makes them less prominent than desired.

## Goals

- Increase padding between legend items.
- Make each legend item hoverable and clickable to hide/show its corresponding plot.
- Auto-scale the chart Y-axis when series are hidden so the remaining plots use the available height.
- Render axis lines and tick labels in the foreground color.

## Non-Goals

- Add a global "show all / hide all" control.
- Persist hidden series across page reloads or sessions.
- Change series colors, tooltips, data shape, or range behavior.
- Modify aggregation, API, or range selection.

## Design

### State

`ActivityChart` will own a `Set<string>` (or boolean map) of hidden series `dataKey`s, initialized empty. This state persists across `range` prop changes because it is local to the component.

### Custom legend

The recharts `<Legend />` will be replaced by a custom legend rendered below the chart:

- A horizontal flex row of buttons, one per series.
- Each button displays a color square and series name.
- Items have increased horizontal spacing (e.g., `gap-6` or explicit `px-3`).
- Hover state provides subtle visual feedback (background/border).
- Clicking a button toggles its series in the hidden set.
- Visible items render with foreground text and full opacity.
- Hidden items render with reduced opacity (e.g., `opacity-50`) and/or muted text.

### Series rendering

When rendering `<Line>` components, filter `SERIES` to exclude entries whose `dataKey` is in the hidden set. Because the hidden lines are not rendered, `recharts` automatically rescales the Y-axis to fit only the remaining visible series.

### Axes

Update `XAxis` and `YAxis` so both the axis line and tick labels use `var(--foreground)` instead of `var(--muted-foreground)`.

### Accessibility

Legend items are real `<button>` elements with:

- `aria-pressed` reflecting the visible/hidden state.
- Descriptive `aria-label` such as "Hide Left Clicks" or "Show Left Clicks".

## Components

### `components/telemetry/activity-chart.tsx` (modified)

- Add `useState<Set<string>>` for hidden series keys.
- Replace `<Legend />` with custom legend buttons.
- Filter `SERIES` before mapping to `<Line>` components.
- Change `XAxis` and `YAxis` `stroke` and `tick.fill` to `var(--foreground)`.

## Error Handling

No new runtime error states. Hidden-series state is local UI state only.

## Testing

- `npm test` — run the existing test suite.
- `npm run typecheck`
- `npm run lint`
- Manual verification:
  - Clicking a legend item hides its line and dims the legend item.
  - The Y-axis rescales to the visible series.
  - Switching ranges keeps hidden series hidden.
  - Axis lines and tick labels render in the foreground color.

## Out of Scope

- Persistence of hidden series across page reloads.
- Global legend controls.
- Changes to data aggregation, range selection, or tooltip behavior.
