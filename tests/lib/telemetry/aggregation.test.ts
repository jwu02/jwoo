import {
  buildTotalsPipeline,
  buildKeyCountsPipeline,
  buildTimeSeriesPipeline,
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
  generateBuckets,
  buildAiUsageTotalsPipeline,
  buildAiUsageByModelPipeline,
  buildAiUsageByProjectPipeline,
  buildAiUsageByHarnessPipeline,
  buildAiUsageTimeSeriesPipeline,
  buildAiUsageTimeSeriesByModelPipeline,
  fetchAiUsageTotals,
  fetchAiUsageByModel,
  fetchAiUsageByProject,
  fetchAiUsageByHarness,
  findProjectGroup,
  fetchAiUsageTimeSeries,
  fetchAiUsageTimeSeriesByModel,
} from "@/lib/telemetry/aggregation";
import {
  getRangeStart,
  getBucketInterval,
  getAiUsageRangeStart,
  getAiUsageBucketInterval,
} from "@/lib/telemetry/ranges";
import { AiUsageRange, TelemetryRange } from "@/lib/telemetry/types";
import { Collection } from "mongodb";

function telemetryBuckets(range: TelemetryRange, now: Date): string[] {
  return generateBuckets(
    getRangeStart(range, now),
    getBucketInterval(range),
    now
  );
}

function aiUsageBuckets(range: AiUsageRange, now: Date): string[] {
  return generateBuckets(
    getAiUsageRangeStart(range, now),
    getAiUsageBucketInterval(range),
    now
  );
}

function makeMockCollection(aggregateResult: unknown[] = []): Collection {
  return {
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(aggregateResult),
    }),
  } as unknown as Collection;
}

describe("buildTotalsPipeline", () => {
  it("sums top-level telemetry fields", () => {
    const pipeline = buildTotalsPipeline();
    expect(pipeline).toEqual([
      {
        $group: {
          _id: null,
          leftClicks: { $sum: "$leftClicks" },
          rightClicks: { $sum: "$rightClicks" },
          movementMeters: { $sum: "$movementMeters" },
          totalKeyPresses: { $sum: "$keysPressed" },
        },
      },
    ]);
  });
});

describe("buildKeyCountsPipeline", () => {
  it("unwinds top-level keyboard_heatmap fields and sums per label", () => {
    const pipeline = buildKeyCountsPipeline();
    expect(pipeline).toEqual([
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
      $dateTrunc: { date: "$createdAt", unit: "minute", binSize: 30 },
    });
    expect(groupStage.$group.leftClicks).toEqual({ $sum: "$leftClicks" });
    expect(groupStage.$group.rightClicks).toEqual({ $sum: "$rightClicks" });
    expect(groupStage.$group.movementMeters).toEqual({ $sum: "$movementMeters" });
    expect(groupStage.$group.keyPresses).toEqual({ $sum: "$keysPressed" });

    expect(pipeline[pipeline.length - 1]).toEqual({ $sort: { _id: 1 } });
  });

  it("uses monthly truncation for 1y buckets", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const pipeline = buildTimeSeriesPipeline("1y", now);

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: { date: "$createdAt", unit: "month", binSize: 1 },
    });
  });
});

