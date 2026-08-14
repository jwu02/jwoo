import { fireEvent, render, screen } from "@testing-library/react"
import { ResumeView } from "@/components/resume/resume-view"

describe("ResumeView", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("defaults to English", () => {
    render(<ResumeView />)
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
  })

  it("switches to Chinese and persists the choice", () => {
    render(<ResumeView />)
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    expect(screen.getByText("吴家聪")).toBeInTheDocument()
    expect(window.localStorage.getItem("resume:locale")).toBe("zh")
  })

  it("switches back to English", () => {
    render(<ResumeView />)
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    fireEvent.click(screen.getByRole("button", { name: "EN" }))
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
  })

  it("reads a persisted locale on mount", () => {
    window.localStorage.setItem("resume:locale", "zh")
    render(<ResumeView />)
    expect(screen.getByText("吴家聪")).toBeInTheDocument()
  })
})
