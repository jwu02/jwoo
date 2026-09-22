import { computeNeighbors } from "./graph-data";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "./types";

// A node's base appearance, independent of hover. Only leaves are drawn
// distinct from the base tint, so "hub" is the catch-all rather than a claim
// about degree: an isolated node is a hub.
export type NodeRole = "leaf" | "hub";

// What hover does to a node. `idle` is every node while nothing is hovered.
export type HoverState = "idle" | "hovered" | "neighbor" | "dimmed";

export interface NodeEmphasis {
  role: NodeRole;
  hover: HoverState;
}

// The emphasis every node carries for one hover state. Both consumers — the
// sprite painting and the DOM label layer — read this one map, so the dot and
// its name cannot disagree about which nodes a hover is highlighting.
//
// Adjacency comes from the graph's own helper rather than being rebuilt here:
// the nodes this rule keeps bright and the nodes a focus frames are the same
// set, and one definition is what keeps them the same.
export function computeNodeEmphasis(
  nodes: readonly KnowledgeGraphNode[],
  edges: readonly KnowledgeGraphEdge[],
  hoveredId: string | null
): Map<string, NodeEmphasis> {
  // Unique neighbours. A leaf is a node with exactly one of them, which is not
  // the same as degree 1: reciprocal links (A→B and B→A) would otherwise count
  // twice and report a true leaf as a degree-2 hub, hiding its tint.
  const neighbors = computeNeighbors(nodes, edges);

  // Every node is seeded a Set by the helper, so this lookup never misses.
  const hoveredNeighbors = hoveredId === null ? null : neighbors.get(hoveredId);

  const emphasis = new Map<string, NodeEmphasis>();
  for (const node of nodes) {
    let hover: HoverState;
    if (hoveredId === null) hover = "idle";
    else if (node.id === hoveredId) hover = "hovered";
    else if (hoveredNeighbors?.has(node.id)) hover = "neighbor";
    else hover = "dimmed";

    emphasis.set(node.id, {
      role: neighbors.get(node.id)!.size === 1 ? "leaf" : "hub",
      hover,
    });
  }
  return emphasis;
}
