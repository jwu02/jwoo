# Telemetry Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder home page with a telemetry dashboard that polls MongoDB Atlas every 60 seconds and displays all-time mouse/keyboard totals, an interactive mouse, a keyboard heatmap, and selectable time-range line charts.

**Architecture:** A single Next.js API route (`app/api/telemetry/route.ts`) runs MongoDB aggregations for all-time totals, per-key counts, and bucketed time-series data. The home page (`app/page.tsx`) is a Client Component that fetches the API every 60 seconds and renders custom SVG visualizations plus a `recharts` line chart. Shared types live in `lib/telemetry/types.ts` and reusable chart/visual components live under `components/telemetry/`.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `mongodb`, `recharts`.

## Global Constraints

- All MongoDB access must use the existing `MONGO_URI` and `ACTIVITY_DB_NAME` environment variables.
- Database name defaults to `activity-telemetry`; collection name is `telemetry`.
- Polling interval is 60 seconds.
- Time-range options are `24h`, `7d`, `30d`, `1y`.
- All-time totals include every document in the collection.
- The dashboard replaces the current placeholder `app/page.tsx`.
- TypeScript strict mode is enabled via `tsconfig.json`.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/api/telemetry/route.ts` | Next.js API route handler; validates range, calls aggregation helpers, returns JSON. |
| `lib/telemetry/types.ts` | Shared TypeScript types: `TelemetryRange`, `TelemetryTotals`, `TimeSeriesPoint`, `TelemetryResponse`, `KeyCounts`. |
| `lib/telemetry/db.ts` | Singleton MongoDB client helper with connection caching for the API route. |
| `lib/telemetry/ranges.ts` | Pure helpers: map `TelemetryRange` to start date and bucket interval. |
| `lib/telemetry/aggregation.ts` | Pure functions that build MongoDB aggregation pipelines for totals, key counts, and time series. |
| `components/telemetry/summary-cards.tsx` | Four summary cards for left clicks, right clicks, distance, and total key presses. |
| `components/telemetry/mouse-visual.tsx` | SVG mouse with hoverable left/right button regions and tooltips. |
| `components/telemetry/keyboard-heatmap.tsx` | SVG Mac QWERTY keyboard heatmap with per-key tooltips. |
| `components/telemetry/activity-chart.tsx` | `recharts` line chart with four series and a legend. |
| `components/telemetry/range-selector.tsx` | Segmented control for `24h / 7d / 30d / 1y`. |
| `components/telemetry/error-banner.tsx` | Small inline error banner with retry button. |
| `app/page.tsx` | Client dashboard page: fetch, poll, compose all components. |
| `tests/lib/telemetry/ranges.test.ts` | Unit tests for range helper functions. |
| `tests/lib/telemetry/aggregation.test.ts` | Unit tests for aggregation pipeline builders (using mocked collection). |
| `tests/app/api/telemetry/route.test.ts` | Route handler tests (using mocked DB helper). |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (via install)

**Interfaces:**
- Consumes: none.
- Produces: `mongodb` and `recharts` available in `node_modules`.

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install mongodb recharts
```

- [ ] **Step 2: Install dev dependencies for testing**

```bash
npm install -D @types/jest jest jest-environment-jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```

If the project already has a test runner configured, skip this and use the existing one. The current `package.json` has no test script, so add Jest.

- [ ] **Step 3: Add test script to package.json**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "typecheck": "tsc --noEmit",
  "test": "jest"
}
```

- [ ] **Step 4: Create Jest configuration**

Create `jest.config.js` at the project root:

```javascript
// jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

module.exports = createJestConfig(customJestConfig);
```

Create `jest.setup.js`:

```javascript
// jest.setup.js
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mongodb, recharts, and jest dependencies

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Shared Types and Range Helpers

**Files:**
- Create: `lib/telemetry/types.ts`
- Create: `lib/telemetry/ranges.ts`
- Create: `tests/lib/telemetry/ranges.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `TelemetryRange`, `TelemetryTotals`, `TimeSeriesPoint`, `TelemetryResponse`, `KeyCounts`, `getRangeStart(range)`, `getBucketInterval(range)`, `RangeConfig`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/telemetry/ranges.test.ts
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

  it("returns a date 30 days in the past for 30d", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("30d", now);
    expect(start.toISOString()).toBe("2026-07-10T12:00:00.000Z");
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
    ["30d", { unit: "day", binSize: 1 }],
    ["1y", { unit: "week", binSize: 1 }],
  ] as [TelemetryRange, { unit: string; binSize: number }][])(
    "returns the correct interval for %s",
    (range, expected) => {
      expect(getBucketInterval(range)).toEqual(expected);
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/telemetry/ranges.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement types and helpers**

```typescript
// lib/telemetry/types.ts
export type TelemetryRange = "24h" | "7d" | "30d" | "1y";

