import { waitFor } from "@testing-library/react";
import {
  createCamera,
  type CameraCallbacks,
  type Transform,
  type TransformCause,
} from "@/lib/knowledge-graph/camera";
import {
  computeFitTransform,
  computeFocusTransform,
  computeReanchorTransform,
} from "@/lib/knowledge-graph/framing";
import type { KnowledgeGraphEdge } from "@/lib/knowledge-graph/types";

// The camera is the graph's whole relationship with the viewport, and every test
// below is about the one thing it decides: where the camera ends up. So it is
// bound to a plain div here — no Pixi, no simulation, no React — and jsdom lays
// that div out at 0×0, so the viewport it is framed in has to be defined by
// hand. That is a mocked DOM box, which is the whole of what the camera needs
// from a component.
const WIDTH = 800;
const HEIGHT = 600;
// The note panel's own width: what the graph's viewport gains when it collapses
// and loses when it opens.
const PANEL = 288;

// A chain A—B—C laid out along a diagonal, so every framing below has an extent
// to compute and a neighbour that must not be dragged in.
const chain = () => [
  { id: "A.md", x: 0, y: 0 },
  { id: "B.md", x: 200, y: 200 },
  { id: "C.md", x: 400, y: 400 },
];
const EDGES: KnowledgeGraphEdge[] = [
  { source: "A.md", target: "B.md" },
  { source: "B.md", target: "C.md" },
];

function setup(callbacks: CameraCallbacks = {}) {
  const wrapper = document.createElement("div");
  setWidth(wrapper, WIDTH);
  document.body.appendChild(wrapper);
  return { wrapper, camera: createCamera(wrapper, callbacks) };
}

function setWidth(wrapper: HTMLElement, width: number, height = HEIGHT) {
  Object.defineProperty(wrapper, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(wrapper, "clientHeight", { value: height, configurable: true });
}

// A wheel the way d3-zoom reads one: ctrl+wheel is the zoom gesture, and it
// scales by 2^(-0.02 · deltaY), so the delta is derived from the scale a test
// wants rather than hard-coded to it.
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

const expectAt = (transform: Transform, expected: { k: number; x: number; y: number }) => {
  expect(transform.k).toBeCloseTo(expected.k);
  expect(transform.x).toBeCloseTo(expected.x);
  expect(transform.y).toBeCloseTo(expected.y);
};

const focusFraming = (nodes: Array<{ id: string; x?: number; y?: number }>) =>
  computeFocusTransform("C.md", nodes, EDGES, WIDTH, HEIGHT)!;

// Long enough for a camera move that should have happened to have finished, and
// for one that should not have to have shown itself well before then.
const pastAnimation = () => new Promise((resolve) => setTimeout(resolve, 150));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createCamera fits", () => {
  it("fits the whole graph as the layout is first drawn", () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);

    camera.layoutReady();

    // A snap, not a move to watch: the fit and the layout it frames are drawn
    // in the same turn, so there is no unframed frame for an animation to
    // cover — and the layout is at rest, so the frame is the final one.
    expectAt(camera.transform, computeFitTransform(nodes, WIDTH, HEIGHT));
  });

  // The note panel can be collapsed before the layout is ready, and it is the
  // framing of the box the graph is in by then — a fit computed against the box
  // the graph was built in would frame the whole graph off-centre.
  it("frames the viewport the graph is in now, not the one it was built in", () => {
    const { camera, wrapper } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);

    setWidth(wrapper, WIDTH + PANEL);
    camera.layoutReady();

    expectAt(camera.transform, computeFitTransform(nodes, WIDTH + PANEL, HEIGHT));
  });

  it("yields to a viewer who has moved the camera", async () => {
    const { camera, wrapper } = setup();
    camera.setLayout(chain(), EDGES);

    wheel(wrapper, deltaForScale(2));
    const gesture = { ...camera.transform };
    expect(gesture.k).toBeCloseTo(2);

    camera.layoutReady();

    // The graph is where the viewer put it: the fit is a snap, so one that ran
    // would have landed by now.
    await pastAnimation();
    expectAt(camera.transform, gesture);
  });

  it("holds off the fit while a note has the focus", async () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.setFocus("C.md");
    await waitFor(() => expectAt(camera.transform, focusFraming(nodes)));

    camera.layoutReady();

    // The focus is the framing the visitor asked for, and it outranks the
    // graph's own.
    await pastAnimation();
    expectAt(camera.transform, focusFraming(nodes));
    expect(focusFraming(nodes)).not.toEqual(computeFitTransform(nodes, WIDTH, HEIGHT));
  });
});

