"use client"

import { useEffect, useRef, type RefObject } from "react"
import { Graphics, type ApplicationOptions, type Ticker } from "pixi.js"

import { usePixiApp } from "@/hooks/use-pixi-app"
import { CABINET } from "@/lib/tetris/cabinet"
import { createTickClock } from "@/lib/tetris/clock"
import { DEFAULT_CONFIG } from "@/lib/tetris/config"
import type { Controller } from "@/lib/tetris/controller"
import type { Engine, Readout } from "@/lib/tetris/engine"
import {
  pieceCells,
  PIECE_COLORS,
  PIECE_KEYS,
  type PieceKey,
} from "@/lib/tetris/pieces"

import { textPixels, textWidth } from "./pixel-font"

/**
 * The Cabinet's renderer — the only module allowed to import pixi for Tetris
 * (ADR 0001). The adapter imports it through `next/dynamic({ ssr: false })`
 * behind SceneGate, so pixi never enters the route's eager graph.
 *
 * Two jobs, and nothing else:
 *
 *  - **Drive the Engine.** The pixi Ticker is the sole loop (ADR 0005). React
 *    never runs the simulation; it only re-renders the adapter's announcements
 *    and the pause button, which change on a phase, not on a Tick.
 *  - **Draw the whole screen each frame.** One Graphics cleared and rebuilt: the
 *    arcade skin is ~700 flat rectangles, which WebGL takes without noticing,
 *    and redrawing it is far simpler than diffing it.
 *
 * Time becomes Ticks through the shared clock, so a 144 Hz frame and a 60 Hz
 * frame pay the same game. A pause pays nothing: the clock is reset rather than
 * left to accrue, or the piece would jump the moment play resumed.
 */

/** The skin's ink, dim, line, ground and ghost; the minos take the Guideline
 * hues from the same table the Engine names its pieces with. */
const INK = "#d8d8e4"
const DIM = "#7a7a90"
const LINE = "#3c3c52"
const BG = "#08080e"
const GHOST = "#8c8ca0"

/**
 * The cabinet is a fixed 260×248 art canvas at resolution 1 — not a scene that
 * follows its box. Following it would blur the art and put the skin's whole
 * pixel grid at the mercy of the layout; the adapter scales the finished
 * backing store with CSS instead (ADR 0007).
 *
 * WebGL is preferred deliberately: it is what the scene is drawn for, and the
 * shared gate has already established that a context exists. WebGPU is opt-in
 * by putting "webgpu" ahead of "webgl" here.
 */
const PIXI_OPTIONS: Partial<ApplicationOptions> = {
  resizeTo: undefined,
  width: CABINET.width,
  height: CABINET.height,
  resolution: 1,
  autoDensity: false,
  antialias: false,
  preference: "webgl",
}

export interface TetrisCanvasProps {
  engine: Engine
  controller: Controller
  /** Read each frame: true while the adapter holds the game paused. */
  pausedRef: RefObject<boolean>
}

export function TetrisCanvas({
  engine,
  controller,
  pausedRef,
}: TetrisCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const app = usePixiApp(hostRef, PIXI_OPTIONS)

  useEffect(() => {
    if (!app) return

    const gfx = new Graphics()
    app.stage.addChild(gfx)
    const clock = createTickClock(DEFAULT_CONFIG.tickHz)

    const frame = (ticker: Ticker) => {
      const paused = pausedRef.current
      const { phase } = engine.readout
      if (paused || phase !== "playing") {
        // No Ticks are paid outside play, and no input survives into it: a
        // direction still held here would otherwise land on the first Tick.
        clock.reset()
        controller.reset()
      } else {
        const ticks = clock.advance(ticker.elapsedMS)
        for (let i = 0; i < ticks; i++) {
          if (engine.readout.phase !== "playing") break
          engine.tick(controller.nextIntent())
        }
      }
      drawCabinet(gfx, engine, ticker.lastTime, paused)
    }

    app.ticker.add(frame)
    return () => {
      // usePixiApp's cleanup runs first and destroys the Application, which
      // nulls its stage, renderer and ticker. Once it has, there is nothing
      // left to unsubscribe from or remove: the frame went with the ticker.
      if (!app.stage) return
      app.ticker.remove(frame)
      app.stage.removeChild(gfx)
      gfx.destroy()
    }
  }, [app, engine, controller, pausedRef])

  // The backing store is the art's size and CSS stretches it into the box the
  // adapter sized: `autoDensity` is off so pixi writes no inline width on the
  // canvas to fight that, and `display: block` keeps it off the text baseline,
  // where a stray line box would leave a gap under it.
  return (
    <div
      ref={hostRef}
      className="size-full [&>canvas]:block [&>canvas]:size-full"
    />
  )
}

