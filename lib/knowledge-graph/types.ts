export interface NoteDoc {
  filename: string;
  createdAt: Date;
  links: string[];
}

export interface KnowledgeGraphNode {
  id: string;
  createdAt: string;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
}

// The graph itself: the nodes and edges as one set, as the builder produces it,
// the cache stores it and the renderer draws it. Held apart from the provenance
// below because everything downstream of the API deals in the graph alone —
// and because a snapshot is a graph plus that provenance, not a different kind
// of graph.
export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

// The wire format: the graph plus the provenance the page needs to say how old
// the snapshot is and when to ask for a newer one. The graph alone stays the
// currency of the builder and the cache — only the API response carries this.
export interface KnowledgeGraphPayload extends KnowledgeGraphData {
  // When the snapshot was written, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // TTL left at response time, clamped at zero. A duration rather than a
  // deadline so a client with a skewed clock still counts down correctly.
  remainingSeconds: number;
}
