/**
 * Mapping between a physical key id (the `PHYSICAL_KEYS` ids in key-layout.ts)
 * and the node name of the same key inside public/keyboard.glb.
 *
 * The Blender model is an ANSI-style keyboard: the number row's leftmost key is
 * the `` ` `` (backquote/tilde) key, and there is no §/± key. This differs from
 * the UK `PHYSICAL_KEYS` layout in key-layout.ts, where the top-left key is
 * `Section` (§/±) and backquote/tilde is an ISO extra key between Shift and Z.
 *
 * So on the 3D model:
 *   - `key_backquote` (the number-row leftmost node) is the `` ` ``/`~` key,
 *     so the `Backtick` physical id maps here — the `` ` ``/`~` press count
 *     lands on the keycap that visually shows `` ` ``/`~`.
 *   - `Section` (the §/± key) has no node: the key was removed from the model.
 *
 * The reverse lookups (glbNodeName, physicalIdForNode) go through the same
 * sanitizer three's GLTFLoader applies on load, so they resolve against the
 * live scene graph.
 */

import { PropertyBinding } from "three"

/** URL of the Draco-compressed 3D keyboard model. */
export const KEYBOARD_MODEL_URL = "/keyboard.glb"

/** Draco decoder path; harmless while uncompressed, needed once compressed. */
export const KEYBOARD_DRACO_PATH = "/draco/"

/**
 * Physical id → GLB node name. 78 entries, one per key_* node in the model.
 * `Section` is deliberately absent — see NO_NODE_IDS.
 */
export const PHYSICAL_KEY_NODE: Record<string, string> = {
  // Function row
  Esc: "key_escape",
  F1: "key_f1",
  F2: "key_f2",
  F3: "key_f3",
  F4: "key_f4",
  F5: "key_f5",
  F6: "key_f6",
  F7: "key_f7",
  F8: "key_f8",
  F9: "key_f9",
  F10: "key_f10",
  F11: "key_f11",
  F12: "key_f12",
  "Touch ID": "key_touchid",
  // Number row
  "1": "key_1",
  "2": "key_2",
  "3": "key_3",
  "4": "key_4",
  "5": "key_5",
  "6": "key_6",
  "7": "key_7",
  "8": "key_8",
  "9": "key_9",
  "0": "key_0",
  Minus: "key_minus",
  Equal: "key_equal",
  Delete: "key_delete",
  // QWERTY top row
  Tab: "key_tab",
  Q: "key_q",
  W: "key_w",
  E: "key_e",
  R: "key_r",
  T: "key_t",
  Y: "key_y",
  U: "key_u",
  I: "key_i",
  O: "key_o",
  P: "key_p",
  "Left Bracket": "key_bracket_left",
  "Right Bracket": "key_bracket_right",
  Backslash: "key_backslash",
  // Home row
  "Caps Lock": "key_caps_lock",
  A: "key_a",
  S: "key_s",
  D: "key_d",
  F: "key_f",
  G: "key_g",
  H: "key_h",
  J: "key_j",
  K: "key_k",
  L: "key_l",
  Semicolon: "key_semicolon",
  Quote: "key_quote",
  Return: "key_enter",
  // Shift row — ANSI (no ISO extra key), so Backtick sits on the number-row
  // leftmost node the model places it on, and the letters follow Shift directly.
  "Left Shift": "key_shift_left",
  Backtick: "key_backquote",
  Z: "key_z",
  X: "key_x",
  C: "key_c",
  V: "key_v",
  B: "key_b",
  N: "key_n",
  M: "key_m",
  Comma: "key_comma",
  Period: "key_period",
  Slash: "key_slash",
  "Right Shift": "key_shift_right",
  // Bottom row
  Fn: "key_fn",
  "Left Ctrl": "key_control_left",
  "Left Option": "key_option_left",
  "Left Cmd": "key_command_left",
  Space: "key_space",
  "Right Cmd": "key_command_right",
  "Right Option": "key_option_right",
  // Arrow cluster
  "Left Arrow": "key_arrow_left",
  "Up Arrow": "key_arrow_up",
  "Down Arrow": "key_arrow_down",
  "Right Arrow": "key_arrow_right",
}

/**
 * Physical ids with no GLB node, so their 3D keycap is absent (and thus not
 * tinted or pressable) — but they still render in the a11y layer. Exactly the
 * one key removed from the model: the §/± key.
 */
export const NO_NODE_IDS: ReadonlySet<string> = new Set(["Section"])

// Reverse map: sanitized node name → physical id (first match wins).
const NODE_TO_PHYSICAL_ID: Map<string, string> = new Map()
for (const [id, node] of Object.entries(PHYSICAL_KEY_NODE)) {
  NODE_TO_PHYSICAL_ID.set(runtimeNodeName(node), id)
}

/** Sanitize a node name to the form three's GLTFLoader assigns on load. */
export function runtimeNodeName(name: string): string {
  return PropertyBinding.sanitizeNodeName(name)
}

/**
 * The GLB node name for a physical id, or null when the id has no node
 * (e.g. `Section`). Use this to look up the node in the loaded scene.
 */
export function glbNodeName(id: string): string | null {
  const node = PHYSICAL_KEY_NODE[id]
  if (!node) return null
  return runtimeNodeName(node)
}

/**
 * The physical id for a GLB node name (already sanitized, as GLTFLoader
 * stores it in the scene), or null when the node is not a key (e.g. `chassis`)
 * or has no matching physical id.
 */
export function physicalIdForNode(name: string): string | null {
  return NODE_TO_PHYSICAL_ID.get(name) ?? null
}

/**
 * Whether a physical id has a node in the GLB. Backtick (the `` ` ``/`~` key
 * on the top-left node) is true; Section (the removed §/± key) is false.
 */
export function hasNode(id: string): boolean {
  return PHYSICAL_KEY_NODE[id] !== undefined
}
