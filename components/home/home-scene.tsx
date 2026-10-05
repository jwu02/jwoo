"use client"

import { SceneGate } from "@/components/scene-gate"

import { HomeFallback } from "./home-fallback"

// Module-scope so the gate resolves the canvas once, rather than rebuilding the
// loaded component on every render.
const loadHomeCanvas = () =>
  import("./home-canvas").then((m) => ({ default: m.HomeCanvas }))

// `isolate` keeps the scene its own stacking context. The drei <Html> labels
// (the greeting and the hover tooltips) write an inline z-index in the millions
// — drei's default zIndexRange of [16777271, 0] — and nothing else between here
// and <body> forms a stacking context, so without this they paint over the OS
// chrome. Scoping their z-index here means the scene as a whole sits at z-index
// auto, below the Dock.
//
// `absolute inset-0` is the desktop: Home is unframed, and the shell hands it
// the whole viewport with nothing to cancel — the Dock floats over the box this
// fills rather than being laid out next to it.
//
// No three imports here on purpose: this module is in the route's eager graph,
// and only the lazily loaded canvas may pull three in (ADR 0001).
export function HomeScene() {
  return (
    <SceneGate
      load={loadHomeCanvas}
      containerClassName="absolute inset-0 isolate overflow-hidden"
      fallback={<HomeFallback />}
    />
  )
}
