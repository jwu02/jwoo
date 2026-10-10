"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  TooltipContentProps,
} from "recharts";
import { ChartTooltipCard } from "@/components/chart-tooltip";
import { formatNumber } from "@/lib/ui/chart-format";
import {
  aiUsageColorMap,
  aiUsageColorVar,
  AI_USAGE_OTHERS_COLOR,
} from "@/lib/ai-usage/colors";
import {
  BreakdownMetric,
  BreakdownRow,
  buildDonutSegments,
  OTHERS_SEGMENT,
} from "@/lib/ai-usage/breakdown";

interface UsageBreakdownProps {
  rows: BreakdownRow[];
  /** What a row is a row of ("Model", "Project", "Harness"), for the donut's
   *  accessible name; the visible grouping already lives in the pills above. */
  labelHeader: string;
}

// A segment's color: the shared per-name color when it has one, the neutral
// for the combined segment, and the positional --chart-N fallback otherwise.
// The `Others` slice must never wear a brand hue or a chart slot: it is not a
// model or a project, and a reader would take it for one.
export function segmentColor(
  label: string,
  index: number,
  colorMap: Map<string, string>
): string {
  if (label === OTHERS_SEGMENT) return AI_USAGE_OTHERS_COLOR;
  return colorMap.get(label) ?? aiUsageColorVar(label, index);
}

function DonutTooltip({
  active,
  payload,
  formatValue,
}: Partial<TooltipContentProps> & {
  formatValue: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const slice = payload[0]?.payload as
    | { label: string; value: number; share: number }
    | undefined;
  if (!slice) return null;

  return (
    <ChartTooltipCard title={slice.label}>
      <div className="flex items-center justify-between gap-4">
        <span style={{ color: "var(--foreground)" }}>
          {formatValue(slice.value)}
        </span>
        <span className="text-muted-foreground">
          {formatNumber(slice.share, 1)}%
        </span>
      </div>
    </ChartTooltipCard>
  );
}

function Donut({
  rows,
  metric,
  title,
  emptyLabel,
  labelHeader,
  colorMap,
  formatValue,
}: {
  rows: BreakdownRow[];
  metric: BreakdownMetric;
  title: string;
  emptyLabel: string;
  labelHeader: string;
  colorMap: Map<string, string>;
  /** The exact value the legend's percentage stands for, shown on hover. */
  formatValue: (value: number) => string;
}) {
  const segments = buildDonutSegments(rows, metric);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const slices = segments.map((segment, index) => ({
    ...segment,
    share: total > 0 ? (segment.value / total) * 100 : 0,
    color: segmentColor(segment.label, index, colorMap),
  }));

  return (
    // The figure names the grouping for assistive tech; the pills above name
    // it for everyone else, so it is not repeated as visible text.
    <figure
      aria-label={`${title} by ${labelHeader}`}
      className="rounded-xl bg-card p-4"
    >
      <figcaption className="mb-3 text-sm font-medium text-muted-foreground">
        {title}
      </figcaption>
      {slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* The donut is decoration: the legend beneath it carries every name
              and share as real text, so nothing here is load-bearing for a
              screen reader, and nothing needs a hover. */}
          <div className="h-40 w-40 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="none"
                  // Polling replaces the rows on an interval; without this the
                  // donut re-grows its slices on every poll.
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip formatValue={formatValue} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1 text-sm">
            {slices.map((slice) => (
              <li
                key={slice.label}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span
                    data-label={slice.label}
                    className="truncate font-medium"
                  >
                    {slice.label}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatNumber(slice.share, 1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}

export function UsageBreakdown({ rows, labelHeader }: UsageBreakdownProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
    );
  }

  // Sibling models of a known provider get distinct shades (matching the chart
  // legend), so a model reads the same way in the donut, the legend and the
  // chart above even when a donut folds it into `Others`.
  const colorMap = aiUsageColorMap(rows.map((row) => row.label));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Donut
        rows={rows}
        metric="costYuan"
        title="Cost (¥)"
        emptyLabel="No cost recorded in this range."
        labelHeader={labelHeader}
        colorMap={colorMap}
        formatValue={(value) => `¥${formatNumber(value, 2)}`}
      />
      <Donut
        rows={rows}
        metric="totalTokens"
        title="Tokens"
        emptyLabel="No tokens recorded in this range."
        labelHeader={labelHeader}
        colorMap={colorMap}
        // The exact count, not a rounded K/M figure: the legend beside it reads
        // at one decimal, and the tooltip is where the real number lives.
        formatValue={(value) => formatNumber(value)}
      />
    </div>
  );
}
