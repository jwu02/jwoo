"use client"

import { useMemo, useRef } from "react";

import { SceneA11yLayer, SceneTooltip, useSceneHover } from "@/components/three/scene-hover";
import type { MouseRegion } from "@/lib/telemetry/mouse-node-map";

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
// positioned tooltip, and a focusable a11y layer. Each 3D region tints on hover,
// and every region drives the tooltip; the body is fixed (undraggable). All three
// a11y/interaction paths converge on the same `hovered` region.
export function MouseVisual({ leftClicks, rightClicks, movementMeters }: MouseVisualProps) {
  const canvasApiRef = useRef<MouseCanvasApi | null>(null);
  const { hovered, setHovered, containerRef, tooltipRef } = useSceneHover(canvasApiRef);

  // Visually hidden but focusable — Tab reaches each region and drives the 3D
  // press + tooltip via the same hover pipeline. Memoised on counts so hover
  // churn never re-diffs the four buttons.
  const a11yItems = useMemo(
    () =>
      REGIONS.map((region) => ({
        id: region,
        label: regionCaption(region, leftClicks, rightClicks, movementMeters).ariaLabel,
      })),
    [leftClicks, rightClicks, movementMeters],
  );

  return (
    <div className="flex w-full flex-col items-center self-center">
      <div ref={containerRef} className="relative w-full">
        <MouseScene hovered={hovered} onHover={setHovered} canvasApiRef={canvasApiRef} />

        {hovered && (
          <SceneTooltip innerRef={tooltipRef}>
            {regionCaption(hovered, leftClicks, rightClicks, movementMeters).caption}
          </SceneTooltip>
        )}

        <SceneA11yLayer items={a11yItems} onHover={setHovered} />
      </div>
    </div>
  );
}
