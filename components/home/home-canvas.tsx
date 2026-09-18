"use client"

import { useProgress } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { Suspense, useEffect, useLayoutEffect, useRef } from "react"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three/addons/controls/OrbitControls.js"

import { SceneCanvas } from "@/components/three/scene-canvas"

import {
  cameraMoved,
  cameraTakenOver,
  flyToSettled,
  getFlyTo,
  resetToInitial,
  selectHotspot,
  setFlyToPosition,
  useSceneState,
} from "./home-scene-controller"
import { resolveHomeHotspot } from "./home-scene-resolver"
import { HomeOrbitControls } from "./home-orbit-controls"
import { HomeViewSwitcher } from "./home-view-switcher"
import { ModelObject } from "./model-object"
import { HOME_INITIAL_VIEW } from "./scene-config"
import { fitDistance, type Vec3 } from "./scene-focus"
import { tweenSettled, tweenStep } from "./scene-tween"

// OrbitControls distance bounds — reused for the fly-to framing clamp. The low
// min lets the MacBook deep zoom pull in close.
const MIN_DISTANCE = 0.7
const MAX_DISTANCE = 8

function toVec3(vector: THREE.Vector3): Vec3 {
  return [vector.x, vector.y, vector.z]
}

/**
 * Where a bbox fit should put the camera: keep the direction it is already
 * looking from, but set the distance from the object's size so big models (the
 * car) fit in view instead of landing the camera inside their geometry. Frozen
 * once per flight (the controller stores it) so the camera travels a straight
 * line rather than chasing a direction that moves with it.
 */
function freezeFitPosition(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  radius: number,
): Vec3 {
  const direction = camera.position.clone().sub(target)
  if (direction.lengthSq() === 0) direction.set(0, 0, 1)
  const distance = THREE.MathUtils.clamp(
    fitDistance(radius, camera.fov),
    MIN_DISTANCE,
    MAX_DISTANCE,
  )
  const pos = target.clone().add(direction.normalize().multiplyScalar(distance))
  const frozen = toVec3(pos)
  setFlyToPosition(frozen)
  return frozen
}

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

// Lives inside <Canvas> so useThree/useFrame have access to the camera. Owns the
// OrbitControls ref and carries out whatever fly-to the controller has armed.
function SceneController() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera

  // One-shot snap to the load view's authored camera pose once the scene
  // resolves. `initialPoseApplied` stops the snap re-running;
  // `applyingInitialPose` keeps the snap's own 'change' (from controls.update)
  // from counting as a user move that would clear the selected view.
  const initialPoseApplied = useRef(false)
  const applyingInitialPose = useRef(false)

  // Sync the controls' baseline on mount. OrbitControls seeds its internal
  // lastPosition at the origin, so its first frame-loop update() (drei runs it
  // at priority -1, before this controller's snap arms applyingInitialPose)
  // sees the camera seated at the load view, thinks it moved, and dispatches
  // 'change' — which the onChange handler below would mistake for a user move
  // and use to dismiss the greeting before the intro can type. A layout effect
  // runs before drei's passive 'change' listener attaches, so this sync is
  // silent.
  useLayoutEffect(() => {
    controlsRef.current?.update()
  }, [])

  useFrame((_state, delta) => {
    const controls = controlsRef.current

    // The load view's authored pose only exists once the scene loads, so snap to
    // it the first frame it resolves. The scene just appeared, so this reads as
    // the view already framed — not a camera move.
    if (!initialPoseApplied.current && controls) {
      const request = resolveHomeHotspot(HOME_INITIAL_VIEW.hotspot)
      if (request?.cameraPos) {
        initialPoseApplied.current = true
        applyingInitialPose.current = true
        camera.position.set(...request.cameraPos)
        controls.target.set(...request.point)
        controls.update()
        applyingInitialPose.current = false
      }
    }

    const flight = getFlyTo()
    if (!controls || !flight) return

    const toPos = flight.pos ?? freezeFitPosition(camera, controls.target, flight.radius)
    const nextPos = tweenStep(toVec3(camera.position), toPos, delta)
    const nextTarget = tweenStep(toVec3(controls.target), flight.target, delta)
    camera.position.set(nextPos[0], nextPos[1], nextPos[2])
    controls.target.set(nextTarget[0], nextTarget[1], nextTarget[2])
    controls.update()
    if (tweenSettled(nextPos, toPos) && tweenSettled(nextTarget, flight.target)) {
      flyToSettled()
    }
  })

  return (
    <>
      {/* The model suspends while its GLB streams in. This boundary is what
          keeps that from reaching SceneCanvas's own Suspense, which would
          unmount the controls — and this controller with them — mid-load. */}
      <Suspense fallback={null}>
        <ModelObject />
      </Suspense>
      {/* HomeOrbitControls uses three's current OrbitControls (not drei's
          three-stdlib copy) so wheel zoom scales with the scroll delta —
          otherwise a trackpad swipe's momentum tail keeps zooming after the
          fingers lift. zoomSpeed is the sensitivity multiplier for that
          delta-scaled step (0.95^(zoomSpeed * |deltaY| / 100)); 0.5 halves the
          default. Tunable in dev. */}
      <HomeOrbitControls
        ref={controlsRef}
        makeDefault
        target={HOME_INITIAL_VIEW.framing.target}
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.5}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        // The user taking over (drag/zoom) cancels any in-flight fly-to.
        onStart={cameraTakenOver}
        // A user-initiated camera move (rotate/pan/zoom) after the fly-to has
        // settled dismisses the selected view. 'change' also fires while the
        // fly-to tween is running (controls.update each frame), which the
        // controller discounts, and during the initial snap, suppressed here.
        // Plain clicks don't move the camera, so they never dispatch 'change'
        // and don't flicker the greeting.
        onChange={() => {
          if (!applyingInitialPose.current) cameraMoved()
        }}
      />
    </>
  )
}

export function HomeCanvas() {
  const { activeView } = useSceneState()

  // A fresh scene loads already framed on the load view (its authored camera
  // snaps in once the scene resolves), and that view keeps the greeting engaged,
  // so it types without a click. Reset on every mount so returning to home
  // greets again (the camera remounts on client-side navigation, but the
  // controller's state persists).
  useEffect(() => {
    resetToInitial()
  }, [])

  return (
    <div className="absolute inset-0">
      {/* The room light ships inside homepage.glb via KHR_lights_punctual —
          RoomFill_Light (wide 140° spot from the ceiling, ~6.5 cd), authored
          in the Blender scene and loaded with the model. SceneCanvas supplies
          the hemisphere that keeps a soft ambient floor so shadowed areas don't
          go fully black (replaces the old "gray world @ strength 3.0" ambient);
          this scene takes no key light, since its model is lit in the GLB. Light
          intensity is tuned in Blender (energy → candela is linear, ~54 cd/W)
          and re-exported to the GLB. */}
      <SceneCanvas
        camera={{ position: HOME_INITIAL_VIEW.framing.cameraPos, fov: 45 }}
        directional={false}
      >
        <SceneController />
      </SceneCanvas>
      <LoadingBar />
      <HomeViewSwitcher activeView={activeView} onSelectView={selectHotspot} />
    </div>
  )
}
