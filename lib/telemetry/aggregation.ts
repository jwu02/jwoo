import { Collection } from "mongodb";
import {
  TelemetryRange,
  TelemetryTotals,
  KeyCounts,
  TimeSeriesPoint,
  AiUsageRange,
  AiUsageTotals,
  AiUsageByModel,
  AiUsageByProject,
  AiUsageByHarness,
  AiUsageTimeSeriesPoint,
  AiUsageModelTimeSeries,
} from "./types";
import {
  getRangeStart,
  getBucketInterval,
  getAiUsageRangeStart,
  getAiUsageBucketInterval,
  RangeConfig,
} from "./ranges";
import { alignToInterval, getTimezoneOffsetMs } from "./timezone";

export function buildTotalsPipeline(): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: null,
        leftClicks: { $sum: "$leftClicks" },
        rightClicks: { $sum: "$rightClicks" },
        movementMeters: { $sum: "$movementMeters" },
        totalKeyPresses: { $sum: "$keysPressed" },
      },
    },
  ];
}

export function buildKeyCountsPipeline(): Record<string, unknown>[] {
  return [
    {
      $project: {
        pairs: {
          $filter: {
            input: { $objectToArray: "$$ROOT" },
            as: "field",
            cond: { $not: { $in: ["$$field.k", ["_id", "createdAt"]] } },
          },
        },
      },
    },
    { $unwind: "$pairs" },
    {
      $group: {
        _id: "$pairs.k",
        count: { $sum: "$pairs.v" },
      },
    },
  ];
}

export function buildTimeSeriesPipeline(
  range: TelemetryRange,
  now = new Date(),
  timeZone = "UTC"
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
            ...(interval.unit === "week" ? { startOfWeek: "monday" } : {}),
            // Bucket by the viewer's local day; omitted (UTC) when not given,
            // which is $dateTrunc's default.
            ...(timeZone !== "UTC" ? { timezone: timeZone } : {}),
          },
        },
        leftClicks: { $sum: "$leftClicks" },
        rightClicks: { $sum: "$rightClicks" },
        movementMeters: { $sum: "$movementMeters" },
        keyPresses: { $sum: "$keysPressed" },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

export async function fetchTotals(
  collection: Collection
): Promise<TelemetryTotals> {
  const result = await collection.aggregate(buildTotalsPipeline()).toArray();
  const first = result[0] as
    | {
        leftClicks: number;
        rightClicks: number;
        movementMeters: number;
        totalKeyPresses: number;
      }
    | undefined;
  return {
    leftClicks: first?.leftClicks ?? 0,
    rightClicks: first?.rightClicks ?? 0,
    movementMeters: first?.movementMeters ?? 0,
    totalKeyPresses: first?.totalKeyPresses ?? 0,
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
  now = new Date(),
  timeZone = "UTC"
): Promise<TimeSeriesPoint[]> {
  const raw = (await collection
    .aggregate(buildTimeSeriesPipeline(range, now, timeZone))
    .toArray()) as Array<{
    _id: Date;
    leftClicks: number;
    rightClicks: number;
    movementMeters: number;
    keyPresses: number;
  }>;

  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);

  const rawMap = new Map(raw.map((item) => [item._id.toISOString(), item]));

  const buckets = generateBuckets(start, interval, now, timeZone);
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

export function generateBuckets(
  start: Date,
  interval: RangeConfig,
  now: Date,
  timeZone = "UTC"
): string[] {
  const buckets: string[] = [];

  let current = alignToInterval(start, interval, timeZone);
  const end = alignToInterval(now, interval, timeZone);

  while (current <= end) {
    buckets.push(current.toISOString());
    current = addInterval(current, interval, timeZone);
  }

  return buckets;
}

function addInterval(
  date: Date,
  interval: RangeConfig,
  timeZone = "UTC"
): Date {
  const next = new Date(date);
  switch (interval.unit) {
    case "minute":
      next.setUTCMinutes(next.getUTCMinutes() + interval.binSize);
      break;
    case "hour":
      next.setUTCHours(next.getUTCHours() + interval.binSize);
      break;
    case "day":
      next.setUTCDate(next.getUTCDate() + interval.binSize);
      break;
    case "week":
      next.setUTCDate(next.getUTCDate() + interval.binSize * 7);
      break;
    case "month": {
      // Month boundaries in a non-UTC timezone sit on the previous month's
      // last UTC day (local Aug 1 00:00 in +8h == UTC Jul 31 16:00). Adding a
      // month via setUTCMonth on the raw instant rolls over whenever that UTC
      // day exceeds the next month's length (Sep 30 -> Oct 1), corrupting every
      // following bucket and dropping the final month. Step a month in
      // wall-clock space — shift by the offset, increment, shift back — which
      // mirrors alignToInterval and lands on the same local day-of-month.
      const offsetMs = getTimezoneOffsetMs(date, timeZone);
      const local = new Date(date.getTime() + offsetMs);
      local.setUTCMonth(local.getUTCMonth() + interval.binSize);
      return new Date(local.getTime() - offsetMs);
    }
  }
  return next;
}

// --- AI usage (collection: ai_usage) ------------------------------------

interface AiUsageTotalsRow {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export function buildAiUsageTotalsPipeline(): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: null,
        costYuan: { $sum: "$cost_yuan" },
        totalTokens: { $sum: "$total_tokens" },
        promptTokens: { $sum: "$prompt_tokens" },
        completionTokens: { $sum: "$completion_tokens" },
        cacheHitTokens: { $sum: "$prompt_cache_hit_tokens" },
        cacheMissTokens: { $sum: "$prompt_cache_miss_tokens" },
      },
    },
  ];
}

