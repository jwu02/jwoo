import { closeSync, existsSync, openSync, readSync } from "node:fs"
import { join } from "node:path"

import { HOME_SCENE_HOTSPOTS, HOME_SCENE_MODEL } from "@/components/home/scene-config"

describe("HOME_SCENE_MODEL", () => {
  it("serves the single combined homepage model", () => {
    expect(HOME_SCENE_MODEL.url).toBe("/homepage.glb")
  })
})

describe("HOME_SCENE_HOTSPOTS", () => {
  it("defines one hotspot per interactive model with unique ids and node names", () => {
    expect(HOME_SCENE_HOTSPOTS).toHaveLength(5)
    expect(new Set(HOME_SCENE_HOTSPOTS.map((h) => h.id)).size).toBe(5)
    expect(new Set(HOME_SCENE_HOTSPOTS.map((h) => h.node)).size).toBe(5)
  })

  it("covers the five interactive glb nodes", () => {
    const nodes = HOME_SCENE_HOTSPOTS.map((h) => h.node)
    for (const name of ["MacBook", "Desk", "Water Flask", "Resume", "Xiaomi"]) {
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

  it("leaves desk, flask, and car without a nav target", () => {
    for (const id of ["desk", "flask", "car"]) {
      const h = HOME_SCENE_HOTSPOTS.find((x) => x.id === id)
      expect(h?.target).toBeUndefined()
    }
  })

  it("wires each hotspot to its focus preset", () => {
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")
    expect(macbook?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "macbook" }))

    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")
    expect(desk?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "intro" }))

    const flask = HOME_SCENE_HOTSPOTS.find((h) => h.id === "flask")
    expect(flask?.focus).toEqual({ type: "fit" })

    const car = HOME_SCENE_HOTSPOTS.find((h) => h.id === "car")
    expect(car?.focus).toEqual(expect.objectContaining({ type: "framing", hero: "intro" }))
  })

  it("maps the desk and car hotspots to their GLB-authored cameras", () => {
    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")
    expect(desk?.camera).toBe("Camera_Desk")

    const car = HOME_SCENE_HOTSPOTS.find((h) => h.id === "car")
    expect(car?.camera).toBe("Camera_Xiaomi")
  })

  it("leaves macbook, flask, and resume without a GLB camera", () => {
    for (const id of ["macbook", "flask", "resume"]) {
      const h = HOME_SCENE_HOTSPOTS.find((x) => x.id === id)
      expect(h?.camera).toBeUndefined()
    }
  })
})

// The hotspot node names are only meaningful if they line up with the actual
// top-level nodes of homepage.glb. The pristine original lives in the
// git-ignored .glb-originals/ dir, so this suite skips when it's absent
// (fresh checkout / CI without the binary asset).
const glbPath = join(process.cwd(), "public/.glb-originals/homepage.glb")
const describeGlb = existsSync(glbPath) ? describe : describe.skip

function readGlbTopLevelNames(): string[] {
  const fd = openSync(glbPath, "r")
  try {
    const head = Buffer.alloc(20)
    readSync(fd, head, 0, 20, 0)
    const chunkLen = head.readUInt32LE(12)
    expect(head.toString("ascii", 16, 20)).toBe("JSON")
    const body = Buffer.alloc(chunkLen)
    readSync(fd, body, 0, chunkLen, 20)
    const json = JSON.parse(body.toString("utf8"))
    const scene = json.scenes[json.scene ?? 0]
    return scene.nodes.map((index: number) => json.nodes[index].name)
  } finally {
    closeSync(fd)
  }
}

describeGlb("homepage.glb hotspot coverage", () => {
  it("every hotspot node name is a top-level node of homepage.glb", () => {
    const names = new Set(readGlbTopLevelNames())
    for (const hotspot of HOME_SCENE_HOTSPOTS) {
      expect(names.has(hotspot.node)).toBe(true)
    }
  })
})
