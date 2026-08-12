import { KeyCounts } from "./types";

export interface PhysicalKeyDef {
  /** Unique identifier for this physical key position */
  id: string;
  /** Short label rendered on the key in the SVG */
  displayLabel: string;
  /** Small shifted character rendered in the upper-left corner of the keycap */
  shiftLabel?: string;
  /** Small option-modified character rendered on the right side of the keycap */
  optionLabel?: string;
  /** Position and size in SVG viewBox coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * All telemetry data labels that map to this physical key.
   * Multiple labels may be produced by the same physical key
   * depending on modifier state (Shift, Option, Fn, etc.).
   */
  labels: string[];
}

// ---------------------------------------------------------------------------
// UK Mac keyboard character mapping
// ---------------------------------------------------------------------------
// The following maps each physical key to every label the Python telemetry
// client (keyboard.py + keymap.py) can produce for it.  Printable characters
// are recorded by keyboard.py via pynput as char.upper(), respecting the
// active UK Mac layout.  Non-printable keys are recorded via
// _SPECIAL_KEY_LABELS / keymap.py labels.
//
// Multiple labels → single physical key examples:
//   "1" key  → "1", "!"        (base + shift)
//   "3" key  → "3", "£", "#"   (base + shift + option)
//   "2" key  → "2", "@", "€"   (base + shift + option; @/" swapped to US-style)
//   ";" key  → ";", ":"        (base + shift)
//   "'" key  → "'", '"'        (base + shift; @/" swapped to US-style)
//   Delete   → "Delete", "Forward Delete"  (Fn+Delete)
//   ↓ Arrow  → "Down Arrow", "Page Down"   (Fn+↓)

// ---------------------------------------------------------------------------
// Printable character mappings per physical key (UK Mac layout)
// ---------------------------------------------------------------------------

/** Letters — just the uppercase letter (keyboard.py normalises case). */
function letters(...chars: string[]): string[] {
  return chars.map((c) => c.toUpperCase());
}

/**
 * Number/symbol key: base char + shifted char + any option-modified chars
 * that pynput reports for this physical key under the UK Mac layout.
 */
function symbols(base: string, shifted: string, ...option: string[]): string[] {
  const labels = [base, shifted, ...option];
  // Deduplicate (some chars may be the same)
  return [...new Set(labels)];
}

// ---------------------------------------------------------------------------
// Physical key definitions — MacBook M3 Air 13" UK layout (ANSI-style)
// ---------------------------------------------------------------------------
//
// Coordinate system (viewBox: "0 0 668 288"):
//   Standard key: 38×34 px, gap between keys: 4 px
//   Wider keys scale proportionally from standard 38 px.
//   Rows are spaced 38 px apart vertically (34 key + 4 gap).

const K = 38; // standard key width unit
const KH = 34; // standard key height
const G = 4; // gap

function kx(col: number, offset = 0): number {
  return col * (K + G) + offset;
}

// ---------------------------------------------------------------------------
// Row 0 — Function row (y=0, h=34 — same height as regular keys)
// ---------------------------------------------------------------------------
const F_Y = 0;
const F_H = 34;

// F1-F12 + Touch ID are standard 38px keys with uniform 4px gaps.  Esc widens
// to fill the leftover space on the left so the whole row reads evenly spaced
// like the other rows.  The row keeps the same right edge as before (Touch ID
// ends at 616), so F1 starts at 616 - (13 keys × 38 + 12 gaps × 4).
const F1_X = 616 - (13 * K + 12 * G);

const F_ROW: PhysicalKeyDef[] = [
  // Esc — expands to fill the space left by the evenly-spaced F keys
  { id: "Esc", displayLabel: "esc", x: 0, y: F_Y, width: F1_X - G, height: F_H,
    labels: ["Escape"] },

  // F1-F12
  ...[...Array.from({ length: 12 }, (_, i) => ({
    id: `F${i + 1}`,
    displayLabel: `F${i + 1}`,
    x: F1_X + i * (K + G),
    y: F_Y,
    width: K,
    height: F_H,
    labels: [`F${i + 1}`],
  }))],

  { id: "Touch ID", displayLabel: "", x: F1_X + 12 * (K + G), y: F_Y, width: K, height: F_H,
    labels: [] },
];

// ---------------------------------------------------------------------------
// Row 1 — Number / symbol row (y=32)
// ---------------------------------------------------------------------------
const R1_Y = F_Y + F_H + G;

