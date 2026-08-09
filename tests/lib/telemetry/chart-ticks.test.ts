import { getTicksForRange } from "@/lib/telemetry/chart-ticks";

describe("getTicksForRange", () => {
  it("returns every third hour for 24h", () => {
    const buckets = Array.from({ length: 24 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 9, i)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "24h");

    expect(ticks).toEqual([
      buckets[0],
      buckets[3],
      buckets[6],
      buckets[9],
      buckets[12],
      buckets[15],
      buckets[18],
      buckets[21],
    ]);
  });

  it("returns only midnight buckets for 7d", () => {
    const buckets = Array.from({ length: 28 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 2, i * 6)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "7d");

    expect(ticks.length).toBe(7);
    ticks.forEach((tick) => {
      expect(new Date(tick).getUTCHours()).toBe(0);
    });
  });

  it("returns every daily bucket for 30d", () => {
    const buckets = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 1, 0, 0, 0, 0) + i * 86400000).toISOString()
    );

    const ticks = getTicksForRange(buckets, "30d");

    expect(ticks).toEqual(buckets);
  });

  it("returns the first bucket of each month for 1y", () => {
    const buckets = [
      "2025-08-04T00:00:00.000Z", // Monday
      "2025-08-11T00:00:00.000Z",
      "2025-08-18T00:00:00.000Z",
      "2025-08-25T00:00:00.000Z",
      "2025-09-01T00:00:00.000Z",
      "2025-09-08T00:00:00.000Z",
    ];

    const ticks = getTicksForRange(buckets, "1y");

    expect(ticks).toEqual([buckets[0], buckets[4]]);
  });

  it("returns an empty array when no buckets are provided", () => {
    expect(getTicksForRange([], "24h")).toEqual([]);
    expect(getTicksForRange([], "7d")).toEqual([]);
    expect(getTicksForRange([], "30d")).toEqual([]);
    expect(getTicksForRange([], "1y")).toEqual([]);
  });
});