describe("fetchTotals", () => {
  it("returns totals from the aggregation result", async () => {
    const collection = makeMockCollection([
      { leftClicks: 10, rightClicks: 2, movementMeters: 1.5, totalKeyPresses: 25 },
    ]);
    const result = await fetchTotals(collection);
    expect(result).toEqual({
      leftClicks: 10,
      rightClicks: 2,
      movementMeters: 1.5,
      totalKeyPresses: 25,
    });
  });

  it("returns zeros when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchTotals(collection);
    expect(result).toEqual({
      leftClicks: 0,
      rightClicks: 0,
      movementMeters: 0,
      totalKeyPresses: 0,
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

    expect(result.length).toBe(telemetryBuckets("24h", now).length);
    expect(result.every((p) => typeof p.leftClicks === "number")).toBe(true);
  });
});

describe("generateBuckets", () => {
  it("includes the current in-progress bucket", () => {
    const now = new Date("2026-08-09T17:28:00.000Z");
    const buckets = telemetryBuckets("24h", now);
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T17:00:00.000Z");
  });

  it("produces 49 thirty-minute buckets for 24h including the current half hour", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const buckets = telemetryBuckets("24h", now);
    expect(buckets.length).toBe(49);
    expect(buckets[0]).toBe("2026-08-08T12:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T12:00:00.000Z");
    buckets.forEach((bucket) => {
      const date = new Date(bucket);
      expect(date.getUTCMinutes() % 30).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });

  it("produces 31 daily buckets for 30d aligned to UTC midnight", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = telemetryBuckets("30d", now);
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

  it("produces monthly buckets for 1y aligned to the first of the month", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = telemetryBuckets("1y", now);

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

describe("buildAiUsageTotalsPipeline", () => {
  it("sums ai_usage fields", () => {
    const pipeline = buildAiUsageTotalsPipeline();
    expect(pipeline).toEqual([
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
    ]);
  });
});

describe("buildAiUsageByModelPipeline", () => {
  it("groups by model and sorts by cost descending, model name as tie-break", () => {
    const pipeline = buildAiUsageByModelPipeline();
    expect(pipeline).toEqual([
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

describe("buildAiUsageByProjectPipeline", () => {
  it("groups by cwd and sorts by cost descending, cwd as tie-break", () => {
    const pipeline = buildAiUsageByProjectPipeline();
    expect(pipeline).toEqual([
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

describe("buildAiUsageByHarnessPipeline", () => {
  it("groups by harness and sorts by cost descending, harness name as tie-break", () => {
    const pipeline = buildAiUsageByHarnessPipeline();
    expect(pipeline).toEqual([
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

describe("buildAiUsageTimeSeriesPipeline", () => {
  it("matches on recorded_at, buckets, and sums for 24h", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildAiUsageTimeSeriesPipeline("24h", now);

    expect(pipeline[0]).toEqual({
      $match: { recorded_at: { $gte: new Date("2026-08-17T12:00:00.000Z") } },
    });

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: { date: "$recorded_at", unit: "hour", binSize: 1 },
    });
    expect(groupStage.$group.costYuan).toEqual({ $sum: "$cost_yuan" });
    expect(groupStage.$group.promptTokens).toEqual({ $sum: "$prompt_tokens" });
    expect(groupStage.$group.completionTokens).toEqual({
      $sum: "$completion_tokens",
    });
    expect(groupStage.$group.totalTokens).toEqual({ $sum: "$total_tokens" });

    expect(pipeline[pipeline.length - 1]).toEqual({ $sort: { _id: 1 } });
  });

  it("matches on recorded_at and uses daily truncation for 30d buckets", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildAiUsageTimeSeriesPipeline("30d", now);

    expect(pipeline[0]).toEqual({
      $match: { recorded_at: { $gte: new Date("2026-07-19T12:00:00.000Z") } },
    });

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: { date: "$recorded_at", unit: "day", binSize: 1 },
    });
  });

  it("uses monthly truncation for 1y buckets", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildAiUsageTimeSeriesPipeline("1y", now);

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: { date: "$recorded_at", unit: "month", binSize: 1 },
    });
  });
});

describe("buildAiUsageTimeSeriesByModelPipeline", () => {
  it("groups by bucket and model, summing cost and tokens", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const pipeline = buildAiUsageTimeSeriesByModelPipeline("24h", now);

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

describe("fetchAiUsageTotals", () => {
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
      },
    ]);
    const result = await fetchAiUsageTotals(collection);
    expect(result).toEqual({
      costYuan: 0.5,
      totalTokens: 100,
      promptTokens: 90,
      completionTokens: 10,
      cacheHitTokens: 60,
      cacheMissTokens: 40,
    });
  });

  it("returns zeros when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchAiUsageTotals(collection);
    expect(result).toEqual({
      costYuan: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
    });
  });
});

describe("fetchAiUsageByModel", () => {
  it("returns model rows", async () => {
    const collection = makeMockCollection([
      {
        _id: "deepseek-v4-flash",
        costYuan: 0.5,
        totalTokens: 100,
      },
    ]);
    const result = await fetchAiUsageByModel(collection);
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
    const result = await fetchAiUsageByModel(collection);
    expect(result).toEqual([]);
  });
});

describe("fetchAiUsageByProject", () => {
  it("aggregates cwds into mapping groups and others", async () => {
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
    const result = await fetchAiUsageByProject(collection);
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
        project: "others",
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
    const result = await fetchAiUsageByProject(collection);
    expect(result).toEqual([]);
  });
});

describe("fetchAiUsageByHarness", () => {
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
    const result = await fetchAiUsageByHarness(collection);
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
    const result = await fetchAiUsageByHarness(collection);
    expect(result).toEqual([]);
  });
});

describe("findProjectGroup", () => {
  it("matches a cwd substring case-insensitively", () => {
    expect(findProjectGroup("/Users/jwu02/Developer/kamkiu/backend")).toBe(
      "work"
    );
    expect(findProjectGroup("/Users/jwu02/Developer/KAMKIU/x")).toBe("work");
  });

  it("maps training-management-system to its own group even when the cwd also contains kamkiu", () => {
    expect(
      findProjectGroup(
        "/Users/jwu02/Developer/KamKiu/training-management-system"
      )
    ).toBe("training-management-system");
  });

  it("maps report-generator to its own group even when the cwd also contains kamkiu", () => {
    // report-generator lives under a kamkiu path, so its key must be checked
    // before the broader "kamkiu" substring or it would bucket into "work".
    expect(
      findProjectGroup("/Users/jwu02/Developer/kamkiu/report-generator")
    ).toBe("report-generator");
    expect(
      findProjectGroup("/Users/jwu02/Developer/kamkiu/backend")
    ).toBe("work");
  });

  it("maps assessment-management-system to its own group", () => {
    expect(
      findProjectGroup(
        "/Users/jwu02/Developer/PersonalProjects/assessment-management-system"
      )
    ).toBe("assessment-management-system");
  });

  it("maps the dashboard and its siblings to the personal-website group", () => {
    expect(
      findProjectGroup(
        "/Users/jwu02/Developer/PersonalProjects/personal-website/jwoo"
      )
    ).toBe("personal-website");
    expect(
      findProjectGroup(
        "/Users/jwu02/Developer/PersonalProjects/personal-website/activity-telemetry-client"
      )
    ).toBe("personal-website");
  });

  it("returns null when no substring matches", () => {
    expect(findProjectGroup("/private/tmp/claude-sandbox-42")).toBeNull();
    expect(findProjectGroup("/Users/jwu02/Developer/SomeProject")).toBeNull();
  });
});

describe("fetchAiUsageTimeSeries", () => {
  it("maps aggregation results into zero-filled buckets", async () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const bucket = new Date("2026-08-18T10:00:00.000Z");
    const collection = makeMockCollection([
      {
        _id: bucket,
        costYuan: 0.25,
        promptTokens: 1000,
        completionTokens: 200,
        totalTokens: 1200,
      },
    ]);
    const result = await fetchAiUsageTimeSeries(collection, "24h", now);

    const found = result.find((p) => p.bucket === bucket.toISOString());
    expect(found).toEqual({
      bucket: bucket.toISOString(),
      costYuan: 0.25,
      promptTokens: 1000,
      completionTokens: 200,
      totalTokens: 1200,
    });

    expect(result.length).toBe(aiUsageBuckets("24h", now).length);
    expect(result.every((p) => typeof p.totalTokens === "number")).toBe(true);
  });
});

describe("fetchAiUsageTimeSeriesByModel", () => {
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

    const result = await fetchAiUsageTimeSeriesByModel(collection, "24h", now);

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
    const result = await fetchAiUsageTimeSeriesByModel(collection, "24h", now);
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

  it("ends telemetry 30d buckets at the current local day", () => {
    const buckets = generateBuckets(
      getRangeStart("30d", now),
      getBucketInterval("30d"),
      now,
      "Asia/Shanghai"
    );
    expect(buckets.length).toBe(31);
    expect(buckets[0]).toBe("2026-07-23T16:00:00.000Z"); // local Jul 24 00:00
    expect(buckets[buckets.length - 1]).toBe(
      "2026-08-22T16:00:00.000Z" // local Sun Aug 23 00:00
    );
    buckets.forEach((bucket) => {
      expect(new Date(bucket).getUTCHours()).toBe(16); // Asia/Shanghai midnight
    });
  });

  it("ends AI usage 30d buckets at the current local day", () => {
    const buckets = generateBuckets(
      getAiUsageRangeStart("30d", now),
      getAiUsageBucketInterval("30d"),
      now,
      "Asia/Shanghai"
    );
    expect(buckets.length).toBe(31);
    expect(buckets[buckets.length - 1]).toBe("2026-08-22T16:00:00.000Z");
  });

  // Month-aligned bucket keys in a +8h zone sit on the previous month's last
  // UTC day (local Aug 1 00:00 == UTC Jul 31 16:00). Advancing via setUTCMonth
  // on those keys used to roll over (Sep 30 -> Oct 1) and corrupt every
  // following bucket, ending the 1y series a month early.
  it("keeps telemetry 1y monthly buckets aligned to local months and includes the current month", () => {
    const august = new Date("2026-08-23T02:00:00.000Z"); // local Aug 23 10:00
    const buckets = generateBuckets(
      getRangeStart("1y", august),
      getBucketInterval("1y"),
      august,
      "Asia/Shanghai"
    );

    expect(buckets.length).toBe(13);
    expect(buckets[0]).toBe("2025-07-31T16:00:00.000Z"); // local Aug 1 2025
    expect(buckets[buckets.length - 1]).toBe(
      "2026-07-31T16:00:00.000Z" // local Aug 1 2026, the current month
    );

    buckets.forEach((bucket) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(bucket));
      const values = Object.fromEntries(
        parts
          .filter((p) => p.type !== "literal")
          .map((p) => [p.type, p.value])
      );
      expect(values.day).toBe("01");
      expect(values.hour).toBe("00");
      expect(values.minute).toBe("00");
    });
  });

  it("keeps AI usage 1y monthly buckets aligned to local months and includes the current month", () => {
    const august = new Date("2026-08-23T02:00:00.000Z");
    const buckets = generateBuckets(
      getAiUsageRangeStart("1y", august),
      getAiUsageBucketInterval("1y"),
      august,
      "Asia/Shanghai"
    );

    expect(buckets.length).toBe(13);
    expect(buckets[buckets.length - 1]).toBe("2026-07-31T16:00:00.000Z");
    expect(buckets[0]).toBe("2025-07-31T16:00:00.000Z");
  });

  it("passes the timezone to telemetry $dateTrunc", () => {
    const pipeline = buildTimeSeriesPipeline("30d", now, "Asia/Shanghai");
    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: {
        date: "$createdAt",
        unit: "day",
        binSize: 1,
        timezone: "Asia/Shanghai",
      },
    });
  });

  it("passes the timezone to AI usage $dateTrunc (single series)", () => {
    const pipeline = buildAiUsageTimeSeriesPipeline(
      "30d",
      now,
      "Asia/Shanghai"
    );
    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: {
        date: "$recorded_at",
        unit: "day",
        binSize: 1,
        timezone: "Asia/Shanghai",
      },
    });
  });

  it("passes the timezone to AI usage $dateTrunc (per-model series)", () => {
    const pipeline = buildAiUsageTimeSeriesByModelPipeline(
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

  it("maps telemetry aggregation results into timezone-aligned buckets", async () => {
    const sundayBucket = new Date("2026-08-22T16:00:00.000Z"); // local Sun Aug 23
    const collection = makeMockCollection([
      {
        _id: sundayBucket,
        leftClicks: 3,
        rightClicks: 0,
        movementMeters: 0.5,
        keyPresses: 9,
      },
    ]);
    const result = await fetchTimeSeries(collection, "30d", now, "Asia/Shanghai");
    expect(result[result.length - 1]).toEqual({
      bucket: sundayBucket.toISOString(),
      leftClicks: 3,
      rightClicks: 0,
      movementMeters: 0.5,
      keyPresses: 9,
    });
  });

  it("maps AI usage aggregation results into timezone-aligned buckets", async () => {
    const sundayBucket = new Date("2026-08-22T16:00:00.000Z");
    const collection = makeMockCollection([
      {
        _id: sundayBucket,
        costYuan: 0.25,
        promptTokens: 1000,
        completionTokens: 200,
        totalTokens: 1200,
      },
    ]);
    const result = await fetchAiUsageTimeSeries(
      collection,
      "30d",
      now,
      "Asia/Shanghai"
    );
    expect(result[result.length - 1]).toEqual({
      bucket: sundayBucket.toISOString(),
      costYuan: 0.25,
      promptTokens: 1000,
      completionTokens: 200,
      totalTokens: 1200,
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
    const result = await fetchAiUsageTimeSeriesByModel(
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
