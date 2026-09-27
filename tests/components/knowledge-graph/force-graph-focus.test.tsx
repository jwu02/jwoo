import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import type { KnowledgeGraphData } from "@/lib/knowledge-graph/types";
import { GRAPH_ANIMATION_MS } from "@/lib/knowledge-graph/framing";
import {
  createSimulationMock,
  deltaForScale,
  getContainers,
  mockViewport,
  nodeSpriteById,
  setCssVars,
  setPositions,
  waitForReady,
  wheel,
} from "./harness";

// What the Focus leaves to the renderer: the emphasis it draws, and the reports
// it owes the page. Where the camera ends up — the flight, the fits it outranks,
// the settle that re-frames it — is the camera's own test (tests/lib/…/camera).
//
// The layout still has to be held still, so the simulation is mocked and driven
// by hand, and the wrapper is given a real viewport: jsdom lays everything out
// at 0×0, and a degenerate viewport pins every framing to the minimum zoom.
jest.mock("d3", () => ({
  ...jest.requireActual("d3"),
  forceSimulation: jest.fn(),
}));

const forceSimulationMock = d3.forceSimulation as unknown as jest.Mock;

beforeEach(() => {
  setCssVars();
  forceSimulationMock.mockReset();
  forceSimulationMock.mockImplementation(() => createSimulationMock());
});

const NODES: KnowledgeGraphData["nodes"] = [
  { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
  { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
];
const EDGES: KnowledgeGraphData["edges"] = [
  { source: "A.md", target: "B.md" },
  { source: "B.md", target: "C.md" },
];
const GRAPH = { nodes: NODES, edges: EDGES };

// A chain A—B—C laid out along a diagonal: C's neighbourhood is B, and A is the
// node no focus on C should reach.
const POSITIONS = [
  { x: 0, y: 0 },
  { x: 200, y: 200 },
  { x: 400, y: 400 },
];

async function renderGraph(data: KnowledgeGraphData = GRAPH) {
  const rendered = render(<ForceGraph graph={data} />);
  const wrapper = rendered.container.querySelector(
    "[data-testid='kg-graph-wrapper']"
  ) as HTMLElement;
  mockViewport(wrapper);
  await waitFor(() => {
    expect(getContainers(rendered.container).nodesContainer?.children?.length).toBe(
      data.nodes.length
    );
  });
  // The fit the graph makes of itself lands before anything is drawn, so a
  // focus taken below is the only camera move the test has to know about.
  await waitForReady(rendered.container);
  return { ...rendered, wrapper };
}

// A focus flight is a camera move this file no longer asserts on, so where it
// lands is the camera test's business. What is left here needs only to know it
// has arrived, which is what its duration is.
const flightLands = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, GRAPH_ANIMATION_MS + 100));
  });

describe("ForceGraph focus emphasis", () => {
  it("keeps the focused note emphasized while the pointer is elsewhere", async () => {
    const { container, rerender } = await renderGraph();
    setPositions(forceSimulationMock, POSITIONS);
    const resting = nodeSpriteById(container, "C.md")!.scale!.x;
    const restingTint = nodeSpriteById(container, "C.md")!.tint;

    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" />);

    await waitFor(() => {
      const nodeC = nodeSpriteById(container, "C.md")!;
      expect(nodeC.scale!.x).toBeGreaterThan(resting);
      expect(nodeC.tint).not.toBe(restingTint);
      // B is the focused note's neighbour, so it stays at full strength; A is
      // neither, and fades back exactly as it would under a pointer hover.
      expect(nodeSpriteById(container, "B.md")!.alpha).toBe(1);
      expect(nodeSpriteById(container, "A.md")!.alpha).toBe(0.15);
    });
  });

  // The emphasis a focus holds is the pointer's emphasis, borrowed: pointing at
  // another node takes it, and leaving that node gives it back.
  it("lends the emphasis to the pointer, and takes it back when the pointer leaves", async () => {
    const { container, rerender } = await renderGraph();
    setPositions(forceSimulationMock, POSITIONS);
    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" />);
    const focusedScale = await waitFor(() => nodeSpriteById(container, "C.md")!.scale!.x);

    act(() => {
      nodeSpriteById(container, "A.md")!.emit!("pointerover", { stopPropagation: () => {} });
    });

    expect(nodeSpriteById(container, "A.md")!.scale!.x).toBeGreaterThan(0);
    expect(nodeSpriteById(container, "C.md")!.alpha).toBe(0.15);

    act(() => {
      nodeSpriteById(container, "A.md")!.emit!("pointerout", { stopPropagation: () => {} });
    });

    expect(nodeSpriteById(container, "C.md")!.alpha).toBe(1);
    expect(nodeSpriteById(container, "C.md")!.scale!.x).toBeCloseTo(focusedScale);
    expect(nodeSpriteById(container, "A.md")!.alpha).toBe(0.15);
  });
});

// The Focus is the visitor's claim on the graph, and the page owns it: the
// renderer's share is to say when that claim is over, so the page can drop the
// note it is holding.
describe("ForceGraph focus reports", () => {
  it("reports a focus the visitor's own camera has taken, before it lands", async () => {
    const onFocusClear = jest.fn();
    const { container, rerender, wrapper } = await renderGraph();
    setPositions(forceSimulationMock, POSITIONS);

    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" onFocusClear={onFocusClear} />);
    // The flight has been asked for but has not drawn a frame: the visitor
    // grabs the camera first.
    act(() => {
      wheel(wrapper, deltaForScale(2));
    });

    expect(onFocusClear).toHaveBeenCalledTimes(1);
    // The focus is over, so the graph is back to its resting emphasis.
    expect(nodeSpriteById(container, "A.md")!.alpha).toBe(1);
  });

  it("reports a focus the visitor's own camera has taken, once it has landed", async () => {
    const onFocusClear = jest.fn();
    const { container, rerender, wrapper } = await renderGraph();
    setPositions(forceSimulationMock, POSITIONS);
    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" onFocusClear={onFocusClear} />);
    await flightLands();

    act(() => {
      wheel(wrapper, deltaForScale(0.5));
    });

    expect(onFocusClear).toHaveBeenCalledTimes(1);
    expect(nodeSpriteById(container, "A.md")!.alpha).toBe(1);
  });

  it("reports the note gone when a fresh graph drops it", async () => {
    const onFocusClear = jest.fn();
    const { rerender } = await renderGraph();
    setPositions(forceSimulationMock, POSITIONS);
    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" onFocusClear={onFocusClear} />);
    await flightLands();

    // A snapshot rotation that no longer holds the focused note: the focus ends
    // quietly, and the camera stays where the visitor had it.
    rerender(
      <ForceGraph
        graph={{ nodes: NODES.slice(0, 2), edges: EDGES.slice(0, 1) }}
        focusedNote="C.md"
        onFocusClear={onFocusClear}
      />
    );

    await waitFor(() => expect(onFocusClear).toHaveBeenCalledTimes(1));
  });
});
