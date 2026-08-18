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
import { AiUsageRange, AiUsageModelTimeSeries } from "@/lib/telemetry/types";
import { getTicksForRange } from "@/lib/telemetry/chart-ticks";
import {
  formatTick,
  formatTooltip,
  formatCompactNumber,
} from "@/lib/telemetry/chart-format";

interface UsageChartProps {
  data: AiUsageModelTimeSeries[];
  range: AiUsageRange;
  /** Model names in table order; line colors follow this order. */
  modelOrder?: string[];
}

interface Series {
  dataKey: string;
  name: string;
  color: string; // CSS variable name, e.g. "--chart-1"
  formatValue?: (value: number) => string; // tooltip value formatter, e.g. ¥ prefix
}

interface ModelSeriesConfig {
  model: string;
  tokensKey: string;
  costKey: string;
}

interface ChartRow {
  bucket: string;
  [key: string]: string | number;
}

function formatValue(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// Cost y-axis labels: yuan values are small, so keep decimals and skip the M/K
// compaction (which would round 0.01 to "0" via toFixed(1)).
export function formatCostAxisLabel(value: number): string {
  const decimals = Math.abs(value) < 1 ? 4 : 2;
  return Number(value.toFixed(decimals)).toString();
}

// Flattens per-model time series into chart rows that Recharts can draw
// multiple lines from. Each row carries one `tokens:<model>` and one
// `cost:<model>` value, so both charts can share the same bucket list while
// the series configs select different keys. When `modelOrder` is given (the
// by-model table's order), series follow it so line colors match the table
// rows; otherwise the input (API) order is kept, which is cost descending
// within the selected range.
export function buildModelChartData(
  timeSeriesByModel: AiUsageModelTimeSeries[],
  modelOrder: string[] = []
): { rows: ChartRow[]; series: ModelSeriesConfig[] } {
  const ordered =
    modelOrder.length === 0
      ? timeSeriesByModel
      : [...timeSeriesByModel].sort((a, b) => {
          const indexA = modelOrder.indexOf(a.model);
          const indexB = modelOrder.indexOf(b.model);
          if (indexA === -1 && indexB === -1) return a.model.localeCompare(b.model);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });

  const series = ordered.map((entry) => ({
    model: entry.model,
    tokensKey: `tokens:${entry.model}`,
    costKey: `cost:${entry.model}`,
  }));

  const buckets = ordered[0]?.points.map((point) => point.bucket) ?? [];
  const pointsByModel = ordered.map((entry) =>
    new Map(entry.points.map((point) => [point.bucket, point]))
  );

  const rows = buckets.map((bucket) => {
    const row: ChartRow = { bucket };
    for (let m = 0; m < pointsByModel.length; m++) {
      const point = pointsByModel[m].get(bucket);
      row[series[m].tokensKey] = point?.totalTokens ?? 0;
      row[series[m].costKey] = point?.costYuan ?? 0;
    }
    return row;
  });

  return { rows, series };
}

function UsageChartTooltip({
  active,
  payload,
  label,
  range,
  series,
}: Partial<TooltipContentProps> & { range: AiUsageRange; series: Series[] }) {
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
        {payload.map((entry, index) => {
          const matchingSeries = series.find(
            (s) => s.dataKey === entry.dataKey
          );
          const value =
            typeof entry.value === "number" ? entry.value : Number(entry.value);
          const formatted = matchingSeries?.formatValue
            ? matchingSeries.formatValue(value)
            : formatValue(value);
          return (
            <li key={index} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span style={{ color: "var(--foreground)" }}>
                {entry.name}: {formatted}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MiniLineChart({
  data,
  series,
  range,
  yTickFormatter = formatCompactNumber,
}: {
  data: ChartRow[];
  series: Series[];
  range: AiUsageRange;
  yTickFormatter?: (value: number) => string;
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
              tickFormatter={(value: number) => yTickFormatter(value)}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              stroke="var(--foreground)"
            />
            <Tooltip content={<UsageChartTooltip range={range} series={series} />} />
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

export function UsageChart({ data, range, modelOrder }: UsageChartProps) {
  const { rows, series } = useMemo(
    () => buildModelChartData(data, modelOrder),
    [data, modelOrder]
  );

  const tokenSeries: Series[] = series.map((entry, index) => ({
    dataKey: entry.tokensKey,
    name: entry.model,
    color: `--chart-${(index % 5) + 1}`,
    formatValue: formatCompactNumber,
  }));

  const costSeries: Series[] = series.map((entry, index) => ({
    dataKey: entry.costKey,
    name: entry.model,
    color: `--chart-${(index % 5) + 1}`,
    formatValue: (value: number) => `¥${formatValue(value)}`,
  }));

  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 outline-none [&_*]:!outline-none">
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Tokens over time
          </h3>
          <MiniLineChart data={rows} range={range} series={tokenSeries} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Cost over time (¥)
          </h3>
          <MiniLineChart
            data={rows}
            range={range}
            series={costSeries}
            yTickFormatter={formatCostAxisLabel}
          />
        </div>
      </div>
    </div>
  );
}
