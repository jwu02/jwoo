"use client"

// Side-effect setup: filters the upstream R3F THREE.Clock deprecation warning.
// Imported first so it runs before this module's <Canvas> mounts.
import "./three-console"

import { OrbitControls, useProgress } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import { setHeroMode } from "./home-hero-store"
import { resolveHomeHotspot } from "./home-scene-resolver"
import { HomeViewSwitcher } from "./home-view-switcher"
import { setActiveView, useActiveView } from "./home-view-store"
import { HOME_HERO_ID, HOME_SCENE_HOTSPOTS, type HomeSceneHotspot } from "./scene-config"
import { fitDistance, type FocusRequest } from "./scene-focus"
import { SceneModels } from "./scene-models"

// OrbitControls distance bounds — reused for the fly-to framing clamp. The low
// min lets the MacBook deep zoom pull in close.
const MIN_DISTANCE = 0.7
const MAX_DISTANCE = 8
// Exponential-smoothing constant: higher = snappier fly-to (~0.5s settle at 6).
const FOCUS_SPEED = 6

// The desk view is the initial page-load view (see HOME_HERO_ID). Its authored
// CameraDesk pose only exists once the scene loads, so the desk preset's
// cameraPos/target double as the starting camera and controls target, and
// SceneController snaps to the exact authored pose on the first frame the scene
// resolves. The preset's hero also doubles as the initial hero.
const DESK_HOTSPOT = HOME_SCENE_HOTSPOTS.find((hotspot) => hotspot.id === HOME_HERO_ID)!
const DESK_FOCUS = DESK_HOTSPOT.focus as Extract<HomeSceneHotspot["focus"], { type: "framing" }>

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

  // One-shot snap to the desk's authored camera pose once the scene resolves.
  // `initialPoseApplied` stops the snap re-running; `applyingInitialPose` keeps
  // the snap's own 'change' (from controls.update) from counting as a user move
  // that would dismiss the greeting / active view.
  const initialPoseApplied = useRef(false)
  const applyingInitialPose = useRef(false)

  const flyTo = useCallback<FlyTo>(
    (request) => {
      const controls = controlsRef.current
      if (!controls) return
      const toTarget = new THREE.Vector3(...request.point)
      let toPos: THREE.Vector3
      if (request.cameraPos) {
        // Fixed framing (the explicit cameraPos of a framing preset).
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

  // Sync the controls' baseline on mount. OrbitControls seeds its internal
  // lastPosition at the origin, so its first frame-loop update() (drei runs it
  // at priority -1, before this controller's snap arms applyingInitialPose)
  // sees the camera seated at the desk preset, thinks it moved, and dispatches
  // 'change' — which the onChange handler mistakes for a user move and uses to
  // dismiss the greeting before the intro can type. A layout effect runs before
  // drei's passive 'change' listener attaches, so this sync is silent.
  useLayoutEffect(() => {
    controlsRef.current?.update()
  }, [])

  useFrame((state, delta) => {
    const controls = controlsRef.current
    // The desk view is the initial view; its authored pose only exists once the
    // scene loads, so snap to it the first frame it resolves. The scene just
    // appeared, so this reads as the view already framed — not a camera move.
    if (!initialPoseApplied.current && controls) {
      const resolved = resolveHomeHotspot(DESK_HOTSPOT)
      if (resolved?.request.cameraPos) {
        initialPoseApplied.current = true
        applyingInitialPose.current = true
        state.camera.position.set(...resolved.request.cameraPos)
        controls.target.set(...resolved.request.point)
        controls.update()
        applyingInitialPose.current = false
      }
    }
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
        target={DESK_FOCUS.target}
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
        // never dispatch 'change' and don't flicker the greeting. The initial
        // desk-pose snap also fires 'change', so suppress it while applying.
        onChange={() => {
          if (!tween.current && !applyingInitialPose.current) {
            setHeroMode("intro")
            setActiveView(null)
          }
        }}
      />
    </>
  )
}

export function HomeCanvas() {
  const flyToRef = useRef<FlyTo | null>(null)
  const activeView = useActiveView()

  // A fresh scene loads already framed on the desk view (its authored camera
  // snaps in once the scene resolves), and the desk preset's hero keeps the
  // greeting engaged, so it types without a click. Reset on every mount so
  // returning to home greets again (the camera remounts on client-side
  // navigation, but the hero store persists). The load view is a switcher
  // button, so mark the desk view active.
  useEffect(() => {
    setHeroMode(DESK_FOCUS.hero)
    setActiveView("desk")
  }, [])

  // Fly a switcher button to its authored camera view. Resolution goes through
  // the shared home-scene-resolver so the buttons frame identically to object
  // clicks; the scene is registered by ModelObject once loaded.
  const handleSelectView = useCallback((id: string) => {
    const hotspot = HOME_SCENE_HOTSPOTS.find((hotspot) => hotspot.id === id)
    if (!hotspot) return
    const resolved = resolveHomeHotspot(hotspot)
    if (!resolved) return
    flyToRef.current?.(resolved.request)
    if (resolved.hero) setHeroMode(resolved.hero)
    setActiveView(id)
  }, [])

  return (
    <div className="relative h-full w-full">
      {/* Cap device pixel ratio at 1.5: the fullscreen hero canvas on a
          Retina display would otherwise render at 2x (4x the pixel fill),
          which — combined with the heavy scene and rect area lights — is what
          made panning to the car lag. 1.5 keeps it sharp on 2x/3x displays
          while roughly halving the fill cost. Tunable in dev. */}
      <Canvas
        camera={{ position: DESK_FOCUS.cameraPos, fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        {/* The room light ships inside homepage.glb via KHR_lights_punctual —
            RoomFill_Light (wide 140° spot from the ceiling, ~6.5 cd), authored
            in the Blender scene and loaded with the model. The hemisphere keeps
            a soft ambient floor so shadowed areas don't go fully black
            (replaces the old "gray world @ strength 3.0" ambient). Light
            intensity is tuned in Blender (energy → candela is linear, ~54 cd/W)
            and re-exported to the GLB. */}
        <hemisphereLight args={[0xffffff, 0x2e2e2e, 0.55]} />
        <SceneController flyToRef={flyToRef} />
      </Canvas>
      <LoadingBar />
      <HomeViewSwitcher activeView={activeView} onSelectView={handleSelectView} />
    </div>
  )
}
