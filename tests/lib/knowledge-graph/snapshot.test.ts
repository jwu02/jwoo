/**
 * @jest-environment node
 */
// The `mock`-prefixed names are what let the factories reference these: Jest
// hoists the factories above the consts but defers calling them until the
// module is first imported, by which time the consts exist. Being stable across
// resets matters because the snapshot module holds a module-level singleton —
// each test reloads a fresh module (jest.resetModules), but they must all
// observe the same mocks.
const mockGetCache = jest.fn();
jest.mock("@vercel/functions", () => ({
  getCache: mockGetCache,
}));

const mockGetNotesCollection = jest.fn();
jest.mock("@/lib/knowledge-graph/db", () => ({
  getNotesCollection: mockGetNotesCollection,
}));

import type { KnowledgeGraphData } from "@/lib/knowledge-graph/types";

async function loadSnapshotModule() {
  jest.resetModules();
  return await import("@/lib/knowledge-graph/snapshot");
}

const notes = [
  { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["B.md"] },
  { filename: "B.md", createdAt: new Date("2024-01-02"), links: [] },
];

const builtGraph: KnowledgeGraphData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

const WRITTEN_AT = "2026-09-14T06:32:00.000Z";
const writtenAtMs = new Date(WRITTEN_AT).getTime();

const THREE_HOURS_SECONDS = 3 * 60 * 60;

// Reading the notes through the collection handle the module reaches for.
function notesReadable(docs: unknown[] = notes) {
  const toArray = jest.fn().mockResolvedValue(docs);
  mockGetNotesCollection.mockResolvedValue({ find: () => ({ toArray }) });
}

describe("loadSnapshot", () => {
  let store: Map<string, unknown>;
  let fakeCache: { get: jest.Mock; set: jest.Mock };

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
    notesReadable();
  });

  describe("the window it reports", () => {
    // The window is deliberately not exported, so these pin it by behaviour:
    // the two readings bracketing three hours are what say it is three hours.
    it("counts down as time passes since the write", async () => {
      store.set("knowledge-graph", { graph: builtGraph, cachedAt: WRITTEN_AT });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(
        new Date(writtenAtMs + 45 * 60 * 1000)
      );

      expect(snapshot.remainingSeconds).toBe(2 * 60 * 60 + 15 * 60);
    });

    it("still has a second left one second before the window closes", async () => {
      store.set("knowledge-graph", { graph: builtGraph, cachedAt: WRITTEN_AT });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(
        new Date(writtenAtMs + THREE_HOURS_SECONDS * 1000 - 1000)
      );

      expect(snapshot.remainingSeconds).toBe(1);
    });

    it("never reports negative time once the entry has outlived its window", async () => {
      store.set("knowledge-graph", { graph: builtGraph, cachedAt: WRITTEN_AT });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(
        new Date(writtenAtMs + 4 * 60 * 60 * 1000)
      );

      expect(snapshot.remainingSeconds).toBe(0);
    });

    // A timestamp the server cannot parse would otherwise put NaN through the
    // countdown and leave the page dividing garbage.
    it("falls back to a full window when the timestamp is unparseable", async () => {
      store.set("knowledge-graph", { graph: builtGraph, cachedAt: "not a date" });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(snapshot.remainingSeconds).toBe(THREE_HOURS_SECONDS);
    });
  });

  describe("serving a cached entry", () => {
    it("serves it with its own provenance, without reading the notes", async () => {
      store.set("knowledge-graph", { graph: builtGraph, cachedAt: WRITTEN_AT });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(snapshot).toEqual({
        ...builtGraph,
        cachedAt: WRITTEN_AT,
        remainingSeconds: THREE_HOURS_SECONDS,
      });
      expect(mockGetNotesCollection).not.toHaveBeenCalled();
      expect(fakeCache.set).not.toHaveBeenCalled();
    });

    it("ignores a structurally invalid cached graph", async () => {
      store.set("knowledge-graph", {
        graph: { nodes: "oops", edges: [] },
        cachedAt: WRITTEN_AT,
      });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(snapshot.nodes).toEqual(builtGraph.nodes);
      expect(mockGetNotesCollection).toHaveBeenCalled();
    });

    it("ignores an entry carrying no timestamp", async () => {
      store.set("knowledge-graph", { graph: builtGraph });
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(mockGetNotesCollection).toHaveBeenCalled();
      expect(snapshot.cachedAt).toBe(new Date(writtenAtMs).toISOString());
    });

    // Entries written before the timestamp existed have the bare graph shape.
    // Rejecting them costs one rebuild on the first request after a deploy and
    // spares every reader a branch for a shape nothing writes any more.
    it("ignores a pre-timestamp entry holding the bare graph", async () => {
      store.set("knowledge-graph", builtGraph);
      const { loadSnapshot } = await loadSnapshotModule();

      await loadSnapshot(new Date(writtenAtMs));

      expect(mockGetNotesCollection).toHaveBeenCalled();
    });
  });

  describe("building and caching on a miss", () => {
    it("reads the notes, builds the graph and caches it under its window", async () => {
      const { loadSnapshot } = await loadSnapshotModule();
      const now = new Date(writtenAtMs);

      const snapshot = await loadSnapshot(now);

      expect(snapshot).toEqual({
        ...builtGraph,
        cachedAt: WRITTEN_AT,
        remainingSeconds: THREE_HOURS_SECONDS,
      });
      expect(fakeCache.set).toHaveBeenCalledWith(
        "knowledge-graph",
        { graph: builtGraph, cachedAt: WRITTEN_AT },
        { ttl: THREE_HOURS_SECONDS }
      );
    });

    it("still serves the graph when the cache write fails", async () => {
      fakeCache.set.mockRejectedValue(new Error("disk full"));
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(snapshot.nodes).toEqual(builtGraph.nodes);
      expect(snapshot.remainingSeconds).toBe(THREE_HOURS_SECONDS);
    });

    it("drops links to notes that are not in the graph", async () => {
      notesReadable([
        { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["Missing.md"] },
      ]);
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(snapshot.edges).toEqual([]);
    });

    // A note without a creation date cannot be placed on the timeline, and its
    // links would be dangling without a source node.
    it("skips malformed notes rather than failing the whole snapshot", async () => {
      notesReadable([
        { filename: "A.md", createdAt: new Date("2024-01-01"), links: [] },
        { filename: "Broken.md", links: [] },
      ]);
      const { loadSnapshot } = await loadSnapshotModule();

      const snapshot = await loadSnapshot(new Date(writtenAtMs));

      expect(snapshot.nodes.map((node) => node.id)).toEqual(["A.md"]);
    });

    it("propagates a failure to read the notes", async () => {
      mockGetNotesCollection.mockRejectedValue(new Error("db down"));
      const { loadSnapshot } = await loadSnapshotModule();

      await expect(loadSnapshot(new Date(writtenAtMs))).rejects.toThrow("db down");
    });
  });

  // The runtime cache is only backed by real storage on Vercel; everywhere else
  // the module has to degrade to an uncached request rather than throw.
  it("degrades gracefully when getCache is unavailable", async () => {
    mockGetCache.mockImplementation(() => {
      throw new Error("no runtime cache");
    });
    const { loadSnapshot } = await loadSnapshotModule();

    const snapshot = await loadSnapshot(new Date(writtenAtMs));

    expect(snapshot.nodes).toEqual(builtGraph.nodes);
    expect(snapshot.cachedAt).toBe(WRITTEN_AT);
  });
});
