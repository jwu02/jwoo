"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { activeApp } from "./apps"

const DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
})

const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/**
 * The wall clock, re-read on the minute boundary rather than on a fixed
 * interval: a whole-minute display ticked every 30s would show a stale minute
 * for up to half of every one.
 */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const at = new Date()
      setNow(at)
      timer = setTimeout(tick, 60_000 - at.getSeconds() * 1000 - at.getMilliseconds())
    }

    // Deferred rather than called here: a synchronous setState in the effect
    // body would be a second render pass on mount.
    timer = setTimeout(tick, 0)

    return () => clearTimeout(timer)
  }, [])

  return now
}

/**
 * The OS's one piece of persistent chrome besides the Dock: the name of the
 * application you are inside, and the time. Left deliberately empty of
 * anything that would imply a feature — no menus, no system indicators.
 */
export function TopBar() {
  const app = activeApp(usePathname())
  const now = useNow()

  return (
    <header
      data-os-chrome
      // No pane: the bar is its text, floating on whatever is under it. Where
      // that is the wallpaper it reads as a system bar; over the Desktop it is
      // the scene's own top edge, which is why nothing here may box it in.
      className="absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between px-4 font-os text-[15px]"
    >
      <span className="truncate">{app.title}</span>
      {/* Blank until mounted: the time is the client's to know, and rendering a
          placeholder on the server would only hydrate into a mismatch. */}
      <span className="shrink-0 tabular-nums text-foreground/55">
        {now ? `${DATE.format(now)} · ${TIME.format(now)}` : null}
      </span>
    </header>
  )
}
