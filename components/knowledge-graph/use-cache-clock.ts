"use client";

import { useEffect, useRef, useState } from "react";
import type { KnowledgeGraphSnapshot } from "@/lib/knowledge-graph/types";

// The badge reads to the minute, but the tick stays on the second: it is also
// what notices the snapshot has expired.
const COUNTDOWN_TICK_MS = 1000;

// What the page shows: the snapshot's provenance, ticking down.
interface CacheCountdown {
  // When the snapshot was written, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // Seconds left, recomputed from wall-clock elapsed time rather than counted
  // down, so a tab whose timers were throttled comes back correct.
  remainingSeconds: number;
}

// What is left of a reading once time has been observed to pass since it
// landed, carried with the snapshot it was measured against — a tick belongs to
// the reading it was taken from, so a fresh one arriving mid-count cannot
// inherit the old one's elapsed time.
interface Observed {
  snapshot: KnowledgeGraphSnapshot;
  remainingSeconds: number;
}

// The minute a countdown reads as, clamped at zero so a snapshot that has run
// out arrives at its final "0 min" rather than a negative one.
function shownMinutes(remainingSeconds: number): number {
  return Math.max(0, Math.ceil(remainingSeconds / 60));
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

  // One interval per snapshot. The server's reading is re-anchored here, to the
  // moment it landed: a new reading starts measuring from its own landing, and
  // the effect tearing down is what forgets the old countdown. A failed load
  // leaves the old snapshot in place, so its interval runs on — which is what
  // lets a countdown reach its own zero beside a stale graph.
  useEffect(() => {
    if (snapshot === null) return;

    // Every reading is recomputed from wall-clock elapsed time rather than a
    // counter decremented once per tick — a backgrounded tab has its timers
    // throttled, and a counter would come back holding a value minutes out of
    // date.
    const arrivedAtMs = Date.now();
    const totalSeconds = snapshot.remainingSeconds;

    // What the countdown remembers between ticks, seeded with the minute
    // already on screen so the first tick has nothing to change.
    let currentMinutes = shownMinutes(totalSeconds);
    let expiryAttempted = false;

    const interval = setInterval(() => {
      const left = totalSeconds - (Date.now() - arrivedAtMs) / 1000;
      const minutes = shownMinutes(left);

      // The clock moves only when the minute the badge shows would change; the
      // tick is on the second for the expiry check below, not for the display.
      if (minutes !== currentMinutes) {
        currentMinutes = minutes;
        setObserved({ snapshot, remainingSeconds: left });
      }

      // The tick is where time is observed to have moved, so it is also where a
      // snapshot is noticed to have run out. `expiryAttempted` holds that to one
      // attempt per clock, so a refresh that failed is not retried sixty times a
      // minute; the retry button covers the rest.
      if (left <= 0 && !expiryAttempted) {
        expiryAttempted = true;
        onExpireRef.current();
      }
    }, COUNTDOWN_TICK_MS);

    return () => clearInterval(interval);
  }, [snapshot]);

  if (snapshot === null) return null;

  // Before the first tick nothing has been observed, and nothing needs to be:
  // no time has passed, so the server's own reading is still exact.
  const remainingSeconds =
    observed !== null && observed.snapshot === snapshot
      ? observed.remainingSeconds
      : snapshot.remainingSeconds;

  return { cachedAt: snapshot.cachedAt, remainingSeconds };
}
