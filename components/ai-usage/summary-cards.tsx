import { Totals } from "@/lib/ai-usage/types";
import { formatNumber } from "@/lib/ui/chart-format";

interface SummaryCardsProps {
  totals: Totals;
}

// Raw token counts are too long to read at a glance in a card, so totals are
// always expressed in millions and the "M" moves into the unit slot, mirroring
// the cost card's "¥".
function formatMillions(value: number): string {
  return Number((value / 1_000_000).toFixed(1)).toString();
}

// The share of prompt tokens served from the prompt cache, as a percentage.
// Hit and miss partition the prompt tokens, so the pair is the denominator —
// completion tokens are never billed against the cache and stay out of it. A
// pair summing to zero is an unknown rate, not a zero one: it says nothing
// about caching rather than saying caching never happened.
function cacheHitRate(hitTokens: number, missTokens: number): number | null {
  const cachedPromptTokens = hitTokens + missTokens;
  if (cachedPromptTokens === 0) return null;
  return (hitTokens / cachedPromptTokens) * 100;
}

// An unknown rate has no unit to wear, so the value and its unit move together
// rather than each re-deciding what "unknown" looks like.
function formatHitRate(hitRate: number | null): {
  value: string;
  unit: string;
} {
  if (hitRate === null) return { value: "—", unit: "" };
  return { value: formatNumber(hitRate, 1), unit: "%" };
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  const hitRate = cacheHitRate(totals.cacheHitTokens, totals.cacheMissTokens);

  const items = [
    {
      label: "Cost",
      value: formatNumber(totals.costYuan, 2),
      unit: "¥",
      unitBefore: true,
    },
    {
      label: "Total Tokens",
      value: formatMillions(totals.totalTokens),
      unit: "M",
    },
    {
      label: "Cache Hit Rate",
      ...formatHitRate(hitRate),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </span>
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
