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
