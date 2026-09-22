import { createRef } from "react";
import { act, render, waitFor } from "@testing-library/react";
import {
  ForceGraph,
  type ForceGraphHandle,
} from "@/components/knowledge-graph/force-graph";
import type { KnowledgeGraphData } from "@/lib/knowledge-graph/types";

const NODES: KnowledgeGraphData["nodes"] = [
  { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
  { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
];

// A wants B, so A is a leaf and B a hub — which gives a hover a resting tint
// to come back to, distinct from the tint it wears while hovered.
const EDGES: KnowledgeGraphData["edges"] = [{ source: "A.md", target: "B.md" }];

const graph = { nodes: NODES, edges: EDGES };

async function renderForceGraph(
  data: KnowledgeGraphData = graph,
  onHoverChange?: (id: string | null) => void
) {
  const ref = createRef<ForceGraphHandle>();
  const rendered = render(
    <ForceGraph ref={ref} graph={data} onHoverChange={onHoverChange} />
  );
  await waitFor(() => {
    const { nodesContainer } = getContainers(rendered.container);
    expect(nodesContainer?.children?.length).toBe(data.nodes.length);
  });
  return { ...rendered, ref };
}

beforeEach(() => {
  document.documentElement.style.setProperty("--primary", "#ff0000");
  document.documentElement.style.setProperty("--claude-orange", "#ff8800");
  document.documentElement.style.setProperty("--foreground", "#000000");
  document.documentElement.style.setProperty("--background", "#ffffff");
});

interface MockNode {
  label?: string;
  visible?: boolean;
  alpha?: number;
  tint?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: { x: number; y: number };
  children?: MockNode[];
  emit?(event: string, data?: unknown): void;
  __circleRadius?: number;
}

interface MockApp {
  stage: MockNode;
  __textureSource?: MockNode;
}

function getPixiApp(container: HTMLElement): MockApp | undefined {
  const canvas = container.querySelector("canvas");
  return (canvas as unknown as { __pixiApp?: MockApp })?.__pixiApp;
}

function getContainers(container: HTMLElement) {
  const app = getPixiApp(container);
  const world = app?.stage.children?.[0];
  const linksContainer = world?.children?.[0];
  const nodesContainer = world?.children?.[1];
  return { app, world, linksContainer, nodesContainer };
}

function nodeSpriteById(container: HTMLElement, id: string): MockNode | undefined {
  const { nodesContainer } = getContainers(container);
  return nodesContainer?.children?.find((s) => s.label === id);
}

function linkSpriteBySource(container: HTMLElement, sourceId: string): MockNode | undefined {
  const { linksContainer } = getContainers(container);
  return linksContainer?.children?.find((s) => s.label?.startsWith(`${sourceId}->`));
}

describe("ForceGraph", () => {
  it("renders visible nodes and edges", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph graph={{ nodes, edges }} />
    );

    await waitFor(() => {
      const { nodesContainer, linksContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(2);
      expect(linksContainer?.children?.filter((s) => s.visible).length).toBe(1);
    });
  });

  it("rasterizes the node circle at a resolution that stays smooth when zoomed", async () => {
    // A is a degree-4 hub → radius 4 + √4 = 6. Zooming scales the world up to
    // 4× and hover grows a node by 1.3×, so the circle texture must carry at
    // least 6 × 4 × 1.3 = 31.2px of source detail per radius. A smaller raster
    // gets magnified past native resolution and its edge reads as pixelated.
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
      { id: "D.md", createdAt: "2024-01-04T00:00:00.000Z" },
      { id: "E.md", createdAt: "2024-01-05T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "A.md", target: "C.md" },
      { source: "A.md", target: "D.md" },
      { source: "A.md", target: "E.md" },
    ];

    const { container } = render(<ForceGraph graph={{ nodes, edges }} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(5);
    });

    const app = getPixiApp(container)!;
    const circleRadius = app.__textureSource?.__circleRadius;

    expect(circleRadius).toBeGreaterThanOrEqual(6 * 4 * 1.3);
  });

  it("renders all nodes and edges without a timeline", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-03T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-05T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(<ForceGraph graph={{ nodes, edges }} />);

    await waitFor(() => {
      const { nodesContainer, linksContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
      expect(linksContainer?.children?.filter((s) => s.visible).length).toBe(2);
    });
  });

  it("shows an HTML note label and highlights the hovered node + its links", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(
      <ForceGraph graph={{ nodes, edges }} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });

    const nodeA = nodeSpriteById(container, "A.md")!;

    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });

    await waitFor(() => {
      expect(container.querySelector("[data-testid='kg-node-label']")).toBeTruthy();
    });

    // The tooltip shows the node id, matching the labels drawn when zoomed in —
    // an id is the note's own title, so no transformation is involved.
    expect(container.querySelector("[data-testid='kg-node-label']")?.textContent).toBe("A.md");

    const linkAB = linkSpriteBySource(container, "A.md")!;
    const linkBC = linkSpriteBySource(container, "B.md")!;
    expect(linkAB.alpha).toBe(1);
    expect(linkBC.alpha).toBe(0.08);

    const nodeB = nodeSpriteById(container, "B.md")!;
    const nodeC = nodeSpriteById(container, "C.md")!;
    expect(nodeB.alpha).toBe(1);
    expect(nodeC.alpha).toBe(0.15);
    expect(nodeA.scale!.x).toBeGreaterThan(nodeB.scale!.x);
  });

  it("positions the hover label at the node immediately when it mounts", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(<ForceGraph graph={{ nodes, edges }} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(2);
    });

    const nodeA = nodeSpriteById(container, "A.md")!;

    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });

    const labelEl = container.querySelector<HTMLElement>("[data-testid='kg-node-label']")!;
    expect(labelEl).toBeTruthy();
    // The label must be positioned when it mounts, not left at the wrapper's
    // top-left until some later simulation tick / drag repositions it.
    expect(labelEl.style.transform).not.toBe("");
    expect(labelEl.style.transform).toContain("translate3d");
  });

  it("dims leaf nodes as edge nodes but leaves hubs and isolated nodes bright", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
      { id: "D.md", createdAt: "2024-01-04T00:00:00.000Z" },
      { id: "E.md", createdAt: "2024-01-05T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
      { source: "B.md", target: "D.md" },
    ];

    const { container } = render(
      <ForceGraph graph={{ nodes, edges }} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(5);
    });

    const leafA = nodeSpriteById(container, "A.md")!;
    const leafC = nodeSpriteById(container, "C.md")!;
    const leafD = nodeSpriteById(container, "D.md")!;
    const hubB = nodeSpriteById(container, "B.md")!;
    const isolatedE = nodeSpriteById(container, "E.md")!;

    expect(leafA.tint).not.toBe(hubB.tint);
    expect(leafC.tint).not.toBe(hubB.tint);
    expect(leafD.tint).not.toBe(hubB.tint);
    expect(isolatedE.tint).toBe(hubB.tint);
  });

  it("tints a reciprocal-only node as a leaf despite degree 2", async () => {
    // A.md <-> B.md is a reciprocal pair: A has one unique neighbor (B) but
    // degree 2. It must be tinted like a true leaf (C), not like a hub (B).
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "A.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(<ForceGraph graph={{ nodes, edges }} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });

    const reciprocalLeafA = nodeSpriteById(container, "A.md")!;
    const hubB = nodeSpriteById(container, "B.md")!;
    const trueLeafC = nodeSpriteById(container, "C.md")!;

    expect(reciprocalLeafA.tint).not.toBe(hubB.tint);
    expect(reciprocalLeafA.tint).toBe(trueLeafC.tint);
  });

  it("tints leaf nodes with a color distinct from hubs and edges", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(<ForceGraph graph={{ nodes, edges }} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });

    const leafA = nodeSpriteById(container, "A.md")!;
    const leafC = nodeSpriteById(container, "C.md")!;
    const hubB = nodeSpriteById(container, "B.md")!;
    const edgeAB = linkSpriteBySource(container, "A.md")!;

    // Leaf nodes share one tint, distinct from both hubs and edge lines.
    expect(leafA.tint).toBe(leafC.tint);
    expect(leafA.tint).not.toBe(hubB.tint);
    expect(leafA.tint).not.toBe(edgeAB.tint);
  });

  it("clears the highlight and hides the label on mouseout", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph graph={{ nodes, edges }} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(2);
    });

    const nodeA = nodeSpriteById(container, "A.md")!;
    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });

    await waitFor(() => {
      expect(container.querySelector("[data-testid='kg-node-label']")).toBeTruthy();
    });

    act(() => {
      nodeA.emit!("pointerout", { stopPropagation: () => {} });
    });

    await waitFor(() => {
      const labelEl = container.querySelector("[data-testid='kg-node-label']");
      expect(labelEl).toBeTruthy();
      expect(labelEl).toHaveClass("opacity-0");
      expect(nodeA.alpha).toBe(1);
    });
  });

  it("tears down without throwing when the app is destroyed before the world", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container, unmount } = render(
      <ForceGraph graph={{ nodes, edges }} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.length).toBe(2);
    });

    // Navigating away unmounts the component. usePixiApp's cleanup destroys the
    // Application (nulling app.stage) before the build effect's teardownWorld
    // runs, which used to dereference the nulled stage and throw.
    expect(() => unmount()).not.toThrow();
  });

  // The drag test lives in force-graph-drag.test.tsx: it needs the zoom
  // transform held at the identity, which means driving the simulation by hand
  // rather than letting the real one fit the view mid-assertion.
});