const R1_ROW: PhysicalKeyDef[] = [
  // § / ±  (labelled "Section" in keymap, "Grave" on US keyboards)
  { id: "Section", displayLabel: "§", shiftLabel: "±", x: kx(0), y: R1_Y, width: K, height: KH,
    labels: ["Section", "Grave", "§", "±"] },
  { id: "1", displayLabel: "1", shiftLabel: "!", x: kx(1), y: R1_Y, width: K, height: KH,
    labels: symbols("1", "!") },
  { id: "2", displayLabel: "2", shiftLabel: "@", optionLabel: "€", x: kx(2), y: R1_Y, width: K, height: KH,
    labels: symbols("2", "@", "€") },
  { id: "3", displayLabel: "3", shiftLabel: "£", optionLabel: "#", x: kx(3), y: R1_Y, width: K, height: KH,
    labels: symbols("3", "£", "#") },
  { id: "4", displayLabel: "4", shiftLabel: "$", x: kx(4), y: R1_Y, width: K, height: KH,
    labels: symbols("4", "$") },
  { id: "5", displayLabel: "5", shiftLabel: "%", x: kx(5), y: R1_Y, width: K, height: KH,
    labels: symbols("5", "%") },
  { id: "6", displayLabel: "6", shiftLabel: "^", x: kx(6), y: R1_Y, width: K, height: KH,
    labels: symbols("6", "^") },
  { id: "7", displayLabel: "7", shiftLabel: "&", x: kx(7), y: R1_Y, width: K, height: KH,
    labels: symbols("7", "&") },
  { id: "8", displayLabel: "8", shiftLabel: "*", x: kx(8), y: R1_Y, width: K, height: KH,
    labels: symbols("8", "*") },
  { id: "9", displayLabel: "9", shiftLabel: "(", x: kx(9), y: R1_Y, width: K, height: KH,
    labels: symbols("9", "(") },
  { id: "0", displayLabel: "0", shiftLabel: ")", x: kx(10), y: R1_Y, width: K, height: KH,
    labels: symbols("0", ")") },
  { id: "Minus", displayLabel: "-", shiftLabel: "_", x: kx(11), y: R1_Y, width: K, height: KH,
    labels: ["Minus", "-", "_"] },
  { id: "Equal", displayLabel: "=", shiftLabel: "+", x: kx(12), y: R1_Y, width: K, height: KH,
    labels: ["Equal", "=", "+"] },
  // Delete / Backspace — ~2u wide
  { id: "Delete", displayLabel: "delete", x: kx(13), y: R1_Y, width: K * 2 + G, height: KH,
    labels: ["Delete", "Forward Delete", "Help"] },
];

// ---------------------------------------------------------------------------
// Row 2 — QWERTY top row (y=70)
// ---------------------------------------------------------------------------
const R2_Y = R1_Y + KH + G;

const R2_ROW: PhysicalKeyDef[] = [
  // Tab — ~1.5u
  { id: "Tab", displayLabel: "tab", x: kx(0), y: R2_Y, width: K * 1.5 + G * 0.5, height: KH,
    labels: ["Tab"] },
  // Letters Q-P
  ...[..."QWERTYUIOP"].map((c, i) => ({
    id: c,
    displayLabel: c,
    x: kx(i + 1) + K * 0.5 + G * 0.5,
    y: R2_Y,
    width: K,
    height: KH,
    labels: letters(c),
  })),
  // Left Bracket [  (UK: shift = {)
  { id: "Left Bracket", displayLabel: "[", shiftLabel: "{", x: kx(11) + K * 0.5 + G * 0.5, y: R2_Y, width: K, height: KH,
    labels: ["Left Bracket", "[", "{"] },
  // Right Bracket ]  (UK: shift = })
  { id: "Right Bracket", displayLabel: "]", shiftLabel: "}", x: kx(12) + K * 0.5 + G * 0.5, y: R2_Y, width: K, height: KH,
    labels: ["Right Bracket", "]", "}"] },
  // Backslash \  (to the right of ], above Return)
  { id: "Backslash", displayLabel: "\\", shiftLabel: "|", x: kx(13) + K * 0.5 + G * 0.5, y: R2_Y, width: K, height: KH,
    labels: ["Backslash", "\\", "|"] },
];

// ---------------------------------------------------------------------------
// Row 3 — Home row (y=108)
// ---------------------------------------------------------------------------
const R3_Y = R2_Y + KH + G;

