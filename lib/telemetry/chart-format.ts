import { Range } from "./types";

// Compact large counts to K/M: 1,200,000 → "1.2M", 550,000 → "550K".
export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${trimNumber(value / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${trimNumber(value / 1_000)}K`;
  }
  return trimNumber(value);
}

function trimNumber(value: number): string {
  return Number(value.toFixed(1)).toString();
}

export function formatTick(bucket: string, range: Range): string {
  const date = new Date(bucket);

  switch (range) {
    case "24h":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "7d":
    case "30d":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    case "1y":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
  }
}

export function formatTooltip(bucket: string, range: Range): string {
  const date = new Date(bucket);

  switch (range) {
    case "24h":
      return date.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "7d":
      return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "30d":
      // Daily buckets; no time-of-day to show.
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "1y":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  }
}