export interface TelemetryTotals {
  leftClicks: number;
  rightClicks: number;
  movementMeters: number;
  totalKeyPresses: number;
}

export interface KeyCounts {
  [label: string]: number;
}

export interface TimeSeriesPoint {
  bucket: string; // ISO date string
  leftClicks: number;
  rightClicks: number;
  movementMeters: number;
  keyPresses: number;
}

export interface TelemetryResponse {
  totals: TelemetryTotals;
  keys: KeyCounts;
  timeSeries: TimeSeriesPoint[];
}
```

```typescript
// lib/telemetry/ranges.ts
import { TelemetryRange } from "./types";

export interface RangeConfig {
  unit: "hour" | "day" | "week";
  binSize: number;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRangeStart(range: TelemetryRange, now = new Date()): Date {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - MILLISECONDS_PER_DAY);
    case "7d":
      return new Date(now.getTime() - 7 * MILLISECONDS_PER_DAY);
    case "30d":
      return new Date(now.getTime() - 30 * MILLISECONDS_PER_DAY);
    case "1y":
      return new Date(now.getTime() - 365 * MILLISECONDS_PER_DAY);
  }
}

export function getBucketInterval(range: TelemetryRange): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "hour", binSize: 1 };
    case "7d":
      return { unit: "hour", binSize: 6 };
    case "30d":
      return { unit: "day", binSize: 1 };
    case "1y":
      return { unit: "week", binSize: 1 };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/telemetry/ranges.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry/types.ts lib/telemetry/ranges.ts tests/lib/telemetry/ranges.test.ts
git commit -m "feat: add telemetry types and range helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: MongoDB Connection Helper

**Files:**
- Create: `lib/telemetry/db.ts`

**Interfaces:**
- Consumes: `MONGO_URI` and `ACTIVITY_DB_NAME` environment variables.
- Produces: `getTelemetryCollection()` returns a `Collection` from the `mongodb` driver.

- [ ] **Step 1: Implement the DB helper**

