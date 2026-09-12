import type { KnowledgeGraphResponse } from "./types";

export const KNOWLEDGE_GRAPH_CACHE_KEY = "knowledge-graph";

// The snapshot lives for three hours from the moment it is written; the first
// request after it expires rebuilds it from MongoDB — a lazy rotation, no cron
// required. The window rolls from the write rather than aligning to 3-hour UTC
// boundaries, so refreshes stagger instead of every instance rebuilding at once.
export const KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS = 3 * 60 * 60;

function isValidGraph(data: unknown): data is KnowledgeGraphResponse {
  if (!data || typeof data !== "object") return false;
  const graph = data as Partial<KnowledgeGraphResponse>;
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges);
}

// The runtime cache from @vercel/functions is only backed by real storage on
// Vercel; locally it may be absent or throw. Everything here is defensive and
// degrades to an uncached request, so dev/test behavior stays unchanged. Once
// initialized the cache object is reused; a failed init is retried per call
// rather than cached as a permanent failure.
let runtimeCache: { get(key: string): Promise<unknown>; set(key: string, value: unknown, opts: { ttl: number }): Promise<void> } | null = null;

async function getRuntimeCache() {
  if (runtimeCache) return runtimeCache;
  try {
    const { getCache } = await import("@vercel/functions");
    runtimeCache = getCache();
    return runtimeCache;
  } catch {
    return null;
  }
}

export async function readCache(): Promise<KnowledgeGraphResponse | null> {
  const cache = await getRuntimeCache();
  if (!cache) return null;
  try {
    const data = await cache.get(KNOWLEDGE_GRAPH_CACHE_KEY);
    return isValidGraph(data) ? data : null;
  } catch {
    return null;
  }
}

export async function writeCache(data: KnowledgeGraphResponse): Promise<void> {
  const cache = await getRuntimeCache();
  if (!cache) return;
  try {
    await cache.set(KNOWLEDGE_GRAPH_CACHE_KEY, data, {
      ttl: KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS,
    });
  } catch {
    // Best-effort: a failed cache write must not fail the request — the
    // missing snapshot just means the next request rebuilds it.
  }
}
