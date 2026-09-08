import * as THREE from "three"

import type { TooltipAnchor } from "@/lib/telemetry/tooltip-position"

/**
 * Project a keycap node into an on-screen anchor for the tooltip.
 *
 * The keyboard is a fixed straight-top-down view, so the tooltip should hug the
 * key's ON-SCREEN silhouette — not a single world point (which would drift with
 * any residual camera tilt). This mirrors the home scene's
 * `projectObjectAboveToScreen`: it projects all eight bbox corners and derives
 * the tooltip anchor from the resulting on-screen span — `centerX` = horizontal
 * midpoint, `keyTop` = topmost edge, `keyHeight` = vertical footprint — so the
 * tooltip clamps/flips correctly for the top function row and edge keys.
 *
 * The canvas fills its container exactly, so the returned pixel coordinates
 * (top-left origin) are already container-content coordinates — the same space
 * `computeTooltipPosition` expects.
 *
 * Returns null when the node is missing, has an empty bbox, or every corner sits
 * behind the camera (the caller then falls back to a deterministic degenerate
 * anchor rather than rendering a tooltip at a bogus location).
 */
export function projectKeyAnchor(
  node: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  size: { width: number; height: number },
): TooltipAnchor | null {
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
  let topY = Infinity
  let bottomY = -Infinity

  for (let corner = 0; corner < 8; corner++) {
    // A world-space bbox corner. Points behind the near plane project onto the
    // wrong side of the screen, so skip them; the key is always in front, so
    // this only guards a node edge grazing the camera.
    const point = new THREE.Vector3(
      corner & 1 ? box.max.x : box.min.x,
      corner & 2 ? box.max.y : box.min.y,
      corner & 4 ? box.max.z : box.min.z,
    )
    if (point.clone().sub(cameraPos).dot(cameraForward) <= 0) continue
    point.project(camera)
    const screenX = point.x * widthHalf + widthHalf
    const screenY = -point.y * heightHalf + heightHalf
    if (screenX < minX) minX = screenX
    if (screenX > maxX) maxX = screenX
    if (screenY < topY) topY = screenY
    if (screenY > bottomY) bottomY = screenY
  }

  if (minX === Infinity) return null

  return {
    centerX: (minX + maxX) / 2,
    keyTop: topY,
    keyHeight: bottomY - topY,
  }
}
