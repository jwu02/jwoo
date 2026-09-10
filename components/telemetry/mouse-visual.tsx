"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"

import type { MouseRegion } from "@/lib/telemetry/mouse-node-map"
import { computeTooltipPosition } from "@/lib/telemetry/tooltip-position"

import { MouseScene } from "./mouse-scene"
import type { MouseCanvasApi } from "./mouse-model"

interface MouseVisualProps {
  leftClicks: number;
  rightClicks: number;
  movementMeters: number;
}

function formatNumber(value: number): string {
  // Round to a whole integer so fractional movement distances render cleanly.
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

// Tooltip copy per region, shown on hover. Wheel is untracked (mirrors the old
// SVG behaviour — no scroll-distance data is collected).
function regionCaption(
  hovered: MouseRegion,
  leftClicks: number,
  rightClicks: number,
  movementMeters: number,
): { caption: string; ariaLabel: string } {
  if (hovered === "left") {
    return {
      caption: `Left: ${formatNumber(leftClicks)} clicks`,
      ariaLabel: `Left button: ${formatNumber(leftClicks)} clicks`,
    }
  }
  if (hovered === "right") {
    return {
      caption: `Right: ${formatNumber(rightClicks)} clicks`,
      ariaLabel: `Right button: ${formatNumber(rightClicks)} clicks`,
    }
  }
  if (hovered === "wheel") {
    return {
      caption: "Middle click untracked, Scroll distance untracked",
      ariaLabel: "Middle click untracked, Scroll distance untracked",
    }
  }
  return {
    caption: `Mouse movement: ${formatNumber(movementMeters)} m`,
    ariaLabel: `Mouse body: ${formatNumber(movementMeters)} m moved`,
  }
}

const REGIONS: readonly MouseRegion[] = ["left", "right", "wheel", "body"];

// The mouse canvas is a WebGL scene, so the wrapper owns the hover state, the
// positioned tooltip, and a focusable a11y layer — exactly the shape of the
// keyboard heatmap. Each 3D region tints on hover, and every region drives the
// tooltip; the body is fixed (undraggable). All three a11y/interaction paths
// converge on the same `hovered` region.
export function MouseVisual({ leftClicks, rightClicks, movementMeters }: MouseVisualProps) {
  const [hovered, setHovered] = useState<MouseRegion | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const canvasApiRef = useRef<MouseCanvasApi | null>(null);

  // Position the tooltip against the live canvas projection of the hovered
  // region. Runs before paint so it never flashes at an unclamped location. A
  // region with no node falls back to a deterministic centre/top anchor.
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    if (!tooltip || !container || !hovered) return;

    const anchor = canvasApiRef.current?.getAnchor(hovered) ?? {
      centerX: container.clientWidth / 2,
      keyTop: 0,
      keyHeight: 0,
    };
    const pos = computeTooltipPosition(
      anchor,
      tooltip.offsetWidth,
      tooltip.offsetHeight,
      { clientWidth: container.clientWidth, scrollLeft: 0 },
    );
    tooltip.style.left = `${pos.left}px`;
    tooltip.style.top = `${pos.top}px`;
  }, [hovered]);

  // Visually hidden but focusable — Tab reaches each region and drives the 3D
  // press + tooltip via the same hover pipeline. Memoised on counts so hover
  // churn never re-diffs the four buttons.
  const a11yButtons = useMemo(
    () =>
      REGIONS.map((region) => (
        <button
          key={region}
          type="button"
          aria-label={regionCaption(region, leftClicks, rightClicks, movementMeters).ariaLabel}
          onFocus={() => setHovered(region)}
          onBlur={() => setHovered(null)}
        />
      )),
    [leftClicks, rightClicks, movementMeters],
  );

  return (
    <div className="flex w-full flex-col items-center self-center">
      <div ref={containerRef} className="relative w-full">
        <MouseScene hovered={hovered} onHover={setHovered} canvasApiRef={canvasApiRef} />

        {hovered && (
          <div
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
          >
            {regionCaption(hovered, leftClicks, rightClicks, movementMeters).caption}
          </div>
        )}

        <div className="sr-only">{a11yButtons}</div>
      </div>
    </div>
  );
}
