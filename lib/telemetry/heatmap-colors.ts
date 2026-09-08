/**
 * Heatmap colour ramp for the 3D keyboard keycaps.
 *
 * The SVG heatmap tinted each keycap with an oklch ramp from a dark charcoal
 * (no presses) to a warm orange (hottest key). The 3D model reproduces that
 * ramp exactly, but `THREE.Color.setStyle("oklch(...)")` silently returns white
 * in three r185 (it log-errors "Unknown color model oklch" and falls back to
 * white), so the ramp is resolved here to a plain sRGB hex string and fed to
 * `<color>.set(hex)` instead. Keeping this in a pure module (no three imports)
 * lets it be unit-tested against the exact pinned values of the SVG ramp.
 */

/**
 * Normalise a key's press count to an intensity in [0, 1]. `maxCount` is the
 * highest count across all keys, floored at 1 so the coldest key reads 0 and
 * a single-key dataset still saturates the top of the ramp.
 */
export function keyIntensity(count: number, maxCount: number): number {
  const denom = Math.max(maxCount, 1)
  return Math.min(1, Math.max(0, count / denom))
}

/**
 * Convert an OKLCH colour to an sRGB hex string ("#rrggbb"). This is the
 * Ottosson OKLab→linear-sRGB conversion plus the sRGB gamma curve, so the
 * result is exactly what a browser renders for the same oklch() — unlike
 * three's Color.setStyle, which cannot parse the oklch model.
 */
export function oklchToSrgbHex(l: number, c: number, hDeg: number): string {
  const hue = (hDeg * Math.PI) / 180
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)

  // OKLab → LMS.
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  // Cube to undo the OKLab non-linearities.
  const lm = l_ * l_ * l_
  const mm = m_ * m_ * m_
  const sm = s_ * s_ * s_

  // LMS → linear sRGB.
  const r = 4.0767416621 * lm - 3.3077115913 * mm + 0.2309699292 * sm
  const g = -1.2684380046 * lm + 2.6097574011 * mm - 0.3413193965 * sm
  const blue = -0.0041960863 * lm - 0.7034186147 * mm + 1.707614701 * sm

  // Apply the sRGB transfer function (gamma) once per linear channel.
  const toHex = (linear: number) => {
    const v = clamp01(linear)
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0")
  }

  return `#${toHex(r)}${toHex(g)}${toHex(blue)}`
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * The keycap colour for a given intensity (0..1), reproducing the old SVG ramp
 * exactly: lightness 0.25..0.64, chroma 0..0.16, a constant warm hue of 45°.
 */
export function keycapColor(intensity: number): string {
  const l = 0.25 + intensity * 0.39
  const c = intensity * 0.16
  return oklchToSrgbHex(l, c, 45)
}
