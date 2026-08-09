import { TelemetryRange } from "./types";

export interface RangeConfig {
  unit: "hour" | "day" | "week";
  binSize: number;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRangeStart(range: TelemetryRange, now = new Date()): Date {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - MILLISECONDS_PER_DAY);
    case "7d":
      return new Date(now.getTime() - 7 * MILLISECONDS_PER_DAY);
    case "30d":
      return new Date(now.getTime() - 30 * MILLISECONDS_PER_DAY);
    case "1y":
      return new Date(now.getTime() - 365 * MILLISECONDS_PER_DAY);
  }
}

export function getBucketInterval(range: TelemetryRange): RangeConfig {
  switch (range) {
    case "24h":
      return { unit: "hour", binSize: 1 };
    case "7d":
      return { unit: "hour", binSize: 6 };
    case "30d":
      return { unit: "day", binSize: 1 };
    case "1y":
      return { unit: "week", binSize: 1 };
  }
}
