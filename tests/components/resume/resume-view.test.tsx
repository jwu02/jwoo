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

  it("switches to Chinese and persists the choice", async () => {
    render(<ResumeView />)
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    expect(await screen.findByText("吴家聪")).toBeInTheDocument()
    expect(window.localStorage.getItem("resume:locale")).toBe("zh")
  })

  it("switches back to English", async () => {
    render(<ResumeView />)
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    fireEvent.click(screen.getByRole("button", { name: "EN" }))
    expect(await screen.findByText("Tony Wu")).toBeInTheDocument()
  })

  it("reads a persisted locale on mount", async () => {
    window.localStorage.setItem("resume:locale", "zh")
    render(<ResumeView />)
    expect(await screen.findByText("吴家聪")).toBeInTheDocument()
  })
})
