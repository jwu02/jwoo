"use client"

import { SceneCanvas } from "@/components/three/scene-canvas"

import { MouseModel, type MouseCanvasApi } from "./mouse-model"
import type { MouseRegion } from "@/lib/telemetry/mouse-node-map"

interface MouseCanvasProps {
  hovered: MouseRegion | null
  onHover: (region: MouseRegion | null) => void
  canvasApiRef: React.MutableRefObject<MouseCanvasApi | null>
}

// Lazily loaded by MouseScene — this is where the mouse scene's three code
// lives. `flat` keeps the model's material colours faithful, matching the
// keyboard scene.
export function MouseCanvas({ hovered, onHover, canvasApiRef }: MouseCanvasProps) {
  return (
    <div className="absolute inset-0">
      <SceneCanvas
        flat
        camera={{
          // The mouse is ~2.7 world units long and fitTopDown lifts the camera
          // several units above it (vs. the tiny keyboard, which only needs
          // far: 2). A clip distance far below the camera height would cull the
          // model.
          fov: 40,
          near: 0.01,
          far: 20,
          position: [0, 1, 0],
        }}
      >
        <MouseModel hovered={hovered} onHover={onHover} canvasApiRef={canvasApiRef} />
      </SceneCanvas>
    </div>
  )
}
