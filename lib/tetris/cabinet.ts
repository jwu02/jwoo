// The Cabinet's design, in art pixels (ADR 0007).
//
// One unit per art pixel: the canvas backing store is exactly this size, and
// everything the visitor sees is this drawn one-to-one and scaled by CSS. The
// numbers are the prototype's settled layout (app/tetris/prototype-skin.html):
// a header band of readouts, the well framed between a hold column and the next
// queue.

export const CABINET = {
  width: 260,
  height: 248,
  /** The well's box, and the size of one mino inside it. */
  well: { x: 80, y: 30, width: 100, height: 200 },
  cell: 10,
} as const

/**
 * How much to scale the cabinet up for the box it has been given.
 *
 * Whole numbers while one fits, because an art pixel is then a whole number of
 * device pixels on 1x/2x/3x displays, which is what keeps the skin blocky. When
 * the box is smaller than the art itself — viewports under 260×248 CSS px — the
 * scale goes fractional rather than clipping or scrolling (ADR 0007).
 *
 * An unmeasurable box (no layout yet, as in a test render) keeps the art's own
 * size rather than collapsing to nothing.
 */
export function cabinetScale(
  availableWidth: number,
  availableHeight: number
): number {
  const raw = Math.min(
    availableWidth / CABINET.width,
    availableHeight / CABINET.height
  )
  if (!Number.isFinite(raw) || raw <= 0) return 1
  return raw >= 1 ? Math.floor(raw) : raw
}
