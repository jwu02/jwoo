"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipContentProps,
} from "recharts";
import { TimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import {
  formatCompactNumber,
  formatTick,
  formatTooltip,
} from "@/lib/telemetry/chart-format";

interface ActivityChartTooltipProps extends Partial<TooltipContentProps> {
  range: TelemetryRange;
}

function ActivityChartTooltip({
  active,
  payload,
  label,
  range,
}: ActivityChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-sm shadow-sm"
      style={{
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
      }}
    >
      <p
        className="mb-1 border-b border-border pb-1 font-medium"
        style={{ color: "var(--foreground)" }}
      >
        {formatTooltip(String(label), range)}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span style={{ color: "var(--foreground)" }}>{entry.name}</span>
            </span>
            <span
              className="shrink-0 text-right tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {entry.dataKey === "movementMeters" && typeof entry.value === "number"
                ? Math.round(entry.value)
                : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ActivityChartProps {
  data: TimeSeriesPoint[];
  range: TelemetryRange;
}

const SERIES = [
  { dataKey: "keyPresses", name: "Key Presses", color: "--chart-3" },
  { dataKey: "leftClicks", name: "Left Clicks", color: "--chart-1" },
  { dataKey: "rightClicks", name: "Right Clicks", color: "--chart-2" },
  { dataKey: "movementMeters", name: "Mouse Movement (m)", color: "--chart-4" },
] as const;

export function ActivityChart({ data, range }: ActivityChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const ticks = useMemo(
    () => getTicksForRange(data.map((point) => point.bucket), range),
    [data, range]
  );

  const toggleSeries = (dataKey: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  return (
    <div className="w-full space-y-2 rounded-xl border border-border bg-card p-4 outline-none [&_*]:!outline-none">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="bucket"
              ticks={ticks}
              tickFormatter={(value: string) => formatTick(value, range)}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            {/* width="auto" measures the tick labels instead of reserving the
                default 60px, so the plot fills the surface — which matters most
                on narrow screens, where 60px is a quarter of the width. */}
            <YAxis
              width="auto"
              tickFormatter={(value: number) => formatCompactNumber(value)}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            <Tooltip content={<ActivityChartTooltip range={range} />} />
            {SERIES.map((series) => (
              <Line
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                stroke={`var(${series.color})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                hide={hidden.has(series.dataKey)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-0">
        {SERIES.map((series) => {
          const isHidden = hidden.has(series.dataKey);
          return (
            <button
              key={series.dataKey}
              type="button"
              onClick={() => toggleSeries(series.dataKey)}
              aria-pressed={isHidden}
              aria-label={isHidden ? `Show ${series.name}` : `Hide ${series.name}`}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors hover:bg-muted ${
                isHidden ? "text-muted-foreground opacity-50" : "text-foreground"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{
                  backgroundColor: `var(${series.color})`,
                  opacity: isHidden ? 0.5 : 1,
                }}
              />
              {series.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
