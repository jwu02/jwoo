# Telemetry Chart Local Timezone and 24-Hour Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the telemetry activity chart's time labels to the browser's local timezone, use 24-hour time on the 24h range, and display a timezone badge in the chart card corner.

**Architecture:** A new `lib/telemetry/chart-format.ts` provides pure formatting helpers (`formatTick`, `formatTooltip`, `getTimezoneLabel`) that use the browser's local timezone. `components/telemetry/activity-chart.tsx` replaces its inline formatter and the old UTC tooltip helper with these helpers and renders the timezone badge. The now-unused `formatTooltipLabel` is removed from `lib/telemetry/chart-ticks.ts`.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `recharts`, Jest.

## Global Constraints

- Time-range options are `24h`, `7d`, `30d`, `1y`.
- Existing data bucket intervals must stay unchanged: `24h` = hourly, `7d` = 6-hourly, `30d` = daily, `1y` = weekly.
- Chart colors must continue to come from `--chart-1`..`--chart-4`.
- TypeScript strict mode is enabled via `tsconfig.json`.
- Bucket strings remain UTC; only display formatting changes to local time.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/telemetry/chart-format.ts` | New pure helpers for local-time x-axis labels, tooltip labels, and timezone badge text. |
| `tests/lib/telemetry/chart-format.test.ts` | Unit tests for `chart-format.ts` helpers. |
| `components/telemetry/activity-chart.tsx` | Uses new helpers, renders timezone badge in chart card corner. |
| `lib/telemetry/chart-ticks.ts` | Removes the now-unused `formatTooltipLabel` helper. |

---

## Task 1: Create `lib/telemetry/chart-format.ts` with Tests

**Files:**
- Create: `lib/telemetry/chart-format.ts`
- Create: `tests/lib/telemetry/chart-format.test.ts`

**Interfaces:**
- Consumes: `TelemetryRange` from `@/lib/telemetry/types`.
- Produces:
  - `formatTick(bucket: string, range: TelemetryRange): string`
  - `formatTooltip(bucket: string, range: TelemetryRange): string`
  - `getTimezoneLabel(): string`

- [ ] **Step 1: Create the helper file**

Create `lib/telemetry/chart-format.ts`:

```ts
import { TelemetryRange } from "./types";

export function formatTick(bucket: string, range: TelemetryRange): string {
  const date = new Date(bucket);

  switch (range) {
    case "24h":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "7d":
    case "30d":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    case "1y":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
  }
}

export function formatTooltip(bucket: string, range: TelemetryRange): string {
  const date = new Date(bucket);

  switch (range) {
    case "24h":
      return date.toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short",
        hour12: false,
      });
    case "7d":
    case "30d":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "1y":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
  }
}

export function getTimezoneLabel(): string {
  const date = new Date();
  const timeZoneName = date
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop();
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
  return `${timeZoneName} UTC${sign}${hours}:${minutes}`;
}
```

- [ ] **Step 2: Write the tests**

Create `tests/lib/telemetry/chart-format.test.ts`:

```ts
process.env.TZ = "Asia/Shanghai";

import { formatTick, formatTooltip, getTimezoneLabel } from "@/lib/telemetry/chart-format";

describe("formatTick", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h range as 24-hour time", () => {
    expect(formatTick(bucket, "24h")).toBe("11:00");
  });

  it("formats 7d range as month and day", () => {
    expect(formatTick(bucket, "7d")).toBe("Aug 9");
  });

  it("formats 30d range as month and day", () => {
    expect(formatTick(bucket, "30d")).toBe("Aug 9");
  });

  it("formats 1y range as month and year", () => {
    expect(formatTick(bucket, "1y")).toBe("Aug 2025");
  });
});

describe("formatTooltip", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h tooltip as short date and 24-hour time", () => {
    expect(formatTooltip(bucket, "24h")).toBe("8/9/2025, 11:00");
  });

  it("formats 7d tooltip as month, day, and year", () => {
    expect(formatTooltip(bucket, "7d")).toBe("Aug 9, 2025");
  });

  it("formats 30d tooltip as month, day, and year", () => {
    expect(formatTooltip(bucket, "30d")).toBe("Aug 9, 2025");
  });

  it("formats 1y tooltip as month and year", () => {
    expect(formatTooltip(bucket, "1y")).toBe("Aug 2025");
  });
});

describe("getTimezoneLabel", () => {
  it("returns the timezone name and UTC offset", () => {
    const label = getTimezoneLabel();
    expect(label).toMatch(/UTC[+-]\d{2}:\d{2}$/);
  });
});
```

- [ ] **Step 3: Run the tests to verify the helper works**

Run:

```bash
npm test -- tests/lib/telemetry/chart-format.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/telemetry/chart-format.ts tests/lib/telemetry/chart-format.test.ts
git commit -m "feat(telemetry): add local-time chart formatting helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Wire Helpers and Add Timezone Badge to the Activity Chart

**Files:**
- Modify: `components/telemetry/activity-chart.tsx`

**Interfaces:**
- Consumes:
  - `formatTick(bucket: string, range: TelemetryRange): string`
  - `formatTooltip(bucket: string, range: TelemetryRange): string`
  - `getTimezoneLabel(): string`
  from `@/lib/telemetry/chart-format`.
