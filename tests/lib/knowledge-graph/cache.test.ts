/**
 * @jest-environment node
 */
// The `mock`-prefixed name is what lets the factory reference it: Jest hoists
// the factory above this const but defers calling it until the module is first
// imported, by which time the const exists. Being stable across resets matters
// because the cache module holds a module-level singleton — each test reloads
// a fresh module (jest.resetModules), but they must all observe the same mock.
const mockGetCache = jest.fn();
jest.mock("@vercel/functions", () => ({
  getCache: mockGetCache,
}));

import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

async function loadCacheModule() {
  jest.resetModules();
  return await import("@/lib/knowledge-graph/cache");
}

describe("KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS", () => {
  it("is three hours", async () => {
    const { KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS } = await loadCacheModule();
    expect(KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS).toBe(3 * 60 * 60);
  });
});

describe("runtime-cache-backed graph cache", () => {
  let store: Map<string, unknown>;
  let fakeCache: {
    get: jest.Mock;
    set: jest.Mock;
  };

  const sampleData: KnowledgeGraphResponse = {
    nodes: [{ id: "A.md", createdAt: "2026-08-16T00:00:00.000Z" }],
    edges: [],
  };
  const sampleCachedAt = "2026-09-14T06:32:00.000Z";

  beforeEach(() => {
    jest.clearAllMocks();
    store = new Map();
    fakeCache = {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    };
    mockGetCache.mockReturnValue(fakeCache);
  });

  it("returns the cached entry, timestamp included, when present", async () => {
    const { readCache } = await loadCacheModule();
    store.set("knowledge-graph", { graph: sampleData, cachedAt: sampleCachedAt });

    expect(await readCache()).toEqual({
      graph: sampleData,
      cachedAt: sampleCachedAt,
    });
    expect(fakeCache.get).toHaveBeenCalledWith("knowledge-graph");
  });

  it("returns null when the cache is empty", async () => {
    const { readCache } = await loadCacheModule();
    expect(await readCache()).toBeNull();
  });

  it("returns null for a structurally invalid cached value", async () => {
    const { readCache } = await loadCacheModule();
    store.set("knowledge-graph", {
      graph: { nodes: "oops", edges: [] },
      cachedAt: sampleCachedAt,
    });
    expect(await readCache()).toBeNull();
  });

  it("returns null when the entry carries no timestamp", async () => {
    const { readCache } = await loadCacheModule();
    store.set("knowledge-graph", { graph: sampleData });
    expect(await readCache()).toBeNull();
  });

  // Entries written before the timestamp existed have the bare graph shape.
  // Rejecting them costs one rebuild on the first request after a deploy and
  // spares every reader a branch for a shape nothing writes any more.
  it("returns null for a pre-timestamp entry holding the bare graph", async () => {
    const { readCache } = await loadCacheModule();
    store.set("knowledge-graph", sampleData);
    expect(await readCache()).toBeNull();
  });

  it("writes the graph with its timestamp under a three-hour TTL", async () => {
    const { writeCache } = await loadCacheModule();

    await writeCache(sampleData, sampleCachedAt);

    expect(fakeCache.set).toHaveBeenCalledWith(
      "knowledge-graph",
      { graph: sampleData, cachedAt: sampleCachedAt },
      { ttl: 10800 }
    );
  });

  it("degrades gracefully when getCache is unavailable", async () => {
    mockGetCache.mockImplementation(() => {
      throw new Error("no runtime cache");
    });
    const { readCache, writeCache } = await loadCacheModule();

    expect(await readCache()).toBeNull();
    await expect(writeCache(sampleData, sampleCachedAt)).resolves.toBeUndefined();
  });
});
