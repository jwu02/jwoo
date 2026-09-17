"use client";

import { useEffect, useRef, useState } from "react";
import {
  cacheClockFrom,
  initialClockState,
  planTick,
  remainingAfter,
  type ClockState,
} from "@/lib/knowledge-graph/cache-clock";
import type { KnowledgeGraphSnapshot } from "@/lib/knowledge-graph/types";

// The badge reads to the minute, but the tick stays on the second: it is also
// what notices the snapshot has expired.
const COUNTDOWN_TICK_MS = 1000;

// What the page shows: the snapshot's provenance, ticking down.
export interface CacheCountdown {
  // When the snapshot was written, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // Seconds left, recomputed from wall-clock elapsed time rather than counted
  // down, so a tab whose timers were throttled comes back correct.
  remainingSeconds: number;
}

// Time observed to pass since a snapshot landed, carried with the snapshot it
// was measured against — a tick belongs to the reading it was taken from, so a
// fresh one arriving mid-count cannot inherit the old one's elapsed time.
interface Observed {
  snapshot: KnowledgeGraphSnapshot;
  elapsedMs: number;
}

// A snapshot with provenance is one worth counting down; one without is simply
// shown, with no notice — an older server, or a response cached from before the
// fields existed, leaves nothing to count from.
function hasProvenance(
  snapshot: KnowledgeGraphSnapshot
): snapshot is KnowledgeGraphSnapshot & { remainingSeconds: number } {
  return (
    typeof snapshot.cachedAt === "string" &&
    typeof snapshot.remainingSeconds === "number"
  );
}

// The page's countdown, driven by whichever snapshot it currently holds.
export function useCacheClock(
  snapshot: KnowledgeGraphSnapshot | null,
  onExpire: () => void
): CacheCountdown | null {
  const [observed, setObserved] = useState<Observed | null>(null);

  // The refresh callback is free to change identity between renders; the tick
  // reads it through the ref so a new one cannot restart the interval.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // One interval per snapshot. Anchoring here rather than in state is what
  // gives it a real arrival time: a new reading starts measuring from its own
  // landing, and the effect tearing down is what forgets the old countdown. A
  // failed load leaves the old snapshot in place, so its interval runs on —
  // which is what lets a countdown reach its own zero beside a stale graph.
  useEffect(() => {
    if (snapshot === null || !hasProvenance(snapshot)) return;

    const arrivedAtMs = Date.now();
    const clock = cacheClockFrom(
      snapshot.cachedAt,
      snapshot.remainingSeconds,
      arrivedAtMs
    );
    let state: ClockState = initialClockState(clock);

    const interval = setInterval(() => {
      const now = Date.now();
      const plan = planTick(clock, now, state);
      state = plan.state;
      // The clock moves only when the minute the badge shows would change; the
      // tick is on the second for the expiry check below, not for the display.
      if (plan.advance) setObserved({ snapshot, elapsedMs: now - arrivedAtMs });
      // The tick is where time is observed to have moved, so it is also where
      // the snapshot is noticed to have run out.
      if (plan.refresh) onExpireRef.current();
    }, COUNTDOWN_TICK_MS);

    return () => clearInterval(interval);
  }, [snapshot]);

  if (snapshot === null || !hasProvenance(snapshot)) return null;

  // Before the first tick nothing has been observed, and nothing needs to be:
  // no time has passed, so the server's own reading is still exact.
  const elapsedMs =
    observed !== null && observed.snapshot === snapshot ? observed.elapsedMs : 0;

  return {
    cachedAt: snapshot.cachedAt,
    remainingSeconds: remainingAfter(snapshot.remainingSeconds, elapsedMs),
  };
}
