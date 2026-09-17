"use client"

import { SceneGate } from "@/components/three/scene-gate"

import type { KeyboardCanvasApi } from "./keyboard-model"

// Module-scope so the gate resolves the canvas once, rather than rebuilding the
// loaded component on every render.
const loadKeyboardCanvas = () =>
  import("./keyboard-canvas").then((m) => ({ default: m.KeyboardCanvas }))

interface KeyboardSceneProps {
  counts: Map<string, number>
  maxCount: number
  showOverlay: boolean
  hovered: string | null
  onHover: (id: string | null) => void
  canvasApiRef: React.MutableRefObject<KeyboardCanvasApi | null>
}

// The keyboard fills a fixed-height box. The height is set taller than the mouse
// scene's h-80 so the card is more keyboard-shaped (width/height < the model's
// ~2.4:1 aspect): width then becomes the camera's binding axis, so the keyboard
// fills the card left–right instead of shrinking to fit the height. The mouse is
// left on its own (shorter) box; both models centre vertically, so they still read
// as a joined row.
//
// No three imports here on purpose: this module is in the route's eager graph,
// and only the lazily loaded canvas may pull three in (ADR 0001).
export function KeyboardScene(props: KeyboardSceneProps) {
  return (
    <SceneGate
      load={loadKeyboardCanvas}
      contentProps={props}
      containerClassName="relative h-96 w-full"
      fallback={
        <div className="flex h-96 w-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Keyboard heatmap requires WebGL.
          </p>
        </div>
      }
    />
  )
}
