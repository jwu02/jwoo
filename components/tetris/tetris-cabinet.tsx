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
import { createTouchController } from "@/lib/tetris/touch"
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

  const boxRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  // The pause flag twice over: the renderer reads the ref every frame, React
  // renders the announcement and the button from the state.
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(1)
  const getPhase = useCallback(() => engine.readout.phase, [engine])
  const phase = useSyncExternalStore(engine.subscribe, getPhase, getPhase)

  // One Controller behind both devices: the keyboard writes its held flags and
  // presses, and the touch layer merges its gestures into the same intents —
  // the object the renderer pays Ticks from (ADR 0006).
  const controller = useMemo(
    () =>
      createTouchController(createController(), {
        cellWidth: CABINET.cell * scale,
        isPlaying: () => engine.readout.phase === "playing",
        // A tap only asks for a game when phase is ready or over — and the
        // game cannot end while paused, so the cabinet is never paused here.
        // The reset is what Enter does too: nothing held or owed survives it.
        onStart: () => {
          controller.reset()
          engine.start()
        },
      }),
    // scale is only the seed value; the measure effect keeps the controller
    // told, so a resize never needs this object rebuilt mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine]
  )

  const setPause = useCallback(
    (value: boolean) => {
      pausedRef.current = value
      // Pausing mutes the Controllers: a gesture under the finger dies with the
      // pause, so its release cannot act on a game it resumes later.
      if (value) controller.cancelGesture()
      setPaused(value)
    },
    [controller]
  )

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
      const next = cabinetScale(rect.width, rect.height)
      controller.setCellWidth(CABINET.cell * next)
      setScale(next)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [controller])

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

  // Touch plays through the same Controller the keyboard feeds: a drag shifts
  // by cells, a slow drag down soft-drops, a fast flick hard-drops, a tap
  // rotates, a swipe up holds. A mouse click stays focus-and-resume only —
  // desktop has the keyboard, and a click that rotated would be a surprise —
  // and a tap that lands on a paused cabinet only resumes: the gesture is
  // never started, so the release cannot sneak a rotation in behind it.
  const onSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (pausedRef.current || event.pointerType === "mouse") return
      controller.pointerDown(event.pointerId, event.clientX, event.clientY)
    },
    [controller]
  )
  const onSurfacePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      controller.pointerMove(event.pointerId, event.clientX, event.clientY)
    },
    [controller]
  )
  const onSurfacePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      controller.pointerUp(event.pointerId, event.clientX, event.clientY)
    },
    [controller]
  )
  const onSurfacePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      controller.pointerCancel(event.pointerId)
    },
    [controller]
  )

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
        // renderer draws 260×248 and CSS stretches it (ADR 0007). Touch-action
        // none keeps a drag from scrolling the surface behind the well.
        style={{
          width: CABINET.width * scale,
          height: CABINET.height * scale,
          imageRendering: "pixelated",
          touchAction: "none",
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={onSurfacePointerUp}
        onPointerCancel={onSurfacePointerCancel}
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
