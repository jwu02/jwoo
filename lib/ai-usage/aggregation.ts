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
  Totals,
} from "./types";

interface TotalsRow {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  toolCalls: number;
  toolCallsKnown: number;
  skillInvocations: number;
  skillsKnown: number;
}

// Every panel on this page follows the range, and ai_usage documents are dated
// by `recorded_at` — so the filter that does it lives here once rather than in
// each of the four pipelines.
function rangeMatch(range: Range, now: Date): Record<string, unknown> {
  return { $match: { recorded_at: { $gte: getRangeStart(range, now) } } };
}

export function buildTotalsPipeline(
  range: Range,
  now = new Date()
): Record<string, unknown>[] {
  return [
    rangeMatch(range, now),
    {
      $group: {
        _id: null,
        costYuan: { $sum: "$cost_yuan" },
        totalTokens: { $sum: "$total_tokens" },
        promptTokens: { $sum: "$prompt_tokens" },
        completionTokens: { $sum: "$completion_tokens" },
        cacheHitTokens: { $sum: "$prompt_cache_hit_tokens" },
        cacheMissTokens: { $sum: "$prompt_cache_miss_tokens" },
        toolCalls: { $sum: "$tool_calls" },
        // $sum skips null and missing fields, so the number of records that
        // carry each field at all is kept beside the sum: a sum of zero over
        // zero known records is an unknown total, not a zero one.
        toolCallsKnown: {
          $sum: {
            $cond: [
              { $in: [{ $type: "$tool_calls" }, ["missing", "null"]] },
              0,
              1,
            ],
          },
        },
        skillInvocations: { $sum: { $size: { $ifNull: ["$skills", []] } } },
        skillsKnown: {
          $sum: {
            $cond: [{ $in: [{ $type: "$skills" }, ["missing", "null"]] }, 0, 1],
          },
        },
      },
    },
  ];
}

export function buildByModelPipeline(
  range: Range,
  now = new Date()
): Record<string, unknown>[] {
  return [
    rangeMatch(range, now),
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

export function buildByProjectPipeline(
  range: Range,
  now = new Date()
): Record<string, unknown>[] {
  return [
    rangeMatch(range, now),
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

export function buildByHarnessPipeline(
  range: Range,
  now = new Date()
): Record<string, unknown>[] {
  return [
    rangeMatch(range, now),
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

export function buildTimeSeriesByModelPipeline(
  range: Range,
  now = new Date(),
  timeZone = "UTC"
): Record<string, unknown>[] {
  const interval = getBucketInterval(range);

  return [
    rangeMatch(range, now),
    {
      $group: {
        _id: {
          bucket: {
            $dateTrunc: {
              date: "$recorded_at",
              unit: interval.unit,
              binSize: interval.binSize,
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

export async function fetchTotals(
  collection: Collection,
  range: Range,
  now = new Date()
): Promise<Totals> {
  const result = await collection
    .aggregate(buildTotalsPipeline(range, now))
    .toArray();
  const first = result[0] as TotalsRow | undefined;
  return {
    costYuan: first?.costYuan ?? 0,
    totalTokens: first?.totalTokens ?? 0,
    promptTokens: first?.promptTokens ?? 0,
    completionTokens: first?.completionTokens ?? 0,
    cacheHitTokens: first?.cacheHitTokens ?? 0,
    cacheMissTokens: first?.cacheMissTokens ?? 0,
    // Null when no record carries the field; a partial sum over the records
    // that do carry it is shown as-is.
    toolCalls: first && first.toolCallsKnown > 0 ? first.toolCalls : null,
    skillInvocations:
      first && first.skillsKnown > 0 ? first.skillInvocations : null,
  };
}

export async function fetchByModel(
  collection: Collection,
  range: Range,
  now = new Date()
): Promise<ByModel[]> {
  const result = (await collection
    .aggregate(buildByModelPipeline(range, now))
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
  collection: Collection,
  range: Range,
  now = new Date()
): Promise<ByProject[]> {
  const result = (await collection
    .aggregate(buildByProjectPipeline(range, now))
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
  collection: Collection,
  range: Range,
  now = new Date()
): Promise<ByHarness[]> {
  const result = (await collection
    .aggregate(buildByHarnessPipeline(range, now))
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
