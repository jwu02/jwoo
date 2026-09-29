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
 * It is a floating pane in both orientations: sized to its contents rather than
 * to its column, so the wallpaper shows around it the way it does around an
 * application's surface. Desktop centres it against the viewport height by
 * absorbing the free space as margin; narrow widths let it span the width.
 *
 * Icons carry an `aria-label`, so the hover tooltip is an affordance and never
 * the only way to read an app's name.
 */
export function Dock() {
  const pathname = usePathname()

  return (
    <nav
      data-os-chrome
      aria-label="Applications"
      className="os-glass mx-2 mb-2 flex shrink-0 items-center justify-center gap-1 rounded-2xl border p-1.5 shadow-2xl md:my-auto md:flex-col md:gap-1.5 md:p-2"
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
                    "flex size-10 items-center justify-center rounded-xl transition duration-150 ease-out",
                    active
                      ? "bg-foreground/15 text-foreground ring-1 ring-foreground/15 shadow-[inset_0_1px_0_oklch(1_0_0/12%)]"
                      : "text-foreground/55 hover:scale-105 hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  <app.icon className="size-8" aria-hidden />
                </Link>
              }
            />
            {/* No pointer to hover on a touch screen, so the label is desktop-only. */}
            <TooltipContent side="right" className="hidden font-mono text-[11px] md:inline-flex">
              {app.label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
