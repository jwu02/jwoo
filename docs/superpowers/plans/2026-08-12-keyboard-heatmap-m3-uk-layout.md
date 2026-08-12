# Keyboard Heatmap: MacBook Air M3 UK Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the telemetry keyboard heatmap so its geometry, labels, Caps Lock LED, and Touch ID button match the MacBook Air M3 UK keyboard layout.

**Architecture:** Extend the `PhysicalKeyDef` type with an optional `secondaryLabel`, update the layout data in `lib/telemetry/key-layout.ts`, then teach `components/telemetry/keyboard-heatmap.tsx` to render secondary labels, a green Caps Lock LED, a fingerprint icon on Touch ID, and a static "untracked" tooltip for Touch ID.

**Tech Stack:** TypeScript, React 19, Next.js 16, Tailwind CSS 4, Jest, React Testing Library.

## Global Constraints

- Function keys must be the same height as standard keys (34 px).
- Secondary characters render in the upper-right corner of applicable keycaps.
- Caps Lock key renders a green LED indicator.
- Touch ID button sits to the right of F12 with a fingerprint icon and an "untracked" tooltip.
- Arrow keys remain an inverted-T shape (full-height left/right, half-height up/down stacked).
- No changes to telemetry aggregation (`buildKeyCountMap`) or tracked labels.

---

## Task 1: Extend `PhysicalKeyDef` and update the function row

**Files:**
- Modify: `lib/telemetry/key-layout.ts:13-19`
- Modify: `lib/telemetry/key-layout.ts:74-116`

**Interfaces:**
- Consumes: existing `PhysicalKeyDef` shape.
- Produces: `PhysicalKeyDef` with new optional `secondaryLabel?: string`; `F_H = 34`; a new `Touch ID` key in `F_ROW`.

- [ ] **Step 1: Add `secondaryLabel` to the interface**

Update `PhysicalKeyDef` to include the optional secondary label field:

```typescript
export interface PhysicalKeyDef {
  /** Unique identifier for this physical key position */
  id: string;
  /** Short label rendered on the key in the SVG */
  displayLabel: string;
  /** Small shifted/option character rendered in the upper-right corner */
  secondaryLabel?: string;
  /** Position and size in SVG viewBox coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * All telemetry data labels that map to this physical key.
   */
  labels: string[];
}
```

- [ ] **Step 2: Raise function-row height and add Touch ID key**

Change `F_H` from `28` to `34`:

```typescript
const F_H = 34;
```

Append a `Touch ID` key to `F_ROW`, immediately to the right of F12 with the standard function-group gap:

```typescript
{ id: "Touch ID", displayLabel: "", x: kx(13) + FGAP * 4, y: F_Y, width: K, height: F_H,
  labels: [] },
```

- [ ] **Step 3: Run existing tests**

Run: `npm test -- tests/lib/telemetry/tooltip-position.test.ts`
Expected: PASS (no breaking changes yet).

- [ ] **Step 4: Commit**

