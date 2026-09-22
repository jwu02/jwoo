"use client";

import { useMemo, useState } from "react";
import { BookTextIcon, SearchIcon } from "lucide-react";
import { buildNoteList, filterNotes, type NoteRow } from "@/lib/knowledge-graph/note-list";
import type { KnowledgeGraphNode } from "@/lib/knowledge-graph/types";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NoteListProps {
  nodes: readonly KnowledgeGraphNode[];
}

// A note's creation date. en-US is pinned the way every other formatter in the
// app pins it, so the string the server renders is the one the client keeps.
function formatNoteDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Titles carry the words a viewer remembers ("project plan", "docker notes"),
// so they take the row's full width and the date sits under them — a date in a
// trailing column would be read first at a glance and take width from the one
// thing being searched.
function NoteListRow({ row }: { row: NoteRow }) {
  return (
    <li className="px-4 py-2.5">
      <span
        data-testid="kg-note-title"
        className="block text-sm leading-snug text-foreground"
      >
        {row.title}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatNoteDate(row.createdAt)}
      </span>
    </li>
  );
}

// The panel's body: header, search field, rows. Free-standing so the desktop
// column and the mobile sheet draw the same thing rather than two copies that
// drift — the layout around it is the caller's.
function NoteListBody({ nodes }: NoteListProps) {
  const [query, setQuery] = useState("");

  // One list per graph object: the order flips once, and typing re-filters the
  // rows already built rather than rebuilding them on every keystroke.
  const notes = useMemo(() => buildNoteList(nodes), [nodes]);
  const visible = useMemo(() => filterNotes(notes, query), [notes, query]);

  const countLabel = notes.length === 1 ? "1 note" : `${notes.length} notes`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="font-heading text-sm font-medium">Notes</h2>
        {/* The count describes the graph, so it holds still while the list
            narrows — the list itself is the answer to the query. */}
        <span className="text-xs text-muted-foreground">{countLabel}</span>
      </div>

      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <SearchIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search notes"
          placeholder="Search notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {/* The two are one slot: a no-results note takes the list's place rather
          than following an empty list that has already stretched the panel. */}
      {visible.length === 0 ? (
        <p className="flex-1 px-4 py-6 text-center text-xs text-muted-foreground">
          No notes match {`"${query.trim()}"`}.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {visible.map((row) => (
            <NoteListRow key={row.title} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

// The note list: every note newest first, searchable by title. Beside the graph
// on desktop; behind a toggle over it below the desktop breakpoint, where the
// graph keeps the full width.
export function NoteList({ nodes }: NoteListProps) {
  return (
    <>
      {/* `min-h-0` is load-bearing: a flex item's automatic minimum size is its
          content, and this one holds every note in the graph. Without it the
          panel's 656 rows set the row's height, and the graph beside it — sized
          `h-full` — is stretched to match. */}
      <aside
        data-testid="kg-note-list"
        aria-label="Note list"
        className="hidden min-h-0 w-72 shrink-0 border-l border-border bg-card/40 md:flex"
      >
        <NoteListBody nodes={nodes} />
      </aside>

      {/* CSS, not `useIsMobile`, decides which of the two shows: the panel has
          to be present at first paint — the graph frames itself against the
          width it leaves — and a JS-measured breakpoint would flip on the
          client's second render, after that framing had been computed. */}
      <Sheet>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Browse notes"
              className="absolute top-3 right-3 z-20 rounded-md border border-border bg-card p-2 text-muted-foreground outline-none hover:text-foreground md:hidden"
            />
          }
        >
          <BookTextIcon aria-hidden="true" className="size-4" />
        </SheetTrigger>
        {/* `overflow-hidden` because the body scrolls its own list; the base
            popup's `overflow-y-auto` would give the sheet a second scrollbar
            around the first. `pr-8` clears the popup's own close button, which
            sits in the top-right corner over the header the body draws there. */}
        <SheetContent
          side="right"
          className="w-80 max-w-[85vw] gap-0 overflow-hidden p-0 pr-8 md:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Notes</SheetTitle>
          </SheetHeader>
          <NoteListBody nodes={nodes} />
        </SheetContent>
      </Sheet>
    </>
  );
}
