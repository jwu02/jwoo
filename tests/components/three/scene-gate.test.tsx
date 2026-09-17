import { render, screen } from "@testing-library/react"
import { createElement, type ComponentType } from "react"

import { SceneGate } from "@/components/three/scene-gate"

// next/dynamic is mocked the way home-scene.test.tsx mocks it: its real
// implementation resolves its chunk in a way that logs act() warnings, and what
// this suite is about is the gate's decisions, not the loader.
//
// The mock still calls `load` when — and only when — the gate actually renders
// the scene, which is what makes "three is never requested" assertable.
const loadScene = jest.fn(async () => ({ default: () => null }))

let loaded: ComponentType<never> | null = null

jest.mock("next/dynamic", () => (load: () => Promise<unknown>) => {
  const Dynamic = (props: Record<string, unknown>) => {
    void load()
    return loaded ? createElement(loaded, props as never) : null
  }
  return Dynamic
})

beforeEach(() => {
  loadScene.mockClear()
  loaded = null
})

/** Any non-null object satisfies isWebGLAvailable at runtime. */
function mockWebGL(available: boolean) {
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue((available ? {} : null) as never)
}

function renderGate(
  overrides: Partial<React.ComponentProps<typeof SceneGate>> = {},
) {
  return render(
    <SceneGate
      load={loadScene as never}
      containerClassName="relative h-96 w-full"
      fallback={<div data-testid="fallback">No WebGL</div>}
      {...overrides}
    />,
  )
}

describe("SceneGate", () => {
  afterEach(() => jest.restoreAllMocks())

  it("renders the scene once WebGL is confirmed", () => {
    mockWebGL(true)
    loaded = () => <div data-testid="scene-canvas" />

    renderGate()

    expect(screen.getByTestId("scene-canvas")).toBeInTheDocument()
    expect(screen.queryByTestId("fallback")).not.toBeInTheDocument()
  })

  it("renders the fallback, and never loads the canvas, when WebGL is unavailable", () => {
    mockWebGL(false)

    renderGate()

    expect(screen.getByTestId("fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("scene-canvas")).not.toBeInTheDocument()
    // The whole point of the gate: no WebGL means three is never requested.
    expect(loadScene).not.toHaveBeenCalled()
  })

  // The container is what reserves the scene's space, so a slow chunk cannot
  // reflow the page when the canvas arrives. It must be present before the
  // capability check resolves, too, or the first paint jumps.
  it("reserves the scene's box before the capability check resolves", () => {
    mockWebGL(true)

    const { container } = renderGate()

    expect(container.querySelector(".h-96")).not.toBeNull()
  })

  it("passes contentProps through to the loaded canvas", () => {
    mockWebGL(true)
    loaded = (({ counts }: { counts: number }) => (
      <div data-testid="counts">{counts}</div>
    )) as ComponentType<never>

    renderGate({ contentProps: { counts: 42 } })

    expect(screen.getByTestId("counts")).toHaveTextContent("42")
  })

  // Home's fallback is a scrolling card grid where the scene is a clipped
  // viewport; squeezing it into the scene's box would cut it off.
  it("renders the fallback outside the scene's box", () => {
    mockWebGL(false)

    const { container } = renderGate()

    expect(screen.getByTestId("fallback").closest(".h-96")).toBeNull()
    expect(container.querySelector(".h-96")).toBeNull()
  })

  it("falls back when the scene throws while mounting", () => {
    mockWebGL(true)
    // React logs the caught error; keep the output readable.
    jest.spyOn(console, "error").mockImplementation(() => {})
    loaded = (() => {
      throw new Error("GLB failed to build")
    }) as unknown as ComponentType<never>

    renderGate()

    expect(screen.getByTestId("fallback")).toBeInTheDocument()
  })
})
