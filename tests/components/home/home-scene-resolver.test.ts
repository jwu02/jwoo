import * as THREE from "three"

import {
  registerHomeScene,
  resolveHomeHotspot,
} from "@/components/home/home-scene-resolver"
import { HOME_SCENE_HOTSPOTS } from "@/components/home/scene-config"

// Module-level scene state persists across tests in this file, so each test
// starts clean (null scene) and registers exactly what it needs.
afterEach(() => registerHomeScene(null))

function makeDeskScene() {
  const scene = new THREE.Group()
  // A node whose world-space bbox center is [1, 2, 3] (geometry is origin-
  // centered, the mesh sits at [1,2,3]).
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1))
  desk.name = "Desk"
  desk.position.set(1, 2, 3)
  scene.add(desk)
  // A camera node named CameraDesk at [5,6,7] gazing along -z (identity rotation).
  const camera = new THREE.Object3D()
  camera.name = "CameraDesk"
  camera.position.set(5, 6, 7)
  scene.add(camera)
  return scene
}

describe("resolveHomeHotspot", () => {
  it("returns null before the scene is registered", () => {
    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")!
    expect(resolveHomeHotspot(desk)).toBeNull()
  })

  it("resolves a camera-backed hotspot with the authored camera pose and its gaze target", () => {
    registerHomeScene(makeDeskScene())
    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")!

    const resolved = resolveHomeHotspot(desk)!

    // Camera flies to CameraDesk's authored position; the orbit target is where
    // the desk's bbox center projects onto the camera's -z gaze: [5,6,7] minus
    // the 4-unit forward distance to [1,2,3] → [5,6,3].
    expect(resolved.request.cameraPos).toEqual([5, 6, 7])
    expect(resolved.request.point).toEqual([5, 6, 3])
    // The desk view keeps the intro greeting engaged above the MacBook.
    expect(resolved.hero).toBe("macbook")
  })

  it("resolves a bbox-fit hotspot from its node's world bounding box", () => {
    const bottleNode = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
    bottleNode.name = "WaterBottle"
    bottleNode.position.set(0, 1, 0)
    registerHomeScene(new THREE.Group().add(bottleNode))
    const bottle = HOME_SCENE_HOTSPOTS.find((h) => h.id === "bottle")!

    const resolved = resolveHomeHotspot(bottle)!

    // Point is the world bbox center; radius is half the box diagonal
    // (2×2×2 box → diagonal √12 ≈ 3.464 → radius ≈ 1.732).
    expect(resolved.request.point).toEqual([0, 1, 0])
    expect(resolved.request.radius).toBeCloseTo(Math.sqrt(3), 2)
    expect(resolved.request.cameraPos).toBeUndefined()
    expect(resolved.hero).toBeNull()
  })

  it("falls back to the framing preset when a hotspot has no authored camera", () => {
    registerHomeScene(makeDeskScene())
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")!
    const focus = macbook.focus
    if (focus.type !== "framing") throw new Error("macbook preset must be framing")

    const resolved = resolveHomeHotspot(macbook)!

    // The MacBook has no authored camera, so the hand-tuned framing preset wins
    // (no bbox needed for a fixed view — the desk scene doesn't even contain it).
    expect(resolved.request.cameraPos).toEqual(focus.cameraPos)
    expect(resolved.request.point).toEqual(focus.target)
    expect(resolved.hero).toBe("macbook")
  })

  it("recomputes bboxes for a freshly registered scene", () => {
    const before = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
    before.name = "WaterBottle"
    before.position.set(0, 0, 0)
    registerHomeScene(new THREE.Group().add(before))
    const bottle = HOME_SCENE_HOTSPOTS.find((h) => h.id === "bottle")!
    expect(resolveHomeHotspot(bottle)!.request.point).toEqual([0, 0, 0])

    // A new scene must not reuse the previous scene's cached bbox (registering
    // clears the cache) — the bottle now sits at y=1.
    const after = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
    after.name = "WaterBottle"
    after.position.set(0, 1, 0)
    registerHomeScene(new THREE.Group().add(after))
    expect(resolveHomeHotspot(bottle)!.request.point).toEqual([0, 1, 0])
  })
})
