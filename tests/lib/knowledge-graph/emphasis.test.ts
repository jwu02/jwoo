import { computeNodeEmphasis } from "@/lib/knowledge-graph/emphasis";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "@/lib/knowledge-graph/types";

const node = (id: string): KnowledgeGraphNode => ({
  id,
  createdAt: "2024-01-01T00:00:00.000Z",
});

const edge = (source: string, target: string): KnowledgeGraphEdge => ({
  source,
  target,
});

function rolesOf(
  emphasis: Map<string, { role: string }>,
  ids: string[]
): string[] {
  return ids.map((id) => emphasis.get(id)!.role);
}

function hoverOf(
  emphasis: Map<string, { hover: string }>,
  ids: string[]
): string[] {
  return ids.map((id) => emphasis.get(id)!.hover);
}

describe("computeNodeEmphasis roles", () => {
  it("calls a node with one unique neighbour a leaf", () => {
    const emphasis = computeNodeEmphasis(
      [node("A"), node("B")],
      [edge("A", "B")],
      null
    );

    expect(rolesOf(emphasis, ["A", "B"])).toEqual(["leaf", "leaf"]);
  });

  it("calls a reciprocal pair leaves rather than degree-2 hubs", () => {
    // A↔B is two edges but one unique neighbour each. Counting degree would
    // report both as hubs and hide a real leaf's tint.
    const emphasis = computeNodeEmphasis(
      [node("A"), node("B"), node("C")],
      [edge("A", "B"), edge("B", "A"), edge("B", "C")],
      null
    );

    expect(rolesOf(emphasis, ["A", "B", "C"])).toEqual(["leaf", "hub", "leaf"]);
  });

  it("calls a node with two unique neighbours a hub", () => {
    const emphasis = computeNodeEmphasis(
      [node("A"), node("B"), node("C")],
      [edge("A", "B"), edge("B", "C")],
      null
    );

    expect(rolesOf(emphasis, ["A", "B", "C"])).toEqual(["leaf", "hub", "leaf"]);
  });

  it("calls an isolated node a hub, since hub is the catch-all", () => {
    const emphasis = computeNodeEmphasis(
      [node("A"), node("B"), node("Lonely")],
      [edge("A", "B")],
      null
    );

    expect(rolesOf(emphasis, ["Lonely"])).toEqual(["hub"]);
  });
});

describe("computeNodeEmphasis hover", () => {
  const nodes = [node("A"), node("B"), node("C"), node("D")];
  // A—B—C, so B has two neighbours and D is isolated.
  const edges = [edge("A", "B"), edge("B", "C")];

  it("leaves every node idle while nothing is hovered", () => {
    const emphasis = computeNodeEmphasis(nodes, edges, null);

    expect(hoverOf(emphasis, ["A", "B", "C", "D"])).toEqual([
      "idle",
      "idle",
      "idle",
      "idle",
    ]);
  });

  it("marks the hovered node, its neighbours, and dims everything else", () => {
    const emphasis = computeNodeEmphasis(nodes, edges, "B");

    expect(hoverOf(emphasis, ["B", "A", "C", "D"])).toEqual([
      "hovered",
      "neighbor",
      "neighbor",
      "dimmed",
    ]);
  });

  it("dims every other node when the hovered one is isolated", () => {
    // An isolated node has no neighbours, so nothing is spared the dim.
    const emphasis = computeNodeEmphasis(nodes, edges, "D");

    expect(hoverOf(emphasis, ["D", "A", "B", "C"])).toEqual([
      "hovered",
      "dimmed",
      "dimmed",
      "dimmed",
    ]);
  });

  it("keeps the role independent of which node is hovered", () => {
    // Role is a property of the graph, not of the hover: hovering a leaf must
    // not promote it, and hovering a hub must not demote its neighbours.
    const emphasis = computeNodeEmphasis(nodes, edges, "B");
    const idle = computeNodeEmphasis(nodes, edges, null);

    expect(rolesOf(emphasis, ["A", "B", "C", "D"])).toEqual(
      rolesOf(idle, ["A", "B", "C", "D"])
    );
  });
});
