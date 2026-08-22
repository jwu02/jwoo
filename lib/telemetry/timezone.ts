import type { RangeConfig } from "./ranges";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Milliseconds between a UTC instant and its wall-clock time in `timeZone`.
 * Positive when the timezone is east of UTC (Asia/Shanghai = +8h = 28 800 000).
 */
export function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  if (timeZone === "UTC") return 0;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  // The wall clock in `timeZone` read as if it were UTC, minus the real UTC
  // instant, is the timezone's offset. Intl only reports whole seconds, so the
  // milliseconds must be carried over from the input or the offset comes back
  // short by that amount and leaks into every aligned bucket.
  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour % 24,
      values.minute,
      values.second,
      date.getMilliseconds()
    ) - date.getTime()
  );
}

/** True when `tz` names a timezone Intl can resolve (e.g. "Asia/Shanghai"). */
export function isValidTimeZone(
  tz: string | null | undefined
): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Floor `date` to the start of its `interval` bucket in `timeZone`, mirroring
 * MongoDB `$dateTrunc` with the same `timezone` option so the client's bucket
 * keys match the aggregation's.
 *
 * Alignment happens in the timezone's wall clock: shift the instant by its
 * UTC offset, floor the shifted (UTC-like) value, then shift back. This is
 * exact for fixed-offset zones like Asia/Shanghai; only a timezone whose
 * DST transition lands on midnight could shift a bucket by an hour, which
 * this app's fixed-offset deployment never hits.
 */
export function alignToInterval(
  date: Date,
  interval: RangeConfig,
  timeZone = "UTC"
): Date {
  const offsetMs = getTimezoneOffsetMs(date, timeZone);
  const local = new Date(date.getTime() + offsetMs);
  local.setUTCSeconds(0, 0);

  if (interval.unit === "minute") {
    // Floor to the bin boundary, anchoring at the timezone's epoch.
    local.setUTCMinutes(
      local.getUTCMinutes() - (local.getUTCMinutes() % interval.binSize)
    );
  } else {
    local.setUTCMinutes(0);
  }

  if (interval.unit === "day") {
    // binSize > 1 must anchor at the epoch (1970-01-01) to match $dateTrunc.
    const daysSinceEpoch = Math.floor(local.getTime() / MILLISECONDS_PER_DAY);
    const floored = daysSinceEpoch - (daysSinceEpoch % interval.binSize);
    local.setTime(floored * MILLISECONDS_PER_DAY);
    return new Date(local.getTime() - offsetMs);
  }

  if (interval.unit === "week" || interval.unit === "month") {
    local.setUTCHours(0);
  }

  if (interval.unit === "week") {
    const day = local.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  }

  if (interval.unit === "month") {
    local.setUTCDate(1);
  }

  if (interval.unit === "hour") {
    const hour = local.getUTCHours();
    local.setUTCHours(hour - (hour % interval.binSize));
  }

  return new Date(local.getTime() - offsetMs);
}
