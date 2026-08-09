# Telemetry Chart Ticks and Grid Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add range-specific x-axis tick labels and restrict vertical grid lines to those ticks on the telemetry activity chart.

**Architecture:** A new pure helper in `lib/telemetry/chart-ticks.ts` selects which bucket ISO strings deserve a label for each range. `components/telemetry/activity-chart.tsx` passes that subset to `<XAxis ticks={...}>` and updates its formatter to produce the agreed labels. Because `recharts` draws `CartesianGrid` vertical lines at the x-axis ticks, grid lines automatically align with labels.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `recharts`, Jest.

## Global Constraints

- Time-range options are `24h`, `7d`, `30d`, `1y`.
- The four chart series are Left Clicks, Right Clicks, Key Presses, and Distance (m).
- Existing data bucket intervals must stay unchanged: `24h` = hourly, `7d` = 6-hourly, `30d` = daily, `1y` = weekly.
- Chart colors must continue to come from the existing `--chart-1`..`--chart-4` CSS variables.
- TypeScript strict mode is enabled via `tsconfig.json`.
- All dates are bucketed in UTC; tick labels should format in UTC.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/telemetry/chart-ticks.ts` | New pure helper `getTicksForRange` that selects labeled buckets. |
| `tests/lib/telemetry/chart-ticks.test.ts` | Unit tests for `getTicksForRange`. |
| `components/telemetry/activity-chart.tsx` | Consumes `getTicksForRange`, passes `ticks` to `XAxis`, formats labels. |

---

## Task 1: Implement `getTicksForRange`

**Files:**
- Create: `lib/telemetry/chart-ticks.ts`
- Create: `tests/lib/telemetry/chart-ticks.test.ts`

**Interfaces:**
- Consumes: `TelemetryRange` from `@/lib/telemetry/types`.
- Produces: `getTicksForRange(buckets: string[], range: TelemetryRange): string[]`.

- [ ] **Step 1: Create the helper file**

Create `lib/telemetry/chart-ticks.ts`:

```ts
import { TelemetryRange } from "./types";

export function getTicksForRange(
  buckets: string[],
  range: TelemetryRange
): string[] {
  if (buckets.length === 0) return [];

  switch (range) {
    case "24h": {
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() % 3 === 0;
      });
    }
    case "7d":
    case "30d": {
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() === 0;
      });
    }
    case "1y": {
      const seenMonths = new Set<string>();
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
        if (seenMonths.has(monthKey)) return false;
        seenMonths.add(monthKey);
        return true;
      });
    }
  }
}
```

- [ ] **Step 2: Write the tests**

Create `tests/lib/telemetry/chart-ticks.test.ts`:

```ts
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";

