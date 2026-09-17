// The page's view of a snapshot's remaining life: how much window the server
// reported was left, re-anchored to the moment that answer arrived. Every later
// reading is recomputed from wall-clock elapsed time rather than a counter
// decremented once per tick — a backgrounded tab has its timers throttled, and
// a counter would come back holding a value minutes out of date.
export interface CacheClock {
  // The snapshot's own provenance, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // The window the server reported as remaining, in seconds.
  totalSeconds: number;
  // Local wall-clock time when that report arrived.
  startedAtMs: number;
}

// What the countdown remembers between ticks.
export interface ClockState {
  // The minute the badge is currently showing.
  shownMinutes: number;
  // Whether this clock's expiry has already been acted on.
  expiryAttempted: boolean;
}

// What a tick decided.
export interface TickPlan {
  // The minute the badge should show from here.
  minutes: number;
  // Whether that differs from the minute on screen, i.e. whether to re-render.
  advance: boolean;
  // Whether to ask for a fresh snapshot now.
  refresh: boolean;
  // The state to carry into the next tick.
  state: ClockState;
}

// What is left of a reading once time has been observed to pass since it
// landed: the server's number, less the elapsed time. The one rule behind both
// readings of a clock — fractional and drifting, so it is a display concern's
// job to round it, never this one's.
export function remainingAfter(
  remainingSeconds: number,
  elapsedMs: number
): number {
  return remainingSeconds - elapsedMs / 1000;
}

// Seconds left, from the wall clock rather than from a counter.
export function secondsLeft(clock: CacheClock, nowMs: number): number {
  return remainingAfter(clock.totalSeconds, nowMs - clock.startedAtMs);
}

// The minute a countdown reads as, clamped at zero so a snapshot that has run
// out arrives at its final "0 min" rather than a negative one.
export function shownMinutes(totalSeconds: number): number {
  return Math.max(0, Math.ceil(totalSeconds / 60));
}

// A server's answer, re-anchored to the local moment it landed.
export function cacheClockFrom(
  cachedAt: string,
  remainingSeconds: number,
  arrivedAtMs: number
): CacheClock {
  return { cachedAt, totalSeconds: remainingSeconds, startedAtMs: arrivedAtMs };
}

// The state a fresh clock starts in, seeded with the minute it already shows so
// the next tick has nothing to change and no reason to re-render.
export function initialClockState(clock: CacheClock): ClockState {
  return { shownMinutes: shownMinutes(clock.totalSeconds), expiryAttempted: false };
}

// What one tick means, given the clock, the time, and what the countdown
// remembers. The whole policy is here — the badge's minute granularity, the
// clamp at zero, and the one-shot refresh — so it can be asserted as a table of
// times in and decisions out, with no timer and no render involved.
export function planTick(
  clock: CacheClock,
  nowMs: number,
  state: ClockState
): TickPlan {
  const left = secondsLeft(clock, nowMs);
  const minutes = shownMinutes(left);
  const expired = left <= 0;

  // Clamping at zero is what lets an expired snapshot land on "0 min" — and it
  // is also why the clock then stops for good: every later tick computes the
  // same zero and advances nothing.
  //
  // The tick is where time is observed to have moved, so it is also where a
  // snapshot is noticed to have run out. `expiryAttempted` holds that to one
  // attempt per clock, so a refresh that failed is not retried sixty times a
  // minute; the retry button covers the rest.
  return {
    minutes,
    advance: minutes !== state.shownMinutes,
    refresh: expired && !state.expiryAttempted,
    state: { shownMinutes: minutes, expiryAttempted: state.expiryAttempted || expired },
  };
}