/* ─────────────────────────────── the skin ─────────────────────────────── */

function block(
  gfx: Graphics,
  x: number,
  y: number,
  color: string,
  size: number = CABINET.cell
) {
  // One pixel of gutter, so two neighbouring minos stay countable as two.
  gfx.rect(x, y, size - 1, size - 1).fill(color)
}

function ghostBlock(
  gfx: Graphics,
  x: number,
  y: number,
  size: number = CABINET.cell
) {
  gfx.rect(x, y, size - 1, 1).fill(GHOST)
  gfx.rect(x, y + size - 2, size - 1, 1).fill(GHOST)
  gfx.rect(x, y, 1, size - 1).fill(GHOST)
  gfx.rect(x + size - 2, y, 1, size - 1).fill(GHOST)
}

function frame(gfx: Graphics, x: number, y: number, w: number, h: number) {
  gfx.rect(x, y, w, 1).fill(LINE)
  gfx.rect(x, y + h - 1, w, 1).fill(LINE)
  gfx.rect(x, y, 1, h).fill(LINE)
  gfx.rect(x + w - 1, y, 1, h).fill(LINE)
}

function text(
  gfx: Graphics,
  value: string,
  x: number,
  y: number,
  color: string,
  scale = 1
) {
  for (const pixel of textPixels(value, x, y, scale)) {
    gfx.rect(pixel.x, pixel.y, pixel.size, pixel.size).fill(color)
  }
}

function textCentered(
  gfx: Graphics,
  value: string,
  y: number,
  color: string,
  scale = 1
) {
  const x = Math.round((CABINET.width - textWidth(value, scale)) / 2)
  text(gfx, value, x, y, color, scale)
}

function textRight(
  gfx: Graphics,
  value: string,
  right: number,
  y: number,
  color: string,
  scale = 1
) {
  text(gfx, value, Math.round(right - textWidth(value, scale)), y, color, scale)
}

function panel(
  gfx: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string
) {
  frame(gfx, x, y, w, h)
  text(gfx, label, x + 4, y + 3, DIM)
  textRight(gfx, value, x + w - 4, y + 12, INK)
}

/** A piece drawn to fit its slot, centered on its own bounding box. */
function preview(
  gfx: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  key: PieceKey | null,
  scale: number
) {
  if (key === null) return
  const cells = pieceCells(key, 0, 0, 0)
  const xs = cells.map(([cx]) => cx)
  const ys = cells.map(([, cy]) => cy)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = (Math.max(...xs) - minX + 1) * scale
  const height = (Math.max(...ys) - minY + 1) * scale
  const originX = Math.round(x + (w - width) / 2) - minX * scale
  const originY = Math.round(y + (h - height) / 2) - minY * scale
  for (const [cx, cy] of cells) {
    block(
      gfx,
      originX + cx * scale,
      originY + cy * scale,
      PIECE_COLORS[key],
      scale
    )
  }
}

const pad = (value: number, width: number) => String(value).padStart(width, "0")

function blink(now: number): boolean {
  return Math.floor(now / 450) % 2 === 0
}

