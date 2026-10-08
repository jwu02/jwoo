"use client"

import { usePathname } from "next/navigation"

import { useVisualViewport } from "@/hooks/use-visual-viewport"

import { HOME } from "./apps"
import { Dock } from "./dock"

/**
 * The operating-system frame every page renders inside: a Dock that selects the
 * active application, and the application itself.
 *
 * One application at a time is the point (see ADR 0004). Selecting a Dock icon
 * does not open a window beside the current one — it replaces it, which is why
 * this is a layout and not a window manager.
 *
 * Home is the desktop: it takes the whole viewport, unframed, because it is the
 * wallpaper the other applications appear over rather than an application among
 * them. The Shell is an overlay rather than a panel — nothing here reserves a
 * column for it; an application's own surface is what makes room (see the
 * padding below), and the desktop makes room for nothing.
 */
export function OSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const desktop = pathname === HOME

  // On narrow screens the Shell is pinned to the visual viewport (`--vvh`,
  // written by this hook and read by the class below), so the software keyboard
  // takes room from the Shell instead of covering an application's bottom edge
  // — the Terminal's Input bar. Pinning the whole Shell rather than only the
  // Terminal's pane is what keeps the Dock reachable above the keyboard and
  // stops iOS scrolling the page to reveal the focused field.
  useVisualViewport()

  return (
    // Column-reversed on narrow screens so the Dock lands at the bottom without
    // a second copy of the markup, and a plain row from `md` up. `isolate` is
    // what lets the wallpaper sit at a negative depth: without a stacking
    // context here it would resolve against the root's, which is behind this
    // element's own background, and never be seen at all.
    <div className="relative isolate flex h-svh flex-col-reverse overflow-hidden bg-background text-foreground md:flex-row print:h-auto print:overflow-visible max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:h-[var(--vvh,100svh)]">
      {/* The wallpaper. Home paints its own scene over this, so it is only ever
          seen around an application's surface. It is held below everything —
          a decorative layer that painted above the Shell's own contents would
          hide any of them that does not happen to make a layer of its own. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background bg-[radial-gradient(120%_85%_at_50%_-15%,rgba(255,255,255,0.07),transparent_55%)]"
      />
      {/* Floating over the desktop rather than taking a column from it: the
          scene runs the full width of the viewport, and the Dock's glass sits
          over the scene instead of over the flat wallpaper beside it. */}
      <Dock overlay={desktop} />
      <main
        // The Shell floats over the frame, so an application's surface is
        // padded clear of it; the desktop is not, and its wallpaper runs on
        // under the glass. On narrow screens there is no floating to do — the
        // surface fills the viewport edge to edge under the Dock.
        className={`relative isolate min-h-0 flex-1 overflow-hidden print:overflow-visible ${
          desktop ? "" : "md:p-3 print:p-0"
        }`}
      >
        {/* Keyed on the route so switching applications remounts the view and
            replays the enter transition, the way a window appearing does. */}
        {desktop ? (
          // The desktop scrolls even though the scene does not: the scene is
          // out of flow, so it fills the viewport without adding any, and the
          // WebGL-less fallback underneath is an ordinary scrolling page.
          <div key={pathname} className="os-app-enter relative h-full overflow-auto">
            {children}
          </div>
        ) : (
          <section
            key={pathname}
            data-os-surface
            className="os-app-enter h-full overflow-auto md:os-glass md:rounded-2xl md:border md:shadow-2xl"
          >
            {children}
          </section>
        )}
      </main>
    </div>
  )
}