// A chain — A—B—C — so a hover has all three emphases to show at once: the
// hovered end, the neighbour in the middle, and the far end it dims.
const CHAIN_NODES: KnowledgeGraphData["nodes"] = [
  { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
  { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
];
const CHAIN_EDGES: KnowledgeGraphData["edges"] = [
  { source: "A.md", target: "B.md" },
  { source: "B.md", target: "C.md" },
];
const chain = { nodes: CHAIN_NODES, edges: CHAIN_EDGES };

describe("ForceGraph hover driven from outside", () => {
  it("paints the same emphasis as pointing at the node itself", async () => {
    const { container, ref } = await renderForceGraph(chain);

    act(() => {
      ref.current!.setHoveredNote("A.md");
    });

    await waitFor(() => {
      const nodeA = nodeSpriteById(container, "A.md")!;
      const nodeB = nodeSpriteById(container, "B.md")!;
      // A is hovered: tinted and scaled up. B is its neighbour, kept at full
      // strength. C is neither, so it fades back.
      expect(nodeA.alpha).toBe(1);
      expect(nodeB.alpha).toBe(1);
      expect(nodeSpriteById(container, "C.md")!.alpha).toBe(0.15);
      expect(nodeA.scale!.x).toBeGreaterThan(nodeB.scale!.x);
    });

    // The incident link lights; B's other link — to the note nobody hovered —
    // is not incident, and fades back instead.
    expect(linkSpriteBySource(container, "A.md")!.alpha).toBe(1);
    expect(linkSpriteBySource(container, "B.md")!.alpha).toBe(0.08);

    // The tooltip names the hovered note, exactly as a pointer hover does.
    expect(
      container.querySelector("[data-testid='kg-node-label']")?.textContent
    ).toBe("A.md");
  });

  it("rests every node again when the hover is cleared", async () => {
    const { container, ref } = await renderForceGraph(chain);
    const nodeA = nodeSpriteById(container, "A.md")!;
    const restingScale = nodeA.scale!.x;
    const restingTint = nodeA.tint;

    act(() => {
      ref.current!.setHoveredNote("A.md");
    });
    expect(nodeA.tint).not.toBe(restingTint);

    act(() => {
      ref.current!.setHoveredNote(null);
    });

    expect(nodeA.tint).toBe(restingTint);
    expect(nodeA.scale!.x).toBeCloseTo(restingScale);
    expect(nodeSpriteById(container, "C.md")!.alpha).toBe(1);
    expect(linkSpriteBySource(container, "B.md")!.alpha).toBe(0.15);
    expect(
      container.querySelector("[data-testid='kg-node-label']")
    ).toHaveClass("opacity-0");
  });

  // Either source may drive a hover; both are the same hover, so both take the
  // one exit — the pointer-out that follows a node hover has to clear a hover
  // the list itself set.
  it("clears a hover the list set when the pointer leaves a node", async () => {
    const { container, ref } = await renderForceGraph(chain);

    act(() => {
      ref.current!.setHoveredNote("C.md");
    });
    const nodeA = nodeSpriteById(container, "A.md")!;
    act(() => {
      nodeA.emit!("pointerout", { stopPropagation: () => {} });
    });

    expect(nodeSpriteById(container, "C.md")!.alpha).toBe(1);
  });
});

// Every world build clears the hover, which is itself a report — so each test
// below drops what the mount said and asserts on what the interaction said.
describe("ForceGraph hover reports", () => {
  it("reports the note a pointer hover lands on, then the clear", async () => {
    const reports: (string | null)[] = [];
    const { container } = await renderForceGraph(graph, (id) =>
      reports.push(id)
    );
    reports.length = 0;

    const nodeA = nodeSpriteById(container, "A.md")!;
    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });
    act(() => {
      nodeA.emit!("pointerout", { stopPropagation: () => {} });
    });

    expect(reports).toEqual(["A.md", null]);
  });

  // The renderer is the one place hover lives, so a hover it sets itself is a
  // hover the list is owed a report of too.
  it("reports a hover driven through the setter", async () => {
    const reports: (string | null)[] = [];
    const { ref } = await renderForceGraph(graph, (id) => reports.push(id));
    reports.length = 0;

    act(() => {
      ref.current!.setHoveredNote("B.md");
    });

    expect(reports).toEqual(["B.md"]);
  });

  // A fresh snapshot replaces every sprite, so a hover held across the swap
  // would be a hover pointing at nodes that no longer exist.
  it("drops the hover, and says so, when the graph is rebuilt", async () => {
    const reports: (string | null)[] = [];
    const onHoverChange = (id: string | null) => reports.push(id);
    const { ref, rerender, container } = await renderForceGraph(
      graph,
      onHoverChange
    );

    const nodeA = nodeSpriteById(container, "A.md")!;
    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });
    reports.length = 0;

    // A new snapshot, not a new wrapper around the same arrays: the memo
    // compares the props shallowly, so the arrays are what have to differ for
    // a rebuild to happen at all.
    rerender(
      <ForceGraph
        ref={ref}
        graph={{ nodes: [...NODES], edges: [...EDGES] }}
        onHoverChange={onHoverChange}
      />
    );
    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.length).toBe(3);
    });

    expect(reports).toEqual([null]);
  });
});