describe("createCamera refits", () => {
  // The viewer's own ask for the whole graph: a double-click past the nodes.
  // Unlike the fit at first paint this is not a framing the camera concedes to
  // a viewer who has moved it — it is the one the viewer commands, and it is
  // taken from wherever the camera is, over whatever moved it there.
  it("frames the whole graph again after the viewer has moved the camera", async () => {
    const { wrapper, camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.layoutReady();

    wheel(wrapper, deltaForScale(2));
    // Away from the fit the viewer is asking back: the fit framed the graph at
    // 1.2 here, and the wheel is a doubling on top of it.
    expect(camera.transform.k).toBeGreaterThan(computeFitTransform(nodes, WIDTH, HEIGHT).k);

    camera.refit();

    await waitFor(() => expectAt(camera.transform, computeFitTransform(nodes, WIDTH, HEIGHT)));
  });

  it("frames the viewport the graph is in now, not the one it was first fitted in", async () => {
    const { wrapper, camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.layoutReady();
    // The note panel came or went after the first fit: the transform the graph
    // was first seen in no longer frames the graph it is drawn in, which is why
    // a refit computes one rather than replaying it.
    setWidth(wrapper, WIDTH + PANEL);

    camera.refit();

    await waitFor(() =>
      expectAt(camera.transform, computeFitTransform(nodes, WIDTH + PANEL, HEIGHT))
    );
  });

  it("reports the refit as the viewer's hand, on every frame of it", async () => {
    const causes: TransformCause[] = [];
    const { camera } = setup({ onTransformChange: (_transform, by) => causes.push(by) });
    camera.setLayout(chain(), EDGES);
    camera.layoutReady();
    causes.length = 0;

    camera.refit();
    await pastAnimation();

    // The move is applied by the graph, so not one of its frames carries a
    // sourceEvent: the cause has to ride the move, or a refit would read as the
    // graph's own and leave a focus standing.
    expect(causes.length).toBeGreaterThan(0);
    expect(new Set(causes)).toEqual(new Set<TransformCause>(["gesture"]));
  });

  it("ends a focus the viewer has refit away from", async () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.layoutReady();
    camera.setFocus("C.md");
    await waitFor(() => expectAt(camera.transform, focusFraming(nodes)));

    camera.refit();
    await waitFor(() => expectAt(camera.transform, computeFitTransform(nodes, WIDTH, HEIGHT)));

    // The dismissed focus does not come back with the next layout: the camera
    // is the viewer's again, and no flight is made under a claim they let go of.
    camera.layoutReady();
    expectAt(camera.transform, computeFitTransform(nodes, WIDTH, HEIGHT));
  });
});

describe("createCamera focus", () => {
  it("flies to the focused note's neighbourhood", async () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);

    camera.setFocus("C.md");

    // C's own company — B with it — and not the whole graph: A is two links
    // away, and a flight that framed the graph would land somewhere else
    // entirely.
    await waitFor(() => expectAt(camera.transform, focusFraming(nodes)));
    expect(focusFraming(nodes)).not.toEqual(computeFitTransform(nodes, WIDTH, HEIGHT));
  });

  it("centers a note with no neighbours at the eased-back scale", async () => {
    // C links to nothing, so there is no extent to fit: the camera rests at
    // natural scale over the note itself, eased back like every focus, rather
    // than zooming in on the point it is.
    const { camera } = setup();
    const nodes = chain();
    const edges: KnowledgeGraphEdge[] = [{ source: "A.md", target: "B.md" }];
    camera.setLayout(nodes, edges);

    camera.setFocus("C.md");

    await waitFor(() =>
      expectAt(camera.transform, computeFocusTransform("C.md", nodes, edges, WIDTH, HEIGHT)!)
    );
  });

  it("makes no second flight for the same focus on a rebuilt layout", async () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.setFocus("C.md");
    await waitFor(() => expectAt(camera.transform, focusFraming(nodes)));
    const framed = { ...camera.transform };

    // A rebuild hands over new arrays for the same focus, which is not a new
    // focus: the flight has been made. The layout has moved on, so a flight
    // started here would visibly leave for somewhere else.
    const moved = nodes.map((node) => ({ ...node, x: node.x + 1000 }));
    camera.setLayout(moved, EDGES);
    camera.setFocus("C.md");

    await pastAnimation();
    expectAt(camera.transform, framed);
  });

  it("re-frames the focused note against a layout that arrives under it", async () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.setFocus("C.md");
    await waitFor(() => expectAt(camera.transform, focusFraming(nodes)));

    // The flight was computed from a layout that is no longer the one on
    // screen — a rebuild has laid the chain out somewhere else, so the framing
    // it was flown to now points at nothing.
    const moved = [
      { id: "A.md", x: -2000, y: -2000 },
      { id: "B.md", x: 1000, y: 1000 },
      { id: "C.md", x: 1200, y: 1200 },
    ];
    camera.setLayout(moved, EDGES);
    camera.layoutReady();

    // The focus outranks the fit either way: C is re-framed where it now is,
    // rather than the whole graph being framed around it.
    await waitFor(() => expectAt(camera.transform, focusFraming(moved)));
  });

  it("leaves the camera where it is when the focus is dismissed", async () => {
    const { camera } = setup();
    const nodes = chain();
    camera.setLayout(nodes, EDGES);
    camera.setFocus("C.md");
    await waitFor(() => expectAt(camera.transform, focusFraming(nodes)));
    const framed = { ...camera.transform };

    camera.setFocus(null);

    // The viewer is left looking at what they focused; letting the note go is
    // not a reason to put the camera back where it stood before the flight.
    await pastAnimation();
    expectAt(camera.transform, framed);
  });
});

