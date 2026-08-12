# Keyboard Heatmap: Two-Column Tooltip Breakdown

## Context

The keyboard heatmap tooltip (`components/telemetry/keyboard-heatmap.tsx`) shows
a bold "N presses" header and, for keys with more than one contributing label, a
breakdown of which labels make up the count. Each breakdown row is currently a
single text node joining label and count with a colon:

```jsx
<div key={label}>
  {label}: {formatNumber(count)}
</div>
```

Which renders as `a: 5`, `A: 3`, `Shift: 2` — the colon sits tight against the
label, and the counts do not line up, making the rows harder to scan.

## Goals

- Separate the character from its press count so the count reads as a distinct
  right-aligned column.
- Keep the bold "N presses" header and the "Touch ID untracked" case unchanged.
- Minimal change; no data-model or test-surface alterations.

## Non-Goals

- Change telemetry aggregation, key layouts, or the header/touch-ID tooltip
  content.
- Redesign the tooltip beyond the breakdown rows.

## Design

Replace each breakdown row's text node with a two-column flex row in
`components/telemetry/keyboard-heatmap.tsx`:

```jsx
<div key={label} className="flex justify-between gap-3">
  <span>{label}</span>
  <span className="tabular-nums">{formatNumber(count)}</span>
</div>
```

- `justify-between` pushes the count to the right edge. The tooltip
  shrink-wraps to its widest row, so every count right-aligns into one column.
- `tabular-nums` keeps digits monospaced so counts of differing width (e.g. `5`
  vs `12`) still align.
- The existing `text-[10px] text-muted-foreground` container styling is
  unchanged.

Resulting breakdown:

```
a       5
A       3
Shift   2
```

## Components

### `components/telemetry/keyboard-heatmap.tsx` (modified)

- Replace the breakdown row markup (the `{hoveredBreakdown.map(...)}` block) with
  the flex-row layout above.

## Error Handling

None. A key with a single contributing label never renders the breakdown, as
today.

## Testing

- `npm test` — existing suite. No test currently asserts the breakdown rows'
  text, so no test changes are expected; the suite verifies nothing regresses.
- `npm run typecheck`
- Manual verification: hover a key with multiple contributing labels (e.g. a
  letter key with both base and shifted presses) and confirm the counts line up
  in a right-aligned column.

## Out of Scope

- Altering the "N presses" header or "Touch ID untracked" copy.
- Changing aggregation or layout data.
- Any other tooltip redesign.
