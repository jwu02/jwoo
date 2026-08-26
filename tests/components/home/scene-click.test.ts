import { resolveClickAction } from "@/components/home/scene-click"
import { HOME_SCENE_HOTSPOTS } from "@/components/home/scene-config"
import type { SceneNode } from "@/components/home/scene-hit"

// Build a root → node → mesh chain so resolveTopLevelNode can walk a "hit" mesh
// up to the top-level node under the root, mirroring a real scene hit.
function sceneChain(nodeName: string): { root: SceneNode; mesh: SceneNode } {
  const mesh: SceneNode = { name: "mesh", parent: null }
  const node: SceneNode = { name: nodeName, parent: mesh }
  mesh.parent = node
  const root: SceneNode = { name: "Scene", parent: node }
  node.parent = root
  return { root, mesh }
}

describe("resolveClickAction", () => {
  it("navigates immediately on a single click for every hotspot with a target page", () => {
    for (const hotspot of HOME_SCENE_HOTSPOTS) {
      if (!hotspot.target) continue
      const { root, mesh } = sceneChain(hotspot.node)
      const action = resolveClickAction(mesh, 0, root, HOME_SCENE_HOTSPOTS)
      expect(action).toEqual({ kind: "navigate", target: hotspot.target })
    }
  })

  it("keeps click-to-focus for interactive hotspots without a page", () => {
    for (const hotspot of HOME_SCENE_HOTSPOTS) {
      if (hotspot.target || hotspot.interactive === false) continue
      const { root, mesh } = sceneChain(hotspot.node)
      const action = resolveClickAction(mesh, 0, root, HOME_SCENE_HOTSPOTS)
      expect(action).toEqual({ kind: "focus", hotspot })
    }
  })

  it("ignores a click on a non-interactive hotspot (e.g. the desk)", () => {
    const desk = HOME_SCENE_HOTSPOTS.find((h) => h.id === "desk")!
    expect(desk.interactive).toBe(false)
    const { root, mesh } = sceneChain(desk.node)
    expect(resolveClickAction(mesh, 0, root, HOME_SCENE_HOTSPOTS)).toEqual({ kind: "ignore" })
  })

  it("never navigates on a drag release, even over a hotspot with a page", () => {
    const macbook = HOME_SCENE_HOTSPOTS.find((h) => h.id === "macbook")!
    const { root, mesh } = sceneChain(macbook.node)
    expect(resolveClickAction(mesh, 3, root, HOME_SCENE_HOTSPOTS)).toEqual({ kind: "ignore" })
  })

  it("ignores clicks that miss every hotspot", () => {
    const root: SceneNode = { name: "Scene", parent: null }
    // A decor object that is not a hotspot node.
    const bookshelf: SceneNode = { name: "Bookshelf", parent: root }
    const mesh: SceneNode = { name: "mesh", parent: bookshelf }
    expect(resolveClickAction(mesh, 0, root, HOME_SCENE_HOTSPOTS)).toEqual({ kind: "ignore" })

    // The scene root itself (empty space) is not a hotspot either.
    expect(resolveClickAction(root, 0, root, HOME_SCENE_HOTSPOTS)).toEqual({ kind: "ignore" })
  })
})
