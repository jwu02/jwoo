import { fireEvent, render, screen, within } from "@testing-library/react";
import { NoteList } from "@/components/knowledge-graph/note-list";
import type { KnowledgeGraphNode } from "@/lib/knowledge-graph/types";

const node = (id: string, createdAt: string): KnowledgeGraphNode => ({
  id,
  createdAt,
});

const graph = [
  node("alpha.md", "2024-01-01T00:00:00.000Z"),
  node("beta.md", "2024-06-15T12:00:00.000Z"),
  node("gamma.md", "2025-03-02T08:30:00.000Z"),
];

function renderNoteList(nodes: KnowledgeGraphNode[] = graph) {
  return render(<NoteList nodes={nodes} />);
}

const rowTitles = () =>
  screen
    .getAllByRole("listitem")
    .map((row) => within(row).getByTestId("kg-note-title").textContent);

const searchField = () => screen.getByRole("searchbox", { name: /search notes/i });

describe("NoteList", () => {
  it("lists every note newest first", () => {
    renderNoteList();

    expect(rowTitles()).toEqual(["gamma.md", "beta.md", "alpha.md"]);
  });

  it("shows how many notes the graph holds", () => {
    renderNoteList();

    expect(screen.getByText("3 notes")).toBeInTheDocument();
  });

  it("shows the note count for a single-note graph", () => {
    renderNoteList([graph[0]]);

    expect(screen.getByText("1 note")).toBeInTheDocument();
  });

  // The date a note was written was on every row and is on none of them now —
  // the row is the title and nothing else.
  it("shows each note's title and nothing else", () => {
    renderNoteList();

    const row = screen.getAllByRole("listitem")[0];
    expect(within(row).getByTestId("kg-note-title")).toHaveTextContent("gamma.md");
    expect(row).toHaveTextContent(/^gamma\.md$/);
  });
});

describe("NoteList search", () => {
  it("narrows the list to titles containing the query", () => {
    renderNoteList();

    fireEvent.change(searchField(), { target: { value: "amm" } });

    expect(rowTitles()).toEqual(["gamma.md"]);
  });

  it("matches case-insensitively", () => {
    renderNoteList();

    fireEvent.change(searchField(), { target: { value: "ALPHA" } });

    expect(rowTitles()).toEqual(["alpha.md"]);
  });

  it("restores the full list when the query is cleared", () => {
    renderNoteList();
    fireEvent.change(searchField(), { target: { value: "alpha" } });
    expect(rowTitles()).toEqual(["alpha.md"]);

    fireEvent.change(searchField(), { target: { value: "" } });

    expect(rowTitles()).toEqual(["gamma.md", "beta.md", "alpha.md"]);
  });

  it("says so quietly when nothing matches", () => {
    renderNoteList();

    fireEvent.change(searchField(), { target: { value: "delta" } });

    expect(screen.queryAllByRole("listitem")).toEqual([]);
    expect(screen.getByText(/No notes match/i)).toBeInTheDocument();
  });

  it("drops the no-results state once a query matches again", () => {
    renderNoteList();
    fireEvent.change(searchField(), { target: { value: "delta" } });

    fireEvent.change(searchField(), { target: { value: "beta" } });

    expect(screen.queryByText(/No notes match/i)).not.toBeInTheDocument();
    expect(rowTitles()).toEqual(["beta.md"]);
  });

  // The count describes the graph, not the search — narrowing the list is a
  // question asked of the graph, not a change to it.
  it("keeps the note count while the list is filtered", () => {
    renderNoteList();

    fireEvent.change(searchField(), { target: { value: "beta" } });

    expect(screen.getByText("3 notes")).toBeInTheDocument();
  });

  it("shows the search field's own value", () => {
    renderNoteList();

    fireEvent.change(searchField(), { target: { value: "beta" } });

    expect(searchField()).toHaveValue("beta");
  });
});

// Rows carry no interaction in this slice: hovering or clicking one is a
// no-op, and the graph underneath is not told anything.
describe("NoteList rows are inert", () => {
  it("does nothing when a row is hovered or clicked", () => {
    const onError = jest.spyOn(console, "error").mockImplementation(() => {});
    renderNoteList();

    const row = screen.getAllByRole("listitem")[0];
    fireEvent.mouseEnter(row);
    fireEvent.click(row);

    expect(rowTitles()).toEqual(["gamma.md", "beta.md", "alpha.md"]);
    expect(onError).not.toHaveBeenCalled();
    onError.mockRestore();
  });
});