export function buildAiUsageByModelPipeline(): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: "$model",
        costYuan: { $sum: "$cost_yuan" },
        totalTokens: { $sum: "$total_tokens" },
      },
    },
    // Model name breaks cost ties so the table and chart share one
    // deterministic ordering.
    { $sort: { costYuan: -1, model: 1 } },
  ];
}

export function buildAiUsageByProjectPipeline(): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: "$cwd",
        costYuan: { $sum: "$cost_yuan" },
        totalTokens: { $sum: "$total_tokens" },
      },
    },
    // Full cwd path breaks cost ties so the table ordering is deterministic.
    { $sort: { costYuan: -1, _id: 1 } },
  ];
}

export function buildAiUsageByHarnessPipeline(): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: "$harness",
        costYuan: { $sum: "$cost_yuan" },
        totalTokens: { $sum: "$total_tokens" },
      },
    },
    // The group output carries the harness value in _id, so sorting on it
    // breaks cost ties and makes the table ordering deterministic.
    { $sort: { costYuan: -1, _id: 1 } },
  ];
}

/** Fallback project name for cwds that match no PROJECT_GROUPS key. */
export const OTHERS_PROJECT = "others";

// Maps a cwd substring (matched case-insensitively) to the project name shown
// in the breakdown table. Keys are evaluated in order; the first substring
// contained in a cwd wins. Order longer, more specific keys before broader
// ones that their paths also contain — e.g. report-generator sits under
// kamkiu, so it must be checked first or its rows would fall into "work".
// Anything matching no key aggregates into the OTHERS_PROJECT row.
const PROJECT_GROUPS: Record<string, string> = {
  "training-management-system": "training-management-system",
  "report-generator": "report-generator",
  kamkiu: "work",
  "personal-website": "personal-website",
};

export function findProjectGroup(cwd: string): string | null {
  const normalized = cwd.toLowerCase();
  for (const [substring, name] of Object.entries(PROJECT_GROUPS)) {
    if (normalized.includes(substring.toLowerCase())) return name;
  }
  return null;
}

export function buildAiUsageTimeSeriesPipeline(
  range: AiUsageRange,
  now = new Date(),
  timeZone = "UTC"
): Record<string, unknown>[] {
  const start = getAiUsageRangeStart(range, now);
  const interval = getAiUsageBucketInterval(range);

  return [
    { $match: { recorded_at: { $gte: start } } },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: "$recorded_at",
            unit: interval.unit,
            binSize: interval.binSize,
            ...(interval.unit === "week" ? { startOfWeek: "monday" } : {}),
            ...(timeZone !== "UTC" ? { timezone: timeZone } : {}),
          },
        },
        costYuan: { $sum: "$cost_yuan" },
        promptTokens: { $sum: "$prompt_tokens" },
        completionTokens: { $sum: "$completion_tokens" },
        totalTokens: { $sum: "$total_tokens" },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

export function buildAiUsageTimeSeriesByModelPipeline(
  range: AiUsageRange,
  now = new Date(),
  timeZone = "UTC"
): Record<string, unknown>[] {
  const start = getAiUsageRangeStart(range, now);
  const interval = getAiUsageBucketInterval(range);

  return [
    { $match: { recorded_at: { $gte: start } } },
    {
      $group: {
        _id: {
          bucket: {
            $dateTrunc: {
              date: "$recorded_at",
              unit: interval.unit,
              binSize: interval.binSize,
              ...(interval.unit === "week" ? { startOfWeek: "monday" } : {}),
              ...(timeZone !== "UTC" ? { timezone: timeZone } : {}),
            },
          },
          model: "$model",
        },
        costYuan: { $sum: "$cost_yuan" },
        totalTokens: { $sum: "$total_tokens" },
      },
    },
    { $sort: { "_id.bucket": 1 } },
  ];
}

export async function fetchAiUsageTotals(
  collection: Collection
): Promise<AiUsageTotals> {
  const result = await collection
    .aggregate(buildAiUsageTotalsPipeline())
    .toArray();
  const first = result[0] as AiUsageTotalsRow | undefined;
  return {
    costYuan: first?.costYuan ?? 0,
    totalTokens: first?.totalTokens ?? 0,
    promptTokens: first?.promptTokens ?? 0,
    completionTokens: first?.completionTokens ?? 0,
    cacheHitTokens: first?.cacheHitTokens ?? 0,
    cacheMissTokens: first?.cacheMissTokens ?? 0,
  };
}

