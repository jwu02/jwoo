import { fireEvent, render, screen } from "@testing-library/react"

import { HomeViewSwitcher } from "@/components/home/home-view-switcher"
import { HOME_VIEW_SWITCHER } from "@/components/home/scene-config"

describe("HomeViewSwitcher", () => {
  it("renders a button for each preset view", () => {
    render(<HomeViewSwitcher activeView={null} onSelectView={jest.fn()} />)

    for (const view of HOME_VIEW_SWITCHER) {
      expect(screen.getByRole("button", { name: view.label })).toBeInTheDocument()
    }
  })

  it("calls onSelectView with the view id when a button is clicked", () => {
    const onSelectView = jest.fn()
    render(<HomeViewSwitcher activeView={null} onSelectView={onSelectView} />)

    fireEvent.click(screen.getByRole("button", { name: "Desk" }))

    expect(onSelectView).toHaveBeenCalledTimes(1)
    expect(onSelectView).toHaveBeenCalledWith("desk")
  })

  it("marks the active view's button as pressed and others not", () => {
    render(<HomeViewSwitcher activeView="car" onSelectView={jest.fn()} />)

    expect(screen.getByRole("button", { name: "Xiaomi SU7" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "Desk" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })
})
