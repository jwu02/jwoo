import { act, render, waitFor } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import type { KnowledgeGraphData } from "@/lib/knowledge-graph/types";

// A press on a node that never becomes a drag is a click on that note, and a
// click on a note is what a row in the list already does: take the Focus — or,
// on the note that holds it, let it go. The renderer owns which of the two it
// is and reports it; the page owns the state. So these tests are about what the
// renderer reports, and about what it leaves alone: the camera, the simulation,
// and d3's own gestures.
//
// Same still-layout trick as the focus tests: the simulation is mocked and
// driven by hand, and the wrapper is given a real viewport, because jsdom lays
// everything out at 0×0 and a degenerate viewport pins every framing to the
// minimum zoom.
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
  alpha: jest.Mock;
}

function createSimulationMock(): SimMock {
  const sim = {
    force: jest.fn(),
    on: jest.fn(),
    stop: jest.fn(),
    alphaTarget: jest.fn(),
    restart: jest.fn(),
    // Cool, so a drag would ask for a reheat and a click must not: the reheating
    // branch is otherwise invisible to a test whose simulation is not running.
    alpha: jest.fn(() => 0.05),
  };
  sim.force.mockImplementation(() => sim);
  sim.on.mockImplementation(() => sim);
  sim.alphaTarget.mockImplementation(() => sim);
  sim.restart.mockImplementation(() => sim);
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

// The chain the focus tests lay out, so a click on C lands on a framing they
// already assert.
const POSITIONS = [
  { x: 0, y: 0 },
  { x: 200, y: 200 },
  { x: 400, y: 400 },
];
// C framed with its neighbour B, at the eased-back focus scale.
const FOCUS_C = { k: 1.44, x: -32, y: -132 };
// Somewhere over the graph, which is where a click lands unless the test is
// about a particular node.
const POINT = { x: 100, y: 100 };

interface MockNode {
  label?: string;
  alpha?: number;
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

// The node as the simulation holds it, which is what a drag writes to.
function simNodeById(id: string) {
  const simNodes = forceSimulationMock.mock.calls[0][0] as Array<{
    id: string;
    x?: number;
    y?: number;
    fx?: number;
    fy?: number;
  }>;
  return simNodes.find((node) => node.id === id)!;
}

function mockViewport(wrapper: HTMLElement) {
  Object.defineProperty(wrapper, "clientWidth", { value: WIDTH, configurable: true });
  Object.defineProperty(wrapper, "clientHeight", { value: HEIGHT, configurable: true });
  // The rect at the origin, so a client point and the graph point it maps to
  // differ only by the zoom transform.
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

// The canvas is what a pointer is really over, and d3's listeners are on the
// wrapper above it — so the mouse events that reach them are dispatched here.
const canvasOf = (container: HTMLElement) => container.querySelector("canvas") as HTMLCanvasElement;

async function mounted(ui: ReactElement) {
  const rendered = render(ui);
  const wrapper = rendered.container.querySelector(
    "[data-testid='kg-graph-wrapper']"
  ) as HTMLElement;
  mockViewport(wrapper);
  await waitFor(() => {
    expect(getContainers(rendered.container).nodesContainer?.children?.length).toBe(
      NODES.length
    );
  });
  return { ...rendered, wrapper };
}

interface GraphProps {
  focusedNote?: string | null;
  onFocusTake?: (noteId: string) => void;
  onFocusClear?: () => void;
}

const renderGraph = (props: GraphProps = {}, graph: KnowledgeGraphData = GRAPH) =>
  mounted(<ForceGraph graph={graph} {...props} />);

// The focus arriving from outside the graph — a row's click. It has to arrive
// after the layout has positions, the way it does in the page: the flight is
// computed from where the nodes are, and a focus handed over before the layout
// has run is reframed by the settle that follows instead.
const focusOn = (
  rerender: (ui: ReactElement) => void,
  noteId: string,
  props: GraphProps = {}
) => rerender(<ForceGraph graph={GRAPH} focusedNote={noteId} {...props} />);

// The page's own hold on the Focus, in five lines: the renderer reports what a
// click was, this keeps it, and hands it back as the prop the camera answers.
// That is the whole contract between the two, and the reason a click on a node
// behaves like a click on that note's row.
function FocusHarness({
  onTake,
  onClear,
}: {
  onTake?: (noteId: string) => void;
  onClear?: () => void;
}) {
  const [focusedNote, setFocusedNote] = useState<string | null>(null);
  const take = (noteId: string) => {
    onTake?.(noteId);
    setFocusedNote(noteId);
  };
  const clear = () => {
    onClear?.();
    setFocusedNote(null);
  };
  return (
    <ForceGraph
      graph={GRAPH}
      focusedNote={focusedNote}
      onFocusTake={take}
      onFocusClear={clear}
    />
  );
}

const transformOf = (wrapper: HTMLElement) => d3.zoomTransform(wrapper);

const expectAt = (wrapper: HTMLElement, transform: { k: number; x: number; y: number }) => {
  const t = transformOf(wrapper);
  expect(t.k).toBeCloseTo(transform.k);
  expect(t.x).toBeCloseTo(transform.x);
  expect(t.y).toBeCloseTo(transform.y);
};

// The pointer events the graph itself hears: a press delivered to the node the
// way pixi delivers it, and a release on the document, which is where the
// gesture put its listeners.
function pointer(type: string, point: { x: number; y: number }) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
  });
}

