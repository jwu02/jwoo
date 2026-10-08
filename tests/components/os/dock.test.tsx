import { fireEvent, render, screen } from "@testing-library/react"

import { APPS } from "@/components/os/apps"
import { Dock } from "@/components/os/dock"
import { TooltipProvider } from "@/components/ui/tooltip"

jest.mock("next/navigation", () => ({
  usePathname: () => "/resume",
}))

// The app mounts TooltipProvider in app/layout.tsx; the Dock's hover labels are
// tooltips and need it.
function renderDock() {
  return render(
    <TooltipProvider>
      <Dock />
    </TooltipProvider>,
  )
}

/** One Dock icon's slot, the Dock's own padding, and the gap between icons, in
 * the stubbed layout below. These stand in for the layout the Dock's own
 * classes give it (`size-11`/`md:size-10`, `p-1.5`/`md:p-2`, `gap-1`/`md:gap-1.5`
 * and the 2px border): change one and the fixture has to follow. */
const SLOT = 44
const PAD = 8
const GAP = 6

/** The pane the icons sit in: the Dock's own box, which is the reach a pointer
 * has to stay inside for a drag to still be over the Dock. */
const PANE = {
  left: 0,
  top: 0,
  right: PAD * 2 + APPS.length * SLOT + (APPS.length - 1) * GAP,
  bottom: PAD * 2 + SLOT,
}

/** A box, as `getBoundingClientRect` reports one. */
function rect({
  left,
  top,
  right,
  bottom,
}: {
  left: number
  top: number
  right: number
  bottom: number
}) {
  return {
    left,
    top,
    right,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect
}

/** The names of the Dock's links, in the order they are rendered. */
function renderedLabels(): (string | null)[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label"))
}

/** The icon the Dock has picked up, if one is in hand. */
function hand(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-dock-hand]")
}

/** The place the Dock is holding open for the icon in hand, if it is holding
 * one: an icon off the Dock has given its place up. */
function heldPlace(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-dock-place]")
}

/**
 * jsdom lays nothing out, so a Dock icon measures zero in every direction and
 * no pointer is ever over one. Stubbing the rects gives the Dock a layout to
 * work in: one 44px slot per icon inside the pane, left to right, in the order
 * the Dock first rendered them. Frozen for the test — a drag is sized against
 * the Dock as it stood when the drag began.
 */
function stubSlots() {
  const icons = Array.from(
    document.querySelectorAll<HTMLElement>("[data-dock-app]"),
  )
  const nav = screen.getByRole("navigation", { name: "Applications" })

  const slot = (index: number) => ({ left: PAD + index * (SLOT + GAP), top: PAD })
  icons.forEach((icon, index) => {
    const { left, top } = slot(index)
    icon.getBoundingClientRect = () =>
      rect({ left, top, right: left + SLOT, bottom: top + SLOT })
  })
  nav.getBoundingClientRect = () => rect(PANE)

  const indexOf = (label: string) => {
    const href = APPS.find((app) => app.label === label)!.href
    return icons.findIndex((icon) => icon.dataset.dockApp === href)
  }
  const at = (label: string) => {
    const { left, top } = slot(indexOf(label))
    return {
      icon: screen.getByRole("link", { name: label }),
      left,
      top,
      clientX: left + SLOT / 2,
      clientY: top + SLOT / 2,
    }
  }

  return {
    /** The icon named `label`, and where a pointer lands on its slot. */
    at,
    pane: PANE,
    /** A point off the Dock entirely: past the pane's own box. */
    off: { clientX: PANE.right + 40, clientY: PANE.bottom / 2 },
    /** Press `label`'s icon, and hold it. */
    press(label: string, pointerId = 1) {
      const from = at(label)
      fireEvent.pointerDown(from.icon, {
        pointerId,
        clientX: from.clientX,
        clientY: from.clientY,
      })
      return from
    },
    /** Move the held pointer. A captured drag delivers its moves to the Dock
     * itself, wherever on screen the icon has got to. */
    move(point: { clientX: number; clientY: number }, pointerId = 1) {
      fireEvent.pointerMove(nav, { pointerId, ...point })
    },
    release(point: { clientX: number; clientY: number }, pointerId = 1) {
      fireEvent.pointerUp(nav, { pointerId, ...point })
    },
    /** Press `label`, move onto `toLabel`'s slot, release. */
    drag(label: string, toLabel: string) {
      this.press(label)
      const to = at(toLabel)
      this.move(to)
      this.release(to)
    },
  }
}

