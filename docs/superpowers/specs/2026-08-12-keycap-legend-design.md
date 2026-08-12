# Keyboard Heatmap: Apple-Style Keycap Legend

## Context

`components/telemetry/keyboard-heatmap.tsx` renders each physical key with a
centered base character (`displayLabel`, fontSize 11) and an optional small
accent (`secondaryLabel`, fontSize 8) drawn at the **top-center** of the keycap.
The layout data in `lib/telemetry/key-layout.ts` gives several keys a third
printable character — `2` → `2`/`@`/`€` and `3` → `3`/`£`/`#` — but the renderer
has no slot to draw it, so `€` and `#` never appear on the keycap.

This change makes the keycaps read like a real UK Mac keycap: the shifted
character sits small at the **top-left**, and the option-modified character
(`€` on 2, `#` on 3) sits small on the **right side** of the key, level with the
base character.

## Goals

- Render `€` to the right of the `2` and `#` to the right of the `3` (the
  option-modified characters), matching the user's physical UK Mac keyboard.
- Move the small shifted character from top-center to **top-left** on all keys
  that have one.
- Keep all accent characters at one small, consistent font size and at
  consistent positions relative to the base character.
- Clarify the data model so the three keycap slots are unambiguous: base,
  shift, option.

## Non-Goals

- Change telemetry aggregation (`buildKeyCountMap`) or tracked labels.
- Change the keycap geometry, tooltip content, or heatmap color scheme.
- Add `optionLabel` to any key other than `2` and `3` (no other key has a third
  printable character in the current layout).
- Support non-UK layouts.

## Design

### Data model (`lib/telemetry/key-layout.ts`)

`PhysicalKeyDef` gains a second optional accent slot, and the existing one is
renamed to make the three slots explicit:

- Rename `secondaryLabel` → `shiftLabel` (the small shifted character, rendered
  top-left). Mechanical rename across all key definitions and tests.
- Add `optionLabel?: string` — the small option-modified character rendered on
  the right side of the keycap.
- Update the field comment (the old one incorrectly claimed "upper-right
  corner"; it is now unambiguously top-left).
- Set `optionLabel` on exactly two keys:
  - `2` → `€` (option+2)
  - `3` → `#` (option+3)

`shiftLabel` values are unchanged (`1`→`!`, `3`→`£`, `§`→`±`, etc.). Letters,
modifiers, and single-character keys have neither field.

### Rendering (`components/telemetry/keyboard-heatmap.tsx`)

Three accent rules (base character unchanged: centered, fontSize 11 / 9):

1. **Base** (`displayLabel`) — centered, large.
2. **Shift** (`shiftLabel`) — small (fontSize 8), **top-left** of the keycap
   (e.g. `x = key.x + 8`, `y = key.y + 9`, `textAnchor="middle"`).
3. **Option** (`optionLabel`, new) — small (fontSize 8), **right side**,
   vertically centered with the base character so it reads as "to the right of"
   the base (e.g. `x = key.x + key.width − 8`, `y = key.y + key.height / 2`).

Both accent texts keep the fixed near-white fill and `pointer-events-none`
behavior of the current secondary label. Only render accents when the key is
wide/tall enough, matching the existing `width >= 30 && height >= 16` guard.

Resulting keycaps for the two changed keys:

```
2 key:      3 key:
  @           £
  2  €        3  #
```

All other keys with a shift accent simply move from top-center to top-left.

### Tooltips

Unchanged. `€` and `#` are already present in each key's `labels` array and
already appear in the hover breakdown, so the tooltip needs no data change.

## Components

### `lib/telemetry/key-layout.ts` (modified)

- Rename `secondaryLabel` → `shiftLabel` on all key definitions.
- Add `optionLabel?: string` to `PhysicalKeyDef`.
- Set `optionLabel: "€"` on the `2` key and `optionLabel: "#"` on the `3` key.

### `components/telemetry/keyboard-heatmap.tsx` (modified)

- Replace the current top-center secondary `<text>` with a **top-left** render
  of `shiftLabel`.
- Add a right-side `<text>` render of `optionLabel` when present.

## Error Handling

No new error states. An absent accent field simply renders nothing, as today.

## Testing

- `npm test` — existing suite, plus:
  - `key-layout.test.ts`: update all `secondaryLabel` references to
    `shiftLabel`; assert `2.optionLabel === "€"` and `3.optionLabel === "#"`;
    assert other keys have no `optionLabel`.
  - New `keyboard-heatmap.test.tsx` component test: render the heatmap with a
    sample `KeyCounts` input and assert the rendered SVG contains the texts
    `2`, `@`, `€`, `3`, `£`, and `#`.
- `npm run typecheck`
- `npm run lint`
- Manual verification: hover over the `2` and `3` keys and confirm the on-keycap
  glyphs match the reference diagram above.

## Out of Scope

- Changing telemetry aggregation or tracked labels.
- Adding option characters to keys beyond `2` and `3`.
- Supporting other keyboard layouts.
- Any geometry or tooltip redesign.
