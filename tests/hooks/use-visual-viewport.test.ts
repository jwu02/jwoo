import { act, renderHook } from "@testing-library/react"

import { useVisualViewport } from "@/hooks/use-visual-viewport"

/** A stand-in for the browser's visual viewport, which jsdom has none of. */
class FakeVisualViewport {
  height = 0
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

/** Put the browser into a given state: a visual viewport, or none. */
function install(viewport: FakeVisualViewport | null) {
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
  install(originalViewport)
  document.documentElement.removeAttribute("style")
})

describe("useVisualViewport", () => {
  it("mirrors the visual viewport's height onto the document", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 512.4
    install(viewport)

    renderHook(() => useVisualViewport())

    expect(cssVar("--vvh")).toBe("512px")
  })

  it("follows the viewport as the keyboard animates", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 800
    install(viewport)

    renderHook(() => useVisualViewport())
    expect(cssVar("--vvh")).toBe("800px")

    viewport.height = 500
    act(() => viewport.emit("resize"))
    expect(cssVar("--vvh")).toBe("500px")

    // The height can also arrive as a scroll rather than a resize.
    viewport.height = 480
    act(() => viewport.emit("scroll"))
    expect(cssVar("--vvh")).toBe("480px")
  })

  it("writes nothing where there is no visual viewport to read", () => {
    install(null)

    expect(() => renderHook(() => useVisualViewport())).not.toThrow()

    expect(cssVar("--vvh")).toBe("")
  })

  it("takes its property and its listeners away on unmount", () => {
    const viewport = new FakeVisualViewport()
    viewport.height = 500
    install(viewport)

    const { unmount } = renderHook(() => useVisualViewport())
    expect(cssVar("--vvh")).toBe("500px")

    unmount()

    expect(cssVar("--vvh")).toBe("")

    viewport.height = 100
    act(() => viewport.emit("resize"))
    expect(cssVar("--vvh")).toBe("")
  })
})
