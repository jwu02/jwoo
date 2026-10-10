import { printResume } from "@/lib/resume/print-resume"

// A constrained browser can hand back an iframe with no readable document (or
// window) even after it is attached to the page. Both the `afterprint` listener
// and the fallback timer are registered after those reads, so an early return
// without removing the iframe would leak it forever.
function mockIframe({
  contentDocument,
  contentWindow,
}: {
  contentDocument: unknown
  contentWindow: unknown
}) {
  const createElement = document.createElement.bind(document)
  return jest.spyOn(document, "createElement").mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions
  ) => {
    const element = createElement(tagName, options)
    if (tagName === "iframe") {
      Object.defineProperty(element, "contentDocument", {
        value: contentDocument,
      })
      Object.defineProperty(element, "contentWindow", { value: contentWindow })
    }
    return element
  }) as typeof document.createElement)
}

describe("printResume", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("removes the iframe when its document cannot be read", () => {
    const createElementSpy = mockIframe({
      contentDocument: null,
      contentWindow: null,
    })
    try {
      printResume()
      expect(document.body.querySelector("iframe")).toBeNull()
    } finally {
      createElementSpy.mockRestore()
    }
  })

  it("removes the iframe when its window cannot be read", () => {
    const createElementSpy = mockIframe({
      contentDocument: {
        open: jest.fn(),
        write: jest.fn(),
        close: jest.fn(),
        readyState: "complete",
      },
      contentWindow: null,
    })
    try {
      printResume()
      expect(document.body.querySelector("iframe")).toBeNull()
    } finally {
      createElementSpy.mockRestore()
    }
  })
})
