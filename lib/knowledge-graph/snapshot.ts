import { getNotesCollection } from "./db";
import { buildGraph } from "./graph-data";
import type { KnowledgeGraphData, KnowledgeGraphSnapshot } from "./types";

// A snapshot lives for three hours from the moment it is written; the first
// request after it expires rebuilds it from MongoDB — a lazy rotation, no cron
// required. The window rolls from the write rather than aligning to 3-hour UTC
// boundaries, so refreshes stagger instead of every instance rebuilding at once.
//
// Not exported: the window is the module's own business. Callers read it back
// as a countdown on the snapshot they are handed.
const TTL_SECONDS = 3 * 60 * 60;

const CACHE_KEY = "knowledge-graph";

// What the cache holds: the graph plus the moment it was written. The TTL is
// deliberately not stored — a deadline on the entry would be a second copy of
// the window, free to drift from this one. Only the write time is remembered,
// and every countdown is derived from it.
interface CachedSnapshot {
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
function isCachedSnapshot(data: unknown): data is CachedSnapshot {
  if (!data || typeof data !== "object") return false;
  const entry = data as Partial<CachedSnapshot>;
  return typeof entry.cachedAt === "string" && isValidGraph(entry.graph);
}

// The runtime cache from @vercel/functions is only backed by real storage on
// Vercel; locally it may be absent or throw. Everything here is defensive and
// degrades to an uncached request, so dev/test behavior stays unchanged. Once
// initialized the cache object is reused; a failed init is retried per call
// rather than cached as a permanent failure.
let runtimeCache: {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts: { ttl: number }): Promise<void>;
} | null = null;

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

async function readCache(): Promise<CachedSnapshot | null> {
  const cache = await getRuntimeCache();
  if (!cache) return null;
  try {
    const data = await cache.get(CACHE_KEY);
    return isCachedSnapshot(data) ? data : null;
  } catch {
    return null;
  }
}

async function writeCache(
  graph: KnowledgeGraphData,
  cachedAt: string
): Promise<void> {
  const cache = await getRuntimeCache();
  if (!cache) return;
  try {
    await cache.set(CACHE_KEY, { graph, cachedAt } satisfies CachedSnapshot, {
      ttl: TTL_SECONDS,
    });
  } catch {
    // Best-effort: a failed cache write must not fail the request — the
    // missing snapshot just means the next request rebuilds it.
  }
}

// The one place the window is turned into a countdown. Clamped at zero, because
// the runtime cache can drop an entry before its TTL elapses and a snapshot
// that has outlived its window must not put a negative countdown in front of
// the viewer.
//
// A cache entry we wrote always parses; a hand-edited or corrupted one might
// not, and NaN would propagate into the page's countdown. Treating it as
// freshly written shows a full window, which is the safest thing to promise.
function remainingSecondsAt(cachedAt: string, now: Date): number {
  const expiresAtMs = new Date(cachedAt).getTime() + TTL_SECONDS * 1000;
  return Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.round((expiresAtMs - now.getTime()) / 1000))
    : TTL_SECONDS;
}

// The one way a snapshot is obtained. Hit or miss is this module's business:
// the caller asks for a snapshot and gets one, stamped with when it was written
// and how long it has left.
//
// `now` is injected the way the telemetry aggregations inject theirs, so the
// stamp and the countdown derived from it are pinnable in tests.
export async function loadSnapshot(
  now: Date = new Date()
): Promise<KnowledgeGraphSnapshot> {
  const cached = await readCache();
  if (cached) {
    return {
      ...cached.graph,
      cachedAt: cached.cachedAt,
      remainingSeconds: remainingSecondsAt(cached.cachedAt, now),
    };
  }

  const collection = await getNotesCollection();
  const docs = await collection.find({}).toArray();
  const graph: KnowledgeGraphData = buildGraph(docs);
  const cachedAt = now.toISOString();

  await writeCache(graph, cachedAt);

  return { ...graph, cachedAt, remainingSeconds: TTL_SECONDS };
}
