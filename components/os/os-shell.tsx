"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"

import { appTitle, HOME } from "./apps"
import { Dock } from "./dock"

/**
 * The macOS window controls at the left of the titlebar, drawn as plain
 * traffic lights — no hover glyphs, the colours are the whole costume.
 *
 * Close and minimize both navigate to the Desktop: the one place a window
 * here can go when it leaves, since there is no window manager to minimize
 * into and the Desktop is the wallpaper the window sat on. Full screen is
 * the one control that manages the window itself, so it is a button, not a
 * navigation.
 */
function TrafficLights({
  fullScreen,
  onToggleFullScreen,
}: {
  fullScreen: boolean
  onToggleFullScreen: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={HOME}
        aria-label="Close window"
        className="size-3.5 rounded-full bg-[#ff5f57] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <Link
        href={HOME}
        aria-label="Minimize window"
        className="size-3.5 rounded-full bg-[#febc2e] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="button"
        aria-label="Full screen"
        aria-pressed={fullScreen}
        onClick={onToggleFullScreen}
        className="size-3.5 cursor-pointer rounded-full bg-[#28c840] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </div>
  )
}

/**
 * The strip at the head of an application's window that names it. The Shell
 * draws it rather than each application drawing its own, so every window is
 * titled the same way — in the Dock's voice, from the Dock's own list of names.
 * It is chrome, and says so, for the one page that prints.
 */
function Titlebar({
  title,
  fullScreen,
  onToggleFullScreen,
}: {
  title: string
  fullScreen: boolean
  onToggleFullScreen: () => void
}) {
  return (
    <header
      data-os-chrome
      className="flex shrink-0 items-center border-b border-foreground/10 px-4 py-2.5 font-os text-[13px] text-muted-foreground"
    >
      <TrafficLights fullScreen={fullScreen} onToggleFullScreen={onToggleFullScreen} />
      <h1 className="ml-3">{title}</h1>
    </header>
  )
}

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

  // Full screen is window state, so it dies with the window: it is recorded
  // as the route it was engaged on and is only active while that route is
  // still the one on screen. Any navigation — and any reload, state being
  // memory alone — restores the Dock. The Desktop can never hold the state:
  // its window has no traffic lights to engage it with.
  const [fullScreenRoute, setFullScreenRoute] = useState<string | null>(null)
  const fullScreen = fullScreenRoute === pathname

  return (
    // Column-reversed on narrow screens so the Dock lands at the bottom without
    // a second copy of the markup, and a plain row from `md` up. `isolate` is
    // what lets the wallpaper sit at a negative depth: without a stacking
    // context here it would resolve against the root's, which is behind this
    // element's own background, and never be seen at all. The frame's own dark
    // background does not print: the sheet is the only thing on paper, so a
    // frame taller than the sheet (any reason) would print as a dark band.
    <div className="relative isolate flex h-svh flex-col-reverse overflow-hidden bg-background text-foreground md:flex-row print:h-auto print:overflow-visible print:bg-transparent">
      {/* The wallpaper. Home paints its own scene over this, so it is only ever
          seen around an application's surface. It is held below everything —
          a decorative layer that painted above the Shell's own contents would
          hide any of them that does not happen to make a layer of its own. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background bg-[radial-gradient(120%_85%_at_50%_-15%,rgba(255,255,255,0.07),transparent_55%)] print:bg-transparent print:bg-none"
      />
      {/* Floating over the desktop rather than taking a column from it: the
          scene runs the full width of the viewport, and the Dock's glass sits
          over the scene instead of over the flat wallpaper beside it. */}
      {!fullScreen && <Dock overlay={desktop} />}
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
            className="os-app-enter flex h-full flex-col md:overflow-hidden md:os-glass md:rounded-2xl md:border md:shadow-2xl"
          >
            <Titlebar
              title={appTitle(pathname)}
              fullScreen={fullScreen}
              onToggleFullScreen={() =>
                setFullScreenRoute(fullScreen ? null : pathname)
              }
            />
            {/* The window's one scrolling region, with the titlebar above left
                out of it — so the chrome stays put while the page moves — and
                an application that would rather fill the window than scroll
                it, like the Terminal, free to do that instead. The window
                itself scrolls nothing now, so it clips its contents at its own
                rounded edge the way it did when it was the one scrolling. */}
            <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
              {children}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
