import {
  computeFitTransform,
  computeFocusTransform,
  computeReanchorTransform,
  graphPointFromClient,
  isDragGesture,
  PRESS_SLOP_PX,
} from "@/lib/knowledge-graph/framing";

describe("computeFitTransform", () => {
  const width = 800;
  const height = 600;
  const padding = 60;

  it("scales a large graph down to fit the viewport and centers it", () => {
    const nodes = [
      { x: -1000, y: -1000 },
      { x: 1000, y: 1000 },
    ];

    // 2000x2000 content into 680x480 of usable space → 0.24 scale, centered.
    expect(computeFitTransform(nodes, width, height, padding)).toEqual({
      k: 0.24,
      x: 400,
      y: 300,
    });
  });

  it("centers a non-origin bounding box", () => {
    const nodes = [
      { x: 200, y: 300 },
      { x: 400, y: 500 },
    ];

    // 200x200 content centered on (300,400) → 2.4 scale.
    expect(computeFitTransform(nodes, width, height, padding)).toEqual({
      k: 2.4,
      x: -320,
      y: -660,
    });
  });

  it("clamps the scale to the zoom scaleExtent", () => {
    const tiny = [
      { x: -5, y: -5 },
      { x: 5, y: 5 },
    ];
    const enormous = [
      { x: -500_000, y: -500_000 },
      { x: 500_000, y: 500_000 },
    ];

    expect(computeFitTransform(tiny, width, height, padding).k).toBe(4);
    expect(computeFitTransform(enormous, width, height, padding).k).toBe(0.1);
  });

  it("keeps a single-node graph at natural scale rather than zooming in", () => {
    const nodes = [{ x: 100, y: 100 }];

    expect(computeFitTransform(nodes, width, height, padding)).toEqual({
      k: 1,
      x: 300,
      y: 200,
    });
  });

  it("ignores nodes that have not been positioned yet", () => {
    const nodes = [{ x: 0, y: 0 }, {}];

    // Only the positioned node contributes → degenerate → natural scale.
    expect(computeFitTransform(nodes, width, height, padding)).toEqual({
      k: 1,
      x: 400,
      y: 300,
    });
  });
});

describe("computeFocusTransform", () => {
  const width = 800;
  const height = 600;
  const padding = 60;
  const at = (id: string, x: number, y: number) => ({ id, x, y });

  // The graph below is a chain whose far end is thousands of units away, so a
  // framing that included it would be visibly wider than the note's own
  // neighbourhood — the difference between focusing and fitting.
  const chain = [at("A.md", 0, 0), at("B.md", 200, 200), at("C.md", 5000, 5000)];
  const chainEdges = [
    { source: "A.md", target: "B.md" },
    { source: "B.md", target: "C.md" },
  ];

  it("frames the note together with its neighbours, not the whole graph", () => {
    // A and B span 200×200 around (100,100) → 680/200 vs 480/200 → 2.4 fitted,
    // eased back by FOCUS_ZOOM_OUT → 1.44.
    expect(
      computeFocusTransform("A.md", chain, chainEdges, width, height, padding)
    ).toEqual({ k: 1.44, x: 256, y: 156 });
  });

  it("stops at the note's own neighbours", () => {
    // A line, so including A — two links from C — would visibly widen the
    // frame: 400 units of content rather than 200.
    const line = [at("A.md", 0, 0), at("B.md", 200, 200), at("C.md", 400, 400)];
    const lineEdges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    // C is framed with B, and only with B.
    expect(
      computeFocusTransform("C.md", line, lineEdges, width, height, padding)
    ).toEqual({ k: 1.44, x: -32, y: -132 });
  });

  it("centers an isolated note at the eased-back scale", () => {
    const nodes = [at("A.md", 100, 100), at("B.md", 5000, 5000)];

    // No extent to frame, so the fit rests at natural scale — and the focus
    // eases back from it like every other.
    expect(computeFocusTransform("A.md", nodes, [], width, height, padding)).toEqual({
      k: 0.6,
      x: 340,
      y: 240,
    });
  });

  it("eases a tight neighbourhood back from the maximum zoom", () => {
    const nodes = [at("A.md", 0, 0), at("B.md", 10, 10)];
    const edges = [{ source: "A.md", target: "B.md" }];

    // The fit itself clamps to 4; the focus then sits 40% back from it rather
    // than filling the viewport with two nodes.
    expect(
      computeFocusTransform("A.md", nodes, edges, width, height, padding)
    ).toEqual({ k: 2.4, x: 388, y: 288 });
  });

  it("clamps a far-flung neighbourhood to the minimum zoom", () => {
    const nodes = [at("A.md", 0, 0), at("B.md", 500_000, 500_000)];
    const edges = [{ source: "A.md", target: "B.md" }];

    expect(
      computeFocusTransform("A.md", nodes, edges, width, height, padding)
    ).toEqual({ k: 0.1, x: -24600, y: -24700 });
  });

  it("ignores a neighbour the layout has not placed yet", () => {
    const nodes = [at("A.md", 0, 0), at("B.md", 200, 200), { id: "C.md" }];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "A.md", target: "C.md" },
    ];

    expect(
      computeFocusTransform("A.md", nodes, edges, width, height, padding)
    ).toEqual({ k: 1.44, x: 256, y: 156 });
  });

  it("has no transform for a note the graph does not hold", () => {
    expect(
      computeFocusTransform("Z.md", chain, chainEdges, width, height, padding)
    ).toBeNull();
  });

  it("has no transform for a note the layout has not placed yet", () => {
    const nodes = [{ id: "A.md" }, at("B.md", 200, 200)];

    expect(
      computeFocusTransform("A.md", nodes, [], width, height, padding)
    ).toBeNull();
  });
});

