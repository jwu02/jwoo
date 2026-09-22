"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookTextIcon } from "lucide-react";
import {
  buildNoteList,
  filterNotes,
  isFocusedNote,
  isHoveredNote,
  type NoteRow,
} from "@/lib/knowledge-graph/note-list";
import type { KnowledgeGraphNode } from "@/lib/knowledge-graph/types";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNoteHover } from "./note-hover";
import { useNoteFocus } from "./note-focus";

interface NoteListProps {
  nodes: readonly KnowledgeGraphNode[];
}

// A row is its title. The titles carry the words a viewer remembers ("project
// plan", "docker notes"), which is what the list is scanned and searched for —
// a date under each one said nothing about a note and cost the panel a line of
// the handful it has to give.
//
// `wrap-anywhere` is for the titles that are not words at all: a note named
// after a URL carries one unbreakable token wider than the panel, and a row
// that will not wrap is a row that widens every other row with it.
//
// The row is a hover surface in its own right: the pointer and the keyboard
// both drive the renderer's hover through it, so Tab gives the same spatial
// feedback as pointing at a node. The row does not keep that hover — it says
// which note it stands for, and the renderer answers with the emphasis a
// pointer on the node would have drawn.
//
// Focus is the state a row does keep: clicking one hands the note to the page,
// which flies the camera and holds the row marked until the focus ends. The
// activation itself is a button's, so Enter and Space come with it — the row
// still carries the hover, because a pointer entering it has not left it when
// it crosses onto the button.
function NoteListRow({ row, hovered }: { row: NoteRow; hovered: boolean }) {
  const { hoveredNote, setHoveredNote } = useNoteHover();
  const { focusedNote, focusNote, clearFocus } = useNoteFocus();
  const { title } = row;
  const focused = isFocusedNote(row, focusedNote);

  // The focused row is its own way out: clicking it again lets the focus go,
  // the way a second click on a selected thing usually does.
  const activate = useCallback(
    () => (focused ? clearFocus() : focusNote(title)),
    [focused, clearFocus, focusNote, title]
  );
  const enter = useCallback(
    () => setHoveredNote(title),
    [setHoveredNote, title]
  );
  const leave = useCallback(() => setHoveredNote(null), [setHoveredNote]);

  // Leaving a row is not the only way to stop hovering it: a row can be taken
  // away underneath the pointer — by the search, by the mobile sheet closing —
  // and React fires neither pointerleave nor blur on an unmount. Without this,
  // the graph would go on emphasizing a note whose row is gone, and would
  // still be emphasizing it when a later query brought the row back.
  //
  // Where this row the one holding the Emphasis is asked once per render and
  // held by a ref, rather than read back out of context at cleanup: the rows
  // beside it unmount in the same commit on a query change, and each of those
  // owes the graph nothing.
  const holdsHover = hoveredNote !== null && hoveredNote === title;
  const holdsHoverRef = useRef(holdsHover);
  useEffect(() => {
    holdsHoverRef.current = holdsHover;
  }, [holdsHover]);
  useEffect(
    () => () => {
      if (holdsHoverRef.current) setHoveredNote(null);
    },
    [setHoveredNote]
  );

  return (
    <li
      // Where the row's Emphasis and its Focus are written down, so the styling
      // below and anything asking why a row is marked read the same answer.
      data-hovered={hovered ? "" : undefined}
      data-focused={focused ? "" : undefined}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      // The focused row stays marked while the pointer is elsewhere — that is
      // the whole of what "focused" looks like in the list — so its fill is the
      // hover's at full strength rather than the hover's own.
      className={`transition-colors ${focused ? "bg-accent" : hovered ? "bg-accent/60" : ""}`}
    >
      <button
        type="button"
        // A toggle, because the row is one: it says whether this note holds the
        // focus, and pressing it again lets that go.
        aria-pressed={focused}
        onClick={activate}
        // The padding is the button's rather than the row's, so the row's whole
        // surface is the target instead of only the text inside it.
        className="block w-full cursor-pointer px-4 py-2.5 text-left outline-none focus-visible:bg-accent/60"
      >
        <span
          data-testid="kg-note-title"
          className="block text-sm leading-snug text-foreground wrap-anywhere"
        >
          {row.title}
        </span>
      </button>
    </li>
  );
}

// The panel's body: header, search field, rows. Free-standing so the desktop
// column and the mobile sheet draw the same thing rather than two copies that
// drift — the layout around it is the caller's.
function NoteListBody({ nodes }: NoteListProps) {
  const [query, setQuery] = useState("");
  const { hoveredNote } = useNoteHover();
  const { focusedNote, clearFocus } = useNoteFocus();

  // One list per graph object: the order flips once, and typing re-filters the
  // rows already built rather than rebuilding them on every keystroke.
  const notes = useMemo(() => buildNoteList(nodes), [nodes]);
  const visible = useMemo(() => filterNotes(notes, query), [notes, query]);

  const countLabel = notes.length === 1 ? "1 note" : `${notes.length} notes`;

  return (
    // `w-full min-w-0` hold the body inside the panel it was given. Without
    // them a flex item is floored at its content's min-content width, and the
    // list — 656 rows of titles — floors it wider than the panel, pushing the
    // search field and every row off the panel's right edge.
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h2 className="font-heading text-sm font-medium">Notes</h2>
        <div className="flex items-center gap-2">
          {/* The panel's own way out of a Focus, for a pointer that is already
              here: Esc is the keyboard's, and the focused row is the row's. */}
          {focusedNote !== null && (
            <button
              type="button"
              onClick={clearFocus}
              className="cursor-pointer rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear focus
            </button>
          )}
          {/* The count describes the graph, so it holds still while the list
              narrows — the list itself is the answer to the query. */}
          <span className="text-xs text-muted-foreground">{countLabel}</span>
        </div>
      </div>

      {/* No search icon: the field filters as it is typed, so the icon would
          announce what the results already show. */}
      <div className="px-4 pt-3 pb-2">
        <Input
          type="search"
          aria-label="Search notes"
          placeholder="Search notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Escape in the field is the field's: clearing the query is the
            // nearer thing to undo than the focus, so the field takes the key
            // and marks it handled — which is what tells the page's own
            // dismissal that this Escape has already been answered. An empty
            // field has nothing to clear, and lets the key through to it.
            if (event.key !== "Escape" || query === "") return;
            event.preventDefault();
            setQuery("");
          }}
        />
      </div>

      {/* The two are one slot: a no-results note takes the list's place rather
          than following an empty list that has already stretched the panel.
          The list's `min-w-0` is the body's for the same reason — a row is
          floored at the width of the longest word in a title, and the list has
          to be free to wrap rather than widen the panel. */}
      {visible.length === 0 ? (
        <p className="flex-1 px-4 py-6 text-center text-xs text-muted-foreground">
          No notes match {`"${query.trim()}"`}.
        </p>
      ) : (
        <ul className="min-h-0 min-w-0 flex-1 divide-y divide-border overflow-y-auto">
          {/* Only the rows the search kept are here, so only they can take an
              Emphasis: a note filtered out of the list has no row to answer a
              node hover. Nothing scrolls them either — the list holds the
              viewer's reading position while the graph moves under the
              pointer. */}
          {visible.map((row) => (
            <NoteListRow
              key={row.title}
              row={row}
              hovered={isHoveredNote(row, hoveredNote)}
            />
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
