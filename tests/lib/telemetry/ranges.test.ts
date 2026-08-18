import {
  getRangeStart,
  getBucketInterval,
  getAiUsageRangeStart,
  getAiUsageBucketInterval,
} from "@/lib/telemetry/ranges";
import { AiUsageRange, TelemetryRange } from "@/lib/telemetry/types";

describe("getRangeStart", () => {
  it("returns a date 24 hours in the past for 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("24h", now);
    expect(start.toISOString()).toBe("2026-08-08T12:00:00.000Z");
  });

  it("returns a date 7 days in the past for 7d", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getRangeStart("7d", now);
    expect(start.toISOString()).toBe("2026-08-02T12:00:00.000Z");
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
    ["7d", { unit: "hour", binSize: 1 }],
    ["1y", { unit: "day", binSize: 1 }],
  ] as [TelemetryRange, { unit: string; binSize: number }][])(
    "returns the correct interval for %s",
    (range, expected) => {
      expect(getBucketInterval(range)).toEqual(expected);
    }
  );
});

describe("getAiUsageRangeStart", () => {
  it("returns a date 24 hours in the past for 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getAiUsageRangeStart("24h", now);
    expect(start.toISOString()).toBe("2026-08-08T12:00:00.000Z");
  });

  it("returns a date 30 days in the past for 30d", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getAiUsageRangeStart("30d", now);
    expect(start.toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  it("returns a date 365 days in the past for 1y", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const start = getAiUsageRangeStart("1y", now);
    expect(start.toISOString()).toBe("2025-08-09T12:00:00.000Z");
  });
});

describe("getAiUsageBucketInterval", () => {
  it.each([
    ["24h", { unit: "minute", binSize: 30 }],
    ["30d", { unit: "day", binSize: 1 }],
    ["1y", { unit: "month", binSize: 1 }],
  ] as [AiUsageRange, { unit: string; binSize: number }][])(
    "returns the correct interval for %s",
    (range, expected) => {
      expect(getAiUsageBucketInterval(range)).toEqual(expected);
    }
  );
});
