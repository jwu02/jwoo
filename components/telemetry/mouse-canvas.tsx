"use client"

// Reuse the home scene's upstream THREE.Clock deprecation warning filter, so it
// runs once before this module's <Canvas> mounts (side-effect only import).
import "../home/three-console"

import { Canvas } from "@react-three/fiber"
import { Suspense } from "react"

import { MouseModel, type MouseCanvasApi } from "./mouse-model"
import type { MouseRegion } from "@/lib/telemetry/mouse-node-map"

interface MouseCanvasProps {
  hovered: MouseRegion | null
  onHover: (region: MouseRegion | null) => void
  canvasApiRef: React.MutableRefObject<MouseCanvasApi | null>
}

export function MouseCanvas({ hovered, onHover, canvasApiRef }: MouseCanvasProps) {
  return (
    <Canvas
      // Consistent with the keyboard scene: flat keeps the model's material
      // colours faithful. The GLB ships no lights, so these fill both themes.
      flat
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{
        // The mouse is ~2.7 world units long and fitTopDown lifts the camera
        // several units above it (vs. the tiny keyboard, which only needs far: 2).
        // A clip distance far below the camera height would cull the model.
        fov: 40,
        near: 0.01,
        far: 20,
        position: [0, 1, 0],
      }}
    >
      <hemisphereLight args={[0xffffff, 0x2e2e2e, 0.55]} />
      <directionalLight position={[0.15, 1, 0.1]} intensity={1.4} />
      <Suspense fallback={null}>
        <MouseModel hovered={hovered} onHover={onHover} canvasApiRef={canvasApiRef} />
      </Suspense>
    </Canvas>
  )
}
