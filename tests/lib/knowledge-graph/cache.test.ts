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

  it("returns cached data when present", async () => {
    const { readCache } = await loadCacheModule();
    store.set("knowledge-graph", sampleData);

    expect(await readCache()).toEqual(sampleData);
    expect(fakeCache.get).toHaveBeenCalledWith("knowledge-graph");
  });

  it("returns null when the cache is empty", async () => {
    const { readCache } = await loadCacheModule();
    expect(await readCache()).toBeNull();
  });

  it("returns null for a structurally invalid cached value", async () => {
    const { readCache } = await loadCacheModule();
    store.set("knowledge-graph", { nodes: "oops", edges: [] });
    expect(await readCache()).toBeNull();
  });

  it("writes data with a three-hour TTL", async () => {
    const { writeCache } = await loadCacheModule();

    await writeCache(sampleData);

    expect(fakeCache.set).toHaveBeenCalledWith("knowledge-graph", sampleData, {
      ttl: 10800,
    });
  });

  it("degrades gracefully when getCache is unavailable", async () => {
    mockGetCache.mockImplementation(() => {
      throw new Error("no runtime cache");
    });
    const { readCache, writeCache } = await loadCacheModule();

    expect(await readCache()).toBeNull();
    await expect(writeCache(sampleData)).resolves.toBeUndefined();
  });
});