function press(container: HTMLElement, id: string, point = POINT, button = 0) {
  act(() => {
    nodeSpriteById(container, id)!.emit!("pointerdown", { client: point, button });
  });
}

function moveTo(point: { x: number; y: number }) {
  act(() => {
    document.dispatchEvent(pointer("pointermove", point));
  });
}

function release(point = POINT) {
  act(() => {
    document.dispatchEvent(pointer("pointerup", point));
  });
}

// A press and a release in the same place: what the browser reports as a click,
// and what the graph has to read the way the note list reads a row's.
function click(container: HTMLElement, id: string, point = POINT) {
  press(container, id, point);
  release(point);
}

// The mouse events the browser sends alongside the pointer events, and the ones
// d3 listens for. `detail` is the click count, the one thing a press cannot
// learn about itself.
function mouse(type: string, point: { x: number; y: number }, detail = 0) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: point.x,
    clientY: point.y,
    detail,
  });
}

describe("ForceGraph node click", () => {
  it("takes the Focus, and flies the camera, when a node is clicked", async () => {
    const onTake = jest.fn();
    const { container, wrapper } = await mounted(<FocusHarness onTake={onTake} />);
    setPositions();

    click(container, "C.md");

    expect(onTake).toHaveBeenCalledWith("C.md");
    // A row's click and a node's click end in the same camera: C framed with
    // the neighbour it links to.
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });
  });

  // The camera is the page's flight, not the click's. The gesture knows nothing
  // about what framing a note has, and should not: a report with no focus
  // behind it leaves the graph exactly where it stood.
  it("moves no camera of its own", async () => {
    const onTake = jest.fn();
    const { container, wrapper } = await renderGraph({ onFocusTake: onTake });
    setPositions();

    click(container, "C.md");

    expect(onTake).toHaveBeenCalledWith("C.md");
    expectAt(wrapper, { k: 1, x: 0, y: 0 });
  });

  it("does not heat the simulation up", async () => {
    const { container } = await renderGraph();
    setPositions();
    const sim = forceSimulationMock.mock.results[0].value as SimMock;

    click(container, "C.md");

    // A click is not a reason for the layout to move, so nothing wakes it up.
    expect(sim.alphaTarget).not.toHaveBeenCalled();
    expect(sim.restart).not.toHaveBeenCalled();
  });

  it("lets the Focus go when the note that holds it is clicked again", async () => {
    const onClear = jest.fn();
    const onTake = jest.fn();
    const { container, rerender, wrapper } = await renderGraph({
      onFocusClear: onClear,
      onFocusTake: onTake,
    });
    setPositions();
    // The focus is already held when the click arrives — taken from the list,
    // or by an earlier click on the node — so this click is the one that ends
    // it.
    focusOn(rerender, "C.md", { onFocusClear: onClear, onFocusTake: onTake });
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    click(container, "C.md");

    expect(onClear).toHaveBeenCalledTimes(1);
    // The click ended a focus, it did not ask for another note's.
    expect(onTake).not.toHaveBeenCalled();
  });

  // Dismissing a focus is not a reason to yank the camera: the visitor is left
  // looking at what they focused, exactly as when the panel's own affordance
  // clears it.
  it("keeps the camera where it is when a click ends the Focus", async () => {
    const { container, rerender, wrapper } = await renderGraph();
    setPositions();
    focusOn(rerender, "C.md");
    await waitFor(() => expectAt(wrapper, FOCUS_C), { timeout: 3000 });

    click(container, "C.md");

    expectAt(wrapper, FOCUS_C);
  });
});

