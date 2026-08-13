import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  NoteDoc,
} from "./types";

export function buildGraph(docs: NoteDoc[]) {
  const nodeIds = new Set(docs.map((doc) => doc.filename));

  const nodes: KnowledgeGraphNode[] = docs
    .map((doc) => ({
      id: doc.filename,
      createdAt: doc.createdAt.toISOString(),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const edges: KnowledgeGraphEdge[] = docs.flatMap((doc) =>
    doc.links
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
