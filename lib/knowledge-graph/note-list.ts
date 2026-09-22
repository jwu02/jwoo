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
