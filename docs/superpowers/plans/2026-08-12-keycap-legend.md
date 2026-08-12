# Keyboard Heatmap Apple-Style Keycap Legend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render keycaps like a real UK Mac — base char centered large, shift char top-left small, and option char (`€` on `2`, `#` on `3`) on the right side small.

**Architecture:** Two data-model changes in `lib/telemetry/key-layout.ts` (rename `secondaryLabel` → `shiftLabel`, add `optionLabel?: string` on exactly the `2` and `3` keys), then a rendering change in `components/telemetry/keyboard-heatmap.tsx` that positions the shift accent top-left and draws the option accent on the right. No aggregation, tooltip, or geometry changes.

**Tech Stack:** React 19 / Next.js 16, TypeScript, SVG, Jest + Testing Library (jsdom).

## Global Constraints

- `optionLabel` is set on **exactly two** keys: `2` → `€`, `3` → `#`. No other key gets one.
- Accent characters (`shiftLabel`, `optionLabel`) render at `fontSize: 8` with fill `oklch(0.96 0 0)`, `className="select-none pointer-events-none"`, `textAnchor="middle"`, `dominantBaseline="central"`.
- Render an accent only when `key.width >= 30 && key.height >= 16` (matches the existing base-label guard).
- Base `displayLabel` rendering is unchanged (centered, fontSize 11 / 9 via `fitLabel`).
- No changes to `buildKeyCountMap`, tooltips, or keycap geometry.
- **Commit hygiene:** the working tree contains unrelated in-progress changes (M3 UK layout in `app/page.tsx`, `activity-chart.tsx`, `tooltip-position.ts` + its test, etc.). Stage **only** the files listed in each task. Do not commit or revert those unrelated changes.
- Commit messages follow the repo convention (`refactor(telemetry):`, `feat(telemetry):`, …) and end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Run commands from the repo root: `/Users/jwu02/Developer/PersonalProjects/personal-website/jwoo`.

---

### Task 1: Rename `secondaryLabel` → `shiftLabel`

**Files:**
- Modify: `lib/telemetry/key-layout.ts` — interface field (line 9), comment (line 8), and 20 key definitions (`secondaryLabel:` → `shiftLabel:`)
- Modify: `components/telemetry/keyboard-heatmap.tsx:200,210` (`key.secondaryLabel` → `key.shiftLabel`)
- Test: `tests/lib/telemetry/key-layout.test.ts:97,100,103,108,111` (`.secondaryLabel` → `.shiftLabel`)

**Interfaces:**
- Consumes: nothing — pure mechanical identifier rename, no behavior change.
- Produces: `PhysicalKeyDef.shiftLabel?: string` (renamed field). All subsequent tasks and the existing test suite use `shiftLabel`.

- [ ] **Step 1: Make the rename a failing test by updating the test file**

In `tests/lib/telemetry/key-layout.test.ts`, replace every `.secondaryLabel` with `.shiftLabel` (lines 97, 100, 103, 108, 111). Example:

