/**
 * @jest-environment node
 */
import { GET } from "@/app/api/knowledge-graph/route";

// The route's whole job is what it does with a snapshot and with a failure; how
// a snapshot is obtained is the module's own business, covered by
// tests/lib/knowledge-graph/snapshot.test.ts.
jest.mock("@/lib/knowledge-graph/snapshot", () => ({
  loadSnapshot: jest.fn(),
}));

import { loadSnapshot } from "@/lib/knowledge-graph/snapshot";

const mockedLoadSnapshot = loadSnapshot as jest.Mock;

const snapshot = {
  nodes: [{ id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" }],
  edges: [],
  cachedAt: "2026-09-14T06:32:00.000Z",
  remainingSeconds: 3 * 60 * 60,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /api/knowledge-graph", () => {
  it("serves the snapshot, uncached by anything in between", async () => {
    mockedLoadSnapshot.mockResolvedValue(snapshot);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("returns 500 when the snapshot cannot be loaded", async () => {
    mockedLoadSnapshot.mockRejectedValue(new Error("db down"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Failed to load knowledge graph");
  });
});
