import {
  MOUSE_MODEL_URL,
  MOUSE_REGION_NODES,
  mouseRegionForName,
  resolveMouseRegion,
  runtimeMouseNodeName,
  type MouseSceneNode,
} from "@/lib/telemetry/mouse-node-map";

describe("mouse-node-map", () => {
  it("points at the Draco-compressed mouse model", () => {
    expect(MOUSE_MODEL_URL).toBe("/mouse.glb");
  });

  it("maps the named button and wheel nodes to their regions", () => {
    expect(mouseRegionForName("Button_Left")).toBe("left");
    expect(mouseRegionForName("Button_Right")).toBe("right");
    expect(mouseRegionForName("Scroll_Wheel")).toBe("wheel");
    expect(mouseRegionForName("Scroll_Wheel_Inner")).toBe("wheel");
  });

  it("returns null for unrecognised names", () => {
    expect(mouseRegionForName("Body")).toBeNull();
    expect(mouseRegionForName("Cable_Cap")).toBeNull();
  });

  it("exposes the node names for each region", () => {
    expect(MOUSE_REGION_NODES.left).toContain("Button_Left");
    expect(MOUSE_REGION_NODES.right).toContain("Button_Right");
    expect(MOUSE_REGION_NODES.wheel).toEqual(["Scroll_Wheel", "Scroll_Wheel_Inner"]);
  });

  describe("resolveMouseRegion", () => {
    const root: MouseSceneNode = { name: "Mouse", parent: null };

    it("resolves the left and right buttons", () => {
      const left = { name: "Button_Left", parent: root };
      const right = { name: "Button_Right", parent: root };
      expect(resolveMouseRegion(left, root)).toBe("left");
      expect(resolveMouseRegion(right, root)).toBe("right");
    });

    it("walks up from a sub-mesh to a named button", () => {
      const btn = { name: "Button_Left", parent: root };
      const innerMesh = { name: "Object_3", parent: btn };
      expect(resolveMouseRegion(innerMesh, root)).toBe("left");
    });

    it("treats any other mouse part as the body", () => {
      const body = { name: "Body", parent: root };
      const subMesh = { name: "Object_5", parent: body };
      const cable = { name: "Cable_Cap", parent: root };
      expect(resolveMouseRegion(body, root)).toBe("body");
      expect(resolveMouseRegion(subMesh, root)).toBe("body");
      expect(resolveMouseRegion(cable, root)).toBe("body");
    });

    it("returns null for the root itself or an outside object", () => {
      expect(resolveMouseRegion(root, root)).toBeNull();
      const outside: MouseSceneNode = { name: "Other", parent: null };
      expect(resolveMouseRegion(outside, root)).toBeNull();
    });
  });

  it("sanitises node names the way three does (underscore is a no-op)", () => {
    expect(runtimeMouseNodeName("Button_Left")).toBe("Button_Left");
  });
});
