import { act, render } from "@testing-library/react"

import { TypeWriter } from "@/components/home/typewriter"

describe("TypeWriter", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("reveals the text one character at a time with a caret, then stops", () => {
    const { container } = render(<TypeWriter text="Hi" />)

    // Nothing typed yet — just the caret.
    expect(container.textContent).toBe("|")

    act(() => jest.advanceTimersByTime(55))
    expect(container.textContent).toBe("H|")

    act(() => jest.advanceTimersByTime(55))
    expect(container.textContent).toBe("Hi|")

    // Once complete, the interval stops and nothing more appears.
    act(() => jest.advanceTimersByTime(5000))
    expect(container.textContent).toBe("Hi|")
  })
})