describe("ForceGraph press against the drag", () => {
  it("still drags once the press has travelled past the slop", async () => {
    const onTake = jest.fn();
    const { container } = await renderGraph({ onFocusTake: onTake });
    setPositions();
    const sim = forceSimulationMock.mock.results[0].value as SimMock;

    press(container, "B.md", { x: 100, y: 100 });
    moveTo({ x: 250, y: 140 });

    expect(simNodeById("B.md").x).toBe(250);
    expect(simNodeById("B.md").y).toBe(140);
    // The drag the graph has always had, and the layout comes alive for it.
    expect(sim.alphaTarget).toHaveBeenCalledWith(0.3);

    release({ x: 250, y: 140 });
    // A hand that travelled did not click, so no note was focused.
    expect(onTake).not.toHaveBeenCalled();
    // And the drag is over: the node is the layout's again.
    expect(simNodeById("B.md").fx).toBeUndefined();
    expect(sim.alphaTarget).toHaveBeenLastCalledWith(0);
  });

  it("leaves the node where it was when the press never travelled", async () => {
    const onTake = jest.fn();
    const { container } = await renderGraph({ onFocusTake: onTake });
    setPositions();

    press(container, "B.md", { x: 100, y: 100 });
    // Three pixels: under the slop, so the hand has not meant a drag.
    moveTo({ x: 103, y: 100 });
    release({ x: 103, y: 100 });

    expect(simNodeById("B.md").x).toBe(200);
    expect(simNodeById("B.md").y).toBe(200);
    expect(onTake).toHaveBeenCalledWith("B.md");
  });

  it("ignores a press that is not the left button", async () => {
    const onTake = jest.fn();
    const { container } = await renderGraph({ onFocusTake: onTake });
    setPositions();

    // A right-click opens a menu; it does not focus a note.
    press(container, "C.md", POINT, 2);
    release();

    expect(onTake).not.toHaveBeenCalled();
  });

  // What ends a press without a release is the browser taking the pointer away.
  // That is not a click: nothing was let go of over the node.
  it("abandons a press the browser cancels, without clicking", async () => {
    const onTake = jest.fn();
    const { container, wrapper } = await renderGraph({ onFocusTake: onTake });
    setPositions();

    press(container, "C.md");
    act(() => {
      document.dispatchEvent(pointer("pointercancel", POINT));
    });
    // A release after the cancel belongs to nothing.
    release();

    expect(onTake).not.toHaveBeenCalled();
    expectAt(wrapper, { k: 1, x: 0, y: 0 });
  });
});

describe("ForceGraph press against the zoom", () => {
  // d3 arms its pan from the mousedown the browser sends after the pointerdown
  // that began the press. While a press is down it must not, or the few pixels
  // a click drifts would pan the graph under the visitor's hand. The control is
  // the same drift with no press, and proves the harness can see a pan at all.
  it("pans the camera on a drift over the background", async () => {
    const { container, wrapper } = await renderGraph();

    act(() => {
      canvasOf(container).dispatchEvent(mouse("mousedown", POINT));
    });
    act(() => {
      window.dispatchEvent(mouse("mousemove", { x: POINT.x + 3, y: POINT.y }));
    });
    act(() => {
      window.dispatchEvent(mouse("mouseup", { x: POINT.x + 3, y: POINT.y }));
    });

    expect(transformOf(wrapper).x).toBeCloseTo(3);
  });

  it("does not pan the camera on the same drift over a pressed node", async () => {
    const { container, wrapper } = await renderGraph();
    setPositions();

    press(container, "B.md", POINT);
    act(() => {
      canvasOf(container).dispatchEvent(mouse("mousedown", POINT));
    });
    act(() => {
      window.dispatchEvent(mouse("mousemove", { x: POINT.x + 3, y: POINT.y }));
    });

    // The drift was under the slop, so it was a click and not a drag — and the
    // camera paid for neither, with the node left where the layout had it.
    expectAt(wrapper, { k: 1, x: 0, y: 0 });
    expect(simNodeById("B.md").x).toBe(200);
  });
});

describe("ForceGraph double-click on a node", () => {
  // The browser's own sequence for a double-click: two presses, each with the
  // mousedown that carries its click count, closed out by the dblclick. The
  // count is the only way to tell this apart from two separate clicks, because
  // a press cannot read it where it starts.
  function doubleClick(container: HTMLElement, id: string, point = POINT) {
    for (const detail of [1, 2]) {
      press(container, id, point);
      act(() => {
        canvasOf(container).dispatchEvent(mouse("mousedown", point, detail));
      });
      release(point);
    }
    act(() => {
      canvasOf(container).dispatchEvent(mouse("dblclick", point, 2));
    });
  }

  it("zooms nothing when the double-click landed on a node", async () => {
    const { container, wrapper } = await renderGraph();
    // Registered on the wrapper after d3's own dblclick handler, so this stands
    // for the event reaching the phase that handler runs in — the one a
    // consumed event never gets to.
    const bubbled = jest.fn();
    wrapper.addEventListener("dblclick", bubbled);

    doubleClick(container, "C.md");
    // A zoom runs on a d3 transition; give it longer than one to land, if it
    // were going to.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(bubbled).not.toHaveBeenCalled();
    expectAt(wrapper, { k: 1, x: 0, y: 0 });
  });

  it("still zooms when the double-click landed past the nodes", async () => {
    const { container, wrapper } = await renderGraph();

    act(() => {
      canvasOf(container).dispatchEvent(mouse("dblclick", { x: 400, y: 300 }, 2));
    });

    // d3's own step: doubled about the point, with no note involved.
    await waitFor(() => expectAt(wrapper, { k: 2, x: -400, y: -300 }), { timeout: 3000 });
  });
});
