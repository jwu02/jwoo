import { act, renderHook } from "@testing-library/react"

import { useVisualViewport } from "@/hooks/use-visual-viewport"

/** A stand-in for the browser's visual viewport, which jsdom has none of. */
class FakeVisualViewport {
  height = 0
  offsetTop = 0
  private listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    const set = this.listeners.get(type) ?? new Set()
    this.listeners.set(type, set)
    set.add(listener)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }
}

/** Put the browser into a given state: a window, and a viewport or none. */
function install(innerHeight: number, viewport: FakeVisualViewport | null) {
  Object.defineProperty(window, "innerHeight", {
    value: innerHeight,
    configurable: true,
  })
  Object.defineProperty(window, "visualViewport", {
    value: viewport,
    configurable: true,
  })
}

function cssVar(name: string) {
  return document.documentElement.style.getPropertyValue(name)
}

const originalViewport =
  window.visualViewport as unknown as FakeVisualViewport | null

afterEach(() => {
  install(768, originalViewport)
  document.documentElement.removeAttribute("style")
})

describe("useVisualViewport", () => {
  it("mirrors the visual viewport's height and offset onto the document", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 512.4
    viewport.offsetTop = 120.6
    install(800, viewport)

    renderHook(() => useVisualViewport())

    // Rounding is deliberate: the values drive a transform-free layout and
    // sub-pixel churn on every animation frame buys nothing.
    expect(cssVar("--vvh")).toBe("512px")
    expect(cssVar("--vv-top")).toBe("121px")
  })

  it("follows the viewport as the keyboard animates", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 800
    install(800, viewport)

    renderHook(() => useVisualViewport())
    expect(cssVar("--vvh")).toBe("800px")

    viewport.height = 500
    viewport.offsetTop = 300
    act(() => viewport.emit("resize"))
    expect(cssVar("--vvh")).toBe("500px")
    expect(cssVar("--vv-top")).toBe("300px")

    // The page shift can move without the height changing, and arrives as a
    // scroll rather than a resize.
    viewport.offsetTop = 340
    act(() => viewport.emit("scroll"))
    expect(cssVar("--vv-top")).toBe("340px")
  })

  // iOS 26 is known to leave `offsetTop` set after the keyboard closes. Taken
  // at face value the Shell would sit that far below the screen, with the Dock
  // and the Input bar off the bottom.
  it("ignores a left-over offset once the keyboard is gone", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 500
    viewport.offsetTop = 300
    install(800, viewport)

    renderHook(() => useVisualViewport())
    expect(cssVar("--vv-top")).toBe("300px")

    viewport.height = 800
    // Stale, and wrong.
    viewport.offsetTop = 300
    act(() => viewport.emit("resize"))

    expect(cssVar("--vv-top")).toBe("0px")
  })

  it("writes nothing where there is no visual viewport to read", () => {
    install(800, null)

    expect(() => renderHook(() => useVisualViewport())).not.toThrow()

    expect(cssVar("--vvh")).toBe("")
    expect(cssVar("--vv-top")).toBe("")
  })

  it("takes its properties and its listeners away on unmount", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 500
    viewport.offsetTop = 300
    install(800, viewport)

    const { unmount } = renderHook(() => useVisualViewport())
    expect(cssVar("--vvh")).toBe("500px")

    unmount()

    expect(cssVar("--vvh")).toBe("")
    expect(cssVar("--vv-top")).toBe("")

    viewport.height = 100
    act(() => viewport.emit("resize"))
    expect(cssVar("--vvh")).toBe("")
  })
})
