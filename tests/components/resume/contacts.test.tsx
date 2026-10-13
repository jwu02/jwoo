import { render, screen } from "@testing-library/react"
import { Contacts } from "@/components/resume/contacts"

describe("Contacts", () => {
  it("renders every contact it is handed", () => {
    render(
      <Contacts
        items={[
          { key: "email", value: "tony@example.com" },
          { key: "github", value: "jwu02" },
          { key: "website", value: "https://jwu02.com" },
        ]}
      />
    )

    expect(screen.getByText("tony@example.com")).toBeInTheDocument()
    expect(screen.getByText("jwu02")).toBeInTheDocument()
    expect(screen.getByText("https://jwu02.com")).toBeInTheDocument()
  })

  it("renders nothing when no contact is configured", () => {
    const { container } = render(<Contacts items={[]} />)

    expect(container.textContent).toBe("")
  })
})
