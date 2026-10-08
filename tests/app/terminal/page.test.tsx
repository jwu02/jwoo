import { render, screen } from "@testing-library/react"

import TerminalPage from "@/app/terminal/page"

// The skeleton's one integration seam: the route, the Print renderer and the
// opening fixture together. The input bar is drawn but not yet driven — the
// wiring ticket is what makes it do anything.
describe("the Terminal application", () => {
  it("opens with /whoami's content above /socials'", () => {
    render(<TerminalPage />)

    const whoami = screen.getByText("/whoami")
    const socials = screen.getByText("/socials")
    // The opening print is a transcript, not a set: identity first, contacts
    // under it, in that order.
    expect(whoami.compareDocumentPosition(socials)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )

    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
    expect(screen.getByText("Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Kevala")).toBeInTheDocument()
    expect(screen.getByText("Sydney, Australia")).toBeInTheDocument()
    expect(screen.getByText("github.com/jwu02")).toBeInTheDocument()
    expect(screen.getByText("tony@jwu02.dev")).toBeInTheDocument()
  })

  it("draws the input bar's field, waiting for a later ticket to drive it", () => {
    render(<TerminalPage />)

    expect(
      screen.getByRole("textbox", { name: "Terminal input" }),
    ).toBeInTheDocument()
  })
})
