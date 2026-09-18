import { getRangeStart, getBucketInterval } from "@/lib/ranges";
import { generateBuckets } from "@/lib/timezone";
import {
  buildTimeSeriesPipeline,
  fetchTimeSeries,
} from "@/lib/telemetry/aggregation";
import { Collection } from "mongodb";

function makeMockCollection(aggregateResult: unknown[] = []): Collection {
  return {
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(aggregateResult),
    }),
  } as unknown as Collection;
}

// Bucket generation is shared infrastructure: both dashboards fill their series
// from it, so it is exercised here with the activity telemetry intervals and
// with the AI-usage ones (see tests/lib/ai-usage).
function telemetryBuckets(range: "24h" | "30d" | "1y", now: Date): string[] {
  return generateBuckets(
    getRangeStart(range, now),
    getBucketInterval(range),
    now
  );
}

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

// The same alignment, driven through the activity telemetry feature: the
// pipeline's $dateTrunc and the zero-filled series both key off it.
describe("timezone-aware bucketing", () => {
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
})
