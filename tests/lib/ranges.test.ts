import {
  getRangeStart,
  getBucketInterval,
  isValidRange,
  RANGE_NAMES,
  RANGE_OPTIONS,
  Range,
} from "@/lib/ranges";

// The shared range mechanics: the offered vocabulary, the lookback start every
// dashboard reads, and the interval activity telemetry buckets by. AI usage's
// own interval sits beside its feature (tests/lib/ai-usage/ranges.test.ts).
describe("getRangeStart", () => {
  it("returns a date 24 hours in the past for 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("24h", now);
    expect(start.toISOString()).toBe("2026-08-08T12:00:00.000Z");
  });

  it("returns a date 30 days in the past for 30d", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("30d", now);
    expect(start.toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  it("returns a date 365 days in the past for 1y", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("1y", now);
    expect(start.toISOString()).toBe("2025-08-09T12:00:00.000Z");
  });
});

describe("getBucketInterval", () => {
  it.each([
    ["24h", { unit: "minute", binSize: 30 }],
    ["30d", { unit: "day", binSize: 1 }],
    ["1y", { unit: "month", binSize: 1 }],
  ] as [Range, { unit: string; binSize: number }][])(
    "returns the correct interval for %s",
    (range, expected) => {
      expect(getBucketInterval(range)).toEqual(expected);
    }
  );
});

// Both API routes validate against this list, so every offered range must pass
// the guard and the error message must name exactly the offered ones.
describe("range vocabulary", () => {
  it("accepts every offered range and rejects anything else", () => {
    for (const option of RANGE_OPTIONS) {
      expect(isValidRange(option.value)).toBe(true);
      expect(RANGE_NAMES).toContain(option.value);
    }
    expect(isValidRange("7d")).toBe(false);
    expect(isValidRange(null)).toBe(false);
  });
});
