/**
 * @jest-environment node
 */
import { GET } from "@/app/api/knowledge-graph/route";

jest.mock("@/lib/knowledge-graph/db", () => ({
  getNotesCollection: jest.fn(),
}));

// The TTL the route stamps into every payload comes from the real module: it
// is a constant, and mocking it would let the test and the route drift apart
// on the one number that decides when the page refreshes.
jest.mock("@/lib/knowledge-graph/cache", () => ({
  readCache: jest.fn(),
  writeCache: jest.fn(),
  KNOWLEDGE_GRAPH_CACHE_TTL_SECONDS: 3 * 60 * 60,
}));

import { getNotesCollection } from "@/lib/knowledge-graph/db";
import { readCache, writeCache } from "@/lib/knowledge-graph/cache";

const mockedGetNotesCollection = getNotesCollection as jest.Mock;
const mockedReadCache = readCache as jest.Mock;
const mockedWriteCache = writeCache as jest.Mock;

const notes = [
  { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["B.md"] },
  { filename: "B.md", createdAt: new Date("2024-01-02"), links: [] },
];

const builtGraph = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

const TTL_SECONDS = 3 * 60 * 60;

// Pinned so the route's `new Date()` produces a payload the test can assert on
// exactly, instead of one whose TTL has drifted a few milliseconds by the time
// the assertion runs.
const NOW = new Date("2026-09-14T06:32:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  // Default: a cache miss, so each test opts into a hit explicitly.
  mockedReadCache.mockResolvedValue(null);
  mockedWriteCache.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("GET /api/knowledge-graph", () => {
  it("builds and caches the graph from the notes collection on a cache miss", async () => {
    const toArray = jest.fn().mockResolvedValue(notes);
    mockedGetNotesCollection.mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ...builtGraph,
      cachedAt: NOW.toISOString(),
      remainingSeconds: TTL_SECONDS,
    });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mockedWriteCache).toHaveBeenCalledWith(
      builtGraph,
      NOW.toISOString()
    );
  });

  it("serves the cached graph without querying the database on a cache hit", async () => {
    const cachedData = {
      nodes: [{ id: "Cached.md", createdAt: "2024-06-01T00:00:00.000Z" }],
      edges: [],
    };
    mockedReadCache.mockResolvedValue({
      graph: cachedData,
      cachedAt: "2026-09-14T05:32:00.000Z",
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ...cachedData,
      cachedAt: "2026-09-14T05:32:00.000Z",
      remainingSeconds: TTL_SECONDS - 60 * 60,
    });
    expect(mockedGetNotesCollection).not.toHaveBeenCalled();
    expect(mockedWriteCache).not.toHaveBeenCalled();
  });

  // The runtime cache can drop an entry before its TTL elapses. Serving one
  // that has technically outlived its window must not put a negative countdown
  // in front of the viewer.
  it("clamps the countdown at zero for an entry past its TTL", async () => {
    mockedReadCache.mockResolvedValue({
      graph: { nodes: [], edges: [] },
      cachedAt: "2026-09-14T02:00:00.000Z",
    });

    const json = await (await GET()).json();

    expect(json.remainingSeconds).toBe(0);
  });

  it("still serves the graph when the cache write fails", async () => {
    const toArray = jest.fn().mockResolvedValue(notes);
    mockedGetNotesCollection.mockResolvedValue({ find: () => ({ toArray }) });
    mockedWriteCache.mockRejectedValue(new Error("disk full"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.nodes).toEqual(builtGraph.nodes);
  });

  it("ignores links to missing notes", async () => {
    const toArray = jest.fn().mockResolvedValue([
      { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["Missing.md"] },
    ]);
    mockedGetNotesCollection.mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET();
    const json = await response.json();

    expect(json.edges).toEqual([]);
  });

  it("returns 500 on database errors", async () => {
    mockedGetNotesCollection.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to load knowledge graph");
  });
});
