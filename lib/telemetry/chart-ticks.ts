import { Range } from "./types";

export function getTicksForRange(
  buckets: string[],
  range: Range
): string[] {
  if (buckets.length === 0) return [];

  switch (range) {
    case "24h": {
      // Telemetry buckets every 30 minutes, AI usage hourly — both align on
      // the :00, so labeling the :00 bucket of every 3rd hour works for each.
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCMinutes() === 0 && date.getUTCHours() % 3 === 0;
      });
    }
    case "30d": {
      // Daily buckets; label every 5th day to keep the axis readable.
      return buckets.filter((_, index) => index % 5 === 0);
    }
    case "1y": {
      // Daily or monthly buckets; label the first bucket of each month (the
      // 1st). With monthly buckets every bucket passes, so all are labeled.
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
