# Telemetry Chart Legend and Tooltip Text Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the telemetry activity chart so the legend shows colored squares, legend labels use the normal foreground color, and the tooltip shows colored squares next to each series with all text in the normal foreground color.

**Architecture:** The change is isolated to `components/telemetry/activity-chart.tsx`. Recharts' built-in `Legend` component gets `iconType="square"` and a custom `formatter` to explicitly set label text color. The default `Tooltip` is replaced by a custom tooltip component that renders colored squares from the payload and applies `var(--foreground)` to all text. The existing series colors and chart layout remain unchanged.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `recharts`.

## Global Constraints

- The four chart series are Left Clicks, Right Clicks, Key Presses, and Distance (m).
- Series colors must continue to come from `--chart-1`..`--chart-4`.
- Text colors must use the theme's CSS variables (`--foreground`).
- TypeScript strict mode is enabled via `tsconfig.json`.

---

## File Structure

| File | Responsibility |
|---|---|
| `components/telemetry/activity-chart.tsx` | Update `Legend` props, replace default `Tooltip` with a custom tooltip component, and add the helper tooltip component. |

---

## Task 1: Update Legend and Tooltip Styling

**Files:**
- Modify: `components/telemetry/activity-chart.tsx`

**Interfaces:**
- Consumes: None.
- Produces: No new interfaces; visual rendering only.

- [ ] **Step 1: Change the legend symbol to a square and force label color**

Edit `components/telemetry/activity-chart.tsx`. Update the `Legend` component to use `iconType="square"` and a `formatter` that explicitly sets the label text color:

```tsx
<Legend
  iconType="square"
  wrapperStyle={{ color: "var(--foreground)" }}
  formatter={(value) => (
    <span style={{ color: "var(--foreground)" }}>{value}</span>
  )}
/>
```

- [ ] **Step 2: Add a custom tooltip with colored squares and normal text color**

Add a new `ActivityChartTooltip` helper component inside the same file. It receives `TooltipContentProps` plus a `range` prop and renders:

```tsx
function ActivityChartTooltip({
  active,
  payload,
  label,
  range,
}: TooltipContentProps & { range: TelemetryRange }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-sm shadow-sm"
      style={{
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
      }}
    >
      <p className="mb-1 font-medium" style={{ color: "var(--foreground)" }}>
        {formatTooltip(String(label ?? ""), range)}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: "var(--foreground)" }}>
              {entry.name}: {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Then update the chart's `Tooltip` to use the custom component:

```tsx
<Tooltip
  content={(props) => <ActivityChartTooltip {...props} range={range} />}
/>
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the existing test suite**

```bash
npm test
```

Expected: PASS. No existing tests assert chart legend or tooltip styling.

- [ ] **Step 5: Verify manually**

Start the dev server if needed and open the dashboard:

```bash
npm run dev
```

Hover over the chart to show the tooltip and confirm:
- Each legend entry displays a small colored square to the left of its label.
- Legend labels (below the x-axis) use the same text color as the surrounding page text.
- Tooltip header (time/date) uses the normal text color.
- Each tooltip row shows a small colored square followed by the series name and value in normal text color.
- Both light and dark modes look correct.

- [ ] **Step 6: Commit**

```bash
git add components/telemetry/activity-chart.tsx
git commit -m "feat(telemetry): square legend icons, square tooltip markers, normal text colors

- Set Legend iconType to square and formatter to var(--foreground)
- Replace default Tooltip with custom ActivityChartTooltip
- Custom tooltip shows colored squares and var(--foreground) text

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

1. **Spec coverage:** All four requirements from the spec are covered in Task 1: square legend symbol, normal legend text color, normal tooltip text color, and colored squares in the tooltip.
2. **Placeholder scan:** No TBD/TODO/"implement later" patterns. Every step contains concrete code or commands.
3. **Type consistency:** `TooltipContentProps` from `recharts` is used consistently; the custom tooltip helper receives the same props Recharts passes to default content.
