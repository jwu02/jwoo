"use client";

import { createContext, useContext, type ReactNode } from "react";

interface NoteHover {
  // The note whose node is emphasized, or null when none is.
  hoveredNote: string | null;
  // Moves the hover. This is the immutable handle onto the renderer's own
  // imperative setter rather than a React state setter: a row calls it on
  // every pointer move, and a state setter here would reconcile the page — and
  // with it the graph's labels — once per move.
  setHoveredNote: (noteId: string | null) => void;
}

// Deliberately absent rather than defaulted: a component that reads this
// without the provider is a wiring mistake, and an empty default would compile
// and then quietly do nothing.
const NoteHoverContext = createContext<NoteHover | null>(null);

// The note list's side of the renderer's hover: it reads which note is hovered
// and drives the hover the viewer points at. Scoped to the page's one graph,
// which is why a provider is right here where a module-level store would be
// global state.
export function NoteHoverProvider({
  value,
  children,
}: {
  value: NoteHover;
  children: ReactNode;
}) {
  return (
    <NoteHoverContext.Provider value={value}>
      {children}
    </NoteHoverContext.Provider>
  );
}

export function useNoteHover(): NoteHover {
  const hover = useContext(NoteHoverContext);
  if (!hover) {
    throw new Error("useNoteHover must be used within a NoteHoverProvider");
  }
  return hover;
}
