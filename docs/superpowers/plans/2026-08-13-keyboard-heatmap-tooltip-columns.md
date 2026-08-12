# Keyboard Heatmap Tooltip Two-Column Breakdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each breakdown row in the keyboard heatmap tooltip as a two-column flex row — label left, count right-aligned — instead of the current `{label}: {count}` text.

**Architecture:** A single presentational change in `components/telemetry/keyboard-heatmap.tsx`. The breakdown `<div key={label}>{label}: {count}</div>` becomes `<div className="flex justify-between gap-3"><span>{label}</span><span className="tabular-nums">{count}</span></div>`. The tooltip shrink-wraps to its widest row, so every count right-aligns into a column; `tabular-nums` keeps digits monospaced so counts of differing width still align. No data-model, layout, or aggregation changes.

**Tech Stack:** Next.js 16 / React 19, Tailwind CSS v4, Jest + @testing-library/react (jsdom).

## Global Constraints

- Use the `@/*` path alias for imports (`@/components/...`, `@/lib/...`).
- Tests live under `tests/`, mirroring the source tree.
- Run a single test file with `npx jest tests/components/telemetry/keyboard-heatmap.test.tsx`.
- Commit messages use conventional-commit style with a `(telemetry)` scope (e.g. `feat(telemetry): ...`).
- Do not change telemetry aggregation, `lib/telemetry/key-layout.ts`, or the "N presses" header / "Touch ID untracked" tooltip copy.

---

### Task 1: Two-column breakdown rows in the heatmap tooltip

**Files:**
- Modify: `components/telemetry/keyboard-heatmap.tsx:292-300` (the `{hoveredBreakdown.map(...)}` block inside the tooltip)
- Modify: `tests/components/telemetry/keyboard-heatmap.test.tsx` (add a `describe` block)

**Interfaces:**
- Consumes: nothing new — uses existing local `formatNumber(value: number): string` (`Intl.NumberFormat("en-US")`) already in the component.
- Produces: none (presentational change; no other task depends on it).

**Context:** Each physical key is rendered as `<g role="button" aria-label="{key.id}: {count} presses">`. Hovering (`onMouseEnter`) sets `hovered` + `tooltipAnchor`. The tooltip shows a bold header `{formatNumber(total)} presses`, then — only when a key has more than one contributing label — a breakdown of each label's count. The `2` key maps labels `["2", "@", "€"]`, so `<KeyboardHeatmap keys={{ "2": 5, "@": 3 }} />` gives the `2` key a total of 8 presses and a breakdown of `2 → 5`, `@ → 3` (sorted count-descending: `2` row first).

- [ ] **Step 1: Write the failing test**

Append inside `describe("KeyboardHeatmap")` in `tests/components/telemetry/keyboard-heatmap.test.tsx`:

```tsx
describe("tooltip breakdown", () => {
  it("renders each contributing label and its count as separate, non-colon-joined elements", () => {
    render(<KeyboardHeatmap keys={{ "2": 5, "@": 3 }} />);

    // The 2 key aggregates to 8 presses (5 + 3); hover to open its tooltip.
    fireEvent.mouseEnter(screen.getByRole("button", { name: "2: 8 presses" }));

    const tooltip = screen.getByText("8 presses").parentElement!;
    // Breakdown is sorted by count descending, so the "2 → 5" row comes first.
    const row = within(tooltip).getByText("2").closest("div")!;

    const spans = row.querySelectorAll("span");
    expect(spans).toHaveLength(2);
    expect(spans[0]).toHaveTextContent("2");
    expect(spans[1]).toHaveTextContent("5");
    expect(row.textContent).not.toContain(":");
  });
});
```

The existing imports (`fireEvent, render, screen, within` from `@testing-library/react`) already cover this test — no import changes needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/components/telemetry/keyboard-heatmap.test.tsx -t "two-column"`
Expected: FAIL — the current markup is a single text node `{label}: {formatNumber(count)}`, so the row has no `span` elements and `spans` is empty (`expect(spans).toHaveLength(2)` fails), and `row.textContent` contains `":"`.

- [ ] **Step 3: Implement the two-column rows**

In `components/telemetry/keyboard-heatmap.tsx`, replace the breakdown block:

```tsx
{hoveredBreakdown.length > 1 && (
  <div className="mt-1 text-[10px] text-muted-foreground">
    {hoveredBreakdown.map(({ label, count }) => (
      <div key={label}>
        {label}: {formatNumber(count)}
      </div>
    ))}
  </div>
)}
```

with:

```tsx
{hoveredBreakdown.length > 1 && (
  <div className="mt-1 text-[10px] text-muted-foreground">
    {hoveredBreakdown.map(({ label, count }) => (
      <div key={label} className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums">{formatNumber(count)}</span>
      </div>
    ))}
  </div>
)}
```

`justify-between` pushes the count to the right edge; the tooltip shrink-wraps to its widest row so every count lines up into a column. `tabular-nums` keeps digits monospaced so `5` and `12` align.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/components/telemetry/keyboard-heatmap.test.tsx -t "two-column"`
Expected: PASS (2 spans, label `2`, count `5`, no `:`).

- [ ] **Step 5: Run the full suite, typecheck, and lint**

Run: `npm test`
Expected: all tests pass (including the existing heatmap, activity-chart, mouse-visual, and lib suites).

Run: `npm run typecheck` — expected: no errors.
Run: `npm run lint` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/telemetry/keyboard-heatmap.tsx tests/components/telemetry/keyboard-heatmap.test.tsx
git commit -m "feat(telemetry): render heatmap tooltip breakdown as two-column rows

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(Do not `git add` unrelated working-tree changes such as the modified `lib/telemetry/*` files present in this repo.)

