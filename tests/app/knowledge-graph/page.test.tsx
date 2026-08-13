import { render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphPage from "@/app/knowledge-graph/page";

const mockData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockData),
  })
) as jest.Mock;

describe("KnowledgeGraphPage", () => {
  it("fetches and renders the graph", async () => {
    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByText(/Knowledge Graph/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/knowledge-graph");
  });

  it("shows a loading state initially", () => {
    render(<KnowledgeGraphPage />);
    expect(screen.getByText(/Loading knowledge graph/i)).toBeInTheDocument();
  });
});