```ts
const one = PHYSICAL_KEYS.find((key) => key.id === "1");
expect(one?.shiftLabel).toBe("!");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/telemetry/key-layout.test.ts`
Expected: FAIL — `expect(received).toBe(expected)` with `received: undefined` for `.shiftLabel` (the field doesn't exist yet; SWC transpiles without type-checking, so this is a runtime assertion failure).

- [ ] **Step 3: Rename the field in source**

Run this global identifier rename (it is a pure rename; verify with the grep afterward):

```bash
sed -i '' 's/secondaryLabel/shiftLabel/g' \
  lib/telemetry/key-layout.ts \
  components/telemetry/keyboard-heatmap.tsx
```

Then update the interface comment in `lib/telemetry/key-layout.ts:8`:

```ts
/** Small shifted character rendered in the upper-left corner of the keycap */
shiftLabel?: string;
```

Verify no `secondaryLabel` references remain:

```bash
grep -rn "secondaryLabel" lib components tests --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/lib/telemetry/key-layout.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry/key-layout.ts components/telemetry/keyboard-heatmap.tsx tests/lib/telemetry/key-layout.test.ts
git commit -m "refactor(telemetry): rename secondaryLabel to shiftLabel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add `optionLabel` to the `2` and `3` keys

**Files:**
- Modify: `lib/telemetry/key-layout.ts` — interface (after `shiftLabel`) and the `2`/`3` key definitions (lines 120, 122)
- Test: `tests/lib/telemetry/key-layout.test.ts`

**Interfaces:**
- Consumes: `PhysicalKeyDef.shiftLabel?: string` from Task 1.
- Produces: `PhysicalKeyDef.optionLabel?: string` — the small option-modified character on the right side of the keycap. `PHYSICAL_KEYS` `"2"` has `optionLabel === "€"`, `"3"` has `optionLabel === "#"`.

- [ ] **Step 1: Write the failing tests**

Append to the `describe("PHYSICAL_KEYS")` block in `tests/lib/telemetry/key-layout.test.ts`:

```ts
it("adds option labels on the 2 and 3 keys", () => {
  const two = PHYSICAL_KEYS.find((key) => key.id === "2");
  expect(two?.optionLabel).toBe("€");

  const three = PHYSICAL_KEYS.find((key) => key.id === "3");
  expect(three?.optionLabel).toBe("#");
});

it("does not add option labels to other keys", () => {
  const ids = ["1", "4", "A", "Semicolon"];
  for (const id of ids) {
    const key = PHYSICAL_KEYS.find((k) => k.id === id);
    expect(key?.optionLabel).toBeUndefined();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/telemetry/key-layout.test.ts`
Expected: FAIL — `optionLabel` is `undefined` for `2` and `3`.

- [ ] **Step 3: Implement `optionLabel`**

In `lib/telemetry/key-layout.ts`, extend the interface right after the `shiftLabel` field:

```ts
/** Small option-modified character rendered on the right side of the keycap */
optionLabel?: string;
```

Add `optionLabel` to the `2` and `3` key definitions:

```ts
{ id: "2", displayLabel: "2", shiftLabel: "@", optionLabel: "€", x: kx(2), y: R1_Y, width: K, height: KH,
  labels: symbols("2", "@", "€") },
{ id: "3", displayLabel: "3", shiftLabel: "£", optionLabel: "#", x: kx(3), y: R1_Y, width: K, height: KH,
  labels: symbols("3", "£", "#") },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/lib/telemetry/key-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry/key-layout.ts tests/lib/telemetry/key-layout.test.ts
git commit -m "feat(telemetry): add optionLabel to 2 and 3 keys

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Render Apple-style keycap legend

**Files:**
- Modify: `components/telemetry/keyboard-heatmap.tsx` — replace the shift-accent `<text>` (currently lines 198–212) and add the option-accent `<text>`
- Create: `tests/components/telemetry/keyboard-heatmap.test.tsx`

**Interfaces:**
- Consumes: `PhysicalKeyDef.shiftLabel?: string` (Task 1), `PhysicalKeyDef.optionLabel?: string` (Task 2).
- Produces: rendered SVG where each key shows base `displayLabel` centered; `shiftLabel` at top-left (`x = key.x + 8`, `y = key.y + 9`); `optionLabel` on the right side (`x = key.x + key.width - 8`, `y = key.y + key.height / 2`). Both accents `fontSize: 8`.

- [ ] **Step 1: Write the failing component test**

Create `tests/components/telemetry/keyboard-heatmap.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap";

describe("KeyboardHeatmap", () => {
  it("renders the option character to the right of the base on the 2 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
    const baseTwo = within(twoKey).getAllByText("2")[0];
    const euro = within(twoKey).getByText("€");

    expect(Number(euro.getAttribute("x"))).toBeGreaterThan(
      Number(baseTwo.getAttribute("x"))
    );
  });

  it("renders the option character to the right of the base on the 3 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const threeKey = screen.getByRole("button", { name: "3: 0 presses" });
    const baseThree = within(threeKey).getAllByText("3")[0];
    const hash = within(threeKey).getByText("#");

    expect(Number(hash.getAttribute("x"))).toBeGreaterThan(
      Number(baseThree.getAttribute("x"))
    );
  });

  it("renders the shift accent at the top-left of the key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
    const baseTwo = within(twoKey).getAllByText("2")[0];
    const at = within(twoKey).getByText("@");

    expect(Number(at.getAttribute("y"))).toBeLessThan(
      Number(baseTwo.getAttribute("y"))
    );
    expect(Number(at.getAttribute("x"))).toBeLessThan(
      Number(baseTwo.getAttribute("x"))
    );
  });

  it("renders the pound shift accent on the 3 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const threeKey = screen.getByRole("button", { name: "3: 0 presses" });
    expect(within(threeKey).getByText("£")).toBeInTheDocument();
  });
});
```

Notes: `keys={{}}` renders every physical key with zero counts. `getByRole("button", { name: "2: 0 presses" })` targets the 2-key `<g>` via its `aria-label`. `getAllByText("2")[0]` is the base `<text>` element (its child `<tspan>` is second in document order), which carries the `x`/`y` attributes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/telemetry/keyboard-heatmap.test.tsx`
Expected: FAIL — `within(...).getByText("€")` throws (option accent not rendered yet), and the top-left position assertions fail (`@` is currently top-center).

- [ ] **Step 3: Implement the rendering**

In `components/telemetry/keyboard-heatmap.tsx`, replace the existing shift-accent block:

```jsx
{/* Shifted character sits small at the top-left, like a real keycap. */}
{key.shiftLabel && key.width >= 30 && key.height >= 16 && (
  <text
    x={key.x + 8}
    y={key.y + 9}
    textAnchor="middle"
    dominantBaseline="central"
    className="select-none pointer-events-none"
    fill="oklch(0.96 0 0)"
    style={{ fontSize: 8 }}
  >
    {key.shiftLabel}
  </text>
)}
```

Add the option-accent block immediately after it:

```jsx
{/* Option-modified character sits on the right side, level with the base
    character (e.g. € to the right of 2 on a UK Mac). */}
{key.optionLabel && key.width >= 30 && key.height >= 16 && (
  <text
    x={key.x + key.width - 8}
    y={key.y + key.height / 2}
    textAnchor="middle"
    dominantBaseline="central"
    className="select-none pointer-events-none"
    fill="oklch(0.96 0 0)"
    style={{ fontSize: 8 }}
  >
    {key.optionLabel}
  </text>
)}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm test -- tests/components/telemetry/keyboard-heatmap.test.tsx`
Expected: PASS (all three tests).

- [ ] **Step 5: Run the full suite, typecheck, and lint**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: all green (the pre-existing key-layout and tooltip-position tests still pass; typecheck and lint clean).

- [ ] **Step 6: Commit**

```bash
git add components/telemetry/keyboard-heatmap.tsx tests/components/telemetry/keyboard-heatmap.test.tsx
git commit -m "feat(telemetry): render Apple-style keycap legend

Co-Authored-By: Claude <noreply@anthropic.com>"
```
