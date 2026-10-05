import { render, waitFor } from "@testing-library/react"
import type { Application, Graphics } from "pixi.js"

import { TetrisCanvas } from "@/components/tetris/tetris-canvas"
import { CABINET } from "@/lib/tetris/cabinet"
import { createController } from "@/lib/tetris/controller"
import { createEngine } from "@/lib/tetris/engine"
import { pieceCells } from "@/lib/tetris/pieces"

// The cabinet's drawing is ~700 rectangles a frame, and the only part of it that
// can be wrong without throwing is where they land: a piece drawn a row off, or
// the buffer rows leaking into the well, would still look like a playable game.
// So the pixi mock records every rect and a frame is paid by hand, which also
// lets the loop be tested without waiting on real time.

interface RecordedGraphics extends Graphics {
  __rects: { x: number; y: number; width: number; height: number }[]
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

  const { container } = render(
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

  return { engine, controller, pausedRef, pay }
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
})
