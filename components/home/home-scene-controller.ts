"use client"

import { useSyncExternalStore } from "react"

import { resolveHomeHotspot } from "./home-scene-resolver"
import { findHotspot, HOME_INITIAL_VIEW } from "./scene-config"
import type { Vec3 } from "./scene-focus"

/**
 * The home scene's interaction state machine: which view is selected, and
 * whether a fly-to is in flight toward it.
 *
 * It is a module-level singleton rather than React context because the two
 * halves of a click live in different reconcilers — the switcher pill renders
 * outside <Canvas>, the models render inside it — and only a module reaches
 * both. The alternative (context plus a ref threaded into the canvas) buys a
 * more idiomatic shape at the cost of the invariant this module exists to hold:
 * that one sequence, and one writer, produce the selected view and the flight
 * toward it.
 *
 * The selected view is the *only* stored interaction state. What it implies —
 * whether the greeting shows — is derived from the hotspot spec (see
 * viewEngagesGreeting), so the two can never fall out of step: the bug this
 * replaces was a greeting left engaged by a view that had been left behind.
 *
 * Holds no three types — the vectors below are plain tuples and the canvas
 * converts them into the camera's own — so the state machine (and the tween
 * arithmetic it drives, see scene-tween) is testable without WebGL. It does
 * reach three transitively, through resolveHomeHotspot, so it must stay out of
 * the route's eager graph (ADR 0001) and is imported only by the lazily loaded
 * canvas and model.
 */

export type SceneState = {
  /** Id of the view the camera is framed on, or null once the user takes over. */
  activeView: string | null
}

/** A fly-to the canvas frame loop is carrying out. */
export type FlyTo = {
  /** World-space point the orbit target travels to. */
  target: Vec3
  /**
   * World-space camera destination, or null for a bbox fit — see
   * setFlyToPosition for why the canvas, not this module, resolves that.
   */
  pos: Vec3 | null
  /** Half-diagonal of the fitted object, for a fit whose `pos` is still open. */
  radius: number
}

let state: SceneState = { activeView: null }
let flyTo: FlyTo | null = null
const listeners = new Set<() => void>()

function publish(next: SceneState): void {
  if (next.activeView === state.activeView) return
  state = next
  for (const listener of listeners) listener()
}

/**
 * Whether `id`'s view keeps the greeting engaged. Derived from the hotspot spec
 * rather than stored alongside the selection, so a view can never carry a
 * greeting it did not ask for.
 */
export function viewEngagesGreeting(id: string | null): boolean {
  return id !== null && findHotspot(id)?.greeting === true
}

/**
 * Frame the scene on a hotspot's view: get the camera flying and mark the view
 * selected. Both entry points go through here — clicking a model (model-object)
 * and clicking a switcher button (home-view-switcher) — so the two frame
 * identically by construction rather than by keeping two paths in step.
 *
 * A no-op for a hotspot with no view of its own (the MacBook navigates to a page
 * instead) and for one whose scene has not resolved yet, in which case there is
 * nothing to frame and the pill must not light up.
 */
export function selectHotspot(id: string): void {
  const hotspot = findHotspot(id)
  if (!hotspot?.focus) return
  const request = resolveHomeHotspot(hotspot)
  if (!request) return
  flyTo = { target: request.point, pos: request.cameraPos ?? null, radius: request.radius }
  publish({ activeView: id })
}

/**
 * Mark the load view selected without flying anywhere: a fresh scene is already
 * seated on it by the canvas's camera props, and SceneController snaps to its
 * authored pose the first frame the model resolves. Called on mount so returning
 * to home greets again.
 */
export function resetToInitial(): void {
  flyTo = null
  publish({ activeView: HOME_INITIAL_VIEW.hotspot.id })
}

/**
 * The user grabbed the camera: stop flying so the tween doesn't fight the drag.
 *
 * This clears the flight, not the selection. Whether the view survives is then
 * decided by cameraMoved, which is what the gesture actually does: a drag moves
 * the camera and so dismisses the view, while a bare press that never moves it
 * leaves the view selected. Clearing here instead would make the switcher keep
 * claiming a view the visitor had already dragged away from.
 */
export function cameraTakenOver(): void {
  flyTo = null
}

/**
 * The camera moved. Dismisses the selected view, unless this is the
 * controls.update() that runs every frame of a fly-to tracking its target, or
 * the settle dispatch that follows it — those are the flight, not the visitor.
 */
export function cameraMoved(): void {
  if (flyTo) return
  publish({ activeView: null })
}

/** The flight arrived; the camera is the visitor's again. */
export function flyToSettled(): void {
  flyTo = null
}

/** The flight the frame loop should be carrying out, if any. */
export function getFlyTo(): FlyTo | null {
  return flyTo
}

/**
 * Record where the camera is actually travelling, for a fit request that
 * arrived without a destination: how far back and which way the camera sits
 * depends on the live camera (its current direction and fov), which this module
 * has no access to. The canvas freezes it on the flight's first frame, so the
 * camera travels a straight line instead of chasing a direction that moves with
 * it.
 */
export function setFlyToPosition(pos: Vec3): void {
  if (!flyTo) return
  flyTo = { ...flyTo, pos }
}

export function getSceneState(): SceneState {
  return state
}

export function subscribeSceneState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSceneState(): SceneState {
  return useSyncExternalStore(subscribeSceneState, getSceneState, getSceneState)
}
