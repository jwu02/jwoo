import { AiUsageTotals } from "@/lib/telemetry/types";

interface SummaryCardsProps {
  totals: AiUsageTotals;
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Raw token counts are too long to read at a glance in a card, so totals are
// always expressed in millions and the "M" moves into the unit slot, mirroring
// the cost card's "¥".
function formatMillions(value: number): string {
  return Number((value / 1_000_000).toFixed(1)).toString();
}

export function SummaryCards({ totals }: SummaryCardsProps) {
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
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
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
