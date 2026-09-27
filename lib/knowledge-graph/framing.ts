import { computeNeighbors } from "./graph-data";
import type { KnowledgeGraphEdge } from "./types";

// The zoom range the graph is clamped to — the d3-zoom scaleExtent, and the
// bounds every fit helper clamps to. One definition, so a change here cannot
// leave the fit helpers and the gesture disagreeing about the reachable range.
export const NODE_MIN_ZOOM = 0.1;
export const NODE_MAX_ZOOM = 4;

// The room a framing leaves around what it frames, in viewport pixels. One
// value, so the whole-graph fit and the focus framing agree about how tightly
// the graph may be drawn.
const FIT_PADDING = 60;

// Zoom transform (scale k + translate x/y) that fits the given positioned
// points inside a viewport with `padding` around the edges, clamped to the
// graph's zoom range (NODE_MIN_ZOOM..NODE_MAX_ZOOM). Every framing the graph
// makes of itself is this function with a different set of points — the whole
// layout's, or one note's neighbourhood. Kept framework-free so it is
// unit-testable; the component wraps the result in a d3.zoomIdentity.
function fitPoints(
  nodes: readonly { x?: number; y?: number }[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number
): { k: number; x: number; y: number } {
  const positioned = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  if (positioned.length === 0) return { k: 1, x: 0, y: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of positioned) {
    minX = Math.min(minX, n.x!);
    maxX = Math.max(maxX, n.x!);
    minY = Math.min(minY, n.y!);
    maxY = Math.max(maxY, n.y!);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // A single point (or a pair with no extent in one axis) would otherwise
  // zoom to the max scale and look blown up; keep it at natural size.
  if (contentW === 0 && contentH === 0) {
    return { k: 1, x: viewportWidth / 2 - minX, y: viewportHeight / 2 - minY };
  }

  const fitW = viewportWidth - padding * 2;
  const fitH = viewportHeight - padding * 2;
  const k = Math.max(
    NODE_MIN_ZOOM,
    Math.min(NODE_MAX_ZOOM, Math.min(fitW / (contentW || 1), fitH / (contentH || 1)))
  );

  const centerX = minX + contentW / 2;
  const centerY = minY + contentH / 2;
  return {
    k,
    x: viewportWidth / 2 - k * centerX,
    y: viewportHeight / 2 - k * centerY,
  };
}

// Zoom transform that frames the whole graph — the framing the page is left
// with when nothing is focused.
export function computeFitTransform(
  nodes: Array<{ x?: number; y?: number }>,
  viewportWidth: number,
  viewportHeight: number,
  padding = FIT_PADDING
): { k: number; x: number; y: number } {
  return fitPoints(nodes, viewportWidth, viewportHeight, padding);
}

// How far back from its fitted scale the focus sits. The fitted scale is the
// one that fills the viewport with the note and its direct neighbours — and
// most neighbourhoods are tight enough to be clamped at the zoom ceiling,
// which frames a note in nothing but its immediate company. Easing back from
// the fit is what keeps the notes around it on screen: seeing the clicked note
// as part of its graph is the point of focusing it.
export const FOCUS_ZOOM_OUT = 0.6;

// The framing the camera flies to when a note takes the Focus: the note and its
// neighbours, padded and clamped like any other framing, then eased back from
// the fitted scale by FOCUS_ZOOM_OUT. Deliberately not the whole graph — seeing
// the note in its company is the point of focusing it.
//
// A note with no neighbours has no extent to frame, so it is centered on
// itself at the eased-back scale, like every focus. Null when there is nothing
// to aim at: a note the graph does not hold, or one the layout has not placed
// yet.
export function computeFocusTransform(
  noteId: string,
  nodes: readonly { id: string; x?: number; y?: number }[],
  edges: readonly KnowledgeGraphEdge[],
  viewportWidth: number,
  viewportHeight: number,
  padding = FIT_PADDING
): { k: number; x: number; y: number } | null {
  const note = nodes.find((node) => node.id === noteId);
  if (!note || note.x === undefined || note.y === undefined) return null;

  const neighbors = computeNeighbors(nodes, edges).get(noteId);
  const framed = nodes.filter(
    (node) => node.id === noteId || neighbors?.has(node.id)
  );
  const fit = fitPoints(framed, viewportWidth, viewportHeight, padding);

  // The eased-back scale stays inside the reachable zoom range: below the
  // gesture's floor d3 would silently clamp the flight, and the camera would
  // land somewhere the computed transform does not describe.
  const k = Math.max(NODE_MIN_ZOOM, fit.k * FOCUS_ZOOM_OUT);
  // The neighbourhood stays centred: the fit's translate is undone into the
  // content centre it came from, and re-applied at the eased-back scale.
  const centerX = (viewportWidth / 2 - fit.x) / fit.k;
  const centerY = (viewportHeight / 2 - fit.y) / fit.k;
  return {
    k,
    x: viewportWidth / 2 - k * centerX,
    y: viewportHeight / 2 - k * centerY,
  };
}

// The camera a layout change leaves behind: the panel beside the graph opened
// or collapsed, so the graph's viewport is a different width — and the world it
// draws is anchored to that viewport's left edge, which did not move.
//
// What the viewer was looking at is the centre of the viewport, so that is what
// is put back: the graph point that was at the old centre is moved to the new
// one, and the zoom they are holding is kept. A pure translation — a viewport
// that grew by `d` on the right has a centre `d/2` further right, and the graph
// has to follow it there.
//
// Not a framing: nothing here decides how much of the graph should be on
// screen, which is why it applies from wherever the camera is, including over a
// viewer who has panned away from every fit.
export function computeReanchorTransform(
  transform: { k: number; x: number; y: number },
  previousWidth: number,
  nextWidth: number
): { k: number; x: number; y: number } {
  return {
    k: transform.k,
    x: transform.x + (nextWidth - previousWidth) / 2,
    y: transform.y,
  };
}

// A deliberately loose initial framing for the first paint, before the force
// layout has run. It centers the seeded centroid and scales so the node spread
// occupies `margin` of the smaller viewport dimension, clamped to a sane zoom
// range. Unlike computeFitTransform it does not chase exact bounds — the layout
// is about to change, so a rough frame is enough; the precise fit runs once the
// simulation settles.
export function computeRoughInitialTransform(
  nodes: Array<{ x?: number; y?: number }>,
  viewportWidth: number,
  viewportHeight: number,
  margin = 0.3
): { k: number; x: number; y: number } {
  const positioned = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  if (positioned.length === 0) return { k: 1, x: 0, y: 0 };

  const centroidX = positioned.reduce((sum, n) => sum + n.x!, 0) / positioned.length;
  const centroidY = positioned.reduce((sum, n) => sum + n.y!, 0) / positioned.length;
  let maxRadius = 0;
  for (const n of positioned) {
    maxRadius = Math.max(maxRadius, Math.hypot(n.x! - centroidX, n.y! - centroidY));
  }

  // A single node (or coincident nodes) has no spread — center it at natural size.
  if (maxRadius === 0) {
    return { k: 1, x: viewportWidth / 2 - centroidX, y: viewportHeight / 2 - centroidY };
  }

  const k = Math.max(
    NODE_MIN_ZOOM,
    Math.min(1, (margin * Math.min(viewportWidth, viewportHeight)) / (2 * maxRadius))
  );
  return {
    k,
    x: viewportWidth / 2 - k * centroidX,
    y: viewportHeight / 2 - k * centroidY,
  };
}

// Where a pointer sits in graph coordinates, given the viewport rect it moved
// in and the zoom transform currently applied to the world.
//
// The transform is the whole reason this is a function: the world is scaled and
// panned, so a screen offset is neither a graph offset nor a fixed multiple of
// one. The pan comes off first and is then divided out, because a pan is a
// screen-space distance while a zoom is a ratio.
export function graphPointFromClient(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  transform: { x: number; y: number; k: number }
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - transform.x) / transform.k,
    y: (clientY - rect.top - transform.y) / transform.k,
  };
}

