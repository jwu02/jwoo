"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { APPS } from "./apps"

/**
 * The site's navigation, and the only one it has. A vertical rail on the left
 * at desktop widths, a bottom bar on narrow ones — the same applications in the
 * same order either way, since the model being presented is the same.
 *
 * It is a pane rather than a panel in both orientations: sized to its contents,
 * so the view shows around it the way it does around an application's surface.
 *
 * It is also the whole of the Shell's voice about location: the active icon is
 * the only thing on screen that says which application the visitor is in.
 *
 * `overlay` is the one thing the Desktop changes about it. An application's
 * surface is laid out *beside* the Dock, so the Dock takes its own column. The
 * Desktop is the whole viewport and has nowhere to put a column — the Dock
 * floats over the wallpaper there, and over the scene, which is also what makes
 * its glass read the way the Shell's other panes do over the same scene.
 *
 * Icons carry an `aria-label`, so the hover tooltip is an affordance and never
 * the only way to read an app's name.
 */
export function Dock({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      data-os-chrome
      aria-label="Applications"
      className={cn(
        "os-glass flex shrink-0 items-center justify-center gap-1 rounded-2xl border p-1.5 shadow-2xl md:flex-col md:gap-1.5 md:p-2",
        // Overlaid, the offsets are the margins the in-flow variant would have
        // set (8px from the left, the same 8px from the viewport bottom on
        // narrow) — so the Dock does not move when the visitor navigates, it
        // only stops taking room. `md:my-auto` becomes an explicit centring,
        // the row it used to centre itself in being the viewport tall anyway.
        overlay
          ? "absolute bottom-2 left-2 right-2 z-20 md:bottom-auto md:right-auto md:top-1/2 md:-translate-y-1/2"
          : // Its right margin is given up from `md` up, where the surface's
            // own `p-3` is the whole of the room between the two panes: a
            // window stands 12px off the viewport edge, so the Dock stands
            // 12px off the window. Left at `mx-2` the Dock's own 8px would
            // stack on the surface's 12, and the gap would read as 20.
            "mx-2 mb-2 md:my-auto md:mr-0",
      )}
    >
      {APPS.map((app) => {
        const active = pathname === app.href

        return (
          <Tooltip key={app.href}>
            <TooltipTrigger
              render={
                <Link
                  href={app.href}
                  aria-label={app.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex size-10 items-center justify-center overflow-hidden rounded-xl transition duration-150 ease-out",
                    active
                      ? "bg-foreground/15 text-foreground ring-1 ring-foreground/15 shadow-[inset_0_1px_0_oklch(1_0_0/12%)]"
                      : "text-foreground/55 hover:scale-105 hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  <app.icon className="size-7" aria-hidden />
                </Link>
              }
            />
            {/* No pointer to hover on a touch screen, so the label is desktop-only. */}
            <TooltipContent
              side="right"
              sideOffset={12}
              arrow={false}
              className="hidden rounded-full border bg-popover px-3 py-1.5 font-os text-[15px] text-popover-foreground md:inline-flex"
            >
              {app.label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
