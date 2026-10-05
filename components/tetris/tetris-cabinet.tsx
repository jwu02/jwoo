"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { SceneGate } from "@/components/scene-gate"
import { CABINET, cabinetScale } from "@/lib/tetris/cabinet"
import {
  createController,
  type Action,
  type Direction,
} from "@/lib/tetris/controller"
import { createEngine, type Phase } from "@/lib/tetris/engine"

// Module scope so the gate resolves the canvas once, rather than rebuilding the
// loaded component on every render.
const loadTetrisCanvas = () =>
  import("./tetris-canvas").then((m) => ({ default: m.TetrisCanvas }))

/** Held directions: the Engine models DAS, ARR and soft drop from these. */
const DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowDown: "down",
  s: "down",
  S: "down",
}

/** One-shot actions, paid on the next Tick. */
const ACTIONS: Record<string, Action> = {
  ArrowUp: "rotateCW",
  x: "rotateCW",
  X: "rotateCW",
  z: "rotateCCW",
  Z: "rotateCCW",
  " ": "hardDrop",
  c: "hold",
  C: "hold",
  Shift: "hold",
}

/**
 * What the cabinet keeps from the page: the arrow keys scroll it and Space
 * scrolls the surface behind it, so a key the game answers is never also a key
 * the browser acts on.
 */
const SWALLOWED = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  " ",
])

function announcementFor(phase: Phase, paused: boolean): string {
  if (paused) return "Tetris paused. Press Escape to resume."
  if (phase === "ready") return "Tetris ready. Press Enter to play."
  if (phase === "playing") return "Tetris playing."
  return "Game over. Press Enter to play again."
}

/**
 * The Cabinet's adapter: everything that is not pixi (ADR 0001).
 *
 * It owns the surface a visitor actually touches — focus, the keyboard, the
 * announcements — and the one Engine instance behind it, and hands both to the
 * lazily loaded renderer. Nothing here knows what the scene is drawn with, and
 * nothing here runs the loop: the renderer's Ticker drives the Engine, and React
 * only re-renders when the phase changes.
 */
export function TetrisCabinet() {
  // A fresh bag every time the application is opened. The seed reaches no
  // markup, so drawing it at random costs hydration nothing.
  const engine = useMemo(() => createEngine({ seed: randomSeed() }), [])
  const controller = useMemo(() => createController(), [])

  const boxRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  // The pause flag twice over: the renderer reads the ref every frame, React
  // renders the announcement and the button from the state.
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(1)

  const getPhase = useCallback(() => engine.readout.phase, [engine])
  const phase = useSyncExternalStore(engine.subscribe, getPhase, getPhase)

  const setPause = useCallback((value: boolean) => {
    pausedRef.current = value
    setPaused(value)
  }, [])

  const pauseIfPlaying = useCallback(() => {
    if (engine.readout.phase === "playing") setPause(true)
  }, [engine, setPause])

  // The cabinet takes the keyboard on arrival: it is an arcade machine, and a
  // machine you have to click first is a machine that does not start.
  useEffect(() => {
    surfaceRef.current?.focus()
  }, [])

  // A visitor who switches tabs or windows has stopped playing, and the piece
  // must not lock while they are gone.
  useEffect(() => {
    window.addEventListener("blur", pauseIfPlaying)
    const onVisibility = () => {
      if (document.hidden) pauseIfPlaying()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("blur", pauseIfPlaying)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [pauseIfPlaying])

  // The cabinet is drawn at a fixed art size and scaled to whatever box the
  // application gives it, so the box has to be measured. jsdom and anything
  // else without a ResizeObserver fall back to the art's own size.
  useEffect(() => {
    const box = boxRef.current
    if (box === null) return
    const measure = () => {
      const rect = box.getBoundingClientRect()
      setScale(cabinetScale(rect.width, rect.height))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Modifier combinations belong to the browser — Cmd+R, Ctrl+Tab, Alt+Left.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (SWALLOWED.has(event.key)) event.preventDefault()

      if (event.key === "Enter") {
        if (phase !== "playing") {
          controller.reset()
          setPause(false)
          engine.start()
        }
        return
      }
      if (event.key === "Escape") {
        if (phase === "playing") setPause(!pausedRef.current)
        return
      }
      if (phase !== "playing" || pausedRef.current) return

      const direction = DIRECTIONS[event.key]
      if (direction !== undefined) {
        controller.setDirection(direction, true)
        return
      }
      const action = ACTIONS[event.key]
      // With the key down, the browser repeats it at its own rate; a rotation
      // or a drop is one press, not a stream of them.
      if (action !== undefined && !event.repeat) controller.press(action)
    },
    [controller, engine, phase, setPause]
  )

  const onKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const direction = DIRECTIONS[event.key]
      if (direction !== undefined) controller.setDirection(direction, false)
    },
    [controller]
  )

  // Clicking or tapping the cabinet takes the keyboard back and resumes, which
  // is the other half of the blur pause.
  const onPointerDown = useCallback(() => {
    surfaceRef.current?.focus()
    setPause(false)
  }, [setPause])

  return (
    <div
      ref={boxRef}
      className="flex size-full items-center justify-center"
      onPointerDown={onPointerDown}
    >
      <div
        ref={surfaceRef}
        role="application"
        aria-label="Tetris"
        tabIndex={0}
        className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/40"
        // The scaled box, with the art's own pixels asked for back: the
        // renderer draws 260×248 and CSS stretches it (ADR 0007).
        style={{
          width: CABINET.width * scale,
          height: CABINET.height * scale,
          imageRendering: "pixelated",
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <SceneGate
          load={loadTetrisCanvas}
          containerClassName="relative size-full"
          contentProps={{ engine, controller, pausedRef }}
          fallback={
            <div className="flex size-full items-center justify-center p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Tetris requires WebGL.
              </p>
            </div>
          }
        />
      </div>
      {/* The game is drawn, not written: the phase and the pause are the only
          things a screen reader can be told, and the only things that change
          between Ticks. `status` is the polite live region. */}
      <p role="status" className="sr-only">
        {announcementFor(phase, paused)}
      </p>
    </div>
  )
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
