import { render, screen, waitFor } from "@testing-library/react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

describe("ForceGraph", () => {
  it("renders visible nodes and edges", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(2);
      expect(container.querySelectorAll("line").length).toBe(1);
    });
  });

  it("does not render nodes created after current time", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges: { source: string; target: string }[] = [];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(1);
    });
  });
});
