# Telemetry Chart Range Selector and Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the time-range selector directly above the activity chart and assign a colorblind-safe palette to the four telemetry line series.

**Architecture:** The layout change is isolated to `app/page.tsx`: the `RangeSelector` is removed from the page header and placed inside the "Activity Over Time" section header. The color change is isolated to `app/globals.css`: the existing `--chart-1`..`--chart-4` variables are reassigned to Okabe-Ito colors, and `components/telemetry/activity-chart.tsx` consumes them unchanged.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, `recharts`.

## Global Constraints

- Time-range options are `24h`, `7d`, `30d`, `1y`.
- The four chart series are Left Clicks, Right Clicks, Key Presses, and Distance (m).
- Chart colors must come from the existing `--chart-1`..`--chart-4` CSS variables.
- The palette must be colorblind-safe in both light and dark modes.
- TypeScript strict mode is enabled via `tsconfig.json`.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/page.tsx` | Dashboard page layout. Remove range selector from header; add it above the activity chart. |
| `app/globals.css` | Theme variables. Reassign `--chart-1`..`--chart-4` to Okabe-Ito colors in `:root` and `.dark`. |
| `components/telemetry/activity-chart.tsx` | No changes; already reads `--chart-1`..`--chart-4` in series order. |
| `components/telemetry/range-selector.tsx` | No changes; the component itself is unchanged. |

---

## Task 1: Move Range Selector Above the Activity Chart

**Files:**
- Modify: `app/page.tsx:67-81` (header section)
- Modify: `app/page.tsx:106-109` (activity chart section)

**Interfaces:**
- Consumes: `RangeSelector` component props (`value: TelemetryRange`, `onChange: (range: TelemetryRange) => void`).
- Produces: No new interfaces; the `range` state and `setRange` callback remain in `HomePage`.

- [ ] **Step 1: Remove the range selector from the header**

Edit `app/page.tsx` so the header flex row only contains the title and "Last updated" text:

```tsx
<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight">
      Activity Telemetry
    </h1>
    {lastUpdated && (
      <p className="text-sm text-muted-foreground">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </p>
    )}
  </div>
</div>
```

- [ ] **Step 2: Add the range selector above the chart**

Replace the existing "Activity Over Time" heading block with a row that holds the heading and the selector:

```tsx
<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h2 className="text-lg font-medium">Activity Over Time</h2>
  <RangeSelector value={range} onChange={setRange} />
</div>
<ActivityChart data={data.timeSeries} range={range} />
```

- [ ] **Step 3: Run the existing test suite**

```bash
npm test
```

Expected: PASS. No existing tests assert the header DOM order, so they should remain green.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(telemetry): move range selector above activity chart

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Assign Colorblind-Safe Colors to Chart Variables

**Files:**
- Modify: `app/globals.css:69-72` (`:root` chart variables)
- Modify: `app/globals.css:104-108` (`.dark` chart variables)

**Interfaces:**
- Consumes: None.
- Produces: New values for `--chart-1`..`--chart-4` consumed by `activity-chart.tsx` via `stroke={`var(${series.color})`}`.

- [ ] **Step 1: Update light-mode chart colors**

In `app/globals.css`, replace the `:root` chart variable values with the Okabe-Ito palette subset:

```css
:root {
  /* ... existing variables ... */
  --chart-1: #0072B2;
  --chart-2: #D55E00;
  --chart-3: #009E73;
  --chart-4: #E69F00;
  /* ... */
}
```

Mapping to series (unchanged in `activity-chart.tsx`):
- `--chart-1` → Left Clicks
- `--chart-2` → Right Clicks
- `--chart-3` → Key Presses
- `--chart-4` → Distance (m)

- [ ] **Step 2: Update dark-mode chart colors**

Apply the same values inside `.dark`:

```css
.dark {
  /* ... existing variables ... */
  --chart-1: #0072B2;
  --chart-2: #D55E00;
  --chart-3: #009E73;
  --chart-4: #E69F00;
  /* ... */
}
```

- [ ] **Step 3: Verify colors are applied**

Start the dev server and open the dashboard:

```bash
npm run dev
```

Confirm visually:
1. The four lines are clearly different colors.
2. The legend colors match the line colors.
3. Colors remain distinguishable in both light and dark mode (toggle via the theme switcher or by adding/removing the `dark` class on `html`).

- [ ] **Step 4: Run the test suite and typecheck**

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(telemetry): use colorblind-safe palette for chart series

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Final Verification

**Files:**
- Verify: `app/page.tsx`
- Verify: `app/globals.css`

**Interfaces:**
- Consumes: Changes from Task 1 and Task 2.
- Produces: A working dashboard with the range selector above the chart and distinct line colors.

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no CSS or TypeScript errors.

- [ ] **Step 3: Final manual check**

1. Load the home page.
2. Confirm the range selector is no longer in the top header.
3. Confirm the range selector appears directly above the "Activity Over Time" chart.
4. Confirm the four chart lines are distinct blue, vermillion, green, and orange.
5. Switch between `24h`, `7d`, `30d`, and `1y`; confirm the chart refetches and the colors remain consistent.

- [ ] **Step 4: Commit (if any fixes were required)**

If lint or build required fixes, commit them with an appropriate message. If no fixes were required, this step is a no-op.

---

## Self-Review

**Spec coverage:**
- Move range selector above activity chart → Task 1.
- Colorblind-safe distinct colors for each telemetry plot → Task 2.
- Light and dark mode support → Task 2 updates both `:root` and `.dark`.

**Placeholder scan:**
- No "TBD", "TODO", or vague steps.
- Each code block contains the exact change.
- No references to undefined functions or types.

**Type consistency:**
- `RangeSelector` props unchanged.
- CSS variable names unchanged (`--chart-1`..`--chart-4`).
- No new TypeScript interfaces introduced.
