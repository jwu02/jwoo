"use client"

import { useEffect } from "react"

/**
 * Mirror the visual viewport's height onto `--vvh` on the document.
 *
 * The software keyboard takes the *layout* viewport but not the visual one, so
 * anything sized in `vh`/`svh` keeps its full height and the keyboard covers its
 * bottom edge — for the Terminal, the Input bar. `--vvh` is the smaller height,
 * so the pane can shrink above the keyboard instead.
 *
 * The pane reads it, not the Shell: the Dock is a bar along the bottom of the
 * window, and the keyboard landing on top of it is the Dock doing nothing wrong.
 *
 * Written straight to the element rather than through React state: iOS fires on
 * every frame of the keyboard animation, and none of it needs a render. Where
 * the API is missing — older browsers, jsdom — nothing is written and the pane's
 * `100svh` fallback holds instead.
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    const measure = () => {
      // Rounded: the value drives a layout, and sub-pixel churn on every frame
      // of the animation buys nothing.
      root.style.setProperty("--vvh", `${Math.round(viewport.height)}px`)
    }

    measure()
    viewport.addEventListener("resize", measure)
    // iOS has been known to carry a keyboard-driven height change on a scroll
    // event rather than a resize, and re-measuring costs nothing.
    viewport.addEventListener("scroll", measure)
    return () => {
      viewport.removeEventListener("resize", measure)
      viewport.removeEventListener("scroll", measure)
      root.style.removeProperty("--vvh")
    }
  }, [])
}
