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

/** One Dock icon's slot, in the stubbed layout below. */
const SLOT = 44

/** The names of the Dock's links, in the order they are rendered. */
function renderedLabels(): (string | null)[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label"))
}

/**
 * jsdom lays nothing out, so a Dock icon measures zero in every direction and
 * no pointer is ever over one. Stubbing the rects gives the Dock's hit test a
 * layout to work in: one 44px square per icon, left to right, in the order the
 * Dock first rendered them. Frozen for the test — a drag is sized against the
 * slots as they stood when the drag began.
 */
function stubSlots() {
  const icons = Array.from(
    document.querySelectorAll<HTMLElement>("[data-dock-app]"),
  )
  icons.forEach((icon, index) => {
    const left = index * SLOT
    icon.getBoundingClientRect = () =>
      ({
        left,
        right: left + SLOT,
        top: 0,
        bottom: SLOT,
        width: SLOT,
        height: SLOT,
        x: left,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
  })

  const indexOf = (label: string) => {
    const href = APPS.find((app) => app.label === label)!.href
    return icons.findIndex((icon) => icon.dataset.dockApp === href)
  }
  const center = (index: number) => ({
    clientX: index * SLOT + SLOT / 2,
    clientY: SLOT / 2,
  })

  return {
    /** The icon named `label`, and where a pointer lands on its slot. */
    at: (label: string) => ({
      icon: screen.getByRole("link", { name: label }),
      ...center(indexOf(label)),
    }),
    /** Press `label`, move onto `toLabel`'s slot, release. */
    drag(label: string, toLabel: string) {
      const from = this.at(label)
      fireEvent.pointerDown(from.icon, { pointerId: 1, ...center(indexOf(label)) })
      fireEvent.pointerMove(from.icon, { pointerId: 1, ...center(indexOf(toLabel)) })
      fireEvent.pointerUp(from.icon, { pointerId: 1, ...center(indexOf(toLabel)) })
      return from.icon
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
      const terminal = place.at("Terminal")

      fireEvent.pointerDown(terminal.icon, { pointerId: 1, ...terminal })
      fireEvent.pointerMove(terminal.icon, {
        pointerId: 1,
        clientX: terminal.clientX + 2,
        clientY: terminal.clientY,
      })
      fireEvent.pointerUp(terminal.icon, { pointerId: 1, ...terminal })

      expect(renderedLabels()).toEqual(APPS.map((app) => app.label))
      expect(fireEvent.click(terminal.icon)).toBe(true)
    })

    it("swallows the click that ends a drag", () => {
      renderDock()
      const place = stubSlots()

      const dragged = place.drag("Terminal", "Resume")

      expect(fireEvent.click(dragged)).toBe(false)
    })

    // A drag that ends off-window or is cancelled never gets its click, so the
    // next press must not still be paying for it: that press is a visitor
    // selecting an application, and it navigates like any other.
    it("does not let a clickless drag swallow the next press", () => {
      renderDock()
      const place = stubSlots()

      place.drag("Terminal", "Resume")

      const next = place.at("AI Usage")
      fireEvent.pointerDown(next.icon, { pointerId: 2, ...next })
      fireEvent.pointerUp(next.icon, { pointerId: 2, ...next })

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
})
