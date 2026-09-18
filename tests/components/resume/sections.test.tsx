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
    render(<Education title={en.titles.education} items={en.education} />)
    expect(screen.getByText("The University of Sheffield")).toBeInTheDocument()
    expect(screen.getByText("Sheffield, Sep 2020 - Jul 2023")).toBeInTheDocument()
    expect(screen.getByText("BSc Computer Science (2:1)")).toBeInTheDocument()
  })

  it("Languages renders labels, proficiency badges, and progress bars", () => {
    const { container } = render(
      <Languages title={en.titles.foreignLanguages} items={en.languages} />
    )
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.getByText("Native")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="progress"]')).toHaveLength(
      en.languages.length
    )
  })

  it("TechnicalSkills renders group and comma-joined items", () => {
    render(
      <TechnicalSkills
        title={en.titles.technicalSkills}
        items={en.technicalSkills}
      />
    )
    expect(screen.getByText(/Languages:/)).toBeInTheDocument()
    expect(screen.getByText(/Python, Java, JavaScript/)).toBeInTheDocument()
  })

  it("Interests renders outline badges", () => {
    render(<Interests title={en.titles.interests} items={en.interests} />)
    for (const interest of en.interests) {
      expect(screen.getByText(interest)).toBeInTheDocument()
    }
  })

  it("WorkExperience renders position, company, dates, and bullets", () => {
    render(
      <WorkExperience
        title={en.titles.workExperiences}
        items={en.workExperiences}
      />
    )
    expect(screen.getByText("Python Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Kam Kiu Aluminium Group")).toBeInTheDocument()
    expect(screen.getByText("May 2025 - Present")).toBeInTheDocument()
    expect(screen.getByText(en.workExperiences[0].bullets[0])).toBeInTheDocument()
  })

  it("PersonalProjects renders titles and details", () => {
    render(
      <PersonalProjects
        title={en.titles.personalProjects}
        items={en.personalProjects}
      />
    )
    expect(screen.getByText("Resume LLM Assistant")).toBeInTheDocument()
    expect(screen.getByText(en.personalProjects[0].details[0])).toBeInTheDocument()
  })

  it("SelfEvaluation renders all items", () => {
    render(
      <SelfEvaluation
        title={en.titles.selfEvaluation}
        items={en.selfEvaluation}
      />
    )
    for (const item of en.selfEvaluation) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  // The section takes its title as a prop rather than reaching into the
  // document, so it renders whatever it is handed.
  it("renders the title and items it is given", () => {
    render(<Interests title="Whatever" items={["Curling"]} />)
    expect(screen.getByText("Whatever")).toBeInTheDocument()
    expect(screen.getByText("Curling")).toBeInTheDocument()
  })
})
