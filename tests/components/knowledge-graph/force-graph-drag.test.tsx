import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import {
  createSimulationMock,
  deltaForScale,
  getContainers,
  linkSpriteBySource,
  mockViewport,
  nodeSpriteById,
  setCssVars,
  setPositions,
  waitForReady,
  wheel,
} from "./harness";

// Dragging is asserted in graph coordinates, which the handler derives from
// screen coordinates through the transform it captured at pointerdown. Two
// tests cover the cases that matter: the identity transform, where the two
// differ only by the wrapper's offset, and a zoomed one, where the scale and
// the pan both have to be undone. The mapping itself is unit-tested in lib;
// these check that the component feeds it the live transform.
//
// The graph is fitted once, as its layout is first drawn, so the transform the
// drag is judged against is the fit's — and it is fixed the moment the graph is
// drawn, which is what waitForReady waits for. Nothing moves the camera after
// that: the layout the fit framed is already at rest, and a drag does not fit.
//
// In these tests the fit is the identity, because no node has a position yet
// when it is made. The zoomed test wants a transform that is not the identity,
// so it takes a real gesture instead — which fixes the transform by construction
// too, and marks the view as the viewer's.
jest.mock("d3", () => ({
  ...jest.requireActual("d3"),
  forceSimulation: jest.fn(),
}));

const forceSimulationMock = d3.forceSimulation as unknown as jest.Mock;

beforeEach(() => {
  setCssVars();
  forceSimulationMock.mockReset();
  // Not yet cool, so the drag does not ask the simulation to reheat — the
  // heating branch belongs to the simulation, which is not running here.
  forceSimulationMock.mockImplementation(() => createSimulationMock());
});

const NODES = [
  { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
  { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
];
const EDGES = [
  { source: "A.md", target: "B.md" },
  { source: "B.md", target: "C.md" },
];

// One graph object, the way the page hands it over: its identity is what the
// component's memo compares, so the tests pass it the same way the page does.
const GRAPH = { nodes: NODES, edges: EDGES };

describe("ForceGraph drag", () => {
  it("moves the dragged node and its incident links immediately during a drag", async () => {
    const { container } = render(<ForceGraph graph={GRAPH} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });
    await waitForReady(container);
    // No tick runs, so the incident links are drawn from the positions the
    // nodes carry here rather than from the sprites the tick loop would place.
    setPositions(forceSimulationMock, [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]);

    const nodeB = nodeSpriteById(container, "B.md")!;
    const linkAB = linkSpriteBySource(container, "A.md")!;
    const linkBC = linkSpriteBySource(container, "B.md")!;

    const startX = 100;
    const startY = 100;
    const dx = 150;
    const dy = 40;

    act(() => {
      nodeB.emit!("pointerdown", {
        client: { x: startX, y: startY },
        button: 0,
      });
    });

    const moveEvent = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: startX + dx,
      clientY: startY + dy,
    });
    document.dispatchEvent(moveEvent);

    expect(nodeB.x).toBe(startX + dx);
    expect(nodeB.y).toBe(startY + dy);
    expect(linkAB.width).toBeGreaterThan(0);
    expect(linkBC.width).toBeGreaterThan(0);
  });

  // The test above is the identity case, where screen and graph coordinates
  // differ only by the wrapper's offset. This is the one where the arithmetic
  // is non-trivial: with the world scaled and panned, an implementation that
  // ignored the scale, or that divided before taking the pan off, would still
  // pass there and fail here.
  it("maps the pointer through the live zoom transform while dragging", async () => {
    const { container } = render(<ForceGraph graph={GRAPH} />);
    const wrapper = container.querySelector(
      "[data-testid='kg-graph-wrapper']"
    ) as HTMLElement;
    mockViewport(wrapper);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });

    // A real gesture, so the transform is genuinely non-identity: zooming about
    // the centre leaves k at 2 and a pan of half the viewport behind it.
    act(() => {
      wheel(wrapper, deltaForScale(2));
    });
    const t = d3.zoomTransform(wrapper);
    expect(t.k).toBeCloseTo(2);

    const nodeB = nodeSpriteById(container, "B.md")!;
    const startX = 100;
    const startY = 100;
    const moveX = 250;
    const moveY = 140;

    act(() => {
      nodeB.emit!("pointerdown", {
        client: { x: startX, y: startY },
        button: 0,
      });
    });

    document.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: moveX,
        clientY: moveY,
      })
    );

    // The node lands under the pointer: drawn back through the same transform,
    // its position is the pointer's own screen point. That round trip is the
    // property a drag has to satisfy at any zoom, and it is not satisfiable by
    // treating screen offsets as graph offsets.
    expect(nodeB.x! * t.k + t.x).toBeCloseTo(moveX, 5);
    expect(nodeB.y! * t.k + t.y).toBeCloseTo(moveY, 5);
  });
});
