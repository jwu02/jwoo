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
    <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
      {lastUpdated && (
        <p className="text-sm text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
      {/* `ml-auto` rather than `justify-between`: when the row wraps at a
          narrow width the pills must still land against the right edge, and a
          lone `justify-between` item would sit at the start of its own line. */}
      <div className="ml-auto">
        <RangeSelector
          value={range}
          onChange={onRangeChange}
          options={RANGE_OPTIONS}
        />
      </div>
    </div>
  )
}
