"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { SummaryCards } from "@/components/ai-usage/summary-cards"
import { UsageChart } from "@/components/ai-usage/usage-chart"
import { ModelBreakdown } from "@/components/ai-usage/model-breakdown"
import { AI_USAGE_RANGE_OPTIONS, RangeSelector } from "@/components/telemetry/range-selector"
import { ErrorBanner } from "@/components/telemetry/error-banner"
import { AiUsageRange, AiUsageResponse } from "@/lib/telemetry/types"

const POLL_INTERVAL_MS = 60_000

async function fetchAiUsage(
  range: AiUsageRange,
  signal?: AbortSignal
): Promise<AiUsageResponse> {
  const response = await fetch(`/api/ai-usage?range=${range}`, { signal })
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export default function AiUsagePage() {
  const [range, setRange] = useState<AiUsageRange>("24h")
  const [data, setData] = useState<AiUsageResponse | null>(null)
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
        const result = await fetchAiUsage(range, controller.signal)
        setData(result)
        setLastUpdated(new Date())
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Failed to load AI usage")
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

  const isEmpty = data !== null && data.totals.requests === 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Usage</h1>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <SummaryCards totals={data.totals} />

          {isEmpty ? (
            <p className="text-sm text-muted-foreground">
              No AI usage recorded yet.
            </p>
          ) : (
            <>
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <RangeSelector
                    value={range}
                    onChange={setRange}
                    options={AI_USAGE_RANGE_OPTIONS}
                  />
                </div>
                <UsageChart
                  data={data.timeSeriesByModel}
                  range={range}
                  modelOrder={data.byModel.map((model) => model.model)}
                />
              </div>
              <div>
                <h2 className="mb-3 text-lg font-semibold tracking-tight">
                  By model
                </h2>
                <ModelBreakdown byModel={data.byModel} />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
