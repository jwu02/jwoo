"use client"

import dynamic from "next/dynamic"
import { Component, type ReactNode, useEffect, useState } from "react"

import type { KeyboardCanvasApi } from "./keyboard-model"

// Client-only: three/drei never loads during SSR (a Server Component cannot use
// ssr:false, so the dynamic import lives in this client component).
const KeyboardCanvas = dynamic(
  () => import("./keyboard-canvas").then((m) => m.KeyboardCanvas),
  {
    ssr: false,
    loading: () => null,
  },
)

export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}

class SceneErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

type SceneMode = "loading" | "scene" | "fallback"

interface KeyboardSceneProps {
  tints: Record<string, string>
  hovered: string | null
  onHover: (id: string | null) => void
  canvasApiRef: React.MutableRefObject<KeyboardCanvasApi | null>
}

// The keyboard fills a fixed-aspect box (width:depth ≈ 2.5:1) so it reads as a
// single clean silhouette with no horizontal scroll, scaling with the column.
export function KeyboardScene(props: KeyboardSceneProps) {
  const [mode, setMode] = useState<SceneMode>("loading")

  useEffect(() => {
    // Client-only capability check, resolved once after mount. Rendering
    // "loading" first (rather than deriving the initial state) keeps SSR output
    // and hydration consistent. One-shot setState is intentional — there is no
    // external store to subscribe to, so the rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(isWebGLAvailable() ? "scene" : "fallback")
  }, [])

  if (mode === "scene") {
    return (
      <SceneErrorBoundary onError={() => setMode("fallback")}>
        <div className="relative aspect-[5/2] w-full">
          <div className="absolute inset-0">
            <KeyboardCanvas {...props} />
          </div>
        </div>
      </SceneErrorBoundary>
    )
  }

  if (mode === "fallback") {
    return (
      <div className="flex aspect-[5/2] w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Keyboard heatmap requires WebGL.
        </p>
      </div>
    )
  }

  // "loading" — matches SSR output so hydration stays consistent. Mirrors the
  // scene container so there is no layout shift when the canvas mounts.
  return <div className="aspect-[5/2] w-full" />
}
