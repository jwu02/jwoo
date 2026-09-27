import { render, screen } from "@testing-library/react"
import { ResumeA4Page } from "@/components/resume/resume-a4-page"
import { en } from "@/lib/resume/locale-data"
import type { ResumeData } from "@/lib/resume/types"

const WITH_CONTACT: ResumeData = {
  ...en,
  contacts: [{ key: "email", value: "tony@example.com" }],
}

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

  // Contacts travel inside the document, so the page needs no second seam.
  it("renders the contacts the document carries", () => {
    render(<ResumeA4Page data={WITH_CONTACT} />)
    expect(screen.getByText("tony@example.com")).toBeInTheDocument()
  })

  it("renders education school, dates, and qualification", () => {
    render(<ResumeA4Page data={en} />)
    expect(screen.getByText("The University of Sheffield")).toBeInTheDocument()
    expect(screen.getByText("Sheffield, Sep 2020 - Jul 2023")).toBeInTheDocument()
    expect(screen.getByText("BSc Computer Science (2:1)")).toBeInTheDocument()
  })

  it("renders language labels, proficiency badges, and progress bars", () => {
    const { container } = render(<ResumeA4Page data={en} />)
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.getByText("Native")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="progress"]')).toHaveLength(
      en.languages.length
    )
  })

  it("renders technical skill groups comma-joined", () => {
    render(<ResumeA4Page data={en} />)
    expect(screen.getByText(/Languages:/)).toBeInTheDocument()
    expect(screen.getByText(/Python, Java, JavaScript/)).toBeInTheDocument()
  })

  it("renders every interest", () => {
    render(<ResumeA4Page data={en} />)
    for (const interest of en.interests) {
      expect(screen.getByText(interest)).toBeInTheDocument()
    }
  })

  it("renders work position, company, dates, and bullets", () => {
    render(<ResumeA4Page data={en} />)
    expect(screen.getByText("Python Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Kam Kiu Aluminium Group")).toBeInTheDocument()
    expect(screen.getByText("May 2025 - Present")).toBeInTheDocument()
    expect(screen.getByText(en.workExperiences[0].bullets[0])).toBeInTheDocument()
  })

  it("renders project titles and details", () => {
    render(<ResumeA4Page data={en} />)
    expect(screen.getByText("Resume LLM Assistant")).toBeInTheDocument()
    expect(screen.getByText(en.personalProjects[0].details[0])).toBeInTheDocument()
  })

  it("renders every self-evaluation item", () => {
    render(<ResumeA4Page data={en} />)
    for (const item of en.selfEvaluation) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })
})
