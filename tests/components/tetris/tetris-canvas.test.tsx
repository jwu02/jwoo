import { render, waitFor } from "@testing-library/react"
import type { Application, Graphics } from "pixi.js"

import { TetrisCanvas } from "@/components/tetris/tetris-canvas"
import { CABINET } from "@/lib/tetris/cabinet"
import { createController } from "@/lib/tetris/controller"
import { createEngine } from "@/lib/tetris/engine"
import { pieceCells, PIECE_COLORS } from "@/lib/tetris/pieces"

// The cabinet's drawing is ~700 rectangles a frame, and the only part of it that
// can be wrong without throwing is where they land: a piece drawn a row off, or
// the buffer rows leaking into the well, would still look like a playable game.
// So the pixi mock records every rect and a frame is paid by hand, which also
// lets the loop be tested without waiting on real time.

interface RecordedGraphics extends Graphics {
  __rects: { x: number; y: number; width: number; height: number }[]
  __fills: unknown[]
}

interface RecordedApp extends Application {
  ticker: Application["ticker"] & {
    callbacks: ((ticker: { elapsedMS: number; lastTime: number }) => void)[]
  }
}

async function setUp(paused = false) {
  const engine = createEngine({ seed: 1 })
  const controller = createController()
  const pausedRef = { current: paused }

  const { container, unmount } = render(
    <TetrisCanvas
      engine={engine}
      controller={controller}
      pausedRef={pausedRef}
    />
  )

  // The Application arrives a microtask after mount: the hook imports pixi and
  // awaits its own init before it appends the canvas, and the first frame is
  // subscribed from an effect after that.
  await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull())
  const canvas = container.querySelector("canvas")!
  const app = (canvas as unknown as { __pixiApp: RecordedApp }).__pixiApp
  await waitFor(() => expect(app.ticker.callbacks.length).toBeGreaterThan(0))
  const gfx = app.stage.children[0] as RecordedGraphics

  const pay = (elapsedMS: number, lastTime = 1000) => {
    for (const frame of app.ticker.callbacks) frame({ elapsedMS, lastTime })
    return gfx.__rects
  }

  return { engine, controller, pausedRef, gfx, pay, unmount }
}

/** Whether a mino was drawn as the nine-pixel tile its gutter leaves. */
function drawnTiles(rects: RecordedGraphics["__rects"]) {
  return rects.filter(
    (rect) =>
      rect.width === CABINET.cell - 1 && rect.height === CABINET.cell - 1
  )
}

function drawsTile(
  rects: RecordedGraphics["__rects"],
  column: number,
  row: number
) {
  return rects.some(
    (rect) =>
      rect.x === CABINET.well.x + column * CABINET.cell &&
      rect.y === CABINET.well.y + row * CABINET.cell &&
      rect.width === CABINET.cell - 1 &&
      rect.height === CABINET.cell - 1
  )
}

