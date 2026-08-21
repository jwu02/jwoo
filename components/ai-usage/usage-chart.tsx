"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
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
  /** Model names in table order; bar colors follow this order. */
  modelOrder?: string[];
}

interface Series {
  dataKey: string;
  name: string;
  color: string; // CSS variable name, e.g. "--chart-1"
  /** Tooltip prefix rendered muted, e.g. the ¥ sign in the cost table. */
  prefix?: string;
  formatValue?: (value: number) => string; // tooltip value formatter
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
// stacked bars from. Each row carries one `tokens:<model>` and one
// `cost:<model>` value, so both charts can share the same bucket list while
// the series configs select different keys. When `modelOrder` is given (the
// by-model table's order), series follow it so bar colors match the table
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

// Bar/legend color for a model, keyed to its position in the by-model table
// (modelOrder) so chart bars and table rows share one color per model even
// when a range only shows a subset of the models. Falls back to the series
// position when the model isn't in the table (e.g. no modelOrder given).
function chartColorForModel(
  model: string,
  modelOrder: string[],
  seriesIndex: number
): string {
  const tableIndex = modelOrder.indexOf(model);
  const index = tableIndex >= 0 ? tableIndex : seriesIndex;
  return `--chart-${(index % 5) + 1}`;
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
        {payload
          .map((entry) => {
            const value =
              typeof entry.value === "number" ? entry.value : Number(entry.value);
            return { entry, value };
          })
          // Skip idle models (zero in this bucket) and rank the rest by their
          // value, highest first — an unused model's "0" row adds noise, and
          // the series order (table order) need not match the bucket's ranking.
          .filter(({ value }) => value !== 0)
          .sort((a, b) => b.value - a.value)
          .map(({ entry, value }, index) => {
            const matchingSeries = series.find(
              (s) => s.dataKey === entry.dataKey
            );
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
                  {entry.name}: {matchingSeries?.prefix && (
                    <span className="text-muted-foreground">
                      {matchingSeries.prefix}
                    </span>
                  )}
                  {formatted}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

function MiniStackedBarChart({
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
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            barCategoryGap={2}
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
              <Bar
                key={entry.dataKey}
                dataKey={entry.dataKey}
                name={entry.name}
                stackId="models"
                fill={`var(${entry.color})`}
                // No stroke and no radius: a border reads as an outline, and a
                // rounded top segment tapers narrower than the one below it.
                // Square, stroke-less fills keep every segment uniform.
                maxBarSize={24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function UsageChart({ data, range, modelOrder = [] }: UsageChartProps) {
  const { rows, series } = useMemo(
    () => buildModelChartData(data, modelOrder),
    [data, modelOrder]
  );

  const tokenSeries: Series[] = series.map((entry, index) => ({
    dataKey: entry.tokensKey,
    name: entry.model,
    color: chartColorForModel(entry.model, modelOrder, index),
    formatValue: formatCompactNumber,
  }));

  const costSeries: Series[] = series.map((entry, index) => ({
    dataKey: entry.costKey,
    name: entry.model,
    color: chartColorForModel(entry.model, modelOrder, index),
    prefix: "¥",
    formatValue,
  }));

  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 outline-none [&_*]:!outline-none">
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Cost over time (¥)
          </h3>
          <MiniStackedBarChart
            data={rows}
            range={range}
            series={costSeries}
            yTickFormatter={formatCostAxisLabel}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Tokens over time
          </h3>
          <MiniStackedBarChart data={rows} range={range} series={tokenSeries} />
        </div>
        {costSeries.length > 0 && (
          <div
            data-testid="chart-legend"
            className="flex flex-wrap items-center justify-center gap-4"
          >
            {costSeries.map((entry) => (
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
    </div>
  );
}
