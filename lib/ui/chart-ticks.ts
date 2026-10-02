import { Range } from "@/lib/ranges";

// Y-axis ticks on 1/2/5×10ᵏ steps. Recharts' default stepping lands on values
// like 0.095/0.19/0.285 whenever the data max isn't cooperative (a ¥0.38 cost
// axis), so every dashboard chart picks its ticks here instead: 0 up to the
// next clean value at or above the data max, at roughly the default density.
export function getNiceYTicks(maxValue: number): {
  ticks: number[];
  max: number;
} {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { ticks: [0, 1], max: 1 };
  }

  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  // Rounding the step up (not to nearest) keeps the count at roughly five or
  // fewer while the ceiling stays within one step of the data max. The 2.5
  // rung matters: without it a max near 900 has fraction 2.25, jumps to a step
  // of 5, and collapses the axis to two gaps (0/500/1000).
  const step =
    ([1, 2, 2.5, 5, 10].find((candidate) => fraction <= candidate) ?? 10) *
    magnitude;

  const count = Math.ceil(maxValue / step);
  // `toPrecision` clears the float error a running sum would accumulate
  // (3 × 0.1 → 0.30000000000000004 → 0.3).
  const ticks = Array.from({ length: count + 1 }, (_, index) =>
    Number((index * step).toPrecision(12))
  );
  return { ticks, max: count * step };
}

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
