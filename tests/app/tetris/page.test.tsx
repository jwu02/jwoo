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
    expect(
      fireEvent.keyDown(surface(), { key: "ArrowUp", altKey: true })
    ).toBe(true)
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
})
