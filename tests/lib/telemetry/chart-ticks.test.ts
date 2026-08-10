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

  it("returns all monthly buckets for 1y", () => {
    const buckets = Array.from({ length: 13 }, (_, i) =>
      new Date(Date.UTC(2025, 7 + i, 1)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "1y");

    expect(ticks).toEqual(buckets);
  });

  it("returns an empty array when no buckets are provided", () => {
    expect(getTicksForRange([], "24h")).toEqual([]);
    expect(getTicksForRange([], "7d")).toEqual([]);
    expect(getTicksForRange([], "1y")).toEqual([]);
  });
});
