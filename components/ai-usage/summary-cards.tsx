import { AiUsageTotals } from "@/lib/telemetry/types";
import { formatCompactNumber } from "@/lib/telemetry/chart-format";
import { Coins, Cpu, FileInput, FileOutput, Gauge, RefreshCcw } from "lucide-react";

interface SummaryCardsProps {
  totals: AiUsageTotals;
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function cacheHitRate(totals: AiUsageTotals): string {
  const total = totals.cacheHitTokens + totals.cacheMissTokens;
  if (total === 0) return "0%";
  return `${Math.round((totals.cacheHitTokens / total) * 100)}%`;
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  const items = [
    {
      label: "Cost",
      value: formatNumber(totals.costYuan, 2),
      unit: "¥",
      unitBefore: true,
      icon: Coins,
    },
    {
      label: "Total Tokens",
      value: formatCompactNumber(totals.totalTokens),
      icon: Cpu,
    },
    {
      label: "Prompt Tokens",
      value: formatCompactNumber(totals.promptTokens),
      icon: FileInput,
    },
    {
      label: "Completion Tokens",
      value: formatCompactNumber(totals.completionTokens),
      icon: FileOutput,
    },
    {
      label: "Cache Hit Rate",
      value: cacheHitRate(totals),
      icon: Gauge,
    },
    {
      label: "Requests",
      value: formatNumber(totals.requests),
      icon: RefreshCcw,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <item.icon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              {item.label}
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {item.unitBefore ? (
              <span className="mr-1 text-sm font-normal text-muted-foreground">
                {item.unit}
              </span>
            ) : null}
            {item.value}
            {!item.unitBefore && item.unit ? (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {item.unit}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
