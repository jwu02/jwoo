# Keyboard Heatmap: Match MacBook Air M3 UK Layout

## Context

The telemetry dashboard renders a keyboard heatmap in `components/telemetry/keyboard-heatmap.tsx`. The underlying layout is defined in `lib/telemetry/key-layout.ts`. The current layout is close to a UK Mac keyboard but differs from the MacBook Air M3 UK layout in a few visible ways: the function keys are shorter than the rest, keycaps only show a single centered character, there is no Caps Lock LED, and there is no Touch ID button in the function row.

## Goals

- Make the rendered keyboard match the MacBook Air M3 UK layout shown in the reference image.
- Function keys should be the same height as standard keys.
- Keycaps should show a main centered character and a smaller shifted character in the upper-right corner where applicable.
- Render a green LED on the Caps Lock key.
- Add a Touch ID / fingerprint button to the right of F12 with an "untracked" tooltip.

## Non-Goals

- Change the telemetry aggregation logic (`buildKeyCountMap`).
- Add new tracked keys or change how counts are produced.
- Redesign the heatmap color scheme or tooltip style for tracked keys.
- Support non-UK layouts.

## Design

### Data model

Add an optional `secondaryLabel?: string` field to `PhysicalKeyDef`. This holds the small shifted character shown in the upper-right corner of a keycap. Keeping it as a simple optional string keeps the layout data readable and avoids over-generalizing the rendering code.

The Touch ID key will be added to the function row with a distinct id (`Touch ID`) so the renderer can show a fingerprint icon and an untracked tooltip instead of press counts.

### Layout geometry

- Raise the function-row height constant `F_H` from **28 px** to **34 px**, matching the standard key height `KH` and the photo.
- Add the Touch ID key immediately to the right of F12, separated by the same function-group gap (`FGAP`) used between F4/F5 and F8/F9.
- The Touch ID key will be the same height as the function keys and the same width as a standard key (`K = 38 px`).
- The arrow cluster remains an inverted T: full-height left/right arrows with half-height up/down stacked between them.

Because the function row grows by 6 px, every row below it shifts down by 6 px. The SVG `viewBox` still has enough margin, so no viewBox change is required.

### Keycap labels

- Main label (`displayLabel`) stays centered in the keycap.
- If `secondaryLabel` is present, render a smaller text element near the upper-right corner of the keycap.
- Apply `secondaryLabel` to all keys that have a shifted variant on the UK layout:
  - `§` → `±`
  - `1` → `!`
  - `2` → `"`
  - `3` → `£`
  - `4` → `$`
  - `5` → `%`
  - `6` → `^`
  - `7` → `&`
  - `8` → `*`
  - `9` → `(`
  - `0` → `)`
  - `-` → `_`
  - `=` → `+`
  - `[` → `{`
  - `]` → `}`
  - `\` → `|`
  - `;` → `:`
  - `'` → `@`
  - `,` → `<`
  - `.` → `>`
  - `/` → `?`

Letters and modifier keys have no secondary label.

### Caps Lock LED

Render a small green dot on the Caps Lock keycap. The dot will be positioned near the upper-left of the key rectangle, small enough to read as an indicator (around 3–4 px radius), and use a fixed green color (`oklch(0.7 0.2 145)` or similar) so it is visible regardless of heatmap intensity.

### Touch ID button

- Render a key-sized rounded rectangle to the right of F12.
- Draw a small fingerprint SVG icon centered on the key.
- On hover or focus, show a tooltip reading **"Touch ID untracked"** instead of the usual press-count tooltip.
- It does not contribute to the heatmap intensity and has no count data.

### Tooltips

- Existing tracked keys keep the current press-count tooltip with breakdown.
- Touch ID uses a static untracked tooltip, similar to the mouse scroll wheel in `components/telemetry/mouse-visual.tsx`.

## Components

### `lib/telemetry/key-layout.ts` (modified)

- Add `secondaryLabel?: string` to `PhysicalKeyDef`.
- Change `F_H` from `28` to `34`.
- Add `secondaryLabel` values to the number/symbol key definitions.
- Add a `Touch ID` key to `F_ROW`, to the right of F12.

### `components/telemetry/keyboard-heatmap.tsx` (modified)

- Render `secondaryLabel` as a smaller `<text>` element anchored near the upper-right of the keycap when present.
- Render a green LED circle on the Caps Lock key.
- Render a fingerprint SVG icon for the Touch ID key.
- For the Touch ID key, bypass the normal tooltip and show "Touch ID untracked".

## Error Handling

No new error states. Touch ID is not tracked, so it simply displays zero or no count and the untracked tooltip.

## Testing

- `npm test` — existing suite, especially `tooltip-position.test.ts` and any key-layout tests.
- `npm run typecheck`
- `npm run lint`
- Manual verification:
  - Compare the rendered keyboard to the reference image.
  - Confirm function keys are the same height as standard keys.
  - Confirm secondary characters appear in the upper-right of applicable keys.
  - Confirm the green LED appears on Caps Lock.
  - Confirm the Touch ID button is to the right of F12 and shows "Touch ID untracked" on hover.
  - Confirm tracked key tooltips still show press counts.

## Out of Scope

- Changing telemetry aggregation or tracked labels.
- Adding animations or transitions beyond the existing color transition.
- Supporting other keyboard layouts.
- Making the LED react to actual Caps Lock state (it is a static visual indicator).
