"use client"

import { useState } from "react"
import { SummaryCards } from "@/components/ai-usage/summary-cards"
import { UsageChart } from "@/components/ai-usage/usage-chart"
import { UsageBreakdown } from "@/components/ai-usage/usage-breakdown"
import { BreakdownView, VIEW_OPTIONS } from "@/components/ai-usage/view-toggle"
import { RangeSelector } from "@/components/polled/range-selector"
import { DashboardHeader } from "@/components/polled/dashboard-header"
import { ErrorBanner } from "@/components/polled/error-banner"
import { usePolledJson, viewerTimeZone } from "@/hooks/use-polled-json"
import { Range } from "@/lib/ranges"
import { Response } from "@/lib/ai-usage/types"
import { BreakdownRow } from "@/lib/ai-usage/breakdown"

// The three breakdown views read three API lists that differ only in what they
// call their label field, so each view knows its own column header and how to
// flatten its list into the donuts' rows.
const BREAKDOWNS: Record<
  BreakdownView,
  {
    header: string
    rows: (data: Response) => BreakdownRow[]
  }
> = {
  model: {
    header: "Model",
    rows: (data) =>
      data.byModel.map(({ model, ...totals }) => ({
        id: model,
        label: model,
        ...totals,
      })),
  },
  project: {
    header: "Project",
    rows: (data) =>
      data.byProject.map(({ project, ...totals }) => ({
        id: project,
        label: project,
        ...totals,
      })),
  },
  harness: {
    header: "Harness",
    rows: (data) =>
      data.byHarness.map(({ harness, ...totals }) => ({
        id: harness,
        label: harness,
        ...totals,
      })),
  },
}

export default function AiUsagePage() {
  const [range, setRange] = useState<Range>("24h")
  const [view, setView] = useState<BreakdownView>("model")
  const { data, loading, error, lastUpdated, refresh } =
    usePolledJson<Response>(
      `/api/ai-usage?range=${range}&tz=${encodeURIComponent(viewerTimeZone())}`
    )

  const isEmpty = data !== null && data.totals.totalTokens === 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <DashboardHeader
        lastUpdated={lastUpdated}
        range={range}
        onRangeChange={setRange}
      />

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
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
              No AI usage in this range.
            </p>
          ) : (
            <>
              <div>
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
                  <RangeSelector
                    value={view}
                    onChange={setView}
                    options={VIEW_OPTIONS}
                  />
                </div>
                <UsageBreakdown
                  rows={BREAKDOWNS[view].rows(data)}
                  labelHeader={BREAKDOWNS[view].header}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
