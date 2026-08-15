"use client";

import { useState } from "react";

type HoverRegion = "left" | "right" | "wheel" | "body";

interface MouseVisualProps {
  leftClicks: number;
  rightClicks: number;
  movementMeters: number;
}

function formatNumber(value: number): string {
  // Round to a whole integer so fractional movement distances render cleanly.
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function MouseVisual({ leftClicks, rightClicks, movementMeters }: MouseVisualProps) {
  const [hovered, setHovered] = useState<HoverRegion | null>(null);

  function handleKeyDown(
    event: React.KeyboardEvent<SVGElement>,
    region: HoverRegion
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
        aria-label="Physical mouse with click counts and movement distance"
      >
        <defs>
          {/* Hover highlight: primary tint strongest at the top of the click
              areas, fading to transparent so it blends into the mouse body
              near the bottom. */}
          <linearGradient id="mouse-button-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          {/* Body hover highlight: same tint, fading from the bottom of the
              palm area up toward the buttons. */}
          <linearGradient id="mouse-body-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
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

        {/* Mouse body — palm area below the buttons and wheel. The path
            mirrors the mouse silhouette (straight sides meeting a radius-70
            bottom arc) at a uniform 2px inset so the highlight stays
            parallel to the outline. */}
        <path
          d="M 12 100 L 12 160 A 68 68 0 0 0 148 160 L 148 100 Z"
          className="pointer-events-none transition-opacity"
          fill="url(#mouse-body-hover)"
          opacity={hovered === "body" ? 1 : 0}
        />
        <path
          d="M 12 100 L 12 160 A 68 68 0 0 0 148 160 L 148 100 Z"
          className="cursor-pointer fill-transparent outline-none"
          onMouseEnter={() => setHovered("body")}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered("body")}
          onBlur={() => setHovered(null)}
          onKeyDown={(event) => handleKeyDown(event, "body")}
          tabIndex={0}
          role="button"
          aria-label={`Mouse body: ${formatNumber(movementMeters)} m moved`}
          aria-describedby={hovered === "body" ? "mouse-visual-tooltip" : undefined}
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
          ) : hovered === "body" ? (
            <>Mouse movement: {formatNumber(movementMeters)} m</>
          ) : (
            <>Middle click untracked, Scroll distance untracked</>
          )}
        </div>
      )}
    </div>
  );
}
