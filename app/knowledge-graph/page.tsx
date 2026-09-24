"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ForceGraph,
  type ForceGraphHandle,
} from "@/components/knowledge-graph/force-graph";
import { NoteList } from "@/components/knowledge-graph/note-list";
import { NoteHoverProvider } from "@/components/knowledge-graph/note-hover";
import { NoteFocusProvider } from "@/components/knowledge-graph/note-focus";
import { CacheNotice } from "@/components/knowledge-graph/cache-notice";
import { useCacheClock } from "@/components/knowledge-graph/use-cache-clock";
import { ErrorBanner } from "@/components/polled/error-banner";
import type { KnowledgeGraphSnapshot } from "@/lib/knowledge-graph/types";

// The one place the page's height is written down, because every state has to
// agree on it: a page that resized between loading and loaded would re-frame a
// graph the viewer had already looked at.
//
// Viewport math rather than `h-full`, because the app shell sizes its column to
// `min-h-svh` — a minimum, not a height — so a percentage on the page has
// nothing to resolve against, and the graph is stretched to whatever the note
// list's rows happen to add up to instead.
//
// Each number comes from the shell, and `HomeScene` is sized the same way for
// the same reason:
//   - below `md` the shell keeps its `h-14` (3.5rem) header above the page;
//   - from `md` up the header is hidden and `md:-mx-4 md:-mb-4` cancels the
//     content padding, so the page is the whole viewport.
const PAGE_HEIGHT = "h-[calc(100vh-3.5rem)] md:h-[100vh]";

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeGraphSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    // A refresh landing while the previous one is still open would race it and
    // let the older response win.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const response = await fetch("/api/knowledge-graph");
      if (!response.ok) throw new Error("Failed to load knowledge graph");
      setData(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => load(), 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  // The countdown is the only thing that asks for a fresh snapshot; the page
  // does not poll, because a snapshot's life is measured in hours.
  const countdown = useCacheClock(data, load);

  // Which note's node is emphasized. Hover lives in the renderer; this is only
  // what the renderer last reported, held so the list can give that note's row
  // the same Emphasis. The list drives hover back through the renderer's own
  // setter rather than through this state, so a pointer moving over the rows
  // never goes near the force simulation.
  const [hoveredNote, setReportedHover] = useState<string | null>(null);
  const graphRef = useRef<ForceGraphHandle>(null);

  // Whether the note list shares the graph's row. It is the page's to hold
  // because it is not only the list's: the graph's viewport is a different
  // width without it, and the renderer — which draws into the box it was built
  // in — has to be told so it can put the viewer's framing back.
  const [notesOpen, setNotesOpen] = useState(true);
  const toggleNotes = useCallback(() => setNotesOpen((open) => !open), []);

  // Every change to the panel is a change to the graph's viewport, so each one
  // is compensated: zoom unchanged, the graph point the viewer had at the
  // centre put back at the centre, so showing or hiding the list never reframes
  // or clips what they were looking at. The first run is the mount itself,
  // where nothing has moved and the graph has framed itself against the row it
  // already has.
  const laidOutRef = useRef(false);
  useEffect(() => {
    if (!laidOutRef.current) {
      laidOutRef.current = true;
      return;
    }
    graphRef.current?.reanchorViewport();
  }, [notesOpen]);

  // One name per direction: this one goes *to* the renderer, where the reported
  // setter above takes what comes *from* it.
  const driveHover = useCallback((noteId: string | null) => {
    graphRef.current?.setHoveredNote(noteId);
  }, []);

  const noteHover = useMemo(
    () => ({ hoveredNote, setHoveredNote: driveHover }),
    [hoveredNote, driveHover]
  );

  // Which note holds the Focus. It lives here rather than in a row because it
  // outlives the rows: the camera is left framing the note long after the
  // pointer has moved on, and the graph itself can ask for the focus to end.
  // The renderer is handed the id and does the flying; the list is handed the
  // id and does the marking.
  //
  // A row is not the only way in or out. A click on a node asks for the same
  // thing, so the renderer reports the take back through focusNote — and a
  // click on the note that already holds it lets it go through clearFocus,
  // which is the report the renderer has always made. Which of the two a click
  // is is the renderer's to decide, because it is the one that knows what is
  // focused; this state stays the single answer to what is.
  const [focusedNote, setFocusedNote] = useState<string | null>(null);

  const focusNote = useCallback((noteId: string) => setFocusedNote(noteId), []);
  const clearFocus = useCallback(() => setFocusedNote(null), []);

  const noteFocus = useMemo(
    () => ({ focusedNote, focusNote, clearFocus }),
    [focusedNote, focusNote, clearFocus]
  );

  // Escape lets go of the focus — unless the search field has already answered
  // it, which it marks by cancelling the key: clearing the query is the nearer
  // thing to undo, and an empty field has nothing to clear and lets the key
  // through to here. The listener is only up while there is something to
  // dismiss.
  useEffect(() => {
    if (focusedNote === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setFocusedNote(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusedNote]);

  // A snapshot with no notes is not a graph to draw, so it takes the empty
  // state below rather than reaching the scene with nothing in it.
  const graph = !loading && data && data.nodes.length > 0 ? data : null;

  const body = loading ? (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      Loading knowledge graph…
    </div>
  ) : graph ? (
    // The panel is a sibling of the graph, not an overlay, so the graph frames
    // itself against the width the list leaves — and the two are mounted
    // together, because a panel appearing after the first fit would re-frame a
    // graph the viewer had already looked at.
    //
    // `h-full` is the page box, and `shrink-0` holds it there even when the
    // failure banner above takes some: the canvas is sized once from its
    // wrapper, and `resizeTo` only hears about window resizes (pixi 8 has no
    // ResizeObserver on the container), so a row that gave way to a banner
    // would clip the graph rather than resize it.
    <NoteHoverProvider value={noteHover}>
      <NoteFocusProvider value={noteFocus}>
        <div className="relative flex h-full shrink-0 overflow-hidden">
          <ForceGraph
            ref={graphRef}
            graph={graph}
            onHoverChange={setReportedHover}
            focusedNote={focusedNote}
            onFocusClear={clearFocus}
            onFocusTake={focusNote}
          />
          <NoteList
            nodes={graph.nodes}
            open={notesOpen}
            onToggle={toggleNotes}
          />
          {/* Inside the row, not above it: the notice belongs to the graph's own
              corner, and a row-relative box puts it there without the page having
              to know how wide the sidebar or the note panel are. */}
          {countdown && <CacheNotice {...countdown} />}
        </div>
      </NoteFocusProvider>
    </NoteHoverProvider>
  ) : error && !data ? (
    // Only fatal when there is nothing to show. Once a graph is on screen, a
    // failed refresh reports itself alongside the stale graph instead.
    <div className="min-h-0 flex-1 p-4 md:p-6">
      <ErrorBanner message={error} onRetry={load} />
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
      No notes synced yet.
    </div>
  );

  return (
    <div className={`flex flex-col md:-mx-4 md:-mb-4 ${PAGE_HEIGHT}`}>
      {/* Held above the graph's row rather than inside it, so the banner that
          appears when a refresh fails costs the page its overflow instead of
          the canvas its height. */}
      {graph && error && (
        <div className="shrink-0 px-4 pt-4 md:px-6">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      {body}
    </div>
  );
}
