# Telemetry Chart Legend and Tooltip Text Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the telemetry activity chart so the legend shows colored squares instead of lines and both legend labels and tooltip text use the normal foreground color.

**Architecture:** The change is isolated to `components/telemetry/activity-chart.tsx`. Recharts' built-in `Legend` component gets `iconType="square"`, and the built-in `Tooltip` component gets `labelStyle` and `itemStyle` colors pointing to `var(--foreground)`. The existing series colors and chart layout remain unchanged.

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
| `components/telemetry/activity-chart.tsx` | Update `Legend` and `Tooltip` props to render square icons and normal text color. |

---

## Task 1: Update Legend and Tooltip Styling

**Files:**
- Modify: `components/telemetry/activity-chart.tsx:55-63`

**Interfaces:**
- Consumes: None.
- Produces: No new interfaces; visual rendering only.

- [ ] **Step 1: Change the legend symbol to a square**

Edit `components/telemetry/activity-chart.tsx`. Update the `Legend` component to use `iconType="square"` while keeping the existing wrapper style:

```tsx
<Legend
  iconType="square"
  wrapperStyle={{ color: "var(--foreground)" }}
/>
```

- [ ] **Step 2: Set tooltip text color to normal foreground**

Update the `Tooltip` component to add `labelStyle` and `itemStyle`:

```tsx
<Tooltip
  contentStyle={{
    backgroundColor: "var(--popover)",
    borderColor: "var(--border)",
    color: "var(--popover-foreground)",
  }}
  labelStyle={{ color: "var(--foreground)" }}
  itemStyle={{ color: "var(--foreground)" }}
  labelFormatter={(label: unknown) => formatTooltip(String(label), range)}
/>
```

The `contentStyle.color` property can remain `var(--popover-foreground)` because `labelStyle` and `itemStyle` now explicitly override the text colors.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS. The new props are valid Recharts `Legend` and `Tooltip` props.

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
- Legend labels use the same text color as the surrounding page text.
- Tooltip header (time/date) and each series row use the same text color as the surrounding page text.
- Both light and dark modes look correct.

- [ ] **Step 6: Commit**

```bash
git add components/telemetry/activity-chart.tsx
git commit -m "feat(telemetry): use square legend icons and normal text colors

- Set Legend iconType to square
- Set Tooltip labelStyle and itemStyle to var(--foreground)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

1. **Spec coverage:** All three requirements from the spec are covered in Task 1: square legend symbol, normal legend text color, normal tooltip text color.
2. **Placeholder scan:** No TBD/TODO/"implement later" patterns. Every step contains concrete code or commands.
3. **Type consistency:** No new functions or types are introduced; only existing Recharts props are added.
