import { render, screen } from "@testing-library/react"

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
})
