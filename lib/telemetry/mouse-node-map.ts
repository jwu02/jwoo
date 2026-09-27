/**
 * Mapping between a mouse hover region and the node names of the same part
 * inside public/mouse.glb, plus the reverse resolver used during raycasting.
 *
 * The re-exported model is a top-down mouse whose parts are separate nodes
 * under a `Mouse` empty:
 *   - `Button_Left`  is the user's LEFT button (world +X, per mouse-blend-structure).
 *   - `Button_Right` is the user's RIGHT button (world −X).
 *   - `Scroll_Wheel` / `Scroll_Wheel_Inner` are the scroll wheel.
 *   - Everything else (shell, side buttons, power switch, cable, laser, base)
 *     is treated as the body.
 *
 * The model carries a Draco mesh (KHR_draco_mesh_compression), so it must be
 * loaded alongside the decoder at MOUSE_DRACO_PATH — the same `/draco/` setup
 * the keyboard uses.
 *
 * The resolver works on the sanitized names three's GLTFLoader assigns on load
 * (via PropertyBinding.sanitizeNodeName), so it matches the live scene graph.
 */

import { PropertyBinding } from "three"

/** URL of the Draco-compressed 3D mouse model. */
export const MOUSE_MODEL_URL = "/mouse.glb"

/** Draco decoder path; required because the GLB is Draco-compressed. */
export const MOUSE_DRACO_PATH = "/draco/"

/** Hover-region ids the telemetry mouse exposes. */
export type MouseRegion = "left" | "right" | "wheel" | "body"

/**
 * Node name(s) that belong to each region. Only left/right drive the press
 * animation; wheel/body are informational (tooltip). Sized for a small mouse
 * model, so arrays are tiny.
 */
export const MOUSE_REGION_NODES: Record<MouseRegion, readonly string[]> = {
  left: ["Button_Left"],
  right: ["Button_Right"],
  wheel: ["Scroll_Wheel", "Scroll_Wheel_Inner"],
  body: ["Body"],
}

// Reverse map, inverted from MOUSE_REGION_NODES so the two can never drift.
// `body` is excluded: it is the walk's fallback for any other part of the mouse,
// not a name-to-region mapping, so `Body` itself must keep resolving to null.
const REGION_BY_NODE: Map<string, MouseRegion> = new Map(
  (Object.entries(MOUSE_REGION_NODES) as [MouseRegion, readonly string[]][])
    .filter(([region]) => region !== "body")
    .flatMap(([region, names]) =>
      names.map((name) => [PropertyBinding.sanitizeNodeName(name), region] as const),
    ),
)

/**
 * Region a named node resolves to, or null when the name is not a recognised
 * mouse part. Unknown names resolve to null so the caller can decide the
 * default (body) once it has confirmed the node is under the mouse root.
 */
export function mouseRegionForName(name: string): MouseRegion | null {
  return REGION_BY_NODE.get(name) ?? null
}

/** Minimal structural node type for the ancestor walk. THREE.Object3D satisfies it. */
export type MouseSceneNode = { name: string; parent: MouseSceneNode | null }

/**
 * Resolve a raycast hit to a hover region by walking up from the hit mesh to a
 * child of `root`. A named button/wheel wins; any other direct child of `root`
 * (shell, side buttons, cable, …) is the body. Returns null when `object` is
 * `root` itself or is not under `root`.
 */
export function resolveMouseRegion(
  object: MouseSceneNode,
  root: MouseSceneNode,
): MouseRegion | null {
  let current: MouseSceneNode | null = object
  while (current && current !== root) {
    const region = mouseRegionForName(current.name)
    if (region) return region
    if (current.parent === root) return "body"
    current = current.parent
  }
  return null
}
