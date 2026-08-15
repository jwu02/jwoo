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

export function getVisibleNodes(
  nodes: KnowledgeGraphNode[],
  currentTime: number
): KnowledgeGraphNode[] {
  return nodes.filter((node) => new Date(node.createdAt).getTime() <= currentTime);
}

export function getVisibleEdges(
  edges: KnowledgeGraphEdge[],
  visibleNodes: KnowledgeGraphNode[]
): KnowledgeGraphEdge[] {
  const ids = new Set(visibleNodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
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

// Zoom transform (scale k + translate x/y) that fits the given positioned
// nodes inside a viewport with `padding` around the edges, clamped to the
// graph's zoom scaleExtent [0.1, 4]. Kept framework-free so it is unit-
// testable; the component wraps the result in a d3.zoomIdentity.
export function computeFitTransform(
  nodes: Array<{ x?: number; y?: number }>,
  viewportWidth: number,
  viewportHeight: number,
  padding = 60
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
    0.1,
    Math.min(4, Math.min(fitW / (contentW || 1), fitH / (contentH || 1)))
  );

  const centerX = minX + contentW / 2;
  const centerY = minY + contentH / 2;
  return {
    k,
    x: viewportWidth / 2 - k * centerX,
    y: viewportHeight / 2 - k * centerY,
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
    0.1,
    Math.min(1, (margin * Math.min(viewportWidth, viewportHeight)) / (2 * maxRadius))
  );
  return {
    k,
    x: viewportWidth / 2 - k * centroidX,
    y: viewportHeight / 2 - k * centroidY,
  };
}

// Node size model — single source of truth for sprite scale, the force-collide
// radius, and the texture resolution the node circles are rasterized at.
export const NODE_BASE_RADIUS = 4;

export function nodeRadius(degree: number): number {
  return NODE_BASE_RADIUS + Math.sqrt(degree);
}

// The two multipliers that can magnify a node past its texture's native pixel
// detail: the d3-zoom scaleExtent max and the hover growth factor.
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
