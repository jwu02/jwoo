# Telemetry Chart: Remove 30d Range and Monthly 1y Buckets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `30d` telemetry range option and change the `1y` view to aggregate into evenly spaced monthly buckets.

**Architecture:** Drop `"30d"` from the `TelemetryRange` union and every consumer, then change the `1y` interval from weekly to monthly by extending the bucket helpers in `lib/telemetry/aggregation.ts` with a `month` unit. Frontend tick and formatting helpers are updated to match the new range set and monthly bucket alignment.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `recharts`, Jest, MongoDB.

## Global Constraints

- Time-range options are `24h`, `7d`, and `1y` after this change.
- The four chart series are Left Clicks, Right Clicks, Key Presses, and Distance (m).
- Data bucket intervals: `24h` = hourly, `7d` = 6-hourly, `1y` = monthly.
- Chart colors must continue to come from the existing `--chart-1`..`--chart-4` CSS variables.
- TypeScript strict mode is enabled via `tsconfig.json`.
- All dates are bucketed in UTC; tick labels format in the runtime timezone.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/telemetry/types.ts` | `TelemetryRange` union; drops `"30d"`. |
| `components/telemetry/range-selector.tsx` | Range buttons; drops the `30d` option. |
| `app/api/telemetry/route.ts` | API validation; drops `30d` from `VALID_RANGES`. |
| `lib/telemetry/ranges.ts` | Range start and interval config; drops `30d`, adds `"month"` to `RangeConfig.unit`, changes `1y` to monthly. |
| `lib/telemetry/aggregation.ts` | MongoDB aggregation and zero-filled bucket generation; handles `month` unit alignment and stepping. |
| `lib/telemetry/chart-format.ts` | Axis and tooltip formatters; drops `30d` case. |
| `lib/telemetry/chart-ticks.ts` | Tick selection; drops `30d`, returns all buckets for `1y`. |
| `tests/...` | Updated unit tests for all changed modules. |

---

## Task 1: Remove 30d from the Type System, Selector, and API

**Files:**
- Modify: `lib/telemetry/types.ts`
- Modify: `components/telemetry/range-selector.tsx`
- Modify: `app/api/telemetry/route.ts`
- Modify: `tests/components/telemetry/range-selector.test.tsx`

**Interfaces:**
- Consumes: Nothing new.
- Produces: `TelemetryRange` is now `"24h" | "7d" | "1y"`; the selector and API no longer accept `30d`.

- [ ] **Step 1: Update the `TelemetryRange` type**

Edit `lib/telemetry/types.ts`:

```ts
export type TelemetryRange = "24h" | "7d" | "1y";
```

- [ ] **Step 2: Remove the 30d button from the selector**

Edit `components/telemetry/range-selector.tsx`:

```ts
const OPTIONS: { value: TelemetryRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "1y", label: "1y" },
];
```

- [ ] **Step 3: Remove 30d from API validation**

Edit `app/api/telemetry/route.ts`:

```ts
const VALID_RANGES: TelemetryRange[] = ["24h", "7d", "1y"];
```

- [ ] **Step 4: Update the selector test**

Edit `tests/components/telemetry/range-selector.test.tsx`:

```ts
import { render, screen, fireEvent } from "@testing-library/react";
import { RangeSelector } from "@/components/telemetry/range-selector";

