"use client"

// Why this wrapper exists: drei's <OrbitControls> wraps an older three-stdlib
// copy of OrbitControls that applies a FIXED zoom step per wheel event,
// ignoring how far the wheel actually moved. On a Mac trackpad, a two-finger
// swipe emits a decaying burst of wheel events after the fingers lift
// (momentum scrolling), so every trailing event — even the tiny ones — zooms a
// full step, which is why the scene kept zooming after the gesture ended.
// Upstream three.js fixed this by scaling the zoom step to the wheel delta
// (0.95^(zoomSpeed * |deltaY| / 100)), so the momentum tail fades out
// naturally. This component builds the controls from three's current
// OrbitControls (three/addons) instead of drei's stale copy, mirroring the
// wiring drei's <OrbitControls> does (connect to the canvas events target,
// update each frame for damping, forward start/change/end, register as the
// default controls) so the rest of the scene code is unchanged.

import { useFrame, useThree } from "@react-three/fiber"
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo } from "react"
import type { PerspectiveCamera } from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import type { OrbitControls as OrbitControlsImpl } from "three/addons/controls/OrbitControls.js"

export type HomeOrbitControlsProps = {
  /** Register these controls in the R3F store (drei's makeDefault). */
  makeDefault?: boolean
  camera?: PerspectiveCamera
  enableDamping?: boolean
  target: [number, number, number]
  dampingFactor?: number
  zoomSpeed?: number
  maxPolarAngle?: number
  minDistance?: number
  maxDistance?: number
  onStart?: (event?: unknown) => void
  onChange?: (event?: unknown) => void
  onEnd?: (event?: unknown) => void
}

export const HomeOrbitControls = forwardRef<OrbitControlsImpl, HomeOrbitControlsProps>(
  function HomeOrbitControls(
    {
      makeDefault,
      camera,
      enableDamping = true,
      target,
      dampingFactor,
      zoomSpeed,
      maxPolarAngle,
      minDistance,
      maxDistance,
      onStart,
      onChange,
      onEnd,
    },
    ref,
  ) {
    const defaultCamera = useThree((state) => state.camera)
    const gl = useThree((state) => state.gl)
    const events = useThree((state) => state.events)
    const set = useThree((state) => state.set)
    const get = useThree((state) => state.get)

    const controls = useMemo(
      () => new OrbitControls((camera || defaultCamera) as PerspectiveCamera),
      [camera, defaultCamera],
    )
    useImperativeHandle(ref, () => controls, [controls])

    // Damping decays rotate/pan between events, so the controls only settle if
    // update() runs every frame (same priority drei uses, -1).
    useFrame(() => {
      if (controls.enabled) controls.update()
    }, -1)

    useEffect(() => {
      controls.connect(events.connected || gl.domElement)
      return () => controls.dispose()
    }, [controls, events.connected, gl])

    useEffect(() => {
      const handleChange = (event: { type: "change" }) => onChange?.(event)
      const handleStart = (event: { type: "start" }) => onStart?.(event)
      const handleEnd = (event: { type: "end" }) => onEnd?.(event)
      controls.addEventListener("change", handleChange)
      controls.addEventListener("start", handleStart)
      controls.addEventListener("end", handleEnd)
      return () => {
        controls.removeEventListener("change", handleChange)
        controls.removeEventListener("start", handleStart)
        controls.removeEventListener("end", handleEnd)
      }
    }, [controls, onChange, onStart, onEnd])

    useEffect(() => {
      if (makeDefault) {
        const previous = get().controls
        set({ controls })
        return () => set({ controls: previous })
      }
    }, [makeDefault, controls, set, get])

    // Apply the tuning props to the instance (what drei's <primitive> applyProps
    // does). A layout effect so the values are in place before the scene
    // controller's mount-time controls.update() sync runs. Values we didn't
    // receive keep the OrbitControls defaults.
    useLayoutEffect(() => {
      controls.enableDamping = enableDamping
      controls.target.set(...target)
      if (dampingFactor !== undefined) controls.dampingFactor = dampingFactor
      if (zoomSpeed !== undefined) controls.zoomSpeed = zoomSpeed
      if (maxPolarAngle !== undefined) controls.maxPolarAngle = maxPolarAngle
      if (minDistance !== undefined) controls.minDistance = minDistance
      if (maxDistance !== undefined) controls.maxDistance = maxDistance
    }, [controls, enableDamping, target, dampingFactor, zoomSpeed, maxPolarAngle, minDistance, maxDistance])

    return null
  },
)
