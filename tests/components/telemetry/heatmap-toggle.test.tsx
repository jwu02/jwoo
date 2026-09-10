import { fireEvent, render, screen } from "@testing-library/react"

import { HeatmapToggle } from "@/components/telemetry/heatmap-toggle"

describe("HeatmapToggle", () => {
  it("reflects the showOverlay state on the switch", () => {
    render(<HeatmapToggle showOverlay onToggle={jest.fn()} />)
    expect(screen.getByRole("switch", { name: "Show keyboard heatmap" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
  })

  it("shows the switch off when showOverlay is false", () => {
    render(<HeatmapToggle showOverlay={false} onToggle={jest.fn()} />)
    expect(screen.getByRole("switch", { name: "Show keyboard heatmap" })).toHaveAttribute(
      "aria-checked",
      "false",
    )
  })

  it("calls onToggle when the switch is clicked", () => {
    const onToggle = jest.fn()
    render(<HeatmapToggle showOverlay onToggle={onToggle} />)
    fireEvent.click(screen.getByRole("switch", { name: "Show keyboard heatmap" }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("labels itself Heatmap", () => {
    render(<HeatmapToggle showOverlay onToggle={jest.fn()} />)
    expect(screen.getByText("Heatmap")).toBeInTheDocument()
  })
})
