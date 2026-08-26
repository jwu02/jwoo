import * as THREE from "three"

import { projectNodeTopToScreen, projectObjectAboveToScreen } from "@/components/home/scene-label"

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

function projectedTop(node: THREE.Object3D, camera: THREE.Camera): [number, number] {
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const top = new THREE.Vector3(center.x, box.max.y, center.z).project(camera)
  return [top.x * (SIZE.width / 2) + SIZE.width / 2, -(top.y * (SIZE.height / 2)) + SIZE.height / 2]
}

/** Screen-space silhouette of the node's 8 bbox corners, as a [left, right, top] triple. */
function projectedSilhouette(node: THREE.Object3D, camera: THREE.Camera): [number, number, number] {
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  const camPos = new THREE.Vector3()
  camera.getWorldPosition(camPos)
  const camForward = new THREE.Vector3()
  camera.getWorldDirection(camForward)
  let left = Infinity
  let right = -Infinity
  let topY = Infinity
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
  }
  return [left, right, topY]
}

// A deliberately gentle/elevated angle and a steep low angle that are far apart
// in projected coordinates, so the angle-independence assertions actually
// exercise distinct viewpoints rather than two nearly-identical cameras.
const HIGH_CAM = cameraAt([0.5, 2.2, 1.6], [0, 0.6, 0])
const LOW_CAM = cameraAt([0, 0.35, 2.2], [0, 0.6, 0])
// A far camera that frames a node topped at y=1.2 mid-frame (no clamp engaged),
// so the silhouette-anchor math (top edge - offset) is observable directly.
const FRAMED_CAM = cameraAt([0, 1.5, 4.5], [0, 0.6, 0])

describe("projectNodeTopToScreen", () => {
  it("returns the object's projected bbox top-center lifted by the pixel offset", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    const [x, y] = projectNodeTopToScreen(node, HIGH_CAM, SIZE, 8)
    const [px, py] = projectedTop(node, HIGH_CAM)
    expect(x).toBeCloseTo(px)
    expect(y).toBeCloseTo(py - 8)
  })

  it("keeps the on-screen gap above the object constant across camera angles", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    // The two cameras truly differ: the projected top Y lands far apart.
    const [, highTopY] = projectedTop(node, HIGH_CAM)
    const [, lowTopY] = projectedTop(node, LOW_CAM)
    expect(Math.abs(highTopY - lowTopY)).toBeGreaterThan(8)

    const offset = 8
    for (const camera of [HIGH_CAM, LOW_CAM]) {
      const [, screenY] = projectNodeTopToScreen(node, camera, SIZE, offset)
      const [, projectedTopY] = projectedTop(node, camera)
      // The returned anchor sits a fixed `offset` px above the projected top,
      // no matter the angle — the property that keeps the label close to the
      // object instead of drifting with parallax.
      expect(projectedTopY - screenY).toBeCloseTo(offset)
    }
  })

  it("varies the pixel offset without changing the horizontal anchor", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    const [x] = projectNodeTopToScreen(node, HIGH_CAM, SIZE, 0)
    const [, yZero] = projectNodeTopToScreen(node, HIGH_CAM, SIZE, 0)
    const [, yTwenty] = projectNodeTopToScreen(node, HIGH_CAM, SIZE, 20)
    expect(x).toBeCloseTo(projectedTop(node, HIGH_CAM)[0])
    expect(yZero - yTwenty).toBeCloseTo(20)
  })

  it("returns the origin for a missing or empty node so callers can bail out", () => {
    expect(projectNodeTopToScreen(null, HIGH_CAM, SIZE, 8)).toEqual([0, 0])
    const empty = new THREE.Group()
    empty.updateWorldMatrix(true, true)
    expect(projectNodeTopToScreen(empty, HIGH_CAM, SIZE, 8)).toEqual([0, 0])
  })
})

const LABEL_HEIGHT = 28

describe("projectObjectAboveToScreen", () => {
  it("anchors above the object's projected silhouette top, centered horizontally", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    const [x, y] = projectObjectAboveToScreen(node, FRAMED_CAM, SIZE, 8, LABEL_HEIGHT)
    const [left, right, topY] = projectedSilhouette(node, FRAMED_CAM)
    expect(x).toBeCloseTo((left + right) / 2)
    expect(y).toBeCloseTo(topY - 8)
  })

  it("keeps a constant gap above the object's top edge across camera angles", () => {
    const node = nodeWithTop(0, 1.2, 0, 1.2)
    // Genuinely different elevations, both framing the node comfortably on-screen
    // (no clamp), so the constant-gap property is observable.
    const camB = cameraAt([0, 0.8, 4.0], [0, 0.6, 0])
    // The old single-point (top-center) anchor drifts between FRAMED_CAM and camB…
    expect(Math.abs(projectedTop(node, FRAMED_CAM)[1] - projectedTop(node, camB)[1])).toBeGreaterThan(8)
    // …but the silhouette top stays put, so the label sits the same distance above
    // the object's top edge regardless of the angle.
    const offset = 8
    for (const camera of [FRAMED_CAM, camB]) {
      const [, screenY] = projectObjectAboveToScreen(node, camera, SIZE, offset, LABEL_HEIGHT)
      const [, , projectedTopY] = projectedSilhouette(node, camera)
      expect(projectedTopY - screenY).toBeCloseTo(offset)
    }
  })

  it("clamps the label so its top edge stays on-screen when the object's top nears the frame edge", () => {
    // A node tall enough that its bbox top projects above the viewport top (its
    // on-screen topY drops below labelHeight + offset). The label's bottom anchor
    // must be pushed down to keep the label's top edge inside the viewport.
    const node = nodeWithTop(0, 3, 0, 3)
    const [, screenY] = projectObjectAboveToScreen(node, HIGH_CAM, SIZE, 8, LABEL_HEIGHT)
    expect(screenY).toBeCloseTo(LABEL_HEIGHT + 8)
  })

  it("returns the origin for a missing or empty node so callers can bail out", () => {
    expect(projectObjectAboveToScreen(null, HIGH_CAM, SIZE, 8, LABEL_HEIGHT)).toEqual([0, 0])
    const empty = new THREE.Group()
    empty.updateWorldMatrix(true, true)
    expect(projectObjectAboveToScreen(empty, HIGH_CAM, SIZE, 8, LABEL_HEIGHT)).toEqual([0, 0])
  })
})
