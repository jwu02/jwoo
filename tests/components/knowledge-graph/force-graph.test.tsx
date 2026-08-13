import { fireEvent, render, waitFor } from "@testing-library/react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

/** d3 binds the joined datum onto each element as `__data__`. */
function datumOf<T>(el: Element): T {
  return (el as unknown as { __data__: T }).__data__;
}

describe("ForceGraph", () => {
  it("renders visible nodes and edges", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(2);
      expect(container.querySelectorAll("line").length).toBe(1);
    });
  });

  it("does not render nodes created after current time", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges: { source: string; target: string }[] = [];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(1);
    });
  });

  it("shows an HTML filename label and highlights the hovered node + its links", async () => {
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
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-04")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(3);
    });

    const circles = Array.from(container.querySelectorAll("circle"));
    const nodeA = circles.find((c) => datumOf<{ id: string }>(c).id === "A.md")!;
    const nodeB = circles.find((c) => datumOf<{ id: string }>(c).id === "B.md")!;
    const nodeC = circles.find((c) => datumOf<{ id: string }>(c).id === "C.md")!;

    fireEvent.mouseOver(nodeA);

    await waitFor(() => {
      expect(nodeA.classList.contains("kg-node--hovered")).toBe(true);
    });

    // The filename appears immediately as an HTML element, not a native tooltip.
    const label = container.querySelector("[data-testid='kg-node-label']");
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe("A.md");
    expect(container.querySelectorAll("title").length).toBe(0);

    // The hovered node's incident edge is highlighted; other edges dim.
    const links = Array.from(container.querySelectorAll("line"));
    const linkAB = links.find(
      (l) =>
        datumOf<{ source: { id: string }; target: { id: string } }>(l).source.id === "A.md"
    )!;
    const linkBC = links.find(
      (l) =>
        datumOf<{ source: { id: string }; target: { id: string } }>(l).source.id === "B.md"
    )!;
    expect(linkAB.classList.contains("kg-link--hovered")).toBe(true);
    expect(linkBC.classList.contains("kg-link--dimmed")).toBe(true);

    // A node connected to the hovered node stays undimmed; unrelated nodes dim.
    expect(nodeB.classList.contains("kg-node--dimmed")).toBe(false);
    expect(nodeC.classList.contains("kg-node--dimmed")).toBe(true);
  });

  it("dims leaf nodes as edge nodes but leaves hubs and isolated nodes bright", async () => {
    // Star-ish graph: B is the hub, A/C/D are leaves, E is isolated.
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
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-06")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(5);
    });

    const circles = Array.from(container.querySelectorAll("circle"));
    const classListFor = (id: string) =>
      circles.find((c) => datumOf<{ id: string }>(c).id === id)!.classList;

    // Leaf nodes (degree 1) are edge nodes → dimmed.
    expect(classListFor("A.md").contains("kg-node--edge")).toBe(true);
    expect(classListFor("C.md").contains("kg-node--edge")).toBe(true);
    expect(classListFor("D.md").contains("kg-node--edge")).toBe(true);
    // A hub (degree 3) is not an edge node → full colour.
    expect(classListFor("B.md").contains("kg-node--edge")).toBe(false);
    // A node with no connections is not an edge node → full colour.
    expect(classListFor("E.md").contains("kg-node--edge")).toBe(false);
  });

  it("clears the highlight and hides the label on mouseout", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(2);
    });

    const nodeA = Array.from(container.querySelectorAll("circle")).find(
      (c) => datumOf<{ id: string }>(c).id === "A.md"
    )!;

    fireEvent.mouseOver(nodeA);
    await waitFor(() => {
      expect(container.querySelector("[data-testid='kg-node-label']")).toBeTruthy();
    });

    fireEvent.mouseOut(nodeA);

    await waitFor(() => {
      expect(container.querySelector("[data-testid='kg-node-label']")).toBeNull();
      expect(nodeA.classList.contains("kg-node--hovered")).toBe(false);
      expect(nodeA.classList.contains("kg-node--dimmed")).toBe(false);
    });
  });

  it("moves the dragged node and its incident links immediately during a drag", async () => {
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
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-04")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(3);
    });

    const circles = Array.from(container.querySelectorAll("circle"));
    const nodeB = circles.find((c) => datumOf<{ id: string }>(c).id === "B.md")!;
    const nodeC = circles.find((c) => datumOf<{ id: string }>(c).id === "C.md")!;
    const lines = Array.from(container.querySelectorAll("line"));
    const linkAB = lines.find(
      (l) =>
        datumOf<{ source: { id: string }; target: { id: string } }>(l).source.id === "A.md"
    )!;
    const linkBC = lines.find(
      (l) =>
        datumOf<{ source: { id: string }; target: { id: string } }>(l).source.id === "B.md"
    )!;

    // Wait for the simulation to have laid out the nodes so we can read the
    // pre-drag positions.
    await waitFor(() => {
      expect(nodeB.getAttribute("cx")).not.toBeNull();
    });

    const startX = Number(nodeB.getAttribute("cx"));
    const startY = Number(nodeB.getAttribute("cy"));
    const startCx = nodeC.getAttribute("cx");

    // Drive a d3 drag: mousedown on the node, then mousemove/up on the window.
    // All three fire synchronously, so no simulation tick runs in between and
    // the grabbed node's displacement equals the pointer delta exactly.
    const dx = 150;
    const dy = 40;
    // `view: window` is required for d3-drag: it does `nodrag(event.view)` on
    // mousedown and stops the event from bubbling into the svg's zoom handler.
    fireEvent.mouseDown(nodeB, {
      button: 0,
      clientX: 100,
      clientY: 100,
      view: window,
    });
    fireEvent.mouseMove(window, {
      clientX: 100 + dx,
      clientY: 100 + dy,
      view: window,
    });
    fireEvent.mouseUp(window, {
      clientX: 100 + dx,
      clientY: 100 + dy,
      view: window,
    });

    // The grabbed node tracks the pointer by the drag delta, synchronously.
    expect(nodeB.getAttribute("cx")).toBe(String(startX + dx));
    expect(nodeB.getAttribute("cy")).toBe(String(startY + dy));

    // Its incident links follow: A->B moves its B endpoint, B->C moves its B end.
    expect(linkAB.getAttribute("x2")).toBe(String(startX + dx));
    expect(linkAB.getAttribute("y2")).toBe(String(startY + dy));
    expect(linkBC.getAttribute("x1")).toBe(String(startX + dx));
    expect(linkBC.getAttribute("y1")).toBe(String(startY + dy));

    // A node not grabbed isn't moved synchronously by the drag event itself.
    expect(nodeC.getAttribute("cx")).toBe(startCx);
  });
});
