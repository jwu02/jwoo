"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ForceGraph,
  type ForceGraphHandle,
} from "@/components/knowledge-graph/force-graph";
import { NoteList } from "@/components/knowledge-graph/note-list";
import { CacheNotice } from "@/components/knowledge-graph/cache-notice";
import { useCacheClock } from "@/components/knowledge-graph/use-cache-clock";
import { ErrorBanner } from "@/components/polled/error-banner";
import { usePolledJson } from "@/hooks/use-polled-json";
import type { KnowledgeGraphSnapshot } from "@/lib/knowledge-graph/types";

// The page fills its application's surface and no more, because every state has
// to agree on the height: a page that resized between loading and loaded would
// re-frame a graph the viewer had already looked at. The surface gives it a
// definite height, so `h-full` resolves here.
export default function KnowledgeGraphPage() {
  // A one-shot: the url is loaded once rather than polled, because a snapshot's
  // life is measured in hours. The countdown below is the only thing that ever
  // asks for a fresh one, and it asks through `refresh`.
  const {
    data,
    loading,
    error,
    refresh: load,
  } = usePolledJson<KnowledgeGraphSnapshot>("/api/knowledge-graph", {
    intervalMs: null,
  });

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
  // or clips what they were looking at. The mount run needs no guard of its
  // own: the camera ignores a re-anchor that finds nothing built, or a viewport
  // the graph is already drawn against.
  useEffect(() => {
    graphRef.current?.reanchorViewport();
  }, [notesOpen]);

  // One name per direction: this one goes *to* the renderer, where the reported
  // setter above takes what comes *from* it.
  const driveHover = useCallback((noteId: string | null) => {
    graphRef.current?.setHoveredNote(noteId);
  }, []);

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

  // Asked for by the renderer when its layout has been run to rest, framed and
  // shown. Which snapshot it drew, rather than a flag, because the question is
  // about one snapshot's graph: a rebuilt graph is a blank box again the moment
  // it is torn down, and only the renderer can say when there is a picture in
  // it — so it says which one. Its identity changes with the snapshot, which is
  // the one prop change the memoized renderer has to rebuild for anyway.
  const [drawnSnapshot, setDrawnSnapshot] = useState<KnowledgeGraphSnapshot | null>(null);
  const onGraphReady = useCallback(() => setDrawnSnapshot(graph), [graph]);
  const drawn = graph !== null && drawnSnapshot === graph;

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
    <div className="relative flex h-full shrink-0 overflow-hidden">
      <ForceGraph
        ref={graphRef}
        graph={graph}
        onHoverChange={setReportedHover}
        focusedNote={focusedNote}
        onFocusClear={clearFocus}
        onFocusTake={focusNote}
        onReady={onGraphReady}
      />
      {/* The list is handed the graph's hover and the page's Focus as props
          rather than through a context: it is the only consumer, one level
          down, and the page is the one that owns both. */}
      <NoteList
        nodes={graph.nodes}
        open={notesOpen}
        onToggle={toggleNotes}
        hoveredNote={hoveredNote}
        setHoveredNote={driveHover}
        focusedNote={focusedNote}
        focusNote={focusNote}
        clearFocus={clearFocus}
      />
      {/* Inside the row, not above it: the notice belongs to the graph's own
          corner, and a row-relative box puts it there without the page having
          to know how wide the sidebar or the note panel are. */}
      {countdown && <CacheNotice {...countdown} />}
      {/* The snapshot arriving is not the graph arriving: the layout is run
          to rest and framed before any of it is drawn, so the page covers
          that moment with its loading state. An overlay rather than a
          branch, because the renderer is what says when it is drawn — a
          graph that is not mounted cannot report that. */}
      {!drawn && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
          Loading knowledge graph…
        </div>
      )}
    </div>
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
    <div className="flex h-full flex-col">
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