```typescript
// lib/telemetry/db.ts
import { MongoClient, Db, Collection } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.ACTIVITY_DB_NAME || "activity-telemetry";
const COLLECTION_NAME = "telemetry";

if (!MONGO_URI) {
  throw new Error("Missing MONGO_URI environment variable");
}

declare global {
  // Allow caching the client across hot reloads in development.
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

function getClient(): MongoClient {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(MONGO_URI!);
  }
  return global._mongoClient;
}

export function getTelemetryCollection(): Collection {
  const client = getClient();
  const db: Db = client.db(DB_NAME);
  return db.collection(COLLECTION_NAME);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/telemetry/db.ts
git commit -m "feat: add cached MongoDB telemetry collection helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Aggregation Pipeline Builders

**Files:**
- Create: `lib/telemetry/aggregation.ts`
- Create: `tests/lib/telemetry/aggregation.test.ts`

**Interfaces:**
- Consumes: `TelemetryRange`, `getRangeStart`, `getBucketInterval`, MongoDB `Collection`.
- Produces: `getTotalsPipeline()`, `getKeyCountsPipeline()`, `getTimeSeriesPipeline(range)`, plus query functions `fetchTotals(collection)`, `fetchKeyCounts(collection)`, `fetchTimeSeries(collection, range)`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/telemetry/aggregation.test.ts
import {
  buildTotalsPipeline,
  buildKeyCountsPipeline,
  buildTimeSeriesPipeline,
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
  generateBuckets,
} from "@/lib/telemetry/aggregation";
import { Collection } from "mongodb";

function makeMockCollection(aggregateResult: unknown[] = []): Collection {
  return {
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(aggregateResult),
    }),
  } as unknown as Collection;
}

describe("buildTotalsPipeline", () => {
  it("sums mouse fields", () => {
    const pipeline = buildTotalsPipeline();
    expect(pipeline).toEqual([
      {
        $group: {
          _id: null,
          leftClicks: { $sum: "$mouse.leftClicks" },
          rightClicks: { $sum: "$mouse.rightClicks" },
          movementMeters: { $sum: "$mouse.movementMeters" },
        },
      },
    ]);
  });
});

describe("buildKeyCountsPipeline", () => {
  it("unwinds keys and sums per label", () => {
    const pipeline = buildKeyCountsPipeline();
    expect(pipeline).toEqual([
      { $project: { keysArray: { $objectToArray: "$keys" } } },
      { $unwind: "$keysArray" },
      {
        $group: {
          _id: "$keysArray.k",
          count: { $sum: "$keysArray.v" },
        },
      },
    ]);
  });
});

describe("buildTimeSeriesPipeline", () => {
  it("matches, buckets, and sums for 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const pipeline = buildTimeSeriesPipeline("24h", now);

    expect(pipeline[0]).toEqual({
      $match: { createdAt: { $gte: new Date("2026-08-08T12:00:00.000Z") } },
    });

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: { date: "$createdAt", unit: "hour", binSize: 1 },
    });
    expect(groupStage.$group.leftClicks).toEqual({ $sum: "$mouse.leftClicks" });
    expect(groupStage.$group.rightClicks).toEqual({ $sum: "$mouse.rightClicks" });
    expect(groupStage.$group.movementMeters).toEqual({ $sum: "$mouse.movementMeters" });

    expect(pipeline[pipeline.length - 1]).toEqual({ $sort: { _id: 1 } });
  });
});

describe("fetchTotals", () => {
  it("returns totals from the aggregation result", async () => {
    const collection = makeMockCollection([
      { leftClicks: 10, rightClicks: 2, movementMeters: 1.5 },
    ]);
    const result = await fetchTotals(collection);
    expect(result).toEqual({
      leftClicks: 10,
      rightClicks: 2,
      movementMeters: 1.5,
    });
  });

  it("returns zeros when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchTotals(collection);
    expect(result).toEqual({
      leftClicks: 0,
      rightClicks: 0,
      movementMeters: 0,
    });
  });
});

describe("fetchKeyCounts", () => {
  it("returns a key -> count object", async () => {
    const collection = makeMockCollection([
      { _id: "A", count: 3 },
      { _id: "Space", count: 7 },
    ]);
    const result = await fetchKeyCounts(collection);
    expect(result).toEqual({ A: 3, Space: 7 });
  });

  it("returns empty object when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchKeyCounts(collection);
    expect(result).toEqual({});
  });
});

describe("fetchTimeSeries", () => {
  it("maps aggregation results into zero-filled buckets", async () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const bucket = new Date("2026-08-09T10:00:00.000Z");
    const collection = makeMockCollection([
      {
        _id: bucket,
        leftClicks: 1,
        rightClicks: 0,
        movementMeters: 0.5,
        keyPresses: 5,
      },
    ]);
    const result = await fetchTimeSeries(collection, "24h", now);

    const found = result.find((p) => p.bucket === bucket.toISOString());
    expect(found).toEqual({
      bucket: bucket.toISOString(),
      leftClicks: 1,
      rightClicks: 0,
      movementMeters: 0.5,
      keyPresses: 5,
    });

    expect(result.length).toBe(generateBuckets("24h", now).length);
    expect(result.every((p) => typeof p.leftClicks === "number")).toBe(true);
  });
});

describe("generateBuckets", () => {
  it("produces 24 hourly buckets for 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const buckets = generateBuckets("24h", now);
    expect(buckets.length).toBe(24);
    expect(buckets[0]).toBe("2026-08-08T12:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T11:00:00.000Z");
  });

  it("produces 28 six-hour buckets for 7d", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const buckets = generateBuckets("7d", now);
    expect(buckets.length).toBe(28);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/telemetry/aggregation.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement aggregation helpers**

```typescript
// lib/telemetry/aggregation.ts
import { Collection } from "mongodb";
import { TelemetryRange, TelemetryTotals, KeyCounts, TimeSeriesPoint } from "./types";
import { getRangeStart, getBucketInterval, RangeConfig } from "./ranges";

export function buildTotalsPipeline(): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: null,
        leftClicks: { $sum: "$mouse.leftClicks" },
        rightClicks: { $sum: "$mouse.rightClicks" },
        movementMeters: { $sum: "$mouse.movementMeters" },
      },
    },
  ];
}

export function buildKeyCountsPipeline(): Record<string, unknown>[] {
  return [
    { $project: { keysArray: { $objectToArray: "$keys" } } },
    { $unwind: "$keysArray" },
    {
      $group: {
        _id: "$keysArray.k",
        count: { $sum: "$keysArray.v" },
      },
    },
  ];
}

