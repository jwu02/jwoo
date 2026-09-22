import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import type { KnowledgeGraphData } from "@/lib/knowledge-graph/types";

// Focus is a camera movement, so these tests are about the transform the graph
// ends up wearing — which means the layout has to be held still and the
// viewport has to have a size. Both come from the auto-fit tests: mock
// d3.forceSimulation and drive the node positions by hand, and give the wrapper
// a real client box, because jsdom lays every element out at 0×0 and a
// degenerate viewport pins any framing to the minimum zoom.
jest.mock("d3", () => ({
  ...jest.requireActual("d3"),
  forceSimulation: jest.fn(),
}));

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

const WIDTH = 800;
const HEIGHT = 600;

// A chain A—B—C laid out along a diagonal, so every framing below has an
// extent to compute and a neighbour that must not be dragged in.
const POSITIONS = [
  { x: 0, y: 0 },
  { x: 200, y: 200 },
  { x: 400, y: 400 },
];

// Framing C means framing B with it: 200 units of content around (300,300),
// fitted at 2.4 and eased back by FOCUS_ZOOM_OUT.
const FOCUS_C = { k: 1.44, x: -32, y: -132 };

interface MockNode {
  label?: string;
  alpha?: number;
  tint?: number;
  scale?: { x: number; y: number };
  children?: MockNode[];
  emit?(event: string, data?: unknown): void;
}

interface MockApp {
  stage: MockNode;
}

function getPixiApp(container: HTMLElement): MockApp | undefined {
  const canvas = container.querySelector("canvas");
  return (canvas as unknown as { __pixiApp?: MockApp })?.__pixiApp;
}

function getContainers(container: HTMLElement) {
  const app = getPixiApp(container);
  const world = app?.stage.children?.[0];
  return { world, nodesContainer: world?.children?.[1] };
}

function nodeSpriteById(container: HTMLElement, id: string): MockNode | undefined {
  return getContainers(container).nodesContainer?.children?.find((s) => s.label === id);
}

function mockViewport(wrapper: HTMLElement) {
  Object.defineProperty(wrapper, "clientWidth", { value: WIDTH, configurable: true });
  Object.defineProperty(wrapper, "clientHeight", { value: HEIGHT, configurable: true });
}

// ctrl+wheel is d3-zoom's zoom gesture; this converts the scale a test wants
// into the delta that reaches it (see the drag tests).
const deltaForScale = (k: number) => -Math.log2(k) / 0.02;

function wheel(wrapper: HTMLElement, deltaY: number) {
  wrapper.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY,
      ctrlKey: true,
      clientX: WIDTH / 2,
      clientY: HEIGHT / 2,
    })
  );
}

function setPositions(positions = POSITIONS) {
  const simNodes = forceSimulationMock.mock.calls[0][0] as Array<{
    x?: number;
    y?: number;
  }>;
  simNodes.forEach((node, i) => {
    node.x = positions[i]?.x;
    node.y = positions[i]?.y;
  });
}

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
  return { ...rendered, wrapper };
}

const transformOf = (wrapper: HTMLElement) => d3.zoomTransform(wrapper);

const expectAt = (wrapper: HTMLElement, transform: { k: number; x: number; y: number }) => {
  const t = transformOf(wrapper);
  expect(t.k).toBeCloseTo(transform.k);
  expect(t.x).toBeCloseTo(transform.x);
  expect(t.y).toBeCloseTo(transform.y);
};

