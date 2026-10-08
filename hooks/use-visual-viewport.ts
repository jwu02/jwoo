"use client"

import { useEffect } from "react"

/**
 * Mirror the visual viewport onto `--vvh` (its height) and `--vv-top` (how far
 * down the page iOS has shifted it) on the document.
 *
 * The software keyboard takes the *layout* viewport but not the visual one, so
 * a Shell sized in `vh`/`svh` keeps its full height and the keyboard covers its
 * bottom edge — for the Terminal, the Input bar. `--vvh` is the smaller height,
 * so the Shell can shrink above the keyboard instead.
 *
 * The offset is the other half of the same deal: rather than shrink anything,
 * iOS scrolls the page up to reveal the field being focused, which drags a
 * pinned element off the top. `--vv-top` is how far it moved, so the Shell can
 * come back down with it.
 *
 * Written straight to the element rather than through React state: iOS fires on
 * every frame of the keyboard animation, and none of it needs a render. Where
 * the API is missing — older browsers, jsdom — nothing is written and the
 * Shell's `100svh` fallback holds instead.
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    const measure = () => {
      root.style.setProperty("--vvh", `${Math.round(viewport.height)}px`)
      // A visual viewport as tall as the layout one means no keyboard, so any
      // offset left over is stale — iOS 26 is known to leave `offsetTop` set
      // after the keyboard closes, which would pin the Shell off the bottom.
      const shifted = window.innerHeight - viewport.height > 1
      root.style.setProperty(
        "--vv-top",
        `${shifted ? Math.round(viewport.offsetTop) : 0}px`
      )
    }

    measure()
    viewport.addEventListener("resize", measure)
    viewport.addEventListener("scroll", measure)
    return () => {
      viewport.removeEventListener("resize", measure)
      viewport.removeEventListener("scroll", measure)
      root.style.removeProperty("--vvh")
      root.style.removeProperty("--vv-top")
    }
  }, [])
}
