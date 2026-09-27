import { NODE_MAX_ZOOM } from "./framing";
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
  const maxNodeRadius = Math.max(
    NODE_BASE_RADIUS,
    ...nodes.map((node) => nodeRadius(degrees.get(node.id) ?? 0))
  );
  return Math.ceil(maxNodeRadius * NODE_MAX_ZOOM * NODE_HOVER_SCALE);
}
