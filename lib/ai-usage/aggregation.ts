import { Collection } from "mongodb";
import { getRangeStart, Range } from "@/lib/ranges";
import { generateBuckets } from "@/lib/timezone";
import { getBucketInterval } from "./ranges";
import { projectForCwd } from "./project-groups";
import {
  ByHarness,
  ByModel,
  ByProject,
  ModelTimeSeries,
  TimeSeriesPoint,
  Totals,
} from "./types";

interface TotalsRow {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export function buildTotalsPipeline(): Record<string, unknown>[] {
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

export function buildByModelPipeline(): Record<string, unknown>[] {
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

export function buildByProjectPipeline(): Record<string, unknown>[] {
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

export function buildByHarnessPipeline(): Record<string, unknown>[] {
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

export function buildTimeSeriesPipeline(
  range: Range,
  now = new Date(),
  timeZone = "UTC"
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

export function buildTimeSeriesByModelPipeline(
  range: Range,
  now = new Date(),
  timeZone = "UTC"
): Record<string, unknown>[] {
  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);

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

export async function fetchTotals(collection: Collection): Promise<Totals> {
  const result = await collection.aggregate(buildTotalsPipeline()).toArray();
  const first = result[0] as TotalsRow | undefined;
  return {
    costYuan: first?.costYuan ?? 0,
    totalTokens: first?.totalTokens ?? 0,
    promptTokens: first?.promptTokens ?? 0,
    completionTokens: first?.completionTokens ?? 0,
    cacheHitTokens: first?.cacheHitTokens ?? 0,
    cacheMissTokens: first?.cacheMissTokens ?? 0,
  };
}

export async function fetchByModel(
  collection: Collection
): Promise<ByModel[]> {
  const result = (await collection
    .aggregate(buildByModelPipeline())
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

export async function fetchByProject(
  collection: Collection
): Promise<ByProject[]> {
  const result = (await collection
    .aggregate(buildByProjectPipeline())
    .toArray()) as Array<{
    _id: string | null;
    costYuan: number;
    totalTokens: number;
  }>;

  // Bucket every cwd by its mapped project name; unmatched cwds (and
  // documents with no cwd at all) all share the fallback project.
  const buckets = new Map<string, ByProject>();

  for (const item of result) {
    const project = projectForCwd(item._id);
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

export async function fetchByHarness(
  collection: Collection
): Promise<ByHarness[]> {
  const result = (await collection
    .aggregate(buildByHarnessPipeline())
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

export async function fetchTimeSeries(
  collection: Collection,
  range: Range,
  now = new Date(),
  timeZone = "UTC"
): Promise<TimeSeriesPoint[]> {
  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);

  const raw = (await collection
    .aggregate(buildTimeSeriesPipeline(range, now, timeZone))
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

export async function fetchTimeSeriesByModel(
  collection: Collection,
  range: Range,
  now = new Date(),
  timeZone = "UTC"
): Promise<ModelTimeSeries[]> {
  const start = getRangeStart(range, now);
  const interval = getBucketInterval(range);

  const raw = (await collection
    .aggregate(buildTimeSeriesByModelPipeline(range, now, timeZone))
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
