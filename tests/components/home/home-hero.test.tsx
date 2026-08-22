import { render, screen } from "@testing-library/react"

import { HomeHero } from "@/components/home/home-hero"

describe("HomeHero", () => {
  it("renders the static greeting and subtitle for the fallback card grid", () => {
    render(<HomeHero />)

    expect(screen.getByText(/Hello, I'm Tony Wu\./)).toBeInTheDocument()
    expect(screen.getByText(/A personal site/)).toBeInTheDocument()
  })
})
