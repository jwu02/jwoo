// The one place real time becomes game time.
//
// The Engine only knows Ticks (ADR 0005). Everything that measures the clock —
// a browser frame, a throttled frame, a test — hands its elapsed milliseconds
// to this accumulator, which pays out whole Ticks and keeps the remainder. That
// is the whole of frame-rate independence: 144 frames of 6.94 ms and one frame
// of 1000 ms pay the same sixty Ticks, because both are just elapsed time.

export interface TickClock {
  /** Whole Ticks this much elapsed time buys; the remainder is carried. */
  advance(elapsedMs: number): number
  /** Drop the carried remainder — the driver's gesture when it stops paying Ticks. */
  reset(): void
}

export function createTickClock(tickHz: number): TickClock {
  const ticksPerMs = tickHz / 1000
  let carried = 0

  return {
    advance(elapsedMs: number) {
      if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
      carried += elapsedMs * ticksPerMs
      // A second of real frames lands a hair under sixty Ticks once the
      // divisions have rounded; without this the clock would lose that Tick
      // every second it ran.
      const ticks = Math.floor(carried + 1e-9)
      carried -= ticks
      return ticks
    },
    reset() {
      carried = 0
    },
  }
}
