"use client"

import { SceneCanvas } from "@/components/three/scene-canvas"

import { KeyboardModel, type KeyboardCanvasApi } from "./keyboard-model"

interface KeyboardCanvasProps {
  counts: Map<string, number>
  maxCount: number
  showOverlay: boolean
  hovered: string | null
  onHover: (id: string | null) => void
  canvasApiRef: React.MutableRefObject<KeyboardCanvasApi | null>
}

// Lazily loaded by KeyboardScene — this is where the keyboard scene's three code
// lives. NoToneMapping (`flat`) is a deliberate deviation from the home scene:
// the cap tint IS the data encoding, and ACES compresses/desaturates exactly the
// mid-tones the ramp uses.
export function KeyboardCanvas({
  counts,
  maxCount,
  showOverlay,
  hovered,
  onHover,
  canvasApiRef,
}: KeyboardCanvasProps) {
  return (
    <div className="absolute inset-0">
      <SceneCanvas
        flat
        camera={{
          fov: 40,
          near: 0.01,
          far: 2,
          position: [0, 0.4, 0],
        }}
      >
        <KeyboardModel
          counts={counts}
          maxCount={maxCount}
          showOverlay={showOverlay}
          hovered={hovered}
          onHover={onHover}
          canvasApiRef={canvasApiRef}
        />
      </SceneCanvas>
    </div>
  )
}
