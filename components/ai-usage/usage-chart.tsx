"use client";

import { useMemo } from "react";
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
import { AiUsageTimeSeriesPoint, TelemetryRange } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import { formatTick, formatTooltip } from "@/lib/telemetry/chart-format";

interface UsageChartProps {
  data: AiUsageTimeSeriesPoint[];
  range: TelemetryRange;
}

interface Series {
  dataKey: string;
  name: string;
  color: string; // CSS variable name, e.g. "--chart-1"
}

function formatValue(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function UsageChartTooltip({
  active,
  payload,
  label,
  range,
}: Partial<TooltipContentProps> & { range: TelemetryRange }) {
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
          <li key={index} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: "var(--foreground)" }}>
              {entry.name}:{" "}
              {typeof entry.value === "number"
                ? formatValue(entry.value)
                : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniLineChart({
  data,
  series,
  range,
}: {
  data: AiUsageTimeSeriesPoint[];
  series: Series[];
  range: TelemetryRange;
}) {
  const ticks = useMemo(
    () => getTicksForRange(data.map((point) => point.bucket), range),
    [data, range]
  );

  return (
    <div>
      <div className="h-48">
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
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            <Tooltip content={<UsageChartTooltip range={range} />} />
            {series.map((entry) => (
              <Line
                key={entry.dataKey}
                type="monotone"
                dataKey={entry.dataKey}
                name={entry.name}
                stroke={`var(${entry.color})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          {series.map((entry) => (
            <span
              key={entry.dataKey}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: `var(${entry.color})` }}
              />
              {entry.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function UsageChart({ data, range }: UsageChartProps) {
  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 outline-none [&_*]:!outline-none">
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Tokens over time
          </h3>
          <MiniLineChart
            data={data}
            range={range}
            series={[
              {
                dataKey: "promptTokens",
                name: "Prompt Tokens",
                color: "--chart-1",
              },
              {
                dataKey: "completionTokens",
                name: "Completion Tokens",
                color: "--chart-3",
              },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Cost over time (¥)
          </h3>
          <MiniLineChart
            data={data}
            range={range}
            series={[
              { dataKey: "costYuan", name: "Cost", color: "--chart-2" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
