// components/telemetry/keyboard-heatmap.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { KeyCounts } from "@/lib/telemetry/types";
import { PHYSICAL_KEYS, buildKeyCountMap } from "@/lib/telemetry/key-layout";

interface KeyboardHeatmapProps {
  keys: KeyCounts;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function interpolateColor(intensity: number): string {
  // intensity is 0..1. Keys are always dark so the light keycap text stays
  // readable in both light and dark theme. Intensity interpolates from a dark
  // charcoal to a warm orange.
  // Base: oklch(0.25 0 0), Warm: oklch(0.64 0.16 45)
  const l = 0.25 + intensity * 0.39;
  const c = intensity * 0.16;
  const h = 45;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h})`;
}

/** Fit a keycap label to the key width, ellipsizing only when necessary. */
function fitLabel(
  displayLabel: string,
  width: number,
  height: number
): { text: string; fontSize: number } {
  if (displayLabel.length === 0) return { text: "", fontSize: 10 };
  const fontSize = height <= 28 ? 9 : 11;
  // Approximate average glyph advance for Roboto Mono at this size.
  const charWidth = fontSize * 0.6;
  const maxChars = Math.max(1, Math.floor((width - 8) / charWidth));
  const text =
    displayLabel.length <= maxChars
      ? displayLabel
      : displayLabel.slice(0, maxChars - 1) + "…";
  return { text, fontSize };
}

export function KeyboardHeatmap({ keys }: KeyboardHeatmapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aggregate raw label counts into physical-key counts
  const keyCountMap = useMemo(() => buildKeyCountMap(keys), [keys]);

  const maxCount = useMemo(() => {
    let max = 1;
    for (const count of keyCountMap.values()) {
      if (count > max) max = count;
    }
    return max;
  }, [keyCountMap]);

  const hoveredKey = useMemo(
    () => PHYSICAL_KEYS.find((key) => key.id === hovered),
    [hovered]
  );

  // For tooltip breakdown: which data labels contributed to this key's count
  const hoveredBreakdown = useMemo(() => {
    if (!hoveredKey) return [];
    return hoveredKey.labels
      .filter((label) => (keys[label] ?? 0) > 0)
      .map((label) => ({ label, count: keys[label]! }))
      .sort((a, b) => b.count - a.count);
  }, [hoveredKey, keys]);

  function showTooltip(
    keyId: string,
    event: React.MouseEvent<SVGGElement> | React.FocusEvent<SVGGElement>
  ) {
    const g = event.currentTarget;
    const container = containerRef.current;
    if (!container) return;

    const gRect = g.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setHovered(keyId);
    setTooltipPos({
      left: gRect.left - containerRect.left + gRect.width / 2 + container.scrollLeft,
      top: gRect.top - containerRect.top + container.scrollTop - 8,
    });
  }

  function hideTooltip() {
    setHovered(null);
    setTooltipPos(null);
  }

  return (
    <div ref={containerRef} className="relative overflow-x-auto">
      <svg
        viewBox="-5 -5 650 235"
        className="min-w-[650px]"
        aria-label="Keyboard heatmap"
      >
        {PHYSICAL_KEYS.map((key) => {
          const count = keyCountMap.get(key.id) ?? 0;
          const intensity = maxCount > 0 ? count / maxCount : 0;
          const fill = interpolateColor(intensity);
          const isHovered = hovered === key.id;
          const isInteractive = count > 0;
          const { text: keycapText, fontSize } = fitLabel(
            key.displayLabel,
            key.width,
            key.height
          );

          return (
            <g
              key={key.id}
              onMouseEnter={(event) => showTooltip(key.id, event)}
              onMouseLeave={hideTooltip}
              onFocus={(event) => showTooltip(key.id, event)}
              onBlur={hideTooltip}
              tabIndex={isInteractive ? 0 : -1}
              className={isInteractive ? "cursor-pointer outline-none" : "outline-none"}
              role="button"
              aria-label={`${key.id}: ${formatNumber(count)} presses`}
            >
              <rect
                x={key.x}
                y={key.y}
                width={key.width}
                height={key.height}
                rx={key.height <= 28 ? 3 : 4}
                fill={fill}
                stroke={isHovered ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={isHovered ? 1.5 : 0.75}
                className="transition-colors outline-none"
              />
              {/* Only render text if key is wide/tall enough */}
              {key.width >= 30 && key.height >= 16 && keycapText && (
                <text
                  x={key.x + key.width / 2}
                  y={key.y + key.height / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  // Keycaps are always dark, so use a fixed near-white fill
                  // rather than the theme foreground for legibility.
                  className="select-none pointer-events-none"
                  fill="oklch(0.96 0 0)"
                  style={{ fontSize }}
                >
                  <tspan className="font-medium">{keycapText}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoveredKey && tooltipPos && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
          style={{ left: tooltipPos.left, top: tooltipPos.top }}
        >
          <div className="font-medium">
            {hoveredKey.id}: {formatNumber(keyCountMap.get(hoveredKey.id) ?? 0)} presses
          </div>
          {hoveredBreakdown.length > 1 && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {hoveredBreakdown.map(({ label, count }) => (
                <div key={label}>
                  {label}: {formatNumber(count)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
