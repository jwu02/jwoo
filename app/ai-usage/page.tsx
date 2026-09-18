"use client"

import { useState } from "react"
import { SummaryCards } from "@/components/ai-usage/summary-cards"
import { UsageChart } from "@/components/ai-usage/usage-chart"
import { UsageBreakdown } from "@/components/ai-usage/usage-breakdown"
import { BreakdownView, ViewToggle } from "@/components/ai-usage/view-toggle"
import { AI_USAGE_RANGE_OPTIONS, RangeSelector } from "@/components/telemetry/range-selector"
import { ErrorBanner } from "@/components/telemetry/error-banner"
import { usePolledJson, viewerTimeZone } from "@/hooks/use-polled-json"
import { AiUsageRange, AiUsageResponse } from "@/lib/telemetry/types"

export default function AiUsagePage() {
  const [range, setRange] = useState<AiUsageRange>("24h")
  const [view, setView] = useState<BreakdownView>("model")
  const { data, loading, error, lastUpdated, refresh } =
    usePolledJson<AiUsageResponse>(
      `/api/ai-usage?range=${range}&tz=${encodeURIComponent(viewerTimeZone())}`
    )

  const isEmpty = data !== null && data.totals.totalTokens === 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
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

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
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
                <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-end">
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
                <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Usage breakdown
                  </h2>
                  <ViewToggle value={view} onChange={setView} />
                </div>
                <UsageBreakdown
                  rows={
                    view === "model"
                      ? data.byModel.map((model) => ({
                          id: model.model,
                          label: model.model,
                          costYuan: model.costYuan,
                          totalTokens: model.totalTokens,
                        }))
                      : view === "project"
                        ? data.byProject.map((project) => ({
                            id: project.project,
                            label: project.project,
                            costYuan: project.costYuan,
                            totalTokens: project.totalTokens,
                          }))
                        : data.byHarness.map((harness) => ({
                            id: harness.harness,
                            label: harness.harness,
                            costYuan: harness.costYuan,
                            totalTokens: harness.totalTokens,
                          }))
                  }
                  labelHeader={
                    view === "model"
                      ? "Model"
                      : view === "project"
                        ? "Project"
                        : "Harness"
                  }
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
