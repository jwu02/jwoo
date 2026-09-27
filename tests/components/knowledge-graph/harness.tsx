// What every ForceGraph renderer test needs: a still layout it can drive by
// hand, a wrapper with a viewport, a way to move the camera, and a walk into the
// Pixi scene the renderer builds. None of it is per-test — so it lives here, and
// a test file declares its own `jest.mock("d3", ...)` (hoisting is per-file)
// and imports the rest.

export const VIEWPORT = { width: 800, height: 600 };

// The CSS custom properties the renderer reads when it paints. jsdom has no
// stylesheet, so they are set by hand rather than inherited from the page.
export function setCssVars() {
  document.documentElement.style.setProperty("--primary", "#ff0000");
  document.documentElement.style.setProperty("--claude-orange", "#ff8800");
  document.documentElement.style.setProperty("--foreground", "#000000");
  document.documentElement.style.setProperty("--background", "#ffffff");
}

export interface SimMock {
  force: jest.Mock;
  on: jest.Mock;
  stop: jest.Mock;
  alphaTarget: jest.Mock;
  restart: jest.Mock;
  alpha: jest.Mock;
  // TODO: unused since the fit and re-anchor tests became camera unit tests,
  // which drive layoutTicked/layoutSettled directly. Delete the field and the
  // recording `on` below once no renderer test needs to fire a tick.
  handlers: Record<string, () => void>;
}

// The force simulation, chainable and hand-driven: the real one settles over
// ~300 non-deterministic ticks, which is too slow to assert against and would
// move the nodes under the assertion anyway.
//
// Its tick and end handlers are recorded, so a test can fire the events the
// camera's fits hang off. `alpha` reports how warm the layout looks, because
// whether a drag asks for a reheat is a branch on it — the default is a layout
// that has not cooled, which is the one a drag leaves alone.
export function createSimulationMock(alpha = 0.5): SimMock {
  const handlers: Record<string, () => void> = {};
  const sim = {
    force: jest.fn(),
    on: jest.fn(),
    stop: jest.fn(),
    alphaTarget: jest.fn(),
    restart: jest.fn(),
    alpha: jest.fn(() => alpha),
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

// Positions the nodes the simulation was handed — the array the renderer holds
// by reference, which is what a tick reads and what a drag writes to.
export function setPositions(
  forceSimulationMock: jest.Mock,
  positions: Array<{ x?: number; y?: number }>
) {
  const simNodes = forceSimulationMock.mock.calls[0][0] as Array<{
    x?: number;
    y?: number;
  }>;
  simNodes.forEach((node, i) => {
    node.x = positions[i]?.x;
    node.y = positions[i]?.y;
  });
}

// jsdom lays every element out at 0×0, which pins any computed zoom transform
// to its minimum and leaves d3's pointer math nothing to subtract. Give the
// wrapper a real box, anchored at the origin so a client point and the graph
// point it maps to differ only by the zoom transform.
export function mockViewport(
  element: HTMLElement,
  width = VIEWPORT.width,
  height = VIEWPORT.height
) {
  Object.defineProperty(element, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: height, configurable: true });
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
}

// ctrl+wheel is d3-zoom's zoom gesture. Its default wheel delta is
// -deltaY × 0.002 × 10 (the ×10 is the ctrl pinch-zoom path), and d3 scales by
// 2^delta, so k = 2^(-0.02 · deltaY): -50 → k = 2, -75 → k ≈ 2.83, +50 → k = 0.5.
//
// Tests name the scale they want and derive the delta from it, rather than
// hard-coding deltas tied to one particular threshold: a threshold of 2 happens
// to fall on a round delta, but 1.5 and 1 do not, and a hard-coded delta would
// silently stop testing the boundary the moment the threshold moved.
export const deltaForScale = (k: number) => -Math.log2(k) / 0.02;

// Dispatched on the wrapper, which is where d3's listeners are. The caller
// wraps it in act() when the re-render that follows has to be flushed first.
export function wheel(wrapper: HTMLElement, deltaY: number) {
  wrapper.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY,
      ctrlKey: true,
      clientX: VIEWPORT.width / 2,
      clientY: VIEWPORT.height / 2,
    })
  );
}

// The Pixi scene as the mocks in __mocks__/pixi.js build it: an Application
// whose stage holds the world, whose children are the links and then the nodes.
// Every sprite carries its own `label`, which is how a test finds it.
export interface MockNode {
  label?: string;
  visible?: boolean;
  alpha?: number;
  tint?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: { x: number; y: number };
  children?: MockNode[];
  emit?(event: string, data?: unknown): void;
  __circleRadius?: number;
}

export interface MockApp {
  stage: MockNode;
  __size?: { width: number; height: number } | null;
  __textureSource?: MockNode;
}

export function getPixiApp(container: HTMLElement): MockApp | undefined {
  const canvas = container.querySelector("canvas");
  return (canvas as unknown as { __pixiApp?: MockApp })?.__pixiApp;
}

export function getContainers(container: HTMLElement) {
  const app = getPixiApp(container);
  const world = app?.stage.children?.[0];
  const linksContainer = world?.children?.[0];
  const nodesContainer = world?.children?.[1];
  return { app, world, linksContainer, nodesContainer };
}

export function nodeSpriteById(container: HTMLElement, id: string): MockNode | undefined {
  return getContainers(container).nodesContainer?.children?.find((s) => s.label === id);
}

export function linkSpriteBySource(
  container: HTMLElement,
  sourceId: string
): MockNode | undefined {
  return getContainers(container).linksContainer?.children?.find((s) =>
    s.label?.startsWith(`${sourceId}->`)
  );
}
