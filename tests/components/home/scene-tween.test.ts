import {
  TWEEN_SETTLE_EPSILON,
  TWEEN_SPEED,
  tweenSettled,
  tweenStep,
} from "@/components/home/scene-tween"
import type { Vec3 } from "@/components/home/scene-focus"

describe("tweenStep", () => {
  it("covers a fraction of the remaining distance, set by the elapsed time", () => {
    const next = tweenStep([0, 0, 0], [10, 0, 0], 1 / 60)

    expect(next[0]).toBeCloseTo(10 * (1 - Math.exp(-TWEEN_SPEED / 60)), 9)
    expect(next[0]).toBeGreaterThan(0)
    expect(next[0]).toBeLessThan(10)
  })

  it("lands in the same place whether stepped once or frame by frame", () => {
    // The whole point of deriving the fraction from elapsed time: a tween must
    // settle in the same wall-clock time at 60fps and at 30fps. Half a second is
    // one step of 0.5s, or thirty steps of 1/60s — the exponential composes
    // (e^-kt · e^-kt = e^-2kt), so the two agree.
    const target: Vec3 = [8, 4, -2]
    const oneStep = tweenStep([0, 0, 0], target, 0.5)

    let frameByFrame: Vec3 = [0, 0, 0]
    for (let frame = 0; frame < 30; frame++) {
      frameByFrame = tweenStep(frameByFrame, target, 1 / 60)
    }

    for (let axis = 0; axis < 3; axis++) {
      expect(frameByFrame[axis]).toBeCloseTo(oneStep[axis], 9)
    }
  })

  it("settles on the target within the epsilon", () => {
    const target: Vec3 = [5, -3, 1]
    let current: Vec3 = [0, 0, 0]
    expect(tweenSettled(current, target)).toBe(false)

    // The tween is visually settled after ~0.5s, but the epsilon is tight: a
    // distance of ~5.9 units at speed 6 only falls inside 0.001 after ~1.5s.
    for (let frame = 0; frame < 120; frame++) current = tweenStep(current, target, 1 / 60)

    expect(tweenSettled(current, target)).toBe(true)
  })

  it("never overshoots the target", () => {
    const target: Vec3 = [1, 1, 1]
    let current: Vec3 = [0, 0, 0]
    for (let frame = 0; frame < 20; frame++) {
      current = tweenStep(current, target, 1 / 60)
      expect(current[0]).toBeLessThanOrEqual(target[0])
    }
  })
})

describe("tweenSettled", () => {
  it("is true only inside the settle epsilon", () => {
    expect(tweenSettled([0, 0, 0], [TWEEN_SETTLE_EPSILON / 2, 0, 0])).toBe(true)
    expect(tweenSettled([0, 0, 0], [TWEEN_SETTLE_EPSILON * 2, 0, 0])).toBe(false)
  })

  it("measures the distance in all three axes, not one", () => {
    const justInside = TWEEN_SETTLE_EPSILON / Math.sqrt(3) / 2
    expect(tweenSettled([0, 0, 0], [justInside, justInside, justInside])).toBe(true)
  })
})
