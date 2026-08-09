# Telemetry Chart: Range Selector Placement and Distinct Colors

## Context

The telemetry dashboard renders an activity chart with four line series (left clicks, right clicks, key presses, mouse distance). Currently the time-range selector lives in the page header, and the four chart series are styled with the theme's `--chart-1`..`--chart-4` variables, which are all grayscale and hard to tell apart.

## Goals

- Move the range selector so it sits directly above the activity chart, close to the data it controls.
- Make each telemetry plot line visually distinct using a colorblind-safe palette.

## Non-Goals

- Redesign the range selector itself (keep the existing segmented control).
- Add new chart interactions such as toggling series or custom date ranges.
- Change the chart library or data shape.

## Design

### Layout

In `app/page.tsx`:

1. Remove `<RangeSelector value={range} onChange={setRange} />` from the page header.
2. The header continues to show the title and the "Last updated" timestamp.
3. Inside the "Activity Over Time" section, render the range selector on the same horizontal row as the section heading. On small screens the selector drops below the heading.

### Color palette

Keep the existing `--chart-1`..`--chart-4` CSS variables so `components/telemetry/activity-chart.tsx` does not need to change its color wiring. Reassign those variables to a four-color subset of the Okabe-Ito colorblind-safe palette in both `:root` and `.dark`:

| Variable | Color | Mapped series |
|---|---|---|
| `--chart-1` | `#0072B2` (blue) | Left Clicks |
| `--chart-2` | `#D55E00` (vermillion) | Right Clicks |
| `--chart-3` | `#009E73` (green) | Key Presses |
| `--chart-4` | `#E69F00` (orange) | Distance (m) |

The Okabe-Ito colors are chosen because they remain distinguishable for viewers with the most common forms of color blindness and work on both light and dark backgrounds.

## Components

### `app/page.tsx`

- Remove the range selector from the header flex row.
- Add a new flex row inside the "Activity Over Time" section containing the heading and the range selector.

### `app/globals.css`

- Update `--chart-1` through `--chart-4` in `:root`.
- Update `--chart-1` through `--chart-4` in `.dark` with the same values.

### `components/telemetry/activity-chart.tsx`

- No changes required; the existing `SERIES` array already maps each series to `--chart-1`..`--chart-4` in the desired order.

## Data Flow

No data flow changes. The `range` state, `setRange` callback, fetch logic, and polling interval remain unchanged.

## Error Handling

No new error states are introduced.

## Testing

- Update any snapshots or tests that assert the old header DOM order or the old grayscale CSS values.
- Run `npm run test` and `npm run typecheck`.
- Run `npm run build` to confirm no layout/type regressions.
- Manual check: verify the four chart lines are clearly different colors in both light and dark mode.

## Out of Scope

- Changing the range selector component itself.
- Adding per-series toggles or tooltips beyond what `recharts` already provides.
- Introducing a separate palette for dark mode.
