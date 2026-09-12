import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ResumeView } from "@/components/resume/resume-view"
import { TooltipProvider } from "@/components/ui/tooltip"

// The app mounts TooltipProvider in app/layout.tsx; rendering ResumeView on its
// own would leave the print-help tooltip without a provider to open against.
function renderView() {
  return render(
    <TooltipProvider>
      <ResumeView />
    </TooltipProvider>
  )
}

describe("ResumeView", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("defaults to English", () => {
    renderView()
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
  })

  it("switches to Chinese and persists the choice", async () => {
    renderView()
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    expect(await screen.findByText("吴家聪")).toBeInTheDocument()
    expect(window.localStorage.getItem("resume:locale")).toBe("zh")
  })

  it("switches back to English", async () => {
    renderView()
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    fireEvent.click(screen.getByRole("button", { name: "EN" }))
    expect(await screen.findByText("Tony Wu")).toBeInTheDocument()
  })

  it("reads a persisted locale on mount", async () => {
    window.localStorage.setItem("resume:locale", "zh")
    renderView()
    expect(await screen.findByText("吴家聪")).toBeInTheDocument()
  })

  // The print dialog is modal and covers the page, so the Chrome print
  // settings have to be readable *before* the user clicks Download.
  it("reveals the Chrome print instructions from the help trigger", async () => {
    renderView()

    const trigger = screen.getByRole("button", { name: /print settings help/i })
    fireEvent.mouseEnter(trigger)

    expect(await screen.findByText(/Chrome Print Dialog/i)).toBeInTheDocument()
    expect(screen.getByText(/Margins → None/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Background graphics → Checked/i)
    ).toBeInTheDocument()
  })

  // Hover is unreachable by keyboard, so the trigger has to be a real focusable
  // control that opens the same notice on focus.
  it("opens the print instructions on keyboard focus", async () => {
    renderView()

    fireEvent.focus(
      screen.getByRole("button", { name: /print settings help/i })
    )

    expect(await screen.findByText(/background graphics/i)).toBeInTheDocument()
  })

  it("localizes the print instructions", async () => {
    window.localStorage.setItem("resume:locale", "zh")
    renderView()

    const trigger = await screen.findByRole("button", {
      name: /打印设置帮助/,
    })
    fireEvent.mouseEnter(trigger)

    expect(await screen.findByText(/背景图形/)).toBeInTheDocument()
    expect(screen.getByText(/页边距/)).toBeInTheDocument()
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
      .mockImplementation(((
        tagName: string,
        options?: ElementCreationOptions
      ) => {
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
      renderView()
      fireEvent.click(screen.getByRole("button", { name: /download resume/i }))

      await waitFor(() => expect(iframePrintSpy).toHaveBeenCalledTimes(1))
      expect(printSpy).not.toHaveBeenCalled()
      expect(createElementSpy).toHaveBeenCalledWith("iframe")
    } finally {
      createElementSpy.mockRestore()
    }
  })
})
