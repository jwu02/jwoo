import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

// Dragging is asserted in screen coordinates, which are only the graph
// coordinates it lands on while the zoom transform is the identity — the
// handler converts the pointer through the transform it captured at
// pointerdown (`toGraphX = (clientX - rect.left - t.x) / t.k`).
//
// The real simulation will not leave that transform alone: it frames the graph
// on its first tick and re-frames it when it settles, and in jsdom, where the
// wrapper measures 0×0, both fits clamp to the minimum zoom of 0.1. Whether one
// has landed by the time the pointer moves is purely a matter of timing, so
// this assertion used to ride on the drag winning a race against the first
// tick — and lose it whenever the suite ran under enough parallel load.
//
// So drive the simulation by hand, as the auto-fit tests do, and fire neither
// handler: the transform stays the identity it starts as, and the coordinates
// become exact.
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
        stopPropagation: () => {},
        preventDefault: () => {},
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
});
