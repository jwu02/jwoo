import { AiUsageRange, TelemetryRange } from "./types";

export interface RangeConfig {
  unit: "minute" | "hour" | "day" | "week" | "month";
  binSize: number;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRangeStart(range: TelemetryRange, now = new Date()): Date {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - MILLISECONDS_PER_DAY);
    case "7d":
      return new Date(now.getTime() - 7 * MILLISECONDS_PER_DAY);
    case "1y":
      return new Date(now.getTime() - 365 * MILLISECONDS_PER_DAY);
  }
}

export function getBucketInterval(range: TelemetryRange): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "minute", binSize: 30 };
    case "7d":
      return { unit: "hour", binSize: 1 };
    case "1y":
      return { unit: "day", binSize: 1 };
  }
}

// AI usage has its own chart ranges (24h / 30d / 1y). The 30d view is
// bucketed by day and the 1y view by month, which differs from the telemetry
// section (7d by hour, 1y by day).
export function getAiUsageRangeStart(
  range: AiUsageRange,
  now = new Date()
): Date {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - MILLISECONDS_PER_DAY);
    case "30d":
      return new Date(now.getTime() - 30 * MILLISECONDS_PER_DAY);
    case "1y":
      return new Date(now.getTime() - 365 * MILLISECONDS_PER_DAY);
  }
}

export function getAiUsageBucketInterval(range: AiUsageRange): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "minute", binSize: 30 };
    case "30d":
      return { unit: "day", binSize: 1 };
    case "1y":
      return { unit: "month", binSize: 1 };
  }
}
