"use client"

import { Range, RANGE_OPTIONS } from "@/lib/ranges"

import { RangeSelector } from "./range-selector"

interface DashboardHeaderProps {
  /** When the data on screen arrived; null before the first response. */
  lastUpdated: Date | null
  range: Range
  onRangeChange: (range: Range) => void
}

/**
 * The row both polled dashboards open with: how far back the page looks, and
 * when what it shows arrived.
 *
 * Rendered whether or not there is data: the range selector is the page's own
 * control, and a page with nothing on it is exactly when a viewer needs to
 * widen the range. Only the timestamp waits for a first response, so before
 * then the row is the pills alone.
 */
export function DashboardHeader({
  lastUpdated,
  range,
  onRangeChange,
}: DashboardHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm text-muted-foreground">
        {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
      </p>
      <RangeSelector
        value={range}
        onChange={onRangeChange}
        options={RANGE_OPTIONS}
      />
    </div>
  )
}
