import { render, screen } from "@testing-library/react"

import { OSShell } from "@/components/os/os-shell"
import { TooltipProvider } from "@/components/ui/tooltip"

// The route the Shell reads. `mock`-prefixed so the `jest.mock` factory below
// is allowed to close over it.
let mockPathname = "/resume"

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))

// The Shell mounts TooltipProvider in app/layout.tsx; the Dock's hover labels
// are tooltips and need it.
function renderShell(children: React.ReactNode = <p>an application</p>) {
  return render(
    <TooltipProvider>
      <OSShell>{children}</OSShell>
    </TooltipProvider>,
  )
}

describe("Shell titlebar", () => {
  // An application window names itself, and does it in the window rather than
  // in the page it holds — which is what makes the titlebar the same on every
  // route instead of a thing each page has to remember to draw.
  it("names the window after the active application", () => {
    mockPathname = "/resume"
    renderShell()

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Resume",
    )
  })

  // Named by the same registry the Dock reads, so an application the Dock does
  // not list is still titled.
  it("names a route the Dock does not list", () => {
    mockPathname = "/tetris"
    renderShell()

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tetris",
    )
  })

  // Home is the desktop: the wallpaper the windows appear over. It has no
  // window of its own, so it has no titlebar.
  it("leaves the desktop untitled", () => {
    mockPathname = "/"
    renderShell()

    expect(
      screen.queryByRole("heading", { level: 1 }),
    ).not.toBeInTheDocument()
  })
})
