import type { Vec3 } from "./scene-focus"

/**
 * Exponential smoothing for the click-to-focus fly-to: each frame the camera
 * covers a fixed *fraction* of the distance still to go, rather than a fixed
 * speed. Higher is snappier — at 6 the camera has covered ~95% of the distance
 * after half a second. Tunable in dev.
 */
export const TWEEN_SPEED = 6

/** Distance at which a fly-to counts as arrived, in scene units. */
export const TWEEN_SETTLE_EPSILON = 0.001

/**
 * How far along the way from `current` to `target` the camera should be after
 * `delta` seconds. Because the fraction is derived from elapsed time rather than
 * counted in frames, running one step of n seconds lands exactly where n steps
 * of one second would (1-e^-kt composes: e^-kt · e^-kt = e^-2kt), so the tween
 * settles in the same wall-clock time at any frame rate.
 */
export function tweenStep(
  current: Vec3,
  target: Vec3,
  delta: number,
  speed = TWEEN_SPEED,
): Vec3 {
  const factor = 1 - Math.exp(-delta * speed)
  return [
    current[0] + (target[0] - current[0]) * factor,
    current[1] + (target[1] - current[1]) * factor,
    current[2] + (target[2] - current[2]) * factor,
  ]
}

/** Whether a fly-to has closed enough of the distance to be called arrived. */
export function tweenSettled(current: Vec3, target: Vec3): boolean {
  const dx = current[0] - target[0]
  const dy = current[1] - target[1]
  const dz = current[2] - target[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < TWEEN_SETTLE_EPSILON
}
