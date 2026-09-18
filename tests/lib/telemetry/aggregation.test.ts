import {
  buildTotalsPipeline,
  buildKeyCountsPipeline,
  buildTimeSeriesPipeline,
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
} from "@/lib/telemetry/aggregation";
import { getRangeStart, getBucketInterval } from "@/lib/ranges";
import { generateBuckets } from "@/lib/timezone";
import { TelemetryRange } from "@/lib/telemetry/types";
import { Collection } from "mongodb";

function telemetryBuckets(range: TelemetryRange, now: Date): string[] {
  return generateBuckets(
    getRangeStart(range, now),
    getBucketInterval(range),
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
