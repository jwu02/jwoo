import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { createRef } from "react";
import {
  ForceGraph,
  type ForceGraphHandle,
} from "@/components/knowledge-graph/force-graph";
import type { KnowledgeGraphData } from "@/lib/knowledge-graph/types";

// A re-anchor is a camera movement, so these tests are about the transform the
// graph ends up wearing — which means the layout has to be held still and the
// viewport has to have a size. Both come from the other renderer tests: mock
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
const GRAPH = {
  nodes: NODES,
  edges: [
    { source: "A.md", target: "B.md" },
    { source: "B.md", target: "C.md" },
  ],
};

const WIDTH = 800;
const HEIGHT = 600;
// The note panel's own width, which is what the graph's viewport gains when it
// is collapsed and loses when it opens.
const PANEL = 288;

interface MockNode {
  label?: string;
  children?: MockNode[];
}

interface MockApp {
  stage: MockNode;
  __size: { width: number; height: number } | null;
}

function getPixiApp(container: HTMLElement): MockApp | undefined {
  const canvas = container.querySelector("canvas");
  return (canvas as unknown as { __pixiApp?: MockApp })?.__pixiApp;
}

function mockViewport(wrapper: HTMLElement, width = WIDTH, height = HEIGHT) {
  Object.defineProperty(wrapper, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(wrapper, "clientHeight", { value: height, configurable: true });
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

function setPositions() {
  const simNodes = forceSimulationMock.mock.calls[0][0] as Array<{
    x?: number;
    y?: number;
  }>;
  simNodes.forEach((node, i) => {
    node.x = [0, 200, 400][i];
    node.y = [0, 200, 400][i];
  });
}

async function renderGraph() {
  const ref = createRef<ForceGraphHandle>();
  const rendered = render(<ForceGraph ref={ref} graph={GRAPH} />);
  const wrapper = rendered.container.querySelector(
    "[data-testid='kg-graph-wrapper']"
  ) as HTMLElement;
  mockViewport(wrapper);
  await waitFor(() => {
    expect(getPixiApp(rendered.container)?.stage.children?.[0]).toBeTruthy();
  });
  return { ...rendered, wrapper, ref };
}

const transformOf = (wrapper: HTMLElement) => d3.zoomTransform(wrapper);

const expectAt = (
  wrapper: HTMLElement,
  transform: { k: number; x: number; y: number }
) => {
  const t = transformOf(wrapper);
  expect(t.k).toBeCloseTo(transform.k);
  expect(t.x).toBeCloseTo(transform.x);
  expect(t.y).toBeCloseTo(transform.y);
};

// The camera the viewer left the graph in: a zoom of their own, so the
// re-anchor is asserted against a transform no framing would have chosen.
function zoomIn(wrapper: HTMLElement) {
  act(() => {
    wheel(wrapper, deltaForScale(2));
  });
  return transformOf(wrapper);
}

describe("ForceGraph re-anchor on a layout change", () => {
  it("puts the point at the centre of the viewport back at the centre", async () => {
    const { ref, wrapper } = await renderGraph();
    setPositions();
    const before = zoomIn(wrapper);

    // The note panel collapses: the graph's viewport grows by the panel's
    // width, so its centre moves half that to the right — and the graph with
    // it, or the viewer's own framing would be pulled off to one side.
    mockViewport(wrapper, WIDTH + PANEL);
    act(() => {
      ref.current!.reanchorViewport();
    });

    await waitFor(
      () => expectAt(wrapper, { k: before.k, x: before.x + PANEL / 2, y: before.y }),
      { timeout: 3000 }
    );
  });

  it("eases into it rather than snapping", async () => {
    const { ref, wrapper } = await renderGraph();
    setPositions();
    const before = zoomIn(wrapper);

    mockViewport(wrapper, WIDTH + PANEL);
    act(() => {
      ref.current!.reanchorViewport();
    });

    // The camera is where the viewer left it as the move begins...
    expectAt(wrapper, before);
    // ...and arrives once it has been given the time to travel.
    await waitFor(() => expectAt(wrapper, { k: before.k, x: before.x + PANEL / 2, y: before.y }), {
      timeout: 3000,
    });
  });

  it("grows the surface it draws into with the viewport", async () => {
    const { container, ref, wrapper } = await renderGraph();
    setPositions();
    zoomIn(wrapper);

    // A world translated inside a canvas still the old width would be drawn
    // off its edge — the graph clipped by a viewport it no longer has.
    mockViewport(wrapper, WIDTH + PANEL);
    act(() => {
      ref.current!.reanchorViewport();
    });

    expect(getPixiApp(container)?.__size).toEqual({
      width: WIDTH + PANEL,
      height: HEIGHT,
    });
    // ...and that surface is out of the wrapper's flow, so the width it was
    // given cannot become a width the page around it cannot go below. jsdom
    // lays nothing out, so the class is the assertion: this is the one part of
    // a re-anchor that is CSS rather than arithmetic.
    expect(wrapper).toHaveClass("[&>canvas]:absolute");
  });

  // The panel's share is the only part of a viewport change the toggle is owed:
  // a window that moved first has already moved the graph, and the graph is
  // drawn against the width the window left behind, not the one it was built
  // in.
  it("measures from the viewport the graph was last drawn against", async () => {
    const { ref, wrapper } = await renderGraph();
    setPositions();
    const before = zoomIn(wrapper);

    // The window narrows; pixi follows it and the camera is left alone.
    mockViewport(wrapper, WIDTH - 200);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    const resized = transformOf(wrapper);

    mockViewport(wrapper, WIDTH - 200 + PANEL);
    act(() => {
      ref.current!.reanchorViewport();
    });

    await waitFor(
      () => expectAt(wrapper, { k: resized.k, x: resized.x + PANEL / 2, y: resized.y }),
      { timeout: 3000 }
    );
    expect(resized.x).toBeCloseTo(before.x);
  });

  // The note list's overlay sits above the graph rather than beside it, so it
  // is asked for no compensation at all — and a viewport that has not changed
  // is one there is nothing to put back in.
  it("leaves the camera alone when the viewport is the width it already had", async () => {
    const { ref, wrapper } = await renderGraph();
    setPositions();
    const before = zoomIn(wrapper);

    act(() => {
      ref.current!.reanchorViewport();
    });

    expectAt(wrapper, before);
  });
});
