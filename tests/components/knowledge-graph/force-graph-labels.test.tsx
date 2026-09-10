import { act, render, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import { LABEL_ZOOM_THRESHOLD, nodeRadius } from "@/lib/knowledge-graph/graph-data";

// The real force simulation settles over ~300 non-deterministic ticks and would
// move node positions under the assertions, so mock only d3.forceSimulation and
// keep the real zoom/select/zoomIdentity the component relies on.
jest.mock("d3", () => {
  const actual = jest.requireActual("d3");
  return { ...actual, forceSimulation: jest.fn() };
});

const forceSimulationMock = d3.forceSimulation as unknown as jest.Mock;

// The tests below drive zoom directly and never fire a simulation tick, so the
// mock only has to be chainable — positions are set by hand where they matter.
function createSimulationMock() {
  const sim = {
    force: jest.fn(),
    on: jest.fn(),
    stop: jest.fn(),
    alphaTarget: jest.fn(),
    restart: jest.fn(),
  };
  sim.force.mockImplementation(() => sim);
  sim.on.mockImplementation(() => sim);
  sim.alphaTarget.mockImplementation(() => sim);
  sim.restart.mockImplementation(() => sim);
  return sim;
}

const WIDTH = 800;
const HEIGHT = 600;

// Node ids are the note's own title, not a vault path: the graph API serves
// `filename` straight from the notes collection, where it holds the
// human-readable name. BETA deliberately ends in ".md" because a real note
// does ("Claude Code CLAUDE.md") — its title has to be drawn in full, not
// mistaken for a file extension and truncated.
const ALPHA = "Angular Event Binding";
const BETA = "Claude Code CLAUDE.md";
const GAMMA = "CNC Machining";
const DELTA = "T.P (Blueprint)";
// The longest title in the live vault, kept verbatim so the wrapping tests run
// against a length the graph actually has to draw.
const LONG = "Recursive Abstractive Processing for Tree-Organized Retrieval (RAPTOR)";

const NODES = [
  { id: ALPHA, createdAt: "2024-01-01T00:00:00.000Z" },
  { id: BETA, createdAt: "2024-01-02T00:00:00.000Z" },
  { id: GAMMA, createdAt: "2024-01-03T00:00:00.000Z" },
  { id: DELTA, createdAt: "2024-01-04T00:00:00.000Z" },
  { id: LONG, createdAt: "2024-01-05T00:00:00.000Z" },
];
// BETA links to ALPHA and GAMMA; DELTA is left isolated so it can be asserted
// on as an unrelated node during hover.
const EDGES = [
  { source: BETA, target: ALPHA },
  { source: BETA, target: GAMMA },
];

beforeEach(() => {
  document.documentElement.style.setProperty("--primary", "#ff0000");
  document.documentElement.style.setProperty("--claude-orange", "#ff8800");
  document.documentElement.style.setProperty("--foreground", "#000000");
  document.documentElement.style.setProperty("--background", "#ffffff");
  forceSimulationMock.mockReset();
  forceSimulationMock.mockImplementation(createSimulationMock);
});

// jsdom lays every element out at 0×0, which pins any computed zoom transform to
// its minimum. Give the wrapper a real viewport so zoom math is meaningful.
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

async function renderGraph() {
  const rendered = render(<ForceGraph nodes={NODES} edges={EDGES} />);
  const wrapper = rendered.container.querySelector(
    "[data-testid='kg-graph-wrapper']"
  ) as HTMLElement;
  mockViewport(wrapper);
  await waitFor(() => expect(forceSimulationMock).toHaveBeenCalled());
  return { ...rendered, wrapper };
}

// ctrl+wheel is d3-zoom's zoom gesture. Its default wheel delta is
// -deltaY × 0.002 × 10 (the ×10 is the ctrl pinch-zoom path), and d3 scales by
// 2^delta, so k = 2^(-0.02 · deltaY): -50 → k = 2, -75 → k ≈ 2.83, +50 → k = 0.5.
//
// The tests drive zoom by naming the scale they want and deriving the delta,
// rather than hard-coding deltas tied to one threshold value. A threshold of 2
// happens to fall on a round delta; 1.5 and 1 do not, and hard-coded deltas
// would silently stop testing the boundary the moment the threshold moved.
const deltaForScale = (k: number) => -Math.log2(k) / 0.02;

// Halving is a fixed +50 whatever the current scale, which is what makes it
// usable for stepping down from a scale the test did not start at.
const HALVE_WHEEL_DELTA = deltaForScale(0.5);
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

function labelLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-testid='kg-label-layer']");
}

