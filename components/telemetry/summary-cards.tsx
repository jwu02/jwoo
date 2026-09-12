import { TelemetryTotals } from "@/lib/telemetry/types";

interface SummaryCardsProps {
  totals: TelemetryTotals;
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  const items = [
    {
      label: "Key Presses",
      value: totals.totalKeyPresses,
    },
    {
      label: "Left Clicks",
      value: totals.leftClicks,
    },
    {
      label: "Right Clicks",
      value: totals.rightClicks,
    },
    {
      label: "Mouse Movement",
      value: totals.movementMeters,
      unit: "m",
      decimals: 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </span>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatNumber(item.value, item.decimals ?? 0)}
            {item.unit ? (
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