// How far a press on a node may drift, in screen pixels, before it counts as a
// drag rather than a click. Small on purpose: this is the slop that lets a
// click land on a node without the hand being perfectly still, and everything
// past it is the drag the graph has always had.
export const PRESS_SLOP_PX = 4;

// Whether a press has become a drag. The points are graph coordinates — the
// gesture captures the zoom transform when it starts and measures everything
// through it, the way the drag itself does — while the slop is a distance on
// screen, so the zoom is what converts one into the other. A visitor aiming at
// a node at 4× may drift a quarter of a graph unit and still be clicking it.
//
// The boundary is crossed, not met: a press that has moved exactly the slop is
// still a click.
export function isDragGesture(
  press: { x: number; y: number },
  moved: { x: number; y: number },
  transform: { k: number },
  slop = PRESS_SLOP_PX
): boolean {
  return Math.hypot(moved.x - press.x, moved.y - press.y) * transform.k > slop;
}

// How long a camera move the graph makes on its own takes: the settled fit, and
// the re-anchor a layout change asks for. The rough fit is a snap by comparison
// — see planFit — and a gesture's motion is the viewer's, not the graph's.
export const GRAPH_ANIMATION_MS = 500;

// What asked for a fit. The simulation nudges the nodes on every tick, so the
// first one has nothing settled to frame yet, and "end" is the first moment
// there is a resting layout worth fitting.
export type FitTrigger = "first-tick" | "settled";

