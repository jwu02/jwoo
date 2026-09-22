import { fireEvent, render, screen, within } from "@testing-library/react";
import { NoteList } from "@/components/knowledge-graph/note-list";
import { NoteHoverProvider } from "@/components/knowledge-graph/note-hover";
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

// Stands in for the renderer, which is where hover lives: the list drives it
// and reads back what it is told, exactly as the page wires the two together.
function renderNoteList(
  nodes: KnowledgeGraphNode[] = graph,
  hoveredNote: string | null = null
) {
  const setHoveredNote = jest.fn();
  const view = render(
    <NoteHoverProvider value={{ hoveredNote, setHoveredNote }}>
      <NoteList nodes={nodes} />
    </NoteHoverProvider>
  );
  return { ...view, setHoveredNote };
}

const rowByTitle = (title: string) =>
  screen
    .getAllByRole("listitem")
    .find(
      (item) => within(item).getByTestId("kg-note-title").textContent === title
    )!;

const emphasizedRow = () =>
  screen
    .getAllByRole("listitem")
    .find((item) => item.hasAttribute("data-hovered"));

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

describe("NoteList rows drive the graph's hover", () => {
  it("emphasizes a row's node when its pointer arrives", () => {
    const { setHoveredNote } = renderNoteList();

    fireEvent.pointerEnter(rowByTitle("gamma.md"));

    expect(setHoveredNote).toHaveBeenCalledWith("gamma.md");
  });

  it("clears the emphasis when the pointer leaves the row", () => {
    const { setHoveredNote } = renderNoteList();

    const row = rowByTitle("gamma.md");
    fireEvent.pointerEnter(row);
    fireEvent.pointerLeave(row);

    expect(setHoveredNote).toHaveBeenLastCalledWith(null);
  });

  // A row is reachable by Tab, so the graph's emphasis has to be reachable
  // without a pointer too.
  it("emphasizes a row's node when the row takes focus", () => {
    const { setHoveredNote } = renderNoteList();

    fireEvent.focus(rowByTitle("beta.md"));

    expect(setHoveredNote).toHaveBeenCalledWith("beta.md");
  });

  it("clears the emphasis when focus leaves the row", () => {
    const { setHoveredNote } = renderNoteList();

    const row = rowByTitle("beta.md");
    fireEvent.focus(row);
    fireEvent.blur(row);

    expect(setHoveredNote).toHaveBeenLastCalledWith(null);
  });

  it("puts its rows in the tab order", () => {
    renderNoteList();

    for (const row of screen.getAllByRole("listitem")) {
      expect(row).toHaveAttribute("tabindex", "0");
    }
  });

  // Emphasis travels the other way too: a node hovered in the graph gives the
  // row that stands for it the same Emphasis.
  it("emphasizes the hovered note's row", () => {
    renderNoteList(graph, "beta.md");

    expect(emphasizedRow()).toBe(rowByTitle("beta.md"));
  });

  it("emphasizes no row while no note is hovered", () => {
    renderNoteList();

    expect(emphasizedRow()).toBeUndefined();
  });

  // The list answers the graph about the notes it is still showing. A row the
  // search has taken away is not one of them.
  it("leaves a filtered-out row unemphasized when its node is hovered", () => {
    renderNoteList(graph, "gamma.md");

    fireEvent.change(searchField(), { target: { value: "alpha" } });

    expect(rowTitles()).toEqual(["alpha.md"]);
    expect(emphasizedRow()).toBeUndefined();
  });

  // A row can vanish under the pointer, and React fires neither pointerleave
  // nor blur on an unmount — so the emphasis has to be given up by the row
  // that is going away, or the graph keeps emphasizing a note with no row.
  it("gives up the hover when the hovered row is filtered away", () => {
    const { setHoveredNote, rerender } = renderNoteList(graph, "gamma.md");

    rerender(
      <NoteHoverProvider value={{ hoveredNote: "gamma.md", setHoveredNote }}>
        <NoteList nodes={[graph[0]]} />
      </NoteHoverProvider>
    );

    expect(setHoveredNote).toHaveBeenCalledWith(null);
  });

  // The rows beside it go in the same commit, and each of those owes the graph
  // nothing — only the note actually being hovered may clear the hover.
  it("leaves the hover alone when a different row goes away", () => {
    const { setHoveredNote, rerender } = renderNoteList(graph, "gamma.md");

    rerender(
      <NoteHoverProvider value={{ hoveredNote: "gamma.md", setHoveredNote }}>
        <NoteList nodes={graph.filter((n) => n.id !== "alpha.md")} />
      </NoteHoverProvider>
    );

    expect(setHoveredNote).not.toHaveBeenCalled();
  });

  // Emphasizing a row is not a reason to move the list under the viewer:
  // their reading position is theirs.
  it("never scrolls the list when a row is hovered", () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderNoteList(graph, "gamma.md");

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).toBe(scrollIntoView);
  });
});
