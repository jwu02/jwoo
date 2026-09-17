"use client"

import dynamic from "next/dynamic"
import {
  Component,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"

// Mount-time WebGL capability check. Resolved in an effect rather than derived
// from a ref so SSR output and the first client render agree.
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

export interface SceneGateProps<P extends object> {
  /**
   * Module holding the scene's canvas — the only place three is imported for
   * this scene. Must be a module-scope constant: the gate resolves it once, so
   * an inline arrow would rebuild the loaded component on every render.
   */
  load: () => Promise<{ default: ComponentType<P> }>
  /** Props forwarded to the loaded canvas component. */
  contentProps?: P
  /**
   * Shown in place of the scene when WebGL is unavailable or the scene threw.
   * Rendered bare — it brings its own layout, and must not be squeezed into the
   * scene's box (home's fallback is a scrolling card grid where the scene is a
   * clipped viewport).
   */
  fallback: ReactNode
  /** Applied to the scene's box, so the loading state reserves the same space. */
  containerClassName: string
}

/**
 * Decides whether a scene gets a canvas at all, and hands it the box to fill.
 *
 * Three things a scene must not do for itself, because getting any of them
 * wrong is invisible until it breaks on someone else's machine:
 *
 *  - **Capability.** A missing WebGL context must produce the fallback, not a
 *    thrown error inside the renderer.
 *  - **Isolation.** A scene that throws while building its GLB must take down
 *    only itself, not the page around it.
 *  - **Deferred loading.** three must never enter the route's eager module
 *    graph. The canvas is imported with `ssr: false`, so the server never
 *    evaluates it and it stays out of the first client chunk. That is why the
 *    canvas lives behind `load` instead of arriving as `children` — a statically
 *    imported child would pull three straight back into this module, and pages
 *    import this module (see ADR 0001).
 *
 * The "loading" state renders the empty container rather than the fallback, so
 * hydration matches the server and a slow chunk does not flash the "no WebGL"
 * message at visitors who have WebGL.
 */
export function SceneGate<P extends object>({
  load,
  contentProps,
  fallback,
  containerClassName,
}: SceneGateProps<P>) {
  const [mode, setMode] = useState<SceneMode>("loading")

  const SceneContent = useMemo(
    () => dynamic(load, { ssr: false, loading: () => null }) as ComponentType<P>,
    [load],
  )

  useEffect(() => {
    // Client-only capability check, resolved once after mount. Rendering
    // "loading" first (rather than deriving the initial state) keeps SSR output
    // and hydration consistent. The one-shot setState is intentional — there is
    // no external store to subscribe to, so the rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(isWebGLAvailable() ? "scene" : "fallback")
  }, [])

  if (mode === "fallback") return <>{fallback}</>

  return (
    <div className={containerClassName}>
      {mode === "scene" && (
        <SceneErrorBoundary onError={() => setMode("fallback")}>
          <SceneContent {...((contentProps ?? {}) as P)} />
        </SceneErrorBoundary>
      )}
    </div>
  )
}
