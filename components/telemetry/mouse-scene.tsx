"use client"

import { SceneGate } from "@/components/three/scene-gate"

import type { MouseCanvasApi } from "./mouse-model"
import type { MouseRegion } from "@/lib/telemetry/mouse-node-map"

// Module-scope so the gate resolves the canvas once, rather than rebuilding the
// loaded component on every render.
const loadMouseCanvas = () =>
  import("./mouse-canvas").then((m) => ({ default: m.MouseCanvas }))

interface MouseSceneProps {
  hovered: MouseRegion | null
  onHover: (region: MouseRegion | null) => void
  canvasApiRef: React.MutableRefObject<MouseCanvasApi | null>
}

// The mouse fills a fixed-height box, matched to the keyboard scene so the two
// cards share a baseline. The camera frames the mouse's own footprint (it is a
// static top-down object — not draggable, so no slide path is reserved).
//
// No three imports here on purpose: this module is in the route's eager graph,
// and only the lazily loaded canvas may pull three in (ADR 0001).
export function MouseScene(props: MouseSceneProps) {
  return (
    <SceneGate
      load={loadMouseCanvas}
      contentProps={props}
      containerClassName="relative h-80 w-full"
      fallback={
        <div className="flex h-80 w-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Mouse telemetry requires WebGL.
          </p>
        </div>
      }
    />
  )
}
