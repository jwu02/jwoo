import { fitDistance, resolveFocus, type FocusInfo } from "@/components/home/scene-focus"

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
})
