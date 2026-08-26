import { ReactNode } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { formatCompactNumber } from "@/lib/telemetry/chart-format";
import {
  aiUsageColorMap,
  aiUsageColorVar,
} from "@/lib/telemetry/ai-usage-colors";

export interface UsageBreakdownRow {
  /** Stable unique key for the row. */
  id: string;
  label: string;
  costYuan: number;
  totalTokens: number;
}

interface UsageBreakdownProps {
  rows: UsageBreakdownRow[];
  labelHeader: string;
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Share of the column total, rounded to a whole percent. Returns 0 when the
// total is 0 so a division-by-zero never yields NaN.
function shareOfTotal(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function StatCell({
  ariaLabel,
  rawValue,
  display,
  total,
  color,
}: {
  ariaLabel: string;
  rawValue: number;
  display: ReactNode;
  total: number;
  color: string;
}) {
  const pct = shareOfTotal(rawValue, total);
  return (
    <td className="py-2 tabular-nums">
      <div className="flex items-center justify-start gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={ariaLabel}
                className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            }
          />
          <TooltipContent>{pct}%</TooltipContent>
        </Tooltip>
        <span>{display}</span>
      </div>
    </td>
  );
}

export function UsageBreakdown({ rows, labelHeader }: UsageBreakdownProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
    );
  }

  const sorted = [...rows].sort((a, b) => b.costYuan - a.costYuan);
  // Sibling models of a known provider get distinct shades (matching the chart
  // legend), so the table rows read as separate models within one brand hue.
  const colorMap = aiUsageColorMap(rows.map((row) => row.label));
  const totals = {
    tokens: rows.reduce((sum, row) => sum + row.totalTokens, 0),
    cost: rows.reduce((sum, row) => sum + row.costYuan, 0),
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="pb-2 font-medium">{labelHeader}</th>
          <th className="pb-2 font-medium">Cost</th>
          <th className="pb-2 font-medium">Total Tokens</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, index) => {
          const color =
            colorMap.get(row.label) ?? aiUsageColorVar(row.label, index);
          const label = (
            <span data-label={row.label} className="font-medium">
              {row.label}
            </span>
          );
          return (
            <tr key={row.id} className="border-b border-border/50">
              <td className="py-2">{label}</td>
              <StatCell
                ariaLabel={`${row.label} cost share`}
                rawValue={row.costYuan}
                display={
                  <>
                    <span className="text-muted-foreground">¥</span>
                    {formatNumber(row.costYuan, 2)}
                  </>
                }
                total={totals.cost}
                color={color}
              />
              <StatCell
                ariaLabel={`${row.label} tokens share`}
                rawValue={row.totalTokens}
                display={formatCompactNumber(row.totalTokens)}
                total={totals.tokens}
                color={color}
              />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