describe("RangeSelector", () => {
  it("calls onChange when a range is clicked", () => {
    const onChange = jest.fn();
    render(<RangeSelector value="24h" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(onChange).toHaveBeenCalledWith("7d");
  });
});
```

- [ ] **Step 5: Run the selector test**

Run:

```bash
npm test -- tests/components/telemetry/range-selector.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/telemetry/types.ts components/telemetry/range-selector.tsx app/api/telemetry/route.ts tests/components/telemetry/range-selector.test.tsx
git commit -m "feat(telemetry): remove 30d range from type, selector, and API

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Update Range Configuration for Monthly 1y Buckets

**Files:**
- Modify: `lib/telemetry/ranges.ts`
- Modify: `tests/lib/telemetry/ranges.test.ts`

**Interfaces:**
- Consumes: Updated `TelemetryRange` from Task 1.
- Produces: `RangeConfig.unit` includes `"month"`; `getBucketInterval("1y")` returns `{ unit: "month", binSize: 1 }`.

- [ ] **Step 1: Extend `RangeConfig` and update intervals**

Edit `lib/telemetry/ranges.ts`:

```ts
export interface RangeConfig {
  unit: "hour" | "day" | "week" | "month";
  binSize: number;
}
```

Remove the `30d` case from `getRangeStart`:

```ts
export function getRangeStart(range: TelemetryRange, now = new Date()): Date {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - MILLISECONDS_PER_DAY);
    case "7d":
      return new Date(now.getTime() - 7 * MILLISECONDS_PER_DAY);
    case "1y":
      return new Date(now.getTime() - 365 * MILLISECONDS_PER_DAY);
  }
}
```

Update `getBucketInterval`:

```ts
export function getBucketInterval(range: TelemetryRange): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "hour", binSize: 1 };
    case "7d":
      return { unit: "hour", binSize: 6 };
    case "1y":
      return { unit: "month", binSize: 1 };
  }
}
```

- [ ] **Step 2: Update range tests**

Edit `tests/lib/telemetry/ranges.test.ts`:

```ts
import { getRangeStart, getBucketInterval } from "@/lib/telemetry/ranges";
import { TelemetryRange } from "@/lib/telemetry/types";

describe("getRangeStart", () => {
  it("returns a date 24 hours in the past for 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("24h", now);
    expect(start.toISOString()).toBe("2026-08-08T12:00:00.000Z");
  });

  it("returns a date 7 days in the past for 7d", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("7d", now);
    expect(start.toISOString()).toBe("2026-08-02T12:00:00.000Z");
  });

  it("returns a date 365 days in the past for 1y", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("1y", now);
    expect(start.toISOString()).toBe("2025-08-09T12:00:00.000Z");
  });
});

describe("getBucketInterval", () => {
  it.each([
    ["24h", { unit: "hour", binSize: 1 }],
    ["7d", { unit: "hour", binSize: 6 }],
    ["1y", { unit: "month", binSize: 1 }],
  ] as [TelemetryRange, { unit: string; binSize: number }][])(
    "returns the correct interval for %s",
    (range, expected) => {
      expect(getBucketInterval(range)).toEqual(expected);
    }
  );
});
```

- [ ] **Step 3: Run the range tests**

Run:

```bash
npm test -- tests/lib/telemetry/ranges.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/telemetry/ranges.ts tests/lib/telemetry/ranges.test.ts
git commit -m "feat(telemetry): use monthly buckets for 1y range

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Update Aggregation for Monthly Buckets

**Files:**
- Modify: `lib/telemetry/aggregation.ts`
- Modify: `tests/lib/telemetry/aggregation.test.ts`

**Interfaces:**
- Consumes: `RangeConfig` now supports `unit: "month"` from Task 2.
- Produces: `generateBuckets("1y")` returns monthly buckets; `$dateTrunc` uses `unit: "month"` for `1y`.

- [ ] **Step 1: Handle month unit in `alignToInterval`**

Edit `lib/telemetry/aggregation.ts`. Update `alignToInterval` so monthly intervals truncate to the first day of the month:

```ts
function alignToInterval(date: Date, interval: RangeConfig): Date {
  const aligned = new Date(date);
  aligned.setUTCSeconds(0, 0);
  aligned.setUTCMinutes(0);

  if (interval.unit === "day" || interval.unit === "week" || interval.unit === "month") {
    aligned.setUTCHours(0);
  }

  if (interval.unit === "week") {
    const day = aligned.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    aligned.setUTCDate(aligned.getUTCDate() - daysSinceMonday);
  }

  if (interval.unit === "month") {
    aligned.setUTCDate(1);
  }

  if (interval.unit === "hour") {
    const hour = aligned.getUTCHours();
    aligned.setUTCHours(hour - (hour % interval.binSize));
  }

  return aligned;
}
```

- [ ] **Step 2: Handle month unit in `addInterval`**

Edit `lib/telemetry/aggregation.ts`. Add a `month` case to `addInterval`:

```ts
function addInterval(date: Date, interval: RangeConfig): Date {
  const next = new Date(date);
  switch (interval.unit) {
    case "hour":
      next.setUTCHours(next.getUTCHours() + interval.binSize);
      break;
    case "day":
      next.setUTCDate(next.getUTCDate() + interval.binSize);
      break;
    case "week":
      next.setUTCDate(next.getUTCDate() + interval.binSize * 7);
      break;
    case "month":
      next.setUTCMonth(next.getUTCMonth() + interval.binSize);
      break;
  }
  return next;
}
```

- [ ] **Step 3: Verify `buildTimeSeriesPipeline` for 1y**

The existing `buildTimeSeriesPipeline` already spreads `interval.unit` and `interval.binSize` into `$dateTrunc` and only adds `startOfWeek` for weeks. With `interval.unit === "month"` from Task 2, it will produce:

```ts
$dateTrunc: { date: "$createdAt", unit: "month", binSize: 1 }
```

No code change is required here, but confirm the pipeline function reads:

```ts
$dateTrunc: {
  date: "$createdAt",
  unit: interval.unit,
  binSize: interval.binSize,
  ...(interval.unit === "week" ? { startOfWeek: "monday" } : {}),
},
```

- [ ] **Step 4: Update aggregation tests**

Edit `tests/lib/telemetry/aggregation.test.ts`.

Update the `1y` pipeline test to expect a monthly trunc:

```ts
it("uses monthly truncation for 1y buckets", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");
  const pipeline = buildTimeSeriesPipeline("1y", now);

  const groupStage = pipeline[1] as { $group: Record<string, unknown> };
  expect(groupStage.$group._id).toEqual({
    $dateTrunc: {
      date: "$createdAt",
      unit: "month",
      binSize: 1,
    },
  });
});
```

Update the `generateBuckets` test for `1y` to assert monthly alignment and 13 buckets:

```ts
it("produces monthly buckets for 1y aligned to the first of the month", () => {
  const now = new Date("2026-08-09T14:30:00.000Z");
  const buckets = generateBuckets("1y", now);

  expect(buckets.length).toBe(13);
  expect(buckets[0]).toBe("2025-08-01T00:00:00.000Z");
  expect(buckets[buckets.length - 1]).toBe("2026-08-01T00:00:00.000Z");
  buckets.forEach((bucket) => {
    const date = new Date(bucket);
    expect(date.getUTCDate()).toBe(1);
    expect(date.getUTCHours()).toBe(0);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCSeconds()).toBe(0);
  });
});
```

- [ ] **Step 5: Run the aggregation tests**

Run:

```bash
npm test -- tests/lib/telemetry/aggregation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/telemetry/aggregation.ts tests/lib/telemetry/aggregation.test.ts
git commit -m "feat(telemetry): support monthly bucket alignment in aggregation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update Chart Formatting and Tick Selection

