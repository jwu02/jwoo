import { act, fireEvent, render, screen } from "@testing-library/react"

import TetrisPage from "@/app/tetris/page"
import type { TetrisCanvasProps } from "@/components/tetris/tetris-canvas"

// The renderer is stubbed so pixi never loads, and the stub keeps the props it
// was handed: that is the engine and the controller, so the tests below drive
// the real game deterministically instead of waiting for frames.
//
// SceneGate's own behaviour — capability check, fallback, error boundary — is
// tested once in tests/components/scene-gate.test.tsx. What is left here is what
// the cabinet decides for itself: focus, the keyboard, the announcements and the
// box it draws in.
let mockCanvasProps: TetrisCanvasProps | null = null

jest.mock("next/dynamic", () => () => {
  const MockTetrisCanvas = (props: TetrisCanvasProps) => {
    mockCanvasProps = props
    return <div data-testid="tetris-canvas" />
  }
  return MockTetrisCanvas
})

function surface(): HTMLElement {
  return screen.getByRole("application", { name: "Tetris" })
}

function announcement(): string {
  return screen.getByRole("status").textContent ?? ""
}

/** Play the game to its end the shortest way there is: hard drops into a tower. */
function playToGameOver() {
  const { engine, controller } = mockCanvasProps!
  act(() => {
    for (let i = 0; i < 300 && engine.readout.phase !== "over"; i++) {
      engine.tick(controller.nextIntent())
      controller.press("hardDrop")
    }
  })
}

beforeEach(() => {
  mockCanvasProps = null
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({} as never)
})

afterEach(() => jest.restoreAllMocks())

