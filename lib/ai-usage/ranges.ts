import { Range, RangeConfig } from "@/lib/ranges";

/**
 * AI usage shares the shared range type and the shared lookback start, but not
 * the bucket interval: its 24h view buckets hourly rather than in activity
 * telemetry's 30-minute bins. Keeping the interval here means either dashboard
 * can change its bucketing without touching the other.
 */
export function getBucketInterval(range: Range): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "hour", binSize: 1 };
    case "30d":
      return { unit: "day", binSize: 1 };
    case "1y":
      return { unit: "month", binSize: 1 };
  }
}

/** The ranges this dashboard offers, in selector order. */
export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "30d", label: "30d" },
  { value: "1y", label: "1y" },
];
