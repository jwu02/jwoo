"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { SummaryCards } from "@/components/telemetry/summary-cards"
import { MouseVisual } from "@/components/telemetry/mouse-visual"
import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap"
import { RangeSelector } from "@/components/telemetry/range-selector"
import { ActivityChart } from "@/components/telemetry/activity-chart"
import { ErrorBanner } from "@/components/telemetry/error-banner"
import { TelemetryRange, TelemetryResponse } from "@/lib/telemetry/types"

const POLL_INTERVAL_MS = 60_000

async function fetchTelemetry(
  range: TelemetryRange,
  signal?: AbortSignal
): Promise<TelemetryResponse> {
  const response = await fetch(`/api/telemetry?range=${range}`, { signal })
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export default function ActivityTelemetryPage() {
  const [range, setRange] = useState<TelemetryRange>("24h")
  const [data, setData] = useState<TelemetryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true)
      setError(null)
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      try {
        const result = await fetchTelemetry(range, controller.signal)
        setData(result)
        setLastUpdated(new Date())
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        setError(
          err instanceof Error ? err.message : "Failed to load telemetry"
        )
      } finally {
        if (!isBackground) setLoading(false)
      }
    },
    [range]
  )

  useEffect(() => {
    const timeout = setTimeout(() => load(), 0)
    const interval = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
      abortControllerRef.current?.abort()
    }
  }, [load])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
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
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <SummaryCards totals={data.totals} />

          <div className="grid gap-8 md:grid-cols-[1fr_240px]">
            <KeyboardHeatmap keys={data.keys} />
            <MouseVisual
              leftClicks={data.totals.leftClicks}
              rightClicks={data.totals.rightClicks}
            />
          </div>

          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <RangeSelector value={range} onChange={setRange} />
            </div>
            <ActivityChart data={data.timeSeries} range={range} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
