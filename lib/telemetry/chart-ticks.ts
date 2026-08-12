import { TelemetryRange } from "./types";

export function getTicksForRange(
  buckets: string[],
  range: TelemetryRange
): string[] {
  if (buckets.length === 0) return [];

  switch (range) {
    case "24h": {
      // Hourly buckets; label every 3 hours.
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() % 3 === 0;
      });
    }
    case "7d": {
      // Twelve-hour buckets; label once per day at midnight.
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() === 0;
      });
    }
    case "1y": {
      // Weekly buckets; label the first bucket of each month. The first of the
      // month isn't always a bucket boundary, so pick the first bucket per month.
      const ticks: string[] = [];
      let lastMonth = -1;
      for (const bucket of buckets) {
        const date = new Date(bucket);
        const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
        if (month !== lastMonth) {
          ticks.push(bucket);
          lastMonth = month;
        }
      }
      return ticks;
    }
  }
}
