import { KeyCounts } from "./types";

export interface PhysicalKeyDef {
  /** Unique identifier for this physical key position */
  id: string;
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
//   "3" key  → "3", "#"        (base + option; "£" shift char not tracked)
//   "2" key  → "2", "@"        (base + shift; "€" option char not tracked; @/" swapped to US-style)
//   ";" key  → ";", ":"        (base + shift)
//   "'" key  → "'", '"'        (base + shift; @/" swapped to US-style)
//   Delete   → "Delete", "Forward Delete"  (Fn+Delete)
//   ↓ Arrow  → "Down Arrow", "Page Down"   (Fn+↓)
//
// The keycap legends these labels correspond to are drawn in the 3D model
// (keyboard.glb); this module tracks data, not geometry.  The array order is
// physical reading order — function row, then top to bottom, left to right —
// and the a11y layer relies on it.

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

// Row 0 — Function row
const F_ROW: PhysicalKeyDef[] = [
  { id: "Esc", labels: ["Escape"] },

  // F1-F12
  ...[...Array.from({ length: 12 }, (_, i) => ({
    id: `F${i + 1}`,
    labels: [`F${i + 1}`],
  }))],

  { id: "Touch ID", labels: [] },
];

// Row 1 — Number / symbol row
const R1_ROW: PhysicalKeyDef[] = [
  // § / ±  (labelled "Section" in keymap, "Grave" on US keyboards)
  { id: "Section", labels: ["Section", "Grave", "§", "±"] },
  { id: "1", labels: symbols("1", "!") },
  // Currency symbols (€ option+2, £ shift+3) are deliberately NOT tracked as
  // heatmap labels.
  { id: "2", labels: symbols("2", "@") },
  { id: "3", labels: symbols("3", "#") },
  { id: "4", labels: symbols("4", "$") },
  { id: "5", labels: symbols("5", "%") },
  { id: "6", labels: symbols("6", "^") },
  { id: "7", labels: symbols("7", "&") },
  { id: "8", labels: symbols("8", "*") },
  { id: "9", labels: symbols("9", "(") },
  { id: "0", labels: symbols("0", ")") },
  { id: "Minus", labels: ["Minus", "-", "_"] },
  { id: "Equal", labels: ["Equal", "=", "+"] },
  // Delete / Backspace
  { id: "Delete", labels: ["Delete", "Forward Delete", "Help"] },
];

// Row 2 — QWERTY top row
const R2_ROW: PhysicalKeyDef[] = [
  { id: "Tab", labels: ["Tab"] },
  // Letters Q-P
  ...[..."QWERTYUIOP"].map((c) => ({
    id: c,
    labels: letters(c),
  })),
  // Left Bracket [  (UK: shift = {)
  { id: "Left Bracket", labels: ["Left Bracket", "[", "{"] },
  // Right Bracket ]  (UK: shift = })
  { id: "Right Bracket", labels: ["Right Bracket", "]", "}"] },
  // Backslash \
  { id: "Backslash", labels: ["Backslash", "\\", "|"] },
];

// Row 3 — Home row
const R3_ROW: PhysicalKeyDef[] = [
  { id: "Caps Lock", labels: ["Caps Lock"] },
  // Letters A-L
  ...[..."ASDFGHJKL"].map((c) => ({
    id: c,
    labels: letters(c),
  })),
  // Semicolon ; (UK: shift = :)
  { id: "Semicolon", labels: ["Semicolon", ";", ":"] },
  // Quote ' (shift = " — @/" swapped to US-style)
  { id: "Quote", labels: ["Quote", "'", '"'] },
  // Return / Enter
  { id: "Return", labels: ["Return", "Numpad Enter"] },
];

// Row 4 — Shift row
const R4_ROW: PhysicalKeyDef[] = [
  { id: "Left Shift", labels: ["Left Shift"] },
  // ISO extra key — backtick / tilde, between Left Shift and Z
  { id: "Backtick", labels: ["`", "~"] },
  // Letters Z-M
  ...[..."ZXCVBNM"].map((c) => ({
    id: c,
    labels: letters(c),
  })),
  // Comma , (UK: shift = <)
  { id: "Comma", labels: ["Comma", ",", "<"] },
  // Period . (UK: shift = >)
  { id: "Period", labels: ["Period", ".", ">"] },
  // Slash / (UK: shift = ?)
  { id: "Slash", labels: ["Slash", "/", "?"] },
  { id: "Right Shift", labels: ["Right Shift"] },
];

// Row 5 — Bottom row (modifiers, space, arrows)
const R5_ROW: PhysicalKeyDef[] = [
  { id: "Fn", labels: ["Fn"] },
  { id: "Left Ctrl", labels: ["Left Ctrl", "Right Ctrl"] },
  { id: "Left Option", labels: ["Left Option"] },
  { id: "Left Cmd", labels: ["Left Cmd"] },
  { id: "Space", labels: ["Space"] },
  { id: "Right Cmd", labels: ["Right Cmd"] },
  { id: "Right Option", labels: ["Right Option"] },
];

// Arrow keys — counted and announced, not drawn: their printed chevron glyphs
// live in the 3D model (keyboard.glb legends).
const ARROW_KEYS: PhysicalKeyDef[] = [
  // Left Arrow (Fn+Left = Home)
  { id: "Left Arrow", labels: ["Left Arrow", "Home"] },
  // Up Arrow (Fn+Up = Page Up)
  { id: "Up Arrow", labels: ["Up Arrow", "Page Up"] },
  // Down Arrow (Fn+Down = Page Down)
  { id: "Down Arrow", labels: ["Down Arrow", "Page Down"] },
  // Right Arrow (Fn+Right = End)
  { id: "Right Arrow", labels: ["Right Arrow", "End"] },
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
 * (e.g. "1", "!" all from the "1" key on a UK Mac) are summed
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
