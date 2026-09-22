import {
  buildGraph,
  computeDegrees,
  computeFitTransform,
  computeFocusTransform,
  computeNeighbors,
  computeNodeTextureRadius,
  computeRoughInitialTransform,
  FIT_ANIMATION_MS,
  graphPointFromClient,
  LABEL_ZOOM_THRESHOLD,
  nodeRadius,
  NODE_MAX_ZOOM,
  NODE_MIN_ZOOM,
  planFit,
  type FitTrigger,
} from "@/lib/knowledge-graph/graph-data";
import type { NoteDoc } from "@/lib/knowledge-graph/types";

describe("buildGraph", () => {
  it("builds nodes and edges, dropping links to missing notes", () => {
    const docs: NoteDoc[] = [
      { filename: "A.md", createdAt: new Date("2024-01-02"), links: ["B.md", "Missing.md"] },
      { filename: "B.md", createdAt: new Date("2024-01-01"), links: ["A.md"] },
    ];

    const { nodes, edges } = buildGraph(docs);

    expect(nodes).toEqual([
      { id: "B.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "A.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
    expect(edges).toEqual([
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "A.md" },
    ]);
  });
});

describe("computeDegrees", () => {
  it("counts incoming and outgoing edges", () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-01T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "A.md" },
    ];

    expect(computeDegrees(nodes, edges)).toEqual(
      new Map([
        ["A.md", 2],
        ["B.md", 2],
      ])
    );
  });
});

