import {
  buildGraph,
  computeDegrees,
  computeFitTransform,
  computeRoughInitialTransform,
  getVisibleEdges,
  getVisibleNodes,
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

describe("visibility", () => {
  const nodes = [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
  ];
  const edges = [
    { source: "A.md", target: "B.md" },
    { source: "B.md", target: "C.md" },
  ];

  it("returns nodes created at or before current time", () => {
    const time = new Date("2024-01-02").getTime();
    expect(getVisibleNodes(nodes, time)).toEqual([
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
  });

  it("returns only edges whose source and target are both visible", () => {
    const time = new Date("2024-01-02").getTime();
    expect(getVisibleEdges(edges, getVisibleNodes(nodes, time))).toEqual([
      { source: "A.md", target: "B.md" },
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