describe("the cabinet's renderer", () => {
  it("unsubscribes its frame without touching the destroyed Application's ticker", async () => {
    const { unmount } = await setUp()
    // Navigating away unmounts the cabinet. usePixiApp's own cleanup runs
    // first and destroys the Application, which nulls app.ticker — so the
    // frame's cleanup must not reach for it. This is the bug that threw
    // "Cannot read properties of null (reading 'remove')" on route change.
    expect(() => unmount()).not.toThrow()
  })

  it("draws the whole cabinet, the well included, inside the art's own box", async () => {
    const { pay } = await setUp()
    const rects = pay(0)

    // The ground, then the well's one heavy frame.
    expect(rects[0]).toEqual({
      x: 0,
      y: 0,
      width: CABINET.width,
      height: CABINET.height,
    })
    expect(rects).toContainEqual({
      x: CABINET.well.x - 4,
      y: CABINET.well.y - 4,
      width: CABINET.well.width + 8,
      height: 2,
    })
    // Everything drawn is inside the art: a stray coordinate would be a rect
    // the visitor never sees.
    expect(
      rects.every(
        (rect) =>
          rect.x >= 0 &&
          rect.y >= 0 &&
          rect.x + rect.width <= CABINET.width &&
          rect.y + rect.height <= CABINET.height
      )
    ).toBe(true)
  })

  it("draws the active piece in the well, but not while it is in the buffer", async () => {
    const { engine, pay } = await setUp()
    engine.start()
    expect(engine.active).not.toBeNull()

    // A spawning piece sits above the well, and the buffer rows are not drawn:
    // no mino tile lands above the well's top edge.
    expect(drawnTiles(pay(0)).every((rect) => rect.y >= CABINET.well.y)).toBe(
      true
    )

    // A second of Ticks at level 1 drops it a row, into the top of the well.
    expect(pay(1000)).toContainEqual(
      expect.objectContaining({
        width: CABINET.cell - 1,
        height: CABINET.cell - 1,
        y: CABINET.well.y,
      })
    )
    const piece = engine.active!
    for (const [column, row] of pieceCells(
      piece.key,
      piece.rotation,
      piece.x,
      piece.y
    )) {
      const visible = row - 2
      if (visible >= 0) expect(drawsTile(pay(0), column, visible)).toBe(true)
    }
  })

  it("draws the held piece in its slot, and nothing while the slot is empty", async () => {
    const { engine, controller, pay, gfx } = await setUp()
    engine.start()

    // The hold preview draws 2×2 mino tiles (scale 3), the only 2×2 rects on
    // the skin in the slot's own rows — the NEXT minis draw at the same scale
    // but share the row only to its right, so the slot is fenced on both
    // sides. The slot's box is the skin's preview(8, 35, 32, 9); the hard
    // numbers are the point of the test.
    const SLOT = { x: 8, y: 35, right: 44, bottom: 44 }
    const TILE = 2
    const slotTiles = (rects: RecordedGraphics["__rects"]) =>
      rects
        .map((rect, index) => ({ rect, fill: gfx.__fills[index] }))
        .filter(
          ({ rect }) =>
            rect.width === TILE &&
            rect.height === TILE &&
            rect.x >= SLOT.x &&
            rect.x < SLOT.right &&
            rect.y >= SLOT.y &&
            rect.y < SLOT.bottom
        )

    expect(slotTiles(pay(0))).toHaveLength(0)

    controller.press("hold")
    pay(1000 / 60)
    const hold = engine.readout.hold
    expect(hold).not.toBeNull()

    // The held piece itself: four minos in its own colour, inside the slot.
    const tiles = slotTiles(pay(0))
    expect(tiles).toHaveLength(4)
    for (const { rect, fill } of tiles) {
      expect(rect.x).toBeGreaterThanOrEqual(SLOT.x)
      expect(fill).toBe(PIECE_COLORS[hold!])
    }
  })

  it("pays whole Ticks from elapsed time, and none while paused", async () => {
    const { engine, pausedRef, pay } = await setUp()
    engine.start()

    // 144 frames of a second pay sixty Ticks, not one per frame.
    for (let i = 0; i < 144; i++) pay(1000 / 144)
    expect(engine.ticks).toBe(60)

    pausedRef.current = true
    pay(1000)
    expect(engine.ticks).toBe(60)

    // Resuming does not pay for the pause: the clock starts again from zero.
    pausedRef.current = false
    pay(1000 / 60)
    expect(engine.ticks).toBe(61)
  })

  it("ticks the engine it was handed with the controller's own intent", async () => {
    const { engine, controller, pay } = await setUp()
    engine.start()
    const before = { ...engine.active! }

    controller.setDirection("left", true)
    pay(1000 / 60)
    expect(engine.active!.x).toBe(before.x - 1)
  })

  it("dims the well under a blinking PAUSED, and clears both when play resumes", async () => {
    const { engine, pausedRef, pay, gfx } = await setUp()
    engine.start()

    // The overlay is the one rect the size of the well; nothing else is.
    const dimAt = (rects: RecordedGraphics["__rects"]) =>
      rects.findIndex(
        (rect) =>
          rect.x === CABINET.well.x &&
          rect.y === CABINET.well.y &&
          rect.width === CABINET.well.width &&
          rect.height === CABINET.well.height
      )

    expect(dimAt(pay(0, 1000))).toBe(-1)

    pausedRef.current = true
    // The blink is the PAUSED label's pixels going on and off; the dim stays.
    // Copies, not the live arrays: each frame clears and refills `__rects`.
    const lit = [...pay(0, 1000)]
    const dark = [...pay(0, 450)]
    expect(dimAt(lit)).toBeGreaterThanOrEqual(0)
    expect(dimAt(dark)).toBeGreaterThanOrEqual(0)
    expect(lit.length).toBeGreaterThan(dark.length)
    expect(gfx.__fills[dimAt(lit)]).toEqual({ color: "#08080e", alpha: 0.7 })

    pausedRef.current = false
    expect(dimAt(pay(0, 1000))).toBe(-1)
  })

  it("mutes the controller while paused, so no held key survives into play", async () => {
    const { engine, controller, pausedRef, pay } = await setUp()
    engine.start()
    const before = { ...engine.active! }

    pausedRef.current = true
    controller.setDirection("left", true)
    pay(1000)
    expect(engine.ticks).toBe(0)
    expect(engine.active).toEqual(before)

    // Resuming pays a Tick, and the direction held during the pause is gone.
    pausedRef.current = false
    pay(1000 / 60)
    expect(engine.active!.x).toBe(before.x)
  })
})