const R3_ROW: PhysicalKeyDef[] = [
  // Caps Lock — ~1.75u
  { id: "Caps Lock", displayLabel: "caps", x: kx(0), y: R3_Y, width: K * 1.75 + G * 0.75, height: KH,
    labels: ["Caps Lock"] },
  // Letters A-L
  ...[..."ASDFGHJKL"].map((c, i) => ({
    id: c,
    displayLabel: c,
    x: kx(i + 1) + K * 0.75 + G * 0.75,
    y: R3_Y,
    width: K,
    height: KH,
    labels: letters(c),
  })),
  // Semicolon ; (UK: shift = :)
  { id: "Semicolon", displayLabel: ";", shiftLabel: ":", x: kx(10) + K * 0.75 + G * 0.75, y: R3_Y, width: K, height: KH,
    labels: ["Semicolon", ";", ":"] },
  // Quote ' (shift = " — @/" swapped to US-style)
  { id: "Quote", displayLabel: "'", shiftLabel: '"', x: kx(11) + K * 0.75 + G * 0.75, y: R3_Y, width: K, height: KH,
    labels: ["Quote", "'", '"'] },
  // Return / Enter — ~2.25u
  { id: "Return", displayLabel: "return", x: kx(12) + K * 0.75 + G * 0.75, y: R3_Y, width: K * 2.25 + G * 1.25, height: KH,
    labels: ["Return", "Numpad Enter"] },
];

// ---------------------------------------------------------------------------
// Row 4 — Shift row (y=146)
// ---------------------------------------------------------------------------
const R4_Y = R3_Y + KH + G;

// Left Shift is shortened to ~1.5u to make room for the ISO extra key
// (backtick/tilde) that sits between it and Z.  Everything after shifts right
// by (K*1.5 + G*2 - K*1.25 - G*1.25) = 8.5px, and Right Shift narrows so the
// row keeps its right edge at 626.
const R4_LETTER_OFFSET = 61;

const R4_ROW: PhysicalKeyDef[] = [
  // Left Shift — ~1.5u, shortened for the ~/` key to its right
  { id: "Left Shift", displayLabel: "shift", x: kx(0), y: R4_Y, width: K * 1.5, height: KH,
    labels: ["Left Shift"] },
  // ISO extra key — backtick / tilde, between Left Shift and Z
  { id: "Backtick", displayLabel: "`", shiftLabel: "~", x: kx(0) + K * 1.5 + G, y: R4_Y, width: K, height: KH,
    labels: ["`", "~"] },
  // Letters Z-M
  ...[..."ZXCVBNM"].map((c, i) => ({
    id: c,
    displayLabel: c,
    x: kx(i + 1) + R4_LETTER_OFFSET,
    y: R4_Y,
    width: K,
    height: KH,
    labels: letters(c),
  })),
  // Comma , (UK: shift = <)
  { id: "Comma", displayLabel: ",", shiftLabel: "<", x: kx(8) + R4_LETTER_OFFSET, y: R4_Y, width: K, height: KH,
    labels: ["Comma", ",", "<"] },
  // Period . (UK: shift = >)
  { id: "Period", displayLabel: ".", shiftLabel: ">", x: kx(9) + R4_LETTER_OFFSET, y: R4_Y, width: K, height: KH,
    labels: ["Period", ".", ">"] },
  // Slash / (UK: shift = ?)
  { id: "Slash", displayLabel: "/", shiftLabel: "?", x: kx(10) + R4_LETTER_OFFSET, y: R4_Y, width: K, height: KH,
    labels: ["Slash", "/", "?"] },
  // Right Shift — ~2.5u, narrowed so the row keeps its right edge at 626
  { id: "Right Shift", displayLabel: "shift", x: kx(11) + R4_LETTER_OFFSET, y: R4_Y, width: K * 2.5 + G * 2, height: KH,
    labels: ["Right Shift"] },
];

// ---------------------------------------------------------------------------
// Row 5 — Bottom row (modifiers, space, arrows) (y=184)
// ---------------------------------------------------------------------------
const R5_Y = R4_Y + KH + G;

// Modifier key width in the bottom row (~1.25u = 47.5, floored to 47).
// Both Options and both Cmds use this; Fn and the arrows are 1u (K).
const MOD_W = 47;

// Right edge of the main keyboard body — rows 1–4 all end here (right edge of
// Delete / Return / Right Shift).  The bottom row's arrow cluster is aligned to
// this same edge, with the arrows packed directly against the Right Option key
// exactly as on the M3 Air.
const KB_RIGHT = 626;

// Arrow cluster positions, computed right-to-left from KB_RIGHT so the cluster
// stays glued to the Right Option key and shares the keyboard's right edge.
const arrowRightX = KB_RIGHT - K;          // right arrow
const arrowStackX = arrowRightX - K - G;   // up / down stacked
const arrowLeftX = arrowStackX - K - G;    // left arrow
const rightOptX = arrowLeftX - MOD_W - G;  // right option
const rightCmdX = rightOptX - MOD_W - G;   // right cmd

