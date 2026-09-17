"use client"

// Side-effect setup: filters the upstream R3F THREE.Clock deprecation warning.
// Imported first so it runs before any <Canvas> in this process mounts.
import "./three-console"

import { Canvas } from "@react-three/fiber"
import { Suspense, type ReactNode } from "react"

// The one WebGL rig every 3D scene mounts through. It owns the parts that were
// identical across the home, keyboard and mouse canvases — the renderer props,
// the render loop's Suspense boundary, and the hemisphere fill — so a scene
// declares only what actually differs about its camera, lights and content.
//
// A scene reaches this through <SceneGate>, which keeps three out of the
// eagerly-loaded route graph (see ADR 0001). Never import this from a file a
// page imports directly.

type Vec3 = [number, number, number]

// Hemisphere fill shared by all three scenes. The GLBs ship no ambient of their
// own (home's room light is a punctual spot inside homepage.glb), so this keeps
// shadowed areas off pure black. The dark gray background lets underside faces
// pick up a faint tint. Value is tuned in dev.
const HEMISPHERE_ARGS = [0xffffff, 0x2e2e2e, 0.55] as const

// Key light for the telemetry GLBs, which ship no lights at all. Home's model
// carries its own authored lighting and passes `directional={false}`.
const DIRECTIONAL_POSITION: Vec3 = [0.15, 1, 0.1]
const DIRECTIONAL_INTENSITY = 1.4

export interface SceneCanvasProps {
  /**
   * Camera props. `near`/`far` are passed through only when the scene sets
   * them, so a scene that omits them keeps the renderer's own defaults.
   */
  camera: {
    fov: number
    position: Vec3
    near?: number
    far?: number
  }
  /**
   * Flat (NoToneMapping) output. Deliberate per scene: the keyboard and mouse
   * cap/region tints ARE the data encoding, and ACES compresses exactly the
   * mid-tones their colour ramps use. Home leaves tone mapping on.
   */
  flat?: boolean
  /** Adds the telemetry key light. `false` for scenes lit inside their GLB. */
  directional?: boolean
  /** In-canvas content — models, controllers. Must render only three objects. */
  children: ReactNode
}

export function SceneCanvas({
  camera,
  flat = false,
  directional = true,
  children,
}: SceneCanvasProps) {
  return (
    <Canvas
      flat={flat}
      // Cap device pixel ratio at 1.5: the fullscreen hero canvas on a Retina
      // display would otherwise render at 2x (4x the pixel fill), which —
      // combined with the heavy home scene and its rect area lights — is what
      // made panning to the car lag. 1.5 keeps it sharp on 2x/3x displays while
      // roughly halving the fill cost. Tunable in dev.
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{
        fov: camera.fov,
        position: camera.position,
        ...(camera.near !== undefined && { near: camera.near }),
        ...(camera.far !== undefined && { far: camera.far }),
      }}
    >
      <hemisphereLight args={[...HEMISPHERE_ARGS]} />
      {directional && (
        <directionalLight
          position={DIRECTIONAL_POSITION}
          intensity={DIRECTIONAL_INTENSITY}
        />
      )}
      {/* Models load asynchronously; a null fallback keeps the canvas showing
          whatever has resolved rather than blanking it while a GLB streams in. */}
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  )
}
