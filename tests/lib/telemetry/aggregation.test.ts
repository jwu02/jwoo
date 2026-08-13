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

  it("uses daily truncation for 1y buckets", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const pipeline = buildTimeSeriesPipeline("1y", now);

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: { date: "$createdAt", unit: "day", binSize: 1 },
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

    expect(result.length).toBe(generateBuckets("24h", now).length);
    expect(result.every((p) => typeof p.leftClicks === "number")).toBe(true);
  });
});

describe("generateBuckets", () => {
  it("includes the current in-progress bucket", () => {
    const now = new Date("2026-08-09T17:28:00.000Z");
    const buckets = generateBuckets("24h", now);
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T17:00:00.000Z");
  });

  it("produces 49 thirty-minute buckets for 24h including the current half hour", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const buckets = generateBuckets("24h", now);
    expect(buckets.length).toBe(49);
    expect(buckets[0]).toBe("2026-08-08T12:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T12:00:00.000Z");
    buckets.forEach((bucket) => {
      const date = new Date(bucket);
      expect(date.getUTCMinutes() % 30).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });

  it("produces 169 hourly buckets for 7d aligned to the hour", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = generateBuckets("7d", now);
    expect(buckets.length).toBe(169);
    expect(buckets[0]).toBe("2026-08-02T14:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T14:00:00.000Z");
    buckets.forEach((bucket) => {
      const date = new Date(bucket);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });

  it("produces daily buckets for 1y aligned to UTC midnight", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = generateBuckets("1y", now);

    expect(buckets.length).toBe(366);
    expect(buckets[0]).toBe("2025-08-09T00:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T00:00:00.000Z");
    buckets.forEach((bucket) => {
      const date = new Date(bucket);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });
});
