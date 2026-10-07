import { fireEvent, render, waitFor } from "@testing-library/react"
import type { Application, Graphics } from "pixi.js"

import { TetrisCabinet } from "@/components/tetris/tetris-cabinet"
import { TetrisCanvas } from "@/components/tetris/tetris-canvas"
import {
  textPixels,
  textWidth,
  glyphSafe,
} from "@/components/tetris/pixel-font"
import { CABINET, READY_MENU } from "@/lib/tetris/cabinet"
import { createController } from "@/lib/tetris/controller"
import { createEngine } from "@/lib/tetris/engine"
import type { KevalaOffer } from "@/lib/tetris/kevala"
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

const AVAILABLE: KevalaOffer = { available: true, pending: false }

async function setUp(offer: KevalaOffer = AVAILABLE, paused = false) {
  const engine = createEngine({ seed: 1 })
  const controller = createController()
  const pausedRef = { current: paused }

  const { container, unmount } = render(
    <TetrisCanvas
      engine={engine}
      controller={controller}
      pausedRef={pausedRef}
      offer={offer}
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

/**
 * Whether every lit pixel of `value`, centered on the art at `y`, was drawn —
 * the test's own reading of the renderer's line of text.
 */
function drawsText(
  rects: RecordedGraphics["__rects"],
  value: string,
  y: number,
  scale = 1
) {
  const x = Math.round((CABINET.width - textWidth(value, scale)) / 2)
  return textPixels(value, x, y, scale).every((pixel) =>
    rects.some(
      (rect) =>
        rect.x === pixel.x &&
        rect.y === pixel.y &&
        rect.width === pixel.size &&
        rect.height === pixel.size
    )
  )
}

/** The fill of the first lit pixel of a line of text, for the dim/ink reading. */
function textFill(gfx: RecordedGraphics, value: string, y: number, scale = 1) {
  const x = Math.round((CABINET.width - textWidth(value, scale)) / 2)
  const [pixel] = textPixels(value, x, y, scale)
  const index = gfx.__rects.findIndex(
    (rect) =>
      rect.x === pixel.x && rect.y === pixel.y && rect.width === pixel.size
  )
  return gfx.__fills[index]
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

  it("offers only copy the pixel font can draw", () => {
    // ADR-0008: a glyph the font lacks draws a silent "?" on the cabinet, so
    // every line of the menu is checked against the set before it is drawn.
    // Lower case draws as upper case; a character with no glyph does not.
    for (const line of Object.values(READY_MENU)) {
      expect(glyphSafe(line.label)).toBe(true)
    }
    expect(glyphSafe("kevala 2026-a")).toBe(true)
    expect(glyphSafe("100%")).toBe(false)
  })

  it("offers both lines on the ready screen, and leaves the hints alone", async () => {
    const { pay } = await setUp()
    const rects = pay(0)

    expect(drawsText(rects, READY_MENU.player.label, READY_MENU.player.y)).toBe(
      true
    )
    expect(drawsText(rects, READY_MENU.kevala.label, READY_MENU.kevala.y)).toBe(
      true
    )
    // The fallback copy belongs to a browser that cannot run kevala.
    expect(
      drawsText(rects, READY_MENU.missing.label, READY_MENU.missing.y)
    ).toBe(false)
    // The control hints are exactly as they were: the menu took no rows from
    // them, and each line is the copy it always was.
    for (const [label, y] of [
      ["TETRIS", 96],
      ["ARROWS MOVE", 178],
      ["Z X ROT", 190],
      ["SPACE DROP", 202],
      ["C HOLD", 214],
    ] as const) {
      expect(drawsText(rects, label, y, label === "TETRIS" ? 2 : 1)).toBe(true)
    }
  })

  it("blinks the kevala line while the Checkpoint is new, and steadies it once consented", async () => {
    // No consent record yet: the line toggles with the blink that marks a new
    // offer.
    const pending = await setUp({ available: true, pending: true })
    expect(
      drawsText(
        pending.pay(0, 1000),
        READY_MENU.kevala.label,
        READY_MENU.kevala.y
      )
    ).toBe(true)
    expect(
      drawsText(
        pending.pay(0, 450),
        READY_MENU.kevala.label,
        READY_MENU.kevala.y
      )
    ).toBe(false)

    // Consent on record: the line stays lit through the same frames.
    const consented = await setUp()
    expect(
      drawsText(
        consented.pay(0, 1000),
        READY_MENU.kevala.label,
        READY_MENU.kevala.y
      )
    ).toBe(true)
    expect(
      drawsText(
        consented.pay(0, 450),
        READY_MENU.kevala.label,
        READY_MENU.kevala.y
      )
    ).toBe(true)
  })

  it("dims the kevala line and names what it needs where WebGPU is missing", async () => {
    const { gfx, pay } = await setUp({ available: false, pending: true })
    const rects = pay(0, 450)

    // Still drawn on both halves of the blink — it is an explanation, not an
    // offer, so nothing about it asks for attention.
    expect(drawsText(rects, READY_MENU.kevala.label, READY_MENU.kevala.y)).toBe(
      true
    )
    expect(
      drawsText(rects, READY_MENU.missing.label, READY_MENU.missing.y)
    ).toBe(true)
    expect(textFill(gfx, READY_MENU.kevala.label, READY_MENU.kevala.y)).toBe(
      "#7a7a90"
    )
    // The 1 PLAYER line is untouched: the fallback dims kevala, not the game.
    expect(textFill(gfx, READY_MENU.player.label, READY_MENU.player.y)).toBe(
      "#d8d8e4"
    )
  })

  it("draws the whole cabinet, the well included, inside the art's own box", async () => {
    const { pay } = await setUp()
    const rects = pay(0)

    // The ground, then the well's one heavy frame, which wraps the well box
    // two pixels out on every side.
    expect(rects[0]).toEqual({
      x: 0,
      y: 0,
      width: CABINET.width,
      height: CABINET.height,
    })
    expect(rects).toContainEqual({
      x: CABINET.well.x - 2,
      y: CABINET.well.y - 2,
      width: CABINET.well.width + 4,
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

    // The hold preview draws 1×1 mino tiles (scale 2), the only 1×1 rects on
    // the skin in the slot's own rows — the NEXT column's minos draw at the
    // same scale but share the rows only to its right, so the slot is fenced
    // on both sides. The slot's box is the skin's preview(8, 45, 32, 9); the
    // hard numbers are the point of the test.
    const SLOT = { x: 8, y: 45, right: 44, bottom: 54 }
    const TILE = 1
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

describe("the ready screen's offer, over the real cabinet", () => {
  // The adapter, its dynamic import and the pixi mock together: both doors into
  // the kevala flow are asserted where the visitor's input meets the cabinet
  // that draws, so a key or a tap that never leaves the adapter cannot pass.
  beforeEach(() => {
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as never)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Reflect.deleteProperty(navigator, "gpu")
  })

  async function mountCabinet() {
    const { container } = render(<TetrisCabinet />)
    await waitFor(() =>
      expect(container.querySelector("canvas")).not.toBeNull()
    )
    const canvas = container.querySelector("canvas")!
    const app = (canvas as unknown as { __pixiApp: RecordedApp }).__pixiApp
    await waitFor(() => expect(app.ticker.callbacks.length).toBeGreaterThan(0))
    const gfx = app.stage.children[0] as RecordedGraphics
    for (const frame of app.ticker.callbacks) {
      frame({ elapsedMS: 0, lastTime: 1000 })
    }
    const status = () =>
      container.querySelector('[role="status"]')?.textContent ?? ""
    const tap = (y: number) => {
      const point = {
        pointerId: 1,
        pointerType: "touch",
        clientX: 54,
        clientY: y,
      }
      const surface = container.querySelector('[role="application"]')!
      fireEvent.pointerDown(surface, point)
      fireEvent.pointerUp(surface, point)
    }
    return { rects: gfx.__rects, status, tap }
  }

  it("opens the kevala flow on K, over the cabinet it drew the offer on", async () => {
    Object.defineProperty(navigator, "gpu", { value: {}, configurable: true })
    const { rects, status } = await mountCabinet()

    expect(drawsText(rects, READY_MENU.kevala.label, READY_MENU.kevala.y)).toBe(
      true
    )

    fireEvent.keyDown(document.querySelector('[role="application"]')!, {
      key: "k",
    })
    expect(status()).toMatch(/kevala chosen/i)
  })

  it("refuses the KEVALA tap zone without WebGPU, and starts 1 PLAYER elsewhere", async () => {
    const { status, tap } = await mountCabinet()

    tap(READY_MENU.kevala.y)
    expect(status()).toMatch(/needs webgpu/i)
    expect(status()).not.toMatch(/chosen/i)

    tap(READY_MENU.player.y)
    expect(status()).toMatch(/playing/i)
  })
})