describe("Dock", () => {
  it("offers every application as a link", () => {
    renderDock()

    for (const app of APPS) {
      expect(screen.getByRole("link", { name: app.label })).toHaveAttribute(
        "href",
        app.href,
      )
    }
  })

  // The Dock stays on screen while the visitor moves between applications, so
  // marking where they are is the whole of its current-location job.
  it("marks the active application and only it", () => {
    renderDock()

    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  describe("reordering", () => {
    beforeEach(() => {
      window.localStorage.clear()
    })

    it("renders the order a previous visit arranged", () => {
      window.localStorage.setItem(
        "dock.order",
        JSON.stringify(["/", "/resume", "/terminal"]),
      )

      renderDock()

      expect(renderedLabels()).toEqual([
        "Home",
        "Resume",
        "Terminal",
        "Activity Telemetry",
        "AI Usage",
        "Knowledge Graph",
      ])
    })

    it("moves a dragged application into the slot it was dropped on, and remembers it", () => {
      renderDock()
      const place = stubSlots()

      place.drag("Resume", "Activity Telemetry")

      expect(renderedLabels()).toEqual([
        "Home",
        "Terminal",
        "Resume",
        "Activity Telemetry",
        "AI Usage",
        "Knowledge Graph",
      ])
      expect(window.localStorage.getItem("dock.order")).toBe(
        JSON.stringify([
          "/",
          "/terminal",
          "/resume",
          "/activity-telemetry",
          "/ai-usage",
          "/knowledge-graph",
        ]),
      )
    })

    // The Desktop is Pinned: nothing is dropped before it, and it is not
    // dragged anywhere either.
    it("leaves the Desktop in the first slot", () => {
      renderDock()
      const place = stubSlots()

      place.drag("Terminal", "Home")

      expect(renderedLabels()[0]).toBe("Home")
      expect(renderedLabels()).toEqual(APPS.map((app) => app.label))
      expect(window.localStorage.getItem("dock.order")).toBeNull()
    })

    // A press is how a visitor selects an application; only a press that moves
    // is a drag, and a drag must not also navigate on release.
    it("leaves a press that never moved alone, and lets it reach the link", () => {
      renderDock()
      const place = stubSlots()

      const terminal = place.press("Terminal")
      const near = { clientX: terminal.clientX + 2, clientY: terminal.clientY }
      place.move(near)
      place.release(near)

      expect(renderedLabels()).toEqual(APPS.map((app) => app.label))
      expect(fireEvent.click(terminal.icon)).toBe(true)
    })

    it("swallows the click that ends a drag", () => {
      renderDock()
      const place = stubSlots()

      place.drag("Terminal", "Resume")

      // The drag put the icon back in the Dock, so that is where the click the
      // browser sends after a release lands — and it must not navigate.
      expect(
        fireEvent.click(screen.getByRole("link", { name: "Terminal" })),
      ).toBe(false)
    })

    // A drag that ends off-window or is cancelled never gets its click, so the
    // next press must not still be paying for it: that press is a visitor
    // selecting an application, and it navigates like any other.
    it("does not let a clickless drag swallow the next press", () => {
      renderDock()
      const place = stubSlots()

      place.drag("Terminal", "Resume")

      const next = place.press("AI Usage", 2)
      place.release(next, 2)

      expect(fireEvent.click(next.icon)).toBe(true)
    })

    // A link drags natively in the browser: without this the platform's own
    // link drag starts at about the same few pixels and takes the gesture.
    it("asks the browser not to drag its icons itself", () => {
      renderDock()

      expect(screen.getByRole("link", { name: "Terminal" })).toHaveAttribute(
        "draggable",
        "false",
      )
    })
  })

  describe("the icon in hand", () => {
    beforeEach(() => {
      window.localStorage.clear()
    })

    /** How far the pointer has carried the icon in hand: where the icon stands
     * in the Dock is the hand's own `left`/`top`, and this composes with it. */
    const carried = (
      grabbed: { clientX: number; clientY: number },
      point: { clientX: number; clientY: number },
    ) =>
      `translate3d(${point.clientX - grabbed.clientX}px, ${
        point.clientY - grabbed.clientY
      }px, 0)`

    it("follows the pointer out of the Dock and back", () => {
      renderDock()
      const place = stubSlots()
      const terminal = place.at("Terminal")

      expect(hand()).toBeNull()

      place.press("Terminal")
      place.move(place.off)

      expect(hand()).toHaveAttribute("data-dock-hand", "/terminal")
      // It starts where the icon stood and is carried from there: `left`/`top`
      // and `transform` compose, so the icon's place must be in exactly one of
      // them.
      expect(hand()!.style.left).toBe(`${terminal.left}px`)
      expect(hand()!.style.top).toBe(`${terminal.top}px`)
      expect(hand()!.style.transform).toBe(carried(terminal, place.off))

      // Back over the Dock, still in hand: it is the pointer it follows, not
      // the Dock it is over.
      const back = place.at("Resume")
      place.move(back)

      expect(hand()!.style.transform).toBe(carried(terminal, back))

      // It is not the Dock's: a hand sits under the pointer, and a drop
      // hit-tests what it is over, so the two must not be the same thing.
      expect(hand()).not.toHaveAttribute("data-dock-app")
    })

    it("gives up the place it left off the Dock, and holds the Dock's size", () => {
      renderDock()
      const place = stubSlots()
      const nav = screen.getByRole("navigation", { name: "Applications" })

      place.press("Terminal")
      place.move(place.off)

      // Off the Dock the others close up: nothing stands where it did.
      expect(heldPlace()).toBeNull()
      expect(renderedLabels()).toEqual([
        "Home",
        "Activity Telemetry",
        "AI Usage",
        "Knowledge Graph",
        "Resume",
      ])
      // The pane holds the size it had, so the Dock itself stays put while the
      // icons rearrange inside it.
      expect(nav.style.width).toBe(`${PANE.right}px`)
      expect(nav.style.height).toBe(`${PANE.bottom}px`)

      place.release(place.off)

      expect(hand()).toBeNull()
      expect(heldPlace()).toBeNull()
      expect(renderedLabels()).toEqual(APPS.map((app) => app.label))
      expect(nav.style.width).toBe("")
      expect(nav.style.height).toBe("")
      expect(window.localStorage.getItem("dock.order")).toBeNull()
    })

    // "Off the Dock" is the Dock's own box: its padding, and the gaps between
    // its icons, are still the Dock.
    it("keeps an application whose pointer is over the Dock's own padding", () => {
      renderDock()
      const place = stubSlots()
      const padding = { clientX: 2, clientY: 2 }

      place.press("Resume")
      place.move(padding)

      expect(heldPlace()).toHaveAttribute("data-dock-place", "/resume")

      place.release(padding)

      expect(renderedLabels()).toEqual(APPS.map((app) => app.label))
    })

    // Leaving the Dock is not a cancel: what the drag rearranged on the way
    // stands, and the application keeps the place it holds.
    it("keeps the rearranging a drag did before it left the Dock", () => {
      renderDock()
      const place = stubSlots()

      place.press("Resume")
      place.move(place.at("Activity Telemetry"))
      place.move(place.off)
      place.release(place.off)

      expect(renderedLabels()).toEqual([
        "Home",
        "Terminal",
        "Resume",
        "Activity Telemetry",
        "AI Usage",
        "Knowledge Graph",
      ])
      expect(window.localStorage.getItem("dock.order")).not.toBeNull()
    })

    it("does not pick up the Pinned application", () => {
      renderDock()
      const place = stubSlots()

      place.press("Home")
      place.move(place.off)

      expect(hand()).toBeNull()
      expect(heldPlace()).toBeNull()
      expect(renderedLabels()).toEqual(APPS.map((app) => app.label))
    })
  })
})
