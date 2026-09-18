/**
 * The range every dashboard offers: how far back a view looks.
 *
 * The type and the lookback start are shared, but the bucket interval is not —
 * each dashboard declares its own, so telemetry's 24h can bucket every 30
 * minutes while AI usage buckets hourly without either change touching the
 * other. `getBucketInterval` here is activity telemetry's.
 */
export type Range = "24h" | "30d" | "1y";

export interface RangeConfig {
  unit: "minute" | "hour" | "day" | "week" | "month";
  binSize: number;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRangeStart(range: Range, now = new Date()): Date {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - MILLISECONDS_PER_DAY);
    case "30d":
      return new Date(now.getTime() - 30 * MILLISECONDS_PER_DAY);
    case "1y":
      return new Date(now.getTime() - 365 * MILLISECONDS_PER_DAY);
  }
}

export function getBucketInterval(range: Range): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "minute", binSize: 30 };
    case "30d":
      return { unit: "day", binSize: 1 };
    case "1y":
      return { unit: "month", binSize: 1 };
  }
}
