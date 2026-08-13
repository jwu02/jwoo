import { render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphPage from "@/app/knowledge-graph/page";

const mockData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

function fetchMock(data: unknown) {
  return jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  ) as jest.Mock;
}

// The jsdom test environment does not provide `fetch`, so default to a mock
// that returns `mockData`. Individual tests override `global.fetch` as needed
// and `afterEach` restores this default.
global.fetch = fetchMock(mockData);

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("KnowledgeGraphPage", () => {
  it("fetches and renders the graph", async () => {
    const { container } = render(<KnowledgeGraphPage />);

    // The loaded branch renders the Pixi canvas (loading/error/empty branches
    // have no canvas, so this distinguishes loaded from everything else).
    await waitFor(() => {
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/knowledge-graph");
  });

  it("shows a loading state initially", () => {
    render(<KnowledgeGraphPage />);
    expect(screen.getByText(/Loading knowledge graph/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no notes", async () => {
    global.fetch = fetchMock({ nodes: [], edges: [] });

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByText("No notes synced yet.")).toBeInTheDocument();
    });
  });

  it("shows an error banner when the fetch fails", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    ) as jest.Mock;

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load knowledge graph")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders a single-node graph without NaN", async () => {
    global.fetch = fetchMock({
      nodes: [{ id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" }],
      edges: [],
    });

    const { container } = render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });
});
