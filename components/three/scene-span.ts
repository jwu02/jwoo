import * as THREE from "three"

/**
 * A node's on-screen silhouette: the horizontal midpoint of its projected
 * bounding box and the top and bottom of its vertical extent, in pixels from the
 * canvas' top-left corner — the convention drei's `Html` expects, and the space
 * `computeTooltipPosition` works in.
 */
export interface NodeSpan {
  centerX: number
  top: number
  bottom: number
}

/**
 * Project a node's bounding box into screen space by walking all eight corners
 * and taking the projected extent.
 *
 * The silhouette, not a single world point: an anchor derived from the bbox
 * top-center drifts off the object's visible top from overhead or upward angles,
 * because the point that is "top" in world space is not the point that is
 * topmost on screen. Deriving the anchor from all eight projected corners each
 * frame keeps a label pinned to the object's top edge at any camera angle. The
 * home labels (the greeting, the hotspot tooltip) and the telemetry key and
 * mouse tooltips all anchor off this.
 *
 * Corners behind the near plane are skipped: `project()` folds them to the wrong
 * side of the screen. A labelled node is always in front, so this only guards an
 * edge grazing the camera.
 *
 * Returns null when the node is missing, has an empty bbox, or every corner sits
 * behind the camera, so callers can bail out of placing the label.
 */
export function projectNodeSpan(
  node: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  size: { width: number; height: number },
): NodeSpan | null {
  if (!node) return null
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  if (box.isEmpty()) return null

  const cameraPos = new THREE.Vector3()
  camera.getWorldPosition(cameraPos)
  const cameraForward = new THREE.Vector3()
  camera.getWorldDirection(cameraForward)

  const widthHalf = size.width / 2
  const heightHalf = size.height / 2

  let minX = Infinity
  let maxX = -Infinity
  let top = Infinity
  let bottom = -Infinity

  for (let corner = 0; corner < 8; corner++) {
    // A world-space bbox corner.
    const point = new THREE.Vector3(
      corner & 1 ? box.max.x : box.min.x,
      corner & 2 ? box.max.y : box.min.y,
      corner & 4 ? box.max.z : box.min.z,
    )
    if (point.clone().sub(cameraPos).dot(cameraForward) <= 0) continue
    point.project(camera)
    const screenX = point.x * widthHalf + widthHalf
    const screenY = -(point.y * heightHalf) + heightHalf
    if (screenX < minX) minX = screenX
    if (screenX > maxX) maxX = screenX
    if (screenY < top) top = screenY
    if (screenY > bottom) bottom = screenY
  }

  if (minX === Infinity) return null
  return { centerX: (minX + maxX) / 2, top, bottom }
}