describe("getTicksForRange", () => {
  it("returns every third hour for 24h", () => {
    const buckets = Array.from({ length: 24 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 9, i)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "24h");

    expect(ticks).toEqual([
      buckets[0],
      buckets[3],
      buckets[6],
      buckets[9],
      buckets[12],
      buckets[15],
      buckets[18],
      buckets[21],
    ]);
  });

  it("returns only midnight buckets for 7d", () => {
    const buckets = Array.from({ length: 28 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 2, i * 6)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "7d");

    expect(ticks.length).toBe(7);
    ticks.forEach((tick) => {
      expect(new Date(tick).getUTCHours()).toBe(0);
    });
  });

  it("returns every daily bucket for 30d", () => {
    const buckets = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 1, 0, 0, 0, 0) + i * 86400000).toISOString()
    );

    const ticks = getTicksForRange(buckets, "30d");

    expect(ticks).toEqual(buckets);
  });

  it("returns the first bucket of each month for 1y", () => {
    const buckets = [
      "2025-08-04T00:00:00.000Z", // Monday
      "2025-08-11T00:00:00.000Z",
      "2025-08-18T00:00:00.000Z",
      "2025-08-25T00:00:00.000Z",
      "2025-09-01T00:00:00.000Z",
      "2025-09-08T00:00:00.000Z",
    ];

    const ticks = getTicksForRange(buckets, "1y");

    expect(ticks).toEqual([buckets[0], buckets[4]]);
  });

  it("returns an empty array when no buckets are provided", () => {
    expect(getTicksForRange([], "24h")).toEqual([]);
    expect(getTicksForRange([], "7d")).toEqual([]);
    expect(getTicksForRange([], "30d")).toEqual([]);
    expect(getTicksForRange([], "1y")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify the helper works**

Run:

```bash
npm test -- tests/lib/telemetry/chart-ticks.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/telemetry/chart-ticks.ts tests/lib/telemetry/chart-ticks.test.ts
git commit -m "feat(telemetry): add getTicksForRange helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Wire Ticks and Formatters into the Activity Chart

**Files:**
- Modify: `components/telemetry/activity-chart.tsx`

**Interfaces:**
- Consumes: `getTicksForRange(buckets: string[], range: TelemetryRange): string[]` from `lib/telemetry/chart-ticks.ts`.
- Produces: No new exports; the chart now renders with custom ticks and updated labels.

- [ ] **Step 1: Replace the formatter and add tick computation**

Edit `components/telemetry/activity-chart.tsx`:

1. Add the import at the top:

```ts
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
```

2. Remove the existing `RANGE_FORMATS` constant.

3. Inside the `ActivityChart` component, compute ticks before the return statement:

```ts
const ticks = getTicksForRange(
  data.map((point) => point.bucket),
  range
);
```

4. Replace the existing `formatTick` function with:

```ts
function formatTick(value: string): string {
  const date = new Date(value);

  switch (range) {
    case "24h": {
      const hour = date.getUTCHours();
      const suffix = hour >= 12 ? "pm" : "am";
      const displayHour = hour % 12 || 12;
      return `${displayHour}${suffix}`;
    }
    case "7d":
    case "30d":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    case "1y":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
  }
}
```

5. Add the `ticks` prop to the existing `<XAxis>`:

```tsx
<XAxis
  dataKey="bucket"
  ticks={ticks}
  tickFormatter={formatTick}
  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
  stroke="var(--muted-foreground)"
/>
```

The full component should now look like:

```tsx
"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";

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
  const ticks = useMemo(
    () => getTicksForRange(data.map((point) => point.bucket), range),
    [data, range]
  );

  function formatTick(value: string): string {
    const date = new Date(value);

    switch (range) {
      case "24h": {
        const hour = date.getUTCHours();
        const suffix = hour >= 12 ? "pm" : "am";
        const displayHour = hour % 12 || 12;
        return `${displayHour}${suffix}`;
      }
      case "7d":
      case "30d":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
      case "1y":
        return date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
    }
  }

  return (
    <div className="h-80 w-full rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket"
            ticks={ticks}
            tickFormatter={formatTick}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              borderColor: "var(--border)",
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(label: unknown) =>
              new Date(String(label)).toLocaleString()
            }
          />
          <Legend wrapperStyle={{ color: "var(--foreground)" }} />
          {SERIES.map((series) => (
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
  );
}
```

- [ ] **Step 2: Run the existing test suite**

Run:

```bash
npm test
```

Expected: PASS. Existing tests should not break; no tests assert specific tick labels.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/telemetry/activity-chart.tsx
git commit -m "feat(telemetry): use custom x-axis ticks and labels per range

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Final Verification

**Files:**
- Verify: `components/telemetry/activity-chart.tsx`
- Verify: `lib/telemetry/chart-ticks.ts`

**Interfaces:**
- Consumes: Changes from Task 1 and Task 2.
- Produces: A working chart with range-specific x-axis labels and grid lines aligned to those labels.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: Build succeeds with no TypeScript or rendering errors.

- [ ] **Step 3: Manual visual check**

Start the dev server:

```bash
npm run dev
```

Then open the dashboard and confirm for each range:

1. **24h:** labels read `12am`, `3am`, `6am`, `9am`, `12pm`, `3pm`, `6pm`, `9pm` and vertical grid lines appear at each label.
2. **7d:** labels read like `Aug 5` at midnight each day; vertical grid lines match.
3. **30d:** labels read like `Aug 5` at midnight each day; vertical grid lines match.
4. **1y:** labels read like `Aug 2025` at the first bucket of each month; vertical grid lines match.
5. No vertical grid lines appear at unlabeled buckets.

- [ ] **Step 4: Commit any required fixes**

If lint or build required fixes, commit them with an appropriate message. If no fixes were required, this step is a no-op.

---

## Self-Review

**Spec coverage:**
- `24h` every 3 hours → Task 2 `formatTick` and Task 1 helper.
- `7d` / `30d` daily at 12am → Task 1 helper and Task 2 formatter.
- `1y` monthly ticks → Task 1 helper and Task 2 formatter.
- Grid lines follow x-axis ticks → Task 2 passes `ticks` to `XAxis`; `CartesianGrid` uses them automatically.
- Keep existing bucket intervals → no changes to `lib/telemetry/ranges.ts` or `lib/telemetry/aggregation.ts`.

**Placeholder scan:**
- No "TBD", "TODO", or vague steps.
- Every code block contains the exact change.
- No references to undefined functions or types.

**Type consistency:**
- `getTicksForRange` signature is consistent across Task 1 and Task 2.
- `TelemetryRange` imported from the same `@/lib/telemetry/types` path used elsewhere.
- `formatTick` covers all `TelemetryRange` cases exhaustively.