const R5_ROW: PhysicalKeyDef[] = [
  // Fn — ~1u
  { id: "Fn", displayLabel: "fn", x: kx(0), y: R5_Y, width: K, height: KH,
    labels: ["Fn"] },
  // Left Ctrl — ~1.25u
  { id: "Left Ctrl", displayLabel: "ctrl", x: kx(1), y: R5_Y, width: MOD_W, height: KH,
    labels: ["Left Ctrl", "Right Ctrl"] },
  // Left Option — ~1.25u
  { id: "Left Option", displayLabel: "opt", x: kx(1) + MOD_W + G, y: R5_Y, width: MOD_W, height: KH,
    labels: ["Left Option"] },
  // Left Cmd — ~1.25u
  { id: "Left Cmd", displayLabel: "cmd", x: kx(1) + 2 * (MOD_W + G), y: R5_Y, width: MOD_W, height: KH,
    labels: ["Left Cmd"] },
  // Space — fills the gap between the two Cmd keys
  { id: "Space", displayLabel: "", x: kx(1) + 3 * (MOD_W + G), y: R5_Y,
    width: rightCmdX - G - (kx(1) + 3 * (MOD_W + G)), height: KH,
    labels: ["Space"] },
  // Right Cmd — ~1.25u
  { id: "Right Cmd", displayLabel: "cmd", x: rightCmdX, y: R5_Y, width: MOD_W, height: KH,
    labels: ["Right Cmd"] },
  // Right Option — ~1.25u
  { id: "Right Option", displayLabel: "opt", x: rightOptX, y: R5_Y, width: MOD_W, height: KH,
    labels: ["Right Option"] },
];

// Arrow keys — stacked to the right of the bottom-row modifiers.  Left and
// right arrows are half-height like the up/down pair, sitting on the same row
// as the down arrow (2px hairline gap above the stack top).
const ARROW_Y = R5_Y;
const ARROW_HALF = Math.floor((KH - 2) / 2);

const ARROW_KEYS: PhysicalKeyDef[] = [
  // Left Arrow (Fn+Left = Home)
  { id: "Left Arrow", displayLabel: "←", x: arrowLeftX, y: ARROW_Y + ARROW_HALF + 2, width: K, height: ARROW_HALF,
    labels: ["Left Arrow", "Home"] },
  // Up Arrow (half-height top, Fn+Up = Page Up)
  { id: "Up Arrow", displayLabel: "↑", x: arrowStackX, y: ARROW_Y, width: K, height: ARROW_HALF,
    labels: ["Up Arrow", "Page Up"] },
  // Down Arrow (half-height bottom, Fn+Down = Page Down)
  { id: "Down Arrow", displayLabel: "↓", x: arrowStackX, y: ARROW_Y + ARROW_HALF + 2, width: K, height: ARROW_HALF,
    labels: ["Down Arrow", "Page Down"] },
  // Right Arrow (Fn+Right = End)
  { id: "Right Arrow", displayLabel: "→", x: arrowRightX, y: ARROW_Y + ARROW_HALF + 2, width: K, height: ARROW_HALF,
    labels: ["Right Arrow", "End"] },
];

// ---------------------------------------------------------------------------
// Aggregate all physical keys
// ---------------------------------------------------------------------------

export const PHYSICAL_KEYS: PhysicalKeyDef[] = [
  ...F_ROW,
  ...R1_ROW,
  ...R2_ROW,
  ...R3_ROW,
  ...R4_ROW,
  ...R5_ROW,
  ...ARROW_KEYS,
];

// ---------------------------------------------------------------------------
// Build a label → physical key ID lookup for fast aggregation
// ---------------------------------------------------------------------------

const LABEL_TO_KEY_ID: Map<string, string> = new Map();
for (const key of PHYSICAL_KEYS) {
  for (const label of key.labels) {
    const existing = LABEL_TO_KEY_ID.get(label);
    if (existing && existing !== key.id) {
      // A label should not map to more than one physical key — if it does,
      // the first definition wins (non-deterministic across builds but stable
      // within a single build).  This protects against accidental duplicates.
      continue;
    }
    LABEL_TO_KEY_ID.set(label, key.id);
  }
}

/**
 * Aggregate raw KeyCounts (label → press count) into physical-key counts.
 *
 * Multiple telemetry labels that originate from the same physical key
 * (e.g. "1", "!", "¡" all from the "1" key on a UK Mac) are summed
 * into a single count for that key.
 *
 * Labels not present in the layout mapping are silently ignored.
 */
export function buildKeyCountMap(keys: KeyCounts): Map<string, number> {
  const map = new Map<string, number>();

  for (const [label, count] of Object.entries(keys)) {
    const keyId = LABEL_TO_KEY_ID.get(label);
    if (keyId !== undefined) {
      map.set(keyId, (map.get(keyId) ?? 0) + count);
    }
  }

  return map;
}
