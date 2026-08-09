"use client";

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

const RANGE_FORMATS: Record<TelemetryRange, Intl.DateTimeFormatOptions> = {
  "24h": { hour: "numeric" },
  "7d": { weekday: "short", day: "numeric" },
  "30d": { month: "short", day: "numeric" },
  "1y": { month: "short" },
};

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
  function formatTick(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", RANGE_FORMATS[range]);
  }

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
            tickFormatter={formatTick}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--popover-foreground))",
            }}
            labelFormatter={(label: unknown) =>
              new Date(String(label)).toLocaleString()
            }
          />
          <Legend />
          {SERIES.map((series) => (
            <Line
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey}
              name={series.name}
              stroke={`hsl(var(${series.color}))`}
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