**Files:**
- Modify: `lib/telemetry/chart-format.ts`
- Modify: `lib/telemetry/chart-ticks.ts`
- Modify: `tests/lib/telemetry/chart-format.test.ts`
- Modify: `tests/lib/telemetry/chart-ticks.test.ts`

**Interfaces:**
- Consumes: `TelemetryRange` from Task 1.
- Produces: Formatters and tick helper no longer reference `30d`; `1y` ticks are all monthly buckets.

- [ ] **Step 1: Remove 30d from formatters**

Edit `lib/telemetry/chart-format.ts`:

```ts
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
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "7d":
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
```

- [ ] **Step 2: Update tick selection**

Edit `lib/telemetry/chart-ticks.ts`:

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
    case "7d": {
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() === 0;
      });
    }
    case "1y": {
      return buckets;
    }
  }
}
```

- [ ] **Step 3: Update chart-format tests**

Edit `tests/lib/telemetry/chart-format.test.ts`:

```ts
process.env.TZ = "Asia/Shanghai";

import { formatTick, formatTooltip } from "@/lib/telemetry/chart-format";

describe("formatTick", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h range as 24-hour time", () => {
    expect(formatTick(bucket, "24h")).toBe("11:00");
  });

  it("formats 7d range as month and day", () => {
    expect(formatTick(bucket, "7d")).toBe("Aug 9");
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

  it("formats 1y tooltip as month and year", () => {
    expect(formatTooltip(bucket, "1y")).toBe("Aug 2025");
  });
});
```

- [ ] **Step 4: Update chart-ticks tests**

Edit `tests/lib/telemetry/chart-ticks.test.ts`:

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

  it("returns all monthly buckets for 1y", () => {
    const buckets = Array.from({ length: 13 }, (_, i) =>
      new Date(Date.UTC(2025, 7 + i, 1)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "1y");

    expect(ticks).toEqual(buckets);
  });

  it("returns an empty array when no buckets are provided", () => {
    expect(getTicksForRange([], "24h")).toEqual([]);
    expect(getTicksForRange([], "7d")).toEqual([]);
    expect(getTicksForRange([], "1y")).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the formatter and tick tests**

Run:

```bash
npm test -- tests/lib/telemetry/chart-format.test.ts tests/lib/telemetry/chart-ticks.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/telemetry/chart-format.ts lib/telemetry/chart-ticks.ts tests/lib/telemetry/chart-format.test.ts tests/lib/telemetry/chart-ticks.test.ts
git commit -m "feat(telemetry): remove 30d from formatters and ticks

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Final Verification

