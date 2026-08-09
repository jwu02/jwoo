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
import { TimeSeriesPoint } from "@/lib/telemetry/types";

interface ActivityChartProps {
  data: TimeSeriesPoint[];
}

function formatTick(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="h-80 w-full rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket"
            tickFormatter={formatTick}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--popover-foreground))",
            }}
            labelFormatter={(label: unknown) => new Date(String(label)).toLocaleString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="leftClicks"
            name="Left Clicks"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="rightClicks"
            name="Right Clicks"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="keyPresses"
            name="Key Presses"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="movementMeters"
            name="Distance (m)"
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
