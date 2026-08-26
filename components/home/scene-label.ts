import * as THREE from "three"

/**
 * Screen-space anchor for an HTML label hovering a 3D object (the intro greeting
 * and the per-object hover tooltip). Projects the node's bounding-box top-center
 * to pixel coordinates (top-left origin, the convention drei's Html expects) and
 * lifts it `pixelOffsetY` px.
 *
 * Offsetting in pixels rather than world units is what keeps the label the same
 * on-screen distance above the object from any camera angle. A fixed world-space
 * offset drifts with parallax: from a low angle looking up, world "up" maps to a
 * much larger screen gap (the label floats away from the object), and from a
 * high angle it reads much smaller. Pixel-anchoring re-derives the position from
 * the live projection each frame, so the label stays pinned just above the
 * object's top edge regardless of the camera.
 *
 * Returns [0, 0] when the node is missing or has an empty bbox so callers can
 * bail out of rendering the label.
 */
export function projectNodeTopToScreen(
  node: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  size: { width: number; height: number },
  pixelOffsetY: number,
): [number, number] {
  if (!node) return [0, 0]
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  if (box.isEmpty()) return [0, 0]
  const center = new THREE.Vector3()
  box.getCenter(center)
  const top = new THREE.Vector3(center.x, box.max.y, center.z).project(camera)
  const widthHalf = size.width / 2
  const heightHalf = size.height / 2
  return [
    top.x * widthHalf + widthHalf,
    -(top.y * heightHalf) + heightHalf - pixelOffsetY,
  ]
}

/**
 * Screen-space anchor for an HTML label that must hug the object's top edge at
 * ANY camera angle (the per-object hover tooltip). Unlike `projectNodeTopToScreen`
 * — which projects a single world-space point (the bbox top-center) and therefore
 * drifts off the object's visible top from overhead/downward angles — this
 * projects all eight bbox corners, then anchors just above the TOPMOST projected
 * corner, centered over the object's projected horizontal span. Because it derives
 * the position from the object's on-screen silhouette each frame, the label stays
 * pinned to the object's top edge whether the camera looks down, up, or level.
 *
 * Returns [0, 0] when the node is missing or has an empty bbox so callers can
 * bail out of rendering the label.
 */
export function projectObjectAboveToScreen(
  node: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  size: { width: number; height: number },
  pixelOffsetY: number,
  labelHeight: number,
): [number, number] {
  if (!node) return [0, 0]
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  if (box.isEmpty()) return [0, 0]
  const cameraPos = new THREE.Vector3()
  camera.getWorldPosition(cameraPos)
  const cameraForward = new THREE.Vector3()
  camera.getWorldDirection(cameraForward)
  const widthHalf = size.width / 2
  const heightHalf = size.height / 2
  let minX = Infinity
  let maxX = -Infinity
  let topY = Infinity
  for (let corner = 0; corner < 8; corner++) {
    // The world-space corner; project() folds points behind the near plane to
    // the other side of the screen, so skip any corner behind the camera. A
    // hovered object is always in front, so this only guards a label drifting
    // when a node edge grazes the near plane.
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
    if (screenY < topY) topY = screenY
  }
  if (minX === Infinity) return [0, 0]
  // Clamp the anchor so the label's top edge never runs off the top of the
  // viewport when a large object's top lands near the screen's top edge (e.g. a
  // tall prop in an overhead desk view). Without the clamp, "just above the
  // object" would push the label off-screen. The label is bottom-anchored, so
  // anchor.y - labelHeight is its top edge.
  const minAnchorY = labelHeight + pixelOffsetY
  return [(minX + maxX) / 2, Math.max(topY - pixelOffsetY, minAnchorY)]
}
