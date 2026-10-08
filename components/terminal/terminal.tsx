"use client"

import { OPENING_PRINT } from "./opening-print"
import { PrintList } from "./print"

/**
 * The Terminal application: the Shell's os-glass surface in the site's two
 * tones, a titlebar in the Dock's voice, the Print above the Input bar.
 *
 * The skeleton stands the surface up — it prints the opening fixture and draws
 * the field. Nothing is driven yet: the input machine and the Command registry
 * are their own tickets, and the wiring ticket is what makes the bar run.
 */
export function Terminal() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center border-b border-foreground/10 px-4 py-2.5 font-os text-[13px] text-muted-foreground">
        <h1>Terminal</h1>
      </header>

      {/* The output is the only part that moves: the titlebar stays put and the
          Input bar stays pinned to the bottom edge. */}
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 font-mono text-[13.5px] leading-relaxed md:px-8 md:py-7">
        <PrintList prints={OPENING_PRINT} />
      </div>

      {/* An OS text field, not a terminal prompt: rounded, translucent, the
          focus ring borrowed from the rest of the Shell. Drawn here; the
          machine that reads it is a later ticket. */}
      <div className="shrink-0 px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex items-center gap-2 rounded-xl border border-foreground/12 bg-foreground/5 px-3.5 py-2.5 font-mono text-[13.5px] text-foreground shadow-inner transition focus-within:border-foreground/25 focus-within:bg-foreground/8">
          <span className="text-muted-foreground">›</span>
          <input
            aria-label="Terminal input"
            placeholder="Type / to see commands"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>
    </div>
  )
}
