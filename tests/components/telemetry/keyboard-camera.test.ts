import {
  fitTopDown,
  type Bounds3,
} from "@/components/telemetry/keyboard-camera";

// The keyboard.glb bounds (world units), from the loaded scene.
const KEYBOARD_BOUNDS: Bounds3 = {
  min: { x: -0.141, y: 0.0032, z: -0.094 },
  max: { x: 0.137, y: 0.0034, z: 0.022 },
};

describe("fitTopDown", () => {
  it("centres and lifts the camera straight above the keyboard", () => {
    const frame = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 2.5,
    });
    expect(frame.target.x).toBeCloseTo(-0.002, 4);
    expect(frame.target.z).toBeCloseTo(-0.036, 4);
    // Camera directly above the centre, looking straight down.
    expect(frame.cameraPos.x).toBeCloseTo(frame.target.x, 6);
    expect(frame.cameraPos.z).toBeCloseTo(frame.target.z, 6);
    expect(frame.cameraPos.y).toBeGreaterThan(frame.target.y);
  });

  it("sets screen-up to world −Z so the function row sits at the top", () => {
    const frame = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 2.2,
    });
    expect(frame.up).toEqual({ x: 0, y: 0, z: -1 });
  });

  it("honours a custom screen-up axis (mouse: world +Z at the top)", () => {
    const frame = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 2.2,
      up: { x: 0, y: 0, z: 1 },
    });
    expect(frame.up).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("wide viewbox (aspect 2.5): depth binds → distance ≈ 0.183", () => {
    const frame = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 2.5,
      margin: 1,
    });
    // d = max(halfW/(tan(fov/2)*aspect), halfD/tan(fov/2)).
    expect(frame.cameraPos.y - frame.target.y).toBeCloseTo(0.159, 3);
  });

  it("square viewbox (aspect 1): width binds → distance ≈ 0.439", () => {
    const frame = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 1,
      margin: 1,
    });
    expect(frame.cameraPos.y - frame.target.y).toBeCloseTo(0.3819, 3);
  });

  it("applies the margin as headroom", () => {
    const tight = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 1,
      margin: 1,
    });
    const roomy = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 1,
      margin: 1.15,
    });
    const tightD = tight.cameraPos.y - tight.target.y;
    const roomyD = roomy.cameraPos.y - roomy.target.y;
    expect(roomyD).toBeCloseTo(tightD * 1.15, 6);
  });

  it("guards degenerate inputs with a distance of 1", () => {
    const frame = fitTopDown({
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      fovDeg: 40,
      aspect: 2,
    });
    expect(frame.cameraPos.y - frame.target.y).toBe(1);

    const badFov = fitTopDown({ bounds: KEYBOARD_BOUNDS, fovDeg: 0, aspect: 2 });
    expect(badFov.cameraPos.y - badFov.target.y).toBe(1);

    const badAspect = fitTopDown({
      bounds: KEYBOARD_BOUNDS,
      fovDeg: 40,
      aspect: 0,
    });
    expect(badAspect.cameraPos.y - badAspect.target.y).toBe(1);
  });
});
