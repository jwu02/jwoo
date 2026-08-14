import { render, screen } from "@testing-library/react"
import { Education } from "@/components/resume/education"
import { Interests } from "@/components/resume/interests"
import { Languages } from "@/components/resume/languages"
import { PersonalProjects } from "@/components/resume/personal-projects"
import { SelfEvaluation } from "@/components/resume/self-evaluation"
import { TechnicalSkills } from "@/components/resume/technical-skills"
import { WorkExperience } from "@/components/resume/work-experience"
import { en } from "@/lib/resume/locale-data"

describe("resume section components", () => {
  it("Education renders school, dates, and qualification", () => {
    render(<Education data={en} />)
    expect(screen.getByText("The University of Sheffield")).toBeInTheDocument()
    expect(screen.getByText("Sheffield, Sep 2020 - Jul 2023")).toBeInTheDocument()
    expect(screen.getByText("BSc Computer Science (2:1)")).toBeInTheDocument()
  })

  it("Languages renders labels, proficiency badges, and progress bars", () => {
    const { container } = render(<Languages data={en} />)
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.getByText("Native")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="progress"]')).toHaveLength(
      en.languages.length
    )
  })

  it("TechnicalSkills renders group and comma-joined items", () => {
    render(<TechnicalSkills data={en} />)
    expect(screen.getByText(/Programming Languages:/)).toBeInTheDocument()
    expect(screen.getByText(/Python, Java, JavaScript/)).toBeInTheDocument()
  })

  it("Interests renders outline badges", () => {
    render(<Interests data={en} />)
    for (const interest of en.interests) {
      expect(screen.getByText(interest)).toBeInTheDocument()
    }
  })

  it("WorkExperience renders position, company, dates, and bullets", () => {
    render(<WorkExperience data={en} />)
    expect(screen.getByText("Python Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Kamkiu Aluminium Products")).toBeInTheDocument()
    expect(screen.getByText("May 2025 - Present")).toBeInTheDocument()
    expect(screen.getByText(en.workExperiences[0].bullets[0])).toBeInTheDocument()
  })

  it("PersonalProjects renders titles and details", () => {
    render(<PersonalProjects data={en} />)
    expect(screen.getByText("Resume LLM Assistant")).toBeInTheDocument()
    expect(screen.getByText(en.personalProjects[0].details[0])).toBeInTheDocument()
  })

  it("SelfEvaluation renders all items", () => {
    render(<SelfEvaluation data={en} />)
    for (const item of en.selfEvaluation) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })
})
