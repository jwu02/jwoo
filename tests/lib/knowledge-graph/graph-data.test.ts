import {
  buildGraph,
  computeDegrees,
  computeNeighbors,
  computeNodeTextureRadius,
  LABEL_ZOOM_THRESHOLD,
  nodeRadius,
} from "@/lib/knowledge-graph/graph-data";
import { NODE_MAX_ZOOM, NODE_MIN_ZOOM } from "@/lib/knowledge-graph/framing";
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
