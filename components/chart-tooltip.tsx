import type { ReactNode } from "react";

/**
 * The card shell both dashboards' chart tooltips draw their rows in: a bordered
 * popover panel with a title row. Callers own the rows, which are the only part
 * that differs between a line chart's series list and a stacked bar chart's
 * per-model breakdown.
 */
export function ChartTooltipCard({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-md border px-3 py-2 text-sm shadow-sm"
      style={{
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
      }}
    >
      {/* The header divider is itself a separator, so it only belongs when
          there is a breakdown beneath it. */}
      <p
        className={`${
          children ? "mb-1 border-b border-border pb-1" : ""
        } font-medium`}
        style={{ color: "var(--foreground)" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}
