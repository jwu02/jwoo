import { PropertyBinding } from "three"

import { HOME_SCENE_HOTSPOTS, type HomeSceneHotspot } from "./scene-config"
import { resolveTopLevelNode, type SceneNode } from "./scene-hit"

/**
 * Runtime node name → hotspot, keyed by the sanitized names three's GLTFLoader
 * assigns on load, so a raycast hit resolves straight off the live scene. The
 * one lookup the scene shares: the click action and the hover label both go
 * through it, so they can never disagree about which node is which hotspot.
 *
 * Only interactive hotspots are indexed. A non-interactive one (the desk) only
 * supplies a camera view, so a hit on it resolves like a miss — no hover label,
 * no click action.
 */
export const HOTSPOT_BY_NODE: ReadonlyMap<string, HomeSceneHotspot> = new Map(
  HOME_SCENE_HOTSPOTS.filter((hotspot) => hotspot.interactive !== false).map(
    (hotspot) => [PropertyBinding.sanitizeNodeName(hotspot.node), hotspot],
  ),
)

/**
 * The outcome of a single click on the home scene: navigate away to the
 * hotspot's page, fly the camera to the clicked model, or ignore the click (a
 * drag release or a miss of every hotspot). Decided here as a pure function so
 * it is unit-testable without a WebGL/R3F harness — model-object just executes
 * the result.
 */
export type ClickAction =
  | { kind: "navigate"; target: string }
  | { kind: "focus"; hotspot: HomeSceneHotspot }
  | { kind: "ignore" }

/**
 * Translate a click on `object` (a hit mesh under `scene`) into a ClickAction.
 * `delta` is the pointer's movement since pointerdown; R3F dispatches onClick
 * after a drag that *started* on the object, so a drag release (delta > 2) is
 * ignored — rotating the scene must never navigate or re-focus. A hotspot with
 * a `target` page navigates immediately on a single click; the rest (bottle /
 * bonsai / car) keep the camera-focus behavior.
 */
export function resolveClickAction(
  object: SceneNode | null,
  delta: number,
  scene: SceneNode,
): ClickAction {
  if (delta > 2) return { kind: "ignore" }
  const name = object ? resolveTopLevelNode(object, scene) : null
  const hotspot = name ? HOTSPOT_BY_NODE.get(name) : undefined
  if (!hotspot) return { kind: "ignore" }
  return hotspot.target
    ? { kind: "navigate", target: hotspot.target }
    : { kind: "focus", hotspot }
}
