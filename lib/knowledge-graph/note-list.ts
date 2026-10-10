import type { KnowledgeGraphNode } from "./types";

// One row of the note list: a note as the panel presents it. The title is the
// node's id, which is what the sync tool keys on, so it is also what the row
// keys on — the two cannot diverge.
//
// A row is only its title. The node's creation date is not carried here: the
// panel does not show one, and a field nothing renders is a field that starts
// to drift.
export interface NoteRow {
  title: string;
}

// The graph's nodes, newest first. The graph itself stays oldest→newest — that
// ordering belongs to the builder, not to how the notes are read — so this is
// the one place the order flips.
export function buildNoteList(
  nodes: readonly KnowledgeGraphNode[]
): NoteRow[] {
  return [...nodes].reverse().map((node) => ({ title: node.id }));
}

// The rows a query keeps: a case-insensitive substring of the title. A query
// that is empty or only whitespace keeps everything, so clearing the field — or
// pausing mid-phrase — never empties the list. Order is the list's, untouched.
export function filterNotes(rows: readonly NoteRow[], query: string): NoteRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...rows];
  return rows.filter((row) => row.title.toLowerCase().includes(needle));
}

// Whether a row stands for the note an id names. This lives here because it is
// really a question about the graph's vocabulary, not the panel's: a node's id
// *is* a note's title, so a note's id resolves to a row by identity — exact,
// unlike the search's case-insensitive substring, because a hover or a focus
// each name one note while a search matches many.
//
// A null id matches nothing, which is what leaves every row unemphasized and
// unmarked while no note is hovered or focused.
//
// One predicate for both: which note an id names is the same question whether
// the id came from a hover or from the Focus.
export function standsForNote(row: NoteRow, noteId: string | null): boolean {
  return noteId !== null && row.title === noteId;
}

// The note the Random note button jumps to: a uniformly picked note id, and
// never the one already holding the Focus — a press that landed back on the
// framed note would move nothing and read as a button that does not work.
//
// Null is "nothing to pick": an empty graph, or a graph whose only note is the
// one already framed. The pool is the graph rather than the note list, because
// the search is a view of the list and the graph is the same graph whatever it
// is typed into.
//
// The rng is a parameter so a pick is a fact under test rather than a coin
// toss, the same seam the Tetris engine takes a seed through. It is expected to
// return [0, 1) the way Math.random does; a wasted index is not guarded against,
// because the only callers are the default and a test that has one.
export function pickRandomNote(
  nodes: readonly KnowledgeGraphNode[],
  excludeId: string | null,
  rng: () => number = Math.random
): string | null {
  const pool = nodes.filter((node) => node.id !== excludeId);
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)].id;
}
