import { act, render } from "@testing-library/react";
import { forceSimulation } from "d3-force";
import { zoomTransform } from "d3-zoom";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import { computeFitTransform } from "@/lib/knowledge-graph/framing";
import {
  createSimulationMock,
  mockViewport,
  setCssVars,
  setPositions,
  waitForReady,
  type SimMock,
} from "./harness";

// What the renderer owes the camera on load: the layout is run to rest before
// anything is drawn, and the frame it is drawn in is a fit of that resting
// layout — the last camera move the graph makes of its own accord. Where the
// framing comes from is the camera's own test; this is the renderer driving it,
// and the rule that nothing reframes afterwards.
jest.mock("d3-force", () => ({
  ...jest.requireActual("d3-force"),
  forceSimulation: jest.fn(),
}));

const forceSimulationMock = forceSimulation as unknown as jest.Mock;

beforeEach(() => {
  setCssVars();
  forceSimulationMock.mockReset();
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

// A chain laid out along a diagonal, so the fit has an extent to frame rather
// than the degenerate case. Where a node sits is the layout's business, not the
// graph's — the real simulation seeds and moves it — and the renderer clones the
// graph it is handed into the layout it holds, so seeding here is saying where
// the layout has settled.
const POSITIONS = [
  { x: 0, y: 0 },
  { x: 200, y: 200 },
  { x: 400, y: 400 },
];
const GRAPH = {
  nodes: NODES.map((node, i) => ({ ...node, ...POSITIONS[i] })),
  edges: EDGES,
};

async function renderGraph(onReady?: () => void) {
  const rendered = render(<ForceGraph graph={GRAPH} onReady={onReady} />);
  const wrapper = rendered.container.querySelector(
    "[data-testid='kg-graph-wrapper']"
  ) as HTMLElement;
  mockViewport(wrapper);
  return { ...rendered, wrapper };
}

describe("ForceGraph initial fit", () => {
  it("frames the resting layout as it is first drawn", async () => {
    const onReady = jest.fn();
    const { container, wrapper } = await renderGraph(onReady);

    await waitForReady(container);

    const fitted = computeFitTransform(POSITIONS, wrapper.clientWidth, wrapper.clientHeight);
    const t = zoomTransform(wrapper);
    expect(t.k).toBeCloseTo(fitted.k);
    expect(t.x).toBeCloseTo(fitted.x);
    expect(t.y).toBeCloseTo(fitted.y);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("is the last framing the graph makes of its own accord", async () => {
    const { container, wrapper } = await renderGraph();

    await waitForReady(container);
    const fitted = { ...zoomTransform(wrapper) };

    const sim = forceSimulationMock.mock.results[0].value as SimMock;
    // Nothing hangs off the simulation's end any more: the run is over before
    // the layout is drawn, so there is no later resting layout to reframe for.
    expect(sim.on).not.toHaveBeenCalledWith("end", expect.anything());

    // A drag reheats the layout and the nodes move under a camera the viewer is
    // holding. The graph moving is not the camera moving.
    setPositions(
      forceSimulationMock,
      POSITIONS.map((p) => ({ x: p.x + 500, y: p.y + 500 }))
    );
    act(() => sim.handlers.tick?.());

    const t = zoomTransform(wrapper);
    expect(t.k).toBeCloseTo(fitted.k);
    expect(t.x).toBeCloseTo(fitted.x);
    expect(t.y).toBeCloseTo(fitted.y);
  });
});
