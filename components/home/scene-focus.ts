export type Vec3 = [number, number, number]

export type FocusInfo = {
  /** World-space point to center the camera on. */
  point: Vec3
  /** Half-diagonal of the model's world-space bounding box (its bounding-sphere radius). */
  radius: number
}

export type FocusPreset =
  | { type: "fit" }
  | { type: "framing"; target: Vec3; cameraPos: Vec3; hero: HeroMode }

export type FocusRequest = {
  point: Vec3
  radius: number
  /** Fixed camera position (overrides distance-based framing). */
  cameraPos?: Vec3
}

export type HeroMode = "intro" | "macbook"

// Default framing, restored when the user clicks empty space.
export const DEFAULT_TARGET: Vec3 = [0, 0, 0]
export const DEFAULT_CAMERA: Vec3 = [0, 1.6, 3.4]

/**
 * Distance the camera needs to be from a bounding sphere of `radius` for the
 * whole sphere to fit within a vertical `fovDeg`. Objects are rarely true
 * spheres, so `margin` (default 1.15) leaves breathing room; the caller clamps
 * the result to the OrbitControls distance bounds.
 */
export function fitDistance(radius: number, fovDeg: number, margin = 1.15): number {
  if (radius <= 0 || fovDeg <= 0) return 0
  const halfFovRad = (fovDeg * Math.PI) / 360
  return (radius / Math.sin(halfFovRad)) * margin
}

/**
 * Translate a model's click preset into the camera request fed to the canvas
 * fly-to tween, plus the hero state to switch to (or null to leave it alone).
 * `info` is the model's bounding-sphere framing; "framing" ignores it and uses
 * the preset's fixed camera + target instead (no bbox needed for a fixed view).
 */
export function resolveFocus(
  preset: FocusPreset,
  info: FocusInfo,
): { request: FocusRequest; hero: HeroMode | null } {
  switch (preset.type) {
    case "fit":
      return { request: { point: info.point, radius: info.radius }, hero: null }
    case "framing":
      return {
        request: { point: preset.target, radius: 0, cameraPos: preset.cameraPos },
        hero: preset.hero,
      }
  }
}
