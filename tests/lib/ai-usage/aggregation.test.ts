import {
  buildTotalsPipeline,
  buildByModelPipeline,
  buildByProjectPipeline,
  buildByHarnessPipeline,
  buildTimeSeriesByModelPipeline,
  fetchTotals,
  fetchByModel,
  fetchByProject,
  fetchByHarness,
  fetchTimeSeriesByModel,
} from "@/lib/ai-usage/aggregation";
import { getBucketInterval } from "@/lib/ai-usage/ranges";
import { getRangeStart, Range } from "@/lib/ranges";
import { generateBuckets } from "@/lib/timezone";
import { Collection } from "mongodb";

function aiUsageBuckets(range: Range, now: Date): string[] {
  return generateBuckets(getRangeStart(range, now), getBucketInterval(range), now);
}

function makeMockCollection(aggregateResult: unknown[] = []): Collection {
  return {
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(aggregateResult),
    }),
  } as unknown as Collection;
}

describe("AI usage bucket generation", () => {
  it("produces 31 daily buckets for 30d aligned to UTC midnight", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = aiUsageBuckets("30d", now);

    expect(buckets.length).toBe(31);
    expect(buckets[0]).toBe("2026-07-10T00:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T00:00:00.000Z");
    buckets.forEach((bucket) => {
      const date = new Date(bucket);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });

  it("produces 13 monthly buckets for 1y aligned to the first of the month", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = aiUsageBuckets("1y", now);

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
});

describe("buildTotalsPipeline", () => {
  it("matches the range then sums ai_usage fields", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildTotalsPipeline("24h", now);
    expect(pipeline).toEqual([
      { $match: { recorded_at: { $gte: new Date("2026-08-17T12:00:00.000Z") } } },
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
              $cond: [
                { $in: [{ $type: "$skills" }, ["missing", "null"]] },
                0,
                1,
              ],
            },
          },
        },
      },
    ]);
  });
});

describe("buildByModelPipeline", () => {
  it("matches the range, groups by model and sorts by cost descending, model name as tie-break", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildByModelPipeline("24h", now);
    expect(pipeline).toEqual([
      { $match: { recorded_at: { $gte: new Date("2026-08-17T12:00:00.000Z") } } },
      {
        $group: {
          _id: "$model",
          costYuan: { $sum: "$cost_yuan" },
          totalTokens: { $sum: "$total_tokens" },
        },
      },
      { $sort: { costYuan: -1, model: 1 } },
    ]);
  });
});

describe("buildByProjectPipeline", () => {
  it("matches the range, groups by cwd and sorts by cost descending, cwd as tie-break", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildByProjectPipeline("24h", now);
    expect(pipeline).toEqual([
      { $match: { recorded_at: { $gte: new Date("2026-08-17T12:00:00.000Z") } } },
      {
        $group: {
          _id: "$cwd",
          costYuan: { $sum: "$cost_yuan" },
          totalTokens: { $sum: "$total_tokens" },
        },
      },
      { $sort: { costYuan: -1, _id: 1 } },
    ]);
  });
});

describe("buildByHarnessPipeline", () => {
  it("matches the range, groups by harness and sorts by cost descending, harness name as tie-break", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildByHarnessPipeline("24h", now);
    expect(pipeline).toEqual([
      { $match: { recorded_at: { $gte: new Date("2026-08-17T12:00:00.000Z") } } },
      {
        $group: {
          _id: "$harness",
          costYuan: { $sum: "$cost_yuan" },
          totalTokens: { $sum: "$total_tokens" },
        },
      },
      { $sort: { costYuan: -1, _id: 1 } },
    ]);
  });
});

describe("buildTimeSeriesByModelPipeline", () => {
  it("groups by bucket and model, summing cost and tokens", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildTimeSeriesByModelPipeline("24h", now);

    expect(pipeline[0]).toEqual({
      $match: { recorded_at: { $gte: new Date("2026-08-17T12:00:00.000Z") } },
    });

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      bucket: {
        $dateTrunc: { date: "$recorded_at", unit: "hour", binSize: 1 },
      },
      model: "$model",
    });
    expect(groupStage.$group.costYuan).toEqual({ $sum: "$cost_yuan" });
    expect(groupStage.$group.totalTokens).toEqual({ $sum: "$total_tokens" });

    expect(pipeline[pipeline.length - 1]).toEqual({
      $sort: { "_id.bucket": 1 },
    });
  });
});

