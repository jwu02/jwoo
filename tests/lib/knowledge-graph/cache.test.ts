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

describe("secondsUntilMidnightUtc", () => {
  it("returns whole seconds from now until the next UTC midnight", async () => {
    const { secondsUntilMidnightUtc } = await loadCacheModule();
    const now = new Date("2026-08-16T15:30:00.000Z");
    expect(secondsUntilMidnightUtc(now)).toBe(8.5 * 3600); // 30600
  });

  it("floors at 1 second for a cache written right before midnight", async () => {
    const { secondsUntilMidnightUtc } = await loadCacheModule();
    const now = new Date("2026-08-16T23:59:59.999Z");
    expect(secondsUntilMidnightUtc(now)).toBe(1);
  });

  it("always targets the next day's midnight, not today's", async () => {
    const { secondsUntilMidnightUtc } = await loadCacheModule();
    // Just past midnight — the window must still be ~24h, not ~0s.
    const now = new Date("2026-08-16T00:00:01.000Z");
    expect(secondsUntilMidnightUtc(now)).toBe(24 * 3600 - 1);
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

  it("writes data with a TTL until the next UTC midnight", async () => {
    const { writeCache } = await loadCacheModule();
    const now = new Date("2026-08-16T15:30:00.000Z");

    await writeCache(sampleData, now);

    expect(fakeCache.set).toHaveBeenCalledWith("knowledge-graph", sampleData, {
      ttl: 30600,
    });
  });

  it("degrades gracefully when getCache is unavailable", async () => {
    mockGetCache.mockImplementation(() => {
      throw new Error("no runtime cache");
    });
    const { readCache, writeCache } = await loadCacheModule();

    expect(await readCache()).toBeNull();
    await expect(writeCache(sampleData, new Date())).resolves.toBeUndefined();
  });
});
