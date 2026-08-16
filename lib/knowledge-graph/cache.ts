import type { KnowledgeGraphResponse } from "./types";

export const KNOWLEDGE_GRAPH_CACHE_KEY = "knowledge-graph";

// Seconds from now until the next UTC midnight. Used as the cache TTL so the
// snapshot expires exactly at midnight and the first request after rebuilds it
// — a lazy daily rotation, no cron required.
export function secondsUntilMidnightUtc(now: Date): number {
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.max(1, Math.ceil((nextMidnightUtc - now.getTime()) / 1000));
}

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

export async function writeCache(
  data: KnowledgeGraphResponse,
  now: Date
): Promise<void> {
  const cache = await getRuntimeCache();
  if (!cache) return;
  try {
    await cache.set(KNOWLEDGE_GRAPH_CACHE_KEY, data, {
      ttl: secondsUntilMidnightUtc(now),
    });
  } catch {
    // Best-effort: a failed cache write must not fail the request — the
    // missing snapshot just means the next request rebuilds it.
  }
}