describe("createCamera gestures", () => {
  it("hands the camera to the viewer's wheel, and reports it as theirs", async () => {
    const onTransformChange = jest.fn();
    const { camera, wrapper } = setup({ onTransformChange });
    camera.setLayout(chain(), EDGES);
    camera.setFocus("C.md");
    await waitFor(() => expect(onTransformChange).toHaveBeenCalled());
    onTransformChange.mockClear();

    // The visitor grabs the camera while the flight is still in the air. The
    // tween must not fight them for it: a flight that kept running would drag
    // the camera back out of their hands frame by frame.
    wheel(wrapper, deltaForScale(2));

    expect(onTransformChange).toHaveBeenCalled();
    for (const [, by] of onTransformChange.mock.calls) expect(by).toBe("gesture");
    const gesture = { ...camera.transform };
    expect(gesture.k).toBeCloseTo(2);

    // ...and the camera is theirs for good: the fit that follows is not made,
    // because nothing may go on claiming a note they have panned away from.
    await pastAnimation();
    expectAt(camera.transform, gesture);
    camera.layoutReady();
    await pastAnimation();
    expectAt(camera.transform, gesture);
  });

  it("refuses a gesture while a press is down", () => {
    const onTransformChange = jest.fn();
    const { camera, wrapper } = setup({ onTransformChange });
    camera.setLayout(chain(), EDGES);

    // A press is not a camera gesture, and the pan d3 arms from the mousedown
    // that follows it is not one either.
    camera.setPressed(true);
    wheel(wrapper, deltaForScale(2));

    expectAt(camera.transform, { k: 1, x: 0, y: 0 });
    expect(onTransformChange).not.toHaveBeenCalled();
  });

  it("takes gestures again once the press is over", () => {
    const { camera, wrapper } = setup();
    camera.setLayout(chain(), EDGES);

    camera.setPressed(true);
    camera.setPressed(false);
    wheel(wrapper, deltaForScale(2));

    expect(camera.transform.k).toBeCloseTo(2);
  });
});