export async function fetchAiUsageByModel(
  collection: Collection
): Promise<AiUsageByModel[]> {
  const result = (await collection
    .aggregate(buildAiUsageByModelPipeline())
    .toArray()) as Array<{
    _id: string;
    costYuan: number;
    totalTokens: number;
  }>;
  return result.map((item) => ({
    model: item._id,
    costYuan: item.costYuan,
    totalTokens: item.totalTokens,
  }));
}

export async function fetchAiUsageByProject(
  collection: Collection
): Promise<AiUsageByProject[]> {
  const result = (await collection
    .aggregate(buildAiUsageByProjectPipeline())
    .toArray()) as Array<{
    _id: string | null;
    costYuan: number;
    totalTokens: number;
  }>;

  // Bucket every cwd by its mapped project name; unmatched cwds (and
  // documents with no cwd at all) all share the OTHERS_PROJECT bucket.
  const buckets = new Map<string, AiUsageByProject>();

  for (const item of result) {
    const project = findProjectGroup(item._id ?? "") ?? OTHERS_PROJECT;
    const existing = buckets.get(project);
    if (existing) {
      existing.costYuan += item.costYuan;
      existing.totalTokens += item.totalTokens;
    } else {
      buckets.set(project, {
        project,
        costYuan: item.costYuan,
        totalTokens: item.totalTokens,
      });
    }
  }

  return [...buckets.values()].sort(
    (a, b) => b.costYuan - a.costYuan || a.project.localeCompare(b.project)
  );
}

export async function fetchAiUsageByHarness(
  collection: Collection
): Promise<AiUsageByHarness[]> {
  const result = (await collection
    .aggregate(buildAiUsageByHarnessPipeline())
    .toArray()) as Array<{
    _id: string | null;
    costYuan: number;
    totalTokens: number;
  }>;

  // Documents written before the collector recorded a harness group under a
  // null _id; label those as "unknown" so the table shows a readable row.
  return result.map((item) => ({
    harness: item._id ?? "unknown",
    costYuan: item.costYuan,
    totalTokens: item.totalTokens,
  }));
}

export async function fetchAiUsageTimeSeries(
  collection: Collection,
  range: AiUsageRange,
  now = new Date(),
  timeZone = "UTC"
): Promise<AiUsageTimeSeriesPoint[]> {
  const start = getAiUsageRangeStart(range, now);
  const interval = getAiUsageBucketInterval(range);

  const raw = (await collection
    .aggregate(buildAiUsageTimeSeriesPipeline(range, now, timeZone))
    .toArray()) as Array<{
    _id: Date;
    costYuan: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;

  const rawMap = new Map(raw.map((item) => [item._id.toISOString(), item]));

  const buckets = generateBuckets(start, interval, now, timeZone);
  return buckets.map((bucket) => {
    const item = rawMap.get(bucket);
    return {
      bucket,
      costYuan: item?.costYuan ?? 0,
      promptTokens: item?.promptTokens ?? 0,
      completionTokens: item?.completionTokens ?? 0,
      totalTokens: item?.totalTokens ?? 0,
    };
  });
}

export async function fetchAiUsageTimeSeriesByModel(
  collection: Collection,
  range: AiUsageRange,
  now = new Date(),
  timeZone = "UTC"
): Promise<AiUsageModelTimeSeries[]> {
  const start = getAiUsageRangeStart(range, now);
  const interval = getAiUsageBucketInterval(range);

  const raw = (await collection
    .aggregate(buildAiUsageTimeSeriesByModelPipeline(range, now, timeZone))
    .toArray()) as Array<{
    _id: { bucket: Date; model: string };
    costYuan: number;
    totalTokens: number;
  }>;

  // Group rows per model, keyed by bucket ISO string.
  const byModel = new Map<
    string,
    Map<string, { costYuan: number; totalTokens: number }>
  >();
  const totalCost = new Map<string, number>();
  for (const item of raw) {
    const model = item._id.model;
    const bucket = item._id.bucket.toISOString();
    if (!byModel.has(model)) byModel.set(model, new Map());
    byModel.get(model)!.set(bucket, {
      costYuan: item.costYuan,
      totalTokens: item.totalTokens,
    });
    totalCost.set(model, (totalCost.get(model) ?? 0) + item.costYuan);
  }

  const buckets = generateBuckets(start, interval, now, timeZone);

  // Highest total cost first, matching the by-model table order; tie-break by
  // model name for determinism.
  const models = [...byModel.keys()].sort((a, b) => {
    const costDiff = (totalCost.get(b) ?? 0) - (totalCost.get(a) ?? 0);
    return costDiff !== 0 ? costDiff : a.localeCompare(b);
  });

  return models.map((model) => {
    const points = byModel.get(model)!;
    return {
      model,
      points: buckets.map((bucket) => {
        const item = points.get(bucket);
        return {
          bucket,
          costYuan: item?.costYuan ?? 0,
          totalTokens: item?.totalTokens ?? 0,
        };
      }),
    };
  });
}
