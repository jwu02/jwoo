/**
 * @jest-environment node
 */
import { buildPayload } from "@/lib/knowledge-graph/payload";
import { KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS } from "@/lib/knowledge-graph/cache";
import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

const graph: KnowledgeGraphResponse = {
  nodes: [{ id: "A.md", createdAt: "2026-08-16T00:00:00.000Z" }],
  edges: [],
};

const cachedAt = "2026-09-14T06:32:00.000Z";
const cachedAtMs = new Date(cachedAt).getTime();

describe("buildPayload", () => {
  it("spreads the graph and reports the cache's age", () => {
    const payload = buildPayload(graph, cachedAt, new Date(cachedAtMs));

    expect(payload.nodes).toEqual(graph.nodes);
    expect(payload.edges).toEqual(graph.edges);
    expect(payload.cachedAt).toBe(cachedAt);
    expect(payload.remainingSeconds).toBe(KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS);
  });

  it("counts down as time passes since the write", () => {
    const payload = buildPayload(
      graph,
      cachedAt,
      new Date(cachedAtMs + 45 * 60 * 1000)
    );

    expect(payload.remainingSeconds).toBe(2 * 60 * 60 + 15 * 60);
  });

  it("never reports negative time once the entry has outlived its TTL", () => {
    const payload = buildPayload(
      graph,
      cachedAt,
      new Date(cachedAtMs + 4 * 60 * 60 * 1000)
    );

    expect(payload.remainingSeconds).toBe(0);
  });

  // A timestamp the server cannot parse would otherwise put NaN through the
  // countdown and leave the page dividing garbage.
  it("falls back to a full TTL when the timestamp is unparseable", () => {
    const payload = buildPayload(graph, "not a date", new Date(cachedAtMs));

    expect(payload.remainingSeconds).toBe(KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS);
  });
});
