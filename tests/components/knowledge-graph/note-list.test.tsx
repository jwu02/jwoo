import { fireEvent, render, screen, within } from "@testing-library/react";
import { NoteList } from "@/components/knowledge-graph/note-list";
import { NoteHoverProvider } from "@/components/knowledge-graph/note-hover";
import { NoteFocusProvider } from "@/components/knowledge-graph/note-focus";
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
// Focus is the page's, and arrives as state the list reports on rather than
// keeps — so these tests hand it in and watch which call comes back.
function renderNoteList(
  nodes: KnowledgeGraphNode[] = graph,
  hoveredNote: string | null = null,
  focusedNote: string | null = null
) {
  const setHoveredNote = jest.fn();
  const focusNote = jest.fn();
  const clearFocus = jest.fn();
  const view = render(
    <NoteHoverProvider value={{ hoveredNote, setHoveredNote }}>
      <NoteFocusProvider value={{ focusedNote, focusNote, clearFocus }}>
        <NoteList nodes={nodes} />
      </NoteFocusProvider>
    </NoteHoverProvider>
  );
  return { ...view, setHoveredNote, focusNote, clearFocus };
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

const focusedRow = () =>
  screen
    .getAllByRole("listitem")
    .find((item) => item.hasAttribute("data-focused"));

// The row's own control: what the pointer clicks and what the keyboard reaches.
const rowButton = (title: string) =>
  within(rowByTitle(title)).getByRole("button");

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

  // The control a row offers is a real button, so it is in the tab order and
  // Enter and Space are the platform's rather than something hand-rolled onto
  // the row.
  it("puts a button for each row in the tab order", () => {
    renderNoteList();

    for (const title of ["gamma.md", "beta.md", "alpha.md"]) {
      expect(rowButton(title).tabIndex).toBe(0);
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
    const { setHoveredNote, focusNote, clearFocus, rerender } = renderNoteList(
      graph,
      "gamma.md"
    );

    rerender(
      <NoteHoverProvider value={{ hoveredNote: "gamma.md", setHoveredNote }}>
        <NoteFocusProvider value={{ focusedNote: null, focusNote, clearFocus }}>
          <NoteList nodes={[graph[0]]} />
        </NoteFocusProvider>
      </NoteHoverProvider>
    );

    expect(setHoveredNote).toHaveBeenCalledWith(null);
  });

  // The rows beside it go in the same commit, and each of those owes the graph
  // nothing — only the note actually being hovered may clear the hover.
  it("leaves the hover alone when a different row goes away", () => {
    const { setHoveredNote, focusNote, clearFocus, rerender } = renderNoteList(
      graph,
      "gamma.md"
    );

    rerender(
      <NoteHoverProvider value={{ hoveredNote: "gamma.md", setHoveredNote }}>
        <NoteFocusProvider value={{ focusedNote: null, focusNote, clearFocus }}>
          <NoteList nodes={graph.filter((n) => n.id !== "alpha.md")} />
        </NoteFocusProvider>
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

describe("NoteList rows take the Focus", () => {
  it("takes the focus for the note a row stands for", () => {
    const { focusNote } = renderNoteList();

    fireEvent.click(rowButton("gamma.md"));

    expect(focusNote).toHaveBeenCalledWith("gamma.md");
  });

  // The row that holds the focus is its own way out of it.
  it("lets the focus go when the focused row is clicked again", () => {
    const { focusNote, clearFocus } = renderNoteList(graph, null, "gamma.md");

    fireEvent.click(rowButton("gamma.md"));

    expect(clearFocus).toHaveBeenCalled();
    expect(focusNote).not.toHaveBeenCalled();
  });

  it("takes the focus for a note that is not the focused one", () => {
    const { focusNote, clearFocus } = renderNoteList(graph, null, "gamma.md");

    fireEvent.click(rowButton("alpha.md"));

    expect(focusNote).toHaveBeenCalledWith("alpha.md");
    expect(clearFocus).not.toHaveBeenCalled();
  });

  // The mark is what tells a visitor which note the camera is sitting on, so it
  // is on the focused row and nowhere else.
  it("marks the focused row and no other", () => {
    renderNoteList(graph, null, "beta.md");

    expect(focusedRow()).toBe(rowByTitle("beta.md"));
  });

  it("marks nothing while no note is focused", () => {
    renderNoteList();

    expect(focusedRow()).toBeUndefined();
  });

  it("offers the panel's own way out of the focus", () => {
    const { clearFocus } = renderNoteList(graph, null, "beta.md");

    fireEvent.click(screen.getByRole("button", { name: "Clear focus" }));

    expect(clearFocus).toHaveBeenCalled();
  });

  it("offers no way out while nothing is focused", () => {
    renderNoteList();

    expect(
      screen.queryByRole("button", { name: "Clear focus" })
    ).not.toBeInTheDocument();
  });

  // A focus is the page's, not the row's: narrowing the list is not dismissing
  // anything. The panel's way out stays where it is, so the focus is still
  // reachable from a query that hides its row.
  it("leaves the focus alone when the search hides its row", () => {
    const { clearFocus } = renderNoteList(graph, null, "gamma.md");

    fireEvent.change(searchField(), { target: { value: "alpha" } });

    expect(rowTitles()).toEqual(["alpha.md"]);
    expect(clearFocus).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Clear focus" })
    ).toBeInTheDocument();
  });
});

describe("NoteList search Escape", () => {
  // Escape in the field undoes the query rather than the focus, which is the
  // nearer thing to it — and it marks the key handled, which is how the page
  // knows this Escape has already been answered. fireEvent reports the
  // cancellation as a false return.
  it("clears the query, and takes the key, when there is a query to clear", () => {
    renderNoteList();
    fireEvent.change(searchField(), { target: { value: "gamma" } });

    const notCancelled = fireEvent.keyDown(searchField(), { key: "Escape" });

    expect(searchField()).toHaveValue("");
    expect(rowTitles()).toEqual(["gamma.md", "beta.md", "alpha.md"]);
    expect(notCancelled).toBe(false);
  });

  it("lets the key through when the field has nothing to clear", () => {
    renderNoteList();

    const notCancelled = fireEvent.keyDown(searchField(), { key: "Escape" });

    expect(notCancelled).toBe(true);
  });
});
