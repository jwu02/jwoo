export type Vec3 = [number, number, number]

export type FocusInfo = {
  /** World-space point to center the camera on. */
  point: Vec3
  /** Half-diagonal of the model's world-space bounding box (its bounding-sphere radius). */
  radius: number
}

/** A hand-tuned fixed view: camera at `cameraPos` looking at `target`. */
export type FramingPreset = { type: "framing"; target: Vec3; cameraPos: Vec3 }

export type FocusPreset = { type: "fit" } | FramingPreset

export type FocusRequest = {
  point: Vec3
  radius: number
  /** Fixed camera position (overrides distance-based framing). */
  cameraPos?: Vec3
}

/**
 * World transform of a GLB-authored camera node (e.g. "CameraDesk"), read off
 * the loaded scene. `forward` is the unit world-space direction the camera
 * gazes along (GLTF cameras look down their -Z axis).
 */
export type CameraPose = {
  position: Vec3
  forward: Vec3
}

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
 * Minimal THREE.Matrix4-like shape so the translation extraction stays
 * framework-free and unit-testable. THREE.Matrix4 satisfies it (column-major
 * `elements` as a Float32Array, translation in indices 12/13/14).
 */
export type WorldMatrixNode = { matrixWorld: { elements: ArrayLike<number> } }

/** Read the world-space translation out of a node's world matrix. */
export function readWorldPosition(node: WorldMatrixNode): Vec3 {
  const e = node.matrixWorld.elements
  return [e[12], e[13], e[14]]
}

// Minimum distance along a GLB camera's gaze at which the orbit target may sit.
// Keeps the target in front of the camera (and clear of the near plane) even if
// the authored camera happens to look away from the clicked node.
const MIN_GAZE_DISTANCE = 0.5

/**
 * The point the camera node's gaze line passes nearest to `point` (the clicked
 * node's bbox center): the projection of `point` onto the camera's forward axis.
 * This reproduces the Blender-authored view direction — framing the desk "from
 * above" rather than aiming at the low bbox center — while keeping the orbit
 * target near the object. Clamped so the target never collapses behind or onto
 * the camera.
 */
export function gazeTarget(camera: CameraPose, point: Vec3): Vec3 {
  const dx = point[0] - camera.position[0]
  const dy = point[1] - camera.position[1]
  const dz = point[2] - camera.position[2]
  const distance = Math.max(
    dx * camera.forward[0] + dy * camera.forward[1] + dz * camera.forward[2],
    MIN_GAZE_DISTANCE,
  )
  return [
    camera.position[0] + camera.forward[0] * distance,
    camera.position[1] + camera.forward[1] * distance,
    camera.position[2] + camera.forward[2] * distance,
  ]
}

/**
 * Translate a hotspot's focus preset into the camera request fed to the canvas
 * fly-to tween. `info` is the model's bounding-sphere framing; "framing" ignores
 * it and uses the preset's fixed camera + target instead (no bbox needed for a
 * fixed view).
 *
 * When `camera` is provided (a GLB-authored camera, e.g. CameraXiaomi), it wins
 * over the preset's hand-tuned cameraPos: the camera flies to the authored
 * position and the orbit target becomes where the camera's gaze passes nearest
 * the clicked node (`gazeTarget`), reproducing the authored view direction.
 * Using the camera's orientation matters — aiming at the node's low bbox center
 * alone framed top-down shots too low. Without a camera, the preset's hardcoded
 * target/cameraPos are used — the fallback that keeps existing hotspots working
 * before the GLB cameras exist.
 */
export function resolveFocus(
  preset: FocusPreset,
  info: FocusInfo,
  camera?: CameraPose,
): FocusRequest {
  switch (preset.type) {
    case "fit":
      return { point: info.point, radius: info.radius }
    case "framing":
      if (camera) {
        return {
          point: gazeTarget(camera, info.point),
          radius: 0,
          cameraPos: camera.position,
        }
      }
      return { point: preset.target, radius: 0, cameraPos: preset.cameraPos }
  }
}
