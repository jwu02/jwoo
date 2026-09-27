import * as THREE from "three"

import { projectNodeSpan } from "@/components/three/scene-span"

const SIZE = { width: 800, height: 600 }

/** Build a node whose world-space bbox top-center sits at (cx, topY, cz). */
function nodeWithTop(cx: number, topY: number, cz: number, height: number): THREE.Group {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, height, 1),
    new THREE.MeshBasicMaterial(),
  )
  // A box is centered on its origin, so sink it half its height below `topY`.
  mesh.position.set(cx, topY - height / 2, cz)
  const group = new THREE.Group()
  group.add(mesh)
  group.updateWorldMatrix(true, true)
  return group
}

function cameraAt(pos: [number, number, number], target: [number, number, number]): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, SIZE.width / SIZE.height, 0.1, 100)
  camera.position.set(...pos)
  camera.lookAt(new THREE.Vector3(...target))
  camera.updateMatrixWorld()
  return camera
}

/** The projected extent of the node's 8 bbox corners, as an [left, right, top, bottom] quad. */
function projectedSilhouette(node: THREE.Object3D, camera: THREE.Camera): [number, number, number, number] {
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  const camPos = new THREE.Vector3()
  camera.getWorldPosition(camPos)
  const camForward = new THREE.Vector3()
  camera.getWorldDirection(camForward)
  let left = Infinity
  let right = -Infinity
  let topY = Infinity
  let bottomY = -Infinity
  for (let corner = 0; corner < 8; corner++) {
    const point = new THREE.Vector3(
      corner & 1 ? box.max.x : box.min.x,
      corner & 2 ? box.max.y : box.min.y,
      corner & 4 ? box.max.z : box.min.z,
    )
    if (point.clone().sub(camPos).dot(camForward) <= 0) continue
    point.project(camera)
    const sx = point.x * (SIZE.width / 2) + SIZE.width / 2
    const sy = -(point.y * (SIZE.height / 2)) + SIZE.height / 2
    if (sx < left) left = sx
    if (sx > right) right = sx
    if (sy < topY) topY = sy
    if (sy > bottomY) bottomY = sy
  }
  return [left, right, topY, bottomY]
}

/** The weaker projection the span replaced: the bbox top-center as one world point. */
function projectedTopCenter(node: THREE.Object3D, camera: THREE.Camera): [number, number] {
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const top = new THREE.Vector3(center.x, box.max.y, center.z).project(camera)
  return [top.x * (SIZE.width / 2) + SIZE.width / 2, -(top.y * (SIZE.height / 2)) + SIZE.height / 2]
}

// A deliberately gentle/elevated angle and a steep low angle that are far apart
// in projected coordinates, so the angle-independence assertions actually
// exercise distinct viewpoints rather than two nearly-identical cameras.
const HIGH_CAM = cameraAt([0.5, 2.2, 1.6], [0, 0.6, 0])
const LOW_CAM = cameraAt([0, 0.35, 2.2], [0, 0.6, 0])

describe("projectNodeSpan", () => {
  it("returns the projected extent of all eight bbox corners", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    const span = projectNodeSpan(node, HIGH_CAM, SIZE)
    const [left, right, topY, bottomY] = projectedSilhouette(node, HIGH_CAM)

    expect(span).not.toBeNull()
    expect(span!.centerX).toBeCloseTo((left + right) / 2)
    expect(span!.top).toBeCloseTo(topY)
    expect(span!.bottom).toBeCloseTo(bottomY)
  })

  it("anchors on the silhouette top, not the projected bbox top-center", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    const span = projectNodeSpan(node, HIGH_CAM, SIZE)!
    const [, topCenterY] = projectedTopCenter(node, HIGH_CAM)

    // From an elevated angle the topmost corner on screen sits well above the
    // world-space top-center — the drift that made a single-point anchor float
    // off the object. A single-point implementation fails this.
    expect(topCenterY - span.top).toBeGreaterThan(8)
  })

  it("spans a non-empty vertical extent for a visible node", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    const span = projectNodeSpan(node, LOW_CAM, SIZE)!
    expect(span.bottom).toBeGreaterThan(span.top)
  })

  it("returns null for a missing or empty node so callers can bail out", () => {
    expect(projectNodeSpan(null, HIGH_CAM, SIZE)).toBeNull()
    expect(projectNodeSpan(undefined, HIGH_CAM, SIZE)).toBeNull()
    const empty = new THREE.Group()
    empty.updateWorldMatrix(true, true)
    expect(projectNodeSpan(empty, HIGH_CAM, SIZE)).toBeNull()
  })

  it("returns null when every corner sits behind the camera", () => {
    // HIGH_CAM looks toward the origin from +y/+z, so a node placed well past it
    // has all corners behind the near plane. Their projections fold to the wrong
    // side of the screen, so they are skipped and there is no span to report.
    const node = nodeWithTop(0, 1.2, 60, 1.2)
    expect(projectNodeSpan(node, HIGH_CAM, SIZE)).toBeNull()
  })
})
