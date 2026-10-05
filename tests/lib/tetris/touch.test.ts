/**
 * @jest-environment node
 */
import { createController, NO_INTENT } from "@/lib/tetris/controller"
import { createTouchController } from "@/lib/tetris/touch"

describe("the touch Controller", () => {
  it("rotates clockwise on a tap while playing", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerUp(1, 0, 0)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, rotateCW: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("asks for a new game on a tap when not playing", () => {
    const { touch, started } = setUp({ playing: false })
    touch.pointerDown(1, 0, 0)
    touch.pointerUp(1, 0, 0)
    expect(started()).toBe(1)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("does not tap a release that has already paid a shift", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    // A drag of one and a tenth cells: the shift is the finger's ask, and the
    // release inside the tap slop must not add a rotation to it.
    touch.pointerMove(1, 11, 0)
    touch.pointerUp(1, 11, 0)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("forgets a gesture when it is cancelled wholesale", () => {
    const { touch, started } = setUp({ playing: false })
    touch.pointerDown(1, 0, 0)
    touch.cancelGesture()
    touch.pointerUp(1, 0, 0)
    expect(started()).toBe(0)
  })

  it("shifts one column per cell-width dragged, as taps the Engine can tell apart", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    // Two and a half cells right: two shifts. Two consecutive Ticks of right
    // would read as a held key and start DAS, so a quiet Tick separates them.
    touch.pointerMove(1, 25, 0)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("shifts left for a leftward drag", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, -14, 0)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, left: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("gives a shift back when the finger drags back over it", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 15, 0)
    touch.pointerMove(1, 6, 0)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("soft-drops while the finger drags down, and lets go when it returns", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 0, 20)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, down: true })
    // Held, not tapped: the drop continues every Tick the finger stays down.
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, down: true })
    // Back above the anchor: the throttle closes.
    touch.pointerMove(1, 0, 4)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("releases the soft drop when the finger lifts", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 0, 20)
    touch.pointerUp(1, 0, 20)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("soft-drops and shifts together on a diagonal drag", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 25, 30)
    expect(touch.nextIntent()).toEqual({
      ...NO_INTENT,
      right: true,
      down: true,
    })
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, down: true })
    expect(touch.nextIntent()).toEqual({
      ...NO_INTENT,
      right: true,
      down: true,
    })
  })

  it("hard-drops on a fast downward flick", () => {
    const { touch, advance } = setUp()
    touch.pointerDown(1, 0, 0)
    // Three cells in 70 ms — past the flick threshold, vertically.
    touch.pointerMove(1, 0, 20)
    advance(50)
    touch.pointerMove(1, 0, 60)
    touch.pointerUp(1, 0, 80)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, hardDrop: true })
  })

  it("does not hard-drop a slow long drag down", () => {
    const { touch, advance } = setUp()
    touch.pointerDown(1, 0, 0)
    // Four cells at one cell per 100 ms — well under the flick threshold.
    for (let i = 1; i <= 4; i++) {
      advance(100)
      touch.pointerMove(1, 0, i * 10)
    }
    touch.pointerUp(1, 0, 40)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("does not hard-drop a flick whose speed was only early on", () => {
    const { touch, advance } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 0, 30)
    advance(200)
    touch.pointerMove(1, 0, 35)
    touch.pointerUp(1, 0, 35)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("ignores a horizontal flick: it shifts, it never drops or holds", () => {
    const { touch, advance } = setUp()
    touch.pointerDown(1, 0, 0)
    advance(30)
    touch.pointerMove(1, 30, 2)
    touch.pointerUp(1, 60, 2)
    // Three cells dragged: three shifts alternating with quiet Ticks, and no
    // drop or hold from the flick.
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("holds on a fast upward swipe", () => {
    const { touch, advance } = setUp()
    touch.pointerDown(1, 0, 0)
    advance(30)
    touch.pointerMove(1, 0, -20)
    touch.pointerUp(1, 0, -40)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, hold: true })
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("holds on a deliberate slow swipe up of two cells", () => {
    const { touch, advance } = setUp()
    touch.pointerDown(1, 0, 0)
    for (let i = 1; i <= 2; i++) {
      advance(100)
      touch.pointerMove(1, 0, -i * 10)
    }
    touch.pointerUp(1, 0, -20)
    expect(touch.nextIntent()).toEqual({ ...NO_INTENT, hold: true })
  })

  it("aborts on pointer cancel, and the late release does nothing", () => {
    const { touch, started } = setUp({ playing: false })
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 0, 20)
    touch.pointerCancel(1)
    expect(touch.nextIntent()).toEqual(NO_INTENT)
    touch.pointerUp(1, 0, 0)
    expect(started()).toBe(0)
  })

  it("forgets owed shifts on reset", () => {
    const { touch } = setUp()
    touch.pointerDown(1, 0, 0)
    touch.pointerMove(1, 25, 0)
    touch.reset()
    expect(touch.nextIntent()).toEqual(NO_INTENT)
  })

  it("tracks one pointer at a time", () => {
    const { touch, started } = setUp({ playing: false })
    touch.pointerDown(1, 0, 0)
    // A second finger neither moves nor ends the first gesture.
    touch.pointerDown(2, 50, 50)
    touch.pointerMove(2, 80, 50)
    touch.pointerCancel(2)
    touch.pointerUp(1, 0, 0)
    expect(started()).toBe(1)
  })
})

function setUp({ playing = true }: { playing?: boolean } = {}) {
  const inner = createController()
  let clock = 1000
  let starts = 0
  const touch = createTouchController(inner, {
    cellWidth: 10,
    isPlaying: () => playing,
    onStart: () => {
      starts += 1
    },
    now: () => clock,
  })
  return {
    touch,
    advance: (ms: number) => (clock += ms),
    started: () => starts,
  }
}
