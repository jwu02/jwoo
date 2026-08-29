import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

  // The print dialog must be raised for a hidden iframe document, not the live
  // one: browsers apply @media print styles to the live page while the dialog
  // is open, which flashes the site to the light print theme.
  it("prints a hidden iframe clone without printing the main window", async () => {
    const printSpy = jest.fn()
    window.print = printSpy as unknown as typeof window.print
    const iframePrintSpy = jest.fn()

    const createElement = document.createElement.bind(document)
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
        const element = createElement(tagName, options)
        if (tagName === "iframe") {
          Object.defineProperty(element, "contentWindow", {
            value: { print: iframePrintSpy, addEventListener: jest.fn() },
          })
          Object.defineProperty(element, "contentDocument", {
            value: {
              open: jest.fn(),
              write: jest.fn(),
              close: jest.fn(),
              readyState: "complete",
              querySelector: jest.fn(() => ({ outerHTML: "" })),
            },
          })
        }
        return element
      }) as typeof document.createElement)

    try {
      render(<ResumeView />)
      fireEvent.click(screen.getByRole("button", { name: /download resume/i }))

      await waitFor(() => expect(iframePrintSpy).toHaveBeenCalledTimes(1))
      expect(printSpy).not.toHaveBeenCalled()
      expect(createElementSpy).toHaveBeenCalledWith("iframe")
    } finally {
      createElementSpy.mockRestore()
    }
  })
})