- Produces: No new exports; the chart now renders local-time labels and a timezone badge.

- [ ] **Step 1: Update imports and remove old formatter**

Edit `components/telemetry/activity-chart.tsx`:

1. Replace the imports:

```ts
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import {
  formatTick,
  formatTooltip,
  getTimezoneLabel,
} from "@/lib/telemetry/chart-format";
```

2. Remove the existing inline `formatTick` function entirely.

3. Replace the `Tooltip` block with:

```tsx
<Tooltip
  contentStyle={{
    backgroundColor: "var(--popover)",
    borderColor: "var(--border)",
    color: "var(--popover-foreground)",
  }}
  labelFormatter={(label: unknown) => formatTooltip(String(label), range)}
/>
```

4. Update the `XAxis` to use `formatTick`:

```tsx
<XAxis
  dataKey="bucket"
  ticks={ticks}
  tickFormatter={(value: string) => formatTick(value, range)}
  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
  stroke="var(--muted-foreground)"
/>
```

5. Add a timezone badge in the chart card corner. Wrap the existing inner content so the badge can be positioned absolutely:

```tsx
<div className="relative h-80 w-full rounded-xl border border-border bg-card p-4">
  <div className="absolute right-4 top-3 text-xs text-muted-foreground">
    {getTimezoneLabel()}
  </div>
  <ResponsiveContainer width="100%" height="100%">
    {/* existing LineChart */}
  </ResponsiveContainer>
</div>
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
import {
  formatTick,
  formatTooltip,
  getTimezoneLabel,
} from "@/lib/telemetry/chart-format";

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

  return (
    <div className="relative h-80 w-full rounded-xl border border-border bg-card p-4">
      <div className="absolute right-4 top-3 text-xs text-muted-foreground">
        {getTimezoneLabel()}
      </div>
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
            labelFormatter={(label: unknown) => formatTooltip(String(label), range)}
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

- [ ] **Step 2: Run the existing test suite and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/activity-chart.tsx
git commit -m "feat(telemetry): render local-time labels and timezone badge

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Remove Unused UTC Tooltip Helper

**Files:**
- Modify: `lib/telemetry/chart-ticks.ts`
- Modify: `tests/lib/telemetry/chart-ticks.test.ts`

**Interfaces:**
- Consumes: Nothing from this task.
- Produces: `lib/telemetry/chart-ticks.ts` no longer exports `formatTooltipLabel`.

- [ ] **Step 1: Remove `formatTooltipLabel` from `lib/telemetry/chart-ticks.ts`**

Delete the `formatTooltipLabel` function and its export.

- [ ] **Step 2: Remove related tests**

Delete the `describe("formatTooltipLabel", ...)` block from `tests/lib/telemetry/chart-ticks.test.ts`.

- [ ] **Step 3: Run tests**

Run:

```bash
npm test -- tests/lib/telemetry/chart-ticks.test.ts
```

Expected: PASS (5 tests for `getTicksForRange`).

- [ ] **Step 4: Commit**

```bash
git add lib/telemetry/chart-ticks.ts tests/lib/telemetry/chart-ticks.test.ts
git commit -m "chore(telemetry): remove unused UTC tooltip formatter

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Final Verification

**Files:**
- Verify: `components/telemetry/activity-chart.tsx`
- Verify: `lib/telemetry/chart-format.ts`
- Verify: `lib/telemetry/chart-ticks.ts`

**Interfaces:**
- Consumes: Changes from Tasks 1-3.
- Produces: A working chart with local-time labels, 24h formatting on the 24h range, and a timezone badge.

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

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Manual visual check**

Start the dev server:

```bash
npm run dev
```

Then open the dashboard and confirm for each range:

1. A timezone badge appears in the top-right corner of the chart card (e.g., `CST UTC+08:00` in China).
2. **24h:** x-axis labels read `00:00`, `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00` in local time; tooltip shows `8/9/2025, 03:00` style.
3. **7d / 30d:** x-axis labels read like `Aug 9` in local time; tooltip shows `Aug 9, 2025`.
4. **1y:** x-axis labels read like `Aug 2025`; tooltip shows `Aug 2025`.
5. No vertical grid lines appear at unlabeled buckets.

- [ ] **Step 5: Commit any required fixes**

If lint or build required fixes, commit them with an appropriate message. If no fixes were required, this step is a no-op.

---

## Self-Review

**Spec coverage:**
- Local timezone for all labels → Task 1 helpers, Task 2 wiring.
- 24h format on 24h view → Task 1 `formatTick`/`formatTooltip` with `hour12: false`.
- Timezone badge in chart card corner → Task 2 adds absolute-positioned badge.
- `7d`/`30d`/`1y` date-focused labels → Task 1 helpers.
- Remove unused UTC helper → Task 3.

**Placeholder scan:**
- No "TBD", "TODO", or vague steps.
- Every code block contains the exact change.
- No references to undefined functions or types.

**Type consistency:**
- `formatTick`, `formatTooltip`, and `getTimezoneLabel` signatures are consistent across Task 1 and Task 2.
- `TelemetryRange` imported from the same `@/lib/telemetry/types` path used elsewhere.
- `formatTick` and `formatTooltip` cover all `TelemetryRange` cases exhaustively.
