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
  it("sums mouse fields", () => {
    const pipeline = buildTotalsPipeline();
    expect(pipeline).toEqual([
      {
        $group: {
          _id: null,
          leftClicks: { $sum: "$mouse.leftClicks" },
          rightClicks: { $sum: "$mouse.rightClicks" },
          movementMeters: { $sum: "$mouse.movementMeters" },
        },
      },
    ]);
  });
});

describe("buildKeyCountsPipeline", () => {
  it("unwinds keys and sums per label", () => {
    const pipeline = buildKeyCountsPipeline();
    expect(pipeline).toEqual([
      { $project: { keysArray: { $objectToArray: "$keys" } } },
      { $unwind: "$keysArray" },
      {
        $group: {
          _id: "$keysArray.k",
          count: { $sum: "$keysArray.v" },
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
      $dateTrunc: { date: "$createdAt", unit: "hour", binSize: 1 },
    });
    expect(groupStage.$group.leftClicks).toEqual({ $sum: "$mouse.leftClicks" });
    expect(groupStage.$group.rightClicks).toEqual({ $sum: "$mouse.rightClicks" });
    expect(groupStage.$group.movementMeters).toEqual({ $sum: "$mouse.movementMeters" });

    expect(pipeline[pipeline.length - 1]).toEqual({ $sort: { _id: 1 } });
  });

  it("uses startOfWeek monday for 1y weekly buckets", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const pipeline = buildTimeSeriesPipeline("1y", now);

    const groupStage = pipeline[1] as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toEqual({
      $dateTrunc: {
        date: "$createdAt",
        unit: "week",
        binSize: 1,
        startOfWeek: "monday",
      },
    });
  });
});

describe("fetchTotals", () => {
  it("returns totals from the aggregation result", async () => {
    const collection = makeMockCollection([
      { leftClicks: 10, rightClicks: 2, movementMeters: 1.5 },
    ]);
    const result = await fetchTotals(collection);
    expect(result).toEqual({
      leftClicks: 10,
      rightClicks: 2,
      movementMeters: 1.5,
    });
  });

  it("returns zeros when collection is empty", async () => {
    const collection = makeMockCollection([]);
    const result = await fetchTotals(collection);
    expect(result).toEqual({
      leftClicks: 0,
      rightClicks: 0,
      movementMeters: 0,
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

  it("produces 25 hourly buckets for 24h including the current hour", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const buckets = generateBuckets("24h", now);
    expect(buckets.length).toBe(25);
    expect(buckets[0]).toBe("2026-08-08T12:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T12:00:00.000Z");
  });

  it("produces 29 six-hour buckets for 7d aligned to 6-hour boundaries", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = generateBuckets("7d", now);
    expect(buckets.length).toBe(29);
    expect(buckets[0]).toBe("2026-08-02T12:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-09T12:00:00.000Z");
  });

  it("produces weekly buckets for 1y aligned to Monday UTC", () => {
    const now = new Date("2026-08-09T14:30:00.000Z");
    const buckets = generateBuckets("1y", now);
    expect(buckets.length).toBe(53);
    expect(buckets[0]).toBe("2025-08-04T00:00:00.000Z");
    expect(buckets[buckets.length - 1]).toBe("2026-08-03T00:00:00.000Z");
    expect(new Date(buckets[0]).getUTCDay()).toBe(1);
    expect(new Date(buckets[buckets.length - 1]).getUTCDay()).toBe(1);
  });
});
