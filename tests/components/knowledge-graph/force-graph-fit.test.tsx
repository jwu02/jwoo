import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

// The real force simulation's settle timing (~300 ticks) is too slow and
// non-deterministic to assert against in jsdom, so drive it by hand: mock only
// d3.forceSimulation and keep the real zoom/select/zoomIdentity the component
// relies on.
jest.mock("d3", () => {
  const actual = jest.requireActual("d3");
  return {
    ...actual,
    forceSimulation: jest.fn(),
  };
});

const forceSimulationMock = d3.forceSimulation as unknown as jest.Mock;

interface SimMock {
  force: jest.Mock;
  on: jest.Mock;
  stop: jest.Mock;
  alphaTarget: jest.Mock;
  restart: jest.Mock;
  handlers: Record<string, () => void>;
}

function createSimulationMock(): SimMock {
  const handlers: Record<string, () => void> = {};
  const sim = {
    force: jest.fn(),
    on: jest.fn(),
    stop: jest.fn(),
    alphaTarget: jest.fn(),
    restart: jest.fn(),
    handlers,
  };
  sim.force.mockImplementation(() => sim);
  sim.alphaTarget.mockImplementation(() => sim);
  sim.restart.mockImplementation(() => sim);
  sim.on.mockImplementation((event: string, cb: () => void) => {
    handlers[event] = cb;
    return sim;
  });
  return sim;
}

beforeEach(() => {
  document.documentElement.style.setProperty("--primary", "#ff0000");
  document.documentElement.style.setProperty("--claude-orange", "#ff8800");
  document.documentElement.style.setProperty("--foreground", "#000000");
  document.documentElement.style.setProperty("--background", "#ffffff");
  forceSimulationMock.mockReset();
  forceSimulationMock.mockImplementation(createSimulationMock);
});

const NODES = [
  { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
  { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
];
const EDGES = [{ source: "A.md", target: "B.md" }];

// One graph object, the way the page hands it over: its identity is what the
// component's memo compares, so the tests pass it the same way the page does.
const GRAPH = { nodes: NODES, edges: EDGES };

function renderGraph() {
  const rendered = render(<ForceGraph graph={GRAPH} />);
  return {
    wrapper: rendered.container.querySelector(
      "[data-testid='kg-graph-wrapper']"
    ) as Element,
  };
}

async function getSimulation() {
  return waitFor(() => {
    expect(forceSimulationMock).toHaveBeenCalled();
    return forceSimulationMock.mock.results[0].value as SimMock;
  });
}

// jsdom lays every element out at 0×0, so a test that needs a viewport with a
// shape to speak of gives the wrapper one.
function mockViewport(element: Element, width: number, height: number) {
  Object.defineProperty(element, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: height, configurable: true });
}

function setPositions(nodes: Array<{ x?: number; y?: number }>) {
  const simNodes = forceSimulationMock.mock.calls[0][0] as Array<{
    x?: number;
    y?: number;
  }>;
  simNodes.forEach((node, i) => {
    node.x = nodes[i]?.x;
    node.y = nodes[i]?.y;
  });
}

describe("ForceGraph auto-fit", () => {
  it("snaps to a rough initial frame on the first tick", async () => {
    const { wrapper } = renderGraph();
    const sim = await getSimulation();
    await waitFor(() => expect(sim.handlers.tick).toBeDefined());

    // d3 seeds every node with a position at construction, so the first tick
    // already has a full set of coordinates to frame.
    setPositions([
      { x: 100, y: 100 },
      { x: 500, y: 500 },
    ]);

    act(() => {
      sim.handlers.tick();
    });

    // The rough frame must be applied immediately — a snap, not an animation.
    // jsdom reports a 0×0 viewport, so the rough transform clamps to the
    // minimum zoom (0.1) and centers the seeded centroid (300,300) at the
    // viewport origin → x = y = -0.1 * 300 = -30.
    const t = d3.zoomTransform(wrapper);
    expect(t.k).toBeCloseTo(0.1);
    expect(t.x).toBeCloseTo(-30);
    expect(t.y).toBeCloseTo(-30);
  });

  it("animates the precise fit to the resting layout once the simulation stops", async () => {
    const { wrapper } = renderGraph();
    const sim = await getSimulation();
    await waitFor(() => expect(sim.handlers.end).toBeDefined());

    // The first tick snaps a rough frame…
    setPositions([
      { x: 100, y: 100 },
      { x: 500, y: 500 },
    ]);
    act(() => {
      sim.handlers.tick();
    });

    // …but the forces then rest the nodes somewhere else. Firing "end" must
    // re-fit to the final positions, not stay on the rough first-tick frame.
    setPositions([
      { x: 100, y: 100 },
      { x: 300, y: 300 },
    ]);
    act(() => {
      sim.handlers.end();
    });

    // Final bbox {100..300, 100..300}, center (200,200) → x = y = -0.1 * 200 = -20.
    await waitFor(
      () => {
        const t = d3.zoomTransform(wrapper);
        expect(t.k).toBeCloseTo(0.1);
        expect(t.x).toBeCloseTo(-20);
        expect(t.y).toBeCloseTo(-20);
      },
      { timeout: 3000 }
    );
  });

  // The layout takes its time to settle, and the note list can be collapsed
  // while it does: the graph is a panel wider by the time the fit lands. It is
  // the framing of the viewport the graph is in by then — a fit computed
  // against the box the graph was built in would frame the whole graph
  // off-centre, undoing the compensation that had held the viewer's centre.
  it("frames the viewport the graph is in now, not the one it was built in", async () => {
    const { wrapper } = renderGraph();
    const sim = await getSimulation();
    await waitFor(() => expect(sim.handlers.end).toBeDefined());

    setPositions([
      { x: 100, y: 100 },
      { x: 300, y: 300 },
    ]);
    // The viewport the collapsed panel leaves: a panel's width wider than the
    // 0×0 jsdom gave the build.
    mockViewport(wrapper, 1088, 600);

    act(() => {
      sim.handlers.end();
    });

    // 200×200 of content into 1088×600 less the fit's padding on each side →
    // 2.4, centered on (200,200): x = 544 - 480, y = 300 - 480.
    await waitFor(
      () => {
        const t = d3.zoomTransform(wrapper);
        expect(t.k).toBeCloseTo(2.4);
        expect(t.x).toBeCloseTo(64);
        expect(t.y).toBeCloseTo(-180);
      },
      { timeout: 3000 }
    );
  });
});
