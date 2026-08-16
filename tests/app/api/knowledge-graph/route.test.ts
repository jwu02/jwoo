/**
 * @jest-environment node
 */
import { GET } from "@/app/api/knowledge-graph/route";

jest.mock("@/lib/knowledge-graph/db", () => ({
  getNotesCollection: jest.fn(),
}));

jest.mock("@/lib/knowledge-graph/cache", () => ({
  readCache: jest.fn(),
  writeCache: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  // Default: a cache miss, so each test opts into a hit explicitly.
  mockedReadCache.mockResolvedValue(null);
  mockedWriteCache.mockResolvedValue(undefined);
});

describe("GET /api/knowledge-graph", () => {
  it("builds and caches the graph from the notes collection on a cache miss", async () => {
    const toArray = jest.fn().mockResolvedValue(notes);
    mockedGetNotesCollection.mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(builtGraph);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mockedWriteCache).toHaveBeenCalledWith(builtGraph, expect.any(Date));
  });

  it("serves the cached graph without querying the database on a cache hit", async () => {
    const cachedData = {
      nodes: [{ id: "Cached.md", createdAt: "2024-06-01T00:00:00.000Z" }],
      edges: [],
    };
    mockedReadCache.mockResolvedValue(cachedData);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(cachedData);
    expect(mockedGetNotesCollection).not.toHaveBeenCalled();
    expect(mockedWriteCache).not.toHaveBeenCalled();
  });

  it("still serves the graph when the cache write fails", async () => {
    const toArray = jest.fn().mockResolvedValue(notes);
    mockedGetNotesCollection.mockResolvedValue({ find: () => ({ toArray }) });
    mockedWriteCache.mockRejectedValue(new Error("disk full"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(builtGraph);
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
