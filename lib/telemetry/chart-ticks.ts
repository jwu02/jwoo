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
    case "7d":
    case "30d": {
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        return date.getUTCHours() === 0;
      });
    }
    case "1y": {
      const seenMonths = new Set<string>();
      return buckets.filter((bucket) => {
        const date = new Date(bucket);
        const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
        if (seenMonths.has(monthKey)) return false;
        seenMonths.add(monthKey);
        return true;
      });
    }
  }
}

export function formatTooltipLabel(label: unknown): string {
  return new Date(String(label)).toLocaleString("en-US", {
    timeZone: "UTC",
  });
}
