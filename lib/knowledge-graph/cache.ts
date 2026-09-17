import type { KnowledgeGraphData } from "./types";

export const KNOWLEDGE_GRAPH_CACHE_KEY = "knowledge-graph";

// The snapshot lives for three hours from the moment it is written; the first
// request after it expires rebuilds it from MongoDB — a lazy rotation, no cron
// required. The window rolls from the write rather than aligning to 3-hour UTC
// boundaries, so refreshes stagger instead of every instance rebuilding at once.
export const KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS = 3 * 60 * 60;

// The snapshot travels with the moment it was built, so the page can show how
// old it is and how long the cache has left. The TTL itself is the cache's
// business; only the write time is ours to remember.
export interface CachedGraph {
  graph: KnowledgeGraphData;
  cachedAt: string;
}

function isValidGraph(data: unknown): data is KnowledgeGraphData {
  if (!data || typeof data !== "object") return false;
  const graph = data as Partial<KnowledgeGraphData>;
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges);
}

// Entries written before the timestamp existed hold the bare graph. They fail
// this check and read as a miss, which costs one rebuild on the first request
// after a deploy — cheaper than a branch every reader would carry forever.
function isCachedGraph(data: unknown): data is CachedGraph {
  if (!data || typeof data !== "object") return false;
  const entry = data as Partial<CachedGraph>;
  return typeof entry.cachedAt === "string" && isValidGraph(entry.graph);
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

export async function readCache(): Promise<CachedGraph | null> {
  const cache = await getRuntimeCache();
  if (!cache) return null;
  try {
    const data = await cache.get(KNOWLEDGE_GRAPH_CACHE_KEY);
    return isCachedGraph(data) ? data : null;
  } catch {
    return null;
  }
}

export async function writeCache(
  graph: KnowledgeGraphData,
  cachedAt: string
): Promise<void> {
  const cache = await getRuntimeCache();
  if (!cache) return;
  try {
    await cache.set(
      KNOWLEDGE_GRAPH_CACHE_KEY,
      { graph, cachedAt } satisfies CachedGraph,
      { ttl: KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS }
    );
  } catch {
    // Best-effort: a failed cache write must not fail the request — the
    // missing snapshot just means the next request rebuilds it.
  }
}
