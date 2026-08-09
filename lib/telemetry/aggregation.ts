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
            ...(interval.unit === "week" ? { startOfWeek: "monday" } : {}),
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

export async function fetchTotals(
  collection: Collection
): Promise<Omit<TelemetryTotals, "totalKeyPresses">> {
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

  while (current < end) {
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
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    aligned.setUTCDate(aligned.getUTCDate() - daysSinceMonday);
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