```bash
git add lib/telemetry/key-layout.ts
git commit -m "feat(telemetry): add secondaryLabel field, taller function keys, Touch ID key

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Add secondary labels to number/symbol keys

**Files:**
- Modify: `lib/telemetry/key-layout.ts:123-247`

**Interfaces:**
- Consumes: `PhysicalKeyDef.secondaryLabel?: string`.
- Produces: Key definitions with `secondaryLabel` populated for every shifted symbol key.

- [ ] **Step 1: Add `secondaryLabel` to the number/symbol row (R1)**

Update each R1 key that has a shifted variant to include `secondaryLabel`:

```typescript
{ id: "Section", displayLabel: "§", secondaryLabel: "±", x: kx(0), y: R1_Y, width: K, height: KH,
  labels: ["Section", "Grave", "§", "±"] },
{ id: "1", displayLabel: "1", secondaryLabel: "!", x: kx(1), y: R1_Y, width: K, height: KH,
  labels: symbols("1", "!") },
{ id: "2", displayLabel: "2", secondaryLabel: "\"", x: kx(2), y: R1_Y, width: K, height: KH,
  labels: symbols("2", '"', "€") },
{ id: "3", displayLabel: "3", secondaryLabel: "£", x: kx(3), y: R1_Y, width: K, height: KH,
  labels: symbols("3", "£", "#") },
{ id: "4", displayLabel: "4", secondaryLabel: "$", x: kx(4), y: R1_Y, width: K, height: KH,
  labels: symbols("4", "$") },
{ id: "5", displayLabel: "5", secondaryLabel: "%", x: kx(5), y: R1_Y, width: K, height: KH,
  labels: symbols("5", "%") },
{ id: "6", displayLabel: "6", secondaryLabel: "^", x: kx(6), y: R1_Y, width: K, height: KH,
  labels: symbols("6", "^") },
{ id: "7", displayLabel: "7", secondaryLabel: "&", x: kx(7), y: R1_Y, width: K, height: KH,
  labels: symbols("7", "&") },
{ id: "8", displayLabel: "8", secondaryLabel: "*", x: kx(8), y: R1_Y, width: K, height: KH,
  labels: symbols("8", "*") },
{ id: "9", displayLabel: "9", secondaryLabel: "(", x: kx(9), y: R1_Y, width: K, height: KH,
  labels: symbols("9", "(") },
{ id: "0", displayLabel: "0", secondaryLabel: ")", x: kx(10), y: R1_Y, width: K, height: KH,
  labels: symbols("0", ")") },
{ id: "Minus", displayLabel: "-", secondaryLabel: "_", x: kx(11), y: R1_Y, width: K, height: KH,
  labels: ["Minus", "-", "_"] },
{ id: "Equal", displayLabel: "=", secondaryLabel: "+", x: kx(12), y: R1_Y, width: K, height: KH,
  labels: ["Equal", "=", "+"] },
```

- [ ] **Step 2: Add `secondaryLabel` to bracket/quote keys**

Update R2 and R3 symbol keys:

```typescript
{ id: "Left Bracket", displayLabel: "[", secondaryLabel: "{", x: kx(11) + K * 0.5 + G * 0.5, y: R2_Y, width: K, height: KH,
  labels: ["Left Bracket", "[", "{"] },
{ id: "Right Bracket", displayLabel: "]", secondaryLabel: "}", x: kx(12) + K * 0.5 + G * 0.5, y: R2_Y, width: K, height: KH,
  labels: ["Right Bracket", "]", "}"] },
{ id: "Backslash", displayLabel: "\\", secondaryLabel: "|", x: kx(13) + K * 0.5 + G * 0.5, y: R2_Y, width: K, height: KH,
  labels: ["Backslash", "\\", "|"] },
{ id: "Semicolon", displayLabel: ";", secondaryLabel: ":", x: kx(10) + K * 0.75 + G * 0.75, y: R3_Y, width: K, height: KH,
  labels: ["Semicolon", ";", ":"] },
{ id: "Quote", displayLabel: "'", secondaryLabel: "@", x: kx(11) + K * 0.75 + G * 0.75, y: R3_Y, width: K, height: KH,
  labels: ["Quote", "'", "@"] },
```

- [ ] **Step 3: Add `secondaryLabel` to punctuation keys**

Update R4 punctuation keys:

```typescript
{ id: "Comma", displayLabel: ",", secondaryLabel: "<", x: kx(8) + K * 1.25 + G * 1.25, y: R4_Y, width: K, height: KH,
  labels: ["Comma", ",", "<"] },
{ id: "Period", displayLabel: ".", secondaryLabel: ">", x: kx(9) + K * 1.25 + G * 1.25, y: R4_Y, width: K, height: KH,
  labels: ["Period", ".", ">"] },
{ id: "Slash", displayLabel: "/", secondaryLabel: "?", x: kx(10) + K * 1.25 + G * 1.25, y: R4_Y, width: K, height: KH,
  labels: ["Slash", "/", "?"] },
