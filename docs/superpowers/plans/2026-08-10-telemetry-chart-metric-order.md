# Telemetry Chart Metric Display Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display telemetry metrics in the fixed order **Key Presses → Left Clicks → Right Clicks → Mouse Movement** across the summary cards, the chart legend/lines, and the chart tooltip, and rename the movement metric label.

**Architecture:** Reorder the two existing presentation arrays — `SERIES` in `activity-chart.tsx` and `items` in `summary-cards.tsx`. The legend renders from `SERIES.map(...)`, and the recharts tooltip payload is built in the order the `<Line>` components are rendered (verified in recharts 3.10: `tooltipItemPayloads` uses `push`/`splice`, never re-sorts). So reordering `SERIES` propagates to legend, lines, and tooltip at once. Hiding/showing a series only filters `SERIES` (`visibleSeries`), so relative order is preserved everywhere.

**Tech Stack:** Next.js (App Router), React, TypeScript, recharts 3.10.1, Jest + @testing-library/react.

## Global Constraints

- Canonical display order on all three surfaces: **Key Presses → Left Clicks → Right Clicks → Mouse Movement**.
- Movement metric label: **"Mouse Movement"** on the summary card, **"Mouse Movement (m)"** in the chart legend (unit kept in the legend name because the legend has no separate unit field).
- Data keys, chart colors, icons, and units are unchanged:

| Metric | dataKey | Color | Card icon | Card unit |
|---|---|---|---|---|
| Key Presses | `keyPresses` | `--chart-3` | `Keyboard` | – |
| Left Clicks | `leftClicks` | `--chart-1` | `MousePointerClick` | – |
| Right Clicks | `rightClicks` | `--chart-2` | `MousePointer` | – |
| Mouse Movement | `movementMeters` | `--chart-4` | `Ruler` | `m` |

- The tooltip must keep the canonical order even after a series is hidden via the legend.
- Test pattern: hidden-series toggling is already covered by existing tests; the new order tests assert DOM order directly.

---

### Task 1: Activity chart order and label

**Files:**
- Modify: `components/telemetry/activity-chart.tsx:59-64` (the `SERIES` array)
- Test: `tests/components/telemetry/activity-chart.test.tsx`

**Interfaces:**
- Consumes: nothing new — `SERIES` entries keep the shape `{ dataKey: string; name: string; color: string }`, referenced by `visibleSeries` and the legend `SERIES.map`.
- Produces: `SERIES` in canonical order; series name for the movement metric is now `"Mouse Movement (m)"`.

- [ ] **Step 1: Write the failing tests**

In `tests/components/telemetry/activity-chart.test.tsx`, update the two existing assertions that reference `Distance \(m\)` → `Mouse Movement \(m\)`:

```tsx
// line 35 — legend presence test
expect(screen.getByRole("button", { name: /Hide Mouse Movement \(m\)/i })).toBeInTheDocument();

// lines 80-85 — aria-pressed test
const distanceButton = screen.getByRole("button", { name: /Hide Mouse Movement \(m\)/i });
expect(distanceButton).toHaveAttribute("aria-pressed", "false");

fireEvent.click(distanceButton);

expect(screen.getByRole("button", { name: /Show Mouse Movement \(m\)/i })).toHaveAttribute("aria-pressed", "true");
```

Add three new tests at the end of the `describe("ActivityChart", ...)` block:

```tsx
it("renders legend items in canonical metric order", () => {
  const { container } = render(<ActivityChart data={buildData()} range="24h" />);

  const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

  expect(labels).toEqual([
    "Key Presses",
    "Left Clicks",
    "Right Clicks",
    "Mouse Movement (m)",
  ]);
});

it("renders series lines in canonical order", () => {
  const { container } = render(<ActivityChart data={buildData()} range="24h" />);

  // recharts builds the tooltip payload in Line render order, so the DOM order
  // of the line curves is a faithful proxy for tooltip payload order.
  const strokes = Array.from(container.querySelectorAll(".recharts-line-curve")).map(
    (path) => path.getAttribute("stroke")
  );

  expect(strokes).toEqual([
    "var(--chart-3)", // Key Presses
    "var(--chart-1)", // Left Clicks
    "var(--chart-2)", // Right Clicks
    "var(--chart-4)", // Mouse Movement
  ]);
});

it("keeps tooltip series order after hiding a middle series", () => {
  const { container } = render(<ActivityChart data={buildData()} range="24h" />);

  fireEvent.click(screen.getByRole("button", { name: /Hide Left Clicks/i }));

  const strokes = Array.from(container.querySelectorAll(".recharts-line-curve")).map(
    (path) => path.getAttribute("stroke")
  );

  expect(strokes).toEqual([
    "var(--chart-3)", // Key Presses
    "var(--chart-2)", // Right Clicks
    "var(--chart-4)", // Mouse Movement
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/telemetry/activity-chart.test.tsx`
Expected: FAIL — `Mouse Movement (m)` not found (button still says "Distance (m)"), legend/line order is still Left Clicks first, and the line strokes are `[--chart-1, --chart-2, --chart-3, --chart-4]`.

