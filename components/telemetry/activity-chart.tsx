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
} from "recharts";
import { TimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import { formatTick, formatTooltip } from "@/lib/telemetry/chart-format";

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
            contentStyle={{
              backgroundColor: "var(--popover)",
              borderColor: "var(--border)",
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(label: unknown) => formatTooltip(String(label), range)}
          />
          <Legend wrapperStyle={{ color: "var(--foreground)" }} />
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
