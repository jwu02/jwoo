"use client";

import { useState } from "react";

interface MouseVisualProps {
  leftClicks: number;
  rightClicks: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function MouseVisual({ leftClicks, rightClicks }: MouseVisualProps) {
  const [hovered, setHovered] = useState<"left" | "right" | null>(null);

  function handleKeyDown(
    event: React.KeyboardEvent<SVGPathElement>,
    region: "left" | "right"
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setHovered(region);
    }
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg
        viewBox="0 0 160 240"
        className="h-48 w-32 drop-shadow-sm"
        role="img"
        aria-label="Physical mouse with left and right click counts"
      >
        {/* Mouse body */}
        <rect
          x="10"
          y="10"
          width="140"
          height="220"
          rx="70"
          ry="70"
          className="fill-card stroke-border"
          strokeWidth="2"
        />

        {/* Scroll wheel */}
        <rect
          x="68"
          y="50"
          width="24"
          height="50"
          rx="12"
          className="fill-muted stroke-border"
          strokeWidth="2"
        />

        {/* Left button region */}
        <path
          d="M 12 80 Q 12 12 80 12 L 80 80 Z"
          className={`cursor-pointer transition-colors ${
            hovered === "left" ? "fill-primary/20" : "fill-transparent"
          }`}
          onMouseEnter={() => setHovered("left")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("left")}
          onBlur={() => setHovered(null)}
          onKeyDown={(event) => handleKeyDown(event, "left")}
          tabIndex={0}
          role="button"
          aria-label={`Left button: ${formatNumber(leftClicks)} clicks`}
          aria-describedby={hovered === "left" ? "mouse-visual-tooltip" : undefined}
        />

        {/* Right button region */}
        <path
          d="M 148 80 Q 148 12 80 12 L 80 80 Z"
          className={`cursor-pointer transition-colors ${
            hovered === "right" ? "fill-primary/20" : "fill-transparent"
          }`}
          onMouseEnter={() => setHovered("right")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("right")}
          onBlur={() => setHovered(null)}
          onKeyDown={(event) => handleKeyDown(event, "right")}
          tabIndex={0}
          role="button"
          aria-label={`Right button: ${formatNumber(rightClicks)} clicks`}
          aria-describedby={hovered === "right" ? "mouse-visual-tooltip" : undefined}
        />

        {/* Center dividing line */}
        <line
          x1="80"
          y1="12"
          x2="80"
          y2="80"
          className="stroke-border"
          strokeWidth="2"
        />
      </svg>

      {hovered && (
        <div
          id="mouse-visual-tooltip"
          role="tooltip"
          className="absolute -bottom-10 rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md"
        >
          {hovered === "left" ? (
            <>Left: {formatNumber(leftClicks)} clicks</>
          ) : (
            <>Right: {formatNumber(rightClicks)} clicks</>
          )}
        </div>
      )}
    </div>
  );
}
