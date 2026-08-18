# AI Usage

## Context

The site has an Activity Telemetry dashboard at `/activity-telemetry` that visualizes
mouse/keyboard activity from a MongoDB `telemetry` collection. The user wants a new
page that visualizes AI usage records from the `ai_usage` collection in the same
`activity-telemetry` database.

Each document in `ai_usage` records one AI API call:

```ts
{
  model: string;                      // e.g. "deepseek-v4-flash"
  cost_yuan: number;                  // cost in RMB (e.g. 0.499072)
  prompt_tokens: number;              // e.g. 551462
  completion_tokens: number;          // e.g. 6996
  total_tokens: number;               // e.g. 558458
  prompt_cache_hit_tokens: number;    // e.g. 420096
  prompt_cache_miss_tokens: number;   // e.g. 131366
  recorded_at: Date;                  // ISO timestamp of the call
}
```

## Goals

- Add a dedicated `/ai-usage` page linked from the sidebar and home page.
- Provide a `GET /api/ai-usage` endpoint that returns totals, per-model breakdown,
  and a time series from MongoDB.
- Show summary cards for total cost (¥), total tokens, prompt/completion tokens, and
  cache-hit rate.
- Show a time-series chart of tokens and cost over time (small multiples — two
  charts sharing an x-axis, never a dual y-axis).
- Show a model breakdown of cost/tokens per model (bar chart + table).
- Reuse the existing 24h / 7d / 1y ranges, bucket generation, and polling patterns.
- Fit the existing Next.js 16 + React 19 + Tailwind v4 + shadcn/ui architecture.

## Non-Goals

- Currency conversion (cost stays in RMB/¥).
- Storing or computing usage per-user; the collection is aggregate API usage.
- Writing to the `ai_usage` collection from the site.
- Model aliasing/normalization beyond what `model` already contains.

## Design

### 1. Data flow

Mirrors the existing telemetry pipeline:

```
MongoDB ai_usage ──► lib/telemetry/aggregation.ts ──► app/api/ai-usage/route.ts
        ──► app/ai-usage/page.tsx ──► components/ai-usage/*
```

### 2. API response shape

Add to `lib/telemetry/types.ts`:

```ts
export interface AiUsageTotals {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  requests: number; // number of records in range
}

export interface AiUsageByModel {
  model: string;
  costYuan: number;
  totalTokens: number;
  requests: number;
}

export interface AiUsageTimeSeriesPoint {
  bucket: string; // ISO date string
  costYuan: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiUsageResponse {
  totals: AiUsageTotals;
  byModel: AiUsageByModel[];
  timeSeries: AiUsageTimeSeriesPoint[];
}
```

### 3. DB access

Add `getAiUsageCollection()` to `lib/telemetry/db.ts`, following the existing
`getTelemetryCollection()` pattern (cached Mongo client, `ACTIVITY_DB_NAME` db,
collection name `ai_usage`).

### 4. Aggregation

Add to `lib/telemetry/aggregation.ts` (reusing exported `generateBuckets`):

- `buildAiUsageTotalsPipeline()` — `$group` over `_id: null` summing `cost_yuan`,
  `prompt_tokens`, `completion_tokens`, `total_tokens`, `prompt_cache_hit_tokens`,
  `prompt_cache_miss_tokens`, and `$sum: 1` for requests.
- `buildAiUsageByModelPipeline()` — `$group` by `model` summing `cost_yuan`,
  `total_tokens`, and request count; `$sort` by `costYuan` descending.
- `buildAiUsageTimeSeriesPipeline(range, now)` — `$match` on `recorded_at >= start`,
  `$group` by `$dateTrunc` on `recorded_at`, summing the token/cost fields,
  `$sort`. Reuses `getRangeStart` / `getBucketInterval`.
- `fetchAiUsageTotals(collection)` — returns zeroed totals when empty.
- `fetchAiUsageByModel(collection)` — returns `AiUsageByModel[]`.
- `fetchAiUsageTimeSeries(collection, range, now)` — zero-fills empty buckets like
  `fetchTimeSeries`.

### 5. API route

**Route:** `app/api/ai-usage/route.ts`

- `GET` handler validates the `range` query param (`24h` | `7d` | `1y`).
- Fetches totals, byModel, and timeSeries in parallel.
- Returns `AiUsageResponse` with `Cache-Control: no-store, max-age=0`.
- 400 on invalid range; 500 on failure.

### 6. Components

New files under `components/ai-usage/`:

```
components/ai-usage/
├── summary-cards.tsx       // stat tiles (cost ¥, total tokens, prompt, completion, cache-hit %)
├── usage-chart.tsx         // two small-multiple line charts: tokens & cost over time
└── model-breakdown.tsx     // bar chart of cost per model + a table
```

- `summary-cards.tsx` — mirrors `telemetry/summary-cards.tsx` styling (grid of
  rounded cards). Tiles: Cost (¥), Total Tokens, Prompt Tokens, Completion Tokens,
  Cache Hit Rate (%), and Request Count. Cache-hit rate = cacheHit / (cacheHit +
  cacheMiss).
- `usage-chart.tsx` — a client component using Recharts. Two `LineChart`s stacked
  (small multiples) sharing the same bucket x-axis: one for tokens (prompt +
  completion stacked or overlaid), one for cost. Uses existing `formatTick` /
  `getTicksForRange` helpers where they fit. Each chart gets its own tooltip.
- `model-breakdown.tsx` — a horizontal bar list of cost per model (reusing chart
  color tokens) plus a table showing model, requests, total tokens, and cost.

### 7. Page & navigation

- **New route:** `app/ai-usage/page.tsx` — client page copying the
  `activity-telemetry` page's polling/fetch/loading/error patterns, composing
  `SummaryCards`, `UsageChart`, `ModelBreakdown`, and the existing `RangeSelector`
  (telemetry ranges are identical).
- **Sidebar:** add an "AI Usage" entry to `components/app-sidebar.tsx`.
- **Home page:** add a card on `app/page.tsx` linking to `/ai-usage`.

### 8. Error handling

- Reuse the existing `ErrorBanner` with a retry button.
- Loading state: same pulse skeleton pattern as the telemetry page.
- Empty state: if totals are all zero and there are no records, show a muted
  "No AI usage recorded yet" note above the charts.

## Testing

- `tests/lib/telemetry/aggregation.test.ts` — add pipeline shape tests and
  zero-fill / fetch tests for the three `fetchAiUsage*` functions.
- `tests/app/api/ai-usage/route.test.ts` — mock db + aggregation; assert response
  shape, 400 on invalid range, 500 on error.
- `tests/components/ai-usage/summary-cards.test.tsx` — renders the six tiles with
  formatted values.
- `tests/components/ai-usage/model-breakdown.test.tsx` — renders rows and sorts by
  cost.
- `npm run typecheck`, `npm run lint`, and `npm test` must pass.

## Out of Scope

- Currency conversion or non-RMB display.
- Model cost tables or pricing lookups.
- Writing/syncing data into `ai_usage`.
- Per-user or per-session attribution.
