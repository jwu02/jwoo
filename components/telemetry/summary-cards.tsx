import { TelemetryTotals } from "@/lib/telemetry/types";
import { MousePointerClick, MousePointer, Ruler, Keyboard } from "lucide-react";

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
      label: "Left Clicks",
      value: totals.leftClicks,
      icon: MousePointerClick,
    },
    {
      label: "Right Clicks",
      value: totals.rightClicks,
      icon: MousePointer,
    },
    {
      label: "Mouse Distance",
      value: totals.movementMeters,
      unit: "m",
      icon: Ruler,
    },
    {
      label: "Key Presses",
      value: totals.totalKeyPresses,
      icon: Keyboard,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
            {item.unit ? formatNumber(item.value, 2) : formatNumber(item.value)}
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
