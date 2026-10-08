import { fireEvent, render, screen } from "@testing-library/react"

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

describe("Shell traffic lights", () => {
  const dock = () =>
    screen.queryByRole("navigation", { name: "Applications" })

  // Close and minimize are both departures to the Desktop — there is no
  // window manager to minimize into — so both are one navigation, to Home.
  it("sends close and minimize to the desktop", () => {
    mockPathname = "/resume"
    renderShell()

    for (const name of ["Close window", "Minimize window"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", "/")
    }
  })

  // Full screen is the one control that manages the window: it takes the
  // space the Dock held and gives it back on a second press.
  it("toggles the Dock away and back", () => {
    mockPathname = "/resume"
    renderShell()

    const green = screen.getByRole("button", { name: "Full screen" })
    expect(green).toHaveAttribute("aria-pressed", "false")
    expect(dock()).toBeInTheDocument()

    fireEvent.click(green)
    expect(green).toHaveAttribute("aria-pressed", "true")
    expect(dock()).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }))
    expect(dock()).toBeInTheDocument()
  })

  // Full screen belongs to the window, so it dies with it: any navigation —
  // red-dot home being the only one a zoomed window can make — restores the
  // Dock rather than stranding the visitor on a Dockless desktop.
  it("restores the Dock when the window is replaced", () => {
    mockPathname = "/resume"
    const { rerender } = renderShell()

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }))
    expect(dock()).not.toBeInTheDocument()

    mockPathname = "/"
    rerender(
      <TooltipProvider>
        <OSShell>
          <p>the desktop</p>
        </OSShell>
      </TooltipProvider>,
    )
    expect(dock()).toBeInTheDocument()
  })
})
