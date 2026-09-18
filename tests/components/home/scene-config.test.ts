import {
  HOME_GREETING,
  HOME_INITIAL_VIEW,
  HOME_SCENE_HOTSPOTS,
  HOME_SCENE_MODEL,
  HOME_VIEWS,
} from "@/components/home/scene-config"

describe("HOME_SCENE_MODEL", () => {
  it("serves the single combined homepage model", () => {
    expect(HOME_SCENE_MODEL.url).toBe("/homepage.glb")
  })
})

describe("HOME_SCENE_HOTSPOTS", () => {
  it("defines one hotspot per interactive model with unique ids and node names", () => {
    expect(HOME_SCENE_HOTSPOTS).toHaveLength(7)
    expect(new Set(HOME_SCENE_HOTSPOTS.map((h) => h.id)).size).toBe(7)
    expect(new Set(HOME_SCENE_HOTSPOTS.map((h) => h.node)).size).toBe(7)
  })

  it("covers the seven interactive glb nodes", () => {
    const nodes = HOME_SCENE_HOTSPOTS.map((h) => h.node)
    for (const name of [
      "MacBook",
      "Desk",
      "WaterBottle",
      "Bonsai",
      "Resume",
      "XiaomiSu7Ultra",
      "AiUsage",
    ]) {
      expect(nodes).toContain(name)
    }
  })

  it("maps the macbook hotspot to /activity-telemetry with a label", () => {
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")
    expect(macbook?.node).toBe("MacBook")
    expect(macbook?.target).toBe("/activity-telemetry")
    expect(macbook?.label).toBe("Activity Telemetry")
  })

  it("gives the macbook no focus preset — it navigates rather than being framed", () => {
    // The MacBook's framing preset was a fossil of when its view was the load
    // view; clicking navigates to /activity-telemetry, so nothing ever read the
    // preset's target or cameraPos. A hotspot's `focus` says what the camera
    // does when the hotspot is selected, and this one is never selected.
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")
    expect(macbook?.focus).toBeUndefined()
  })

  it("maps the resume hotspot to /resume", () => {
    const resume = HOME_SCENE_HOTSPOTS.find((h) => h.id === "resume")
    expect(resume?.node).toBe("Resume")
    expect(resume?.target).toBe("/resume")
  })

  it("maps the ai-usage hotspot to /ai-usage", () => {
    const aiUsage = HOME_SCENE_HOTSPOTS.find((h) => h.id === "ai-usage")
    expect(aiUsage?.node).toBe("AiUsage")
    expect(aiUsage?.target).toBe("/ai-usage")
    expect(aiUsage?.label).toBe("AI Usage")
  })

  it("leaves desk, bottle, bonsai, and car without a nav target", () => {
    for (const id of ["desk", "bottle", "bonsai", "car"]) {
      const h = HOME_SCENE_HOTSPOTS.find((x) => x.id === id)
      expect(h?.target).toBeUndefined()
    }
  })

  it("marks only the desk as non-interactive — it is a camera view, not a clickable object", () => {
    for (const hotspot of HOME_SCENE_HOTSPOTS) {
      if (hotspot.id === "desk") {
        expect(hotspot.interactive).toBe(false)
      } else {
        expect(hotspot.interactive).not.toBe(false)
      }
    }
  })

  it("wires each framed hotspot to its focus preset", () => {
    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")
    expect(desk?.focus).toEqual(expect.objectContaining({ type: "framing" }))

    const bottle = HOME_SCENE_HOTSPOTS.find((h) => h.id === "bottle")
    expect(bottle?.focus).toEqual({ type: "fit" })

    const bonsai = HOME_SCENE_HOTSPOTS.find((h) => h.id === "bonsai")
    expect(bonsai?.focus).toEqual({ type: "fit" })

    const car = HOME_SCENE_HOTSPOTS.find((h) => h.id === "car")
    expect(car?.focus).toEqual(expect.objectContaining({ type: "framing" }))
  })

  it("maps the desk and car hotspots to their GLB-authored cameras", () => {
    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")
    expect(desk?.camera).toBe("CameraDesk")

    const car = HOME_SCENE_HOTSPOTS.find((h) => h.id === "car")
    expect(car?.camera).toBe("CameraXiaomi")
  })

  it("leaves macbook, bottle, bonsai, and resume without a GLB camera", () => {
    for (const id of ["macbook", "bottle", "bonsai", "resume"]) {
      const h = HOME_SCENE_HOTSPOTS.find((x) => x.id === id)
      expect(h?.camera).toBeUndefined()
    }
  })
})

describe("HOME_VIEWS", () => {
  it("offers the two GLB-authored camera views in hotspot order", () => {
    expect(HOME_VIEWS).toEqual([
      { id: "desk", label: "Desk" },
      { id: "car", label: "Xiaomi SU7" },
    ])
  })

  it("derives a button for every camera-backed hotspot — adding a camera adds a button", () => {
    const cameraIds = HOME_SCENE_HOTSPOTS.filter((h) => h.camera).map((h) => h.id)
    expect(HOME_VIEWS.map((v) => v.id)).toEqual(cameraIds)
  })

  it("gives every view short pill copy rather than its full tooltip name", () => {
    // The rule the derivation rests on: a hotspot backed by an authored camera
    // is a view, so it must carry the short label the pill renders. The tooltip
    // label is deliberately longer ("2025 Xiaomi SU7 Ultra").
    for (const hotspot of HOME_SCENE_HOTSPOTS.filter((h) => h.camera)) {
      expect(hotspot.viewLabel).toBeTruthy()
    }
    expect(HOME_VIEWS.map((view) => view.label)).not.toContain("2025 Xiaomi SU7 Ultra")
  })
})

describe("HOME_INITIAL_VIEW", () => {
  it("is the desk, framed by a preset that can seat the camera before the GLB loads", () => {
    expect(HOME_INITIAL_VIEW.hotspot.id).toBe("desk")
    expect(HOME_INITIAL_VIEW.framing.type).toBe("framing")
    expect(HOME_INITIAL_VIEW.framing.cameraPos).toHaveLength(3)
    expect(HOME_INITIAL_VIEW.framing.target).toHaveLength(3)
  })

  it("is the only hotspot marked initial", () => {
    expect(HOME_SCENE_HOTSPOTS.filter((hotspot) => hotspot.initial)).toHaveLength(1)
  })
})

describe("HOME_GREETING", () => {
  it("anchors above a node the scene actually has", () => {
    expect(HOME_SCENE_HOTSPOTS.map((h) => h.node)).toContain(HOME_GREETING.node)
  })

  it("is engaged by the load view and no other", () => {
    // The greeting floats above the MacBook, but it is the *view* that asks for
    // it: the desk is the load view, so a fresh scene greets without a click,
    // and flying to the car dismisses it. Anchoring it on the MacBook hotspot
    // instead would tie the greeting to an object that is never framed.
    const engaging = HOME_SCENE_HOTSPOTS.filter((hotspot) => hotspot.greeting).map((h) => h.id)
    expect(engaging).toEqual([HOME_INITIAL_VIEW.hotspot.id])
  })
})
