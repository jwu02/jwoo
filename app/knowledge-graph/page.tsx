"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import { CacheToast } from "@/components/knowledge-graph/cache-toast";
import { ErrorBanner } from "@/components/telemetry/error-banner";
import type { KnowledgeGraphPayload } from "@/lib/knowledge-graph/types";

// The badge reads to the minute, but the tick stays on the second: it is also
// what notices the snapshot has expired. It only moves the clock when the
// displayed minute changes — see the effect below.
const COUNTDOWN_TICK_MS = 1000;

// The cache's own provenance, held apart from the graph data. `totalSeconds`
// is the remainder the server had left when it answered, and `startedAtMs` is
// when that answer arrived — together they let every later tick recompute the
// remainder rather than decrement a counter.
interface CacheClock {
  cachedAt: string;
  totalSeconds: number;
  startedAtMs: number;
}

// Seconds left, from wall-clock elapsed time rather than a counter decremented
// once per tick: a backgrounded tab has its timers throttled, and a counter
// would come back holding a value that is minutes out of date.
function secondsLeft(clock: CacheClock, nowMs: number): number {
  return clock.totalSeconds - (nowMs - clock.startedAtMs) / 1000;
}

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeGraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState<CacheClock | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inFlightRef = useRef(false);
  // Which snapshot has already been asked to replace itself, identified by its
  // clock object — a fresh clock arrives only on a successful load, so identity
  // is exactly the "we have not tried this one yet" signal.
  const refreshAttemptedForRef = useRef<CacheClock | null>(null);
  // The minute the badge is currently showing, so a tick that would not change
  // the number does not re-render — and with it, every node label.
  const shownMinutesRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    // A refresh landing while the previous one is still open would race it and
    // let the older response win.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const response = await fetch("/api/knowledge-graph");
      if (!response.ok) throw new Error("Failed to load knowledge graph");
      const json: KnowledgeGraphPayload = await response.json();
      setData(json);
      // A payload without provenance clears any countdown still running from
      // the previous response instead of leaving it to drift.
      if (
        typeof json.cachedAt === "string" &&
        typeof json.remainingSeconds === "number"
      ) {
        setClock({
          cachedAt: json.cachedAt,
          totalSeconds: json.remainingSeconds,
          startedAtMs: Date.now(),
        });
        // Seeded with the minute the badge shows from its first render, so the
        // next tick has nothing to change and no reason to re-render.
        shownMinutesRef.current = Math.max(
          0,
          Math.ceil(json.remainingSeconds / 60)
        );
      } else {
        setClock(null);
        shownMinutesRef.current = null;
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => load(), 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  const remainingSeconds = clock === null ? null : secondsLeft(clock, nowMs);

  useEffect(() => {
    if (clock === null) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const left = secondsLeft(clock, now);
      // The clock moves only when the minute the badge shows would change. The
      // tick is on the second for the expiry check below, not for the display.
      // Clamping at zero is what lets a snapshot that has run out arrive at its
      // final "0 min" — and the clamp is why the clock then stops for good:
      // every later tick computes the same zero and renders nothing.
      const minutes = Math.max(0, Math.ceil(left / 60));
      if (minutes !== shownMinutesRef.current) {
        shownMinutesRef.current = minutes;
        setNowMs(now);
      }
      // The tick is where time is observed to have moved, so it is also where
      // the snapshot is noticed to have run out. The guard keeps a *failed*
      // refresh from being retried on every subsequent tick: one attempt per
      // snapshot, and the retry button covers the rest.
      if (left > 0 || refreshAttemptedForRef.current === clock) return;
      refreshAttemptedForRef.current = clock;
      load();
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [clock, load]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-1 items-center justify-center">
          Loading knowledge graph…
        </div>
      </div>
    );
  }

  // Only fatal when there is nothing to show. Once a graph is on screen, a
  // failed refresh reports itself alongside the stale graph rather than
  // replacing it.
  if (error && !data) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No notes synced yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:-mx-4 md:-mb-4">
      {error && (
        <div className="px-4 pt-4 md:px-6">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        <ForceGraph graph={data} />
        {clock !== null && remainingSeconds !== null && (
          <CacheToast
            cachedAt={clock.cachedAt}
            remainingSeconds={remainingSeconds}
          />
        )}
      </div>
    </div>
  );
}
