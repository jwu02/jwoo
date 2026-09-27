/**
 * The range every dashboard offers: how far back a view looks.
 *
 * The type, the offered list, and the lookback start are shared, but the bucket
 * interval is not — each dashboard declares its own, so telemetry's 24h can
 * bucket every 30 minutes while AI usage buckets hourly without either change
 * touching the other. `getBucketInterval` here is activity telemetry's.
 */
export type Range = "24h" | "30d" | "1y";

export interface RangeConfig {
  unit: "minute" | "hour" | "day" | "month";
  binSize: number;
}

/** The ranges every dashboard offers, in selector order. */
export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "30d", label: "30d" },
  { value: "1y", label: "1y" },
];

/** The offered ranges as one comma-separated string, for validation errors. */
export const RANGE_NAMES = RANGE_OPTIONS.map((option) => option.value).join(", ");

/** True when `value` names a range in `RANGE_OPTIONS`. */
export function isValidRange(value: string | null): value is Range {
  return RANGE_OPTIONS.some((option) => option.value === value);
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
