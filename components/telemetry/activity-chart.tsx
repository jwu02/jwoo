"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";

const RANGE_FORMATS: Record<
  TelemetryRange,
  Intl.DateTimeFormatOptions
> = {
  "24h": { hour: "numeric" },
  "7d": { weekday: "short", day: "numeric" },
  "30d": { month: "short", day: "numeric" },
  "1y": { month: "short" },
};

interface ActivityChartProps {
  data: TimeSeriesPoint[];
  range: TelemetryRange;
  dataKey: "leftClicks" | "rightClicks" | "keyPresses" | "movementMeters";
  name: string;
  color: string;
}

export function ActivityChart({
  data,
  range,
  dataKey,
  name,
  color,
}: ActivityChartProps) {
  const stroke = color.startsWith("--")
    ? `hsl(var(${color}))`
    : color;

  function formatTick(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", RANGE_FORMATS[range]);
  }

  return (
    <div className="h-72 w-full rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{name}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
              formatter={(value: unknown) => [String(value), name]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={name}
              stroke={stroke}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
