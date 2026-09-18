import { render, screen } from "@testing-library/react"

import { HomeGreeting } from "@/components/home/home-greeting"
import { HOME_GREETING } from "@/components/home/scene-config"

describe("HomeGreeting", () => {
  it("renders the static greeting and subtitle for the fallback card grid", () => {
    render(<HomeGreeting />)

    expect(screen.getByText(HOME_GREETING.text)).toBeInTheDocument()
    expect(screen.getByText(/A personal site/)).toBeInTheDocument()
  })

  it("says the same words the 3D scene types", () => {
    // The scene and the fallback are two faces of the same page: the greeting is
    // declared once (HOME_GREETING) precisely so a reworded greeting cannot land
    // in one and not the other.
    render(<HomeGreeting />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(HOME_GREETING.text)
  })
})
