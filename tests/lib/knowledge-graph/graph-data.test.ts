import {
  buildGraph,
  computeDegrees,
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
