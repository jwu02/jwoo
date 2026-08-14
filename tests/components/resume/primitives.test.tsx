import { render, screen } from "@testing-library/react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

describe("resume UI primitives", () => {
  it("renders an outline badge", () => {
    render(<Badge variant="outline">Native</Badge>)
    expect(screen.getByText("Native")).toBeInTheDocument()
  })

  it("renders a progress bar", () => {
    const { container } = render(<Progress value={40} aria-label="language level" />)
    expect(container.querySelector('[data-slot="progress"]')).toBeInTheDocument()
  })
})
