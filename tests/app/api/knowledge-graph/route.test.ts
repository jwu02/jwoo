/**
 * @jest-environment node
 */
import { GET } from "@/app/api/knowledge-graph/route";

jest.mock("@/lib/knowledge-graph/db", () => ({
  getNotesCollection: jest.fn(),
}));

import { getNotesCollection } from "@/lib/knowledge-graph/db";

describe("GET /api/knowledge-graph", () => {
  it("returns nodes and edges from the notes collection", async () => {
    const toArray = jest.fn().mockResolvedValue([
      { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["B.md"] },
      { filename: "B.md", createdAt: new Date("2024-01-02"), links: [] },
    ]);
    (getNotesCollection as jest.Mock).mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      nodes: [
        { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
        { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      ],
      edges: [{ source: "A.md", target: "B.md" }],
    });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("ignores links to missing notes", async () => {
    const toArray = jest.fn().mockResolvedValue([
      { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["Missing.md"] },
    ]);
    (getNotesCollection as jest.Mock).mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET();
    const json = await response.json();

    expect(json.edges).toEqual([]);
  });

  it("returns 500 on database errors", async () => {
    (getNotesCollection as jest.Mock).mockRejectedValue(new Error("db down"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to load knowledge graph");
  });
});
