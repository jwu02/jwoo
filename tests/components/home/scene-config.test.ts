import {
  HOME_HERO_ID,
  HOME_SCENE_HOTSPOTS,
  HOME_SCENE_MODEL,
  HOME_VIEW_SWITCHER,
  runtimeNodeName,
} from "@/components/home/scene-config"
import { resolveTopLevelNode, type SceneNode } from "@/components/home/scene-hit"

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
    for (const name of ["MacBook", "Desk", "WaterBottle", "Bonsai", "Resume", "XiaomiSu7Ultra", "AiUsage"]) {
      expect(nodes).toContain(name)
    }
  })

  it("maps the macbook hotspot to /activity-telemetry with a label", () => {
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")
    expect(macbook?.node).toBe("MacBook")
    expect(macbook?.target).toBe("/activity-telemetry")
    expect(macbook?.label).toBe("Activity Telemetry")
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
    expect(aiUsage?.focus).toEqual({ type: "fit" })
    expect(aiUsage?.camera).toBeUndefined()
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

  it("wires each hotspot to its focus preset", () => {
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")
    expect(macbook?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "macbook" }))

    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")
    // The desk view keeps the intro greeting engaged above the MacBook.
    expect(desk?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "macbook" }))

    const bottle = HOME_SCENE_HOTSPOTS.find((h) => h.id === "bottle")
    expect(bottle?.focus).toEqual({ type: "fit" })

    const bonsai = HOME_SCENE_HOTSPOTS.find((h) => h.id === "bonsai")
    expect(bonsai?.focus).toEqual({ type: "fit" })

    const car = HOME_SCENE_HOTSPOTS.find((h) => h.id === "car")
    expect(car?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "intro" }))
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

describe("HOME_HERO_ID", () => {
  it("names the desk hotspot as the initial page-load view", () => {
    expect(HOME_HERO_ID).toBe("desk")
    const hero = HOME_SCENE_HOTSPOTS.find((h) => h.id === HOME_HERO_ID)
    // The desk view keeps the intro greeting engaged on load.
    expect(hero?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "macbook" }))
  })
})

describe("HOME_VIEW_SWITCHER", () => {
  it("offers exactly the two GLB-authored camera views", () => {
    expect(HOME_VIEW_SWITCHER.map((v) => v.id)).toEqual(["desk", "car"])
  })

  it("every switcher id maps to a hotspot with a GLB camera", () => {
    for (const view of HOME_VIEW_SWITCHER) {
      const hotspot = HOME_SCENE_HOTSPOTS.find((h) => h.id === view.id)
      expect(hotspot?.camera).toBeDefined()
    }
  })

  it("covers every camera-backed hotspot — adding a camera means adding a button", () => {
    const cameraIds = HOME_SCENE_HOTSPOTS.filter((h) => h.camera).map((h) => h.id)
    expect(HOME_VIEW_SWITCHER.map((v) => v.id)).toEqual(cameraIds)
  })

  it("labels each view for the pill", () => {
    expect(HOME_VIEW_SWITCHER).toEqual([
      { id: "desk", label: "Desk" },
      { id: "car", label: "Xiaomi SU7" },
    ])
  })
})

describe("runtimeNodeName", () => {
  it("sanitizes special characters in authoring names the way three does on load", () => {
    // three r185's GLTFLoader runs PropertyBinding.sanitizeNodeName on every
    // node (spaces → underscores, [].:/ stripped). The GLB is authored with
    // CamelCase names ("WaterBottle") that pass through unchanged, but the
    // sanitizer guards against any future space/dot name silently breaking
    // hotspot matching against the loaded scene.
    expect(runtimeNodeName("Water Flask")).toBe("Water_Flask")
    expect(runtimeNodeName("AI Usage")).toBe("AI_Usage")
    expect(runtimeNodeName("WaterBottle")).toBe("WaterBottle")
    expect(runtimeNodeName("MacBook")).toBe("MacBook")
  })

  it("keys the hotspot map by the runtime names present in the loaded scene", () => {
    const runtimeNames = new Map(
      HOME_SCENE_HOTSPOTS.map((hotspot) => [runtimeNodeName(hotspot.node), hotspot.id]),
    )
    expect(runtimeNames.get("WaterBottle")).toBe("bottle")
    expect(runtimeNames.get("Bonsai")).toBe("bonsai")
    expect(runtimeNames.get("AiUsage")).toBe("ai-usage")
    expect(runtimeNames.get("MacBook")).toBe("macbook")
    expect(runtimeNames.get("XiaomiSu7Ultra")).toBe("car")

    // A hover hit on a mesh under the top-level node walks up to its runtime
    // name, which must map back to the bottle hotspot.
    const scene: SceneNode = { name: "Scene", parent: null }
    const bottle = { name: "WaterBottle", parent: scene }
    const mesh = { name: "polySurface10", parent: bottle }
    const resolved = resolveTopLevelNode(mesh, scene)
    expect(resolved).toBe("WaterBottle")
    expect(resolved && runtimeNames.get(resolved)).toBe("bottle")
  })
})
