"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { PHYSICAL_KEYS, buildKeyCountMap } from "@/lib/telemetry/key-layout"
import { KeyCounts } from "@/lib/telemetry/types"
import { computeTooltipPosition } from "@/lib/telemetry/tooltip-position"

import { KeyboardScene } from "./keyboard-scene"
import type { KeyboardCanvasApi } from "./keyboard-model"

interface KeyboardHeatmapProps {
  keys: KeyCounts
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

// A keycap count drives a continuous heatmap overlay on top of the keyboard; the
// tooltip hugs the key's on-screen edge. The overlay is toggleable above the
// scene. The tooltip/a11y layer positions against the scene container (which
// the toggle lives outside of), so adding it never shifts the tooltip.
export function KeyboardHeatmap({ keys }: KeyboardHeatmapProps) {
  // Single source of truth for hover — the 3D press, tooltip, and a11y buttons
  // all converge here, so the pointer and focus paths stay in lock-step.
  const [hovered, setHovered] = useState<string | null>(null)
  // Default to showing the heatmap overlay; the toggle above the scene flips it.
  const [showOverlay, setShowOverlay] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  // The canvas lives behind the dynamic import, so the wrapper reaches its
  // node/camera via this api ref rather than owning the projection directly.
  const canvasApiRef = useRef<KeyboardCanvasApi | null>(null)

  // Aggregate raw label counts into physical-key counts.
  const keyCountMap = useMemo(() => buildKeyCountMap(keys), [keys])

  // Highest count, floored at 1 so a single-key dataset still saturates the
  // ramp and the coldest key reads as "never pressed".
  const maxCount = useMemo(() => {
    let max = 1
    for (const count of keyCountMap.values()) {
      if (count > max) max = count
    }
    return max
  }, [keyCountMap])

  const hoveredKey = useMemo(
    () => PHYSICAL_KEYS.find((key) => key.id === hovered),
    [hovered],
  )

  // For the tooltip breakdown: which labels this key can produce, with counts.
  // Single-character labels are always listed (an untyped char shows 0); key
  // names only when the client actually counted them. Sorted by count desc.
  const hoveredBreakdown = useMemo(() => {
    if (!hoveredKey) return []
    return hoveredKey.labels
      .map((label) => ({ label, count: keys[label] ?? 0 }))
      .filter(({ label, count }) => count > 0 || label.length === 1)
      .sort((a, b) => b.count - a.count)
  }, [hoveredKey, keys])

  // Position the tooltip against the live canvas projection of the hovered key.
  // Runs before paint so it never flashes at an unclamped location. A key with
  // no node falls back to a deterministic centre/top anchor → the tooltip
  // simply appears at the top-centre both themes, which is testable.
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const container = containerRef.current
    if (!tooltip || !container || !hovered) return

    const anchor = canvasApiRef.current?.getAnchor(hovered) ?? {
      centerX: container.clientWidth / 2,
      keyTop: 0,
      keyHeight: 0,
    }
    const pos = computeTooltipPosition(
      anchor,
      tooltip.offsetWidth,
      tooltip.offsetHeight,
      { clientWidth: container.clientWidth, scrollLeft: 0 },
    )
    tooltip.style.left = `${pos.left}px`
    tooltip.style.top = `${pos.top}px`
  }, [hovered])

  // The a11y layer is a real button per physical key (including those with no
  // GLB node), rendered outside the dynamic canvas so it survives the fallback.
  // Memoised on counts so hover churn never re-diffs 79 buttons.
  const a11yButtons = useMemo(
    () =>
      PHYSICAL_KEYS.map((key) => {
        const count = keyCountMap.get(key.id) ?? 0
        const label =
          key.id === "Touch ID"
            ? "Touch ID"
            : `${key.id}: ${formatNumber(count)} presses`
        return (
          <button
            key={key.id}
            type="button"
            aria-label={label}
            onFocus={() => setHovered(key.id)}
            onBlur={() => setHovered(null)}
          />
        )
      }),
    [keyCountMap],
  )

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={showOverlay}
          aria-label="Show keyboard heatmap"
          onClick={() => setShowOverlay((value) => !value)}
          className={`relative flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            showOverlay ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
              showOverlay ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-sm text-muted-foreground">Heatmap</span>
      </div>

      <div ref={containerRef} className="relative w-full">
        <KeyboardScene
          counts={keyCountMap}
          maxCount={maxCount}
          showOverlay={showOverlay}
          hovered={hovered}
          onHover={setHovered}
          canvasApiRef={canvasApiRef}
        />

        {hoveredKey && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
          >
            {hoveredKey.id === "Touch ID" ? (
              <div className="font-medium">Touch ID untracked</div>
            ) : (
              <>
                <div className="font-medium">
                  {formatNumber(keyCountMap.get(hoveredKey.id) ?? 0)} presses
                </div>
                {hoveredBreakdown.length > 1 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {hoveredBreakdown.map(({ label, count }) => (
                      <div key={label} className="flex justify-between gap-3">
                        <span>{label}</span>
                        <span className="tabular-nums">
                          {formatNumber(count)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Visually hidden but focusable — Tab reaches each key and drives the 3D
            press + tooltip via the same hover pipeline. */}
        <div className="sr-only">{a11yButtons}</div>
      </div>
    </div>
  )
}
