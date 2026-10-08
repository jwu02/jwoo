"use client"

import { useEffect } from "react"

/**
 * Mirror the visual viewport's height onto `--vvh` on the document.
 *
 * The software keyboard takes the *layout* viewport but not the visual one, so
 * a Shell sized in `vh`/`svh` keeps its full height and the keyboard covers its
 * bottom edge — for the Terminal, the Input bar. `--vvh` is the smaller height,
 * so the Shell can shrink above the keyboard instead.
 *
 * Written straight to the element rather than through React state: iOS fires
 * `resize` on every frame of the keyboard animation, and none of it needs a
 * render. Where the API is missing — older browsers, jsdom — nothing is
 * written and the Shell's `100svh` fallback holds instead.
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    const measure = () =>
      root.style.setProperty("--vvh", `${Math.round(viewport.height)}px`)

    measure()
    viewport.addEventListener("resize", measure)
    return () => {
      viewport.removeEventListener("resize", measure)
      root.style.removeProperty("--vvh")
    }
  }, [])
}
