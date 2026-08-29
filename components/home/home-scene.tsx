"use client"

import dynamic from "next/dynamic"
import { Component, type ReactNode, useEffect, useState } from "react"

import { HomeFallback } from "./home-fallback"

// Client-only: three/drei never loads during SSR (a Server Component cannot use
// ssr:false, so the dynamic import lives in this client component). home-canvas
// has a named export, so resolve it via .then (documented next/dynamic pattern).
const HomeCanvas = dynamic(
  () => import("./home-canvas").then((m) => m.HomeCanvas),
  {
    ssr: false,
    loading: () => null,
  }
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

export function HomeScene() {
  const [mode, setMode] = useState<SceneMode>("loading")

  useEffect(() => {
    // Client-only capability check, resolved once after mount. Rendering
    // "loading" first (rather than deriving the initial state) keeps SSR output
    // and hydration consistent. The one-shot setState is intentional — there is
    // no external store to subscribe to, so the rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(isWebGLAvailable() ? "scene" : "fallback")
  }, [])

  if (mode === "scene") {
    return (
      <SceneErrorBoundary onError={() => setMode("fallback")}>
        <div className="relative -mx-4 -mb-4 h-[calc(100vh-3.5rem)] overflow-hidden md:h-[100vh]">
          <div className="absolute inset-0">
            <HomeCanvas />
          </div>
        </div>
      </SceneErrorBoundary>
    )
  }

  if (mode === "fallback") {
    return <HomeFallback />
  }

  // "loading" — matches SSR output so hydration is consistent; swaps after
  // mount. Mirrors the scene container so there is no layout shift when the
  // canvas mounts (the greeting lives in-scene, above the MacBook).
  return (
    <div className="relative -mx-4 -mb-4 h-[calc(100vh-3.5rem)] overflow-hidden md:h-[100vh]" />
  )
}
