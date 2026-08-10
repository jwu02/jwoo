import { TelemetryRange } from "./types";

export function getTicksForRange(
  buckets: string[],
  range: TelemetryRange
): string[] {
  if (buckets.length === 0) return [];

  switch (range) {
    case "24h": {
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() % 3 === 0;
      });
    }
    case "7d": {
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() === 0;
      });
    }
    case "1y": {
      return buckets;
    }
  }
}
