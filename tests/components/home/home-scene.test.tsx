import { render, screen } from "@testing-library/react"

import { HomeScene } from "@/components/home/home-scene"

// The gate's own behaviour — capability check, fallback, error boundary — is
// tested once in tests/components/three/scene-gate.test.tsx. What's left here is
// what home decides for itself: its fallback content and its scene container.
//
// next/dynamic is stubbed so the WebGL canvas never loads; a marker is enough to
// locate the scene in the DOM. Each test then picks the path by mocking
// HTMLCanvasElement#getContext.
jest.mock("next/dynamic", () => () => {
  const MockHomeCanvas = () => <div data-testid="home-canvas" />
  return MockHomeCanvas
})

describe("HomeScene", () => {
  afterEach(() => jest.restoreAllMocks())

  it("renders the card-grid fallback when WebGL is unavailable", () => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

    render(<HomeScene />)

    expect(screen.getByRole("button", { name: /view dashboard/i })).toHaveAttribute(
      "href",
      "/activity-telemetry",
    )
    expect(screen.getByRole("button", { name: /open graph/i })).toHaveAttribute(
      "href",
      "/knowledge-graph",
    )
  })

  // The greeting ("Hi, I'm Tony.") and the hover tooltips are drei <Html>
  // labels, which write an inline z-index in the millions — drei's default
  // zIndexRange is [16777271, 0]. The nav overlay is a portaled dialog at z-50
  // (z-10 for the desktop sidebar), so with no stacking context between the
  // canvas and <body> those labels paint straight over the open nav menu.
  //
  // jsdom has no layout engine and the Tailwind classes carry no stylesheet
  // here, so this cannot assert paint order. It guards the structural fix.
  it("isolates the canvas in a stacking context so scene labels stay behind app chrome", () => {
    // getContext is overloaded and TS resolves the spy to the webgpu overload;
    // any non-null object satisfies isWebGLAvailable at runtime.
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as never)

    render(<HomeScene />)

    // The boundary renders no DOM of its own, so the container is the parent.
    const container = screen.getByTestId("home-canvas").parentElement!
    expect(container.className).toContain("isolate")
    // The scene is a clipped full-viewport box; the fallback above is
    // deliberately not, so its card grid can scroll.
    expect(container.className).toContain("h-[calc(100vh-3.5rem)]")
    expect(container.className).toContain("overflow-hidden")
  })
})
