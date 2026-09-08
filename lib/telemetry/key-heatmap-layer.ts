/**
 * Continuous heatmap layer for the 3D keyboard.
 *
 * The keycaps themselves show their natural GLB colour; the heatmap is a
 * separate semi-transparent texture plane that hovers just above them. This
 * module holds the pure, testable math that maps each key's world-space
 * footprint position onto the texture UV grid, and turns a press intensity
 * into an overlay alpha. The three.js-friendly rasterization (canvas gradient
 * blobs + a smoothing blur) lives in the model component, which owns the GLB
 * node positions and footprint bounds that only exist once the scene loads.
 *
 * Coordinates: the keyboard is viewed straight down. World +X runs left→right,
 * world −Z is the screen "up" (the function row / back of the keyboard), so the
 * back edge is the texture's top (v=1). Keys are planted on the XZ plane; the
 * Y (height) axis is ignored here because the overlay is projected flat.
 */

/** Footprint (top-down extent) of the keyboard, in world units. */
export interface Footprint {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Max overlay alpha for a fully-hot key; constants are tunable in dev. */
export const DEFAULT_MAX_ALPHA = 1.0

/**
 * Overlay alpha for a key at the given intensity. 0 (fully transparent, so the
 * natural cap shows through) at intensity 0, rising linearly to `maxAlpha`.
 */
export function heatAlpha(intensity: number, maxAlpha = DEFAULT_MAX_ALPHA): number {
  return clamp01(intensity) * maxAlpha
}

/**
 * Map a key's world-space footprint point (x on XZ, z on XZ) into the texture's
 * [0,1] UV grid. u grows with world +X (left→right); v is 1 at the back edge
 * (world −Z, screen top) and 0 at the front (world +Z, screen bottom), which
 * matches a plane rotated flat facing the top-down camera. Out-of-range points
 * are clamped onto the nearest edge.
 */
export function mapNodeToUv(
  x: number,
  z: number,
  footprint: Footprint,
): { u: number; v: number } {
  const width = footprint.maxX - footprint.minX
  const depth = footprint.maxZ - footprint.minZ
  const u = clamp01((x - footprint.minX) / width)
  const v = clamp01((footprint.maxZ - z) / depth)
  return { u, v }
}

/**
 * Convert an sRGB hex string ("#rgb" or "#rrggbb") into an "rgba(r,g,b,a)"
 * CSS string for a canvas gradient stop. `alpha` is clamped to [0, 1].
 */
export function hexRgba(hex: string, alpha: number): string {
  const a = clamp01(alpha)
  const clean = hex.replace("#", "")
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/**
 * Convert a texture-space UV into a pixel position on the canvas the overlay is
 * rasterized onto. The ramp is drawn onto a 2D canvas (row 0 = top) and then
 * sampled by a plane with `flipY = true` (three's CanvasTexture default), so the
 * canvas's top row is what appears at texture-v = 1. Since v = 1 is the back of
 * the keyboard (screen top), the vertical coordinate is inverted: v = 1 → y = 0
 * and v = 0 → y = height. Out-of-range values are clamped to the edges.
 */
export function uvToCanvas(
  u: number,
  v: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: clamp01(u) * width,
    y: (1 - clamp01(v)) * height,
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