// A fit to run: snap applies the transform immediately, animate eases into it.
// The mode is a choice rather than a duration, because a zero-length transition
// is not a snap — d3 defers it by a frame, and deferring the first one is
// exactly the unframed flash the rough fit exists to prevent.
export type FitPlan =
  | { mode: "snap"; transform: { k: number; x: number; y: number } }
  | { mode: "animate"; transform: { k: number; x: number; y: number }; durationMs: number };

// The fit to run for a trigger, or null when there should be none at all.
//
// Every part of the decision is here: whether to fit, which framing, and
// whether it animates. The caller applies what it is given and holds no policy
// of its own — which is what makes the rules below assertable without a Pixi
// scene or a running simulation.
export function planFit(
  trigger: FitTrigger,
  context: {
    // Once the viewer has zoomed or panned, the graph is where they put it:
    // neither fit may move it out from under them.
    userInteracted: boolean;
    // A note holding the Focus is the same kind of claim, made by the same
    // visitor: the camera is framing that note's neighbourhood, so a fit that
    // framed the whole graph would take it away from what they asked for.
    focused: boolean;
    nodes: Array<{ x?: number; y?: number }>;
    viewportWidth: number;
    viewportHeight: number;
  }
): FitPlan | null {
  if (context.userInteracted || context.focused) return null;

  const { nodes, viewportWidth, viewportHeight } = context;

  if (trigger === "first-tick") {
    // d3 seeded every node with a phyllotaxis position when the simulation was
    // constructed, so there is already a centroid to frame — but the forces are
    // about to move everything, so only a rough frame is worth drawing. Snapped,
    // not animated: this is the frame the graph is first seen in.
    return {
      mode: "snap",
      transform: computeRoughInitialTransform(nodes, viewportWidth, viewportHeight),
    };
  }

  // The layout has settled, so its real extent is known and unlike the seeded
  // circle it can be framed exactly. Animated, because the graph visibly moved
  // to get here and the viewer should see where it went. Padding is
  // computeFitTransform's own default, so the two cannot drift apart.
  return {
    mode: "animate",
    transform: computeFitTransform(nodes, viewportWidth, viewportHeight),
    durationMs: GRAPH_ANIMATION_MS,
  };
}
