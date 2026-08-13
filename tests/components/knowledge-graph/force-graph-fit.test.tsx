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

function renderGraph() {
  const rendered = render(<ForceGraph nodes={NODES} edges={EDGES} />);
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
});
