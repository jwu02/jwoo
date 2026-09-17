"use client"

import { SceneGate } from "@/components/three/scene-gate"

import { HomeFallback } from "./home-fallback"

// Module-scope so the gate resolves the canvas once, rather than rebuilding the
// loaded component on every render.
const loadHomeCanvas = () =>
  import("./home-canvas").then((m) => ({ default: m.HomeCanvas }))

// `isolate` keeps the scene its own stacking context. The drei <Html> labels
// (the greeting and the hover tooltips) write an inline z-index in the millions
// — drei's default zIndexRange of [16777271, 0] — and nothing else between here
// and <body> forms a stacking context, so without this they paint over the nav
// menu: the mobile sheet at z-50, the desktop sidebar at z-10. Scoping their
// z-index here means the scene as a whole sits at z-index auto, below both.
//
// No three imports here on purpose: this module is in the route's eager graph,
// and only the lazily loaded canvas may pull three in (ADR 0001). The desktop
// nav calls this module directly.
export function HomeScene() {
  return (
    <SceneGate
      load={loadHomeCanvas}
      containerClassName="relative isolate h-[calc(100vh-3.5rem)] overflow-hidden md:-mx-4 md:-mb-4 md:h-[100vh]"
      fallback={<HomeFallback />}
    />
  )
}