describe("fetchTotals", () => {
  it("returns totals from the aggregation result", async () => {
    const collection = makeMockCollection([
      {
        _id: null,
        costYuan: 0.5,
        totalTokens: 100,
        promptTokens: 90,
        completionTokens: 10,
        cacheHitTokens: 60,
        cacheMissTokens: 40,
        toolCalls: 7,
        toolCallsKnown: 2,
        skillInvocations: 3,
        skillsKnown: 1,
      },
    ]);
    const result = await fetchTotals(collection, "24h");
    expect(result).toEqual({
      costYuan: 0.5,
      totalTokens: 100,
      promptTokens: 90,
      completionTokens: 10,
      cacheHitTokens: 60,
      cacheMissTokens: 40,
      toolCalls: 7,
      skillInvocations: 3,
    });
  });

  it("returns zeroed tokens and unknown counts when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchTotals(collection, "24h");
    expect(result).toEqual({
      costYuan: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      toolCalls: null,
      skillInvocations: null,
    });
  });

  it("returns null counts when no record carries the fields", async () => {
    const collection = makeMockCollection([
      {
        _id: null,
        costYuan: 0.5,
        totalTokens: 100,
        promptTokens: 90,
        completionTokens: 10,
        cacheHitTokens: 60,
        cacheMissTokens: 40,
        toolCalls: 0,
        toolCallsKnown: 0,
        skillInvocations: 0,
        skillsKnown: 0,
      },
    ]);
    const result = await fetchTotals(collection, "24h");
    expect(result.toolCalls).toBeNull();
    expect(result.skillInvocations).toBeNull();
  });

  it("shows a partial sum once any record carries the field", async () => {
    const collection = makeMockCollection([
      {
        _id: null,
        costYuan: 0.5,
        totalTokens: 100,
        promptTokens: 90,
        completionTokens: 10,
        cacheHitTokens: 60,
        cacheMissTokens: 40,
        toolCalls: 7,
        toolCallsKnown: 1,
        skillInvocations: 0,
        skillsKnown: 1,
      },
    ]);
    const result = await fetchTotals(collection, "24h");
    expect(result.toolCalls).toBe(7);
    expect(result.skillInvocations).toBe(0);
  });
});

describe("fetchByModel", () => {
  it("returns model rows", async () => {
    const collection = makeMockCollection([
      {
        _id: "deepseek-v4-flash",
        costYuan: 0.5,
        totalTokens: 100,
      },
    ]);
    const result = await fetchByModel(collection, "24h");
    expect(result).toEqual([
      {
        model: "deepseek-v4-flash",
        costYuan: 0.5,
        totalTokens: 100,
      },
    ]);
  });

  it("returns empty array when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchByModel(collection, "24h");
    expect(result).toEqual([]);
  });
});

describe("fetchByProject", () => {
  it("aggregates cwds into mapping groups and Others", async () => {
    const collection = makeMockCollection([
      {
        _id: "/Users/jwu02/Developer/KamKiu/training-management-system",
        costYuan: 0.5,
        totalTokens: 100,
      },
      {
        _id: "/Users/jwu02/Developer/KamKiu/training-management-system/backend",
        costYuan: 0.2,
        totalTokens: 50,
      },
      {
        _id: "/Users/jwu02/Developer/PersonalProjects/personal-website",
        costYuan: 0.3,
        totalTokens: 60,
      },
      {
        _id: "/Users/jwu02/Developer/PersonalProjects/personal-website/activity-telemetry-client",
        costYuan: 0.1,
        totalTokens: 20,
      },
      {
        _id: "/Users/jwu02/Developer/PersonalProjects/personal-website/jwoo",
        costYuan: 0.15,
        totalTokens: 30,
      },
      {
        // Lives under a kamkiu path but must bucket into its own group, not "work".
        _id: "/Users/jwu02/Developer/kamkiu/report-generator",
        costYuan: 0.4,
        totalTokens: 80,
      },
      {
        // A generic kamkiu project with no specific mapping stays in "work".
        _id: "/Users/jwu02/Developer/kamkiu/backend",
        costYuan: 0.1,
        totalTokens: 25,
      },
      {
        _id: "/private/tmp/claude-sandbox-42",
        costYuan: 0.2,
        totalTokens: 40,
      },
      { _id: null, costYuan: 0.05, totalTokens: 10 },
    ]);
    const result = await fetchByProject(collection, "24h");
    expect(result).toEqual([
      {
        project: "training-management-system",
        costYuan: 0.7,
        totalTokens: 150,
      },
      {
        project: "personal-website",
        costYuan: 0.55,
        totalTokens: 110,
      },
      {
        project: "report-generator",
        costYuan: 0.4,
        totalTokens: 80,
      },
      {
        project: "Others",
        costYuan: 0.25,
        totalTokens: 50,
      },
      {
        project: "work",
        costYuan: 0.1,
        totalTokens: 25,
      },
    ]);
  });

  it("returns empty array when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchByProject(collection, "24h");
    expect(result).toEqual([]);
  });
});

describe("fetchByHarness", () => {
  it("returns harness rows, labeling missing harness as unknown", async () => {
    const collection = makeMockCollection([
      {
        _id: "claude-code",
        costYuan: 0.5,
        totalTokens: 100,
      },
      {
        _id: null,
        costYuan: 0.2,
        totalTokens: 40,
      },
    ]);
    const result = await fetchByHarness(collection, "24h");
    expect(result).toEqual([
      {
        harness: "claude-code",
        costYuan: 0.5,
        totalTokens: 100,
      },
      {
        harness: "unknown",
        costYuan: 0.2,
        totalTokens: 40,
      },
    ]);
  });

  it("returns empty array when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchByHarness(collection, "24h");
    expect(result).toEqual([]);
  });
});

