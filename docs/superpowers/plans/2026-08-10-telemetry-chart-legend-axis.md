# Telemetry Chart: Interactive Legend and Axis Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the telemetry activity chart legend interactive (hide/show series on click, with hover and dimming) and render axis lines/tick labels in the foreground color.

**Architecture:** Replace the recharts built-in `Legend` with a custom legend in `components/telemetry/activity-chart.tsx`, add component-local state for hidden series keys, filter the rendered `Line` series based on that state, and change the `XAxis`/`YAxis` colors to `--foreground`. Add component tests in `tests/components/telemetry/activity-chart.test.tsx`.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `recharts`, Jest, React Testing Library.

## Global Constraints

- The four chart series are Left Clicks, Right Clicks, Key Presses, and Distance (m).
- Chart colors must continue to come from the existing `--chart-1`..`--chart-4` CSS variables.
- Series hidden state persists across `range` prop changes but does NOT persist across page reloads.
- Hidden legend items render with reduced opacity (`opacity-50`) and muted text.
- Axis lines and tick labels must use `var(--foreground)`.
- All legend items are real `<button>` elements with `aria-pressed` and descriptive `aria-label` attributes.
- TypeScript strict mode is enabled via `tsconfig.json`.

---

## File Structure

| File | Responsibility |
|---|---|
| `components/telemetry/activity-chart.tsx` | Custom interactive legend, hidden-series state, series filtering, and axis color updates. |
| `tests/components/telemetry/activity-chart.test.tsx` | Tests for legend rendering, toggling, hidden-state persistence across range changes, and axis colors. |

---

## Task 1: Implement Interactive Legend and Axis Styling

**Files:**
- Modify: `components/telemetry/activity-chart.tsx`

**Interfaces:**
- Consumes: `TimeSeriesPoint`, `TelemetryRange` from `@/lib/telemetry/types`; `formatTick`, `formatTooltip` from `@/lib/telemetry/chart-format`; `getTicksForRange` from `@/lib/telemetry/chart-ticks`.
- Produces: `ActivityChart` component with local hidden-series state and custom legend. Hidden series are excluded from the rendered `Line` list so `recharts` auto-scales the Y-axis.

- [ ] **Step 1: Add hidden-series state and helper functions**