describe("computeReanchorTransform", () => {
  const transform = { k: 2, x: -400, y: -300 };

  // Where a graph point is drawn, in the viewport's own pixels. What a
  // re-anchor is for is that one point keeps landing in the middle.
  const screenOf = (
    t: { k: number; x: number; y: number },
    point: { x: number; y: number }
  ) => ({ x: point.x * t.k + t.x, y: point.y * t.k + t.y });

  it("draws the graph point that was at the centre at the centre of the new viewport", () => {
    // The point under the middle of the 512-wide viewport: (256 - -400) / 2.
    const centre = { x: 328, y: 300 };
    expect(screenOf(transform, centre)).toEqual({ x: 256, y: 300 });

    const after = computeReanchorTransform(transform, 512, 800);

    // The same point, in a viewport whose middle is now 400.
    expect(screenOf(after, centre)).toEqual({ x: 400, y: 300 });
  });

  it("holds the zoom the viewer is at", () => {
    expect(computeReanchorTransform(transform, 512, 800).k).toBe(2);
  });

  it("moves the camera by half the width it gained", () => {
    expect(computeReanchorTransform(transform, 512, 800)).toEqual({
      k: 2,
      x: -256,
      y: -300,
    });
  });

  it("moves it back the other way when the viewport narrows", () => {
    expect(computeReanchorTransform(transform, 800, 512)).toEqual({
      k: 2,
      x: -544,
      y: -300,
    });
  });

  it("leaves a viewport that did not change alone", () => {
    expect(computeReanchorTransform(transform, 800, 800)).toEqual(transform);
  });
});

describe("graphPointFromClient", () => {
  // The wrapper's own offset on the page, which the pointer has to be measured
  // against before the transform is considered.
  const rect = { left: 100, top: 50 };

  it("returns the client offset at the identity transform", () => {
    expect(graphPointFromClient(300, 250, rect, { x: 0, y: 0, k: 1 })).toEqual({
      x: 200,
      y: 200,
    });
  });

  it("divides out the zoom scale", () => {
    // At k = 2 a screen pixel is half a graph unit, so the same pointer is
    // twice as deep into the graph.
    expect(graphPointFromClient(300, 250, rect, { x: 0, y: 0, k: 2 })).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("takes the pan off before the scale, not after", () => {
    // The pan is a screen-space distance and the scale is a ratio, so the order
    // is not interchangeable: dividing first would give (160/2 - 40) = 40 here
    // instead of 80.
    expect(graphPointFromClient(300, 250, rect, { x: 40, y: -10, k: 2 })).toEqual({
      x: 80,
      y: 105,
    });
  });

  it("round-trips a graph point back to the client point it came from", () => {
    // The property a drag depends on: whatever this returns must be the point
    // that, drawn through the same transform, sits under the pointer.
    const transform = { x: -400, y: -300, k: 2 };
    const graph = graphPointFromClient(300, 250, rect, transform);

    expect(graph.x * transform.k + transform.x + rect.left).toBeCloseTo(300, 5);
    expect(graph.y * transform.k + transform.y + rect.top).toBeCloseTo(250, 5);
  });
});

describe("isDragGesture", () => {
  // The points are graph coordinates, the slop is a screen distance, and k is
  // what connects them — so the same drift is a different gesture depending on
  // how far the graph is zoomed.
  const atZoom = (k: number) => ({ k });
  const press = { x: 100, y: 100 };

  it("is not a drag until the pointer moves past the slop", () => {
    expect(isDragGesture(press, { x: 100, y: 100 }, atZoom(1))).toBe(false);
    expect(isDragGesture(press, { x: 103, y: 100 }, atZoom(1))).toBe(false);
    // Exactly at the slop is still a click: the boundary is crossed, not met.
    expect(isDragGesture(press, { x: 104, y: 100 }, atZoom(1))).toBe(false);
    expect(isDragGesture(press, { x: 105, y: 100 }, atZoom(1))).toBe(true);
  });

  it("measures the drift diagonally, not along either axis", () => {
    // 3 and 4 is 5: a predicate reading either axis alone would call this a
    // click at a 4px slop.
    expect(isDragGesture(press, { x: 103, y: 104 }, atZoom(1))).toBe(true);
  });

  it("reads the drift in screen pixels at a zoomed-in transform", () => {
    // At k = 2 a graph unit is two screen pixels, so half the drift is enough.
    expect(isDragGesture(press, { x: 102, y: 100 }, atZoom(2))).toBe(false);
    expect(isDragGesture(press, { x: 103, y: 100 }, atZoom(2))).toBe(true);
  });

  it("allows twice the drift at a zoomed-out transform", () => {
    // At k = 0.5 a screen pixel is two graph units.
    expect(isDragGesture(press, { x: 108, y: 100 }, atZoom(0.5))).toBe(false);
    expect(isDragGesture(press, { x: 110, y: 100 }, atZoom(0.5))).toBe(true);
  });

  it("takes its slop from the constant by default", () => {
    expect(isDragGesture(press, { x: 100 + PRESS_SLOP_PX, y: 100 }, atZoom(1))).toBe(false);
    expect(isDragGesture(press, { x: 100 + PRESS_SLOP_PX + 1, y: 100 }, atZoom(1))).toBe(true);
  });
});
