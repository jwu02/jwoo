// The Cabinet's design, in art pixels (ADR 0007).
//
// One unit per art pixel: the canvas backing store is exactly this size, and
// everything the visitor sees is drawn one-to-one and scaled by CSS. The
// stats read out in a header above the well; the well and its frame fill the
// rest; the hold slot and the next queue are translucent panels overlaid on
// the well, not panels beside it.

export const CABINET = {
  width: 108,
  height: 234,
  /** The well's box, and the size of one mino inside it. */
  well: { x: 4, y: 30, width: 100, height: 200 },
  cell: 10,
} as const

/**
 * Surfaces whose smaller dimension is under this are small screens: the scale
 * goes fractional so the cabinet fills the box, because the whole-number floor
 * would pin a phone to a fraction of its screen. The number is the OS shell's
 * md breakpoint — the line where the glass chrome disappears and the
 * application surface runs edge to edge.
 */
const SMALL_SURFACE = 768

/**
 * How much to scale the cabinet up for the box it has been given.
 *
 * On a large surface, whole numbers while one fits, because an art pixel is
 * then a whole number of device pixels on 1x/2x/3x displays, which is what
 * keeps the skin blocky. On a small surface — and when the box is smaller than
 * the art itself — the scale goes fractional and fills the binding dimension
 * rather than clipping, scrolling or letterboxing a phone (ADR 0007).
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
  if (Math.min(availableWidth, availableHeight) < SMALL_SURFACE) return raw
  return raw >= 1 ? Math.floor(raw) : raw
}
