import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PHYSICAL_KEYS } from "@/lib/telemetry/key-layout"
import {
  KEYBOARD_MODEL_URL,
  NO_NODE_IDS,
  PHYSICAL_KEY_NODE,
  glbNodeName,
  hasNode,
  physicalIdForNode,
  runtimeNodeName,
} from "@/lib/telemetry/key-node-map"

/** Read the JSON chunk out of a .glb (binary glTF) file. */
function readGltfJson(path: string): {
  nodes?: { name?: string }[]
  extensionsUsed?: string[]
} {
  const buf = readFileSync(path)
  // GLB header: magic(4) version(4) length(4) then a chunk: length(4) type(4).
  const jsonChunkLength = buf.readUInt32LE(12)
  return JSON.parse(buf.slice(20, 20 + jsonChunkLength).toString("utf8"))
}

describe("PHYSICAL_KEY_NODE", () => {
  it("maps every physical id either to a node or to NO_NODE_IDS, never both/neither", () => {
    const ids = PHYSICAL_KEYS.map((key) => key.id)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const mapped = id in PHYSICAL_KEY_NODE
      const absent = NO_NODE_IDS.has(id)
      expect(mapped).toBe(!absent)
    }
  })

  it("marks exactly the removed Section (the §/± key) as node-less", () => {
    expect([...NO_NODE_IDS].sort()).toEqual(["Section"])
  })

  it("keeps every mapped node name distinct (injective)", () => {
    const nodeNames = Object.values(PHYSICAL_KEY_NODE)
    expect(new Set(nodeNames).size).toBe(nodeNames.length)
  })

  it("maps every one of the 78 GLB key nodes to exactly one id and vice versa", () => {
    const gltf = readGltfJson(join(process.cwd(), "public", "keyboard.glb"))
    const glbKeyNodes = (gltf.nodes ?? [])
      .map((n) => n.name ?? "")
      .filter((n): n is string => n.startsWith("key_"))

    expect(glbKeyNodes.length).toBe(78)
    expect(glbKeyNodes).toContain("key_backquote")
    expect(glbKeyNodes).not.toContain("key_control_right")
    expect(glbKeyNodes).not.toContain("key_section")

    // Every GLB key node maps back to a physical id.
    const mappedIds = new Set(Object.keys(PHYSICAL_KEY_NODE))
    for (const node of glbKeyNodes) {
      const id = physicalIdForNode(node)
      expect(id).not.toBeNull()
      expect(mappedIds).toContain(id)
    }
    // And every mapped id's node exists in the GLB. (Maps 1:1 — both sides 78.)
    for (const id of Object.keys(PHYSICAL_KEY_NODE)) {
      const node = glbNodeName(id)
      expect(node).not.toBeNull()
      expect(glbKeyNodes).toContain(node)
    }
  })

  it("maps the count of physical keys to one fewer than the ids (78 mapped + 1 absent)", () => {
    const ids = PHYSICAL_KEYS.map((key) => key.id)
    const mapped = ids.filter((id) => id in PHYSICAL_KEY_NODE)
    expect(mapped.length).toBe(78)
  })
})

describe("glbNodeName / physicalIdForNode", () => {
  it("routes the backquote/~ key to the model's top-left node", () => {
    // The model moved `~/~ onto the number-row leftmost node.
    expect(glbNodeName("Backtick")).toBe("key_backquote")
    expect(physicalIdForNode("key_backquote")).toBe("Backtick")
  })

  it("returns null / null for the removed Section key", () => {
    expect(glbNodeName("Section")).toBeNull()
    expect(hasNode("Section")).toBe(false)
  })

  it("maps the common casing/aliases to their GLB nodes", () => {
    expect(glbNodeName("Return")).toBe("key_enter")
    expect(glbNodeName("Left Cmd")).toBe("key_command_left")
    expect(glbNodeName("Right Cmd")).toBe("key_command_right")
    expect(glbNodeName("Touch ID")).toBe("key_touchid")
    expect(glbNodeName("Up Arrow")).toBe("key_arrow_up")
    expect(glbNodeName("Left Shift")).toBe("key_shift_left")
    expect(glbNodeName("Delete")).toBe("key_delete")
  })

  it("returns null for non-key nodes (chassis) and unknown names", () => {
    expect(physicalIdForNode("chassis")).toBeNull()
    expect(physicalIdForNode("key_not_a_real_key")).toBeNull()
  })

  it("sanitizes node names the way GLTFLoader does on load", () => {
    expect(glbNodeName("Touch ID")).toBe(runtimeNodeName("key_touchid"))
  })
})

describe("KEYBOARD_MODEL_URL", () => {
  it("points at the Draco-compressed model with the local decoder path", () => {
    expect(KEYBOARD_MODEL_URL).toBe("/keyboard.glb")
  })

  it("the model is Draco-compressed (KHR_draco_mesh_compression)", () => {
    const gltf = readGltfJson(join(process.cwd(), "public", "keyboard.glb"))
    expect(gltf.extensionsUsed).toContain("KHR_draco_mesh_compression")
  })
})