function labelFor(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[data-testid='kg-label-layer'] [data-node-id="${id}"]`);
}

function labelTexts(container: HTMLElement): string[] {
  return Array.from(labelLayer(container)?.children ?? []).map(
    (el) => el.textContent ?? ""
  );
}

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

function labelXY(el: HTMLElement): { x: number; y: number } {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform);
  if (!match) throw new Error(`label has no translate3d transform: "${el.style.transform}"`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

function getNodesContainer(container: HTMLElement) {
  const canvas = container.querySelector("canvas");
  const app = (canvas as unknown as { __pixiApp?: { stage: { children?: Array<{ children?: unknown[] }> } } })
    ?.__pixiApp;
  return app?.stage.children?.[0]?.children?.[1] as
    | { children?: Array<{ label?: string; emit?(event: string, data?: unknown): void }> }
    | undefined;
}

function nodeSpriteById(container: HTMLElement, id: string) {
  return getNodesContainer(container)?.children?.find((s) => s.label === id);
}

describe("ForceGraph node labels", () => {
  it("renders one label per node, titled by the note name", async () => {
    const { container } = await renderGraph();

    // The label is the node id verbatim. BETA's title really ends in ".md",
    // and it has to survive: treating that suffix as a file extension would
    // draw the note's name wrong.
    expect(labelTexts(container)).toEqual([ALPHA, BETA, GAMMA, DELTA, LONG]);
  });

  it("wraps a long title instead of drawing it as one wide line", async () => {
    const { container } = await renderGraph();

    const label = labelFor(container, LONG)!;

    // jsdom does no layout, so the wrapping contract is pinned on the classes:
    // a max width caps the box and the wrap utility lets the title use the
    // second line. Without the cap LONG would run ~430px across the graph.
    expect(label).not.toHaveClass("whitespace-nowrap");
    expect(label).toHaveClass("max-w-[11rem]");
    expect(label).toHaveClass("wrap-break-word");
    // Centre-aligned, so the wrapped lines stay balanced under their node
    // instead of hanging off to one side of it.
    expect(label).toHaveClass("text-center");
  });

  it("wraps the hover tooltip's long title the same way", async () => {
    const { container } = await renderGraph();

    const longSprite = nodeSpriteById(container, LONG)!;
    act(() => {
      longSprite.emit!("pointerover", { stopPropagation: () => {} });
    });

    // The tooltip draws the same string as the label layer, so it has to wrap
    // on the same terms — otherwise hovering a long title pops a single line
    // that overflows the graph's clipped wrapper.
    const tooltip = container.querySelector("[data-testid='kg-node-label']")!;
    expect(tooltip).not.toHaveClass("whitespace-nowrap");
    expect(tooltip).toHaveClass("max-w-[11rem]");
    expect(tooltip).toHaveClass("wrap-break-word");
  });

  it("keeps the labels hidden below the zoom threshold", async () => {
    const { container, wrapper } = await renderGraph();

    expect(labelLayer(container)).toHaveClass("opacity-0");

    // Zoom out to half the threshold, which sits below it whatever the value.
    wheel(wrapper, deltaForScale(LABEL_ZOOM_THRESHOLD / 2));

    expect(d3.zoomTransform(wrapper).k).toBeLessThan(LABEL_ZOOM_THRESHOLD);
    expect(labelLayer(container)).toHaveClass("opacity-0");
  });

  it("reveals every label once zoomed past the threshold", async () => {
    const { container, wrapper } = await renderGraph();

    wheel(wrapper, -75); // k ≈ 2.83

    expect(d3.zoomTransform(wrapper).k).toBeGreaterThan(LABEL_ZOOM_THRESHOLD);
    await waitFor(() => expect(labelLayer(container)).toHaveClass("opacity-100"));
    expect(labelTexts(container)).toEqual([ALPHA, BETA, GAMMA, DELTA, LONG]);
  });

  it("reveals the labels at exactly the threshold zoom", async () => {
    const { container, wrapper } = await renderGraph();

    // Step onto the boundary from above. Coming from below would prove nothing:
    // these tests never fire a simulation tick, so no transform is applied at
    // mount and the ref starts hidden at any k — only a crossing flips it.
    wheel(wrapper, deltaForScale(LABEL_ZOOM_THRESHOLD * 2));
    await waitFor(() => expect(labelLayer(container)).toHaveClass("opacity-100"));

    wheel(wrapper, HALVE_WHEEL_DELTA); // 2T → T

    // The boundary is inclusive, so landing exactly on the threshold must keep
    // the labels up rather than drop them one float-ulp short.
    expect(d3.zoomTransform(wrapper).k).toBeCloseTo(LABEL_ZOOM_THRESHOLD);
    expect(labelLayer(container)).toHaveClass("opacity-100");
  });

  it("hides the labels again when zoomed back out", async () => {
    const { container, wrapper } = await renderGraph();

    wheel(wrapper, deltaForScale(LABEL_ZOOM_THRESHOLD * 2));
    await waitFor(() => expect(labelLayer(container)).toHaveClass("opacity-100"));

    // Two exact halvings land on T/2. Stepping down by halving rather than by a
    // round-trip delta keeps the result independent of which side of the
    // boundary float rounding happens to fall on.
    wheel(wrapper, HALVE_WHEEL_DELTA); // 2T → T
    wheel(wrapper, HALVE_WHEEL_DELTA); // T → T/2

    expect(d3.zoomTransform(wrapper).k).toBeLessThan(LABEL_ZOOM_THRESHOLD);
    await waitFor(() => expect(labelLayer(container)).toHaveClass("opacity-0"));
  });

  it("positions each label beneath its own node", async () => {
    const { container, wrapper } = await renderGraph();

    setPositions([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ]);
    wheel(wrapper, -75);

    const alpha = labelFor(container, ALPHA)!;
    const beta = labelFor(container, BETA)!;
    const gamma = labelFor(container, GAMMA)!;

    // Alpha sits left of Beta in graph space and Gamma directly below Alpha.
    // Each label must track its own node rather than all landing in one spot.
    expect(labelXY(alpha).x).toBeLessThan(labelXY(beta).x);
    expect(labelXY(gamma).x).toBeCloseTo(labelXY(alpha).x, 5);
    expect(labelXY(gamma).y).toBeGreaterThan(labelXY(alpha).y);

    // Alpha and Beta share a graph y, so any difference in their label y is the
    // per-node radius offset: Beta has degree 2 against Alpha's 1, so its larger
    // dot pushes its label exactly that much further down.
    expect(labelXY(beta).y - labelXY(alpha).y).toBeCloseTo(
      nodeRadius(2) - nodeRadius(1),
      5
    );

    // Hovering re-renders the labels with a new className, and flips Delta's
    // opacity because Delta is no neighbour of Beta. Each label's transform is
    // written imperatively by the positioning loop, not by React — so the label
    // elements have to survive the re-render intact. Remounting them here (a
    // hover-dependent key, for instance) would reset every transform and drop
    // the whole layer back to the wrapper's top-left corner.
    const delta = labelFor(container, DELTA)!;
    const labels = [alpha, beta, gamma, delta];
    const before = labels.map(labelXY);

    const betaSprite = nodeSpriteById(container, BETA)!;
    act(() => {
      betaSprite.emit!("pointerover", { stopPropagation: () => {} });
    });
    expect(delta.style.opacity).toBe("0.15"); // the re-render really did write
    act(() => {
      betaSprite.emit!("pointerout", { stopPropagation: () => {} });
    });

    expect(labels.map(labelXY)).toEqual(before);
  });

  it("hides the hover tooltip while the labels are shown", async () => {
    const { container, wrapper } = await renderGraph();

    wheel(wrapper, -75);
    await waitFor(() => expect(labelLayer(container)).toHaveClass("opacity-100"));

    const alpha = nodeSpriteById(container, ALPHA)!;
    act(() => {
      alpha.emit!("pointerover", { stopPropagation: () => {} });
    });

    // The node's own label is already drawn in the layer, so the tooltip would
    // only draw the same text a second time on top of it.
    await waitFor(() =>
      expect(container.querySelector("[data-testid='kg-node-label']")).toHaveClass("opacity-0")
    );
  });

  it("emphasises the hovered node's label and fades unrelated ones", async () => {
    const { container, wrapper } = await renderGraph();

    wheel(wrapper, -75);
    await waitFor(() => expect(labelLayer(container)).toHaveClass("opacity-100"));

    const beta = nodeSpriteById(container, BETA)!;
    act(() => {
      beta.emit!("pointerover", { stopPropagation: () => {} });
    });

    const hovered = labelFor(container, BETA)!;
    const neighbour = labelFor(container, ALPHA)!;
    const unrelated = labelFor(container, DELTA)!;

    expect(hovered).toHaveClass("text-primary");
    expect(hovered.style.opacity).toBe("1");
    expect(neighbour).not.toHaveClass("text-primary");
    expect(neighbour.style.opacity).toBe("1");
    // Delta is no neighbour of Beta, so its sprite dims to 0.15 — its label has
    // to fade with it or the highlight reads as a mismatch.
    expect(unrelated.style.opacity).toBe("0.15");
  });
});
