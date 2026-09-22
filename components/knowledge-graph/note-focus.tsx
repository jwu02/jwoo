"use client";

import { createContext, useContext, type ReactNode } from "react";

interface NoteFocus {
  // The note holding the Focus, or null when none is.
  focusedNote: string | null;
  // Takes the focus for a note. The page owns it — the camera that flies to the
  // note is the renderer's — so a row asks for the focus rather than keeping it.
  focusNote: (noteId: string) => void;
  // Lets go of the focus. Dismissal moves no camera, so there is nothing else
  // to it: the graph is left framed exactly where the dismissal found it.
  clearFocus: () => void;
}

// Deliberately absent rather than defaulted, as the hover's is: a component
// that reads this without the provider is a wiring mistake, and an empty
// default would compile and then quietly do nothing.
const NoteFocusContext = createContext<NoteFocus | null>(null);

// The note list's side of the page's Focus: it shows which note holds it and
// says when a different one should. Scope is the page's one graph, which is why
// a provider is right here where a module-level store would be global state.
export function NoteFocusProvider({
  value,
  children,
}: {
  value: NoteFocus;
  children: ReactNode;
}) {
  return (
    <NoteFocusContext.Provider value={value}>
      {children}
    </NoteFocusContext.Provider>
  );
}

export function useNoteFocus(): NoteFocus {
  const focus = useContext(NoteFocusContext);
  if (!focus) {
    throw new Error("useNoteFocus must be used within a NoteFocusProvider");
  }
  return focus;
}
