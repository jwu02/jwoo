import { Collection } from "mongodb";
import {
  TelemetryRange,
  TelemetryTotals,
  KeyCounts,
  TimeSeriesPoint,
} from "./types";
import { getRangeStart, getBucketInterval } from "@/lib/ranges";
import { generateBuckets } from "@/lib/timezone";

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
