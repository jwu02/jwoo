import { buildNoteList, filterNotes } from "@/lib/knowledge-graph/note-list";
import type { KnowledgeGraphNode } from "@/lib/knowledge-graph/types";

const node = (id: string, createdAt: string): KnowledgeGraphNode => ({
  id,
  createdAt,
});

// The graph arrives oldest→newest, so the fixtures below do too — the list is
// what reverses them.
const oldest = node("alpha.md", "2024-01-01T00:00:00.000Z");
const middle = node("beta.md", "2024-06-15T12:00:00.000Z");
const newest = node("gamma.md", "2025-03-02T08:30:00.000Z");
const graph = [oldest, middle, newest];

const titles = (rows: { title: string }[]) => rows.map((row) => row.title);

describe("buildNoteList", () => {
  it("renders the newest note first", () => {
    expect(titles(buildNoteList(graph))).toEqual([
      "gamma.md",
      "beta.md",
      "alpha.md",
    ]);
  });

  it("takes the note's title from its node id", () => {
    expect(buildNoteList(graph)[0].title).toBe("gamma.md");
  });

  // A row is its title. The panel shows no date, so the row carries none.
  it("carries nothing but the title", () => {
    expect(Object.keys(buildNoteList(graph)[0])).toEqual(["title"]);
  });

  it("reads an empty graph as an empty list", () => {
    expect(buildNoteList([])).toEqual([]);
  });

  it("leaves the graph it was given untouched", () => {
    const nodes = [...graph];
    buildNoteList(nodes);

    expect(nodes).toEqual(graph);
  });

  it("orders notes sharing a creation date the way the graph has them", () => {
    const sameDay = [
      node("first.md", "2024-05-05T00:00:00.000Z"),
      node("second.md", "2024-05-05T00:00:00.000Z"),
    ];

    expect(titles(buildNoteList(sameDay))).toEqual(["second.md", "first.md"]);
  });
});

// Row order is the list's own business here, so the assertions below read the
// titles back directly rather than through `buildNoteList`.
const rows = buildNoteList(graph);

describe("filterNotes", () => {
  it("matches a title substring", () => {
    expect(titles(filterNotes(rows, "amma"))).toEqual(["gamma.md"]);
  });

  it("ignores case on both sides", () => {
    expect(titles(filterNotes(rows, "ALPHA"))).toEqual(["alpha.md"]);
    expect(titles(filterNotes(rows, "Gamma.md"))).toEqual(["gamma.md"]);
  });

  it("keeps every match, not just the first", () => {
    const matching = buildNoteList([
      node("note-one.md", "2024-01-01T00:00:00.000Z"),
      node("note-two.md", "2024-01-02T00:00:00.000Z"),
      node("other.md", "2024-01-03T00:00:00.000Z"),
    ]);

    expect(titles(filterNotes(matching, "note"))).toEqual([
      "note-two.md",
      "note-one.md",
    ]);
  });

  it("returns the whole list for an empty query", () => {
    expect(titles(filterNotes(rows, ""))).toEqual(titles(rows));
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(titles(filterNotes(rows, "  beta  "))).toEqual(["beta.md"]);
  });

  // Otherwise the list would jump to its no-results state the moment a viewer
  // broke off typing to think.
  it("returns the whole list for a query that is only whitespace", () => {
    expect(titles(filterNotes(rows, "   "))).toEqual(titles(rows));
  });

  it("returns nothing when no title matches", () => {
    expect(filterNotes(rows, "delta")).toEqual([]);
  });

  it("preserves the order it was given", () => {
    expect(titles(filterNotes(rows, ".md"))).toEqual(titles(rows));
  });
});
