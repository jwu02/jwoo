import { getTicksForRange } from "@/lib/telemetry/chart-ticks";

describe("getTicksForRange", () => {
  it("returns the :00 bucket every third hour for 30-minute buckets", () => {
    const buckets = Array.from({ length: 48 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 9, Math.floor(i / 2), (i % 2) * 30)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "24h");

    expect(ticks).toEqual([
      buckets[0],
      buckets[6],
      buckets[12],
      buckets[18],
      buckets[24],
      buckets[30],
      buckets[36],
      buckets[42],
    ]);
  });

  it("returns every 5th bucket for 30d daily buckets", () => {
    const buckets = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.UTC(2025, 6, 10 + i)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "30d");

    expect(ticks).toHaveLength(6);
    expect(ticks[0]).toBe(buckets[0]);
    expect(ticks[1]).toBe(buckets[5]);
    expect(ticks[5]).toBe(buckets[25]);
  });

  it("returns only midnight buckets for 7d", () => {
    const buckets = Array.from({ length: 24 * 7 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 2, i)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "7d");

    expect(ticks).toHaveLength(7);
    ticks.forEach((tick) => {
      expect(new Date(tick).getUTCHours()).toBe(0);
    });
  });

  it("returns the first bucket of each month for daily buckets", () => {
    const buckets = Array.from({ length: 366 }, (_, i) =>
      new Date(Date.UTC(2025, 7, 1 + i)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "1y");

    expect(ticks).toHaveLength(13);
    expect(ticks[0]).toBe("2025-08-01T00:00:00.000Z");
    ticks.forEach((tick) => {
      expect(new Date(tick).getUTCDate()).toBe(1);
    });
  });

  it("returns an empty array when no buckets are provided", () => {
    expect(getTicksForRange([], "24h")).toEqual([]);
    expect(getTicksForRange([], "7d")).toEqual([]);
    expect(getTicksForRange([], "30d")).toEqual([]);
    expect(getTicksForRange([], "1y")).toEqual([]);
  });
});
