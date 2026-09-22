import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  NoteDoc,
} from "./types";

export function buildGraph(docs: NoteDoc[]) {
  // Skip malformed docs (e.g. missing `createdAt`) instead of letting the
  // whole graph 500. A doc without a creation date cannot be placed on the
  // timeline, and its links would be dangling without a source node.
  const validDocs = docs.filter((doc) => doc.createdAt instanceof Date);
  const nodeIds = new Set(validDocs.map((doc) => doc.filename));

  const nodes: KnowledgeGraphNode[] = validDocs
    .map((doc) => ({
      id: doc.filename,
      createdAt: doc.createdAt.toISOString(),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const edges: KnowledgeGraphEdge[] = validDocs.flatMap((doc) =>
    (doc.links ?? [])
      .filter((target) => nodeIds.has(target))
      .map((target) => ({ source: doc.filename, target }))
  );

  return { nodes, edges };
}

// Who each node sits next to, both ends of an edge claiming the other. A
// reciprocal pair (A→B and B→A) is one relationship rather than two, so the set
// counts it once — which is what makes "the neighbours" the same set whether a
// note is being framed by a focus or kept bright by a hover.
export function computeNeighbors(
  nodes: readonly { id: string }[],
  edges: readonly KnowledgeGraphEdge[]
): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  for (const node of nodes) neighbors.set(node.id, new Set());
  for (const edge of edges) {
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }
  return neighbors;
}

export function computeDegrees(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[]
): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of nodes) {
    degrees.set(node.id, 0);
  }
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

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

// The framing the camera flies to when a note takes the Focus: the note and its
// neighbours, padded and clamped like any other framing. Deliberately not the
// whole graph — seeing the note in its company is the point of focusing it.
//
// A note with no neighbours has no extent to frame, so it lands at natural
// scale centered on itself, the same rule the whole-graph fit uses for a graph
// of one node. Null when there is nothing to aim at: a note the graph does not
// hold, or one the layout has not placed yet.
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
  return fitPoints(framed, viewportWidth, viewportHeight, padding);
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

// Above this zoom, every node shows its name instead of only the hovered one.
// Below it the graph is too dense for the labels to read, so they would be
// noise; the value is inside the zoom scaleExtent [0.1, 4] so it is reachable.
//
// A node id is already the note's own title — the API serves the notes
// collection's `filename` field, which holds a human-readable name rather than
// a vault path. Labels draw the id verbatim; there is nothing to strip.
export const LABEL_ZOOM_THRESHOLD = 1.5;

// Node size model — single source of truth for sprite scale, the force-collide
// radius, and the texture resolution the node circles are rasterized at.
export const NODE_BASE_RADIUS = 4;

export function nodeRadius(degree: number): number {
  return NODE_BASE_RADIUS + Math.sqrt(degree);
}

// The zoom range the graph is clamped to — the d3-zoom scaleExtent, and the
// bounds every fit helper clamps to. One definition, so a change here cannot
// leave the fit helpers and the gesture disagreeing about the reachable range.
export const NODE_MIN_ZOOM = 0.1;
export const NODE_MAX_ZOOM = 4;
export const NODE_HOVER_SCALE = 1.3;

// Radius the shared node circle texture must be rasterized at so no sprite is
// ever scaled past its native pixel detail. The world transform zooms up to
// NODE_MAX_ZOOM and hover grows a node by NODE_HOVER_SCALE; a circle rasterized
// smaller than the worst-case on-screen size is magnified, and its upscaled
// edge reads as pixelated / non-round.
export function computeNodeTextureRadius(
  nodes: Array<{ id: string }>,
  degrees: Map<string, number>
): number {
  let maxNodeRadius = NODE_BASE_RADIUS;
  for (const node of nodes) {
    maxNodeRadius = Math.max(maxNodeRadius, nodeRadius(degrees.get(node.id) ?? 0));
  }
  return Math.ceil(maxNodeRadius * NODE_MAX_ZOOM * NODE_HOVER_SCALE);
}
