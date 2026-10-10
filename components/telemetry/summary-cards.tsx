import { TelemetryTotals } from "@/lib/telemetry/types";
import { formatNumber } from "@/lib/ui/chart-format";

interface SummaryCardsProps {
  totals: TelemetryTotals;
}

// The card shell, repeated per total rather than configured into an array: only
// one of the four carries a unit.
const CARD =
  "rounded-xl bg-card p-4 text-card-foreground shadow-sm";

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className={CARD}>
        <div className="text-2xl font-semibold tabular-nums">
          {formatNumber(totals.totalKeyPresses)}
        </div>
        <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Key Presses
        </span>
      </div>
      <div className={CARD}>
        <div className="text-2xl font-semibold tabular-nums">
          {formatNumber(totals.leftClicks)}
        </div>
        <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Left Clicks
        </span>
      </div>
      <div className={CARD}>
        <div className="text-2xl font-semibold tabular-nums">
          {formatNumber(totals.rightClicks)}
        </div>
        <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Right Clicks
        </span>
      </div>
      <div className={CARD}>
        <div className="text-2xl font-semibold tabular-nums">
          {formatNumber(totals.movementMeters)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">m</span>
        </div>
        <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mouse Movement
        </span>
      </div>
    </div>
  );
}
