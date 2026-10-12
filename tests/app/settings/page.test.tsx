import { fireEvent, render, screen, within } from "@testing-library/react"

import SettingsPage from "@/app/settings/page"
import { APPS } from "@/components/os/apps"
import { APPEARANCE_KEY } from "@/components/os/appearance"
import { saveDockOrder } from "@/components/os/dock-order"

/** An order built from hrefs, the way the Dock hands one to the store. */
function orderOf(...wanted: string[]) {
  return wanted.map((href) => APPS.find((app) => app.href === href)!)
}

/** The labels of the current-arrangement list, in order. */
function arrangementLabels(): string[] {
  const list = screen.getByRole("list", { name: "Current Dock arrangement" })
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "")
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove("dark")
})

describe("Settings page", () => {
  it("renders one scrolling column with no category navigation", () => {
    render(<SettingsPage />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Desktop & Dock" }),
    ).toBeInTheDocument()

    // No inner navigation: the Dock is the site's only navigation.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  // The Desktop's portrait fills whatever box it is given rather than taking a
  // size class, so the row's glyph must sit in a fixed-size box or the image
  // resolves to the width of the window.
  it("gives each application's glyph a fixed-size box", () => {
    render(<SettingsPage />)

    const home = screen.getByText("Home").closest("li")!
    expect(home.querySelector("span.size-6")).toBeInTheDocument()
  })

  it("shows the Dock's current arrangement", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal", "/settings"))

    render(<SettingsPage />)

    expect(arrangementLabels()).toEqual([
      "Home",
      "Resume",
      "Terminal",
      "Settings",
    ])
  })

  it("puts the declared order back when reset is clicked", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal", "/settings"))

    render(<SettingsPage />)
    expect(arrangementLabels()).not.toEqual(APPS.map((app) => app.label))

    fireEvent.click(
      screen.getByRole("button", { name: "Reset Dock arrangement" }),
    )

    expect(arrangementLabels()).toEqual(APPS.map((app) => app.label))
    expect(window.localStorage.getItem("dock.order")).toBe(
      JSON.stringify(APPS.map((app) => app.href)),
    )
  })
})

describe("Appearance", () => {
  // The visitor's own system reports nothing under jsdom, so a fresh visit is
  // light and the control has to say so before they ever choose.
  it("shows the appearance in effect, then applies and remembers a choice", () => {
    render(<SettingsPage />)

    const light = screen.getByRole("button", { name: "Light" })
    const dark = screen.getByRole("button", { name: "Dark" })
    expect(light).toHaveAttribute("aria-pressed", "true")
    expect(dark).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(dark)

    expect(dark).toHaveAttribute("aria-pressed", "true")
    expect(light).toHaveAttribute("aria-pressed", "false")
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("starts from the appearance a previous visit chose", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")

    render(<SettingsPage />)

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})
