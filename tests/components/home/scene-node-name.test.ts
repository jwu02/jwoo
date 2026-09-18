import { HOME_SCENE_HOTSPOTS } from "@/components/home/scene-config"
import { resolveTopLevelNode, type SceneNode } from "@/components/home/scene-hit"
import { runtimeNodeName } from "@/components/home/scene-node-name"

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
