import { resolveTopLevelNode, type SceneNode } from "@/components/home/scene-hit"

function node(name: string, parent: SceneNode | null): SceneNode {
  return { name, parent }
}

describe("resolveTopLevelNode", () => {
  const scene = node("Scene", null)
  const macbook = node("MacBook", scene)
  const keycap = node("keycap", macbook)

  it("returns the top-level node name for a deeply nested hit", () => {
    expect(resolveTopLevelNode(keycap, scene)).toBe("MacBook")
  })

  it("returns the name when the hit is already a top-level child", () => {
    expect(resolveTopLevelNode(macbook, scene)).toBe("MacBook")
  })

  it("returns null when the hit is the root itself", () => {
    expect(resolveTopLevelNode(scene, scene)).toBeNull()
  })

  it("returns null for an object not under the root", () => {
    const orphan = node("Orphan", null)
    expect(resolveTopLevelNode(orphan, scene)).toBeNull()
  })
})