export function buildTimeSeriesPipeline(
  range: TelemetryRange,
  now = new Date()
): Record<string, unknown>[] {
  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);

  return [
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: "$createdAt",
            unit: interval.unit,
            binSize: interval.binSize,
          },
        },
        leftClicks: { $sum: "$mouse.leftClicks" },
        rightClicks: { $sum: "$mouse.rightClicks" },
        movementMeters: { $sum: "$mouse.movementMeters" },
        keyPresses: {
          $sum: {
            $sum: {
              $map: {
                input: { $objectToArray: "$keys" },
                as: "kv",
                in: "$$kv.v",
              },
            },
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

export async function fetchTotals(collection: Collection): Promise<Omit<TelemetryTotals, "totalKeyPresses">> {
  const result = await collection.aggregate(buildTotalsPipeline()).toArray();
  const first = result[0] as
    | { leftClicks: number; rightClicks: number; movementMeters: number }
    | undefined;
  return {
    leftClicks: first?.leftClicks ?? 0,
    rightClicks: first?.rightClicks ?? 0,
    movementMeters: first?.movementMeters ?? 0,
  };
}

export async function fetchKeyCounts(collection: Collection): Promise<KeyCounts> {
  const result = (await collection
    .aggregate(buildKeyCountsPipeline())
    .toArray()) as Array<{ _id: string; count: number }>;
  return result.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {} as KeyCounts);
}

export async function fetchTimeSeries(
  collection: Collection,
  range: TelemetryRange,
  now = new Date()
): Promise<TimeSeriesPoint[]> {
  const raw = (await collection
    .aggregate(buildTimeSeriesPipeline(range, now))
    .toArray()) as Array<{
    _id: Date;
    leftClicks: number;
    rightClicks: number;
    movementMeters: number;
    keyPresses: number;
  }>;

  const rawMap = new Map(
    raw.map((item) => [item._id.toISOString(), item])
  );

  const buckets = generateBuckets(range, now);
  return buckets.map((bucket) => {
    const item = rawMap.get(bucket);
    return {
      bucket,
      leftClicks: item?.leftClicks ?? 0,
      rightClicks: item?.rightClicks ?? 0,
      movementMeters: item?.movementMeters ?? 0,
      keyPresses: item?.keyPresses ?? 0,
    };
  });
}

function generateBuckets(range: TelemetryRange, now: Date): string[] {
  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);
  const buckets: string[] = [];

  let current = alignToInterval(start, interval);
  const end = alignToInterval(now, interval);

  while (current <= end) {
    buckets.push(current.toISOString());
    current = addInterval(current, interval);
  }

  return buckets;
}

export { generateBuckets };

function alignToInterval(date: Date, interval: RangeConfig): Date {
  const aligned = new Date(date);
  aligned.setUTCSeconds(0, 0);
  aligned.setUTCMinutes(0);

  if (interval.unit === "day" || interval.unit === "week") {
    aligned.setUTCHours(0);
  }

  if (interval.unit === "week") {
    const day = aligned.getUTCDay();
    aligned.setUTCDate(aligned.getUTCDate() - day);
  }

  return aligned;
}

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
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/telemetry/aggregation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry/aggregation.ts tests/lib/telemetry/aggregation.test.ts
git commit -m "feat: add MongoDB aggregation builders and query helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: API Route

**Files:**
- Create: `app/api/telemetry/route.ts`
- Create: `tests/app/api/telemetry/route.test.ts`

**Interfaces:**
- Consumes: `getTelemetryCollection`, `fetchTotals`, `fetchKeyCounts`, `fetchTimeSeries`, `TelemetryRange`.
- Produces: `GET /api/telemetry?range=24h` returns `TelemetryResponse` JSON.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/api/telemetry/route.test.ts
/**
 * @jest-environment node
 */
import { GET } from "@/app/api/telemetry/route";

jest.mock("@/lib/telemetry/db", () => ({
  getTelemetryCollection: jest.fn(),
}));

jest.mock("@/lib/telemetry/aggregation", () => ({
  fetchTotals: jest.fn(),
  fetchKeyCounts: jest.fn(),
  fetchTimeSeries: jest.fn(),
}));

import { getTelemetryCollection } from "@/lib/telemetry/db";
import { fetchTotals, fetchKeyCounts, fetchTimeSeries } from "@/lib/telemetry/aggregation";

const mockCollection = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  (getTelemetryCollection as jest.Mock).mockReturnValue(mockCollection);
});

