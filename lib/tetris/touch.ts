// The touch Controller: gestures translated into the same per-Tick intents the
// keyboard feeds (ADR 0006). It wraps a Controller and writes nothing into it
// but one-shot presses — a drag's shifts and a soft drop are merged into each
// Intent at the Tick they are paid, so the two devices can coexist without
// fighting over the same held flags.
//
// The gestures, in art cells (the caller converts to screen pixels):
//
//  - a horizontal drag shifts one column per cell-width crossed, paid one per
//    Tick — the finger mirrors the piece, and dragging back cancels what the
//    finger has not yet asked for;
//  - a drag below one and a half cells holds soft drop for as long as it stays
//    there — the finger is the throttle, and lifting it lets go;
//  - a release moving fast and vertically is a flick: down hard-drops, up holds;
//  - a deliberate upward drag of two cells holds even when slow;
//  - any other small release that crossed no column is a tap, which rotates
//    while playing and asks for a new game otherwise.

import type { Controller } from "./controller"

/** A touch Controller: the same Controller interface plus the pointer events. */
export interface TouchController extends Controller {
  /** Re-measure the cell after the cabinet is resized. */
  setCellWidth(px: number): void
  /** Abort the gesture in progress, if any — the caller mutes on pause. */
  cancelGesture(): void
  pointerDown(pointerId: number, x: number, y: number): void
  pointerMove(pointerId: number, x: number, y: number): void
  pointerUp(pointerId: number, x: number, y: number): void
  pointerCancel(pointerId: number): void
}

export interface TouchOptions {
  /** Screen pixels one well cell spans; the caller updates it on resize. */
  cellWidth: number
  /** A tap rotates while playing; otherwise it asks for a new game. */
  isPlaying(): boolean
  /** Called when a tap lands on the start or game-over screen. */
  onStart(): void
  /** The gesture clock, for flick velocity. Injectable so tests can flick. */
  now?(): number
}

/** Movement under this (in cells) is a tap, not a drag. */
const TAP_SLOP_CELLS = 1.2
/** Downward travel (in cells) before a drag holds soft drop. */
const DROP_ENGAGE_CELLS = 1.5
/** Net upward travel (in cells) a slow swipe needs to hold. */
const SWIPE_UP_CELLS = 2
/** Release speed (in cells per second) past which a drag is a flick. */
const FLICK_CELLS_PER_SECOND = 15
/** How far back (in ms) a flick's velocity is measured. */
const FLICK_WINDOW_MS = 120

export function createTouchController(
  controller: Controller,
  options: TouchOptions
): TouchController {
  const now = options.now ?? (() => performance.now())
  let cellPx = Math.max(1, options.cellWidth)

  function cell(): number {
    return cellPx
  }

  // The one pointer whose gesture is tracked; a second finger changes nothing.
  let pointerId: number | null = null
  let anchorX = 0
  let anchorY = 0
  // The whole column the finger has been dragged to, and the shifts it is owed.
  let draggedColumns = 0
  let owedShifts = 0
  // Whether the drag is currently holding soft drop.
  let dropHeld = false
  // Whether a shift may be paid this Tick: consecutive Ticks of one direction
  // read to the Engine as a held key and start DAS, so two owed shifts go out
  // as two taps — shift, quiet Tick, shift.
  let shiftArmed = true
  // Recent samples, for the release's flick velocity.
  let samples: { x: number; y: number; t: number }[] = []

  /** Cells per second, over the flick window; zero when it cannot be known. */
  function velocity(): { vx: number; vy: number } {
    const t = now()
    const recent = samples.filter((s) => t - s.t <= FLICK_WINDOW_MS)
    const oldest = recent[0]
    const newest = recent[recent.length - 1]
    if (recent.length < 2 || oldest === newest) return { vx: 0, vy: 0 }
    const seconds = (newest.t - oldest.t) / 1000
    if (seconds <= 0) return { vx: 0, vy: 0 }
    return {
      vx: (newest.x - oldest.x) / cellPx / seconds,
      vy: (newest.y - oldest.y) / cellPx / seconds,
    }
  }

  function forget() {
    pointerId = null
    dropHeld = false
    samples = []
  }

  return {
    setDirection: (direction, held) => controller.setDirection(direction, held),
    press: (action) => controller.press(action),

    setCellWidth(px) {
      cellPx = Math.max(1, px)
    },

    cancelGesture: forget,

    pointerDown(id, x, y) {
      if (pointerId !== null) return
      pointerId = id
      anchorX = x
      anchorY = y
      draggedColumns = 0
      owedShifts = 0
      dropHeld = false
      samples = [{ x, y, t: now() }]
    },

    pointerMove(id, x, y) {
      if (pointerId !== id) return
      const t = now()
      const c = cell()
      samples = [
        ...samples.filter((s) => t - s.t <= FLICK_WINDOW_MS),
        { x, y, t },
      ]
      if (!options.isPlaying()) return
      // Each whole cell the finger crosses is one shift; crossing back returns
      // it, so the piece follows the finger rather than accumulating drift.
      const columns = Math.trunc((x - anchorX) / c)
      if (columns !== draggedColumns) {
        owedShifts += columns - draggedColumns
        draggedColumns = columns
      }
      dropHeld = y - anchorY > DROP_ENGAGE_CELLS * c
    },

    pointerUp(id, x, y) {
      if (pointerId !== id) return
      const dx = x - anchorX
      const dy = y - anchorY
      const c = cellPx
      // A tap only if the finger crossed no column: a drag of a cell or more
      // has already paid its shift, and its release must not also rotate.
      if (
        draggedColumns === 0 &&
        Math.abs(dx) < TAP_SLOP_CELLS * c &&
        Math.abs(dy) < TAP_SLOP_CELLS * c
      ) {
        if (options.isPlaying()) controller.press("rotateCW")
        else options.onStart()
      } else {
        samples.push({ x, y, t: now() })
        const { vx, vy } = velocity()
        if (
          Math.abs(vy) >= FLICK_CELLS_PER_SECOND &&
          Math.abs(vy) > Math.abs(vx)
        ) {
          controller.press(vy > 0 ? "hardDrop" : "hold")
        } else if (dy <= -SWIPE_UP_CELLS * c && Math.abs(dy) >= Math.abs(dx)) {
          controller.press("hold")
        }
      }
      forget()
    },

    pointerCancel(id) {
      if (pointerId !== id) return
      forget()
    },

    nextIntent() {
      const intent = controller.nextIntent()
      intent.down = intent.down || dropHeld
      if (owedShifts !== 0) {
        if (shiftArmed) {
          if (owedShifts < 0) {
            intent.left = true
            owedShifts += 1
          } else {
            intent.right = true
            owedShifts -= 1
          }
          shiftArmed = owedShifts === 0
        } else {
          shiftArmed = true
        }
      }
      return intent
    },

    reset() {
      owedShifts = 0
      dropHeld = false
      shiftArmed = true
      controller.reset()
    },
  }
}