describe("createCamera re-anchor", () => {
  it("puts the viewport's centre back after a layout change", async () => {
    const seen: { transform?: Transform } = {};
    const onViewportChange = jest.fn(() => {
      seen.transform = scene.camera.transform;
    });
    const scene = setup({ onViewportChange });
    const { camera } = scene;

    camera.setLayout(chain(), EDGES);
    wheel(scene.wrapper, deltaForScale(2));
    const before = { ...camera.transform };

    setWidth(scene.wrapper, WIDTH + PANEL);
    camera.reanchor();

    // The surface is told in the same turn as the move, before the transition
    // has drawn a frame of it: a world translated inside a surface still the
    // old width would be drawn off its edge.
    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expectAt(seen.transform!, before);
    // And the move is a compensation, not a framing — it applies from wherever
    // the viewer is holding the camera.
    expectAt(camera.transform, before);
    await waitFor(() =>
      expectAt(camera.transform, computeReanchorTransform(before, WIDTH, WIDTH + PANEL))
    );
  });

  it("leaves the camera alone when the viewport is the width it already had", () => {
    const onViewportChange = jest.fn();
    const { camera, wrapper } = setup({ onViewportChange });
    camera.setLayout(chain(), EDGES);
    wheel(wrapper, deltaForScale(2));
    const before = { ...camera.transform };

    camera.reanchor();

    expect(onViewportChange).not.toHaveBeenCalled();
    expectAt(camera.transform, before);
  });

  // A window resize is not the graph's to compensate for — the surface follows
  // it and the camera is left where the viewer put it — but the width it leaves
  // behind is the one a later toggle measures from.
  it("records the width a window resize leaves, without moving the camera", async () => {
    const { camera, wrapper } = setup();
    camera.setLayout(chain(), EDGES);
    wheel(wrapper, deltaForScale(2));
    const before = { ...camera.transform };

    setWidth(wrapper, WIDTH - 200);
    window.dispatchEvent(new Event("resize"));
    expectAt(camera.transform, before);

    setWidth(wrapper, WIDTH - 200 + PANEL);
    camera.reanchor();

    // Half of the panel, not half of the panel plus the 200 the window took:
    // the graph is drawn against the width the window left behind.
    await waitFor(() =>
      expectAt(
        camera.transform,
        computeReanchorTransform(before, WIDTH - 200, WIDTH - 200 + PANEL)
      )
    );
  });
});

describe("createCamera teardown", () => {
  it("unbinds both the gesture and the resize listener", () => {
    const onTransformChange = jest.fn();
    const onViewportChange = jest.fn();
    const { camera, wrapper } = setup({ onTransformChange, onViewportChange });
    camera.setLayout(chain(), EDGES);
    const before = { ...camera.transform };

    camera.destroy();

    wheel(wrapper, deltaForScale(2));
    expect(onTransformChange).not.toHaveBeenCalled();

    // The width a resize leaves is no longer recorded, so a re-anchor at the
    // width the camera was built at has nothing it owes — where a listener still
    // in place would have left it compensating for the 200 that went by.
    setWidth(wrapper, WIDTH - 200);
    window.dispatchEvent(new Event("resize"));
    setWidth(wrapper, WIDTH);
    camera.reanchor();

    expect(onViewportChange).not.toHaveBeenCalled();
    expectAt(camera.transform, before);
  });
});