describe("ForceGraph focus", () => {
  it("flies the camera to frame the note with its neighbours", async () => {
    const { container, rerender, wrapper } = await renderGraph();
    setPositions();

    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" />);

    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });
    // A is two links from C, so a flight that framed the whole graph would end
    // somewhere else entirely.
    expect(getContainers(container).nodesContainer?.children?.length).toBe(3);
  });

  it("centers an isolated note at the eased-back scale", async () => {
    // C has no links, so there is no extent to fit: the camera rests at
    // natural scale over the note itself, eased back like every focus, rather
    // than zooming in on a point.
    const isolated = { nodes: NODES, edges: [{ source: "A.md", target: "B.md" }] };
    const { rerender, wrapper } = await renderGraph(isolated);
    setPositions();

    rerender(<ForceGraph graph={isolated} focusedNote="C.md" />);

    await waitFor(() => expectAt(wrapper, { k: 0.6, x: 160, y: 60 }), { timeout: 3000 });
  });

  it("keeps the focused note emphasized while the pointer is elsewhere", async () => {
    const { container, rerender } = await renderGraph();
    setPositions();
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
    setPositions();
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

// The camera has three claimants — the rough first-tick frame, the settled fit
// and the focus — and the focus is the visitor's own, so it outranks both. The
// simulation is driven by hand here precisely because the fits fire from its
// events: a focus that only survives a stopped simulation is not a focus.
describe("ForceGraph focus against the fits", () => {
  const sim = () => forceSimulationMock.mock.results[0].value as SimMock;

  it("holds off the first tick's rough frame while a note is focused", async () => {
    const { rerender, wrapper } = await renderGraph();
    setPositions();
    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" />);
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    act(() => {
      sim().handlers.tick();
    });

    // The rough frame is a snap, so a fit that ran would have landed already.
    expectAt(wrapper, FOCUS_C);
  });

  it("re-frames the focused note when the layout settles under it", async () => {
    const { rerender, wrapper } = await renderGraph();
    setPositions();
    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" />);
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    // The forces were still moving: the chain comes to rest somewhere else, so
    // the framing the flight was computed from now points at nothing — and a
    // whole-graph fit would take the camera off the note entirely.
    setPositions([
      { x: -2000, y: -2000 },
      { x: 1000, y: 1000 },
      { x: 1200, y: 1200 },
    ]);
    act(() => {
      sim().handlers.end();
    });

    // C with its neighbour B, framed where they now are.
    await waitFor(
      () => expectAt(wrapper, { k: 1.44, x: -1184, y: -1284 }),
      { timeout: 3000 }
    );
  });
});

describe("ForceGraph focus take-over", () => {
  it("cancels a flight in the air when the visitor moves the camera", async () => {
    const onFocusClear = jest.fn();
    const { container, rerender, wrapper } = await renderGraph();
    setPositions();

    rerender(
      <ForceGraph graph={GRAPH} focusedNote="C.md" onFocusClear={onFocusClear} />
    );
    // The flight has been asked for but has not drawn a frame: the visitor
    // grabs the camera first, and the tween must not fight them for it.
    act(() => {
      wheel(wrapper, deltaForScale(2));
    });

    expect(onFocusClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(transformOf(wrapper).k).toBeCloseTo(2));
    // The focus is over, so the graph is back to its resting emphasis.
    expect(nodeSpriteById(container, "A.md")!.alpha).toBe(1);
  });

  it("clears a settled focus when the visitor moves the camera", async () => {
    const onFocusClear = jest.fn();
    const { container, rerender, wrapper } = await renderGraph();
    setPositions();
    rerender(
      <ForceGraph graph={GRAPH} focusedNote="C.md" onFocusClear={onFocusClear} />
    );
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    act(() => {
      wheel(wrapper, deltaForScale(0.5));
    });

    expect(onFocusClear).toHaveBeenCalledTimes(1);
    expect(nodeSpriteById(container, "A.md")!.alpha).toBe(1);
  });

  // Dismissing a focus is not a reason to yank the camera back to wherever it
  // stood before the flight: the visitor is left looking at what they focused.
  it("leaves the camera where it is when the focus is dismissed", async () => {
    const { rerender, wrapper } = await renderGraph();
    setPositions();
    rerender(<ForceGraph graph={GRAPH} focusedNote="C.md" />);
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    rerender(<ForceGraph graph={GRAPH} focusedNote={null} />);

    await waitFor(() => expect(transformOf(wrapper).k).toBeCloseTo(FOCUS_C.k));
    expectAt(wrapper, FOCUS_C);
  });

  it("reports the note gone, without moving the camera, when a fresh graph drops it", async () => {
    const onFocusClear = jest.fn();
    const { rerender, wrapper } = await renderGraph();
    setPositions();
    rerender(
      <ForceGraph graph={GRAPH} focusedNote="C.md" onFocusClear={onFocusClear} />
    );
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    // A snapshot rotation that no longer holds the focused note: the focus
    // ends quietly, and the camera stays where the visitor had it.
    rerender(
      <ForceGraph
        graph={{ nodes: NODES.slice(0, 2), edges: EDGES.slice(0, 1) }}
        focusedNote="C.md"
        onFocusClear={onFocusClear}
      />
    );

    await waitFor(() => expect(onFocusClear).toHaveBeenCalledTimes(1));
    expectAt(wrapper, FOCUS_C);
  });
});