describe("fetchTimeSeriesByModel", () => {
  it("maps per-model aggregation results into zero-filled buckets", async () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const bucket1 = new Date("2026-08-18T10:00:00.000Z");
    const bucket2 = new Date("2026-08-18T11:00:00.000Z");
    const collection = makeMockCollection([
      {
        _id: { bucket: bucket1, model: "model-b" },
        costYuan: 0.5,
        totalTokens: 500,
      },
      {
        _id: { bucket: bucket1, model: "model-a" },
        costYuan: 0.25,
        totalTokens: 250,
      },
      {
        _id: { bucket: bucket2, model: "model-b" },
        costYuan: 0.75,
        totalTokens: 750,
      },
    ]);

    const result = await fetchTimeSeriesByModel(collection, "24h", now);

    // Higher total cost first, matching the by-model table order.
    expect(result.map((series) => series.model)).toEqual([
      "model-b",
      "model-a",
    ]);

    const modelB = result.find((series) => series.model === "model-b")!;
    const modelA = result.find((series) => series.model === "model-a")!;

    expect(modelA.points.length).toBe(aiUsageBuckets("24h", now).length);
    expect(modelB.points.length).toBe(aiUsageBuckets("24h", now).length);

    expect(
      modelB.points.find((p) => p.bucket === bucket1.toISOString())
    ).toEqual({ bucket: bucket1.toISOString(), costYuan: 0.5, totalTokens: 500 });
    expect(
      modelB.points.find((p) => p.bucket === bucket2.toISOString())
    ).toEqual({ bucket: bucket2.toISOString(), costYuan: 0.75, totalTokens: 750 });
    expect(
      modelA.points.find((p) => p.bucket === bucket1.toISOString())
    ).toEqual({ bucket: bucket1.toISOString(), costYuan: 0.25, totalTokens: 250 });

    // A bucket the model was absent from is filled with zeros, not skipped.
    expect(
      modelA.points.find((p) => p.bucket === bucket2.toISOString())
    ).toEqual({ bucket: bucket2.toISOString(), costYuan: 0, totalTokens: 0 });
  });

  it("returns an empty array when collection is empty", async () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const collection = makeMockCollection([]);
    const result = await fetchTimeSeriesByModel(collection, "24h", now);
    expect(result).toEqual([]);
  });
});

describe("timezone-aware bucketing", () => {
  // The 30d chart must end at the viewer's current local day. At Sunday 02:18
  // in Asia/Shanghai, UTC is still Saturday 18:18, so UTC-aligned buckets stop
  // at Saturday and today's early-morning activity lands in yesterday's bucket.
  // Non-zero milliseconds exercise the offset rounding bug that used to leak
  // them into every bucket key and blank the charts.
  const now = new Date("2026-08-22T18:18:16.987Z");

  it("ends AI usage 30d buckets at the current local day", () => {
    const buckets = generateBuckets(
      getRangeStart("30d", now),
      getBucketInterval("30d"),
      now,
      "Asia/Shanghai"
    );
    expect(buckets.length).toBe(31);
    expect(buckets[buckets.length - 1]).toBe("2026-08-22T16:00:00.000Z");
  });


  it("keeps AI usage 1y monthly buckets aligned to local months and includes the current month", () => {
    const august = new Date("2026-08-23T02:00:00.000Z");
    const buckets = generateBuckets(
      getRangeStart("1y", august),
      getBucketInterval("1y"),
      august,
      "Asia/Shanghai"
    );

    expect(buckets.length).toBe(13);
    expect(buckets[buckets.length - 1]).toBe("2026-07-31T16:00:00.000Z");
    expect(buckets[0]).toBe("2025-07-31T16:00:00.000Z");
  });

  it("passes the timezone to AI usage $dateTrunc (per-model series)", () => {
    const pipeline = buildTimeSeriesByModelPipeline(
      "30d",
      now,
      "Asia/Shanghai"
    );
    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      bucket: {
        $dateTrunc: {
          date: "$recorded_at",
          unit: "day",
          binSize: 1,
          timezone: "Asia/Shanghai",
        },
      },
      model: "$model",
    });
  });

  it("aligns per-model AI usage points to the viewer timezone", async () => {
    const sundayBucket = new Date("2026-08-22T16:00:00.000Z");
    const collection = makeMockCollection([
      {
        _id: { bucket: sundayBucket, model: "model-a" },
        costYuan: 0.5,
        totalTokens: 500,
      },
    ]);
    const result = await fetchTimeSeriesByModel(
      collection,
      "30d",
      now,
      "Asia/Shanghai"
    );
    const modelA = result.find((series) => series.model === "model-a")!;
    expect(modelA.points[modelA.points.length - 1].bucket).toBe(
      "2026-08-22T16:00:00.000Z"
    );
  });
});