function drawChrome(gfx: Graphics, state: Readout) {
  // The well's own heavy frame: the one double border on the whole screen.
  gfx.rect(76, 26, 108, 2).fill(LINE)
  gfx.rect(76, 230, 108, 2).fill(LINE)
  gfx.rect(76, 26, 2, 206).fill(LINE)
  gfx.rect(182, 26, 2, 206).fill(LINE)

  panel(gfx, 4, 4, 80, 22, "SCORE", pad(state.score, 7))
  panel(gfx, 88, 4, 80, 22, "LEVEL", pad(state.level, 2))
  panel(gfx, 172, 4, 84, 22, "LINES", pad(state.lines, 3))

  // The left column: the hold slot, then the seven minos for reference.
  frame(gfx, 4, 30, 68, 32)
  text(gfx, "HOLD", 8, 33, DIM)
  preview(gfx, 8, 41, 60, 18, state.hold, 4)

  frame(gfx, 4, 66, 68, 164)
  text(gfx, "PIECES", 8, 69, DIM)
  PIECE_KEYS.forEach((key, index) => {
    preview(gfx, 6, 84 + index * 20, 64, 18, key, 4)
  })

  // The right column: the queue, six deep.
  frame(gfx, 188, 30, 68, 200)
  text(gfx, "NEXT", 192, 33, DIM)
  for (let index = 0; index < DEFAULT_CONFIG.previewCount; index++) {
    preview(gfx, 190, 46 + index * 30, 64, 28, state.next[index] ?? null, 5)
  }

  textCentered(gfx, "ARROWS MOVE  Z X ROT  SPACE DROP  C HOLD", 238, DIM)
}

function drawWell(gfx: Graphics, engine: Engine) {
  const { x, y } = CABINET.well
  const hidden = DEFAULT_CONFIG.bufferRows

  engine.board.slice(hidden).forEach((row, visibleRow) => {
    row.forEach((key, column) => {
      if (key === null) return
      block(
        gfx,
        x + column * CABINET.cell,
        y + visibleRow * CABINET.cell,
        PIECE_COLORS[key]
      )
    })
  })

  const active = engine.active
  if (active === null) return
  const ghostY = engine.ghostY
  if (ghostY !== null) {
    for (const [cx, cy] of pieceCells(
      active.key,
      active.rotation,
      active.x,
      ghostY
    )) {
      const visibleRow = cy - hidden
      if (visibleRow >= 0) {
        ghostBlock(gfx, x + cx * CABINET.cell, y + visibleRow * CABINET.cell)
      }
    }
  }
  for (const [cx, cy] of pieceCells(
    active.key,
    active.rotation,
    active.x,
    active.y
  )) {
    const visibleRow = cy - hidden
    if (visibleRow >= 0) {
      block(
        gfx,
        x + cx * CABINET.cell,
        y + visibleRow * CABINET.cell,
        PIECE_COLORS[active.key]
      )
    }
  }
}

function drawScreens(
  gfx: Graphics,
  engine: Engine,
  now: number,
  paused: boolean
) {
  const { phase, score } = engine.readout
  if (phase === "ready") {
    textCentered(gfx, "TETRIS", 74, INK, 5)
    gfx.rect(60, 122, 140, 1).fill(LINE)
    if (blink(now)) textCentered(gfx, "PRESS ENTER", 140, INK, 2)
    textCentered(gfx, "1 PLAYER", 176, DIM)
    return
  }
  if (phase === "over") {
    textCentered(gfx, "GAME OVER", 106, INK, 3)
    textCentered(gfx, `SCORE ${pad(score, 7)}`, 146, DIM)
    if (blink(now)) textCentered(gfx, "PRESS ENTER", 166, INK)
    return
  }
  if (paused) {
    textCentered(gfx, "PAUSED", 106, INK, 3)
    textCentered(gfx, "ESC TO RESUME", 146, DIM)
  }
}

function drawCabinet(
  gfx: Graphics,
  engine: Engine,
  now: number,
  paused: boolean
) {
  gfx.clear()
  gfx.rect(0, 0, CABINET.width, CABINET.height).fill(BG)
  drawChrome(gfx, engine.readout)
  drawWell(gfx, engine)
  drawScreens(gfx, engine, now, paused)
}
