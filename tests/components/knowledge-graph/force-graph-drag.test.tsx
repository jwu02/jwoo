import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

// Dragging is asserted in graph coordinates, which the handler derives from
// screen coordinates through the transform it captured at pointerdown. Two
// tests cover the cases that matter: the identity transform, where the two
// differ only by the wrapper's offset, and a zoomed one, where the scale and
// the pan both have to be undone. The mapping itself is unit-tested in lib;
// these check that the component feeds it the live transform.
//
// The real simulation will not leave that transform alone: it frames the graph
// on its first tick and re-frames it when it settles, and in jsdom, where the
// wrapper measures 0×0, both fits clamp to the minimum zoom of 0.1. Whether one
// has landed by the time the pointer moves is purely a matter of timing, so the
// identity assertion used to ride on the drag winning a race against the first
// tick — and lose it whenever the suite ran under enough parallel load.
//
// So drive the simulation by hand, as the auto-fit tests do, and fire neither
// handler: the transform stays the identity it starts as, and the coordinates
// become exact. The zoomed test wants the opposite, so it takes a real gesture
// instead — which fixes the transform by construction, and marks the view as
// the viewer's, so no fit can move it underneath the drag either.
jest.mock("d3", () => ({
  ...jest.requireActual("d3"),
  forceSimulation: jest.fn(),
}));

const forceSimulationMock = d3.forceSimulation as unknown as jest.Mock;

interface MockNode {
  label?: string;
  visible?: boolean;
  x?: number;
  y?: number;
  width?: number;
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

beforeEach(() => {
  document.documentElement.style.setProperty("--primary", "#ff0000");
  document.documentElement.style.setProperty("--claude-orange", "#ff8800");
  document.documentElement.style.setProperty("--foreground", "#000000");
  document.documentElement.style.setProperty("--background", "#ffffff");
  forceSimulationMock.mockReset();
  forceSimulationMock.mockImplementation(() => {
    const sim = {
      force: jest.fn(),
      on: jest.fn(),
      stop: jest.fn(),
      alphaTarget: jest.fn(),
      restart: jest.fn(),
      // Not yet cool, so the drag does not ask the simulation to reheat — the
      // heating branch belongs to the simulation, which is not running here.
      alpha: jest.fn(() => 0.5),
    };
    sim.force.mockImplementation(() => sim);
    sim.on.mockImplementation(() => sim);
    sim.alphaTarget.mockImplementation(() => sim);
    sim.restart.mockImplementation(() => sim);
    return sim;
  });
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

const WIDTH = 800;
const HEIGHT = 600;

// jsdom lays every element out at 0×0, which pins any computed zoom transform
// to its minimum. Give the wrapper a real viewport so the zoom math is
// meaningful, and keep the rect at the origin so a graph point and the client
// point it came from differ only by the transform.
function mockViewport(wrapper: HTMLElement) {
  Object.defineProperty(wrapper, "clientWidth", { value: WIDTH, configurable: true });
  Object.defineProperty(wrapper, "clientHeight", { value: HEIGHT, configurable: true });
  wrapper.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: WIDTH,
      bottom: HEIGHT,
      width: WIDTH,
      height: HEIGHT,
      toJSON: () => ({}),
    }) as DOMRect;
}

// ctrl+wheel is d3-zoom's zoom gesture, and it scales by 2^delta where delta is
// -deltaY × 0.002 × 10 — so this converts the scale a test wants into the delta
// that reaches it, rather than hard-coding a delta to one particular transform.
const deltaForScale = (k: number) => -Math.log2(k) / 0.02;

function wheel(wrapper: HTMLElement, deltaY: number) {
  act(() => {
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
  });
}

// No tick runs, so the incident links are drawn from the positions the nodes
// carry here rather than from the sprites the tick loop would have placed.
function setPositions(positions: Array<{ x: number; y: number }>) {
  const simNodes = forceSimulationMock.mock.calls[0][0] as Array<{
    x?: number;
    y?: number;
  }>;
  simNodes.forEach((node, i) => {
    node.x = positions[i]?.x;
    node.y = positions[i]?.y;
  });
}

describe("ForceGraph drag", () => {
  it("moves the dragged node and its incident links immediately during a drag", async () => {
    const { container } = render(<ForceGraph graph={GRAPH} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });
    setPositions([
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
    wheel(wrapper, deltaForScale(2));
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
