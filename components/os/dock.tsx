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

/** A box on screen. */
interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** A point on screen, in viewport coordinates. */
interface Point {
  x: number
  y: number
}

/** Whether a point is over a box. The Dock is the whole of its own box: its
 * padding and the gaps between its icons are Dock, and everything past them is
 * not — that boundary is all "off the Dock" means. */
function overBox(box: Box, { x, y }: Point): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
}

/** The application a pointer is over, if it is over one. */
function appUnder(point: Point, slots: readonly Slot[]): string | undefined {
  return slots.find((slot) => overBox(slot, point))?.href
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

/** The press in progress, and the Dock as it stood when it landed. */
interface Gesture {
  pointerId: number
  href: string
  /** Where the press landed, and where the icon stood in the Dock, both in
   * viewport coordinates: the two the hand keeps its grip by. */
  press: Point
  icon: Point
  /** Whether the press has travelled far enough to be a drag. */
  active: boolean
  /** The Dock's own box at that moment: what "off the Dock" is measured
   * against while the icon is in hand, and the size the pane holds meanwhile. */
  box: Box
}

/** Everything about the icon in hand that a render depends on. The pointer's
 * own position is not here: the hand is moved by writing to its node, and a
 * pointermove is far too frequent to be worth a render. */
interface Hand {
  href: string
  /** The icon's place in the Dock, which is where the hand starts. */
  x: number
  y: number
  /** The Dock's size while the drag lasts. */
  width: number
  height: number
  /** Whether the pointer is still over the Dock. */
  over: boolean
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
 * place. A drag picks an icon up: it leaves the Dock's flow and follows the
 * pointer anywhere on screen, held by the grip the press took. The Dock holds
 * the size it had, so the icons rearrange inside a pane that stands still;
 * while the pointer is over the Dock the place the icon left is held open for
 * it — empty, with nothing drawn in it — and carried off the Dock that place is
 * given up, so the others close up around the space it left. A drop on another's
 * place moves the icon there; a drop off the Dock decides nothing, so the
 * application keeps the place it holds and whatever the drag rearranged on the
 * way stands. Below DRAG_SLOP a press is a selection, and the link navigates as
 * it always did. The arrangement is theirs, so it is remembered between visits
 * — see `dock-order`. The Desktop is Pinned: it is not picked up, nothing is
 * dropped before it, and however far a drag wanders it is still the first icon
 * afterwards.
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
  const gesture = useRef<Gesture | null>(null)
  const handNode = useRef<HTMLDivElement>(null)
  /** Where the pointer is now, which is what the hand follows. */
  const pointer = useRef<Point>({ x: 0, y: 0 })
  const [hand, setHand] = useState<Hand | null>(null)
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

  /** Carry the hand with the pointer. The travel since the press is the whole
   * of its transform: where it stands in the Dock is its `left`/`top`, and the
   * two compose, so the icon's own place must not be counted twice. */
  function carry() {
    const element = handNode.current
    const current = gesture.current
    if (!element || !current?.active) return
    const { x, y } = pointer.current
    element.style.transform = `translate3d(${x - current.press.x}px, ${
      y - current.press.y
    }px, 0)`
  }

  /** The gesture this pointer owns, if there is one: one press at a time, and
   * only the pointer that made it. */
  function gestureFor(event: React.PointerEvent<HTMLElement>): Gesture | null {
    const current = gesture.current
    return current && current.pointerId === event.pointerId ? current : null
  }

  function endGesture() {
    gesture.current = null
    setHand(null)
  }

  /** A press on an icon, which is a selection until it moves. */
  function pickUp(event: React.PointerEvent<HTMLElement>) {
    // Whatever the last drag left behind about swallowing clicks is settled
    // here: this press is a selection until it proves otherwise.
    swallowed.current = false
    // One press owns the gesture. A second finger is a second press, not a
    // second hand.
    if (gesture.current) return
    const icon = (event.target as Element).closest<HTMLElement>("[data-dock-app]")
    const href = icon?.dataset.dockApp
    // The Desktop is Pinned: there is nothing to pick it up with.
    if (!icon || !href || isPinned(href)) return

    const box = event.currentTarget.getBoundingClientRect()
    const place = icon.getBoundingClientRect()
    gesture.current = {
      pointerId: event.pointerId,
      href,
      press: { x: event.clientX, y: event.clientY },
      icon: { x: place.left - box.left, y: place.top - box.top },
      active: false,
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
    }
    // Capture on the Dock rather than on the icon: the icon leaves the flow the
    // moment the drag begins, and a captured element that is gone takes the
    // moves with it.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function travel(event: React.PointerEvent<HTMLElement>) {
    const current = gestureFor(event)
    if (!current) return
    pointer.current = { x: event.clientX, y: event.clientY }

    const over = overBox(current.box, pointer.current)
    if (!current.active) {
      if (
        Math.hypot(event.clientX - current.press.x, event.clientY - current.press.y) <
        DRAG_SLOP
      )
        return
      current.active = true
      setHand({
        href: current.href,
        x: current.icon.x,
        y: current.icon.y,
        width: current.box.right - current.box.left,
        height: current.box.bottom - current.box.top,
        over,
      })
    } else {
      // Only a crossing re-renders: carrying the icon off the Dock gives up the
      // place it left, and carrying it back holds the place open again.
      setHand((state) => (state && state.over !== over ? { ...state, over } : state))
    }

    // Rectangles are read before the hand is moved, so the transform write is
    // never followed by a read of the layout it belongs to.
    if (over) {
      const under = appUnder(pointer.current, slots())
      // A pointer over the Desktop is a drag going nowhere.
      if (under && !isPinned(under)) {
        const next = moveTo(order, current.href, under)
        // Written on every swap rather than once at the end: a drop-only write
        // would need the drag to hold an order the store does not.
        if (next !== order) saveDockOrder(next)
      }
    }

    carry()
  }

  function drop(event: React.PointerEvent<HTMLElement>) {
    const current = gestureFor(event)
    if (!current) return
    const wasDrag = current.active
    endGesture()
    if (wasDrag) swallowed.current = true
  }

  function cancel(event: React.PointerEvent<HTMLElement>) {
    if (!gestureFor(event)) return
    endGesture()
  }

  function click(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!swallowed.current) return
    swallowed.current = false
    event.preventDefault()
  }

  /** The application in hand, for drawing the hand itself. */
  const picked = hand ? order.find((app) => app.href === hand.href) : undefined

  return (
    <nav
      ref={nav}
      data-os-chrome
      aria-label="Applications"
      onPointerDown={pickUp}
      onPointerMove={travel}
      onPointerUp={drop}
      onPointerCancel={cancel}
      // The pane the icons rearrange inside: the size it had when the drag
      // began, so it neither grows nor shrinks while one is in hand.
      style={hand ? { width: hand.width, height: hand.height } : undefined}
      className={cn(
        // `self-center` is what makes the bar hug its applications on narrow
        // screens: a flex item in a column stretches to the full width by
        // default, and centring it is what lets it size to its contents. In
        // the row from `md` up it is inert — the rail was already that width.
        //
        // `relative` is what the hand is placed against: it is measured from
        // the icon's place in the pane and travels well outside it. `z-10`
        // lifts the Dock over the application's surface, which is painted after
        // it — invisible at rest, since the rail never overlaps the window.
        "os-glass relative z-10 flex shrink-0 items-center justify-center gap-1 self-center rounded-2xl border p-1.5 shadow-2xl md:flex-col md:gap-1.5 md:p-2",
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
        const inHand = hand?.href === app.href

        // The icon in hand has left its place. Off the Dock that place is given
        // up, so the others close around it; still over the Dock it is held
        // open, with nothing drawn in it — the empty place is what says where
        // the icon will land.
        if (inHand && !hand.over) return null
        if (inHand)
          return (
            <span
              key={app.href}
              data-dock-place={app.href}
              className="size-11 md:size-10"
            />
          )

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

      {/* The icon in hand: out of the flow, over everything, and deaf to the
          pointer — it is what the drop hit test must see through. Where it
          stands is the icon's own place; `carry` adds the travel. */}
      {hand && picked ? (
        <div
          ref={(node) => {
            handNode.current = node
            // The hand appears a few pixels into the drag; place it the moment
            // it exists rather than waiting for the next move to bring it in.
            if (node) carry()
          }}
          aria-hidden
          data-dock-hand={hand.href}
          style={{ left: hand.x, top: hand.y }}
          className="pointer-events-none absolute z-10"
        >
          <span className="flex size-11 scale-110 items-center justify-center rounded-xl bg-foreground/15 text-foreground ring-2 ring-foreground/30 shadow-2xl md:size-10">
            <picked.icon className="size-8 md:size-7" aria-hidden />
          </span>
        </div>
      ) : null}
    </nav>
  )
}
