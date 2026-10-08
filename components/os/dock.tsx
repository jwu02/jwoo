"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState, useSyncExternalStore } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { App } from "./apps"
import {
  dockOrderServerSnapshot,
  dockOrderSnapshot,
  isPinned,
  saveDockOrder,
  subscribeDockOrder,
} from "./dock-order"

/** How far a press may travel before it is a drag rather than a selection. */
const DRAG_SLOP = 4

/** One icon's place on screen, as the drop hit test sees it. */
interface Slot {
  href: string
  left: number
  top: number
  right: number
  bottom: number
}

/** The application a pointer is over, if it is over one. */
function appUnder(
  { x, y }: { x: number; y: number },
  slots: readonly Slot[],
): string | undefined {
  return slots.find(
    (slot) => x >= slot.left && x <= slot.right && y >= slot.top && y <= slot.bottom,
  )?.href
}

/** `order` with `href` moved into `toHref`'s place. Returns `order` itself when
 * nothing moves, so a caller can tell by identity whether anything happened. */
function moveTo(order: readonly App[], href: string, toHref: string) {
  const from = order.findIndex((app) => app.href === href)
  const to = order.findIndex((app) => app.href === toHref)
  if (from < 0 || to < 0 || from === to) return order
  const next = order.slice()
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/**
 * The site's navigation, and the only one it has. A vertical rail on the left
 * at desktop widths, a bottom bar on narrow ones — the same applications in the
 * same order either way, since the model being presented is the same.
 *
 * It is a pane rather than a panel in both orientations: sized to its contents,
 * so the view shows around it the way it does around an application's surface.
 *
 * It is also the Shell's voice about location: the active icon marks which
 * application the visitor is in, and the window's titlebar names it.
 *
 * The visitor may rearrange the applications by dragging one onto another's
 * place: the drag begins where a press starts travelling (below DRAG_SLOP a
 * press is a selection, and the link navigates as it always did), and the icon
 * takes the slot the pointer is over, the others closing around it. The
 * arrangement is theirs, so it is remembered between visits — see `dock-order`.
 * The Desktop is Pinned: it is not dragged, nothing is dropped before it, and
 * however far a drag wanders it is still the first icon afterwards.
 *
 * `overlay` is the one thing the Desktop changes about it. An application's
 * surface is laid out *beside* the Dock, so the Dock takes its own column. The
 * Desktop is the whole viewport and has nowhere to put a column — the Dock
 * floats over the wallpaper there, and over the scene, which is also what makes
 * its glass read the way the Shell's other panes do over the same scene.
 *
 * Icons carry an `aria-label`, so the hover tooltip is an affordance and never
 * the only way to read an app's name. Rearranging is a pointer gesture, and
 * only that: it is personalisation, and navigation — which the links are — must
 * stay one keystroke for a visitor who never drags anything.
 */
export function Dock({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname()
  const order = useSyncExternalStore(
    subscribeDockOrder,
    dockOrderSnapshot,
    dockOrderServerSnapshot,
  )
  const nav = useRef<HTMLElement>(null)
  /** The press in progress: where it began, and whether it has become a drag. */
  const drag = useRef<{
    href: string
    x: number
    y: number
    active: boolean
  } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  /** A drag's release is followed by a click, which is not a selection. */
  const swallowed = useRef(false)

  /** The icons' slots as they are laid out right now. */
  function slots(): Slot[] {
    const icons = nav.current?.querySelectorAll<HTMLElement>("[data-dock-app]")
    if (!icons) return []
    return Array.from(icons).map((icon) => {
      const { left, top, right, bottom } = icon.getBoundingClientRect()
      return { href: icon.dataset.dockApp!, left, top, right, bottom }
    })
  }

  function endDrag() {
    drag.current = null
    setDragging(null)
  }

  return (
    <nav
      ref={nav}
      data-os-chrome
      aria-label="Applications"
      className={cn(
        // `self-center` is what makes the bar hug its applications on narrow
        // screens: a flex item in a column stretches to the full width by
        // default, and centring it is what lets it size to its contents. In
        // the row from `md` up it is inert — the rail was already that width.
        "os-glass flex shrink-0 items-center justify-center gap-1 self-center rounded-2xl border p-1.5 shadow-2xl md:flex-col md:gap-1.5 md:p-2",
        // Overlaid, the offsets are the position the in-flow variant would
        // have had (centred, the same 8px from the viewport bottom on narrow)
        // — so the Dock does not move when the visitor navigates, it only
        // stops taking room. `md:my-auto` becomes an explicit centring, the
        // row it used to centre itself in being the viewport tall anyway.
        overlay
          ? "absolute bottom-2 left-1/2 z-20 -translate-x-1/2 md:bottom-auto md:left-2 md:top-1/2 md:translate-x-0 md:-translate-y-1/2"
          : // Its right margin is given up from `md` up, where the surface's
            // own `p-3` is the whole of the room between the two panes: a
            // window stands 12px off the viewport edge, so the Dock stands
            // 12px off the window. Left at `mx-2` the Dock's own 8px would
            // stack on the surface's 12, and the gap would read as 20.
            "mx-2 mb-2 md:my-auto md:mr-0",
      )}
    >
      {order.map((app) => {
        const active = pathname === app.href
        const pinned = isPinned(app.href)
        const held = dragging === app.href

        function press(event: React.PointerEvent<HTMLAnchorElement>) {
          // A press is a selection until it moves, so whatever the last drag
          // left behind about swallowing clicks is settled and put down here.
          swallowed.current = false
          drag.current = {
            href: app.href,
            x: event.clientX,
            y: event.clientY,
            active: false,
          }
          // Capture, so the moves that decide the drop keep arriving here even
          // once the icon has travelled out from under the pointer.
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }

        function travel(event: React.PointerEvent<HTMLAnchorElement>) {
          const current = drag.current
          if (!current || current.href !== app.href) return
          if (!current.active) {
            if (
              Math.hypot(event.clientX - current.x, event.clientY - current.y) <
              DRAG_SLOP
            )
              return
            current.active = true
            setDragging(current.href)
          }
          const over = appUnder(
            { x: event.clientX, y: event.clientY },
            slots(),
          )
          // A pointer over the Desktop is a drag going nowhere.
          if (!over || isPinned(over)) return
          const next = moveTo(order, current.href, over)
          // Written on every swap rather than once at the end: a drop-only
          // write would need the drag to hold an order the store does not.
          if (next !== order) saveDockOrder(next)
        }

        function release() {
          const current = drag.current
          if (!current) return
          const wasDrag = current.active
          endDrag()
          if (wasDrag) swallowed.current = true
        }

        function click(event: React.MouseEvent<HTMLAnchorElement>) {
          if (!swallowed.current) return
          swallowed.current = false
          event.preventDefault()
        }

        return (
          <Tooltip key={app.href}>
            <TooltipTrigger
              render={
                <Link
                  href={app.href}
                  data-dock-app={app.href}
                  // The platform drags a link itself, at about the same few
                  // pixels this gesture starts at: leave the gesture to us.
                  draggable={false}
                  aria-label={app.label}
                  aria-current={active ? "page" : undefined}
                  onPointerDown={pinned ? undefined : press}
                  onPointerMove={pinned ? undefined : travel}
                  onPointerUp={pinned ? undefined : release}
                  onPointerCancel={pinned ? undefined : endDrag}
                  onClick={pinned ? undefined : click}
                  className={cn(
                    "flex size-11 items-center justify-center overflow-hidden rounded-xl transition duration-150 ease-out md:size-10",
                    active
                      ? "bg-foreground/15 text-foreground ring-1 ring-foreground/15 shadow-[inset_0_1px_0_oklch(1_0_0/12%)]"
                      : "text-foreground/55 hover:scale-105 hover:bg-foreground/8 hover:text-foreground",
                    // `touch-none` is what lets a finger drag rather than
                    // scroll, and `select-none` keeps the gesture from
                    // selecting anything on the way.
                    !pinned &&
                      "cursor-grab touch-none select-none active:cursor-grabbing",
                    held && "scale-110 bg-foreground/15 ring-2 ring-foreground/30",
                  )}
                >
                  <app.icon className="size-8 md:size-7" aria-hidden />
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
