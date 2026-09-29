"use client"

import { usePathname } from "next/navigation"

import { Dock } from "./dock"
import { TopBar } from "./top-bar"

const HOME = "/"

/**
 * The operating-system frame every page renders inside: a Top Bar naming the
 * active application, a Dock that selects one, and the application itself.
 *
 * One application at a time is the point (see ADR 0004). Selecting a Dock icon
 * does not open a window beside the current one — it replaces it, which is why
 * this is a layout and not a window manager.
 *
 * Home is the desktop: it takes the whole viewport, unframed, because it is the
 * wallpaper the other applications appear over rather than an application among
 * them. Both pieces of the Shell are overlays rather than panels — nothing here
 * reserves a column or a strip for them; an application's own surface is what
 * makes room (see the padding below), and the desktop makes room for nothing.
 */
export function OSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const desktop = pathname === HOME

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background text-foreground print:h-auto print:overflow-visible">
      {/* The wallpaper. Home paints its own scene over this, so it is only ever
          seen around an application's surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-background bg-[radial-gradient(120%_85%_at_50%_-15%,rgba(255,255,255,0.07),transparent_55%)]"
      />
      <TopBar />
      {/* Column-reversed on narrow screens so the Dock lands at the bottom
          without a second copy of the markup, and a plain row from `md` up. */}
      <div className="relative flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Floating over the desktop rather than taking a column from it: the
            scene runs the full width of the viewport, and the Dock's glass sits
            over the scene instead of over the flat wallpaper beside it. */}
        <Dock overlay={desktop} />
        <main
          // The Shell floats over the frame, so an application's surface is
          // padded clear of it; the desktop is not, and its wallpaper runs on
          // under the glass. The top padding is the Top Bar's own height (h-9)
          // plus the gap the other edges use, so the surface never crowds it.
          className={`relative isolate min-h-0 flex-1 overflow-hidden print:overflow-visible ${
            desktop ? "" : "p-2 pt-11 md:p-3 md:pt-12 print:p-0"
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
              className="os-glass os-app-enter h-full overflow-auto rounded-2xl border shadow-2xl"
            >
              {children}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
