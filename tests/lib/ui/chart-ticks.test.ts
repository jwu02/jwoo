import { getNiceYTicks, getTicksForRange } from "@/lib/ui/chart-ticks";

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

  it("returns the :00 bucket every third hour for hourly buckets", () => {
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

  it("labels every monthly bucket for 1y", () => {
    const buckets = Array.from({ length: 13 }, (_, i) =>
      new Date(Date.UTC(2025, 7 + i)).toISOString()
    );

    const ticks = getTicksForRange(buckets, "1y");

    expect(ticks).toEqual(buckets);
  });

  it("returns an empty array when no buckets are provided", () => {
    expect(getTicksForRange([], "24h")).toEqual([]);
    expect(getTicksForRange([], "30d")).toEqual([]);
    expect(getTicksForRange([], "1y")).toEqual([]);
  });
});

describe("getNiceYTicks", () => {
  it("turns Recharts' uncooperative maxima into 1/2/5 steps", () => {
    // The reported offender: a ¥0.38 cost axis defaults to 0.095 steps.
    expect(getNiceYTicks(0.38)).toEqual({
      ticks: [0, 0.1, 0.2, 0.3, 0.4],
      max: 0.4,
    });
  });

  it("keeps roughly the default tick density", () => {
    expect(getNiceYTicks(1.8)).toEqual({
      ticks: [0, 0.5, 1, 1.5, 2],
      max: 2,
    });
    expect(getNiceYTicks(1_500_000)).toEqual({
      ticks: [0, 500_000, 1_000_000, 1_500_000],
      max: 1_500_000,
    });
  });

  it("keeps the axis dense in the gaps of the 1/2/5 ladder", () => {
    // A max just above the 2 rung: fraction 2.25 must land on 2.5, not jump
    // to 5 and leave only 0/500/1000.
    expect(getNiceYTicks(900)).toEqual({
      ticks: [0, 250, 500, 750, 1000],
      max: 1000,
    });
  });

  it("keeps a max already on a clean value as the top tick", () => {
    expect(getNiceYTicks(0.4)).toEqual({
      ticks: [0, 0.1, 0.2, 0.3, 0.4],
      max: 0.4,
    });
  });

  it("carries no float error in the tick values", () => {
    expect(getNiceYTicks(0.3).ticks).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it("falls back to a 0–1 axis when there is nothing to measure", () => {
    expect(getNiceYTicks(0)).toEqual({ ticks: [0, 1], max: 1 });
    expect(getNiceYTicks(-5)).toEqual({ ticks: [0, 1], max: 1 });
    expect(getNiceYTicks(Number.NaN)).toEqual({ ticks: [0, 1], max: 1 });
  });
});