**Files:**
- Verify: All modified files above.

**Interfaces:**
- Consumes: All changes from Tasks 1–4.
- Produces: A working dashboard with only `24h`, `7d`, and `1y` ranges, where `1y` uses monthly buckets and evenly spaced ticks.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: Build succeeds with no TypeScript or rendering errors.

- [ ] **Step 5: Manual visual check**

Start the dev server:

```bash
npm run dev
```

Then open the dashboard and confirm:

1. The range selector shows only `24h`, `7d`, and `1y`.
2. `24h` and `7d` labels and buckets behave exactly as before.
3. `1y` shows evenly spaced month labels (e.g., `Aug 2025`, `Sep 2025`, …) with one label per monthly bucket.
4. The `1y` line has ≈13 data points, one per month.
5. `?range=30d` in the URL returns a 400 error.

- [ ] **Step 6: Commit any required fixes**

If lint, build, or tests required fixes, commit them with an appropriate message. If no fixes were required, this step is a no-op.

---

## Self-Review

**Spec coverage:**
- Remove `30d` from type, selector, API → Task 1.
- Change `1y` to monthly buckets → Tasks 2 and 3.
- Update `1y` ticks to be evenly spaced → Task 4.
- Update all affected tests → Each task includes test updates.

**Placeholder scan:**
- No "TBD", "TODO", or vague steps.
- Every code block contains the exact change.
- No references to undefined functions or types.

**Type consistency:**
- `TelemetryRange` is `"24h" | "7d" | "1y"` everywhere after Task 1.
- `RangeConfig.unit` includes `"month"` consistently.
- `getBucketInterval("1y")` returns `{ unit: "month", binSize: 1 }` consistently.
- `formatTick`, `formatTooltip`, and `getTicksForRange` cover all remaining `TelemetryRange` cases exhaustively.
