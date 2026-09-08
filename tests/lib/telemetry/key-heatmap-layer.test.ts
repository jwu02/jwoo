import {
  DEFAULT_MAX_ALPHA,
  heatAlpha,
  hexRgba,
  mapNodeToUv,
  uvToCanvas,
} from "@/lib/telemetry/key-heatmap-layer";

const footprint = { minX: 0, maxX: 100, minZ: 0, maxZ: 50 };

describe("mapNodeToUv", () => {
  it("maps the footprint centre to the middle of the texture", () => {
    expect(mapNodeToUv(50, 25, footprint)).toEqual({ u: 0.5, v: 0.5 });
  });

  it("maps the back-left corner (top-of-screen) to u=0, v=1", () => {
    // The function row (back of the keyboard, world -Z) is the TOP of the
    // screen, which is the texture's top edge (v=1).
    expect(mapNodeToUv(footprint.minX, footprint.minZ, footprint)).toEqual({
      u: 0,
      v: 1,
    });
  });

  it("maps the front-right corner (bottom-of-screen) to u=1, v=0", () => {
    expect(mapNodeToUv(footprint.maxX, footprint.maxZ, footprint)).toEqual({
      u: 1,
      v: 0,
    });
  });

  it("clamps out-of-range points inside the footprint", () => {
    expect(mapNodeToUv(-10, 200, footprint)).toEqual({ u: 0, v: 0 });
    expect(mapNodeToUv(500, -20, footprint)).toEqual({ u: 1, v: 1 });
  });
});

describe("uvToCanvas", () => {
  it("maps the texture-top (v=1, the keyboard back) to the canvas's top row", () => {
    // A key at the back of the keyboard (world −Z, screen top) must be drawn at
    // the canvas y=0 row, because the overlay texture is sampled with flipY.
    expect(uvToCanvas(0.5, 1, 100, 200)).toEqual({ x: 50, y: 0 });
  });

  it("maps the texture-bottom (v=0, the keyboard front) to the canvas's bottom row", () => {
    expect(uvToCanvas(0.5, 0, 100, 200)).toEqual({ x: 50, y: 200 });
  });

  it("maps u left→right across the canvas width", () => {
    expect(uvToCanvas(0, 0.5, 100, 200)).toEqual({ x: 0, y: 100 });
    expect(uvToCanvas(1, 0.5, 100, 200)).toEqual({ x: 100, y: 100 });
  });

  it("clamps uv outside [0, 1]", () => {
    expect(uvToCanvas(-1, 2, 100, 200)).toEqual({ x: 0, y: 0 });
    expect(uvToCanvas(2, -1, 100, 200)).toEqual({ x: 100, y: 200 });
  });
});

describe("hexRgba", () => {
  it("turns a #rrggbb hex into an rgba string", () => {
    expect(hexRgba("#d8662a", 0.5)).toBe("rgba(216,102,42,0.5)");
  });

  it("expands shorthand #rgb", () => {
    expect(hexRgba("#f00", 1)).toBe("rgba(255,0,0,1)");
  });

  it("clamps alpha to [0, 1]", () => {
    expect(hexRgba("#d8662a", 2)).toBe("rgba(216,102,42,1)");
    expect(hexRgba("#d8662a", -1)).toBe("rgba(216,102,42,0)");
  });
});

describe("heatAlpha", () => {
  it("is fully transparent at intensity 0", () => {
    expect(heatAlpha(0)).toBe(0);
  });

  it("is fully opaque-ish at intensity 1", () => {
    expect(heatAlpha(1)).toBe(DEFAULT_MAX_ALPHA);
  });

  it("scales linearly in between", () => {
    expect(heatAlpha(0.5)).toBeCloseTo(DEFAULT_MAX_ALPHA / 2);
  });

  it("clamps intensities outside [0, 1]", () => {
    expect(heatAlpha(-1)).toBe(0);
    expect(heatAlpha(2)).toBe(DEFAULT_MAX_ALPHA);
  });
});
