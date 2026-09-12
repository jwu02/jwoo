import { render, screen } from "@testing-library/react"

import { HomeScene } from "@/components/home/home-scene"

// The canvas is client-only and needs WebGL, which jsdom lacks. Stub the heavy
// modules so importing home-scene is safe. Each test then decides the path by
// mocking HTMLCanvasElement#getContext.
// Stands in for the client-only HomeCanvas. A marker is enough to locate the
// scene container in the DOM.
jest.mock("next/dynamic", () => () => {
  const MockHomeCanvas = () => <div data-testid="home-canvas" />
  return MockHomeCanvas
})

jest.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}))

jest.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  useProgress: () => ({ active: false, progress: 0 }),
}))

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

    expect(screen.getByTestId("home-canvas").closest(".isolate")).not.toBeNull()
  })
})
