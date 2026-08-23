import { runtimeNodeName, type HomeSceneHotspot } from "./scene-config"
import { resolveTopLevelNode, type SceneNode } from "./scene-hit"

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
 * a `target` page navigates immediately on a single click; the rest (Desk /
 * Flask / Car) keep the camera-focus behavior.
 */
export function resolveClickAction(
  object: SceneNode | null,
  delta: number,
  scene: SceneNode,
  hotspots: readonly HomeSceneHotspot[],
): ClickAction {
  if (delta > 2) return { kind: "ignore" }
  const name = object ? resolveTopLevelNode(object, scene) : null
  if (!name) return { kind: "ignore" }
  const hotspot = hotspots.find((h) => runtimeNodeName(h.node) === name)
  if (!hotspot) return { kind: "ignore" }
  return hotspot.target
    ? { kind: "navigate", target: hotspot.target }
    : { kind: "focus", hotspot }
}
