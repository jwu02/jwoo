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
  const [hovered, setHovered] = useState<"left" | "right" | "wheel" | null>(null);

  function handleKeyDown(
    event: React.KeyboardEvent<SVGPathElement>,
    region: "left" | "right"
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setHovered((current) => (current === region ? null : region));
    }
  }

  return (
    <div className="relative flex flex-col items-center self-center">
      <svg
        viewBox="0 0 160 240"
        className="h-64 w-40 drop-shadow-sm"
        role="img"
        aria-label="Physical mouse with left and right click counts"
      >
        <defs>
          {/* Hover highlight: primary tint strongest at the top of the click
              areas, fading to transparent so it blends into the mouse body
              near the bottom. */}
          <linearGradient id="mouse-button-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

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

        {/* Left button region */}
        <path
          d="M 12 100 L 12 80 A 68 68 0 0 1 80 12 L 80 100 Z"
          className="pointer-events-none transition-opacity"
          fill="url(#mouse-button-hover)"
          opacity={hovered === "left" ? 1 : 0}
        />
        <path
          d="M 12 100 L 12 80 A 68 68 0 0 1 80 12 L 80 100 Z"
          className="cursor-pointer fill-transparent outline-none"
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
          d="M 148 100 L 148 80 A 68 68 0 0 0 80 12 L 80 100 Z"
          className="pointer-events-none transition-opacity"
          fill="url(#mouse-button-hover)"
          opacity={hovered === "right" ? 1 : 0}
        />
        <path
          d="M 148 100 L 148 80 A 68 68 0 0 0 80 12 L 80 100 Z"
          className="cursor-pointer fill-transparent outline-none"
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

        {/* Center dividing line — stops at scroll wheel top so it doesn't show through on hover */}
        <line
          x1="80"
          y1="12"
          x2="80"
          y2="50"
          className="stroke-border"
          strokeWidth="2"
        />

        {/* Scroll wheel — rendered above buttons so it can receive hover */}
        <rect
          x="68"
          y="50"
          width="24"
          height="50"
          rx="12"
          className={`cursor-pointer stroke-border outline-none transition-colors ${
            hovered === "wheel" ? "fill-primary/20" : "fill-muted"
          }`}
          strokeWidth="2"
          onMouseEnter={() => setHovered("wheel")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("wheel")}
          onBlur={() => setHovered(null)}
          tabIndex={0}
          role="button"
          aria-label="Middle click untracked, Scroll distance untracked"
          aria-describedby={hovered === "wheel" ? "mouse-visual-tooltip" : undefined}
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
          ) : hovered === "right" ? (
            <>Right: {formatNumber(rightClicks)} clicks</>
          ) : (
            <>Middle click untracked, Scroll distance untracked</>
          )}
        </div>
      )}
    </div>
  );
}
