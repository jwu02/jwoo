"use client"

import { useState } from "react"
import { SummaryCards } from "@/components/telemetry/summary-cards"
import { MouseVisual } from "@/components/telemetry/mouse-visual"
import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap"
import { HeatmapToggle } from "@/components/telemetry/heatmap-toggle"
import { RangeSelector } from "@/components/polled/range-selector"
import { RANGE_OPTIONS } from "@/lib/telemetry/ranges"
import { ActivityChart } from "@/components/telemetry/activity-chart"
import { ErrorBanner } from "@/components/polled/error-banner"
import { usePolledJson, viewerTimeZone } from "@/hooks/use-polled-json"
import { Range } from "@/lib/ranges"
import { TelemetryResponse } from "@/lib/telemetry/types"

export default function ActivityTelemetryPage() {
  const [range, setRange] = useState<Range>("24h")
  // The heatmap overlay toggle lives above the keyboard/mouse row (owned here so
  // it doesn't add height to the keyboard card, keeping the two cards aligned).
  const [showOverlay, setShowOverlay] = useState(true)
  const { data, loading, error, lastUpdated, refresh } =
    usePolledJson<TelemetryResponse>(
      `/api/telemetry?range=${range}&tz=${encodeURIComponent(viewerTimeZone())}`
    )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
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

      {error && <ErrorBanner message={error} onRetry={refresh} />}

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

          <div>
            <div className="mb-2 flex items-center justify-center gap-2">
              <HeatmapToggle
                showOverlay={showOverlay}
                onToggle={() => setShowOverlay((value) => !value)}
              />
            </div>
            <div className="grid gap-8 md:grid-cols-[1fr_240px]">
              <KeyboardHeatmap keys={data.keys} showOverlay={showOverlay} />
              <MouseVisual
                leftClicks={data.totals.leftClicks}
                rightClicks={data.totals.rightClicks}
                movementMeters={data.totals.movementMeters}
              />
            </div>
          </div>

          <div>
            <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-end">
              <RangeSelector
                value={range}
                onChange={setRange}
                options={RANGE_OPTIONS}
              />
            </div>
            <ActivityChart data={data.timeSeries} range={range} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