describe("the Tetris application", () => {
  it("mounts a cabinet at its own art size and takes the keyboard", () => {
    render(<TetrisPage />)

    expect(screen.getByTestId("tetris-canvas")).toBeInTheDocument()
    // The surface is the focusable box the keys are read from; autofocus is what
    // makes the machine playable without a click first.
    expect(surface()).toHaveFocus()
    // Whole-number scaling of the 260×248 art, measured from the box: jsdom
    // reports no layout, so this is the art's own size.
    expect(surface()).toHaveStyle({ width: "260px", height: "248px" })
    expect(announcement()).toMatch(/ready/i)
  })

  it("falls back to a message when WebGL is unavailable", () => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

    render(<TetrisPage />)

    expect(screen.getByText(/requires WebGL/i)).toBeInTheDocument()
    expect(screen.queryByTestId("tetris-canvas")).not.toBeInTheDocument()
  })

  it("starts on Enter, and passes the keys on to the engine", () => {
    render(<TetrisPage />)
    const { engine, controller } = mockCanvasProps!

    // Nothing is played before Enter: the engine's own Ready screen.
    expect(engine.ticks).toBe(0)
    fireEvent.keyDown(surface(), { key: "Enter" })
    expect(announcement()).toMatch(/playing/i)

    const piece = { ...engine.active! }
    // Arrows scroll the page by default; the cabinet swallows the ones it uses.
    expect(fireEvent.keyDown(surface(), { key: "ArrowLeft" })).toBe(false)
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.active!.x).toBe(piece.x - 1)

    fireEvent.keyUp(surface(), { key: "ArrowLeft" })
    expect(fireEvent.keyDown(surface(), { key: " " })).toBe(false)
  })

  it("pauses on Escape, resumes on a click, and pauses when focus leaves", () => {
    render(<TetrisPage />)
    fireEvent.keyDown(surface(), { key: "Enter" })

    fireEvent.keyDown(surface(), { key: "Escape" })
    expect(announcement()).toMatch(/paused/i)
    fireEvent.keyDown(surface(), { key: "Escape" })
    expect(announcement()).toMatch(/playing/i)

    // Switching windows is the other way to stop playing — the piece must not
    // lock while the visitor is away.
    fireEvent.blur(window)
    expect(announcement()).toMatch(/paused/i)

    // A click is the way back, and it takes the keyboard with it.
    fireEvent.pointerDown(surface())
    expect(announcement()).toMatch(/playing/i)
    expect(surface()).toHaveFocus()
  })

  it("auto-pauses when the tab is hidden, keeping the game state", () => {
    render(<TetrisPage />)
    fireEvent.keyDown(surface(), { key: "Enter" })
    const { engine } = mockCanvasProps!

    // Hiding the tab is the other way to stop playing: the driver stops paying
    // Ticks, so the piece must not lock while the visitor is away.
    const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true)
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    hidden.mockRestore()

    expect(announcement()).toMatch(/paused/i)
    // Hidden is a pause, not a reset: the run is still in play underneath.
    expect(engine.readout.phase).toBe("playing")
  })

  it("announces the end of a game, and restarts on Enter", () => {
    render(<TetrisPage />)
    fireEvent.keyDown(surface(), { key: "Enter" })

    playToGameOver()
    expect(mockCanvasProps!.engine.readout.phase).toBe("over")
    expect(announcement()).toMatch(/game over/i)

    fireEvent.keyDown(surface(), { key: "Enter" })
    expect(announcement()).toMatch(/playing/i)
    expect(mockCanvasProps!.engine.readout.score).toBe(0)
  })

  it("holds on Shift, C and c, once per piece", () => {
    render(<TetrisPage />)
    fireEvent.keyDown(surface(), { key: "Enter" })
    const { engine, controller } = mockCanvasProps!

    // Shift holds into the empty slot: the active piece goes up, the next one
    // comes down. The engine seam proves the swap's details; what only this
    // level proves is which keys produce the hold intent.
    const piece = engine.active!.key
    const queued = engine.readout.next[0]
    fireEvent.keyDown(surface(), { key: "Shift" })
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.readout.hold).toBe(piece)
    expect(engine.active!.key).toBe(queued)

    // A second hold before the piece locks does nothing — whichever key asks.
    const held = engine.active!.key
    fireEvent.keyDown(surface(), { key: "c" })
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.active!.key).toBe(held)

    // The lock restores the swap, and C — the same action, uppercased — holds
    // again; the held piece comes back spawn-fresh.
    fireEvent.keyDown(surface(), { key: " " })
    act(() => engine.tick(controller.nextIntent()))
    const third = engine.active!.key
    fireEvent.keyDown(surface(), { key: "C" })
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.readout.hold).toBe(third)
    expect(engine.active!.key).toBe(piece)
    expect(engine.active!.rotation).toBe(0)

    // And the lowercase key holds once more after the next lock, pulling the
    // piece the C hold left waiting in the slot.
    fireEvent.keyDown(surface(), { key: " " })
    act(() => engine.tick(controller.nextIntent()))
    fireEvent.keyDown(surface(), { key: "c" })
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.active!.key).toBe(third)
  })

  it("leaves browser shortcuts and the Control key alone", () => {
    render(<TetrisPage />)
    fireEvent.keyDown(surface(), { key: "Enter" })
    const { engine, controller } = mockCanvasProps!
    const piece = { ...engine.active! }

    // Cmd+R, Ctrl+Tab, Alt+Left: the modifiers mean the browser, not the game,
    // and none of them is preventDefaulted.
    expect(
      fireEvent.keyDown(surface(), { key: "ArrowLeft", metaKey: true })
    ).toBe(true)
    expect(
      fireEvent.keyDown(surface(), { key: "ArrowRight", ctrlKey: true })
    ).toBe(true)
    expect(fireEvent.keyDown(surface(), { key: "ArrowUp", altKey: true })).toBe(
      true
    )
    // Control is unbound: the key is not a game key, so it reaches the browser.
    expect(fireEvent.keyDown(surface(), { key: "Control" })).toBe(true)
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.active).toEqual(piece)
  })

  it("reads keys only from the focused cabinet", () => {
    render(<TetrisPage />)
    fireEvent.keyDown(surface(), { key: "Enter" })
    const { engine, controller } = mockCanvasProps!
    const piece = { ...engine.active! }

    // A key pressed elsewhere in the page is not the game's: the handler lives
    // on the cabinet surface, which has to hold focus.
    expect(fireEvent.keyDown(document.body, { key: "ArrowLeft" })).toBe(true)
    act(() => engine.tick(controller.nextIntent()))
    expect(engine.active).toEqual(piece)
  })

  describe("playing by touch", () => {
    // jsdom has no layout, so the surface sits at its own art scale: one cell
    // is ten screen pixels. jsdom's PointerEvent also drops pointerType, so a
    // mouse gesture has to be dispatched natively with the property defined.
    function gesture(
      event: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
      pointerId: number,
      x: number,
      y: number,
      pointerType: string = "touch"
    ) {
      return fireEvent[event](surface(), {
        pointerId,
        pointerType,
        clientX: x,
        clientY: y,
      })
    }

    function mouseGesture(
      type: "pointerdown" | "pointermove" | "pointerup",
      pointerId: number,
      x: number,
      y: number
    ) {
      const event = new PointerEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
      })
      Object.defineProperty(event, "pointerType", { value: "mouse" })
      Object.defineProperty(event, "pointerId", { value: pointerId })
      surface().dispatchEvent(event)
    }

    it("shifts the piece one column per cell-width dragged", () => {
      render(<TetrisPage />)
      fireEvent.keyDown(surface(), { key: "Enter" })
      const { engine, controller } = mockCanvasProps!
      const piece = { ...engine.active! }

      gesture("pointerDown", 1, 130, 130)
      // Two and a half cells right: two shifts, each a tap the Engine can tell
      // apart — one, a quiet Tick, then the other.
      gesture("pointerMove", 1, 155, 130)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.active!.x).toBe(piece.x + 1)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.active!.x).toBe(piece.x + 1)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.active!.x).toBe(piece.x + 2)
      gesture("pointerUp", 1, 155, 130)
    })

    it("rotates clockwise on a tap", () => {
      render(<TetrisPage />)
      fireEvent.keyDown(surface(), { key: "Enter" })
      const { engine, controller } = mockCanvasProps!
      // The O piece occupies the same cells in every rotation; swap it away.
      while (engine.active!.key === "O") {
        controller.press("hardDrop")
        act(() => engine.tick(controller.nextIntent()))
      }
      const piece = { ...engine.active! }

      gesture("pointerDown", 1, 130, 130)
      gesture("pointerUp", 1, 130, 130)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.active!.rotation).toBe((piece.rotation + 1) % 4)
    })

    it("starts on a tap, and restarts after game over", () => {
      render(<TetrisPage />)

      gesture("pointerDown", 1, 130, 124)
      gesture("pointerUp", 1, 130, 124)
      expect(announcement()).toMatch(/playing/i)

      playToGameOver()
      expect(announcement()).toMatch(/game over/i)

      gesture("pointerDown", 2, 130, 124)
      gesture("pointerUp", 2, 130, 124)
      expect(announcement()).toMatch(/playing/i)
      expect(mockCanvasProps!.engine.readout.score).toBe(0)
    })

    it("soft-drops while a slow drag holds the finger down", () => {
      render(<TetrisPage />)
      fireEvent.keyDown(surface(), { key: "Enter" })
      const { engine, controller } = mockCanvasProps!
      const before = engine.active!.y

      gesture("pointerDown", 1, 130, 100)
      gesture("pointerMove", 1, 130, 130)
      // One Tick of soft drop is a fraction of a row at level 1; three pay one.
      act(() => {
        engine.tick(controller.nextIntent())
        engine.tick(controller.nextIntent())
        engine.tick(controller.nextIntent())
      })
      expect(engine.active!.y).toBeGreaterThan(before)
      // Lifting the finger lets go of the drop.
      gesture("pointerUp", 1, 130, 130)
    })

    it("hard-drops on a fast downward flick", () => {
      render(<TetrisPage />)
      fireEvent.keyDown(surface(), { key: "Enter" })
      const { engine, controller } = mockCanvasProps!

      // A flick is a speed, and the gesture clock is performance.now — pin it.
      let ms = 0
      const now = jest.spyOn(performance, "now").mockImplementation(() => ms)
      gesture("pointerDown", 1, 130, 100)
      ms = 20
      gesture("pointerMove", 1, 130, 110)
      ms = 40
      gesture("pointerMove", 1, 130, 150)
      ms = 60
      gesture("pointerUp", 1, 130, 180)
      now.mockRestore()

      act(() => engine.tick(controller.nextIntent()))
      // The flick locked the piece onto the floor of the well.
      expect(
        engine.board.some((row) => row.some((cell) => cell !== null))
      ).toBe(true)
      // …and the next piece is already falling in its place.
      expect(engine.active).not.toBeNull()
    })

    it("holds on a swipe up", () => {
      render(<TetrisPage />)
      fireEvent.keyDown(surface(), { key: "Enter" })
      const { engine, controller } = mockCanvasProps!
      const piece = engine.active!.key
      const queued = engine.readout.next[0]

      gesture("pointerDown", 1, 130, 130)
      gesture("pointerMove", 1, 130, 110)
      gesture("pointerUp", 1, 130, 90)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.readout.hold).toBe(piece)
      expect(engine.active!.key).toBe(queued)
    })

    it("plays nothing from a mouse, and no rotation from a resume tap", () => {
      render(<TetrisPage />)
      fireEvent.keyDown(surface(), { key: "Enter" })
      const { engine, controller } = mockCanvasProps!
      const piece = { ...engine.active! }

      // A mouse drag on the surface gestures nothing: the desktop has the
      // keyboard, and a click that played would be a surprise.
      mouseGesture("pointerdown", 1, 130, 130)
      mouseGesture("pointermove", 1, 155, 130)
      mouseGesture("pointerup", 1, 155, 130)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.active!.x).toBe(piece.x)
      expect(engine.active!.rotation).toBe(piece.rotation)

      // A tap that lands on a paused cabinet resumes it — and nothing else.
      fireEvent.keyDown(surface(), { key: "Escape" })
      expect(announcement()).toMatch(/paused/i)
      gesture("pointerDown", 2, 130, 130)
      gesture("pointerUp", 2, 130, 130)
      expect(announcement()).toMatch(/playing/i)
      act(() => engine.tick(controller.nextIntent()))
      expect(engine.active!.x).toBe(piece.x)
      expect(engine.active!.rotation).toBe(piece.rotation)
    })
  })
})
