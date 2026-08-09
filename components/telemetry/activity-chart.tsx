"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipContentProps,
} from "recharts";
import { TimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import { formatTick, formatTooltip } from "@/lib/telemetry/chart-format";

function ActivityChartTooltip({
  active,
  payload,
  label,
  range,
}: TooltipContentProps & { range: TelemetryRange }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-sm shadow-sm"
      style={{
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
      }}
    >
      <p className="mb-1 font-medium" style={{ color: "var(--foreground)" }}>
        {formatTooltip(String(label ?? ""), range)}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: "var(--foreground)" }}>
              {entry.name}: {entry.value}
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
  { dataKey: "leftClicks", name: "Left Clicks", color: "--chart-1" },
  { dataKey: "rightClicks", name: "Right Clicks", color: "--chart-2" },
  { dataKey: "keyPresses", name: "Key Presses", color: "--chart-3" },
  { dataKey: "movementMeters", name: "Distance (m)", color: "--chart-4" },
] as const;

export function ActivityChart({ data, range }: ActivityChartProps) {
  const ticks = useMemo(
    () => getTicksForRange(data.map((point) => point.bucket), range),
    [data, range]
  );

  return (
    <div className="h-80 w-full rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket"
            ticks={ticks}
            tickFormatter={(value: string) => formatTick(value, range)}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            content={(props) => <ActivityChartTooltip {...props} range={range} />}
          />
          <Legend
            iconType="square"
            wrapperStyle={{ color: "var(--foreground)" }}
            formatter={(value) => (
              <span style={{ color: "var(--foreground)" }}>{value}</span>
            )}
          />
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
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
