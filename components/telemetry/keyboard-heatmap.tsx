// components/telemetry/keyboard-heatmap.tsx
"use client";

import { useMemo, useState } from "react";
import { KeyCounts } from "@/lib/telemetry/types";

interface KeyboardHeatmapProps {
  keys: KeyCounts;
}

interface KeyDef {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ROWS: KeyDef[][] = [
  [
    { label: "Grave", x: 0, y: 0, width: 40, height: 40 },
    { label: "1", x: 45, y: 0, width: 40, height: 40 },
    { label: "2", x: 90, y: 0, width: 40, height: 40 },
    { label: "3", x: 135, y: 0, width: 40, height: 40 },
    { label: "4", x: 180, y: 0, width: 40, height: 40 },
    { label: "5", x: 225, y: 0, width: 40, height: 40 },
    { label: "6", x: 270, y: 0, width: 40, height: 40 },
    { label: "7", x: 315, y: 0, width: 40, height: 40 },
    { label: "8", x: 360, y: 0, width: 40, height: 40 },
    { label: "9", x: 405, y: 0, width: 40, height: 40 },
    { label: "0", x: 450, y: 0, width: 40, height: 40 },
    { label: "Minus", x: 495, y: 0, width: 40, height: 40 },
    { label: "Equal", x: 540, y: 0, width: 40, height: 40 },
    { label: "Delete", x: 585, y: 0, width: 80, height: 40 },
  ],
  [
    { label: "Tab", x: 0, y: 45, width: 65, height: 40 },
    { label: "Q", x: 70, y: 45, width: 40, height: 40 },
    { label: "W", x: 115, y: 45, width: 40, height: 40 },
    { label: "E", x: 160, y: 45, width: 40, height: 40 },
    { label: "R", x: 205, y: 45, width: 40, height: 40 },
    { label: "T", x: 250, y: 45, width: 40, height: 40 },
    { label: "Y", x: 295, y: 45, width: 40, height: 40 },
    { label: "U", x: 340, y: 45, width: 40, height: 40 },
    { label: "I", x: 385, y: 45, width: 40, height: 40 },
    { label: "O", x: 430, y: 45, width: 40, height: 40 },
    { label: "P", x: 475, y: 45, width: 40, height: 40 },
    { label: "Left Bracket", x: 520, y: 45, width: 40, height: 40 },
    { label: "Right Bracket", x: 565, y: 45, width: 40, height: 40 },
    { label: "Backslash", x: 610, y: 45, width: 55, height: 40 },
  ],
  [
    { label: "Caps Lock", x: 0, y: 90, width: 75, height: 40 },
    { label: "A", x: 80, y: 90, width: 40, height: 40 },
    { label: "S", x: 125, y: 90, width: 40, height: 40 },
    { label: "D", x: 170, y: 90, width: 40, height: 40 },
    { label: "F", x: 215, y: 90, width: 40, height: 40 },
    { label: "G", x: 260, y: 90, width: 40, height: 40 },
    { label: "H", x: 305, y: 90, width: 40, height: 40 },
    { label: "J", x: 350, y: 90, width: 40, height: 40 },
    { label: "K", x: 395, y: 90, width: 40, height: 40 },
    { label: "L", x: 440, y: 90, width: 40, height: 40 },
    { label: "Semicolon", x: 485, y: 90, width: 40, height: 40 },
    { label: "Quote", x: 530, y: 90, width: 40, height: 40 },
    { label: "Return", x: 575, y: 90, width: 90, height: 40 },
  ],
  [
    { label: "Left Shift", x: 0, y: 135, width: 95, height: 40 },
    { label: "Z", x: 100, y: 135, width: 40, height: 40 },
    { label: "X", x: 145, y: 135, width: 40, height: 40 },
    { label: "C", x: 190, y: 135, width: 40, height: 40 },
    { label: "V", x: 235, y: 135, width: 40, height: 40 },
    { label: "B", x: 280, y: 135, width: 40, height: 40 },
    { label: "N", x: 325, y: 135, width: 40, height: 40 },
    { label: "M", x: 370, y: 135, width: 40, height: 40 },
    { label: "Comma", x: 415, y: 135, width: 40, height: 40 },
    { label: "Period", x: 460, y: 135, width: 40, height: 40 },
    { label: "Slash", x: 505, y: 135, width: 40, height: 40 },
    { label: "Right Shift", x: 550, y: 135, width: 115, height: 40 },
  ],
  [
    { label: "Left Ctrl", x: 0, y: 180, width: 50, height: 40 },
    { label: "Left Option", x: 55, y: 180, width: 50, height: 40 },
    { label: "Left Cmd", x: 110, y: 180, width: 55, height: 40 },
    { label: "Space", x: 170, y: 180, width: 250, height: 40 },
    { label: "Right Cmd", x: 425, y: 180, width: 55, height: 40 },
    { label: "Right Option", x: 485, y: 180, width: 50, height: 40 },
    { label: "Right Ctrl", x: 540, y: 180, width: 50, height: 40 },
  ],
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function interpolateColor(intensity: number): string {
  // intensity is 0..1. Return OKLCH color from neutral to warm orange.
  // Using CSS variables is hard inside SVG, so use fixed OKLCH values.
  // Neutral: oklch(0.97 0 0), Warm: oklch(0.7 0.15 45)
  const l = 0.97 - intensity * 0.27;
  const c = intensity * 0.15;
  const h = 45;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h})`;
}

export function KeyboardHeatmap({ keys }: KeyboardHeatmapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxCount = useMemo(() => {
    const values = Object.values(keys);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [keys]);

  const allKeys = useMemo(() => ROWS.flat(), []);

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox="-5 -5 680 235"
        className="min-w-[680px]"
        aria-label="Keyboard heatmap"
      >
        {allKeys.map((key) => {
          const count = keys[key.label] ?? 0;
          const intensity = maxCount > 0 ? count / maxCount : 0;
          const fill = interpolateColor(intensity);
          const isHovered = hovered === key.label;

          return (
            <g
              key={key.label}
              onMouseEnter={() => setHovered(key.label)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key.label)}
              onBlur={() => setHovered(null)}
              tabIndex={count > 0 ? 0 : -1}
              className={count > 0 ? "cursor-pointer" : ""}
            >
              <rect
                x={key.x}
                y={key.y}
                width={key.width}
                height={key.height}
                rx="4"
                fill={fill}
                stroke={isHovered ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={isHovered ? 2 : 1}
                className="transition-colors"
              />
              <text
                x={key.x + key.width / 2}
                y={key.y + key.height / 2 + 4}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium select-none pointer-events-none"
              >
                {key.label.length > 3 ? key.label.slice(0, 2) : key.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md">
          {hovered}: {formatNumber(keys[hovered] ?? 0)} presses
        </div>
      )}
    </div>
  );
}
