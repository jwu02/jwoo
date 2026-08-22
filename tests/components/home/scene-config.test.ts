import { HOME_SCENE_MODELS } from "@/components/home/scene-config"

describe("HOME_SCENE_MODELS", () => {
  it("defines exactly the three homepage models", () => {
    expect(HOME_SCENE_MODELS).toHaveLength(3)
    for (const id of ["macbook", "desk", "car"]) {
      expect(HOME_SCENE_MODELS.some((m) => m.id === id)).toBe(true)
    }
  })

  it("gives every model a unique id, a glb url, and a 3-component transform", () => {
    const ids = HOME_SCENE_MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of HOME_SCENE_MODELS) {
      expect(m.url).toMatch(/^\/[a-z0-9_-]+\.glb$/i)
      expect(m.position).toHaveLength(3)
      expect(m.scale).toHaveLength(3)
    }
  })

  it("maps the macbook to /activity-telemetry with a label", () => {
    const macbook = HOME_SCENE_MODELS.find((m) => m.id === "macbook")
    expect(macbook?.target).toBe("/activity-telemetry")
    expect(macbook?.label).toBe("Activity Telemetry")
  })

  it("leaves desk and car without a target until wired later", () => {
    for (const id of ["desk", "car"]) {
      const m = HOME_SCENE_MODELS.find((x) => x.id === id)
      expect(m?.target).toBeUndefined()
    }
  })

  it("wires each model to its focus preset", () => {
    const macbook = HOME_SCENE_MODELS.find((m) => m.id === "macbook")
    expect(macbook?.focus).toEqual(
      expect.objectContaining({ type: "framing", hero: "macbook" }),
    )

    const desk = HOME_SCENE_MODELS.find((m) => m.id === "desk")
    expect(desk?.focus).toEqual(
      expect.objectContaining({ type: "framing", hero: "intro" }),
    )

    const car = HOME_SCENE_MODELS.find((m) => m.id === "car")
    expect(car?.focus).toEqual(
      expect.objectContaining({ type: "framing", hero: "intro" }),
    )
  })
})
