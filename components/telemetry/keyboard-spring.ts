/**
 * Damped spring for the press-down / spring-back keycap animation.
 *
 * Each keycap's y is driven by a scalar `value` (0 = rest, 1 = fully pressed)
 * that a spring integrates toward a `target`. Hover sets target = 1 (press
 * down); leaving sets target = 0 (spring back off-hover). The spring is a
 * damped harmonic oscillator, integrated semi-implicitly in useFrame.
 *
 * The integrator is pure (returns a new state) so it can be unit-tested, and it
 * is decoupled from three's render loop — `KeyAnimator` steps the active springs
 * on each frame and writes the resulting value onto the keycap node positions.
 *
 * Tuning: stiffness 900 / damping 30 → ω = 30 rad/s, ζ ≈ 0.33, so the frame-rate
 * discretization leaves a clearly visible ~11% overshoot and a ~400 ms settle —
 * a snappy press with a small but readable bounce on release. Lower damping for
 * more bounce; higher for a flatter, critically damped feel (C = 42 is the
 * near-critical value that renders ~0% overshoot at 60 fps). Tunable in dev.
 */

export interface SpringState {
  /** Press progress: 0 = rest, 1 = fully pressed. */
  value: number
  /** Current velocity (units per second). */
  velocity: number
  /** The target the spring is currently moving toward. */
  target: number
}

/** Stiffness (k) of the spring — higher = snappier. */
export const KEY_SPRING_STIFFNESS = 900
/** Damping (c) of the spring — higher = less overshoot / bounce. */
export const KEY_SPRING_DAMPING = 30
/** Keycap travel when fully pressed, in metres (~1.5 mm for the model scale). */
export const KEY_PRESS_DEPTH_M = 0.0015

export function createSpring(target = 0): SpringState {
  return { value: target, velocity: 0, target }
}

/**
 * Advance a spring one timestep toward `target` using semi-implicit Euler:
 * velocity is updated from the current position's acceleration, then position
 * from the new velocity. Returns a new state (does not mutate the input).
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  stiffness = KEY_SPRING_STIFFNESS,
  damping = KEY_SPRING_DAMPING,
): SpringState {
  const next: SpringState = { ...state, target }
  const acceleration = stiffness * (target - next.value) - damping * next.velocity
  next.velocity += acceleration * dt
  next.value += next.velocity * dt
  return next
}

/**
 * Whether a spring has effectively reached its target (small residual value
 * error and velocity), so the animator can stop stepping it. `eps` is in value
 * units; the velocity threshold is scaled the same way so a long settle in a
 * fleeting animation doesn't leave a stale spring ticking forever.
 */
export function springIsSettled(state: SpringState, eps = 0.001): boolean {
  return (
    Math.abs(state.target - state.value) < eps &&
    Math.abs(state.velocity) < eps
  )
}