```

- [ ] **Step 4: Verify with typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry/key-layout.ts
git commit -m "feat(telemetry): add secondary labels to shifted symbol keys

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Render secondary labels, Caps Lock LED, and Touch ID icon

**Files:**
- Modify: `components/telemetry/keyboard-heatmap.tsx:128-188`

**Interfaces:**
- Consumes: `PhysicalKeyDef.secondaryLabel`, the new `Touch ID` key id, and existing `key` geometry.
- Produces: SVG rendering of secondary labels, a green LED dot on `Caps Lock`, and a fingerprint icon on `Touch ID`.

- [ ] **Step 1: Render secondary labels**

Inside the mapped `<g>` for each key, after the main `<text>` element, add a small upper-right label when `key.secondaryLabel` exists:

```tsx
{key.secondaryLabel && key.width >= 30 && key.height >= 16 && (
  <text
    x={key.x + key.width - 5}
    y={key.y + 9}
    textAnchor="end"
    dominantBaseline="central"
    className="select-none pointer-events-none"
    fill="oklch(0.96 0 0)"
    style={{ fontSize: 8 }}
  >
    {key.secondaryLabel}
  </text>
)}
```

- [ ] **Step 2: Render Caps Lock LED**

Add a green dot near the upper-left of the Caps Lock key:

```tsx
{key.id === "Caps Lock" && (
  <circle
    cx={key.x + 8}
    cy={key.y + 7}
    r={3}
    fill="oklch(0.65 0.18 145)"
    className="pointer-events-none"
  />
)}
```

- [ ] **Step 3: Render Touch ID fingerprint icon**

Add a fingerprint icon centered on the Touch ID key:

```tsx
{key.id === "Touch ID" && (
  <g
    transform={`translate(${key.x + key.width / 2}, ${key.y + key.height / 2})`}
    className="pointer-events-none"
  >
    <path
      d="M -7 -3 Q 0 -9 7 -3"
      fill="none"
      stroke="oklch(0.96 0 0)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M -8 1 Q 0 -10 8 1"
      fill="none"
      stroke="oklch(0.96 0 0)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M -6 5 Q 0 9 6 5"
      fill="none"
      stroke="oklch(0.96 0 0)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="0"
      cy="0"
      r="1.5"
      fill="oklch(0.96 0 0)"
    />
  </g>
)}
```

- [ ] **Step 4: Update aria-label for Touch ID**

Change the `aria-label` on the `<g>` so Touch ID does not claim a press count:

```tsx
aria-label={
  key.id === "Touch ID"
    ? "Touch ID"
    : `${key.id}: ${formatNumber(count)} presses`
}
```

- [ ] **Step 5: Verify with typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/telemetry/keyboard-heatmap.tsx
git commit -m "feat(telemetry): render secondary labels, Caps Lock LED, and Touch ID icon

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Add Touch ID untracked tooltip

**Files:**
- Modify: `components/telemetry/keyboard-heatmap.tsx:190-207`

**Interfaces:**
- Consumes: `hoveredKey.id` and `tooltipAnchor` state.
- Produces: Static "Touch ID untracked" tooltip when Touch ID is hovered/focused.

- [ ] **Step 1: Branch tooltip content for Touch ID**

Replace the existing tooltip body with a branch that shows the untracked message for Touch ID:

```tsx
{hoveredKey && tooltipAnchor && (
  <div
    ref={tooltipRef}
    className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
  >
    {hoveredKey.id === "Touch ID" ? (
      <div className="font-medium">Touch ID untracked</div>
    ) : (
      <>
        <div className="font-medium">
          {formatNumber(keyCountMap.get(hoveredKey.id) ?? 0)} presses
        </div>
        {hoveredBreakdown.length > 1 && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {hoveredBreakdown.map(({ label, count }) => (
              <div key={label}>
                {label}: {formatNumber(count)}
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Run tests and typecheck**

Run:
```bash
npm run typecheck
npm test
```
Expected: PASS for both.

- [ ] **Step 3: Commit**

```bash
git add components/telemetry/keyboard-heatmap.tsx
git commit -m "feat(telemetry): add Touch ID untracked tooltip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Add layout regression test

**Files:**
- Create: `tests/lib/telemetry/key-layout.test.ts`

**Interfaces:**
- Consumes: `PHYSICAL_KEYS` from `lib/telemetry/key-layout.ts`.
- Produces: Passing assertions that the new layout includes Touch ID, taller function keys, and secondary labels.

- [ ] **Step 1: Write the test file**

```typescript
import { PHYSICAL_KEYS } from "@/lib/telemetry/key-layout";

describe("PHYSICAL_KEYS layout", () => {
  it("includes a Touch ID key to the right of F12", () => {
    const touchId = PHYSICAL_KEYS.find((key) => key.id === "Touch ID");
    expect(touchId).toBeDefined();
    expect(touchId!.width).toBe(38);
    expect(touchId!.height).toBe(34);

    const f12 = PHYSICAL_KEYS.find((key) => key.id === "F12");
    expect(f12).toBeDefined();
    expect(touchId!.x).toBeGreaterThan(f12!.x);
  });

  it("has function keys the same height as standard keys", () => {
    const functionKeys = PHYSICAL_KEYS.filter((key) =>
      /^F(1[0-2]|[1-9])$/.test(key.id)
    );
    expect(functionKeys.length).toBe(12);
    for (const key of functionKeys) {
      expect(key.height).toBe(34);
    }
  });

  it("renders secondary labels on shifted symbol keys", () => {
    const one = PHYSICAL_KEYS.find((key) => key.id === "1");
    expect(one?.secondaryLabel).toBe("!");

    const section = PHYSICAL_KEYS.find((key) => key.id === "Section");
    expect(section?.secondaryLabel).toBe("±");

    const slash = PHYSICAL_KEYS.find((key) => key.id === "Slash");
    expect(slash?.secondaryLabel).toBe("?");
  });

  it("does not add secondary labels to letters or modifiers", () => {
    const a = PHYSICAL_KEYS.find((key) => key.id === "A");
    expect(a?.secondaryLabel).toBeUndefined();

    const leftShift = PHYSICAL_KEYS.find((key) => key.id === "Left Shift");
    expect(leftShift?.secondaryLabel).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new test**

Run: `npm test -- tests/lib/telemetry/key-layout.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/telemetry/key-layout.test.ts
git commit -m "test(telemetry): add keyboard layout regression tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Final verification

**Files:**
- All touched files.

- [ ] **Step 1: Run full test suite, typecheck, and lint**

Run:
```bash
npm test
npm run typecheck
npm run lint
```
Expected: PASS for all three.

- [ ] **Step 2: Build and visually verify**

Run:
```bash
npm run build
npm run dev
```

Open the app and verify against the reference image:
- Function keys are the same height as standard keys.
- Secondary characters appear in the upper-right of applicable keys.
- A green LED appears on the Caps Lock key.
- The Touch ID button is to the right of F12 with a fingerprint icon.
- Hovering Touch ID shows "Touch ID untracked".
- Hovering tracked keys still shows press counts.

- [ ] **Step 3: Final commit if any fixes were needed**

If no fixes were needed, no additional commit is required. If fixes were made, commit them with a descriptive message.

---

## Self-Review

**Spec coverage:**
- Function keys taller → Task 1.
- Secondary characters on keys → Tasks 2 and 3.
- Green LED on Caps Lock → Task 3.
- Touch ID button with untracked tooltip → Tasks 1, 3, and 4.
- Arrow keys unchanged (inverted T) → no task needed, already implemented.

**Placeholder scan:**
- No TBD/TODO placeholders.
- No vague "add appropriate error handling" steps.
- Each step includes concrete code or commands.

**Type consistency:**
- `secondaryLabel?: string` is defined in Task 1 and used in Tasks 2, 3, and 5.
- `Touch ID` id is used consistently in Tasks 1, 3, 4, and 5.
- `F_H = 34` is used in Task 1 and verified in Task 5.