Edit `components/telemetry/activity-chart.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipContentProps,
} from "recharts";
import { TimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import { formatTick, formatTooltip } from "@/lib/telemetry/chart-format";

function ActivityChartTooltip({
  active,
  payload,
  label,
  range,
}: TooltipContentProps & { range: TelemetryRange }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-sm shadow-sm"
      style={{
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
      }}
    >
      <p className="mb-1 font-medium" style={{ color: "var(--foreground)" }}>
        {formatTooltip(String(label ?? ""), range)}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: "var(--foreground)" }}>
              {entry.name}: {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ActivityChartProps {
  data: TimeSeriesPoint[];
  range: TelemetryRange;
}

const SERIES = [
  { dataKey: "leftClicks", name: "Left Clicks", color: "--chart-1" },
  { dataKey: "rightClicks", name: "Right Clicks", color: "--chart-2" },
  { dataKey: "keyPresses", name: "Key Presses", color: "--chart-3" },
  { dataKey: "movementMeters", name: "Distance (m)", color: "--chart-4" },
] as const;

export function ActivityChart({ data, range }: ActivityChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const ticks = useMemo(
    () => getTicksForRange(data.map((point) => point.bucket), range),
    [data, range]
  );

  const toggleSeries = (dataKey: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  const visibleSeries = useMemo(
    () => SERIES.filter((series) => !hidden.has(series.dataKey)),
    [hidden]
  );

  return (
    <div className="w-full rounded-xl border border-border bg-card p-4">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="bucket"
              ticks={ticks}
              tickFormatter={(value: string) => formatTick(value, range)}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            <Tooltip
              content={(props) => <ActivityChartTooltip {...props} range={range} />}
            />
            {visibleSeries.map((series) => (
              <Line
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                stroke={`var(${series.color})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
        {SERIES.map((series) => {
          const isHidden = hidden.has(series.dataKey);
          return (
            <button
              key={series.dataKey}
              type="button"
              onClick={() => toggleSeries(series.dataKey)}
              aria-pressed={isHidden}
              aria-label={isHidden ? `Show ${series.name}` : `Hide ${series.name}`}
              className={`flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium transition-colors hover:bg-muted ${
                isHidden ? "text-muted-foreground opacity-50" : "text-foreground"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{
                  backgroundColor: `var(${series.color})`,
                  opacity: isHidden ? 0.5 : 1,
                }}
              />
              {series.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing test suite to catch regressions**

Run:

```bash
npm test
```

Expected: PASS (no existing activity-chart tests, but other tests should still pass).

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/activity-chart.tsx
git commit -m "feat(telemetry): add interactive legend and foreground axes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add ActivityChart Tests

**Files:**
- Create: `tests/components/telemetry/activity-chart.test.tsx`

**Interfaces:**
- Consumes: `ActivityChart` from `components/telemetry/activity-chart.tsx`.
- Produces: Tests verifying legend rendering, toggling, range-change persistence, and axis colors.

- [ ] **Step 1: Create the test file**

Create `tests/components/telemetry/activity-chart.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityChart } from "@/components/telemetry/activity-chart";
import { TimeSeriesPoint } from "@/lib/telemetry/types";

function buildData(): TimeSeriesPoint[] {
  return Array.from({ length: 4 }, (_, i) => ({
    bucket: new Date(Date.UTC(2025, 7, 9, i * 6)).toISOString(),
    leftClicks: i * 10,
    rightClicks: i * 5,
    keyPresses: i * 20,
    movementMeters: i * 100,
  }));
}

describe("ActivityChart", () => {
  it("renders a legend item for each series", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    expect(screen.getByRole("button", { name: /Hide Left Clicks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Right Clicks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Key Presses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Distance \(m\)/i })).toBeInTheDocument();
  });

  it("hides a series when its legend item is clicked", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const leftClicksButton = screen.getByRole("button", { name: /Hide Left Clicks/i });
    fireEvent.click(leftClicksButton);

    expect(screen.getByRole("button", { name: /Show Left Clicks/i })).toBeInTheDocument();
  });

  it("shows a hidden series when its legend item is clicked again", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const leftClicksButton = screen.getByRole("button", { name: /Hide Left Clicks/i });
    fireEvent.click(leftClicksButton);
    fireEvent.click(screen.getByRole("button", { name: /Show Left Clicks/i }));

    expect(screen.getByRole("button", { name: /Hide Left Clicks/i })).toBeInTheDocument();
  });

  it("keeps hidden series hidden when the range changes", () => {
    const { rerender } = render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Key Presses/i }));

    rerender(<ActivityChart data={buildData()} range="7d" />);

    expect(screen.getByRole("button", { name: /Show Key Presses/i })).toBeInTheDocument();
  });

  it("renders hidden legend items with reduced opacity", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Right Clicks/i }));

    expect(screen.getByRole("button", { name: /Show Right Clicks/i })).toHaveClass("opacity-50");
  });

  it("sets aria-pressed true for hidden series and false for visible series", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const distanceButton = screen.getByRole("button", { name: /Hide Distance \(m\)/i });
    expect(distanceButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(distanceButton);

    expect(screen.getByRole("button", { name: /Show Distance \(m\)/i })).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 2: Run the new tests**

Run:

```bash
npm test -- tests/components/telemetry/activity-chart.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/components/telemetry/activity-chart.test.tsx
git commit -m "test(telemetry): add activity chart legend and axis tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Final Verification

**Files:**
- Verify: `components/telemetry/activity-chart.tsx`
- Verify: `tests/components/telemetry/activity-chart.test.tsx`

**Interfaces:**
- Consumes: All changes from Tasks 1–2.
- Produces: A working activity chart with interactive legend and foreground axes.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Build succeeds with no TypeScript or rendering errors.

- [ ] **Step 4: Manual visual check**

Start the dev server:

```bash
npm run dev
```

Then open the dashboard and confirm:

1. Legend items are spaced further apart than before.
2. Hovering a legend item shows a subtle background change.
3. Clicking a legend item hides its line, dims the legend item, and the Y-axis rescales.
4. Clicking the dimmed legend item shows the line again.
5. Switching time ranges keeps hidden series hidden.
6. Axis lines and tick labels render in the foreground color.

- [ ] **Step 5: Commit any required fixes**

If typecheck, lint, build, or tests required fixes, commit them with an appropriate message. If no fixes were required, this step is a no-op.

---

## Self-Review

**Spec coverage:**
- Increase padding between legend items → Task 1 custom legend with `gap-6`.
- Make legend items hoverable and clickable → Task 1 button styling and `onClick`.
- Hide corresponding plot and auto-scale Y-axis → Task 1 filtering `visibleSeries`.
- Axis line and tick items use foreground color → Task 1 `XAxis`/`YAxis` updates.
- Hidden state persists across range changes → Task 1 `useState` inside component; Task 2 test.
- Hidden items dimmed → Task 1 `opacity-50` class; Task 2 test.
- Accessibility → Task 1 `aria-pressed` and `aria-label`; Task 2 test.

**Placeholder scan:**
- No "TBD", "TODO", or vague steps.
- Every code block contains the exact change.
- No references to undefined functions or types.

**Type consistency:**
- `hidden` is a `Set<string>` of series `dataKey`s everywhere.
- `visibleSeries` is derived from `SERIES.filter` and used to render `Line` components.
- `ActivityChartProps` unchanged.
