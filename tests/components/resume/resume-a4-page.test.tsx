import { render, screen } from "@testing-library/react"
import { ResumeA4Page } from "@/components/resume/resume-a4-page"
import { en } from "@/lib/resume/locale-data"

describe("ResumeA4Page", () => {
  it("renders the header name and every section title", () => {
    render(<ResumeA4Page data={en} />)
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
    for (const title of Object.values(en.titles)) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it("carries the A4 sheet sizing classes", () => {
    const { container } = render(<ResumeA4Page data={en} />)
    const sheet = container.querySelector(".resume-page")
    expect(sheet).toHaveClass("w-[210mm]", "h-[297mm]", "bg-white")
  })
})
