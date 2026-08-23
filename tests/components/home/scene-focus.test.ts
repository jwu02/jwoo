import {
  fitDistance,
  gazeTarget,
  readWorldPosition,
  resolveFocus,
  type CameraPose,
  type FocusInfo,
} from "@/components/home/scene-focus"

describe("fitDistance", () => {
  it("returns the distance needed for a sphere of the given radius to fit a vertical fov", () => {
    // radius / sin(fov/2): fov 45° → half-fov 22.5°, sin ≈ 0.38268
    expect(fitDistance(2.88, 45, 1)).toBeCloseTo(7.526, 2)
  })

  it("applies a margin by default so objects are not edge-to-edge", () => {
    // 1 / sin(22.5°) ≈ 2.6131, × default margin 1.15 ≈ 3.005
    expect(fitDistance(1, 45)).toBeCloseTo(3.005, 3)
  })

  it("handles a wide fov", () => {
    // fov 90° → half-fov 45°, sin ≈ 0.70711
    expect(fitDistance(1, 90, 1)).toBeCloseTo(1.414, 3)
  })

  it("returns 0 for a degenerate radius or fov", () => {
    expect(fitDistance(0, 45)).toBe(0)
    expect(fitDistance(1, 0)).toBe(0)
  })
})

describe("resolveFocus", () => {
  const info: FocusInfo = { point: [1, 2, 3], radius: 0.5 }

  it("maps a fit preset to a plain focus request and no hero change", () => {
    const { request, hero } = resolveFocus({ type: "fit" }, info)
    expect(request).toEqual({ point: [1, 2, 3], radius: 0.5 })
    expect(request.cameraPos).toBeUndefined()
    expect(hero).toBeNull()
  })

  it("maps a framing preset to a fixed target + camera position and its hero", () => {
    const { request, hero } = resolveFocus(
      { type: "framing", target: [0, 0.78, 0], cameraPos: [0, 0.8, 2], hero: "macbook" },
      info,
    )
    expect(request).toEqual({ point: [0, 0.78, 0], radius: 0, cameraPos: [0, 0.8, 2] })
    expect(hero).toBe("macbook")
  })

  it("carries the preset's intro hero on a framing preset", () => {
    const { request, hero } = resolveFocus(
      { type: "framing", target: [0, 0.35, 0], cameraPos: [1.9, 1.7, 2.2], hero: "intro" },
      info,
    )
    expect(request).toEqual({ point: [0, 0.35, 0], radius: 0, cameraPos: [1.9, 1.7, 2.2] })
    expect(hero).toBe("intro")
  })

  it("overrides the fixed camera with a GLB camera pose and targets its gaze projection", () => {
    // A GLB-authored camera (e.g. CameraXiaomi) wins over the preset's hand-tuned
    // cameraPos. The orbit target becomes where the camera's gaze line passes
    // nearest the node center (its projection onto the forward axis), so the view
    // direction reproduces the Blender-authored shot while the rotation center
    // stays near the object. Camera at [5,6,7] looking along -z: the node center
    // [1,2,3] projects 4 units ahead to [5,6,3].
    const camera: CameraPose = { position: [5, 6, 7], forward: [0, 0, -1] }
    const { request, hero } = resolveFocus(
      { type: "framing", target: [-2.48, 0.55, -0.92], cameraPos: [-1.44, 0.9, 1.7], hero: "intro" },
      info,
      camera,
    )
    expect(request).toEqual({ point: [5, 6, 3], radius: 0, cameraPos: [5, 6, 7] })
    expect(hero).toBe("intro")
  })

  it("aims the gaze through the node so a high desk camera frames it from above", () => {
    // Regression test for the desk view: aiming at the desk's bbox center (low,
    // mid-height including the legs) made the camera gaze too steeply downward
    // and pushed the desk top off-frame ("too below"). Projecting onto the
    // CameraDesk forward instead lands the target above the bbox center, so the
    // shot matches Blender's top-down framing. CameraDesk pose from homepage.glb:
    // position [2.51,1.59,2.37], forward ≈ [0,-0.39,0.92]; desk bbox center ≈ [2.5,0.4,3.5].
    const camera: CameraPose = { position: [2.5, 1.6, 2.4], forward: [0, -0.39, 0.92] }
    const deskInfo: FocusInfo = { point: [2.5, 0.4, 3.5], radius: 1 }
    const { request } = resolveFocus(
      { type: "framing", target: [0, 0.7, 0], cameraPos: [0.5, 1.7, 1.6], hero: "intro" },
      deskInfo,
      camera,
    )
    // dot([0,-1.2,1.1], forward) = 0.468 + 1.012 = 1.48 → target = pos + forward * 1.48
    expect(request.cameraPos).toEqual([2.5, 1.6, 2.4])
    expect(request.point[0]).toBeCloseTo(2.5, 3)
    expect(request.point[1]).toBeCloseTo(1.0228, 3)
    expect(request.point[2]).toBeCloseTo(3.7616, 3)
    // The camera must gaze at a point *above* the desk's bbox center so the desk
    // top (the "above" Blender sees) stays in frame rather than being cut off.
    expect(request.point[1]).toBeGreaterThan(deskInfo.point[1])
  })

  it("keeps the preset's target and cameraPos when no GLB camera is provided", () => {
    const { request } = resolveFocus(
      { type: "framing", target: [0, 0.7, 0], cameraPos: [0.5, 1.7, 1.6], hero: "intro" },
      info,
    )
    expect(request).toEqual({ point: [0, 0.7, 0], radius: 0, cameraPos: [0.5, 1.7, 1.6] })
  })
})

describe("gazeTarget", () => {
  it("projects the node center onto the camera's forward axis", () => {
    const camera: CameraPose = { position: [0, 1.5, 0], forward: [0, -0.6, 0.8] }
    // center - pos = [0, -0.5, 2]; dot with forward = 0.3 + 1.6 = 1.9
    const target = gazeTarget(camera, [0, 1, 2])
    expect(target[0]).toBeCloseTo(0, 6)
    expect(target[1]).toBeCloseTo(0.36, 6)
    expect(target[2]).toBeCloseTo(1.52, 6)
  })

  it("clamps the target in front of the camera when it looks away from the node", () => {
    // Node is behind the camera (camera looks along -z, node at +z): the raw
    // projection would land behind the camera, so it clamps to a minimum forward
    // distance instead — the orbit target must stay in front of the camera.
    const camera: CameraPose = { position: [0, 0, 0], forward: [0, 0, -1] }
    expect(gazeTarget(camera, [0, 0, 5])).toEqual([0, 0, -0.5])
  })
})

describe("readWorldPosition", () => {
  it("extracts the translation from a column-major elements array", () => {
    const elements = [
      1, 0, 0, 0, // col 0
      0, 1, 0, 0, // col 1
      0, 0, 1, 0, // col 2
      5, 6, 7, 1, // col 3 = translation
    ]
    expect(readWorldPosition({ matrixWorld: { elements } })).toEqual([5, 6, 7])
  })

  it("handles THREE.Matrix4's Float32Array elements", () => {
    const elements = new Float32Array([
      1, 0, 0, 0, //
      0, 1, 0, 0, //
      0, 0, 1, 0, //
      -1.5, 2.25, 3.75, 1,
    ])
    expect(readWorldPosition({ matrixWorld: { elements } })).toEqual([-1.5, 2.25, 3.75])
  })
})
