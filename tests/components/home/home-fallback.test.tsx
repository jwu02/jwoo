import { render, screen } from "@testing-library/react"

import { HomeFallback } from "@/components/home/home-fallback"

describe("HomeFallback", () => {
  it("renders the hero and links to all four sections", () => {
    render(<HomeFallback />)

    expect(screen.getByText(/Hi, I'm Tony\./)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /view dashboard/i })).toHaveAttribute(
      "href",
      "/activity-telemetry",
    )
    expect(screen.getByRole("button", { name: /view usage/i })).toHaveAttribute(
      "href",
      "/ai-usage",
    )
    expect(screen.getByRole("button", { name: /open graph/i })).toHaveAttribute(
      "href",
      "/knowledge-graph",
    )
    expect(screen.getByRole("button", { name: /view resume/i })).toHaveAttribute(
      "href",
      "/resume",
    )
  })
})
