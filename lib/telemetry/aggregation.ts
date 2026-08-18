import { Collection } from "mongodb";
import {
  TelemetryRange,
  TelemetryTotals,
  KeyCounts,
  TimeSeriesPoint,
  AiUsageTotals,
  AiUsageByModel,
  AiUsageTimeSeriesPoint,
} from "./types";
import { getRangeStart, getBucketInterval, RangeConfig } from "./ranges";

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
            ...(interval.unit === "week" ? { startOfWeek: "monday" } : {}),
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

  const rawMap = new Map(raw.map((item) => [item._id.toISOString(), item]));

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

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function alignToInterval(date: Date, interval: RangeConfig): Date {
  const aligned = new Date(date);
  aligned.setUTCSeconds(0, 0);

  if (interval.unit === "minute") {
    // Floor to the bin boundary, mirroring MongoDB $dateTrunc (which anchors
    // at the UTC epoch, so 30-minute bins land on :00 and :30).
    aligned.setUTCMinutes(
      aligned.getUTCMinutes() - (aligned.getUTCMinutes() % interval.binSize)
    );
  } else {
    aligned.setUTCMinutes(0);
  }

  if (interval.unit === "day") {
    // binSize > 1 must anchor at the UTC epoch to match MongoDB $dateTrunc,
    // which also floors day bins relative to 1970-01-01.
    const daysSinceEpoch = Math.floor(aligned.getTime() / MILLISECONDS_PER_DAY);
    const floored = daysSinceEpoch - (daysSinceEpoch % interval.binSize);
    aligned.setTime(floored * MILLISECONDS_PER_DAY);
    return aligned;
  }

  if (interval.unit === "week" || interval.unit === "month") {
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

function addInterval(date: Date, interval: RangeConfig): Date {
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
    case "month":
      next.setUTCMonth(next.getUTCMonth() + interval.binSize);
      break;
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
  requests: number;
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
        requests: { $sum: 1 },
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
        requests: { $sum: 1 },
      },
    },
    { $sort: { costYuan: -1 } },
  ];
}

export function buildAiUsageTimeSeriesPipeline(
  range: TelemetryRange,
  now = new Date()
): Record<string, unknown>[] {
  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);

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
    requests: first?.requests ?? 0,
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
    requests: number;
  }>;
  return result.map((item) => ({
    model: item._id,
    costYuan: item.costYuan,
    totalTokens: item.totalTokens,
    requests: item.requests,
  }));
}

export async function fetchAiUsageTimeSeries(
  collection: Collection,
  range: TelemetryRange,
  now = new Date()
): Promise<AiUsageTimeSeriesPoint[]> {
  const raw = (await collection
    .aggregate(buildAiUsageTimeSeriesPipeline(range, now))
    .toArray()) as Array<{
    _id: Date;
    costYuan: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;

  const rawMap = new Map(raw.map((item) => [item._id.toISOString(), item]));

  const buckets = generateBuckets(range, now);
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
