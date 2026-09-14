import { KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS } from "./cache";
import type { KnowledgeGraphPayload, KnowledgeGraphResponse } from "./types";

// Turns a graph and its write time into the shape the page renders. Pure, with
// the clock injected, so the countdown can be pinned in tests rather than
// raced.
export function buildPayload(
  graph: KnowledgeGraphResponse,
  cachedAt: string,
  now: Date
): KnowledgeGraphPayload {
  const writtenAtMs = new Date(cachedAt).getTime();
  const expiresAtMs = writtenAtMs + KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS * 1000;

  // A cache entry we wrote always parses; a hand-edited or corrupted one might
  // not, and NaN would propagate into the page's countdown. Treating it as
  // freshly written shows a full TTL, which is the safest thing to promise.
  const remainingSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.round((expiresAtMs - now.getTime()) / 1000))
    : KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS;

  return { ...graph, cachedAt, remainingSeconds };
}
