import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap"

// The new 3D heatmap loads the WebGL canvas behind ssr:false dynamic imports,
// which jsdom lacks. Stub next/dynamic (and the three modules it could reach) so
// importing the wrapper is safe; the a11y layer and tooltip render independently
// of the canvas, so the WebGL-independent behaviour is what these tests cover.
jest.mock("next/dynamic", () => () => {
  const NoOp = ({ children }: { children?: ReactNode }) => <>{children}</>
  return NoOp
})

jest.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}))

jest.mock("@react-three/drei", () => ({
  useCursor: () => undefined,
  useGLTF: () => ({ scene: null }),
}))

describe("KeyboardHeatmap", () => {
  afterEach(() => jest.restoreAllMocks())

  // jsdom has no WebGL, so isWebGLAvailable() throws a "not-implemented" console
  // warning on getContext. Force it false (the realistic jsdom path) so KeyboardScene
  // takes its fallback — which is exactly what these tests exercise (a11y + tooltip
  // without a canvas).
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  })

  it("renders one focusable sr-only button per physical key (79 incl. Backtick)", () => {
    render(<KeyboardHeatmap keys={{}} showOverlay />)
    expect(screen.getAllByRole("button")).toHaveLength(79)
    expect(screen.getByRole("button", { name: /Backtick/ })).toBeInTheDocument()
    // The model has no node for the removed §/± key, but it is still announced.
    expect(screen.getByRole("button", { name: /^Section/ })).toBeInTheDocument()
  })

  it("aggregates multiple telemetry labels onto the same physical key", () => {
    // "2" key = labels ["2", "@"]; @ is shift+2, € (option+2) is not tracked.
    render(<KeyboardHeatmap keys={{ "2": 5, "@": 3 }} showOverlay />)
    expect(screen.getByRole("button", { name: "2: 8 presses" })).toBeInTheDocument()
  })

  it("labels Touch ID as untracked rather than with a count", () => {
    render(<KeyboardHeatmap keys={{}} showOverlay />)
    expect(screen.getByRole("button", { name: "Touch ID" })).toBeInTheDocument()
  })

  it("shows the count and per-label breakdown when a key is focused", () => {
    render(<KeyboardHeatmap keys={{ "2": 5, "@": 3 }} showOverlay />)
    fireEvent.focus(screen.getByRole("button", { name: "2: 8 presses" }))

    expect(screen.getByText("8 presses")).toBeInTheDocument()
    // Single-character labels are always listed, sorted by count desc.
    expect(screen.getByText("@")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    // The € option character is intentionally not tracked, so it stays hidden.
    expect(screen.queryByText("€")).not.toBeInTheDocument()
    // Counts rendered as tabular-nums.
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("clears the tooltip on blur", () => {
    render(<KeyboardHeatmap keys={{}} showOverlay />)
    const button = screen.getByRole("button", { name: "A: 0 presses" })
    fireEvent.focus(button)
    expect(screen.getByText("0 presses")).toBeInTheDocument()
    fireEvent.blur(button)
    expect(screen.queryByText("0 presses")).not.toBeInTheDocument()
  })

  it("shows Touch ID untracked copy on focus", () => {
    render(<KeyboardHeatmap keys={{}} showOverlay />)
    fireEvent.focus(screen.getByRole("button", { name: "Touch ID" }))
    expect(screen.getByText("Touch ID untracked")).toBeInTheDocument()
  })

  it("falls back to a degenerate anchor for keys with no GLB node (Section)", () => {
    // Section (§/±) has no node in the model — getAnchor is unavailable/unset in
    // jsdom, so the tooltip must still render at the container's top centre. The
    // key point is it renders without a canvas rather than failing.
    render(<KeyboardHeatmap keys={{ "§": 9, "±": 4 }} showOverlay />)
    fireEvent.focus(screen.getByRole("button", { name: /^Section/ }))
    expect(screen.getByText("13 presses")).toBeInTheDocument()
  })
})
