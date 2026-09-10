/**
 * Camera framing for the top-down 3D keyboard.
 *
 * The keyboard is a flat object in the XZ plane; a straight top-down camera sits
 * directly above its centre on +Y and looks straight down (−Y). The only free
 * parameter is the distance — derived so the whole keycap bounds fit inside the
 * view frustum at the requested field of view and aspect ratio.
 *
 * Pure and THREE-free (structural types) so it can be unit-tested without a
 * WebGL context; the component does `camera.position.set(...)`, `lookAt(...)`.
 *
 * Orientation: for a top-down view the default camera up (+Y) is parallel to the
 * view direction, which degenerates the lookAt. The caller must set the camera
 * up to (0, 0, −1) — making world −Z the top of the screen (function row at the
 * top, Esc top-left, matching the old SVG keyboard) — before the first lookAt.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Axis-aligned bounding box, world units. */
export interface Bounds3 {
  min: Vec3
  max: Vec3
}

/** A resolved camera pose: lookAt target, camera position, and up vector. */
export interface TopDownFrame {
  target: Vec3
  cameraPos: Vec3
  up: Vec3
}

export interface FitTopDownOptions {
  bounds: Bounds3
  /** Camera vertical field of view, in degrees. */
  fovDeg: number
  /** Viewport width / height. */
  aspect: number
  /**
   * Extra headroom around the keyboard. 1 = keys just touch the frame edges;
   * default 1.15 leaves a comfortable margin so edge keycaps + tooltip above
   * the top row don't clip. Tunable in dev.
   */
  margin?: number
  /**
   * Screen-up world axis. Default (0,0,−1) puts world −Z at the top (function
   * row on top for the keyboard); the mouse passes (0,0,1) so its front (+Z)
   * sits at the top, matching the old SVG's buttons-at-top layout.
   */
  up?: Vec3
}

export function fitTopDown(options: FitTopDownOptions): TopDownFrame {
  const { bounds, fovDeg, aspect, margin = 1.15, up } = options

  const halfW = (bounds.max.x - bounds.min.x) / 2
  const halfD = (bounds.max.z - bounds.min.z) / 2

  const center: Vec3 = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
  // Screen-up axis. Default (0,0,−1) → world −Z is screen up (function row on
  // top); the mouse passes (0,0,1) → world +Z (its front) is screen up.
  const resolvedUp: Vec3 = up ?? { x: 0, y: 0, z: -1 }

  const distance = computeDistance(halfW, halfD, fovDeg, aspect, margin)
  const cameraPos: Vec3 = { x: center.x, y: center.y + distance, z: center.z }

  return { target: center, cameraPos, up: resolvedUp }
}

// Distance so the sphere of the keyboard's horizontal (X) and vertical (Z)
// extents fits. Half-extents: horizontal width is halfW, vertical depth is
// halfD. At distance d the visible half-extents are d·tan(fov/2) (vertical) and
// that times `aspect` (horizontal). Solve both, take the larger, add margin.
// Guards: a zero/degenerate fov, aspect, or bounds yield a sane default of 1.
function computeDistance(
  halfW: number,
  halfD: number,
  fovDeg: number,
  aspect: number,
  margin: number,
): number {
  const fov = (fovDeg * Math.PI) / 180
  if (fov <= 0 || aspect <= 0 || halfW <= 0 || halfD <= 0) {
    return 1
  }
  const tanHalfFov = Math.tan(fov / 2)
  const distanceForWidth = halfW / (tanHalfFov * aspect)
  const distanceForDepth = halfD / tanHalfFov
  return margin * Math.max(distanceForWidth, distanceForDepth)
}