- [ ] **Step 3: Implement the reorder and rename**

In `components/telemetry/activity-chart.tsx`, replace the `SERIES` array (lines 59-64):

```tsx
const SERIES = [
  { dataKey: "keyPresses", name: "Key Presses", color: "--chart-3" },
  { dataKey: "leftClicks", name: "Left Clicks", color: "--chart-1" },
  { dataKey: "rightClicks", name: "Right Clicks", color: "--chart-2" },
  { dataKey: "movementMeters", name: "Mouse Movement (m)", color: "--chart-4" },
] as const;
```

No other code changes: the legend `SERIES.map(...)`, `visibleSeries = SERIES.filter(...)`, and the `<Line>` map all consume this array as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/components/telemetry/activity-chart.test.tsx`
Expected: PASS — all ActivityChart tests.

- [ ] **Step 5: Commit**

```bash
git add components/telemetry/activity-chart.tsx tests/components/telemetry/activity-chart.test.tsx
git commit -m "feat(telemetry): reorder activity chart series and rename movement label

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Summary cards order and label

**Files:**
- Modify: `components/telemetry/summary-cards.tsx:16-38` (the `items` array)
- Test: `tests/components/telemetry/summary-cards.test.tsx`

**Interfaces:**
- Consumes: `TelemetryTotals` from `@/lib/telemetry/types` (fields `totalKeyPresses`, `leftClicks`, `rightClicks`, `movementMeters`); lucide icons `MousePointerClick`, `MousePointer`, `Ruler`, `Keyboard`.
- Produces: cards rendered in canonical order with the movement label `"Mouse Movement"` (unit `"m"` unchanged).

- [ ] **Step 1: Write the failing test**

Add to the `describe("SummaryCards", ...)` block in `tests/components/telemetry/summary-cards.test.tsx`:

```tsx
it("renders cards in canonical order with Mouse Movement label", () => {
  const { container } = render(<SummaryCards totals={totals} />);

  const cards = Array.from(container.querySelectorAll(".grid > div"));
  const labels = cards.map((card) => card.querySelector("span")?.textContent);

  expect(labels).toEqual([
    "Key Presses",
    "Left Clicks",
    "Right Clicks",
    "Mouse Movement",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/telemetry/summary-cards.test.tsx`
Expected: FAIL — labels are `["Left Clicks", "Right Clicks", "Mouse Distance", "Key Presses"]`.

- [ ] **Step 3: Implement the reorder and rename**

In `components/telemetry/summary-cards.tsx`, replace the `items` array (lines 16-38):

```tsx
const items = [
  {
    label: "Key Presses",
    value: totals.totalKeyPresses,
    icon: Keyboard,
  },
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
    label: "Mouse Movement",
    value: totals.movementMeters,
    unit: "m",
    icon: Ruler,
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/components/telemetry/summary-cards.test.tsx`
Expected: PASS — both SummaryCards tests.

- [ ] **Step 5: Commit**

```bash
git add components/telemetry/summary-cards.tsx tests/components/telemetry/summary-cards.test.tsx
git commit -m "feat(telemetry): reorder summary cards and rename movement label

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev` and open the telemetry dashboard. Verify:
- Summary cards read, in order: Key Presses, Left Clicks, Right Clicks, Mouse Movement (with `m` unit).
- Chart legend reads, in order: Key Presses, Left Clicks, Right Clicks, Mouse Movement (m).
- Hovering the chart shows the tooltip in the same order.
- Hiding Left Clicks via the legend keeps the tooltip order as Key Presses, Right Clicks, Mouse Movement (m).

- [ ] **Step 5: Commit any remaining changes**

If manual verification surfaced fixes, commit them with a descriptive message. Otherwise nothing to commit.