describe("GET /api/telemetry", () => {
  it("returns telemetry data for a valid range", async () => {
    (fetchTotals as jest.Mock).mockResolvedValue({
      leftClicks: 10,
      rightClicks: 2,
      movementMeters: 1.5,
    });
    (fetchKeyCounts as jest.Mock).mockResolvedValue({ A: 3, Space: 7 });
    (fetchTimeSeries as jest.Mock).mockResolvedValue([
      {
        bucket: "2026-08-09T10:00:00.000Z",
        leftClicks: 1,
        rightClicks: 0,
        movementMeters: 0.5,
        keyPresses: 5,
      },
    ]);

    const request = new Request("http://localhost:3000/api/telemetry?range=24h");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      totals: {
        leftClicks: 10,
        rightClicks: 2,
        movementMeters: 1.5,
        totalKeyPresses: 10,
      },
      keys: { A: 3, Space: 7 },
      timeSeries: [
        {
          bucket: "2026-08-09T10:00:00.000Z",
          leftClicks: 1,
          rightClicks: 0,
          movementMeters: 0.5,
          keyPresses: 5,
        },
      ],
    });
  });

  it("returns 400 for an invalid range", async () => {
    const request = new Request("http://localhost:3000/api/telemetry?range=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 when aggregation throws", async () => {
    (fetchTotals as jest.Mock).mockRejectedValue(new Error("DB error"));
    const request = new Request("http://localhost:3000/api/telemetry?range=24h");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/app/api/telemetry/route.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the route**

```typescript
// app/api/telemetry/route.ts
import { NextResponse } from "next/server";
import { getTelemetryCollection } from "@/lib/telemetry/db";
import {
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
} from "@/lib/telemetry/aggregation";
import { TelemetryRange, TelemetryResponse } from "@/lib/telemetry/types";

const VALID_RANGES: TelemetryRange[] = ["24h", "7d", "30d", "1y"];

function isValidRange(value: string | null): value is TelemetryRange {
  return VALID_RANGES.includes(value as TelemetryRange);
}

function sumKeyCounts(keys: Record<string, number>): number {
  return Object.values(keys).reduce((sum, count) => sum + count, 0);
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");

  if (!isValidRange(rangeParam)) {
    return NextResponse.json(
      { error: `Invalid range. Must be one of: ${VALID_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const collection = getTelemetryCollection();
    const [totals, keys, timeSeries] = await Promise.all([
      fetchTotals(collection),
      fetchKeyCounts(collection),
      fetchTimeSeries(collection, rangeParam),
    ]);

    const response: TelemetryResponse = {
      totals: {
        ...totals,
        totalKeyPresses: sumKeyCounts(keys),
      },
      keys,
      timeSeries,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Telemetry API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch telemetry data" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/app/api/telemetry/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/telemetry/route.ts tests/app/api/telemetry/route.test.ts
git commit -m "feat: add telemetry API route

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Summary Cards Component

**Files:**
- Create: `components/telemetry/summary-cards.tsx`

**Interfaces:**
- Consumes: `TelemetryTotals`.
- Produces: `SummaryCards` React component.

- [ ] **Step 1: Implement the component**

```tsx
// components/telemetry/summary-cards.tsx
import { TelemetryTotals } from "@/lib/telemetry/types";
import { MousePointerClick, MousePointer, Ruler, Keyboard } from "lucide-react";

interface SummaryCardsProps {
  totals: TelemetryTotals;
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  const items = [
    {
      label: "Left Clicks",
      value: totals.leftClicks,
      icon: MousePointerClick,
    },
    {
      label: "Right Clicks",
      value: totals.rightClicks,
      icon: MousePointer,
    },
    {
      label: "Mouse Distance",
      value: totals.movementMeters,
      unit: "m",
      icon: Ruler,
    },
    {
      label: "Key Presses",
      value: totals.totalKeyPresses,
      icon: Keyboard,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <item.icon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              {item.label}
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {item.unit ? formatNumber(item.value, 2) : formatNumber(item.value)}
            {item.unit ? (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {item.unit}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/summary-cards.tsx
git commit -m "feat: add telemetry summary cards component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Mouse Visualization Component

**Files:**
- Create: `components/telemetry/mouse-visual.tsx`

**Interfaces:**
- Consumes: `{ leftClicks, rightClicks }`.
- Produces: `MouseVisual` React component.

- [ ] **Step 1: Implement the component**

```tsx
// components/telemetry/mouse-visual.tsx
"use client";

import { useState } from "react";

interface MouseVisualProps {
  leftClicks: number;
  rightClicks: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function MouseVisual({ leftClicks, rightClicks }: MouseVisualProps) {
  const [hovered, setHovered] = useState<"left" | "right" | null>(null);

  return (
    <div className="relative flex flex-col items-center">
      <svg
        viewBox="0 0 160 240"
        className="h-48 w-32 drop-shadow-sm"
        aria-label="Physical mouse with left and right click counts"
      >
        {/* Mouse body */}
        <rect
          x="10"
          y="10"
          width="140"
          height="220"
          rx="70"
          ry="70"
          className="fill-card stroke-border"
          strokeWidth="2"
        />

        {/* Scroll wheel */}
        <rect
          x="68"
          y="50"
          width="24"
          height="50"
          rx="12"
          className="fill-muted stroke-border"
          strokeWidth="2"
        />

        {/* Left button region */}
        <path
          d="M 12 80 Q 12 12 80 12 L 80 80 Z"
          className={`cursor-pointer transition-colors ${
            hovered === "left" ? "fill-primary/20" : "fill-transparent"
          }`}
          onMouseEnter={() => setHovered("left")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("left")}
          onBlur={() => setHovered(null)}
          tabIndex={0}
          role="button"
          aria-label={`Left button: ${formatNumber(leftClicks)} clicks`}
        />

        {/* Right button region */}
        <path
          d="M 148 80 Q 148 12 80 12 L 80 80 Z"
          className={`cursor-pointer transition-colors ${
            hovered === "right" ? "fill-primary/20" : "fill-transparent"
          }`}
          onMouseEnter={() => setHovered("right")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("right")}
          onBlur={() => setHovered(null)}
          tabIndex={0}
          role="button"
          aria-label={`Right button: ${formatNumber(rightClicks)} clicks`}
        />

        {/* Center dividing line */}
        <line
          x1="80"
          y1="12"
          x2="80"
          y2="80"
          className="stroke-border"
          strokeWidth="2"
        />
      </svg>

      {hovered && (
        <div className="absolute -bottom-10 rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md">
          {hovered === "left" ? (
            <>Left: {formatNumber(leftClicks)} clicks</>
          ) : (
            <>Right: {formatNumber(rightClicks)} clicks</>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/mouse-visual.tsx
git commit -m "feat: add interactive physical mouse visualization

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Keyboard Heatmap Component

**Files:**
- Create: `components/telemetry/keyboard-heatmap.tsx`

**Interfaces:**
- Consumes: `KeyCounts`.
- Produces: `KeyboardHeatmap` React component.

- [ ] **Step 1: Implement the component**

```tsx
// components/telemetry/keyboard-heatmap.tsx
"use client";

import { useMemo, useState } from "react";
import { KeyCounts } from "@/lib/telemetry/types";

interface KeyboardHeatmapProps {
  keys: KeyCounts;
}

interface KeyDef {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ROWS: KeyDef[][] = [
  [
    { label: "Grave", x: 0, y: 0, width: 40, height: 40 },
    { label: "1", x: 45, y: 0, width: 40, height: 40 },
    { label: "2", x: 90, y: 0, width: 40, height: 40 },
    { label: "3", x: 135, y: 0, width: 40, height: 40 },
    { label: "4", x: 180, y: 0, width: 40, height: 40 },
    { label: "5", x: 225, y: 0, width: 40, height: 40 },
    { label: "6", x: 270, y: 0, width: 40, height: 40 },
    { label: "7", x: 315, y: 0, width: 40, height: 40 },
    { label: "8", x: 360, y: 0, width: 40, height: 40 },
    { label: "9", x: 405, y: 0, width: 40, height: 40 },
    { label: "0", x: 450, y: 0, width: 40, height: 40 },
    { label: "Minus", x: 495, y: 0, width: 40, height: 40 },
    { label: "Equal", x: 540, y: 0, width: 40, height: 40 },
    { label: "Delete", x: 585, y: 0, width: 80, height: 40 },
  ],
  [
    { label: "Tab", x: 0, y: 45, width: 65, height: 40 },
    { label: "Q", x: 70, y: 45, width: 40, height: 40 },
    { label: "W", x: 115, y: 45, width: 40, height: 40 },
    { label: "E", x: 160, y: 45, width: 40, height: 40 },
    { label: "R", x: 205, y: 45, width: 40, height: 40 },
    { label: "T", x: 250, y: 45, width: 40, height: 40 },
    { label: "Y", x: 295, y: 45, width: 40, height: 40 },
    { label: "U", x: 340, y: 45, width: 40, height: 40 },
    { label: "I", x: 385, y: 45, width: 40, height: 40 },
    { label: "O", x: 430, y: 45, width: 40, height: 40 },
    { label: "P", x: 475, y: 45, width: 40, height: 40 },
    { label: "Left Bracket", x: 520, y: 45, width: 40, height: 40 },
    { label: "Right Bracket", x: 565, y: 45, width: 40, height: 40 },
    { label: "Backslash", x: 610, y: 45, width: 55, height: 40 },
  ],
  [
    { label: "Caps Lock", x: 0, y: 90, width: 75, height: 40 },
    { label: "A", x: 80, y: 90, width: 40, height: 40 },
    { label: "S", x: 125, y: 90, width: 40, height: 40 },
    { label: "D", x: 170, y: 90, width: 40, height: 40 },
    { label: "F", x: 215, y: 90, width: 40, height: 40 },
    { label: "G", x: 260, y: 90, width: 40, height: 40 },
    { label: "H", x: 305, y: 90, width: 40, height: 40 },
    { label: "J", x: 350, y: 90, width: 40, height: 40 },
    { label: "K", x: 395, y: 90, width: 40, height: 40 },
    { label: "L", x: 440, y: 90, width: 40, height: 40 },
    { label: "Semicolon", x: 485, y: 90, width: 40, height: 40 },
    { label: "Quote", x: 530, y: 90, width: 40, height: 40 },
    { label: "Return", x: 575, y: 90, width: 90, height: 40 },
  ],
  [
    { label: "Left Shift", x: 0, y: 135, width: 95, height: 40 },
    { label: "Z", x: 100, y: 135, width: 40, height: 40 },
    { label: "X", x: 145, y: 135, width: 40, height: 40 },
    { label: "C", x: 190, y: 135, width: 40, height: 40 },
    { label: "V", x: 235, y: 135, width: 40, height: 40 },
    { label: "B", x: 280, y: 135, width: 40, height: 40 },
    { label: "N", x: 325, y: 135, width: 40, height: 40 },
    { label: "M", x: 370, y: 135, width: 40, height: 40 },
    { label: "Comma", x: 415, y: 135, width: 40, height: 40 },
    { label: "Period", x: 460, y: 135, width: 40, height: 40 },
    { label: "Slash", x: 505, y: 135, width: 40, height: 40 },
    { label: "Right Shift", x: 550, y: 135, width: 115, height: 40 },
  ],
  [
    { label: "Left Ctrl", x: 0, y: 180, width: 50, height: 40 },
    { label: "Left Option", x: 55, y: 180, width: 50, height: 40 },
    { label: "Left Cmd", x: 110, y: 180, width: 55, height: 40 },
    { label: "Space", x: 170, y: 180, width: 250, height: 40 },
    { label: "Right Cmd", x: 425, y: 180, width: 55, height: 40 },
    { label: "Right Option", x: 485, y: 180, width: 50, height: 40 },
    { label: "Right Ctrl", x: 540, y: 180, width: 50, height: 40 },
  ],
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function interpolateColor(intensity: number): string {
  // intensity is 0..1. Return OKLCH color from neutral to warm orange.
  // Using CSS variables is hard inside SVG, so use fixed OKLCH values.
  // Neutral: oklch(0.97 0 0), Warm: oklch(0.7 0.15 45)
  const l = 0.97 - intensity * 0.27;
  const c = intensity * 0.15;
  const h = 45;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h})`;
}

export function KeyboardHeatmap({ keys }: KeyboardHeatmapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxCount = useMemo(() => {
    const values = Object.values(keys);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [keys]);

  const allKeys = useMemo(() => ROWS.flat(), []);

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox="-5 -5 680 235"
        className="min-w-[680px]"
        aria-label="Keyboard heatmap"
      >
        {allKeys.map((key) => {
          const count = keys[key.label] ?? 0;
          const intensity = maxCount > 0 ? count / maxCount : 0;
          const fill = interpolateColor(intensity);
          const isHovered = hovered === key.label;

          return (
            <g
              key={key.label}
              onMouseEnter={() => setHovered(key.label)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key.label)}
              onBlur={() => setHovered(null)}
              tabIndex={count > 0 ? 0 : -1}
              className={count > 0 ? "cursor-pointer" : ""}
            >
              <rect
                x={key.x}
                y={key.y}
                width={key.width}
                height={key.height}
                rx="4"
                fill={fill}
                stroke={isHovered ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={isHovered ? 2 : 1}
                className="transition-colors"
              />
              <text
                x={key.x + key.width / 2}
                y={key.y + key.height / 2 + 4}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium select-none pointer-events-none"
              >
                {key.label.length > 3 ? key.label.slice(0, 2) : key.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md">
          {hovered}: {formatNumber(keys[hovered] ?? 0)} presses
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/keyboard-heatmap.tsx
git commit -m "feat: add interactive keyboard heatmap

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Range Selector and Activity Chart Components

**Files:**
- Create: `components/telemetry/range-selector.tsx`
- Create: `components/telemetry/activity-chart.tsx`

**Interfaces:**
- Consumes: `TelemetryRange`, `TimeSeriesPoint[]`.
- Produces: `RangeSelector` and `ActivityChart` React components.

- [ ] **Step 1: Implement range selector**

```tsx
// components/telemetry/range-selector.tsx
import { TelemetryRange } from "@/lib/telemetry/types";

interface RangeSelectorProps {
  value: TelemetryRange;
  onChange: (range: TelemetryRange) => void;
}

const OPTIONS: { value: TelemetryRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "1y", label: "1y" },
];

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement activity chart**

```tsx
// components/telemetry/activity-chart.tsx
"use client";

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
import { TimeSeriesPoint } from "@/lib/telemetry/types";

interface ActivityChartProps {
  data: TimeSeriesPoint[];
}

function formatTick(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="h-80 w-full rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket"
            tickFormatter={formatTick}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--popover-foreground))",
            }}
            labelFormatter={(label: string) => new Date(label).toLocaleString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="leftClicks"
            name="Left Clicks"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="rightClicks"
            name="Right Clicks"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="keyPresses"
            name="Key Presses"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="movementMeters"
            name="Distance (m)"
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/telemetry/range-selector.tsx components/telemetry/activity-chart.tsx
git commit -m "feat: add range selector and activity chart components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Component Smoke Tests

**Files:**
- Create: `tests/components/telemetry/summary-cards.test.tsx`
- Create: `tests/components/telemetry/mouse-visual.test.tsx`
- Create: `tests/components/telemetry/range-selector.test.tsx`

**Interfaces:**
- Consumes: `SummaryCards`, `MouseVisual`, `RangeSelector`.
- Produces: passing component tests.

- [ ] **Step 1: Write summary cards test**

```tsx
// tests/components/telemetry/summary-cards.test.tsx
import { render, screen } from "@testing-library/react";
import { SummaryCards } from "@/components/telemetry/summary-cards";

const totals = {
  leftClicks: 1000,
  rightClicks: 250,
  movementMeters: 1234.56,
  totalKeyPresses: 50000,
};

describe("SummaryCards", () => {
  it("renders all four totals", () => {
    render(<SummaryCards totals={totals} />);
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("1,234.56")).toBeInTheDocument();
    expect(screen.getByText("50,000")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write mouse visual test**

```tsx
// tests/components/telemetry/mouse-visual.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MouseVisual } from "@/components/telemetry/mouse-visual";

describe("MouseVisual", () => {
  it("shows left click count on hover", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} />);
    const leftButton = screen.getByRole("button", { name: /left button/i });
    fireEvent.mouseEnter(leftButton);
    expect(screen.getByText(/left: 42 clicks/i)).toBeInTheDocument();
  });

  it("shows right click count on hover", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} />);
    const rightButton = screen.getByRole("button", { name: /right button/i });
    fireEvent.mouseEnter(rightButton);
    expect(screen.getByText(/right: 7 clicks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write range selector test**

```tsx
// tests/components/telemetry/range-selector.test.tsx
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

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/components/telemetry
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/components/telemetry
git commit -m "test: add telemetry component smoke tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Task 11: Error Banner Component

**Files:**
- Create: `components/telemetry/error-banner.tsx`

**Interfaces:**
- Consumes: error message and retry callback.
- Produces: `ErrorBanner` React component.

- [ ] **Step 1: Implement the component**

```tsx
// components/telemetry/error-banner.tsx
import { AlertCircle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-medium underline underline-offset-4 hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/error-banner.tsx
git commit -m "feat: add telemetry error banner component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Dashboard Page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: all telemetry components, `TelemetryResponse`, `TelemetryRange`.
- Produces: home page dashboard with 60-second polling.

- [ ] **Step 1: Implement the page**

```tsx
// app/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards } from "@/components/telemetry/summary-cards";
import { MouseVisual } from "@/components/telemetry/mouse-visual";
import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap";
import { RangeSelector } from "@/components/telemetry/range-selector";
import { ActivityChart } from "@/components/telemetry/activity-chart";
import { ErrorBanner } from "@/components/telemetry/error-banner";
import { TelemetryRange, TelemetryResponse } from "@/lib/telemetry/types";

const POLL_INTERVAL_MS = 60_000;

async function fetchTelemetry(range: TelemetryRange): Promise<TelemetryResponse> {
  const response = await fetch(`/api/telemetry?range=${range}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export default function HomePage() {
  const [range, setRange] = useState<TelemetryRange>("24h");
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const result = await fetchTelemetry(range);
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load telemetry");
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Telemetry</h1>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <SummaryCards totals={data.totals} />

          <div className="grid gap-8 md:grid-cols-[240px_1fr]">
            <MouseVisual
              leftClicks={data.totals.leftClicks}
              rightClicks={data.totals.rightClicks}
            />
            <KeyboardHeatmap keys={data.keys} />
          </div>

          <ActivityChart data={data.timeSeries} />
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace placeholder home page with telemetry dashboard

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Quality Checks

**Files:**
- Modify: any files that fail lint/typecheck/build.

**Interfaces:**
- Consumes: all previously created files.
- Produces: passing lint, typecheck, and build.

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS with no errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: PASS with no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: PASS with no errors.

- [ ] **Step 5: Fix any issues**

If any of the above fail, fix the underlying files and re-run the failing command until it passes.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: fix lint, typecheck, and build issues

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every goal from the design spec has a corresponding task: summary totals (Task 6), mouse visualization (Task 7), keyboard heatmap (Task 8), selectable range chart (Tasks 9, 12), 60-second polling (Task 12), API route (Task 5), error handling (Tasks 5, 11, 12), tests (Tasks 2, 4, 5, 10, 13).
- [ ] **Placeholder scan:** No TBD, TODO, or vague steps remain.
- [ ] **Type consistency:** `TelemetryResponse` is returned by the route and consumed by the page. `TelemetryRange` is used in helpers, aggregation, route, and UI. `KeyCounts` is used by the heatmap and API response.
- [ ] **Scope:** The plan stays within the dashboard and does not add application-time visualization or real-time push.

## Notes

- The `.env` file already contains `MONGO_URI` and `ACTIVITY_DB_NAME`; do not commit credential values.
- The keyboard layout in `components/telemetry/keyboard-heatmap.tsx` intentionally covers the main UK Mac QWERTY alphanumeric block. Modifier-only keys are included for completeness but are not required to match every key emitted by the Python client.
- If the build complains about `"use client"` on the page, ensure all child components that use client-only APIs are also marked `"use client"`.
