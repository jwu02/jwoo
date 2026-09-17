"use client"

import { useMemo, useRef } from "react"

import { SceneA11yLayer, SceneTooltip, useSceneHover } from "@/components/three/scene-hover"
import { PHYSICAL_KEYS, buildKeyCountMap } from "@/lib/telemetry/key-layout"
import { KeyCounts } from "@/lib/telemetry/types"

import { KeyboardScene } from "./keyboard-scene"
import type { KeyboardCanvasApi } from "./keyboard-model"

interface KeyboardHeatmapProps {
  keys: KeyCounts
  /** Whether the continuous heatmap overlay is shown. Owned by the page — the
   *  toggle renders above the scene card, not inside it. */
  showOverlay: boolean
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

// A keycap count drives a continuous heatmap overlay on top of the keyboard; the
// tooltip hugs the key's on-screen edge. The overlay is toggleable from the page
// (above the scene card), so this component only renders the scene. The
// tooltip/a11y layer positions against the scene container, so the toggle never
// shifts the tooltip.
export function KeyboardHeatmap({ keys, showOverlay }: KeyboardHeatmapProps) {
  // The canvas lives behind the dynamic import, so the hover layer reaches its
  // node/camera via this api ref rather than owning the projection directly.
  const canvasApiRef = useRef<KeyboardCanvasApi | null>(null)
  // Single source of truth for hover — the 3D press, tooltip, and a11y buttons
  // all converge here, so the pointer and focus paths stay in lock-step.
  const { hovered, setHovered, containerRef, tooltipRef } =
    useSceneHover(canvasApiRef)

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

  // A real button per physical key (including those with no GLB node), rendered
  // outside the dynamic canvas so it survives the fallback. Memoised on counts
  // so hover churn never re-diffs 79 buttons.
  const a11yItems = useMemo(
    () =>
      PHYSICAL_KEYS.map((key) => ({
        id: key.id,
        label:
          key.id === "Touch ID"
            ? "Touch ID"
            : `${key.id}: ${formatNumber(keyCountMap.get(key.id) ?? 0)} presses`,
      })),
    [keyCountMap],
  )

  return (
    <div className="w-full">
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
          <SceneTooltip innerRef={tooltipRef}>
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
          </SceneTooltip>
        )}

        <SceneA11yLayer items={a11yItems} onHover={setHovered} />
      </div>
    </div>
  )
}