describe("computeNeighbors", () => {
  const nodes = [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "C.md", createdAt: "2024-01-01T00:00:00.000Z" },
  ];

  it("reads an edge as a relationship both of its ends have", () => {
    const neighbors = computeNeighbors(nodes, [
      { source: "A.md", target: "B.md" },
    ]);

    expect([...neighbors.get("A.md")!]).toEqual(["B.md"]);
    expect([...neighbors.get("B.md")!]).toEqual(["A.md"]);
  });

  // The same node twice is one neighbour, which is what keeps a reciprocal
  // pair's two nodes from reading as two hops apart in either rule.
  it("counts a reciprocal pair once", () => {
    const neighbors = computeNeighbors(nodes, [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "A.md" },
    ]);

    expect([...neighbors.get("A.md")!]).toEqual(["B.md"]);
    expect(neighbors.get("A.md")!.size).toBe(1);
  });

  it("gives every node a set of its own, isolated ones included", () => {
    const neighbors = computeNeighbors(nodes, [
      { source: "A.md", target: "B.md" },
    ]);

    expect(neighbors.get("C.md")!.size).toBe(0);
  });
});

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
    // A and B span 200×200 around (100,100) → 680/200 vs 480/200 → 2.4.
    expect(
      computeFocusTransform("A.md", chain, chainEdges, width, height, padding)
    ).toEqual({ k: 2.4, x: 160, y: 60 });
  });

  it("stops at the note's own neighbours", () => {
    // A line, so including A — two links from C — would visibly widen the
    // frame: 400 units of content at 1.2 rather than 200 at 2.4.
    const line = [at("A.md", 0, 0), at("B.md", 200, 200), at("C.md", 400, 400)];
    const lineEdges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    // C is framed with B, and only with B.
    expect(
      computeFocusTransform("C.md", line, lineEdges, width, height, padding)
    ).toEqual({ k: 2.4, x: -320, y: -420 });
  });

  it("frames an isolated note at natural scale, centered on it", () => {
    const nodes = [at("A.md", 100, 100), at("B.md", 5000, 5000)];

    expect(computeFocusTransform("A.md", nodes, [], width, height, padding)).toEqual({
      k: 1,
      x: 300,
      y: 200,
    });
  });

  it("holds a tight neighbourhood at the maximum zoom", () => {
    const nodes = [at("A.md", 0, 0), at("B.md", 10, 10)];
    const edges = [{ source: "A.md", target: "B.md" }];

    expect(
      computeFocusTransform("A.md", nodes, edges, width, height, padding)
    ).toEqual({ k: 4, x: 380, y: 280 });
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
    ).toEqual({ k: 2.4, x: 160, y: 60 });
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

describe("computeRoughInitialTransform", () => {
  const width = 800;
  const height = 600;

  it("centers the seeded centroid and leaves generous margin", () => {
    // Spread occupies 0.3 × 600 = 180px of the smaller dimension:
    // 180 / (2 · √(300²+300²)) ≈ 0.2121.
    const nodes = [
      { x: -300, y: -300 },
      { x: 300, y: 300 },
    ];

    const t = computeRoughInitialTransform(nodes, width, height);
    expect(t.k).toBeCloseTo(0.2121, 3);
    expect(t.x).toBe(400);
    expect(t.y).toBe(300);
  });

  it("translates to an off-center centroid", () => {
    const nodes = [
      { x: 100, y: 100 },
      { x: 500, y: 500 },
    ];

    // Centroid (300,300), maxRadius √(200²+200²) ≈ 282.84 → k ≈ 0.3182.
    const t = computeRoughInitialTransform(nodes, width, height);
    expect(t.k).toBeCloseTo(0.3182, 3);
    expect(t.x).toBeCloseTo(400 - t.k * 300, 3);
    expect(t.y).toBeCloseTo(300 - t.k * 300, 3);
  });

  it("clamps tiny graphs to natural scale", () => {
    const nodes = [
      { x: -5, y: -5 },
      { x: 5, y: 5 },
    ];

    expect(computeRoughInitialTransform(nodes, width, height)).toEqual({
      k: 1,
      x: 400,
      y: 300,
    });
  });

  it("clamps enormous graphs to the minimum zoom", () => {
    const nodes = [
      { x: -500_000, y: -500_000 },
      { x: 500_000, y: 500_000 },
    ];

    expect(computeRoughInitialTransform(nodes, width, height)).toEqual({
      k: 0.1,
      x: 400,
      y: 300,
    });
  });

  it("centers a lone node at natural scale", () => {
    expect(computeRoughInitialTransform([{ x: 100, y: 100 }], width, height)).toEqual({
      k: 1,
      x: 300,
      y: 200,
    });
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

describe("planFit", () => {
  const width = 800;
  const height = 600;
  const nodes = [
    { x: -300, y: -300 },
    { x: 300, y: 300 },
  ];

  const context = (userInteracted = false, focused = false) => ({
    userInteracted,
    focused,
    nodes,
    viewportWidth: width,
    viewportHeight: height,
  });

  it("snaps to the rough framing on the first tick", () => {
    // The forces are about to move the nodes, so the first frame is the seeded
    // centroid rather than an extent that does not exist yet.
    expect(planFit("first-tick", context())).toEqual({
      mode: "snap",
      transform: computeRoughInitialTransform(nodes, width, height),
    });
  });

  it("animates the precise fit once the layout settles", () => {
    expect(planFit("settled", context())).toEqual({
      mode: "animate",
      transform: computeFitTransform(nodes, width, height),
      durationMs: FIT_ANIMATION_MS,
    });
  });

  it("plans nothing once the viewer has taken over the view", () => {
    // Neither fit may move a graph the viewer has zoomed or panned themselves.
    expect(planFit("first-tick", context(true))).toBeNull();
    expect(planFit("settled", context(true))).toBeNull();
  });

  // A focus is the visitor's claim on the camera too, and a stronger one than
  // the fit's: it is a note they picked out, so a fit that framed the whole
  // graph would take the camera off the thing they asked to see. The renderer
  // re-frames the focus itself once the layout settles under it.
  it("plans nothing while a note holds the focus", () => {
    expect(planFit("first-tick", context(false, true))).toBeNull();
    expect(planFit("settled", context(false, true))).toBeNull();
  });

  it("gives the settled fit a duration a transition can actually run", () => {
    // A zero-length transition is not a snap: d3 defers it by a frame, so a
    // duration of 0 would visibly stall the fit rather than skip it.
    const plan = planFit("settled", context());
    expect(plan?.mode).toBe("animate");
    expect(plan?.mode === "animate" ? plan.durationMs : 0).toBeGreaterThan(0);
  });

  it("answers each trigger from its own framing, not from the other's", () => {
    // The triggers differ in what they frame, not only in how it moves: the
    // seeded circle and the resting layout are different sizes.
    const first = planFit("first-tick", context());
    const settled = planFit("settled", context());

    expect(first?.transform).not.toEqual(settled?.transform);
    expect(settled?.transform).toEqual(
      computeFitTransform(nodes, width, height)
    );
  });

  it("returns no transform for a graph with nothing positioned yet", () => {
    // The transforms themselves already answer an empty graph at natural scale,
    // and the plan must pass that through rather than inventing a fit.
    const trigger: FitTrigger = "settled";
    const empty = { ...context(), nodes: [] };

    expect(planFit(trigger, empty)).toEqual({
      mode: "animate",
      transform: { k: 1, x: 0, y: 0 },
      durationMs: FIT_ANIMATION_MS,
    });
  });
});

describe("LABEL_ZOOM_THRESHOLD", () => {
  it("sits inside the zoom range so both label modes stay reachable", () => {
    // A threshold at or above the max zoom would mean the all-labels mode can
    // never trigger — the graph would silently never show them. At or below the
    // min zoom it is the reverse: labels on for every possible view, and the
    // hover-only mode unreachable. Every value used so far (1, 1.5, 2) is
    // deliberately allowed; the point is that the threshold has to be a scale
    // the gesture can actually land on, not that it clears natural scale.
    expect(LABEL_ZOOM_THRESHOLD).toBeGreaterThan(NODE_MIN_ZOOM);
    expect(LABEL_ZOOM_THRESHOLD).toBeLessThan(NODE_MAX_ZOOM);
  });
});

describe("nodeRadius", () => {
  it("scales the base radius up by the square root of the degree", () => {
    expect(nodeRadius(0)).toBe(4);
    expect(nodeRadius(9)).toBe(7); // 4 + √9
    expect(nodeRadius(16)).toBe(8); // 4 + √16
  });

  it("grows sub-linearly with degree", () => {
    expect(nodeRadius(100)).toBeGreaterThan(nodeRadius(50));
    expect(nodeRadius(100) - nodeRadius(50)).toBeLessThan(50);
  });
});

describe("computeNodeTextureRadius", () => {
  const node = (id: string) => ({ id, createdAt: "2024-01-01T00:00:00.000Z" });

  it("floors the texture size at the base radius for an all-isolated graph", () => {
    const nodes = [node("A.md"), node("B.md")];
    const degrees = new Map([
      ["A.md", 0],
      ["B.md", 0],
    ]);

    // Worst-case on-screen radius = 4 × max zoom (4) × hover growth (1.3).
    expect(computeNodeTextureRadius(nodes, degrees)).toBe(Math.ceil(4 * 4 * 1.3));
  });

  it("rasterizes enough detail for the largest node at max zoom + hover", () => {
    const nodes = [
      node("A.md"),
      node("B.md"),
      node("C.md"),
      node("D.md"),
      node("E.md"),
    ];
    const degrees = new Map([
      ["A.md", 4],
      ["B.md", 1],
      ["C.md", 1],
      ["D.md", 1],
      ["E.md", 1],
    ]);

    // Largest node: 4 + √4 = 6. × 4 × 1.3 = 31.2 → 32.
    expect(computeNodeTextureRadius(nodes, degrees)).toBe(32);
  });

  it("never lets a node outgrow its texture under max zoom and hover", () => {
    // A hub-heavy graph where the biggest node's radius is the binding factor.
    const nodes = Array.from({ length: 26 }, (_, i) =>
      node(`${String.fromCharCode(65 + i)}.md`)
    );
    const degrees = new Map(nodes.map((n, i) => [n.id, i === 0 ? 25 : 1]));

    const radius = computeNodeTextureRadius(nodes, degrees);

    // Largest node radius = 4 + √25 = 9. Even at max zoom × hover it must not
    // exceed the rasterized texture's native detail, or edges go pixelated.
    expect(radius).toBeGreaterThanOrEqual(9 * 4 * 1.3);
  });
});
