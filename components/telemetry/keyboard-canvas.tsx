"use client"

// Reuse the home scene's upstream THREE.Clock deprecation warning filter, so it
// runs once before this module's <Canvas> mounts (side-effect only import).
import "../home/three-console"

import { Canvas } from "@react-three/fiber"
import { Suspense } from "react"

import { KeyboardModel, type KeyboardCanvasApi } from "./keyboard-model"

interface KeyboardCanvasProps {
  counts: Map<string, number>
  maxCount: number
  showOverlay: boolean
  hovered: string | null
  onHover: (id: string | null) => void
  canvasApiRef: React.MutableRefObject<KeyboardCanvasApi | null>
}

export function KeyboardCanvas({
  counts,
  maxCount,
  showOverlay,
  hovered,
  onHover,
  canvasApiRef,
}: KeyboardCanvasProps) {
  return (
    <Canvas
      // NoToneMapping (flat) is a deliberate deviation from the home scene: the
      // cap tint IS the data encoding, and ACES compresses/desaturates exactly
      // the mid-tones the ramp uses. flat keeps the colour mapping faithful.
      flat
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{
        fov: 40,
        near: 0.01,
        far: 2,
        position: [0, 0.4, 0],
      }}
    >
      {/* The GLB ships no lights, so these fill both themes. Tunable in dev. */}
      <hemisphereLight args={[0xffffff, 0x2e2e2e, 0.55]} />
      <directionalLight position={[0.15, 1, 0.1]} intensity={1.4} />
      <Suspense fallback={null}>
        <KeyboardModel
          counts={counts}
          maxCount={maxCount}
          showOverlay={showOverlay}
          hovered={hovered}
          onHover={onHover}
          canvasApiRef={canvasApiRef}
        />
      </Suspense>
    </Canvas>
  )
}
