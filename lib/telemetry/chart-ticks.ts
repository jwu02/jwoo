import { TelemetryRange } from "./types";

export function getTicksForRange(
  buckets: string[],
  range: TelemetryRange
): string[] {
  if (buckets.length === 0) return [];

  switch (range) {
    case "24h": {
      // 30-minute buckets; label the :00 bucket of every 3rd hour.
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCMinutes() === 0 && date.getUTCHours() % 3 === 0;
      });
    }
    case "7d": {
      // Hourly buckets; label once per day at midnight.
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() === 0;
      });
    }
    case "1y": {
      // Daily buckets; label the first bucket of each month (the 1st).
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
