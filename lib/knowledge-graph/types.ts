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

export interface KnowledgeGraphResponse {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}
