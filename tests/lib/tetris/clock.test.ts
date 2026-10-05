/**
 * @jest-environment node
 */
import { createTickClock } from "@/lib/tetris/clock"

describe("the Tick clock", () => {
  it("pays the same Ticks for the same time, however it arrives", () => {
    const oneSecond = 1000
    const pay = (frameMs: number, frames: number) => {
      const clock = createTickClock(60)
      let ticks = 0
      for (let i = 0; i < frames; i++) ticks += clock.advance(frameMs)
      return ticks
    }
    expect(pay(oneSecond, 1)).toBe(60)
    expect(pay(1000 / 60, 60)).toBe(60)
    expect(pay(1000 / 120, 120)).toBe(60)
    expect(pay(1000 / 144, 144)).toBe(60)
    // A slow frame after fast ones does not lose the time it swallowed.
    expect(pay(oneSecond / 3, 3)).toBe(60)
  })

  it("carries the remainder instead of dropping it", () => {
    const clock = createTickClock(60)
    const msPerTick = 1000 / 60
    // Three quarters of a Tick at a time is one Tick every fourth call.
    const quarter = msPerTick / 4
    expect(clock.advance(quarter)).toBe(0)
    expect(clock.advance(quarter)).toBe(0)
    expect(clock.advance(quarter)).toBe(0)
    expect(clock.advance(quarter)).toBe(1)
    expect(clock.advance(quarter)).toBe(0)
  })

  it("pays nothing for no time or nonsense, and forgets on reset", () => {
    const clock = createTickClock(60)
    expect(clock.advance(0)).toBe(0)
    expect(clock.advance(-5)).toBe(0)
    expect(clock.advance(Number.NaN)).toBe(0)
    expect(clock.advance(Number.POSITIVE_INFINITY)).toBe(0)

    const msPerTick = 1000 / 60
    expect(clock.advance(msPerTick * 0.9)).toBe(0)
    clock.reset()
    expect(clock.advance(msPerTick * 0.9)).toBe(0)
    expect(clock.advance(msPerTick * 0.2)).toBe(1)
  })

  it("runs at the rate it was built with", () => {
    const fast = createTickClock(120)
    expect(fast.advance(1000)).toBe(120)
    const small = createTickClock(6)
    expect(small.advance(1000)).toBe(6)
  })
})
