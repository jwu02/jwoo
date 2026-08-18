import { AiUsageByModel } from "@/lib/telemetry/types";

interface ModelBreakdownProps {
  byModel: AiUsageByModel[];
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function ModelBreakdown({ byModel }: ModelBreakdownProps) {
  if (byModel.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
    );
  }

  const sorted = [...byModel].sort((a, b) => b.costYuan - a.costYuan);
  const maxCost = Math.max(...sorted.map((model) => model.costYuan));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="pb-2 font-medium">Model</th>
          <th className="pb-2 text-right font-medium">Requests</th>
          <th className="pb-2 text-right font-medium">Total Tokens</th>
          <th className="pb-2 text-right font-medium">Cost</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((model, index) => {
          const width = maxCost > 0 ? (model.costYuan / maxCost) * 100 : 0;
          return (
            <tr key={model.model} className="border-b border-border/50">
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        backgroundColor: `var(--chart-${(index % 5) + 1})`,
                      }}
                    />
                  </div>
                  <span data-model={model.model} className="font-medium">
                    {model.model}
                  </span>
                </div>
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatNumber(model.requests)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatNumber(model.totalTokens)}
              </td>
              <td className="py-2 text-right tabular-nums">
                <span className="text-muted-foreground">¥</span>
                {formatNumber(model.costYuan, 2)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
