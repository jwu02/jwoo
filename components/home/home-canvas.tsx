"use client"

// Side-effect setup: filters the upstream R3F THREE.Clock deprecation warning.
// Imported first so it runs before this module's <Canvas> mounts.
import "./three-console"

import { OrbitControls, useProgress } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import { setHeroMode } from "./home-hero-store"
import { fitDistance, type FocusRequest, DEFAULT_CAMERA, DEFAULT_TARGET } from "./scene-focus"
import { SceneModels } from "./scene-models"

// OrbitControls distance bounds — reused for the fly-to framing clamp. The low
// min lets the MacBook deep zoom pull in close.
const MIN_DISTANCE = 0.7
const MAX_DISTANCE = 8
// Exponential-smoothing constant: higher = snappier fly-to (~0.5s settle at 6).
const FOCUS_SPEED = 6

type FlyTo = (request: FocusRequest) => void

function LoadingBar() {
  // useProgress is a zustand store backed by three's DefaultLoadingManager,
  // so it works outside <Canvas> (verified in drei source).
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-primary transition-[width] duration-150 ease-out"
      style={{ width: `${progress}%` }}
    />
  )
}

// Lives inside <Canvas> so useThree/useFrame have access to the camera. Owns
// the OrbitControls ref and the damped fly-to tween for click-to-focus.
function SceneController({ flyToRef }: { flyToRef: { current: FlyTo | null } }) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const tween = useRef<{ toTarget: THREE.Vector3; toPos: THREE.Vector3 } | null>(null)

  const flyTo = useCallback<FlyTo>(
    (request) => {
      const controls = controlsRef.current
      if (!controls) return
      const toTarget = new THREE.Vector3(...request.point)
      let toPos: THREE.Vector3
      if (request.cameraPos) {
        // Fixed framing (desk overview / empty-space reset).
        toPos = new THREE.Vector3(...request.cameraPos)
      } else {
        // Keep the camera's current direction, but set the distance from the
        // object's size so big models (the car) fit in view instead of landing
        // the camera inside their geometry.
        const dir = camera.position.clone().sub(controls.target)
        if (dir.lengthSq() === 0) dir.set(0, 0, 1)
        const distance = THREE.MathUtils.clamp(
          fitDistance(request.radius, camera.fov),
          MIN_DISTANCE,
          MAX_DISTANCE,
        )
        toPos = toTarget.clone().add(dir.normalize().multiplyScalar(distance))
      }
      tween.current = { toTarget, toPos }
    },
    [camera],
  )

  useEffect(() => {
    flyToRef.current = flyTo
    return () => {
      flyToRef.current = null
    }
  }, [flyTo, flyToRef])

  useFrame((state, delta) => {
    const controls = controlsRef.current
    const t = tween.current
    if (!controls || !t) return
    const factor = 1 - Math.exp(-delta * FOCUS_SPEED)
    state.camera.position.lerp(t.toPos, factor)
    controls.target.lerp(t.toTarget, factor)
    controls.update()
    if (
      state.camera.position.distanceTo(t.toPos) < 0.001 &&
      controls.target.distanceTo(t.toTarget) < 0.001
    ) {
      tween.current = null
    }
  })

  return (
    <>
      <SceneModels onFocus={flyTo} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        // The user taking over (drag/zoom) cancels any in-flight fly-to.
        onStart={() => {
          tween.current = null
        }}
        // A user-initiated camera move (rotate/pan/zoom) after the fly-to has
        // settled dismisses the engaged greeting. 'change' also fires while the
        // fly-to tween is running (controls.update each frame), so gate on the
        // tween: keep the greeting visible until it settles, then hide on any
        // real camera movement. Plain clicks don't move the camera, so they
        // never dispatch 'change' and don't flicker the greeting.
        onChange={() => {
          if (!tween.current) setHeroMode("intro")
        }}
      />
    </>
  )
}

export function HomeCanvas() {
  const flyToRef = useRef<FlyTo | null>(null)

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 1.6, 3.4], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => {
          // R3F suppresses this for drags (delta > 2), so only a true click on
          // empty space restores the default framing and the intro hero.
          flyToRef.current?.({ point: DEFAULT_TARGET, radius: 0, cameraPos: DEFAULT_CAMERA })
          setHeroMode("intro")
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 5]} intensity={1.4} />
        <directionalLight position={[-5, 3, -6]} intensity={0.5} />
        <SceneController flyToRef={flyToRef} />
      </Canvas>
      <LoadingBar />
    </div>
  )
}
