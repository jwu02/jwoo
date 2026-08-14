import { render, screen } from "@testing-library/react"

describe("Contacts", () => {
  it("renders nothing when no contact env vars are set", () => {
    delete process.env.NEXT_PUBLIC_EMAIL
    delete process.env.NEXT_PUBLIC_PHONE
    delete process.env.NEXT_PUBLIC_GITHUB
    delete process.env.NEXT_PUBLIC_WECHAT
    jest.resetModules()
    const { Contacts } = jest.requireActual<typeof import("@/components/resume/contacts")>(
      "@/components/resume/contacts"
    )
    render(<Contacts />)
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
  })
})
