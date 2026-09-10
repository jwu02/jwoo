"use client"

import dynamic from "next/dynamic"
import { Component, type ReactNode, useEffect, useState } from "react"

import type { MouseCanvasApi } from "./mouse-model"
import type { MouseRegion } from "@/lib/telemetry/mouse-node-map"

// Client-only: three/drei never loads during SSR (a Server Component cannot use
// ssr:false, so the dynamic import lives in this client component).
const MouseCanvas = dynamic(
  () => import("./mouse-canvas").then((m) => m.MouseCanvas),
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

interface MouseSceneProps {
  hovered: MouseRegion | null
  onHover: (region: MouseRegion | null) => void
  canvasApiRef: React.MutableRefObject<MouseCanvasApi | null>
}

// The mouse fills a fixed-height box, matched to the keyboard scene so the two
// cards share a baseline. The camera frames the mouse's own footprint (it is a
// static top-down object — not draggable, so no slide path is reserved).
export function MouseScene(props: MouseSceneProps) {
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
        <div className="relative h-80 w-full">
          <div className="absolute inset-0">
            <MouseCanvas {...props} />
          </div>
        </div>
      </SceneErrorBoundary>
    )
  }

  if (mode === "fallback") {
    return (
      <div className="flex h-80 w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Mouse telemetry requires WebGL.
        </p>
      </div>
    )
  }

  // "loading" — matches SSR output so hydration stays consistent.
  return <div className="h-80 w-full" />
}
