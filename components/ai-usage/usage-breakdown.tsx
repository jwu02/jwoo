"use client";

import { useState, useSyncExternalStore } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  TooltipContentProps,
} from "recharts";
import { ChartTooltipCard } from "@/components/chart-tooltip";
import {
  appearanceServerSnapshot,
  appearanceSnapshot,
  subscribeAppearance,
} from "@/components/os/appearance";
import { formatNumber } from "@/lib/ui/chart-format";
// The breakdown sits under the chart and covers the same token counts, so it
// reads them through the chart's own formatter rather than a second one.
import { formatTokenValue } from "@/components/ai-usage/usage-chart";
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

function formatShare(share: number): string {
  return `${formatNumber(share, 1)}%`;
}

/** Where a slice's arc sits in the donut box, as percentages of its width/height. */
export function ringPosition(
  slices: { share: number }[],
  index: number
): { left: number; top: number } {
  const before = slices
    .slice(0, index)
    .reduce((sum, slice) => sum + slice.share, 0);
  // Recharts' Pie starts at 0° (3 o'clock) and sweeps anticlockwise, so the
  // arc's midpoint is this far round; the card sits on the middle of the band.
  const midAngle = ((before + (slices[index]?.share ?? 0) / 2) / 100) * 360;
  const radians = (midAngle * Math.PI) / 180;
  return {
    left: 50 + Math.cos(radians) * 40,
    top: 50 - Math.sin(radians) * 40,
  };
}

function DonutTooltip({ active, payload }: Partial<TooltipContentProps>) {
  if (!active || !payload || payload.length === 0) return null;

  const slice = payload[0]?.payload as { share: number } | undefined;
  if (!slice) return null;

  // The share alone: the legend already carries the segment's name and value,
  // so there is nothing else for the card to say.
  return <ChartTooltipCard title={formatShare(slice.share)} />;
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
  /** The exact value a row stands for, printed in the legend. */
  formatValue: (value: number) => string;
}) {
  // Which segment is in hand — and whether the pointer is on the sector or on
  // its legend row. Muting follows either; the card is drawn here only for a
  // legend hover, since a sector hover already has the chart's own tooltip.
  const [hovered, setHovered] = useState<{
    label: string;
    from: "segment" | "legend";
  } | null>(null);
  const segments = buildDonutSegments(rows, metric);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const slices = segments.map((segment, index) => ({
    ...segment,
    share: total > 0 ? (segment.value / total) * 100 : 0,
    color: segmentColor(segment.label, index, colorMap),
  }));

  // A poll can replace the rows and drop the held label; then nothing is lit,
  // and every slice would dim with none in hand.
  const active =
    hovered && slices.some((slice) => slice.label === hovered.label)
      ? hovered
      : null;
  const dimmed = (label: string) => active !== null && active.label !== label;
  // A legend hover shows the share on the ring where the segment sits, the way
  // the chart's own tooltip would; a sector hover already gets that tooltip.
  const legendIndex =
    active?.from === "legend"
      ? slices.findIndex((slice) => slice.label === active.label)
      : -1;
  const legendTooltip =
    legendIndex >= 0 ? ringPosition(slices, legendIndex) : null;

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
              and value as real text, so nothing here is load-bearing for a
              screen reader, and nothing needs a hover. */}
          <div className="relative h-40 w-40 shrink-0" aria-hidden>
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
                  onMouseEnter={(_, index) => {
                    const label = slices[index]?.label;
                    if (label) setHovered({ label, from: "segment" });
                  }}
                  onMouseLeave={() => setHovered(null)}
                >
                  {slices.map((slice) => (
                    <Cell
                      key={slice.label}
                      fill={slice.color}
                      fillOpacity={dimmed(slice.label) ? 0.3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {legendTooltip && (
              <div
                data-testid="legend-tooltip"
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${legendTooltip.left}%`,
                  top: `${legendTooltip.top}%`,
                }}
              >
                <ChartTooltipCard
                  title={formatShare(slices[legendIndex]?.share ?? 0)}
                />
              </div>
            )}
          </div>
          <ul className="w-full space-y-1 text-sm">
            {slices.map((slice) => (
              <li
                key={slice.label}
                onMouseEnter={() =>
                  setHovered({ label: slice.label, from: "legend" })
                }
                onMouseLeave={() => setHovered(null)}
                className={`flex items-center justify-between gap-2 transition-opacity ${
                  dimmed(slice.label) ? "opacity-30" : ""
                }`}
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
                  {formatValue(slice.value)}
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
  // The sibling shades' direction follows the appearance (lib/ai-usage/colors).
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    appearanceSnapshot,
    appearanceServerSnapshot
  );

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
    );
  }

  // Sibling models of a known provider get distinct shades (matching the chart
  // legend), so a model reads the same way in the donut, the legend and the
  // chart above even when a donut folds it into `Others`.
  const colorMap = aiUsageColorMap(
    rows.map((row) => row.label),
    appearance
  );

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
        formatValue={formatTokenValue}
      />
    </div>
  );
}
