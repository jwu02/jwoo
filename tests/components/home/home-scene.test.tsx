import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

import { HomeScene } from "@/components/home/home-scene"

// The canvas is client-only and needs WebGL, which jsdom lacks. Stub the heavy
// modules so importing home-scene is safe, and force the WebGL check to fail so
// HomeScene takes its fallback path.
jest.mock("next/dynamic", () => () => {
  const NoOp = ({ children }: { children?: ReactNode }) => <>{children}</>
  return NoOp
})

jest.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}))

jest.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  useProgress: () => ({ active: false, progress: 0 }),
}))

describe("HomeScene", () => {
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
})
