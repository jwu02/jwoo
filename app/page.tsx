"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SummaryCards } from "@/components/telemetry/summary-cards";
import { MouseVisual } from "@/components/telemetry/mouse-visual";
import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap";
import { RangeSelector } from "@/components/telemetry/range-selector";
import { ActivityChart } from "@/components/telemetry/activity-chart";
import { ErrorBanner } from "@/components/telemetry/error-banner";
import { TelemetryRange, TelemetryResponse } from "@/lib/telemetry/types";

const POLL_INTERVAL_MS = 60_000;

async function fetchTelemetry(
  range: TelemetryRange,
  signal?: AbortSignal
): Promise<TelemetryResponse> {
  const response = await fetch(`/api/telemetry?range=${range}`, { signal });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export default function HomePage() {
  const [range, setRange] = useState<TelemetryRange>("24h");
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setError(null);
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const result = await fetchTelemetry(range, controller.signal);
        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load telemetry"
        );
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [range]
  );

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0);
    const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      abortControllerRef.current?.abort();
    };
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Activity Telemetry
          </h1>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      ) : data ? (
        <div className="space-y-8">
          <SummaryCards totals={data.totals} />

          <div className="grid gap-8 md:grid-cols-[240px_1fr]">
            <MouseVisual
              leftClicks={data.totals.leftClicks}
              rightClicks={data.totals.rightClicks}
            />
            <KeyboardHeatmap keys={data.keys} />
          </div>

          <div>
            <h2 className="mb-4 text-lg font-medium">Activity Over Time</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ActivityChart
                data={data.timeSeries}
                range={range}
                dataKey="leftClicks"
                name="Left Clicks"
                color="--chart-1"
              />
              <ActivityChart
                data={data.timeSeries}
                range={range}
                dataKey="rightClicks"
                name="Right Clicks"
                color="--chart-2"
              />
              <ActivityChart
                data={data.timeSeries}
                range={range}
                dataKey="keyPresses"
                name="Key Presses"
                color="--chart-3"
              />
              <ActivityChart
                data={data.timeSeries}
                range={range}
                dataKey="movementMeters"
                name="Distance (m)"
                color="--chart-4"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
