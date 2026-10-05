"use client"

import { useEffect, useRef, type RefObject } from "react"
import { Graphics, type ApplicationOptions, type Ticker } from "pixi.js"

import { usePixiApp } from "@/hooks/use-pixi-app"
import { CABINET } from "@/lib/tetris/cabinet"
import { createTickClock } from "@/lib/tetris/clock"
import { DEFAULT_CONFIG } from "@/lib/tetris/config"
import type { Controller } from "@/lib/tetris/controller"
import type { Engine, Readout } from "@/lib/tetris/engine"
import { pieceCells, PIECE_COLORS, type PieceKey } from "@/lib/tetris/pieces"

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
 * The cabinet is a fixed 108×208 art canvas at resolution 1 — not a scene that
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
  // The well's own heavy frame: the one border on the whole screen.
  gfx.rect(0, 0, CABINET.width, 2).fill(LINE)
  gfx.rect(0, CABINET.height - 2, CABINET.width, 2).fill(LINE)
  gfx.rect(0, 0, 2, CABINET.height).fill(LINE)
  gfx.rect(CABINET.width - 2, 0, 2, CABINET.height).fill(LINE)

  // The stats band: a veil across the well's first rows, labels over values,
  // so the stack reads through it and no side panels are needed.
  gfx.rect(4, 4, CABINET.well.width, 16).fill({ color: BG, alpha: 0.65 })
  text(gfx, "SC", 8, 6, DIM)
  text(gfx, pad(state.score, 7), 8, 13, INK)
  text(gfx, "LV", 58, 6, DIM)
  text(gfx, pad(state.level, 2), 58, 13, INK)
  text(gfx, "LN", 80, 6, DIM)
  text(gfx, pad(state.lines, 3), 80, 13, INK)

  // The hold slot and the next queue — three deep — share the row under the
  // band, their interiors veiled so the minos read over whatever is beneath.
  gfx.rect(7, 25, 34, 20).fill({ color: BG, alpha: 0.55 })
  frame(gfx, 6, 24, 36, 22)
  text(gfx, "HOLD", 9, 27, DIM)
  preview(gfx, 8, 35, 32, 9, state.hold, 3)

  gfx.rect(47, 25, 54, 20).fill({ color: BG, alpha: 0.55 })
  frame(gfx, 46, 24, 56, 22)
  text(gfx, "NEXT", 49, 27, DIM)
  for (let index = 0; index < DEFAULT_CONFIG.previewCount; index++) {
    preview(gfx, 48 + index * 17, 35, 15, 9, state.next[index] ?? null, 3)
  }
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
    textCentered(gfx, "TETRIS", 70, INK, 2)
    gfx.rect(24, 92, 60, 1).fill(LINE)
    if (blink(now)) textCentered(gfx, "PRESS ENTER", 110, INK)
    textCentered(gfx, "1 PLAYER", 130, DIM)
    // The control hints live here and only here: during play the skin stays
    // clean, and a touch player is not served keyboard hints mid-game.
    textCentered(gfx, "ARROWS MOVE", 152, DIM)
    textCentered(gfx, "Z X ROT", 164, DIM)
    textCentered(gfx, "SPACE DROP", 176, DIM)
    textCentered(gfx, "C HOLD", 188, DIM)
    return
  }
  if (phase === "over") {
    // Two stacked lines: nine glyphs at a proud scale do not fit the well.
    textCentered(gfx, "GAME", 78, INK, 3)
    textCentered(gfx, "OVER", 102, INK, 3)
    textCentered(gfx, `SCORE ${pad(score, 7)}`, 136, DIM)
    if (blink(now)) textCentered(gfx, "PRESS ENTER", 162, INK)
    return
  }
  if (paused) {
    // The well dims under a blinking PAUSED: the board stays faintly visible so
    // the visitor can see what they are coming back to, and the label makes the
    // state unmistakable without hiding it.
    const { x, y, width, height } = CABINET.well
    gfx.rect(x, y, width, height).fill({ color: BG, alpha: 0.7 })
    if (blink(now)) textCentered(gfx, "PAUSED", 96, INK, 2)
    textCentered(gfx, "ESC TO RESUME", 120, DIM)
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
  // The well first, the HUD over it: a piece reaching the top rows passes
  // under the veiled panels, and the stats stay readable to the last.
  drawWell(gfx, engine)
  drawChrome(gfx, engine.readout)
  drawScreens(gfx, engine, now, paused)
}
