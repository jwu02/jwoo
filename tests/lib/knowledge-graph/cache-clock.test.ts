import {
  cacheClockFrom,
  initialClockState,
  planTick,
  remainingAfter,
  secondsLeft,
  shownMinutes,
  type CacheClock,
} from "@/lib/knowledge-graph/cache-clock";

const ARRIVED_AT_MS = new Date("2026-09-14T06:32:00.000Z").getTime();
const WRITTEN_AT = "2026-09-14T06:02:00.000Z";

// The server said 30 minutes were left when it answered.
function clock(totalSeconds = 30 * 60): CacheClock {
  return cacheClockFrom(WRITTEN_AT, totalSeconds, ARRIVED_AT_MS);
}

// What the page carries between ticks: the clock, plus what the countdown
// remembers. Running a whole interval through here is what lets a test assert
// on the sequence of decisions without a timer or a render.
function run(clock: CacheClock, secondsAhead: number[]) {
  let state = initialClockState(clock);
  const plans = secondsAhead.map((seconds) => {
    const plan = planTick(clock, ARRIVED_AT_MS + seconds * 1000, state);
    state = plan.state;
    return plan;
  });
  return { plans, state };
}

describe("secondsLeft", () => {
  it("recomputes from elapsed wall-clock time rather than counting ticks", () => {
    const c = clock(1800);

    expect(secondsLeft(c, ARRIVED_AT_MS)).toBe(1800);
    expect(secondsLeft(c, ARRIVED_AT_MS + 1000)).toBe(1799);
  });

  // A backgrounded tab has its timers throttled, so the reading after a jump is
  // the only one that matters — a decremented counter would land minutes out.
  it("comes back correct after a jump no tick covered", () => {
    expect(secondsLeft(clock(1800), ARRIVED_AT_MS + 45 * 60 * 1000)).toBe(-900);
  });
});

describe("remainingAfter", () => {
  it("takes observed elapsed time off the reading the server gave", () => {
    expect(remainingAfter(1800, 0)).toBe(1800);
    expect(remainingAfter(1800, 60_000)).toBe(1740);
  });

  // A reading measured before the snapshot landed would otherwise grow the
  // countdown past the window it was given.
  it("goes negative once more time has passed than the reading had left", () => {
    expect(remainingAfter(45, 60_000)).toBeLessThan(0);
  });
});

describe("shownMinutes", () => {
  it("reads to the minute, rounding up so a partly spent minute stays on screen", () => {
    expect(shownMinutes(1800)).toBe(30);
    expect(shownMinutes(1799)).toBe(30);
    expect(shownMinutes(1740)).toBe(29);
  });

  it("gives the last minute a floor of zero rather than a negative", () => {
    expect(shownMinutes(1)).toBe(1);
    expect(shownMinutes(0)).toBe(0);
    expect(shownMinutes(-900)).toBe(0);
  });
});

describe("initialClockState", () => {
  it("is seeded with the minute already on screen, so the first tick changes nothing", () => {
    const state = initialClockState(clock(1800));
    expect(state).toEqual({ shownMinutes: 30, expiryAttempted: false });
  });
});

describe("planTick", () => {
  it("advances nothing while the displayed minute holds", () => {
    const { plans } = run(clock(1800), [1, 30, 59]);

    expect(plans.map((p) => p.advance)).toEqual([false, false, false]);
    expect(plans.every((p) => p.refresh === false)).toBe(true);
  });

  it("advances exactly on the tick that spends the minute", () => {
    const { plans } = run(clock(1800), [59, 60, 61]);

    expect(plans.map((p) => p.advance)).toEqual([false, true, false]);
    expect(plans[1].minutes).toBe(29);
  });

  // One tick, several minutes: the plan is computed from wall-clock time, so a
  // throttled tab catches up in a single step instead of replaying every minute
  // it missed.
  it("lands on the correct minute in one step after a jump", () => {
    const { plans } = run(clock(1800), [45 * 60]);

    expect(plans[0].minutes).toBe(0);
    expect(plans[0].advance).toBe(true);
  });

  it("asks for a fresh snapshot on the tick that reaches zero", () => {
    const { plans } = run(clock(2), [1, 2]);

    expect(plans[0].refresh).toBe(false);
    expect(plans[1].refresh).toBe(true);
    expect(plans[1].minutes).toBe(0);
  });

  // The countdown is past zero on every tick that follows, so an unguarded
  // refresh would re-request once a second for as long as the tab stayed open.
  it("asks only once, however many ticks pass afterwards", () => {
    const { plans, state } = run(clock(2), [2, 3, 4, 5]);

    expect(plans.filter((p) => p.refresh)).toHaveLength(1);
    expect(state).toEqual({ shownMinutes: 0, expiryAttempted: true });
  });

  it("does not ask again for a clock whose expiry was already attempted", () => {
    const c = clock(2);
    const attempted = { shownMinutes: 1, expiryAttempted: true };

    expect(planTick(c, ARRIVED_AT_MS + 2000, attempted).refresh).toBe(false);
  });

  // A failed refresh leaves the snapshot in place, so the countdown has to be
  // able to arrive at its own zero — otherwise the notice sits on "<1 min"
  // indefinitely, reading as a countdown that never lands.
  it("reaches zero on the same tick it asks for a refresh", () => {
    const { plans } = run(clock(45), [44, 45]);

    expect(plans[1]).toEqual({
      minutes: 0,
      advance: true,
      refresh: true,
      state: { shownMinutes: 0, expiryAttempted: true },
    });
  });

  // Clamping at zero is why the clock stops for good: every later tick computes
  // the same minute, so there is nothing left to re-render.
  it("stays at zero and settles once it has run out", () => {
    const { plans } = run(clock(60), [60, 120, 600]);

    expect(plans.map((p) => p.advance)).toEqual([true, false, false]);
    expect(plans.map((p) => p.minutes)).toEqual([0, 0, 0]);
  });
});
